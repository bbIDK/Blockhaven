// The wildlife update's creature models, in Minecraft's style (see rigs.js for how a rig is put
// together: bones turning about pivots, carrying boxes; pixels, y up, facing -z, +x the creature's
// right). Their skins are drawn in tex/wildskins.js, or come from the texture pack where the model
// is Minecraft's own (the panda, the bee). Each rig's boxes are laid out in its 64x64 skin by
// `packed` (a box that reuses another's picture says so with `as`), so they never overlap.

const c = (from, size, o = {}) => ({ from, size, ...o });
// Minecraft's own box, cut from its own place in the skin.
const mc = (from, size, uv, o = {}) => ({ from, size, uv, ...o });

// Lays the boxes of `bones` out in the skin: tallest strips first, in rows across the 64 pixels
// (boxes cut from a skin of their own, like a saddle's, in that one).
function packed(bones) {
  const all = Object.values(bones).flatMap((b) => b.cubes);
  const w = (cb) => 2 * (cb.size[0] + cb.size[2]), h = (cb) => cb.size[1] + cb.size[2];
  for (const key of new Set(all.map((cb) => cb.skin ?? null))) {
    const todo = all.filter((cb) => !cb.uv && !cb.as && (cb.skin ?? null) === key);
    todo.sort((a, b) => h(b) - h(a) || w(b) - w(a));
    // (Each goes on the first row with room left for it, or starts a new row below the rest.)
    const rows = [];
    for (const cb of todo) {
      const cw = Math.ceil(w(cb)), ch = Math.ceil(h(cb));
      let row = rows.find((r) => r.x + cw <= 64 && ch <= r.h);
      if (!row) {
        const y = rows.reduce((a, r) => a + r.h, 0);
        if (cw > 64 || y + ch > 64) throw new Error(`No room in the skin for a box ${cb.size}`);
        rows.push(row = { x: 0, y, h: ch });
      }
      cb.uv = [row.x, row.y];
      row.x += cw;
    }
  }
  for (const cb of all) if (cb.as) cb.uv = cb.as.uv;
  return bones;
}
// A pair of limbs: the right one (+x) as given, the left its mirror image sharing its picture.
function pair(name, pivot, from, size, o = {}) {
  const right = c(from, size, o.cube);
  const left = c([-from[0] - size[0], from[1], from[2]], size, { mirror: true, as: right });
  const rest = o.rest, lrest = rest && [rest[0], -rest[1], -rest[2]];
  return {
    [`${name}R`]: { pivot, cubes: [right], ...(rest && { rest }), ...(o.parent && { parent: o.parent }), ...o.bone },
    [`${name}L`]: { pivot: [-pivot[0], pivot[1], pivot[2]], cubes: [left], ...(lrest && { rest: lrest }), ...(o.parent && { parent: o.parent }), ...o.bone },
  };
}
// Four legs: front ones at z `fz`, hind ones at `bz`, `x` out from the middle, `size` each, the
// hip or shoulder at height `top`.
function legs(x, top, fz, bz, size, hind = size) {
  const leg = (px, pz, s) => c([px - s[0] / 2, 0, pz - s[2] / 2], [s[0], top, s[2]]);
  const fr = leg(x, fz, size), br = leg(x, bz, hind);
  // (Hind legs the same as the front ones share their picture.)
  if (hind === size) br.as = fr;
  const mirror = (cb) => c([-cb.from[0] - cb.size[0], 0, cb.from[2]], cb.size, { mirror: true, as: cb });
  return {
    legFR: { pivot: [x, top, fz], cubes: [fr] }, legFL: { pivot: [-x, top, fz], cubes: [mirror(fr)] },
    legBR: { pivot: [x, top, bz], cubes: [br] }, legBL: { pivot: [-x, top, bz], cubes: [mirror(br)] },
  };
}

// ---------------------------------------------------------------- deer and moose
// Deer: a slender body on long thin legs, the neck held up and forward, a narrow face, big ears,
// a white scut of a tail; stags carry antlers (the `male` bones: grown adults only).
const DEER = packed({
  body: { pivot: [0, 14, 0], cubes: [c([-3, 11, -9], [6, 7, 18]), c([-1, 15, 9], [2, 3, 1])] },
  neck: { pivot: [0, 16, -7.5], rest: [-0.6, 0, 0], cubes: [c([-1.5, 15, -10], [3, 9, 3])] },
  head: {
    parent: 'neck', pivot: [0, 23.5, -8.5], rest: [0.65, 0, 0],
    cubes: [c([-2, 22, -12], [4, 4, 5]), c([-1.5, 22, -15], [3, 3, 3])],
  },
  ...pair('ear', [2, 25, -8.5], [2, 24.5, -9], [3, 2, 1], { parent: 'head', rest: [0, 0, -0.35] }),
  ...pair('antler', [1.2, 25.5, -9.5], [0.7, 25.5, -10], [1, 6, 1], {
    parent: 'head', rest: [0.25, 0, -0.3], bone: { male: true },
  }),
  ...pair('tine', [1.2, 28.5, -9.5], [1.2, 28.5, -10], [3, 1, 1], { parent: 'antlerR', rest: [0, 0, 0.5], bone: { male: true } }),
  ...pair('brow', [1.2, 26.5, -9.5], [0.7, 26.5, -13], [1, 1, 3], { parent: 'antlerR', rest: [0.4, 0, 0], bone: { male: true } }),
  ...legs(2, 11, -6.5, 6.5, [2, 0, 2]),
});
// (The tines and brow points of the left antler hang off the left antler, not the right.)
for (const k of ['tineL', 'browL']) DEER[k].parent = 'antlerL';

// Moose: tall at the shoulder with a hump over it, a long heavy head held low with a bell of skin
// under the throat, and (bulls) broad palmate antlers.
const MOOSE = packed({
  body: { pivot: [0, 18, 0], cubes: [c([-4, 14, -9], [8, 9, 18]), c([-3.5, 22, -9], [7, 3, 8]), c([-1, 20, 9], [2, 2, 1])] },
  neck: { pivot: [0, 20, -8], rest: [-0.7, 0, 0], cubes: [c([-2, 18, -11], [4, 7, 4])] },
  head: {
    parent: 'neck', pivot: [0, 24, -10], rest: [1.1, 0, 0],
    cubes: [c([-2.5, 21, -17], [5, 5, 8]), c([-2, 20, -20], [4, 5, 3]), c([-0.5, 17, -14], [1, 4, 2])],
  },
  ...pair('ear', [2.5, 25.5, -11], [2.5, 25, -11.5], [3, 2, 1], { parent: 'head', rest: [0, 0, -0.3] }),
  ...pair('antler', [2.5, 26, -12], [2.5, 25.5, -14], [8, 1, 5], { parent: 'head', rest: [0, 0.15, -0.45], bone: { male: true } }),
  ...pair('points', [9.5, 26.5, -12], [9.5, 26.5, -14], [1, 3, 5], { parent: 'antlerR', rest: [0, 0, 0], bone: { male: true } }),
  ...legs(2.5, 14, -6, 6, [3, 0, 3]),
});
MOOSE.pointsL.parent = 'antlerL';

// ---------------------------------------------------------------- boars
// Wild boar: a pig's build, darker and leaner in the leg, with a bristly crest along the back and
// tusks curling up out of the snout.
const BOAR = packed({
  body: { pivot: [0, 10, 2], cubes: [c([-4.5, 6, -6], [9, 9, 15]), c([-1, 15, -6], [2, 2, 12]), c([-0.5, 11, 9], [1, 4, 1])] },
  head: {
    pivot: [0, 12, -6],
    cubes: [c([-3.5, 7.5, -13], [7, 7, 7]), c([-2, 8, -16], [4, 3, 3]), c([2, 9.5, -15], [1, 3, 1]), c([-3, 9.5, -15], [1, 3, 1], { mirror: true })],
  },
  ...pair('ear', [2.5, 14, -8], [2.5, 13.5, -8.5], [2, 3, 1], { parent: 'head', rest: [0.2, 0, -0.5] }),
  ...legs(2.8, 6, -3.5, 6.5, [3, 0, 3]),
});

// ---------------------------------------------------------------- big cats
// Tigers and lions: a long, low, muscled body, heavy forepaws, a broad head with a short muzzle
// and round ears, and a long tail; a lion's mane (the `male` bones) frames his face.
function bigCat(mane) {
  return packed({
    body: { pivot: [0, 12, 0], cubes: [c([-3.5, 9, -9], [7, 7, 18])] },
    head: {
      pivot: [0, 14, -9],
      cubes: [c([-3.5, 11, -15], [7, 6, 6]), c([-2, 10.5, -17], [4, 3, 2]), c([-1.5, 13.5, -17.5], [3, 1, 1])],
    },
    ...pair('ear', [2.5, 17, -12], [1.5, 17, -12.5], [2, 2, 1], { parent: 'head' }),
    ...(mane ? {
      mane: { pivot: [0, 14, -9], follows: 'head', male: true, cubes: [c([-5, 8.5, -13], [10, 11, 4]), c([-4.5, 8, -9], [9, 9, 4])] },
    } : {}),
    ...legs(2.2, 9, -6.5, 6.5, [3, 0, 3]),
    tail: { pivot: [0, 15, 9], rest: [0.9, 0, 0], cubes: [c([-0.5, 14.5, 9], [1, 1, 14])] },
  });
}

// ---------------------------------------------------------------- elephants
// Elephants: a great barrel of a body on pillar legs, a big head with fan ears (which flap), a
// trunk in three joints reaching down to the ground, tusks (grown adults), a thin tail with a
// tuft, and the blanket and seat that go on when one is saddled.
const ELEPHANT = packed({
  body: { pivot: [0, 16, 0], cubes: [c([-6, 10, -10], [12, 12, 20])] },
  head: { pivot: [0, 20, -10], cubes: [c([-5, 14, -15], [10, 10, 5]), c([-3, 22, -14], [6, 3, 4])] },
  trunk1: { parent: 'head', pivot: [0, 16, -14], cubes: [c([-1.5, 9, -15.5], [3, 7, 3])] },
  trunk2: { parent: 'trunk1', pivot: [0, 9, -14], cubes: [c([-1, 3, -15], [2, 6, 2])] },
  trunk3: { parent: 'trunk2', pivot: [0, 3, -14], cubes: [c([-1, 0, -15], [2, 3, 2])] },
  ...pair('tusk', [3, 13.5, -14], [2.5, 13, -19], [1, 1, 5], { parent: 'head', rest: [0.35, -0.15, 0], bone: { adult: true } }),
  ...pair('ear', [5, 22, -12], [5, 12, -12], [1, 10, 8], { parent: 'head', rest: [0, 0.45, 0] }),
  ...legs(3.5, 10, -6.5, 6.5, [4, 0, 4]),
  tail: { pivot: [0, 21, 10], rest: [0.3, 0, 0], cubes: [c([-0.5, 13, 10], [1, 8, 1])] },
  saddle: {
    pivot: [0, 16, 0], saddle: true, follows: 'body',
    cubes: [c([-6, 15, -6], [12, 8, 10], { inflate: 0.3, skin: 'saddle' }), c([-3, 23.3, -4], [6, 2, 6], { skin: 'saddle' })],
  },
});

// ---------------------------------------------------------------- hippos
// Hippos: a vast round body on short legs, a huge head whose jaw drops wide open, eyes, ears and
// nostrils up on top (to keep above the water), and a stub of a tail.
const HIPPO = packed({
  body: { pivot: [0, 10, 0], cubes: [c([-6, 5, -9], [12, 10, 19]), c([-0.5, 11, 10], [1, 3, 1])] },
  head: {
    pivot: [0, 12, -9],
    cubes: [c([-4.5, 6, -16], [9, 7, 7]), c([-5, 7, -21], [10, 5, 5]), c([-3.5, 13, -15], [2, 1, 2]), c([1.5, 13, -15], [2, 1, 2], { mirror: true }),
      c([-3, 12, -21], [2, 1, 2]), c([1, 12, -21], [2, 1, 2], { mirror: true })],
  },
  jaw: { parent: 'head', pivot: [0, 7, -13], cubes: [c([-4.5, 4, -21], [9, 3, 9])] },
  ...pair('ear', [3.5, 13, -11], [3, 13, -11.5], [1, 2, 1], { parent: 'head', rest: [0, 0, -0.3] }),
  ...legs(4, 5, -5.5, 6.5, [4, 0, 4]),
});

// ---------------------------------------------------------------- giraffes
// Giraffes: long legs, a short sloping body, and a very long neck leaning a little forward, with
// a mane down its back; a narrow head with ossicones and ears, and a tufted tail.
const GIRAFFE = packed({
  body: { pivot: [0, 24, 0], cubes: [c([-3.5, 20, -7], [7, 8, 14]), c([-3, 27, -7], [6, 2, 6])] },
  neck: { pivot: [0, 27, -5.5], rest: [-0.28, 0, 0], cubes: [c([-1.5, 26, -7], [3, 22, 3]), c([-0.5, 29, -4], [1, 18, 1])] },
  head: {
    parent: 'neck', pivot: [0, 47, -5.5], rest: [0.28, 0, 0],
    cubes: [c([-2, 45.5, -10], [4, 3, 6]), c([-1.5, 45, -13], [3, 3, 3])],
  },
  ...pair('horn', [1, 48.5, -6], [0.5, 48.5, -6.5], [1, 2, 1], { parent: 'head' }),
  ...pair('ear', [2, 48, -5.5], [2, 47.5, -6], [2, 1, 1], { parent: 'head', rest: [0, 0, -0.3] }),
  ...legs(2, 20, -5, 5, [2, 0, 2]),
  tail: { pivot: [0, 26, 7], rest: [0.2, 0, 0], cubes: [c([-0.5, 17, 7], [1, 9, 1])] },
});

// ---------------------------------------------------------------- crocodiles
// Crocodiles: long and flat, low to the ground on splayed legs; a long snout whose lower jaw
// snaps open, eyes raised on top of the head, and a tail in three sections that swings.
const CROCODILE = packed({
  body: { pivot: [0, 3, 0], cubes: [c([-4.5, 1, -8], [9, 4, 16])] },
  head: {
    pivot: [0, 3.5, -8],
    cubes: [c([-3, 1.5, -12], [6, 3, 4]), c([-2, 2.5, -20], [4, 2, 8]), c([-2.5, 4.5, -11], [1, 1, 2]), c([1.5, 4.5, -11], [1, 1, 2], { mirror: true })],
  },
  jaw: { parent: 'head', pivot: [0, 2.5, -12], cubes: [c([-2, 1.5, -20], [4, 1, 8])] },
  tail1: { pivot: [0, 3, 8], cubes: [c([-3, 1.5, 8], [6, 3, 8])] },
  tail2: { parent: 'tail1', pivot: [0, 3, 16], cubes: [c([-2, 2, 16], [4, 2, 8])] },
  tail3: { parent: 'tail2', pivot: [0, 3, 24], cubes: [c([-1, 2.5, 24], [2, 1, 7])] },
  ...pair('legF', [4.5, 2.5, -6], [4.5, 1.5, -7], [4, 2, 2], { rest: [0, 0.3, -0.5] }),
  ...pair('legB', [4.5, 2.5, 6], [4.5, 1.5, 5], [4, 2, 2], { rest: [0, -0.3, -0.5] }),
});

// ---------------------------------------------------------------- camels
// Camels: long knobbly legs, a deep body with a single high hump, a long neck curving up in front
// to a heavy-lipped head, and the blanket and seat that go on when one is saddled.
const CAMEL = packed({
  body: { pivot: [0, 22, 0], cubes: [c([-5.5, 17, -11], [11, 10, 21]), c([-4, 27, -5], [8, 5, 10]), c([-0.5, 19, 10], [1, 7, 1])] },
  neck: { pivot: [0, 23, -10], rest: [-0.75, 0, 0], cubes: [c([-2, 21, -13], [4, 13, 4])] },
  head: {
    parent: 'neck', pivot: [0, 33, -11], rest: [0.75, 0, 0],
    cubes: [c([-2.5, 31, -18], [5, 5, 7]), c([-2, 30, -21], [4, 4, 3])],
  },
  ...pair('ear', [2.5, 35.5, -12], [2.5, 35, -12.5], [2, 1, 1], { parent: 'head', rest: [0, 0, -0.3] }),
  ...legs(3.5, 17, -8, 8, [3, 0, 3]),
  saddle: {
    pivot: [0, 22, 0], saddle: true, follows: 'body',
    cubes: [c([-5.5, 22, -6], [11, 5, 12], { inflate: 0.3, skin: 'saddle' }), c([-3.5, 32.3, -4], [7, 1, 8], { skin: 'saddle' })],
  },
});

// ---------------------------------------------------------------- penguins
// Penguins: an upright body, a round head with a sharp beak, stiff flippers hanging at its sides
// (which it swims with), and short feet it waddles on.
const PENGUIN = packed({
  body: { pivot: [0, 2, 0], cubes: [c([-3.5, 2, -3], [7, 11, 6])] },
  head: { parent: 'body', pivot: [0, 13, 0], cubes: [c([-3, 13, -3], [6, 5, 5]), c([-0.5, 14.5, -6], [1, 1, 3])] },
  ...pair('fin', [3.5, 12, 0], [3.5, 5, -1.5], [1, 7, 3], { parent: 'body' }),
  ...pair('foot', [1.5, 2, 0], [0.5, 0, -2.5], [2, 2, 3]),
});

// ---------------------------------------------------------------- insects
// Butterflies: a slim body and two broad wings that fold up and open.
const BUTTERFLY = packed({
  body: { pivot: [0, 1.5, 0], cubes: [c([-0.5, 1, -2], [1, 1, 4]), c([-1, 2, -3], [2, 1, 0])] },
  ...pair('wing', [0.5, 1.5, 0], [0.5, 1.5, -2.5], [5, 0, 5]),
});

// Bees: Minecraft's bee (so the pack's skins fit): a fuzzy body, a stinger, antennae, two wings
// and three pairs of legs.
const BEE = {
  body: {
    pivot: [0, 5, 0],
    cubes: [mc([-3.5, 2, -5], [7, 7, 10], [0, 0]), mc([0, 5, 5], [0, 1, 2], [26, 7]), mc([-2.5, 7, -8], [1, 2, 3], [2, 0]), mc([1.5, 7, -8], [1, 2, 3], [2, 3])],
  },
  wingR: { pivot: [1.5, 9, -3], rest: [0, 0.2618, 0], cubes: [mc([1.5, 9, -3], [9, 0, 6], [0, 18])] },
  wingL: { pivot: [-1.5, 9, -3], rest: [0, -0.2618, 0], cubes: [mc([-10.5, 9, -3], [9, 0, 6], [0, 18], { mirror: true })] },
  legs: {
    pivot: [0, 2, 0],
    cubes: [mc([-3.5, 0, -2], [7, 2, 0], [26, 1]), mc([-3.5, 0, 0], [7, 2, 0], [26, 3]), mc([-3.5, 0, 2], [7, 2, 0], [26, 5])],
  },
};

// ---------------------------------------------------------------- pandas
// Pandas: Minecraft's panda (so the pack's skins fit): the body stands upright in the skin and is
// laid along the panda by its bone's turn.
const PANDA = {
  body: { pivot: [0, 14, 0], rest: [-Math.PI / 2, 0, 0], cubes: [mc([-9.5, 1, -6.5], [19, 26, 13], [0, 25])] },
  head: {
    pivot: [0, 12.5, -12],
    cubes: [mc([-6.5, 7.5, -21], [13, 10, 9], [0, 6]), mc([-3.5, 7.5, -23], [7, 5, 2], [45, 16]), mc([3.5, 16.5, -18], [5, 4, 1], [52, 25]),
      mc([-8.5, 16.5, -18], [5, 4, 1], [52, 25])],
  },
  legFR: { pivot: [5.5, 9, -9], cubes: [mc([2.5, 0, -12], [6, 9, 6], [40, 0])] },
  legFL: { pivot: [-5.5, 9, -9], cubes: [mc([-8.5, 0, -12], [6, 9, 6], [40, 0])] },
  legBR: { pivot: [5.5, 9, 9], cubes: [mc([2.5, 0, 6], [6, 9, 6], [40, 0])] },
  legBL: { pivot: [-5.5, 9, 9], cubes: [mc([-8.5, 0, 6], [6, 9, 6], [40, 0])] },
};

export const WILD_RIGS = {
  deer: { bones: DEER },
  moose: { bones: MOOSE },
  boar: { bones: BOAR },
  tiger: { bones: bigCat(false) },
  lion: { bones: bigCat(true) },
  elephant: { bones: ELEPHANT },
  hippo: { bones: HIPPO },
  giraffe: { bones: GIRAFFE },
  crocodile: { bones: CROCODILE },
  camel: { bones: CAMEL },
  penguin: { bones: PENGUIN },
  butterfly: { bones: BUTTERFLY },
  bee: { bones: BEE },
  panda: { bones: PANDA },
};
