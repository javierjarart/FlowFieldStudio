import { S } from '../state.js';
import { createComputePipeline, createParticleBuffers } from '../gpu/compute.js';

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
    this.computePipeline = null;
    this.txtUniformBuffer = null;
    this.bgUniformBuffer = null;
    this.cellsBuffer = null;
    this.txtParticleBuffer = null;
    this.txtTrailBuffer = null;
    this.bgParticleBuffer = null;
    this.bgTrailBuffer = null;
    this.txtParticleCount = 0;
    this.bgParticleCount = 0;
    this.txtBindGroup = null;
    this.bgBindGroup = null;
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

    this.computePipeline = createComputePipeline(this.device);

    this.txtUniformBuffer = this.device.createBuffer({
      size: 80,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });
    this.bgUniformBuffer = this.device.createBuffer({
      size: 80,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });

    this._createFlowFieldTexture();
    this._createTextMaskTexture();
    this._createCellsBuffer();
  }

  _createCellsBuffer() {
    const ef = this.effect;
    const cells = ef.textCells || [];
    const count = Math.max(cells.length, 1);
    const buf = new ArrayBuffer(count * 8);
    const f32 = new Float32Array(buf);
    for (let i = 0; i < cells.length; i++) {
      f32[i * 2] = cells[i].x;
      f32[i * 2 + 1] = cells[i].y;
    }
    this.cellsBuffer = this.device.createBuffer({
      size: buf.byteLength,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
    });
    this.device.queue.writeBuffer(this.cellsBuffer, 0, buf);
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
    if (!ef.textMask) {
      const desc = {
        size: [1, 1, 1],
        format: 'rg8unorm',
        usage: GPUTextureUsage.TEXTURE_BINDING,
      };
      this.textMaskTexture = this.device.createTexture(desc);
      return;
    }
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

  _writeUniforms(buffer, numParticles) {
    const ef = this.effect;
    const data = new ArrayBuffer(80);
    const f32 = new Float32Array(data);
    const u32 = new Uint32Array(data);

    f32[0] = ef.cellSize;
    f32[1] = S.txt.noiseScale;
    f32[2] = S.txt.angleMult;
    f32[3] = S.txt.boost;
    f32[4] = S.txt.speedMin;
    f32[5] = S.txt.speedMax;
    f32[6] = S.bg.noiseScale;
    f32[7] = S.bg.angleMult;
    f32[8] = S.bg.speedMin;
    f32[9] = S.bg.speedMax;
    f32[10] = S.txt.shapeSize;
    f32[11] = S.bg.shapeSize;
    f32[12] = performance.now() / 1000;
    f32[13] = ef.width;
    f32[14] = ef.height;
    u32[15] = MAX_TRAIL;
    u32[16] = ef.textCells ? ef.textCells.length : 0;
    u32[17] = numParticles;

    this.device.queue.writeBuffer(buffer, 0, data);
  }

  _makeBindGroup(uniformBuffer, particleBuffer, trailBuffer) {
    const entries = [
      { binding: 0, resource: { buffer: uniformBuffer } },
      { binding: 1, resource: { buffer: particleBuffer } },
      { binding: 2, resource: { buffer: trailBuffer } },
      { binding: 3, resource: { buffer: this.cellsBuffer } },
      { binding: 4, resource: this.txtFlowTexture.createView() },
      { binding: 5, resource: this.bgFlowTexture.createView() },
      { binding: 6, resource: this.textMaskTexture.createView() },
    ];
    return this.device.createBindGroup({
      layout: this.computePipeline.getBindGroupLayout(0),
      entries,
    });
  }

  spawnText() {
    if (!this.effect.textCells || !this.effect.textCells.length) {
      this.txtParticleCount = 0;
      return;
    }
    const count = S.txt.count;
    const { particles, trail } = createParticleBuffers(this.device, this.effect, count, false, MAX_TRAIL);
    this.txtParticleBuffer = particles;
    this.txtTrailBuffer = trail;
    this.txtParticleCount = count;
    this.txtBindGroup = this._makeBindGroup(this.txtUniformBuffer, particles, trail);
  }

  spawnBg() {
    if (!S.bg.enabled) {
      this.bgParticleCount = 0;
      return;
    }
    const count = S.bg.count;
    const { particles, trail } = createParticleBuffers(this.device, this.effect, count, true, MAX_TRAIL);
    this.bgParticleBuffer = particles;
    this.bgTrailBuffer = trail;
    this.bgParticleCount = count;
    this.bgBindGroup = this._makeBindGroup(this.bgUniformBuffer, particles, trail);
  }

  respawnText() { this.spawnText(); }
  respawnBg()   { this.spawnBg(); }

  _dispatchCompute() {
    if (!this.txtParticleCount && !this.bgParticleCount) return;

    const encoder = this.device.createCommandEncoder();
    const pass = encoder.beginComputePass();
    pass.setPipeline(this.computePipeline);

    if (this.txtParticleCount) {
      this._writeUniforms(this.txtUniformBuffer, this.txtParticleCount);
      pass.setBindGroup(0, this.txtBindGroup);
      pass.dispatchWorkgroups(Math.ceil(this.txtParticleCount / 256));
    }

    if (this.bgParticleCount) {
      this._writeUniforms(this.bgUniformBuffer, this.bgParticleCount);
      pass.setBindGroup(0, this.bgBindGroup);
      pass.dispatchWorkgroups(Math.ceil(this.bgParticleCount / 256));
    }

    pass.end();
    this.device.queue.submit([encoder.finish()]);
  }

  render(ctx) {
    this._dispatchCompute();
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
    if (this.txtFlowTexture) this.txtFlowTexture.destroy();
    if (this.bgFlowTexture) this.bgFlowTexture.destroy();
    if (this.textMaskTexture) this.textMaskTexture.destroy();
    if (this.txtParticleBuffer) this.txtParticleBuffer.destroy();
    if (this.txtTrailBuffer) this.txtTrailBuffer.destroy();
    if (this.bgParticleBuffer) this.bgParticleBuffer.destroy();
    if (this.bgTrailBuffer) this.bgTrailBuffer.destroy();
    if (this.cellsBuffer) this.cellsBuffer.destroy();
    if (this.txtUniformBuffer) this.txtUniformBuffer.destroy();
    if (this.bgUniformBuffer) this.bgUniformBuffer.destroy();
  }
}
