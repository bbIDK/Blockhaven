// Block registry. IDs are part of the save format, so never renumber an existing block.
// Hot properties live in flat typed arrays for the mesher, lighting and physics.
import { TEX } from './textures.js';

export const R = { NONE: 0, CUBE: 1, CROSS: 2, TORCH: 3, LIQUID: 4, CACTUS: 5 };

// Per-face flags (also copied into vertex flags for the shader).
export const F_TINT = 1, F_OVERLAY = 2, F_UVROT = 4, F_WAVE = 8, F_WATER = 16, F_EMISSIVE = 32, F_LAVA = 64;

// Face order used everywhere: +X east, -X west, +Y top, -Y bottom, +Z south, -Z north.
export const FACE_DIRS = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]];

const N = 256;
export const BLOCKS = new Array(N).fill(null);
export const B = {};
export const RENDER = new Uint8Array(N);
export const OPAQUE = new Uint8Array(N);
export const SOLID = new Uint8Array(N);
export const FILTER = new Uint8Array(N);
export const EMIT = new Uint8Array(N);
export const TRANSLUCENT = new Uint8Array(N);
export const CULL_SELF = new Uint8Array(N);
export const AO = new Uint8Array(N);
export const TINT = new Uint8Array(N); // 0 none, 1 grass, 2 foliage, 3 fixed colour
export const TINT_RGB = new Uint8Array(N * 3);
export const TEXL = new Uint8Array(N * 6);
export const FFLAGS = new Uint8Array(N * 6);
export const REPLACEABLE = new Uint8Array(N);
export const SELECTABLE = new Uint8Array(N);
export const WATERLIKE = new Uint8Array(N); // 1 water, 2 lava
export const BASE = new Uint8Array(N);

const title = (s) => s.split('_').map((w) => w[0].toUpperCase() + w.slice(1)).join(' ');

function faceTextures(spec) {
  if (typeof spec === 'string') return [spec, spec, spec, spec, spec, spec];
  if (Array.isArray(spec)) return spec;
  const side = spec.side ?? spec.all;
  return [side, side, spec.top ?? spec.all ?? side, spec.bottom ?? spec.top ?? spec.all ?? side, side, side];
}

function block(id, name, o = {}) {
  if (BLOCKS[id]) throw new Error(`Block id ${id} used twice`);
  const render = o.render ?? R.CUBE;
  const cube = render === R.CUBE;
  const d = {
    id, name,
    label: o.label ?? title(name),
    render,
    opaque: o.opaque ?? (cube && !o.cutout && !o.translucent),
    solid: o.solid ?? (render === R.CUBE || render === R.CACTUS),
    cutout: !!o.cutout,
    translucent: !!o.translucent,
    hardness: o.hardness ?? 1,
    tool: o.tool ?? null,
    tier: o.tier ?? 0,
    drop: o.drop === undefined ? name : o.drop,
    sound: o.sound ?? 'stone',
    item: o.item ?? true,
    support: o.support ?? null,
    falls: !!o.falls,
    emit: o.emit ?? 0,
    base: o.base ?? id,
    faces: null,
  };
  BLOCKS[id] = d;
  B[name] = id;
  RENDER[id] = render;
  OPAQUE[id] = d.opaque ? 1 : 0;
  SOLID[id] = d.solid ? 1 : 0;
  EMIT[id] = d.emit;
  FILTER[id] = d.opaque ? 15 : (o.filter ?? 0);
  TRANSLUCENT[id] = d.translucent ? 1 : 0;
  CULL_SELF[id] = o.cullSelf ? 1 : 0;
  AO[id] = (o.ao ?? d.opaque) ? 1 : 0;
  REPLACEABLE[id] = o.replaceable ? 1 : 0;
  SELECTABLE[id] = (o.selectable ?? true) ? 1 : 0;
  WATERLIKE[id] = o.liquid ?? 0;
  BASE[id] = d.base;
  if (o.tint === 'grass') TINT[id] = 1;
  else if (o.tint === 'foliage') TINT[id] = 2;
  else if (Array.isArray(o.tint)) { TINT[id] = 3; TINT_RGB.set(o.tint, id * 3); }

  if (o.tex) {
    const names = faceTextures(o.tex);
    d.faces = names;
    for (let f = 0; f < 6; f++) {
      if (!(names[f] in TEX)) throw new Error(`Missing texture ${names[f]} for ${name}`);
      TEXL[id * 6 + f] = TEX[names[f]];
      let flags = 0;
      if (TINT[id] && !o.grassLike) flags |= F_TINT;
      if (o.wave) flags |= F_WAVE;
      if (o.liquid === 1) flags |= F_WATER;
      if (o.liquid === 2) flags |= F_LAVA;
      if (o.emissive) flags |= F_EMISSIVE;
      FFLAGS[id * 6 + f] = flags;
    }
    if (o.grassLike) {
      FFLAGS[id * 6 + 2] |= F_TINT;
      for (const f of [0, 1, 4, 5]) FFLAGS[id * 6 + f] |= F_OVERLAY;
    }
    if (o.uvrot) for (const f of o.uvrot) FFLAGS[id * 6 + f] |= F_UVROT;
  }
  return id;
}

// Logs come in three axis variants that share one item.
function log(idY, idX, idZ, wood) {
  const common = { hardness: 2, tool: 'axe', sound: 'wood' };
  const side = `${wood}_log`, end = `${wood}_log_top`;
  block(idY, `${wood}_log`, { ...common, tex: { side, top: end } });
  block(idX, `${wood}_log_x`, { ...common, base: idY, item: false, drop: `${wood}_log`,
    tex: [end, end, side, side, side, side], uvrot: [2, 3, 4, 5] });
  block(idZ, `${wood}_log_z`, { ...common, base: idY, item: false, drop: `${wood}_log`,
    tex: [side, side, side, side, end, end], uvrot: [0, 1] });
}

// Blocks with a front face: the base id faces south; variants face north, east and west.
export const FACING_VARIANTS = {};
function facing(ids, name, o) {
  const [s, n, e, w] = ids;
  const tex = (frontFace) => {
    const arr = [o.side, o.side, o.top, o.bottom ?? o.top, o.side, o.side];
    arr[frontFace] = o.front;
    return arr;
  };
  block(s, name, { ...o, tex: tex(4) });
  block(n, `${name}_n`, { ...o, tex: tex(5), base: s, item: false, drop: o.drop ?? name });
  block(e, `${name}_e`, { ...o, tex: tex(0), base: s, item: false, drop: o.drop ?? name });
  block(w, `${name}_w`, { ...o, tex: tex(1), base: s, item: false, drop: o.drop ?? name });
  FACING_VARIANTS[s] = { 4: s, 5: n, 0: e, 1: w };
}

const plant = (o) => ({ render: R.CROSS, cutout: true, solid: false, hardness: 0, sound: 'grass', support: 'soil', replaceable: false, ...o });

block(0, 'air', { render: R.NONE, solid: false, opaque: false, selectable: false, replaceable: true, item: false, drop: null });
block(1, 'stone', { tex: 'stone', hardness: 1.5, tool: 'pickaxe', tier: 1, drop: 'cobblestone' });
block(2, 'grass_block', { tex: { top: 'grass_top', bottom: 'dirt', side: 'grass_side' }, tint: 'grass', grassLike: true,
  hardness: 0.6, tool: 'shovel', drop: 'dirt', sound: 'grass' });
block(3, 'dirt', { tex: 'dirt', hardness: 0.5, tool: 'shovel', sound: 'gravel' });
block(4, 'cobblestone', { tex: 'cobblestone', hardness: 2, tool: 'pickaxe', tier: 1 });
block(5, 'oak_planks', { tex: 'oak_planks', hardness: 2, tool: 'axe', sound: 'wood' });
log(6, 100, 101, 'oak');
block(7, 'oak_leaves', { tex: 'oak_leaves', cutout: true, tint: 'foliage', filter: 1, ao: true, wave: true,
  hardness: 0.2, sound: 'grass', drop: null });
block(8, 'sand', { tex: 'sand', hardness: 0.5, tool: 'shovel', sound: 'sand', falls: true });
block(9, 'gravel', { tex: 'gravel', hardness: 0.6, tool: 'shovel', sound: 'gravel', falls: true });
block(10, 'water', { render: R.LIQUID, tex: 'water', translucent: true, solid: false, filter: 1, cullSelf: true,
  selectable: false, replaceable: true, liquid: 1, hardness: -1, sound: 'water', drop: null });
block(11, 'glass', { tex: 'glass', cutout: true, cullSelf: true, hardness: 0.3, sound: 'glass', drop: null });
block(12, 'bedrock', { tex: 'bedrock', hardness: -1 });
block(13, 'coal_ore', { tex: 'coal_ore', hardness: 3, tool: 'pickaxe', tier: 1, drop: 'coal' });
block(14, 'iron_ore', { tex: 'iron_ore', hardness: 3, tool: 'pickaxe', tier: 2 });
block(15, 'gold_ore', { tex: 'gold_ore', hardness: 3, tool: 'pickaxe', tier: 3 });
block(16, 'diamond_ore', { tex: 'diamond_ore', hardness: 3, tool: 'pickaxe', tier: 3, drop: 'diamond' });
block(17, 'bricks', { tex: 'bricks', hardness: 2, tool: 'pickaxe', tier: 1 });
block(18, 'snowy_grass', { tex: { top: 'snow', bottom: 'dirt', side: 'grass_side_snowy' }, hardness: 0.6,
  tool: 'shovel', drop: 'dirt', sound: 'snow' });
block(19, 'snow_block', { label: 'Snow', tex: 'snow', hardness: 0.2, tool: 'shovel', sound: 'snow' });
block(20, 'ice', { tex: 'ice', translucent: true, cullSelf: true, filter: 2, hardness: 0.5, tool: 'pickaxe', sound: 'glass', drop: null });
block(21, 'cactus', { render: R.CACTUS, tex: { top: 'cactus_top', bottom: 'cactus_bottom', side: 'cactus_side' },
  opaque: false, hardness: 0.4, sound: 'cloth', support: 'cactus' });
log(22, 102, 103, 'birch');
block(23, 'birch_leaves', { tex: 'birch_leaves', cutout: true, tint: [128, 167, 85], filter: 1, ao: true, wave: true,
  hardness: 0.2, sound: 'grass', drop: null });
log(24, 104, 105, 'spruce');
block(25, 'spruce_leaves', { tex: 'spruce_leaves', cutout: true, tint: [97, 153, 97], filter: 1, ao: true, wave: true,
  hardness: 0.2, sound: 'grass', drop: null });
block(26, 'birch_planks', { tex: 'birch_planks', hardness: 2, tool: 'axe', sound: 'wood' });
block(27, 'spruce_planks', { tex: 'spruce_planks', hardness: 2, tool: 'axe', sound: 'wood' });
block(28, 'tall_grass', plant({ label: 'Grass', tex: 'tall_grass', tint: 'grass', wave: true, replaceable: true, drop: null }));
block(29, 'dandelion', plant({ tex: 'dandelion', wave: true }));
block(30, 'poppy', plant({ tex: 'poppy', wave: true }));
block(31, 'cornflower', plant({ tex: 'cornflower', wave: true }));
block(32, 'dead_bush', plant({ tex: 'dead_bush', support: 'sand', replaceable: true, drop: 'stick' }));
block(33, 'torch', { render: R.TORCH, tex: 'torch', cutout: true, solid: false, emit: 14, hardness: 0, sound: 'wood',
  support: 'torch', emissive: true });
block(34, 'glowstone', { tex: 'glowstone', emit: 15, hardness: 0.3, sound: 'glass', emissive: true });
block(35, 'lava', { render: R.LIQUID, tex: 'lava', solid: false, emit: 15, cullSelf: true, selectable: false,
  replaceable: true, liquid: 2, emissive: true, hardness: -1, sound: 'water', drop: null });
block(36, 'obsidian', { tex: 'obsidian', hardness: 50, tool: 'pickaxe', tier: 4 });
block(37, 'sandstone', { tex: { top: 'sandstone_top', bottom: 'sandstone_bottom', side: 'sandstone_side' },
  hardness: 0.8, tool: 'pickaxe', tier: 1 });
block(38, 'stone_bricks', { tex: 'stone_bricks', hardness: 1.5, tool: 'pickaxe', tier: 1 });
block(39, 'mossy_cobblestone', { tex: 'mossy_cobblestone', hardness: 2, tool: 'pickaxe', tier: 1 });
block(40, 'bookshelf', { tex: { top: 'oak_planks', side: 'bookshelf' }, hardness: 1.5, tool: 'axe', sound: 'wood' });
block(41, 'crafting_table', { tex: ['crafting_table_front', 'crafting_table_side', 'crafting_table_top', 'oak_planks',
  'crafting_table_front', 'crafting_table_side'], hardness: 2.5, tool: 'axe', sound: 'wood' });
facing([42, 110, 111, 112], 'furnace', { front: 'furnace_front', side: 'furnace_side', top: 'furnace_top',
  hardness: 3.5, tool: 'pickaxe', tier: 1 });
block(43, 'tnt', { label: 'TNT', tex: { top: 'tnt_top', bottom: 'tnt_bottom', side: 'tnt_side' }, hardness: 0, sound: 'grass' });
block(44, 'clay', { tex: 'clay', hardness: 0.6, tool: 'shovel', sound: 'gravel' });
['white', 'red', 'orange', 'yellow', 'lime', 'blue', 'purple', 'black'].forEach((c, i) =>
  block(45 + i, `${c}_wool`, { tex: `${c}_wool`, hardness: 0.8, sound: 'cloth' }));
facing([53, 113, 114, 115], 'pumpkin', { front: 'pumpkin_face', side: 'pumpkin_side', top: 'pumpkin_top',
  hardness: 1, tool: 'axe', sound: 'wood' });
facing([54, 116, 117, 118], 'jack_o_lantern', { label: "Jack o'Lantern", front: 'jack_face', side: 'pumpkin_side',
  top: 'pumpkin_top', emit: 15, hardness: 1, tool: 'axe', sound: 'wood' });
block(55, 'red_mushroom', plant({ tex: 'red_mushroom', support: 'solid' }));
block(56, 'brown_mushroom', plant({ tex: 'brown_mushroom', support: 'solid', emit: 1 }));
block(57, 'sugar_cane', plant({ tex: 'sugar_cane', support: 'cane' }));
block(58, 'gold_block', { label: 'Block of Gold', tex: 'gold_block', hardness: 3, tool: 'pickaxe', tier: 3, sound: 'metal' });
block(59, 'iron_block', { label: 'Block of Iron', tex: 'iron_block', hardness: 5, tool: 'pickaxe', tier: 2, sound: 'metal' });
block(60, 'diamond_block', { label: 'Block of Diamond', tex: 'diamond_block', hardness: 5, tool: 'pickaxe', tier: 3, sound: 'metal' });
block(61, 'coal_block', { label: 'Block of Coal', tex: 'coal_block', hardness: 5, tool: 'pickaxe', tier: 1 });

// Wall torches lean away from the block they hang on. The name says which way they lean.
export const WALL_TORCH = {};
[[106, 'e', 0], [107, 'w', 1], [108, 's', 4], [109, 'n', 5]].forEach(([id, dir, face]) => {
  block(id, `wall_torch_${dir}`, { render: R.TORCH, tex: 'torch', cutout: true, solid: false, emit: 14, hardness: 0,
    sound: 'wood', support: 'torch', emissive: true, base: 33, item: false, drop: 'torch' });
  WALL_TORCH[face] = id;
});
export const TORCH_LEAN = { 33: -1, 106: 0, 107: 1, 108: 4, 109: 5 };

// Flowing water: ids 120..126 are levels 1..7 (1 = next to a source), 127 is falling water.
export const WATER_FLOW_BASE = 120;
for (let level = 1; level <= 8; level++) {
  block(119 + level, level === 8 ? 'water_falling' : `water_flow_${level}`, { render: R.LIQUID, tex: 'water',
    translucent: true, solid: false, filter: 1, cullSelf: true, selectable: false, replaceable: true, liquid: 1,
    hardness: -1, sound: 'water', drop: null, item: false, base: 10 });
}
export const isWater = (id) => WATERLIKE[id] === 1;
export const isLava = (id) => WATERLIKE[id] === 2;
// 0 = source, 1..7 = flowing level, 8 = falling.
export const waterLevel = (id) => (id === 10 ? 0 : id >= 120 && id <= 127 ? id - 119 : -1);
// Surface height of a liquid block, as a fraction of a block.
export function liquidHeight(id) {
  const l = waterLevel(id);
  if (l <= 0 || l === 8) return 0.875;
  return Math.max(0.12, (8 - l) / 9);
}

// Liquids use the same cull test as other liquids of the same kind.
for (let id = 0; id < N; id++) {
  if (!BLOCKS[id]) continue;
  if (WATERLIKE[id] === 1) CULL_SELF[id] = 1;
}

export function sameCullGroup(a, b) {
  if (a === b) return true;
  return WATERLIKE[a] === 1 && WATERLIKE[b] === 1;
}

// Blocks worth listing in the creative inventory, in display order.
export const CREATIVE_BLOCKS = [
  'grass_block', 'dirt', 'stone', 'cobblestone', 'mossy_cobblestone', 'stone_bricks', 'bricks', 'sand', 'sandstone',
  'gravel', 'clay', 'oak_log', 'birch_log', 'spruce_log', 'oak_planks', 'birch_planks', 'spruce_planks', 'oak_leaves',
  'birch_leaves', 'spruce_leaves', 'glass', 'bookshelf', 'crafting_table', 'furnace', 'pumpkin', 'jack_o_lantern',
  'torch', 'glowstone', 'tnt', 'white_wool', 'red_wool', 'orange_wool', 'yellow_wool', 'lime_wool', 'blue_wool',
  'purple_wool', 'black_wool', 'snowy_grass', 'snow_block', 'ice', 'cactus', 'coal_ore', 'iron_ore', 'gold_ore',
  'diamond_ore', 'coal_block', 'iron_block', 'gold_block', 'diamond_block', 'obsidian', 'bedrock', 'water', 'lava',
  'tall_grass', 'dandelion', 'poppy', 'cornflower', 'dead_bush', 'sugar_cane', 'red_mushroom', 'brown_mushroom',
].map((n) => B[n]);
