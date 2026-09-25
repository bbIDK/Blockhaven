// Switches and what they work, a simple kind of redstone. Levers, buttons, pressure plates and
// blocks of redstone power the blocks beside them, and a switch also powers through the block
// it's fixed to (so a lever on a wall works a door on the other side of it). Powered, doors,
// trapdoors and fence gates open, redstone lamps light up and TNT goes off; iron doors and iron
// trapdoors open only this way. Only the host (or a single player) works this out; everyone else
// sees the blocks change.
import { B, SWITCH, DOOR, TRAPDOOR, trapdoorId, GATE, gateId, SOLID, FACE_DIRS } from './blocks.js';

const isSource = (id) => !!SWITCH[id] || id === B.redstone_block;
const isOn = (id) => !!SWITCH[id]?.on || id === B.redstone_block;
const family = (id) => (DOOR[id] ? 'door' : TRAPDOOR[id] ? 'trapdoor' : GATE[id] ? 'gate'
  : id === B.redstone_lamp || id === B.redstone_lamp_on ? 'lamp' : id === B.tnt ? 'tnt' : null);

// Is anything powering the block at (x, y, z)?
export function poweredAt(w, x, y, z) {
  for (let f = 0; f < 6; f++) {
    const d = FACE_DIRS[f], nx = x + d[0], ny = y + d[1], nz = z + d[2];
    const n = w.getBlock(nx, ny, nz);
    if (isOn(n)) return true;
    // A block with a switch fixed to it (one whose support is this block) passes its power on.
    if (SOLID[n] && !SWITCH[n]) {
      for (let g = 0; g < 6; g++) {
        const e = FACE_DIRS[g], s = SWITCH[w.getBlock(nx + e[0], ny + e[1], nz + e[2])];
        if (s?.on && s.attach === (g ^ 1)) return true;
      }
    }
  }
  return false;
}

// Brings the block at (x, y, z) into line with whether it's powered.
export function refresh(w, x, y, z) {
  const id = w.getBlock(x, y, z), kind = family(id);
  if (!kind) return;
  if (kind === 'door') {
    const d = DOOR[id], ly = d.upper ? y - 1 : y;
    const on = poweredAt(w, x, ly, z) || poweredAt(w, x, ly + 1, z);
    if (d.open !== on && w.toggleDoor(x, y, z)) w.listener?.blockSound?.(x, ly, z, on ? 'open' : 'close');
  } else if (kind === 'trapdoor') {
    const t = TRAPDOOR[id], on = poweredAt(w, x, y, z);
    if (t.open !== on && w.setBlock(x, y, z, trapdoorId(t.base, t.hinge, t.top, on), { updates: false })) w.listener?.blockSound?.(x, y, z, on ? 'open' : 'close');
  } else if (kind === 'gate') {
    const g = GATE[id], on = poweredAt(w, x, y, z);
    if (g.open !== on && w.setBlock(x, y, z, gateId(g.base, g.facing, on), { updates: false })) w.listener?.blockSound?.(x, y, z, on ? 'open' : 'close');
  } else if (kind === 'lamp') {
    const want = poweredAt(w, x, y, z) ? B.redstone_lamp_on : B.redstone_lamp;
    if (id !== want) w.setBlock(x, y, z, want, { updates: false });
  } else if (kind === 'tnt' && poweredAt(w, x, y, z)) {
    w.setBlock(x, y, z, 0);
    w.listener?.igniteTNT?.(x, y, z);
  }
}

// After a block changed from `old` to `id` at (x, y, z) (called by the world).
export function powerChanged(w, x, y, z, old, id) {
  if (isSource(old) || isSource(id)) {
    // Everything the switch reaches, before and after: its neighbours, and those of the block
    // it's fixed to.
    const s = SWITCH[old] ?? SWITCH[id];
    const centres = [[x, y, z]];
    if (s) { const d = FACE_DIRS[s.attach]; centres.push([x + d[0], y + d[1], z + d[2]]); }
    for (const [cx, cy, cz] of centres) {
      for (const d of FACE_DIRS) {
        const px = cx + d[0], py = cy + d[1], pz = cz + d[2];
        if (px !== x || py !== y || pz !== z) refresh(w, px, py, pz);
      }
    }
  }
  // Something newly set down beside a switch that's on.
  const kind = family(id);
  if (kind && kind !== family(old)) refresh(w, x, y, z);
}

// Does this block change matter to power at all? (A cheap check for the world to make first.)
export const powerMatters = (old, id) => isSource(old) || isSource(id) || (family(id) !== null && family(id) !== family(old));
