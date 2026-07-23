import { S } from '../state.js';

export const WGSL_COMPUTE = `
struct Particle {
  pos    : vec2<f32>,
  prev   : vec2<f32>,
  dir    : vec2<f32>,
  params : vec4<u32>,
  color  : vec4<f32>,
};

struct Cell {
  pos : vec2<f32>,
};

struct Uniforms {
  cellSize      : f32,
  txtNoiseScale : f32,
  txtAngleMult  : f32,
  txtBoost      : f32,
  txtSpeedMin   : f32,
  txtSpeedMax   : f32,
  bgNoiseScale  : f32,
  bgAngleMult   : f32,
  bgSpeedMin    : f32,
  bgSpeedMax    : f32,
  txtShapeSize  : f32,
  bgShapeSize   : f32,
  time          : f32,
  canvasWidth   : f32,
  canvasHeight  : f32,
  maxTrail      : u32,
  textCellCount : u32,
  numParticles  : u32,
  _pad1         : u32,
};

@group(0) @binding(0) var<uniform> uni: Uniforms;
@group(0) @binding(1) var<storage, read_write> particles: array<Particle>;
@group(0) @binding(2) var<storage, read_write> trail: array<vec2<f32>>;
@group(0) @binding(3) var<storage, read> cells: array<Cell>;
@group(0) @binding(4) var txtFlow: texture_2d<f32>;
@group(0) @binding(5) var bgFlow: texture_2d<f32>;
@group(0) @binding(6) var textMask: texture_2d<f32>;

fn pcg(p: u32) -> u32 {
  var state = p * 747796405u + 2891336453u;
  var word = ((state >> ((state >> 28u) + 4u)) ^ state) * 277803737u;
  return (word >> 22u) ^ word;
}

fn randFloat(s: ptr<function, u32>) -> f32 {
  let v = pcg(*s);
  *s = v;
  return f32(v & 65535u) / 65535.0;
}

fn sampleFlow(tex: texture_2d<f32>, pos: vec2<f32>) -> vec2<f32> {
  let dim = textureDimensions(tex);
  let col = u32(clamp(pos.x / uni.cellSize, 0.0, f32(dim.x - 1)));
  let row = u32(clamp(pos.y / uni.cellSize, 0.0, f32(dim.y - 1)));
  return textureLoad(tex, vec2<i32>(i32(col), i32(row)), 0).rg;
}

fn reseed(p: ptr<function, Particle>, seed: ptr<function, u32>, isBg: u32) {
  if (uni.textCellCount > 0u) {
    let ci = u32(randFloat(seed) * f32(uni.textCellCount));
    let cellPos = cells[ci].pos;
    (*p).pos = cellPos + vec2(randFloat(seed), randFloat(seed)) * uni.cellSize;
  } else {
    (*p).pos = vec2(randFloat(seed) * uni.canvasWidth, randFloat(seed) * uni.canvasHeight);
  }
  (*p).prev = (*p).pos;
  let a = randFloat(seed) * 6.2832;
  let spd = select(uni.txtSpeedMin + randFloat(seed) * (uni.txtSpeedMax - uni.txtSpeedMin),
                   uni.bgSpeedMin + randFloat(seed) * (uni.bgSpeedMax - uni.bgSpeedMin),
                   isBg > 0u);
  (*p).dir = vec2(cos(a), sin(a));
  let trailStyle = u32(randFloat(seed) * 3.999);
  (*p).params = vec4(10u, 10u, 0u, isBg | (trailStyle << 1u));
}

@compute @workgroup_size(256)
fn main(@builtin(global_invocation_id) id: vec3<u32>) {
  let idx = id.x;
  if (idx >= uni.numParticles) { return; }

  var seed = idx * 1234567u + u32(uni.time * 1000.0);
  let p = &particles[idx];

  var age = (*p).params[0];
  let maxLen = (*p).params[1];
  var cursor = (*p).params[2];
  let isBg = (*p).params[3];

  if (age > 0u) {
    age = age - 1u;
  }

  if (age == 0u) {
    reseed(p, &seed, isBg);
    return;
  }

  let flow = select(
    sampleFlow(txtFlow, (*p).pos),
    sampleFlow(bgFlow, (*p).pos),
    isBg > 0u
  );
  let angle = (flow.r * 2.0 - 1.0) * 3.14159 * select(uni.txtAngleMult, uni.bgAngleMult, isBg > 0u);
  let inText = flow.g > 0.5;
  let boost = select(1.0, uni.txtBoost, inText && isBg == 0u);

  (*p).prev = (*p).pos;

  let dir = vec2(cos(angle), sin(angle));
  (*p).pos = (*p).pos + dir * boost;

  trail[idx * uni.maxTrail + cursor] = (*p).prev;
  cursor = (cursor + 1u) % uni.maxTrail;
  (*p).params[2] = cursor;

  if (isBg > 0u) {
    if ((*p).pos.x < 0.0 || (*p).pos.x > uni.canvasWidth || (*p).pos.y < 0.0 || (*p).pos.y > uni.canvasHeight) {
      age = 0u;
    }
  }

  (*p).params[0] = age;
}
`;

export function createComputePipeline(device) {
  const shader = device.createShaderModule({
    code: WGSL_COMPUTE,
  });

  const pipeline = device.createComputePipeline({
    layout: 'auto',
    compute: {
      module: shader,
      entryPoint: 'main',
    },
  });

  return pipeline;
}

export function createParticleBuffers(device, effect, count, isBg, maxTrail = 64) {
  const ef = effect;
  const particleSize = 64;
  const buf = new ArrayBuffer(count * particleSize);
  const floatView = new Float32Array(buf);
  const uintView = new Uint32Array(buf);

  for (let i = 0; i < count; i++) {
    const stride = particleSize / 4;
    const base = i * stride;

    const x = Math.random() * ef.width;
    const y = Math.random() * ef.height;
    floatView[base + 0] = x;
    floatView[base + 1] = y;
    floatView[base + 2] = x;
    floatView[base + 3] = y;
    floatView[base + 4] = 0;
    floatView[base + 5] = 0;

    const trailLen = Math.floor(
      (isBg ? S.bg.trailMin : S.txt.trailMin) +
      Math.random() * ((isBg ? S.bg.trailMax : S.txt.trailMax) - (isBg ? S.bg.trailMin : S.txt.trailMin))
    );
    uintView[base + 8] = trailLen * 2;
    uintView[base + 9] = trailLen;
    uintView[base + 10] = 0;
    const trailStyle = Math.floor(Math.random() * 4);
    uintView[base + 11] = (isBg ? 1 : 0) | (trailStyle << 1);

    floatView[base + 12] = 1;
    floatView[base + 13] = 1;
    floatView[base + 14] = 1;
    floatView[base + 15] = 1;
  }

  const buffer = device.createBuffer({
    size: count * particleSize,
    usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
  });
  device.queue.writeBuffer(buffer, 0, buf);

  const trailSize = count * maxTrail * 8;
  const trailBuffer = device.createBuffer({
    size: trailSize,
    usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST | GPUBufferUsage.COPY_SRC,
  });

  return { particles: buffer, trail: trailBuffer };
}
