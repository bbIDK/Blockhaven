// Devil Fruits (the One Piece mod): what each is, what it looks like, and its moves, as data (see
// docs/onepiece/devil-fruits.md for the research: the One Piece Wiki's pages on each fruit and its
// techniques, and how Blox Fruits, Grand Piece Online and Mine Mine no Mi play them). The moves are
// carried out by powers.js from a handful of kinds:
//   shot   - a projectile (speed, gravity, size; on hitting: damage, a blast of `radius`)
//   beam   - an instant line out to `range` (a stretched arm, a laser, a slash)
//   burst  - everything within `radius` of you
//   zone   - everything within `radius` of where you're looking (out to `range`)
//   dash   - you're thrown along your look (hitting what you pass)
//   buff   - effects on you for a time (Gear Second's speed)
//   fly    - flight for a time (Phoenix wings, riding smoke)
//   blink  - you're moved to where you're looking (light-speed travel)
//   swap   - you and the creature you're looking at change places (Shambles)
//   heal   - health back (the Phoenix's blue flames)
// `el`: what a hit does besides damage - fire (sets alight), ice (slows, freezes water), lightning
// (strikes), quake (throws back hard), dark (pulls in), smoke (blinds and slows), sand (withers),
// light, magma (sets alight, hotter), rubber, surgical, phoenix.
// Damage is in half-hearts as Minecraft's (an iron sword does 6); `cost` is energy (of 100);
// `cd` the cooldown in seconds; `at` the mastery a move unlocks at.

// The keys the moves are on (rebindable: see keys.js).
export const MOVE_KEYS = ['z', 'x', 'c', 'v', 'f'];
export const UNLOCK = { z: 1, x: 5, c: 15, v: 30, f: 1 };

export const FRUITS = {
  gomu: {
    name: 'Gomu Gomu no Mi', type: 'Paramecia', power: 'rubber', rarity: 3,
    look: { skin: '#8a3fb8', swirl: '#5b1f80', stem: '#3f7f2a' }, // a purple melon, swirled
    passive: 'Rubber body: no fall damage; lightning and blunt hits bounce off',
    moves: {
      z: { name: 'Gomu Gomu no Pistol', kind: 'beam', range: 14, dmg: 7, knock: 1.4, el: 'rubber', cost: 10, cd: 0.8 },
      x: { name: 'Gomu Gomu no Gatling', kind: 'beam', range: 12, dmg: 2.5, knock: 0.3, el: 'rubber', repeat: 10, every: 0.08, spread: 0.12, cost: 25, cd: 5 },
      c: { name: 'Gomu Gomu no Bazooka', kind: 'beam', range: 10, width: 1.6, dmg: 11, knock: 3.2, el: 'rubber', cost: 30, cd: 8 },
      v: { name: 'Gear Second', kind: 'buff', time: 25, effects: { speed: 2, strength: 2, haste: 2 }, steam: true, cost: 45, cd: 45 },
      f: { name: 'Gomu Gomu no Rocket', kind: 'dash', speed: 26, lift: 0.5, time: 0.45, dmg: 4, cost: 15, cd: 3 },
    },
  },
  mera: {
    name: 'Mera Mera no Mi', type: 'Logia', power: 'fire', rarity: 4,
    look: { skin: '#f08a1c', swirl: '#c4410e', stem: '#5b3a1a' }, // orange, in flame-shaped pieces
    passive: 'Body of fire: fire and lava don\'t burn you; ordinary blows pass through',
    moves: {
      z: { name: 'Hiken (Fire Fist)', kind: 'shot', speed: 34, size: 0.7, dmg: 8, radius: 2.5, el: 'fire', cost: 15, cd: 1.5 },
      x: { name: 'Higan (Fire Gun)', kind: 'shot', speed: 40, size: 0.25, dmg: 3, el: 'fire', count: 6, spread: 0.08, cost: 20, cd: 3 },
      c: { name: 'Enjomo (Flame Ring)', kind: 'burst', radius: 7, dmg: 7, knock: 0.6, el: 'fire', cost: 30, cd: 8 },
      v: { name: 'Dai Enkai: Entei', kind: 'shot', speed: 22, size: 2.4, dmg: 18, radius: 6, el: 'fire', from: 'above', cost: 55, cd: 30 },
      f: { name: 'Flame Dash', kind: 'dash', speed: 22, time: 0.35, dmg: 5, el: 'fire', cost: 12, cd: 3 },
    },
  },
  hie: {
    name: 'Hie Hie no Mi', type: 'Logia', power: 'ice', rarity: 4,
    look: { skin: '#9fd6f0', swirl: '#4f8fbf', stem: '#e8f6ff' },
    passive: 'Body of ice: ordinary blows pass through; the sea you touch freezes',
    moves: {
      z: { name: 'Ice Saber', kind: 'beam', range: 5, dmg: 9, knock: 0.5, el: 'ice', cost: 10, cd: 1 },
      x: { name: 'Partisan', kind: 'shot', speed: 38, size: 0.35, dmg: 6, el: 'ice', count: 3, spread: 0.1, cost: 20, cd: 3 },
      c: { name: 'Ice Time', kind: 'zone', range: 20, radius: 3.5, dmg: 6, el: 'ice', freeze: 5, cost: 30, cd: 10 },
      v: { name: 'Ice Age', kind: 'burst', radius: 14, dmg: 8, el: 'ice', freeze: 6, iceSea: true, cost: 55, cd: 35 },
      f: { name: 'Ice Ball Slide', kind: 'dash', speed: 20, time: 0.4, iceTrail: true, cost: 10, cd: 2.5 },
    },
  },
  goro: {
    name: 'Goro Goro no Mi', type: 'Logia', power: 'lightning', rarity: 5,
    look: { skin: '#f2c230', swirl: '#a87e10', stem: '#3a3a3a' }, // gold, with spark-like spikes
    passive: 'Body of lightning: lightning can\'t hurt you; ordinary blows pass through',
    moves: {
      z: { name: 'Vari (Discharge)', kind: 'burst', radius: 5, dmg: 7, el: 'lightning', cost: 15, cd: 2 },
      x: { name: 'Sango (Lightning Spear)', kind: 'beam', range: 28, dmg: 10, el: 'lightning', cost: 25, cd: 4 },
      c: { name: 'El Thor', kind: 'zone', range: 40, radius: 4, dmg: 16, el: 'lightning', strike: 1, cost: 35, cd: 10 },
      v: { name: 'Raigo (Thunder Cloud)', kind: 'zone', range: 30, radius: 10, dmg: 12, el: 'lightning', strike: 8, cost: 60, cd: 40 },
      f: { name: 'Lightning Travel', kind: 'blink', range: 22, cost: 15, cd: 3 },
    },
  },
  suna: {
    name: 'Suna Suna no Mi', type: 'Logia', power: 'sand', rarity: 4,
    look: { skin: '#d9b46a', swirl: '#9a7536', stem: '#6b8a3a' }, // a tan barrel cactus
    passive: 'Body of sand: ordinary blows pass through - unless you\'re wet',
    moves: {
      z: { name: 'Desert Spada', kind: 'beam', range: 16, dmg: 8, el: 'sand', ground: true, cost: 15, cd: 2 },
      x: { name: 'Sables (Sandstorm)', kind: 'zone', range: 20, radius: 4, dmg: 5, el: 'sand', lift: 1.2, ticks: 4, cost: 25, cd: 6 },
      c: { name: 'Ground Secco', kind: 'burst', radius: 7, dmg: 9, el: 'sand', cost: 35, cd: 12 },
      v: { name: 'Desert Girasole', kind: 'zone', range: 24, radius: 7, dmg: 12, el: 'sand', sink: true, cost: 55, cd: 35 },
      f: { name: 'Sand Glide', kind: 'dash', speed: 18, time: 0.5, cost: 10, cd: 2.5 },
    },
  },
  yami: {
    name: 'Yami Yami no Mi', type: 'Logia', power: 'darkness', rarity: 5,
    look: { skin: '#3b1f5c', swirl: '#140a24', stem: '#2a2a2a' }, // purple, in teardrop pieces
    passive: 'Darkness draws everything in - but you take more damage, and can\'t pass blows through you',
    moves: {
      z: { name: 'Kurouzu (Black Vortex)', kind: 'beam', range: 18, dmg: 4, el: 'dark', pull: true, cost: 12, cd: 2 },
      x: { name: 'Black Hole', kind: 'zone', range: 20, radius: 6, dmg: 6, el: 'dark', pull: true, ticks: 5, cost: 30, cd: 8 },
      c: { name: 'Liberation', kind: 'burst', radius: 8, dmg: 12, knock: 1.6, el: 'dark', cost: 35, cd: 12 },
      v: { name: 'Black World', kind: 'burst', radius: 16, dmg: 10, el: 'dark', pull: true, cost: 60, cd: 40 },
      f: { name: 'Dark Step', kind: 'dash', speed: 20, time: 0.35, cost: 10, cd: 2.5 },
    },
  },
  gura: {
    name: 'Gura Gura no Mi', type: 'Paramecia', power: 'quake', rarity: 5,
    look: { skin: '#5f9fd9', swirl: '#2f5f99', stem: '#3a2a1a' }, // blue, its lower half cracked
    passive: 'The air itself cracks at your blows',
    moves: {
      z: { name: 'Quake Punch', kind: 'beam', range: 8, width: 1.4, dmg: 10, knock: 3, el: 'quake', cost: 15, cd: 2 },
      x: { name: 'Kaishin (Sea Quake)', kind: 'beam', range: 22, width: 2.4, dmg: 12, knock: 3.5, el: 'quake', cost: 30, cd: 7 },
      c: { name: 'Shima Yurashi (Island Shaker)', kind: 'burst', radius: 12, dmg: 10, knock: 2.6, el: 'quake', cost: 40, cd: 15 },
      v: { name: 'Gekishin (Violent Quake)', kind: 'zone', range: 30, radius: 8, dmg: 22, knock: 4, el: 'quake', cost: 60, cd: 40 },
      f: { name: 'Quake Leap', kind: 'dash', speed: 14, lift: 1.4, time: 0.4, cost: 12, cd: 3 },
    },
  },
  pika: {
    name: 'Pika Pika no Mi', type: 'Logia', power: 'light', rarity: 5,
    look: { skin: '#fff2a8', swirl: '#e8c84a', stem: '#c8a020' },
    passive: 'Body of light: ordinary blows pass through',
    moves: {
      z: { name: 'Yasakani no Magatama', kind: 'shot', speed: 70, size: 0.2, dmg: 3, radius: 1.2, el: 'light', count: 8, spread: 0.12, cost: 20, cd: 3 },
      x: { name: 'Amaterasu', kind: 'beam', range: 40, dmg: 12, radius: 2.5, el: 'light', cost: 30, cd: 6 },
      c: { name: 'Ama no Murakumo (Light Sword)', kind: 'beam', range: 6, width: 1.2, dmg: 14, el: 'light', cost: 25, cd: 4 },
      v: { name: 'Yata no Kagami', kind: 'blink', range: 60, cost: 25, cd: 8 },
      f: { name: 'Flash', kind: 'burst', radius: 8, dmg: 2, el: 'light', blind: 4, cost: 15, cd: 6 },
    },
  },
  magu: {
    name: 'Magu Magu no Mi', type: 'Logia', power: 'magma', rarity: 5,
    look: { skin: '#b8321c', swirl: '#4a0f08', stem: '#2a1a12' },
    passive: 'Body of magma: fire and lava don\'t burn you; ordinary blows pass through',
    moves: {
      z: { name: 'Dai Funka (Great Eruption)', kind: 'shot', speed: 30, size: 0.9, dmg: 11, radius: 3, el: 'magma', cost: 20, cd: 2.5 },
      x: { name: 'Ryusei Kazan (Meteor Volcano)', kind: 'shot', speed: 24, size: 0.8, dmg: 8, radius: 2.5, el: 'magma', count: 8, from: 'above', scatter: 7, cost: 40, cd: 12 },
      c: { name: 'Inugami Guren', kind: 'beam', range: 10, width: 1.6, dmg: 14, el: 'magma', cost: 30, cd: 6 },
      v: { name: 'Meigo (Hell Hound)', kind: 'beam', range: 5, dmg: 26, el: 'magma', cost: 50, cd: 30 },
      f: { name: 'Magma Surge', kind: 'dash', speed: 18, time: 0.4, dmg: 6, el: 'magma', cost: 12, cd: 3 },
    },
  },
  moku: {
    name: 'Moku Moku no Mi', type: 'Logia', power: 'smoke', rarity: 3,
    look: { skin: '#c8c8c8', swirl: '#8a8a8a', stem: '#5a5a5a' }, // grey, in cloud-like pieces
    passive: 'Body of smoke: ordinary blows pass through',
    moves: {
      z: { name: 'White Snake', kind: 'beam', range: 16, dmg: 4, el: 'smoke', pull: true, cost: 10, cd: 1.5 },
      x: { name: 'White Out', kind: 'burst', radius: 8, dmg: 3, el: 'smoke', blind: 5, slow: 5, cost: 25, cd: 8 },
      c: { name: 'White Launcher', kind: 'dash', speed: 30, time: 0.45, dmg: 8, el: 'smoke', cost: 20, cd: 5 },
      v: { name: 'White Blow', kind: 'zone', range: 24, radius: 5, dmg: 10, knock: 1.2, el: 'smoke', cost: 40, cd: 20 },
      f: { name: 'Smoke Flight', kind: 'fly', time: 10, cost: 25, cd: 15 },
    },
  },
  ope: {
    name: 'Ope Ope no Mi', type: 'Paramecia', power: 'surgery', rarity: 5,
    look: { skin: '#d42a3a', swirl: '#7a0f1a', stem: '#3f6f2a' }, // red and heart-shaped
    passive: 'Within your ROOM, you can move and cut anything',
    moves: {
      z: { name: 'ROOM', kind: 'buff', time: 20, room: 16, cost: 20, cd: 25 },
      x: { name: 'Shambles', kind: 'swap', range: 24, cost: 15, cd: 3, needsRoom: true },
      c: { name: 'Amputate', kind: 'beam', range: 16, width: 1.2, dmg: 11, el: 'surgical', cost: 20, cd: 3, needsRoom: true },
      v: { name: 'Gamma Knife', kind: 'beam', range: 8, dmg: 24, el: 'surgical', cost: 50, cd: 30, needsRoom: true },
      f: { name: 'Takt', kind: 'zone', range: 20, radius: 5, dmg: 2, lift: 2.2, el: 'surgical', cost: 15, cd: 5, needsRoom: true },
    },
  },
  phoenix: {
    name: 'Tori Tori no Mi, Model: Phoenix', type: 'Mythical Zoan', power: 'phoenix', rarity: 5,
    look: { skin: '#3fa86a', swirl: '#1f6a40', stem: '#f0a020' }, // a green pineapple, flame-coloured leaves
    passive: 'Blue flames of resurrection: you heal over time',
    moves: {
      z: { name: 'Phoenix Kick', kind: 'dash', speed: 24, time: 0.35, dmg: 8, el: 'phoenix', cost: 12, cd: 2 },
      x: { name: 'Phoenix Brand', kind: 'shot', speed: 32, size: 0.8, dmg: 10, radius: 2.5, el: 'phoenix', cost: 20, cd: 4 },
      c: { name: 'Blue Flames of Rebirth', kind: 'heal', amount: 10, cost: 35, cd: 20 },
      v: { name: 'Hoo-in (Phoenix Seal)', kind: 'zone', range: 20, radius: 5, dmg: 16, knock: 2, el: 'phoenix', from: 'above', cost: 50, cd: 30 },
      f: { name: 'Phoenix Wings', kind: 'fly', time: 15, cost: 25, cd: 15 },
    },
  },
};
export const FRUIT_IDS = Object.keys(FRUITS);
// Logias let ordinary blows pass through them (Armament Haki and seastone, later, get through).
export const isLogia = (id) => FRUITS[id]?.type === 'Logia' && id !== 'yami';

// ---------------------------------------------------------------- mastery
// Mastery 1-100, from damage dealt with the fruit's moves: quick at first, slower later.
export const MAX_MASTERY = 100;
export const xpToNext = (level) => Math.round(30 + level * level * 0.8);
// What a move's damage is at a mastery (up to twice as strong at 100).
export const masteryScale = (level) => 1 + (Math.min(level, MAX_MASTERY) - 1) / 99;
// Whether a move is open yet.
export const unlocked = (key, level) => level >= UNLOCK[key];

// The power a player has (saved with them: see Game.saveWorld), `v` its format.
export const newPower = (fruit) => ({ v: 1, fruit, mastery: 1, xp: 0 });
// Adds mastery xp; returns how many levels were gained.
export function gainMastery(p, xp) {
  let up = 0;
  p.xp += xp;
  while (p.mastery < MAX_MASTERY && p.xp >= xpToNext(p.mastery)) { p.xp -= xpToNext(p.mastery); p.mastery++; up++; }
  if (p.mastery >= MAX_MASTERY) p.xp = 0;
  return up;
}

// Energy: 100, back at 9 a second (half that while flying).
export const MAX_ENERGY = 100;
export const ENERGY_REGEN = 9;
