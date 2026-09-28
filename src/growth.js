// Things that grow and change by themselves: crops, saplings, farmland drying out, grass spreading,
// sugar cane and cactus getting taller (on random ticks, see World.randomTicks), and leaves
// withering once the tree they belong to has been cut down.
import {
  B, BLOCKS, CROP, STEM, SAPLING, NATURAL_LEAVES, LEAVES_WOOD, LOG, OPAQUE, SOLID, WATERLIKE, REPLACEABLE, WOOD, FACE_DIRS, BERRY_BUSH, COCOA,
  FACING_VARIANTS, cocoaId, hiveId, attachedStem, RENDER, R,
} from './blocks.js';
import { TREES, WIDE_TREES, saplingTree } from './trees.js';
import { MIN_Y } from './config.js';

// Light at a block, counting skylight only as far as the sun is up (the game keeps
// `world.daylight` current).
const light = (w, x, y, z) => { const l = w.getLight(x, y, z); return Math.max(l & 15, (l >> 4) * (w.daylight ?? 1)); };

export function randomTick(w, x, y, z, id) {
  const crop = CROP[id];
  if (crop) growCrop(w, x, y, z, crop, 1, true);
  else if (STEM[id] && !STEM[id].attached) growStem(w, x, y, z, id, 1, true);
  else if (SAPLING[id]) { if (Math.random() < 1 / 7 && light(w, x, y + 1, z) >= 9) growSapling(w, x, y, z, id); }
  else if (id === B.farmland || id === B.farmland_moist) hydrate(w, x, y, z, id);
  else if (id === B.sugar_cane || id === B.cactus) growTall(w, x, y, z, id);
  else if (id === B.bamboo) growTall(w, x, y, z, id, 8 + (((x * 73856093) ^ (z * 19349663)) >>> 0) % 7);
  else if (id === B.dirt) spreadGrass(w, x, y, z);
  else if (id === B.kelp) growKelp(w, x, y, z);
  else if (id === B.frogspawn) { if (Math.random() < 0.2) hatch(w, x, y, z); }
  // (Update 27's: sweet berry bushes grow in the light, cocoa pods ripen in any; Minecraft's odds.)
  else if (BERRY_BUSH[id] !== undefined) { if (BERRY_BUSH[id] < 3 && Math.random() < 0.2 && light(w, x, y + 1, z) >= 9) w.setBlock(x, y, z, id + 1); }
  else if (COCOA[id] && Math.random() < 0.2) growCocoa(w, x, y, z, id);
}

// A cocoa pod a stage riper (false if it's ripe already).
export function growCocoa(w, x, y, z, id) {
  const c = COCOA[id];
  return c.age < 2 && w.setBlock(x, y, z, cocoaId(c.age + 1, c.face));
}

// Frogspawn hatches (every five minutes or so) into two to six tadpoles, in the water under it.
function hatch(w, x, y, z) {
  w.setBlock(x, y, z, 0);
  w.listener?.frogspawnHatched?.(x, y, z, 2 + Math.floor(Math.random() * 5));
}

// Kelp grows up through still water, a block now and then, until it nears the surface (or reaches
// its own height, anywhere up to about 25 blocks).
function growKelp(w, x, y, z) {
  if (Math.random() > 0.14 || w.getBlock(x, y + 1, z) !== B.water || w.getBlock(x, y + 2, z) !== B.water) return;
  let base = y;
  while (base > MIN_Y && (w.getBlock(x, base - 1, z) === B.kelp_plant || w.getBlock(x, base - 1, z) === B.kelp)) base--;
  if (y - base >= 2 + Math.floor(((x * 73856093) ^ (z * 19349663)) >>> 0) % 24) return;
  w.setBlock(x, y + 1, z, B.kelp);
}

// ---------------------------------------------------------------- crops
// How likely a crop (or a stem) is to grow a stage on a random tick, by Minecraft's rules: it scores
// points for the farmland under it (3 moist, 1 dry) and a quarter as many for each piece round
// about, halved if the same crop crowds it on both sides, or corner to corner (so crops in rows, with
// something else between, grow faster than a solid field of one); its chance is one in (25 / points)
// + 1. That's made GROWTH_PACE times as quick here, which keeps a solid field growing as fast as crops
// always have here, watered or dry (and rows twice as fast). (They grow by night too, with the light
// that's there by day.)
const GROWTH_PACE = 2.7;
export function growthChance(w, x, y, z, same) {
  let points = 1;
  for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) {
    const b = w.getBlock(x + dx, y - 1, z + dz);
    const p = b === B.farmland_moist ? 3 : b === B.farmland ? 1 : 0;
    points += dx || dz ? p / 4 : p;
  }
  const at = (dx, dz) => same(w.getBlock(x + dx, y, z + dz));
  if (((at(1, 0) || at(-1, 0)) && (at(0, 1) || at(0, -1))) || at(1, 1) || at(-1, 1) || at(1, -1) || at(-1, -1)) points /= 2;
  return Math.min(1, GROWTH_PACE / (Math.floor(25 / points) + 1));
}
// The light a plant grows by: its sky light whatever the time of day, or lamplight.
const rawLight = (w, x, y, z) => { const l = w.getLight(x, y, z); return Math.max(l & 15, l >> 4); };
// A crop some stages on (bone meal), or on a random tick (`natural`), a stage on if there's light
// enough and its chance comes up.
export function growCrop(w, x, y, z, crop, steps, natural = false) {
  if (crop.stage >= crop.max) return false;
  if (natural && (rawLight(w, x, y, z) < 9 || Math.random() >= growthChance(w, x, y, z, (id) => CROP[id]?.name === crop.name))) return false;
  return w.setBlock(x, y, z, crop.first + Math.min(crop.max, crop.stage + steps));
}
// A melon or pumpkin stem grows as a crop does, and once grown, bears (on a random tick; bone meal
// only grows it): its fruit comes up on a side picked at random, if the ground there will take it
// (soil, not stone) and nothing's in the way, and the stem bows over towards it.
const FRUIT_GROUND = new Set([B.farmland, B.farmland_moist, B.dirt, B.grass_block, B.snowy_grass, B.podzol, B.coarse_dirt, B.moss_block,
  B.rooted_dirt]);
export function growStem(w, x, y, z, id, steps = 1, natural = false) {
  const s = STEM[id];
  if (natural && (rawLight(w, x, y, z) < 9 ||
    Math.random() >= growthChance(w, x, y, z, (b) => STEM[b] && !STEM[b].attached && STEM[b].fruit === s.fruit))) return false;
  if (s.age < 7) return w.setBlock(x, y, z, s.first + Math.min(7, s.age + steps));
  if (!natural) return false;
  const face = [0, 1, 4, 5][Math.floor(Math.random() * 4)], d = FACE_DIRS[face], fx = x + d[0], fz = z + d[2];
  if (w.getBlock(fx, y, fz) !== 0 || !FRUIT_GROUND.has(w.getBlock(fx, y - 1, fz))) return false;
  const v = FACING_VARIANTS[B.pumpkin];
  w.setBlock(fx, y, fz, s.fruit === 'melon' ? B.melon : v[[0, 1, 4, 5][Math.floor(Math.random() * 4)]]);
  return w.setBlock(x, y, z, attachedStem(s.fruit, face));
}
// Coming down on farmland from a fall of more than half a block may trample it back to dirt (the
// likelier the further the fall; Minecraft's odds), and what grew on it comes up with it.
export function trample(w, x, y, z, fall) {
  const bx = Math.floor(x), by = Math.floor(y - 0.07), bz = Math.floor(z), id = w.getBlock(bx, by, bz);
  if ((id !== B.farmland && id !== B.farmland_moist) || fall <= 0.5 || Math.random() >= fall - 0.5) return false;
  return w.setBlock(bx, by, bz, B.dirt);
}
// Farmland stays moist within four blocks of water, dries out without it, and goes back to
// dirt if it's left dry and bare.
function hydrate(w, x, y, z, id) {
  let wet = false;
  for (let dy = 0; dy <= 1 && !wet; dy++) for (let dz = -4; dz <= 4 && !wet; dz++) for (let dx = -4; dx <= 4; dx++) {
    if (WATERLIKE[w.getBlock(x + dx, y + dy, z + dz)] === 1) { wet = true; break; }
  }
  if (wet || w.listener?.rainingOn?.(x, y + 1, z)) { if (id !== B.farmland_moist) w.setBlock(x, y, z, B.farmland_moist); return; }
  if (id === B.farmland_moist) w.setBlock(x, y, z, B.farmland);
  else if (!CROP[w.getBlock(x, y + 1, z)] && !STEM[w.getBlock(x, y + 1, z)] && Math.random() < 0.15) w.setBlock(x, y, z, B.dirt);
}
function growTall(w, x, y, z, id, most = 3) {
  if (w.getBlock(x, y + 1, z) !== 0 || Math.random() > 0.3) return;
  let h = 1;
  while (h < most && w.getBlock(x, y - h, z) === id) h++;
  if (h < most) w.setBlock(x, y + 1, z, id);
}
// Grass creeps onto dirt beside it wherever the dirt sees daylight.
function spreadGrass(w, x, y, z) {
  const above = w.getBlock(x, y + 1, z);
  if (OPAQUE[above] || WATERLIKE[above] || light(w, x, y + 1, z) < 9) return;
  for (let k = 0; k < 4; k++) {
    const dx = Math.floor(Math.random() * 3) - 1, dy = Math.floor(Math.random() * 5) - 3, dz = Math.floor(Math.random() * 3) - 1;
    if (w.getBlock(x + dx, y + dy, z + dz) === B.grass_block) { w.setBlock(x, y, z, B.grass_block); return; }
  }
}

// ---------------------------------------------------------------- trees
// A sapling becomes a tree if there's room for one: the tree only grows into air, leaves and
// plants, and a sapling hemmed in by blocks stays a sapling.
export function growSapling(w, x, y, z, id, rnd = Math.random) {
  const wood = SAPLING[id];
  let kind = saplingTree(wood, rnd);
  let [rx, rz] = [x, z];
  if (WIDE_TREES.has(kind)) {
    // Dark oaks need four saplings in a square; so can spruces and jungle trees, which then
    // grow into giants.
    const sq = [[0, 0], [-1, 0], [0, -1], [-1, -1]].find(([ox, oz]) =>
      [[0, 0], [1, 0], [0, 1], [1, 1]].every(([a, b]) => w.getBlock(x + ox + a, y, z + oz + b) === id));
    if (!sq) { if (kind === 'dark_oak') return false; }
    else [rx, rz] = [x + sq[0], z + sq[1]];
  } else if ((wood === 'spruce' || wood === 'jungle')) {
    const sq = [[0, 0], [-1, 0], [0, -1], [-1, -1]].find(([ox, oz]) =>
      [[0, 0], [1, 0], [0, 1], [1, 1]].every(([a, b]) => w.getBlock(x + ox + a, y, z + oz + b) === id));
    if (sq) { kind = wood === 'spruce' ? 'mega_spruce' : 'mega_jungle'; [rx, rz] = [x + sq[0], z + sq[1]]; }
  }
  const wide = WIDE_TREES.has(kind);
  // Is there room for the trunk?
  for (let i = 1; i < 6; i++) {
    for (const [a, b] of wide ? [[0, 0], [1, 0], [0, 1], [1, 1]] : [[0, 0]]) {
      const c = w.getBlock(rx + a, y + i, rz + b);
      if (c && !REPLACEABLE[c] && !NATURAL_LEAVES[c] && !SAPLING[c]) return false;
    }
  }
  const put = (px, py, pz, pid, isLog, onlyAir) => {
    const cur = w.getBlock(px, py, pz);
    const ok = cur === 0 || (!onlyAir && (REPLACEABLE[cur] && !WATERLIKE[cur] || SAPLING[cur] || (isLog && NATURAL_LEAVES[cur]) ||
      (BLOCKS[cur]?.render === 2 && !SOLID[cur])));
    if (ok) w.setBlock(px, py, pz, pid);
    return ok;
  };
  if (wide) {
    for (const [a, b] of [[0, 0], [1, 0], [0, 1], [1, 1]]) if (SAPLING[w.getBlock(rx + a, y, rz + b)]) w.setBlock(rx + a, y, rz + b, 0);
  } else w.setBlock(x, y, z, 0);
  TREES[kind](put, rx, y, rz, rnd);
  // An oak, birch or cherry grown near flowers now and then has a bees' nest on it.
  if ((wood === 'oak' || wood === 'birch' || wood === 'cherry') && !wide && rnd() < 0.05 && flowersNear(w, x, y, z, 2)) {
    const at = nestSpot(w, x, y, z, rnd);
    if (at) { w.setBlock(at[0], at[1], at[2], hiveId(B.bee_nest, 0, at[3])); w.listener?.nestGrown?.(at[0], at[1], at[2]); }
  }
  return true;
}
const FLOWER = (id) => RENDER[id] === R.CROSS && BLOCKS[id]?.cat === 'nature' && /^(dandelion|poppy|cornflower|allium|azure_bluet|blue_orchid|oxeye_daisy|lily_of_the_valley|.*_tulip|sunflower|lilac|rose_bush|peony)$/.test(BLOCKS[id].name);
function flowersNear(w, x, y, z, r) {
  for (let dy = -1; dy <= 1; dy++) for (let dz = -r; dz <= r; dz++) for (let dx = -r; dx <= r; dx++) if (FLOWER(w.getBlock(x + dx, y + dy, z + dz))) return true;
  return false;
}
// Where a nest goes on a tree just grown from (x, y, z): on the side of the trunk just under its
// leaves, facing out (south, east or west first, as Minecraft's do). [x, y, z, facing] or null.
export function nestSpot(w, x, y, z, rnd = Math.random) {
  let top = y;
  while (LOG[w.getBlock(x, top + 1, z)] && top < y + 12) top++;
  let under = y + 1;
  for (let yy = y + 1; yy <= top; yy++) {
    if ([0, 1, 4, 5].some((f) => NATURAL_LEAVES[w.getBlock(x + FACE_DIRS[f][0], yy, z + FACE_DIRS[f][2])])) { under = yy - 1; break; }
    under = yy;
  }
  if (under < y + 1) return null;
  const sides = [4, 0, 1].sort(() => rnd() - 0.5).concat(5);
  for (const f of sides) {
    const d = FACE_DIRS[f], nx = x + d[0], nz = z + d[2];
    if (w.getBlock(nx, under, nz) === 0) return [nx, under, nz, f];
  }
  return null;
}

// ---------------------------------------------------------------- leaves
// When a log goes, the natural leaves around it check (a moment later, one by one) whether
// they're still within six leaves of any log; the ones that aren't wither away.
export function logRemoved(w, x, y, z) {
  for (let dy = -4; dy <= 4; dy++) for (let dz = -4; dz <= 4; dz++) for (let dx = -4; dx <= 4; dx++) {
    if (NATURAL_LEAVES[w.getBlock(x + dx, y + dy, z + dz)]) w.scheduleTick(x + dx, y + dy, z + dz, 10 + Math.floor(Math.random() * 60));
  }
}
const seen = new Map();
export function leafTick(w, x, y, z, id) {
  // Breadth-first through leaves, up to six steps, looking for a log.
  seen.clear();
  let frontier = [[x, y, z]];
  seen.set(`${x},${y},${z}`, 1);
  for (let step = 0; step < 6 && frontier.length; step++) {
    const next = [];
    for (const [cx, cy, cz] of frontier) {
      for (const d of FACE_DIRS) {
        const nx = cx + d[0], ny = cy + d[1], nz = cz + d[2], k = `${nx},${ny},${nz}`;
        if (seen.has(k)) continue;
        seen.set(k, 1);
        const n = w.getBlock(nx, ny, nz);
        if (LOG[n]) return;
        if (LEAVES_WOOD[n]) next.push([nx, ny, nz]);
      }
    }
    frontier = next;
  }
  w.setBlock(x, y, z, 0);
  w.listener?.leavesDecayed?.(x, y, z, id);
}

// What a withered or broken leaf block drops: sometimes a sapling, a stick or (oak and dark oak)
// an apple.
export function leafDrops(id, rnd = Math.random) {
  const wood = LEAVES_WOOD[id];
  if (!wood) return [];
  const out = [];
  if (rnd() < (wood === 'jungle' ? 0.025 : 0.05)) out.push({ block: WOOD[wood].sapling, count: 1 });
  if (rnd() < 0.02) out.push({ item: 'stick', count: 1 + Math.floor(rnd() * 2) });
  if ((wood === 'oak' || wood === 'dark_oak') && rnd() < 0.005) out.push({ item: 'apple', count: 1 });
  return out;
}
