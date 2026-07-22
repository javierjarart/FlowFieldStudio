import { S, bus } from './state.js';
import { noise } from './perlin.js';
import { TextParticle, BgParticle } from './particle.js';

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
    this.textParticles = [];
    this.bgParticles   = [];
    this.rows = 0;
    this.columns = 0;
    this._srcImg = null;

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

  buildSourceImage() {
    if (S.sourceMode === 'text') {
      return this.buildTextImage();
    } else {
      return new Promise(resolve => {
        if (S.bgImage) {
          resolve(S.bgImage);
        } else {
          const temp = document.createElement('canvas');
          temp.width = this.width; temp.height = this.height;
          const tCtx = temp.getContext('2d');
          const grad = tCtx.createRadialGradient(
            this.width/2, this.height/2, 20,
            this.width/2, this.height/2,
            Math.min(this.width, this.height) * 0.35
          );
          grad.addColorStop(0, '#00ffff');
          grad.addColorStop(0.5, '#7f00ff');
          grad.addColorStop(1, '#ff007f');
          tCtx.fillStyle = grad;
          tCtx.beginPath();
          tCtx.arc(this.width/2, this.height/2, Math.min(this.width, this.height)*0.35, 0, Math.PI*2);
          tCtx.fill();
          tCtx.fillStyle = '#ffffff';
          tCtx.font = '900 24px system-ui';
          tCtx.textAlign = 'center';
          tCtx.fillText('CARGA UNA IMAGEN', this.width/2, this.height/2);
          const img = new Image();
          img.onload = () => resolve(img);
          img.src = temp.toDataURL();
        }
      });
    }
  }

  buildTextImage() {
    return new Promise(resolve => {
      const w = this.width, h = this.height;
      const fs = S.fontSize;
      const lsp = S.letterSpacing;

      let fill = '';
      let defs = '';
      if (S.colorMode === 'solid') {
        fill = S.solidColor;
      } else {
        let x2='100%', y2='0%', x1='0%', y1='0%';
        if (S.gradDir === 'v') { x2='0%'; y2='100%'; }
        if (S.gradDir === 'd') { x2='100%'; y2='100%'; }
        const stops = S.gradColors.map((c,i) => {
          const pct = [0,33,66,100][i];
          return `<stop offset="${pct}%" stop-color="${c}"/>`;
        }).join('');
        defs = `<defs>
          <linearGradient id="tg" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}">
            ${stops}
          </linearGradient>
        </defs>`;
        fill = 'url(#tg)';
      }

      const fontStr = `${S.fontWeight} ${fs}px ${S.fontFamily}`;
      const offCtx = document.createElement('canvas').getContext('2d');
      offCtx.font = fontStr;
      const lines = S.text.split('\n');
      const lineH = fs * 1.1;
      const totalH = lines.length * lineH;
      const cy = h/2 + fs*0.35 - (totalH - lineH)/2;

      const lspAttr = lsp !== 0 ? `letter-spacing="${lsp}"` : '';

      let textEls = lines.map((line, i) =>
        `<text x="50%" y="${cy + i*lineH}"
          font-family="${S.fontFamily.replace(/"/g, "'")}"
          font-weight="${S.fontWeight}"
          font-size="${fs}"
          ${lspAttr}
          text-anchor="middle"
          dominant-baseline="auto"
          fill="${fill}">${line}</text>`
      ).join('');

      const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">
        ${defs}
        ${textEls}
      </svg>`;

      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => { console.warn('SVG load error'); resolve(null); };
      img.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svg)));
    });
  }

  async init() {
    this.cellSize = S.cellSize;
    this.rows     = Math.floor(this.height / this.cellSize);
    this.columns  = Math.floor(this.width  / this.cellSize);

    const img = await this.buildSourceImage();
    if (!img) return;
    this._srcImg = img;

    const off = document.createElement('canvas');
    off.width = this.width; off.height = this.height;
    const oCtx = off.getContext('2d');

    if (S.sourceMode === 'text') {
      oCtx.drawImage(img, 0, 0);
    } else {
      const sc = Math.max(this.width / img.width, this.height / img.height);
      const sw = img.width * sc;
      const sh = img.height * sc;
      oCtx.drawImage(img, (this.width - sw)/2, (this.height - sh)/2, sw, sh);
    }

    const pixels = oCtx.getImageData(0, 0, this.width, this.height);

    const totalCells = this.rows * this.columns;
    const rawMask = new Uint8Array(totalCells);

    this.flowField = [];
    this.textCells = [];

    for (let row = 0; row < this.rows; row++) {
      for (let col = 0; col < this.columns; col++) {
        const x  = col * this.cellSize;
        const y  = row * this.cellSize;
        const pi = (y * this.width + x) * 4;
        const r  = pixels.data[pi];
        const g  = pixels.data[pi+1];
        const b  = pixels.data[pi+2];
        const a  = pixels.data[pi+3];
        const idx= row * this.columns + col;

        const inSource = a > 10;
        rawMask[idx] = inSource ? 1 : 0;

        const angle = inSource
          ? noise(x / S.txt.noiseScale, y / S.txt.noiseScale) * Math.PI * S.txt.angleMult
          : 0;

        if (inSource) {
          this.textCells.push({ x, y, color: `rgb(${r},${g},${b})` });
        }
        this.flowField.push({ angle, inText: inSource });
      }
    }

    this.textMask = this._dilate(rawMask, S.bleedRadius);

    if (S.bleedRadius > 0) {
      for (let row = 0; row < this.rows; row++) {
        for (let col = 0; col < this.columns; col++) {
          const idx = row * this.columns + col;
          this.flowField[idx].inText = this.textMask[idx] > 0;
        }
      }
    }

    this.bgFlowField = [];
    for (let row = 0; row < this.rows; row++) {
      for (let col = 0; col < this.columns; col++) {
        const x = col * this.cellSize;
        const y = row * this.cellSize;
        const angle = noise(
          x / S.bg.noiseScale + 100,
          y / S.bg.noiseScale + 100
        ) * Math.PI * S.bg.angleMult;
        this.bgFlowField.push({ angle });
      }
    }

    this._spawnTextParticles();
    this._spawnBgParticles();
    bus.emit('effect:init', this);
  }

  _dilate(mask, radius) {
    if (radius <= 0) return mask.slice();
    const out = new Uint8Array(mask.length);
    const r   = Math.ceil(radius / this.cellSize);
    for (let row = 0; row < this.rows; row++) {
      for (let col = 0; col < this.columns; col++) {
        if (mask[row * this.columns + col]) {
          out[row * this.columns + col] = 1;
          continue;
        }
        outer: for (let dr = -r; dr <= r; dr++) {
          for (let dc = -r; dc <= r; dc++) {
            if (dr*dr + dc*dc > r*r) continue;
            const nr = row + dr, nc = col + dc;
            if (nr >= 0 && nr < this.rows && nc >= 0 && nc < this.columns) {
              if (mask[nr * this.columns + nc]) {
                out[row * this.columns + col] = 1;
                break outer;
              }
            }
          }
        }
      }
    }
    return out;
  }

  isTextZone(x, y) {
    if (!this.textMask) return false;
    const col = Math.max(0, Math.min(Math.floor(x / this.cellSize), this.columns - 1));
    const row = Math.max(0, Math.min(Math.floor(y / this.cellSize), this.rows    - 1));
    return this.textMask[row * this.columns + col] > 0;
  }

  _spawnTextParticles() {
    if (!this.textCells.length) { this.textParticles = []; return; }
    this.textParticles = Array.from({length: S.txt.count}, () => new TextParticle(this));
  }

  _spawnBgParticles() {
    if (!S.bg.enabled) { this.bgParticles = []; return; }
    this.bgParticles = Array.from({length: S.bg.count}, () => new BgParticle(this));
  }

  respawnText() { this._spawnTextParticles(); }
  respawnBg()   { this._spawnBgParticles(); }

  refreshTextFlow() {
    for (let row = 0; row < this.rows; row++) {
      for (let col = 0; col < this.columns; col++) {
        const idx = row * this.columns + col;
        if (this.flowField[idx].inText) {
          const x = col * this.cellSize, y = row * this.cellSize;
          this.flowField[idx].angle =
            noise(x / S.txt.noiseScale, y / S.txt.noiseScale) * Math.PI * S.txt.angleMult;
        }
      }
    }
  }

  refreshBgFlow() {
    this.bgFlowField = [];
    for (let row = 0; row < this.rows; row++) {
      for (let col = 0; col < this.columns; col++) {
        const x = col * this.cellSize, y = row * this.cellSize;
        this.bgFlowField.push({
          angle: noise(x/S.bg.noiseScale+100, y/S.bg.noiseScale+100) * Math.PI * S.bg.angleMult
        });
      }
    }
  }

  drawDebug(ctx) {
    ctx.save();
    ctx.strokeStyle = 'rgba(255,255,255,0.15)';
    ctx.lineWidth   = 0.4;
    for (let c = 0; c < this.columns; c++) {
      ctx.beginPath();
      ctx.moveTo(c * this.cellSize, 0);
      ctx.lineTo(c * this.cellSize, this.height);
      ctx.stroke();
    }
    for (let r = 0; r < this.rows; r++) {
      ctx.beginPath();
      ctx.moveTo(0, r * this.cellSize);
      ctx.lineTo(this.width, r * this.cellSize);
      ctx.stroke();
    }
    ctx.fillStyle = 'rgba(108,158,217,0.12)';
    for (let row = 0; row < this.rows; row++) {
      for (let col = 0; col < this.columns; col++) {
        if (this.textMask && this.textMask[row*this.columns+col]) {
          ctx.fillRect(col*this.cellSize, row*this.cellSize, this.cellSize, this.cellSize);
        }
      }
    }
    ctx.restore();
  }

  resize(w, h) {
    this.canvas.width  = w; this.canvas.height  = h;
    this.width = w; this.height = h;
    this.init();
  }

  render(ctx) {
    if (S.debug) this.drawDebug(ctx);
    if (S.debugImg && this._srcImg) {
      ctx.save();
      ctx.globalAlpha = 0.3;
      if (S.sourceMode === 'text') {
        ctx.drawImage(this._srcImg, 0, 0);
      } else {
        const sc = Math.max(this.width / this._srcImg.width, this.height / this._srcImg.height);
        const sw = this._srcImg.width * sc;
        const sh = this._srcImg.height * sc;
        ctx.drawImage(this._srcImg, (this.width - sw)/2, (this.height - sh)/2, sw, sh);
      }
      ctx.restore();
    }
    if (S.showBgImg && S.bgImage) {
      ctx.save();
      const sc = Math.max(this.width/S.bgImage.width, this.height/S.bgImage.height);
      const sw = S.bgImage.width*sc, sh = S.bgImage.height*sc;
      ctx.globalAlpha = S.bgImgOpac;
      ctx.drawImage(S.bgImage, (this.width-sw)/2, (this.height-sh)/2, sw, sh);
      ctx.restore();
    }

    this.bgParticles.forEach(p => { p.draw(ctx); p.update(); });
    this.textParticles.forEach(p => { p.draw(ctx); p.update(); });
  }
}
