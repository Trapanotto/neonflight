const STEP_DURATION = 60 / 96 / 4;
const BASS_PATTERN = [0, 3, 6, 8, 11, 14];
const ARP_PATTERN = [0, 7, 12, 15, 12, 7, 3, 10];
const ROOTS = [55, 43.65, 65.41, 49.0];

function midiToFrequency(semitones, root) {
  return root * Math.pow(2, semitones / 12);
}

export class AudioSystem {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.musicGain = null;
    this.effectsGain = null;
    this.engine = null;
    this.wind = null;
    this.noiseBuffer = null;
    this.muted = false;
    this.musicStep = 0;
    this.musicNextTime = 0;
    this.musicTimer = null;
    this.volume = 0.62;
    this.musicVolume = 0.75;
    this.effectsVolume = 0.85;
    this.paused = false;
  }

  updateMasterGain() {
    if (!this.master || !this.ctx) return;
    const target = this.muted || this.paused ? 0 : this.volume;
    this.master.gain.setTargetAtTime(target, this.ctx.currentTime, 0.05);
  }

  setPaused(paused) {
    this.paused = Boolean(paused);
    this.updateMasterGain();
  }

  setMuted(muted) {
    this.muted = Boolean(muted);
    this.updateMasterGain();
    return this.muted;
  }

  setVolumes({ music, effects }) {
    if (Number.isFinite(music)) this.musicVolume = Math.min(1, Math.max(0, music));
    if (Number.isFinite(effects)) this.effectsVolume = Math.min(1, Math.max(0, effects));

    if (!this.ctx) return;
    if (this.musicGain) {
      this.musicGain.gain.setTargetAtTime(0.42 * this.musicVolume, this.ctx.currentTime, 0.05);
    }
    if (this.effectsGain) {
      this.effectsGain.gain.setTargetAtTime(this.effectsVolume, this.ctx.currentTime, 0.05);
    }
  }

  async init() {
    if (!this.ctx) {
      const Context = window.AudioContext || window.webkitAudioContext;
      if (!Context) return;
      this.ctx = new Context();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.muted || this.paused ? 0 : this.volume;
      this.master.connect(this.ctx.destination);

      this.effectsGain = this.ctx.createGain();
      this.effectsGain.gain.value = this.effectsVolume;
      this.effectsGain.connect(this.master);

      this.noiseBuffer = this.createNoiseBuffer();
      this.engine = this.createEngine();
      this.wind = this.createWind();
      this.musicGain = this.ctx.createGain();
      this.musicGain.gain.value = 0.42 * this.musicVolume;
      this.musicGain.connect(this.master);

      this.musicNextTime = this.ctx.currentTime + 0.2;
      this.musicTimer = window.setInterval(() => this.scheduleMusic(), 90);
    }

    if (this.ctx.state === 'suspended') {
      await this.ctx.resume();
    }
  }

  createNoiseBuffer() {
    const length = Math.floor(this.ctx.sampleRate * 2);
    const buffer = this.ctx.createBuffer(1, length, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    return buffer;
  }

  createEngine() {
    const output = this.ctx.createGain();
    output.gain.value = 0;
    output.connect(this.effectsGain);

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 220;
    filter.Q.value = 4;
    filter.connect(output);

    const main = this.ctx.createOscillator();
    main.type = 'sawtooth';
    main.frequency.value = 55;
    main.connect(filter);
    main.start();

    const sub = this.ctx.createOscillator();
    sub.type = 'sine';
    sub.frequency.value = 28;
    const subGain = this.ctx.createGain();
    subGain.gain.value = 0.9;
    sub.connect(subGain);
    subGain.connect(output);
    sub.start();

    return { output, filter, main, sub };
  }

  createWind() {
    const source = this.ctx.createBufferSource();
    source.buffer = this.noiseBuffer;
    source.loop = true;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 700;
    filter.Q.value = 0.7;

    const gain = this.ctx.createGain();
    gain.gain.value = 0;

    source.connect(filter);
    filter.connect(gain);
    gain.connect(this.effectsGain);
    source.start();

    return { source, filter, gain };
  }

  updateEngine(throttle, speedRatio, boostRatio) {
    if (!this.ctx || !this.engine) return;
    const now = this.ctx.currentTime;
    const rpm = 44 + throttle * 58 + speedRatio * 22 + boostRatio * 18;

    this.engine.main.frequency.setTargetAtTime(rpm, now, 0.08);
    this.engine.sub.frequency.setTargetAtTime(rpm * 0.5, now, 0.08);
    this.engine.filter.frequency.setTargetAtTime(140 + throttle * 520 + boostRatio * 380, now, 0.1);
    this.engine.output.gain.setTargetAtTime(0.028 + throttle * 0.055 + boostRatio * 0.03, now, 0.12);

    if (this.wind) {
      this.wind.filter.frequency.setTargetAtTime(600 + speedRatio * 900, now, 0.2);
      this.wind.gain.gain.setTargetAtTime(0.004 + speedRatio * 0.045 + boostRatio * 0.03, now, 0.2);
    }
  }

  playNoiseBurst({ duration = 0.3, from = 1200, to = 200, gain = 0.3, type = 'lowpass' } = {}) {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    const source = this.ctx.createBufferSource();
    source.buffer = this.noiseBuffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = type;
    filter.frequency.setValueAtTime(from, now);
    filter.frequency.exponentialRampToValueAtTime(Math.max(40, to), now + duration);

    const gainNode = this.ctx.createGain();
    gainNode.gain.setValueAtTime(gain, now);
    gainNode.gain.exponentialRampToValueAtTime(0.001, now + duration);

    source.connect(filter);
    filter.connect(gainNode);
    gainNode.connect(this.effectsGain);
    source.start(now);
    source.stop(now + duration + 0.02);
  }

  chime(index = 0) {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    const base = 740 + (index % 6) * 90;
    [1, 1.5].forEach((ratio, i) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = base * ratio;
      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(0.09 / (i + 1), now + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);
      osc.connect(gain);
      gain.connect(this.effectsGain);
      osc.start(now);
      osc.stop(now + 0.44);
    });
  }

  miss() {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(180, now);
    osc.frequency.exponentialRampToValueAtTime(95, now + 0.18);
    gain.gain.setValueAtTime(0.07, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
    osc.connect(gain);
    gain.connect(this.effectsGain);
    osc.start(now);
    osc.stop(now + 0.22);
  }

  checkpoint() {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    [523.25, 659.25, 783.99].forEach((frequency, index) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.value = frequency;
      const start = now + index * 0.07;
      gain.gain.setValueAtTime(0, start);
      gain.gain.linearRampToValueAtTime(0.1, start + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.5);
      osc.connect(gain);
      gain.connect(this.effectsGain);
      osc.start(start);
      osc.stop(start + 0.55);
    });
  }

  boostWhoosh() {
    this.playNoiseBurst({ duration: 0.45, from: 420, to: 2400, gain: 0.22, type: 'bandpass' });
  }

  crash() {
    this.playNoiseBurst({ duration: 0.6, from: 1600, to: 90, gain: 0.42 });
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(110, now);
    osc.frequency.exponentialRampToValueAtTime(28, now + 0.5);
    gain.gain.setValueAtTime(0.18, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.5);
    osc.connect(gain);
    gain.connect(this.effectsGain);
    osc.start(now);
    osc.stop(now + 0.55);
  }

  finish() {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    [392, 523.25, 659.25, 783.99, 1046.5].forEach((frequency, index) => {
      const start = now + index * 0.1;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.value = frequency;
      gain.gain.setValueAtTime(0, start);
      gain.gain.linearRampToValueAtTime(0.12, start + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.7);
      osc.connect(gain);
      gain.connect(this.effectsGain);
      osc.start(start);
      osc.stop(start + 0.75);
    });
  }

  scheduleMusic() {
    if (!this.ctx || !this.musicGain) return;
    const now = this.ctx.currentTime;

    if (this.musicNextTime < now - 0.5) {
      this.musicNextTime = now + 0.05;
    }

    while (this.musicNextTime < now + 0.18) {
      const time = this.musicNextTime;
      const step = this.musicStep;
      const bar = Math.floor(step / 16) % 4;
      const root = ROOTS[bar];

      if (step % 4 === 0) this.musicKick(time);
      if (step % 8 === 4) this.musicSnare(time);
      if (step % 16 === 0) this.musicPad(time, root);
      if (BASS_PATTERN.includes(step % 16)) this.musicBass(time, midiToFrequency(BASS_PATTERN[(step + 3) % BASS_PATTERN.length], root));
      if (step % 2 === 0) {
        const semitone = ARP_PATTERN[Math.floor(step / 2) % ARP_PATTERN.length];
        this.musicArp(time, midiToFrequency(semitone + 24, root));
      }

      this.musicStep = (step + 1) % 64;
      this.musicNextTime += STEP_DURATION;
    }
  }

  musicKick(time) {
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(135, time);
    osc.frequency.exponentialRampToValueAtTime(42, time + 0.16);
    gain.gain.setValueAtTime(0.5, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.22);
    osc.connect(gain);
    gain.connect(this.musicGain);
    osc.start(time);
    osc.stop(time + 0.24);
  }

  musicSnare(time) {
    const source = this.ctx.createBufferSource();
    source.buffer = this.noiseBuffer;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.value = 1400;
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.1, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.16);
    source.connect(filter);
    filter.connect(gain);
    gain.connect(this.musicGain);
    source.start(time);
    source.stop(time + 0.18);
  }

  musicBass(time, frequency) {
    const osc = this.ctx.createOscillator();
    const filter = this.ctx.createBiquadFilter();
    const gain = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.value = frequency;
    filter.type = 'lowpass';
    filter.frequency.value = 240;
    gain.gain.setValueAtTime(0.12, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.22);
    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.musicGain);
    osc.start(time);
    osc.stop(time + 0.24);
  }

  musicArp(time, frequency) {
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.value = frequency;
    gain.gain.setValueAtTime(0.045, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.2);
    osc.connect(gain);
    gain.connect(this.musicGain);
    osc.start(time);
    osc.stop(time + 0.22);
  }

  musicPad(time, root) {
    [0.995, 1.005].forEach((detune) => {
      const osc = this.ctx.createOscillator();
      const filter = this.ctx.createBiquadFilter();
      const gain = this.ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.value = root * 2 * detune;
      filter.type = 'lowpass';
      filter.frequency.value = 680;
      gain.gain.setValueAtTime(0, time);
      gain.gain.linearRampToValueAtTime(0.03, time + 0.4);
      gain.gain.linearRampToValueAtTime(0.0001, time + 2.4);
      osc.connect(filter);
      filter.connect(gain);
      gain.connect(this.musicGain);
      osc.start(time);
      osc.stop(time + 2.5);
    });
  }

  toggleMute() {
    return this.setMuted(!this.muted);
  }
}
