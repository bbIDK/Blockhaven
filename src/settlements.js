// Settlements of the newer worlds (generator 4), no two alike. Out in the woods, a few tents round
// a campfire; hamlets of a handful of houses behind a fence or a palisade; walled villages, bigger
// than those of older worlds; towns with tall walls and towers, a grid of streets, a market square
// and a church; and kingdoms, whose great walls ring a city with a castle at its heart, where the
// king and queen hold court. Each picks its own size, shape, walls, streets, roofs and stone, and
// the bigger it is, the more people live there. (villages.js decides where they go and hands
// them to the world generator.)
import { SEA_LEVEL } from './config.js';
import { B, STAIRS, LADDER, LOG_AXES, gateId, lootChestId, WOOD, WALL_TORCH } from './blocks.js';
import { BIOME } from './biomes.js';
import { mulberry32 } from './math.js';
import { STYLES, SIZE, LotGrid, Lot, BUILD, POTS, personName, flowerAt } from './lots.js';

// ---------------------------------------------------------------- where they go
// The world is divided into regions that may hold a settlement each (a hamlet, village, town or
// kingdom), kept 160 blocks inside their edges so neighbours are at least 320 apart. Camps have a
// finer grid of their own, and keep away from the rest.
export const MAJOR = { size: 40 * 16, margin: 160, chance: 0.75 };
export const MINOR = { size: 14 * 16, margin: 32, chance: 0.45 };
export const MAX_REACH = 96;  // the furthest a settlement's grounds reach from its centre
export const CAMP_REACH = 20;

// Sizes: half the width `r` (to the outer face of the wall), how much longer one way than the other
// they may be, how far the ground eases back to nature outside, the plaza's half-width, how uneven
// the land under them may be, and the walls and street plans they come with.
const TIERS = {
  hamlet: { r: [17, 22], oblong: 0.3, blend: 6, plaza: 4, flat: 12, walls: ['fence', 'fence', 'drystone', 'palisade', 'none'],
    streets: ['main', 'main', 'cross'] },
  village: { r: [37, 42], oblong: 0.2, blend: 7, plaza: 7, flat: 20, walls: ['stone', 'stone', 'palisade'], streets: ['cross'] },
  town: { r: [49, 55], oblong: 0.12, blend: 8, plaza: 9, flat: 24, walls: ['tall'], streets: ['grid'] },
  kingdom: { r: [66, 70], oblong: 0, blend: 9, plaza: 7, flat: 28, walls: ['grand'], streets: ['castle'] },
};
const TIER_ODDS = [['hamlet', 0.18], ['village', 0.37], ['town', 0.25], ['kingdom', 0.2]];
const SMALLER = { kingdom: 'town', town: 'village', village: 'hamlet', hamlet: 'hamlet' };
// Walls: thickness (a palisade's includes the walkway behind it) and height.
const WALLS = {
  none: { t: 0, h: [0, 0] }, fence: { t: 1, h: [1, 1] }, drystone: { t: 1, h: [1, 1] }, palisade: { t: 2, h: [5, 6] },
  stone: { t: 2, h: [6, 7] }, tall: { t: 3, h: [8, 9] }, grand: { t: 3, h: [10, 12] },
};
const CASTLE = 20; // the castle's half-width, to the outer face of its curtain wall

// Styles for the biomes the older villages don't stand in.
const MORE_STYLES = {
  birch: { ...STYLES.plains, planks: 'birch_planks', log: 'birch_log', roof: 'dark_oak', door: 'birch', fence: 'birch_fence', gate: 'birch',
    floor: 'birch_planks', tree: 'birch', accent: 'lime', stall: ['lime', 'yellow', 'white', 'green'] },
  dark: { ...STYLES.taiga, planks: 'dark_oak_planks', log: 'dark_oak_log', roof: 'spruce', door: 'dark_oak', fence: 'dark_oak_fence', gate: 'dark_oak',
    floor: 'dark_oak_planks', tree: 'dark_oak', soil: 'grass_block', flowers: ['fern', 'lily_of_the_valley', 'fern'], accent: 'green',
    stall: ['green', 'brown', 'red', 'gray'] },
  jungle: { ...STYLES.plains, wall: 'mossy_cobblestone', wall2: 'cobblestone', stair: 'mossy_cobblestone', crest: 'mossy_cobblestone_wall',
    planks: 'jungle_planks', log: 'jungle_log', roof: 'jungle', door: 'jungle', fence: 'jungle_fence', gate: 'jungle', floor: 'jungle_planks',
    tree: 'jungle', flowers: ['fern', 'poppy', 'dandelion'], accent: 'lime', stall: ['lime', 'green', 'yellow', 'orange'] },
};
const STYLE_OF = {
  [BIOME.PLAINS]: 'plains', [BIOME.SUNFLOWER_PLAINS]: 'plains', [BIOME.MEADOW]: 'plains', [BIOME.FLOWER_FOREST]: 'plains',
  [BIOME.FOREST]: 'plains', [BIOME.BIRCH_FOREST]: 'birch', [BIOME.OLD_GROWTH_BIRCH]: 'birch', [BIOME.DARK_FOREST]: 'dark',
  [BIOME.TAIGA]: 'taiga', [BIOME.OLD_GROWTH_TAIGA]: 'taiga', [BIOME.WINDSWEPT_FOREST]: 'taiga', [BIOME.SNOWY_PLAINS]: 'snowy',
  [BIOME.SNOWY_TAIGA]: 'snowy', [BIOME.SAVANNA]: 'savanna', [BIOME.DESERT]: 'desert', [BIOME.CHERRY_GROVE]: 'cherry',
  [BIOME.JUNGLE]: 'jungle', [BIOME.SPARSE_JUNGLE]: 'jungle',
};
// Stone for walls: the main block, a mossy or worn one mixed in, what the steps, crests and slabs
// are made of.
const STONES = {
  stone_bricks: { wall: 'stone_bricks', wall2: 'mossy_stone_bricks', wall3: 'cracked_stone_bricks', stair: 'stone_brick', crest: 'stone_brick_wall' },
  cobblestone: { wall: 'cobblestone', wall2: 'mossy_cobblestone', wall3: 'cobblestone', stair: 'cobblestone', crest: 'cobblestone_wall' },
  andesite: { wall: 'polished_andesite', wall2: 'andesite', wall3: 'stone_bricks', stair: 'polished_andesite', crest: 'andesite_wall' },
  deepslate: { wall: 'deepslate_bricks', wall2: 'cobbled_deepslate', wall3: 'deepslate_bricks', stair: 'deepslate_brick', crest: 'deepslate_brick_wall' },
  sandstone: { wall: 'sandstone', wall2: 'cut_sandstone', wall3: 'chiseled_sandstone', stair: 'sandstone', crest: 'sandstone_wall' },
  red_sandstone: { wall: 'red_sandstone', wall2: 'cut_red_sandstone', wall3: 'chiseled_red_sandstone', stair: 'red_sandstone', crest: 'red_sandstone_wall' },
  mossy: { wall: 'mossy_cobblestone', wall2: 'cobblestone', wall3: 'mossy_stone_bricks', stair: 'mossy_cobblestone', crest: 'mossy_cobblestone_wall' },
};
// What each style's settlements choose between, so neighbours in the same land still differ.
const VARIANTS = {
  plains: { stone: ['stone_bricks', 'stone_bricks', 'cobblestone', 'andesite'], roof: ['spruce', 'spruce', 'dark_oak', 'oak', 'brick'],
    plaza: ['cobblestone', 'stone_bricks', 'polished_andesite'], accent: ['white', 'red', 'blue', 'yellow'] },
  birch: { stone: ['andesite', 'stone_bricks'], roof: ['dark_oak', 'spruce', 'deepslate_brick'], plaza: ['polished_andesite', 'stone_bricks'],
    accent: ['lime', 'white', 'yellow'] },
  dark: { stone: ['cobblestone', 'mossy', 'deepslate'], roof: ['spruce', 'deepslate_brick', 'dark_oak'], plaza: ['cobblestone', 'mossy_cobblestone'],
    accent: ['green', 'brown', 'gray'] },
  taiga: { stone: ['cobblestone', 'cobblestone', 'deepslate', 'stone_bricks'], roof: ['dark_oak', 'spruce', 'deepslate_brick'],
    plaza: ['cobblestone', 'stone_bricks'], accent: ['brown', 'red', 'green'] },
  snowy: { stone: ['stone_bricks', 'deepslate', 'cobblestone'], roof: ['spruce', 'dark_oak', 'deepslate_brick'], plaza: ['stone_bricks', 'polished_andesite'],
    accent: ['light_blue', 'blue', 'white'] },
  savanna: { stone: ['red_sandstone', 'red_sandstone', 'cobblestone'], roof: ['acacia', 'acacia', 'dark_oak'], plaza: ['cut_red_sandstone', 'coarse_dirt'],
    accent: ['orange', 'yellow', 'red'] },
  desert: { stone: ['sandstone'], plaza: ['cut_sandstone', 'smooth_stone'], accent: ['orange', 'yellow', 'cyan'] },
  cherry: { stone: ['stone_bricks', 'andesite'], roof: ['dark_oak', 'cherry', 'spruce'], plaza: ['polished_andesite', 'stone_bricks'],
    accent: ['pink', 'magenta', 'white'] },
  jungle: { stone: ['mossy', 'cobblestone'], roof: ['jungle', 'acacia', 'dark_oak'], plaza: ['mossy_cobblestone', 'cobblestone'],
    accent: ['lime', 'yellow', 'orange'] },
};
function styleFor(name, rnd) {
  const pick = (list) => list[Math.floor(rnd() * list.length)];
  const st = { ...(STYLES[name] ?? MORE_STYLES[name]) }, v = VARIANTS[name];
  Object.assign(st, STONES[pick(v.stone)]);
  if (v.roof) st.roof = pick(v.roof);
  st.plaza = pick(v.plaza);
  st.accent = pick(v.accent);
  st.walk = st.roof ? `${st.roof}_slab` : 'sandstone_slab';
  // The settlement's own colour: its banners, its flag, the knights' tabards.
  st.banner = pick(['red', 'blue', 'yellow', 'purple', 'green', 'black', 'white', 'orange', 'cyan']);
  return st;
}

const pickTier = (rnd) => {
  let k = rnd();
  for (const [tier, p] of TIER_ODDS) if ((k -= p) < 0) return tier;
  return 'village';
};

// The settlement of region (rx, rz), or null. A dozen spots in the region are looked at; the
// first level and dry enough for the size chosen gets it, and if none is, a smaller one will do.
export function planRegion(gen, rx, rz, rnd, home) {
  const { size, margin, chance } = MAJOR, span = size - margin * 2;
  if (!home && rnd() >= chance) return null;
  const spots = [];
  for (let i = 0; i < (home ? 30 : 12); i++) spots.push([rx * size + margin + Math.floor(rnd() * span), rz * size + margin + Math.floor(rnd() * span)]);
  for (let tier = pickTier(rnd); ; tier = SMALLER[tier]) {
    for (const [cx, cz] of spots) {
      const plan = site(gen, cx, cz, rnd, tier);
      if (plan) return plan;
    }
    if (tier === 'hamlet') return null;
  }
}

// Is (cx, cz) a good spot for a `tier`? Level enough, dry, in a biome that has settlements.
function site(gen, cx, cz, rnd, tier) {
  const styleName = STYLE_OF[gen.sample(cx, cz).biome];
  if (!styleName) return null;
  const T = TIERS[tier];
  const r = T.r[0] + Math.floor(rnd() * (T.r[1] - T.r[0] + 1));
  let rx = r, rz = r;
  if (T.oblong) {
    const d = Math.round(r * T.oblong * rnd());
    if (rnd() < 0.5) { rx += d; rz -= d; } else { rx -= d; rz += d; }
  }
  const y = survey(gen, cx, cz, rx, rz, T.flat);
  if (y === null) return null;
  return layoutTown({ gen: 4, tier, x: cx, z: cz, y, rx, rz, blend: T.blend, styleName, style: styleFor(styleName, rnd), rnd });
}

// The ground level for a settlement reaching (rx, rz) from (cx, cz): the middle height of the land
// under it, or null where that's too uneven or wet. (A little water at the edges is fine - the
// ground is raised over it - but not in the middle.)
function survey(gen, cx, cz, rx, rz, flat) {
  // (A quick look at the corners and edges first: most spots fail on those alone.)
  let lo = Infinity, hi = -Infinity;
  for (const [fx, fz] of [[-1, -1], [0, -1], [1, -1], [-1, 0], [0, 0], [1, 0], [-1, 1], [0, 1], [1, 1]]) {
    const s = gen.sample(cx + fx * rx, cz + fz * rz);
    if (s.height <= SEA_LEVEL + 1 && Math.abs(fx) + Math.abs(fz) === 0) return null;
    if (s.height > SEA_LEVEL + 1) { lo = Math.min(lo, s.height); hi = Math.max(hi, s.height); }
  }
  if (hi - lo > flat + 12) return null;
  const step = Math.max(5, Math.round(Math.max(rx, rz) / 5)), hs = [];
  let wet = 0, n = 0;
  for (let dz = -rz; dz <= rz; dz += step) for (let dx = -rx; dx <= rx; dx += step) {
    n++;
    const s = gen.sample(cx + dx, cz + dz);
    if (s.height <= SEA_LEVEL + 1) {
      if (Math.abs(dx) < rx * 0.6 && Math.abs(dz) < rz * 0.6) return null;
      wet++;
      continue;
    }
    hs.push(s.height);
  }
  if (wet > n * 0.08 || hs.length < 4) return null;
  hs.sort((a, b) => a - b);
  const cut = Math.max(1, Math.floor(hs.length * 0.04));
  if (hs[hs.length - 1 - cut] - hs[cut] > flat) return null;
  return Math.max(SEA_LEVEL + 2, hs[hs.length >> 1]);
}

// Camps: in the woods mostly, now and then out on the grass.
const CAMP_STYLE = {
  [BIOME.FOREST]: 'plains', [BIOME.FLOWER_FOREST]: 'plains', [BIOME.BIRCH_FOREST]: 'birch', [BIOME.OLD_GROWTH_BIRCH]: 'birch',
  [BIOME.DARK_FOREST]: 'dark', [BIOME.TAIGA]: 'taiga', [BIOME.OLD_GROWTH_TAIGA]: 'taiga', [BIOME.WINDSWEPT_FOREST]: 'taiga',
  [BIOME.SNOWY_TAIGA]: 'snowy', [BIOME.JUNGLE]: 'jungle', [BIOME.SPARSE_JUNGLE]: 'jungle', [BIOME.CHERRY_GROVE]: 'cherry',
  [BIOME.MEADOW]: 'plains', [BIOME.SAVANNA]: 'savanna', [BIOME.PLAINS]: 'plains', [BIOME.SNOWY_PLAINS]: 'snowy',
};
const OPEN_GROUND = new Set([BIOME.PLAINS, BIOME.MEADOW, BIOME.SAVANNA, BIOME.SNOWY_PLAINS]);
// Who camps where: hunters in the cold forests, woodcutters in the woods, travellers on the roads.
const CAMP_KINDS = {
  hunters: { roles: ['hunter', 'hunter', 'woodcutter', 'hunter'], tents: ['brown', 'white', 'green'] },
  woodcutters: { roles: ['woodcutter', 'woodcutter', 'hunter', 'woodcutter'], tents: ['white', 'light_gray', 'brown'] },
  travellers: { roles: ['traveller', 'merchant', 'traveller', 'fisher'], tents: ['striped'] },
};

// The camp in cell (kx, kz) of the camps' grid, or null. `clear(x, z, margin)`: no other settlement
// within `margin` of (x, z).
export function planCamp(gen, kx, kz, rnd, clear) {
  if (rnd() >= MINOR.chance) return null;
  const { size, margin } = MINOR, span = size - margin * 2;
  for (let t = 0; t < 2; t++) {
    const x = kx * size + margin + Math.floor(rnd() * span), z = kz * size + margin + Math.floor(rnd() * span);
    const biome = gen.sample(x, z).biome, styleName = CAMP_STYLE[biome];
    if (!styleName || (OPEN_GROUND.has(biome) && rnd() < 0.7)) continue;
    const r = 12 + Math.floor(rnd() * 2);
    if (!clear(x, z, r + 48)) continue;
    const y = survey(gen, x, z, r, r, 6);
    if (y === null) continue;
    const cold = styleName === 'taiga' || styleName === 'snowy', open = OPEN_GROUND.has(biome) || styleName === 'cherry' || styleName === 'savanna';
    const kind = rnd() < 0.5 ? (open ? 'travellers' : cold ? 'hunters' : 'woodcutters') : ['hunters', 'woodcutters', 'travellers'][Math.floor(rnd() * 3)];
    return layoutCamp({ gen: 4, tier: 'camp', camp: kind, x, z, y, rx: r, rz: r, blend: 6, styleName, style: styleFor(styleName, rnd), rnd });
  }
  return null;
}

// ---------------------------------------------------------------- laying out
// A street: cells along `axis` from a to b, `half` either side of the line at c (and a verge
// beyond that).
const streetCells = (s, a, k) => (s.axis === 'x' ? [a, s.c + k] : [s.c + k, a]);
// The frontages either side of street `s` between s0 and s1: where lots stand with their doors on it.
const frontsOf = (s, s0, s1) => [-1, 1].map((side) => (s.axis === 'x'
  ? { along: 'x', front: s.c + side * (s.half + 3), grow: side, face: side < 0 ? 4 : 5, s0, s1 }
  : { along: 'z', front: s.c + side * (s.half + 3), grow: side, face: side < 0 ? 0 : 1, s0, s1 }));
const repeat = (n, f) => Array.from({ length: n }, f);

// Where everything goes in a hamlet, village, town or kingdom: walls, streets, squares, and lots
// along the streets and the lane inside the wall, the biggest and busiest nearest the middle.
function layoutTown(plan) {
  const { rnd, tier, rx, rz } = plan, T = TIERS[tier];
  const pick = (list) => list[Math.floor(rnd() * list.length)];
  const kind = pick(T.walls), W = WALLS[kind];
  const wall = plan.wall = { kind, t: W.t, h: W.h[0] + Math.floor(rnd() * (W.h[1] - W.h[0] + 1)), crenel: rnd() < 0.5 ? 2 : 3 };
  const t = wall.t;
  plan.lane = tier !== 'hamlet' && t >= 2;
  // Lots keep their fronts inside these (the lane's inner edge is two further out).
  const fx = plan.lane ? rx - t - 5 : rx - Math.max(t, 1) - 2, fz = plan.lane ? rz - t - 5 : rz - Math.max(t, 1) - 2;
  plan.fx = fx; plan.fz = fz;
  const g = new LotGrid(rx, rz, fx, fz, rnd);
  const streets = plan.streets = [];
  const street = (axis, c, a, b, half = 1) => {
    const s = { axis, c, a, b, half };
    streets.push(s);
    const e = half + 1;
    if (axis === 'x') g.take(a, c - e, b, c + e); else g.take(c - e, a, c + e, b);
    return s;
  };
  // (A palisade's watchtowers stand in its corners.)
  if (kind === 'palisade') for (const sx of [-1, 1]) for (const sz of [-1, 1]) g.take(sx > 0 ? rx - 6 : -rx, sz > 0 ? rz - 6 : -rz, sx > 0 ? rx : -rx + 6, sz > 0 ? rz : -rz + 6);
  const P = T.plaza, pattern = pick(T.streets), gates = plan.gates = [];
  const main = [];
  // The main streets run from gate to gate through the middle.
  if (pattern === 'main') {
    const alongX = rx >= rz;
    main.push(alongX ? street('x', 0, -rx + 1, rx - 1) : street('z', 0, -rz + 1, rz - 1));
    gates.push(...(alongX ? [[-1, 0], [1, 0]] : [[0, -1], [0, 1]]));
  } else {
    const half = pattern === 'castle' ? 2 : 1;
    main.push(street('z', 0, -rz + 1, rz - 1, half), street('x', 0, -rx + 1, rx - 1, half));
    gates.push([0, -1], [0, 1], [-1, 0], [1, 0]);
  }
  // Towns and kingdoms have more streets, parallel to the main ones, from lane to lane.
  const side = [];
  let sx = 0, sz = 0;
  if (pattern === 'grid' || pattern === 'castle') {
    sx = pattern === 'castle' ? Math.round((CASTLE + 6 + fx) / 2) : Math.round(fx * 0.52);
    sz = pattern === 'castle' ? Math.round((CASTLE + 6 + fz) / 2) : Math.round(fz * 0.52);
    for (const k of [-1, 1]) side.push(street('z', k * sx, -(rz - t - 2), rz - t - 2), street('x', k * sz, -(rx - t - 2), rx - t - 2));
  }
  // The middle: a plaza, or a castle with a road round it.
  const squares = plan.squares = [];
  if (pattern === 'castle') {
    const R = CASTLE + 3;
    for (const k of [-1, 1]) { street('x', k * R, -R - 1, R + 1); street('z', k * R, -R - 1, R + 1); }
    g.take(-CASTLE - 2, -CASTLE - 2, CASTLE + 2, CASTLE + 2);
    // The castle gate faces one of the avenues, with the market square out along it.
    const [gx, gz] = plan.castleDir = pick([[0, -1], [0, 1], [-1, 0], [1, 0]]);
    const mx = gx * sx, mz = gz * sz;
    g.take(mx - P, mz - P, mx + P, mz + P);
    squares.push([mx, mz, P], [gx * 10, gz * 10, 5]);
    plan.market = [mx, mz];
  } else {
    g.take(-P, -P, P, P);
    squares.push([0, 0, P]);
    plan.market = [0, 0];
  }
  const [mx0, mz0] = plan.market;
  plan.landmarks = [{ type: 'market', landmark: true, box: [mx0 - P, mz0 - P, mx0 + P, mz0 + P] }];
  if (pattern === 'castle') plan.landmarks.push({ type: 'castle', landmark: true, box: [-CASTLE, -CASTLE, CASTLE, CASTLE] });
  plan.centre = pattern === 'castle' ? 'castle' : tier === 'hamlet' ? pick(['well', 'green', 'well']) : tier === 'town' ? pick(['fountain', 'fountain', 'well'])
    : pick(['well', 'well', 'fountain', 'green']);

  // Frontages: the main streets' arms out from the middle, then the other streets.
  const inner = pattern === 'castle' ? CASTLE + 6 : P + 2;
  const arms = [];
  for (const s of main) {
    const far = s.axis === 'x' ? fx : fz;
    arms.push(...frontsOf(s, -inner, -far), ...frontsOf(s, inner, far));
  }
  const others = side.flatMap((s) => frontsOf(s, s.a + 1, s.b - 1));
  const ring = [];
  if (pattern === 'castle') {
    const R = CASTLE + 3;
    for (const k of [-1, 1]) {
      ring.push({ along: 'x', front: k * (R + 4), grow: k, face: k < 0 ? 4 : 5, s0: -R, s1: R },
        { along: 'z', front: k * (R + 4), grow: k, face: k < 0 ? 0 : 1, s0: -R, s1: R });
    }
  }
  const lane = [];
  if (plan.lane) {
    for (const half of [-1, 1]) {
      lane.push({ along: 'x', front: -fz, grow: 1, face: 5, s0: half * 4, s1: half * fx },
        { along: 'x', front: fz, grow: -1, face: 4, s0: half * 4, s1: half * fx },
        { along: 'z', front: -fx, grow: 1, face: 1, s0: half * 4, s1: half * fz },
        { along: 'z', front: fx, grow: -1, face: 0, s0: half * 4, s1: half * fz });
    }
  }

  // What stands where: the grandest first, in the best spots.
  const houses = (n) => repeat(n, () => pick(tier === 'hamlet' ? HAMLET_HOUSES : tier === 'village' ? VILLAGE_HOUSES : TOWN_HOUSES));
  const plains = ['plains', 'birch', 'cherry', 'savanna'].includes(plan.styleName);
  if (tier === 'hamlet') {
    g.rows(g.shuffle([...arms]), [...g.shuffle(['smithy', 'bakery', 'butcher', 'hunter']).slice(0, 1 + Math.floor(rnd() * 2)),
      ...houses(5 + Math.floor(rnd() * 4)), 'farm', ...(rnd() < 0.6 ? ['pen'] : []), ...(kind === 'palisade' ? [] : ['farm'])]);
    g.yards(['garden', 'plot', 'yard', 'pen', 'plot'], 4 + Math.floor(rnd() * 3));
  } else {
    // The barracks stand by the gates.
    for (let k = tier === 'village' ? 1 : 2; k > 0; k--) {
      const f = pick(arms);
      g.rows([{ ...f, s0: f.s1, s1: f.s0 }], ['barracks']);
    }
    if (tier !== 'village' || rnd() < 0.5) g.rows(g.shuffle([...(pattern === 'castle' ? ring : arms)]), ['church']);
    const shops = tier === 'village' ? ['tavern', 'library', 'smithy', 'bakery', 'butcher', 'hunter', ...(rnd() < 0.4 ? ['stable'] : [])]
      : ['tavern', 'tavern', 'library', 'smithy', 'smithy', 'bakery', 'bakery', 'butcher', 'hunter', 'mason', 'stable',
        ...(tier === 'kingdom' ? ['butcher', 'stable', 'tavern', 'library'] : [])];
    const n = tier === 'village' ? 24 : tier === 'town' ? 40 : 56;
    g.rows(g.shuffle([...arms, ...ring]), [...g.shuffle(shops), ...houses(Math.round(n * 0.4))]);
    if (others.length) g.rows(g.shuffle(others), houses(Math.round(n * 0.45)));
    g.rows(g.shuffle([...arms, ...ring, ...others]), houses(Math.round(n * 0.25)));
    const farms = tier === 'village' ? 3 : tier === 'town' ? 4 : 5;
    g.rows(g.shuffle(lane), ['mine', ...repeat(farms - 1, () => 'farm'), ...g.shuffle(['farm', 'pen', 'pen', 'garden', 'garden',
      ...(plains && rnd() < 0.6 ? ['windmill'] : []), ...houses(tier === 'village' ? 12 : 16)])]);
    g.yards(['garden', 'plot', 'yard', 'pen', 'garden', 'plot'], Math.round(16 * (fx * fz) / (27 * 27)));
  }
  plan.buildings = g.buildings;
  plan.residents = [];
  plan.animals = [];
  plan.blueprint = null;
  plan.rnd = null;
  plan.seed = Math.floor(rnd() * 4294967296);
  return plan;
}
const HAMLET_HOUSES = ['house_small', 'house_small', 'cottage', 'cottage', 'house_large', 'house_tall'];
const VILLAGE_HOUSES = ['house_small', 'house_small', 'house_large', 'house_tall', 'house_tall', 'cottage', 'house_long'];
const TOWN_HOUSES = ['house_small', 'house_large', 'house_tall', 'house_tall', 'terrace', 'terrace', 'house_long', 'manor'];

// A camp: tents facing a fire, a few things about, and a clearing round it.
function layoutCamp(plan) {
  const { rnd, rx } = plan;
  const g = new LotGrid(rx, rx, rx - 1, rx - 1, rnd);
  g.take(-3, -3, 3, 3);
  const n = 2 + Math.floor(rnd() * 4), roles = CAMP_KINDS[plan.camp].roles;
  // Round the fire, each tent's front facing it.
  const spots = g.shuffle([[-2, -9, 2, -5, 4], [-2, 5, 2, 9, 5], [-9, -2, -5, 2, 0], [5, -2, 9, 2, 1],
    [-9, -9, -5, -5, 4], [5, -9, 9, -5, 4], [-9, 5, -5, 9, 5], [5, 5, 9, 9, 5]]);
  let tents = 0;
  for (const [x0, z0, x1, z1, face] of spots) {
    if (tents >= n) break;
    // (The travellers' leader has a pavilion; the tents are wide or narrow.)
    const type = tents === 0 && (plan.camp === 'travellers' || rnd() < 0.3) ? 'pavilion' : 'tent';
    const [w] = SIZE[type], grow = w - 5;
    const box = face === 4 ? [x0 - grow, z0 - grow, x1, z1] : face === 5 ? [x0, z0, x1 + grow, z1 + grow] : face === 0 ? [x0 - grow, z0, x1, z1 + grow]
      : [x0, z0 - grow, x1 + grow, z1];
    if (g.place(type, face, box)) g.buildings[g.buildings.length - 1].role = roles[tents++ % roles.length];
  }
  const things = plan.camp === 'travellers' ? ['wagon', 'corral', 'rack', 'woodpile'] : plan.camp === 'hunters' ? ['rack', 'rack', 'woodpile', 'corral']
    : ['woodpile', 'woodpile', 'stump', 'rack'];
  g.yards(things, 2 + Math.floor(rnd() * 2));
  plan.squares = [[0, 0, 3]];
  plan.buildings = g.buildings;
  plan.residents = [];
  plan.animals = [];
  plan.blueprint = null;
  plan.rnd = null;
  plan.seed = Math.floor(rnd() * 4294967296);
  return plan;
}

// ---------------------------------------------------------------- building
// Drawing in a settlement's own coordinates: x and z from its centre, y up from its ground.
class Draw {
  constructor(plan, bp) { this.plan = plan; this.bp = bp; this.st = plan.style; }
  set(x, y, z, id) { this.bp.set(this.plan.x + x, this.plan.y + y, this.plan.z + z, typeof id === 'string' ? B[id] : id); }
  fill(x0, y0, z0, x1, y1, z1, id) { for (let y = y0; y <= y1; y++) for (let z = z0; z <= z1; z++) for (let x = x0; x <= x1; x++) this.set(x, y, z, id); }
  stairs(x, y, z, kind, face, upside = false) {
    const s = STAIRS[B[`${kind}_stairs`]];
    if (s) this.set(x, y, z, s.ids[face][upside ? 1 : 0]);
  }
  // A lot standing on box [x0, z0, x1, z1] with its front facing `face`.
  lot(type, x0, z0, x1, z1, face) {
    const sideways = face === 0 || face === 1, w = sideways ? z1 - z0 + 1 : x1 - x0 + 1, d = sideways ? x1 - x0 + 1 : z1 - z0 + 1;
    return new Lot(this.bp, this.plan, { type, w, d, face, box: [x0, z0, x1, z1] });
  }
}
// Every cell of the ring of half-size (ax, az) round the centre.
function perimeter(ax, az, f) {
  for (let s = -ax; s <= ax; s++) { f(s, -az); f(s, az); }
  for (let s = -az + 1; s <= az - 1; s++) { f(-ax, s); f(ax, s); }
}
// The full block a kind of roof is made of (for the lower courses of steep spires).
const SOLID_OF = (kind) => (WOOD[kind] ? `${kind}_planks` : { brick: 'bricks', deepslate_brick: 'deepslate_bricks', stone_brick: 'stone_bricks' }[kind] ?? kind);
const inward = { 5: 4, 4: 5, 0: 1, 1: 0 };
const faceOf = (ax, az) => (ax === 0 ? (az < 0 ? 5 : 4) : (ax < 0 ? 1 : 0));

// Draws a settlement of the newer worlds into blueprint `bp`, and lists its people.
export function build4(plan, bp) {
  const d = new Draw(plan, bp), rnd = mulberry32(plan.seed);
  const out = { jobs: [], beds: [], doors: [], animals: [], fields: [] };
  if (plan.tier === 'camp') buildCamp(d, plan, rnd, out);
  else buildTown(d, plan, rnd, out);
  settle(plan, rnd, out);
}

function buildTown(d, plan, rnd, out) {
  roads(d, plan, rnd);
  squares(d, plan, rnd, out);
  if (plan.wall.kind === 'palisade') palisade(d, plan, rnd, out);
  else if (plan.wall.kind === 'fence' || plan.wall.kind === 'drystone') lowWall(d, plan, rnd, out);
  else if (plan.wall.kind !== 'none') stoneWall(d, plan, rnd, out);
  if (plan.centre === 'castle') castle(d, plan, rnd, out);
  for (const b of plan.buildings) lotOf(d, plan, b, rnd, out);
  lamps(d, plan, out.doors);
}

// A building on its lot, and the people who live and work there.
function lotOf(d, plan, b, rnd, out) {
  const lot = new Lot(d.bp, plan, b);
  (BUILD4[b.type] ?? BUILD[b.type])(lot, b, rnd);
  out.jobs.push(...lot.jobs); out.beds.push(...lot.beds); out.doors.push(...lot.doors); out.animals.push(...lot.animals);
  b.doors = lot.doors;
  // Homes: someone lives in each, working in the fields or at home; a big house has two.
  const folk = FOLK_IN[b.type];
  if (folk) {
    const list = FOLK[plan.styleName] ?? FOLK.plains;
    for (let k = 0; k < folk && k < lot.beds.length; k++) {
      const door = lot.doors[k % lot.doors.length];
      const f = FACE_STEP[lot.face(5)];
      out.jobs.push({ role: list[Math.floor(rnd() * list.length)], work: [door[0] + f[0], door[1], door[2] + f[1]], folk: true });
    }
  }
  if (b.type === 'farm' || b.type === 'plot' || b.type === 'pen') out.fields.push({ type: b.type, at: lot.world(b.w >> 1, 1, -1) });
  return lot;
}
const FACE_STEP = { 5: [0, -1], 4: [0, 1], 1: [-1, 0], 0: [1, 0] };
const FOLK_IN = { house_small: 1, cottage: 1, house_large: 2, house_tall: 1, house_long: 2, terrace: 3, manor: 2 };
// Who lives in the houses, by the land (the hunter and woodcutter in the north, shepherds in the south...).
const FOLK = {
  plains: ['farmer', 'farmer', 'shepherd', 'woodcutter', 'fisher', 'mason', 'farmer'],
  birch: ['farmer', 'woodcutter', 'woodcutter', 'shepherd', 'fisher', 'farmer'],
  dark: ['woodcutter', 'woodcutter', 'hunter', 'farmer', 'mason'],
  taiga: ['woodcutter', 'woodcutter', 'hunter', 'farmer', 'fisher', 'shepherd'],
  snowy: ['woodcutter', 'hunter', 'fisher', 'farmer', 'shepherd'],
  desert: ['farmer', 'shepherd', 'mason', 'merchant', 'farmer'],
  savanna: ['shepherd', 'shepherd', 'farmer', 'hunter', 'woodcutter'],
  cherry: ['farmer', 'shepherd', 'fisher', 'woodcutter', 'farmer'],
  jungle: ['hunter', 'woodcutter', 'farmer', 'fisher'],
};

// Names, beds and homes for everyone with a job. Royals sleep in their chamber, knights and guards
// in their barracks, and everyone else in the free bed nearest their work; farmers and shepherds
// living in houses work the nearest field or pen.
const BED_FOR = { king: 'royal', queen: 'royal', knight: 'knight', guard: 'guard' };
// How many people a settlement holds at most: past that, some houses stand empty.
const PEOPLE = { camp: 8, hamlet: 14, village: 42, town: 62, kingdom: 86 };
function settle(plan, rnd, out) {
  const { beds, doors, animals, fields } = out, dist = (a, b) => Math.abs(a[0] - b[0]) + Math.abs(a[2] - b[2]) + Math.abs(a[1] - b[1]) * 2;
  const folk = out.jobs.filter((j) => j.folk), room = Math.max(0, PEOPLE[plan.tier] - (out.jobs.length - folk.length));
  const kept = new Set(folk.filter((j, i) => Math.floor(((i + 1) * room) / folk.length) > Math.floor((i * room) / folk.length)));
  const jobs = out.jobs.filter((j) => !j.folk || kept.has(j));
  for (const j of jobs) {
    if (!j.folk || (j.role !== 'farmer' && j.role !== 'shepherd')) continue;
    let best = null, bd = 40;
    for (const f of fields) if ((j.role === 'shepherd') === (f.type === 'pen') && dist(f.at, j.work) < bd) { bd = dist(f.at, j.work); best = f; }
    if (best) j.work = best.at;
  }
  const residents = jobs.map((j, i) => ({ id: `${plan.key}:${i}`, role: j.role, work: j.work, seat: j.seat ?? null, name: j.name ?? titled(j.role, rnd), bed: null }));
  const free = [...beds];
  const claim = (r, want) => {
    let best = -1, bd = Infinity;
    for (let i = 0; i < free.length; i++) if (free[i].who === want && dist(free[i].at, r.work) < bd) { bd = dist(free[i].at, r.work); best = i; }
    if (best >= 0) { r.bed = free[best].at; free.splice(best, 1); }
  };
  for (const r of residents) if (BED_FOR[r.role]) claim(r, BED_FOR[r.role]);
  for (const r of residents) if (!r.bed) claim(r, null);
  for (const r of residents) r.home = r.bed ?? r.work;
  plan.residents = residents;
  plan.animals = animals;
  plan.doors = doors;
}
const KINGS = ['Aldric', 'Edmund', 'Harold', 'Alfred', 'Leofric', 'Oswin', 'Godric', 'Cedric', 'Edgar', 'Osric', 'Roderick', 'Baldwin', 'Conrad', 'Aurelio'];
const QUEENS = ['Matilda', 'Eleanor', 'Isolde', 'Rowena', 'Edith', 'Aelfwyn', 'Gwendolyn', 'Beatrix', 'Margery', 'Elspeth', 'Adela', 'Ysolde'];
function titled(role, rnd) {
  const pick = (list) => list[Math.floor(rnd() * list.length)];
  if (role === 'king') return `King ${pick(KINGS)}`;
  if (role === 'queen') return `Queen ${pick(QUEENS)}`;
  return personName(rnd);
}

// ---------------------------------------------------------------- streets and squares
function roads(d, plan, rnd) {
  const st = d.st, { rx, rz } = plan, t = plan.wall.t;
  // Verges first, so no crossing street's road is gravelled over.
  for (const s of plan.streets) {
    for (let a = s.a; a <= s.b; a++) for (const k of [-s.half - 1, s.half + 1]) if (rnd() < 0.6) { const [x, z] = streetCells(s, a, k); d.set(x, 0, z, st.edge); }
  }
  const lx = rx - t - 3, lz = rz - t - 3;
  if (plan.lane) {
    for (let a = -lx + 1; a <= lx - 1; a++) for (const sg of [-1, 1]) if (rnd() < 0.5) d.set(a, 0, sg * (lz - 1), st.edge);
    for (let a = -lz + 1; a <= lz - 1; a++) for (const sg of [-1, 1]) if (rnd() < 0.5) d.set(sg * (lx - 1), 0, a, st.edge);
  }
  for (const s of plan.streets) {
    for (let a = s.a; a <= s.b; a++) for (let k = -s.half; k <= s.half; k++) { const [x, z] = streetCells(s, a, k); d.set(x, 0, z, st.road); }
  }
  if (plan.lane) {
    for (let a = -(lx + 2); a <= lx + 2; a++) for (let k = 0; k <= 2; k++) for (const sg of [-1, 1]) { d.set(a, 0, sg * (lz + k), st.road); }
    for (let a = -(lz + 2); a <= lz + 2; a++) for (let k = 0; k <= 2; k++) for (const sg of [-1, 1]) { d.set(sg * (lx + k), 0, a, st.road); }
  }
}

// The plaza (or market square) with what stands in it, and the market stalls round it.
function squares(d, plan, rnd, out) {
  const st = d.st, [mx, mz] = plan.market, P = plan.squares[0][2];
  for (let z = -P; z <= P; z++) for (let x = -P; x <= P; x++) d.set(mx + x, 0, mz + z, Math.abs(x) === P || Math.abs(z) === P ? st.found : st.plaza);
  const centre = plan.centre === 'castle' ? 'fountain' : plan.centre;
  if (centre === 'well') well(d, mx, mz);
  else if (centre === 'fountain') fountain(d, mx, mz, rnd);
  else green(d, mx, mz, P, rnd);
  // The bell that calls everyone together.
  if (centre !== 'green') d.set(mx - 4, 1, mz, B.bell_z);
  const stalls = plan.tier === 'hamlet' ? [] : P >= 9 ? [[-6, -6], [6, -6], [-6, 6], [6, 6], [-7, 0], [7, 0]]
    : [[-5, -5], [5, -5], [-5, 5], [5, 5]];
  stalls.forEach(([x, z], i) => stall(d, mx + x, mz + z, i, z < 0 ? 1 : -1, out));
  for (const [x, z] of [[-P, -P], [P, -P], [-P, P], [P, P]]) lamp(d, mx + x, mz + z);
}
function lamp(d, x, z) { d.set(x, 0, z, d.st.found); d.set(x, 1, z, d.st.fence); d.set(x, 2, z, d.st.fence); d.set(x, 3, z, B.lantern); }
// A well with a little roof on posts over it.
function well(d, cx, cz) {
  const st = d.st;
  for (let z = -2; z <= 2; z++) for (let x = -2; x <= 2; x++) {
    const rim = Math.abs(x) === 2 || Math.abs(z) === 2;
    d.set(cx + x, 0, cz + z, rim ? st.found : B.water);
    d.set(cx + x, -1, cz + z, rim ? st.found : B.water);
    d.set(cx + x, -2, cz + z, st.found);
    if (rim) d.set(cx + x, 1, cz + z, st.crest);
  }
  for (const [x, z] of [[-2, -2], [2, -2], [-2, 2], [2, 2]]) for (let y = 1; y <= 3; y++) d.set(cx + x, y, cz + z, st.fence);
  d.fill(cx - 2, 4, cz - 2, cx + 2, 4, cz + 2, st.walk);
  d.set(cx, 3, cz, B.lantern_hanging);
}
// A fountain: a stone basin with lily pads, round a pillar lit at the top.
function fountain(d, cx, cz, rnd) {
  const st = d.st;
  for (let z = -3; z <= 3; z++) for (let x = -3; x <= 3; x++) {
    const r = Math.max(Math.abs(x), Math.abs(z));
    if (r === 3 && Math.abs(x) + Math.abs(z) === 6) continue;
    d.set(cx + x, -1, cz + z, st.found);
    if (r === 3) { d.set(cx + x, 0, cz + z, st.wall); d.set(cx + x, 1, cz + z, `${st.stair}_slab` in B ? `${st.stair}_slab` : st.walk); continue; }
    d.set(cx + x, 0, cz + z, B.water);
    if (r > 1 && rnd() < 0.12) d.set(cx + x, 1, cz + z, B.lily_pad);
  }
  for (let y = 0; y <= 3; y++) d.set(cx, y, cz, y === 3 ? st.wall3 : st.wall);
  d.set(cx, 4, cz, B.lantern);
}
// A village green: grass round a great tree, with flowers and benches.
function green(d, cx, cz, P, rnd) {
  const st = d.st, wood = WOOD[st.tree] ? st.tree : 'oak', soil = B[st.soil] ?? B.grass_block;
  for (let z = -P + 1; z <= P - 1; z++) for (let x = -P + 1; x <= P - 1; x++) {
    d.set(cx + x, 0, cz + z, soil);
    const r = Math.abs(x) + Math.abs(z);
    if (r > 2 && r < P && rnd() < 0.25) { const f = flowerAt(st, rnd); d.set(cx + x, 1, cz + z, f === 'cactus' ? B.dead_bush : B[f]); }
  }
  for (let y = 1; y <= 5; y++) d.set(cx, y, cz, WOOD[wood].log);
  for (let y = 4; y <= 7; y++) for (let z = -3; z <= 3; z++) for (let x = -3; x <= 3; x++) {
    const r = Math.abs(x) + Math.abs(z) + (y >= 7 ? 2 : 0) + (y === 4 ? 1 : 0);
    if (r <= 4 && !(x === 0 && z === 0 && y <= 5) && rnd() < (r === 4 ? 0.5 : 1)) d.set(cx + x, y, cz + z, WOOD[wood].placedLeaves);
  }
  const bench = st.roof ?? 'oak';
  for (const [x, z, f] of [[0, -3, 4], [0, 3, 5], [-3, 0, 0], [3, 0, 1]]) d.stairs(cx + x, 1, cz + z, bench, f);
}
// A market stall: a striped awning on posts over a barrel and a counter, the merchant behind it.
function stall(d, x, z, i, zf, out) {
  const st = d.st, wool = `${st.stall[i % st.stall.length]}_wool`, p = d.plan;
  for (const [a, b] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) { d.set(x + a, 1, z + b, st.fence); d.set(x + a, 2, z + b, st.fence); }
  for (let b = -1; b <= 1; b++) for (let a = -1; a <= 1; a++) d.set(x + a, 3, z + b, (a + b) % 2 === 0 ? wool : 'white_wool');
  d.set(x, 1, z, B.barrel);
  d.set(x - 1, 1, z + zf, 'oak_slab'); d.set(x + 1, 1, z + zf, 'oak_slab');
  out.jobs.push({ role: 'merchant', work: [p.x + x, p.y + 1, p.z + z + zf * 2] });
}
// Lamp posts along the streets, kept clear of doorways, crossings and whatever stands there.
function lamps(d, plan, doors) {
  const { x: cx, z: cz } = plan;
  const onRoad = (x, z) => plan.streets.some((s) => {
    const [a, k] = s.axis === 'x' ? [x, z - s.c] : [z, x - s.c];
    return a >= s.a && a <= s.b && Math.abs(k) <= s.half;
  });
  const built = (x, z) => plan.buildings.some((b) => x >= b.box[0] - 1 && x <= b.box[2] + 1 && z >= b.box[1] - 1 && z <= b.box[3] + 1);
  const square = (x, z) => plan.squares.some(([sx, sz, r]) => Math.abs(x - sx) <= r + 1 && Math.abs(z - sz) <= r + 1)
    || (plan.centre === 'castle' && Math.abs(x) <= CASTLE + 2 && Math.abs(z) <= CASTLE + 2);
  for (const s of plan.streets) {
    for (let a = s.a + 4, n = 0; a <= s.b - 4; a += 7, n++) {
      const [x, z] = streetCells(s, a, (n % 2 ? 1 : -1) * (s.half + 1));
      if (onRoad(x, z) || built(x, z) || square(x, z) || Math.abs(x) > plan.fx + 2 || Math.abs(z) > plan.fz + 2) continue;
      if (doors.some((p) => Math.abs(p[0] - cx - x) + Math.abs(p[2] - cz - z) <= 2)) continue;
      lamp(d, x, z);
    }
  }
}

// ---------------------------------------------------------------- walls
// A hamlet's fence, or a low dry-stone wall, with a gap for the road at each gate.
function lowWall(d, plan) {
  const st = d.st, { rx, rz } = plan, stone = plan.wall.kind === 'drystone';
  perimeter(rx, rz, (x, z) => {
    if (stone) { d.set(x, 0, z, st.found); d.set(x, 1, z, st.crest); } else d.set(x, 1, z, st.fence);
  });
  for (const [x, z] of [[-rx, -rz], [rx, -rz], [-rx, rz], [rx, rz]]) {
    if (stone) { d.set(x, 1, z, st.wall); d.set(x, 2, z, B.lantern); } else lamp(d, x, z);
  }
  for (const [ax, az] of plan.gates) {
    const along = ax === 0, gx = ax * rx, gz = az * rz;
    const at = (u, y, id) => (along ? d.set(gx + u, y, gz, id) : d.set(gx, y, gz + u, id));
    for (let u = -1; u <= 1; u++) {
      at(u, 0, st.road);
      at(u, 1, stone ? 0 : gateId(WOOD[st.gate].gate, faceOf(ax, az), false));
    }
    for (const u of [-2, 2]) {
      if (stone) { at(u, 1, st.wall); at(u, 2, st.wall); at(u, 3, B.lantern); } else { at(u, 2, st.fence); at(u, 3, B.lantern); }
    }
  }
}

// A palisade of logs, with a walkway along the inside (reached by ladders), gates where the roads
// leave, and a watchtower at each corner.
function palisade(d, plan) {
  const st = d.st, { rx, rz } = plan, log = B[st.log];
  perimeter(rx, rz, (x, z) => {
    const top = ((x * 7 + z * 13) >>> 0) % 3 === 0 ? 4 : 5;
    for (let y = -2; y <= top; y++) d.set(x, y, z, log);
  });
  perimeter(rx - 1, rz - 1, (x, z) => {
    d.set(x, 3, z, st.planks);
    if ((((x + z) % 3) + 3) % 3 === 0) { d.set(x, 1, z, st.fence); d.set(x, 2, z, st.fence); }
  });
  // Ladders up to the walkway from inside, against posts under it.
  for (const k of [-1, 1]) {
    const sx = Math.round(k * rx * 0.55), sz = Math.round(k * rz * 0.55);
    for (const [x, z, px, pz, wall] of [[sx, -rz + 2, sx, -rz + 1, 5], [-sx, rz - 2, -sx, rz - 1, 4], [-rx + 2, -sz, -rx + 1, -sz, 1], [rx - 2, sz, rx - 1, sz, 0]]) {
      d.set(px, 1, pz, log); d.set(px, 2, pz, log);
      for (let y = 1; y <= 3; y++) d.set(x, y, z, LADDER[wall]);
    }
  }
  for (const [ax, az] of plan.gates) {
    const along = ax === 0, gx = ax * rx, gz = az * rz, outF = faceOf(ax, az);
    // (u runs along the wall; v steps in towards the middle.)
    const at = (u, v, y, id) => (along ? d.set(gx + u, y, gz - v * az, id) : d.set(gx - v * ax, y, gz + u, id));
    for (let u = -1; u <= 1; u++) {
      for (let v = 0; v <= 1; v++) { at(u, v, 1, 0); at(u, v, 2, 0); at(u, v, 0, st.road); }
      at(u, 0, 1, gateId(WOOD[st.gate].gate, outF, false));
    }
    // Tall posts either side, with torches.
    for (const u of [-2, 2]) { for (let y = 1; y <= 7; y++) at(u, 0, y, log); at(u, -1, 4, WALL_TORCH[outF]); }
  }
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) watchtower(d, sx * (rx - 2), sz * (rz - 2), sx, sz);
}

// A wooden watchtower at a palisade's corner: four posts, a platform with a railing, a roof, and a
// ladder up against the post nearest the middle.
function watchtower(d, cx, cz, sx, sz, height = 7) {
  const st = d.st, log = B[st.log], roof = st.roof ?? 'oak';
  for (let z = -2; z <= 2; z++) for (let x = -2; x <= 2; x++) {
    const corner = Math.abs(x) === 2 && Math.abs(z) === 2, edge = Math.abs(x) === 2 || Math.abs(z) === 2;
    if (corner) { for (let y = 1; y <= height + 2; y++) d.set(cx + x, y, cz + z, log); continue; }
    d.set(cx + x, height, cz + z, st.planks);
    d.set(cx + x, height + 1, cz + z, edge ? st.fence : 0);
    d.set(cx + x, height + 2, cz + z, 0);
  }
  spireAt(d, cx - 2, cz - 2, cx + 2, cz + 2, height + 3, roof);
  d.set(cx, height + 2, cz, B.lantern_hanging);
  // The ladder, up through the platform, with a gap in the railing over it.
  const lx = cx - sx, lz = cz - 2 * sz;
  for (let y = 1; y <= height; y++) d.set(lx, y, lz, LADDER[sx > 0 ? 1 : 0]);
  d.set(lx, height + 1, lz, 0);
}
// Lot.spire, for drawing that isn't on a lot.
function spireAt(p, x0, z0, x1, z1, y, kind, steep = false, solid = null) { Lot.prototype.spire.call(p, x0, z0, x1, z1, y, kind, steep, solid); }

// For each kind of stone wall: its gatehouse (the arch's half-width and height, the towers' span
// along the wall u0..u1 and reach out in front of it v0, how much higher than the wall they stand,
// and whether they have spires); its corner towers (size, how far they stand out, how much higher
// they rise); and how far apart the towers along the walls are.
const STONE_WALLS = {
  stone: { gw: 1, gh: 3, u0: 2, u1: 5, v0: -1, up: 4, spire: false, corner: 6, out: 0, cornerUp: 5, every: 0 },
  tall: { gw: 1, gh: 4, u0: 2, u1: 6, v0: -2, up: 5, spire: false, corner: 8, out: 2, cornerUp: 6, every: 22 },
  grand: { gw: 2, gh: 5, u0: 3, u1: 8, v0: -3, up: 6, spire: true, corner: 9, out: 2, cornerUp: 8, every: 19 },
};

// Walls of stone, `t` blocks thick and `h` high, crenellated, with a walk along the top behind the
// parapet and flights of steps up to it; a gatehouse on each road out, towers at the corners, and
// round towns and kingdoms more towers along the walls.
function stoneWall(d, plan, rnd, out) {
  const st = d.st, { rx, rz } = plan, { t, h: H, crenel, kind } = plan.wall, K = STONE_WALLS[kind];
  const block = () => { const r = rnd(); return r < 0.14 ? st.wall2 : r < 0.2 ? st.wall3 : st.wall; };
  const merlon = (x, z) => (crenel === 2 ? ((x + z) & 1) === 0 : (((x + z) % 3) + 3) % 3 !== 0);
  for (let i = 0; i < t; i++) {
    perimeter(rx - i, rz - i, (x, z) => {
      if (i === 0) {
        for (let y = -3; y <= H; y++) d.set(x, y, z, block());
        if (merlon(x, z)) d.set(x, H + 1, z, block());
      } else {
        for (let y = -2; y <= H - 2; y++) d.set(x, y, z, block());
        d.set(x, H - 1, z, st.walk);
      }
    });
  }
  // Steps up to the walk from inside: a flight on each side of a village, two round a town.
  const flight = (x0, z0, dx, dz) => {
    const face = dx > 0 ? 0 : dx < 0 ? 1 : dz > 0 ? 4 : 5;
    for (let k = 0; k <= H - 2; k++) {
      const x = x0 + dx * k, z = z0 + dz * k;
      for (let y = 0; y <= k; y++) d.set(x, y, z, st.wall);
      if (k < H - 2) d.stairs(x, k + 1, z, st.stair, face); else d.set(x, H - 1, z, st.walk);
    }
  };
  const from = K.u1 + 3, inX = rx - t, inZ = rz - t;
  flight(from, -inZ, 1, 0); flight(-from, inZ, -1, 0); flight(-inX, -from, 0, -1); flight(inX, from, 0, 1);
  if (kind !== 'stone') { flight(-from, -inZ, -1, 0); flight(from, inZ, 1, 0); flight(-inX, from, 0, 1); flight(inX, -from, 0, -1); }
  const clearOf = (s, len, pad) => Math.abs(s) >= K.u1 + pad && (Math.abs(s) < from - pad || Math.abs(s) > from + H + pad) && Math.abs(s) <= len - K.corner - pad;
  // Torches along the inside of the wall light the lane.
  for (const [len, other, alongX] of [[rx, rz, true], [rz, rx, false]]) {
    for (let s = -(len - t - 4); s <= len - t - 4; s += 7) {
      if (!clearOf(s, len, 2)) continue;
      for (const sg of [-1, 1]) {
        if (alongX) d.set(s, 3, sg * (other - t), WALL_TORCH[sg < 0 ? 4 : 5]);
        else d.set(sg * (other - t), 3, s, WALL_TORCH[sg < 0 ? 0 : 1]);
      }
    }
  }
  // Towers along the walls, standing out from them: every so far in from the corners, where
  // they're clear of the gatehouses and the steps.
  if (K.every) {
    for (const [len, alongX] of [[rx, true], [rz, false]]) {
      for (let s = len - K.corner - 6; s > 0; s -= K.every) {
        if (!clearOf(s, len, 3)) continue;
        for (const sg of [-1, 1]) { wallTower(d, plan, s, sg, alongX, block, merlon); wallTower(d, plan, -s, sg, alongX, block, merlon); }
      }
    }
  }
  for (const g of plan.gates) gatehouse(d, plan, g, block, merlon, out);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) cornerTower(d, plan, sx, sz, block, merlon);
}

// A tower standing out from the wall on side `sg`, `s` along it; the walk passes through.
function wallTower(d, plan, s, sg, alongX, block, merlon) {
  const st = d.st, { rx, rz } = plan, { t, h: H } = plan.wall, R = alongX ? rz : rx, top = H + 3;
  // (u runs along the wall; v steps in from its outer face.)
  const at = (u, v, y, id) => (alongX ? d.set(s + u, y, sg * (R - v), id) : d.set(sg * (R - v), y, s + u, id));
  for (let u = -2; u <= 2; u++) for (let v = -2; v <= t; v++) {
    const edge = Math.abs(u) === 2 || v === -2 || v === t;
    for (let y = -5; y <= top; y++) at(u, v, y, edge || y <= 0 ? block() : y === H - 1 ? st.planks : 0);
    if (edge && merlon(u, v)) at(u, v, top + 1, block());
  }
  for (let v = 1; v <= t - 1; v++) for (const u of [-2, 2]) { at(u, v, H, 0); at(u, v, H + 1, 0); }
  at(0, -2, H + 1, 0); at(0, -2, 3, 0);
  at(1, 0, H, B.lantern);
}

// A gatehouse: an arch through the wall and the towers either side of it, closed by gates, with a
// portcullis in a town's; the walk passes over it and into the towers.
function gatehouse(d, plan, [ax, az], block, merlon, out) {
  const st = d.st, { rx, rz } = plan, { t, h: H, kind } = plan.wall, K = STONE_WALLS[kind];
  const along = ax === 0, gx = ax * rx, gz = az * rz;
  const w = (u, v) => (along ? [gx + u, gz - v * az] : [gx - v * ax, gz + u]);
  const at = (u, v, y, id) => { const [x, z] = w(u, v); d.set(x, y, z, id); };
  const outF = faceOf(ax, az), inF = inward[outF], top = H + K.up, roof = st.roof ?? 'deepslate_brick';
  for (const side of [-1, 1]) {
    for (let u = K.u0; u <= K.u1; u++) for (let v = K.v0; v <= t; v++) {
      const edge = u === K.u0 || u === K.u1 || v === K.v0 || v === t;
      for (let y = -5; y <= top; y++) at(side * u, v, y, edge || y <= 0 ? block() : y === H - 1 || y === top - 1 ? st.planks : 0);
      if (!K.spire && edge && merlon(u, v)) at(side * u, v, top + 1, block());
    }
    if (K.spire) {
      const [ax0, az0] = w(side * K.u0, K.v0), [ax1, az1] = w(side * K.u1, t);
      spireAt(d, Math.min(ax0, ax1), Math.min(az0, az1), Math.max(ax0, ax1), Math.max(az0, az1), top + 1, roof, true, SOLID_OF(roof));
    }
    // Doors onto the walk on both sides, slits looking out, a lantern inside, torches at the arch.
    for (const u of [K.u0, K.u1]) for (let v = 1; v <= t - 1; v++) { at(side * u, v, H, 0); at(side * u, v, H + 1, 0); }
    const mid = (K.u0 + K.u1) >> 1;
    at(side * mid, K.v0, H + 1, 0); at(side * mid, K.v0, 3, 0);
    at(side * (K.u0 + 1), K.v0 + 1, H, B.lantern);
    at(side * K.u0, K.v0 - 1, 3, WALL_TORCH[outF]);
    at(side * K.u0, t + 1, 3, WALL_TORCH[inF]);
  }
  // The passage: through the wall and the gatehouse's depth, vaulted over, closed by gates.
  for (let u = -K.gw; u <= K.gw; u++) {
    for (let v = K.v0; v <= t; v++) {
      for (let y = 1; y <= K.gh; y++) at(u, v, y, 0);
      at(u, v, 0, st.road);
      if (v < 0) { for (let y = K.gh + 1; y <= H; y++) at(u, v, y, block()); if (merlon(u, v)) at(u, v, H + 1, block()); }
    }
    at(u, 0, 1, gateId(WOOD[st.gate].gate, outF, false));
    if (K.gh >= 4) at(u, K.v0, K.gh, B.iron_bars);
  }
  at(0, t - 1, K.gh, B.lantern_hanging);
  // The gate's guards.
  const [x, z] = w(0, t + 2);
  out.jobs.push({ role: 'guard', work: [plan.x + x, plan.y + 1, plan.z + z] });
  if (kind !== 'stone') { const [x2, z2] = w(3, t + 2); out.jobs.push({ role: 'guard', work: [plan.x + x2, plan.y + 1, plan.z + z2] }); }
}

// A corner tower: hollow, with a floor at the walk's height (doors out onto both walls) and one at
// the top, a door at the foot and a ladder up; crenellated, or under a spire. A town's are rounded
// and stand out from the walls.
function cornerTower(d, plan, sx, sz, block, merlon) {
  const st = d.st, { rx, rz } = plan, { t, h: H, kind } = plan.wall, K = STONE_WALLS[kind];
  const n = K.corner, hx = sx > 0 ? rx + K.out : -rx - K.out, hz = sz > 0 ? rz + K.out : -rz - K.out;
  const x0 = Math.min(hx, hx - sx * (n - 1)), x1 = Math.max(hx, hx - sx * (n - 1));
  const z0 = Math.min(hz, hz - sz * (n - 1)), z1 = Math.max(hz, hz - sz * (n - 1));
  const top = H + K.cornerUp, round = kind !== 'stone', roof = st.roof ?? 'deepslate_brick';
  for (let z = z0; z <= z1; z++) for (let x = x0; x <= x1; x++) {
    const ex = x === x0 || x === x1, ez = z === z0 || z === z1;
    if (round && ex && ez) { for (let y = 1; y <= top + 1; y++) d.set(x, y, z, 0); continue; }
    const edge = ex || ez || (round && (x === x0 + 1 || x === x1 - 1) && (z === z0 + 1 || z === z1 - 1));
    for (let y = -5; y <= top; y++) d.set(x, y, z, edge || y <= 0 ? block() : y === H - 1 || y === top - 1 ? st.planks : 0);
    if (!K.spire && (ex || ez) && merlon(x, z)) d.set(x, top + 1, z, block());
  }
  if (K.spire) spireAt(d, x0, z0, x1, z1, top + 1, roof, true, SOLID_OF(roof));
  // Doors onto the walks along both walls.
  const fx = sx > 0 ? x0 : x1, fz = sz > 0 ? z0 : z1;
  for (let k = 1; k <= t - 1; k++) {
    d.set(fx, H, sz * (rz - k), 0); d.set(fx, H + 1, sz * (rz - k), 0);
    d.set(sx * (rx - k), H, fz, 0); d.set(sx * (rx - k), H + 1, fz, 0);
  }
  // A door at the foot, from inside the walls, and a ladder beside it up to the top.
  const dz = sz * (rz - t);
  d.set(fx, 1, dz, 0); d.set(fx, 2, dz, 0);
  for (let y = 1; y <= top - 1; y++) d.set(fx + sx, y, dz + sz, LADDER[sx > 0 ? 1 : 0]);
  d.set(fx + 2 * sx, H + 2, dz + 2 * sz, B.lantern_hanging);
}

// ---------------------------------------------------------------- the castle
// A kingdom's castle: a curtain wall with round towers under spires at the corners and a
// gatehouse with a portcullis; in the courtyard, the knights' barracks, an armoury, a stable and a
// chapel; and at the back the keep - its great hall with the thrones of the king and queen, their
// chamber and the royal library above, and a flag flying over the battlements.
const spireOf = (st) => st.roof ?? 'sandstone';
function castle(d, plan, rnd, out) {
  const st = d.st, C = CASTLE, N = 2 * C, H = 9, [gx, gz] = plan.castleDir, roof = spireOf(st);
  const L = d.lot('castle', -C, -C, C, C, faceOf(gx, gz));
  const block = () => { const r = rnd(); return r < 0.12 ? st.wall2 : r < 0.2 ? st.wall3 : st.wall; };
  // The courtyard: grass, a path from the gate to the keep, and one across in front of it.
  L.fill(1, 0, 1, N - 1, 0, N - 1, B[st.soil] ?? B.grass_block);
  L.fill(19, 0, 1, 21, 0, 20, st.plaza);
  L.fill(3, 0, 18, N - 3, 0, 20, st.plaza);
  // The curtain wall, and steps up to its walk.
  const ring = (i, f) => {
    for (let a = i; a <= N - i; a++) { f(a, i); f(a, N - i); }
    for (let a = i + 1; a <= N - 1 - i; a++) { f(i, a); f(N - i, a); }
  };
  ring(0, (x, z) => { for (let y = -3; y <= H; y++) L.set(x, y, z, block()); if ((x + z) % 2 === 0) L.set(x, H + 1, z, block()); });
  ring(1, (x, z) => { for (let y = -2; y <= H - 2; y++) L.set(x, y, z, block()); L.set(x, H - 1, z, st.walk); });
  for (const [x0, dx] of [[4, 1], [N - 4, -1]]) {
    for (let k = 0; k <= H - 2; k++) {
      const x = x0 + dx * k;
      for (let y = 0; y <= k; y++) L.set(x, y, 2, st.wall);
      if (k < H - 2) L.stairs(x, k + 1, 2, st.stair, dx > 0 ? 0 : 1); else L.set(x, H - 1, 2, st.walk);
    }
  }
  // Round towers at the corners, under spires, with doors onto the walks.
  const tower = (x0, z0, n, top, spire) => {
    const x1 = x0 + n - 1, z1 = z0 + n - 1;
    for (let z = z0; z <= z1; z++) for (let x = x0; x <= x1; x++) {
      const ex = x === x0 || x === x1, ez = z === z0 || z === z1;
      if (spire && ex && ez) { for (let y = 1; y <= top + 1; y++) L.set(x, y, z, 0); continue; }
      const edge = ex || ez || (spire && (x === x0 + 1 || x === x1 - 1) && (z === z0 + 1 || z === z1 - 1));
      for (let y = -4; y <= top; y++) L.set(x, y, z, edge || y <= 0 ? block() : y === H - 1 || y === top - 1 ? st.planks : 0);
      if (!spire && (ex || ez) && (x + z) % 2 === 0) L.set(x, top + 1, z, block());
    }
    if (spire) L.spire(x0, z0, x1, z1, top + 1, roof, true, SOLID_OF(roof));
    else L.set((x0 + x1) >> 1, H, (z0 + z1) >> 1, B.lantern);
  };
  for (const [cx, cz] of [[0, 0], [N, 0], [0, N], [N, N]]) {
    const sx = cx === 0 ? 1 : -1, sz = cz === 0 ? 1 : -1, x0 = cx === 0 ? -2 : N - 4, z0 = cz === 0 ? -2 : N - 4;
    tower(x0, z0, 7, H + 7, true);
    const fx = cx === 0 ? x0 + 6 : x0, fz = cz === 0 ? z0 + 6 : z0;
    for (const y of [H, H + 1]) { L.set(fx, y, cz + sz, 0); L.set(cx + sx, y, fz, 0); }
    L.set(cx + 2 * sx, H + 3, cz + 2 * sz, B.lantern_hanging);
  }
  // The gatehouse: square towers either side of an arch with a portcullis, gates across it.
  for (const x0 of [14, 22]) {
    tower(x0, -2, 5, H + 5, false);
    for (const y of [H, H + 1]) { L.set(x0, y, 1, 0); L.set(x0 + 4, y, 1, 0); }
    L.set(x0 + 2, 3, -2, 0);
    L.torch(x0 === 14 ? 18 : 22, 3, -3, 5);
  }
  for (let x = 19; x <= 21; x++) {
    for (let z = -2; z <= 2; z++) {
      for (let y = 1; y <= 4; y++) L.set(x, y, z, 0);
      L.set(x, 0, z, st.plaza);
      if (z < 0) { for (let y = 5; y <= H; y++) L.set(x, y, z, block()); if ((x + z) % 2 === 0) L.set(x, H + 1, z, block()); }
    }
    L.set(x, 4, -2, B.iron_bars);
    L.set(x, 1, 0, gateId(WOOD[st.gate].gate, L.face(5), false));
  }
  L.set(20, 4, 1, B.lantern_hanging);
  // The keep.
  keep(L.part(11, 21, 19, 17, 5, 'keep'), st, rnd, block, roof, out);
  // Round the courtyard: the armoury, the stable, the knights' barracks and the chapel.
  const add = (lot) => { out.jobs.push(...lot.jobs); out.beds.push(...lot.beds); out.doors.push(...lot.doors); out.animals.push(...lot.animals); };
  const smithy = L.part(3, 4, 9, 8, 0, 'smithy'); BUILD.smithy(smithy, smithy.b, rnd); add(smithy);
  const stable = L.part(31, 4, 13, 7, 1, 'stable'); BUILD4.stable(stable, stable.b, rnd); add(stable);
  const barracks = L.part(2, 24, 7, 11, 5, 'garrison'); BUILD4.garrison(barracks, barracks.b, rnd); add(barracks);
  const chapel = L.part(32, 24, 7, 11, 5, 'chapel'); BUILD4.chapel(chapel, chapel.b, rnd); add(chapel);
  // Straw men to practise on, and flower beds either side of the path.
  for (const x of [4, 6, 8]) { L.set(x, 1, 16, st.fence); L.set(x, 2, 16, B.hay_block); L.set(x, 3, 16, B.pumpkin); }
  for (const [x0, x1] of [[14, 17], [23, 26]]) {
    for (let z = 6; z <= 15; z++) for (let x = x0; x <= x1; x++) {
      const rim = x === x0 || x === x1 || z === 6 || z === 15;
      if (rim) L.set(x, 1, z, B[`${st.stair}_slab`] ?? B[st.walk]);
      else if (rnd() < 0.7) { const f = flowerAt(st, rnd); L.set(x, 1, z, f === 'cactus' ? B.dead_bush : B[f]); }
    }
  }
  for (const [x, z] of [[13, 5], [27, 5], [13, 17], [27, 17]]) { L.set(x, 1, z, st.fence); L.set(x, 2, z, st.fence); L.set(x, 3, z, B.lantern); }
  // Knights at the gate and the door of the keep.
  for (const [x, z] of [[17, 4], [23, 4], [17, 18], [23, 18]]) out.jobs.push({ role: 'knight', work: L.world(x, 1, z) });
}

// The keep, on its own lot (19 wide, 17 deep, the door in the middle of the front).
function keep(K, st, rnd, block, roof, out) {
  const W = 19, D = 17, HH = 14, banner = `${st.banner}_wool`;
  K.fill(0, 1, 0, W - 1, HH + 9, D - 1, 0);
  K.fill(0, 0, 0, W - 1, 0, D - 1, B.polished_andesite);
  for (let y = 1; y <= HH; y++) {
    for (let x = 0; x < W; x++) { K.set(x, y, 0, block()); K.set(x, y, D - 1, block()); }
    for (let z = 1; z < D - 1; z++) { K.set(0, y, z, block()); K.set(W - 1, y, z, block()); }
  }
  K.fill(1, 8, 1, W - 2, 8, D - 2, B.dark_oak_planks);
  K.fill(0, HH, 0, W - 1, HH, D - 1, B[st.wall]);
  // Battlements, turrets at the corners and the kingdom's flag.
  for (let x = 0; x < W; x++) for (const z of [0, D - 1]) if (x % 2 === 0) K.set(x, HH + 1, z, block());
  for (let z = 1; z < D - 1; z++) for (const x of [0, W - 1]) if (z % 2 === 0) K.set(x, HH + 1, z, block());
  for (const [x0, z0] of [[-1, -1], [W - 2, -1], [-1, D - 2], [W - 2, D - 2]]) {
    for (let z = z0; z <= z0 + 2; z++) for (let x = x0; x <= x0 + 2; x++) for (let y = HH - 3; y <= HH + 3; y++) K.set(x, y, z, block());
    K.spire(x0, z0, x0 + 2, z0 + 2, HH + 4, roof, true, SOLID_OF(roof));
  }
  for (let y = HH + 1; y <= HH + 8; y++) K.set(9, y, 8, st.fence);
  K.fill(10, HH + 6, 8, 12, HH + 8, 8, banner);
  // The door: a tall arch with torches either side.
  K.fill(8, 1, 0, 10, 4, 0, 0);
  K.fill(8, 5, 0, 10, 5, 0, B.chiseled_stone_bricks);
  K.torch(7, 3, -1, 5); K.torch(11, 3, -1, 5);
  // Windows: tall ones lighting the hall, smaller ones upstairs.
  for (const z of [2, 5, 8, 11]) for (const x of [0, W - 1]) { for (let y = 3; y <= 5; y++) K.set(x, y, z, st.glass); K.set(x, 10, z, st.glass); K.set(x, 11, z, st.glass); }
  for (const x of [3, 15]) { for (let y = 3; y <= 5; y++) K.set(x, y, 0, st.glass); K.set(x, 10, 0, st.glass); K.set(x, 11, 0, st.glass); }
  for (const x of [6, 12]) { K.set(x, 10, 0, st.glass); K.set(x, 11, 0, st.glass); }

  // The great hall: a red carpet to the thrones between two long tables, pillars hung with the
  // kingdom's colours, lanterns overhead.
  for (let z = 1; z <= 11; z++) for (let x = 8; x <= 10; x++) K.carpet(x, 1, z, 'red');
  for (const x of [4, 14]) for (const z of [3, 6, 9]) for (let y = 1; y <= 7; y++) K.set(x, y, z, y >= 4 && y <= 5 && z !== 6 ? banner : st.wall);
  const bench = WOOD[st.roof] ? st.roof : 'dark_oak';
  for (const tx of [6, 12]) {
    for (let z = 2; z <= 10; z++) {
      K.set(tx, 1, z, st.fence); K.carpet(tx, 2, z, 'white');
      K.stairs(tx - 1, 1, z, bench, 1); K.stairs(tx + 1, 1, z, bench, 0);
    }
    K.set(tx, 7, 6, B.lantern_hanging);
  }
  for (const z of [3, 7, 11]) K.set(9, 7, z, B.lantern_hanging);
  // The dais, up a step, with the two thrones: gold behind, dark wood arms, the colours on the wall.
  K.fill(3, 1, 13, 15, 1, 15, B.polished_diorite);
  for (let x = 3; x <= 15; x++) K.stairs(x, 1, 12, 'polished_diorite', 4);
  for (let x = 8; x <= 10; x++) K.carpet(x, 2, 13, 'red');
  for (let x = 5; x <= 13; x++) for (let y = 2; y <= 7; y++) K.set(x, y, D - 1, x === 5 || x === 13 || y === 2 || y === 7 ? 'yellow_wool' : banner);
  for (const [tx, role] of [[7, 'king'], [11, 'queen']]) {
    K.stairs(tx, 2, 14, 'dark_oak', 4);
    for (let y = 2; y <= 4; y++) K.set(tx, y, 15, B.gold_block);
    K.set(tx, 5, 15, B.lantern);
    K.trapdoor(tx - 1, 2, 14, 'dark_oak', 0); K.trapdoor(tx + 1, 2, 14, 'dark_oak', 1);
    out.jobs.push({ role, work: K.world(tx, 2, 13), seat: [...K.world(tx, 2, 14), K.face(5)] });
  }
  for (const x of [3, 15]) out.jobs.push({ role: 'knight', work: K.world(x, 1, 11) });
  // Stairs up the right-hand wall to the floor above.
  for (let k = 0; k <= 7; k++) {
    for (let y = 1; y <= k; y++) K.set(17, y, 2 + k, st.wall);
    K.stairs(17, k + 1, 2 + k, st.stair, 4);
  }
  K.set(17, 8, 7, 0); K.set(17, 8, 8, 0);
  // Upstairs: the royal bedchamber at the back, the library at the front, the treasure in a corner.
  for (let z = 9; z <= 15; z++) for (let x = 4; x <= 14; x++) K.carpet(x, 9, z, 'purple');
  K.bed(8, 9, 14, 4, 'royal'); K.bed(9, 9, 14, 4, 'royal');
  for (const x of [7, 10]) { K.chest(x, 9, 15, 'house', 5); K.set(x, 10, 15, B.lantern); }
  for (const z of [11, 12]) K.chest(1, 9, z, 'house', 0);
  K.set(15, 9, 15, B.gold_block); K.set(16, 9, 15, B.gold_block); K.set(16, 10, 15, B.gold_block);
  K.chest(16, 9, 14, 'smith', 1);
  for (let x = 2; x <= 7; x++) for (let y = 9; y <= 11; y++) K.set(x, y, 1, B.bookshelf);
  for (let x = 11; x <= 15; x++) for (let y = 9; y <= 11; y++) K.set(x, y, 1, B.bookshelf);
  K.set(4, 9, 4, B.enchanting_table); K.set(7, 9, 4, B.lectern); K.set(12, 9, 4, B.cartography_table);
  for (const [x, z] of [[5, 4], [9, 11], [13, 4], [4, 12], [14, 12]]) K.set(x, 13, z, B.lantern_hanging);
  // A ladder to the roof.
  K.ladder(2, 9, HH, 15, 4);
  out.jobs.push({ role: 'librarian', work: K.world(9, 9, 4) });
}

// ---------------------------------------------------------------- camps
// A camp: trodden ground round a fire ringed with stones, log benches, a crafting table, a chest
// and a cooking pot, lanterns on posts, and the tents and the rest on their lots.
function buildCamp(d, plan, rnd, out) {
  const st = d.st, soil = st.soil === 'sand' ? B.sand : B.coarse_dirt;
  // Ground trodden bare round the fire, and paths worn out to each tent.
  for (let z = -4; z <= 4; z++) for (let x = -4; x <= 4; x++) {
    const k = Math.hypot(x, z);
    if (k <= 3.3 || (k <= 4.3 && rnd() < 0.5)) d.set(x, 0, z, rnd() < 0.6 ? soil : B.dirt_path);
  }
  for (const b of plan.buildings) {
    if (b.type !== 'tent' && b.type !== 'pavilion') continue;
    const [sx, , sz] = new Lot(d.bp, plan, b).world(b.w >> 1, 0, -1), tx = sx - plan.x, tz = sz - plan.z, n = Math.max(Math.abs(tx), Math.abs(tz));
    for (let i = 0; i <= n; i++) {
      const x = Math.round((tx * i) / n), z = Math.round((tz * i) / n);
      if (Math.hypot(x, z) > 3.3) d.set(x, 0, z, rnd() < 0.7 ? B.dirt_path : soil);
    }
  }
  for (let z = -1; z <= 1; z++) for (let x = -1; x <= 1; x++) d.set(x, 0, z, B.cobblestone);
  d.set(0, 1, 0, B.campfire);
  const beam = (x, z, alongX) => { const axes = LOG_AXES[B[st.log]]; d.set(x, 1, z, axes ? axes[alongX ? 0 : 1] : B[st.log]); };
  beam(-3, -1, false); beam(-3, 0, false); beam(3, 0, false); beam(3, 1, false);
  beam(-1, 3, true); beam(0, 3, true); beam(0, -3, true); beam(1, -3, true);
  d.set(-2, 1, 2, B.crafting_table);
  d.set(2, 1, -2, lootChestId('village', 1));
  d.set(2, 1, 2, B.barrel);
  d.set(-2, 1, -2, B.cauldron);
  for (const [x, z] of [[-4, -4], [4, 4]]) { d.set(x, 1, z, st.fence); d.set(x, 2, z, B.lantern); }
  for (const b of plan.buildings) lotOf(d, plan, b, rnd, out);
}
const TENT_STRIPES = [['red', 'white'], ['blue', 'white'], ['yellow', 'blue'], ['purple', 'white'], ['green', 'yellow'], ['red', 'yellow']];
// The colours of a tent: plain in a hunters' or woodcutters' camp, striped in a travellers'.
function cloth(l, rnd) {
  const kind = CAMP_KINDS[l.plan.camp] ?? CAMP_KINDS.travellers;
  if (kind.tents[0] === 'striped') { const [a, b] = TENT_STRIPES[Math.floor(rnd() * TENT_STRIPES.length)]; return (k) => `${k % 2 ? a : b}_wool`; }
  const c = kind.tents[Math.floor(rnd() * kind.tents.length)];
  return () => `${c}_wool`;
}

// ---------------------------------------------------------------- the newer buildings
const BUILD4 = {
  // A one-room cottage.
  cottage(l, b, rnd) {
    const st = l.st, w = b.w, d = b.d;
    l.clear(w, d, 9);
    l.shell(w, d, 3, { windows: false });
    l.set(0, 2, 2, st.glass); l.set(w - 1, 2, 2, st.glass); l.set(2, 2, d - 1, st.glass);
    l.entrance(w);
    l.topRoof(w, d, 4);
    l.bed(1, 1, 2, 4);
    l.set(3, 1, 3, B.crafting_table);
    l.chest(3, 1, 1, 'house', 1);
    l.set(2, 3, 2, B.lantern_hanging);
    if (rnd() < 0.5) l.set(1, 1, 1, POTS[Math.floor(rnd() * POTS.length)]);
    if (st.roof && rnd() < 0.6) l.chimney(3, d - 1, 6);
  },
  // A long house: beds at one end, the kitchen at the other, a table between; its roof runs along it.
  house_long(l, b, rnd) {
    const st = l.st, w = b.w, d = b.d, left = rnd() < 0.5;
    l.clear(w, d, 10);
    l.shell(w, d, 3);
    l.entrance(w);
    for (const x of [2, w - 3]) l.set(x, 2, 0, st.glass);
    if (st.roof) l.gable(0, 0, w, d, 4, st.roof, st.planks, true); else l.flatRoof(w, d, 4);
    const bx = left ? 1 : w - 3, kx = left ? w - 2 : 1;
    l.bed(bx, 1, d - 3, 4); l.bed(bx + 1, 1, d - 3, 4);
    l.chest(left ? 3 : w - 4, 1, d - 2, 'house', 5);
    l.facing('furnace', kx, 1, d - 2, 5); l.set(kx, 1, d - 3, B.barrel); l.set(kx, 1, 1, B.crafting_table);
    const m = w >> 1;
    l.set(m, 1, 3, st.fence); l.carpet(m, 2, 3);
    l.stairs(m - 1, 1, 3, st.roof ?? 'sandstone', 1); l.stairs(m + 1, 1, 3, st.roof ?? 'sandstone', 0);
    for (const x of [3, w - 4]) l.set(x, 3, 2, B.lantern_hanging);
    if (st.roof && rnd() < 0.6) l.chimney(kx, d - 1, 7);
  },
  // Three narrow houses of two storeys in a row, each its own colour, under one roof.
  terrace(l, b, rnd) {
    const st = l.st, d = b.d, walls = [st.planks, 'bricks', 'birch_planks', 'spruce_planks', st.planks, 'calcite'];
    l.clear(b.w, d, 14);
    for (let k = 0; k < 3; k++) {
      const u = l.part(k * 5, 0, 5, d, 5, 'home'), wall = B[walls[Math.floor(rnd() * walls.length)]];
      u.shell(5, d, 3, { walls: wall, windows: false });
      u.fill(1, 4, 1, 3, 4, d - 2, st.floor);
      for (let x = 0; x < 5; x++) { u.beam(x, 4, 0); u.beam(x, 4, d - 1); }
      u.shell(5, d, 3, { y: 4, floor: false, walls: wall, windows: false });
      u.set(1, 2, 0, st.glass); u.set(3, 6, 0, st.glass); u.set(1, 6, 0, st.glass); u.set(2, 6, d - 1, st.glass); u.set(2, 2, d - 1, st.glass);
      u.door(3, 0, st.door); u.set(3, 0, -1, st.found);
      u.facing('furnace', 1, 1, d - 2, 5); u.set(1, 1, d - 3, B.crafting_table); u.set(3, 1, d - 2, B.barrel);
      u.ladder(3, 1, 4, d - 3, 0);
      u.bed(1, 5, d - 3, 4); u.chest(3, 5, 1, 'house', 5);
      u.set(2, 3, 3, B.lantern_hanging); u.set(2, 7, 3, B.lantern_hanging);
      l.jobs.push(...u.jobs); l.beds.push(...u.beds); l.doors.push(...u.doors);
      if (k === 1) u.torch(4, 2, -1, 5);
    }
    if (st.roof) l.gable(0, 0, b.w, d, 8, st.roof, st.planks, true); else l.flatRoof(b.w, d, 8);
  },
  // A manor house: a stone ground floor with a hall and a fireplace, a timber floor above.
  manor(l, b, rnd) {
    const st = l.st, w = b.w, d = b.d;
    l.clear(w, d, 17);
    l.shell(w, d, 4, { walls: B[st.wall], corners: B[st.wall3] });
    l.fill(1, 5, 1, w - 2, 5, d - 2, st.floor);
    for (let x = 0; x < w; x++) { l.beam(x, 5, 0); l.beam(x, 5, d - 1); }
    for (let z = 1; z < d - 1; z++) { l.beam(0, 5, z, false); l.beam(w - 1, 5, z, false); }
    l.shell(w, d, 3, { y: 5, floor: false });
    for (const x of [3, w - 4]) for (let y = 6; y <= 8; y++) { l.set(x, y, 0, st.log); l.set(x, y, d - 1, st.log); }
    for (const x of [2, 3, w - 4, w - 3]) l.set(x, 2, 0, st.glass);
    for (const x of [1, 5, w - 6, w - 2]) l.set(x, 7, 0, st.glass);
    l.entrance(w);
    l.torch((w >> 1) - 1, 2, -1, 5);
    if (st.roof) l.gable(0, 0, w, d, 9, st.roof, st.planks, true); else l.flatRoof(w, d, 9);
    // The hall: a fireplace, a long table, shelves.
    const m = w >> 1;
    for (let x = m - 2; x <= m + 2; x++) { l.set(x, 1, d - 2, x === m ? B.campfire : B.bricks); for (let y = 2; y <= 4; y++) l.set(x, y, d - 2, x === m && y === 2 ? 0 : B.bricks); }
    for (let z = 3; z <= 5; z++) { l.set(m, 1, z, st.fence); l.carpet(m, 2, z, 'white'); l.stairs(m - 1, 1, z, st.roof ?? 'sandstone', 1); l.stairs(m + 1, 1, z, st.roof ?? 'sandstone', 0); }
    for (let y = 1; y <= 3; y++) { l.set(1, y, 1, B.bookshelf); l.set(1, y, 2, B.bookshelf); }
    l.set(w - 2, 1, 1, B.crafting_table); l.facing('furnace', w - 2, 1, 2, 1);
    l.ladder(w - 2, 1, 5, d - 3, 0);
    l.set(3, 4, 4, B.lantern_hanging); l.set(w - 4, 4, 4, B.lantern_hanging);
    // Upstairs: bedrooms.
    l.bed(1, 6, d - 3, 4); l.bed(2, 6, d - 3, 4); l.bed(w - 4, 6, 2, 5);
    l.chest(4, 6, d - 2, 'house', 5); l.chest(w - 2, 6, 1, 'house', 1);
    for (let z = 2; z <= d - 3; z++) l.carpet(m, 6, z, 'red');
    l.set(m, 8, 4, B.lantern_hanging);
    if (st.roof) l.chimney(m, d - 1, 14);
  },
  // A church: a stone nave with stained glass, pews and an altar, behind a tower with a bell and a spire.
  church(l, b, rnd) {
    const st = l.st, w = b.w, d = b.d, stone = B[st.wall], trim = B[st.wall3], roof = spireOf(st), n0 = 4, top = 13;
    const pick = (list) => list[Math.floor(rnd() * list.length)];
    l.clear(w, d, 24);
    l.fill(0, 0, n0, w - 1, 0, d - 1, B[st.found]);
    for (let z = n0; z < d; z++) for (let y = 1; y <= 6; y++) { l.set(0, y, z, stone); l.set(w - 1, y, z, stone); }
    for (let x = 1; x < w - 1; x++) for (let y = 1; y <= 6; y++) { l.set(x, y, d - 1, stone); l.set(x, y, n0, stone); }
    l.fill(1, 0, n0 + 1, w - 2, 0, d - 2, st.floor);
    const glass = ['red', 'blue', 'yellow', 'lime', 'purple', 'orange', 'cyan'];
    for (let z = n0 + 2; z < d - 1; z += 3) { const g = `${pick(glass)}_stained_glass`; for (let y = 2; y <= 4; y++) { l.set(0, y, z, g); l.set(w - 1, y, z, g); } }
    for (const [x, y] of [[4, 3], [4, 4], [4, 5], [3, 4], [5, 4]]) l.set(x, y, d - 1, x === 4 && y === 4 ? 'yellow_stained_glass' : 'red_stained_glass');
    l.gable(0, n0, w, d - n0, 7, roof, stone);
    const pew = WOOD[st.roof] ? st.roof : 'oak';
    for (let z = n0 + 1; z <= d - 4; z++) l.carpet(4, 1, z, 'red');
    for (let z = n0 + 2; z <= d - 6; z += 2) for (const x of [1, 2, 3, 5, 6, 7]) l.stairs(x, 1, z, pew, 5);
    for (let x = 3; x <= 5; x++) l.set(x, 1, d - 3, trim);
    l.set(3, 2, d - 3, B.lantern); l.set(5, 2, d - 3, B.lantern); l.carpet(4, 2, d - 3, 'white');
    l.set(4, 1, d - 5, B.lectern);
    l.set(4, 6, n0 + 3, B.lantern_hanging); l.set(4, 6, d - 4, B.lantern_hanging);
    l.job('cleric', 4, d - 4);
    // The tower: the way in, a ladder up to the bell, the spire.
    for (let z = 0; z <= n0; z++) for (let x = 2; x <= 6; x++) {
      const edge = x === 2 || x === 6 || z === 0 || z === n0;
      for (let y = 0; y <= top; y++) l.set(x, y, z, edge ? (y === top || y === 0 || y === 7 ? trim : stone) : y === 0 ? B[st.found] : y === 9 ? st.planks : 0);
    }
    l.entrance(w);
    l.set(4, 1, n0, 0); l.set(4, 2, n0, 0);
    for (const [x, z] of [[4, 0], [4, n0], [2, 2], [6, 2]]) { l.set(x, 10, z, 0); l.set(x, 11, z, 0); }
    l.set(4, 10, 2, B.bell);
    l.ladder(3, 1, 9, n0 - 1, 1);
    l.spire(2, 0, 6, n0, top + 1, roof, true, SOLID_OF(roof));
  },
  // A small chapel: stone walls, a steep roof, stained glass, pews, an altar.
  chapel(l, b, rnd) {
    const st = l.st, w = b.w, d = b.d, stone = B[st.wall], roof = spireOf(st);
    l.clear(w, d, 12);
    l.shell(w, d, 5, { walls: stone, corners: B[st.wall3], windows: false });
    for (const z of [3, 6]) for (let y = 2; y <= 4; y++) { l.set(0, y, z, 'blue_stained_glass'); l.set(w - 1, y, z, 'blue_stained_glass'); }
    for (let y = 3; y <= 4; y++) l.set(w >> 1, y, d - 1, 'yellow_stained_glass');
    l.entrance(w);
    l.gable(0, 0, w, d, 6, roof, stone);
    l.set(w >> 1, 9, 0, B.bell);
    const pew = WOOD[st.roof] ? st.roof : 'oak';
    for (let z = 2; z <= d - 5; z += 2) for (const x of [1, 2, 4, 5]) l.stairs(x, 1, z, pew, 5);
    for (let z = 1; z <= d - 3; z++) l.carpet(3, 1, z, 'red');
    l.set(2, 1, d - 2, B[st.wall3]); l.set(3, 1, d - 2, B[st.wall3]); l.set(4, 1, d - 2, B[st.wall3]);
    l.set(2, 2, d - 2, B.lantern); l.set(4, 2, d - 2, B.lantern);
    l.set(3, 4, d >> 1, B.lantern_hanging);
    l.job('cleric', 3, d - 3);
  },
  // Stalls for three horses under a roof, open at the front.
  stable(l, b, rnd) {
    const st = l.st, w = b.w, d = b.d;
    l.clear(w, d, 9);
    for (let z = 0; z < d; z++) for (let x = 0; x < w; x++) l.set(x, 0, z, rnd() < 0.4 ? B.coarse_dirt : B.dirt);
    for (let y = 1; y <= 3; y++) {
      for (let x = 0; x < w; x++) l.set(x, y, d - 1, st.planks);
      for (let z = 0; z < d; z++) { l.set(0, y, z, st.planks); l.set(w - 1, y, z, st.planks); }
      for (const x of [0, 4, 8, 12]) l.set(x, y, 0, st.log);
    }
    for (const x of [4, 8]) for (let z = 2; z < d - 1; z++) l.set(x, 1, z, st.fence);
    if (st.roof) l.gable(0, 0, w, d, 4, st.roof, st.planks, true); else l.flatRoof(w, d, 4);
    for (const x of [2, 6, 10]) {
      l.set(x - 1, 1, d - 2, B.hay_block); l.set(x + 1, 1, d - 2, B.water_cauldron);
      l.animals.push({ type: 'horse', at: l.world(x, 1, 3) });
      l.set(x, 3, 3, B.lantern_hanging);
    }
    l.chest(1, 1, 1, 'village', 0);
    l.job('stablehand', w >> 1, -1);
  },
  // A mason's yard: a shed at the back with the stonecutters, stone stacked about.
  mason(l, b, rnd) {
    const st = l.st, w = b.w, d = b.d, stones = [B.stone_bricks, B.polished_andesite, B.cobblestone, B.smooth_stone, B[st.wall]];
    l.clear(w, d, 7);
    for (let z = 0; z < d; z++) for (let x = 0; x < w; x++) l.set(x, 0, z, rnd() < 0.5 ? B.gravel : B.cobblestone);
    for (let y = 1; y <= 3; y++) { for (let x = 0; x < w; x++) l.set(x, y, d - 1, B[st.wall]); for (const x of [0, w - 1]) l.set(x, y, d - 3, st.log); }
    l.fill(-1, 4, d - 4, w, 4, d, `${st.stair}_slab` in B ? `${st.stair}_slab` : 'cobblestone_slab');
    l.set(2, 1, d - 2, B.stonecutter); l.set(4, 1, d - 2, B.stonecutter); l.chest(6, 1, d - 2, 'smith', 5);
    for (const [x, z, h] of [[1, 1, 2], [2, 1, 1], [6, 1, 1], [7, 1, 2], [7, 2, 1]]) for (let y = 1; y <= h; y++) l.set(x, y, z, stones[Math.floor(rnd() * stones.length)]);
    l.set(4, 3, d - 2, B.lantern_hanging);
    l.job('mason', w >> 1, 2);
  },
  // A windmill: a stone tower under a pointed roof, its sails turned to the wind.
  windmill(l, b, rnd) {
    const st = l.st, w = b.w, roof = spireOf(st);
    l.clear(w, b.d, 14);
    for (let z = 0; z <= 4; z++) for (let x = 1; x <= 5; x++) {
      const edge = x === 1 || x === 5 || z === 0 || z === 4;
      for (let y = 0; y <= 8; y++) l.set(x, y, z, edge ? (y > 4 ? st.planks : B[st.found]) : y === 0 ? st.floor : y === 5 ? st.planks : 0);
    }
    l.spire(1, 0, 5, 4, 9, roof);
    l.entrance(w);
    l.set(1, 2, 2, st.glass); l.set(5, 2, 2, st.glass); l.set(3, 7, 4, st.glass);
    l.ladder(4, 1, 5, 3, 0);
    l.set(2, 1, 3, B.hay_block); l.set(2, 2, 3, B.hay_block); l.set(2, 1, 1, B.barrel); l.chest(2, 6, 3, 'farm', 0);
    // The sails, on a hub in the front.
    l.log(3, 8, -1, 'z');
    for (let k = 1; k <= 3; k++) { l.set(3, 8 + k, -1, st.fence); l.set(3, 8 - k, -1, st.fence); l.set(3 - k, 8, -1, st.fence); l.set(3 + k, 8, -1, st.fence); }
    for (let k = 1; k <= 3; k++) { l.set(4, 8 + k, -1, 'white_wool'); l.set(2, 8 - k, -1, 'white_wool'); l.set(3 - k, 9, -1, 'white_wool'); l.set(3 + k, 7, -1, 'white_wool'); }
    for (let x = 1; x < w - 1; x++) if (rnd() < 0.6) l.set(x, 1, b.d - 1, B.hay_block);
    l.job('farmer', 3, -1);
  },
  // Knights' barracks: stone, a row of beds down each side, weapons and armour.
  garrison(l, b, rnd) {
    const st = l.st, w = b.w, d = b.d;
    l.clear(w, d, 8);
    l.shell(w, d, 4, { walls: B[st.wall], corners: B[st.wall3], windows: false });
    for (let z = 2; z < d - 1; z += 3) { l.set(0, 2, z, B.iron_bars); l.set(w - 1, 2, z, B.iron_bars); }
    l.entrance(w);
    l.fill(-1, 5, -1, w, 5, d, `${st.stair}_slab` in B ? `${st.stair}_slab` : 'stone_brick_slab');
    for (let z = 0; z < d; z++) for (const x of [-1, w]) if (z % 2 === 0) l.set(x, 6, z, B[st.wall]);
    for (let x = 0; x < w; x++) for (const z of [-1, d]) if (x % 2 === 0) l.set(x, 6, z, B[st.wall]);
    for (const z of [3, 5, 7]) { l.bed(2, 1, z, 1, 'knight'); l.bed(w - 3, 1, z, 0, 'knight'); }
    l.chest(1, 1, d - 2, 'smith', 0); l.set(w - 2, 1, d - 2, B.anvil); l.set(w - 2, 1, 1, B.grindstone);
    l.set(w >> 1, 4, 3, B.lantern_hanging); l.set(w >> 1, 4, d - 3, B.lantern_hanging);
  },

  // ---- the camps'
  // A tent: canvas pitched in a ridge over a bed, the way in facing the fire.
  tent(l, b, rnd) {
    const w = b.w, d = b.d, c = cloth(l, rnd);
    l.clear(w, d, 4);
    for (let z = 0; z < d; z++) {
      for (const [x, y] of [[0, 1], [4, 1], [1, 2], [3, 2], [2, 3]]) l.set(x, y, z, c(z));
    }
    for (const [x, y] of [[1, 1], [2, 1], [3, 1], [2, 2]]) l.set(x, y, d - 1, c(d - 1));
    for (let z = 0; z < d - 1; z++) l.carpet(2, 1, z, 'brown');
    l.bed(1, 1, d - 3, 4);
    l.set(3, 1, d - 2, B.barrel);
    l.chest(3, 1, d - 3, 'village', 1);
    l.set(2, 2, d - 2, B.lantern_hanging);
    const role = b.role ?? 'hunter';
    l.job(role, 2, -1);
  },
  // A pavilion: striped walls and a stepped roof with a pennant, room for two.
  pavilion(l, b, rnd) {
    const w = b.w, d = b.d, c = cloth(l, rnd);
    l.clear(w, d, 8);
    for (let y = 1; y <= 2; y++) {
      for (let x = 0; x < w; x++) { l.set(x, y, 0, c(x)); l.set(x, y, d - 1, c(x)); }
      for (let z = 1; z < d - 1; z++) { l.set(0, y, z, c(z)); l.set(w - 1, y, z, c(z)); }
    }
    for (let i = 1; i <= 2; i++) {
      for (let x = i; x < w - i; x++) { l.set(x, 2 + i, i, c(x)); l.set(x, 2 + i, d - 1 - i, c(x)); }
      for (let z = i + 1; z < d - 1 - i; z++) { l.set(i, 2 + i, z, c(z)); l.set(w - 1 - i, 2 + i, z, c(z)); }
    }
    l.set(3, 5, 3, c(0));
    l.set(3, 6, 3, l.st.fence); l.set(3, 7, 3, l.st.fence); l.set(4, 7, 3, c(1));
    l.set(3, 1, 0, 0); l.set(3, 2, 0, 0);
    for (let z = 1; z < d - 1; z++) for (let x = 1; x < w - 1; x++) l.carpet(x, 1, z, 'red');
    l.bed(1, 1, 4, 4); l.bed(5, 1, 4, 4);
    l.chest(5, 1, 1, 'village', 1); l.set(1, 1, 1, B.barrel);
    l.set(3, 1, 4, l.st.fence); l.carpet(3, 2, 4, 'white');
    l.set(3, 4, 3, B.lantern_hanging);
    l.job(b.role ?? 'traveller', 3, -1);
  },
  // A covered wagon.
  wagon(l, b) {
    l.clear(b.w, b.d, 5);
    for (const [x, z] of [[0, 1], [2, 1], [0, 3], [2, 3]]) l.set(x, 1, z, 'dark_oak_fence');
    l.fill(0, 2, 0, 2, 2, 4, 'spruce_slab');
    for (let z = 1; z <= 3; z++) { l.set(0, 3, z, 'white_wool'); l.set(2, 3, z, 'white_wool'); l.fill(0, 4, z, 2, 4, z, 'white_wool'); }
    l.set(1, 3, 2, B.barrel);
    l.set(1, 1, -1, 'spruce_fence');
  },
  // A fenced corral with a couple of horses.
  corral(l, b, rnd) {
    const st = l.st, w = b.w, d = b.d;
    l.clear(w, d, 3);
    for (let z = 0; z < d; z++) for (let x = 0; x < w; x++) if (x === 0 || z === 0 || x === w - 1 || z === d - 1) l.set(x, 1, z, st.fence);
    l.set(w >> 1, 1, 0, gateId(WOOD[st.gate].gate, l.face(5), false));
    l.set(1, 1, d - 2, B.hay_block); l.set(w - 2, 1, d - 2, B.water_cauldron);
    for (let k = 0; k < 1 + Math.floor(rnd() * 2); k++) l.animals.push({ type: 'horse', at: l.world(2 + k * 2, 1, 2) });
  },
  // Hides drying on a rack.
  rack(l, b, rnd) {
    const st = l.st;
    l.clear(b.w, b.d, 3);
    for (const x of [0, 2]) l.set(x, 1, 0, st.fence);
    for (let x = 0; x <= 2; x++) { l.set(x, 2, 0, st.fence); l.carpet(x, 3, 0, rnd() < 0.5 ? 'brown' : 'white'); }
  },
  // Logs stacked for the fire.
  woodpile(l, b, rnd) {
    l.clear(b.w, b.d, 3);
    for (let x = 0; x < b.w; x++) { l.log(x, 1, 0, 'z'); l.log(x, 1, 1, 'z'); if (x > 0 && rnd() < 0.7) l.log(x, 2, 0, 'z'); }
  },
  // A chopping block, and a log waiting to be split.
  stump(l, b) {
    l.clear(b.w, b.d, 2);
    l.log(0, 1, 0); l.log(1, 1, 1, 'x'); l.set(0, 2, 0, 'oak_slab');
  },
};
