// Creature skins: 64x64 pictures laid out the way Minecraft lays out its mob skins, where every
// box of a model unfolds into a strip (its top and bottom above, then its right, front, left and
// back sides). A model's boxes pick their faces out of the skin at one pixel per sixteenth of a
// block, so a pig, a zombie and a villager all share the blocks' pixel size. Skins are drawn from
// code like every other texture (see tex/mobskins.js) and live in their own texture array; the
// shader samples it for layer numbers from SKIN_LAYER up.
import { mulberry32, hashString } from './math.js';

export const SKIN_SIZE = 64;
export const SKIN_LAYER = 1024;

export const SKINS = [];        // [{ name, draw }]
export const SKIN_INDEX = {};   // name -> index
export function skin(name, draw) {
  if (name in SKIN_INDEX) throw new Error(`Skin defined twice: ${name}`);
  SKIN_INDEX[name] = SKINS.length;
  SKINS.push({ name, draw });
}
export const skinLayer = (name) => {
  if (!(name in SKIN_INDEX)) throw new Error(`Unknown skin ${name}`);
  return SKIN_LAYER + SKIN_INDEX[name];
};

// The six faces of a box in the skin: [x, y, w, h] each (Minecraft's box layout).
export function boxRegions(u, v, w, h, d) {
  return {
    top: [u + d, v, w, d], bottom: [u + d + w, v, w, d],
    right: [u, v + d, d, h], front: [u + d, v + d, w, h], left: [u + d + w, v + d, d, h], back: [u + 2 * d + w, v + d, w, h],
  };
}

export class Skin {
  constructor(name) {
    this.d = new Uint8ClampedArray(SKIN_SIZE * SKIN_SIZE * 4);
    this.rand = mulberry32(hashString(name));
  }
  r() { return this.rand(); }
  ri(n) { return Math.floor(this.rand() * n); }
  set(x, y, c, a = 255) {
    if (x < 0 || y < 0 || x >= SKIN_SIZE || y >= SKIN_SIZE) return;
    const i = (y * SKIN_SIZE + x) * 4;
    this.d[i] = (c >> 16) & 255; this.d[i + 1] = (c >> 8) & 255; this.d[i + 2] = c & 255; this.d[i + 3] = a;
  }
  get(x, y) {
    const i = (y * SKIN_SIZE + x) * 4;
    return (this.d[i] << 16) | (this.d[i + 1] << 8) | this.d[i + 2];
  }
  alpha(x, y) { return this.d[(y * SKIN_SIZE + x) * 4 + 3]; }
  clearRect(x, y, w, h) { for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) this.set(x + i, y + j, 0, 0); }
  rect(x, y, w, h, c) { for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) this.set(x + i, y + j, c); }
  // Fills a rectangle from a palette (dark to light) through value noise, the way the block
  // textures are made: `cell` sets the size of the blotches, `grain` the per-pixel speckle, and
  // `weights` how much of each shade (by rank, so every fill has the same mix).
  fill([x0, y0, w, h], pal, { cell = 2, cy = cell, grain = 0.35, weights = null } = {}) {
    const n = this.field(w, h, cell, cy, grain);
    const order = [...n.keys()].sort((a, b) => n[a] - n[b]);
    // (By default most of the fill is the middle shades, fading out towards the ends.)
    const wts = weights ?? pal.map((_, i) => Math.exp(-(((i - (pal.length - 1) / 2) / (pal.length / 3.2)) ** 2)));
    const total = wts.reduce((a, b) => a + b, 0);
    let k = 0, acc = wts[0] / total;
    order.forEach((i, rank) => {
      while (k < pal.length - 1 && (rank + 0.5) / order.length > acc) acc += wts[++k] / total;
      this.set(x0 + (i % w), y0 + Math.floor(i / w), pal[k]);
    });
  }
  field(w, h, cell, cy, grain) {
    const gx = Math.ceil(w / cell) + 1, gy = Math.ceil(h / cy) + 1;
    const g = Array.from({ length: gx * gy }, () => this.r());
    const out = new Float32Array(w * h);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const fx = x / cell, fy = y / cy, ix = Math.floor(fx), iy = Math.floor(fy), tx = fx - ix, ty = fy - iy;
      const a = g[iy * gx + ix], b = g[iy * gx + ix + 1], c = g[(iy + 1) * gx + ix], d = g[(iy + 1) * gx + ix + 1];
      out[y * w + x] = (a + (b - a) * tx) * (1 - ty) + (c + (d - c) * tx) * ty + (this.r() - 0.5) * grain;
    }
    return out;
  }
  // Draws rows of characters with a legend (as in the block textures), '.' for untouched.
  paint(x0, y0, rows, legend) {
    rows.forEach((row, y) => [...row].forEach((ch, x) => { if (ch in legend) this.set(x0 + x, y0 + y, legend[ch]); }));
  }
  // Paints each face of a model box: fn(faceName, [x, y, w, h]).
  box(cube, fn) {
    const [w, h, d] = cube.size, [u, v] = cube.uv;
    for (const [face, r] of Object.entries(boxRegions(u, v, w, h, d))) fn(face, r);
  }
}

// RGBA pixels for every skin, SKIN_SIZE^2 * 4 bytes each. Clear pixels take the average colour
// so the mipmaps don't darken the edges of cut-out parts.
export function generateSkins() {
  const size = SKIN_SIZE * SKIN_SIZE * 4;
  const out = new Uint8Array(SKINS.length * size);
  SKINS.forEach((s, i) => {
    const sk = new Skin(s.name);
    s.draw(sk);
    let r = 0, g = 0, b = 0, n = 0;
    for (let k = 0; k < size; k += 4) if (sk.d[k + 3]) { r += sk.d[k]; g += sk.d[k + 1]; b += sk.d[k + 2]; n++; }
    if (n) for (let k = 0; k < size; k += 4) if (!sk.d[k + 3]) { sk.d[k] = r / n; sk.d[k + 1] = g / n; sk.d[k + 2] = b / n; }
    out.set(sk.d, i * size);
  });
  return out;
}
