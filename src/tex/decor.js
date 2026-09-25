// Things made to be looked at or enjoyed: the cake (with the slice cut out of it).
import { def } from './core.js';

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
