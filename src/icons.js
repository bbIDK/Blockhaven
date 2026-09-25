// Inventory icons, drawn once from the texture pixels: isometric cubes for blocks, flat sprites
// for plants and items. Returned as data URLs for <img> tags.
import { ITEMS } from './items.js';
import { RENDER, R, TEXL, FFLAGS, TINT, TINT_RGB, F_TINT, F_OVERLAY, SHAPE, ICON_SHAPE, spriteOf, boxLayer } from './blocks.js';

const S = 64;
const DEFAULT_GRASS = [124, 189, 84];
const DEFAULT_FOLIAGE = [96, 168, 64];
const DEFAULT_WATER = [88, 164, 255];

let pixels = null;
const cache = new Map();
// Icons are drawn on canvases kept in main memory: reading a picture back from the graphics card
// (toDataURL) would make the page wait for the frame being drawn.
const CPU = { willReadFrequently: true };

export function initIcons(texturePixels) { pixels = texturePixels; }

// Draws every icon ahead of time, a few at a time while the browser is idle, so that the first
// look in the inventory (hundreds of icons at once) doesn't stall the game.
export function warmIcons() {
  const ids = [...ITEMS.keys()].filter((id) => !cache.has(id)).reverse();
  const idle = globalThis.requestIdleCallback ?? ((fn) => setTimeout(() => fn({ timeRemaining: () => 6 }), 40));
  const step = (deadline) => {
    // (A few milliseconds' worth even when the page is never idle.)
    const end = performance.now() + Math.max(6, deadline.timeRemaining() - 1);
    while (ids.length && performance.now() < end) iconFor(ids.pop());
    if (ids.length) idle(step, { timeout: 250 });
  };
  idle(step, { timeout: 250 });
}

function layerImage(layer, tint, overlayTint, shade) {
  const d = new Uint8ClampedArray(1024);
  const src = pixels.subarray(layer * 1024, layer * 1024 + 1024);
  const ov = overlayTint ? pixels.subarray((layer + 1) * 1024, (layer + 2) * 1024) : null;
  for (let i = 0; i < 1024; i += 4) {
    let r = src[i], g = src[i + 1], b = src[i + 2];
    if (tint) { r = (r * tint[0]) / 255; g = (g * tint[1]) / 255; b = (b * tint[2]) / 255; }
    if (ov && ov[i + 3] > 0) {
      const a = ov[i + 3] / 255;
      r = r * (1 - a) + ((ov[i] * overlayTint[0]) / 255) * a;
      g = g * (1 - a) + ((ov[i + 1] * overlayTint[1]) / 255) * a;
      b = b * (1 - a) + ((ov[i + 2] * overlayTint[2]) / 255) * a;
    }
    d[i] = r * shade; d[i + 1] = g * shade; d[i + 2] = b * shade;
    d[i + 3] = ov ? 255 : src[i + 3];
  }
  const c = document.createElement('canvas');
  c.width = c.height = 16;
  c.getContext('2d', CPU).putImageData(new ImageData(d, 16, 16), 0, 0);
  return c;
}

function tintOf(block) {
  const t = TINT[block];
  if (t === 1) return DEFAULT_GRASS;
  if (t === 2) return DEFAULT_FOLIAGE;
  if (t === 3) return [...TINT_RGB.subarray(block * 3, block * 3 + 3)];
  if (t === 4) return DEFAULT_WATER;
  return null;
}

function faceImage(block, f, shade) {
  const layer = TEXL[block * 6 + f], flags = FFLAGS[block * 6 + f];
  const tint = tintOf(block);
  return layerImage(layer, flags & F_TINT ? tint : null, flags & F_OVERLAY ? tint : null, shade);
}

function drawCube(ctx, block) {
  const k = S / 48;
  const faces = [
    [2, 1.0, [21 / 16, 11 / 16, -21 / 16, 11 / 16, 24, 2]],
    [4, 0.78, [21 / 16, 11 / 16, 0, 22 / 16, 3, 13]],
    [0, 0.6, [21 / 16, -11 / 16, 0, 22 / 16, 24, 24]],
  ];
  for (const [f, shade, m] of faces) {
    ctx.setTransform(m[0] * k, m[1] * k, m[2] * k, m[3] * k, m[4] * k, m[5] * k);
    ctx.drawImage(faceImage(block, f, shade), 0, 0, 16.2, 16.2);
  }
  ctx.setTransform(1, 0, 0, 1, 0, 0);
}

// Isometric boxes (1/16 units), drawn far-to-near. Same projection as drawCube.
function drawBoxes(ctx, block, boxes) {
  const k = S / 48;
  const sorted = [...boxes].sort((a, b) => a[1] - b[1] || (a[0] + a[2]) - (b[0] + b[2]));
  const blockFaces = [0, 2, 4].map((f) => faceImage(block, f, f === 2 ? 1 : f === 4 ? 0.78 : 0.6));
  const own = new Map();
  const boxFace = (b, f, shade) => {
    const layer = boxLayer(block, b, f), key = layer * 8 + f;
    if (!own.has(key)) own.set(key, layerImage(layer, null, null, shade));
    return own.get(key);
  };
  for (const b of sorted) {
    const faces = b.length > 6 ? [boxFace(b, 0, 0.6), boxFace(b, 2, 1), boxFace(b, 4, 0.78)] : blockFaces;
    const [x0, y0, z0, x1, y1, z1] = b.slice(0, 6).map((v) => v / 16);
    // top (+Y): u = x, v = z
    ctx.setTransform(21 / 16 * k, 11 / 16 * k, -21 / 16 * k, 11 / 16 * k, 24 * k, (2 + 22 * (1 - y1)) * k);
    ctx.drawImage(faces[1], x0 * 16, z0 * 16, (x1 - x0) * 16, (z1 - z0) * 16, x0 * 16, z0 * 16, (x1 - x0) * 16 + 0.2, (z1 - z0) * 16 + 0.2);
    // south (+Z): u = x, v = 1 - y
    ctx.setTransform(21 / 16 * k, 11 / 16 * k, 0, 22 / 16 * k, (24 - 21 * z1) * k, (2 + 11 * z1) * k);
    ctx.drawImage(faces[2], x0 * 16, (1 - y1) * 16, (x1 - x0) * 16, (y1 - y0) * 16, x0 * 16, (1 - y1) * 16, (x1 - x0) * 16 + 0.2, (y1 - y0) * 16 + 0.2);
    // east (+X): u = 1 - z, v = 1 - y
    ctx.setTransform(21 / 16 * k, -11 / 16 * k, 0, 22 / 16 * k, (3 + 21 * x1) * k, (13 + 11 * x1) * k);
    ctx.drawImage(faces[0], (1 - z1) * 16, (1 - y1) * 16, (z1 - z0) * 16, (y1 - y0) * 16, (1 - z1) * 16, (1 - y1) * 16, (z1 - z0) * 16 + 0.2, (y1 - y0) * 16 + 0.2);
  }
  ctx.setTransform(1, 0, 0, 1, 0, 0);
}


export function iconFor(id) {
  if (cache.has(id)) return cache.get(id);
  const def = ITEMS.get(id);
  if (!def || !pixels) return '';
  const c = document.createElement('canvas');
  c.width = c.height = S;
  const ctx = c.getContext('2d', CPU);
  ctx.imageSmoothingEnabled = false;
  const block = def.block;
  const sprite = block !== null ? spriteOf(block) : -1;
  if (block !== null && sprite < 0 && (RENDER[block] === R.CUBE || RENDER[block] === R.CACTUS || RENDER[block] === R.LIQUID)) {
    drawCube(ctx, block);
  } else if (block !== null && sprite < 0 && RENDER[block] === R.MODEL) {
    drawBoxes(ctx, block, ICON_SHAPE[block] ?? SHAPE[block]);
  } else {
    const layer = sprite >= 0 ? sprite : block !== null ? TEXL[block * 6] : def.tex;
    const tint = block !== null ? (FFLAGS[block * 6] & F_TINT ? tintOf(block) : null) : def.tint;
    ctx.drawImage(layerImage(layer, tint, null, 1), 4, 4, S - 8, S - 8);
  }
  const url = c.toDataURL();
  cache.set(id, url);
  return url;
}
