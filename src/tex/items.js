// Item textures. Every item is a hand-drawn 16x16 shape shaded by the same rule (see `shaded`
// in core.js): lit from the top left, darker to the bottom right, with a dark outline on the
// shadow side. Tools share their shapes across materials and only swap palettes.
import { def, pick, lighten, shaded, paint, mix, shade } from './core.js';
import { POTIONS } from '../potions.js';
import { WOODS, DOOR_STYLE } from './terrain.js';

// [outline, dark, mid, light, highlight]
export const MATERIAL = {
  wooden: [0x3a2810, 0x6b4c22, 0x8d6932, 0xab874a, 0xc6a466],
  stone: [0x363636, 0x585858, 0x767676, 0x949494, 0xb0b0b0],
  iron: [0x383838, 0x858585, 0xb6b6b6, 0xdcdcdc, 0xffffff],
  golden: [0x5e3706, 0xba720d, 0xe6ad24, 0xf9d648, 0xfff6a6],
  diamond: [0x0b4541, 0x178e84, 0x2cc3b0, 0x6be8d4, 0xc9fff3],
  chainmail: [0x2e2e32, 0x5a5a60, 0x7c7c84, 0xa2a2aa, 0xc8c8d0],
  leather: [0x3a2010, 0x6e4122, 0x8e5832, 0xa86e40, 0xc28a58],
};
const GRAIN = { wooden: 0.25, stone: 0.3 };
// The wooden handle: two pixels wide, lit on its upper-left side.
const H = { k: 0x2c1e0c, w: 0x5a4020, W: 0x876538 };
function handle(t, top) {
  for (let y = 14; y >= top; y--) {
    const x = 15 - y;
    for (const [px, c] of [[x, y === 14 ? H.k : H.W], [x + 1, y === 14 ? H.k : H.w]]) if (!t.alpha(px, y)) t.set(px, y, c);
  }
  if (!t.alpha(0, 15)) t.set(0, 15, H.k);
  if (!t.alpha(1, 15)) t.set(1, 15, H.k);
}
const TOOLS = {
  pickaxe: { top: 5, rows: [
    '................',
    '..xxxxxxxxx.....',
    '.xxxxxxxxxxx....',
    '..........xxx...',
    '...........xxx..',
    '............xxx.',
    '.............xx.',
    '.............xx.',
    '.............xx.',
    '.............xx.',
    '.............xx.',
    '.............xx.',
    '.............xx.',
    '.............xx.',
    '.............x..',
    '................'] },
  shovel: { top: 6, rows: [
    '................',
    '...........xxx..',
    '..........xxxxx.',
    '.........xxxxxx.',
    '........xxxxxx..',
    '........xxxxx...',
    '.........xxx....'] },
  hoe: { top: 3, rows: [
    '................',
    '.....xxxxxxxx...',
    '....xxxxxxxxxx..',
    '....xxx...xxx...',
    '....xx....xx....'] },
};
// Swords are drawn out in full: the blade's edges, the fuller down its middle, the guard, the
// grip and the pommel.
const SWORD = [
  '..............##',
  '.............#h#',
  '............#hl#',
  '...........#hl#.',
  '..........#hl#..',
  '.........#hl#...',
  '........#hl#....',
  '.......#hl#.....',
  '......#hl#......',
  '.##..#hl#.......',
  '.#g##hl#........',
  '..#gGm#.........',
  '..WwgGg#........',
  '.Ww.#gg#........',
  'pP...##.........',
  'Pq..............'];
// The axe's blade has a straight, sharpened edge facing away from the handle.
const AXE = [
  '................',
  '..hll#..........',
  '.hllmmd#........',
  '.hlmmmmdd#......',
  '.hlmmmmdddd#....',
  '.hlmmmmdddd#....',
  '.hlmmmdd##......',
  '.hlmdd#.........',
  '..#dd#..........',
  '...##...........'];
function axe(t, pal, grain) {
  t.clear();
  paint(t, AXE, { '#': pal[0], d: pal[1], m: pal[2], l: pal[3], h: pal[4] });
  if (grain) for (let y = 0; y < 10; y++) for (let x = 0; x < 12; x++) {
    const k = { d: 1, m: 2, l: 3 }[AXE[y][x]];
    if (k && t.r() < grain) t.set(x, y, pal[k + (t.r() < 0.5 ? -1 : 1)]);
  }
  handle(t, 2);
}
function sword(t, pal) {
  t.clear();
  paint(t, SWORD, { '#': pal[0], h: pal[4], l: pal[3], m: pal[2], g: pal[1], G: pal[2], W: H.W, w: H.w, p: pal[3], P: pal[1], q: pal[0] });
}
for (const [mat, pal] of Object.entries(MATERIAL)) {
  if (mat === 'chainmail' || mat === 'leather') continue;
  for (const [kind, spec] of Object.entries(TOOLS)) {
    def(`${mat}_${kind}`, (t) => { shaded(t, spec.rows, pal, {}, { grain: GRAIN[mat] ?? 0 }); handle(t, spec.top); });
  }
  def(`${mat}_axe`, (t) => axe(t, pal, GRAIN[mat] ?? 0));
  def(`${mat}_sword`, (t) => sword(t, pal));
}
def('stick', (t) => { t.clear(); handle(t, 2); });

// ---------------------------------------------------------------- materials
const blob = (rows) => rows;
// Lumps of coal and raw ore: knobbly, outlined all round.
const LUMP = blob([
  '', '', '', '.....xxx........', '...xxxxxxx......', '..xxxxxxxxxx....', '..xxxxxxxxxxx...', '.xxxxxxxxxxxx...',
  '.xxxxxxxxxxxx...', '..xxxxxxxxxxx...', '..xxxxxxxxxx....', '...xxxxxxxx.....', '.....xxxx.......']);
const RAW = blob([
  '', '', '', '.......xxx......', '....xxxxxxx.....', '...xxxxxxxxx....', '..xxxxxxxxxxx...', '..xxxxxxxxxxxx..',
  '.xxxxxxxxxxxxx..', '.xxxxxxxxxxxx...', '..xxxxxxxxxxx...', '...xxxxxxxx.....', '....xx..xxx.....']);
function lump(t, rows, pal, specks) {
  shaded(t, rows, pal, {}, { outline: 'all', grain: 0.25 });
  for (const [x, y, k] of specks) if (t.alpha(x, y)) t.set(x, y, pal[k]);
}
def('coal', (t) => lump(t, LUMP, [0x0a0a0a, 0x1e1e1e, 0x2d2d2d, 0x424242, 0x5c5c5c], [[5, 6, 4], [9, 9, 3], [4, 10, 1]]));
def('charcoal', (t) => lump(t, LUMP, [0x100b07, 0x291d13, 0x3a2a1c, 0x503b28, 0x6a5038], [[5, 6, 4], [9, 9, 3], [4, 10, 1]]));
def('raw_iron', (t) => lump(t, RAW, [0x3e2c22, 0x9c7a62, 0xbc977c, 0xd6b397, 0xecd0b8], [[6, 5, 1], [10, 8, 1], [4, 10, 4]]));
def('raw_gold', (t) => lump(t, RAW, [0x5a3606, 0xc08a12, 0xe0b021, 0xf6d43e, 0xfff196], [[6, 5, 1], [10, 8, 1], [4, 10, 4]]));
def('raw_copper', (t) => lump(t, RAW, [0x4a2412, 0xa45432, 0xc86c42, 0xe08a5c, 0xf4ae84], [[6, 5, 1], [10, 8, 1], [4, 10, 4], [8, 11, 3]]));
// Ingots: a bar lying on the diagonal, its top face catching the light.
const INGOT = [
  '', '', '',
  '..........###...',
  '........##hhl#..',
  '......##hhllm#..',
  '....##hhllllmd#.',
  '..##hhllllllmd#.',
  '.#hhllllllmmdd#.',
  '.#lllllmmmddd#..',
  '.#mmmmmddddd#...',
  '.#dddddddd##....',
  '..########......'];
const ingot = (t, pal) => { t.clear(); paint(t, INGOT, { '#': pal[0], d: pal[1], m: pal[2], l: pal[3], h: pal[4] }); };
def('iron_ingot', (t) => ingot(t, MATERIAL.iron));
def('gold_ingot', (t) => ingot(t, MATERIAL.golden));
def('copper_ingot', (t) => ingot(t, [0x4a2210, 0xa4502c, 0xcc6c40, 0xe88c5c, 0xffc09a]));
const NUGGET = ['', '', '', '', '', '....xx..........', '...xxxx...xx....', '...xxxx..xxxx...', '....xx...xxxx...',
  '..........xx....', '.....xxx........', '....xxxxx.......', '....xxxxx.......', '.....xxx........'];
def('iron_nugget', (t) => shaded(t, NUGGET, MATERIAL.iron, {}, { outline: 'all' }));
def('gold_nugget', (t) => shaded(t, NUGGET, MATERIAL.golden, {}, { outline: 'all' }));
// Gems: cut stones with a flat top and facets.
def('diamond', (t) => {
  t.clear();
  paint(t, ['', '', '', '.....######.....', '....#whhllm#....', '...#whhlllmm#...', '..#hhllllllmd#..', '..#hlllllmmmd#..',
    '...#llllmmmd#...', '....#lmmmmd#....', '.....#mmmd#.....', '......#md#......', '.......##.......'],
  { '#': 0x0c3a40, d: 0x14878c, m: 0x2cc7c9, l: 0x6ae9ea, h: 0xb4fbfb, w: 0xffffff });
});
def('emerald', (t) => {
  t.clear();
  paint(t, ['', '', '......####......', '.....#hhlm#.....', '....#hhllmm#....', '....#hllllmd#...', '...#hlllllmd#...', '...#llllllmd#...',
    '...#lllllmmd#...', '...#llllmmmd#...', '....#llmmmd#....', '....#lmmmdd#....', '.....#mmdd#.....', '......####......'],
  { '#': 0x063a1c, d: 0x0c8a3e, m: 0x17b957, l: 0x3fe07c, h: 0xa8ffc8 });
});
def('lapis_lazuli', (t) => {
  shaded(t, ['', '', '', '......xxxx......', '....xxxxxxx.....', '...xxxxxxxxx....', '..xxxxxxxxxxx...', '..xxxxxxxxxxx...',
    '...xxxxxxxxxx...', '...xxxxxxxxx....', '....xxxxxxx.....', '.....xxxx.......'], [0x0c1f52, 0x1c3f96, 0x2a58c0, 0x4a7ae0, 0x8ab0ff], {}, { outline: 'all', grain: 0.3 });
  for (const [x, y] of [[6, 6], [7, 6], [9, 8], [5, 9]]) t.set(x, y, 0xe0c060);
});
def('redstone', (t) => {
  t.clear();
  const pal = [0x5a0000, 0x9a0404, 0xd01010, 0xff3a2a, 0xff9080];
  for (const [x, y, r] of [[6, 7, 2.6], [10, 9, 2.4], [5, 11, 2], [9, 5, 1.8], [11, 12, 1.6]]) {
    for (let yy = Math.floor(y - r); yy <= y + r; yy++) for (let xx = Math.floor(x - r); xx <= x + r; xx++) {
      const d = Math.hypot(xx - x, yy - y);
      if (d <= r && t.r() < 0.85) t.set(xx, yy, pick(pal, 0.9 - d / r * 0.6 + (t.r() - 0.5) * 0.3));
    }
  }
});
def('flint', (t) => shaded(t, ['', '', '', '.......xx.......', '......xxxx......', '.....xxxxxx.....', '.....xxxxxxx....', '....xxxxxxxx....',
  '....xxxxxxxxx...', '...xxxxxxxxx....', '...xxxxxxxx.....', '....xxxxxx......', '.....xxx........'], [0x101010, 0x2a2a2a, 0x3c3c3c, 0x585858, 0x7a7a7a], {}, { outline: 'all' }));
def('clay_ball', (t) => shaded(t, ['', '', '', '', '......xxxx......', '....xxxxxxxx....', '....xxxxxxxx....', '...xxxxxxxxxx...', '...xxxxxxxxxx...',
  '...xxxxxxxxxx...', '....xxxxxxxx....', '....xxxxxxxx....', '......xxxx......'], [0x4a5060, 0x7e8698, 0x98a0b2, 0xb2bac8, 0xd0d6e2], {}, { outline: 'all' }));
def('brick', (t) => {
  t.clear();
  paint(t, ['', '', '', '', '', '........####....', '......##hhl#....', '....##hhllmd#...', '..##hllllmmd#...', '.#hlllllmmd#....',
    '.#llllmmmd#.....', '.#mmmmddd#......', '..#######.......'], { '#': 0x3a150c, d: 0x7a2e1c, m: 0x9a3e26, l: 0xba5234, h: 0xd87050 });
});
def('paper', (t) => {
  shaded(t, ['', '', '...xxxxxxxxx....', '...xxxxxxxxxx...', '...xxxxxxxxxx...', '...xxxxxxxxxx...', '...xxxxxxxxxx...', '...xxxxxxxxxx...',
    '...xxxxxxxxxx...', '...xxxxxxxxxx...', '...xxxxxxxxxx...', '...xxxxxxxxxx...', '...xxxxxxxxxx...', '....xxxxxxxxx...'],
  [0x8a8a80, 0xcfcfc4, 0xe6e6dc, 0xf6f6f0, 0xffffff], {}, { outline: 'all', interior: false });
  for (const y of [5, 7, 9, 11]) for (let x = 5; x < 12; x++) if (t.r() < 0.85) t.set(x, y, 0xcfd2da);
});
def('book', (t) => {
  t.clear();
  paint(t, ['', '', '..#########.....', '.#ccccccccc#....', '.#cCCCCCCCcp#...', '.#cCyyyyyCcpp#..', '.#cCCCCCCCcpp#..', '.#cCyyyyCCcpp#..',
    '.#cCCCCCCCcpp#..', '.#cCCCCCCCcpp#..', '.#cCCCCCCCcpp#..', '.#ccccccccc#p#..', '..#ssssssss#p#..', '...#########...'],
  { '#': 0x2a120a, c: 0x6a2c16, C: 0x86401e, y: 0xd8b040, p: 0xe6e0cc, s: 0x4a1e0e });
});
def('leather', (t) => shaded(t, ['', '', '...xx.....xx....', '..xxxxxxxxxxx...', '..xxxxxxxxxxx...', '...xxxxxxxxx....', '...xxxxxxxxx....', '...xxxxxxxxxx...',
  '..xxxxxxxxxxx...', '..xxxxxxxxxxx...', '...xxxxxxxxx....', '...xxxxxxxxx....', '..xxxx...xxxx...', '..xx.......xx...'], MATERIAL.leather, {}, { outline: 'all', grain: 0.2 }));
def('rabbit_hide', (t) => shaded(t, ['', '', '', '', '....xx...xx.....', '....xxxxxxx.....', '...xxxxxxxxx....', '...xxxxxxxxx....', '...xxxxxxxxx....',
  '....xxxxxxx.....', '....xxxxxxx.....', '...xxx...xxx....'], [0x4a3222, 0x9a7a5a, 0xb8966e, 0xd0b08a, 0xe6caa4], {}, { outline: 'all', grain: 0.2 }));
def('feather', (t) => {
  t.clear();
  paint(t, ['', '............ww..', '...........wWWw.', '..........wWWWw.', '.........wWWWw..', '........wWWWw...', '.......wWWWw....', '......wWWWw.....',
    '.....wWWWw......', '....wWWWw.......', '...wWWw.........', '...sww..........', '..s.............', '.s..............', 's...............'],
  { w: 0xc8c8c8, W: 0xf4f4f4, s: 0x8a8a8a });
  for (let i = 0; i < 8; i++) t.set(12 - i, 3 + i, 0xb0b0b0);
});
def('string', (t) => {
  t.clear();
  const pts = [[3, 12], [4, 10], [6, 9], [8, 10], [9, 12], [8, 13], [7, 12], [7, 10], [8, 7], [10, 5], [12, 4], [13, 3]];
  for (let i = 0; i + 1 < pts.length; i++) t.line(pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1], 0xf0f0f0);
  for (const [x, y] of pts) t.set(x + 1, y + 1, 0xa8a8a8);
});
def('bone', (t) => {
  t.clear();
  paint(t, ['', '', '..........#w#...', '.........#wWw#..', '..........wWW#..', '.........wWw#...', '........wWw#....', '.......wWw#.....',
    '......wWw#......', '.....wWw#.......', '....wWw#........', '...wWWw.........', '..#wWw#.........', '...#w#..........'], { '#': 0x8a8676, w: 0xd8d4c4, W: 0xf6f4ec });
});
function powder(t, pal) {
  t.clear();
  // A heap: taller in the middle, lit on the left.
  for (let y = 5; y < 14; y++) for (let x = 2; x < 14; x++) {
    if (y > 13 - (7.5 - Math.abs(x - 7.5)) * 1.05) t.set(x, y, pick(pal, 0.3 + (t.r() - 0.5) * 0.6 - (x - 7.5) / 20 - (y - 9) / 18));
  }
  for (let k = 0; k < 5; k++) t.set(3 + t.ri(10), 12 + t.ri(2), pal[pal.length - 1]);
}
def('bone_meal', (t) => powder(t, [0x9a988a, 0xc6c4b6, 0xe2e0d4, 0xf6f4ec]));
def('gunpowder', (t) => powder(t, [0x2e2e2e, 0x4a4a4a, 0x6a6a6a, 0x8e8e8e]));
def('sugar', (t) => powder(t, [0xc8c8cc, 0xe0e0e4, 0xf2f2f4, 0xffffff]));
def('slime_ball', (t) => {
  shaded(t, ['', '', '', '', '.....xxxxx......', '....xxxxxxx.....', '...xxxxxxxxx....', '...xxxxxxxxx....', '...xxxxxxxxx....',
    '...xxxxxxxxx....', '....xxxxxxx.....', '.....xxxxx......'], [0x2a6a1e, 0x4a9a3a, 0x68b850, 0x8ad46a, 0xc4f4a4], {}, { outline: 'all' });
  t.set(5, 6, 0xffffff); t.set(6, 6, 0xd8ffd0);
});
def('ender_pearl', (t) => {
  shaded(t, ['', '', '', '', '......xxxx......', '....xxxxxxxx....', '....xxxxxxxx....', '...xxxxxxxxxx...', '...xxxxxxxxxx...',
    '...xxxxxxxxxx...', '....xxxxxxxx....', '....xxxxxxxx....', '......xxxx......'], [0x061c1a, 0x0c3a34, 0x165a50, 0x2a8a76, 0x5ac8aa], {}, { outline: 'all' });
  for (const [x, y] of [[6, 7], [7, 7], [8, 8], [7, 9]]) t.set(x, y, 0x0e4a44);
});
def('wheat', (t) => {
  t.clear();
  for (const [x0, y0] of [[3, 2], [6, 1], [9, 2], [12, 4]]) {
    for (let i = 0; i < 5; i++) { t.set(x0 - 1 + (i % 2), y0 + i, 0xe6c858); t.set(x0 + (i % 2), y0 + i, 0xc8a236); }
  }
  for (let y = 7; y < 16; y++) for (const x of [6, 7, 8, 9]) if (!(y > 13 && (x === 6 || x === 9))) t.set(x - (y > 11 ? 0 : (9 - x) >> 1) + ((x - 6) >> 1) * 0, y, pick([0xb89a3a, 0xd4b24a, 0x9a7e2a], t.r()));
  for (let x = 5; x < 11; x++) { t.set(x, 11, 0x7a5a1a); t.set(x, 12, 0x5a4012); }
});
function seeds(t, pal) {
  t.clear();
  for (const [x, y] of [[4, 5], [9, 4], [6, 8], [11, 8], [3, 11], [8, 12], [12, 12], [6, 13]]) {
    t.set(x, y, pal[2]); t.set(x + 1, y, pal[1]); t.set(x, y + 1, pal[1]); t.set(x + 1, y + 1, pal[0]);
  }
}
def('wheat_seeds', (t) => seeds(t, [0x2e5a18, 0x4a8a28, 0x72b448]));
def('beetroot_seeds', (t) => seeds(t, [0x5a3a1c, 0x8a6030, 0xb88a4a]));
def('pumpkin_seeds', (t) => seeds(t, [0x9a8a58, 0xcabb82, 0xece0b0]));
def('melon_seeds', (t) => seeds(t, [0x1a1a10, 0x3a3a22, 0x5a5a38]));
def('egg', (t) => shaded(t, ['', '', '', '.......xx.......', '......xxxx......', '.....xxxxxx.....', '.....xxxxxx.....', '....xxxxxxxx....',
  '....xxxxxxxx....', '....xxxxxxxx....', '....xxxxxxxx....', '.....xxxxxx.....', '......xxxx......'], [0x6a5a3a, 0xc8b08a, 0xdcc8a2, 0xeee0c0, 0xfff8e8], {}, { outline: 'all' }));
// The village currency: a gold coin with a raised rim and a crown struck in its face.
def('gold_coin', (t) => {
  t.clear();
  const pal = MATERIAL.golden;
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
    const dx = x + 0.5 - 8, dy = y + 0.5 - 8.5, d = Math.hypot(dx, dy), lit = -(dx + dy) / (d || 1);
    if (d > 7.3) continue;
    if (d > 6.4) t.set(x, y, pal[0]);
    else if (d > 5.1) t.set(x, y, pal[lit > 0.35 ? 4 : lit > -0.35 ? 3 : 1]);
    else t.set(x, y, pal[lit > 0.3 && d > 3.8 ? 1 : lit < -0.3 && d > 3.8 ? 3 : 2]);
  }
  paint(t, ['', '', '', '', '', '....h..h..h.....', '....hd.hd.hd....', '....hhhhhhhd....', '....hhhhhhhd....', '....dddddddd....'],
    { h: pal[4], d: pal[1] }, { clear: false });
});
def('dye', (t) => shaded(t, ['', '', '', '', '.......xx.......', '......xxxx......', '.....xxxxxx.....', '....xxxxxxxx....', '....xxxxxxxx....',
  '...xxxxxxxxxx...', '...xxxxxxxxxx...', '....xxxxxxxx....', '.....xxxxxx.....'], [0x505050, 0xb0b0b0, 0xd0d0d0, 0xe8e8e8, 0xffffff], {}, { outline: 'all' }));

// ---------------------------------------------------------------- tools and gear
def('flint_and_steel', (t) => {
  t.clear();
  paint(t, ['', '', '...###..........', '..#lll#.........', '.#l...l#........', '.#l....l#.......', '.#l....l#.......', '..#m..m#........',
    '...#..#.........', '.........##.....', '........#ff#....', '.......#fFff#...', '.......#ffff#...', '........#ff#....', '.........##.....'],
  { '#': 0x2a2a2a, l: 0xd0d0d0, m: 0x8a8a8a, f: 0x3a3a3a, F: 0x6a6a6a });
});
def('shears', (t) => {
  t.clear();
  paint(t, ['', '..........#.....', '.........#h#....', '........#hl#....', '.......#hl#.....', '......#hl#......', '.....#hl##......', '....##oo#.......',
    '...#rr#oo#......', '..#rRr#.#hl#....', '..#rrr#..#hl#...', '...###....#hl#..', '...........#l#..', '............#...'],
  { '#': 0x2a2a2a, h: 0xf0f0f0, l: 0xb4b4b4, o: 0x6a6a6a, r: 0x8a2a1a, R: 0xba4a2a });
});
const BUCKET = ['', '', '', '...##########...', '..#llllllllll#..', '..#iiiiiiiiii#..', '..#hlllllllmd#..', '..#hllllllmdd#..',
  '...#hlllllmd#...', '...#hlllllmd#...', '...#hllllmmd#...', '....#hlllmd#....', '....#hllmmd#....', '.....######.....'];
function bucket(t, inside) {
  t.clear();
  paint(t, BUCKET, { '#': 0x2e2e2e, d: 0x6a6a6a, m: 0x9a9a9a, l: 0xc8c8c8, h: 0xf0f0f0, i: inside ?? 0x4a4a4a });
  if (inside) for (let x = 4; x < 12; x += 3) t.set(x, 5, lighten(inside, 0.3));
}
def('bucket', (t) => bucket(t, null));
def('water_bucket', (t) => bucket(t, 0x3a6ae0));
def('lava_bucket', (t) => bucket(t, 0xf07a18));
def('milk_bucket', (t) => bucket(t, 0xf4f4f0));
def('bow', (t) => {
  t.clear();
  paint(t, ['', '.........wwwk....', '.......wwW...k...', '......wW.....k..', '.....wW......k..', '....wW.......k..', '....w........k..', '...wW.......k...',
    '...w.......k....', '...w......k.....', '...wW...k.......', '....w.k.........', '....wk..........', '...#k...........', '..##............'],
  { w: 0x6a4a24, W: 0x9a7040, k: 0xd8d8d8, '#': 0x3a2a14 });
});
def('arrow', (t) => {
  t.clear();
  paint(t, ['', '..............#.', '............##h#', '...........#hll#', '..........#s#md#', '.........#s#.#..', '........#s#.....', '.......#s#......',
    '......#s#.......', '.....#s#........', '..ww#s#.........', '..wWws#.........', '...wWWw.........', '....ww..........'],
  { '#': 0x2a2a2a, h: 0xc8c8c8, l: 0x8a8a8a, m: 0x6a6a6a, d: 0x3a3a3a, s: 0x8a6a3a, w: 0xd8d8d8, W: 0xffffff });
});
def('compass', (t) => {
  t.clear();
  paint(t, ['', '', '.....######.....', '...##llllll##...', '..#lffffffffm#..', '..#ffffffrfffm#.', '.#lffffffrffffm#', '.#lffffffrffffm#',
    '.#lffffffkffffm#', '.#lfffffbfffffm#', '.#lfffffbfffffm#', '..#fffffffffm#..', '..#mmffffffmm#..', '...##mmmmmm##...', '.....######.....'],
  { '#': 0x2a2a2a, l: 0xd8d8d8, m: 0x6a6a6a, f: 0xbcb2a0, r: 0xd02a1a, b: 0x2a2a3a, k: 0x3a3a3a });
});
def('clock', (t) => {
  t.clear();
  paint(t, ['', '', '.....######.....', '...##llllll##...', '..#lssssssssm#..', '..#sssssssssm#..', '.#lsssssssssssm#', '.#lssssyssssssm#',
    '.#lnnnnnnnnnnnm#', '.#lnnnnnnnnnnnm#', '.#lnnnnwnnnnnnm#', '..#nnnnnnnnnm#..', '..#mmnnnnnnmm#..', '...##mmmmmm##...', '.....######.....'],
  { '#': 0x5e3706, l: 0xfad448, m: 0xba720d, s: 0x6aa8e8, y: 0xfff080, n: 0x1a2a5a, w: 0xe8e8f0 });
});
def('fishing_rod', (t) => {
  t.clear();
  paint(t, ['', '............ww..', '...........wW.k.', '..........wW..k.', '.........wW...k.', '........wW....k.', '.......wW.....k.', '......wW......k.',
    '.....wW.......k.', '....wW........k.', '...wW........k..', '..wW.........h..', '.wW.........hh..', 'wW..............'],
  { w: 0x5a4020, W: 0x8a6838, k: 0xd8d8d8, h: 0x8a8a8a });
});
// The rod once it's cast: the line runs out from the tip instead of hanging down it.
def('fishing_rod_cast', (t) => {
  t.clear();
  paint(t, ['', '............ww..', '...........wW...', '..........wW....', '.........wW.....', '........wW......', '.......wW.......', '......wW........',
    '.....wW.........', '....wW..........', '...wW...........', '..wW............', '.wW.............', 'wW..............'], { w: 0x5a4020, W: 0x8a6838 });
  t.set(14, 1, 0xd8d8d8); t.set(15, 0, 0xd8d8d8);
});
// The float on the end of a line: red over white, with a quill on top (see fishing.js).
def('fishing_bobber', (t) => {
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
    const edge = x === 0 || x === 15;
    t.set(x, y, y < 8 ? (edge || y === 0 ? 0x8a1010 : x < 5 ? 0xf04030 : 0xd02418) : (edge || y === 15 ? 0xa8a8a8 : x < 5 ? 0xffffff : 0xe8e8e8));
  }
});
def('saddle', (t) => shaded(t, ['', '', '', '', '...xx......xx...', '..xxxxxxxxxxxx..', '..xxxxxxxxxxxx..', '...xxxxxxxxxx...', '....xxxxxxxx....',
  '....x......x....', '....x......x....', '...xxx....xxx...'], MATERIAL.leather, {}, { outline: 'all', grain: 0.15 }));

// ---------------------------------------------------------------- food
def('apple', (t) => {
  shaded(t, ['', '', '', '', '....xxx..xxx....', '...xxxxxxxxxx...', '..xxxxxxxxxxxx..', '..xxxxxxxxxxxx..', '..xxxxxxxxxxxx..',
    '..xxxxxxxxxxxx..', '..xxxxxxxxxxxx..', '...xxxxxxxxxx...', '....xxxxxxxx....', '.....xx..xx.....'], [0x3a0806, 0x9a1410, 0xc81e16, 0xe8392a, 0xff7a64], {}, { outline: 'all' });
  paint(t, ['', '.......s.gg.....', '.......sgGg.....', '........s.......', '........s.......'], { s: 0x5a3a1a, g: 0x3a7a2a, G: 0x5aa03a }, { clear: false });
  t.set(4, 6, 0xffffff); t.set(4, 7, 0xffc0b0);
});
def('golden_apple', (t) => {
  shaded(t, ['', '', '', '', '....xxx..xxx....', '...xxxxxxxxxx...', '..xxxxxxxxxxxx..', '..xxxxxxxxxxxx..', '..xxxxxxxxxxxx..',
    '..xxxxxxxxxxxx..', '..xxxxxxxxxxxx..', '...xxxxxxxxxx...', '....xxxxxxxx....', '.....xx..xx.....'], MATERIAL.golden, {}, { outline: 'all' });
  paint(t, ['', '.......s.gg.....', '.......sgGg.....', '........s.......', '........s.......'], { s: 0x5a3a1a, g: 0x3a7a2a, G: 0x5aa03a }, { clear: false });
  t.set(4, 6, 0xffffff); t.set(10, 9, 0xffffff);
});
def('bread', (t) => {
  t.clear();
  paint(t, ['', '', '', '', '..........####..', '.......###hhlm#.', '.....##hhlllmmd#', '....#hhllllmmmd#', '...#hlllllmmmdd#', '..#hllllmmmmdd#.',
    '.#hlllmmmmmdd#..', '.#lllmmmmddd#...', '.#mmmmmmddd#....', '..#dddddd##.....', '...######.......'], { '#': 0x3a2208, d: 0x8a5a1a, m: 0xb07a2a, l: 0xcc9a3e, h: 0xe8bc62 });
  for (const [x, y] of [[6, 8], [7, 8], [9, 7], [10, 7], [12, 6]]) t.set(x, y, 0xf0d890);
});
function root(t, pal, green) {
  t.clear();
  paint(t, ['', '..........gG.G..', '.........gGgG...', '..........gg....', '.........###....', '........#hl#....', '.......#hlm#....', '......#hlmd#....',
    '.....#hlmd#.....', '....#hlmd#......', '...#hlmd#.......', '..#lmd#.........', '..#md#..........', '..##............'],
  { '#': pal[0], d: pal[1], m: pal[2], l: pal[3], h: pal[4], g: green[0], G: green[1] });
}
def('carrot', (t) => root(t, [0x5a2204, 0xc05a0c, 0xe8801a, 0xfaa440, 0xffd08a], [0x2e6a1a, 0x5aa83a]));
def('golden_carrot', (t) => root(t, MATERIAL.golden, [0x8a7a1a, 0xe8d05a]));
function tuber(t, pal, eyes) {
  shaded(t, ['', '', '', '', '', '.....xxxxx......', '....xxxxxxxx....', '...xxxxxxxxxx...', '...xxxxxxxxxxx..', '...xxxxxxxxxxx..',
    '....xxxxxxxxxx..', '.....xxxxxxxx...', '.......xxxx.....'], pal, {}, { outline: 'all' });
  for (const [x, y] of [[6, 8], [10, 9], [8, 11]]) t.set(x, y, eyes);
}
def('potato', (t) => tuber(t, [0x4a3414, 0xa07a3a, 0xc49a52, 0xdcb870, 0xf0d898], 0x7a5a28));
def('baked_potato', (t) => tuber(t, [0x3a2208, 0x9a6420, 0xc4862e, 0xe0a848, 0xf6d078], 0x6a4012));
def('poisonous_potato', (t) => tuber(t, [0x3a4414, 0x8a9a3a, 0xaabb52, 0xc6d470, 0xe0ec98], 0x5a6a28));
def('beetroot', (t) => {
  shaded(t, ['', '', '', '', '', '....xxxxxx......', '...xxxxxxxx.....', '...xxxxxxxxx....', '...xxxxxxxxx....', '....xxxxxxxx....',
    '.....xxxxxx.....', '......xxxx......', '.......xx.......', '........x.......'], [0x2a0410, 0x6a0c22, 0x961a34, 0xbc2e4a, 0xe06076], {}, { outline: 'all' });
  paint(t, ['', '....gG..Gg......', '.....gGGg.......', '......gg........', '......G.........'], { g: 0x2e6a1a, G: 0x5aa83a }, { clear: false });
});
def('melon_slice', (t) => {
  t.clear();
  paint(t, ['', '', '', '', '', '', '#.............#.', 'g#rrrrrrrrrrr#g.', 'gw#rrkrrrkrr#wg.', '.gw#rrrrrrr#wg..', '..gw#rrkrr#wg...',
    '...gw#rrr#wg....', '....gw#r#wg.....', '.....gw#wg......', '......ggg.......'], { '#': 0xc83a2a, r: 0xe8483a, k: 0x2a1a10, w: 0xd8e8a0, g: 0x3a7a1a });
});
def('pumpkin_pie', (t) => {
  t.clear();
  paint(t, ['', '', '', '', '....########....', '..##cccccccc##..', '.#ccoooooooocc#.', '#ccoOOOOOOOOocc#', '#cooOOOOOOOOooc#', '#ccooooooooocc#.',
    '.#cccccccccccc#.', '.#CCCCCCCCCCCC#.', '.#DDDDDDDDDDDD#.', '..############..'], { '#': 0x4a2206, o: 0xd87818, O: 0xf09a34, c: 0xe8b870, C: 0xc8924a, D: 0x9a6a2e });
});
def('cookie', (t) => {
  shaded(t, ['', '', '', '', '.....xxxxxx.....', '....xxxxxxxx....', '...xxxxxxxxxx...', '...xxxxxxxxxx...', '...xxxxxxxxxx...',
    '...xxxxxxxxxx...', '...xxxxxxxxxx...', '....xxxxxxxx....', '.....xxxxxx.....'], [0x4a2a10, 0xa0602a, 0xc4823a, 0xdca052, 0xf0c078], {}, { outline: 'all' });
  for (const [x, y] of [[6, 6], [9, 7], [5, 9], [8, 10], [11, 9]]) t.set(x, y, 0x3a1e0c);
});
function meat(t, pal, fat, bone) {
  shaded(t, ['', '', '', '....xxxxx.......', '...xxxxxxxx.....', '..xxxxxxxxxx....', '..xxxxxxxxxxx...', '..xxxxxxxxxxxx..', '...xxxxxxxxxxx..',
    '....xxxxxxxxxx..', '.....xxxxxxxx...', '.......xxxxx....'], pal, {}, { outline: 'all', grain: 0.2 });
  for (const [x, y] of [[4, 5], [5, 4], [9, 8], [10, 9]]) if (fat) t.set(x, y, fat);
  if (bone) { t.set(12, 11, bone); t.set(13, 12, bone); t.set(14, 13, bone); t.set(13, 13, 0xc8c0b0); }
}
def('raw_porkchop', (t) => meat(t, [0x6a2a2a, 0xd07a78, 0xe89894, 0xf4b4ae, 0xffd6d0], 0xfff0ea, 0xf0ece0));
def('cooked_porkchop', (t) => meat(t, [0x3a1a0a, 0x8a4a22, 0xa8622e, 0xc4803e, 0xdca460], 0xe8c890, 0xf0ece0));
def('raw_beef', (t) => meat(t, [0x4a0a0a, 0xa01c1c, 0xc42a2a, 0xdc4a42, 0xf07a6e], 0xf8d8cc, null));
def('cooked_beef', (t) => meat(t, [0x2a1206, 0x6a3a1a, 0x864a22, 0xa2622e, 0xc08244], 0xd8b080, null));
def('raw_mutton', (t) => meat(t, [0x4a1010, 0xb03a34, 0xcc5048, 0xe06a60, 0xf49a8e], 0xf4e8dc, null));
def('cooked_mutton', (t) => meat(t, [0x2a1206, 0x7a4220, 0x96562a, 0xb06e38, 0xcc8e50], 0xe0c090, null));
function drumstick(t, pal) {
  shaded(t, ['', '..........xxxx..', '.........xxxxxx.', '........xxxxxxx.', '.......xxxxxxxx.', '.......xxxxxxxx.', '........xxxxxx..',
    '.......xxxxx....', '......xx........', '.....xx.........', '....xx..........', '...xx...........'].map((r) => r.replace(/x(?=x{0}\.{9,}$)/, 'x')), pal, {}, { outline: 'all' });
  paint(t, ['', '', '', '', '', '', '', '', '......b.........', '.....bB.........', '....bB..........', '...bB...........', '.bBb............', '.bb.............'],
    { b: 0xc8c0b0, B: 0xf4f0e6 }, { clear: false });
}
def('raw_chicken', (t) => drumstick(t, [0x6a4a3a, 0xd8a890, 0xe8bea8, 0xf4d4c0, 0xfff0e4]));
def('cooked_chicken', (t) => drumstick(t, [0x3a1e08, 0xa05e22, 0xc07a30, 0xd89a48, 0xf0c070]));
def('raw_rabbit', (t) => drumstick(t, [0x5a2a2a, 0xd08a80, 0xe4a298, 0xf2bcb2, 0xffdcd4]));
def('cooked_rabbit', (t) => drumstick(t, [0x3a1e08, 0x9a5a24, 0xb87434, 0xd0924a, 0xe8b470]));
function fish(t, pal, belly, fin) {
  t.clear();
  paint(t, ['', '', '', '', '......###.......', '....##fff##...##', '..##hhhhhhh#.#Ff', '.#hehllllllm##F#', '.#hhllllllmmddF#', '.#lllllmmmdd##F#',
    '..##bbbbbbb#.#Ff', '....#######...##'], { f: fin[0], F: fin[1], '#': pal[0], d: pal[1], m: pal[2], l: pal[3], h: pal[4], b: belly, e: 0x101010 });
}
def('cod', (t) => fish(t, [0x3a3222, 0x8a7a58, 0xaa9a72, 0xc4b690, 0xdcd0ae], 0xe4dcc4, [0x8a7a58, 0xb4a47e]));
def('cooked_cod', (t) => fish(t, [0x3a2210, 0x9a7a4a, 0xb89660, 0xd0b07a, 0xe8cc9a], 0xf0e0c0, [0x8a6a3a, 0xb08a52]));
def('salmon', (t) => fish(t, [0x3a1414, 0xa03a34, 0xbc4c42, 0xd46a5a, 0xe8907c], 0xe8b0a0, [0x6a2a24, 0x8a3a30]));
def('cooked_salmon', (t) => fish(t, [0x3a1a0a, 0xa05a2a, 0xbc7438, 0xd4924e, 0xe8b070], 0xf0d0a0, [0x7a4a22, 0x9a6230]));
// Tropical fish: a clownfish, orange with white bands; pufferfish: a spiky yellow ball.
def('tropical_fish', (t) => {
  fish(t, [0x5a1e02, 0xc85a10, 0xe8741c, 0xf8923a, 0xffb060], 0xffc890, [0xc85a10, 0xf8923a]);
  for (let y = 5; y < 12; y++) for (const x of [5, 9]) if (t.alpha(x, y)) t.set(x, y, y === 5 || y === 11 ? 0x3a1402 : 0xfafafa);
});
def('pufferfish', (t) => {
  shaded(t, ['', '', '', '.....xxxxx......', '....xxxxxxx.....', '...xxxxxxxxx..x.', '...xxxxxxxxxxxx.', '...xxxxxxxxxxxx.', '...xxxxxxxxx..x.',
    '....xxxxxxx.....', '.....xxxxx......'], [0x5a4a02, 0xb8a010, 0xd8c020, 0xf0dc40, 0xfff080], {}, { outline: 'all' });
  // Spines, a pale belly, an eye and a small mouth.
  for (const [x, y] of [[4, 2], [7, 1], [10, 2], [2, 4], [2, 9], [4, 11], [7, 12], [10, 11]]) t.set(x, y, 0xe8e0c0);
  for (let x = 5; x < 10; x++) t.set(x, 9, 0xf8f4d8);
  t.set(5, 5, 0x101010); t.set(5, 6, 0x303030); t.set(3, 7, 0xa04a2a);
});
def('rotten_flesh', (t) => {
  meat(t, [0x2e2410, 0x6a5428, 0x86703a, 0x9e8a4c, 0xb8a466], null, null);
  for (const [x, y] of [[5, 5], [6, 5], [9, 7], [4, 8], [10, 10], [8, 9]]) t.set(x, y, 0x4e6a24);
});
def('spider_eye', (t) => {
  shaded(t, ['', '', '', '', '.....xxxxxx.....', '....xxxxxxxx....', '...xxxxxxxxxx...', '...xxxxxxxxxx...', '...xxxxxxxxxx...',
    '...xxxxxxxxxx...', '....xxxxxxxx....', '.....xxxxxx.....'], [0x2a0410, 0x7a1430, 0x9a1e40, 0xba3458, 0xdc6a86], {}, { outline: 'all' });
  for (const [x, y] of [[6, 7], [7, 7], [6, 8], [9, 8]]) t.set(x, y, 0x1a0208);
});
function bowl(t, fill) {
  t.clear();
  paint(t, ['', '', '', '', '', '', '', '#iiiiiiiiiiiiii#', '#hwwwwwwwwwwwmd#', '.#hwwwwwwwwwmd#.', '.#hwwwwwwwwmmd#.', '..#hwwwwwwmmd#..',
    '...##wwwwmmd#...', '.....######.....'], { '#': 0x2e1e0e, i: fill ?? 0x4a3218, h: 0xb8905a, w: 0x9a7444, m: 0x7a5a32, d: 0x5a4022 });
  if (fill) for (let x = 2; x < 14; x += 3) t.set(x, 7, lighten(fill, 0.25));
}
def('bowl', (t) => bowl(t, null));
def('mushroom_stew', (t) => bowl(t, 0x9a6a3a));
def('beetroot_soup', (t) => bowl(t, 0xa01a2c));
def('rabbit_stew', (t) => bowl(t, 0x8a5a24));
def('cake', (t) => {
  t.clear();
  paint(t, ['', '', '', '', '....r..r..r.....', '..##########....', '.#wwwwwwwwww#...', '#wwwwwwwwwwww#..', '#cccwwcccwwcc#..', '#bbbbbbbbbbbb#..',
    '#BBBBBBBBBBBB#..', '#bbbbbbbbbbbb#..', '#BBBBBBBBBBBB#..', '.############...'], { '#': 0x5a3a1a, w: 0xf8f4ec, c: 0xe8e0d0, b: 0xd8a868, B: 0xb8864a, r: 0xd02a2a });
});

// ---------------------------------------------------------------- armour
const ARMOR = {
  helmet: ['', '', '', '....xxxxxxxx....', '...xxxxxxxxxx...', '..xxxxxxxxxxxx..', '..xxxxxxxxxxxx..', '..xxxxxxxxxxxx..',
    '..xxx......xxx..', '..xxx......xxx..', '..xx........xx..'],
  chestplate: ['', '.xxxx......xxxx.', 'xxxxxx....xxxxxx', 'xxxxxxx..xxxxxxx', 'xxxxxxxxxxxxxxxx', 'xxxxxxxxxxxxxxxx', '.xxxxxxxxxxxxxx.',
    '...xxxxxxxxxx...', '...xxxxxxxxxx...', '...xxxxxxxxxx...', '...xxxxxxxxxx...', '...xxxxxxxxxx...', '...xxxxxxxxxx...', '...xxxxxxxxxx...', '....xxxxxxxx....'],
  leggings: ['', '', '...xxxxxxxxxx...', '...xxxxxxxxxx...', '...xxxxxxxxxx...', '...xxxxxxxxxx...', '...xxxx..xxxx...', '...xxxx..xxxx...',
    '...xxxx..xxxx...', '...xxxx..xxxx...', '...xxxx..xxxx...', '...xxxx..xxxx...', '...xxxx..xxxx...', '...xxxx..xxxx...'],
  boots: ['', '', '', '', '', '', '...xxx....xxx...', '...xxx....xxx...', '...xxx....xxx...', '...xxx....xxx...', '..xxxx....xxxx..',
    '.xxxxx....xxxxx.', '.xxxxx....xxxxx.'],
};
// Details drawn over each piece: seams, rivets, a waistband.
const ARMOR_DETAIL = {
  helmet: ['', '', '', '', '....hhhhhh......', '...h.......d....', '', '..dddddddddddd..'],
  chestplate: ['', '', '', '', '.......hd.......', '.......hd.......', '', '...dddddddddd...', '', '.......hd.......', '.......hd.......', '', '', ''],
  leggings: ['', '', '', '...dddddddddd...', '', '......h..h......'],
  boots: ['', '', '', '', '', '', '', '', '', '...ddd....ddd...'],
};
for (const [mat, pal] of Object.entries(MATERIAL)) {
  if (mat === 'wooden' || mat === 'stone') continue;
  for (const [piece, rows] of Object.entries(ARMOR)) {
    def(`${mat}_${piece}`, (t) => {
      shaded(t, rows, pal, {}, { outline: 'all', grain: mat === 'leather' ? 0.2 : 0 });
      ARMOR_DETAIL[piece].forEach((row, y) => [...row].forEach((ch, x) => {
        if (ch !== '.' && t.alpha(x, y) && rows[y]?.[x] === 'x') t.set(x, y, ch === 'h' ? pal[4] : pal[1]);
      }));
      if (mat === 'chainmail') for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) if (rows[y]?.[x] === 'x' && (x + y) % 2 === 0 && t.r() < 0.7) t.set(x, y, pal[1]);
    });
  }
}

// ---------------------------------------------------------------- block items
// Doors are shown whole and narrow, as they stand.
const ICON_DOOR = {
  windows: ['#pppppp#', '#g..p..#', '#g..p..#', '#pppppp#', '#pppppp#', '#pppppp#', '#pPPPPp#', '#pp..pp#'],
  slit: ['#pppppp#', '#pp..pp#', '#pp..pp#', '#pp..pp#', '#pppppp#', '#pPPPPp#', '#pppppp#', '#pppppp#'],
  grid: ['#pppppp#', '#.p.p.p#', '#pppppp#', '#.p.p.p#', '#pppppp#', '#pPPPPp#', '#pppppp#', '#pppppp#'],
  cross: ['#pppppp#', '#..p..p#', '#pppppp#', '#..p..p#', '#pppppp#', '#pPPPPp#', '#pppppp#', '#pppppp#'],
  diamond: ['#pppppp#', '#ppp.pp#', '#pp...p#', '#ppp.pp#', '#pppppp#', '#pPPPPp#', '#pppppp#', '#pppppp#'],
  panel: ['#pppppp#', '#pPPPPp#', '#pP..Pp#', '#pPPPPp#', '#pppppp#', '#pPPPPp#', '#pppppp#', '#pppppp#'],
  round: ['#pppppp#', '#pp..pp#', '#p....p#', '#pp..pp#', '#pppppp#', '#pPPPPp#', '#pppppp#', '#pppppp#'],
};
for (const [name, w] of Object.entries(WOODS)) {
  def(`${name}_door_item`, (t) => {
    t.clear();
    const rows = ICON_DOOR[DOOR_STYLE[name]], pal = w.planks;
    for (let y = 0; y < 16; y++) for (let x = 0; x < 8; x++) {
      const ch = rows[Math.min(7, Math.floor(y / 2))][x];
      if (ch === '.') continue;
      const c = ch === '#' || y === 0 || y === 15 ? pal[0] : ch === 'P' ? pal[5] : pal[2 + ((x + y * 3) % 3)];
      t.set(x + 4, y, c);
    }
    t.set(10, 9, 0x3a3a3a); t.set(10, 10, 0x7a7a7a);
  });
}
// Boats: the hull side-on in its wood's planks (a board to each row, the joints staggered), the
// dark inside showing over the gunwale, and an oar resting across it.
const BOAT = ['', '', '', '', '', '............wW..', '...........wW...', '#.........wW...#', '#h.......wW...h#', '#hiiiiiiwWiiiih#',
  '#llllllllllllll#', '.#llllllllllll#.', '..#mmmmmmmmmm#..', '...#dddddddd#...', '....########....'];
for (const [name, w] of Object.entries(WOODS)) {
  def(`${name}_boat`, (t) => {
    const p = w.planks;
    const joint = (x, y) => (x + y * 5) % 7 === 0;
    paint(t, BOAT, { '#': p[0], h: p[4], i: p[0], w: H.W, W: H.w,
      l: (x, y) => (y === 10 ? p[5] : joint(x, y) ? p[2] : p[4 - (y - 10)]), m: (x, y) => (joint(x, y) ? p[1] : p[2]), d: p[1] });
  });
}
def('bed_item', (t) => {
  t.clear();
  paint(t, ['', '', '', '', '', '', '.#############..', '#wwwwrrrrrrrrr#.', '#WwwwrrrrrrrrrR#', '#RRRRRRRRRRRRRR#', '#bbbbbbbbbbbbbb#',
    '#b#..........#b#', '###..........###'], { '#': 0x2a1a0e, w: 0xf2f2ec, W: 0xd4d4cc, r: 0xb83226, R: 0x8a2018, b: 0xa68351 });
});
def('lantern_item', (t) => {
  t.clear();
  paint(t, ['', '', '......##........', '.....#..#.......', '......##........', '.....####.......', '....#kkkk#......', '....#ylly#......',
    '....#yYYy#......', '....#yYYy#......', '....#oooo#......', '....#kkkk#......', '.....####.......'].map((r) => '..' + r.slice(0, 14)),
  { '#': 0x2c2e33, k: 0x4a4d54, y: 0xf6c060, Y: 0xfff0b0, l: 0xffe8a0, o: 0xe8902e });
});
def('campfire_item', (t) => {
  t.clear();
  paint(t, ['', '', '', '', '.......f........', '......fFf.......', '.....fFYFf......', '....fFYYYFf.....', '....fYYWYYf.....', '..bbbbbbbbbbbb..',
    '..BBBBBBBBBBBB..', '.bbbbbbbbbbbbbb.', '.BBBBBBBBBBBBBB.', '..eeeeeeeeeeee..'],
  { f: 0xd84a10, F: 0xf08a20, Y: 0xffc840, W: 0xfff4c0, b: 0x6a5231, B: 0x3f301c, e: 0x2a2a2a });
});

// Glass bottles and potions: a round flask with a cork, the liquid in the potion's colour (lit
// top left, darker to the bottom right) behind a glint on the glass. Splash potions come in a
// squatter, wider flask with a flared neck.
const FLASK = ['', '......####......', '......#cc#......', '......#CC#......', '.....##gg##.....', '......#gg#......', '.....#gLLg#.....',
  '....#gLLLLg#....', '...#gLLLLLLg#...', '...#LhLLLLLL#...', '...#LhLLLLLL#...', '...#LLLLLLLL#...', '...#LLLLLLLL#...', '....#LLLLLL#....',
  '.....######.....'];
const SPLASH = ['', '', '......####......', '......#cc#......', '.....#gggg#.....', '......#gg#......', '.....#gLLg#.....', '...##gLLLLg##...',
  '..#gLLLLLLLLg#..', '..#LhLLLLLLLL#..', '..#LhLLLLLLLL#..', '..#LLLLLLLLLL#..', '..#LLLLLLLLLL#..', '...#LLLLLLLL#...', '....########....'];
function flask(t, rows, liquid) {
  t.clear();
  const glass = 0xd6e2ea;
  paint(t, rows, {
    '#': 0x2b2d3a, c: 0x9a6a34, C: 0x6e4822, g: glass, h: 0xf4f8fc,
    // Empty, the glass shows the light through it; full, the potion, shaded across the flask.
    L: (x, y) => (liquid === null ? ((x + y) % 5 === 0 ? 0xeef4f8 : 0xc4d2dc)
      : (x + y < 14 ? mix(liquid, 0xffffff, 0.22) : x + y > 19 ? shade(liquid, 0.62) : liquid)),
  });
}
def('glass_bottle', (t) => flask(t, FLASK, null));
for (const [name, p] of Object.entries(POTIONS)) {
  def(`potion_${name}`, (t) => flask(t, FLASK, p.colour));
  def(`splash_potion_${name}`, (t) => flask(t, SPLASH, p.colour));
}
// Phantom membrane: a torn, grey-violet scrap of skin.
def('phantom_membrane', (t) => {
  t.clear();
  paint(t, ['', '', '...##...........', '..#mm##.....##..', '..#mMmm#...#mm#.', '...#mMMm###mMm#.', '...#mmMMmmmMmm#.', '....#mmMMMMmm#..',
    '....#mmmMMmmm#..', '...#mmmmmMmmm#..', '...#mm##mmMmm#..', '..#m#..#mmmm#...', '..##....#mm#....', '.........##.....'],
  { '#': 0x3a3448, m: 0x8c86a0, M: 0xb8b2c8 });
});
