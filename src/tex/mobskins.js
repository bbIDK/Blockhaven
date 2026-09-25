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
