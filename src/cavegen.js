// The caves of worlds made since the cave update (generator 5): great caverns held up by pillars of
// stone, tunnels of every width winding between them with narrow passages off those, ravines cut
// deep into the ground, underground lakes and (deep down) lava, thicker deepslate with tuff in it,
// great veins of copper and iron, and caves of their own kinds: dripstone caves, lush caves and
// amethyst geodes. Like the rest of the terrain these are pure functions of the seed and position,
// so every chunk agrees with its neighbours (see WorldGen.generate).
import { CHUNK_VOLUME, HEIGHT, SEA_LEVEL } from './config.js';
import { Noise } from './noise.js';
import { B, OPAQUE, GLOW_LICHEN, caveVineId } from './blocks.js';
import { BIOME } from './biomes.js';
import { hash2, hash3, hashString, mulberry32, smoothstep } from './math.js';
import { dripParts, dripId } from './caves.js';

export const LAVA_LEVEL = 8;   // open caves this deep are full of lava
export const DEEP = 20;        // deepslate below here, mixing into the stone for DEEP_MIX more
export const DEEP_MIX = 8;
const GY = HEIGHT / 4 + 1;     // lattice samples up a column
// Underground lakes: the ground is split into cells, each with a water table (or none), which
// neighbouring cells mostly share. The cells' edges run down the middle of chunks, so where two
// tables meet, the wall between them can be built within one chunk.
const CELL = 48, CELL_OFF = 8, LAKE_TOP = SEA_LEVEL - 11;
const LEVELS = [12, 18, 24, 30, 36, 42];
const RAVINE_CHANCE = 0.012, RAVINE_REACH = 8;
const GEODE_CHANCE = 1 / 22;
// Plain rock that the caves' own growths may take over.
const ROCK = new Set([B.stone, B.deepslate, B.tuff, B.granite, B.diorite, B.andesite, B.dirt, B.gravel]);
const PLAIN = 0, DRIP = 1, LUSH = 2;
// Surfaces with no lush caves under them (too dry or too cold).
const NOT_LUSH = new Set([BIOME.DESERT, BIOME.BADLANDS, BIOME.SNOWY_PLAINS, BIOME.SNOWY_TAIGA, BIOME.ICE_SPIKES, BIOME.FROZEN_PEAKS,
  BIOME.JAGGED_PEAKS, BIOME.SNOWY_SLOPES, BIOME.SNOWY_BEACH, BIOME.FROZEN_OCEAN, BIOME.FROZEN_RIVER, BIOME.DEEP_FROZEN_OCEAN]);
const idx = (x, y, z) => (y << 8) | (z << 4) | x;
const SIDES = [[1, 0, 0], [-1, 1, 0], [0, 4, 1], [0, 5, -1]]; // dx, face of the lichen's wall, dz

export class CaveGen {
  constructor(seed) {
    this.seed = seed >>> 0;
    const n = (k) => new Noise((this.seed ^ hashString(k)) >>> 0);
    this.nA = n('tunnelA'); this.nB = n('tunnelB'); this.nW = n('tunnelWidth');
    this.nNA = n('noodleA'); this.nNB = n('noodleB');
    this.nC = n('cavern'); this.nC2 = n('cavernDetail');
    this.nP = n('pillars'); this.nPR = n('pillarRegion');
    this.nLush = n('lushCaves'); this.nDrip = n('dripstoneCaves');
    this.nVT = n('veinType'); this.nVA = n('veinA'); this.nVB = n('veinB');
    this.nWet = n('waterTable'); this.nLevel = n('waterLevel');
    this.tables = new Map(); // lake cell -> its water table
    this.cave = new Uint8Array(CHUNK_VOLUME); // cells carved out of the chunk being made
    this.maxY = new Int16Array(256);          // how high caves may reach in each column
    this.lat = [...Array(6)].map(() => new Float32Array(25 * GY));
    this.colv = [...Array(6)].map(() => new Float32Array(GY));
    this.ravines = new Map();  // origin chunk -> its ravine (or null)
    this.touching = new Map(); // chunk -> the ravines reaching into it
  }

  // ---------------------------------------------------------------- rock
  // Deepslate below y 20, giving way to stone over the next eight blocks.
  isDeep(wx, y, wz) {
    return y < DEEP || (y < DEEP + DEEP_MIX && hash3(wx, y, wz, this.seed ^ 0xd5) < (DEEP + DEEP_MIX - y) / DEEP_MIX);
  }

  // ---------------------------------------------------------------- carving
  // The noise fields at one lattice point (every 4 blocks), into lat[f][k].
  sample(k, sx, sy, sz) {
    const L = this.lat;
    L[0][k] = this.nA.noise3(sx / 64, sy / 40, sz / 64);
    L[1][k] = this.nB.noise3(sx / 64, sy / 40, sz / 64 + 70);
    L[2][k] = this.nW.noise3(sx / 110, sy / 70, sz / 110);
    L[3][k] = this.nNA.noise3(sx / 40, sy / 26, sz / 40);
    L[4][k] = this.nNB.noise3(sx / 40, sy / 26, sz / 40 + 50);
    L[5][k] = this.nC.noise3(sx / 120, sy / 56, sz / 120) * 0.7 + this.nC2.noise3(sx / 44, sy / 30, sz / 44) * 0.3;
  }
  // Tunnels: where two noise fields both cross zero, their width set by a third.
  static tunnelT(w) { return 0.003 + 0.022 * smoothstep(-0.5, 0.55, w); }
  // Caverns open where the cavern noise runs high: more of them, and bigger, the deeper you go.
  static cavernT(y) { return 0.28 + 0.25 * smoothstep(12, 64, y); }
  // Stone pillars stand in some caverns, floor to ceiling.
  pillar(wx, wz) {
    const region = this.nPR.noise2(wx / 80, wz / 80);
    return region > 0.12 && this.nP.noise2(wx / 11, wz / 11) > 0.62 - region * 0.2;
  }

  // Carves the chunk's caves. `c`: { blocks, x0, z0, H (heights with a one-column margin, GW wide),
  // GW, TOP (surface heights), VIN (inside a settlement), maxH }.
  carve(c) {
    const { blocks, x0, z0, H, GW, TOP, VIN, maxH } = c;
    const cave = this.cave, L = this.lat, V = this.colv;
    cave.fill(0);
    const caveTop = Math.min(HEIGHT - 1, maxH + 8), NY = Math.min(GY, (caveTop >> 2) + 2);
    for (let iz = 0; iz < 5; iz++) for (let ix = 0; ix < 5; ix++) {
      for (let iy = 0; iy < NY; iy++) this.sample((iz * 5 + ix) * GY + iy, x0 + ix * 4, iy * 4, z0 + iz * 4);
    }
    for (let z = 0; z < 16; z++) {
      for (let x = 0; x < 16; x++) {
        const gi = (z + 1) * GW + x + 1, h = TOP[z * 16 + x];
        let minN = H[gi];
        for (const o of [1, -1, GW, -GW, GW + 1, GW - 1, -GW + 1, -GW - 1]) minN = Math.min(minN, H[gi + o]);
        // Caves never break out under the sea, a river or a settlement.
        let maxY = h;
        if (h <= SEA_LEVEL + 1 || minN < SEA_LEVEL) maxY = Math.min(h, minN) - 5;
        if (VIN[z * 16 + x]) maxY = Math.min(maxY, h - 8);
        this.maxY[z * 16 + x] = maxY;
        if (maxY < 6) continue;
        const ix = x >> 2, iz = z >> 2, fx = (x & 3) / 4, fz = (z & 3) / 4;
        const k00 = (iz * 5 + ix) * GY, k10 = k00 + GY, k01 = k00 + 5 * GY, k11 = k01 + GY;
        const w00 = (1 - fx) * (1 - fz), w10 = fx * (1 - fz), w01 = (1 - fx) * fz, w11 = fx * fz;
        const top = Math.min(GY - 1, (maxY >> 2) + 1);
        for (let f = 0; f < 6; f++) {
          const F = L[f], out = V[f];
          for (let iy = 0; iy <= top; iy++) out[iy] = F[k00 + iy] * w00 + F[k10 + iy] * w10 + F[k01 + iy] * w01 + F[k11 + iy] * w11;
        }
        const wx = x0 + x, wz = z0 + z, pillar = this.pillar(wx, wz);
        const cavernTop = Math.min(maxY, h - 10), noodleTop = Math.min(maxY, h - 8);
        for (let y = 6; y <= maxY; y++) {
          const iy = y >> 2, fy = (y & 3) / 4, at = (f) => V[f][iy] + (V[f][iy + 1] - V[f][iy]) * fy;
          const a = at(0), b = at(1);
          let carve = a * a + b * b < CaveGen.tunnelT(at(2));
          if (!carve && y >= 8 && y <= noodleTop) { const na = at(3), nb = at(4); carve = na * na + nb * nb < 0.005; }
          if (!carve && y <= cavernTop && !pillar) carve = at(5) > CaveGen.cavernT(y);
          if (!carve) continue;
          const i = idx(x, y, z);
          if (blocks[i] === B.bedrock || blocks[i] === 0) continue;
          blocks[i] = y <= LAVA_LEVEL ? B.lava : 0;
          cave[i] = 1;
        }
      }
    }
    this.carveRavines(c);
  }

  // ---------------------------------------------------------------- ravines
  // The ravine starting in chunk (ocx, ocz), if there is one: a long, deep, narrow cut that wanders
  // as it goes, widest in the middle, as a list of ellipsoids ([x, y, z, radius, height]) and each
  // level's roughness (Minecraft's canyon carver).
  ravine(ocx, ocz) {
    const key = ocx * 65536 + ocz;
    if (this.ravines.has(key)) return this.ravines.get(key);
    let out = null;
    const rnd = mulberry32(Math.floor(hash2(ocx, ocz, this.seed ^ 0x7a71e) * 4294967296));
    if (rnd() < RAVINE_CHANCE) {
      let x = ocx * 16 + rnd() * 16, z = ocz * 16 + rnd() * 16, y = 22 + rnd() * 36;
      let yaw = rnd() * Math.PI * 2, pitch = (rnd() - 0.5) * 0.25, yawV = 0, pitchV = 0;
      const width = 1.4 + rnd() * 2.4, len = 70 + Math.floor(rnd() * 50);
      const rough = new Float32Array(HEIGHT);
      for (let yy = 0; yy < HEIGHT; yy++) rough[yy] = yy === 0 || rnd() < 1 / 3 ? 1 + rnd() * rnd() : rough[yy - 1];
      const parts = [];
      let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
      for (let i = 0; i < len; i++) {
        const r = 1.5 + Math.sin((i * Math.PI) / len) * width, cp = Math.cos(pitch);
        x += Math.cos(yaw) * cp; y += Math.sin(pitch); z += Math.sin(yaw) * cp;
        pitch = pitch * 0.7 + pitchV * 0.05; yaw += yawV * 0.05;
        pitchV = pitchV * 0.8 + (rnd() - rnd()) * rnd() * 2;
        yawV = yawV * 0.5 + (rnd() - rnd()) * rnd() * 4;
        if (rnd() < 0.25) continue;
        parts.push([x, y, z, r, r * 3]);
        x0 = Math.min(x0, x - r); x1 = Math.max(x1, x + r); z0 = Math.min(z0, z - r); z1 = Math.max(z1, z + r);
      }
      out = { parts, rough, box: [x0, z0, x1, z1] };
    }
    if (this.ravines.size > 4000) this.ravines.clear();
    this.ravines.set(key, out);
    return out;
  }
  // The ravines that reach into chunk (cx, cz).
  ravinesIn(cx, cz) {
    const key = cx * 65536 + cz;
    let list = this.touching.get(key);
    if (list) return list;
    list = [];
    for (let oz = cz - RAVINE_REACH; oz <= cz + RAVINE_REACH; oz++) for (let ox = cx - RAVINE_REACH; ox <= cx + RAVINE_REACH; ox++) {
      const r = this.ravine(ox, oz);
      if (r && r.box[0] < cx * 16 + 16 && r.box[2] > cx * 16 && r.box[1] < cz * 16 + 16 && r.box[3] > cz * 16) list.push(r);
    }
    if (this.touching.size > 1000) this.touching.clear();
    this.touching.set(key, list);
    return list;
  }
  // Whether the ellipsoid `p` of ravine `r` takes in the block at (x, y, z) (floors are flat).
  static inRavine(r, p, x, y, z) {
    const dx = (x + 0.5 - p[0]) / p[3], dy = (y + 0.5 - p[1]) / p[4], dz = (z + 0.5 - p[2]) / p[3];
    return dy > -0.7 && (dx * dx + dz * dz) * r.rough[y] + (dy * dy) / 6 < 1;
  }
  carveRavines(c) {
    const { blocks, x0, z0 } = c;
    for (const r of this.ravinesIn(x0 >> 4, z0 >> 4)) {
      for (const p of r.parts) {
        const [px, py, pz, pr, ph] = p;
        const xa = Math.max(0, Math.floor(px - pr) - x0), xb = Math.min(15, Math.ceil(px + pr) - x0);
        const za = Math.max(0, Math.floor(pz - pr) - z0), zb = Math.min(15, Math.ceil(pz + pr) - z0);
        if (xa > xb || za > zb) continue;
        const ya = Math.max(5, Math.floor(py - ph * 0.7)), yb = Math.min(HEIGHT - 2, Math.ceil(py + ph * 2.45));
        for (let z = za; z <= zb; z++) for (let x = xa; x <= xb; x++) {
          const top = Math.min(yb, this.maxY[z * 16 + x]);
          for (let y = ya; y <= top; y++) {
            if (!CaveGen.inRavine(r, p, x0 + x, y, z0 + z)) continue;
            const i = idx(x, y, z);
            if (blocks[i] === B.bedrock || blocks[i] === 0 || blocks[i] === B.lava) continue;
            blocks[i] = y <= LAVA_LEVEL ? B.lava : 0;
            this.cave[i] = 1;
          }
        }
      }
    }
  }

  // Whether a block at the surface may have been carved away (tree roots check this, so it must
  // never say no where a chunk would carve; it errs the other way by a hair).
  surfaceCarved(x, y, z) {
    const gx = Math.floor(x / 4) * 4, gy = Math.floor(y / 4) * 4, gz = Math.floor(z / 4) * 4;
    const fx = (x - gx) / 4, fy = (y - gy) / 4, fz = (z - gz) / 4;
    let a = 0, b = 0, w = 0;
    for (let k = 0; k < 8; k++) {
      const dx = k & 1, dy = (k >> 1) & 1, dz = (k >> 2) & 1;
      const f = (dx ? fx : 1 - fx) * (dy ? fy : 1 - fy) * (dz ? fz : 1 - fz);
      if (!f) continue;
      const sx = gx + dx * 4, sy = gy + dy * 4, sz = gz + dz * 4;
      a += f * this.nA.noise3(sx / 64, sy / 40, sz / 64);
      b += f * this.nB.noise3(sx / 64, sy / 40, sz / 64 + 70);
      w += f * this.nW.noise3(sx / 110, sy / 70, sz / 110);
    }
    if (a * a + b * b < CaveGen.tunnelT(w) * 1.02 + 1e-6) return true;
    for (const r of this.ravinesIn(x >> 4, z >> 4)) for (const p of r.parts) if (CaveGen.inRavine(r, p, x, y, z)) return true;
    return false;
  }

  // ---------------------------------------------------------------- lakes
  // The water table of lake cell (gx, gz), or 0 where the ground is dry: wet and dry ground, and
  // how high the water stands, come in broad regions.
  table(gx, gz) {
    const key = gx * 65536 + gz;
    let level = this.tables.get(key);
    if (level !== undefined) return level;
    const x = gx * CELL - CELL_OFF + CELL / 2, z = gz * CELL - CELL_OFF + CELL / 2;
    level = 0;
    if (this.nWet.noise2(x / 400, z / 400) > 0.25) {
      const v = this.nLevel.noise2(x / 600 + 13, z / 600 - 7) * 0.6 + 0.5;
      level = Math.min(LAKE_TOP, LEVELS[Math.max(0, Math.min(LEVELS.length - 1, Math.floor(v * LEVELS.length)))]);
    }
    if (this.tables.size > 4000) this.tables.clear();
    this.tables.set(key, level);
    return level;
  }
  // The fluid a carved-out block at (x, y, z) fills with: lava in the deepest caves, and below the
  // water table, water.
  fluidAt(x, y, z) {
    if (y <= LAVA_LEVEL) return B.lava;
    return y <= this.table(Math.floor((x + CELL_OFF) / CELL), Math.floor((z + CELL_OFF) / CELL)) ? B.water : 0;
  }
  // Fills the carved-out caves with their lakes. Where a lake would spill into a cave beside or
  // below it that has another level (or none), it's walled in with stone.
  fill(c) {
    const { blocks, x0, z0 } = c, cave = this.cave;
    for (let z = 0; z < 16; z++) for (let x = 0; x < 16; x++) {
      const top = Math.min(LAKE_TOP, this.maxY[z * 16 + x]), wx = x0 + x, wz = z0 + z;
      for (let y = LAVA_LEVEL + 1; y <= top; y++) {
        const i = idx(x, y, z);
        if (!cave[i]) continue;
        const f = this.fluidAt(wx, y, wz);
        if (!f) continue;
        let wall = false;
        for (const [dx, dy, dz] of [[1, 0, 0], [-1, 0, 0], [0, 0, 1], [0, 0, -1], [0, -1, 0]]) {
          const nx = x + dx, nz = z + dz;
          if (nx < 0 || nx > 15 || nz < 0 || nz > 15) continue; // (the same cell: see CELL_OFF)
          const j = idx(nx, y + dy, nz);
          if (!cave[j] || this.fluidAt(wx + dx, y + dy, wz + dz) === f) continue;
          wall = true;
          // (A rough dam of rock rather than a flat wall: a block or two more on the dry side.)
          const rock = y < DEEP ? B.deepslate : B.stone;
          for (let k = 1; k <= 2 && dy === 0; k++) {
            const ax = x + dx * k, az = z + dz * k, a = idx(ax, y, az);
            if (ax < 0 || ax > 15 || az < 0 || az > 15 || !cave[a] || blocks[a] || hash3(wx + dx * k, y, wz + dz * k, this.seed ^ 0xda3) > 0.7 / k) break;
            blocks[a] = rock; cave[a] = 0;
          }
          break;
        }
        if (wall) { blocks[i] = y < DEEP ? B.deepslate : B.stone; cave[i] = 0; } else blocks[i] = f;
      }
    }
  }

  // ---------------------------------------------------------------- ore veins
  // Great veins of ore snaking through the rock: copper in granite, and deeper down iron in tuff,
  // studded with raw ore. (Where two thin noise ridges cross, in regions a third picks out.)
  veins(c) {
    const { blocks, x0, z0 } = c, seed = this.seed;
    const T = new Float32Array(25 * 8), VA = new Float32Array(25 * 8), VB = new Float32Array(25 * 8);
    let any = false;
    for (let iz = 0; iz < 5; iz++) for (let ix = 0; ix < 5; ix++) for (let iy = 0; iy < 8; iy++) {
      const k = (iz * 5 + ix) * 8 + iy, sx = x0 + ix * 4, sy = iy * 8, sz = z0 + iz * 4;
      T[k] = this.nVT.noise3(sx / 180, sy / 100, sz / 180);
      if (Math.abs(T[k]) > 0.2) any = true;
    }
    if (!any) return;
    for (let iz = 0; iz < 5; iz++) for (let ix = 0; ix < 5; ix++) for (let iy = 0; iy < 8; iy++) {
      const k = (iz * 5 + ix) * 8 + iy, sx = x0 + ix * 4, sy = iy * 8, sz = z0 + iz * 4;
      VA[k] = this.nVA.noise3(sx / 56, sy / 48, sz / 56);
      VB[k] = this.nVB.noise3(sx / 56, sy / 48, sz / 56 + 30);
    }
    const at = (F, x, y, z) => {
      const ix = x >> 2, iz = z >> 2, fx = (x & 3) / 4, fz = (z & 3) / 4, iy = Math.min(6, y >> 3), fy = (y - iy * 8) / 8;
      const k = (iz * 5 + ix) * 8 + iy, s = (o) => F[k + o] * (1 - fy) + F[k + o + 1] * fy;
      return (s(0) * (1 - fx) + s(8) * fx) * (1 - fz) + (s(40) * (1 - fx) + s(48) * fx) * fz;
    };
    for (let z = 0; z < 16; z++) for (let x = 0; x < 16; x++) for (let y = 1; y <= 50; y++) {
      const t = at(T, x, y, z), copper = t > 0.28, iron = t < -0.28 && y <= 30;
      if (!copper && !iron) continue;
      if (Math.abs(at(VA, x, y, z)) > 0.07 || Math.abs(at(VB, x, y, z)) > 0.07) continue;
      const i = idx(x, y, z), cur = blocks[i];
      if (cur !== B.stone && cur !== B.deepslate && cur !== B.tuff && cur !== B.granite) continue;
      const r = hash3(x0 + x, y, z0 + z, seed ^ 0x5e1), deep = cur === B.deepslate || cur === B.tuff;
      blocks[i] = r < 0.02 ? (copper ? B.raw_copper_block : B.raw_iron_block)
        : r < 0.3 ? (copper ? (deep ? B.deepslate_copper_ore : B.copper_ore) : deep ? B.deepslate_iron_ore : B.iron_ore)
          : copper ? B.granite : B.tuff;
    }
  }

  // ---------------------------------------------------------------- cave kinds
  lushAt(wx, wz) { return this.nLush.noise2(wx / 150, wz / 150) > 0.42; }
  dripAt(wx, wz) { return this.nDrip.noise2(wx / 140 + 50, wz / 140 - 30) > 0.42; }
  kindAt(wx, wz, biome) {
    if (!NOT_LUSH.has(biome) && this.lushAt(wx, wz)) return LUSH;
    return this.dripAt(wx, wz) ? DRIP : PLAIN;
  }

  // Grows the caves' own things: dripstone in dripstone caves; moss, vines hung with glow berries,
  // azaleas, dripleaves and spore blossoms in lush caves; glow lichen on the walls and a cobweb or
  // two everywhere. `c` also needs BIO (biomes with the margin).
  decorate(c) {
    const { blocks, x0, z0, TOP, BIO, GW } = c;
    for (let z = 0; z < 16; z++) for (let x = 0; x < 16; x++) {
      const h = TOP[z * 16 + x], wx = x0 + x, wz = z0 + z;
      if (h < 14) continue;
      const kind = this.kindAt(wx, wz, BIO[(z + 1) * GW + x + 1]);
      const last = Math.min(h - 4, 100);
      let y = LAVA_LEVEL + 1;
      while (y < last) {
        const i = idx(x, y, z);
        const below = blocks[i - 256];
        if (blocks[i] !== 0 || !(OPAQUE[below] || below === B.water)) { y++; continue; }
        let top = y;
        while (top + 1 < h && blocks[i + (top + 1 - y) * 256] === 0) top++;
        this.decorateRun(c, x, z, y, top, !!OPAQUE[below], top + 1 <= h - 2 && !!OPAQUE[blocks[idx(x, top + 1, z)]], kind);
        y = top + 2;
      }
    }
  }
  // One run of open cave in a column, from the floor (f) to the ceiling (top).
  decorateRun(c, x, z, f, top, floored, roofed, kind) {
    const { blocks, x0, z0 } = c, wx = x0 + x, wz = z0 + z, seed = this.seed;
    const r = (k) => hash3(wx, f * 16 + k, wz, seed ^ 0xdec0);
    const height = top - f + 1, fi = idx(x, f - 1, z), ci = idx(x, top + 1, z);
    let down = 0, up = 0, merged = false, vines = 0;
    if (kind === DRIP) {
      if (floored && ROCK.has(blocks[fi]) && r(1) < 0.7) blocks[fi] = B.dripstone_block;
      if (roofed && ROCK.has(blocks[ci]) && r(2) < 0.7) blocks[ci] = B.dripstone_block;
      if (roofed && r(3) < 0.22) down = 1 + Math.floor(r(4) ** 2 * 7);
      if (floored && r(5) < 0.16) up = 1 + Math.floor(r(6) ** 2 * 6);
    } else if (kind === LUSH) {
      if (floored && ROCK.has(blocks[fi]) && r(1) < 0.92) {
        blocks[fi] = B.moss_block;
        const p = r(7);
        if (p < 0.035 && height >= 3) {
          // A big dripleaf on a stalk one to three blocks tall.
          const tall = 1 + Math.floor(r(8) * Math.min(3, height - 2));
          for (let k = 0; k < tall - 1; k++) blocks[idx(x, f + k, z)] = B.big_dripleaf_stem;
          blocks[idx(x, f + tall - 1, z)] = B.big_dripleaf;
          up = -tall;
        } else if (p < 0.065) blocks[idx(x, f, z)] = B.azalea;
        else if (p < 0.085) blocks[idx(x, f, z)] = B.flowering_azalea;
        else if (p < 0.28) blocks[idx(x, f, z)] = B.moss_carpet;
        else if (p < 0.46) blocks[idx(x, f, z)] = B.tall_grass;
        else if (p > 0.97 && this.pool(blocks, x, f - 1, z)) { blocks[fi] = B.water; blocks[fi - 256] = B.clay; }
      }
      if (roofed) {
        if (ROCK.has(blocks[ci])) { const cr = r(9); if (cr < 0.12) blocks[ci] = B.rooted_dirt; else if (cr < 0.55) blocks[ci] = B.moss_block; }
        const room = height - Math.abs(Math.min(0, up)) - 1;
        if (blocks[ci] === B.rooted_dirt && r(10) < 0.6) blocks[idx(x, top, z)] = B.hanging_roots;
        else if (r(11) < 0.17 && room > 0) vines = Math.min(room, 1 + Math.floor(r(12) ** 2 * 10));
        else if (r(13) < 0.012) blocks[idx(x, top, z)] = B.spore_blossom;
      }
    } else if (roofed && f > 12 && r(3) < 0.012) down = 1 + Math.floor(r(4) * 2);
    // Stalactites and stalagmites; where they'd meet, they join up.
    if (up > 0 || down > 0) {
      if (up > 0 && down > 0 && up + down >= height) { down = Math.max(1, Math.min(down, height - 1)); up = height - down; merged = true; }
      if (!merged) { down = Math.min(down, height - 1); up = Math.min(up, height - 1 - down); }
      if (down > 0) dripParts(down, merged).forEach((p, k) => { blocks[idx(x, top - k, z)] = dripId(false, p); });
      if (up > 0) dripParts(up, merged).forEach((p, k) => { blocks[idx(x, f + k, z)] = dripId(true, p); });
    }
    // Cave vines, a few pieces of them hung with glow berries.
    for (let k = 0; k < vines; k++) {
      const i = idx(x, top - k, z);
      if (blocks[i] !== 0) break;
      blocks[i] = caveVineId(k === vines - 1 || blocks[i - 256] !== 0, hash3(wx, top - k, wz, seed ^ 0xbe77) < 0.3);
    }
    // Glow lichen on the walls (and now and then the floor), and cobwebs in the narrow places.
    const lichen = kind === LUSH ? 0.02 : kind === DRIP ? 0.004 : 0.008;
    for (let y = f; y <= top; y++) {
      const i = idx(x, y, z);
      if (blocks[i] !== 0) continue;
      const q = hash3(wx, y, wz, seed ^ 0x11c4e);
      if (q < lichen) {
        const start = Math.floor(q * 400) & 3;
        for (let s = 0; s < 4; s++) {
          const [dx, face, dz] = SIDES[(start + s) & 3], nx = x + dx, nz = z + dz;
          if (nx < 0 || nx > 15 || nz < 0 || nz > 15 || !OPAQUE[blocks[idx(nx, y, nz)]]) continue;
          blocks[i] = GLOW_LICHEN[face];
          break;
        }
        if (!blocks[i] && y === f && floored && q < lichen / 3) blocks[i] = GLOW_LICHEN[3];
      } else if (kind === PLAIN && height <= 3 && y === f && q > 0.9985) blocks[i] = B.cobweb;
    }
  }
  // Whether the block at (x, y, z) is walled in on four sides (so a pool of water there stays put).
  pool(blocks, x, y, z) {
    if (x < 1 || x > 14 || z < 1 || z > 14) return false;
    return [[1, 0], [-1, 0], [0, 1], [0, -1]].every(([dx, dz]) => OPAQUE[blocks[idx(x + dx, y, z + dz)]] && blocks[idx(x + dx, y, z + dz)] !== B.water);
  }

  // ---------------------------------------------------------------- geodes
  // Amethyst geodes: hollow balls in the rock, lined with amethyst (and crystals growing off the
  // budding amethyst in it) inside shells of calcite and smooth basalt. A geode may start in a
  // neighbouring chunk and reach into this one. `c` also needs surface(x, z): the ground height.
  geodes(c) {
    const { blocks, x0, z0 } = c, cx = x0 >> 4, cz = z0 >> 4, seed = this.seed;
    for (let ncz = cz - 1; ncz <= cz + 1; ncz++) for (let ncx = cx - 1; ncx <= cx + 1; ncx++) {
      const rnd = mulberry32(Math.floor(hash2(ncx, ncz, seed ^ 0x9e0de) * 4294967296));
      if (rnd() >= GEODE_CHANCE) continue;
      const gx = ncx * 16 + 3 + rnd() * 10, gz = ncz * 16 + 3 + rnd() * 10, R = 4.6 + rnd() * 1.6;
      const gy = 8 + R + rnd() * 26;
      if (gy + R + 6 > c.surface(Math.floor(gx), Math.floor(gz))) continue;
      const xa = Math.max(0, Math.floor(gx - R) - x0), xb = Math.min(15, Math.ceil(gx + R) - x0);
      const za = Math.max(0, Math.floor(gz - R) - z0), zb = Math.min(15, Math.ceil(gz + R) - z0);
      if (xa > xb || za > zb) continue;
      for (let z = za; z <= zb; z++) for (let x = xa; x <= xb; x++) for (let y = Math.floor(gy - R); y <= Math.ceil(gy + R); y++) {
        const wx = x0 + x, wz = z0 + z;
        const d = Math.hypot(wx + 0.5 - gx, y + 0.5 - gy, wz + 0.5 - gz) + (hash3(wx, y, wz, seed ^ 0x6e0) - 0.5) * 0.7;
        if (d > R) continue;
        const i = idx(x, y, z);
        if (blocks[i] === B.bedrock) continue;
        blocks[i] = d > R - 0.9 ? B.smooth_basalt : d > R - 1.8 ? B.calcite
          : d > R - 2.7 ? (hash3(wz, y, wx, seed ^ 0xb0d) < 0.1 ? B.budding_amethyst : B.amethyst_block) : 0;
      }
      // Crystals: up from the budding amethyst in the floor, down from it in the roof.
      for (let z = za; z <= zb; z++) for (let x = xa; x <= xb; x++) for (let y = Math.floor(gy - R) + 1; y < Math.ceil(gy + R); y++) {
        const i = idx(x, y, z);
        if (blocks[i] !== 0) continue;
        const q = hash3(x0 + x, y, z0 + z, seed ^ 0xc75), size = Math.floor(q * 16) & 3;
        if (blocks[i - 256] === B.budding_amethyst && q < 0.7) blocks[i] = B.small_amethyst_bud + size * 2;
        else if (y + 1 < HEIGHT && blocks[i + 256] === B.budding_amethyst && q < 0.7) blocks[i] = B.small_amethyst_bud + size * 2 + 1;
      }
    }
  }
}
