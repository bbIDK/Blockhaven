// Small meshes in the terrain vertex format: boxes (hand, cracks, mobs) and extruded item sprites.
// Positions are stored with a +MODEL_OFFSET block shift so they stay unsigned; model matrices undo it.
import { STRIDE, FACE_CORNERS } from './mesher.js';
import { boxRegions } from './skins.js';

export const MODEL_OFFSET = 8;
const U = 256;
const UV_CORNERS = [[0, 1], [1, 1], [1, 0], [0, 0]];

class Writer {
  constructor(quads) {
    this.u8 = new Uint8Array(quads * 4 * STRIDE);
    this.u16 = new Uint16Array(this.u8.buffer);
    this.n = 0;
  }
  vertex(x, y, z, u, v, layer, face, flags, tint) {
    const o = this.n * STRIDE, h = this.n * 10;
    this.n++;
    this.u16[h] = Math.round((x + MODEL_OFFSET) * U);
    this.u16[h + 1] = Math.round((y + MODEL_OFFSET) * U);
    this.u16[h + 2] = Math.round((z + MODEL_OFFSET) * U);
    const b = this.u8;
    b[o + 6] = u; b[o + 7] = v; b[o + 8] = layer & 255; b[o + 9] = face; b[o + 10] = flags; b[o + 11] = layer >> 8;
    b[o + 12] = 255; b[o + 13] = 0; b[o + 14] = 255; b[o + 15] = 0;
    b[o + 16] = tint ? tint[0] : 255; b[o + 17] = tint ? tint[1] : 255; b[o + 18] = tint ? tint[2] : 255; b[o + 19] = 255;
  }
  quad(corners, uvRect, layer, face, flags, tint) {
    for (let k = 0; k < 4; k++) {
      const c = corners[k], uv = UV_CORNERS[k];
      this.vertex(c[0], c[1], c[2], uv[0] ? uvRect[2] : uvRect[0], uv[1] ? uvRect[3] : uvRect[1], layer, face, flags, tint);
    }
  }
  bytes() { return this.u8.subarray(0, this.n * STRIDE); }
}

// parts: [{ from:[x,y,z], to:[x,y,z], faces: [{ layer, uv:[u0,v0,u1,v1] }] x6 or one for all, flags, tint }]
export function boxMesh(parts) {
  const w = new Writer(parts.length * 6);
  for (const p of parts) {
    for (let f = 0; f < 6; f++) {
      const face = Array.isArray(p.faces) ? p.faces[f] : p.faces;
      if (!face) continue;
      const corners = FACE_CORNERS[f].map((c) => [
        c[0] ? p.to[0] : p.from[0], c[1] ? p.to[1] : p.from[1], c[2] ? p.to[2] : p.from[2],
      ]);
      w.quad(corners, face.uv ?? [0, 0, 16, 16], face.layer, f, p.flags ?? 0, p.tint);
    }
  }
  return w.bytes();
}

// A 16x16 sprite extruded to 1/16 thickness, centred on z = 0.5. `pixels` is the layer's RGBA data.
export function spriteMesh(layer, pixels, flags = 0, tint = null) {
  const opaque = (x, y) => x >= 0 && y >= 0 && x < 16 && y < 16 && pixels[(y * 16 + x) * 4 + 3] > 127;
  let edges = 0;
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
    if (!opaque(x, y)) continue;
    if (!opaque(x - 1, y)) edges++;
    if (!opaque(x + 1, y)) edges++;
    if (!opaque(x, y - 1)) edges++;
    if (!opaque(x, y + 1)) edges++;
  }
  const w = new Writer(2 + edges);
  const z0 = 0.5 - 1 / 32, z1 = 0.5 + 1 / 32;
  w.quad([[0, 0, z1], [1, 0, z1], [1, 1, z1], [0, 1, z1]], [0, 0, 16, 16], layer, 4, flags, tint);
  w.quad([[1, 0, z0], [0, 0, z0], [0, 1, z0], [1, 1, z0]], [16, 0, 0, 16], layer, 5, flags, tint);
  const px = 1 / 16;
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
    if (!opaque(x, y)) continue;
    const x0 = x * px, x1 = x0 + px, y1 = 1 - y * px, y0 = y1 - px;
    const uv = [x, y, x + 1, y + 1];
    if (!opaque(x - 1, y)) w.quad([[x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0]], uv, layer, 1, flags, tint);
    if (!opaque(x + 1, y)) w.quad([[x1, y0, z1], [x1, y0, z0], [x1, y1, z0], [x1, y1, z1]], uv, layer, 0, flags, tint);
    if (!opaque(x, y - 1)) w.quad([[x0, y1, z1], [x1, y1, z1], [x1, y1, z0], [x0, y1, z0]], uv, layer, 2, flags, tint);
    if (!opaque(x, y + 1)) w.quad([[x1, y0, z1], [x0, y0, z1], [x0, y0, z0], [x1, y0, z0]], uv, layer, 3, flags, tint);
  }
  return w.bytes();
}

// Boxes cut from a creature skin (see skins.js). Each cube is { from: [x, y, z], size: [w, h, d] }
// in pixels, `uv` its corner in the skin, `mirror` to flip it (a left limb sharing the right one's
// picture) and `inflate` to grow it (a hat, a coat of wool) without changing its picture; `layer`
// overrides the skin for that cube. Positions are taken relative to `origin` (the bone's pivot).
// A part with no thickness (a fin, an ear) shows its two broad faces.
const SKIN_FACE = ['right', 'left', 'top', 'bottom', 'back', 'front'];
export function skinMesh(cubes, layer, origin = [0, 0, 0], tint = null) {
  const w = new Writer(cubes.length * 6);
  for (const c of cubes) {
    const g = c.inflate ?? 0, L = c.layer ?? layer;
    const from = [0, 1, 2].map((i) => (c.from[i] - g - origin[i]) / 16);
    const to = [0, 1, 2].map((i) => (c.from[i] + c.size[i] + g - origin[i]) / 16);
    const R = boxRegions(c.uv[0], c.uv[1], c.size[0], c.size[1], c.size[2]);
    for (let f = 0; f < 6; f++) {
      // (A face with no area - the edge of a flat part - is left out.)
      const axis = f >> 1;
      if (c.size[(axis + 1) % 3] === 0 || c.size[(axis + 2) % 3] === 0) continue;
      let name = SKIN_FACE[f];
      if (c.mirror && (f === 0 || f === 1)) name = SKIN_FACE[f ^ 1];
      const [rx, ry, rw, rh] = R[name];
      const uvAt = (cc) => {
        let s, t;
        switch (f) {
          case 0: s = 1 - cc[2]; t = 1 - cc[1]; break;
          case 1: s = cc[2]; t = 1 - cc[1]; break;
          case 2: s = 1 - cc[0]; t = 1 - cc[2]; break;
          case 3: s = 1 - cc[0]; t = cc[2]; break;
          case 4: s = cc[0]; t = 1 - cc[1]; break;
          default: s = 1 - cc[0]; t = 1 - cc[1];
        }
        if (c.mirror) s = 1 - s;
        return [rx + s * rw, ry + t * rh];
      };
      for (let k = 0; k < 4; k++) {
        const cc = FACE_CORNERS[f][k];
        const [u, v] = uvAt(cc);
        w.vertex(cc[0] ? to[0] : from[0], cc[1] ? to[1] : from[1], cc[2] ? to[2] : from[2], u, v, L, f, tint ? 1 : 0, tint);
      }
    }
  }
  return w.bytes();
}
