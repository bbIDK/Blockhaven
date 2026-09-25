// Walled villages. Inside a ring of stone walls - corner towers, a gatehouse on every side and a
// walk along the top - two main streets cross at a plaza with a well, a bell and market stalls,
// and a lane runs round the inside of the wall. Houses and workshops line the streets and the
// lane, with farms, pens, gardens and a mine behind. A village is planned once per region from
// the seed; every chunk it overlaps copies its share of the blocks, so they all agree. The
// people who live there are listed on the plan (see civilians.js).
import { HEIGHT, SEA_LEVEL } from './config.js';
import { B, STAIRS, FACING_VARIANTS, LADDER, LOG_AXES, doorId, bedId, lootChestId, gateId, WOOD, WALL_TORCH } from './blocks.js';
import { BIOME } from './biomes.js';
import { hash2, mulberry32 } from './math.js';

export const REGION = 24;  // chunks per side of the region that may hold one village
export const RADIUS = 34;  // from the centre to the outer face of the wall
const LANE = RADIUS - 5;   // the lane inside the wall runs LANE..LANE+2 from the centre
const FRONT = LANE - 2;    // lots on the lane have their fronts on this line (their steps on the next)
const PLAZA = 7;
const BLEND = 7;           // columns outside the wall over which the ground eases back to nature
const REACH = RADIUS + BLEND;

const STYLE_OF = {
  [BIOME.PLAINS]: 'plains', [BIOME.SUNFLOWER_PLAINS]: 'plains', [BIOME.MEADOW]: 'plains', [BIOME.FLOWER_FOREST]: 'plains',
  [BIOME.FOREST]: 'plains', [BIOME.BIRCH_FOREST]: 'plains', [BIOME.SAVANNA]: 'savanna', [BIOME.DESERT]: 'desert', [BIOME.TAIGA]: 'taiga',
  [BIOME.SNOWY_PLAINS]: 'snowy', [BIOME.SNOWY_TAIGA]: 'snowy', [BIOME.CHERRY_GROVE]: 'cherry',
};
// Block names for each style. `roof` names a kind of stairs and slab (desert houses have flat
// roofs), `stair` the stone the steps up the wall are made of, `tree` the gardens' trees.
const FLOWERS = ['poppy', 'dandelion', 'cornflower', 'allium', 'azure_bluet', 'oxeye_daisy', 'red_tulip', 'lily_of_the_valley'];
const STYLES = {
  plains: { wall: 'stone_bricks', wall2: 'mossy_stone_bricks', stair: 'stone_brick', crest: 'stone_brick_wall', found: 'cobblestone',
    planks: 'oak_planks', log: 'oak_log', roof: 'spruce', door: 'oak', fence: 'oak_fence', gate: 'oak', floor: 'oak_planks', road: 'dirt_path',
    edge: 'gravel', plaza: 'cobblestone', accent: 'white', glass: 'glass_pane', tree: 'oak', flowers: FLOWERS, soil: 'grass_block',
    stall: ['red', 'yellow', 'blue', 'lime'] },
  taiga: { wall: 'cobblestone', wall2: 'mossy_cobblestone', stair: 'cobblestone', crest: 'cobblestone_wall', found: 'cobblestone',
    planks: 'spruce_planks', log: 'spruce_log', roof: 'dark_oak', door: 'spruce', fence: 'spruce_fence', gate: 'spruce', floor: 'spruce_planks',
    road: 'dirt_path', edge: 'coarse_dirt', plaza: 'cobblestone', accent: 'brown', glass: 'glass_pane', tree: 'spruce',
    flowers: ['fern', 'fern', 'cornflower', 'lily_of_the_valley'], soil: 'podzol', stall: ['brown', 'green', 'red', 'orange'] },
  snowy: { wall: 'stone_bricks', wall2: 'cobblestone', stair: 'stone_brick', crest: 'stone_brick_wall', found: 'cobblestone', planks: 'spruce_planks',
    log: 'spruce_log', roof: 'spruce', door: 'spruce', fence: 'spruce_fence', gate: 'spruce', floor: 'spruce_planks', road: 'dirt_path',
    edge: 'gravel', plaza: 'stone_bricks', accent: 'light_blue', glass: 'glass_pane', tree: 'spruce', flowers: ['fern', 'lily_of_the_valley'],
    soil: 'grass_block', stall: ['light_blue', 'blue', 'cyan', 'purple'] },
  desert: { wall: 'sandstone', wall2: 'cut_sandstone', stair: 'sandstone', crest: 'sandstone_wall', found: 'sandstone', planks: 'cut_sandstone',
    log: 'chiseled_sandstone', roof: null, door: 'jungle', fence: 'jungle_fence', gate: 'jungle', floor: 'cut_sandstone', road: 'dirt_path',
    edge: 'sandstone', plaza: 'cut_sandstone', accent: 'orange', glass: 'glass_pane', tree: 'jungle', flowers: ['dead_bush', 'cactus'],
    soil: 'sand', stall: ['orange', 'yellow', 'red', 'cyan'] },
  savanna: { wall: 'red_sandstone', wall2: 'cut_red_sandstone', stair: 'red_sandstone', crest: 'red_sandstone_wall', found: 'cobblestone',
    planks: 'acacia_planks', log: 'acacia_log', roof: 'acacia', door: 'acacia', fence: 'acacia_fence', gate: 'acacia', floor: 'acacia_planks',
    road: 'dirt_path', edge: 'coarse_dirt', plaza: 'cut_red_sandstone', accent: 'orange', glass: 'glass_pane', tree: 'acacia',
    flowers: ['dandelion', 'poppy', 'allium'], soil: 'grass_block', stall: ['orange', 'yellow', 'lime', 'red'] },
  cherry: { wall: 'stone_bricks', wall2: 'polished_andesite', stair: 'stone_brick', crest: 'stone_brick_wall', found: 'cobblestone',
    planks: 'cherry_planks', log: 'cherry_log', roof: 'dark_oak', door: 'cherry', fence: 'cherry_fence', gate: 'cherry', floor: 'cherry_planks',
    road: 'dirt_path', edge: 'gravel', plaza: 'polished_andesite', accent: 'pink', glass: 'glass_pane', tree: 'cherry',
    flowers: ['pink_tulip', 'allium', 'lily_of_the_valley', 'oxeye_daisy'], soil: 'grass_block', stall: ['pink', 'magenta', 'purple', 'white'] },
};
for (const st of Object.values(STYLES)) st.walk = st.roof ? `${st.roof}_slab` : 'sandstone_slab';

// ---------------------------------------------------------------- planning
const plans = new Map(); // world and region -> plan or null

// The village of region (rx, rz), or null if it has none.
export function regionVillage(gen, rx, rz) {
  const key = `${rx},${rz}`, cacheKey = `${gen.seed}:${gen.type}:${key}`;
  if (plans.has(cacheKey)) return plans.get(cacheKey);
  let plan = null;
  if (gen.villages) {
    const rnd = mulberry32(Math.floor(hash2(rx, rz, gen.seed ^ 0x7111a9e) * 4294967296));
    // The regions around the origin try hard, so every world has a village near spawn.
    const home = (rx === 0 || rx === -1) && (rz === 0 || rz === -1);
    const tries = home ? 40 : (rnd() < 0.8 ? 3 : 0);
    for (let t = 0; t < tries && !plan; t++) {
      const span = REGION * 16 - REACH * 2 - 32;
      const cx = rx * REGION * 16 + REACH + 16 + Math.floor(rnd() * span);
      const cz = rz * REGION * 16 + REACH + 16 + Math.floor(rnd() * span);
      plan = site(gen, cx, cz, rnd);
    }
    if (plan) plan.key = key;
  }
  plans.set(cacheKey, plan);
  if (plans.size > 64) plans.delete(plans.keys().next().value);
  return plan;
}

// Is (cx, cz) a good spot? Level ground, dry, in a biome that has villages.
function site(gen, cx, cz, rnd) {
  const c = gen.sample(cx, cz);
  const styleName = STYLE_OF[c.biome];
  if (!styleName) return null;
  // A little water at the edges is fine (the town's ground is raised over it), but not in the middle.
  const hs = [];
  let wet = 0;
  for (let dz = -RADIUS; dz <= RADIUS; dz += 8) for (let dx = -RADIUS; dx <= RADIUS; dx += 8) {
    const s = gen.sample(cx + dx, cz + dz);
    if (s.height <= SEA_LEVEL + 1) { if (Math.max(Math.abs(dx), Math.abs(dz)) < 20 || ++wet > 5) return null; continue; }
    hs.push(s.height);
  }
  hs.sort((a, b) => a - b);
  if (hs[hs.length - 3] - hs[2] > 16) return null;
  const y = Math.max(SEA_LEVEL + 2, hs[Math.floor(hs.length / 2)]);
  return layout({ x: cx, z: cz, y, style: STYLES[styleName], styleName, rnd });
}

// Villages whose grounds reach into chunk (cx, cz).
export function villagesNear(gen, cx, cz) {
  const out = [];
  const x = cx * 16 + 8, z = cz * 16 + 8, span = REGION * 16;
  for (let rz = Math.floor((z - REACH - 16) / span); rz <= Math.floor((z + REACH + 16) / span); rz++) {
    for (let rx = Math.floor((x - REACH - 16) / span); rx <= Math.floor((x + REACH + 16) / span); rx++) {
      const p = regionVillage(gen, rx, rz);
      if (p && Math.abs(p.x - x) <= REACH + 8 && Math.abs(p.z - z) <= REACH + 8) out.push(p);
    }
  }
  return out;
}

// The nearest village to (x, z) within `regions` regions, or null (for /locate).
export function nearestVillage(gen, x, z, regions = 3) {
  const span = REGION * 16, rx0 = Math.floor(x / span), rz0 = Math.floor(z / span);
  let best = null, bd = Infinity;
  for (let rz = rz0 - regions; rz <= rz0 + regions; rz++) for (let rx = rx0 - regions; rx <= rx0 + regions; rx++) {
    const p = regionVillage(gen, rx, rz);
    if (!p) continue;
    const d = Math.hypot(p.x - x, p.z - z);
    if (d < bd) { bd = d; best = p; }
  }
  return best;
}

// The village whose walls (x, z) is inside, if any.
export function villageAt(gen, x, z, margin = 0) {
  if (!gen?.villages) return null;
  const span = REGION * 16, rx = Math.floor(x / span), rz = Math.floor(z / span);
  for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) {
    const p = regionVillage(gen, rx + dx, rz + dz);
    if (p && Math.max(Math.abs(x - p.x), Math.abs(z - p.z)) <= RADIUS + margin) return p;
  }
  return null;
}

// Sizes of what can stand on a lot: [across the front, front to back].
const SIZE = { house_small: [7, 6], house_large: [9, 8], house_tall: [7, 7], smithy: [9, 8], butcher: [7, 7], hunter: [7, 7],
  library: [9, 7], barracks: [9, 9], tavern: [11, 9], bakery: [7, 7], mine: [7, 7], farm: [11, 7], pen: [9, 8], garden: [7, 5],
  plot: [7, 5], yard: [5, 4] };
const HOUSES = ['house_small', 'house_small', 'house_large', 'house_tall', 'house_tall'];

// Where things go: the streets, then lots along them with their doors on the street.
function layout(plan) {
  const { rnd } = plan;
  const R = RADIUS, W = 2 * R + 1;
  const occ = new Uint8Array(W * W);
  const free = (x0, z0, x1, z1) => {
    for (let z = z0 - 1; z <= z1 + 1; z++) for (let x = x0 - 1; x <= x1 + 1; x++) {
      if (Math.abs(x) > FRONT + 1 || Math.abs(z) > FRONT + 1 || occ[(z + R) * W + x + R]) return false;
    }
    return true;
  };
  const take = (x0, z0, x1, z1) => { for (let z = z0; z <= z1; z++) for (let x = x0; x <= x1; x++) occ[(z + R) * W + x + R] = 1; };
  take(-2, -R, 2, R); take(-R, -2, R, 2); take(-PLAZA, -PLAZA, PLAZA, PLAZA);
  const buildings = [];
  const place = (type, face, box) => {
    if (!free(...box)) return false;
    take(...box);
    const [w, d] = SIZE[type];
    buildings.push({ type, w, d, face, box });
    return true;
  };
  const pick = (list) => list[Math.floor(rnd() * list.length)];
  const shuffle = (a) => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  // A frontage: lots standing side by side along a street, from s0 towards s1. `along` is the axis
  // the street runs on, `front` the line their fronts stand on, `grow` the way they reach back.
  const boxAt = (fr, s, w, d) => {
    const dir = Math.sign(fr.s1 - fr.s0), a = s, b = s + dir * (w - 1), c = fr.front, e = fr.front + fr.grow * (d - 1);
    const u0 = Math.min(a, b), u1 = Math.max(a, b), v0 = Math.min(c, e), v1 = Math.max(c, e);
    return fr.along === 'z' ? [v0, u0, v1, u1] : [u0, v0, u1, v1];
  };
  // Fills frontages from a queue, a lot at a time on each in turn (so the first things in the
  // queue get the best spots on every street). A lot that fits nowhere is left out.
  const rows = (frontages, queue) => {
    const cur = frontages.map((f) => ({ ...f, s: f.s0, dir: Math.sign(f.s1 - f.s0) }));
    let q = 0;
    while (q < queue.length) {
      let placed = false;
      for (const c of cur) {
        if (q >= queue.length) break;
        const [w, d] = SIZE[queue[q]];
        for (let s = c.s; (c.s1 - (s + c.dir * (w - 1))) * c.dir >= 0; s += c.dir) {
          if (!place(queue[q], c.face, boxAt(c, s, w, d))) continue;
          q++; placed = true;
          c.s = s + c.dir * (w + (rnd() < 0.3 ? 2 : 1));
          break;
        }
      }
      if (!placed) q++;
    }
  };
  // Lots along the main streets, beyond the plaza.
  const street = [];
  for (const [ax, az] of [[0, -1], [0, 1], [-1, 0], [1, 0]]) {
    for (const side of [-1, 1]) {
      street.push(ax === 0
        ? { along: 'z', front: side * 4, grow: side, face: side < 0 ? 0 : 1, s0: az * (PLAZA + 2), s1: az * FRONT }
        : { along: 'x', front: side * 4, grow: side, face: side < 0 ? 4 : 5, s0: ax * (PLAZA + 2), s1: ax * FRONT });
    }
  }
  // The barracks stands by a gate; the workshops get the spots nearest the plaza.
  const bf = pick(street);
  rows([{ ...bf, s0: bf.s1, s1: bf.s0 }], ['barracks']);
  rows(shuffle([...street]), [...shuffle(['tavern', 'library', 'smithy', 'bakery', 'butcher', 'hunter']),
    ...Array.from({ length: 12 }, () => pick(HOUSES))]);
  // Lots on the lane inside the wall, facing it.
  const lane = [];
  for (const half of [-1, 1]) {
    lane.push({ along: 'x', front: -FRONT, grow: 1, face: 5, s0: half * 4, s1: half * FRONT },
      { along: 'x', front: FRONT, grow: -1, face: 4, s0: half * 4, s1: half * FRONT },
      { along: 'z', front: -FRONT, grow: 1, face: 1, s0: half * 4, s1: half * FRONT },
      { along: 'z', front: FRONT, grow: -1, face: 0, s0: half * 4, s1: half * FRONT });
  }
  rows(shuffle(lane), ['mine', 'farm', 'farm', ...shuffle(['farm', 'pen', 'pen', 'garden', 'garden', ...Array.from({ length: 9 }, () => pick(HOUSES))])]);
  // Back yards: gardens, vegetable plots, pens and woodpiles in the space left behind.
  const spots = [];
  for (let z = -FRONT; z <= FRONT; z += 2) for (let x = -FRONT; x <= FRONT; x += 2) spots.push([x, z]);
  let yards = 0;
  for (const [x, z] of shuffle(spots)) {
    for (const type of shuffle(['garden', 'plot', 'yard', 'pen', 'garden', 'plot'])) {
      const [w, d] = SIZE[type], face = pick([4, 5, 0, 1]), sideways = face === 0 || face === 1;
      if (place(type, face, [x, z, x + (sideways ? d : w) - 1, z + (sideways ? w : d) - 1])) { yards++; break; }
    }
    if (yards >= 16) break;
  }
  plan.buildings = buildings;
  plan.radius = R;
  plan.blueprint = null;
  plan.residents = [];
  plan.animals = [];
  plan.rnd = null;
  plan.seed = Math.floor(rnd() * 4294967296);
  return plan;
}

// ---------------------------------------------------------------- building
// A village's blocks, sorted by chunk: chunk key -> [x, y, z, id, ...].
class Blueprint {
  constructor() { this.chunks = new Map(); }
  set(x, y, z, id) {
    if (y < 1 || y >= HEIGHT || id === undefined) return;
    const k = `${x >> 4},${z >> 4}`;
    let a = this.chunks.get(k);
    if (!a) this.chunks.set(k, a = []);
    a.push(x, y, z, id);
  }
}

// Draws one building in its own coordinates: x across its front (0 at the left), z back from the
// front, y up from the ground. The front faces `face`. Collects the building's beds, the jobs
// done there and the animals kept there.
class Lot {
  constructor(bp, plan, b) {
    this.bp = bp; this.plan = plan; this.b = b; this.st = plan.style;
    this.y0 = plan.y;
    this.beds = []; this.jobs = []; this.animals = []; this.doors = [];
    const [x0, z0, x1, z1] = b.box;
    // The corner of the lot at local (0, 0), and which way local +x and +z run.
    const f = b.face;
    if (f === 5) { this.o = [x0, z0]; this.ux = [1, 0]; this.uz = [0, 1]; }
    else if (f === 4) { this.o = [x1, z1]; this.ux = [-1, 0]; this.uz = [0, -1]; }
    else if (f === 0) { this.o = [x1, z0]; this.ux = [0, 1]; this.uz = [-1, 0]; }
    else { this.o = [x0, z1]; this.ux = [0, -1]; this.uz = [1, 0]; }
    this.o = [plan.x + this.o[0], plan.z + this.o[1]];
    // Local faces (5 = front, 4 = back, 1 = left, 0 = right) to world faces.
    const turn = { 5: [5, 4, 1, 0], 4: [4, 5, 0, 1], 0: [0, 1, 5, 4], 1: [1, 0, 4, 5] }[f];
    this.faces = { 5: turn[0], 4: turn[1], 1: turn[2], 0: turn[3], 2: 2, 3: 3 };
  }
  at(x, z) { return [this.o[0] + this.ux[0] * x + this.uz[0] * z, this.o[1] + this.ux[1] * x + this.uz[1] * z]; }
  world(x, y, z) { const [wx, wz] = this.at(x, z); return [wx, this.y0 + y, wz]; }
  face(f) { return this.faces[f]; }
  set(x, y, z, id) { const [wx, wz] = this.at(x, z); this.bp.set(wx, this.y0 + y, wz, typeof id === 'string' ? B[id] : id); }
  fill(x0, y0, z0, x1, y1, z1, id) {
    for (let y = y0; y <= y1; y++) for (let z = z0; z <= z1; z++) for (let x = x0; x <= x1; x++) this.set(x, y, z, id);
  }
  stairs(x, y, z, kind, face, upside = false) {
    const s = STAIRS[B[`${kind}_stairs`]];
    if (s) this.set(x, y, z, s.ids[this.face(face)][upside ? 1 : 0]);
  }
  door(x, z, wood, face = 5) {
    const base = WOOD[wood].door, f = this.face(face);
    this.set(x, 1, z, doorId(f, false, false, base));
    this.set(x, 2, z, doorId(f, false, true, base));
    this.doors.push(this.world(x, 1, z));
  }
  // A bed with its foot at (x, z), the head towards `face`.
  bed(x, y, z, face, who = null) {
    const f = this.face(face), d = { 5: [0, -1], 4: [0, 1], 1: [-1, 0], 0: [1, 0] }[face];
    this.set(x, y, z, bedId(f, false));
    this.set(x + d[0], y, z + d[1], bedId(f, true));
    this.beds.push({ at: this.world(x, y, z), who });
  }
  job(role, x, z, y = 1) { this.jobs.push({ role, work: this.world(x, y, z) }); }
  chest(x, y, z, kind, front) { this.set(x, y, z, lootChestId(kind, this.face(front))); }
  facing(name, x, y, z, front) { this.set(x, y, z, FACING_VARIANTS[B[name]][this.face(front)]); }
  torch(x, y, z, face) { this.set(x, y, z, WALL_TORCH[this.face(face)]); }
  ladder(x, y0, y1, z, wallFace) { for (let y = y0; y <= y1; y++) this.set(x, y, z, LADDER[this.face(wallFace)]); }
  // A log lying along local x (or z).
  beam(x, y, z, alongX = true) {
    const axes = LOG_AXES[B[this.st.log]];
    const worldX = alongX ? this.ux[0] !== 0 : this.uz[0] !== 0;
    this.set(x, y, z, axes ? axes[worldX ? 0 : 1] : this.st.log);
  }
  carpet(x, y, z, colour = this.st.accent) { this.set(x, y, z, `${colour}_carpet`); }
  // A pitched roof over the box [0..w-1] x [0..d-1] with its eaves at height y, the ridge running
  // front to back; the gable ends are filled with `gable`.
  roof(w, d, y, kind, gable) {
    const half = w >> 1;
    for (let i = 0; i <= half; i++) {
      for (let z = -1; z <= d; z++) {
        if (i < half || w % 2 === 0) {
          this.stairs(i, y + i, z, kind, 0);
          this.stairs(w - 1 - i, y + i, z, kind, 1);
        } else this.set(i, y + i, z, `${kind}_slab`);
      }
      if (i > 0) for (let x = i; x <= w - 1 - i; x++) { this.set(x, y + i - 1, 0, gable); this.set(x, y + i - 1, d - 1, gable); }
    }
  }
  // A flat roof with a low parapet (desert houses).
  flatRoof(w, d, y) {
    this.fill(0, y, 0, w - 1, y, d - 1, this.st.planks);
    for (let x = 0; x < w; x++) { this.set(x, y + 1, 0, 'sandstone_slab'); this.set(x, y + 1, d - 1, 'sandstone_slab'); }
    for (let z = 0; z < d; z++) { this.set(0, y + 1, z, 'sandstone_slab'); this.set(w - 1, y + 1, z, 'sandstone_slab'); }
  }
  topRoof(w, d, y) { if (this.st.roof) this.roof(w, d, y, this.st.roof, this.st.planks); else this.flatRoof(w, d, y); }
  // Walls of a room w x d, h high: logs at the corners, planks between, windows in the middle.
  shell(w, d, h, { windows = true, walls = null, corners = null, y = 0, floor = true } = {}) {
    const st = this.st;
    if (floor) { this.fill(0, y, 0, w - 1, y, d - 1, st.found); this.fill(1, y, 1, w - 2, y, d - 2, st.floor); }
    this.fill(1, y + 1, 1, w - 2, y + h, d - 2, 0);
    for (let yy = y + 1; yy <= y + h; yy++) {
      for (let x = 0; x < w; x++) { this.set(x, yy, 0, walls ?? st.planks); this.set(x, yy, d - 1, walls ?? st.planks); }
      for (let z = 0; z < d; z++) { this.set(0, yy, z, walls ?? st.planks); this.set(w - 1, yy, z, walls ?? st.planks); }
      for (const [x, z] of [[0, 0], [w - 1, 0], [0, d - 1], [w - 1, d - 1]]) this.set(x, yy, z, corners ?? st.log);
    }
    if (windows) {
      for (let z = 2; z < d - 2; z += 2) { this.set(0, y + 2, z, st.glass); this.set(w - 1, y + 2, z, st.glass); }
      for (let x = 2; x < w - 2; x += 3) if (x !== (w >> 1)) this.set(x, y + 2, d - 1, st.glass);
    }
  }
  // Clears the lot and the step in front of it.
  clear(w, d, h = 10) { this.fill(0, 1, 0, w - 1, h, d - 1, 0); this.fill(0, 1, -1, w - 1, 3, -1, 0); }
  // The front door with its step and a torch beside it.
  entrance(w, wood = this.st.door) {
    this.door(w >> 1, 0, wood);
    this.set(w >> 1, 0, -1, this.st.found);
    this.torch((w >> 1) + 1, 2, -1, 5);
  }
  // A chimney up a wall with a campfire smoking on top.
  chimney(x, z, top) {
    for (let y = 1; y <= top; y++) this.set(x, y, z, B.cobblestone);
    this.set(x, top + 1, z, B.campfire);
  }
}

// Fills a plan's blueprint (on first use).
function build(plan) {
  if (plan.blueprint) return plan.blueprint;
  const bp = new Blueprint(), st = plan.style, R = RADIUS, { x: cx, y, z: cz } = plan;
  const rnd = mulberry32(plan.seed);
  const set = (x, yy, z, id) => bp.set(cx + x, y + yy, cz + z, typeof id === 'string' ? B[id] : id);
  const stair = (x, yy, z, kind, face) => { const s = STAIRS[B[`${kind}_stairs`]]; if (s) set(x, yy, z, s.ids[face][0]); };
  const jobs = [], beds = [], doors = [], animals = [];

  // Streets: paths with gravel verges, the lane round the inside of the wall, and the plaza.
  for (let s = -R + 1; s <= R - 1; s++) {
    for (let k = -1; k <= 1; k++) { set(k, 0, s, st.road); set(s, 0, k, st.road); }
    if (Math.abs(s) > PLAZA && Math.abs(s) < LANE) {
      for (const k of [-2, 2]) { if (rnd() < 0.7) set(k, 0, s, st.edge); if (rnd() < 0.7) set(s, 0, k, st.edge); }
    }
  }
  for (let s = -LANE - 2; s <= LANE + 2; s++) {
    for (let k = LANE; k <= LANE + 2; k++) for (const sg of [-1, 1]) { set(s, 0, sg * k, st.road); set(sg * k, 0, s, st.road); }
    for (const sg of [-1, 1]) { if (rnd() < 0.5) set(s, 0, sg * (LANE + 3), st.edge); if (rnd() < 0.5) set(sg * (LANE + 3), 0, s, st.edge); }
  }
  for (let z = -PLAZA; z <= PLAZA; z++) for (let x = -PLAZA; x <= PLAZA; x++) set(x, 0, z, Math.abs(x) === PLAZA || Math.abs(z) === PLAZA ? st.found : st.plaza);
  // The well.
  for (let z = -2; z <= 2; z++) for (let x = -2; x <= 2; x++) {
    const rim = Math.abs(x) === 2 || Math.abs(z) === 2;
    set(x, 0, z, rim ? st.found : B.water);
    set(x, -1, z, rim ? st.found : B.water);
    set(x, -2, z, st.found);
    if (rim) set(x, 1, z, st.crest);
  }
  for (const [x, z] of [[-2, -2], [2, -2], [-2, 2], [2, 2]]) { set(x, 1, z, st.fence); set(x, 2, z, st.fence); set(x, 3, z, st.fence); }
  for (let z = -2; z <= 2; z++) for (let x = -2; x <= 2; x++) set(x, 4, z, st.walk);
  set(0, 3, 0, B.lantern_hanging);
  // The bell that calls the village together, beside the well.
  set(-4, 1, 0, B.bell_z);
  // Market stalls round the plaza: striped awnings over a barrel and a counter.
  [[-5, -5], [5, -5], [-5, 5], [5, 5]].forEach(([x, z], i) => {
    const wool = `${st.stall[i % st.stall.length]}_wool`;
    for (const [a, b] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) { set(x + a, 1, z + b, st.fence); set(x + a, 2, z + b, st.fence); }
    for (let b = -1; b <= 1; b++) for (let a = -1; a <= 1; a++) set(x + a, 3, z + b, (a + b) % 2 === 0 ? wool : 'white_wool');
    set(x, 1, z, B.barrel);
    const zf = z < 0 ? 1 : -1; // the counter faces the middle of the plaza
    set(x - 1, 1, z + zf, 'oak_slab'); set(x + 1, 1, z + zf, 'oak_slab');
    jobs.push({ role: 'merchant', work: [cx + x, y + 1, cz + z + zf * 2] });
  });
  for (const [x, z] of [[-PLAZA, -PLAZA], [PLAZA, -PLAZA], [-PLAZA, PLAZA], [PLAZA, PLAZA]]) {
    set(x, 1, z, st.fence); set(x, 2, z, st.fence); set(x, 3, z, B.lantern);
  }

  // The wall: two blocks thick with a walk along the top behind a crenellated parapet.
  const wallBlock = () => (rnd() < 0.18 ? st.wall2 : st.wall);
  for (let s = -R; s <= R; s++) {
    for (const [x, z] of [[s, -R], [s, R], [-R, s], [R, s]]) {
      for (let yy = -3; yy <= 6; yy++) set(x, yy, z, wallBlock());
      if (((x + z) & 1) === 0) set(x, 7, z, wallBlock());
    }
    if (Math.abs(s) >= R) continue;
    for (const [x, z] of [[s, -R + 1], [s, R - 1], [-R + 1, s], [R - 1, s]]) {
      for (let yy = -2; yy <= 4; yy++) set(x, yy, z, wallBlock());
      set(x, 5, z, st.walk);
    }
  }
  // Steps up to the wall walk from the lane, one flight on each side.
  const flights = [[(k) => [10 + k, -(R - 2)], 0], [(k) => [-10 - k, R - 2], 1], [(k) => [-(R - 2), -10 - k], 5], [(k) => [R - 2, 10 + k], 4]];
  for (const [pos, face] of flights) {
    for (let k = 0; k <= 4; k++) {
      const [x, z] = pos(k);
      for (let yy = 0; yy <= k; yy++) set(x, yy, z, st.wall);
      if (k < 4) stair(x, k + 1, z, st.stair, face); else set(x, 5, z, st.walk);
    }
  }
  // Gatehouses: an arch three wide closed by gates, between two towers the wall walk passes through.
  for (const [ax, az] of [[0, -1], [0, 1], [-1, 0], [1, 0]]) {
    const along = ax === 0; // the wall runs along x
    const gx = ax * R, gz = az * R;
    // (u runs along the wall; v steps in towards the town.)
    const at = (u, v, yy, id) => (along ? set(gx + u, yy, gz - v * az, id) : set(gx - v * ax, yy, gz + u, id));
    const out = along ? (az < 0 ? 5 : 4) : (ax < 0 ? 1 : 0), inward = { 5: 4, 4: 5, 0: 1, 1: 0 }[out];
    for (let u = -1; u <= 1; u++) for (let v = 0; v <= 1; v++) { for (let yy = 1; yy <= 3; yy++) at(u, v, yy, 0); at(u, v, 0, st.road); }
    // Fence gates close the arch (zombies can't open them; people can).
    for (let u = -1; u <= 1; u++) at(u, 0, 1, gateId(WOOD[st.gate].gate, out, false));
    for (const side of [-1, 1]) {
      for (let u = 2; u <= 5; u++) for (let v = -1; v <= 2; v++) for (let yy = -3; yy <= 10; yy++) {
        const edge = u === 2 || u === 5 || v === -1 || v === 2;
        at(side * u, v, yy, edge || yy <= 0 ? st.wall : yy === 5 ? st.planks : 0);
      }
      for (let u = 2; u <= 5; u++) for (let v = -1; v <= 2; v++) if ((u + v) % 2 === 0) at(side * u, v, 11, st.wall);
      for (const u of [2, 5]) { at(side * u, 1, 6, 0); at(side * u, 1, 7, 0); }
      at(side * 3, -1, 7, 0); // an arrow slit looking out
      at(side * 4, 0, 6, B.lantern);
      at(side * 2, -2, 3, WALL_TORCH[out]);
      at(side * 2, 3, 3, WALL_TORCH[inward]);
    }
    jobs.push({ role: 'guard', work: along ? [cx + gx, y + 1, cz + gz - az * 4] : [cx + gx - ax * 4, y + 1, cz + gz] });
  }
  // Corner towers: a door from the lane, a ladder up through two floors, and doors out onto the
  // wall walks on both sides.
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const x0 = sx < 0 ? -R : R - 5, z0 = sz < 0 ? -R : R - 5;
    for (let z = z0; z <= z0 + 5; z++) for (let x = x0; x <= x0 + 5; x++) for (let yy = -3; yy <= 11; yy++) {
      const edge = x === x0 || x === x0 + 5 || z === z0 || z === z0 + 5;
      set(x, yy, z, edge || yy <= 0 ? st.wall : yy === 5 || yy === 10 ? st.planks : 0);
    }
    for (let z = z0; z <= z0 + 5; z++) for (let x = x0; x <= x0 + 5; x++) {
      if ((x + z) % 2 === 0 && (x === x0 || x === x0 + 5 || z === z0 || z === z0 + 5)) set(x, 12, z, st.wall);
    }
    const inX = sx < 0 ? x0 + 5 : x0, inZ = sz < 0 ? z0 + 5 : z0;
    set(inX, 1, sz * (R - 3), 0); set(inX, 2, sz * (R - 3), 0);
    set(inX, 6, sz * (R - 1), 0); set(inX, 7, sz * (R - 1), 0);
    set(sx * (R - 1), 6, inZ, 0); set(sx * (R - 1), 7, inZ, 0);
    const lx = sx < 0 ? x0 + 1 : x0 + 4, lz = z0 + 2;
    for (let yy = 1; yy <= 10; yy++) set(lx, yy, lz, LADDER[sx < 0 ? 1 : 0]);
    set(x0 + 2, 9, z0 + 3, B.lantern_hanging);
    set(x0 + 3, 4, z0 + 3, B.lantern_hanging);
  }
  // Torches along the inside of the wall light the lane.
  for (let s = -LANE + 4; s <= LANE - 4; s += 7) {
    if (Math.abs(s) < 7 || (Math.abs(s) >= 9 && Math.abs(s) <= 15)) continue;
    set(s, 3, -(R - 2), WALL_TORCH[4]); set(s, 3, R - 2, WALL_TORCH[5]);
    set(-(R - 2), 3, s, WALL_TORCH[0]); set(R - 2, 3, s, WALL_TORCH[1]);
  }

  // The buildings.
  for (const b of plan.buildings) {
    const lot = new Lot(bp, plan, b);
    BUILD[b.type](lot, b, rnd);
    jobs.push(...lot.jobs); beds.push(...lot.beds); doors.push(...lot.doors); animals.push(...lot.animals);
    b.doors = lot.doors;
  }
  // Lamp posts along the main streets, kept clear of doorways.
  for (let s = 11; s <= FRONT; s += 6) {
    for (const [x, z] of [[2, s], [-2, -s], [s, -2], [-s, 2], [-2, s + 3], [2, -s - 3], [s + 3, 2], [-s - 3, -2]]) {
      if (Math.abs(x) > FRONT || Math.abs(z) > FRONT) continue;
      if (doors.some((d) => Math.abs(d[0] - cx - x) + Math.abs(d[2] - cz - z) <= 2)) continue;
      set(x, 0, z, st.found); set(x, 1, z, st.fence); set(x, 2, z, st.fence); set(x, 3, z, B.lantern);
    }
  }
  // Everyone gets a name and a bed: guards in the barracks first, then the houses.
  const residents = jobs.map((j, i) => ({ id: `${plan.key}:${i}`, role: j.role, work: j.work, name: personName(rnd), bed: null }));
  const free = [...beds];
  const claim = (r, want) => { const i = free.findIndex((b) => b.who === want); if (i >= 0) { r.bed = free[i].at; free.splice(i, 1); } };
  for (const r of residents) if (r.role === 'guard') claim(r, 'guard');
  for (const r of residents) if (!r.bed) claim(r, null);
  for (const r of residents) r.home = r.bed ?? r.work;
  plan.residents = residents;
  plan.animals = animals;
  plan.doors = doors;
  plan.blueprint = bp;
  return bp;
}

// ---------------------------------------------------------------- the buildings
const flowerAt = (st, rnd) => st.flowers[Math.floor(rnd() * st.flowers.length)];
const POTS = ['potted_poppy', 'potted_dandelion', 'potted_cornflower', 'potted_allium', 'potted_oak_sapling'];
const BUILD = {
  house_small(l, b, rnd) {
    const st = l.st, w = b.w, d = b.d;
    l.clear(w, d);
    l.shell(w, d, 3);
    l.entrance(w);
    l.topRoof(w, d, 4);
    l.bed(1, 1, d - 2, 5);
    l.set(w - 2, 1, d - 2, B.crafting_table);
    l.chest(w - 2, 1, 1, 'house', 1);
    l.carpet(1, 1, 1);
    l.set(w >> 1, 3, d >> 1, B.lantern_hanging);
    if (rnd() < 0.5) l.set(1, 1, 2, POTS[Math.floor(rnd() * POTS.length)]);
    if (st.roof && rnd() < 0.6) l.chimney(w - 2, d - 1, 6);
  },
  house_large(l, b, rnd) {
    const st = l.st, w = b.w, d = b.d;
    l.clear(w, d, 12);
    l.shell(w, d, 4);
    l.entrance(w);
    l.torch((w >> 1) - 1, 2, -1, 5);
    l.topRoof(w, d, 5);
    l.bed(1, 1, d - 2, 5); l.bed(w - 2, 1, d - 2, 5);
    l.facing('furnace', 1, 1, 1, 0);
    l.set(w - 2, 1, 1, B.crafting_table);
    l.set(w - 2, 2, 1, B.bookshelf);
    l.chest(w - 3, 1, d - 2, 'house', 5);
    // A table and stools.
    l.set(w >> 1, 1, d >> 1, st.fence); l.carpet(w >> 1, 2, d >> 1);
    l.stairs((w >> 1) - 1, 1, d >> 1, st.roof ?? 'sandstone', 1);
    l.stairs((w >> 1) + 1, 1, d >> 1, st.roof ?? 'sandstone', 0);
    l.set(w >> 1, 4, d >> 1, B.lantern_hanging);
    // Flower boxes under the front windows.
    for (const x of [1, w - 2]) {
      const f = flowerAt(st, rnd);
      l.set(x, 2, 0, st.glass); l.set(x, 1, -1, f === 'cactus' ? B.sand : B[st.soil] ?? B.grass_block); l.set(x, 2, -1, B[f]);
    }
    if (st.roof && rnd() < 0.5) l.chimney(1, d - 1, 8);
  },
  // Two storeys: a stone ground floor with the kitchen, a timber-framed bedroom above.
  house_tall(l, b, rnd) {
    const st = l.st, w = b.w, d = b.d;
    l.clear(w, d, 14);
    l.shell(w, d, 3, { walls: st.found === 'sandstone' ? B.cut_sandstone : B.cobblestone, corners: st.log });
    l.fill(1, 4, 1, w - 2, 4, d - 2, st.floor);
    for (let x = 0; x < w; x++) { l.beam(x, 4, 0); l.beam(x, 4, d - 1); }
    for (let z = 1; z < d - 1; z++) { l.beam(0, 4, z, false); l.beam(w - 1, 4, z, false); }
    l.shell(w, d, 3, { y: 4, floor: false, windows: false });
    for (let yy = 5; yy <= 7; yy++) { l.set(w >> 1, yy, 0, st.log); l.set(w >> 1, yy, d - 1, st.log); }
    for (const x of [1, w - 2]) { l.set(x, 6, 0, st.glass); l.set(x, 6, d - 1, st.glass); }
    l.set(0, 6, d >> 1, st.glass); l.set(w - 1, 6, d >> 1, st.glass);
    l.entrance(w);
    l.topRoof(w, d, 8);
    // Downstairs: kitchen and a ladder up.
    l.facing('furnace', 1, 1, d - 2, 5);
    l.set(2, 1, d - 2, B.barrel);
    l.set(w - 2, 1, 1, B.crafting_table);
    l.ladder(w - 2, 1, 4, d - 2, 4);
    l.set(w >> 1, 3, d >> 1, B.lantern_hanging);
    // Upstairs: two beds and a chest.
    l.bed(1, 5, 2, 4); l.bed(w - 3, 5, 1, 1);
    l.chest(1, 5, d - 2, 'house', 0);
    l.carpet(w >> 1, 5, 2);
    l.set(w >> 1, 7, d >> 1, B.lantern_hanging);
    if (st.roof && rnd() < 0.5) l.chimney(1, d - 1, 10);
  },
  smithy(l, b) {
    const st = l.st, w = b.w, d = b.d;
    l.clear(w, d);
    // Stone floor, a back wall, pillars at the front, and a slab roof.
    l.fill(0, 0, 0, w - 1, 0, d - 1, B.cobblestone);
    for (let y = 1; y <= 4; y++) {
      for (let x = 0; x < w; x++) l.set(x, y, d - 1, B.cobblestone);
      for (let z = 3; z < d; z++) { l.set(0, y, z, B.cobblestone); l.set(w - 1, y, z, B.cobblestone); }
      l.set(0, y, 0, st.log); l.set(w - 1, y, 0, st.log);
    }
    for (let z = -1; z <= d; z++) for (let x = -1; x <= w; x++) l.set(x, 5, z, B.stone_brick_slab);
    l.facing('blast_furnace', 1, 1, d - 2, 5);
    l.facing('furnace', 2, 1, d - 2, 5);
    l.set(3, 1, d - 2, B.smithing_table);
    // The forge: a pool of lava behind iron bars.
    l.set(w - 3, 0, d - 2, B.lava); l.set(w - 2, 0, d - 2, B.lava);
    for (const [x, z] of [[w - 4, d - 2], [w - 3, d - 3], [w - 2, d - 3]]) l.set(x, 1, z, B.iron_bars);
    l.chest(1, 1, 3, 'smith', 0);
    l.facing('anvil', w - 3, 1, 1, 5);
    l.facing('grindstone', 1, 1, 1, 0);
    l.set(w - 2, 1, 1, B.water_cauldron);
    l.set(w >> 1, 4, 2, B.lantern_hanging);
    l.job('blacksmith', w >> 1, 2);
  },
  butcher(l, b) {
    const st = l.st, w = b.w, d = b.d;
    l.clear(w, d);
    l.shell(w, d, 3, { walls: st.found === 'sandstone' ? B.cut_sandstone : B.stone_bricks, corners: st.log });
    l.entrance(w);
    l.topRoof(w, d, 4);
    l.facing('smoker', 1, 1, d - 2, 5);
    l.set(w - 2, 1, d - 2, B.hay_block);
    l.set(w - 2, 1, 1, B.barrel);
    l.set(1, 1, 1, B.cauldron);
    l.set(w >> 1, 3, d >> 1, B.lantern_hanging);
    l.job('butcher', w >> 1, 2);
  },
  hunter(l, b) {
    const st = l.st, w = b.w, d = b.d;
    l.clear(w, d);
    l.shell(w, d, 3, { walls: B.spruce_planks, corners: B.spruce_log });
    l.entrance(w, 'spruce');
    l.roof(w, d, 4, 'spruce', B.spruce_planks);
    l.set(1, 1, d - 2, B.fletching_table);
    l.set(w - 2, 1, d - 2, B.barrel);
    l.chest(w - 2, 1, 1, 'village', 1);
    l.set(1, 1, 1, B.hay_block);
    l.set(w >> 1, 3, d >> 1, B.lantern_hanging);
    // A rack of hides drying out front.
    l.set(0, 1, -1, st.fence); l.set(0, 2, -1, B.brown_carpet);
    l.job('hunter', w >> 1, 2);
  },
  library(l, b) {
    const w = b.w, d = b.d;
    l.clear(w, d);
    l.shell(w, d, 4);
    l.entrance(w);
    l.topRoof(w, d, 5);
    for (let x = 1; x < w - 1; x++) for (let y = 1; y <= 3; y++) l.set(x, y, d - 2, B.bookshelf);
    for (let z = 2; z < d - 2; z++) { l.set(1, 1, z, B.bookshelf); l.set(w - 2, 1, z, B.bookshelf); }
    l.set(w >> 1, 1, 2, B.lectern);
    l.set((w >> 1) + 2, 1, 1, B.cartography_table);
    l.carpet(w >> 1, 1, 3, 'red');
    l.set(w >> 1, 4, d >> 1, B.lantern_hanging);
    l.job('librarian', w >> 1, 1);
  },
  barracks(l, b) {
    const st = l.st, w = b.w, d = b.d;
    l.clear(w, d);
    l.shell(w, d, 4, { walls: st.found === 'sandstone' ? B.sandstone : B.cobblestone, corners: st.wall === 'sandstone' ? B.cut_sandstone : B.stone_bricks,
      windows: false });
    for (let z = 2; z < d - 2; z += 2) { l.set(0, 2, z, B.iron_bars); l.set(w - 1, 2, z, B.iron_bars); }
    l.entrance(w);
    l.torch((w >> 1) - 1, 2, -1, 5);
    l.fill(-1, 5, -1, w, 5, d, B.stone_brick_slab);
    l.bed(1, 1, 2, 4, 'guard'); l.bed(1, 1, d - 3, 4, 'guard'); l.bed(w - 2, 1, 2, 4, 'guard');
    l.chest(w - 2, 1, d - 2, 'smith', 1);
    l.set(w - 2, 1, d - 4, B.anvil);
    l.set(w >> 1, 4, d >> 1, B.lantern_hanging);
  },
  tavern(l, b) {
    const st = l.st, w = b.w, d = b.d;
    l.clear(w, d, 12);
    l.shell(w, d, 4);
    l.entrance(w);
    l.torch((w >> 1) - 1, 2, -1, 5);
    l.topRoof(w, d, 5);
    // A bar along the back, tables with stools.
    for (let x = 1; x < w - 1; x++) l.set(x, 1, d - 3, x === 1 ? 0 : B.barrel);
    l.facing('smoker', w - 2, 1, d - 2, 5);
    l.set(w - 3, 1, d - 2, B.water_cauldron);
    l.set(1, 1, d - 2, B.barrel);
    for (const tx of [2, w - 3]) {
      l.set(tx, 1, 2, st.fence); l.set(tx, 2, 2, B.white_carpet);
      l.stairs(tx - 1, 1, 2, st.roof ?? 'sandstone', 1); l.stairs(tx + 1, 1, 2, st.roof ?? 'sandstone', 0);
    }
    l.set(w >> 1, 4, 2, B.lantern_hanging); l.set(w >> 1, 4, d - 3, B.lantern_hanging);
    l.job('innkeeper', w >> 1, d - 2);
    if (st.roof) l.chimney(w - 2, d - 1, 9);
  },
  bakery(l, b) {
    const st = l.st, w = b.w, d = b.d;
    l.clear(w, d);
    l.shell(w, d, 3, { walls: st.found === 'sandstone' ? B.cut_sandstone : B.bricks, corners: st.log });
    l.entrance(w);
    l.topRoof(w, d, 4);
    l.facing('furnace', 1, 1, d - 2, 5); l.facing('smoker', 2, 1, d - 2, 5);
    l.set(w - 2, 1, d - 2, B.hay_block); l.set(w - 2, 2, d - 2, B.hay_block);
    l.set(w - 2, 1, 1, B.barrel);
    l.set(1, 1, 1, B.crafting_table);
    l.set(w >> 1, 3, d >> 1, B.lantern_hanging);
    l.job('baker', w >> 1, 2);
    if (st.roof) l.chimney(1, d - 1, 6);
  },
  // A stone hut over a shaft with a ladder down to a lit tunnel, where the miner works.
  mine(l, b, rnd) {
    const st = l.st, w = b.w, d = b.d;
    l.clear(w, d);
    l.shell(w, d, 3, { walls: B.cobblestone, corners: st.log, windows: false });
    l.set(0, 2, d >> 1, B.iron_bars); l.set(w - 1, 2, d >> 1, B.iron_bars);
    l.entrance(w);
    l.fill(-1, 4, -1, w, 4, d, B.cobblestone_slab);
    l.chest(1, 1, 1, 'mine', 1);
    l.set(w - 2, 1, 1, B.barrel);
    l.set(w >> 1, 3, 2, B.lantern_hanging);
    // The shaft, lined with cobblestone so no cave leaks into it.
    const sx = w >> 1, sz = d - 3, depth = 16;
    for (let y = -depth; y <= 0; y++) {
      for (let a = -1; a <= 1; a++) for (let c = -1; c <= 1; c++) if (a || c) l.set(sx + a, y, sz + c, B.cobblestone);
      l.set(sx, y, sz, 0);
    }
    l.set(sx, -depth, sz, B.cobblestone);
    l.ladder(sx, -depth + 1, 0, sz, 4);
    // The tunnel runs back towards the front from the foot of the shaft.
    const ores = [B.coal_ore, B.coal_ore, B.iron_ore, B.copper_ore, B.iron_ore, B.gold_ore];
    for (let k = 1; k <= 11; k++) {
      const z = sz - k;
      for (let a = -2; a <= 2; a++) for (let yy = -depth; yy <= -depth + 4; yy++) {
        const shell = Math.abs(a) === 2 || yy === -depth || yy === -depth + 4 || k === 11;
        if (!shell) l.set(sx + a, yy, z, 0);
        else if (yy > -depth && rnd() < 0.1) l.set(sx + a, yy, z, ores[Math.floor(rnd() * ores.length)]);
        else l.set(sx + a, yy, z, yy === -depth ? B.cobblestone : B.stone);
      }
      // Timber supports every few blocks.
      if (k % 3 === 0) {
        for (const a of [-1, 1]) for (let yy = -depth + 1; yy <= -depth + 2; yy++) l.set(sx + a, yy, z, st.fence);
        for (let a = -1; a <= 1; a++) l.set(sx + a, -depth + 3, z, B.oak_planks);
        l.set(sx, -depth + 2, z, 0);
        l.torch(sx - 1, -depth + 2, z + 1, 0);
      }
    }
    l.set(sx + 1, -depth + 1, sz - 10, lootChestId('mine', l.face(5)));
    l.job('miner', sx, 2);
  },
  farm(l, b, rnd) {
    const st = l.st, w = b.w, d = b.d;
    l.clear(w, d, 4);
    const crop = ['wheat', 'wheat', 'carrots', 'potatoes', 'beetroots'][Math.floor(rnd() * 5)];
    const first = B[crop], max = crop === 'wheat' ? 7 : 3;
    for (let z = 0; z < d; z++) for (let x = 0; x < w; x++) {
      const edge = x === 0 || z === 0 || x === w - 1 || z === d - 1;
      if (edge) { l.beam(x, 0, z, z === 0 || z === d - 1); continue; }
      if (x === (w >> 1)) { l.set(x, 0, z, B.water); l.set(x, -1, z, st.found); continue; }
      l.set(x, 0, z, B.farmland_moist);
      l.set(x, 1, z, first + Math.floor(rnd() * (max + 1)));
    }
    l.set(0, 1, 0, B.composter); l.set(w - 1, 1, 0, B.lantern); l.set(w - 1, 1, d - 1, B.hay_block);
    l.chest(0, 1, d - 1, 'farm', 5);
    l.job('farmer', w >> 1, -1);
  },
  pen(l, b, rnd) {
    const st = l.st, w = b.w, d = b.d;
    l.clear(w, d, 4);
    for (let z = 0; z < d; z++) for (let x = 0; x < w; x++) {
      l.set(x, 0, z, st.soil === 'sand' ? B.coarse_dirt : B.grass_block);
      if (x === 0 || z === 0 || x === w - 1 || z === d - 1) l.set(x, 1, z, st.fence);
    }
    l.set(w >> 1, 1, 0, gateId(WOOD[st.gate].gate, l.face(5), false));
    l.set(1, 1, d - 2, B.hay_block); l.set(2, 1, d - 2, B.hay_block); l.set(w - 2, 1, d - 2, B.water_cauldron);
    l.set((w >> 1) + 2, 1, -1, B.loom);
    const kind = ['sheep', 'sheep', 'cow', 'pig', 'chicken'][Math.floor(rnd() * 5)];
    for (let k = 0; k < 3; k++) l.animals.push({ type: kind, at: l.world(2 + k * 2, 1, 3) });
    l.job('shepherd', w >> 1, -1);
  },
  // A vegetable plot behind the houses: a fenced bed of crops round a water hole.
  plot(l, b, rnd) {
    const st = l.st, w = b.w, d = b.d;
    l.clear(w, d, 3);
    const crop = ['carrots', 'potatoes', 'beetroots', 'wheat'][Math.floor(rnd() * 4)], max = crop === 'wheat' ? 7 : 3;
    for (let z = 0; z < d; z++) for (let x = 0; x < w; x++) {
      if (x === 0 || z === 0 || x === w - 1 || z === d - 1) { l.set(x, 0, z, B[st.soil] ?? B.grass_block); l.set(x, 1, z, st.fence); continue; }
      if (x === (w >> 1) && z === (d >> 1)) { l.set(x, 0, z, B.water); l.set(x, -1, z, st.found); continue; }
      l.set(x, 0, z, B.farmland_moist);
      l.set(x, 1, z, B[crop] + Math.floor(rnd() * (max + 1)));
    }
    l.set(w >> 1, 1, 0, gateId(WOOD[st.gate].gate, l.face(5), false));
  },
  // A woodpile, hay and a barrel or two.
  yard(l, b, rnd) {
    const st = l.st, w = b.w;
    l.clear(w, b.d, 4);
    for (let x = 0; x < w - 1; x++) { l.beam(x, 1, b.d - 1); if (rnd() < 0.7) l.beam(x, 2, b.d - 1); }
    l.set(w - 1, 1, b.d - 1, B.hay_block);
    if (rnd() < 0.6) l.set(w - 1, 2, b.d - 1, B.hay_block);
    l.set(0, 1, 0, rnd() < 0.5 ? B.barrel : B.composter);
    if (rnd() < 0.5) l.set(w - 1, 1, 0, B.hay_block);
    if (rnd() < 0.4) l.set(2, 1, 1, st.soil === 'sand' ? B.dead_bush : B.tall_grass);
  },
  // A little garden: a tree, a bed of flowers and a bench.
  garden(l, b, rnd) {
    const st = l.st, w = b.w, d = b.d;
    l.clear(w, d, 9);
    for (let z = 0; z < d; z++) for (let x = 0; x < w; x++) l.set(x, 0, z, B[st.soil] ?? B.grass_block);
    const leaves = WOOD[st.tree].placedLeaves, log = WOOD[st.tree].log, tx = w >> 1, tz = d - 2;
    for (let y = 1; y <= 4; y++) l.set(tx, y, tz, log);
    for (let y = 3; y <= 5; y++) for (let a = -2; a <= 2; a++) for (let c = -2; c <= 1; c++) {
      const r = Math.abs(a) + Math.abs(c) + (y === 5 ? 2 : 0);
      if (r <= 3 && !(a === 0 && c === 0 && y < 5) && rnd() < (r === 3 ? 0.5 : 1)) l.set(tx + a, y, tz + c, leaves);
    }
    l.set(tx, 6, tz, leaves);
    for (let x = 0; x < w; x++) {
      if (x === tx || rnd() > 0.8) continue;
      const f = flowerAt(st, rnd);
      if (f === 'cactus') { l.set(x, 0, 0, B.sand); l.set(x, 1, 0, B.cactus); } else l.set(x, 1, 0, B[f]);
    }
    for (const x of [1, w - 2]) l.stairs(x, 1, 2, st.roof ?? 'sandstone', 4);
    l.set(0, 1, d - 1, B.lantern);
  },
};

const FIRST = ['Ada', 'Bram', 'Cora', 'Dunstan', 'Edda', 'Finn', 'Gwen', 'Hale', 'Ivo', 'Jora', 'Kell', 'Lark', 'Mira', 'Nils', 'Oda', 'Pim',
  'Quill', 'Rosa', 'Sten', 'Tilda', 'Ulf', 'Vera', 'Wren', 'Yara', 'Arlo', 'Bea', 'Cal', 'Dora', 'Emrys', 'Fern', 'Gus', 'Hilde', 'Ines',
  'Jasper', 'Kit', 'Lena', 'Milo', 'Nell', 'Otto', 'Pia', 'Rolf', 'Saga', 'Tam', 'Una', 'Viggo', 'Willa'];
const LAST = ['Ashdown', 'Brook', 'Copperfield', 'Dale', 'Elmstead', 'Fairweather', 'Greenhill', 'Hollow', 'Ironside', 'Juniper', 'Kettle',
  'Longmeadow', 'Millstone', 'Northwood', 'Oakes', 'Pebble', 'Quarry', 'Reed', 'Stonebridge', 'Thatcher', 'Underhill', 'Vale', 'Whitlock', 'Yew'];
function personName(rnd) { return `${FIRST[Math.floor(rnd() * FIRST.length)]} ${LAST[Math.floor(rnd() * LAST.length)]}`; }

// ---------------------------------------------------------------- using it
// Town ground height for a column, or -1: the level inside the wall, easing back to the natural
// height over BLEND columns outside it (`natural`: that column's own height).
export function groundLevel(plans, x, z, natural) {
  for (const p of plans) {
    const d = Math.max(Math.abs(x - p.x), Math.abs(z - p.z));
    if (d <= RADIUS) return p.y;
    if (d <= REACH) {
      const t = (d - RADIUS) / BLEND, s = t * t * (3 - 2 * t);
      return Math.round(p.y + (natural - p.y) * s);
    }
  }
  return -1;
}
export const insideVillage = (plans, x, z, margin = 0) => plans.some((p) => Math.max(Math.abs(x - p.x), Math.abs(z - p.z)) <= RADIUS + margin);

// The village blocks that fall in chunk (cx, cz), for the world generator: a function that
// writes them with `set`.
export function villagePieces(gen, cx, cz, plans = villagesNear(gen, cx, cz)) {
  const out = [];
  for (const p of plans) {
    const list = build(p).chunks.get(`${cx},${cz}`);
    if (list) out.push((set) => { for (let i = 0; i < list.length; i += 4) set(list[i], list[i + 1], list[i + 2], list[i + 3]); });
  }
  return out;
}

// The people of a village, and the animals in its pens (building it if need be).
export function villageResidents(p) { build(p); return p.residents; }
export function villageAnimals(p) { build(p); return p.animals; }
