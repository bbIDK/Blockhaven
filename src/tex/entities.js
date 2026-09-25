// Textures for things that aren't blocks or items: arrows, particles, weather, flames and the
// cracks that spread over a block being broken. (Players and creatures wear skins: see
// tex/mobskins.js.)
import { mulberry32 } from '../math.js';
import { def, Tex, pick } from './core.js';

// ---------------------------------------------------------------- arrows
// An arrow in flight, lying along the texture: flint head on the right, fletching on the left
// (rows 5-9; the entity shows it on two crossed strips).
def('arrow_entity', (t) => {
  t.clear();
  for (let x = 3; x < 13; x++) { t.set(x, 7, x % 3 ? 0x8a6a3a : 0x6e522c); t.set(x, 6, 0x9e7c48); }
  for (const [x, y, c] of [[13, 5, 0x5a5a5a], [13, 6, 0x9a9a9a], [14, 6, 0x7a7a7a], [13, 7, 0xb4b4b4], [14, 7, 0x9a9a9a], [15, 7, 0x6a6a6a],
    [13, 8, 0x7a7a7a], [14, 8, 0x5a5a5a], [13, 9, 0x4a4a4a]]) t.set(x, y, c);
  for (const [x, y] of [[0, 5], [1, 5], [0, 6], [1, 6], [2, 6], [0, 8], [1, 8], [2, 8], [0, 9], [1, 9]]) t.set(x, y, (x + y) % 2 ? 0xe8e8e8 : 0xc8c8c8);
  t.set(2, 7, 0xd8d8d8); t.set(1, 7, 0xb8b8b8); t.set(0, 7, 0xa0a0a0);
});

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
// Endermen leave a trail of purple sparks when they blink away.
def('portal', (t) => { for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) t.set(x, y, pick([0x7a1ac8, 0xa040e8, 0xd08cff, 0x4a0a8a], t.r())); });
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
