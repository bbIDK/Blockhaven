// What creatures of every kind have in common: turning to face things, wandering about, looking
// for prey and striking it, aiming what they throw, and seeing whether the way is clear. Shared
// by mobs.js and nethermobs.js.
import { SOLID } from './blocks.js';

export const TAU = Math.PI * 2;
export const wrap = (a) => a - Math.round(a / TAU) * TAU;

export function wander(e, chance = 0.4) {
  if (--e.wander > 0) return;
  if (e.moving || Math.random() < chance) { e.moving = false; e.wander = 40 + Math.floor(Math.random() * 80); }
  else { e.moving = true; e.yaw = Math.random() * TAU; e.wander = 30 + Math.floor(Math.random() * 70); }
  e.speedMul = 1;
}

export const faceTowards = (e, x, z) => { e.yaw = Math.atan2(-(x - e.x), -(z - e.z)); };

export const faceAway = (e, x, z) => { e.yaw = Math.atan2(x - e.x, z - e.z); };

export const dist2 = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);

// Someone's wolves go after `foe`: whatever their owner (a player's id) attacked, or whatever
// attacked them. (Not creepers, and not another of the same owner's pets.)
export function rallyPets(ents, uid, foe) {
  if (!foe || foe.kind !== 'mob' || foe.def.explodes || (foe.owner && foe.owner === uid)) return;
  for (const o of ents.list) {
    if (o.kind !== 'mob' || !o.def.defends || !o.owner || o.sitting || o.dead || o.dying || o === foe) continue;
    if ((o.owner === uid || !ents.game.net) && dist2(o, foe) < 20) { o.target = foe; o.angry = 200; }
  }
}

// Players (and for zombies, villagers) a monster could go after (no more than `tall` blocks above
// or below it).
export function preyFor(ents, e, range, tall = 12) {
  let best = null, bd = range;
  for (const p of ents.players) {
    if (p.creative || p.dead || Math.abs(p.y - e.y) > tall) continue;
    const dd = Math.hypot(p.x - e.x, p.y - e.y, p.z - e.z);
    // (Someone invisible has to all but walk into them to be noticed.)
    if (dd < bd && (!p.invisible || dd < 2.5)) { bd = dd; best = p; }
  }
  if (e.def.hunts) {
    for (const o of ents.list) {
      if (o.kind !== 'mob' || o.def.kind !== 'civilian' || o.dead || o.dying) continue;
      const dd = Math.hypot(o.x - e.x, o.y - e.y, o.z - e.z);
      if (dd < bd * 0.8) { bd = dd; best = o; }
    }
  }
  return best;
}

export const targetGone = (t) => !t || t.dead || t.dying || t.creative;

export function meleeTick(ents, e, tg, dist, dy) {
  const reach = e.hw + (tg.hw ?? 0.3) + 0.75;
  if (dist < reach && dy > -1.5 && dy < e.h && e.attackCd === 0) {
    e.attackCd = 20;
    e.swing = 1;
    const k = 5 / Math.max(0.1, dist);
    const dmg = e.damage ?? e.def.damage ?? 2;
    const why = `You were slain by ${/^[AEIOU]/.test(e.def.label) ? 'an' : 'a'} ${e.def.label.toLowerCase()}`;
    // Iron golems fling what they hit into the air; hoglins toss it with their tusks.
    const up = e.def.heavy ? 9 : e.def.tosses ? 8 : 4.5;
    if (tg.kind === 'mob') { ents.hurtMob(tg, dmg, e, e.def.heavy ? 1.5 : 0); if (e.def.heavy || e.def.tosses) tg.vy = up; }
    else { ents.game.hurtPlayer(tg, dmg, why, [(tg.x - e.x) * k * 0.3, up, (tg.z - e.z) * k * 0.3], true); rallyPets(ents, tg.uid, e); }
    if (e.def.poison && tg.kind !== 'mob') ents.game.giveEffect?.(tg, 'poison', ...e.def.poison);
    // A wither skeleton's blade leaves its victim withering.
    if (e.def.withers && tg.kind !== 'mob') ents.game.giveEffect?.(tg, 'wither', e.def.withers, 1);
    if (e.def.heavy) ents.game.audio.mob('golem', 'attack', { x: e.x, y: e.y + 2, z: e.z });
  }
}

// The velocity to throw or shoot something at `v` blocks a second from (ex, ey, ez) so that it
// comes down on (tx, ty, tz): aimed that much higher to allow for its fall (gravity 20, as in
// Entities.arrowPhysics; the flatter of the two arcs that reach).
export function aimAt(ex, ey, ez, tx, ty, tz, v) {
  const dx = tx - ex, dz = tz - ez, dy = ty - ey, h = Math.hypot(dx, dz) || 1e-3, G = 20, v2 = v * v;
  const disc = v2 * v2 - G * (G * h * h + 2 * dy * v2);
  // (Out of reach: as far as it will go.)
  const ang = disc >= 0 ? Math.atan2(v2 - Math.sqrt(disc), G * h) : Math.PI / 4, c = Math.cos(ang);
  return [(dx / h) * v * c, v * Math.sin(ang), (dz / h) * v * c];
}

// Whether there's a clear line from (ax, ay, az) to (bx, by, bz): nothing solid in the way (grass,
// flowers and the like don't hide anyone).
export function clearLine(w, ax, ay, az, bx, by, bz) {
  const len = Math.hypot(bx - ax, by - ay, bz - az), n = Math.ceil(len * 4);
  for (let i = 1; i < n; i++) {
    const f = i / n;
    if (SOLID[w.getBlock(Math.floor(ax + (bx - ax) * f), Math.floor(ay + (by - ay) * f), Math.floor(az + (bz - az) * f))]) return false;
  }
  return true;
}

export function steer(e, f, sp) {
  const dx = f.x - e.x, dy = f.y - e.y, dz = f.z - e.z, len = Math.hypot(dx, dy, dz) || 1;
  e.flyVel = [(dx / len) * sp, (dy / len) * sp, (dz / len) * sp];
  e.moving = true;
}
