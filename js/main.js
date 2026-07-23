import { S, bus, hexToRgb } from './state.js';
import { Effect } from './effect.js';
import { RecorderManager } from './recorder.js';
import { init } from './ui.js';

const canvas = document.getElementById('canvas1');
const ctx    = canvas.getContext('2d');
canvas.width  = window.innerWidth;
canvas.height = window.innerHeight;

const effect = new Effect(canvas, ctx);
const recorder = new RecorderManager(canvas);

init(effect, recorder);

(function initPointer() {
  let pointerDown = false;
  canvas.addEventListener('pointerdown', (e) => {
    if (S.distortion.enabled) {
      pointerDown = true;
      S.pointer = { x: e.offsetX, y: e.offsetY, down: true };
    }
  });
  canvas.addEventListener('pointermove', (e) => {
    S.pointer = { x: e.offsetX, y: e.offsetY, down: pointerDown };
  });
  canvas.addEventListener('pointerup', () => {
    pointerDown = false;
    S.pointer = { ...S.pointer, down: false };
  });
  canvas.addEventListener('pointerleave', () => {
    pointerDown = false;
    S.pointer = { ...S.pointer, down: false };
  });
})();

function drawBgGradient() {
  if (S.bgType === 'solid') {
    ctx.fillStyle = S.bgColor;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    return;
  }
  const colors = S.bgGradient.colors;
  if (colors.length < 2) return;
  let g;
  const w = canvas.width, h = canvas.height;
  if (S.bgType === 'linear') {
    if (S.bgGradient.dir === 'h') g = ctx.createLinearGradient(0, 0, w, 0);
    else if (S.bgGradient.dir === 'v') g = ctx.createLinearGradient(0, 0, 0, h);
    else g = ctx.createLinearGradient(0, 0, w, h);
  } else {
    const cx = w / 2, cy = h / 2;
    g = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.max(w, h) * 0.7);
  }
  for (let i = 0; i < colors.length; i++) {
    g.addColorStop(i / (colors.length - 1), colors[i]);
  }
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
}

bus.on('state:change', ({ key }) => {
  if (key === 'S.bgType' || key.startsWith('S.bgGradient') || key === 'S.bgColor') {
    drawBgGradient();
  }
});

window.addEventListener('resize', () => {
  drawBgGradient();
});

let cachedBgStyle = 'rgba(0,0,0,0.05)';

bus.on('state:change', ({ key }) => {
  if (key === 'S.bgColor' || key === 'S.fadeAlpha') {
    const [r,g,b] = hexToRgb(S.bgColor);
    cachedBgStyle = `rgba(${r},${g},${b},${S.fadeAlpha})`;
  }
});

effect.init().then(() => {
  drawBgGradient();

  let frameCount = 0, lastT = 0, fps = 60;

  function animate(t) {
    frameCount++;
    if (t - lastT >= 1000) {
      fps = frameCount; frameCount = 0; lastT = t;
      const fpsBadge = document.getElementById('fpsBadge');
      const ptxtBadge = document.getElementById('ptxtBadge');
      const pbgBadge = document.getElementById('pbgBadge');
      if (fpsBadge) fpsBadge.textContent = fps;
      if (ptxtBadge) ptxtBadge.textContent = effect.textParticles.length;
      if (pbgBadge) pbgBadge.textContent  = effect.bgParticles.length;
    }

    ctx.fillStyle = cachedBgStyle;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    effect.render(ctx);
    bus.emit('frame', { canvas, ctx });

    requestAnimationFrame(animate);
  }
  requestAnimationFrame(animate);
});
