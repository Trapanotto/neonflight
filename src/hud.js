import { formatTime } from './utils.js';

export class HUD {
  constructor() {
    this.root = document.getElementById('hud');
    this.speed = document.getElementById('speed');
    this.altitude = document.getElementById('altitude');
    this.timer = document.getElementById('timer');
    this.progress = document.getElementById('progress');
    this.best = document.getElementById('best');
    this.menuBest = document.getElementById('menu-best');
    this.boostFill = document.getElementById('boost-fill');
    this.message = document.getElementById('message');
    this.startScreen = document.getElementById('start-screen');
    this.finishScreen = document.getElementById('finish-screen');
    this.finishTime = document.getElementById('finish-time');
    this.finishBest = document.getElementById('finish-best');
    this.flashLayer = document.getElementById('flash');
    this.messageTimer = null;
    this.flashTimer = null;
  }

  showHud(visible) {
    this.root.classList.toggle('hidden', !visible);
  }

  showStart(visible) {
    this.startScreen.classList.toggle('hidden', !visible);
  }

  showFinish(visible) {
    this.finishScreen.classList.toggle('hidden', !visible);
  }

  update({ speed, altitude, time, ring, total, best, boost }) {
    this.speed.textContent = Math.round(speed * 3.6);
    this.altitude.textContent = Math.round(altitude);
    this.timer.textContent = formatTime(Math.max(0, time));
    this.progress.textContent = `RING ${String(Math.min(ring + 1, total)).padStart(2, '0')} / ${String(total).padStart(2, '0')}`;
    this.best.textContent = formatTime(best);
    if (this.menuBest) this.menuBest.textContent = formatTime(best);
    this.boostFill.style.width = `${Math.round(boost * 100)}%`;
  }

  setBest(best) {
    this.best.textContent = formatTime(best);
    if (this.menuBest) this.menuBest.textContent = formatTime(best);
  }

  showMessage(text, { duration = 1400, warn = false } = {}) {
    this.message.textContent = text;
    this.message.classList.toggle('warn', warn);
    this.message.classList.add('show');

    if (this.messageTimer) window.clearTimeout(this.messageTimer);
    this.messageTimer = window.setTimeout(() => {
      this.message.classList.remove('show');
    }, duration);
  }

  flash() {
    this.flashLayer.classList.add('hit');
    if (this.flashTimer) window.clearTimeout(this.flashTimer);
    this.flashTimer = window.setTimeout(() => {
      this.flashLayer.classList.remove('hit');
    }, 90);
  }

  showResult({ time, best, isRecord }) {
    this.finishTime.textContent = formatTime(time);
    this.finishBest.textContent = isRecord ? 'NEW RECORD' : `BEST ${formatTime(best)}`;
    this.showFinish(true);
  }

  hideResult() {
    this.showFinish(false);
  }
}
