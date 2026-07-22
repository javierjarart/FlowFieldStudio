import { S } from './state.js';

export class TextParticle {
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
    ctx.globalAlpha     = S.txt.opacity;
    ctx.lineWidth       = S.txt.lineWidth;
    ctx.strokeStyle     = this.color;
    ctx.globalCompositeOperation = S.blendMode;
    ctx.beginPath();
    ctx.moveTo(this.history[0].x, this.history[0].y);
    for (let i = 1; i < this.history.length; i++)
      ctx.lineTo(this.history[i].x, this.history[i].y);
    ctx.stroke();
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

export class BgParticle {
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
    ctx.globalAlpha    = S.bg.opacity;
    ctx.lineWidth      = S.bg.lineWidth;
    ctx.strokeStyle    = this.color;
    ctx.globalCompositeOperation = S.blendMode;
    ctx.beginPath();
    ctx.moveTo(this.history[0].x, this.history[0].y);
    for (let i = 1; i < this.history.length; i++)
      ctx.lineTo(this.history[i].x, this.history[i].y);
    ctx.stroke();
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
