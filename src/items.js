// Item registry: every placeable block is also an item (same id); tools and materials use ids 256+.
// Recipes live in crafting.js.
import { BLOCKS, B, BASE, CROP, LEAVES_WOOD, DOUBLE, POTTED } from './blocks.js';
import { TEX } from './textures.js';
import { DYES, rgb } from './colors.js';
import { leafDrops } from './growth.js';
import { POTIONS, POTION_NAMES } from './potions.js';

export const ITEMS = new Map();
export const I = {};

for (const d of BLOCKS) {
  if (!d || !d.item) continue;
  ITEMS.set(d.id, { id: d.id, name: d.name, label: d.label, block: d.id, stack: 64 });
  I[d.name] = d.id;
}

function item(id, name, o = {}) {
  if (ITEMS.has(id)) throw new Error(`Item id ${id} used twice`);
  if (o.tex === undefined && !(name in TEX)) throw new Error(`Missing item texture ${name}`);
  const label = o.label ?? name.split('_').map((w) => w[0].toUpperCase() + w.slice(1)).join(' ');
  ITEMS.set(id, { id, name, label, block: null, tex: TEX[name], stack: o.stack ?? 64, tint: null, ...o });
  I[name] = id;
}

item(256, 'stick');
item(257, 'coal');
item(258, 'iron_ingot');
item(259, 'gold_ingot');
item(260, 'diamond');
item(261, 'flint');
item(262, 'apple', { food: 4, sat: 0.3 });
item(263, 'raw_porkchop', { label: 'Raw Porkchop', food: 3, sat: 0.3 });
item(264, 'cooked_porkchop', { label: 'Cooked Porkchop', food: 8, sat: 0.8 });
item(265, 'flint_and_steel', { label: 'Flint and Steel', stack: 1, durability: 64 });
item(266, 'charcoal');
item(267, 'clay_ball', { label: 'Clay Ball' });
item(268, 'brick');
item(269, 'paper');
item(290, 'raw_beef', { label: 'Raw Beef', food: 3, sat: 0.3 });
item(291, 'cooked_beef', { label: 'Steak', food: 8, sat: 0.8 });
item(292, 'raw_chicken', { label: 'Raw Chicken', food: 2, sat: 0.3, effects: [['hunger', 30, 1, 0.3]] });
item(293, 'cooked_chicken', { label: 'Cooked Chicken', food: 6, sat: 0.6 });
item(294, 'rotten_flesh', { label: 'Rotten Flesh', food: 4, sat: 0.1, effects: [['hunger', 30, 1, 0.8]] });
item(295, 'leather');
item(296, 'feather');
item(297, 'book');
item(298, 'bowl');
item(299, 'mushroom_stew', { label: 'Mushroom Stew', stack: 1, food: 6, sat: 0.6, leftover: 'bowl' });

// ---------------------------------------------------------------- the release update's items
item(325, 'raw_iron', { label: 'Raw Iron' });
item(326, 'raw_gold', { label: 'Raw Gold' });
item(327, 'raw_copper', { label: 'Raw Copper' });
item(328, 'copper_ingot', { label: 'Copper Ingot' });
item(329, 'iron_nugget', { label: 'Iron Nugget' });
item(330, 'gold_nugget', { label: 'Gold Nugget' });
item(331, 'emerald');
item(332, 'lapis_lazuli', { label: 'Lapis Lazuli' });
item(333, 'redstone', { label: 'Redstone Dust' });
item(334, 'string');
item(335, 'bone');
item(336, 'bone_meal', { label: 'Bone Meal' });
item(337, 'gunpowder');
item(338, 'slime_ball', { label: 'Slimeball' });
item(339, 'ender_pearl', { label: 'Ender Pearl', stack: 16 });
item(340, 'rabbit_hide', { label: 'Rabbit Hide' });
item(341, 'wheat');
item(342, 'wheat_seeds', { label: 'Wheat Seeds', plant: 'wheat' });
item(343, 'beetroot_seeds', { label: 'Beetroot Seeds', plant: 'beetroots' });
item(344, 'sugar');
item(345, 'egg', { stack: 16 });
// The money of the villages: civilians buy and sell for gold coins (see villagers.js).
item(346, 'gold_coin', { label: 'Gold Coin' });
item(347, 'arrow');
item(348, 'bow', { stack: 1, durability: 384 });
item(349, 'bucket', { stack: 16 });
item(350, 'water_bucket', { label: 'Water Bucket', stack: 1, leftover: 'bucket' });
item(351, 'lava_bucket', { label: 'Lava Bucket', stack: 1, leftover: 'bucket' });
item(352, 'milk_bucket', { label: 'Milk Bucket', stack: 1, leftover: 'bucket', drink: true });
item(353, 'shears', { stack: 1, durability: 238, shears: true });
item(354, 'compass');
item(355, 'clock');
item(356, 'golden_apple', { label: 'Golden Apple', food: 4, sat: 1.2, effects: [['regeneration', 5, 2]], always: true });
item(357, 'bread', { food: 5, sat: 0.6 });
item(358, 'carrot', { food: 3, sat: 0.6, plant: 'carrots' });
item(359, 'golden_carrot', { label: 'Golden Carrot', food: 6, sat: 1.2 });
item(360, 'potato', { food: 1, sat: 0.3, plant: 'potatoes' });
item(361, 'baked_potato', { label: 'Baked Potato', food: 5, sat: 0.6 });
item(362, 'poisonous_potato', { label: 'Poisonous Potato', food: 2, sat: 0.3, effects: [['poison', 5, 1, 0.6]] });
item(363, 'beetroot', { food: 1, sat: 0.6 });
item(364, 'beetroot_soup', { label: 'Beetroot Soup', stack: 1, food: 6, sat: 0.6, leftover: 'bowl' });
item(365, 'melon_slice', { label: 'Melon Slice', food: 2, sat: 0.3 });
item(366, 'pumpkin_pie', { label: 'Pumpkin Pie', food: 8, sat: 0.3 });
item(367, 'cookie', { food: 2, sat: 0.1 });
item(368, 'raw_mutton', { label: 'Raw Mutton', food: 2, sat: 0.3 });
item(369, 'cooked_mutton', { label: 'Cooked Mutton', food: 6, sat: 0.8 });
item(370, 'raw_rabbit', { label: 'Raw Rabbit', food: 3, sat: 0.3 });
item(371, 'cooked_rabbit', { label: 'Cooked Rabbit', food: 5, sat: 0.6 });
item(372, 'cod', { label: 'Raw Cod', food: 2, sat: 0.1 });
item(373, 'cooked_cod', { label: 'Cooked Cod', food: 5, sat: 0.6 });
item(374, 'salmon', { label: 'Raw Salmon', food: 2, sat: 0.1 });
item(375, 'cooked_salmon', { label: 'Cooked Salmon', food: 6, sat: 0.8 });
item(376, 'spider_eye', { label: 'Spider Eye', food: 2, sat: 0.8, effects: [['poison', 5, 1]] });
item(377, 'rabbit_stew', { label: 'Rabbit Stew', stack: 1, food: 10, sat: 0.6, leftover: 'bowl' });
item(378, 'fishing_rod', { label: 'Fishing Rod', stack: 1, durability: 64 });
item(379, 'saddle', { stack: 1 });
['oak', 'spruce', 'birch', 'jungle', 'acacia', 'dark_oak', 'cherry'].forEach((wood, i) => item(400 + i, `${wood}_boat`, { stack: 1, boat: wood }));
item(407, 'tropical_fish', { label: 'Tropical Fish', food: 1, sat: 0.1 });
item(408, 'pufferfish', { food: 1, sat: 0.1, effects: [['poison', 60, 2], ['hunger', 15, 3]] });
item(409, 'enchanted_book', { label: 'Enchanted Book', stack: 1 });
item(410, 'glass_bottle', { label: 'Glass Bottle' });
item(411, 'phantom_membrane', { label: 'Phantom Membrane' });
item(436, 'snowball', { stack: 16, throws: 'snowball' });
// A name tag (named at an anvil) gives a creature a name; a lead leads it about.
item(437, 'name_tag', { label: 'Name Tag' });
item(438, 'lead', { label: 'Lead' });
// Potions (see potions.js): drunk from the bottle, or thrown to break over everyone nearby.
POTION_NAMES.forEach((name, i) => {
  const label = POTIONS[name].label;
  item(412 + i, `potion_${name}`, { label: `Potion of ${label}`, stack: 1, potion: name, leftover: 'glass_bottle' });
  item(424 + i, `splash_potion_${name}`, { label: `Splash Potion of ${label}`, stack: 1, splash: name });
});
// (Only ever seen in a hand: the rod while its line is out.)
item(1020, 'fishing_rod_cast', { label: 'Fishing Rod', stack: 1, hidden: true });
// Dyes are one texture in sixteen colours.
DYES.forEach((d, i) => item(380 + i, `${d.name}_dye`, { tex: TEX.dye, tint: rgb(d.dye),
  label: `${d.name === 'light_gray' ? 'Light Gray' : d.name === 'light_blue' ? 'Light Blue' : d.name[0].toUpperCase() + d.name.slice(1)} Dye` }));

// Weapons and tools use the combat numbers of Minecraft 1.9 onwards: every hit has a wind-up
// (attack speed, in full-strength hits per second) and the damage of a full-strength hit.
// Columns: wooden, stone, iron, diamond, golden.
const TOOL_STATS = {
  pickaxe: { damage: [2, 3, 4, 5, 2], speed: [1.2, 1.2, 1.2, 1.2, 1.2] },
  axe: { damage: [7, 9, 9, 9, 7], speed: [0.8, 0.8, 0.9, 1, 1] },
  shovel: { damage: [2.5, 3.5, 4.5, 5.5, 2.5], speed: [1, 1, 1, 1, 1] },
  sword: { damage: [4, 5, 6, 7, 4], speed: [1.6, 1.6, 1.6, 1.6, 1.6] },
  hoe: { damage: [1, 1, 1, 1, 1], speed: [1, 2, 3, 4, 1] },
};
export const HAND_DAMAGE = 1;
export const HAND_SPEED = 4;
const MATS = ['wooden', 'stone', 'iron', 'diamond'];
const SPEED = [2, 4, 6, 8];
const DURABILITY = [59, 131, 250, 1561];
const KINDS = ['pickaxe', 'axe', 'shovel', 'sword', 'hoe'];
KINDS.forEach((kind, k) => {
  const stats = TOOL_STATS[kind];
  MATS.forEach((mat, tier) => {
    // (Hoes came later, so theirs are the ids after the armour.)
    item(kind === 'hoe' ? 320 + tier : 270 + k * 4 + tier, `${mat}_${kind}`, {
      stack: 1,
      durability: DURABILITY[tier],
      damage: stats.damage[tier],
      attackSpeed: stats.speed[tier],
      tool: kind === 'sword' ? null : { type: kind, tier: tier + 1, speed: SPEED[tier] },
      weapon: kind === 'sword',
    });
  });
  // Golden tools: very fast but fragile, and only as strong as wood.
  item(kind === 'hoe' ? 324 : 286 + k, `golden_${kind}`, {
    stack: 1,
    durability: 32,
    damage: stats.damage[4],
    attackSpeed: stats.speed[4],
    tool: kind === 'sword' ? null : { type: kind, tier: 1, speed: 12 },
    weapon: kind === 'sword',
  });
});

// Armor: [material, armor points per piece, durability per piece, toughness]. Pieces go
// helmet, chestplate, leggings, boots, which is also the order of the armor slots.
export const ARMOR_PIECES = ['helmet', 'chestplate', 'leggings', 'boots'];
const ARMOR = [
  ['leather', [1, 3, 2, 1], [55, 80, 75, 65], 0, ['Leather Cap', 'Leather Tunic', 'Leather Pants', 'Leather Boots']],
  ['iron', [2, 6, 5, 2], [165, 240, 225, 195], 0],
  ['golden', [2, 5, 3, 1], [77, 112, 105, 91], 0],
  ['diamond', [3, 8, 6, 3], [363, 528, 495, 429], 2],
  ['chainmail', [2, 5, 4, 1], [165, 240, 225, 195], 0],
];
ARMOR.forEach(([mat, points, durability, toughness, labels], m) => {
  ARMOR_PIECES.forEach((piece, p) => {
    item(m === 4 ? 316 + p : 300 + m * 4 + p, `${mat}_${piece}`, {
      ...(labels ? { label: labels[p] } : {}),
      stack: 1,
      durability: durability[p],
      armor: { slot: p, points: points[p], toughness, material: mat },
    });
  });
});

// (Signs stack to sixteen; cakes don't stack.)
ITEMS.get(B.sign).stack = 16;
ITEMS.get(B.cake).stack = 1;

export const itemDef = (id) => ITEMS.get(id);
export const itemLabel = (id) => ITEMS.get(id)?.label ?? 'Unknown';
export const maxStack = (id) => ITEMS.get(id)?.stack ?? 64;
export const blockOfItem = (id) => ITEMS.get(id)?.block ?? null;
export const itemOfBlock = (blockId) => BASE[blockId];
export const attackDamage = (id) => ITEMS.get(id)?.damage ?? HAND_DAMAGE;
export const attackSpeed = (id) => ITEMS.get(id)?.attackSpeed ?? HAND_SPEED;

export function canHarvest(block, tool) {
  if (!block.tier) return true;
  const t = tool && ITEMS.get(tool)?.tool;
  return !!t && t.type === block.tool && t.tier >= block.tier;
}

// Seconds to break `block` holding item `tool` (Minecraft's hand/tool formula).
// (`efficiency`: the tool's Efficiency level, which speeds it up on what it's meant for.)
export function breakTime(block, tool, efficiency = 0) {
  if (block.hardness < 0) return Infinity;
  if (block.hardness === 0) return 0;
  const t = tool && ITEMS.get(tool)?.tool;
  let speed = t && t.type === block.tool ? t.speed : 1;
  if (efficiency && speed > 1) speed += efficiency * efficiency + 1;
  return (block.hardness * (canHarvest(block, tool) ? 1.5 : 5)) / speed;
}

// What a block drops in survival: [{ id, count }].
const SHEARABLE = new Set(['tall_grass', 'fern', 'tall_grass_double', 'large_fern', 'dead_bush', 'vine']);
export function dropsFor(blockId, tool, rand = Math.random) {
  const block = BLOCKS[blockId];
  if (!block) return [];
  const base = BLOCKS[BASE[blockId]];
  const n = (a, b) => a + Math.floor(rand() * (b - a + 1));
  const one = (name, count = 1) => (count > 0 ? [{ id: I[name] ?? B[name], count }] : []);
  // Shears take leaves, vines and grasses whole.
  if (ITEMS.get(tool)?.shears && (LEAVES_WOOD[blockId] || SHEARABLE.has(base.name))) return [{ id: BASE[blockId], count: 1 }];
  if (!canHarvest(block, tool)) return [];
  if (LEAVES_WOOD[blockId]) return leafDrops(blockId, rand).map((d) => ({ id: d.block ?? I[d.item], count: d.count }));
  const crop = CROP[blockId];
  if (crop) {
    const ripe = crop.stage === crop.max;
    switch (crop.name) {
      case 'wheat': return ripe ? [...one('wheat'), ...one('wheat_seeds', n(1, 3))] : one('wheat_seeds');
      case 'carrots': return one('carrot', ripe ? n(2, 5) : 1);
      case 'potatoes': return [...one('potato', ripe ? n(2, 5) : 1), ...(ripe && rand() < 0.02 ? one('poisonous_potato') : [])];
      default: return ripe ? [...one('beetroot'), ...one('beetroot_seeds', n(1, 3))] : one('beetroot_seeds');
    }
  }
  if (POTTED[blockId] !== undefined) return [{ id: B.flower_pot, count: 1 }, { id: POTTED[blockId], count: 1 }];
  switch (base.name) {
    case 'tall_grass': case 'fern': return rand() < 0.125 ? one('wheat_seeds') : [];
    case 'tall_grass_double': case 'large_fern': return DOUBLE[blockId]?.upper ? [] : rand() < 0.125 ? one('wheat_seeds') : [];
    case 'gravel': if (rand() < 0.1) return one('flint'); break;
    case 'dead_bush': return one('stick', n(0, 2));
    case 'clay': return one('clay_ball', 4);
    case 'snow_block': return one('snowball', 4);
    case 'snow': return one('snowball');
    case 'bookshelf': return one('book', 3);
    case 'melon': return one('melon_slice', n(3, 7));
    case 'campfire': return one('charcoal', 2);
    case 'copper_ore': case 'deepslate_copper_ore': return one('raw_copper', n(2, 5));
    case 'redstone_ore': case 'deepslate_redstone_ore': return one('redstone', n(4, 5));
    case 'lapis_ore': case 'deepslate_lapis_ore': return one('lapis_lazuli', n(4, 9));
    default:
  }
  if (!block.drop) return [];
  const id = I[block.drop] ?? B[block.drop];
  return id === undefined ? [] : [{ id, count: 1 }];
}
