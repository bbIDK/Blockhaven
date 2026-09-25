// Gear, drawn like the tools and food: chunky shapes, a full dark outline, lit from the top left
// with bright highlights and a shaded underside. Buckets, the compass and clock, the glass
// bottle, books, the name tag and lead, snowballs, the shield, boats, the minecart, the item
// frame and the painting.
import { def, part, mix, form } from './core.js';
import { WOODS } from './terrain.js';

const tones = (pal, extra = {}) => ({ 1: pal[1], 2: pal[2], 3: pal[3], 4: pal[4], 5: pal[5], ...extra });
const IRON = [0x2e2e34, 0x6e6e76, 0x92929a, 0xb4b4bc, 0xd4d4da, 0xf4f4f8];
const GOLD = [0x5a3204, 0xa86a0c, 0xd4961a, 0xf0c02c, 0xfadd5c, 0xfff6b0];
function sprite(t, rows, legend, edge) { t.clear(); part(t, rows, legend, edge); }

// Circles (the compass, the clock, the snowball): `fn(dx, dy, d)` gives each pixel's character.
function disc(cx, cy, r, fn) {
  const rows = [];
  for (let y = 0; y < 16; y++) {
    let row = '';
    for (let x = 0; x < 16; x++) {
      const dx = x + 0.5 - cx, dy = y + 0.5 - cy, d = Math.hypot(dx, dy);
      row += d <= r ? fn(dx, dy, d) : '.';
    }
    rows.push(row);
  }
  return rows;
}
// Lit from the top left: 5 on the upper-left rim down to 1 on the lower right.
const litTone = (dx, dy, d, r) => {
  const k = -(dx + dy) / (Math.SQRT2 * Math.max(d, 0.001));
  const rim = d > r - 1.3;
  return rim ? (k > 0.55 ? '5' : k > 0 ? '4' : k > -0.55 ? '2' : '1') : (k > 0.3 ? '4' : k > -0.3 ? '3' : '2');
};

// ---------------------------------------------------------------- buckets
const BUCKET = [
  '................',
  '................',
  '................',
  '....44555554....',
  '...4jjjjjjjj3...',
  '..45iiiiiiii43..',
  '..455555554443..',
  '...4544444333...',
  '...4433333332...',
  '...4544444332...',
  '....44333322....',
  '....44333322....',
  '....43222221....',
  '.....322111.....'];
function bucket(t, back, front, glints = []) {
  sprite(t, BUCKET, tones(IRON, { j: back, i: front }), IRON[0]);
  for (const [x, y, c] of glints) t.set(x, y, c);
}
def('bucket', (t) => bucket(t, 0x2a2a30, 0x44444c));
def('water_bucket', (t) => bucket(t, 0x1c3a9a, 0x3a6ae0, [[5, 5, 0x9ac4ff], [6, 5, 0x6a9cf4], [9, 5, 0x6a9cf4]]));
def('lava_bucket', (t) => bucket(t, 0xc03a0a, 0xf07a18, [[5, 5, 0xffe070], [6, 5, 0xffb030], [10, 5, 0xffd050], [8, 4, 0xff9a20]]));
def('milk_bucket', (t) => bucket(t, 0xd8d8d4, 0xf8f8f4, [[5, 5, 0xffffff], [6, 5, 0xffffff]]));

// ---------------------------------------------------------------- compass and clock
// A compass: an iron case, a cream dial, and the needle (red end north).
def('compass', (t) => {
  const rows = disc(8, 8, 6.9, (dx, dy, d) => (d > 5.4 ? litTone(dx, dy, d, 6.9) : 'f'));
  sprite(t, rows, tones(IRON, { f: 0xe8dcc0 }), IRON[0]);
  for (let y = 3; y < 14; y++) for (let x = 3; x < 14; x++) if (t.get(x, y) === 0xe8dcc0 && x + y > 16) t.set(x, y, 0xd4c6a4);
  for (const [x, y] of [[5, 5], [6, 6], [6, 5], [7, 7]]) t.set(x, y, 0xd8281a);
  t.set(5, 4, 0xff6a50);
  for (const [x, y] of [[9, 9], [10, 10], [10, 9]]) t.set(x, y, 0x5a5a64);
  t.set(8, 8, 0x2a2a30);
});
// A clock: a gold case, its dial half day (sky and sun) and half night (moon and dark).
def('clock', (t) => {
  const rows = disc(8, 8, 6.9, (dx, dy, d) => (d > 5.4 ? litTone(dx, dy, d, 6.9) : dy < 0 ? 's' : 'n'));
  sprite(t, rows, tones(GOLD, { s: 0x6aa8ee, n: 0x1c2a5c }), GOLD[0]);
  for (const [x, y, c] of [[6, 5, 0xfff080], [7, 5, 0xfff8b0], [6, 4, 0xffe860], [7, 4, 0xfff080], [9, 11, 0xe8e8f4], [10, 11, 0xc8c8dc], [9, 12, 0xc8c8dc],
    [5, 10, 0xffffff], [11, 9, 0xffffff], [8, 8, 0x3a2408]]) t.set(x, y, c);
  for (let x = 3; x < 13; x++) if (t.get(x, 8) === 0x6aa8ee || t.get(x, 8) === 0x1c2a5c) t.set(x, 8, 0x3c6ac0);
});

// ---------------------------------------------------------------- bottle, books, tag, lead, snowball
// A book: a leather cover wrapped round the edges of its pages.
export const BOOK = [
  '................',
  '................',
  '..4555555554....',
  '..45333333342...',
  '..4533333334pp..',
  '..4533yyy334pP..',
  '..4533333334pP..',
  '..45333yy334pP..',
  '..4533333334pP..',
  '..4533333334pP..',
  '..4533333334pP..',
  '..4422222223pP..',
  '...12222222222..',
  '................'];
export function book(t, pal, deco) {
  t.clear();
  part(t, BOOK, tones(pal, { y: deco, p: 0xf4eedc, P: 0xd4ccb4 }), pal[0]);
}
def('book', (t) => book(t, [0x2a1206, 0x5a2610, 0x7a3616, 0x9a4a20, 0xb8622e, 0xd07e44], 0xe0b848));

// A name tag: a card tag, its corner clipped, on a loop of string.
def('name_tag', (t) => {
  sprite(t, [
    '............ww..',
    '...........w..w.',
    '...........w..w.',
    '..........45ww..',
    '.........455o4..',
    '........4554443.',
    '.......4554443..',
    '......4554443...',
    '.....4554443....',
    '....4554443.....',
    '...4554443......',
    '...454443.......',
    '....4433........',
    '.....33.........'], { 5: 0xfaf0d4, 4: 0xe0cc9e, 3: 0xc0a472, o: 0x3a2a14, w: 0xd8d8dc }, 0x4a3a1c);
});

// A lead: a coil of twisted rope, two turns of it, knotted, with the end hanging free.
def('lead', (t) => {
  sprite(t, [
    '................',
    '....trRtrR......',
    '...R......t.....',
    '..r..trRt..r....',
    '..t.R....R.R....',
    '..R.t....t.t....',
    '..r..RtrR..r....',
    '...t......t.....',
    '....rRtrRtkK....',
    '...........Kr...',
    '............t...',
    '............R...',
    '...........r....',
    '..........t.....',
    '..........R.....'], { t: 0xe4c48c, r: 0xb48a50, R: 0x8a6436, k: 0xf0d8a8, K: 0x6e4c28 }, 0x2a1c0a);
});

// A snowball: packed snow, bluish in its shadow.
def('snowball', (t) => {
  const rows = disc(8, 8.5, 5.4, (dx, dy, d) => litTone(dx, dy, d, 5.4));
  sprite(t, rows, { 5: 0xffffff, 4: 0xf2f6fa, 3: 0xdce6f0, 2: 0xb8c8dc, 1: 0x98aac4 }, 0x4a5a78);
  t.set(6, 5, 0xffffff); t.set(5, 6, 0xffffff);
});

// ---------------------------------------------------------------- shield
// A heater shield: oak boards bound in an iron rim, an iron band and boss across the middle.
def('shield', (t) => {
  sprite(t, [
    '................',
    '..rRRRRRRRRRRr..',
    '..R5wwbwwbww3r..',
    '..R4wwbwwbww3r..',
    '..R4wwbwwbww3r..',
    '..RiiiiIIiiiir..',
    '..RIIIIbbIIIIr..',
    '..R4wwbwwbww3r..',
    '..R4wwbwwbww3r..',
    '...R4wbwwbw3r...',
    '...R4wbwwbw3r...',
    '....R4bwwb3r....',
    '.....RRwwrr.....',
    '.......rr.......'], { R: 0xd0d0d8, r: 0x8a8a94, w: 0xb4884e, b: 0x7a5630, 5: 0xd8ac70, 4: 0xc49a5e, 3: 0x94703e, I: 0xe8e8f0, i: 0xa4a4ae }, 0x26262c);
  for (let y = 2; y < 12; y++) for (let x = 3; x < 13; x++) if (t.get(x, y) === 0xb4884e && t.r() < 0.25) t.set(x, y, (x + y) % 2 ? 0xa47a44 : 0xc4985c);
});

// ---------------------------------------------------------------- boats
// A rowing boat, side on and a little from above: a long planked hull swept up at bow and
// stern, the dark inside over the gunwale, and an oar resting in it.
const BOAT = [
  '................',
  '................',
  '................',
  '..........oO....',
  '.........oO.....',
  '.4......oO....4.',
  '.45....oO....54.',
  '.45555555O55554.',
  '..4jjjjjjOjjj3..',
  '..44444444444 3.',
  '...333333333 3..',
  '....22222222....'].map((r) => r.replace(/ /g, '3'));
for (const [name, w] of Object.entries(WOODS)) {
  def(`${name}_boat`, (t) => {
    const p = w.planks;
    sprite(t, BOAT, { 5: p[5], 4: p[4], 3: p[3], 2: p[2], 1: p[1], j: mix(p[0], 0x000000, 0.35), o: 0xc49a5a, O: 0x8a6436 },
      mix(p[0], 0x000000, 0.55));
    // (The planks' seams along the hull.)
    for (let x = 4; x < 13; x += 4) t.set(x, 9, p[2]);
    for (let x = 6; x < 11; x += 4) t.set(x, 10, p[1]);
  });
}

// ---------------------------------------------------------------- minecart
// A minecart: an open iron tub on four wheels.
def('minecart_item', (t) => {
  sprite(t, [
    '................',
    '................',
    '................',
    '..455555555554..',
    '..4jjjjjjjjjj3..',
    '..4ijjjjjjjji3..',
    '..455555555543..',
    '..4444444444432.',
    '..43o3333333o32.',
    '..4433333333332.',
    '...32222222222..',
    '...kKk....kKk...',
    '...kkk....kkk...'], tones(IRON, { j: 0x2e2e34, i: 0x44444c, o: 0x5a5a64, k: 0x1e1e22, K: 0x6a6a74 }), IRON[0]);
});

// ---------------------------------------------------------------- item frame and painting
const FRAME_WOOD = WOODS.oak.planks;
// An item frame: a square of oak with a leather back.
def('item_frame_item', (t) => {
  sprite(t, [
    '................',
    '.55555555555554.',
    '.54444444444443.',
    '.54llllllllll32.',
    '.54lmmmmmmmmm32.',
    '.54lmmmmmmmmm32.',
    '.54lmmmmmmmmm32.',
    '.54lmmmmmmmmm32.',
    '.54lmmmmmmmmm32.',
    '.54lmmmmmmmmm32.',
    '.54lmmmmmmmmm32.',
    '.54lmmmmmmmmm32.',
    '.53333333333322.',
    '.42222222222221.'], { 5: FRAME_WOOD[5], 4: FRAME_WOOD[4], 3: FRAME_WOOD[2], 2: FRAME_WOOD[1], 1: FRAME_WOOD[0], l: 0x6a4424, m: 0x8a5a32 }, 0x2a1c0c);
  for (let y = 4; y < 12; y++) for (let x = 4; x < 13; x++) if (t.r() < 0.18) t.set(x, y, 0x7a4e2a);
});
// A painting: a landscape in a wooden frame.
def('painting_item', (t) => {
  sprite(t, [
    '................',
    '.55555555555554.',
    '.5ssssssssssss2.',
    '.5sssssssssyYs2.',
    '.5sssssssssYys2.',
    '.5ssssssssssss2.',
    '.5sshsssssssss2.',
    '.5shhhsssssgss2.',
    '.5hhhhhsssgggs2.',
    '.5hhhhhhhggggg2.',
    '.5HHHhhhhhgggg2.',
    '.5HHHHHHhhhhhh2.',
    '.5HHHHHHHHHHhh2.',
    '.42222222222221.'], { 5: FRAME_WOOD[5], 4: FRAME_WOOD[4], 2: FRAME_WOOD[1], 1: FRAME_WOOD[0], s: 0x8ac4f0, y: 0xfff4a0, Y: 0xf8d860,
    h: 0x5aa83a, H: 0x3a7a2a, g: 0x7a9a4a }, 0x2a1c0c);
});

// An enchanted book: the book bound in purple, with gold on its cover (it shimmers like anything
// enchanted).
def('enchanted_book', (t) => {
  book(t, [0x1e0a2a, 0x3e1658, 0x5a2478, 0x7438a0, 0x9454c4, 0xb47ae0], 0xf0c848);
  t.set(5, 4, 0xe8c8ff); t.set(4, 8, 0xe8c8ff);
});

// ---------------------------------------------------------------- armour
// [outline, 1 darkest .. 5 highlight] for each material.
const ARMOUR_PAL = {
  leather: [0x3a1e0c, 0x6a3a1c, 0x8a4e26, 0xa86432, 0xc27e44, 0xd89a5c],
  iron: [0x2e2e34, 0x7c7c84, 0xa4a4ac, 0xc6c6cc, 0xe2e2e6, 0xffffff],
  golden: [0x5a3204, 0xa86a0c, 0xd4961a, 0xf0c02c, 0xfadd5c, 0xfff6b0],
  diamond: [0x0a4244, 0x168a8a, 0x2abebb, 0x4cdcd4, 0x8cf2ea, 0xdcfffa],
  chainmail: [0x24242a, 0x4a4a52, 0x66666e, 0x84848c, 0xa4a4ac, 0xc8c8d0],
};
// Shapes ('x' shaded by form) with their details: 'b' a darker band or seam, 'h' a highlight,
// 'r' a rivet.
const ARMOUR = {
  helmet: [
    '................',
    '................',
    '................',
    '....xhhhxxxx....',
    '...xhxxxxxxxx...',
    '..xhxxxxxxxxxx..',
    '..xxxxxxxxxxxx..',
    '..xxxxxxxxxxxx..',
    '..brbbbbbbbbrb..',
    '..xxx......xxx..',
    '..xxx......xxx..',
    '..xx........xx..'],
  chestplate: [
    '................',
    '..xhhx....xxxx..',
    '.xhxxxx..xxxxxx.',
    '.xhxxxbhhbxxxxx.',
    '.xxxxxxbhxxxxxx.',
    '.xxxxxxbhxxxxxx.',
    '..xxxxxbhxxxxx..',
    '...xxxxbhxxxx...',
    '...xxxxbhxxxx...',
    '...xxxxbhxxxx...',
    '...bbbbrrbbbb...',
    '...xxxxbhxxxx...',
    '...xxxxbhxxxx...',
    '....xxxbhxxx....'],
  leggings: [
    '................',
    '................',
    '...bbbbrrbbbb...',
    '...xhhxxxxxxx...',
    '...xhxxxxxxxx...',
    '...xhxxxxxxxx...',
    '...xhxx..xxxx...',
    '...xhxx..xxxx...',
    '...xxxx..xxxx...',
    '...xhxx..xhxx...',
    '...xxxx..xxxx...',
    '...xxxx..xxxx...',
    '...xxxx..xxxx...',
    '...bbbb..bbbb...'],
  boots: [
    '................',
    '................',
    '................',
    '................',
    '................',
    '................',
    '...bbb....bbb...',
    '...xhx....xhx...',
    '...xhx....xhx...',
    '...xxx....xxx...',
    '..xhxx....xxxx..',
    '.xhxxx....xxxxx.',
    '.bbbbb....bbbbb.'],
};
for (const [mat, pal] of Object.entries(ARMOUR_PAL)) {
  for (const [piece, rows] of Object.entries(ARMOUR)) {
    def(`${mat}_${piece}`, (t) => {
      t.clear();
      form(t, rows, pal, { legend: { b: pal[2], h: pal[5], r: pal[4] }, grain: mat === 'leather' ? 0.15 : 0 });
      if (mat === 'chainmail') {
        // Rings of mail: little dark holes in rows.
        for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
          if (rows[y]?.[x] === 'x' && (x + (y % 2) * 1) % 2 === 0 && y % 2 === 0) t.set(x, y, pal[1]);
        }
      }
      if (mat === 'leather') {
        // Stitching down the seams.
        for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) if (rows[y]?.[x] === 'b' && x % 2 === 0) t.set(x, y, 0xe8c89a);
      }
    });
  }
}
