// Things made to be looked at or enjoyed: the cake (with the slice cut out of it).
import { def, mix } from './core.js';

// ---------------------------------------------------------------- cake
// The cake stands 8 pixels high on a 14 by 14 footprint, so its sides show rows 8-15 and its top
// columns and rows 1-14 (see boxFaceUV). White icing over sponge, with a line of jam through it.
const ICING = [0xcdc3bf, 0xe2dbd8, 0xf1ece9, 0xfbf9f7, 0xffffff];
const SPONGE = [0x7e4a20, 0x9c6230, 0xb87c40, 0xcf9652, 0xe2ae68];
const CRUMB = [0xc08a4a, 0xd8a45e, 0xe8bc76, 0xf4d292];
const JAM = [0x7a1016, 0xa81c24, 0xcc2c32];
const CHERRY = [0x6a0a10, 0xb8161e, 0xe03a3a, 0xff8a80];

function sponge(t, pal, y0, y1) {
  const f = t.field([[4, 2, 0.5], [2, 2, 0.35]], 0.35);
  for (let y = y0; y <= y1; y++) for (let x = 0; x < 16; x++) {
    const v = f[y * 16 + x];
    t.set(x, y, pal[Math.max(0, Math.min(pal.length - 1, Math.floor(v * pal.length * 0.9)))]);
  }
}
function jam(t, y) {
  for (let x = 0; x < 16; x++) t.set(x, y, JAM[(x * 7 + y) % 5 === 0 ? 0 : (x * 3) % 4 === 1 ? 2 : 1]);
}

def('cake_top', (t) => {
  const f = t.field([[4, 4, 0.5], [2, 2, 0.3]], 0.25);
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) t.set(x, y, ICING[2 + Math.min(2, Math.floor(f[y * 16 + x] * 2.6))]);
  // The rim is piped a little higher, and catches the light on its far edges.
  for (let i = 1; i < 15; i++) { t.set(i, 1, ICING[4]); t.set(1, i, ICING[4]); t.set(i, 14, ICING[1]); t.set(14, i, ICING[1]); }
  // Cherries dotted over it.
  for (const [x, y] of [[4, 3], [9, 3], [12, 6], [6, 7], [3, 10], [10, 10], [7, 12], [12, 12]]) {
    t.set(x, y, CHERRY[2]); t.set(x + 1, y, CHERRY[1]); t.set(x, y + 1, CHERRY[1]); t.set(x + 1, y + 1, CHERRY[0]);
    t.set(x, y, CHERRY[3]);
    t.set(x + 1, y, CHERRY[2]);
  }
});
def('cake_side', (t) => {
  t.fill(ICING[3]);
  sponge(t, SPONGE, 10, 15);
  // Icing on top, running down in drips.
  for (let x = 0; x < 16; x++) {
    t.set(x, 8, ICING[4]);
    t.set(x, 9, ICING[2]);
    const drip = [2, 1, 0, 1, 2, 0, 1, 3, 1, 0, 2, 1, 0, 2, 1, 0][x];
    for (let k = 0; k < drip; k++) t.set(x, 10 + k, k === drip - 1 ? ICING[1] : ICING[2]);
  }
  jam(t, 13);
  for (let x = 0; x < 16; x++) t.set(x, 15, SPONGE[0]);
});
def('cake_inner', (t) => {
  t.fill(ICING[3]);
  sponge(t, CRUMB, 9, 15);
  for (let x = 0; x < 16; x++) { t.set(x, 8, ICING[4]); t.set(x, 9, ICING[2]); }
  jam(t, 12);
  // Air in the sponge.
  for (const [x, y] of [[3, 10], [9, 11], [12, 10], [5, 14], [11, 14], [7, 13], [2, 13]]) t.set(x, y, CRUMB[0]);
  for (let x = 0; x < 16; x++) t.set(x, 15, SPONGE[2]);
});
def('cake_bottom', (t) => sponge(t, SPONGE.slice(0, 4), 0, 15));
// The cake as it's carried: its top (narrowing away from you) over its front.
def('cake_item', (t) => {
  t.clear();
  const EDGE = 0x6a5e58, CRUST = 0x4a2206, inset = { 4: 3, 5: 2, 6: 1, 7: 1, 8: 1 };
  const drips = [0, 1, 0, 1, 2, 0, 1, 1, 2, 0, 1, 0, 2, 1, 0, 0];
  for (let y = 4; y <= 8; y++) {
    const a = inset[y];
    for (let x = a; x < 16 - a; x++) t.set(x, y, y === 8 ? ICING[1] : y < 6 ? ICING[2] : (x * 5 + y * 3) % 7 ? ICING[3] : ICING[2]);
    t.set(a - 1, y, EDGE); t.set(16 - a, y, EDGE);
  }
  for (let x = 3; x < 13; x++) t.set(x, 3, EDGE);
  for (let x = 1; x < 15; x++) {
    t.set(x, 9, ICING[4]);
    for (let y = 10; y < 14; y++) t.set(x, y, y - 10 < drips[x] ? ICING[2] : y === 12 ? JAM[1] : y === 13 ? SPONGE[1] : x < 4 ? SPONGE[4] : SPONGE[3]);
    t.set(x, 14, CRUST);
  }
  for (let y = 9; y < 14; y++) { t.set(0, y, CRUST); t.set(15, y, CRUST); }
  for (const [x, y] of [[4, 5], [8, 4], [11, 5], [2, 7], [6, 6], [12, 7], [9, 7]]) { t.set(x, y, CHERRY[2]); t.set(x + 1, y, CHERRY[1]); }
  for (const [x, y] of [[4, 5], [8, 4], [11, 5]]) t.set(x, y, CHERRY[3]);
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

// Music discs: black, with grooves that catch the light and a coloured label.
export const DISC_COLOURS = [0x6cc04a, 0x7a5ac8, 0xe8702a, 0x4ab8d8, 0xf0c840, 0x2a6ae0, 0x40d8a0, 0xd0e8ff];
DISC_COLOURS.forEach((label, k) => {
  def(`music_disc_${k}`, (t) => {
    t.clear();
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
      const d = Math.hypot(x - 7.5, y - 7.5);
      if (d > 7) continue;
      let c = d > 6.3 ? 0x060606 : 0x161616;
      if (Math.abs(d - 5) < 0.45 || Math.abs(d - 3.6) < 0.4) c = 0x262626;
      // (Light across the grooves, top left.)
      if (d > 2.6 && d < 6.3 && x + y < 12 && x + y > 8) c = 0x4a4a4a;
      // (The label: lit at its top left, shaded at its bottom right.)
      if (d < 2.6) c = x + y < 14 ? mix(label, 0xffffff, 0.3) : x + y > 16 ? mix(label, 0x000000, 0.25) : label;
      if (d < 0.8) c = 0x101010;
      t.set(x, y, c);
    }
  });
});

// The note that pops up over a note block (tinted by its pitch).
def('note', (t) => {
  t.clear();
  const rows = ['', '', '.......##.......', '.......###......', '.......#.##.....', '.......#..##....', '.......#...#....', '.......#........',
    '.......#........', '.......#........', '....####........', '...#####........', '...#####........', '....###.........'];
  rows.forEach((row, y) => { for (let x = 0; x < 16; x++) if (row[x] === '#') t.set(x, y, 0xffffff); });
});
