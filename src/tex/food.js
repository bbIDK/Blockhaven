// Food. Every creature's meat has its own shape, raw and cooked: a pork chop with its rind and
// rib bone, a marbled slab of beef (a grilled steak once cooked), a leg of mutton on the bone, a
// whole plucked chicken, a skinned rabbit, and the fish. Then the crops, the baking and the bowls.
// Drawn like the tools: a full dark outline, lit from the top left, highlights and shadow by hand.
import { def, part, form, mix } from './core.js';

// A meat's colours: [outline, 1 darkest .. 5 lightest], and its fat and bone.
const RAW_PORK = [0x5a1e22, 0xb05a5c, 0xd07a7a, 0xe89a96, 0xf6b8b2, 0xffd6d0];
const COOKED_PORK = [0x2e1606, 0x7a4018, 0x9a5624, 0xb87032, 0xd48c44, 0xe8ac62];
const RAW_BEEF = [0x3a080a, 0x86161a, 0xa82224, 0xc83830, 0xe0564a, 0xf07c6c];
const COOKED_BEEF = [0x1c0e06, 0x4a2a12, 0x643818, 0x7e4a22, 0x9a602e, 0xb67a40];
const RAW_MUTTON = [0x3a0a10, 0x8e2230, 0xb03440, 0xcc4c50, 0xe06a66, 0xf08c84];
const COOKED_MUTTON = [0x241208, 0x62341a, 0x7c4422, 0x985a2e, 0xb4743e, 0xcc9254];
const RAW_CHICKEN = [0x6a3c2c, 0xc8907a, 0xdcaa94, 0xecc4ae, 0xf6dac8, 0xfff0e4];
const COOKED_CHICKEN = [0x3a1a06, 0x8a4414, 0xac5e1e, 0xca7c2e, 0xe29c44, 0xf4be64];
const RAW_RABBIT = [0x4a1c22, 0xa44a54, 0xc0646a, 0xd68284, 0xe8a2a0, 0xf6c2be];
const COOKED_RABBIT = [0x2a1608, 0x6e3e1c, 0x8c5426, 0xa86c34, 0xc48848, 0xdca662];
const BONE = { b: 0xf2eee0, B: 0xcac2aa };

const tones = (pal, extra = {}) => ({ 1: pal[1], 2: pal[2], 3: pal[3], 4: pal[4], 5: pal[5], ...extra });

// A pork chop: the meat with its rind of fat round the outside and the end of a rib bone.
const PORKCHOP = [
  '................',
  '................',
  '........ffff....',
  '......ffFFFFf...',
  '.....f5444FFFf..',
  '....f55444333Ff.',
  '....f54443333Ff.',
  '....f4433332ff..',
  '.....f333222f...',
  '.....f322221f...',
  '......f2211f....',
  '....bb.f11f.....',
  '...bBb..ff......',
  '..bBb...........',
  '..bb............',
  '................'];
def('raw_porkchop', (t) => { t.clear(); part(t, PORKCHOP, tones(RAW_PORK, { f: 0xf4ded6, F: 0xfff4ee, ...BONE }), RAW_PORK[0]); });
def('cooked_porkchop', (t) => {
  t.clear();
  part(t, PORKCHOP, tones(COOKED_PORK, { f: 0xe2bc80, F: 0xf2d6a0, ...BONE }), COOKED_PORK[0]);
  for (const [x, y] of [[7, 5], [8, 6], [9, 7], [6, 7], [7, 8]]) t.set(x, y, 0x5a2e10);
});

// Beef: a thick slab marbled with fat. Cooked, it's a steak with grill marks.
const BEEF = [
  '................',
  '................',
  '....44455.......',
  '..445ff544433...',
  '.4455f44f443333.',
  '.4444444ff33332.',
  '.44ff444433ff32.',
  '.4f33ff4333f322.',
  '.43333f3332f222.',
  '.333ff32222f221.',
  '..3333f22ff2211.',
  '...2222222221...',
  '....22111111....',
  '................'];
def('raw_beef', (t) => { t.clear(); part(t, BEEF, tones(RAW_BEEF, { f: 0xf2d0c8 }), RAW_BEEF[0]); });
def('cooked_beef', (t) => {
  t.clear();
  part(t, BEEF, tones(COOKED_BEEF, { f: 0xc49868 }), COOKED_BEEF[0]);
  for (let k = 0; k < 3; k++) for (let i = 0; i < 5; i++) {
    const x = 3 + k * 4 + i, y = 3 + i;
    if (t.alpha(x, y) && t.get(x, y) !== COOKED_BEEF[0]) t.set(x, y, 0x2e1a0a);
  }
});

// Mutton: a leg on the bone, the knuckle end of the bone showing.
const MUTTON = [
  '................',
  '................',
  '.........455....',
  '.......4554443..',
  '......455444333.',
  '.....4544443332.',
  '.....4444333322.',
  '.....4433332221.',
  '......43322221..',
  '......3322211...',
  '.....bb32211....',
  '....bBb.11......',
  '...bBb..........',
  '.bbBb...........',
  '.bBB............',
  '..b.............'];
def('raw_mutton', (t) => { t.clear(); part(t, MUTTON, tones(RAW_MUTTON, BONE), RAW_MUTTON[0]); });
def('cooked_mutton', (t) => { t.clear(); part(t, MUTTON, tones(COOKED_MUTTON, BONE), COOKED_MUTTON[0]); });

// Chicken: the whole bird, plucked, its drumsticks up.
const CHICKEN = [
  '................',
  '................',
  '..bb........bb..',
  '..bBb......bBb..',
  '...b45....44b...',
  '...4554..443....',
  '...45544443332..',
  '..45544444333322',
  '..45444443333321',
  '..44444433333221',
  '..34443333322221',
  '...333333222221.',
  '....3322222211..',
  '.....22211111...',
  '................'];
def('raw_chicken', (t) => { t.clear(); part(t, CHICKEN, tones(RAW_CHICKEN, BONE), RAW_CHICKEN[0]); });
def('cooked_chicken', (t) => { t.clear(); part(t, CHICKEN, tones(COOKED_CHICKEN, BONE), COOKED_CHICKEN[0]); });

// Rabbit: skinned, long in the back legs.
const RABBIT = [
  '................',
  '................',
  '................',
  '...........45...',
  '..........4543..',
  '.........45433..',
  '....4455443332..',
  '...455444433322.',
  '..4544443333222.',
  '..44433333222211',
  '...33322222111..',
  '...322.....21...',
  '..322.......21..',
  '..22.........1..',
  '................'];
def('raw_rabbit', (t) => { t.clear(); part(t, RABBIT, tones(RAW_RABBIT), RAW_RABBIT[0]); });
def('cooked_rabbit', (t) => { t.clear(); part(t, RABBIT, tones(COOKED_RABBIT), COOKED_RABBIT[0]); });

// ---------------------------------------------------------------- fish
// A fish facing left: forked tail, fins, an eye and a gill line; pale belly, darker back.
const FISH = [
  '................',
  '................',
  '................',
  '......ff........',
  '.....ffff....ff.',
  '...4445554..fff.',
  '..455555444ff3f.',
  '.4e5555444433f..',
  '.45g55444433f...',
  '.4gBBB443322ff..',
  '..3BBBBB3221fff.',
  '...33BB222..ff..',
  '.....ff.........',
  '................'];
function fish(t, pal, fin, belly) {
  t.clear();
  part(t, FISH, tones(pal, { f: fin, e: 0x101010, g: pal[2], B: belly }), pal[0]);
  t.set(2, 6, 0xf8f8f8);
}
def('cod', (t) => fish(t, [0x3a3020, 0x8a7a5a, 0xa49472, 0xbcae8c, 0xd2c6a6, 0xe6dcc0], 0x9a8a66, 0xf0e8d4));
def('cooked_cod', (t) => fish(t, [0x3a2210, 0x9a6e3e, 0xb48650, 0xcca064, 0xe0ba80, 0xf0d4a0], 0x8a5e30, 0xf4e0bc));
def('salmon', (t) => fish(t, [0x3a1414, 0x9a3830, 0xb84a3e, 0xd0624e, 0xe48064, 0xf2a084], 0x7a2c26, 0xf4c4b0));
def('cooked_salmon', (t) => fish(t, [0x3a1a0a, 0xa05a2a, 0xba7038, 0xd08c4a, 0xe4a862, 0xf2c688], 0x7a4420, 0xf6dcb4));
// A tropical fish: orange, with two white bands edged in black.
def('tropical_fish', (t) => {
  fish(t, [0x4a1602, 0xc04a0a, 0xe0661a, 0xf2822a, 0xfa9e46, 0xffc07a], 0xb8400a, 0xffd4a8);
  for (let y = 0; y < 16; y++) for (const [x, band] of [[4, false], [5, true], [6, false], [9, false], [10, true], [11, false]]) {
    if (!t.alpha(x, y) || t.get(x, y) === 0x4a1602) continue;
    t.set(x, y, band ? 0xfaf6f0 : 0x5a1c04);
  }
});
// A pufferfish, puffed up: a round yellow body with a pale belly, spines all round, and small
// blue fins and tail.
const PUFFER = [0x4a3206, 0x9a6a10, 0xc8901a, 0xe8b420, 0xf8d040, 0xfff08a];
def('pufferfish', (t) => {
  t.clear();
  part(t, [
    '................',
    '................',
    '................',
    '................',
    '.............T..',
    '............tTT.',
    '............tt..',
    '............tTT.',
    '.............T..',
    '................',
    '.......f........',
    '......ff........'], { t: 0x3a8aa8, T: 0x62b0cc, f: 0x3a8aa8 }, 0x1c3440);
  form(t, [
    '................',
    '................',
    '................',
    '.....xxxx.......',
    '...xxxxxxxx.....',
    '..xxxxxxxxxx....',
    '..xxxxxxxxxx....',
    '..xxxxxxxxxx....',
    '..xxxxxxxxxx....',
    '..xxxxxxxxxx....',
    '...xxxxxxxx.....',
    '.....xxxx.......'], PUFFER);
  // Its pale belly, an eye, a mouth, and the spines.
  for (const [x0, x1, y] of [[4, 9, 9], [5, 8, 10]]) for (let x = x0; x <= x1; x++) t.set(x, y, y === 10 ? 0xe8d0a0 : 0xf8ecc8);
  t.set(4, 5, 0xffffff); t.set(4, 6, 0x101010); t.set(5, 6, 0x101010);
  t.set(2, 8, 0x8a3a1a);
  for (const [x, y] of [[5, 1], [8, 1], [2, 3], [11, 3], [0, 6], [0, 9], [2, 12], [5, 13], [8, 13], [11, 12]]) t.set(x, y, 0xf0e6c4);
});

// ---------------------------------------------------------------- bowls
// A wooden bowl seen from a little above: its rim, what's in it, and its rounded body.
const BOWL = [
  '................',
  '................',
  '................',
  '................',
  '....rrrrrrrr....',
  '..rriiiiiiiirr..',
  '.riiiiiiiiiiiir.',
  '.rriiiiiiiiiirr.',
  '.45rrrrrrrrrr32.',
  '..455444433322..',
  '...4444333322...',
  '....33332222....',
  '.....221111.....',
  '................'];
const BOWL_WOOD = [0x3a2410, 0x6a4a26, 0x87603a, 0xa27a48, 0xbc955c, 0xd4b078];
function bowl(t, inside, bits = []) {
  t.clear();
  part(t, BOWL, tones(BOWL_WOOD, { r: BOWL_WOOD[5], i: inside ?? BOWL_WOOD[1] }), BOWL_WOOD[0]);
  if (inside) {
    // A shine on the soup, and what's floating in it.
    for (const [x, y] of [[4, 5], [5, 5], [3, 6]]) t.set(x, y, mix(inside, 0xffffff, 0.35));
    for (const [x, y, c] of bits) t.set(x, y, c);
  }
}
def('bowl', (t) => bowl(t, null));
def('mushroom_stew', (t) => bowl(t, 0x7a4a22, [[7, 6, 0xe8d4b4], [8, 6, 0xc8aa84], [10, 5, 0xc83a2a], [11, 6, 0xe8d4b4], [6, 7, 0xb89468], [12, 7, 0xc83a2a]]));
def('beetroot_soup', (t) => bowl(t, 0xa8182c, [[7, 6, 0x6a0c1a], [10, 5, 0xd83a50], [11, 7, 0x6a0c1a], [5, 7, 0xd83a50]]));
def('rabbit_stew', (t) => bowl(t, 0x8a5a26, [[6, 6, 0xf08a28], [7, 6, 0xf08a28], [10, 5, 0xdcb870], [11, 6, 0xe8c888], [8, 7, 0xc0763a], [4, 7, 0x5aa83a]]));

// ---------------------------------------------------------------- the rest
// Rotten flesh: a ragged, greenish scrap with dark rot in it.
def('rotten_flesh', (t) => {
  t.clear();
  part(t, [
    '................',
    '................',
    '.....45.........',
    '....4554.44.....',
    '...45544455433..',
    '..4554d44443333.',
    '..44444433d3332.',
    '...4d4433333322.',
    '..44443333d3222.',
    '..4333d3322221..',
    '...33332222.21..',
    '....3.222211....',
    '.......21.......',
    '................'], { 5: 0xb4b474, 4: 0x94985a, 3: 0x7a7c46, 2: 0x5e5e36, 1: 0x46442a, d: 0x3a2a1a }, 0x22200e);
});

// Potatoes: a knobbly tuber with eyes; baked, golden and split; poisonous, green-tinged.
const POTATO = [
  '................',
  '................',
  '................',
  '.......4455.....',
  '.....4455544....',
  '....45554e443...',
  '...4555444433...',
  '...45e44444332..',
  '...44444433e32..',
  '...4443333332...',
  '....33333222....',
  '.....2222211....',
  '................'];
function potato(t, pal, eye) { t.clear(); part(t, POTATO, tones(pal, { e: eye }), pal[0]); }
def('potato', (t) => potato(t, [0x4a3214, 0x9c7436, 0xb88e4a, 0xcfa862, 0xe2c27e, 0xf2dca0], 0x7a5626));
def('baked_potato', (t) => {
  potato(t, [0x3e2008, 0x94581c, 0xb4722a, 0xd08e3c, 0xe6ac56, 0xf6ce7e], 0x6a3a10);
  // Split along the top, the soft inside showing.
  for (const [x, y, c] of [[6, 5, 0xfff0b8], [7, 5, 0xffe49a], [8, 6, 0xfff0b8], [9, 6, 0xffe49a], [10, 7, 0xf8d888]]) t.set(x, y, c);
});
def('poisonous_potato', (t) => potato(t, [0x2e3a12, 0x7a8a30, 0x94a444, 0xaebe5c, 0xc6d47a, 0xdee89c], 0x4a5a1a));

// A spider's eye: a glossy dark red eyeball, veined, with a black pupil catching the light.
def('spider_eye', (t) => {
  t.clear();
  part(t, [
    '................',
    '................',
    '................',
    '.....45554......',
    '....4555443.....',
    '...455vppv43....',
    '...45vpppp433...',
    '...44ppwppv33...',
    '...44pppp4332...',
    '...344vpv43322..',
    '....33443332....',
    '.....332222.....',
    '......2211......',
    '................'], { 5: 0xf07a86, 4: 0xd8465a, 3: 0xb82c42, 2: 0x8e1a30, 1: 0x6a1024, p: 0x1a0a0e, w: 0xffffff, v: 0x6a0a1a }, 0x2e0610);
});
