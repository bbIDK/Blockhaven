// Creature skins, painted over the boxes of their models (see rigs.js) with the same palettes,
// noise and light as the blocks: fur and hide are soft blotches of four or five shades, faces
// get a few careful pixels, and every creature is lit flat (the renderer shades each face).
import { skin, boxRegions } from '../skins.js';
import { RIGS } from '../rigs.js';
import { ramp, mix } from './core.js';

const reg = (cube) => boxRegions(cube.uv[0], cube.uv[1], cube.size[0], cube.size[1], cube.size[2]);
const cubesOf = (rig, bone) => RIGS[rig].bones[bone].cubes;
const SIDES = ['right', 'front', 'left', 'back'];
// Every face of every box of `bones` (boxes cut from another skin left out): fn(face, rect, cube).
function each(sk, rig, bones, fn, wanted = null) {
  for (const b of bones) {
    for (const cube of cubesOf(rig, b)) {
      if ((cube.skin ?? null) !== wanted) continue;
      sk.box(cube, (face, r) => fn(face, r, cube));
    }
  }
}
const fur = (sk, rig, bones, pal, o = {}, wanted = null) => each(sk, rig, bones, (face, r) => sk.fill(r, pal, o), wanted);
const at = (sk, r, x, y, c) => sk.set(r[0] + x, r[1] + y, c);
const row = (sk, r, y, c) => { for (let x = 0; x < r[2]; x++) sk.set(r[0] + x, r[1] + y, c); };
// Darken (k < 1) or lighten a rectangle already painted.
function tone(sk, [x0, y0, w, h], k) {
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const c = sk.get(x0 + x, y0 + y);
    sk.set(x0 + x, y0 + y, k < 1 ? mix(c, 0x000000, 1 - k) : mix(c, 0xffffff, k - 1));
  }
}
// The bottom rows of a limb's sides (hooves, paws, shoes).
function feet(sk, rig, bones, rows, pal) {
  each(sk, rig, bones, (face, r) => {
    if (face === 'top') return;
    if (face === 'bottom') { sk.fill(r, pal, { cell: 1, grain: 0.2 }); return; }
    sk.fill([r[0], r[1] + r[3] - rows, r[2], rows], pal, { cell: 1, grain: 0.3 });
  });
}
const eye = (sk, r, x, y, white, pupil, towardsMiddle = true) => {
  // A two-pixel eye; the pupil sits on the side nearer the nose.
  at(sk, r, x, y, towardsMiddle ? white : pupil); at(sk, r, x + 1, y, towardsMiddle ? pupil : white);
};

// ---------------------------------------------------------------- farm animals
const PIG = ramp(0xeea39c, 5, 0.1, 6);
skin('pig', (sk) => {
  fur(sk, 'pig', ['body', 'head', 'legFR', 'legBR'], PIG, { cell: 2, grain: 0.28 });
  // A few muddy patches on the back.
  each(sk, 'pig', ['body'], (face, r) => {
    if (face !== 'top') return;
    for (let k = 0; k < 5; k++) { const x = sk.ri(r[2] - 1), y = sk.ri(r[3]); tone(sk, [r[0] + x, r[1] + y, 2, 1], 0.86); }
  });
  const [head, snout] = cubesOf('pig', 'head');
  const f = reg(head).front;
  eye(sk, f, 1, 3, 0xf6f6f6, 0x1a1414); eye(sk, f, 5, 3, 0xf6f6f6, 0x1a1414, false);
  for (const x of [1, 2, 5, 6]) at(sk, f, x, 2, PIG[1]);
  sk.box(snout, (face, r) => sk.fill(r, [0xf2aea8, 0xf6b8b2, 0xf9c2bc], { cell: 1, grain: 0.2 }));
  const s = reg(snout).front;
  row(sk, s, 0, 0xf9c6c0); at(sk, s, 1, 1, 0x8e4a4c); at(sk, s, 2, 1, 0x8e4a4c); row(sk, s, 2, 0xe89a94);
  feet(sk, 'pig', ['legFR'], 1, [0xc07a78, 0xb06e6c]);
});

const HIDE = [0x2c1f15, 0x36271b, 0x403020, 0x4a3826, 0x54402c];
const PATCH = [0xc9c4ba, 0xd8d4cc, 0xe6e3dc, 0xf1efea];
skin('cow', (sk) => {
  fur(sk, 'cow', ['body', 'head', 'legFR'], HIDE, { cell: 2, grain: 0.3 });
  // White patches: one soft noise over each face, cut at a level.
  each(sk, 'cow', ['body', 'head', 'legFR'], (face, r, cube) => {
    if (cube.size[1] < 2) return;
    const n = sk.field(r[2], r[3], 4, 4, 0.25);
    for (let y = 0; y < r[3]; y++) for (let x = 0; x < r[2]; x++) if (n[y * r[2] + x] > 0.62) sk.set(r[0] + x, r[1] + y, PATCH[sk.ri(PATCH.length)]);
  });
  const [head, hornR, , muzzle] = cubesOf('cow', 'head');
  const f = reg(head).front;
  // A white blaze down the face, eyes either side.
  for (let y = 0; y < 5; y++) for (let x = 3; x < 5; x++) at(sk, f, x, y, PATCH[1 + sk.ri(3)]);
  eye(sk, f, 1, 3, 0xe8e8e8, 0x141010); eye(sk, f, 5, 3, 0xe8e8e8, 0x141010, false);
  sk.box(hornR, (face, r) => { sk.fill(r, [0xcfc6a8, 0xdcd4b8, 0xe6dfc6], { cell: 1 }); if (face !== 'top' && face !== 'bottom') at(sk, r, 0, 0, 0x8a8068); });
  sk.box(muzzle, (face, r) => sk.fill(r, [0xb49890, 0xc0a49a, 0xcab0a6], { cell: 1, grain: 0.2 }));
  const m = reg(muzzle).front;
  at(sk, m, 0, 1, 0x3a2824); at(sk, m, 3, 1, 0x3a2824);
  // The udder.
  sk.box(cubesOf('cow', 'body')[1], (face, r) => sk.fill(r, [0xd99aa0, 0xe4a8ae, 0xeeb6bc], { cell: 1 }));
  // White socks and dark hooves.
  each(sk, 'cow', ['legFR'], (face, r) => {
    if (face === 'top' || face === 'bottom') return;
    sk.fill([r[0], r[1] + 7, r[2], 4], PATCH, { cell: 1 });
  });
  feet(sk, 'cow', ['legFR'], 1, [0x2a2626, 0x363030]);
});

// Sheep: the animal under the fleece, and the fleece (grey, tinted by the renderer).
const SHORN = ramp(0xd9c7ae, 4, 0.08, 6), FACE_SHEEP = ramp(0xb8aa96, 4, 0.08, 6);
skin('sheep', (sk) => {
  fur(sk, 'sheep', ['body', 'legFR'], SHORN, { cell: 2, grain: 0.3 });
  fur(sk, 'sheep', ['head'], FACE_SHEEP, { cell: 2, grain: 0.25 });
  const f = reg(cubesOf('sheep', 'head')[0]).front;
  eye(sk, f, 0, 2, 0xf0f0f0, 0x151515); eye(sk, f, 4, 2, 0xf0f0f0, 0x151515, false);
  for (let x = 2; x < 4; x++) { at(sk, f, x, 4, 0xe4a4a4); at(sk, f, x, 5, 0x7a5a50); }
  feet(sk, 'sheep', ['legFR'], 2, [0x6e5a4a, 0x7c6858]);
});
const FLEECE = [0xb4b4b4, 0xc4c4c4, 0xd2d2d2, 0xdedede, 0xeaeaea];
skin('sheep_wool', (sk) => {
  for (const b of ['wool', 'headWool', 'woolFR']) {
    each(sk, 'sheep', [b], (face, r) => {
      sk.fill(r, FLEECE, { cell: 1, grain: 0.55 });
      // Curls: a light pixel over a dark one here and there.
      for (let k = 0; k < (r[2] * r[3]) / 6; k++) { const x = sk.ri(r[2]), y = sk.ri(r[3] - 1); at(sk, r, x, y, FLEECE[4]); at(sk, r, x, y + 1, FLEECE[1]); }
    }, 'wool');
  }
});

const FEATHER = ramp(0xe6e6e2, 4, 0.08, 4);
skin('chicken', (sk) => {
  fur(sk, 'chicken', ['body', 'wingR'], FEATHER, { cell: 1, grain: 0.4 });
  const [head, beak, wattle] = cubesOf('chicken', 'head');
  sk.box(head, (face, r) => sk.fill(r, FEATHER, { cell: 1, grain: 0.3 }));
  const f = reg(head).front;
  at(sk, f, 0, 1, 0x141414); at(sk, f, 3, 1, 0x141414);
  for (const side of ['right', 'left']) at(sk, reg(head)[side], 1, 1, 0x141414);
  sk.box(beak, (face, r) => sk.fill(r, [0xd89020, 0xe8a42c, 0xf2b83c], { cell: 1 }));
  sk.box(wattle, (face, r) => sk.fill(r, [0xb0181c, 0xc82024, 0xd83030], { cell: 1 }));
  // Wing feathers: darker tips along the bottom.
  each(sk, 'chicken', ['wingR'], (face, r) => { if (face !== 'top') row(sk, r, r[3] - 1, FEATHER[0]); });
  // Legs: thin orange sticks with three toes; the rest of the box is clear.
  const legs = cubesOf('chicken', 'legR')[0];
  sk.box(legs, (face, r) => {
    sk.clearRect(...r);
    if (face === 'top') return;
    if (face === 'bottom') { for (let x = 0; x < r[2]; x++) at(sk, r, x, 1, 0xe09a2c); return; }
    for (let y = 0; y < r[3] - 1; y++) at(sk, r, 1, y, y === 0 ? 0xc07e20 : 0xe8a430);
    row(sk, r, r[3] - 1, 0xe09a2c);
  });
});

// ---------------------------------------------------------------- wild animals
const WOLF = ramp(0xb8b6b0, 5, 0.12, 6), WOLF_BACK = ramp(0x8c8a84, 4, 0.1, 6), WOLF_LIGHT = ramp(0xdcdad4, 3, 0.06, 4);
function wolfSkin(sk, angry) {
  fur(sk, 'wolf', ['body', 'mane', 'head', 'legFR', 'tail'], WOLF, { cell: 2, grain: 0.35 });
  each(sk, 'wolf', ['body', 'mane'], (face, r) => { if (face === 'top') sk.fill(r, WOLF_BACK, { cell: 2 }); });
  each(sk, 'wolf', ['mane'], (face, r) => { if (face === 'front' || face === 'bottom') sk.fill(r, WOLF_LIGHT, { cell: 1 }); });
  const [head, earR, , snout] = cubesOf('wolf', 'head');
  const f = reg(head).front;
  const white = angry ? 0xd02020 : 0xf0f0f0, pupil = angry ? 0x600000 : 0x151515;
  at(sk, f, 1, 2, white); at(sk, f, 4, 2, white); at(sk, f, 1, 3, pupil); at(sk, f, 4, 3, pupil);
  if (angry) { at(sk, f, 0, 1, WOLF_BACK[0]); at(sk, f, 5, 1, WOLF_BACK[0]); }
  sk.box(earR, (face, r) => sk.fill(r, WOLF_BACK, { cell: 1 }));
  sk.box(snout, (face, r) => sk.fill(r, WOLF_LIGHT, { cell: 1 }));
  const s = reg(snout).front;
  at(sk, s, 1, 0, 0x1a1a1a); if (angry) row(sk, s, 2, 0xe8e8e8);
  each(sk, 'wolf', ['tail'], (face, r) => { if (face !== 'top' && face !== 'bottom') sk.fill([r[0], r[1] + r[3] - 2, r[2], 2], WOLF_LIGHT, { cell: 1 }); });
}
skin('wolf', (sk) => wolfSkin(sk, false));
// A pet's collar: a light band (tinted with its dye when drawn) with a darker stitched edge and a
// little silver tag at the front.
skin('collar', (sk) => {
  sk.fill([0, 0, 64, 64], [0xf4f4f4, 0xeaeaea, 0xe2e2e2], { cell: 1, grain: 0.2 });
  for (let x = 0; x < 64; x++) { sk.set(x, 0, 0xb8b8b8); sk.set(x, 63, 0xb8b8b8); }
  for (let y = 0; y < 64; y += 2) for (let x = 0; x < 64; x += 4) sk.set(x + (y % 4 ? 2 : 0), y, 0xd0d0d0);
});
skin('wolf_angry', (sk) => wolfSkin(sk, true));

const FOX = ramp(0xd8702c, 5, 0.12, 8), FOX_WHITE = ramp(0xece4da, 3, 0.05, 4), FOX_DARK = [0x221a16, 0x2e241e, 0x3a2e26];
skin('fox', (sk) => {
  fur(sk, 'fox', ['body', 'head', 'tail'], FOX, { cell: 2, grain: 0.3 });
  each(sk, 'fox', ['body'], (face, r) => { if (face === 'bottom') sk.fill(r, FOX_WHITE, { cell: 1 }); });
  const [head, earR, earL, nose] = cubesOf('fox', 'head');
  const f = reg(head).front;
  // White cheeks, slit eyes, dark ears and nose.
  for (let x = 0; x < 8; x++) for (let y = 3; y < 6; y++) if (x < 2 || x > 5 || y === 5) at(sk, f, x, y, FOX_WHITE[1 + ((x + y) & 1)]);
  at(sk, f, 1, 2, 0x151515); at(sk, f, 2, 2, 0xe8c040); at(sk, f, 5, 2, 0xe8c040); at(sk, f, 6, 2, 0x151515);
  for (const e of [earR, earL]) sk.box(e, (face, r) => sk.fill(r, FOX_DARK, { cell: 1 }));
  sk.box(nose, (face, r) => sk.fill(r, FOX_WHITE, { cell: 1 }));
  at(sk, reg(nose).front, 1, 0, 0x151515); at(sk, reg(nose).front, 2, 0, 0x151515);
  fur(sk, 'fox', ['legFR', 'legFL'], FOX_DARK, { cell: 1 });
  each(sk, 'fox', ['tail'], (face, r) => {
    if (face === 'front') return;
    // The tail's tip is white.
    if (face === 'bottom' || face === 'top') { sk.fill([r[0], r[1] + r[3] - 2, r[2], 2], FOX_WHITE, { cell: 1 }); return; }
    const tip = face === 'back' ? r : face === 'right' ? [r[0], r[1], 2, r[3]] : [r[0] + r[2] - 2, r[1], 2, r[3]];
    sk.fill(tip, FOX_WHITE, { cell: 1 });
  });
});

function rabbitSkin(sk, pal, eyeC, belly) {
  fur(sk, 'rabbit', ['body', 'head', 'hindR', 'hindL', 'frontR', 'frontL', 'tail'], pal, { cell: 1, grain: 0.35 });
  sk.box(cubesOf('rabbit', 'tail')[0], (face, r) => sk.fill(r, [0xe4e4e0, 0xf0f0ec], { cell: 1 }));
  const [head, earR, earL, nose] = cubesOf('rabbit', 'head');
  const f = reg(head).front;
  at(sk, f, 0, 1, eyeC); at(sk, f, 4, 1, eyeC);
  for (let x = 1; x < 4; x++) at(sk, f, x, 3, belly);
  for (const e of [earR, earL]) sk.box(e, (face, r) => { sk.fill(r, pal, { cell: 1 }); if (face === 'front') for (let y = 1; y < r[3]; y++) at(sk, r, 0, y, 0xd89aa0); });
  sk.box(nose, (face, r) => sk.fill(r, [0xd08890, 0xe09aa2], { cell: 1 }));
}
skin('rabbit_brown', (sk) => rabbitSkin(sk, ramp(0x8a6a4a, 4, 0.1, 6), 0x151210, 0xc8b8a0));
skin('rabbit_white', (sk) => rabbitSkin(sk, ramp(0xe0e0dc, 4, 0.06, 4), 0xc02030, 0xf2f2f0));
skin('rabbit_black', (sk) => rabbitSkin(sk, ramp(0x2a2624, 4, 0.08, 4), 0x0a0808, 0xd8d8d4));
skin('rabbit_gold', (sk) => rabbitSkin(sk, ramp(0xd8b870, 4, 0.1, 6), 0x151210, 0xf0e4c0));

const GOAT = ramp(0xe0d8c8, 5, 0.08, 6), HORN = [0x7a7064, 0x8c8274, 0x9e9484];
skin('goat', (sk) => {
  fur(sk, 'goat', ['body', 'head', 'legFR'], GOAT, { cell: 2, grain: 0.3 });
  const [head, hornR, , beard, earR] = cubesOf('goat', 'head');
  const f = reg(head).front;
  // Goats' eyes are set on the sides, with sideways pupils.
  for (const side of ['right', 'left']) { const r = reg(head)[side]; at(sk, r, 2, 2, 0xd8b040); at(sk, r, 3, 2, 0x151515); at(sk, r, 4, 2, 0xd8b040); }
  at(sk, f, 1, 4, 0x6a5a50); at(sk, f, 3, 4, 0x6a5a50);
  sk.box(hornR, (face, r) => { sk.fill(r, HORN, { cell: 1 }); if (face !== 'top' && face !== 'bottom') for (let y = 1; y < r[3]; y += 2) row(sk, r, y, HORN[0]); });
  sk.box(beard, (face, r) => sk.fill(r, GOAT.slice(2), { cell: 1 }));
  sk.box(earR, (face, r) => sk.fill(r, GOAT.slice(0, 3), { cell: 1 }));
  feet(sk, 'goat', ['legFR'], 2, [0x3a3632, 0x4a4540]);
});

// Horses: a coat in seven colours with a darker (or, on creamy horses, flaxen) mane and tail,
// eyes set on the sides of the head, a soft muzzle and dark hooves.
export const HORSE_COATS = [
  ['white', 0xe8e4dc, 0xcdc8be], ['creamy', 0xc9a878, 0xeadcbc], ['chestnut', 0x9c5a2e, 0x6a3818], ['brown', 0x6e4a2e, 0x2e1c10],
  ['black', 0x2c2826, 0x121010], ['gray', 0x8c8884, 0x4c4846], ['dark_brown', 0x40291c, 0x1a100a],
];
for (const [name, coatC, maneC] of HORSE_COATS) {
  skin(`horse_${name}`, (sk) => {
    const coat = ramp(coatC, 5, 0.1, 6), mane = ramp(maneC, 4, 0.1, 6);
    fur(sk, 'horse', ['body', 'head', 'legFR'], coat, { cell: 2, grain: 0.25 });
    const [, head, earR, , maneCube] = cubesOf('horse', 'head');
    sk.box(maneCube, (face, r) => sk.fill(r, mane, { cell: 1, cy: 2, grain: 0.35 }));
    sk.box(earR, (face, r) => sk.fill(r, coat.slice(0, 3), { cell: 1 }));
    for (const cube of cubesOf('horse', 'tail')) sk.box(cube, (face, r) => sk.fill(r, mane, { cell: 1, cy: 3, grain: 0.4 }));
    // Eyes on the sides, towards the front; nostrils and a darker muzzle at the end of the nose.
    const R = reg(head);
    at(sk, R.right, 5, 1, 0x141010); at(sk, R.right, 6, 1, 0x2a2420);
    at(sk, R.left, 1, 1, 0x2a2420); at(sk, R.left, 2, 1, 0x141010);
    for (const face of ['front', 'bottom']) tone(sk, [R[face][0], R[face][1] + R[face][3] - 2, R[face][2], 2], 0.82);
    for (const side of ['right', 'left']) tone(sk, [R[side][0] + (side === 'right' ? 6 : 0), R[side][1] + 2, 2, 3], 0.85);
    at(sk, R.front, 1, 3, 0x1a1412); at(sk, R.front, 4, 3, 0x1a1412);
    // A lighter blaze down the face of the darker coats.
    if (['chestnut', 'brown', 'dark_brown'].includes(name)) for (let y = 0; y < 3; y++) { at(sk, R.front, 2, y, coat[4]); at(sk, R.front, 3, y, coat[4]); }
    feet(sk, 'horse', ['legFR'], 2, [0x2a2420, 0x3a322c]);
  });
}
// The saddle: dark leather, a lighter seat, iron stirrups.
skin('horse_saddle', (sk) => {
  const leather = [0x3a2010, 0x5a3218, 0x6e4122, 0x8e5832];
  for (const cube of cubesOf('horse', 'saddle')) {
    sk.box(cube, (face, r) => {
      if (cube.size[1] === 6) { sk.fill(r, [0x5a5a5a, 0x8a8a8a, 0xb0b0b0], { cell: 1 }); if (face !== 'top' && face !== 'bottom') row(sk, r, 0, leather[1]); }
      else sk.fill(r, face === 'top' ? leather.slice(1) : leather.slice(0, 3), { cell: 1, grain: 0.3 });
    });
  }
});

const BEAR = ramp(0xecebe4, 5, 0.07, 6);
skin('polar_bear', (sk) => {
  fur(sk, 'polar_bear', ['body', 'head', 'legFR'], BEAR, { cell: 2, grain: 0.3 });
  const [head, muzzle, earR] = cubesOf('polar_bear', 'head');
  const f = reg(head).front;
  at(sk, f, 1, 3, 0x151515); at(sk, f, 5, 3, 0x151515);
  sk.box(muzzle, (face, r) => sk.fill(r, BEAR.slice(1, 4), { cell: 1 }));
  const m = reg(muzzle).front;
  for (let x = 1; x < 4; x++) at(sk, m, x, 0, 0x1a1a1a);
  at(sk, m, 2, 1, 0x1a1a1a);
  sk.box(earR, (face, r) => sk.fill(r, BEAR.slice(0, 3), { cell: 1 }));
  feet(sk, 'polar_bear', ['legFR'], 1, [0xb8b8b0, 0xc4c4bc]);
});

// ---------------------------------------------------------------- water creatures
const SQUID = ramp(0x2a3a52, 5, 0.1, 8);
skin('squid', (sk) => {
  fur(sk, 'squid', ['body', 'arm0'], SQUID, { cell: 2, grain: 0.3 });
  const b = reg(cubesOf('squid', 'body')[0]);
  for (const side of ['front', 'back']) {
    const r = b[side];
    for (const x of [2, 8]) { at(sk, r, x, 11, 0xe0e0c8); at(sk, r, x + 1, 11, 0xe0e0c8); at(sk, r, x, 12, 0xe0e0c8); at(sk, r, x + 1, 12, 0x101418); }
  }
  // Paler undersides and suckers along the arms.
  each(sk, 'squid', ['arm0'], (face, r) => { if (face === 'front') for (let y = 1; y < r[3]; y += 3) at(sk, r, 0, y, 0x8090a8); });
});
const COD = ramp(0x9a8a66, 4, 0.1, 6);
skin('cod', (sk) => {
  fur(sk, 'cod', ['body', 'tail'], COD, { cell: 1, grain: 0.3 });
  const [body, head] = cubesOf('cod', 'body');
  for (const side of ['right', 'left']) {
    const r = reg(body)[side];
    row(sk, r, 3, 0xd8d0b8);
    for (let x = 0; x < r[2]; x += 2) at(sk, r, x, 0, COD[0]);
  }
  sk.box(head, (face, r) => sk.fill(r, COD, { cell: 1 }));
  for (const side of ['right', 'left']) at(sk, reg(head)[side], 0, 1, 0x101010);
});
const SALMON = ramp(0xb03c30, 4, 0.1, 6), SALMON_BACK = [0x4a5a48, 0x566654];
skin('salmon', (sk) => {
  fur(sk, 'salmon', ['body', 'tail'], SALMON, { cell: 1, grain: 0.3 });
  const [body, head] = cubesOf('salmon', 'body');
  sk.box(body, (face, r) => { if (face === 'top') sk.fill(r, SALMON_BACK, { cell: 1 }); else if (face !== 'bottom') row(sk, r, 0, SALMON_BACK[0]); });
  sk.box(head, (face, r) => sk.fill(r, SALMON, { cell: 1 }));
  for (const side of ['right', 'left']) at(sk, reg(head)[side], 1, 1, 0x101010);
});

// ---------------------------------------------------------------- monsters
const CREEPER = [0x0c5a0a, 0x138e11, 0x1ea41b, 0x3fbe3c, 0x62d35e, 0x9ae896];
skin('creeper', (sk) => {
  fur(sk, 'creeper', ['head', 'body', 'legFR'], CREEPER, { cell: 1, grain: 0.7, weights: [0.08, 0.22, 0.3, 0.22, 0.12, 0.06] });
  // A sprinkle of pale grey through the green.
  each(sk, 'creeper', ['head', 'body', 'legFR'], (face, r) => {
    for (let k = 0; k < (r[2] * r[3]) / 14; k++) at(sk, r, sk.ri(r[2]), sk.ri(r[3]), [0xb8c8b8, 0xd8e0d8][sk.ri(2)]);
  });
  sk.paint(...reg(cubesOf('creeper', 'head')[0]).front.slice(0, 2), ['........', '........', '.XX..XX.', '.XX..XX.', '...XX...', '..XXXX..', '..XXXX..', '..X..X..'],
    { X: 0x0a0a0a });
  // The dark pixels have a hint of green at their edges, as in the original.
  const f = reg(cubesOf('creeper', 'head')[0]).front;
  at(sk, f, 1, 2, 0x1a2a18); at(sk, f, 6, 2, 0x1a2a18);
});

const SPIDER = [0x1c1612, 0x241c17, 0x2c231d, 0x362b24, 0x413429];
skin('spider', (sk) => {
  fur(sk, 'spider', ['head', 'neck', 'body', 'legR0'], SPIDER, { cell: 1, grain: 0.45 });
  // Markings down the back and bands on the legs.
  each(sk, 'spider', ['body'], (face, r) => {
    if (face !== 'top') return;
    for (let y = 1; y < r[3] - 1; y += 2) for (let x = 3; x < 7; x++) if ((x + y) % 3) at(sk, r, x, y, 0x5a3a2a);
  });
  each(sk, 'spider', ['legR0'], (face, r) => { if (face !== 'right' && face !== 'left') for (let x = 3; x < r[2]; x += 5) for (let y = 0; y < r[3]; y++) at(sk, r, x, y, 0x4a3a30); });
  const f = reg(cubesOf('spider', 'head')[0]).front;
  sk.paint(f[0], f[1], ['........', '.r....r.', '.RR..RR.', '..rRRr..', '........', '........', '..k..k..', '........'],
    { r: 0x8a0a0a, R: 0xd82020, k: 0x0a0806 });
});

const ENDER = [0x070709, 0x0d0d10, 0x131317, 0x19191e];
skin('enderman', (sk) => {
  fur(sk, 'enderman', ['head', 'body', 'rightArm'], ENDER, { cell: 2, grain: 0.3 });
  const f = reg(cubesOf('enderman', 'head')[0]).front;
  // Long glowing purple eyes, brightest in the middle.
  for (const x of [0, 1, 2, 5, 6, 7]) at(sk, f, x, 4, [0xb040d0, 0xe090ff, 0xf6d8ff, 0, 0, 0xf6d8ff, 0xe090ff, 0xb040d0][x]);
});

// Slime: a clear jelly (drawn here as its lit edges and the darker core inside) with a face.
const SLIME = [0x3c8a34, 0x4c9e42, 0x5eb452, 0x74c666, 0x8cd680];
skin('slime', (sk) => {
  each(sk, 'slime', ['body'], (face, r) => {
    sk.fill(r, SLIME.slice(2), { cell: 2, grain: 0.3 });
    for (let y = 1; y < r[3] - 1; y++) for (let x = 1; x < r[2] - 1; x++) at(sk, r, x, y, SLIME[(x + y * 3) % 5 < 2 ? 0 : 1]);
    for (let i = 0; i < r[2]; i++) { at(sk, r, i, 0, SLIME[4]); at(sk, r, 0, i, SLIME[4]); }
  });
  const f = reg(cubesOf('slime', 'body')[0]).front;
  for (const x of [1, 5]) for (const y of [2, 3]) { at(sk, f, x, y, 0x1a3018); at(sk, f, x + 1, y, 0x243c20); }
  at(sk, f, 4, 5, 0x1a3018);
});

// ---------------------------------------------------------------- people
// Faces, hair and clothes for the humanoid model (players, zombies and villagers alike).
export const TONES = [
  [0xb77e5a, 0xc68e6a, 0xcf9874, 0xd6a07c], [0xe0b090, 0xe8bc9c, 0xefc6a6, 0xf4d0b0], [0x8a5a3a, 0x986644, 0xa6724c, 0xb27e56],
  [0x5e3a26, 0x6a442c, 0x764e34, 0x82583c], [0xc89a70, 0xd4a67c, 0xdeb086, 0xe6ba90],
];
export const HAIRS = [[0x3b2414, 0x4a2e1a, 0x55361f], [0x16110f, 0x201915, 0x2a211b], [0x7a4e22, 0x8e5c2a, 0x9e6a32], [0xb88a3a, 0xcaa04a, 0xd8b45c],
  [0x8a2e16, 0xa03a1c, 0xb44a24], [0x8a8a8a, 0xa2a2a2, 0xb8b8b8]];
const H = RIGS.humanoid.bones;
const HR = {
  head: reg(H.head.cubes[0]), hat: reg(H.head.cubes[1]), body: reg(H.body.cubes[0]), jacket: reg(H.body.cubes[1]),
  rArm: reg(H.rightArm.cubes[0]), rSleeve: reg(H.rightArm.cubes[1]), lArm: reg(H.leftArm.cubes[0]), lSleeve: reg(H.leftArm.cubes[1]),
  rLeg: reg(H.rightLeg.cubes[0]), rPants: reg(H.rightLeg.cubes[1]), lLeg: reg(H.leftLeg.cubes[0]), lPants: reg(H.leftLeg.cubes[1]),
};
const all = (R) => Object.values(R);
const fillAll = (sk, R, pal, o = { cell: 1, grain: 0.3 }) => { for (const r of all(R)) sk.fill(r, pal, o); };
const clearAll = (sk, R) => { for (const r of all(R)) sk.clearRect(...r); };

// A person: skin tone, hair (style: 'short', 'long', 'bald', 'cropped'), eye colour, beard, and
// clothes: shirt/trousers/shoes palettes, sleeves short or long.
export function person(sk, { tone, hair, style = 'short', eyes = 0x3a2a60, beard = false, shirt, pants, shoes = [0x3a3a3a, 0x444444, 0x4e4e4e],
  sleeves = 'long', mouth = null, brows = null }) {
  const T = tone;
  // Head.
  fillAll(sk, HR.head, T, { cell: 2, grain: 0.2 });
  const f = HR.head.front;
  const hairRow = (r, y) => row(sk, r, y, hair[1 + ((y * 7 + r[0]) % 2)]);
  if (style !== 'bald') {
    sk.fill(HR.head.top, hair, { cell: 1, grain: 0.4 });
    const depth = style === 'cropped' ? 1 : 2;
    for (let y = 0; y < depth; y++) hairRow(f, y);
    if (style !== 'cropped') { at(sk, f, 0, 2, hair[1]); at(sk, f, 7, 2, hair[1]); }
    for (const side of ['right', 'left']) {
      const r = HR.head[side];
      for (let y = 0; y < r[3]; y++) for (let x = 0; x < r[2]; x++) {
        const back = side === 'right' ? x < 4 : x >= 4;
        if (y < depth + 1 || (back && y < (style === 'long' ? 8 : style === 'cropped' ? 3 : 5))) at(sk, r, x, y, hair[(x + y) % 3]);
      }
    }
    sk.fill([HR.head.back[0], HR.head.back[1], 8, style === 'long' ? 8 : style === 'cropped' ? 3 : 6], hair, { cell: 1, grain: 0.4 });
  }
  // Face: brows, eyes (white and iris), nose shadow, mouth.
  const b = brows ?? (style === 'bald' ? T[0] : hair[0]);
  at(sk, f, 1, 3, b); at(sk, f, 2, 3, b); at(sk, f, 5, 3, b); at(sk, f, 6, 3, b);
  at(sk, f, 1, 4, 0xf2f2f2); at(sk, f, 2, 4, eyes); at(sk, f, 5, 4, eyes); at(sk, f, 6, 4, 0xf2f2f2);
  at(sk, f, 3, 5, T[0]); at(sk, f, 4, 5, T[1]);
  const lip = mouth ?? mix(T[0], 0x7a2a2a, 0.35);
  for (let x = 3; x < 5; x++) at(sk, f, x, 6, lip);
  at(sk, f, 2, 6, T[0]); at(sk, f, 5, 6, T[0]);
  if (beard) { for (let x = 1; x < 7; x++) at(sk, f, x, 7, hair[1]); for (const x of [1, 2, 5, 6]) at(sk, f, x, 6, hair[2]); }
  // Arms: skin, with sleeves painted over.
  for (const R of [HR.rArm, HR.lArm]) fillAll(sk, R, T, { cell: 2, grain: 0.2 });
  const sleeveRows = sleeves === 'long' ? 11 : sleeves === 'short' ? 4 : 0;
  for (const R of [HR.rArm, HR.lArm]) {
    sk.fill(R.top, shirt, { cell: 1 });
    for (const side of SIDES) if (sleeveRows) sk.fill([R[side][0], R[side][1], R[side][2], sleeveRows], shirt, { cell: 1, grain: 0.3 });
  }
  // Body and legs.
  fillAll(sk, HR.body, shirt, { cell: 1, grain: 0.3 });
  fillAll(sk, HR.rLeg, pants, { cell: 1, grain: 0.3 });
  fillAll(sk, HR.lLeg, pants, { cell: 1, grain: 0.3 });
  for (const R of [HR.rLeg, HR.lLeg]) {
    for (const side of SIDES) sk.fill([R[side][0], R[side][1] + 10, R[side][2], 2], shoes, { cell: 1 });
    sk.fill(R.bottom, shoes, { cell: 1 });
  }
  // The second layer starts clear; outfits paint on it.
  for (const R of [HR.hat, HR.jacket, HR.rSleeve, HR.lSleeve, HR.rPants, HR.lPants]) clearAll(sk, R);
}
// Helpers for outfits on the second layer.
const layer = (sk, R, faces, pal, rows = null, o = { cell: 1, grain: 0.3 }) => {
  for (const face of faces) {
    const r = R[face];
    const [y0, y1] = rows ?? [0, r[3]];
    sk.fill([r[0], r[1] + y0, r[2], y1 - y0], pal, o);
  }
};
export { HR, layer, SIDES as HUMAN_SIDES };

// Zombies and husks.
const ZOMBIE_SKIN = [0x3a6a2c, 0x467834, 0x52863c, 0x5e9446];
function zombieSkin(sk, skinPal, shirt, pants, eyesC) {
  person(sk, { tone: skinPal, hair: skinPal.slice(0, 3), style: 'bald', eyes: eyesC, shirt, pants, shoes: [0x2a2a30, 0x34343a], sleeves: 'short',
    mouth: skinPal[0], brows: skinPal[0] });
  const f = HR.head.front;
  // Sunken eyes, a gaping mouth.
  for (const x of [1, 2, 5, 6]) { at(sk, f, x, 4, x === 2 || x === 5 ? eyesC : 0x101a0c); at(sk, f, x, 3, skinPal[0]); }
  for (let x = 2; x < 6; x++) at(sk, f, x, 6, 0x1a2414);
  // Torn clothes: ragged edges where the skin shows through.
  for (const side of SIDES) {
    const r = HR.body[side];
    for (let x = 0; x < r[2]; x++) if (sk.r() < 0.45) at(sk, r, x, r[3] - 1 - sk.ri(2), skinPal[1 + sk.ri(3)]);
    for (const R of [HR.rArm, HR.lArm]) { const a = R[side]; for (let x = 0; x < a[2]; x++) if (sk.r() < 0.5) at(sk, a, x, 4, skinPal[2]); }
  }
}
skin('zombie', (sk) => zombieSkin(sk, ZOMBIE_SKIN, [0x1e6e72, 0x247a7e, 0x2a868a, 0x30928e], [0x2c2c70, 0x34347c, 0x3c3c88], 0x0a1406));
skin('husk', (sk) => zombieSkin(sk, [0x6e6048, 0x7c6c52, 0x8a785c, 0x988466], [0x6a5a3a, 0x766444, 0x826e4c], [0x4a4032, 0x544838, 0x5e5040], 0x140e08));

// Skeletons and strays: bone, with dark hollows.
const BONE = [0x8e8e8e, 0xa6a6a6, 0xbcbcbc, 0xcecece, 0xdcdcdc];
function skeletonSkin(sk, pal, cloth) {
  const S = RIGS.skeleton.bones;
  fur(sk, 'skeleton', ['head', 'body', 'rightArm', 'rightLeg'], pal, { cell: 1, grain: 0.25 });
  const f = reg(S.head.cubes[0]).front;
  sk.paint(f[0], f[1], ['........', '........', '........', '.kk..kk.', '.kk..kk.', '...kk...', '.k.k.k..', '........'], { k: 0x2a2a2a });
  at(sk, f, 2, 6, pal[1]); at(sk, f, 4, 6, pal[1]); at(sk, f, 6, 6, pal[1]);
  // The ribcage: dark gaps between the ribs, and the spine.
  const body = reg(S.body.cubes[0]);
  for (const side of ['front', 'back']) {
    const r = body[side];
    for (let y = 1; y < 8; y += 2) for (let x = 1; x < 7; x++) if (x !== 3 && x !== 4) at(sk, r, x, y, 0x3a3a3a);
    for (let y = 8; y < 12; y++) for (let x = 0; x < 8; x++) if (x !== 3 && x !== 4 && y < 11) at(sk, r, x, y, 0x2e2e2e);
  }
  sk.clearRect(...reg(S.head.cubes[1]).top); // (no hat)
  for (const r of all(reg(S.head.cubes[1]))) sk.clearRect(...r);
  for (const r of all(reg(S.body.cubes[1]))) sk.clearRect(...r);
  if (cloth) {
    // Tattered robes over the bones, and a hood.
    const hood = reg(S.head.cubes[1]);
    for (const face of ['top', 'right', 'left', 'back']) sk.fill(hood[face], cloth, { cell: 1, grain: 0.4 });
    sk.fill([hood.front[0], hood.front[1], 8, 2], cloth, { cell: 1 });
    const coat = reg(S.body.cubes[1]);
    for (const face of ['right', 'front', 'left', 'back', 'top']) {
      const r = coat[face];
      sk.fill(r, cloth, { cell: 1, grain: 0.4 });
      if (face !== 'top') for (let x = 0; x < r[2]; x++) for (let y = r[3] - 1 - sk.ri(4); y < r[3]; y++) sk.set(r[0] + x, r[1] + y, 0, 0);
    }
  }
}
skin('skeleton', (sk) => skeletonSkin(sk, BONE, null));
skin('stray', (sk) => skeletonSkin(sk, [0x7e8c90, 0x96a4a8, 0xacbabe, 0xbecccf, 0xd0dcdf], [0x2c3a40, 0x34444a, 0x3c4e54, 0x465a60]));

// Players: a few looks for the people in a multiplayer game (and you, in the inventory).
const SHIRTS = [0x2f7d8c, 0xc43e34, 0x3e9648, 0x8a52ac, 0xe0962a, 0x3a66c4, 0xce5c96, 0x5a5a60];
const PANTS = [[0x2a3466, 0x303a70, 0x36407a], [0x3a3a44, 0x42424c, 0x4a4a54], [0x54402c, 0x5e4832, 0x685038]];
SHIRTS.forEach((c, i) => {
  skin(`player_${i}`, (sk) => person(sk, {
    tone: TONES[[0, 1, 2, 0, 4, 3, 1, 2][i]], hair: HAIRS[[0, 3, 1, 2, 4, 1, 0, 5][i]], style: ['short', 'long', 'cropped', 'short', 'long', 'cropped', 'long', 'short'][i],
    eyes: [0x3a2a60, 0x2a5a3a, 0x3a2a1a, 0x2a4a80, 0x5a3a1a, 0x1a1a1a, 0x3a5a80, 0x3a2a60][i], shirt: ramp(c, 4, 0.08, 6), pants: PANTS[i % 3],
    sleeves: i % 3 === 1 ? 'short' : 'long', beard: i === 7,
  }));
});

// ---------------------------------------------------------------- armour
// Armour the way Minecraft draws it: two skins per material in the classic layout (a head, the
// body, one arm and one leg; the left limbs mirror the right), the first for the helmet,
// chestplate and boots and the second for the leggings. They're worn on boxes a little larger
// than the body (see avatars.js), and whatever a piece doesn't cover is left clear. The palettes
// are the armour icons' own: outline, dark, mid, light, highlight.
export const ARMOR_MATERIALS = {
  leather: [0x3a2010, 0x6e4122, 0x8e5832, 0xa86e40, 0xc28a58],
  iron: [0x383838, 0x858585, 0xb6b6b6, 0xdcdcdc, 0xffffff],
  golden: [0x5e3706, 0xba720d, 0xe6ad24, 0xf9d648, 0xfff6a6],
  diamond: [0x0b4541, 0x178e84, 0x2cc3b0, 0x6be8d4, 0xc9fff3],
  chainmail: [0x2e2e32, 0x5a5a60, 0x7c7c84, 0xa2a2aa, 0xc8c8d0],
};
export const ARMOR_BOXES = {
  head: boxRegions(0, 0, 8, 8, 8), body: boxRegions(16, 16, 8, 12, 4), arm: boxRegions(40, 16, 4, 12, 4), leg: boxRegions(0, 16, 4, 12, 4),
};
const AB = ARMOR_BOXES;

// Plates over the faces of a box where cover(face, x, y) holds: a mottled middle tone, lit along
// the upper edge of each plate and shadowed along the lower one and around any opening.
function plates(sk, R, mat, cover) {
  const pal = ARMOR_MATERIALS[mat], soft = mat === 'leather';
  for (const [face, r] of Object.entries(R)) {
    const [x0, y0, w, h] = r;
    const side = face !== 'top' && face !== 'bottom';
    const on = (x, y) => x >= 0 && y >= 0 && x < w && y < h && cover(face, x, y);
    sk.fill(r, pal.slice(1, 4), { cell: soft ? 1 : 3, grain: soft ? 0.35 : 0.12, weights: [0.2, 0.55, 0.25] });
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      if (!on(x, y)) { sk.set(x0 + x, y0 + y, 0, 0); continue; }
      const hole = (dx, dy) => { const nx = x + dx, ny = y + dy; return nx >= 0 && ny >= 0 && nx < w && ny < h && !on(nx, ny); };
      if (side && (y === h - 1 || !on(x, y + 1))) sk.set(x0 + x, y0 + y, pal[1]);
      else if (hole(-1, 0) || hole(1, 0) || hole(0, 1)) sk.set(x0 + x, y0 + y, pal[1]);
      else if (side && (y === 0 || !on(x, y - 1))) sk.set(x0 + x, y0 + y, pal[3]);
      // Chain mail is rings with the body showing through.
      else if (mat === 'chainmail' && side && y % 2 === 1 && (x + (y >> 1)) % 2 === 0) sk.set(x0 + x, y0 + y, 0, 0);
      else if ((mat === 'diamond' || mat === 'golden') && sk.r() < 0.04) sk.set(x0 + x, y0 + y, pal[4]);
    }
  }
}
const isSide = (face) => face !== 'top' && face !== 'bottom';

function armorSkin(sk, mat) {
  const pal = ARMOR_MATERIALS[mat], metal = mat !== 'leather';
  // Helmet: a cap over the crown, down the back and sides, open at the face (cheek guards on metal).
  plates(sk, AB.head, mat, (face, x, y) => {
    if (face === 'top') return true;
    if (face === 'bottom') return false;
    if (face === 'back') return y <= (metal ? 6 : 5);
    if (face === 'front') return y <= 1 || (metal && y <= 5 && (x === 0 || x === 7));
    const back = face === 'right' ? x < 4 : x >= 4, front = face === 'right' ? x === 7 : x === 0;
    return y <= 2 || (back && y <= (metal ? 6 : 4)) || (metal && front && y <= 5);
  });
  // Chestplate: the whole body, and the shoulders down the top of each arm.
  plates(sk, AB.body, mat, (face, x, y) => !(face === 'front' && y === 0 && (x === 3 || x === 4)));
  plates(sk, AB.arm, mat, (face, x, y) => face === 'top' || (isSide(face) && y <= 4));
  const f = AB.body.front;
  if (metal) {
    // A breastplate over a lower plate, with a ridge down the middle.
    for (let x = 0; x < 8; x++) at(sk, f, x, 7, pal[1]);
    for (let y = 1; y < 7; y++) { at(sk, f, 3, y, pal[3]); at(sk, f, 4, y, pal[2]); }
  } else {
    // A laced collar and a stitched hem.
    for (let y = 1; y < 5; y += 2) { at(sk, f, 3, y, pal[0]); at(sk, f, 4, y, pal[0]); }
    for (const face of ['front', 'back']) for (let x = 0; x < 8; x += 2) at(sk, AB.body[face], x, 10, pal[1]);
  }
  // Boots: the lower legs and the soles.
  plates(sk, AB.leg, mat, (face, x, y) => face === 'bottom' || (isSide(face) && y >= 8));
  sk.fill(AB.leg.bottom, [pal[0], pal[1]], { cell: 1, grain: 0.3 });
}

function leggingsSkin(sk, mat) {
  const pal = ARMOR_MATERIALS[mat];
  // A waistband round the hips, and the legs down to the ankles.
  plates(sk, AB.body, mat, (face, x, y) => face === 'bottom' || (isSide(face) && y >= 8));
  for (const face of ['front', 'back', 'left', 'right']) for (let x = 0; x < AB.body[face][2]; x++) at(sk, AB.body[face], x, 9, pal[1]);
  plates(sk, AB.leg, mat, (face, x, y) => face === 'top' || (isSide(face) && y <= 9));
  if (mat !== 'leather') for (const face of ['front', 'right', 'left']) for (let x = 0; x < 4; x++) at(sk, AB.leg[face], x, 5, pal[1]);
}

for (const mat of Object.keys(ARMOR_MATERIALS)) {
  skin(`armor_${mat}`, (sk) => armorSkin(sk, mat));
  skin(`armor_${mat}_legs`, (sk) => leggingsSkin(sk, mat));
}

// ---------------------------------------------------------------- more creatures
// Donkeys: grey-brown, with a pale muzzle and belly, a dark mane and stripe, and long ears lined
// with dark fur.
skin('donkey', (sk) => {
  const coat = ramp(0x8a7a68, 5, 0.1, 6), mane = ramp(0x3a3028, 4, 0.1, 6), pale = ramp(0xcfc4b4, 3, 0.05, 4);
  fur(sk, 'donkey', ['body', 'head', 'legFR'], coat, { cell: 2, grain: 0.3 });
  const [, head, earR, , maneCube] = cubesOf('donkey', 'head');
  sk.box(maneCube, (face, r) => sk.fill(r, mane, { cell: 1, cy: 2 }));
  sk.box(earR, (face, r) => { sk.fill(r, coat.slice(0, 3), { cell: 1 }); if (face === 'front') for (let y = 1; y < r[3]; y++) at(sk, r, 1, y, mane[0]); });
  for (const cube of cubesOf('donkey', 'tail')) sk.box(cube, (face, r) => sk.fill(r, mane, { cell: 1, cy: 3 }));
  const R = reg(head);
  at(sk, R.right, 5, 1, 0x141010); at(sk, R.right, 6, 1, 0x2a2420);
  at(sk, R.left, 1, 1, 0x2a2420); at(sk, R.left, 2, 1, 0x141010);
  for (const face of ['front', 'bottom']) sk.fill([R[face][0], R[face][1] + R[face][3] - 3, R[face][2], 3], pale, { cell: 1 });
  at(sk, R.front, 1, 3, 0x2a2018); at(sk, R.front, 4, 3, 0x2a2018);
  const body = reg(cubesOf('donkey', 'body')[0]);
  sk.fill(body.bottom, pale, { cell: 2 });
  for (let y = 0; y < body.top[3]; y++) { at(sk, body.top, 4, y, mane[1]); at(sk, body.top, 5, y, mane[2]); }
  feet(sk, 'donkey', ['legFR'], 2, [0x2a2420, 0x3a322c]);
});

// Iron golems: iron plates gone rusty in places, vines hanging off them, a heavy brow over
// deep-set eyes, and a long nose.
const IRON_G = [0x7a746c, 0x948e84, 0xaaa398, 0xbdb6aa, 0xcfc8bc];
const RUST = [0x7a4a2a, 0x8e5a34, 0x6a3e22];
const VINE_G = [0x2e6a22, 0x3a7a2a, 0x4a8c34];
function ironPlates(sk, bones, wanted) {
  fur(sk, 'iron_golem', bones, IRON_G, { cell: 2, grain: 0.35 }, wanted);
  each(sk, 'iron_golem', bones, (face, r) => {
    // Rivets and seams, rust spots.
    for (let k = 0; k < Math.ceil(r[2] * r[3] / 30); k++) { const x = sk.ri(r[2]), y = sk.ri(r[3]); at(sk, r, x, y, RUST[sk.ri(3)]); if (sk.r() < 0.5) at(sk, r, Math.min(r[2] - 1, x + 1), y, RUST[0]); }
    if (face !== 'top' && face !== 'bottom') for (let y = 3; y < r[3]; y += 7) for (let x = 0; x < r[2]; x++) if ((x + y) % 5 === 0) at(sk, r, x, y, IRON_G[0]);
  }, wanted);
}
skin('iron_golem', (sk) => {
  ironPlates(sk, ['body', 'head'], null);
  // Vines trailing down the chest and back from the shoulders.
  const chest = reg(cubesOf('iron_golem', 'body')[0]);
  for (const face of ['front', 'back', 'top']) {
    const r = chest[face];
    for (const x0 of [2, 7, 13]) {
      const len = face === 'top' ? r[3] : 3 + sk.ri(6);
      for (let y = 0; y < len; y++) { at(sk, r, x0 + (y % 3 === 2 ? 1 : 0), y, VINE_G[sk.ri(3)]); if (sk.r() < 0.3) at(sk, r, x0 + 1, y, VINE_G[0]); }
    }
  }
  const [head, nose] = cubesOf('iron_golem', 'head');
  const f = reg(head).front;
  // A heavy brow, eyes in shadow with a red glint, a crack across the cheek.
  for (let x = 0; x < 8; x++) { at(sk, f, x, 3, IRON_G[1]); at(sk, f, x, 4, IRON_G[0]); }
  sk.paint(f[0], f[1] + 5, ['.kr..rk.', '.kk..kk.'], { k: 0x1a1612, r: 0x8a1a10 });
  for (let x = 2; x < 6; x++) at(sk, f, x, 9, 0x4a4640);
  at(sk, f, 6, 7, IRON_G[0]); at(sk, f, 7, 8, IRON_G[0]);
  sk.box(nose, (face, r) => sk.fill(r, IRON_G.slice(0, 4), { cell: 1 }));
});
skin('iron_golem_limbs', (sk) => {
  ironPlates(sk, ['rightArm', 'rightLeg'], 'limbs');
  // The fists darker; a vine wound round the arm.
  const arm = reg(cubesOf('iron_golem', 'rightArm')[0]);
  for (const face of SIDES) { tone(sk, [arm[face][0], arm[face][1] + arm[face][3] - 5, arm[face][2], 5], 0.8); }
  for (const face of SIDES) for (let y = 4; y < 20; y++) if ((y + SIDES.indexOf(face) * 3) % 6 < 2) at(sk, arm[face], (y * 2) % arm[face][2], y, VINE_G[sk.ri(3)]);
});

// Cats: a tabby, a black cat, a white one, a Siamese, a calico and a ginger. Stripes across the
// back, a pink nose and bright eyes.
const CATS = [
  ['tabby', 0x9a7a5a, 0x5a4230, 0xd8c8b0, 0x60c040],
  ['black', 0x222024, 0x141216, 0x3a3638, 0xd8c030],
  ['white', 0xece8e2, 0xd8d2ca, 0xf8f6f2, 0x40a0e0],
  ['siamese', 0xe6d8c0, 0x4a3a30, 0xf2e8d8, 0x3080e0],
  ['calico', 0xf0ece4, 0x2a2420, 0xf8f6f2, 0xd0a020],
  ['ginger', 0xd88a40, 0xa05a20, 0xf0d0a8, 0x60c040],
];
for (const [name, base, dark, belly, eyeC] of CATS) {
  skin(`cat_${name}`, (sk) => {
    const pal = ramp(base, 4, 0.08, 6);
    fur(sk, 'cat', ['body', 'head', 'legFR', 'legBR', 'tail'], pal, { cell: 1, grain: 0.3 });
    const body = reg(cubesOf('cat', 'body')[0]);
    if (name === 'tabby' || name === 'ginger') {
      for (const face of ['top', 'right', 'left']) {
        const r = body[face], along = face === 'top' ? r[3] : r[2];
        for (let i = 1; i < along; i += 3) {
          if (face === 'top') row(sk, r, i, dark);
          else for (let y = 0; y < Math.min(3, r[3]); y++) at(sk, r, i, y, dark);
        }
      }
    }
    if (name === 'calico') {
      for (const face of ['top', 'right', 'left', 'front']) {
        const r = body[face], n = sk.field(r[2], r[3], 3, 3, 0.2);
        for (let y = 0; y < r[3]; y++) for (let x = 0; x < r[2]; x++) { const v = n[y * r[2] + x]; if (v > 0.66) at(sk, r, x, y, 0xd07a30); else if (v < 0.3) at(sk, r, x, y, dark); }
      }
    }
    sk.fill(body.bottom, ramp(belly, 3, 0.05, 4), { cell: 1 });
    const [head, earR, earL, nose] = cubesOf('cat', 'head');
    const H = reg(head);
    if (name === 'siamese') {
      // Dark points: face, ears, paws and tail.
      sk.fill([H.front[0], H.front[1] + 1, H.front[2], H.front[3] - 1], ramp(dark, 3, 0.08, 4), { cell: 1 });
      for (const c of [earR, earL]) sk.box(c, (face, r) => sk.fill(r, [dark, mix(dark, 0, 0.2)], { cell: 1 }));
      for (const cube of cubesOf('cat', 'tail')) sk.box(cube, (face, r) => sk.fill(r, [dark, mix(dark, 0xffffff, 0.1)], { cell: 1 }));
      feet(sk, 'cat', ['legFR', 'legBR'], 3, [dark, mix(dark, 0, 0.2)]);
    } else {
      for (const c of [earR, earL]) sk.box(c, (face, r) => { sk.fill(r, pal.slice(0, 3), { cell: 1 }); if (face === 'front') at(sk, r, 0, 0, 0xd08a8a); });
      if (name === 'tabby' || name === 'ginger') { at(sk, H.front, 2, 0, dark); at(sk, H.front, 2, 1, dark); at(sk, H.front, 1, 0, dark); at(sk, H.front, 3, 0, dark); }
    }
    at(sk, H.front, 0, 1, eyeC); at(sk, H.front, 1, 1, 0x101010); at(sk, H.front, 3, 1, 0x101010); at(sk, H.front, 4, 1, eyeC);
    sk.box(nose, (face, r) => { sk.fill(r, ramp(belly, 3, 0.05, 4), { cell: 1 }); if (face === 'front') { at(sk, r, 1, 0, 0xe07a8a); at(sk, r, 1, 1, 0x5a3a3a); } });
  });
}

// Llamas: thick wool in four colours, a darker muzzle and dark eyes.
const LLAMAS = [['creamy', 0xe2cfa4], ['white', 0xeae8e2], ['brown', 0x8a5a34], ['gray', 0x8e8a84]];
for (const [name, c] of LLAMAS) {
  skin(`llama_${name}`, (sk) => {
    const wool = ramp(c, 5, 0.08, 6);
    fur(sk, 'llama', ['body', 'head', 'legFR'], wool, { cell: 1, grain: 0.45 });
    const [neck, head, earR, earL] = cubesOf('llama', 'head');
    const H = reg(head);
    sk.fill([H.front[0], H.front[1] + 2, H.front[2], H.front[3] - 2], ramp(mix(c, 0x3a2a1a, 0.35), 3, 0.06, 4), { cell: 1 });
    at(sk, H.front, 2, 3, 0x1a1210); at(sk, H.front, 5, 3, 0x1a1210);
    for (const side of ['right', 'left']) { const r = H[side]; at(sk, r, side === 'right' ? 7 : 2, 1, 0x141010); }
    for (const e of [earR, earL]) sk.box(e, (face, r) => sk.fill(r, wool.slice(0, 3), { cell: 1 }));
    void neck;
    feet(sk, 'llama', ['legFR'], 2, [0x3a3028, 0x4a4036]);
  });
}

// Turtles: a green shell of plates (darker seams, lighter rims), olive skin with pale spots.
skin('turtle', (sk) => {
  const shell = [0x2e5a24, 0x3a6c2c, 0x467e34, 0x55903e], skinC = ramp(0x6a8a4a, 4, 0.08, 6);
  fur(sk, 'turtle', ['head', 'legFR', 'legBR'], skinC, { cell: 1, grain: 0.3 });
  each(sk, 'turtle', ['head', 'legFR', 'legBR'], (face, r) => { for (let k = 0; k < 3; k++) at(sk, r, sk.ri(r[2]), sk.ri(r[3]), 0xb8c890); });
  const S = reg(cubesOf('turtle', 'body')[0]);
  sk.fill(S.top, shell, { cell: 2, grain: 0.3 });
  // Plates: a grid of rounded seams across the top.
  for (let y = 0; y < S.top[3]; y++) for (let x = 0; x < S.top[2]; x++) if (y % 5 === 0 || (x + (Math.floor(y / 5) % 2) * 2) % 5 === 0) at(sk, S.top, x, y, 0x24481c);
  for (const face of SIDES) sk.fill(S[face], [0x4a7a36, 0x568a40, 0x62964a], { cell: 1 });
  sk.fill(S.bottom, [0xc8c890, 0xd4d49c, 0xdedea8], { cell: 2 });
  const f = reg(cubesOf('turtle', 'head')[0]).front;
  at(sk, f, 1, 1, 0x101010); at(sk, f, 4, 1, 0x101010); for (let x = 1; x < 5; x++) at(sk, f, x, 3, 0x3a4a2a);
});

// Bats: dark brown fur, black leathery wings with finger bones, tiny eyes.
skin('bat', (sk) => {
  fur(sk, 'bat', ['body', 'head'], [0x2a2018, 0x33271e, 0x3c2e24, 0x46362a], { cell: 1, grain: 0.35 });
  each(sk, 'bat', ['wingR'], (face, r) => {
    sk.fill(r, [0x1a1410, 0x221a14, 0x2a2018], { cell: 1, grain: 0.3 });
    for (let x = 1; x < r[2]; x += 3) for (let y = 0; y < r[3]; y++) if (y <= x * 0.8) at(sk, r, x, y, 0x3a2e24);
  });
  const f = reg(cubesOf('bat', 'head')[0]).front;
  at(sk, f, 0, 1, 0x0a0806); at(sk, f, 3, 1, 0x0a0806); at(sk, f, 1, 3, 0x7a4a3a); at(sk, f, 2, 3, 0x7a4a3a);
});

// Parrots: five colourings, each with a bright head, contrasting wings and a hooked grey beak.
const PARROTS = [['red', 0xd02a1e, 0x2a5ac8, 0xf0c020], ['blue', 0x2a6ae0, 0x1a3a90, 0xf0d040], ['green', 0x3aa82a, 0x2a70c0, 0xe03020],
  ['cyan', 0x3ac0d8, 0xf0d040, 0x2a6ae0], ['gray', 0xa8a8a8, 0x6a6a6a, 0xe8e8e8]];
for (const [name, body, wing, crest] of PARROTS) {
  skin(`parrot_${name}`, (sk) => {
    fur(sk, 'parrot', ['body', 'head', 'tail'], ramp(body, 4, 0.08, 6), { cell: 1, grain: 0.3 });
    each(sk, 'parrot', ['wingR'], (face, r) => sk.fill(r, ramp(wing, 3, 0.08, 6), { cell: 1 }));
    each(sk, 'parrot', ['legR'], (face, r) => sk.fill(r, [0x5a5a5a, 0x6a6a6a], { cell: 1 }));
    const [head, beak, crestC] = cubesOf('parrot', 'head');
    sk.box(beak, (face, r) => sk.fill(r, [0x3a3a3a, 0x4a4a4a, 0x5a5a5a], { cell: 1 }));
    sk.box(crestC, (face, r) => sk.fill(r, ramp(crest, 3, 0.06, 4), { cell: 1 }));
    const H = reg(head);
    for (const side of ['right', 'left']) { const r = H[side]; at(sk, r, 1, 1, 0xf8f8f8); at(sk, r, side === 'right' ? 0 : 2, 1, 0x101010); }
    for (const cube of cubesOf('parrot', 'tail')) sk.box(cube, (face, r) => { for (let y = r[3] - 2; y < r[3]; y++) row(sk, r, y, wing); });
  });
}

// Phantoms: a dark blue-grey hide, pale bones through thin wing membranes, and glowing green
// eyes.
skin('phantom', (sk) => {
  const hide = [0x2a3050, 0x343c60, 0x3e4870, 0x4a5480];
  fur(sk, 'phantom', ['body', 'head', 'tail'], hide, { cell: 1, grain: 0.35 });
  each(sk, 'phantom', ['wingR'], (face, r) => {
    sk.fill(r, [0x3a4468, 0x445078, 0x505c88], { cell: 2, grain: 0.3 });
    if (face === 'top' || face === 'bottom') for (let x = 0; x < r[2]; x++) { at(sk, r, x, 1, 0x8a92a8); if (x % 5 === 0) for (let y = 1; y < r[3]; y++) at(sk, r, x, y, 0x6a7290); }
  });
  const f = reg(cubesOf('phantom', 'head')[0]).front;
  for (const x of [1, 2, 4, 5]) at(sk, f, x, 1, x === 2 || x === 4 ? 0xb0ff80 : 0x60d040);
});

// Witches: a pale green face with a long warty nose, a purple robe, and a tall black hat with a
// green buckle.
skin('witch', (sk) => {
  const face = [0x9aa87a, 0xa6b486, 0xb0be90, 0xbac89a], robe = [0x3a2248, 0x442a54, 0x4e3260, 0x583a6c], hat = [0x1a1a1e, 0x222226, 0x2a2a30];
  const W = RIGS.witch.bones;
  const [head, nose, brim, mid, top, tip] = W.head.cubes;
  sk.box(head, (f, r) => sk.fill(r, face, { cell: 2, grain: 0.2 }));
  const F = reg(head).front;
  sk.fill([F[0], F[1], 8, 2], [0x2a2a2a, 0x3a3a3a], { cell: 1 });
  at(sk, F, 1, 4, 0xf2f2f2); at(sk, F, 2, 4, 0x6a2a8a); at(sk, F, 5, 4, 0x6a2a8a); at(sk, F, 6, 4, 0xf2f2f2);
  for (let x = 2; x < 6; x++) at(sk, F, x, 8, 0x5a4a3a);
  sk.box(nose, (f, r) => sk.fill(r, face, { cell: 1 }));
  at(sk, reg(nose).front, 1, 2, 0x5a6a3a);
  for (const c of [brim, mid, top, tip]) sk.box(c, (f, r) => sk.fill(r, hat, { cell: 1, grain: 0.25 }));
  const band = reg(mid);
  for (const s of SIDES) row(sk, band[s], band[s][3] - 1, 0x3a6a2a);
  at(sk, band.front, 2, 3, 0x9ad060); at(sk, band.front, 3, 3, 0x9ad060);
  for (const b of ['body', 'rightArm', 'rightLeg']) each(sk, 'witch', [b], (f, r) => sk.fill(r, robe, { cell: 1, grain: 0.3 }));
  each(sk, 'witch', ['rightArm'], (f, r) => { if (f !== 'top') sk.fill([r[0], r[1] + r[3] - 2, r[2], 2], face, { cell: 1 }); });
  const body = reg(W.body.cubes[0]);
  for (let y = 0; y < 12; y++) at(sk, body.front, 3 + (y % 2), y, 0x6a4a7a);
  each(sk, 'witch', ['rightLeg'], (f, r) => { if (f !== 'top') sk.fill([r[0], r[1] + r[3] - 2, r[2], 2], [0x2a1a10, 0x3a2418], { cell: 1 }); });
});

// Cave spiders: a spider's pattern in dark teal, with red eyes.
skin('cave_spider', (sk) => {
  fur(sk, 'spider', ['head', 'neck', 'body', 'legR0'], [0x0a2228, 0x0e2c32, 0x12363c, 0x184046, 0x1e4a50], { cell: 1, grain: 0.45 });
  each(sk, 'spider', ['body'], (face, r) => {
    if (face !== 'top') return;
    for (let y = 1; y < r[3] - 1; y += 2) for (let x = 3; x < 7; x++) if ((x + y) % 3) at(sk, r, x, y, 0x2a6a70);
  });
  const f = reg(cubesOf('spider', 'head')[0]).front;
  sk.paint(f[0], f[1], ['........', '.r....r.', '.RR..RR.', '..rRRr..', '........', '........', '..k..k..', '........'],
    { r: 0x8a0a0a, R: 0xd82020, k: 0x06100e });
});

// The drowned: a zombie long in the water, blue-green and bloated, in rags with kelp caught on
// them, and eyes that glow.
skin('drowned', (sk) => {
  zombieSkin(sk, [0x3a7070, 0x447c7a, 0x4e8884, 0x58948e], [0x2a5a5a, 0x306464, 0x366e6e, 0x3c7878], [0x3a4a6a, 0x425274, 0x4a5a7e], 0x60f0e0);
  for (const R of [HR.body, HR.rLeg, HR.lLeg]) {
    for (const side of SIDES) {
      const r = R[side];
      for (let k = 0; k < 2; k++) { const x = sk.ri(r[2]); for (let y = sk.ri(4); y < r[3]; y++) if (sk.r() < 0.8) at(sk, r, x, y, [0x2a6a2a, 0x347a30][y % 2]); }
    }
  }
});

// Dolphins: blue-grey above and pale below, with a darker fin and flippers, and a friendly eye.
skin('dolphin', (sk) => {
  const back = [0x4a5a6e, 0x546478, 0x5e6e82, 0x68788c], belly = [0xc0c8d0, 0xcad2da, 0xd4dce2];
  fur(sk, 'dolphin', ['body', 'head', 'tail', 'finR'], back, { cell: 2, grain: 0.25 });
  for (const cube of [...cubesOf('dolphin', 'body'), ...cubesOf('dolphin', 'head'), ...cubesOf('dolphin', 'tail')]) {
    const R = reg(cube);
    sk.fill(R.bottom, belly, { cell: 2 });
    for (const side of ['right', 'left', 'front', 'back']) if (R[side][3] > 3) sk.fill([R[side][0], R[side][1] + R[side][3] - 2, R[side][2], 2], belly, { cell: 1 });
  }
  const H = reg(cubesOf('dolphin', 'head')[0]);
  at(sk, H.right, 1, 3, 0x101418); at(sk, H.left, 4, 3, 0x101418);
  const beak = reg(cubesOf('dolphin', 'head')[1]);
  for (const side of SIDES) sk.fill(beak[side], belly, { cell: 1 });
});

// Snow golems: packed snow (blue-white, a few darker lumps), stick arms, and a carved pumpkin with
// a candle-lit face.
skin('snow_golem', (sk) => {
  const SNOW = [0xd8e4ee, 0xe4eef6, 0xeef5fb, 0xf8fbfe], STICK = [0x4a3418, 0x5e4422, 0x75562c];
  fur(sk, 'snow_golem', ['body'], SNOW, { cell: 2, grain: 0.3 });
  each(sk, 'snow_golem', ['body'], (face, r) => { for (let k = 0; k < 4; k++) at(sk, r, sk.ri(r[2]), sk.ri(r[3]), 0xc4d4e2); });
  fur(sk, 'snow_golem', ['rightArm'], STICK, { cell: 1, grain: 0.4 });
  const PUMPKIN = [0xb85c0e, 0xcc6c12, 0xe07e1c, 0xee9028];
  const [head] = cubesOf('snow_golem', 'head');
  sk.box(head, (face, r) => {
    sk.fill(r, PUMPKIN, { cell: 1, cy: 8, grain: 0.2 });
    // Ridges down the sides.
    if (face !== 'top' && face !== 'bottom') for (const x of [1, 4, 6]) for (let y = 0; y < r[3]; y++) at(sk, r, x, y, 0xa84e0a);
    if (face === 'top') { at(sk, r, 3, 3, 0x4a6a1a); at(sk, r, 4, 3, 0x4a6a1a); at(sk, r, 4, 4, 0x3a5412); }
  });
  const f = reg(head).front, lit = 0xffc84a, dark = 0x3a1e04;
  sk.fill(f, PUMPKIN, { cell: 1, cy: 8, grain: 0.15 });
  for (const [x, y] of [[1, 2], [2, 2], [1, 3], [5, 2], [6, 2], [6, 3]]) at(sk, f, x, y, lit);
  for (const [x, y] of [[2, 3], [5, 3]]) at(sk, f, x, y, dark);
  for (let x = 1; x < 7; x++) at(sk, f, x, 5, lit);
  for (const x of [2, 4, 6]) at(sk, f, x, 6, lit);
  for (const x of [1, 3, 5]) at(sk, f, x, 6, dark);
});

// ---------------------------------------------------------------- the Nether's
// Piglins: pink hide, a darker snout with its nostrils, cream tusks, and the gold they love (a
// medallion on a leather strap, bracers, a buckle) over a leather loincloth. Zombified ones are
// half rotted away: green-grey flesh, the skull showing through the side of the head, ribs
// through the chest, one eye gone.
const PIG_HIDE = ramp(0xe8948c, 5, 0.1, 6);
const LEATHER = [0x3e2412, 0x4e2e18, 0x5e3a1e, 0x6e4626];
const GOLD_BITS = [0xb07a10, 0xd8a020, 0xf2c83a, 0xffe676];
const PIG_BONE = [0xb4b0a0, 0xcac6b6, 0xdcd8c8, 0xeeeade];
function piglinSkin(sk, hide, zombified) {
  const P = RIGS.piglin.bones, [head, snout, tuskR, tuskL] = P.head.cubes, H = reg(head);
  const deep = hide.map((c) => mix(c, 0x7a2e2c, 0.22));
  sk.box(head, (face, r) => sk.fill(r, hide, { cell: 2, grain: 0.25 }));
  const f = H.front;
  // Brows, small eyes, a mouth line under the snout.
  for (const x of [1, 2, 3, 6, 7, 8]) at(sk, f, x, 2, deep[0]);
  at(sk, f, 2, 3, 0xf2eee8); at(sk, f, 3, 3, 0x1a1210); at(sk, f, 6, 3, 0x1a1210); at(sk, f, 7, 3, 0xf2eee8);
  for (let x = 2; x < 8; x++) at(sk, f, x, 7, deep[1]);
  sk.box(snout, (face, r) => sk.fill(r, deep.slice(1), { cell: 1, grain: 0.2 }));
  const s = reg(snout).front;
  row(sk, s, 0, deep[4]); at(sk, s, 1, 1, 0x5a2422); at(sk, s, 2, 1, 0x5a2422); at(sk, s, 1, 2, deep[1]); at(sk, s, 2, 2, deep[1]);
  for (const t of [tuskR, tuskL]) sk.box(t, (face, r) => sk.fill(r, [0xd4c8a4, 0xe4dabc, 0xf2ead6], { cell: 1 }));
  for (const b of ['rightEar', 'leftEar']) sk.box(P[b].cubes[0], (face, r) => sk.fill(r, face === 'right' || face === 'left' ? deep : hide, { cell: 1, grain: 0.2 }));
  // The body: bare, crossed by a strap with a gold medallion; a belt with a buckle and a loincloth.
  for (const R of [HR.body, HR.rArm, HR.lArm, HR.rLeg, HR.lLeg]) fillAll(sk, R, hide, { cell: 2, grain: 0.25 });
  for (const R of [HR.hat, HR.jacket, HR.rSleeve, HR.lSleeve, HR.rPants, HR.lPants]) clearAll(sk, R);
  const b = HR.body.front;
  for (let y = 0; y < 8; y++) { at(sk, b, y, y, LEATHER[2]); at(sk, b, y + 1 > 7 ? 7 : y + 1, y, LEATHER[1]); }
  at(sk, b, 3, 3, GOLD_BITS[3]); at(sk, b, 4, 3, GOLD_BITS[2]); at(sk, b, 3, 4, GOLD_BITS[1]); at(sk, b, 4, 4, GOLD_BITS[0]);
  for (const side of SIDES) {
    const r = HR.body[side];
    sk.fill([r[0], r[1] + 8, r[2], 1], LEATHER.slice(0, 2), { cell: 1 });
    sk.fill([r[0], r[1] + 9, r[2], 3], LEATHER, { cell: 1, grain: 0.35 });
    // The loincloth hangs over the tops of the legs; hooves below.
    for (const R of [HR.rLeg, HR.lLeg]) {
      sk.fill([R[side][0], R[side][1], R[side][2], 3], LEATHER, { cell: 1, grain: 0.35 });
      sk.fill([R[side][0], R[side][1] + 10, R[side][2], 2], [0x2e2220, 0x3a2c28, 0x463430], { cell: 1 });
    }
    // Gold bracers on the right wrist, leather on the left.
    sk.fill([HR.rArm[side][0], HR.rArm[side][1] + 9, HR.rArm[side][2], 2], GOLD_BITS, { cell: 1 });
    sk.fill([HR.lArm[side][0], HR.lArm[side][1] + 9, HR.lArm[side][2], 2], LEATHER, { cell: 1 });
  }
  at(sk, b, 3, 8, GOLD_BITS[3]); at(sk, b, 4, 8, GOLD_BITS[2]);
  if (!zombified) return;
  // Rot: green-grey patches over everything that's flesh.
  const rot = [0x6e7e5e, 0x7c8c6a, 0x8a9a76, 0x98a882];
  for (const R of [H, HR.body, HR.rArm, HR.lArm, HR.rLeg, HR.lLeg]) {
    for (const r of all(R)) {
      const n = sk.field(r[2], r[3], 3, 3, 0.3);
      for (let y = 0; y < r[3]; y++) for (let x = 0; x < r[2]; x++) {
        const c = sk.get(r[0] + x, r[1] + y);
        if (n[y * r[2] + x] > 0.6 && !LEATHER.includes(c) && !GOLD_BITS.includes(c)) sk.set(r[0] + x, r[1] + y, rot[sk.ri(rot.length)]);
      }
    }
  }
  // The skull showing through the right side of the head, and its empty eye.
  sk.fill([H.right[0] + 1, H.right[1] + 1, 5, 5], PIG_BONE, { cell: 1, grain: 0.3 });
  at(sk, H.right, 2, 3, 0x1a1414); at(sk, H.right, 3, 3, 0x1a1414);
  at(sk, f, 7, 3, 0x0e0a0a); at(sk, f, 8, 3, PIG_BONE[1]); at(sk, f, 8, 4, PIG_BONE[2]); at(sk, f, 7, 4, PIG_BONE[0]);
  // Ribs through the chest (on the right, clear of the strap).
  for (let y = 2; y < 8; y += 2) for (let x = 0; x < 3; x++) { at(sk, HR.body.front, x, y, PIG_BONE[2 + (x % 2)]); at(sk, HR.body.front, x, y + 1, 0x2a1a18); }
  // Bone at the elbow of the left arm.
  for (const side of ['front', 'right', 'back']) sk.fill([HR.lArm[side][0], HR.lArm[side][1] + 4, HR.lArm[side][2], 3], PIG_BONE, { cell: 1 });
}
skin('piglin', (sk) => piglinSkin(sk, PIG_HIDE, false));
skin('zombified_piglin', (sk) => piglinSkin(sk, ramp(0xd88e86, 5, 0.1, 6), true));

// Ghasts: white and soft, with closed, weeping eyes (open and red, and the mouth wide, when about
// to spit fire).
function ghastSkin(sk, firing) {
  const G = RIGS.ghast.bones, WHITE = [0xd4d4d4, 0xe0e0e0, 0xebebeb, 0xf4f4f4, 0xfcfcfc];
  sk.box(G.body.cubes[0], (face, r) => {
    sk.fill(r, face === 'bottom' ? WHITE.slice(0, 3) : WHITE, { cell: 3, grain: 0.12 });
    if (face !== 'top' && face !== 'bottom') for (let k = 0; k < 6; k++) { const x = sk.ri(r[2]); for (let y = 8 + sk.ri(4); y < r[3]; y++) at(sk, r, x, y, WHITE[1]); }
  });
  sk.box(G.tentacle0.cubes[0], (face, r) => sk.fill(r, WHITE.slice(0, 4), { cell: 1, grain: 0.2 }));
  const f = reg(G.body.cubes[0]).front;
  if (!firing) {
    for (const x0 of [3, 9]) {
      for (let x = x0; x < x0 + 4; x++) { at(sk, f, x, 5, 0x6a6a70); at(sk, f, x, 4, WHITE[1]); }
      // Tears: grey streaks down from the eyes.
      for (let y = 6; y < 11; y++) at(sk, f, x0 + (x0 === 3 ? 1 : 2), y, y % 2 ? 0xb8bcc4 : 0xa8acb4);
    }
    for (let x = 6; x < 10; x++) at(sk, f, x, 11, 0x7a7a80);
  } else {
    for (const x0 of [3, 9]) {
      for (let y = 3; y < 7; y++) for (let x = x0; x < x0 + 4; x++) {
        const edge = y === 3 || y === 6 || x === x0 || x === x0 + 3;
        at(sk, f, x, y, edge ? 0x3a0808 : y === 4 ? 0xff5a3a : 0xd41c1c);
      }
      for (let y = 7; y < 11; y++) at(sk, f, x0 + (x0 === 3 ? 1 : 2), y, 0x9aa0aa);
    }
    for (let y = 10; y < 14; y++) for (let x = 5; x < 11; x++) at(sk, f, x, y, y === 10 || x === 5 || x === 10 ? 0x2a1010 : 0x100606);
    at(sk, f, 7, 12, 0x6a1010); at(sk, f, 8, 12, 0x6a1010);
  }
}
skin('ghast', (sk) => ghastSkin(sk, false));
skin('ghast_fire', (sk) => ghastSkin(sk, true));

// Blazes: a head of living fire, gold and orange with dark smoke curling over it, and black
// eyes; rods glowing hotter towards their tips.
skin('blaze', (sk) => {
  const B2 = RIGS.blaze.bones, FIRE = [0xa85206, 0xd47a12, 0xeea424, 0xf8c63c, 0xffe478];
  sk.box(B2.head.cubes[0], (face, r) => {
    sk.fill(r, FIRE, { cell: 2, grain: 0.3 });
    const n = sk.field(r[2], r[3], 2, 2, 0.3);
    for (let y = 0; y < r[3]; y++) for (let x = 0; x < r[2]; x++) if (n[y * r[2] + x] > 0.72) at(sk, r, x, y, [0x3a2210, 0x4e2e14][sk.ri(2)]);
  });
  const f = reg(B2.head.cubes[0]).front;
  sk.fill(f, FIRE.slice(1), { cell: 2, grain: 0.25 });
  for (const x of [1, 2, 5, 6]) { at(sk, f, x, 3, 0x120a06); at(sk, f, x, 4, 0x5a2a08); }
  for (let x = 2; x < 6; x++) at(sk, f, x, 6, 0x6a3408);
  sk.box(B2.rod0.cubes[0], (face, r) => {
    for (let y = 0; y < r[3]; y++) for (let x = 0; x < r[2]; x++) at(sk, r, x, y, FIRE[Math.min(4, Math.max(0, 4 - Math.floor(y / 2) + (sk.r() < 0.3 ? -1 : 0)))]);
  });
});

// Magma cubes: slabs of black-red crust with lava glowing in the cracks and between them, and
// glowing eyes; a white-hot core.
skin('magma_cube', (sk) => {
  const M = RIGS.magma_cube.bones, CRUST = [0x1c0604, 0x2a0a06, 0x3a1008, 0x4c160a], LAVA = [0xc83808, 0xe86010, 0xf89a20, 0xffd060];
  for (let i = 0; i < 8; i++) {
    sk.box(M[`slice${i}`].cubes[0], (face, r) => {
      sk.fill(r, CRUST, { cell: 2, grain: 0.35 });
      const n = sk.field(r[2], r[3], 2, 2, 0.4);
      for (let y = 0; y < r[3]; y++) for (let x = 0; x < r[2]; x++) {
        const v = n[y * r[2] + x];
        if (v > 0.74) at(sk, r, x, y, LAVA[v > 0.86 ? 3 : v > 0.8 ? 2 : 1]);
        else if (v > 0.66) at(sk, r, x, y, 0x6a1c0a);
      }
    });
  }
  // Eyes, across the fourth and fifth slabs.
  const e4 = reg(M.slice4.cubes[0]).front, e5 = reg(M.slice5.cubes[0]).front;
  for (const x of [1, 2, 5, 6]) { at(sk, e5, x, 0, LAVA[3]); at(sk, e4, x, 0, x === 2 || x === 5 ? 0x8a1004 : LAVA[2]); }
  sk.box(M.core.cubes[0], (face, r) => sk.fill(r, LAVA.slice(1), { cell: 1, grain: 0.3 }));
});

// Wither skeletons: charred black bones, darker than the dark.
skin('wither_skeleton', (sk) => {
  skeletonSkin(sk, [0x141414, 0x1c1c1c, 0x262626, 0x303030, 0x3c3c3c], null);
  const S = RIGS.skeleton.bones, f = reg(S.head.cubes[0]).front;
  sk.paint(f[0], f[1], ['........', '........', '........', '.kk..kk.', '.kk..kk.', '...kk...', '.k.k.k..', '........'], { k: 0x050505 });
  const body = reg(S.body.cubes[0]);
  for (const side of ['front', 'back']) {
    const r = body[side];
    for (let y = 1; y < 8; y += 2) for (let x = 1; x < 7; x++) if (x !== 3 && x !== 4) at(sk, r, x, y, 0x080808);
  }
});

// Hoglins: tawny bristling hide with a dark crest, a pink snout, cream tusks and dark hooves.
skin('hoglin', (sk) => {
  const HB = RIGS.hoglin.bones, HIDE = ramp(0xb8845a, 5, 0.1, 8), DARK = [0x3e2818, 0x4c3220, 0x5a3c26];
  fur(sk, 'hoglin', ['body', 'legFR'], HIDE, { cell: 2, grain: 0.35 });
  // A darker, bristly back.
  const top = reg(HB.body.cubes[0]).top;
  for (let y = 0; y < top[3]; y++) for (let x = 3; x < 9; x++) if (sk.r() < 0.7) at(sk, top, x, y, DARK[sk.ri(3)]);
  sk.box(HB.crest.cubes[0], (face, r) => sk.fill(r, DARK, { cell: 1, grain: 0.5 }));
  const [headBox, tusk] = HB.head.cubes, Hd = reg(headBox);
  sk.box(headBox, (face, r) => sk.fill(r, HIDE, { cell: 2, grain: 0.3 }));
  sk.fill(Hd.front, [0xc8847c, 0xd8948c, 0xe4a49c], { cell: 1, grain: 0.2 });
  at(sk, Hd.front, 3, 2, 0x5a2a28); at(sk, Hd.front, 6, 2, 0x5a2a28);
  for (const side of ['right', 'left']) {
    const r = Hd[side];
    // Small eyes near the back of the head (the head's side runs back to front).
    const x = side === 'right' ? r[2] - 3 : 2;
    at(sk, r, x, 1, 0x141010); at(sk, r, side === 'right' ? x + 1 : x - 1, 1, 0xe8e4dc);
  }
  sk.box(tusk, (face, r) => sk.fill(r, [0xd0c4a0, 0xe0d6b8, 0xeee6d0], { cell: 1 }));
  sk.box(HB.rightEar.cubes[0], (face, r) => sk.fill(r, face === 'bottom' ? [0xc8847c, 0xd8948c] : HIDE, { cell: 1 }));
  feet(sk, 'hoglin', ['legFR'], 2, [0x2a2220, 0x3a302c]);
});

// Striders: warm red and speckled on the lava, a wide mouth, pale bristles; out of it they go cold
// and purple.
function striderSkin(sk, body, legs, bristle) {
  const S2 = RIGS.strider.bones;
  sk.box(S2.body.cubes[0], (face, r) => {
    sk.fill(r, body, { cell: 2, grain: 0.3 });
    for (let k = 0; k < (r[2] * r[3]) / 10; k++) at(sk, r, sk.ri(r[2]), sk.ri(r[3]), body[0]);
  });
  const f = reg(S2.body.cubes[0]).front;
  for (const x0 of [3, 11]) { at(sk, f, x0, 3, 0x0e0a0a); at(sk, f, x0 + 1, 3, 0x0e0a0a); at(sk, f, x0, 4, 0x0e0a0a); at(sk, f, x0 + 1, 4, 0x2a2020); at(sk, f, x0, 3, 0xf0e8e8); }
  for (let x = 2; x < 14; x++) { at(sk, f, x, 9, 0x1a0808); at(sk, f, x, 10, x % 3 === 0 ? 0xe8dcc8 : 0x2a0e0c); }
  sk.box(S2.rightLeg.cubes[0], (face, r) => sk.fill(r, legs, { cell: 1, cy: 3, grain: 0.3 }));
  // The bristles: strands of hair fanning out from the body (its edge is the right of the
  // picture), clear between; the underside is the same strands seen from below.
  const Br = reg(S2.bristle0.cubes[0]);
  for (let y = 0; y < 16; y++) {
    if (y % 3 === 2) continue;
    const len = 6 + sk.ri(7);
    for (let k = 0; k < len; k++) {
      const c = k < 2 ? bristle[0] : k > len - 3 ? bristle[2] : bristle[1 + ((k + y) & 1)];
      at(sk, Br.top, 11 - k, y, c); at(sk, Br.bottom, 11 - k, 15 - y, c);
    }
  }
}
skin('strider', (sk) => striderSkin(sk, [0x782020, 0x962e2a, 0xb03c36, 0xc64c44, 0xd66052], [0x3a1826, 0x4a2032, 0x5a2a3e], [0xc8a8a0, 0xe0c4bc, 0xf0dcd4]));
skin('strider_cold', (sk) => striderSkin(sk, [0x46304e, 0x563a60, 0x664472, 0x785084, 0x8a5c96], [0x2a1e34, 0x342640, 0x3e2e4c], [0xa89cb8, 0xc0b4d0, 0xd8d0e4]));
// A strider's saddle: leather with a stitched rim, and its straps.
skin('strider_saddle', (sk) => {
  const [seat, strap] = RIGS.strider.bones.saddle.cubes, L = [0x4a2a14, 0x5c341a, 0x6e4020, 0x804c28];
  sk.box(seat, (face, r) => { sk.fill(r, L, { cell: 1, grain: 0.3 }); if (face === 'top') for (let x = 0; x < r[2]; x++) { at(sk, r, x, 0, L[0]); at(sk, r, x, r[3] - 1, L[0]); } });
  sk.box(strap, (face, r) => sk.fill(r, [0x2e1a0c, 0x3a2210], { cell: 1 }));
  at(sk, reg(strap).right, 0, 5, 0xb0b0b8); at(sk, reg(strap).right, 1, 5, 0xd0d0d8);
});
