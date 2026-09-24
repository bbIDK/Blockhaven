// Procedural sound: every effect is synthesised with Web Audio (filtered noise and tones), and
// a sparse generative piano-like score plays in the background.
const MATERIALS = {
  stone: { type: 'bandpass', freq: 1900, q: 1.1, dur: 0.11, gain: 0.55, thump: 110 },
  wood: { type: 'bandpass', freq: 850, q: 1.6, dur: 0.12, gain: 0.7, thump: 170 },
  grass: { type: 'highpass', freq: 1400, q: 0.5, dur: 0.14, gain: 0.35 },
  gravel: { type: 'bandpass', freq: 1300, q: 0.7, dur: 0.15, gain: 0.55, crackle: true },
  sand: { type: 'highpass', freq: 2600, q: 0.4, dur: 0.16, gain: 0.3 },
  snow: { type: 'lowpass', freq: 2200, q: 0.6, dur: 0.16, gain: 0.35 },
  cloth: { type: 'lowpass', freq: 900, q: 0.5, dur: 0.12, gain: 0.4 },
  glass: { type: 'highpass', freq: 3000, q: 0.8, dur: 0.22, gain: 0.35, ring: [2400, 3100, 3900] },
  metal: { type: 'bandpass', freq: 2800, q: 2, dur: 0.14, gain: 0.45, ring: [1250, 1870] },
  water: { type: 'lowpass', freq: 1200, q: 0.8, dur: 0.3, gain: 0.45 },
};

const SCALE = [0, 2, 4, 7, 9, 12, 14, 16, 19, 21, 24];

export class Audio {
  constructor() {
    this.ctx = null;
    this.volume = 0.7;
    this.musicVolume = 0.4;
    this.nextPhrase = 0;
    this.lastStep = 0;
  }

  // Must be called from a user gesture.
  unlock() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    try {
      this.ctx = new AC();
    } catch {
      return;
    }
    const ctx = this.ctx;
    this.master = ctx.createGain();
    this.master.gain.value = this.volume;
    this.master.connect(ctx.destination);
    this.musicBus = ctx.createGain();
    this.musicBus.gain.value = this.musicVolume;
    // A soft generated reverb for the music.
    const len = ctx.sampleRate * 2.8;
    const ir = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const d = ir.getChannelData(ch);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3);
    }
    this.reverb = ctx.createConvolver();
    this.reverb.buffer = ir;
    const wet = ctx.createGain();
    wet.gain.value = 0.55;
    this.musicBus.connect(this.reverb);
    this.reverb.connect(wet);
    wet.connect(ctx.destination);
    this.musicBus.connect(ctx.destination);
    this.noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const nd = this.noise.getChannelData(0);
    for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;
    this.nextPhrase = ctx.currentTime + 6;
  }

  setVolume(v) { this.volume = v; if (this.master) this.master.gain.value = v; }
  setMusicVolume(v) { this.musicVolume = v; if (this.musicBus) this.musicBus.gain.value = v; }

  burst(material, { gain = 1, pitch = 1, dur = null } = {}) {
    const ctx = this.ctx;
    if (!ctx || ctx.state !== 'running' || this.volume <= 0) return;
    const m = MATERIALS[material] ?? MATERIALS.stone;
    const t = ctx.currentTime, d = (dur ?? m.dur) * (0.9 + Math.random() * 0.2);
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    src.playbackRate.value = pitch * (0.9 + Math.random() * 0.2);
    const f = ctx.createBiquadFilter();
    f.type = m.type;
    f.frequency.value = m.freq * pitch;
    f.Q.value = m.q;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(m.gain * gain, t + 0.006);
    g.gain.exponentialRampToValueAtTime(0.0001, t + d);
    if (m.crackle) {
      const lfo = ctx.createOscillator();
      const lg = ctx.createGain();
      lfo.type = 'square';
      lfo.frequency.value = 55 + Math.random() * 30;
      lg.gain.value = m.gain * gain * 0.5;
      lfo.connect(lg).connect(g.gain);
      lfo.start(t); lfo.stop(t + d);
    }
    src.connect(f).connect(g).connect(this.master);
    src.start(t, Math.random() * 0.5);
    src.stop(t + d + 0.02);
    if (m.thump) this.tone(m.thump * pitch, d * 0.8, 0.35 * gain, 'sine', 0.5);
    if (m.ring) for (const fr of m.ring) this.tone(fr * (0.95 + Math.random() * 0.1), 0.25, 0.08 * gain, 'sine');
  }

  tone(freq, dur, gain, type = 'sine', slide = 1, dest = null) {
    const ctx = this.ctx;
    if (!ctx || ctx.state !== 'running') return;
    const t = ctx.currentTime;
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (slide !== 1) o.frequency.exponentialRampToValueAtTime(freq * slide, t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(dest ?? this.master);
    o.start(t);
    o.stop(t + dur + 0.05);
  }

  dig(material) { this.burst(material, { gain: 0.6, dur: 0.07 }); }
  breakBlock(material) { this.burst(material, { gain: 1.1, pitch: 0.8 }); this.burst(material, { gain: 0.6, pitch: 0.6 }); }
  place(material) { this.burst(material, { gain: 0.9, pitch: 0.9 }); }
  step(material) {
    if (!this.ctx) return;
    this.burst(material === 'water' ? 'water' : material, { gain: 0.32, dur: 0.08, pitch: 0.9 + Math.random() * 0.2 });
  }
  splash() { this.burst('water', { gain: 1, dur: 0.45, pitch: 0.7 }); }
  pop() { this.tone(520 + Math.random() * 180, 0.08, 0.18, 'triangle', 1.8); }
  click() { this.tone(660, 0.05, 0.12, 'square', 0.8); }
  hurt() { this.tone(210, 0.18, 0.4, 'sawtooth', 0.55); this.burst('cloth', { gain: 0.8 }); }
  eat() { for (let i = 0; i < 3; i++) setTimeout(() => this.burst('gravel', { gain: 0.5, dur: 0.06, pitch: 1.4 }), i * 90); }
  fuse() { this.burst('sand', { gain: 0.9, dur: 0.9, pitch: 1.6 }); }
  explode() {
    this.burst('cloth', { gain: 2.2, dur: 1.2, pitch: 0.35 });
    this.burst('gravel', { gain: 1.4, dur: 0.9, pitch: 0.5 });
    this.tone(55, 0.9, 0.9, 'sine', 0.4);
  }
  mob(kind) {
    if (kind === 'pig') this.tone(300 + Math.random() * 60, 0.22, 0.2, 'sawtooth', 0.7);
    else if (kind === 'sheep') { this.tone(420, 0.35, 0.12, 'triangle', 0.9); this.tone(426, 0.35, 0.08, 'sawtooth', 0.92); }
    else if (kind === 'zombie') this.tone(95 + Math.random() * 20, 0.6, 0.25, 'sawtooth', 0.75);
  }

  // Sparse generative music: gentle phrases of plucked notes with long gaps.
  update(playing) {
    const ctx = this.ctx;
    if (!ctx || ctx.state !== 'running' || this.musicVolume <= 0 || !playing) return;
    if (ctx.currentTime < this.nextPhrase) return;
    const root = [48, 50, 53, 55][Math.floor(Math.random() * 4)];
    const notes = 4 + Math.floor(Math.random() * 6);
    let t = ctx.currentTime + 0.1;
    let deg = Math.floor(Math.random() * 5);
    for (let i = 0; i < notes; i++) {
      deg = Math.max(0, Math.min(SCALE.length - 1, deg + Math.floor(Math.random() * 5) - 2));
      const midi = root + SCALE[deg] + 12;
      this.note(midi, t, 2.4);
      if (Math.random() < 0.3) this.note(midi - 12, t, 3);
      t += [0.45, 0.6, 0.9, 1.2][Math.floor(Math.random() * 4)];
    }
    this.nextPhrase = t + 18 + Math.random() * 30;
  }

  note(midi, t, dur) {
    const ctx = this.ctx;
    const f = 440 * Math.pow(2, (midi - 69) / 12);
    for (const [mult, amp] of [[1, 0.14], [2, 0.035], [3, 0.012]]) {
      const o = ctx.createOscillator();
      o.type = 'sine';
      o.frequency.value = f * mult;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(amp, t + 0.012);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur / mult);
      o.connect(g).connect(this.musicBus);
      o.start(t);
      o.stop(t + dur + 0.1);
    }
  }
}
