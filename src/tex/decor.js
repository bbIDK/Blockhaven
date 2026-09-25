// Things made to be looked at or enjoyed: the cake (with the slice cut out of it).
import { def, mix } from './core.js';

// ---------------------------------------------------------------- cake
// The cake stands 8 pixels high on a 14 by 14 footprint, so its sides show rows 8-15 and its top
// columns and rows 1-14 (see boxFaceUV). Cream icing, with red sprinkles on top and running down
// the sides in drips, over a red-brown sponge.
const ICING = [0xd6c6a4, 0xe8dcc0, 0xf6ecd6, 0xfdf7ea, 0xffffff];
const SPONGE = [0x5e2a14, 0x7a361a, 0x8e4222, 0xa64e26, 0xbc5c22, 0xcc6a2a];
const CRUMB = [0xb06a3a, 0xc27c46, 0xd49254, 0xe2a664];
const SPRINKLE = [0x8e1622, 0xc81e2c, 0xe83a3a, 0xf47a66];

function sponge(t, pal, y0, y1) {
  const f = t.field([[4, 2, 0.45], [2, 2, 0.35]], 0.4);
  for (let y = y0; y <= y1; y++) for (let x = 0; x < 16; x++) {
    const v = f[y * 16 + x];
    t.set(x, y, pal[Math.max(0, Math.min(pal.length - 1, Math.floor(v * pal.length * 0.95)))]);
  }
}
// Sprinkles: a pair of pixels each (lit and shaded), and a cherry-red blob in the middle.
function sprinkles(t, list) {
  for (const [x, y, dx, dy] of list) { t.set(x, y, SPRINKLE[2]); t.set(x + dx, y + dy, SPRINKLE[1]); }
}

def('cake_top', (t) => {
  const f = t.field([[4, 4, 0.5], [2, 2, 0.3]], 0.3);
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) t.set(x, y, ICING[f[y * 16 + x] < 0.45 ? 2 : f[y * 16 + x] < 0.75 ? 3 : 4]);
  // A rim of icing piped round the edge, catching the light on the far sides.
  for (let i = 1; i < 15; i++) { t.set(i, 1, ICING[1]); t.set(1, i, ICING[1]); t.set(i, 14, ICING[0]); t.set(14, i, ICING[0]); }
  sprinkles(t, [[4, 3, 1, 0], [10, 2, 0, 1], [12, 5, 1, 1], [3, 7, 0, 1], [6, 11, 1, 0], [11, 10, 1, 1], [2, 11, 1, 1], [8, 13, 1, 0], [13, 8, 0, 1], [5, 5, 1, 1]]);
  for (const [x, y, c] of [[7, 7, 2], [8, 7, 3], [7, 8, 1], [8, 8, 1], [6, 8, 2], [9, 8, 0], [7, 9, 0], [8, 6, 2]]) t.set(x, y, SPRINKLE[c]);
});
def('cake_side', (t) => {
  t.clear();
  sponge(t, SPONGE.slice(2), 8, 15);
  for (let x = 0; x < 16; x++) {
    // Three rows of icing, then drips of it of different lengths.
    t.set(x, 8, ICING[4]); t.set(x, 9, ICING[3]); t.set(x, 10, ICING[2]);
    const drip = [1, 0, 2, 1, 0, 1, 3, 1, 0, 2, 1, 0, 1, 2, 0, 1][x];
    for (let k = 0; k < drip; k++) t.set(x, 11 + k, k === drip - 1 ? ICING[1] : ICING[2]);
    t.set(x, 15, SPONGE[1]);
  }
  for (const [x, y] of [[3, 9], [9, 10], [13, 9]]) t.set(x, y, SPRINKLE[2]);
});
def('cake_inner', (t) => {
  t.clear();
  sponge(t, CRUMB, 11, 15);
  for (let x = 0; x < 16; x++) { t.set(x, 8, ICING[4]); t.set(x, 9, ICING[3]); t.set(x, 10, ICING[1]); t.set(x, 15, CRUMB[0]); }
  // Air in the sponge.
  for (const [x, y] of [[3, 12], [9, 13], [12, 12], [5, 14], [11, 14], [7, 12], [1, 13]]) t.set(x, y, SPONGE[4]);
});
def('cake_bottom', (t) => sponge(t, SPONGE.slice(1, 5), 0, 15));

// The cake as it's carried: a round cake seen a little from above, its icing top scattered with
// sprinkles over the sponge, icing running down its front in drips.
def('cake_item', (t) => {
  t.clear();
  const cx = 8, rx = 6.9, ty = 5.2, by = 10.2, ry = 3.5;
  const top = (x, y) => ((x + 0.5 - cx) / rx) ** 2 + ((y + 0.5 - ty) / ry) ** 2 <= 1;
  const body = (x, y) => {
    const dx = (x + 0.5 - cx) / rx;
    return Math.abs(dx) <= 1 && y + 0.5 >= ty && (y + 0.5 <= by || dx * dx + ((y + 0.5 - by) / ry) ** 2 <= 1);
  };
  const drips = [0, 1, 2, 1, 0, 1, 1, 2, 1, 0, 1, 2, 1, 0, 1, 0];
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
    if (top(x, y)) {
      // Lit towards the back left, shaded towards the front right.
      const d = (x - 4) * 0.5 + (y - 3);
      t.set(x, y, ICING[d < -1 ? 4 : d < 3 ? 3 : d < 5.5 ? 2 : 1]);
    } else if (body(x, y)) {
      let k = 0; while (k < 6 && !top(x, y - k - 1)) k++;
      const lit = x < 5 ? 1 : x > 11 ? -1 : 0, bottom = !body(x, y + 1);
      if (k <= drips[x]) t.set(x, y, k === drips[x] ? ICING[0] : ICING[1 + (lit > 0)]);
      else t.set(x, y, SPONGE[bottom ? 1 : 3 + lit]);
    }
  }
  // Sprinkles, and a cherry on top.
  sprinkles(t, [[4, 3, 1, 0], [10, 3, 0, 1], [12, 5, 0, 1], [2, 5, 1, 0], [5, 7, 1, 0], [10, 7, 1, 0], [7, 2, 1, 0]]);
  for (const [x, y, c] of [[7, 4, 3], [8, 4, 2], [7, 5, 2], [8, 5, 1], [6, 5, 0]]) t.set(x, y, SPRINKLE[c]);
  // Outline all round.
  const edge = [];
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
    if (t.alpha(x, y)) continue;
    if ([[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => t.alpha(x + dx, y + dy))) edge.push([x, y]);
  }
  for (const [x, y] of edge) t.set(x, y, 0x3c1a0c);
});

// ---------------------------------------------------------------- music
// The note block: a walnut box with a grille in its face. The jukebox: the same wood banded in
// darker boards, with the slot for a disc in its top.
const WALNUT = [0x2e180e, 0x4a2a1a, 0x5e3624, 0x72442e, 0x88553a];
function walnut(t, grain = [16, 2]) {
  const f = t.field([[grain[0], grain[1], 0.55], [4, 1, 0.3]], 0.2);
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) t.set(x, y, WALNUT[1 + Math.min(3, Math.floor(f[y * 16 + x] * 3.4))]);
}
function bevel(t, a, b) {
  for (let i = a; i <= b; i++) { t.set(i, a, WALNUT[4]); t.set(a, i, WALNUT[4]); t.set(i, b, WALNUT[1]); t.set(b, i, WALNUT[1]); }
}
def('note_block', (t) => {
  walnut(t);
  for (let i = 0; i < 16; i++) { t.set(i, 0, WALNUT[0]); t.set(i, 15, WALNUT[0]); t.set(0, i, WALNUT[0]); t.set(15, i, WALNUT[0]); }
  bevel(t, 1, 14);
  // The grille: rows of holes, lit on their lower edge.
  for (let y = 4; y <= 11; y += 2) for (let x = 4; x <= 11; x += 2) { t.set(x, y, 0x1c0e08); t.set(x, y + 1, WALNUT[3]); }
});
def('jukebox_side', (t) => {
  walnut(t, [2, 16]);
  for (const x of [0, 5, 10, 15]) for (let y = 0; y < 16; y++) t.set(x, y, WALNUT[0]);
  for (let x = 0; x < 16; x++) { t.set(x, 0, WALNUT[0]); t.set(x, 1, WALNUT[4]); t.set(x, 14, WALNUT[1]); t.set(x, 15, WALNUT[0]); }
});
def('jukebox_top', (t) => {
  walnut(t);
  for (let i = 0; i < 16; i++) { t.set(i, 0, WALNUT[0]); t.set(i, 15, WALNUT[0]); t.set(0, i, WALNUT[0]); t.set(15, i, WALNUT[0]); }
  bevel(t, 1, 14);
  // The slot a disc goes into.
  for (let x = 3; x <= 12; x++) { t.set(x, 7, 0x0c0604); t.set(x, 8, 0x1a0e08); t.set(x, 6, WALNUT[1]); t.set(x, 9, WALNUT[4]); }
});

// Music discs, lying a little tilted as Minecraft shows them: black, with grooves that catch the
// light, the rim's edge underneath, and a coloured label round the hole.
export const DISC_COLOURS = [0x6cc04a, 0x7a5ac8, 0xe8702a, 0x4ab8d8, 0xf0c840, 0x2a6ae0, 0x40d8a0, 0xd0e8ff];
DISC_COLOURS.forEach((label, k) => {
  def(`music_disc_${k}`, (t) => {
    t.clear();
    const cx = 8, cy = 7.5, rx = 6.9, ry = 4.4;
    const r = (x, y, dy = 0) => Math.hypot((x + 0.5 - cx) / rx, (y + 0.5 - cy - dy) / ry);
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
      const d = r(x, y);
      if (d > 1) { if (r(x, y, 1) <= 1) t.set(x, y, 0x0e0e0e); continue; }
      // Grooves, lit across the top left.
      const lit = (x + 0.5 - cx) / rx + (y + 0.5 - cy) / ry < -0.35;
      let c = (d > 0.62 && d < 0.7) || (d > 0.84 && d < 0.92) ? 0x363636 : 0x222222;
      if (lit && d > 0.45) c = c === 0x363636 ? 0x5a5a5a : 0x404040;
      if (d < 0.42) c = (x + 0.5 - cx) / rx + (y + 0.5 - cy) / ry < -0.1 ? mix(label, 0xffffff, 0.3) : (x + 0.5 - cx) / rx + (y + 0.5 - cy) / ry > 0.2 ? mix(label, 0x000000, 0.25) : label;
      if (d < 0.16) c = 0xf4f4f4;
      t.set(x, y, c);
    }
    // Outline all round.
    const edge = [];
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
      if (t.alpha(x, y)) continue;
      if ([[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => t.alpha(x + dx, y + dy))) edge.push([x, y]);
    }
    for (const [x, y] of edge) t.set(x, y, 0x060606);
  });
});

// The note that pops up over a note block (tinted by its pitch).
def('note', (t) => {
  t.clear();
  const rows = ['', '', '.......##.......', '.......###......', '.......#.##.....', '.......#..##....', '.......#...#....', '.......#........',
    '.......#........', '.......#........', '....####........', '...#####........', '...#####........', '....###.........'];
  rows.forEach((row, y) => { for (let x = 0; x < 16; x++) if (row[x] === '#') t.set(x, y, 0xffffff); });
});
