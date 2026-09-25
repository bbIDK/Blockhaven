// Paintings: original pictures, 16 pixels to the block, from one block up to four by four. Each is
// painted from code onto a canvas of its own size, then cut into 16x16 tiles, one texture layer
// each ("painting_<name>_<column>_<row>", row 0 at the top). Painted in a few flat tones with
// dithered skies, like the originals, inside a thin dark frame.
import { def, mix } from './core.js';
import { mulberry32, hashString } from '../math.js';

// [name, width, height] in blocks. (Their order is part of the save format: a painting remembers
// which it is by its place in this list.)
export const PAINTINGS = [
  ['sunrise', 1, 1], ['moonlit', 1, 1], ['still_life', 1, 1], ['bouquet', 1, 1],
  ['wanderer', 1, 2], ['falls', 1, 2],
  ['fields', 2, 1], ['sail', 2, 1],
  ['village', 2, 2], ['peaks', 2, 2], ['starry', 2, 2], ['blocks', 2, 2],
  ['castle', 4, 2], ['islands', 4, 3], ['deep', 4, 4],
];

class Canvas {
  constructor(name, w, h) {
    this.w = w; this.h = h;
    this.px = new Int32Array(w * h).fill(-1);
    this.r = mulberry32(hashString(`painting:${name}`));
  }
  set(x, y, c) { x = Math.round(x); y = Math.round(y); if (x >= 0 && y >= 0 && x < this.w && y < this.h) this.px[y * this.w + x] = c; }
  get(x, y) { return this.px[Math.max(0, Math.min(this.h - 1, y)) * this.w + Math.max(0, Math.min(this.w - 1, x))]; }
  rect(x0, y0, w, h, c) { for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) this.set(x, y, typeof c === 'function' ? c(x, y) : c); }
  // A vertical run of colours from top to bottom, in bands a few pixels deep, dithered where
  // one band meets the next.
  sky(y0, y1, colours) {
    const n = colours.length - 1, steps = Math.max(colours.length, Math.round((y1 - y0) / 3));
    const at = (u) => { const i = Math.min(n - 1, Math.floor(u * n)); return mix(colours[i], colours[i + 1], Math.min(1, u * n - i)); };
    for (let y = y0; y < y1; y++) for (let x = 0; x < this.w; x++) {
      const st = ((y - y0) / Math.max(1, y1 - y0 - 1)) * (steps - 1), k = Math.min(steps - 2, Math.floor(st)), f = st - k;
      const bayer = [[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]][y & 3][x & 3] / 16;
      this.set(x, y, at((f > bayer ? k + 1 : k) / (steps - 1)));
    }
  }
  disc(cx, cy, r, c) { for (let y = Math.floor(cy - r); y <= cy + r; y++) for (let x = Math.floor(cx - r); x <= cx + r; x++) if (Math.hypot(x + 0.5 - cx, y + 0.5 - cy) <= r) this.set(x, y, typeof c === 'function' ? c(x, y) : c); }
  // Everything below the line y = f(x) (hills, water), in colour c(x, y).
  below(f, c) { for (let x = 0; x < this.w; x++) for (let y = Math.max(0, Math.floor(f(x))); y < this.h; y++) this.set(x, y, typeof c === 'function' ? c(x, y) : c); }
  line(x0, y0, x1, y1, c) {
    const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1);
    for (let i = 0; i <= n; i++) this.set(x0 + ((x1 - x0) * i) / n, y0 + ((y1 - y0) * i) / n, c);
  }
  // A few scattered pixels of `c` over whatever's in [x0, x1) x [y0, y1) (texture in a field).
  speckle(x0, y0, x1, y1, n, c, only = null) {
    for (let k = 0; k < n; k++) {
      const x = x0 + Math.floor(this.r() * (x1 - x0)), y = y0 + Math.floor(this.r() * (y1 - y0));
      if (!only || only.includes(this.get(x, y))) this.set(x, y, typeof c === 'function' ? c(x, y) : c);
    }
  }
  // A tree: trunk and a round crown (lit on its left).
  tree(x, y, size, crown, lit, trunk) {
    this.rect(x, y - size, 1, size + 1, trunk);
    this.disc(x + 0.5, y - size - size * 0.3, size * 0.75, (px, py) => (px + py < x + y - size * 1.9 ? lit : crown));
  }
  // The frame: a dark edge with a lighter bead inside it.
  frame() {
    for (let x = 0; x < this.w; x++) { this.set(x, 0, 0x2a1a0c); this.set(x, this.h - 1, 0x2a1a0c); }
    for (let y = 0; y < this.h; y++) { this.set(0, y, 0x2a1a0c); this.set(this.w - 1, y, 0x2a1a0c); }
  }
}

// ---------------------------------------------------------------- the pictures
const ART = {
  // The sun coming up over green hills.
  sunrise(c) {
    c.sky(0, 16, [0x3a4a8a, 0xc8607a, 0xf0a050, 0xfad870]);
    c.disc(10, 9.5, 3.2, 0xfff4c0);
    c.below((x) => 10.5 + Math.sin(x * 0.5) * 1.2, (x, y) => (y < 12 ? 0x5a9a3a : 0x3a7a2a));
    c.below((x) => 13 + Math.sin(x * 0.8 + 2) * 1, 0x2a5a22);
    c.tree(3, 12, 3, 0x1e4a1a, 0x2e6a26, 0x3a2a1a);
  },
  // The moon over a quiet sea.
  moonlit(c) {
    c.sky(0, 10, [0x0a0c26, 0x1a2256, 0x2a3a7a]);
    c.speckle(1, 1, 15, 8, 9, 0xe8e8ff);
    // A crescent: the moon's disc, less another a little up and to the right.
    for (let y = 1; y < 9; y++) for (let x = 7; x < 15; x++) {
      if (Math.hypot(x + 0.5 - 10.5, y + 0.5 - 4.5) <= 2.9 && Math.hypot(x + 0.5 - 11.7, y + 0.5 - 3.8) > 2.3) c.set(x, y, 0xf4f0d0);
    }
    c.below(() => 10, (x, y) => ((x + y * 3) % 5 === 0 ? 0x2a3a7a : 0x121a44));
    for (let y = 11; y < 15; y++) c.rect(9 + (y % 2), y, 2, 1, 0xc8c8a0);
  },
  // A bowl of apples on a table.
  still_life(c) {
    c.rect(0, 0, 16, 16, (x, y) => ((x * 7 + y * 3) % 11 === 0 ? 0x4a2e1e : 0x3e2618));
    c.rect(0, 11, 16, 5, (x, y) => (y === 11 ? 0x8a5a32 : 0x6a4224));
    c.disc(8, 10, 5, (x, y) => (y >= 10 ? (x < 6 ? 0xd8d0c0 : 0xb8b0a0) : c.get(x, y)));
    for (const [x, y, col, dark] of [[7, 6.2, 0xe0b020, 0xa87a10], [5.2, 8.4, 0xc82020, 0x8a1010], [8.6, 8.2, 0x5aaa2a, 0x2a6a1a], [11, 8.6, 0xd02820, 0x8a1410]]) {
      c.disc(x, y, 1.8, (px, py) => (px + py > x + y + 0.5 ? dark : col));
      c.set(x - 0.7, y - 0.8, 0xffffff);
      c.set(x, y - 2, 0x4a2a10);
    }
  },
  // Flowers in a jug.
  bouquet(c) {
    c.rect(0, 0, 16, 16, (x, y) => ((x + y) % 4 === 0 ? 0x5a6a7a : 0x4a5a6a));
    c.rect(6, 10, 4, 5, (x) => (x === 6 ? 0x8a9ab0 : 0x6a7a92));
    c.rect(5, 15, 6, 1, 0x3a2a1a);
    for (const [x, y] of [[8, 9], [6, 7], [10, 7], [8, 5], [5, 4], [11, 4], [7, 3], [9, 2]]) c.line(8, 10, x, y + 1, 0x3a7a2a);
    for (const [x, y, col] of [[6, 7, 0xe84040], [10, 7, 0xf0d040], [8, 5, 0xf0f0f0], [5, 4, 0xa050d0], [11, 4, 0xe84040], [7, 3, 0xf0a0c0], [9, 2, 0xf0d040]]) {
      c.disc(x + 0.5, y + 0.5, 1.2, col);
      c.set(x, y, 0x5a3a1a);
    }
  },
  // A traveller on a road, under a tall tree.
  wanderer(c) {
    c.sky(0, 20, [0x6a9ad8, 0xa8c8e8, 0xe8e0c8]);
    c.below((x) => 19 + Math.sin(x * 0.6) * 1, 0x6a9a4a);
    c.below((x) => 24 + (x - 8) * 0.2, 0x4a7a32);
    for (let y = 22; y < 32; y++) c.rect(Math.floor(7 - (y - 22) * 0.35), y, 3 + Math.floor((y - 22) * 0.6), 1, 0xc8b080);
    c.rect(11, 6, 2, 22, 0x4a3220);
    c.disc(12, 7, 5, (x, y) => (x + y < 17 ? 0x4a8a32 : 0x2e6a26));
    c.disc(10, 12, 3.5, (x, y) => (x + y < 20 ? 0x4a8a32 : 0x2e6a26));
    // The traveller: cloak, hat and staff.
    c.rect(6, 23, 2, 4, 0x7a2a2a); c.rect(6, 22, 2, 1, 0xe0b890); c.rect(5, 21, 4, 1, 0x3a2a1a); c.line(9, 20, 9, 27, 0x6a4a2a);
    c.rect(6, 27, 1, 1, 0x2a1a0c); c.rect(7, 27, 1, 1, 0x2a1a0c);
  },
  // A waterfall down between cliffs.
  falls(c) {
    c.sky(0, 8, [0x80b0e0, 0xc0d8f0]);
    c.rect(0, 4, 16, 28, (x, y) => ((x * 3 + y * 5) % 7 === 0 ? 0x5a5a5a : (x + y) % 5 === 0 ? 0x7a7a72 : 0x6a6a64));
    c.rect(0, 3, 16, 2, 0x4a8a32);
    c.rect(6, 4, 4, 22, (x, y) => ((y + x * 2) % 5 === 0 ? 0xe8f4ff : (y + x) % 3 === 0 ? 0x8ac0f0 : 0x5a9ae0));
    c.rect(0, 26, 16, 6, (x, y) => ((x + y) % 4 === 0 ? 0x4a8ae0 : 0x2a5aa8));
    c.speckle(3, 24, 13, 28, 20, 0xffffff);
    c.tree(2, 4, 2, 0x2e6a26, 0x4a8a32, 0x4a3220);
    c.tree(13, 4, 3, 0x2e6a26, 0x4a8a32, 0x4a3220);
  },
  // A wheat field with a farmhouse.
  fields(c) {
    c.sky(0, 8, [0x5a8ad8, 0x9ac0ec, 0xd8e8f4]);
    c.disc(26, 3, 1.6, 0xfff8d0);
    for (const [x, y] of [[5, 3], [8, 2], [11, 3], [18, 4], [21, 3]]) c.rect(x, y, 4, 1, 0xf4f8ff);
    c.below((x) => 8 + Math.sin(x * 0.3) * 0.8, 0x6a9a4a);
    c.below(() => 10, (x, y) => ((x + y * 2) % 3 === 0 ? 0xd8b048 : (x * y) % 7 === 0 ? 0xb88a2a : 0xe8c860));
    c.rect(20, 5, 6, 4, 0xe8dcc0); c.rect(19, 3, 8, 2, 0x9a3a2a); c.rect(22, 7, 2, 2, 0x5a3a1a); c.rect(21, 5, 1, 1, 0x3a5a8a); c.rect(24, 5, 1, 1, 0x3a5a8a);
    c.tree(4, 9, 2, 0x2e6a26, 0x4a8a32, 0x4a3220);
  },
  // A boat under sail at sunset.
  sail(c) {
    c.sky(0, 10, [0x4a3a7a, 0xc8506a, 0xf09a4a, 0xf8d880]);
    c.disc(22, 9, 3.2, 0xfff0b0);
    c.below(() => 10, (x, y) => ((x * 2 + y * 5) % 9 === 0 ? 0xf0a060 : (x + y) % 3 === 0 ? 0x3a3a7a : 0x2a2a5a));
    for (let y = 11; y < 15; y++) c.rect(21 - (y % 2), y, 3, 1, 0xf0c070);
    c.rect(7, 10, 9, 2, 0x3a2414); c.rect(8, 12, 7, 1, 0x3a2414);
    for (let y = 2; y < 10; y++) c.rect(11, y, 1, 1, 0x2a1a0c);
    for (let y = 3; y < 10; y++) c.rect(12, y, Math.floor((y - 2) * 0.7), 1, 0xe8e0c8);
    for (let y = 4; y < 10; y++) c.rect(11 - Math.floor((y - 3) * 0.5), y, Math.floor((y - 3) * 0.5), 1, 0xd8d0b8);
  },
  // Cottages at dusk, their windows lit.
  village(c) {
    c.sky(0, 18, [0x1a1a4a, 0x4a3a7a, 0xa85a7a, 0xe8905a]);
    c.speckle(1, 1, 31, 8, 12, 0xf0f0ff);
    c.below((x) => 16 + Math.sin(x * 0.2) * 2, 0x2a3a2a);
    c.below((x) => 22 + Math.sin(x * 0.15 + 1) * 1, 0x3a4a2a);
    for (const [x, y, w, h, roof] of [[3, 16, 7, 6, 0x6a2a2a], [12, 14, 8, 7, 0x4a3a5a], [22, 17, 7, 6, 0x6a3a22]]) {
      c.rect(x, y, w, h, 0x8a7a62);
      for (let k = 0; k < 4; k++) c.rect(x - 1 + k, y - 1 - k, w + 2 - k * 2, 1, roof);
      c.rect(x + 1, y + 1, 2, 2, 0xf8d060); c.rect(x + w - 3, y + 1, 2, 2, 0xf8d060);
      c.rect(x + Math.floor(w / 2) - 1, y + h - 3, 2, 3, 0x3a2414);
    }
    c.rect(0, 26, 32, 6, (x, y) => ((x + y) % 5 === 0 ? 0x4a5a32 : 0x3a4a2a));
    c.tree(29, 26, 3, 0x1a2a1a, 0x2a3a22, 0x2a1a0c);
  },
  // Snowy peaks over a lake that mirrors them.
  peaks(c) {
    c.sky(0, 18, [0x3a6ab8, 0x7aa8e0, 0xd0e4f4]);
    const ridge = (x) => 16 - Math.max(0, 12 - Math.abs(x - 11) * 1.2) - Math.max(0, 9 - Math.abs(x - 24) * 1.1);
    c.below(ridge, (x, y) => (y < ridge(x) + 3 ? 0xf4f8ff : (x + y) % 4 === 0 ? 0x5a6a7a : 0x4a5a6a));
    c.below(() => 18, (x, y) => ((x * 3 + y) % 6 === 0 ? 0x3a7a3a : 0x2a5a2a));
    c.rect(0, 20, 32, 12, (x, y) => {
      const my = 40 - y, above = my < ridge(x) ? (my < 18 ? 0x7aa8e0 : 0x3a6ab8) : my < ridge(x) + 3 ? 0xc8d8e8 : 0x3a4a5a;
      return (x + y) % 3 === 0 ? mix(above, 0x2a4a8a, 0.5) : mix(above, 0x2a4a8a, 0.3);
    });
    c.tree(4, 19, 3, 0x1e4a1a, 0x2e6a26, 0x3a2a1a);
    c.tree(28, 19, 2, 0x1e4a1a, 0x2e6a26, 0x3a2a1a);
  },
  // A night sky in swirls over a dark cypress.
  starry(c) {
    c.rect(0, 0, 32, 32, (x, y) => {
      const a = Math.atan2(y - 10, x - 18), d = Math.hypot(x - 18, y - 10);
      return Math.sin(d * 0.9 - a * 2) > 0.3 ? 0x3a5aa8 : Math.sin(d * 0.9 - a * 2) > -0.4 ? 0x1a2a78 : 0x101a4a;
    });
    for (const [x, y, r] of [[5, 5, 1.8], [25, 4, 2.2], [13, 13, 1.4], [28, 14, 1.6], [9, 20, 1.2]]) {
      c.disc(x, y, r + 1.2, (px, py) => mix(c.get(px, py), 0xf0e080, 0.5));
      c.disc(x, y, r, 0xfff4a0);
    }
    c.disc(26, 24, 3, 0xf8e070);
    c.below((x) => 26 + Math.sin(x * 0.4) * 1.5, (x, y) => ((x + y) % 4 === 0 ? 0x1a2a3a : 0x101820));
    for (let y = 8; y < 32; y++) c.rect(6 - Math.floor((y - 8) * 0.12) + ((y % 3) ? 0 : 1), y, 2 + Math.floor((y - 8) * 0.22), 1, (x) => ((x + y) % 3 ? 0x0a1a0e : 0x1a2e1a));
  },
  // Blocks of colour, ruled off in black.
  blocks(c) {
    c.rect(0, 0, 32, 32, 0xf0ece0);
    for (const [x, y, w, h, col] of [[1, 1, 13, 13, 0xd02a1a], [15, 1, 16, 7, 0xf0ece0], [15, 9, 8, 5, 0x1a4ab0], [24, 9, 7, 14, 0xf0ece0],
      [1, 15, 6, 16, 0xf0c820], [8, 15, 15, 8, 0xf0ece0], [8, 24, 9, 7, 0x1a4ab0], [18, 24, 13, 7, 0xd02a1a]]) c.rect(x, y, w, h, col);
    for (const x of [14, 7, 23, 17]) for (let y = 0; y < 32; y++) if ((x === 14 && y < 15) || (x === 7 && y > 14) || (x === 23 && y > 8 && y < 24) || (x === 17 && y > 23)) c.set(x, y, 0x101010);
    for (const [y, x0, x1] of [[14, 0, 23], [8, 14, 32], [23, 7, 32]]) for (let x = x0; x < x1; x++) c.set(x, y, 0x101010);
  },
  // A castle on its hill, with banners flying.
  castle(c) {
    c.sky(0, 22, [0x4a7ac8, 0x8ab4e4, 0xe0ecf4]);
    for (const [x, y] of [[8, 5], [14, 4], [44, 6], [50, 3], [56, 5]]) { c.rect(x, y, 6, 1, 0xf8faff); c.rect(x + 1, y - 1, 4, 1, 0xf8faff); }
    c.below((x) => 22 - Math.max(0, 8 - Math.abs(x - 32) * 0.35), (x, y) => ((x + y * 2) % 7 === 0 ? 0x4a8a32 : 0x3a7a2a));
    c.below((x) => 27 + Math.sin(x * 0.2) * 1.5, 0x2e6a26);
    const stone = (x, y) => ((x % 4 === 0 || y % 3 === 0) ? 0x8a8a84 : 0xaaa8a0);
    c.rect(22, 8, 20, 8, stone);
    for (const tx of [19, 30, 41]) { c.rect(tx, 3, 5, 13, stone); for (let k = 0; k < 5; k += 2) c.rect(tx + k, 2, 1, 1, 0xaaa8a0); c.rect(tx + 2, 6, 1, 2, 0x2a2a3a); }
    for (let k = 22; k < 42; k += 2) c.rect(k, 7, 1, 1, 0xaaa8a0);
    c.rect(30, 11, 4, 5, 0x3a2414);
    for (const tx of [21, 32, 43]) { c.rect(tx, 0, 1, 3, 0x3a2a1a); c.rect(tx + 1, 0, 3, 2, tx === 32 ? 0xd02a1a : 0x2a4ab0); }
    c.tree(8, 26, 3, 0x1e4a1a, 0x2e6a26, 0x3a2a1a);
    c.tree(54, 25, 4, 0x1e4a1a, 0x2e6a26, 0x3a2a1a);
  },
  // Islands floating in the sky, their streams falling away into cloud.
  islands(c) {
    c.sky(0, 48, [0x5a8ae0, 0x8ab8f0, 0xc8e0f8, 0xf0f4fc]);
    for (let k = 0; k < 7; k++) {
      const cx = 4 + k * 9 + c.r() * 4, cy = 38 + c.r() * 6;
      c.disc(cx, cy, 4 + c.r() * 3, 0xffffff);
      c.disc(cx + 4, cy + 1, 3 + c.r() * 2, 0xf0f4fc);
    }
    for (const [x, y, w] of [[10, 14, 14], [34, 8, 18], [48, 24, 10]]) {
      for (let k = 0; k < w / 2 + 2; k++) c.rect(x + k, y + 2 + k, Math.max(1, w - k * 2), 1, (px, py) => ((px + py) % 3 === 0 ? 0x6a4a2a : 0x5a3a22));
      c.rect(x - 1, y, w + 2, 2, (px, py) => (py === y ? 0x5aa83a : 0x4a8a32));
      c.rect(x + Math.floor(w / 2), y + 2, 1, 30, (px, py) => (py % 3 === 0 ? 0xe8f4ff : 0x9ac8f0));
      c.tree(x + 2, y, 3, 0x2e6a26, 0x4a8a32, 0x4a3220);
    }
    c.rect(38, 4, 5, 4, 0xe8dcc0); c.rect(37, 2, 7, 2, 0x9a3a2a); c.rect(40, 6, 1, 2, 0x5a3a1a);
  },
  // Under the sea: light coming down, kelp swaying, a dolphin going by.
  deep(c) {
    c.sky(0, 64, [0x4ab8e0, 0x2a7ac0, 0x1a4a8a, 0x0e2250]);
    for (let k = 0; k < 6; k++) { const x0 = 6 + k * 11; for (let y = 0; y < 40; y++) if ((y + k) % 2) c.set(x0 + y * 0.35, y, 0x6ac8f0); }
    c.below((x) => 56 + Math.sin(x * 0.3) * 2, (x, y) => ((x + y) % 4 === 0 ? 0xc8b078 : 0xa89058));
    for (const x0 of [5, 12, 47, 55, 60]) for (let y = 30; y < 60; y++) c.set(x0 + Math.sin(y * 0.4 + x0) * 1.5, y, y % 4 ? 0x2a7a3a : 0x3a9a4a);
    for (const [x, y, col] of [[20, 58, 0xe85a6a], [24, 59, 0xf0a040], [38, 57, 0xd05ad0], [42, 59, 0xe85a6a]]) c.disc(x, y, 2, col);
    // The dolphin.
    c.disc(30, 26, 5, (x, y) => (y < 26 ? 0x7a8aa0 : 0xc8d0dc));
    c.rect(34, 24, 7, 4, (x, y) => (y < 26 ? 0x7a8aa0 : 0xc8d0dc));
    c.rect(40, 25, 4, 2, 0xc8d0dc); c.rect(23, 23, 3, 3, 0x7a8aa0); c.rect(21, 21, 3, 2, 0x6a7a90); c.rect(21, 27, 3, 2, 0x6a7a90);
    c.rect(31, 19, 3, 3, 0x6a7a90); c.set(37, 25, 0x101820);
    for (const [x, y] of [[45, 20], [46, 16], [44, 12], [45, 8]]) c.disc(x, y, 0.9, 0xc8f0ff);
  },
};

// Paint each picture once, the first time one of its tiles is asked for.
const painted = new Map();
function canvasFor(name, bw, bh) {
  if (!painted.has(name)) {
    const c = new Canvas(name, bw * 16, bh * 16);
    ART[name](c);
    c.frame();
    painted.set(name, c);
  }
  return painted.get(name);
}
for (const [name, bw, bh] of PAINTINGS) {
  for (let ty = 0; ty < bh; ty++) for (let tx = 0; tx < bw; tx++) {
    def(`painting_${name}_${tx}_${ty}`, (t) => {
      const c = canvasFor(name, bw, bh);
      for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
        const v = c.get(tx * 16 + x, ty * 16 + y);
        t.set(x, y, v < 0 ? 0x808080 : v);
      }
    });
  }
}

// The back of a painting, and the frame of an item frame (and the leather inside it).
def('painting_back', (t) => {
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) t.set(x, y, (y % 4 === 3) ? 0x5a4428 : (x * 5 + y * 3) % 11 === 0 ? 0x8a6a42 : 0x7a5c38);
});
def('item_frame', (t) => {
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
    const edge = x < 3 || y < 3 || x > 12 || y > 12;
    t.set(x, y, edge ? ((x + y) % 5 === 0 ? 0x9a7248 : x < 3 || y < 3 ? 0xb88a58 : 0x8a6238) : (x * 3 + y * 7) % 9 === 0 ? 0x7a4a2e : 0x8e5836);
  }
  for (let i = 2; i < 14; i++) { t.set(i, 2, 0x5a3a1e); t.set(2, i, 0x5a3a1e); t.set(i, 13, 0xd0a878); t.set(13, i, 0xd0a878); }
});
