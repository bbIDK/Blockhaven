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
// Bamboo: a jointed green cane, bare down the stalk, with a few leaves on the segment below the top
// and more on the top one (the mesher picks which).
const CANE = [0x385c16, 0x45711b, 0x538522], JOINT = 0x74ab36, LEAF = [0x284f10, 0x336415, 0x3f781a];
const cane = (t) => { for (let y = 0; y < 16; y++) for (let x = 7; x < 10; x++) t.set(x, y, y % 5 === 4 ? JOINT : CANE[x - 7]); };
const leaves = (t, sprigs) => { for (const [x, y, dx] of sprigs) for (let k = 0; k < 4; k++) t.set(x + dx * k, y - (k >> 1), LEAF[k % 3]); };
def('bamboo', (t) => { t.clear(); cane(t); leaves(t, [[10, 3, 1], [6, 4, -1], [10, 8, 1], [6, 10, -1], [10, 13, 1]]); });
def('bamboo_mid', (t) => { t.clear(); cane(t); leaves(t, [[10, 5, 1], [6, 11, -1]]); });
def('bamboo_stalk', (t) => { t.clear(); cane(t); });
def('bamboo_item', (t) => {
  t.clear();
  for (let k = 0; k < 12; k++) { t.set(3 + k, 13 - k, CANE[1]); t.set(4 + k, 13 - k, CANE[2]); t.set(3 + k, 14 - k, CANE[0]); if (k % 4 === 3) t.set(4 + k, 13 - k, 0x9ab848); }
  for (let k = 0; k < 3; k++) { t.set(13 - k, 3 + k, LEAF[1]); t.set(12 - k, 3 + k, LEAF[0]); }
});
