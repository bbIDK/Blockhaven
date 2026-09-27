// Generator 10's structures' textures: prismarine and sea lanterns (ocean monuments), sponges, end
// stone and the end portal frame (strongholds), dispensers and tripwire (jungle temples), and the
// guardians' prismarine shards and crystals. The game takes them from Pixel Perfection (see
// tools/texture-sources.mjs); these drawings are the fallback, in their colours.
import { def, quantize } from './core.js';

const PRISMARINE = [0x3b6a60, 0x4d8474, 0x5f9b88, 0x72b19c, 0x8cc7b2];
const DARK = [0x1d3a33, 0x28493f, 0x33594c, 0x3f6a5a];

def('prismarine', (t) => quantize(t, t.field([[4, 4, 0.45], [8, 8, 0.35], [2, 2, 0.2]], 0.15), PRISMARINE));
def('prismarine_bricks', (t) => {
  quantize(t, t.field([[4, 4, 0.5], [2, 2, 0.3]], 0.25), PRISMARINE.slice(1));
  // Four rows of bricks, half a brick apart, with dark joints.
  for (let y = 0; y < 16; y += 4) {
    for (let x = 0; x < 16; x++) t.set(x, y, 0x3a665a);
    const off = (y >> 2) % 2 ? 4 : 0;
    for (let dy = 1; dy < 4; dy++) { t.set(off, y + dy, 0x3a665a); t.set((off + 8) & 15, y + dy, 0x3a665a); }
  }
});
def('dark_prismarine', (t) => {
  quantize(t, t.field([[4, 4, 0.5], [2, 2, 0.3]], 0.2), DARK);
  // A frame and a cross of darker lines, like panels.
  for (let i = 0; i < 16; i++) {
    t.set(i, 0, 0x14291f); t.set(0, i, 0x14291f); t.set(i, 8, 0x162c25); t.set(8, i, 0x162c25);
  }
});
def('sea_lantern', (t) => {
  quantize(t, t.field([[4, 4, 0.5], [2, 2, 0.3]], 0.3), [0xa9cfc3, 0xc3e1d6, 0xdcefe8, 0xf1faf6]);
  // Glowing bars across a pale frame.
  for (let i = 0; i < 16; i++) { t.set(i, 0, 0x8fb8ab); t.set(0, i, 0x8fb8ab); t.set(i, 15, 0x7aa596); t.set(15, i, 0x7aa596); }
  for (let y = 3; y < 13; y += 3) for (let x = 3; x < 13; x++) t.set(x, y, 0xffffff);
});
// A sponge: yellow and full of holes (a soaked one darker, the holes bigger).
const sponge = (pal, hole, holes) => (t) => {
  quantize(t, t.field([[4, 4, 0.5], [2, 2, 0.3]], 0.3), pal);
  for (let k = 0; k < holes; k++) {
    const x = t.ri(15), y = t.ri(15);
    t.set(x, y, hole); if (k % 2) t.set(x + 1, y, hole);
  }
};
def('sponge', sponge([0xa8a22c, 0xc2bb3c, 0xd6cf4c, 0xe6df62], 0x807a1a, 14));
def('wet_sponge', sponge([0x7e7a1c, 0x98922a, 0xaaa436, 0xbab444], 0x4e4a0e, 22));
const END_STONE = [0xc7c58a, 0xd6d49a, 0xdedca4, 0xe8e6b2, 0xf0efc0];
def('end_stone', (t) => quantize(t, t.field([[4, 4, 0.5], [2, 2, 0.3]], 0.35), END_STONE));
def('end_portal_frame_top', (t) => {
  quantize(t, t.field([[4, 4, 0.5]], 0.3), [0x2d4a3c, 0x365a48, 0x406a55]);
  // An inset of end stone round a dark socket.
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
    const edge = Math.min(x, y, 15 - x, 15 - y);
    if (edge < 2) t.set(x, y, END_STONE[(x * 7 + y * 3) % 5]);
    else if (edge === 2) t.set(x, y, 0x5d8a70);
  }
});
def('end_portal_frame_side', (t) => {
  quantize(t, t.field([[4, 4, 0.5], [2, 2, 0.3]], 0.35), END_STONE);
  for (let x = 0; x < 16; x++) for (let y = 0; y < 4; y++) t.set(x, y, [0x406a55, 0x365a48, 0x2d4a3c, 0x5d8a70][y]);
});
def('end_portal_frame_eye', (t) => {
  t.clear();
  // An ender eye, seen from above: green round a dark pupil.
  for (let y = 4; y < 12; y++) for (let x = 4; x < 12; x++) {
    const d = Math.hypot(x - 7.5, y - 7.5);
    if (d < 4) t.set(x, y, d < 1.6 ? 0x0c2418 : d < 2.8 ? 0x2f8a52 : 0x1f5e3a);
  }
});
def('dispenser_front', (t) => {
  quantize(t, t.field([[4, 4, 0.5], [2, 2, 0.3]], 0.3), [0x5a5a5a, 0x6a6a6a, 0x7a7a7a, 0x8a8a8a]);
  // A frame of smooth stone round a dark mouth.
  for (let i = 0; i < 16; i++) { t.set(i, 0, 0x9a9a9a); t.set(0, i, 0x9a9a9a); t.set(i, 15, 0x4a4a4a); t.set(15, i, 0x4a4a4a); }
  for (let y = 5; y < 11; y++) for (let x = 5; x < 11; x++) t.set(x, y, Math.hypot(x - 7.5, y - 7.5) < 2.6 ? 0x141414 : 0x2e2e2e);
});
def('tripwire', (t) => {
  t.clear();
  // A thread across the middle.
  for (let x = 0; x < 16; x++) t.set(x, 7, (x & 3) === 1 ? 0xb4b4b4 : 0xdedede);
});
def('tripwire_hook', (t) => {
  t.clear();
  // Grey iron: a ring on a short shank.
  for (let y = 2; y < 8; y++) { t.set(5, y, 0x8c8c8c); t.set(10, y, 0x6e6e6e); }
  for (let x = 5; x < 11; x++) { t.set(x, 2, 0xa8a8a8); t.set(x, 7, 0x707070); }
  for (let y = 8; y < 14; y++) { t.set(7, y, 0x9a9a9a); t.set(8, y, 0x7c7c7c); }
});
def('prismarine_shard', (t) => {
  t.clear();
  // A long, pointed shard, lit along one side.
  for (let i = 0; i < 11; i++) {
    const x = 3 + i, y = 13 - i;
    t.set(x, y, 0x5f9b88); t.set(x + 1, y, 0x8cc7b2); t.set(x, y - 1, 0x3b6a60);
    if (i > 2 && i < 9) t.set(x + 1, y - 1, 0xb3e0cf);
  }
});
def('prismarine_crystals', (t) => {
  t.clear();
  // A cluster of pale glinting crystals.
  for (const [cx, cy, r] of [[5, 10, 3], [10, 6, 3], [11, 11, 2], [6, 4, 2]]) {
    for (let y = cy - r; y <= cy + r; y++) for (let x = cx - r; x <= cx + r; x++) {
      if (Math.abs(x - cx) + Math.abs(y - cy) > r) continue;
      t.set(x, y, (x + y) % 3 === 0 ? 0xffffff : (x - cx) + (y - cy) < 0 ? 0xd8f2ea : 0x9ccfbf);
    }
  }
});
