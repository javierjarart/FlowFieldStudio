export class EventBus {
  constructor() {
    this._listeners = {};
  }

  on(event, callback) {
    if (!this._listeners[event]) this._listeners[event] = [];
    this._listeners[event].push(callback);
    return () => this.off(event, callback);
  }

  off(event, callback) {
    const cbs = this._listeners[event];
    if (!cbs) return;
    const i = cbs.indexOf(callback);
    if (i !== -1) cbs.splice(i, 1);
  }

  emit(event, data) {
    const cbs = this._listeners[event];
    if (cbs) cbs.forEach(fn => fn(data));
  }
}
