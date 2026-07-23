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
  shapeMode      : u32,
  _pad1          : u32,
  _pad2          : u32,
  _pad3          : u32,
  _pad4          : u32,
  _pad5          : u32,
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
  @location(1) segT: f32,
  @location(2) style: u32,
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
  let raw = p.params.w;
  let isBg = raw & 1u;
  let style = (raw >> 1u) & 3u;

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
  output.segT = f32(segmentIdx) / f32(maxLen);
  output.style = style;
  return output;
}
`;

export const WGSL_TRAIL_FRAG = `
@fragment
fn trailFragment(input: VertexOutput) -> @location(0) vec4<f32> {
  var color = input.color;
  if (input.style == 1u) {
    let dashPos = fract(input.segT * 20.0);
    if (dashPos > 0.5) { discard; }
  }
  if (input.style == 2u) {
    let dotPos = fract(input.segT * 30.0);
    if (dotPos > 0.3) { discard; }
  }
  if (input.style == 3u) {
    color.a *= 0.7;
  }
  return color;
}
`;

export const WGSL_SHAPE_VERT = `
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
  shapeMode      : u32,
  shapeFirstVertex : u32,
  _pad1          : u32,
  _pad2          : u32,
  _pad3          : u32,
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

struct ShapeInput {
  @builtin(vertex_index) vertIdx: u32,
  @builtin(instance_index) instIdx: u32,
  @location(0) shapeVertex: vec2<f32>,
};

@vertex
fn shapeVertex(input: ShapeInput) -> VertexOutput {
  let particleIdx = input.instIdx / uni.maxTrail;
  let slot = input.instIdx % uni.maxTrail;
  let p = particles[particleIdx];
  let cursor = p.params.z;
  let maxLen = max(p.params.y, 1u);
  let isBg = p.params.w;

  let historySlot = (cursor + slot) % maxLen;
  let trailPos = trail[particleIdx * uni.maxTrail + historySlot];
  let size = select(uni.txtShapeSize, uni.bgShapeSize, isBg > 0u);
  let worldPos = trailPos + input.shapeVertex * size;

  let ndcX = (worldPos.x / uni.canvasWidth) * 2.0 - 1.0;
  let ndcY = -((worldPos.y / uni.canvasHeight) * 2.0 - 1.0);

  let t = f32(slot) / f32(maxLen);
  let alpha = (0.3 + 0.7 * t) * select(uni.txtOpacity, uni.bgOpacity, isBg > 0u);

  var output: VertexOutput;
  output.position = vec4(ndcX, ndcY, 0.0, 1.0);
  output.color = vec4(p.color.rgb, p.color.a * alpha);
  return output;
}
`;

export const WGSL_SHAPE_FRAG = `
@fragment
fn shapeFragment(input: VertexOutput) -> @location(0) vec4<f32> {
  return input.color;
}
`;

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
  _pad1: f32,
  _pad2: f32,
  _pad3: f32,
};
@group(0) @binding(0) var<uniform> uni: Uniforms;
@fragment
fn main(@location(0) uv: vec2<f32>) -> @location(0) vec4<f32> {
  return vec4(0.0, 0.0, 0.0, uni.fadeAlpha);
}
`;

export const WGSL_DEBUG_VERT = `
struct Uniforms {
  cellSize      : f32,
  columns       : u32,
  rows          : u32,
  canvasWidth   : f32,
  canvasHeight  : f32,
};

struct VertexOutput {
  @builtin(position) position: vec4<f32>,
  @location(0) color: vec4<f32>,
};

@group(0) @binding(0) var<uniform> uni: Uniforms;
@group(0) @binding(1) var<storage, read> mask: array<u32>;

struct DebugInput {
  @builtin(vertex_index) vertIdx: u32,
  @builtin(instance_index) instIdx: u32,
};

@vertex
fn debugVertex(input: DebugInput) -> VertexOutput {
  let cellIdx = input.instIdx;
  let col = cellIdx % uni.columns;
  let row = cellIdx / uni.columns;
  let x = f32(col) * uni.cellSize;
  let y = f32(row) * uni.cellSize;
  let s = uni.cellSize;
  let cell = input.vertIdx;

  var pos: vec2<f32>;
  if (cell == 0u) { pos = vec2(x, y); }
  else if (cell == 1u) { pos = vec2(x + s, y); }
  else if (cell == 2u) { pos = vec2(x + s, y + s); }
  else { pos = vec2(x, y + s); }

  let ndcX = (pos.x / uni.canvasWidth) * 2.0 - 1.0;
  let ndcY = -((pos.y / uni.canvasHeight) * 2.0 - 1.0);

  var out: VertexOutput;
  out.position = vec4(ndcX, ndcY, 0.0, 1.0);
  out.color = vec4(0.42, 0.62, 0.85, 0.12);
  return out;
}
`;

export const WGSL_DEBUG_FRAG = `
@fragment
fn debugFragment(input: VertexOutput) -> @location(0) vec4<f32> {
  return input.color;
}
`;

export function createTrailPipeline(device, format) {
  const shader = device.createShaderModule({
    code: WGSL_TRAIL_VERT + '\n' + WGSL_TRAIL_FRAG,
  });
  const pipeline = device.createRenderPipeline({
    layout: 'auto',
    vertex: {
      module: shader,
      entryPoint: 'trailVertex',
    },
    fragment: {
      module: shader,
      entryPoint: 'trailFragment',
      targets: [{
        format,
        blend: {
          color: { srcFactor: 'one', dstFactor: 'one-minus-src-alpha' },
          alpha: { srcFactor: 'one', dstFactor: 'one-minus-src-alpha' },
        },
      }],
    },
    primitive: { topology: 'triangle-list' },
  });
  return pipeline;
}

export function createShapePipeline(device, format, vertexBuffer) {
  const shader = device.createShaderModule({
    code: WGSL_SHAPE_VERT + '\n' + WGSL_SHAPE_FRAG,
  });
  const pipeline = device.createRenderPipeline({
    layout: 'auto',
    vertex: {
      module: shader,
      entryPoint: 'shapeVertex',
      buffers: [{
        arrayStride: 8,
        attributes: [{
          shaderLocation: 0,
          offset: 0,
          format: 'float32x2',
        }],
        stepMode: 'vertex',
      }],
    },
    fragment: {
      module: shader,
      entryPoint: 'shapeFragment',
      targets: [{
        format,
        blend: {
          color: { srcFactor: 'one', dstFactor: 'one-minus-src-alpha' },
          alpha: { srcFactor: 'one', dstFactor: 'one-minus-src-alpha' },
        },
      }],
    },
    primitive: { topology: 'triangle-fan' },
  });
  return pipeline;
}

export function createShapeVertexBuffer(device) {
  const shapeVerts = [];
  function circ(n) {
    shapeVerts.push(0, 0);
    for (let i = 0; i <= n; i++) {
      const a = (i / n) * Math.PI * 2;
      shapeVerts.push(Math.cos(a), Math.sin(a));
    }
  }
  function tri() {
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI * 2 - Math.PI / 2;
      shapeVerts.push(Math.cos(a), Math.sin(a));
    }
  }
  function dia() {
    shapeVerts.push(0, -1, 1, 0, 0, 1, -1, 0);
  }
  function star() {
    for (let i = 0; i < 10; i++) {
      const a = (i * Math.PI) / 5 - Math.PI / 2;
      const r = i % 2 === 0 ? 1 : 0.5;
      shapeVerts.push(Math.cos(a) * r, Math.sin(a) * r);
    }
  }
  function sq() {
    shapeVerts.push(-1, -1, 1, -1, 1, 1, -1, 1);
  }
  circ(32); tri(); dia(); star(); sq();

  const buf = new Float32Array(shapeVerts);
  const buffer = device.createBuffer({
    size: buf.byteLength,
    usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
  });
  device.queue.writeBuffer(buffer, 0, buf);
  return buffer;
}

export const SHAPE_OFFSETS = [0, 0, 33, 36, 40, 50];
export const SHAPE_COUNTS = [0, 33, 3, 4, 10, 4];

export function createFadePipeline(device, format) {
  const shader = device.createShaderModule({
    code: WGSL_FADE_VERT + '\n' + WGSL_FADE_FRAG,
  });
  const pipeline = device.createRenderPipeline({
    layout: 'auto',
    vertex: {
      module: shader,
      entryPoint: 'main',
    },
    fragment: {
      module: shader,
      entryPoint: 'main',
      targets: [{
        format,
        blend: {
          color: { srcFactor: 'one', dstFactor: 'one-minus-src-alpha' },
          alpha: { srcFactor: 'one', dstFactor: 'one-minus-src-alpha' },
        },
      }],
    },
    primitive: { topology: 'triangle-list' },
  });
  return pipeline;
}

export function createDebugPipeline(device, format) {
  const shader = device.createShaderModule({
    code: WGSL_DEBUG_VERT + '\n' + WGSL_DEBUG_FRAG,
  });
  const pipeline = device.createRenderPipeline({
    layout: 'auto',
    vertex: {
      module: shader,
      entryPoint: 'debugVertex',
    },
    fragment: {
      module: shader,
      entryPoint: 'debugFragment',
      targets: [{
        format,
        blend: {
          color: { srcFactor: 'one', dstFactor: 'one-minus-src-alpha' },
          alpha: { srcFactor: 'one', dstFactor: 'one-minus-src-alpha' },
        },
      }],
    },
    primitive: { topology: 'triangle-strip' },
  });
  return pipeline;
}
