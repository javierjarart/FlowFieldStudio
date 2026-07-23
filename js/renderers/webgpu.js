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
    });

    this._createFlowFieldTexture();
    this._createTextMaskTexture();
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
    this.effect.canvas.width = w;
    this.effect.canvas.height = h;
    this.context.configure({
      device: this.device,
      format: this.format,
    });
  }

  destroy() {
    // Release GPU resources
    if (this.txtFlowTexture) this.txtFlowTexture.destroy();
    if (this.bgFlowTexture) this.bgFlowTexture.destroy();
    if (this.textMaskTexture) this.textMaskTexture.destroy();
  }
}
