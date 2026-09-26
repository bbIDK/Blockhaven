// The wildlife update's creature skins, painted over their models' boxes (wildrigs.js) the way the
// rest are (tex/mobskins.js): fur and hide in soft blotches of four or five shades from the same
// ramps and noise as the blocks, and a few careful pixels for faces, stripes and spots. (The panda,
// the bee and the zebra, and the wolves' and foxes' coats, come from the texture pack where it has
// them; see tools/skin-sources.mjs. These drawings are their fallback.)
import { skin } from '../skins.js';
import { ramp, mix } from './core.js';
import { reg, cubesOf, each, fur, at, row, tone, feet, fore, horseSkin, wolfSkin, foxSkin } from './mobskins.js';

const SIDES = ['right', 'left'];
// Every face of a bone's boxes but those listed.
const allBut = (sk, rig, bones, skip, fn) => each(sk, rig, bones, (face, r, cube) => { if (!skip.includes(face)) fn(face, r, cube); });
// The lower `frac` of a box's sides (and its underside) in another colour: bellies.
function belly(sk, cube, pal, frac = 0.35, wave = true) {
  const R = reg(cube);
  sk.fill(R.bottom, pal, { cell: 1 });
  for (const side of [...SIDES, 'front', 'back']) {
    const r = R[side], b = Math.max(1, Math.round(r[3] * frac));
    for (let x = 0; x < r[2]; x++) {
      const bb = b + (wave && (x * 5) % 3 === 0 ? 1 : 0);
      for (let y = r[3] - bb; y < r[3]; y++) at(sk, r, x, y, pal[(x + y) % pal.length]);
    }
  }
}
// Clears a face (so that side of a box isn't drawn).
const clear = (sk, r) => sk.clearRect(r[0], r[1], r[2], r[3]);
// A two-pixel eye at (x, y) on both sides of a head box, counted from the front.
function eyes(sk, cube, x, y, c = 0x121010, glint = null) {
  const R = reg(cube);
  for (const side of SIDES) {
    at(sk, R[side], fore(R[side], side, x), y, c);
    if (glint !== null) at(sk, R[side], fore(R[side], side, x + 1), y, glint);
  }
}

// ---------------------------------------------------------------- bears
// Brown and black bears, on the polar bear's model: shaggy fur darker on the legs, a paler
// muzzle, small dark eyes and a black nose.
function bearSkin(base, muzzleC, legC) {
  return (sk) => {
    const pal = ramp(base, 5, 0.12, 8), legs = ramp(legC, 4, 0.1, 6);
    fur(sk, 'polar_bear', ['body', 'head'], pal, { cell: 2, grain: 0.35 });
    fur(sk, 'polar_bear', ['legFR'], legs, { cell: 2, grain: 0.3 });
    // (A hump of lighter fur over the shoulders.)
    each(sk, 'polar_bear', ['body'], (face, r) => { if (face === 'top') sk.fill([r[0], r[1] + r[3] - 6, r[2], 6], pal.slice(1), { cell: 2 }); });
    const [head, muzzle, ear] = cubesOf('polar_bear', 'head');
    const f = reg(head).front;
    at(sk, f, 1, 3, 0x0e0c0a); at(sk, f, 5, 3, 0x0e0c0a);
    sk.box(muzzle, (face, r) => sk.fill(r, ramp(muzzleC, 3, 0.06, 4), { cell: 1 }));
    const m = reg(muzzle).front;
    for (let x = 1; x < 4; x++) at(sk, m, x, 0, 0x141210);
    at(sk, m, 2, 1, 0x141210);
    sk.box(ear, (face, r) => sk.fill(r, pal.slice(0, 3), { cell: 1 }));
    feet(sk, 'polar_bear', ['legFR'], 1, [0x1a1612, 0x241e18]);
  };
}
skin('brown_bear', bearSkin(0x6e4a2c, 0x9a7650, 0x4e3420));
skin('black_bear', bearSkin(0x2c2622, 0xa88a64, 0x201c18));

// ---------------------------------------------------------------- deer and moose
const DEER = ramp(0x9c6a3c, 5, 0.1, 8), DEER_WHITE = ramp(0xece6da, 3, 0.05, 4), ANTLER = [0xa89a80, 0xc4b89c, 0xd8ceb4];
skin('deer', (sk) => {
  fur(sk, 'deer', ['body', 'neck', 'head', 'earR', 'legFR'], DEER, { cell: 2, grain: 0.3 });
  const [body, tail] = cubesOf('deer', 'body');
  belly(sk, body, DEER_WHITE, 0.25);
  // The tail: brown above, a white flag beneath and behind.
  sk.box(tail, (face, r) => sk.fill(r, face === 'top' ? DEER : DEER_WHITE, { cell: 1 }));
  // A white throat patch, white rings round the eyes, a black nose.
  const N = reg(cubesOf('deer', 'neck')[0]);
  sk.fill([N.front[0], N.front[1], N.front[2], 3], DEER_WHITE, { cell: 1 });
  const [head, snout] = cubesOf('deer', 'head');
  eyes(sk, head, 1, 1, 0x100c0a);
  const H = reg(head);
  for (const side of SIDES) { at(sk, H[side], fore(H[side], side, 0), 1, DEER_WHITE[1]); at(sk, H[side], fore(H[side], side, 1), 2, DEER_WHITE[1]); }
  const S = reg(snout);
  sk.fill(S.front, [0x1c1614, 0x262020], { cell: 1 });
  for (const side of SIDES) at(sk, S[side], fore(S[side], side, 0), S[side][3] - 1, 0x1c1614);
  sk.fill(S.bottom, DEER_WHITE, { cell: 1 });
  // Pale insides to the ears; dark hooves.
  each(sk, 'deer', ['earR'], (face, r) => { if (face === 'front') sk.fill(r, [0xd8b8a8, 0xe0c4b4], { cell: 1 }); });
  feet(sk, 'deer', ['legFR'], 2, [0x2a2220, 0x342a26]);
  // Antlers of bone, darker at the points.
  fur(sk, 'deer', ['antlerR', 'tineR', 'browR'], ANTLER, { cell: 1, grain: 0.2 });
  each(sk, 'deer', ['tineR', 'browR'], (face, r) => { if (face === 'back' || face === 'front') at(sk, r, 0, 0, 0x6e6450); });
});

const MOOSE = ramp(0x3e2a1c, 5, 0.1, 8), MOOSE_LEGS = ramp(0x9a8a78, 4, 0.08, 6), MOOSE_ANTLER = [0x9a8a6a, 0xb4a484, 0xc8b898];
skin('moose', (sk) => {
  fur(sk, 'moose', ['body', 'neck', 'head', 'earR'], MOOSE, { cell: 2, grain: 0.3 });
  fur(sk, 'moose', ['legFR'], MOOSE_LEGS, { cell: 2, grain: 0.3 });
  feet(sk, 'moose', ['legFR'], 2, [0x1e1a16, 0x28221c]);
  const [head, nose, bell] = cubesOf('moose', 'head');
  eyes(sk, head, 3, 1, 0x0c0a08);
  // A pale, drooping nose with dark nostrils.
  sk.box(nose, (face, r) => sk.fill(r, ramp(0x6a5040, 3, 0.06, 4), { cell: 1 }));
  const N = reg(nose).front;
  at(sk, N, 0, 2, 0x100c0a); at(sk, N, 3, 2, 0x100c0a);
  sk.box(bell, (face, r) => sk.fill(r, MOOSE.slice(0, 3), { cell: 1 }));
  fur(sk, 'moose', ['antlerR', 'pointsR'], MOOSE_ANTLER, { cell: 1, grain: 0.2 });
});

// ---------------------------------------------------------------- boars
const BOAR = ramp(0x4a3a2e, 5, 0.12, 8), BOAR_CREST = [0x1e1814, 0x2a221c, 0x342a22];
skin('boar', (sk) => {
  fur(sk, 'boar', ['body', 'head', 'earR', 'legFR'], BOAR, { cell: 1, cy: 2, grain: 0.45 });
  const [, crest, tail] = cubesOf('boar', 'body');
  for (const cube of [crest, tail]) sk.box(cube, (face, r) => sk.fill(r, BOAR_CREST, { cell: 1, grain: 0.4 }));
  const [head, snout, tuskR, tuskL] = cubesOf('boar', 'head');
  eyes(sk, head, 2, 2, 0x0e0a08);
  sk.box(snout, (face, r) => sk.fill(r, [0x7a5e56, 0x866a60, 0x92766a], { cell: 1 }));
  const S = reg(snout).front;
  at(sk, S, 1, 1, 0x2a1e1a); at(sk, S, 2, 1, 0x2a1e1a);
  for (const t of [tuskR, tuskL]) sk.box(t, (face, r) => sk.fill(r, [0xd8d0b8, 0xe8e0cc, 0xf0eadc], { cell: 1 }));
  feet(sk, 'boar', ['legFR'], 1, [0x141010, 0x1c1614]);
});

// ---------------------------------------------------------------- big cats
// Stripes: dark bands across the sides of a box, a little ragged, every `gap` pixels.
function stripes(sk, r, gap, c, vertical = true, phase = 0) {
  const [w, h] = [r[2], r[3]];
  for (let k = phase; k < (vertical ? w : h); k += gap) {
    for (let t = 0; t < (vertical ? h : w); t++) {
      if ((t * 7 + k * 3) % 5 === 0) continue;
      const wob = ((t + k) % 4 === 0 ? 1 : 0);
      if (vertical) at(sk, r, Math.min(w - 1, k + wob), t, c); else at(sk, r, t, Math.min(h - 1, k + wob), c);
    }
  }
}
const TIGER = ramp(0xe0782a, 5, 0.1, 8), CAT_WHITE = ramp(0xf0ece2, 3, 0.05, 4), TIGER_BLACK = 0x1a1210;
skin('tiger', (sk) => {
  fur(sk, 'tiger', ['body', 'head', 'earR', 'legFR', 'tail'], TIGER, { cell: 2, grain: 0.3 });
  const [body] = cubesOf('tiger', 'body');
  belly(sk, body, CAT_WHITE, 0.28);
  const B = reg(body);
  for (const side of SIDES) stripes(sk, [B[side][0], B[side][1], B[side][2], Math.ceil(B[side][3] * 0.75)], 3, TIGER_BLACK, true, 1);
  stripes(sk, B.top, 3, TIGER_BLACK, false, 1);
  each(sk, 'tiger', ['legFR'], (face, r) => { if (face !== 'top' && face !== 'bottom') stripes(sk, [r[0], r[1], r[2], r[3] - 2], 3, TIGER_BLACK, false, 1); });
  each(sk, 'tiger', ['tail'], (face, r) => {
    if (face === 'front' || face === 'back') return;
    const along = face === 'top' || face === 'bottom';
    stripes(sk, r, 3, TIGER_BLACK, !along, 2);
    if (face === 'top') sk.fill([r[0], r[1], r[2], 2], [TIGER_BLACK, 0x241a16], { cell: 1 });
  });
  const [head, muzzle, nose] = cubesOf('tiger', 'head');
  const H = reg(head);
  // White cheeks and brows, dark forehead stripes, amber eyes.
  const f = H.front;
  for (let y = 3; y < f[3]; y++) for (let x = 0; x < f[2]; x++) if (x < 2 || x > f[2] - 3) at(sk, f, x, y, CAT_WHITE[1 + ((x + y) & 1)]);
  at(sk, f, 1, 2, 0xf0f0e8); at(sk, f, 5, 2, 0xf0f0e8);
  at(sk, f, 2, 2, 0xd8b030); at(sk, f, 4, 2, 0xd8b030); at(sk, f, 2, 3, 0x1a1210); at(sk, f, 4, 3, 0x1a1210);
  for (const x of [2, 3, 4]) at(sk, f, x, 0, TIGER_BLACK);
  at(sk, f, 3, 1, TIGER_BLACK);
  for (const side of SIDES) stripes(sk, [H[side][0], H[side][1], H[side][2], 4], 2, TIGER_BLACK, true, 1);
  sk.box(muzzle, (face, r) => sk.fill(r, CAT_WHITE, { cell: 1 }));
  sk.box(nose, (face, r) => sk.fill(r, [0xc88878, 0xd49484], { cell: 1 }));
  const M = reg(muzzle).front;
  for (let x = 0; x < M[2]; x++) at(sk, M, x, M[3] - 1, 0x3a2a26);
  each(sk, 'tiger', ['earR'], (face, r) => { if (face === 'back') { sk.fill(r, [TIGER_BLACK, 0x241a16], { cell: 1 }); at(sk, r, 1, 1, 0xf0f0e8); } });
  feet(sk, 'tiger', ['legFR'], 1, CAT_WHITE);
});

const LION = ramp(0xc89a58, 5, 0.1, 8), LION_BELLY = ramp(0xe0c490, 3, 0.05, 4), MANE = ramp(0x6a4428, 5, 0.12, 8);
skin('lion', (sk) => {
  fur(sk, 'lion', ['body', 'head', 'earR', 'legFR', 'tail'], LION, { cell: 2, grain: 0.3 });
  const [body] = cubesOf('lion', 'body');
  belly(sk, body, LION_BELLY, 0.28);
  fur(sk, 'lion', ['mane'], MANE, { cell: 1, cy: 2, grain: 0.45 });
  // (The mane is open in front, round the face.)
  const [maneFront] = cubesOf('lion', 'mane');
  const MF = reg(maneFront).front;
  clear(sk, [MF[0] + 2, MF[1] + 1, MF[2] - 4, MF[3] - 3]);
  const [head, muzzle, nose] = cubesOf('lion', 'head');
  const f = reg(head).front;
  at(sk, f, 1, 2, 0xf0e8d8); at(sk, f, 5, 2, 0xf0e8d8);
  at(sk, f, 2, 2, 0xc89020); at(sk, f, 4, 2, 0xc89020); at(sk, f, 2, 3, 0x1a1210); at(sk, f, 4, 3, 0x1a1210);
  sk.box(muzzle, (face, r) => sk.fill(r, LION_BELLY, { cell: 1 }));
  sk.box(nose, (face, r) => sk.fill(r, [0x5a3a30, 0x6a463a], { cell: 1 }));
  const M = reg(muzzle).front;
  for (let x = 0; x < M[2]; x++) at(sk, M, x, M[3] - 1, 0x3a2a22);
  // A dark tuft at the tail's tip.
  each(sk, 'lion', ['tail'], (face, r) => {
    if (face === 'back') sk.fill(r, MANE.slice(0, 3), { cell: 1 });
    else if (face !== 'front') { const n = 3; const tip = face === 'top' || face === 'bottom' ? [r[0], r[1] + (face === 'top' ? 0 : r[3] - n), r[2], n] : [r[0] + (face === 'right' ? 0 : r[2] - n), r[1], n, r[3]]; sk.fill(tip, MANE.slice(0, 3), { cell: 1 }); }
  });
  feet(sk, 'lion', ['legFR'], 1, LION_BELLY);
});

// ---------------------------------------------------------------- elephants
// Grey, wrinkled hide (fine dark creases across the legs and trunk), pinkish-grey insides to the
// ears, ivory tusks, pale toenails and a black tuft on the tail.
const ELEPHANT = ramp(0x7e7a76, 5, 0.1, 6);
function creases(sk, r, every, c) { for (let y = 1; y < r[3]; y += every) for (let x = 0; x < r[2]; x++) if ((x + y) % 5) at(sk, r, x, y, c); }
skin('elephant', (sk) => {
  fur(sk, 'elephant', ['body', 'head', 'trunk1', 'trunk2', 'trunk3', 'earR', 'legFR', 'tail'], ELEPHANT, { cell: 2, grain: 0.3 });
  each(sk, 'elephant', ['legFR', 'trunk1', 'trunk2', 'trunk3'], (face, r) => { if (face !== 'top' && face !== 'bottom') creases(sk, r, 2, ELEPHANT[0]); });
  each(sk, 'elephant', ['body'], (face, r) => { if (face !== 'top') for (let k = 0; k < (r[2] * r[3]) / 10; k++) at(sk, r, sk.ri(r[2]), sk.ri(r[3]), ELEPHANT[1]); });
  // Small dark eyes at the front of the head, in front of where the ears join it (so the ears don't
  // hide them), wrapping round the corners so they show from the front too.
  const [head] = cubesOf('elephant', 'head');
  eyes(sk, head, 0, 4, 0x141210, 0x2e2622);
  const f = reg(head).front;
  at(sk, f, 0, 4, 0x141210); at(sk, f, f[2] - 1, 4, 0x141210);
  each(sk, 'elephant', ['earR'], (face, r) => { if (face === 'left') sk.fill(r, [0x9a8480, 0xa68e8a, 0xb09896], { cell: 2 }); });
  fur(sk, 'elephant', ['tuskR'], [0xd8ceb4, 0xe6dcc6, 0xf0e8d6], { cell: 1, grain: 0.2 });
  each(sk, 'elephant', ['legFR'], (face, r) => {
    if (face === 'bottom') sk.fill(r, [0x5a5652, 0x645e5a], { cell: 1 });
    else if (face !== 'top') for (let x = 0; x < r[2]; x += 2) at(sk, r, x, r[3] - 1, 0xd8d0c0);
  });
  each(sk, 'elephant', ['tail'], (face, r) => { if (face !== 'top') sk.fill([r[0], r[1] + r[3] - 2, r[2], 2], [0x1a1816, 0x24201e], { cell: 1 }); });
  // (The trunk's tip, open underneath.)
  const T = reg(cubesOf('elephant', 'trunk3')[0]);
  sk.fill(T.bottom, [0x3a3634, 0x4a4644], { cell: 1 });
});
// A saddled elephant's blanket (red, edged with gold, hanging down its sides) and the seat on top.
skin('elephant_saddle', (sk) => {
  const [blanket, seat] = cubesOf('elephant', 'saddle');
  const R = reg(blanket), RED = [0x8a1c1c, 0xa22424, 0xb42e2a], GOLD = [0xc89a28, 0xe0b438];
  for (const face of ['front', 'back', 'bottom']) clear(sk, R[face]);
  sk.fill(R.top, RED, { cell: 1 });
  for (let x = 0; x < R.top[2]; x++) { at(sk, R.top, x, 0, GOLD[0]); at(sk, R.top, x, R.top[3] - 1, GOLD[0]); }
  for (const side of SIDES) {
    const r = R[side];
    sk.fill(r, RED, { cell: 1 });
    for (let x = 0; x < r[2]; x++) {
      at(sk, r, x, r[3] - 2, GOLD[(x & 1)]);
      at(sk, r, x, r[3] - 1, x % 3 === 1 ? GOLD[1] : 0);
      if (x % 3 !== 1) sk.set(r[0] + x, r[1] + r[3] - 1, 0, 0);
      if (x === 0 || x === r[2] - 1) for (let y = 0; y < r[3] - 1; y++) at(sk, r, x, y, GOLD[0]);
    }
  }
  sk.box(seat, (face, r) => sk.fill(r, face === 'top' ? [0x5a3218, 0x6e4122, 0x7a4a28] : [0x3a2010, 0x4a2a16], { cell: 1 }));
});

// ---------------------------------------------------------------- hippos
const HIPPO = ramp(0x7a6a72, 5, 0.1, 8), HIPPO_PINK = ramp(0xc8989a, 3, 0.06, 4);
skin('hippo', (sk) => {
  fur(sk, 'hippo', ['body', 'head', 'jaw', 'earR', 'legFR'], HIPPO, { cell: 2, grain: 0.3 });
  belly(sk, cubesOf('hippo', 'body')[0], HIPPO_PINK, 0.2);
  const [head, muzzle, eyeR, eyeL, noseR, noseL] = cubesOf('hippo', 'head');
  // Pink round the mouth, and inside it (the jaw's top, the muzzle's underside); two tusks.
  const M = reg(muzzle);
  sk.fill(M.bottom, [0xb0707a, 0xbc7c84], { cell: 1 });
  for (const side of [...SIDES, 'front']) sk.fill([M[side][0], M[side][1] + M[side][3] - 2, M[side][2], 2], HIPPO_PINK, { cell: 1 });
  const J = reg(cubesOf('hippo', 'jaw')[0]);
  sk.fill(J.top, [0xa4606c, 0xb06a76, 0xbc7480], { cell: 1 });
  sk.fill(J.bottom, HIPPO_PINK, { cell: 1 });
  for (const x of [1, J.top[2] - 2]) { at(sk, J.top, x, J.top[3] - 1, 0xf0ecdc); at(sk, J.top, x, J.top[3] - 2, 0xe8e2d0); }
  for (const cube of [eyeR, eyeL]) sk.box(cube, (face, r) => { sk.fill(r, HIPPO.slice(1, 4), { cell: 1 }); if (face === 'front') at(sk, r, 0, 0, 0x121010); });
  for (const cube of [noseR, noseL]) sk.box(cube, (face, r) => { sk.fill(r, HIPPO.slice(0, 3), { cell: 1 }); if (face === 'top') at(sk, r, 0, 0, 0x201818); });
  each(sk, 'hippo', ['earR'], (face, r) => { if (face === 'front') sk.fill(r, HIPPO_PINK, { cell: 1 }); });
  void head;
  feet(sk, 'hippo', ['legFR'], 1, [0x4e4248, 0x584c52]);
});

// ---------------------------------------------------------------- giraffes
// A giraffe's coat: chestnut patches parted by a network of cream lines (a Voronoi pattern of
// jittered cells), plain cream low on the legs.
function patches(sk, r, cell, lines, spots) {
  const pts = [];
  for (let gy = -1; gy <= Math.ceil(r[3] / cell) + 1; gy++) for (let gx = -1; gx <= Math.ceil(r[2] / cell) + 1; gx++) {
    pts.push([(gx + 0.2 + sk.r() * 0.6) * cell, (gy + 0.2 + sk.r() * 0.6) * cell, spots[sk.ri(spots.length)]]);
  }
  for (let y = 0; y < r[3]; y++) for (let x = 0; x < r[2]; x++) {
    let d1 = 1e9, d2 = 1e9, c = spots[0];
    for (const [px, py, pc] of pts) {
      const d = Math.hypot(px - x - 0.5, py - y - 0.5);
      if (d < d1) { d2 = d1; d1 = d; c = pc; } else if (d < d2) d2 = d;
    }
    at(sk, r, x, y, d2 - d1 < 0.9 ? lines[(x + y) % lines.length] : c);
  }
}
const GIRAFFE_LINE = [0xe8d8b0, 0xefe2c0], GIRAFFE_SPOT = [0x9c5a28, 0xa8642e, 0xb06c34];
skin('giraffe', (sk) => {
  each(sk, 'giraffe', ['body', 'neck', 'head', 'legFR', 'tail'], (face, r) => patches(sk, r, 3.2, GIRAFFE_LINE, GIRAFFE_SPOT));
  // Pale undersides, and lower legs.
  each(sk, 'giraffe', ['body'], (face, r) => { if (face === 'bottom') sk.fill(r, GIRAFFE_LINE, { cell: 1 }); });
  each(sk, 'giraffe', ['legFR'], (face, r) => { if (face !== 'top') sk.fill([r[0], r[1] + Math.floor(r[3] * 0.55), r[2], Math.ceil(r[3] * 0.45)], GIRAFFE_LINE, { cell: 1 }); });
  feet(sk, 'giraffe', ['legFR'], 1, [0x3a2a20, 0x4a382c]);
  // The mane, the ossicones' dark tips, the face.
  const [, mane] = cubesOf('giraffe', 'neck');
  sk.box(mane, (face, r) => sk.fill(r, [0x6a3a1c, 0x7a4622, 0x8a522a], { cell: 1 }));
  fur(sk, 'giraffe', ['hornR'], [0xc8a878, 0xd4b484], { cell: 1 });
  each(sk, 'giraffe', ['hornR'], (face, r) => { if (face !== 'bottom') at(sk, r, 0, 0, 0x2a1e16); });
  fur(sk, 'giraffe', ['earR'], [0xd8c8a0, 0xe4d4ac], { cell: 1 });
  const [head, muzzle] = cubesOf('giraffe', 'head');
  eyes(sk, head, 2, 1, 0x100c0a);
  sk.box(muzzle, (face, r) => sk.fill(r, [0xd0b890, 0xdcc49c], { cell: 1 }));
  at(sk, reg(muzzle).front, 0, 1, 0x3a2a20); at(sk, reg(muzzle).front, 2, 1, 0x3a2a20);
  each(sk, 'giraffe', ['tail'], (face, r) => { if (face !== 'top') sk.fill([r[0], r[1] + r[3] - 3, r[2], 3], [0x2a1e16, 0x3a2a1e], { cell: 1 }); });
});

// ---------------------------------------------------------------- crocodiles
// Dark olive scales, knobbly scutes in rows along the back and tail, a pale yellow belly, yellow
// eyes, and a row of teeth along each jaw.
const CROC = ramp(0x4e5a2c, 5, 0.12, 8), CROC_BELLY = ramp(0xc8c08a, 3, 0.05, 4);
skin('crocodile', (sk) => {
  const parts = ['body', 'head', 'jaw', 'tail1', 'tail2', 'tail3', 'legFR', 'legBR'];
  fur(sk, 'crocodile', parts, CROC, { cell: 1, grain: 0.4 });
  each(sk, 'crocodile', parts, (face, r) => {
    if (face === 'bottom') sk.fill(r, CROC_BELLY, { cell: 1 });
    if (face === 'top') for (let y = 0; y < r[3]; y += 2) for (let x = 1; x < r[2] - 1; x += 2) at(sk, r, x, y, CROC[0]);
  });
  const [skull, snout, eyeR, eyeL] = cubesOf('crocodile', 'head');
  for (const cube of [eyeR, eyeL]) sk.box(cube, (face, r) => { sk.fill(r, CROC.slice(1, 4), { cell: 1 }); if (face === 'front' || face === 'right' || face === 'left') at(sk, r, 0, 0, 0xd8c030); });
  // Teeth: white along the lower edge of the snout's sides and the upper edge of the jaw's.
  const S = reg(snout), J = reg(cubesOf('crocodile', 'jaw')[0]);
  for (const side of SIDES) {
    for (let x = 0; x < S[side][2]; x += 2) at(sk, S[side], x, S[side][3] - 1, 0xf0ece0);
    for (let x = 1; x < J[side][2]; x += 2) at(sk, J[side], x, 0, 0xf0ece0);
  }
  sk.fill(S.bottom, [0xb86a6a, 0xc47676], { cell: 1 });
  sk.fill(J.top, [0xb86a6a, 0xc47676], { cell: 1 });
  at(sk, S.front, 1, 0, 0x1a1c10); at(sk, S.front, 2, 0, 0x1a1c10);
  void skull;
});

// ---------------------------------------------------------------- camels
const CAMEL = ramp(0xc8a064, 5, 0.1, 8);
skin('camel', (sk) => {
  fur(sk, 'camel', ['body', 'neck', 'head', 'earR', 'legFR'], CAMEL, { cell: 2, grain: 0.3 });
  const [, hump, tail] = cubesOf('camel', 'body');
  sk.box(hump, (face, r) => { if (face === 'top') sk.fill(r, CAMEL.slice(0, 3), { cell: 2 }); });
  sk.box(tail, (face, r) => sk.fill(r, CAMEL.slice(0, 3), { cell: 1 }));
  // Darker knees and wide pale feet.
  each(sk, 'camel', ['legFR'], (face, r) => { if (face !== 'top' && face !== 'bottom') sk.fill([r[0], r[1] + Math.floor(r[3] * 0.5), r[2], 2], CAMEL.slice(0, 2), { cell: 1 }); });
  feet(sk, 'camel', ['legFR'], 2, [0x6a5238, 0x7a6044]);
  const [head, lips] = cubesOf('camel', 'head');
  eyes(sk, head, 3, 1, 0x100c0a);
  sk.box(lips, (face, r) => sk.fill(r, [0xa88250, 0xb48c5a], { cell: 1 }));
  const L = reg(lips).front;
  at(sk, L, 0, 1, 0x3a2a1a); at(sk, L, 3, 1, 0x3a2a1a); row(sk, L, L[3] - 2, 0x5a4028);
});
// A saddled camel's woven blanket (in bands of red, orange and blue) and its seat.
skin('camel_saddle', (sk) => {
  const [blanket, seat] = cubesOf('camel', 'saddle');
  const R = reg(blanket), BANDS = [0x9a2020, 0xd0701c, 0x2a4a8a, 0xd0701c];
  for (const face of ['front', 'back', 'bottom']) clear(sk, R[face]);
  for (const face of ['top', ...SIDES]) {
    const r = R[face];
    for (let y = 0; y < r[3]; y++) for (let x = 0; x < r[2]; x++) at(sk, r, x, y, mix(BANDS[Math.floor(((face === 'top' ? y : x) / 2)) % BANDS.length], 0x000000, (x + y) % 3 === 0 ? 0.12 : 0));
    if (face !== 'top') for (let x = 0; x < r[2]; x++) if (x % 2) sk.set(r[0] + x, r[1] + r[3] - 1, 0, 0);
  }
  sk.box(seat, (face, r) => sk.fill(r, face === 'top' ? [0x5a3218, 0x6e4122, 0x7a4a28] : [0x3a2010, 0x4a2a16], { cell: 1 }));
});

// ---------------------------------------------------------------- penguins
// Emperor penguins: blue-black backs, white fronts, a golden patch behind each eye running down
// to the chest, a black beak with an orange stripe.
const PENGUIN_BACK = [0x161a22, 0x1e222c, 0x262a36], PENGUIN_WHITE = ramp(0xf0f0ea, 3, 0.04, 4), GOLD = [0xe8a828, 0xf0b838];
skin('penguin', (sk) => {
  fur(sk, 'penguin', ['body', 'head', 'finR', 'footR'], PENGUIN_BACK, { cell: 1, grain: 0.3 });
  const [body] = cubesOf('penguin', 'body');
  const B = reg(body);
  sk.fill(B.front, PENGUIN_WHITE, { cell: 1 });
  for (let x = 0; x < B.front[2]; x++) at(sk, B.front, x, 0, GOLD[x & 1]);
  for (const side of SIDES) for (let y = 1; y < B[side][3]; y++) at(sk, B[side], fore(B[side], side, 0), y, PENGUIN_WHITE[1]);
  const [head, beak] = cubesOf('penguin', 'head');
  const H = reg(head);
  for (const side of SIDES) {
    const r = H[side];
    at(sk, r, fore(r, side, 1), 2, 0x080808);
    for (let y = 3; y < r[3]; y++) at(sk, r, fore(r, side, 2), y, GOLD[y & 1]);
    at(sk, r, fore(r, side, 3), 4, GOLD[0]);
  }
  sk.box(beak, (face, r) => sk.fill(r, [0x141414, 0x1c1c1c], { cell: 1 }));
  for (const side of SIDES) row(sk, reg(beak)[side], 0, 0xe07028);
  each(sk, 'penguin', ['finR'], (face, r) => { if (face === 'left') sk.fill(r, PENGUIN_WHITE, { cell: 1 }); });
  fur(sk, 'penguin', ['footR'], [0x1a1a1a, 0x242424], { cell: 1 });
});

// ---------------------------------------------------------------- butterflies
// Each wing's top and underside: the wing's colour, darker veins and edges, and its spots.
function butterfly(name, base, edge, spot, pattern = 'monarch') {
  skin(`butterfly_${name}`, (sk) => {
    fur(sk, 'butterfly', ['body'], [0x1a1614, 0x241e1a], { cell: 1 });
    each(sk, 'butterfly', ['wingR'], (face, r) => {
      if (face !== 'top' && face !== 'bottom') return;
      const [w, h] = [r[2], r[3]];
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        // (Rounded off at the far corners.)
        const far = x === w - 1 && (y === 0 || y === h - 1);
        if (far) { sk.set(r[0] + x, r[1] + y, 0, 0); continue; }
        const rim = x === w - 1 || y === 0 || y === h - 1 || (x === w - 2 && (y === 0 || y === h - 1));
        let col = rim ? edge : base;
        if (pattern === 'monarch' && !rim && (x + y) % 3 === 0) col = edge;
        if (pattern === 'tips' && x >= w - 2 && y < 2) col = edge;
        if (rim && spot !== null && (x + y) % 2 === 0) col = spot;
        at(sk, r, x, y, col);
      }
      if (pattern === 'tips' && spot !== null) at(sk, r, 2, 3, spot);
    });
  });
}
butterfly('monarch', 0xe8801a, 0x1a1210, 0xf0ece0, 'monarch');
butterfly('morpho', 0x3a7ae0, 0x10182a, null, 'plain');
butterfly('cabbage', 0xf0f0e6, 0x2a2622, 0x2a2622, 'tips');
butterfly('brimstone', 0xf0e050, 0xc8b030, 0xe07020, 'plain');
butterfly('pink', 0xe890b0, 0x8a3a5a, 0xf8e8f0, 'plain');

// ---------------------------------------------------------------- birds (on the parrot's model)
// `b`: body, belly (its front and underside), head, wing, tail, beak and legs colours; crest (or
// none: the crest isn't drawn), a mask round the eyes, wing bars.
function bird(name, b) {
  skin(name, (sk) => {
    fur(sk, 'parrot', ['body', 'head', 'tail'], ramp(b.body, 4, 0.08, 6), { cell: 1, grain: 0.3 });
    const [bodyC] = cubesOf('parrot', 'body');
    const B = reg(bodyC);
    if (b.belly) { sk.fill(B.front, ramp(b.belly, 3, 0.06, 4), { cell: 1 }); sk.fill(B.bottom, ramp(b.belly, 3, 0.06, 4), { cell: 1 }); }
    if (b.streaks) for (const face of ['front', ...SIDES]) for (let k = 0; k < 5; k++) at(sk, B[face], sk.ri(B[face][2]), sk.ri(B[face][3]), b.streaks);
    const [head, beak, crest] = cubesOf('parrot', 'head');
    sk.box(head, (face, r) => sk.fill(r, ramp(b.head ?? b.body, 3, 0.06, 4), { cell: 1 }));
    sk.box(beak, (face, r) => sk.fill(r, ramp(b.beak, 3, 0.06, 4), { cell: 1 }));
    if (b.crest) sk.box(crest, (face, r) => sk.fill(r, ramp(b.crest, 3, 0.06, 4), { cell: 1 }));
    else sk.box(crest, (face, r) => clear(sk, r));
    const H = reg(head);
    for (const side of SIDES) {
      const r = H[side];
      if (b.mask) { at(sk, r, fore(r, side, 0), 1, b.mask); at(sk, r, fore(r, side, 0), 2, b.mask); at(sk, r, fore(r, side, 1), 2, b.mask); }
      at(sk, r, fore(r, side, 1), 1, b.eye ?? 0x0c0c0c);
    }
    if (b.mask) at(sk, H.front, 1, 2, b.mask);
    each(sk, 'parrot', ['wingR'], (face, r) => {
      sk.fill(r, ramp(b.wing, 3, 0.08, 6), { cell: 1 });
      if (b.bars && face !== 'top' && face !== 'bottom') for (let x = 0; x < r[2]; x++) at(sk, r, x, 2, b.bars);
      if (b.tips && face !== 'top') for (let x = 0; x < r[2]; x++) at(sk, r, x, r[3] - 1, b.tips);
    });
    for (const cube of cubesOf('parrot', 'tail')) sk.box(cube, (face, r) => { sk.fill(r, ramp(b.tail ?? b.wing, 3, 0.06, 4), { cell: 1 }); if (b.tips) row(sk, r, r[3] - 1, b.tips); });
    each(sk, 'parrot', ['legR'], (face, r) => sk.fill(r, ramp(b.legs, 2, 0.06, 4), { cell: 1 }));
  });
}
bird('bird_robin', { body: 0x6a5a4a, belly: 0xd06a2a, head: 0x3e3834, wing: 0x5a4c40, beak: 0xd8b030, legs: 0x6a5040 });
bird('bird_bluejay', { body: 0x4a7ad0, belly: 0xe8eaec, head: 0x4a7ad0, wing: 0x3a66c0, crest: 0x4a7ad0, beak: 0x1a1a1a, legs: 0x2a2a2a, bars: 0x101820, mask: 0x101418 });
bird('bird_cardinal', { body: 0xc82020, head: 0xd02424, wing: 0xa81a1a, crest: 0xd02424, beak: 0xe06030, legs: 0x8a5a4a, mask: 0x101010 });
bird('bird_sparrow', { body: 0x8a6a4a, belly: 0xc8bca8, head: 0x7a746c, wing: 0x6e5238, beak: 0x2a2420, legs: 0x9a7a60, streaks: 0x5a4230, bars: 0xe0d8c8 });
bird('bird_goldfinch', { body: 0xf0d020, head: 0xf0d020, wing: 0x1a1a1a, tail: 0x1a1a1a, beak: 0xe8a080, legs: 0x9a7a6a, bars: 0xf0f0e8, mask: 0x141414 });
bird('crow', { body: 0x16161e, head: 0x1a1a22, wing: 0x14141c, beak: 0x101012, legs: 0x141416, eye: 0x2a2a30 });
bird('seagull', { body: 0xf0f0ec, belly: 0xf8f8f4, head: 0xf8f8f4, wing: 0x9aa4ac, tail: 0xe8e8e4, beak: 0xe8c030, legs: 0xd8a070, tips: 0x141414, eye: 0xd8c060 });
bird('eagle', { body: 0x4a3222, head: 0xf0eee6, wing: 0x3e2a1c, tail: 0xf0eee6, beak: 0xf0c028, legs: 0xe8b830, eye: 0xd8c040 });
bird('vulture', { body: 0x2a2420, head: 0xc86a5a, wing: 0x221e1a, beak: 0xd8d0c0, legs: 0x8a8480 });

// ---------------------------------------------------------------- the pack's, drawn
// (Fallbacks for the skins the texture pack provides.)
// Pandas: white with black legs, shoulders, ears and eye patches (one of each of Minecraft's
// temperaments; the brown panda brown and white).
function pandaSkin(dark, light = 0xf0eee8) {
  return (sk) => {
    const W = ramp(light, 3, 0.05, 4), D = ramp(dark, 3, 0.06, 4);
    fur(sk, 'panda', ['body', 'head'], W, { cell: 2, grain: 0.3 });
    fur(sk, 'panda', ['legFR', 'legFL', 'legBR', 'legBL'], D, { cell: 2, grain: 0.3 });
    const [head, nose, earR, earL] = cubesOf('panda', 'head');
    for (const e of [earR, earL]) sk.box(e, (face, r) => sk.fill(r, D, { cell: 1 }));
    const f = reg(head).front;
    for (const [x, y] of [[2, 3], [3, 3], [2, 4], [3, 5], [9, 3], [10, 3], [10, 4], [9, 5]]) at(sk, f, x, y, D[0]);
    at(sk, f, 3, 4, 0x080808); at(sk, f, 9, 4, 0x080808);
    sk.box(nose, (face, r) => sk.fill(r, W, { cell: 1 }));
    at(sk, reg(nose).front, 3, 1, 0x141414);
    // (A dark band over the shoulders, round the body's front end.)
    const Bd = reg(cubesOf('panda', 'body')[0]);
    sk.fill([Bd.top[0], Bd.top[1], Bd.top[2], 4], D, { cell: 1 });
  };
}
for (const t of ['', '_lazy', '_worried', '_playful', '_weak', '_aggressive']) skin(`panda${t}`, pandaSkin(0x1c1c20));
skin('panda_brown', pandaSkin(0x5a3a24, 0xd8c8b0));
// Bees: yellow and black bands, clear wings.
function beeSkin(eyeC) {
  return (sk) => {
    const [body, stinger, antR, antL] = cubesOf('bee', 'body');
    sk.box(body, (face, r) => {
      sk.fill(r, [0xe8b828, 0xf0c434, 0xf4cc44], { cell: 1 });
      if (face === 'top' || face === 'bottom' || face === 'right' || face === 'left') {
        const along = face === 'top' || face === 'bottom';
        for (let k = 0; k < 10; k++) if (k % 4 === 1) for (let t = 0; t < (along ? r[2] : r[3]); t++) along ? at(sk, r, t, k, 0x2a1e10) : at(sk, r, face === 'right' ? r[2] - 1 - k : k, t, 0x2a1e10);
      }
      if (face === 'front') { at(sk, r, 1, 2, eyeC); at(sk, r, 5, 2, eyeC); at(sk, r, 1, 3, eyeC); at(sk, r, 5, 3, eyeC); }
    });
    for (const cb of [stinger, antR, antL]) sk.box(cb, (face, r) => sk.fill(r, [0x1a1410, 0x2a2018], { cell: 1 }));
    each(sk, 'bee', ['wingR'], (face, r) => { for (let y = 0; y < r[3]; y++) for (let x = 0; x < r[2]; x++) sk.set(r[0] + x, r[1] + y, 0xd8ecf4, (x + y) % 3 ? 150 : 200); });
    each(sk, 'bee', ['legs'], (face, r) => sk.fill(r, [0x1a1410, 0x2a2018], { cell: 1 }));
  };
}
skin('bee', beeSkin(0x141414));
skin('bee_angry', beeSkin(0x8a1010));
// Zebras (on the horse's model): white with black stripes, a black and white mane.
skin('zebra', (sk) => {
  horseSkin(sk, 'horse', 0xecebe6, 0x1a1a1a);
  each(sk, 'horse', ['body'], (face, r) => { if (face !== 'bottom') stripes(sk, r, 3, 0x161616, face !== 'top', 1); });
  each(sk, 'horse', ['legFR'], (face, r) => { if (face !== 'top' && face !== 'bottom') stripes(sk, [r[0], r[1], r[2], r[3] - 2], 2, 0x161616, false, 0); });
  const [neck] = cubesOf('horse', 'head');
  sk.box(neck, (face, r) => { if (face !== 'top' && face !== 'bottom') stripes(sk, r, 3, 0x161616, false, 1); });
});
// Wolves of other woods and wilds: the grey wolf's coat recoloured (snowy, woods, black, rusty,
// ashen), and each one's angry face.
export const WOLF_COATS = { snowy: [1.08, 1.08, 1.1], woods: [0.72, 0.56, 0.42], black: [0.3, 0.3, 0.32], rusty: [0.95, 0.62, 0.4], ashen: [0.8, 0.8, 0.84] };
function recoloured(draw, [r, g, b]) {
  return (sk) => {
    draw(sk);
    for (let i = 0; i < sk.d.length; i += 4) {
      if (!sk.d[i + 3]) continue;
      // (Eyes and noses, the darkest and the reddest pixels, stay as they are.)
      const lum = sk.d[i] + sk.d[i + 1] + sk.d[i + 2];
      if (lum < 120 || sk.d[i] > sk.d[i + 1] + 60) continue;
      sk.d[i] = Math.min(255, sk.d[i] * r); sk.d[i + 1] = Math.min(255, sk.d[i + 1] * g); sk.d[i + 2] = Math.min(255, sk.d[i + 2] * b);
    }
  };
}
for (const [name, mul] of Object.entries(WOLF_COATS)) {
  skin(`wolf_${name}`, recoloured((sk) => wolfSkin(sk, false), mul));
  skin(`wolf_${name}_angry`, recoloured((sk) => wolfSkin(sk, true), mul));
}
// Arctic foxes: white with grey ears, legs and eyes.
skin('fox_snow', (sk) => foxSkin(sk, ramp(0xeceae4, 5, 0.06, 4), ramp(0xf8f8f4, 3, 0.03, 2), [0x5a5a5e, 0x68686c, 0x76767a]));

// (Kept for tools that list them: the helpers' names.)
void tone; void allBut;
