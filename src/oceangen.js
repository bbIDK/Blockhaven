// The seas of worlds made since the ocean update (generator 6): what each kind of sea has on its
// floor. Warm seas grow coral reefs: coral trees, mushrooms and claws of coral block, topped with
// coral, coral fans and glowing sea pickles, with loose coral on the sand between; temperate and
// cold seas have kelp forests reaching up towards the surface; seagrass grows in meadows almost
// everywhere. Like the rest of the terrain it's all a pure function of the seed and position.
import { SEA_LEVEL } from './config.js';
import { Noise } from './noise.js';
import { B, CORALS } from './blocks.js';
import { BIOME } from './biomes.js';
import { hash2, hashString, mulberry32 } from './math.js';

const idx = (x, y, z) => (y << 8) | (z << 4) | x;
const WARM = new Set([BIOME.WARM_OCEAN]);
const LUKEWARM = new Set([BIOME.LUKEWARM_OCEAN, BIOME.DEEP_LUKEWARM_OCEAN]);
const KELPY = new Set([BIOME.OCEAN, BIOME.DEEP_OCEAN, BIOME.COLD_OCEAN, BIOME.DEEP_COLD_OCEAN]);
const FROZEN = new Set([BIOME.FROZEN_OCEAN, BIOME.DEEP_FROZEN_OCEAN, BIOME.FROZEN_RIVER]);
const SEA_FLOOR = new Set([B.sand, B.gravel, B.clay, B.dirt, B.red_sand]);
const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]], DIAGS = [[1, 1], [1, -1], [-1, 1], [-1, -1]];

export class SeaGen {
  constructor(seed) {
    this.seed = seed >>> 0;
    const n = (k) => new Noise((this.seed ^ hashString(k)) >>> 0);
    this.nReef = n('reefs'); this.nKelp = n('kelpForests'); this.nMeadow = n('seagrass');
  }

  // The sea floor of each kind of sea (`n`: the surface noise there, `top`: the floor's height).
  floorFor(biome, n, top) {
    const deep = top < SEA_LEVEL - 7;
    if (WARM.has(biome) || LUKEWARM.has(biome)) return n > 0.62 && deep ? B.gravel : B.sand;
    if (FROZEN.has(biome) || biome === BIOME.COLD_OCEAN || biome === BIOME.DEEP_COLD_OCEAN) return n < -0.35 ? B.sand : B.gravel;
    return deep ? (n > 0.25 ? B.gravel : n < -0.45 ? B.clay : B.sand) : n > 0.55 ? B.gravel : B.sand;
  }

  // Grows the sea floor's life in a fresh chunk. `c`: { blocks, x0, z0, TOP, BIO, GW }.
  decorate(c) {
    const { blocks, x0, z0, TOP, BIO, GW } = c, seed = this.seed;
    this.reefs(c);
    for (let z = 0; z < 16; z++) for (let x = 0; x < 16; x++) {
      const biome = BIO[(z + 1) * GW + x + 1], floor = TOP[z * 16 + x], wx = x0 + x, wz = z0 + z;
      if (floor >= SEA_LEVEL - 1 || floor < 2) continue;
      const fi = idx(x, floor, z), at = fi + 256;
      if (!SEA_FLOOR.has(blocks[fi]) || blocks[at] !== B.water) continue;
      const depth = SEA_LEVEL - floor, r = hash2(wx, wz, seed ^ 0x5eaf), r2 = hash2(wz, wx, seed ^ 0xf1a5);
      const meadow = this.nMeadow.noise2(wx / 30, wz / 30);
      if (this.reefy(biome, wx, wz, depth)) {
        // Between the reef's corals: the sand grows loose coral, fans, sea pickles and seagrass.
        const kind = CORALS[Math.floor(r2 * CORALS.length)];
        if (r < 0.2) blocks[at] = B[`${kind}_coral`];
        else if (r < 0.34) blocks[at] = B[`${kind}_coral_fan`];
        else if (r < 0.37) blocks[at] = B.sea_pickle + Math.floor(r2 * 4);
        else if (r < 0.5) blocks[at] = B.seagrass;
        continue;
      }
      if ((WARM.has(biome) || LUKEWARM.has(biome)) && r < 0.012) { blocks[at] = B.sea_pickle + Math.floor(r2 * 4); continue; }
      if (KELPY.has(biome) && this.nKelp.noise2(wx / 64, wz / 64) > -0.1 && r < 0.22 && depth >= 4) {
        // Kelp: up from the floor towards the surface, stopping short of it more or less.
        const tall = Math.max(1, Math.min(depth - 2, 2 + Math.floor(r2 * (depth - 2) * 1.1)));
        for (let k = 0; k < tall; k++) blocks[at + k * 256] = k === tall - 1 ? B.kelp : B.kelp_plant;
        continue;
      }
      // Seagrass, thicker in its meadows (tall where there's room).
      const grass = FROZEN.has(biome) ? 0.03 : meadow > 0.2 ? 0.55 : 0.12;
      if (r < grass) {
        if (r2 < 0.3 && depth >= 3) { blocks[at] = B.tall_seagrass; blocks[at + 256] = B.tall_seagrass_top; } else blocks[at] = B.seagrass;
      }
    }
  }

  // Is this part of a reef? Warm seas where the reef noise runs high, and now and then lukewarm
  // shallows.
  reefy(biome, wx, wz, depth) {
    if (depth < 3) return false;
    const warm = WARM.has(biome);
    if (!warm && !(LUKEWARM.has(biome) && depth < 12)) return false;
    const reef = this.nReef.noise2(wx / 36, wz / 36) + this.nReef.noise2(wx / 9, wz / 9) * 0.35;
    return warm ? reef > 0.05 && depth <= 24 : reef > 0.55;
  }

  // The reef's corals, each one kind of coral block: coral trees (a trunk with branches reaching
  // up), coral mushrooms (a cap on a short stalk) and coral claws (arms spreading from a knuckle),
  // topped with coral, fans and sea pickles. Each keeps inside its chunk and under water, a few
  // blocks below the surface.
  reefs(c) {
    const { blocks, x0, z0, TOP, BIO, GW } = c;
    const rnd = mulberry32(Math.floor(hash2(x0 >> 4, z0 >> 4, this.seed ^ 0xc02a1) * 4294967296));
    const put = (x, y, z, id) => {
      if (x < 0 || x > 15 || z < 0 || z > 15 || y >= SEA_LEVEL - 2) return false;
      const i = idx(x, y, z);
      if (blocks[i] !== B.water) return false;
      blocks[i] = id;
      return true;
    };
    // (What grows on top of a coral block: coral, a fan, sea pickles, or nothing.)
    const crown = (x, y, z) => {
      const t = rnd(), kind = CORALS[Math.floor(rnd() * CORALS.length)];
      if (t < 0.3) put(x, y, z, B[`${kind}_coral`]);
      else if (t < 0.55) put(x, y, z, B[`${kind}_coral_fan`]);
      else if (t < 0.6) put(x, y, z, B.sea_pickle + Math.floor(rnd() * 4));
    };
    const tries = 14;
    for (let k = 0; k < tries; k++) {
      const x = 2 + Math.floor(rnd() * 12), z = 2 + Math.floor(rnd() * 12), shape = rnd(), kind = CORALS[Math.floor(rnd() * CORALS.length)];
      const floor = TOP[z * 16 + x], biome = BIO[(z + 1) * GW + x + 1], depth = SEA_LEVEL - floor;
      if (depth < 5 || !SEA_FLOOR.has(blocks[idx(x, floor, z)]) || !this.reefy(biome, x0 + x, z0 + z, depth)) continue;
      const block = B[`${kind}_coral_block`];
      if (shape < 0.4) {
        // A tree: a trunk, then two to four branches, each out a block and up one or two.
        const trunk = 1 + Math.floor(rnd() * 3);
        let y = floor + 1;
        for (let t = 0; t < trunk; t++, y++) if (!put(x, y, z, block)) break;
        crown(x, y, z);
        for (const [dx, dz] of DIRS) {
          if (rnd() < 0.35) continue;
          let bx = x + dx, bz = z + dz, by = y - 1 - Math.floor(rnd() * 2);
          if (!put(bx, by, bz, block)) continue;
          for (let u = 0, up = 1 + Math.floor(rnd() * 2); u < up; u++) { by++; if (!put(bx, by, bz, block)) break; }
          if (rnd() < 0.4) { bx += dx; bz += dz; if (!put(bx, by, bz, block)) { crown(bx - dx, by + 1, bz - dz); continue; } }
          crown(bx, by + 1, bz);
        }
      } else if (shape < 0.7) {
        // A mushroom: a stalk and a cap three wide (its corners sometimes bitten off).
        const stalk = 1 + Math.floor(rnd() * 2), y = floor + 1 + stalk;
        for (let t = 0; t < stalk; t++) put(x, floor + 1 + t, z, block);
        for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) {
          if (dx && dz && rnd() < 0.4) continue;
          if (put(x + dx, y, z + dz, block) && rnd() < 0.6) crown(x + dx, y + 1, z + dz);
        }
        if (rnd() < 0.5 && put(x, y + 1, z, block)) crown(x, y + 2, z);
      } else {
        // A claw: a knuckle on the sand, with two or three arms reaching out and up.
        put(x, floor + 1, z, block);
        const arms = DIAGS.filter(() => rnd() < 0.7).slice(0, 3);
        for (const [dx, dz] of arms) {
          let ax = x, ay = floor + 1, az = z;
          for (let s = 0, len = 2 + Math.floor(rnd() * 2); s < len; s++) {
            ax += s % 2 ? 0 : dx; az += s % 2 ? dz : 0; ay += s > 0 ? 1 : 0;
            if (!put(ax, ay, az, block)) { ay--; break; }
          }
          crown(ax, ay + 1, az);
        }
      }
    }
  }
}
