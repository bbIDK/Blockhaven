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
    this.volume = 0.7;
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
    this.master.gain.value = this.volume;
    this.master.connect(ctx.destination);
    // Everything sounds muffled with your head underwater.
    this.muffle = ctx.createBiquadFilter();
    this.muffle.type = 'lowpass';
    this.muffle.frequency.value = 20000;
    this.muffle.Q.value = 0.6;
    this.muffle.connect(this.master);
    this.sfx = ctx.createGain();
    this.sfx.connect(this.muffle);
    this.musicGain = ctx.createGain();
    this.musicGain.gain.value = this.musicVolume;
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
  setMusicVolume(v) { this.musicVolume = v; if (this.musicGain) this.musicGain.gain.value = v; }

  setListener(x, y, z, yaw, underwater) {
    const L = this.listener;
    L.x = x; L.y = y; L.z = z; L.yaw = yaw;
    if (underwater !== this.underwater && this.ctx) {
      this.underwater = underwater;
      this.muffle.frequency.setTargetAtTime(underwater ? 650 : 20000, this.ctx.currentTime, 0.08);
    }
  }

  // Plays one of the recordings called `name`. With `at`, the sound comes from that point: it fades
  // out over 16 blocks (more for loud sounds) and pans towards its side.
  play(name, { volume = 1, pitch = 1, at = null, vary = 0.1 } = {}) {
    const ctx = this.ctx, list = this.buffers[name];
    if (!ctx || ctx.state !== 'running' || !list?.length || this.volume <= 0) return;
    let gain = Math.min(1, volume), pan = 0;
    if (at) {
      const L = this.listener;
      const dx = at.x - L.x, dy = at.y - L.y, dz = at.z - L.z;
      const dist = Math.hypot(dx, dy, dz);
      const range = 16 * Math.max(1, volume);
      if (dist >= range) return;
      gain *= 1 - dist / range;
      if (dist > 0.6) pan = Math.max(-1, Math.min(1, (dx * Math.cos(L.yaw) - dz * Math.sin(L.yaw)) / dist)) * 0.7;
    }
    if (gain < 0.01 || (this.active > 40 && gain < 0.25)) return;
    let i = Math.floor(Math.random() * list.length);
    if (list.length > 1 && i === this.last[name]) i = (i + 1) % list.length;
    this.last[name] = i;
    const src = ctx.createBufferSource();
    src.buffer = list[i];
    src.playbackRate.value = pitch * (1 + (Math.random() - Math.random()) * vary);
    const g = ctx.createGain();
    g.gain.value = gain;
    let node = src.connect(g);
    if (pan && ctx.createStereoPanner) {
      const p = ctx.createStereoPanner();
      p.pan.value = pan;
      node = node.connect(p);
    }
    node.connect(this.sfx);
    this.active++;
    src.onended = () => { this.active--; };
    src.start();
  }

  mat(m) { return MATERIALS[m] ?? MATERIALS.stone; }
  // Mining: a quieter, deeper version of the footstep, a few times a second.
  dig(m, at) { this.play(this.mat(m).step, { volume: 0.32, pitch: 0.62, at }); }
  breakBlock(m, at) { const s = this.mat(m); this.play(s.brk ?? s.dig, { volume: 1, pitch: s.brk ? 1 : 0.85, at }); }
  place(m, at) { this.play(this.mat(m).dig, { volume: 0.95, pitch: 0.85, at }); }
  step(m, volume = 0.22) { this.play(this.mat(m).step, { volume }); }
  land(m) { this.play(this.mat(m).step, { volume: 0.45, pitch: 0.75 }); }
  click() { this.play('ui.click', { volume: 0.45, vary: 0 }); }
  pop(at = null) { this.play('item.pop', { volume: 0.3, pitch: 1.25, vary: 0.35, at }); }
  hurt() { this.play('player.hurt', { volume: 0.85 }); }
  fall(big) { this.play(big ? 'hit.fall' : 'hit.fallsmall', { volume: 0.7 }); }
  punch(at) { this.play('hit.punch', { volume: 0.55, at }); }
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
    if (!ctx || ctx.state !== 'running' || !list?.length) return;
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
