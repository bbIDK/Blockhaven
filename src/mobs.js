// Creatures: what each one is (model, skin, size, health, what it drops), how it behaves, how it
// moves its limbs, and where it turns up. Entities (entities.js) keeps them in its list and runs
// their physics; everything particular to a kind of creature lives here.
import { RIGS, rigMeshes, boneMatrix } from './rigs.js';
import { B, SOLID, WATERLIKE, CLIMB, LEAVES_WOOD, SHAPE_KIND } from './blocks.js';
import { I, ITEMS } from './items.js';
import { BIOME } from './biomes.js';
import { DYES } from './colors.js';
import { HEIGHT } from './config.js';
import { identity, translate, rotateX, rotateY, rotateZ, scale, hash2, clamp } from './math.js';
import { TEX } from './textures.js';
import { HORSE_COATS, HORSE_MARKINGS } from './tex/mobskins.js';
import { horseDrive, tameTick } from './riding.js';
import { leashTick, leashPull } from './leads.js';

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
    drops: [], sound: 'goat', leaps: true },
  wolf: { label: 'Wolf', rig: 'wolf', skins: ['wolf', 'wolf_angry'], extraSkins: { collar: 'collar' }, hw: 0.3, h: 0.85, health: 8, speed: 1.5,
    kind: 'neutral', anim: 'quad', damage: 4, drops: [], sound: 'wolf', pack: true, tameWith: ['bone'], tameHealth: 20, defends: true,
    petFood: ['raw_beef', 'cooked_beef', 'raw_porkchop', 'cooked_porkchop', 'raw_chicken', 'cooked_chicken', 'raw_mutton', 'cooked_mutton',
      'raw_rabbit', 'cooked_rabbit', 'rotten_flesh'] },
  // (A horse's variant is its coat plus seven times its markings: 0 for none.)
  horse: { label: 'Horse', rig: 'horse', skins: HORSE_COATS.map(([n]) => `horse_${n}`), markings: HORSE_MARKINGS.map((n) => `horse_markings_${n}`),
    variants: true, variantCount: HORSE_COATS.length * (HORSE_MARKINGS.length + 1), hw: 0.65, h: 1.6, health: 22,
    speed: 1.2, rideSpeed: 9, kind: 'animal', anim: 'horse', food: ['wheat', 'apple', 'sugar', 'carrot', 'hay_block', 'golden_apple', 'golden_carrot'],
    breedFood: ['golden_apple', 'golden_carrot'], drops: [d('leather', 0, 2)], sound: 'horse', rideable: true },
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
    anim: 'archer', burns: true, ranged: true, held: 'bow', drops: [d('bone', 0, 2), d('arrow', 0, 2)], sound: 'skeleton', noBlood: true },
  stray: { label: 'Stray', rig: 'skeleton', skins: ['stray'], hw: 0.3, h: 1.99, health: 20, speed: 2.0, kind: 'hostile', anim: 'archer',
    burns: true, ranged: true, held: 'bow', drops: [d('bone', 0, 2), d('arrow', 0, 2)], sound: 'skeleton', pitch: 0.85, noBlood: true },
  creeper: { label: 'Creeper', rig: 'creeper', skins: ['creeper'], hw: 0.3, h: 1.7, health: 20, speed: 1.9, kind: 'hostile', anim: 'creeper',
    explodes: 3, drops: [d('gunpowder', 0, 2)], sound: 'creeper' },
  spider: { label: 'Spider', rig: 'spider', skins: ['spider'], hw: 0.7, h: 0.9, health: 16, speed: 2.6, kind: 'hostile', anim: 'spider',
    damage: 2, climbs: true, drops: [d('string', 0, 2), d('spider_eye', 1, 1, 0.33)], sound: 'spider', calmInDaylight: true },
  enderman: { label: 'Enderman', rig: 'enderman', skins: ['enderman'], hw: 0.3, h: 2.9, health: 40, speed: 2.4, kind: 'neutral', anim: 'enderman',
    damage: 7, teleports: true, drops: [d('ender_pearl', 0, 1)], sound: 'enderman' },
  slime: { label: 'Slime', rig: 'slime', skins: ['slime'], hw: 0.26, h: 0.52, health: 1, speed: 2.2, kind: 'hostile', anim: 'slime',
    drops: [d('slime_ball', 0, 2)], sound: 'slime', sized: true, noBlood: true },
  donkey: { label: 'Donkey', rig: 'donkey', skins: ['donkey'], hw: 0.6, h: 1.4, health: 20, speed: 1.1, rideSpeed: 7,
    kind: 'animal', anim: 'horse', food: ['wheat', 'apple', 'sugar', 'carrot', 'hay_block', 'golden_apple', 'golden_carrot'],
    breedFood: ['golden_apple', 'golden_carrot'], drops: [d('leather', 0, 2)], sound: 'donkey', rideable: true, scale: 0.87, seat: 1.22 },
  // Mules: a horse and a donkey's foal, which can't have foals of its own.
  mule: { label: 'Mule', rig: 'donkey', skins: ['mule'], hw: 0.65, h: 1.6, health: 22, speed: 1.15, rideSpeed: 8, kind: 'animal', anim: 'horse',
    food: ['wheat', 'apple', 'sugar', 'carrot', 'hay_block', 'golden_apple', 'golden_carrot'], drops: [d('leather', 0, 2)], sound: 'donkey',
    rideable: true, scale: 0.92, seat: 1.28 },
  llama: { label: 'Llama', rig: 'llama', skins: ['llama_creamy', 'llama_white', 'llama_brown', 'llama_gray'], variants: true, hw: 0.45, h: 1.87, health: 22,
    speed: 1.1, kind: 'animal', anim: 'quad', food: ['wheat', 'hay_block'], drops: [d('leather', 0, 2)], sound: 'llama', scale: 0.85 },
  cat: { label: 'Cat', rig: 'cat', skins: ['cat_tabby', 'cat_black', 'cat_white', 'cat_siamese', 'cat_calico', 'cat_ginger'], extraSkins: { collar: 'collar' },
    variants: true, hw: 0.3, h: 0.7, health: 10, speed: 1.7, kind: 'animal', anim: 'quad', food: ['cod', 'salmon'], tameWith: ['cod', 'salmon'],
    drops: [d('string', 0, 2)], sound: 'cat', shy: 3, homeRange: 12 },
  turtle: { label: 'Turtle', rig: 'turtle', skins: ['turtle'], hw: 0.6, h: 0.4, health: 30, speed: 0.6, kind: 'animal', anim: 'turtle',
    drops: [], sound: 'turtle', scale: 1.2, swimmer: true },
  parrot: { label: 'Parrot', rig: 'parrot', skins: ['parrot_red', 'parrot_blue', 'parrot_green', 'parrot_cyan', 'parrot_gray'], variants: true, hw: 0.25, h: 0.9,
    health: 6, speed: 2.2, kind: 'animal', anim: 'parrot', tameWith: ['wheat_seeds', 'beetroot_seeds', 'pumpkin_seeds', 'melon_seeds'],
    drops: [d('feather', 1, 2)], sound: 'parrot', flies: 'parrot', flutter: true },
  bat: { label: 'Bat', rig: 'bat', skins: ['bat'], hw: 0.25, h: 0.5, health: 6, speed: 3.2, kind: 'animal', anim: 'bat', drops: [], sound: 'bat',
    flies: 'bat', scale: 0.7, xp: 0 },
  iron_golem: { label: 'Iron Golem', rig: 'iron_golem', skins: ['iron_golem'], extraSkins: { limbs: 'iron_golem_limbs' }, hw: 0.7, h: 2.7,
    health: 100, speed: 1.3, kind: 'neutral', anim: 'golem', damage: 15, guards: true, heavy: true, noBlood: true, knockback: 0, xp: 0,
    drops: [d('iron_ingot', 3, 5), d('poppy', 0, 2)], sound: 'golem' },
  snow_golem: { label: 'Snow Golem', rig: 'snow_golem', skins: ['snow_golem'], hw: 0.35, h: 1.9, health: 4, speed: 1.1, kind: 'neutral',
    anim: 'snow_golem', drops: [d('snowball', 0, 15)], sound: 'snow_golem', throwsSnow: true, melts: true, noBlood: true, xp: 0 },
  dolphin: { label: 'Dolphin', rig: 'dolphin', skins: ['dolphin'], hw: 0.45, h: 0.6, health: 10, speed: 3.5, kind: 'water', anim: 'dolphin',
    drops: [d('cod', 0, 1)], sound: 'dolphin', scale: 0.7, leaps: true },
  drowned: { label: 'Drowned', rig: 'humanoid', skins: ['drowned'], hw: 0.3, h: 1.95, health: 20, speed: 1.9, kind: 'hostile', anim: 'zombie',
    damage: 3, burns: true, swims: true, drops: [d('rotten_flesh', 0, 2), d('copper_ingot', 1, 1, 0.11)], sound: 'zombie', pitch: 0.75, hunts: true },
  witch: { label: 'Witch', rig: 'witch', skins: ['witch'], hw: 0.3, h: 1.95, health: 26, speed: 1.9, kind: 'hostile', anim: 'witch', throws: true,
    drops: [d('glass_bottle', 0, 2), d('redstone', 0, 2), d('sugar', 0, 2), d('spider_eye', 0, 1), d('gunpowder', 0, 2), d('stick', 0, 2),
      d('potion_healing', 1, 1, 0.08), d('splash_potion_poison', 1, 1, 0.04)], sound: 'witch' },
  cave_spider: { label: 'Cave Spider', rig: 'spider', skins: ['cave_spider'], hw: 0.35, h: 0.5, health: 12, speed: 2.8, kind: 'hostile',
    anim: 'spider', damage: 2, climbs: true, poison: [7, 1], drops: [d('string', 0, 2), d('spider_eye', 0, 1)], sound: 'spider', pitch: 1.35,
    scale: 0.7, calmInDaylight: true },
  phantom: { label: 'Phantom', rig: 'phantom', skins: ['phantom'], hw: 0.45, h: 0.5, health: 20, speed: 7, kind: 'hostile', anim: 'phantom',
    damage: 3, burns: true, drops: [d('phantom_membrane', 0, 1)], sound: 'phantom', flies: 'phantom', scale: 1.1 },
  // Village people (see civilians.js); each wears their own skin.
  civilian: { label: 'Villager', rig: 'humanoid', skins: ['civ_farmer_0'], hw: 0.3, h: 1.9, health: 20, speed: 1.6, kind: 'civilian',
    anim: 'humanoid', drops: [], sound: null },
};
for (const [type, m] of Object.entries(MOBS)) {
  m.type = type;
  m.hostile = m.kind === 'hostile';
  m.drops = m.drops.map(([name, lo, hi, chance]) => [I[name] ?? B[name], lo, hi, chance]).filter((x) => x[0] !== undefined);
  const ids = (names) => new Set((names ?? []).map((n) => I[n] ?? B[n]).filter((id) => id !== undefined));
  m.foodIds = ids(m.food);
  m.tameIds = ids(m.tameWith);
  m.petFoodIds = m.petFood ? ids(m.petFood) : m.foodIds;
  m.breedIds = m.breedFood ? new Set(m.breedFood.map((n) => I[n] ?? B[n])) : null;
  m.rigDef = RIGS[m.rig];
  // (What can be put on a lead: animals, and neutral creatures other than endermen.)
  m.leashable = (m.kind === 'animal' || m.kind === 'neutral') && !m.flies && type !== 'enderman' && type !== 'turtle';
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
    aim: 0, lookAt: null, lookTime: 0, squish: 0, jumpCd: 0, teleportCd: 0, graze: 0, pinned: o.pinned ?? null, penned: !!o.penned, home: o.home ?? null,
    tame: !!o.tame, saddled: !!o.saddled, temper: o.temper ?? 0, rider: null,
    // (Pets: whose they are (a player's id), whether they've been told to sit, their collar's dye.)
    owner: o.owner ?? null, sitting: !!o.sitting, collar: o.collar ?? RED,
    // (Golems someone built stay put when they're far away, like pets.)
    made: !!o.made,
    // (A name given with a name tag; who holds its lead, or the fence post it's tied to.)
    named: o.named ?? null, leash: o.leash ?? null,
  });
  if ((type === 'horse' || type === 'mule') && o.health === undefined) e.health = 15 + Math.floor(Math.random() * 16);
  if (e.owner && t.tameHealth) e.health = t.tameHealth;
  e.maxHealth = e.health;
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
const RED = DYES.findIndex((dd) => dd.name === 'red');
// Where a snow golem melts; where it's too warm for its trail of snow; where rain falls as snow.
const HOT = new Set([BIOME.DESERT, BIOME.SAVANNA, BIOME.BADLANDS]);
const WARM = new Set([...HOT, BIOME.JUNGLE, BIOME.SPARSE_JUNGLE, BIOME.PLAINS, BIOME.SUNFLOWER_PLAINS, BIOME.FLAT, BIOME.BEACH, BIOME.SWAMP,
  BIOME.WARM_OCEAN, BIOME.OCEAN, BIOME.DEEP_OCEAN]);
const COLD = new Set([BIOME.SNOWY_TAIGA, BIOME.SNOWY_PLAINS, BIOME.ICE_SPIKES, BIOME.SNOWY_SLOPES, BIOME.SNOWY_PEAKS, BIOME.FROZEN_PEAKS,
  BIOME.JAGGED_PEAKS, BIOME.FROZEN_OCEAN, BIOME.FROZEN_RIVER, BIOME.SNOWY_BEACH]);

// ---------------------------------------------------------------- behaviour (20 times a second)
// `ents` is the Entities list (players, world, game).
export function mobTick(ents, e) {
  const game = ents.game, w = ents.world, t = e.def;
  if (e.dying) return;
  e.hurt = Math.max(0, e.hurt - 1);
  e.attackCd = Math.max(0, e.attackCd - 1);
  e.breedCd = Math.max(0, e.breedCd - 1);
  e.teleportCd = Math.max(0, e.teleportCd - 1);
  if (e.love > 0) { e.love--; if (e.love % 10 === 0) game.particles.hearts(e.x, e.y + e.h * 0.5 + 0.3, e.z, 1, e.hw + 0.1); }
  if (e.baby && --e.grow <= 0) { e.baby = false; e.hw = t.hw; e.h = t.h; }
  const feetId = w.getBlock(Math.floor(e.x), Math.floor(e.y + 0.2), Math.floor(e.z));
  const inWater = WATERLIKE[feetId] === 1 || WATERLIKE[w.getBlock(Math.floor(e.x), Math.floor(e.y + e.h * 0.6), Math.floor(e.z))] === 1;
  e.inWater = inWater;
  // Fire and lava burn; water puts it out.
  if (feetId === B.fire || WATERLIKE[feetId] === 2) { e.onFire = 160; if (WATERLIKE[feetId] === 2 && ++e.burnCd >= 10) { e.burnCd = 0; ents.hurtMob(e, 4, null); } }
  // Splashed with a potion: poison stings, slowness drags, regeneration heals.
  if (e.poisoned > 0 && --e.poisoned % 25 === 0 && e.health > 1) ents.hurtMob(e, 1, null);
  if (e.regen > 0 && --e.regen % 50 === 0) e.health = Math.min(e.maxHealth ?? e.health, e.health + 1);
  if (e.slowed > 0) e.slowed--;
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
  // Out of water, fish flop and slowly suffocate; squid too. (A dolphin's leap is over before it
  // does it any harm.)
  if (t.kind === 'water') {
    if (inWater) e.dry = 0;
    else {
      if (e.onGround && Math.random() < 0.15) { e.vy = 4; e.vx = (Math.random() - 0.5) * 3; e.vz = (Math.random() - 0.5) * 3; }
      if ((e.dry = (e.dry ?? 0) + 1) >= 40) { e.dry = 0; ents.hurtMob(e, 1, null); }
    }
  }
  // Snow golems melt where it's hot, or wet (rain that isn't snow, water); where it's cool they
  // leave a trail of snow behind them.
  if (t.melts) {
    const bx = Math.floor(e.x), bz = Math.floor(e.z), biome = w.biomeAt?.(bx, bz) ?? -1;
    const rained = game.weather.rain > 0.3 && !COLD.has(biome) && (w.getLight(bx, Math.floor(e.y + 1.8), bz) >> 4) >= 15;
    if ((HOT.has(biome) || inWater || rained) && (e.meltCd = (e.meltCd ?? 0) + 1) % 20 === 0) ents.hurtMob(e, 1, null);
    const cell = `${bx},${Math.floor(e.y + 0.05)},${bz}`;
    if (e.onGround && e.cell && e.cell !== cell && !WARM.has(biome)) {
      const [x, y, z] = e.cell.split(',').map(Number);
      const below = w.getBlock(x, y - 1, z);
      if (w.getBlock(x, y, z) === 0 && SOLID[below] && !SHAPE_KIND[below] && w.supported(x, y, z, B.snow)) w.setBlock(x, y, z, B.snow);
    }
    e.cell = e.onGround ? cell : e.cell;
  }
  // A zombie kept under water turns into a drowned.
  if (t.type === 'zombie' && WATERLIKE[w.getBlock(Math.floor(e.x), Math.floor(e.y + 1.7), Math.floor(e.z))] === 1) {
    if ((e.drowning = (e.drowning ?? 0) + 1) >= 600) { becomeDrowned(ents, e); return; }
  } else e.drowning = 0;
  if (e.rider) { riddenTick(ents, e); return; }
  if (e.leash && leashTick(ents, e)) { lookTick(ents, e); return; }
  if (e.owner && petTick(ents, e)) { lookTick(ents, e); return; }
  if (t.flies === 'phantom') phantomTick(ents, e);
  else if (t.flies) flyTick(ents, e);
  else switch (t.kind) {
    case 'hostile': hostileTick(ents, e); break;
    case 'neutral': neutralTick(ents, e); break;
    case 'water': swimTick(ents, e); break;
    case 'civilian': ents.civilians?.think(e); break;
    default: animalTick(ents, e);
  }
  lookTick(ents, e);
  if (t.sound && Math.random() < (t.hostile ? 0.005 : 0.003)) game.audio.mob(t.sound, 'say', { x: e.x, y: e.y + e.h * 0.8, z: e.z }, t.pitch);
}

function becomeDrowned(ents, e) {
  const d = ents.spawnMob('drowned', e.x, e.y, e.z, { baby: e.baby });
  d.yaw = e.yaw; d.health = Math.min(d.health, e.health);
  e.dead = true;
  ents.game.net?.entityGone(e, 'x');
  ents.game.particles.smoke(e.x, e.y + 1, e.z, 8, 0.4);
  ents.game.audio.mob('zombie', 'hurt', { x: e.x, y: e.y + 1.6, z: e.z }, 0.75);
}

// A burst of love hearts over creature `e` (everyone in a multiplayer game sees them).
function loveHearts(game, e, n) {
  const y = e.y + e.h * 0.5 + 0.3;
  game.particles.hearts(e.x, y, e.z, n, e.hw + 0.1);
  if (game.net?.host) game.net.effect('hearts', e.x, y, e.z, n);
}

// With someone on its back: an untamed horse makes up its mind whether to keep them; a tame one
// without a saddle wanders where it likes. (The rider's keys steer a saddled one; see riding.js.)
function riddenTick(ents, e) {
  const game = ents.game, at = { x: e.x, y: e.y + e.h, z: e.z };
  const verdict = tameTick(e);
  if (verdict === 'tame') {
    loveHearts(game, e, 7);
    game.audio.mob('horse', 'say', at, 1.1);
  } else if (verdict === 'buck') {
    game.audio.mob('horse', 'angry', at);
    game.particles.icons(TEX.angry, e.x, e.y + e.h + 0.1, e.z, 3, 0.4, 0.3, 0.12);
    ents.throwRider(e);
  } else if (e.tame && !e.saddled) wander(e, 0.5);
  e.headYaw *= 0.8; e.headPitch *= 0.8;
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
const faceAway = (e, x, z) => { e.yaw = Math.atan2(x - e.x, z - e.z); };
const dist2 = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);

function animalTick(ents, e) {
  const t = e.def, game = ents.game, w = ents.world;
  e.speedMul = 1;
  // Turtles swim about when they're in the water (and come ashore now and then).
  if (t.swimmer && e.inWater) {
    if (e.panic > 0) e.panic--;
    if (--e.wander <= 0) {
      e.wander = 30 + Math.floor(Math.random() * 60);
      e.moving = Math.random() < 0.85;
      e.yaw = Math.random() * TAU;
      e.swimY = (Math.random() - 0.5) * 1.2;
    }
    e.speedMul = e.panic > 0 ? 5 : 3.5;
    return;
  }
  if (e.panic > 0) {
    e.panic--;
    if (e.panic % 20 === 0) e.yaw = Math.random() * TAU;
    e.moving = true; e.speedMul = 1.8;
    return;
  }
  // Shy creatures keep away from players (not from their owner, once tamed).
  if (t.shy && !e.tame) {
    const p = ents.players.find((q) => !q.dead && dist2(q, e) < t.shy && !(q.sneaking));
    if (p) { faceAway(e, p.x, p.z); e.moving = true; e.speedMul = 1.6; return; }
  }
  // Animals follow someone holding their food, and look for a partner when in love.
  if (e.love > 0 && seekMate(ents, e)) return;
  if (e.penned) { e.moving = false; }
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
  if (e.home && dist2(e, e.home) > (t.homeRange ?? 4)) { faceTowards(e, e.home.x, e.home.z); e.moving = true; }
}

// In love: go to a partner (another of its kind in love nearby, or a horse and a donkey, whose foal
// is a mule) and have a baby with them.
const CROSS = { horse: 'donkey', donkey: 'horse' };
function seekMate(ents, e) {
  const game = ents.game;
  const mate = ents.list.find((o) => o !== e && o.kind === 'mob' && (o.type === e.type || o.type === CROSS[e.type]) && o.love > 0 && !o.baby &&
    !o.dead && !o.dying && dist2(o, e) < 8);
  if (!mate) return false;
  faceTowards(e, mate.x, mate.z);
  e.moving = dist2(mate, e) > 1.2;
  if (!e.moving && e.love > 0 && mate.love > 0) {
    e.love = mate.love = 0; e.breedCd = mate.breedCd = 6000;
    // (A foal of two tame horses is born tame; puppies and kittens belong to their parents' owner.)
    const same = mate.type === e.type;
    const baby = ents.spawnMob(same ? e.type : 'mule', (e.x + mate.x) / 2, e.y, (e.z + mate.z) / 2, { baby: true,
      variant: !same ? 0 : Math.random() < 0.5 ? e.variant : mate.variant,
      colour: Math.random() < 0.5 ? e.colour : mate.colour, tame: e.tame && mate.tame, owner: e.owner && e.owner === mate.owner ? e.owner : null });
    loveHearts(game, baby, 7);
    ents.spawnXp(baby.x, baby.y + 0.5, baby.z, 1 + Math.floor(Math.random() * 7));
  }
  return true;
}

// ---------------------------------------------------------------- pets
// Whose pet `e` is, if they're about. (Playing alone, every pet is yours.)
export function ownerOf(ents, e) {
  if (!e.owner) return null;
  return ents.players.find((p) => p.uid === e.owner) ?? (ents.game.net ? null : ents.players[0] ?? null);
}
// Tamed wolves, cats and parrots follow their owner about (catching up by appearing beside them
// when left far behind), sit when told to, and wolves fight for them. True when it has decided
// what to do this tick; false leaves it to its usual ways (wandering near).
function petTick(ents, e) {
  const t = e.def, owner = ownerOf(ents, e);
  if (e.sitting) {
    e.moving = false; e.target = null; e.angry = 0; e.panic = 0;
    if (t.flies) e.flyVel = null;
    return true;
  }
  if (e.love > 0 && !t.flies && seekMate(ents, e)) return true;
  // Wolves go for whatever their owner fights, or whatever hurt them.
  const tg = e.target;
  if (t.defends && tg && !targetGone(tg) && tg !== owner && dist2(tg, e) < 24) {
    faceTowards(e, tg.x, tg.z);
    const dist = dist2(tg, e);
    e.moving = dist > 0.8; e.speedMul = 1.5; e.angry = Math.max(e.angry, 20);
    meleeTick(ents, e, tg, dist, tg.y - e.y);
    return true;
  }
  e.target = null; e.angry = 0;
  // (On a lead, it goes where the lead takes it.)
  if (!owner || owner.dead || e.leash) return false;
  const d = Math.hypot(owner.x - e.x, owner.z - e.z);
  if ((d > 20 || Math.abs(owner.y - e.y) > 10) && petTeleport(ents, e, owner)) return true;
  if (t.flies) {
    // A parrot flies after its owner, to hover about their shoulders.
    if (d > 3.5 || Math.abs(owner.y + 2 - e.y) > 3) {
      e.flyTarget = { x: owner.x + (Math.random() - 0.5) * 2, y: owner.y + 2.2, z: owner.z + (Math.random() - 0.5) * 2 };
      e.landing = false;
      steer(e, e.flyTarget, t.speed * 1.3);
      return true;
    }
    return false;
  }
  if (d > 5) { faceTowards(e, owner.x, owner.z); e.moving = true; e.speedMul = d > 10 ? 1.7 : 1.25; return true; }
  if (d < 2.5) { e.moving = false; return true; }
  return false;
}
// Appear on solid ground a step or two from `owner`.
function petTeleport(ents, e, owner) {
  const w = ents.world;
  for (let k = 0; k < 12; k++) {
    const x = Math.floor(owner.x + (Math.random() - 0.5) * 5), z = Math.floor(owner.z + (Math.random() - 0.5) * 5);
    if (Math.abs(x + 0.5 - owner.x) < 1 && Math.abs(z + 0.5 - owner.z) < 1) continue;
    for (let y = Math.floor(owner.y) + 1; y >= Math.floor(owner.y) - 2; y--) {
      if (!SOLID[w.getBlock(x, y - 1, z)] || SOLID[w.getBlock(x, y, z)] || SOLID[w.getBlock(x, y + 1, z)] || WATERLIKE[w.getBlock(x, y, z)]) continue;
      e.x = x + 0.5; e.y = y; e.z = z + 0.5; e.vx = e.vy = e.vz = 0; e.flyTarget = null;
      return true;
    }
  }
  return false;
}
// Someone's wolves go after `foe`: whatever their owner (a player's id) attacked, or whatever
// attacked them. (Not creepers, and not another of the same owner's pets.)
export function rallyPets(ents, uid, foe) {
  if (!foe || foe.kind !== 'mob' || foe.def.explodes || (foe.owner && foe.owner === uid)) return;
  for (const o of ents.list) {
    if (o.kind !== 'mob' || !o.def.defends || !o.owner || o.sitting || o.dead || o.dying || o === foe) continue;
    if ((o.owner === uid || !ents.game.net) && dist2(o, foe) < 20) { o.target = foe; o.angry = 200; }
  }
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
  // Dolphins come up for air every so often, leaping clear of the water when they reach the top.
  if (e.def.leaps && (e.leapCd = (e.leapCd ?? 100 + Math.floor(Math.random() * 300)) - 1) <= 0) {
    const w = ents.world;
    e.moving = true; e.speedMul = 1.8; e.swimY = 2.5;
    if (!WATERLIKE[w.getBlock(Math.floor(e.x), Math.floor(e.y + 1.2), Math.floor(e.z))]) {
      e.vy = 11; e.leap = 0.7; e.leapCd = 200 + Math.floor(Math.random() * 400); e.swimY = 0;
      ents.game.audio.mob('dolphin', 'say', { x: e.x, y: e.y, z: e.z });
    }
    if (e.leapCd < -200) e.leapCd = 100;
    return;
  }
  if (e.panic > 0) { e.panic--; e.speedMul = 2.2; }
  else e.speedMul = 1;
  if (--e.wander <= 0) {
    e.wander = 20 + Math.floor(Math.random() * 60);
    e.moving = Math.random() < 0.8;
    e.yaw = Math.random() * TAU;
    e.swimY = (Math.random() - 0.45) * 1.2;
  }
}

// Players (and for zombies, villagers) a monster could go after (no more than `tall` blocks above
// or below it).
function preyFor(ents, e, range, tall = 12) {
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
const targetGone = (t) => !t || t.dead || t.dying || t.creative;

function hostileTick(ents, e) {
  const t = e.def, game = ents.game, w = ents.world;
  // Creepers are afraid of cats.
  if (t.explodes) {
    const cat = ents.list.find((o) => o.type === 'cat' && !o.dead && !o.dying && dist2(o, e) < 6 && Math.abs(o.y - e.y) < 4);
    if (cat) { faceAway(e, cat.x, cat.z); e.moving = true; e.speedMul = 1.5; e.fuse = Math.max(0, e.fuse - 1); return; }
  }
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
  if (t.throws) return witchTick(ents, e, tg, dist);
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
    const why = `You were slain by ${/^[AEIOU]/.test(e.def.label) ? 'an' : 'a'} ${e.def.label.toLowerCase()}`;
    // Iron golems fling what they hit into the air.
    const up = e.def.heavy ? 9 : 4.5;
    if (tg.kind === 'mob') { ents.hurtMob(tg, dmg, e, e.def.heavy ? 1.5 : 0); if (e.def.heavy) tg.vy = up; }
    else { ents.game.hurtPlayer(tg, dmg, why, [(tg.x - e.x) * k * 0.3, up, (tg.z - e.z) * k * 0.3], true); rallyPets(ents, tg.uid, e); }
    if (e.def.poison && tg.kind !== 'mob') ents.game.giveEffect?.(tg, 'poison', ...e.def.poison);
    if (e.def.heavy) ents.game.audio.mob('golem', 'attack', { x: e.x, y: e.y + 2, z: e.z });
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

// The velocity to throw or shoot something at `v` blocks a second from (ex, ey, ez) so that it
// comes down on (tx, ty, tz): aimed that much higher to allow for its fall (gravity 20, as in
// Entities.arrowPhysics; the flatter of the two arcs that reach).
function aimAt(ex, ey, ez, tx, ty, tz, v) {
  const dx = tx - ex, dz = tz - ez, dy = ty - ey, h = Math.hypot(dx, dz) || 1e-3, G = 20, v2 = v * v;
  const disc = v2 * v2 - G * (G * h * h + 2 * dy * v2);
  // (Out of reach: as far as it will go.)
  const ang = disc >= 0 ? Math.atan2(v2 - Math.sqrt(disc), G * h) : Math.PI / 4, c = Math.cos(ang);
  return [(dx / h) * v * c, v * Math.sin(ang), (dz / h) * v * c];
}

// Whether there's a clear line from (ax, ay, az) to (bx, by, bz): nothing solid in the way (grass,
// flowers and the like don't hide anyone).
function clearLine(w, ax, ay, az, bx, by, bz) {
  const len = Math.hypot(bx - ax, by - ay, bz - az), n = Math.ceil(len * 4);
  for (let i = 1; i < n; i++) {
    const f = i / n;
    if (SOLID[w.getBlock(Math.floor(ax + (bx - ax) * f), Math.floor(ay + (by - ay) * f), Math.floor(az + (bz - az) * f))]) return false;
  }
  return true;
}

function archerTick(ents, e, tg, dist) {
  const w = ents.world;
  faceTowards(e, tg.x, tg.z);
  const ex = e.x, ey = e.y + 1.6, ez = e.z, ty = tg.y + (tg.kind === 'mob' ? tg.h * 0.6 : 1.4);
  const sees = clearLine(w, ex, ey, ez, tg.x, ty, tg.z);
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
      const [vx, vy, vz] = aimAt(ex, ey, ez, tg.x, ty, tg.z, 18);
      ents.spawnArrow(ex, ey, ez, vx + (Math.random() - 0.5) * 1.2, vy + (Math.random() - 0.5) * 1.2, vz + (Math.random() - 0.5) * 1.2, e,
        2 + Math.floor(Math.random() * 3), false);
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

// Witches keep their distance and throw potions: poison, slowness, or harm. Hurt, they drink
// one to heal.
function witchTick(ents, e, tg, dist) {
  const w = ents.world, game = ents.game;
  faceTowards(e, tg.x, tg.z);
  if (e.drinking > 0 && --e.drinking === 0) e.held = null;
  if (e.health < e.maxHealth * 0.5 && !e.drinking && (e.drinkCd = (e.drinkCd ?? 0) - 1) <= 0) {
    e.drinkCd = 200;
    e.drinking = 32;
    e.held = I.potion_healing ?? null;
    e.health = Math.min(e.maxHealth, e.health + 6);
    game.particles.icons(TEX.happy, e.x, e.y + 1.7, e.z, 6, 0.4);
    game.audio.mob('witch', 'drink', { x: e.x, y: e.y + 1.6, z: e.z });
  }
  const ex = e.x, ey = e.y + 1.6, ez = e.z, ty = tg.y + (tg.kind === 'mob' ? tg.h * 0.6 : 1.2);
  const sees = clearLine(w, ex, ey, ez, tg.x, ty, tg.z);
  e.moving = !sees || dist > 9 || dist < 4;
  if (dist < 4) e.yaw += Math.PI;
  if (sees && dist < 10 && e.attackCd === 0 && !e.drinking) {
    e.attackCd = 60;
    e.swing = 1;
    const kind = dist > 7 ? 'slowness' : Math.random() < 0.5 ? 'poison' : 'harming';
    const [vx, vy, vz] = aimAt(ex, ey, ez, tg.x, ty, tg.z, 10);
    ents.spawnArrow(ex, ey, ez, vx, vy, vz, e, 0, false, { potion: kind });
    game.audio.mob('witch', 'say', { x: e.x, y: ey, z: e.z });
  }
}

// Flying creatures steer towards a point (`flyTarget`) at their speed; they pick a new one when
// they get there or bump into something. Bats flit about in the dark; parrots flutter between
// perches, resting a while on each.
function flyTick(ents, e) {
  const w = ents.world, t = e.def;
  if (e.panic > 0) e.panic--;
  if (t.flies === 'bat') {
    const ceiling = () => SOLID[w.getBlock(Math.floor(e.x), Math.floor(e.y + e.h + 0.3), Math.floor(e.z))];
    if (e.roost) {
      // Hanging from the ceiling, until someone comes close (or it just feels like flying).
      e.flyVel = null; e.moving = false;
      const near = ents.players.some((p) => !p.dead && !p.sneaking && Math.hypot(p.x - e.x, p.y + 1 - e.y, p.z - e.z) < 4);
      if (!near && !e.panic && Math.random() > 0.001 && ceiling()) return;
      e.roost = false; e.flyTarget = null; e.roostAt = null;
    } else if (e.roostAt) {
      // Off to a spot under the ceiling it picked out; it hangs there when it arrives.
      const r = e.roostAt;
      if (Math.hypot(r.x - e.x, r.y - e.y, r.z - e.z) < 0.5 || (ceiling() && Math.hypot(r.x - e.x, r.z - e.z) < 1)) {
        e.roost = true; e.roostAt = null; e.y = Math.floor(e.y + e.h + 0.3) - e.h; e.vx = e.vy = e.vz = 0;
        return;
      }
      if (e.hitWall || Math.random() < 0.004) e.roostAt = null;
      else { e.flyTarget = r; steer(e, r, t.speed * 0.6); return; }
    } else if (Math.random() < 0.015) {
      // Tired of flying: look for a ceiling close by.
      for (let k = 0; k < 8 && !e.roostAt; k++) {
        const x = Math.floor(e.x + (Math.random() - 0.5) * 10), z = Math.floor(e.z + (Math.random() - 0.5) * 10);
        for (let y = Math.floor(e.y); y < Math.floor(e.y) + 6; y++) {
          if (SOLID[w.getBlock(x, y, z)]) { if (y > Math.floor(e.y) && !SOLID[w.getBlock(x, y - 1, z)]) e.roostAt = { x: x + 0.5, y: y - e.h - 0.02, z: z + 0.5 }; break; }
        }
      }
    }
  }
  if (t.flies === 'parrot') {
    if (e.onGround && !e.panic) {
      // Perched: sit a while, then take off.
      e.flyVel = null; e.landing = false;
      if ((e.perch = (e.perch ?? 60) - 1) > 0) { e.moving = false; return; }
      e.flyTarget = null;
    } else if (e.landing) {
      // Coming down to land wherever it is.
      e.flyVel = [e.vx * 0.3, -2, e.vz * 0.3];
      return;
    }
  }
  const near = e.flyTarget && Math.hypot(e.flyTarget.x - e.x, e.flyTarget.y - e.y, e.flyTarget.z - e.z) < 1;
  if (!e.flyTarget || near || e.hitWall || Math.random() < (t.flies === 'bat' ? 0.04 : 0.01)) {
    if (near && t.flies === 'parrot' && Math.random() < 0.6) { e.flyTarget = null; e.landing = true; e.perch = 80 + Math.floor(Math.random() * 200); return; }
    for (let k = 0; k < 10; k++) {
      const r = t.flies === 'bat' ? 6 : 8;
      const x = e.x + (Math.random() - 0.5) * 2 * r, z = e.z + (Math.random() - 0.5) * 2 * r;
      const y = e.y + (Math.random() - (t.flies === 'bat' ? 0.5 : 0.35)) * 5;
      const id = w.getBlock(Math.floor(x), Math.floor(y), Math.floor(z));
      if (SOLID[id] || WATERLIKE[id]) continue;
      // Bats keep to the dark; parrots don't go far up from the ground.
      if (t.flies === 'bat' && (w.getLight(Math.floor(x), Math.floor(y), Math.floor(z)) >> 4) > 10 && Math.random() < 0.8) continue;
      if (t.flies === 'parrot' && w.topAt && y > w.topAt(Math.floor(x), Math.floor(z)) + 7) continue;
      e.flyTarget = { x, y, z };
      break;
    }
  }
  const f = e.flyTarget;
  if (!f) { e.flyVel = [0, t.flies === 'bat' ? 0.2 : -1, 0]; return; }
  steer(e, f, t.speed * (e.panic > 0 ? 1.8 : 1));
}
function steer(e, f, sp) {
  const dx = f.x - e.x, dy = f.y - e.y, dz = f.z - e.z, len = Math.hypot(dx, dy, dz) || 1;
  e.flyVel = [(dx / len) * sp, (dy / len) * sp, (dz / len) * sp];
  e.moving = true;
}

// Phantoms circle high over their prey, then swoop down to bite and climb away again.
function phantomTick(ents, e) {
  const tg = targetGone(e.target) ? null : e.target;
  if (!tg) {
    if ((e.targetCd = (e.targetCd ?? 0) - 1) <= 0) { e.targetCd = 20; e.target = preyFor(ents, e, 64, 40); }
    e.circle = (e.circle ?? Math.random() * TAU) + 0.03;
    const c = e.anchor ?? (e.anchor = { x: e.x, y: e.y, z: e.z });
    e.flyVel = [Math.cos(e.circle) * 5 + (c.x - e.x) * 0.3, (c.y - e.y) * 0.5, Math.sin(e.circle) * 5 + (c.z - e.z) * 0.3];
    return;
  }
  e.anchor = { x: tg.x, y: tg.y + 11, z: tg.z };
  if (e.swoop > 0) {
    // Diving at them, until it bites, misses (passing below them) or gives up.
    e.swoop--;
    const dx = tg.x - e.x, dy = tg.y + 1 - e.y, dz = tg.z - e.z, len = Math.hypot(dx, dy, dz) || 1;
    e.flyVel = [(dx / len) * 12, (dy / len) * 12, (dz / len) * 12];
    if (len < 1.8 && e.attackCd === 0) {
      // A bite, as it sweeps past. (Coming down at their head, it's close enough to reach.)
      e.swoop = 0;
      meleeTick(ents, e, tg, 0.5, 0);
    } else if (e.y < tg.y + 0.3 || e.hitWall) e.swoop = 0;
    if (e.swoop === 0) { e.cool = 60 + Math.floor(Math.random() * 60); e.flyVel = [e.vx, 6, e.vz]; }
    return;
  }
  // Circling above, until it's time to swoop.
  e.circle = (e.circle ?? 0) + 0.04;
  const r = 9, cx = e.anchor.x + Math.cos(e.circle) * r, cz = e.anchor.z + Math.sin(e.circle) * r;
  e.flyVel = [(cx - e.x) * 1.2, (e.anchor.y - e.y) * 0.8, (cz - e.z) * 1.2];
  if ((e.cool = (e.cool ?? 40) - 1) <= 0) {
    e.swoop = 90;
    ents.game.audio.mob('phantom', 'swoop', { x: e.x, y: e.y, z: e.z });
  }
}

// Snow golems pelt any monster close by with snowballs (and never go for players).
function snowGolemTick(ents, e) {
  const w = ents.world, near = (o) => Math.hypot(o.x - e.x, o.y - e.y, o.z - e.z);
  let foe = e.target?.kind === 'mob' && !targetGone(e.target) && near(e.target) < 12 ? e.target : null;
  if (!foe && (e.targetCd = (e.targetCd ?? 0) - 1) <= 0) {
    e.targetCd = 10;
    foe = ents.list.find((o) => o.kind === 'mob' && o.def.hostile && !o.dead && !o.dying && near(o) < 10) ?? null;
  }
  e.target = foe; e.angry = 0;
  if (!foe) { e.speedMul = 0.8; wander(e, 0.5); return; }
  faceTowards(e, foe.x, foe.z);
  e.moving = false;
  if (e.attackCd > 0) return;
  const ex = e.x, ey = e.y + 1.6, ez = e.z, ty = foe.y + foe.h * 0.6;
  if (!clearLine(w, ex, ey, ez, foe.x, ty, foe.z)) { e.moving = true; return; }
  const [vx, vy, vz] = aimAt(ex, ey, ez, foe.x, ty, foe.z, 14);
  e.attackCd = 20; e.swing = 1;
  ents.spawnArrow(ex, ey, ez, vx, vy, vz, e, 0, false, { snowball: true });
  ents.game.audio.bow({ x: ex, y: ey, z: ez }, true);
}

function neutralTick(ents, e) {
  const t = e.def, game = ents.game;
  if (t.throwsSnow) return snowGolemTick(ents, e);
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
  // Iron golems keep the peace: they go for any monster close by.
  if (t.guards) {
    const foe = ents.list.find((o) => o.kind === 'mob' && o.def.hostile && !o.def.explodes && !o.dead && !o.dying && dist2(o, e) < 16 && Math.abs(o.y - e.y) < 6);
    if (foe) { e.angry = 200; e.target = foe; return; }
    if (e.home && dist2(e, e.home) > 18) { faceTowards(e, e.home.x, e.home.z); e.moving = true; e.speedMul = 0.8; return; }
  }
  e.target = null;
  e.speedMul = t.guards ? 0.6 : 1;
  wander(e, t.guards ? 0.7 : 0.4);
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
  // Golems someone built never turn on players.
  if (e.made && from && from.kind !== 'mob') return;
  // A pet doesn't turn on its owner (a wolf fights back against anyone else).
  if (e.owner) {
    if (!from || from.uid === e.owner || (!ents.game.net && from === ents.players[0])) return;
    e.sitting = false;
    if (t.defends) { e.target = from; e.angry = 200; return; }
  }
  if (t.kind === 'animal') { e.panic = 80; if (from) faceAway(e, from.x, from.z); e.love = 0; e.flyTarget = null; e.roost = false; }
  else if (t.kind === 'water') { e.panic = 60; ents.game.particles.smoke?.(e.x, e.y + 0.4, e.z, 4, 0.4); }
  else if (t.kind === 'neutral' && from && !from.creative) {
    e.angry = 400; e.target = from;
    if (t.pack) for (const o of ents.list) if (o !== e && o.type === e.type && !o.dead && !o.owner && dist2(o, e) < 16) { o.angry = 400; o.target = from; }
    if (t.teleports && Math.random() < 0.5) teleport(ents, e);
  } else if (t.kind === 'hostile' && from && (from.addr !== undefined || from.kind === 'mob')) {
    if (!from.creative) { e.target = from; e.angry = 200; }
  }
}

// What using item `id` on creature `e` would do: 'milk', 'shear', 'breed', 'grow', 'dye' or null.
// `who`: whether the creature is a pet of whoever's using it (mine), whether they hold its lead
// (holds), and the name on the item (name).
export function mobUseEffect(e, id, { mine = false, holds = false, name = null } = {}) {
  const t = e.def;
  if (e.dying) return null;
  // Leads: take yours off again (whatever's in hand), or put one on.
  if (e.leash && holds) return 'unleash';
  if (id && id === I.lead) return t.leashable && !e.leash ? 'leash' : null;
  // A name tag that's been named at an anvil names the creature.
  if (id && id === I.name_tag) return name && name !== e.named ? 'name' : null;
  // Taming: a wolf with a bone, a cat with fish, a parrot with seeds (it takes a few goes). A pet
  // of yours is fed to heal it (and to breed it, once it's well), its collar can be dyed, and
  // anything else tells it to sit, or to get up again.
  if (t.tameIds.size) {
    if (!e.tame) return id && t.tameIds.has(id) && !(e.angry > 0) ? 'tame' : null;
    if (!mine) return null;
    if (id && DYE_OF[id] !== undefined && t.rigDef.bones.collar) return DYE_OF[id] !== e.collar ? 'collar' : null;
    if (id && t.petFoodIds.has(id)) return e.baby ? 'grow' : e.health < e.maxHealth ? 'heal' : !t.flies && e.breedCd === 0 && e.love === 0 ? 'breed' : null;
    return 'sit';
  }
  if (!id) return null;
  if (t.rideable) {
    // Horses: saddled once tame; fed to heal and to warm to you; golden food to breed.
    if (id === I.saddle) return e.tame && !e.saddled && !e.baby ? 'saddle' : null;
    if (t.breedIds?.has(id) && e.tame && !e.baby && e.breedCd === 0 && e.love === 0) return 'breed';
    if (t.foodIds.has(id)) return e.baby ? 'grow' : e.health < e.maxHealth || !e.tame ? 'feed' : null;
    return null;
  }
  if (t.milk && id === I.bucket && !e.baby) return 'milk';
  if (t.wool && id === I.shears && !e.sheared && !e.baby) return 'shear';
  if (t.foodIds.has(id)) return e.baby ? 'grow' : e.breedCd === 0 && e.love === 0 ? 'breed' : null;
  if (t.wool && !e.sheared && DYE_OF[id] !== undefined && DYE_OF[id] !== e.colour) return 'dye';
  return null;
}
// The creature's side of it (on the host). `uid`: who's using it; `name`: the name on the item.
export function applyMobUse(ents, e, id, effect, uid = null, name = null) {
  const game = ents.game, at = { x: e.x, y: e.y + 1, z: e.z };
  switch (effect) {
    case 'leash': e.leash = { uid }; e.sitting = false; game.audio.equip('leather'); game.net?.resend?.(e); break;
    case 'unleash': e.leash = null; ents.spawnItem(e.x, e.y + e.h * 0.6, e.z, I.lead, 1); game.net?.resend?.(e); break;
    case 'name': e.named = name; game.net?.resend?.(e); break;
    case 'tame':
      if (Math.random() < 1 / 3) {
        // (A village cat that's taken in is no longer the village's.)
        e.tame = true; e.owner = uid; e.angry = 0; e.target = null; e.panic = 0; e.pinned = null; e.home = null;
        // (Wolves and parrots sit down to wait for their new owner.)
        e.sitting = e.type !== 'cat';
        if (e.def.tameHealth) { e.maxHealth = e.def.tameHealth; e.health = e.maxHealth; }
        loveHearts(game, e, 7);
        game.audio.mob(e.def.sound, 'say', at);
        game.net?.resend?.(e);
      } else game.particles.smoke(e.x, e.y + e.h + 0.2, e.z, 5, 0.3);
      break;
    case 'sit': e.sitting = !e.sitting; e.target = null; e.moving = false; e.vx = e.vz = 0; break;
    case 'heal':
      e.health = Math.min(e.maxHealth ?? e.health, e.health + 4);
      loveHearts(game, e, 3);
      break;
    case 'collar': e.collar = DYE_OF[id] ?? e.collar; game.net?.resend?.(e); break;
    case 'milk': game.audio.bucket('fill', at); break;
    case 'shear': {
      e.sheared = true;
      const n = 1 + Math.floor(Math.random() * 3);
      for (let k = 0; k < n; k++) ents.spawnItem(e.x, e.y + 1, e.z, woolBlock(e.colour), 1);
      game.audio.shear?.(at);
      break;
    }
    case 'breed': e.love = 600; loveHearts(game, e, 7); break;
    case 'grow': e.grow = Math.max(0, e.grow - 2400); game.particles.icons(TEX.happy, e.x, e.y + e.h * 0.5, e.z, 5, e.hw + 0.1); break;
    case 'dye': e.colour = DYE_OF[id]; break;
    case 'saddle': e.saddled = true; game.audio.equip('leather'); break;
    case 'feed':
      e.health = Math.min(e.maxHealth ?? e.health, e.health + (id === I.wheat ? 2 : 4));
      if (!e.tame) e.temper = Math.min(100, (e.temper ?? 0) + (id === I.golden_apple || id === I.golden_carrot ? 10 : 3));
      game.particles.icons(TEX.happy, e.x, e.y + e.h * 0.5, e.z, 5, e.hw + 0.1);
      game.audio.mob('horse', 'eat', at);
      break;
    default:
  }
}
// The player's side: what happens to what they're holding.
export function applyHeldUse(game, effect) {
  if (effect === 'sit' || effect === 'unleash') { game.swingArm(); return; }
  if (effect === 'milk') game.swapHeldTo(I.milk_bucket);
  else if (effect === 'shear') { if (!game.creative && game.inv.damageHeld(1)) game.audio.toolBreak(); game.invChanged(); }
  else if (!game.creative) { game.inv.consumeHeld(); game.invChanged(); }
  game.swingArm();
}
const DYE_OF = Object.fromEntries(DYES.map((dd, i) => [I[`${dd.name}_dye`], i]).filter(([id]) => id !== undefined));

// What a creature leaves behind when it dies.
export function mobDrops(e) {
  const out = [];
  // (Its lead falls off, if it had one on.)
  if (e.leash) out.push([I.lead, 1]);
  if (e.baby) return out;
  // (Looting on the weapon that killed it: up to that many more of each.)
  const extra = e.looting ?? 0;
  for (const [id, lo, hi, chance] of e.def.drops) {
    if (Math.random() > (chance ?? 1) + extra * 0.01) continue;
    const n = lo + Math.floor(Math.random() * (hi - lo + 1)) + Math.floor(Math.random() * (extra + 1));
    if (n > 0) out.push([id, n]);
  }
  if (e.def.wool && !e.sheared) out.push([woolBlock(e.colour), 1]);
  if (e.saddled) out.push([I.saddle, 1]);
  if (e.def.sized && e.size > 1) return [];
  return out;
}

// The experience a creature is worth when a player kills it.
export function mobXp(e) {
  const t = e.def;
  if (e.baby || t.kind === 'civilian') return 0;
  if (t.xp !== undefined) return t.xp;
  if (t.sized) return e.size;
  if (t.hostile) return 5;
  return 1 + Math.floor(Math.random() * 3);
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
  if (t.flies && (e.flyVel || e.roost || t.flies !== 'parrot')) { flyPhysics(ents, e, dt); return; }
  // Seated on a throne: held in place.
  if (e.sitting && e.restAt && t.kind === 'civilian') { [e.x, e.y, e.z] = e.restAt; e.vx = e.vy = e.vz = 0; e.onGround = true; e.walk = 0; return; }
  // A saddled horse goes where its rider steers.
  if (e.rider && t.rideable) horseDrive(e, e.drive, dt);
  let speed = e.moving ? t.speed * (e.speedMul || 1) * (e.baby ? 1.3 : 1) * (e.slowed > 0 ? 0.5 : 1) : 0;
  const dir = e.yaw + (e.rider ? e.rideDir ?? 0 : 0);
  const fx = -Math.sin(dir), fz = -Math.cos(dir);
  // Animals won't walk off a cliff or into water on their own.
  if (speed && !t.hostile && t.kind !== 'water' && t.kind !== 'civilian' && !t.swimmer && e.onGround && !e.panic && !e.rider) {
    const ax = Math.floor(e.x + fx * (e.hw + 0.4)), az = Math.floor(e.z + fz * (e.hw + 0.4)), y = Math.floor(e.y + 0.1);
    const ahead = w.getBlock(ax, y - 1, az), ahead2 = w.getBlock(ax, y - 2, az);
    if ((!SOLID[ahead] && !SOLID[ahead2]) || WATERLIKE[ahead] || WATERLIKE[w.getBlock(ax, y, az)]) {
      e.yaw += Math.PI * (0.5 + Math.random());
      speed = 0;
    }
  }
  if (t.kind === 'water') {
    const k = 1 - Math.exp(-3 * dt);
    // (Leaping dolphins keep going up out of the water until gravity brings them back.)
    e.leap = Math.max(0, (e.leap ?? 0) - dt);
    if (fluid === 1 && !e.leap) {
      e.vx += (fx * speed - e.vx) * k; e.vz += (fz * speed - e.vz) * k;
      e.vy += (((e.swimY ?? 0) * (e.moving ? 1 : 0.2)) - e.vy) * k;
      // Stay under the surface.
      if (WATERLIKE[w.getBlock(Math.floor(e.x), Math.floor(e.y + e.h + 0.2), Math.floor(e.z))] !== 1) e.vy = Math.min(e.vy, -0.3);
    } else { e.vy -= 32 * dt; e.vx *= Math.exp(-2 * dt); e.vz *= Math.exp(-2 * dt); }
    e.move(w, e.vx * dt, e.vy * dt, e.vz * dt);
    const moved = Math.hypot(e.vx, e.vz);
    e.walk += (Math.min(1, moved / 1.5) - e.walk) * Math.min(1, dt * 8);
    e.walkPhase += (moved + 0.5) * dt * 4;
    e.tilt = (e.tilt ?? 0) + (clamp(Math.atan2(e.vy, Math.max(moved, 1)), -1, 1) - (e.tilt ?? 0)) * Math.min(1, dt * 5);
    return;
  }
  const swimming = fluid === 1 && (t.swims || t.swimmer);
  const k = 1 - Math.exp(-(e.onGround ? 10 : t.sized ? 0.5 : swimming ? 6 : 2) * dt);
  if (!t.sized || e.onGround) { e.vx += (fx * speed - e.vx) * k; e.vz += (fz * speed - e.vz) * k; }
  if (swimming && t.swims) {
    // The drowned swim up or down to whatever they're after, and sink to the bottom otherwise.
    const want = e.target ? clamp((e.target.y - e.y) * 1.5, -2.5, 2.5) : -1.5;
    e.vy += (want - e.vy) * Math.min(1, dt * 3);
  } else if (swimming) {
    // Turtles paddle about under the surface.
    e.vy += ((e.swimY ?? 0) * (e.moving ? 1 : 0.3) - e.vy) * Math.min(1, dt * 3);
    if (!WATERLIKE[w.getBlock(Math.floor(e.x), Math.floor(e.y + e.h + 0.3), Math.floor(e.z))]) e.vy = Math.min(e.vy, 0);
  } else if (fluid) {
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
  if (e.leash && !ents.guest) leashPull(ents, e, dt);
  e.move(w, e.vx * dt, e.vy * dt, e.vz * dt);
  if (e.hitWall && speed) {
    if (t.climbs) e.vy = Math.max(e.vy, 3.5);
    // (In water too: that's how anything swimming gets back up onto the bank.)
    else if (e.onGround || wasGround || fluid) e.vy = t.hops ? 7.5 : t.leaps ? 9.5 : 8.6;
  }
  // Rabbits move in hops.
  if (t.hops && speed && e.onGround) e.vy = 5.5;
  if (t.sized && e.onGround && !wasGround && vyBefore < -2) {
    e.squish = -0.6;
    e.vx *= 0.3; e.vz *= 0.3;
    ents.game.audio.mob('slime', 'hurt', { x: e.x, y: e.y, z: e.z }, 1.6 - e.size * 0.2);
  }
  e.squish *= Math.exp(-dt * 6);
  if (e.tilt) e.tilt *= Math.exp(-dt * 8);
  const moved = Math.hypot(e.vx, e.vz);
  e.walk += (Math.min(1, moved / 1.5) - e.walk) * Math.min(1, dt * 8);
  e.walkPhase += moved * dt * (e.baby ? 7 : 5);
  e.swing = Math.max(0, e.swing - dt * 3);
}

// Flying: no gravity; the velocity eases towards what the creature wants (`flyVel`), and it turns
// to face the way it's going, pitching up or down with it. Roosting bats hang still.
function flyPhysics(ents, e, dt) {
  const t = e.def;
  e.flap += dt * (t.flies === 'bat' ? 32 : t.flies === 'parrot' ? 26 : 5);
  e.swing = Math.max(0, e.swing - dt * 3);
  if (e.roost) { e.vx = e.vy = e.vz = 0; e.walk = 0; e.tilt = 0; return; }
  // (A phantom turns slowly as it circles, but homes in hard once it dives.)
  const v = e.flyVel ?? [0, -0.5, 0], k = 1 - Math.exp(-(t.flies === 'phantom' ? (e.swoop > 0 ? 6 : 2.2) : 4) * dt);
  e.vx += (v[0] - e.vx) * k; e.vy += (v[1] - e.vy) * k; e.vz += (v[2] - e.vz) * k;
  e.move(ents.world, e.vx * dt, e.vy * dt, e.vz * dt);
  const hs = Math.hypot(e.vx, e.vz);
  if (hs > 0.2) e.yaw += wrap(Math.atan2(-e.vx, -e.vz) - e.yaw) * Math.min(1, dt * 8);
  e.tilt = (e.tilt ?? 0) + (clamp(Math.atan2(e.vy, Math.max(hs, 0.5)), -1.2, 1.2) - (e.tilt ?? 0)) * Math.min(1, dt * 5);
  e.walk = Math.min(1, hs / 2);
  e.walkPhase += hs * dt * 4;
}

// ---------------------------------------------------------------- how they move their limbs
// Rotations [x, y, z] for the bones of creature `e` this frame. (A positive x turn swings a
// hanging limb forwards and tips a part that points forwards upwards; a positive z turn swings a
// hanging limb out to the creature's right, +x.)
export function poseMob(e, pose) {
  const t = e.def, a = Math.sin(e.walkPhase) * 0.9 * e.walk, age = e.age;
  const head = [e.headPitch, e.headYaw, 0];
  switch (t.anim) {
    case 'quad': {
      pose.head = head;
      pose.legFR = [a, 0, 0]; pose.legBL = [a, 0, 0]; pose.legFL = [-a, 0, 0]; pose.legBR = [-a, 0, 0];
      pose.tail = [Math.sin(age * (e.angry ? 12 : 4)) * 0.1, Math.sin(age * 3) * (e.angry ? 0.5 : 0.25), 0];
      // Grazing: the head goes down to the grass.
      if (e.graze > 0) { pose.head = [-0.9, 0, 0]; pose['head@'] = [0, -5.8, -5.7]; }
      // Sitting (the whole body is tipped back on its haunches; see renderMob): front legs
      // straight down, back legs folded forwards along the ground, head level, tail on the ground.
      const sit = e.sitting && sitPose(t.rig);
      if (sit) {
        pose.legFR = pose.legFL = [-sit.theta, 0, 0];
        pose.legBR = pose.legBL = [Math.PI / 2 - sit.theta, 0, 0];
        pose.head = [head[0] - sit.theta, head[1], 0];
        pose.tail = [sit.theta * 0.8, Math.sin(age * 2) * 0.1, 0];
      }
      break;
    }
    case 'horse': {
      // A slower stride than the other four-legged animals (their legs are long), the head nodding
      // along, and the tail swishing (streaming out behind at a gallop).
      const g = Math.sin(e.walkPhase * 0.45) * 0.9 * e.walk;
      pose.head = [head[0] * 0.6 + Math.sin(e.walkPhase * 0.9) * 0.06 * e.walk, head[1] * 0.6, 0];
      pose.legFR = [g, 0, 0]; pose.legBL = [g, 0, 0]; pose.legFL = [-g, 0, 0]; pose.legBR = [-g, 0, 0];
      pose.tail = [Math.sin(age * 1.9) * 0.08 - e.walk * 0.6, Math.sin(age * 3.1) * 0.22 * (1 - e.walk * 0.7), 0];
      break;
    }
    case 'chicken': {
      pose.head = head;
      pose.legR = [a, 0, 0]; pose.legL = [-a, 0, 0];
      const f = (Math.sin(e.flap) * 0.5 + 0.5) * (e.flap ? 1.2 : 0);
      pose.wingR = [0, 0, f]; pose.wingL = [0, 0, -f];
      break;
    }
    case 'rabbit': {
      pose.head = head;
      // In the air: hind legs kicked back, front paws reaching forward, nose up.
      const hop = e.onGround ? 0 : 0.9;
      pose.hindR = [-hop, 0, 0]; pose.hindL = [-hop, 0, 0]; pose.frontR = [hop * 0.6, 0, 0]; pose.frontL = [hop * 0.6, 0, 0];
      pose.body = [hop * 0.15, 0, 0];
      break;
    }
    case 'zombie': case 'humanoid': case 'archer': case 'enderman': case 'witch': {
      const k = t.anim === 'enderman' ? 0.4 : 1;
      pose.head = head;
      pose.rightLeg = [a * k, 0, 0]; pose.leftLeg = [-a * k, 0, 0];
      pose.rightArm = [-a * k * 0.8, 0, 0.05]; pose.leftArm = [a * k * 0.8, 0, -0.05];
      if (t.anim === 'zombie') {
        // Arms out in front, lifting a little more to strike.
        const lift = 1.45 + Math.sin(age * 1.3) * 0.05 + e.swing * 0.4;
        pose.rightArm = [lift, 0, 0.1]; pose.leftArm = [lift, 0, -0.1];
      } else if (t.anim === 'archer' && (e.target || e.aim > 0)) {
        // Bow drawn: the bow arm straight at the target, the other pulling back the string.
        pose.rightArm = [Math.PI / 2 + head[0], head[1] + 0.1, 0];
        pose.leftArm = [Math.PI / 2 + head[0], head[1] - 0.5, 0];
      } else if (t.anim === 'enderman' && e.angry) {
        pose.head = [head[0], head[1] + Math.sin(age * 40) * 0.05, 0];
        pose['head@'] = [0, 2, 0];
      } else if (t.anim === 'witch' && e.drinking > 0) {
        // A potion to the lips.
        pose.rightArm = [2.1, 0.5, 0];
        pose.head = [0.35, 0, 0];
      }
      // Holding something, the arm comes forward a little and swings half as far (as in Minecraft).
      else if ((e.held ?? t.held) && t.rigDef.hand) pose.rightArm = [pose.rightArm[0] * 0.5 + 0.31, 0, 0.05];
      // Seated (a king on his throne): legs out in front, a little apart, hands on the arms.
      if (e.sitting && t.anim === 'humanoid') {
        pose.rightLeg = [1.41, 0.31, 0]; pose.leftLeg = [1.41, -0.31, 0];
        pose.rightArm = [0.55, 0, 0.12]; pose.leftArm = [0.55, 0, -0.12];
      }
      if (e.swing > 0 && t.anim !== 'zombie') pose.rightArm = [1.8 * Math.sin(e.swing * Math.PI), 0, 0.2];
      break;
    }
    case 'golem': {
      // A slow, heavy stride with the long arms swinging; both arms heave up and forward to strike.
      const g = Math.sin(e.walkPhase * 0.6) * 0.7 * e.walk;
      pose.head = [head[0] * 0.5, head[1] * 0.8, 0];
      pose.rightLeg = [g, 0, 0]; pose.leftLeg = [-g, 0, 0];
      pose.rightArm = [-g * 0.9, 0, 0.04]; pose.leftArm = [g * 0.9, 0, -0.04];
      if (e.swing > 0) { const s = 2.1 * Math.sin(e.swing * Math.PI); pose.rightArm = [s, 0, 0.04]; pose.leftArm = [s, 0, -0.04]; }
      break;
    }
    case 'turtle': {
      pose.head = [head[0] * 0.5, head[1] * 0.6, 0];
      if (e.inWater) {
        // Swimming: the front flippers sweep together in long strokes, the back ones kick.
        const s = Math.sin(e.walkPhase * 0.8) * (0.3 + e.walk * 0.7);
        pose.legFR = [0, s * 0.7, s * 0.35]; pose.legFL = [0, -s * 0.7, -s * 0.35];
        pose.legBR = [s * 0.4, 0, 0]; pose.legBL = [s * 0.4, 0, 0];
      } else {
        // Waddling ashore: the flippers take turns.
        const w = Math.sin(e.walkPhase * 1.3) * 0.5 * e.walk;
        pose.legFR = [0, w, 0]; pose.legFL = [0, w, 0]; pose.legBR = [w * 0.6, 0, 0]; pose.legBL = [-w * 0.6, 0, 0];
      }
      break;
    }
    case 'parrot': {
      pose.head = head;
      if (!e.onGround || t.flies && e.flyVel) {
        // Flying: wings beating, feet tucked back.
        const f = (Math.sin(e.flap) * 0.5 + 0.5) * 1.3 + 0.1;
        pose.wingR = [0, 0, f]; pose.wingL = [0, 0, -f];
        pose.legR = [-0.8, 0, 0]; pose.legL = [-0.8, 0, 0];
        pose.tail = [-0.2, 0, 0];
      } else {
        pose.legR = [a, 0, 0]; pose.legL = [-a, 0, 0];
        pose.tail = [Math.sin(age * 2) * 0.05, 0, 0];
      }
      break;
    }
    case 'bat': {
      if (e.roost) {
        // Hanging: wings wrapped round.
        pose.wingR = [0, 0.9, -1.25]; pose.wingL = [0, -0.9, 1.25];
        pose.head = [0, head[1] * 0.5, 0];
      } else {
        const f = Math.sin(e.flap) * 0.95;
        pose.wingR = [0, 0, f]; pose.wingL = [0, 0, -f];
        pose.head = [0.4, 0, 0];
      }
      break;
    }
    case 'phantom': {
      const f = Math.sin(e.flap) * 0.4;
      pose.wingR = [0, 0, f]; pose.wingL = [0, 0, -f];
      pose.tail = [Math.sin(e.flap + 1.2) * 0.2, 0, 0];
      break;
    }
    case 'dolphin': {
      // Up-and-down beats of the tail (unlike a fish's side-to-side), flippers steady.
      const s = Math.sin(e.walkPhase * 1.4) * (0.15 + e.walk * 0.25);
      pose.tail = [s, 0, 0];
      pose.head = [-s * 0.3, 0, 0];
      pose.finR = [0, 0, Math.sin(e.walkPhase * 1.4 + 1) * 0.1]; pose.finL = [0, 0, -Math.sin(e.walkPhase * 1.4 + 1) * 0.1];
      break;
    }
    case 'snow_golem': {
      // It slides along, wobbling a little; an arm flicks forward to throw.
      pose.head = head;
      pose.body = [0, Math.sin(e.walkPhase * 0.5) * 0.08 * e.walk, 0];
      const flick = e.swing > 0 ? Math.sin(e.swing * Math.PI) * 0.7 : 0;
      pose.rightArm = [flick, 0, Math.sin(age * 1.7) * 0.04]; pose.leftArm = [0, 0, -Math.sin(age * 1.7) * 0.04];
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
      // The arms spread out and close again as it pulses along.
      const s = (Math.sin(age * 2.2) * 0.5 + 0.5) * 0.9 + 0.1;
      for (let i = 0; i < 8; i++) {
        const ang = RIGS.squid.bones[`arm${i}`].arm;
        pose[`arm${i}`] = [-Math.sin(ang) * s * 0.9, 0, Math.cos(ang) * s * 0.9];
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
// How a four-legged creature sits: tipped back about its hips (the back legs' pivot) until its
// front legs just reach the ground with the hips lowered almost to it.
const sits = new Map();
function sitPose(rigName) {
  if (sits.has(rigName)) return sits.get(rigName);
  const b = RIGS[rigName].bones, hind = b.legBR?.pivot, front = b.legFR?.pivot;
  let out = null;
  if (hind && front && hind[2] > front[2]) {
    const drop = hind[1] - 1.5;
    out = { hipY: hind[1], hipZ: hind[2], drop, theta: Math.asin(Math.min(0.95, drop / (hind[2] - front[2]))) };
  }
  sits.set(rigName, out);
  return out;
}
// Adds creature `e` to the render list `out` (camera-relative position rx, ry, rz).
export function renderMob(ents, e, rx, ry, rz, light, out) {
  const t = e.def, r = ents.game.renderer;
  const v = Math.max(0, e.variant | 0), n = t.skins.length;
  const skins = { ...t.extraSkins, main: t.skins[Math.min(t.markings ? v % n : v, n - 1)] };
  const marks = t.markings?.[Math.floor(v / n) - 1];
  if (marks) skins.markings = marks;
  if (t.wool) skins.wool = t.wool;
  if (t.type === 'wolf' && e.angry > 0) skins.main = 'wolf_angry';
  if (t.kind === 'civilian') skins.main = e.skin;
  const pet = !!e.owner || (e.tame && t.tameIds.size > 0);
  const tint = t.wool ? woolTint(e.colour) : pet && t.rigDef.bones.collar ? woolTint(e.collar ?? RED) : null;
  const meshes = rigMeshes(r, t.rig, skins, tint);
  const base = identity(baseMat);
  translate(base, base, rx, ry, rz);
  rotateY(base, base, e.yaw);
  if (e.dying) rotateZ(base, base, Math.min(1, Math.sqrt(e.dying * 1.6)) * Math.PI / 2);
  if (e.pose === 'sleep') { translate(base, base, 0, 0.3, 0); rotateX(base, base, -Math.PI / 2); translate(base, base, 0, -0.1, -0.9); }
  // (Seated, the hips come down onto the seat.)
  if (e.sitting && t.anim === 'humanoid') translate(base, base, 0, -0.6, 0);
  let s = (t.scale ?? 1) * (e.baby ? 0.5 : 1);
  if (t.sized) s *= e.size;
  // Flyers (and dolphins) pitch up and down with where they're heading; bats fly leaning
  // forwards and roost hanging upside down.
  if (e.roost) { translate(base, base, 0, e.h, 0); rotateZ(base, base, Math.PI); }
  else if (t.flies || t.anim === 'dolphin') {
    const pitch = (e.tilt ?? 0) - (t.anim === 'bat' ? 0.7 : t.anim === 'parrot' && !e.onGround ? 0.35 : 0);
    if (pitch) { translate(base, base, 0, e.h * 0.5, 0); rotateX(base, base, pitch); translate(base, base, 0, -e.h * 0.5, 0); }
  }
  if (t.anim === 'squid') { translate(base, base, 0, e.h * 0.5, 0); rotateX(base, base, Math.min(0.6, Math.hypot(e.vx, e.vz) * 0.3)); translate(base, base, 0, -e.h * 0.5, 0); }
  if (t.sized) {
    const q = e.squish;
    scale(base, base, s * (1 - q * 0.25), s * (1 + q * 0.5), s * (1 - q * 0.25));
  } else if (t.explodes && e.fuse > 0) {
    const f = Math.min(1, e.fuse / 30), swell = 1 + f * 0.25 + Math.sin(f * 60) * f * 0.03;
    scale(base, base, s * swell, s * (1 + f * 0.1), s * swell);
  } else if (s !== 1) scale(base, base, s, s, s);
  const sit = e.sitting && t.anim === 'quad' && sitPose(t.rig);
  if (sit) {
    translate(base, base, 0, (sit.hipY - sit.drop) / 16, sit.hipZ / 16);
    rotateX(base, base, sit.theta);
    translate(base, base, 0, -sit.hipY / 16, -sit.hipZ / 16);
  }
  const pose = {};
  poseMob(e, pose);
  const parts = [];
  for (const m of meshes) {
    if ((m.bone.wool && e.sheared) || (m.bone.saddle && !e.saddled) || (m.bone.collar && !pet) || (m.bone.markings && !marks) ||
      (m.bone.ridden && !(e.rider || e.ridden))) continue;
    parts.push({ mesh: m.mesh, model: boneMatrix(ents.mat(), base, m.bone, pose, m.name, t.rigDef.bones) });
  }
  // What it holds: attached to the hand of the arm bone.
  const held = e.held ?? (e.drinking ? I.potion_healing ?? null : null) ?? (t.held ? I[t.held] : null);
  const hand = t.rigDef.hand;
  if (held && hand) {
    const mesh = r.itemMesh(held);
    const armBone = t.rigDef.bones[hand.bone];
    if (mesh && armBone) {
      const m = boneMatrix(ents.mat(), base, armBone, pose, hand.bone, t.rigDef.bones);
      translate(m, m, 8 + (hand.at[0] - armBone.pivot[0]) / 16, 8 + (hand.at[1] - armBone.pivot[1]) / 16, 8 + (hand.at[2] - armBone.pivot[2]) / 16);
      holdItem(m, held, mesh.kind);
      parts.push({ mesh, model: m });
    }
  }
  const flash = t.explodes && e.fuse > 0 && Math.floor(e.fuse / 3) % 2 === 0;
  out.push({ parts, light, tint: flash ? [2, 2, 2] : null, hurt: e.hurt > 0 || e.dying > 0 });
}
// Places an item in a fist. `m` is at the hand, in the arm's frame (y up the arm, -z forward, +x
// the creature's right); an item's sprite spans 0-1 in x and y (plus MODEL_OFFSET). A tool's
// sprite runs from its handle (bottom left) to its head (top right): it's held by the handle,
// standing in the arm's plane of swing with that diagonal pointing forward and up (Minecraft's
// third-person hold). A bow stands upright across the hand with its string towards the holder;
// anything else is held small and upright in front of the fist.
const HANDHELD = /_(sword|pickaxe|axe|shovel|hoe)$|^(stick|bone|fishing_rod|fishing_rod_cast)$/;
const HOLD_TILT = 0.45; // how far above straight ahead the tool points (before the arm's own lift)
function holdItem(m, id, kind) {
  const name = ITEMS.get(id)?.name ?? '';
  if (kind === 'sprite' && name === 'bow') {
    rotateX(m, m, (5 * Math.PI) / 4);
    rotateY(m, m, -Math.PI / 2);
    scale(m, m, 0.8, 0.8, 0.8);
    translate(m, m, -0.34 - 8, -0.66 - 8, -0.5 - 8);
  } else if (kind === 'sprite' && HANDHELD.test(name)) {
    rotateX(m, m, HOLD_TILT - Math.PI / 4);
    rotateY(m, m, Math.PI / 2);
    scale(m, m, 0.8, 0.8, 0.8);
    translate(m, m, -0.16 - 8, -0.16 - 8, -0.5 - 8);
  } else if (kind === 'sprite') {
    translate(m, m, 0, 0, -2 / 16);
    rotateY(m, m, Math.PI / 2);
    scale(m, m, 0.55, 0.55, 0.55);
    translate(m, m, -0.5 - 8, -0.3 - 8, -0.5 - 8);
  } else {
    translate(m, m, 0, 0, -2 / 16);
    scale(m, m, 0.3, 0.3, 0.3);
    translate(m, m, -0.5 - 8, -0.5 - 8, -0.5 - 8);
  }
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
  plains: [['pig', 10, 3], ['cow', 8, 3], ['sheep', 12, 4], ['chicken', 10, 3], ['rabbit', 3, 2], ['horse', 5, 3], ['donkey', 2, 1]],
  forest: [['pig', 8, 3], ['cow', 6, 3], ['sheep', 8, 4], ['chicken', 8, 3], ['wolf', 3, 3], ['fox', 3, 2], ['rabbit', 3, 2]],
  taiga: [['wolf', 6, 4], ['rabbit', 6, 3], ['fox', 6, 2], ['sheep', 6, 3], ['pig', 3, 3]],
  snowy: [['rabbit', 10, 3], ['polar_bear', 3, 2], ['fox', 4, 2]],
  desert: [['rabbit', 8, 2]],
  savanna: [['cow', 8, 3], ['sheep', 8, 3], ['chicken', 6, 3], ['horse', 6, 3], ['donkey', 2, 1], ['llama', 4, 3]],
  jungle: [['chicken', 10, 3], ['pig', 6, 3], ['parrot', 10, 2]],
  peaks: [['goat', 10, 3], ['rabbit', 2, 2], ['llama', 4, 3]],
  beach: [['turtle', 10, 3]],
  meadow: [['sheep', 10, 4], ['rabbit', 6, 3], ['goat', 3, 2], ['cow', 4, 3]],
  cherry: [['pig', 6, 3], ['rabbit', 6, 2], ['sheep', 6, 3]],
  sea: [['squid', 8, 3], ['cod', 10, 4], ['dolphin', 2, 3]],
  warm_sea: [['dolphin', 6, 3], ['cod', 8, 4], ['squid', 4, 3]],
  cold_sea: [['squid', 6, 3], ['salmon', 10, 4]],
  river: [['salmon', 8, 3], ['cod', 4, 3], ['squid', 2, 2]],
};
const HERD_OF = {
  [BIOME.PLAINS]: 'plains', [BIOME.SUNFLOWER_PLAINS]: 'plains', [BIOME.FLAT]: 'plains', [BIOME.FOREST]: 'forest', [BIOME.FLOWER_FOREST]: 'forest',
  [BIOME.BIRCH_FOREST]: 'forest', [BIOME.OLD_GROWTH_BIRCH]: 'forest', [BIOME.DARK_FOREST]: 'forest', [BIOME.WINDSWEPT_FOREST]: 'forest',
  [BIOME.TAIGA]: 'taiga', [BIOME.OLD_GROWTH_TAIGA]: 'taiga', [BIOME.SNOWY_TAIGA]: 'snowy', [BIOME.SNOWY_PLAINS]: 'snowy', [BIOME.ICE_SPIKES]: 'snowy',
  [BIOME.SNOWY_SLOPES]: 'snowy', [BIOME.DESERT]: 'desert', [BIOME.BADLANDS]: 'desert', [BIOME.SAVANNA]: 'savanna', [BIOME.JUNGLE]: 'jungle',
  [BIOME.SPARSE_JUNGLE]: 'jungle', [BIOME.MOUNTAINS]: 'peaks', [BIOME.STONY_PEAKS]: 'peaks', [BIOME.JAGGED_PEAKS]: 'peaks', [BIOME.FROZEN_PEAKS]: 'peaks',
  [BIOME.MEADOW]: 'meadow', [BIOME.CHERRY_GROVE]: 'cherry', [BIOME.OCEAN]: 'sea', [BIOME.DEEP_OCEAN]: 'sea', [BIOME.WARM_OCEAN]: 'warm_sea',
  [BIOME.BEACH]: 'beach',
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
  const [type, , n] = row, water = MOBS[type].kind === 'water', flier = !!MOBS[type].flies;
  const out = [];
  const variant = type === 'rabbit' ? RABBIT_OF(biome) : 0;
  for (let i = 0; i < n + Math.floor(hash2(chunk.cx * 7, chunk.cz, 5) * 2); i++) {
    const lx = (lx0 + Math.floor((hash2(chunk.cx, i, chunk.cz) - 0.5) * 8)) & 15, lz = (lz0 + Math.floor((hash2(i, chunk.cz, chunk.cx) - 0.5) * 8)) & 15;
    for (let y = HEIGHT - 2; y > 1; y--) {
      const id = chunk.blocks[(y << 8) | (lz << 4) | lx];
      if (!id) continue;
      if (water ? WATERLIKE[id] === 1 : (id === B.grass_block || id === B.snowy_grass || id === B.sand || id === B.snow_block || id === B.podzol ||
        id === B.stone || id === B.coarse_dirt || id === B.snow || (flier && LEAVES_WOOD[id] !== undefined))) {
        const yy = water ? y - 1 - Math.floor(Math.random() * 2) : y + 1;
        if (water && WATERLIKE[chunk.blocks[(yy << 8) | (lz << 4) | lx]] !== 1) break;
        out.push({ type, x: chunk.cx * 16 + lx + 0.5, y: yy, z: chunk.cz * 16 + lz + 0.5,
          o: { variant: MOBS[type].variants ? Math.floor(Math.random() * (MOBS[type].variantCount ?? MOBS[type].skins.length)) : variant,
            colour: type === 'sheep' ? sheepColour(Math.random()) : 0, baby: Math.random() < 0.1 } });
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
  // Witches keep to the swamps (and turn up now and then elsewhere); cave spiders to the deeps.
  if (Math.random() < (biome === BIOME.SWAMP ? 0.15 : 0.02)) return { type: 'witch' };
  if (y < 32 && Math.random() < 0.12) return { type: 'cave_spider' };
  if (r < 30) return { type: dry ? 'husk' : 'zombie' };
  if (r < 58) return { type: cold ? 'stray' : 'skeleton' };
  if (r < 80) return { type: 'creeper' };
  if (r < 96) return { type: 'spider' };
  return { type: 'enderman' };
}
export const HOSTILE_TYPES = new Set(Object.values(MOBS).filter((m) => m.hostile).map((m) => m.type));
