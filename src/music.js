// Calm generative piano music. A piano is synthesised into samples when audio starts (additive
// synthesis with stretched partials, two-stage decay and detuned strings), and a small composer
// writes every piece on the fly: a chord progression, an arpeggio figure, a bass line and a
// melody built from repeated motifs, played with rubato through reverb and a soft echo.

const MODES = {
  major: { scale: [0, 2, 4, 5, 7, 9, 11], progs: [[0, 4, 5, 3], [0, 5, 3, 4], [3, 0, 4, 5], [0, 3, 5, 4], [5, 3, 0, 4], [0, 2, 3, 0], [3, 4, 2, 5], [0, 3, 0, 4], [3, 4, 0, 5]] },
  lydian: { scale: [0, 2, 4, 6, 7, 9, 11], progs: [[0, 1, 0, 1], [0, 1, 5, 0], [0, 5, 1, 0], [0, 1, 4, 0]] },
  aeolian: { scale: [0, 2, 3, 5, 7, 8, 10], progs: [[0, 5, 2, 6], [0, 3, 5, 4], [0, 6, 5, 6], [0, 5, 3, 4], [5, 6, 0, 0], [0, 3, 6, 2], [0, 2, 3, 6]] },
  dorian: { scale: [0, 2, 3, 5, 7, 9, 10], progs: [[0, 3, 0, 3], [0, 3, 6, 0], [0, 6, 3, 0], [0, 1, 3, 0]] },
};

// Arpeggio figures as indices into a chord "ladder" (bottom to top), one per eighth note; -1 rests.
const FIGURES = {
  4: [[0, 2, 3, 4, 5, 4, 3, 2], [0, 2, 4, 2, 5, 2, 4, 2], [0, 1, 2, 3, 4, 3, 2, 1], [0, -1, 2, 3, 4, -1, 3, 2],
    [0, 2, 3, 5, 4, 3, 2, 3], [0, -1, 3, -1, 4, -1, 3, -1], [0, 3, 2, 4, 3, 5, 4, 2]],
  3: [[0, 2, 3, 4, 3, 2], [0, 2, 4, 5, 4, 2], [0, -1, 3, 4, 5, 4], [0, 3, 4, 3, 5, 3], [0, -1, 2, -1, 4, -1]],
};
const SPARSE = { 4: [[0, -1, -1, -1, 3, -1, -1, -1], [0, -1, 2, -1, -1, -1, 4, -1]], 3: [[0, -1, -1, 3, -1, -1], [0, -1, 2, -1, 4, -1]] };

// Melody rhythms for one bar, in eighths; negative numbers are rests.
const RHYTHMS = {
  4: [[4, 4], [2, 2, 4], [3, 1, 4], [2, 2, 2, 2], [6, 2], [-2, 2, 4], [2, 4, 2], [1, 1, 2, 4], [-4, 2, 2], [2, 6]],
  3: [[4, 2], [2, 2, 2], [3, 1, 2], [-2, 2, 2], [2, 4], [1, 1, 4]],
};
const ENDINGS = { 4: [[8], [4, 4], [2, 6], [-2, 6]], 3: [[6], [2, 4], [-2, 4]] };

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// One piano note rendered offline. Returns an AudioBuffer (mono).
async function renderPianoNote(OAC, rate, midi, dur) {
  const ctx = new OAC(1, Math.ceil(dur * rate), rate);
  const f0 = 440 * 2 ** ((midi - 69) / 12);
  const out = ctx.createGain();
  const tone = ctx.createBiquadFilter();
  tone.type = 'lowpass';
  tone.frequency.value = Math.min(9000, 2200 + f0 * 5);
  tone.Q.value = 0.4;
  out.connect(tone).connect(ctx.destination);
  const B = 0.00011 * 2 ** ((midi - 60) / 14); // string stiffness: partials run sharp
  const tauSlow = clamp(9 * (220 / f0) ** 0.55, 1.4, 13);
  const tauFast = clamp(1.1 * (220 / f0) ** 0.4, 0.22, 1.5);
  const strings = midi < 38 ? 1 : midi < 52 ? 2 : 3;
  const POINTS = 192;
  for (let n = 1; n <= 30; n++) {
    const fn = n * f0 * Math.sqrt(1 + B * n * n);
    if (fn > Math.min(rate / 2 - 800, 11000)) break;
    // Hammer struck about 1/8 along the string, soft felt rolling off the highs.
    let amp = Math.abs(Math.sin(Math.PI * n * 0.122)) / n ** 1.05;
    amp /= 1 + (fn / 3000) ** 2;
    if (amp < 0.0015) continue;
    const ts = tauSlow / (1 + 0.22 * (n - 1)), tf = tauFast / (1 + 0.35 * (n - 1));
    const curve = new Float32Array(POINTS);
    for (let i = 0; i < POINTS; i++) {
      const t = (i / (POINTS - 1)) * dur;
      curve[i] = amp * (0.6 * Math.exp(-t / tf) + 0.4 * Math.exp(-t / ts));
    }
    const g = ctx.createGain();
    g.gain.value = 0;
    g.gain.setValueCurveAtTime(curve, 0, dur);
    g.connect(out);
    for (let s = 0; s < strings; s++) {
      const o = ctx.createOscillator();
      o.frequency.value = fn;
      // Unison strings are never perfectly in tune; the slow beating makes the tone alive.
      o.detune.value = strings === 1 ? 0 : (s - (strings - 1) / 2) * (0.9 + 0.5 * ((n * 7 + s) % 3) / 2);
      const sg = ctx.createGain();
      sg.gain.value = 1 / strings;
      o.connect(sg).connect(g);
      o.start(0);
    }
  }
  // The felt hammer's knock.
  const nlen = Math.ceil(0.04 * rate);
  const nb = ctx.createBuffer(1, nlen, rate);
  const nd = nb.getChannelData(0);
  for (let i = 0; i < nlen; i++) nd[i] = (Math.random() * 2 - 1) * Math.exp(-i / (0.006 * rate));
  const ns = ctx.createBufferSource();
  ns.buffer = nb;
  const bp = ctx.createBiquadFilter();
  bp.type = 'bandpass';
  bp.frequency.value = Math.min(3500, f0 * 3);
  bp.Q.value = 0.7;
  const ng = ctx.createGain();
  ng.gain.value = 0.04;
  ns.connect(bp).connect(ng).connect(out);
  ns.start(0);
  out.gain.setValueAtTime(0, 0);
  out.gain.linearRampToValueAtTime(1, 0.004);
  out.gain.setValueAtTime(1, dur - 0.3);
  out.gain.linearRampToValueAtTime(0, dur);
  const buf = await ctx.startRendering();
  const d = buf.getChannelData(0);
  let peak = 0;
  for (let i = 0; i < d.length; i++) peak = Math.max(peak, Math.abs(d[i]));
  const k = peak > 0 ? 0.8 / peak : 1;
  for (let i = 0; i < d.length; i++) d[i] *= k;
  return buf;
}

// Stereo hall reverb: decaying noise that gets darker as it fades, after a short pre-delay.
export function makeImpulse(ctx, seconds) {
  const rate = ctx.sampleRate, len = Math.floor(rate * seconds), pre = Math.floor(rate * 0.018);
  const buf = ctx.createBuffer(2, len, rate);
  for (let ch = 0; ch < 2; ch++) {
    const d = buf.getChannelData(ch);
    let lp = 0;
    for (let i = pre; i < len; i++) {
      const t = (i - pre) / rate;
      const k = 0.25 + 0.7 * Math.min(1, t / seconds);
      lp += (1 - k) * ((Math.random() * 2 - 1) - lp);
      d[i] = lp * Math.exp(-t * 6.2 / seconds) * 1.6;
    }
  }
  return buf;
}

export class Music {
  constructor(ctx, destination) {
    this.ctx = ctx;
    this.samples = [];
    this.ready = false;
    this.piece = null;
    this.mood = null;
    this.nextStart = 0;
    this.voices = [];
    this.pads = [];
    this.out = ctx.createGain();
    this.out.connect(destination);
    this.bus = ctx.createGain();
    this.bus.gain.value = 0.9;
    // Dry, hall reverb and a soft stereo echo.
    this.bus.connect(this.out);
    const verb = ctx.createConvolver();
    verb.buffer = makeImpulse(ctx, 3.4);
    const wet = ctx.createGain();
    wet.gain.value = 0.42;
    this.bus.connect(verb).connect(wet).connect(this.out);
    const merger = ctx.createChannelMerger(2);
    const tone = ctx.createBiquadFilter();
    tone.type = 'lowpass';
    tone.frequency.value = 2400;
    this.bus.connect(tone);
    [0.37, 0.52].forEach((time, ch) => {
      const delay = ctx.createDelay(1);
      delay.delayTime.value = time;
      const fb = ctx.createGain();
      fb.gain.value = 0.3;
      tone.connect(delay);
      delay.connect(fb).connect(delay);
      const level = ctx.createGain();
      level.gain.value = 0.13;
      delay.connect(level).connect(merger, 0, ch);
    });
    merger.connect(verb);
    merger.connect(this.out);
    this.load();
  }

  async load() {
    const OAC = window.OfflineAudioContext || window.webkitOfflineAudioContext;
    if (!OAC) return;
    try {
      // Every third semitone from A1 to C#7; notes in between are pitched from the nearest one.
      for (let m = 33; m <= 97; m += 3) {
        const dur = m < 48 ? 7 : m < 66 ? 5.5 : m < 80 ? 4 : 3;
        this.samples.push({ midi: m, buffer: await renderPianoNote(OAC, this.ctx.sampleRate, m, dur) });
      }
      this.ready = true;
    } catch (err) {
      console.warn('Music unavailable', err);
    }
  }

  // Called every frame. mood: 'title', 'day', 'night' or 'cave'; null stops music after this piece.
  update(mood) {
    const ctx = this.ctx;
    if (!this.ready || ctx.state !== 'running') return;
    const now = ctx.currentTime;
    if (mood !== this.mood) {
      // Going between the title screen and a world ends the current piece gently. In a world the
      // first piece comes after a while, like the original game.
      const isTitle = mood === 'title';
      if (mood && (this.mood === null || (this.mood === 'title') !== isTitle)) {
        if (this.piece) this.fadeOut();
        this.nextStart = now + (isTitle ? 1.5 : 25 + Math.random() * 35);
      }
      this.mood = mood;
    }
    const p = this.piece;
    if (!p) {
      if (mood && now >= this.nextStart) this.start(mood);
      return;
    }
    while (p.i < p.events.length && p.t0 + p.events[p.i].t < now + 0.6) {
      const e = p.events[p.i++];
      const at = p.t0 + e.t;
      if (at < now - 0.05) continue; // the tab was hidden; skip what we missed
      this.play(e, at);
    }
    if (p.i >= p.events.length && now > p.t0 + p.length) {
      for (const v of this.pads) this.releasePad(v, now);
      this.pads = [];
      this.piece = null;
      this.nextStart = now + (this.mood === 'title' ? 5 + Math.random() * 6 : 90 + Math.random() * 150);
    }
  }

  fadeOut() {
    const ctx = this.ctx, t = ctx.currentTime;
    this.piece = null;
    for (const v of this.voices) {
      try { v.gain.gain.cancelScheduledValues(t); v.gain.gain.setTargetAtTime(0, t, 0.5); v.src.stop(t + 3); } catch { /* already stopped */ }
    }
    for (const v of this.pads) this.releasePad(v, t);
    this.voices = [];
    this.pads = [];
  }

  start(mood) {
    const seed = (Math.random() * 2 ** 31) | 0;
    this.piece = compose(seed, mood);
    this.piece.t0 = this.ctx.currentTime + 0.3;
    this.piece.i = 0;
  }

  play(e, at) {
    if (e.kind === 'pad') this.pad(e, at);
    else if (e.kind === 'release') this.release(e.group, at);
    else this.note(e.midi, at, e.vel, e.group, e.len);
  }

  note(midi, at, vel, group, len) {
    const ctx = this.ctx;
    let s = this.samples[0];
    for (const x of this.samples) if (Math.abs(x.midi - midi) < Math.abs(s.midi - midi)) s = x;
    const src = ctx.createBufferSource();
    src.buffer = s.buffer;
    src.playbackRate.value = 2 ** ((midi - s.midi) / 12);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(vel * 0.78, at);
    // Pan by pitch, like sitting at a piano: bass a little left, treble a little right.
    const pan = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
    if (pan) pan.pan.value = clamp((midi - 62) / 40, -0.45, 0.45);
    src.connect(gain);
    (pan ? gain.connect(pan) : gain).connect(this.bus);
    const end = at + s.buffer.duration / src.playbackRate.value;
    src.start(at);
    src.stop(end);
    const v = { src, gain, group, end };
    if (len) this.releaseVoice(v, at + len);
    this.voices.push(v);
    if (this.voices.length > 48) this.voices = this.voices.filter((x) => x.end > ctx.currentTime);
  }

  releaseVoice(v, at) {
    v.gain.gain.setValueAtTime(v.gain.gain.value, at);
    v.gain.gain.setTargetAtTime(0, at, 0.28);
    try { v.src.stop(Math.min(v.end, at + 2)); } catch { /* ignore */ }
  }

  // Like lifting the sustain pedal: notes of a finished chord fade out.
  release(group, at) {
    for (const v of this.voices) if (v.group === group && v.end > at) this.releaseVoice(v, at);
    for (const v of this.pads) if (v.group === group) this.releasePad(v, at);
    this.pads = this.pads.filter((v) => v.group !== group);
  }

  // A soft, slow synth pad under some pieces.
  pad(e, at) {
    const ctx = this.ctx;
    const f = 440 * 2 ** ((e.midi - 69) / 12);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, at);
    gain.gain.linearRampToValueAtTime(e.vel * 0.05, at + 1.6);
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 700;
    filter.Q.value = 0.3;
    const oscs = [-6, 6].map((detune) => {
      const o = ctx.createOscillator();
      o.type = 'sawtooth';
      o.frequency.value = f;
      o.detune.value = detune;
      o.connect(filter);
      o.start(at);
      return o;
    });
    filter.connect(gain).connect(this.bus);
    this.pads.push({ oscs, gain, group: e.group });
  }

  releasePad(v, at) {
    try {
      v.gain.gain.cancelScheduledValues(at);
      v.gain.gain.setTargetAtTime(0, at, 0.7);
      for (const o of v.oscs) o.stop(at + 4);
    } catch { /* ignore */ }
  }
}

// ---------------------------------------------------------------- the composer

// `style` (the songs on music discs) can set the mode, beats to the bar, tempo and pad, and how
// long the piece should be (seconds).
export function compose(seed, mood, style = {}) {
  const r = rng(seed);
  const pick = (list) => list[Math.floor(r() * list.length)];
  const dark = mood === 'night' || mood === 'cave';
  const modeName = style.mode ?? (dark ? (r() < 0.6 ? 'aeolian' : 'dorian') : (r() < 0.72 ? 'major' : 'lydian'));
  const mode = MODES[modeName];
  const scale = mode.scale;
  const beats = style.beats ?? (r() < 0.7 ? 4 : 3);
  const eighths = beats * 2;
  const cave = mood === 'cave';
  const bpm = style.bpm ?? (cave ? 46 + r() * 10 : dark ? 54 + r() * 12 : 60 + r() * 18);
  const e8 = 30 / bpm; // seconds per eighth note
  const key = 48 + Math.floor(r() * 8) - (cave ? 5 : 0); // tonic in octave 3
  const prog = pick(mode.progs);
  const chordBars = r() < 0.55 ? 1 : 2;
  const figure = pick(FIGURES[beats]);
  const figureB = pick(cave ? SPARSE[beats] : FIGURES[beats]);
  const withPad = style.pad ?? r() < (dark ? 0.6 : 0.4);
  const events = [];
  let group = 0;

  const degreeNote = (deg) => key + scale[((deg % 7) + 7) % 7] + 12 * Math.floor(deg / 7);
  const chordOf = (deg) => {
    const color = r();
    const tones = [degreeNote(deg), degreeNote(deg + 2), degreeNote(deg + 4)];
    // Sevenths and ninths give the soft, open colour.
    if (color < 0.35) tones.push(degreeNote(deg + 6));
    else if (color < 0.7) tones.push(degreeNote(deg + 8));
    return tones;
  };
  // A spread voicing from the bass up: root, fifth, then the chord an octave higher.
  const ladderOf = (tones) => {
    let root = tones[0];
    while (root > 52) root -= 12;
    while (root < 43) root += 12;
    const up = tones.map((t) => t - tones[0] + root + 12);
    return [root, root + 7, ...up.slice(0, 3), up[3] ?? up[0] + 12, up[1] + 12, up[2] + 12];
  };

  // Loop the progression through the sections of the piece.
  let loops = chordBars === 1 ? [1, 2, 2, 2, 1] : [1, 1, 1, 1, 1];
  if (style.seconds) {
    // (As long as the style asks: the middle sections go round as often as that takes.)
    const each = prog.length * chordBars * beats * 60 / bpm, m = Math.max(1, Math.round((style.seconds / each - 2) / 3));
    loops = [1, m, m, m, 1];
  }
  const sections = ['intro', 'a', 'b', 'a2', 'outro'];
  const chords = [];
  sections.forEach((section, si) => {
    for (let l = 0; l < loops[si]; l++) {
      for (const deg of prog) {
        const tones = chordOf(deg);
        chords.push({ section, deg, tones, ladder: ladderOf(tones), bars: chordBars });
      }
    }
  });

  // Melody motifs: 4-bar phrases built as A A' B C (C ends on a long note).
  const motifA = pick(RHYTHMS[beats]), motifB = pick(RHYTHMS[beats]), ending = pick(ENDINGS[beats]);
  const phraseRhythm = [motifA, motifA, motifB, ending];
  let melodyPitch = key + 24 + scale[2];
  let contour = null;
  const melodyLow = key + 14, melodyHigh = key + 33;
  const nearestChordTone = (p, tones, prefer = null) => {
    let best = p, bestD = 99;
    for (const t of prefer ?? tones) {
      for (let o = -24; o <= 36; o += 12) {
        const c = t + o, d = Math.abs(c - p);
        if (d < bestD && c >= melodyLow - 2 && c <= melodyHigh + 2) { best = c; bestD = d; }
      }
    }
    return best;
  };
  const stepScale = (p, steps) => {
    // Move `steps` scale degrees from pitch p (snapping p into the scale first).
    let deg = 0;
    for (let d = -21; d <= 35; d++) if (degreeNote(d) <= p) deg = d;
    return degreeNote(deg + steps);
  };

  let t = 0;
  let bar = 0;
  let phraseBar = 0;
  const jitter = () => (r() - 0.5) * 0.024;
  for (let ci = 0; ci < chords.length; ci++) {
    const c = chords[ci];
    group++;
    const last = ci === chords.length - 1;
    const section = c.section;
    const quiet = section === 'intro' || section === 'outro';
    const fig = section === 'b' ? figureB : figure;
    const dyn = section === 'b' ? 0.85 : section === 'a2' ? 1.05 : quiet ? 0.8 : 1;
    // Bass on the downbeat, held.
    events.push({ t: t + jitter(), midi: c.ladder[0] - (r() < 0.5 ? 12 : 0), vel: 0.5 * dyn, group, bass: true });
    if (withPad) for (const m of [c.ladder[0] + 12, c.ladder[1] + 12, c.ladder[3]]) events.push({ kind: 'pad', t, midi: m, vel: 1, group });
    for (let b = 0; b < c.bars; b++) {
      // Arpeggio.
      const figT = t + b * eighths * e8;
      if (!(section === 'intro' && bar === 0 && b === 0 && r() < 0.3)) {
        fig.forEach((idx, k) => {
          if (idx < 0) return;
          if (section === 'outro' && last && k > 0) return;
          const midi = c.ladder[Math.min(idx, c.ladder.length - 1)];
          const accent = k === 0 ? 1.15 : k % 2 ? 0.8 : 0.95;
          events.push({ t: figT + k * e8 + jitter(), midi, vel: 0.3 * accent * dyn, group });
        });
      }
      // Melody in the A sections (and a sparse, high answer in B).
      if (section === 'a' || section === 'a2' || (section === 'b' && r() < 0.35)) {
        const rhythm = section === 'b' ? pick(ENDINGS[beats]) : phraseRhythm[phraseBar % 4];
        let mt = figT;
        rhythm.forEach((len, k) => {
          const dur = Math.abs(len) * e8;
          if (len > 0) {
            const strong = k === 0 || len >= 4;
            const pos = (phraseBar % 4) * 8 + k;
            let steps;
            if (contour && section === 'a2' && contour[pos] !== undefined && r() < 0.75) steps = contour[pos];
            else steps = pick([-2, -1, -1, -1, 0, 1, 1, 1, 2, 2, -3, 3]);
            if (melodyPitch > melodyHigh - 3) steps = -Math.abs(steps) || -1;
            if (melodyPitch < melodyLow + 3) steps = Math.abs(steps) || 1;
            let p = stepScale(melodyPitch, steps);
            const phraseEnd = phraseBar % 4 === 3 && k === rhythm.length - 1;
            if (phraseEnd) p = nearestChordTone(p, c.tones, [c.tones[0], c.tones[1]]);
            else if (strong) p = nearestChordTone(p, c.tones);
            p = clamp(p, melodyLow, melodyHigh);
            if (section === 'b') p = nearestChordTone(p + 12, c.tones);
            if (section === 'a') { contour ??= []; contour[pos] = steps; }
            melodyPitch = p;
            events.push({ t: mt + jitter() * 1.5, midi: p, vel: (section === 'b' ? 0.36 : 0.52) * dyn * (strong ? 1.08 : 0.95), group: -1, len: dur + e8 * 1.5 });
          }
          mt += dur;
        });
        phraseBar++;
      }
      bar++;
    }
    t += c.bars * eighths * e8;
    // Slow down into the last chord.
    if (ci >= chords.length - 2) t += e8 * (ci === chords.length - 2 ? 0.6 : 0);
    events.push({ kind: 'release', t: last ? t + 3 : t - 0.02, group });
  }
  // A final rolled tonic chord that rings out.
  group++;
  const final = ladderOf(chordOf(0));
  events.push({ t, midi: final[0] - 12, vel: 0.45, group, bass: true });
  final.slice(1, 6).forEach((m, k) => events.push({ t: t + 0.07 * (k + 1), midi: m, vel: 0.32, group }));
  events.sort((a, b) => a.t - b.t);
  return { events, length: t + 7, mood };
}
