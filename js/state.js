import { EventBus } from './event-bus.js';

export const bus = new EventBus();

function reactive(obj, path = '') {
  const handler = {
    set(target, key, value) {
      const old = target[key];
      if (old === value) return true;
      target[key] = value;
      const keyPath = path ? `${path}.${String(key)}` : String(key);
      bus.emit('state:change', { key: keyPath, value, old });
      return true;
    }
  };
  const wrapped = {};
  for (const k of Object.keys(obj)) {
    if (obj[k] !== null && typeof obj[k] === 'object' && !Array.isArray(obj[k])) {
      wrapped[k] = reactive(obj[k], path ? `${path}.${k}` : k);
    } else {
      wrapped[k] = obj[k];
    }
  }
  return new Proxy(wrapped, handler);
}

export const S = reactive({
  sourceMode:    'text',
  text:          'FLWR',
  fontFamily:    'Arial Black, Arial, sans-serif',
  fontWeight:    '900',
  fontSize:      280,
  letterSpacing: 0,
  colorMode:     'gradient',
  solidColor:    '#ffffff',
  gradColors:    ['#F67D31','#DE1A58','#8F0177','#1A05A2'],
  gradDir:       'h',
  bleedRadius:   0,

  txt: {
    count:       2000,
    speedMin:    1,
    speedMax:    3,
    trailMin:    2,
    trailMax:    10,
    lineWidth:   1.0,
    opacity:     1.0,
    colorMode:   'image',
    solidColor:  '#ff6600',
    noiseScale:  500,
    angleMult:   4,
    boost:       3,
    shape:       'trail',
    shapeSize:   1.0,
    trailStyle:  'random',
  },

  bg: {
    enabled:     true,
    count:       400,
    speedMin:    0.5,
    speedMax:    1.5,
    trailMin:    2,
    trailMax:    10,
    lineWidth:   0.5,
    opacity:     0.4,
    color:       '#4466aa',
    avoidText:   true,
    noiseScale:  800,
    angleMult:   2,
    shape:       'trail',
    shapeSize:   0.8,
    trailStyle:  'random',
  },

  fadeAlpha:  0.05,
  bgColor:    '#000000',
  blendMode:  'source-over',
  cellSize:   5,
  bgImage:    null,
  bgImgOpac:  0.8,
  showBgImg:  false,
  debug:      false,
  debugImg:   false,

  recording: false,
  recorderFps: 30,

  distortion: {
    enabled: true,
    radius: 120,
    strength: 3,
  },
  pointer: { x: 0, y: 0, down: false },
  bgType: 'solid',
  bgGradient: {
    colors: ['#000000', '#1a1a2e', '#16213e'],
    dir: 'v',
  },
});

export function hexToRgb(hex) {
  const n = parseInt(hex.replace('#',''), 16);
  return [(n>>16)&255, (n>>8)&255, n&255];
}
