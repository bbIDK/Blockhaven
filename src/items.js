// Item registry: every placeable block is also an item (same id); tools and materials use ids 256+.
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
item(262, 'apple', { food: 4 });
item(263, 'raw_porkchop', { label: 'Raw Porkchop', food: 3 });
item(264, 'cooked_porkchop', { label: 'Cooked Porkchop', food: 8 });
item(265, 'flint_and_steel', { label: 'Flint and Steel', stack: 1, durability: 64 });

const MATS = ['wooden', 'stone', 'iron', 'diamond'];
const SPEED = [2, 4, 6, 8];
const DURABILITY = [59, 131, 250, 1561];
const KINDS = [['pickaxe', 2], ['axe', 3], ['shovel', 1.5], ['sword', 4]];
KINDS.forEach(([kind, baseDamage], k) => {
  MATS.forEach((mat, tier) => {
    item(270 + k * 4 + tier, `${mat}_${kind}`, {
      stack: 1,
      durability: DURABILITY[tier],
      damage: baseDamage + tier,
      tool: kind === 'sword' ? null : { type: kind, tier: tier + 1, speed: SPEED[tier] },
      weapon: kind === 'sword',
    });
  });
});

export const itemDef = (id) => ITEMS.get(id);
export const itemLabel = (id) => ITEMS.get(id)?.label ?? 'Unknown';
export const maxStack = (id) => ITEMS.get(id)?.stack ?? 64;
export const blockOfItem = (id) => ITEMS.get(id)?.block ?? null;
export const itemOfBlock = (blockId) => BASE[blockId];

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
  if (!block.drop) return [];
  const id = I[block.drop] ?? B[block.drop];
  return id === undefined ? [] : [{ id, count: 1 }];
}

const PLANKS = ['oak_planks', 'birch_planks', 'spruce_planks'].map((n) => B[n]);
export const GROUPS = { planks: PLANKS, logs: ['oak_log', 'birch_log', 'spruce_log'].map((n) => B[n]) };

const r = (out, count, input, station = null) => ({ out: I[out], count, input, station });
const tool = (mat, material) => [
  r(`${mat}_pickaxe`, 1, [[material, 3], ['stick', 2]], 'table'),
  r(`${mat}_axe`, 1, [[material, 3], ['stick', 2]], 'table'),
  r(`${mat}_shovel`, 1, [[material, 1], ['stick', 2]], 'table'),
  r(`${mat}_sword`, 1, [[material, 2], ['stick', 1]], 'table'),
];

// Recipes are shapeless: ingredients by count. '#group' matches any member of a group.
export const RECIPES = [
  r('oak_planks', 4, [['oak_log', 1]]),
  r('birch_planks', 4, [['birch_log', 1]]),
  r('spruce_planks', 4, [['spruce_log', 1]]),
  r('stick', 4, [['#planks', 2]]),
  r('crafting_table', 1, [['#planks', 4]]),
  r('torch', 4, [['coal', 1], ['stick', 1]]),
  ...tool('wooden', '#planks'),
  ...tool('stone', 'cobblestone'),
  ...tool('iron', 'iron_ingot'),
  ...tool('diamond', 'diamond'),
  r('furnace', 1, [['cobblestone', 8]], 'table'),
  r('stone_bricks', 4, [['stone', 4]], 'table'),
  r('sandstone', 1, [['sand', 4]]),
  r('bookshelf', 1, [['#planks', 6], ['sugar_cane', 3]], 'table'),
  r('jack_o_lantern', 1, [['pumpkin', 1], ['torch', 1]]),
  r('tnt', 1, [['sand', 4], ['coal', 5]], 'table'),
  r('flint_and_steel', 1, [['iron_ingot', 1], ['flint', 1]]),
  r('iron_block', 1, [['iron_ingot', 9]], 'table'),
  r('gold_block', 1, [['gold_ingot', 9]], 'table'),
  r('diamond_block', 1, [['diamond', 9]], 'table'),
  r('coal_block', 1, [['coal', 9]], 'table'),
  r('iron_ingot', 9, [['iron_block', 1]]),
  r('gold_ingot', 9, [['gold_block', 1]]),
  r('diamond', 9, [['diamond_block', 1]]),
  r('coal', 9, [['coal_block', 1]]),
  ...['oak', 'birch', 'spruce'].map((w) => r(`${w}_slab`, 6, [[`${w}_planks`, 3]], 'table')),
  r('cobblestone_slab', 6, [['cobblestone', 3]], 'table'),
  r('stone_slab', 6, [['stone', 3]], 'table'),
  r('brick_slab', 6, [['bricks', 3]], 'table'),
  r('stone_brick_slab', 6, [['stone_bricks', 3]], 'table'),
  r('sandstone_slab', 6, [['sandstone', 3]], 'table'),
  r('oak_stairs', 4, [['#planks', 6]], 'table'),
  r('cobblestone_stairs', 4, [['cobblestone', 6]], 'table'),
  r('stone_brick_stairs', 4, [['stone_bricks', 6]], 'table'),
  r('brick_stairs', 4, [['bricks', 6]], 'table'),
  r('sandstone_stairs', 4, [['sandstone', 6]], 'table'),
  r('oak_door', 3, [['#planks', 6]], 'table'),
  r('ladder', 3, [['stick', 7]], 'table'),
  r('oak_fence', 3, [['#planks', 4], ['stick', 2]], 'table'),
  r('glass_pane', 16, [['glass', 6]], 'table'),
  r('glass', 1, [['sand', 1]], 'furnace'),
  r('stone', 1, [['cobblestone', 1]], 'furnace'),
  r('iron_ingot', 1, [['iron_ore', 1]], 'furnace'),
  r('gold_ingot', 1, [['gold_ore', 1]], 'furnace'),
  r('cooked_porkchop', 1, [['raw_porkchop', 1]], 'furnace'),
  r('bricks', 1, [['clay', 1]], 'furnace'),
  r('coal', 1, [['#logs', 1]], 'furnace'),
].map((rec) => ({
  ...rec,
  input: rec.input.map(([name, n]) => (name[0] === '#' ? { group: name.slice(1), n } : { id: I[name], n })),
}));
for (const rec of RECIPES) {
  if (rec.out === undefined || rec.input.some((i) => !i.group && i.id === undefined)) {
    throw new Error('Recipe references an unknown item');
  }
}
