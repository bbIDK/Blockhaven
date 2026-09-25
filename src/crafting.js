// Crafting and smelting, Minecraft style. A crafting recipe is either shaped (a pattern that can sit
// anywhere in the grid, mirrored or not) or shapeless (a list of ingredients in any arrangement).
// The recipe book shows them by category and can lay them out in the grid for you.
import { I, maxStack } from './items.js';
import { WOOD_NAMES, WALL_MATERIALS } from './blocks.js';
import { DYES } from './colors.js';

// '#name' in a recipe accepts any item of a group.
export const GROUPS = {
  planks: WOOD_NAMES.map((w) => `${w}_planks`),
  logs: WOOD_NAMES.map((w) => `${w}_log`),
  wool: DYES.map((d) => `${d.name}_wool`),
  coals: ['coal', 'charcoal'],
  cobble: ['cobblestone', 'cobbled_deepslate'],
  wooden_slabs: WOOD_NAMES.map((w) => `${w}_slab`),
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
for (const wood of WOOD_NAMES) shapeless(`${wood}_planks`, 4, [`${wood}_log`], 'building');
shaped('stick', 4, ['#', '#'], { '#': '#planks' }, 'misc');
shaped('crafting_table', 1, ['##', '##'], { '#': '#planks' }, 'misc');
shaped('torch', 4, ['C', '#'], { C: '#coals', '#': 'stick' }, 'misc');
shaped('chest', 1, ['###', '# #', '###'], { '#': '#planks' }, 'misc');
shaped('furnace', 1, ['###', '# #', '###'], { '#': '#cobble' }, 'misc');
shaped('bed', 1, ['WWW', '###'], { W: '#wool', '#': '#planks' }, 'misc');
for (const w of WOOD_NAMES) {
  shaped(`${w}_door`, 3, ['##', '##', '##'], { '#': `${w}_planks` }, 'misc');
  shaped(`${w}_fence`, 3, ['W#W', 'W#W'], { W: `${w}_planks`, '#': 'stick' }, 'misc');
  shaped(`${w}_fence_gate`, 1, ['#W#', '#W#'], { W: `${w}_planks`, '#': 'stick' }, 'misc');
  shaped(`${w}_trapdoor`, 2, ['###', '###'], { '#': `${w}_planks` }, 'misc');
  if (I[`${w}_boat`] !== undefined) shaped(`${w}_boat`, 1, ['# #', '###'], { '#': `${w}_planks` }, 'misc');
}
shaped('saddle', 1, [' L ', 'LIL'], { L: 'leather', I: 'iron_ingot' }, 'equipment');
shaped('enchanting_table', 1, [' B ', 'DOD', 'OOO'], { B: 'book', D: 'diamond', O: 'obsidian' }, 'misc');
// Switches and the things they work.
shaped('iron_door', 3, ['##', '##', '##'], { '#': 'iron_ingot' }, 'misc');
shaped('iron_trapdoor', 1, ['##', '##'], { '#': 'iron_ingot' }, 'misc');
shaped('lever', 1, ['S', 'C'], { S: 'stick', C: 'cobblestone' }, 'misc');
shaped('stone_button', 1, ['#'], { '#': 'stone' }, 'misc');
shaped('oak_button', 1, ['#'], { '#': '#planks' }, 'misc');
shaped('stone_pressure_plate', 1, ['##'], { '#': 'stone' }, 'misc');
shaped('oak_pressure_plate', 1, ['##'], { '#': '#planks' }, 'misc');
shaped('redstone_lamp', 1, [' R ', 'RGR', ' R '], { R: 'redstone', G: 'glowstone' }, 'misc');
shaped('ladder', 3, ['# #', '###', '# #'], { '#': 'stick' }, 'misc');
shaped('glass_pane', 16, ['###', '###'], { '#': 'glass' }, 'building');
shaped('bookshelf', 1, ['###', 'BBB', '###'], { '#': '#planks', B: 'book' }, 'building');
shaped('paper', 3, ['###'], { '#': 'sugar_cane' }, 'misc');
shapeless('book', 1, ['paper', 'paper', 'paper', 'leather'], 'misc');
shaped('bowl', 4, ['# #', ' # '], { '#': '#planks' }, 'misc');
shapeless('mushroom_stew', 1, ['bowl', 'red_mushroom', 'brown_mushroom'], 'misc');
shaped('jack_o_lantern', 1, ['P', 'T'], { P: 'pumpkin', T: 'torch' }, 'building');
shaped('tnt', 1, ['GSG', 'SGS', 'GSG'], { G: 'gunpowder', S: 'sand' }, 'misc');
shapeless('flint_and_steel', 1, ['iron_ingot', 'flint'], 'equipment');
shaped('stone_bricks', 4, ['##', '##'], { '#': 'stone' }, 'building');
shaped('sandstone', 1, ['##', '##'], { '#': 'sand' }, 'building');
shaped('bricks', 1, ['##', '##'], { '#': 'brick' }, 'building');
shaped('clay', 1, ['##', '##'], { '#': 'clay_ball' }, 'building');
for (const [block, material] of [['iron_block', 'iron_ingot'], ['gold_block', 'gold_ingot'], ['diamond_block', 'diamond'], ['coal_block', 'coal'],
  ['copper_block', 'copper_ingot'], ['lapis_block', 'lapis_lazuli'], ['redstone_block', 'redstone'], ['emerald_block', 'emerald'],
  ['hay_block', 'wheat'], ['iron_ingot', 'iron_nugget'], ['gold_ingot', 'gold_nugget']]) {
  shaped(block, 1, ['###', '###', '###'], { '#': material }, 'building');
  shapeless(material, 9, [block], 'misc');
}
// Slabs and stairs of every material that has them.
const SLABS = [['stone', 'stone'], ['cobblestone', 'cobblestone'], ['brick', 'bricks'], ['stone_brick', 'stone_bricks'], ['sandstone', 'sandstone'],
  ['mossy_cobblestone', 'mossy_cobblestone'], ['mossy_stone_brick', 'mossy_stone_bricks'], ['smooth_stone', 'smooth_stone'],
  ['granite', 'granite'], ['polished_granite', 'polished_granite'], ['diorite', 'diorite'], ['polished_diorite', 'polished_diorite'],
  ['andesite', 'andesite'], ['polished_andesite', 'polished_andesite'], ['cobbled_deepslate', 'cobbled_deepslate'],
  ['deepslate_brick', 'deepslate_bricks'], ['red_sandstone', 'red_sandstone'], ...WOOD_NAMES.map((w) => [w, `${w}_planks`])];
for (const [short, material] of SLABS) shaped(`${short}_slab`, 6, ['###'], { '#': material }, 'building');
for (const [short, material] of SLABS) {
  if (short === 'smooth_stone' || I[`${short}_stairs`] === undefined) continue;
  shaped(`${short}_stairs`, 4, ['#  ', '## ', '###'], { '#': material }, 'building');
}
for (const [mat] of WALL_MATERIALS) {
  const short = mat.replace(/_bricks$/, '_brick').replace(/^bricks$/, 'brick');
  shaped(`${short}_wall`, 6, ['###', '###'], { '#': mat }, 'building');
}
for (const [mat, x] of [['wooden', '#planks'], ['stone', '#cobble'], ['iron', 'iron_ingot'], ['golden', 'gold_ingot'], ['diamond', 'diamond']]) {
  shaped(`${mat}_pickaxe`, 1, ['XXX', ' # ', ' # '], { X: x, '#': 'stick' }, 'equipment');
  shaped(`${mat}_axe`, 1, ['XX', 'X#', ' #'], { X: x, '#': 'stick' }, 'equipment');
  shaped(`${mat}_shovel`, 1, ['X', '#', '#'], { X: x, '#': 'stick' }, 'equipment');
  shaped(`${mat}_sword`, 1, ['X', 'X', '#'], { X: x, '#': 'stick' }, 'equipment');
  shaped(`${mat}_hoe`, 1, ['XX', ' #', ' #'], { X: x, '#': 'stick' }, 'equipment');
}
// Stone of every sort.
for (const [out, from] of [['polished_granite', 'granite'], ['polished_diorite', 'diorite'], ['polished_andesite', 'andesite'],
  ['cut_sandstone', 'sandstone'], ['cut_red_sandstone', 'red_sandstone'], ['deepslate_bricks', 'cobbled_deepslate']]) {
  shaped(out, 4, ['##', '##'], { '#': from }, 'building');
}
shaped('red_sandstone', 1, ['##', '##'], { '#': 'red_sand' }, 'building');
shaped('chiseled_stone_bricks', 1, ['#', '#'], { '#': 'stone_brick_slab' }, 'building');
shaped('chiseled_sandstone', 1, ['#', '#'], { '#': 'sandstone_slab' }, 'building');
shaped('chiseled_red_sandstone', 1, ['#', '#'], { '#': 'red_sandstone_slab' }, 'building');
shapeless('mossy_cobblestone', 1, ['cobblestone', 'vine'], 'building');
shapeless('mossy_stone_bricks', 1, ['stone_bricks', 'vine'], 'building');
// Colours: dyes from flowers and minerals, mixed dyes, and dyed blocks.
for (const [dye, from, n] of [['yellow', 'dandelion', 1], ['red', 'poppy', 1], ['blue', 'cornflower', 1], ['magenta', 'allium', 1],
  ['light_gray', 'azure_bluet', 1], ['light_blue', 'blue_orchid', 1], ['light_gray', 'oxeye_daisy', 1], ['red', 'red_tulip', 1],
  ['orange', 'orange_tulip', 1], ['light_gray', 'white_tulip', 1], ['pink', 'pink_tulip', 1], ['white', 'lily_of_the_valley', 1],
  ['yellow', 'sunflower', 2], ['magenta', 'lilac', 2], ['red', 'rose_bush', 2], ['pink', 'peony', 2], ['white', 'bone_meal', 1],
  ['blue', 'lapis_lazuli', 1], ['black', 'coal', 1], ['red', 'beetroot', 1]]) {
  shapeless(`${dye}_dye`, n, [from], 'misc');
}
for (const [out, a, b] of [['orange', 'red', 'yellow'], ['pink', 'red', 'white'], ['light_blue', 'blue', 'white'], ['purple', 'blue', 'red'],
  ['magenta', 'purple', 'pink'], ['cyan', 'blue', 'green'], ['gray', 'black', 'white'], ['light_gray', 'gray', 'white'], ['lime', 'green', 'white']]) {
  shapeless(`${out}_dye`, 2, [`${a}_dye`, `${b}_dye`], 'misc');
}
for (const d of DYES) {
  if (d.name !== 'white') shapeless(`${d.name}_wool`, 1, [`${d.name}_dye`, 'white_wool'], 'building');
  shaped(`${d.name}_carpet`, 3, ['##'], { '#': `${d.name}_wool` }, 'building');
  shaped(`${d.name}_stained_glass`, 8, ['###', '#D#', '###'], { '#': 'glass', D: `${d.name}_dye` }, 'building');
  shaped(`${d.name}_terracotta`, 8, ['###', '#D#', '###'], { '#': 'terracotta', D: `${d.name}_dye` }, 'building');
  shaped(`${d.name}_concrete`, 8, ['SGS', 'GDG', 'SGS'], { S: 'sand', G: 'gravel', D: `${d.name}_dye` }, 'building');
}
// Workshop and village blocks.
shaped('lantern', 1, ['NNN', 'NTN', 'NNN'], { N: 'iron_nugget', T: 'torch' }, 'misc');
shaped('campfire', 1, [' S ', 'SCS', 'LLL'], { S: 'stick', C: '#coals', L: '#logs' }, 'misc');
shaped('barrel', 1, ['PSP', 'P P', 'PSP'], { P: '#planks', S: '#wooden_slabs' }, 'misc');
shaped('smoker', 1, [' L ', 'LFL', ' L '], { L: '#logs', F: 'furnace' }, 'misc');
shaped('blast_furnace', 1, ['III', 'IFI', 'SSS'], { I: 'iron_ingot', F: 'furnace', S: 'smooth_stone' }, 'misc');
shaped('smithing_table', 1, ['II', 'PP', 'PP'], { I: 'iron_ingot', P: '#planks' }, 'misc');
shaped('fletching_table', 1, ['FF', 'PP', 'PP'], { F: 'flint', P: '#planks' }, 'misc');
shaped('anvil', 1, ['BBB', ' I ', 'III'], { B: 'iron_block', I: 'iron_ingot' }, 'misc');
shaped('cauldron', 1, ['I I', 'I I', 'III'], { I: 'iron_ingot' }, 'misc');
shaped('composter', 1, ['S S', 'S S', 'SSS'], { S: '#wooden_slabs' }, 'misc');
shaped('bell', 1, [' S ', 'GGG', 'G G'], { S: 'stick', G: 'gold_ingot' }, 'misc');
shaped('grindstone', 1, ['SXS', 'P P'], { S: 'stick', X: 'stone_slab', P: '#planks' }, 'misc');
shaped('stonecutter', 1, [' I ', 'SSS'], { I: 'iron_ingot', S: 'stone' }, 'misc');
shaped('loom', 1, ['SS', 'PP'], { S: 'string', P: '#planks' }, 'misc');
shaped('lectern', 1, ['SSS', ' B ', ' S '], { S: '#wooden_slabs', B: 'bookshelf' }, 'misc');
shaped('cartography_table', 1, ['pp', 'PP', 'PP'], { p: 'paper', P: '#planks' }, 'misc');
shaped('flower_pot', 1, ['B B', ' B '], { B: 'brick' }, 'misc');
shaped('iron_bars', 16, ['###', '###'], { '#': 'iron_ingot' }, 'building');
// Gear.
shaped('bow', 1, [' #S', '# S', ' #S'], { '#': 'stick', S: 'string' }, 'equipment');
shaped('arrow', 4, ['F', '#', 'E'], { F: 'flint', '#': 'stick', E: 'feather' }, 'equipment');
shaped('shears', 1, [' I', 'I '], { I: 'iron_ingot' }, 'equipment');
shaped('bucket', 1, ['I I', ' I '], { I: 'iron_ingot' }, 'equipment');
shaped('glass_bottle', 3, ['G G', ' G '], { G: 'glass' }, 'misc');
shaped('snow_block', 1, ['SS', 'SS'], { S: 'snowball' }, 'building');
shaped('snow', 6, ['###'], { '#': 'snow_block' }, 'building');
shaped('sign', 3, ['###', '###', ' S '], { '#': '#planks', S: 'stick' }, 'misc');
shaped('lead', 2, ['~~ ', '~O ', '  ~'], { '~': 'string', O: 'slime_ball' }, 'misc');
shaped('note_block', 1, ['###', '#R#', '###'], { '#': '#planks', R: 'redstone' }, 'misc');
shaped('jukebox', 1, ['###', '#D#', '###'], { '#': '#planks', D: 'diamond' }, 'misc');
shaped('item_frame', 1, ['SSS', 'SLS', 'SSS'], { S: 'stick', L: 'leather' }, 'misc');
shaped('painting', 1, ['SSS', 'SWS', 'SSS'], { S: 'stick', W: '#wool' }, 'misc');
shaped('shield', 1, ['WIW', 'WWW', ' W '], { W: '#planks', I: 'iron_ingot' }, 'equipment');
shaped('compass', 1, [' I ', 'IRI', ' I '], { I: 'iron_ingot', R: 'redstone' }, 'equipment');
shaped('clock', 1, [' G ', 'GRG', ' G '], { G: 'gold_ingot', R: 'redstone' }, 'equipment');
shaped('fishing_rod', 1, ['  #', ' #S', '# S'], { '#': 'stick', S: 'string' }, 'equipment');
// Food.
shaped('bread', 1, ['WWW'], { W: 'wheat' }, 'misc');
shaped('cookie', 8, ['WSW'], { W: 'wheat', S: 'sugar' }, 'misc');
shapeless('pumpkin_pie', 1, ['pumpkin', 'sugar', 'egg'], 'misc');
shaped('cake', 1, ['MMM', 'SES', 'WWW'], { M: 'milk_bucket', S: 'sugar', E: 'egg', W: 'wheat' }, 'misc');
shaped('golden_apple', 1, ['GGG', 'GAG', 'GGG'], { G: 'gold_ingot', A: 'apple' }, 'misc');
shaped('golden_carrot', 1, ['NNN', 'NCN', 'NNN'], { N: 'gold_nugget', C: 'carrot' }, 'misc');
shapeless('beetroot_soup', 1, ['bowl', 'beetroot', 'beetroot', 'beetroot', 'beetroot', 'beetroot', 'beetroot'], 'misc');
shapeless('rabbit_stew', 1, ['bowl', 'cooked_rabbit', 'carrot', 'baked_potato', 'brown_mushroom'], 'misc');
shapeless('sugar', 1, ['sugar_cane'], 'misc');
shapeless('bone_meal', 3, ['bone'], 'misc');
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

// [input, result, kind]: smokers only take food, blast furnaces only ores and metal.
const SMELT = [
  ['sand', 'glass'], ['red_sand', 'glass'], ['cobblestone', 'stone'], ['stone', 'smooth_stone'], ['stone_bricks', 'cracked_stone_bricks'],
  ['cobbled_deepslate', 'deepslate'], ['clay', 'terracotta'], ['clay_ball', 'brick'], ['cactus', 'green_dye'],
  ...['iron', 'gold', 'copper'].flatMap((m) => [[`raw_${m}`, `${m === 'gold' ? 'gold' : m}_ingot`, 'ore'], [`${m}_ore`, `${m === 'gold' ? 'gold' : m}_ingot`, 'ore'],
    [`deepslate_${m}_ore`, `${m}_ingot`, 'ore']]),
  ...['coal', 'diamond', 'emerald', 'lapis', 'redstone'].flatMap((m) => {
    const out = { lapis: 'lapis_lazuli', redstone: 'redstone' }[m] ?? m;
    return [[`${m}_ore`, out, 'ore'], [`deepslate_${m}_ore`, out, 'ore']];
  }),
  ['raw_porkchop', 'cooked_porkchop', 'food'], ['raw_beef', 'cooked_beef', 'food'], ['raw_chicken', 'cooked_chicken', 'food'],
  ['raw_mutton', 'cooked_mutton', 'food'], ['raw_rabbit', 'cooked_rabbit', 'food'], ['cod', 'cooked_cod', 'food'],
  ['salmon', 'cooked_salmon', 'food'], ['potato', 'baked_potato', 'food'],
  ...GROUPS.logs.map((l) => [l, 'charcoal']),
];
const SMELTING = new Map(SMELT.map(([a, b]) => [I[a], I[b]]));
const SMELT_KIND = new Map(SMELT.map(([a, , k]) => [I[a], k ?? null]));
// Can a furnace of kind `only` (null, 'food' or 'ore') smelt this?
export const smeltsIn = (id, only) => SMELTING.has(id) && (!only || SMELT_KIND.get(id) === only);
if ([...SMELTING].some(([a, b]) => a === undefined || b === undefined)) throw new Error('Unknown smelting item');
export const smeltResult = (id) => SMELTING.get(id) ?? null;
export const SMELTABLE = [...SMELTING.keys()];

// Burn time of fuels, in ticks (an item takes 200 to smelt, so coal does 8).
const FUELS = [
  ['coal', 1600], ['charcoal', 1600], ['coal_block', 16000], ['lava_bucket', 20000], ['stick', 100], ['wooden_pickaxe', 200],
  ['wooden_axe', 200], ['wooden_shovel', 200], ['wooden_sword', 200], ['wooden_hoe', 200], ['crafting_table', 300], ['chest', 300],
  ['bookshelf', 300], ['ladder', 300], ['bowl', 100], ['barrel', 300], ['bow', 300], ['fishing_rod', 300], ['fletching_table', 300],
  ['smithing_table', 300], ['composter', 300], ['loom', 300], ['lectern', 300], ['cartography_table', 300],
  ...WOOD_NAMES.flatMap((w) => [[`${w}_log`, 300], [`${w}_planks`, 300], [`${w}_slab`, 150], [`${w}_fence`, 300], [`${w}_fence_gate`, 300],
    [`${w}_door`, 200], [`${w}_sapling`, 100], ...(I[`${w}_stairs`] !== undefined ? [[`${w}_stairs`, 300]] : [])]),
  ...GROUPS.wool.map((w) => [w, 100]),
  ...DYES.map((d) => [`${d.name}_carpet`, 67]),
];
const FUEL = new Map(FUELS.map(([name, t]) => [I[name], t]));
if ([...FUEL.keys()].some((id) => id === undefined)) throw new Error('Unknown fuel item');
export const fuelTime = (id) => FUEL.get(id) ?? 0;
