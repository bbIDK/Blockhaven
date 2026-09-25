// Things hung up: item frames (showing an item, turned an eighth at a time) and paintings. They
// are entities fixed to the face of a block, as in the original: put up on the face you point at,
// knocked down by a punch, and dropped when what holds them up is gone (or something is built in
// front of them). A hanging has `face` (the way it faces), the block it hangs on (`bx, by, bz`:
// for a painting, its lower left one, seen from the front), and for a frame `item` and `rot`, for
// a painting `art` (an index into PAINTINGS).
import { SOLID, FACE_DIRS } from './blocks.js';
import { I } from './items.js';
import { TEX } from './textures.js';
import { PAINTINGS } from './tex/paintings.js';
import { boxMesh, MODEL_OFFSET } from './models.js';
import { translate, rotateZ, scale } from './math.js';

export const isHanging = (e) => e.kind === 'frame' || e.kind === 'painting';

// For each face: which way is right and which is up, seen from in front, and which way is out.
const BASIS = [
  [[0, 0, -1], [0, 1, 0], [1, 0, 0]],
  [[0, 0, 1], [0, 1, 0], [-1, 0, 0]],
  [[1, 0, 0], [0, 0, -1], [0, 1, 0]],
  [[1, 0, 0], [0, 0, 1], [0, -1, 0]],
  [[1, 0, 0], [0, 1, 0], [0, 0, 1]],
  [[-1, 0, 0], [0, 1, 0], [0, 0, -1]],
];
export const sizeOf = (e) => (e.kind === 'painting' ? [PAINTINGS[e.art][1], PAINTINGS[e.art][2]] : [1, 1]);
const THICK = 1 / 16;

// The lower left corner of a hanging, on the face of the block it hangs on.
function corner(bx, by, bz, face) {
  const [r, u] = BASIS[face], d = FACE_DIRS[face];
  return [0, 1, 2].map((k) => [bx, by, bz][k] + 0.5 + d[k] * 0.5 - (r[k] + u[k]) * 0.5);
}
// The blocks a hanging is on (and so the spaces in front of them), w by h from its lower left.
function cells(bx, by, bz, face, w, h) {
  const [r, u] = BASIS[face], out = [];
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) out.push([bx + r[0] * i + u[0] * j, by + r[1] * i + u[1] * j, bz + r[2] * i + u[2] * j]);
  return out;
}

// Can something w by h hang on `face` of the blocks from bx, by, bz? Every block behind it solid,
// every space in front of it open, and no other hanging in the way.
export function fits(ents, bx, by, bz, face, w, h, self = null) {
  const world = ents.world, d = FACE_DIRS[face];
  const mine = cells(bx, by, bz, face, w, h);
  for (const [x, y, z] of mine) {
    if (!SOLID[world.getBlock(x, y, z)] || SOLID[world.getBlock(x + d[0], y + d[1], z + d[2])]) return false;
  }
  const keys = new Set(mine.map((c) => c.join(',')));
  for (const o of ents.list) {
    if (o === self || o.dead || !isHanging(o) || o.face !== face) continue;
    const [ow, oh] = sizeOf(o);
    if (cells(o.bx, o.by, o.bz, face, ow, oh).some((c) => keys.has(c.join(',')))) return false;
  }
  return true;
}

// Where a new hanging goes, pointed at the `face` of the block at x, y, z: { bx, by, bz, face, art }
// or null if it won't go. A painting is the biggest of the pictures that fits there (one at
// random, if several do), roughly centred on that block.
export function placement(ents, kind, x, y, z, face) {
  if (kind === 'frame') return fits(ents, x, y, z, face, 1, 1) ? { bx: x, by: y, bz: z, face, art: 0 } : null;
  if (face === 2 || face === 3) return null;
  const [r] = BASIS[face], options = [];
  PAINTINGS.forEach(([, w, h], art) => {
    // (Even sizes lean to the right and up, as in the original.)
    const ox = -Math.floor((w - 1) / 2), oy = -Math.floor((h - 1) / 2);
    const bx = x + r[0] * ox, by = y + oy, bz = z + r[2] * ox;
    if (fits(ents, bx, by, bz, face, w, h)) options.push({ bx, by, bz, face, art, area: w * h });
  });
  if (!options.length) return null;
  const most = Math.max(...options.map((o) => o.area)), best = options.filter((o) => o.area === most);
  return best[Math.floor(Math.random() * best.length)];
}

// Sets up a hanging entity's position and box from its block, face and size.
export function place(e) {
  const [w, h] = sizeOf(e), [r, u, o] = BASIS[e.face], c = corner(e.bx, e.by, e.bz, e.face);
  const far = [0, 1, 2].map((k) => c[k] + r[k] * w + u[k] * h + o[k] * THICK * 2);
  const min = [0, 1, 2].map((k) => Math.min(c[k], far[k])), max = [0, 1, 2].map((k) => Math.max(c[k], far[k]));
  // (A frame is only the middle three quarters of its block.)
  if (e.kind === 'frame') for (let k = 0; k < 3; k++) if (r[k] || u[k]) { min[k] += 2 / 16; max[k] -= 2 / 16; }
  e.x = (min[0] + max[0]) / 2; e.y = (min[1] + max[1]) / 2; e.z = (min[2] + max[2]) / 2;
  e.box = [min[0] - e.x, min[1] - e.y, min[2] - e.z, max[0] - e.x, max[1] - e.y, max[2] - e.z];
  e.hw = Math.max(max[0] - min[0], max[2] - min[2]) / 2; e.h = max[1] - min[1];
}
// Is it still held up (and not built over)?
export const holds = (ents, e) => fits(ents, e.bx, e.by, e.bz, e.face, ...sizeOf(e), e);

// What it drops: itself, and whatever was in it.
export function drops(e) {
  const out = [{ id: e.kind === 'frame' ? I.item_frame : I.painting, count: 1, dmg: 0 }];
  if (e.item) out.push(e.item);
  return out;
}

// A frame used with `held`: an empty one takes one of it ('put'), one with something in it turns
// it an eighth ('turn').
export const frameUse = (e, held) => (e.kind !== 'frame' ? null : e.item ? 'turn' : held ? 'put' : null);

// ---------------------------------------------------------------- drawing
const meshes = new Map();
function frameMesh(r) {
  if (!meshes.has('frame')) {
    const back = { layer: TEX.painting_back, uv: [2, 2, 14, 14] }, edge = { layer: TEX.item_frame, uv: [0, 0, 16, 1] };
    meshes.set('frame', r.createMesh(boxMesh([{ from: [2 / 16, 2 / 16, 0], to: [14 / 16, 14 / 16, THICK], faces: [edge, edge, edge, edge, { layer: TEX.item_frame, uv: [2, 2, 14, 14] }, back] }])));
  }
  return meshes.get('frame');
}
function paintingMesh(r, art) {
  const key = `painting${art}`;
  if (!meshes.has(key)) {
    const [name, w, h] = PAINTINGS[art], back = { layer: TEX.painting_back, uv: [0, 0, 16, 16] }, edge = { layer: TEX.painting_back, uv: [0, 0, 16, 1] };
    const parts = [];
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
      parts.push({ from: [i, j, 0], to: [i + 1, j + 1, THICK],
        faces: [edge, edge, edge, edge, { layer: TEX[`painting_${name}_${i}_${h - 1 - j}`], uv: [0, 0, 16, 16] }, back] });
    }
    meshes.set(key, r.createMesh(boxMesh(parts)));
  }
  return meshes.get(key);
}

// A model matrix that stands a model built facing +z (lower left at the origin) on the wall.
function wallModel(m, e, cam) {
  const [r, u, o] = BASIS[e.face], c = corner(e.bx, e.by, e.bz, e.face), O = MODEL_OFFSET;
  m[0] = r[0]; m[1] = r[1]; m[2] = r[2]; m[3] = 0;
  m[4] = u[0]; m[5] = u[1]; m[6] = u[2]; m[7] = 0;
  m[8] = o[0]; m[9] = o[1]; m[10] = o[2]; m[11] = 0;
  for (let k = 0; k < 3; k++) m[12 + k] = c[k] - [cam.x, cam.y, cam.z][k] - O * (r[k] + u[k] + o[k]);
  m[15] = 1;
  return m;
}

// Adds a hanging (and what's in a frame) to the renderer's list.
export function drawHanging(ents, e, cam, mat, out) {
  const r = ents.game.renderer, w = ents.world, d = FACE_DIRS[e.face];
  const l = w.getLight(e.bx + d[0], e.by + d[1], e.bz + d[2]), light = [l >> 4, l & 15];
  const m = wallModel(mat(), e, cam);
  if (e.kind === 'painting') { out.push({ parts: [{ mesh: paintingMesh(r, e.art), model: m }], light, tint: null }); return; }
  const parts = [{ mesh: frameMesh(r), model: m }];
  const mesh = e.item ? r.itemMesh(e.item.id) : null;
  if (mesh) {
    // The item lies on the frame, turned an eighth at a time: flat pictures at half size, blocks
    // as little blocks.
    const im = mat();
    im.set(m);
    const block = mesh.kind === 'block', s = block ? 0.4 : 0.5;
    translate(im, im, 0.5 + MODEL_OFFSET, 0.5 + MODEL_OFFSET, THICK + (block ? s / 2 : 0.01) + MODEL_OFFSET);
    rotateZ(im, im, -(e.rot ?? 0) * Math.PI / 4);
    scale(im, im, s, s, s);
    translate(im, im, -0.5 - MODEL_OFFSET, -0.5 - MODEL_OFFSET, -0.5 - MODEL_OFFSET);
    parts.push({ mesh, model: im, glint: e.item.ench || e.item.id === I.enchanted_book ? 1 : 0 });
  }
  out.push({ parts, light, tint: null });
}
