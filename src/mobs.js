// Creatures: what each one is (model, skin, size, health, what it drops), how it behaves, how it
// moves its limbs, and where it turns up. Entities (entities.js) keeps them in its list and runs
// their physics; everything particular to a kind of creature lives here.
import { RIGS, rigMeshes, boneMatrix } from './rigs.js';
import { B, SOLID, WATERLIKE, CLIMB } from './blocks.js';
import { I } from './items.js';
import { BIOME } from './biomes.js';
import { DYES } from './colors.js';
import { HEIGHT } from './config.js';
import { identity, translate, rotateX, rotateY, rotateZ, scale, hash2, clamp } from './math.js';
import { TEX } from './textures.js';

const TAU = Math.PI * 2;
const wrap = (a) => a - Math.round(a / TAU) * TAU;
const d = (name, lo, hi, chance = 1) => [name, lo, hi, chance];

// ---------------------------------------------------------------- kinds
// kind: 'animal' (wanders, flees when hurt, follows food), 'neutral' (fights back), 'hostile',
// 'water' (swims), 'civilian' (see civilians.js). speed: blocks a second when walking.
export const MOBS = {
  pig: { label: 'Pig', rig: 'pig', skins: ['pig'], hw: 0.45, h: 0.9, health: 10, speed: 1.1, kind: 'animal', anim: 'quad',
    food: ['carrot', 'potato', 'beetroot'], drops: [d('raw_porkchop', 1, 3)], sound: 'pig' },
  cow: { label: 'Cow', rig: 'cow', skins: ['cow'], hw: 0.45, h: 1.4, health: 10, speed: 1.0, kind: 'animal', anim: 'quad',
    food: ['wheat'], drops: [d('raw_beef', 1, 3), d('leather', 0, 2)], sound: 'cow', milk: true },
  sheep: { label: 'Sheep', rig: 'sheep', skins: ['sheep'], wool: 'sheep_wool', hw: 0.45, h: 1.3, health: 8, speed: 1.0, kind: 'animal',
    anim: 'quad', food: ['wheat'], drops: [d('raw_mutton', 1, 2)], sound: 'sheep', grazes: true },
  chicken: { label: 'Chicken', rig: 'chicken', skins: ['chicken'], hw: 0.2, h: 0.7, health: 4, speed: 1.0, kind: 'animal', anim: 'chicken',
    food: ['wheat_seeds', 'beetroot_seeds'], drops: [d('raw_chicken', 1, 1), d('feather', 0, 2)], sound: 'chicken', flutter: true, eggs: true },
  rabbit: { label: 'Rabbit', rig: 'rabbit', skins: ['rabbit_brown', 'rabbit_white', 'rabbit_black', 'rabbit_gold'], hw: 0.2, h: 0.5, health: 3,
    speed: 2.2, kind: 'animal', anim: 'rabbit', food: ['carrot', 'golden_carrot'], drops: [d('raw_rabbit', 0, 1), d('rabbit_hide', 0, 1)],
    sound: 'rabbit', shy: 6, hops: true },
  fox: { label: 'Fox', rig: 'fox', skins: ['fox'], hw: 0.3, h: 0.7, health: 10, speed: 1.6, kind: 'animal', anim: 'quad', drops: [],
    sound: 'fox', shy: 5 },
  goat: { label: 'Goat', rig: 'goat', skins: ['goat'], hw: 0.45, h: 1.3, health: 10, speed: 1.2, kind: 'animal', anim: 'quad', food: ['wheat'],
    drops: [d('raw_mutton', 0, 1)], sound: 'goat', leaps: true },
  wolf: { label: 'Wolf', rig: 'wolf', skins: ['wolf', 'wolf_angry'], hw: 0.3, h: 0.85, health: 8, speed: 1.5, kind: 'neutral', anim: 'quad',
    damage: 4, drops: [], sound: 'wolf', pack: true },
  polar_bear: { label: 'Polar Bear', rig: 'polar_bear', skins: ['polar_bear'], hw: 0.7, h: 1.4, health: 30, speed: 1.3, kind: 'neutral',
    anim: 'quad', damage: 6, drops: [d('cod', 0, 2), d('salmon', 0, 2)], sound: 'bear' },
  squid: { label: 'Squid', rig: 'squid', skins: ['squid'], hw: 0.4, h: 0.8, health: 10, speed: 1.2, kind: 'water', anim: 'squid',
    drops: [d('black_dye', 1, 3)], sound: null, scale: 0.8 },
  cod: { label: 'Cod', rig: 'cod', skins: ['cod'], hw: 0.25, h: 0.3, health: 3, speed: 1.4, kind: 'water', anim: 'fish', drops: [d('cod', 1, 1),
    d('bone_meal', 0, 1, 0.05)], sound: 'fish' },
  salmon: { label: 'Salmon', rig: 'salmon', skins: ['salmon'], hw: 0.3, h: 0.4, health: 3, speed: 1.6, kind: 'water', anim: 'fish',
    drops: [d('salmon', 1, 1)], sound: 'fish' },
  zombie: { label: 'Zombie', rig: 'humanoid', skins: ['zombie'], hw: 0.3, h: 1.95, health: 20, speed: 2.1, kind: 'hostile', anim: 'zombie',
    damage: 3, burns: true, drops: [d('rotten_flesh', 0, 2), d('iron_ingot', 1, 1, 0.025), d('carrot', 1, 1, 0.025), d('potato', 1, 1, 0.025)],
    sound: 'zombie', hunts: true },
  husk: { label: 'Husk', rig: 'humanoid', skins: ['husk'], hw: 0.3, h: 1.95, health: 20, speed: 2.1, kind: 'hostile', anim: 'zombie', damage: 3,
    drops: [d('rotten_flesh', 0, 2), d('iron_ingot', 1, 1, 0.025)], sound: 'zombie', pitch: 0.8, hunts: true },
  skeleton: { label: 'Skeleton', rig: 'skeleton', skins: ['skeleton'], hw: 0.3, h: 1.99, health: 20, speed: 2.0, kind: 'hostile',
    anim: 'archer', burns: true, ranged: true, held: 'bow', drops: [d('bone', 0, 2), d('arrow', 0, 2)], sound: 'skeleton' },
  stray: { label: 'Stray', rig: 'skeleton', skins: ['stray'], hw: 0.3, h: 1.99, health: 20, speed: 2.0, kind: 'hostile', anim: 'archer',
    burns: true, ranged: true, held: 'bow', drops: [d('bone', 0, 2), d('arrow', 0, 2)], sound: 'skeleton', pitch: 0.85 },
  creeper: { label: 'Creeper', rig: 'creeper', skins: ['creeper'], hw: 0.3, h: 1.7, health: 20, speed: 1.9, kind: 'hostile', anim: 'creeper',
    explodes: 3, drops: [d('gunpowder', 0, 2)], sound: 'creeper' },
  spider: { label: 'Spider', rig: 'spider', skins: ['spider'], hw: 0.7, h: 0.9, health: 16, speed: 2.6, kind: 'hostile', anim: 'spider',
    damage: 2, climbs: true, drops: [d('string', 0, 2), d('spider_eye', 1, 1, 0.33)], sound: 'spider', calmInDaylight: true },
  enderman: { label: 'Enderman', rig: 'enderman', skins: ['enderman'], hw: 0.3, h: 2.9, health: 40, speed: 2.4, kind: 'neutral', anim: 'enderman',
    damage: 7, teleports: true, drops: [d('ender_pearl', 0, 1)], sound: 'enderman' },
  slime: { label: 'Slime', rig: 'slime', skins: ['slime'], hw: 0.26, h: 0.52, health: 1, speed: 2.2, kind: 'hostile', anim: 'slime',
    drops: [d('slime_ball', 0, 2)], sound: 'slime', sized: true },
  // Village people (see civilians.js); each wears their own skin.
  civilian: { label: 'Villager', rig: 'humanoid', skins: ['civ_farmer_0'], hw: 0.3, h: 1.9, health: 20, speed: 1.6, kind: 'civilian',
    anim: 'humanoid', drops: [], sound: null },
};
for (const [type, m] of Object.entries(MOBS)) {
  m.type = type;
  m.hostile = m.kind === 'hostile';
  m.drops = m.drops.map(([name, lo, hi, chance]) => [I[name] ?? B[name], lo, hi, chance]).filter((x) => x[0] !== undefined);
  m.foodIds = new Set((m.food ?? []).map((n) => I[n] ?? B[n]));
  m.rigDef = RIGS[m.rig];
}
export const MOB_TYPES = MOBS;
export const isMob = (type) => !!MOBS[type];

// Everything a new creature starts with. `o`: variant, size (slimes), baby, colour (sheep).
export function initMob(e, type, o = {}) {
  const t = MOBS[type];
  const size = t.sized ? (o.size ?? 1) : 1;
  Object.assign(e, {
    type, label: t.label, def: t, health: t.sized ? size * size : t.health, yaw: Math.random() * TAU, headYaw: 0, headPitch: 0,
    walk: 0, walkPhase: 0, wander: 0, moving: false, panic: 0, hurt: 0, lastDamage: 0, dying: 0, attackCd: 0, swing: 0, burnCd: 0,
    flap: 0, onFire: 0, speedMul: 1, target: null, angry: 0, love: 0, breedCd: 0, variant: o.variant ?? 0, size, baby: !!o.baby,
    grow: o.baby ? 24000 : 0, sheared: !!o.sheared, colour: o.colour ?? 0, eggTimer: 6000 + Math.floor(Math.random() * 6000), fuse: 0,
    aim: 0, lookAt: null, lookTime: 0, squish: 0, jumpCd: 0, teleportCd: 0, graze: 0, pinned: o.pinned ?? null, home: o.home ?? null,
  });
  if (t.sized) { e.hw = 0.26 * size; e.h = 0.52 * size; }
  else if (e.baby) { e.hw = t.hw * 0.5; e.h = t.h * 0.5; }
  return e;
}

// A sheep's fleece colour, by how common each is (Minecraft's odds).
export function sheepColour(r) {
  if (r < 0.8184) return DYES.findIndex((dd) => dd.name === 'white');
  if (r < 0.8684) return DYES.findIndex((dd) => dd.name === 'black');
  if (r < 0.9184) return DYES.findIndex((dd) => dd.name === 'gray');
  if (r < 0.9684) return DYES.findIndex((dd) => dd.name === 'light_gray');
  if (r < 0.9984) return DYES.findIndex((dd) => dd.name === 'brown');
  return DYES.findIndex((dd) => dd.name === 'pink');
}
export const woolBlock = (colour) => B[`${DYES[colour]?.name ?? 'white'}_wool`] ?? B.white_wool;

// ---------------------------------------------------------------- behaviour (20 times a second)
// `ents` is the Entities list (players, world, game).
export function mobTick(ents, e) {
  const game = ents.game, w = ents.world, t = e.def;
  if (e.dying) return;
  e.hurt = Math.max(0, e.hurt - 1);
  e.attackCd = Math.max(0, e.attackCd - 1);
  e.breedCd = Math.max(0, e.breedCd - 1);
  e.teleportCd = Math.max(0, e.teleportCd - 1);
  if (e.love > 0) { e.love--; if (e.love % 10 === 0) game.particles.bits(e.x, e.y + e.h + 0.2, e.z, TEX.heart, 1, 0.5, 0.2); }
  if (e.baby && --e.grow <= 0) { e.baby = false; e.hw = t.hw; e.h = t.h; }
  const feetId = w.getBlock(Math.floor(e.x), Math.floor(e.y + 0.2), Math.floor(e.z));
  const inWater = WATERLIKE[feetId] === 1 || WATERLIKE[w.getBlock(Math.floor(e.x), Math.floor(e.y + e.h * 0.6), Math.floor(e.z))] === 1;
  e.inWater = inWater;
  // Fire and lava burn; water puts it out.
  if (feetId === B.fire || WATERLIKE[feetId] === 2) { e.onFire = 160; if (WATERLIKE[feetId] === 2 && ++e.burnCd >= 10) { e.burnCd = 0; ents.hurtMob(e, 4, null); } }
  if (e.onFire > 0) {
    e.onFire = inWater ? 0 : e.onFire - 1;
    if (e.onFire % 20 === 0 && e.onFire > 0) ents.hurtMob(e, 1, null);
    if (Math.random() < 0.3) game.particles.smoke(e.x, e.y + Math.random() * e.h, e.z, 1, e.hw);
  }
  // The undead burn in daylight.
  if (t.burns) {
    const l = w.getLight(Math.floor(e.x), Math.floor(e.y + e.h * 0.8), Math.floor(e.z));
    e.burning = game.env.daylight > 0.75 && (l >> 4) >= 12 && game.weather.rain < 0.3 && !inWater;
    if (e.burning && Math.random() < 0.25) game.particles.smoke(e.x, e.y + 1 + Math.random() * 0.9, e.z, 1, 0.3);
    if (e.burning && ++e.burnCd >= 20) { e.burnCd = 0; ents.hurtMob(e, 2, null); }
  }
  // Out of water, fish flop and slowly suffocate; squid too.
  if (t.kind === 'water' && !inWater) {
    if (e.onGround && Math.random() < 0.15) { e.vy = 4; e.vx = (Math.random() - 0.5) * 3; e.vz = (Math.random() - 0.5) * 3; }
    if (++e.burnCd >= 40) { e.burnCd = 0; ents.hurtMob(e, 1, null); }
  }
  switch (t.kind) {
    case 'hostile': hostileTick(ents, e); break;
    case 'neutral': neutralTick(ents, e); break;
    case 'water': swimTick(ents, e); break;
    case 'civilian': ents.civilians?.think(e); break;
    default: animalTick(ents, e);
  }
  lookTick(ents, e);
  if (t.sound && Math.random() < (t.hostile ? 0.005 : 0.003)) game.audio.mob(t.sound, 'say', { x: e.x, y: e.y + e.h * 0.8, z: e.z }, t.pitch);
}

// Heads turn towards a nearby player now and then (or towards what the creature is after).
function lookTick(ents, e) {
  let tx = null, ty = 0, tz = 0;
  if (e.target) { tx = e.target.x; ty = e.target.y + 1.5; tz = e.target.z; }
  else {
    if (--e.lookTime <= 0) {
      e.lookTime = 40 + Math.floor(Math.random() * 60);
      const near = ents.players.find((p) => Math.hypot(p.x - e.x, p.z - e.z) < 8);
      e.lookAt = near && Math.random() < 0.5 ? near : null;
    }
    if (e.lookAt) { tx = e.lookAt.x; ty = e.lookAt.y + 1.5; tz = e.lookAt.z; }
  }
  let yaw = 0, pitch = 0;
  if (tx !== null) {
    const dx = tx - e.x, dz = tz - e.z, dy = ty - (e.y + e.h * 0.85);
    yaw = clamp(wrap(Math.atan2(-dx, -dz) - e.yaw), -1.1, 1.1);
    pitch = clamp(Math.atan2(dy, Math.hypot(dx, dz)), -0.8, 0.8);
  }
  e.headYaw += (yaw - e.headYaw) * 0.3;
  e.headPitch += (pitch - e.headPitch) * 0.3;
}

function wander(e, chance = 0.4) {
  if (--e.wander > 0) return;
  if (e.moving || Math.random() < chance) { e.moving = false; e.wander = 40 + Math.floor(Math.random() * 80); }
  else { e.moving = true; e.yaw = Math.random() * TAU; e.wander = 30 + Math.floor(Math.random() * 70); }
  e.speedMul = 1;
}
const faceTowards = (e, x, z) => { e.yaw = Math.atan2(-(x - e.x), -(z - e.z)); };
const faceAway = (e, x, z) => { e.yaw = Math.atan2(e.x - x, e.z - z); };
const dist2 = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);

function animalTick(ents, e) {
  const t = e.def, game = ents.game, w = ents.world;
  e.speedMul = 1;
  if (e.panic > 0) {
    e.panic--;
    if (e.panic % 20 === 0) e.yaw = Math.random() * TAU;
    e.moving = true; e.speedMul = 1.8;
    return;
  }
  // Shy creatures keep away from players.
  if (t.shy) {
    const p = ents.players.find((q) => !q.dead && dist2(q, e) < t.shy && !(q.sneaking));
    if (p) { faceAway(e, p.x, p.z); e.moving = true; e.speedMul = 1.6; return; }
  }
  // Animals follow someone holding their food, and look for a partner when in love.
  if (e.love > 0) {
    const mate = ents.list.find((o) => o !== e && o.kind === 'mob' && o.type === e.type && o.love > 0 && !o.baby && !o.dead && !o.dying && dist2(o, e) < 8);
    if (mate) {
      faceTowards(e, mate.x, mate.z);
      e.moving = dist2(mate, e) > 1.2;
      if (!e.moving && e.love > 0 && mate.love > 0) {
        e.love = mate.love = 0; e.breedCd = mate.breedCd = 6000;
        const baby = ents.spawnMob(e.type, (e.x + mate.x) / 2, e.y, (e.z + mate.z) / 2, { baby: true, variant: e.variant, colour: Math.random() < 0.5 ? e.colour : mate.colour });
        game.particles.bits(baby.x, baby.y + 0.5, baby.z, TEX.heart, 6, 1, 0.5);
      }
      return;
    }
  }
  if (e.pinned) { e.moving = false; }
  const tempter = t.foodIds.size && ents.players.find((p) => !p.dead && p.held && t.foodIds.has(p.held) && dist2(p, e) < 9);
  if (tempter) {
    faceTowards(e, tempter.x, tempter.z);
    e.moving = dist2(tempter, e) > 2.2;
    e.target = null;
    return;
  }
  // Sheep crop the grass to grow their wool back.
  if (t.grazes && e.graze > 0) { e.moving = false; if (--e.graze === 0) grazeDone(ents, e); return; }
  if (t.grazes && Math.random() < (e.sheared ? 0.01 : 0.001) && e.onGround) {
    const below = w.getBlock(Math.floor(e.x), Math.floor(e.y - 0.5), Math.floor(e.z));
    if (below === B.grass_block) { e.graze = 40; e.moving = false; return; }
  }
  // Chickens lay an egg every few minutes.
  if (t.eggs && !e.baby && --e.eggTimer <= 0) {
    e.eggTimer = 6000 + Math.floor(Math.random() * 6000);
    ents.spawnItem(e.x, e.y + 0.3, e.z, I.egg, 1);
    game.audio.pop({ x: e.x, y: e.y, z: e.z });
  }
  // Rabbits hop about quickly and stop often.
  wander(e, t.hops ? 0.55 : 0.4);
  if (e.home && dist2(e, e.home) > 4) { faceTowards(e, e.home.x, e.home.z); e.moving = true; }
}

function grazeDone(ents, e) {
  const w = ents.world, x = Math.floor(e.x), y = Math.floor(e.y - 0.5), z = Math.floor(e.z);
  if (w.getBlock(x, y, z) !== B.grass_block) return;
  w.setBlock(x, y, z, B.dirt);
  ents.game.particles.burst(x, y, z, B.grass_block);
  e.sheared = false;
  if (e.baby) e.grow = Math.max(0, e.grow - 1200);
}

function swimTick(ents, e) {
  if (!e.inWater) { e.moving = false; return; }
  if (e.panic > 0) { e.panic--; e.speedMul = 2.2; }
  else e.speedMul = 1;
  if (--e.wander <= 0) {
    e.wander = 20 + Math.floor(Math.random() * 60);
    e.moving = Math.random() < 0.8;
    e.yaw = Math.random() * TAU;
    e.swimY = (Math.random() - 0.45) * 1.2;
  }
}

// Players (and for zombies, villagers) a monster could go after.
function preyFor(ents, e, range) {
  let best = null, bd = range;
  for (const p of ents.players) {
    if (p.creative || p.dead || Math.abs(p.y - e.y) > 12) continue;
    const dd = Math.hypot(p.x - e.x, p.y - e.y, p.z - e.z);
    if (dd < bd) { bd = dd; best = p; }
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
const targetGone = (t) => !t || t.dead || t.dying || t.creative;

function hostileTick(ents, e) {
  const t = e.def, game = ents.game, w = ents.world;
  // Spiders leave you alone in daylight unless provoked.
  const calm = t.calmInDaylight && game.env.daylight > 0.6 && e.angry <= 0 &&
    ((w.getLight(Math.floor(e.x), Math.floor(e.y + 0.5), Math.floor(e.z)) >> 4) >= 12);
  if (e.angry > 0) e.angry--;
  if (targetGone(e.target) || dist2(e.target, e) > 40 || calm) e.target = null;
  if (!e.target && !calm && (e.targetCd = (e.targetCd ?? 0) - 1) <= 0) {
    e.targetCd = 10;
    e.target = preyFor(ents, e, t.sized ? 16 : 24);
  }
  const tg = e.target;
  if (!tg) { e.fuse = Math.max(0, e.fuse - 1); e.aim = 0; if (t.sized) slimeHop(ents, e, null); else wander(e); return; }
  const dx = tg.x - e.x, dz = tg.z - e.z, dist = Math.hypot(dx, dz), dy = tg.y - e.y;
  if (t.explodes) return creeperTick(ents, e, tg, dist);
  if (t.ranged) return archerTick(ents, e, tg, dist);
  if (t.sized) return slimeHop(ents, e, tg);
  faceTowards(e, tg.x, tg.z);
  e.moving = dist > 0.8;
  e.speedMul = 1;
  // Spiders pounce, and climb walls to get at you.
  if (t.climbs && e.onGround && dist < 4 && dist > 1.5 && Math.random() < 0.08) { e.vy = 6; e.vx += (dx / dist) * 4; e.vz += (dz / dist) * 4; }
  meleeTick(ents, e, tg, dist, dy);
}

function meleeTick(ents, e, tg, dist, dy) {
  const reach = e.hw + (tg.hw ?? 0.3) + 0.75;
  if (dist < reach && dy > -1.5 && dy < e.h && e.attackCd === 0) {
    e.attackCd = 20;
    e.swing = 1;
    const k = 5 / Math.max(0.1, dist);
    const dmg = e.def.damage ?? 2;
    const why = `You were slain by ${e.def.label === 'Enderman' ? 'an' : 'a'} ${e.def.label.toLowerCase()}`;
    if (tg.kind === 'mob') ents.hurtMob(tg, dmg, e);
    else ents.game.hurtPlayer(tg, dmg, why, [(tg.x - e.x) * k * 0.3, 4.5, (tg.z - e.z) * k * 0.3], true);
  }
}

function creeperTick(ents, e, tg, dist) {
  const game = ents.game;
  faceTowards(e, tg.x, tg.z);
  if (dist < 3 || (e.fuse > 0 && dist < 7)) {
    if (e.fuse === 0) game.audio.fuse({ x: e.x, y: e.y + 1, z: e.z });
    e.fuse++;
    e.moving = false;
    if (e.fuse >= 30) {
      e.dead = true;
      game.net?.entityGone(e, 'x');
      ents.explode(e.x, e.y + 0.8, e.z, e.def.explodes);
    }
  } else {
    e.fuse = Math.max(0, e.fuse - 1);
    e.moving = dist > 1.2;
  }
}

function archerTick(ents, e, tg, dist) {
  const w = ents.world;
  faceTowards(e, tg.x, tg.z);
  const ex = e.x, ey = e.y + 1.6, ez = e.z, ty = tg.y + (tg.kind === 'mob' ? tg.h * 0.6 : 1.4);
  const ddx = tg.x - ex, ddy = ty - ey, ddz = tg.z - ez, len = Math.hypot(ddx, ddy, ddz);
  const hit = w.raycast(ex, ey, ez, ddx / len, ddy / len, ddz / len, len);
  const sees = !hit || hit.t >= len - 0.5;
  // Keep at bow range, circling a little.
  e.moving = !sees || dist > 12 || dist < 5;
  if (dist < 5) e.yaw += Math.PI;
  else if (sees && dist <= 12) { e.moving = Math.random() < 0.5; e.yaw += Math.sin(e.age * 0.7) * 1.2; }
  if (sees && dist < 16) {
    e.aim = Math.min(1, e.aim + 0.04);
    if (e.aim >= 1 && e.attackCd === 0) {
      e.attackCd = 20 + Math.floor(Math.random() * 20);
      e.aim = 0;
      // Aim a little high for the drop over distance.
      const v = 18, lift = len * 0.045;
      ents.spawnArrow(ex, ey, ez, (ddx / len) * v + (Math.random() - 0.5) * 1.2, ((ddy + lift) / len) * v + (Math.random() - 0.5) * 1.2,
        (ddz / len) * v + (Math.random() - 0.5) * 1.2, e, 2 + Math.floor(Math.random() * 3), false);
      ents.game.audio.bow({ x: e.x, y: ey, z: e.z });
    }
  } else e.aim = Math.max(0, e.aim - 0.05);
}

// Slimes get about by hopping; big ones hurt on contact.
function slimeHop(ents, e, tg) {
  e.moving = false;
  if (e.onGround) {
    if (e.squish < 0) e.squish = 0;
    if (--e.jumpCd <= 0) {
      e.jumpCd = 20 + Math.floor(Math.random() * 30);
      if (tg) faceTowards(e, tg.x, tg.z); else e.yaw += (Math.random() - 0.5) * 2;
      const f = -Math.sin(e.yaw), g = -Math.cos(e.yaw), sp = tg ? 3.2 : 1.6;
      e.vy = 6.5 + e.size * 0.4; e.vx = f * sp; e.vz = g * sp;
      e.squish = 1;
      ents.game.audio.mob('slime', 'say', { x: e.x, y: e.y, z: e.z }, 1.4 - e.size * 0.15);
    }
  }
  if (tg && e.size > 1) meleeTick(ents, e, tg, dist2(tg, e), tg.y - e.y);
}

function neutralTick(ents, e) {
  const t = e.def, game = ents.game;
  if (t.teleports) {
    // An enderman stared at grows angry; water and rain make it vanish elsewhere.
    if (!e.angry) {
      for (const p of ents.players) {
        if (p.creative || p.dead || !p.look || dist2(p, e) > 48) continue;
        const hx = e.x - p.x, hy = e.y + 2.6 - (p.y + 1.62), hz = e.z - p.z, hl = Math.hypot(hx, hy, hz);
        if ((hx * p.look[0] + hy * p.look[1] + hz * p.look[2]) / hl > 1 - 0.025 / hl) { e.angry = 600; e.target = p; game.audio.mob('enderman', 'hurt', { x: e.x, y: e.y + 2.5, z: e.z }, 0.8); }
      }
    }
    if ((e.inWater || (game.weather.rain > 0.5 && (ents.world.getLight(Math.floor(e.x), Math.floor(e.y + 2), Math.floor(e.z)) >> 4) >= 15)) && e.teleportCd === 0) teleport(ents, e);
  }
  if (e.angry > 0) {
    e.angry--;
    const tg = e.target;
    if (targetGone(tg) || dist2(tg, e) > 32) { e.target = null; e.angry = 0; return; }
    faceTowards(e, tg.x, tg.z);
    const dist = dist2(tg, e);
    e.moving = dist > 0.8;
    e.speedMul = t.teleports ? 1.5 : 1.35;
    if (t.teleports && dist > 8 && e.teleportCd === 0 && Math.random() < 0.05) teleport(ents, e, tg);
    meleeTick(ents, e, tg, dist, tg.y - e.y);
    return;
  }
  e.target = null;
  e.speedMul = 1;
  wander(e);
}

// Endermen blink to somewhere nearby (or near `near`) with solid ground and room to stand.
export function teleport(ents, e, near = null) {
  const w = ents.world, game = ents.game;
  for (let k = 0; k < 16; k++) {
    const cx = near ? near.x : e.x, cz = near ? near.z : e.z, r = near ? 4 : 16;
    const x = Math.floor(cx + (Math.random() - 0.5) * 2 * r), z = Math.floor(cz + (Math.random() - 0.5) * 2 * r);
    if (!w.isLoaded(x, z)) continue;
    for (let y = Math.floor(e.y) + 8; y > Math.floor(e.y) - 12 && y > 1; y--) {
      if (!SOLID[w.getBlock(x, y - 1, z)] || WATERLIKE[w.getBlock(x, y - 1, z)]) continue;
      if ([0, 1, 2].some((k2) => SOLID[w.getBlock(x, y + k2, z)] || WATERLIKE[w.getBlock(x, y + k2, z)])) break;
      game.particles.bits(e.x, e.y + 1.4, e.z, TEX.portal ?? TEX.angry, 16, 1.4, 1.2);
      game.audio.mob('enderman', 'teleport', { x: e.x, y: e.y + 1, z: e.z });
      e.x = x + 0.5; e.y = y; e.z = z + 0.5; e.vx = e.vy = e.vz = 0;
      e.teleportCd = 30;
      game.particles.bits(e.x, e.y + 1.4, e.z, TEX.portal ?? TEX.angry, 16, 1.4, 1.2);
      return true;
    }
  }
  return false;
}

// Something hurt this creature: animals flee, neutral ones (and their pack) fight back.
export function provoked(ents, e, from) {
  const t = e.def;
  if (t.kind === 'animal') { e.panic = 80; if (from) faceAway(e, from.x, from.z); e.love = 0; }
  else if (t.kind === 'water') { e.panic = 60; ents.game.particles.smoke?.(e.x, e.y + 0.4, e.z, 4, 0.4); }
  else if (t.kind === 'neutral' && from && !from.creative) {
    e.angry = 400; e.target = from;
    if (t.pack) for (const o of ents.list) if (o !== e && o.type === e.type && !o.dead && dist2(o, e) < 16) { o.angry = 400; o.target = from; }
    if (t.teleports && Math.random() < 0.5) teleport(ents, e);
  } else if (t.kind === 'hostile' && from && (from.addr !== undefined || from.kind === 'mob')) {
    if (!from.creative) { e.target = from; e.angry = 200; }
  }
}

// What using item `id` on creature `e` would do: 'milk', 'shear', 'breed', 'grow', 'dye' or null.
export function mobUseEffect(e, id) {
  const t = e.def;
  if (!id || e.dying) return null;
  if (t.milk && id === I.bucket && !e.baby) return 'milk';
  if (t.wool && id === I.shears && !e.sheared && !e.baby) return 'shear';
  if (t.foodIds.has(id)) return e.baby ? 'grow' : e.breedCd === 0 && e.love === 0 ? 'breed' : null;
  if (t.wool && !e.sheared && DYE_OF[id] !== undefined && DYE_OF[id] !== e.colour) return 'dye';
  return null;
}
// The creature's side of it (on the host).
export function applyMobUse(ents, e, id, effect) {
  const game = ents.game, at = { x: e.x, y: e.y + 1, z: e.z };
  switch (effect) {
    case 'milk': game.audio.bucket('fill', at); break;
    case 'shear': {
      e.sheared = true;
      const n = 1 + Math.floor(Math.random() * 3);
      for (let k = 0; k < n; k++) ents.spawnItem(e.x, e.y + 1, e.z, woolBlock(e.colour), 1);
      game.audio.shear?.(at);
      break;
    }
    case 'breed': e.love = 600; game.particles.bits(e.x, e.y + e.h + 0.3, e.z, TEX.heart, 5, 0.8, 0.4); break;
    case 'grow': e.grow = Math.max(0, e.grow - 2400); game.particles.bits(e.x, e.y + e.h + 0.2, e.z, TEX.happy, 5, 0.8, 0.4); break;
    case 'dye': e.colour = DYE_OF[id]; break;
    default:
  }
}
// The player's side: what happens to what they're holding.
export function applyHeldUse(game, effect) {
  if (effect === 'milk') game.swapHeldTo(I.milk_bucket);
  else if (effect === 'shear') { if (!game.creative && game.inv.damageHeld(1)) game.audio.toolBreak(); game.invChanged(); }
  else if (!game.creative) { game.inv.consumeHeld(); game.invChanged(); }
  game.swingArm();
}
const DYE_OF = Object.fromEntries(DYES.map((dd, i) => [I[`${dd.name}_dye`], i]).filter(([id]) => id !== undefined));

// What a creature leaves behind when it dies.
export function mobDrops(e) {
  const out = [];
  if (e.baby) return out;
  for (const [id, lo, hi, chance] of e.def.drops) {
    if (Math.random() > chance) continue;
    const n = lo + Math.floor(Math.random() * (hi - lo + 1));
    if (n > 0) out.push([id, n]);
  }
  if (e.def.wool && !e.sheared) out.push([woolBlock(e.colour), 1]);
  if (e.def.sized && e.size > 1) return [];
  return out;
}

// ---------------------------------------------------------------- movement (every frame)
export function mobPhysics(ents, e, dt, fluid) {
  const w = ents.world, t = e.def;
  if (e.dying) {
    e.dying += dt;
    if (e.dying >= 1) ents.finishDeath(e);
    e.vy -= 20 * dt;
    e.move(w, 0, e.vy * dt, 0);
    return;
  }
  let speed = e.moving ? t.speed * (e.speedMul || 1) * (e.baby ? 1.3 : 1) : 0;
  const fx = -Math.sin(e.yaw), fz = -Math.cos(e.yaw);
  // Animals won't walk off a cliff or into water on their own.
  if (speed && !t.hostile && t.kind !== 'water' && t.kind !== 'civilian' && e.onGround && !e.panic) {
    const ax = Math.floor(e.x + fx * (e.hw + 0.4)), az = Math.floor(e.z + fz * (e.hw + 0.4)), y = Math.floor(e.y + 0.1);
    const ahead = w.getBlock(ax, y - 1, az), ahead2 = w.getBlock(ax, y - 2, az);
    if ((!SOLID[ahead] && !SOLID[ahead2]) || WATERLIKE[ahead] || WATERLIKE[w.getBlock(ax, y, az)]) {
      e.yaw += Math.PI * (0.5 + Math.random());
      speed = 0;
    }
  }
  if (t.kind === 'water') {
    const k = 1 - Math.exp(-3 * dt);
    if (fluid === 1) {
      e.vx += (fx * speed - e.vx) * k; e.vz += (fz * speed - e.vz) * k;
      e.vy += (((e.swimY ?? 0) * (e.moving ? 1 : 0.2)) - e.vy) * k;
      // Stay under the surface.
      if (WATERLIKE[w.getBlock(Math.floor(e.x), Math.floor(e.y + e.h + 0.2), Math.floor(e.z))] !== 1) e.vy = Math.min(e.vy, -0.3);
    } else { e.vy -= 32 * dt; e.vx *= Math.exp(-2 * dt); e.vz *= Math.exp(-2 * dt); }
    e.move(w, e.vx * dt, e.vy * dt, e.vz * dt);
    const moved = Math.hypot(e.vx, e.vz);
    e.walk += (Math.min(1, moved / 1.5) - e.walk) * Math.min(1, dt * 8);
    e.walkPhase += (moved + 0.5) * dt * 4;
    return;
  }
  const k = 1 - Math.exp(-(e.onGround ? 10 : (t.sized ? 0.5 : 2)) * dt);
  if (!t.sized || e.onGround) { e.vx += (fx * speed - e.vx) * k; e.vz += (fz * speed - e.vz) * k; }
  if (fluid) {
    e.vy += (2.2 - e.vy) * Math.min(1, dt * 4);
  } else {
    e.vy -= 32 * dt;
    e.vy = Math.max(e.vy, t.flutter ? -3 : -60);
  }
  // Wings flap while a chicken is in the air.
  e.flap = !e.onGround && t.flutter ? e.flap + dt * 30 : 0;
  const wasGround = e.onGround, vyBefore = e.vy;
  // Villagers climb ladders (the route finder says which way).
  if (e.climb || CLIMB[w.getBlock(Math.floor(e.x), Math.floor(e.y + 0.2), Math.floor(e.z))]) {
    const onLadder = CLIMB[w.getBlock(Math.floor(e.x), Math.floor(e.y + 0.2), Math.floor(e.z))] || CLIMB[w.getBlock(Math.floor(e.x), Math.floor(e.y + 1.2), Math.floor(e.z))];
    if (onLadder) e.vy = e.climb ? e.climb * 2.6 : Math.max(e.vy, -1.6);
  }
  e.move(w, e.vx * dt, e.vy * dt, e.vz * dt);
  if (e.hitWall && speed) {
    if (t.climbs) e.vy = Math.max(e.vy, 3.5);
    else if (e.onGround || wasGround) e.vy = t.hops ? 7.5 : t.leaps ? 9.5 : 8.6;
  }
  // Rabbits move in hops.
  if (t.hops && speed && e.onGround) e.vy = 5.5;
  if (t.sized && e.onGround && !wasGround && vyBefore < -2) {
    e.squish = -0.6;
    e.vx *= 0.3; e.vz *= 0.3;
    ents.game.audio.mob('slime', 'hurt', { x: e.x, y: e.y, z: e.z }, 1.6 - e.size * 0.2);
  }
  e.squish *= Math.exp(-dt * 6);
  const moved = Math.hypot(e.vx, e.vz);
  e.walk += (Math.min(1, moved / 1.5) - e.walk) * Math.min(1, dt * 8);
  e.walkPhase += moved * dt * (e.baby ? 7 : 5);
  e.swing = Math.max(0, e.swing - dt * 3);
}

// ---------------------------------------------------------------- how they move their limbs
// Rotations [x, y, z] for the bones of creature `e` this frame.
export function poseMob(e, pose) {
  const t = e.def, a = Math.sin(e.walkPhase) * 0.9 * e.walk, age = e.age;
  const head = [e.headPitch * -1, e.headYaw, 0];
  switch (t.anim) {
    case 'quad': {
      pose.head = head;
      pose.legFR = [a, 0, 0]; pose.legBL = [a, 0, 0]; pose.legFL = [-a, 0, 0]; pose.legBR = [-a, 0, 0];
      pose.tail = [Math.sin(age * (e.angry ? 12 : 4)) * 0.1, Math.sin(age * 3) * (e.angry ? 0.5 : 0.25), 0];
      if (e.graze > 0) { pose.head = [0.9, 0, 0]; pose['head@'] = [0, -3, -1]; }
      break;
    }
    case 'chicken': {
      pose.head = head;
      pose.legR = [a, 0, 0]; pose.legL = [-a, 0, 0];
      const f = (Math.sin(e.flap) * 0.5 + 0.5) * (e.flap ? 1.2 : 0);
      pose.wingR = [0, 0, -f]; pose.wingL = [0, 0, f];
      break;
    }
    case 'rabbit': {
      pose.head = head;
      const hop = e.onGround ? 0 : 0.9;
      pose.hindR = [hop, 0, 0]; pose.hindL = [hop, 0, 0]; pose.frontR = [-hop * 0.6, 0, 0]; pose.frontL = [-hop * 0.6, 0, 0];
      pose.body = [-hop * 0.2, 0, 0];
      break;
    }
    case 'zombie': case 'humanoid': case 'archer': case 'enderman': {
      const k = t.anim === 'enderman' ? 0.4 : 1;
      pose.head = head;
      pose.rightLeg = [a * k, 0, 0]; pose.leftLeg = [-a * k, 0, 0];
      pose.rightArm = [-a * k * 0.8, 0, 0.05]; pose.leftArm = [a * k * 0.8, 0, -0.05];
      if (t.anim === 'zombie') {
        const lift = -1.45 + Math.sin(age * 1.3) * 0.05;
        pose.rightArm = [lift - e.swing * 0.5, 0, 0.1]; pose.leftArm = [lift - e.swing * 0.5, 0, -0.1];
      } else if (t.anim === 'archer' && (e.target || e.aim > 0)) {
        // Bow drawn: the bow arm straight at the target, the other pulling the string.
        pose.rightArm = [-1.5 + e.headPitch * -1, e.headYaw * 0.9 - 0.1, 0];
        pose.leftArm = [-1.5 + e.headPitch * -1, e.headYaw * 0.9 + 0.6, 0];
      } else if (t.anim === 'enderman' && e.angry) {
        pose.head = [head[0], head[1] + Math.sin(age * 40) * 0.05, 0];
        pose['head@'] = [0, 2, 0];
      }
      if (e.swing > 0 && t.anim !== 'zombie') pose.rightArm = [-1.8 * Math.sin(e.swing * Math.PI), 0, 0.2];
      if (e.pose === 'sleep') break;
      break;
    }
    case 'creeper': {
      pose.head = head;
      pose.legFR = [a, 0, 0]; pose.legBL = [a, 0, 0]; pose.legFL = [-a, 0, 0]; pose.legBR = [-a, 0, 0];
      break;
    }
    case 'spider': {
      pose.head = head;
      for (let i = 0; i < 4; i++) {
        const ph = e.walkPhase * 1.4 + i * 1.6, sw = e.walk * 0.4;
        pose[`legR${i}`] = [0, Math.sin(ph) * sw, Math.max(0, Math.cos(ph)) * sw];
        pose[`legL${i}`] = [0, -Math.sin(ph) * sw, -Math.max(0, Math.cos(ph)) * sw];
      }
      break;
    }
    case 'squid': {
      const s = (Math.sin(age * 2.2) * 0.5 + 0.5) * 0.9 + 0.1;
      for (let i = 0; i < 8; i++) {
        const ang = RIGS.squid.bones[`arm${i}`].arm;
        pose[`arm${i}`] = [Math.sin(ang) * s * 0.9, 0, -Math.cos(ang) * s * 0.9];
      }
      break;
    }
    case 'fish': {
      pose.tail = [0, Math.sin(age * (e.inWater ? 8 : 20)) * 0.45, 0];
      break;
    }
    default:
  }
}

// ---------------------------------------------------------------- drawing
const baseMat = new Float32Array(16);
// Adds creature `e` to the render list `out` (camera-relative position rx, ry, rz).
export function renderMob(ents, e, rx, ry, rz, light, out) {
  const t = e.def, r = ents.game.renderer;
  const skins = { main: t.skins[Math.min(e.variant, t.skins.length - 1)], wool: t.wool };
  if (t.type === 'wolf' && e.angry > 0) skins.main = 'wolf_angry';
  if (t.kind === 'civilian') skins.main = e.skin;
  const tint = t.wool ? woolTint(e.colour) : null;
  const meshes = rigMeshes(r, t.rig, skins, tint);
  const base = identity(baseMat);
  translate(base, base, rx, ry, rz);
  rotateY(base, base, e.yaw);
  if (e.dying) rotateZ(base, base, Math.min(1, Math.sqrt(e.dying * 1.6)) * Math.PI / 2);
  if (e.pose === 'sleep') { translate(base, base, 0, 0.3, 0); rotateX(base, base, -Math.PI / 2); translate(base, base, 0, -0.1, -0.9); }
  let s = (t.scale ?? 1) * (e.baby ? 0.5 : 1);
  if (t.sized) s *= e.size;
  if (t.anim === 'squid') { translate(base, base, 0, e.h * 0.5, 0); rotateX(base, base, Math.min(0.6, Math.hypot(e.vx, e.vz) * 0.3)); translate(base, base, 0, -e.h * 0.5, 0); }
  if (t.sized) {
    const q = e.squish;
    scale(base, base, s * (1 - q * 0.25), s * (1 + q * 0.5), s * (1 - q * 0.25));
  } else if (t.explodes && e.fuse > 0) {
    const f = Math.min(1, e.fuse / 30), swell = 1 + f * 0.25 + Math.sin(f * 60) * f * 0.03;
    scale(base, base, s * swell, s * (1 + f * 0.1), s * swell);
  } else if (s !== 1) scale(base, base, s, s, s);
  const pose = {};
  poseMob(e, pose);
  const parts = [];
  for (const m of meshes) {
    if (m.bone.wool && e.sheared) continue;
    parts.push({ mesh: m.mesh, model: boneMatrix(ents.mat(), base, m.bone, pose, m.name) });
  }
  // What it holds: attached to the hand of the arm bone.
  const held = e.held ?? (t.held ? I[t.held] : null);
  const hand = t.rigDef.hand;
  if (held && hand) {
    const mesh = r.itemMesh(held);
    const armBone = t.rigDef.bones[hand.bone];
    if (mesh && armBone) {
      const m = boneMatrix(ents.mat(), base, armBone, pose, hand.bone);
      translate(m, m, 8 + (hand.at[0] - armBone.pivot[0]) / 16, 8 + (hand.at[1] - armBone.pivot[1]) / 16, 8 + (hand.at[2] - armBone.pivot[2]) / 16);
      rotateX(m, m, -Math.PI / 2);
      if (held === I.bow) rotateY(m, m, -0.3);
      scale(m, m, 0.6, 0.6, 0.6);
      translate(m, m, -0.5 - 8, -0.15 - 8, -0.5 - 8);
      parts.push({ mesh, model: m });
    }
  }
  const flash = t.explodes && e.fuse > 0 && Math.floor(e.fuse / 3) % 2 === 0;
  out.push({ parts, light, tint: flash ? [2, 2, 2] : null, hurt: e.hurt > 0 || e.dying > 0 });
}
const woolTints = new Map();
function woolTint(colour) {
  if (!woolTints.has(colour)) {
    const dd = DYES[colour] ?? DYES[0];
    woolTints.set(colour, dd.wool ?? 0xffffff);
  }
  return woolTints.get(colour);
}

// ---------------------------------------------------------------- where they live
// Animals that turn up with a newly generated chunk, by biome: [type, weight, group size].
const HERDS = {
  plains: [['pig', 10, 3], ['cow', 8, 3], ['sheep', 12, 4], ['chicken', 10, 3], ['rabbit', 3, 2]],
  forest: [['pig', 8, 3], ['cow', 6, 3], ['sheep', 8, 4], ['chicken', 8, 3], ['wolf', 3, 3], ['fox', 3, 2], ['rabbit', 3, 2]],
  taiga: [['wolf', 6, 4], ['rabbit', 6, 3], ['fox', 6, 2], ['sheep', 6, 3], ['pig', 3, 3]],
  snowy: [['rabbit', 10, 3], ['polar_bear', 3, 2], ['fox', 4, 2]],
  desert: [['rabbit', 8, 2]],
  savanna: [['cow', 8, 3], ['sheep', 8, 3], ['chicken', 6, 3]],
  jungle: [['chicken', 10, 3], ['pig', 6, 3]],
  peaks: [['goat', 10, 3], ['rabbit', 2, 2]],
  meadow: [['sheep', 10, 4], ['rabbit', 6, 3], ['goat', 3, 2], ['cow', 4, 3]],
  cherry: [['pig', 6, 3], ['rabbit', 6, 2], ['sheep', 6, 3]],
  sea: [['squid', 8, 3], ['cod', 10, 4]],
  cold_sea: [['squid', 6, 3], ['salmon', 10, 4]],
  river: [['salmon', 8, 3], ['cod', 4, 3], ['squid', 2, 2]],
};
const HERD_OF = {
  [BIOME.PLAINS]: 'plains', [BIOME.SUNFLOWER_PLAINS]: 'plains', [BIOME.FLAT]: 'plains', [BIOME.FOREST]: 'forest', [BIOME.FLOWER_FOREST]: 'forest',
  [BIOME.BIRCH_FOREST]: 'forest', [BIOME.OLD_GROWTH_BIRCH]: 'forest', [BIOME.DARK_FOREST]: 'forest', [BIOME.WINDSWEPT_FOREST]: 'forest',
  [BIOME.TAIGA]: 'taiga', [BIOME.OLD_GROWTH_TAIGA]: 'taiga', [BIOME.SNOWY_TAIGA]: 'snowy', [BIOME.SNOWY_PLAINS]: 'snowy', [BIOME.ICE_SPIKES]: 'snowy',
  [BIOME.SNOWY_SLOPES]: 'snowy', [BIOME.DESERT]: 'desert', [BIOME.BADLANDS]: 'desert', [BIOME.SAVANNA]: 'savanna', [BIOME.JUNGLE]: 'jungle',
  [BIOME.SPARSE_JUNGLE]: 'jungle', [BIOME.MOUNTAINS]: 'peaks', [BIOME.STONY_PEAKS]: 'peaks', [BIOME.JAGGED_PEAKS]: 'peaks', [BIOME.FROZEN_PEAKS]: 'peaks',
  [BIOME.MEADOW]: 'meadow', [BIOME.CHERRY_GROVE]: 'cherry', [BIOME.OCEAN]: 'sea', [BIOME.DEEP_OCEAN]: 'sea', [BIOME.WARM_OCEAN]: 'sea',
  [BIOME.FROZEN_OCEAN]: 'cold_sea', [BIOME.RIVER]: 'river', [BIOME.FROZEN_RIVER]: 'cold_sea',
};
const RABBIT_OF = (biome) => (HERD_OF[biome] === 'snowy' ? 1 : biome === BIOME.DESERT || biome === BIOME.BADLANDS ? 3 : Math.random() < 0.15 ? 2 : 0);

// A herd for a fresh chunk: [{ type, x, y, z, o }] or none.
export function herdFor(chunk, seed) {
  if (hash2(chunk.cx, chunk.cz, seed ^ 0xa11) > 0.12) return [];
  const lx0 = Math.floor(hash2(chunk.cx, 3, chunk.cz) * 16), lz0 = Math.floor(hash2(7, chunk.cz, chunk.cx) * 16);
  const biome = chunk.biomes[lz0 * 16 + lx0];
  const table = HERDS[HERD_OF[biome]];
  if (!table) return [];
  let pick = hash2(chunk.cz, chunk.cx, seed) * table.reduce((a, x) => a + x[1], 0), row = table[0];
  for (const r of table) { if ((pick -= r[1]) <= 0) { row = r; break; } }
  const [type, , n] = row, water = MOBS[type].kind === 'water';
  const out = [];
  const variant = type === 'rabbit' ? RABBIT_OF(biome) : 0;
  for (let i = 0; i < n + Math.floor(hash2(chunk.cx * 7, chunk.cz, 5) * 2); i++) {
    const lx = (lx0 + Math.floor((hash2(chunk.cx, i, chunk.cz) - 0.5) * 8)) & 15, lz = (lz0 + Math.floor((hash2(i, chunk.cz, chunk.cx) - 0.5) * 8)) & 15;
    for (let y = HEIGHT - 2; y > 1; y--) {
      const id = chunk.blocks[(y << 8) | (lz << 4) | lx];
      if (!id) continue;
      if (water ? WATERLIKE[id] === 1 : (id === B.grass_block || id === B.snowy_grass || id === B.sand || id === B.snow_block || id === B.podzol ||
        id === B.stone || id === B.coarse_dirt || id === B.snow)) {
        const yy = water ? y - 1 - Math.floor(Math.random() * 2) : y + 1;
        if (water && WATERLIKE[chunk.blocks[(yy << 8) | (lz << 4) | lx]] !== 1) break;
        out.push({ type, x: chunk.cx * 16 + lx + 0.5, y: yy, z: chunk.cz * 16 + lz + 0.5,
          o: { variant, colour: type === 'sheep' ? sheepColour(Math.random()) : 0, baby: Math.random() < 0.1 } });
      }
      break;
    }
  }
  return out;
}

// Which monster to try at a dark spot (biome and depth decide).
export function monsterFor(biome, y, slimeChunk) {
  const r = Math.random() * 100;
  const cold = HERD_OF[biome] === 'snowy', dry = biome === BIOME.DESERT || biome === BIOME.BADLANDS;
  if (biome === BIOME.SWAMP && r < 12) return { type: 'slime', size: [1, 2, 4][Math.floor(Math.random() * 3)] };
  if (slimeChunk && y < 40 && r < 10) return { type: 'slime', size: [1, 2, 4][Math.floor(Math.random() * 3)] };
  if (r < 30) return { type: dry ? 'husk' : 'zombie' };
  if (r < 58) return { type: cold ? 'stray' : 'skeleton' };
  if (r < 80) return { type: 'creeper' };
  if (r < 96) return { type: 'spider' };
  return { type: 'enderman' };
}
export const HOSTILE_TYPES = new Set(Object.values(MOBS).filter((m) => m.hostile).map((m) => m.type));
