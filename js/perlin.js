const _p = (() => {
  const perm = Array.from({ length: 256 }, (_, i) => i);
  for (let i = 255; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [perm[i], perm[j]] = [perm[j], perm[i]];
  }
  return [...perm, ...perm];
})();

function _fade(t) { return t * t * t * (t * (t * 6 - 15) + 10); }
function _lerp(t, a, b) { return a + t * (b - a); }
function _grad(h, x, y) {
  const hh = h & 3;
  const u = hh < 2 ? x : y;
  const v = hh < 2 ? y : x;
  return ((hh & 1) ? -u : u) + ((hh & 2) ? -v : v);
}

export function noise(x, y) {
  const X = Math.floor(x) & 255;
  const Y = Math.floor(y) & 255;
  x -= Math.floor(x);
  y -= Math.floor(y);
  const u = _fade(x);
  const v = _fade(y);
  const a = _p[X] + Y;
  const b = _p[X + 1] + Y;
  return _lerp(v,
    _lerp(u, _grad(_p[a], x, y), _grad(_p[b], x - 1, y)),
    _lerp(u, _grad(_p[a + 1], x, y - 1), _grad(_p[b + 1], x - 1, y - 1))
  ) * 0.5 + 0.5;
}
