import { CRASH_PENALTY_SECONDS } from './config.js';
import { formatTime } from './utils.js';
import { formatDelta } from './race.js';

export class HUD {
  constructor() {
    this.root = document.getElementById('hud');
    this.speed = document.getElementById('speed');
    this.altitude = document.getElementById('altitude');
    this.timer = document.getElementById('timer');
    this.progress = document.getElementById('progress');
    this.best = document.getElementById('best');
    this.menuBest = document.getElementById('menu-best');
    this.menuMedal = document.getElementById('menu-medal');
    this.boostFill = document.getElementById('boost-fill');
    this.message = document.getElementById('message');
    this.startScreen = document.getElementById('start-screen');
    this.finishScreen = document.getElementById('finish-screen');
    this.pauseScreen = document.getElementById('pause-screen');
    this.settingsScreen = document.getElementById('settings-screen');
    this.finishTime = document.getElementById('finish-time');
    this.finishBest = document.getElementById('finish-best');
    this.finishMedal = document.getElementById('finish-medal');
    this.finishStats = document.getElementById('finish-stats');
    this.finishChallenge = document.getElementById('finish-challenge');
    this.shareStatus = document.getElementById('share-status');
    this.flashLayer = document.getElementById('flash');
    this.ringGuide = document.getElementById('ring-guide');
    this.ringGuideArrow = document.getElementById('ring-guide-arrow');
    this.ringGuideDistance = document.getElementById('ring-guide-distance');
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

  showPause(visible) {
    this.pauseScreen.classList.toggle('hidden', !visible);
  }

  showSettings(visible) {
    this.settingsScreen.classList.toggle('hidden', !visible);
  }

  update({ speed, altitude, time, ring, total, best, boost, distance, guide }) {
    this.speed.textContent = Math.round(speed * 3.6);
    this.altitude.textContent = Math.round(altitude);
    this.timer.textContent = formatTime(Math.max(0, time));
    this.progress.textContent = `RING ${String(Math.min(ring + 1, total)).padStart(2, '0')} / ${String(total).padStart(2, '0')} · ${Math.round(distance)} M`;
    this.best.textContent = formatTime(best);
    if (this.menuBest) this.menuBest.textContent = formatTime(best);
    this.boostFill.style.width = `${Math.round(boost * 100)}%`;
    this.updateGuide(guide, distance);
  }

  updateGuide(guide, distance) {
    if (!guide || !guide.visible) {
      this.ringGuide.classList.add('hidden');
      return;
    }

    this.ringGuide.classList.remove('hidden');
    this.ringGuideArrow.style.transform = `rotate(${guide.angle}rad)`;
    this.ringGuideDistance.textContent = `${Math.round(distance)} M`;
  }

  setBest(best, medal = null) {
    this.best.textContent = formatTime(best);
    if (this.menuBest) this.menuBest.textContent = formatTime(best);

    if (this.menuMedal) {
      this.menuMedal.textContent = medal ? medal.label : '';
      this.menuMedal.className = `medal-badge${medal ? ` ${medal.id}` : ''}`;
    }
  }

  showMessage(text, { duration = 1400, warn = false, miss = false } = {}) {
    this.message.textContent = text;
    this.message.classList.toggle('warn', warn);
    this.message.classList.toggle('miss', miss);
    this.message.classList.add('show');

    if (this.messageTimer) window.clearTimeout(this.messageTimer);
    this.messageTimer = window.setTimeout(() => {
      this.message.classList.remove('show');
    }, duration);
  }

  clearMessage() {
    if (this.messageTimer) window.clearTimeout(this.messageTimer);
    this.message.classList.remove('show', 'warn', 'miss');
    this.message.textContent = '';
  }

  flash() {
    this.flashLayer.classList.add('hit');
    if (this.flashTimer) window.clearTimeout(this.flashTimer);
    this.flashTimer = window.setTimeout(() => {
      this.flashLayer.classList.remove('hit');
    }, 90);
  }

  showResult({ time, best, isRecord, previousBest, medal, crashes, misses = 0, challenge = null }) {
    const delta = Number.isFinite(previousBest) ? time - previousBest : null;
    const stats = [];

    if (crashes > 0) {
      stats.push(`${crashes} ${crashes === 1 ? 'CRASH' : 'CRASHES'}`);
    }
    if (misses > 0) {
      stats.push(`${misses} MISSED`);
    }
    if (crashes > 0) {
      stats.push(`${(crashes * CRASH_PENALTY_SECONDS).toFixed(0)}s PENALTY`);
    }
    if (stats.length === 0) {
      stats.push('CLEAN RUN');
    }

    this.finishTime.textContent = formatTime(time);
    this.finishMedal.textContent = medal ? medal.label : 'FINISHED';
    this.finishMedal.className = `result-medal${medal ? ` ${medal.id}` : ''}`;
    this.finishStats.textContent = stats.join(' · ');

    if (isRecord) {
      this.finishBest.textContent = delta === null
        ? 'NEW RECORD'
        : `NEW RECORD · ${formatDelta(delta)}`;
    } else {
      this.finishBest.textContent = `BEST ${formatTime(best)} · ${formatDelta(delta)}`;
    }

    if (challenge) {
      this.finishChallenge.textContent = challenge.beaten
        ? `CHALLENGE BEATEN // TARGET ${formatTime(challenge.target)}`
        : `CHALLENGE MISSED // TARGET ${formatTime(challenge.target)}`;
      this.finishChallenge.className = `result-challenge${challenge.beaten ? ' beaten' : ''}`;
    } else {
      this.finishChallenge.textContent = '';
      this.finishChallenge.className = 'result-challenge hidden';
    }

    this.shareStatus.textContent = '';
    this.showFinish(true);
  }

  setShareStatus(text) {
    this.shareStatus.textContent = text;
  }

  hideResult() {
    this.showFinish(false);
  }
}
