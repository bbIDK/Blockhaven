// Item registry: every placeable block is also an item (same id); tools and materials use ids 256+.
// Recipes live in crafting.js.
import { BLOCKS, B, BASE } from './blocks.js';
import { TEX } from './textures.js';

export const ITEMS = new Map();
export const I = {};

for (const d of BLOCKS) {
  if (!d || !d.item) continue;
  ITEMS.set(d.id, { id: d.id, name: d.name, label: d.label, block: d.id, stack: 64 });
  I[d.name] = d.id;
}

function item(id, name, o = {}) {
  if (ITEMS.has(id)) throw new Error(`Item id ${id} used twice`);
  if (!(name in TEX)) throw new Error(`Missing item texture ${name}`);
  const label = o.label ?? name.split('_').map((w) => w[0].toUpperCase() + w.slice(1)).join(' ');
  ITEMS.set(id, { id, name, label, block: null, tex: TEX[name], stack: o.stack ?? 64, ...o });
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
item(292, 'raw_chicken', { label: 'Raw Chicken', food: 2, sat: 0.3 });
item(293, 'cooked_chicken', { label: 'Cooked Chicken', food: 6, sat: 0.6 });
item(294, 'rotten_flesh', { label: 'Rotten Flesh', food: 4, sat: 0.1 });
item(295, 'leather');
item(296, 'feather');
item(297, 'book');
item(298, 'bowl');
item(299, 'mushroom_stew', { label: 'Mushroom Stew', stack: 1, food: 6, sat: 0.6, leftover: 'bowl' });

// Weapons and tools use the combat numbers of Minecraft 1.9 onwards: every hit has a wind-up
// (attack speed, in full-strength hits per second) and the damage of a full-strength hit.
// Columns: wooden, stone, iron, diamond, golden.
const TOOL_STATS = {
  pickaxe: { damage: [2, 3, 4, 5, 2], speed: [1.2, 1.2, 1.2, 1.2, 1.2] },
  axe: { damage: [7, 9, 9, 9, 7], speed: [0.8, 0.8, 0.9, 1, 1] },
  shovel: { damage: [2.5, 3.5, 4.5, 5.5, 2.5], speed: [1, 1, 1, 1, 1] },
  sword: { damage: [4, 5, 6, 7, 4], speed: [1.6, 1.6, 1.6, 1.6, 1.6] },
};
export const HAND_DAMAGE = 1;
export const HAND_SPEED = 4;
const MATS = ['wooden', 'stone', 'iron', 'diamond'];
const SPEED = [2, 4, 6, 8];
const DURABILITY = [59, 131, 250, 1561];
const KINDS = ['pickaxe', 'axe', 'shovel', 'sword'];
KINDS.forEach((kind, k) => {
  const stats = TOOL_STATS[kind];
  MATS.forEach((mat, tier) => {
    item(270 + k * 4 + tier, `${mat}_${kind}`, {
      stack: 1,
      durability: DURABILITY[tier],
      damage: stats.damage[tier],
      attackSpeed: stats.speed[tier],
      tool: kind === 'sword' ? null : { type: kind, tier: tier + 1, speed: SPEED[tier] },
      weapon: kind === 'sword',
    });
  });
  // Golden tools: very fast but fragile, and only as strong as wood.
  item(286 + k, `golden_${kind}`, {
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
];
ARMOR.forEach(([mat, points, durability, toughness, labels], m) => {
  ARMOR_PIECES.forEach((piece, p) => {
    item(300 + m * 4 + p, `${mat}_${piece}`, {
      ...(labels ? { label: labels[p] } : {}),
      stack: 1,
      durability: durability[p],
      armor: { slot: p, points: points[p], toughness, material: mat },
    });
  });
});

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
export function breakTime(block, tool) {
  if (block.hardness < 0) return Infinity;
  if (block.hardness === 0) return 0;
  const t = tool && ITEMS.get(tool)?.tool;
  const speed = t && t.type === block.tool ? t.speed : 1;
  return (block.hardness * (canHarvest(block, tool) ? 1.5 : 5)) / speed;
}

// What a block drops in survival: [{ id, count }].
export function dropsFor(blockId, tool, rand = Math.random) {
  const block = BLOCKS[blockId];
  if (!block || !canHarvest(block, tool)) return [];
  if (block.name === 'oak_leaves' || block.name === 'birch_leaves') return rand() < 0.05 ? [{ id: I.apple, count: 1 }] : [];
  if (block.name === 'gravel' && rand() < 0.1) return [{ id: I.flint, count: 1 }];
  if (block.name === 'dead_bush') return [{ id: I.stick, count: Math.floor(rand() * 3) }].filter((d) => d.count);
  if (block.name === 'clay') return [{ id: I.clay_ball, count: 4 }];
  if (block.name === 'bookshelf') return [{ id: I.book, count: 3 }];
  if (!block.drop) return [];
  const id = I[block.drop] ?? B[block.drop];
  return id === undefined ? [] : [{ id, count: 1 }];
}
