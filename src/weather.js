// Rain and snow. Like the original game, precipitation is drawn as vertical sheets of falling
// streaks in the columns around the player, from the highest block that stops it up past the
// camera, and it turns to snow in cold biomes and high up. Deserts stay dry.
import { STRIDE } from './mesher.js';
import { TEX } from './textures.js';
import { BIOME } from './biomes.js';
import { hash2 } from './math.js';
import { inNether } from './config.js';

const RADIUS = 9;
const MAX_QUADS = (RADIUS * 2 + 1) ** 2;
const SNOWY = new Set([BIOME.FROZEN_OCEAN, BIOME.SNOWY_TAIGA, BIOME.SNOWY_PEAKS]);
export const F_PRECIP = 128;

class Sheet {
  constructor() {
    this.u8 = new Uint8Array(MAX_QUADS * 4 * STRIDE);
    this.u16 = new Uint16Array(this.u8.buffer);
    this.count = 0;
  }
  bytes() { return this.u8.subarray(0, this.count * STRIDE); }
}

export class Weather {
  constructor() {
    this.rain = 0;       // current strength, 0..1 (fades in and out)
    this.raining = false;
    this.timer = 600 + Math.random() * 900;
    this.rainSheet = new Sheet();
    this.snowSheet = new Sheet();
    this.base = [0, 0, 0];
    this.lastKey = '';
    this.rebuild = 0;
    this.version = 0;
    this.splashes = [];
  }

  load(saved) {
    this.raining = !!saved?.raining;
    this.rain = this.raining ? 1 : 0;
    this.timer = saved?.timer ?? 600 + Math.random() * 900;
    this.lastKey = '';
  }

  serialize() { return { raining: this.raining, timer: Math.round(this.timer) }; }

  // Starts or stops precipitation; `seconds` is how long until it changes again.
  set(raining, seconds = null) {
    this.raining = raining;
    this.timer = seconds ?? (raining ? 240 + Math.random() * 360 : 600 + Math.random() * 1200);
  }

  update(dt) {
    this.timer -= dt;
    if (this.timer <= 0) this.set(!this.raining);
    this.rain += Math.max(-dt / 8, Math.min(dt / 8, (this.raining ? 1 : 0) - this.rain));
  }

  // Precipitation type for a column: 0 none, 1 rain, 2 snow.
  kind(world, x, z, y) {
    const b = world.biomeAt(x, z);
    if (b === BIOME.DESERT || inNether(x)) return 0;
    return SNOWY.has(b) || y > 104 ? 2 : 1;
  }

  // Rebuilds the sheets when the player moves to another block (or now and then).
  build(cam, world, dt) {
    const bx = Math.floor(cam.x), by = Math.floor(cam.y), bz = Math.floor(cam.z);
    const key = `${bx},${by},${bz}`;
    this.rebuild -= dt;
    if (key === this.lastKey && this.rebuild > 0) return;
    this.lastKey = key;
    this.rebuild = 0.5;
    this.base[0] = bx - 64; this.base[1] = by - 64; this.base[2] = bz - 64;
    this.version++;
    this.rainSheet.count = 0;
    this.snowSheet.count = 0;
    if (this.rain <= 0) return;
    for (let dz = -RADIUS; dz <= RADIUS; dz++) {
      for (let dx = -RADIUS; dx <= RADIUS; dx++) {
        if (dx * dx + dz * dz > RADIUS * RADIUS) continue;
        const x = bx + dx, z = bz + dz;
        if (!world.isLoaded(x, z)) continue;
        const top = world.rainTop(x, z);
        const y0 = Math.max(top + 1, by - RADIUS), y1 = Math.min(y0 + 14, by + RADIUS);
        if (y1 <= y0) continue;
        const kind = this.kind(world, x, z, y0);
        if (!kind) continue;
        this.quad(kind === 2 ? this.snowSheet : this.rainSheet, kind, cam, world, x, z, y0, y1);
      }
    }
  }

  quad(sheet, kind, cam, world, x, z, y0, y1) {
    const cx = x + 0.5, cz = z + 0.5;
    let dx = cx - cam.x, dz = cz - cam.z;
    const len = Math.hypot(dx, dz) || 1;
    // Face the camera: the sheet runs across the line of sight.
    const px = (-dz / len) * 0.5, pz = (dx / len) * 0.5;
    const l = world.getLight(x, y0, z);
    const layer = kind === 2 ? TEX.snow_fall : TEX.rain_fall;
    const uo = Math.floor(hash2(x, z, 11) * 16), vo = Math.floor(hash2(z, x, 23) * 16);
    const h = (y1 - y0) * 16;
    const corners = [[cx - px, y0, cz - pz, 0, h], [cx + px, y0, cz + pz, 16, h], [cx + px, y1, cz + pz, 16, 0], [cx - px, y1, cz - pz, 0, 0]];
    const u8 = sheet.u8, u16 = sheet.u16;
    for (const [vx, vy, vz, u, v] of corners) {
      const n = sheet.count++, o = n * STRIDE, hh = n * 10;
      u16[hh] = Math.round((vx - this.base[0]) * 256);
      u16[hh + 1] = Math.round((vy - this.base[1]) * 256);
      u16[hh + 2] = Math.round((vz - this.base[2]) * 256);
      u8[o + 6] = u + uo; u8[o + 7] = v + vo;
      u8[o + 8] = layer & 255; u8[o + 9] = 6; u8[o + 10] = F_PRECIP; u8[o + 11] = layer >> 8;
      u8[o + 12] = (l >> 4) * 17; u8[o + 13] = (l & 15) * 17; u8[o + 14] = 255; u8[o + 15] = 0;
      u8[o + 16] = 255; u8[o + 17] = 255; u8[o + 18] = 255; u8[o + 19] = 255;
    }
  }

  // Drops landing near the player: [x, y, z] spots on top of the ground, for splash particles.
  splashSpots(cam, world, n) {
    const out = this.splashes;
    out.length = 0;
    const bx = Math.floor(cam.x), by = Math.floor(cam.y), bz = Math.floor(cam.z);
    for (let i = 0; i < n; i++) {
      const x = bx + Math.floor((Math.random() * 2 - 1) * RADIUS), z = bz + Math.floor((Math.random() * 2 - 1) * RADIUS);
      if (!world.isLoaded(x, z)) continue;
      const top = world.rainTop(x, z);
      if (Math.abs(top - by) > RADIUS || this.kind(world, x, z, top + 1) !== 1) continue;
      out.push([x + Math.random(), top + 1.02, z + Math.random()]);
    }
    return out;
  }
}
