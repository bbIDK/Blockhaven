// Crafting and smelting, Minecraft style. A crafting recipe is either shaped (a pattern that can sit
// anywhere in the grid, mirrored or not) or shapeless (a list of ingredients in any arrangement).
// The recipe book shows them by category and can lay them out in the grid for you.
import { I, maxStack } from './items.js';

// '#name' in a recipe accepts any item of a group.
export const GROUPS = {
  planks: ['oak_planks', 'birch_planks', 'spruce_planks'],
  logs: ['oak_log', 'birch_log', 'spruce_log'],
  wool: ['white_wool', 'red_wool', 'orange_wool', 'yellow_wool', 'lime_wool', 'blue_wool', 'purple_wool', 'black_wool'],
  coals: ['coal', 'charcoal'],
};

const ingredientCache = new Map();
function ingredient(name) {
  if (!ingredientCache.has(name)) {
    const names = name[0] === '#' ? GROUPS[name.slice(1)] : [name];
    const ids = names?.map((n) => I[n]);
    if (!ids || ids.some((id) => id === undefined)) throw new Error(`Unknown ingredient ${name}`);
    ingredientCache.set(name, { name, ids });
  }
  return ingredientCache.get(name);
}

export const RECIPES = [];
function add(r) {
  if (I[r.name] === undefined) throw new Error(`Unknown recipe result ${r.name}`);
  r.out = I[r.name];
  r.index = RECIPES.length;
  RECIPES.push(r);
}
// Shaped: rows of the pattern, and what each letter stands for (spaces are empty cells).
function shaped(name, count, rows, key, category) {
  const w = Math.max(...rows.map((row) => row.length)), h = rows.length;
  const cells = [];
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const ch = rows[y][x] ?? ' ';
    cells.push(ch === ' ' ? null : ingredient(key[ch]));
  }
  add({ name, count, shaped: true, w, h, cells, category });
}
function shapeless(name, count, list, category) {
  add({ name, count, shaped: false, ings: list.map(ingredient), category });
}

// ---------------------------------------------------------------- recipes
for (const wood of ['oak', 'birch', 'spruce']) shapeless(`${wood}_planks`, 4, [`${wood}_log`], 'building');
shaped('stick', 4, ['#', '#'], { '#': '#planks' }, 'misc');
shaped('crafting_table', 1, ['##', '##'], { '#': '#planks' }, 'misc');
shaped('torch', 4, ['C', '#'], { C: '#coals', '#': 'stick' }, 'misc');
shaped('chest', 1, ['###', '# #', '###'], { '#': '#planks' }, 'misc');
shaped('furnace', 1, ['###', '# #', '###'], { '#': 'cobblestone' }, 'misc');
shaped('bed', 1, ['WWW', '###'], { W: '#wool', '#': '#planks' }, 'misc');
shaped('oak_door', 3, ['##', '##', '##'], { '#': '#planks' }, 'misc');
shaped('ladder', 3, ['# #', '###', '# #'], { '#': 'stick' }, 'misc');
shaped('oak_fence', 3, ['W#W', 'W#W'], { W: '#planks', '#': 'stick' }, 'misc');
shaped('glass_pane', 16, ['###', '###'], { '#': 'glass' }, 'building');
shaped('bookshelf', 1, ['###', 'BBB', '###'], { '#': '#planks', B: 'book' }, 'building');
shaped('paper', 3, ['###'], { '#': 'sugar_cane' }, 'misc');
shapeless('book', 1, ['paper', 'paper', 'paper', 'leather'], 'misc');
shaped('bowl', 4, ['# #', ' # '], { '#': '#planks' }, 'misc');
shapeless('mushroom_stew', 1, ['bowl', 'red_mushroom', 'brown_mushroom'], 'misc');
shaped('jack_o_lantern', 1, ['P', 'T'], { P: 'pumpkin', T: 'torch' }, 'building');
// There is no gunpowder in these worlds, so TNT is packed with coal instead.
shaped('tnt', 1, ['CSC', 'SCS', 'CSC'], { C: '#coals', S: 'sand' }, 'misc');
shapeless('flint_and_steel', 1, ['iron_ingot', 'flint'], 'equipment');
shaped('stone_bricks', 4, ['##', '##'], { '#': 'stone' }, 'building');
shaped('sandstone', 1, ['##', '##'], { '#': 'sand' }, 'building');
shaped('bricks', 1, ['##', '##'], { '#': 'brick' }, 'building');
shaped('clay', 1, ['##', '##'], { '#': 'clay_ball' }, 'building');
for (const [block, material] of [['iron_block', 'iron_ingot'], ['gold_block', 'gold_ingot'], ['diamond_block', 'diamond'], ['coal_block', 'coal']]) {
  shaped(block, 1, ['###', '###', '###'], { '#': material }, 'building');
  shapeless(material, 9, [block], 'misc');
}
for (const [slab, material] of [['oak_slab', 'oak_planks'], ['birch_slab', 'birch_planks'], ['spruce_slab', 'spruce_planks'],
  ['cobblestone_slab', 'cobblestone'], ['stone_slab', 'stone'], ['brick_slab', 'bricks'], ['stone_brick_slab', 'stone_bricks'],
  ['sandstone_slab', 'sandstone']]) {
  shaped(slab, 6, ['###'], { '#': material }, 'building');
}
for (const [stairs, material] of [['oak_stairs', '#planks'], ['cobblestone_stairs', 'cobblestone'], ['stone_brick_stairs', 'stone_bricks'],
  ['brick_stairs', 'bricks'], ['sandstone_stairs', 'sandstone']]) {
  shaped(stairs, 4, ['#  ', '## ', '###'], { '#': material }, 'building');
}
for (const [mat, x] of [['wooden', '#planks'], ['stone', 'cobblestone'], ['iron', 'iron_ingot'], ['golden', 'gold_ingot'], ['diamond', 'diamond']]) {
  shaped(`${mat}_pickaxe`, 1, ['XXX', ' # ', ' # '], { X: x, '#': 'stick' }, 'equipment');
  shaped(`${mat}_axe`, 1, ['XX', 'X#', ' #'], { X: x, '#': 'stick' }, 'equipment');
  shaped(`${mat}_shovel`, 1, ['X', '#', '#'], { X: x, '#': 'stick' }, 'equipment');
  shaped(`${mat}_sword`, 1, ['X', 'X', '#'], { X: x, '#': 'stick' }, 'equipment');
}
for (const [mat, x] of [['leather', 'leather'], ['iron', 'iron_ingot'], ['golden', 'gold_ingot'], ['diamond', 'diamond']]) {
  shaped(`${mat}_helmet`, 1, ['XXX', 'X X'], { X: x }, 'equipment');
  shaped(`${mat}_chestplate`, 1, ['X X', 'XXX', 'XXX'], { X: x }, 'equipment');
  shaped(`${mat}_leggings`, 1, ['XXX', 'X X', 'X X'], { X: x }, 'equipment');
  shaped(`${mat}_boots`, 1, ['X X', 'X X'], { X: x }, 'equipment');
}

// ---------------------------------------------------------------- matching
// Does a shaped recipe fit the grid cells starting at (x0, y0)?
function fitsAt(r, grid, size, x0, y0, mirror) {
  for (let y = 0; y < r.h; y++) {
    for (let x = 0; x < r.w; x++) {
      const ing = r.cells[y * r.w + (mirror ? r.w - 1 - x : x)];
      const s = grid[(y0 + y) * size + x0 + x];
      if (!ing !== !s) return false;
      if (s && !ing.ids.includes(s.id)) return false;
    }
  }
  return true;
}

function shapelessFits(r, stacks) {
  const used = new Array(stacks.length).fill(false);
  const match = (k) => {
    if (k === r.ings.length) return true;
    for (let i = 0; i < stacks.length; i++) {
      if (used[i] || !r.ings[k].ids.includes(stacks[i].id)) continue;
      used[i] = true;
      if (match(k + 1)) return true;
      used[i] = false;
    }
    return false;
  };
  return match(0);
}

// The recipe made by what's in a size x size grid (array of stacks or nulls), or null.
export function matchGrid(grid, size) {
  let x0 = size, y0 = size, x1 = -1, y1 = -1;
  const stacks = [];
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const s = grid[y * size + x];
      if (!s) continue;
      if (s.dmg) return null; // worn tools are never ingredients
      stacks.push(s);
      x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y);
    }
  }
  if (!stacks.length) return null;
  const w = x1 - x0 + 1, h = y1 - y0 + 1;
  for (const r of RECIPES) {
    if (r.shaped) {
      if (r.w === w && r.h === h && (fitsAt(r, grid, size, x0, y0, false) || fitsAt(r, grid, size, x0, y0, true))) return r;
    } else if (r.ings.length === stacks.length && shapelessFits(r, stacks)) return r;
  }
  return null;
}

export const recipeFits = (r, size) => (r.shaped ? r.w <= size && r.h <= size : r.ings.length <= size * size);

// Where each ingredient goes when the recipe book lays a recipe out: [{ cell, ing }]. Small
// recipes are centred in the crafting table's grid, like the original.
export function layout(r, size) {
  const out = [];
  if (!r.shaped) {
    r.ings.forEach((ing, i) => out.push({ cell: i, ing }));
    return out;
  }
  const ox = Math.floor((size - r.w) / 2), oy = Math.floor((size - r.h) / 2);
  for (let y = 0; y < r.h; y++) {
    for (let x = 0; x < r.w; x++) {
      const ing = r.cells[y * r.w + x];
      if (ing) out.push({ cell: (oy + y) * size + ox + x, ing });
    }
  }
  return out;
}

// Item counts in some slots: Map id -> count (worn items don't count).
export function countItems(...lists) {
  const counts = new Map();
  for (const list of lists) {
    for (const s of list) if (s && !s.dmg) counts.set(s.id, (counts.get(s.id) ?? 0) + s.count);
  }
  return counts;
}

// Picks an item for every cell of the recipe from `counts`, with `sets` of it in each cell.
// Returns [{ cell, id }] or null when there isn't enough.
function assign(cells, counts, sets) {
  const left = new Map(counts);
  const order = [...cells].sort((a, b) => a.ing.ids.length - b.ing.ids.length);
  const out = [];
  for (const { cell, ing } of order) {
    let best = -1, bestN = 0;
    for (const id of ing.ids) {
      const n = left.get(id) ?? 0;
      if (n >= sets && n > bestN && maxStack(id) >= sets) { best = id; bestN = n; }
    }
    if (best < 0) return null;
    left.set(best, bestN - sets);
    out.push({ cell, id: best });
  }
  return out.sort((a, b) => a.cell - b.cell);
}

// How the recipe book would fill the grid from these item counts: { cells: [{ cell, id }], sets }
// with the most sets possible up to `maxSets`, or null if it can't be made even once.
export function planRecipe(r, counts, size, maxSets = 1) {
  if (!recipeFits(r, size)) return null;
  const cells = layout(r, size);
  let plan = assign(cells, counts, 1);
  if (!plan) return null;
  let sets = 1, lo = 1, hi = maxSets;
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2);
    const p = assign(cells, counts, mid);
    if (p) { lo = mid; plan = p; sets = mid; } else hi = mid - 1;
  }
  return { cells: plan, sets };
}

// ---------------------------------------------------------------- smelting
export const COOK_TIME = 200; // ticks per item, like the original furnace

const SMELT = [
  ['sand', 'glass'], ['cobblestone', 'stone'], ['iron_ore', 'iron_ingot'], ['gold_ore', 'gold_ingot'],
  ['coal_ore', 'coal'], ['diamond_ore', 'diamond'], ['raw_porkchop', 'cooked_porkchop'], ['raw_beef', 'cooked_beef'],
  ['raw_chicken', 'cooked_chicken'], ['clay_ball', 'brick'], ['oak_log', 'charcoal'], ['birch_log', 'charcoal'],
  ['spruce_log', 'charcoal'],
];
const SMELTING = new Map(SMELT.map(([a, b]) => [I[a], I[b]]));
if ([...SMELTING].some(([a, b]) => a === undefined || b === undefined)) throw new Error('Unknown smelting item');
export const smeltResult = (id) => SMELTING.get(id) ?? null;
export const SMELTABLE = [...SMELTING.keys()];

// Burn time of fuels, in ticks (an item takes 200 to smelt, so coal does 8).
const FUELS = [
  ['coal', 1600], ['charcoal', 1600], ['coal_block', 16000], ['oak_log', 300], ['birch_log', 300], ['spruce_log', 300],
  ['oak_planks', 300], ['birch_planks', 300], ['spruce_planks', 300], ['stick', 100], ['wooden_pickaxe', 200],
  ['wooden_axe', 200], ['wooden_shovel', 200], ['wooden_sword', 200], ['oak_slab', 150], ['birch_slab', 150],
  ['spruce_slab', 150], ['oak_stairs', 300], ['crafting_table', 300], ['chest', 300], ['bookshelf', 300],
  ['oak_fence', 300], ['ladder', 300], ['oak_door', 200], ['bowl', 100],
  ...GROUPS.wool.map((w) => [w, 100]),
];
const FUEL = new Map(FUELS.map(([name, t]) => [I[name], t]));
if ([...FUEL.keys()].some((id) => id === undefined)) throw new Error('Unknown fuel item');
export const fuelTime = (id) => FUEL.get(id) ?? 0;
