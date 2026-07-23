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
  let isBg = p.params.w;

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
  return output;
}
`;

export const WGSL_TRAIL_FRAG = `
@fragment
fn trailFragment(input: VertexOutput) -> @location(0) vec4<f32> {
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
    primitive: {
      topology: 'triangle-list',
    },
  });

  return pipeline;
}

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
    primitive: {
      topology: 'triangle-list',
    },
  });

  return pipeline;
}
