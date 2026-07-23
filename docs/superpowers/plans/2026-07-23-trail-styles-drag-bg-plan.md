# Trail Styles, Drag Distortion, Configurable Background — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add three visual/interaction features — per-particle trail styles (solid/dashed/dotted/glow), mouse drag push distortion, gradient background support

**Architecture:** Add state params → pointer events in main.js → Canvas2D particle draw/update → WebGPU compute (trail style + push force) + render (fragment style variants). All additive, no existing behavior changes.

**Tech Stack:** Vanilla JS ES modules, WGSL (inlined JS template strings), Canvas2D, WebGPU

## Global Constraints

- `S` state changes use the existing Proxy pattern (auto-emits `state:change`)
- Uniform buffers are manually packed `ArrayBuffer` (alignment: 16B)
- WGSL inlined as `export const WGSL_xxx = \`...\`` template strings
- Canvas2D and WebGPU paths must both work
- No new dependencies
- Build: `node build.js`

---

### Task 1: Add New State Parameters

**File:** `js/state.js`

- [ ] **Add to defaults in `js/state.js`**

In the `txt` defaults: add `trailStyle: 'random'`
In the `bg` defaults: add `trailStyle: 'random'`
At top level (same indentation as `txt`, `bg`): add:

```js
distortion: {
  enabled: true,
  radius: 120,
  strength: 3,
},
pointer: { x: 0, y: 0, down: false },
bgType: 'solid',
bgGradient: {
  colors: ['#000000', '#1a1a2e', '#16213e'],
  dir: 'v',
},
```

- [ ] **Commit**

```bash
git add js/state.js
git commit -m "feat: add trail style, distortion, pointer, bgGradient state params"
```

---

### Task 2: Configurable Background

**File:** `js/main.js`

**Consumes:** `S.bgType`, `S.bgColor`, `S.bgGradient`

- [ ] **Add gradient cache variables at module scope**

```js
let bgLinearGrad = null;
let bgRadialGrad = null;
```

- [ ] **Replace solid background fill in animate loop**

Find the existing background fill (currently `ctx.fillStyle = S.bgColor; ctx.fillRect(...)`) and replace with:

```js
if (S.bgType === 'solid') {
  ctx.fillStyle = S.bgColor;
  ctx.fillRect(0, 0, w, h);
} else {
  const dpr = S.bgType === 'linear' ? bgLinearGrad : bgRadialGrad;
  if (!dpr || dpr._dirty) {
    let g;
    if (S.bgType === 'linear') {
      if (S.bgGradient.dir === 'h') g = ctx.createLinearGradient(0, 0, w, 0);
      else if (S.bgGradient.dir === 'v') g = ctx.createLinearGradient(0, 0, 0, h);
      else g = ctx.createLinearGradient(0, 0, w, h);
    } else {
      const cx = w / 2, cy = h / 2;
      g = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.max(w, h) * 0.7);
    }
    for (let i = 0; i < S.bgGradient.colors.length; i++) {
      g.addColorStop(i / (S.bgGradient.colors.length - 1), S.bgGradient.colors[i]);
    }
    if (S.bgType === 'linear') bgLinearGrad = g;
    else bgRadialGrad = g;
    if (bgLinearGrad) bgLinearGrad._dirty = false;
    if (bgRadialGrad) bgRadialGrad._dirty = false;
  }
  ctx.fillStyle = S.bgType === 'linear' ? bgLinearGrad : bgRadialGrad;
  ctx.fillRect(0, 0, w, h);
}
```

- [ ] **Add gradient invalidation on param change**

Add to existing state listener (or create one if none exists):

```js
bus.on('state:change', (path) => {
  if (path && (path === 'S.bgType' || path.startsWith('S.bgGradient') || path === 'S.bgColor')) {
    if (bgLinearGrad) bgLinearGrad._dirty = true;
    if (bgRadialGrad) bgRadialGrad._dirty = true;
  }
});
window.addEventListener('resize', () => {
  if (bgLinearGrad) bgLinearGrad._dirty = true;
  if (bgRadialGrad) bgRadialGrad._dirty = true;
});
```

- [ ] **Build and commit**

```bash
node build.js
git add js/main.js
git commit -m "feat: gradient background (linear/radial) with cache"
```

---

### Task 3: Pointer Input + Canvas2D Drag Distortion

**Files:** `js/main.js`, `js/renderers/canvas2d.js`

**Consumes:** `S.pointer`, `S.distortion`

- [ ] **Add pointer event listeners in `js/main.js`**

```js
(function initPointer() {
  let pointerDown = false;
  canvas.addEventListener('pointerdown', (e) => {
    if (S.distortion.enabled) {
      pointerDown = true;
      S.pointer = { x: e.offsetX, y: e.offsetY, down: true };
    }
  });
  canvas.addEventListener('pointermove', (e) => {
    S.pointer = { x: e.offsetX, y: e.offsetY, down: pointerDown };
  });
  canvas.addEventListener('pointerup', () => {
    pointerDown = false;
    S.pointer = { ...S.pointer, down: false };
  });
  canvas.addEventListener('pointerleave', () => {
    pointerDown = false;
    S.pointer = { ...S.pointer, down: false };
  });
})();
```

- [ ] **Add push force to Canvas2D particle update**

In `js/renderers/canvas2d.js`, in both `TextParticle.update()` and `BgParticle.update()`, at the end add:

```js
if (S.distortion.enabled && S.pointer.down) {
  const dx = this.x - S.pointer.x;
  const dy = this.y - S.pointer.y;
  const dist = Math.sqrt(dx * dx + dy * dy);
  if (dist < S.distortion.radius && dist > 0) {
    const force = S.distortion.strength * (1 - dist / S.distortion.radius);
    this.x += (dx / dist) * force;
    this.y += (dy / dist) * force;
  }
}
```

- [ ] **Build and commit**

```bash
node build.js
git add js/main.js js/renderers/canvas2d.js
git commit -m "feat: pointer input and Canvas2D drag push distortion"
```

---

### Task 4: Trail Styles in Canvas2D

**File:** `js/renderers/canvas2d.js`

**Consumes:** `S.txt.trailStyle`, `S.bg.trailStyle`

- [ ] **Add per-particle trail style at spawn**

In TextParticle constructor/reset, after existing init:

```js
if (S.txt.trailStyle === 'random') {
  this.style = Math.floor(Math.random() * 4);
} else {
  const idx = ['solid','dashed','dotted','glow'].indexOf(S.txt.trailStyle);
  this.style = idx >= 0 ? idx : 0;
}
```

Same for BgParticle using `S.bg.trailStyle`.

- [ ] **Add style-based rendering in `draw()` trail branch**

Find the trail `ctx.stroke()` call in TextParticle/BgParticle draw. Before it:

```js
if (this.style === 1) ctx.setLineDash([8, 6]);
else if (this.style === 2) { ctx.setLineDash([2, 6]); ctx.lineCap = 'round'; }
else if (this.style === 3) { ctx.shadowBlur = 12; ctx.shadowColor = ctx.strokeStyle; }

ctx.stroke();

ctx.setLineDash([]);
ctx.lineCap = 'butt';
ctx.shadowBlur = 0;
ctx.shadowColor = 'transparent';
```

- [ ] **Build and commit**

```bash
node build.js
git add js/renderers/canvas2d.js
git commit -m "feat: Canvas2D trail styles (dashed, dotted, glow)"
```

---

### Task 5: Trail Styles in WebGPU

**Files:** `js/gpu/compute.js`, `js/gpu/render.js`, `js/renderers/webgpu.js`

- [ ] **Pack trail style into particle params in `createParticleBuffers`** (`js/gpu/compute.js`)

Line 175 — change:

```js
uintView[base + 11] = isBg ? 1 : 0;
```

To:

```js
const trailStyle = Math.floor(Math.random() * 4);
uintView[base + 11] = (isBg ? 1 : 0) | (trailStyle << 1);
```

- [ ] **Update reseed in compute WGSL** (`js/gpu/compute.js`)

In `reseed()`, line 79:

```wgsl
(*p).params = vec4(10u, 10u, 0u, isBg);
```

Change to:

```wgsl
let trailStyle = u32(randFloat(seed) * 3.999);
(*p).params = vec4(10u, 10u, 0u, isBg | (trailStyle << 1u));
```

- [ ] **Add trail style + segT to render vertex/fragment** (`js/gpu/render.js`)

Update `VertexOutput`:

```wgsl
struct VertexOutput {
  @builtin(position) position: vec4<f32>,
  @location(0) color: vec4<f32>,
  @location(1) segT: f32,
  @location(2) style: u32,
};
```

In `trailVertex()`, change:
```wgsl
  let isBg = p.params.w;
```
To:
```wgsl
  let raw = p.params.w;
  let isBg = raw & 1u;
  let style = (raw >> 1u) & 3u;
```

And add passing to output:
```wgsl
  output.color = vec4(p.color.rgb, p.color.a * alpha);
  output.segT = f32(segmentIdx) / f32(maxLen);
  output.style = style;
```

- [ ] **Update trail fragment shader** (`js/gpu/render.js`)

Replace `WGSL_TRAIL_FRAG`:

```wgsl
export const WGSL_TRAIL_FRAG = `
@fragment
fn trailFragment(input: VertexOutput) -> @location(0) vec4<f32> {
  var color = input.color;
  if (input.style == 1u) {
    let dashPos = fract(input.segT * 20.0);
    if (dashPos > 0.5) { discard; }
  }
  if (input.style == 2u) {
    let dotPos = fract(input.segT * 30.0);
    if (dotPos > 0.3) { discard; }
  }
  if (input.style == 3u) {
    color.a *= 0.7;
  }
  return color;
}
`;
```

- [ ] **Build and commit**

```bash
node build.js
git add js/gpu/compute.js js/gpu/render.js
git commit -m "feat: WebGPU trail styles (dashed, dotted, glow) via packed params + fragment discard"
```

---

### Task 6: Drag Distortion in WebGPU

**Files:** `js/gpu/compute.js`, `js/renderers/webgpu.js`

- [ ] **Extend compute uniform buffer with mouse fields** (`js/gpu/compute.js`)

In `Uniforms` WGSL struct, add after the existing fields:

```wgsl
  mouseX        : f32,
  mouseY        : f32,
  mouseStrength : f32,
  distRadius    : f32,
  _pad2         : f32,
```

- [ ] **Add push force logic in compute WGSL** (`js/gpu/compute.js`)

After the existing position update (line 116) and before storing to trail (line 118), add:

```wgsl
  if (uni.mouseStrength > 0.0) {
    let toParticle = (*p).pos - vec2(uni.mouseX, uni.mouseY);
    let dist = length(toParticle);
    if (dist < uni.distRadius && dist > 0.0) {
      let force = uni.mouseStrength * (1.0 - dist / uni.distRadius);
      (*p).pos += normalize(toParticle) * force;
    }
  }
```

- [ ] **Update uniform buffer size and write in webgpu.js**

Change buffer size from 80 to 96 (line 56-58):

```js
this.txtUniformBuffer = this.device.createBuffer({
  size: 96,
  usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
});
this.bgUniformBuffer = this.device.createBuffer({
  size: 96,
  usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
});
```

In `_writeUniforms()`, add after the existing field assignments:

```js
f32[19] = S.pointer.x;
f32[20] = S.pointer.y;
f32[21] = (S.distortion.enabled && S.pointer.down) ? S.distortion.strength : 0;
f32[22] = S.distortion.radius;
```

- [ ] **Build and commit**

```bash
node build.js
git add js/gpu/compute.js js/renderers/webgpu.js
git commit -m "feat: WebGPU drag push distortion via compute uniform"
```

---

### Task 7: Build and Final Verification

- [ ] **Full build**

```bash
node build.js
```

Expected output: `index.html ensamblado`

- [ ] **Verify commit log**

```bash
git log --oneline -8
```
Expected: 6-7 commits on top of the branch

- [ ] **Final commit message**

No code change — just verify all tasks committed.
