// Music you make: note blocks and jukeboxes. Every instrument here is synthesised as it plays
// (a plucked string, a struck bar, a breathy pipe, a chip-tune square, drums), in the manner of
// the original's note block instruments; the songs on the discs are written by the same composer
// as the background music (music.js), each disc in its own style, and are heard from the jukebox
// that plays them, fading with distance.
import { B, BLOCKS, NOTE, JUKEBOX } from './blocks.js';
import { discTitle } from './items.js';
import { compose, makeImpulse } from './music.js';

// ---------------------------------------------------------------- instruments
let noiseBuf = null;
function noise(ctx) {
  if (noiseBuf?.sampleRate === ctx.sampleRate) return noiseBuf;
  noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
  const d = noiseBuf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  return noiseBuf;
}
function env(ctx, out, t, v, attack, decay) {
  const g = ctx.createGain();
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(v, t + attack);
  g.gain.exponentialRampToValueAtTime(0.0005, t + attack + decay);
  g.connect(out);
  return g;
}
function osc(ctx, type, f, t, end, dest) {
  const o = ctx.createOscillator();
  o.type = type;
  o.frequency.value = f;
  o.connect(dest);
  o.start(t);
  o.stop(end);
  return o;
}
// A plucked string: a bright wave through a filter that closes as it rings.
function pluck(ctx, out, f, t, v, type, decay, bright) {
  const g = env(ctx, out, t, v, 0.004, decay);
  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.setValueAtTime(Math.min(12000, bright), t);
  lp.frequency.exponentialRampToValueAtTime(Math.max(180, Math.min(bright, f * 2)), t + decay * 0.8);
  lp.connect(g);
  osc(ctx, type, f, t, t + decay + 0.1, lp);
  // (The octave above, quietly, for the body of the string.)
  const g2 = ctx.createGain();
  g2.gain.value = 0.18;
  g2.connect(lp);
  osc(ctx, 'sine', f * 2, t, t + decay + 0.1, g2);
}
// A struck bar or bell: sine partials, the higher ones dying away sooner.
function struck(ctx, out, f, t, v, ratios, amps, decay) {
  ratios.forEach((ratio, i) => {
    if (f * ratio > 16000) return;
    const d = decay / (1 + i * 0.7);
    osc(ctx, 'sine', f * ratio, t, t + d + 0.1, env(ctx, out, t, v * amps[i], 0.002, d));
  });
}
// A pipe: a sine with a little vibrato and breath, held for `len`.
function blown(ctx, out, f, t, v, len) {
  const hold = Math.max(0.18, len), g = ctx.createGain();
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(v, t + 0.06);
  g.gain.setValueAtTime(v, t + hold);
  g.gain.exponentialRampToValueAtTime(0.0005, t + hold + 0.25);
  g.connect(out);
  const o = osc(ctx, 'sine', f, t, t + hold + 0.3, g);
  const lfo = ctx.createOscillator(), depth = ctx.createGain();
  lfo.frequency.value = 5.2;
  depth.gain.value = f * 0.006;
  lfo.connect(depth).connect(o.frequency);
  lfo.start(t);
  lfo.stop(t + hold + 0.3);
  const n = ctx.createBufferSource(), bp = ctx.createBiquadFilter(), ng = ctx.createGain();
  n.buffer = noise(ctx);
  bp.type = 'bandpass'; bp.frequency.value = f * 2; bp.Q.value = 3;
  ng.gain.value = 0.25;
  n.connect(bp).connect(ng).connect(g);
  n.start(t, Math.random() * 0.5, hold + 0.3);
}
// Chip-tune: a square wave, a little detuned against itself.
function chip(ctx, out, f, t, v, len) {
  const d = Math.max(0.12, Math.min(len, 0.6));
  const g = env(ctx, out, t, v * 0.5, 0.003, d);
  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass'; lp.frequency.value = 5000;
  lp.connect(g);
  osc(ctx, 'square', f, t, t + d + 0.1, lp);
  osc(ctx, 'square', f * 1.003, t, t + d + 0.1, lp);
}
// An electric piano: a sine whose tone is shaped by a second one (frequency modulation).
function fm(ctx, out, f, t, v, ratio, index, decay) {
  const g = env(ctx, out, t, v, 0.003, decay);
  const car = osc(ctx, 'sine', f, t, t + decay + 0.1, g);
  const mod = ctx.createOscillator(), mg = ctx.createGain();
  mod.frequency.value = f * ratio;
  mg.gain.setValueAtTime(f * index, t);
  mg.gain.exponentialRampToValueAtTime(f * 0.05, t + decay * 0.6);
  mod.connect(mg).connect(car.frequency);
  mod.start(t);
  mod.stop(t + decay + 0.1);
}
// Drums: a falling sine for the bass drum, and filtered noise for the snare and the hat.
function kick(ctx, out, f, t, v) {
  const o = osc(ctx, 'sine', f, t, t + 0.35, env(ctx, out, t, v * 1.4, 0.002, 0.3));
  o.frequency.setValueAtTime(f * 2.5, t);
  o.frequency.exponentialRampToValueAtTime(f * 0.6, t + 0.16);
}
function hit(ctx, out, t, v, type, freq, decay) {
  const n = ctx.createBufferSource(), flt = ctx.createBiquadFilter();
  n.buffer = noise(ctx);
  flt.type = type; flt.frequency.value = freq; flt.Q.value = 0.8;
  n.connect(flt).connect(env(ctx, out, t, v, 0.001, decay));
  n.start(t, Math.random() * 0.5, decay + 0.05);
}

// The instruments: how each sounds, and how far from the harp's octave it plays.
export const INSTRUMENTS = {
  harp: { octave: 0, play: (c, o, f, t, v) => pluck(c, o, f, t, v * 0.5, 'triangle', 1.4, 6000) },
  bass: { octave: -2, play: (c, o, f, t, v) => pluck(c, o, f, t, v * 0.8, 'sawtooth', 0.9, 700) },
  guitar: { octave: -1, play: (c, o, f, t, v) => pluck(c, o, f, t, v * 0.45, 'sawtooth', 1.2, 2600) },
  banjo: { octave: 0, play: (c, o, f, t, v) => pluck(c, o, f, t, v * 0.35, 'square', 0.55, 4200) },
  didgeridoo: { octave: -2, play: (c, o, f, t, v) => pluck(c, o, f, t, v * 0.9, 'sawtooth', 1.3, 420) },
  bell: { octave: 2, play: (c, o, f, t, v) => struck(c, o, f, t, v * 0.35, [1, 2.76, 5.4, 8.93], [1, 0.5, 0.25, 0.12], 2.4) },
  chime: { octave: 2, play: (c, o, f, t, v) => struck(c, o, f, t, v * 0.3, [1, 2.4, 4.1, 6.3], [1, 0.45, 0.2, 0.1], 3.4) },
  xylophone: { octave: 2, play: (c, o, f, t, v) => struck(c, o, f, t, v * 0.45, [1, 3.93, 9.2], [1, 0.3, 0.1], 0.5) },
  iron_xylophone: { octave: 0, play: (c, o, f, t, v) => struck(c, o, f, t, v * 0.4, [1, 2.01, 4.02], [1, 0.4, 0.2], 1.1) },
  cow_bell: { octave: 1, play: (c, o, f, t, v) => struck(c, o, f, t, v * 0.35, [1, 1.48, 2.3], [1, 0.8, 0.3], 0.5) },
  music_box: { octave: 1, play: (c, o, f, t, v) => struck(c, o, f, t, v * 0.4, [1, 4, 6.8], [1, 0.25, 0.08], 1.6) },
  flute: { octave: 1, play: (c, o, f, t, v, len) => blown(c, o, f, t, v * 0.4, len ?? 0.4) },
  bit: { octave: 0, play: (c, o, f, t, v, len) => chip(c, o, f, t, v * 0.32, len ?? 0.3) },
  pling: { octave: 0, play: (c, o, f, t, v) => fm(c, o, f, t, v * 0.4, 1, 1.6, 1.4) },
  basedrum: { octave: -2, drum: true, play: (c, o, f, t, v) => kick(c, o, f, t, v * 0.8) },
  snare: { octave: 0, drum: true, play: (c, o, f, t, v) => hit(c, o, t, v * 0.5, 'bandpass', 1400 + f, 0.16) },
  hat: { octave: 0, drum: true, play: (c, o, f, t, v) => hit(c, o, t, v * 0.35, 'highpass', 5000 + f * 4, 0.06) },
};

// A note block's instrument, from the block it stands on (as in the original, more or less).
const BY_NAME = { gold_block: 'bell', clay: 'flute', packed_ice: 'chime', iron_block: 'iron_xylophone', pumpkin: 'didgeridoo', carved_pumpkin: 'didgeridoo',
  emerald_block: 'bit', hay_block: 'banjo', glowstone: 'pling', bone_block: 'xylophone', soul_sand: 'cow_bell', calcite: 'xylophone' };
export function instrumentFor(below) {
  const d = BLOCKS[below];
  if (!d || !below) return 'harp';
  if (BY_NAME[d.name]) return BY_NAME[d.name];
  if (/_wool$|_carpet$/.test(d.name)) return 'guitar';
  if (d.sound === 'wood') return 'bass';
  if (/sand$|gravel|_concrete_powder$/.test(d.name)) return 'snare';
  if (d.sound === 'glass') return 'hat';
  if (d.sound === 'stone' && d.solid) return 'basedrum';
  return 'harp';
}
// Pitch 0-24 is F#3 to F#5 on the harp (a note block's 25 notes).
export const noteFreq = (instrument, pitch) => 369.99 * 2 ** ((pitch - 12) / 12 + (INSTRUMENTS[instrument]?.octave ?? 0));
// The colour of a note's particle: round the colour wheel with the pitch.
export function noteColour(pitch) {
  const h = (((1 / 3 - pitch / 24) % 1) + 1) % 1, k = (n) => (n + h * 6) % 6, f = (n) => 1 - Math.max(0, Math.min(k(n), 4 - k(n), 1));
  return (Math.round(f(5) * 255) << 16) | (Math.round(f(3) * 255) << 8) | Math.round(f(1) * 255);
}
export function playNote(ctx, out, instrument, pitch, t, v = 1) {
  const ins = INSTRUMENTS[instrument] ?? INSTRUMENTS.harp;
  ins.play(ctx, out, noteFreq(instrument, pitch), t, v);
}

// ---------------------------------------------------------------- the discs' songs
// Each disc: the composer's seed, and its style (mode, tempo, instruments).
const PIANO = 'piano';
export const DISC_STYLES = [
  { seed: 7001, mood: 'day', mode: 'major', bpm: 84, beats: 4, pad: true, lead: PIANO, bass: PIANO, seconds: 170 },
  { seed: 7002, mood: 'cave', mode: 'aeolian', bpm: 58, beats: 4, pad: true, lead: PIANO, bass: PIANO, seconds: 190 },
  { seed: 7003, mood: 'day', mode: 'dorian', bpm: 100, beats: 4, pad: false, lead: 'guitar', bass: 'bass', seconds: 160 },
  { seed: 7004, mood: 'day', mode: 'lydian', bpm: 72, beats: 4, pad: true, lead: 'pling', bass: 'bass', seconds: 180 },
  { seed: 7005, mood: 'day', mode: 'major', bpm: 92, beats: 3, pad: false, lead: 'music_box', bass: 'music_box', seconds: 150 },
  { seed: 7006, mood: 'night', mode: 'aeolian', bpm: 76, beats: 4, pad: true, lead: 'harp', bass: 'bass', seconds: 170 },
  { seed: 7007, mood: 'day', mode: 'dorian', bpm: 124, beats: 4, pad: false, lead: 'bit', bass: 'bit', drums: true, seconds: 150 },
  { seed: 7008, mood: 'night', mode: 'lydian', bpm: 64, beats: 4, pad: true, lead: 'bell', bass: 'bass', seconds: 200 },
];

// One disc playing in one jukebox. `level` (0-1) and `pan` place it for the listener.
export class DiscPlayer {
  constructor(audio, disc) {
    const ctx = audio.ctx, style = DISC_STYLES[disc];
    this.audio = audio; this.ctx = ctx; this.style = style; this.disc = disc;
    this.piece = compose(style.seed, style.mood, style);
    this.t0 = ctx.currentTime + 0.5;
    this.i = 0;
    this.out = ctx.createGain();
    this.out.gain.value = 0;
    this.panner = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
    (this.panner ? this.out.connect(this.panner) : this.out).connect(audio.sfx);
    // The song, with a little of the room it's in, through a limiter (so no chord ever clips).
    this.bus = ctx.createGain();
    this.bus.gain.value = 0.9;
    const mix = ctx.createGain(), limit = ctx.createDynamicsCompressor();
    limit.threshold.value = -9; limit.knee.value = 6; limit.ratio.value = 8; limit.attack.value = 0.004; limit.release.value = 0.25;
    mix.connect(limit).connect(this.out);
    this.bus.connect(mix);
    audio.discVerb ??= makeImpulse(ctx, 2.2);
    const verb = ctx.createConvolver(), wet = ctx.createGain();
    verb.buffer = audio.discVerb;
    wet.gain.value = 0.3;
    this.bus.connect(verb).connect(wet).connect(mix);
    this.pads = [];
  }
  get over() { return this.ctx.currentTime > this.t0 + this.piece.length; }

  update(level, pan) {
    const ctx = this.ctx, now = ctx.currentTime, p = this.piece;
    this.out.gain.setTargetAtTime(level, now, 0.15);
    if (this.panner) this.panner.pan.setTargetAtTime(pan, now, 0.15);
    while (this.i < p.events.length && this.t0 + p.events[this.i].t < now + 0.5) {
      const e = p.events[this.i++], at = this.t0 + e.t;
      if (at < now - 0.05) continue;
      if (e.kind === 'pad') this.pad(e, at);
      else if (e.kind === 'release') this.release(e.group, at);
      else this.note(e, at);
    }
    if (this.style.drums) this.drums(now);
  }

  note(e, at) {
    const ins = e.bass ? this.style.bass : this.style.lead;
    if (ins === PIANO && this.audio.music?.ready) this.piano(e.midi, at, e.vel, e.len);
    else {
      const name = ins === PIANO ? 'harp' : ins, def = INSTRUMENTS[name];
      // (The composer writes around middle C; each instrument plays in its own octave.)
      const f = 440 * 2 ** ((e.midi - 69) / 12 + (e.bass ? 0 : Math.max(0, def.octave - 1)));
      def.play(this.ctx, this.bus, f, at, e.vel * 1.4, e.len);
    }
  }

  // Drums, for the discs that have them: bass drum on one and three, snare on two and four, the
  // hat on every eighth (until the last few bars).
  drums(now) {
    const s = this.style, e8 = 30 / s.bpm, end = this.t0 + this.piece.length - 10;
    this.beat ??= 0;
    for (let at = this.t0 + this.beat * e8; at < now + 0.5 && at < end; at = this.t0 + ++this.beat * e8) {
      if (at < now - 0.05) continue;
      const k = this.beat % 8;
      if (k === 0 || k === 4) INSTRUMENTS.basedrum.play(this.ctx, this.bus, 55, at, 0.55);
      if (k === 2 || k === 6) INSTRUMENTS.snare.play(this.ctx, this.bus, 200, at, 0.5);
      INSTRUMENTS.hat.play(this.ctx, this.bus, 200, at, k % 2 ? 0.18 : 0.26);
    }
  }

  piano(midi, at, vel, len) {
    const ctx = this.ctx, samples = this.audio.music.samples;
    let s = samples[0];
    for (const x of samples) if (Math.abs(x.midi - midi) < Math.abs(s.midi - midi)) s = x;
    const src = ctx.createBufferSource(), g = ctx.createGain();
    src.buffer = s.buffer;
    src.playbackRate.value = 2 ** ((midi - s.midi) / 12);
    g.gain.setValueAtTime(vel * 0.8, at);
    if (len) { g.gain.setValueAtTime(vel * 0.8, at + len); g.gain.setTargetAtTime(0, at + len, 0.28); }
    src.connect(g).connect(this.bus);
    src.start(at);
    src.stop(at + Math.min(s.buffer.duration / src.playbackRate.value, len ? len + 2 : 99));
  }

  pad(e, at) {
    const ctx = this.ctx, g = ctx.createGain(), lp = ctx.createBiquadFilter();
    g.gain.setValueAtTime(0, at);
    g.gain.linearRampToValueAtTime(e.vel * 0.04, at + 1.4);
    lp.type = 'lowpass'; lp.frequency.value = 800;
    lp.connect(g).connect(this.bus);
    const f = 440 * 2 ** ((e.midi - 69) / 12);
    const oscs = [-7, 7].map((d) => { const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = f; o.detune.value = d; o.connect(lp); o.start(at); return o; });
    this.pads.push({ oscs, g, group: e.group });
  }
  release(group, at) {
    for (const v of this.pads) {
      if (v.group !== group) continue;
      v.g.gain.cancelScheduledValues(at);
      v.g.gain.setTargetAtTime(0, at, 0.6);
      for (const o of v.oscs) o.stop(at + 3);
    }
    this.pads = this.pads.filter((v) => v.group !== group);
  }

  stop() {
    const now = this.ctx.currentTime;
    this.out.gain.cancelScheduledValues(now);
    this.out.gain.setTargetAtTime(0, now, 0.2);
    for (const v of this.pads) for (const o of v.oscs) o.stop(now + 1.5);
    this.pads = [];
    this.i = this.piece.events.length;
    setTimeout(() => { try { this.out.disconnect(); } catch { /* gone already */ } }, 2500);
  }
}

// ---------------------------------------------------------------- jukeboxes
// The jukeboxes with discs in them near this player, playing. Each plays its song once through
// (from the start, whenever this player first comes within earshot of it) and is heard up to
// RANGE blocks away.
const RANGE = 56;
export class Jukeboxes {
  constructor(game) {
    this.game = game;
    this.playing = new Map(); // "x,y,z" -> { x, y, z, disc, player, level }
    this.heard = new Set();   // "x,y,z,disc": songs played through already
  }

  // A jukebox (or what was one) changed; `fresh`: a disc was just put in, here and now.
  changed(x, y, z, id, fresh) {
    const key = `${x},${y},${z}`, disc = JUKEBOX[id] ?? -1;
    const cur = this.playing.get(key);
    if (cur && cur.disc === disc) return;
    if (cur) { cur.player?.stop(); this.playing.delete(key); }
    for (const k of [...this.heard]) if (k.startsWith(`${key},`)) this.heard.delete(k);
    if (disc >= 0) this.start(x, y, z, disc, fresh);
  }
  // What a look around found: jukeboxes with discs in (`[x, y, z, disc]`).
  found(list) {
    for (const [x, y, z, disc] of list) {
      const key = `${x},${y},${z}`;
      if (!this.playing.has(key) && !this.heard.has(`${key},${disc}`)) this.start(x, y, z, disc, false);
    }
  }
  start(x, y, z, disc, fresh) {
    const key = `${x},${y},${z}`, audio = this.game.audio;
    this.playing.set(key, { x, y, z, disc, player: audio.ctx ? new DiscPlayer(audio, disc) : null, level: 0 });
    const p = this.game.player;
    if (fresh && p && Math.hypot(x + 0.5 - p.x, y + 0.5 - p.y, z + 0.5 - p.z) < 16) this.game.ui.showItemName(`Now Playing: ${discTitle(disc)}`, 3500, 'now-playing');
  }

  // Each frame: move each song with the listener, and drop the ones that are over or gone.
  update() {
    const w = this.game.world, audio = this.game.audio;
    if (!w) { this.clear(); return; }
    const L = audio.listener;
    for (const [key, j] of this.playing) {
      const d = Math.hypot(j.x + 0.5 - L.x, j.y + 0.5 - L.y, j.z + 0.5 - L.z);
      if (JUKEBOX[w.getBlock(j.x, j.y, j.z)] !== j.disc || d > RANGE + 16) { j.player?.stop(); this.playing.delete(key); continue; }
      if (!j.player && audio.ctx) j.player = new DiscPlayer(audio, j.disc);
      if (!j.player) continue;
      if (j.player.over) { j.player.stop(); this.playing.delete(key); this.heard.add(`${key},${j.disc}`); continue; }
      j.level = Math.max(0, 1 - d / RANGE) ** 1.6;
      const pan = d > 0.8 ? Math.max(-1, Math.min(1, ((j.x + 0.5 - L.x) * Math.cos(L.yaw) - (j.z + 0.5 - L.z) * Math.sin(L.yaw)) / d)) * 0.6 : 0;
      j.player.update(j.level, pan);
    }
  }
  // Is a song loud enough here that the background music should make way for it?
  get audible() { for (const j of this.playing.values()) if (j.level > 0.08) return true; return false; }

  clear() {
    for (const j of this.playing.values()) j.player?.stop();
    this.playing.clear();
    this.heard.clear();
  }
}

// ---------------------------------------------------------------- note blocks
// Whether a note block at x, y, z can sound (the original needs air above it).
export const noteClear = (w, x, y, z) => !BLOCKS[w.getBlock(x, y + 1, z)]?.solid;
// The block a note block becomes when used: a semitone up (after the top note, back to the bottom).
export const nextNote = (id) => B.note_block + ((NOTE[id] + 1) % 25);
