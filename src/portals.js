// Nether portals, as in the original. An obsidian frame (inside it, two to twenty-one wide and
// three to twenty-one high; the corners can be left out) lit with fire fills with portal. Stand
// in it for a few seconds and it takes you to the other side: in the Nether, eight times nearer
// the middle of things; back in the overworld, eight times farther. There you arrive in the
// portal already there if one is near enough, or else in a new one built for you.
import { B, PORTAL, SOLID, REPLACEABLE, WATERLIKE } from './blocks.js';
import { NETHER_X, NETHER_SCALE, NETHER_TOP, HEIGHT, CHUNK, NETHER_CX, inNether } from './config.js';

const MIN_W = 2, MAX_W = 21, MIN_H = 3, MAX_H = 21;
export const PORTAL_ID = { x: 2416, z: 2417 };
// How far round the spot it leads to a portal is looked for: into the Nether, 16 blocks (128 in
// overworld terms); back out, 128.
export const SEARCH = { nether: 16, overworld: 128 };
const BUILD_SEARCH = 16;
// Where the overworld may be led to (it stops short of the Nether's region).
const OVER_MIN = -500000, OVER_MAX = NETHER_CX * CHUNK - 4096, Z_LIMIT = 500000;

const open = (id) => id === 0 || id === B.fire || PORTAL[id] !== undefined;

// The frame round (x, y, z), standing along `axis`: { axis, x, y, z, w, h } where x, y, z is the
// lower left of the inside, or null if there isn't a whole one.
export function frameAt(world, x, y, z, axis) {
  const dx = axis === 'x' ? 1 : 0, dz = 1 - dx, get = (px, py, pz) => world.getBlock(px, py, pz);
  if (!open(get(x, y, z))) return null;
  let by = y;
  while (by > 1 && y - by < MAX_H && open(get(x, by - 1, z))) by--;
  if (get(x, by - 1, z) !== B.obsidian) return null;
  // Along the bottom to the left side...
  let lx = x, lz = z;
  for (let n = 0; n < MAX_W && open(get(lx - dx, by, lz - dz)) && get(lx - dx, by - 1, lz - dz) === B.obsidian; n++) { lx -= dx; lz -= dz; }
  if (get(lx - dx, by, lz - dz) !== B.obsidian) return null;
  // ...and across to the right.
  let w = 0;
  while (w <= MAX_W && open(get(lx + dx * w, by, lz + dz * w)) && get(lx + dx * w, by - 1, lz + dz * w) === B.obsidian) w++;
  if (w < MIN_W || w > MAX_W || get(lx + dx * w, by, lz + dz * w) !== B.obsidian) return null;
  // Up: rows open all the way across between obsidian sides, then a lintel of obsidian.
  let h = 0;
  rows: for (; h <= MAX_H; h++) {
    const py = by + h;
    if (get(lx - dx, py, lz - dz) !== B.obsidian || get(lx + dx * w, py, lz + dz * w) !== B.obsidian) break;
    for (let i = 0; i < w; i++) if (!open(get(lx + dx * i, py, lz + dz * i))) break rows;
  }
  if (h < MIN_H || h > MAX_H) return null;
  for (let i = 0; i < w; i++) if (get(lx + dx * i, by + h, lz + dz * i) !== B.obsidian) return null;
  return { axis, x: lx, y: by, z: lz, w, h };
}

// Fire at (x, y, z): if it's inside a frame, the frame fills with portal. True if it did.
export function lightPortal(world, x, y, z) {
  const f = frameAt(world, x, y, z, 'x') ?? frameAt(world, x, y, z, 'z');
  if (!f) return false;
  fill(world, f);
  return true;
}

function fill(world, f) {
  const id = PORTAL_ID[f.axis], dx = f.axis === 'x' ? 1 : 0, dz = 1 - dx;
  // (Without block updates: until the sheet is whole, its first blocks wouldn't stand.)
  for (let j = 0; j < f.h; j++) for (let i = 0; i < f.w; i++) world.setBlock(f.x + dx * i, f.y + j, f.z + dz * i, id, { updates: false });
}

// Where a portal at (x, y, z) leads (roughly): { nether, x, y, z } for the other side.
export function destination(x, y, z) {
  if (inNether(x)) {
    const tx = Math.min(OVER_MAX, Math.max(OVER_MIN, (x - NETHER_X) * NETHER_SCALE));
    const tz = Math.min(Z_LIMIT, Math.max(-Z_LIMIT, z * NETHER_SCALE));
    return { nether: false, x: Math.floor(tx), y: Math.min(HEIGHT - 12, Math.max(4, Math.floor(y))), z: Math.floor(tz) };
  }
  return { nether: true, x: Math.floor(NETHER_X + x / NETHER_SCALE), y: Math.min(NETHER_TOP - 10, Math.max(8, Math.floor(y))),
    z: Math.floor(Math.min(Z_LIMIT, Math.max(-Z_LIMIT, z)) / NETHER_SCALE) };
}

// Chunk columns that must be loaded to arrive at `to`: [cx, cz, radius].
export function arrivalArea(to) {
  const r = Math.ceil((Math.max(to.nether ? SEARCH.nether : SEARCH.overworld, BUILD_SEARCH) + 4) / CHUNK);
  return [to.x >> 4, to.z >> 4, r];
}

// The portal nearest `to` within the search distance (among loaded chunks), as the block where
// someone would stand in it: { x, y, z, axis }, or null.
export function findPortal(world, to) {
  const reach = to.nether ? SEARCH.nether : SEARCH.overworld, top = to.nether ? NETHER_TOP : HEIGHT;
  const a = PORTAL_ID.x, b = PORTAL_ID.z;
  let best = null, bd = Infinity;
  for (let cz = (to.z - reach) >> 4; cz <= (to.z + reach) >> 4; cz++) {
    for (let cx = (to.x - reach) >> 4; cx <= (to.x + reach) >> 4; cx++) {
      const c = world.readyChunk(cx, cz);
      if (!c) continue;
      const blocks = c.blocks, end = top * 256;
      for (let i = 256; i < end; i++) {
        const id = blocks[i];
        if (id !== a && id !== b) continue;
        // Only the bottom of each column of portal.
        if (blocks[i - 256] === id) continue;
        const x = cx * 16 + (i & 15), z = cz * 16 + ((i >> 4) & 15), y = i >> 8;
        if (Math.abs(x - to.x) > reach || Math.abs(z - to.z) > reach) continue;
        const d = (x - to.x) ** 2 + (z - to.z) ** 2 + ((y - to.y) ** 2) * 0.25;
        if (d < bd) { bd = d; best = { x, y, z, axis: PORTAL[id] }; }
      }
    }
  }
  return best;
}

// Where to stand in the portal whose block (x, y, z) is on its bottom row: in the middle of the
// bottom row (its length along the portal's axis), halfway through its thickness.
export function standIn(world, { x, y, z, axis }) {
  const dx = axis === 'x' ? 1 : 0, dz = 1 - dx, id = PORTAL_ID[axis];
  let a = 0, b = 0;
  while (a < MAX_W && world.getBlock(x - dx * (a + 1), y, z - dz * (a + 1)) === id) a++;
  while (b < MAX_W && world.getBlock(x + dx * (b + 1), y, z + dz * (b + 1)) === id) b++;
  const mid = (b - a) / 2;
  return { x: x + 0.5 + dx * mid, y, z: z + 0.5 + dz * mid, axis };
}

// Builds a new portal as near `to` as it can: on open ground within 16 blocks if there's any (with
// room to step out on either side if possible), or else floating on a little obsidian platform.
// `axis` is the way the portal came from stands. Returns where to stand in it: { x, y, z, axis }.
export function buildPortal(world, to, axis) {
  const dx = axis === 'x' ? 1 : 0, dz = 1 - dx;      // along the portal
  const sx = dz, sz = -dx;                              // its sides (front and back)
  const top = (to.nether ? NETHER_TOP : HEIGHT) - 2;
  const free = (x, y, z) => { const id = world.getBlock(x, y, z); return id === 0 || (REPLACEABLE[id] && !WATERLIKE[id]); };
  // Room for the frame (four wide, the four rows above the ground open, the ground solid) in the
  // row `off` to the side of (x, y, z).
  const hosts = (x, y, z, off) => {
    for (let i = -1; i < 3; i++) for (let j = -1; j < 4; j++) {
      const px = x + dx * i + sx * off, py = y + j, pz = z + dz * i + sz * off;
      if (j < 0 ? !SOLID[world.getBlock(px, py, pz)] : !free(px, py, pz)) return false;
    }
    return true;
  };
  let best = null, bd = Infinity, fallback = null, fd = Infinity;
  for (let r = 0; r <= BUILD_SEARCH; r++) {
    for (let oz = -r; oz <= r; oz++) for (let ox = -r; ox <= r; ox++) {
      if (Math.max(Math.abs(ox), Math.abs(oz)) !== r) continue;
      const x = to.x + ox, z = to.z + oz;
      if (!world.isLoaded(x, z) || !world.isLoaded(x + dx * 3, z + dz * 3)) continue;
      for (let y = top - 4; y > 1; y--) {
        if (!free(x, y, z) || free(x, y - 1, z)) continue;
        if (!hosts(x, y, z, 0)) continue;
        const d = (x - to.x) ** 2 + (y - to.y) ** 2 + (z - to.z) ** 2;
        if (hosts(x, y, z, -1) && hosts(x, y, z, 1)) { if (d < bd) { bd = d; best = [x, y, z]; } } else if (d < fd) { fd = d; fallback = [x, y, z]; }
      }
    }
    // (Nearer rings can't be beaten by farther ones by much; stop once there's a good spot.)
    if (best && r >= 4) break;
  }
  let at = best ?? fallback;
  if (!at) {
    // Nowhere: a platform of obsidian in the air (or in the rock), cleared round.
    const y = Math.min(top - 8, Math.max(to.nether ? 70 : 64, to.y));
    at = [to.x, y, to.z];
    for (let s = -1; s <= 1; s++) for (let i = 0; i < 2; i++) for (let k = -1; k < 3; k++) {
      world.setBlock(to.x + dx * i + sx * s, y + k, to.z + dz * i + sz * s, k < 0 ? B.obsidian : 0);
    }
  }
  const [x, y, z] = at;
  // The frame, sitting in the ground it stands on, and the portal inside it.
  for (let i = -1; i < 3; i++) for (let j = -1; j < 4; j++) {
    if (i === -1 || i === 2 || j === -1 || j === 3) world.setBlock(x + dx * i, y + j, z + dz * i, B.obsidian);
  }
  fill(world, { axis, x, y, z, w: 2, h: 3 });
  return { x, y, z, axis };
}
