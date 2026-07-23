# GPU Acceleration — WebGPU + Canvas 2D Fallback

Date: 2026-07-22
Status: Draft
Author: OpenCode

## Current Performance Profile

| Metric | Value (1920×1080, defaults) |
|---|---|
| Text particles | 2,000 (configurable up to 8,000) |
| Bg particles | 400 (up to 3,000) |
| Flow field cells | ~84K per field (cellSize=5) |
| Trig calls/frame | ~4,800 (Math.cos/sin per particle) |
| save/restore/frame | ~2,400+ |
| Noise calls at init | ~166K |
| Threading | Single-thread, main thread |
| GC pressure | High (array push/shift per frame per particle) |

## Architecture

```
State (S) ──► Effect
                 │
      ┌──────────┴──────────┐
      ▼                     ▼
WebGPURenderer       Canvas2DRenderer
(browser w/ WebGPU)   (export / fallback)
      │
      ▼
WebGPU Device ──► Compute Pipe ──► Render Pipe
```

- `Effect.render(ctx)` delegates to the active renderer
- Renderer interface: `{ init(), render(ctx), resize(w,h), destroy() }`
- Canvas2DRenderer is the existing Canvas 2D code extracted into its own module
- WebGPURenderer is the new GPU-accelerated path
- Detection: `if (navigator.gpu)` — transparent, no user toggle

## WebGPU Device Setup

File: `js/renderers/webgpu.js` — class `WebGPURenderer`

```
1. adapter = await navigator.gpu.requestAdapter()
2. device  = await adapter.requestDevice()
3. context = canvas.getContext('webgpu')
4. Configure: format='bgra8unorm', usage: renderAttachment
5. Swap chain: device.createSwapChain()
```

On `resize(w,h)`:
- Reconfigure swap chain
- No shader recompilation needed

On `destroy()`:
- device.destroy()
- Release all GPU resources

## Particle Data Layout

### Storage Buffers (GPU → GPU)

```
struct Particle {
  pos   : vec2<f32>,    // 8B  — current position
  prev  : vec2<f32>,    // 8B  — previous frame position (for trail)
  dir   : vec2<f32>,    // 8B  — precomputed (cos(angle), sin(angle)) * speedMod
  params: vec4<u32>,    // 16B — age: u32, maxLen: u32, cursor: u32, padding: u32
  color : vec4<f32>,    // 16B — RGBA
};                      // 56B → padded to 64B

// Trail history: flat ring buffer
// trail[particleIdx * MAX_TRAIL + slot] = vec2<f32>
// MAX_TRAIL = 64 (hard cap, down from current UI max of 500)
```

Memory: 100K particles × 64B = 6.4MB (particle state) + 100K × 64 × 8B = 51.2MB (trail). Acceptable on modern GPUs.

### Uniform Buffer (CPU → GPU)

```
struct FrameUniforms {
  cellSize     : f32,
  txtNoiseScale: f32,
  txtAngleMult : f32,
  txtBoost     : f32,
  bgNoiseScale : f32,
  bgAngleMult  : f32,
  time         : f32,
  canvasWidth  : f32,
  canvasHeight : f32,
  maxTrail     : u32,
  textCellCount: u32,
  bgParticleCount: u32,
};
```

Upload once per frame via `queue.writeBuffer()`.

## Compute Pipeline — Particle Simulation

File: `js/gpu/simulation.wgsl`  
Dispatch: `@workgroup_size(256)`, groups = ceil(numParticles / 256)

Per-particle per-frame:
1. **Read flow field**: sample `flowFieldTexture` at `pos / cellSize`
   - `rg8unorm` texture: R = normalized angle, G = inText flag
   - `angle = (texel.r * 2 - 1) * PI * angleMult`
2. **Update position**:
   - `pos += dir * (inText ? txtBoost : 1.0)`
   - `dir` is precomputed: `(cos(angle), sin(angle)) * speedMod`
   - Wave: `prev = pos` before move
3. **Ring buffer write**:
   - `trail[particleIdx * MAX_TRAIL + cursor] = prev`
   - `cursor = (cursor + 1) % MAX_TRAIL`
4. **Age & lifecycle**:
   - `age++`
   - If `age > activeLife` (where `activeLife = maxLen`): decrement
   - If `age > maxLen * 2` (dying phase): respawn
5. **Respawn**:
   - Select random `textCell` from `textCellBuffer`
   - `pos = textCell.position + random(cellSize)`
   - `age = 0`, `cursor = 0`

### Flow Field Texture

Built on CPU when noise/angle parameters change (`refreshTextFlow()`, `refreshBgFlow()`, or via `Effect.refreshTextFlow()` / `Effect.refreshBgFlow()`):

```
for each cell (row, col):
  angle = noise(x / noiseScale, y / noiseScale) * PI * angleMult
  flowTexture[row * columns + col] = (angle / (2*PI) + 0.5, inText ? 1 : 0)
```

Upload via `queue.writeTexture()` to a `rg8unorm` texture of size `columns × rows`.

Two textures: `txtFlowTexture` and `bgFlowTexture`.

### Particle Spawn Data

`textCellBuffer`: storage buffer of `vec2<f32>`, one per valid text cell. Pre-built on CPU during `Effect.init()`.

## Render Pipeline — Trails

File: `js/gpu/render.wgsl` (vertex + fragment in same module)

### Vertex shader — Trail mode

Input: `@builtin(instance_index)` = particle index

For each particle, output `MAX_TRAIL - 1` quads as triangle strips:
- Read `trail[particleIdx * MAX_TRAIL + slot]` and `trail[... + slot + 1]`
- Expand each segment to a quad: perpendicular offset = `± lineWidth / 2`
- 6 vertices per segment (2 triangles)

Alpha per vertex: `alpha = opacity * (1 - (age - slot) / maxLen)` for smooth fade along trail.

### Vertex shader — Shape mode

Input: `@builtin(instance_index)` = particle index, plus vertex buffer for base geometry.

For each history point within the particle's trail:
- `t = slot / maxLen`
- `size = shapeSize * (0.2 + 0.8 * t)`
- `alpha = opacity * (0.3 + 0.7 * t)`
- Transform base geometry by `size` and `trail[particleIdx * MAX_TRAIL + slot]`

Shape geometry pre-built in vertex buffers:
- Circle: fan of 32 triangles
- Triangle: 3 vertices
- Diamond: 4 vertices
- Star: 10 vertices (concave polygon)
- Square: 4 vertices

### Fragment shader

- Interpolated color × alpha
- Blend mode: `source-over` by default (`blend.srcFactor = one, blend.dstFactor = one-minus-src-alpha`)
- Other modes via separate pipelines or bind-group constants

### Fade Pass

Before particle rendering, a full-screen quad pass:
- Draw full-canvas quad with color = `(0,0,0,fadeAlpha)`
- Leaves motion-trail effect similar to current `ctx.fillRect` with `rgba(...)`

Separate render pass with `blend.srcFactor = one, blend.dstFactor = one-minus-src-alpha`.

### Render Order

1. Fade pass (accumulation buffer)
2. Bg particles (opacity-based, avoidText zone check via flow field G channel)
3. Text particles
4. Debug overlay (if S.debug):
   - Grid lines as line list
   - Text mask cells as filled quads

## Canvas 2D Renderer (Fallback / Export)

File: `js/renderers/canvas2d.js`

Extract current `TextParticle`, `BgParticle`, `drawShape` from `js/particle.js` into a single module. The `Canvas2DRenderer` class:

```
class Canvas2DRenderer {
  constructor(effect) { ... }
  init()  { }
  render(ctx) { /* same loop as current Effect.render */ }
  resize(w,h) { }
  destroy() { }
}
```

`Effect.render()` becomes:

```
render(ctx) {
  this.renderer.render(ctx);
}
```

## Export

Unchanged. `bindExport()` in `js/ui.js` generates the same inline code as today. The export template uses Canvas 2D exclusively — no WebGPU.

## Build System

`build.js` currently concatenates JS modules with `new Function()` wrappers and inlines into `index.html`.

**Change:** `.wgsl` files are read as text and inlined as string literals in `js/gpu/compute.js` and `js/gpu/render.js`.

Alternatively: WGSL can be embedded directly as template literals in JS files (simpler, avoids build changes). Use WGSL as tagged template literals or plain strings.

**Decision:** Embed WGSL as JS template strings inside `compute.js` and `render.js`. This avoids changing `build.js` and keeps the build simple. If WGSL files grow large, extract to external files in a future iteration.

## Implementation Order

1. **Extract Canvas2DRenderer** — move particle.js classes into `js/renderers/canvas2d.js`, wire into Effect
2. **Add renderer dispatch** — Effect detects WebGPU support, creates appropriate renderer
3. **WebGPU device setup** — `WebGPURenderer` class skeleton, swap chain, resize
4. **Flow field texture** — CPU build + upload to GPU texture
5. **Compute pipeline** — WGSL simulation shader, dispatch per frame
6. **Render pipeline** — trail mode WGSL, shape mode WGSL
7. **Fade pass** — accumulation buffer
8. **Debug overlay** — GPU debug rendering
9. **Polish** — parameter sync, edge cases, performance tuning
10. **Build** — verify export still works

## Files

| File | Action |
|---|---|
| `js/renderers/canvas2d.js` | NEW — extracted Canvas 2D particle renderer |
| `js/renderers/webgpu.js` | NEW — WebGPURenderer class |
| `js/gpu/compute.js` | NEW — compute pipeline setup, WGSL inline |
| `js/gpu/render.js` | NEW — render pipeline setup, WGSL inline |
| `js/particle.js` | DELETE — moved to renderers/canvas2d.js |
| `js/effect.js` | MODIFY — delegate render to renderer |
| `js/main.js` | MODIFY — pass isWebGPU flag to Effect |
| `js/ui.js` | no changes |
| `js/state.js` | no changes |
| `build.js` | no changes (WGSL inline in JS) |
| `index.html` | rebuild |

## Open Questions / Future Work

- Compute shader random: WGSL doesn't have `Math.random()`. Use hash-based PRNG (e.g. LCG) for GPU-side particle reseed. See `pcg_hash` or similar from the WGSL PRNG literature.
- Trail length cap (64): revisit if users need longer trails.
- Shape mode instancing: may need a compute shader to gather visible history points (skip faded-out ones) to reduce draw calls.
- OffscreenCanvas + Web Worker for Canvas2D fallback (separate from GPU work).
