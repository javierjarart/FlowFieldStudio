import { S } from './state.js';

export class PostProcessor {
  constructor() {
    this._offscreen = null;
    this._ctx = null;
    this._grainCanvas = document.createElement('canvas');
    this._grainCtx = this._grainCanvas.getContext('2d');
  }

  render(ctx, w, h) {
    const p = S.post;
    if (!p || !p.enabled) return;

    if (p.ca && p.ca.enabled) {
      this._applyCA(ctx, w, h, p.ca.amount);
    }

    if (p.vignette && p.vignette.enabled) {
      this._applyVignette(ctx, w, h, p.vignette.intensity, p.vignette.roundness);
    }

    if (p.grain && p.grain.enabled) {
      this._applyGrain(ctx, w, h, p.grain.intensity);
    }

    if (p.bloom && p.bloom.enabled) {
      this._applyBloom(ctx, w, h, p.bloom.intensity, p.bloom.threshold, p.bloom.radius);
    }
  }

  _ensureOffscreen(w, h) {
    if (!this._offscreen || this._offscreen.width !== w || this._offscreen.height !== h) {
      this._offscreen = document.createElement('canvas');
      this._offscreen.width = w;
      this._offscreen.height = h;
      this._ctx = this._offscreen.getContext('2d');
    }
  }

  _applyBloom(ctx, w, h, intensity, threshold, radius) {
    this._ensureOffscreen(w, h);
    const offCtx = this._ctx;
    offCtx.drawImage(ctx.canvas, 0, 0);
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    ctx.filter = `blur(${radius}px)`;
    ctx.globalAlpha = (intensity || 0.5) * 0.6;
    ctx.drawImage(this._offscreen, 0, 0);
    ctx.filter = 'none';
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    ctx.restore();
  }

  _applyCA(ctx, w, h, amount) {
    this._ensureOffscreen(w, h);
    const offCtx = this._ctx;
    offCtx.drawImage(ctx.canvas, 0, 0);
    ctx.clearRect(0, 0, w, h);

    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    ctx.filter = 'none';

    const off = amount || 2;
    ctx.drawImage(this._offscreen, off, 0);
    ctx.drawImage(this._offscreen, -off, 0);

    ctx.globalCompositeOperation = 'source-over';
    ctx.drawImage(this._offscreen, 0, 0);
    ctx.restore();
  }

  _applyVignette(ctx, w, h, intensity, roundness) {
    const r = roundness != null ? roundness : 1;
    const grad = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, Math.max(w, h) * 0.65 * r);
    grad.addColorStop(0, 'rgba(0,0,0,0)');
    grad.addColorStop(0.5, 'rgba(0,0,0,0)');
    grad.addColorStop(1, `rgba(0,0,0,${intensity != null ? intensity : 0.3})`);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);
  }

  _applyGrain(ctx, w, h, intensity) {
    const grainSize = Math.min(w, 128);
    this._grainCanvas.width = grainSize;
    this._grainCanvas.height = grainSize;
    const gCtx = this._grainCtx;
    const imgData = gCtx.createImageData(grainSize, grainSize);
    const d = imgData.data;
    const iVal = intensity || 0.05;
    for (let i = 0; i < d.length; i += 4) {
      const v = (Math.random() * 2 - 1) * iVal * 255;
      d[i] = d[i + 1] = d[i + 2] = 128 + v;
      d[i + 3] = Math.abs(v) * 4;
    }
    gCtx.putImageData(imgData, 0, 0);
    ctx.drawImage(this._grainCanvas, 0, 0, grainSize, grainSize, 0, 0, w, h);
  }

  destroy() {
    this._offscreen = null;
    this._ctx = null;
  }
}
