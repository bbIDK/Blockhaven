// Procedural 16x16 pixel art. Every block, item and creature texture is drawn from code (see the
// modules in tex/), so the game ships without any image assets. The textures become layers of
// WebGL texture arrays of up to 256 layers each (the most every WebGL 2 device supports).
import { defs, Tex } from './tex/core.js';
import './tex/terrain.js';
import './tex/village.js';
import './tex/items.js';
import './tex/entities.js';
import './tex/redstone.js';
import './tex/magic.js';
import './tex/decor.js';
import './tex/paintings.js';

export const ARRAY_LAYERS = 256;

// Lay the textures out so no run of layers that must stay together (a base and its overlay, the
// frames of an animation) is split between two arrays.
const order = [];
for (let i = 0; i < defs.length; i++) {
  const d = defs[i], n = d.group ?? 1;
  const at = order.length % ARRAY_LAYERS;
  if (n > 1 && at + n > ARRAY_LAYERS) while (order.length % ARRAY_LAYERS) order.push(null);
  order.push(d);
}

export const TEXTURE_NAMES = order.map((d, i) => d?.name ?? `_pad${i}`);
export const TEX = Object.fromEntries(TEXTURE_NAMES.map((n, i) => [n, i]));
if (new Set(TEXTURE_NAMES).size !== TEXTURE_NAMES.length) {
  const seen = new Set();
  throw new Error(`Texture defined twice: ${TEXTURE_NAMES.find((n) => (seen.has(n) ? true : (seen.add(n), false)))}`);
}
if (TEXTURE_NAMES.length > ARRAY_LAYERS * 4) throw new Error('Too many texture layers');

// Returns RGBA pixels for all layers (16*16*4 bytes per layer). Transparent pixels get the
// average opaque colour so mipmaps don't pick up dark fringes.
export function generateTextures() {
  const out = new Uint8Array(order.length * 1024);
  order.forEach((d, layer) => {
    if (!d) return;
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
