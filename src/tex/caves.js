// The cave update's textures: tuff and dripstone, lush-cave moss, vines and blossoms, glow lichen,
// amethyst, cobwebs and raw ore blocks. The game takes them from Mineclonia and Pixel Perfection
// (see tools/texture-sources.mjs); these drawings are the fallback in their colours.
import { def, quantize, shade } from './core.js';

const block = (name, pal, layers = [[4, 4, 0.5], [2, 2, 0.3]], grain = 0.3) => def(name, (t) => quantize(t, t.field(layers, grain), pal));
block('tuff', [0x4d4d45, 0x5b5a52, 0x6b6a61, 0x7a796f, 0x8a887d]);
block('dripstone_block', [0x6f5445, 0x836452, 0x94735e, 0xa4826b, 0xb59378], [[16, 2, 0.5], [4, 1, 0.3]]);
block('smooth_basalt', [0x3b3a3e, 0x444347, 0x4d4c50, 0x57565a], [[8, 8, 0.4], [2, 2, 0.2]], 0.4);
block('raw_copper_block', [0x8e4a2e, 0xa65a38, 0xc06f48, 0xd98a5e, 0xeaa27a], [[2, 2, 0.5], [4, 4, 0.3]], 0.4);
block('raw_gold_block', [0xa77a1c, 0xc9981f, 0xe0b52b, 0xf2cd47, 0xfbe27a], [[2, 2, 0.5], [4, 4, 0.3]], 0.4);
block('moss_block', [0x485d22, 0x56702a, 0x648230, 0x72933a, 0x83a546], [[2, 2, 0.5], [4, 4, 0.3]], 0.5);
block('rooted_dirt', [0x5b3c27, 0x6d4a32, 0x7a5439, 0x946a4a, 0xb08463], [[2, 2, 0.5], [8, 8, 0.2]], 0.5);
block('amethyst_block', [0x5a3c8c, 0x7652ac, 0x8e67c8, 0xab86de, 0xcfb3f2], [[2, 2, 0.6], [4, 4, 0.3]], 0.3);
block('budding_amethyst', [0x4c2f7c, 0x6a479e, 0x8561bd, 0xa27fd6, 0xd8c0f8], [[2, 2, 0.6], [4, 4, 0.3]], 0.4);
block('azalea_leaves', [0x4a6a1e, 0x5a7d26, 0x6b902e, 0x7da23a], [[2, 2, 0.6]], 0.5);
block('azalea_top', [0x4a6a1e, 0x5a7d26, 0x6b902e, 0x7da23a], [[2, 2, 0.6]], 0.5);

// Leaves with pink flowers dotted over them.
const flowered = (t, base) => {
  quantize(t, t.field([[2, 2, 0.6]], 0.5), base);
  for (let k = 0; k < 7; k++) {
    const x = t.ri(15), y = t.ri(15);
    t.set(x, y, 0xe38fcf); t.set(x + 1, y, 0xc462b0); t.set(x, y + 1, 0xc462b0); t.set(x + 1, y + 1, 0xf3b6e6);
  }
};
const GREEN = [0x4a6a1e, 0x5a7d26, 0x6b902e, 0x7da23a];
def('flowering_azalea_leaves', (t) => flowered(t, GREEN));
def('flowering_azalea_top', (t) => flowered(t, GREEN));
// Bush sides: leaves over the top half only.
const bushSide = (flowers) => (t) => {
  if (flowers) flowered(t, GREEN); else quantize(t, t.field([[2, 2, 0.6]], 0.5), GREEN);
  for (let y = 9; y < 16; y++) for (let x = 0; x < 16; x++) if (y > 10 || t.r() < 0.5) t.set(x, y, 0, 0);
};
def('azalea_side', bushSide(false));
def('flowering_azalea_side', bushSide(true));
def('azalea_plant', (t) => {
  t.clear();
  for (let y = 8; y < 16; y++) { t.set(7, y, 0x5b4128); t.set(8, y, 0x70512f); }
});

// Pointed dripstone: a tapering spike, widest at the root. Stalactites (down) hang from the top
// edge; stalagmites (up) are the same pictures turned over.
const DRIP = [0x6f5445, 0x836452, 0x94735e, 0xa4826b];
const WIDTH = { base: [6, 6], middle: [5, 5], frustum: [4, 2], tip: [2, 0], tip_merge: [2, 1] };
for (const part of Object.keys(WIDTH)) {
  for (const up of [true, false]) {
    def(`pointed_dripstone_${up ? 'up' : 'down'}_${part}`, (t) => {
      t.clear();
      const [w0, w1] = WIDTH[part];
      for (let y = 0; y < 16; y++) {
        const w = Math.round(w0 + (w1 - w0) * (y / 15));
        const row = up ? 15 - y : y;
        for (let x = 8 - Math.ceil(w / 2); x < 8 + Math.floor(w / 2) + (w ? 0 : 1); x++) t.set(x, row, DRIP[(x + y) % DRIP.length]);
      }
    });
  }
}

// Hanging plants: a stem down the middle with leaves off it (and berries on the lit ones).
const vine = (berries, tip) => (t) => {
  t.clear();
  for (let y = 0; y < (tip ? 13 : 16); y++) { t.set(7, y, 0x5b4128); t.set(8, y, 0x70512f); }
  for (let y = 1; y < 15; y += 3) {
    const s = y % 2 ? 1 : -1;
    t.set(8 + s * 2, y, 0x5a7d26); t.set(8 + s, y, 0x6b902e); t.set(8 + s * 2, y + 1, 0x4a6a1e);
  }
  if (berries) for (const [x, y] of [[5, 5], [10, 10], [5, 13]]) { t.set(x, y, 0xf2a93b); t.set(x + 1, y, 0xffcf5a); t.set(x, y + 1, 0xd47a1c); t.set(x + 1, y + 1, 0xf2a93b); }
};
def('cave_vines', vine(false, true));
def('cave_vines_lit', vine(true, true));
def('cave_vines_plant', vine(false, false));
def('cave_vines_plant_lit', vine(true, false));
def('hanging_roots', (t) => {
  t.clear();
  for (const x0 of [3, 7, 11]) { let x = x0; for (let y = 0; y < 10 + t.ri(5); y++) { t.set(x, y, y % 3 ? 0x8a6448 : 0x6d4a32); if (t.r() < 0.3) x += t.r() < 0.5 ? 1 : -1; } }
});
def('spore_blossom_hanging', (t) => {
  t.clear();
  for (let x = 5; x < 11; x++) t.set(x, 1, 0xb89a2c);
  for (let y = 2; y < 9; y++) for (let x = 5 + (y >> 2); x < 11 - (y >> 2); x++) t.set(x, y, y < 4 ? 0xd65fa0 : 0xef8fc4);
});
def('glow_lichen', (t) => {
  t.clear();
  for (let k = 0; k < 9; k++) {
    const x = t.ri(14), y = t.ri(14);
    t.set(x, y, 0x8fa89a); t.set(x + 1, y, 0x6f8a7c); t.set(x, y + 1, 0x6f8a7c); if (t.r() < 0.5) t.set(x + 1, y + 1, 0xb2cbbd);
  }
});
def('big_dripleaf_top', (t) => {
  t.clear();
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
    const d = Math.hypot(x - 7.5, y - 7.5);
    if (d < 7.8) t.set(x, y, d < 1.2 || x === 7 || x === 8 ? 0x4f7a1f : [0x5f8f27, 0x6ba22e, 0x7ab436][(x * 3 + y * 5) % 3]);
  }
});
def('big_dripleaf_side', (t) => { t.clear(); for (let x = 0; x < 16; x++) t.set(x, 0, 0x5f8f27); });
def('big_dripleaf_stem', (t) => { t.clear(); for (let y = 0; y < 16; y++) { t.set(7, y, 0x4f7a1f); t.set(8, y, 0x5f8f27); } });

// Amethyst crystals: a cluster of purple shards growing from the bottom edge (upside down for the
// ones hanging from a ceiling).
const CRYSTAL = [0x5a3c8c, 0x8e67c8, 0xab86de, 0xe7d6ff];
const SHARDS = { small_amethyst_bud: [[8, 3]], medium_amethyst_bud: [[6, 4], [9, 5]], large_amethyst_bud: [[5, 6], [8, 8], [11, 5]],
  amethyst_cluster: [[4, 8], [8, 12], [12, 7], [6, 5], [10, 6]] };
for (const [name, shards] of Object.entries(SHARDS)) {
  for (const up of [true, false]) {
    def(up ? name : `${name}_down`, (t) => {
      t.clear();
      for (const [cx, h] of shards) {
        for (let y = 0; y < h; y++) {
          const row = up ? 15 - y : y;
          t.set(cx, row, CRYSTAL[y === h - 1 ? 3 : 1]); t.set(cx + 1, row, CRYSTAL[y === h - 1 ? 2 : 0]);
          if (y < h - 2) t.set(cx - 1, row, CRYSTAL[2]);
        }
      }
    });
  }
}
def('cobweb', (t) => {
  t.clear();
  const c = 0xe6e6e6;
  for (let i = 0; i < 16; i++) { t.set(i, i, c); t.set(15 - i, i, c); t.set(7, i, c); t.set(i, 8, c); }
  for (const r of [3, 6]) for (let a = 0; a < 24; a++) t.set(Math.round(7.5 + Math.cos(a / 3.8) * r), Math.round(7.5 + Math.sin(a / 3.8) * r), shade(c, 0.9));
});

// ---------------------------------------------------------------- items
def('glow_berries', (t) => {
  t.clear();
  for (let y = 5; y < 14; y++) for (let x = 4; x < 13; x++) if (Math.hypot(x - 8, y - 9.5) < 4.2) t.set(x, y, y < 8 ? 0xffcf5a : y < 11 ? 0xf2a93b : 0xd47a1c);
  t.set(8, 3, 0x5b4128); t.set(8, 4, 0x5b4128); t.set(9, 2, 0x6b902e); t.set(10, 2, 0x5a7d26);
});
def('amethyst_shard', (t) => {
  t.clear();
  for (let k = 0; k < 9; k++) { t.set(4 + k, 12 - k, CRYSTAL[2]); t.set(5 + k, 12 - k, CRYSTAL[1]); t.set(4 + k, 13 - k, CRYSTAL[0]); }
  t.set(13, 3, CRYSTAL[3]);
});
