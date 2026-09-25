// Where the creature skins come from (see tools/import-textures.mjs): Pixel Perfection's entity
// textures, cut into the game's 64 x 64 skin layout (skins.js). Both lay out a box the Minecraft
// way (its top and bottom above, then its right, front, left and back sides), so a box that is the
// same in both models is copied straight across. Minecraft stands a four-legged creature's body up
// and then turns it over onto its front, where the game's models lie it along the creature; those
// are remapped face by face (rotBox). Skins not listed here are drawn in code (among them the iron
// golem and the enderman, which Pixel Perfection reimagines as a lava-veined statue and a totem).
import { TROPICAL, FISH_COLOURS } from '../src/tropical.js';

// The six faces of a box in a skin: [x, y, w, h] each.
const faces = (u, v, [w, h, d]) => ({
  top: [u + d, v, w, d], bottom: [u + d + w, v, w, d],
  right: [u, v + d, d, h], front: [u + d, v + d, w, h], left: [u + d + w, v + d, d, h], back: [u + 2 * d + w, v + d, w, h],
});

// Copies a box from `src` at mcUV (its size mcDims) to `dst` at uv (size dims), face by face; where
// the sizes differ, each face keeps its top rows (or its bottom ones, `bottom`) and left columns.
function box(H, dst, src, uv, dims, mcUV = uv, mcDims = dims, { bottom = false } = {}) {
  const to = faces(uv[0], uv[1], dims), from = faces(mcUV[0], mcUV[1], mcDims);
  for (const f of Object.keys(to)) {
    const [x, y, w, h] = to[f], [sx, sy, sw, sh] = from[f];
    const cw = Math.min(w, sw), ch = Math.min(h, sh);
    H.paste(dst, H.crop(src, sx, bottom && f !== 'top' && f !== 'bottom' ? sy + sh - ch : sy, cw, ch), x, bottom && f !== 'top' && f !== 'bottom' ? y + h - ch : y);
  }
}
// Minecraft's body box (W wide, D tall, H deep in its own terms) turned onto its front becomes the
// game's box W wide, H tall and D long: its back is the top, its top the front, its front the
// underside, its bottom the rear, and its sides turn a quarter.
function rotBox(H, dst, src, uv, [W, Ht, D], mcUV) {
  const to = faces(uv[0], uv[1], [W, Ht, D]), from = faces(mcUV[0], mcUV[1], [W, D, Ht]);
  const put = (face, fn) => {
    const [x, y, w, h] = to[face];
    for (let R = 0; R < h; R++) for (let C = 0; C < w; C++) {
      const [sx, sy] = fn(C, R);
      dst.put(x + C, y + R, src.px(sx, sy));
    }
  };
  const [tx, ty] = from.top, [bx, by] = from.bottom, [fx, fy] = from.front, [kx, ky] = from.back, [rx, ry] = from.right, [lx, ly] = from.left;
  put('top', (C, R) => [kx + W - 1 - C, ky + D - 1 - R]);
  put('bottom', (C, R) => [fx + C, fy + D - 1 - R]);
  put('front', (C, R) => [tx + C, ty + R]);
  put('back', (C, R) => [bx + W - 1 - C, by + R]);
  put('right', (C, R) => [rx + R, ry + D - 1 - C]);
  put('left', (C, R) => [lx + Ht - 1 - R, ly + C]);
}
// A left limb drawn as the mirror image of the right one (Minecraft's models mirror the right
// limb's picture; the game's people have their own left limbs).
function mirrorBox(H, dst, uv, fromUV, dims) {
  const to = faces(uv[0], uv[1], dims), from = faces(fromUV[0], fromUV[1], dims);
  const pairs = { top: 'top', bottom: 'bottom', front: 'front', back: 'back', right: 'left', left: 'right' };
  for (const [f, g] of Object.entries(pairs)) {
    const [x, y] = to[f], [sx, sy, sw, sh] = from[g];
    H.paste(dst, H.flipX(H.crop(dst, sx, sy, sw, sh)), x, y);
  }
}
const E = (path) => `entity/${path}`;
const skin64 = (H) => H.blank(64, 64);
// A whole texture laid over the top-left of a skin (models that are the same in both).
const whole = (ref) => (H) => H.paste(skin64(H), H.load(ref));
// People with Minecraft's older layout: no left limbs of their own, and a second layer that isn't
// used; the game's model has both, so the left limbs are mirrored from the right ones.
function person(ref, outer = null) {
  return (H) => {
    const src = H.load(ref), out = H.paste(skin64(H), H.crop(src, 0, 0, 64, 32));
    if (src.h >= 64 && ref.includes('drowned')) H.paste(out, H.crop(src, 0, 32, 64, 32), 0, 32);
    else { mirrorBox(H, out, [32, 48], [40, 16], [4, 12, 4]); mirrorBox(H, out, [16, 48], [0, 16], [4, 12, 4]); }
    if (outer) {
      // A second skin worn over the first (the drowned's rags): its parts go to the outer layer.
      const o = H.load(outer);
      for (const [uv, to, dims] of [[[0, 0], [32, 0], [8, 8, 8]], [[16, 16], [16, 32], [8, 12, 4]], [[40, 16], [40, 32], [4, 12, 4]], [[0, 16], [0, 32], [4, 12, 4]],
        [[32, 48], [48, 48], [4, 12, 4]], [[16, 48], [0, 48], [4, 12, 4]]]) box(H, out, o, to, dims, uv);
    }
    return out;
  };
}
const LEATHER = [160, 101, 64];
function armour(mat, layer) {
  return (H) => {
    const ref = `models/armor/${mat}_layer_${layer}`;
    let img = H.load(ref);
    if (mat === 'leather') img = H.paste(H.tint(img, LEATHER), H.load(`${ref}_overlay`));
    return H.paste(skin64(H), img);
  };
}

export const SKIN_SOURCES = {
  zombie: person(E('zombie/zombie')),
  husk: person(E('zombie/husk')),
  drowned: person(E('zombie/drowned'), E('zombie/drowned_outer_layer')),
  player_0: whole(E('steve')),
  skeleton: whole(E('skeleton/skeleton')),
  stray: whole(E('skeleton/stray')),
  creeper: whole(E('creeper/creeper')),
  spider: whole(E('spider/spider')),
  cave_spider: whole(E('spider/cave_spider')),
  squid: whole(E('squid')),
  cod: whole(E('fish/cod')),
  salmon: whole(E('fish/salmon')),
  // Tropical fish: the shape's picture in the base colour, the pattern over it in the other.
  ...Object.fromEntries(TROPICAL.map(([name, shape, pattern, base, over]) => [`tropical_${name}`, (H) => {
    const ab = shape ? 'b' : 'a', rgb = (c) => [(FISH_COLOURS[c] >> 16) & 255, (FISH_COLOURS[c] >> 8) & 255, FISH_COLOURS[c] & 255];
    return H.paste(skin64(H), H.paste(H.tint(H.load(E(`fish/tropical_${ab}`)), rgb(base)), H.tint(H.load(E(`fish/tropical_${ab}_pattern_${pattern}`)), rgb(over))));
  }])),
  pufferfish: whole(E('fish/pufferfish')),
  pig: (H) => {
    const src = H.load(E('pig/pig')), out = skin64(H);
    box(H, out, src, [0, 0], [8, 8, 8]); box(H, out, src, [16, 16], [4, 3, 1]); box(H, out, src, [0, 16], [4, 6, 4]);
    rotBox(H, out, src, [0, 32], [10, 8, 16], [28, 8]);
    return out;
  },
  cow: (H) => {
    const src = H.load(E('cow/cow')), out = skin64(H);
    box(H, out, src, [0, 0], [8, 8, 6]); box(H, out, src, [30, 0], [1, 3, 1], [22, 0]); box(H, out, src, [0, 16], [4, 12, 4]);
    rotBox(H, out, src, [0, 34], [12, 10, 18], [18, 4]);
    rotBox(H, out, src, [36, 0], [4, 1, 6], [52, 0]);
    return out;
  },
  sheep: (H) => {
    const src = H.load(E('sheep/sheep')), out = skin64(H);
    box(H, out, src, [0, 0], [6, 6, 8]); box(H, out, src, [0, 16], [4, 12, 4]);
    rotBox(H, out, src, [0, 36], [8, 6, 16], [28, 8]);
    return out;
  },
  sheep_wool: (H) => {
    const src = H.load(E('sheep/sheep_fur')), out = skin64(H);
    box(H, out, src, [0, 0], [6, 6, 6]); box(H, out, src, [16, 16], [4, 6, 4], [0, 16]);
    rotBox(H, out, src, [0, 36], [8, 6, 16], [28, 8]);
    return out;
  },
  chicken: (H) => {
    const src = H.load(E('chicken')), out = skin64(H);
    box(H, out, src, [0, 0], [4, 6, 3]); box(H, out, src, [14, 0], [4, 2, 2]); box(H, out, src, [14, 4], [2, 2, 2]);
    box(H, out, src, [26, 0], [3, 5, 3]); box(H, out, src, [28, 13], [1, 4, 6], [24, 13]);
    rotBox(H, out, src, [0, 9], [6, 6, 8], [0, 9]);
    return out;
  },
  ...Object.fromEntries(['wolf', 'wolf_angry'].map((n) => [n, (H) => {
    const src = H.load(E(`wolf/${n}`)), out = skin64(H);
    box(H, out, src, [0, 0], [6, 6, 4]); box(H, out, src, [16, 14], [2, 2, 1]); box(H, out, src, [0, 10], [3, 3, 4]);
    box(H, out, src, [0, 18], [2, 8, 2]); box(H, out, src, [9, 18], [2, 8, 2]);
    rotBox(H, out, src, [18, 14], [6, 6, 9], [18, 14]);
    rotBox(H, out, src, [21, 0], [8, 7, 6], [21, 0]);
    return out;
  }])),
  // Horses, donkeys and mules: the model is Minecraft's (rigs.js horseBones), so the skins fit as
  // they are; markings are a second skin drawn over the coat.
  ...Object.fromEntries(['white', 'creamy', 'chestnut', 'brown', 'black', 'gray', 'dark_brown'].map((n) => [`horse_${n}`, whole(E(`horse/horse_${n.replace('_', '')}`))])),
  ...Object.fromEntries(['white', 'whitefield', 'whitedots', 'blackdots'].map((n) => [`horse_markings_${n}`, whole(E(`horse/horse_markings_${n}`))])),
  donkey: whole(E('horse/donkey')),
  mule: whole(E('horse/mule')),
  snow_golem: (H) => {
    const src = H.load(E('snow_golem')), out = skin64(H);
    box(H, out, src, [0, 0], [8, 8, 8]); box(H, out, src, [0, 16], [10, 10, 10]); box(H, out, src, [0, 36], [12, 12, 12]);
    box(H, out, src, [32, 0], [11, 2, 2], [32, 0], [12, 2, 2]);
    return out;
  },
  ...Object.fromEntries([['leather', 'leather'], ['iron', 'iron'], ['golden', 'gold'], ['diamond', 'diamond'], ['chainmail', 'chainmail']]
    .flatMap(([ours, mc]) => [[`armor_${ours}`, armour(mc, 1)], [`armor_${ours}_legs`, armour(mc, 2)]])),
};
