// Tree shapes, shared by the world generator and by saplings. Each grows from (x, y, z), the
// block above the ground, through `put(x, y, z, id, isLog, onlyAir)`, which decides what may be
// overwritten and returns whether the block went in (see worldgen.js and growth.js).
import { WOOD, LOG_AXES, VINE } from './blocks.js';

// A log running from a to b, turned along its main direction.
function branch(put, log, [x0, y0, z0], [x1, y1, z1]) {
  const dx = x1 - x0, dy = y1 - y0, dz = z1 - z0;
  const n = Math.max(Math.abs(dx), Math.abs(dy), Math.abs(dz));
  const axes = LOG_AXES[log];
  const id = Math.abs(dy) >= Math.max(Math.abs(dx), Math.abs(dz)) ? log : Math.abs(dx) > Math.abs(dz) ? axes[0] : axes[1];
  for (let i = 0; i <= n; i++) {
    const t = n ? i / n : 0;
    put(Math.round(x0 + dx * t), Math.round(y0 + dy * t), Math.round(z0 + dz * t), id, true);
  }
}
// An ellipsoid of leaves, its surface a little ragged.
function blob(put, leaves, cx, cy, cz, rx, ry, rz, rnd, ragged = 0.35) {
  for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) {
    for (let z = Math.floor(cz - rz); z <= Math.ceil(cz + rz); z++) {
      for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
        const d = ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 + ((z - cz) / rz) ** 2;
        if (d > 1 || (d > 0.65 && rnd() < ragged)) continue;
        put(x, y, z, leaves, false);
      }
    }
  }
}
// A square layer of leaves with its corners trimmed (the classic Minecraft canopy).
function layer(put, leaves, cx, y, cz, r, rnd, cornerChance = 0.5) {
  for (let dz = -r; dz <= r; dz++) for (let dx = -r; dx <= r; dx++) {
    if (Math.abs(dx) === r && Math.abs(dz) === r && (r > 1 ? rnd() < cornerChance : true)) continue;
    put(cx + dx, y, cz + dz, leaves, false);
  }
}
// A round, flat layer of leaves.
function disc(put, leaves, cx, y, cz, r, rnd, ragged = 0.3) {
  for (let dz = -Math.ceil(r); dz <= Math.ceil(r); dz++) for (let dx = -Math.ceil(r); dx <= Math.ceil(r); dx++) {
    const d = Math.hypot(dx, dz);
    if (d > r + 0.3 || (d > r - 0.8 && rnd() < ragged)) continue;
    put(cx + dx, y, cz + dz, leaves, false);
  }
}
// Vines hanging from the outside of a canopy (`cells`: leaf positions just placed).
function hangVines(put, cells, rnd, chance, maxLen) {
  const SIDES = [[1, 0, 1], [-1, 0, 0], [0, 1, 5], [0, -1, 4]]; // offset, and the vine's wall side
  for (const [x, y, z] of cells) {
    for (const [ox, oz, side] of SIDES) {
      if (rnd() > chance) continue;
      const len = 1 + Math.floor(rnd() * maxLen);
      for (let k = 0; k < len; k++) if (!put(x + ox, y - k, z + oz, VINE[side], false, true)) break;
    }
  }
}
function trunk(put, log, x, y, z, h, wide = false) {
  for (let i = 0; i < h; i++) {
    put(x, y + i, z, log, true);
    if (wide) { put(x + 1, y + i, z, log, true); put(x, y + i, z + 1, log, true); put(x + 1, y + i, z + 1, log, true); }
  }
}

// ---------------------------------------------------------------- the trees
const oak = (w) => ({ log: WOOD[w].log, leaves: WOOD[w].leaves });

// The classic small tree: four to six logs under a two-tier canopy.
function small(put, x, y, z, rnd, wood, extra = 0) {
  const { log, leaves } = oak(wood);
  const h = 4 + Math.floor(rnd() * 3) + extra;
  for (let ly = y + h - 3; ly <= y + h; ly++) layer(put, leaves, x, ly, z, ly >= y + h - 1 ? 1 : 2, rnd);
  trunk(put, log, x, y, z, h);
}
// Big oaks: a tall trunk that throws out branches, each ending in a clump of leaves.
function bigOak(put, x, y, z, rnd, wood = 'oak') {
  const { log, leaves } = oak(wood);
  const h = 9 + Math.floor(rnd() * 6);
  const n = 3 + Math.floor(rnd() * 3);
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + rnd() * 1.2, len = 2.5 + rnd() * 3;
    const by = y + Math.floor(h * (0.45 + rnd() * 0.4));
    const end = [Math.round(x + Math.cos(a) * len), Math.round(by + len * 0.6), Math.round(z + Math.sin(a) * len)];
    blob(put, leaves, end[0], end[1] + 0.5, end[2], 2.6, 1.8, 2.6, rnd);
    branch(put, log, [x, by, z], end);
  }
  blob(put, leaves, x, y + h, z, 3.2, 2.4, 3.2, rnd);
  trunk(put, log, x, y, z, h);
}
function swampOak(put, x, y, z, rnd) {
  const { log, leaves } = oak('oak');
  const h = 5 + Math.floor(rnd() * 3);
  const cells = [];
  const rec = (px, py, pz, id, isLog) => { const ok = put(px, py, pz, id, isLog); if (ok && !isLog) cells.push([px, py, pz]); return ok; };
  for (let ly = y + h - 3; ly <= y + h; ly++) layer(rec, leaves, x, ly, z, ly >= y + h - 1 ? 2 : 3, rnd, 0.6);
  trunk(put, log, x, y, z, h);
  hangVines(put, cells.filter(([, cy]) => cy <= y + h - 2), rnd, 0.3, 4);
}
function tallBirch(put, x, y, z, rnd) {
  const { log, leaves } = oak('birch');
  const h = 10 + Math.floor(rnd() * 5);
  for (let ly = y + h - 5; ly <= y + h; ly++) layer(put, leaves, x, ly, z, ly >= y + h - 1 ? 1 : 2, rnd, 0.6);
  put(x, y + h + 1, z, leaves, false);
  trunk(put, log, x, y, z, h);
}
// Spruces: rings of needles that widen and narrow again going down, over a bare trunk.
const SPRUCE_RINGS = [0, 1, 1, 2, 1, 2, 2, 3, 2, 3, 3, 2, 3, 3];
function spruce(put, x, y, z, rnd, tall = false) {
  const { log, leaves } = oak('spruce');
  const h = (tall ? 11 : 7) + Math.floor(rnd() * (tall ? 7 : 4));
  const bare = tall ? Math.floor(h * 0.35) : 1 + Math.floor(rnd() * 2);
  for (let i = 0, ly = y + h; ly >= y + bare; ly--, i++) {
    const r = SPRUCE_RINGS[Math.min(i, SPRUCE_RINGS.length - 1)] - (tall && i > 8 ? 1 : 0);
    if (r <= 0) { put(x, ly, z, leaves, false); continue; }
    layer(put, leaves, x, ly, z, r, rnd, 1);
  }
  put(x, y + h + 1, z, leaves, false);
  trunk(put, log, x, y, z, h);
}
// A pine: a long bare trunk with a small crown of needles at the top.
function pine(put, x, y, z, rnd) {
  const { log, leaves } = oak('spruce');
  const h = 12 + Math.floor(rnd() * 6);
  const rings = [0, 1, 1, 2, 1, 2, 1];
  rings.forEach((r, i) => (r ? layer(put, leaves, x, y + h - i, z, r, rnd, 1) : put(x, y + h - i, z, leaves, false)));
  put(x, y + h + 1, z, leaves, false);
  trunk(put, log, x, y, z, h);
}
// Giant spruces on a trunk two logs wide.
function megaSpruce(put, x, y, z, rnd) {
  const { log, leaves } = oak('spruce');
  const h = 20 + Math.floor(rnd() * 10);
  const crown = Math.floor(h * 0.6);
  for (let i = 0; i < crown; i++) {
    const r = Math.min(5, Math.floor(i / 3.2)) + (i % 3 === 2 ? 0 : -1) + 1;
    disc(put, leaves, x + 0.5, y + h - i, z + 0.5, Math.max(0.6, r + 0.4), rnd, 0.25);
  }
  put(x, y + h + 1, z, leaves, false);
  trunk(put, log, x, y, z, h, true);
}
function jungleBush(put, x, y, z, rnd) {
  const { log, leaves } = oak('jungle');
  put(x, y, z, log, true);
  blob(put, leaves, x, y + 0.6, z, 2.4, 1.5, 2.4, rnd, 0.3);
}
function smallJungle(put, x, y, z, rnd) {
  const { log, leaves } = oak('jungle');
  const h = 5 + Math.floor(rnd() * 5);
  const cells = [];
  const rec = (px, py, pz, id, isLog) => { const ok = put(px, py, pz, id, isLog); if (ok && !isLog) cells.push([px, py, pz]); return ok; };
  for (let ly = y + h - 3; ly <= y + h; ly++) layer(rec, leaves, x, ly, z, ly >= y + h - 1 ? 2 : 3, rnd, 0.7);
  trunk(put, log, x, y, z, h);
  hangVines(put, cells.filter(([, cy]) => cy <= y + h - 2), rnd, 0.15, 3);
}
// Jungle giants: a trunk two wide rising through branches to a broad, flat crown hung with vines.
function megaJungle(put, x, y, z, rnd) {
  const { log, leaves } = oak('jungle');
  const h = 16 + Math.floor(rnd() * 12);
  const cells = [];
  const rec = (px, py, pz, id, isLog) => { const ok = put(px, py, pz, id, isLog); if (ok && !isLog) cells.push([px, py, pz]); return ok; };
  blob(rec, leaves, x + 0.5, y + h, z + 0.5, 5, 2.2, 5, rnd, 0.35);
  blob(rec, leaves, x + 0.5, y + h + 2, z + 0.5, 3, 1.6, 3, rnd, 0.35);
  for (let by = y + 8 + Math.floor(rnd() * 3); by < y + h - 4; by += 3 + Math.floor(rnd() * 3)) {
    const a = rnd() * Math.PI * 2, len = 2 + rnd() * 3;
    const sx = x + (Math.cos(a) > 0 ? 1 : 0), sz = z + (Math.sin(a) > 0 ? 1 : 0);
    const end = [Math.round(sx + Math.cos(a) * len), by + 2, Math.round(sz + Math.sin(a) * len)];
    blob(rec, leaves, end[0], end[1] + 0.5, end[2], 2.6, 1.4, 2.6, rnd);
    branch(put, log, [sx, by, sz], end);
  }
  trunk(put, log, x, y, z, h, true);
  hangVines(put, cells, rnd, 0.22, 7);
  // Vines climbing the trunk too.
  for (let i = 1; i < h - 2; i++) {
    if (rnd() < 0.3) put(x - 1, y + i, z + (i & 1), VINE[0], false, true);
    if (rnd() < 0.3) put(x + 2, y + i, z + (i & 1), VINE[1], false, true);
  }
}
// Acacias: a trunk that leans off to one side and ends in a flat, wide crown (sometimes two).
function acacia(put, x, y, z, rnd) {
  const { log, leaves } = oak('acacia');
  const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1], [1, -1], [-1, 1]];
  const h = 5 + Math.floor(rnd() * 3);
  const bend = h - 1 - Math.floor(rnd() * 3);
  const [dx, dz] = DIRS[Math.floor(rnd() * 8)];
  let tx = x, tz = z, ty = y;
  for (let i = 0; i < h; i++) {
    if (i >= bend) { tx += dx; tz += dz; }
    put(tx, ty, tz, log, true);
    ty++;
  }
  const crown = (cx, cy, cz, big) => {
    disc(put, leaves, cx, cy, cz, big ? 3.3 : 2.4, rnd, 0.2);
    disc(put, leaves, cx, cy + 1, cz, big ? 2.2 : 1.4, rnd, 0.3);
  };
  crown(tx, ty, tz, true);
  if (rnd() < 0.5) {
    // A second, shorter branch off the other way.
    let bx = x, bz = z, by = y + bend - 1;
    const len = 2 + Math.floor(rnd() * 2);
    for (let i = 0; i < len; i++) { bx -= dx; bz -= dz; by++; put(bx, by, bz, log, true); }
    crown(bx, by + 1, bz, false);
  }
}
// Dark oaks: short, thick trunks under a dense canopy.
function darkOak(put, x, y, z, rnd) {
  const { log, leaves } = oak('dark_oak');
  const h = 6 + Math.floor(rnd() * 3);
  blob(put, leaves, x + 0.5, y + h - 0.5, z + 0.5, 4.6, 2.2, 4.6, rnd, 0.25);
  blob(put, leaves, x + 0.5, y + h + 1.2, z + 0.5, 3, 1.4, 3, rnd, 0.3);
  for (let i = 0; i < 4; i++) {
    const ox = i & 1 ? 2 : -1, oz = i & 2 ? 2 : -1;
    if (rnd() < 0.6) branch(put, log, [x + (ox > 0 ? 1 : 0), y + h - 3, z + (oz > 0 ? 1 : 0)], [x + ox, y + h - 1, z + oz]);
  }
  trunk(put, log, x, y, z, h, true);
}
// Cherry trees: a short trunk splitting into two or three curving boughs under wide pink crowns
// that droop at the edges.
function cherry(put, x, y, z, rnd) {
  const { log, leaves } = oak('cherry');
  const h = 4 + Math.floor(rnd() * 2);
  trunk(put, log, x, y, z, h);
  const n = 2 + Math.floor(rnd() * 2);
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + rnd() * 1.5, len = 3 + rnd() * 2;
    const end = [Math.round(x + Math.cos(a) * len), y + h + 2 + Math.floor(rnd() * 2), Math.round(z + Math.sin(a) * len)];
    branch(put, log, [x, y + h - 1, z], [Math.round(x + Math.cos(a) * 1.5), y + h + 1, Math.round(z + Math.sin(a) * 1.5)]);
    branch(put, log, [Math.round(x + Math.cos(a) * 1.5), y + h + 1, Math.round(z + Math.sin(a) * 1.5)], end);
    blob(put, leaves, end[0], end[1] + 1, end[2], 3.6, 1.6, 3.6, rnd, 0.3);
    // Blossom hanging down from the rim.
    for (let k = 0; k < 8; k++) {
      const b = rnd() * Math.PI * 2;
      const hx = Math.round(end[0] + Math.cos(b) * 3), hz = Math.round(end[2] + Math.sin(b) * 3);
      put(hx, end[1], hz, leaves, false); if (rnd() < 0.5) put(hx, end[1] - 1, hz, leaves, false);
    }
  }
}

// ---------------------------------------------------------------- choosing
// Kinds of tree, by name. Two-wide trees also need the three columns beside their root.
export const TREES = {
  oak: (put, x, y, z, rnd) => small(put, x, y, z, rnd, 'oak'),
  big_oak: bigOak,
  swamp_oak: swampOak,
  birch: (put, x, y, z, rnd) => small(put, x, y, z, rnd, 'birch', 1),
  tall_birch: tallBirch,
  spruce: (put, x, y, z, rnd) => spruce(put, x, y, z, rnd, false),
  tall_spruce: (put, x, y, z, rnd) => spruce(put, x, y, z, rnd, true),
  pine,
  mega_spruce: megaSpruce,
  jungle_bush: jungleBush,
  jungle: smallJungle,
  mega_jungle: megaJungle,
  acacia,
  dark_oak: darkOak,
  cherry,
};
export const WIDE_TREES = new Set(['mega_spruce', 'mega_jungle', 'dark_oak']);
// How far a tree of each kind can reach sideways from its root, and how tall it can grow.
export const TREE_REACH = 9, TREE_HEIGHT = 32;

// What a sapling grows into.
export function saplingTree(wood, rnd) {
  switch (wood) {
    case 'oak': return rnd() < 0.1 ? 'big_oak' : 'oak';
    case 'birch': return 'birch';
    case 'spruce': return rnd() < 0.3 ? 'tall_spruce' : 'spruce';
    case 'jungle': return 'jungle';
    case 'acacia': return 'acacia';
    case 'dark_oak': return 'dark_oak';
    case 'cherry': return 'cherry';
    default: return 'oak';
  }
}
