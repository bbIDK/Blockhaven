// Rain and snow. Like the original game, precipitation is drawn as sheets in the columns around
// the player, each turned to face the camera, from the highest block that stops it up past the
// camera. It turns to snow in cold biomes and high up; deserts, savannas and badlands stay dry.
// The streaks and flakes on the sheets are drawn by the terrain shader (precipitation() in
// shaders.js).
import { STRIDE } from './mesher.js';
import { BIOME } from './biomes.js';
import { hash2 } from './math.js';

const RADIUS = 10;
const MAX_QUADS = (RADIUS * 2 + 1) ** 2;
const SNOWY = new Set([BIOME.FROZEN_OCEAN, BIOME.DEEP_FROZEN_OCEAN, BIOME.SNOWY_TAIGA, BIOME.SNOWY_PEAKS, BIOME.SNOWY_PLAINS, BIOME.ICE_SPIKES,
  BIOME.JAGGED_PEAKS, BIOME.FROZEN_PEAKS, BIOME.SNOWY_SLOPES, BIOME.SNOWY_BEACH, BIOME.FROZEN_RIVER]);
const DRY = new Set([BIOME.DESERT, BIOME.SAVANNA, BIOME.BADLANDS]);
export const F_PRECIP = 128;
// How fast rain and snow fall, in pixels a second (64 to a block), and where the shader's patterns
// repeat (the distance fallen wraps around there, so it never loses precision).
const RAIN_SPEED = 8 * 64, RAIN_WRAP = 8 * 64 * 72;
const SNOW_SPEED = 1.1 * 64, SNOW_WRAP = 64 * 16;

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
    this.columns = [];    // [x, z, y0, y1, kind, light, seed] where rain or snow falls near the player
    this.fall = [0, 0];   // how far the rain and the snow have fallen (pixels, wrapping)
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
    if (DRY.has(b)) return 0;
    return SNOWY.has(b) || y > 104 ? 2 : 1;
  }

  // Finds the columns that rain or snow falls down near the player (when the player moves to
  // another block, and now and then), and lays a sheet across each one every frame, turned to the
  // camera so that the sheets turn smoothly as the player moves.
  build(cam, world, dt) {
    const bx = Math.floor(cam.x), by = Math.floor(cam.y), bz = Math.floor(cam.z);
    const key = `${bx},${by},${bz}`;
    this.rebuild -= dt;
    if (key !== this.lastKey || this.rebuild <= 0) {
      this.lastKey = key;
      this.rebuild = 0.5;
      this.scan(world, bx, by, bz);
    }
    this.fall[0] = (this.fall[0] + dt * RAIN_SPEED) % RAIN_WRAP;
    this.fall[1] = (this.fall[1] + dt * SNOW_SPEED) % SNOW_WRAP;
    this.base[0] = bx - 64; this.base[1] = by - 64; this.base[2] = bz - 64;
    this.version++;
    this.rainSheet.count = 0;
    this.snowSheet.count = 0;
    if (this.rain <= 0) return;
    for (const c of this.columns) this.quad(c[4] === 2 ? this.snowSheet : this.rainSheet, cam, c);
  }

  scan(world, bx, by, bz) {
    const cols = this.columns;
    cols.length = 0;
    for (let dz = -RADIUS; dz <= RADIUS; dz++) {
      for (let dx = -RADIUS; dx <= RADIUS; dx++) {
        if (dx * dx + dz * dz > RADIUS * RADIUS) continue;
        const x = bx + dx, z = bz + dz;
        if (!world.isLoaded(x, z)) continue;
        const top = world.rainTop(x, z);
        const y0 = Math.max(top + 1, by - RADIUS), y1 = by + RADIUS;
        if (y1 <= y0) continue;
        const kind = this.kind(world, x, z, y0);
        if (kind) cols.push([x, z, y0, y1, kind, world.getLight(x, y0, z), Math.floor(hash2(x, z, 11) * 65536)]);
      }
    }
  }

  quad(sheet, cam, [x, z, y0, y1, , l, seed]) {
    const cx = x + 0.5, cz = z + 0.5;
    const dx = cx - cam.x, dz = cz - cam.z, dist = Math.hypot(dx, dz), len = dist || 1;
    // Face the camera: the sheet runs across the line of sight.
    const px = (-dz / len) * 0.5, pz = (dx / len) * 0.5;
    // Fainter further out, as in the original, and fading away altogether at the edge (so that
    // sheets don't pop in and out as the player moves).
    const d = Math.min(1, dist / RADIUS), fade = (0.5 + 0.5 * (1 - d * d)) * Math.min(1, (1 - d) * 5);
    if (fade <= 0) return;
    // (Down the sheet the texture coordinate counts eighths of a block.)
    const h = (y1 - y0) * 8;
    const u8 = sheet.u8, u16 = sheet.u16;
    for (let k = 0; k < 4; k++) {
      const right = k === 1 || k === 2, low = k < 2;
      const n = sheet.count++, o = n * STRIDE, hh = n * 10;
      u16[hh] = Math.round((cx + (right ? px : -px) - this.base[0]) * 256);
      u16[hh + 1] = Math.round(((low ? y0 : y1) - this.base[1]) * 256);
      u16[hh + 2] = Math.round((cz + (right ? pz : -pz) - this.base[2]) * 256);
      u8[o + 6] = right ? 16 : 0; u8[o + 7] = low ? h : 0;
      u8[o + 8] = 0; u8[o + 9] = 6; u8[o + 10] = F_PRECIP; u8[o + 11] = 0;
      u8[o + 12] = (l >> 4) * 17; u8[o + 13] = (l & 15) * 17; u8[o + 14] = 255; u8[o + 15] = 0;
      // (The shader reads the fade and the column's random number from the tint.)
      u8[o + 16] = Math.round(fade * 255); u8[o + 17] = seed & 255; u8[o + 18] = seed >> 8; u8[o + 19] = 255;
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
