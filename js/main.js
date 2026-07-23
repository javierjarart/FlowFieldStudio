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

effect.init().then(() => {
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

    const [r,g,b] = hexToRgb(S.bgColor);
    ctx.fillStyle = `rgba(${r},${g},${b},${S.fadeAlpha})`;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    effect.render(ctx);
    bus.emit('frame', { canvas, ctx });

    requestAnimationFrame(animate);
  }
  requestAnimationFrame(animate);
});
