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
