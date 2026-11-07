// Procedural chiptune music + juicy synth sound effects (no audio files).
const BPM = 116;
const STEPS_PER_BAR = 16;
const BARS = 4;
const TOTAL_STEPS = STEPS_PER_BAR * BARS;

const PROGRESSION = [
  { root: 48, chord: [60, 64, 67, 71], lead: [72, 0, 76, 79, 0, 76, 74, 0, 72, 0, 74, 76, 0, 0, 72, 0] },
  { root: 43, chord: [59, 62, 67, 71], lead: [71, 0, 74, 79, 0, 74, 71, 0, 74, 0, 76, 74, 0, 71, 0, 0] },
  { root: 45, chord: [57, 60, 64, 67], lead: [69, 0, 72, 76, 0, 76, 74, 72, 0, 69, 0, 72, 74, 0, 0, 0] },
  { root: 41, chord: [57, 60, 65, 69], lead: [65, 0, 69, 72, 0, 74, 72, 69, 0, 65, 0, 69, 72, 0, 0, 0] }
];

const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);

export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.musicGain = null;
    this.sfxGain = null;
    this.noiseBuffer = null;
    this.muted = false;
    this.musicPlaying = false;
    this.step = 0;
    this.nextStepTime = 0;
    this.timer = null;
    this.volume = 0.55;
  }

  init() {
    if (this.ctx) return this.ctx;
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return null;
    this.ctx = new Ctx();
    this.master = this.ctx.createGain();
    this.master.gain.value = this.muted ? 0 : this.volume;
    this.master.connect(this.ctx.destination);

    this.musicGain = this.ctx.createGain();
    this.musicGain.gain.value = 0.2;
    this.musicGain.connect(this.master);

    this.sfxGain = this.ctx.createGain();
    this.sfxGain.gain.value = 0.62;
    this.sfxGain.connect(this.master);

    this.noiseBuffer = this.makeNoise(1.2);
    this.startMusic();
    return this.ctx;
  }

  unlock() {
    this.init();
    if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
  }

  setMuted(muted) {
    this.muted = muted;
    if (this.master) {
      this.master.gain.cancelScheduledValues(this.ctx.currentTime);
      this.master.gain.setTargetAtTime(muted ? 0 : this.volume, this.ctx.currentTime, 0.05);
    }
  }

  toggleMute() {
    this.setMuted(!this.muted);
    return this.muted;
  }

  makeNoise(seconds) {
    const rate = this.ctx.sampleRate;
    const buffer = this.ctx.createBuffer(1, rate * seconds, rate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    return buffer;
  }

  /* ---------------------------- music ---------------------------- */

  startMusic() {
    if (this.musicPlaying || !this.ctx) return;
    this.musicPlaying = true;
    this.nextStepTime = this.ctx.currentTime + 0.12;
    this.step = 0;
    this.timer = setInterval(() => this.schedule(), 40);
  }

  stopMusic() {
    this.musicPlaying = false;
    clearInterval(this.timer);
    this.timer = null;
  }

  schedule() {
    if (!this.ctx || !this.musicPlaying) return;
    if (this.ctx.state !== 'running') {
      this.nextStepTime = this.ctx.currentTime + 0.1;
      return;
    }
    const stepDur = 60 / BPM / 4;
    while (this.nextStepTime < this.ctx.currentTime + 0.28) {
      this.playStep(this.step, this.nextStepTime);
      this.nextStepTime += stepDur;
      this.step = (this.step + 1) % TOTAL_STEPS;
    }
  }

  playStep(step, when) {
    const bar = Math.floor(step / STEPS_PER_BAR);
    const beat = step % STEPS_PER_BAR;
    const prog = PROGRESSION[bar];
    const stepDur = 60 / BPM / 4;

    if (beat === 0 || beat === 6 || beat === 8 || beat === 14) {
      this.kick(when, beat === 8 ? 0.55 : 0.4);
    }
    if (beat % 4 === 2) this.hat(when, 0.18);
    if (beat % 4 === 0) {
      this.pluck(mtof(prog.root), when, 0.34, 'triangle', 0.5);
    }

    if (beat === 0) {
      for (const note of prog.chord) {
        this.pad(mtof(note), when, stepDur * 14, 0.12);
      }
    }

    if (beat % 2 === 1) {
      const arp = prog.chord[(beat / 2) % prog.chord.length | 0];
      this.pluck(mtof(arp + 12), when, 0.16, 'sine', 0.11);
    }

    const lead = prog.lead[beat];
    if (lead) {
      this.leadTone(mtof(lead + 12), when, stepDur * 1.4, 0.12);
    }
  }

  kick(when, vol = 0.4) {
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(140, when);
    osc.frequency.exponentialRampToValueAtTime(48, when + 0.12);
    gain.gain.setValueAtTime(vol, when);
    gain.gain.exponentialRampToValueAtTime(0.001, when + 0.2);
    osc.connect(gain).connect(this.musicGain);
    osc.start(when);
    osc.stop(when + 0.22);
  }

  hat(when, vol = 0.15) {
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.value = 7200;
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(vol, when);
    gain.gain.exponentialRampToValueAtTime(0.001, when + 0.05);
    src.connect(filter).connect(gain).connect(this.musicGain);
    src.start(when, Math.random() * 0.5, 0.06);
  }

  pad(freq, when, dur, vol) {
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.0001, when);
    gain.gain.linearRampToValueAtTime(vol, when + 0.25);
    gain.gain.linearRampToValueAtTime(vol * 0.7, when + dur * 0.6);
    gain.gain.linearRampToValueAtTime(0.0001, when + dur);
    osc.connect(gain).connect(this.musicGain);
    osc.start(when);
    osc.stop(when + dur + 0.05);
  }

  pluck(freq, when, dur, type, vol) {
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(2400, when);
    filter.frequency.exponentialRampToValueAtTime(900, when + dur);
    osc.type = type;
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.0001, when);
    gain.gain.linearRampToValueAtTime(vol, when + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, when + dur);
    osc.connect(filter).connect(gain).connect(this.musicGain);
    osc.start(when);
    osc.stop(when + dur + 0.03);
  }

  leadTone(freq, when, dur, vol) {
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'square';
    osc.frequency.setValueAtTime(freq, when);
    const vibrato = this.ctx.createOscillator();
    const vibGain = this.ctx.createGain();
    vibrato.frequency.value = 5.2;
    vibGain.gain.value = freq * 0.008;
    vibrato.connect(vibGain).connect(osc.frequency);
    gain.gain.setValueAtTime(0.0001, when);
    gain.gain.linearRampToValueAtTime(vol, when + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, when + dur);
    osc.connect(gain).connect(this.musicGain);
    osc.start(when);
    vibrato.start(when);
    osc.stop(when + dur + 0.02);
    vibrato.stop(when + dur + 0.02);
  }

  /* ----------------------------- sfx ----------------------------- */

  blip(freq, when, dur, { type = 'square', vol = 0.25, slideTo = null, filter = null } = {}) {
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, when);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(30, slideTo), when + dur);
    let node = osc;
    if (filter) {
      const f = this.ctx.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.value = filter;
      node.connect(f);
      node = f;
    }
    gain.gain.setValueAtTime(0.0001, when);
    gain.gain.linearRampToValueAtTime(vol, when + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, when + dur);
    node.connect(gain).connect(this.sfxGain);
    osc.start(when);
    osc.stop(when + dur + 0.02);
  }

  noise(when, dur, { vol = 0.2, type = 'bandpass', freq = 1200, q = 0.8, sweepTo = null } = {}) {
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const filter = this.ctx.createBiquadFilter();
    filter.type = type;
    filter.frequency.setValueAtTime(freq, when);
    filter.Q.value = q;
    if (sweepTo) filter.frequency.exponentialRampToValueAtTime(sweepTo, when + dur);
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.0001, when);
    gain.gain.linearRampToValueAtTime(vol, when + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, when + dur);
    src.connect(filter).connect(gain).connect(this.sfxGain);
    src.start(when, Math.random() * 0.3, dur + 0.05);
  }

  sfx(name, options = {}) {
    if (!this.ctx) return;
    if (this.ctx.state === 'suspended') this.ctx.resume();
    const t = this.ctx.currentTime + 0.005;
    switch (name) {
      case 'jump':
        this.blip(360, t, 0.16, { type: 'square', vol: 0.18, slideTo: 720, filter: 2600 });
        break;
      case 'land':
        this.noise(t, 0.1, { vol: 0.18, type: 'lowpass', freq: 900, sweepTo: 200 });
        break;
      case 'step':
        this.noise(t, 0.045, { vol: 0.05, type: 'bandpass', freq: 1600, q: 1.4 });
        break;
      case 'coin':
        this.blip(980, t, 0.09, { type: 'sine', vol: 0.2 });
        this.blip(1470, t + 0.07, 0.14, { type: 'sine', vol: 0.17 });
        break;
      case 'sardine':
        [660, 880, 1174].forEach((f, i) => this.blip(f, t + i * 0.07, 0.18, { type: 'triangle', vol: 0.18 }));
        break;
      case 'chest':
        [523, 659, 784, 1046].forEach((f, i) => this.blip(f, t + i * 0.08, 0.32, { type: 'triangle', vol: 0.22 }));
        this.noise(t, 0.4, { vol: 0.12, type: 'lowpass', freq: 600 });
        break;
      case 'key':
        [1046, 1318, 1568, 2093].forEach((f, i) => this.blip(f, t + i * 0.06, 0.26, { type: 'sine', vol: 0.14 }));
        break;
      case 'door':
        this.noise(t, 0.55, { vol: 0.16, type: 'lowpass', freq: 500, sweepTo: 160 });
        [392, 523, 659, 784].forEach((f, i) => this.blip(f, t + 0.1 + i * 0.1, 0.4, { type: 'triangle', vol: 0.18 }));
        break;
      case 'lever':
        this.blip(180, t, 0.07, { type: 'square', vol: 0.15, slideTo: 110 });
        this.noise(t, 0.08, { vol: 0.15, type: 'bandpass', freq: 2200, q: 2 });
        break;
      case 'gate':
        this.noise(t, 0.6, { vol: 0.14, type: 'lowpass', freq: 800, sweepTo: 300 });
        this.blip(110, t, 0.5, { type: 'sawtooth', vol: 0.08, slideTo: 70 });
        break;
      case 'plate':
        this.blip(320, t, 0.06, { type: 'square', vol: 0.12, slideTo: 220 });
        break;
      case 'splash':
        this.noise(t, 0.45, { vol: 0.24, type: 'lowpass', freq: 2400, sweepTo: 300 });
        break;
      case 'checkpoint':
        this.blip(659, t, 0.12, { type: 'sine', vol: 0.18 });
        this.blip(988, t + 0.12, 0.25, { type: 'sine', vol: 0.18 });
        break;
      case 'win':
        [523, 659, 784, 1046, 1318].forEach((f, i) => this.blip(f, t + i * 0.12, 0.5, { type: 'triangle', vol: 0.22 }));
        break;
      case 'meow':
        this.meow(options.player || 0);
        break;
      case 'wind':
        this.noise(t, 0.22, { vol: 0.05, type: 'bandpass', freq: 900, q: 0.6, sweepTo: 400 });
        break;
      default:
        break;
    }
  }

  meow(player) {
    const t = this.ctx.currentTime + 0.01;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(1500, t);
    filter.frequency.linearRampToValueAtTime(900, t + 0.4);

    const base = player === 1 ? 430 : 520;
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(base, t);
    osc.frequency.linearRampToValueAtTime(base * 1.65, t + 0.08);
    osc.frequency.linearRampToValueAtTime(base * 1.35, t + 0.2);
    osc.frequency.linearRampToValueAtTime(base * 0.82, t + 0.42);

    const vib = this.ctx.createOscillator();
    const vibGain = this.ctx.createGain();
    vib.frequency.value = 6;
    vibGain.gain.value = 12;
    vib.connect(vibGain).connect(osc.frequency);

    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.linearRampToValueAtTime(0.24, t + 0.04);
    gain.gain.linearRampToValueAtTime(0.16, t + 0.25);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.45);

    osc.connect(filter).connect(gain).connect(this.sfxGain);
    osc.start(t);
    vib.start(t);
    osc.stop(t + 0.47);
    vib.stop(t + 0.47);
  }
}
