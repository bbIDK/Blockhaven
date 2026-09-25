// Village people's clothes: every trade has its own dress (a smith's leather apron, a guard's
// mail and tabard, a baker's cap...), painted over the shared person (mobskins.js) in three
// looks each, so a village is full of different faces.
import { skin } from '../skins.js';
import { person, HR, TONES, HAIRS, HUMAN_SIDES } from './mobskins.js';
import { ramp } from './core.js';

const at = (sk, r, x, y, c) => sk.set(r[0] + x, r[1] + y, c);
const rowOf = (sk, r, y, c) => { for (let x = 0; x < r[2]; x++) sk.set(r[0] + x, r[1] + y, c); };
const SIDES = HUMAN_SIDES;
const BOOTS = [0x3a2818, 0x46301e, 0x523a24];
const LEATHER = ramp(0x7a5230, 4, 0.1, 8);
const IRON = [0x6e6e72, 0x8a8a8e, 0xa4a4a8, 0xbcbcc0];
const DARK = [0x2a2a2e, 0x323236, 0x3a3a40];

// A hat on the head's second layer: the crown on top and the upper `rows` of every side.
function hat(sk, pal, rows, { front = rows, o = { cell: 1, grain: 0.3 } } = {}) {
  sk.fill(HR.hat.top, pal, o);
  for (const side of ['right', 'left', 'back']) sk.fill([HR.hat[side][0], HR.hat[side][1], 8, rows], pal, o);
  if (front) sk.fill([HR.hat.front[0], HR.hat.front[1], 8, front], pal, o);
}
// An apron over the front of the body (rows y0..y1), with ties round the sides.
function apron(sk, pal, y0 = 3, y1 = 12, legs = 0) {
  const f = HR.jacket.front;
  sk.fill([f[0], f[1] + y0, 8, y1 - y0], pal, { cell: 1, grain: 0.25 });
  for (const side of ['right', 'left']) rowOf(sk, HR.jacket[side], y0 + 3, pal[0]);
  rowOf(sk, HR.jacket.back, y0 + 3, pal[0]);
  // The strap round the neck.
  at(sk, f, 1, 0, pal[1]); at(sk, f, 6, 0, pal[1]); at(sk, f, 1, 1, pal[1]); at(sk, f, 6, 1, pal[1]); at(sk, f, 1, 2, pal[1]); at(sk, f, 6, 2, pal[1]);
  if (legs) for (const R of [HR.rPants, HR.lPants]) sk.fill([R.front[0], R.front[1], 4, legs], pal, { cell: 1, grain: 0.25 });
}
// A long coat or robe: the body's second layer all round, and the trousers' down to `legRows`.
function coat(sk, pal, legRows = 0, { open = false } = {}) {
  for (const face of [...SIDES, 'top']) sk.fill(HR.jacket[face], pal, { cell: 1, grain: 0.3 });
  if (open) for (let y = 2; y < 12; y++) { sk.set(HR.jacket.front[0] + 3, HR.jacket.front[1] + y, 0, 0); sk.set(HR.jacket.front[0] + 4, HR.jacket.front[1] + y, 0, 0); }
  for (const R of [HR.rSleeve, HR.lSleeve]) { for (const face of [...SIDES, 'top']) sk.fill([R[face][0], R[face][1], R[face][2], face === 'top' ? R[face][3] : 10], pal, { cell: 1 }); }
  if (legRows) for (const R of [HR.rPants, HR.lPants]) for (const face of SIDES) sk.fill([R[face][0], R[face][1], R[face][2], legRows], pal, { cell: 1, grain: 0.3 });
}
const belt = (sk, c, buckle = 0xc8a040) => { for (const face of SIDES) rowOf(sk, HR.body[face], 8, c); at(sk, HR.body.front, 3, 8, buckle); at(sk, HR.body.front, 4, 8, buckle); };

// The looks for each trade: [tone, hair, style, beard] per look, then the clothes.
const LOOKS = {
  merchant: {
    people: [[0, 0, 'short', true], [1, 3, 'long', false], [3, 1, 'cropped', false]],
    dress(sk) {
      const COAT = ramp(0x6a2c7a, 4, 0.1, 8), TRIM = [0xc89a30, 0xe0b848];
      coat(sk, COAT, 4, { open: true });
      for (const face of SIDES) rowOf(sk, HR.jacket[face], 11, TRIM[0]);
      for (let y = 2; y < 11; y++) { at(sk, HR.jacket.front, 2, y, TRIM[1]); at(sk, HR.jacket.front, 5, y, TRIM[1]); }
      // A soft cap with a feather.
      hat(sk, ramp(0x2a2a5a, 3, 0.08, 6), 2);
      at(sk, HR.hat.right, 5, 0, 0xe8e0d0); at(sk, HR.hat.right, 6, 0, 0xe8e0d0); at(sk, HR.hat.top, 1, 5, 0xf0e8d8);
    },
    shirt: 0xe0d8c0, pants: 0x3a3040,
  },
  guard: {
    people: [[0, 0, 'cropped', true], [2, 1, 'cropped', false], [4, 2, 'short', false]],
    dress(sk) {
      // Chain mail, a blue tabard with a gold cross, an iron helmet with a nose guard.
      coat(sk, IRON, 0);
      for (const face of SIDES) { const r = HR.jacket[face]; for (let y = 0; y < r[3]; y++) for (let x = 0; x < r[2]; x++) if ((x + y) % 2) at(sk, r, x, y, 0x5a5a5e); }
      const TAB = ramp(0x2a4aa0, 3, 0.1, 6);
      for (const face of ['front', 'back']) {
        const r = HR.jacket[face];
        sk.fill([r[0] + 1, r[1] + 1, 6, 11], TAB, { cell: 1 });
        for (let y = 2; y < 11; y++) at(sk, r, 3, y, 0xd8b040);
        for (let x = 1; x < 7; x++) at(sk, r, x, 5, 0xd8b040);
      }
      hat(sk, IRON, 3);
      for (let y = 3; y < 5; y++) at(sk, HR.hat.front, 3, y, IRON[2]), at(sk, HR.hat.front, 4, y, IRON[1]);
      rowOf(sk, HR.hat.front, 2, IRON[0]);
      for (const R of [HR.rPants, HR.lPants]) for (const face of SIDES) sk.fill([R[face][0], R[face][1] + 7, R[face][2], 5], BOOTS, { cell: 1 });
    },
    shirt: 0x5a5a60, pants: 0x3a3a44,
  },
  blacksmith: {
    people: [[3, 1, 'bald', true], [0, 4, 'cropped', true], [2, 0, 'short', false]],
    dress(sk) {
      apron(sk, LEATHER, 2, 12, 6);
      // Heavy gloves and soot.
      for (const R of [HR.rSleeve, HR.lSleeve]) for (const face of SIDES) sk.fill([R[face][0], R[face][1] + 8, R[face][2], 4], DARK, { cell: 1 });
      for (let k = 0; k < 4; k++) at(sk, HR.head.front, 1 + Math.floor(sk.r() * 6), 5 + Math.floor(sk.r() * 3), 0x4a3a30);
    },
    shirt: 0x3a3a40, pants: 0x3a3028, sleeves: 'short',
  },
  butcher: {
    people: [[1, 0, 'short', true], [0, 2, 'cropped', false], [4, 5, 'bald', true]],
    dress(sk) {
      const WHITE = [0xd8d8d4, 0xe4e4e0, 0xf0f0ec];
      apron(sk, WHITE, 1, 12, 7);
      for (let k = 0; k < 6; k++) at(sk, HR.jacket.front, 1 + Math.floor(sk.r() * 6), 3 + Math.floor(sk.r() * 8), 0xa02020);
      hat(sk, WHITE, 2, { front: 1 });
    },
    shirt: 0xb84a3a, pants: 0x3a3a44,
  },
  hunter: {
    people: [[0, 2, 'short', true], [1, 4, 'long', false], [3, 1, 'cropped', false]],
    dress(sk) {
      const GREEN = ramp(0x3a5a2a, 4, 0.1, 8);
      // A hood, a leather jerkin and a quiver strap.
      hat(sk, GREEN, 5, { front: 1 });
      for (const side of ['right', 'left']) for (let y = 5; y < 8; y++) for (let x = 0; x < 8; x++) if ((side === 'right' ? x < 3 : x > 4)) at(sk, HR.hat[side], x, y, GREEN[1]);
      sk.fill([HR.hat.back[0], HR.hat.back[1] + 5, 8, 3], GREEN, { cell: 1 });
      coat(sk, LEATHER, 3);
      for (let y = 0; y < 12; y++) at(sk, HR.jacket.front, Math.floor(y * 7 / 11), y, 0x4a3020);
      belt(sk, 0x2a1a10);
    },
    shirt: 0x4a6a3a, pants: 0x4a3a2a,
  },
  librarian: {
    people: [[1, 5, 'short', true], [0, 0, 'long', false], [2, 1, 'cropped', false]],
    dress(sk) {
      const ROBE = ramp(0x7a2230, 4, 0.1, 8);
      coat(sk, ROBE, 11);
      for (const face of SIDES) rowOf(sk, HR.jacket[face], 0, 0xc8a040);
      // Spectacles.
      const f = HR.hat.front;
      for (const x of [1, 2, 5, 6]) at(sk, f, x, 4, 0x3a2a1a);
      at(sk, f, 3, 4, 0x3a2a1a); at(sk, f, 4, 4, 0x3a2a1a);
      sk.set(f[0] + 1, f[1] + 4, 0x6a5a4a, 255); sk.set(f[0] + 6, f[1] + 4, 0x6a5a4a, 255);
    },
    shirt: 0xd8d0b8, pants: 0x3a2a2a,
  },
  innkeeper: {
    people: [[4, 4, 'short', true], [1, 3, 'long', false], [0, 1, 'short', false]],
    dress(sk) {
      const VEST = ramp(0x6a3a1e, 4, 0.1, 8);
      for (const face of SIDES) sk.fill([HR.jacket[face][0], HR.jacket[face][1], HR.jacket[face][2], 8], VEST, { cell: 1 });
      for (let y = 1; y < 8; y++) { sk.set(HR.jacket.front[0] + 3, HR.jacket.front[1] + y, 0, 0); sk.set(HR.jacket.front[0] + 4, HR.jacket.front[1] + y, 0, 0); }
      apron(sk, [0xc8c4b8, 0xd8d4c8, 0xe4e0d4], 7, 12, 5);
    },
    shirt: 0xe0dcd0, pants: 0x3a3a3a, sleeves: 'short',
  },
  baker: {
    people: [[1, 3, 'short', false], [0, 0, 'cropped', true], [2, 4, 'long', false]],
    dress(sk) {
      const WHITE = [0xe0e0dc, 0xecece8, 0xf6f6f2];
      // The tall white cap.
      hat(sk, WHITE, 3, { front: 2 });
      apron(sk, WHITE, 1, 12, 6);
      for (let k = 0; k < 8; k++) at(sk, HR.jacket.front, Math.floor(sk.r() * 8), 2 + Math.floor(sk.r() * 10), 0xfafaf6);
    },
    shirt: 0xc89a6a, pants: 0x4a4a52, sleeves: 'short',
  },
  farmer: {
    people: [[0, 2, 'short', false], [1, 3, 'long', false], [3, 0, 'cropped', true]],
    dress(sk) {
      const STRAW = ramp(0xd8b858, 4, 0.1, 8), DENIM = ramp(0x3a5a9a, 4, 0.1, 8);
      hat(sk, STRAW, 2);
      for (const side of [...SIDES]) rowOf(sk, HR.hat[side], 2, STRAW[0]);
      for (let x = 0; x < 8; x += 2) at(sk, HR.hat.top, x, (x * 3) & 7, STRAW[3]);
      // Dungarees: a bib over the chest and straps.
      const f = HR.jacket.front;
      sk.fill([f[0] + 1, f[1] + 4, 6, 8], DENIM, { cell: 1 });
      for (let y = 0; y < 4; y++) { at(sk, f, 1, y, DENIM[1]); at(sk, f, 6, y, DENIM[1]); at(sk, HR.jacket.back, 1, y, DENIM[1]); at(sk, HR.jacket.back, 6, y, DENIM[1]); }
      for (const face of ['right', 'left', 'back']) sk.fill([HR.jacket[face][0], HR.jacket[face][1] + 8, HR.jacket[face][2], 4], DENIM, { cell: 1 });
    },
    shirt: 0xb84a3a, pants: 0x3a5a9a,
  },
  shepherd: {
    people: [[4, 1, 'long', true], [0, 3, 'short', false], [2, 0, 'cropped', false]],
    dress(sk) {
      const WOOL = [0xc8c0b0, 0xd4ccbc, 0xe0d8c8];
      coat(sk, WOOL, 3);
      for (const face of SIDES) { const r = HR.jacket[face]; for (let k = 0; k < 6; k++) at(sk, r, Math.floor(sk.r() * r[2]), Math.floor(sk.r() * r[3]), 0xf0e8d8); }
      hat(sk, ramp(0x5a4a3a, 3, 0.08, 6), 2);
      belt(sk, 0x3a2a1a, 0x8a8a8a);
    },
    shirt: 0x8a6a4a, pants: 0x5a4a3a,
  },
  miner: {
    people: [[3, 1, 'cropped', true], [0, 0, 'short', false], [2, 4, 'short', true]],
    dress(sk) {
      // A hard hat with a lamp, dusty clothes, soot on the face.
      hat(sk, [0x8a8060, 0x9a9070, 0xaaa080], 3);
      at(sk, HR.hat.front, 3, 1, 0xfff0a0); at(sk, HR.hat.front, 4, 1, 0xffe070); at(sk, HR.hat.front, 3, 2, 0xe0c060); at(sk, HR.hat.front, 4, 2, 0xe0c060);
      coat(sk, ramp(0x6a5a4a, 4, 0.1, 6), 0);
      belt(sk, 0x2a1a10, 0x9a9a9a);
      for (let k = 0; k < 5; k++) at(sk, HR.head.front, Math.floor(sk.r() * 8), 5 + Math.floor(sk.r() * 3), 0x3a3028);
      for (const R of [HR.rPants, HR.lPants]) for (const face of SIDES) sk.fill([R[face][0], R[face][1] + 8, R[face][2], 4], BOOTS, { cell: 1 });
    },
    shirt: 0x6a6a70, pants: 0x4a4038,
  },
  fisher: {
    people: [[1, 0, 'short', true], [0, 4, 'long', false], [4, 2, 'cropped', false]],
    dress(sk) {
      const OIL = ramp(0xd8b830, 4, 0.1, 8);
      coat(sk, OIL, 5);
      hat(sk, OIL, 2, { front: 1 });
      sk.fill([HR.hat.back[0], HR.hat.back[1] + 2, 8, 2], OIL, { cell: 1 });
      for (const R of [HR.rPants, HR.lPants]) for (const face of SIDES) sk.fill([R[face][0], R[face][1] + 8, R[face][2], 4], [0x2a2a30, 0x34343a], { cell: 1 });
    },
    shirt: 0x3a4a6a, pants: 0x2a3040,
  },
};

export const CIV_LOOKS = {};
for (const [role, L] of Object.entries(LOOKS)) {
  CIV_LOOKS[role] = L.people.map(([tone, hair, style, beard], i) => {
    const name = `civ_${role}_${i}`;
    skin(name, (sk) => {
      person(sk, { tone: TONES[tone], hair: HAIRS[hair], style, beard, eyes: [0x3a2a60, 0x2a5a3a, 0x3a2a1a, 0x2a4a80][(tone + hair + i) % 4],
        shirt: ramp(L.shirt, 4, 0.08, 6), pants: ramp(L.pants, 3, 0.08, 6), shoes: BOOTS, sleeves: L.sleeves ?? 'long' });
      L.dress(sk);
    });
    return name;
  });
}
