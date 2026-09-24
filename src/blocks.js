// Block registry. IDs are part of the save format, so never renumber an existing block.
// Hot properties live in flat typed arrays for the mesher, lighting and physics.
// Ids are 16-bit. Blocks and items share one id space: blocks use 0-255 and 1024-4095, items that
// aren't blocks use 256-1023.
import { TEX } from './textures.js';
import { DYES, tintFor } from './colors.js';

export const R = { NONE: 0, CUBE: 1, CROSS: 2, TORCH: 3, LIQUID: 4, CACTUS: 5, MODEL: 6, FIRE: 7, CAMPFIRE: 8 };

// Per-face flags (also copied into vertex flags for the shader). F_UVROT only matters while
// meshing, so in vertices the same bit means F_ANIM: an 8-frame flipbook (consecutive layers).
export const F_TINT = 1, F_OVERLAY = 2, F_UVROT = 4, F_WAVE = 8, F_WATER = 16, F_EMISSIVE = 32, F_LAVA = 64;
export const F_ANIM = 4;

// Face order used everywhere: +X east, -X west, +Y top, -Y bottom, +Z south, -Z north.
export const FACE_DIRS = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]];

const N = 4096;
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
export const TINT = new Uint8Array(N); // 0 none, 1 grass, 2 foliage, 3 fixed colour, 4 water
export const TINT_RGB = new Uint8Array(N * 3);
export const TEXL = new Uint16Array(N * 6);
export const FFLAGS = new Uint8Array(N * 6);
export const REPLACEABLE = new Uint8Array(N);
export const SELECTABLE = new Uint8Array(N);
export const WATERLIKE = new Uint8Array(N); // 1 water, 2 lava
export const BASE = new Uint16Array(N);
export const ANIM = new Uint8Array(N);  // animated texture (flipbook) blocks
// Fire: how readily a block catches from fire next to it (spread) and how fast it burns away.
export const SPREAD = new Uint8Array(N);
export const BURN = new Uint8Array(N);
// Blocks that change over time get random ticks (crops, saplings, leaves; see growth.js).
export const TICKS = new Uint8Array(N);

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
    cat: o.cat ?? null, // creative inventory tab
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
  ANIM[id] = o.anim ? 1 : 0;
  TICKS[id] = o.ticks ? 1 : 0;
  if (o.tint === 'grass') TINT[id] = 1;
  else if (o.tint === 'foliage') TINT[id] = 2;
  else if (o.tint === 'water') TINT[id] = 4;
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
block(10, 'water', { render: R.LIQUID, tex: 'water', tint: 'water', translucent: true, solid: false, filter: 1, cullSelf: true,
  selectable: false, replaceable: true, liquid: 1, hardness: -1, sound: 'water', drop: null });
block(11, 'glass', { tex: 'glass', cutout: true, cullSelf: true, hardness: 0.3, sound: 'glass', drop: null });
block(12, 'bedrock', { tex: 'bedrock', hardness: -1 });
block(13, 'coal_ore', { tex: 'coal_ore', hardness: 3, tool: 'pickaxe', tier: 1, drop: 'coal' });
block(14, 'iron_ore', { tex: 'iron_ore', hardness: 3, tool: 'pickaxe', tier: 2, drop: 'raw_iron' });
block(15, 'gold_ore', { tex: 'gold_ore', hardness: 3, tool: 'pickaxe', tier: 3, drop: 'raw_gold' });
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
// The first eight wool colours kept their original ids; the rest are further up.
const WOOL_IDS = { white: 45, red: 46, orange: 47, yellow: 48, lime: 49, blue: 50, purple: 51, black: 52 };
DYES.forEach((d, i) => block(WOOL_IDS[d.name] ?? 1700 + i, `${d.name}_wool`, { tex: 'wool', tint: tintFor(d.wool, 0.9),
  hardness: 0.8, sound: 'cloth' }));
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
  block(119 + level, level === 8 ? 'water_falling' : `water_flow_${level}`, { render: R.LIQUID, tex: 'water', tint: 'water',
    translucent: true, solid: false, filter: 1, cullSelf: true, selectable: false, replaceable: true, liquid: 1,
    hardness: -1, sound: 'water', drop: null, item: false, base: 10 });
}
// Flowing lava works the same way (ids 222..228 levels 1..7, 229 falling), but spreads slower
// and only half as far: its level goes up by two with each block.
export const LAVA_FLOW_BASE = 222;
for (let level = 1; level <= 8; level++) {
  block(221 + level, level === 8 ? 'lava_falling' : `lava_flow_${level}`, { render: R.LIQUID, tex: 'lava', solid: false, emit: 15,
    cullSelf: true, selectable: false, replaceable: true, liquid: 2, emissive: true, hardness: -1, sound: 'water', drop: null,
    item: false, base: 35 });
}
export const isWater = (id) => WATERLIKE[id] === 1;
export const isLava = (id) => WATERLIKE[id] === 2;
// 0 = source, 1..7 = flowing level, 8 = falling.
export const waterLevel = (id) => (id === 10 ? 0 : id >= 120 && id <= 127 ? id - 119 : -1);
export const lavaLevel = (id) => (id === 35 ? 0 : id >= 222 && id <= 229 ? id - 221 : -1);
export const liquidLevel = (id) => (WATERLIKE[id] === 2 ? lavaLevel(id) : waterLevel(id));
// Surface height of a liquid block, as a fraction of a block.
export function liquidHeight(id) {
  const l = liquidLevel(id);
  if (l <= 0 || l === 8) return 0.875;
  return Math.max(0.12, (8 - l) / 9);
}

// Liquids use the same cull test as other liquids of the same kind.
for (let id = 0; id < N; id++) {
  if (!BLOCKS[id]) continue;
  if (WATERLIKE[id]) CULL_SELF[id] = 1;
}

export function sameCullGroup(a, b) {
  if (a === b) return true;
  return WATERLIKE[a] !== 0 && WATERLIKE[a] === WATERLIKE[b];
}

// Fire: an animated flame that burns on and beside flammable blocks (see world.js).
block(62, 'fire', { render: R.FIRE, tex: 'fire_0', cutout: true, solid: false, emit: 15, hardness: 0, sound: 'grass',
  replaceable: true, item: false, drop: null, emissive: true, anim: true });

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
function slabs(list, first) {
  list.forEach(([mat, short, name, side], i) => {
    const src = BLOCKS[B[mat]];
    const faces = side ? [side, side, src.faces[2], src.faces[3], side, side] : src.faces;
    const common = { tex: faces, hardness: src.hardness, tool: src.tool, tier: src.tier, sound: src.sound };
    const label = `${name} Slab`;
    const bottom = first + i * 2, top = bottom + 1;
    shaped(bottom, `${short}_slab`, [[0, 0, 0, 16, 8, 16]], { ...common, label });
    shaped(top, `${short}_slab_top`, [[0, 8, 0, 16, 16, 16]], { ...common, label, base: bottom, item: false, drop: `${short}_slab` });
    SLAB[bottom] = { material: B[mat], top: false, bottom, topId: top };
    SLAB[top] = { material: B[mat], top: true, bottom, topId: top };
  });
}
slabs([['stone', 'stone', 'Stone'], ['cobblestone', 'cobblestone', 'Cobblestone'], ['oak_planks', 'oak', 'Oak'],
  ['birch_planks', 'birch', 'Birch'], ['spruce_planks', 'spruce', 'Spruce'], ['bricks', 'brick', 'Brick'],
  ['stone_bricks', 'stone_brick', 'Stone Brick'], ['sandstone', 'sandstone', 'Sandstone']], 128);

// Stairs: the tall half faces away from the player who placed them.
const STAIR_FACES = [5, 4, 0, 1];
function stairBoxes(face, upside) {
  const base = upside ? [0, 8, 0, 16, 16, 16] : [0, 0, 0, 16, 8, 16];
  const y0 = upside ? 0 : 8, y1 = upside ? 8 : 16;
  const back = { 5: [0, y0, 0, 16, y1, 8], 4: [0, y0, 8, 16, y1, 16], 0: [8, y0, 0, 16, y1, 16], 1: [0, y0, 0, 8, y1, 16] }[face];
  return [base, back];
}
function stairs(list, first) {
  list.forEach(([mat, short, name], i) => {
    const src = BLOCKS[B[mat]];
    const label = `${name} Stairs`, base = first + i * 8;
    const ids = {};
    STAIR_FACES.forEach((face, fi) => {
      ids[face] = [];
      [false, true].forEach((upside, ui) => {
        const id = base + fi * 2 + ui;
        const firstId = fi === 0 && ui === 0;
        shaped(id, firstId ? `${short}_stairs` : `${short}_stairs_${face}${upside ? 'u' : ''}`,
          stairBoxes(face, upside), { tex: src.faces, hardness: src.hardness, tool: src.tool, tier: src.tier, sound: src.sound,
            label, base, item: firstId, drop: firstId ? undefined : `${short}_stairs` });
        ids[face][ui] = id;
      });
    });
    STAIRS[base] = { material: B[mat], ids };
  });
}
stairs([['oak_planks', 'oak', 'Oak'], ['cobblestone', 'cobblestone', 'Cobblestone'], ['stone_bricks', 'stone_brick', 'Stone Brick'],
  ['bricks', 'brick', 'Brick'], ['sandstone', 'sandstone', 'Sandstone']], 144);

// Doors: 16 variants (4 facings x open x lower/upper). The item is the closed lower half facing north.
const DOOR_PANEL = { 5: [0, 0, 0, 16, 16, 3], 4: [0, 0, 13, 16, 16, 16], 0: [13, 0, 0, 16, 16, 16], 1: [0, 0, 0, 3, 16, 16] };
const LEFT_OF = { 5: 1, 4: 0, 0: 5, 1: 4 };
function doors(wood, first) {
  const title = `${wood[0].toUpperCase()}${wood.slice(1).replace('_', ' ')} Door`;
  STAIR_FACES.forEach((facing, fi) => {
    [false, true].forEach((open) => {
      [false, true].forEach((upper) => {
        const id = first + fi * 4 + (open ? 2 : 0) + (upper ? 1 : 0);
        const side = open ? LEFT_OF[facing] : OPPOSITE[facing];
        const firstId = id === first;
        shaped(id, firstId ? `${wood}_door` : `${wood}_door_${fi}${open ? 'o' : ''}${upper ? 'u' : ''}`, [DOOR_PANEL[side]], {
          label: title.replace('Dark oak', 'Dark Oak'), tex: upper ? `${wood}_door_top` : `${wood}_door_bottom`, cutout: true, hardness: 3, tool: 'axe',
          sound: 'wood', base: first, item: firstId, drop: upper ? null : `${wood}_door`, support: upper ? 'door_upper' : 'door_lower', cat: 'functional',
        });
        DOOR[id] = { facing, open, upper, base: first, wood };
      });
    });
  });
}
doors('oak', DOOR_BASE);
export function doorId(facing, open, upper, base = DOOR_BASE) {
  return base + STAIR_FACES.indexOf(facing) * 4 + (open ? 2 : 0) + (upper ? 1 : 0);
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
// Two chests side by side facing the same way are one double chest of 54 slots. Each half is
// its own block; `partner` is the face towards the other half. The texture is split across the
// two, so each half uses the side of it that belongs there.
export const CHEST_PAIR = {};
const RIGHT_OF = { 4: 0, 5: 1, 0: 5, 1: 4 }; // looking at the front, the viewer's right
[4, 5, 0, 1].forEach((front, i) => {
  const right = RIGHT_OF[front], left = OPPOSITE[right];
  [right, left].forEach((partner, j) => {
    const id = 230 + i * 2 + j;
    const alongX = partner === 0 || partner === 1;
    const tex = ['chest_side', 'chest_side', alongX ? 'chest_top_dx' : 'chest_top_dz', alongX ? 'chest_top_dx' : 'chest_top_dz', 'chest_side', 'chest_side'];
    // (the half whose partner is on the viewer's right is the left half of the front)
    tex[front] = partner === right ? 'chest_front_l' : 'chest_front_r';
    tex[OPPOSITE[front]] = 'chest_back_double';
    const box = [1, 0, 1, 15, 14, 15];
    if (partner === 0) box[3] = 16; else if (partner === 1) box[0] = 0; else if (partner === 4) box[5] = 16; else box[2] = 0;
    shaped(id, `chest_double_${front}_${partner}`, [box], { label: 'Chest', tex, hardness: 2.5, tool: 'axe', sound: 'wood',
      base: 206, item: false, drop: 'chest' });
    CHEST[id] = front;
    CHEST_PAIR[id] = partner;
  });
});
export const CHEST_RIGHT = RIGHT_OF;
// The single chest facing `front`, and the half facing `front` whose other half is at `partner`.
export const chestId = (front) => Number(Object.keys(CHEST).find((k) => CHEST[k] === front && CHEST_PAIR[k] === undefined));
export const chestHalf = (front, partner) => 230 + [4, 5, 0, 1].indexOf(front) * 2 + (partner === RIGHT_OF[front] ? 0 : 1);

// A furnace that is burning glows and lights up its surroundings (see furnace.js).
facing([218, 219, 220, 221], 'lit_furnace', { label: 'Furnace', front: 'furnace_front_on', side: 'furnace_side',
  top: 'furnace_top', hardness: 3.5, tool: 'pickaxe', tier: 1, emit: 13, item: false, drop: 'furnace', base: 42 });
// Every furnace block (furnaces, smokers and blast furnaces, lit or not): see FURNACE_KINDS below.
export const FURNACE_IDS = new Set();
export const FURNACE_KIND = {};  // id -> 'furnace' | 'smoker' | 'blast_furnace'
export const FURNACE_FRONT = {}; // id -> the face its front is on
// The same furnace, lit or not, facing the same way.
export function furnaceVariant(id, lit) {
  const k = FURNACE_KINDS[FURNACE_KIND[id]];
  if (!k) return id;
  const from = FACING_VARIANTS[lit ? k.unlit : k.lit], to = FACING_VARIANTS[lit ? k.lit : k.unlit];
  for (const f in from) if (from[f] === id) return to[f];
  return id;
}
export const isLitFurnace = (id) => !!FURNACE_KIND[id] && Object.values(FACING_VARIANTS[FURNACE_KINDS[FURNACE_KIND[id]].lit]).includes(id);

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

// ================================================================ the release update's blocks
const natural = { cat: 'nature' };
const rock = (o = {}) => ({ hardness: 1.5, tool: 'pickaxe', tier: 1, ...o });
const ore = (o = {}) => ({ hardness: 3, tool: 'pickaxe', tier: 1, cat: 'nature', ...o });

// ---------------------------------------------------------------- rock and soil
block(1024, 'granite', { tex: 'granite', ...rock(), ...natural });
block(1025, 'polished_granite', { tex: 'polished_granite', ...rock() });
block(1026, 'diorite', { tex: 'diorite', ...rock(), ...natural });
block(1027, 'polished_diorite', { tex: 'polished_diorite', ...rock() });
block(1028, 'andesite', { tex: 'andesite', ...rock(), ...natural });
block(1029, 'polished_andesite', { tex: 'polished_andesite', ...rock() });
block(1030, 'calcite', { tex: 'calcite', ...rock({ hardness: 0.75 }), ...natural });
block(1031, 'deepslate', { tex: { side: 'deepslate', top: 'deepslate_top' }, ...rock({ hardness: 3 }), drop: 'cobbled_deepslate', ...natural });
block(1032, 'cobbled_deepslate', { tex: 'cobbled_deepslate', ...rock({ hardness: 3.5 }) });
block(1033, 'deepslate_bricks', { tex: 'deepslate_bricks', ...rock({ hardness: 3.5 }) });
block(1034, 'smooth_stone', { tex: 'smooth_stone', ...rock({ hardness: 2 }) });
block(1035, 'packed_ice', { tex: 'packed_ice', hardness: 0.5, tool: 'pickaxe', sound: 'glass', drop: null, ...natural });
block(1036, 'red_sand', { tex: 'red_sand', hardness: 0.5, tool: 'shovel', sound: 'sand', falls: true, ...natural });
block(1037, 'red_sandstone', { tex: { top: 'red_sandstone_top', bottom: 'red_sandstone_bottom', side: 'red_sandstone_side' }, ...rock({ hardness: 0.8 }) });
block(1038, 'cut_sandstone', { tex: { side: 'cut_sandstone', top: 'sandstone_top' }, ...rock({ hardness: 0.8 }) });
block(1039, 'chiseled_sandstone', { tex: { side: 'chiseled_sandstone', top: 'sandstone_top' }, ...rock({ hardness: 0.8 }) });
block(1040, 'cut_red_sandstone', { tex: { side: 'cut_red_sandstone', top: 'red_sandstone_top' }, ...rock({ hardness: 0.8 }) });
block(1041, 'chiseled_red_sandstone', { tex: { side: 'chiseled_red_sandstone', top: 'red_sandstone_top' }, ...rock({ hardness: 0.8 }) });
block(1042, 'terracotta', { tex: 'terracotta', ...rock({ hardness: 1.25 }), ...natural });
block(1043, 'coarse_dirt', { tex: 'coarse_dirt', hardness: 0.5, tool: 'shovel', sound: 'gravel', ...natural });
block(1044, 'podzol', { tex: { top: 'podzol_top', bottom: 'dirt', side: 'podzol_side' }, hardness: 0.5, tool: 'shovel', sound: 'gravel', drop: 'dirt', ...natural });
shaped(1045, 'dirt_path', [[0, 0, 0, 16, 15, 16]], { tex: { top: 'dirt_path_top', bottom: 'dirt', side: 'dirt_path_side' }, hardness: 0.65,
  tool: 'shovel', sound: 'gravel', drop: 'dirt', ao: true, ...natural });
shaped(1046, 'farmland', [[0, 0, 0, 16, 15, 16]], { tex: { top: 'farmland', bottom: 'dirt', side: 'dirt' }, hardness: 0.6, tool: 'shovel',
  sound: 'gravel', drop: 'dirt', ao: true, ticks: true, ...natural });
shaped(1047, 'farmland_moist', [[0, 0, 0, 16, 15, 16]], { label: 'Farmland', tex: { top: 'farmland_moist', bottom: 'dirt', side: 'dirt' },
  hardness: 0.6, tool: 'shovel', sound: 'gravel', drop: 'dirt', base: 1046, item: false, ao: true, ticks: true });
block(1048, 'mossy_stone_bricks', { tex: 'mossy_stone_bricks', ...rock() });
block(1049, 'cracked_stone_bricks', { tex: 'cracked_stone_bricks', ...rock() });
block(1050, 'chiseled_stone_bricks', { tex: 'chiseled_stone_bricks', ...rock() });

// ---------------------------------------------------------------- ores and minerals
block(1051, 'copper_ore', { tex: 'copper_ore', ...ore({ tier: 2 }), drop: 'raw_copper' });
block(1052, 'redstone_ore', { tex: 'redstone_ore', ...ore({ tier: 3 }), drop: 'redstone' });
block(1053, 'lapis_ore', { tex: 'lapis_ore', ...ore({ tier: 2 }), drop: 'lapis_lazuli' });
block(1054, 'emerald_ore', { tex: 'emerald_ore', ...ore({ tier: 3 }), drop: 'emerald' });
[['coal', 1, 'coal'], ['iron', 2, 'raw_iron'], ['copper', 2, 'raw_copper'], ['gold', 3, 'raw_gold'], ['redstone', 3, 'redstone'],
  ['lapis', 2, 'lapis_lazuli'], ['emerald', 3, 'emerald'], ['diamond', 3, 'diamond']].forEach(([name, tier, drop], i) => {
  block(1055 + i, `deepslate_${name}_ore`, { tex: `deepslate_${name}_ore`, ...ore({ hardness: 4.5, tier }), drop });
});
block(1063, 'copper_block', { label: 'Block of Copper', tex: 'copper_block', ...rock({ hardness: 3, tier: 2 }), sound: 'metal' });
block(1064, 'redstone_block', { label: 'Block of Redstone', tex: 'redstone_block', ...rock({ hardness: 5 }), sound: 'metal' });
block(1065, 'lapis_block', { label: 'Block of Lapis Lazuli', tex: 'lapis_block', ...rock({ hardness: 3, tier: 2 }) });
block(1066, 'emerald_block', { label: 'Block of Emerald', tex: 'emerald_block', ...rock({ hardness: 5, tier: 3 }), sound: 'metal' });

// ---------------------------------------------------------------- farm, village and workshop blocks
block(1067, 'hay_block', { label: 'Hay Bale', tex: { side: 'hay_block_side', top: 'hay_block_top' }, hardness: 0.5, sound: 'grass' });
block(1068, 'melon', { tex: { side: 'melon_side', top: 'melon_top' }, hardness: 1, tool: 'axe', sound: 'wood', drop: null, ...natural });
block(1069, 'barrel', { tex: { side: 'barrel_side', top: 'barrel_top', bottom: 'barrel_bottom' }, hardness: 2.5, tool: 'axe', sound: 'wood', cat: 'functional' });
block(1070, 'smithing_table', { tex: ['smithing_table_side', 'smithing_table_side', 'smithing_table_top', 'dark_oak_planks',
  'smithing_table_front', 'smithing_table_front'], hardness: 2.5, tool: 'axe', sound: 'wood', cat: 'functional' });
block(1071, 'fletching_table', { tex: ['fletching_table_side', 'fletching_table_side', 'fletching_table_top', 'birch_planks',
  'fletching_table_front', 'fletching_table_front'], hardness: 2.5, tool: 'axe', sound: 'wood', cat: 'functional' });
block(1072, 'iron_bars', { render: R.MODEL, opaque: false, solid: true, tex: 'iron_bars', cutout: true, hardness: 5, tool: 'pickaxe',
  sound: 'metal', cat: 'functional' });
SHAPE_KIND[1072] = 3;
// Lanterns stand on the ground or hang from a chain under a block.
shaped(1073, 'lantern', [[5, 0, 5, 11, 7, 11], [6, 7, 6, 10, 9, 10], [7, 9, 7, 9, 11, 9]], { tex: { side: 'lantern_side', top: 'lantern_top' },
  cutout: true, solid: false, emit: 15, emissive: true, hardness: 3.5, tool: 'pickaxe', sound: 'metal', support: 'lantern', cat: 'functional' });
shaped(1074, 'lantern_hanging', [[5, 0, 5, 11, 7, 11], [6, 7, 6, 10, 9, 10], [7.5, 9, 7.5, 8.5, 16, 8.5]], { label: 'Lantern',
  tex: { side: 'lantern_side', top: 'lantern_top' }, cutout: true, solid: false, emit: 15, emissive: true, hardness: 3.5, tool: 'pickaxe',
  sound: 'metal', base: 1073, item: false, drop: 'lantern', support: 'lantern_hanging' });
block(1075, 'campfire', { render: R.CAMPFIRE, opaque: false, solid: false, tex: { side: 'campfire_log_lit', top: 'fire_0', bottom: 'campfire_log' },
  emit: 15, hardness: 2, tool: 'axe', sound: 'wood', drop: 'charcoal', support: 'solid', cat: 'functional' });
SHAPE[1075] = [[0, 0, 0, 16, 7, 16]];
SHAPE_KIND[1075] = 1;
shaped(1076, 'lily_pad', [[0, 0, 0, 16, 0.25, 16]], { tex: 'lily_pad', cutout: true, tint: 'foliage', hardness: 0, sound: 'grass',
  support: 'water', ...natural });
// Vines hang against the face of a block on their `side`, like ladders, and can be climbed.
export const VINE = {};
STAIR_FACES.forEach((side, i) => {
  const id = 1077 + i;
  shaped(id, i === 0 ? 'vine' : `vine_${side}`, [LADDER_PANEL_FOR(side)], { label: 'Vines', tex: 'vine', cutout: true, tint: 'foliage', solid: false,
    hardness: 0.2, tool: 'shears', sound: 'grass', base: 1077, item: i === 0, drop: null, support: 'vine', replaceable: true, ...natural });
  VINE[side] = id;
  CLIMB[id] = 1;
});
export const VINE_SIDE = { 1077: 5, 1078: 4, 1079: 0, 1080: 1 };
// Smokers cook food and blast furnaces smelt ores and metal, both twice as fast as a furnace.
facing([1900, 1901, 1902, 1903], 'smoker', { front: 'smoker_front', side: 'smoker_side', top: 'smoker_top', bottom: 'smoker_bottom',
  hardness: 3.5, tool: 'pickaxe', tier: 1, cat: 'functional' });
facing([1904, 1905, 1906, 1907], 'lit_smoker', { label: 'Smoker', front: 'smoker_front_on', side: 'smoker_side', top: 'smoker_top',
  bottom: 'smoker_bottom', hardness: 3.5, tool: 'pickaxe', tier: 1, emit: 13, item: false, drop: 'smoker', base: 1900 });
facing([1908, 1909, 1910, 1911], 'blast_furnace', { front: 'blast_furnace_front', side: 'blast_furnace_side', top: 'blast_furnace_top',
  hardness: 3.5, tool: 'pickaxe', tier: 1, cat: 'functional' });
facing([1912, 1913, 1914, 1915], 'lit_blast_furnace', { label: 'Blast Furnace', front: 'blast_furnace_front_on', side: 'blast_furnace_side',
  top: 'blast_furnace_top', hardness: 3.5, tool: 'pickaxe', tier: 1, emit: 13, item: false, drop: 'blast_furnace', base: 1908 });
// Every kind of furnace: what it's called, its unlit and lit block, and which recipes it takes.
export const FURNACE_KINDS = {
  furnace: { unlit: 42, lit: 218, speed: 1, only: null },
  smoker: { unlit: 1900, lit: 1904, speed: 2, only: 'food' },
  blast_furnace: { unlit: 1908, lit: 1912, speed: 2, only: 'ore' },
};

for (const [kind, k] of Object.entries(FURNACE_KINDS)) {
  for (const base of [k.unlit, k.lit]) {
    for (const [face, id] of Object.entries(FACING_VARIANTS[base])) { FURNACE_IDS.add(id); FURNACE_KIND[id] = kind; FURNACE_FRONT[id] = Number(face); }
  }
}

// ---------------------------------------------------------------- woods
// Seven kinds of tree. Oak, birch and spruce keep their original ids; everything else about
// every wood lives from 1100 up, ten ids per wood.
export const WOOD_NAMES = ['oak', 'spruce', 'birch', 'jungle', 'acacia', 'dark_oak', 'cherry'];
export const WOOD = {};
export const LOG_AXES = { [B.oak_log]: [100, 101], [B.birch_log]: [102, 103], [B.spruce_log]: [104, 105] };
export const SAPLING = {};      // sapling id -> wood
export const LEAVES_WOOD = {};  // leaves id -> wood (natural and placed)
export const NATURAL_LEAVES = new Uint8Array(N); // leaves that wither once their tree is gone
const LEAF_TINT = { birch: [128, 167, 85], spruce: [97, 153, 97], cherry: null };
WOOD_NAMES.forEach((w, i) => {
  const base = 1100 + i * 10;
  const title = w === 'dark_oak' ? 'Dark Oak' : w[0].toUpperCase() + w.slice(1);
  if (B[`${w}_log`] === undefined) { log(base, base + 1, base + 2, w); LOG_AXES[base] = [base + 1, base + 2]; }
  if (B[`${w}_planks`] === undefined) block(base + 3, `${w}_planks`, { tex: `${w}_planks`, hardness: 2, tool: 'axe', sound: 'wood' });
  const tint = w in LEAF_TINT ? LEAF_TINT[w] ?? undefined : 'foliage';
  const leaf = { tex: `${w}_leaves`, cutout: true, tint, filter: 1, ao: true, wave: true, hardness: 0.2, tool: 'hoe', sound: 'grass', drop: null };
  if (B[`${w}_leaves`] === undefined) block(base + 4, `${w}_leaves`, { ...leaf, ...natural });
  // Leaves a player places are theirs to keep: they never wither.
  block(base + 7, `${w}_leaves_placed`, { ...leaf, label: `${title} Leaves`, base: B[`${w}_leaves`], item: false });
  block(base + 5, `${w}_sapling`, plant({ label: `${title} Sapling`, tex: `${w}_sapling`, ticks: true, ...natural }));
  if (w !== 'oak') {
    block(base + 6, `${w}_fence`, { render: R.MODEL, opaque: false, solid: true, tex: `${w}_planks`, hardness: 2, tool: 'axe', sound: 'wood',
      label: `${title} Fence`, cat: 'functional' });
    SHAPE_KIND[base + 6] = 2;
    ICON_SHAPE[base + 6] = ICON_SHAPE[204];
  }
  const leaves = B[`${w}_leaves`];
  NATURAL_LEAVES[leaves] = 1;
  LEAVES_WOOD[leaves] = w;
  LEAVES_WOOD[base + 7] = w;
  SAPLING[base + 5] = w;
  WOOD[w] = { log: B[`${w}_log`], planks: B[`${w}_planks`], leaves, placedLeaves: base + 7, sapling: base + 5,
    fence: w === 'oak' ? 204 : base + 6, title };
});
BLOCKS[204].cat = 'functional';

// Fence gates: 4 facings x open. A gate spans across the way it faces and swings open away from
// whoever opened it; open gates can be walked through.
export const GATE = {}; // id -> { facing, open, base }
const GATE_CLOSED = [[0, 5, 7, 2, 16, 9], [14, 5, 7, 16, 16, 9], [2, 6, 7, 14, 9, 9], [2, 12, 7, 14, 15, 9], [6, 9, 7, 10, 12, 9]];
const GATE_OPEN = [[0, 5, 7, 2, 16, 9], [14, 5, 7, 16, 16, 9], [0, 6, 1, 2, 9, 7], [0, 12, 1, 2, 15, 7], [0, 9, 1, 2, 12, 3],
  [14, 6, 1, 16, 9, 7], [14, 12, 1, 16, 15, 7], [14, 9, 1, 16, 12, 3]];
// Boxes are drawn for a gate facing north (-Z); this turns them to face `f`.
function turnBox(b, f) {
  const pt = (x, z) => (f === 4 ? [16 - x, 16 - z] : f === 0 ? [16 - z, x] : f === 1 ? [z, 16 - x] : [x, z]);
  const [ax, az] = pt(b[0], b[2]), [bx, bz] = pt(b[3], b[5]);
  return [Math.min(ax, bx), b[1], Math.min(az, bz), Math.max(ax, bx), b[4], Math.max(az, bz)];
}
export const COLLISION = new Array(N).fill(null);
WOOD_NAMES.forEach((w, i) => {
  const first = 1500 + i * 8;
  STAIR_FACES.forEach((facing, fi) => {
    [false, true].forEach((open) => {
      const id = first + fi * 2 + (open ? 1 : 0);
      shaped(id, id === first ? `${w}_fence_gate` : `${w}_fence_gate_${facing}${open ? 'o' : ''}`,
        (open ? GATE_OPEN : GATE_CLOSED).map((b) => turnBox(b, facing)), { label: `${WOOD[w].title} Fence Gate`, tex: `${w}_planks`,
          hardness: 2, tool: 'axe', sound: 'wood', base: first, item: id === first, drop: `${w}_fence_gate`, cat: 'functional' });
      COLLISION[id] = open ? [] : [turnBox([0, 0, 6, 16, 24, 10], facing)];
      GATE[id] = { facing, open, base: first };
    });
  });
  WOOD[w].gate = first;
});
export const gateId = (base, facing, open) => base + STAIR_FACES.indexOf(facing) * 2 + (open ? 1 : 0);

// The new woods' slabs, stairs and doors, and the new stones'.
slabs([['jungle_planks', 'jungle', 'Jungle'], ['acacia_planks', 'acacia', 'Acacia'], ['dark_oak_planks', 'dark_oak', 'Dark Oak'],
  ['cherry_planks', 'cherry', 'Cherry'], ['mossy_cobblestone', 'mossy_cobblestone', 'Mossy Cobblestone'],
  ['mossy_stone_bricks', 'mossy_stone_brick', 'Mossy Stone Brick'], ['smooth_stone', 'smooth_stone', 'Smooth Stone', 'smooth_stone_side'],
  ['granite', 'granite', 'Granite'], ['polished_granite', 'polished_granite', 'Polished Granite'], ['diorite', 'diorite', 'Diorite'],
  ['polished_diorite', 'polished_diorite', 'Polished Diorite'], ['andesite', 'andesite', 'Andesite'],
  ['polished_andesite', 'polished_andesite', 'Polished Andesite'], ['cobbled_deepslate', 'cobbled_deepslate', 'Cobbled Deepslate'],
  ['deepslate_bricks', 'deepslate_brick', 'Deepslate Brick'], ['red_sandstone', 'red_sandstone', 'Red Sandstone']], 1200);
stairs([['spruce_planks', 'spruce', 'Spruce'], ['birch_planks', 'birch', 'Birch'], ['jungle_planks', 'jungle', 'Jungle'],
  ['acacia_planks', 'acacia', 'Acacia'], ['dark_oak_planks', 'dark_oak', 'Dark Oak'], ['cherry_planks', 'cherry', 'Cherry'],
  ['mossy_cobblestone', 'mossy_cobblestone', 'Mossy Cobblestone'], ['mossy_stone_bricks', 'mossy_stone_brick', 'Mossy Stone Brick'],
  ['granite', 'granite', 'Granite'], ['polished_granite', 'polished_granite', 'Polished Granite'], ['diorite', 'diorite', 'Diorite'],
  ['polished_diorite', 'polished_diorite', 'Polished Diorite'], ['andesite', 'andesite', 'Andesite'],
  ['polished_andesite', 'polished_andesite', 'Polished Andesite'], ['cobbled_deepslate', 'cobbled_deepslate', 'Cobbled Deepslate'],
  ['deepslate_bricks', 'deepslate_brick', 'Deepslate Brick'], ['red_sandstone', 'red_sandstone', 'Red Sandstone']], 1300);
['spruce', 'birch', 'jungle', 'acacia', 'dark_oak', 'cherry'].forEach((w, i) => doors(w, 1600 + i * 16));
for (const w of WOOD_NAMES) WOOD[w].door = B[`${w}_door`];

// Walls: a post with low arms reaching to anything they join (1.5 blocks tall to jump over).
export const WALL_MATERIALS = [['cobblestone', 'Cobblestone'], ['mossy_cobblestone', 'Mossy Cobblestone'], ['stone_bricks', 'Stone Brick'],
  ['mossy_stone_bricks', 'Mossy Stone Brick'], ['bricks', 'Brick'], ['sandstone', 'Sandstone'], ['red_sandstone', 'Red Sandstone'],
  ['granite', 'Granite'], ['diorite', 'Diorite'], ['andesite', 'Andesite'], ['cobbled_deepslate', 'Cobbled Deepslate'],
  ['deepslate_bricks', 'Deepslate Brick']];
WALL_MATERIALS.forEach(([mat, name], i) => {
  const src = BLOCKS[B[mat]], id = 1450 + i;
  const short = mat.replace(/_bricks$/, '_brick').replace(/^bricks$/, 'brick');
  block(id, `${short}_wall`, { render: R.MODEL, opaque: false, solid: true, tex: src.faces, hardness: src.hardness, tool: src.tool,
    tier: src.tier, sound: src.sound, label: `${name} Wall` });
  SHAPE_KIND[id] = 4;
  ICON_SHAPE[id] = [[0, 0, 5, 16, 13, 11], [4, 0, 4, 12, 16, 12]];
});

// ---------------------------------------------------------------- coloured blocks
DYES.forEach((d, i) => {
  const t = d.name === 'light_gray' ? 'Light Gray' : d.name === 'light_blue' ? 'Light Blue' : d.name[0].toUpperCase() + d.name.slice(1);
  shaped(1720 + i, `${d.name}_carpet`, [[0, 0, 0, 16, 1, 16]], { label: `${t} Carpet`, tex: 'wool', tint: tintFor(d.wool, 0.9),
    hardness: 0.1, sound: 'cloth', support: 'carpet', cat: 'colored' });
  block(1740 + i, `${d.name}_concrete`, { label: `${t} Concrete`, tex: 'concrete', tint: tintFor(d.concrete, 0.93), ...rock({ hardness: 1.8 }), cat: 'colored' });
  block(1760 + i, `${d.name}_terracotta`, { label: `${t} Terracotta`, tex: 'terracotta_dyed', tint: tintFor(d.terracotta, 0.9),
    ...rock({ hardness: 1.25 }), cat: 'colored' });
  block(1780 + i, `${d.name}_stained_glass`, { label: `${t} Stained Glass`, tex: 'stained_glass', tint: tintFor(d.wool, 0.96),
    translucent: true, cullSelf: true, filter: 1, hardness: 0.3, sound: 'glass', drop: null, cat: 'colored' });
  BLOCKS[B[`${d.name}_wool`]].cat = 'colored';
  BLOCKS[B[`${d.name}_wool`]].label = `${t} Wool`;
});

// ---------------------------------------------------------------- plants
block(1800, 'fern', plant({ tex: 'fern', tint: 'grass', wave: true, replaceable: true, drop: null, ...natural }));
['allium', 'azure_bluet', 'blue_orchid', 'oxeye_daisy', 'red_tulip', 'orange_tulip', 'white_tulip', 'pink_tulip', 'lily_of_the_valley']
  .forEach((f, i) => block(1801 + i, f, plant({ tex: f, wave: true, ...natural })));
// Tall plants are two blocks: a lower half (the item) and an upper half that goes with it.
export const DOUBLE = {}; // id -> { upper, other }
[['tall_grass_double', 'Tall Grass', 'tall_grass', 'grass'], ['large_fern', 'Large Fern', 'large_fern', 'grass'],
  ['sunflower', 'Sunflower', 'sunflower', null], ['lilac', 'Lilac', 'lilac', null], ['rose_bush', 'Rose Bush', 'rose_bush', null],
  ['peony', 'Peony', 'peony', null]].forEach(([name, label, tex, tint], i) => {
  const lower = 1810 + i * 2, upper = lower + 1;
  const common = { label, wave: true, tint: tint ?? undefined, ...natural };
  block(lower, name, plant({ ...common, tex: `${tex}_bottom`, support: 'double_lower', drop: tint ? null : name }));
  block(upper, `${name}_top`, plant({ ...common, tex: `${tex}_top`, support: 'double_upper', base: lower, item: false, drop: null }));
  DOUBLE[lower] = { upper: false, other: upper };
  DOUBLE[upper] = { upper: true, other: lower };
});
// Crops grow in stages on farmland: wheat in eight, carrots, potatoes and beetroots in four.
export const CROP = {}; // id -> { name, stage, max, first }
[['wheat', 8, 1830], ['carrots', 4, 1840], ['potatoes', 4, 1844], ['beetroots', 4, 1848]].forEach(([name, n, first]) => {
  for (let s = 0; s < n; s++) {
    const label = { wheat: 'Wheat Crops', carrots: 'Carrots', potatoes: 'Potatoes', beetroots: 'Beetroots' }[name];
    block(first + s, s === 0 ? name : `${name}_${s}`, plant({ label, tex: `${name}_${s}`, support: 'farmland', base: first, item: false,
      drop: null, ticks: true, replaceable: false, hardness: 0 }));
    CROP[first + s] = { name, stage: s, max: n - 1, first };
  }
});
for (const id of [B.sugar_cane, B.cactus, B.dirt]) TICKS[id] = 1;
// Logs of every wood (all three ways up), for leaves checking whether their tree still stands.
export const LOG = new Uint8Array(N);
for (const w of WOOD_NAMES) { LOG[WOOD[w].log] = 1; for (const a of LOG_AXES[WOOD[w].log]) LOG[a] = 1; }

// Blocks shown in the inventory and in the hand as a flat picture rather than a little model
// (-1 for the rest). Tall flowers show their flowering top.
export function spriteOf(block) {
  if (DOOR[block]) return TEX[`${DOOR[block].wood}_door_item`];
  if (BED[block]) return TEX.bed_item;
  if (VINE_SIDE[block] !== undefined) return TEX.vine;
  if (CLIMB[block]) return TEX.ladder;
  if (block === B.iron_bars) return TEX.iron_bars;
  if (SHAPE_KIND[block] === 3) return TEX.glass;
  if (block === B.lantern) return TEX.lantern_item;
  if (block === B.campfire) return TEX.campfire_item;
  if (block === B.lily_pad) return TEX.lily_pad;
  if (DOUBLE[block] && !DOUBLE[block].upper) return TEXL[DOUBLE[block].other * 6];
  return -1;
}

// Chests placed by the world generator, full of loot the first time they're opened (see
// loot.js). They look like chests facing south.
export const LOOT_CHEST = {};
export const LOOT_KIND = {}; // id -> table
['dungeon', 'village', 'smith', 'desert', 'house'].forEach((kind, i) => {
  const id = 1990 + i;
  const tex = ['chest_side', 'chest_side', 'chest_top', 'chest_top', 'chest_front', 'chest_side'];
  shaped(id, `loot_chest_${kind}`, [[1, 0, 1, 15, 14, 15]], { label: 'Chest', tex, hardness: 2.5, tool: 'axe', sound: 'wood',
    base: 206, item: false, drop: 'chest' });
  LOOT_CHEST[kind] = id;
  LOOT_KIND[id] = kind;
});

// A ladder's panel against the wall on `side` (shared with vines).
function LADDER_PANEL_FOR(side) {
  return { 5: [0, 0, 0, 16, 16, 1], 4: [0, 0, 15, 16, 16, 16], 0: [15, 0, 0, 16, 16, 16], 1: [0, 0, 0, 1, 16, 16] }[side];
}

const FENCE_ARMS = { 0: [[10, 6, 7, 16, 9, 9], [10, 12, 7, 16, 15, 9]], 1: [[0, 6, 7, 6, 9, 9], [0, 12, 7, 6, 15, 9]],
  4: [[7, 6, 10, 9, 9, 16], [7, 12, 10, 9, 15, 16]], 5: [[7, 6, 0, 9, 9, 6], [7, 12, 0, 9, 15, 6]] };
const FENCE_POST = [6, 0, 6, 10, 16, 10];
const FENCE_COLLIDE = { 0: [10, 0, 6, 16, 24, 10], 1: [0, 0, 6, 6, 24, 10], 4: [6, 0, 10, 10, 24, 16], 5: [6, 0, 0, 10, 24, 6] };
const PANE_ARMS = { 0: [9, 0, 7, 16, 16, 9], 1: [0, 0, 7, 7, 16, 9], 4: [7, 0, 9, 9, 16, 16], 5: [7, 0, 0, 9, 16, 7] };
const PANE_POST = [7, 0, 7, 9, 16, 9];

// What fences (2), panes and bars (3) and walls (4) join up with: each other, fence gates, and
// any full solid block.
function connects(kind, nid) {
  if (OPAQUE[nid] || GATE[nid]) return true;
  const k = SHAPE_KIND[nid];
  if (kind === 2) return k === 2;
  if (kind === 3) return k === 3 || k === 4 || nid === B.glass || (TRANSLUCENT[nid] && RENDER[nid] === R.CUBE && BLOCKS[nid].name.endsWith('glass'));
  return k === 4 || k === 3;
}
const WALL_POST = [4, 0, 4, 12, 16, 12];
const WALL_ARMS = { 0: [8, 0, 5, 16, 14, 11], 1: [0, 0, 5, 8, 14, 11], 4: [5, 0, 8, 11, 14, 16], 5: [5, 0, 0, 11, 14, 8] };

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
  if (kind === 1) return collision && COLLISION[id] ? COLLISION[id] : SHAPE[id];
  if (kind === 4) {
    // A straight run of wall with nothing on top has no post.
    const j = [0, 1, 4, 5].map((f) => connects(4, neighbour(f)));
    const straight = (j[0] && j[1] && !j[2] && !j[3]) || (j[2] && j[3] && !j[0] && !j[1]);
    const out = straight && !neighbour(2) ? [] : [collision ? [4, 0, 4, 12, 24, 12] : WALL_POST];
    [0, 1, 4, 5].forEach((f, i) => { if (j[i]) { const a = WALL_ARMS[f]; out.push(collision ? [a[0], 0, a[2], a[3], 24, a[5]] : a); } });
    return out;
  }
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

// Minecraft's fire numbers: [catch chance, burn chance] (out of 100-ish, see world.js).
function flammable(names, spread, burn) {
  for (const n of names) {
    for (let id = 0; id < N; id++) {
      const d = BLOCKS[id];
      if (d && (d.name === n || BLOCKS[BASE[id]]?.name === n)) { SPREAD[id] = spread; BURN[id] = burn; }
    }
  }
}
flammable([...WOOD_NAMES.flatMap((w) => [`${w}_planks`, `${w}_slab`, `${w}_stairs`, `${w}_fence`, `${w}_fence_gate`, `${w}_door`]),
  'crafting_table', 'ladder', 'barrel', 'smithing_table', 'fletching_table'], 5, 20);
flammable(WOOD_NAMES.map((w) => `${w}_log`), 5, 5);
flammable(WOOD_NAMES.flatMap((w) => [`${w}_leaves`, `${w}_leaves_placed`]), 30, 60);
flammable([...DYES.flatMap((d) => [`${d.name}_wool`, `${d.name}_carpet`]), 'bed'], 30, 60);
flammable(['tall_grass', 'fern', 'tall_grass_double', 'large_fern', 'dandelion', 'poppy', 'cornflower', 'allium', 'azure_bluet',
  'blue_orchid', 'oxeye_daisy', 'red_tulip', 'orange_tulip', 'white_tulip', 'pink_tulip', 'lily_of_the_valley', 'sunflower', 'lilac',
  'rose_bush', 'peony', 'dead_bush', 'vine'], 60, 100);
flammable(['bookshelf'], 30, 20);
flammable(['tnt'], 15, 100);
flammable(['chest'], 5, 20);
flammable(['hay_block'], 60, 20);

// Blocks worth listing in the creative inventory, in display order (anything not named here
// follows in id order).
const CREATIVE_ORDER = [
  // building
  ...WOOD_NAMES.flatMap((w) => [`${w}_log`, `${w}_planks`, `${w}_stairs`, `${w}_slab`]),
  'stone', 'stone_slab', 'cobblestone', 'cobblestone_stairs', 'cobblestone_slab', 'cobblestone_wall', 'mossy_cobblestone',
  'mossy_cobblestone_stairs', 'mossy_cobblestone_slab', 'mossy_cobblestone_wall', 'smooth_stone', 'smooth_stone_slab', 'stone_bricks',
  'stone_brick_stairs', 'stone_brick_slab', 'stone_brick_wall', 'mossy_stone_bricks', 'mossy_stone_brick_stairs', 'mossy_stone_brick_slab',
  'mossy_stone_brick_wall', 'cracked_stone_bricks', 'chiseled_stone_bricks',
  ...['granite', 'diorite', 'andesite'].flatMap((r) => [r, `${r}_stairs`, `${r}_slab`, `${r}_wall`, `polished_${r}`, `polished_${r}_stairs`, `polished_${r}_slab`]),
  'deepslate', 'cobbled_deepslate', 'cobbled_deepslate_stairs', 'cobbled_deepslate_slab', 'cobbled_deepslate_wall', 'deepslate_bricks',
  'deepslate_brick_stairs', 'deepslate_brick_slab', 'deepslate_brick_wall', 'bricks', 'brick_stairs', 'brick_slab', 'brick_wall',
  'sandstone', 'sandstone_stairs', 'sandstone_slab', 'sandstone_wall', 'cut_sandstone', 'chiseled_sandstone', 'red_sandstone',
  'red_sandstone_stairs', 'red_sandstone_slab', 'red_sandstone_wall', 'cut_red_sandstone', 'chiseled_red_sandstone', 'glass', 'glass_pane',
  'coal_block', 'iron_block', 'copper_block', 'gold_block', 'redstone_block', 'emerald_block', 'lapis_block', 'diamond_block',
  // coloured
  ...DYES.flatMap((d) => [`${d.name}_wool`, `${d.name}_carpet`]), 'terracotta', ...DYES.map((d) => `${d.name}_terracotta`),
  ...DYES.map((d) => `${d.name}_concrete`), ...DYES.map((d) => `${d.name}_stained_glass`),
  // natural
  'grass_block', 'podzol', 'dirt', 'coarse_dirt', 'dirt_path', 'farmland', 'snowy_grass', 'snow_block', 'ice', 'packed_ice', 'sand', 'red_sand',
  'gravel', 'clay', 'calcite', 'terracotta', 'coal_ore', 'deepslate_coal_ore', 'iron_ore', 'deepslate_iron_ore', 'copper_ore',
  'deepslate_copper_ore', 'gold_ore', 'deepslate_gold_ore', 'redstone_ore', 'deepslate_redstone_ore', 'emerald_ore', 'deepslate_emerald_ore',
  'lapis_ore', 'deepslate_lapis_ore', 'diamond_ore', 'deepslate_diamond_ore', 'obsidian', 'bedrock', 'water', 'lava',
  ...WOOD_NAMES.flatMap((w) => [`${w}_leaves`, `${w}_sapling`]), 'tall_grass', 'fern', 'tall_grass_double', 'large_fern', 'dead_bush',
  'dandelion', 'poppy', 'cornflower', 'allium', 'azure_bluet', 'blue_orchid', 'oxeye_daisy', 'red_tulip', 'orange_tulip', 'white_tulip',
  'pink_tulip', 'lily_of_the_valley', 'sunflower', 'lilac', 'rose_bush', 'peony', 'sugar_cane', 'cactus', 'vine', 'lily_pad',
  'red_mushroom', 'brown_mushroom', 'pumpkin', 'melon', 'hay_block',
  // functional
  'crafting_table', 'furnace', 'smoker', 'blast_furnace', 'chest', 'barrel', 'smithing_table', 'fletching_table', 'bed', 'bookshelf',
  'torch', 'lantern', 'campfire', 'glowstone', 'jack_o_lantern', 'ladder', 'iron_bars', 'tnt',
  ...WOOD_NAMES.flatMap((w) => [`${w}_door`, `${w}_fence`, `${w}_fence_gate`]),
];
export const CREATIVE_BLOCKS = (() => {
  const out = [], seen = new Set();
  for (const n of CREATIVE_ORDER) { const id = B[n]; if (id !== undefined && BLOCKS[id].item && !seen.has(id)) { seen.add(id); out.push(id); } }
  for (let id = 1; id < N; id++) if (BLOCKS[id]?.item && !seen.has(id)) out.push(id);
  return out;
})();
// Creative tabs for blocks that didn't say.
for (const n of ['grass_block', 'dirt', 'snowy_grass', 'sand', 'gravel', 'clay', 'coal_ore', 'iron_ore', 'gold_ore', 'diamond_ore', 'bedrock',
  'water', 'lava', 'cactus', 'tall_grass', 'dandelion', 'poppy', 'cornflower', 'dead_bush', 'sugar_cane', 'red_mushroom', 'brown_mushroom',
  'pumpkin', 'snow_block', 'ice', 'obsidian', ...WOOD_NAMES.map((w) => `${w}_leaves`)]) BLOCKS[B[n]].cat = 'nature';
for (const n of ['crafting_table', 'furnace', 'chest', 'bed', 'ladder', 'torch', 'glowstone', 'jack_o_lantern', 'bookshelf', 'tnt']) BLOCKS[B[n]].cat = 'functional';
