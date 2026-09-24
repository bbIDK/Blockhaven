// Block registry. IDs are part of the save format, so never renumber an existing block.
// Hot properties live in flat typed arrays for the mesher, lighting and physics.
import { TEX } from './textures.js';

export const R = { NONE: 0, CUBE: 1, CROSS: 2, TORCH: 3, LIQUID: 4, CACTUS: 5, MODEL: 6 };

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
  block(n, `${name}_n`, { ...o, tex: tex(5), base: o.base ?? s, item: false, drop: o.drop ?? name });
  block(e, `${name}_e`, { ...o, tex: tex(0), base: o.base ?? s, item: false, drop: o.drop ?? name });
  block(w, `${name}_w`, { ...o, tex: tex(1), base: o.base ?? s, item: false, drop: o.drop ?? name });
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
block(44, 'clay', { tex: 'clay', hardness: 0.6, tool: 'shovel', sound: 'gravel', drop: 'clay_ball' });
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

// ---------------------------------------------------------------- shaped blocks
// Boxes are in 1/16 of a block: [x0, y0, z0, x1, y1, z1]. SHAPE holds fixed shapes; fences and
// panes change shape with their neighbours (see shapeBoxes).
export const SHAPE = new Array(N).fill(null);
export const SHAPE_KIND = new Uint8Array(N); // 1 fixed, 2 fence, 3 pane
export const ICON_SHAPE = new Array(N).fill(null);
export const CLIMB = new Uint8Array(N);
export const SLAB = {};   // id -> { material, top, full }
export const STAIRS = {}; // base id -> { material, ids[facingFace][upside] }
export const DOOR = {};   // id -> { facing, open, upper }
export const LADDER = {}; // wall side face -> id
export const DOOR_BASE = 184;
const OPPOSITE = [1, 0, 3, 2, 5, 4];
export const oppositeFace = (f) => OPPOSITE[f];

function shaped(id, name, boxes, o) {
  block(id, name, { render: R.MODEL, opaque: false, solid: o.solid ?? true, ...o });
  SHAPE[id] = boxes;
  SHAPE_KIND[id] = 1;
}

// [material block, short name, label]
const SLAB_MATERIALS = [['stone', 'stone', 'Stone'], ['cobblestone', 'cobblestone', 'Cobblestone'], ['oak_planks', 'oak', 'Oak'],
  ['birch_planks', 'birch', 'Birch'], ['spruce_planks', 'spruce', 'Spruce'], ['bricks', 'brick', 'Brick'],
  ['stone_bricks', 'stone_brick', 'Stone Brick'], ['sandstone', 'sandstone', 'Sandstone']];
SLAB_MATERIALS.forEach(([mat, short, name], i) => {
  const src = BLOCKS[B[mat]];
  const common = { tex: src.faces, hardness: src.hardness, tool: src.tool, tier: src.tier, sound: src.sound };
  const label = `${name} Slab`;
  const bottom = 128 + i * 2, top = bottom + 1;
  shaped(bottom, `${short}_slab`, [[0, 0, 0, 16, 8, 16]], { ...common, label });
  shaped(top, `${short}_slab_top`, [[0, 8, 0, 16, 16, 16]], { ...common, label, base: bottom, item: false, drop: `${short}_slab` });
  SLAB[bottom] = { material: B[mat], top: false, bottom, topId: top };
  SLAB[top] = { material: B[mat], top: true, bottom, topId: top };
});

// Stairs: the tall half faces away from the player who placed them.
const STAIR_MATERIALS = [['oak_planks', 'oak', 'Oak'], ['cobblestone', 'cobblestone', 'Cobblestone'],
  ['stone_bricks', 'stone_brick', 'Stone Brick'], ['bricks', 'brick', 'Brick'], ['sandstone', 'sandstone', 'Sandstone']];
const STAIR_FACES = [5, 4, 0, 1];
function stairBoxes(face, upside) {
  const base = upside ? [0, 8, 0, 16, 16, 16] : [0, 0, 0, 16, 8, 16];
  const y0 = upside ? 0 : 8, y1 = upside ? 8 : 16;
  const back = { 5: [0, y0, 0, 16, y1, 8], 4: [0, y0, 8, 16, y1, 16], 0: [8, y0, 0, 16, y1, 16], 1: [0, y0, 0, 8, y1, 16] }[face];
  return [base, back];
}
STAIR_MATERIALS.forEach(([mat, short, name], i) => {
  const src = BLOCKS[B[mat]];
  const label = `${name} Stairs`;
  const ids = {};
  STAIR_FACES.forEach((face, fi) => {
    ids[face] = [];
    [false, true].forEach((upside, ui) => {
      const id = 144 + i * 8 + fi * 2 + ui;
      const first = fi === 0 && ui === 0;
      shaped(id, first ? `${short}_stairs` : `${short}_stairs_${face}${upside ? 'u' : ''}`,
        stairBoxes(face, upside), { tex: src.faces, hardness: src.hardness, tool: src.tool, tier: src.tier, sound: src.sound,
          label, base: 144 + i * 8, item: first, drop: first ? undefined : `${short}_stairs` });
      ids[face][ui] = id;
    });
  });
  STAIRS[144 + i * 8] = { material: B[mat], ids };
});

// Doors: 16 variants (4 facings x open x lower/upper). The item is the closed lower half facing north.
const DOOR_PANEL = { 5: [0, 0, 0, 16, 16, 3], 4: [0, 0, 13, 16, 16, 16], 0: [13, 0, 0, 16, 16, 16], 1: [0, 0, 0, 3, 16, 16] };
const LEFT_OF = { 5: 1, 4: 0, 0: 5, 1: 4 };
STAIR_FACES.forEach((facing, fi) => {
  [false, true].forEach((open) => {
    [false, true].forEach((upper) => {
      const id = DOOR_BASE + fi * 4 + (open ? 2 : 0) + (upper ? 1 : 0);
      const side = open ? LEFT_OF[facing] : OPPOSITE[facing];
      const first = id === DOOR_BASE;
      shaped(id, first ? 'oak_door' : `oak_door_${fi}${open ? 'o' : ''}${upper ? 'u' : ''}`, [DOOR_PANEL[side]], {
        label: 'Oak Door', tex: upper ? 'oak_door_top' : 'oak_door_bottom', cutout: true, hardness: 3, tool: 'axe',
        sound: 'wood', base: DOOR_BASE, item: first, drop: upper ? null : 'oak_door', support: upper ? 'door_upper' : 'door_lower',
      });
      DOOR[id] = { facing, open, upper };
    });
  });
});
export function doorId(facing, open, upper) {
  return DOOR_BASE + STAIR_FACES.indexOf(facing) * 4 + (open ? 2 : 0) + (upper ? 1 : 0);
}

// Ladders hang on the wall on their `side`.
const LADDER_PANEL = { 5: [0, 0, 0, 16, 16, 1], 4: [0, 0, 15, 16, 16, 16], 0: [15, 0, 0, 16, 16, 16], 1: [0, 0, 0, 1, 16, 16] };
STAIR_FACES.forEach((side, i) => {
  const id = 200 + i;
  shaped(id, i === 0 ? 'ladder' : `ladder_${side}`, [LADDER_PANEL[side]], { tex: 'ladder', cutout: true, solid: false,
    hardness: 0.4, tool: 'axe', sound: 'wood', base: 200, item: i === 0, drop: 'ladder', support: 'ladder' });
  LADDER[side] = id;
  CLIMB[id] = 1;
});
export const LADDER_SIDE = { 200: 5, 201: 4, 202: 0, 203: 1 };

block(204, 'oak_fence', { render: R.MODEL, opaque: false, solid: true, tex: 'oak_planks', hardness: 2, tool: 'axe', sound: 'wood', label: 'Oak Fence' });
SHAPE_KIND[204] = 2;
ICON_SHAPE[204] = [[1, 0, 6, 5, 16, 10], [11, 0, 6, 15, 16, 10], [5, 6, 7, 11, 9, 9], [5, 12, 7, 11, 15, 9]];
block(205, 'glass_pane', { render: R.MODEL, opaque: false, solid: true, tex: { side: 'glass', top: 'glass_pane_top' }, cutout: true,
  hardness: 0.3, sound: 'glass', drop: null, label: 'Glass Pane' });
SHAPE_KIND[205] = 3;

// Chests (27 slots of storage) face the player who placed them.
export const CHEST = {};
[[206, 4], [207, 5], [208, 0], [209, 1]].forEach(([id, front], i) => {
  const tex = ['chest_side', 'chest_side', 'chest_top', 'chest_top', 'chest_side', 'chest_side'];
  tex[front] = 'chest_front';
  shaped(id, i === 0 ? 'chest' : `chest_${front}`, [[1, 0, 1, 15, 14, 15]], { tex, hardness: 2.5, tool: 'axe', sound: 'wood',
    base: 206, item: i === 0, drop: 'chest' });
  CHEST[id] = front;
});

// A furnace that is burning glows and lights up its surroundings (see furnace.js).
facing([218, 219, 220, 221], 'lit_furnace', { label: 'Furnace', front: 'furnace_front_on', side: 'furnace_side',
  top: 'furnace_top', hardness: 3.5, tool: 'pickaxe', tier: 1, emit: 13, item: false, drop: 'furnace', base: 42 });
export const FURNACE_IDS = new Set([42, 110, 111, 112, 218, 219, 220, 221]);
// The same furnace, lit or not, facing the same way.
export function furnaceVariant(id, lit) {
  const from = FACING_VARIANTS[lit ? 42 : 218], to = FACING_VARIANTS[lit ? 218 : 42];
  for (const f in from) if (from[f] === id) return to[f];
  return id;
}
export const isLitFurnace = (id) => id >= 218 && id <= 221;

// Beds: a foot and a head block; `dir` points from the foot towards the head.
export const BED = {};
[5, 4, 0, 1].forEach((dir, i) => {
  [false, true].forEach((head) => {
    const id = 210 + i * 2 + (head ? 1 : 0);
    const top = head ? { 5: 'bed_head', 4: 'bed_head_s', 0: 'bed_head_e', 1: 'bed_head_w' }[dir] : 'bed_foot';
    const tex = ['bed_side', 'bed_side', top, 'oak_planks', 'bed_side', 'bed_side'];
    shaped(id, id === 210 ? 'bed' : `bed_${dir}${head ? 'h' : ''}`, [[0, 0, 0, 16, 9, 16]], { label: 'Bed', tex, cutout: true,
      hardness: 0.2, sound: 'cloth', base: 210, item: id === 210, drop: head ? null : 'bed', support: 'bed' });
    BED[id] = { dir, head };
  });
});
export const bedId = (dir, head) => 210 + [5, 4, 0, 1].indexOf(dir) * 2 + (head ? 1 : 0);

const FENCE_ARMS = { 0: [[10, 6, 7, 16, 9, 9], [10, 12, 7, 16, 15, 9]], 1: [[0, 6, 7, 6, 9, 9], [0, 12, 7, 6, 15, 9]],
  4: [[7, 6, 10, 9, 9, 16], [7, 12, 10, 9, 15, 16]], 5: [[7, 6, 0, 9, 9, 6], [7, 12, 0, 9, 15, 6]] };
const FENCE_POST = [6, 0, 6, 10, 16, 10];
const FENCE_COLLIDE = { 0: [10, 0, 6, 16, 24, 10], 1: [0, 0, 6, 6, 24, 10], 4: [6, 0, 10, 10, 24, 16], 5: [6, 0, 0, 10, 24, 6] };
const PANE_ARMS = { 0: [9, 0, 7, 16, 16, 9], 1: [0, 0, 7, 7, 16, 9], 4: [7, 0, 9, 9, 16, 16], 5: [7, 0, 0, 9, 16, 7] };
const PANE_POST = [7, 0, 7, 9, 16, 9];

function connects(kind, nid) {
  if (OPAQUE[nid]) return true;
  return kind === 2 ? SHAPE_KIND[nid] === 2 : SHAPE_KIND[nid] === 3 || nid === B.glass;
}

// Texture rectangle [u0, v0, u1, v1] (1/16 units) for face f of a box, so shaped blocks line up
// with the full block textures next to them.
export function boxFaceUV(b, f) {
  switch (f) {
    case 0: return [16 - b[5], 16 - b[4], 16 - b[2], 16 - b[1]];
    case 1: return [b[2], 16 - b[4], b[5], 16 - b[1]];
    case 2: return [b[0], b[2], b[3], b[5]];
    case 3: return [16 - b[3], b[2], 16 - b[0], b[5]];
    case 4: return [b[0], 16 - b[4], b[3], 16 - b[1]];
    default: return [16 - b[3], 16 - b[4], 16 - b[0], 16 - b[1]];
  }
}

// Boxes for a shaped block. `neighbour(face)` returns the block id beside it (for fences and panes).
// With collision = true, fences are 1.5 blocks tall like the originals.
export function shapeBoxes(id, neighbour, collision = false) {
  const kind = SHAPE_KIND[id];
  if (kind === 1) return SHAPE[id];
  if (kind !== 2 && kind !== 3) return null;
  const out = [];
  if (kind === 2) out.push(collision ? [6, 0, 6, 10, 24, 10] : FENCE_POST);
  else out.push(PANE_POST);
  let any = false;
  for (const f of [0, 1, 4, 5]) {
    if (!connects(kind, neighbour(f))) continue;
    any = true;
    if (kind === 2) { if (collision) out.push(FENCE_COLLIDE[f]); else out.push(...FENCE_ARMS[f]); }
    else out.push(PANE_ARMS[f]);
  }
  if (kind === 3 && !any) out.push(PANE_ARMS[0], PANE_ARMS[1], PANE_ARMS[4], PANE_ARMS[5]);
  return out;
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
  'chest', 'bed', 'oak_door', 'ladder', 'oak_fence', 'glass_pane', 'oak_stairs', 'cobblestone_stairs', 'stone_brick_stairs', 'brick_stairs',
  'sandstone_stairs', 'stone_slab', 'cobblestone_slab', 'oak_slab', 'birch_slab', 'spruce_slab', 'brick_slab',
  'stone_brick_slab', 'sandstone_slab',
].map((n) => B[n]);
