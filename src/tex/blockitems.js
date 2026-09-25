// Blocks that are carried as pictures, drawn after Minecraft's own: the ladder and the iron bars
// (their block textures are the pictures too), the sign, the bed, the lantern, the campfire and
// the lever. Like the other items they're outlined all round and lit from the top left.
import { def, part } from './core.js';
import { WOODS } from './terrain.js';

const OAK = WOODS.oak.planks;

// ---------------------------------------------------------------- ladder
// Two rails with rungs nailed across them every four pixels; the rungs run in front of the rails
// and stick out a pixel past them, and the rails show only between rungs (shaded just under one).
def('ladder', (t) => {
  t.clear();
  for (let y = 0; y < 16; y++) {
    const k = y % 4;
    if (k === 1 || k === 2) {
      for (let x = 1; x <= 14; x++) {
        const end = x === 1 || x === 14;
        let c = k === 1 ? (end ? OAK[3] : OAK[t.r() < 0.35 ? 4 : 5]) : (end ? OAK[1] : OAK[t.r() < 0.35 ? 1 : 2]);
        // Nails where the rung crosses each rail.
        if (k === 1 && (x === 3 || x === 12)) c = OAK[2];
        if (k === 2 && (x === 3 || x === 12)) c = OAK[0];
        t.set(x, y, c);
      }
    } else {
      const shaded = k === 3;
      for (const x of [2, 12]) { t.set(x, y, shaded ? OAK[2] : OAK[4]); t.set(x + 1, y, shaded ? OAK[0] : OAK[1]); }
    }
  }
});

// ---------------------------------------------------------------- iron bars
// Three upright bars, joined in turn by bent cross-pieces (the middle ones reach the edges, so a
// row of bars links up).
const BAR = [0x505056, 0x74747a, 0xa2a2a8, 0xc6c6ca, 0xe4e4e8];
def('iron_bars', (t) => {
  t.clear();
  const cross = (y, x0, x1) => {
    for (let x = x0; x <= x1; x++) { t.set(x, y, BAR[x === x0 ? 4 : 3]); t.set(x, y + 1, BAR[x === x1 ? 0 : 1]); }
  };
  for (let y = 0; y < 16; y++) for (const x of [2, 7, 12]) { t.set(x, y, BAR[3]); t.set(x + 1, y, BAR[1]); }
  cross(3, 2, 8);
  cross(11, 7, 13);
  cross(7, 0, 3);
  cross(7, 12, 15);
  // Where a cross-piece bends round a bar, the bar's lit edge carries on over it.
  for (const [x, y] of [[2, 3], [7, 11], [12, 7], [2, 7]]) t.set(x, y, BAR[4]);
});

// ---------------------------------------------------------------- sign
// A board with writing on it, on a post. The board's grain runs across it.
const SIGN_DARK = 0x3a2a16, INK = 0x4a3820;
def('sign_item', (t) => {
  t.clear();
  const grain = t.field([[8, 1, 0.6], [4, 1, 0.3]], 0.2);
  part(t, [
    '................',
    '................',
    '.55555555555555.',
    '.4gggggggggggg3.',
    '.4gggggggggggg3.',
    '.4gggggggggggg3.',
    '.4gggggggggggg3.',
    '.4gggggggggggg3.',
    '.4gggggggggggg3.',
    '.22222222222222.',
    '.......ab.......',
    '.......ab.......',
    '.......ab.......',
    '.......ab.......',
    '.......ab.......'],
  { 5: OAK[5], 4: OAK[4], 3: OAK[2], 2: OAK[1], g: (x, y) => OAK[grain[y * 16 + x] < 0.5 ? 3 : 4], a: OAK[4], b: OAK[1] }, SIGN_DARK);
  // Two lines of writing: words along each line, with the odd tall letter.
  for (const [x0, x1, y] of [[3, 5, 4], [7, 10, 4], [12, 13, 4], [3, 6, 7], [8, 9, 7], [11, 12, 7]]) for (let x = x0; x <= x1; x++) t.set(x, y, INK);
  for (const [x, y] of [[3, 3], [8, 3], [13, 3], [6, 6], [8, 6], [11, 6]]) t.set(x, y, INK);
});

// ---------------------------------------------------------------- bed
// Seen from above its foot: the pillow at the far end, the red blanket turned down under it, the
// blanket hanging over the foot and the side, the wooden frame and legs.
def('bed_item', (t) => {
  t.clear();
  part(t, [
    '................',
    '................',
    '.......WWWWWWW..',
    '......WWwwwwwvv.',
    '.....aRRRRRRRRS.',
    '....arrrrrrrRSS.',
    '...arrrrrrrRSSM.',
    '..arrrrrrrRSSMn.',
    '.arrrrrrrRSSM.n.',
    '.ssssssssSSM....',
    '.ssssssssSM.....',
    '.mmmmmmmmMM.....',
    '.nn.....nn......',
    '.nn.....nn......'],
  { W: 0xffffff, w: 0xe4e4e8, v: 0xb4b4bc, a: 0xe24a3e, r: 0xc2342c, R: 0x9a2620, s: 0xa22820, S: 0x6e1814, m: 0xa07a48, M: 0x6c5030, n: 0x4e3a22 },
  0x2a100c);
});

// ---------------------------------------------------------------- lantern
// A small iron lantern hanging from its hook: a cap and a copper band over a cage of glass with
// the flame glowing inside (brightest low in the middle).
const LAMP = [0x1c1e26, 0x3a3f4c, 0x565e70, 0x7a8498];
def('lantern_item', (t) => {
  t.clear();
  part(t, [
    '................',
    '................',
    '................',
    '................',
    '................',
    '......KKkk......',
    '......pPPp......',
    '.....KKkkkk.....',
    '.....f1223f.....',
    '.....f2345f.....',
    '.....f3455f.....',
    '.....f2454f.....',
    '.....f1233f.....',
    '.....kkkkkk.....'],
  { K: LAMP[3], k: LAMP[2], f: LAMP[1], p: 0x7a4428, P: 0xa4643a, 1: 0xa04a1a, 2: 0xd8782c, 3: 0xf0a646, 4: 0xf8d470, 5: 0xfff4c0 }, LAMP[0]);
  // The hook it hangs by.
  for (const [x, y] of [[8, 1], [7, 2], [9, 2], [7, 3], [9, 3], [8, 4]]) t.set(x, y, LAMP[0]);
  t.set(8, 2, LAMP[2]);
});

// ---------------------------------------------------------------- campfire
// Logs laid round a fire, two from the sides and one across the front, and the flames rising out
// of the glowing embers between them.
def('campfire_item', (t) => {
  t.clear();
  // Flames first, with a dark red edge rather than a black one.
  part(t, [
    '................',
    '........f.......',
    '.......ff.......',
    '.......fof......',
    '......fooff.....',
    '.....ffoyof.....',
    '.....foyyof.....',
    '....ffoyWyoff...',
    '....foyWWyof....',
    '....foyWWyof....',
    '....eeyyyyee....'],
  { f: 0xc8420a, o: 0xf07a14, y: 0xf8c838, W: 0xfff4c0, e: 0xff9a2a }, 0x7a1e04);
  // Then the logs over the bottom of it: one from each side, one across the front.
  part(t, [
    '................',
    '................',
    '................',
    '................',
    '................',
    '................',
    '................',
    '................',
    '................',
    '..LLLL....LLLL..',
    '.llllc....clllk.',
    '.LLLLLLLLLLLLLL.',
    '.lllllllllllllk.',
    '.kkkkkkkkkkkkkk.'],
  { L: 0xa4824e, l: 0x6e5434, c: 0xd8b070, k: 0x4a3824 }, 0x241a10);
});

// ---------------------------------------------------------------- lever
// The lever's handle: a stick with a knob of stone on its end.
def('lever_item', (t) => {
  t.clear();
  part(t, [
    '................',
    '................',
    '................',
    '.......KG.......',
    '.......Gg.......',
    '.......ab.......',
    '.......ab.......',
    '.......ab.......',
    '.......ab.......',
    '.......ab.......',
    '.......ab.......',
    '.......ab.......',
    '.......ab.......',
    '.......ab.......'],
  { K: 0xb4b4b4, G: 0x8a8a8a, g: 0x5e5e5e, a: 0xa07a44, b: 0x6e4f28 }, 0x2a1c0c);
});
