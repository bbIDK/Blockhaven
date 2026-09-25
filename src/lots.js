// The pieces settlements are built from: the building styles of each biome, a blueprint of the
// blocks sorted by chunk, and lots - one building each, drawn in its own coordinates - with the
// houses, workshops, farms and yards that stand on them. Shared by the walled villages of older
// worlds (villages.js) and the settlements of newer ones (settlements.js).
import { HEIGHT } from './config.js';
import { B, STAIRS, FACING_VARIANTS, LADDER, LOG_AXES, doorId, bedId, lootChestId, gateId, trapdoorId, WOOD, WALL_TORCH } from './blocks.js';
import { BIOME } from './biomes.js';

// The building style of each biome settlements are found in.
export const STYLE_OF = {
  [BIOME.PLAINS]: 'plains', [BIOME.SUNFLOWER_PLAINS]: 'plains', [BIOME.MEADOW]: 'plains', [BIOME.FLOWER_FOREST]: 'plains',
  [BIOME.FOREST]: 'plains', [BIOME.BIRCH_FOREST]: 'plains', [BIOME.SAVANNA]: 'savanna', [BIOME.DESERT]: 'desert', [BIOME.TAIGA]: 'taiga',
  [BIOME.SNOWY_PLAINS]: 'snowy', [BIOME.SNOWY_TAIGA]: 'snowy', [BIOME.CHERRY_GROVE]: 'cherry',
};
// Block names for each style. `roof` names a kind of stairs and slab (desert houses have flat
// roofs), `stair` the stone the steps up the wall are made of, `tree` the gardens' trees.
export const FLOWERS = ['poppy', 'dandelion', 'cornflower', 'allium', 'azure_bluet', 'oxeye_daisy', 'red_tulip', 'lily_of_the_valley'];
export const STYLES = {
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

// Sizes of what can stand on a lot: [across the front, front to back].
export const SIZE = { house_small: [7, 6], house_large: [9, 8], house_tall: [7, 7], smithy: [9, 8], butcher: [7, 7], hunter: [7, 7],
  library: [9, 7], barracks: [9, 9], tavern: [11, 9], bakery: [7, 7], mine: [7, 7], farm: [11, 7], pen: [9, 8], garden: [7, 5],
  plot: [7, 5], yard: [5, 4],
  // (Newer worlds' settlements also have these.)
  cottage: [5, 5], house_long: [11, 6], terrace: [15, 8], manor: [13, 10], church: [9, 15], stable: [13, 7], mason: [9, 7],
  windmill: [7, 7], garrison: [9, 9], chapel: [7, 11], tent: [5, 5], pavilion: [7, 7], wagon: [3, 5], corral: [7, 5], rack: [3, 2],
  woodpile: [4, 2], stump: [2, 2] };
export const HOUSES = ['house_small', 'house_small', 'house_large', 'house_tall', 'house_tall'];

// ---------------------------------------------------------------- laying out
// The ground plan of a settlement as it's laid out: which cells are spoken for (streets, lots) and
// the lots placed so far. Lots keep a free cell between them, with their fronts inside |x| <= fx
// and |z| <= fz of the centre.
export class LotGrid {
  constructor(rx, rz, fx, fz, rnd) {
    this.rx = rx; this.rz = rz; this.fx = fx; this.fz = fz; this.rnd = rnd;
    this.w = 2 * rx + 1;
    this.occ = new Uint8Array(this.w * (2 * rz + 1));
    this.buildings = [];
  }
  free(x0, z0, x1, z1) {
    for (let z = z0 - 1; z <= z1 + 1; z++) for (let x = x0 - 1; x <= x1 + 1; x++) {
      if (Math.abs(x) > this.fx + 1 || Math.abs(z) > this.fz + 1 || this.occ[(z + this.rz) * this.w + x + this.rx]) return false;
    }
    return true;
  }
  take(x0, z0, x1, z1) {
    for (let z = Math.max(z0, -this.rz); z <= Math.min(z1, this.rz); z++) {
      for (let x = Math.max(x0, -this.rx); x <= Math.min(x1, this.rx); x++) this.occ[(z + this.rz) * this.w + x + this.rx] = 1;
    }
  }
  taken(x, z) { return Math.abs(x) > this.rx || Math.abs(z) > this.rz || this.occ[(z + this.rz) * this.w + x + this.rx] === 1; }
  place(type, face, box) {
    if (!this.free(...box)) return false;
    this.take(...box);
    const [w, d] = SIZE[type];
    this.buildings.push({ type, w, d, face, box });
    return true;
  }
  pick(list) { return list[Math.floor(this.rnd() * list.length)]; }
  shuffle(a) {
    for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(this.rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
    return a;
  }
  // A frontage: lots standing side by side along a street, from s0 towards s1. `along` is the axis
  // the street runs on, `front` the line their fronts stand on, `grow` the way they reach back.
  boxAt(fr, s, w, d) {
    const dir = Math.sign(fr.s1 - fr.s0), a = s, b = s + dir * (w - 1), c = fr.front, e = fr.front + fr.grow * (d - 1);
    const u0 = Math.min(a, b), u1 = Math.max(a, b), v0 = Math.min(c, e), v1 = Math.max(c, e);
    return fr.along === 'z' ? [v0, u0, v1, u1] : [u0, v0, u1, v1];
  }
  // Fills frontages from a queue, a lot at a time on each in turn (so the first things in the
  // queue get the best spots on every street). A lot that fits nowhere is left out.
  rows(frontages, queue) {
    const cur = frontages.map((f) => ({ ...f, s: f.s0, dir: Math.sign(f.s1 - f.s0) }));
    let q = 0;
    while (q < queue.length) {
      let placed = false;
      for (const c of cur) {
        if (q >= queue.length) break;
        const [w, d] = SIZE[queue[q]];
        for (let s = c.s; (c.s1 - (s + c.dir * (w - 1))) * c.dir >= 0; s += c.dir) {
          if (!this.place(queue[q], c.face, this.boxAt(c, s, w, d))) continue;
          q++; placed = true;
          c.s = s + c.dir * (w + (this.rnd() < 0.3 ? 2 : 1));
          break;
        }
      }
      if (!placed) q++;
    }
  }
  // Back yards: up to `max` of `types` (gardens, vegetable plots, pens, woodpiles) in the space
  // left behind, facing any way.
  yards(types, max) {
    const spots = [];
    for (let z = -this.fz; z <= this.fz; z += 2) for (let x = -this.fx; x <= this.fx; x += 2) spots.push([x, z]);
    let n = 0;
    for (const [x, z] of this.shuffle(spots)) {
      for (const type of this.shuffle([...types])) {
        const [w, d] = SIZE[type], face = this.pick([4, 5, 0, 1]), sideways = face === 0 || face === 1;
        if (this.place(type, face, [x, z, x + (sideways ? d : w) - 1, z + (sideways ? w : d) - 1])) { n++; break; }
      }
      if (n >= max) break;
    }
  }
}

// ---------------------------------------------------------------- building
// A village's blocks, sorted by chunk: chunk key -> [x, y, z, id, ...]. (Blocks come in runs in
// the same chunk, so the last chunk's list is kept to hand.)
export class Blueprint {
  constructor() { this.chunks = new Map(); this.lastX = null; this.lastZ = null; this.last = null; }
  set(x, y, z, id) {
    if (y < 1 || y >= HEIGHT || id === undefined) return;
    const cx = x >> 4, cz = z >> 4;
    if (cx !== this.lastX || cz !== this.lastZ) {
      const k = `${cx},${cz}`;
      let a = this.chunks.get(k);
      if (!a) this.chunks.set(k, a = []);
      this.lastX = cx; this.lastZ = cz; this.last = a;
    }
    this.last.push(x, y, z, id);
  }
}
// A blueprint that keeps nothing: for working out who lives in a settlement (and where) without
// storing its blocks.
export class DryBlueprint { constructor() { this.dry = true; } set() {} }

// Draws one building in its own coordinates: x across its front (0 at the left), z back from the
// front, y up from the ground. The front faces `face`. Collects the building's beds, the jobs
// done there and the animals kept there.
export class Lot {
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
  // A pitched roof over [x0, x0+w-1] x [z0, z0+d-1] with its eaves at height y: the ridge runs
  // front to back (overhanging the gable ends by a block), or across (`alongX`, flush with them).
  gable(x0, z0, w, d, y, kind, fill, alongX = false) {
    const span = alongX ? d : w, len = alongX ? w : d, half = span >> 1, over = alongX ? 0 : 1;
    const cell = (i, j) => (alongX ? [x0 + j, z0 + i] : [x0 + i, z0 + j]);
    const up = alongX ? [4, 5] : [0, 1];
    for (let i = 0; i <= half; i++) {
      for (let j = -over; j < len + over; j++) {
        const [ax, az] = cell(i, j), [bx, bz] = cell(span - 1 - i, j);
        if (i < half || span % 2 === 0) { this.stairs(ax, y + i, az, kind, up[0]); this.stairs(bx, y + i, bz, kind, up[1]); }
        else this.set(ax, y + i, az, `${kind}_slab`);
      }
      if (i > 0) {
        for (let k = i; k <= span - 1 - i; k++) {
          const [ax, az] = cell(k, 0), [bx, bz] = cell(k, len - 1);
          this.set(ax, y + i - 1, az, fill); this.set(bx, y + i - 1, bz, fill);
        }
      }
    }
  }
  // A roof rising to a point (or a ridge) over [x0, x1] x [z0, z1] from height y; `steep` ones rise
  // two blocks a step, the lower one a full block of `solid`.
  spire(x0, z0, x1, z1, y, kind, steep = false, solid = null) {
    for (let i = 0; ; i++) {
      const a0 = x0 + i, a1 = x1 - i, b0 = z0 + i, b1 = z1 - i, yy = y + (steep ? i * 2 + 1 : i);
      if (a0 > a1 || b0 > b1) break;
      if (steep) for (let x = a0; x <= a1; x++) for (let z = b0; z <= b1; z++) if (x === a0 || x === a1 || z === b0 || z === b1) this.set(x, yy - 1, z, solid);
      if (a1 - a0 <= 1 || b1 - b0 <= 1) {
        for (let x = a0; x <= a1; x++) for (let z = b0; z <= b1; z++) this.set(x, yy, z, `${kind}_slab`);
        break;
      }
      for (let x = a0; x <= a1; x++) { this.stairs(x, yy, b0, kind, 4); this.stairs(x, yy, b1, kind, 5); }
      for (let z = b0 + 1; z < b1; z++) { this.stairs(a0, yy, z, kind, 0); this.stairs(a1, yy, z, kind, 1); }
    }
  }
  // A log lying along local x or z, or standing ('y'), of this style's wood or `wood`.
  log(x, y, z, axis = 'y', wood = null) {
    const id = wood ? WOOD[wood].log : B[this.st.log], axes = LOG_AXES[id];
    if (axis === 'y' || !axes) { this.set(x, y, z, id); return; }
    const worldX = axis === 'x' ? this.ux[0] !== 0 : this.uz[0] !== 0;
    this.set(x, y, z, axes[worldX ? 0 : 1]);
  }
  // A trapdoor of `wood` against its `hinge` side (a local face), open (upright) or shut.
  trapdoor(x, y, z, wood, hinge, open = true, top = false) { this.set(x, y, z, trapdoorId(B[`${wood}_trapdoor`], this.face(hinge), top, open)); }
  // Part of this lot as a lot of its own: local [x0, x0+w-1] x [z0, z0+d-1], its front facing
  // local `face`. (Its width runs across that front.)
  part(x0, z0, w, d, face = 5, type = 'part') {
    const sideways = face === 0 || face === 1, dx = sideways ? d : w, dz = sideways ? w : d;
    const [ax, az] = this.at(x0, z0), [bx, bz] = this.at(x0 + dx - 1, z0 + dz - 1);
    const box = [Math.min(ax, bx) - this.plan.x, Math.min(az, bz) - this.plan.z, Math.max(ax, bx) - this.plan.x, Math.max(az, bz) - this.plan.z];
    return new Lot(this.bp, this.plan, { type, w, d, face: this.face(face), box });
  }
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

// ---------------------------------------------------------------- the buildings
export const flowerAt = (st, rnd) => st.flowers[Math.floor(rnd() * st.flowers.length)];
export const POTS = ['potted_poppy', 'potted_dandelion', 'potted_cornflower', 'potted_allium', 'potted_oak_sapling'];
export const BUILD = {
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
    // A track down the middle of the tunnel, for the ore carts.
    const track = [4, 5].includes(l.face(4)) ? B.rail : B.rail + 1;
    for (let k = 1; k <= 10; k++) l.set(sx, -depth + 1, sz - k, track);
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

export const FIRST = ['Ada', 'Bram', 'Cora', 'Dunstan', 'Edda', 'Finn', 'Gwen', 'Hale', 'Ivo', 'Jora', 'Kell', 'Lark', 'Mira', 'Nils', 'Oda', 'Pim',
  'Quill', 'Rosa', 'Sten', 'Tilda', 'Ulf', 'Vera', 'Wren', 'Yara', 'Arlo', 'Bea', 'Cal', 'Dora', 'Emrys', 'Fern', 'Gus', 'Hilde', 'Ines',
  'Jasper', 'Kit', 'Lena', 'Milo', 'Nell', 'Otto', 'Pia', 'Rolf', 'Saga', 'Tam', 'Una', 'Viggo', 'Willa'];
export const LAST = ['Ashdown', 'Brook', 'Copperfield', 'Dale', 'Elmstead', 'Fairweather', 'Greenhill', 'Hollow', 'Ironside', 'Juniper', 'Kettle',
  'Longmeadow', 'Millstone', 'Northwood', 'Oakes', 'Pebble', 'Quarry', 'Reed', 'Stonebridge', 'Thatcher', 'Underhill', 'Vale', 'Whitlock', 'Yew'];
export function personName(rnd) { return `${FIRST[Math.floor(rnd() * FIRST.length)]} ${LAST[Math.floor(rnd() * LAST.length)]}`; }
