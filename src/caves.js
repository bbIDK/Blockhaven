// Cave blocks that shape themselves to what's around them: pointed dripstone thins from its root to
// its tip (and where a stalactite comes down to meet a stalagmite, both tips merge), and a cave
// vine's lowest piece is its growing tip. The world generator lays them out the same way.
import { DRIPSTONE, DRIPSTONE_ID, CAVE_VINES, caveVineId } from './blocks.js';

// The parts of a spike `n` long, root first: base, middles, frustum, tip.
export function dripParts(n, merged = false) {
  const out = [];
  for (let k = 0; k < n; k++) {
    const fromTip = n - 1 - k;
    out.push(fromTip === 0 ? (merged ? 'tip_merge' : 'tip') : fromTip === 1 ? 'frustum' : k === 0 ? 'base' : 'middle');
  }
  return out;
}
export const dripId = (up, part) => DRIPSTONE_ID[up ? 1 : 0][part];

// Re-shapes the spike of pointed dripstone through (x, y, z), and the one its tip meets.
export function reshapeDripstone(w, x, y, z, again = true) {
  const d = DRIPSTONE[w.getBlock(x, y, z)];
  if (!d) return;
  const dir = d.up ? 1 : -1, same = (yy) => DRIPSTONE[w.getBlock(x, yy, z)]?.up === d.up;
  let root = y;
  while (same(root - dir)) root -= dir;
  let tip = root;
  while (same(tip + dir)) tip += dir;
  const facing = DRIPSTONE[w.getBlock(x, tip + dir, z)];
  const merged = !!facing && facing.up !== d.up;
  dripParts(Math.abs(tip - root) + 1, merged).forEach((part, k) => w.setBlock(x, root + k * dir, z, dripId(d.up, part), { updates: false }));
  if (again) {
    // (The other spike's tip merges, or stops merging, with this one's.)
    if (merged) reshapeDripstone(w, x, tip + dir, z, false);
    else {
      const beyond = DRIPSTONE[w.getBlock(x, tip + 2 * dir, z)];
      if (beyond && beyond.up !== d.up) reshapeDripstone(w, x, tip + 2 * dir, z, false);
    }
  }
}

// A cave vine is a tip when there's no more vine below it.
export function reshapeVine(w, x, y, z) {
  const v = CAVE_VINES[w.getBlock(x, y, z)];
  if (!v) return;
  const tip = !CAVE_VINES[w.getBlock(x, y - 1, z)];
  if (tip !== v.tip) w.setBlock(x, y, z, caveVineId(tip, v.lit), { updates: false });
}
