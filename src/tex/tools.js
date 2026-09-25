// Tools and weapons, in Minecraft's shapes: a two-pixel wooden handle running up from the bottom
// left corner, outlined on both sides, with the head at its top right. Every material shares the
// shapes and only swaps colours, taken from the block it's made of (oak planks, cobblestone, iron,
// gold and diamond). Heads are shaded by hand: the highlight on their top-left edges, shadow on
// their bottom-right ones, and a full dark outline, like the rest of the pack.
import { def, part, form } from './core.js';

// [outline, darkest, dark, mid, light, highlight]
export const TOOL_PAL = {
  wooden: [0x3b2710, 0x6a5230, 0x88693d, 0xa68351, 0xbc9860, 0xd4b27a],
  stone: [0x2a2a2a, 0x505050, 0x686868, 0x808080, 0x9a9a9a, 0xb8b8b8],
  iron: [0x343438, 0x7c7c82, 0xa4a4aa, 0xc6c6ca, 0xe2e2e4, 0xffffff],
  golden: [0x5a3204, 0xa86a0c, 0xd4961a, 0xf0c02c, 0xfadd5c, 0xfff6b0],
  diamond: [0x0a4244, 0x168a8a, 0x2abebb, 0x4cdcd4, 0x8cf2ea, 0xdcfffa],
};
// The handle: [outline, dark, light, highlight].
export const HANDLE = [0x2a1c0c, 0x6e4f28, 0xa07a44, 0xc49a5a];

// A handle from the bottom-left corner up to row `top`: the lit pixel on the upper left of each
// step, the shaded one below right.
function handleRows(top, end = 14) {
  const rows = Array.from({ length: 16 }, () => '................'.split(''));
  for (let y = end; y >= top; y--) {
    rows[y][15 - y] = y === end ? 'b' : 'a';
    rows[y][16 - y] = 'b';
  }
  return rows.map((r) => r.join(''));
}

// Heads: masks. 'x' is shaded by where it faces (lit on its top-left edges, shadowed on its
// bottom-right ones); digits 1 (darkest) to 5 (highlight) set a pixel's tone by hand. `top`: the
// row the handle reaches up to (it runs on under the head).
const SHAPES = {
  pickaxe: { top: 5, rows: [
    '................',
    '.....44554......',
    '...443222344....',
    '..432....2334...',
    '..32.......333..',
    '............42..',
    '............332.',
    '.............52.',
    '.............42.',
    '.............42.',
    '.............32.',
    '............42..',
    '...........321..',
    '...........21...'] },
  axe: { top: 2, rows: [
    '................',
    '.....5443.......',
    '....554433......',
    '...554433322....',
    '...54433222..32.',
    '....433221..32..',
    '......221.......'] },
  shovel: { top: 7, rows: [
    '................',
    '...........45...',
    '..........4553..',
    '.........455432.',
    '.........453322.',
    '.........43221..',
    '..........321...',
    '..........2.....'] },
  hoe: { top: 5, rows: [
    '................',
    '.....xxxx.......',
    '....x55xxxx.....',
    '....xx..xxxxx...',
    '....x......xxx..',
    '............xx..'] },
};

// The sword is drawn out in full: blade (its lit edge, middle and shaded edge), the crossguard,
// the grip and the pommel.
const SWORD = [
  '................',
  '.............54.',
  '............543.',
  '...........543..',
  '..........543...',
  '.........543....',
  '........543.....',
  '...gG..543......',
  '....gG543.......',
  '.....gG3........',
  '....abgG........',
  '...ab..gG.......',
  '..ab....g.......',
  '.pP.............',
  '.PQ.............'];

const GRAIN = { wooden: 0.2, stone: 0.3 };

function tool(t, kind, mat) {
  t.clear();
  const s = SHAPES[kind], pal = TOOL_PAL[mat];
  part(t, handleRows(s.top), { a: HANDLE[2], b: HANDLE[1] }, HANDLE[0]);
  form(t, s.rows, pal, { grain: GRAIN[mat] ?? 0 });
}
function sword(t, mat) {
  t.clear();
  const pal = TOOL_PAL[mat];
  part(t, SWORD, { 1: pal[1], 2: pal[2], 3: pal[3], 4: pal[4], 5: pal[5], g: pal[2], G: pal[4], a: HANDLE[2], b: HANDLE[1], p: pal[5], P: pal[3], Q: pal[2] }, pal[0]);
}

for (const mat of Object.keys(TOOL_PAL)) {
  for (const kind of Object.keys(SHAPES)) def(`${mat}_${kind}`, (t) => tool(t, kind, mat));
  def(`${mat}_sword`, (t) => sword(t, mat));
}
def('stick', (t) => { t.clear(); part(t, handleRows(2, 13), { a: HANDLE[2], b: HANDLE[1] }, HANDLE[0]); });

// ---------------------------------------------------------------- the rest of the kit
const STEEL = TOOL_PAL.iron, FLINT = [0x141416, 0x2c2c30, 0x3e3e44, 0x54545c, 0x6e6e78, 0x9090a0];

// A bow: a curved wooden limb bowed out to the top left, wrapped in leather at the grip, and a
// taut string along the diagonal between its tips.
def('bow', (t) => {
  t.clear();
  const rows = Array.from({ length: 16 }, () => Array(16).fill('.'));
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
    const dx = x + 0.5 - 10.1, dy = y + 0.5 - 10.1, d = Math.hypot(dx, dy);
    if (x + y > 14) continue;
    if (d >= 7.7 && d <= 9.5) rows[y][x] = Math.abs(x - y) <= 1 ? (d > 8.6 ? 'G' : 'g') : d > 8.6 ? 'a' : 'b';
  }
  part(t, rows.map((r) => r.join('')), { a: HANDLE[2], b: HANDLE[1], g: 0x3e2a1c, G: 0x6a4630 }, HANDLE[0]);
  for (let x = 3; x <= 12; x++) if (!t.alpha(x, 15 - x)) t.set(x, 15 - x, x % 3 ? 0xe4e4e8 : 0xbcbcc4);
});

// An arrow: a flint head, a wooden shaft and white fletching.
def('arrow', (t) => {
  t.clear();
  part(t, [
    '................',
    '................',
    '............5...',
    '..........45F...',
    '...........4FF..',
    '..........s..F..',
    '.........s......',
    '........s.......',
    '.......s........',
    '......s.........',
    '..w..s..........',
    '..Wws...........',
    '...WW...........',
    '..W..w..........',
    '................'], { 5: FLINT[5], 4: FLINT[4], F: FLINT[2], s: HANDLE[2], w: 0xf4f4f4, W: 0xc8c8cc }, 0x1a1a1c);
});

// A fishing rod: a thin rod with a cork grip, its line hanging from the tip to a hook.
function rod(t, cast) {
  t.clear();
  part(t, [
    '................',
    '............a...',
    '...........ab...',
    '..........ab....',
    '.........ab.....',
    '........ab......',
    '.......ab.......',
    '......ab........',
    '.....ab.........',
    '....ab..........',
    '...gG...........',
    '..gG............',
    '.gG.............',
    '.G..............'], { a: HANDLE[2], b: HANDLE[1], g: 0x9a6a3a, G: 0x6a4424 }, HANDLE[0]);
  const line = 0xd8d8dc;
  if (cast) { t.set(14, 0, line); t.set(15, 0, line); return; }
  for (let y = 2; y <= 11; y++) t.set(14, y, line);
  for (const [x, y, c] of [[14, 12, 0x9a9aa0], [13, 13, 0x9a9aa0], [12, 12, 0x9a9aa0], [12, 11, 0xc8c8cc]]) t.set(x, y, c);
}
def('fishing_rod', (t) => rod(t, false));
def('fishing_rod_cast', (t) => rod(t, true));

// Shears: closed steel blades pointing up and right, riveted where the two handles part and
// curl round into loops.
def('shears', (t) => {
  t.clear();
  part(t, [
    '................',
    '.............5..',
    '............54..',
    '...........543..',
    '..........543...',
    '.........543....',
    '........543.....',
    '.......r43......',
    '......d..d......',
    '.....d....d.....',
    '...dDd....dDd...',
    '..d..d....d..d..',
    '..d..d....d..d..',
    '...dd......dd...'], { 5: STEEL[5], 4: STEEL[4], 3: STEEL[3], r: 0xf0d060, d: 0x4a4a54, D: 0x6a6a76 }, 0x16161a);
});

// Flint and steel: a C-shaped steel striker and a knapped piece of flint.
def('flint_and_steel', (t) => {
  t.clear();
  part(t, [
    '................',
    '................',
    '...455543.......',
    '..45....32......',
    '..4.............',
    '..3.............',
    '..32....21......',
    '...3222211......',
    '................',
    '..........ff....',
    '.........fFFf...',
    '........fFFfff..',
    '........ffffdd..',
    '.........fddd...'], { 5: STEEL[5], 4: STEEL[4], 3: STEEL[3], 2: STEEL[2], 1: STEEL[1], F: FLINT[5], f: FLINT[3], d: FLINT[2] }, 0x16161a);
});
