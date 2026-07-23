import { S, bus } from './state.js';

// ── Estados de grabación ──────────────────────────────────────────────
class IdleState {
  constructor(mgr) { this.mgr = mgr; }
  get label() { return 'IDLE'; }

  start() {
    if (!this.mgr.canvas) return;
    const fps = S.recorderFps;
    try {
      this.mgr.stream = this.mgr.canvas.captureStream(fps);
      const mimeType = MediaRecorder.isTypeSupported('video/webm; codecs=vp9')
        ? 'video/webm; codecs=vp9'
        : 'video/webm; codecs=vp8';
      this.mgr.recorder = new MediaRecorder(this.mgr.stream, { mimeType });
      this.mgr.chunks = [];
      this.mgr.startTime = Date.now();

      this.mgr.recorder.ondataavailable = e => {
        if (e.data.size > 0) this.mgr.chunks.push(e.data);
      };

      this.mgr.recorder.onstop = () => {
        this.mgr.transitionTo(new ExportingState(this.mgr));
        this.mgr.state.done();
      };

      this.mgr.recorder.onerror = () => {
        console.error('MediaRecorder error');
        this.mgr.transitionTo(new IdleState(this.mgr));
      };

      this.mgr.recorder.start(1000);
      this.mgr.transitionTo(new RecordingState(this.mgr));
      bus.emit('recorder:start', { fps, mimeType });
    } catch (err) {
      console.error('Failed to start recording:', err);
    }
  }

  stop() {}
}

class RecordingState {
  constructor(mgr) { this.mgr = mgr; }
  get label() { return 'RECORDING'; }

  start() {}

  stop() {
    if (this.mgr.recorder && this.mgr.recorder.state === 'recording') {
      this.mgr.recorder.stop();
    }
  }
}

class ExportingState {
  constructor(mgr) { this.mgr = mgr; }
  get label() { return 'EXPORTING'; }

  start() {}
  stop() {}

  done() {
    const chunks = this.mgr.chunks;
    if (!chunks.length) {
      this.mgr.transitionTo(new IdleState(this.mgr));
      return;
    }
    const blob = new Blob(chunks, { type: 'video/webm' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const ts = new Date().toISOString().slice(0, 19).replace(/[:-]/g, '');
    a.download = `flow-field-${ts}.webm`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    this.mgr.chunks = [];
    this.mgr.transitionTo(new IdleState(this.mgr));
    bus.emit('recorder:export', { size: blob.size });
  }
}

// ── Administrador de grabación ────────────────────────────────────────
export class RecorderManager {
  constructor(canvas) {
    this.canvas = canvas;
    this.stream = null;
    this.recorder = null;
    this.chunks = [];
    this.startTime = 0;
    this.state = new IdleState(this);
    this._timer = null;

    bus.on('effect:init', () => {
      if (this.state.label !== 'RECORDING') return;
      this.state.stop();
    });
  }

  transitionTo(newState) {
    this.state = newState;
    bus.emit('recorder:state', { state: this.state.label });
  }

  start() { this.state.start(); }
  stop()  { this.state.stop(); }

  get isRecording() {
    return this.state instanceof RecordingState;
  }

  get elapsed() {
    if (!this.startTime) return 0;
    return Date.now() - this.startTime;
  }
}
