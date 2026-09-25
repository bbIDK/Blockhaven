// Trapdoors, the iron door, levers and redstone lamps: drawn in the same palettes as the doors,
// planks and blocks of metal they go with.
import { def, pick, quantize } from './core.js';
import { WOODS, drawPlanks, frame, DOOR_STYLE } from './terrain.js';

// ---------------------------------------------------------------- trapdoors
// A framed board with holes cut in it, one pattern per wood (to match its door).
const HOLES = {
  windows: [[3, 3, 6, 6], [9, 3, 12, 6], [3, 9, 6, 12], [9, 9, 12, 12]],
  slit: [[3, 5, 12, 6], [3, 9, 12, 10]],
  grid: [[3, 3, 4, 4], [7, 3, 8, 4], [11, 3, 12, 4], [3, 7, 4, 8], [7, 7, 8, 8], [11, 7, 12, 8], [3, 11, 4, 12], [7, 11, 8, 12], [11, 11, 12, 12]],
  cross: [[3, 3, 6, 6], [9, 3, 12, 6], [3, 9, 6, 12], [9, 9, 12, 12]],
  diamond: [],
  panel: [],
  round: [],
};
function trapdoor(t, pal, style) {
  drawPlanks(t, pal, [16, 16, 16, 16]);
  const f = t.field([[1, 8, 0.6], [2, 16, 0.3]], 0.2);
  quantize(t, f, pal.slice(1), [0.12, 0.26, 0.32, 0.21, 0.09]);
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
    if (x === 0 || y === 0 || x === 15 || y === 15) t.set(x, y, pal[0]);
    else if (x === 1 || y === 1) t.set(x, y, pal[5]);
    else if (style === 'cross' && (x === 7 || x === 8 || y === 7 || y === 8)) t.set(x, y, pal[4]);
  }
  const hole = ([x0, y0, x1, y1]) => {
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) t.set(x, y, 0, 0);
    for (let x = x0 - 1; x <= x1 + 1; x++) { t.set(x, y0 - 1, pal[0]); t.set(x, y1 + 1, pal[5]); }
    for (let y = y0; y <= y1; y++) { t.set(x0 - 1, y, pal[0]); t.set(x1 + 1, y, pal[5]); }
  };
  for (const h of HOLES[style] ?? []) hole(h);
  if (style === 'diamond') for (let y = 4; y < 12; y++) { const w = 3 - Math.abs(y - 7.5) + 0.5; for (let x = Math.ceil(8 - w); x < 8 + w; x++) t.set(x, y, 0, 0); }
  if (style === 'round') for (let y = 3; y < 13; y++) for (let x = 3; x < 13; x++) if (Math.hypot(x - 7.5, y - 7.5) < 3.6) t.set(x, y, 0, 0);
  if (style === 'panel') {
    for (let x = 3; x < 13; x++) { t.set(x, 3, pal[1]); t.set(x, 12, pal[5]); }
    for (let y = 3; y < 13; y++) { t.set(3, y, pal[1]); t.set(12, y, pal[5]); }
  }
  // Iron hinges on one edge.
  for (const y of [3, 12]) { t.set(1, y, 0x5a5a5a); t.set(2, y, 0x8a8a8a); t.set(3, y, 0x6a6a6a); }
}
for (const [name, w] of Object.entries(WOODS)) def(`${name}_trapdoor`, (t) => trapdoor(t, w.planks, DOOR_STYLE[name]));

// Iron: a riveted plate (the trapdoor has four small windows).
const IRON = [0x5e5e5e, 0x9a9a9a, 0xb4b4b4, 0xc8c8c8, 0xdadada, 0xf2f2f2];
function ironPlate(t) {
  quantize(t, t.field([[8, 8, 0.4], [4, 4, 0.2]], 0.3), IRON.slice(2, 5), [0.25, 0.5, 0.25]);
  frame(t, IRON[5], IRON[0]);
}
def('iron_trapdoor', (t) => {
  ironPlate(t);
  for (const [x0, y0] of [[3, 3], [9, 3], [3, 9], [9, 9]]) {
    for (let y = y0; y < y0 + 4; y++) for (let x = x0; x < x0 + 4; x++) t.set(x, y, 0, 0);
    for (let i = -1; i < 5; i++) { t.set(x0 + i, y0 - 1, IRON[0]); t.set(x0 - 1, y0 + i, IRON[0]); t.set(x0 + i, y0 + 4, IRON[5]); t.set(x0 + 4, y0 + i, IRON[5]); }
  }
});

// ---------------------------------------------------------------- lever
// The handle is a plain stick (only a sliver of the texture shows on each face).
const STICK = [0x4e3a1e, 0x684d28, 0x7d5d31, 0x8f6b3a];
def('lever', (t) => quantize(t, t.field([[1, 6, 0.6], [2, 2, 0.3]], 0.3), STICK, [0.15, 0.35, 0.35, 0.15]));

// ---------------------------------------------------------------- redstone lamp
// A frame of dark glass round a lattice; lit, it glows yellow-white.
function lamp(t, on) {
  const pal = on ? [0x8a4a12, 0xd8902a, 0xf2b84a, 0xffdc80, 0xfff4c8] : [0x2e1a10, 0x4a2c1c, 0x5c3a24, 0x6e4a2e, 0x86603c];
  quantize(t, t.field([[4, 4, 0.5], [2, 2, 0.3]], 0.35), pal.slice(1, 4), [0.3, 0.45, 0.25]);
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
    const edge = x === 0 || y === 0 || x === 15 || y === 15;
    if (edge) t.set(x, y, on ? 0x5a3010 : 0x1e120a);
    else if ((x + y) % 5 === 0 || (x - y + 20) % 5 === 0) t.set(x, y, on ? pal[4] : pal[0]);
  }
  if (on) for (let k = 0; k < 10; k++) t.set(2 + t.ri(12), 2 + t.ri(12), pick([0xffffff, 0xfff4c8], t.r()));
}
def('redstone_lamp', (t) => lamp(t, false));
def('redstone_lamp_on', (t) => lamp(t, true));
