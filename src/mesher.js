// Builds vertex data for one 16x16x16 section from a padded 18^3 copy of blocks and light.
// Vertex layout (20 bytes): pos u16x3 (1/256 block) | uv u8x2 (1/16) | layer lo, face, flags, layer hi |
// sky, block, ao, flow (normalised) | tint rgb, 255 (normalised). `flow` is only used by liquids:
// 0 still, 1..254 the direction the surface flows, 255 falling down the sides.
import {
  R, RENDER, OPAQUE, AO, TEXL, FFLAGS, TINT, TINT_RGB, CULL_SELF, TRANSLUCENT, B, ANIM, WET,
  F_TINT, F_OVERLAY, F_UVROT, F_ANIM, liquidHeight, liquidLevel, sameCullGroup, TORCH_LEAN, shapeBoxes, boxFaceUV, boxLayer, RAIL,
} from './blocks.js';
import { columnColors, fromByte } from './biomes.js';
import { hash2 } from './math.js';

export const P = 18, P2 = P * P, PADDED = P * P2;
export const STRIDE = 20;
const U = 256; // position units per block
// Section vertices are shifted by this many blocks so slightly-outside geometry (jittered
// plants) never goes negative in the unsigned position attribute. The renderer undoes it.
export const SECTION_OFFSET = 4;
const OFS = SECTION_OFFSET * U;

let flow = 0; // written into each vertex (see the layout above)

class MeshBuffer {
  constructor(cap) { this.count = 0; this.u8 = null; this.alloc(cap); }
  alloc(cap) {
    const buf = new ArrayBuffer(cap * STRIDE);
    const u8 = new Uint8Array(buf);
    if (this.u8) u8.set(this.u8.subarray(0, this.count * STRIDE));
    this.u8 = u8;
    this.u16 = new Uint16Array(buf);
    this.cap = cap;
  }
  reserve(n) { if (this.count + n > this.cap) this.alloc(Math.max(this.cap * 2, this.count + n)); }
  vertex(x, y, z, u, v, layer, face, flags, sky, blk, ao, r, g, b) {
    const i = this.count++, o = i * STRIDE, h = i * 10, u8 = this.u8;
    this.u16[h] = x + OFS; this.u16[h + 1] = y + OFS; this.u16[h + 2] = z + OFS;
    u8[o + 6] = u; u8[o + 7] = v;
    u8[o + 8] = layer & 255; u8[o + 9] = face; u8[o + 10] = flags; u8[o + 11] = layer >> 8;
    u8[o + 12] = sky; u8[o + 13] = blk; u8[o + 14] = ao; u8[o + 15] = flow;
    u8[o + 16] = r; u8[o + 17] = g; u8[o + 18] = b; u8[o + 19] = 255;
  }
  take() { return this.u8.slice(0, this.count * STRIDE); }
}

// Unit-cube corners for each face, counter-clockwise seen from outside: BL, BR, TR, TL.
export const FACE_CORNERS = [
  [[1, 0, 1], [1, 0, 0], [1, 1, 0], [1, 1, 1]],
  [[0, 0, 0], [0, 0, 1], [0, 1, 1], [0, 1, 0]],
  [[0, 1, 1], [1, 1, 1], [1, 1, 0], [0, 1, 0]],
  [[1, 0, 1], [0, 0, 1], [0, 0, 0], [1, 0, 0]],
  [[0, 0, 1], [1, 0, 1], [1, 1, 1], [0, 1, 1]],
  [[1, 0, 0], [0, 0, 0], [0, 1, 0], [1, 1, 0]],
];
const NORMAL_AXIS = [0, 0, 1, 1, 2, 2];
const AXIS_OFF = [1, P2, P];
const NOFF = [1, -1, P2, -P2, P, -P];
const UV = [[0, 16], [16, 16], [16, 0], [0, 0]];
const UV_ROT = [[0, 0], [0, 16], [16, 16], [16, 0]];

// For each face and corner: padded offsets (relative to the face neighbour) of side1, side2, corner.
const AO_OFF = FACE_CORNERS.map((corners, f) => corners.map((c) => {
  const axes = [0, 1, 2].filter((a) => a !== NORMAL_AXIS[f]);
  const o1 = (c[axes[0]] ? 1 : -1) * AXIS_OFF[axes[0]];
  const o2 = (c[axes[1]] ? 1 : -1) * AXIS_OFF[axes[1]];
  return [o1, o2, o1 + o2];
}));

// Opaque geometry is sorted by the way it faces (+X, -X, +Y, -Y, +Z, -Z), with everything that
// isn't a flat axis-aligned face (plants, torches, liquids) in its own group first. The renderer
// can then skip whole groups that face away from the camera.
const other = new MeshBuffer(2048);
const dirs = [0, 1, 2, 3, 4, 5].map(() => new MeshBuffer(2048));
const trans = new MeshBuffer(2048);
const grassT = new Uint8Array(768), foliageT = new Uint8Array(768), waterT = new Uint8Array(768);
const aoV = new Int32Array(4), skyV = new Int32Array(4), blkV = new Int32Array(4);
const FLAG_MASK = 0xff & ~F_UVROT;

function faceVisible(id, nid) {
  if (OPAQUE[nid]) return false;
  if (CULL_SELF[id] && sameCullGroup(id, nid)) return false;
  return true;
}

function tintFor(id, col, out) {
  const t = TINT[id];
  if (t === 1) { out[0] = grassT[col * 3]; out[1] = grassT[col * 3 + 1]; out[2] = grassT[col * 3 + 2]; }
  else if (t === 2) { out[0] = foliageT[col * 3]; out[1] = foliageT[col * 3 + 1]; out[2] = foliageT[col * 3 + 2]; }
  else if (t === 3) { out[0] = TINT_RGB[id * 3]; out[1] = TINT_RGB[id * 3 + 1]; out[2] = TINT_RGB[id * 3 + 2]; }
  else if (t === 4) { out[0] = waterT[col * 3]; out[1] = waterT[col * 3 + 1]; out[2] = waterT[col * 3 + 2]; }
  else { out[0] = out[1] = out[2] = 255; }
}
const tint = [255, 255, 255];

function cubeFace(buf, blocks, light, x, y, z, p, id, f) {
  const n = p + NOFF[f];
  const offs = AO_OFF[f];
  const nl = light[n];
  for (let k = 0; k < 4; k++) {
    const o = offs[k];
    const b1 = blocks[n + o[0]], b2 = blocks[n + o[1]], b3 = blocks[n + o[2]];
    const a1 = AO[b1], a2 = AO[b2];
    aoV[k] = a1 && a2 ? 0 : 3 - a1 - a2 - AO[b3];
    let s = nl >> 4, b = nl & 15, c = 1;
    const o1 = OPAQUE[b1], o2 = OPAQUE[b2];
    if (!o1) { const l = light[n + o[0]]; s += l >> 4; b += l & 15; c++; }
    if (!o2) { const l = light[n + o[1]]; s += l >> 4; b += l & 15; c++; }
    if (!(o1 && o2) && !OPAQUE[b3]) { const l = light[n + o[2]]; s += l >> 4; b += l & 15; c++; }
    skyV[k] = Math.round((s * 17) / c);
    blkV[k] = Math.round((b * 17) / c);
  }
  const fi = id * 6 + f;
  const layer = TEXL[fi], ff = FFLAGS[fi];
  const flags = ff & FLAG_MASK;
  if (ff & (F_TINT | F_OVERLAY)) tintFor(id, (z << 4) | x, tint); else tint[0] = tint[1] = tint[2] = 255;
  const uvs = ff & F_UVROT ? UV_ROT : UV;
  const corners = FACE_CORNERS[f];
  const flip = aoV[0] * 30 + skyV[0] + blkV[0] + aoV[2] * 30 + skyV[2] + blkV[2] <
    aoV[1] * 30 + skyV[1] + blkV[1] + aoV[3] * 30 + skyV[3] + blkV[3];
  buf.reserve(4);
  for (let j = 0; j < 4; j++) {
    const k = flip ? (j + 1) & 3 : j;
    const c = corners[k];
    buf.vertex((x + c[0]) * U, (y + c[1]) * U, (z + c[2]) * U, uvs[k][0], uvs[k][1], layer, f, flags,
      skyV[k], blkV[k], aoV[k] * 85, tint[0], tint[1], tint[2]);
  }
}

// Liquid surfaces slope towards flowing neighbours; each corner averages the four cells around it.
function cornerHeight(blocks, p, id, cx, cz) {
  let sum = 0, n = 0;
  for (let dz = cz - 1; dz <= cz; dz++) {
    for (let dx = cx - 1; dx <= cx; dx++) {
      const q = p + dx + dz * P;
      const b = blocks[q];
      if (!sameCullGroup(id, b)) continue;
      if (sameCullGroup(id, blocks[q + P2])) return U;
      sum += liquidHeight(b); n++;
    }
  }
  return Math.round((n ? sum / n : liquidHeight(id)) * U);
}

const liquidVerts = [[0, 0, 0, 0, 0], [0, 0, 0, 0, 0], [0, 0, 0, 0, 0], [0, 0, 0, 0, 0]];
const liquidH = [0, 0, 0, 0];

function liquid(buf, blocks, light, x, y, z, p, id) {
  const aboveSame = sameCullGroup(id, blocks[p + P2]);
  let any = false;
  for (let f = 0; f < 6 && !any; f++) {
    const nid = blocks[p + NOFF[f]];
    if (!sameCullGroup(id, nid) && !(f === 2 ? aboveSame : OPAQUE[nid])) any = true;
  }
  if (!any) return;
  if (aboveSame) liquidH.fill(U);
  else {
    liquidH[0] = cornerHeight(blocks, p, id, 0, 0); liquidH[1] = cornerHeight(blocks, p, id, 1, 0);
    liquidH[2] = cornerHeight(blocks, p, id, 0, 1); liquidH[3] = cornerHeight(blocks, p, id, 1, 1);
  }
  const layer = TEXL[id * 6], flags = FFLAGS[id * 6] & FLAG_MASK;
  if (TINT[id]) tintFor(id, (z << 4) | x, tint); else tint[0] = tint[1] = tint[2] = 255;
  const own = light[p];
  // Which way the surface runs: downhill across the corner heights.
  const gx = liquidH[1] + liquidH[3] - liquidH[0] - liquidH[2], gz = liquidH[2] + liquidH[3] - liquidH[0] - liquidH[1];
  const level = liquidLevel(id);
  const topFlow = Math.abs(gx) + Math.abs(gz) < 8 ? 0 : 1 + Math.round(((Math.atan2(-gz, -gx) / (Math.PI * 2) + 1) % 1) * 253);
  const sideFlow = aboveSame || level === 8 || level > 0 ? 255 : 0;
  for (let f = 0; f < 6; f++) {
    const nid = blocks[p + NOFF[f]];
    if (sameCullGroup(id, nid)) continue;
    if (f === 2 ? aboveSame : OPAQUE[nid]) continue;
    flow = f === 2 || f === 3 ? topFlow : sideFlow;
    const nl = light[p + NOFF[f]];
    const sky = Math.max(own >> 4, nl >> 4) * 17, blk = Math.max(own & 15, nl & 15) * 17;
    const corners = FACE_CORNERS[f];
    buf.reserve(8);
    for (let k = 0; k < 4; k++) {
      const c = corners[k], v = liquidVerts[k];
      const top = c[1] ? liquidH[c[0] + c[2] * 2] : 0;
      v[0] = (x + c[0]) * U; v[1] = y * U + top; v[2] = (z + c[2]) * U; v[3] = UV[k][0];
      v[4] = f === 2 || f === 3 ? UV[k][1] : c[1] ? Math.round(16 - (top / U) * 16) : 16;
      buf.vertex(v[0], v[1], v[2], v[3], v[4], layer, f, flags, sky, blk, 255, tint[0], tint[1], tint[2]);
    }
    if (f === 2) {
      // Seen from below (underwater) the surface needs the opposite winding.
      for (let k = 3; k >= 0; k--) {
        const v = liquidVerts[k];
        buf.vertex(v[0], v[1], v[2], v[3], v[4], layer, 2, flags, sky, blk, 255, tint[0], tint[1], tint[2]);
      }
    }
  }
  flow = 0;
}

// Fire: two crossed sheets of flame plus four around the edges, double-sided, animated.
function fire(buf, light, x, y, z, p, id) {
  const l = light[p];
  const sky = (l >> 4) * 17, blk = 255;
  const layer = TEXL[id * 6], flags = (FFLAGS[id * 6] & FLAG_MASK) | (ANIM[id] ? F_ANIM : 0);
  tint[0] = tint[1] = tint[2] = 255;
  const X = x * U, Y = y * U, Z = z * U, H = Math.round(1.3 * U), h = U;
  const a = Math.round(0.06 * U), b = U - a;
  crossQuad(buf, [[X, Y, Z], [X + U, Y, Z + U], [X + U, Y + H, Z + U], [X, Y + H, Z]], layer, flags, sky, blk);
  crossQuad(buf, [[X, Y, Z + U], [X + U, Y, Z], [X + U, Y + H, Z], [X, Y + H, Z + U]], layer, flags, sky, blk);
  crossQuad(buf, [[X, Y, Z + a], [X + U, Y, Z + a], [X + U, Y + h, Z + a], [X, Y + h, Z + a]], layer, flags, sky, blk);
  crossQuad(buf, [[X, Y, Z + b], [X + U, Y, Z + b], [X + U, Y + h, Z + b], [X, Y + h, Z + b]], layer, flags, sky, blk);
  crossQuad(buf, [[X + a, Y, Z], [X + a, Y, Z + U], [X + a, Y + h, Z + U], [X + a, Y + h, Z]], layer, flags, sky, blk);
  crossQuad(buf, [[X + b, Y, Z], [X + b, Y, Z + U], [X + b, Y + h, Z + U], [X + b, Y + h, Z]], layer, flags, sky, blk);
}

function crossQuad(buf, pts, layer, flags, sky, blk) {
  buf.reserve(8);
  for (let k = 0; k < 4; k++) buf.vertex(pts[k][0], pts[k][1], pts[k][2], UV[k][0], UV[k][1], layer, 6, flags, sky, blk, 255, tint[0], tint[1], tint[2]);
  for (let k = 3; k >= 0; k--) buf.vertex(pts[k][0], pts[k][1], pts[k][2], UV[k][0], UV[k][1], layer, 6, flags, sky, blk, 255, tint[0], tint[1], tint[2]);
}

// Rails: the track's picture lying just above the ground, turned the way it runs, or tilted up a
// slope. (The pictures run north-south; corners join south and east.) For each shape: how many
// quarter turns the picture is given, and the height of each corner (north-west, north-east,
// south-east, south-west) in blocks.
const RAIL_TURN = [0, 1, 1, 1, 0, 0, 0, 1, 2, 3];
const RAIL_RISE = [[0, 0, 0, 0], [0, 0, 0, 0], [0, 1, 1, 0], [1, 0, 0, 1], [1, 1, 0, 0], [0, 0, 1, 1], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]];
const RAIL_UV = [[0, 0], [16, 0], [16, 16], [0, 16]];
function rail(buf, light, x, y, z, p, id) {
  const shape = RAIL[id].shape, l = light[p];
  const sky = (l >> 4) * 17, blk = (l & 15) * 17;
  const layer = TEXL[id * 6], flags = FFLAGS[id * 6] & FLAG_MASK;
  tint[0] = tint[1] = tint[2] = 255;
  const X = x * U, Y = y * U + Math.round(U / 16), Z = z * U, rise = RAIL_RISE[shape], turn = RAIL_TURN[shape];
  const pts = [[X, Z], [X + U, Z], [X + U, Z + U], [X, Z + U]].map(([px, pz], k) => [px, Y + rise[k] * U, pz]);
  // Both sides, so it can be seen from under a slope too.
  buf.reserve(8);
  const corner = (k) => { const uv = RAIL_UV[(k + 4 - turn) % 4]; buf.vertex(pts[k][0], pts[k][1], pts[k][2], uv[0], uv[1], layer, 6, flags, sky, blk, 255, 255, 255, 255); };
  for (const k of [3, 2, 1, 0]) corner(k);
  for (const k of [0, 1, 2, 3]) corner(k);
}

// Small plants are nudged off-centre a little so a meadow doesn't look planted in rows.
const JITTER = new Set(['tall_grass', 'fern', 'dandelion', 'poppy', 'cornflower', 'dead_bush', 'red_mushroom', 'brown_mushroom', 'allium',
  'azure_bluet', 'blue_orchid', 'oxeye_daisy', 'red_tulip', 'orange_tulip', 'white_tulip', 'pink_tulip', 'lily_of_the_valley'].map((n) => B[n]));

function cross(buf, light, x, y, z, p, id, wx, wz) {
  const l = light[p];
  const sky = (l >> 4) * 17, blk = (l & 15) * 17;
  let ox = 0, oz = 0;
  if (JITTER.has(id)) {
    ox = Math.round((hash2(wx, wz, 77) - 0.5) * 0.3 * U);
    oz = Math.round((hash2(wz, wx, 91) - 0.5) * 0.3 * U);
  }
  const layer = TEXL[id * 6], flags = FFLAGS[id * 6] & FLAG_MASK;
  if (TINT[id]) tintFor(id, (z << 4) | x, tint); else tint[0] = tint[1] = tint[2] = 255;
  const a = Math.round(0.08 * U), b = Math.round(0.92 * U);
  const X = x * U + ox, Y = y * U, Z = z * U + oz;
  crossQuad(buf, [[X + a, Y, Z + a], [X + b, Y, Z + b], [X + b, Y + U, Z + b], [X + a, Y + U, Z + a]], layer, flags, sky, blk);
  crossQuad(buf, [[X + a, Y, Z + b], [X + b, Y, Z + a], [X + b, Y + U, Z + a], [X + a, Y + U, Z + b]], layer, flags, sky, blk);
}

// Torch: a 2x10x2 pixel stick; wall torches lean 22.5 degrees away from the wall.
const TORCH_UV = [[7, 16, 9, 6], [7, 16, 9, 6], [7, 6, 9, 4], [7, 16, 9, 14], [7, 16, 9, 6], [7, 16, 9, 6]];
const LEAN_ROT = { 0: [1, 0, 0, 1], 1: [-1, 0, 0, -1], 4: [0, -1, 1, 0], 5: [0, 1, -1, 0] }; // (u,w) -> (x,z)
function torch(buf, light, x, y, z, p, id) {
  const l = light[p];
  const sky = (l >> 4) * 17, blk = (l & 15) * 17;
  const layer = TEXL[id * 6], flags = FFLAGS[id * 6] & FLAG_MASK;
  const lean = TORCH_LEAN[id];
  const rot = lean >= 0 ? LEAN_ROT[lean] : null;
  const th = 0.3927, cs = Math.cos(th), sn = Math.sin(th);
  const w = 1 / 16, h = 10 / 16;
  buf.reserve(24);
  for (let f = 0; f < 6; f++) {
    const uv = TORCH_UV[f];
    FACE_CORNERS[f].forEach((c, k) => {
      let u = c[0] ? w : -w, yy = c[1] ? h : 0, ww = c[2] ? w : -w;
      let px, py, pz;
      if (!rot) { px = 0.5 + u; py = yy; pz = 0.5 + ww; }
      else {
        const ur = u * cs + yy * sn, yr = -u * sn + yy * cs;
        u = -0.5 + 0.1 + ur;
        px = 0.5 + rot[0] * u + rot[1] * ww;
        pz = 0.5 + rot[2] * u + rot[3] * ww;
        py = 0.2 + yr;
      }
      const tu = k === 0 || k === 3 ? uv[0] : uv[2];
      const tv = k === 0 || k === 1 ? uv[1] : uv[3];
      buf.vertex(Math.round((x + px) * U), Math.round((y + py) * U), Math.round((z + pz) * U), tu, tv, layer, f, flags, sky, blk, 255, 255, 255, 255);
    });
  }
}

function cactus(bufs, blocks, light, x, y, z, p, id) {
  const inset = U / 16;
  const own = light[p];
  for (let f = 0; f < 6; f++) {
    const nid = blocks[p + NOFF[f]];
    if ((f === 2 || f === 3) && (OPAQUE[nid] || nid === id)) continue;
    const l = OPAQUE[nid] ? own : light[p + NOFF[f]];
    const sky = (l >> 4) * 17, blk = (l & 15) * 17;
    const layer = TEXL[id * 6 + f];
    const buf = bufs[f];
    buf.reserve(4);
    FACE_CORNERS[f].forEach((c, k) => {
      let px = c[0] * U, pz = c[2] * U;
      if (f === 0) px -= inset; else if (f === 1) px += inset; else if (f === 4) pz -= inset; else if (f === 5) pz += inset;
      buf.vertex(x * U + px, (y + c[1]) * U, z * U + pz, UV[k][0], UV[k][1], layer, f, 0, sky, blk, 255, 255, 255, 255);
    });
  }
}

// Shaped blocks (slabs, stairs, doors, fences...): one textured box per part. Faces flush with the
// cell edge are skipped against opaque neighbours and take the neighbour's light.
const boundary = (b, f) => (f === 0 ? b[3] === 16 : f === 1 ? b[0] === 0 : f === 2 ? b[4] === 16 : f === 3 ? b[1] === 0 : f === 4 ? b[5] === 16 : b[2] === 0);
function model(bufs, blocks, light, x, y, z, p, id) {
  const boxes = shapeBoxes(id, (f) => blocks[p + NOFF[f]]);
  if (!boxes) return;
  const own = light[p];
  const flags = FFLAGS[id * 6] & FLAG_MASK;
  if (TINT[id] && flags & F_TINT) tintFor(id, (z << 4) | x, tint); else tint[0] = tint[1] = tint[2] = 255;
  for (const b of boxes) {
    // A box with its own textures (another material) isn't tinted.
    const own6 = b.length > 6, bflags = own6 ? flags & ~F_TINT : flags;
    const tr = own6 ? 255 : tint[0], tg = own6 ? 255 : tint[1], tbl = own6 ? 255 : tint[2];
    for (let f = 0; f < 6; f++) {
      const edge = boundary(b, f);
      const nid = blocks[p + NOFF[f]];
      if (edge && (OPAQUE[nid] || (nid === id && CULL_SELF[id]))) continue;
      const l = edge ? light[p + NOFF[f]] : own;
      const sky = Math.max(l >> 4, own >> 4) * 17, blk = Math.max(l & 15, own & 15) * 17;
      const uv = boxFaceUV(b, f);
      const layer = boxLayer(id, b, f);
      const buf = bufs[f];
      buf.reserve(4);
      FACE_CORNERS[f].forEach((c, k) => {
        buf.vertex(x * U + (c[0] ? b[3] : b[0]) * 16, y * U + (c[1] ? b[4] : b[1]) * 16, z * U + (c[2] ? b[5] : b[2]) * 16,
          UV[k][0] ? uv[2] : uv[0], UV[k][1] ? uv[3] : uv[1], layer, f, bflags, sky, blk, 255, tr, tg, tbl);
      });
    }
  }
}

// Campfire: four logs stacked crosswise, embers glowing on the lit ones, and a flame in the middle.
const CAMPFIRE_LOGS = [[1, 0, 0, 5, 4, 16], [11, 0, 0, 15, 4, 16], [0, 3, 1, 16, 7, 5], [0, 3, 11, 16, 7, 15]];
function campfire(bufs, other, blocks, light, x, y, z, p, id) {
  const own = light[p];
  const sky = (own >> 4) * 17, blk = Math.max(own & 15, 12) * 17;
  CAMPFIRE_LOGS.forEach((b, i) => {
    for (let f = 0; f < 6; f++) {
      if (f === 3 && b[1] === 0 && OPAQUE[blocks[p - P2]]) continue;
      // The logs lying along x show their bark on the long sides and their cut ends on the short.
      const along = i < 2 ? 2 : 0;
      const end = along === 2 ? f === 4 || f === 5 : f === 0 || f === 1;
      const layer = end ? TEXL[B.oak_log * 6 + 2] : TEXL[id * 6];
      const uv = boxFaceUV(b, f);
      const buf = bufs[f];
      buf.reserve(4);
      FACE_CORNERS[f].forEach((c, k) => {
        buf.vertex(x * U + (c[0] ? b[3] : b[0]) * 16, y * U + (c[1] ? b[4] : b[1]) * 16, z * U + (c[2] ? b[5] : b[2]) * 16,
          UV[k][0] ? uv[2] : uv[0], UV[k][1] ? uv[3] : uv[1], layer, f, 0, sky, blk, 255, 255, 255, 255);
      });
    }
  });
  // The flame: two crossed sheets of the animated fire texture.
  const layer = TEXL[B.fire * 6], flags = (FFLAGS[B.fire * 6] & FLAG_MASK) | F_ANIM;
  tint[0] = tint[1] = tint[2] = 255;
  const X = x * U, Y = y * U + 2 * 16, Z = z * U, H = Math.round(0.9 * U), a = Math.round(0.2 * U), b = U - a;
  crossQuad(other, [[X + a, Y, Z + a], [X + b, Y, Z + b], [X + b, Y + H, Z + b], [X + a, Y + H, Z + a]], layer, flags, sky, 255);
  crossQuad(other, [[X + a, Y, Z + b], [X + b, Y, Z + a], [X + b, Y + H, Z + a], [X + a, Y + H, Z + b]], layer, flags, sky, 255);
}

// blocks/light: padded 18^3 arrays; climate: 512 bytes for the chunk's columns; biomes: 256;
// tints: the columns' grass, foliage and water colours blended with their surroundings (768
// bytes each, see World.chunkTints), or null to work them out from the climate alone.
export function meshSection(blocks, light, climate, cx, cz, biomes = null, tints = null) {
  other.count = 0;
  for (const d of dirs) d.count = 0;
  trans.count = 0;
  if (tints) {
    grassT.set(tints.subarray(0, 768)); foliageT.set(tints.subarray(768, 1536)); waterT.set(tints.subarray(1536, 2304));
  } else {
    for (let c = 0; c < 256; c++) {
      const t = fromByte(climate[c * 2]), h = fromByte(climate[c * 2 + 1]);
      columnColors(biomes ? biomes[c] : 4, t, h, grassT, foliageT, waterT, c * 3);
    }
  }
  for (let y = 0; y < 16; y++) {
    for (let z = 0; z < 16; z++) {
      let p = (y + 1) * P2 + (z + 1) * P + 1;
      for (let x = 0; x < 16; x++, p++) {
        const id = blocks[p];
        if (id === 0) continue;
        const rt = RENDER[id];
        if (rt === R.CUBE) {
          const tr = TRANSLUCENT[id];
          for (let f = 0; f < 6; f++) if (faceVisible(id, blocks[p + NOFF[f]])) cubeFace(tr ? trans : dirs[f], blocks, light, x, y, z, p, id, f);
        } else if (rt === R.LIQUID) liquid(TRANSLUCENT[id] ? trans : other, blocks, light, x, y, z, p, id);
        else if (rt === R.CROSS) cross(other, light, x, y, z, p, id, cx * 16 + x, cz * 16 + z);
        else if (rt === R.FIRE) fire(other, light, x, y, z, p, id);
        else if (rt === R.TORCH) torch(other, light, x, y, z, p, id);
        else if (rt === R.CACTUS) cactus(dirs, blocks, light, x, y, z, p, id);
        else if (rt === R.MODEL) model(dirs, blocks, light, x, y, z, p, id);
        else if (rt === R.CAMPFIRE) campfire(dirs, other, blocks, light, x, y, z, p, id);
        else if (rt === R.RAIL) rail(other, light, x, y, z, p, id);
        // Sea plants stand in water: draw the water round them too.
        if (WET[id]) liquid(trans, blocks, light, x, y, z, p, B.water);
      }
    }
  }
  // groups[g]..groups[g + 1] are the quads of group g: 0 other, 1 + f for faces facing f.
  const parts = [other, ...dirs];
  const groups = new Int32Array(8);
  let total = 0;
  parts.forEach((b, g) => { groups[g] = total / 4; total += b.count; });
  groups[7] = total / 4;
  const out = new Uint8Array(total * STRIDE);
  let o = 0;
  for (const b of parts) { out.set(b.u8.subarray(0, b.count * STRIDE), o); o += b.count * STRIDE; }
  return { solid: out, trans: trans.take(), groups, vis: visibility(blocks) };
}

// Which faces of the section can see each other through non-opaque blocks: a 15-bit mask with
// one bit per pair of faces (see FACE_PAIR). Used for cave culling: sections that can only be seen
// through solid rock are never drawn.
export const FACE_PAIR = [0, 1, 2, 3, 4, 5].map(() => new Array(6).fill(-1));
for (let a = 0, bit = 0; a < 6; a++) for (let b = a + 1; b < 6; b++, bit++) FACE_PAIR[a][b] = FACE_PAIR[b][a] = bit;
export const ALL_OPEN = 0x7fff;
const seen = new Uint8Array(4096), queue = new Int16Array(4096);
function visibility(blocks) {
  seen.fill(0);
  let open = 0, mask = 0;
  for (let i = 0; i < 4096; i++) {
    const p = ((i >> 8) + 1) * P2 + (((i >> 4) & 15) + 1) * P + (i & 15) + 1;
    if (OPAQUE[blocks[p]]) seen[i] = 1; else open++;
  }
  if (open === 4096) return ALL_OPEN;
  if (open === 0) return 0;
  for (let start = 0; start < 4096; start++) {
    if (seen[start]) continue;
    // Flood one pocket of open cells and note which faces it touches.
    let head = 0, tail = 0, faces = 0;
    queue[tail++] = start;
    seen[start] = 1;
    while (head < tail) {
      const i = queue[head++];
      const x = i & 15, z = (i >> 4) & 15, y = i >> 8;
      if (x === 15) faces |= 1; else if (!seen[i + 1]) { seen[i + 1] = 1; queue[tail++] = i + 1; }
      if (x === 0) faces |= 2; else if (!seen[i - 1]) { seen[i - 1] = 1; queue[tail++] = i - 1; }
      if (y === 15) faces |= 4; else if (!seen[i + 256]) { seen[i + 256] = 1; queue[tail++] = i + 256; }
      if (y === 0) faces |= 8; else if (!seen[i - 256]) { seen[i - 256] = 1; queue[tail++] = i - 256; }
      if (z === 15) faces |= 16; else if (!seen[i + 16]) { seen[i + 16] = 1; queue[tail++] = i + 16; }
      if (z === 0) faces |= 32; else if (!seen[i - 16]) { seen[i - 16] = 1; queue[tail++] = i - 16; }
    }
    for (let a = 0; a < 6; a++) {
      if (!(faces & (1 << a))) continue;
      for (let b = a + 1; b < 6; b++) if (faces & (1 << b)) mask |= 1 << FACE_PAIR[a][b];
    }
    if (mask === ALL_OPEN) break;
  }
  return mask;
}

// Mesh for a single block (the held item and dropped items), lit uniformly.
export function meshBlockItem(id) {
  const blocks = new Uint16Array(PADDED);
  const light = new Uint8Array(PADDED).fill(0xf0);
  const climate = new Uint8Array(512).fill(150);
  blocks[P2 + P + 1] = id;
  return meshSection(blocks, light, climate, 0, 0);
}
