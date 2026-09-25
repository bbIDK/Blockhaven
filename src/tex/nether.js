// The Nether's blocks: netherrack, soul sand and soil, magma, basalt and blackstone, nether bricks
// and its ores, the crimson and warped forests (nylium, stems, planks, wart blocks, fungi, roots),
// shroomlight, quartz and bone blocks, and the portal's swirl.
import { def, quantize, speckle, paint, mix } from './core.js';
import { ore, bricks, drawPlanks, drawBark, drawLogTop, frame } from './terrain.js';

export const NETHERRACK = [0x3a0c0c, 0x521212, 0x681a18, 0x7c2422, 0x8e302c, 0xa03c36];
export function drawNetherrack(t) {
  quantize(t, t.field([[4, 4, 0.5], [2, 2, 0.35], [8, 8, 0.2]], 0.35), NETHERRACK, [0.1, 0.18, 0.26, 0.24, 0.14, 0.08]);
  // Dark cracks through it.
  for (let k = 0; k < 5; k++) {
    let x = t.ri(16), y = t.ri(16);
    for (let s = 0; s < 3 + t.ri(3); s++) { t.wset(x, y, NETHERRACK[0]); x += t.ri(3) - 1; y += 1; }
  }
}
def('netherrack', drawNetherrack);

// Soul sand: brown, with faces in it.
def('soul_sand', (t) => {
  speckle(t, [0x2e2016, 0x3e2c1e, 0x4c3826, 0x5a4430, 0x6a523c], { cell: 4, grain: 0.5 });
  for (const [x, y] of [[2, 3], [9, 1], [12, 9], [4, 10]]) {
    t.wset(x, y, 0x1e140c); t.wset(x + 2, y, 0x1e140c); t.wset(x + 1, y + 2, 0x24180e); t.wset(x, y + 2, 0x2a1c12); t.wset(x + 2, y + 2, 0x2a1c12);
  }
});
def('soul_soil', (t) => speckle(t, [0x2a1e16, 0x36281c, 0x423224, 0x4e3c2c, 0x5a4634], { cell: 8, grain: 0.35 }));

// Magma: black crust over glowing cracks.
def('magma_block', (t) => {
  const f = t.field([[4, 4, 0.6], [2, 2, 0.3]], 0.2);
  for (let i = 0; i < 256; i++) {
    const v = f[i], x = i & 15, y = i >> 4;
    t.set(x, y, v > 0.68 ? (v > 0.76 ? 0xffb030 : 0xf06a14) : v > 0.6 ? 0x9a300e : v > 0.32 ? 0x3a1a12 : 0x24100c);
  }
});

// Basalt: grey-black columns; blackstone: near-black rock with a glint of gold in the gilded kind.
def('basalt_side', (t) => {
  quantize(t, t.field([[1, 8, 0.6], [2, 16, 0.3]], 0.25), [0x2a2a2e, 0x38383c, 0x46464a, 0x54545a, 0x626268], [0.12, 0.26, 0.3, 0.2, 0.12]);
  for (const x of [3, 8, 13]) for (let y = 0; y < 16; y++) if (t.r() < 0.8) t.set(x, y, 0x222226);
});
def('basalt_top', (t) => {
  speckle(t, [0x2e2e32, 0x3c3c40, 0x4a4a4e, 0x58585c], { cell: 4 });
  frame(t, 0x5e5e64, 0x222226);
  for (let i = 3; i < 13; i++) { t.set(i, 3, 0x2a2a2e); t.set(3, i, 0x2a2a2e); t.set(i, 12, 0x5a5a60); t.set(12, i, 0x5a5a60); }
});
export const BLACKSTONE = [0x16121a, 0x201a24, 0x2a232e, 0x342c38, 0x3e3642];
def('blackstone', (t) => speckle(t, BLACKSTONE, { cell: 4, grain: 0.5 }));
def('blackstone_top', (t) => { speckle(t, BLACKSTONE, { cell: 8, grain: 0.4 }); frame(t, BLACKSTONE[4], BLACKSTONE[0]); });

// Nether bricks: small dark red bricks in black mortar.
export const NETHER_BRICK = [0x2a1014, 0x381418, 0x44181c, 0x501e22, 0x5e2428];
def('nether_bricks', (t) => bricks(t, NETHER_BRICK, [0x140608, 0x1c0a0c], { h: 4, w: 8 }));
def('red_nether_bricks', (t) => bricks(t, [0x4a0406, 0x5e080a, 0x720c0e, 0x861214, 0x98181a], [0x240204, 0x2e0406], { h: 4, w: 8 }));

// Ores in netherrack: quartz and gold.
def('nether_quartz_ore', (t) => ore(t, drawNetherrack, [0xb8a89e, 0xdcd0c6, 0xf0e8e0, 0xffffff], 1, 0x3a0c0c));
def('nether_gold_ore', (t) => ore(t, drawNetherrack, [0xb8861b, 0xe0b527, 0xfbdb45, 0xfff6a4], 2, 0x3a0c0c));

// The forests: nylium (netherrack under a skin of fungus), stems, planks, wart blocks.
const CRIMSON = { top: [0x5a0c14, 0x7a141c, 0x961c24, 0xae2830, 0xc43838], stem: [0x3a1024, 0x4e1630, 0x5e1c38, 0x702444, 0x842e50],
  core: [0x5e1c38, 0x7a2c4a, 0x9a3c5a, 0xb4506c, 0xc86480, 0xd87a90], planks: [0x3a1424, 0x522034, 0x622840, 0x723250, 0x843c5e, 0x964868],
  wart: [0x5a0808, 0x740c0c, 0x8e1212, 0xa41a1a, 0xba2424] };
const WARPED = { top: [0x0e4a42, 0x14605a, 0x1a766e, 0x248c84, 0x36a296], stem: [0x2a1e3a, 0x36264a, 0x3a3252, 0x2c4a52, 0x1e6a64],
  core: [0x144a46, 0x1a5e58, 0x247470, 0x328a84, 0x44a098, 0x5ab4aa], planks: [0x163a3a, 0x1e4a48, 0x265a56, 0x2e6a64, 0x3a7a72, 0x468a80],
  wart: [0x0a4a4a, 0x0e6060, 0x147676, 0x1c8c8a, 0x28a09c] };
for (const [name, c] of [['crimson', CRIMSON], ['warped', WARPED]]) {
  def(`${name}_nylium`, (t) => speckle(t, c.top, { cell: 4, grain: 0.5 }));
  def(`${name}_nylium_side`, (t) => {
    drawNetherrack(t);
    for (let x = 0; x < 16; x++) { const d = 2 + (t.r() < 0.5 ? 1 : 0) + (t.r() < 0.3 ? 1 : 0); for (let y = 0; y < d; y++) t.set(x, y, c.top[1 + t.ri(4)]); }
  });
  def(`${name}_stem`, (t) => drawBark(t, c.stem, c.stem[0]));
  def(`${name}_stem_top`, (t) => drawLogTop(t, c.core, c.stem));
  def(`${name}_planks`, (t) => drawPlanks(t, c.planks));
  def(`${name === 'crimson' ? 'nether' : 'warped'}_wart_block`, (t) => {
    quantize(t, t.field([[4, 4, 0.5], [2, 2, 0.4]], 0.4), c.wart, [0.12, 0.22, 0.3, 0.22, 0.14]);
    for (let k = 0; k < 10; k++) t.set(t.ri(16), t.ri(16), mix(c.wart[4], 0xffffff, 0.2));
  });
}
// Shroomlight: a glowing orange lump, brightest in its spots.
def('shroomlight', (t) => {
  quantize(t, t.field([[4, 4, 0.5], [2, 2, 0.3]], 0.3), [0xc85a1a, 0xe07a24, 0xf09a34, 0xfab850, 0xffd070], [0.12, 0.24, 0.3, 0.22, 0.12]);
  for (const [x, y] of [[3, 3], [10, 2], [6, 8], [13, 10], [2, 12], [9, 13]]) { t.set(x, y, 0xfff4c0); t.set(x + 1, y, 0xffe090); }
});
// Fungi and roots: small plants of the two forests.
function fungus(t, cap, spots, stem) {
  paint(t, ['', '', '', '', '', '....cccccc......', '...cccsccccc....', '..ccsccccccsc...', '..cccccscccc....', '.....ssss.......',
    '.......tt.......', '.......tt.......', '......ttt.......', '.......tt.......', '......tt.t......', '.....t..t.......'],
  { c: cap, s: spots, t: stem });
}
def('crimson_fungus', (t) => fungus(t, 0x9a1c24, 0xf0a060, 0x6a2a3a));
def('warped_fungus', (t) => fungus(t, 0x1a8c84, 0xf09a40, 0x3a3250));
function roots(t, pal) {
  t.clear();
  for (const [x0, h, lean] of [[3, 9, -1], [6, 12, 0], [9, 10, 1], [12, 7, 1], [8, 6, -1]]) {
    for (let k = 0; k < h; k++) t.set(x0 + Math.round((k / h) * lean * 2), 15 - k, pal[k < 2 ? 0 : k > h - 3 ? 2 : 1]);
  }
}
def('crimson_roots', (t) => roots(t, [0x5a1020, 0x8a1c2c, 0xc04050]));
def('warped_roots', (t) => roots(t, [0x0e4a46, 0x1a7a72, 0x36b0a2]));

// Quartz and bone.
def('quartz_block', (t) => {
  speckle(t, [0xd8d0c8, 0xe4ddd6, 0xece6e0, 0xf4f0ec], { cell: 8, grain: 0.25 });
  frame(t, 0xfcfaf8, 0xc8bfb6);
});
def('bone_block_side', (t) => {
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) t.set(x, y, x % 4 === 0 ? 0xc8c0a8 : (x + y * 3) % 7 === 0 ? 0xd8d0b8 : 0xe8e2cc);
  for (let x = 0; x < 16; x++) { t.set(x, 0, 0xf4f0e0); t.set(x, 15, 0xb8b098); }
});
def('bone_block_top', (t) => {
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
    const d = Math.hypot(x - 7.5, y - 7.5);
    t.set(x, y, d < 2.5 ? 0xb0a888 : Math.floor(d) % 3 === 0 ? 0xd0c8b0 : 0xe8e2cc);
  }
});

// The portal: violet, swirling (eight frames).
for (let f = 0; f < 8; f++) {
  def(f === 0 ? 'nether_portal' : `nether_portal_${f}`, (t) => {
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
      const a = Math.atan2(y - 7.5, x - 7.5), d = Math.hypot(x - 7.5, y - 7.5);
      const v = Math.sin(d * 0.9 - a * 2 + f * (Math.PI / 4)) * 0.5 + Math.sin((x * 3 + y * 5 + f * 7) * 0.7) * 0.2;
      const c = v > 0.45 ? 0xd48cff : v > 0.1 ? 0x9a40e8 : v > -0.3 ? 0x6a1cc8 : 0x4a0ca0;
      t.set(x, y, c, 200);
    }
  }, { group: f === 0 ? 8 : 1 });
}

// Items: nether quartz, a nether brick.
def('quartz', (t) => paint(t, ['', '', '', '.......##.......', '......#hl#......', '.....#hlll#.....', '....#hlllmm#....', '...#hlllmmmm#...', '...#llllmmmd#...',
  '....#llmmmd#....', '.....#lmmd#.....', '......#md#......', '.......##.......'], { '#': 0x6a605a, h: 0xffffff, l: 0xf0e8e0, m: 0xd8ccc2, d: 0xb8aca2 }));
def('nether_brick', (t) => paint(t, ['', '', '', '', '', '...##########...', '..#hhhhhhhhhl#..', '..#lllllllllm#..', '..#lmmmmmmmmd#..', '..#mmmmmmmmdd#..',
  '...##########...'], { '#': 0x140608, h: 0x7a2c30, l: 0x5e2428, m: 0x44181c, d: 0x301014 }));
