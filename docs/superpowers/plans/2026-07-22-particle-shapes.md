# Particle Shapes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add multiple particle shape options (circle, triangle, diamond, star, square) beyond the current line-trail rendering.

**Architecture:** Each shape is drawn at every trail point with progressive size decay from head to tail, creating a ribbon/comet effect. A shared `drawShape()` helper renders the chosen shape type at a given position/size. The shape setting lives in state under `txt.shape` and `bg.shape`, defaulting to `'trail'` (preserving current behavior).

**Tech Stack:** Vanilla JS, Canvas 2D API

## Global Constraints

- No new dependencies
- Default shape must be `'trail'` to preserve backward compatibility
- Both text particles and background particles must support same shape types
- Standalone HTML export must include shapes
- File structure: `js/state.js`, `js/particle.js`, `js/ui.js`, `index.html`

---

### Task 1: State — Add shape types to state

**Files:**
- Modify: `js/state.js`

**Interfaces:**
- Consumes: existing `S.txt` and `S.bg` objects
- Produces: `S.txt.shape: string` (default `'trail'`), `S.txt.shapeSize: number` (default `1.0`), `S.bg.shape: string` (default `'trail'`), `S.bg.shapeSize: number` (default `0.8`)

- [ ] **Step 1: Add shape fields to `txt` in state**

In `js/state.js`, add inside `txt` block (after `boost: 3,`):
```js
    shape:       'trail',
    shapeSize:   1.0,
```

- [ ] **Step 2: Add shape fields to `bg` in state**

In `js/state.js`, add inside `bg` block (after `angleMult: 2,`):
```js
    shape:       'trail',
    shapeSize:   0.8,
```

- [ ] **Step 3: Verify build**

Run: `node build.js`
Expected: no errors

---

### Task 2: Particle drawing — Implement shape rendering

**Files:**
- Modify: `js/particle.js` (add `drawShape()` helper, update `TextParticle.draw()` and `BgParticle.draw()`)

**Interfaces:**
- Consumes: `S.txt.shape`, `S.txt.shapeSize`, `S.bg.shape`, `S.bg.shapeSize`, particle `this.history`
- Produces: visual canvas output for each shape type

- [ ] **Step 1: Add `drawShape()` helper function**

Add at the top of `js/particle.js` (after imports):

```js
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
```

- [ ] **Step 2: Modify `TextParticle.draw()`**

Replace the full method body:

```js
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
```

- [ ] **Step 3: Modify `BgParticle.draw()`**

Replace the full method body:

```js
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
```

- [ ] **Step 4: Verify build**

Run: `node build.js`
Expected: no errors

---

### Task 3: UI — Add shape selector controls

**Files:**
- Modify: `index.html` (add shape controls HTML in both tab-panes)
- Modify: `js/ui.js` (bind shape controls, call binders in init)

- [ ] **Step 1: Add shape controls HTML to Particles tab (`#tab-txt-p`)**

Insert after the `txtLine` row's div (the line-width slider group), before the closing `</div>` of its `group`:

```html
        <div class="group">
          <div class="group-title">Forma de partícula</div>
          <div class="row">
            <div class="btn-row">
              <button class="ctrl active" data-txt-shape="trail">Trazo</button>
              <button class="ctrl" data-txt-shape="circle">Círculo</button>
              <button class="ctrl" data-txt-shape="triangle">Triángulo</button>
              <button class="ctrl" data-txt-shape="diamond">Diamante</button>
            </div>
            <div class="btn-row" style="margin-top:4px;">
              <button class="ctrl" data-txt-shape="star">Estrella</button>
              <button class="ctrl" data-txt-shape="square">Cuadrado</button>
            </div>
          </div>
          <div class="row">
            <label>Tamaño forma <span id="txtShapeSizeVal" class="badge">1.0</span></label>
            <div class="row-val">
              <input type="range" id="txtShapeSize" min="0.3" max="4" step="0.1" value="1.0">
            </div>
          </div>
        </div>
```

- [ ] **Step 2: Add shape controls HTML to Background tab (`#tab-bg-p`)**

Insert after the `bgLine` row's div, before the closing `</div>` of its `group`:

```html
        <div class="group">
          <div class="group-title">Forma de partícula</div>
          <div class="row">
            <div class="btn-row">
              <button class="ctrl active" data-bg-shape="trail">Trazo</button>
              <button class="ctrl" data-bg-shape="circle">Círculo</button>
              <button class="ctrl" data-bg-shape="triangle">Triángulo</button>
              <button class="ctrl" data-bg-shape="diamond">Diamante</button>
            </div>
            <div class="btn-row" style="margin-top:4px;">
              <button class="ctrl" data-bg-shape="star">Estrella</button>
              <button class="ctrl" data-bg-shape="square">Cuadrado</button>
            </div>
          </div>
          <div class="row">
            <label>Tamaño forma <span id="bgShapeSizeVal" class="badge">0.8</span></label>
            <div class="row-val">
              <input type="range" id="bgShapeSize" min="0.3" max="4" step="0.1" value="0.8">
            </div>
          </div>
        </div>
```

- [ ] **Step 3: Add bind functions in `js/ui.js`**

Add after `bindParticleColorMode()` (around line 226):

```js
function bindParticleShape() {
  bindBtnGroup('[data-txt-shape]', 'txtShape', val => {
    S.txt.shape = val;
  });
  bindSlider('txtShapeSize', 'txtShapeSizeVal', 1, v => { S.txt.shapeSize = v; });
}

function bindBgShape() {
  bindBtnGroup('[data-bg-shape]', 'bgShape', val => {
    S.bg.shape = val;
  });
  bindSlider('bgShapeSize', 'bgShapeSizeVal', 1, v => { S.bg.shapeSize = v; });
}
```

Call them in `init()`:
```js
  bindParticleShape();
  bindBgShape();
```

- [ ] **Step 4: Verify build**

Run: `node build.js`
Expected: no errors

---

### Task 4: Export — Include shapes in standalone HTML

**Files:**
- Modify: `js/ui.js` (update `bindExport()` minified inline code)

**Context:** The export function generates a standalone HTML file with minified particle classes as hardcoded strings. The new `drawShape()` function and updated `draw()` methods must be included there.

- [ ] **Step 1: Extract and minify the updated particle code**

After running `node build.js`, the inline script in `index.html` contains the full assembled JS (including updated particle.js). Extract the relevant minified code from there.

Alternatively, craft the minified `drawShape` helper and append it before the particle class definitions in the export template string.

- [ ] **Step 2: Add `drawShape` to the export template**

In the export template string in `bindExport()`, add before the `TextParticle` class string:

```js
'function drawShape(c,t,x,y,s){var S=s*2;c.save();c.translate(x,y);switch(t){case"circle":c.beginPath();c.arc(0,0,S/2,0,Math.PI*2);c.fill();break;case"triangle":c.beginPath();c.moveTo(0,-S/2);c.lineTo(-S/2,S/2);c.lineTo(S/2,S/2);c.closePath();c.fill();break;case"diamond":c.beginPath();c.moveTo(0,-S/2);c.lineTo(S/2,0);c.lineTo(0,S/2);c.lineTo(-S/2,0);c.closePath();c.fill();break;case"star":c.beginPath();for(var i=0;i<10;i++){var a=i*Math.PI/5-Math.PI/2,r=i%2===0?S/2:S/4;i===0?c.moveTo(Math.cos(a)*r,Math.sin(a)*r):c.lineTo(Math.cos(a)*r,Math.sin(a)*r)}c.closePath();c.fill();break;case"square":c.fillRect(-S/2,-S/2,S,S);break}c.restore()}',
```

- [ ] **Step 3: Update the minified TextParticle class in export**

Replace the existing TextParticle class string with one that uses `drawShape`. The key change in the `draw` method. In the minified `TextParticle` class in the export template, replace the `draw` method:

Old minified draw:
```
draw(c){if(this.history.length<2)return;c.save();c.globalAlpha=S.txt.opacity;c.lineWidth=S.txt.lineWidth;c.strokeStyle=this.color;c.globalCompositeOperation=S.blendMode;c.beginPath();c.moveTo(this.history[0].x,this.history[0].y);for(var i=1;i<this.history.length;i++)c.lineTo(this.history[i].x,this.history[i].y);c.stroke();c.restore()}
```

New minified draw:
```
draw(c){if(this.history.length<2)return;c.save();c.globalCompositeOperation=S.blendMode;var sh=S.txt.shape;if(sh==="trail"){c.globalAlpha=S.txt.opacity;c.lineWidth=S.txt.lineWidth;c.strokeStyle=this.color;c.beginPath();c.moveTo(this.history[0].x,this.history[0].y);for(var i=1;i<this.history.length;i++)c.lineTo(this.history[i].x,this.history[i].y);c.stroke()}else{var L=this.history.length;c.fillStyle=this.color;for(var i=0;i<L;i++){var t=i/L,a=S.txt.opacity*(0.3+0.7*t),sz=S.txt.shapeSize*(0.2+0.8*t);c.globalAlpha=a;drawShape(c,sh,this.history[i].x,this.history[i].y,sz)}}c.restore()}
```

Same for BgParticle minified draw, using `S.bg.shape` and `S.bg.shapeSize`.

- [ ] **Step 4: Verify build**

Run: `node build.js`
Expected: no errors

---

### Task 5: Verify everything works

- [ ] **Step 1: Run build**

Run: `node build.js`

- [ ] **Step 2: Quick smoke check**

Open index.html in a browser. Verify:
- Default shape is "Trazo" (trail) — existing behavior preserved
- Switch to "Círculo" — particles render as circles along trail
- Switch to "Triángulo", "Diamante", "Estrella", "Cuadrado" — each renders correctly
- Background particle shapes work independently
- Shape size slider adjusts size
- Switching back to "Trazo" restores line rendering

- [ ] **Step 3: Export standalone HTML**

Click "Exportar HTML Standalone" — verify shapes work in exported file
