// Inventory icons, drawn once from the texture pixels: isometric cubes for blocks, flat sprites
// for plants and items. Returned as data URLs for <img> tags.
import { ITEMS } from './items.js';
import { RENDER, R, TEXL, FFLAGS, TINT, TINT_RGB, F_TINT, F_OVERLAY } from './blocks.js';

const S = 64;
const DEFAULT_GRASS = [124, 189, 84];
const DEFAULT_FOLIAGE = [96, 168, 64];

let pixels = null;
const cache = new Map();

export function initIcons(texturePixels) { pixels = texturePixels; }

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
  c.getContext('2d').putImageData(new ImageData(d, 16, 16), 0, 0);
  return c;
}

function tintOf(block) {
  const t = TINT[block];
  if (t === 1) return DEFAULT_GRASS;
  if (t === 2) return DEFAULT_FOLIAGE;
  if (t === 3) return [...TINT_RGB.subarray(block * 3, block * 3 + 3)];
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

export function iconFor(id) {
  if (cache.has(id)) return cache.get(id);
  const def = ITEMS.get(id);
  if (!def || !pixels) return '';
  const c = document.createElement('canvas');
  c.width = c.height = S;
  const ctx = c.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  const block = def.block;
  if (block !== null && (RENDER[block] === R.CUBE || RENDER[block] === R.CACTUS || RENDER[block] === R.LIQUID)) {
    drawCube(ctx, block);
  } else {
    const layer = block !== null ? TEXL[block * 6] : def.tex;
    const tint = block !== null && FFLAGS[block * 6] & F_TINT ? tintOf(block) : null;
    ctx.drawImage(layerImage(layer, tint, null, 1), 4, 4, S - 8, S - 8);
  }
  const url = c.toDataURL();
  cache.set(id, url);
  return url;
}
