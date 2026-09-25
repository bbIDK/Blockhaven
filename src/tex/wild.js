// The wildlife update's textures: venison and bear meat (raw and cooked) and bamboo. The game takes
// them from Pixel Perfection (see tools/texture-sources.mjs); these drawings are the fallback in
// their colours.
import { def } from './core.js';

// A steak: a rounded slab, its rim darker, marbled with fat.
const steak = (pal, fat) => (t) => {
  t.clear();
  for (let y = 4; y < 13; y++) for (let x = 2; x < 14; x++) {
    const d = Math.hypot((x - 7.5) / 6, (y - 8.5) / 4.4);
    if (d >= 1) continue;
    t.set(x, y, d > 0.8 ? pal[0] : (x * 5 + y * 3) % 7 === 0 ? fat : pal[1 + ((x + y * 2) % (pal.length - 1))]);
  }
};
def('raw_venison', steak([0x3a1414, 0x7a2628, 0x96343a, 0xae4a4c], 0xe0968a));
def('cooked_venison', steak([0x2a1810, 0x5e3624, 0x74462e, 0x8c5a3a], 0xa87250));
def('raw_bear', steak([0x2e1216, 0x642228, 0x7c2c34, 0x983e44], 0xcc8078));
def('cooked_bear', steak([0x241410, 0x52301e, 0x684028, 0x805236], 0x9a6a48));
// Bamboo: a jointed green cane with a few leaves.
const CANE = [0x5a7a1e, 0x6e9228, 0x86aa34], LEAF = [0x3e6a1a, 0x4e8222];
def('bamboo', (t) => {
  t.clear();
  for (let y = 0; y < 16; y++) for (let x = 7; x < 10; x++) t.set(x, y, y % 5 === 4 ? 0x9ab848 : CANE[x - 7]);
  for (const [x, y, dx] of [[10, 3, 1], [6, 8, -1], [10, 12, 1]]) for (let k = 0; k < 4; k++) t.set(x + dx * k, y - (k >> 1), LEAF[k & 1]);
});
def('bamboo_item', (t) => {
  t.clear();
  for (let k = 0; k < 12; k++) { t.set(3 + k, 13 - k, CANE[1]); t.set(4 + k, 13 - k, CANE[2]); t.set(3 + k, 14 - k, CANE[0]); if (k % 4 === 3) t.set(4 + k, 13 - k, 0x9ab848); }
  for (let k = 0; k < 3; k++) { t.set(13 - k, 3 + k, LEAF[1]); t.set(12 - k, 3 + k, LEAF[0]); }
});
