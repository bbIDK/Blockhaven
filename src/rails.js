// Rails and minecarts. Track comes in ten shapes, as in the original: straight north-south or
// east-west, up a slope in each of the four directions, and the four quarter turns (each shape is
// a block of its own; see RAIL in blocks.js). A rail laid down turns to join the rails beside it,
// and they turn to join it. Powered rails push a cart along while they're powered and brake it
// while they're not; detector rails give power while a cart is on them. A minecart follows the
// track: faster downhill, slowing on the level, flying off the end of the line.
import { RAIL, RAIL_ID, SOLID } from './blocks.js';
import { boxMesh, MODEL_OFFSET } from './models.js';
import { TEX } from './textures.js';
import { identity, translate, rotateY, rotateX } from './math.js';

const DIR = { n: [0, -1], s: [0, 1], e: [1, 0], w: [-1, 0] };
const BACK = { n: 's', s: 'n', e: 'w', w: 'e' };
// Each shape's two ends: [the side it leaves by, whether that end is a block up].
export const SHAPES = [
  [['n', 0], ['s', 0]], [['e', 0], ['w', 0]],
  [['e', 1], ['w', 0]], [['w', 1], ['e', 0]], [['n', 1], ['s', 0]], [['s', 1], ['n', 0]],
  [['s', 0], ['e', 0]], [['s', 0], ['w', 0]], [['n', 0], ['w', 0]], [['n', 0], ['e', 0]],
];
export const railId = (kind, shape, on = false) => RAIL_ID[kind][on ? 1 : 0][shape];

// ---------------------------------------------------------------- laying track
// Two rails meet where their ends are at the same height on the edge between their blocks. A
// rail's end on `side`, if it has one: its height.
function endHeight(id, y, side) {
  const end = SHAPES[RAIL[id].shape].find(([s]) => s === side);
  return end ? y + end[1] : null;
}
// The rail that meets the edge of column (x, z) on `side` at height h: level with it, or sloping
// up to it from the block below.
export function railAt(w, x, z, side, h) {
  const [dx, dz] = DIR[side];
  for (const ny of [h, h - 1]) {
    const id = w.getBlock(x + dx, ny, z + dz);
    if (RAIL[id] && endHeight(id, ny, BACK[side]) === h) return { x: x + dx, y: ny, z: z + dz, id };
  }
  return null;
}
// Any rail on side `d` of (x, y, z): level with it, a step up or a step down.
function beside(w, x, y, z, d) {
  const [dx, dz] = DIR[d];
  for (const dy of [0, 1, -1]) {
    const id = w.getBlock(x + dx, y + dy, z + dz);
    if (RAIL[id]) return { x: x + dx, y: y + dy, z: z + dz, dy, id };
  }
  return null;
}
// How many of a rail's ends another rail meets.
const joined = (w, r) => SHAPES[RAIL[r.id].shape].filter(([side, up]) => railAt(w, r.x, r.z, side, r.y + up)).length;

// The shape a rail of `kind` at (x, y, z) takes, given the rails around it (`facing`: the way it
// was laid, for a rail on its own: 'ns' or 'ew'). It joins the rails that already meet it, and
// those with an end still free to turn its way; a rail a step up makes it slope up to meet it.
export function shapeFor(w, x, y, z, kind, facing = 'ns') {
  const to = {};
  for (const d of ['n', 's', 'e', 'w']) {
    const n = beside(w, x, y, z, d);
    if (!n) continue;
    const meets = endHeight(n.id, n.y, BACK[d]) === y + (n.dy === 1 ? 1 : 0);
    if (meets || joined(w, n) < 2) to[d] = n.dy;
  }
  const up = (d) => to[d] === 1;
  if ('n' in to && 's' in to) return up('n') ? 4 : up('s') ? 5 : 0;
  if ('e' in to && 'w' in to) return up('e') ? 2 : up('w') ? 3 : 1;
  if (kind === 'rail') {
    if ('s' in to && 'e' in to) return 6;
    if ('s' in to && 'w' in to) return 7;
    if ('n' in to && 'w' in to) return 8;
    if ('n' in to && 'e' in to) return 9;
  }
  if ('n' in to || 's' in to) return up('n') ? 4 : up('s') ? 5 : 0;
  if ('e' in to || 'w' in to) return up('e') ? 2 : up('w') ? 3 : 1;
  return facing === 'ew' ? 1 : 0;
}

// A rail was just laid at (x, y, z): it takes its shape, then the rails it points at turn to
// meet it.
export function layRail(w, x, y, z, facing) {
  const r = RAIL[w.getBlock(x, y, z)];
  if (!r) return;
  const shape = shapeFor(w, x, y, z, r.kind, facing);
  w.setBlock(x, y, z, railId(r.kind, shape, r.on));
  for (const [side, up] of SHAPES[shape]) {
    if (railAt(w, x, z, side, y + up)) continue;
    const n = beside(w, x, y, z, side);
    if (!n) continue;
    const nr = RAIL[n.id], ns = shapeFor(w, n.x, n.y, n.z, nr.kind, [1, 2, 3].includes(nr.shape) ? 'ew' : 'ns');
    if (ns !== nr.shape) w.setBlock(n.x, n.y, n.z, railId(nr.kind, ns, nr.on));
  }
}

// ---------------------------------------------------------------- the path along a rail
// The two ends of a rail's path, in the block: [x, y, z] each (the middle of the edge it leaves
// by, raised a block at the top of a slope).
export function railEnds(shape) {
  return SHAPES[shape].map(([side, up]) => { const [dx, dz] = DIR[side]; return [0.5 + dx * 0.5, up, 0.5 + dz * 0.5, side]; });
}

// ---------------------------------------------------------------- minecarts
export const CART_MAX = 8;       // blocks a second, the fastest a cart goes
const CART = { hw: 0.49, h: 0.7 };

// The rail under a cart at (x, y, z), if any: its block and id.
function railUnder(w, x, y, z) {
  const bx = Math.floor(x), bz = Math.floor(z);
  for (const by of [Math.floor(y + 0.1), Math.floor(y + 0.1) - 1]) {
    const id = w.getBlock(bx, by, bz);
    if (RAIL[id]) return { x: bx, y: by, z: bz, id };
  }
  return null;
}
// Put the cart on the rail r at the point of its path nearest to where it is, going the way its
// velocity was.
function board(e, r) {
  const [a, b] = railEnds(RAIL[r.id].shape);
  const px = e.x - r.x, pz = e.z - r.z, dx = b[0] - a[0], dz = b[2] - a[2], len2 = dx * dx + dz * dz;
  const t = Math.max(0, Math.min(1, ((px - a[0]) * dx + (pz - a[2]) * dz) / len2));
  const len = Math.sqrt(len2);
  e.rail = { x: r.x, y: r.y, z: r.z, t, s: (e.vx * dx + e.vz * dz) / len };
}

// A cart's movement each frame. `push`: [x, z], which way its rider leans (or someone shoves it).
export function cartPhysics(w, e, dt, push = null, hooks = null) {
  if (!e.rail) {
    const r = railUnder(w, e.x, e.y, e.z);
    if (r && e.vy <= 0.5) board(e, r);
  }
  if (e.rail && !RAIL[w.getBlock(e.rail.x, e.rail.y, e.rail.z)]) e.rail = null;
  if (!e.rail) {
    // Off the rails: it falls, and scrapes to a stop on the ground.
    e.vy = Math.max(-40, e.vy - 32 * dt);
    const f = e.onGround ? Math.exp(-6 * dt) : Math.exp(-0.2 * dt);
    e.vx *= f; e.vz *= f;
    e.move(w, e.vx * dt, e.vy * dt, e.vz * dt);
    if (e.hitWall) { e.vx *= 0.2; e.vz *= 0.2; }
    e.pitch = (e.pitch ?? 0) * Math.exp(-6 * dt);
    return;
  }
  const R = e.rail;
  let steps = 0;
  let left = dt;
  while (left > 1e-6 && steps++ < 8) {
    const id = w.getBlock(R.x, R.y, R.z), info = RAIL[id];
    if (!info) { e.rail = null; break; }
    const [a, b] = railEnds(info.shape);
    const dx = b[0] - a[0], dy = b[1] - a[1], dz = b[2] - a[2], len = Math.hypot(dx, dz);
    const ux = dx / len, uz = dz / len;
    // Downhill it speeds up, uphill it slows.
    if (dy) R.s -= (dy > 0 ? 1 : -1) * 6.5 * left * (len / Math.hypot(dx, dy, dz));
    // Powered rails: on, they push it the way it's going (off a wall, if it's standing still);
    // off, they bring it to a stop.
    if (info.kind === 'powered') {
      if (info.on) {
        if (Math.abs(R.s) < 0.2) {
          const wallA = SOLID[w.getBlock(R.x + Math.round((a[0] - 0.5) * 2), R.y, R.z + Math.round((a[2] - 0.5) * 2))];
          const wallB = SOLID[w.getBlock(R.x + Math.round((b[0] - 0.5) * 2), R.y, R.z + Math.round((b[2] - 0.5) * 2))];
          if (wallA && !wallB) R.s = 1; else if (wallB && !wallA) R.s = -1;
        } else R.s += Math.sign(R.s) * 24 * left;
      } else R.s *= Math.exp(-12 * left);
    }
    if (push) R.s += (push[0] * ux + push[1] * uz) * left;
    // Rolling along: a ridden cart keeps going, an empty one soon stops.
    R.s *= Math.exp(-(e.rider ? 0.06 : 0.8) * left);
    if (Math.abs(R.s) > CART_MAX) R.s = Math.sign(R.s) * CART_MAX;
    const dist = R.s * left, span = Math.hypot(dx, dy, dz);
    let t = R.t + dist / span;
    left = 0;
    if (t > 1 || t < 0) {
      // Out of this block: into the next rail, if one meets this end (with the rest of the move).
      const end = t > 1 ? b : a, over = (t > 1 ? t - 1 : -t) * span;
      const [side, up] = SHAPES[info.shape][t > 1 ? 1 : 0];
      const next = railAt(w, R.x, R.z, side, R.y + up);
      if (next) {
        const [na] = railEnds(RAIL[next.id].shape);
        const entersA = na[3] === BACK[side];
        R.x = next.x; R.y = next.y; R.z = next.z;
        R.t = entersA ? 0 : 1;
        R.s = Math.abs(R.s) * (entersA ? 1 : -1);
        left = over / Math.max(1e-3, Math.abs(R.s));
        hooks?.entered?.(R.x, R.y, R.z);
        continue;
      }
      // The end of the line: off it goes (just past the end, so it doesn't get back on).
      const dir = Math.sign(R.s), vx = ux * R.s, vz = uz * R.s;
      e.x = R.x + end[0] + ux * dir * 0.02; e.y = R.y + end[1] + 0.02; e.z = R.z + end[2] + uz * dir * 0.02;
      e.vx = vx; e.vz = vz; e.vy = dy ? (dy / span) * R.s : 0;
      e.rail = null;
      e.move(w, e.vx * dt * 0.5, 0, e.vz * dt * 0.5);
      return;
    }
    R.t = t;
  }
  if (!e.rail) return;
  const info = RAIL[w.getBlock(R.x, R.y, R.z)];
  if (!info) { e.rail = null; return; }
  const [a, b] = railEnds(info.shape);
  e.x = R.x + a[0] + (b[0] - a[0]) * R.t;
  e.y = R.y + a[1] + (b[1] - a[1]) * R.t + 1 / 16;
  e.z = R.z + a[2] + (b[2] - a[2]) * R.t;
  const dx = b[0] - a[0], dz = b[2] - a[2], len = Math.hypot(dx, dz);
  e.vx = (dx / len) * R.s; e.vz = (dz / len) * R.s; e.vy = 0;
  e.onGround = true;
  // It faces along the track (the way it's going), tipped up or down on a slope.
  if (Math.abs(R.s) > 0.05) e.yaw = Math.atan2(-e.vx, -e.vz);
  else if (e.yaw === undefined) e.yaw = Math.atan2(-dx, -dz);
  const dy = b[1] - a[1];
  const pitch = dy ? Math.atan2(dy, len) * (Math.cos(e.yaw - Math.atan2(-dx, -dz)) > 0 ? 1 : -1) : 0;
  e.pitch = (e.pitch ?? 0) + (pitch - (e.pitch ?? 0)) * Math.min(1, dt * 12);
}

// ---------------------------------------------------------------- drawing
// A minecart: an iron tub, 20 pixels long, 16 wide and 10 high, open at the top.
let cartMeshCache = null;
export function cartMesh(r) {
  if (cartMeshCache?.r === r) return cartMeshCache.mesh;
  const P = 1 / 16, L = TEX.minecart;
  const box = (x0, y0, z0, x1, y1, z1) => {
    const w = x1 - x0, h = y1 - y0, d = z1 - z0;
    const size = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]];
    return { from: [x0 * P, y0 * P, z0 * P], to: [x1 * P, y1 * P, z1 * P], faces: size.map(([u, v]) => ({ layer: L, uv: [0, 0, Math.min(16, u), Math.min(16, v)] })) };
  };
  const mesh = r.createMesh(boxMesh([
    box(-7, 1, -9, 7, 3, 9),
    box(-8, 1, -10, -6, 10, 10), box(6, 1, -10, 8, 10, 10),
    box(-6, 1, -10, 6, 10, -8), box(-6, 1, 8, 6, 10, 10),
  ]));
  cartMeshCache = { r, mesh };
  return mesh;
}
export function cartModel(m, rx, ry, rz, yaw, pitch) {
  identity(m);
  translate(m, m, rx, ry, rz);
  rotateY(m, m, yaw);
  if (pitch) rotateX(m, m, pitch);
  translate(m, m, -MODEL_OFFSET, -MODEL_OFFSET, -MODEL_OFFSET);
  return m;
}
export const CART_SIZE = CART;
