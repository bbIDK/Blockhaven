// The player in the inventory screen, drawn with the 2D canvas: a figure with Minecraft's
// proportions (8x8x8 head, 8x12x4 body, 4x12x4 arms and legs) in orthographic view, turning to
// look at the mouse and wearing whatever armor is equipped. Skins use the classic 64x32 layout.
import { mulberry32 } from './math.js';

// Parts in model units (1 unit = 1/16 block). The model faces +Z (towards the viewer); its right
// side is -X. uv: texture offset in the skin; mirror: the left limbs reuse the right ones' skin.
const PARTS = {
  head: { box: [-4, 24, -4, 4, 32, 4], uv: [0, 0], pivot: [0, 24, 0] },
  body: { box: [-4, 12, -2, 4, 24, 2], uv: [16, 16], pivot: [0, 24, 0] },
  rightArm: { box: [-8, 12, -2, -4, 24, 2], uv: [40, 16], pivot: [-5, 22, 0] },
  leftArm: { box: [4, 12, -2, 8, 24, 2], uv: [40, 16], pivot: [5, 22, 0], mirror: true },
  rightLeg: { box: [-4, 0, -2, 0, 12, 2], uv: [0, 16], pivot: [-2, 12, 0] },
  leftLeg: { box: [0, 0, -2, 4, 12, 2], uv: [0, 16], pivot: [2, 12, 0], mirror: true },
};
// Which parts each armor piece covers, and how far it stands out from them.
const ARMOR_PARTS = [
  { parts: ['head'], grow: 1 },
  { parts: ['body', 'rightArm', 'leftArm'], grow: 1 },
  { parts: ['body', 'rightLeg', 'leftLeg'], grow: 0.5 },
  { parts: ['rightLeg', 'leftLeg'], grow: 1 },
];
const ARMOR_COLORS = {
  leather: [0x2c1a0c, 0x6a4020, 0x8c5a30, 0xa66e3c, 0xc48a58],
  iron: [0x3a3a3a, 0x8a8a8a, 0xbcbcbc, 0xdedede, 0xffffff],
  golden: [0x5a3e06, 0xc48d0f, 0xeab62a, 0xf7d65a, 0xfff5b0],
  diamond: [0x0c3a3e, 0x1f8f95, 0x33c3cb, 0x71e6ea, 0xd2fdff],
};

const hex = (c) => `#${c.toString(16).padStart(6, '0')}`;

function canvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

// Texture rectangles [sx, sy, w, h] of a box's faces in the classic skin layout.
function regions(u, v, w, h, d) {
  return {
    top: [u + d, v, w, d], bottom: [u + d + w, v, w, d],
    right: [u, v + d, d, h], front: [u + d, v + d, w, h], left: [u + d + w, v + d, d, h], back: [u + 2 * d + w, v + d, w, h],
  };
}

function paint(g, rect, pick) {
  const [x0, y0, w, h] = rect;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const c = pick(x, y, w, h);
    if (c === null) continue;
    g.fillStyle = hex(c);
    g.fillRect(x0 + x, y0 + y, 1, 1);
  }
}

// The player's skin, drawn from code: brown hair, a teal shirt (matching the arm you see in first
// person), dark jeans and grey shoes.
function makeSkin() {
  const c = canvas(64, 32), g = c.getContext('2d'), rnd = mulberry32(7);
  const from = (pal) => pal[Math.floor(rnd() * pal.length)];
  const SKIN = [0xc68e6a, 0xcf9874, 0xd6a07c], HAIR = [0x3b2414, 0x46291a, 0x33200f];
  const SHIRT = [0x2f7d8c, 0x348a9a, 0x3a96a6], PANTS = [0x2e3a66, 0x34427a, 0x2a3560], SHOES = [0x4a4a4a, 0x3e3e3e];
  const head = regions(0, 0, 8, 8, 8);
  paint(g, head.top, () => from(HAIR));
  paint(g, head.bottom, () => from(SKIN));
  paint(g, head.back, (x, y) => (y < 6 || (y === 6 && rnd() < 0.5) ? from(HAIR) : from(SKIN)));
  for (const side of [head.right, head.left]) paint(g, side, (x, y) => (y < 2 || (y < 4 && (x < 5 || rnd() < 0.3)) ? from(HAIR) : from(SKIN)));
  paint(g, head.front, (x, y) => {
    if (y < 2 || (y === 2 && (x === 0 || x === 7 || x === 3))) return from(HAIR);
    if (y === 4 && (x === 1 || x === 6)) return 0xf4f4f4;
    if (y === 4 && (x === 2 || x === 5)) return 0x3a2a60;
    if (y === 3 && x > 0 && x < 7 && x !== 3 && x !== 4) return 0x7a5238; // brows
    if (y === 5 && (x === 3 || x === 4)) return 0xb07a58;
    if (y === 6 && x > 1 && x < 6) return x === 2 || x === 5 ? 0x9a6448 : 0x6e3c2c;
    return from(SKIN);
  });
  const body = regions(16, 16, 8, 12, 4);
  for (const [name, r] of Object.entries(body)) {
    paint(g, r, (x, y) => {
      if (name === 'front' && y === 0 && x > 2 && x < 5) return from(SKIN);
      if (y === 11 && name !== 'top' && name !== 'bottom') return 0x2a2a2a; // belt
      return name === 'bottom' ? from(PANTS) : from(SHIRT);
    });
  }
  const arm = regions(40, 16, 4, 12, 4);
  for (const [name, r] of Object.entries(arm)) {
    paint(g, r, (x, y) => (name === 'top' || (name !== 'bottom' && y < 4) ? (y === 3 && name !== 'top' ? 0x276a78 : from(SHIRT)) : from(SKIN)));
  }
  const leg = regions(0, 16, 4, 12, 4);
  for (const [name, r] of Object.entries(leg)) {
    paint(g, r, (x, y) => (name === 'bottom' || (name !== 'top' && y >= 10) ? from(SHOES) : from(PANTS)));
  }
  return c;
}

// Armor "skins" in the same layout. Pieces: 0 helmet, 1 chestplate, 2 leggings, 3 boots.
function makeArmorSkin(material, piece) {
  const c = canvas(64, 32), g = c.getContext('2d'), rnd = mulberry32(31 + piece);
  const pal = ARMOR_COLORS[material];
  const metal = (x, y, w, h) => {
    if (y === 0 || x === 0) return pal[3];
    if (y === h - 1 || x === w - 1) return pal[1];
    return rnd() < 0.18 ? pal[material === 'leather' ? 1 : 3] : pal[2];
  };
  const body = (name) => name !== 'top' && name !== 'bottom';
  if (piece === 0) {
    const head = regions(0, 0, 8, 8, 8);
    for (const [name, r] of Object.entries(head)) {
      if (name === 'bottom') continue;
      paint(g, r, (x, y, w, h) => {
        if (name === 'front' && y >= 3 && x > 0 && x < 7) return null; // open face
        if (name !== 'top' && name !== 'back' && y >= 6) return null;
        return metal(x, y, w, h);
      });
    }
  } else if (piece === 1) {
    for (const [name, r] of Object.entries(regions(16, 16, 8, 12, 4))) {
      if (name === 'bottom') continue;
      paint(g, r, (x, y, w, h) => (body(name) && y > 9 ? null : metal(x, y, w, h)));
    }
    for (const [name, r] of Object.entries(regions(40, 16, 4, 12, 4))) {
      if (name === 'bottom') continue;
      paint(g, r, (x, y, w, h) => (body(name) && y > 4 ? null : metal(x, y, w, h)));
    }
  } else if (piece === 2) {
    for (const [name, r] of Object.entries(regions(16, 16, 8, 12, 4))) {
      if (!body(name)) continue;
      paint(g, r, (x, y, w, h) => (y < 9 ? null : metal(x, y, w, h)));
    }
    for (const [name, r] of Object.entries(regions(0, 16, 4, 12, 4))) {
      if (name === 'bottom') continue;
      paint(g, r, (x, y, w, h) => (body(name) && y > 8 ? null : metal(x, y, w, h)));
    }
  } else {
    for (const [name, r] of Object.entries(regions(0, 16, 4, 12, 4))) {
      if (name === 'top') continue;
      paint(g, r, (x, y, w, h) => (body(name) && y < 8 ? null : metal(x, y, w, h)));
    }
  }
  return c;
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
  constructor() {
    this.skin = null;
    this.armorSkins = new Map();
    this.shaded = new Map();
  }

  skinFor(key) {
    if (key === 'player') return (this.skin ??= makeSkin());
    if (!this.armorSkins.has(key)) {
      const [material, piece] = key.split(':');
      this.armorSkins.set(key, makeArmorSkin(material, Number(piece)));
    }
    return this.armorSkins.get(key);
  }

  // The skin darkened to one of a few light levels, so faces can be shaded without darkening
  // whatever shows through their transparent parts.
  shadedSkin(key, level, hurt) {
    const k = `${key}|${level}|${hurt ? 1 : 0}`;
    let c = this.shaded.get(k);
    if (!c) {
      const src = this.skinFor(key);
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
  // armor: [material or null] x4. time: seconds, for idle movement.
  draw(cv, { look = { x: 0, y: 0 }, armor = [], time = 0, hurt = false } = {}) {
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
    // Everything to draw: each part, then the armor layers over it (outermost last).
    const layers = [];
    for (const [name, part] of Object.entries(PARTS)) {
      const list = [{ key: 'player', grow: 0 }];
      [2, 3, 0, 1].forEach((piece) => {
        const mat = armor[piece];
        if (mat && ARMOR_PARTS[piece].parts.includes(name)) list.push({ key: `${mat}:${piece}`, grow: ARMOR_PARTS[piece].grow });
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
    const r = regions(part.uv[0], part.uv[1], w, h, d);
    const m = part.mirror;
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
      const [sx, sy, sw, sh] = rect;
      g.setTransform((tr[0] - tl[0]) / sw, (tr[1] - tl[1]) / sw, (bl[0] - tl[0]) / sh, (bl[1] - tl[1]) / sh, tl[0], tl[1]);
      // Drawn a hair larger than the face so neighbouring faces meet without seams.
      const pad = 0.06;
      g.drawImage(this.shadedSkin(layer.key, level, hurt), sx, sy, sw, sh, -pad, -pad, sw + pad * 2, sh + pad * 2);
    }
    g.setTransform(1, 0, 0, 1, 0, 0);
  }
}
