# GPU Acceleration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add WebGPU-based GPU acceleration to FlowFieldStudio with transparent fallback to Canvas 2D.

**Architecture:** Dual renderer pattern — `WebGPURenderer` (compute + render shaders) and `Canvas2DRenderer` (existing Canvas 2D code extracted). Effect delegates `render()`, `resize()`, and particle lifecycle to the active renderer. Export HTML uses Canvas 2D unchanged.

**Tech Stack:** WGSL (WebGPU Shading Language), WebGPU API (`navigator.gpu`), no libraries.

## Global Constraints

- Only ever use WebGPU API — no WebGL, no Three.js, no external GPU libs
- WGSL must be inlined as JS template strings (no separate `.wgsl` files, no build changes for shaders)
- Canvas 2D renderer must remain a drop-in replacement — same visual output
- Export HTML (standalone) must use Canvas 2D exclusively
- Zero new dependencies
- The build.js `MODULE_ORDER` array must list all modules in dependency order

---

### Task 1: Extract Canvas2DRenderer

**Files:**
- Create: `js/renderers/canvas2d.js`
- Modify: `js/effect.js`, `js/main.js`, `build.js`
- Delete: `js/particle.js`

**Interfaces:**
- Consumes: `S` (state), `Effect` instance (for cellSize, columns, rows, flowField, bgFlowField, textMask, textCells)
- Produces: class `Canvas2DRenderer` with `{ init(), render(ctx), resize(w,h), destroy(), textParticles[], bgParticles[], spawnText(), spawnBg(), respawnText(), respawnBg() }`

- [ ] **Create `js/renderers/canvas2d.js`**

Copy `TextParticle`, `BgParticle`, `drawShape` verbatim from the current `js/particle.js`. Add the `Canvas2DRenderer` wrapper class:

```js
import { S } from '../state.js';

function drawShape(ctx, type, x, y, size) {
  const s = size * 2;
  ctx.save();
  ctx.translate(x, y);
  switch (type) {
    case 'circle':
      ctx.beginPath();
      ctx.arc(0, 0, s / 2, 0, Math.PI * 2);
      ctx.fill();
      break;
    case 'triangle':
      ctx.beginPath();
      ctx.moveTo(0, -s / 2);
      ctx.lineTo(-s / 2, s / 2);
      ctx.lineTo(s / 2, s / 2);
      ctx.closePath();
      ctx.fill();
      break;
    case 'diamond':
      ctx.beginPath();
      ctx.moveTo(0, -s / 2);
      ctx.lineTo(s / 2, 0);
      ctx.lineTo(0, s / 2);
      ctx.lineTo(-s / 2, 0);
      ctx.closePath();
      ctx.fill();
      break;
    case 'star': {
      ctx.beginPath();
      for (let i = 0; i < 10; i++) {
        const a = (i * Math.PI) / 5 - Math.PI / 2;
        const r = i % 2 === 0 ? s / 2 : s / 4;
        i === 0
          ? ctx.moveTo(Math.cos(a) * r, Math.sin(a) * r)
          : ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
      }
      ctx.closePath();
      ctx.fill();
      break;
    }
    case 'square':
      ctx.fillRect(-s / 2, -s / 2, s, s);
      break;
  }
  ctx.restore();
}

class TextParticle {
  constructor(effect) {
    this.effect = effect;
    this._init();
  }
  _init() {
    const ef = this.effect;
    const s  = S.txt;
    const cell = ef.textCells[Math.floor(Math.random() * ef.textCells.length)];
    this.x = cell.x + Math.random() * ef.cellSize;
    this.y = cell.y + Math.random() * ef.cellSize;
    this.speedMod = s.speedMin + Math.random() * (s.speedMax - s.speedMin);
    this.maxLen   = Math.floor(s.trailMin + Math.random() * (s.trailMax - s.trailMin));
    this.history  = [{x: this.x, y: this.y}];
    this.timer    = this.maxLen * 2;
    if (s.colorMode === 'image')      this.color = cell.color;
    else if (s.colorMode === 'white') this.color = 'rgba(255,255,255,' + s.opacity + ')';
    else                              this.color = s.solidColor;
  }
  draw(ctx) {
    if (this.history.length < 2) return;
    ctx.save();
    ctx.globalCompositeOperation = S.blendMode;
    const shape = S.txt.shape;
    if (shape === 'trail') {
      ctx.globalAlpha = S.txt.opacity;
      ctx.lineWidth = S.txt.lineWidth;
      ctx.strokeStyle = this.color;
      ctx.beginPath();
      ctx.moveTo(this.history[0].x, this.history[0].y);
      for (let i = 1; i < this.history.length; i++)
        ctx.lineTo(this.history[i].x, this.history[i].y);
      ctx.stroke();
    } else {
      const len = this.history.length;
      ctx.fillStyle = this.color;
      for (let i = 0; i < len; i++) {
        const t = i / len;
        const alpha = S.txt.opacity * (0.3 + 0.7 * t);
        const size = S.txt.shapeSize * (0.2 + 0.8 * t);
        ctx.globalAlpha = alpha;
        drawShape(ctx, shape, this.history[i].x, this.history[i].y, size);
      }
    }
    ctx.restore();
  }
  update() {
    this.timer--;
    const ef = this.effect;
    if (this.timer >= 1) {
      const col   = Math.max(0, Math.min(Math.floor(this.x / ef.cellSize), ef.columns - 1));
      const row   = Math.max(0, Math.min(Math.floor(this.y / ef.cellSize), ef.rows - 1));
      const field = ef.flowField[row * ef.columns + col];
      const angle = field ? field.angle : 0;
      const boost = (field && field.inText) ? S.txt.boost : 1;
      this.x += Math.cos(angle) * this.speedMod * boost;
      this.y += Math.sin(angle) * this.speedMod * boost;
      this.history.push({x: this.x, y: this.y});
      if (this.history.length > this.maxLen) this.history.shift();
    } else if (this.history.length > 1) {
      this.history.shift();
    } else {
      this._init();
    }
  }
}

class BgParticle {
  constructor(effect) {
    this.effect = effect;
    this._init();
  }
  _init() {
    const ef = this.effect;
    const s  = S.bg;
    let tries = 0;
    do {
      this.x = Math.random() * ef.width;
      this.y = Math.random() * ef.height;
      tries++;
    } while (s.avoidText && ef.isTextZone(this.x, this.y) && tries < 20);
    this.speedMod = s.speedMin + Math.random() * (s.speedMax - s.speedMin);
    this.maxLen   = Math.floor(s.trailMin + Math.random() * (s.trailMax - s.trailMin));
    this.history  = [{x: this.x, y: this.y}];
    this.timer    = this.maxLen * 2;
    this.color    = s.color;
  }
  draw(ctx) {
    if (this.history.length < 2) return;
    ctx.save();
    ctx.globalCompositeOperation = S.blendMode;
    const shape = S.bg.shape;
    if (shape === 'trail') {
      ctx.globalAlpha = S.bg.opacity;
      ctx.lineWidth = S.bg.lineWidth;
      ctx.strokeStyle = this.color;
      ctx.beginPath();
      ctx.moveTo(this.history[0].x, this.history[0].y);
      for (let i = 1; i < this.history.length; i++)
        ctx.lineTo(this.history[i].x, this.history[i].y);
      ctx.stroke();
    } else {
      const len = this.history.length;
      ctx.fillStyle = this.color;
      for (let i = 0; i < len; i++) {
        const t = i / len;
        const alpha = S.bg.opacity * (0.3 + 0.7 * t);
        const size = S.bg.shapeSize * (0.2 + 0.8 * t);
        ctx.globalAlpha = alpha;
        drawShape(ctx, shape, this.history[i].x, this.history[i].y, size);
      }
    }
    ctx.restore();
  }
  update() {
    this.timer--;
    const ef = this.effect;
    const s  = S.bg;
    if (this.timer >= 1) {
      const col   = Math.max(0, Math.min(Math.floor(this.x / ef.cellSize), ef.columns - 1));
      const row   = Math.max(0, Math.min(Math.floor(this.y / ef.cellSize), ef.rows - 1));
      const field = ef.bgFlowField[row * ef.columns + col];
      const angle = field ? field.angle : 0;
      const inText = ef.isTextZone(this.x, this.y);
      const speed  = (s.avoidText && inText) ? this.speedMod * 0.1 : this.speedMod;
      this.x += Math.cos(angle) * speed;
      this.y += Math.sin(angle) * speed;
      this.history.push({x: this.x, y: this.y});
      if (this.history.length > this.maxLen) this.history.shift();
      if (this.x < 0 || this.x > ef.width || this.y < 0 || this.y > ef.height) {
        this._init();
      }
    } else if (this.history.length > 1) {
      this.history.shift();
    } else {
      this._init();
    }
  }
}

export class Canvas2DRenderer {
  constructor(effect) {
    this.effect = effect;
    this.textParticles = [];
    this.bgParticles = [];
  }

  init() {}

  spawnText() {
    if (!this.effect.textCells.length) { this.textParticles = []; return; }
    this.textParticles = Array.from(
      { length: S.txt.count },
      () => new TextParticle(this.effect)
    );
  }

  spawnBg() {
    if (!S.bg.enabled) { this.bgParticles = []; return; }
    this.bgParticles = Array.from(
      { length: S.bg.count },
      () => new BgParticle(this.effect)
    );
  }

  respawnText() { this.spawnText(); }
  respawnBg()   { this.spawnBg(); }

  render(ctx) {
    this.bgParticles.forEach(p => { p.draw(ctx); p.update(); });
    this.textParticles.forEach(p => { p.draw(ctx); p.update(); });
  }

  resize(w, h) {}

  destroy() {
    this.textParticles = [];
    this.bgParticles = [];
  }
}
```

- [ ] **Modify `js/effect.js`**

Replace particle management with renderer delegation:

```js
import { S, bus } from './state.js';
import { noise } from './perlin.js';
import { Canvas2DRenderer } from './renderers/canvas2d.js';

export class Effect {
  constructor(canvas, ctx) {
    this.canvas     = canvas;
    this.context    = ctx;
    this.width      = canvas.width;
    this.height     = canvas.height;
    this.cellSize   = S.cellSize;
    this.flowField  = [];
    this.bgFlowField= [];
    this.textCells  = [];
    this.textMask   = null;
    this._srcImg = null;
    this.rows = 0;
    this.columns = 0;
    this.renderer = null;

    window.addEventListener('resize', () => {
      this.resize(window.innerWidth, window.innerHeight);
    });
    window.addEventListener('keydown', e => {
      if (e.key === 'd' || e.key === 'D') {
        S.debug = !S.debug;
        const debugToggle = document.getElementById('debugToggle');
        if (debugToggle) debugToggle.classList.toggle('on', S.debug);
      }
    });
  }

  // ... buildSourceImage, buildTextImage unchanged ...

  async init() {
    this.cellSize = S.cellSize;
    this.rows     = Math.floor(this.height / this.cellSize);
    this.columns  = Math.floor(this.width  / this.cellSize);

    const img = await this.buildSourceImage();
    if (!img) return;
    this._srcImg = img;

    // ... flow field building unchanged ...

    // Create renderer
    const rendererClass = navigator.gpu
      ? (await import('./renderers/webgpu.js')).WebGPURenderer
      : Canvas2DRenderer;
    this.renderer = new rendererClass(this);
    try {
      await this.renderer.init();
    } catch (e) {
      console.warn('WebGPU init failed, falling back to Canvas2D:', e);
      this.renderer = new Canvas2DRenderer(this);
      this.renderer.init();
    }

    this.respawnText();
    this.respawnBg();
    bus.emit('effect:init', this);
  }

  respawnText() { if (this.renderer) this.renderer.respawnText(); }
  respawnBg()   { if (this.renderer) this.renderer.respawnBg(); }

  get textParticles() { return this.renderer ? this.renderer.textParticles : []; }
  get bgParticles()   { return this.renderer ? this.renderer.bgParticles : []; }

  // ... _dilate, isTextZone unchanged ...
  // ... refreshTextFlow, refreshBgFlow unchanged ...
  // ... drawDebug unchanged ...

  resize(w, h) {
    this.canvas.width  = w; this.canvas.height  = h;
    this.width = w; this.height = h;
    if (this.renderer) this.renderer.resize(w, h);
    this.init();
  }

  render(ctx) {
    if (S.debug) this.drawDebug(ctx);
    if (S.debugImg && this._srcImg) { /* unchanged */ }
    if (S.showBgImg && S.bgImage) { /* unchanged */ }

    if (this.renderer) {
      this.renderer.render(ctx);
    }
  }
}
```

Note: the `import()` is dynamic — the build.js transform must NOT remove it. Check that `build.js` handles `import(` differently from `import `. It does — the regexes match `import ` at line start, while `import(` has no space.

- [ ] **Update `js/main.js`**

Replace direct particle array access:

```js
// current: effect.textParticles.length
// new: effect.textParticles.length (still works via getter)
```

No changes needed — `effect.textParticles` continues to work through the getter.

- [ ] **Update `build.js`**

Change `MODULE_ORDER`:

```js
const MODULE_ORDER = [
  'event-bus.js',
  'state.js',
  'perlin.js',
  'renderers/canvas2d.js',
  'effect.js',
  'recorder.js',
  'ui.js',
  'main.js',
];
```

Remove `'particle.js'` from the list.

- [ ] **Delete `js/particle.js`**

- [ ] **Build and verify**

```bash
node build.js
```

Open `index.html` in a browser. Verify particles render exactly as before — trails, shapes, text, bg, all features intact.

- [ ] **Commit**

```bash
git add -A
git commit -m "refactor: extract Canvas2DRenderer, prepare for WebGPU path"
```

---

### Task 2: WebGPU Device Setup + Flow Field Texture

**Files:**
- Create: `js/renderers/webgpu.js`, `js/gpu/compute.js`, `js/gpu/render.js`
- Modify: `build.js` (add entries to MODULE_ORDER)

**Interfaces:**
- Consumes: `Effect` (cellSize, rows, columns, flowField, bgFlowField, textMask)
- Produces: class `WebGPURenderer` with `{ init(), render(ctx), resize(w,h), destroy(), textParticles, bgParticles, spawnText(), spawnBg(), ... }`

- [ ] **Create `js/gpu/compute.js`**

Placeholder exports for later:

```js
export const WGSL_COMPUTE = '';
// compute pipeline setup will go here
```

- [ ] **Create `js/gpu/render.js`**

Placeholder exports for later:

```js
export const WGSL_RENDER_VERT = '';
export const WGSL_RENDER_FRAG = '';
// render pipeline setup will go here
```

- [ ] **Create `js/renderers/webgpu.js`**

```js
import { S } from '../state.js';

const MAX_TRAIL = 64;

function padTo256(v) {
  return Math.ceil(v / 256) * 256;
}

export class WebGPURenderer {
  constructor(effect) {
    this.effect = effect;
    this.device = null;
    this.context = null;
    this.swapChain = null;
    this.format = 'bgra8unorm';
    this.textParticles = [];
    this.bgParticles = [];
  }

  async init() {
    if (!navigator.gpu) throw new Error('WebGPU not supported');

    const adapter = await navigator.gpu.requestAdapter();
    if (!adapter) throw new Error('No WebGPU adapter found');

    this.device = await adapter.requestDevice();
    this.context = this.effect.canvas.getContext('webgpu');
    this.context.configure({
      device: this.device,
      format: this.format,
      usage: GPUTextureUsage.RENDER_ATTACHMENT,
    });

    this._createFlowFieldTexture();
  }

  _createFlowFieldTexture() {
    const ef = this.effect;
    const data = new Uint8Array(ef.rows * ef.columns * 2);

    for (let row = 0; row < ef.rows; row++) {
      for (let col = 0; col < ef.columns; col++) {
        const idx = row * ef.columns + col;
        const angle = ef.flowField[idx] ? ef.flowField[idx].angle : 0;
        const inText = ef.flowField[idx] ? (ef.flowField[idx].inText ? 1 : 0) : 0;
        data[idx * 2]     = ((angle / (Math.PI * 2)) + 0.5) * 255;
        data[idx * 2 + 1] = inText * 255;
      }
    }

    const textureDesc = {
      size: [ef.columns, ef.rows, 1],
      format: 'rg8unorm',
      usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST,
    };
    this.txtFlowTexture = this.device.createTexture(textureDesc);
    this.device.queue.writeTexture(
      { texture: this.txtFlowTexture },
      data,
      { bytesPerRow: ef.columns * 2 },
      [ef.columns, ef.rows, 1]
    );

    // Bg flow field
    for (let row = 0; row < ef.rows; row++) {
      for (let col = 0; col < ef.columns; col++) {
        const idx = row * ef.columns + col;
        const angle = ef.bgFlowField[idx] ? ef.bgFlowField[idx].angle : 0;
        data[idx * 2]     = ((angle / (Math.PI * 2)) + 0.5) * 255;
        data[idx * 2 + 1] = 0;
      }
    }
    this.bgFlowTexture = this.device.createTexture(textureDesc);
    this.device.queue.writeTexture(
      { texture: this.bgFlowTexture },
      data,
      { bytesPerRow: ef.columns * 2 },
      [ef.columns, ef.rows, 1]
    );
  }

  _createTextMaskTexture() {
    const ef = this.effect;
    if (!ef.textMask) return;
    const data = new Uint8Array(ef.rows * ef.columns * 2);
    for (let i = 0; i < ef.rows * ef.columns; i++) {
      data[i * 2] = ef.textMask[i] * 255;
      data[i * 2 + 1] = 0;
    }
    const desc = {
      size: [ef.columns, ef.rows, 1],
      format: 'rg8unorm',
      usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST,
    };
    this.textMaskTexture = this.device.createTexture(desc);
    this.device.queue.writeTexture(
      { texture: this.textMaskTexture },
      data,
      { bytesPerRow: ef.columns * 2 },
      [ef.columns, ef.rows, 1]
    );
  }

  spawnText() {
    // Will allocate GPU buffers
  }

  spawnBg() {
    // Will allocate GPU buffers
  }

  respawnText() { this.spawnText(); }
  respawnBg()   { this.spawnBg(); }

  render(ctx) {
    // Early version — render nothing visible yet
  }

  resize(w, h) {
    if (!this.device) return;
    this.context.configure({
      device: this.device,
      format: this.format,
      width: w,
      height: h,
    });
  }

  destroy() {
    // Release GPU resources
    if (this.txtFlowTexture) this.txtFlowTexture.destroy();
    if (this.bgFlowTexture) this.bgFlowTexture.destroy();
    if (this.textMaskTexture) this.textMaskTexture.destroy();
  }
}
```

- [ ] **Update `build.js`**

```js
const MODULE_ORDER = [
  'event-bus.js',
  'state.js',
  'perlin.js',
  'renderers/canvas2d.js',
  'gpu/render.js',
  'gpu/compute.js',
  'renderers/webgpu.js',
  'effect.js',
  'recorder.js',
  'ui.js',
  'main.js',
];
```

- [ ] **Build and verify**

```bash
node build.js
```

Open with a WebGPU browser. Dev console should show no errors. With a non-WebGPU browser, fallback to Canvas2D still works.

- [ ] **Commit**

```bash
git add -A
git commit -m "feat(gpu): WebGPU device setup and flow field texture upload"
```

---

### Task 3: GPU Compute Pipeline — Particle Simulation

**Files:**
- Modify: `js/gpu/compute.js` (full WGSL + pipeline setup)
- Modify: `js/renderers/webgpu.js` (spawn buffers, dispatch compute)

- [ ] **Write WGSL compute shader in `js/gpu/compute.js`**

```js
export const WGSL_COMPUTE = `
struct Particle {
  pos    : vec2<f32>,
  prev   : vec2<f32>,
  dir    : vec2<f32>,
  params : vec4<u32>,
  color  : vec4<f32>,
};

struct Cell {
  pos : vec2<f32>,
};

struct Uniforms {
  cellSize      : f32,
  txtNoiseScale : f32,
  txtAngleMult  : f32,
  txtBoost      : f32,
  txtSpeedMin   : f32,
  txtSpeedMax   : f32,
  bgNoiseScale  : f32,
  bgAngleMult   : f32,
  bgSpeedMin    : f32,
  bgSpeedMax    : f32,
  txtShapeSize  : f32,
  bgShapeSize   : f32,
  time          : f32,
  canvasWidth   : f32,
  canvasHeight  : f32,
  maxTrail      : u32,
  textCellCount : u32,
  numParticles  : u32,
  _pad1         : u32,
};

@group(0) @binding(0) var<uniform> uni: Uniforms;
@group(0) @binding(1) var<storage, read_write> particles: array<Particle>;
@group(0) @binding(2) var<storage, read_write> trail: array<vec2<f32>>;
@group(0) @binding(3) var<storage, read> cells: array<Cell>;
@group(0) @binding(4) var txtFlow: texture_2d<f32>;
@group(0) @binding(5) var bgFlow: texture_2d<f32>;
@group(0) @binding(6) var textMask: texture_2d<f32>;

// Simple hash-based PRNG for WGSL (PCG-style)
fn pcg(p: u32) -> u32 {
  var state = p * 747796405u + 2891336453u;
  var word = ((state >> ((state >> 28u) + 4u)) ^ state) * 277803737u;
  return (word >> 22u) ^ word;
}

fn randFloat(s: ptr<function, u32>) -> f32 {
  let v = pcg(*s);
  *s = v;
  return f32(v & 65535u) / 65535.0;
}

fn sampleFlow(tex: texture_2d<f32>, pos: vec2<f32>) -> vec2<f32> {
  let dim = textureDimensions(tex);
  let col = u32(clamp(pos.x / uni.cellSize, 0.0, f32(dim.x - 1)));
  let row = u32(clamp(pos.y / uni.cellSize, 0.0, f32(dim.y - 1)));
  return textureLoad(tex, vec2<i32>(i32(col), i32(row)), 0).rg;
}

fn reseed(p: ptr<function, Particle>, seed: ptr<function, u32>, isBg: u32) {
  // Pick random text cell
  if (uni.textCellCount > 0u) {
    let ci = u32(randFloat(seed) * f32(uni.textCellCount));
    let cellPos = cells[ci].pos;
    (*p).pos = cellPos + vec2(randFloat(seed), randFloat(seed)) * uni.cellSize;
  } else {
    (*p).pos = vec2(randFloat(seed) * uni.canvasWidth, randFloat(seed) * uni.canvasHeight);
  }
  (*p).prev = (*p).pos;
  // Assign random dir (will be overridden by flow field)
  let a = randFloat(seed) * 6.2832;
  let spd = select(uni.txtSpeedMin + randFloat(seed) * (uni.txtSpeedMax - uni.txtSpeedMin),
                   uni.bgSpeedMin + randFloat(seed) * (uni.bgSpeedMax - uni.bgSpeedMin),
                   isBg > 0u);
  (*p).dir = vec2(cos(a), sin(a));
  (*p).params = vec4(0u, 10u, 0u, isBg); // age=0, maxLen=10, cursor=0
}

@compute @workgroup_size(256)
fn main(@builtin(global_invocation_id) id: vec3<u32>) {
  let idx = id.x;
  if (idx >= uni.numParticles) { return; }

  var seed = idx * 1234567u + u32(uni.time * 1000.0);
  let p = &particles[idx];

  var age = (*p).params[0];
  let maxLen = (*p).params[1];
  var cursor = (*p).params[2];
  let isBg = (*p).params[3];

  // Lifecycle: decrement age each frame (mimics timer--)
  if (age > 0u) {
    age = age - 1u;
  }

  if (age == 0u) {
    // Respawn
    reseed(p, &seed, isBg);
    return;
  }

  // Active phase: age between 1 and maxLen
  let flowTex = select(txtFlow, bgFlow, isBg);
  let flow = sampleFlow(flowTex, (*p).pos);
  let angle = (flow.r * 2.0 - 1.0) * 3.14159 * select(uni.txtAngleMult, uni.bgAngleMult, isBg > 0u);
  let inText = flow.g > 0.5;
  let boost = select(1.0, uni.txtBoost, inText && isBg == 0u);

  // Save previous position
  (*p).prev = (*p).pos;

  // Update position
  let dir = vec2(cos(angle), sin(angle));
  (*p).pos = (*p).pos + dir * boost;

  // Write to trail ring buffer
  trail[idx * uni.maxTrail + cursor] = (*p).prev;
  cursor = (cursor + 1u) % uni.maxTrail;
  (*p).params[2] = cursor;

  // Bg boundary check
  if (isBg > 0u) {
    if ((*p).pos.x < 0.0 || (*p).pos.x > uni.canvasWidth || (*p).pos.y < 0.0 || (*p).pos.y > uni.canvasHeight) {
      age = 0u; // trigger reseed next frame
    }
  }
}
`;
```

(The exact WGSL will be refined during implementation. This provides the structure.)

- [ ] **Create compute pipeline setup function in `js/gpu/compute.js`**

```js
export function createComputePipeline(device, textureFormat) {
  const shader = device.createShaderModule({
    code: WGSL_COMPUTE,
  });

  const pipeline = device.createComputePipeline({
    layout: 'auto',
    compute: {
      module: shader,
      entryPoint: 'main',
    },
  });

  return pipeline;
}

export function createParticleBuffers(device, effect, count, isBg, maxTrail) {
  const ef = effect;
  const particleSize = 64;
  const buf = new ArrayBuffer(count * particleSize);
  const view = new DataView(buf);
  const floatView = new Float32Array(buf);
  const uintView = new Uint32Array(buf);

  for (let i = 0; i < count; i++) {
    const stride = particleSize / 4; // float32 units
    const base = i * stride;
    // pos (vec2), prev (vec2), dir (vec2)
    const x = Math.random() * ef.width;
    const y = Math.random() * ef.height;
    floatView[base + 0] = x;
    floatView[base + 1] = y;
    floatView[base + 2] = x; // prev = same as pos
    floatView[base + 3] = y;
    floatView[base + 4] = 0; // dir.x
    floatView[base + 5] = 0; // dir.y
    // params (vec4<u32>): age, maxLen, cursor, isBg
    const trailLen = Math.floor(
      (isBg ? S.bg.trailMin : S.txt.trailMin) +
      Math.random() * ((isBg ? S.bg.trailMax : S.txt.trailMax) - (isBg ? S.bg.trailMin : S.txt.trailMin))
    );
    uintView[base + 6] = trailLen * 2; // age = maxLen * 2
    uintView[base + 7] = trailLen;     // maxLen
    uintView[base + 8] = 0;            // cursor
    uintView[base + 9] = isBg ? 1 : 0; // isBg
    // color (vec4<f32>)
    floatView[base + 10] = 1; // r
    floatView[base + 11] = 1; // g
    floatView[base + 12] = 1; // b
    floatView[base + 13] = 1; // a
  }

  const buffer = device.createBuffer({
    size: count * particleSize,
    usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
  });
  device.queue.writeBuffer(buffer, 0, buf);

  const trailSize = count * maxTrail * 8;
  const trailBuffer = device.createBuffer({
    size: trailSize,
    usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST | GPUBufferUsage.COPY_SRC,
  });

  return { particles: buffer, trail: trailBuffer };
}
```

- [ ] **Wire compute into `WebGPURenderer`**

In `js/renderers/webgpu.js`:

```js
import { createComputePipeline, createParticleBuffers } from '../gpu/compute.js';

export class WebGPURenderer {
  async init() {
    // ... existing device setup ...
    this.computePipeline = createComputePipeline(this.device, this.format);
    this.uniformBuffer = this.device.createBuffer({
      size: 80, // padded struct
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });
    // ... rest of init ...
  }

  spawnText() {
    const count = S.txt.count;
    const { particles, trail } = createParticleBuffers(this.device, this.effect, count, false);
    this.txtParticleBuffer = particles;
    this.txtTrailBuffer = trail;
    this.txtParticleCount = count;
  }

  spawnBg() {
    // similar pattern
  }

  render(ctx) {
    // ... existing ...
    this._dispatchCompute();
    // ... render pass ...
  }

  _dispatchCompute() {
    if (!this.txtParticleCount && !this.bgParticleCount) return;

    // Update uniforms
    // ...

    const encoder = this.device.createCommandEncoder();
    const pass = encoder.beginComputePass();
    pass.setPipeline(this.computePipeline);
    pass.setBindGroup(/* ... */);
    pass.dispatchWorkgroups(Math.ceil(numParticles / 256));
    pass.end();
    this.device.queue.submit([encoder.finish()]);
  }
}
```

- [ ] **Build and verify**

No visible output yet (no render pass). Verify no console errors.

- [ ] **Commit**

```bash
git add -A
git commit -m "feat(gpu): compute pipeline for particle simulation"
```

---

### Task 4: GPU Render Pipeline — Trails + Fade Pass

**Files:**
- Modify: `js/gpu/render.js` (WGSL vertex + fragment shaders for trails, pipeline setup)
- Modify: `js/renderers/webgpu.js` (render pass dispatch)

- [ ] **Write WGSL vertex shader for trails in `js/gpu/render.js`**

```js
export const WGSL_TRAIL_VERT = `
struct Uniforms {
  cellSize       : f32,
  txtOpacity     : f32,
  txtLineWidth   : f32,
  bgOpacity      : f32,
  bgLineWidth    : f32,
  canvasWidth    : f32,
  canvasHeight   : f32,
  txtShapeSize   : f32,
  bgShapeSize    : f32,
  maxTrail       : u32,
  shapeMode      : u32, // 0=trail, 1=circle, 2=triangle, ...
  _pad1          : u32,
  _pad2          : u32,
};

struct Particle {
  pos    : vec2<f32>,
  prev   : vec2<f32>,
  dir    : vec2<f32>,
  params : vec4<u32>,
  color  : vec4<f32>,
};

struct VertexOutput {
  @builtin(position) position: vec4<f32>,
  @location(0) color: vec4<f32>,
};

@group(0) @binding(0) var<uniform> uni: Uniforms;
@group(0) @binding(1) var<storage, read> particles: array<Particle>;
@group(0) @binding(2) var<storage, read> trail: array<vec2<f32>>;

struct TrailSegment {
  @builtin(vertex_index) vertIdx: u32,
  @builtin(instance_index) instIdx: u32,
};

@vertex
fn trailVertex(input: TrailSegment) -> VertexOutput {
  let particleIdx = input.instIdx / (uni.maxTrail - 1u);
  let segmentIdx = input.instIdx % (uni.maxTrail - 1u);
  let p = particles[particleIdx];
  let cursor = p.params.z;
  let maxLen = max(p.params.y, 1u);
  let isBg = p.params.w;

  let slotA = (cursor + segmentIdx) % maxLen;
  let slotB = (cursor + segmentIdx + 1u) % maxLen;
  let a = trail[particleIdx * uni.maxTrail + slotA];
  let b = trail[particleIdx * uni.maxTrail + slotB];

  let dir = normalize(b - a);
  let perp = vec2(-dir.y, dir.x);
  let side = f32(input.vertIdx % 2u) * 2.0 - 1.0;

  let width = select(uni.txtLineWidth, uni.bgLineWidth, isBg > 0u);
  let pos = (input.vertIdx < 2u) ? a : b;
  let vertexPos = pos + perp * side * width * 0.5;

  let ndcX = (vertexPos.x / uni.canvasWidth) * 2.0 - 1.0;
  let ndcY = -((vertexPos.y / uni.canvasHeight) * 2.0 - 1.0);

  let t = f32(segmentIdx) / f32(maxLen);
  let alpha = 1.0 - t;

  var output: VertexOutput;
  output.position = vec4(ndcX, ndcY, 0.0, 1.0);
  output.color = vec4(p.color.rgb, p.color.a * alpha);
  return output;
}
`;

export const WGSL_TRAIL_FRAG = `
@fragment
fn trailFragment(input: VertexOutput) -> @location(0) vec4<f32> {
  return input.color;
}
`;
```

- [ ] **Write fade pass WGSL**

```js
export const WGSL_FADE_VERT = `
struct VertexOutput {
  @builtin(position) pos: vec4<f32>,
  @location(0) uv: vec2<f32>,
};
@vertex
fn main(@builtin(vertex_index) vi: u32) -> VertexOutput {
  const pos = array(
    vec2(-1.0, -1.0), vec2( 3.0, -1.0), vec2(-1.0,  3.0),
  );
  const uv = array(
    vec2( 0.0,  0.0), vec2( 2.0,  0.0), vec2( 0.0,  2.0),
  );
  var out: VertexOutput;
  out.pos = vec4(pos[vi], 0.0, 1.0);
  out.uv = uv[vi];
  return out;
}
`;

export const WGSL_FADE_FRAG = `
struct Uniforms {
  fadeAlpha: f32,
};
@group(0) @binding(0) var<uniform> uni: Uniforms;
@fragment
fn main(@location(0) uv: vec2<f32>) -> @location(0) vec4<f32> {
  return vec4(0.0, 0.0, 0.0, uni.fadeAlpha);
}
`;
```

- [ ] **Wire render pipeline in `WebGPURenderer`**

In `js/renderers/webgpu.js`, add render pass after compute:

```js
render(ctx) {
  if (!this.device) {
    // Fallback — should not reach here
    return;
  }

  this._updateUniforms();
  this._dispatchCompute();

  const encoder = this.device.createCommandEncoder();

  // Fade pass
  const fadePass = encoder.beginRenderPass({
    colorAttachments: [{
      view: this.context.getCurrentTexture().createView(),
      loadOp: 'load',
      storeOp: 'store',
    }],
  });
  fadePass.setPipeline(this.fadePipeline);
  fadePass.setBindGroup(0, this.fadeBindGroup);
  fadePass.draw(3);
  fadePass.end();

  // Particles pass (trail mode)
  if (this.txtParticleCount > 0) {
    const pass = encoder.beginRenderPass({
      colorAttachments: [{
        view: this.context.getCurrentTexture().createView(),
        loadOp: 'load',
        storeOp: 'store',
      }],
    });
    // Set pipeline, bind groups, draw instanced
    pass.setPipeline(this.trailPipeline);
    pass.setBindGroup(0, this.trailBindGroup);
    const numInstances = this.txtParticleCount * (MAX_TRAIL - 1);
    const numVerts = 6; // 2 tris per segment
    pass.draw(numVerts, numInstances);
    pass.end();
  }

  this.device.queue.submit([encoder.finish()]);
}
```

- [ ] **Build and test**

Particles should appear as trails on screen. They won't move yet (compute shader needs full implementation) but their initial positions should render.

- [ ] **Commit**

```bash
git add -A
git commit -m "feat(gpu): trail render pipeline and fade pass"
```

---

### Task 5: Full Integration, Shapes, Debug, Polish

**Files:**
- Modify: `js/gpu/render.js` (shape mode WGSL)
- Modify: `js/gpu/compute.js` (complete simulation logic)
- Modify: `js/renderers/webgpu.js` (all modes, debug, parameter sync)

- [ ] **Complete compute shader simulation**

Fill in the actual simulation logic:
- Flow field lookup and angle computation
- Position update
- Ring buffer trail write
- Age lifecycle
- Respawn (read from textCells buffer)
- Bg particle boundary check + avoidText

- [ ] **Add shape mode WGSL render**

Vertex shader that takes a base shape geometry and instantiates it at each trail position with varying size/alpha per history point.

- [ ] **Add debug overlay**

WGSL vertex + fragment shaders for grid lines and text mask cells.

- [ ] **Parameter synchronization**

Add `bus.on('state:change', ...)` in `WebGPURenderer` to update:
- Uniform buffer when particle params change
- Flow field textures when noise params change
- Re-spawn when count changes

- [ ] **Shape/texture bind groups for bg + text**

Two separate bind groups sharing the same pipeline, with different uniforms (txt opacity/lineWidth vs bg).

- [ ] **Edge cases**

- 0 particles (empty spawn → skip render)
- Canvas resize → reconfigure swap chain + rebuild flow field texture
- WebGPU device lost → recreate

- [ ] **Build and verify full functionality**

Test in browser:
- All shapes render correctly
- Trails look identical to Canvas 2D version
- Fade pass creates motion blur effect
- Resize works
- Parameter sliders update in real-time
- Debug overlay works
- Export HTML works (Canvas 2D)

- [ ] **Commit**

```bash
git add -A
git commit -m "feat(gpu): full integration - shapes, debug, parameter sync"
```

---

### Verification Checklist (End-to-End)

- [ ] Canvas 2D path works identically to before (test in any browser)
- [ ] WebGPU path initializes without errors in Chrome/Edge
- [ ] Text particles render as trails and shapes
- [ ] Bg particles render as trails and shapes
- [ ] Fade pass creates smooth motion trails
- [ ] Color modes (image, white, solid) work
- [ ] Blend modes (normal, screen, overlay, dodge) work
- [ ] Debug overlay (grid + mask cells) renders
- [ ] Resize re-initializes correctly in both modes
- [ ] Parameter changes (sliders) update in real-time
- [ ] Part count changes trigger correct re-spawn
- [ ] Export HTML works and produces correct Canvas 2D output
- [ ] No console errors in either mode

---

### Rollback Plan

If WebGPU introduces regressions in the Canvas 2D path:
1. `git revert <commit>` the WebGPU commits
2. Keep the `Canvas2DRenderer` extraction (Task 1) — it's a pure refactor
3. The app will be in the same state as before, with slightly cleaner architecture

If specific WebGPU features don't work:
- Fallback to Canvas 2D is automatic (`navigator.gpu` check)
- Shape-specific bugs can be disabled individually by falling back to trail mode for that particle type
