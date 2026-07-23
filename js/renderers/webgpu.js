import { S } from '../state.js';
import { bus } from '../bus.js';
import { createComputePipeline, createParticleBuffers } from '../gpu/compute.js';
import { createTrailPipeline, createShapePipeline, createFadePipeline, createDebugPipeline, createShapeVertexBuffer, SHAPE_OFFSETS, SHAPE_COUNTS } from '../gpu/render.js';

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
    this.trailPipeline = null;
    this.shapePipeline = null;
    this.fadePipeline = null;
    this.debugPipeline = null;
    this.shapeVertexBuffer = null;
    this.txtUniformBuffer = null;
    this.bgUniformBuffer = null;
    this.renderUniformBuffer = null;
    this.fadeUniformBuffer = null;
    this.debugUniformBuffer = null;
    this.cellsBuffer = null;
    this.maskBuffer = null;
    this.txtParticleBuffer = null;
    this.txtTrailBuffer = null;
    this.bgParticleBuffer = null;
    this.bgTrailBuffer = null;
    this.txtParticleCount = 0;
    this.bgParticleCount = 0;
    this.txtBindGroup = null;
    this.bgBindGroup = null;
    this.txtTrailBindGroup = null;
    this.bgTrailBindGroup = null;
    this.txtShapeBindGroup = null;
    this.bgShapeBindGroup = null;
    this.fadeBindGroup = null;
    this.debugBindGroup = null;
    this._unsubscribe = null;
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
      size: 96,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });
    this.bgUniformBuffer = this.device.createBuffer({
      size: 96,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });

    this.renderUniformBuffer = this.device.createBuffer({
      size: 80,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });

    this.fadeUniformBuffer = this.device.createBuffer({
      size: 16,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });

    this.debugUniformBuffer = this.device.createBuffer({
      size: 32,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });

    this.trailPipeline = createTrailPipeline(this.device, this.format);
    this.shapeVertexBuffer = createShapeVertexBuffer(this.device);
    this.shapePipeline = createShapePipeline(this.device, this.format, this.shapeVertexBuffer);
    this.fadePipeline = createFadePipeline(this.device, this.format);
    this.debugPipeline = createDebugPipeline(this.device, this.format);

    this.fadeBindGroup = this.device.createBindGroup({
      layout: this.fadePipeline.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: { buffer: this.fadeUniformBuffer } },
      ],
    });

    this._createFlowFieldTexture();
    this._createTextMaskTexture();
    this._createCellsBuffer();
    this._createMaskBuffer();

    this._unsubscribe = bus.on('state:change', ({ key }) => {
      if (key === 'S.fadeAlpha') return;
      this._updateRenderUniforms();
      if (key && (key.startsWith('S.txt.') || key.startsWith('S.bg.'))) {
        this._refreshFlowTextures();
      }
    });
  }

  _createMaskBuffer() {
    const ef = this.effect;
    const arr = ef.textMask || [];
    const count = Math.max(arr.length, 1);
    const data = new Uint32Array(count);
    for (let i = 0; i < arr.length; i++) {
      data[i] = arr[i] ? 1 : 0;
    }
    this.maskBuffer = this.device.createBuffer({
      size: data.byteLength,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
    });
    this.device.queue.writeBuffer(this.maskBuffer, 0, data);
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

    function buildFlowTexture(w, h, flowData) {
      const data = new Uint8Array(w * h * 2);
      for (let row = 0; row < h; row++) {
        for (let col = 0; col < w; col++) {
          const idx = row * w + col;
          const cell = flowData[idx];
          const angle = cell ? cell.angle : 0;
          const inText = cell && cell.inText ? 1 : 0;
          data[idx * 2]     = ((angle / (Math.PI * 2)) + 0.5) * 255;
          data[idx * 2 + 1] = inText * 255;
        }
      }
      const desc = {
        size: [w, h, 1],
        format: 'rg8unorm',
        usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST,
      };
      const tex = this.device.createTexture(desc);
      this.device.queue.writeTexture(
        { texture: tex },
        data,
        { bytesPerRow: w * 2 },
        [w, h, 1]
      );
      return tex;
    }

    if (this.txtFlowTexture) this.txtFlowTexture.destroy();
    if (this.bgFlowTexture) this.bgFlowTexture.destroy();

    this.txtFlowTexture = buildFlowTexture.call(this, ef.columns, ef.rows, ef.flowField);
    this.bgFlowTexture = buildFlowTexture.call(this, ef.columns, ef.rows, ef.bgFlowField);
  }

  _refreshFlowTextures() {
    const ef = this.effect;
    const w = ef.columns, h = ef.rows;
    const txtData = new Uint8Array(w * h * 2);
    for (let row = 0; row < h; row++) {
      for (let col = 0; col < w; col++) {
        const idx = row * w + col;
        const cell = ef.flowField[idx];
        const angle = cell ? cell.angle : 0;
        const inText = cell && cell.inText ? 1 : 0;
        txtData[idx * 2]     = ((angle / (Math.PI * 2)) + 0.5) * 255;
        txtData[idx * 2 + 1] = inText * 255;
      }
    }
    this.device.queue.writeTexture(
      { texture: this.txtFlowTexture },
      txtData,
      { bytesPerRow: w * 2 },
      [w, h, 1]
    );

    const bgData = new Uint8Array(w * h * 2);
    for (let row = 0; row < h; row++) {
      for (let col = 0; col < w; col++) {
        const idx = row * w + col;
        const cell = ef.bgFlowField[idx];
        const angle = cell ? cell.angle : 0;
        bgData[idx * 2]     = ((angle / (Math.PI * 2)) + 0.5) * 255;
        bgData[idx * 2 + 1] = 0;
      }
    }
    this.device.queue.writeTexture(
      { texture: this.bgFlowTexture },
      bgData,
      { bytesPerRow: w * 2 },
      [w, h, 1]
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
    const data = new ArrayBuffer(96);
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
    f32[19] = S.pointer.x;
    f32[20] = S.pointer.y;
    f32[21] = (S.distortion.enabled && S.pointer.down) ? S.distortion.strength : 0;
    f32[22] = S.distortion.radius;

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

  _makeTrailBindGroup(particleBuffer, trailBuffer, shapeOnly) {
    if (shapeOnly) {
      return this.device.createBindGroup({
        layout: this.shapePipeline.getBindGroupLayout(0),
        entries: [
          { binding: 0, resource: { buffer: this.renderUniformBuffer } },
          { binding: 1, resource: { buffer: particleBuffer } },
          { binding: 2, resource: { buffer: trailBuffer } },
        ],
      });
    }
    return this.device.createBindGroup({
      layout: this.trailPipeline.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: { buffer: this.renderUniformBuffer } },
        { binding: 1, resource: { buffer: particleBuffer } },
        { binding: 2, resource: { buffer: trailBuffer } },
      ],
    });
  }

  _makeDebugBindGroup() {
    if (!this.debugPipeline) return null;
    return this.device.createBindGroup({
      layout: this.debugPipeline.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: { buffer: this.debugUniformBuffer } },
        { binding: 1, resource: { buffer: this.maskBuffer } },
      ],
    });
  }

  _updateRenderUniforms() {
    const ef = this.effect;
    const data = new ArrayBuffer(80);
    const f32 = new Float32Array(data);
    const u32 = new Uint32Array(data);

    f32[0] = ef.cellSize;
    f32[1] = S.txt.opacity;
    f32[2] = S.txt.lineWidth;
    f32[3] = S.bg.opacity;
    f32[4] = S.bg.lineWidth;
    f32[5] = ef.width;
    f32[6] = ef.height;
    f32[7] = S.txt.shapeSize;
    f32[8] = S.bg.shapeSize;
    u32[9] = MAX_TRAIL;
    u32[10] = 0; // shapeMode
    u32[11] = 0; // shapeFirstVertex

    this.device.queue.writeBuffer(this.renderUniformBuffer, 0, data);
  }

  _updateFadeUniforms() {
    const data = new ArrayBuffer(16);
    const f32 = new Float32Array(data);
    f32[0] = S.fadeAlpha;
    this.device.queue.writeBuffer(this.fadeUniformBuffer, 0, data);
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
    this.txtTrailBindGroup = this._makeTrailBindGroup(particles, trail, false);
    this.txtShapeBindGroup = this._makeTrailBindGroup(particles, trail, true);
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
    this.bgTrailBindGroup = this._makeTrailBindGroup(particles, trail, false);
    this.bgShapeBindGroup = this._makeTrailBindGroup(particles, trail, true);
  }

  respawnText() { this.spawnText(); }
  respawnBg()   { this.spawnBg(); }

  _updateUniforms() {
    if (this.txtParticleCount) {
      this._writeUniforms(this.txtUniformBuffer, this.txtParticleCount);
    }
    if (this.bgParticleCount) {
      this._writeUniforms(this.bgUniformBuffer, this.bgParticleCount);
    }
  }

  render(ctx) {
    if (!this.device) return;

    this._updateUniforms();
    this._updateRenderUniforms();
    this._updateFadeUniforms();

    const encoder = this.device.createCommandEncoder();

    // Compute pass
    if (this.txtParticleCount || this.bgParticleCount) {
      const pass = encoder.beginComputePass();
      pass.setPipeline(this.computePipeline);

      if (this.txtParticleCount) {
        pass.setBindGroup(0, this.txtBindGroup);
        pass.dispatchWorkgroups(Math.ceil(this.txtParticleCount / 256));
      }
      if (this.bgParticleCount) {
        pass.setBindGroup(0, this.bgBindGroup);
        pass.dispatchWorkgroups(Math.ceil(this.bgParticleCount / 256));
      }

      pass.end();
    }

    const texView = this.context.getCurrentTexture().createView();

    const colorAtt = {
      view: texView,
      loadOp: 'load',
      storeOp: 'store',
    };

    // Fade pass
    const fadePass = encoder.beginRenderPass({
      colorAttachments: [colorAtt],
    });
    fadePass.setPipeline(this.fadePipeline);
    fadePass.setBindGroup(0, this.fadeBindGroup);
    fadePass.draw(3);
    fadePass.end();

    const shapeMode = 0;

    // Trail/shape pass (txt)
    if (this.txtParticleCount) {
      const pass = encoder.beginRenderPass({
        colorAttachments: [{ ...colorAtt }],
      });

      if (shapeMode) {
        pass.setPipeline(this.shapePipeline);
        pass.setBindGroup(0, this.txtShapeBindGroup);
        pass.setVertexBuffer(0, this.shapeVertexBuffer);
        pass.draw(SHAPE_COUNTS[shapeMode], this.txtParticleCount * MAX_TRAIL, SHAPE_OFFSETS[shapeMode], 0);
      } else {
        pass.setPipeline(this.trailPipeline);
        pass.setBindGroup(0, this.txtTrailBindGroup);
        pass.draw(6, this.txtParticleCount * (MAX_TRAIL - 1));
      }

      pass.end();
    }

    // Trail/shape pass (bg)
    if (this.bgParticleCount) {
      const pass = encoder.beginRenderPass({
        colorAttachments: [{ ...colorAtt }],
      });

      if (shapeMode) {
        pass.setPipeline(this.shapePipeline);
        pass.setBindGroup(0, this.bgShapeBindGroup);
        pass.setVertexBuffer(0, this.shapeVertexBuffer);
        pass.draw(SHAPE_COUNTS[shapeMode], this.bgParticleCount * MAX_TRAIL, SHAPE_OFFSETS[shapeMode], 0);
      } else {
        pass.setPipeline(this.trailPipeline);
        pass.setBindGroup(0, this.bgTrailBindGroup);
        pass.draw(6, this.bgParticleCount * (MAX_TRAIL - 1));
      }

      pass.end();
    }

    // Debug overlay
    if (S.debug) {
      const ef = this.effect;
      const dbgData = new ArrayBuffer(32);
      const f32 = new Float32Array(dbgData);
      const u32 = new Uint32Array(dbgData);
      f32[0] = ef.cellSize;
      u32[1] = ef.columns;
      u32[2] = ef.rows;
      f32[3] = ef.width;
      f32[4] = ef.height;
      this.device.queue.writeBuffer(this.debugUniformBuffer, 0, dbgData);

      if (!this.debugBindGroup) {
        this.debugBindGroup = this._makeDebugBindGroup();
      }

      const dbgPass = encoder.beginRenderPass({
        colorAttachments: [{ ...colorAtt }],
      });
      dbgPass.setPipeline(this.debugPipeline);
      dbgPass.setBindGroup(0, this.debugBindGroup);
      dbgPass.draw(4, ef.columns * ef.rows);
      dbgPass.end();
    }

    this.device.queue.submit([encoder.finish()]);
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
    if (this._unsubscribe) this._unsubscribe();

    if (this.txtFlowTexture) this.txtFlowTexture.destroy();
    if (this.bgFlowTexture) this.bgFlowTexture.destroy();
    if (this.textMaskTexture) this.textMaskTexture.destroy();
    if (this.txtParticleBuffer) this.txtParticleBuffer.destroy();
    if (this.txtTrailBuffer) this.txtTrailBuffer.destroy();
    if (this.bgParticleBuffer) this.bgParticleBuffer.destroy();
    if (this.bgTrailBuffer) this.bgTrailBuffer.destroy();
    if (this.cellsBuffer) this.cellsBuffer.destroy();
    if (this.maskBuffer) this.maskBuffer.destroy();
    if (this.shapeVertexBuffer) this.shapeVertexBuffer.destroy();
    if (this.txtUniformBuffer) this.txtUniformBuffer.destroy();
    if (this.bgUniformBuffer) this.bgUniformBuffer.destroy();
    if (this.renderUniformBuffer) this.renderUniformBuffer.destroy();
    if (this.fadeUniformBuffer) this.fadeUniformBuffer.destroy();
    if (this.debugUniformBuffer) this.debugUniformBuffer.destroy();
  }
}
