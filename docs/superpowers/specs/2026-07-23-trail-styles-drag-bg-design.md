# Trail Styles, Drag Distortion, and Configurable Background

## Overview

Three visual/interaction features for FlowField Studio:

1. **Trail styles** — particles render their trails with one of four styles (solid, dashed, dotted, glow), assigned randomly per particle at spawn
2. **Drag distortion** — mouse dragging pushes particles away from the cursor (Push mode)
3. **Configurable background** — support linear and radial gradients in addition to solid color

## Architecture

All three features are **additive** — they add new parameters to `S` (state.js), extend the existing renderers, and add mouse input to `main.js`. No existing behavior changes.

```
main.js
  ├── mouse events → bus.emit('pointer', { x, y, down })
  ├── background render (solid/gradient) before effect.render()
  └── passes pointer state to effect.renderer (via S or bus)

effect.js
  ├── reads S.distortion params
  └── passes mouse data to renderers

state.js
  ├── S.txt.trailStyle = 'random'   (evaluated at spawn → per-particle)
  ├── S.bg.trailStyle = 'random'
  ├── S.distortion = { radius, strength, enabled }
  └── S.bgType = 'solid'|'linear'|'radial'
      S.bgGradient = { colors, dir }

Canvas2DRenderer
  ├── particle.draw(): ctx.setLineDash / shadowBlur per style
  └── particle.update(): velocity modulated by mouse push vector

WebGPURenderer
  ├── compute shader: push vector from mousePos uniform
  └── render shader: trailStyle flag per particle → fragment variation
```

## 1. Trail Styles (Canvas2D)

### Parameter

```js
// state.js additions
S.txt.trailStyle = 'random'  // 'random' | 'solid' | 'dashed' | 'dotted' | 'glow'
S.bg.trailStyle = 'random'
```

When set to `'random'`, each particle picks a style at spawn (`Math.floor(Math.random() * 4)` → 0 solid, 1 dashed, 2 dotted, 3 glow). The resolved style is stored per particle instance.

### Rendering

| Style | Canvas2D Implementation |
|-------|------------------------|
| solid | `ctx.stroke()` (current behavior, no change) |
| dashed | `ctx.setLineDash([8, 6])` before stroke |
| dotted | `ctx.setLineDash([2, 6])`, `ctx.lineCap = 'round'` before stroke |
| glow | `ctx.shadowBlur = 12`, `ctx.shadowColor = particle.color` before stroke, then restore |

All per-particle style state is restored after draw to avoid cross-contamination.

### WebGPU Implementation

The compute shader already stores a `u32 params` field per particle (`params[0-3]`). Add a `trailStyle` field (u32, 0-3) to the particle struct. The render (fragment) shader receives this via the particle buffer:

- **0 (solid)**: current behavior — full alpha segment
- **1 (dashed)**: step function over segment UV — discard when `fract(uv * freq) > 0.5`
- **2 (dotted)**: similar step with `lineCap = round` equivalent (discard except small circles)
- **3 (glow)**: alpha ramp — higher alpha at center of trail, falloff toward edges, additive-like blending

For glow in WebGPU, the fragment shader can use the distance from the trail segment centerline to create a Gaussian falloff, keeping the same `one-minus-src-alpha` blending but with a wider alpha distribution.

## 2. Drag Distortion (Push)

### Parameter

```js
// state.js additions
S.distortion = {
  enabled: true,
  radius: 120,
  strength: 3,
}
```

### Input

`main.js` registers pointer events on the canvas:
- `pointerdown` → `S.pointer.down = true`
- `pointermove` → `S.pointer = { x: e.offsetX, y: e.offsetY, down }` (same `down` state)
- `pointerup` → `S.pointer.down = false`
- `pointerleave` → `S.pointer.down = false`

`S.pointer` is a reactive state object that triggers `state:change` on update. Both renderers read from it each frame. No new bus event needed — the existing reactivity handles propagation.

```js
// state.js
S.pointer = { x: 0, y: 0, down: false }
```

### Canvas2D

In `particle.update()`, after computing new position from the flow field:

```js
if (mouseDown) {
  const dx = particle.x - mouseX;
  const dy = particle.y - mouseY;
  const dist = Math.sqrt(dx * dx + dy * dy);
  if (dist < distortion.radius && dist > 0) {
    const force = distortion.strength * (1 - dist / distortion.radius);
    particle.x += (dx / dist) * force;
    particle.y += (dy / dist) * force;
  }
}
```

### WebGPU

The compute shader receives `mousePos` (vec2<f32>) and `mouseStrength` (f32) as uniforms. After the flow field lookup and velocity update, if `mouseStrength > 0`:

```wgsl
let toParticle = particle.pos - mousePos;
let dist = length(toParticle);
if (dist < uni.distRadius && dist > 0.0) {
  let force = uni.distStrength * (1.0 - dist / uni.distRadius);
  particle.pos += normalize(toParticle) * force;
}
```

The `distRadius` and `distStrength` are written from `S.distortion.radius` and `S.distortion.strength` each frame, and `mouseStrength` is 0 when pointer is up, `S.distortion.strength` when down.

The uniform also needs `mouseX, mouseY` in canvas coordinates (float), plus a `mouseDown` flag (0/1). These go into the compute uniform buffer (currently 80 bytes; extend to 96 bytes).

### Refresh

When particles are pushed, they eventually drift back via normal flow field forces. No explicit reset needed — the push is a one-shot velocity modulation per frame while dragging.

## 3. Configurable Background

### Parameter

```js
// state.js additions
S.bgType = 'solid'       // 'solid' | 'linear' | 'radial'
S.bgGradient = {
  colors: ['#000000', '#1a1a2e', '#16213e'],
  dir: 'v',              // 'h' | 'v' | 'd' (horizontal, vertical, diagonal)
}
```

### Rendering

In `main.js` animate loop, **before** `effect.render(ctx)`:

```js
if (S.bgType === 'solid') {
  ctx.fillStyle = S.bgColor;
  ctx.fillRect(0, 0, w, h);
} else {
  // Cache gradient, recreate on resize or param change
  const grad = S.bgType === 'linear'
    ? ctx.createLinearGradient(...)
    : ctx.createRadialGradient(...);
  grad.addColorStop(0, S.bgGradient.colors[0]);
  // ... for each color
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);
}
```

The gradient is cached in `main.js` and recreated on resize or when `S.bgGradient` / `S.bgType` changes (listen on `bus`).

For WebGPU, the fade pass already draws a fullscreen transparent overlay. The background fill happens on the 2D context (the canvas is a mixed-mode canvas: WebGPU renders on top of a 2D-cleared background). Actually — the current architecture uses the **same canvas** for both. Let me check...

Looking at the existing code:
- `main.js` animate clears with `ctx.fillStyle = S.bgColor; ctx.fillRect(0, 0, w, h)` before calling `effect.render(ctx)`, which then calls `this.renderer.render(ctx)`.
- For Canvas2D, this works fine — the background clears the canvas, then particles paint on top.
- For WebGPU, the canvas context is `'webgpu'` — `effect.canvas.getContext('webgpu')`. So `main.js` is calling `ctx.fillRect` on a **different** context (the 2D context from `canvas.getContext('2d')`), while the WebGPU renderer uses `canvas.getContext('webgpu')`.

Wait, looking more carefully at the code... `main.js` has a separate 2D context (`ctx` = `canvas.getContext('2d')`), and `effect.canvas` is the same canvas. The `Effect` creates a renderer that uses `effect.canvas.getContext('webgpu')` if WebGPU is available. So the 2D context and WebGPU context share the same canvas.

This means for WebGPU, the background fill via `ctx.fillRect` on the 2D context works — WebGPU renders *on top* of whatever is on the canvas. The fade pass in WebGPU adds transparency to gradually fade out the previous frame, while the 2D context clears/redraws the background.

So the background gradient just needs to happen in `main.js`'s animate loop, replacing the current solid fill, and it will work for both renderers.

### Radial gradient specifics

```js
if (S.bgType === 'radial') {
  grad = ctx.createRadialGradient(w/2, h/2, 0, w/2, h/2, Math.max(w, h) * 0.7);
}
```

## Files Changed

| File | Changes |
|------|---------|
| `js/state.js` | Add `S.txt.trailStyle`, `S.bg.trailStyle`, `S.distortion`, `S.bgType`, `S.bgGradient` |
| `js/main.js` | Add pointer events, background gradient rendering, pass mouse to renderers |
| `js/effect.js` | Forward pointer data to renderers, handle `distortion` reinit |
| `js/renderers/canvas2d.js` | Trail style rendering in `draw()`, push force in `update()` |
| `js/gpu/compute.js` | WGSL — add push force logic, extend uniform buffer, add trail style field |
| `js/gpu/render.js` | WGSL — add trail style variant in fragment shader |
| `js/renderers/webgpu.js` | Extend uniform buffers, pass mouse/distorion params, update bind groups |
| (none) | No new bus events needed — `S.pointer` is reactive via existing state Proxy |

## Edge Cases

- **No WebGPU**: Trail styles and drag work in Canvas2D. Background gradient works on 2D context, same as always.
- **Resize**: Background gradient cache recreated. Mouse coordinates are relative to canvas (no scaling needed if canvas == CSS size).
- **Pointer leaves canvas**: set `mouseDown = false` so particles aren't pushed off-screen indefinitely.
- **`glow` + WebGPU**: glow uses wider blending — may overlap with shape mode; shape mode ignores trailStyle (trail style only applies in trail mode, shapes are solid).
- **Particle respawn**: trail styles are reassigned randomly when particles respawn.
