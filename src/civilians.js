// The people of the settlements. Each settlement's plan (villages.js) lists its residents: a role,
// a workplace and a bed. They're brought to life when their settlement loads, and live by the
// clock: up at dawn, off to work, to the market in the afternoon, home at dusk and to bed. They
// find their way through the town (opening doors and gates and shutting them behind them), run
// from monsters, and the guards and knights fight. A kingdom's king and queen hold court from
// their thrones. Talk to anyone (right-click) to chat, ask the way, or trade for gold coins (see
// tradeui.js).
import { villagesNear, villageResidents, villageAnimals, villageAt, outside } from './villages.js';
import { B, SOLID, DOOR, GATE, CLIMB, WATERLIKE, SHAPE_KIND, BED } from './blocks.js';
import { I } from './items.js';
import { randomBook, ENCHANTS } from './enchanting.js';
import { TICKS_PER_DAY } from './config.js';
import { mulberry32, hashString, clamp } from './math.js';
import { TEX } from './textures.js';
import { CIV_LOOKS } from './tex/civskins.js';

// ---------------------------------------------------------------- roles
// Trades: ['buy', item, count, price] (you pay gold coins) or ['sell', item, count, price] (you're
// paid). Each person offers some of their role's list, restocked every morning.
export const ROLES = {
  merchant: { title: 'Merchant', held: null, trades: [['buy', 'torch', 8, 1], ['buy', 'bread', 3, 2], ['buy', 'apple', 4, 1], ['buy', 'glass', 4, 2],
    ['buy', 'lantern', 1, 3], ['buy', 'bed', 1, 4], ['buy', 'gold_ingot', 1, 4], ['sell', 'gold_ingot', 1, 3], ['sell', 'emerald', 1, 3],
    ['sell', 'white_wool', 12, 1], ['sell', 'string', 10, 1], ['sell', 'diamond', 1, 8], ['buy', 'compass', 1, 5], ['buy', 'saddle', 1, 8],
    ['buy', 'name_tag', 1, 6], ['buy', 'lead', 1, 3]] },
  guard: { title: 'Guard', held: 'iron_sword', trades: [['buy', 'arrow', 16, 2], ['buy', 'iron_sword', 1, 7], ['buy', 'iron_helmet', 1, 6],
    ['sell', 'rotten_flesh', 16, 1], ['sell', 'bone', 12, 1], ['sell', 'gunpowder', 6, 1]] },
  blacksmith: { title: 'Blacksmith', held: 'iron_pickaxe', trades: [['buy', 'iron_pickaxe', 1, 8], ['buy', 'iron_sword', 1, 7], ['buy', 'iron_axe', 1, 6],
    ['buy', 'iron_shovel', 1, 4], ['buy', 'iron_helmet', 1, 6], ['buy', 'iron_chestplate', 1, 12], ['buy', 'iron_leggings', 1, 10],
    ['buy', 'iron_boots', 1, 5], ['buy', 'bucket', 1, 3], ['buy', 'shears', 1, 2], ['buy', 'chainmail_chestplate', 1, 9], ['buy', 'diamond_pickaxe', 1, 24],
    ['sell', 'coal', 15, 1], ['sell', 'iron_ingot', 4, 1], ['sell', 'raw_iron', 5, 1], ['sell', 'diamond', 1, 8]] },
  butcher: { title: 'Butcher', held: 'iron_axe', trades: [['buy', 'cooked_porkchop', 5, 2], ['buy', 'cooked_beef', 5, 2], ['buy', 'cooked_chicken', 6, 2],
    ['buy', 'cooked_mutton', 5, 2], ['buy', 'rabbit_stew', 1, 2], ['sell', 'raw_porkchop', 7, 1], ['sell', 'raw_beef', 7, 1], ['sell', 'raw_chicken', 10, 1],
    ['sell', 'raw_mutton', 7, 1], ['sell', 'raw_rabbit', 5, 1], ['sell', 'coal', 12, 1]] },
  hunter: { title: 'Hunter', held: 'bow', trades: [['buy', 'bow', 1, 4], ['buy', 'arrow', 16, 2], ['buy', 'potion_night_vision', 1, 6], ['buy', 'potion_swiftness', 1, 6],
    ['buy', 'leather_helmet', 1, 3], ['buy', 'leather_chestplate', 1, 5],
    ['buy', 'leather_leggings', 1, 4], ['buy', 'leather_boots', 1, 3], ['buy', 'saddle', 1, 8], ['sell', 'leather', 6, 1], ['sell', 'rabbit_hide', 9, 1],
    ['sell', 'feather', 16, 1], ['sell', 'string', 14, 1], ['sell', 'flint', 10, 1]] },
  librarian: { title: 'Librarian', held: 'book', trades: [['buy', 'enchanted_book', 1, 0], ['buy', 'enchanted_book', 1, 0], ['buy', 'book', 1, 2],
    ['buy', 'bookshelf', 1, 6], ['buy', 'enchanting_table', 1, 20], ['buy', 'compass', 1, 5], ['buy', 'clock', 1, 5], ['buy', 'paper', 12, 1],
    ['buy', 'lantern', 1, 3], ['buy', 'lapis_lazuli', 4, 2], ['buy', 'name_tag', 1, 6], ['sell', 'paper', 24, 1], ['sell', 'book', 4, 1],
    ['sell', 'lapis_lazuli', 8, 1]] },
  innkeeper: { title: 'Innkeeper', held: null, trades: [['buy', 'mushroom_stew', 1, 2], ['buy', 'bread', 4, 2], ['buy', 'cooked_salmon', 3, 2],
    ['buy', 'potion_healing', 1, 5], ['buy', 'potion_regeneration', 1, 7], ['buy', 'potion_strength', 1, 8],
    ['buy', 'pumpkin_pie', 2, 2], ['buy', 'cookie', 8, 1], ['buy', 'bed', 1, 5], ['sell', 'wheat', 20, 1], ['sell', 'sugar_cane', 20, 1],
    ['sell', 'red_mushroom', 8, 1], ['sell', 'brown_mushroom', 8, 1]] },
  baker: { title: 'Baker', held: 'bread', trades: [['buy', 'bread', 4, 2], ['buy', 'cookie', 10, 1], ['buy', 'pumpkin_pie', 2, 2], ['buy', 'golden_carrot', 3, 3],
    ['buy', 'cake', 1, 4], ['sell', 'wheat', 20, 1], ['sell', 'pumpkin', 6, 1], ['sell', 'egg', 12, 1], ['sell', 'sugar', 10, 1]] },
  farmer: { title: 'Farmer', held: 'iron_hoe', trades: [['buy', 'bread', 6, 2], ['buy', 'apple', 4, 1], ['buy', 'golden_carrot', 3, 3], ['buy', 'wheat_seeds', 16, 1],
    ['buy', 'oak_sapling', 4, 1], ['buy', 'bone_meal', 8, 1], ['sell', 'wheat', 20, 1], ['sell', 'carrot', 22, 1], ['sell', 'potato', 26, 1],
    ['sell', 'beetroot', 15, 1], ['sell', 'melon_slice', 16, 1], ['sell', 'pumpkin', 6, 1]] },
  shepherd: { title: 'Shepherd', held: 'shears', trades: [['buy', 'white_wool', 2, 1], ['buy', 'bed', 1, 3], ['buy', 'shears', 1, 2], ['buy', 'white_carpet', 4, 1],
    ['buy', 'red_wool', 2, 1], ['buy', 'blue_wool', 2, 1], ['sell', 'white_wool', 18, 1], ['sell', 'white_dye', 12, 1], ['sell', 'black_dye', 12, 1]] },
  miner: { title: 'Miner', held: 'iron_pickaxe', trades: [['buy', 'iron_pickaxe', 1, 8], ['buy', 'torch', 16, 1], ['buy', 'coal', 8, 1], ['buy', 'raw_iron', 3, 2],
    ['buy', 'potion_fire_resistance', 1, 7],
    ['buy', 'lapis_lazuli', 6, 2], ['buy', 'redstone', 8, 2], ['buy', 'diamond', 1, 10], ['buy', 'tnt', 2, 4], ['sell', 'cobblestone', 32, 1],
    ['sell', 'coal', 12, 1], ['sell', 'iron_ingot', 4, 1], ['sell', 'copper_ingot', 12, 1], ['sell', 'diamond', 1, 9]] },
  fisher: { title: 'Fisher', held: 'fishing_rod', trades: [['buy', 'cooked_cod', 6, 2], ['buy', 'cooked_salmon', 6, 2], ['buy', 'fishing_rod', 1, 3],
    ['buy', 'potion_water_breathing', 1, 6],
    ['sell', 'string', 20, 1], ['sell', 'cod', 15, 1], ['sell', 'salmon', 13, 1]] },
  // (Newer worlds' settlements have these too.)
  king: { title: 'King', held: null, trades: [['buy', 'golden_apple', 1, 12], ['buy', 'diamond_sword', 1, 30], ['buy', 'diamond_chestplate', 1, 40],
    ['buy', 'enchanted_book', 1, 0], ['buy', 'shield', 1, 6], ['buy', 'name_tag', 1, 5], ['sell', 'diamond', 1, 12], ['sell', 'emerald', 1, 5],
    ['sell', 'gold_block', 1, 30], ['sell', 'iron_block', 1, 10]] },
  queen: { title: 'Queen', held: null, trades: [['buy', 'cake', 1, 4], ['buy', 'potion_regeneration', 1, 6], ['buy', 'potion_healing', 1, 5],
    ['buy', 'golden_carrot', 4, 4], ['buy', 'enchanted_book', 1, 0], ['buy', 'bookshelf', 1, 5], ['sell', 'poppy', 12, 1], ['sell', 'cornflower', 12, 1],
    ['sell', 'lily_of_the_valley', 10, 1], ['sell', 'diamond', 1, 10]] },
  knight: { title: 'Knight', held: 'iron_sword', trades: [['buy', 'iron_sword', 1, 6], ['buy', 'shield', 1, 5], ['buy', 'iron_chestplate', 1, 10],
    ['buy', 'chainmail_helmet', 1, 5], ['buy', 'diamond_sword', 1, 26], ['buy', 'arrow', 16, 2], ['buy', 'bow', 1, 4], ['sell', 'bone', 12, 1],
    ['sell', 'rotten_flesh', 16, 1], ['sell', 'gunpowder', 5, 1], ['sell', 'string', 10, 1]] },
  cleric: { title: 'Cleric', held: null, trades: [['buy', 'potion_healing', 1, 4], ['buy', 'potion_regeneration', 1, 6], ['buy', 'splash_potion_healing', 1, 5],
    ['buy', 'glowstone', 4, 3], ['buy', 'lapis_lazuli', 6, 2], ['buy', 'ender_pearl', 1, 5], ['buy', 'redstone', 8, 2], ['sell', 'rotten_flesh', 24, 1],
    ['sell', 'gold_ingot', 2, 3], ['sell', 'glass_bottle', 6, 1], ['sell', 'spider_eye', 6, 1]] },
  woodcutter: { title: 'Woodcutter', held: 'iron_axe', trades: [['buy', 'oak_log', 16, 1], ['buy', 'spruce_log', 16, 1], ['buy', 'birch_log', 16, 1],
    ['buy', 'dark_oak_log', 12, 1], ['buy', 'charcoal', 8, 1], ['buy', 'iron_axe', 1, 5], ['buy', 'apple', 4, 1], ['buy', 'oak_sapling', 4, 1],
    ['sell', 'stick', 32, 1], ['sell', 'oak_planks', 32, 1], ['sell', 'coal', 10, 1]] },
  traveller: { title: 'Traveller', held: null, trades: [['buy', 'compass', 1, 4], ['buy', 'clock', 1, 4], ['buy', 'cherry_sapling', 2, 2], ['buy', 'cactus', 4, 1],
    ['buy', 'sugar_cane', 6, 1], ['buy', 'melon_slice', 8, 1], ['buy', 'lead', 1, 2], ['buy', 'saddle', 1, 7], ['buy', 'name_tag', 1, 5],
    ['buy', 'potion_night_vision', 1, 5], ['sell', 'emerald', 1, 4], ['sell', 'diamond', 1, 9], ['sell', 'gold_ingot', 1, 3], ['sell', 'leather', 5, 1]] },
  mason: { title: 'Mason', held: 'iron_pickaxe', trades: [['buy', 'stone_bricks', 16, 1], ['buy', 'polished_andesite', 16, 1], ['buy', 'polished_granite', 16, 1],
    ['buy', 'polished_diorite', 16, 1], ['buy', 'bricks', 12, 1], ['buy', 'chiseled_stone_bricks', 8, 1], ['buy', 'terracotta', 12, 1],
    ['buy', 'deepslate_bricks', 12, 1], ['sell', 'cobblestone', 32, 1], ['sell', 'stone', 24, 1], ['sell', 'clay_ball', 12, 1]] },
  stablehand: { title: 'Stablehand', held: 'wheat', trades: [['buy', 'saddle', 1, 6], ['buy', 'lead', 2, 2], ['buy', 'golden_carrot', 3, 3],
    ['buy', 'hay_block', 4, 1], ['buy', 'apple', 6, 1], ['buy', 'name_tag', 1, 5], ['sell', 'wheat', 20, 1], ['sell', 'carrot', 18, 1], ['sell', 'leather', 6, 1]] },
};
// Those who fight monsters (and anyone who hurts their neighbours).
const FIGHTS = new Set(['guard', 'knight']);
const ROYAL = new Set(['king', 'queen']);

// What people say. `{v}` is the village's name, `{n}` the speaker's, `{r}` their trade.
const GREET = [
  'Hello there, traveller.', 'Welcome to {v}!', 'Good day to you.', 'Oh! You startled me.', 'Well met, stranger.', 'Hm? Can I help you?',
  "Haven't seen you round {v} before.",
];
const GREET_NIGHT = ["It's late... what brings you out in the dark?", 'Keep your voice down, folk are sleeping.', 'Quickly, inside the walls is safest at night.'];
const GREET_RAIN = ['Wretched weather, isn\'t it?', 'Come in out of the rain!', "At least the crops are getting a drink."];
const GREET_ANGRY = ["I've nothing to say to you.", 'You again. Keep your distance.', 'Guards! ...oh. Just go away.'];
// Royalty and their knights speak as befits them.
const GREET_AS = {
  king: ['Welcome to my kingdom, traveller.', 'Approach the throne. What brings you to {v}?', 'Kneel... oh, very well, stand. Speak.',
    'You stand before the king of {v}.'],
  queen: ['Be welcome at our court, stranger.', 'The gates of {v} are open to honest folk.', 'Ah, a visitor! How lovely.'],
  knight: ['Halt! ...ah, a friend. Pass, then.', 'For the crown of {v}!', 'Mind yourself in the castle, stranger.'],
};
const CHAT = {
  merchant: ['Everything has its price. Most things, anyway.', 'Gold coins, friend. Nothing else spends as well.', 'Business was better before the creepers came.',
    'I buy gold by the ingot, if you find any.'],
  guard: ['Keep your eyes open after dark. The dead walk.', 'Skeletons keep their distance. Close the gap fast or take cover.',
    "Hear a hiss behind you? Don't stop to look. Run.", 'Nothing gets past these walls on my watch.', 'The spiders climb the walls, but the gates stop the rest.'],
  blacksmith: ["Iron's what keeps us alive out here.", 'A good pickaxe is worth a hundred bad ones.', 'Bring me coal and I\'ll keep the forge hot.',
    "Diamonds are rare, but they're down there. Deep, below the old stone."],
  butcher: ['Fresh meat, cooked or raw!', "The smoker's twice as quick as a furnace for meat, you know.", 'Nothing like a cooked porkchop after a long day.'],
  hunter: ['Wolves run in packs. Hit one and you fight them all.', 'Spiders drop string. Good for bows.', "Creepers are quiet. Too quiet. Listen for the fuse.",
    "Endermen hate being stared at. Don't look them in the eye."],
  librarian: ['Knowledge is the only treasure that grows when shared.', 'Paper comes from sugar cane, did you know?', 'I keep the village records. Births, deaths, disputes.',
    'Three sheets of paper and some leather make a book.'],
  innkeeper: ['A warm meal and a soft bed, that\'s what the inn is for.', 'Pull up a stool, the stew is on.', 'Travellers bring the best stories. And the worst manners.'],
  baker: ['Three wheat makes a loaf. Simple as that.', 'Up before dawn, every day, for the bread.', 'A pumpkin pie? Pumpkin, sugar and an egg.',
    'A cake takes milk, sugar, an egg and wheat. Set it down and cut a slice!'],
  farmer: ['The rain is good for the wheat.', 'Bone meal makes anything grow faster.', 'Keep your crops near water, or the soil dries out.',
    'The wheat is golden when it\'s ready. Not before!'],
  shepherd: ['Sheep grow their wool back by eating grass.', 'You can dye a sheep, and it\'ll grow that colour for good.', 'Shears, not swords! Shears!'],
  miner: ['The deeper you go, the better the ore. And the worse the company.', 'Always carry torches. Always.', 'Mind the lava down there. It\'ll take everything you carry.',
    'Iron sits higher up. Diamonds deep, near the bedrock.'],
  fisher: ['The fish bite best in the rain.', 'Patience is the only bait that never runs out.', 'Salmon in the cold rivers, cod in the sea.'],
  king: ['A kingdom is only as strong as its walls. And its bakers.', 'My knights keep the roads safe. Mostly.', 'Bring me diamonds and you shall not find me ungrateful.',
    'The crown is heavier than it looks.', 'Every stone of these walls was laid in my grandfather\'s day.'],
  queen: ['The gardens are lovely at this time of year.', 'Bring me flowers from the meadows and I shall pay you well.',
    'The king worries too much. The walls will hold.', 'Have you visited the chapel? The glass is beautiful at dawn.'],
  knight: ['I swore an oath to defend the crown.', 'Zombies, skeletons, spiders... they all fall to cold iron.', 'A shield will save your life. Raise it and the arrows break on it.',
    'The castle gate is shut at night. The king sleeps soundly.'],
  cleric: ['May the light keep you safe on the road.', 'A healing potion has saved many a traveller.', 'The dead walk only at night. Rest while the sun is up.',
    'Glowstone comes from a fiery place. Or so the old books say.'],
  woodcutter: ['Oak, birch, spruce... each splits in its own way.', 'Plant a sapling for every tree you fell, I always say.', 'An axe does the job twice as fast as your fists.',
    'Leaves drop apples now and then, if you\'re patient.'],
  traveller: ["I've seen deserts, jungles, mountains of ice... and now you.", 'The road is long, but the stories are worth it.',
    'Kingdoms to the east, they say, with walls taller than oaks.', 'Never camp without a fire. Things come out of the dark.'],
  mason: ['Cut stone lasts a thousand years. Wood, maybe fifty.', 'A stonecutter turns one block into stairs without waste.', 'Mossy stone? Just add vines. Or time.'],
  stablehand: ['Horses love golden carrots. And apples, and hay...', 'Saddle a tamed horse and it will carry you anywhere.', 'Breed two good horses for a faster foal.'],
};
const RUMOURS = ['They say there are ruins in the deep caves.', 'A merchant told me of villages built of sandstone in the desert.',
  'Somewhere out there is a kingdom with a castle and a king on a golden throne.', 'Hunters camp in the woods. Their fires can be seen for miles.',
  'The peaks to the north are cold enough to freeze your breath.', "If you find a dungeon, mind the monster cage.", 'Some say the endermen come from another world.',
  'Cherry trees bloom pink all year round, in the groves.', 'Slimes bounce about the swamps on a full moon.'];

// Village names.
const PRE = ['Ash', 'Oak', 'Mill', 'Stone', 'Brook', 'Elm', 'Fox', 'Wolf', 'Raven', 'Thorn', 'Willow', 'Frost', 'Amber', 'Iron', 'Marsh', 'Hollow',
  'Red', 'Green', 'Black', 'White', 'Bright', 'Pine', 'Birch', 'Hazel', 'Kings', 'Wester', 'Easter', 'Sutter', 'Wood', 'Fair'];
const SUF = ['ford', 'ton', 'wick', 'haven', 'stead', 'bury', 'field', 'dale', 'mere', 'wood', 'bridge', 'gate', 'holm', 'combe', 'moor', 'well',
  'ridge', 'barrow', 'by', 'thorpe'];
export function villageName(plan) {
  const r = mulberry32(plan.seed ^ 0x5eed);
  return `${PRE[Math.floor(r() * PRE.length)]}${SUF[Math.floor(r() * SUF.length)]}`;
}
// What the title says as you walk in: the name, and who lives there.
export function villageTitle(plan) {
  const name = villageName(plan), people = villageResidents(plan), n = people.length;
  switch (plan.tier) {
    case 'camp': return [`${name} Camp`, `${n} ${plan.camp ?? 'travellers'} camp here`];
    case 'kingdom': {
      const king = people.find((r) => r.role === 'king');
      return [`The Kingdom of ${name}`, `${king ? `${king.name} rules here` : 'A kingdom'} \u00b7 ${n} people live here`];
    }
    case 'town': return [name, `A walled town \u00b7 ${n} people live here`];
    case 'hamlet': return [name, `A hamlet \u00b7 ${n} people live here`];
    default: return [name, `${n} people live here`];
  }
}

// Directions to the town's places.
const PLACES = [['smithy', 'the smithy'], ['tavern', 'the tavern'], ['library', 'the library'], ['bakery', 'the bakery'], ['butcher', 'the butcher'],
  ['hunter', "the hunter's lodge"], ['mine', 'the mine'], ['barracks', 'the barracks'], ['farm', 'the farms'], ['church', 'the church'],
  ['castle', 'the castle'], ['market', 'the market'], ['stable', 'the stables'], ['mason', "the mason's yard"], ['windmill', 'the windmill']];
// The kind of place a settlement is, as its people say it.
const KIND = { camp: 'camp', hamlet: 'hamlet', village: 'village', town: 'town', kingdom: 'kingdom' };
const COMPASS = ['north', 'north-east', 'east', 'south-east', 'south', 'south-west', 'west', 'north-west'];

// ---------------------------------------------------------------- the people
export class Civilians {
  constructor(ents) {
    this.ents = ents;
    this.live = new Map();     // resident id -> entity
    this.penned = new Set();   // villages whose pen animals are out
    this.keepers = new Map();  // village key -> its iron golem and cats
    this.pathBudget = 0;
    this.currentVillage = null;
  }
  get game() { return this.ents.game; }
  get world() { return this.ents.world; }
  reset() { this.live.clear(); this.penned.clear(); this.keepers.clear(); this.currentVillage = null; }

  // Saved state per village: reputation, who has died (and when), trade stock used today.
  record(plan) {
    const meta = this.game.meta;
    meta.villages ??= {};
    return (meta.villages[plan.key] ??= { rep: 0, dead: {}, used: {}, day: -1 });
  }

  chunkLoaded(chunk) {
    const gen = this.world?.gen;
    if (!gen?.villages) return;
    for (const v of villagesNear(gen, chunk.cx, chunk.cz)) {
      // Everyone comes out once the chunks under the village centre and its houses exist.
      if ((v.x >> 4) === chunk.cx && (v.z >> 4) === chunk.cz) this.populate(v);
    }
  }

  populate(plan) {
    const game = this.game, rec = this.record(plan), day = Math.floor(game.time / TICKS_PER_DAY);
    const night = this.phase(game.time % TICKS_PER_DAY, 'x') === 'sleep';
    for (const r of villageResidents(plan)) {
      if (this.live.has(r.id)) continue;
      const died = rec.dead[r.id];
      if (died !== undefined && day - died < 2) continue; // (a new neighbour moves in after a couple of days)
      if (died !== undefined) delete rec.dead[r.id];
      const at = night && r.bed ? r.bed : r.work;
      const e = this.ents.spawnMob('civilian', at[0] + 0.5, at[1] + (night && r.bed ? 0.6 : 0.05), at[2] + 0.5);
      this.dress(e, r, plan);
      this.live.set(r.id, e);
    }
    if (!this.penned.has(plan.key)) {
      this.penned.add(plan.key);
      for (const a of villageAnimals(plan)) {
        const m = this.ents.spawnMob(a.type, a.at[0] + 0.5, a.at[1] + 0.1, a.at[2] + 0.5, { colour: 0, pinned: plan.key, penned: true });
        m.home = { x: a.at[0] + 0.5, z: a.at[2] + 0.5 };
      }
    }
    // An iron golem keeps watch over the plaza (two over a kingdom's market), and a few cats laze
    // about - a hamlet has only the cats, a camp neither. (They come back whenever the settlement
    // does, unless someone has seen to them all.)
    const keepers = this.keepers.get(plan.key), tier = plan.tier ?? 'village';
    if (tier !== 'camp' && (!keepers || keepers.every((m) => m.dead))) {
      const h = hashString(plan.key), [mx, mz] = plan.market ?? [0, 0], list = [];
      const home = { x: plan.x + mx + 0.5, z: plan.z + mz + 0.5 };
      const golems = tier === 'hamlet' ? 0 : tier === 'kingdom' ? 2 : 1;
      for (let k = 0; k < golems; k++) {
        const golem = this.ents.spawnMob('iron_golem', home.x + (k ? -5 : 0), plan.y + 1, home.z + (k ? 0 : 5), { pinned: plan.key, home });
        golem.yaw = Math.PI;
        list.push(golem);
      }
      const cats = tier === 'hamlet' ? 1 : 1 + (h % 3), spots = [[-6, 3], [6, -3], [3, 6], [-3, -6]];
      for (let k = 0; k < cats; k++) {
        const [dx, dz] = spots[(h + k) % spots.length];
        list.push(this.ents.spawnMob('cat', home.x + dx, plan.y + 1, home.z + dz, { pinned: plan.key, home, variant: (h >>> (k * 3)) % 6 }));
      }
      this.keepers.set(plan.key, list);
    }
  }

  // Gives a new entity its person: name, role, looks, what they carry.
  dress(e, r, plan) {
    const looks = CIV_LOOKS[r.role] ?? CIV_LOOKS.farmer;
    const h = hashString(r.id);
    Object.assign(e, {
      rid: r.id, role: r.role, name: r.name, skin: looks[h % looks.length], village: plan, resident: r, label: r.name,
      path: null, pathI: 0, goalKey: '', state: 'idle', talking: null, fear: 0, aggro: null, doorsOpen: [], stuck: 0, repaths: 0,
      idle: 0, workAnim: 0, voice: 0.8 + ((h >> 8) % 100) / 180, restAt: null,
    });
    e.held = null;
  }
  // A guest's copy of someone: name, role and looks come with it from the host.
  remoteLooks(e, s) {
    Object.assign(e, { rid: s.r, role: s.ro in ROLES ? s.ro : 'farmer', name: typeof s.n === 'string' ? s.n.slice(0, 40) : 'Villager',
      skin: typeof s.sk === 'string' && Object.values(CIV_LOOKS).some((l) => l.includes(s.sk)) ? s.sk : CIV_LOOKS.farmer[0] });
    e.label = e.name;
    e.village = villageAt(this.world.gen, e.x, e.z, 8);
  }

  gone(e) { if (e.rid && this.live.get(e.rid) === e) this.live.delete(e.rid); }
  died(e) {
    if (!e.rid) return;
    this.gone(e);
    const rec = this.record(e.village);
    rec.dead[e.rid] = Math.floor(this.game.time / TICKS_PER_DAY);
    this.game.ui.message(`${e.name} the ${ROLES[e.role]?.title.toLowerCase() ?? 'villager'} has died`, '#e88a78');
    if (this.game.talk?.who === e) this.game.closeTalk?.();
  }

  // Someone hurt a villager: they run, and the guards go after whoever did it.
  hurt(e, from) {
    e.fear = 120;
    if (!from) return;
    const player = from === this.game.player || from.addr !== undefined;
    if (!player || from.creative) return;
    const rec = this.record(e.village);
    rec.rep = Math.max(-20, rec.rep - (e.health <= 0 ? 8 : 2));
    const who = from === this.game.player ? this.ents.players[0] ?? { x: from.x, y: from.y, z: from.z, addr: null } : from;
    for (const g of this.live.values()) {
      if (FIGHTS.has(g.role) && !g.dead && Math.hypot(g.x - e.x, g.z - e.z) < 40) { g.aggro = who; g.aggroTime = 1200; }
    }
    if (FIGHTS.has(e.role)) { e.aggro = who; e.aggroTime = 1200; }
    // The village's iron golem won't stand for it either.
    for (const g of this.keepers.get(e.village?.key) ?? []) {
      if (g.type === 'iron_golem' && !g.dead && !g.dying && Math.hypot(g.x - e.x, g.z - e.z) < 32) { g.angry = 600; g.target = who; }
    }
  }

  // ---------------------------------------------------------------- the clock
  // What someone should be doing at time t (ticks into the day).
  phase(t, role) {
    if (role === 'guard') return t < 12500 || t > 23000 ? 'patrol' : 'watch';
    // (Knights keep to their posts day and night; the king and queen hold court all day.)
    if (role === 'knight') return 'watch';
    if (ROYAL.has(role) && t >= 600 && t < 11200) return 'work';
    if (t >= 12600 && t < 23300) return 'sleep';
    if (t >= 11200) return 'home';
    if (t >= 8800 && role !== 'merchant') return 'social';
    if (t < 600) return 'wake';
    return 'work';
  }

  // Once a game tick (before the creatures think): the village title as you walk in.
  tick() {
    this.pathBudget = 2;
    const game = this.game, p = game.player;
    if (!p || !this.world?.gen?.villages) return;
    if ((this.titleCheck = (this.titleCheck ?? 0) + 1) % 10) return;
    const v = villageAt(this.world.gen, p.x, p.z, -1);
    if (v !== this.currentVillage) {
      this.currentVillage = v;
      if (v) game.ui.showTitle?.(...villageTitle(v));
    }
  }

  // Twenty times a second for each villager.
  think(e) {
    const game = this.game, t = game.time % TICKS_PER_DAY;
    if (!e.village) return;
    e.fear = Math.max(0, e.fear - 1);
    if (e.aggroTime > 0 && --e.aggroTime === 0) e.aggro = null;
    e.climb = 0;
    // Talking: stand still and face whoever is talking to them.
    if (e.talking) {
      const who = e.talking;
      e.moving = false; e.path = null;
      if (!e.sitting) e.yaw = Math.atan2(-(who.x - e.x), -(who.z - e.z));
      e.lookAt = who;
      if (Math.hypot(who.x - e.x, who.z - e.z) > 8) e.talking = null;
      return;
    }
    if (FIGHTS.has(e.role) && this.guardFight(e)) return;
    // Monsters about: everyone else heads home at a run.
    const danger = !FIGHTS.has(e.role) && this.ents.list.find((o) => o.kind === 'mob' && o.def.hostile && !o.dead && !o.dying &&
      Math.hypot(o.x - e.x, o.z - e.z) < 10 && Math.abs(o.y - e.y) < 5);
    const phase = this.phase(t, e.role);
    if (e.pose === 'sleep' && (phase !== 'sleep' || danger || e.hurt)) this.wake(e);
    if (e.sitting && (phase !== 'work' || danger || e.fear > 0)) this.standUp(e);
    if (danger || e.fear > 0) {
      e.speedMul = 1.7;
      this.goTo(e, e.resident.home, 'home');
      if (!e.path && danger) { e.yaw = Math.atan2(danger.x - e.x, danger.z - e.z); e.moving = true; }
      this.follow(e);
      return;
    }
    e.speedMul = 1;
    e.held = phase === 'work' || FIGHTS.has(e.role) ? (ROLES[e.role]?.held ? I[ROLES[e.role].held] : null) : null;
    switch (phase) {
      case 'sleep': this.sleepTick(e); break;
      case 'home': this.goTo(e, e.resident.home, 'home'); if (this.arrived(e)) this.loiter(e, e.resident.home, 1.5); break;
      case 'social': {
        const p = e.village, key = `social${Math.floor(game.time / 2400)}`;
        if (e.spotKey !== key) {
          // Somewhere to stand in the square nearest home (not in the well or a stall).
          const r = mulberry32(hashString(e.rid) ^ Math.floor(game.time / 2400)), home = e.resident.home;
          let sq = [0, 0, 7], best = Infinity;
          for (const q of p.squares ?? [[0, 0, 7]]) {
            const dd = Math.hypot(p.x + q[0] - home[0], p.z + q[1] - home[2]);
            if (dd < best) { best = dd; sq = q; }
          }
          e.spotKey = key;
          for (let i = 0; i < 12; i++) {
            const a = r() * Math.PI * 2, d = 3 + r() * Math.max(1, Math.min(3, sq[2] - 3));
            e.spot = [Math.floor(p.x + sq[0] + Math.cos(a) * d), p.y + 1, Math.floor(p.z + sq[1] + Math.sin(a) * d)];
            if (this.walkable(...e.spot)) break;
          }
        }
        this.goTo(e, e.spot, key);
        if (this.arrived(e)) this.socialize(e);
        break;
      }
      case 'patrol': this.patrol(e); break;
      case 'watch': this.goTo(e, e.resident.work, 'post'); if (this.arrived(e)) this.loiter(e, e.resident.work, 2); break;
      default: {
        if (e.resident.seat) { this.holdCourt(e); break; }
        this.goTo(e, e.resident.work, 'work');
        if (this.arrived(e)) this.work(e);
      }
    }
    this.follow(e);
  }

  arrived(e) { return !e.path || e.pathI >= e.path.length; }

  // At work: pottering about near the workstation, now and then busy with the hands.
  work(e) {
    if (--e.idle > 0) { if (e.workAnim > 0 && --e.workAnim % 8 === 0) e.swing = 1; return; }
    const r = Math.random();
    if (r < 0.35) { e.workAnim = 40; e.idle = 50; e.moving = false; }
    else if (r < 0.7) this.loiter(e, e.resident.work, 2.5);
    else { e.moving = false; e.idle = 40 + Math.floor(Math.random() * 60); e.yaw += (Math.random() - 0.5) * 2; }
  }
  loiter(e, at, radius) {
    if (--e.idle > 0) return;
    e.idle = 40 + Math.floor(Math.random() * 80);
    if (Math.random() < 0.5) { e.moving = false; return; }
    const x = at[0] + Math.round((Math.random() - 0.5) * 2 * radius), z = at[2] + Math.round((Math.random() - 0.5) * 2 * radius);
    if (this.walkable(x, at[1], z)) { e.path = [[x, at[1], z]]; e.pathI = 0; }
  }
  // Gathered in the plaza: turn to whoever is nearest and pass the time of day.
  socialize(e) {
    if (--e.idle > 0) return;
    e.idle = 30 + Math.floor(Math.random() * 60);
    const other = [...this.live.values()].find((o) => o !== e && !o.dead && Math.hypot(o.x - e.x, o.z - e.z) < 4);
    if (other) { e.moving = false; e.yaw = Math.atan2(-(other.x - e.x), -(other.z - e.z)); e.lookAt = other; if (Math.random() < 0.3) this.voice(e); }
    else this.loiter(e, e.spot, 2);
  }
  sleepTick(e) {
    const bed = e.resident.bed;
    if (!bed) { this.goTo(e, e.resident.home, 'home'); return; }
    if (e.pose === 'sleep') { e.moving = false; e.x = e.restAt[0]; e.z = e.restAt[2]; e.vx = e.vz = 0; return; }
    this.goTo(e, bed, 'bed', true);
    if (this.arrived(e) && Math.hypot(e.x - bed[0] - 0.5, e.z - bed[2] - 0.5) < 1.5 && Math.abs(e.y - bed[1]) < 1.5) {
      // Lie down: feet at the foot of the bed, head on the pillow.
      const id = this.world.getBlock(bed[0], bed[1], bed[2]), b = BED[id];
      if (!b) { e.resident.bed = null; return; }
      const dir = { 5: [0, -1], 4: [0, 1], 0: [1, 0], 1: [-1, 0] }[b.dir];
      e.pose = 'sleep';
      e.restAt = [bed[0] + 0.5, bed[1] + 0.5625, bed[2] + 0.5];
      e.x = e.restAt[0]; e.y = e.restAt[1]; e.z = e.restAt[2];
      e.yaw = Math.atan2(dir[0], dir[1]);
      e.moving = false;
    }
  }
  wake(e) {
    e.pose = null;
    if (e.restAt) { e.y = e.restAt[1] + 0.1; }
    e.restAt = null;
  }
  // The king and queen sit on their thrones through the day.
  holdCourt(e) {
    const r = e.resident, seat = r.seat;
    if (e.sitting) { e.moving = false; return; }
    this.goTo(e, r.work, 'work');
    if (!this.arrived(e) || Math.hypot(e.x - r.work[0] - 0.5, e.z - r.work[2] - 0.5) > 1.2 || Math.abs(e.y - r.work[1]) > 1) return;
    const [dx, dz] = { 5: [0, -1], 4: [0, 1], 0: [1, 0], 1: [-1, 0] }[seat[3]] ?? [0, -1];
    e.sitting = true;
    e.restAt = [seat[0] + 0.5 + dx * 0.15, seat[1] + 0.5, seat[2] + 0.5 + dz * 0.15];
    e.x = e.restAt[0]; e.y = e.restAt[1]; e.z = e.restAt[2];
    e.yaw = Math.atan2(-dx, -dz);
    e.moving = false; e.path = null;
  }
  standUp(e) {
    const w = e.resident.work;
    e.sitting = false;
    e.restAt = null;
    e.x = w[0] + 0.5; e.y = w[1] + 0.05; e.z = w[2] + 0.5;
  }

  // Guards walk between their gate, the plaza and the lane.
  patrol(e) {
    const p = e.village, key = `patrol${Math.floor(this.game.time / 1200)}`;
    if (e.spotKey !== key) {
      e.spotKey = key;
      const r = mulberry32(hashString(e.rid) ^ Math.floor(this.game.time / 1200));
      const [mx, mz] = p.market ?? [0, 0], lane = p.rx - (p.wall?.t ?? 2) - 2, x = p.x + mx, z = p.z + mz;
      const spots = [e.resident.work, [x, p.y + 1, z + 9], [x + 9, p.y + 1, z], [x - 9, p.y + 1, z], [x, p.y + 1, z - 9],
        [p.x + (r() < 0.5 ? -1 : 1) * lane, p.y + 1, p.z + Math.round((r() - 0.5) * Math.min(30, p.rz))]];
      e.spot = spots[Math.floor(r() * spots.length)];
      if (!this.walkable(...e.spot)) e.spot = e.resident.work;
    }
    this.goTo(e, e.spot, key);
    if (this.arrived(e)) this.loiter(e, e.spot, 3);
  }
  // Guards take on monsters near the village, and anyone who attacked its people.
  guardFight(e) {
    const p = e.village;
    let foe = null, fd = 18;
    if (e.aggro && !e.aggro.dead && !e.aggro.creative) { foe = e.aggro; fd = Math.hypot(foe.x - e.x, foe.z - e.z); if (fd > 40) { e.aggro = null; foe = null; } }
    if (!foe) {
      for (const o of this.ents.list) {
        if (o.kind !== 'mob' || !o.def.hostile || o.dead || o.dying) continue;
        if (outside(p, o.x, o.z) > 12) continue;
        const dd = Math.hypot(o.x - e.x, o.z - e.z);
        if (dd < fd) { fd = dd; foe = o; }
      }
    }
    if (!foe) return false;
    if (e.pose === 'sleep') this.wake(e);
    e.held = I.iron_sword;
    e.target = foe;
    e.speedMul = 1.5;
    e.path = null;
    e.yaw = Math.atan2(-(foe.x - e.x), -(foe.z - e.z));
    e.moving = fd > 1.3;
    if (fd < 1.9 && Math.abs(foe.y - e.y) < 2 && e.attackCd === 0) {
      e.attackCd = 14;
      e.swing = 1;
      if (foe.kind === 'mob') this.ents.hurtMob(foe, 6, e);
      else this.game.hurtPlayer(foe, 4, `You were slain by ${e.name}`, [(foe.x - e.x) * 2, 4, (foe.z - e.z) * 2], true);
    }
    this.follow(e);
    return true;
  }

  // ---------------------------------------------------------------- getting about
  // Plans a route to `to` (a block cell to stand in, or with `near` one beside it) unless already
  // heading there.
  goTo(e, to, key, near = false) {
    if (!to) return;
    const k = `${key}:${to[0]},${to[1]},${to[2]}`;
    // (After failing to find a way, try again every few seconds: the way may be through land
    // that hadn't loaded yet, or a door someone has since opened.)
    if (e.goalKey === k && (e.gaveUp ? --e.retry > 0 : e.path)) return;
    const fx = Math.floor(e.x), fy = Math.floor(e.y + 0.1), fz = Math.floor(e.z);
    if (Math.abs(fx - to[0]) + Math.abs(fz - to[2]) <= (near ? 1 : 0) && Math.abs(fy - to[1]) <= 1) { e.goalKey = k; e.path = null; e.gaveUp = false; return; }
    if (this.pathBudget <= 0) return; // (someone else is thinking this tick; try again next)
    this.pathBudget--;
    e.goalKey = k;
    e.gaveUp = false;
    e.path = this.findPath([fx, fy, fz], to, 3000, near) ?? null;
    e.pathI = 0;
    e.stuck = 0;
    if (!e.path) { e.gaveUp = true; e.retry = 100; e.path = [to]; }
  }

  // Walks the route: towards the next waypoint, through doors (opened on the way and shut behind),
  // up and down ladders.
  follow(e) {
    const w = this.world;
    // Shut the doors we came through once clear of them.
    for (let i = e.doorsOpen.length - 1; i >= 0; i--) {
      const [x, y, z] = e.doorsOpen[i];
      if (Math.hypot(x + 0.5 - e.x, z + 0.5 - e.z) > 2.2) {
        const id = w.getBlock(x, y, z);
        if (DOOR[id]?.open) w.toggleDoor(x, y, z);
        else if (GATE[id]?.open) w.toggleGate(x, y, z);
        e.doorsOpen.splice(i, 1);
      }
    }
    if (!e.path || e.pathI >= e.path.length) { if (e.path) { e.path = null; e.moving = false; } return; }
    const wp = e.path[e.pathI];
    const dx = wp[0] + 0.5 - e.x, dz = wp[2] + 0.5 - e.z, dy = wp[1] - Math.floor(e.y + 0.1), dist = Math.hypot(dx, dz);
    // Doors and gates on the way.
    for (const y of [wp[1], wp[1] + 1]) {
      const id = w.getBlock(wp[0], y, wp[2]);
      if (DOOR[id] && !DOOR[id].open && dist < 2) {
        const low = DOOR[id].upper ? y - 1 : y;
        w.toggleDoor(wp[0], low, wp[2]); e.doorsOpen.push([wp[0], low, wp[2]]);
        this.game.audio.door(true, { x: wp[0] + 0.5, y: low + 1, z: wp[2] + 0.5 });
      } else if (GATE[id] && !GATE[id].open && dist < 2) {
        w.toggleGate(wp[0], y, wp[2], Math.abs(dx) > Math.abs(dz) ? (dx > 0 ? 1 : 0) : (dz > 0 ? 5 : 4));
        e.doorsOpen.push([wp[0], y, wp[2]]);
      }
    }
    if (dist < 0.3 && Math.abs(dy) < 1) {
      e.pathI++;
      e.stuck = 0;
      if (e.pathI >= e.path.length) { e.moving = false; e.path = null; }
      return;
    }
    if (dy > 0 && dist < 0.6) e.climb = 1;
    else if (dy < 0 && dist < 0.6 && CLIMB[w.getBlock(wp[0], wp[1], wp[2])]) e.climb = -1;
    e.yaw = Math.atan2(-dx, -dz);
    e.moving = dist > 0.15;
    if (e.climb) { e.moving = dist > 0.2; }
    // Not getting anywhere: think again, and after a few goes give up.
    const prog = dist + Math.abs(dy);
    if (prog >= (e.lastProg ?? Infinity) - 0.01) {
      if (++e.stuck > 50) {
        e.stuck = 0;
        if (++e.repaths > 3) { e.path = null; e.repaths = 0; e.moving = false; e.gaveUp = true; e.retry = 100; return; }
        e.goalKey = '';
      }
    } else e.stuck = Math.max(0, e.stuck - 1);
    e.lastProg = prog;
  }

  // ---------------------------------------------------------------- route finding
  passable(id) { return !SOLID[id] || !!DOOR[id] || !!GATE[id] || !!CLIMB[id]; }
  standable(id) { return !!SOLID[id] && !DOOR[id] && !GATE[id] && SHAPE_KIND[id] !== 2 && SHAPE_KIND[id] !== 4 && !WATERLIKE[id]; }
  hazard(id) { return id === B.fire || id === B.campfire || id === B.cactus || WATERLIKE[id] === 2 || id === B.lava; }
  walkable(x, y, z) {
    const w = this.world, a = w.getBlock(x, y, z), b = w.getBlock(x, y + 1, z), f = w.getBlock(x, y - 1, z);
    if (!this.passable(a) || !this.passable(b) || this.hazard(a) || this.hazard(f) || WATERLIKE[a] === 1) return false;
    return this.standable(f) || !!CLIMB[a] || !!CLIMB[f] || !!BED[f];
  }

  // A* over the cells feet can stand in, within the village. Returns waypoints or null.
  findPath(from, to, limit = 3000, near = false) {
    const ox = from[0] - 128, oz = from[2] - 128;
    const key = (x, y, z) => ((x - ox) & 255) | ((z - oz) & 255) << 8 | (y & 255) << 16;
    if (Math.abs(to[0] - from[0]) > 120 || Math.abs(to[2] - from[2]) > 120) return null;
    const open = new Heap(), g = new Map(), came = new Map();
    const h = (x, y, z) => Math.abs(x - to[0]) + Math.abs(z - to[2]) + Math.abs(y - to[1]) * 1.5;
    const k0 = key(...from);
    g.set(k0, 0);
    open.push([h(...from), ...from]);
    let n = 0;
    const w = this.world;
    while (open.size && n++ < limit) {
      const [, x, y, z] = open.pop();
      const kc = key(x, y, z), gc = g.get(kc);
      if (Math.abs(x - to[0]) + Math.abs(z - to[2]) <= (near ? 1 : 0) && Math.abs(y - to[1]) <= 1) {
        const out = [];
        let k = kc, p = [x, y, z];
        while (k !== k0) { out.push(p); const c = came.get(k); k = c.k; p = c.p; }
        return out.reverse();
      }
      const add = (nx, ny, nz, cost) => {
        const kk = key(nx, ny, nz), ng = gc + cost;
        if (ng >= (g.get(kk) ?? Infinity)) return;
        g.set(kk, ng);
        came.set(kk, { k: kc, p: [x, y, z] });
        open.push([ng + h(nx, ny, nz), nx, ny, nz]);
      };
      for (const [ddx, ddz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + ddx, nz = z + ddz;
        const door = DOOR[w.getBlock(nx, y, nz)] || GATE[w.getBlock(nx, y, nz)] ? 1.5 : 0;
        if (this.walkable(nx, y, nz)) { add(nx, y, nz, 1 + door); continue; }
        if (this.walkable(nx, y + 1, nz) && this.passable(w.getBlock(x, y + 2, z))) { add(nx, y + 1, nz, 2); continue; }
        for (let drop = 1; drop <= 3; drop++) {
          if (!this.passable(w.getBlock(nx, y - drop + 1, nz))) break;
          if (this.walkable(nx, y - drop, nz)) { add(nx, y - drop, nz, 1 + drop * 0.5); break; }
        }
      }
      // Ladders.
      if (CLIMB[w.getBlock(x, y, z)] || CLIMB[w.getBlock(x, y - 1, z)]) {
        if (this.passable(w.getBlock(x, y + 1, z)) && this.passable(w.getBlock(x, y + 2, z)) && (CLIMB[w.getBlock(x, y + 1, z)] || this.walkable(x, y + 1, z))) add(x, y + 1, z, 1.5);
        if (CLIMB[w.getBlock(x, y - 1, z)]) add(x, y - 1, z, 1.2);
      }
    }
    return null;
  }

  // ---------------------------------------------------------------- talking
  voice(e) { this.game.audio.voice?.({ x: e.x, y: e.y + 1.6, z: e.z }, e.voice ?? 1); }

  // Right-click: they turn to you and the conversation opens.
  talk(e) {
    const game = this.game, p = game.player;
    if (e.pose === 'sleep') { game.ui.message(`${e.name} is fast asleep.`); return; }
    if (!e.remote) e.talking = { x: p.x, y: p.y, z: p.z };
    this.voice(e);
    game.openTalk?.(e);
  }
  // Their greeting: by the hour, the weather and how they feel about you.
  greeting(e) {
    const game = this.game, v = e.village, rec = v ? this.record(v) : { rep: 0 };
    const pickFrom = (list) => list[Math.floor(Math.random() * list.length)];
    let line = rec.rep < -5 ? pickFrom(GREET_ANGRY) : GREET_AS[e.role] && Math.random() < 0.7 ? pickFrom(GREET_AS[e.role])
      : game.env.daylight < 0.3 ? pickFrom(GREET_NIGHT) : game.weather.rain > 0.5 && Math.random() < 0.5 ? pickFrom(GREET_RAIN) : pickFrom(GREET);
    line = line.replace('{v}', v ? villageName(v) : 'our village');
    return line;
  }
  chatLine(e) {
    const lines = [...(CHAT[e.role] ?? []), ...(Math.random() < 0.3 ? RUMOURS : [])];
    return lines[Math.floor(Math.random() * lines.length)] ?? 'Hm.';
  }
  intro(e) {
    const title = ROLES[e.role]?.title ?? 'villager', v = e.village ? villageName(e.village) : 'here', kind = KIND[e.village?.tier] ?? 'village';
    const bits = {
      merchant: kind === 'camp' ? 'I trade along the roads.' : 'I keep a stall in the market square.', guard: 'I keep watch over the gates.',
      blacksmith: 'I work the forge.', butcher: 'I run the butcher\'s shop.', hunter: kind === 'camp' ? 'I hunt these woods.' : 'I hunt the woods beyond the walls.',
      librarian: 'I keep the library.', innkeeper: 'I run the tavern.', baker: 'I bake the bread.', farmer: 'I work the fields.', shepherd: 'I tend the flocks.',
      miner: 'I dig in the mine, down below the town.', fisher: 'I fish the waters round about.', knight: 'I serve the crown, and guard the castle.',
      cleric: 'I tend the church, and heal the sick.', woodcutter: kind === 'camp' ? 'We fell timber here, then move on.' : 'I cut the timber for the town.',
      traveller: "I'm passing through - we've come a long way.", mason: 'I cut the stone for our walls and houses.', stablehand: 'I look after the horses.',
    };
    if (e.role === 'king') return `I am ${e.name}, and ${v} is my kingdom. My knights keep its roads, my people its fields.`;
    if (e.role === 'queen') return `I am ${e.name} of ${v}. The king and I hold court here in the great hall.`;
    return `I'm ${e.name}, the ${title.toLowerCase()}${kind === 'camp' ? '' : ` of ${v}`}. ${bits[e.role] ?? ''}`;
  }
  // "Where is the smithy?" - from where the player stands.
  directions(e, place) {
    const v = e.village, p = this.game.player;
    if (!v) return "I'm not from round here, sorry.";
    const b = [...v.buildings, ...(v.landmarks ?? [])].find((x) => x.type === place && (x.doors?.length || x.landmark || place === 'farm'));
    const name = PLACES.find(([k]) => k === place)?.[1] ?? place;
    if (!b) return `We haven't got ${name} in ${villageName(v)}, I'm afraid.`;
    const [x0, z0, x1, z1] = b.box;
    const tx = v.x + (x0 + x1) / 2, tz = v.z + (z0 + z1) / 2;
    const dx = tx - p.x, dz = tz - p.z, dist = Math.round(Math.hypot(dx, dz));
    if (dist < 6) return `You're standing right by ${name}!`;
    const ang = Math.atan2(dx, -dz), dir = COMPASS[(Math.round(ang / (Math.PI / 4)) + 8) % 8];
    return `${name[0].toUpperCase()}${name.slice(1)}? Head ${dir}, about ${dist} blocks.`;
  }
  places(e) { return e.village ? PLACES.filter(([k]) => [...e.village.buildings, ...(e.village.landmarks ?? [])].some((b) => b.type === k)) : []; }

  // Their offers today: [{ kind, id, count, price, left }].
  offers(e) {
    const role = ROLES[e.role];
    if (!role) return [];
    const r = mulberry32(hashString(e.rid ?? e.name ?? 'x'));
    const list = role.trades.filter((tr) => (I[tr[1]] ?? B[tr[1]]) !== undefined);
    // Each person deals in five to seven of their trade's goods, at their own prices.
    const picked = list.map((tr) => ({ tr, k: r() })).sort((a, b) => a.k - b.k).slice(0, 5 + Math.floor(r() * 3)).map((x) => x.tr);
    const rec = e.village ? this.record(e.village) : null;
    const day = Math.floor(this.game.time / TICKS_PER_DAY);
    if (rec && rec.day !== day) { rec.day = day; rec.used = {}; }
    const mood = rec ? (rec.rep >= 10 ? -1 : rec.rep < -5 ? 1 : 0) : 0;
    return picked.map(([kind, name, count, price], i) => {
      const id = I[name] ?? B[name];
      // A librarian's enchanted books: one enchantment each, dearer the higher it goes.
      let ench = null;
      if (name === 'enchanted_book') {
        ench = randomBook(true, r);
        const [n, lv] = Object.entries(ench)[0];
        price = 4 + lv * 4 + Math.floor(r() * 6) + (ENCHANTS[n].treasure ? 12 : 0);
      }
      const p = clamp(price + (r() < 0.25 ? 1 : 0) + (kind === 'buy' ? mood : -mood), 1, 64);
      const key = `${e.rid}:${i}`, used = rec?.used[key] ?? 0;
      const stock = ench ? 1 + Math.floor(r() * 2) : kind === 'buy' ? 6 + Math.floor(r() * 6) : 10 + Math.floor(r() * 8);
      return { kind, id, count, price: p, left: Math.max(0, stock - used), key, ench };
    });
  }
  // Makes a trade: true when it went through.
  trade(e, offer) {
    const game = this.game, inv = game.inv, coin = I.gold_coin;
    if (offer.left <= 0) return false;
    if (offer.kind === 'buy') {
      if (!game.creative && inv.count(coin) < offer.price) return false;
      if (!game.creative) inv.take(coin, offer.price);
      const x = offer.ench ? { ench: { ...offer.ench } } : null;
      const left = inv.add(offer.id, offer.count, 0, x);
      if (left) game.entities.dropItem(game.player, { id: offer.id, count: left, dmg: 0, ...x });
    } else {
      if (inv.count(offer.id) < offer.count) return false;
      inv.take(offer.id, offer.count);
      const left = inv.add(coin, offer.price);
      if (left) game.entities.dropItem(game.player, { id: coin, count: left, dmg: 0 });
    }
    offer.left--;
    if (e.village) {
      const rec = this.record(e.village);
      rec.used[offer.key] = (rec.used[offer.key] ?? 0) + 1;
      rec.rep = Math.min(30, rec.rep + 0.5);
    }
    game.particles.icons(TEX.happy, e.x, e.y + 1.8, e.z, 6, 0.4);
    game.audio.trade?.();
    game.dropXp(e.x, e.y + 1, e.z, 3 + Math.floor(Math.random() * 4));
    game.invChanged();
    return true;
  }
}

// A binary heap of [priority, ...] arrays (smallest first).
class Heap {
  constructor() { this.a = []; }
  get size() { return this.a.length; }
  push(v) {
    const a = this.a;
    a.push(v);
    let i = a.length - 1;
    while (i > 0) { const p = (i - 1) >> 1; if (a[p][0] <= a[i][0]) break; [a[p], a[i]] = [a[i], a[p]]; i = p; }
  }
  pop() {
    const a = this.a, top = a[0], last = a.pop();
    if (a.length) {
      a[0] = last;
      let i = 0;
      for (;;) {
        const l = i * 2 + 1, r = l + 1;
        let m = i;
        if (l < a.length && a[l][0] < a[m][0]) m = l;
        if (r < a.length && a[r][0] < a[m][0]) m = r;
        if (m === i) break;
        [a[m], a[i]] = [a[i], a[m]];
        i = m;
      }
    }
    return top;
  }
}

