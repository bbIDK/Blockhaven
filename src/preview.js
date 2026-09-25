// The player in the inventory screen, drawn with the 2D canvas: the player model in orthographic
// view, turning to look at the mouse, in the player's own skin and whatever armour is equipped
// (the same skins the world draws everyone with; see tex/mobskins.js and avatars.js).
import { SKIN_INDEX, SKIN_SIZE } from './skins.js';
import { WEAR, ARMOR_UV } from './avatars.js';

// Parts in model units (1 unit = 1/16 block). The model faces +Z (towards the viewer); its right
// side is -X. Each part has its skin box and the second layer over it (hat, jacket, sleeves, trousers).
const PARTS = {
  head: { box: [-4, 24, -4, 4, 32, 4], pivot: [0, 24, 0], uv: [0, 0], over: [32, 0], grow: 0.5 },
  body: { box: [-4, 12, -2, 4, 24, 2], pivot: [0, 24, 0], uv: [16, 16], over: [16, 32] },
  rightArm: { box: [-8, 12, -2, -4, 24, 2], pivot: [-5, 22, 0], uv: [40, 16], over: [40, 32] },
  leftArm: { box: [4, 12, -2, 8, 24, 2], pivot: [5, 22, 0], uv: [32, 48], over: [48, 48] },
  rightLeg: { box: [-4, 0, -2, 0, 12, 2], pivot: [-2, 12, 0], uv: [0, 16], over: [0, 32] },
  leftLeg: { box: [0, 0, -2, 4, 12, 2], pivot: [2, 12, 0], uv: [16, 48], over: [0, 48] },
};

function canvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

// Texture rectangles [sx, sy, w, h] of a box's faces in the skin layout.
function regions(u, v, w, h, d) {
  return {
    top: [u + d, v, w, d], bottom: [u + d + w, v, w, d],
    right: [u, v + d, d, h], front: [u + d, v + d, w, h], left: [u + d + w, v + d, d, h], back: [u + 2 * d + w, v + d, w, h],
  };
}

// 3x3 rotation matrices (row-major).
function rotY(a) { const c = Math.cos(a), s = Math.sin(a); return [c, 0, s, 0, 1, 0, -s, 0, c]; }
function rotX(a) { const c = Math.cos(a), s = Math.sin(a); return [1, 0, 0, 0, c, -s, 0, s, c]; }
function rotZ(a) { const c = Math.cos(a), s = Math.sin(a); return [c, -s, 0, s, c, 0, 0, 0, 1]; }
function mul(a, b) {
  const o = new Array(9);
  for (let r = 0; r < 3; r++) for (let k = 0; k < 3; k++) o[r * 3 + k] = a[r * 3] * b[k] + a[r * 3 + 1] * b[3 + k] + a[r * 3 + 2] * b[6 + k];
  return o;
}
const apply = (m, p) => [m[0] * p[0] + m[1] * p[1] + m[2] * p[2], m[3] * p[0] + m[4] * p[1] + m[5] * p[2], m[6] * p[0] + m[7] * p[1] + m[8] * p[2]];

const LIGHT = (() => { const l = [-0.35, 0.55, 0.76], n = Math.hypot(...l); return l.map((v) => v / n); })();
const SHADES = 12;

export class PlayerPreview {
  // pixels(): every skin's RGBA pixels (the renderer's), or null before there are any.
  constructor(pixels) {
    this.pixels = pixels;
    this.skins = new Map();
    this.shaded = new Map();
  }

  skinFor(name) {
    let c = this.skins.get(name);
    if (!c) {
      const px = this.pixels(), idx = SKIN_INDEX[name];
      if (!px || idx === undefined) return null;
      c = canvas(SKIN_SIZE, SKIN_SIZE);
      const size = SKIN_SIZE * SKIN_SIZE * 4;
      c.getContext('2d').putImageData(new ImageData(new Uint8ClampedArray(px.buffer, px.byteOffset + idx * size, size).slice(), SKIN_SIZE, SKIN_SIZE), 0, 0);
      this.skins.set(name, c);
    }
    return c;
  }

  // The skin darkened to one of a few light levels, so faces can be shaded without darkening
  // whatever shows through their transparent parts.
  shadedSkin(key, level, hurt) {
    const k = `${key}|${level}|${hurt ? 1 : 0}`;
    let c = this.shaded.get(k);
    if (!c) {
      const src = this.skinFor(key);
      if (!src) return null;
      c = canvas(src.width, src.height);
      const g = c.getContext('2d');
      g.drawImage(src, 0, 0);
      g.globalCompositeOperation = 'source-atop';
      if (hurt) { g.fillStyle = 'rgba(255, 40, 30, 0.45)'; g.fillRect(0, 0, c.width, c.height); }
      g.fillStyle = `rgba(0, 0, 0, ${(1 - level / SHADES).toFixed(3)})`;
      g.fillRect(0, 0, c.width, c.height);
      this.shaded.set(k, c);
    }
    return c;
  }

  // Draws the player into `cv` (a canvas already sized in device pixels).
  // look: { x, y } is where the mouse is relative to the model's eyes, in model units.
  // skin: the player's skin. armor: [material or null] x4. time: seconds, for idle movement.
  draw(cv, { look = { x: 0, y: 0 }, skin = 'player_0', armor = [], time = 0, hurt = false } = {}) {
    const g = cv.getContext('2d');
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.clearRect(0, 0, cv.width, cv.height);
    g.imageSmoothingEnabled = false;
    // Like the original: the body turns a little towards the mouse, the head more.
    const f = Math.atan(look.x / 21), v = Math.atan(look.y / 21);
    const bodyYaw = f * 0.35, headYaw = f * 0.7, headPitch = -v * 0.35, tilt = v * 0.35;
    const view = mul(rotX(tilt), rotY(bodyYaw));
    const s = (cv.height * 0.84) / 32;
    const cx = cv.width / 2, cy = cv.height * 0.5;
    const project = (p) => {
      const q = apply(view, [p[0], p[1] - 16, p[2]]);
      return [cx + q[0] * s, cy - q[1] * s, q[2]];
    };
    const swing = Math.sin(time * 1.34) * 0.05, sway = Math.cos(time * 1.8) * 0.05 + 0.05;
    const poses = {
      head: mul(rotY(headYaw - bodyYaw), rotX(headPitch)),
      body: rotY(0),
      rightArm: mul(rotX(swing), rotZ(-sway)),
      leftArm: mul(rotX(-swing), rotZ(sway)),
      rightLeg: rotY(0),
      leftLeg: rotY(0),
    };
    // Everything to draw: each part, its second layer, then the armour over it (outermost last).
    const layers = [];
    for (const [name, part] of Object.entries(PARTS)) {
      const list = [{ key: skin, uv: part.uv, grow: 0 }, { key: skin, uv: part.over, grow: part.grow ?? 0.25 }];
      armor.forEach((mat, slot) => {
        const key = `armor_${mat}${WEAR[slot].skin}`;
        if (mat && WEAR[slot].bones.includes(name) && key in SKIN_INDEX) list.push({ key, uv: ARMOR_UV[name], grow: WEAR[slot].grow, mirror: name.startsWith('left') });
      });
      list.sort((a, b) => a.grow - b.grow);
      const rot = poses[name], pv = part.pivot;
      const place = (p) => { const q = apply(rot, [p[0] - pv[0], p[1] - pv[1], p[2] - pv[2]]); return project([q[0] + pv[0], q[1] + pv[1], q[2] + pv[2]]); };
      const b = part.box, mid = place([(b[0] + b[3]) / 2, (b[1] + b[4]) / 2, (b[2] + b[5]) / 2]);
      layers.push({ part, list, place, rot, depth: mid[2] });
    }
    layers.sort((a, b) => a.depth - b.depth);
    for (const { part, list, place, rot } of layers) {
      for (const layer of list) this.drawBox(g, part, layer, place, mul(view, rot), hurt);
    }
  }

  drawBox(g, part, layer, place, rot, hurt) {
    const [bx0, by0, bz0, bx1, by1, bz1] = part.box, e = layer.grow;
    const x0 = bx0 - e, y0 = by0 - e, z0 = bz0 - e, x1 = bx1 + e, y1 = by1 + e, z1 = bz1 + e;
    const w = bx1 - bx0, h = by1 - by0, d = bz1 - bz0;
    const r = regions(layer.uv[0], layer.uv[1], w, h, d);
    const m = layer.mirror;
    const faces = [
      [[0, 0, 1], [x0, y1, z1], [x1, y1, z1], [x0, y0, z1], r.front],
      [[0, 0, -1], [x1, y1, z0], [x0, y1, z0], [x1, y0, z0], r.back],
      [[-1, 0, 0], [x0, y1, z0], [x0, y1, z1], [x0, y0, z0], m ? r.left : r.right],
      [[1, 0, 0], [x1, y1, z1], [x1, y1, z0], [x1, y0, z1], m ? r.right : r.left],
      [[0, 1, 0], [x0, y1, z0], [x1, y1, z0], [x0, y1, z1], r.top],
      [[0, -1, 0], [x0, y0, z1], [x1, y0, z1], [x0, y0, z0], r.bottom],
    ];
    for (const [normal, tl0, tr0, bl0, rect] of faces) {
      const n = apply(rot, normal);
      if (n[2] <= 0.001) continue;
      const light = 0.5 + 0.5 * Math.max(0, n[0] * LIGHT[0] + n[1] * LIGHT[1] + n[2] * LIGHT[2]);
      const level = Math.max(1, Math.min(SHADES, Math.round(light * SHADES)));
      let tl = place(tl0), tr = place(tr0), bl = place(bl0);
      if (m) {
        // Mirrored limbs: the texture runs the other way across each face.
        const br = [tr[0] + bl[0] - tl[0], tr[1] + bl[1] - tl[1]];
        [tl, tr, bl] = [tr, tl, br];
      }
      const img = this.shadedSkin(layer.key, level, hurt);
      if (!img) continue;
      const [sx, sy, sw, sh] = rect;
      g.setTransform((tr[0] - tl[0]) / sw, (tr[1] - tl[1]) / sw, (bl[0] - tl[0]) / sh, (bl[1] - tl[1]) / sh, tl[0], tl[1]);
      // Drawn a hair larger than the face so neighbouring faces meet without seams.
      const pad = 0.06;
      g.drawImage(img, sx, sy, sw, sh, -pad, -pad, sw + pad * 2, sh + pad * 2);
    }
    g.setTransform(1, 0, 0, 1, 0, 0);
  }
}
