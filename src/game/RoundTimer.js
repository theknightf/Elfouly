/** Deadline-based timer helpers shared by all timed game modes. */
export class RoundTimer {
  constructor(onTick, onExpire, tickMs = 200) {
    this.onTick = onTick;
    this.onExpire = onExpire;
    this.tickMs = tickMs;
    this.interval = null;
    this.endTime = null;
    this.expired = false;
  }

  start(durationSeconds, onTick = this.onTick, onExpire = this.onExpire) {
    this.cancel();
    this.onTick = onTick;
    this.onExpire = onExpire;
    this.endTime = Date.now() + Math.max(0, durationSeconds) * 1000;
    this.expired = false;
    this.tick();
    this.interval = setInterval(() => this.tick(), this.tickMs);
    return this.endTime;
  }

  tick() {
    if (this.endTime == null || this.expired) return;
    const remaining = Math.max(0, this.endTime - Date.now());
    this.onTick?.(remaining);
    if (remaining === 0) {
      this.expired = true;
      this.cancelInterval();
      this.onExpire?.();
    }
  }

  cancelInterval() {
    if (this.interval != null) clearInterval(this.interval);
    this.interval = null;
  }

  cancel() {
    this.cancelInterval();
    this.endTime = null;
    this.expired = false;
  }

  dispose() {
    this.cancel();
    this.onTick = null;
    this.onExpire = null;
  }

  static remaining(endTime) {
    return endTime ? Math.max(0, Math.ceil((endTime - Date.now()) / 1000)) : 0;
  }
}

