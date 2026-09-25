// Sound effects are short recordings (public domain, see assets/sounds/CREDITS.md) played with
// Minecraft-like volume and pitch rules, panned and faded by where they happen. Music: music.js.
import { SOUNDS } from './sounddata.js';
import { Music } from './music.js';
import { playNote } from './jukebox.js';

// Which recordings each block sound type uses. Glass places like stone but shatters when broken.
const MATERIALS = {
  stone: { dig: 'stone.dig', step: 'stone.step' },
  wood: { dig: 'wood.dig', step: 'wood.step' },
  grass: { dig: 'grass.dig', step: 'grass.step' },
  gravel: { dig: 'gravel.dig', step: 'gravel.dig' },
  sand: { dig: 'sand.dig', step: 'sand.dig' },
  snow: { dig: 'snow.dig', step: 'snow.dig' },
  cloth: { dig: 'cloth.dig', step: 'cloth.step' },
  glass: { dig: 'stone.dig', step: 'stone.step', brk: 'glass.break' },
  metal: { dig: 'metal.dig', step: 'metal.step' },
  water: { dig: 'water.swim', step: 'water.swim' },
};

// Mob sound fallbacks: hurt reuses the idle sound pitched up, death reuses hurt pitched down.
const MOB_PITCH = { chicken: 1.1 };
const BORROW = { goat: ['sheep', 0.78], bear: ['cow', 0.55], husk: ['zombie', 0.8], llama: ['sheep', 0.62] };
const SYNTH = new Set(['rabbit', 'fox', 'wolf', 'fish', 'skeleton', 'creeper', 'spider', 'enderman', 'slime', 'horse', 'golem', 'cat', 'bat',
  'donkey', 'witch', 'phantom', 'parrot', 'dolphin', 'turtle', 'snow_golem']);

// A low thump layered under breaking and placing, by block material: [start Hz, end Hz, gain].
const THUMP = {
  stone: [150, 58, 0.34], wood: [128, 52, 0.36], metal: [170, 70, 0.3], grass: [105, 48, 0.2], gravel: [110, 48, 0.24],
  sand: [95, 45, 0.18], snow: [90, 45, 0.14], cloth: [90, 42, 0.14], glass: [0, 0, 0], water: [0, 0, 0],
};
// Music is background: at the default settings it plays about 9 dB below footsteps and 23 dB
// below breaking a block. Both volume sliders follow a squared curve, so each step sounds even.
const MUSIC_LEVEL = 1.4;
const sfxGain = (v) => v * v;
const musicGain = (v) => v * v * MUSIC_LEVEL;

function trimStart(ctx, buf) {
  // Some decoders leave the MP3 encoder's silent lead-in in place; cut it so sounds start on time.
  const d = buf.getChannelData(0);
  let i = 0;
  while (i < Math.min(d.length, 6000) && Math.abs(d[i]) < 0.004) i++;
  const start = i - Math.round(ctx.sampleRate * 0.002);
  if (start < 48 || i >= Math.min(d.length, 6000)) return buf;
  const out = ctx.createBuffer(buf.numberOfChannels, buf.length - start, buf.sampleRate);
  for (let ch = 0; ch < buf.numberOfChannels; ch++) out.copyToChannel(buf.getChannelData(ch).subarray(start), ch);
  return out;
}

// A seamless loop: the end of the recording is cross-faded into its beginning.
function makeLoop(ctx, buf, fade) {
  const n = Math.floor(fade * buf.sampleRate);
  if (buf.length < n * 3) return buf;
  const len = buf.length - n;
  const out = ctx.createBuffer(buf.numberOfChannels, len, buf.sampleRate);
  for (let ch = 0; ch < buf.numberOfChannels; ch++) {
    const src = buf.getChannelData(ch), dst = out.getChannelData(ch);
    dst.set(src.subarray(0, len));
    for (let i = 0; i < n; i++) { const t = i / n; dst[i] = src[i] * Math.sqrt(t) + src[len + i] * Math.sqrt(1 - t); }
  }
  return out;
}

export class Audio {
  constructor() {
    this.ctx = null;
    this.volume = 0.6;
    this.musicVolume = 0.4;
    this.buffers = {};
    this.last = {};
    this.active = 0;
    this.listener = { x: 0, y: 0, z: 0, yaw: 0 };
    this.underwater = false;
    this.music = null;
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
    this.master.gain.value = sfxGain(this.volume);
    this.master.connect(ctx.destination);
    // Effects go through a gentle compressor, so a pile of overlapping sounds (an explosion, a
    // herd of animals) doesn't get harsh or clip.
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -18;
    comp.knee.value = 12;
    comp.ratio.value = 3;
    comp.attack.value = 0.003;
    comp.release.value = 0.2;
    comp.connect(this.master);
    // Everything sounds muffled with your head underwater.
    this.muffle = ctx.createBiquadFilter();
    this.muffle.type = 'lowpass';
    this.muffle.frequency.value = 20000;
    this.muffle.Q.value = 0.6;
    this.muffle.connect(comp);
    this.sfx = ctx.createGain();
    this.sfx.connect(this.muffle);
    // (Sounds that shouldn't be muffled: the splash of going under.)
    this.dry = ctx.createGain();
    this.dry.connect(comp);
    this.noise = ctx.createBuffer(1, Math.round(ctx.sampleRate * 0.05), ctx.sampleRate);
    const nd = this.noise.getChannelData(0);
    for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;
    this.musicGain = ctx.createGain();
    this.musicGain.gain.value = musicGain(this.musicVolume);
    this.musicGain.connect(ctx.destination);
    this.music = new Music(ctx, this.musicGain);
    this.load();
  }

  async load() {
    await Promise.all(Object.entries(SOUNDS).map(async ([name, list]) => {
      const bufs = await Promise.all(list.map((b64) => this.decode(b64).catch(() => null)));
      this.buffers[name] = bufs.filter(Boolean);
    }));
  }

  decode(b64) {
    const bin = atob(b64), bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new Promise((resolve, reject) => this.ctx.decodeAudioData(bytes.buffer, resolve, reject))
      .then((buf) => trimStart(this.ctx, buf));
  }

  setVolume(v) { this.volume = v; if (this.master) this.master.gain.value = sfxGain(v); }
  setMusicVolume(v) { this.musicVolume = v; if (this.musicGain) this.musicGain.gain.value = musicGain(v); }

  setListener(x, y, z, yaw, underwater) {
    const L = this.listener;
    L.x = x; L.y = y; L.z = z; L.yaw = yaw;
    if (underwater !== this.underwater && this.ctx) {
      this.underwater = underwater;
      this.muffle.frequency.setTargetAtTime(underwater ? 650 : 20000, this.ctx.currentTime, 0.08);
    }
  }

  get ready() { return !!this.ctx && this.ctx.state === 'running' && this.volume > 0; }

  // Loudness and stereo position of a sound at `at` (null: right here), or null if out of earshot.
  // Sounds fade out over 16 blocks (more for loud ones) and pan towards their side.
  spatial(at, volume) {
    let gain = Math.min(1, volume), pan = 0;
    if (at) {
      const L = this.listener;
      const dx = at.x - L.x, dy = at.y - L.y, dz = at.z - L.z;
      const dist = Math.hypot(dx, dy, dz);
      const range = 16 * Math.max(1, volume);
      if (dist >= range) return null;
      gain *= 1 - dist / range;
      if (dist > 0.6) pan = Math.max(-1, Math.min(1, (dx * Math.cos(L.yaw) - dz * Math.sin(L.yaw)) / dist)) * 0.7;
    }
    return gain < 0.01 ? null : { gain, pan };
  }

  // Connects a source through its gain (and panner) to the effects bus (or, `dry`, around the
  // underwater muffling).
  output(node, gainNode, pan, dry = false) {
    let n = node.connect(gainNode);
    if (pan && this.ctx.createStereoPanner) {
      const p = this.ctx.createStereoPanner();
      p.pan.value = pan;
      n = n.connect(p);
    }
    n.connect(dry ? this.dry : this.sfx);
  }

  // Plays one of the recordings called `name`. With `at`, the sound comes from that point.
  // `offset`/`length` play just part of it (with short fades), for long recordings like fire.
  play(name, { volume = 1, pitch = 1, at = null, vary = 0.1, offset = null, length = null, dry = false } = {}) {
    const ctx = this.ctx, list = this.buffers[name];
    if (!this.ready || !list?.length) return;
    const sp = this.spatial(at, volume);
    if (!sp || (this.active > 40 && sp.gain < 0.25)) return;
    let i = Math.floor(Math.random() * list.length);
    if (list.length > 1 && i === this.last[name]) i = (i + 1) % list.length;
    this.last[name] = i;
    const src = ctx.createBufferSource();
    src.buffer = list[i];
    src.playbackRate.value = pitch * (1 + (Math.random() - Math.random()) * vary);
    const g = ctx.createGain();
    g.gain.value = sp.gain;
    this.output(src, g, sp.pan, dry);
    this.active++;
    src.onended = () => { this.active--; };
    if (offset === null) { src.start(); return; }
    const t = ctx.currentTime, start = Math.min(offset, Math.max(0, src.buffer.duration - length));
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(sp.gain, t + 0.05);
    g.gain.setValueAtTime(sp.gain, t + length - 0.12);
    g.gain.linearRampToValueAtTime(0, t + length);
    src.start(t, start, length);
  }

  // A short low thump (a falling sine), layered under hits and blocks for weight.
  thump(at, freq, end, volume, time = 0.09) {
    if (!this.ready || !freq) return;
    const sp = this.spatial(at, 1);
    if (!sp) return;
    const ctx = this.ctx, t = ctx.currentTime;
    const osc = ctx.createOscillator();
    osc.frequency.setValueAtTime(freq, t);
    osc.frequency.exponentialRampToValueAtTime(end, t + time);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(volume * sp.gain, t + 0.004);
    g.gain.exponentialRampToValueAtTime(0.0005, t + time + 0.05);
    this.output(osc, g, sp.pan);
    osc.start(t);
    osc.stop(t + time + 0.06);
  }

  // A tiny bright tick at the start of a mining hit, so each hit reads crisply.
  tick(at, volume, freq = 2400) {
    if (!this.ready) return;
    const sp = this.spatial(at, 1);
    if (!sp) return;
    const ctx = this.ctx, t = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    const f = ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.value = freq;
    f.Q.value = 1.4;
    const g = ctx.createGain();
    g.gain.setValueAtTime(volume * sp.gain, t);
    g.gain.exponentialRampToValueAtTime(0.0005, t + 0.03);
    src.connect(f);
    this.output(f, g, sp.pan);
    src.start(t);
  }

  mat(m) { return MATERIALS[m] ?? MATERIALS.stone; }
  // Mining: a quieter, deeper version of the footstep a few times a second, with a crisp tick.
  dig(m, at) {
    this.play(this.mat(m).step, { volume: 0.34, pitch: 0.62, at });
    this.tick(at, m === 'stone' || m === 'metal' ? 0.05 : 0.03, m === 'wood' ? 1600 : 2400);
  }
  // Breaking and placing: the block's own sound over a low thump.
  breakBlock(m, at) {
    const s = this.mat(m), th = THUMP[m] ?? THUMP.stone;
    this.play(s.brk ?? s.dig, { volume: 1, pitch: s.brk ? 1 : 0.85, at });
    this.thump(at, th[0], th[1], th[2]);
  }
  place(m, at) {
    const th = THUMP[m] ?? THUMP.stone;
    this.play(this.mat(m).dig, { volume: 0.95, pitch: 0.85, at });
    this.thump(at, th[0] * 1.15, th[1], th[2] * 0.6, 0.06);
  }
  step(m, volume = 0.22) { this.play(this.mat(m).step, { volume }); }
  land(m) { this.play(this.mat(m).step, { volume: 0.45, pitch: 0.75 }); }
  click() { this.play('ui.click', { volume: 0.45, vary: 0 }); }
  pop(at = null) { this.play('item.pop', { volume: 0.3, pitch: 1.25, vary: 0.35, at }); }
  hurt() { this.play('player.hurt', { volume: 0.85 }); }
  fall(big) { this.play(big ? 'hit.fall' : 'hit.fallsmall', { volume: 0.7 }); }
  punch(at) { this.play('hit.punch', { volume: 0.55, at }); }
  // Hitting a mob: a swipe if the weapon hasn't wound up, a heavy hit if it has, and a sharp crack
  // on top for a critical hit. `blade`: swords and axes swish a little lower.
  attack(kind, at, blade = false) {
    if (kind === 'weak') {
      this.play('attack.weak', { volume: 0.55, pitch: blade ? 0.9 : 1.1, at });
      this.play('hit.punch', { volume: 0.22, pitch: 1.1, at });
      return;
    }
    this.play('attack.strong', { volume: 0.95, pitch: blade ? 0.92 : 1, at });
    this.thump(at, 120, 48, 0.4, 0.1);
    if (kind === 'crit') this.play('attack.crit', { volume: 0.75, pitch: 1.05, vary: 0.12, at });
  }
  // Taking something out of a crafting grid: a soft pop and a woody knock.
  craft() {
    this.play('item.pop', { volume: 0.4, pitch: 0.78, vary: 0.08 });
    this.play('wood.dig', { volume: 0.2, pitch: 1.35, vary: 0.05 });
  }
  equip(material) {
    if (material === 'leather') this.play('armor.leather', { volume: 0.75 });
    else this.play('armor.metal', { volume: 0.7, pitch: material === 'golden' ? 1.12 : material === 'diamond' ? 1.22 : 0.95 });
  }
  // A burning furnace crackles now and then: a short piece of a long fire recording.
  furnace(at) {
    const list = this.buffers['furnace.crackle'];
    if (!list?.length) return;
    const len = 0.7 + Math.random() * 0.8;
    this.play('furnace.crackle', { volume: 0.7, at, vary: 0.05, offset: Math.random() * list[0].duration, length: len });
  }
  eat() { this.play('player.eat', { volume: 0.45 + Math.random() * 0.35, vary: 0.15 }); }
  // Gulps: a potion or a bucket of milk going down.
  drink() { this.hiss(null, { f: 380 + Math.random() * 120, q: 3, time: 0.12, volume: 0.35, sweep: 220, type: 'lowpass' }); this.thump(null, 160, 90, 0.18, 0.06); }
  // A thrown bottle breaking.
  smash(at) { this.play('glass.break', { volume: 0.8, vary: 0.1, at }); }
  burp() { this.play('player.burp', { volume: 0.45, vary: 0.05 }); }
  splash(strength = 1, at = null) { this.play('water.splash', { volume: Math.min(1, 0.35 + strength * 0.35), at }); }
  // Going into water (`strength` 0..1: wading in .. a big drop): a small splash wading in, a big
  // one jumping or falling in, with a low thud. (Heard as you go in, so the muffling of being
  // underwater doesn't swallow it.)
  waterEntry(strength, at = null) {
    if (strength < 0.12) { this.play('water.splash', { volume: 0.35 + strength * 2, vary: 0.15, at }); return; }
    this.play('water.enter', { volume: 0.45 + 0.55 * strength, pitch: 1.12 - 0.2 * strength, vary: 0.08, at, dry: true });
    this.thump(at, 130, 45, 0.35 * strength, 0.18);
  }
  swim() { this.play('water.swim', { volume: 0.18 }); }
  fuse(at) { this.play('tnt.fuse', { volume: 1, vary: 0.02, at }); }
  explode(at) { this.play('tnt.explode', { volume: 4, pitch: 0.95, vary: 0.15, at }); }
  fizz(at) { this.play('fire.fizz', { volume: 0.45, pitch: 1.2, vary: 0.2, at }); }
  ignite(at) { this.play('fire.ignite', { volume: 0.8, at }); }
  toolBreak() { this.play('item.break', { volume: 0.8, pitch: 0.9, vary: 0.2 }); }
  door(open, at) { this.play(open ? 'door.open' : 'door.close', { volume: 0.85, at }); }
  // Levers, buttons and pressure plates: a small mechanical click (higher going on).
  switchClick(on, at) {
    this.tick(at, 0.22, on ? 3000 : 2200);
    this.thump(at, on ? 900 : 600, on ? 500 : 350, 0.12, 0.03);
  }
  chest(open, at) { this.play(open ? 'chest.open' : 'door.close', { volume: open ? 0.7 : 0.4, pitch: open ? 1 : 1.2, at }); }
  bucket(kind, at) {
    if (kind.endsWith('lava')) this.play('lava.pop', { volume: 0.6, pitch: kind.startsWith('fill') ? 0.8 : 0.6, at });
    else this.play('water.splash', { volume: 0.35, pitch: kind === 'fill' ? 1.3 : 1.1, at });
  }
  // A struck bell: inharmonic partials ringing down at their own rates (hum, prime, tierce, quint,
  // nominal and a few bright ones).
  bell(at) {
    if (!this.ready) return;
    const sp = this.spatial(at, 3);
    if (!sp) return;
    const ctx = this.ctx, t = ctx.currentTime, f0 = 698;
    for (const [ratio, amp, decay] of [[0.5, 0.3, 3.2], [1, 0.45, 2.6], [1.19, 0.3, 2], [1.5, 0.16, 1.5], [2, 0.26, 1.3], [2.52, 0.1, 0.8],
      [3.01, 0.08, 0.6], [4.1, 0.05, 0.3]]) {
      const osc = ctx.createOscillator();
      osc.frequency.value = f0 * ratio * (1 + (Math.random() - 0.5) * 0.004);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(amp * 0.45 * sp.gain, t + 0.003);
      g.gain.exponentialRampToValueAtTime(0.0004, t + decay);
      this.output(osc, g, sp.pan);
      osc.start(t);
      osc.stop(t + decay + 0.05);
    }
    this.thump(at, 180, 90, 0.25, 0.08);
  }
  lavaPop(at) { this.play('lava.pop', { volume: 0.35, at }); }

  // ---- made-up sounds
  // A tone from `f0` to `f1` Hz over `time`, shaped by `type` and an envelope; optional vibrato.
  tone(at, { type = 'sine', f0, f1 = f0, time = 0.2, volume = 0.3, attack = 0.01, vibrato = 0, vibratoRate = 0, filter = null, delay = 0 }) {
    if (!this.ready) return;
    const sp = this.spatial(at, 1);
    if (!sp) return;
    const ctx = this.ctx, t = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(f0, t);
    osc.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + time);
    if (vibrato) {
      const lfo = ctx.createOscillator(), lg = ctx.createGain();
      lfo.frequency.value = vibratoRate; lg.gain.value = vibrato;
      lfo.connect(lg).connect(osc.frequency);
      lfo.start(t); lfo.stop(t + time + 0.05);
    }
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(volume * sp.gain, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0005, t + time);
    let node = osc;
    if (filter) {
      const f = ctx.createBiquadFilter();
      f.type = filter.type ?? 'bandpass'; f.frequency.value = filter.f; f.Q.value = filter.q ?? 1;
      node = osc.connect(f);
    }
    this.output(node, g, sp.pan);
    osc.start(t);
    osc.stop(t + time + 0.05);
  }
  // A burst of filtered noise (rattles, hisses, squelches).
  hiss(at, { f = 3000, q = 1, time = 0.15, volume = 0.3, sweep = null, delay = 0, type = 'bandpass' }) {
    if (!this.ready) return;
    const sp = this.spatial(at, 1);
    if (!sp) return;
    const ctx = this.ctx, t = ctx.currentTime + delay;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseLong ??= (() => {
      const b = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate), d = b.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      return b;
    })();
    const fl = ctx.createBiquadFilter();
    fl.type = type; fl.frequency.setValueAtTime(f, t); fl.Q.value = q;
    if (sweep) fl.frequency.exponentialRampToValueAtTime(sweep, t + time);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(volume * sp.gain, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0005, t + time);
    src.connect(fl);
    this.output(fl, g, sp.pan);
    src.start(t, Math.random() * 0.5);
    src.stop(t + time + 0.05);
  }
  synth(kind, event, at, pitch = 1) {
    const hurt = event === 'hurt', death = event === 'death', r = () => 0.9 + Math.random() * 0.2;
    switch (kind) {
      case 'skeleton':
        for (let i = 0; i < (death ? 7 : 4); i++) this.hiss(at, { f: 2600 * r() * pitch, q: 6, time: 0.05, volume: 0.35, delay: i * (0.05 + Math.random() * 0.04) });
        if (hurt || death) this.tone(at, { type: 'square', f0: 300 * pitch, f1: 160, time: 0.18, volume: 0.06, filter: { f: 900, q: 2 } });
        break;
      case 'spider':
        if (hurt || death) this.tone(at, { type: 'sawtooth', f0: 900 * r(), f1: 400, time: 0.25, volume: 0.1, filter: { f: 1800, q: 3 } });
        this.hiss(at, { f: 3200 * r(), q: 2, time: hurt ? 0.2 : 0.4, volume: 0.22, sweep: 2000 });
        break;
      case 'enderman':
        if (event === 'teleport') { this.hiss(at, { f: 400, q: 1, time: 0.5, volume: 0.35, sweep: 3000, type: 'bandpass' }); this.tone(at, { f0: 220, f1: 880, time: 0.4, volume: 0.12, vibrato: 30, vibratoRate: 12 }); }
        else if (hurt || death) this.tone(at, { type: 'sawtooth', f0: 520 * pitch, f1: 180, time: 0.6, volume: 0.12, vibrato: 60, vibratoRate: 18, filter: { f: 1400, q: 1.5 } });
        else this.tone(at, { type: 'sine', f0: 110 * r(), f1: 70, time: 0.9, volume: 0.14, vibrato: 8, vibratoRate: 6 });
        break;
      case 'slime':
        this.hiss(at, { f: 500 * pitch * r(), q: 3, time: 0.14, volume: 0.35, sweep: 200, type: 'lowpass' });
        this.tone(at, { f0: 180 * pitch * r(), f1: 90, time: 0.12, volume: 0.25 });
        break;
      case 'creeper':
        if (hurt || death) this.hiss(at, { f: 1200, q: 1, time: 0.25, volume: 0.3, sweep: 500 });
        break;
      case 'wolf':
        if (hurt || death) this.tone(at, { type: 'triangle', f0: 900 * r(), f1: death ? 300 : 600, time: death ? 0.7 : 0.25, volume: 0.25, vibrato: 20, vibratoRate: 9 });
        else { this.hiss(at, { f: 700, q: 2, time: 0.12, volume: 0.2 }); this.tone(at, { type: 'sawtooth', f0: 260 * r(), f1: 180, time: 0.14, volume: 0.1, filter: { f: 800, q: 2 }, delay: 0.02 }); }
        break;
      case 'fox':
        this.tone(at, { type: 'triangle', f0: 1200 * r(), f1: hurt ? 700 : 1600, time: 0.12, volume: 0.18 });
        break;
      case 'horse': {
        // Munching; a snort (before an angry whinny); and the whinny itself: a buzzy voice through
        // two formants, trilling fast as it falls away, with breath behind it.
        if (event === 'eat') {
          for (let i = 0; i < 3; i++) this.hiss(at, { f: 650 * r(), q: 1.5, time: 0.07, volume: 0.28, delay: i * 0.13, type: 'lowpass' });
          break;
        }
        const angry = event === 'angry', delay = angry ? 0.28 : 0;
        if (angry) this.hiss(at, { f: 1100, q: 0.7, time: 0.3, volume: 0.4, sweep: 280, type: 'lowpass' });
        const f = (hurt ? 620 : 980) * pitch * r(), time = death ? 1.2 : hurt ? 0.32 : 0.8;
        for (const [ff, q] of [[950, 3], [2100, 5]]) {
          this.tone(at, { type: 'sawtooth', f0: f, f1: f * (death ? 0.3 : 0.48), time, volume: hurt ? 0.1 : 0.075, attack: 0.03, filter: { f: ff, q },
            vibrato: f * 0.07, vibratoRate: hurt ? 30 : 21, delay });
        }
        this.hiss(at, { f: 2600, q: 0.8, time: time * 0.7, volume: 0.05, delay: delay + 0.05 });
        break;
      }
      case 'rabbit':
        if (hurt || death) this.tone(at, { type: 'sine', f0: 1800 * r(), f1: 1200, time: 0.12, volume: 0.2 });
        break;
      case 'golem':
        // Iron: a heavy thud when it swings, a clang when it's struck, a long ringing groan as it falls.
        if (event === 'attack') { this.thump(at, 140, 45, 0.5, 0.18); this.hiss(at, { f: 700, q: 0.8, time: 0.25, volume: 0.25, sweep: 250, type: 'lowpass' }); }
        else if (hurt || death) {
          this.tone(at, { type: 'square', f0: 330 * r(), f1: 300, time: death ? 1.1 : 0.35, volume: 0.07, filter: { f: 1300, q: 8 } });
          this.tone(at, { type: 'triangle', f0: 165 * r(), f1: death ? 90 : 150, time: death ? 1.2 : 0.4, volume: 0.16 });
          this.thump(at, 200, 70, 0.4, 0.12);
        }
        break;
      case 'cat': {
        // A meow: rising then falling through two vowel formants (a yowl when hurt).
        const f = (hurt || death ? 700 : 520) * pitch * r(), time = death ? 0.9 : hurt ? 0.35 : 0.55;
        for (const [ff, q] of [[900, 4], [2400, 6]]) {
          this.tone(at, { type: 'sawtooth', f0: f, f1: f * (death ? 0.45 : 0.8), time, volume: 0.06, attack: 0.06, filter: { f: ff, q }, vibrato: f * 0.02, vibratoRate: 6 });
          this.tone(at, { type: 'sawtooth', f0: f * 1.35, f1: f * 1.2, time: time * 0.4, volume: 0.05, attack: 0.05, filter: { f: ff * 1.2, q } });
        }
        break;
      }
      case 'bat':
        // Squeaks, too high for comfort.
        for (let i = 0; i < (hurt || death ? 2 : 3); i++) this.tone(at, { type: 'sine', f0: 4200 * r(), f1: 3200, time: 0.05, volume: 0.07, delay: i * 0.08 });
        break;
      case 'donkey': {
        // Hee-haw: a buzzy two-note bray, twice over.
        const f = 480 * pitch * r();
        const n = hurt || death ? 1 : 2;
        for (let i = 0; i < n; i++) {
          for (const [ff, q] of [[800, 3], [1900, 5]]) {
            this.tone(at, { type: 'sawtooth', f0: f * 1.6, f1: f * 1.5, time: 0.28, volume: 0.07, attack: 0.04, filter: { f: ff, q }, delay: i * 0.72 });
            this.tone(at, { type: 'sawtooth', f0: f * 0.6, f1: f * (death ? 0.3 : 0.5), time: 0.4, volume: 0.08, attack: 0.05, filter: { f: ff * 0.7, q }, delay: i * 0.72 + 0.3 });
          }
        }
        break;
      }
      case 'witch':
        if (event === 'drink') for (let i = 0; i < 3; i++) this.hiss(at, { f: 400, q: 2, time: 0.09, volume: 0.3, delay: i * 0.18, type: 'lowpass' });
        else {
          // A cackle: quick breathy syllables, falling in pitch.
          const n = hurt ? 2 : death ? 5 : 4, f = (hurt || death ? 420 : 330) * pitch * r();
          for (let i = 0; i < n; i++) {
            for (const [ff, q] of [[700, 4], [1500, 6]]) {
              this.tone(at, { type: 'sawtooth', f0: f * (1 - i * 0.06), f1: f * (0.8 - i * 0.06), time: 0.1, volume: 0.07, attack: 0.015, filter: { f: ff, q }, delay: i * 0.12 });
            }
            this.hiss(at, { f: 2000, q: 1, time: 0.08, volume: 0.05, delay: i * 0.12 });
          }
        }
        break;
      case 'phantom':
        // A thin screech, sweeping down (and up again as it dives).
        if (event === 'swoop') {
          this.hiss(at, { f: 800, q: 0.7, time: 0.8, volume: 0.25, sweep: 3000 });
          this.tone(at, { type: 'sawtooth', f0: 900, f1: 1900, time: 0.6, volume: 0.05, filter: { f: 2200, q: 5 }, vibrato: 60, vibratoRate: 20 });
        } else {
          const f = 1500 * pitch * r();
          this.tone(at, { type: 'sawtooth', f0: f, f1: f * (death ? 0.3 : 0.6), time: death ? 1 : 0.5, volume: 0.06, filter: { f: 2400, q: 4 }, vibrato: 40, vibratoRate: 25 });
          this.tone(at, { type: 'square', f0: f * 0.51, f1: f * 0.3, time: 0.4, volume: 0.03, filter: { f: 1200, q: 3 } });
        }
        break;
      case 'parrot':
        if (hurt || death) this.tone(at, { type: 'sawtooth', f0: 1400 * r(), f1: 700, time: 0.2, volume: 0.08, filter: { f: 2200, q: 3 } });
        else for (let i = 0; i < 2; i++) this.tone(at, { type: 'sine', f0: (1800 + Math.random() * 900) * pitch, f1: 2600 + Math.random() * 900, time: 0.09, volume: 0.1, delay: i * 0.12 });
        break;
      case 'dolphin':
        if (hurt || death) this.tone(at, { type: 'triangle', f0: 2400 * r(), f1: 1200, time: 0.25, volume: 0.12 });
        else {
          for (let i = 0; i < 6; i++) this.hiss(at, { f: 3500 + Math.random() * 2000, q: 4, time: 0.012, volume: 0.25, delay: i * 0.035 });
          this.tone(at, { type: 'sine', f0: 1500 * r(), f1: 2800, time: 0.35, volume: 0.09, vibrato: 90, vibratoRate: 11, delay: 0.1 });
        }
        break;
      case 'snow_golem':
        // Packed snow crunching.
        if (hurt || death) for (let i = 0; i < (death ? 4 : 2); i++) this.hiss(at, { f: 1500 * pitch * r(), q: 0.8, time: 0.09, volume: 0.3, sweep: 500, delay: i * 0.07 });
        break;
      case 'turtle':
        if (hurt || death) this.tone(at, { type: 'triangle', f0: 200 * r(), f1: death ? 80 : 130, time: death ? 0.6 : 0.2, volume: 0.2 });
        break;
      case 'fish':
        if (hurt || death) this.hiss(at, { f: 900, q: 1, time: 0.08, volume: 0.25, type: 'lowpass' });
        break;
      default:
    }
  }
  // A villager's murmur: a buzzy voice through two vowel formants, rising or falling.
  voice(at, pitch = 1) {
    if (!this.ready) return;
    const f = 150 * pitch * (0.9 + Math.random() * 0.2), up = Math.random() < 0.5;
    const formants = [[500 + Math.random() * 300, 5], [1100 + Math.random() * 500, 7]];
    for (const [ff, q] of formants) {
      this.tone(at, { type: 'sawtooth', f0: f * (up ? 0.92 : 1.08), f1: f * (up ? 1.1 : 0.85), time: 0.32 + Math.random() * 0.15, volume: 0.16,
        attack: 0.04, filter: { f: ff, q }, vibrato: 3, vibratoRate: 7 });
    }
  }
  bow(at, light = false) {
    this.hiss(at, { f: 1500, q: 1.5, time: 0.12, volume: light ? 0.2 : 0.35, sweep: 600 });
    if (!light) this.tone(at, { type: 'triangle', f0: 180, f1: 90, time: 0.15, volume: 0.2 });
  }
  arrowHit(flesh, at) {
    if (flesh) this.thump(at, 220, 90, 0.4, 0.08);
    else { this.tick(at, 0.5, 1800); this.thump(at, 400, 200, 0.25, 0.05); }
  }
  shear(at) { for (let i = 0; i < 2; i++) this.hiss(at, { f: 5000, q: 4, time: 0.06, volume: 0.3, delay: i * 0.09 }); }
  trade() { this.tone(null, { type: 'triangle', f0: 880, time: 0.12, volume: 0.12 }); this.tone(null, { type: 'triangle', f0: 1320, time: 0.2, volume: 0.1, delay: 0.08 }); }
  // Picking up experience: a bright little ding, a different note each time.
  orb() {
    const f = 1400 + Math.random() * 900;
    this.tone(null, { type: 'sine', f0: f, f1: f * 1.02, time: 0.14, volume: 0.07 });
    this.tone(null, { type: 'sine', f0: f * 2, time: 0.08, volume: 0.025 });
  }
  // Every fifth level: a rising fanfare.
  levelUp() {
    [523, 659, 784, 1047, 1319].forEach((f, i) => this.tone(null, { type: 'triangle', f0: f, time: 0.5 - i * 0.05, volume: 0.1, delay: i * 0.07 }));
  }
  // Enchanting: a shimmer of high notes.
  enchant(at) {
    for (let i = 0; i < 6; i++) this.tone(at, { type: 'sine', f0: 1200 + Math.random() * 1600, time: 0.4, volume: 0.05, delay: i * 0.05, vibrato: 12, vibratoRate: 9 });
    this.hiss(at, { f: 5000, q: 2, time: 0.6, volume: 0.06, sweep: 9000 });
  }
  // The anvil: a ringing clank.
  anvil(at) {
    this.tone(at, { type: 'square', f0: 1760, f1: 1700, time: 0.5, volume: 0.05, filter: { f: 2400, q: 6 } });
    this.tone(at, { type: 'triangle', f0: 880, time: 0.6, volume: 0.08 });
    this.thump(at, 300, 120, 0.3, 0.06);
  }

  // The steady sound of rain, faded towards `volume` (0 lets it die away).
  setRain(volume) {
    const ctx = this.ctx, list = this.buffers['weather.rain'];
    if (!this.ready || !list?.length) return;
    if (!this.rainLoop && volume > 0.01) {
      const src = ctx.createBufferSource();
      src.buffer = this.rainBuffer ??= makeLoop(ctx, list[0], 0.6);
      src.loop = true;
      const g = ctx.createGain();
      g.gain.value = 0;
      src.connect(g).connect(this.sfx);
      src.start();
      this.rainLoop = { src, g, level: 0 };
    }
    const r = this.rainLoop;
    if (!r) return;
    const level = volume * 0.5;
    if (Math.abs(level - r.level) > 0.005) { r.level = level; r.g.gain.setTargetAtTime(level, ctx.currentTime, 0.4); }
    if (volume <= 0.01 && r.g.gain.value < 0.004) { r.src.stop(); this.rainLoop = null; }
  }

  // Animal and monster voices: event is 'say', 'hurt' or 'death'.
  mob(kind, event = 'say', at = null, pitch = 1) {
    if (!kind) return;
    // Creatures without recordings of their own: some borrow another's voice, the rest are made
    // up from oscillators and noise.
    const borrow = BORROW[kind];
    if (borrow) { const [k, p] = borrow; this.mob(k, event === 'death' ? 'hurt' : event, at, p * pitch); return; }
    if (SYNTH.has(kind)) { this.synth(kind, event, at, pitch); return; }
    const base = (MOB_PITCH[kind] ?? 1) * pitch;
    if (this.buffers[`${kind}.${event}`]?.length) {
      this.play(`${kind}.${event}`, { volume: event === 'say' ? 0.8 : 1, pitch: base, at });
    } else if (event === 'death' && this.buffers[`${kind}.hurt`]?.length) {
      this.play(`${kind}.hurt`, { volume: 1, pitch: base * 0.85, at });
    } else {
      this.play(`${kind}.say`, { volume: 1, pitch: base * (event === 'death' ? 0.9 : 1.25), at });
    }
  }

  // mood: 'title', 'day', 'night', 'cave', or null for silence.
  // `hush`: something else is playing (a jukebox): the music makes way.
  update(mood, hush = false) {
    if (hush && this.music?.piece) this.music.fadeOut();
    this.music?.update(this.musicVolume > 0 && !hush ? mood : null);
  }

  // A note block's note (`instrument` and `pitch` 0-24; see jukebox.js), heard 48 blocks away.
  noteBlock(instrument, pitch, at) {
    if (!this.ready) return;
    const sp = this.spatial(at, 3);
    if (!sp) return;
    const ctx = this.ctx, inp = ctx.createGain(), g = ctx.createGain();
    g.gain.value = sp.gain;
    this.output(inp, g, sp.pan);
    playNote(ctx, inp, instrument, pitch, ctx.currentTime);
  }
}
