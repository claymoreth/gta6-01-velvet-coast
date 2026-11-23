// audio.js — Fase 10: WebAudio engine (procedural SFX + radio sequencer).
// Original code, written for this entry. No network, no fetch, no audio
// assets: every sound is synthesized with oscillators / filtered noise.
// The AudioContext is only created after a user gesture; every public
// method returns silently when audio is not running yet.
export const RADIO_STATIONS = [
  { name: 'Sunset 88.5 FM', genre: 'Synthwave', bpm: 100 },
  { name: 'Wave 104.2', genre: 'Chill', bpm: 75 },
  { name: 'Vanta 90.1', genre: 'Trap', bpm: 140 },
];

const RADIO_VOLUME = 0.25;
const ENGINE_VOLUME = 0.15;

export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.radioStation = null;
    this._radioGain = null;
    this._radioTimer = null;
    this._radioStep = 0;
    this._radioNext = 0;
    this._noiseBuf = null;
    this._siren = null; // { osc, gain, timer }
    this._engine = null; // { osc, gain }
    this._ambient = null; // { src, gain, chirpTimer }
  }

  ensure() {
    if (this.ctx) return this.ctx;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.5;
      this.master.connect(this.ctx.destination);
    } catch {
      this.ctx = null;
    }
    return this.ctx;
  }

  resume() {
    if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
  }

  // Return a running AudioContext, or null (caller stays silent).
  _ready() {
    const ac = this.ensure();
    if (!ac) return null;
    if (ac.state === 'suspended') {
      try {
        const p = ac.resume();
        if (p && typeof p.catch === 'function') p.catch(() => {});
      } catch { /* ignore */ }
    }
    return ac.state === 'running' ? ac : null;
  }

  _noiseBuffer() {
    if (this._noiseBuf) return this._noiseBuf;
    const ac = this.ctx;
    const buf = ac.createBuffer(1, ac.sampleRate, ac.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    this._noiseBuf = buf;
    return buf;
  }

  // One-shot tone. freq may be [from, to] for a pitch sweep.
  // when is seconds from now; dest defaults to the master bus.
  _tone(freq, dur, type = 'sine', vol = 0.2, when = 0, dest = null, filterFreq = 0) {
    const ac = this.ctx;
    const t0 = ac.currentTime + when;
    const osc = ac.createOscillator();
    const g = ac.createGain();
    if (Array.isArray(freq)) {
      osc.frequency.setValueAtTime(Math.max(1, freq[0]), t0);
      osc.frequency.exponentialRampToValueAtTime(Math.max(1, freq[1]), t0 + dur);
    } else {
      osc.frequency.setValueAtTime(freq, t0);
    }
    osc.type = type;
    g.gain.setValueAtTime(vol, t0);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    let node = osc;
    if (filterFreq > 0) {
      const f = ac.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.value = filterFreq;
      osc.connect(f);
      node = f;
    }
    node.connect(g);
    g.connect(dest || this.master);
    osc.start(t0);
    osc.stop(t0 + dur + 0.05);
    return osc;
  }

  // One-shot filtered noise burst.
  _noise(dur, vol = 0.3, filterType = 'lowpass', filterFreq = 1000, when = 0, dest = null) {
    const ac = this.ctx;
    const t0 = ac.currentTime + when;
    const src = ac.createBufferSource();
    src.buffer = this._noiseBuffer();
    src.loop = true;
    const f = ac.createBiquadFilter();
    f.type = filterType;
    f.frequency.value = filterFreq;
    const g = ac.createGain();
    g.gain.setValueAtTime(vol, t0);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    src.connect(f);
    f.connect(g);
    g.connect(dest || this.master);
    src.start(t0);
    src.stop(t0 + dur + 0.05);
  }

  // --- SFX ---------------------------------------------------------------
  playGunshot() {
    if (!this._ready()) return;
    this._noise(0.12, 0.5, 'bandpass', 900);
    this._tone([110, 45], 0.16, 'sine', 0.4);
  }

  playFootstep() {
    if (!this._ready()) return;
    this._noise(0.06, 0.1, 'lowpass', 420);
  }

  playHonk() {
    if (!this._ready()) return;
    this._tone(370, 0.28, 'square', 0.1);
    this._tone(466, 0.28, 'square', 0.1);
  }

  // WantedSystem calls playSiren() when the first patrol car spawns.
  playSiren() {
    this.playSirenStart();
  }

  playSirenStart() {
    if (!this._ready()) return;
    if (this._siren) return; // already wailing
    const ac = this.ctx;
    const osc = ac.createOscillator();
    osc.type = 'triangle';
    osc.frequency.value = 700;
    const f = ac.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = 1600;
    const g = ac.createGain();
    g.gain.value = 0.1;
    osc.connect(f);
    f.connect(g);
    g.connect(this.master);
    osc.start();
    let high = false;
    const timer = setInterval(() => {
      if (!this._siren) return;
      high = !high;
      try {
        osc.frequency.setValueAtTime(high ? 950 : 700, ac.currentTime);
      } catch { /* ignore */ }
    }, 450);
    this._siren = { osc, gain: g, timer };
  }

  playSirenStop() {
    if (!this._siren) return;
    clearInterval(this._siren.timer);
    try { this._siren.osc.stop(); } catch { /* ignore */ }
    try { this._siren.gain.disconnect(); } catch { /* ignore */ }
    this._siren = null;
  }

  playUiBeep() {
    if (!this._ready()) return;
    this._tone(880, 0.07, 'sine', 0.14);
  }

  playUiClick() {
    this.playUiBeep();
  }

  playJump() {
    if (!this._ready()) return;
    this._tone([300, 620], 0.18, 'sine', 0.14);
  }

  playPickup() {
    if (!this._ready()) return;
    this._tone(660, 0.08, 'sine', 0.16);
    this._tone(990, 0.12, 'sine', 0.16, 0.08);
  }

  playReload() {
    if (!this._ready()) return;
    this._noise(0.03, 0.25, 'highpass', 2500);
    this._noise(0.03, 0.25, 'highpass', 2500, 0.18);
  }

  playExplosion() {
    if (!this._ready()) return;
    this._noise(0.7, 0.55, 'lowpass', 2800);
    this._tone([120, 28], 0.6, 'sine', 0.6);
  }

  // Tabrakan kendaraan: noise burst pendek + low thud, tanpa crack tajam
  // seperti playGunshot. Dipanggil vehicle.js / carchase.js (guard typeof).
  playCrash() {
    if (!this._ready()) return;
    this._noise(0.18, 0.45, 'lowpass', 700);
    this._noise(0.1, 0.3, 'bandpass', 1600, 0.02);
    this._tone([90, 35], 0.25, 'sine', 0.5);
  }

  // --- Vehicle engine ----------------------------------------------------
  // speedNorm 0..1 -> saw osc 80-300 Hz. Starts/stops automatically.
  setEngine(speedNorm) {
    const norm = Math.max(0, Math.min(1, Number(speedNorm) || 0));
    if (norm <= 0.02) {
      if (this._engine) {
        try { this._engine.osc.stop(); } catch { /* ignore */ }
        try { this._engine.gain.disconnect(); } catch { /* ignore */ }
        this._engine = null;
      }
      return;
    }
    const ac = this._ready();
    if (!ac) return;
    if (!this._engine) {
      const osc = ac.createOscillator();
      osc.type = 'sawtooth';
      const f = ac.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.value = 700;
      const g = ac.createGain();
      g.gain.value = 0;
      osc.connect(f);
      f.connect(g);
      g.connect(this.master);
      osc.start();
      this._engine = { osc, gain: g };
    }
    const freq = 80 + 220 * norm;
    this._engine.osc.frequency.setTargetAtTime(freq, ac.currentTime, 0.05);
    this._engine.gain.gain.setTargetAtTime(
      ENGINE_VOLUME * (0.4 + 0.6 * norm), ac.currentTime, 0.05,
    );
  }

  setEngineRpm(rpm) {
    this.setEngine(Math.max(0, Math.min(1, Number(rpm) || 0)));
  }

  engineLoop(on) {
    if (on) this.setEngine(0.08);
    else this.setEngine(0);
  }

  // --- Radio ---------------------------------------------------------------
  _radioGainNode() {
    if (!this._radioGain) {
      this._radioGain = this.ctx.createGain();
      this._radioGain.gain.value = RADIO_VOLUME;
      this._radioGain.connect(this.master);
    }
    return this._radioGain;
  }

  startRadio(index) {
    const ac = this._ready();
    this.stopRadio();
    if (!ac) return false;
    const n = RADIO_STATIONS.length;
    const i = ((Number(index) || 0) % n + n) % n;
    this.radioStation = i;
    this._radioStep = 0;
    this._radioNext = ac.currentTime + 0.05;
    this._radioTimer = setInterval(() => this._radioTick(), 100);
    return true;
  }

  stopRadio() {
    if (this._radioTimer) {
      clearInterval(this._radioTimer);
      this._radioTimer = null;
    }
    this.radioStation = null;
  }

  // Accepts a station name (carfactory) or an index.
  setRadio(station) {
    if (typeof station === 'string') {
      const i = RADIO_STATIONS.findIndex((s) => s.name === station);
      return this.startRadio(i < 0 ? 0 : i);
    }
    return this.startRadio(station);
  }

  // Lookahead scheduler: schedule notes 0.2s ahead, every 100ms.
  _radioTick() {
    const ac = this.ctx;
    if (!ac || ac.state !== 'running') return;
    const st = RADIO_STATIONS[this.radioStation ?? 0];
    if (!st) return;
    const stepDur = 60 / st.bpm / 4; // 16th notes
    while (this._radioNext < ac.currentTime + 0.2) {
      this._scheduleRadioStep(this.radioStation, this._radioStep, this._radioNext, stepDur);
      this._radioNext += stepDur;
      this._radioStep = (this._radioStep + 1) % 16;
    }
  }

  _scheduleRadioStep(station, step, t, stepDur) {
    const g = this._radioGainNode();
    const when = Math.max(0, t - this.ctx.currentTime);
    const midi = (m) => 440 * Math.pow(2, (m - 69) / 12);
    if (station === 0) {
      // Synthwave: driving bass + arp + four-on-the-floor kick.
      const bass = [33, 0, 33, 0, 36, 0, 33, 0, 40, 0, 33, 0, 43, 0, 40, 0];
      const b = bass[step];
      if (b) this._tone(midi(b), stepDur * 0.95, 'sawtooth', 0.22, when, g, 900);
      const arp = [57, 60, 64, 69, 64, 60, 57, 60, 64, 69, 72, 69, 64, 60, 64, 57];
      this._tone(midi(arp[step]), stepDur * 0.9, 'square', 0.05, when, g, 2400);
      if (step % 4 === 0) this._tone([150, 42], 0.16, 'sine', 0.5, when, g);
      if (step % 4 === 2) this._noise(0.05, 0.08, 'highpass', 6000, when, g);
    } else if (station === 1) {
      // Chill: soft pad (whole bar) + sparse pluck.
      if (step === 0) {
        for (const m of [57, 60, 64, 67]) {
          this._tone(midi(m), stepDur * 16, 'triangle', 0.05, when, g);
        }
      }
      const pluck = [0, 0, 0, 0, 0, 0, 69, 0, 0, 0, 0, 72, 0, 0, 76, 0];
      const p = pluck[step];
      if (p) this._tone(midi(p), stepDur * 2, 'sine', 0.12, when, g);
      if (step % 8 === 4) this._noise(0.06, 0.04, 'highpass', 8000, when, g);
    } else {
      // Trap: 808 kick, snare on 4/12, hats every step.
      if (step === 0 || step === 6 || step === 10) {
        this._tone([160, 38], 0.32, 'sine', 0.55, when, g);
      }
      if (step === 4 || step === 12) this._noise(0.12, 0.22, 'bandpass', 1800, when, g);
      this._noise(0.03, step % 2 === 0 ? 0.07 : 0.04, 'highpass', 7000, when, g);
      if (step === 14) this._noise(0.03, 0.09, 'highpass', 9000, when, g);
    }
  }

  // --- Outdoor ambient bed -------------------------------------------------
  playAmbientBed() {
    const ac = this._ready();
    if (!ac) return;
    if (this._ambient) return;
    const src = ac.createBufferSource();
    src.buffer = this._noiseBuffer();
    src.loop = true;
    const f = ac.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = 320;
    const g = ac.createGain();
    g.gain.value = 0.045;
    src.connect(f);
    f.connect(g);
    g.connect(this.master);
    src.start();
    const chirpTimer = setInterval(() => {
      if (!this._ambient || !this.ctx || this.ctx.state !== 'running') return;
      if (Math.random() > 0.4) return; // rare bird chirps
      const n = 2 + Math.floor(Math.random() * 3);
      for (let i = 0; i < n; i++) {
        this._tone(2400 + Math.random() * 900, 0.07, 'sine', 0.05, i * 0.09);
      }
    }, 5000);
    this._ambient = { src, gain: g, chirpTimer };
  }

  stopAmbientBed() {
    if (!this._ambient) return;
    clearInterval(this._ambient.chirpTimer);
    try { this._ambient.src.stop(); } catch { /* ignore */ }
    try { this._ambient.gain.disconnect(); } catch { /* ignore */ }
    this._ambient = null;
  }
}

export const audio = new AudioEngine();
