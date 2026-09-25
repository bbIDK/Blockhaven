// Where settlements stand, and how the world generator and the people see them. A settlement is
// planned once from the seed; every chunk it overlaps copies its share of the blocks, so they all
// agree, and the people who live there are listed on the plan (see civilians.js).
//
// Worlds from generators 2 and 3 have walled villages, one to a region: inside a ring of stone
// walls - corner towers, a gatehouse on every side and a walk along the top - two main streets
// cross at a plaza with a well, a bell and market stalls, and a lane runs round the inside of the
// wall. Houses and workshops line the streets and the lane, with farms, pens, gardens and a mine
// behind. They're planned here, exactly as they always were, so no village anyone has found is
// cut in half. Newer worlds (generator 4) have settlements of every size instead, from camps in
// the woods to walled kingdoms (settlements.js).
import { SEA_LEVEL } from './config.js';
import { B, STAIRS, LADDER, gateId, WOOD, WALL_TORCH, LOOT_KIND } from './blocks.js';
import { hash2, mulberry32 } from './math.js';
import { STYLE_OF, STYLES, HOUSES, LotGrid, Blueprint, DryBlueprint, Lot, BUILD, personName } from './lots.js';
import { MAJOR, MINOR, MAX_REACH, CAMP_REACH, planRegion, planCamp, build4 } from './settlements.js';

export const RADIUS = 34;  // from the centre to the outer face of the wall
const LANE = RADIUS - 5;   // the lane inside the wall runs LANE..LANE+2 from the centre
const FRONT = LANE - 2;    // lots on the lane have their fronts on this line (their steps on the next)
const PLAZA = 7;
const BLEND = 7;           // columns outside the wall over which the ground eases back to nature
const REACH = RADIUS + BLEND;
// The world is divided into square regions that may hold one village each, somewhere away from
// their edges. Worlds made since villages were spread out (generator 3) have larger regions, fewer
// of them with a village, and villages kept well inside them, so neighbours are at least 320 blocks
// apart; older worlds keep their layout (so no village they've found is cut in half). Generator 4
// has regions the size of generator 3's (see settlements.js), and a finer grid of its own for camps.
const SPREAD = {
  2: { size: 24 * 16, margin: REACH + 16, chance: 0.8 },
  3: { size: 40 * 16, margin: 160, chance: 0.7 },
};
const spread = (gen) => (gen.version >= 4 ? MAJOR : SPREAD[gen.version >= 3 ? 3 : 2]);

// How far (x, z) is outside a settlement's bounds (<= 0 inside them).
export const outside = (p, x, z) => Math.max(Math.abs(x - p.x) - p.rx, Math.abs(z - p.z) - p.rz);

// ---------------------------------------------------------------- planning
// World, grid and cell -> plan or null; the most recently used last.
const plans = new Map();
function cached(key, make) {
  if (plans.has(key)) {
    const p = plans.get(key);
    plans.delete(key); plans.set(key, p);
    return p;
  }
  const p = make();
  plans.set(key, p);
  if (plans.size > 160) plans.delete(plans.keys().next().value);
  return p;
}

// The settlement of region (rx, rz), or null if it has none.
export function regionVillage(gen, rx, rz) {
  const key = `${rx},${rz}`;
  return cached(`${gen.seed}:${gen.type}:${gen.version}:${key}`, () => {
    if (!gen.villages) return null;
    const rnd = mulberry32(Math.floor(hash2(rx, rz, gen.seed ^ 0x7111a9e) * 4294967296));
    // The regions around the origin try hard, so every world has a village near spawn.
    const home = (rx === 0 || rx === -1) && (rz === 0 || rz === -1);
    let plan = null;
    if (gen.version >= 4) plan = planRegion(gen, rx, rz, rnd, home);
    else {
      const { size, margin, chance } = spread(gen);
      const tries = home ? 40 : (rnd() < chance ? 3 : 0);
      for (let t = 0; t < tries && !plan; t++) {
        const span = size - margin * 2;
        const cx = rx * size + margin + Math.floor(rnd() * span);
        const cz = rz * size + margin + Math.floor(rnd() * span);
        plan = site(gen, cx, cz, rnd);
      }
    }
    if (plan) plan.key = key;
    return plan;
  });
}

// The camp in cell (cx, cz) of the finer grid (generator 4), or null.
export function cellCamp(gen, cx, cz) {
  const key = `c${cx},${cz}`;
  return cached(`${gen.seed}:${gen.type}:${gen.version}:${key}`, () => {
    if (!gen.villages || gen.version < 4) return null;
    const rnd = mulberry32(Math.floor(hash2(cx, cz, gen.seed ^ 0x3ca5e11) * 4294967296));
    // (Not too near a town: that's where the camp would be.)
    const clear = (x, z, margin) => !majorAround(gen, x, z).some((p) => outside(p, x, z) <= margin);
    const plan = planCamp(gen, cx, cz, rnd, clear);
    if (plan) plan.key = key;
    return plan;
  });
}

// The settlements of the regions round (x, z).
function majorAround(gen, x, z) {
  const size = spread(gen).size, rx = Math.floor(x / size), rz = Math.floor(z / size), out = [];
  for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) {
    const p = regionVillage(gen, rx + dx, rz + dz);
    if (p) out.push(p);
  }
  return out;
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

// Settlements whose grounds reach into chunk (cx, cz).
export function villagesNear(gen, cx, cz) {
  const out = [];
  const x = cx * 16 + 8, z = cz * 16 + 8, span = spread(gen).size, v4 = gen.version >= 4;
  // (Generator 4 also counts those just short of the chunk, whose clearings keep trees rooted in it back.)
  const reach = v4 ? MAX_REACH : REACH, near = (p) => outside(p, x, z) <= p.blend + (v4 ? 12 : 8);
  for (let rz = Math.floor((z - reach - 16) / span); rz <= Math.floor((z + reach + 16) / span); rz++) {
    for (let rx = Math.floor((x - reach - 16) / span); rx <= Math.floor((x + reach + 16) / span); rx++) {
      const p = regionVillage(gen, rx, rz);
      if (p && near(p)) out.push(p);
    }
  }
  if (v4 && gen.villages) {
    const cell = MINOR.size, r = CAMP_REACH + 16;
    for (let kz = Math.floor((z - r) / cell); kz <= Math.floor((z + r) / cell); kz++) {
      for (let kx = Math.floor((x - r) / cell); kx <= Math.floor((x + r) / cell); kx++) {
        const p = cellCamp(gen, kx, kz);
        if (p && near(p)) out.push(p);
      }
    }
  }
  return out;
}

// The kinds of settlement, smallest first; /locate looks for one of them, or any but a camp.
export const KINDS = ['camp', 'hamlet', 'village', 'town', 'kingdom'];
const kindOf = (p) => p.tier ?? 'village';

// The nearest settlement of `kind` (null: any but a camp) to (x, z) within `regions` regions, or
// null (for /locate).
export function nearestVillage(gen, x, z, regions = 3, kind = null) {
  let best = null, bd = Infinity;
  const consider = (p) => {
    if (!p || (kind ? kindOf(p) !== kind : kindOf(p) === 'camp')) return;
    const d = Math.hypot(p.x - x, p.z - z);
    if (d < bd) { bd = d; best = p; }
  };
  if (kind === 'camp') {
    if (gen.version < 4) return null;
    const cell = MINOR.size, k = Math.ceil(regions * spread(gen).size / cell / 2), kx0 = Math.floor(x / cell), kz0 = Math.floor(z / cell);
    for (let kz = kz0 - k; kz <= kz0 + k; kz++) for (let kx = kx0 - k; kx <= kx0 + k; kx++) consider(cellCamp(gen, kx, kz));
    return best;
  }
  const span = spread(gen).size, rx0 = Math.floor(x / span), rz0 = Math.floor(z / span);
  for (let rz = rz0 - regions; rz <= rz0 + regions; rz++) for (let rx = rx0 - regions; rx <= rx0 + regions; rx++) consider(regionVillage(gen, rx, rz));
  return best;
}

// The settlement whose bounds (x, z) is inside (give or take `margin`), if any.
export function villageAt(gen, x, z, margin = 0) {
  if (!gen?.villages) return null;
  const span = spread(gen).size, rx = Math.floor(x / span), rz = Math.floor(z / span);
  for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) {
    const p = regionVillage(gen, rx + dx, rz + dz);
    if (p && outside(p, x, z) <= margin) return p;
  }
  if (gen.version >= 4) {
    const cell = MINOR.size, kx = Math.floor(x / cell), kz = Math.floor(z / cell);
    for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) {
      const p = cellCamp(gen, kx + dx, kz + dz);
      if (p && outside(p, x, z) <= margin) return p;
    }
  }
  return null;
}

// Where things go: the streets, then lots along them with their doors on the street.
function layout(plan) {
  const { rnd } = plan;
  const R = RADIUS;
  const g = new LotGrid(R, R, FRONT, FRONT, rnd);
  g.take(-2, -R, 2, R); g.take(-R, -2, R, 2); g.take(-PLAZA, -PLAZA, PLAZA, PLAZA);
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
  const bf = g.pick(street);
  g.rows([{ ...bf, s0: bf.s1, s1: bf.s0 }], ['barracks']);
  g.rows(g.shuffle([...street]), [...g.shuffle(['tavern', 'library', 'smithy', 'bakery', 'butcher', 'hunter']),
    ...Array.from({ length: 12 }, () => g.pick(HOUSES))]);
  // Lots on the lane inside the wall, facing it.
  const lane = [];
  for (const half of [-1, 1]) {
    lane.push({ along: 'x', front: -FRONT, grow: 1, face: 5, s0: half * 4, s1: half * FRONT },
      { along: 'x', front: FRONT, grow: -1, face: 4, s0: half * 4, s1: half * FRONT },
      { along: 'z', front: -FRONT, grow: 1, face: 1, s0: half * 4, s1: half * FRONT },
      { along: 'z', front: FRONT, grow: -1, face: 0, s0: half * 4, s1: half * FRONT });
  }
  g.rows(g.shuffle(lane), ['mine', 'farm', 'farm', ...g.shuffle(['farm', 'pen', 'pen', 'garden', 'garden', ...Array.from({ length: 9 }, () => g.pick(HOUSES))])]);
  // Back yards: gardens, vegetable plots, pens and woodpiles in the space left behind.
  g.yards(['garden', 'plot', 'yard', 'pen', 'garden', 'plot'], 16);
  plan.buildings = g.buildings;
  plan.radius = R;
  plan.blueprint = null;
  plan.residents = [];
  plan.animals = [];
  plan.rnd = null;
  plan.seed = Math.floor(rnd() * 4294967296);
  // (What the rest of the game knows of every settlement: its bounds, where the ground eases back
  // to nature, and the squares where people meet.)
  Object.assign(plan, { gen: 3, tier: 'village', rx: R, rz: R, blend: BLEND, squares: [[0, 0, PLAZA]] });
  return plan;
}

// ---------------------------------------------------------------- building
// Draws a village of the older worlds into blueprint `bp`, and lists its people.
function build(plan, bp) {
  const st = plan.style, R = RADIUS, { x: cx, y, z: cz } = plan;
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
}


// A plan's blocks (and people), worked out on first use. `dry`: only who lives there is wanted,
// so the blocks needn't be kept.
function built(plan, dry = false) {
  if (plan.blueprint || (dry && plan.built)) return plan.blueprint;
  const bp = dry ? new DryBlueprint() : new Blueprint();
  if (plan.gen >= 4) build4(plan, bp); else build(plan, bp);
  plan.built = true;
  if (!dry) plan.blueprint = bp; else plan.chests = bp.chests;
  return bp;
}

// ---------------------------------------------------------------- using it
// Town ground height for a column, or -1: the level inside the settlement's bounds, easing back to
// the natural height over the next few columns outside them (`natural`: that column's own height).
export function groundLevel(plans, x, z, natural) {
  for (const p of plans) {
    const d = outside(p, x, z);
    if (d <= 0) return p.y;
    if (d <= p.blend) {
      const t = d / p.blend, s = t * t * (3 - 2 * t);
      return Math.round(p.y + (natural - p.y) * s);
    }
  }
  return -1;
}
export const insideVillage = (plans, x, z, margin = 0) => plans.some((p) => outside(p, x, z) <= margin);

// The settlement blocks that fall in chunk (cx, cz), for the world generator: a function that
// writes them with `set`.
export function villagePieces(gen, cx, cz, plans = villagesNear(gen, cx, cz)) {
  const out = [];
  for (const p of plans) {
    const list = built(p).chunks.get(`${cx},${cz}`);
    if (list) out.push((set) => { for (let i = 0; i < list.length; i += 4) set(list[i], list[i + 1], list[i + 2], list[i + 3]); });
  }
  return out;
}

// The people of a settlement, and the animals in its pens.
export function villageResidents(p) { built(p, true); return p.residents; }
export function villageAnimals(p) { built(p, true); return p.animals; }
// Where a settlement's own chests are ("x,y,z"; see DryBlueprint).
export function villageChests(p) {
  built(p, true);
  if (!p.chests && p.blueprint) {
    p.chests = new Set();
    for (const a of p.blueprint.chunks.values()) for (let i = 0; i < a.length; i += 4) if (LOOT_KIND[a[i + 3]] !== undefined) p.chests.add(`${a[i]},${a[i + 1]},${a[i + 2]}`);
  }
  return p.chests ?? new Set();
}
