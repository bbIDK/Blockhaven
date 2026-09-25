// Things that grow and change by themselves: crops, saplings, farmland drying out, grass spreading,
// sugar cane and cactus getting taller (on random ticks, see World.randomTicks), and leaves
// withering once the tree they belong to has been cut down.
import {
  B, BLOCKS, CROP, SAPLING, NATURAL_LEAVES, LEAVES_WOOD, LOG, OPAQUE, SOLID, WATERLIKE, REPLACEABLE, WOOD, FACE_DIRS,
} from './blocks.js';
import { TREES, WIDE_TREES, saplingTree } from './trees.js';

// Light at a block, counting skylight only as far as the sun is up (the game keeps
// `world.daylight` current).
const light = (w, x, y, z) => { const l = w.getLight(x, y, z); return Math.max(l & 15, (l >> 4) * (w.daylight ?? 1)); };

export function randomTick(w, x, y, z, id) {
  const crop = CROP[id];
  if (crop) growCrop(w, x, y, z, crop, 1);
  else if (SAPLING[id]) { if (Math.random() < 1 / 7 && light(w, x, y + 1, z) >= 9) growSapling(w, x, y, z, id); }
  else if (id === B.farmland || id === B.farmland_moist) hydrate(w, x, y, z, id);
  else if (id === B.sugar_cane || id === B.cactus) growTall(w, x, y, z, id);
  else if (id === B.dirt) spreadGrass(w, x, y, z);
  else if (id === B.kelp) growKelp(w, x, y, z);
}

// Kelp grows up through still water, a block now and then, until it nears the surface (or reaches
// its own height, anywhere up to about 25 blocks).
function growKelp(w, x, y, z) {
  if (Math.random() > 0.14 || w.getBlock(x, y + 1, z) !== B.water || w.getBlock(x, y + 2, z) !== B.water) return;
  let base = y;
  while (base > 0 && (w.getBlock(x, base - 1, z) === B.kelp_plant || w.getBlock(x, base - 1, z) === B.kelp)) base--;
  if (y - base >= 2 + Math.floor(((x * 73856093) ^ (z * 19349663)) >>> 0) % 24) return;
  w.setBlock(x, y + 1, z, B.kelp);
}

// ---------------------------------------------------------------- crops
// Crops on wet farmland grow about twice as fast as on dry.
export function growCrop(w, x, y, z, crop, steps) {
  if (crop.stage >= crop.max) return false;
  if (steps === 1) {
    const wet = w.getBlock(x, y - 1, z) === B.farmland_moist;
    if (light(w, x, y, z) < 9 || Math.random() > (wet ? 0.45 : 0.22)) return false;
  }
  return w.setBlock(x, y, z, crop.first + Math.min(crop.max, crop.stage + steps));
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
  else if (!CROP[w.getBlock(x, y + 1, z)] && Math.random() < 0.15) w.setBlock(x, y, z, B.dirt);
}
function growTall(w, x, y, z, id) {
  if (w.getBlock(x, y + 1, z) !== 0 || Math.random() > 0.3) return;
  let h = 1;
  while (h < 3 && w.getBlock(x, y - h, z) === id) h++;
  if (h < 3) w.setBlock(x, y + 1, z, id);
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
  return true;
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
