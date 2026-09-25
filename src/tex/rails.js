// Track and minecarts: iron rails on wooden ties (straight, and round a corner), golden powered
// rails with a line of redstone between them (dark when off), detector rails with a plate in the
// middle, and the iron minecart.
import { def } from './core.js';

const TIE = [0x4a3218, 0x6a4a28, 0x7e5a32];
const IRON = [0x4a4a4e, 0x8a8a90, 0xc8c8cc, 0xf0f0f4];
const GOLD = [0x6a4a0a, 0xc89a1e, 0xf0d048, 0xfff6a0];

// Straight track, running up and down the picture: ties every four pixels, rails at 2-3 and 12-13.
function straight(t, rail = IRON) {
  t.clear();
  for (const y0 of [1, 5, 9, 13]) for (let x = 1; x < 15; x++) { t.set(x, y0, TIE[2]); t.set(x, y0 + 1, x % 5 === 0 ? TIE[0] : TIE[1]); }
  for (let y = 0; y < 16; y++) for (const x of [2, 12]) { t.set(x, y, rail[3]); t.set(x + 1, y, rail[1]); if (y % 4 === 3) t.set(x + 1, y, rail[0]); }
}
def('rail', (t) => straight(t));
// Round a corner, joining the bottom edge to the right: the rails in quarter circles about the
// bottom right corner, the ties pointing to it.
def('rail_corner', (t) => {
  t.clear();
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
    const dx = 16 - (x + 0.5), dy = 16 - (y + 0.5), d = Math.hypot(dx, dy), a = Math.atan2(dy, dx) * 180 / Math.PI;
    if (d > 1.5 && d < 15.2 && [12, 40, 68].some((c) => Math.abs(a - c) < 5.5)) t.set(x, y, Math.abs(d - 8) < 5 ? TIE[1] : TIE[2]);
  }
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
    const d = Math.hypot(16 - (x + 0.5), 16 - (y + 0.5));
    for (const r of [13, 3]) {
      if (Math.abs(d - r) < 0.55) t.set(x, y, IRON[3]);
      else if (Math.abs(d - (r - 1)) < 0.55) t.set(x, y, IRON[1]);
    }
  }
});
// Powered rails: gold, with redstone down the middle.
function powered(t, on) {
  straight(t, GOLD);
  for (let y = 0; y < 16; y++) for (const x of [7, 8]) t.set(x, y, on ? (y % 3 ? 0xff3a2a : 0xffa090) : (y % 3 ? 0x5a1410 : 0x7a2018));
}
def('powered_rail', (t) => powered(t, false));
def('powered_rail_on', (t) => powered(t, true));
// Detector rails: a pressure plate between the rails, with a light that glows while a cart is on it.
function detector(t, on) {
  straight(t);
  for (let y = 5; y < 11; y++) for (let x = 5; x < 11; x++) t.set(x, y, x === 5 || y === 5 ? IRON[2] : x === 10 || y === 10 ? IRON[0] : IRON[1]);
  for (const [x, y] of [[7, 7], [8, 7], [7, 8], [8, 8]]) t.set(x, y, on ? 0xff3a2a : 0x5a1410);
}
def('detector_rail', (t) => detector(t, false));
def('detector_rail_on', (t) => detector(t, true));

// The minecart's iron plates: riveted round the edges.
def('minecart', (t) => {
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) t.set(x, y, (x * 7 + y * 3) % 13 === 0 ? IRON[0] : (x + y) % 9 === 0 ? 0x9a9aa0 : IRON[1]);
  for (let i = 0; i < 16; i++) { t.set(i, 0, IRON[2]); t.set(0, i, IRON[2]); t.set(i, 15, IRON[0]); t.set(15, i, IRON[0]); }
  for (const [x, y] of [[2, 2], [13, 2], [2, 13], [13, 13], [7, 2], [7, 13]]) { t.set(x, y, IRON[3]); t.set(x + 1, y + 1, IRON[0]); }
});
