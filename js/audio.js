import { S, bus } from './state.js';

export class AudioManager {
  constructor() {
    this.ctx = null;
    this.analyser = null;
    this.source = null;
    this.stream = null;
    this.dataArray = null;
    this.bands = { bass: 0, mid: 0, treble: 0 };
    this.beat = false;
    this._beatPrev = 0;
    this._enabled = false;
  }

  async start() {
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({ audio: true, echoCancellation: true });
      this.ctx = new AudioContext();
      this.source = this.ctx.createMediaStreamSource(this.stream);
      this.analyser = this.ctx.createAnalyser();
      this.analyser.fftSize = 256;
      this.analyser.smoothingTimeConstant = S.audio.smoothing || 0.8;
      this.source.connect(this.analyser);
      this.dataArray = new Uint8Array(this.analyser.frequencyBinCount);
      this._saveBaseValues();
      this._enabled = true;
      S.audio.enabled = true;
      bus.emit('audio:ready');
    } catch (e) {
      console.warn('Audio mic error:', e);
      bus.emit('audio:error', e);
    }
  }

  stop() {
    this._restoreBaseValues();
    if (this.stream) { this.stream.getTracks().forEach(t => t.stop()); this.stream = null; }
    if (this.ctx) { this.ctx.close(); this.ctx = null; }
    this.analyser = null;
    this.source = null;
    this.dataArray = null;
    this._enabled = false;
    S.audio.enabled = false;
  }

  get enabled() { return this._enabled; }

  update() {
    if (!this._enabled || !this.analyser || !S.audio.enabled) return;
    this.analyser.getByteFrequencyData(this.dataArray);
    const len = this.dataArray.length;
    const bassEnd = Math.max(1, Math.floor(len * 0.1));
    const midEnd = Math.max(bassEnd + 1, Math.floor(len * 0.4));

    let bassSum = 0, midSum = 0, trebleSum = 0;
    for (let i = 0; i < len; i++) {
      const v = this.dataArray[i];
      if (i < bassEnd) bassSum += v;
      else if (i < midEnd) midSum += v;
      else trebleSum += v;
    }
    const SCALE = 1 / 255;
    this.bands.bass = Math.min(1, (bassSum / bassEnd) * SCALE);
    this.bands.mid = Math.min(1, (midSum / Math.max(1, midEnd - bassEnd)) * SCALE);
    this.bands.treble = Math.min(1, (trebleSum / Math.max(1, len - midEnd)) * SCALE);

    const bass = this.bands.bass;
    const threshold = 0.5 + (S.audio.sensitivity || 0.5) * 0.4;
    const wasBeat = this.beat;
    this.beat = bass > threshold && this._beatPrev <= threshold;
    this._beatPrev = bass;
    if (this.beat && !wasBeat) bus.emit('audio:beat');

    this._applyMapping(S.audio.mapping || []);
  }

  _applyMapping(mappings) {
    for (const m of mappings) {
      const val = this.bands[m.band];
      if (val === undefined) continue;
      const mapped = m.min + val * (m.max - m.min);
      const path = m.target.split('.');
      let obj = S;
      for (let i = 0; i < path.length - 1; i++) {
        obj = obj[path[i]];
        if (!obj) break;
      }
      if (obj && typeof obj[path[path.length - 1]] === 'number') {
        obj[path[path.length - 1]] = mapped;
      }
    }
  }

  _saveBaseValues() {
    this._baseValues = {};
    for (const m of (S.audio.mapping || [])) {
      const path = m.target.split('.');
      let obj = S;
      for (let i = 0; i < path.length; i++) {
        if (obj == null) break;
        if (i === path.length - 1) this._baseValues[m.target] = obj[path[i]];
        else obj = obj[path[i]];
      }
    }
  }

  _restoreBaseValues() {
    if (!this._baseValues) return;
    for (const [target, val] of Object.entries(this._baseValues)) {
      const path = target.split('.');
      let obj = S;
      for (let i = 0; i < path.length - 1; i++) {
        obj = obj[path[i]];
        if (!obj) break;
      }
      if (obj && typeof obj[path[path.length - 1]] === 'number') {
        obj[path[path.length - 1]] = val;
      }
    }
    this._baseValues = null;
  }

  destroy() { this.stop(); }
}
