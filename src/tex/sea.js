// The ocean update's textures: kelp, seagrass, the five corals, sea pickles and dried kelp. The game
// takes them from Pixel Perfection (see tools/texture-sources.mjs); these drawings are the fallback
// in their colours.
import { def, quantize } from './core.js';

// A sea plant: blades of green rising from the bottom edge.
const blades = (pal, count, tall = 16) => (t) => {
  t.clear();
  for (let k = 0; k < count; k++) {
    let x = 2 + t.ri(12);
    const h = tall - t.ri(5);
    for (let y = 15; y > 15 - h; y--) {
      t.set(x, y, pal[(y + k) % pal.length]);
      if (t.r() < 0.25) x = Math.max(0, Math.min(15, x + (t.r() < 0.5 ? 1 : -1)));
    }
  }
};
const KELP = [0x2f6b1f, 0x3c8a26, 0x4ea52f];
def('kelp', blades(KELP, 3, 14));
def('kelp_plant', blades(KELP, 3));
def('seagrass', blades([0x2c7a2a, 0x3a9434, 0x4bb043], 5, 12));
def('tall_seagrass_bottom', blades([0x2c7a2a, 0x3a9434, 0x4bb043], 5));
def('tall_seagrass_top', blades([0x2c7a2a, 0x3a9434, 0x4bb043], 3, 10));

// Corals: [dark, mid, light] for each of the five.
const CORAL = {
  tube: [0x2240b8, 0x3160e4, 0x5a86ff], brain: [0xb4447e, 0xd8609e, 0xf08ac0], bubble: [0x8a28a8, 0xa83cc8, 0xc866e4],
  fire: [0xa82424, 0xcc3a2e, 0xe8604a], horn: [0xc8a020, 0xe0bc2c, 0xf4d85a],
};
for (const [name, pal] of Object.entries(CORAL)) {
  def(`${name}_coral_block`, (t) => quantize(t, t.field([[4, 4, 0.5], [2, 2, 0.4]], 0.3), pal));
  // A branching coral, and a fan spread low and wide.
  def(`${name}_coral`, (t) => {
    t.clear();
    const branch = (x, y, len, dx) => { for (let i = 0; i < len; i++) { t.set(x, y - i, pal[i % 3]); if (i % 3 === 2) x += dx; } };
    branch(7, 15, 12, 0); branch(8, 15, 12, 0); branch(6, 11, 6, -1); branch(9, 10, 6, 1); branch(5, 14, 4, -1); branch(10, 13, 4, 1);
  });
  def(`${name}_coral_fan`, (t) => {
    t.clear();
    for (let y = 8; y < 16; y++) for (let x = 0; x < 16; x++) {
      const dx = x - 7.5, dy = 15.5 - y;
      if (Math.hypot(dx * 0.8, dy * 1.6) < 8 && (x + y) % 3 !== 0) t.set(x, y, pal[(x * 7 + y * 3) % 3]);
    }
  });
}

// Sea pickles: little olive-green pickles with a sprout on top.
const PICKLE = [0x4a5a1a, 0x5e7020, 0x74882a, 0x8aa034];
def('sea_pickle', (t) => quantize(t, t.field([[2, 4, 0.5]], 0.3), PICKLE));
def('sea_pickle_item', (t) => {
  t.clear();
  for (const [x0, y0] of [[3, 6], [8, 4], [6, 9]]) {
    for (let y = 0; y < 6; y++) for (let x = 0; x < 3; x++) t.set(x0 + x, y0 + y, PICKLE[(x + y) % 4]);
    t.set(x0 + 1, y0 - 1, 0xb8d050);
  }
});
def('kelp_item', (t) => {
  t.clear();
  for (let k = 0; k < 10; k++) { t.set(3 + k, 12 - k, KELP[1]); t.set(4 + k, 12 - k, KELP[2]); t.set(3 + k, 13 - k, KELP[0]); }
});
// Dried kelp: dark, wrinkled leaves (and bundled into a block).
const DRIED = [0x2a2c1e, 0x363a26, 0x444a30, 0x535a3a];
def('dried_kelp', (t) => {
  t.clear();
  for (let y = 4; y < 12; y++) for (let x = 3; x < 13; x++) if (Math.abs(x - 8) + Math.abs(y - 8) * 1.5 < 7) t.set(x, y, DRIED[(x + y * 3) % 4]);
});
def('dried_kelp_side', (t) => {
  quantize(t, t.field([[16, 1, 0.5], [4, 1, 0.3]], 0.3), DRIED);
  for (let x = 0; x < 16; x++) { t.set(x, 7, 0xd8c8a0); t.set(x, 8, 0xc0b088); }
});
def('dried_kelp_top', (t) => quantize(t, t.field([[2, 2, 0.5], [4, 4, 0.3]], 0.4), DRIED));
def('dried_kelp_bottom', (t) => quantize(t, t.field([[2, 2, 0.5], [4, 4, 0.3]], 0.4), DRIED));

// Shark: its steak, raw and cooked (the game takes these from the beef steak in the pack), and a
// tooth, a white serrated triangle darkening to its root.
const steak = (pal) => (t) => {
  t.clear();
  for (let y = 4; y < 13; y++) for (let x = 2; x < 14; x++) {
    const d = Math.hypot((x - 7.5) / 6, (y - 8.5) / 4.4);
    if (d < 1) t.set(x, y, d > 0.8 ? pal[0] : pal[1 + ((x * 3 + y * 5) % (pal.length - 1))]);
  }
};
def('raw_shark', steak([0x4a525c, 0xc8969a, 0xdcb0ae, 0xecc8c2]));
def('cooked_shark', steak([0x3c2a1e, 0x7e5634, 0x9c7042, 0xb88c56]));
def('shark_tooth', (t) => {
  t.clear();
  // Each row's left and right edge, tip to root; the edges are notched, and the root is darker.
  const ROWS = [[9, 9], [9, 10], [8, 10], [8, 11], [7, 11], [7, 12], [6, 12], [5, 12], [4, 13], [3, 13], [4, 12], [5, 11]];
  const LINE = [0x5e574a, 0x7a7262], BODY = [0xf4f1e8, 0xe2dccd, 0xc9c1ae], ROOT = [0xa89c84, 0x857a64];
  ROWS.forEach(([a, b], k) => {
    const y = 2 + k, root = k >= 10;
    for (let x = a; x <= b; x++) {
      const edge = x === a || x === b || k === 0;
      const body = root ? ROOT[k - 10] : BODY[x - a < (b - a) * 0.4 ? 0 : x - a < (b - a) * 0.75 ? 1 : 2];
      t.set(x, y, edge ? LINE[(k + (x === a ? 0 : 1)) & 1] : body);
    }
  });
});
