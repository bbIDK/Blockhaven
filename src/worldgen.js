// Terrain generation: continents and oceans, rivers, rolling hills, mountain ranges with jagged
// peaks and overhanging cliffs, some thirty biomes with their own ground, plants and trees,
// caves, ores by depth, deepslate, and small structures (dungeons, wells, ice spikes, icebergs,
// boulders, fallen trees). Pure functions of (seed, chunk), so it runs inside Web Workers and
// every chunk agrees with its neighbours.
import { CHUNK, HEIGHT, SEA_LEVEL, CHUNK_VOLUME } from './config.js';
import { Noise } from './noise.js';
import { B, REPLACEABLE, FACING_VARIANTS, SOLID, WATERLIKE, NATURAL_LEAVES, DOUBLE, LOOT_CHEST } from './blocks.js';
import { BIOME, toByte } from './biomes.js';
import { hash2, hash3, hashString, mulberry32, smoothstep, lerp, clamp } from './math.js';
import { TREES, WIDE_TREES, TREE_REACH } from './trees.js';
import { WorldGenV1 } from './worldgen1.js';
import { villagePieces, villagesNear, groundLevel, insideVillage, villageAt } from './villages.js';

const PAD = 1; // neighbour columns kept for slopes
const GW = CHUNK + PAD * 2;
const CAVE_T = 0.0105;
const SNOWLINE = 150;

// Continentalness -> base height: deep sea, shelf, coast, lowlands, uplands.
const CONT = [[-1, 22], [-0.6, 30], [-0.35, 40], [-0.2, 50], [-0.1, 57], [-0.03, 61], [0.03, 64],
  [0.2, 67], [0.45, 72], [0.75, 80], [1.2, 92]];
function spline(pts, v) {
  if (v <= pts[0][0]) return pts[0][1];
  for (let i = 1; i < pts.length; i++) {
    if (v <= pts[i][0]) {
      const [x0, y0] = pts[i - 1], [x1, y1] = pts[i];
      const t = (v - x0) / (x1 - x0);
      return y0 + (y1 - y0) * t * t * (3 - 2 * t);
    }
  }
  return pts[pts.length - 1][1];
}
// Ridged multifractal noise in [0, 1]: sharp crests, each octave carved into the last.
function ridged(n, x, z, octaves) {
  let sum = 0, amp = 0.5, freq = 1, weight = 1, norm = 0;
  for (let o = 0; o < octaves; o++) {
    let s = 1 - Math.abs(n.noise2(x * freq, z * freq));
    s *= s * weight;
    weight = clamp(s * 2, 0, 1);
    sum += s * amp; norm += amp;
    freq *= 2.07; amp *= 0.5;
  }
  return sum / norm;
}

// Trees per biome: [chance per column, [kind, weight]...].
const FOREST = [[0.8, 'oak'], [0.08, 'big_oak'], [0.2, 'birch']];
const TREE_TABLE = {
  [BIOME.PLAINS]: [0.0025, [[1, 'oak'], [0.25, 'big_oak']]],
  [BIOME.SUNFLOWER_PLAINS]: [0.0015, [[1, 'oak'], [0.4, 'big_oak']]],
  [BIOME.FOREST]: [0.045, FOREST],
  [BIOME.FLOWER_FOREST]: [0.02, [[0.6, 'oak'], [0.4, 'birch'], [0.1, 'big_oak']]],
  [BIOME.BIRCH_FOREST]: [0.04, [[1, 'birch'], [0.15, 'tall_birch']]],
  [BIOME.OLD_GROWTH_BIRCH]: [0.045, [[1, 'tall_birch'], [0.2, 'birch']]],
  [BIOME.DARK_FOREST]: [0.07, [[1, 'dark_oak'], [0.15, 'oak'], [0.08, 'big_oak']]],
  [BIOME.TAIGA]: [0.04, [[0.6, 'spruce'], [0.3, 'tall_spruce'], [0.2, 'pine']]],
  [BIOME.OLD_GROWTH_TAIGA]: [0.045, [[0.35, 'mega_spruce'], [0.4, 'tall_spruce'], [0.25, 'spruce']]],
  [BIOME.SNOWY_TAIGA]: [0.03, [[0.7, 'spruce'], [0.3, 'pine']]],
  [BIOME.SNOWY_PLAINS]: [0.0015, [[1, 'spruce']]],
  [BIOME.SAVANNA]: [0.009, [[1, 'acacia'], [0.12, 'oak']]],
  [BIOME.JUNGLE]: [0.075, [[0.12, 'mega_jungle'], [0.45, 'jungle'], [0.5, 'jungle_bush']]],
  [BIOME.SPARSE_JUNGLE]: [0.02, [[0.6, 'jungle'], [0.5, 'jungle_bush']]],
  [BIOME.SWAMP]: [0.012, [[1, 'swamp_oak']]],
  [BIOME.CHERRY_GROVE]: [0.012, [[1, 'cherry']]],
  [BIOME.MEADOW]: [0.0012, [[1, 'oak'], [1, 'birch']]],
  [BIOME.MOUNTAINS]: [0.008, [[1, 'spruce'], [0.4, 'oak']]],
  [BIOME.WINDSWEPT_FOREST]: [0.03, [[1, 'spruce'], [0.5, 'oak'], [0.2, 'pine']]],
  [BIOME.FLAT]: [0, []],
};
// Flowers each biome grows.
const FLOWERS = {
  default: ['dandelion', 'poppy'],
  [BIOME.PLAINS]: ['dandelion', 'poppy', 'oxeye_daisy', 'azure_bluet', 'cornflower'],
  [BIOME.SUNFLOWER_PLAINS]: ['dandelion', 'poppy', 'oxeye_daisy', 'azure_bluet'],
  [BIOME.FLOWER_FOREST]: ['allium', 'azure_bluet', 'red_tulip', 'orange_tulip', 'white_tulip', 'pink_tulip', 'oxeye_daisy', 'cornflower',
    'lily_of_the_valley', 'dandelion', 'poppy'],
  [BIOME.MEADOW]: ['allium', 'azure_bluet', 'oxeye_daisy', 'cornflower', 'dandelion', 'poppy'],
  [BIOME.CHERRY_GROVE]: ['pink_tulip', 'allium', 'azure_bluet', 'lily_of_the_valley'],
  [BIOME.SWAMP]: ['blue_orchid'],
  [BIOME.TAIGA]: ['cornflower', 'lily_of_the_valley'],
  [BIOME.BIRCH_FOREST]: ['lily_of_the_valley', 'dandelion', 'poppy'],
  [BIOME.OLD_GROWTH_BIRCH]: ['lily_of_the_valley', 'poppy'],
  [BIOME.FOREST]: ['dandelion', 'poppy', 'lily_of_the_valley'],
};
// How much of the ground gets grass, flowers and tall plants.
const COVER = {
  default: { grass: 0.14, flower: 0.006, tall: 0.004 },
  [BIOME.PLAINS]: { grass: 0.32, flower: 0.02, tall: 0.02 },
  [BIOME.SUNFLOWER_PLAINS]: { grass: 0.3, flower: 0.02, tall: 0.02, sunflower: 0.06 },
  [BIOME.FLOWER_FOREST]: { grass: 0.1, flower: 0.22, tall: 0.03 },
  [BIOME.MEADOW]: { grass: 0.4, flower: 0.08, tall: 0.05 },
  [BIOME.CHERRY_GROVE]: { grass: 0.25, flower: 0.05, tall: 0.01 },
  [BIOME.JUNGLE]: { grass: 0.3, flower: 0.004, tall: 0.03, fern: 0.2, melon: 0.004 },
  [BIOME.SPARSE_JUNGLE]: { grass: 0.28, flower: 0.004, tall: 0.02, fern: 0.15, melon: 0.002 },
  [BIOME.TAIGA]: { grass: 0.12, flower: 0.004, fern: 0.12, tall: 0.01, berry: 0 },
  [BIOME.OLD_GROWTH_TAIGA]: { grass: 0.08, fern: 0.25, tall: 0.03, mushroom: 0.01 },
  [BIOME.SNOWY_TAIGA]: { grass: 0.06, fern: 0.08 },
  [BIOME.SAVANNA]: { grass: 0.4, flower: 0.002, tall: 0.03 },
  [BIOME.SWAMP]: { grass: 0.12, flower: 0.02, mushroom: 0.008 },
  [BIOME.DARK_FOREST]: { grass: 0.08, flower: 0.003, mushroom: 0.02, tall: 0.01 },
  [BIOME.WINDSWEPT_FOREST]: { grass: 0.1, fern: 0.05 },
  [BIOME.MOUNTAINS]: { grass: 0.08, flower: 0.002 },
};
// Badlands: bands of coloured clay running round the hills.
const BANDS = ['terracotta', 'orange_terracotta', 'terracotta', 'yellow_terracotta', 'terracotta', 'terracotta', 'brown_terracotta',
  'terracotta', 'red_terracotta', 'orange_terracotta', 'terracotta', 'white_terracotta', 'light_gray_terracotta', 'terracotta',
  'orange_terracotta', 'orange_terracotta', 'terracotta', 'yellow_terracotta', 'red_terracotta', 'terracotta', 'brown_terracotta',
  'terracotta', 'white_terracotta', 'terracotta'].map((n) => B[n]);
// Ores: [block, deepslate block, veins per chunk, size, lowest y, highest y, peak y (or null)].
const ORES = [
  ['coal_ore', 'deepslate_coal_ore', 20, 12, 1, 190, 96],
  ['copper_ore', 'deepslate_copper_ore', 10, 9, 1, 110, 48],
  ['iron_ore', 'deepslate_iron_ore', 14, 8, 1, 80, 20],
  ['iron_ore', 'deepslate_iron_ore', 6, 8, 90, 200, null],
  ['gold_ore', 'deepslate_gold_ore', 4, 7, 1, 36, 12],
  ['redstone_ore', 'deepslate_redstone_ore', 6, 7, 1, 18, null],
  ['lapis_ore', 'deepslate_lapis_ore', 3, 6, 1, 64, 30],
  ['diamond_ore', 'deepslate_diamond_ore', 1.6, 6, 1, 18, 6],
  ['granite', 'granite', 3, 26, 1, 100, null],
  ['diorite', 'diorite', 3, 26, 1, 100, null],
  ['andesite', 'andesite', 3, 26, 1, 100, null],
  ['gravel', 'gravel', 4, 20, 1, 120, null],
  ['dirt', 'dirt', 5, 20, 20, 120, null],
].map(([a, b, ...r]) => [B[a], B[b], ...r]);
const STONEY = new Set([B.stone, B.deepslate]);
// Only the bare heights get cliffs and overhangs worn into them (see step 2 of generate); the
// wooded slopes stay a plain height map so trees rooted in one chunk line up with the next.
const CARVED = new Set([BIOME.JAGGED_PEAKS, BIOME.FROZEN_PEAKS, BIOME.STONY_PEAKS, BIOME.SNOWY_SLOPES]);

export class WorldGen {
  // `version`: 2 for worlds made before villages were spread further apart, 3 since, and 4 for
  // worlds with settlements of every size (camps, hamlets, villages, towns and kingdoms).
  constructor(seed, type = 'default', version = 4) {
    this.seed = seed >>> 0;
    this.type = type;
    this.version = version;
    this.villages = type !== 'flat'; // (worlds from the first generator have none)
    const n = (k) => new Noise((this.seed ^ hashString(k)) >>> 0);
    this.nCont = n('continent2'); this.nEros = n('erosion2'); this.nPeaks = n('peaks2'); this.nHills = n('hills2');
    this.nWarp = n('warp2'); this.nTemp = n('temperature2'); this.nHum = n('humidity2'); this.nRiver = n('river2');
    this.nVar = n('variant'); this.nMesa = n('mesa'); this.nDetail = n('cliffs');
    this.nCaveA = n('caveA'); this.nCaveB = n('caveB'); this.nCheese = n('cheese'); this.nSurf = n('surface');
    this.col = {};
    this.columns = new Map(); // columns looked up outside the chunk being made (tree roots)
  }

  // Terrain shape and climate of one column. Returns the (fractional) surface height and fills
  // this.col with everything the biome choice needs.
  column(x, z) {
    const col = this.col;
    const wx = x + this.nWarp.noise2(x / 260, z / 260) * 36 + this.nWarp.noise2(x / 70, z / 70) * 6;
    const wz = z + this.nWarp.noise2(z / 260 + 31.7, x / 260 - 17.3) * 36 + this.nWarp.noise2(z / 70 + 9.1, x / 70 - 3.3) * 6;
    const c = this.nCont.fbm2(wx / 1500, wz / 1500, 5) * 1.7 + 0.42;
    const e = this.nEros.fbm2(wx / 750, wz / 750, 4) * 1.7;
    const temp = this.nTemp.fbm2(x / 1900, z / 1900, 3) * 1.7;
    const hum = this.nHum.fbm2(x / 1500 + 91, z / 1500 - 47, 3) * 1.7;
    const v = this.nVar.fbm2(x / 520, z / 520, 2) * 1.6;
    let h = spline(CONT, c);
    const land = smoothstep(-0.1, 0.06, c);
    // Rolling hills, steeper where erosion is low.
    const hilly = smoothstep(0.7, -0.5, e);
    h += this.nHills.fbm2(x / 110, z / 110, 4) * lerp(3, 16, hilly) * land;
    // Mountain ranges: ridged crests rising to over a hundred blocks above the land.
    const mount = smoothstep(0.1, 0.5, c) * smoothstep(0.3, -0.4, e);
    const pv = mount > 0.001 ? ridged(this.nPeaks, wx / 430, wz / 430, 5) : 0;
    h += (Math.pow(pv, 1.5) * 125 + 14 * pv) * mount;
    // Swamps: low, flat and waterlogged.
    const swamp = smoothstep(0.35, 0.6, hum) * smoothstep(-0.15, 0.05, temp) * smoothstep(0.55, 0.35, temp)
      * smoothstep(0.35, 0.12, c) * (1 - smoothstep(0.02, 0.1, mount));
    if (swamp > 0) h = lerp(h, SEA_LEVEL + this.nSurf.noise2(x / 14, z / 14) * 1.3 - 0.2, swamp * land);
    // Badlands: stepped mesas.
    const bad = smoothstep(0.4, 0.55, temp) * smoothstep(0, -0.25, hum) * smoothstep(-0.25, 0, v) * (1 - mount);
    if (bad > 0) {
      const m = Math.max(0, this.nMesa.fbm2(x / 90, z / 90, 3) * 1.8 + 0.1);
      h += Math.floor(m * 44 / 7) * 7 * smoothstep(0.3, 0.7, bad) * land;
    }
    // Rivers carve valleys through the land (shallower in the mountains).
    const r = Math.abs(this.nRiver.fbm2(x / 720, z / 720, 4));
    let river = 0;
    if (land > 0) {
      const width = 0.028 * (1 - mount * 0.6);
      const t = smoothstep(width, width * 3.2, r);
      const bed = SEA_LEVEL - 2.5 - (1 - smoothstep(0, width, r)) * 3;
      const carved = Math.min(h, bed) * (1 - t) + h * t;
      river = (1 - t) * land * (1 - mount * 0.7);
      h = h * (1 - river) + carved * river;
    }
    col.h = Math.min(h, HEIGHT - 14);
    col.c = c; col.e = e; col.mount = mount; col.pv = pv; col.v = v; col.river = river; col.swamp = swamp * land; col.bad = bad;
    // Colder up high.
    col.temp = temp - Math.max(0, col.h - 90) * 0.011;
    col.hum = hum;
    return col.h;
  }

  biome(col) {
    const { h, temp: t, hum, c, river, mount, pv, v } = col;
    if (h < SEA_LEVEL - 0.5) {
      if (river > 0.5 && h > SEA_LEVEL - 9) return t < -0.45 ? BIOME.FROZEN_RIVER : BIOME.RIVER;
      if (t < -0.6) return BIOME.FROZEN_OCEAN;
      if (h < 42) return BIOME.DEEP_OCEAN;
      return t > 0.45 ? BIOME.WARM_OCEAN : BIOME.OCEAN;
    }
    if (river > 0.62 && col.swamp < 0.5) return t < -0.45 ? BIOME.FROZEN_RIVER : BIOME.RIVER;
    if (h < SEA_LEVEL + 2.5 && c < 0.08 && mount < 0.15 && col.swamp < 0.5) return t < -0.45 ? BIOME.SNOWY_BEACH : BIOME.BEACH;
    if (mount > 0.25) {
      if (h > 168) return t < -0.05 ? (pv > 0.62 ? BIOME.JAGGED_PEAKS : BIOME.FROZEN_PEAKS) : BIOME.STONY_PEAKS;
      if (h > 128) return t < -0.05 ? BIOME.SNOWY_SLOPES : v > 0.2 ? BIOME.CHERRY_GROVE : BIOME.MEADOW;
      if (h > 98) return v > 0.35 && t > -0.1 ? BIOME.CHERRY_GROVE : t < -0.35 ? BIOME.SNOWY_SLOPES : hum > 0.15 ? BIOME.WINDSWEPT_FOREST : BIOME.MOUNTAINS;
    }
    if (col.swamp > 0.5) return BIOME.SWAMP;
    if (col.bad > 0.5) return BIOME.BADLANDS;
    if (t < -0.45) return v > 0.45 ? BIOME.ICE_SPIKES : hum > 0 ? BIOME.SNOWY_TAIGA : BIOME.SNOWY_PLAINS;
    if (t < -0.15) return hum > 0.2 && v > 0.05 ? BIOME.OLD_GROWTH_TAIGA : BIOME.TAIGA;
    if (t < 0.3) {
      if (hum < -0.35) return v > 0.35 ? BIOME.SUNFLOWER_PLAINS : BIOME.PLAINS;
      if (hum < -0.1) return v > 0.4 ? BIOME.FLOWER_FOREST : BIOME.PLAINS;
      if (hum < 0.35) return t < 0.05 ? (v > 0.3 ? BIOME.OLD_GROWTH_BIRCH : BIOME.BIRCH_FOREST) : v > 0.45 ? BIOME.FLOWER_FOREST : BIOME.FOREST;
      return BIOME.DARK_FOREST;
    }
    if (t < 0.55) {
      if (hum < -0.25) return BIOME.SAVANNA;
      if (hum < 0.15) return v > 0.4 ? BIOME.SUNFLOWER_PLAINS : v < -0.3 ? BIOME.FOREST : BIOME.PLAINS;
      return hum > 0.5 ? BIOME.JUNGLE : BIOME.SPARSE_JUNGLE;
    }
    if (hum < -0.05) return BIOME.DESERT;
    if (hum < 0.3) return BIOME.SAVANNA;
    return BIOME.JUNGLE;
  }

  // Surface height (integer) and biome for a single world column. Used for spawning.
  sample(x, z) {
    const h = this.column(x, z);
    return { height: Math.floor(h), biome: this.biome(this.col) };
  }

  // A pleasant starting point: dry, fairly flat ground in a green biome near the origin.
  findSpawn() {
    if (this.type === 'flat') return { x: 0.5, z: 0.5 };
    const green = new Set([BIOME.PLAINS, BIOME.FOREST, BIOME.BIRCH_FOREST, BIOME.FLOWER_FOREST, BIOME.SUNFLOWER_PLAINS, BIOME.MEADOW,
      BIOME.CHERRY_GROVE, BIOME.TAIGA, BIOME.SAVANNA]);
    const dry = (b) => ![BIOME.OCEAN, BIOME.DEEP_OCEAN, BIOME.WARM_OCEAN, BIOME.FROZEN_OCEAN, BIOME.RIVER, BIOME.FROZEN_RIVER, BIOME.SWAMP].includes(b);
    let fallback = null;
    for (let r = 0; r < 4000; r += 12) {
      const steps = Math.max(1, Math.floor((r * Math.PI * 2) / 12));
      for (let i = 0; i < steps; i++) {
        const a = (i / steps) * Math.PI * 2;
        const x = Math.round(Math.cos(a) * r), z = Math.round(Math.sin(a) * r);
        const s = this.sample(x, z);
        if (s.height <= SEA_LEVEL + 1 || s.height >= 110 || !dry(s.biome)) continue;
        fallback ??= { x: x + 0.5, z: z + 0.5 };
        if (!green.has(s.biome)) continue;
        let flat = true;
        for (const [dx, dz] of [[5, 0], [-5, 0], [0, 5], [0, -5]]) {
          if (Math.abs(this.sample(x + dx, z + dz).height - s.height) > 2) { flat = false; break; }
        }
        if (flat) return { x: x + 0.5, z: z + 0.5 };
      }
      if (fallback && r > 600) return fallback;
    }
    return fallback ?? { x: 0.5, z: 0.5 };
  }

  // Tunnel test for a single point (same lattice as the per-chunk sampler).
  caveAt(x, y, z) {
    const gx = Math.floor(x / 4) * 4, gy = Math.floor(y / 4) * 4, gz = Math.floor(z / 4) * 4;
    const fx = (x - gx) / 4, fy = (y - gy) / 4, fz = (z - gz) / 4;
    let a = 0, b = 0;
    for (let k = 0; k < 8; k++) {
      const dx = k & 1, dy = (k >> 1) & 1, dz = (k >> 2) & 1;
      const w = (dx ? fx : 1 - fx) * (dy ? fy : 1 - fy) * (dz ? fz : 1 - fz);
      const sx = gx + dx * 4, sy = gy + dy * 4, sz = gz + dz * 4;
      a += w * this.nCaveA.noise3(sx / 52, sy / 34, sz / 52);
      b += w * this.nCaveB.noise3(sx / 52, sy / 34, sz / 52 + 70);
    }
    return a * a + b * b < CAVE_T;
  }

  // A column's height and biome, for tree roots outside the chunk (remembered per chunk).
  rootColumn(x, z) {
    const k = `${x},${z}`;
    let r = this.columns.get(k);
    if (!r) {
      const h = this.column(x, z);
      r = { h: Math.floor(h), biome: this.biome(this.col), mount: this.col.mount };
      this.columns.set(k, r);
    }
    return r;
  }

  generate(cx, cz) {
    const blocks = new Uint16Array(CHUNK_VOLUME);
    const climate = new Uint8Array(512);
    const biomes = new Uint8Array(256);
    if (this.type === 'flat') {
      for (let i = 0; i < 256; i++) {
        blocks[i] = B.bedrock; blocks[256 + i] = B.dirt; blocks[512 + i] = B.dirt; blocks[768 + i] = B.grass_block;
        climate[i * 2] = toByte(0.3); climate[i * 2 + 1] = toByte(0.1); biomes[i] = BIOME.FLAT;
      }
      return { blocks, climate, biomes };
    }
    this.columns.clear();
    const x0 = cx * CHUNK, z0 = cz * CHUNK, seed = this.seed;
    const idx = (x, y, z) => (y << 8) | (z << 4) | x;

    // 1. Column data with a one-column margin for slopes.
    const H = new Int16Array(GW * GW), BIO = new Uint8Array(GW * GW), MOUNT = new Float32Array(GW * GW);
    const TEMP = new Float32Array(GW * GW), HUM = new Float32Array(GW * GW);
    for (let gz = 0; gz < GW; gz++) {
      for (let gx = 0; gx < GW; gx++) {
        const h = this.column(x0 + gx - PAD, z0 + gz - PAD);
        const i = gz * GW + gx;
        H[i] = Math.floor(h);
        BIO[i] = this.biome(this.col);
        MOUNT[i] = this.col.mount;
        TEMP[i] = this.col.temp;
        HUM[i] = this.col.hum;
        if (gx >= PAD && gx < GW - PAD && gz >= PAD && gz < GW - PAD) this.columns.set(`${x0 + gx - PAD},${z0 + gz - PAD}`, { h: H[i], biome: BIO[i], mount: MOUNT[i] });
      }
    }
    // Villages level their ground (and it eases back to the land around them).
    const vplans = villagesNear(this, cx, cz);
    const VIN = new Uint8Array(256); // 1 inside a village's wall
    if (vplans.length) {
      for (let gz = 0; gz < GW; gz++) for (let gx = 0; gx < GW; gx++) {
        const i = gz * GW + gx, wx = x0 + gx - PAD, wz = z0 + gz - PAD;
        const lv = groundLevel(vplans, wx, wz, H[i]);
        if (lv >= 0) { H[i] = lv; MOUNT[i] = Math.min(MOUNT[i], 0.2); }
        if (gx >= PAD && gx < GW - PAD && gz >= PAD && gz < GW - PAD && insideVillage(vplans, wx, wz, 1)) VIN[(gz - PAD) * 16 + gx - PAD] = 1;
      }
    }
    const slopeAt = (i) => Math.max(Math.abs(H[i + 1] - H[i]), Math.abs(H[i - 1] - H[i]), Math.abs(H[i + GW] - H[i]), Math.abs(H[i - GW] - H[i]));

    // 2. Rock: the height map, with overhanging cliffs worn into the mountains by 3D noise.
    let minH = HEIGHT, maxH = 0;
    for (let z = 0; z < 16; z++) for (let x = 0; x < 16; x++) {
      const h = H[(z + PAD) * GW + x + PAD];
      minH = Math.min(minH, h); maxH = Math.max(maxH, h);
    }
    const detailTop = Math.min(HEIGHT - 1, maxH + 12), detailBot = Math.max(1, minH - 22);
    const DY = 8, NY = Math.ceil((detailTop - detailBot) / DY) + 1;
    let D = null;
    const anyMount = MOUNT.some((m) => m > 0.3);
    if (anyMount) {
      D = new Float32Array(25 * NY);
      for (let iz = 0; iz < 5; iz++) for (let ix = 0; ix < 5; ix++) for (let iy = 0; iy < NY; iy++) {
        const sx = x0 + ix * 4, sy = detailBot + iy * DY, sz = z0 + iz * 4;
        D[(iz * 5 + ix) * NY + iy] = this.nDetail.fbm3(sx / 30, sy / 22, sz / 30, 2);
      }
    }
    const detail = (x, y, z) => {
      const fx = x / 4, fz = z / 4, fy = (y - detailBot) / DY;
      const ix = Math.min(3, Math.floor(fx)), iz = Math.min(3, Math.floor(fz)), iy = Math.min(NY - 2, Math.max(0, Math.floor(fy)));
      const tx = fx - ix, tz = fz - iz, ty = fy - iy;
      const at = (a, b, c) => D[((iz + c) * 5 + ix + a) * NY + iy + b];
      const l0 = (at(0, 0, 0) * (1 - tx) + at(1, 0, 0) * tx) * (1 - tz) + (at(0, 0, 1) * (1 - tx) + at(1, 0, 1) * tx) * tz;
      const l1 = (at(0, 1, 0) * (1 - tx) + at(1, 1, 0) * tx) * (1 - tz) + (at(0, 1, 1) * (1 - tx) + at(1, 1, 1) * tx) * tz;
      return l0 * (1 - ty) + l1 * ty;
    };
    const TOP = new Int16Array(256);
    for (let z = 0; z < 16; z++) {
      for (let x = 0; x < 16; x++) {
        const gi = (z + PAD) * GW + x + PAD, h = H[gi], wx = x0 + x, wz = z0 + z;
        const amp = D && CARVED.has(BIO[gi]) ? smoothstep(0.3, 0.8, MOUNT[gi]) * 1.4 : 0;
        const bedrockTop = 1 + Math.floor(hash2(wx, wz, seed ^ 0xbed) * 4);
        const deep = 10 + Math.floor(hash2(wx, wz, seed ^ 0xdee9) * 5);
        let top = 0;
        const hi = amp > 0 ? Math.min(HEIGHT - 2, h + 10) : h;
        for (let y = 0; y <= hi; y++) {
          let solid = y <= h;
          if (amp > 0 && y > h - 20) solid = (h - y) / 11 + detail(x, y, z) * amp * (y > h ? 0.55 : 1) > 0;
          if (!solid) continue;
          let id;
          if (y === 0 || (y < bedrockTop && hash3(wx, y, wz, seed) < 0.5)) id = B.bedrock;
          else id = y < deep ? B.deepslate : B.stone;
          blocks[idx(x, y, z)] = id;
          top = y;
        }
        TOP[z * 16 + x] = top;
      }
    }

    // 3. Surface layers: soil, sand, snow, clay bands, bare rock on cliffs.
    for (let z = 0; z < 16; z++) {
      for (let x = 0; x < 16; x++) {
        const gi = (z + PAD) * GW + x + PAD, biome = BIO[gi], wx = x0 + x, wz = z0 + z;
        const top = TOP[z * 16 + x], slope = slopeAt(gi);
        const n = this.nSurf.noise2(wx / 24, wz / 24), n2 = hash2(wx, wz, seed ^ 0x5eed);
        let surf = B.grass_block, filler = B.dirt, depth = 3 + (n2 < 0.5 ? 1 : 0), under = 0, underDepth = 0;
        const snowy = top > SNOWLINE + n * 10;
        switch (biome) {
          case BIOME.DESERT: surf = filler = B.sand; depth = 4; under = B.sandstone; underDepth = 4; break;
          case BIOME.BEACH: surf = filler = B.sand; depth = 4; under = B.sandstone; underDepth = 2; break;
          case BIOME.SNOWY_BEACH: surf = filler = B.sand; depth = 3; break;
          case BIOME.STONY_SHORE: surf = filler = B.stone; break;
          case BIOME.OCEAN: case BIOME.DEEP_OCEAN: case BIOME.WARM_OCEAN: case BIOME.FROZEN_OCEAN: case BIOME.RIVER: case BIOME.FROZEN_RIVER:
            surf = filler = top < SEA_LEVEL - 7 ? (n > 0.25 ? B.gravel : n < -0.45 ? B.clay : B.sand) : (n > 0.55 ? B.gravel : B.sand);
            if (surf === B.clay) filler = B.clay;
            depth = 3;
            break;
          case BIOME.SNOWY_PLAINS: case BIOME.SNOWY_TAIGA: case BIOME.ICE_SPIKES: surf = B.snowy_grass; break;
          case BIOME.OLD_GROWTH_TAIGA: surf = n > 0.05 ? B.podzol : n < -0.4 ? B.coarse_dirt : B.grass_block; break;
          case BIOME.SAVANNA: if (n > 0.45) surf = B.coarse_dirt; break;
          case BIOME.BADLANDS: surf = slope < 3 && (top < 90 || n2 < 0.3) ? B.red_sand : -1; filler = -1; depth = 1; break;
          case BIOME.STONY_PEAKS: surf = filler = n > 0.3 ? B.calcite : n < -0.35 ? B.gravel : B.stone; depth = 2; break;
          case BIOME.JAGGED_PEAKS: case BIOME.FROZEN_PEAKS:
            surf = slope >= 3 ? B.stone : biome === BIOME.FROZEN_PEAKS && n > 0.2 ? B.packed_ice : B.snow_block;
            filler = slope >= 3 ? B.stone : B.snow_block; depth = 2;
            break;
          case BIOME.SNOWY_SLOPES: surf = slope >= 4 ? B.stone : B.snow_block; filler = B.snow_block; depth = slope >= 4 ? 1 : 2; break;
          case BIOME.MOUNTAINS: case BIOME.WINDSWEPT_FOREST:
            if (slope >= 4) surf = filler = n > 0.3 ? B.gravel : B.stone;
            else if (n > 0.55) surf = B.coarse_dirt;
            break;
          default: if (slope >= 5) { surf = B.stone; filler = B.stone; }
        }
        // Steep mountainsides are bare rock; the high ground wears snow.
        if (MOUNT[gi] > 0.2 && slope >= 5 && surf !== B.red_sand && biome !== BIOME.BADLANDS) { surf = B.stone; filler = B.stone; }
        if (snowy && surf === B.grass_block) surf = B.snowy_grass;
        if (surf === B.grass_block && top < SEA_LEVEL) surf = B.dirt;
        if (biome === BIOME.BADLANDS) {
          // Bands of terracotta down the hillsides, sand on the flats.
          const off = Math.floor(this.nMesa.noise2(wx / 60, wz / 60) * 3);
          for (let y = top, k = 0; y > top - 40 && y > 0; y--, k++) {
            const i = idx(x, y, z);
            if (blocks[i] !== B.stone) continue;
            blocks[i] = k === 0 && surf === B.red_sand ? B.red_sand : k < 3 && surf === B.red_sand && y > 70 ? B.red_sandstone
              : y < SEA_LEVEL - 4 ? B.stone : BANDS[((y + off) % BANDS.length + BANDS.length) % BANDS.length];
          }
        } else {
          // Soil goes down from the surface; the overhangs of the cliffs stay rock.
          for (let y = top, k = 0; y > 0 && k < depth + underDepth; y--) {
            const i = idx(x, y, z);
            if (!STONEY.has(blocks[i])) { if (blocks[i] === 0) break; continue; }
            blocks[i] = k === 0 ? surf : k < depth ? filler : under || blocks[i];
            k++;
          }
        }
        climate[(z * 16 + x) * 2] = toByte(TEMP[gi]);
        climate[(z * 16 + x) * 2 + 1] = toByte(HUM[gi]);
        biomes[z * 16 + x] = biome;
      }
    }

    // 4. Caves: two noise fields whose shared zero-crossings form tunnels, plus caverns deep down.
    const GY = HEIGHT / 4 + 1;
    const SA = new Float32Array(25 * GY), SB = new Float32Array(25 * GY), SC = new Float32Array(25 * GY);
    const caveTop = Math.min(HEIGHT - 1, maxH + 8);
    for (let iz = 0; iz < 5; iz++) for (let ix = 0; ix < 5; ix++) {
      const sx = x0 + ix * 4, sz = z0 + iz * 4;
      for (let iy = 0; iy < GY; iy++) {
        const sy = iy * 4, k = (iz * 5 + ix) * GY + iy;
        if (sy > caveTop + 4) { SA[k] = SB[k] = 1; SC[k] = -1; continue; }
        SA[k] = this.nCaveA.noise3(sx / 52, sy / 34, sz / 52);
        SB[k] = this.nCaveB.noise3(sx / 52, sy / 34, sz / 52 + 70);
        SC[k] = sy < 56 ? this.nCheese.noise3(sx / 90, sy / 44, sz / 90) : -1;
      }
    }
    const ca = new Float32Array(GY), cb = new Float32Array(GY), cc = new Float32Array(GY);
    for (let z = 0; z < 16; z++) {
      for (let x = 0; x < 16; x++) {
        const gi = (z + PAD) * GW + x + PAD, h = TOP[z * 16 + x];
        let minN = H[gi];
        for (const o of [1, -1, GW, -GW, GW + 1, GW - 1, -GW + 1, -GW - 1]) minN = Math.min(minN, H[gi + o]);
        let maxY = h;
        // Keep caves from breaking out under the sea and rivers.
        if (h <= SEA_LEVEL + 1 || minN < SEA_LEVEL) maxY = Math.min(h, minN) - 5;
        if (VIN[z * 16 + x]) maxY = Math.min(maxY, h - 8);
        if (maxY < 6) continue;
        const ix = x >> 2, iz = z >> 2, fx = (x & 3) / 4, fz = (z & 3) / 4;
        const k00 = (iz * 5 + ix) * GY, k10 = (iz * 5 + ix + 1) * GY, k01 = ((iz + 1) * 5 + ix) * GY, k11 = ((iz + 1) * 5 + ix + 1) * GY;
        const w00 = (1 - fx) * (1 - fz), w10 = fx * (1 - fz), w01 = (1 - fx) * fz, w11 = fx * fz;
        const topSample = Math.min(GY - 1, (maxY >> 2) + 1);
        for (let iy = 0; iy <= topSample; iy++) {
          ca[iy] = SA[k00 + iy] * w00 + SA[k10 + iy] * w10 + SA[k01 + iy] * w01 + SA[k11 + iy] * w11;
          cb[iy] = SB[k00 + iy] * w00 + SB[k10 + iy] * w10 + SB[k01 + iy] * w01 + SB[k11 + iy] * w11;
          cc[iy] = SC[k00 + iy] * w00 + SC[k10 + iy] * w10 + SC[k01 + iy] * w01 + SC[k11 + iy] * w11;
        }
        for (let y = 6; y <= maxY; y++) {
          const iy = y >> 2, fy = (y & 3) / 4;
          const a = ca[iy] + (ca[iy + 1] - ca[iy]) * fy;
          const b = cb[iy] + (cb[iy + 1] - cb[iy]) * fy;
          const c = cc[iy] + (cc[iy + 1] - cc[iy]) * fy;
          if (a * a + b * b < CAVE_T || c > 0.6) {
            const i = idx(x, y, z);
            if (blocks[i] !== B.bedrock) blocks[i] = y <= 10 ? B.lava : 0;
          }
        }
      }
    }

    // 5. Ore veins, and blobs of granite, diorite, andesite, gravel and dirt. Veins seeded in
    // neighbouring chunks may reach into this one.
    for (let ncz = cz - 1; ncz <= cz + 1; ncz++) {
      for (let ncx = cx - 1; ncx <= cx + 1; ncx++) {
        ORES.forEach(([ore, deepOre, count, size, minY, maxY, peak], oi) => {
          const rnd = mulberry32(Math.floor(hash3(ncx, oi, ncz, seed ^ 0x0e5) * 4294967296));
          const n = Math.floor(count) + (rnd() < count % 1 ? 1 : 0);
          for (let v = 0; v < n; v++) {
            let x = ncx * 16 + Math.floor(rnd() * 16) - x0;
            // Veins cluster around their peak height (a triangle distribution).
            let y = peak === null ? minY + Math.floor(rnd() * (maxY - minY)) : Math.round(peak + ((rnd() + rnd()) / 2 - 0.5) * 2 * Math.max(peak - minY, maxY - peak));
            let z = ncz * 16 + Math.floor(rnd() * 16) - z0;
            if (y < minY || y > maxY) continue;
            for (let s = 0; s < size; s++) {
              for (let k = 0; k < (size > 10 ? 3 : 1); k++) {
                const px = x + (k === 1 ? 1 : 0), py = y + (k === 2 ? 1 : 0);
                if (px >= 0 && px < 16 && z >= 0 && z < 16 && py > 0 && py < HEIGHT) {
                  const i = idx(px, py, z);
                  if (blocks[i] === B.stone) blocks[i] = ore;
                  else if (blocks[i] === B.deepslate) blocks[i] = deepOre;
                }
              }
              const d = Math.floor(rnd() * 6);
              if (d === 0) x++; else if (d === 1) x--; else if (d === 2) y++; else if (d === 3) y--; else if (d === 4) z++; else z--;
            }
          }
        });
        // Emeralds, one at a time, deep in the mountains.
        const er = mulberry32(Math.floor(hash2(ncx, ncz, seed ^ 0xe3e7a1d) * 4294967296));
        for (let k = 0; k < 3; k++) {
          const x = ncx * 16 + Math.floor(er() * 16) - x0, z = ncz * 16 + Math.floor(er() * 16) - z0, y = 70 + Math.floor(er() * 120);
          if (x >= 0 && x < 16 && z >= 0 && z < 16 && blocks[idx(x, y, z)] === B.stone && MOUNT[(z + PAD) * GW + x + PAD] > 0.3) blocks[idx(x, y, z)] = B.emerald_ore;
        }
      }
    }

    // 6. Seas, rivers and swamp pools.
    for (let z = 0; z < 16; z++) {
      for (let x = 0; x < 16; x++) {
        const gi = (z + PAD) * GW + x + PAD, biome = BIO[gi];
        const frozen = TEMP[gi] < -0.45 || biome === BIOME.FROZEN_RIVER || biome === BIOME.FROZEN_OCEAN;
        for (let y = TOP[z * 16 + x] + 1; y <= SEA_LEVEL; y++) {
          const i = idx(x, y, z);
          if (blocks[i] === 0) blocks[i] = frozen && y === SEA_LEVEL ? B.ice : B.water;
        }
      }
    }

    // 7. Small structures: dungeons, wells, ice spikes, icebergs, boulders, fallen logs.
    const put = (wx, y, wz, id, isLog = false, onlyAir = false) => {
      const x = wx - x0, z = wz - z0;
      if (x < 0 || x > 15 || z < 0 || z > 15 || y < 1 || y >= HEIGHT) return false;
      const i = idx(x, y, z), cur = blocks[i];
      if (cur === 0 || (!onlyAir && ((REPLACEABLE[cur] && !WATERLIKE[cur]) || cur === B.tall_grass || cur === B.fern || (isLog && NATURAL_LEAVES[cur])))) {
        blocks[i] = id;
        return true;
      }
      return false;
    };
    const set = (wx, y, wz, id) => {
      const x = wx - x0, z = wz - z0;
      if (x < 0 || x > 15 || z < 0 || z > 15 || y < 1 || y >= HEIGHT) return;
      blocks[idx(x, y, z)] = id;
    };
    const get = (wx, y, wz) => {
      const x = wx - x0, z = wz - z0;
      if (x < 0 || x > 15 || z < 0 || z > 15 || y < 0 || y >= HEIGHT) return -1;
      return blocks[idx(x, y, z)];
    };
    this.structures(cx, cz, set, get);

    // 8. Ground cover: grass, ferns, flowers, cane, cacti, melons and pumpkins, mushrooms in caves.
    for (let z = 0; z < 16; z++) {
      for (let x = 0; x < 16; x++) {
        const gi = (z + PAD) * GW + x + PAD, biome = BIO[gi], wx = x0 + x, wz = z0 + z;
        const h = TOP[z * 16 + x];
        if (h + 2 < HEIGHT && !VIN[z * 16 + x]) {
          const ground = blocks[idx(x, h, z)], above = idx(x, h + 1, z);
          if (blocks[above] === 0) {
            const r = hash2(wx, wz, seed ^ 0x9a55), r2 = hash2(wz, wx, seed ^ 0xf10);
            const cover = COVER[biome] ?? COVER.default;
            if (ground === B.grass_block || ground === B.podzol) {
              const patch = this.nSurf.noise2(wx / 36 + 11, wz / 36 - 5) > 0.3 ? 2.5 : 0.5;
              const flower = (cover.flower ?? 0) * patch, tall = cover.tall ?? 0, grass = cover.grass ?? 0, fern = cover.fern ?? 0;
              const list = FLOWERS[biome] ?? FLOWERS.default;
              let acc = 0;
              if (r < (acc += flower)) blocks[above] = B[list[Math.floor(r2 * list.length)]];
              else if (r < (acc += cover.sunflower ?? 0)) { blocks[above] = B.sunflower; blocks[above + 256] = B.sunflower_top; }
              else if (r < (acc += tall)) {
                const kinds = biome === BIOME.TAIGA || biome === BIOME.OLD_GROWTH_TAIGA || biome === BIOME.JUNGLE ? ['large_fern', 'tall_grass_double']
                  : biome === BIOME.FLOWER_FOREST || biome === BIOME.MEADOW ? ['lilac', 'rose_bush', 'peony', 'tall_grass_double'] : ['tall_grass_double', 'tall_grass_double', 'rose_bush', 'lilac'];
                const k = B[kinds[Math.floor(r2 * kinds.length)]];
                blocks[above] = k; blocks[above + 256] = DOUBLE[k].other;
              } else if (r < (acc += fern)) blocks[above] = B.fern;
              else if (r < (acc += grass)) blocks[above] = B.tall_grass;
              else if (r < (acc += cover.melon ?? 0)) blocks[above] = B.melon;
              else if (r < (acc += cover.mushroom ?? 0)) blocks[above] = r2 < 0.5 ? B.red_mushroom : B.brown_mushroom;
              else if (r > 0.9993 && biome !== BIOME.JUNGLE) {
                const v = FACING_VARIANTS[B.pumpkin];
                blocks[above] = [v[4], v[5], v[0], v[1]][Math.floor(r2 * 4)];
              }
            } else if ((ground === B.sand || ground === B.red_sand) && (biome === BIOME.DESERT || biome === BIOME.BADLANDS)) {
              if (r < 0.008) blocks[above] = B.dead_bush;
              else if (r > 0.994 && biome === BIOME.DESERT || r > 0.997) {
                const tall = 1 + Math.floor(r2 * 3);
                for (let k = 0; k < tall; k++) blocks[above + k * 256] = B.cactus;
              }
            } else if (ground === B.terracotta || BANDS.includes(ground)) {
              if (r < 0.006) blocks[above] = B.dead_bush;
            } else if (ground === B.snowy_grass && r < 0.04) blocks[above] = B.tall_grass;
            else if (ground === B.coarse_dirt && r < 0.1) blocks[above] = B.tall_grass;
            // Sugar cane along the water's edge.
            if ((ground === B.grass_block || ground === B.sand) && h === SEA_LEVEL && blocks[above] === 0 && r > 0.82) {
              let wet = false;
              for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
                const nx = x + dx, nz = z + dz;
                if (nx >= 0 && nx < 16 && nz >= 0 && nz < 16 && blocks[idx(nx, SEA_LEVEL, nz)] === B.water) wet = true;
              }
              if (wet) {
                const tall = 1 + Math.floor(r2 * 3);
                for (let k = 0; k < tall; k++) blocks[above + k * 256] = B.sugar_cane;
              }
            }
          } else if (blocks[above] === B.water && biome === BIOME.SWAMP && h === SEA_LEVEL - 1 && hash2(wx, wz, seed ^ 0x111) < 0.12) {
            blocks[idx(x, SEA_LEVEL + 1, z)] = B.lily_pad;
          }
        }
        // Mushrooms on cave floors.
        for (let y = 12; y < h - 8; y++) {
          const i = idx(x, y, z);
          if (blocks[i] === 0 && STONEY.has(blocks[i - 256]) && hash3(wx, y, wz, seed ^ 0x3c) < 0.005) {
            blocks[i] = hash3(wz, y, wx, seed) < 0.5 ? B.brown_mushroom : B.red_mushroom;
          }
        }
      }
    }

    // 9. Trees, including those rooted nearby whose crowns reach into this chunk.
    for (let wz = z0 - TREE_REACH; wz < z0 + 16 + TREE_REACH; wz++) {
      for (let wx = x0 - TREE_REACH; wx < x0 + 16 + TREE_REACH; wx++) {
        const roll = hash2(wx, wz, seed ^ 0x7ee);
        if (roll > 0.08) continue;
        const inside = wx >= x0 && wx < x0 + 16 && wz >= z0 && wz < z0 + 16;
        const col = inside ? this.columns.get(`${wx},${wz}`) : this.rootColumn(wx, wz);
        const table = TREE_TABLE[col.biome];
        if (!table || roll >= table[0]) continue;
        if (vplans.length && insideVillage(vplans, wx, wz, 4)) continue;
        let h = col.h;
        if (inside) h = TOP[(wz - z0) * 16 + wx - x0];
        if (h <= SEA_LEVEL - (col.biome === BIOME.SWAMP ? 2 : 0) || h > HEIGHT - 40) continue;
        if (inside) {
          const g = blocks[idx(wx - x0, h, wz - z0)];
          if (g !== B.grass_block && g !== B.podzol && g !== B.dirt && g !== B.coarse_dirt && g !== B.snowy_grass && !(col.biome === BIOME.SWAMP && g === B.water)) continue;
        }
        if (this.caveAt(wx, h, wz)) continue;
        const rnd = mulberry32(Math.floor(hash2(wx, wz, seed ^ 0x1ee7) * 4294967296));
        let pickT = rnd() * table[1].reduce((a, [w]) => a + w, 0), kind = table[1][0][1];
        for (const [w, k] of table[1]) { if ((pickT -= w) <= 0) { kind = k; break; } }
        // Two-wide trees need level ground under all four trunk columns.
        if (WIDE_TREES.has(kind)) {
          const ok = [[1, 0], [0, 1], [1, 1]].every(([a, b]) => {
            const c2 = (wx + a >= x0 && wx + a < x0 + 16 && wz + b >= z0 && wz + b < z0 + 16) ? this.columns.get(`${wx + a},${wz + b}`) : this.rootColumn(wx + a, wz + b);
            return Math.abs(c2.h - col.h) <= 1;
          });
          if (!ok) kind = kind === 'dark_oak' ? 'oak' : kind === 'mega_jungle' ? 'jungle' : 'tall_spruce';
        }
        // In a swamp the trunk may stand in shallow water.
        TREES[kind](put, wx, h + 1, wz, rnd);
      }
    }

    // 10. Villages.
    for (const p of villagePieces(this, cx, cz, vplans)) p(set);
    return { blocks, climate, biomes };
  }

  // Structures that fit inside a chunk or poke a little over its edge. `set` writes a block,
  // `get` reads one (-1 outside the chunk).
  structures(cx, cz, set, get) {
    const seed = this.seed;
    for (let ncz = cz - 1; ncz <= cz + 1; ncz++) {
      for (let ncx = cx - 1; ncx <= cx + 1; ncx++) {
        const r = mulberry32(Math.floor(hash2(ncx, ncz, seed ^ 0x57c) * 4294967296));
        const bx = ncx * 16 + 2 + Math.floor(r() * 12), bz = ncz * 16 + 2 + Math.floor(r() * 12);
        const roll = r();
        const col = this.rootColumn(bx, bz);
        const h = col.h;
        // (In newer worlds nothing but dungeons turns up in a settlement's grounds.)
        const settled = this.version >= 4 && roll >= 0.14 && villageAt(this, bx, bz, 10);
        if (settled) continue;
        // Dungeon: a mossy room deep underground with a chest or two.
        if (roll < 0.14 && ncx === cx && ncz === cz) {
          const y0 = 12 + Math.floor(r() * 36);
          if (y0 + 6 < h - 4) {
            for (let dy = 0; dy < 6; dy++) for (let dz = -3; dz <= 3; dz++) for (let dx = -3; dx <= 3; dx++) {
              const wall = Math.abs(dx) === 3 || Math.abs(dz) === 3 || dy === 0 || dy === 5;
              set(bx + dx, y0 + dy, bz + dz, wall ? (r() < 0.45 ? B.mossy_cobblestone : B.cobblestone) : 0);
            }
            set(bx - 2, y0 + 1, bz, LOOT_CHEST.dungeon);
            if (r() < 0.5) set(bx + 2, y0 + 1, bz, LOOT_CHEST.dungeon);
            // A way in: a short tunnel to one side.
            for (let k = 3; k < 7; k++) { set(bx + k, y0 + 1, bz, 0); set(bx + k, y0 + 2, bz, 0); }
          }
        }
        // Desert well (rare: one in a few hundred desert chunks).
        if (col.biome === BIOME.DESERT && roll > 0.9975 && h > SEA_LEVEL) {
          for (let dz = -2; dz <= 2; dz++) for (let dx = -2; dx <= 2; dx++) {
            set(bx + dx, h, bz + dz, B.sandstone);
            if (Math.abs(dx) === 2 || Math.abs(dz) === 2) set(bx + dx, h + 1, bz + dz, B.sandstone_slab);
          }
          set(bx, h, bz, B.water); set(bx, h - 1, bz, B.sandstone);
          for (const [dx, dz] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) set(bx + dx, h + 1, bz + dz, 0);
          for (const [dx, dz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) for (let y = h + 1; y <= h + 3; y++) set(bx + dx, y, bz + dz, B.sandstone);
          for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) set(bx + dx, h + 4, bz + dz, B.sandstone_slab);
        }
        // Ice spikes.
        if (col.biome === BIOME.ICE_SPIKES && roll > 0.5) {
          const tall = 8 + Math.floor(r() * (roll > 0.92 ? 30 : 12)), rad = tall > 25 ? 2.2 : 1.4;
          for (let y = 0; y < tall; y++) {
            const k = rad * (1 - y / tall) + 0.5;
            for (let dz = -3; dz <= 3; dz++) for (let dx = -3; dx <= 3; dx++) if (dx * dx + dz * dz <= k * k) set(bx + dx, h + 1 + y, bz + dz, B.packed_ice);
          }
          for (let y = -3; y < 1; y++) set(bx, h + y, bz, B.packed_ice);
        }
        // Icebergs drifting in frozen seas.
        if (col.biome === BIOME.FROZEN_OCEAN && roll > 0.8 && h < SEA_LEVEL - 4) {
          const rad = 3 + r() * 4, up = 3 + r() * 8;
          for (let dy = -Math.ceil(rad * 1.4); dy <= up; dy++) {
            const k = dy > 0 ? rad * (1 - dy / (up + 1)) : rad * (1 + dy / (rad * 1.6));
            for (let dz = -8; dz <= 8; dz++) for (let dx = -8; dx <= 8; dx++) {
              if (dx * dx + dz * dz > k * k) continue;
              const y = SEA_LEVEL + dy;
              if (get(bx + dx, y, bz + dz) !== -1 && y > h) set(bx + dx, y, bz + dz, (dx + dz + dy) % 5 === 0 ? B.ice : B.packed_ice);
            }
          }
        }
        // Mossy boulders in old spruce forests, stone ones in the windswept hills.
        if ((col.biome === BIOME.OLD_GROWTH_TAIGA && roll > 0.55) || (col.biome === BIOME.MOUNTAINS && roll > 0.85)) {
          const rad = 1.3 + r() * 1.4;
          for (let dy = -1; dy <= Math.ceil(rad); dy++) for (let dz = -3; dz <= 3; dz++) for (let dx = -3; dx <= 3; dx++) {
            if (dx * dx + dy * dy * 1.3 + dz * dz > rad * rad) continue;
            set(bx + dx, h + dy + 1, bz + dz, col.biome === BIOME.OLD_GROWTH_TAIGA && r() < 0.7 ? B.mossy_cobblestone : B.cobblestone);
          }
        }
        // Fallen trees in the woods: a stump and a log lying beside it.
        const logOf = { [BIOME.FOREST]: 'oak', [BIOME.FLOWER_FOREST]: 'oak', [BIOME.BIRCH_FOREST]: 'birch', [BIOME.OLD_GROWTH_BIRCH]: 'birch',
          [BIOME.TAIGA]: 'spruce', [BIOME.OLD_GROWTH_TAIGA]: 'spruce', [BIOME.JUNGLE]: 'jungle', [BIOME.DARK_FOREST]: 'dark_oak' }[col.biome];
        if (logOf && roll > 0.3 && roll < 0.42 && col.mount < 0.2 && get(bx, h, bz) !== -1 && SOLID[get(bx, h, bz)] && !WATERLIKE[get(bx, h + 1, bz)]) {
          const logId = B[`${logOf}_log`], along = r() < 0.5, len = 4 + Math.floor(r() * 3);
          set(bx, h + 1, bz, logId);
          const axis = LOG_AXES_OF(logId, along);
          for (let k = 2; k < 2 + len; k++) {
            const x = bx + (along ? k : 0), z = bz + (along ? 0 : k);
            const below = get(x, h, z);
            if (below === -1 || !SOLID[below] || get(x, h + 1, z) > 0 && !REPLACEABLE[get(x, h + 1, z)]) break;
            set(x, h + 1, z, axis);
          }
        }
      }
    }
  }
}

// The x- or z-lying version of a log.
function LOG_AXES_OF(log, alongX) {
  const pairs = { [B.oak_log]: [100, 101], [B.birch_log]: [102, 103], [B.spruce_log]: [104, 105] };
  const p = pairs[log] ?? [log + 1, log + 2];
  return alongX ? p[0] : p[1];
}

// The generator a world was made with: worlds from before the release update keep the first one.
export function makeGenerator(seed, type = 'default', version = 2) {
  return version >= 2 ? new WorldGen(seed, type, version) : new WorldGenV1(seed, type);
}
