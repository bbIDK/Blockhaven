// One Piece's planet (the One Piece mod, see mods.js): a world of ocean PLANET blocks round each way
// (it repeats, so sailing on brings you back: see World.wrap), laid out as the One Piece world is.
// The Red Line, the one continent, is a wall of red rock running all the way round from north to
// south; the Grand Line is a band of sea running all the way round from west to east, with a Calm
// Belt on either side of it (no islands there, only Sea Kings). Where the two cross stands Reverse
// Mountain, the one way through the Red Line, a canal cut through it. The four quarters left are the
// Blues. Islands rise out of the sea, each of a kind found in the story (an East Blue village isle,
// a desert kingdom, a winter island of drum-shaped peaks, a jungle with a volcano...), more of them
// and wilder on the Grand Line. (See docs/onepiece/world.md for the research behind it.)
//
// It drives WorldGen (worldgen.js): `column` gives each column's height and climate and `biome` its
// biome, and the rest (rock, soil, trees, caves, ores, the sea's plants) is WorldGen's own.
import { SEA_LEVEL } from './config.js';
import { BIOME } from './biomes.js';
import { hash2, smoothstep, lerp } from './math.js';
import { PLANET } from './mods.js';

const W = PLANET, HALF = W / 2;
// The Red Line (at x HALF), the Grand Line (z HALF) and its Calm Belts, in blocks from their middles.
export const RED_LINE = { x: HALF, half: 90 };
export const GRAND_LINE = { z: HALF, half: 1500, calm: 1850 };
// Reverse Mountain's canal, through the Red Line where the Grand Line meets it.
const CANAL = 12;
// Islands: at most one in each CELL-block square (so none ever crosses the planet's edge, at a
// cell's border), kept clear of the edges of its square.
const CELL = 512, CELLS = W / CELL;

// Where on the planet a place is: the Red Line, Reverse Mountain, the Grand Line (Paradise or the
// New World), a Calm Belt, or one of the four Blues.
export function seaAt(x, z) {
  const dz = Math.abs(z - GRAND_LINE.z);
  if (dz < GRAND_LINE.half) return x >= HALF ? 'paradise' : 'newworld';
  if (dz < GRAND_LINE.calm) return 'calm';
  if (z < HALF) return x >= HALF ? 'east' : 'north';
  return x >= HALF ? 'south' : 'west';
}
export const SEA_NAMES = { east: 'East Blue', north: 'North Blue', west: 'West Blue', south: 'South Blue', calm: 'the Calm Belt',
  paradise: 'the Grand Line (Paradise)', newworld: 'the New World' };

// The kinds of island, each after islands of the story (see docs/onepiece/world.md): how big, the
// shape of the land and the biomes on it. `climate`: [temperature, humidity] for the colours of
// grass and leaves.
export const KINDS = {
  village: { name: 'Village Island', size: [80, 130], climate: [0.1, 0.1] }, // Dawn Island, Syrup Village
  plateau: { name: 'Cliff Island', size: [80, 120], climate: [0.15, 0.2] }, // the Gecko Islands
  marine: { name: 'Marine Island', size: [70, 110], climate: [0.1, 0] }, // Shells Town, Loguetown
  spring: { name: 'Spring Island', size: [90, 150], climate: [0.15, 0.3] }, // the Grand Line's seasons
  autumn: { name: 'Autumn Island', size: [90, 150], climate: [-0.1, 0.2] },
  summer: { name: 'Summer Island', size: [90, 160], climate: [0.6, 0.4] }, // Jaya
  winter: { name: 'Winter Island', size: [110, 180], climate: [-0.7, 0.3] }, // Drum Island
  desert: { name: 'Desert Island', size: [130, 200], climate: [0.8, -0.6] }, // Arabasta
  volcano: { name: 'Prehistoric Island', size: [120, 190], climate: [0.6, 0.8] }, // Little Garden
  mangrove: { name: 'Mangrove Island', size: [100, 160], climate: [0.4, 0.8] }, // Sabaody
  thriller: { name: 'Haunted Island', size: [90, 140], climate: [0, 0.6] }, // Thriller Bark
  wano: { name: 'Land of Wano', size: [140, 210], climate: [0.25, 0.3] }, // Wano Country
  hazard: { name: 'Fire and Ice Island', size: [110, 170], climate: [0, 0] }, // Punk Hazard
};
// Which kinds turn up in which sea, and how often.
const KIND_ODDS = {
  east: { village: 5, plateau: 2, marine: 2, spring: 2, autumn: 2, summer: 1 },
  north: { winter: 3, autumn: 3, village: 2, marine: 2, thriller: 1, plateau: 1 },
  west: { mangrove: 2, village: 2, spring: 2, autumn: 2, marine: 2, thriller: 1 },
  south: { summer: 3, desert: 2, village: 2, marine: 2, spring: 1, volcano: 1 },
  paradise: { desert: 2, winter: 2, volcano: 2, summer: 2, spring: 1, autumn: 1, mangrove: 1, marine: 2, thriller: 1, village: 1 },
  newworld: { wano: 2, hazard: 2, volcano: 2, winter: 2, desert: 1, summer: 1, marine: 2, thriller: 1, mangrove: 1 },
};
const ODDS = Object.fromEntries(Object.entries(KIND_ODDS).map(([sea, t]) => {
  const list = Object.entries(t), total = list.reduce((a, [, n]) => a + n, 0);
  return [sea, { list, total }];
}));
// How likely a square of sea is to hold an island.
const ISLAND_CHANCE = { east: 0.5, north: 0.45, west: 0.45, south: 0.45, paradise: 0.8, newworld: 0.8, calm: 0 };
// The first island, where everyone starts: an East Blue village island (Dawn Island, Foosha).
export const START_CELL = [24, 6];

// Smooth value noise that repeats every `period` lattice steps (so the sea floor joins up all the
// way round the planet).
function lattice(ix, iz, period, seed) { return hash2(((ix % period) + period) % period, ((iz % period) + period) % period, seed); }
function pnoise(x, z, scale, seed) {
  const period = W / scale, fx = x / scale, fz = z / scale, ix = Math.floor(fx), iz = Math.floor(fz);
  let tx = fx - ix, tz = fz - iz;
  tx = tx * tx * (3 - 2 * tx); tz = tz * tz * (3 - 2 * tz);
  const a = lattice(ix, iz, period, seed), b = lattice(ix + 1, iz, period, seed);
  const c = lattice(ix, iz + 1, period, seed), d = lattice(ix + 1, iz + 1, period, seed);
  return lerp(lerp(a, b, tx), lerp(c, d, tx), tz) * 2 - 1;
}
const pfbm = (x, z, seed) => pnoise(x, z, 1024, seed) * 0.55 + pnoise(x, z, 256, seed + 1) * 0.3 + pnoise(x, z, 64, seed + 2) * 0.15;

export class Archipelago {
  constructor(seed) {
    this.seed = seed >>> 0;
    this.cells = new Map();
  }

  // The island of square (i, j), or null: { kind, x, z (its middle), r (its size), seed, n (peaks) }.
  island(i, j) {
    i = ((i % CELLS) + CELLS) % CELLS; j = ((j % CELLS) + CELLS) % CELLS;
    const key = i * CELLS + j;
    let isle = this.cells.get(key);
    if (isle !== undefined) return isle;
    const s = this.seed, cx = i * CELL + CELL / 2, cz = j * CELL + CELL / 2;
    const sea = seaAt(cx, cz), start = i === START_CELL[0] && j === START_CELL[1];
    // (None by the Red Line, nor in the Calm Belts.)
    const nearRed = Math.abs(cx - RED_LINE.x) < CELL;
    isle = null;
    if (start || (!nearRed && hash2(i, j, s ^ 0x15e) < ISLAND_CHANCE[sea])) {
      let kind = 'village';
      if (!start) {
        const { list, total } = ODDS[sea];
        let roll = hash2(i, j, s ^ 0x41d) * total;
        for (const [k, n] of list) { roll -= n; if (roll < 0) { kind = k; break; } }
      }
      const [lo, hi] = KINDS[kind].size, r = start ? 110 : lo + hash2(i, j, s ^ 0x512e) * (hi - lo);
      const room = CELL / 2 - r * 1.35 - 24;
      const ox = start ? 0 : (hash2(i, j, s ^ 0x0ff1) * 2 - 1) * Math.max(0, room), oz = start ? 0 : (hash2(i, j, s ^ 0x0ff2) * 2 - 1) * Math.max(0, room);
      isle = { kind, x: cx + ox, z: cz + oz, r, seed: (s ^ (key * 2654435761)) >>> 0, sea, start };
      // (A winter island's drum-shaped peaks: where they stand, how wide and how tall.)
      if (kind === 'winter') {
        isle.peaks = [];
        const n = 3 + Math.floor(hash2(i, j, s ^ 0xd2) * 3);
        for (let k = 0; k < n; k++) {
          const a = hash2(k, key, s ^ 0xa1) * Math.PI * 2, d = (k ? 0.25 + hash2(k, key, s ^ 0xa2) * 0.4 : 0) * r;
          isle.peaks.push({ x: isle.x + Math.cos(a) * d, z: isle.z + Math.sin(a) * d, r: 10 + hash2(k, key, s ^ 0xa3) * 14 + (k ? 0 : 6),
            h: k ? 40 + hash2(k, key, s ^ 0xa4) * 50 : 110 });
        }
      }
      // (Which way a fire-and-ice island is split, and where a cliff island's two ramps go up.)
      isle.angle = hash2(i, j, s ^ 0xa9) * Math.PI * 2;
    }
    this.cells.set(key, isle);
    if (this.cells.size > 4096) this.cells.clear();
    return isle;
  }

  // The island nearest (x, z), with `t`: 1 at its middle, 0 at its shore, less out at sea.
  islandAt(x, z) {
    const i = Math.floor(x / CELL), j = Math.floor(z / CELL);
    const isle = this.island(i, j);
    if (!isle) return null;
    const dx = x - isle.x, dz = z - isle.z, d = Math.hypot(dx, dz);
    // (A ragged shore: the radius wanders with the angle, and with smaller bays and points.)
    const a = Math.atan2(dz, dx), s = isle.seed % 997;
    const edge = isle.r * (1 + 0.18 * Math.sin(a * 3 + s) + 0.1 * Math.sin(a * 7 + s * 1.7) + 0.08 * pnoise(x, z, 32, isle.seed & 0xffff));
    return { isle, t: 1 - d / edge, d, a, dx, dz };
  }

  // Height (fractional) and climate of a column, into `col` (as WorldGen.column does).
  column(gen, x, z) {
    const col = gen.col, s = this.seed;
    // The open sea: deep, its floor rolling (and joining up all the way round).
    let h = SEA_LEVEL - 26 + pfbm(x, z, s ^ 0x5ea) * 12;
    let biome = null, temp = 0.2, hum = 0.3, mount = 0;
    // Shallows and the sea's warmth by where it is.
    const sea = seaAt(x, z);
    temp = sea === 'north' ? -0.35 : sea === 'south' ? 0.5 : sea === 'calm' ? 0.3 : sea === 'newworld' ? 0.3 : 0.15;
    // The Red Line: sheer red rock walls from the sea floor up to y 250, and Reverse Mountain's canal.
    const rx = Math.abs(x - RED_LINE.x) - pnoise(x, z, 64, s ^ 0x2ed) * 14;
    if (rx < RED_LINE.half + 40) {
      const k = smoothstep(RED_LINE.half + 40, RED_LINE.half - 10, rx);
      const top = 235 + pnoise(x, z, 128, s ^ 0x2ee) * 15;
      h = lerp(h, top, k);
      biome = k > 0.3 ? BIOME.BADLANDS : null;
      mount = k;
      // (Reverse Mountain: the canal through it, and the mountain rising round it.)
      const dzc = Math.abs(z - GRAND_LINE.z);
      if (dzc < 260) h = Math.max(h, lerp(h, 300, smoothstep(260, 40, dzc) * k));
      if (dzc < CANAL + 6 && rx < RED_LINE.half + 40) {
        const c = smoothstep(CANAL + 6, CANAL, dzc);
        h = lerp(h, SEA_LEVEL - 6, c);
        if (c > 0.5) biome = null;
      }
    }
    // Islands.
    col.isle = 0; col.kind = null;
    const at = this.islandAt(x, z);
    if (at && at.t > -0.6) {
      const { isle, t } = at, kind = isle.kind, [kt, kh] = KINDS[kind].climate;
      temp = kt; hum = kh;
      const land = this.landHeight(isle, x, z, t, at);
      // Out from the shore the sea floor shelves up to it.
      const shelf = smoothstep(-0.6, 0, t);
      const shore = SEA_LEVEL - 4 + t * 25;
      h = t > 0 ? Math.max(SEA_LEVEL + 0.5, land) : lerp(h, Math.min(shore, SEA_LEVEL - 1.5), shelf);
      if (t > 0) {
        col.isle = Math.min(1, t * 4);
        col.kind = kind;
        biome = this.islandBiome(isle, x, z, h, t);
        mount = kind === 'winter' || kind === 'wano' || kind === 'volcano' ? smoothstep(SEA_LEVEL + 30, SEA_LEVEL + 70, h) : 0;
      }
    }
    col.h = Math.min(h, gen.top - 14);
    col.opBiome = biome;
    col.c = 0; col.e = 0; col.mount = mount; col.pv = 0; col.v = 0; col.river = 0; col.swamp = biome === BIOME.SWAMP ? 1 : 0;
    col.bad = biome === BIOME.BADLANDS ? 1 : 0; col.rare = 0;
    col.temp = temp - Math.max(0, col.h - 110) * 0.008;
    col.hum = hum;
    return col.h;
  }

  // The land of an island, by its kind: `t` is 0 at the shore and 1 at the middle.
  landHeight(isle, x, z, t, at) {
    const s = isle.seed & 0xffff, hills = pnoise(x, z, 32, s) * 0.6 + pnoise(x, z, 16, s + 3) * 0.4;
    const base = SEA_LEVEL + 1 + smoothstep(0, 0.12, t) * 2; // (a beach, then up)
    const up = smoothstep(0.08, 1, t);
    switch (isle.kind) {
      case 'village': case 'spring': case 'autumn':
        return base + up * (isle.start ? 9 : 12) + hills * 4 * up;
      case 'summer': return base + up * 16 + hills * 6 * up;
      case 'marine': return base + up * 4 + hills * 1.5 * up;
      case 'plateau': {
        // Sheer cliffs all round, but for two ramps up from the beach.
        const ramp = Math.min(Math.abs(Math.sin((at.a - isle.angle) / 2)), Math.abs(Math.cos((at.a - isle.angle) / 2)));
        const cliff = ramp < 0.12 ? smoothstep(0.05, 0.55, t) : smoothstep(0.14, 0.2, t);
        return base + cliff * 24 + hills * 2 * up;
      }
      case 'desert': {
        // Dunes, and red-rock mesas standing out of them.
        const dune = Math.abs(pnoise(x, z, 24, s + 5)) * 5;
        const mesa = smoothstep(0.35, 0.45, pnoise(x, z, 48, s + 7)) * 22 * up;
        return base + up * 6 + dune * up + Math.floor(mesa / 6) * 6;
      }
      case 'winter': {
        // Snowy hills, and the drum-shaped peaks: sheer-sided round towers of rock (the tallest
        // with a castle on it, one day).
        let h = base + up * 10 + hills * 5 * up;
        for (const p of isle.peaks) {
          const d = Math.hypot(x - p.x, z - p.z) - pnoise(x, z, 8, s + 9) * 2;
          if (d < p.r + 4) h = Math.max(h, base + lerp(10, p.h, smoothstep(p.r + 4, p.r, d)));
        }
        return h;
      }
      case 'volcano': {
        // A great cone, a crater at its top.
        const cone = Math.pow(up, 1.4) * 95;
        const crater = smoothstep(0.86, 0.95, t) * 26;
        return base + cone - crater + hills * 4 * up;
      }
      case 'wano': {
        // Mountains, valleys, and a ring of cliffs at the shore (Wano's walls).
        const ridge = 1 - Math.abs(pnoise(x, z, 64, s + 11));
        const wall = smoothstep(0.04, 0.12, t) * smoothstep(0.32, 0.2, t) * 22;
        return base + up * 14 + Math.pow(ridge, 3) * 70 * up + wall;
      }
      case 'mangrove': return SEA_LEVEL + 0.2 + hills * 1.4 + up * 2;
      case 'thriller': return base + up * 8 + hills * 5 * up;
      case 'hazard': return base + up * 20 + hills * 8 * up;
      default: return base + up * 10;
    }
  }

  islandBiome(isle, x, z, h, t) {
    const beach = h < SEA_LEVEL + 3 && t < 0.15;
    const s = isle.seed & 0xffff, v = pnoise(x, z, 64, s + 13);
    switch (isle.kind) {
      case 'village': return beach ? BIOME.BEACH : v > 0.25 ? BIOME.FOREST : BIOME.PLAINS;
      case 'plateau': return beach ? BIOME.BEACH : v > 0 ? BIOME.FOREST : BIOME.MEADOW;
      case 'marine': return beach ? BIOME.BEACH : BIOME.PLAINS;
      case 'spring': return beach ? BIOME.BEACH : v > 0.2 ? BIOME.FLOWER_FOREST : v > -0.3 ? BIOME.MEADOW : BIOME.BIRCH_FOREST;
      case 'autumn': return beach ? BIOME.BEACH : v > 0 ? BIOME.TAIGA : BIOME.OLD_GROWTH_BIRCH;
      case 'summer': return beach ? BIOME.BEACH : v > 0.1 ? BIOME.SPARSE_JUNGLE : BIOME.SAVANNA;
      case 'winter': return beach ? BIOME.SNOWY_BEACH : h > SEA_LEVEL + 45 ? BIOME.SNOWY_SLOPES : v > 0 ? BIOME.SNOWY_TAIGA : BIOME.SNOWY_PLAINS;
      case 'desert': return h > SEA_LEVEL + 12 ? BIOME.BADLANDS : BIOME.DESERT;
      case 'volcano': return h > SEA_LEVEL + 70 ? BIOME.STONY_PEAKS : beach ? BIOME.BEACH : BIOME.JUNGLE;
      case 'mangrove': return BIOME.SWAMP;
      case 'thriller': return beach ? BIOME.BEACH : BIOME.DARK_FOREST;
      case 'wano': return beach ? BIOME.BEACH : h > SEA_LEVEL + 55 ? BIOME.STONY_PEAKS : v > 0 ? BIOME.CHERRY_GROVE : BIOME.MEADOW;
      case 'hazard': {
        // Split down the middle: one side burning, the other frozen.
        const side = (x - isle.x) * Math.cos(isle.angle) + (z - isle.z) * Math.sin(isle.angle);
        return side > 0 ? BIOME.BADLANDS : beach ? BIOME.SNOWY_BEACH : BIOME.SNOWY_PLAINS;
      }
      default: return BIOME.PLAINS;
    }
  }

  // The biome of a column `column` worked out: an island's, the Red Line's, or the sea's by its warmth.
  biome(col) {
    if (col.opBiome !== null && col.opBiome !== undefined && col.h >= SEA_LEVEL - 0.5) return col.opBiome;
    if (col.h >= SEA_LEVEL - 0.5) return BIOME.STONY_SHORE;
    const t = col.temp, deep = col.h < 44;
    if (t < -0.55) return deep ? BIOME.DEEP_FROZEN_OCEAN : BIOME.FROZEN_OCEAN;
    if (t < -0.2) return deep ? BIOME.DEEP_COLD_OCEAN : BIOME.COLD_OCEAN;
    if (t < 0.18) return deep ? BIOME.DEEP_OCEAN : BIOME.OCEAN;
    if (t < 0.4) return deep ? BIOME.DEEP_LUKEWARM_OCEAN : BIOME.LUKEWARM_OCEAN;
    return BIOME.WARM_OCEAN;
  }

  // Where everyone starts: on the first island's dry land, near its middle.
  spawn(gen) {
    const isle = this.island(START_CELL[0], START_CELL[1]);
    for (let r = 0; r < isle.r; r += 4) {
      for (let k = 0; k < 16; k++) {
        const a = (k / 16) * Math.PI * 2, x = Math.round(isle.x + Math.cos(a) * r), z = Math.round(isle.z + Math.sin(a) * r);
        const s = gen.sample(x, z);
        if (s.height > SEA_LEVEL + 1) return { x: x + 0.5, z: z + 0.5 };
      }
    }
    return { x: Math.round(isle.x) + 0.5, z: Math.round(isle.z) + 0.5 };
  }
}
