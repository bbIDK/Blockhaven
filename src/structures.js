// Generator 10's structures: desert pyramids, jungle temples, igloos, shipwrecks, ocean monuments,
// mineshafts and strongholds. Like settlements (villages.js), each is planned once from the seed and
// the lie of the land alone - never from the blocks of a chunk - so every chunk it reaches into
// agrees about it, and each chunk copies its share of the structure's blueprint as it's made (the
// last step of WorldGen.generate). Every kind has a grid of square regions of its own, at most one
// to a region and kept inside it; strongholds lie in rings round the middle of the world instead.
import { HEIGHT, SEA_LEVEL, chunkKey } from './config.js';
import { B, R, SOLID, WATERLIKE, REPLACEABLE, RENDER, STAIRS, FACING_VARIANTS, WALL_TORCH, TORCH_LEAN, LADDER, VINE, WOOD, LOG_AXES,
  RAIL_ID, doorId, bedId, trapdoorId, lootChestId, dispenserId, hookId } from './blocks.js';
import { BIOME, OCEANS } from './biomes.js';
import { hash2, mulberry32 } from './math.js';
import { villageAt } from './villages.js';

// How a blueprint's block goes in (bits over its id; FILL | DRY: only into air or plants).
const FILL = 0x1000; // only into air, water or plants: foundations, pillars, bridges over caves
const DRY = 0x2000;  // not where there's water or lava (a tunnel doesn't let a lake in)
const SOFT = 0x4000; // only over plants and snow: the ground over a building cleared
const HUNG = 0x8000; // (a wall torch) only if what it hangs on is solid
// Plants, snow and the like, which a building clears away.
const SOFT_IDS = new Uint8Array(WATERLIKE.length);
for (let id = 1; id < SOFT_IDS.length; id++) {
  if (!WATERLIKE[id] && (REPLACEABLE[id] || RENDER[id] === R.CROSS || RENDER[id] === R.CACTUS)) SOFT_IDS[id] = 1;
}
SOFT_IDS[B.lily_pad] = 1;

const FACES = [5, 4, 0, 1];
const STEP = { 0: [1, 0], 1: [-1, 0], 4: [0, 1], 5: [0, -1] };
const pick = (rnd, list) => list[Math.floor(rnd() * list.length)];
const DEEP = new Set([BIOME.DEEP_OCEAN, BIOME.DEEP_LUKEWARM_OCEAN, BIOME.DEEP_COLD_OCEAN, BIOME.DEEP_FROZEN_OCEAN]);
const SNOWY = new Set([BIOME.SNOWY_PLAINS, BIOME.SNOWY_TAIGA, BIOME.ICE_SPIKES]);
const JUNGLES = new Set([BIOME.JUNGLE, BIOME.SPARSE_JUNGLE]);
const BEACHES = new Set([BIOME.BEACH, BIOME.SNOWY_BEACH]);

// ---------------------------------------------------------------- blueprints
// A structure's blocks, sorted by chunk: chunk key -> packed (y << 8 | z << 4 | x) + (id | how) << 16,
// in the order they go in.
class Plot {
  constructor() { this.chunks = new Map(); this.key = -1; this.list = null; }
  put(x, y, z, op) {
    if (y < 1 || y >= HEIGHT) return;
    const key = chunkKey(x >> 4, z >> 4);
    if (key !== this.key) {
      this.key = key;
      this.list = this.chunks.get(key);
      if (!this.list) this.chunks.set(key, this.list = []);
    }
    this.list.push(((y << 8) | ((z & 15) << 4) | (x & 15)) + op * 65536);
  }
  seal() {
    for (const [k, a] of this.chunks) this.chunks.set(k, Uint32Array.from(a));
    this.key = -1; this.list = null;
    return this;
  }
}

// A structure's own coordinates: x across it, z from its front (0) back, y up from (x, y, z). The
// front faces `face`, and the local faces (5 front, 4 back, 1 left, 0 right, 2 up, 3 down) turn with
// it. (ox, oz) are added to every local x and z first, so a building drawn from its corner turns
// about its middle. A frame inside another (`parent`) is placed in that one's coordinates.
const UX = { 5: [1, 0], 4: [-1, 0], 0: [0, 1], 1: [0, -1] };
const UZ = { 5: [0, 1], 4: [0, -1], 0: [-1, 0], 1: [1, 0] };
const TURN = { 5: [5, 4, 1, 0], 4: [4, 5, 0, 1], 0: [0, 1, 5, 4], 1: [1, 0, 4, 5] };
const LOCAL_STEP = { 5: [0, -1], 4: [0, 1], 1: [-1, 0], 0: [1, 0] };
class Frame {
  constructor(plot, x, y, z, face, ox = 0, oz = 0, parent = null) {
    this.plot = plot; this.x = x; this.y = y; this.z = z; this.ox = ox; this.oz = oz; this.parent = parent;
    this.ux = UX[face]; this.uz = UZ[face];
    const t = TURN[face];
    this.faces = [t[3], t[2], 2, 3, t[1], t[0]];
  }
  at(x, z) {
    x += this.ox; z += this.oz;
    return [this.x + this.ux[0] * x + this.uz[0] * z, this.z + this.ux[1] * x + this.uz[1] * z];
  }
  // The world face of local face `face`, and the world axis ('x' or 'z') of local axis `axis`.
  f(face) { const w = this.faces[face]; return this.parent ? this.parent.f(w) : w; }
  axis(axis) {
    const a = (axis === 'x' ? this.ux[0] : this.uz[0]) !== 0 ? 'x' : 'z';
    return this.parent ? this.parent.axis(a) : a;
  }
  put(x, y, z, id, how = 0) {
    const v = typeof id === 'string' ? B[id] : id;
    if (v === undefined) throw new Error(`structures: no block ${id}`);
    const [px, pz] = this.at(x, z);
    if (this.parent) this.parent.put(px, this.y + y, pz, v, how);
    else this.plot.put(px, this.y + y, pz, v | how);
  }
  fill(x0, y0, z0, x1, y1, z1, id, how = 0) {
    for (let y = y0; y <= y1; y++) for (let z = z0; z <= z1; z++) for (let x = x0; x <= x1; x++) this.put(x, y, z, id, how);
  }
  stairs(x, y, z, kind, face, upside = false, how = 0) { this.put(x, y, z, STAIRS[B[`${kind}_stairs`]].ids[this.f(face)][upside ? 1 : 0], how); }
  // A door facing `face` (a closed door's panel is on the side it faces away from).
  door(x, y, z, face, iron = false) {
    const base = iron ? 2228 : WOOD.oak.door, f = this.f(face);
    this.put(x, y, z, doorId(f, false, false, base));
    this.put(x, y + 1, z, doorId(f, false, true, base));
  }
  chest(x, y, z, kind, front, how = 0) { this.put(x, y, z, lootChestId(kind, this.f(front)), how); }
  facing(name, x, y, z, front) { this.put(x, y, z, FACING_VARIANTS[B[name]][this.f(front)]); }
  // A wall torch leaning towards `lean` (hung on the block the other side).
  torch(x, y, z, lean, how = 0) { this.put(x, y, z, WALL_TORCH[this.f(lean)], how); }
  ladder(x, y0, y1, z, wall) { for (let y = y0; y <= y1; y++) this.put(x, y, z, LADDER[this.f(wall)]); }
  vine(x, y, z, side, how = 0) { this.put(x, y, z, VINE[this.f(side)], how); }
  // Switches fixed to the block on their `attach` side.
  lever(x, y, z, attach) { this.put(x, y, z, 2250 + FACES.indexOf(this.f(attach)) * 2); }
  button(x, y, z, attach) { this.put(x, y, z, 2270 + (this.f(attach) ^ 1) * 2); }
  hook(x, y, z, attach) { this.put(x, y, z, hookId(this.f(attach))); }
  wire(x, y, z, axis) { this.put(x, y, z, this.axis(axis) === 'x' ? B.tripwire : B.tripwire_z); }
  dispenser(x, y, z, front, trap = true) { this.put(x, y, z, dispenserId(this.f(front), trap)); }
  // A bed with its foot at (x, z), the head towards `head`.
  bed(x, y, z, head) {
    const f = this.f(head), d = LOCAL_STEP[head];
    this.put(x, y, z, bedId(f, false));
    this.put(x + d[0], y, z + d[1], bedId(f, true));
  }
  rail(x, y, z, axis, how = 0) { this.put(x, y, z, RAIL_ID.rail[0][this.axis(axis) === 'z' ? 0 : 1], how); }
  // A log standing ('y') or lying along local x or z.
  log(x, y, z, axis, wood = 'oak', how = 0) {
    const id = WOOD[wood].log, axes = LOG_AXES[id];
    this.put(x, y, z, axis === 'y' || !axes ? id : axes[this.axis(axis) === 'x' ? 0 : 1], how);
  }
  trapdoor(x, y, z, wood, hinge, open, top = false) { this.put(x, y, z, trapdoorId(B[`${wood}_trapdoor`], this.f(hinge), top, open)); }
  // The world box [x0, z0, x1, z1] covering local [xa..xb] x [za..zb].
  span(xa, za, xb, zb) {
    const [ax, az] = this.at(xa, za), [bx, bz] = this.at(xb, zb);
    return [Math.min(ax, bx), Math.min(az, bz), Math.max(ax, bx), Math.max(az, bz)];
  }
}
// A frame over the box [x0..x1] x [z0..z1] of another, its front on that one's face `face`
// (drawn from the box's corner, as a lot is: see Lot in lots.js).
function boxFrame(parent, x0, z0, x1, z1, y, face) {
  const o = { 5: [x0, z0], 4: [x1, z1], 0: [x1, z0], 1: [x0, z1] }[face];
  return new Frame(null, o[0], y, o[1], face, 0, 0, parent);
}
const frameAt = (x, z, face, ox = 0, oz = 0) => new Frame(null, x, 0, z, face, ox, oz);

// ---------------------------------------------------------------- where they are
// Each kind: its regions' size, how far from its middle any block of one reaches, how many spots in
// a region are tried (a region that's mostly desert nearly always has its pyramid, one with a corner
// of desert seldom), and (mineshafts) how many regions have one at all. `land`: trees keep off.
const KINDS = {
  mineshaft: { size: 256, reach: 72, chance: 0.85, salt: 0x6d1e5a },
  pyramid: { size: 448, reach: 16, tries: 6, salt: 0x9e3a11, land: true },
  jungle_temple: { size: 448, reach: 16, tries: 6, salt: 0x7e3b91, land: true },
  igloo: { size: 384, reach: 12, tries: 6, salt: 0x1c10a3, land: true },
  shipwreck: { size: 320, reach: 18, tries: 5, salt: 0x5b1b3d, land: true },
  monument: { size: 512, reach: 36, tries: 4, salt: 0x3f00a1 },
};
// (What lies underground goes in first.)
const ORDER = ['mineshaft', 'stronghold', 'pyramid', 'jungle_temple', 'igloo', 'shipwreck', 'monument'];
const LAND = ORDER.filter((k) => KINDS[k]?.land);
// The kinds /locate knows, with the names it gives them.
export const STRUCTURE_NAMES = { pyramid: 'desert pyramid', jungle_temple: 'jungle temple', igloo: 'igloo', shipwreck: 'shipwreck',
  monument: 'ocean monument', mineshaft: 'mineshaft', stronghold: 'stronghold' };

// World, kind and region -> plan or null; the most recently used last.
const plans = new Map();
function cached(key, make) {
  if (plans.has(key)) {
    const p = plans.get(key);
    plans.delete(key); plans.set(key, p);
    return p;
  }
  const p = make();
  plans.set(key, p);
  if (plans.size > 600) plans.delete(plans.keys().next().value);
  return p;
}
const worldKey = (gen) => `${gen.seed}:${gen.type}:${gen.version}`;
const has = (gen) => gen.version >= 10 && gen.type !== 'flat';

// The structure of `kind` in region (rx, rz), or null.
function regionPlan(gen, kind, rx, rz) {
  return cached(`${worldKey(gen)}:${kind}:${rx},${rz}`, () => {
    const K = KINDS[kind];
    const rnd = mulberry32(Math.floor(hash2(rx, rz, gen.seed ^ K.salt) * 4294967296));
    if (K.chance !== undefined && rnd() >= K.chance) return null;
    const lo = K.reach + 8, span = K.size - 2 * lo;
    for (let t = 0; t < (K.tries ?? 1); t++) {
      const x = rx * K.size + lo + Math.floor(rnd() * span), z = rz * K.size + lo + Math.floor(rnd() * span);
      const p = PLAN[kind](gen, x, z, rnd);
      if (!p) continue;
      // (Kept inside its region, so no other region's chunks need ask about it.)
      const [x0, z0, x1, z1] = p.box, ax = rx * K.size, az = rz * K.size;
      if (x0 < ax || z0 < az || x1 >= ax + K.size || z1 >= az + K.size) continue;
      return Object.assign(p, { kind, key: `${kind}:${rx},${rz}`, seed: Math.floor(rnd() * 4294967296) });
    }
    return null;
  });
}

// Strongholds: three in a ring 640-1280 blocks from the middle of the world, six in the next ring
// out, ten in the next, and so on (as Minecraft has them, but closer in).
const RINGS = [3, 6, 10, 15, 21, 28, 36, 9];
const STRONG_REACH = 32;
const rings = new Map();
function strongholdPoints(gen) {
  const key = worldKey(gen);
  let pts = rings.get(key);
  if (!pts) {
    pts = [];
    const rnd = mulberry32(Math.floor(hash2(0x57, 0x7e, gen.seed ^ 0x5ea1) * 4294967296));
    let angle = rnd() * Math.PI * 2;
    RINGS.forEach((n, ring) => {
      for (let k = 0; k < n; k++) {
        const d = 640 + ring * 1536 + rnd() * 640, a = angle + (k / n) * Math.PI * 2 + (rnd() - 0.5) * 0.6;
        pts.push({ i: pts.length, x: Math.round(Math.cos(a) * d), z: Math.round(Math.sin(a) * d) });
      }
      angle += rnd() * Math.PI;
    });
    rings.set(key, pts);
  }
  return pts;
}

// Every structure reaching into chunk (cx, cz), in the order they go in (or those of `kinds`).
export function structuresIn(gen, cx, cz, kinds = ORDER) {
  if (!has(gen)) return [];
  const x0 = cx * 16, z0 = cz * 16, x1 = x0 + 15, z1 = z0 + 15, out = [];
  const overlaps = (b) => b[0] <= x1 && b[2] >= x0 && b[1] <= z1 && b[3] >= z0;
  for (const kind of kinds) {
    if (kind === 'stronghold') {
      for (const s of strongholdPoints(gen)) {
        if (s.x + STRONG_REACH < x0 || s.x - STRONG_REACH > x1 || s.z + STRONG_REACH < z0 || s.z - STRONG_REACH > z1) continue;
        const p = strongholdPlan(gen, s);
        if (overlaps(p.box)) out.push(p);
      }
      continue;
    }
    const size = KINDS[kind].size;
    for (let rz = Math.floor(z0 / size); rz <= Math.floor(z1 / size); rz++) {
      for (let rx = Math.floor(x0 / size); rx <= Math.floor(x1 / size); rx++) {
        const p = regionPlan(gen, kind, rx, rz);
        if (p && overlaps(p.box)) out.push(p);
      }
    }
  }
  return out;
}

// Every structure of `kind` in the regions over [x0..x1] x [z0..z1].
export function structuresInArea(gen, kind, x0, z0, x1, z1) {
  if (!has(gen)) return [];
  if (kind === 'stronghold') {
    return strongholdPoints(gen).filter((s) => s.x >= x0 && s.x <= x1 && s.z >= z0 && s.z <= z1).map((s) => strongholdPlan(gen, s));
  }
  const size = KINDS[kind].size, out = [];
  for (let rz = Math.floor(z0 / size); rz <= Math.floor(z1 / size); rz++) {
    for (let rx = Math.floor(x0 / size); rx <= Math.floor(x1 / size); rx++) {
      const p = regionPlan(gen, kind, rx, rz);
      if (p) out.push(p);
    }
  }
  return out;
}

// The building on land (pyramid, temple, igloo, shipwreck) standing on (x, z), give or take
// `margin`, or null: trees don't grow there.
export function landStructureAt(gen, x, z, margin = 0) {
  if (!has(gen)) return null;
  for (const kind of LAND) {
    const size = KINDS[kind].size, p = regionPlan(gen, kind, Math.floor(x / size), Math.floor(z / size));
    if (p && x >= p.box[0] - margin && x <= p.box[2] + margin && z >= p.box[1] - margin && z <= p.box[3] + margin) return p;
  }
  return null;
}

// The ocean monument whose walls (x, y, z) is inside, or null (guardians live there).
export function monumentAt(gen, x, y, z) {
  if (!has(gen)) return null;
  const size = KINDS.monument.size, p = regionPlan(gen, 'monument', Math.floor(x / size), Math.floor(z / size));
  if (!p || x < p.box[0] || x > p.box[2] || z < p.box[1] || z > p.box[3] || y < p.y - 1 || y > p.y + 23) return null;
  return p;
}

// The nearest structure of `kind` to (x, z), or null (for /locate). Regions are searched outwards,
// ring by ring, until none nearer than the best found can be left.
export function nearestStructure(gen, kind, x, z, regions = 8) {
  if (!has(gen)) return null;
  let best = null, bd = Infinity;
  const consider = (p) => {
    if (!p) return;
    const d = Math.hypot(p.x - x, p.z - z);
    if (d < bd) { bd = d; best = p; }
  };
  if (kind === 'stronghold') {
    const near = [...strongholdPoints(gen)].sort((a, b) => Math.hypot(a.x - x, a.z - z) - Math.hypot(b.x - x, b.z - z));
    return near.length ? strongholdPlan(gen, near[0]) : null;
  }
  const size = KINDS[kind].size, rx0 = Math.floor(x / size), rz0 = Math.floor(z / size);
  for (let r = 0; r <= regions; r++) {
    if (best && bd < (r - 1) * size) break;
    for (let rz = rz0 - r; rz <= rz0 + r; rz++) {
      for (let rx = rx0 - r; rx <= rx0 + r; rx++) {
        if (Math.max(Math.abs(rx - rx0), Math.abs(rz - rz0)) === r) consider(regionPlan(gen, kind, rx, rz));
      }
    }
  }
  return best;
}

// ---------------------------------------------------------------- drawing
// The blueprints drawn lately (the rest are dropped, and worked out again if they're needed).
const drawn = new Map();
function blueprint(gen, p) {
  if (!p.plot) {
    const plot = new Plot();
    BUILD[p.kind](gen, p, plot, mulberry32(p.seed));
    p.plot = plot.seal();
  }
  drawn.delete(p); drawn.set(p, true);
  if (drawn.size > 16) {
    const old = drawn.keys().next().value;
    drawn.delete(old); old.plot = null;
  }
  return p.plot;
}

// Writes the blocks of every structure reaching into chunk (cx, cz) into its `blocks`.
export function drawStructures(gen, cx, cz, blocks) {
  const key = chunkKey(cx, cz);
  for (const p of structuresIn(gen, cx, cz)) {
    const list = blueprint(gen, p).chunks.get(key);
    if (!list) continue;
    for (let i = 0; i < list.length; i++) {
      const v = list[i], pos = v & 0xffff, op = v >>> 16, id = op & 0xfff, cur = blocks[pos];
      if (op & 0xf000) {
        if ((op & FILL) && cur !== 0 && !WATERLIKE[cur] && !SOFT_IDS[cur]) continue;
        if ((op & DRY) && WATERLIKE[cur]) continue;
        if ((op & SOFT) && !SOFT_IDS[cur]) continue;
        if ((op & HUNG) && !hangs(blocks, pos, id)) continue;
      }
      blocks[pos] = id;
    }
  }
}
// Whether the block a wall torch would hang on (in this chunk) is solid.
function hangs(blocks, pos, id) {
  const lean = TORCH_LEAN[id];
  if (lean === undefined || lean < 0) return true;
  const x = pos & 15, z = (pos >> 4) & 15, y = pos >> 8, d = STEP[lean], nx = x - d[0], nz = z - d[1];
  if (nx < 0 || nx > 15 || nz < 0 || nz > 15) return false;
  return !!SOLID[blocks[(y << 8) | (nz << 4) | nx]];
}

// ---------------------------------------------------------------- the land under them
// Heights and biomes of the ground over local [xa..xb] x [za..zb] of a frame, every `step` blocks.
function survey(gen, g, xa, za, xb, zb, step) {
  const out = [];
  for (let z = za; z <= zb; z += step) {
    for (let x = xa; x <= xb; x += step) {
      const [wx, wz] = g.at(Math.min(x, xb), Math.min(z, zb));
      out.push(gen.sample(wx, wz));
    }
  }
  return out;
}
const median = (list) => { const s = [...list].sort((a, b) => a - b); return s[s.length >> 1]; };

// ---------------------------------------------------------------- desert pyramid
// A stepped pyramid of sandstone 21 blocks across, with a tower at each front corner, a hall inside
// with a pattern of orange and blue terracotta in its floor - and under the blue, a shaft down to a
// buried room with four chests round a pressure plate. Under the plate: TNT.
function planPyramid(gen, x, z, rnd) {
  if (gen.sample(x, z).biome !== BIOME.DESERT) return null;
  const face = pick(rnd, FACES), g = frameAt(x, z, face, -10, -10);
  const land = survey(gen, g, 0, 0, 20, 20, 5);
  if (land.some((s) => s.biome !== BIOME.DESERT || s.height <= SEA_LEVEL + 1)) return null;
  const hs = land.map((s) => s.height);
  if (Math.max(...hs) - Math.min(...hs) > 8 || villageAt(gen, x, z, 32)) return null;
  return { x, z, y: median(hs), face, box: g.span(0, -4, 20, 20) };
}
function buildPyramid(gen, p, plot) {
  const g = new Frame(plot, p.x, p.y, p.z, p.face, -10, -10);
  const S = 'sandstone', CUT = 'cut_sandstone', CH = 'chiseled_sandstone', OR = 'orange_terracotta', BL = 'blue_terracotta';
  // The plants over it cleared, and its foundations reaching down to solid ground.
  for (let z = -3; z <= 20; z++) {
    for (let x = 0; x <= 20; x++) {
      for (let y = 1; y <= 13; y++) g.put(x, y, z, 0, SOFT);
      if (z < 0) continue;
      g.fill(x, -4, z, x, 0, z, S);
      for (let y = -5; y >= -12; y--) g.put(x, y, z, S, FILL);
    }
  }
  // Nine steps up to a point.
  for (let i = 1; i <= 9; i++) g.fill(i, i, i, 20 - i, i, 20 - i, S);
  g.put(10, 10, 10, CH);
  // The hall: pillars, niches of terracotta, and the pattern in the floor.
  g.fill(5, 1, 5, 15, 4, 15, 0);
  for (let s = 5; s <= 15; s++) { g.put(s, 5, 5, CUT); g.put(s, 5, 15, CUT); g.put(5, 5, s, CUT); g.put(15, 5, s, CUT); g.put(s, 0, 5, CUT); g.put(s, 0, 15, CUT); g.put(5, 0, s, CUT); g.put(15, 0, s, CUT); }
  for (const [x, z] of [[7, 7], [13, 7], [7, 13], [13, 13]]) { g.put(x, 1, z, CH); g.fill(x, 2, z, x, 3, z, CUT); g.put(x, 4, z, CH); }
  for (const [x, z] of [[4, 10], [16, 10], [10, 16]]) { g.put(x, 2, z, OR); g.put(x, 3, z, CH); }
  for (let dz = -2; dz <= 2; dz++) {
    for (let dx = -2; dx <= 2; dx++) {
      const d = Math.abs(dx) + Math.abs(dz);
      g.put(10 + dx, 0, 10 + dz, [BL, OR, CUT, OR, CUT][d]);
    }
  }
  // The gatehouse at the front, and the way in through it.
  g.fill(8, 1, 0, 12, 5, 4, S);
  g.fill(9, 1, 0, 11, 3, 4, 0);
  g.fill(8, 4, 0, 12, 4, 0, CUT);
  g.put(8, 5, 0, CH); g.put(10, 4, 0, OR); g.put(10, 5, 0, CH); g.put(12, 5, 0, CH);
  g.put(8, 1, 0, CUT); g.put(8, 2, 0, CH); g.put(8, 3, 0, CUT); g.put(12, 1, 0, CUT); g.put(12, 2, 0, CH); g.put(12, 3, 0, CUT);
  g.fill(9, 1, -3, 11, 3, -1, 0);
  for (let z = -3; z <= -1; z++) for (let x = 9; x <= 11; x++) for (let y = 0; y >= -3; y--) g.put(x, y, z, S, FILL);
  // The towers: hollow, with a ladder up to a hatch in the top, and faces of terracotta.
  const faceRows = [[2, [CUT, CUT, CUT]], [3, [S, OR, S]], [4, [OR, OR, OR]], [5, [OR, BL, OR]], [6, [OR, OR, OR]], [7, [S, OR, S]], [8, [CUT, CUT, CUT]]];
  for (const tx of [0, 16]) {
    g.fill(tx, 1, 0, tx + 4, 10, 4, S);
    g.fill(tx + 1, 1, 1, tx + 3, 9, 3, 0);
    g.fill(tx + 1, 10, 1, tx + 3, 10, 3, CUT);
    g.stairs(tx + 2, 10, 0, 'sandstone', 4); g.stairs(tx + 2, 10, 4, 'sandstone', 5);
    g.stairs(tx, 10, 2, 'sandstone', 0); g.stairs(tx + 4, 10, 2, 'sandstone', 1);
    for (const [y, row] of faceRows) row.forEach((id, k) => g.put(tx + 1 + k, y, 0, id));
    g.ladder(tx + 2, 1, 9, 1, 5);
    g.trapdoor(tx + 2, 10, 1, 'oak', 5, true, true);
    // (A passage from the hall.)
    const ix = tx === 0 ? 2 : 18;
    g.fill(Math.min(ix, tx === 0 ? 4 : 16), 1, 6, Math.max(ix, tx === 0 ? 4 : 16), 2, 6, 0);
    g.fill(ix, 1, 4, ix, 2, 5, 0);
  }
  // The treasure room, twelve blocks down, and the shaft to it under the blue terracotta.
  g.fill(6, -16, 6, 14, -9, 14, CUT);
  g.fill(6, -16, 6, 14, -14, 14, S);
  g.fill(7, -13, 7, 13, -10, 13, 0);
  for (let y = -9; y <= -1; y++) g.put(10, y, 10, 0);
  g.fill(9, -15, 9, 11, -15, 11, 'tnt');
  g.put(10, -13, 10, 'stone_pressure_plate');
  for (const [x, z, front] of [[10, 6, 4], [10, 14, 5], [6, 10, 0], [14, 10, 1]]) {
    g.chest(x, -13, z, 'pyramid', front);
    g.put(x, -12, z, CH); g.put(x, -11, z, OR);
  }
  for (const [x, z] of [[7, 7], [13, 7], [7, 13], [13, 13]]) { g.put(x, -13, z, CH); g.fill(x, -12, z, x, -11, z, OR); g.put(x, -10, z, CH); }
}

// ---------------------------------------------------------------- jungle temple
// A temple of mossy cobblestone, three storeys deep in the jungle. Down in the cellar, a tripwire
// across the passage to one chest sets off a dispenser of arrows; the other chest is shut in a vault
// behind an iron door, opened by one of three levers.
function planTemple(gen, x, z, rnd) {
  if (!JUNGLES.has(gen.sample(x, z).biome)) return null;
  const face = pick(rnd, FACES), g = frameAt(x, z, face, -6, -7);
  const land = survey(gen, g, 0, 0, 11, 14, 4);
  if (land.some((s) => !JUNGLES.has(s.biome) || s.height <= SEA_LEVEL + 1)) return null;
  const hs = land.map((s) => s.height);
  if (Math.max(...hs) - Math.min(...hs) > 10 || villageAt(gen, x, z, 32)) return null;
  return { x, z, y: median(hs), face, box: g.span(-1, -2, 12, 15) };
}
function buildTemple(gen, p, plot, rnd) {
  const g = new Frame(plot, p.x, p.y, p.z, p.face, -6, -7);
  const stone = () => (rnd() < 0.45 ? 'mossy_cobblestone' : 'cobblestone');
  const mass = (x0, y0, z0, x1, y1, z1) => {
    for (let y = y0; y <= y1; y++) for (let z = z0; z <= z1; z++) for (let x = x0; x <= x1; x++) g.put(x, y, z, stone());
  };
  for (let z = -2; z <= 15; z++) for (let x = -1; x <= 12; x++) for (let y = 1; y <= 14; y++) g.put(x, y, z, 0, SOFT);
  for (let z = 0; z <= 14; z++) for (let x = 0; x <= 11; x++) for (let y = -5; y >= -12; y--) g.put(x, y, z, stone(), FILL);
  // The body - cellar and ground floor in one block of stone - the upper storey and the roof.
  mass(0, -4, 0, 11, 4, 14);
  mass(1, 5, 2, 10, 8, 12);
  mass(2, 9, 3, 9, 9, 11);
  mass(3, 10, 4, 8, 10, 10);
  g.fill(4, 11, 5, 7, 11, 9, 'cobblestone_slab');
  // The ground floor: a hall of pillars, and behind it the stairs up and down.
  g.fill(1, 1, 1, 10, 3, 9, 0);
  g.fill(1, 1, 11, 10, 3, 13, 0);
  g.fill(5, 1, 10, 6, 2, 10, 0);
  g.fill(5, 1, 0, 6, 3, 0, 0);
  for (const [x, z] of [[3, 3], [8, 3], [3, 7], [8, 7]]) { g.put(x, 1, z, stone()); g.put(x, 2, z, 'chiseled_stone_bricks'); g.put(x, 3, z, stone()); }
  g.put(5, 3, 10, 'chiseled_stone_bricks'); g.put(6, 3, 10, 'chiseled_stone_bricks');
  for (let k = 0; k < 4; k++) g.stairs(9 - k, 1 + k, 11, 'cobblestone', 1);
  g.fill(7, 4, 11, 9, 4, 11, 0);
  g.fill(3, 0, 12, 4, 0, 12, 0);
  g.fill(2, -2, 12, 4, -1, 12, 0);
  for (let k = 0; k < 4; k++) g.stairs(5 - k, -k, 12, 'cobblestone', 0);
  // The upper storey, with windows and a door out onto the terrace over the front.
  g.fill(2, 5, 3, 9, 7, 11, 0);
  for (const z of [5, 9]) { g.put(1, 6, z, 0); g.put(10, 6, z, 0); }
  g.put(3, 6, 2, 0); g.put(8, 6, 2, 0);
  g.fill(5, 5, 2, 6, 6, 2, 0);
  g.put(5, 6, 12, 'chiseled_stone_bricks'); g.put(6, 6, 12, 'chiseled_stone_bricks');
  for (let x = 0; x <= 11; x += 2) g.put(x, 5, 0, x % 4 ? 'mossy_cobblestone_wall' : 'cobblestone_wall');
  g.put(11, 5, 0, 'cobblestone_wall'); g.put(0, 5, 14, 'cobblestone_wall'); g.put(11, 5, 14, 'cobblestone_wall');
  // The cellar. A passage down the left side to the first chest, with the tripwire across it and a
  // dispenser in the wall over one hook, hidden behind vines.
  g.fill(2, -3, 2, 3, -1, 11, 0);
  g.hook(1, -3, 6, 1); g.hook(4, -3, 6, 0);
  g.wire(2, -3, 6, 'x'); g.wire(3, -3, 6, 'x');
  g.dispenser(1, -2, 6, 0);
  g.vine(2, -2, 6, 1);
  g.chest(2, -3, 2, 'jungle_temple', 4);
  g.put(3, -3, 2, 'chiseled_stone_bricks');
  // A way through to the lever room, and the vault beyond its iron door.
  g.fill(4, -3, 10, 5, -2, 10, 0);
  g.fill(6, -3, 7, 10, -1, 10, 0);
  g.fill(6, -3, 2, 10, -1, 5, 0);
  g.door(8, -3, 6, 4, true);
  g.put(8, -1, 6, 'chiseled_stone_bricks');
  // (Only the lever beside the door opens it: the others are fixed to blocks too far from it.)
  for (const x of [6, rnd() < 0.5 ? 7 : 9, 10]) g.lever(x, -2, 7, 5);
  g.chest(8, -3, 2, 'jungle_temple', 4);
  g.put(7, -2, 1, 'chiseled_stone_bricks'); g.put(9, -2, 1, 'chiseled_stone_bricks');
  // Vines over the outside.
  const vines = (x, y, z, side) => { if (rnd() < 0.3) g.vine(x, y, z, side, FILL); };
  for (let y = 1; y <= 4; y++) {
    for (let x = 0; x <= 11; x++) { if (!(y <= 3 && (x === 5 || x === 6))) vines(x, y, -1, 4); vines(x, y, 15, 5); }
    for (let z = 0; z <= 14; z++) { vines(-1, y, z, 0); vines(12, y, z, 1); }
  }
  for (let y = 5; y <= 8; y++) {
    for (let z = 2; z <= 12; z++) { if (!(y === 6 && (z === 5 || z === 9))) { vines(0, y, z, 0); vines(11, y, z, 1); } }
    for (let x = 1; x <= 10; x++) vines(x, y, 13, 5);
  }
}

// ---------------------------------------------------------------- igloo
// A dome of snow in the snowy plains: a bed, a crafting table, a furnace and a lantern inside. Half
// of them have a trapdoor under the carpet, and a ladder down to a cellar of stone bricks with a
// chest, a cauldron and two cells behind iron bars.
function planIgloo(gen, x, z, rnd) {
  if (!SNOWY.has(gen.sample(x, z).biome)) return null;
  const face = pick(rnd, FACES), g = frameAt(x, z, face);
  const land = survey(gen, g, -4, -5, 4, 4, 4);
  if (land.some((s) => !SNOWY.has(s.biome) || s.height <= SEA_LEVEL + 1)) return null;
  const hs = land.map((s) => s.height);
  if (Math.max(...hs) - Math.min(...hs) > 2 || villageAt(gen, x, z, 24)) return null;
  const cellar = rnd() < 0.5;
  return { x, z, y: gen.sample(x, z).height, face, cellar, depth: 3 + Math.floor(rnd() * 6), box: g.span(-4, -6, 4, cellar ? 8 : 4) };
}
function buildIgloo(gen, p, plot, rnd) {
  const g = new Frame(plot, p.x, p.y, p.z, p.face);
  for (let z = -6; z <= 4; z++) for (let x = -4; x <= 4; x++) for (let y = 1; y <= 6; y++) g.put(x, y, z, 0, SOFT);
  // The dome: walls two high round a room five across, a ring above and a cap of three by three.
  for (let z = -3; z <= 3; z++) {
    for (let x = -3; x <= 3; x++) {
      const d = Math.hypot(x, z);
      if (d >= 3.7) continue;
      g.put(x, 0, z, 'snow_block');
      for (let y = -1; y >= -6; y--) g.put(x, y, z, 'snow_block', FILL);
      for (let y = 1; y <= 2; y++) g.put(x, y, z, d >= 2.5 ? 'snow_block' : 0);
      if (d < 1.9) g.put(x, 3, z, 0); else if (d < 2.9) g.put(x, 3, z, 'snow_block');
      if (d < 1.5) g.put(x, 4, z, 'snow_block');
    }
  }
  // The way in: a short tunnel at the front.
  for (let z = -5; z <= -3; z++) {
    for (let x = -1; x <= 1; x++) {
      g.put(x, 0, z, 'snow_block');
      for (let y = -1; y >= -4; y--) g.put(x, y, z, 'snow_block', FILL);
      g.put(x, 3, z, 'snow_block');
      for (let y = 1; y <= 2; y++) g.put(x, y, z, x ? 'snow_block' : 0);
    }
  }
  g.put(-3, 2, 0, 'ice'); g.put(3, 2, 0, 'ice');
  // Inside.
  g.bed(-2, 1, 0, 4);
  g.put(-1, 1, 2, 'crafting_table');
  g.facing('furnace', 1, 1, 2, 5);
  g.put(0, 3, 0, 'lantern_hanging');
  const used = new Set(['-2,0', '-2,1', '-1,2', '1,2']);
  for (let z = -2; z <= 2; z++) for (let x = -2; x <= 2; x++) if (Math.hypot(x, z) < 2.5 && !used.has(`${x},${z}`)) g.put(x, 1, z, 'white_carpet');
  if (!p.cellar) return;
  // The cellar: a shaft with a ladder from a trapdoor hidden under the carpet.
  const yb = -(p.depth + 4);
  g.trapdoor(1, 0, 0, 'spruce', 4, false, true);
  for (let y = yb + 1; y <= -1; y++) {
    if (y >= yb + 4) { g.put(0, y, 0, 'stone_bricks'); g.put(2, y, 0, 'stone_bricks'); g.put(1, y, 1, 'stone_bricks'); }
    g.put(1, y, -1, 'stone_bricks');
  }
  const brick = () => { const r = rnd(); return r < 0.15 ? 'mossy_stone_bricks' : r < 0.25 ? 'cracked_stone_bricks' : 'stone_bricks'; };
  for (let y = yb; y <= yb + 4; y++) {
    for (let z = -1; z <= 7; z++) {
      for (let x = -3; x <= 3; x++) {
        const wall = y === yb || y === yb + 4 || x === -3 || x === 3 || z === -1 || z === 7;
        g.put(x, y, z, wall ? brick() : 0);
      }
    }
  }
  g.ladder(1, yb + 1, -1, 0, 5);
  g.put(-2, yb + 1, 1, 'water_cauldron');
  g.chest(-2, yb + 1, 2, 'igloo', 0);
  g.put(-2, yb + 1, 3, 'crafting_table');
  g.torch(0, yb + 3, 0, 4);
  g.torch(0, yb + 3, 6, 5);
  // Two cells at the back, barred.
  for (let y = yb + 1; y <= yb + 3; y++) {
    for (const x of [-2, -1, 1, 2]) g.put(x, y, 4, 'iron_bars');
    g.fill(0, y, 4, 0, y, 6, 'stone_bricks');
  }
  g.put(-2, yb + 3, 6, 'cobweb'); g.put(2, yb + 1, 6, 'cobweb');
}

// ---------------------------------------------------------------- shipwreck
// An old wooden ship on the sea floor (or run aground on a beach): a keel, a hull with holds fore
// and aft, a deck with a cabin at the stern and a mast. Some lie upside down or on their sides, and
// some are only a bow or a stern. One chest of supplies, one of treasure, one of maps.
const HULL = [0, 2, 3, 3, 3]; // half the hull's width, keel to deck
function hullHalf(y, z, len) {
  const bow = Math.floor((len - 1 - z + Math.floor(y / 2) + 1) / 2);
  return Math.min(HULL[y], bow, z === 0 ? HULL[y] - 1 : HULL[y]);
}
function planShipwreck(gen, x, z, rnd) {
  const s = gen.sample(x, z), beach = BEACHES.has(s.biome);
  if (!beach && !(OCEANS.has(s.biome) && s.height <= SEA_LEVEL - 6)) return null;
  const face = pick(rnd, FACES), len = 20 + Math.floor(rnd() * 7), g = frameAt(x, z, face, 0, -(len >> 1));
  const land = survey(gen, g, -3, 0, 3, len - 1, 6);
  if (land.some((q) => beach ? !BEACHES.has(q.biome) && !OCEANS.has(q.biome) : !OCEANS.has(q.biome))) return null;
  const hs = land.map((q) => q.height), low = Math.min(...hs);
  if (Math.max(...hs) - low > 5 || villageAt(gen, x, z, 24)) return null;
  // (Not in an ocean monument's way.)
  const size = KINDS.monument.size, m = regionPlan(gen, 'monument', Math.floor(x / size), Math.floor(z / size));
  if (m && x > m.box[0] - 24 && x < m.box[2] + 24 && z > m.box[1] - 24 && z < m.box[3] + 24) return null;
  const variant = beach ? pick(rnd, ['upright', 'upright', 'front', 'back']) : pick(rnd, ['upright', 'upright', 'upside_down', 'sideways', 'front', 'back']);
  const wood = pick(rnd, ['oak', 'spruce', 'dark_oak', 'birch', 'jungle', 'acacia']);
  const y = low - (beach ? 2 : variant === 'upside_down' ? 3 : 1);
  const box = variant === 'sideways' ? g.span(-5, -1, 9, len + 2) : g.span(-4, -1, 4, len + 2);
  return { x, z, y, face, len, variant, wood, beach, box };
}
function buildShipwreck(gen, p, plot, rnd) {
  const g = new Frame(plot, p.x, p.y, p.z, p.face, 0, -(p.len >> 1));
  const L = p.len, D = 4, planks = `${p.wood}_planks`, fence = WOOD[p.wood].fence;
  const cut = L >> 1, jag = () => Math.floor(rnd() * 3) - 1;
  const cuts = Array.from({ length: 16 }, jag);
  const kept = (x, y, z) => p.variant === 'front' ? z >= cut + cuts[(x + y + 8) & 15] : p.variant === 'back' ? z <= cut + cuts[(x + y + 8) & 15] : true;
  // The ship's own coordinates (x across, y up from the keel, z from the stern) to the frame's.
  const to = (x, y, z) => (p.variant === 'upside_down' ? [x, 8 - y, z] : p.variant === 'sideways' ? [y - 4, x + 3, z] : [x, y, z]);
  const wet = (fy) => p.y + fy <= SEA_LEVEL;
  const put = (x, y, z, id, how = 0) => {
    if (!kept(x, y, z)) return;
    const [fx, fy, fz] = to(x, y, z);
    g.put(fx, fy, fz, id === 0 ? (wet(fy) ? B.water : 0) : id, how);
  };
  const log = (x, y, z, axis) => {
    if (!kept(x, y, z)) return;
    const [fx, fy, fz] = to(x, y, z);
    g.log(fx, fy, fz, p.variant === 'sideways' && axis !== 'z' ? (axis === 'y' ? 'x' : 'y') : axis, p.wood);
  };
  const inside = (x, y, z) => y >= 0 && y <= D && z >= 0 && z < L && Math.abs(x) <= hullHalf(y, z, L);
  // The hull, its holds (full of the sea), the keel and the deck.
  for (let z = 0; z < L; z++) {
    for (let y = 0; y <= D; y++) {
      const hw = hullHalf(y, z, L);
      for (let x = -hw; x <= hw; x++) {
        if (y === 0) { log(x, 0, z, 'z'); continue; }
        if (y === D) { if (Math.abs(x) === hw || rnd() > 0.2) put(x, y, z, planks); else put(x, y, z, 0); continue; }
        const shell = !inside(x - 1, y, z) || !inside(x + 1, y, z) || !inside(x, y - 1, z) || !inside(x, y, z - 1) || !inside(x, y, z + 1);
        if (!shell) put(x, y, z, 0);
        else if (rnd() > 0.1) put(x, y, z, planks);
      }
    }
  }
  put(0, 1, L - 6, lootChestId('shipwreck_supply', g.f(5)));
  put(0, 1, 3, lootChestId('shipwreck_treasure', g.f(4)));
  // The cabin at the stern, with the map chest.
  for (let y = D + 1; y <= D + 4; y++) {
    for (let z = 0; z <= 5; z++) {
      const hw = hullHalf(D, z, L);
      for (let x = -hw; x <= hw; x++) {
        const wall = y === D + 4 || Math.abs(x) === hw || z === 0 || z === 5;
        const window = y === D + 2 && ((Math.abs(x) === hw && (z === 2 || z === 3)) || (z === 0 && x === 0));
        const door = z === 5 && x === 0 && y <= D + 2;
        put(x, y, z, wall && !window && !door ? (y === D + 4 && rnd() < 0.15 ? 0 : planks) : 0);
      }
    }
  }
  put(-2, D + 1, 1, lootChestId('shipwreck_map', g.f(0)));
  // Rails along the deck (not on a ship lying on its side or upside down).
  if (p.variant !== 'sideways' && p.variant !== 'upside_down') {
    for (let z = 6; z < L; z++) {
      const hw = hullHalf(D, z, L);
      if (hw < 1) continue;
      for (const x of [-hw, hw]) if (rnd() < 0.75) put(x, D + 1, z, fence);
    }
  }
  // The mast (broken off, on some), its yard, and the bowsprit.
  const mz = Math.floor(L * 0.55), tall = rnd() < 0.4 ? 2 + Math.floor(rnd() * 2) : 6 + Math.floor(rnd() * 3);
  for (let y = 1; y <= D + tall; y++) log(0, y, mz, 'y');
  if (tall >= 6) for (let x = -3; x <= 3; x++) if (x) log(x, D + tall - 1, mz, 'x');
  log(0, D, L, 'z');
  log(0, D + 1, L + 1, 'z');
}

// ---------------------------------------------------------------- ocean monument
// A temple of prismarine 58 blocks across on the floor of the deep ocean, lit by sea lanterns: a
// hall of nine rooms behind a great open gateway, a tier above it and a crown above that, and a wing
// either side. At its heart, eight blocks of gold shut in dark prismarine; in one room, sponges
// soaked through. Three elder guardians keep it (one in the crown, one in each wing).
function planMonument(gen, x, z, rnd) {
  if (!DEEP.has(gen.sample(x, z).biome)) return null;
  const face = pick(rnd, FACES), g = frameAt(x, z, face, -29, -29);
  const land = survey(gen, g, 0, 0, 57, 57, 8);
  if (land.some((s) => !DEEP.has(s.biome) || s.height > SEA_LEVEL - 18)) return null;
  if (land.filter((s) => s.height <= SEA_LEVEL - 22).length < land.length * 0.75) return null;
  const y = SEA_LEVEL - 24;
  const elders = [[28.5, 15, 31.5], [7.5, 9, 32.5], [49.5, 9, 32.5]].map(([ex, ey, ez]) => {
    const [wx, wz] = g.at(Math.floor(ex), Math.floor(ez));
    return [wx + 0.5, y + ey, wz + 0.5];
  });
  return { x, z, y, face, elders, box: g.span(0, 0, 57, 57) };
}
function buildMonument(gen, p, plot, rnd) {
  const g = new Frame(plot, p.x, p.y, p.z, p.face, -29, -29);
  const W = B.water, PR = 'prismarine', PB = 'prismarine_bricks', DP = 'dark_prismarine', SL = 'sea_lantern';
  const wall = () => (rnd() < 0.8 ? PR : PB);
  // A building of it: walls and roof round water, standing on `floor` (null: what's there). The walls
  // have pilasters of dark prismarine every eight blocks and bands of bricks along their foot and
  // top; `crest`: a crenellated edge round the roof.
  const shell = (x0, y0, z0, x1, y1, z1, floor, crest = false) => {
    for (let y = y0; y <= y1; y++) {
      for (let z = z0; z <= z1; z++) {
        for (let x = x0; x <= x1; x++) {
          const ex = x === x0 || x === x1, ez = z === z0 || z === z1;
          if (y === y0) { if (floor) g.put(x, y, z, floor); continue; }
          if (y === y1) g.put(x, y, z, ex || ez ? DP : PB);
          else if (ex && ez) g.put(x, y, z, DP);
          else if (ex || ez) g.put(x, y, z, ((ez ? x - x0 : z - z0) % 8 === 0) ? DP : y === y0 + 1 || y === y1 - 1 ? PB : wall());
          else g.put(x, y, z, W);
        }
      }
    }
    if (crest) {
      for (let x = x0; x <= x1; x += 2) { g.put(x, y1 + 1, z0, PB); g.put(x, y1 + 1, z1, PB); }
      for (let z = z0; z <= z1; z += 2) { g.put(x0, y1 + 1, z, PB); g.put(x1, y1 + 1, z, PB); }
    }
    // Sea lanterns along the eaves.
    for (let x = x0 + 4; x <= x1 - 4; x += 8) { g.put(x, y1, z0, SL); g.put(x, y1, z1, SL); }
    for (let z = z0 + 4; z <= z1 - 4; z += 8) { g.put(x0, y1, z, SL); g.put(x1, y1, z, SL); }
    for (const [x, z] of [[x0, z0], [x1, z0], [x0, z1], [x1, z1]]) g.put(x, y1, z, SL);
  };
  // Windows: gaps in the walls every eight blocks.
  const windows = (x0, z0, x1, z1, ya, yb) => {
    for (let s = 3; s < 60; s += 8) {
      for (let y = ya; y <= yb; y++) {
        for (const k of [s, s + 1]) {
          if (x0 + k < x1 - 1) { g.put(x0 + k, y, z0, W); g.put(x0 + k, y, z1, W); }
          if (z0 + k < z1 - 1) { g.put(x0, y, z0 + k, W); g.put(x1, y, z0 + k, W); }
        }
      }
    }
  };
  const pillar = (x, z, y0, y1) => { for (let y = y0; y <= y1; y++) for (const [a, b] of [[0, 0], [1, 0], [0, 1], [1, 1]]) g.put(x + a, y, z + b, y === ((y0 + y1) >> 1) ? SL : PB); };
  // Legs down to the sea floor.
  for (let s = 0; s <= 56; s += 7) {
    for (const [x, z] of [[s, 0], [s, 56], [0, s], [56, s]]) {
      for (let y = -1; y >= -16; y--) for (const [a, b] of [[0, 0], [1, 0], [0, 1], [1, 1]]) g.put(x + a, y, z + b, PB, FILL);
    }
  }
  // The hall: nine rooms, the middle one at the heart of it all.
  shell(0, 0, 0, 57, 7, 57, PB, true);
  windows(0, 0, 57, 57, 3, 4);
  for (let y = 1; y <= 6; y++) {
    for (let s = 1; s <= 56; s++) { g.put(19, y, s, PB); g.put(38, y, s, PB); g.put(s, y, 19, PB); g.put(s, y, 38, PB); }
  }
  // (Doorways four wide through each wall between rooms.)
  for (const c of [9, 28, 47]) {
    for (let y = 1; y <= 4; y++) {
      for (let k = c - 2; k <= c + 1; k++) { g.put(19, y, k, W); g.put(38, y, k, W); g.put(k, y, 19, W); g.put(k, y, 38, W); }
    }
  }
  // The gateway at the front.
  for (let y = 1; y <= 6; y++) { g.put(23, y, 0, DP); g.put(34, y, 0, DP); }
  for (let x = 23; x <= 34; x++) g.put(x, 6, 0, DP);
  g.fill(24, 1, 0, 33, 5, 0, W);
  g.put(24, 7, 0, SL); g.put(33, 7, 0, SL);
  // The rooms. One of them is full of soaked sponges.
  const rooms = [];
  for (const j of [0, 1, 2]) for (const i of [0, 1, 2]) if (!(i === 1 && j === 1)) rooms.push([i, j]);
  const others = rooms.filter(([i, j]) => !(i === 1 && j === 0));
  const sponge = pick(rnd, others);
  for (const [i, j] of rooms) {
    const x0 = 1 + i * 19, z0 = 1 + j * 19, x1 = x0 + 17, z1 = z0 + 17;
    if (i === sponge[0] && j === sponge[1]) {
      for (let z = z0; z <= z1; z++) for (let x = x0; x <= x1; x++) if (rnd() < 0.4) g.put(x, 6, z, 'wet_sponge');
      continue;
    }
    const style = i === 1 && j === 0 ? 'pillars' : pick(rnd, ['pillars', 'lanterns', 'pillars', 'plain']);
    if (style === 'pillars') for (const [a, b] of [[4, 4], [12, 4], [4, 12], [12, 12]]) pillar(x0 + a, z0 + b, 1, 6);
    else if (style === 'lanterns') for (const a of [4, 8, 13]) for (const b of [4, 8, 13]) g.put(x0 + a, 0, z0 + b, SL);
  }
  // The heart: gold in a block of dark prismarine, with lanterns at the corners of the room.
  g.fill(27, 1, 27, 30, 4, 30, DP);
  g.fill(28, 2, 28, 29, 3, 29, 'gold_block');
  g.fill(28, 5, 28, 29, 5, 29, SL);
  for (const [x, z] of [[21, 21], [36, 21], [21, 36], [36, 36]]) { g.put(x, 1, z, SL); g.fill(x, 2, z, x, 5, z, PB); g.put(x, 6, z, SL); }
  // The tier over the middle, and ways up into it.
  shell(16, 7, 12, 41, 13, 49, null);
  windows(16, 12, 41, 49, 10, 11);
  g.fill(27, 7, 14, 30, 7, 15, W);
  g.fill(27, 7, 46, 30, 7, 47, W);
  for (const [x, z] of [[19, 16], [36, 16], [19, 44], [36, 44]]) pillar(x, z, 8, 12);
  // The crown, with its spires.
  shell(21, 13, 22, 36, 19, 41, null);
  windows(21, 22, 36, 41, 16, 16);
  g.fill(27, 13, 24, 30, 13, 25, W);
  g.fill(25, 20, 28, 32, 20, 35, DP);
  g.fill(28, 20, 31, 29, 20, 32, SL);
  for (const [x, z] of [[21, 22], [36, 22], [21, 41], [36, 41]]) { g.fill(x, 20, z, x, 21, z, PB); g.put(x, 22, z, SL); }
  // The wings, with stepped roofs.
  for (const [x0, x1] of [[2, 13], [44, 55]]) {
    shell(x0, 7, 22, x1, 14, 43, null);
    windows(x0, 22, x1, 43, 10, 11);
    g.fill(x0 + 1, 15, 23, x1 - 1, 15, 42, PB);
    g.fill(x0 + 2, 16, 24, x1 - 2, 16, 41, DP);
    for (let z = 26; z <= 40; z += 7) g.put((x0 + x1) >> 1, 16, z, SL);
    g.fill(x0 + 4, 7, 31, x0 + 7, 7, 34, W);
    pillar(x0 + 3, 26, 8, 13); pillar(x0 + 3, 38, 8, 13);
  }
}

// ---------------------------------------------------------------- mineshaft
// Abandoned mine workings deep underground: from a room with a dirt floor, corridors propped up with
// posts and beams run off every way, crossing and branching, stepping down now and then, some with
// rails along them, some thick with cobwebs, a chest here and there. Where a corridor crosses a cave,
// planks bridge it. (In the badlands the wood is dark oak.)
const SHAFT_REACH = 64;
function planMineshaft(gen, x, z, rnd) {
  const top = new Map();
  const ground = (px, pz) => {
    const k = `${px >> 2},${pz >> 2}`;
    let h = top.get(k);
    if (h === undefined) { h = gen.sample(px & ~3, pz & ~3).height; top.set(k, h); }
    return h;
  };
  const centre = gen.sample(x, z);
  let y = 14 + Math.floor(rnd() * 26);
  if (y + 20 > centre.height) y = centre.height - 20;
  if (y < 10) return null;
  const pieces = [];
  const fits = (b) => {
    if (Math.max(Math.abs(b.x0 - x), Math.abs(b.x1 - x), Math.abs(b.z0 - z), Math.abs(b.z1 - z)) > SHAFT_REACH || b.y0 < 6) return false;
    for (const [px, pz] of [[b.x0, b.z0], [b.x1, b.z0], [b.x0, b.z1], [b.x1, b.z1], [(b.x0 + b.x1) >> 1, (b.z0 + b.z1) >> 1]]) {
      if (ground(px, pz) - 7 <= b.y1) return false;
    }
    return !pieces.some((q) => q.x0 <= b.x1 && q.x1 >= b.x0 && q.y0 <= b.y1 && q.y1 >= b.y0 && q.z0 <= b.z1 && q.z1 >= b.z0);
  };
  // A box `len` long running `dir` from the entry (ex, ez), `h` high from y0 and 2 * hw + 1 wide.
  const along = (ex, y0, ez, dir, len, h, hw) => {
    const d = STEP[dir], ax = ex + d[0] * (len - 1), az = ez + d[1] * (len - 1);
    const [x0, x1] = d[0] ? [Math.min(ex, ax), Math.max(ex, ax)] : [ex - hw, ex + hw];
    const [z0, z1] = d[1] ? [Math.min(ez, az), Math.max(ez, az)] : [ez - hw, ez + hw];
    return { x0, x1, y0, y1: y0 + h - 1, z0, z1, dir, len, ex, ez };
  };
  const rw = 3 + Math.floor(rnd() * 3), rd = 3 + Math.floor(rnd() * 3), rh = 4 + Math.floor(rnd() * 3);
  const room = { t: 'room', x0: x - rw, x1: x + rw, y0: y, y1: y + rh - 1, z0: z - rd, z1: z + rd };
  if (!fits(room)) return null;
  pieces.push(room);
  const pending = [];
  for (const dir of FACES) {
    const [a0, a1] = dir === 0 || dir === 1 ? [room.z0, room.z1] : [room.x0, room.x1];
    for (let s = a0 + Math.floor(rnd() * 3); s + 2 <= a1; s += 4 + Math.floor(rnd() * 4)) {
      const ey = room.y0 + Math.floor(rnd() * (rh - 2)), c = s + 1;
      const [ex, ez] = dir === 0 ? [room.x1 + 1, c] : dir === 1 ? [room.x0 - 1, c] : dir === 4 ? [c, room.z1 + 1] : [c, room.z0 - 1];
      pending.push([ex, ey, ez, dir, 1]);
    }
  }
  const SIDES = { 0: [4, 5], 1: [4, 5], 4: [0, 1], 5: [0, 1] };
  const grow = (ex, ey, ez, dir, depth) => {
    if (depth > 8 || pieces.length >= 140) return;
    const r = rnd(), d = STEP[dir];
    let b = null;
    if (r >= 0.8) {
      const two = rnd() < 0.25, c = along(ex, ey, ez, dir, 5, two ? 7 : 3, 2);
      if (fits(c)) b = Object.assign(c, { t: 'cross', ey, two });
    } else if (r >= 0.7) {
      const c = along(ex, ey - 5, ez, dir, 9, 8, 1);
      if (fits(c)) b = Object.assign(c, { t: 'stairs', ey });
    } else {
      for (let n = 2 + Math.floor(rnd() * 3); n > 0 && !b; n--) {
        const c = along(ex, ey, ez, dir, n * 5, 3, 1);
        if (fits(c)) b = Object.assign(c, { t: 'corridor', ey });
      }
    }
    if (!b) return;
    pieces.push(b);
    if (b.t === 'cross') {
      const cx = ex + d[0] * 2, cz = ez + d[1] * 2;
      for (const nd of [dir, ...SIDES[dir]]) if (rnd() < 0.85) pending.push([cx + STEP[nd][0] * 3, ey, cz + STEP[nd][1] * 3, nd, depth + 1]);
    } else if (b.t === 'stairs') {
      pending.push([ex + d[0] * 9, ey - 5, ez + d[1] * 9, dir, depth + 1]);
    } else {
      pending.push([ex + d[0] * b.len, ey, ez + d[1] * b.len, dir, depth + 1]);
      for (let k = 3; k + 2 < b.len; k += 5) {
        const side = Math.floor(rnd() * 5);
        if (side > 1) continue;
        const nd = SIDES[dir][side], s = STEP[nd];
        pending.push([ex + d[0] * k + s[0] * 2, ey, ez + d[1] * k + s[1] * 2, nd, depth + 1]);
      }
    }
  };
  while (pending.length) {
    const [ex, ey, ez, dir, depth] = pending.splice(Math.floor(rnd() * pending.length), 1)[0];
    grow(ex, ey, ez, dir, depth);
  }
  let x0 = Infinity, z0 = Infinity, x1 = -Infinity, z1 = -Infinity;
  for (const q of pieces) { x0 = Math.min(x0, q.x0); z0 = Math.min(z0, q.z0); x1 = Math.max(x1, q.x1); z1 = Math.max(z1, q.z1); }
  return { x, z, y, pieces, wood: centre.biome === BIOME.BADLANDS ? 'dark_oak' : 'oak', box: [x0 - 2, z0 - 2, x1 + 2, z1 + 2] };
}
function buildMineshaft(gen, p, plot, rnd) {
  const g = new Frame(plot, 0, 0, 0, 5);
  const planks = `${p.wood}_planks`, fence = WOOD[p.wood].fence;
  const BRIDGE = FILL | DRY;
  for (const q of p.pieces) {
    if (q.t === 'room') {
      g.fill(q.x0, q.y0, q.z0, q.x1, q.y1, q.z1, 0, DRY);
      g.fill(q.x0, q.y0 - 1, q.z0, q.x1, q.y0 - 1, q.z1, 'dirt');
      continue;
    }
    const d = STEP[q.dir], s = [d[1], d[0]], at = (k, o) => [q.ex + d[0] * k + s[0] * o, q.ez + d[1] * k + s[1] * o];
    const axis = d[0] ? 'x' : 'z';
    if (q.t === 'cross') {
      const h = q.two ? 7 : 3;
      for (let k = 0; k < 5; k++) {
        for (let o = -2; o <= 2; o++) {
          if (Math.abs(k - 2) === 2 && Math.abs(o) === 2) continue;
          const [x, z] = at(k, o);
          g.fill(x, q.ey, z, x, q.ey + h - 1, z, 0, DRY);
          g.put(x, q.ey - 1, z, planks, BRIDGE);
        }
      }
      for (const [k, o] of [[1, -1], [1, 1], [3, -1], [3, 1]]) { const [x, z] = at(k, o); g.fill(x, q.ey, z, x, q.ey + h - 1, z, planks); }
      continue;
    }
    if (q.t === 'stairs') {
      for (let k = 0; k < 9; k++) {
        const f = q.ey + (k < 2 ? 0 : k < 7 ? -(k - 1) : -5);
        for (let o = -1; o <= 1; o++) {
          const [x, z] = at(k, o);
          g.fill(x, f, z, x, f + 2, z, 0, DRY);
          g.put(x, f - 1, z, planks, BRIDGE);
        }
      }
      continue;
    }
    // A corridor: posts and a beam every five blocks, rails down some, cobwebs in the corners.
    const rails = rnd() < 1 / 3, spiders = rnd() < 1 / 23;
    for (let k = 0; k < q.len; k++) {
      for (let o = -1; o <= 1; o++) {
        const [x, z] = at(k, o);
        g.fill(x, q.ey, z, x, q.ey + 2, z, 0, DRY);
        g.put(x, q.ey - 1, z, planks, BRIDGE);
      }
      const support = k % 5 === 2;
      if (support) {
        for (const o of [-1, 1]) { const [x, z] = at(k, o); g.fill(x, q.ey, z, x, q.ey + 1, z, fence, DRY); }
        for (let o = -1; o <= 1; o++) { const [x, z] = at(k, o); g.put(x, q.ey + 2, z, planks, DRY); }
      }
      if (rails && rnd() < 0.7) { const [x, z] = at(k, 0); g.rail(x, q.ey, z, axis, DRY); }
      for (const o of [-1, 1]) {
        const [x, z] = at(k, o);
        if (rnd() < (spiders ? 0.35 : support || k % 5 === 1 || k % 5 === 3 ? 0.08 : 0.02)) g.put(x, q.ey + 2, z, 'cobweb', BRIDGE);
        if (spiders && rnd() < 0.15) g.put(x, q.ey + 1, z, 'cobweb', BRIDGE);
        if (!support && rnd() < 0.012) g.put(x, q.ey, z, lootChestId('mineshaft', oppositeOf(s, o)), DRY);
      }
      if (support && rnd() < 0.2) {
        const o = rnd() < 0.5 ? -1 : 1, [x, z] = at(k + 1, o);
        g.put(x, q.ey + 1, z, WALL_TORCH[oppositeOf(s, o)], HUNG | DRY);
      }
    }
  }
}
// The face pointing along -o * s (from the side o of a corridor back to its middle).
function oppositeOf(s, o) {
  const dx = -s[0] * o, dz = -s[1] * o;
  return dx > 0 ? 0 : dx < 0 ? 1 : dz > 0 ? 4 : 5;
}

// ---------------------------------------------------------------- stronghold
// Stone-brick halls deep underground on a grid of five by five cells, eleven blocks apart: narrow
// passages and rooms, joined by open arches, wooden doors, iron doors with buttons and iron bars. A
// spiral stair, libraries, a prison, a fountain, storerooms - and at the end of it all, the portal
// room, where the frame of an end portal stands over a pool of lava.
const CELLS = 5, CELL = 11;
function strongholdPlan(gen, s) {
  return cached(`${worldKey(gen)}:stronghold:${s.i}`, () => {
    const rnd = mulberry32(Math.floor(hash2(s.x, s.z, gen.seed ^ 0x5710) * 4294967296));
    const face = pick(rnd, FACES), g = frameAt(s.x, s.z, face, -28, -28);
    const low = Math.min(...survey(gen, g, 0, 0, 55, 55, 11).map((q) => q.height));
    const y = Math.max(8, Math.min(12 + Math.floor(rnd() * 20), low - 26));
    const N = CELLS, id = (i, j) => j * N + i, ij = (c) => [c % N, Math.floor(c / N)];
    const edge = [];
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) if (i === 0 || j === 0 || i === N - 1 || j === N - 1) edge.push(id(i, j));
    const start = pick(rnd, edge);
    const used = new Set([start]), links = new Map(), parent = new Map(), depth = new Map([[start, 0]]);
    const link = (a, b) => links.set(a < b ? `${a}-${b}` : `${b}-${a}`, pick(rnd, ['open', 'open', 'wood', 'wood', 'iron', 'bars']));
    const near = (c) => { const [i, j] = ij(c); return [[i + 1, j], [i - 1, j], [i, j + 1], [i, j - 1]].filter(([a, b]) => a >= 0 && b >= 0 && a < N && b < N).map(([a, b]) => id(a, b)); };
    // A winding tree of passages from the stairs, now and then going back to branch off.
    const target = 14 + Math.floor(rnd() * 6), stack = [start];
    while (stack.length && used.size < target) {
      const c = stack[stack.length - 1], free = near(c).filter((n) => !used.has(n));
      if (!free.length || (stack.length > 2 && rnd() < 0.2)) { stack.pop(); continue; }
      const n = pick(rnd, free);
      used.add(n); link(c, n); parent.set(n, c); depth.set(n, depth.get(c) + 1); stack.push(n);
    }
    for (let k = 0; k < 3; k++) {
      const c = pick(rnd, [...used]), n = pick(rnd, near(c));
      const key = c < n ? `${c}-${n}` : `${n}-${c}`;
      if (used.has(n) && !links.has(key) && rnd() < 0.7) link(c, n);
    }
    const degree = (c) => [...links.keys()].filter((k) => k.split('-').map(Number).includes(c)).length;
    // The portal room at the dead end furthest in, reaching into the cell beyond it if that's free.
    const ends = [...used].filter((c) => c !== start && degree(c) === 1).sort((a, b) => depth.get(b) - depth.get(a));
    const portal = ends[0] ?? [...used].sort((a, b) => depth.get(b) - depth.get(a))[0];
    let beyond = null;
    const par = parent.get(portal);
    if (par !== undefined) {
      const [pi, pj] = ij(portal), [qi, qj] = ij(par), bi = pi + (pi - qi), bj = pj + (pj - qj);
      if (bi >= 0 && bj >= 0 && bi < N && bj < N && !used.has(id(bi, bj))) { beyond = id(bi, bj); used.add(beyond); }
    }
    const type = new Map([[start, 'stairs'], [portal, 'portal']]);
    if (beyond !== null) type.set(beyond, 'portal2');
    const rest = [...used].filter((c) => !type.has(c));
    for (let i = rest.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [rest[i], rest[j]] = [rest[j], rest[i]]; }
    rest.sort((a, b) => degree(a) - degree(b)); // (the rooms go at the ends of passages first)
    const wants = ['library', 'store', rnd() < 0.8 ? 'prison' : 'store', rnd() < 0.7 ? 'fountain' : 'crossing', rnd() < 0.5 ? 'library' : 'store'];
    // (A prison has its passage run straight through it: its ways in are all on one axis.)
    const axes = (c) => new Set(near(c).filter((n) => links.has(c < n ? `${c}-${n}` : `${n}-${c}`)).map((n) => (ij(n)[0] !== ij(c)[0] ? 'x' : 'z')));
    for (const c of rest) {
      let w = wants.shift();
      if (w === 'prison' && axes(c).size !== 1) w = 'store';
      type.set(c, w ?? (degree(c) >= 3 ? 'crossing' : 'corridor'));
    }
    const cells = [...used].map((c) => { const [i, j] = ij(c); return { c, i, j, type: type.get(c) }; });
    const [si, sj] = ij(start), [wx, wz] = g.at(si * CELL + 6, sj * CELL + 6);
    return { kind: 'stronghold', key: `stronghold:${s.i}`, x: wx, z: wz, y, face, ox: s.x, oz: s.z, cells, links: [...links],
      portal, beyond, parentOfPortal: par, top: Math.min(y + 16, low - 6), box: g.span(-1, -1, 56, 56),
      seed: Math.floor(rnd() * 4294967296) };
  });
}
function buildStronghold(gen, p, plot, rnd) {
  const g = new Frame(plot, p.ox, p.y, p.oz, p.face, -28, -28);
  const brick = () => { const r = rnd(); return r < 0.2 ? 'mossy_stone_bricks' : r < 0.32 ? 'cracked_stone_bricks' : 'stone_bricks'; };
  const N = CELLS, ij = (c) => [c % N, Math.floor(c / N)];
  const linked = new Set(p.links.map(([k]) => k));
  const isLinked = (a, b) => linked.has(a < b ? `${a}-${b}` : `${b}-${a}`);
  // The sides of a cell with a way through them: '+x', '-x', '+z', '-z'.
  const sides = (c) => {
    const [i, j] = ij(c), out = new Set();
    if (i + 1 < N && isLinked(c, c + 1)) out.add('+x');
    if (i > 0 && isLinked(c, c - 1)) out.add('-x');
    if (j + 1 < N && isLinked(c, c + N)) out.add('+z');
    if (j > 0 && isLinked(c, c - N)) out.add('-z');
    return out;
  };
  // A room: walls, floor and ceiling of brick round an empty inside.
  const room = (f, w, d, h) => {
    for (let y = 0; y <= h; y++) {
      for (let z = 0; z <= d; z++) {
        for (let x = 0; x <= w; x++) {
          const wall = y === 0 || y === h || x === 0 || x === w || z === 0 || z === d;
          f.put(x, y, z, wall ? brick() : 0);
        }
      }
    }
  };
  const webs = (f, w, d, y, chance) => {
    for (const [x, z] of [[1, 1], [w - 1, 1], [1, d - 1], [w - 1, d - 1]]) if (rnd() < chance) f.put(x, y, z, 'cobweb');
  };
  for (const cell of p.cells) {
    const X = cell.i * CELL, Z = cell.j * CELL, here = sides(cell.c);
    const f = boxFrame(g, X, Z, X + CELL, Z + CELL, 0, 5);
    switch (cell.type) {
      case 'corridor': {
        // A passage three wide from the middle out to each way through.
        const open = new Set();
        const carve = (x0, z0, x1, z1) => { for (let z = z0; z <= z1; z++) for (let x = x0; x <= x1; x++) open.add(`${x},${z}`); };
        carve(4, 4, 6, 6);
        if (here.has('+x')) carve(7, 4, 10, 6);
        if (here.has('-x')) carve(1, 4, 3, 6);
        if (here.has('+z')) carve(4, 7, 6, 10);
        if (here.has('-z')) carve(4, 1, 6, 3);
        for (let z = 0; z <= CELL; z++) {
          for (let x = 0; x <= CELL; x++) {
            let near = false;
            for (let dz = -1; dz <= 1 && !near; dz++) for (let dx = -1; dx <= 1; dx++) if (open.has(`${x + dx},${z + dz}`)) { near = true; break; }
            if (!near) continue;
            const inside = open.has(`${x},${z}`);
            for (let y = 0; y <= 4; y++) f.put(x, y, z, inside && y >= 1 && y <= 3 ? (y === 3 && rnd() < 0.04 ? 'cobweb' : 0) : brick());
          }
        }
        const blank = ['+x', '-x', '+z', '-z'].find((s) => !here.has(s));
        if (blank && rnd() < 0.6) {
          const [x, z, lean] = { '+x': [6, 5, 1], '-x': [4, 5, 0], '+z': [5, 6, 5], '-z': [5, 4, 4] }[blank];
          f.torch(x, 2, z, lean);
        }
        break;
      }
      case 'crossing': {
        room(f, CELL, CELL, 6);
        f.fill(5, 1, 5, 6, 5, 6, 'stone_bricks');
        f.torch(4, 3, 5, 1); f.torch(7, 3, 6, 0); f.torch(5, 3, 7, 4); f.torch(6, 3, 4, 5);
        for (let k = 1; k <= 10; k++) { f.put(k, 1, 1, 'stone_brick_slab'); f.put(k, 1, 10, 'stone_brick_slab'); }
        webs(f, CELL, CELL, 5, 0.3);
        break;
      }
      case 'library': {
        room(f, CELL, CELL, 7);
        f.fill(1, 0, 1, 10, 0, 10, 'oak_planks');
        const doorway = (s, k) => here.has(s) && k >= 4 && k <= 6;
        for (let y = 1; y <= 5; y++) {
          for (let k = 1; k <= 10; k++) {
            if (!doorway('-z', k)) f.put(k, y, 1, 'bookshelf');
            if (!doorway('+z', k)) f.put(k, y, 10, 'bookshelf');
            if (!doorway('-x', k)) f.put(1, y, k, 'bookshelf');
            if (!doorway('+x', k)) f.put(10, y, k, 'bookshelf');
          }
        }
        for (const z of [4, 7]) for (const x of [3, 4, 7, 8]) f.fill(x, 1, z, x, 3, z, 'bookshelf');
        f.put(5, 6, 5, 'lantern_hanging'); f.put(6, 6, 6, 'lantern_hanging');
        const spot = !here.has('-x') ? [2, 5, 0] : !here.has('+x') ? [9, 5, 1] : !here.has('-z') ? [5, 2, 4] : [6, 9, 5];
        f.chest(spot[0], 1, spot[1], 'stronghold_library', spot[2]);
        webs(f, CELL, CELL, 6, 0.5);
        webs(f, CELL, CELL, 5, 0.2);
        break;
      }
      case 'prison': {
        // Cells either side of a passage running between the ways through.
        const along = here.has('+x') || here.has('-x') ? 5 : 1;
        const q = boxFrame(g, X, Z, X + CELL, Z + CELL, 0, along);
        room(q, CELL, CELL, 6);
        for (let y = 1; y <= 5; y++) for (const z of [1, 2, 8, 9, 10]) for (const x of [4, 7]) q.put(x, y, z, 'stone_bricks');
        for (let x = 1; x <= 10; x++) {
          for (let y = 1; y <= 5; y++) { q.put(x, y, 3, y <= 3 && x !== 4 && x !== 7 ? 'iron_bars' : 'stone_bricks'); q.put(x, y, 7, y <= 3 && x !== 4 && x !== 7 ? 'iron_bars' : 'stone_bricks'); }
        }
        for (const x of [2, 5, 9]) { q.door(x, 1, 3, 4, true); q.door(x, 1, 7, 5, true); }
        for (const x of [1, 10]) for (const z of [1, 10]) if (rnd() < 0.5) q.put(x, 1, z, 'cobweb');
        break;
      }
      case 'fountain': {
        room(f, CELL, CELL, 6);
        for (let z = 3; z <= 8; z++) for (let x = 3; x <= 8; x++) f.put(x, 0, z, 'water');
        for (let k = 3; k <= 8; k++) { f.put(k, 1, 2, 'stone_brick_slab'); f.put(k, 1, 9, 'stone_brick_slab'); f.put(2, 1, k, 'stone_brick_slab'); f.put(9, 1, k, 'stone_brick_slab'); }
        f.fill(5, 0, 5, 6, 5, 6, 'chiseled_stone_bricks');
        f.fill(5, 1, 5, 6, 4, 6, 'stone_bricks');
        f.torch(4, 3, 5, 1); f.torch(7, 3, 6, 0); f.torch(5, 3, 7, 4); f.torch(6, 3, 4, 5);
        break;
      }
      case 'store': {
        room(f, CELL, CELL, 6);
        const walls = [['-x', 1, 5, 0], ['+x', 10, 5, 1], ['-z', 5, 1, 4], ['+z', 5, 10, 5]].filter(([s]) => !here.has(s));
        const chosen = walls.length ? walls : [['-x', 1, 2, 0]];
        chosen.slice(0, rnd() < 0.5 ? 2 : 1).forEach(([, x, z, front]) => f.chest(x, 1, z, 'stronghold', front));
        for (const [x, z] of [[1, 9], [2, 10], [9, 1], [10, 2]]) if (rnd() < 0.6) f.put(x, 1, z, 'barrel');
        f.torch(1, 3, 3, 0);
        webs(f, CELL, CELL, 5, 0.6);
        break;
      }
      case 'stairs': {
        // A spiral stair round a pillar, climbing to a landing high above (as far as the ground allows).
        room(f, CELL, CELL, 6);
        const top = Math.max(8, p.top - p.y);
        for (let y = 6; y <= top; y++) for (let z = 3; z <= 8; z++) for (let x = 3; x <= 8; x++) f.put(x, y, z, x === 3 || x === 8 || z === 3 || z === 8 || y === top ? brick() : 0);
        const ring = [[4, 4], [5, 4], [6, 4], [7, 4], [7, 5], [7, 6], [7, 7], [6, 7], [5, 7], [4, 7], [4, 6], [4, 5]];
        f.fill(5, 1, 5, 6, top - 1, 6, 'stone_bricks');
        for (let k = 0; 1 + k < top - 2; k++) {
          const [x, z] = ring[k % ring.length], [nx, nz] = ring[(k + 1) % ring.length];
          const face = nx > x ? 0 : nx < x ? 1 : nz > z ? 4 : 5;
          f.stairs(x, 1 + k, z, 'stone_brick', face);
          if (k > 0) f.fill(x, 1, z, x, k, z, 'stone_bricks');
        }
        f.torch(4, 2, 1, 4); f.torch(7, 2, 10, 5);
        break;
      }
      case 'portal': {
        // The frame stands on a platform at the far end, over lava; steps lead up to it.
        let x0 = X, z0 = Z, x1 = X + CELL, z1 = Z + CELL, front = 5;
        if (p.beyond !== null) {
          const [bi, bj] = ij(p.beyond);
          x0 = Math.min(X, bi * CELL); z0 = Math.min(Z, bj * CELL); x1 = Math.max(X, bi * CELL) + CELL; z1 = Math.max(Z, bj * CELL) + CELL;
        }
        const [pi, pj] = ij(p.parentOfPortal ?? cell.c);
        if (pi < cell.i) front = 1; else if (pi > cell.i) front = 0; else if (pj < cell.j) front = 5; else if (pj > cell.j) front = 4;
        const q = boxFrame(g, x0, z0, x1, z1, 0, front), long = p.beyond !== null;
        const d = long ? 2 * CELL : CELL;
        room(q, CELL, d, 8);
        const c = long ? 15 : 6; // the middle of the frame, along the room
        q.fill(2, 1, c - 3, 8, 2, c + 3, 'stone_bricks');
        for (let x = 4; x <= 6; x++) { q.stairs(x, 1, c - 5, 'stone_brick', 4); q.stairs(x, 2, c - 4, 'stone_brick', 4); }
        q.fill(4, 1, c - 1, 6, 2, c + 1, 'lava');
        const frame = () => (rnd() < 0.1 ? 'end_portal_frame_eye' : 'end_portal_frame');
        for (let k = -1; k <= 1; k++) { q.put(5 + k, 3, c - 2, frame()); q.put(5 + k, 3, c + 2, frame()); q.put(3, 3, c + k, frame()); q.put(7, 3, c + k, frame()); }
        for (const z of long ? [4, 11, 18] : [3, 8]) { q.torch(1, 4, z, 0); q.torch(10, 4, z, 1); }
        for (let z = 2; z < d; z += 4) { q.put(0, 3, z, 'iron_bars'); q.put(CELL, 3, z, 'iron_bars'); }
        break;
      }
      default: break;
    }
  }
  // The ways between cells: arches, doors, iron doors with a button either side, or bars.
  for (const [key, kind] of p.links) {
    const [a, b] = key.split('-').map(Number), [ai, aj] = ij(a), [bi, bj] = ij(b);
    const alongX = ai !== bi, lo = alongX ? Math.min(ai, bi) : Math.min(aj, bj);
    const pos = (s, t) => (alongX ? [(lo + 1) * CELL, s, t] : [t, s, (lo + 1) * CELL]);
    const c = (alongX ? aj : ai) * CELL + 5;
    const put = (y, t, id) => { const [x, , z] = pos(y, t); g.put(x, y, z, id); };
    if (kind === 'open') { for (let y = 1; y <= 3; y++) for (let t = c - 1; t <= c + 1; t++) put(y, t, 0); continue; }
    if (kind === 'bars') { for (let y = 1; y <= 2; y++) put(y, c, 'iron_bars'); continue; }
    const [x, , z] = pos(1, c);
    g.door(x, 1, z, alongX ? 0 : 4, kind === 'iron');
    if (kind === 'iron') {
      const [bx, , bz] = pos(2, c + 1);
      if (alongX) { g.button(bx - 1, 2, bz, 0); g.button(bx + 1, 2, bz, 1); }
      else { g.button(bx, 2, bz - 1, 4); g.button(bx, 2, bz + 1, 5); }
    }
  }
}

const PLAN = { pyramid: planPyramid, jungle_temple: planTemple, igloo: planIgloo, shipwreck: planShipwreck, monument: planMonument,
  mineshaft: planMineshaft };
const BUILD = { pyramid: buildPyramid, jungle_temple: buildTemple, igloo: buildIgloo, shipwreck: buildShipwreck, monument: buildMonument,
  mineshaft: buildMineshaft, stronghold: buildStronghold };
