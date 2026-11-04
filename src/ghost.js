const DEFAULT_INTERVAL = 1 / 12;
const MAX_SAMPLES = 6000;

function quantize(value, digits = 3) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

export function sanitizeGhostSamples(value) {
  if (!Array.isArray(value)) return [];

  const samples = [];
  for (const sample of value) {
    if (!sample || !Number.isFinite(sample.t) || sample.t < 0) continue;
    if (!['x', 'y', 'z', 'pitch', 'yaw', 'roll'].every((key) => Number.isFinite(sample[key]))) {
      continue;
    }

    samples.push({
      t: quantize(sample.t),
      x: quantize(sample.x),
      y: quantize(sample.y),
      z: quantize(sample.z),
      pitch: quantize(sample.pitch, 4),
      yaw: quantize(sample.yaw, 4),
      roll: quantize(sample.roll, 4)
    });

    if (samples.length >= MAX_SAMPLES) break;
  }

  return samples;
}

export class GhostRecorder {
  constructor(interval = DEFAULT_INTERVAL) {
    this.interval = interval;
    this.reset();
  }

  reset() {
    this.samples = [];
    this.nextTime = 0;
  }

  capture(time, transform, force = false) {
    if (!Number.isFinite(time) || time < 0) return false;
    if (!force && this.samples.length > 0 && time + 1e-6 < this.nextTime) {
      return false;
    }
    if (this.samples.length >= MAX_SAMPLES) return false;

    this.samples.push({
      t: quantize(time),
      x: quantize(transform.x),
      y: quantize(transform.y),
      z: quantize(transform.z),
      pitch: quantize(transform.pitch, 4),
      yaw: quantize(transform.yaw, 4),
      roll: quantize(transform.roll, 4)
    });

    this.nextTime = time + this.interval;
    return true;
  }
}

export class GhostPlayer {
  constructor() {
    this.samples = [];
    this.index = 0;
  }

  setSamples(samples) {
    this.samples = sanitizeGhostSamples(samples);
    this.index = 0;
  }

  update(time) {
    if (this.samples.length === 0 || !Number.isFinite(time)) return null;

    while (
      this.index < this.samples.length - 2
      && this.samples[this.index + 1].t <= time
    ) {
      this.index++;
    }

    const current = this.samples[this.index];
    const next = this.samples[this.index + 1];

    if (!next || time <= current.t) return current;

    const span = next.t - current.t;
    if (span <= 0) return next;

    const alpha = Math.min(1, Math.max(0, (time - current.t) / span));
    return {
      t: time,
      x: current.x + (next.x - current.x) * alpha,
      y: current.y + (next.y - current.y) * alpha,
      z: current.z + (next.z - current.z) * alpha,
      pitch: current.pitch + (next.pitch - current.pitch) * alpha,
      yaw: current.yaw + (next.yaw - current.yaw) * alpha,
      roll: current.roll + (next.roll - current.roll) * alpha
    };
  }
}
