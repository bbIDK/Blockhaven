// The Nether (see config.js for where it lies): a sea of lava under a bedrock roof, hollowed into
// great caverns by three-dimensional noise, in five biomes: the red wastes, the crimson and warped
// forests of giant fungi, the soul sand valleys and the basalt deltas. Like the overworld's
// generator it is a pure function of the seed and the chunk, so neighbouring chunks agree: the
// ground is worked out for a margin round the chunk as well, and whatever grows across a chunk's
// edge (glowstone, fungi, pillars) is grown whole from where it starts and cut to the chunk.
import { CHUNK_VOLUME, NETHER_TOP, NETHER_CX } from './config.js';
import { Noise } from './noise.js';
import { B } from './blocks.js';
import { BIOME, toByte } from './biomes.js';
import { hash2, hash3, hashString, mulberry32, smoothstep } from './math.js';

export const LAVA_SEA = 31;
const TOP = NETHER_TOP;          // the roof's last layer is TOP - 1
const M = 8;                     // columns worked out on each side of the chunk
const W = 16 + M * 2;
const LX = 4, LY = 8;            // spacing of the noise lattice
const NLX = W / LX + 1, NLY = TOP / LY + 1;

// Where each biome sits in (heat, wet), as Minecraft places them, and how much rarer it is.
const BIOME_POINTS = [
  [BIOME.NETHER_WASTES, 0, 0, 0],
  [BIOME.SOUL_SAND_VALLEY, 0, -0.5, 0],
  [BIOME.CRIMSON_FOREST, 0.4, 0, 0],
  [BIOME.WARPED_FOREST, 0, 0.5, 0.375],
  [BIOME.BASALT_DELTAS, -0.5, 0, 0.175],
];

// Ore veins and blobs: [block, veins per chunk, size, lowest y, highest y]. They replace netherrack.
const ORES = [
  ['nether_quartz_ore', 14, 12, 10, 117],
  ['nether_gold_ore', 9, 8, 10, 117],
  ['magma_block', 3, 22, 26, 36],
  ['gravel', 2, 24, 5, 41],
  ['blackstone', 2, 22, 5, 31],
  ['soul_sand', 1, 16, 5, 60],
].map(([b, ...r]) => [B[b], ...r]);

// Bedrock at the floor and the roof: solid at the very edge, thinning over four layers.
const bedrockOdds = (y) => (y <= 0 || y >= TOP - 1 ? 1 : y < 5 ? (5 - y) / 5 : y > TOP - 6 ? (y - (TOP - 6)) / 5 : 0);

export class NetherGen {
  constructor(seed) {
    this.seed = seed >>> 0;
    const n = (k) => new Noise((this.seed ^ hashString(k)) >>> 0);
    this.nShape = n('nether-shape'); this.nDetail = n('nether-detail'); this.nHeat = n('nether-heat'); this.nWet = n('nether-wet');
    this.nWarp = n('nether-warp'); this.nSurf = n('nether-surface'); this.nPatch = n('nether-patch');
    this.D = new Float32Array(W * W * TOP); // terrain density round the chunk: above 0 is rock
    this.L = new Float32Array(NLX * NLX * NLY);
    this.BIO = new Uint8Array(W * W);
    this.HEAT = new Float32Array(W * W);
    this.WET = new Float32Array(W * W);
    this.cache = new Map();
  }

  // The biome of a column (and its heat and wetness in this.heat, this.wet).
  biome(x, z) {
    const wx = x + this.nWarp.noise2(x / 48, z / 48) * 9, wz = z + this.nWarp.noise2(z / 48 + 40, x / 48 - 20) * 9;
    const h = this.nHeat.fbm2(wx / 170, wz / 170, 3) * 1.2, w = this.nWet.fbm2(wx / 170 + 50, wz / 170 - 30, 3) * 1.2;
    this.heat = h; this.wet = w;
    let best = BIOME.NETHER_WASTES, bd = Infinity;
    for (const [b, bh, bw, off] of BIOME_POINTS) {
      const d = (h - bh) ** 2 + (w - bw) ** 2 + off * off;
      if (d < bd) { bd = d; best = b; }
    }
    return best;
  }

  // Density at a lattice point: big caverns, rougher walls, closing up at the floor and the roof.
  latticeAt(x, y, z) {
    const shape = this.nShape.fbm3(x / 96, y / 52, z / 96, 3) + this.nDetail.fbm3(x / 24, y / 18, z / 24, 2) * 0.28;
    return shape + smoothstep(26, 4, y) * 1.4 + smoothstep(96, 124, y) * 1.5 + 0.03;
  }

  // Works out the density and biomes for the chunk and its margin.
  prepare(x0, z0) {
    const L = this.L, D = this.D;
    this.cache.clear();
    for (let iz = 0; iz < NLX; iz++) for (let ix = 0; ix < NLX; ix++) {
      const x = x0 - M + ix * LX, z = z0 - M + iz * LX;
      for (let iy = 0; iy < NLY; iy++) L[(iz * NLX + ix) * NLY + iy] = this.latticeAt(x, iy * LY, z);
    }
    for (let z = 0; z < W; z++) {
      const iz = Math.min(NLX - 2, (z / LX) | 0), tz = (z - iz * LX) / LX;
      for (let x = 0; x < W; x++) {
        const ix = Math.min(NLX - 2, (x / LX) | 0), tx = (x - ix * LX) / LX;
        const a = (iz * NLX + ix) * NLY, b = a + NLY, c = a + NLX * NLY, d = c + NLY;
        const w00 = (1 - tx) * (1 - tz), w10 = tx * (1 - tz), w01 = (1 - tx) * tz, w11 = tx * tz;
        const o = (z * W + x) * TOP;
        for (let iy = 0; iy < NLY - 1; iy++) {
          const v0 = L[a + iy] * w00 + L[b + iy] * w10 + L[c + iy] * w01 + L[d + iy] * w11;
          const v1 = L[a + iy + 1] * w00 + L[b + iy + 1] * w10 + L[c + iy + 1] * w01 + L[d + iy + 1] * w11;
          for (let k = 0; k < LY; k++) D[o + iy * LY + k] = v0 + (v1 - v0) * (k / LY);
        }
        const i = z * W + x;
        this.BIO[i] = this.biome(x0 - M + x, z0 - M + z);
        this.HEAT[i] = this.heat; this.WET[i] = this.wet;
      }
    }
  }

  // The density anywhere, for the odd feature that reaches past the margin: the same lattice and
  // the same sums as prepare's (so the answer is the same to the last bit), looked up afresh.
  densityAt(x, y, z) {
    const ix = Math.floor(x / LX), iy = Math.min(NLY - 2, Math.floor(y / LY)), iz = Math.floor(z / LX);
    const tx = (x - ix * LX) / LX, tz = (z - iz * LX) / LX, k = y - iy * LY;
    const at = (a, b, c) => {
      const key = ((ix + a) * 65536 + (iz + c)) * 32 + iy + b;
      let v = this.cache.get(key);
      if (v === undefined) { v = Math.fround(this.latticeAt((ix + a) * LX, (iy + b) * LY, (iz + c) * LX)); this.cache.set(key, v); }
      return v;
    };
    const w00 = (1 - tx) * (1 - tz), w10 = tx * (1 - tz), w01 = (1 - tx) * tz, w11 = tx * tz;
    const v0 = at(0, 0, 0) * w00 + at(1, 0, 0) * w10 + at(0, 0, 1) * w01 + at(1, 0, 1) * w11;
    const v1 = at(0, 1, 0) * w00 + at(1, 1, 0) * w10 + at(0, 1, 1) * w01 + at(1, 1, 1) * w11;
    return Math.fround(v0 + (v1 - v0) * (k / LY));
  }

  // Terrain only (rock, lava, air) at a world position: 1 rock, 2 lava, 0 air.
  terrain(x0, z0, x, y, z) {
    if (y <= 0 || y >= TOP - 1) return 1;
    const lx = x - x0 + M, lz = z - z0 + M;
    const d = lx < 0 || lz < 0 || lx >= W || lz >= W ? this.densityAt(x, y, z) : this.D[(lz * W + lx) * TOP + y];
    if (d > 0) return 1;
    return y <= LAVA_SEA ? 2 : 0;
  }
  biomeIn(x0, z0, x, z) {
    const lx = x - x0 + M, lz = z - z0 + M;
    return lx < 0 || lz < 0 || lx >= W || lz >= W ? this.biome(x, z) : this.BIO[lz * W + lx];
  }

  generate(cx, cz) {
    const blocks = new Uint16Array(CHUNK_VOLUME), climate = new Uint8Array(512), biomes = new Uint8Array(256);
    const x0 = cx * 16, z0 = cz * 16, seed = this.seed;
    const idx = (x, y, z) => (y << 8) | (z << 4) | x;
    this.prepare(x0, z0);
    const D = this.D;
    // Writes a block if it lands in this chunk (features grown from outside it are cut to it).
    const set = (wx, y, wz, id) => {
      const x = wx - x0, z = wz - z0;
      if (x >= 0 && x < 16 && z >= 0 && z < 16 && y > 0 && y < TOP - 1) blocks[idx(x, y, z)] = id;
    };
    const get = (wx, y, wz) => {
      const x = wx - x0, z = wz - z0;
      return x >= 0 && x < 16 && z >= 0 && z < 16 && y >= 0 && y < TOP ? blocks[idx(x, y, z)] : -1;
    };
    const air = (wx, y, wz) => this.terrain(x0, z0, wx, y, wz) === 0;
    const rock = (wx, y, wz) => this.terrain(x0, z0, wx, y, wz) === 1;

    // 1. Rock, the lava sea and bedrock.
    for (let z = 0; z < 16; z++) for (let x = 0; x < 16; x++) {
      const wx = x0 + x, wz = z0 + z, o = ((z + M) * W + x + M) * TOP;
      for (let y = 0; y < TOP; y++) {
        const odds = bedrockOdds(y);
        let id;
        if (odds && (odds >= 1 || hash3(wx, y, wz, seed ^ 0xbed) < odds)) id = B.bedrock;
        else if (D[o + y] > 0) id = B.netherrack;
        else id = y <= LAVA_SEA ? B.lava : 0;
        blocks[idx(x, y, z)] = id;
      }
      // (The Nether's west edge, where the overworld's ground would begin: a wall of bedrock.)
      if (cx === NETHER_CX && x === 0) for (let y = 0; y < TOP; y++) blocks[idx(x, y, z)] = B.bedrock;
      const i = (z + M) * W + x + M;
      biomes[z * 16 + x] = this.BIO[i];
      climate[(z * 16 + x) * 2] = toByte(Math.max(-1, Math.min(1, this.HEAT[i])));
      climate[(z * 16 + x) * 2 + 1] = toByte(Math.max(-1, Math.min(1, this.WET[i])));
    }

    // 2. Ores and blobs, from veins seeded in this chunk and its neighbours.
    for (let ncz = cz - 1; ncz <= cz + 1; ncz++) for (let ncx = cx - 1; ncx <= cx + 1; ncx++) {
      ORES.forEach(([ore, count, size, minY, maxY], oi) => {
        const rnd = mulberry32(Math.floor(hash3(ncx, oi, ncz, seed ^ 0x3e7e) * 4294967296));
        for (let v = 0; v < count; v++) {
          let x = ncx * 16 + Math.floor(rnd() * 16), y = minY + Math.floor(rnd() * (maxY - minY)), z = ncz * 16 + Math.floor(rnd() * 16);
          for (let s = 0; s < size; s++) {
            for (let k = 0; k < (size > 10 ? 3 : 1); k++) {
              const px = x + (k === 1 ? 1 : 0), py = y + (k === 2 ? 1 : 0);
              if (get(px, py, z) === B.netherrack) set(px, py, z, ore);
            }
            const d = Math.floor(rnd() * 6);
            if (d === 0) x++; else if (d === 1) x--; else if (d === 2) y++; else if (d === 3) y--; else if (d === 4) z++; else z--;
          }
        }
      });
    }
    // Pockets of lava sealed in the rock, waiting for a pickaxe.
    {
      const rnd = mulberry32(Math.floor(hash2(cx, cz, seed ^ 0x1a7a) * 4294967296));
      for (let k = 0; k < 8; k++) {
        const x = x0 + Math.floor(rnd() * 16), y = 10 + Math.floor(rnd() * 108), z = z0 + Math.floor(rnd() * 16);
        if (get(x, y, z) === B.netherrack && [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]].every(([a, b, c]) => rock(x + a, y + b, z + c))) set(x, y, z, B.lava);
      }
    }

    // 3. Surfaces: what each biome's floors (and in the deltas, ceilings) are made of.
    for (let z = 0; z < 16; z++) for (let x = 0; x < 16; x++) {
      const wx = x0 + x, wz = z0 + z, biome = biomes[z * 16 + x];
      const n = this.nSurf.noise2(wx / 12, wz / 12), patch = this.nPatch.noise2(wx / 20, wz / 20);
      for (let y = TOP - 3; y > 1; y--) {
        const i = idx(x, y, z), id = blocks[i];
        if (id !== B.netherrack) continue;
        const above = blocks[i + 256], below = blocks[i - 256];
        if (above === 0) {
          // A floor.
          switch (biome) {
            case BIOME.CRIMSON_FOREST: blocks[i] = B.crimson_nylium; break;
            case BIOME.WARPED_FOREST: blocks[i] = B.warped_nylium; break;
            case BIOME.SOUL_SAND_VALLEY: {
              const soil = n + hash3(wx, y, wz, seed ^ 0x5011) * 0.3 < 0.05;
              for (let k = 0; k < 3; k++) if (blocks[i - k * 256] === B.netherrack) blocks[i - k * 256] = soil ? B.soul_soil : B.soul_sand;
              break;
            }
            case BIOME.BASALT_DELTAS: {
              const black = n < -0.25;
              for (let k = 0; k < 2; k++) if (blocks[i - k * 256] === B.netherrack) blocks[i - k * 256] = black ? B.blackstone : B.basalt;
              break;
            }
            default:
              // Beaches of soul sand and gravel along the lava sea.
              if (y >= LAVA_SEA - 1 && y <= LAVA_SEA + 3 && Math.abs(patch) > 0.3) {
                for (let k = 0; k < 3; k++) if (blocks[i - k * 256] === B.netherrack) blocks[i - k * 256] = patch > 0 ? B.soul_sand : B.gravel;
              }
          }
        } else if (below === 0 && biome === BIOME.BASALT_DELTAS) blocks[i] = n < -0.25 ? B.blackstone : B.basalt;
      }
    }

    // 4. Glowstone hanging from the roofs of the caverns.
    for (let ncz = cz - 1; ncz <= cz + 1; ncz++) for (let ncx = cx - 1; ncx <= cx + 1; ncx++) {
      for (let k = 0; k < 3; k++) {
        const rnd = mulberry32(Math.floor(hash3(ncx, k, ncz, seed ^ 0x6105) * 4294967296));
        const go = rnd() < 0.7, x = ncx * 16 + Math.floor(rnd() * 16), z = ncz * 16 + Math.floor(rnd() * 16), start = 60 + Math.floor(rnd() * 60);
        // (A cluster reaches seven blocks from where it starts.)
        if (!go || x < x0 - 7 || x > x0 + 22 || z < z0 - 7 || z > z0 + 22) continue;
        // The first ceiling below the starting height.
        let y = -1;
        for (let yy = start; yy > LAVA_SEA + 4; yy--) if (air(x, yy, z) && rock(x, yy + 1, z)) { y = yy; break; }
        if (y < 0) continue;
        this.glowstone(rnd, x, y, z, set, air);
      }
    }

    // 5. What grows on the floors: fungi and roots in the forests (and giant fungi rooted in or
    // near this chunk), mushrooms and fire in the wastes, pillars of basalt in the valleys and
    // deltas, and the deltas' pools of lava.
    for (let wz = z0 - 3; wz < z0 + 19; wz++) for (let wx = x0 - 3; wx < x0 + 19; wx++) {
      const biome = this.biomeIn(x0, z0, wx, wz);
      const inside = wx >= x0 && wx < x0 + 16 && wz >= z0 && wz < z0 + 16;
      const forest = biome === BIOME.CRIMSON_FOREST || biome === BIOME.WARPED_FOREST;
      if (!forest && !inside) continue;
      for (let y = TOP - 4; y > LAVA_SEA; y--) {
        if (!(rock(wx, y, wz) && air(wx, y + 1, wz))) continue;
        const r = hash3(wx, y, wz, seed ^ 0xf1f1);
        if (forest) {
          const crimson = biome === BIOME.CRIMSON_FOREST;
          if (r < 0.03) { this.fungus(mulberry32(Math.floor(hash3(wx, y, wz, seed ^ 0xf00d) * 4294967296)), wx, y + 1, wz, crimson, set, air); continue; }
          if (!inside || get(wx, y + 1, wz) !== 0) continue;
          if (r < 0.2) set(wx, y + 1, wz, crimson ? B.crimson_roots : B.warped_roots);
          else if (r < 0.24) set(wx, y + 1, wz, crimson ? B.crimson_fungus : B.warped_fungus);
          continue;
        }
        if (get(wx, y + 1, wz) !== 0) continue;
        const ground = get(wx, y, wz);
        if (biome === BIOME.NETHER_WASTES) {
          if (r < 0.006 && ground === B.netherrack) set(wx, y + 1, wz, B.fire);
          else if (r < 0.012) set(wx, y + 1, wz, r < 0.009 ? B.red_mushroom : B.brown_mushroom);
        } else if (biome === BIOME.SOUL_SAND_VALLEY) {
          if (r < 0.004) this.pillar(wx, y + 1, wz, set, air);
          else if (r < 0.006 && ground === B.soul_soil) set(wx, y + 1, wz, B.fire);
        } else if (biome === BIOME.BASALT_DELTAS) {
          const pool = this.nPatch.noise2(wx / 7 + 100, wz / 7);
          if (pool > 0.42) {
            // A pool, if the ground holds it on every side; else its rim of magma.
            const held = [[1, 0], [-1, 0], [0, 1], [0, -1]].every(([a, b]) => rock(wx + a, y, wz + b)) && rock(wx, y - 1, wz);
            set(wx, y, wz, held && pool > 0.5 ? B.lava : B.magma_block);
          } else if (this.nSurf.noise2(wx / 5 + 30, wz / 5) > 0.3 && r < 0.6) {
            const tall = 1 + Math.floor(hash3(wx, y, wz, seed ^ 0xba5) * 5);
            for (let k = 1; k <= tall && air(wx, y + k, wz); k++) set(wx, y + k, wz, B.basalt);
          } else if (r < 0.004) this.pillar(wx, y + 1, wz, set, air);
        }
      }
      // Basalt hanging from the deltas' ceilings.
      if (inside && biome === BIOME.BASALT_DELTAS) {
        for (let y = LAVA_SEA + 6; y < TOP - 4; y++) {
          if (!(air(wx, y, wz) && rock(wx, y + 1, wz)) || this.nSurf.noise2(wx / 5 - 30, wz / 5) < 0.35) continue;
          const tall = 1 + Math.floor(hash3(wx, y, wz, seed ^ 0xcb5) * 4);
          for (let k = 0; k < tall && air(wx, y - k, wz); k++) set(wx, y - k, wz, B.basalt);
        }
      }
    }
    // Fossils: the bones of something huge, half buried in the soul sand valleys.
    {
      const rnd = mulberry32(Math.floor(hash2(Math.floor(cx / 3), Math.floor(cz / 3), seed ^ 0xf055) * 4294967296));
      if (rnd() < 0.5) {
        const fx = Math.floor(cx / 3) * 48 + 8 + Math.floor(rnd() * 32), fz = Math.floor(cz / 3) * 48 + 8 + Math.floor(rnd() * 32);
        if (Math.abs(fx - (x0 + 8)) < 24 && Math.abs(fz - (z0 + 8)) < 24 && this.biome(fx, fz) === BIOME.SOUL_SAND_VALLEY) {
          let fy = -1;
          for (let y = 90; y > LAVA_SEA; y--) if (rock(fx, y, fz) && air(fx, y + 1, fz)) { fy = y; break; }
          if (fy > 0) this.fossil(rnd, fx, fy, fz, set);
        }
      }
    }
    return { blocks, climate, biomes };
  }

  // A cluster of glowstone growing down from a ceiling at (x, y, z): Minecraft's way, each new
  // piece touching exactly one already there, so it hangs in crystal strands.
  glowstone(rnd, x, y, z, set, air) {
    const S = 15, G = new Uint8Array(12 * S * S);
    const at = (dx, dy, dz) => (dx < -7 || dx > 7 || dz < -7 || dz > 7 || dy > 0 || dy < -11 ? 0 : G[((-dy) * S + dz + 7) * S + dx + 7]);
    const put = (dx, dy, dz) => { G[((-dy) * S + dz + 7) * S + dx + 7] = 1; set(x + dx, y + dy, z + dz, B.glowstone); };
    put(0, 0, 0);
    for (let k = 0; k < 1500; k++) {
      const dx = Math.floor(rnd() * 8) - Math.floor(rnd() * 8), dy = -Math.floor(rnd() * 12), dz = Math.floor(rnd() * 8) - Math.floor(rnd() * 8);
      if (at(dx, dy, dz) || !air(x + dx, y + dy, z + dz)) continue;
      const n = at(dx + 1, dy, dz) + at(dx - 1, dy, dz) + at(dx, dy + 1, dz) + at(dx, dy - 1, dz) + at(dx, dy, dz + 1) + at(dx, dy, dz - 1);
      if (n === 1 || (dy === 0 && n === 0 && !air(x + dx, y + 1, z + dz) && rnd() < 0.02)) put(dx, dy, dz);
    }
  }

  // A giant fungus: a stem four to thirteen high under a cap of wart, lit by shroomlights.
  fungus(rnd, x, y, z, crimson, set, air) {
    let h = 4 + Math.floor(rnd() * 10);
    let room = 0;
    while (room < h + 3 && air(x, y + room, z)) room++;
    if (room < 7) return;
    h = Math.min(h, room - 3);
    const stem = crimson ? B.crimson_stem : B.warped_stem, wart = crimson ? B.nether_wart_block : B.warped_wart_block;
    const top = y + h - 1;
    // The cap: a dome on top, then a skirt, wider on tall fungi, hollow under the dome.
    const skirt = Math.max(2, Math.floor(h / 3)), wide = h >= 8 ? 3 : 2;
    for (let dy = 1; dy >= -skirt; dy--) {
      const r = dy === 1 ? 1 : dy === 0 ? 2 : wide;
      for (let dz = -r; dz <= r; dz++) for (let dx = -r; dx <= r; dx++) {
        const edge = Math.abs(dx) === r || Math.abs(dz) === r, corner = Math.abs(dx) === r && Math.abs(dz) === r;
        if (corner && (r > 1 || rnd() < 0.5)) continue;
        const px = x + dx, py = top + dy, pz = z + dz;
        if (!air(px, py, pz)) continue;
        if (dy >= 0 || edge) {
          // The skirt frays at its bottom edge.
          if (dy === -skirt && rnd() < 0.3) continue;
          set(px, py, pz, rnd() < 0.06 && dy <= 0 ? B.shroomlight : wart);
        } else if (rnd() < 0.08 && (dx || dz)) set(px, py, pz, B.shroomlight);
      }
    }
    for (let k = 0; k < h; k++) set(x, y + k, z, stem);
  }

  // A pillar of basalt from the floor at (x, y, z) up to the ceiling, if the ceiling is near.
  pillar(x, y, z, set, air) {
    let h = 0;
    while (h < 30 && air(x, y + h, z)) h++;
    if (h >= 30) return;
    for (let k = 0; k < h; k++) set(x, y + k, z, B.basalt);
  }

  // Bones: a spine along x or z with ribs arching over it, lying on the floor at (x, y, z).
  fossil(rnd, x, y, z, set) {
    const alongX = rnd() < 0.5, len = 7 + Math.floor(rnd() * 6), sink = Math.floor(rnd() * 2);
    const at = (a, up, side) => (alongX ? [x + a, y + up, z + side] : [x + side, y + up, z + a]);
    for (let a = 0; a < len; a++) {
      set(...at(a, 1 - sink, 0), B.bone_block);
      if (a % 2 === 1 && a > 0 && a < len - 2) {
        const r = a < len / 2 ? 3 : 2;
        for (let s = -r; s <= r; s++) {
          const up = Math.round(Math.sqrt(Math.max(0, r * r - s * s)) * 1.2) + 1 - sink;
          if (s) set(...at(a, up, s), B.bone_block);
        }
      }
    }
    // The skull at the front end.
    for (let dy = 0; dy < 2; dy++) for (let s = -1; s <= 1; s++) for (let a = len; a < len + 2; a++) if (!(dy && s && a === len + 1)) set(...at(a, 1 - sink + dy, s), B.bone_block);
  }
}
