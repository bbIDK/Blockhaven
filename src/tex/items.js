// Item textures. Every item is a hand-drawn 16x16 shape shaded by the same rule (see `shaded`
// in core.js): lit from the top left, darker to the bottom right, with a dark outline on the
// shadow side. Tools share their shapes across materials and only swap palettes.
import { def, shaded, paint, mix, shade } from './core.js';
import { POTIONS } from '../potions.js';

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

// ---------------------------------------------------------------- materials
const blob = (rows) => rows;
// Lumps of coal and raw ore: knobbly, outlined all round.
const LUMP = blob([
  '', '', '', '.....xxx........', '...xxxxxxx......', '..xxxxxxxxxx....', '..xxxxxxxxxxx...', '.xxxxxxxxxxxx...',
  '.xxxxxxxxxxxx...', '..xxxxxxxxxxx...', '..xxxxxxxxxx....', '...xxxxxxxx.....', '.....xxxx.......']);
function lump(t, rows, pal, specks) {
  shaded(t, rows, pal, {}, { outline: 'all', grain: 0.25 });
  for (const [x, y, k] of specks) if (t.alpha(x, y)) t.set(x, y, pal[k]);
}
def('coal', (t) => lump(t, LUMP, [0x0a0a0a, 0x1e1e1e, 0x2d2d2d, 0x424242, 0x5c5c5c], [[5, 6, 4], [9, 9, 3], [4, 10, 1]]));
def('charcoal', (t) => lump(t, LUMP, [0x100b07, 0x291d13, 0x3a2a1c, 0x503b28, 0x6a5038], [[5, 6, 4], [9, 9, 3], [4, 10, 1]]));
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
def('brick', (t) => {
  t.clear();
  paint(t, ['', '', '', '', '', '........####....', '......##hhl#....', '....##hhllmd#...', '..##hllllmmd#...', '.#hlllllmmd#....',
    '.#llllmmmd#.....', '.#mmmmddd#......', '..#######.......'], { '#': 0x3a150c, d: 0x7a2e1c, m: 0x9a3e26, l: 0xba5234, h: 0xd87050 });
});
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





// The rod once it's cast: the line runs out from the tip instead of hanging down it.

// The float on the end of a line: red over white, with a quill on top (see fishing.js).
def('fishing_bobber', (t) => {
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
    const edge = x === 0 || x === 15;
    t.set(x, y, y < 8 ? (edge || y === 0 ? 0x8a1010 : x < 5 ? 0xf04030 : 0xd02418) : (edge || y === 15 ? 0xa8a8a8 : x < 5 ? 0xffffff : 0xe8e8e8));
  }
});

// A name tag: a card tag, pointed at one end, on a loop of string.
// A lead: a coil of rope with its end hanging loose.
const ROPE = [0x2e1c0c, 0x7a5430, 0xa87c48, 0xcaa068];
// The rope itself, as it's drawn between a creature and whoever holds it (twisted strands).
def('lead_rope', (t) => {
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) t.set(x, y, ROPE[(x + y) % 4 < 2 ? 3 : 2]);
});

// A shield: oak boards in an iron rim, with an iron boss in the middle.

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
// ---------------------------------------------------------------- bottles
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
