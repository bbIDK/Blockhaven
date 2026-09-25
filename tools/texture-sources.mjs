// Where each of the game's textures comes from (see tools/import-textures.mjs). A texture not
// listed here comes from Pixel Perfection's block/<name>.png or item/<name>.png when there's one
// by that name; null keeps it drawn in code. A source is a picture ('block/stone' in Pixel
// Perfection, 'mcl:mods/...' in Mineclonia; the first frame of an animation strip), or a function
// that makes the 16x16 picture from others with the helpers in H (load, crop, paste, rot, ...).

const MCL = {
  deepslate: 'mcl:mods/ITEMS/mcl_deepslate/textures/mcl_deepslate',
  copper: 'mcl:mods/ITEMS/mcl_copper/textures/mcl_copper',
  cherry: 'mcl:mods/ITEMS/mcl_cherry_blossom/textures/mcl_cherry_blossom',
  raw: 'mcl:mods/ITEMS/mcl_raw_ores/textures/mcl_raw_ores',
  drip: 'mcl:mods/ITEMS/mcl_dripstone/textures',
  lush: 'mcl:mods/ITEMS/mcl_lush_caves/textures/mcl_lush_caves',
  amethyst: 'mcl:mods/ITEMS/mcl_amethyst/textures/mcl_amethyst',
};
const mcl = (path) => `${path}.png`;

// A grey copy scaled to average `mean`, as a base for the game's colour tints.
const grayOf = (ref, mean) => (H) => H.gray(H.frame(H.load(ref)), mean);
// 8x8 particles, doubled to 16x16.
const particle = (name) => (H) => H.scale(H.load(`particle/${name}`), 2);

// ---------------------------------------------------------------- chests
// Minecraft's chest model: the lid (14 x 5 x 14) over the base (14 x 10 x 14), with the latch on
// the front. Each box's sides lie in a row in the sheet (the fourth is the front), stored upside
// down, and the face above is right of the one below. The game's chest is one 14 x 14 x 14 box
// whose side textures show rows 2-15 (the lid in rows 2-6, then the base below it; the base's top
// row is hidden under the lid in Minecraft too), and whose top shows the lid's in rows and
// columns 1-14.
function chestSide(H, sheet, lid, base, w = 14, at = 1) {
  const out = H.blank();
  H.paste(out, H.flipY(H.crop(sheet, base[0], base[1] + 1, w, 9)), at, 7);
  H.paste(out, H.flipY(H.crop(sheet, lid[0], lid[1], w, 5)), at, 2);
  return out;
}
const CHEST = 'entity/chest/normal', CHEST_L = 'entity/chest/normal_left', CHEST_R = 'entity/chest/normal_right';
// The latch's front (w wide, 4 high), on the seam between lid and base.
const latch = (H, out, sheet, [u, v], x0, w = 2) => H.paste(out, H.flipY(H.crop(H.load(sheet), u, v, w, 4)), x0, 5);
const singleSide = (H) => chestSide(H, H.load(CHEST), [0, 14], [0, 33]);
// Both halves of a double chest share their back and top, so those are the single chest's without
// the iron at their ends, widened to the whole 16 pixels.
function widen(H, img, from, to) {
  const out = H.blank();
  for (let x = 0; x < 16; x++) H.paste(out, H.crop(img, from + (x % (to - from + 1)), 0, 1, 16), x, 0);
  return out;
}
const doubleTop = (H) => widen(H, H.paste(H.blank(), H.crop(H.load(CHEST), 28, 0, 14, 14), 1, 1), 4, 11);

// ---------------------------------------------------------------- beds
// Minecraft's bed sheet: the head half's top (pillow end first) at (6, 6), the foot half's at
// (6, 28); their 6-pixel-deep sides beside them, and the legs at (50, 0).
const BED = 'entity/bed/red';
const bedHead = (H) => H.crop(H.load(BED), 6, 6, 16, 16);
function bedSide(H) {
  const sheet = H.load(BED), out = H.blank();
  // The mattress: the foot half's side, turned so its top edge is up.
  H.paste(out, H.rot(H.crop(sheet, 0, 28, 6, 16), 1), 0, 7);
  // Legs at the two corners.
  const leg = H.crop(sheet, 50, 3, 3, 3);
  H.paste(out, leg, 0, 13); H.paste(out, leg, 13, 13);
  return out;
}

// ---------------------------------------------------------------- the rest of the models
// Lantern: Minecraft's sheet has the body's sides at (0, 2) 6 x 7, its top at (0, 9) 6 x 6, the
// cap's sides at (1, 0) 4 x 2, and the handle at (11, 1). The game's boxes read the texture where
// they stand: body sides at columns 5-10, rows 9-15; cap at 6-9, rows 7-8; handle at 7-8, rows 5-6
// (and the hanging lantern's chain above it).
function lanternSide(H) {
  const sheet = H.frame(H.load('block/lantern')), out = H.blank();
  H.paste(out, H.crop(sheet, 0, 2, 6, 7), 5, 9);
  H.paste(out, H.crop(sheet, 1, 0, 4, 2), 6, 7);
  const link = H.crop(sheet, 12, 1, 2, 2);
  for (let y = 5; y >= -1; y -= 2) H.paste(out, link, 7, y);
  return out;
}
const lanternTop = (H) => H.paste(H.blank(), H.crop(H.frame(H.load('block/lantern')), 0, 9, 6, 6), 5, 5);

// Bell: Minecraft's bell_body sheet (32 x 32) has the bell (6 x 7 x 6 box at (0, 0)) and its lip
// (8 x 2 x 8 at (0, 13)). The game's bell: body sides at columns 5-10, rows 4-10; lip at 4-11, rows
// 11-12; the little crown on top at 6-9, row 3.
function bellBody(H) {
  const sheet = H.load('entity/bell/bell_body'), out = H.blank();
  H.paste(out, H.crop(sheet, 6, 6, 6, 7), 5, 4);
  H.paste(out, H.crop(sheet, 8, 21, 8, 2), 4, 11);
  H.paste(out, H.crop(sheet, 7, 6, 4, 1), 6, 3);
  return out;
}

// The campfire's logs read their texture both along and across, so its bark (the top 4 rows of
// Minecraft's log texture) is repeated down the whole picture. Lit, the bottom logs (rows 12-15)
// glow with embers.
const bark = (H, ref) => H.crop(H.frame(H.load(ref)), 0, 0, 16, 4);
const campfireLog = (lit) => (H) => {
  const out = H.tile(bark(H, 'block/campfire_log'));
  return lit ? H.paste(out, bark(H, 'block/campfire_log_lit'), 0, 12) : out;
};
// The lever's handle is a 2 x 2 stick that reads its texture wherever it leans, so the stick in
// Minecraft's lever texture (columns 7-8, rows 6-15) is repeated over the whole picture.
const leverStick = (H) => H.tile(H.crop(H.load('block/lever'), 7, 6, 2, 10));
// Flower pot seen from above: its rim round a square of soil.
function flowerPotTop(H) {
  const out = H.paste(H.blank(), H.crop(H.load('block/flower_pot'), 5, 10, 6, 6), 5, 5);
  return H.paste(out, H.crop(H.load('block/dirt'), 6, 6, 4, 4), 6, 6);
}
// Water in a cauldron: the water texture in Minecraft's default water colour.
const cauldronWater = (H) => H.tint(H.gray(H.frame(H.load('block/water_still')), 0.9), [63, 118, 228]);

// Potions: the bottle with its contents (a grey overlay) tinted the potion's colour.
const POTION_COLOURS = {
  healing: [248, 36, 35], regeneration: [205, 92, 171], swiftness: [124, 175, 198], strength: [147, 36, 35], leaping: [34, 253, 76],
  fire_resistance: [228, 154, 58], water_breathing: [46, 82, 153], night_vision: [31, 31, 161], invisibility: [127, 131, 146],
  slowness: [90, 108, 129], poison: [78, 147, 49], harming: [67, 10, 9],
};
const potion = (bottle, colour) => (H) => H.paste(H.tint(H.load('item/potion_overlay'), colour), H.load(`item/${bottle}`));

// Paintings: the game's painting slots, filled from Pixel Perfection's paintings of the same size
// (each cut into 16 x 16 tiles).
const PAINTINGS = {
  sunrise: 'aztec', moonlit: 'alban', still_life: 'plant', bouquet: 'kebab', wanderer: 'wanderer', falls: 'graham',
  fields: 'pool', sail: 'sea', village: 'match', peaks: 'bust', starry: 'stage', blocks: 'skull_and_roses', castle: 'fighters',
  islands: 'skeleton', deep: 'pointer',
};
const paintingTile = (art, x, y) => (H) => H.crop(H.load(`painting/${art}`), x * 16, y * 16, 16, 16);

// Music discs: Pixel Perfection's discs with labels of about the game's colours.
const DISCS = ['cat', 'mall', 'blocks', 'wait', '13', 'mellohi', 'ward', 'strad'];

export const SOURCES = {
  // ---------------------------------------------------------------- terrain
  grass_top: 'block/grass_block_top',
  grass_side: 'block/grass_block_side',
  grass_side_overlay: 'block/grass_block_side_overlay',
  grass_side_snowy: 'block/grass_block_snow',
  dirt_path_top: 'block/grass_path_top',
  dirt_path_side: 'block/grass_path_side',
  smooth_stone_side: 'block/smooth_stone_slab_side',
  sandstone_side: 'block/sandstone',
  red_sandstone_side: 'block/red_sandstone',
  tall_grass: 'block/grass',
  water: grayOf('block/water_still', 0.75),
  // (Pixel Perfection colours these leaves itself, from autumn orange to deep green; the game
  // tints them as Minecraft does, so they're taken as grey.)
  birch_leaves: grayOf('block/birch_leaves', 0.62),
  spruce_leaves: grayOf('block/spruce_leaves', 0.55),
  acacia_leaves: grayOf('block/acacia_leaves', 0.55),
  dark_oak_leaves: grayOf('block/dark_oak_leaves', 0.5),
  lava: 'block/lava_still',
  pumpkin_face: 'block/carved_pumpkin',
  jack_face: 'block/jack_o_lantern',
  compost: 'block/composter_compost',
  anvil_top_z: (H) => H.rot(H.load('block/anvil_top'), 1),
  // The colours are one grey texture each, tinted per dye.
  wool: grayOf('block/white_wool', 0.9),
  concrete: grayOf('block/white_concrete', 0.93),
  concrete_powder: grayOf('block/white_concrete_powder', 0.89),
  terracotta_dyed: grayOf('block/white_terracotta', 0.9),
  stained_glass: grayOf('block/white_stained_glass', 0.94),
  // Newer blocks, from Mineclonia (drawn in the same pack's style).
  calcite: 'mcl:mods/ITEMS/mcl_amethyst/textures/mcl_amethyst_calcite_block.png',
  deepslate: mcl(MCL.deepslate),
  deepslate_top: mcl(`${MCL.deepslate}_top`),
  cobbled_deepslate: mcl(`${MCL.deepslate}_cobbled`),
  deepslate_bricks: mcl(`${MCL.deepslate}_bricks`),
  ...Object.fromEntries(['coal', 'iron', 'copper', 'gold', 'redstone', 'lapis', 'emerald', 'diamond'].map((o) => [`deepslate_${o}_ore`, mcl(`${MCL.deepslate}_${o}_ore`)])),
  // (Mineclonia's copper ore is only the ore, drawn over stone in the game.)
  copper_ore: (H) => H.over(H.frame(H.load('block/stone')), H.load(mcl(`${MCL.copper}_ore`))),
  copper_block: mcl(`${MCL.copper}_block`),
  raw_iron_block: mcl(`${MCL.raw}_raw_iron_block`),
  cherry_planks: mcl(`${MCL.cherry}_planks`),
  cherry_log: mcl(`${MCL.cherry}_log`),
  cherry_log_top: mcl(`${MCL.cherry}_log_top`),
  cherry_leaves: mcl(`${MCL.cherry}_leaves`),
  cherry_sapling: mcl(`${MCL.cherry}_sapling`),
  cherry_door_top: mcl(`${MCL.cherry}_door_top`),
  cherry_door_bottom: mcl(`${MCL.cherry}_door_bottom`),
  cherry_trapdoor: mcl(`${MCL.cherry}_trapdoor`),
  // The cave update's blocks. (Mineclonia draws pointed dripstone hanging down, and amethyst
  // growing up; the other way round is the same picture turned over.)
  tuff: 'mcl:mods/ITEMS/mcl_deepslate/textures/mcl_deepslate_tuff.png',
  smooth_basalt: 'mcl:mods/ITEMS/mcl_blackstone/textures/mcl_blackstone_basalt_smooth.png',
  raw_copper_block: mcl(`${MCL.copper}_block_raw`),
  raw_gold_block: mcl(`${MCL.raw}_raw_gold_block`),
  dripstone_block: mcl(`${MCL.drip}/dripstone_block`),
  ...Object.fromEntries(['tip', 'frustum', 'middle', 'base', 'tip_merge'].flatMap((part) => [
    [`pointed_dripstone_down_${part}`, mcl(`${MCL.drip}/pointed_dripstone_${part}`)],
    [`pointed_dripstone_up_${part}`, (H) => H.flipY(H.load(mcl(`${MCL.drip}/pointed_dripstone_${part}`)))]])),
  moss_block: mcl(`${MCL.lush}_moss_block`),
  rooted_dirt: mcl(`${MCL.lush}_rooted_dirt`),
  hanging_roots: mcl(`${MCL.lush}_hanging_roots`),
  glow_lichen: 'mcl:mods/ITEMS/mcl_core/textures/mcl_core_glow_lichen.png',
  ...Object.fromEntries(['cave_vines', 'cave_vines_lit', 'cave_vines_plant', 'cave_vines_plant_lit'].map((n) => [n, mcl(`${MCL.lush}_${n}`)])),
  spore_blossom_hanging: (H) => H.flipY(H.load(mcl(`${MCL.lush}_spore_blossom`))),
  azalea_leaves: mcl(`${MCL.lush}_azalea_leaves`),
  flowering_azalea_leaves: mcl(`${MCL.lush}_azalea_leaves_flowering`),
  azalea_top: mcl(`${MCL.lush}_azalea_top`),
  azalea_side: mcl(`${MCL.lush}_azalea_side`),
  flowering_azalea_top: mcl(`${MCL.lush}_azalea_flowering_top`),
  flowering_azalea_side: mcl(`${MCL.lush}_azalea_flowering_side`),
  azalea_plant: mcl(`${MCL.lush}_azalea_plant`),
  big_dripleaf_top: mcl(`${MCL.lush}_big_dripleaf_top`),
  big_dripleaf_side: mcl(`${MCL.lush}_big_dripleaf_side`),
  big_dripleaf_stem: mcl(`${MCL.lush}_big_dripleaf_stem`),
  amethyst_block: mcl(`${MCL.amethyst}_amethyst_block`),
  budding_amethyst: mcl(`${MCL.amethyst}_budding_amethyst`),
  ...Object.fromEntries([['amethyst_cluster', 'amethyst_cluster'], ['large_amethyst_bud', 'amethyst_bud_large'],
    ['medium_amethyst_bud', 'amethyst_bud_medium'], ['small_amethyst_bud', 'amethyst_bud_small']].flatMap(([name, file]) => [
    [name, mcl(`${MCL.amethyst}_${file}`)], [`${name}_down`, (H) => H.flipY(H.load(mcl(`${MCL.amethyst}_${file}`)))]])),
  // Crops, a picture per stage.
  ...Object.fromEntries([...Array(8)].map((_, k) => [`wheat_${k}`, `block/wheat_stage${k}`])),
  ...Object.fromEntries(['carrots', 'potatoes', 'beetroots'].flatMap((c) => [0, 1, 2, 3].map((k) => [`${c}_${k}`, `block/${c}_stage${k}`]))),
  // Fire: eight frames of its animation.
  ...Object.fromEntries([...Array(8)].map((_, k) => [`fire_${k}`, (H) => H.frame(H.load('block/fire_0'), k)])),
  ...Object.fromEntries([...Array(10)].map((_, k) => [`destroy_${k}`, `block/destroy_stage_${k}`])),

  // ---------------------------------------------------------------- models
  chest_side: singleSide,
  chest_front: (H) => latch(H, chestSide(H, H.load(CHEST), [42, 14], [42, 33]), CHEST, [4, 1], 7),
  chest_top: (H) => H.paste(H.blank(), H.crop(H.load(CHEST), 28, 0, 14, 14), 1, 1),
  chest_front_l: (H) => latch(H, chestSide(H, H.load(CHEST_L), [43, 14], [43, 33], 15, 1), CHEST_L, [3, 1], 15, 1),
  chest_front_r: (H) => latch(H, chestSide(H, H.load(CHEST_R), [43, 14], [43, 33], 15, 0), CHEST_R, [3, 1], 0, 1),
  chest_back_double: (H) => widen(H, singleSide(H), 4, 11),
  chest_top_dx: doubleTop,
  chest_top_dz: (H) => H.rot(doubleTop(H), 1),
  bed_head: bedHead,
  bed_head_s: (H) => H.rot(bedHead(H), 2),
  bed_head_e: (H) => H.rot(bedHead(H), 1),
  bed_head_w: (H) => H.rot(bedHead(H), 3),
  bed_foot: (H) => H.crop(H.load(BED), 6, 28, 16, 16),
  bed_side: bedSide,
  lantern_side: lanternSide,
  lantern_top: lanternTop,
  bell_body: bellBody,
  campfire_log: campfireLog(false),
  campfire_log_lit: campfireLog(true),
  lever: leverStick,
  flower_pot_top: flowerPotTop,
  cauldron_water: cauldronWater,

  // ---------------------------------------------------------------- items
  raw_porkchop: 'item/porkchop',
  raw_beef: 'item/beef',
  raw_mutton: 'item/mutton',
  raw_chicken: 'item/chicken',
  raw_rabbit: 'item/rabbit',
  compass: 'item/compass_16',
  clock: 'item/clock_00',
  copper_ingot: mcl(`${MCL.copper}_ingot`),
  raw_copper: mcl(`${MCL.copper}_raw`),
  raw_iron: mcl(`${MCL.raw}_raw_iron`),
  raw_gold: mcl(`${MCL.raw}_raw_gold`),
  glow_berries: mcl(`${MCL.lush}_glow_berries`),
  amethyst_shard: mcl(`${MCL.amethyst}_amethyst_shard`),
  dye: grayOf('item/white_dye', 0.67),
  minecart_item: 'item/minecart',
  item_frame_item: 'item/item_frame',
  painting_item: 'item/painting',
  ...Object.fromEntries(['oak', 'spruce', 'birch', 'jungle', 'acacia', 'dark_oak', 'iron'].map((w) => [`${w}_door_item`, `item/${w}_door`])),
  cherry_door_item: mcl(`${MCL.cherry}_door_inv`),
  cherry_boat: 'mcl:mods/ENTITIES/mcl_boats/textures/mcl_boats_cherry_blossom_boat.png',
  sign_item: 'item/oak_sign',
  // (Pixel Perfection's bed is blue; the game's beds are red, like its bed model's.)
  bed_item: (H) => H.remap(H.load('item/bed'), (r, g, b) => b > r + 20, [0x561a1e, 0x7c2c34, 0x8c2a2d, 0x962a2a, 0xa32e2a, 0xb8423a]),
  // Leather armour is grey, dyed brown (Minecraft's default leather colour) under its trim.
  ...Object.fromEntries(['helmet', 'chestplate', 'leggings', 'boots'].map((p) => [`leather_${p}`,
    (H) => H.paste(H.tint(H.load(`item/leather_${p}`), [160, 101, 64]), H.load(`item/leather_${p}_overlay`))])),
  lantern_item: 'item/lantern',
  campfire_item: 'item/campfire',
  lever_item: 'block/lever',
  cake_item: 'item/cake',
  ...Object.fromEntries(Object.entries(POTION_COLOURS).flatMap(([name, c]) => [[`potion_${name}`, potion('potion', c)], [`splash_potion_${name}`, potion('splash_potion', c)]])),
  ...Object.fromEntries(DISCS.map((d, k) => [`music_disc_${k}`, `item/music_disc_${d}`])),

  // ---------------------------------------------------------------- particles and the like
  heart: particle('heart'),
  angry: particle('angry'),
  happy: particle('glint'),
  bubble: particle('bubble'),
  // (splash: drawn in code as plain water, since particles show a few pixels of it and Pixel
  // Perfection's is a single tiny drop.)
  crit: particle('critical_hit'),
  magic_crit: particle('enchanted_hit'),
  note: particle('note'),
  smoke: particle('generic_5'),
  xp_orb: (H) => H.crop(H.load('entity/experience_orb'), 16, 16, 16, 16),
  painting_back: 'painting/back',
  ...Object.fromEntries(Object.entries({ sunrise: [1, 1], moonlit: [1, 1], still_life: [1, 1], bouquet: [1, 1], wanderer: [1, 2], falls: [1, 2], fields: [2, 1], sail: [2, 1], village: [2, 2], peaks: [2, 2], starry: [2, 2], blocks: [2, 2], castle: [4, 2], islands: [4, 3], deep: [4, 4] })
    .flatMap(([name, [w, h]]) => [...Array(w * h)].map((_, i) => [`painting_${name}_${i % w}_${Math.floor(i / w)}`, paintingTile(PAINTINGS[name], i % w, Math.floor(i / w))]))),

  // Kept as drawn in code: the game's own layouts or things the packs don't have.
  arrow_entity: null,
  fishing_bobber: null,
  lead_rope: null,
  ench_book_cover: null,
  ench_book_pages: null,
  glyph: null,
  spark: null,
  blood: null,
  gold_coin: null,
  shield: null,
};
