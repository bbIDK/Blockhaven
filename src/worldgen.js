// Terrain generation. Pure functions of (seed, chunk position), so it runs inside Web Workers.
import { CHUNK, HEIGHT, SEA_LEVEL, CHUNK_VOLUME } from './config.js';
import { Noise } from './noise.js';
import { B, REPLACEABLE, FACING_VARIANTS } from './blocks.js';
import { BIOME, toByte } from './biomes.js';
import { hash2, hash3, hashString, mulberry32, smoothstep, lerp } from './math.js';

const PAD = 4; // margin columns around a chunk (tree canopies and slope checks)
const GW = CHUNK + PAD * 2;

// Continentalness -> base height.
const CONT = [[-1, 24], [-0.55, 33], [-0.3, 43], [-0.17, 52], [-0.08, 57.5], [-0.02, 60.5], [0.06, 63],
  [0.25, 67], [0.5, 73], [1, 82]];
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

const LEAVES = new Set([B.oak_leaves, B.birch_leaves, B.spruce_leaves]);
const TREE_DENSITY = {
  [BIOME.PLAINS]: 0.0035, [BIOME.FOREST]: 0.045, [BIOME.BIRCH_FOREST]: 0.04, [BIOME.TAIGA]: 0.035,
  [BIOME.SNOWY_TAIGA]: 0.014, [BIOME.MOUNTAINS]: 0.006, [BIOME.DESERT]: 0.005,
};
const CAVE_T = 0.0105;

export class WorldGen {
  constructor(seed, type = 'default') {
    this.seed = seed >>> 0;
    this.type = type;
    const n = (k) => new Noise((this.seed ^ hashString(k)) >>> 0);
    this.nCont = n('continent'); this.nEros = n('erosion'); this.nPeaks = n('peaks'); this.nHills = n('hills');
    this.nWarp = n('warp'); this.nTemp = n('temperature'); this.nHum = n('humidity'); this.nRiver = n('river');
    this.nCaveA = n('caveA'); this.nCaveB = n('caveB'); this.nCheese = n('cheese'); this.nSurf = n('surface');
    this.col = { h: 0, temp: 0, hum: 0, c: 0, river: 0, mount: 0 };
  }

  // Terrain shape of one column: returns the fractional surface height and fills this.col.
  column(x, z) {
    const col = this.col;
    const wx = x + this.nWarp.noise2(x / 180, z / 180) * 28;
    const wz = z + this.nWarp.noise2(z / 180 + 31.7, x / 180 - 17.3) * 28;
    const c = this.nCont.fbm2(wx / 1200, wz / 1200, 4) * 1.35 + 0.2;
    const e = this.nEros.fbm2(wx / 650, wz / 650, 3) * 1.3;
    const ridge = 1 - Math.abs(this.nPeaks.fbm2(wx / 280, wz / 280, 4) * 1.25);
    let h = spline(CONT, c);
    const land = smoothstep(-0.1, 0.06, c);
    h += this.nHills.fbm2(x / 95, z / 95, 3) * lerp(3, 13, smoothstep(0.45, -0.45, e)) * land;
    const mount = smoothstep(0.1, 0.55, c) * smoothstep(0.1, -0.5, e);
    h += (Math.pow(Math.max(0, ridge), 2.4) * 58 + 6) * mount;
    // Rivers carve valleys through the land.
    const r = Math.abs(this.nRiver.fbm2(x / 560, z / 560, 3));
    let river = 0;
    if (land > 0) {
      const t = smoothstep(0.018, 0.075, r);
      const bed = SEA_LEVEL - 2.5 - (1 - smoothstep(0, 0.03, r)) * 3;
      const carved = Math.min(h, bed) * (1 - t) + h * t;
      river = (1 - t) * land;
      h = h * (1 - land) + carved * land;
    }
    col.h = Math.min(h, HEIGHT - 12);
    col.c = c; col.river = river; col.mount = mount;
    col.temp = this.nTemp.fbm2(x / 1500, z / 1500, 3) * 1.5 - Math.max(0, h - 88) * 0.015;
    col.hum = this.nHum.fbm2(x / 1200 + 91, z / 1200 - 47, 3) * 1.5;
    return col.h;
  }

  biome(h, col) {
    const { temp, hum, c, river, mount } = col;
    if (h < SEA_LEVEL) {
      if (temp < -0.5) return BIOME.FROZEN_OCEAN;
      return river > 0.5 ? BIOME.RIVER : BIOME.OCEAN;
    }
    if (h > 106 || (mount > 0.3 && h > 99)) return BIOME.SNOWY_PEAKS;
    if (mount > 0.4 && h > 82) return BIOME.MOUNTAINS;
    if (h < SEA_LEVEL + 2.5 && c < 0.12 && river < 0.3) return temp < -0.5 ? BIOME.SNOWY_TAIGA : BIOME.BEACH;
    if (temp > 0.5 && hum < 0.15) return BIOME.DESERT;
    if (temp < -0.5) return BIOME.SNOWY_TAIGA;
    if (temp < -0.2) return BIOME.TAIGA;
    if (hum > 0.35) return temp < 0.15 ? BIOME.BIRCH_FOREST : BIOME.FOREST;
    if (hum > 0) return BIOME.FOREST;
    return BIOME.PLAINS;
  }

  // Surface height (integer) and biome for a single world column. Used for spawning.
  sample(x, z) {
    const h = this.column(x, z);
    return { height: Math.floor(h), biome: this.biome(h, this.col) };
  }

  // A pleasant starting point: dry, fairly flat ground in a green biome near the origin.
  findSpawn() {
    if (this.type === 'flat') return { x: 0.5, z: 0.5 };
    const green = new Set([BIOME.PLAINS, BIOME.FOREST, BIOME.BIRCH_FOREST, BIOME.TAIGA]);
    const land = (b) => b !== BIOME.OCEAN && b !== BIOME.FROZEN_OCEAN && b !== BIOME.RIVER && b !== BIOME.SNOWY_PEAKS;
    let fallback = null;
    for (let r = 0; r < 4000; r += 12) {
      const steps = Math.max(1, Math.floor((r * Math.PI * 2) / 12));
      for (let i = 0; i < steps; i++) {
        const a = (i / steps) * Math.PI * 2;
        const x = Math.round(Math.cos(a) * r), z = Math.round(Math.sin(a) * r);
        const s = this.sample(x, z);
        if (s.height <= SEA_LEVEL + 1 || s.height >= 95 || !land(s.biome)) continue;
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

  generate(cx, cz) {
    const blocks = new Uint8Array(CHUNK_VOLUME);
    const climate = new Uint8Array(512);
    const biomes = new Uint8Array(256);
    if (this.type === 'flat') {
      for (let i = 0; i < 256; i++) {
        blocks[i] = B.bedrock; blocks[256 + i] = B.dirt; blocks[512 + i] = B.dirt; blocks[768 + i] = B.grass_block;
        climate[i * 2] = toByte(0.3); climate[i * 2 + 1] = toByte(0.1); biomes[i] = BIOME.FLAT;
      }
      return { blocks, climate, biomes };
    }

    const x0 = cx * CHUNK, z0 = cz * CHUNK, seed = this.seed;
    // 1. Column data with a margin so trees and slopes line up across chunk borders.
    const H = new Int16Array(GW * GW), BIO = new Uint8Array(GW * GW);
    const TEMP = new Float32Array(GW * GW), HUM = new Float32Array(GW * GW);
    for (let gz = 0; gz < GW; gz++) {
      for (let gx = 0; gx < GW; gx++) {
        const h = this.column(x0 + gx - PAD, z0 + gz - PAD);
        const i = gz * GW + gx;
        H[i] = Math.floor(h);
        BIO[i] = this.biome(h, this.col);
        TEMP[i] = this.col.temp;
        HUM[i] = this.col.hum;
      }
    }
    const slopeAt = (i) => Math.max(Math.abs(H[i + 1] - H[i]), Math.abs(H[i - 1] - H[i]),
      Math.abs(H[i + GW] - H[i]), Math.abs(H[i - GW] - H[i]));

    // 2. Stone, surface layers and bedrock.
    const tops = new Uint8Array(256);
    for (let z = 0; z < 16; z++) {
      for (let x = 0; x < 16; x++) {
        const gi = (z + PAD) * GW + x + PAD;
        const h = H[gi], biome = BIO[gi], wx = x0 + x, wz = z0 + z;
        const slope = slopeAt(gi);
        let top = B.grass_block, filler = B.dirt, depth = 3 + (hash2(wx, wz, seed ^ 0x5eed) < 0.5 ? 1 : 0);
        let deep = B.stone, deepDepth = 0;
        const n = this.nSurf.noise2(wx / 24, wz / 24);
        switch (biome) {
          case BIOME.DESERT: top = filler = B.sand; depth = 4; deep = B.sandstone; deepDepth = 3; break;
          case BIOME.BEACH: top = filler = B.sand; depth = 4; deep = B.sandstone; deepDepth = 2; break;
          case BIOME.OCEAN: case BIOME.FROZEN_OCEAN: case BIOME.RIVER:
            top = filler = h < SEA_LEVEL - 7 ? (n > 0.25 ? B.gravel : n < -0.45 ? B.clay : B.sand) : (n > 0.55 ? B.gravel : B.sand);
            if (top === B.clay) filler = B.clay;
            depth = 3;
            break;
          case BIOME.SNOWY_TAIGA: top = B.snowy_grass; break;
          case BIOME.SNOWY_PEAKS: top = slope >= 4 ? B.stone : B.snow_block; filler = B.stone; depth = 1; break;
          case BIOME.MOUNTAINS: if (slope >= 4) { top = filler = B.stone; } else if (h > 96) top = B.snowy_grass; break;
          default: if (slope >= 5) { top = B.stone; filler = B.stone; }
        }
        if (top === B.grass_block && h < SEA_LEVEL) top = B.dirt;
        tops[z * 16 + x] = top;
        const bedrockTop = 1 + Math.floor(hash2(wx, wz, seed ^ 0xbed) * 4);
        for (let y = 0; y <= h; y++) {
          let id;
          if (y === 0 || y < bedrockTop && hash3(wx, y, wz, seed) < 0.5) id = B.bedrock;
          else if (y === h) id = top;
          else if (y > h - depth) id = filler;
          else if (y > h - depth - deepDepth) id = deep;
          else id = B.stone;
          blocks[(y << 8) | (z << 4) | x] = id;
        }
        climate[(z * 16 + x) * 2] = toByte(TEMP[gi]);
        climate[(z * 16 + x) * 2 + 1] = toByte(HUM[gi]);
        biomes[z * 16 + x] = biome;
      }
    }

    // 3. Caves: two noise fields whose shared zero-crossings form tunnels, plus deep caverns.
    const GY = HEIGHT / 4 + 1;
    const SA = new Float32Array(25 * GY), SB = new Float32Array(25 * GY), SC = new Float32Array(25 * GY);
    for (let iz = 0; iz < 5; iz++) for (let ix = 0; ix < 5; ix++) {
      const sx = x0 + ix * 4, sz = z0 + iz * 4;
      for (let iy = 0; iy < GY; iy++) {
        const sy = iy * 4, k = (iz * 5 + ix) * GY + iy;
        if (sy > 118) { SA[k] = SB[k] = 1; SC[k] = -1; continue; }
        SA[k] = this.nCaveA.noise3(sx / 52, sy / 34, sz / 52);
        SB[k] = this.nCaveB.noise3(sx / 52, sy / 34, sz / 52 + 70);
        SC[k] = sy < 52 ? this.nCheese.noise3(sx / 90, sy / 44, sz / 90) : -1;
      }
    }
    const ca = new Float32Array(GY), cb = new Float32Array(GY), cc = new Float32Array(GY);
    for (let z = 0; z < 16; z++) {
      for (let x = 0; x < 16; x++) {
        const gi = (z + PAD) * GW + x + PAD, h = H[gi];
        let minN = h;
        for (const o of [1, -1, GW, -GW, GW + 1, GW - 1, -GW + 1, -GW - 1]) minN = Math.min(minN, H[gi + o]);
        let maxY = h;
        if (h <= SEA_LEVEL + 1 || minN < SEA_LEVEL) maxY = Math.min(h, minN) - 5;
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
            const i = (y << 8) | (z << 4) | x;
            if (blocks[i] !== B.bedrock) blocks[i] = y <= 10 ? B.lava : 0;
          }
        }
      }
    }

    // 4. Ore veins. Veins seeded in neighbouring chunks may reach into this one.
    const ORES = [
      [B.coal_ore, 18, 10, 8, 110], [B.iron_ore, 12, 7, 5, 64], [B.gold_ore, 3, 6, 5, 32],
      [B.diamond_ore, 1.3, 5, 5, 16], [B.gravel, 6, 18, 8, 100], [B.dirt, 7, 18, 20, 110],
    ];
    for (let ncz = cz - 1; ncz <= cz + 1; ncz++) {
      for (let ncx = cx - 1; ncx <= cx + 1; ncx++) {
        ORES.forEach(([ore, count, size, minY, maxY], oi) => {
          const rnd = mulberry32(Math.floor(hash3(ncx, oi, ncz, seed ^ 0x0e5) * 4294967296));
          const n = Math.floor(count) + (rnd() < count % 1 ? 1 : 0);
          for (let v = 0; v < n; v++) {
            let x = ncx * 16 + Math.floor(rnd() * 16) - x0;
            let y = minY + Math.floor(rnd() * (maxY - minY));
            let z = ncz * 16 + Math.floor(rnd() * 16) - z0;
            for (let s = 0; s < size; s++) {
              for (let k = 0; k < (size > 10 ? 3 : 1); k++) {
                const px = x + (k === 1 ? 1 : 0), py = y + (k === 2 ? 1 : 0);
                if (px >= 0 && px < 16 && z >= 0 && z < 16 && py > 0 && py < HEIGHT) {
                  const i = (py << 8) | (z << 4) | px;
                  if (blocks[i] === B.stone) blocks[i] = ore;
                }
              }
              const d = Math.floor(rnd() * 6);
              if (d === 0) x++; else if (d === 1) x--; else if (d === 2) y++; else if (d === 3) y--; else if (d === 4) z++; else z--;
            }
          }
        });
      }
    }

    // 5. Oceans, rivers and lakes.
    for (let z = 0; z < 16; z++) {
      for (let x = 0; x < 16; x++) {
        const gi = (z + PAD) * GW + x + PAD, h = H[gi];
        const frozen = TEMP[gi] < -0.5;
        for (let y = h + 1; y <= SEA_LEVEL; y++) {
          const i = (y << 8) | (z << 4) | x;
          if (blocks[i] === 0) blocks[i] = frozen && y === SEA_LEVEL ? B.ice : B.water;
        }
      }
    }

    // 6. Ground cover: grass, flowers, cane, cacti bushes and cave mushrooms.
    for (let z = 0; z < 16; z++) {
      for (let x = 0; x < 16; x++) {
        const gi = (z + PAD) * GW + x + PAD, h = H[gi], biome = BIO[gi];
        const wx = x0 + x, wz = z0 + z;
        if (h + 1 < HEIGHT) {
          const ground = blocks[(h << 8) | (z << 4) | x], above = (h + 1) << 8 | (z << 4) | x;
          if (blocks[above] === 0) {
            const r = hash2(wx, wz, seed ^ 0x9a55);
            if (ground === B.grass_block) {
              const patch = this.nSurf.noise2(wx / 36 + 11, wz / 36 - 5) > 0.35;
              const flowerP = biome === BIOME.PLAINS ? (patch ? 0.12 : 0.02) : patch ? 0.05 : 0.006;
              const grassP = biome === BIOME.PLAINS ? 0.3 : biome === BIOME.MOUNTAINS ? 0.1 : 0.16;
              if (r < flowerP) {
                const f = hash2(wx, wz, seed ^ 0xf10);
                blocks[above] = biome === BIOME.TAIGA ? B.cornflower : f < 0.45 ? B.dandelion : f < 0.85 ? B.poppy : B.cornflower;
              } else if (r < flowerP + grassP) blocks[above] = B.tall_grass;
              else if (r > 0.9993 && biome !== BIOME.MOUNTAINS) {
                const v = FACING_VARIANTS[B.pumpkin];
                blocks[above] = [v[4], v[5], v[0], v[1]][Math.floor(hash2(wz, wx, seed) * 4)];
              } else if (r > 0.996 && (biome === BIOME.FOREST || biome === BIOME.TAIGA)) {
                blocks[above] = r > 0.998 ? B.red_mushroom : B.brown_mushroom;
              }
            } else if (ground === B.sand && biome === BIOME.DESERT && r < 0.01) blocks[above] = B.dead_bush;
            else if (ground === B.snowy_grass && r < 0.04) blocks[above] = B.tall_grass;
            if ((ground === B.grass_block || ground === B.sand) && h === SEA_LEVEL && blocks[above] === 0 && r > 0.8) {
              let wet = false;
              for (const o of [1, -1, GW, -GW]) if (H[gi + o] < SEA_LEVEL && TEMP[gi + o] >= -0.5) wet = true;
              if (wet) {
                const tall = 1 + Math.floor(hash2(wz, wx, seed ^ 0xca9e) * 3);
                for (let k = 0; k < tall && h + 1 + k < HEIGHT; k++) blocks[(h + 1 + k) << 8 | (z << 4) | x] = B.sugar_cane;
              }
            }
          }
        }
        // Mushrooms on cave floors.
        for (let y = 12; y < h - 8; y++) {
          const i = (y << 8) | (z << 4) | x;
          if (blocks[i] === 0 && blocks[i - 256] === B.stone && hash3(wx, y, wz, seed ^ 0x3c) < 0.006) {
            blocks[i] = hash3(wz, y, wx, seed) < 0.5 ? B.brown_mushroom : B.red_mushroom;
          }
        }
      }
    }

    // 7. Trees, including those rooted in the margin whose canopies overlap this chunk.
    const put = (wx, y, wz, id, log) => {
      const x = wx - x0, z = wz - z0;
      if (x < 0 || x > 15 || z < 0 || z > 15 || y < 1 || y >= HEIGHT) return;
      const i = (y << 8) | (z << 4) | x, cur = blocks[i];
      if (cur === 0 || (REPLACEABLE[cur] && cur !== B.water && cur !== B.lava) || cur === B.tall_grass || (log && LEAVES.has(cur))) {
        blocks[i] = id;
      }
    };
    for (let gz = 1; gz < GW - 1; gz++) {
      for (let gx = 1; gx < GW - 1; gx++) {
        const gi = gz * GW + gx, biome = BIO[gi];
        const density = TREE_DENSITY[biome];
        if (!density) continue;
        const wx = x0 + gx - PAD, wz = z0 + gz - PAD;
        if (hash2(wx, wz, seed ^ 0x7ee) >= density) continue;
        const h = H[gi];
        if (h <= SEA_LEVEL || h > HEIGHT - 16 || slopeAt(gi) >= (biome === BIOME.MOUNTAINS ? 4 : 3)) continue;
        if (biome === BIOME.BEACH) continue;
        if (this.caveAt(wx, h, wz)) continue;
        const rnd = mulberry32(Math.floor(hash2(wx, wz, seed ^ 0x1ee7) * 4294967296));
        if (biome === BIOME.DESERT) {
          const tall = 1 + Math.floor(rnd() * 3);
          for (let k = 0; k < tall; k++) put(wx, h + 1 + k, wz, B.cactus, true);
          continue;
        }
        if (biome === BIOME.TAIGA || biome === BIOME.SNOWY_TAIGA || biome === BIOME.MOUNTAINS) spruce(put, wx, h + 1, wz, rnd);
        else if (biome === BIOME.BIRCH_FOREST || (biome === BIOME.FOREST && rnd() < 0.2)) oak(put, wx, h + 1, wz, rnd, B.birch_log, B.birch_leaves, 5);
        else oak(put, wx, h + 1, wz, rnd, B.oak_log, B.oak_leaves, 4);
      }
    }
    return { blocks, climate, biomes };
  }
}

function oak(put, x, y, z, rnd, log, leaves, minH) {
  const h = minH + Math.floor(rnd() * 3);
  for (let ly = y + h - 3; ly <= y + h; ly++) {
    const r = ly >= y + h - 1 ? 1 : 2;
    for (let dz = -r; dz <= r; dz++) for (let dx = -r; dx <= r; dx++) {
      if (Math.abs(dx) === r && Math.abs(dz) === r && (ly === y + h || rnd() < 0.55)) continue;
      put(x + dx, ly, z + dz, leaves, false);
    }
  }
  for (let i = 0; i < h; i++) put(x, y + i, z, log, true);
}

const SPRUCE_LAYERS = [0, 1, 1, 2, 1, 2, 1, 2, 3, 2, 3, 2];
function spruce(put, x, y, z, rnd) {
  const h = 6 + Math.floor(rnd() * 4);
  const bare = 1 + Math.floor(rnd() * 2);
  for (let i = 0, ly = y + h; ly >= y + bare; ly--, i++) {
    const r = SPRUCE_LAYERS[Math.min(i, SPRUCE_LAYERS.length - 1)];
    for (let dz = -r; dz <= r; dz++) for (let dx = -r; dx <= r; dx++) {
      if (r > 0 && Math.abs(dx) === r && Math.abs(dz) === r) continue;
      put(x + dx, ly, z + dz, B.spruce_leaves, false);
    }
  }
  put(x, y + h + 1, z, B.spruce_leaves, false);
  for (let i = 0; i < h; i++) put(x, y + i, z, B.spruce_log, true);
}
