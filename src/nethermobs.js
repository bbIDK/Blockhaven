// How the Nether's creatures behave, beyond what they share with the rest (see mobs.js):
// ghasts drifting high over the lava and spitting fireballs; blazes hovering and loosing bursts
// of small ones; piglins, hostile unless you wear gold, who trade for gold ingots (and turn into
// zombified piglins in the overworld); hoglins, who flee warped fungus; striders, who walk the
// lava seas and go cold and purple off it; and where each of them turns up.
import { B, SOLID, WATERLIKE, liquidHeight } from './blocks.js';
import { I, itemDef } from './items.js';
import { BIOME } from './biomes.js';
import { inNether } from './config.js';
import { TEX } from './textures.js';
import { TAU, wander, faceTowards, faceAway, dist2, preyFor, targetGone, clearLine, steer } from './mobkit.js';

// ---------------------------------------------------------------- ghasts
// A ghast wanders the open air (slowly, far from anything solid if it can), and when it sees a
// player within 64 blocks it turns, opens its eyes with a shriek, and spits a fireball.
export function ghastTick(ents, e) {
  const w = ents.world;
  if (targetGone(e.target) || Math.hypot(e.target.x - e.x, e.target.y - e.y, e.target.z - e.z) > 64) e.target = null;
  if (!e.target && (e.targetCd = (e.targetCd ?? 0) - 1) <= 0) { e.targetCd = 20; e.target = preyFor(ents, e, 64, 64); }
  const tg = e.target, eyeY = e.y + 2.2;
  const sees = tg && clearLine(w, e.x, eyeY, e.z, tg.x, tg.y + 1.5, tg.z);
  if (sees) {
    e.facing = tg;
    e.charge = (e.charge ?? 0) + 1;
    if (e.charge === 10) { e.alt = true; ents.game.audio.mob('ghast', 'warn', { x: e.x, y: eyeY, z: e.z }); }
    if (e.charge >= 20) {
      const fx = -Math.sin(e.yaw), fz = -Math.cos(e.yaw), sx = e.x + fx * 2.2, sy = e.y + 2, sz = e.z + fz * 2.2;
      const dx = tg.x - sx, dy = tg.y + 1.2 - sy, dz = tg.z - sz, len = Math.hypot(dx, dy, dz) || 1, v = 14;
      ents.spawnFireball(sx, sy, sz, (dx / len) * v, (dy / len) * v, (dz / len) * v, e, 'large');
      ents.game.audio.mob('ghast', 'shoot', { x: sx, y: sy, z: sz });
      e.charge = -40;
      e.alt = false;
    }
  } else {
    e.facing = null;
    e.charge = Math.max(0, (e.charge ?? 0) - 1);
    if (e.charge < 10) e.alt = false;
  }
  // Drifting: a new spot to float to now and then (or when it bumps into something).
  const f = e.flyTarget, near = f && Math.hypot(f.x - e.x, f.y - e.y, f.z - e.z) < 2;
  if (!f || near || e.hitWall || Math.random() < 0.01) {
    e.flyTarget = null;
    for (let k = 0; k < 8; k++) {
      const x = e.x + (Math.random() - 0.5) * 32, y = e.y + (Math.random() - 0.5) * 16, z = e.z + (Math.random() - 0.5) * 32;
      if (!roomFor(w, x, y, z, 2)) continue;
      // (It keeps its distance from anyone it's after.)
      if (tg && Math.hypot(x - tg.x, z - tg.z) < 10) continue;
      e.flyTarget = { x, y, z };
      break;
    }
  }
  if (e.flyTarget) steer(e, e.flyTarget, e.def.speed * 0.6); else e.flyVel = [0, 0, 0];
}
// Open air round (x, y, z), `r` blocks out along each axis.
function roomFor(w, x, y, z, r) {
  for (const [dx, dy, dz] of [[0, 0, 0], [r, 0, 0], [-r, 0, 0], [0, r, 0], [0, -r, 0], [0, 0, r], [0, 0, -r]]) {
    const id = w.getBlock(Math.floor(x + dx), Math.floor(y + dy), Math.floor(z + dz));
    if (SOLID[id] || WATERLIKE[id]) return false;
  }
  return true;
}

// ---------------------------------------------------------------- blazes
// A blaze hovers at about the height of what it's after, keeping a few blocks off; every few
// seconds it bursts into flame and looses three small fireballs, one after another. Close to, it
// burns what it touches.
export function blazeTick(ents, e) {
  const w = ents.world, game = ents.game;
  if (Math.random() < 0.06) game.particles.smoke(e.x, e.y + 1 + Math.random(), e.z, 1, 0.3);
  if (targetGone(e.target) || dist2(e.target, e) > 48) e.target = null;
  if (!e.target && (e.targetCd = (e.targetCd ?? 0) - 1) <= 0) { e.targetCd = 10; e.target = preyFor(ents, e, 48, 24); }
  const tg = e.target;
  if (!tg) {
    e.facing = null; e.alt = false; e.burst = 0;
    // Bobbing about where it is.
    e.flyVel = [Math.sin(e.age * 0.7) * 0.6, Math.sin(e.age * 1.3) * 0.8, Math.cos(e.age * 0.5) * 0.6];
    return;
  }
  e.facing = tg;
  const dist = dist2(tg, e), eyeY = e.y + 1.5, sees = clearLine(w, e.x, eyeY, e.z, tg.x, tg.y + 1.2, tg.z);
  // Up to their height (a little above), in to about six blocks off.
  const want = tg.y + 1.5 + Math.sin(e.age * 1.4) * 0.5;
  const dx = tg.x - e.x, dz = tg.z - e.z, k = dist > 7 ? 1 : dist < 4 ? -0.6 : 0;
  e.flyVel = [(dx / (dist || 1)) * e.def.speed * k, Math.max(-2, Math.min(2, (want - e.y) * 1.2)), (dz / (dist || 1)) * e.def.speed * k];
  if (dist < 1.8 && Math.abs(tg.y - e.y) < 2 && e.attackCd === 0) {
    e.attackCd = 20;
    if (tg.kind === 'mob') ents.hurtMob(tg, e.def.damage, e, 0, { fire: 5 });
    else { game.hurtPlayer(tg, e.def.damage, 'You were burned to a crisp by a blaze', [dx * 0.5, 4, dz * 0.5], true); game.setOnFire?.(tg, 5); }
  }
  // The burst: a second of flame, then three shots a third of a second apart; then a rest.
  e.burst = (e.burst ?? 0) + 1;
  if (e.burst > 60 && sees && dist < 32) {
    e.alt = true;
    if (Math.random() < 0.5) game.particles.bits(e.x, e.y + 1 + Math.random(), e.z, TEX.flame ?? TEX.spark, 2, 0.8, 0.5);
    const n = e.burst - 80;
    if (n >= 0 && n % 6 === 0 && n <= 12) {
      const sy = e.y + 1.4, ex = tg.x + (Math.random() - 0.5) * dist * 0.12, ez = tg.z + (Math.random() - 0.5) * dist * 0.12;
      const vx = ex - e.x, vy = tg.y + 1 - sy, vz = ez - e.z, len = Math.hypot(vx, vy, vz) || 1, v = 16;
      ents.spawnFireball(e.x, sy, e.z, (vx / len) * v, (vy / len) * v, (vz / len) * v, e, 'small');
      game.audio.mob('blaze', 'shoot', { x: e.x, y: sy, z: e.z });
    }
    if (n > 12) { e.burst = -40; e.alt = false; }
  } else if (e.burst > 60 && !sees) e.alt = false;
}

// ---------------------------------------------------------------- piglins
// What a piglin gives for a gold ingot: [item, weight, least, most]. (Minecraft's bartering, less
// what there's no call for here.)
const BARTER = [
  ['potion_fire_resistance', 8, 1, 1], ['splash_potion_fire_resistance', 8, 1, 1], ['iron_nugget', 10, 10, 36], ['ender_pearl', 10, 2, 4],
  ['string', 20, 3, 9], ['quartz', 20, 5, 12], ['obsidian', 40, 1, 1], ['fire_charge', 40, 1, 1], ['leather', 40, 2, 4], ['soul_sand', 40, 2, 8],
  ['nether_brick', 40, 2, 8], ['gravel', 40, 8, 16], ['blackstone', 40, 8, 16], ['arrow', 40, 6, 12], ['glowstone_dust', 20, 2, 6],
].map(([name, w, lo, hi]) => [I[name] ?? B[name], w, lo, hi]).filter(([id]) => id !== undefined);
const BARTER_TOTAL = BARTER.reduce((a, r) => a + r[1], 0);
export function barterLoot() {
  let r = Math.random() * BARTER_TOTAL;
  for (const [id, w, lo, hi] of BARTER) if ((r -= w) <= 0) return { id, count: lo + Math.floor(Math.random() * (hi - lo + 1)) };
  return { id: BARTER[0][0], count: 1 };
}
const GOLD_ARMOR = (id) => itemDef(id)?.armor?.material === 'golden';
export const wearsGold = (p) => !!p?.gold || !!p?.armor?.some?.((a) => GOLD_ARMOR(a?.id ?? a));

// A piglin: first, what it's admiring (a gold ingot, turned over in its hand for six seconds,
// after which it tosses you what it'll give for it); then gold lying about, which it goes and
// picks up; then whoever isn't wearing gold, whom it attacks. True when it has decided what to
// do this tick (else it's left to hostileTick).
export function piglinTick(ents, e) {
  const game = ents.game;
  // Out of the Nether a piglin shakes, and after fifteen seconds it's a zombified piglin.
  if (!inNether(e.x) && (e.zombify = (e.zombify ?? 0) + 1) >= 300) { zombify(ents, e); return true; }
  if (e.admire > 0) {
    e.moving = false; e.target = null; e.alt = true;
    if (--e.admire === 0) {
      e.held = null; e.alt = false;
      const loot = barterLoot(), to = e.giver && !targetGone(e.giver) ? e.giver : null;
      const it = ents.spawnItem(e.x, e.y + 1.3, e.z, loot.id, loot.count);
      if (it && to) { const dx = to.x - e.x, dz = to.z - e.z, d = Math.hypot(dx, dz) || 1; it.vx = (dx / d) * 2.5; it.vz = (dz / d) * 2.5; it.vy = 3; }
      game.audio.mob('piglin', 'say', { x: e.x, y: e.y + 1.8, z: e.z }, 1.15);
      e.giver = null;
    }
    return true;
  }
  if (e.angry > 0) return false;
  // Gold on the ground: it wants it.
  if ((e.goldCd = (e.goldCd ?? 0) - 1) <= 0) {
    e.goldCd = 20;
    e.gold = ents.list.find((o) => o.kind === 'item' && !o.dead && o.id === I.gold_ingot && Math.hypot(o.x - e.x, o.y - e.y, o.z - e.z) < 10) ?? null;
  }
  const g = e.gold;
  if (g && !g.dead) {
    faceTowards(e, g.x, g.z);
    e.moving = true; e.speedMul = 1;
    if (Math.hypot(g.x - e.x, g.y - e.y, g.z - e.z) < 1.4) {
      if (--g.count <= 0) { g.dead = true; game.net?.entityGone?.(g, 'p'); }
      admire(ents, e, null);
    }
    return true;
  }
  // Players in gold are left alone (unless they've done it harm).
  if (e.target && !targetGone(e.target) && wearsGold(e.target)) e.target = null;
  if (!e.target) {
    const p = preyFor(ents, e, 16);
    if (p && !wearsGold(p)) e.target = p;
    else { wander(e); return true; }
  }
  return false;
}
// Starts admiring a gold ingot (given by `giver`, if anyone).
export function admire(ents, e, giver) {
  e.admire = 120; e.held = I.gold_ingot; e.giver = giver; e.target = null; e.angry = 0; e.alt = true;
  ents.game.audio.mob('piglin', 'say', { x: e.x, y: e.y + 1.8, z: e.z }, 1.3);
}
function zombify(ents, e) {
  const z = ents.spawnMob('zombified_piglin', e.x, e.y, e.z, { baby: e.baby });
  z.yaw = e.yaw;
  e.dead = true;
  ents.game.net?.entityGone?.(e, 'x');
  ents.game.particles.smoke(e.x, e.y + 1, e.z, 10, 0.4);
  ents.game.audio.mob('zombified_piglin', 'hurt', { x: e.x, y: e.y + 1.6, z: e.z });
}

// ---------------------------------------------------------------- hoglins
// Hoglins can't abide warped fungus: with one close by, they back away from it.
export function hoglinShuns(ents, e) {
  if (e.fleeing > 0) { e.fleeing--; e.moving = true; e.speedMul = 1.3; return true; }
  if ((e.fungusCd = (e.fungusCd ?? Math.floor(Math.random() * 40)) - 1) > 0) return false;
  e.fungusCd = 40;
  const w = ents.world, x0 = Math.floor(e.x), y0 = Math.floor(e.y), z0 = Math.floor(e.z);
  for (let y = y0 - 2; y <= y0 + 3; y++) for (let z = z0 - 7; z <= z0 + 7; z++) for (let x = x0 - 7; x <= x0 + 7; x++) {
    if (w.getBlock(x, y, z) !== B.warped_fungus) continue;
    faceAway(e, x + 0.5, z + 0.5);
    e.fleeing = 60; e.target = null; e.moving = true;
    return true;
  }
  return false;
}

// ---------------------------------------------------------------- striders
// On the lava a strider is warm and red, and ambles about; off it, it goes cold and purple and
// makes for the nearest lava it can see.
export function striderTick(ents, e) {
  const w = ents.world;
  const onLava = lavaUnder(w, e) !== null;
  e.coldness = onLava ? 0 : (e.coldness ?? 0) + 1;
  e.alt = e.coldness > 20;
  if (e.rider) return true;
  if (!onLava && (e.seekCd = (e.seekCd ?? 0) - 1) <= 0) {
    e.seekCd = 30;
    e.lavaAt = null;
    for (let k = 0; k < 24 && !e.lavaAt; k++) {
      const x = Math.floor(e.x + (Math.random() - 0.5) * 20), z = Math.floor(e.z + (Math.random() - 0.5) * 20);
      for (let y = Math.floor(e.y) + 2; y > Math.floor(e.y) - 4; y--) {
        if (WATERLIKE[w.getBlock(x, y, z)] === 2 && !SOLID[w.getBlock(x, y + 1, z)]) { e.lavaAt = { x: x + 0.5, z: z + 0.5 }; break; }
      }
    }
  }
  if (!onLava && e.lavaAt) { faceTowards(e, e.lavaAt.x, e.lavaAt.z); e.moving = true; e.speedMul = 0.7; return true; }
  e.speedMul = onLava ? 1 : 0.5;
  return false;
}
// The top of the lava a strider stands in (y of its surface), or null.
export function lavaUnder(w, e) {
  const x = Math.floor(e.x), z = Math.floor(e.z);
  for (let y = Math.floor(e.y + 0.3); y >= Math.floor(e.y - 0.6); y--) {
    const id = w.getBlock(x, y, z);
    if (WATERLIKE[id] === 2) return y + Math.min(0.85, liquidHeight(id));
  }
  return null;
}
// After it has moved: a strider walks on lava as on ground (its feet a little way in).
export function striderFloat(w, e) {
  const top = lavaUnder(w, e);
  if (top === null || e.y > top + 0.05 || e.vy > 3) return;
  e.y = top;
  e.vy = Math.max(0, e.vy);
  e.onGround = true;
}

// ---------------------------------------------------------------- where they live
// Creatures of each Nether biome: [type, weight, group]. Striders keep to the lava (see below).
const NETHER_SPAWNS = {
  [BIOME.NETHER_WASTES]: [['zombified_piglin', 100, 4], ['ghast', 50, 1], ['magma_cube', 4, 3], ['piglin', 15, 3], ['enderman', 2, 2]],
  [BIOME.CRIMSON_FOREST]: [['zombified_piglin', 3, 3], ['hoglin', 9, 3], ['piglin', 5, 3]],
  [BIOME.WARPED_FOREST]: [['enderman', 1, 2]],
  [BIOME.SOUL_SAND_VALLEY]: [['skeleton', 20, 3], ['ghast', 50, 1], ['enderman', 1, 2]],
  [BIOME.BASALT_DELTAS]: [['magma_cube', 100, 3], ['ghast', 40, 1]],
};
const NETHER_TYPES = new Set(['zombified_piglin', 'ghast', 'magma_cube', 'piglin', 'hoglin', 'blaze', 'wither_skeleton', 'strider']);
function pick(table) {
  let r = Math.random() * table.reduce((a, t) => a + t[1], 0);
  for (const t of table) if ((r -= t[1]) <= 0) return t;
  return table[0];
}

// Now and then something of the Nether turns up near player `p` (in any light: the Nether has
// none to speak of). Returns true if something did.
export function netherSpawn(ents, p, extra = null) {
  const w = ents.world, list = ents.list;
  const count = (fn) => list.reduce((n, o) => n + (o.kind === 'mob' && !o.dead && fn(o) ? 1 : 0), 0);
  // Striders on the lava seas.
  if (Math.random() < 0.3 && count((o) => o.type === 'strider') < 6) {
    for (let k = 0; k < 6; k++) {
      const a = Math.random() * TAU, d = 16 + Math.random() * 28, x = Math.floor(p.x + Math.cos(a) * d), z = Math.floor(p.z + Math.sin(a) * d);
      if (!w.isLoaded(x, z)) continue;
      for (let y = Math.min(125, Math.floor(p.y) + 12); y > Math.max(2, Math.floor(p.y) - 28); y--) {
        if (WATERLIKE[w.getBlock(x, y, z)] !== 2) continue;
        if (SOLID[w.getBlock(x, y + 1, z)] || SOLID[w.getBlock(x, y + 2, z)] || WATERLIKE[w.getBlock(x, y + 1, z)]) break;
        const n = 1 + (Math.random() < 0.3 ? 1 : 0);
        for (let i = 0; i < n; i++) ents.spawnMob('strider', x + 0.5 + i * 0.8, y + 0.85, z + 0.5, { baby: i > 0 && Math.random() < 0.5 });
        return true;
      }
    }
  }
  if (count((o) => NETHER_TYPES.has(o.type) && o.type !== 'strider' || (o.def.hostile && inNether(o.x))) >= 10 + ents.players.length * 4) return false;
  for (let attempt = 0; attempt < 6; attempt++) {
    const a = Math.random() * TAU, d = 20 + Math.random() * 26;
    const x = Math.floor(p.x + Math.cos(a) * d), z = Math.floor(p.z + Math.sin(a) * d);
    if (!w.isLoaded(x, z)) continue;
    const table = extra ?? NETHER_SPAWNS[w.biomeAt(x, z)] ?? NETHER_SPAWNS[BIOME.NETHER_WASTES];
    const [type, , group] = pick(table);
    if (type === 'ghast' && count((o) => o.type === 'ghast') >= 2 + ents.players.length) continue;
    for (let y = Math.min(122, Math.floor(p.y) + 16); y > Math.max(2, Math.floor(p.y) - 24); y--) {
      const below = w.getBlock(x, y - 1, z);
      if (!SOLID[below] || SOLID[w.getBlock(x, y, z)] || SOLID[w.getBlock(x, y + 1, z)] || WATERLIKE[w.getBlock(x, y, z)]) continue;
      if (type === 'ghast') {
        // A ghast needs the open air of a big cavern.
        if (!roomFor(w, x + 0.5, y + 4, z + 0.5, 3)) break;
        ents.spawnMob('ghast', x + 0.5, y + 2, z + 0.5);
        return true;
      }
      if ((type === 'enderman' || type === 'wither_skeleton') && SOLID[w.getBlock(x, y + 2, z)]) break;
      const n = Math.max(1, Math.round(group * (0.5 + Math.random() * 0.7)));
      for (let i = 0; i < n; i++) {
        const sx = x + 0.5 + (i ? (Math.random() - 0.5) * 3 : 0), sz = z + 0.5 + (i ? (Math.random() - 0.5) * 3 : 0);
        if (SOLID[w.getBlock(Math.floor(sx), y, Math.floor(sz))] || !SOLID[w.getBlock(Math.floor(sx), y - 1, Math.floor(sz))]) continue;
        const o = type === 'magma_cube' ? { size: [1, 2, 4][Math.floor(Math.random() * 3)] } : { baby: (type === 'hoglin' || type === 'piglin') && Math.random() < 0.1 };
        ents.spawnMob(type, sx, y, sz, o);
      }
      return true;
    }
  }
  return false;
}
