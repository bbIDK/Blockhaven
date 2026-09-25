// Block textures: rock, soil, ores, wood, plants and everything built from them. Natural blocks
// tile seamlessly, keep their contrast low (so a wall of them reads as one surface) and take
// their light from the top left like the rest of the game's art.
import { def, pick, mix, shade, lighten, greys, cells, quantize, paint } from './core.js';

// ---------------------------------------------------------------- rock
// Palettes run dark to light. Weights say how much of each shade a texture gets.
const W6 = [0.05, 0.14, 0.27, 0.29, 0.17, 0.08];
const W5 = [0.08, 0.2, 0.36, 0.24, 0.12];

export const STONE = [0x626262, 0x6d6d6d, 0x767676, 0x7f7f7f, 0x898989, 0x959595];
// Stone: soft horizontal patches, like layers in the rock.
export function drawStone(t, pal = STONE) {
  quantize(t, t.field([[8, 4, 0.35], [4, 2, 0.4], [2, 1, 0.15]], 0.3), pal, W6);
}
def('stone', (t) => drawStone(t));

// A bevelled frame (polished and smooth blocks): lit on the top and left, shaded on the
// bottom and right.
export function frame(t, light, dark, inset = 0) {
  const a = inset, b = 15 - inset;
  for (let i = a; i <= b; i++) {
    t.set(i, a, light); t.set(a, i, light);
    t.set(i, b, dark); t.set(b, i, dark);
  }
  t.set(b, a, mix(light, dark, 0.5)); t.set(a, b, mix(light, dark, 0.5));
}

def('smooth_stone', (t) => {
  quantize(t, t.field([[8, 4, 0.5], [4, 2, 0.3]], 0.2), [0x9a9a9a, 0x9f9f9f, 0xa4a4a4, 0xa9a9a9], [0.15, 0.35, 0.35, 0.15]);
  frame(t, 0xb4b4b4, 0x828282);
});
def('smooth_stone_side', (t) => {
  quantize(t, t.field([[8, 4, 0.5], [4, 2, 0.3]], 0.2), [0x9a9a9a, 0x9f9f9f, 0xa4a4a4, 0xa9a9a9], [0.15, 0.35, 0.35, 0.15]);
  frame(t, 0xb4b4b4, 0x828282);
  for (let x = 1; x < 15; x++) { t.set(x, 7, 0x828282); t.set(x, 8, 0xb4b4b4); }
});

// Cobblestone: rounded stones set in dark mortar, each lit on its top-left side.
export function drawCobble(t, pal, mortar, count = 10) {
  const c = cells(t, count, 3.6);
  const tone = c.pts.map(() => 1 + t.ri(pal.length - 2));
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
    const i = y * 16 + x, e = c.edge[i];
    if (e < 0.75) { t.set(x, y, mortar[t.r() < 0.6 ? 0 : 1]); continue; }
    const rx = c.rel[i * 2], ry = c.rel[i * 2 + 1];
    let k = tone[c.id[i]];
    const lit = rx + ry;
    if (lit < -2.6) k += 1;
    else if (lit > 2.2 || e < 1.3) k -= 1;
    if (t.r() < 0.12) k += t.r() < 0.5 ? -1 : 1;
    t.set(x, y, pal[Math.max(0, Math.min(pal.length - 1, k))]);
  }
  return c;
}
const COBBLE = [0x585858, 0x686868, 0x777777, 0x848484, 0x929292, 0xa2a2a2];
def('cobblestone', (t) => drawCobble(t, COBBLE, [0x444444, 0x4d4d4d]));

// Moss grows in the joints first and creeps over the tops of the stones.
const MOSS = [0x3a4f22, 0x475f28, 0x546f2e, 0x627f35, 0x71903f];
function moss(t, amount, joint) {
  const n = t.field([[4, 4, 0.6], [2, 2, 0.3]], 0.25);
  for (let i = 0; i < 256; i++) {
    const v = n[i] + (joint(i) ? 0.3 : 0);
    if (v > 1.25 - amount) t.set(i & 15, i >> 4, pick(MOSS, (v - (1.25 - amount)) * 2.5 + t.r() * 0.3));
  }
}
def('mossy_cobblestone', (t) => {
  const c = drawCobble(t, COBBLE, [0x444444, 0x4d4d4d]);
  moss(t, 0.5, (i) => c.edge[i] < 1.2 || c.rel[i * 2 + 1] < -1.5);
});

// Granite, diorite, andesite: speckled rock; the polished kinds are smoother and bevelled.
const GRANITE = [0x875647, 0x956252, 0xa26e5d, 0xae7a68, 0xbb8773, 0xca9782];
const DIORITE = [0x9b9b9b, 0xb0b0b0, 0xbdbdbd, 0xc9c9c9, 0xd5d5d5, 0xe3e3e3];
const ANDESITE = [0x6c6c6c, 0x777777, 0x818181, 0x8a8a8a, 0x949494, 0xa1a1a1];
function speckled(t, pal, dots, n) {
  quantize(t, t.field([[2, 2, 0.45], [4, 4, 0.2]], 0.6), pal, W6);
  for (let k = 0; k < n; k++) {
    const x = t.ri(16), y = t.ri(16);
    t.wset(x, y, dots[0]);
    if (t.r() < 0.5) t.wset(x + 1, y, dots[1] ?? dots[0]);
  }
}
def('granite', (t) => speckled(t, GRANITE, [0xe0b3a0, 0x6e4535], 16));
def('diorite', (t) => speckled(t, DIORITE, [0x707070, 0x858585], 16));
def('andesite', (t) => speckled(t, ANDESITE, [0xadadad, 0x5f5f5f], 12));
function polished(t, pal) {
  quantize(t, t.field([[4, 4, 0.5], [2, 2, 0.2]], 0.3), pal.slice(1, 5), [0.15, 0.35, 0.35, 0.15]);
  frame(t, pal[5], pal[0]);
  frame(t, mix(pal[4], pal[3], 0.5), mix(pal[1], pal[2], 0.5), 1);
}
def('polished_granite', (t) => polished(t, GRANITE));
def('polished_diorite', (t) => polished(t, DIORITE));
def('polished_andesite', (t) => polished(t, ANDESITE));
def('calcite', (t) => quantize(t, t.field([[8, 4, 0.5], [4, 4, 0.3]], 0.25), [0xcacbc6, 0xd5d6d1, 0xdddeda, 0xe4e5e1, 0xeceeea], W5));

// Deepslate: dark, blue-grey, layered sideways; its top shows the cut ends of the layers.
export const DEEP = [0x38383d, 0x414146, 0x4a4a50, 0x535359, 0x5d5d63, 0x68686e];
export function drawDeepslate(t) { quantize(t, t.field([[8, 1, 0.5], [4, 1, 0.3], [2, 2, 0.1]], 0.25), DEEP, W6); }
def('deepslate', drawDeepslate);
def('deepslate_top', (t) => {
  quantize(t, t.field([[4, 4, 0.5], [2, 2, 0.3]], 0.3), DEEP, W6);
  for (let k = 0; k < 7; k++) { const x = t.ri(16), y = t.ri(16); t.wset(x, y, DEEP[0]); t.wset(x + 1, y, DEEP[0]); }
});
def('cobbled_deepslate', (t) => drawCobble(t, [0x2f2f34, 0x3b3b41, 0x46464c, 0x515157, 0x5d5d63, 0x6b6b71], [0x222226, 0x28282c], 11));
// Brick courses four pixels high; the joints are dark and each brick is bevelled.
function bricks(t, pal, mortar, { h = 4, w = 8, stagger = 4, bevel = true } = {}) {
  const rows = 16 / h;
  for (let r = 0; r < rows; r++) {
    const off = (r % 2) * stagger;
    const tones = Array.from({ length: 16 / w + 1 }, () => t.r());
    for (let y = r * h; y < r * h + h; y++) for (let x = 0; x < 16; x++) {
      const bx = (x - off + 16) % 16, bi = Math.floor(bx / w), yy = y - r * h;
      if (yy === h - 1 || bx % w === w - 1) { t.set(x, y, mortar[(x + y) % 3 === 0 ? 1 : 0]); continue; }
      let k = 1 + Math.floor(tones[bi] * (pal.length - 2) * 0.99);
      if (bevel && (yy === 0 || bx % w === 0)) k = Math.min(pal.length - 1, k + 1);
      else if (bevel && (yy === h - 2 || bx % w === w - 2)) k = Math.max(0, k - 1);
      if (t.r() < 0.18) k = Math.max(0, Math.min(pal.length - 1, k + (t.r() < 0.5 ? -1 : 1)));
      t.set(x, y, pal[k]);
    }
  }
}
def('deepslate_bricks', (t) => bricks(t, [0x3a3a3f, 0x45454a, 0x505055, 0x5b5b60, 0x68686d], [0x252528, 0x2c2c30], { h: 4, w: 8 }));

// ---------------------------------------------------------------- soil
export const DIRT = [0x5b3c27, 0x6d4a32, 0x7a5439, 0x865e42, 0x946a4a, 0xa67752];
export function drawDirt(t, pal = DIRT) {
  quantize(t, t.field([[2, 2, 0.45], [4, 4, 0.25]], 0.45), pal, [0.07, 0.16, 0.26, 0.26, 0.17, 0.08]);
  // A few pebbles, lit on top.
  for (let k = 0; k < 4; k++) {
    const x = t.ri(16), y = t.ri(16);
    t.wset(x, y, 0x8c8784); if (t.r() < 0.6) t.wset(x + 1, y, 0x6f6a67);
  }
}
def('dirt', (t) => drawDirt(t));
def('coarse_dirt', (t) => {
  drawDirt(t);
  const c = cells(t, 14, 2.5);
  for (let i = 0; i < 256; i++) {
    if (c.pts[c.id[i]][2] < 0.55 || c.edge[i] < 0.8) continue;
    const up = c.rel[i * 2 + 1] < -0.4;
    t.set(i & 15, i >> 4, up ? 0x8a7a6c : pick([0x6a5b4e, 0x75665a, 0x5d4f43], t.r()));
  }
});

// Grass is drawn in greys; the game tints it with the biome's grass colour.
const GRASS = greys(0x72, 0xb6, 6);
def('grass_top', (t) => {
  quantize(t, t.field([[2, 2, 0.35], [1, 2, 0.3], [4, 4, 0.15]], 0.5), GRASS, W6);
  for (let k = 0; k < 22; k++) {
    const x = t.ri(16), y = t.ri(16);
    t.wset(x, y, GRASS[5]); t.wset(x, y + 1, GRASS[3]);
  }
});
// The side of a grass block is dirt; the tinted fringe is a separate overlay in the next layer.
def('grass_side', (t) => drawDirt(t), { group: 2 });
function fringe(t, pal, drips) {
  for (let x = 0; x < 16; x++) {
    const depth = drips(x);
    for (let y = 0; y < depth; y++) {
      const tip = y === depth - 1;
      t.set(x, y, tip ? pal[t.r() < 0.5 ? 0 : 1] : pick(pal, 0.25 + t.r() * 0.75));
    }
  }
}
const drips = (t) => { const d = Array.from({ length: 16 }, () => 3 + (t.r() < 0.5 ? 1 : 0) + (t.r() < 0.2 ? 1 : 0)); d[t.ri(16)] = 6; return (x) => d[x]; };
def('grass_side_overlay', (t) => { t.clear(); fringe(t, GRASS, drips(t)); });
const SNOW = [0xd9e3e6, 0xe4ecee, 0xedf3f4, 0xf5f9f9, 0xfcfefe];
def('grass_side_snowy', (t) => { drawDirt(t); fringe(t, SNOW, drips(t)); });
def('podzol_top', (t) => {
  quantize(t, t.field([[2, 2, 0.4], [4, 4, 0.3]], 0.45), [0x4c2f16, 0x5b3a1c, 0x6a4622, 0x7a5229, 0x895e31, 0x9a6c3a], W6);
  for (let k = 0; k < 10; k++) { const x = t.ri(16), y = t.ri(16); t.wset(x, y, 0x3b2410); t.wset(x + 1, y + 1, 0x3b2410); }
});
def('podzol_side', (t) => { drawDirt(t); fringe(t, [0x4c2f16, 0x5b3a1c, 0x6a4622, 0x7a5229], drips(t)); });
// Paths are a pixel lower than a full block, so their side textures start one row down.
def('dirt_path_top', (t) => quantize(t, t.field([[2, 2, 0.4], [4, 4, 0.2]], 0.5), [0x7c6130, 0x896c37, 0x947640, 0x9f8049, 0xab8b53], W5));
def('dirt_path_side', (t) => {
  drawDirt(t);
  for (let x = 0; x < 16; x++) for (let y = 1; y < 3 + (t.r() < 0.4 ? 1 : 0); y++) t.set(x, y, pick([0x896c37, 0x947640, 0x9f8049], t.r()));
});
function farmland(t, pal) {
  quantize(t, t.field([[2, 2, 0.4], [4, 4, 0.2]], 0.5), pal.slice(1), W5);
  // Broken furrows: short dark scratches with a lit ridge above them.
  for (const y of [2, 6, 10, 14]) for (let x = 0; x < 16; x++) {
    if (((x + y * 3) % 7) === 5 || t.r() < 0.18) continue;
    t.set(x, y, pal[t.r() < 0.7 ? 0 : 1]);
    if (t.r() < 0.45) t.set(x, y - 1, pal[4]);
  }
  frame(t, pal[4], pal[0]);
}
def('farmland', (t) => farmland(t, [0x4a3120, 0x6b4a30, 0x7a5638, 0x856040, 0x916a47, 0x9e764f]));
def('farmland_moist', (t) => farmland(t, [0x281a10, 0x3b2819, 0x45301e, 0x4f3822, 0x593f27, 0x64472c]));

export const SAND = [0xc7b886, 0xd0c290, 0xd8ca99, 0xdfd2a1, 0xe5d9a9, 0xebe1b5];
function drawSand(t, pal, dark) {
  quantize(t, t.field([[2, 2, 0.3], [4, 4, 0.2]], 0.65), pal, [0.06, 0.15, 0.3, 0.27, 0.15, 0.07]);
  for (let k = 0; k < 6; k++) t.set(t.ri(16), t.ri(16), dark);
}
def('sand', (t) => drawSand(t, SAND, 0xb5a473));
const RED_SAND = [0xa24f1b, 0xad581f, 0xb86124, 0xc16a2b, 0xca7433, 0xd4813e];
def('red_sand', (t) => drawSand(t, RED_SAND, 0x8e4415));

def('gravel', (t) => {
  const pal = [0x5c5856, 0x6b6664, 0x7b7572, 0x8a8480, 0x99928d, 0x766960, 0x84776c, 0xa7a09a];
  const c = cells(t, 24, 2.3);
  const tone = c.pts.map(() => pal[t.ri(pal.length)]);
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
    const i = y * 16 + x;
    if (c.edge[i] < 0.6) { t.set(x, y, t.r() < 0.5 ? 0x45413f : 0x514d4a); continue; }
    const lit = c.rel[i * 2] + c.rel[i * 2 + 1];
    let col = tone[c.id[i]];
    if (lit < -1.2) col = lighten(col, 0.16); else if (lit > 1.1) col = shade(col, 0.8);
    t.set(x, y, col);
  }
});
def('clay', (t) => {
  quantize(t, t.field([[4, 4, 0.5], [8, 8, 0.3]], 0.25), [0x8e95a4, 0x959cab, 0x9ca3b1, 0xa3aab8, 0xabb2bf], W5);
  for (let k = 0; k < 5; k++) { const x = t.ri(16), y = t.ri(16); for (let i = 0; i < 3; i++) t.wset(x + i, y, 0x878e9d); }
});
def('snow', (t) => quantize(t, t.field([[4, 4, 0.4], [2, 2, 0.3]], 0.35), SNOW, [0.06, 0.2, 0.34, 0.28, 0.12]));
def('ice', (t) => {
  quantize(t, t.field([[8, 8, 0.5], [4, 4, 0.2]], 0.2), [0x77a1e6, 0x82abec, 0x8db4f0, 0x98bdf3], [0.2, 0.3, 0.3, 0.2]);
  for (let i = 0; i < 256; i++) t.d[i * 4 + 3] = 180;
  for (const [x0, y0, n] of [[2, 3, 5], [9, 1, 4], [6, 10, 5], [12, 9, 3]]) for (let i = 0; i < n; i++) t.wset(x0 + i, y0 + i, 0xd2e4ff, 215);
});
def('packed_ice', (t) => {
  quantize(t, t.field([[4, 4, 0.5], [8, 8, 0.3]], 0.2), [0x7a9fd6, 0x86abe0, 0x92b6e9, 0x9fc1f0, 0xadcbf4], W5);
  for (const [x0, y0, dx, dy, n] of [[1, 2, 1, 1, 6], [8, 0, 1, 1, 5], [4, 11, 1, -1, 5], [10, 9, 1, 1, 6]]) {
    for (let i = 0; i < n; i++) t.wset(x0 + i * dx, y0 + i * dy, 0xd8e8ff);
  }
});
def('obsidian', (t) => {
  quantize(t, t.field([[4, 4, 0.5], [2, 2, 0.3]], 0.35), [0x0d0916, 0x140e21, 0x1b132c, 0x241a39, 0x2e2247, 0x3c2d5c], W6);
  for (let k = 0; k < 5; k++) {
    const x = t.ri(16), y = t.ri(16);
    t.wset(x, y, 0x55437e); t.wset(x + 1, y, 0x44366a); t.wset(x, y + 1, 0x44366a);
  }
});
def('bedrock', (t) => {
  const c = cells(t, 12, 2.5);
  const tone = c.pts.map(() => t.r());
  const pal = [0x1c1c1c, 0x2e2e2e, 0x434343, 0x595959, 0x717171, 0x8c8c8c];
  for (let i = 0; i < 256; i++) {
    const v = c.edge[i] < 0.8 ? 0 : tone[c.id[i]] * 0.8 + t.r() * 0.35 - (c.rel[i * 2] + c.rel[i * 2 + 1]) * 0.05;
    t.set(i & 15, i >> 4, pick(pal, v));
  }
});
def('glowstone', (t) => {
  const pal = [0x7a5424, 0x9c6c30, 0xc08a41, 0xdcab58, 0xf2cc76, 0xfff0b0];
  const c = cells(t, 9, 3.5);
  for (let i = 0; i < 256; i++) {
    const d = Math.hypot(c.rel[i * 2], c.rel[i * 2 + 1]);
    t.set(i & 15, i >> 4, c.edge[i] < 0.7 ? pal[0] : pick(pal, 1.05 - d / 4.5 + t.r() * 0.15));
  }
});
// Magma-ish blocks and lava. Lava's crust is darker; the renderer makes it flow and glow.
def('lava', (t) => {
  const pal = [0xb72d0a, 0xcf3f0c, 0xe25711, 0xf07418, 0xfa9523, 0xffba3c, 0xffdc70];
  const f = t.field([[4, 4, 0.5], [8, 8, 0.3], [2, 2, 0.15]], 0.1);
  for (let i = 0; i < 256; i++) f[i] = 1 - Math.abs(f[i] - 0.5) * 2;
  quantize(t, f, pal, [0.1, 0.15, 0.2, 0.2, 0.17, 0.12, 0.06]);
});
// Water is pale so the biome's water colour can tint it (see the mesher).
def('water', (t) => {
  const pal = [0x9aa9c4, 0xa7b5cd, 0xb3c0d6, 0xc0cbde, 0xcdd6e6, 0xdae2ee];
  const f = new Float32Array(256);
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
    f[y * 16 + x] = Math.sin((x + Math.sin(y * 0.785) * 1.8) * 0.785 + y * 0.39) * 0.5 + t.r() * 0.35;
  }
  quantize(t, f, pal, [0.12, 0.2, 0.26, 0.2, 0.14, 0.08]);
  for (let i = 0; i < 256; i++) t.d[i * 4 + 3] = 178;
});

// ---------------------------------------------------------------- ores
// Ore nuggets: h highlight, l light, m mid, d dark, s the rock's shadow beneath.
const NUGGETS = {
  A: ['.hl..', 'hlmm.', '.mmds', '..ds.'],
  B: ['hl.', 'lmd', '.ds'],
  C: ['.hl', 'hmd', 'md.', 's..'],
  D: ['hll.', 'lmmd', '.mds'],
  E: ['.h..', 'hlm.', '.mdd', '..s.'],
  F: ['hl', 'md', 's.'],
  G: ['..hl', '.lmd', 'hmd.', 'md..'],
};
const LAYOUTS = [
  [[1, 1, 'A'], [9, 1, 'C'], [12, 6, 'D'], [3, 7, 'G'], [8, 10, 'A'], [13, 12, 'F'], [1, 12, 'B']],
  [[1, 3, 'D'], [6, 0, 'E'], [12, 2, 'B'], [8, 6, 'A'], [2, 9, 'G'], [11, 11, 'D'], [5, 13, 'F']],
  [[3, 1, 'G'], [10, 2, 'D'], [5, 7, 'B'], [11, 8, 'A'], [0, 10, 'E'], [7, 12, 'D'], [14, 13, 'F']],
];
function ore(t, base, pal, layout, shadow) {
  base(t);
  for (const [x0, y0, s] of LAYOUTS[layout]) {
    NUGGETS[s].forEach((row, dy) => [...row].forEach((ch, dx) => {
      const k = { d: 0, m: 1, l: 2, h: 3 }[ch];
      if (k !== undefined) t.wset(x0 + dx, y0 + dy, pal[k]);
      else if (ch === 's') t.wset(x0 + dx, y0 + dy, shadow);
    }));
  }
}
// [name, nugget palette (dark, mid, light, highlight), layout]
export const ORES = [
  ['coal', [0x1e1e1e, 0x2d2d2d, 0x3f3f3f, 0x5a5a5a], 0],
  ['iron', [0xa07c63, 0xc39a7f, 0xdcb699, 0xf0d3bc], 1],
  ['copper', [0x7a4a2d, 0xb8653d, 0xdd8455, 0x66b595], 2],
  ['gold', [0xb8861b, 0xe0b527, 0xfbdb45, 0xfff6a4], 0],
  ['redstone', [0x8a0404, 0xc40d0d, 0xf42525, 0xff8a8a], 2],
  ['lapis', [0x173787, 0x2350b6, 0x3570db, 0x80a8f5], 1],
  ['emerald', [0x0b6e34, 0x11a04a, 0x1fd066, 0x9ef7c0], 2],
  ['diamond', [0x149494, 0x29c2c0, 0x5ae6ea, 0xd2fdff], 0],
];
for (const [name, pal, layout] of ORES) {
  def(`${name}_ore`, (t) => ore(t, drawStone, pal, layout, 0x5b5b5b));
  def(`deepslate_${name}_ore`, (t) => ore(t, drawDeepslate, pal, layout, 0x2c2c30));
}

// Blocks of metal and gems: a bevelled plate with a pattern of their own.
function plate(t, pal, pattern) {
  quantize(t, t.field([[8, 8, 0.4], [4, 4, 0.2]], 0.3), pal.slice(1, 4), [0.25, 0.5, 0.25]);
  pattern?.(t);
  frame(t, pal[4], pal[0]);
}
// A sunken panel with a rivet in each corner.
function panel(t, dark, light, rivet) {
  frame(t, dark, light, 3);
  for (const [x, y] of [[1, 1], [14, 1], [1, 14], [14, 14]]) t.set(x, y, rivet);
}
def('iron_block', (t) => plate(t, [0x8c8c8c, 0xcdcdcd, 0xd8d8d8, 0xe2e2e2, 0xf8f8f8], (t) => panel(t, 0xb0b0b0, 0xf0f0f0, 0x9a9a9a)));
def('gold_block', (t) => plate(t, [0xa66a10, 0xf2c632, 0xf8d547, 0xfce26a, 0xfff7b3], (t) => {
  panel(t, 0xd49a1e, 0xfff2a8, 0xc0851a);
  for (const [x, y] of [[5, 5], [6, 5], [5, 6]]) t.set(x, y, 0xfffbd8);
}));
def('diamond_block', (t) => plate(t, [0x1f9e9f, 0x5fdfe0, 0x72e7e8, 0x8aeff0, 0xdcffff], (t) => {
  for (let i = 1; i < 15; i++) { t.set(i, i, 0x48cfd0); t.set(15 - i, i, 0x48cfd0); }
  for (const [x, y] of [[4, 2], [2, 4], [11, 13], [13, 11]]) t.set(x, y, 0xe8ffff);
}));
def('emerald_block', (t) => plate(t, [0x0a7a3a, 0x3fd57b, 0x52e08b, 0x6ceb9f, 0xc6ffd8], (t) => {
  for (let y = 1; y < 15; y++) for (let x = 1; x < 15; x++) {
    const a = (x + y) % 6, b = (x - y + 18) % 6;
    if (a === 0 || b === 0) t.set(x, y, 0x2bb866);
    else if (a === 1 || b === 1) t.set(x, y, 0x8af2b5);
  }
}));
def('lapis_block', (t) => plate(t, [0x173d8a, 0x2551b3, 0x2c5dc2, 0x3669d0, 0x7ea0f0], (t) => {
  for (let k = 0; k < 22; k++) t.set(1 + t.ri(14), 1 + t.ri(14), t.r() < 0.5 ? 0x1d3f96 : 0x5a86e6);
}));
def('redstone_block', (t) => plate(t, [0x6e0606, 0xb01010, 0xbf1515, 0xcf1d1d, 0xff6a5a], (t) => {
  for (let y = 2; y < 14; y += 4) for (let x = 2; x < 14; x += 4) {
    t.set(x, y, 0xff5040); t.set(x + 1, y, 0xe52a20); t.set(x, y + 1, 0xe52a20); t.set(x + 1, y + 1, 0x8e0a0a);
  }
}));
def('copper_block', (t) => plate(t, [0x8a4526, 0xbf6a43, 0xc9744b, 0xd38054, 0xf0ad85], (t) => {
  for (let k = 0; k < 14; k++) { const x = 1 + t.ri(13), y = 1 + t.ri(13); t.set(x, y, 0xe79064); t.set(x + 1, y, 0xa9593a); }
}));
def('coal_block', (t) => {
  const c = cells(t, 10, 3.5);
  for (let i = 0; i < 256; i++) {
    const lit = c.rel[i * 2] + c.rel[i * 2 + 1];
    t.set(i & 15, i >> 4, c.edge[i] < 0.7 ? 0x0c0c0c : lit < -2 ? 0x353535 : lit > 2 ? 0x161616 : pick([0x1d1d1d, 0x222222, 0x282828], t.r()));
  }
});
def('raw_iron_block', (t) => quantize(t, t.field([[2, 2, 0.5], [4, 4, 0.3]], 0.4), [0x8a6a55, 0xa6826a, 0xbd977c, 0xd1ad91, 0xe3c4ab], W5));

// ---------------------------------------------------------------- wood
// planks: [seam, dark, mid-dark, mid, light, highlight]; bark: dark to light.
export const WOODS = {
  oak: { planks: [0x654f2f, 0x88693d, 0x977648, 0xa68351, 0xb4905a, 0xc19e66], bark: [0x3f301c, 0x4d3b22, 0x5b4629, 0x695231, 0x775e39] },
  spruce: { planks: [0x392816, 0x523b22, 0x5d4428, 0x684d2e, 0x745734, 0x81623c], bark: [0x23180e, 0x2d1f13, 0x382818, 0x43311d, 0x4f3a23] },
  birch: { planks: [0x94834f, 0xb2a068, 0xbfad73, 0xc9b87d, 0xd3c388, 0xddcf95], bark: [0xc6c6be, 0xd2d2cb, 0xdcdcd5, 0xe6e6df, 0xf0f0ea] },
  jungle: { planks: [0x654630, 0x87603f, 0x956b48, 0xa27651, 0xaf815a, 0xbc8e66], bark: [0x3b2d12, 0x4a3a17, 0x58461c, 0x675422, 0x76622a] },
  acacia: { planks: [0x76391b, 0x9a4e27, 0xa9592e, 0xb66335, 0xc26e3d, 0xce7c47], bark: [0x4b4740, 0x59544c, 0x676259, 0x757067, 0x847e74] },
  dark_oak: { planks: [0x28190b, 0x382411, 0x402a15, 0x49311a, 0x53391f, 0x5e4326], bark: [0x1f150b, 0x291c0f, 0x332313, 0x3d2a17, 0x48321c] },
  cherry: { planks: [0x956460, 0xbd8a83, 0xca988f, 0xd5a59c, 0xdfb2a9, 0xe8c0b7], bark: [0x28161e, 0x331e27, 0x3f2731, 0x4b303b, 0x593a46] },
};

// Four boards, each ending in a dark seam, with the grain running along them.
export function drawPlanks(t, pal, cuts = [4, 12, 1, 9]) {
  const grain = t.field([[8, 1, 0.55], [4, 1, 0.3], [16, 2, 0.2]], 0.2);
  const seam = (i) => (i >> 4) % 4 === 3 || (i & 15) === cuts[(i >> 4) >> 2];
  const k = quantize(t, grain, pal.slice(1), [0.12, 0.26, 0.32, 0.21, 0.09], (i) => !seam(i));
  for (let i = 0; i < 256; i++) {
    const x = i & 15, y = i >> 4;
    if (y % 4 === 3) t.set(x, y, pal[0]);
    else if (x === cuts[y >> 2]) t.set(x, y, pal[1]);
    else if (y % 4 === 0 && k[i] < 3 && t.r() < 0.5) t.set(x, y, pal[k[i] + 2]);
  }
}
export function drawBark(t, pal, grooveColor) {
  quantize(t, t.field([[1, 8, 0.5], [2, 16, 0.3], [4, 4, 0.1]], 0.2), pal, [0.1, 0.22, 0.34, 0.22, 0.12]);
  // Dark cracks running up the bark.
  for (let x = t.ri(3); x < 16; x += 3 + t.ri(2)) {
    let y = t.ri(16);
    const len = 5 + t.ri(9);
    for (let i = 0; i < len; i++) { t.wset(x, y + i, grooveColor); if (t.r() < 0.15) x += t.r() < 0.5 ? 1 : -1; }
  }
}
function drawBirchBark(t, pal) {
  quantize(t, t.field([[4, 2, 0.5], [2, 1, 0.3]], 0.3), pal, [0.1, 0.2, 0.35, 0.22, 0.13]);
  // Dark horizontal marks, thicker in the middle.
  for (let k = 0; k < 9; k++) {
    const x = t.ri(16), y = t.ri(16), len = 2 + t.ri(4);
    for (let i = 0; i < len; i++) t.wset(x + i, y, i === 0 || i === len - 1 ? 0x5b5b55 : 0x2a2a27);
    if (len > 3 && t.r() < 0.6) t.wset(x + 1, y + 1, 0x4a4a45);
  }
}
function drawCherryBark(t, pal) {
  quantize(t, t.field([[4, 1, 0.5], [8, 2, 0.3]], 0.25), pal, [0.12, 0.24, 0.32, 0.2, 0.12]);
  for (let k = 0; k < 7; k++) {
    const x = t.ri(16), y = t.ri(16), len = 3 + t.ri(5);
    for (let i = 0; i < len; i++) t.wset(x + i, y, 0x6e5361);
  }
}
// The cut end of a log: growth rings inside a ring of bark.
function drawLogTop(t, pal, bark) {
  const n = t.noise(4);
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
    const dx = x - 7.5, dy = y - 7.5, sq = Math.max(Math.abs(dx), Math.abs(dy));
    if (sq > 6.9) { t.set(x, y, bark[1 + t.ri(bark.length - 1)]); continue; }
    if (sq > 6) { t.set(x, y, bark[0]); continue; }
    const d = sq * 0.6 + Math.hypot(dx, dy) * 0.4 + n[y * 16 + x] * 0.7;
    const ring = (d / 1.9) % 1;
    t.set(x, y, ring < 0.34 ? pal[2] : ring < 0.5 ? pal[3] : d < 1.4 ? pal[5] : pal[4]);
  }
}
// Leaves: a dark tangle of twigs and shadow with small leaves stamped over it, each lit on its
// top-left; the gaps show the sky through the tree. `pal` is grey for leaves the game tints.
const LEAF_SHAPES = [
  ['.4.', '432', '.2.'], ['43', '32'], ['443', '332'], ['.43', '432', '.2.'], ['4', '3', '2'], ['34', '22'],
];
const NEEDLES = [['4..', '.3.', '..2'], ['..4', '.3.', '2..'], ['4.', '3.', '.2'], ['.4', '3.', '2.']];
function drawLeaves(t, pal, { gap = 0.18, step = 3, shapes = LEAF_SHAPES } = {}) {
  t.clear();
  const base = t.field([[4, 4, 0.6], [2, 2, 0.3]], 0.35);
  const order = [...base.keys()].sort((a, b) => base[a] - base[b]);
  for (let n = Math.floor(gap * 256); n < 256; n++) { const i = order[n]; t.set(i & 15, i >> 4, pal[n > 190 ? 2 : n > 90 ? 1 : 0]); }
  for (let gy = 0; gy < 16; gy += step) for (let gx = 0; gx < 16; gx += step) {
    const x = gx + t.ri(step), y = gy + t.ri(step), shape = shapes[t.ri(shapes.length)];
    shape.forEach((row, dy) => [...row].forEach((ch, dx) => { if (ch !== '.') t.wset(x + dx, y + dy, pal[Number(ch)]); }));
  }
}
const LEAF_GREY = greys(0x5c, 0xc4, 5);
for (const [name, w] of Object.entries(WOODS)) {
  def(`${name}_planks`, (t) => drawPlanks(t, w.planks));
  def(`${name}_log`, (t) => (name === 'birch' ? drawBirchBark(t, w.bark) : name === 'cherry' ? drawCherryBark(t, w.bark)
    : drawBark(t, w.bark, shade(w.bark[0], 0.72))));
  def(`${name}_log_top`, (t) => drawLogTop(t, w.planks, name === 'birch' ? [0x3f3f3a, ...w.bark.slice(1)] : w.bark));
}
def('oak_leaves', (t) => drawLeaves(t, LEAF_GREY));
def('birch_leaves', (t) => drawLeaves(t, greys(0x66, 0xcc, 5), { gap: 0.2 }));
def('spruce_leaves', (t) => drawLeaves(t, greys(0x50, 0xb0, 5), { gap: 0.12, step: 2, shapes: NEEDLES }));
def('jungle_leaves', (t) => drawLeaves(t, greys(0x58, 0xc4, 5), { gap: 0.1, step: 4, shapes: [['.44.', '4332', '.32.'], ['443', '432', '.2.'], ...LEAF_SHAPES] }));
def('acacia_leaves', (t) => drawLeaves(t, greys(0x5e, 0xc2, 5), { gap: 0.3, step: 3, shapes: [['43', '32'], ['4', '3'], ['.4', '32']] }));
def('dark_oak_leaves', (t) => drawLeaves(t, greys(0x4c, 0xb0, 5), { gap: 0.08 }));
def('cherry_leaves', (t) => {
  drawLeaves(t, [0xb45c88, 0xcd7ba3, 0xe096bb, 0xeeb2d0, 0xfad0e5], { gap: 0.2 });
  for (let k = 0; k < 8; k++) { const x = t.ri(16), y = t.ri(16); if (t.alpha(x, y)) t.set(x, y, 0xfff3f8); }
});

// ---------------------------------------------------------------- plants (cut-out sprites)
const LEAF = [0x28561a, 0x356d21, 0x43852a, 0x559c35, 0x6bb343, 0x8ccb5a];
const STEM = [0x2c5a1c, 0x3d7527, 0x4f8f32];
// A round clump of leaves, lit from the top left.
function clump(t, cx, cy, r, pal, holes = 0.1) {
  for (let y = Math.floor(cy - r); y <= Math.ceil(cy + r); y++) for (let x = Math.floor(cx - r); x <= Math.ceil(cx + r); x++) {
    const dx = x + 0.5 - cx, dy = y + 0.5 - cy, d = Math.hypot(dx, dy);
    if (d > r || (d > r - 1 && t.r() < holes * 3) || t.r() < holes) continue;
    const lit = (-dx - dy) / (r * 1.4) + (t.r() - 0.5) * 0.5;
    t.set(x, y, pick(pal, 0.5 + lit * 0.6 - (d > r - 1 ? 0.25 : 0)));
  }
}
function trunk(t, pts, pal) {
  for (let i = 0; i + 1 < pts.length; i++) {
    const [x0, y0] = pts[i], [x1, y1] = pts[i + 1];
    const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0));
    for (let k = 0; k <= n; k++) {
      const x = Math.round(x0 + ((x1 - x0) * k) / n), y = Math.round(y0 + ((y1 - y0) * k) / n);
      t.set(x, y, pal[0]); if (y > y1 + 2 || i < pts.length - 2) t.set(x + 1, y, pal[1]);
    }
  }
}
const SAPLINGS = {
  oak: (t) => { trunk(t, [[7, 15], [7, 8]], [0x5a4127, 0x7a5a36]); for (const [x, y, r] of [[5, 6, 3.2], [10, 5.5, 3.2], [7.5, 3.5, 3], [8, 8, 2.6]]) clump(t, x, y, r, LEAF); },
  spruce: (t) => {
    trunk(t, [[7, 15], [7, 11]], [0x3e2a17, 0x57402a]);
    const pal = [0x1f3d1c, 0x2a4f25, 0x365f2e, 0x46743a, 0x588a48];
    [[1, 1.5], [4, 3], [7, 4.5], [10, 5.5]].forEach(([y, w]) => {
      for (let dy = 0; dy < 3; dy++) for (let x = Math.round(7.5 - w - dy * 0.5); x <= Math.round(7.5 + w + dy * 0.5); x++) {
        if (t.r() < 0.1) continue;
        t.set(x, y + dy, pick(pal, 0.75 - (x - 7.5) / 12 - dy * 0.22 + t.r() * 0.2));
      }
    });
  },
  birch: (t) => {
    trunk(t, [[7, 15], [7, 7]], [0xd8d8d0, 0x5a5a52]);
    for (const [x, y, r] of [[6, 5, 3], [10, 6, 2.8], [8, 2.8, 2.6]]) clump(t, x, y, r, [0x3f6b24, 0x50822c, 0x629a38, 0x78b046, 0x92c65a, 0xaedc76]);
  },
  jungle: (t) => {
    trunk(t, [[7, 15], [7, 6]], [0x4a3818, 0x6a5426]);
    const leaf = (pts) => pts.forEach(([x, y], i) => { t.set(x, y, LEAF[i === 0 ? 5 : 3]); t.set(x, y + 1, LEAF[1]); });
    leaf([[3, 5], [4, 4], [5, 4], [6, 5], [2, 6], [1, 7]]);
    leaf([[12, 4], [11, 4], [10, 5], [9, 5], [13, 5], [14, 6]]);
    leaf([[6, 2], [7, 1], [8, 1], [9, 2], [5, 3], [10, 3]]);
    clump(t, 7.5, 6.5, 2.4, LEAF, 0.05);
  },
  acacia: (t) => {
    trunk(t, [[6, 15], [6, 12], [9, 8]], [0x5d584f, 0x7b756a]);
    for (const [x, y, r] of [[5, 5, 2.6], [10, 4.5, 3], [7.5, 3.5, 2.6]]) clump(t, x, y, r, [0x3f5e1c, 0x4f7222, 0x62862a, 0x789a34, 0x90ae40, 0xa6c050]);
  },
  dark_oak: (t) => { trunk(t, [[7, 15], [7, 9]], [0x33230f, 0x4a3419]); for (const [x, y, r] of [[5, 7, 3.4], [10, 6.5, 3.4], [7.5, 4, 3.4]]) clump(t, x, y, r, [0x173a10, 0x214c16, 0x2c5e1c, 0x3a7224, 0x4b872e, 0x5e9a3a], 0.04); },
  cherry: (t) => {
    trunk(t, [[7, 15], [7, 9], [5, 6]], [0x3a2530, 0x5a3c48]);
    for (const [x, y, r] of [[5, 5, 3], [10, 6, 2.8], [8, 3, 2.6]]) clump(t, x, y, r, [0xb65c8a, 0xcb77a2, 0xdd92b8, 0xeaadcc, 0xf5c8df, 0xffe4f0]);
  },
};
for (const [name, draw] of Object.entries(SAPLINGS)) def(`${name}_sapling`, (t) => { t.clear(); draw(t); });

// Grass blades in greys (tinted by the biome), leaning a little.
function blades(t, n, h0, h1, top = 0) {
  for (let b = 0; b < n; b++) {
    const x0 = 1 + t.ri(14), h = h0 + t.ri(h1 - h0 + 1), lean = (t.r() - 0.5) * 0.45;
    for (let i = 0; i < h; i++) {
      const x = Math.round(x0 + lean * i), y = 15 - i - top;
      if (y < 0) break;
      t.set(x, y, pick(GRASS, 0.15 + (i / h) * 0.85 + (t.r() - 0.5) * 0.2));
    }
  }
}
def('tall_grass', (t) => { t.clear(); blades(t, 12, 4, 13); });
def('tall_grass_bottom', (t) => { t.clear(); blades(t, 9, 16, 16); blades(t, 5, 6, 12); });
def('tall_grass_top', (t) => { t.clear(); for (let b = 0; b < 10; b++) { const x0 = 1 + t.ri(14), h = 4 + t.ri(10); for (let i = 0; i < h; i++) t.set(Math.round(x0 + (t.r() - 0.5) * 0.4 * i), 15 - i, pick(GRASS, 0.35 + (i / h) * 0.65)); } });
// Ferns: fronds of paired leaflets, grey for tinting.
function frond(t, x0, y0, len, dir) {
  for (let i = 0; i < len; i++) {
    const x = Math.round(x0 + dir * i * 0.45), y = y0 - i;
    if (y < 0) break;
    t.set(x, y, GRASS[1]);
    const w = Math.max(1, Math.round((len - i) / 3));
    if (i % 2 === 0) for (let k = 1; k <= w; k++) { t.set(x - k, y, pick(GRASS, 0.5 + k * 0.1)); t.set(x + k, y + 1, pick(GRASS, 0.35 + k * 0.1)); }
  }
}
def('fern', (t) => { t.clear(); frond(t, 7, 15, 12, -0.6); frond(t, 8, 15, 11, 0.7); frond(t, 5, 15, 7, -1.2); frond(t, 10, 15, 7, 1.3); });
def('large_fern_bottom', (t) => { t.clear(); frond(t, 7, 15, 16, -0.3); frond(t, 9, 15, 16, 0.35); frond(t, 4, 15, 10, -1); frond(t, 12, 15, 10, 1.1); });
def('large_fern_top', (t) => { t.clear(); frond(t, 6, 15, 13, -0.4); frond(t, 9, 15, 12, 0.45); frond(t, 3, 15, 7, -0.9); });

// Flowers: hand-drawn, on a shared stem-and-leaves base.
function flower(t, rows, colors) {
  t.clear();
  paint(t, rows, { s: STEM[0], S: STEM[1], g: LEAF[1], G: LEAF[3], L: LEAF[4], ...colors }, { clear: false });
}
const BASE = ['.......s........', '...L...s...L....', '...GL..s..LG....', '....GL.sGLG.....', '.....GGsGg......', '.......s........'];
def('dandelion', (t) => flower(t, ['', '', '', '', '', '......yYy.......', '.....yYOYy......', '.....YOoOY......', '.....yYOYy......',
  '......yYy.......', ...BASE], { y: 0xd6a50f, Y: 0xf5d31a, O: 0xffe95c, o: 0xfff6b0 }));
def('poppy', (t) => flower(t, ['', '', '', '', '.....r..r.......', '....rRRrRRr.....', '....RQRRRQR.....', '....RRkkRRr.....', '.....RkkRr......',
  '......rRr.......', ...BASE], { r: 0x9c1410, R: 0xd42a1c, Q: 0xf25a44, k: 0x1f1512 }));
def('cornflower', (t) => flower(t, ['', '', '', '', '......b.b.......', '....b.BbB.b.....', '.....BQCQB......', '....bBCcCBb.....', '.....BQCQB......',
  '....b.BbB.b.....', ...BASE], { b: 0x2c47a8, B: 0x4867d8, Q: 0x7b95f0, C: 0x93a9ff, c: 0x2a2f6e }));
def('allium', (t) => flower(t, ['', '', '.....pPp........', '....pPQPpp......', '....PQqQPp......', '....pPQPpP......', '.....pPpPp......',
  '......pSp.......', '.......s........', '.......s........', ...BASE], { p: 0x7e3bb0, P: 0xa55ad4, Q: 0xc98aee, q: 0xe6c2ff }));
def('azure_bluet', (t) => flower(t, ['', '', '', '', '', '...w.....w......', '..wyw...wyw.....', '...w..w..w......', '.....wyw..w.....',
  '...w..w..wyw....', ...BASE], { w: 0xe8ecf0, y: 0xe6c436 }));
def('blue_orchid', (t) => flower(t, ['', '', '', '', '.....bb.........', '....bBBb.bb.....', '....BQQB.BBb....', '.....bBbBQQB....', '.......sbBBb....',
  '......Ss..b.....', ...BASE], { b: 0x1f7fb0, B: 0x2fa8e0, Q: 0x86dcff }));
def('oxeye_daisy', (t) => flower(t, ['', '', '', '', '......w.w.......', '....wwWwWww.....', '....WwyYyWw.....', '...wWyYOYwW.....', '....wWyYyWw.....',
  '....wwWwWww.....', ...BASE], { w: 0xd4d6d8, W: 0xf4f6f6, y: 0xd8a820, Y: 0xf0c830, O: 0xffe060 }));
for (const [name, c] of [['red', [0x8e1a14, 0xc9301f, 0xec5a3c]], ['orange', [0xb4501a, 0xe07524, 0xf8a048]], ['white', [0xb8bcc0, 0xe0e4e6, 0xfafcfc]], ['pink', [0xc0708a, 0xe698b2, 0xf8c4d6]]]) {
  def(`${name}_tulip`, (t) => flower(t, ['', '', '', '', '.....p.p.p......', '.....PpPpP......', '.....PQPPp......', '.....PQPPp......', '......PPp.......',
    '.......s........', '...L...s...L....', '..GL...s..LGG...', '..GGL..s.LGG....', '...GGL.sGGG.....', '....GGGsGg......', '.......s........'], { p: c[0], P: c[1], Q: c[2] }));
}
def('lily_of_the_valley', (t) => flower(t, ['', '', '', '.....ss.........', '....s..s........', '...w....s.......', '..wWw...sw......', '...w....wWw.....', '.......sw.......',
  '......s.w.......', '.....LGs........', '....LGGsGL......', '...LGG.sGGL.....', '....GG.sGG......', '.....GGsGg......', '.......s........'], { w: 0xdcdcd6, W: 0xffffff }));
def('dead_bush', (t) => {
  t.clear();
  const c = [0x5c3c1a, 0x7a5024, 0x93652f];
  t.line(8, 15, 8, 9, c[0]); t.line(8, 11, 4, 6, c[1]); t.line(8, 10, 12, 5, c[1]);
  t.line(5, 7, 2, 7, c[2]); t.line(11, 6, 13, 3, c[2]); t.line(8, 9, 7, 3, c[1]); t.line(6, 9, 3, 11, c[2]); t.line(10, 8, 13, 9, c[2]);
});
def('sugar_cane', (t) => {
  t.clear();
  for (const [x0, off] of [[3, 0], [8, 3], [12, 1]]) {
    for (let y = 0; y < 16; y++) {
      const seg = (y + off) % 5 === 0;
      t.set(x0, y, seg ? 0x6f9b48 : 0x9ccc6c); t.set(x0 + 1, y, seg ? 0x587e3a : 0x7fb055);
    }
    t.set(x0 - 1, (off * 3 + 4) % 16, 0xa9d879); t.set(x0 + 2, (off * 5 + 9) % 16, 0x8dbf60); t.set(x0 + 2, (off * 5 + 10) % 16, 0x8dbf60);
  }
});
def('red_mushroom', (t) => {
  t.clear();
  paint(t, ['', '', '', '', '', '', '....rRRRr.......', '...rRwRRwRr.....', '..rRRRRRRRRr....', '..RwRRRwRRRr....', '..rrrrrrrrrr.....',
    '.....sSs........', '.....sSs........', '.....sSs........', '....ssSss.......', ''].map((r) => r.slice(0, 16)),
  { r: 0xa3160f, R: 0xd8281c, w: 0xf2ece4, s: 0xcfc3aa, S: 0xe9e0cc }, { clear: false });
});
def('brown_mushroom', (t) => {
  t.clear();
  paint(t, ['', '', '', '', '', '', '', '....bBBBb.......', '..bBBQBBBBb.....', '..bBBBBBBBb.....', '..bbbbbbbbb.....',
    '.....sSs........', '.....sSs........', '....ssSss.......', '', ''], { b: 0x7a573d, B: 0x967052, Q: 0xb08c6c, s: 0xc9bca4, S: 0xe3d8c2 }, { clear: false });
});
def('lily_pad', (t) => {
  t.clear();
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
    const dx = x - 7.5, dy = y - 7.5, d = Math.hypot(dx, dy), a = Math.atan2(dy, dx);
    if (d > 7.2 || (a > 0.15 && a < 0.75 && d > 1.5)) continue;
    const vein = Math.abs(((a + Math.PI) * 7 / Math.PI) % 2 - 1) < 0.18 && d > 2;
    t.set(x, y, vein ? GRASS[5] : pick(GRASS, 0.2 + (7.2 - d) / 12 + t.r() * 0.3));
  }
});
def('vine', (t) => {
  t.clear();
  for (const [x0, len] of [[2, 16], [7, 11], [11, 15], [14, 8]]) {
    let x = x0;
    for (let y = 0; y < len; y++) {
      t.set(x, y, GRASS[1]);
      if (y % 3 === 1) { t.set(x - 1, y, GRASS[4]); t.set(x + 1, y, GRASS[3]); t.set(x - 1, y + 1, GRASS[2]); }
      if (t.r() < 0.25) x += t.r() < 0.5 ? -1 : 1;
    }
  }
});

// Double-tall flowers: a leafy lower half and the flowering top.
function bush(t, pal, top) {
  t.clear();
  for (let b = 0; b < 9; b++) {
    const x0 = 2 + t.ri(12), h = (top ? 6 : 12) + t.ri(5);
    for (let i = 0; i < h; i++) t.set(Math.round(x0 + (t.r() - 0.5) * 0.3 * i), 15 - i, pick(pal, 0.2 + (i / h) * 0.6));
  }
  if (!top) for (const [x, y, r] of [[5, 10, 3], [10, 8, 3], [7, 4, 3]]) clump(t, x, y, r, pal, 0.2);
}
function blooms(t, spots, pal) {
  for (const [x, y, r] of spots) clump(t, x, y, r, pal, 0.08);
}
def('sunflower_bottom', (t) => { t.clear(); for (let y = 0; y < 16; y++) { t.set(7, y, STEM[1]); t.set(8, y, STEM[0]); } clump(t, 4, 10, 2.5, LEAF, 0); clump(t, 11, 6, 2.5, LEAF, 0); clump(t, 5, 3, 2, LEAF, 0); });
def('sunflower_top', (t) => {
  t.clear();
  for (let y = 9; y < 16; y++) { t.set(7, y, STEM[1]); t.set(8, y, STEM[0]); }
  for (let y = 0; y < 11; y++) for (let x = 2; x < 14; x++) {
    const d = Math.hypot(x - 7.5, y - 5), a = Math.atan2(y - 5, x - 7.5);
    if (d < 2.6) t.set(x, y, d < 1.3 ? 0x4a3016 : 0x6b4420);
    else if (d < 5.3 + Math.sin(a * 8) * 0.5) t.set(x, y, pick([0xd89c12, 0xf2c21e, 0xffe04a], 0.6 - (x + y - 12) / 14 + t.r() * 0.3));
  }
});
def('lilac_bottom', (t) => bush(t, LEAF, false));
def('lilac_top', (t) => { bush(t, LEAF, true); blooms(t, [[5, 6, 3], [10, 5, 2.8], [7, 2, 2.4], [11, 10, 2]], [0x8a5a9e, 0xa672b8, 0xbf8dcf, 0xd6aae2, 0xe9c9f2]); });
def('rose_bush_bottom', (t) => { bush(t, LEAF, false); blooms(t, [[4, 6, 1.6], [11, 11, 1.6]], [0x8e1410, 0xbe2418, 0xe0402c]); });
def('rose_bush_top', (t) => { bush(t, LEAF, true); blooms(t, [[5, 7, 2], [10, 4, 2], [8, 11, 1.8], [12, 9, 1.4]], [0x8e1410, 0xbe2418, 0xe0402c, 0xf46a52]); });
def('peony_bottom', (t) => bush(t, LEAF, false));
def('peony_top', (t) => { bush(t, LEAF, true); blooms(t, [[5, 6, 3], [10, 5, 3], [8, 2, 2.4]], [0xb7708e, 0xd18aa8, 0xe6a8c2, 0xf4c6d8, 0xfde4ee]); });

// Crops: wheat grows in eight stages, the root crops in four.
function crop(t, stage, stages, { stalk, ripe, head = null, leafy = false }) {
  t.clear();
  const k = (stage + 1) / stages;
  const cols = [1, 3, 5, 8, 10, 12, 14];
  for (const x0 of cols) {
    const h = Math.max(2, Math.round((4 + (x0 * 7) % 5) * k + k * 8));
    for (let i = 0; i < h; i++) {
      const x = x0 + (i > h * 0.6 && x0 % 2 ? 1 : 0), y = 15 - i;
      const c = stage === stages - 1 && ripe ? pick(ripe, 0.3 + (i / h) * 0.6) : pick(stalk, 0.2 + (i / h) * 0.7);
      t.set(x, y, c);
      if (leafy && i > 1 && i % 3 === 0) { t.set(x - 1, y, pick(stalk, 0.6)); t.set(x + 1, y - 1, pick(stalk, 0.8)); }
    }
    if (head && stage >= stages - 3) {
      const top = 16 - h, grains = stage === stages - 1 ? head : stalk;
      for (let i = 0; i < 4; i++) { t.set(x0 - 1 + (i % 2) * 2, top + i, pick(grains, 0.4 + (i % 2) * 0.4)); t.set(x0 + (i % 2 ? 1 : 0), top + i, grains[1]); }
    }
  }
}
const WHEAT_GREEN = [0x2f6d1a, 0x3d8522, 0x4e9d2c, 0x62b43a];
const WHEAT_GOLD = [0x9a7a26, 0xbc9a36, 0xd8b84a, 0xecd06a];
for (let s = 0; s < 8; s++) def(`wheat_${s}`, (t) => crop(t, s, 8, { stalk: s > 5 ? [0x6f8a2a, 0x8aa334, 0xa4b94a, 0xc0cc60] : WHEAT_GREEN, ripe: WHEAT_GOLD, head: WHEAT_GOLD }));
function rootCrop(t, stage, root) {
  t.clear();
  const k = (stage + 1) / 4;
  for (const [x0, lean] of [[2, -0.3], [5, 0.2], [8, -0.1], [11, 0.3], [13, -0.2]]) {
    const h = Math.round(3 + k * 7 + (x0 % 3));
    for (let i = 0; i < h; i++) {
      const x = Math.round(x0 + lean * i), y = 15 - i;
      t.set(x, y, pick(LEAF, 0.15 + (i / h) * 0.7));
      if (i > 1 && i % 2 === 0) { t.set(x - 1, y, LEAF[4]); t.set(x + 1, y - 1, LEAF[2]); }
    }
    if (stage === 3 && root) { t.set(x0, 15, root[1]); t.set(x0 + 1, 15, root[0]); t.set(x0, 14, root[2]); }
  }
}
for (let s = 0; s < 4; s++) {
  def(`carrots_${s}`, (t) => rootCrop(t, s, [0xb0500c, 0xe07018, 0xf89a3c]));
  def(`potatoes_${s}`, (t) => rootCrop(t, s, [0x8a6a2c, 0xb89448, 0xd8b868]));
  def(`beetroots_${s}`, (t) => rootCrop(t, s, [0x5a0e1c, 0x8e1a2c, 0xb8344a]));
}

// ---------------------------------------------------------------- built blocks
const BRICK = [0x6f3023, 0x843a2b, 0x964533, 0xa4513c, 0xb46047];
def('bricks', (t) => bricks(t, BRICK, [0x9a938a, 0xaea79d], { h: 4, w: 8 }));
export const STONE_BRICK = [0x626262, 0x6f6f6f, 0x787878, 0x828282, 0x939393];
function stoneBricks(t) { bricks(t, STONE_BRICK, [0x505050, 0x585858], { h: 8, w: 16, stagger: 8 }); }
def('stone_bricks', stoneBricks);
def('mossy_stone_bricks', (t) => { stoneBricks(t); moss(t, 0.45, (i) => (i >> 4) % 8 >= 6 || (i & 15) % 16 >= 14 || (((i & 15) + 8) % 16 >= 14 && (i >> 4) >= 8)); });
def('cracked_stone_bricks', (t) => {
  stoneBricks(t);
  for (const pts of [[[2, 1], [4, 2], [5, 4], [7, 5]], [[9, 9], [10, 11], [12, 12], [13, 14]], [[12, 2], [11, 4], [12, 5]], [[3, 10], [2, 12], [4, 13]]]) {
    for (let i = 0; i + 1 < pts.length; i++) t.line(pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1], 0x4a4a4a);
  }
});
def('chiseled_stone_bricks', (t) => {
  drawStone(t, [0x6b6b6b, 0x747474, 0x7b7b7b, 0x828282, 0x8a8a8a, 0x939393]);
  frame(t, 0x9a9a9a, 0x555555);
  frame(t, 0x5c5c5c, 0x979797, 2);
  frame(t, 0x9a9a9a, 0x5c5c5c, 4);
  for (let y = 6; y < 10; y++) for (let x = 6; x < 10; x++) t.set(x, y, (x + y) % 2 ? 0x6a6a6a : 0x8e8e8e);
  t.set(6, 6, 0xa4a4a4); t.set(9, 9, 0x555555);
});

// Sandstone: smooth courses with a lighter band along the top.
function sandstoneSide(t, pal) {
  quantize(t, t.field([[8, 2, 0.5], [4, 1, 0.3]], 0.3), pal.slice(1, 5), [0.2, 0.35, 0.3, 0.15]);
  for (let x = 0; x < 16; x++) {
    t.set(x, 0, pal[5]); t.set(x, 3, pal[0]); t.set(x, 4, pal[1]);
    if (x % 5 !== 2) t.set(x, 9, pal[1]);
    t.set(x, 12, pal[1]); t.set(x, 15, pal[0]);
    if (t.r() < 0.5) t.set(x, 13 + t.ri(2), pal[1]);
  }
}
function sandstoneFlat(t, pal, rough) { quantize(t, t.field([[4, 4, 0.4], [2, 2, 0.3]], rough), pal.slice(1, 6), W5); }
function cutSandstone(t, pal) {
  sandstoneFlat(t, pal, 0.3);
  frame(t, pal[5], pal[0]);
  for (let x = 1; x < 15; x++) { t.set(x, 7, pal[1]); t.set(x, 8, pal[4]); }
}
const SANDSTONE = [0xa99662, 0xc4b17c, 0xcfbd86, 0xd7c68f, 0xdecf99, 0xe6d9a8];
const RED_SANDSTONE = [0x82400f, 0xa45319, 0xb05b1e, 0xba6423, 0xc46d2a, 0xce7a36];
for (const [name, pal] of [['sandstone', SANDSTONE], ['red_sandstone', RED_SANDSTONE]]) {
  def(`${name}_side`, (t) => sandstoneSide(t, pal));
  def(`${name}_top`, (t) => sandstoneFlat(t, pal, 0.35));
  def(`${name}_bottom`, (t) => { sandstoneFlat(t, pal, 0.7); for (let k = 0; k < 8; k++) t.set(t.ri(16), t.ri(16), pal[0]); });
  def(`cut_${name}`, (t) => cutSandstone(t, pal));
  def(`chiseled_${name}`, (t) => {
    cutSandstone(t, pal);
    for (let y = 2; y < 14; y++) for (let x = 2; x < 14; x++) {
      const d = Math.abs(x - 7.5) + Math.abs(y - 7.5);
      if (d > 5.6 && d < 6.6) t.set(x, y, pal[0]);
      else if (d > 2.6 && d < 3.6) t.set(x, y, pal[1]);
      else if (d < 1.2) t.set(x, y, pal[5]);
    }
  });
}

// Coloured blocks are drawn once in greys and tinted per colour (see blocks.js).
def('terracotta', (t) => quantize(t, t.field([[4, 4, 0.5], [2, 2, 0.2]], 0.3), [0x8a5238, 0x915840, 0x985e43, 0x9f6447, 0xa66b4d], W5));
def('terracotta_dyed', (t) => quantize(t, t.field([[4, 4, 0.5], [2, 2, 0.2]], 0.3), greys(0xd6, 0xf2, 5), W5));
def('wool', (t) => {
  const f = t.field([[2, 2, 0.35], [1, 1, 0.15]], 0.25);
  for (let i = 0; i < 256; i++) f[i] += (((i & 15) + (i >> 4)) % 4 === 0 ? -0.25 : 0) + (((i & 15) - (i >> 4) + 16) % 4 === 0 ? 0.12 : 0);
  quantize(t, f, greys(0xca, 0xff, 6), W6);
});
def('concrete', (t) => quantize(t, t.field([[8, 8, 0.5], [4, 4, 0.3]], 0.1), greys(0xe6, 0xf2, 4), [0.2, 0.3, 0.3, 0.2]));
def('concrete_powder', (t) => drawSand(t, greys(0xd0, 0xfa, 6), 0xc4c4c4));
def('stained_glass', (t) => {
  t.fill(0xf4f4f4, 110);
  for (let i = 0; i < 16; i++) { t.set(i, 0, 0xffffff, 200); t.set(0, i, 0xffffff, 200); t.set(i, 15, 0xc8c8c8, 200); t.set(15, i, 0xc8c8c8, 200); }
  for (const [x, y] of [[3, 3], [4, 2], [2, 4], [11, 11], [12, 10]]) t.set(x, y, 0xffffff, 170);
});
def('glass', (t) => {
  t.clear();
  for (let i = 0; i < 16; i++) {
    t.set(i, 0, 0xe4f3f7); t.set(0, i, 0xe4f3f7); t.set(i, 15, 0xa6c8d0); t.set(15, i, 0xa6c8d0);
  }
  for (const [x, y] of [[2, 4], [3, 3], [4, 2], [3, 5], [5, 3], [10, 12], [11, 11], [12, 10], [12, 12]]) t.set(x, y, 0xffffff, 210);
});
def('glass_pane_top', (t) => { for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) t.set(x, y, x === 7 ? 0xe4f3f7 : x === 8 ? 0xa6c8d0 : 0xc4e0e7); });
def('iron_bars', (t) => {
  t.clear();
  for (const x0 of [1, 5, 9, 13]) for (let y = 0; y < 16; y++) { t.set(x0, y, 0x9a9a9a); t.set(x0 + 1, y, 0x5e5e5e); }
  for (const y of [0, 15]) for (let x = 0; x < 16; x++) t.set(x, y, y ? 0x505050 : 0xb4b4b4);
  for (let x = 0; x < 16; x++) { t.set(x, 7, 0xa8a8a8); t.set(x, 8, 0x5a5a5a); }
});

const OAK = WOODS.oak.planks;
def('bookshelf', (t) => {
  drawPlanks(t, OAK);
  const books = [[0x7a2418, 0x9c3424], [0x284a88, 0x3a62a8], [0x2e6424, 0x40802f], [0x8a6a1a, 0xae8a28], [0x5a2468, 0x763488], [0x9a3a2a, 0xba5238], [0x286868, 0x388686], [0x4a3a2a, 0x62503a]];
  for (const [y0, y1] of [[1, 7], [9, 15]]) {
    for (let y = y0; y < y1; y++) for (let x = 0; x < 16; x++) t.set(x, y, 0x2a1d10);
    let x = 1;
    while (x < 15) {
      const bw = t.r() < 0.35 ? 2 : 1, [dark, light] = books[t.ri(books.length)], top = y0 + (t.r() < 0.4 ? 1 : 0);
      for (let i = 0; i < bw && x < 15; i++, x++) {
        for (let y = top; y < y1; y++) t.set(x, y, i === 0 ? light : dark);
        t.set(x, top + 1, 0xd8c890);
        if (y1 - top > 4) t.set(x, y1 - 2, 0xd8c890);
      }
      if (t.r() < 0.2) x++;
    }
  }
});
const TABLE_DARK = 0x3f2c17;
def('crafting_table_top', (t) => {
  drawPlanks(t, [0x5a3a1c, 0x7a5028, 0x86592e, 0x926234, 0x9d6b3a, 0xa87541]);
  frame(t, TABLE_DARK, TABLE_DARK);
  for (let i = 3; i < 13; i++) for (const g of [3, 6, 9, 12]) { t.set(i, g, 0x5a3f22); t.set(g, i, 0x5a3f22); }
  for (const g of [3, 6, 9, 12]) for (let i = 3; i < 13; i++) { t.set(i, g + 1 > 12 ? g : g + 1, t.get(i, g + 1)); }
});
function tableSide(t, tools) {
  drawPlanks(t, OAK);
  for (let y = 0; y < 16; y++) { t.set(0, y, TABLE_DARK); t.set(1, y, 0x5a4020); t.set(14, y, 0x5a4020); t.set(15, y, TABLE_DARK); }
  for (let x = 0; x < 16; x++) { t.set(x, 0, 0x6e4b27); t.set(x, 1, 0x86592e); t.set(x, 2, TABLE_DARK); }
  tools(t);
}
def('crafting_table_front', (t) => tableSide(t, (t) => {
  // A saw hanging from a peg, and a hammer.
  paint(t, ['', '', '', '', '...k......k.....', '...h......hk....', '..hhh....khk....', '..hHh.....k.....', '..hhh.....w.....',
    '..ss......w.....', '..sS......w.....', '..ss......w.....', '..sS......W.....', '..s.............'], {
    k: 0x2e2e2e, h: 0x6a4a24, H: 0x8a6434, s: 0xa8a8a8, S: 0xd0d0d0, w: 0x7a5630, W: 0x5a3e20 }, { clear: false });
}));
def('crafting_table_side', (t) => tableSide(t, (t) => {
  paint(t, ['', '', '', '', '....kkkk........', '....kSSk....kk..', '.....ww....kSSk.', '.....ww.....ww..', '.....ww.....ww..',
    '.....ww.....ww..', '.....wW.....wW..', '.............', ''], { k: 0x3a3a3a, S: 0xbcbcbc, w: 0x7a5630, W: 0x5a3e20 }, { clear: false });
}));

// Furnaces: blocks of smoothed cobblestone.
const FURNACE = [0x4c4c4c, 0x5e5e5e, 0x6c6c6c, 0x787878, 0x848484, 0x929292];
function furnaceBody(t) { drawCobble(t, FURNACE, [0x3e3e3e, 0x464646], 7); frame(t, 0x9a9a9a, 0x4a4a4a); }
def('furnace_side', furnaceBody);
def('furnace_top', (t) => { quantize(t, t.field([[4, 4, 0.5], [2, 2, 0.3]], 0.3), FURNACE.slice(1, 5), [0.2, 0.3, 0.3, 0.2]); frame(t, 0x9a9a9a, 0x4a4a4a); frame(t, 0x505050, 0x8a8a8a, 2); });
function furnaceFront(t, lit) {
  furnaceBody(t);
  for (let x = 3; x < 13; x++) { t.set(x, 3, 0x3e3e3e); t.set(x, 4, 0x8e8e8e); t.set(x, 5, 0x3e3e3e); }
  for (let y = 8; y < 14; y++) for (let x = 3; x < 13; x++) {
    const edge = y === 8 || x === 3 || x === 12;
    t.set(x, y, edge ? 0x3a3a3a : 0x151515);
  }
  for (let x = 4; x < 12; x++) t.set(x, 13, 0x2a2a2a);
  if (lit) {
    const tongues = [2, 4, 3, 4, 3, 2, 4, 3];
    for (let x = 4; x < 12; x++) for (let k = 0; k < tongues[x - 4]; k++) t.set(x, 12 - k, [0xffe070, 0xffb028, 0xf07a18, 0xc84812][Math.min(3, k)]);
    for (let x = 4; x < 12; x++) t.set(x, 13, 0xa04818);
  }
}
def('furnace_front', (t) => furnaceFront(t, false));
def('furnace_front_on', (t) => furnaceFront(t, true));
// Smoker: a stone firebox bound in dark wood with iron bands; blast furnace: iron-clad stone.
const DARK_PLANKS = WOODS.dark_oak.planks;
def('smoker_side', (t) => {
  drawPlanks(t, DARK_PLANKS, [7, 7, 7, 7]);
  for (const y of [2, 13]) for (let x = 0; x < 16; x++) { t.set(x, y, 0x5a5a5a); t.set(x, y + 1, 0x363636); }
  frame(t, 0x6a5238, 0x1c1208);
});
def('smoker_top', (t) => {
  furnaceBody(t);
  for (let y = 4; y < 12; y++) for (let x = 4; x < 12; x++) t.set(x, y, (x + y) % 2 ? 0x2a2a2a : 0x3a3a3a);
  frame(t, 0x3a3a3a, 0x9a9a9a, 3);
});
def('smoker_bottom', (t) => furnaceBody(t));
function smokerFront(t, lit) {
  furnaceBody(t);
  for (let y = 7; y < 14; y++) for (let x = 3; x < 13; x++) t.set(x, y, lit ? (y > 10 ? 0xf08a20 : 0xb04010) : 0x161616);
  for (let x = 3; x < 13; x++) { t.set(x, 7, 0x4a4a4a); if (x % 2 === 0) for (let y = 8; y < 14; y++) t.set(x, y, 0x3c3c3c); }
  for (let x = 2; x < 14; x++) { t.set(x, 2, 0x3a2410); t.set(x, 3, 0x5a3c1c); }
}
def('smoker_front', (t) => smokerFront(t, false));
def('smoker_front_on', (t) => smokerFront(t, true));
const IRON_TRIM = [0x5a5a5a, 0x8a8a8a, 0xb4b4b4];
def('blast_furnace_side', (t) => {
  quantize(t, t.field([[4, 4, 0.5], [2, 2, 0.3]], 0.3), [0x6a6a6a, 0x747474, 0x7e7e7e, 0x888888], [0.2, 0.3, 0.3, 0.2]);
  for (const y of [0, 7, 15]) for (let x = 0; x < 16; x++) t.set(x, y, IRON_TRIM[y === 15 ? 0 : 2]);
  for (let y = 0; y < 16; y++) { t.set(0, y, IRON_TRIM[1]); t.set(15, y, IRON_TRIM[0]); }
});
def('blast_furnace_top', (t) => { furnaceBody(t); for (let y = 3; y < 13; y++) for (let x = 3; x < 13; x++) t.set(x, y, (x % 3 === 0 || y % 3 === 0) ? 0x2e2e2e : 0x5a5a5a); });
function blastFront(t, lit) {
  quantize(t, t.field([[4, 4, 0.5], [2, 2, 0.3]], 0.3), [0x6a6a6a, 0x747474, 0x7e7e7e, 0x888888], [0.2, 0.3, 0.3, 0.2]);
  frame(t, IRON_TRIM[2], IRON_TRIM[0]);
  for (let y = 4; y < 13; y++) for (let x = 3; x < 13; x++) {
    const bar = x % 3 === 0;
    t.set(x, y, bar ? (x === 3 ? 0xb4b4b4 : 0x8a8a8a) : lit ? (y > 8 ? 0xffb030 : 0xe06018) : 0x1a1a1a);
  }
  for (let x = 3; x < 13; x++) { t.set(x, 3, 0xb4b4b4); t.set(x, 13, 0x4a4a4a); }
}
def('blast_furnace_front', (t) => blastFront(t, false));
def('blast_furnace_front_on', (t) => blastFront(t, true));
// Barrel: upright staves held by two iron hoops; a round lid on top.
const STAVES = WOODS.spruce.planks;
def('barrel_side', (t) => {
  quantize(t, t.field([[1, 8, 0.6], [2, 16, 0.3]], 0.25), STAVES.slice(1), [0.12, 0.26, 0.32, 0.21, 0.09]);
  for (let i = 0; i < 256; i++) {
    const x = i & 15, y = i >> 4;
    if (x % 4 === 3) t.set(x, y, STAVES[0]);
    if (y === 2 || y === 13) t.set(x, y, 0x707070);
    if (y === 3 || y === 14) t.set(x, y, 0x3a3a3a);
  }
});
def('barrel_top', (t) => {
  drawPlanks(t, STAVES, [5, 10, 3, 12]);
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
    const d = Math.hypot(x - 7.5, y - 7.5);
    if (d > 6.5) t.set(x, y, d > 7.2 ? 0x5a5a5a : 0x3a3a3a);
    else if (d < 1.6) t.set(x, y, 0x2a1d10);
  }
});
def('barrel_bottom', (t) => { drawPlanks(t, STAVES, [5, 10, 3, 12]); frame(t, 0x5a5a5a, 0x3a3a3a); });
// Smithing and fletching tables (workstations for the village's smith and hunter).
def('smithing_table_top', (t) => {
  quantize(t, t.field([[4, 4, 0.5], [2, 2, 0.3]], 0.3), [0x2c2c30, 0x34343a, 0x3c3c42, 0x46464c], [0.2, 0.3, 0.3, 0.2]);
  frame(t, 0x5c5c62, 0x1e1e22);
  for (let x = 3; x < 13; x++) { t.set(x, 4, 0x6a6a70); t.set(x, 11, 0x1e1e22); }
});
def('smithing_table_side', (t) => {
  drawPlanks(t, DARK_PLANKS);
  for (let x = 0; x < 16; x++) { t.set(x, 0, 0x5c5c62); t.set(x, 1, 0x3c3c42); t.set(x, 2, 0x2a2a2e); }
  for (let y = 3; y < 16; y++) { t.set(1, y, 0x2a2a2e); t.set(14, y, 0x2a2a2e); }
});
def('smithing_table_front', (t) => {
  drawPlanks(t, DARK_PLANKS);
  for (let x = 0; x < 16; x++) { t.set(x, 0, 0x5c5c62); t.set(x, 1, 0x3c3c42); t.set(x, 2, 0x2a2a2e); }
  paint(t, ['', '', '', '', '....kkkkk.......', '....kSSSk.......', '....kkSkk.......', '......w.........', '......w.........', '......w.........', '......W.........'],
    { k: 0x2e2e2e, S: 0x9a9aa0, w: 0x8a6434, W: 0x6a4a24 }, { clear: false });
});
const BIRCH = WOODS.birch.planks;
def('fletching_table_top', (t) => {
  drawPlanks(t, BIRCH);
  frame(t, 0x7a6a40, 0x7a6a40);
  paint(t, ['', '', '...........ff...', '..........fFf...', '.........fFf....', '........sf......', '.......s........', '......s.........', '.....s..........',
    '....s...........', '...kk...........', '..kk............'], { f: 0xd8d8d8, F: 0xffffff, s: 0x6a4a24, k: 0x4a4a4a }, { clear: false });
});
def('fletching_table_side', (t) => {
  drawPlanks(t, BIRCH);
  for (let x = 0; x < 16; x++) { t.set(x, 0, 0x9a8a58); t.set(x, 1, 0xc8b67e); t.set(x, 2, 0x6a5a30); }
  for (let y = 3; y < 16; y++) { t.set(0, y, 0x6a5a30); t.set(15, y, 0x6a5a30); }
});
def('fletching_table_front', (t) => {
  drawPlanks(t, BIRCH);
  for (let x = 0; x < 16; x++) { t.set(x, 0, 0x9a8a58); t.set(x, 1, 0xc8b67e); t.set(x, 2, 0x6a5a30); }
  paint(t, ['', '', '', '', '...ff......ff...', '..fFf.....fFf...', '...s.......s....', '...s.......s....', '...s.......s....', '...s.......s....', '..kkk.....kkk...'],
    { f: 0xe8e8e8, F: 0xffffff, s: 0x6a4a24, k: 0x5a5a5a }, { clear: false });
});

// TNT: a bundle of red sticks with a paper band.
def('tnt_side', (t) => {
  const FONT = { T: ['###', '.#.', '.#.', '.#.'], N: ['#.#', '###', '###', '#.#'] };
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
    let c = x % 4 === 3 ? 0x9a2016 : x % 4 === 0 ? 0xe65a40 : pick([0xcb3322, 0xd63b27], t.r());
    if (y >= 5 && y <= 10) c = y === 5 ? 0xf6f6f6 : y === 10 ? 0xb8b8b8 : pick([0xe4e4e4, 0xececec], t.r());
    t.set(x, y, c);
  }
  let x0 = 2;
  for (const ch of 'TNT') { FONT[ch].forEach((row, ry) => [...row].forEach((p, rx) => { if (p === '#') t.set(x0 + rx, 6 + ry, 0x1e1e1e); })); x0 += 4; }
});
def('tnt_top', (t) => {
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
    const cx = (x % 4) - 1.5, cy = (y % 4) - 1.5;
    t.set(x, y, Math.hypot(cx, cy) > 1.8 ? 0x7a1a12 : cx + cy < -1 ? 0xe65a40 : 0xc83322);
  }
  for (let y = 6; y < 10; y++) for (let x = 6; x < 10; x++) t.set(x, y, 0x3a3a3a);
  t.set(7, 7, 0x9a9a9a); t.set(8, 8, 0x6a6a6a); t.set(8, 7, 0x7a7a7a);
});
def('tnt_bottom', (t) => { for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) { const cx = (x % 4) - 1.5, cy = (y % 4) - 1.5; t.set(x, y, Math.hypot(cx, cy) > 1.8 ? 0x6a1610 : 0xa82a1c); } });

// Torch: a stick with the flame on top (the model uses the middle two columns).
def('torch', (t) => {
  t.clear();
  for (let y = 8; y < 16; y++) { t.set(7, y, 0x8a6a3a); t.set(8, y, 0x5e4424); }
  paint(t, ['', '', '', '', '.......WW.......', '......wYYw......', '......YOOY......', '.......RO.......'],
    { W: 0xffffff, w: 0xffe9a0, Y: 0xffd84a, O: 0xffa42a, R: 0xe8601a }, { clear: false });
});
// Lantern: an iron cage around a flame, with a handle on top.
def('lantern_side', (t) => {
  t.clear();
  // body 6 wide x 7 tall at the bottom (rows 9..15), cap rows 7..8, handle rows 4..6
  for (let y = 9; y < 16; y++) for (let x = 5; x < 11; x++) {
    const edge = x === 5 || x === 10 || y === 9 || y === 15;
    t.set(x, y, edge ? (x === 10 || y === 15 ? 0x2c2e33 : 0x4a4d54) : y < 12 ? 0xffe6a8 : pick([0xf6b04a, 0xe8902e], t.r()));
  }
  for (let x = 6; x < 10; x++) { t.set(x, 7, 0x4a4d54); t.set(x, 8, 0x2c2e33); }
  for (let y = 4; y < 7; y++) { t.set(7, y, 0x3a3d44); t.set(8, y, 0x2c2e33); }
});
def('lantern_top', (t) => {
  t.clear();
  for (let y = 5; y < 11; y++) for (let x = 5; x < 11; x++) t.set(x, y, x === 5 || y === 5 ? 0x5a5e66 : 0x3a3d44);
  for (let y = 6; y < 10; y++) for (let x = 6; x < 10; x++) t.set(x, y, 0x4a4d54);
  t.set(7, 7, 0x2c2e33); t.set(8, 8, 0x2c2e33);
});
// Campfire logs, with glowing embers when lit.
function campfireLog(t, lit) {
  drawBark(t, WOODS.oak.bark, 0x2e2314);
  for (let x = 0; x < 16; x++) {
    t.set(x, 0, 0x1e160c);
    if (lit && t.r() < 0.35) t.set(x, 1 + t.ri(3), pick([0xf09030, 0xffc040, 0xd05010], t.r()));
  }
}
def('campfire_log', (t) => campfireLog(t, false));
def('campfire_log_lit', (t) => campfireLog(t, true));
def('ladder', (t) => {
  t.clear();
  for (let y = 0; y < 16; y++) {
    t.set(2, y, OAK[0]); t.set(3, y, OAK[3]); t.set(12, y, OAK[0]); t.set(13, y, OAK[3]);
  }
  for (const y of [1, 5, 9, 13]) for (let x = 4; x < 12; x++) { t.set(x, y, OAK[4]); t.set(x, y + 1, OAK[1]); }
});

// Doors: one design per wood. Windows are cut out of the upper half.
function door(t, pal, top, style) {
  const frameC = pal[0];
  drawPlanks(t, pal, [16, 16, 16, 16]);
  // Doors have upright boards.
  const f = t.field([[1, 8, 0.6], [2, 16, 0.3]], 0.2);
  quantize(t, f, pal.slice(1), [0.12, 0.26, 0.32, 0.21, 0.09]);
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
    if (x === 0 || x === 15 || (top ? y === 0 : y === 15)) t.set(x, y, frameC);
    else if (x % 5 === 0 && style !== 'panel') t.set(x, y, pal[1]);
  }
  const hole = (x0, y0, x1, y1) => {
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) t.set(x, y, 0, 0);
    for (let x = x0 - 1; x <= x1 + 1; x++) { t.set(x, y0 - 1, frameC); t.set(x, y1 + 1, frameC); }
    for (let y = y0 - 1; y <= y1 + 1; y++) { t.set(x0 - 1, y, frameC); t.set(x1 + 1, y, frameC); }
  };
  const panel = (x0, y0, x1, y1) => {
    for (let x = x0; x <= x1; x++) { t.set(x, y0, pal[5]); t.set(x, y1, pal[1]); }
    for (let y = y0; y <= y1; y++) { t.set(x0, y, pal[5]); t.set(x1, y, pal[1]); }
  };
  if (top) {
    if (style === 'windows') { hole(3, 3, 6, 7); hole(9, 3, 12, 7); panel(3, 11, 12, 14); }
    else if (style === 'grid') { for (const [x, y] of [[3, 2], [7, 2], [11, 2], [3, 6], [7, 6], [11, 6], [3, 10], [7, 10], [11, 10]]) hole(x, y, x + 1, y + 1); }
    else if (style === 'slit') { hole(6, 3, 9, 9); }
    else if (style === 'diamond') { for (let y = 3; y < 12; y++) { const w = 4 - Math.abs(y - 7); if (w >= 0) hole(8 - w, y, 7 + w, y); } }
    else if (style === 'round') { for (let y = 3; y < 10; y++) for (let x = 4; x < 12; x++) if (Math.hypot(x - 7.5, y - 6.5) < 3.4) t.set(x, y, 0, 0); }
    else if (style === 'cross') { hole(3, 3, 6, 6); hole(9, 3, 12, 6); hole(3, 9, 6, 12); hole(9, 9, 12, 12); }
    else panel(3, 3, 12, 13);
  } else {
    panel(3, 2, 12, 7); panel(3, 9, 12, 13);
    t.set(12, 1, 0x3a3a3a); t.set(13, 1, 0x7a7a7a); t.set(13, 0, 0x5a5a5a);
  }
}
export const DOOR_STYLE = { oak: 'windows', spruce: 'slit', birch: 'grid', jungle: 'cross', acacia: 'diamond', dark_oak: 'panel', cherry: 'round' };
for (const [name, w] of Object.entries(WOODS)) {
  def(`${name}_door_top`, (t) => door(t, w.planks, true, DOOR_STYLE[name]));
  def(`${name}_door_bottom`, (t) => door(t, w.planks, false, DOOR_STYLE[name]));
}

// ---------------------------------------------------------------- farm and garden
def('cactus_side', (t) => {
  const pal = [0x0b4d15, 0x0f621c, 0x137324, 0x18832b, 0x239a38];
  quantize(t, t.field([[1, 8, 0.5], [2, 4, 0.3]], 0.3), pal.slice(1, 4), [0.3, 0.4, 0.3]);
  for (let y = 0; y < 16; y++) { t.set(0, y, pal[0]); t.set(15, y, pal[0]); t.set(1, y, pal[4]); for (const x of [5, 10]) t.set(x, y, pal[4]); }
  for (const [x, y] of [[3, 2], [7, 5], [12, 3], [3, 9], [8, 12], [12, 10], [6, 14]]) { t.set(x, y, 0xe8e0b8); t.set(x + 1, y, 0x2a2a18); }
});
def('cactus_top', (t) => {
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
    const d = Math.max(Math.abs(x - 7.5), Math.abs(y - 7.5));
    t.set(x, y, d > 6.5 ? 0x0b4d15 : d > 5.5 ? 0x137324 : pick([0x2c9a3a, 0x38a846, 0x44b452], t.r()));
  }
  for (const [x, y] of [[7, 7], [4, 10], [11, 5], [10, 11], [4, 4]]) t.set(x, y, 0xe8e0b8);
});
def('cactus_bottom', (t) => {
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
    const d = Math.max(Math.abs(x - 7.5), Math.abs(y - 7.5));
    t.set(x, y, d > 6.5 ? 0x0b4d15 : pick([0x8fb05a, 0x9dbd66, 0xaac872], t.r()));
  }
});
const PUMPKIN = [0x8e4c0e, 0xb4640f, 0xc97414, 0xd8821c, 0xe39228, 0xeca43c];
function pumpkinSide(t) {
  quantize(t, t.field([[2, 8, 0.5], [1, 4, 0.3]], 0.25), PUMPKIN.slice(1, 5), [0.2, 0.35, 0.3, 0.15]);
  for (let y = 0; y < 16; y++) for (const x of [0, 5, 10]) { t.set(x, y, PUMPKIN[0]); t.set(x + 1, y, PUMPKIN[5]); }
}
def('pumpkin_side', pumpkinSide);
def('pumpkin_top', (t) => {
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
    const d = Math.max(Math.abs(x - 7.5), Math.abs(y - 7.5));
    t.set(x, y, Math.floor(d) % 3 === 0 ? PUMPKIN[1] : pick(PUMPKIN.slice(2, 5), t.r()));
  }
  paint(t, ['', '', '', '', '', '', '.......sS.......', '......sSSs......', '.......sS.......'], { s: 0x4a5a1a, S: 0x6a7a26 }, { clear: false });
});
function face(t, fill, glow) {
  pumpkinSide(t);
  paint(t, ['', '', '', '', '...kk......kk...', '..kkkk....kkkk..', '...kk......kk...', '', '.......k........', '', '..kk........kk..',
    '..kkkkkkkkkkkk..', '...kkk.kk.kkk...', '....k......k....'], { k: fill }, { clear: false });
  if (glow) for (const [x, y] of [[3, 4], [11, 5], [4, 11], [9, 11]]) t.set(x, y, glow);
}
def('pumpkin_face', (t) => face(t, 0x2a1406, null));
def('jack_face', (t) => face(t, 0xffc83a, 0xfff2a0));
def('melon_side', (t) => {
  quantize(t, t.field([[1, 8, 0.4], [4, 4, 0.2]], 0.3), [0x5c7a14, 0x6c8c1a, 0x7c9e22], [0.3, 0.4, 0.3]);
  for (let y = 0; y < 16; y++) for (const x of [1, 6, 11]) { t.set(x, y, 0x3a5a0c); t.set(x + 1, y, 0x9ab43a); t.set(x + 2, y, 0xa8c448); }
});
def('melon_top', (t) => {
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
    const a = Math.atan2(y - 7.5, x - 7.5), d = Math.hypot(x - 7.5, y - 7.5);
    const stripe = Math.abs(((a + Math.PI) * 5 / Math.PI) % 2 - 1) < 0.3;
    t.set(x, y, d < 1.5 ? 0x4a5a14 : stripe ? 0x9ab43a : pick([0x5c7a14, 0x6c8c1a, 0x7c9e22], t.r()));
  }
});
def('hay_block_side', (t) => {
  quantize(t, t.field([[1, 8, 0.5], [2, 4, 0.3]], 0.3), [0x9a7a1a, 0xb89422, 0xcca82e, 0xdcba3e, 0xe8cc56], W5);
  for (const y0 of [3, 11]) for (let x = 0; x < 16; x++) { t.set(x, y0, 0x7a1a12); t.set(x, y0 + 1, 0x9c2818); }
});
def('hay_block_top', (t) => {
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
    const cx = (x % 3) - 1, cy = (y % 3) - 1;
    t.set(x, y, cx === 0 && cy === 0 ? 0x8a6a14 : pick([0xb89422, 0xcca82e, 0xdcba3e, 0xe8cc56], t.r()));
  }
  frame(t, 0x9c2818, 0x7a1a12);
});

// ---------------------------------------------------------------- chests and beds
const CHEST = [0x4a3216, 0x7a5426, 0x8c622e, 0x9c6e35, 0xa87a3e, 0xb4864a];
const CHEST_EDGE = 0x2e1f0e;
function chestBody(t, rims = [true, true]) {
  drawPlanks(t, CHEST, [16, 16, 16, 16]);
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
    const edge = (rims[0] && x <= 1) || (rims[1] && x >= 14) || y <= 2 || y === 15;
    if (edge) t.set(x, y, (x === 1 && rims[0]) || y === 2 ? CHEST[1] : CHEST_EDGE);
    if (y === 7) t.set(x, y, CHEST_EDGE);
    if (y === 8) t.set(x, y, CHEST[0]);
  }
}
def('chest_side', (t) => chestBody(t));
function latch(t, x0) {
  paint(t, ['', '', '', '', '', '.kk.', 'kSSk', 'kssk', 'kssk', '.kk.'], { k: 0x2a2a2a, S: 0xe8e8e8, s: 0xa8a8a8 }, { clear: false, dx: x0 });
}
def('chest_front', (t) => { chestBody(t); latch(t, 6); });
def('chest_top', (t) => {
  drawPlanks(t, CHEST, [16, 16, 16, 16]);
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) if (x <= 1 || x >= 14 || y <= 1 || y >= 14) t.set(x, y, x === 1 || y === 1 ? CHEST[1] : CHEST_EDGE);
});
// Double chests: each half has its rim on the outside only, and the latch sits on the seam.
def('chest_front_l', (t) => { chestBody(t, [true, false]); latch(t, 14); });
def('chest_front_r', (t) => { chestBody(t, [false, true]); latch(t, -2); });
def('chest_back_double', (t) => chestBody(t, [false, false]));
for (const [name, rimU] of [['chest_top_dx', false], ['chest_top_dz', true]]) {
  def(name, (t) => {
    drawPlanks(t, CHEST, [16, 16, 16, 16]);
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) if (rimU ? x <= 1 || x >= 14 : y <= 1 || y >= 14) t.set(x, y, (rimU ? x === 1 : y === 1) ? CHEST[1] : CHEST_EDGE);
  });
}
const BED_RED = [0x7c1914, 0x962019, 0xa8281f, 0xb83226, 0xc84232];
const SHEET = [0xc8c8c0, 0xdcdcd4, 0xececE4, 0xf8f8f2];
// The pillow sits at the head end of the bed, so there is one top texture per direction
// (n = -Z, s = +Z, e = +X, w = -X edge of the top face).
for (const [name, side] of [['bed_head', 'n'], ['bed_head_s', 's'], ['bed_head_e', 'e'], ['bed_head_w', 'w']]) {
  def(name, (t) => {
    const f = t.field([[2, 2, 0.4]], 0.4);
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
      const along = side === 'n' ? y : side === 's' ? 15 - y : side === 'e' ? 15 - x : x;
      const across = side === 'n' || side === 's' ? x : y;
      let c = pick(BED_RED.slice(1, 4), f[y * 16 + x]);
      if (along < 7 && across > 1 && across < 14) c = along === 6 || across === 13 ? SHEET[0] : pick(SHEET.slice(1), f[y * 16 + x]);
      if (along === 7) c = BED_RED[0];
      if (across === 0 || across === 15) c = BED_RED[1];
      t.set(x, y, c);
    }
  });
}
def('bed_foot', (t) => {
  const f = t.field([[2, 2, 0.4]], 0.4);
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) t.set(x, y, x === 0 || x === 15 ? BED_RED[1] : pick(BED_RED.slice(1, 4), f[y * 16 + x]));
});
def('bed_side', (t) => {
  t.clear();
  for (let y = 7; y < 16; y++) for (let x = 0; x < 16; x++) {
    let c = y === 7 ? BED_RED[4] : y < 11 ? pick(BED_RED.slice(1, 4), t.r()) : y < 13 ? pick(SHEET, t.r()) : pick(OAK.slice(1, 4), t.r());
    if (y === 10) c = BED_RED[0];
    if (y >= 13 && x > 2 && x < 13) continue;
    t.set(x, y, c);
  }
});
