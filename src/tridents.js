// Thrown tridents, as in Minecraft. One flies like a heavy arrow (hardly slowed by water), hits
// the first creature in its way for 8 (more with Impaling, on sea creatures) and drops away, or
// sticks where it lands, to be picked up again by whoever gets to it. With Loyalty it comes back:
// once it has hit something or stuck fast, it flies home to whoever threw it, through anything in
// the way, faster the higher the level. A thrown trident never vanishes of its own accord (one a
// drowned throws does, a minute after it lands).
//
// It's an arrow entity (entities.js) with `trident`: the stack that was thrown (its wear and
// enchantments come back with it).
import { rigMeshes, boneMatrix } from './rigs.js';
import { identity, translate, rotateX, rotateY } from './math.js';
import { enchLevel } from './enchanting.js';
import { extras } from './inventory.js';
import { I } from './items.js';
import { SOLID } from './blocks.js';

// Sea creatures (what Impaling is for).
export const AQUATIC = new Set(['squid', 'glow_squid', 'cod', 'salmon', 'tropical_fish', 'pufferfish', 'dolphin', 'shark', 'guardian', 'elder_guardian',
  'blue_whale', 'humpback_whale', 'turtle', 'axolotl', 'tadpole']);
export const impalingBonus = (stack, type) => (AQUATIC.has(type) ? 2.5 * enchLevel(stack, 'impaling') : 0);

// Who threw it, where they are now (null: gone).
function thrower(ents, e) {
  const o = e.owner;
  if (!o) return null;
  if (o.kind === 'mob') return o.dead ? null : o;
  const q = ents.players.find((p) => (p.addr ?? null) === (o.addr ?? null));
  return q && !q.dead ? q : null;
}

// Hands the trident back to player `q` (the host, or a guest over the network). False if there's
// no room for it.
function giveBack(ents, e, q) {
  const game = ents.game, st = e.trident;
  if (!q.addr) {
    if (game.creative && !e.pickup) return true;
    if (game.inv.add(st.id, 1, st.dmg ?? 0, extras(st)) !== 0) return false;
    game.audio.pop();
    game.invChanged();
    return true;
  }
  if (e.pickup) game.net?.giveStack?.(q.addr, st);
  return true;
}

// A trident strikes a creature or a player: the damage, then it drops away (it only strikes once).
export function tridentHit(ents, e, victim, dx, dz) {
  const game = ents.game, at = { x: e.x, y: e.y, z: e.z };
  const dmg = 8 + (victim.kind === 'mob' ? impalingBonus(e.trident, victim.type) : 0);
  if (victim.kind === 'mob') ents.hurtMob(victim, dmg, e.owner ?? at);
  else game.hurtPlayer(victim, dmg, e.owner?.label ? `You were impaled by a ${e.owner.label.toLowerCase()}` : 'You were impaled', [dx * 3, 2, dz * 3], true,
    e.owner?.kind === 'mob');
  game.audio.trident?.('hit', at);
  e.vx *= -0.01; e.vy *= -0.1; e.vz *= -0.01;
  e.dealt = true;
}

// A trident's own movement, before (or instead of) an arrow's: returns true when it's dealt with
// this frame. Stuck: anyone near picks it up; with Loyalty, it sets off home. Coming home: flies
// straight to its thrower's eyes, through the land, and back into their hands.
export function tridentPhysics(ents, e, dt) {
  const game = ents.game;
  const loyal = e.loyalty > 0 && e.owner && e.owner.kind !== 'mob';
  if (e.stuck) {
    e.stuckFor = (e.stuckFor ?? 0) + dt;
    // (A drowned's trident goes after a minute; a player's stays till it's picked up.)
    if (!e.pickup && !loyal && e.stuckFor > 60) { e.dead = true; return true; }
    if (loyal && e.stuckFor > 0.2) e.returning = true;
  }
  if (e.returning || (loyal && (e.dealt || e.y < -20))) {
    const q = thrower(ents, e);
    if (!q) {
      // (Its thrower is gone: it drops where it is.)
      if (e.pickup) ents.spawnItem(e.x, e.y, e.z, e.trident.id, 1, e.trident.dmg ?? 0, 0.5, [0, 0, 0], extras(e.trident));
      e.dead = true;
      return true;
    }
    if (!e.returning) { e.returning = true; game.audio.trident?.('return', { x: e.x, y: e.y, z: e.z }); }
    e.stuck = false;
    const L = e.loyalty, k = dt * 20, eyeY = q.y + (q.kind === 'mob' ? q.h * 0.85 : 1.62);
    const vx = q.x - e.x, vy = eyeY - e.y, vz = q.z - e.z, d = Math.hypot(vx, vy, vz) || 1;
    if (d < 1.2 && giveBack(ents, e, q)) { e.dead = true; return true; }
    const a = 1 - Math.pow(0.95, k);
    e.vx = e.vx * (1 - a) + (vx / d) * 20 * L * a;
    e.vy = e.vy * (1 - a) + (vy / d) * 20 * L * a;
    e.vz = e.vz * (1 - a) + (vz / d) * 20 * L * a;
    e.y += vy * 0.015 * L * k;
    // (It never goes past them, whatever its speed.)
    const sp = Math.hypot(e.vx, e.vy, e.vz), step = Math.min(sp * dt, d);
    if (sp > 1e-6) { e.x += (e.vx / sp) * step; e.y += (e.vy / sp) * step; e.z += (e.vz / sp) * step; }
    e.ayaw = Math.atan2(e.vx, e.vz); e.apitch = -Math.atan2(e.vy, Math.hypot(e.vx, e.vz));
    return true;
  }
  if (e.stuck) {
    // Out of what it was stuck in: it falls.
    if (!SOLID[ents.world.getBlock(e.bx, e.by, e.bz)]) { e.stuck = false; e.vx = e.vy = e.vz = 0; return false; }
    if (e.stuckFor > 0.5) {
      for (const q of ents.players) {
        if (q.dead || Math.hypot(q.x - e.x, q.y + 0.9 - e.y, q.z - e.z) > 1.6) continue;
        if (!e.pickup && !(q.creative && !q.addr)) continue;
        if (giveBack(ents, e, q)) { e.dead = true; ents.game.net?.entityGone?.(e, 'p'); return true; }
      }
    }
    return true;
  }
  return false;
}

// Draws a thrown trident (Minecraft's model, with the pack's picture): laid along its flight,
// its tip just ahead of where it is.
export function drawTrident(ents, e, rx, ry, rz, light, out) {
  const r = ents.game.renderer;
  const base = identity(ents.mat());
  translate(base, base, rx, ry, rz);
  rotateY(base, base, e.ayaw ?? 0);
  rotateX(base, base, (e.apitch ?? 0) - Math.PI / 2);
  translate(base, base, 0, -26 / 16, 0);
  const glint = e.trident?.ench || e.glint ? 1 : 0;
  const parts = rigMeshes(r, 'trident', { main: 'trident' }).map(({ name, bone, mesh }) => ({ mesh, model: boneMatrix(ents.mat(), base, bone, {}, name), glint }));
  out.push({ parts, light, tint: null });
}

// A trident as saved: where it is and how it's stuck, and the stack (see Entities.serialize).
export function saveTrident(e) {
  return { k: 'trident', x: e.x, y: e.y, z: e.z, a: e.ayaw ?? 0, p: e.apitch ?? 0, it: { id: e.trident.id, dmg: e.trident.dmg ?? 0, ex: extras(e.trident) ?? undefined },
    b: e.stuck ? [e.bx, e.by, e.bz] : undefined, lo: e.loyalty || undefined };
}
export const isTrident = (id) => id === I.trident;
