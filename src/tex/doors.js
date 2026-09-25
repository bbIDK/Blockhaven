// Doors, one design per wood as in Minecraft: oak with four panes of glass over sunken panels,
// spruce boards bound with iron bands and a ring handle, birch with a pale lattice window, jungle
// with an arched window over carving, acacia with tall slots, dark oak with four deep panels and a
// brass handle, cherry with a lattice window over fluting, and iron with panes over pressed
// plates. Each door is drawn whole (16 x 32, the top half over the bottom one), then cut into
// its two block textures; glass and gaps are see-through. The door as carried is its own little
// picture, drawn to match.
import { def } from './core.js';
import { WOODS } from './terrain.js';

const IRON = [0x4a4a50, 0x8a8a92, 0xa8a8b0, 0xc4c4ca, 0xdcdce0, 0xf2f2f4];
// Hinges and handles: dark, mid, light.
const METAL = [0x2c2c30, 0x55555c, 0x8c8c94];

// Map characters: 0-5 the wood's own tones (darkest to lightest); 'g' its grain (tones 2 to 4,
// streaked along upright boards), 'd' darker grain (1 to 3), 'G' lighter (3 to 5); '.' see-through;
// 'h'/'H' a hinge, 'k'/'K'/'L' a handle (dark, mid, light). Each door adds its own letters.
function grainOf(t) {
  const f = t.field([[1, 8, 0.55], [2, 16, 0.3]], 0.25);
  return (i, lo) => lo + (f[i] < 0.42 ? 0 : f[i] < 0.68 ? 1 : 2);
}
function paintDoor(t, rows, pal, extra) {
  const g = grainOf(t);
  const legend = { h: METAL[0], H: METAL[1], k: METAL[0], K: METAL[1], L: METAL[2], ...extra };
  rows.forEach((row, y) => {
    if (row.length !== 16) throw new Error(`door row ${y} is ${row.length} wide: ${row}`);
    for (let x = 0; x < 16; x++) {
      const ch = row[x], i = y * 16 + x;
      if (ch === '.') t.set(x, y, 0, 0);
      else if (ch >= '0' && ch <= '5') t.set(x, y, pal[+ch]);
      else if (legend[ch] !== undefined) t.set(x, y, legend[ch]);
      else if (ch === 'g') t.set(x, y, pal[g(i, 2)]);
      else if (ch === 'd') t.set(x, y, pal[g(i, 1)]);
      else if (ch === 'G') t.set(x, y, pal[g(i, 3)]);
      else throw new Error(`door: no colour for '${ch}'`);
    }
  });
}

// ---------------------------------------------------------------- the designs (32 rows each)
const DOORS = {
  // Four panes in two rows, then sunken panels down to the floor; three hinges and a knob.
  oak: [
    '2555555555555551',
    '24gggggggggggg31',
    '2411111411111431',
    'hH1....41....431',
    'hh1....41....431',
    '241....41....431',
    '2435555435555431',
    '2411111411111431',
    '241....41....431',
    '241....41....431',
    '241....41....431',
    '2435555435555431',
    '24gggggggggggg31',
    '24gggggggggggg31',
    '2411111411111431',
    'hH1gggg41gggg431',
    'hh1gggg41ggggLK1',
    '241gggg41ggggkk1',
    '241gggg41gggg431',
    '241gggg41gggg431',
    '2435555435555431',
    '24gggggggggggg31',
    '2411111411111431',
    '241gggg41gggg431',
    '241gggg41gggg431',
    '241gggg41gggg431',
    '241gggg41gggg431',
    'hH1gggg41gggg431',
    'hh1gggg41gggg431',
    '2435555435555431',
    '24gggggggggggg31',
    '1222222222222221'],
  // Upright boards with dark seams, three riveted iron bands (their ends are the hinges) and an
  // iron ring to pull it by.
  spruce: [
    '3555455455455451',
    '1gg1gg1gg1gg1gg1',
    '1gg1gg1gg1gg1gg1',
    'iiriiiiriiiiriii',
    'hIIIIIIIIIIIIIII',
    '1gg1gg1gg1gg1gg1',
    '1gg1gg1gg1gg1gg1',
    '1gg1gg1gg1gg1gg1',
    '1gg1gg1gg1gg1gg1',
    '1gg1gg1gg1gg1gg1',
    '1gg1gg1gg1gg1gg1',
    '1gg1gg1gg1gg1gg1',
    '1gg1gg1gg1gg1gg1',
    '1gg1gg1gg1gg1gg1',
    '1gg1gg1gg1gg1gg1',
    'iiriiiiriiiiriii',
    'hIIIIIIIIIIIIIII',
    '1gg1gg1gg1grr1g1',
    '1gg1gg1gg1rggI91',
    '1gg1gg1gg1rggI91',
    '1gg1gg1gg1gII1g1',
    '1gg1gg1gg1gg1gg1',
    '1gg1gg1gg1gg1gg1',
    '1gg1gg1gg1gg1gg1',
    '1gg1gg1gg1gg1gg1',
    '1gg1gg1gg1gg1gg1',
    '1gg1gg1gg1gg1gg1',
    'iiriiiiriiiiriii',
    'hIIIIIIIIIIIIIII',
    '1gg1gg1gg1gg1gg1',
    '1gg1gg1gg1gg1gg1',
    '1000000000000001'],
  // Pale boards; a window of white panes in a lattice fills the upper part.
  birch: [
    '2555555555555551',
    '24gggggggggggg31',
    '2411111111111431',
    'hH1wwwlwwwlwww51',
    'hh1wwwlwwwlwww51',
    '241wwwlwwwlwww51',
    '241llllllllllL51',
    '241wwwlwwwlwww51',
    '241wwwlwwwlwww51',
    '241wwwlwwwlwww51',
    '241llllllllllL51',
    '241wwwlwwwlwww51',
    '241wwwlwwwlwww51',
    '241wwwlwwwlwww51',
    '241llllllllllL51',
    'hH1wwwlwwwlwww51',
    'hh1wwwlwwwlwwkK1',
    '241wwwlwwwlwwkk1',
    '2435555555555531',
    '24gggggggggggg31',
    '24gggggggggggg31',
    '2411111411111431',
    '241GGGG41GGGG431',
    '241GGGG41GGGG431',
    '241GGGG41GGGG431',
    '241GGGG41GGGG431',
    '241GGGG41GGGG431',
    'hH1GGGG41GGGG431',
    'hh1GGGG41GGGG431',
    '2435555435555431',
    '24gggggggggggg31',
    '1222222222222221'],
  // An arched window of three lights, then carving: a pointed panel and a tall one with a
  // raised spine.
  jungle: [
    '2555555555555551',
    '24gggggggggggg31',
    '24gggg1111gggg31',
    'hHgg111..111gg31',
    'hhg11.4..4.11g31',
    '24g1..4..4..4g31',
    '24g1..4..4..4g31',
    '24g1..4..4..4g31',
    '24g1..4..4..4g31',
    '24g3555555555g31',
    '24gggggggggggg31',
    '2411111111111431',
    '241ddd1554ddd431',
    '241ddd1g34ddd431',
    '241ddd1g34ddd431',
    'hH1ddd1g34ddd431',
    'hh1ddd1g34dddLK1',
    '241ddd1g34dddkk1',
    '241ddd1g34ddd431',
    '241ddd1g34ddd431',
    '241ddd1g34ddd431',
    '241ddd1g34ddd431',
    '241ddd1g34ddd431',
    '241ddd1g34ddd431',
    '241ddd1g34ddd431',
    '241ddd1g34ddd431',
    '241ddd1g34ddd431',
    'hH1ddd1g34ddd431',
    'hh1ddd1g34ddd431',
    '2435555555555431',
    '24gggggggggggg31',
    '1222222222222221'],
  // Three tall slots in each half, split by a rail across the middle.
  acacia: [
    '2555555555555551',
    '24gggggggggggg31',
    '24g1141141141311',
    'hHg1..51..51..51',
    'hhg1..51..51..51',
    '24g1..51..51..51',
    '24g1..51..51..51',
    '24g1..51..51..51',
    '24g1..51..51..51',
    '24g1..51..51..51',
    '24g1..51..51..51',
    '24g1..51..51..51',
    '24g1..51..51..51',
    '24g1..51..51..51',
    '24g1..51..51..51',
    'hHg3555355535551',
    'hhggggggggggLK31',
    '24g11411411kk131',
    '24g1..51..51..51',
    '24g1..51..51..51',
    '24g1..51..51..51',
    '24g1..51..51..51',
    '24g1..51..51..51',
    '24g1..51..51..51',
    '24g1..51..51..51',
    '24g1..51..51..51',
    '24g1..51..51..51',
    'hHg1..51..51..51',
    'hhg1..51..51..51',
    '24g3555355535551',
    '24gggggggggggg31',
    '1222222222222221'],
  // Four tall sunken panels and a brass handle.
  dark_oak: [
    '3555555555555551',
    '35gggggggggggg31',
    '3500000300000331',
    'hH0gggg50gggg531',
    'hh0gggg50gggg531',
    '350gggg50gggg531',
    '350gggg50gggg531',
    '350gggg50gggg531',
    '350gggg50gggg531',
    '350gggg50gggg531',
    '350gggg50gggg531',
    '350gggg50gggg531',
    '350gggg50gggg531',
    '350gggg50gggg531',
    '3535555535555531',
    'hHgggggggggBbg31',
    'hhgggggggggbng31',
    '3500000300000331',
    '350gggg50gggg531',
    '350gggg50gggg531',
    '350gggg50gggg531',
    '350gggg50gggg531',
    '350gggg50gggg531',
    '350gggg50gggg531',
    '350gggg50gggg531',
    '350gggg50gggg531',
    '350gggg50gggg531',
    'hH0gggg50gggg531',
    'hh0gggg50gggg531',
    '3535555535555531',
    '35gggggggggggg31',
    '2111111111111111'],
  // A lattice window of diamonds, then a round boss over fluted boards.
  cherry: [
    '2555555555555551',
    '24gggggggggggg31',
    '2411111111111431',
    'hH1l..llll..l431',
    'hh1llll..llll431',
    '241.ll....ll.431',
    '241llll..llll431',
    '241l..llll..l431',
    '241....ll....431',
    '241l..llll..l431',
    '241llll..llll431',
    '241.ll....ll.431',
    '241llll..llll431',
    '241l..llll..l431',
    '2435555555555431',
    'hHgggggggggggg31',
    'hhgggggPpgggLK31',
    '24ggggP22qggkk31',
    '24ggggp22qggg431',
    '24gggggqqgggg431',
    '24gggggggggggg31',
    '2411111111111431',
    '2414242424242431',
    '2414242424242431',
    '2414242424242431',
    '2414242424242431',
    '2414242424242431',
    'hH14242424242431',
    'hh14242424242431',
    '2435555555555431',
    '24gggggggggggg31',
    '1222222222222221'],
};
// Extra colours for each design.
const EXTRA = {
  spruce: { i: 0x6e6e76, I: 0x3a3a40, r: 0xa4a4ac, 9: 0x26262a },
  birch: { w: 0xf6f2e2, l: 0xe0d6b4, L: 0xcfc39c, h: 0x4a3418, H: 0x6e4e26, k: 0x4a3418, K: 0x6e4e26 },
  dark_oak: { b: 0xd8a41c, B: 0xffe066, n: 0x8a5e08 },
  cherry: { p: 0xf0dcd4, P: 0xfff6f0, q: 0xb88a84, l: WOODS.cherry.planks[4] },
};

for (const [name, w] of Object.entries(WOODS)) {
  const rows = DOORS[name] ?? DOORS.oak, pal = w.planks, extra = EXTRA[name] ?? {};
  def(`${name}_door_top`, (t) => paintDoor(t, rows.slice(0, 16), pal, extra));
  def(`${name}_door_bottom`, (t) => paintDoor(t, rows.slice(16), pal, extra));
}

// Iron: two rows of panes, then pressed plates, riveted at their corners.
const IRON_DOOR = [
  '2555555555555551',
  '2444444444444431',
  '2411111411111431',
  'hH1....41....431',
  'hh1....41....431',
  '241....41....431',
  '2435555435555431',
  '2411111411111431',
  '241....41....431',
  '241....41....431',
  '241....41....431',
  '2435555435555431',
  '2444444444444431',
  '2455555455555431',
  '2453333253333231',
  'hH53333253333231',
  'hh533332533kk231',
  '245333325335L231',
  '2453333253333231',
  '2442222242222231',
  '2444444444444431',
  '2455555455555431',
  '2453333253333231',
  '2453333253333231',
  '2453333253333231',
  '2453333253333231',
  '2453333253333231',
  'hH53333253333231',
  'hh42222242222231',
  '2444444444444431',
  '2333333333333331',
  '1111111111111111'];
def('iron_door_top', (t) => paintDoor(t, IRON_DOOR.slice(0, 16), IRON, {}));
def('iron_door_bottom', (t) => paintDoor(t, IRON_DOOR.slice(16), IRON, {}));

// ---------------------------------------------------------------- the doors as carried
// The whole door, small (10 x 14, standing in the middle of the icon), in the same tones.
const ICON = {
  oak: [
    '2555555553',
    '24...4...3',
    'h4...4...3',
    '2444444443',
    '24...4...3',
    '24...4...3',
    'h4444444Lk',
    '2411141113',
    '2413341333',
    '2455545553',
    'h411141113',
    '2413341333',
    '2455545553',
    '1222222221'],
  spruce: [
    '3554554551',
    '1431431431',
    'iiriiiirii',
    'hIIIIIIIII',
    '1431431431',
    '1431431431',
    'iiriiiirii',
    'hIIIIIIrrI',
    '143143r4r1',
    '1431431rI1',
    'iiriiiirii',
    'hIIIIIIIII',
    '1431431431',
    '1000000001'],
  birch: [
    '2555555553',
    '24wwlww443',
    'h4wwlww443',
    '24lllll443',
    '24wwlww4k3',
    '24wwlww4k3',
    'h4lllll443',
    '24wwlww443',
    '24wwlww443',
    '2455555553',
    'h4GGG3GGG3',
    '24GGG3GGG3',
    '24GGG3GGG3',
    '1222222221'],
  jungle: [
    '2555555553',
    '24g1111g43',
    'h41..4..13',
    '241..4..13',
    '2435555553',
    '24ggggggg3',
    'h4gg1111LK',
    '241d154dkk',
    '241d1g4d13',
    'h41d1g4d13',
    '241d1g4d13',
    '241d1g4d13',
    '2435555553',
    '1222222221'],
  acacia: [
    '2555555553',
    '241.51.513',
    'h41.51.513',
    '241.51.513',
    '241.51.513',
    '241.51.513',
    'h435553LK3',
    '24ggggggkk',
    '241.51.513',
    '241.51.513',
    'h41.51.513',
    '241.51.513',
    '2435553553',
    '1222222221'],
  dark_oak: [
    '3555555551',
    '3500300341',
    'h503503541',
    '3503503541',
    '3503503541',
    '3503503541',
    'h535535541',
    '3544444Bb1',
    '3500300341',
    '3503503541',
    'h503503541',
    '3503503541',
    '3535535541',
    '2111111111'],
  cherry: [
    '2555555553',
    '2411111143',
    'h4ll..ll43',
    '24l.ll.l43',
    '24.llll.43',
    '24l.ll.l43',
    'h4ll..ll43',
    '2455555543',
    '24ggPpggLK',
    '24ggpqggkk',
    'h411111143',
    '2414242443',
    '2435555543',
    '1222222221'],
};
const ICON_EXTRA = { ...EXTRA, birch: { ...EXTRA.birch, G: WOODS.birch.planks[4] } };
function doorIcon(t, rows, pal, extra) {
  t.clear();
  const legend = { h: METAL[0], H: METAL[1], k: METAL[0], K: METAL[1], L: METAL[2], g: pal[3], d: pal[2], G: pal[4], ...extra };
  rows.forEach((row, y) => {
    if (row.length !== 10) throw new Error(`door icon row ${y} is ${row.length} wide: ${row}`);
    for (let x = 0; x < 10; x++) {
      const ch = row[x];
      if (ch === '.') continue;
      const c = ch >= '0' && ch <= '5' ? pal[+ch] : legend[ch];
      if (c === undefined || c === null) throw new Error(`door icon: no colour for '${ch}'`);
      t.set(x + 3, y + 2, c);
    }
  });
}
for (const [name, w] of Object.entries(WOODS)) {
  def(`${name}_door_item`, (t) => doorIcon(t, ICON[name] ?? ICON.oak, w.planks, ICON_EXTRA[name] ?? {}));
}
def('iron_door_item', (t) => doorIcon(t, [
  '2555555553',
  '24...4...3',
  'h4...4...3',
  '2444444443',
  '24...4...3',
  '24...4...3',
  'h444444kk3',
  '2455545553',
  '2422242223',
  '2444444443',
  'h455545553',
  '2422242223',
  '2444444443',
  '1222222221'], IRON, {}));
