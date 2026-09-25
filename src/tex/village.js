// Workstations and furniture: anvil, cauldron, composter, bell, grindstone, stonecutter, loom,
// lectern, cartography table and flower pot. The models are made of several boxes, and each box
// shows the part of a texture that lines up with it (like Minecraft's automatic UVs), so these
// are painted with the model's layout in mind: the rows and columns noted below are the ones a
// box's face actually shows.
import { def, mix, quantize, paint } from './core.js';
import { WOODS, drawPlanks, frame } from './terrain.js';

// ---------------------------------------------------------------- metal
// Forged iron: near-black with faint horizontal hammer marks.
const IRON_DARK = [0x2a2a2e, 0x313135, 0x38383d, 0x404045, 0x49494e, 0x535358];
const IRON_W = [0.08, 0.2, 0.3, 0.24, 0.12, 0.06];
const forged = (t, pal = IRON_DARK) => quantize(t, t.field([[8, 2, 0.45], [4, 1, 0.35], [2, 1, 0.1]], 0.25), pal, IRON_W);
const EDGE_LIGHT = 0x6c6c72, EDGE_DARK = 0x1e1e22;

// Anvil sides. The head shows rows 0-5, the waist rows 6-10, the foot row 11 and the base 12-15.
def('anvil', (t) => {
  forged(t);
  for (let x = 0; x < 16; x++) {
    t.set(x, 0, EDGE_LIGHT); t.set(x, 5, EDGE_DARK);
    for (let y = 6; y <= 10; y++) t.set(x, y, mix(t.get(x, y), 0x18181c, 0.35));
    t.set(x, 12, 0x5a5a60); t.set(x, 15, EDGE_DARK);
  }
  for (let k = 0; k < 6; k++) { const x = 1 + t.ri(13), y = [1, 2, 3, 13, 14][t.ri(5)]; t.set(x, y, 0x5c5c62); t.set(x + 1, y, 0x4e4e54); }
});
// The top of the head: a worn, polished face down its length (rows 3-12 along x; the other way
// round for an anvil turned along z).
function anvilTop(t, alongZ) {
  forged(t);
  const at = (u, v, c) => (alongZ ? t.set(v, u, c) : t.set(u, v, c));
  for (let u = 0; u < 16; u++) {
    at(u, 3, EDGE_LIGHT); at(u, 12, EDGE_DARK);
    for (let v = 5; v <= 10; v++) {
      const k = v === 5 ? 0x8e8e94 : v === 10 ? 0x5a5a60 : [0x76767c, 0x7c7c82, 0x828288][(u * 7 + v * 3) % 3];
      at(u, v, u === 0 || u === 15 ? 0x4a4a50 : k);
    }
  }
  for (let k = 0; k < 4; k++) at(2 + t.ri(12), 6 + t.ri(4), 0x9a9aa0);
}
def('anvil_top', (t) => anvilTop(t, false));
def('anvil_top_z', (t) => anvilTop(t, true));

// Cauldron: a rim band, rivets, and the feet in the bottom corners (rows 13-15, columns 0-3 and 12-15).
const CAULDRON = [0x28282c, 0x2f2f34, 0x37373c, 0x3f3f45, 0x48484e];
def('cauldron_side', (t) => {
  quantize(t, t.field([[8, 4, 0.4], [4, 2, 0.35]], 0.3), CAULDRON, [0.1, 0.24, 0.32, 0.22, 0.12]);
  for (let x = 0; x < 16; x++) { t.set(x, 0, 0x6a6a70); t.set(x, 1, 0x4e4e54); t.set(x, 2, 0x222226); t.set(x, 12, 0x1c1c20); }
  for (const y of [4, 10]) for (let x = 2; x < 16; x += 4) { t.set(x, y, 0x6a6a70); t.set(x + 1, y + 1, 0x1c1c20); }
  for (let y = 13; y < 16; y++) for (let x = 0; x < 16; x++) {
    if (x >= 4 && x <= 11) continue;
    const edge = x === 0 || x === 4 - 1 || x === 12 || x === 15 || y === 15;
    t.set(x, y, edge ? 0x222226 : 0x3a3a3f);
  }
});
def('cauldron_inner', (t) => {
  quantize(t, t.field([[8, 8, 0.4], [4, 4, 0.35]], 0.25), CAULDRON.slice(0, 4), [0.2, 0.35, 0.3, 0.15]);
});
// The rim seen from above: the two outer rows and columns.
def('cauldron_top', (t) => {
  quantize(t, t.field([[4, 4, 0.5]], 0.3), CAULDRON.slice(0, 3), [0.3, 0.4, 0.3]);
  for (let i = 0; i < 16; i++) {
    for (const [x, y, c] of [[i, 0, 0x74747a], [0, i, 0x74747a], [i, 15, 0x3a3a40], [15, i, 0x3a3a40],
      [i, 1, 0x56565c], [1, i, 0x56565c], [i, 14, 0x4a4a50], [14, i, 0x4a4a50]]) {
      if ((y === 1 || y === 14) && (i < 1 || i > 14)) continue;
      if ((x === 1 || x === 14) && (i < 1 || i > 14)) continue;
      t.set(x, y, c);
    }
  }
});
def('cauldron_bottom', (t) => {
  quantize(t, t.field([[4, 4, 0.5]], 0.3), CAULDRON.slice(0, 4), [0.3, 0.3, 0.25, 0.15]);
  frame(t, 0x4a4a50, 0x1e1e22);
});
// Still water, already coloured (the cauldron isn't tinted by biome).
def('cauldron_water', (t) => {
  quantize(t, t.field([[8, 4, 0.5], [4, 2, 0.3]], 0.2), [0x2c45b8, 0x3350c4, 0x3a5bce, 0x4466d6, 0x5074dc], [0.1, 0.25, 0.35, 0.2, 0.1]);
  for (let k = 0; k < 7; k++) { const x = t.ri(14), y = t.ri(16); t.set(x, y, 0x6f93ea); t.set(x + 1, y, 0x6286e4); }
});

// Bell: polished gold, lit from the left, with an engraved band.
const GOLD = [0x6e440e, 0x93601a, 0xb98222, 0xd8a42e, 0xefc64a, 0xfbe07e];
def('bell_body', (t) => {
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
    let k = 4 - Math.floor((x / 16) * 4.5);
    if ((x + y * 3) % 7 === 0) k += 1;
    t.set(x, y, GOLD[Math.max(0, Math.min(5, k))]);
  }
  for (let x = 0; x < 16; x++) { t.set(x, 4, GOLD[1]); t.set(x, 5, GOLD[4]); t.set(x, 10, GOLD[1]); t.set(x, 11, GOLD[3]); }
  for (let y = 0; y < 16; y++) t.set(15, y, GOLD[0]);
});
def('bell_top', (t) => {
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
    const d = Math.hypot(x - 6.5, y - 6.5);
    t.set(x, y, GOLD[Math.max(0, Math.min(5, 5 - Math.floor(d / 2.2)))]);
  }
});

// ---------------------------------------------------------------- stone
const SMOOTH = [0x8e8e8e, 0x969696, 0x9e9e9e, 0xa6a6a6, 0xaeaeae];
const smooth = (t) => quantize(t, t.field([[8, 4, 0.5], [4, 2, 0.3]], 0.2), SMOOTH, [0.12, 0.25, 0.3, 0.22, 0.11]);

// Grindstone: the wheel's flat faces (a square of columns 2-13, rows 0-11) carry a turned
// groove round the hub; its rim is fine-grained sandstone-grey grit.
def('grindstone_round', (t) => {
  smooth(t);
  for (let y = 0; y < 12; y++) for (let x = 2; x < 14; x++) {
    const d = Math.hypot(x - 7.5, y - 5.5);
    if (d > 4.3 && d < 5.3) t.set(x, y, 0x7a7a7a);
    else if (d > 3.6 && d <= 4.3) t.set(x, y, 0xb8b8b8);
    if (d < 1.6) t.set(x, y, d < 0.9 ? 0x3a2a1a : 0x5e4a30);
  }
  for (let i = 2; i < 14; i++) { t.set(i, 0, 0xbcbcbc); t.set(2, i - 2, 0xb4b4b4); t.set(i, 11, 0x707070); t.set(13, i - 2, 0x767676); }
});
def('grindstone_side', (t) => {
  quantize(t, t.field([[1, 4, 0.4], [2, 8, 0.3]], 0.45), [0x7e7e7e, 0x888888, 0x929292, 0x9c9c9c, 0xa8a8a8], [0.12, 0.25, 0.3, 0.22, 0.11]);
  for (let y = 0; y < 16; y++) { t.set(4, y, 0xb0b0b0); t.set(11, y, 0x6e6e6e); }
});

// Stonecutter: a stone bench (its sides show rows 7-15) with an iron saw in a slot on top.
def('stonecutter_top', (t) => {
  smooth(t);
  frame(t, 0xbababa, 0x747474);
  for (let x = 1; x < 15; x++) { t.set(x, 7, 0x2a2a2e); t.set(x, 8, 0x3a3a3f); t.set(x, 6, 0x7a7a7a); t.set(x, 9, 0xb4b4b4); }
});
def('stonecutter_side', (t) => {
  smooth(t);
  for (let x = 0; x < 16; x++) {
    t.set(x, 7, 0xbcbcbc); t.set(x, 8, 0x9a9a9a);
    t.set(x, 9, 0x4a4a50); t.set(x, 10, 0x38383d);
    t.set(x, 15, 0x6e6e6e);
  }
  for (const x of [0, 15]) for (let y = 7; y < 16; y++) t.set(x, y, x ? 0x767676 : 0xb0b0b0);
});
// The blade: the upper half of a toothed steel disc (rows 0-6, columns 1-14), the rest clear.
def('stonecutter_saw', (t) => {
  t.clear();
  for (let y = 0; y < 7; y++) for (let x = 1; x < 15; x++) {
    const d = Math.hypot(x - 7.5, y - 7.5);
    if (d > 7.1) continue;
    const tooth = d > 6.2;
    if (tooth && (x + y) % 2) continue;
    t.set(x, y, tooth ? 0xd8d8de : d < 1.5 ? 0x4a4a50 : d < 5 ? [0x9a9aa2, 0xa8a8b0, 0xb4b4bc][(x * 5 + y * 3) % 3] : 0xc4c4cc);
  }
});

// ---------------------------------------------------------------- wood
const OAK = WOODS.oak.planks, SPRUCE = WOODS.spruce.planks, DARK = WOODS.dark_oak.planks;

// Composter: slatted wooden walls round a frame.
def('composter_side', (t) => {
  drawPlanks(t, OAK, [3, 11, 6, 13]);
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
    if (x < 2 || x > 13 || y < 2 || y > 13) t.set(x, y, x < 1 || y < 1 ? OAK[4] : x > 14 || y > 14 ? OAK[0] : OAK[2]);
  }
  for (const y of [5, 9]) for (let x = 2; x < 14; x++) { t.set(x, y, OAK[0]); t.set(x, y + 1, 0x2a1d10); }
});
def('composter_top', (t) => {
  t.fill(0x2a1d10);
  for (let i = 0; i < 16; i++) for (const [x, y] of [[i, 0], [0, i], [i, 1], [1, i], [i, 14], [14, i], [i, 15], [15, i]]) {
    t.set(x, y, x === 0 || y === 0 ? OAK[4] : x === 15 || y === 15 ? OAK[1] : OAK[3]);
  }
});
def('composter_bottom', (t) => { drawPlanks(t, OAK); frame(t, OAK[4], OAK[0]); });
const COMPOST = [0x2e2010, 0x3a2915, 0x46321a, 0x533c20, 0x604726];
def('compost', (t) => {
  quantize(t, t.field([[2, 2, 0.5], [4, 4, 0.3]], 0.5), COMPOST, [0.12, 0.25, 0.3, 0.22, 0.11]);
  for (let k = 0; k < 10; k++) t.set(t.ri(16), t.ri(16), [0x4c5a22, 0x5c6a2a, 0x6e5a2a][t.ri(3)]);
});
def('composter_ready', (t) => {
  quantize(t, t.field([[2, 2, 0.5], [4, 4, 0.3]], 0.5), COMPOST, [0.12, 0.25, 0.3, 0.22, 0.11]);
  for (let k = 0; k < 26; k++) { const x = t.ri(16), y = t.ri(16); t.set(x, y, 0xe8e6d8); if (t.r() < 0.4) t.set(x + 1, y, 0xc8c6b8); }
});

// Loom: a dark frame holding a warp of cream threads and a comb bar.
const THREAD = [0xd8ccb0, 0xeae2cc];
def('loom_front', (t) => {
  drawPlanks(t, SPRUCE);
  frame(t, SPRUCE[4], SPRUCE[0]);
  for (let y = 3; y < 13; y++) for (let x = 3; x < 13; x++) t.set(x, y, x % 2 ? THREAD[0] : 0x3a2818);
  for (let x = 2; x < 14; x++) { t.set(x, 8, DARK[4]); t.set(x, 9, DARK[1]); }
  for (let x = 2; x < 14; x++) { t.set(x, 2, SPRUCE[5]); t.set(x, 13, SPRUCE[1]); }
});
def('loom_side', (t) => {
  drawPlanks(t, SPRUCE);
  frame(t, SPRUCE[4], SPRUCE[0]);
  // A spool of red yarn on a peg.
  paint(t, ['', '', '', '', '.....kkkkk......', '.....rRRRr......', '.....rRrRr......', '.....rrRrr......', '.....kkkkk......', '.......k........',
    '.......k........'], { k: DARK[1], r: 0xa83226, R: 0xcc4a36 }, { clear: false });
});
def('loom_top', (t) => {
  drawPlanks(t, SPRUCE);
  frame(t, SPRUCE[4], SPRUCE[0]);
  for (let y = 2; y < 14; y++) for (let x = 4; x < 12; x += 2) t.set(x, y, THREAD[1]);
  for (let x = 1; x < 15; x++) { t.set(x, 10, DARK[3]); t.set(x, 11, DARK[0]); }
});
def('loom_bottom', (t) => { drawPlanks(t, SPRUCE); frame(t, SPRUCE[3], SPRUCE[0]); });

// Lectern: base (top face, and rows 14-15 of its sides), post (columns 4-11, rows 3-13) and a
// sloping desk top.
def('lectern_base', (t) => {
  drawPlanks(t, OAK);
  frame(t, OAK[5], OAK[0]);
  for (let x = 0; x < 16; x++) { t.set(x, 14, OAK[4]); t.set(x, 15, OAK[0]); }
});
def('lectern_sides', (t) => {
  drawPlanks(t, OAK, [16, 16, 16, 16]);
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) if (x % 4 === 3) t.set(x, y, OAK[1]);
  for (let y = 3; y < 14; y++) { t.set(4, y, OAK[5]); t.set(11, y, OAK[0]); }
  // A carved panel.
  for (let y = 5; y < 12; y++) { t.set(6, y, OAK[1]); t.set(9, y, OAK[4]); }
  for (let x = 6; x < 10; x++) { t.set(x, 5, OAK[1]); t.set(x, 11, OAK[4]); }
});
def('lectern_top', (t) => {
  drawPlanks(t, OAK);
  frame(t, OAK[5], OAK[0]);
  // The rail that holds a book, along the lower edge.
  for (let x = 1; x < 15; x++) { t.set(x, 12, OAK[5]); t.set(x, 13, OAK[2]); t.set(x, 14, OAK[0]); }
});

// Cartography table: a parchment map pinned to a dark oak top, papers on the sides.
const PAPER = [0xc8b890, 0xd6c8a2, 0xe2d6b4];
def('cartography_table_top', (t) => {
  drawPlanks(t, DARK);
  for (let y = 2; y < 14; y++) for (let x = 2; x < 14; x++) {
    const n = Math.sin(x * 0.9 + y * 0.4) + Math.cos(y * 0.8 - x * 0.3);
    t.set(x, y, n > 0.9 ? 0x6e8c4a : n < -1.1 ? 0x5a7ab0 : PAPER[(x + y) % 3 === 0 ? 0 : 1 + ((x * y) % 2)]);
  }
  for (let i = 2; i < 14; i++) { t.set(i, 2, PAPER[2]); t.set(i, 13, 0xa89870); t.set(2, i, PAPER[2]); t.set(13, i, 0xa89870); }
  t.set(5, 6, 0xb03020); t.set(6, 6, 0xb03020); t.set(5, 7, 0xb03020);
  for (const [x, y] of [[2, 2], [13, 2], [2, 13], [13, 13]]) t.set(x, y, 0x8a8a8a);
});
function cartoSide(t, sheet) {
  drawPlanks(t, DARK);
  for (let x = 0; x < 16; x++) { t.set(x, 0, DARK[5]); t.set(x, 1, DARK[3]); t.set(x, 15, DARK[0]); }
  sheet(t);
}
def('cartography_table_side1', (t) => cartoSide(t, (t) => {
  for (let y = 4; y < 13; y++) for (let x = 3; x < 10; x++) t.set(x, y, (x + y) % 5 === 0 ? PAPER[0] : PAPER[2]);
  for (let x = 4; x < 9; x++) for (const y of [6, 8, 10]) t.set(x, y, 0x8a7a5a);
  t.set(6, 4, 0x8a8a8a);
}));
def('cartography_table_side2', (t) => cartoSide(t, (t) => {
  // A rolled map and a pair of dividers.
  for (let x = 2; x < 14; x++) { t.set(x, 5, PAPER[2]); t.set(x, 6, PAPER[1]); t.set(x, 7, PAPER[0]); }
  t.set(2, 6, 0x9a8a60); t.set(13, 6, 0x9a8a60);
  t.line(5, 9, 8, 13, 0x9a9aa0); t.line(11, 9, 8, 13, 0x9a9aa0); t.set(8, 9, 0x5a5a60);
}));

// Flower pot: terracotta with a rolled rim (its sides show rows 10-15, columns 5-10).
const POT = [0x6a3522, 0x7c412a, 0x8e4c32, 0x9e583a, 0xae6444];
def('flower_pot', (t) => {
  quantize(t, t.field([[4, 2, 0.5], [2, 1, 0.3]], 0.3), POT.slice(1), [0.2, 0.35, 0.3, 0.15]);
  for (let x = 0; x < 16; x++) { t.set(x, 10, POT[4]); t.set(x, 11, POT[2]); t.set(x, 15, POT[0]); }
  for (let y = 10; y < 16; y++) { t.set(5, y, mix(t.get(5, y), 0xffffff, 0.12)); t.set(10, y, POT[0]); }
});
def('flower_pot_top', (t) => {
  quantize(t, t.field([[2, 2, 0.5]], 0.4), [0x3e2a1a, 0x4a3220, 0x563b26], [0.3, 0.4, 0.3]);
  for (let i = 5; i <= 10; i++) { t.set(i, 5, POT[4]); t.set(5, i, POT[4]); t.set(i, 10, POT[1]); t.set(10, i, POT[1]); }
});
