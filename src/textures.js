// The game's 16x16 textures. Most come from openly licensed Minecraft-style resource packs (Pixel
// Perfection and Mineclonia, CC BY-SA 4.0; see assets/textures), packed into tex/packdata.js;
// the rest are drawn from code (the modules in tex/, which also draw every texture as a fallback).
// The textures become layers of WebGL texture arrays of up to 256 layers each (the most every
// WebGL 2 device supports).
import { defs, Tex } from './tex/core.js';
import { PACK } from './tex/packdata.js';
import './tex/terrain.js';
import './tex/village.js';
import './tex/items.js';
import './tex/tools.js';
import './tex/food.js';
import './tex/materials.js';
import './tex/gear.js';
import './tex/doors.js';
import './tex/blockitems.js';
import './tex/entities.js';
import './tex/redstone.js';
import './tex/magic.js';
import './tex/decor.js';
import './tex/paintings.js';
import './tex/rails.js';
import './tex/caves.js';
import './tex/sea.js';
import './tex/wild.js';
import './tex/eggs.js';

export const ARRAY_LAYERS = 256;

// Graphics: Fast draws leaves solid, as Minecraft does: each kind of leaves has a second picture
// with the gaps between the leaves filled in, dark (see the mesher).
for (const d of [...defs]) if (d.name.endsWith('_leaves')) defs.push({ name: `${d.name}_fast`, solidOf: d, group: 1 });

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
    const src = d.solidOf ?? d, t = new Tex(src.name);
    if (PACK[src.name]) unpack(PACK[src.name], t.d);
    else src.draw(t);
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
    // (The solid leaves: the gaps a darker shade of the leaves, and nothing see-through.)
    if (d.solidOf) {
      for (let i = 0; i < 1024; i += 4) {
        if (t.d[i + 3] < 128) { t.d[i] = r * 0.42; t.d[i + 1] = g * 0.42; t.d[i + 2] = b * 0.42; }
        t.d[i + 3] = 255;
      }
    }
    out.set(t.d, layer * 1024);
  });
  return out;
}

// A packed picture (see tools/pack-textures.mjs): its palette, then an index per pixel.
function unpack(b64, d) {
  const bin = atob(b64), n = bin.charCodeAt(0) + 1, at = 1 + n * 4;
  for (let i = 0; i < 256; i++) {
    const k = n <= 16 ? (bin.charCodeAt(at + (i >> 1)) >> (i & 1 ? 0 : 4)) & 15 : bin.charCodeAt(at + i);
    for (let c = 0; c < 4; c++) d[i * 4 + c] = bin.charCodeAt(1 + k * 4 + c);
  }
}
