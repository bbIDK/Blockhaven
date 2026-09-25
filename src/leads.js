// Leads, as Minecraft has them: a creature on a lead follows whoever holds it, or waits tied to a
// fence post; the rope sags between them, and snaps if they get too far apart. A creature's
// `leash` is { uid } (a player holds it; on a guest's copy, the player's key) or { x, y, z } (the
// fence post it's tied to). Only the host changes it.
import { SHAPE_KIND } from './blocks.js';
import { I } from './items.js';
import { TEX } from './textures.js';
import { boxMesh, MODEL_OFFSET } from './models.js';
import { mat4 } from './math.js';

export const LEAD_SLACK = 4, LEAD_PULL = 6, LEAD_SNAP = 10;
export const isFence = (id) => SHAPE_KIND[id] === 2;

// Whether player `uid` holds the lead of `e`. (Playing alone, every lead held is yours.)
export const holdsLead = (ents, e, uid) => !!e.leash?.uid && (e.leash.uid === uid || !ents.game.net);

// Where the lead of `e` is held (the holder's hand, or the knot on the post), or null when
// whoever holds it isn't about.
export function leashAnchor(ents, e) {
  const l = e.leash;
  if (!l) return null;
  if (l.uid) {
    const p = ents.players.find((q) => q.uid === l.uid) ?? (ents.game.net ? null : ents.players[0]);
    return p && !p.dead ? { x: p.x, y: p.y + 0.9, z: p.z } : null;
  }
  return { x: l.x + 0.5, y: l.y + 0.55, z: l.z + 0.5 };
}

// The lead comes off: it drops where the creature is when `drop` (it snapped, or was untied).
export function unleash(ents, e, drop) {
  if (!e.leash) return;
  e.leash = null;
  e.leashLost = 0;
  if (drop) ents.spawnItem(e.x, e.y + e.h * 0.6, e.z, I.lead, 1);
  ents.game.net?.resend?.(e);
}

// Each tick, on the host: once its lead is taut a creature goes to whoever holds it, and the lead
// snaps when they're too far apart (or the post it was tied to is gone). True when the lead has
// decided where it goes this tick.
export function leashTick(ents, e) {
  const l = e.leash;
  if (!l.uid && !isFence(ents.world.getBlock(l.x, l.y, l.z))) { unleash(ents, e, true); return false; }
  const a = leashAnchor(ents, e);
  if (!a) {
    // (Whoever held it has left: the lead drops after a moment.)
    if ((e.leashLost = (e.leashLost ?? 0) + 1) > 100) unleash(ents, e, true);
    return false;
  }
  e.leashLost = 0;
  const dx = a.x - e.x, dz = a.z - e.z, d = Math.hypot(dx, a.y - e.y - e.h * 0.5, dz);
  if (d > LEAD_SNAP) { unleash(ents, e, true); return false; }
  if (Math.hypot(dx, dz) < LEAD_SLACK) return false;
  e.yaw = Math.atan2(-dx, -dz);
  e.moving = true; e.speedMul = d > LEAD_PULL ? 1.8 : 1.2;
  e.target = null; e.panic = 0; e.sitting = false; e.graze = 0;
  return true;
}

// Each frame, on the host: stretched past LEAD_PULL, the lead drags the creature along (up a
// bank too, if that's where it's pulled).
export function leashPull(ents, e, dt) {
  const a = leashAnchor(ents, e);
  if (!a) return;
  const dx = a.x - e.x, dy = a.y - (e.y + e.h * 0.5), dz = a.z - e.z, d = Math.hypot(dx, dy, dz);
  if (d <= LEAD_PULL) return;
  const k = Math.min(40, (d - LEAD_PULL) * 30) * dt;
  e.vx += (dx / d) * k; e.vz += (dz / d) * k;
  if (dy > 0.5) e.vy = Math.max(e.vy, Math.min(8, e.vy + (dy / d) * k * 2.5));
}

// Player `uid` used the fence post at x, y, z: the creatures on their leads are tied to it; or,
// holding none, they take the leads of those tied there. True if anything happened.
export function useFence(ents, uid, x, y, z) {
  if (!isFence(ents.world.getBlock(x, y, z))) return false;
  const leashed = ents.list.filter((e) => e.kind === 'mob' && !e.dead && !e.dying && e.leash);
  const mine = leashed.filter((e) => holdsLead(ents, e, uid) && Math.hypot(e.x - x - 0.5, e.y - y, e.z - z - 0.5) < LEAD_SNAP);
  const tied = mine.length ? [] : leashed.filter((e) => !e.leash.uid && e.leash.x === x && e.leash.y === y && e.leash.z === z);
  for (const e of mine) e.leash = { x, y, z };
  for (const e of tied) e.leash = { uid };
  for (const e of [...mine, ...tied]) ents.game.net?.resend?.(e);
  return mine.length + tied.length > 0;
}

// ---------------------------------------------------------------- drawing
// The rope: a chain of short thin boxes, alternately light and dark, sagging between the holder's
// hand (or the knot) and the creature's neck. `holder(e)` gives where the rope starts for a lead
// that a player holds (null: not drawn).
let meshes = null;
function leadMeshes(r) {
  if (meshes?.r === r) return meshes;
  const part = (from, to, tint, uv = [0, 0, 16, 16]) => r.createMesh(boxMesh([{ from, to, faces: { layer: TEX.lead_rope, uv }, tint }]));
  meshes = {
    r,
    light: part([0, 0, 0], [1, 1, 1], null),
    dark: part([0, 0, 0], [1, 1, 1], [150, 132, 118]),
    // The knot round a post: 6 by 8 by 6 pixels.
    knot: part([5 / 16, 5 / 16, 5 / 16], [11 / 16, 13 / 16, 11 / 16], null, [5, 3, 11, 11]),
  };
  return meshes;
}
const SEGMENTS = 16, THICK = 0.05;

// A model matrix that stretches the unit box into a rope segment from a to b (camera-relative).
function segmentModel(m, ax, ay, az, bx, by, bz) {
  const ex = bx - ax, ey = by - ay, ez = bz - az, len = Math.hypot(ex, ey, ez) || 1e-4;
  // Across the rope: level, at right angles to it; and the third way, at right angles to both.
  let sx = -ez, sz = ex, sl = Math.hypot(sx, sz);
  if (sl < 1e-4) { sx = 1; sz = 0; sl = 1; }
  sx = (sx / sl) * THICK; sz = (sz / sl) * THICK;
  const ux = (ey * sz) / len, uy = (ez * sx - ex * sz) / len, uz = (-ey * sx) / len;
  m[0] = ex; m[1] = ey; m[2] = ez; m[3] = 0;
  m[4] = sx; m[5] = 0; m[6] = sz; m[7] = 0;
  m[8] = ux; m[9] = uy; m[10] = uz; m[11] = 0;
  // (Centred on the line; the mesh's positions carry MODEL_OFFSET.)
  const cx = ax - (sx + ux) / 2, cy = ay - uy / 2, cz = az - (sz + uz) / 2, O = MODEL_OFFSET;
  m[12] = cx - O * (ex + sx + ux); m[13] = cy - O * (ey + uy); m[14] = cz - O * (ez + sz + uz); m[15] = 1;
  return m;
}

export function drawLeads(game, cam, out, mats, holder) {
  const r = game.renderer, w = game.world;
  if (!r || !w) return;
  let k = 0;
  const mat = () => (mats[k] ??= mat4(), mats[k++]);
  const knots = new Set();
  for (const e of game.entities.list) {
    if (e.kind !== 'mob' || e.dead || !e.leash || Math.hypot(e.x - cam.x, e.z - cam.z) > 48) continue;
    const l = e.leash;
    let a;
    if (l.uid) { a = holder(l.uid); if (!a) continue; }
    else { a = { x: l.x + 0.5, y: l.y + 9 / 16, z: l.z + 0.5 }; knots.add(`${l.x},${l.y},${l.z}`); }
    const M = leadMeshes(r);
    // Its end: at the front of its neck.
    const fx = -Math.sin(e.yaw), fz = -Math.cos(e.yaw), reach = e.hw * (e.def.anim === 'quad' ? 1.1 : 0.4);
    const b = { x: e.x + fx * reach, y: e.y + e.h * 0.78, z: e.z + fz * reach };
    const d = Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z);
    const sag = d * 0.12 * Math.min(1, Math.max(0.1, (LEAD_PULL - d) / LEAD_PULL + 0.3));
    const light = w.getLight(Math.floor((a.x + b.x) / 2), Math.floor((a.y + b.y) / 2), Math.floor((a.z + b.z) / 2));
    const parts = [];
    let px = a.x - cam.x, py = a.y - cam.y, pz = a.z - cam.z;
    for (let i = 1; i <= SEGMENTS; i++) {
      const t = i / SEGMENTS;
      const qx = a.x + (b.x - a.x) * t - cam.x, qy = a.y + (b.y - a.y) * t - Math.sin(t * Math.PI) * sag - cam.y, qz = a.z + (b.z - a.z) * t - cam.z;
      parts.push({ mesh: i % 2 ? M.light : M.dark, model: segmentModel(mat(), px, py, pz, qx, qy, qz) });
      px = qx; py = qy; pz = qz;
    }
    out.push({ parts, light: [light >> 4, light & 15], tint: null });
  }
  for (const key of knots) {
    const [x, y, z] = key.split(',').map(Number), m = mat(), l = w.getLight(x, y, z);
    m.fill(0); m[0] = m[5] = m[10] = m[15] = 1;
    m[12] = x - cam.x - MODEL_OFFSET; m[13] = y - cam.y - MODEL_OFFSET; m[14] = z - cam.z - MODEL_OFFSET;
    out.push({ parts: [{ mesh: leadMeshes(r).knot, model: m }], light: [l >> 4, l & 15], tint: null });
  }
}
