// One Piece's towns and landmarks (the One Piece mod: see opgen.js for its planet). Each island has
// the town of its kind, as the islands of the story have (see docs/onepiece/world.md): a windmill
// village with a pier and a bar on the village islands (Foosha on Dawn Island), a walled Marine base
// with cannon towers and MARINE across its headquarters on the Marine islands (Shells Town), a desert
// city of flat-roofed sandstone houses round a domed palace (Arabasta), a castle on the tallest of a
// winter island's drum-shaped peaks (Drum Castle), a Japanese town round a tiered castle (Wano), a
// haunted mansion among gravestones (Thriller Bark), a laboratory on a fire-and-ice island (Punk
// Hazard), houses on stilts joined by bridges (Sabaody), the bones of something enormous on the
// prehistoric islands (Little Garden), a mansion on a cliff island's top (Syrup Village), a port of
// taverns on the summer islands (Mock Town). Out at sea: the Baratie, a restaurant ship by the first
// island; the lighthouse of Twin Cape at Reverse Mountain; and wrecks on the sea floor.
//
// Built as the other structures are (structures.js): planned from the seed and the lie of the land
// alone, so every chunk agrees, and copied into each chunk as it's made.
import { SEA_LEVEL, chunkKey } from './config.js';
import { WATERLIKE, WOOD, doorId } from './blocks.js';
import { hash2, mulberry32 } from './math.js';
import { Plot, Frame, FILL, SOFT, SOFT_IDS, hangs, planShipwreck, buildShipwreck } from './structures.js';
import { RED_LINE, GRAND_LINE, START_CELL, KINDS } from './opgen.js';

const CELL = 512;
const pick = (rnd, list) => list[Math.floor(rnd() * list.length)];
// The world face (0 east, 1 west, 4 south, 5 north) looking from (x, z) towards (tx, tz).
const faceTo = (x, z, tx, tz) => (Math.abs(tx - x) > Math.abs(tz - z) ? (tx > x ? 0 : 1) : tz > z ? 4 : 5);

// ---------------------------------------------------------------- a builder over a frame
// Local coordinates as the other structures have them: x across the front from the left, z back
// from the front, y up; the front faces the frame's `face`.
class Build {
  constructor(plot, x, y, z, face, w, d) {
    this.f = new Frame(plot, x, y, z, face, -(w >> 1), -(d >> 1));
    this.w = w; this.d = d;
  }
  set(x, y, z, id, how = 0) { this.f.put(x, y, z, id, how); }
  fill(x0, y0, z0, x1, y1, z1, id, how = 0) { this.f.fill(x0, y0, z0, x1, y1, z1, id, how); }
  stairs(x, y, z, kind, face, upside = false) { this.f.stairs(x, y, z, kind, face, upside); }
  // The ground under the building made good (down to where the land is), the space it stands in
  // cleared, and a path out of its door.
  site(h, foundation = 'cobblestone', margin = 1) {
    const { w, d } = this;
    for (let z = -margin; z < d + margin; z++) for (let x = -margin; x < w + margin; x++) {
      const inside = x >= 0 && x < w && z >= 0 && z < d;
      for (let y = 1; y <= h; y++) this.set(x, y, z, 0, inside ? 0 : SOFT);
      if (inside) for (let y = -1; y >= -8; y--) this.set(x, y, z, foundation, FILL);
    }
  }
  walls(x0, z0, x1, z1, y0, y1, id) {
    for (let y = y0; y <= y1; y++) for (let z = z0; z <= z1; z++) for (let x = x0; x <= x1; x++) {
      if (x === x0 || x === x1 || z === z0 || z === z1) this.set(x, y, z, id);
    }
  }
  // A pitched roof over [0..w-1] x [0..d-1], eaves at y, ridge front to back, gables of `gable`.
  roof(y, kind, gable) {
    const { w, d } = this, half = w >> 1;
    for (let i = 0; i <= half; i++) {
      for (let z = -1; z <= d; z++) {
        if (i < half || w % 2 === 0) { this.stairs(i - 1, y + i, z, kind, 0); this.stairs(w - i, y + i, z, kind, 1); }
        else this.set(i, y + i, z, `${kind}_slab`);
      }
      if (i > 0) for (let x = i; x <= w - 1 - i; x++) { this.set(x, y + i - 1, 0, gable); this.set(x, y + i - 1, d - 1, gable); }
    }
    if (w % 2 === 0) for (let z = -1; z <= d; z++) { this.set(half - 1, y + half, z, `${kind}_slab`); this.set(half, y + half, z, `${kind}_slab`); }
  }
  // A roof rising in steps to a point over [x0..x1] x [z0..z1] from y.
  spire(x0, z0, x1, z1, y, kind) {
    for (let i = 0; ; i++) {
      const a0 = x0 + i, a1 = x1 - i, b0 = z0 + i, b1 = z1 - i, yy = y + i;
      if (a0 > a1 || b0 > b1) break;
      if (a1 - a0 <= 1 || b1 - b0 <= 1) { for (let x = a0; x <= a1; x++) for (let z = b0; z <= b1; z++) this.set(x, yy, z, `${kind}_slab`); break; }
      for (let x = a0; x <= a1; x++) { this.stairs(x, yy, b0, kind, 4); this.stairs(x, yy, b1, kind, 5); }
      for (let z = b0 + 1; z < b1; z++) { this.stairs(a0, yy, z, kind, 0); this.stairs(a1, yy, z, kind, 1); }
    }
  }
  // A door in the front (of `wood`, or iron), and the way to it cleared, a path before it.
  door(x, y, z, wood = 'oak') {
    const base = wood === 'iron' ? 2228 : WOOD[wood].door, f = this.f.f(5);
    this.f.put(x, y, z, doorId(f, false, false, base)); this.f.put(x, y + 1, z, doorId(f, false, true, base));
    this.set(x, y - 1, z - 1, 'dirt_path');
    this.set(x, y, z - 1, 0); this.set(x, y + 1, z - 1, 0);
  }
  window(x, y, z) { this.set(x, y, z, 'glass_pane'); }
  chest(x, y, z, kind = 'house', front = 5) { this.f.chest(x, y, z, kind, front); }
  bed(x, y, z, head = 4) { this.f.bed(x, y, z, head); }
  torch(x, y, z, lean) { this.f.torch(x, y, z, lean); }
}

// ---------------------------------------------------------------- buildings
// A cottage of the East Blue: timber corners, white plaster walls, a pitched roof (Foosha, Syrup).
function cottage(b, rnd, st = {}) {
  const { w, d } = b, wood = st.wood ?? 'oak', plaster = st.wall ?? 'white_terracotta', roof = st.roof ?? 'spruce';
  b.site(9, st.foundation ?? 'cobblestone');
  b.fill(0, 0, 0, w - 1, 0, d - 1, `${wood}_planks`);
  b.walls(0, 0, w - 1, d - 1, 1, 3, plaster);
  for (const [x, z] of [[0, 0], [w - 1, 0], [0, d - 1], [w - 1, d - 1]]) b.fill(x, 1, z, x, 3, z, `${wood}_log`);
  b.fill(0, 4, 0, w - 1, 4, d - 1, `${wood}_planks`);
  b.roof(4, roof, `${wood}_planks`);
  b.door(w >> 1, 1, 0, wood);
  for (const x of [1, w - 2]) if (x !== w >> 1) b.window(x, 2, 0);
  for (const z of [2, d - 3]) { b.window(0, 2, z); b.window(w - 1, 2, z); }
  b.bed(1, 1, d - 3, 4);
  b.chest(w - 2, 1, d - 2, st.loot ?? 'house', 5);
  b.set(w - 2, 1, 1, 'crafting_table');
  b.set(w >> 1, 4, d >> 1, 'lantern_hanging');
  if (rnd() < 0.5) b.set(1, 1, 1, 'barrel');
}
// A bar, a long low hall with a counter and barrels (Partys Bar in Foosha; the taverns of Mock Town).
function bar(b, rnd, st = {}) {
  const { w, d } = b, wood = st.wood ?? 'oak';
  b.site(10, 'cobblestone');
  b.fill(0, 0, 0, w - 1, 0, d - 1, `${wood}_planks`);
  b.walls(0, 0, w - 1, d - 1, 1, 4, st.wall ?? `${wood}_planks`);
  for (const [x, z] of [[0, 0], [w - 1, 0], [0, d - 1], [w - 1, d - 1]]) b.fill(x, 1, z, x, 4, z, `${wood}_log`);
  b.fill(0, 5, 0, w - 1, 5, d - 1, `${wood}_planks`);
  b.roof(5, st.roof ?? 'brick', `${wood}_planks`);
  b.door(w >> 1, 1, 0, wood);
  for (let x = 1; x < w - 1; x += 2) if (Math.abs(x - (w >> 1)) > 1) { b.window(x, 2, 0); b.window(x, 3, 0); }
  // The counter along the back, barrels behind it, tables in the room.
  for (let x = 2; x < w - 2; x++) b.set(x, 1, d - 3, `${wood}_slab_top`);
  for (let x = 1; x < w - 1; x += 2) { b.set(x, 1, d - 2, 'barrel'); b.set(x, 2, d - 2, 'barrel'); }
  for (const x of [2, w - 3]) { b.set(x, 1, 3, `${wood}_fence`); b.set(x, 2, 3, `${wood}_slab`); }
  for (const x of [3, w >> 1, w - 4]) b.set(x, 4, d >> 1, 'lantern_hanging');
  b.chest(w - 2, 1, 1, 'village', 5);
}
// A windmill: a stone tower with four white sails turning to the front (Foosha's windmills).
function windmill(b) {
  const { w, d } = b;
  b.site(16, 'cobblestone', 2);
  b.fill(0, 0, 0, w - 1, 0, d - 1, 'cobblestone');
  b.walls(0, 0, w - 1, d - 1, 1, 6, 'cobblestone');
  b.walls(0, 0, w - 1, d - 1, 7, 11, 'white_terracotta');
  for (const [x, z] of [[0, 0], [w - 1, 0], [0, d - 1], [w - 1, d - 1]]) b.fill(x, 7, z, x, 11, z, 'oak_log');
  b.spire(-1, -1, w, d, 12, 'spruce');
  b.door(w >> 1, 1, 0);
  b.window(w >> 1, 4, 0); b.window(w >> 1, 9, 0);
  b.set(w >> 1, 1, d - 2, 'hay_block'); b.set(1, 1, d - 2, 'hay_block'); b.chest(w - 2, 1, d - 2, 'farm', 5);
  // The sails: a hub out from the front, four arms of white cloth on spars.
  const cx = w >> 1, cy = 10, z = -1;
  b.set(cx, cy, z, 'oak_log'); b.set(cx, cy, 0, 'oak_log');
  for (let k = 1; k <= 6; k++) {
    b.set(cx + k, cy, z, 'spruce_fence'); b.set(cx - k, cy, z, 'spruce_fence'); b.set(cx, cy + k, z, 'spruce_fence'); b.set(cx, cy - k, z, 'spruce_fence');
    if (k >= 2) {
      b.set(cx + k, cy + 1, z, 'white_wool'); b.set(cx - k, cy - 1, z, 'white_wool');
      b.set(cx - 1, cy + k, z, 'white_wool'); b.set(cx + 1, cy - k, z, 'white_wool');
    }
  }
}
// A pier out over the water from the shore, on posts down to the sea floor.
function pier(b, len) {
  for (let z = 0; z < len; z++) {
    for (let x = 0; x < 3; x++) { b.set(x, 0, z, 'oak_planks'); b.set(x, 1, z, 0); b.set(x, 2, z, 0); }
    if (z % 4 === 0) for (const x of [0, 2]) { for (let y = -1; y >= -12; y--) b.set(x, y, z, 'oak_log', FILL); b.set(x, 1, z, 'oak_fence'); }
  }
  b.set(0, 2, len - 1, 'lantern'); b.set(2, 2, len - 1, 'lantern');
}
// A Marine base: a white-walled compound with a blue band, cannon towers at its corners, a gate in
// front, a flag, and the headquarters across the back with MARINE on it in blue (Shells Town's
// 153rd Branch).
const GLYPHS = { M: ['101', '111', '101', '101', '101'], A: ['010', '101', '111', '101', '101'], R: ['110', '101', '110', '101', '101'],
  I: ['111', '010', '010', '010', '111'], N: ['101', '111', '111', '111', '101'], E: ['111', '100', '110', '100', '111'] };
function marineBase(b, rnd) {
  const { w, d } = b;
  b.site(22, 'stone_bricks', 1);
  b.fill(0, 0, 0, w - 1, 0, d - 1, 'smooth_stone');
  // The wall round it, with a gate in the front.
  b.walls(0, 0, w - 1, d - 1, 1, 4, 'white_concrete');
  b.walls(0, 0, w - 1, d - 1, 5, 5, 'blue_concrete');
  const gx = w >> 1;
  for (let x = gx - 2; x <= gx + 2; x++) for (let y = 1; y <= 4; y++) b.set(x, y, 0, 0);
  // Cannon towers at the corners: guns pointing out over the walls.
  for (const [x, z] of [[0, 0], [w - 3, 0], [0, d - 3], [w - 3, d - 3]]) {
    b.fill(x, 1, z, x + 2, 9, z + 2, 'white_concrete');
    b.fill(x, 9, z, x + 2, 9, z + 2, 'blue_concrete');
    b.set(x + 1, 10, z + 1, 'dispenser'); b.set(x + 1, 11, z + 1, 'iron_bars');
    for (const [dx, dz] of [[0, 0], [2, 0], [0, 2], [2, 2]]) b.set(x + dx, 10, z + dz, 'stone_brick_wall');
  }
  // The headquarters across the back: three floors, windows in rows, MARINE across its front (read from
  // outside, where local x runs right to left).
  const hw = w - 6, hd = 9, hx = 3, hz = d - hd - 3;
  for (let y = 1; y <= 13; y++) for (let z = hz; z < hz + hd; z++) for (let x = hx; x < hx + hw; x++) {
    const edge = x === hx || x === hx + hw - 1 || z === hz || z === hz + hd - 1;
    if (edge) b.set(x, y, z, y === 13 ? 'blue_concrete' : 'white_concrete');
    else b.set(x, y, z, y % 4 === 0 ? 'smooth_stone' : 0);
  }
  for (let y = 2; y <= 10; y += 4) for (let x = hx + 2; x < hx + hw - 2; x += 3) { b.set(x, y + 1, hz, 'glass_pane'); b.set(x, y + 1, hz + hd - 1, 'glass_pane'); }
  const word = 'MARINE', lw = word.length * 4 - 1, lx = hx + ((hw - lw) >> 1);
  [...word].forEach((ch, i) => GLYPHS[ch].forEach((row, r) => [...row].forEach((c, k) => { if (c === '1') b.set(lx + lw - 1 - (i * 4 + k), 12 - r, hz - 1, 'blue_concrete'); })));
  b.door(hx + (hw >> 1), 1, hz, 'iron');
  // Inside: bunks and the armoury's chests.
  for (let x = hx + 2; x < hx + hw - 2; x += 3) b.bed(x, 5, hz + 2, 4);
  b.chest(hx + 1, 1, hz + hd - 2, 'smith', 5); b.chest(hx + hw - 2, 1, hz + hd - 2, 'smith', 5);
  b.set(hx + 2, 1, hz + hd - 2, 'anvil');
  // A stair up through the floors, and the flag on the roof.
  // (A ladder up through the floors, on the side wall.)
  for (const y of [4, 8, 12]) b.set(hx + 1, y, hz + 1, 0);
  b.f.ladder(hx + 1, 1, 12, hz + 1, 1);
  for (let y = 14; y <= 22; y++) b.set(hx + (hw >> 1), y, hz + (hd >> 1), 'oak_fence');
  for (let y = 19; y <= 22; y++) for (let x = 1; x <= 5; x++) b.set(hx + (hw >> 1) + x, y, hz + (hd >> 1), (x + y) % 2 ? 'blue_wool' : 'white_wool');
  // The yard: a lantern post or two.
  for (const x of [gx - 4, gx + 4]) { b.set(x, 1, 4, 'stone_brick_wall'); b.set(x, 2, 4, 'lantern'); }
  if (rnd() < 0.5) b.set(gx, 1, 6, 'anvil');
}
// A flat-roofed desert house of sandstone (Arabasta's cities).
function desertHouse(b, rnd) {
  const { w, d } = b, h = 3 + Math.floor(rnd() * 3);
  b.site(h + 4, 'sandstone');
  b.fill(0, 0, 0, w - 1, 0, d - 1, 'sandstone');
  b.walls(0, 0, w - 1, d - 1, 1, h, 'sandstone');
  b.fill(0, h + 1, 0, w - 1, h + 1, d - 1, 'cut_sandstone');
  for (let x = 0; x < w; x++) { b.set(x, h + 2, 0, 'sandstone_slab'); b.set(x, h + 2, d - 1, 'sandstone_slab'); }
  for (let z = 0; z < d; z++) { b.set(0, h + 2, z, 'sandstone_slab'); b.set(w - 1, h + 2, z, 'sandstone_slab'); }
  b.door(w >> 1, 1, 0);
  b.set(1, 2, 0, 'glass_pane'); b.set(w - 2, 2, 0, 'glass_pane');
  b.chest(w - 2, 1, d - 2, 'desert', 5);
  b.bed(1, 1, d - 3, 4);
}
// The palace: a great sandstone hall under a dome, gold at its top (Alubarna).
function palace(b) {
  const { w, d } = b;
  b.site(24, 'sandstone', 2);
  b.fill(0, 0, 0, w - 1, 0, d - 1, 'cut_sandstone');
  b.walls(0, 0, w - 1, d - 1, 1, 8, 'sandstone');
  b.walls(0, 0, w - 1, d - 1, 9, 9, 'chiseled_sandstone');
  b.fill(1, 9, 1, w - 2, 9, d - 2, 'sandstone');
  for (let x = 2; x < w - 2; x += 3) { b.set(x, 3, 0, 'glass_pane'); b.set(x, 4, 0, 'glass_pane'); b.set(x, 6, 0, 'glass_pane'); }
  b.door(w >> 1, 1, 0);
  // The dome.
  const cx = (w - 1) / 2, cz = (d - 1) / 2, r = Math.min(w, d) / 2 - 2;
  for (let y = 0; y <= r; y++) {
    const rr = Math.sqrt(Math.max(0, r * r - y * y));
    for (let z = 0; z < d; z++) for (let x = 0; x < w; x++) {
      const dist = Math.hypot(x - cx, z - cz);
      if (dist <= rr && dist > rr - 1.5) b.set(x, 10 + y, z, y > r - 2 ? 'gold_block' : 'cut_sandstone');
    }
  }
  b.set(Math.floor(cx), 11 + Math.ceil(r), Math.floor(cz), 'gold_block');
  // Four corner towers.
  for (const [x, z] of [[0, 0], [w - 2, 0], [0, d - 2], [w - 2, d - 2]]) { b.fill(x, 1, z, x + 1, 14, z + 1, 'sandstone'); b.fill(x, 15, z, x + 1, 15, z + 1, 'chiseled_sandstone'); }
  b.chest(2, 1, d - 2, 'pyramid', 5); b.chest(w - 3, 1, d - 2, 'desert', 5);
  b.set(w >> 1, 8, d >> 1, 'lantern_hanging');
}
// A castle of stone bricks: a keep with a tower at each corner, spires on them (Drum Castle).
function castle(b, rnd, st = {}) {
  const { w, d } = b, stone = st.stone ?? 'stone_bricks', roof = st.roof ?? 'stone_brick';
  b.site(26, stone, 1);
  b.fill(0, 0, 0, w - 1, 0, d - 1, stone);
  b.walls(0, 0, w - 1, d - 1, 1, 10, stone);
  b.fill(1, 5, 1, w - 2, 5, d - 2, 'spruce_planks');
  for (let x = 0; x < w; x += 2) b.set(x, 11, 0, stone), b.set(x, 11, d - 1, stone);
  for (let z = 0; z < d; z += 2) b.set(0, 11, z, stone), b.set(w - 1, 11, z, stone);
  b.fill(1, 10, 1, w - 2, 10, d - 2, 'spruce_planks');
  for (const [x, z] of [[-1, -1], [w - 2, -1], [-1, d - 2], [w - 2, d - 2]]) {
    b.walls(x, z, x + 2, z + 2, 1, 15, stone);
    b.spire(x - 1, z - 1, x + 3, z + 3, 16, roof);
  }
  b.door(w >> 1, 1, 0, 'spruce');
  for (let y = 2; y <= 8; y += 4) for (let x = 2; x < w - 2; x += 3) b.window(x, y + 1, 0);
  b.chest(2, 1, d - 2, 'stronghold', 5); b.chest(w - 3, 6, d - 2, 'village', 5);
  b.bed(w - 3, 6, 2, 4);
  b.set(w >> 1, 4, d >> 1, 'lantern_hanging'); b.set(w >> 1, 9, d >> 1, 'lantern_hanging');
  if (st.banner !== false) for (let y = 12; y <= 18; y++) b.set(w >> 1, y, d >> 1, 'oak_fence');
}
// A house of Wano: dark timber, white walls, and a dark tiled roof whose eaves reach out.
function wanoHouse(b, rnd) {
  const { w, d } = b;
  b.site(9, 'stone_bricks');
  b.fill(0, 0, 0, w - 1, 0, d - 1, 'dark_oak_planks');
  b.walls(0, 0, w - 1, d - 1, 1, 3, 'calcite');
  for (let x = 0; x < w; x += 2) { b.fill(x, 1, 0, x, 3, 0, 'dark_oak_log'); b.fill(x, 1, d - 1, x, 3, d - 1, 'dark_oak_log'); }
  for (let z = 0; z < d; z += 2) { b.fill(0, 1, z, 0, 3, z, 'dark_oak_log'); b.fill(w - 1, 1, z, w - 1, 3, z, 'dark_oak_log'); }
  b.fill(0, 4, 0, w - 1, 4, d - 1, 'dark_oak_planks');
  b.roof(4, 'deepslate_brick', 'dark_oak_planks');
  b.door(w >> 1, 1, 0, 'dark_oak');
  b.window(1, 2, 0); b.window(w - 2, 2, 0);
  b.bed(1, 1, d - 3, 4); b.chest(w - 2, 1, d - 2, 'house', 5);
  b.set(w >> 1, 4, d >> 1, 'lantern_hanging');
  if (rnd() < 0.5) b.set(w - 2, 1, 1, 'barrel');
}
// Wano's castle: three tiers, each smaller, under dark tiled roofs.
function wanoCastle(b) {
  const { w, d } = b;
  b.site(30, 'stone_bricks', 2);
  b.fill(0, 0, 0, w - 1, 0, d - 1, 'stone_bricks');
  b.walls(0, 0, w - 1, d - 1, 1, 2, 'stone_bricks');
  let y = 3;
  for (let tier = 0; tier < 3; tier++) {
    const i = tier * 2 + 1, x0 = i, z0 = i, x1 = w - 1 - i, z1 = d - 1 - i;
    b.walls(x0, z0, x1, z1, y, y + 4, 'calcite');
    for (let x = x0; x <= x1; x += 2) { b.fill(x, y, z0, x, y + 4, z0, 'dark_oak_log'); b.fill(x, y, z1, x, y + 4, z1, 'dark_oak_log'); }
    b.fill(x0, y + 5, z0, x1, y + 5, z1, 'dark_oak_planks');
    for (let x = x0 - 1; x <= x1 + 1; x++) { b.stairs(x, y + 5, z0 - 1, 'deepslate_brick', 4); b.stairs(x, y + 5, z1 + 1, 'deepslate_brick', 5); }
    for (let z = z0; z <= z1; z++) { b.stairs(x0 - 1, y + 5, z, 'deepslate_brick', 0); b.stairs(x1 + 1, y + 5, z, 'deepslate_brick', 1); }
    for (let x = x0 + 2; x <= x1 - 2; x += 3) b.window(x, y + 2, z0);
    y += 6;
  }
  b.spire(5, 5, w - 6, d - 6, y, 'deepslate_brick');
  b.door(w >> 1, 3, 1, 'dark_oak');
  b.chest(2, 1, d - 2, 'stronghold', 5);
  b.set(w >> 1, 7, d >> 1, 'lantern_hanging');
}
// A haunted mansion: dark wood and grey stone, three floors and spires (Thriller Bark).
function mansion(b, rnd, st = {}) {
  const { w, d } = b, wall = st.wall ?? 'dark_oak_planks', trim = st.trim ?? 'stone_bricks', roof = st.roof ?? 'deepslate_brick';
  b.site(22, trim, 1);
  b.fill(0, 0, 0, w - 1, 0, d - 1, trim);
  b.walls(0, 0, w - 1, d - 1, 1, 12, wall);
  for (const y of [4, 8, 12]) b.walls(0, 0, w - 1, d - 1, y, y, trim);
  b.fill(1, 4, 1, w - 2, 4, d - 2, `${st.floor ?? 'dark_oak'}_planks`); b.fill(1, 8, 1, w - 2, 8, d - 2, `${st.floor ?? 'dark_oak'}_planks`);
  b.fill(0, 12, 0, w - 1, 12, d - 1, trim);
  b.spire(-1, -1, w, d, 13, roof);
  for (const [x, z] of [[0, 0], [w - 3, 0]]) { b.walls(x, z - 1, x + 2, z + 1, 12, 17, trim); b.spire(x - 1, z - 2, x + 3, z + 2, 18, roof); }
  b.door(w >> 1, 1, 0, st.door ?? 'dark_oak');
  for (const y of [2, 6, 10]) for (let x = 2; x < w - 2; x += 3) b.window(x, y, 0);
  b.chest(1, 1, d - 2, st.loot ?? 'stronghold_library', 5); b.chest(w - 2, 5, d - 2, 'house', 5);
  b.bed(w - 3, 9, 2, 4);
  for (const y of [3, 7, 11]) b.set(w >> 1, y, d >> 1, 'lantern_hanging');
  if (st.cobwebs !== false) for (let k = 0; k < 6; k++) b.set(1 + Math.floor(rnd() * (w - 2)), 3 + Math.floor(rnd() * 8), 1 + Math.floor(rnd() * (d - 2)), 'cobweb');
}
// A gravestone.
function grave(b, rnd) {
  b.set(0, 1, 0, rnd() < 0.5 ? 'stone_brick_wall' : 'cobblestone_wall');
  b.set(0, 0, 1, 'coarse_dirt'); b.set(0, 0, 2, 'coarse_dirt');
}
// A laboratory: iron and grey concrete, glass, a tank of water (Punk Hazard's).
function lab(b) {
  const { w, d } = b;
  b.site(12, 'smooth_stone', 1);
  b.fill(0, 0, 0, w - 1, 0, d - 1, 'smooth_stone');
  b.walls(0, 0, w - 1, d - 1, 1, 6, 'light_gray_concrete');
  for (const [x, z] of [[0, 0], [w - 1, 0], [0, d - 1], [w - 1, d - 1]]) b.fill(x, 1, z, x, 7, z, 'iron_block');
  b.fill(0, 7, 0, w - 1, 7, d - 1, 'light_gray_concrete');
  for (let x = 2; x < w - 2; x += 2) { b.set(x, 3, 0, 'glass'); b.set(x, 4, 0, 'glass'); }
  b.door(w >> 1, 1, 0, 'iron');
  b.walls(2, d - 5, 4, d - 2, 1, 3, 'glass'); b.set(3, 1, d - 3, 'water'); b.set(3, 2, d - 3, 'water');
  b.chest(w - 2, 1, d - 2, 'stronghold', 5); b.set(w - 3, 1, d - 2, 'cauldron');
  b.set(w >> 1, 6, d >> 1, 'sea_lantern');
}
// A hut on stilts over the water and roots (Sabaody's groves).
function stiltHut(b, rnd) {
  const { w, d } = b, top = 5;
  for (const [x, z] of [[0, 0], [w - 1, 0], [0, d - 1], [w - 1, d - 1]]) for (let y = top - 1; y >= -10; y--) b.set(x, y, z, 'spruce_log', y < 0 ? FILL : 0);
  for (let y = 0; y < top; y++) for (let z = 0; z < d; z++) for (let x = 0; x < w; x++) if (!((x === 0 || x === w - 1) && (z === 0 || z === d - 1))) b.set(x, y, z, 0, SOFT);
  b.fill(0, top, 0, w - 1, top, d - 1, 'spruce_planks');
  b.walls(0, 0, w - 1, d - 1, top + 1, top + 3, 'spruce_planks');
  b.fill(1, top + 1, 1, w - 2, top + 3, d - 2, 0);
  b.roof(top + 4, 'oak', 'spruce_planks');
  b.door(w >> 1, top + 1, 0, 'spruce');
  b.set(w >> 1, top, -1, 'spruce_planks'); b.set(w >> 1, top, -2, 'spruce_planks');
  for (let y = top - 1, z = -3; y >= 0; y--, z--) { b.stairs(w >> 1, y, z, 'spruce', 4); b.set(w >> 1, y + 1, z, 0); b.set(w >> 1, y + 2, z, 0); }
  b.bed(1, top + 1, d - 3, 4); b.chest(w - 2, top + 1, d - 2, 'house', 5);
  if (rnd() < 0.6) b.set(1, top + 1, 1, 'barrel');
}
// The bones of a giant thing, half sunk in the ground: a spine and great curving ribs (Little Garden).
function bones(b, rnd) {
  const { d } = b, len = d;
  for (let z = 0; z < len; z++) {
    b.set(0, 1 + Math.round(Math.sin((z / len) * Math.PI) * 3), z, 'calcite');
    if (z % 3 === 1 && z > 1 && z < len - 2) {
      for (let a = 0; a <= 12; a++) {
        const t = (a / 12) * Math.PI, rx = Math.round(Math.cos(t) * 7), ry = Math.round(Math.sin(t) * 9);
        b.set(rx, ry + 1, z, 'calcite');
      }
    }
  }
  // The skull at one end.
  b.fill(-3, 1, -5, 3, 5, -1, 'calcite');
  b.fill(-2, 2, -5, -1, 3, -5, 0); b.fill(1, 2, -5, 2, 3, -5, 0);
  b.fill(-2, 2, -4, 2, 4, -2, 0);
  b.chest(0, 1, -3, 'jungle_temple', 5);
  if (rnd() < 0.5) b.set(0, 2, -3, 'lantern');
}
// A lighthouse: a tall white tower banded red, a light at its top (Twin Cape's, by Reverse Mountain).
function lighthouse(b) {
  for (let y = -14; y <= 26; y++) {
    for (let z = 0; z < 5; z++) for (let x = 0; x < 5; x++) {
      const corner = (x === 0 || x === 4) && (z === 0 || z === 4);
      if (corner) continue;
      const edge = x === 0 || x === 4 || z === 0 || z === 4;
      if (y < 0) b.set(x, y, z, 'stone_bricks', FILL);
      else if (edge) b.set(x, y, z, Math.floor(y / 4) % 2 ? 'red_concrete' : 'white_concrete');
      else b.set(x, y, z, y === 0 ? 'stone_bricks' : 0);
    }
  }
  b.fill(0, 27, 0, 4, 27, 4, 'white_concrete');
  b.fill(1, 28, 1, 3, 30, 3, 'glass'); b.set(2, 29, 2, 'sea_lantern'); b.set(2, 28, 2, 'sea_lantern');
  b.fill(1, 31, 1, 3, 31, 3, 'red_concrete');
  b.door(2, 1, 0);
  for (let y = 1; y <= 26; y++) b.set(1 + (y % 3), y, 3, 'oak_slab');
  b.chest(3, 1, 3, 'shipwreck_map', 5);
}
// The Baratie: a floating restaurant, a broad ship with a fish's head for a bow, two decks of dining
// room, and fins out at its sides (the sea restaurant of East Blue).
function baratie(b) {
  const L = 31, Wd = 13, cx = 6;
  for (let z = 0; z < L; z++) {
    const t = z / (L - 1), half = Math.round(6 * Math.sin(Math.min(1, t * 1.25 + 0.12) * Math.PI) + 0.4);
    for (let x = cx - half; x <= cx + half; x++) {
      for (let y = -3; y <= 1; y++) {
        const edge = x === cx - half || x === cx + half || y === -3;
        b.set(x, y, z, edge ? 'dark_oak_planks' : y === 1 ? 'oak_planks' : 0);
      }
      b.set(x, 2, z, x === cx - half || x === cx + half ? 'oak_fence' : 0);
    }
  }
  // The fins.
  for (let z = 9; z < 21; z++) for (let k = 1; k <= 4; k++) { b.set(cx - 6 - k, 0, z, 'spruce_slab_top'); b.set(cx + 6 + k, 0, z, 'spruce_slab_top'); }
  // The fish's head at the bow, eyes on its sides.
  for (let z = -6; z < 0; z++) {
    const half = Math.max(1, Math.round(5 * (1 + z / 7)));
    for (let x = cx - half; x <= cx + half; x++) for (let y = -2; y <= 4 + Math.floor(half / 2); y++) b.set(x, y, z, 'orange_terracotta');
  }
  b.set(cx - 4, 3, -3, 'black_concrete'); b.set(cx + 4, 3, -3, 'black_concrete');
  b.set(cx - 4, 4, -3, 'white_concrete'); b.set(cx + 4, 4, -3, 'white_concrete');
  // The restaurant: two floors.
  for (let y = 2; y <= 9; y++) for (let z = 7; z <= 23; z++) for (let x = 2; x <= Wd - 3; x++) {
    const edge = x === 2 || x === Wd - 3 || z === 7 || z === 23;
    b.set(x, y, z, edge ? (y === 5 || y === 9 ? 'oak_planks' : 'white_terracotta') : y === 5 ? 'oak_planks' : 0);
  }
  for (let z = 9; z <= 21; z += 3) { b.set(2, 3, z, 'glass_pane'); b.set(Wd - 3, 3, z, 'glass_pane'); b.set(2, 7, z, 'glass_pane'); b.set(Wd - 3, 7, z, 'glass_pane'); }
  for (let z = 6; z <= 24; z++) for (let x = 1; x <= Wd - 2; x++) b.set(x, 10, z, 'red_terracotta');
  b.door(cx, 2, 7);
  for (const z of [11, 15, 19]) { b.set(4, 2, z, 'oak_fence'); b.set(4, 3, z, 'oak_slab'); b.set(Wd - 5, 2, z, 'oak_fence'); b.set(Wd - 5, 3, z, 'oak_slab'); }
  b.set(cx, 2, 22, 'smoker'); b.set(cx + 1, 2, 22, 'furnace'); b.set(cx - 1, 2, 22, 'barrel');
  b.chest(cx + 2, 2, 22, 'village', 5); b.chest(cx - 2, 6, 22, 'shipwreck_supply', 5);
  for (const z of [11, 19]) b.set(cx, 8, z, 'lantern_hanging');
  // The masts.
  for (const z of [3, 27]) { for (let y = 2; y <= 14; y++) b.set(cx, y, z, 'spruce_log'); for (let x = cx - 3; x <= cx + 3; x++) b.set(x, 12, z, 'spruce_fence'); }
}

// ---------------------------------------------------------------- where the buildings go
// The kinds of building each kind of island has: [builder, width, depth, how many (of the town's
// share)], the first the town's landmark, placed nearest the middle.
const TOWNS = {
  village: { landmark: ['windmill', 7, 7], houses: [['cottage', 7, 8], ['cottage', 9, 7], ['bar', 13, 9]], n: 7, pier: true },
  spring: { houses: [['cottage', 7, 8], ['cottage', 9, 7]], n: 4, pier: true },
  autumn: { houses: [['cottage', 7, 8], ['cottage', 9, 7]], n: 4, pier: true },
  summer: { landmark: ['bar', 15, 11], houses: [['cottage', 9, 7], ['bar', 11, 9]], n: 6, style: { wood: 'acacia', wall: 'orange_terracotta', roof: 'acacia' }, pier: true },
  plateau: { landmark: ['mansion', 15, 11], houses: [['cottage', 7, 8]], n: 4, style: { wall: 'bricks', trim: 'white_concrete', roof: 'brick', floor: 'oak', door: 'oak', loot: 'house', cobwebs: false } },
  marine: { landmark: ['marineBase', 33, 29], houses: [['cottage', 7, 8]], n: 3, pier: true },
  desert: { landmark: ['palace', 21, 21], houses: [['desertHouse', 7, 7], ['desertHouse', 9, 7], ['desertHouse', 7, 9]], n: 10 },
  winter: { landmark: ['castle', 15, 13], houses: [['cottage', 7, 8]], n: 4, style: { wood: 'spruce', wall: 'spruce_planks', roof: 'spruce' } },
  wano: { landmark: ['wanoCastle', 21, 21], houses: [['wanoHouse', 7, 8], ['wanoHouse', 9, 7]], n: 9 },
  thriller: { landmark: ['mansion', 17, 13], houses: [['grave', 1, 3]], n: 14 },
  hazard: { landmark: ['lab', 15, 11], houses: [], n: 0 },
  mangrove: { houses: [['stiltHut', 7, 7]], n: 7 },
  volcano: { landmark: ['bones', 1, 26], houses: [], n: 0 },
};
const BUILDERS = { cottage, bar, windmill, marineBase, desertHouse, palace, castle, wanoHouse, wanoCastle, mansion, grave, lab, stiltHut, bones };

// The plan of an island's town: the buildings, each { type, x, z (middle), y, face, w, d, box }.
function townPlan(gen, isle) {
  const T = TOWNS[isle.kind];
  if (!T) return null;
  const rnd = mulberry32(isle.seed ^ 0x70e7), pieces = [], boxes = [];
  const fits = (x0, z0, x1, z1) => boxes.every((b) => x1 + 3 < b[0] || x0 - 3 > b[2] || z1 + 3 < b[1] || z0 - 3 > b[3]);
  const ground = (x, z) => gen.sample(Math.floor(x), Math.floor(z));
  // Tries to put a building of `w` x `d` near (x, z), facing towards (tx, tz); `flat`: how much the
  // ground may rise and fall under it.
  const place = (type, w, d, x, z, tx, tz, flat = 3, y = null) => {
    const face = faceTo(x, z, tx, tz), sideways = face === 0 || face === 1, hw = sideways ? d : w, hd = sideways ? w : d;
    const x0 = Math.round(x - hw / 2), z0 = Math.round(z - hd / 2), x1 = x0 + hw - 1, z1 = z0 + hd - 1;
    if (!fits(x0, z0, x1, z1)) return false;
    if (y === null) {
      const hs = [[x0, z0], [x1, z0], [x0, z1], [x1, z1], [(x0 + x1) >> 1, (z0 + z1) >> 1]].map(([a, c]) => ground(a, c).height);
      if (Math.min(...hs) <= SEA_LEVEL + 1 || Math.max(...hs) - Math.min(...hs) > flat) return false;
      y = hs.sort((a, b) => a - b)[2] + 1;
    }
    boxes.push([x0, z0, x1, z1]);
    pieces.push({ type, x: Math.round(x), z: Math.round(z), y, face, w, d, box: [x0 - 2, z0 - 2, x1 + 2, z1 + 2] });
    return true;
  };
  const { x: ix, z: iz, r } = isle;
  // The landmark: a winter island's castle on its tallest peak; the bones lying in the jungle; the
  // others near the middle.
  if (T.landmark) {
    const [type, w, d] = T.landmark;
    if (isle.kind === 'winter' && isle.peaks?.length) {
      const p = isle.peaks[0], top = gen.sample(Math.round(p.x), Math.round(p.z)).height + 1;
      place(type, w, d, p.x, p.z, p.x, p.z + 1, 99, top);
    } else {
      for (let k = 0; k < 48; k++) {
        const a = rnd() * Math.PI * 2, rr = r * (k < 8 ? 0.08 : k < 24 ? 0.25 : 0.45) * rnd();
        if (place(type, w, d, ix + Math.cos(a) * rr, iz + Math.sin(a) * rr, ix + Math.cos(a) * (rr + 30), iz + Math.sin(a) * (rr + 30), type === 'bones' ? 30 : k < 24 ? 5 : 8)) break;
      }
    }
  }
  // Houses round about, facing in towards the middle (or the landmark).
  for (let k = 0, made = 0; k < T.n * 6 && made < T.n && T.houses.length; k++) {
    const [type, w, d] = pick(rnd, T.houses), a = rnd() * Math.PI * 2, rr = r * (0.18 + rnd() * 0.42);
    const x = ix + Math.cos(a) * rr, z = iz + Math.sin(a) * rr;
    if (place(type, w, d, x, z, ix, iz, type === 'stiltHut' ? 9 : type === 'grave' ? 6 : 3)) made++;
  }
  // A pier from the shore out to sea, on the side the town's houses face from.
  if (T.pier) {
    for (let k = 0; k < 16; k++) {
      const a = isle.angle + k * 0.4, sx = ix + Math.cos(a) * r * 0.98, sz = iz + Math.sin(a) * r * 0.98;
      const s = ground(sx, sz);
      if (s.height < SEA_LEVEL - 1 || s.height > SEA_LEVEL + 2) continue;
      // (Out along the way away from the middle.)
      const ox = ix + Math.cos(a) * (r + 40), oz = iz + Math.sin(a) * (r + 40);
      const face = faceTo(sx, sz, ox, oz), len = 16;
      const end = ground(sx + Math.cos(a) * len, sz + Math.sin(a) * len);
      if (end.height > SEA_LEVEL - 3) continue;
      const dir = { 0: [1, 0], 1: [-1, 0], 4: [0, 1], 5: [0, -1] }[face];
      const x0 = Math.min(sx, sx + dir[0] * len) - 2, x1 = Math.max(sx, sx + dir[0] * len) + 2, z0 = Math.min(sz, sz + dir[1] * len) - 2, z1 = Math.max(sz, sz + dir[1] * len) + 2;
      pieces.push({ type: 'pier', x: Math.round(sx), z: Math.round(sz), y: SEA_LEVEL + 1, face, w: 3, d: len, len, box: [Math.floor(x0), Math.floor(z0), Math.ceil(x1), Math.ceil(z1)], fromFront: true });
      break;
    }
  }
  return { pieces, seed: isle.seed, box: pieces.reduce((u, p) => [Math.min(u[0], p.box[0]), Math.min(u[1], p.box[1]), Math.max(u[2], p.box[2]), Math.max(u[3], p.box[3])], [Infinity, Infinity, -Infinity, -Infinity]) };
}

// The landmarks out at sea: the Baratie by the first island, Twin Cape's lighthouse.
function seaPlans(gen) {
  const out = [], a = gen.op, start = a.island(...START_CELL);
  // The Baratie: out to sea east of the first island.
  out.push({ type: 'baratie', x: Math.round(start.x + start.r * 1.8), z: Math.round(start.z), y: SEA_LEVEL, face: 5, w: 13, d: 31, box: null });
  // Twin Cape's lighthouse: on the Grand Line side of Reverse Mountain's canal, by its mouth.
  out.push({ type: 'lighthouse', x: RED_LINE.x + RED_LINE.half + 52, z: GRAND_LINE.z + 22, y: SEA_LEVEL + 1, face: 1, w: 5, d: 5, box: null });
  for (const p of out) p.box = [p.x - 24, p.z - 24, p.x + 24, p.z + 24];
  return out;
}

// ---------------------------------------------------------------- plans and blueprints
const plans = new Map();
function cached(key, make) {
  if (plans.has(key)) return plans.get(key);
  const v = make();
  plans.set(key, v);
  if (plans.size > 300) plans.delete(plans.keys().next().value);
  return v;
}
// The pieces (buildings, the Baratie...) of the island square holding (x, z), with their blueprints.
function cellPlans(gen, i, j) {
  const n = 16384 / CELL;
  i = ((i % n) + n) % n; j = ((j % n) + n) % n;
  return cached(`${gen.seed}:${i},${j}`, () => {
    const isle = gen.op.island(i, j), list = [];
    if (isle) { const t = townPlan(gen, isle); if (t) list.push(...t.pieces); }
    for (const p of seaPlans(gen)) if (Math.floor(p.x / CELL) === i && Math.floor(p.z / CELL) === j) list.push(p);
    // A wreck on the sea floor in one square in three.
    if (hash2(i, j, gen.seed ^ 0x3e3c) < 0.33) {
      const rnd = mulberry32(Math.floor(hash2(i, j, gen.seed ^ 0x3e3d) * 4294967296));
      for (let t = 0; t < 4; t++) {
        const x = i * CELL + 40 + Math.floor(rnd() * (CELL - 80)), z = j * CELL + 40 + Math.floor(rnd() * (CELL - 80));
        const w = planShipwreck(gen, x, z, rnd);
        if (w) { list.push({ type: 'wreck', wreck: Object.assign(w, { seed: Math.floor(rnd() * 4294967296) }), box: w.box }); break; }
      }
    }
    list.forEach((p, k) => { p.key = `${i},${j}:${k}`; });
    return list;
  });
}
function blueprint(gen, p) {
  if (p.plot) return p.plot;
  const plot = new Plot(), rnd = mulberry32((gen.seed ^ hash2(p.x ?? 0, p.z ?? 0, 0xb1d) * 4294967296) >>> 0);
  if (p.type === 'wreck') buildShipwreck(gen, p.wreck, plot, mulberry32(p.wreck.seed));
  else if (p.type === 'pier') pier(new Build(plot, p.x, p.y - 1, p.z, p.face, 3, 0), p.len);
  else if (p.type === 'baratie') baratie(new Build(plot, p.x, p.y, p.z, p.face, 13, 31));
  else if (p.type === 'lighthouse') lighthouse(new Build(plot, p.x, p.y, p.z, p.face, 5, 5));
  else {
    const T = Object.values(TOWNS).find((t) => t.landmark?.[0] === p.type || t.houses.some((h) => h[0] === p.type));
    BUILDERS[p.type](new Build(plot, p.x, p.y, p.z, p.face, p.w, p.d), rnd, townStyle(gen, p) ?? T?.style);
  }
  p.plot = plot.seal();
  return p.plot;
}
// (The style of a building is its island's.)
function townStyle(gen, p) {
  const isle = gen.op.island(Math.floor(p.x / CELL), Math.floor(p.z / CELL));
  return isle && TOWNS[isle.kind]?.style;
}

// Every piece reaching into chunk (cx, cz).
function piecesIn(gen, cx, cz) {
  const x0 = cx * 16, z0 = cz * 16, x1 = x0 + 15, z1 = z0 + 15;
  const list = cellPlans(gen, Math.floor(x0 / CELL), Math.floor(z0 / CELL));
  return list.filter((p) => p.box[0] <= x1 && p.box[2] >= x0 && p.box[1] <= z1 && p.box[3] >= z0);
}

// Copies the pieces' share of chunk (cx, cz) into `blocks` (from y 0 up), as drawStructures does.
export function drawOnePiece(gen, cx, cz, blocks) {
  const key = chunkKey(cx, cz);
  for (const p of piecesIn(gen, cx, cz)) {
    const list = blueprint(gen, p).chunks.get(key);
    if (!list) continue;
    for (let i = 0; i < list.length; i++) {
      const v = list[i], pos = v & 0xffff, op = v >>> 16, id = op & 0xfff, cur = blocks[pos];
      if (op & 0xf000) {
        if ((op & FILL) && cur !== 0 && !WATERLIKE[cur] && !SOFT_IDS[cur]) continue;
        if ((op & SOFT) && !SOFT_IDS[cur] && cur !== 0) continue;
        if ((op & 0x8000) && !hangs(blocks, pos, id)) continue;
      }
      blocks[pos] = id;
    }
  }
}

// The building at (x, z) (with `margin` round it), or null: trees keep off them.
export function onePieceAt(gen, x, z, margin = 0) {
  for (const p of cellPlans(gen, Math.floor(x / CELL), Math.floor(z / CELL))) {
    if (p.type === 'wreck') continue;
    const b = p.box;
    if (x >= b[0] - margin && x <= b[2] + margin && z >= b[1] - margin && z <= b[3] + margin) return p;
  }
  return null;
}

// The pieces of the island square (i, j) (for /locate and tests).
export const onePiecePieces = (gen, i, j) => cellPlans(gen, i, j);

// What /locate finds in a One Piece world: a name it takes, and what it calls the place.
export const OP_LOCATE = {
  island: 'island', town: 'town', marine: 'Marine base', baratie: 'Baratie', lighthouse: 'lighthouse', wreck: 'shipwreck',
  ...Object.fromEntries(Object.entries(KINDS).map(([k, v]) => [k, v.name])),
};
const OP_ALIAS = { village: 'town', base: 'marine', marinebase: 'marine', marine_base: 'marine', shipwreck: 'wreck', ship: 'wreck',
  restaurant: 'baratie', twin_cape: 'lighthouse' };
export const opLocateKind = (k) => (OP_LOCATE[OP_ALIAS[k] ?? k] ? OP_ALIAS[k] ?? k : null);

// The nearest place of `kind` (one of OP_LOCATE's) to (x, z) all round the planet, or null:
// { x, y, z, name } at the copy of it nearest (x, z).
export function locateOnePiece(gen, kind, x, z) {
  const n = 16384 / CELL, ci = Math.floor(x / CELL), cj = Math.floor(z / CELL);
  let best = null, bd = Infinity;
  const consider = (px, pz, y, name) => {
    const d = Math.hypot(px - x, pz - z);
    if (d < bd) { bd = d; best = { x: Math.round(px), y, z: Math.round(pz), name }; }
  };
  // Squares outwards from the one (x, z) is in, ring by ring, half the planet round at most.
  for (let ring = 0; ring <= n / 2; ring++) {
    if (best && (ring - 1) * CELL > bd) break;
    for (let di = -ring; di <= ring; di++) for (let dj = -ring; dj <= ring; dj++) {
      if (Math.max(Math.abs(di), Math.abs(dj)) !== ring) continue;
      const i = ci + di, j = cj + dj, ox = Math.floor(i / n) * 16384, oz = Math.floor(j / n) * 16384;
      const ii = i - Math.floor(i / n) * n, jj = j - Math.floor(j / n) * n, isle = gen.op.island(ii, jj);
      if (isle && (kind === 'island' || kind === isle.kind || (kind === 'town' && TOWNS[isle.kind]?.houses.length))) {
        consider(isle.x + ox, isle.z + oz, gen.sample(Math.floor(isle.x), Math.floor(isle.z)).height + 1, KINDS[isle.kind].name);
      }
      if (kind === 'marine' || kind === 'baratie' || kind === 'lighthouse' || kind === 'wreck') {
        const type = kind === 'marine' ? 'marineBase' : kind;
        for (const p of cellPlans(gen, ii, jj)) {
          if (p.type !== type) continue;
          const px = type === 'wreck' ? (p.box[0] + p.box[2]) / 2 : p.x, pz = type === 'wreck' ? (p.box[1] + p.box[3]) / 2 : p.z;
          consider(px + ox, pz + oz, type === 'wreck' ? gen.sample(Math.floor(px), Math.floor(pz)).height + 1 : p.y + 1, OP_LOCATE[kind]);
        }
      }
    }
  }
  return best;
}
