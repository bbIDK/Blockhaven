// The enchanting table and everything around enchanting: the table (red cloth over obsidian, with
// diamond corners), the book that floats over it, enchanted books, experience orbs and the glyphs
// that drift from bookshelves to the table.
import { def, quantize, paint, shaded } from './core.js';

const OBSIDIAN = [0x0d0916, 0x140e21, 0x1b132c, 0x241a39, 0x2e2247, 0x3c2d5c];
const CLOTH = [0x5a0a0a, 0x7e1212, 0x9a1c18, 0xb42820, 0xc8382c];
const DIAMOND = [0x1a5a58, 0x2ab0a8, 0x5fe0d8, 0xb6fff8];
function obsidian(t) {
  quantize(t, t.field([[4, 4, 0.5], [2, 2, 0.3]], 0.35), OBSIDIAN, [0.12, 0.2, 0.26, 0.22, 0.13, 0.07]);
  for (let k = 0; k < 4; k++) { const x = t.ri(16), y = t.ri(16); t.set(x, y, 0x55437e); }
}
function cloth(t, y0, y1) {
  const f = t.field([[2, 16, 0.5], [4, 4, 0.3]], 0.3);
  for (let y = y0; y < y1; y++) for (let x = 0; x < 16; x++) {
    const v = f[y * 16 + x] + (x % 2 ? 0.05 : -0.05);
    t.set(x, y, CLOTH[Math.max(1, Math.min(4, Math.floor(v * 4.5)))]);
  }
}
def('enchanting_table_top', (t) => {
  cloth(t, 0, 16);
  for (let i = 0; i < 16; i++) { t.set(i, 0, CLOTH[0]); t.set(0, i, CLOTH[0]); t.set(i, 15, CLOTH[0]); t.set(15, i, CLOTH[0]); }
  // A diamond set in each corner, and a gold thread round the edge.
  for (const [cx, cy] of [[2, 2], [13, 2], [2, 13], [13, 13]]) {
    t.set(cx, cy, DIAMOND[3]); t.set(cx - 1, cy, DIAMOND[1]); t.set(cx + 1, cy, DIAMOND[1]); t.set(cx, cy - 1, DIAMOND[2]); t.set(cx, cy + 1, DIAMOND[0]);
  }
  for (let i = 4; i < 12; i++) { t.set(i, 1, 0xd8a838); t.set(i, 14, 0xa87a20); t.set(1, i, 0xd8a838); t.set(14, i, 0xa87a20); }
});
def('enchanting_table_side', (t) => {
  obsidian(t);
  // (The table is 12 high, so its sides show rows 4-15.) Cloth hangs over the top edge, with a
  // diamond in the middle of each side.
  cloth(t, 4, 7);
  for (let x = 0; x < 16; x++) t.set(x, 7, x % 3 ? CLOTH[0] : 0x3a0606);
  for (const x of [1, 5, 10, 14]) t.set(x, 8, CLOTH[1]);
  t.set(7, 5, DIAMOND[3]); t.set(8, 5, DIAMOND[2]); t.set(7, 6, DIAMOND[1]); t.set(8, 6, DIAMOND[0]);
});
def('enchanting_table_bottom', (t) => obsidian(t));

// The book above the table: leather covers, and pages of glyphs.
def('ench_book_cover', (t) => {
  quantize(t, t.field([[4, 4, 0.5], [2, 2, 0.4]], 0.3), [0x4a200e, 0x5e2c14, 0x6e3618, 0x7e421e], [0.2, 0.35, 0.3, 0.15]);
  for (let i = 0; i < 16; i++) { t.set(i, 0, 0x2a1206); t.set(i, 15, 0x2a1206); }
  for (let y = 4; y < 12; y++) t.set(8, y, 0xc8a040);
});
def('ench_book_pages', (t) => {
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) t.set(x, y, (x + y) % 5 ? 0xf0ead8 : 0xe0d8c0);
  for (let y = 2; y < 14; y += 2) for (let x = 2; x < 14; x++) if (t.r() < 0.55) t.set(x, y, 0x6a5a48);
});

// An enchanted book: the book in purple with gold clasps (it shimmers like anything enchanted).
def('enchanted_book', (t) => {
  t.clear();
  paint(t, ['', '', '..#########.....', '.#ccccccccc#....', '.#cCCCCCCCcp#...', '.#cCyyyyyCcpp#..', '.#cCCCCCCCcpp#..', '.#cCyyyyCCcpp#..',
    '.#cCCCCCCCcpp#..', '.#cCCCCCCCcpp#..', '.#cCCCCCCCcpp#..', '.#ccccccccc#p#..', '..#ssssssss#p#..', '...#########...'],
  { '#': 0x1e0a2a, c: 0x5a2478, C: 0x7a38a0, y: 0xf0c848, p: 0xe6e0cc, s: 0x3a1450 });
  t.set(5, 4, 0xd8a8ff); t.set(4, 9, 0xd8a8ff);
});

// Experience orbs: a bright round bead with a glint (tinted greener or yellower as it pulses).
def('xp_orb', (t) => {
  t.clear();
  shaded(t, ['', '', '', '', '', '......xxxx......', '.....xxxxxx.....', '.....xxxxxx.....', '.....xxxxxx.....', '.....xxxxxx.....',
    '......xxxx......'], [0x2a4a00, 0x9ad020, 0xc8f040, 0xe8ff80, 0xffffd0], {}, { outline: 'all' });
  t.set(6, 6, 0xffffff); t.set(7, 6, 0xffffe0);
});

// Sparks from an enchanted weapon's hit: cyan and white.
def('magic_crit', (t) => { for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) t.set(x, y, [0x7ff0ff, 0xffffff, 0x40c8f0][(x * 7 + y * 3 + t.ri(3)) % 3]); });

// Glyphs of the enchanting alphabet, drifting to the table.
def('glyph', (t) => {
  t.clear();
  const G = ['.x.x', 'xxx.', '.x..', 'x.xx'];
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) if (G[y % 4][x % 4] === 'x') t.set(x, y, 0xe8e8ff);
});
