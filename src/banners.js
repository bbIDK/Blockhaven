// Banners: a cloth of one of the sixteen dye colours with up to six patterns laid over it (at a
// loom), standing on a pole or hung from a wall. What's on each banner in the world is kept for its
// place, as signs keep their writing, and each is drawn from that: its picture is put together in a
// spare layer of the creature-skin texture (see Renderer.bannerLayer), laid out as Minecraft lays out
// its banner model (so Pixel Perfection's banner pictures fit it), and drawn on that model, the cloth
// stirring a little in the breeze. A banner item carries its patterns in `bp` (see inventory.js).
import { DYES } from './colors.js';
import { BANNER } from './blocks.js';
import { BANNER_PACK } from './tex/packdata.js';
import { SKIN_SIZE, unpackSkin } from './skins.js';
import { boxMesh, MODEL_OFFSET } from './models.js';
import { identity, translate, rotateX, rotateY } from './math.js';

export const BANNER_SLOTS = 32;
export const MAX_PATTERNS = 6;

// The patterns, in the loom's order: Minecraft's names for them (and the pack's pictures') and what
// they're called. The last few can only be put on with their pattern item in the loom.
export const PATTERNS = [
  ['stripe_bottom', 'Base'], ['stripe_top', 'Chief'], ['stripe_left', 'Pale Dexter'], ['stripe_right', 'Pale Sinister'],
  ['stripe_center', 'Pale'], ['stripe_middle', 'Fess'], ['stripe_downright', 'Bend'], ['stripe_downleft', 'Bend Sinister'],
  ['small_stripes', 'Paly'], ['cross', 'Saltire'], ['straight_cross', 'Cross'], ['triangle_bottom', 'Chevron'],
  ['triangle_top', 'Inverted Chevron'], ['triangles_bottom', 'Base Indented'], ['triangles_top', 'Chief Indented'],
  ['diagonal_left', 'Per Bend Sinister'], ['diagonal_right', 'Per Bend'], ['diagonal_up_left', 'Per Bend Inverted'],
  ['diagonal_up_right', 'Per Bend Sinister Inverted'], ['circle', 'Roundel'], ['rhombus', 'Lozenge'], ['half_vertical', 'Per Pale'],
  ['half_horizontal', 'Per Fess'], ['half_vertical_right', 'Per Pale Inverted'], ['half_horizontal_bottom', 'Per Fess Inverted'],
  ['border', 'Bordure'], ['curly_border', 'Bordure Indented'], ['gradient', 'Gradient'], ['gradient_up', 'Base Gradient'],
  ['bricks', 'Field Masoned'], ['square_bottom_left', 'Base Dexter Canton'], ['square_bottom_right', 'Base Sinister Canton'],
  ['square_top_left', 'Chief Dexter Canton'], ['square_top_right', 'Chief Sinister Canton'], ['flower', 'Flower Charge', 'flower'],
  ['globe', 'Globe', 'globe'],
].map(([name, label, item], i) => ({ name, label, i, item: item ?? null }));
export const PATTERN_INDEX = Object.fromEntries(PATTERNS.map((p) => [p.name, p.i]));

// A banner's colour and patterns ({ c, p: [[pattern, colour], ...] }), checked over (from a save, a
// stack or another player).
const dye = (c) => (Number.isInteger(c) && c >= 0 && c < 16 ? c : 0);
export function cleanPatterns(p) {
  if (!Array.isArray(p)) return [];
  return p.slice(0, MAX_PATTERNS).filter((q) => Array.isArray(q) && PATTERNS[q[0]] && Number.isInteger(q[1]) && q[1] >= 0 && q[1] < 16)
    .map((q) => [q[0], q[1]]);
}
export const cleanDesign = (d) => ({ c: dye(d?.c), p: cleanPatterns(d?.p) });
export const designKey = (d) => `${d.c}:${d.p.map((q) => q.join('.')).join(',')}`;
export const PLAIN = { c: 0, p: [] };

// ---------------------------------------------------------------- pictures
// The cloth's front is W x H pixels at (1, 1) of the model's picture; its back is beside it, at
// (22, 1); the pole's and the bar's pictures are to the right of it and below it.
export const W = 20, H = 40;
const S = SKIN_SIZE;
const lum = (d, i) => d[i] * 0.3 + d[i + 1] * 0.59 + d[i + 2] * 0.11;

// Each pattern's mask over the cloth (W x H, 0-255): the pack's picture's, or failing that its
// shape drawn here.
const SHAPES = {
  stripe_bottom: (x, y) => y >= 27, stripe_top: (x, y) => y < 13, stripe_left: (x) => x < 7, stripe_right: (x) => x >= 13,
  stripe_center: (x) => x >= 7 && x < 13, stripe_middle: (x, y) => y >= 14 && y < 26, stripe_downright: (x, y) => Math.abs(x - y / 2) < 3,
  stripe_downleft: (x, y) => Math.abs(19 - x - y / 2) < 3, small_stripes: (x) => x % 4 >= 2,
  cross: (x, y) => Math.abs(x - y / 2) < 2.5 || Math.abs(19 - x - y / 2) < 2.5, straight_cross: (x, y) => (x >= 8 && x < 12) || (y >= 17 && y < 23),
  triangle_bottom: (x, y) => y >= 30 + Math.abs(x - 9.5), triangle_top: (x, y) => y < 10 - Math.abs(x - 9.5),
  triangles_bottom: (x, y) => y >= 36 + Math.abs((x % 4) - 1.5), triangles_top: (x, y) => y < 4 - Math.abs((x % 4) - 1.5),
  diagonal_left: (x, y) => x + y / 2 < 20, diagonal_right: (x, y) => x > y / 2, diagonal_up_left: (x, y) => x < y / 2,
  diagonal_up_right: (x, y) => x + y / 2 >= 20, circle: (x, y) => (x - 9.5) ** 2 + ((y - 19.5) * 0.9) ** 2 < 26,
  rhombus: (x, y) => Math.abs(x - 9.5) / 7 + Math.abs(y - 19.5) / 13 < 1, half_vertical: (x) => x < 10, half_vertical_right: (x) => x >= 10,
  half_horizontal: (x, y) => y < 20, half_horizontal_bottom: (x, y) => y >= 20, border: (x, y) => x < 2 || x >= 18 || y < 2 || y >= 38,
  curly_border: (x, y) => x < 2 + (y % 4 < 2 ? 1 : 0) || x >= 18 - (y % 4 < 2 ? 1 : 0) || y < 2 + (x % 4 < 2 ? 1 : 0) || y >= 38 - (x % 4 < 2 ? 1 : 0),
  gradient: (x, y) => 1 - y / H, gradient_up: (x, y) => y / H, bricks: (x, y) => y % 4 === 0 || (x + (Math.floor(y / 4) % 2) * 2) % 4 === 0,
  square_bottom_left: (x, y) => x < 7 && y >= 27, square_bottom_right: (x, y) => x >= 13 && y >= 27, square_top_left: (x, y) => x < 7 && y < 13,
  square_top_right: (x, y) => x >= 13 && y < 13,
  flower: (x, y) => { const r = Math.hypot(x - 9.5, y - 19.5), a = Math.atan2(y - 19.5, x - 9.5); return r < 2.5 || (r < 7 && Math.cos(a * 6) > 0.3); },
  globe: (x, y) => { const r = Math.hypot(x - 9.5, (y - 19.5) * 0.9); return r < 7 && (r > 5.5 || Math.abs(x - 9.5) < 1 || Math.abs(y - 19.5) < 1); },
};
const masks = new Map();
export function patternMask(name) {
  let m = masks.get(name);
  if (m) return m;
  m = new Uint8Array(W * H);
  const packed = BANNER_PACK?.[name];
  if (packed) {
    const d = new Uint8ClampedArray(S * S * 4);
    unpackSkin(packed, d);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) m[y * W + x] = d[((y + 1) * S + x + 1) * 4 + 3];
  } else {
    const f = SHAPES[name] ?? (() => false);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const v = f(x, y); m[y * W + x] = Math.round(255 * Math.max(0, Math.min(1, +v))); }
  }
  masks.set(name, m);
  return m;
}

// The banner's own picture (the pole, the bar and a plain cloth with folds in it): the pack's, or
// drawn here.
let base = null;
function basePixels() {
  if (base) return base;
  base = new Uint8ClampedArray(S * S * 4);
  if (BANNER_PACK?.base) unpackSkin(BANNER_PACK.base, base);
  else {
    const put = (x, y, c) => { const i = (y * S + x) * 4; base[i] = c >> 16; base[i + 1] = (c >> 8) & 255; base[i + 2] = c & 255; base[i + 3] = 255; };
    for (let y = 0; y < 41; y++) for (let x = 0; x < 43; x++) put(x, y, (x % 5 === 2 ? 0xe0dcd4 : 0xf4f0ea));
    for (let y = 0; y < 44; y++) for (let x = 44; x < 52; x++) put(x, y, x % 2 ? 0x5a3e22 : 0x6e4e2e);
    for (let y = 42; y < 46; y++) for (let x = 0; x < 44; x++) put(x, y, y % 2 ? 0x5a3e22 : 0x6e4e2e);
  }
  return base;
}

// The cloth's front, W x H RGBA: its colour, each pattern over it in turn (by its mask), and the
// folds of the cloth showing through.
export function clothPixels(design) {
  const b = basePixels(), out = new Uint8ClampedArray(W * H * 4);
  let top = 1;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) top = Math.max(top, lum(b, ((y + 1) * S + x + 1) * 4));
  const layers = design.p.map(([p, c]) => [patternMask(PATTERNS[p].name), DYES[c].dye]);
  const bc = DYES[design.c].dye;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    let r = bc >> 16, g = (bc >> 8) & 255, bl = bc & 255;
    for (const [m, c] of layers) {
      const a = m[y * W + x] / 255;
      if (!a) continue;
      r += ((c >> 16) - r) * a; g += (((c >> 8) & 255) - g) * a; bl += ((c & 255) - bl) * a;
    }
    const k = Math.min(1, lum(b, ((y + 1) * S + x + 1) * 4) / top * 1.04), i = (y * W + x) * 4;
    out[i] = r * k; out[i + 1] = g * k; out[i + 2] = bl * k; out[i + 3] = 255;
  }
  return out;
}

// The whole picture for the model: the banner's own with its cloth (front, back mirrored, and the
// cloth's edges) replaced by this design's.
export function bannerPixels(design) {
  const out = new Uint8Array(basePixels()), cloth = clothPixels(design);
  const put = (x, y, sx, sy) => { const i = (y * S + x) * 4, j = (sy * W + sx) * 4; for (let k = 0; k < 4; k++) out[i + k] = cloth[j + k]; };
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) { put(1 + x, 1 + y, x, y); put(22 + x, 1 + y, W - 1 - x, y); }
    put(0, 1 + y, 0, y); put(21, 1 + y, W - 1, y);
  }
  for (let x = 0; x < W; x++) { put(1 + x, 0, x, 0); put(21 + x, 0, x, H - 1); }
  return out;
}

// ---------------------------------------------------------------- the model
// Minecraft's banner at two-thirds size (a pixel of its model is 1/24 of a block), standing on its
// block: a pole 1.75 blocks tall, the bar across its top, and the cloth hanging from the bar in
// front of the pole (facing +z), down to a sixth of a block off the ground. On a wall the pole isn't
// there and the rest hangs lower, against the wall (WALL_SHIFT).
const P = 1 / 24;
const box = (x0, y0, z0, x1, y1, z1, uv) => ({ from: [x0, y0, z0], to: [x1, y1, z1], uv });
// (Where each face's picture is in the layout: +x, -x, top, bottom, +z (the front), -z.)
const faces = (u, v, w, h, d) => [[u + d + w, v + d, u + 2 * d + w, v + d + h], [u, v + d, u + d, v + d + h], [u + d, v, u + d + w, v + d],
  [u + d + w, v, u + d + 2 * w, v + d], [u + d, v + d, u + d + w, v + d + h], [u + 2 * d + w, v + d, u + 2 * d + 2 * w, v + d + h]];
const POLE = box(-P, 0, -P, P, 42 * P, P, faces(44, 0, 2, 42, 2));
const BAR = box(-10 * P, 42 * P, -P, 10 * P, 44 * P, P, faces(0, 42, 20, 2, 2));
const CLOTH = box(-10 * P, 4 * P, P, 10 * P, 44 * P, 2 * P, faces(0, 0, 20, 40, 1));
const CLOTH_TOP = 44 * P;
const WALL_SHIFT = [0, -0.9792, -0.4375];
// Which way a banner faces, as a turn about the vertical: a standing one's sixteenth turns, a wall
// one's facing (away from the wall).
const WALL_TURN = { 4: 0, 1: Math.PI / 2, 5: Math.PI, 0: -Math.PI / 2 };
export const standingTurn = (rot) => -rot * Math.PI / 8;
// The sixteenth turn that faces someone looking along (dx, dz).
export const rotFacing = (dx, dz) => ((Math.round(Math.atan2(dx, -dz) * 8 / Math.PI) % 16) + 16) % 16;

// ---------------------------------------------------------------- every banner in the world
export class Banners {
  constructor(game) {
    this.game = game;
    this.designs = new Map(); // "x,y,z" -> design
    this.gone = new Map();    // designs of banners just taken down (what they drop), "x,y,z" -> design
    this.slots = new Array(BANNER_SLOTS).fill(null); // design key in each spare layer
    this.used = new Array(BANNER_SLOTS).fill(0);     // when each slot was last drawn
    this.meshes = [];        // per slot: { pole, bar, cloth }
    this.frame = 0;
  }

  static key(x, y, z) { return `${x},${y},${z}`; }
  get(x, y, z) { return this.designs.get(Banners.key(x, y, z)) ?? PLAIN; }
  // (`send`: tell the other players; not for what they told us.)
  set(x, y, z, design, send = true) {
    const d = cleanDesign(design);
    this.designs.set(Banners.key(x, y, z), d);
    if (send) this.game.net?.banner?.(x, y, z, d);
    return d;
  }
  // A banner taken down: its design is kept a moment, for what it drops.
  remove(x, y, z) {
    const key = Banners.key(x, y, z), d = this.designs.get(key);
    if (!d) return;
    this.designs.delete(key);
    this.gone.set(key, d);
    if (this.gone.size > 64) this.gone.delete(this.gone.keys().next().value);
  }
  // The design of a banner that was just taken down (once).
  takeGone(x, y, z) {
    const key = Banners.key(x, y, z), d = this.gone.get(key) ?? this.designs.get(key) ?? PLAIN;
    this.gone.delete(key);
    return d;
  }
  clear() { this.designs.clear(); this.gone.clear(); }

  serialize() { return [...this.designs].map(([k, d]) => [k, d.c, d.p]); }
  load(list) {
    this.clear();
    for (const e of Array.isArray(list) ? list : []) {
      if (!Array.isArray(e) || typeof e[0] !== 'string' || !/^-?\d+,-?\d+,-?\d+$/.test(e[0])) continue;
      this.designs.set(e[0], cleanDesign({ c: e[1], p: e[2] }));
    }
  }

  // The spare layer holding a design's picture (put there if it isn't yet, in place of the one drawn
  // longest ago).
  slotFor(design) {
    const key = designKey(design);
    let slot = this.slots.indexOf(key);
    if (slot < 0) {
      slot = this.slots.indexOf(null);
      if (slot < 0) slot = this.used.indexOf(Math.min(...this.used));
      this.slots[slot] = key;
      this.game.renderer.bannerLayer(slot, bannerPixels(design));
    }
    this.used[slot] = this.frame;
    return slot;
  }
  meshesFor(slot) {
    if (this.meshes[slot]) return this.meshes[slot];
    const r = this.game.renderer, layer = r.bannerLayerIndex(slot);
    const mesh = (parts) => r.createMesh(boxMesh(parts.map((p) => ({ from: p.from, to: p.to, faces: p.uv.map((uv) => ({ layer, uv })) }))));
    return (this.meshes[slot] = { pole: mesh([POLE, BAR]), bar: mesh([BAR]), cloth: mesh([CLOTH]) });
  }

  // Adds the banners within `range` of the camera to the renderer's list `out` (`mat()`: a matrix
  // to fill, from the frame's pool). `time`: seconds, for the cloth's stirring.
  draw(cam, range, out, mat, time) {
    const w = this.game.world, r = this.game.renderer;
    if (!w || !r) return;
    this.frame++;
    const near = [];
    for (const [key, d] of this.designs) {
      const [x, y, z] = key.split(',').map(Number), dist = Math.hypot(x + 0.5 - cam.x, y + 1 - cam.y, z + 0.5 - cam.z);
      if (dist > range) continue;
      const b = BANNER[w.getBlock(x, y, z)];
      if (b) near.push({ x, y, z, d, b, dist });
    }
    // (The nearest first, should there be more designs about than layers to hold them.)
    near.sort((a, b) => a.dist - b.dist);
    const seen = new Set();
    for (const n of near) {
      const key = designKey(n.d);
      if (!seen.has(key) && seen.size >= BANNER_SLOTS) continue;
      seen.add(key);
      const m = this.meshesFor(this.slotFor(n.d)), l = w.getLight(n.x, n.y, n.z), light = [l >> 4, l & 15];
      const at = (mm) => {
        identity(mm);
        translate(mm, mm, n.x + 0.5 - cam.x, n.y - cam.y, n.z + 0.5 - cam.z);
        rotateY(mm, mm, n.b.wall ? WALL_TURN[n.b.face] : standingTurn(n.b.rot));
        if (n.b.wall) translate(mm, mm, WALL_SHIFT[0], WALL_SHIFT[1], WALL_SHIFT[2]);
        return mm;
      };
      const still = at(mat());
      // The cloth sways about the bar, each banner in its own time (as in the original).
      const t = (((n.x * 7 + n.y * 9 + n.z * 13) % 100 + 100) % 100 + time * 20) % 100 / 100;
      const cloth = at(mat());
      translate(cloth, cloth, 0, CLOTH_TOP, 0);
      rotateX(cloth, cloth, (-0.0125 + 0.01 * Math.cos(Math.PI * 2 * t)) * Math.PI);
      translate(cloth, cloth, 0, -CLOTH_TOP, 0);
      for (const mm of [still, cloth]) translate(mm, mm, -MODEL_OFFSET, -MODEL_OFFSET, -MODEL_OFFSET);
      out.push({ parts: [{ mesh: n.b.wall ? m.bar : m.pole, model: still }, { mesh: m.cloth, model: cloth }], light, tint: null });
    }
  }
}
