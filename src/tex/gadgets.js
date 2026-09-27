// The Update 25 textures: squid ink, books to write in, and the gadgets (crossbows, tridents,
// spyglasses, maps, fireworks; the chest boats are with the boats, in gear.js). The game takes most
// from the packs (see tools/texture-sources.mjs); these drawings are the fallback, in their colours.
import { def, shaded, paint } from './core.js';
import { book } from './gear.js';

// A sac of squid ink: near-black, blue-grey where it catches the light.
def('ink_sac', (t) => {
  shaded(t, ['', '', '', '', '........xx......', '.......xxxx.....', '......xxxxxx....', '.....xxxxxxxx...', '....xxxxxxxxx...',
    '....xxxxxxxxx...', '....xxxxxxxx....', '.....xxxxxx.....', '......xxxx......'], [0x08080e, 0x14141e, 0x22222e, 0x34344a, 0x585872], {}, { outline: 'all' });
  for (const [x, y] of [[6, 7], [7, 7], [6, 8]]) t.set(x, y, 0x8a8aa8);
  for (const [x, y] of [[10, 10], [9, 11]]) t.set(x, y, 0x3a3a52);
});

// A book and quill: the brown book with a white feather quill standing out of it.
const BROWN = [0x2a1206, 0x5a2610, 0x7a3616, 0x9a4a20, 0xb8622e, 0xd07e44];
def('writable_book', (t) => {
  book(t, BROWN, 0xe0b848);
  paint(t, ['.............fw.', '............fwf.', '...........fwf..', '..........fwf...', '.........fwf....', '........kf......', '.......k........'],
    { f: 0xd8d8d0, w: 0xffffff, k: 0x1a1a1a }, { clear: false });
});
// A written book: the book, with a line of writing on its cover.
def('written_book', (t) => {
  book(t, BROWN, 0xe0b848);
  paint(t, ['', '', '', '', '', '', '', '', '', '....pppp..', '....pp.pp..'], { p: 0xf4eedc }, { clear: false });
});

// ---------------------------------------------------------------- bows and crossbows
// A bow as it's drawn: the string pulled back towards the grip corner (further the harder it's
// drawn) and an arrow across it, its head out past the bow.
function line(t, x0, y0, x1, y1, c) {
  const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0));
  for (let i = 0; i <= n; i++) t.set(Math.round(x0 + ((x1 - x0) * i) / n), Math.round(y0 + ((y1 - y0) * i) / n), c);
}
const WOOD = [0x2a1c0c, 0x6e4f28, 0xa07a44, 0xc49a5a];
function bowDrawn(t, pull) {
  t.clear();
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
    const d = Math.hypot(x + 0.5 - 10.1, y + 0.5 - 10.1);
    if (x + y <= 14 && d >= 7.7 && d <= 9.5) t.set(x, y, Math.abs(x - y) <= 1 ? (d > 8.6 ? 0x6a4630 : 0x3e2a1c) : d > 8.6 ? WOOD[2] : WOOD[1]);
  }
  const px = 8 + pull, py = 8 + pull;
  line(t, 3, 12, px, py, 0xe4e4e8);
  line(t, 12, 3, px, py, 0xe4e4e8);
  line(t, px - 1, py - 1, 2, 2, WOOD[2]);
  for (const [x, y, c] of [[1, 1, 0x9090a0], [2, 1, 0x6e6e78], [1, 2, 0x6e6e78], [px, py, 0xf4f4f4], [px - 1, py, 0xc8c8cc], [px, py - 1, 0xc8c8cc]]) t.set(x, y, c);
}
[0, 1, 2].forEach((n) => def(`bow_pulling_${n}`, (t) => bowDrawn(t, n + 1)));

// A crossbow: the stock along the diagonal from the grip (bottom right) to the bow across its
// head (top left), the string drawn back along the stock as it winds up, and what's loaded lying
// in the groove.
function crossbow(t, pull, load = null) {
  t.clear();
  line(t, 13, 13, 4, 4, WOOD[1]);
  line(t, 14, 13, 5, 4, WOOD[2]);
  line(t, 13, 14, 4, 5, WOOD[0]);
  for (const [x, y] of [[13, 13], [14, 14], [12, 13], [13, 12]]) t.set(x, y, 0x4a3218);
  line(t, 1, 8, 8, 1, 0x5a3e22);
  line(t, 2, 8, 8, 2, WOOD[2]);
  for (const [x, y] of [[1, 8], [8, 1]]) t.set(x, y, 0x8a8a92);
  const nx = 5 + pull, ny = 5 + pull;
  line(t, 1, 9, nx, ny, 0xd8d8dc);
  line(t, 9, 1, nx, ny, 0xd8d8dc);
  if (load === 'arrow') {
    line(t, nx, ny, 2, 2, 0xc49a5a);
    for (const [x, y, c] of [[1, 1, 0x9090a0], [2, 1, 0x6e6e78], [1, 2, 0x6e6e78]]) t.set(x, y, c);
  } else if (load === 'firework') {
    line(t, nx, ny, 3, 3, 0xe8e0d0);
    for (const [x, y, c] of [[2, 2, 0xc8302c], [1, 1, 0xe04a3c], [2, 1, 0xa02420], [1, 2, 0xa02420], [3, 3, 0xc8302c]]) t.set(x, y, c);
  }
}
def('crossbow', (t) => crossbow(t, 0));
[0, 1, 2].forEach((n) => def(`crossbow_pulling_${n}`, (t) => crossbow(t, n + 1)));
def('crossbow_arrow', (t) => crossbow(t, 3, 'arrow'));
def('crossbow_firework', (t) => crossbow(t, 3, 'firework'));

// A trident: a long teal shaft running up from the bottom left, and its three prongs at the top
// right.
def('trident', (t) => {
  t.clear();
  const SHAFT = [0x1e4a44, 0x2e7a6c, 0x48a890], PRONG = [0x3a5a58, 0x9ad8cc, 0xd8fff4];
  for (let i = 0; i < 10; i++) { t.set(1 + i, 14 - i, SHAFT[1]); t.set(2 + i, 14 - i, SHAFT[2]); t.set(1 + i, 15 - i, SHAFT[0]); }
  line(t, 9, 7, 13, 7, PRONG[1]);
  line(t, 9, 7, 9, 3, PRONG[1]);
  line(t, 11, 5, 14, 2, PRONG[2]);
  line(t, 9, 3, 9, 1, PRONG[2]);
  line(t, 13, 7, 15, 7, PRONG[2]);
  for (const [x, y] of [[10, 6], [10, 4], [12, 6]]) t.set(x, y, PRONG[0]);
});

// A spyglass: a copper tube, banded, with a violet amethyst lens at its wide end (top right).
def('spyglass', (t) => {
  t.clear();
  const CU = [0x6a3418, 0xa8582e, 0xd8804a, 0xf0a870];
  for (let i = 0; i < 11; i++) {
    const x = 2 + i, y = 13 - i;
    t.set(x, y, CU[1]); t.set(x + 1, y, CU[2]); t.set(x, y - 1, CU[2]); t.set(x + 1, y + 1, CU[0]); t.set(x - 1, y, CU[0]);
    if (i % 4 === 1) { t.set(x, y, CU[3]); t.set(x + 1, y, CU[3]); }
  }
  for (const [x, y, c] of [[12, 2, 0x8a5ad8], [13, 2, 0xb896f0], [13, 3, 0x6a3ab0], [12, 3, 0xa07ae8], [14, 1, 0x5a2a98], [11, 1, 0x5a2a98]]) t.set(x, y, c);
});

// Maps: a sheet of paper (an empty map), or the same with a map drawn on it: land, water and a
// red mark.
function paper(t) {
  t.clear();
  for (let y = 2; y < 14; y++) for (let x = 2; x < 14; x++) {
    const edge = x === 2 || y === 2 || x === 13 || y === 13;
    t.set(x, y, edge ? 0xa8875a : (x * 7 + y * 3) % 11 === 0 ? 0xdcc79c : 0xeadcb8);
  }
}
def('map', (t) => paper(t));
def('filled_map', (t) => {
  paper(t);
  for (let y = 4; y < 12; y++) for (let x = 4; x < 12; x++) {
    const water = x + y * 0.6 > 13.5;
    t.set(x, y, water ? ((x + y) % 3 ? 0x5a78d0 : 0x6a88e0) : (x * 5 + y) % 4 ? 0x7aa04a : 0x5e8a38);
  }
  for (const [x, y] of [[6, 6], [7, 7], [8, 6], [6, 8], [8, 8]]) t.set(x, y, 0xc02a22);
});

// Fireworks: a rocket (a paper tube, red-striped, with its fuse), a star (a grey ball of powder,
// and its colours over it, drawn separately so they can be tinted), a fire charge and glowstone
// dust.
def('firework_rocket', (t) => {
  t.clear();
  for (let y = 5; y < 14; y++) for (let x = 6; x < 10; x++) t.set(x, y, (y + (x >> 1)) % 4 < 2 ? 0xe8e0d0 : 0xc8302c);
  for (const [x, y, c] of [[7, 2, 0xc8302c], [8, 2, 0xc8302c], [6, 3, 0xa02420], [7, 3, 0xe04a3c], [8, 3, 0xe04a3c], [9, 3, 0xa02420],
    [6, 4, 0xa02420], [9, 4, 0xa02420], [7, 4, 0xc8302c], [8, 4, 0xc8302c], [7, 14, 0x6a6a6a], [8, 15, 0x4a4a4a]]) t.set(x, y, c);
});
function starBall(t, pal) {
  t.clear();
  for (let y = 3; y < 13; y++) for (let x = 3; x < 13; x++) {
    const d = Math.hypot(x - 7.5, y - 7.5);
    if (d < 4.8) t.set(x, y, pal[Math.min(pal.length - 1, Math.floor((d + ((x * 3 + y * 5) % 3) * 0.4) / 1.6))]);
  }
}
def('firework_star', (t) => starBall(t, [0x9a9a9a, 0x7a7a7a, 0x5a5a5a, 0x3a3a3a]));
def('firework_star_overlay', (t) => {
  t.clear();
  for (const [x, y] of [[5, 5], [9, 4], [7, 8], [10, 9], [5, 10], [8, 11], [11, 6]]) t.set(x, y, 0xffffff);
});
def('fire_charge', (t) => starBall(t, [0xf8c030, 0xd87018, 0x8a2a10, 0x2a1a14]));
def('glowstone_dust', (t) => {
  t.clear();
  for (const [x, y, c] of [[5, 6, 0xfff0a0], [6, 6, 0xf0c050], [9, 5, 0xfff0a0], [10, 6, 0xd8a038], [7, 8, 0xffe890], [8, 9, 0xe8b040],
    [5, 10, 0xd8a038], [10, 10, 0xfff0a0], [11, 9, 0xe8b040], [7, 11, 0xf0c050], [8, 5, 0xe8b040], [6, 9, 0xfff6c0]]) t.set(x, y, c);
});
