import { CRASH_PENALTY_SECONDS } from './config.js';

export class RaceSession {
  constructor({ crashPenalty = CRASH_PENALTY_SECONDS } = {}) {
    this.crashPenalty = crashPenalty;
    this.reset();
  }

  reset() {
    this.elapsed = 0;
    this.penalty = 0;
    this.crashes = 0;
    this.misses = 0;
    this.sectorTimes = [];
  }

  tick(dt) {
    if (!Number.isFinite(dt) || dt <= 0) return;
    this.elapsed += dt;
  }

  addCrash() {
    this.crashes += 1;
    this.penalty += this.crashPenalty;
  }

  addMiss() {
    this.misses += 1;
  }

  recordSector() {
    const time = this.time;
    this.sectorTimes.push(time);
    return time;
  }

  get time() {
    return this.elapsed + this.penalty;
  }
}

export function getMedal(time, medals) {
  if (!Number.isFinite(time)) return null;
  return medals.find((medal) => time <= medal.time) || null;
}

export function formatDelta(delta) {
  if (!Number.isFinite(delta)) return '';
  const sign = delta <= 0 ? '\u2212' : '+';
  return `${sign}${Math.abs(delta).toFixed(2)}s`;
}
