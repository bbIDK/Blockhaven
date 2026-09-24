// Sound effects are short recordings (public domain, see assets/sounds/CREDITS.md) played with
// Minecraft-like volume and pitch rules, panned and faded by where they happen. Music: music.js.
import { SOUNDS } from './sounddata.js';
import { Music } from './music.js';

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

// A low thump layered under breaking and placing, by block material: [start Hz, end Hz, gain].
const THUMP = {
  stone: [150, 58, 0.34], wood: [128, 52, 0.36], metal: [170, 70, 0.3], grass: [105, 48, 0.2], gravel: [110, 48, 0.24],
  sand: [95, 45, 0.18], snow: [90, 45, 0.14], cloth: [90, 42, 0.14], glass: [0, 0, 0], water: [0, 0, 0],
};
// Music sits under the sound effects: at the default settings it plays about 13 dB below
// footsteps and 20 dB below breaking blocks.
const MUSIC_LEVEL = 1;

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
    this.volume = 0.8;
    this.musicVolume = 0.35;
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
    this.master.gain.value = this.volume;
    this.master.connect(ctx.destination);
    // Effects go through a gentle compressor, so hits and breaks can be loud and punchy without
    // a pile of overlapping sounds clipping.
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -20;
    comp.knee.value = 12;
    comp.ratio.value = 3.5;
    comp.attack.value = 0.003;
    comp.release.value = 0.2;
    const makeup = ctx.createGain();
    makeup.gain.value = 1.45;
    comp.connect(makeup).connect(this.master);
    // Everything sounds muffled with your head underwater.
    this.muffle = ctx.createBiquadFilter();
    this.muffle.type = 'lowpass';
    this.muffle.frequency.value = 20000;
    this.muffle.Q.value = 0.6;
    this.muffle.connect(comp);
    this.sfx = ctx.createGain();
    this.sfx.connect(this.muffle);
    this.noise = ctx.createBuffer(1, Math.round(ctx.sampleRate * 0.05), ctx.sampleRate);
    const nd = this.noise.getChannelData(0);
    for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;
    this.musicGain = ctx.createGain();
    this.musicGain.gain.value = this.musicVolume * MUSIC_LEVEL;
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

  setVolume(v) { this.volume = v; if (this.master) this.master.gain.value = v; }
  setMusicVolume(v) { this.musicVolume = v; if (this.musicGain) this.musicGain.gain.value = v * MUSIC_LEVEL; }

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

  // Connects a source through its gain (and panner) to the effects bus.
  output(node, gainNode, pan) {
    let n = node.connect(gainNode);
    if (pan && this.ctx.createStereoPanner) {
      const p = this.ctx.createStereoPanner();
      p.pan.value = pan;
      n = n.connect(p);
    }
    n.connect(this.sfx);
  }

  // Plays one of the recordings called `name`. With `at`, the sound comes from that point.
  // `offset`/`length` play just part of it (with short fades), for long recordings like fire.
  play(name, { volume = 1, pitch = 1, at = null, vary = 0.1, offset = null, length = null } = {}) {
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
    this.output(src, g, sp.pan);
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
  burp() { this.play('player.burp', { volume: 0.45, vary: 0.05 }); }
  splash(strength = 1, at = null) { this.play('water.splash', { volume: Math.min(1, 0.35 + strength * 0.35), at }); }
  swim() { this.play('water.swim', { volume: 0.18 }); }
  fuse(at) { this.play('tnt.fuse', { volume: 1, vary: 0.02, at }); }
  explode(at) { this.play('tnt.explode', { volume: 4, pitch: 0.95, vary: 0.15, at }); }
  fizz(at) { this.play('fire.fizz', { volume: 0.45, pitch: 1.2, vary: 0.2, at }); }
  ignite(at) { this.play('fire.ignite', { volume: 0.8, at }); }
  toolBreak() { this.play('item.break', { volume: 0.8, pitch: 0.9, vary: 0.2 }); }
  door(open, at) { this.play(open ? 'door.open' : 'door.close', { volume: 0.85, at }); }
  chest(open, at) { this.play(open ? 'chest.open' : 'door.close', { volume: open ? 0.7 : 0.4, pitch: open ? 1 : 1.2, at }); }
  lavaPop(at) { this.play('lava.pop', { volume: 0.35, at }); }

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
  mob(kind, event = 'say', at = null) {
    const base = MOB_PITCH[kind] ?? 1;
    if (this.buffers[`${kind}.${event}`]?.length) {
      this.play(`${kind}.${event}`, { volume: event === 'say' ? 0.8 : 1, pitch: base, at });
    } else if (event === 'death' && this.buffers[`${kind}.hurt`]?.length) {
      this.play(`${kind}.hurt`, { volume: 1, pitch: base * 0.85, at });
    } else {
      this.play(`${kind}.say`, { volume: 1, pitch: base * (event === 'death' ? 0.9 : 1.25), at });
    }
  }

  // mood: 'title', 'day', 'night', 'cave', or null for silence.
  update(mood) {
    this.music?.update(this.musicVolume > 0 ? mood : null);
  }
}
