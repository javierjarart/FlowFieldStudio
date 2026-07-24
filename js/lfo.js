import { S } from './state.js';

let _nextId = 1;

const _WAVEFORMS = {
  sine:     t => Math.sin(t * Math.PI * 2),
  square:   t => Math.sin(t * Math.PI * 2) >= 0 ? 1 : -1,
  saw:      t => ((t * 2) % 2) - 1,
  triangle: t => Math.abs(((t * 2) % 2) - 1) * 2 - 1,
};

export class LFO {
  constructor(cfg = {}) {
    this.id = cfg.id != null ? cfg.id : _nextId++;
    this.waveform = cfg.waveform || 'sine';
    this.frequency = cfg.frequency || 0.5;
    this.amplitude = cfg.amplitude || 1;
    this.offset = cfg.offset || 0;
    this.target = cfg.target || '';
    this.enabled = cfg.enabled !== false;
    this._phase = 0;
  }

  update(dt) {
    if (!this.enabled || !this.target) return;
    this._phase += dt * this.frequency;
    const fn = _WAVEFORMS[this.waveform] || _WAVEFORMS.sine;
    const raw = fn(this._phase);
    const val = raw * this.amplitude + this.offset;
    const path = this.target.split('.');
    let obj = S;
    for (let i = 0; i < path.length - 1; i++) {
      obj = obj[path[i]];
      if (!obj) return;
    }
    const lastKey = path[path.length - 1];
    if (obj && typeof obj[lastKey] === 'number') {
      obj[lastKey] = val;
    }
  }
}

export class LFOManager {
  constructor() {
    this.lfos = [];
  }

  initFromState() {
    this.lfos = (S.lfos || []).map(cfg => new LFO(cfg));
  }

  syncToState() {
    S.lfos = this.lfos.map(l => ({
      id: l.id, waveform: l.waveform, frequency: l.frequency,
      amplitude: l.amplitude, offset: l.offset, target: l.target, enabled: l.enabled,
    }));
  }

  addLFO(cfg) {
    const lfo = new LFO(cfg);
    this.lfos.push(lfo);
    this.syncToState();
    return lfo;
  }

  removeLFO(id) {
    const idx = this.lfos.findIndex(l => l.id === id);
    if (idx >= 0) { this.lfos.splice(idx, 1); this.syncToState(); }
  }

  update(dt) {
    for (const lfo of this.lfos) lfo.update(dt);
  }

  getWaveformValue(lfo) {
    const fn = _WAVEFORMS[lfo.waveform] || _WAVEFORMS.sine;
    return fn(lfo._phase);
  }
}
