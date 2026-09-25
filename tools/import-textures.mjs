#!/usr/bin/env node
// Imports the game's textures from openly licensed Minecraft-style resource packs into
// assets/textures (one 16x16 PNG per texture, named after it; tools/texture-sources.mjs) and
// assets/skins (64x64 creature skins; tools/skin-sources.mjs). Textures and skins with no source
// there keep being drawn from code (src/tex/). Then run tools/pack-textures.mjs to build them into
// the game.
//
//   node tools/import-textures.mjs <Pixel Perfection CE checkout> <Mineclonia checkout>
//
// Pixel Perfection CE: https://github.com/Athemis/PixelPerfectionCE (CC BY-SA 4.0)
// Mineclonia: https://codeberg.org/mineclonia/mineclonia (textures CC BY-SA 4.0 / 3.0)
import { readFileSync, writeFileSync, mkdirSync, readdirSync, rmSync, existsSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { decodePNG, encodePNG } from './png.mjs';
import { SOURCES } from './texture-sources.mjs';
import { SKIN_SOURCES } from './skin-sources.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const [ppDir, mclDir] = process.argv.slice(2).map((p) => resolve(p));
if (!ppDir || !mclDir) throw new Error('usage: node tools/import-textures.mjs <PixelPerfectionCE dir> <mineclonia dir>');

// ---------------------------------------------------------------- pictures
class Img {
  constructor(w, h, d = new Uint8Array(w * h * 4)) { this.w = w; this.h = h; this.d = d; }
  i(x, y) { return (y * this.w + x) * 4; }
  px(x, y) { const i = this.i(x, y); return [this.d[i], this.d[i + 1], this.d[i + 2], this.d[i + 3]]; }
  put(x, y, p) { if (x < 0 || y < 0 || x >= this.w || y >= this.h) return; this.d.set(p, this.i(x, y)); }
}
const cache = new Map(), used = new Set();
// 'block/stone' (Pixel Perfection) or 'mcl:mods/ITEMS/.../x.png' (Mineclonia).
export function load(ref) {
  used.add(ref);
  if (!cache.has(ref)) {
    const file = ref.startsWith('mcl:') ? join(mclDir, ref.slice(4)) : join(ppDir, 'assets/minecraft/textures', `${ref}.png`);
    const { width, height, data } = decodePNG(readFileSync(file));
    cache.set(ref, new Img(width, height, data));
  }
  return cache.get(ref);
}
const blank = (w = 16, h = 16) => new Img(w, h);
function crop(img, x, y, w, h) {
  const out = blank(w, h);
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) out.put(i, j, img.px(x + i, y + j));
  return out;
}
// The k-th square frame of an animation strip.
const frame = (img, k = 0) => crop(img, 0, k * img.w, img.w, img.w);
// Draws `src` over `dst` at (x, y), keeping what's under see-through pixels.
function paste(dst, src, x = 0, y = 0) {
  for (let j = 0; j < src.h; j++) for (let i = 0; i < src.w; i++) {
    const p = src.px(i, j);
    if (p[3]) dst.put(x + i, y + j, p);
  }
  return dst;
}
// Blends `src` over `dst` at (x, y), weighing each pixel by its alpha (so the soft edges of an
// ore drawn over stone mix into the stone rather than punching holes in it).
function over(dst, src, x = 0, y = 0) {
  for (let j = 0; j < src.h; j++) for (let i = 0; i < src.w; i++) {
    const p = src.px(i, j), q = dst.px(x + i, y + j), a = p[3] / 255, b = (q[3] / 255) * (1 - a), out = a + b;
    if (!out) continue;
    dst.put(x + i, y + j, [0, 1, 2].map((k) => Math.round((p[k] * a + q[k] * b) / out)).concat(Math.round(out * 255)));
  }
  return dst;
}
// Quarter turns clockwise.
function rot(img, turns = 1) {
  let cur = img;
  for (let t = 0; t < ((turns % 4) + 4) % 4; t++) {
    const out = blank(cur.h, cur.w);
    for (let y = 0; y < cur.h; y++) for (let x = 0; x < cur.w; x++) out.put(cur.h - 1 - y, x, cur.px(x, y));
    cur = out;
  }
  return cur;
}
function flipX(img) { const out = blank(img.w, img.h); for (let y = 0; y < img.h; y++) for (let x = 0; x < img.w; x++) out.put(img.w - 1 - x, y, img.px(x, y)); return out; }
function flipY(img) { const out = blank(img.w, img.h); for (let y = 0; y < img.h; y++) for (let x = 0; x < img.w; x++) out.put(x, img.h - 1 - y, img.px(x, y)); return out; }
// Nearest-neighbour scaling by a whole factor (for 8x8 particles).
function scale(img, k) {
  const out = blank(img.w * k, img.h * k);
  for (let y = 0; y < out.h; y++) for (let x = 0; x < out.w; x++) out.put(x, y, img.px(Math.floor(x / k), Math.floor(y / k)));
  return out;
}
// Halves a picture by picking every other pixel (for 32x textures).
function half(img) {
  const out = blank(img.w >> 1, img.h >> 1);
  for (let y = 0; y < out.h; y++) for (let x = 0; x < out.w; x++) out.put(x, y, img.px(x * 2, y * 2));
  return out;
}
// Grey, scaled so its opaque pixels average `mean` (0-1): a base for the game's colour tints.
function gray(img, mean) {
  const out = blank(img.w, img.h);
  let sum = 0, n = 0;
  const lum = [];
  for (let y = 0; y < img.h; y++) for (let x = 0; x < img.w; x++) {
    const [r, g, b, a] = img.px(x, y), l = 0.299 * r + 0.587 * g + 0.114 * b;
    lum.push(l);
    if (a) { sum += l; n++; }
  }
  const k = n ? (mean * 255) / (sum / n) : 1;
  for (let y = 0; y < img.h; y++) for (let x = 0; x < img.w; x++) {
    const a = img.px(x, y)[3], v = Math.min(255, Math.round(lum[y * img.w + x] * k));
    out.put(x, y, [v, v, v, a]);
  }
  return out;
}
// Multiplies by a colour.
function tint(img, [r, g, b]) {
  const out = blank(img.w, img.h);
  for (let y = 0; y < img.h; y++) for (let x = 0; x < img.w; x++) {
    const p = img.px(x, y);
    out.put(x, y, [Math.round((p[0] * r) / 255), Math.round((p[1] * g) / 255), Math.round((p[2] * b) / 255), p[3]]);
  }
  return out;
}
// Recolours the pixels `test(r, g, b)` picks out to a ramp of colours (dark to light), keeping
// their order of lightness.
function remap(img, test, ramp) {
  const lum = ([r, g, b]) => 0.299 * r + 0.587 * g + 0.114 * b, picked = new Map();
  for (let y = 0; y < img.h; y++) for (let x = 0; x < img.w; x++) {
    const p = img.px(x, y);
    if (p[3] && test(p[0], p[1], p[2])) picked.set(p.slice(0, 3).join(), p);
  }
  const sorted = [...picked.values()].sort((a, b) => lum(a) - lum(b));
  const to = new Map(sorted.map((p, i) => {
    const c = ramp[Math.round((i * (ramp.length - 1)) / Math.max(1, sorted.length - 1))];
    return [p.slice(0, 3).join(), [(c >> 16) & 255, (c >> 8) & 255, c & 255]];
  }));
  const out = blank(img.w, img.h);
  for (let y = 0; y < img.h; y++) for (let x = 0; x < img.w; x++) {
    const p = img.px(x, y), c = p[3] ? to.get(p.slice(0, 3).join()) : null;
    out.put(x, y, c ? [...c, p[3]] : p);
  }
  return out;
}
// Repeats a picture to fill w x h.
function tile(img, w = 16, h = 16) {
  const out = blank(w, h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) out.put(x, y, img.px(x % img.w, y % img.h));
  return out;
}
export const H = { load, blank, crop, frame, paste, over, rot, flipX, flipY, scale, half, gray, tint, remap, tile };

// A source: a picture ref (its first frame if it's a strip), or a function of the helpers.
function build(src) {
  const img = typeof src === 'function' ? src(H) : frame(load(src), 0);
  if (img.w !== 16 || img.h !== 16) throw new Error(`not 16x16 (${img.w}x${img.h})`);
  return img;
}

// ---------------------------------------------------------------- run
const { TEXTURE_NAMES } = await import('../src/textures.js');
const names = TEXTURE_NAMES.filter((n) => !n.startsWith('_pad'));
const outDir = join(root, 'assets', 'textures');
if (existsSync(outDir)) for (const f of readdirSync(outDir)) if (f.endsWith('.png')) rmSync(join(outDir, f));
mkdirSync(outDir, { recursive: true });
const credits = { pp: [], mcl: [] }, missing = [], rows = [];
// Where a picture came from, for the credits.
const describe = (refs) => [...refs].map((r) => (r.startsWith('mcl:') ? `Mineclonia ${r.slice(4)}` : `Pixel Perfection CE ${r}.png`)).join('; ');
for (const name of names) {
  let src = SOURCES[name];
  if (src === undefined) {
    for (const sub of ['block', 'item']) if (existsSync(join(ppDir, 'assets/minecraft/textures', sub, `${name}.png`))) { src = `${sub}/${name}`; break; }
  }
  if (src === undefined || src === null) { missing.push(name); continue; }
  let img;
  used.clear();
  try { img = build(src); } catch (e) { throw new Error(`${name}: ${e.message}`); }
  writeFileSync(join(outDir, `${name}.png`), encodePNG(16, 16, img.d));
  rows.push([`textures/${name}.png`, describe(used), typeof src === 'function' || load(src).h !== 16]);
  const from = typeof src === 'string' && src.startsWith('mcl:') ? 'mcl' : 'pp';
  credits[from].push(name);
}
console.log(`assets/textures: ${names.length - missing.length} imported (${credits.pp.length} Pixel Perfection, ${credits.mcl.length} Mineclonia); drawn in code: ${missing.length}`);
console.log(missing.join(' '));

// ---------------------------------------------------------------- creature skins
await import('../src/tex/mobskins.js');
await import('../src/tex/wildskins.js');
const { SKIN_INDEX } = await import('../src/skins.js');
const skinDir = join(root, 'assets', 'skins');
if (existsSync(skinDir)) for (const f of readdirSync(skinDir)) if (f.endsWith('.png')) rmSync(join(skinDir, f));
mkdirSync(skinDir, { recursive: true });
for (const [name, fn] of Object.entries(SKIN_SOURCES)) {
  if (!(name in SKIN_INDEX)) throw new Error(`no skin called ${name}`);
  used.clear();
  const img = fn(H);
  if (img.w !== 64 || img.h !== 64) throw new Error(`skin ${name}: not 64x64`);
  writeFileSync(join(skinDir, `${name}.png`), encodePNG(64, 64, img.d));
  rows.push([`skins/${name}.png`, describe(used), true]);
}

// ---------------------------------------------------------------- credits
writeFileSync(join(root, 'assets', 'CREDITS.md'), `# Texture credits

The game's block, item and creature textures (\`textures/\` and \`skins/\` here) come from two openly licensed
Minecraft-style resource packs, and are shared under the same licence as them: Creative Commons
Attribution-ShareAlike 4.0 ([CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/)).

- **Pixel Perfection** by XSSheep (Hugh Rutland), <https://www.planetminecraft.com/texture-pack/131pixel-perfection/>,
  as updated in its Community Edition, <https://github.com/Athemis/PixelPerfectionCE>, by StonePendant,
  freejusticehere, Stingraych, Nova_Wostra and lazerl0rd.
- **Mineclonia**, <https://codeberg.org/mineclonia/mineclonia>, for the blocks newer than that edition (deepslate,
  copper, raw ores, calcite and cherry wood). Its textures are based on Pixel Perfection and on Pixel Perfection
  Legacy by Nova_Wostra; the ones used here come from the mods by NO11 (deepslate, copper, raw ores), PrairieWind,
  Wbjitscool, SmokeyDope and cora (cherry blossom) and Emojiminetest and kay27 (calcite).

\`tools/import-textures.mjs\` imports them, following \`tools/texture-sources.mjs\` and \`tools/skin-sources.mjs\`.
Those marked *changed* below were changed to fit the game: cut out of Minecraft's model sheets into the game's
block faces (chests, beds, lanterns, bells, campfires, levers, flower pots) and creature skins, recoloured (the
bed icon red, leather dyed brown, potions tinted, grey bases for the dye colours and water), turned, cropped, or
doubled in size (the particles). Anything not listed is drawn by the game's own code.

| File | Made from | |
| --- | --- | --- |
${rows.map(([f, from, changed]) => `| \`${f}\` | ${from} | ${changed ? 'changed' : ''} |`).join('\n')}
`);
console.log('assets/CREDITS.md written');
console.log(`assets/skins: ${Object.keys(SKIN_SOURCES).length} imported; drawn in code: ${Object.keys(SKIN_INDEX).filter((n) => !(n in SKIN_SOURCES)).length}`);
