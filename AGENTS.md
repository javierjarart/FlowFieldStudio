# AGENTS.md

## Build & Dev

- **Build**: `node build.js` — concatenates all JS modules into an inline IIFE inside `index.html`. Mutates `index.html` in place.
- **Dev** (ES modules): `python3 -m http.server 8080` then open `http://localhost:8080`
- `index.html` is both source and output. After build it has an inline `<script>(function(){...})();</script>`. Before build it has `<script type="module" src="js/main.js">`. The build script auto-detects which variant is present and swaps.
- No `package.json`, no dependencies, vanilla JS.

## Architecture

```
js/
  event-bus.js    → pub/sub (EventBus class)
  state.js        → reactive state S (Proxy), emits bus events on change
  perlin.js       → Perlin noise 2D (export noise function)
  audio.js        → AudioManager: mic capture, FFT, beat detection, band→param mapping
  lfo.js          → LFO + LFOManager: waveform oscillators that modulate S params
  effect.js       → orchestrator: builds flow field, creates renderer, resize, debug
  main.js         → entry point: canvas, animation loop, pointer events, fullscreen
  ui.js           → panel UI bindings (export init function, wireAudio/wireLFO/wirePost)
  recorder.js     → video recording state machine (RecorderManager)
  postprocess.js  → PostProcessor: bloom, CA, vignette, film grain (Canvas2D fallback)
  renderers/
    canvas2d.js   → Canvas2D renderer with TextParticle and BgParticle classes
    webgpu.js     → WebGPU renderer (uses GPU compute + render pipelines)
  gpu/
    compute.js    → WGSL compute shader + particle buffer creation
    render.js     → WGSL render shaders (trail, shape, fade, debug) + pipeline factories
```

- **Module ordering matters**: `build.js` has a `MODULE_ORDER` array. Add new files there in dependency order, otherwise the bundle breaks.
- **State**: All app state is in `S` (reactive Proxy, exported from `state.js`). The full state shape with defaults is defined in `state.js`. UI binds to `bus.on('state:change', ...)`.

## Imports must be single-line

The build strips `import`/`export` statements line by line. Multi-line imports (e.g. destructuring across lines) break the bundle. Keep every `import { ... } from '...'` on one line.

## WebGPU fallback

WebGPU is auto-detected via `navigator.gpu`. In dev mode it dynamically imports `./renderers/webgpu.js`. Falls back to Canvas2D on failure. In the bundled IIFE, the dynamic import won't work, but the code also checks `typeof WebGPURenderer !== 'undefined'` as a bundle-specific fallback.

## Testing

No test framework, no tests. `test-results/` is gitignored.
