// Advancements, as in Minecraft: goals to reach in three tabs - Blockhaven (the story of the game),
// Adventure and Husbandry - each a tree that opens up as you go (L, or Advancements in the game
// menu: see advscreen.js). Each is made by something you do: the game tells this module what
// happens (`event`), and a guest hears from the host what happened on the host's side of things
// (what they killed, bred and tamed: see Game.advance). One made pops up in the corner and is told
// in the chat; a challenge gives experience too. They're kept with the world (a guest's by the
// host, with the rest of theirs).
import { I, ITEMS, itemDef } from './items.js';
import { BIOME, BIOME_NAMES } from './biomes.js';
import { MOBS } from './mobs.js';
import { HEIGHT } from './config.js';
import { iconFor } from './icons.js';
import { addXp } from './enchanting.js';

// The tabs: their roots' titles, and the texture tiled behind each tree.
export const TABS = [
  { id: 'story', title: 'Blockhaven', bg: 'stone' },
  { id: 'adventure', title: 'Adventure', bg: 'red_sandstone_bottom' },
  { id: 'husbandry', title: 'Husbandry', bg: 'hay_block_side' },
];
// What each kind is called when it's made (in the corner, and in the chat), and the colour its
// name and description are shown in.
export const FRAMES = {
  task: { toast: 'Advancement Made!', verb: 'has made the advancement', colour: '#55ff55', head: '#ffff55' },
  goal: { toast: 'Goal Reached!', verb: 'has reached the goal', colour: '#55ff55', head: '#ffff55' },
  challenge: { toast: 'Challenge Complete!', verb: 'has completed the challenge', colour: '#d75fd7', head: '#ff88ff' },
};

// ---------------------------------------------------------------- what each asks for
const cap = (s) => s.split('_').map((w) => w[0].toUpperCase() + w.slice(1)).join(' ');
const has = (...names) => (held) => names.some((n) => held.has(I[n]));
const IRON_ARMOR = ['iron_helmet', 'iron_chestplate', 'iron_leggings', 'iron_boots'];
const DIAMOND_ARMOR = ['diamond_helmet', 'diamond_chestplate', 'diamond_leggings', 'diamond_boots'];
const FISH = new Set(['cod', 'salmon', 'tropical_fish', 'pufferfish']);
const WHALES = new Set(['humpback_whale', 'blue_whale']);
// Monsters Hunted: every monster there is out in the world.
const HUNTED = ['zombie', 'husk', 'skeleton', 'stray', 'creeper', 'spider', 'cave_spider', 'slime', 'witch', 'enderman', 'guardian',
  'elder_guardian'];
// Two by Two: every creature that has young (a mule comes of a horse and a donkey).
const BRED = ['pig', 'cow', 'sheep', 'chicken', 'rabbit', 'goat', 'wolf', 'cat', 'ocelot', 'horse', 'donkey', 'mule', 'llama', 'camel',
  'panda', 'bee', 'axolotl', 'frog', 'zebra', 'elephant', 'hippo', 'giraffe', 'deer', 'boar', 'penguin'];
// A Balanced Diet: everything there is to eat or drink that fills you up.
const FOODS = [...ITEMS.values()].filter((d) => d.food && !d.hidden).map((d) => d.name);
const TIERS = ['camp', 'hamlet', 'village', 'town', 'kingdom'];
const CATS = MOBS.cat.skins, FROGS = MOBS.frog.skins;
const mobLabel = (p) => MOBS[p]?.label ?? cap(p);
const kindLabel = (p) => cap(p.replace(/^[a-z]+_/, ''));

// Adventuring Time: every biome the world's land is made of. (Not the stony and frozen peaks, which
// hardly ever come up, nor biomes the generator that made this world doesn't know.)
const NEVER = new Set([BIOME.FLAT, BIOME.SNOWY_PEAKS, BIOME.STONY_SHORE, BIOME.STONY_PEAKS, BIOME.FROZEN_PEAKS]);
const SEAS6 = new Set([BIOME.LUKEWARM_OCEAN, BIOME.COLD_OCEAN, BIOME.DEEP_LUKEWARM_OCEAN, BIOME.DEEP_COLD_OCEAN, BIOME.DEEP_FROZEN_OCEAN]);
const GEN1 = [BIOME.OCEAN, BIOME.FROZEN_OCEAN, BIOME.RIVER, BIOME.BEACH, BIOME.PLAINS, BIOME.FOREST, BIOME.BIRCH_FOREST, BIOME.TAIGA,
  BIOME.SNOWY_TAIGA, BIOME.DESERT, BIOME.MOUNTAINS];
export function biomesToFind(gen) {
  const ids = gen <= 1 ? GEN1 : BIOME_NAMES.map((n, i) => i).filter((b) => !NEVER.has(b) && (gen >= 6 || !SEAS6.has(b)));
  return ids.map((b) => BIOME_NAMES[b]);
}

// Caves & Cliffs: a fall from the top of the world (off its highest blocks) that ends this near the
// bottom.
const BOTTOM = 10;

// Whether a death (its message) came of a creature: the Adventure tab opens with killing or being
// killed.
const BY_A_CREATURE = /slain by|shot by a|impaled by a|killed trying to hurt|blown up|struck by lightning|killed by magic/;
export const killedByCreature = (cause) => BY_A_CREATURE.test(String(cause ?? ''));

// Each advancement: where it hangs (its parent), its frame (task, goal or challenge), its icon,
// title and description, and what makes it - `on`: event -> test. A test gives true when the
// event makes it, or (for one with many parts, `parts`) the name of the part it makes, which
// `label` names on the screen. `xp`: the experience a challenge gives; `hidden`: not shown till
// it's made.
const LIST = [];
function A(id, parent, frame, icon, title, desc, on, extra = {}) {
  LIST.push({ id, tab: id.split('/')[0], parent: parent && `${id.split('/')[0]}/${parent}`, frame, icon, title, desc, on, ...extra });
}

// ---- Blockhaven: the story of the game
A('story/root', null, 'task', 'grass_block', 'Blockhaven', 'The heart and story of the game', { have: has('crafting_table') });
A('story/mine_stone', 'root', 'task', 'wooden_pickaxe', 'Stone Age', 'Mine Stone with your new Pickaxe', { have: has('cobblestone', 'cobbled_deepslate') });
A('story/upgrade_tools', 'mine_stone', 'task', 'stone_pickaxe', 'Getting an Upgrade', 'Construct a better Pickaxe', { have: has('stone_pickaxe') });
A('story/smelt_iron', 'upgrade_tools', 'task', 'iron_ingot', 'Acquire Hardware', 'Smelt an Iron Ingot', { have: has('iron_ingot') });
A('story/obtain_armor', 'smelt_iron', 'task', 'iron_chestplate', 'Suit Up', 'Protect yourself with a piece of iron armor', { have: has(...IRON_ARMOR) });
A('story/lava_bucket', 'smelt_iron', 'task', 'lava_bucket', 'Hot Stuff', 'Fill a Bucket with lava', { have: has('lava_bucket') });
A('story/iron_tools', 'smelt_iron', 'task', 'iron_pickaxe', "Isn't It Iron Pick", 'Upgrade your Pickaxe', { have: has('iron_pickaxe') });
A('story/deflect_arrow', 'obtain_armor', 'task', 'shield', 'Not Today, Thank You', 'Deflect a projectile with a Shield', { deflect: () => true });
A('story/form_obsidian', 'lava_bucket', 'task', 'obsidian', 'Ice Bucket Challenge', 'Obtain a block of Obsidian', { have: has('obsidian') });
A('story/mine_diamond', 'iron_tools', 'task', 'diamond', 'Diamonds!', 'Acquire diamonds', { have: has('diamond') });
A('story/enchant_item', 'mine_diamond', 'task', 'enchanted_book', 'Enchanter', 'Enchant an item at an Enchanting Table', { enchant: () => true });
A('story/shiny_gear', 'mine_diamond', 'task', 'diamond_chestplate', 'Cover Me with Diamonds', 'Diamond armor saves lives', { have: has(...DIAMOND_ARMOR) });
A('story/find_stronghold', 'mine_diamond', 'task', 'end_portal_frame', 'Deep Secrets', 'Find your way into a Stronghold', { stronghold: () => true });

// ---- Adventure
A('adventure/root', null, 'task', 'map', 'Adventure', 'Adventure, exploration and combat', { kill: () => true, died: (d) => !!d.mob });
A('adventure/kill_a_mob', 'root', 'task', 'iron_sword', 'Monster Hunter', 'Kill any hostile monster', { kill: (d) => !!d.h });
A('adventure/shoot_arrow', 'kill_a_mob', 'task', 'bow', 'Take Aim', 'Shoot something with an Arrow', { arrow_hit: () => true });
A('adventure/sniper_duel', 'shoot_arrow', 'challenge', 'arrow', 'Sniper Duel', 'Kill a Skeleton from at least 50 meters away', { kill: (d) => !!d.s }, { xp: 50 });
A('adventure/kill_all_mobs', 'kill_a_mob', 'challenge', 'diamond_sword', 'Monsters Hunted', 'Kill one of every hostile monster', { kill: (d) => d.m },
  { parts: () => HUNTED, label: mobLabel, xp: 100 });
A('adventure/ol_betsy', 'kill_a_mob', 'task', 'crossbow', "Ol' Betsy", 'Shoot a Crossbow', { crossbow: () => true });
A('adventure/arbalistic', 'ol_betsy', 'challenge', 'crossbow', 'Arbalistic', 'Kill five unique mobs with one crossbow shot', { kill: (d) => !!d.a },
  { xp: 85, hidden: true });
A('adventure/throw_trident', 'kill_a_mob', 'task', 'trident', 'A Throwaway Joke',
  'Throw a Trident at something. Note: Throwing away your only weapon is not a good idea.', { trident_hit: () => true });
A('adventure/very_very_frightening', 'throw_trident', 'task', 'trident', 'Very Very Frightening', 'Strike a Villager with lightning',
  { lightning_villager: () => true });
A('adventure/trade', 'root', 'task', 'gold_coin', 'What a Deal!', 'Successfully trade with a Villager', { trade: () => true });
A('adventure/summon_iron_golem', 'trade', 'goal', 'pumpkin', 'Hired Help', 'Summon an Iron Golem to help defend a village', { golem: () => true });
A('adventure/royal_audience', 'trade', 'task', 'golden_helmet', 'Your Majesty', 'Have an audience with a king or queen',
  { talk: (d) => d.role === 'king' || d.role === 'queen' });
A('adventure/sleep_in_bed', 'root', 'task', 'bed', 'Sweet Dreams', 'Sleep in a Bed to change your respawn point', { sleep: () => true });
A('adventure/adventuring_time', 'sleep_in_bed', 'challenge', 'diamond_boots', 'Adventuring Time', 'Discover every biome', { biome: (d) => d.b },
  { parts: (g) => biomesToFind(g.meta?.gen ?? 11), label: (p) => p, xp: 500 });
A('adventure/grand_tour', 'sleep_in_bed', 'goal', 'bell', 'Grand Tour', 'Visit a camp, a hamlet, a village, a town and a kingdom',
  { visit: (d) => d.tier }, { parts: () => TIERS, label: cap });
A('adventure/honey_block_slide', 'sleep_in_bed', 'task', 'honey_block', 'Sticky Situation', 'Jump into a Honey Block to break your fall',
  { honey_land: () => true });
A('adventure/play_jukebox_in_meadows', 'sleep_in_bed', 'task', 'jukebox', 'Sound of Music',
  'Make the Meadows come alive with the sound of music from a Jukebox', { jukebox: (d) => d.b === BIOME.MEADOW });
A('adventure/spyglass_at_parrot', 'root', 'task', 'spyglass', 'Is It a Bird?', 'Look at a Parrot through a Spyglass', { spy: (d) => d.m === 'parrot' });
A('adventure/spyglass_at_whale', 'spyglass_at_parrot', 'task', 'spyglass', 'Thar She Blows!', 'Look at a Whale through a Spyglass',
  { spy: (d) => WHALES.has(d.m) });
A('adventure/fall_from_world_height', 'root', 'task', 'water_bucket', 'Caves & Cliffs',
  'Free fall from the top of the world (build limit) to the bottom of the world and survive',
  { fall: (d) => d.from >= HEIGHT - 1 && d.to <= BOTTOM });

// ---- Husbandry
A('husbandry/root', null, 'task', 'hay_block', 'Husbandry', 'The world is full of friends and food', { eat: () => true });
A('husbandry/safely_harvest_honey', 'root', 'task', 'honey_bottle', 'Bee Our Guest',
  'Use a Campfire to collect Honey from a Beehive using a Glass Bottle without aggravating the Bees', { honey_safe: () => true });
A('husbandry/silk_touch_nest', 'safely_harvest_honey', 'task', 'bee_nest', 'Total Beelocation', 'Move a Bee Nest, with 3 Bees inside, using Silk Touch',
  { silk_nest: () => true });
A('husbandry/breed_an_animal', 'root', 'task', 'wheat', 'The Parrots and the Bats', 'Breed two animals together', { breed: () => true });
A('husbandry/bred_all_animals', 'breed_an_animal', 'challenge', 'golden_carrot', 'Two by Two', 'Breed all the animals!', { breed: (d) => d.m },
  { parts: () => BRED, label: mobLabel, xp: 100 });
A('husbandry/tame_an_animal', 'root', 'task', 'lead', 'Best Friends Forever', 'Tame an animal', { tame: () => true });
A('husbandry/complete_catalogue', 'tame_an_animal', 'challenge', 'cod', 'A Complete Catalogue', 'Tame all Cat variants!',
  { tame: (d) => (d.m === 'cat' ? CATS[d.v] : null) }, { parts: () => CATS, label: kindLabel, xp: 50 });
A('husbandry/ride_elephant', 'tame_an_animal', 'task', 'saddle', 'Pack Your Trunk', 'Ride a tame Elephant', { ride: (d) => d.m === 'elephant' && !!d.tame });
A('husbandry/make_a_sign_glow', 'root', 'task', 'glow_ink_sac', 'Glow and Behold!', 'Make the text of any kind of Sign glow', { glow_sign: () => true });
A('husbandry/fishy_business', 'root', 'task', 'fishing_rod', 'Fishy Business', 'Catch a fish', { fish: (d) => FISH.has(itemDef(d.id)?.name) });
A('husbandry/tactical_fishing', 'fishy_business', 'task', 'pufferfish_bucket', 'Tactical Fishing', 'Catch a Fish... without a Fishing Rod!',
  { scoop: (d) => FISH.has(d.m) });
A('husbandry/axolotl_in_a_bucket', 'tactical_fishing', 'task', 'axolotl_bucket', 'The Cutest Predator', 'Catch an Axolotl in a Bucket',
  { scoop: (d) => d.m === 'axolotl' });
A('husbandry/kill_axolotl_target', 'axolotl_in_a_bucket', 'goal', 'tropical_fish_bucket', 'The Healing Power of Friendship!',
  'Team up with an axolotl and win a fight', { axolotl_help: () => true });
A('husbandry/tadpole_in_a_bucket', 'tactical_fishing', 'task', 'tadpole_bucket', 'Bukkit Bukkit', 'Catch a Tadpole in a Bucket',
  { scoop: (d) => d.m === 'tadpole' });
A('husbandry/leash_all_frog_variants', 'tadpole_in_a_bucket', 'task', 'lead', 'When the Squad Hops into Town', 'Get each Frog variant on a Lead',
  { leash: (d) => (d.m === 'frog' ? FROGS[d.v] : null) }, { parts: () => FROGS, label: kindLabel });
A('husbandry/plant_seed', 'root', 'task', 'wheat_seeds', 'A Seedy Place', 'Plant a seed and watch it grow',
  { plant: (d) => /_seeds$/.test(itemDef(d.id)?.name ?? '') });
A('husbandry/balanced_diet', 'plant_seed', 'challenge', 'apple', 'A Balanced Diet', "Eat everything that is edible, even if it's not good for you",
  { eat: (d) => itemDef(d.id)?.name }, { parts: () => FOODS, label: (p) => itemDef(I[p])?.label ?? cap(p), xp: 100 });

export const ADVANCEMENTS = LIST;
export const BY_ID = new Map(LIST.map((a) => [a.id, a]));
for (const a of LIST) a.children = LIST.filter((c) => c.parent === a.id);

// A part's name as the screen lists it: a creature's, a food's, a biome's, a cat's or frog's kind,
// a kind of settlement.
export const partName = (a, p) => (a.label ?? cap)(p);

// The icon of an advancement.
export const iconOfAdvancement = (a) => iconFor(I[a.icon]);

// ---------------------------------------------------------------- the player's progress
export class Advancements {
  constructor(game) {
    this.game = game;
    this.got = new Map(); // id -> true (made), or the Set of its parts made so far
    this.dirty = true;    // the inventory changed since it was last looked through
    this.lookAt = 0;
    this.clock = 0;
    this.toasts = new Toasts(game);
  }

  // (A world from before advancements, or a new one: what the player has already is made quietly the
  // first time it's looked through, not all popping up at once.)
  load(saved) {
    this.got.clear();
    this.catchUp = !saved;
    if (saved && typeof saved === 'object') {
      for (const [id, v] of Object.entries(saved)) {
        if (!BY_ID.has(id)) continue;
        if (v === true) this.got.set(id, true);
        else if (Array.isArray(v)) this.got.set(id, new Set(v.filter((p) => typeof p === 'string').slice(0, 200)));
      }
    }
    this.dirty = true;
  }
  serialize() {
    const out = {};
    for (const [id, v] of this.got) out[id] = v === true ? true : [...v];
    return out;
  }

  isDone(a) { return this.got.get(typeof a === 'string' ? a : a.id) === true; }
  // The parts an advancement asks for (null: just the one thing), and how far along it is.
  parts(a) { return a.parts ? a.parts(this.game) : null; }
  progress(a) {
    const parts = this.parts(a);
    if (!parts) return [this.isDone(a) ? 1 : 0, 1];
    if (this.isDone(a)) return [parts.length, parts.length];
    const got = this.got.get(a.id);
    return [got ? parts.filter((p) => got.has(p)).length : 0, parts.length];
  }
  // The parts still to do (for the screen).
  left(a) {
    const parts = this.parts(a), got = this.got.get(a.id);
    if (!parts || this.isDone(a)) return [];
    return parts.filter((p) => !(got instanceof Set && got.has(p)));
  }

  // Shown on the screen: made, or next to one made (a step or two on), or on the way to one that
  // is; a hidden one only once it's made.
  visible(a) {
    if (this.isDone(a)) return true;
    if (a.hidden) return false;
    const up = a.parent && BY_ID.get(a.parent);
    if (!up || this.isDone(up) || (up.parent && this.isDone(up.parent))) return true;
    const below = (x) => x.children.some((c) => this.isDone(c) || below(c));
    return below(a);
  }

  // Something happened: whatever it makes is made (or a part of it). `quiet`: without the toast and
  // the chat.
  event(type, d = {}, quiet = false) {
    if (!this.game.world) return;
    for (const a of LIST) {
      const test = a.on[type];
      if (!test || this.isDone(a)) continue;
      const r = test(d, this.game);
      if (!r) continue;
      if (a.parts) {
        if (typeof r !== 'string' || !this.parts(a).includes(r)) continue;
        let got = this.got.get(a.id);
        if (!(got instanceof Set)) this.got.set(a.id, got = new Set());
        if (got.has(r)) continue;
        got.add(r);
        if (this.parts(a).every((p) => got.has(p))) this.grant(a, quiet);
      } else this.grant(a, quiet);
    }
  }

  // Made: shown in the corner, told in the chat (to everyone, playing with friends), and for a
  // challenge, experience.
  grant(a, quiet = false) {
    if (this.isDone(a)) return false;
    this.got.set(a.id, true);
    if (quiet) return true;
    const g = this.game;
    if (a.parent) {
      this.toasts.show(a);
      g.announceAdvancement?.(a);
    }
    if (a.xp) {
      const before = g.xp.level;
      addXp(g.xp, a.xp);
      g.audio.orb?.();
      if (g.xp.level > before) g.audio.levelUp?.();
    }
    g.advScreen?.refresh();
    return true;
  }
  revoke(a) { this.got.delete(a.id); this.game.advScreen?.refresh(); }

  // Each frame: the inventory looked through when it has changed (ten times a second at most),
  // and once a second, where you are (biomes, strongholds) and what you ride.
  update(dt) {
    const g = this.game;
    if (!g.world || !g.player || g.state === 'loading') return;
    this.lookAt -= dt;
    if (this.dirty && this.lookAt <= 0) {
      this.dirty = false;
      this.lookAt = 0.1;
      const held = new Set();
      for (const s of [...g.inv.slots, ...g.inv.armor]) if (s) held.add(s.id);
      this.event('have', held, this.catchUp);
      this.catchUp = false;
    }
    if ((this.clock += dt) < 1) return;
    this.clock = 0;
    const p = g.player, x = Math.floor(p.x), z = Math.floor(p.z);
    if (g.state === 'dead') return;
    if (g.world.isLoaded?.(x, z) !== false) {
      const b = g.world.biomeAt(x, z);
      if (BIOME_NAMES[b]) this.event('biome', { b: BIOME_NAMES[b] });
    }
    if (g.inStronghold?.()) this.event('stronghold');
    if (g.riding?.kind === 'mob') this.event('ride', { m: g.riding.type, tame: !!g.riding.tame });
  }
}

// ---------------------------------------------------------------- toasts
// "Advancement Made!" and the advancement, in a box that slides in at the top right for a few
// seconds (as Minecraft's toasts do), a few at a time; more wait their turn.
const SHOWN = 5, STAY = 5000, SLIDE = 450;
class Toasts {
  constructor(game) {
    this.game = game;
    this.el = null;
    this.queue = [];
  }
  show(a) {
    this.queue.push(a);
    this.next();
  }
  next() {
    if (typeof document === 'undefined') return;
    if (!this.el) {
      this.el = document.createElement('div');
      this.el.id = 'toasts';
      (document.getElementById('app') ?? document.body).appendChild(this.el);
    }
    while (this.queue.length && this.el.children.length < SHOWN) this.pop(this.queue.shift());
  }
  pop(a) {
    const g = this.game, f = FRAMES[a.frame], t = document.createElement('div');
    t.className = `toast ${a.frame}`;
    const icon = document.createElement('img');
    icon.alt = '';
    icon.src = iconOfAdvancement(a);
    const head = document.createElement('b'), name = document.createElement('span');
    head.textContent = f.toast;
    head.style.color = f.head;
    name.textContent = a.title;
    t.append(icon, head, name);
    this.el.appendChild(t);
    requestAnimationFrame(() => requestAnimationFrame(() => t.classList.add('in')));
    g.audio.toast?.(true);
    if (a.frame === 'challenge') g.audio.challenge?.();
    setTimeout(() => {
      t.classList.remove('in');
      g.audio.toast?.(false);
      setTimeout(() => { t.remove(); this.next(); }, SLIDE);
    }, STAY);
  }
  clear() { this.queue = []; this.el?.replaceChildren(); }
}
