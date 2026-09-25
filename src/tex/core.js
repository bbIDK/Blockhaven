// The texture toolkit: every block, item and creature texture is a 16x16 picture drawn from code
// with these helpers, so they all share one look: colour ramps that shift hue from cool shadows
// to warm highlights, light from the top left, a darker outline around items, and tileable noise
// for blocks. (Minecraft's own conventions, as the Blockbench style guide describes them.)
import { mulberry32, hashString } from '../math.js';

export const defs = [];
// `group`: this texture starts a run of that many layers that must stay together (a block's
// overlay is the layer after its base; animations use consecutive frames).
export const def = (name, draw, { group = 1 } = {}) => defs.push({ name, draw, group });

export class Tex {
  constructor(name) {
    this.d = new Uint8ClampedArray(16 * 16 * 4);
    this.rand = mulberry32(hashString(name));
  }
  r() { return this.rand(); }
  ri(n) { return Math.floor(this.rand() * n); }
  set(x, y, c, a = 255) {
    if (x < 0 || y < 0 || x > 15 || y > 15) return;
    const i = (y * 16 + x) * 4;
    this.d[i] = (c >> 16) & 255;
    this.d[i + 1] = (c >> 8) & 255;
    this.d[i + 2] = c & 255;
    this.d[i + 3] = a;
  }
  // Wrapping set, for patterns that must tile.
  wset(x, y, c, a = 255) { this.set(x & 15, y & 15, c, a); }
  get(x, y) {
    const i = ((y & 15) * 16 + (x & 15)) * 4;
    return (this.d[i] << 16) | (this.d[i + 1] << 8) | this.d[i + 2];
  }
  alpha(x, y) { return x < 0 || y < 0 || x > 15 || y > 15 ? 0 : this.d[(y * 16 + x) * 4 + 3]; }
  fill(c, a = 255) { for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) this.set(x, y, c, a); }
  clear() { this.d.fill(0); }
  copy(other) { this.d.set(other.d); }
  // Tileable value noise in [0,1] with the given cell size (1, 2, 4, 8 or 16). `cy` gives a
  // different cell height, for streaky patterns (wood grain, layered rock).
  noise(cell, cy = cell) {
    const gx = Math.max(1, 16 / cell), gy = Math.max(1, 16 / cy);
    const grid = new Float32Array(gx * gy).map(() => this.r());
    const out = new Float32Array(256);
    for (let y = 0; y < 16; y++) {
      for (let x = 0; x < 16; x++) {
        const px = x / cell, py = y / cy;
        const x0 = Math.floor(px), y0 = Math.floor(py);
        const fx = px - x0, fy = py - y0;
        const sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
        const a = grid[(y0 % gy) * gx + (x0 % gx)], b = grid[(y0 % gy) * gx + ((x0 + 1) % gx)];
        const c = grid[((y0 + 1) % gy) * gx + (x0 % gx)], d = grid[((y0 + 1) % gy) * gx + ((x0 + 1) % gx)];
        out[y * 16 + x] = (a + (b - a) * sx) * (1 - sy) + (c + (d - c) * sx) * sy;
      }
    }
    return out;
  }
  // A mix of noises: [[cellX, cellY, weight], ...] plus per-pixel grain.
  field(layers, grain = 0) {
    const out = new Float32Array(256);
    for (const [cx, cy, w] of layers) { const n = this.noise(cx, cy); for (let i = 0; i < 256; i++) out[i] += n[i] * w; }
    if (grain) for (let i = 0; i < 256; i++) out[i] += this.r() * grain;
    return out;
  }
  line(x0, y0, x1, y1, c) {
    const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0);
    const sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
    let err = dx + dy;
    for (;;) {
      this.set(x0, y0, c);
      if (x0 === x1 && y0 === y1) break;
      const e2 = 2 * err;
      if (e2 >= dy) { err += dy; x0 += sx; }
      if (e2 <= dx) { err += dx; y0 += sy; }
    }
  }
}

// ---------------------------------------------------------------- colour
export const pick = (pal, v) => pal[Math.min(pal.length - 1, Math.max(0, Math.floor(v * pal.length)))];

export function mix(c1, c2, t) {
  const r = ((c1 >> 16) & 255) * (1 - t) + ((c2 >> 16) & 255) * t;
  const g = ((c1 >> 8) & 255) * (1 - t) + ((c2 >> 8) & 255) * t;
  const b = (c1 & 255) * (1 - t) + (c2 & 255) * t;
  return (Math.round(r) << 16) | (Math.round(g) << 8) | Math.round(b);
}
export const shade = (c, f) => {
  const k = Math.max(0, f);
  const r = Math.min(255, ((c >> 16) & 255) * k), g = Math.min(255, ((c >> 8) & 255) * k), b = Math.min(255, (c & 255) * k);
  return (Math.round(r) << 16) | (Math.round(g) << 8) | Math.round(b);
};
export const lighten = (c, t) => mix(c, 0xffffff, t);

function toHsl(c) {
  const r = ((c >> 16) & 255) / 255, g = ((c >> 8) & 255) / 255, b = (c & 255) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b), l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min, s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [h * 60, s, l];
}
function fromHsl(h, s, l) {
  h = ((h % 360) + 360) % 360;
  s = Math.min(1, Math.max(0, s)); l = Math.min(1, Math.max(0, l));
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s, p = 2 * l - q;
  const f = (t) => {
    t = ((t % 1) + 1) % 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };
  const k = h / 360;
  return (Math.round(f(k + 1 / 3) * 255) << 16) | (Math.round(f(k) * 255) << 8) | Math.round(f(k - 1 / 3) * 255);
}

// A colour ramp of `n` shades around `base`, dark to light. Shadows lean towards blue and get a
// little more saturated; highlights lean towards yellow, the way pixel artists shift hue.
// `range`: how far lightness spreads each way; `hue`: degrees of shift at the ends.
export function ramp(base, n = 5, range = 0.2, hue = 10) {
  const [h, s, l] = toHsl(base);
  const out = [];
  for (let i = 0; i < n; i++) {
    const k = n === 1 ? 0 : (i / (n - 1)) * 2 - 1; // -1 darkest .. 1 lightest
    // Hue moves towards 240 (blue) in shadow and 60 (yellow) in light.
    const target = k < 0 ? 240 : 60;
    let dh = ((target - h + 540) % 360) - 180;
    dh = Math.max(-Math.abs(hue), Math.min(Math.abs(hue), dh)) * Math.abs(k);
    out.push(fromHsl(h + (s < 0.05 ? 0 : dh), s * (1 + (k < 0 ? -k * 0.15 : -k * 0.2)), l + k * range));
  }
  return out;
}

// Grey versions for textures the game tints (grass, leaves): the tint supplies the colour.
export const greys = (from, to, n) => Array.from({ length: n }, (_, i) => { const v = Math.round(from + ((to - from) * i) / (n - 1)); return (v << 16) | (v << 8) | v; });

// ---------------------------------------------------------------- patterns
// Wrapped distance for tileable cell patterns.
const wd = (a, b) => { const d = Math.abs(a - b); return Math.min(d, 16 - d); };

// Tileable Voronoi cells: for each pixel which cell it's in, how close to the edge, and its
// position relative to the cell's centre (for shading stones and pebbles).
export function cells(t, count, minDist = 0) {
  const pts = [];
  for (let tries = 0; pts.length < count && tries < count * 40; tries++) {
    const p = [t.r() * 16, t.r() * 16, t.r()];
    if (minDist && pts.some((q) => Math.hypot(wd(p[0], q[0]), wd(p[1], q[1])) < minDist)) continue;
    pts.push(p);
  }
  const id = new Int8Array(256), edge = new Float32Array(256), rel = new Float32Array(512);
  for (let y = 0; y < 16; y++) {
    for (let x = 0; x < 16; x++) {
      let d1 = 1e9, d2 = 1e9, best = 0;
      for (let i = 0; i < pts.length; i++) {
        const dx = wd(x + 0.5, pts[i][0]), dy = wd(y + 0.5, pts[i][1]);
        const d = Math.sqrt(dx * dx + dy * dy);
        if (d < d1) { d2 = d1; d1 = d; best = i; } else if (d < d2) d2 = d;
      }
      id[y * 16 + x] = best;
      edge[y * 16 + x] = d2 - d1;
      let rx = x + 0.5 - pts[best][0], ry = y + 0.5 - pts[best][1];
      if (rx > 8) rx -= 16; if (rx < -8) rx += 16; if (ry > 8) ry -= 16; if (ry < -8) ry += 16;
      rel[(y * 16 + x) * 2] = rx; rel[(y * 16 + x) * 2 + 1] = ry;
    }
  }
  return { pts, id, edge, rel };
}

// Ranks the pixels of `f` (a field, or any 256 numbers) and hands out the palette (dark to
// light) in the proportions `weights`, so every texture uses its whole ramp the same way.
// `mask(i)` limits it to some pixels. Returns the palette index chosen for each pixel.
export function quantize(t, f, pal, weights = null, mask = null) {
  const idx = [];
  for (let i = 0; i < 256; i++) if (!mask || mask(i)) idx.push(i);
  idx.sort((a, b) => f[a] - f[b]);
  const w = weights ?? pal.map(() => 1);
  const total = w.reduce((a, b) => a + b, 0);
  const out = new Int8Array(256).fill(-1);
  let k = 0, acc = w[0] / total;
  idx.forEach((i, n) => {
    while ((n + 0.5) / idx.length > acc && k < pal.length - 1) acc += w[++k] / total;
    out[i] = k;
    t.set(i & 15, i >> 4, pal[k]);
  });
  return out;
}

// Speckled noise from a palette (dark to light): smooth blotches of `cell` pixels with
// per-pixel grain on top. `bias` shifts towards the light end.
export function speckle(t, pal, { cell = 4, grain = 0.45, bias = 0, fine = 0 } = {}) {
  const n = t.noise(cell), m = fine ? t.noise(2) : null;
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
    const i = y * 16 + x;
    let v = n[i] * (1 - grain) + t.r() * grain + bias;
    if (m) v = v * (1 - fine) + m[i] * fine;
    t.set(x, y, pick(pal, v));
  }
}

// Scatters `n` small clusters of colour (ore flecks, specks in stone).
export function flecks(t, n, pal, { size = 3, shadow = null } = {}) {
  const SHAPES = [[[0, 0], [1, 0], [0, 1]], [[0, 0], [1, 0], [1, 1], [0, 1]], [[0, 0], [1, 0], [2, 0], [1, 1]],
    [[0, 0], [0, 1], [1, 1], [1, 2]], [[1, 0], [0, 1], [1, 1], [2, 1], [1, 2]], [[0, 0], [1, 1]]];
  for (let k = 0; k < n; k++) {
    const x = t.ri(16), y = t.ri(16), shape = SHAPES[t.ri(Math.min(SHAPES.length, size + 2))];
    shape.forEach(([dx, dy], i) => t.wset(x + dx, y + dy, i === 0 ? pal[pal.length - 1] : pick(pal, t.r() * 0.8)));
    if (shadow !== null) t.wset(x + 1 + (shape.length > 3 ? 1 : 0), y + 2, shadow);
  }
}

// ---------------------------------------------------------------- sprites
// Draws a 16-row picture. Each character is looked up in `legend` (a colour, or a function of
// (x, y) returning one); '.' and unknown characters are left transparent.
export function paint(t, rows, legend, { dx = 0, dy = 0, clear = true } = {}) {
  if (clear) t.clear();
  rows.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) {
      const v = legend[row[x]];
      if (v === undefined || v === null) continue;
      const c = typeof v === 'function' ? v(x + dx, y + dy) : v;
      if (c === null || c === undefined) continue;
      t.set(x + dx, y + dy, c);
    }
  });
}

// One part of an item: a tone map (each character looked up in `legend`; '.' and characters it
// doesn't have are left alone), then an outline of `edge` round it wherever it borders a pixel
// that's still empty. Parts drawn later go over earlier ones (a tool's head over its handle),
// and their outlines never cover what's already drawn.
export function part(t, rows, legend, edge = null) {
  const mine = new Set();
  rows.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) {
      const v = legend[row[x]];
      if (v === undefined || v === null) continue;
      t.set(x, y, typeof v === 'function' ? v(x, y) : v);
      mine.add(y * 16 + x);
    }
  });
  if (edge === null) return;
  for (const i of mine) {
    const x = i & 15, y = i >> 4;
    for (const [nx, ny] of [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]]) {
      if (nx >= 0 && ny >= 0 && nx < 16 && ny < 16 && !t.alpha(nx, ny)) t.set(nx, ny, edge);
    }
  }
}

// A shape shaded by where each pixel faces, for tool heads, armour and the like. In `rows`, 'x'
// is shaded automatically - lit on its top-left edges (5 where both are open), shadowed on its
// bottom-right ones (1 in the corner), 3 inside; digits 1 to 5 set a pixel's tone by hand, and
// other characters come from `legend` (drawn over, and counted as part of the shape). `pal` is
// [outline, 1 darkest .. 5 highlight]; the outline goes all round, but never over what's drawn.
export function form(t, rows, pal, { legend = {}, grain = 0 } = {}) {
  const at = (x, y) => (y >= 0 && y < rows.length && x >= 0 && x < 16 ? rows[y][x] ?? '.' : '.');
  const on = (x, y) => at(x, y) !== '.';
  for (let y = 0; y < rows.length; y++) for (let x = 0; x < 16; x++) {
    const ch = at(x, y);
    if (ch === '.') continue;
    if (legend[ch] !== undefined) { t.set(x, y, typeof legend[ch] === 'function' ? legend[ch](x, y) : legend[ch]); continue; }
    let k = Number(ch);
    if (!(k >= 1 && k <= 5)) {
      const up = !on(x, y - 1), left = !on(x - 1, y), down = !on(x, y + 1), right = !on(x + 1, y);
      const lit = up || left, dark = down || right;
      k = lit && !dark ? (up && left ? 5 : 4) : dark && !lit ? (down && right ? 1 : 2) : 3;
      if (grain && k > 1 && k < 5 && t.r() < grain) k += t.r() < 0.5 ? -1 : 1;
    }
    t.set(x, y, pal[k]);
  }
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
    if (on(x, y) || t.alpha(x, y)) continue;
    if (on(x - 1, y) || on(x + 1, y) || on(x, y - 1) || on(x, y + 1)) t.set(x, y, pal[0]);
  }
}

// Outline: every opaque pixel on the edge of the shape (next to a transparent one) turns `color`.
// `only`: limits it to pixels whose current colour is in this set.
export function outline(t, color, only = null) {
  const edge = [];
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
    if (!t.alpha(x, y)) continue;
    if (only && !only.has(t.get(x, y))) continue;
    if (!t.alpha(x - 1, y) || !t.alpha(x + 1, y) || !t.alpha(x, y - 1) || !t.alpha(x, y + 1)) edge.push([x, y]);
  }
  for (const [x, y] of edge) t.set(x, y, color);
}

// Mirror of a sprite, for the other hand of a pair (boots, leggings).
export function flipX(t) {
  const d = t.d.slice();
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) for (let c = 0; c < 4; c++) t.d[(y * 16 + x) * 4 + c] = d[(y * 16 + 15 - x) * 4 + c];
}

// Item sprites. `rows` is a 16x16 mask: 'x' marks the material, which is shaded by rule with
// `pal` = [outline, dark, mid, light, highlight] (lit on its top-left edges, dark on its
// bottom-right ones, highlighted where both the pixel above and the one to its left are
// empty); other characters come from `legend`; '.' is empty. An outline of pal[0] is then
// drawn around the material: on the shadow side only ('br', the Minecraft way for tools) or
// all round ('all'). Characters in `legend` are drawn after the outline, so they sit in front.
export function shaded(t, rows, pal, legend = {}, { outline = 'br', clear = true, grain = 0, interior = true } = {}) {
  if (clear) t.clear();
  const at = (x, y) => (y >= 0 && y < rows.length && x >= 0 && x < 16 ? rows[y][x] ?? '.' : '.');
  const mat = (x, y) => at(x, y) === 'x';
  let sx = 0, sy = 0, n = 0;
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) if (mat(x, y)) { sx += x; sy += y; n++; }
  const cx = n ? sx / n : 8, cy = n ? sy / n : 8;
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
    if (!mat(x, y)) continue;
    const up = !mat(x, y - 1), left = !mat(x - 1, y), down = !mat(x, y + 1), right = !mat(x + 1, y);
    const lit = up || left, shadow = down || right;
    let k;
    if (lit && !shadow) k = up && left ? 4 : 3;
    else if (shadow && !lit) k = 1;
    else if (lit && shadow) k = up && !down ? 3 : left && !right ? 3 : 2;
    else if (interior) { const d = (x - cx) + (y - cy); k = d < -3.5 ? 3 : d > 3 ? 1 : 2; }
    else k = 2;
    if (grain && k > 0 && k < 4 && t.r() < grain) k += t.r() < 0.5 ? -1 : 1;
    t.set(x, y, pal[Math.max(1, Math.min(4, k))]);
  }
  if (outline) {
    const edge = [];
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
      if (at(x, y) !== '.' || t.alpha(x, y)) continue;
      const br = mat(x - 1, y) || mat(x, y - 1);
      const tl = mat(x + 1, y) || mat(x, y + 1);
      if (br || (outline === 'all' && tl)) edge.push([x, y]);
    }
    for (const [x, y] of edge) t.set(x, y, pal[0]);
  }
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
    const ch = at(x, y);
    if (ch === '.' || ch === 'x') continue;
    const v = legend[ch];
    if (v === undefined || v === null) continue;
    t.set(x, y, typeof v === 'function' ? v(x, y) : v);
  }
}
