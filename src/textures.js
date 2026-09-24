// Procedural 16x16 pixel art. Every block and item texture is drawn here from code, so the game
// ships without any image assets. Textures become layers of one WebGL texture array.
import { mulberry32, hashString } from './math.js';

const defs = [];
const def = (name, draw) => defs.push({ name, draw });

class Tex {
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
  get(x, y) {
    const i = ((y & 15) * 16 + (x & 15)) * 4;
    return (this.d[i] << 16) | (this.d[i + 1] << 8) | this.d[i + 2];
  }
  alpha(x, y) { return this.d[((y & 15) * 16 + (x & 15)) * 4 + 3]; }
  fill(c, a = 255) { for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) this.set(x, y, c, a); }
  clear() { this.d.fill(0); }
  copy(other) { this.d.set(other.d); }
  // Tileable value noise in [0,1] with the given cell size (1, 2, 4, 8 or 16).
  noise(cell) {
    const g = Math.max(1, 16 / cell);
    const grid = new Float32Array(g * g).map(() => this.r());
    const out = new Float32Array(256);
    for (let y = 0; y < 16; y++) {
      for (let x = 0; x < 16; x++) {
        const gx = x / cell, gy = y / cell;
        const x0 = Math.floor(gx), y0 = Math.floor(gy);
        const fx = gx - x0, fy = gy - y0;
        const sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
        const a = grid[(y0 % g) * g + (x0 % g)], b = grid[(y0 % g) * g + ((x0 + 1) % g)];
        const c = grid[((y0 + 1) % g) * g + (x0 % g)], d = grid[((y0 + 1) % g) * g + ((x0 + 1) % g)];
        out[y * 16 + x] = (a + (b - a) * sx) * (1 - sy) + (c + (d - c) * sx) * sy;
      }
    }
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

const pick = (pal, v) => pal[Math.min(pal.length - 1, Math.max(0, Math.floor(v * pal.length)))];

function mix(c1, c2, t) {
  const r = ((c1 >> 16) & 255) * (1 - t) + ((c2 >> 16) & 255) * t;
  const g = ((c1 >> 8) & 255) * (1 - t) + ((c2 >> 8) & 255) * t;
  const b = (c1 & 255) * (1 - t) + (c2 & 255) * t;
  return (Math.round(r) << 16) | (Math.round(g) << 8) | Math.round(b);
}
const shade = (c, f) => mix(0, c, Math.min(1, f)) | 0;
const lighten = (c, t) => mix(c, 0xffffff, t);

// Wrapped distance for tileable cell patterns.
const wd = (a, b) => { const d = Math.abs(a - b); return Math.min(d, 16 - d); };

function cells(t, count) {
  const pts = [];
  for (let i = 0; i < count; i++) pts.push([t.r() * 16, t.r() * 16, t.r()]);
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

// ---------------------------------------------------------------- natural blocks
const STONE = [0x6a6a6a, 0x737373, 0x7c7c7c, 0x858585, 0x8f8f8f];
function drawStone(t, pal = STONE) {
  const n = t.noise(4), m = t.noise(2);
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
    const v = n[y * 16 + x] * 0.5 + m[y * 16 + x] * 0.25 + t.r() * 0.35;
    t.set(x, y, pick(pal, v * 0.95));
  }
  for (let k = 0; k < 5; k++) {
    const x = t.ri(16), y = t.ri(16), len = 2 + t.ri(3);
    for (let i = 0; i < len; i++) t.set(x + i, y + (i > 1 && t.r() < 0.4 ? 1 : 0), shade(pal[0], 0.88));
  }
}
def('stone', (t) => drawStone(t));

const DIRT = [0x593b26, 0x684630, 0x765337, 0x845e41, 0x926b4c];
function drawDirt(t) {
  const n = t.noise(4);
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
    t.set(x, y, pick(DIRT, t.r() * 0.7 + n[y * 16 + x] * 0.3));
  }
  for (let k = 0; k < 9; k++) t.set(t.ri(16), t.ri(16), t.r() < 0.5 ? 0x9f7b5a : 0x47301f);
}
def('dirt', drawDirt);

const GRASS_GRAY = [0x818181, 0x8f8f8f, 0x9d9d9d, 0xababab, 0xb9b9b9, 0xc7c7c7];
def('grass_top', (t) => {
  const n = t.noise(4);
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
    t.set(x, y, pick(GRASS_GRAY, t.r() * 0.65 + n[y * 16 + x] * 0.35));
  }
});
// Side of a grass block: dirt, plus a tinted overlay in the very next layer.
def('grass_side', drawDirt);
def('grass_side_overlay', (t) => {
  t.clear();
  for (let x = 0; x < 16; x++) {
    const depth = 3 + (t.r() < 0.55 ? 1 : 0) + (t.r() < 0.2 ? 1 : 0);
    for (let y = 0; y < depth; y++) t.set(x, y, pick(GRASS_GRAY, t.r() * 0.8 + (y === depth - 1 ? 0 : 0.2)));
  }
});
def('grass_side_snowy', (t) => {
  drawDirt(t);
  for (let x = 0; x < 16; x++) {
    const depth = 3 + (t.r() < 0.5 ? 1 : 0) + (t.r() < 0.15 ? 1 : 0);
    for (let y = 0; y < depth; y++) t.set(x, y, pick([0xdde7ea, 0xeaf2f3, 0xf7fbfb], t.r()));
  }
});

def('sand', (t) => {
  const pal = [0xcfc08a, 0xd7c994, 0xdcd09c, 0xe2d6a4, 0xe8ddae];
  const n = t.noise(4);
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) t.set(x, y, pick(pal, t.r() * 0.75 + n[y * 16 + x] * 0.25));
  for (let k = 0; k < 7; k++) t.set(t.ri(16), t.ri(16), 0xbba874);
});

def('gravel', (t) => {
  const pal = [0x6b6866, 0x7f7b78, 0x938f8b, 0xa6a19b, 0x7a7068, 0x5f5b58];
  const c = cells(t, 20);
  const tone = c.pts.map(() => pick(pal, t.r()));
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
    const i = y * 16 + x;
    if (c.edge[i] < 0.7) t.set(x, y, 0x4c4947);
    else t.set(x, y, c.rel[i * 2 + 1] < -0.6 ? lighten(tone[c.id[i]], 0.12) : tone[c.id[i]]);
  }
});

def('clay', (t) => {
  const pal = [0x949aa7, 0x9ba1ae, 0xa1a7b4, 0xa8aeba];
  const n = t.noise(8);
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) t.set(x, y, pick(pal, n[y * 16 + x] * 0.6 + t.r() * 0.4));
});

def('bedrock', (t) => {
  const pal = [0x111111, 0x262626, 0x3a3a3a, 0x4f4f4f, 0x666666];
  const n = t.noise(2);
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) t.set(x, y, pick(pal, n[y * 16 + x] * 0.55 + t.r() * 0.45));
});

function drawOre(t, pal) {
  drawStone(t);
  const clusters = 4 + t.ri(2);
  for (let k = 0; k < clusters; k++) {
    const cx = 2 + t.ri(12), cy = 2 + t.ri(12);
    const shape = [[0, 0], [1, 0], [0, 1], [1, 1], [-1, 0], [0, -1], [2, 1], [1, 2]];
    const n = 3 + t.ri(4);
    for (let i = 0; i < n; i++) {
      const [dx, dy] = shape[i];
      t.set(cx + dx, cy + dy, pick(pal, t.r()));
    }
    t.set(cx, cy, lighten(pal[pal.length - 1], 0.3));
    t.set(cx + 2, cy + 2, 0x5a5a5a);
  }
}
def('coal_ore', (t) => drawOre(t, [0x1a1a1a, 0x262626, 0x333333, 0x404040]));
def('iron_ore', (t) => drawOre(t, [0xaf8e77, 0xc49f86, 0xd8b59b, 0xe6c7ae]));
def('gold_ore', (t) => drawOre(t, [0xd9a61e, 0xf0c52d, 0xfbdc4d, 0xfff08a]));
def('diamond_ore', (t) => drawOre(t, [0x1fb8c4, 0x3fd6df, 0x6de8ee, 0xb4fbff]));

def('water', (t) => {
  const pal = [0x2b58c8, 0x3162cf, 0x376bd6, 0x3f75dd, 0x4c82e5, 0x5a8fec];
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
    const w = Math.sin((x + Math.sin(y * 0.9) * 1.6) * 0.78 + y * 0.39) * 0.5 + 0.5;
    t.set(x, y, pick(pal, w * 0.8 + t.r() * 0.2), 170);
  }
});

def('lava', (t) => {
  const pal = [0xc2330a, 0xd9480c, 0xea6012, 0xf7801c, 0xffa12b, 0xffc04a];
  const n = t.noise(4), m = t.noise(8);
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
    const v = Math.abs(n[y * 16 + x] - 0.5) * 1.4 + m[y * 16 + x] * 0.4 + t.r() * 0.15;
    t.set(x, y, pick(pal, 1 - v));
  }
});

def('ice', (t) => {
  const pal = [0x7ea7ea, 0x8cb3f0, 0x9abff4, 0xa8caf7];
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) t.set(x, y, pick(pal, t.r()), 190);
  for (let k = 0; k < 3; k++) {
    const x = t.ri(12), y = t.ri(12);
    for (let i = 0; i < 4; i++) t.set(x + i, y + i, 0xdcebff, 205);
  }
});

def('snow', (t) => {
  const pal = [0xdfe9ec, 0xe8f0f2, 0xf0f6f7, 0xf8fcfc];
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) t.set(x, y, pick(pal, t.r() * 0.8 + 0.2));
});

def('obsidian', (t) => {
  const pal = [0x0e0a17, 0x150f22, 0x1d152e, 0x281d3f, 0x3a2a59];
  const n = t.noise(4);
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) t.set(x, y, pick(pal, n[y * 16 + x] * 0.5 + t.r() * 0.5 - 0.05));
});

def('glowstone', (t) => {
  const pal = [0x8f6428, 0xb7843a, 0xd9a54c, 0xf2c562, 0xffe08c];
  const c = cells(t, 9);
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
    const i = y * 16 + x;
    const d = Math.hypot(c.rel[i * 2], c.rel[i * 2 + 1]);
    t.set(x, y, c.edge[i] < 0.8 ? pal[0] : pick(pal, 1 - d / 5 + t.r() * 0.2));
  }
});

// ---------------------------------------------------------------- wood
const WOODS = {
  oak: { planks: [0x9f804b, 0xa88852, 0xb08f58, 0xb99860], seam: 0x6c522d, grain: 0x8d6f41,
    bark: [0x4d3a20, 0x5c4527, 0x6a5130, 0x77603a], ring: [0xa9894f, 0x957544], core: 0xb8985e },
  birch: { planks: [0xc3b27a, 0xcbba81, 0xd2c188, 0xd8c890], seam: 0x928355, grain: 0xb4a36d,
    bark: [0xd8d8d0, 0xe3e3dc, 0xedede6, 0xf6f6f0], ring: [0xcdbd84, 0xb9a872], core: 0xd9c993 },
  spruce: { planks: [0x6e5031, 0x765736, 0x7e5e3a, 0x86653f], seam: 0x45321d, grain: 0x62472a,
    bark: [0x2f2113, 0x3a2918, 0x45321e, 0x503b24], ring: [0x7a5c38, 0x654a2c], core: 0x8a6a43 },
};

function drawPlanks(t, w) {
  for (let p = 0; p < 4; p++) {
    const y0 = p * 4, seamX = (t.ri(8) + p * 5) & 15;
    const base = w.planks[t.ri(w.planks.length)];
    for (let y = y0; y < y0 + 4; y++) {
      for (let x = 0; x < 16; x++) {
        let c = mix(base, w.planks[t.ri(w.planks.length)], 0.35);
        if (y === y0 + 3) c = w.seam;
        else if (x === seamX) c = shade(w.seam, 1.1);
        else if (t.r() < 0.12) c = w.grain;
        t.set(x, y, c);
      }
    }
    const gx = t.ri(16), gy = y0 + 1 + t.ri(2);
    for (let i = 0; i < 3 + t.ri(4); i++) if (((gx + i) & 15) !== seamX) t.set((gx + i) & 15, gy, w.grain);
  }
}
function drawBark(t, w, birch) {
  for (let x = 0; x < 16; x++) {
    const col = w.bark[t.ri(w.bark.length)];
    for (let y = 0; y < 16; y++) {
      let c = mix(col, w.bark[t.ri(w.bark.length)], 0.3);
      if (!birch && (x % 4 === 1) && t.r() < 0.7) c = shade(w.bark[0], 0.85);
      t.set(x, y, c);
    }
  }
  if (birch) {
    for (let k = 0; k < 9; k++) {
      const x = t.ri(16), y = t.ri(16), len = 1 + t.ri(4);
      for (let i = 0; i < len; i++) t.set((x + i) & 15, y, t.r() < 0.7 ? 0x2b2b28 : 0x55554f);
    }
  } else {
    for (let k = 0; k < 3; k++) {
      const x = t.ri(16), y = t.ri(14);
      t.set(x, y, shade(w.bark[0], 0.7)); t.set(x, y + 1, shade(w.bark[0], 0.8));
    }
  }
}
function drawLogTop(t, w) {
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
    const d = Math.max(Math.abs(x - 7.5), Math.abs(y - 7.5));
    if (d > 6.6) { t.set(x, y, w.bark[t.ri(w.bark.length)]); continue; }
    const ring = Math.floor(d + t.r() * 0.6) % 2;
    t.set(x, y, d < 1.5 ? w.core : w.ring[ring]);
  }
}
for (const [name, w] of Object.entries(WOODS)) {
  def(`${name}_planks`, (t) => drawPlanks(t, w));
  def(`${name}_log`, (t) => drawBark(t, w, name === 'birch'));
  def(`${name}_log_top`, (t) => drawLogTop(t, w));
}

function drawLeaves(t, holes, pal) {
  const n = t.noise(4);
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
    if (t.r() < holes) { t.set(x, y, 0, 0); continue; }
    const v = t.r() * 0.6 + n[y * 16 + x] * 0.4;
    t.set(x, y, pick(pal, v));
  }
  for (let k = 0; k < 10; k++) {
    const x = t.ri(16), y = t.ri(16);
    if (t.alpha(x, y)) t.set(x, y, lighten(pal[pal.length - 1], 0.15));
  }
}
def('oak_leaves', (t) => drawLeaves(t, 0.2, [0x505050, 0x646464, 0x787878, 0x8c8c8c, 0xa0a0a0]));
def('birch_leaves', (t) => drawLeaves(t, 0.18, [0x5e5e5e, 0x727272, 0x868686, 0x9a9a9a, 0xaeaeae]));
def('spruce_leaves', (t) => {
  drawLeaves(t, 0.12, [0x4a4a4a, 0x5a5a5a, 0x6a6a6a, 0x7a7a7a]);
  for (let k = 0; k < 16; k++) { const x = t.ri(16), y = t.ri(16); t.set(x, y, 0, 0); t.set(x + 1, y + 1, 0, 0); }
});

def('cactus_side', (t) => {
  const pal = [0x0d6419, 0x10711e, 0x137c23, 0x168628];
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
    let c = pick(pal, t.r());
    if (x === 0 || x === 15) c = 0x0a4f13;
    else if (x % 4 === 2) c = 0x2e9c3c;
    t.set(x, y, c);
  }
  for (let k = 0; k < 9; k++) {
    const x = [2, 6, 10, 14][t.ri(4)], y = t.ri(16);
    t.set(x, y, 0xd9d9a6); t.set(x + 1, y, 0x1c1c10);
  }
});
def('cactus_top', (t) => {
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
    const d = Math.max(Math.abs(x - 7.5), Math.abs(y - 7.5));
    t.set(x, y, d > 6.5 ? 0x0a4f13 : d > 5.5 ? 0x137c23 : pick([0x2e9c3c, 0x3aa848, 0x46b554], t.r()));
  }
  t.set(7, 7, 0xd9d9a6); t.set(4, 10, 0xd9d9a6); t.set(11, 5, 0xd9d9a6);
});
def('cactus_bottom', (t) => {
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
    const d = Math.max(Math.abs(x - 7.5), Math.abs(y - 7.5));
    t.set(x, y, d > 6.5 ? 0x0a4f13 : pick([0x8fb05a, 0x9dbd66, 0xaac872], t.r()));
  }
});

// ---------------------------------------------------------------- plants (cutout sprites)
def('tall_grass', (t) => {
  t.clear();
  for (let b = 0; b < 9; b++) {
    const x0 = 1 + t.ri(14), h = 5 + t.ri(10), lean = (t.r() - 0.5) * 0.5;
    for (let i = 0; i < h; i++) {
      const x = Math.round(x0 + lean * i), y = 15 - i;
      t.set(x, y, pick(GRASS_GRAY, 0.3 + (i / h) * 0.7));
    }
  }
});
function stem(t, x, top) {
  for (let y = top; y < 16; y++) t.set(x, y, y % 3 === 0 ? 0x2f6e22 : 0x3b8a2c);
  t.set(x - 1, 12, 0x3b8a2c); t.set(x - 2, 11, 0x46a035); t.set(x + 1, 13, 0x3b8a2c); t.set(x + 2, 12, 0x46a035);
}
def('dandelion', (t) => {
  t.clear(); stem(t, 8, 8);
  const pal = [0xd9b400, 0xf2d60c, 0xffe94d];
  for (let y = 4; y < 8; y++) for (let x = 6; x < 11; x++) {
    if ((y === 4 || y === 7) && (x === 6 || x === 10)) continue;
    t.set(x, y, pick(pal, t.r()));
  }
  t.set(8, 5, 0xfff6a8);
});
def('poppy', (t) => {
  t.clear(); stem(t, 8, 8);
  const pal = [0xa3140f, 0xcf1f18, 0xef3a2a];
  for (let y = 3; y < 8; y++) for (let x = 6; x < 11; x++) {
    if ((y === 3 || y === 7) && (x === 6 || x === 10)) continue;
    t.set(x, y, pick(pal, t.r()));
  }
  t.set(8, 5, 0x2a160c); t.set(7, 5, 0x3b1c10);
});
def('cornflower', (t) => {
  t.clear(); stem(t, 8, 8);
  const pal = [0x3a54c0, 0x4c68dc, 0x6c88f2];
  for (let y = 3; y < 8; y++) for (let x = 6; x < 11; x++) {
    if ((x + y) % 2 === 0 && (y === 3 || y === 7 || x === 6 || x === 10)) continue;
    t.set(x, y, pick(pal, t.r()));
  }
  t.set(8, 5, 0x9fb4ff);
});
def('dead_bush', (t) => {
  t.clear();
  const c = [0x6b4520, 0x8a5a2b, 0xa57137];
  t.line(8, 15, 8, 9, c[0]); t.line(8, 11, 4, 6, c[1]); t.line(8, 10, 12, 5, c[1]);
  t.line(5, 7, 3, 7, c[2]); t.line(11, 6, 13, 3, c[2]); t.line(8, 9, 7, 4, c[1]); t.line(6, 9, 3, 11, c[2]);
});
def('sugar_cane', (t) => {
  t.clear();
  for (const x0 of [3, 8, 12]) {
    for (let y = 0; y < 16; y++) {
      const seg = (y + x0) % 5 === 0;
      t.set(x0, y, seg ? 0x6a9c45 : 0x8cc35d); t.set(x0 + 1, y, seg ? 0x5a8a3a : 0x7bb04f);
    }
    t.set(x0 - 1, (x0 * 3) % 16, 0x9fd06a); t.set(x0 + 2, (x0 * 5 + 7) % 16, 0x9fd06a);
  }
});
def('red_mushroom', (t) => {
  t.clear();
  for (let y = 9; y < 15; y++) { t.set(7, y, 0xe8dcc4); t.set(8, y, 0xd4c6aa); }
  for (let y = 4; y < 9; y++) for (let x = 4; x < 12; x++) {
    if (y === 4 && (x < 6 || x > 9)) continue;
    t.set(x, y, y === 8 ? 0xa0180f : 0xd6291d);
  }
  t.set(6, 5, 0xf5f0e6); t.set(9, 6, 0xf5f0e6); t.set(5, 7, 0xf5f0e6); t.set(10, 7, 0xf5f0e6);
});
def('brown_mushroom', (t) => {
  t.clear();
  for (let y = 9; y < 15; y++) { t.set(7, y, 0xd8ccb2); t.set(8, y, 0xc4b69a); }
  for (let y = 6; y < 9; y++) for (let x = 4; x < 12; x++) {
    if (y === 6 && (x < 5 || x > 10)) continue;
    t.set(x, y, pick([0x8a6446, 0x9a7352, 0xa98262], t.r()));
  }
});
def('torch', (t) => {
  t.clear();
  for (let y = 6; y < 16; y++) { t.set(7, y, 0x8a6a3a); t.set(8, y, 0x6b5029); }
  t.set(7, 6, 0xff9a22); t.set(8, 6, 0xf07818);
  t.set(7, 5, 0xffd24a); t.set(8, 5, 0xffc23a);
  t.set(7, 4, 0xfff3b0); t.set(8, 4, 0xffe27a);
});

// ---------------------------------------------------------------- built blocks
def('cobblestone', (t) => {
  const pal = [0x6c6c6c, 0x7a7a7a, 0x878787, 0x969696];
  const c = cells(t, 11);
  const tone = c.pts.map(() => pick(pal, t.r()));
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
    const i = y * 16 + x;
    if (c.edge[i] < 0.9) { t.set(x, y, t.r() < 0.5 ? 0x4b4b4b : 0x555555); continue; }
    const rx = c.rel[i * 2], ry = c.rel[i * 2 + 1];
    let col = tone[c.id[i]];
    if (rx + ry < -2.2) col = lighten(col, 0.18);
    else if (rx + ry > 2.4) col = shade(col, 0.82);
    t.set(x, y, t.r() < 0.15 ? shade(col, 0.92) : col);
  }
});
def('mossy_cobblestone', (t) => {
  const pal = [0x6c6c6c, 0x7a7a7a, 0x878787, 0x969696];
  const c = cells(t, 11);
  const tone = c.pts.map(() => pick(pal, t.r()));
  const moss = t.noise(4);
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
    const i = y * 16 + x;
    let col = c.edge[i] < 0.9 ? 0x4f4f4f : tone[c.id[i]];
    if (c.edge[i] >= 0.9 && c.rel[i * 2] + c.rel[i * 2 + 1] < -2.2) col = lighten(col, 0.18);
    if (moss[i] + t.r() * 0.25 > 0.72) col = pick([0x4a6b2a, 0x587d32, 0x67903b], t.r());
    t.set(x, y, col);
  }
});
def('bricks', (t) => {
  const pal = [0x8a3f30, 0x964835, 0xa2523c, 0xad5d45];
  for (let row = 0; row < 4; row++) {
    const off = row % 2 ? 4 : 0;
    const tones = [pick(pal, t.r()), pick(pal, t.r()), pick(pal, t.r())];
    for (let y = row * 4; y < row * 4 + 4; y++) for (let x = 0; x < 16; x++) {
      const bx = (x - off + 16) % 16;
      if (y === row * 4 + 3 || bx === 0 || bx === 8) { t.set(x, y, t.r() < 0.5 ? 0xb1aaa1 : 0x9f988f); continue; }
      const tone = tones[Math.floor(((x - off + 16) % 16) / 8)];
      t.set(x, y, t.r() < 0.2 ? shade(tone, 0.9) : y === row * 4 ? lighten(tone, 0.1) : tone);
    }
  }
});
def('stone_bricks', (t) => {
  const pal = [0x777777, 0x7f7f7f, 0x878787];
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
    const row = y < 8 ? 0 : 1, yy = y % 8;
    const bx = row ? (x + 8) % 16 : x;
    if (yy === 7 || bx === 15) { t.set(x, y, 0x575757); continue; }
    let c = pick(pal, t.r());
    if (yy === 0 || bx === 0) c = 0x9a9a9a;
    else if (yy === 6 || bx === 14) c = 0x676767;
    t.set(x, y, c);
  }
});
def('sandstone_top', (t) => {
  const pal = [0xd8cb94, 0xdcd09a, 0xe1d5a1];
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) t.set(x, y, pick(pal, t.r()));
});
def('sandstone_side', (t) => {
  const pal = [0xd4c690, 0xdacc97, 0xe0d39e];
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
    let c = pick(pal, t.r());
    if (y === 3) c = 0xc2b27c;
    else if (y < 3) c = lighten(c, 0.06);
    else if (y > 11) c = t.r() < 0.4 ? 0xc7b882 : c;
    if (y === 8 && t.r() < 0.5) c = 0xcbbc86;
    t.set(x, y, c);
  }
});
def('sandstone_bottom', (t) => {
  const pal = [0xc9ba84, 0xd3c58e, 0xdacc97];
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) t.set(x, y, pick(pal, t.r()));
});
def('glass', (t) => {
  t.clear();
  for (let i = 0; i < 16; i++) {
    t.set(i, 0, 0xd8eef3); t.set(i, 15, 0xa9cad2); t.set(0, i, 0xd8eef3); t.set(15, i, 0xa9cad2);
  }
  t.set(3, 5, 0xffffff); t.set(4, 4, 0xffffff); t.set(5, 3, 0xffffff);
  t.set(4, 6, 0xffffff); t.set(9, 11, 0xffffff); t.set(10, 10, 0xffffff);
});
def('bookshelf', (t) => {
  const w = WOODS.oak;
  drawPlanks(t, w);
  const books = [0x7a2a1d, 0x2c4f86, 0x3c6b2d, 0x8a6a1f, 0x5a2d6e, 0x9a3a2a, 0x2f6f6f];
  for (const [y0, y1] of [[1, 7], [9, 15]]) {
    for (let y = y0; y < y1; y++) for (let x = 1; x < 15; x++) t.set(x, y, 0x2b1f12);
    let x = 1;
    while (x < 15) {
      const bw = 1 + (t.r() < 0.4 ? 1 : 0), col = books[t.ri(books.length)], top = y0 + t.ri(2);
      for (let i = 0; i < bw && x < 15; i++, x++) {
        for (let y = top; y < y1; y++) t.set(x, y, y === top + 1 ? lighten(col, 0.3) : i === bw - 1 && bw > 1 ? shade(col, 0.8) : col);
      }
      if (t.r() < 0.25) x++;
    }
  }
});
def('crafting_table_top', (t) => {
  drawPlanks(t, WOODS.oak);
  for (let i = 0; i < 16; i++) { t.set(i, 0, 0x5a4020); t.set(i, 15, 0x5a4020); t.set(0, i, 0x5a4020); t.set(15, i, 0x5a4020); }
  for (let i = 2; i < 14; i++) { t.set(i, 5, 0x6c512c); t.set(i, 10, 0x6c512c); t.set(5, i, 0x6c512c); t.set(10, i, 0x6c512c); }
});
function tableSide(t, front) {
  drawPlanks(t, WOODS.oak);
  for (let x = 0; x < 16; x++) { t.set(x, 0, 0x5a4020); t.set(x, 1, 0x7d5f35); t.set(x, 2, 0x5a4020); }
  if (front) {
    // saw
    for (let x = 3; x < 12; x++) t.set(x, 7, 0xb8b8b8);
    for (let x = 3; x < 12; x += 2) t.set(x, 8, 0x8a8a8a);
    t.set(12, 6, 0x5a3a1a); t.set(12, 7, 0x5a3a1a); t.set(13, 7, 0x5a3a1a); t.set(12, 8, 0x5a3a1a);
  } else {
    // hammer
    for (let y = 6; y < 13; y++) t.set(9, y, 0x6b4a22);
    for (let x = 6; x < 12; x++) { t.set(x, 5, 0x8f8f8f); t.set(x, 6, 0x6f6f6f); }
    t.set(4, 9, 0x6f6f6f); t.set(4, 10, 0x6f6f6f); t.set(5, 11, 0x8f8f8f);
  }
}
def('crafting_table_side', (t) => tableSide(t, false));
def('crafting_table_front', (t) => tableSide(t, true));
function smoothStone(t) {
  const pal = [0x707070, 0x777777, 0x7e7e7e];
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
    let c = pick(pal, t.r());
    if (x === 0 || y === 0) c = 0x8e8e8e;
    if (x === 15 || y === 15) c = 0x5c5c5c;
    t.set(x, y, c);
  }
}
def('furnace_side', smoothStone);
def('furnace_top', smoothStone);
def('furnace_front', (t) => {
  smoothStone(t);
  for (let x = 3; x < 13; x++) { t.set(x, 3, 0x5c5c5c); t.set(x, 4, 0x8e8e8e); }
  for (let y = 8; y < 14; y++) for (let x = 4; x < 12; x++) t.set(x, y, y === 13 ? 0x3d3d3d : 0x1b1b1b);
  for (let x = 4; x < 12; x++) t.set(x, 7, 0x5c5c5c);
});
def('tnt_side', (t) => {
  const FONT = { T: ['###', '.#.', '.#.', '.#.', '.#.'], N: ['#.#', '###', '###', '#.#', '#.#'] };
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
    let c = x % 4 === 3 ? 0xa8241a : pick([0xcf3522, 0xdb3d27, 0xe2452d], t.r());
    if (y >= 5 && y <= 10) c = y === 5 || y === 10 ? 0xc9c9c9 : pick([0xeaeaea, 0xf3f3f3], t.r());
    t.set(x, y, c);
  }
  let x0 = 2;
  for (const ch of 'TNT') {
    FONT[ch].forEach((row, ry) => [...row].forEach((p, rx) => { if (p === '#') t.set(x0 + rx, 6 + ry - (ry > 3 ? 1 : 0), 0x1a1a1a); }));
    x0 += 4;
  }
});
def('tnt_top', (t) => {
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) t.set(x, y, pick([0xb52c1c, 0xc83522, 0xd23c27], t.r()));
  for (let y = 6; y < 10; y++) for (let x = 6; x < 10; x++) t.set(x, y, 0x3a3a3a);
  t.set(7, 7, 0x9a9a9a); t.set(8, 8, 0x6a6a6a);
});
def('tnt_bottom', (t) => {
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) t.set(x, y, pick([0x9a2418, 0xa82a1d, 0xb33021], t.r()));
});
function wool(color) {
  return (t) => {
    const n = t.noise(2);
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
      const v = 0.8 + n[y * 16 + x] * 0.12 + ((x + y) % 3 === 0 ? -0.06 : 0) + t.r() * 0.06;
      t.set(x, y, shade(color, v));
    }
  };
}
export const WOOL_COLORS = {
  white: 0xf2f2f2, red: 0xb3312c, orange: 0xeb8844, yellow: 0xdecf2a,
  lime: 0x41cd34, blue: 0x3b56c7, purple: 0x8a3fc4, black: 0x2a2a2e,
};
for (const [name, c] of Object.entries(WOOL_COLORS)) def(`${name}_wool`, wool(c));

function pumpkinSide(t) {
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
    let c = pick([0xc8741a, 0xd4801e, 0xde8c26], t.r());
    if (x % 5 === 0) c = 0xa85e12;
    if (y === 0 || y === 15) c = shade(c, 0.85);
    t.set(x, y, c);
  }
}
def('pumpkin_side', pumpkinSide);
def('pumpkin_top', (t) => {
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
    const d = Math.max(Math.abs(x - 7.5), Math.abs(y - 7.5));
    t.set(x, y, Math.floor(d) % 3 === 0 ? 0xb8661a : pick([0xcf7a1e, 0xda8626], t.r()));
  }
  for (let y = 6; y < 10; y++) for (let x = 7; x < 9; x++) t.set(x, y, 0x6b5a20);
});
function face(t, fill) {
  pumpkinSide(t);
  const pts = [[3, 5], [4, 5], [5, 5], [4, 6], [10, 5], [11, 5], [12, 5], [11, 6]];
  for (const [x, y] of pts) t.set(x, y, fill);
  for (let x = 3; x < 13; x++) t.set(x, 10, fill);
  for (let x = 4; x < 12; x++) if (x !== 6 && x !== 9) t.set(x, 11, fill);
  t.set(5, 9, fill); t.set(10, 9, fill);
}
def('pumpkin_face', (t) => face(t, 0x2a1805));
def('jack_face', (t) => face(t, 0xffd23a));

function metalBlock(pal, edgeLight, edgeDark) {
  return (t) => {
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
      let c = pick(pal, t.r());
      if (x === 0 || y === 0) c = edgeLight;
      if (x === 15 || y === 15) c = edgeDark;
      if ((x === 2 || y === 2) && x > 1 && y > 1 && x < 14 && y < 14) c = lighten(c, 0.15);
      t.set(x, y, c);
    }
  };
}
def('gold_block', metalBlock([0xf5c93a, 0xfad44a, 0xfcdc5e], 0xfff3a8, 0xc9921c));
def('iron_block', metalBlock([0xd8d8d8, 0xdedede, 0xe6e6e6], 0xffffff, 0xa6a6a6));
def('diamond_block', metalBlock([0x5fe0e6, 0x6ae8ee, 0x7df0f5], 0xd2fdff, 0x2aa6ad));
def('coal_block', metalBlock([0x1a1a1a, 0x202020, 0x262626], 0x3a3a3a, 0x0e0e0e));

// ---------------------------------------------------------------- breaking overlay
const crackSegments = (() => {
  const t = new Tex('cracks');
  const segs = [];
  for (let s = 0; s < 10; s++) {
    let x = 7 + t.ri(3) - 1, y = 7 + t.ri(3) - 1;
    const dir = t.r() * Math.PI * 2;
    const len = 3 + t.ri(5);
    const pts = [];
    for (let i = 0; i < len; i++) {
      const a = dir + (t.r() - 0.5) * 1.4;
      x += Math.round(Math.cos(a)); y += Math.round(Math.sin(a));
      pts.push([x & 15, y & 15]);
    }
    segs.push(pts);
  }
  return segs;
})();
for (let stage = 0; stage < 10; stage++) {
  def(`destroy_${stage}`, (t) => {
    t.clear();
    for (let s = 0; s <= stage; s++) for (const [x, y] of crackSegments[s]) t.set(x, y, 0x101010, 200);
  });
}

// ---------------------------------------------------------------- items
function stick(t, x0 = 2, y0 = 13, len = 9) {
  for (let i = 0; i < len; i++) { t.set(x0 + i, y0 - i, 0x8a6a3a); t.set(x0 + i + 1, y0 - i, 0x5a4020); }
}
def('stick', (t) => { t.clear(); stick(t, 3, 12, 9); });
def('coal', (t) => {
  t.clear();
  const pal = [0x141414, 0x222222, 0x303030, 0x464646];
  for (let y = 4; y < 13; y++) for (let x = 3; x < 13; x++) {
    const d = Math.hypot(x - 7.5, (y - 8.5) * 1.15);
    if (d < 4.6 + t.r() * 0.6) t.set(x, y, pick(pal, 1 - d / 6 + t.r() * 0.2));
  }
});
function ingot(t, pal) {
  t.clear();
  for (let y = 6; y < 12; y++) {
    const inset = Math.max(0, 7 - y + 1);
    for (let x = 2 + inset; x < 14 - Math.max(0, y - 10); x++) {
      let c = pal[1];
      if (y === 6) c = pal[2];
      if (y === 11 || x === 13 - Math.max(0, y - 10)) c = pal[0];
      t.set(x, y, c);
    }
  }
  t.set(5, 7, 0xffffff);
}
def('iron_ingot', (t) => ingot(t, [0x8e8e8e, 0xd4d4d4, 0xf2f2f2]));
def('gold_ingot', (t) => ingot(t, [0xc48a18, 0xf5cc3c, 0xfff0a0]));
def('diamond', (t) => {
  t.clear();
  const rows = [[6, 9], [4, 11], [3, 12], [4, 11], [5, 10], [6, 9], [7, 8]];
  rows.forEach(([a, b], i) => {
    for (let x = a; x <= b; x++) t.set(x, 4 + i, i === 0 ? 0xc8fcff : x === a ? 0x8af0f4 : x === b ? 0x20a7b0 : 0x4fdce4);
  });
  t.set(6, 6, 0xffffff); t.set(7, 5, 0xffffff);
});
def('flint', (t) => {
  t.clear();
  const rows = [[7, 8], [6, 9], [5, 10], [5, 10], [4, 10], [5, 9], [6, 8]];
  rows.forEach(([a, b], i) => { for (let x = a; x <= b; x++) t.set(x, 4 + i, x === a ? 0x6a6a6a : x === b ? 0x222222 : 0x3c3c3c); });
});
def('apple', (t) => {
  t.clear();
  for (let y = 5; y < 14; y++) for (let x = 3; x < 13; x++) {
    const d = Math.hypot(x - 7.5, y - 9.2);
    if (d < 4.6) t.set(x, y, d < 2 && x < 8 && y < 9 ? 0xff6a5a : pick([0xb81d15, 0xd12a1f, 0xe63a2b], t.r()));
  }
  t.set(8, 3, 0x5a3a1a); t.set(8, 4, 0x5a3a1a); t.set(9, 3, 0x3f8f2f); t.set(10, 2, 0x3f8f2f);
});
function meat(t, pal) {
  t.clear();
  for (let y = 4; y < 13; y++) for (let x = 2; x < 14; x++) {
    const d = Math.hypot((x - 7.5) / 1.3, y - 8.5);
    if (d < 4.2) t.set(x, y, d > 3.4 ? pal[2] : pick(pal.slice(0, 2), t.r()));
  }
  t.set(12, 12, 0xf2eadc); t.set(13, 13, 0xf2eadc);
}
def('raw_porkchop', (t) => meat(t, [0xf0a3a0, 0xe68884, 0xf7d9d4]));
def('cooked_porkchop', (t) => meat(t, [0xa8683a, 0x93572c, 0xd8b58a]));

const TOOL_MATS = {
  wooden: [0x6b5029, 0x9f804b, 0xc4a36a],
  stone: [0x5a5a5a, 0x8a8a8a, 0xb0b0b0],
  iron: [0x8a8a8a, 0xd6d6d6, 0xffffff],
  diamond: [0x1f9aa3, 0x4fdce4, 0xc8fcff],
};
function drawPickaxe(t, m) {
  t.clear(); stick(t, 2, 13, 9);
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
    const d = Math.hypot(x - 3, y - 12);
    const a = Math.atan2(12 - y, x - 3);
    if (a < 0.05 || a > Math.PI / 2 - 0.05) continue;
    if (d > 8.2 && d < 10.6) t.set(x, y, d > 9.8 ? m[2] : d < 9 ? m[0] : m[1]);
  }
}
function drawAxe(t, m) {
  t.clear(); stick(t, 2, 13, 10);
  // The handle runs along x + y = 15; the head sits on its upper-left side and widens outwards.
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
    const along = x - y, across = 15 - (x + y);
    if (across < 1 || across > 6.5) continue;
    if (along < 1.6 - across * 0.35 || along > 5.4 + across * 0.35) continue;
    t.set(x, y, across > 5.4 ? m[2] : across < 2 ? m[0] : m[1]);
  }
}
function drawShovel(t, m) {
  t.clear(); stick(t, 2, 13, 7);
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
    const along = (x - y - 8.6) / 4.2, across = (x + y - 15) / 3.1;
    const d = along * along + across * across;
    if (d < 1) t.set(x, y, across < -0.45 ? m[2] : across > 0.45 ? m[0] : m[1]);
  }
}
function drawSword(t, m) {
  t.clear();
  for (let i = 0; i < 10; i++) {
    t.set(5 + i, 10 - i, m[1]); t.set(6 + i, 10 - i, m[0]); t.set(5 + i, 9 - i, m[2]);
  }
  t.set(15, 0, 0, 0);
  for (let i = 0; i < 5; i++) t.set(2 + i, 8 + i, 0x5a4020);
  t.line(2, 13, 4, 11, 0x8a6a3a); t.set(1, 14, 0x5a4020);
}
for (const [mat, pal] of Object.entries(TOOL_MATS)) {
  def(`${mat}_pickaxe`, (t) => drawPickaxe(t, pal));
  def(`${mat}_axe`, (t) => drawAxe(t, pal));
  def(`${mat}_shovel`, (t) => drawShovel(t, pal));
  def(`${mat}_sword`, (t) => drawSword(t, pal));
}
def('flint_and_steel', (t) => {
  t.clear();
  const ring = [[4, 4], [5, 3], [6, 3], [7, 3], [8, 4], [8, 5], [3, 5], [3, 6], [3, 7], [4, 8], [5, 8]];
  for (const [x, y] of ring) t.set(x, y, 0x9a9a9a);
  t.set(5, 4, 0xd8d8d8); t.set(4, 5, 0xd8d8d8);
  const rows = [[10, 11], [9, 12], [9, 12], [8, 12], [9, 11]];
  rows.forEach(([a, b], i) => { for (let x = a; x <= b; x++) t.set(x, 8 + i, x === a ? 0x5a5a5a : 0x2e2e2e); });
});

// ---------------------------------------------------------------- doors, ladders, panes
function doorHalf(t, top) {
  const w = WOODS.oak;
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
    let c = pick(w.planks, t.r());
    if (x === 0 || x === 15 || (top ? y === 0 : y === 15)) c = w.seam;
    else if (x === 1 || x === 14) c = shade(pick(w.planks, t.r()), 0.9);
    else if (t.r() < 0.1) c = w.grain;
    t.set(x, y, c);
  }
  if (top) {
    // two small windows
    for (let y = 3; y < 8; y++) for (let x = 3; x < 13; x++) {
      if (x === 7 || x === 8) continue;
      t.set(x, y, 0, 0);
    }
    for (let x = 2; x < 14; x++) { t.set(x, 2, w.seam); t.set(x, 8, w.seam); }
    for (let y = 2; y < 9; y++) { t.set(2, y, w.seam); t.set(13, y, w.seam); t.set(7, y, w.seam); t.set(8, y, w.seam); }
    for (let x = 3; x < 13; x++) t.set(x, 12, w.seam);
  } else {
    for (let x = 3; x < 13; x++) { t.set(x, 3, w.seam); t.set(x, 10, w.seam); }
    for (let y = 3; y < 11; y++) { t.set(3, y, w.seam); t.set(12, y, w.seam); }
    t.set(12, 1, 0x3a3a3a); t.set(13, 1, 0x6a6a6a); t.set(12, 0, 0x6a6a6a);
  }
}
def('oak_door_top', (t) => doorHalf(t, true));
def('oak_door_bottom', (t) => doorHalf(t, false));
def('ladder', (t) => {
  t.clear();
  const w = WOODS.oak;
  for (let y = 0; y < 16; y++) {
    for (const x of [2, 3, 12, 13]) t.set(x, y, x === 2 || x === 12 ? w.seam : w.planks[t.ri(w.planks.length)]);
  }
  for (const y of [2, 6, 10, 14]) for (let x = 4; x < 12; x++) t.set(x, y, y % 4 === 2 && x % 3 === 0 ? w.grain : w.planks[t.ri(w.planks.length)]);
  for (const y of [3, 7, 11, 15]) for (let x = 4; x < 12; x++) t.set(x, y, w.seam);
});
def('oak_door_item', (t) => {
  t.clear();
  const w = WOODS.oak;
  for (let y = 1; y < 16; y++) for (let x = 4; x < 12; x++) {
    let c = pick(w.planks, t.r());
    if (x === 4 || x === 11 || y === 1 || y === 15) c = w.seam;
    if (y >= 3 && y <= 6 && x >= 6 && x <= 9 && x !== 7 && x !== 8) c = 0xbcd6de;
    if (y === 9 && x === 10) c = 0x3a3a3a;
    t.set(x, y, c);
  }
});
def('glass_pane_top', (t) => {
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) t.set(x, y, x === 7 || x === 8 ? 0xd8eef3 : 0xa9cad2);
});

// ---------------------------------------------------------------- chests and beds
const CHEST = { planks: [0x8f6a38, 0x9a7440, 0xa37c46], dark: 0x4f3818, band: 0x5c4220 };
function chestBody(t) {
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
    let c = pick(CHEST.planks, t.r());
    if (t.r() < 0.12) c = shade(c, 0.88);
    if (x <= 1 || x >= 14 || y <= 2 || y === 15) c = CHEST.dark;
    if (y === 7 || y === 8) c = CHEST.band;
    t.set(x, y, c);
  }
}
def('chest_side', chestBody);
def('chest_front', (t) => {
  chestBody(t);
  for (let y = 6; y < 10; y++) for (let x = 7; x < 9; x++) t.set(x, y, y === 6 ? 0xd8d8d8 : 0xa9a9a9);
  t.set(7, 9, 0x6a6a6a); t.set(8, 9, 0x6a6a6a);
});
def('chest_top', (t) => {
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
    let c = pick(CHEST.planks, t.r());
    if (x <= 1 || x >= 14 || y <= 1 || y >= 14) c = CHEST.dark;
    t.set(x, y, c);
  }
});
const BED_RED = [0x9c1f1a, 0xab2620, 0xb52d26];
// The pillow sits at the head end of the bed, so there is one top texture per direction
// (n = -Z, s = +Z, e = +X, w = -X edge of the top face).
for (const [name, side] of [['bed_head', 'n'], ['bed_head_s', 's'], ['bed_head_e', 'e'], ['bed_head_w', 'w']]) {
  def(name, (t) => {
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
      const along = side === 'n' ? y : side === 's' ? 15 - y : side === 'e' ? 15 - x : x;
      const across = side === 'n' || side === 's' ? x : y;
      let c = pick(BED_RED, t.r());
      if (along < 7 && across > 1 && across < 14) c = pick([0xe8e8e2, 0xf2f2ec, 0xdcdcd6], t.r());
      if (along === 7) c = 0x7a1612;
      t.set(x, y, c);
    }
  });
}
def('bed_foot', (t) => {
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) t.set(x, y, pick(BED_RED, t.r()));
});
def('bed_side', (t) => {
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
    let c = y < 7 ? 0 : y < 11 ? pick(BED_RED, t.r()) : y < 13 ? pick([0xe8e8e2, 0xdcdcd6], t.r()) : pick(WOODS.oak.planks, t.r());
    if (y >= 13 && x > 2 && x < 13) c = 0;
    t.set(x, y, c, c === 0 ? 0 : 255);
  }
});
def('bed_item', (t) => {
  t.clear();
  for (let y = 5; y < 12; y++) for (let x = 1; x < 15; x++) {
    let c = pick(BED_RED, t.r());
    if (x < 5 && y < 9) c = 0xeeeeea;
    if (y >= 10) c = pick(WOODS.oak.planks, t.r());
    t.set(x, y, c);
  }
  for (const x of [1, 2, 13, 14]) { t.set(x, 12, WOODS.oak.seam); t.set(x, 13, WOODS.oak.seam); }
});

// ---------------------------------------------------------------- player hand
def('player_skin', (t) => {
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) t.set(x, y, pick([0xc68e6a, 0xcf9874, 0xd6a07c], t.r()));
});
def('player_sleeve', (t) => {
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) t.set(x, y, pick([0x2f7d8c, 0x348a9a, 0x3a96a6], t.r()));
});

// ---------------------------------------------------------------- mobs
function furry(t, pal, cell = 2) {
  const n = t.noise(cell);
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) t.set(x, y, pick(pal, n[y * 16 + x] * 0.5 + t.r() * 0.5));
}
function eyes(t, y, white, pupil, gap = 4) {
  const l = 8 - gap / 2 - 2, r = 8 + gap / 2;
  t.set(l, y, white); t.set(l + 1, y, pupil); t.set(r, y, pupil); t.set(r + 1, y, white);
}
const PIG = [0xe9918c, 0xf0a19b, 0xf5aea8, 0xeb9a95];
def('pig_skin', (t) => furry(t, PIG, 4));
def('pig_face', (t) => {
  furry(t, PIG, 4);
  eyes(t, 5, 0xffffff, 0x1a1a1a, 6);
  for (let y = 9; y < 13; y++) for (let x = 5; x < 11; x++) t.set(x, y, y === 9 || y === 12 ? 0xd9807a : 0xf2b8b2);
  t.set(6, 10, 0x8a4a46); t.set(9, 10, 0x8a4a46); t.set(6, 11, 0x8a4a46); t.set(9, 11, 0x8a4a46);
});
const WOOL = [0xdedbd4, 0xe8e6e0, 0xf2f0eb, 0xfaf9f6];
def('sheep_wool', (t) => furry(t, WOOL, 2));
def('sheep_face', (t) => {
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) t.set(x, y, y < 3 ? pick(WOOL, t.r()) : pick([0xcbb49c, 0xd4bea6, 0xc2aa90], t.r()));
  eyes(t, 7, 0xffffff, 0x1a1a1a, 6);
  for (let x = 6; x < 10; x++) t.set(x, 11, 0xe6a0a0);
  t.set(7, 12, 0x6b4a3a); t.set(8, 12, 0x6b4a3a);
});
const ZOMBIE = [0x3f6b32, 0x4a7a3a, 0x548744, 0x5e924c];
def('zombie_skin', (t) => furry(t, ZOMBIE, 4));
def('zombie_face', (t) => {
  furry(t, ZOMBIE, 4);
  for (const x of [4, 5, 10, 11]) { t.set(x, 7, 0x0e1a0c); t.set(x, 8, 0x1e3a18); }
  for (let x = 6; x < 10; x++) t.set(x, 11, 0x24391e);
  t.set(7, 10, 0x2d4a25);
});
def('zombie_shirt', (t) => furry(t, [0x2a7f86, 0x2f8b92, 0x35979e, 0x2a767c], 4));
def('zombie_pants', (t) => furry(t, [0x353a86, 0x3d4292, 0x454a9c, 0x30357a], 4));

// ---------------------------------------------------------------- export
export const TEXTURE_NAMES = defs.map((d) => d.name);
export const TEX = Object.fromEntries(TEXTURE_NAMES.map((n, i) => [n, i]));
if (TEXTURE_NAMES.length > 255) throw new Error('Too many texture layers');

// Returns RGBA pixels for all layers (16*16*4 bytes per layer). Transparent pixels get the
// average opaque colour so mipmaps don't pick up dark fringes.
export function generateTextures() {
  const out = new Uint8Array(defs.length * 1024);
  defs.forEach((d, layer) => {
    const t = new Tex(d.name);
    d.draw(t);
    let r = 0, g = 0, b = 0, n = 0;
    for (let i = 0; i < 1024; i += 4) {
      if (t.d[i + 3] > 0) { r += t.d[i]; g += t.d[i + 1]; b += t.d[i + 2]; n++; }
    }
    if (n) {
      r /= n; g /= n; b /= n;
      for (let i = 0; i < 1024; i += 4) {
        if (t.d[i + 3] === 0) { t.d[i] = r; t.d[i + 1] = g; t.d[i + 2] = b; }
      }
    }
    out.set(t.d, layer * 1024);
  });
  return out;
}
