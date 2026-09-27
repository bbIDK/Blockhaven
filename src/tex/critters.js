// The wild update's textures: the glow squid's glow ink sac and the glow item frame, buckets with a
// creature swimming in them, and frogspawn. The game takes most from the packs (see
// tools/texture-sources.mjs); these drawings are the fallback, in their colours.
import { def, shaded, paint } from './core.js';
import { bucket } from './gear.js';

// A sac of glowing ink: teal, bright where it catches the light.
def('glow_ink_sac', (t) => {
  shaded(t, ['', '', '', '', '........xx......', '.......xxxx.....', '......xxxxxx....', '.....xxxxxxxx...', '....xxxxxxxxx...',
    '....xxxxxxxxx...', '....xxxxxxxx....', '.....xxxxxx.....', '......xxxx......'], [0x0c3a3a, 0x1a6a62, 0x2a9a8a, 0x4ac8b0, 0xa8f8e0], {}, { outline: 'all' });
  for (const [x, y] of [[6, 7], [7, 7], [6, 8]]) t.set(x, y, 0xe0fff4);
  for (const [x, y] of [[10, 10], [9, 11]]) t.set(x, y, 0x7af0d0);
});
// The frame of a glow item frame, glowing gold round a warm glowing middle.
def('glow_item_frame', (t) => {
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
    const edge = x < 3 || y < 3 || x > 12 || y > 12;
    t.set(x, y, edge ? ((x + y) % 5 === 0 ? 0xc88a2a : x < 3 || y < 3 ? 0xf0c050 : 0xb87a22) : (x * 3 + y * 7) % 9 === 0 ? 0xf8d870 : 0xfcc848);
  }
  for (let i = 2; i < 14; i++) { t.set(i, 2, 0x9a5a14); t.set(2, i, 0x9a5a14); t.set(i, 13, 0xffe8a0); t.set(13, i, 0xffe8a0); }
});
def('glow_item_frame_item', (t) => {
  paint(t, ['', '', '..############..', '..#ffffffffff#..', '..#fggggggggd#..', '..#fghhhhhhgd#..', '..#fghllllhgd#..', '..#fghlwwlhgd#..',
    '..#fghlwwlhgd#..', '..#fghllllhgd#..', '..#fghhhhhhgd#..', '..#fggggggggd#..', '..#fdddddddddd#.', '..############..'],
  { '#': 0x5a3a14, f: 0xe0a83a, d: 0x9a6a22, g: 0xf4b838, h: 0xfcd050, l: 0xffe078, w: 0xfff4c0 });
});

// Buckets of water with something in them: the fish (or axolotl, or tadpole) over the water.
const WATER = [0x1c3a9a, 0x3a6ae0, [[5, 5, 0x9ac4ff], [6, 5, 0x6a9cf4]]];
function inBucket(t, rows, legend) {
  bucket(t, ...WATER);
  paint(t, rows, legend, { clear: false });
}
def('cod_bucket', (t) => inBucket(t, ['', '.....cccc.......', '....ckkkkcc.t...', '...cekkkkkkctt..', '....ckkkkcc.t...', '.....cccc.......'],
  { c: 0x8a6a42, k: 0xc0a068, e: 0x1a1a1a, t: 0xa88a58 }));
def('salmon_bucket', (t) => inBucket(t, ['', '.....rrrr.......', '....rppppr..t...', '...rewppppprtt..', '....rppppr..t...', '.....rrrr.......'],
  { r: 0x7a1e1c, p: 0xc8463a, w: 0xe8c0a0, e: 0x1a1a1a, t: 0x5a7a58 }));
def('tropical_fish_bucket', (t) => inBucket(t, ['', '......ooo.......', '....ooowooo.t...', '...oeowwwoootl..', '....ooowooo.t...', '......ooo.......'],
  { o: 0xf07a18, w: 0xf8f4ec, e: 0x1a1a1a, t: 0xf0a040, l: 0xf8f4ec }));
def('pufferfish_bucket', (t) => inBucket(t, ['...s.s.s.s......', '...yyyyyyy......', '..syeyyyyyys....', '...yyyyyyyy.....', '..syyyyyyys.....', '...yyyyyyy......'],
  { y: 0xe8b818, s: 0xf8e8a0, e: 0x1a1a1a }));
def('axolotl_bucket', (t) => inBucket(t, ['..g......g......', '..gg....gg......', '...ppppppp......', '...pepppep......', '...pppppppttt...', '....pppppp......'],
  { p: 0xf4a8c8, g: 0xd8487a, e: 0x1a1a1a, t: 0xe890b4 }));
def('tadpole_bucket', (t) => inBucket(t, ['', '', '', '', '......bb........', '.....bbbbtt.....', '......bb..tt....'],
  { b: 0x4a3a2a, t: 0x6a5a44 }));

// Frogspawn: clusters of dark eggs floating on the water, each in its rim of grey-green jelly.
def('frogspawn', (t) => {
  t.clear();
  const eggs = [];
  for (const [cx, cy, n] of [[4, 4, 8], [11, 5, 7], [6, 11, 8], [12, 12, 5]]) {
    for (let k = 0; k < n; k++) eggs.push([cx + t.ri(5) - 2, cy + t.ri(5) - 2]);
  }
  for (const [x, y] of eggs) for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) if (!t.alpha(x + dx, y + dy)) t.set(x + dx, y + dy, (x + y) % 3 ? 0x8fa288 : 0x9fb098);
  for (const [x, y] of eggs) t.set(x, y, 0x1a1b14);
  for (const [x, y] of eggs.filter((_, i) => i % 3 === 0)) if (t.alpha(x, y - 1)) t.set(x, y - 1, 0xd6e2cc);
});
