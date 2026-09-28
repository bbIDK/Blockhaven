// The Update 27 textures: sweet berry bushes, cocoa pods, bee nests and beehives, honey,
// scaffolding, armor stands and banners. The game takes most from Pixel Perfection (see
// tools/texture-sources.mjs); these drawings are the fallback, in their colours. The banners held
// in the hand are drawn here (the packs have none): a cloth of the banner's colour hanging from its
// wooden bar. (The patterns on a banner are drawn over its cloth: see banners.js.)
import { def, shaded, paint, mix, ramp } from './core.js';
import { DYES } from '../colors.js';

// ---------------------------------------------------------------- sweet berry bushes
// A low tuft of leaves, bushier as it grows, with berries on it from the third stage (few and
// green-red, then many and ripe).
const LEAF = [0x1e4a24, 0x2c6a30, 0x3c8a3c, 0x5aa84a];
function bush(t, stage) {
  t.clear();
  const top = [12, 7, 4, 3][stage], spread = [3, 5, 7, 7][stage];
  for (let y = top; y < 16; y++) for (let x = 8 - spread; x < 8 + spread; x++) {
    const r = t.r(), edge = Math.abs(x + 0.5 - 8) / spread + (15.5 - y < 1 ? 0.3 : 0) + (y - top < 2 ? 0.35 : 0);
    if (r > 0.25 + edge * 0.55) t.set(x, y, LEAF[Math.min(3, Math.floor(t.r() * 3 + (y < 9 ? 1 : 0)))]);
  }
  if (stage < 2) return;
  const n = stage === 2 ? 4 : 9;
  for (let k = 0; k < n; k++) {
    const x = 3 + t.ri(10), y = top + 2 + t.ri(14 - top - 2);
    t.set(x, y, stage === 2 ? 0x9a3a2a : 0xc02028);
    if (stage === 3) t.set(x, y - 1, 0xe04848);
  }
}
[0, 1, 2, 3].forEach((s) => def(`sweet_berry_bush_${s}`, (t) => bush(t, s)));

// ---------------------------------------------------------------- cocoa pods
// (Cookies, made with cocoa beans, have been drawn since the release update: see items.js.)
// Laid out the way Minecraft lays out a pod's model (see blocks.js): its top in the corner, its
// sides beside it, and the stem at the top right. Green, then orange, then ripe brown.
const POD = [[0x3a6a1a, 0x5a8a2a, 0x7aa83a], [0x8a4a14, 0xb86a24, 0xd88a38], [0x5a2a14, 0x7a3a1e, 0x9a5028]];
const POD_SIZE = [[4, 5], [6, 7], [8, 9]]; // [width, height]
const POD_SIDE = [11, 9, 3];               // where each stage's sides start (x); they start at y 4
[0, 1, 2].forEach((age) => def(`cocoa_${age}`, (t) => {
  t.clear();
  const pal = POD[age], [w, h] = POD_SIZE[age], x0 = POD_SIDE[age];
  for (let y = 0; y < w - 1; y++) for (let x = 0; x < w - 1; x++) t.set(x, y, pal[1]);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) t.set(x0 + x, 4 + y, pal[(x + y) % 3 === 0 ? 2 : y > h - 3 ? 0 : 1]);
  for (let k = 0; k < 4; k++) t.set(12 + k, 3 - k, 0x5a3a1c);
}));
def('cocoa_beans', (t) => {
  shaded(t, ['', '', '', '.....xx.........', '....xxxx..xx....', '....xxxx.xxxx...', '.....xx..xxxx...', '..xx......xx....', '.xxxx..xx.......',
    '.xxxx.xxxx......', '..xx..xxxx...xx.', '.......xx...xxxx', '............xxxx', '.............xx.'], [0x1e0e06, 0x3e200e, 0x5e3218, 0x7e4824, 0x9a6034]);
});
def('sweet_berries', (t) => {
  paint(t, ['', '', '', '......gg........', '.....gGgg.......', '....g.bb.gg.....', '...rr.b..rr.....', '..rRRr..rRRr....', '..rRrr..rrrr....',
    '...rr....rr.rr..', '.........brRRr..', '..........rrrr..', '...........rr...'], { g: 0x2c6a30, G: 0x4a9a3a, b: 0x5a3a1c, r: 0xa01822, R: 0xe04848 });
});

// ---------------------------------------------------------------- bees' homes and honey
// A bee nest is a knot of yellow comb-wax; a beehive, planks. The front has the bees' way in, and
// honey dripping out of it once the hive is full.
const WAX = ramp(0xd8b050, 5, 0.25, 12), PLANK = ramp(0x9a7244, 5, 0.25, 10);
function planks(t, pal, rows = 4) {
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
    const seam = y % rows === rows - 1, grain = t.r();
    t.set(x, y, seam ? pal[0] : grain < 0.15 ? pal[1] : grain > 0.85 ? pal[3] : pal[2]);
  }
}
function hole(t, x, y, w, h) { for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) t.set(x + i, y + j, j === 0 ? 0x1a1208 : 0x2a1c10); }
function drips(t) { for (const [x, y, n] of [[5, 9, 3], [6, 9, 1], [10, 9, 2], [11, 9, 4]]) for (let k = 0; k < n; k++) t.set(x, y + k, k === n - 1 ? 0xf8b828 : 0xe8981c); }
def('bee_nest_side', (t) => planks(t, WAX, 5));
def('bee_nest_front', (t) => { planks(t, WAX, 5); hole(t, 6, 6, 4, 3); });
def('bee_nest_front_honey', (t) => { planks(t, WAX, 5); hole(t, 6, 6, 4, 3); drips(t); });
def('bee_nest_top', (t) => { t.fill(WAX[2]); for (let r = 2; r < 8; r += 2) for (let k = r; k < 16 - r; k++) { t.set(k, r, WAX[0]); t.set(k, 15 - r, WAX[0]); t.set(r, k, WAX[0]); t.set(15 - r, k, WAX[0]); } });
def('bee_nest_bottom', (t) => { t.fill(WAX[1]); for (let r = 3; r < 8; r += 3) for (let k = r; k < 16 - r; k++) { t.set(k, r, WAX[0]); t.set(k, 15 - r, WAX[0]); t.set(r, k, WAX[0]); t.set(15 - r, k, WAX[0]); } });
def('beehive_side', (t) => planks(t, PLANK));
def('beehive_front', (t) => { planks(t, PLANK); hole(t, 4, 7, 8, 2); });
def('beehive_front_honey', (t) => { planks(t, PLANK); hole(t, 4, 7, 8, 2); drips(t); });
def('beehive_end', (t) => { planks(t, PLANK); for (let k = 0; k < 16; k++) { t.set(k, 0, PLANK[0]); t.set(0, k, PLANK[0]); t.set(k, 15, PLANK[0]); t.set(15, k, PLANK[0]); } });
// Honey: a clear, deep amber block (the comb block is solid wax cells).
const HONEY = [0xc87010, 0xe08a14, 0xf0a020, 0xf8bc3c];
for (const face of ['side', 'top', 'bottom']) {
  def(`honey_block_${face}`, (t) => {
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
      const edge = x === 0 || y === 0 || x === 15 || y === 15;
      t.set(x, y, edge ? HONEY[0] : HONEY[1 + Math.floor(t.r() * 2.2)], edge ? 230 : 190);
    }
  });
}
def('honeycomb_block', (t) => {
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
    const row = Math.floor(y / 4), cx = (x + (row % 2) * 2) % 4, cy = y % 4;
    t.set(x, y, cx === 0 || cy === 0 ? HONEY[0] : cy === 1 && cx === 1 ? HONEY[3] : HONEY[2]);
  }
});
def('honeycomb', (t) => {
  shaded(t, ['', '', '', '.....xxxxx......', '....xxxxxxx.....', '...xxxxxxxxx....', '...xxxxxxxxxx...', '..xxxxxxxxxxx...', '..xxxxxxxxxxx...',
    '...xxxxxxxxxx...', '...xxxxxxxxx....', '....xxxxxxx.....', '.....xxxxx......'], [0x8a4a08, 0xc87010, 0xe08a14, 0xf0a020, 0xf8c850],
  {}, { outline: 'all' });
  for (const [x, y] of [[5, 6], [8, 5], [10, 8], [6, 10], [9, 11]]) t.set(x, y, 0xc87010);
});
def('honey_bottle', (t) => {
  paint(t, ['', '.......cc.......', '......wccw......', '.......ww.......', '.......gg.......', '......g..g......', '.....g....g.....', '....gHhhhhhg....',
    '....ghhhhhhg....', '....ghhhhhhg....', '....ghhhhhhg....', '....ghhhhhHg....', '.....ghhhhg.....', '......gggg......'],
  { c: 0x8a5a2a, w: 0xc89a5a, g: 0xd8e8f0, h: 0xf0a020, H: 0xfcd060 });
});

// ---------------------------------------------------------------- scaffolding
// Bamboo poles lashed into a frame: open sides with two rails across, and planks along the top.
const CANE = [0x7a6a28, 0xa89040, 0xc8b058, 0xe0c878];
function frame(t, rails) {
  t.clear();
  for (let k = 0; k < 16; k++) for (const w of [0, 1]) { t.set(k, w, CANE[w + 1]); t.set(k, 15 - w, CANE[w + 1]); t.set(w, k, CANE[w + 2]); t.set(15 - w, k, CANE[w + 1]); }
  for (const y of rails) for (let x = 2; x < 14; x++) { t.set(x, y, CANE[2]); t.set(x, y + 1, CANE[1]); }
}
def('scaffolding_side', (t) => frame(t, [5, 10]));
def('scaffolding_bottom', (t) => frame(t, []));
def('scaffolding_top', (t) => {
  frame(t, []);
  for (let y = 2; y < 14; y++) for (let x = 2; x < 14; x++) if (x % 4 !== 1) t.set(x, y, x % 4 === 0 ? CANE[1] : CANE[3]);
});

// ---------------------------------------------------------------- armor stands
def('armor_stand', (t) => {
  paint(t, ['', '.......hh.......', '.......hh.......', '...ssssssssss...', '...s...hh...s...', '...s...hh...s...', '...s..bhhb..s...', '......bhhb......',
    '......bhhb......', '.....wwwwww.....', '......l..l......', '......l..l......', '......l..l......', '......l..l......', '..pppppppppppp..', '..PPPPPPPPPPPP..'],
  { h: 0xb08050, s: 0xc89460, b: 0x9a6a3c, w: 0xa8784a, l: 0xb08050, p: 0xa8a8a8, P: 0x7a7a7a });
});

// ---------------------------------------------------------------- banner patterns
function paper(t, ink, rows) {
  paint(t, ['', '', '..pppppppppppp..', '..pPPPPPPPPPPp..', '..pP........Pp..', '..pP........Pp..', '..pP........Pp..', '..pP........Pp..',
    '..pP........Pp..', '..pP........Pp..', '..pP........Pp..', '..pPPPPPPPPPPp..', '..pppppppppppp..'], { p: 0xc8b890, P: 0xf0e8d0, '.': null });
  for (let y = 4; y < 11; y++) for (let x = 4; x < 12; x++) t.set(x, y, 0xf0e8d0);
  rows.forEach((row, y) => { for (let x = 0; x < row.length; x++) if (row[x] === 'x') t.set(4 + x, 4 + y, ink); });
}
def('flower_banner_pattern', (t) => paper(t, 0x8a7a5a, ['..x..x..', '.xxxxxx.', 'xxx..xxx', '.xx..xx.', 'xxx..xxx', '.xxxxxx.', '..x..x..']));
def('globe_banner_pattern', (t) => paper(t, 0x5a6a8a, ['..xxxx..', '.x.xx.x.', 'xxx..x.x', 'x.xxx.xx', 'xx..xxxx', '.x.xx.x.', '..xxxx..']));

// ---------------------------------------------------------------- banners (held)
// A banner as it's held: its cloth, in the dye's colour and lit from the top left, hanging from a
// wooden bar. The cloth is the rectangle BANNER_CLOTH (x0, y0, x1, y1), where the inventory's icons
// draw a banner's patterns (see icons.js).
export const BANNER_CLOTH = [4, 1, 12, 16];
DYES.forEach((d) => def(`${d.name}_banner`, (t) => {
  t.clear();
  const [x0, y0, x1, y1] = BANNER_CLOTH;
  for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
    const light = (x === x0 ? 0.12 : x === x1 - 1 ? -0.16 : 0) + (x % 3 === 1 ? -0.05 : 0) - (y - y0) * 0.006;
    t.set(x, y, light >= 0 ? mix(d.dye, 0xffffff, light) : mix(d.dye, 0x000000, -light));
  }
  for (let x = x0 - 1; x <= x1; x++) t.set(x, 0, x === x0 - 1 || x === x1 ? 0x5a3e22 : 0x9a7244);
}));
