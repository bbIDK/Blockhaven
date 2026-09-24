// Textures for things that aren't blocks or items: the player's arm, other players, creatures,
// particles, weather, flames and the cracks that spread over a block being broken.
import { mulberry32 } from '../math.js';
import { def, Tex, pick, quantize } from './core.js';

// ---------------------------------------------------------------- player hand
const SKIN = [0xb77e5a, 0xc68e6a, 0xcf9874, 0xd6a07c];
def('player_skin', (t) => quantize(t, t.field([[4, 4, 0.5], [2, 2, 0.2]], 0.3), SKIN, [0.1, 0.35, 0.4, 0.15]));
def('player_sleeve', (t) => quantize(t, t.field([[2, 2, 0.5], [4, 4, 0.2]], 0.3), [0x28707e, 0x2f7d8c, 0x348a9a, 0x3a96a6], [0.1, 0.35, 0.4, 0.15]));

// ---------------------------------------------------------------- other players
// A 64x32 skin in the classic layout (head at the top left, legs, body and arms below), cut into
// the 16x16 tiles the model uses. The shirt and trousers are grey so that each player's own
// colours can be tinted in (see avatars.js).
let avatarSkin = null;
function avatarSkinPixels() {
  if (avatarSkin) return avatarSkin;
  const px = new Int32Array(64 * 32).fill(-1);
  const rnd = mulberry32(911);
  const from = (pal) => pal[Math.floor(rnd() * pal.length)];
  const HAIR = [0x3b2414, 0x46291a, 0x33200f];
  const SHIRT = [0xd2d2d2, 0xdcdcdc, 0xe6e6e6], PANTS = [0xc4c4c4, 0xcecece, 0xbababa], SHOES = [0x4a4a4a, 0x3e3e3e];
  const regions = (u, v, w, h, d) => ({
    top: [u + d, v, w, d], bottom: [u + d + w, v, w, d],
    right: [u, v + d, d, h], front: [u + d, v + d, w, h], left: [u + d + w, v + d, d, h], back: [u + 2 * d + w, v + d, w, h],
  });
  const paint = ([x0, y0, w, h], pick) => {
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) px[(y0 + y) * 64 + x0 + x] = pick(x, y);
  };
  const head = regions(0, 0, 8, 8, 8);
  const skin = SKIN.slice(1);
  paint(head.top, () => from(HAIR));
  paint(head.bottom, () => from(skin));
  paint(head.back, (x, y) => (y < 6 || (y === 6 && rnd() < 0.5) ? from(HAIR) : from(skin)));
  for (const side of [head.right, head.left]) paint(side, (x, y) => (y < 2 || (y < 4 && (x < 5 || rnd() < 0.3)) ? from(HAIR) : from(skin)));
  paint(head.front, (x, y) => {
    if (y < 2 || (y === 2 && (x === 0 || x === 7 || x === 3))) return from(HAIR);
    if (y === 4 && (x === 1 || x === 6)) return 0xf4f4f4;
    if (y === 4 && (x === 2 || x === 5)) return 0x3a2a60;
    if (y === 3 && x > 0 && x < 7 && x !== 3 && x !== 4) return 0x7a5238;
    if (y === 5 && (x === 3 || x === 4)) return 0xb07a58;
    if (y === 6 && x > 1 && x < 6) return x === 2 || x === 5 ? 0x9a6448 : 0x6e3c2c;
    return from(skin);
  });
  for (const [name, r] of Object.entries(regions(16, 16, 8, 12, 4))) {
    paint(r, (x, y) => (y === 11 && name !== 'top' && name !== 'bottom' ? 0x3a3a3a : from(SHIRT)));
  }
  for (const [name, r] of Object.entries(regions(40, 16, 4, 12, 4))) {
    paint(r, (x, y) => (name === 'top' || (name !== 'bottom' && y < 4) ? (y === 3 && name !== 'top' ? 0xb0b0b0 : from(SHIRT)) : from(skin)));
  }
  for (const [name, r] of Object.entries(regions(0, 16, 4, 12, 4))) {
    paint(r, (x, y) => (name === 'bottom' || (name !== 'top' && y >= 10) ? from(SHOES) : from(PANTS)));
  }
  avatarSkin = px;
  return px;
}
for (const tile of [0, 1, 4, 5, 6, 7]) {
  def(`avatar_${tile}`, (t) => {
    const px = avatarSkinPixels(), ox = (tile % 4) * 16, oy = (tile >> 2) * 16;
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
      const c = px[(oy + y) * 64 + ox + x];
      if (c < 0) t.set(x, y, 0, 0); else t.set(x, y, c);
    }
  });
}
// Armour worn by other players: plain brushed metal, tinted by material.
def('avatar_armor', (t) => {
  const n = t.noise(2);
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
    const v = 0xc8 + Math.round((n[y * 16 + x] - 0.5) * 40 + (t.r() - 0.5) * 16);
    t.set(x, y, (v << 16) | (v << 8) | v);
  }
});

// ---------------------------------------------------------------- creatures
function furry(t, pal, cell = 2) { quantize(t, t.field([[cell, cell, 0.5], [1, 1, 0.2]], 0.35), pal); }
function eyes(t, y, white, pupil, gap = 4) {
  const l = 8 - gap / 2 - 2, r = 8 + gap / 2;
  t.set(l, y, white); t.set(l + 1, y, pupil); t.set(r, y, pupil); t.set(r + 1, y, white);
}
const PIG = [0xe08780, 0xe9918c, 0xf0a19b, 0xf5aea8];
def('pig_skin', (t) => furry(t, PIG, 4));
def('pig_face', (t) => {
  furry(t, PIG, 4);
  eyes(t, 5, 0xffffff, 0x1a1a1a, 6);
  for (let y = 9; y < 13; y++) for (let x = 5; x < 11; x++) t.set(x, y, y === 9 || y === 12 ? 0xd9807a : 0xf2b8b2);
  t.set(6, 10, 0x8a4a46); t.set(9, 10, 0x8a4a46); t.set(6, 11, 0x8a4a46); t.set(9, 11, 0x8a4a46);
});
const WOOL = [0xd6d3cc, 0xe2e0da, 0xecebe6, 0xf6f5f2];
def('sheep_wool', (t) => furry(t, WOOL, 2));
def('sheep_face', (t) => {
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) t.set(x, y, y < 3 ? pick(WOOL, t.r()) : pick([0xcbb49c, 0xd4bea6, 0xc2aa90], t.r()));
  eyes(t, 7, 0xffffff, 0x1a1a1a, 6);
  for (let x = 6; x < 10; x++) t.set(x, 11, 0xe6a0a0);
  t.set(7, 12, 0x6b4a3a); t.set(8, 12, 0x6b4a3a);
});
const ZOMBIE = [0x3a6530, 0x457437, 0x507f40, 0x5a8a49];
def('zombie_skin', (t) => furry(t, ZOMBIE, 4));
def('zombie_face', (t) => {
  furry(t, ZOMBIE, 4);
  for (const x of [4, 5, 10, 11]) { t.set(x, 7, 0x0e1a0c); t.set(x, 8, 0x1e3a18); }
  for (let x = 6; x < 10; x++) t.set(x, 11, 0x24391e);
  t.set(7, 10, 0x2d4a25);
});
def('zombie_shirt', (t) => furry(t, [0x28767d, 0x2a7f86, 0x2f8b92, 0x35979e], 4));
def('zombie_pants', (t) => furry(t, [0x2e3378, 0x353a86, 0x3d4292, 0x454a9c], 4));
const COW = [0x36261a, 0x3f2d20, 0x46321f, 0x4f3a26];
const CREAM = [0xddd6c8, 0xe8e2d6, 0xf0ebe0];
def('cow_hide', (t) => {
  furry(t, COW, 4);
  const n = t.noise(4);
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) if (n[y * 16 + x] > 0.56) t.set(x, y, pick(CREAM, t.r()));
});
def('cow_face', (t) => {
  furry(t, COW, 4);
  for (let y = 0; y < 9; y++) for (let x = 6; x < 10; x++) t.set(x, y, pick(CREAM, t.r()));
  eyes(t, 6, 0xffffff, 0x1a1a1a, 6);
  for (let y = 10; y < 15; y++) for (let x = 4; x < 12; x++) t.set(x, y, pick([0xb89a86, 0xc4a690, 0xae907c], t.r()));
  t.set(5, 12, 0x3a2a24); t.set(10, 12, 0x3a2a24);
});
const FEATHERS = [0xdcdcd6, 0xe8e8e4, 0xf2f2f0, 0xfbfbf9];
def('chicken_feathers', (t) => furry(t, FEATHERS, 2));
def('chicken_face', (t) => {
  furry(t, FEATHERS, 2);
  t.set(3, 6, 0x111111); t.set(4, 6, 0x111111); t.set(11, 6, 0x111111); t.set(12, 6, 0x111111);
});
def('chicken_beak', (t) => furry(t, [0xd8932a, 0xe8a33a, 0xf0b44a], 4));
def('chicken_wattle', (t) => furry(t, [0xb82018, 0xc8281e, 0xd83a2e], 4));
def('chicken_legs', (t) => furry(t, [0xd8932a, 0xe8a33a], 4));

// ---------------------------------------------------------------- particles and weather
// Falling rain and snow, drawn in vertical sheets that scroll downwards, and rain splashes.
// (The rain texture is tiled four times across a column, so its one-pixel streaks come out thin.)
def('rain_fall', (t) => {
  t.clear();
  for (let x = 0; x < 16; x++) {
    if (t.r() < 0.45) continue;
    const y0 = t.ri(16), len = 5 + t.ri(6);
    for (let k = 0; k < len; k++) t.set(x, (y0 + k) & 15, k >= len - 2 ? 0xe4ecff : 0xb4c8f0, 90 + t.ri(70));
  }
});
def('snow_fall', (t) => {
  t.clear();
  for (let i = 0; i < 5; i++) t.set(t.ri(16), t.ri(16), 0xffffff, 225);
});
def('splash', (t) => { for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) t.set(x, y, pick([0x9fbef0, 0xc8dcff, 0x7fa4e0], t.r())); });
// Blood from hits on animals and monsters.
def('blood', (t) => { for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) t.set(x, y, pick([0x5c0808, 0x760c0c, 0x921212, 0xaa1a1a], t.r())); });
// Critical-hit sparks.
def('crit', (t) => { for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) t.set(x, y, pick([0xfff3b0, 0xffffff, 0xffd766], t.r())); });
// Hearts (animals in love, tamed wolves), green sparks (a good trade) and a storm cloud (an
// angry villager). Particles show a few pixels of these, so they're drawn as solid colour.
def('heart', (t) => { for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) t.set(x, y, pick([0xd01830, 0xf03048, 0xff6a80], t.r())); });
def('happy', (t) => { for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) t.set(x, y, pick([0x2aa84a, 0x4ad86a, 0x9af8b0], t.r())); });
def('angry', (t) => { for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) t.set(x, y, pick([0x3a3a3a, 0x505050, 0x6a6a6a], t.r())); });
def('bubble', (t) => { for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) t.set(x, y, pick([0xa8d0ff, 0xd8ecff, 0xffffff], t.r()), 200); });
// A puff of smoke (mob deaths, burning zombies, water on lava).
def('smoke', (t) => {
  t.clear();
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
    const d = Math.hypot(x - 7.5, y - 7.5) + (t.r() - 0.5) * 1.8;
    if (d < 6.8) t.set(x, y, d < 2.6 ? 0xf6f6f6 : d < 4.8 ? 0xdcdcdc : 0xbababa);
  }
});

// Fire: eight frames of flame tongues rising through scrolling noise, so the animation loops
// (the renderer steps through consecutive layers).
{
  const PAL = [0x6e1204, 0x9c2206, 0xc83c0c, 0xe46214, 0xf48c20, 0xfbb834, 0xffdf6a, 0xfff4c4];
  const seed = new Tex('fire');
  const n1 = seed.noise(4, 4), n2 = seed.noise(2, 2), tongues = seed.noise(4, 16), tongues2 = seed.noise(2, 16);
  for (let f = 0; f < 8; f++) {
    def(`fire_${f}`, (t) => {
      t.clear();
      for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
        const up = 15 - y;
        // Tongue height sways from frame to frame; the noise rises through it.
        const h = 5 + tongues[x] * 9 + tongues2[(x + f) & 15] * 5 * Math.sin((f / 8) * Math.PI * 2 + x) ** 2;
        const a = n1[((y + f * 2) & 15) * 16 + x], b = n2[((y + f * 4) & 15) * 16 + ((x + 5) & 15)];
        const v = 1 - up / h + (0.5 - a) * 0.55 + (0.5 - b) * 0.35;
        if (v < 0.05) continue;
        t.set(x, y, pick(PAL, Math.min(0.999, v * 0.95 + (up < 2 ? 0.25 : 0))));
      }
    }, { group: f === 0 ? 8 : 1 });
  }
}

// Cracks spreading from the middle of a block as it's broken, in ten stages: branches reach
// out towards the edges and split as they go.
{
  const rnd = mulberry32(0xc2ac);
  const branches = [];
  const grow = (x, y, dir, len, depth) => {
    const pts = [];
    for (let i = 0; i < len; i++) {
      dir += (rnd() - 0.5) * 0.7;
      x += Math.cos(dir); y += Math.sin(dir);
      if (x < 0 || y < 0 || x > 15.9 || y > 15.9) break;
      pts.push([Math.floor(x), Math.floor(y)]);
      if (depth < 2 && i > 1 && rnd() < 0.25) grow(x, y, dir + (rnd() < 0.5 ? -1 : 1) * (0.6 + rnd() * 0.5), 2 + Math.floor(rnd() * 4), depth + 1);
    }
    branches.push({ pts, depth });
  };
  for (let k = 0; k < 7; k++) grow(7.5, 7.5, (k / 7) * Math.PI * 2 + rnd() * 0.6, 4 + Math.floor(rnd() * 6), 0);
  for (let stage = 0; stage < 10; stage++) {
    def(`destroy_${stage}`, (t) => {
      t.clear();
      const k = (stage + 1) / 10;
      for (const { pts, depth } of branches) {
        const n = Math.round(pts.length * Math.min(1, k * 1.6 - depth * 0.35));
        for (let i = 0; i < n; i++) { const [x, y] = pts[i]; t.set(x, y, 0x161616, 215); if (x + 1 < 16 && !t.alpha(x + 1, y)) t.set(x + 1, y, 0xffffff, 55); }
      }
    });
  }
}
