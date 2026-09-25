// Creature models, in Minecraft's style: bones that turn about a pivot, each carrying boxes cut
// from a skin (see skins.js and models.js skinMesh). Units are pixels (1/16 block); y is up from
// the feet, the creature faces -z, and its right side is +x. `uv` is where a box's strip starts
// in the skin, `mirror` flips it (left limbs reusing the right ones' picture), `inflate` grows it
// without changing its picture (hats, coats, wool), `rest` is a bone's resting turn [x, y, z].
import { skinMesh, MODEL_OFFSET } from './models.js';
import { skinLayer } from './skins.js';
import { identity, translate, rotateX, rotateY, rotateZ } from './math.js';

const c = (from, size, uv, o = {}) => ({ from, size, uv, ...o });

// People: players, zombies, villagers. The 64x64 layout with a second layer over each part.
const HUMANOID = {
  head: { pivot: [0, 24, 0], cubes: [c([-4, 24, -4], [8, 8, 8], [0, 0]), c([-4, 24, -4], [8, 8, 8], [32, 0], { inflate: 0.5 })] },
  body: { pivot: [0, 24, 0], cubes: [c([-4, 12, -2], [8, 12, 4], [16, 16]), c([-4, 12, -2], [8, 12, 4], [16, 32], { inflate: 0.25 })] },
  rightArm: { pivot: [5, 22, 0], cubes: [c([4, 12, -2], [4, 12, 4], [40, 16]), c([4, 12, -2], [4, 12, 4], [40, 32], { inflate: 0.25 })] },
  leftArm: { pivot: [-5, 22, 0], cubes: [c([-8, 12, -2], [4, 12, 4], [32, 48]), c([-8, 12, -2], [4, 12, 4], [48, 48], { inflate: 0.25 })] },
  rightLeg: { pivot: [2, 12, 0], cubes: [c([0, 0, -2], [4, 12, 4], [0, 16]), c([0, 0, -2], [4, 12, 4], [0, 32], { inflate: 0.25 })] },
  leftLeg: { pivot: [-2, 12, 0], cubes: [c([-4, 0, -2], [4, 12, 4], [16, 48]), c([-4, 0, -2], [4, 12, 4], [0, 48], { inflate: 0.25 })] },
};

// Horses, donkeys and mules, built as Minecraft builds them (so its horse skins fit): a long body,
// the neck held up and leaning forward with the head on top of it and the muzzle out in front,
// small ears (a donkey's long ones splay out), the mane down the back of the neck, a tail that hangs
// back, and long legs. The saddle and bridle come from the same skin and show when there's a
// saddle; the reins only while someone rides. Markings (white socks, a blaze, spots) are a second
// skin drawn over the coat.
const NECK = { pivot: [0, 20, -12], rest: [-Math.PI / 6, 0, 0] };
const HORSE_EARS = [c([-2.55, 30, -8], [2, 3, 1], [19, 16]), c([0.55, 30, -8], [2, 3, 1], [19, 16])];
const DONKEY_EARS = {
  earL: { parent: 'head', pivot: [-1.25, 30, -8], rest: [-0.26, 0, 0.26], cubes: [c([-2.25, 30, -8], [2, 7, 1], [0, 12])] },
  earR: { parent: 'head', pivot: [1.25, 30, -8], rest: [-0.26, 0, -0.26], cubes: [c([0.25, 30, -8], [2, 7, 1], [0, 12])] },
};
function horseBones(ears, extra = {}) {
  const bones = {
    body: { pivot: [0, 13, 5], cubes: [c([-5, 11, -12], [10, 10, 22], [0, 32])] },
    head: {
      ...NECK,
      cubes: [c([-2, 14, -14], [4, 12, 7], [0, 35]), c([-3, 26, -14], [6, 5, 7], [0, 13]), c([-2, 26, -19], [4, 5, 5], [0, 25]),
        c([-1, 15, -6.99], [2, 16, 2], [56, 36]), ...ears],
    },
    ...extra,
    legFR: { pivot: [4, 10, -12], cubes: [c([1, 0, -13.9], [4, 11, 4], [48, 21])] },
    legFL: { pivot: [-4, 10, -12], cubes: [c([-5, 0, -13.9], [4, 11, 4], [48, 21], { mirror: true })] },
    legBR: { pivot: [4, 10, 7], cubes: [c([1, 0, 6], [4, 11, 4], [48, 21])] },
    legBL: { pivot: [-4, 10, 7], cubes: [c([-5, 0, 6], [4, 11, 4], [48, 21], { mirror: true })] },
    tail: { pivot: [0, 18, 7], rest: [-Math.PI / 6, 0, 0], cubes: [c([-1.5, 4, 7], [3, 14, 4], [42, 36])] },
    saddle: { pivot: [0, 13, 5], saddle: true, follows: 'body', cubes: [c([-5, 12, -4], [10, 9, 9], [26, 0], { inflate: 0.5 })] },
    bridle: {
      ...NECK, saddle: true, follows: 'head',
      cubes: [c([-3, 26, -13.9], [6, 5, 6], [1, 1], { inflate: 0.22 }), c([-2, 26, -16], [4, 5, 2], [19, 0], { inflate: 0.2 }),
        c([2, 27, -18], [1, 2, 2], [29, 5]), c([-3, 27, -18], [1, 2, 2], [29, 5])],
    },
    reins: {
      pivot: NECK.pivot, saddle: true, ridden: true, follows: 'head',
      cubes: [c([3.1, 23, -20], [0, 3, 16], [32, 2]), c([-3.1, 23, -20], [0, 3, 16], [32, 2])],
    },
  };
  // The markings: the coat's boxes again, a hair larger, in the markings skin.
  for (const name of ['body', 'head', 'legFR', 'legFL', 'legBR', 'legBL', 'tail', ...Object.keys(extra)]) {
    const b = bones[name];
    bones[`${name}Marks`] = { ...b, follows: b.follows ?? name, markings: true,
      cubes: b.cubes.map((cb) => ({ ...cb, skin: 'markings', inflate: (cb.inflate ?? 0) + 0.02 })) };
  }
  return bones;
}

export const RIGS = {
  humanoid: { bones: HUMANOID, hand: { bone: 'rightArm', at: [6, 13, -1] }, height: 32 },
  skeleton: {
    bones: {
      head: HUMANOID.head,
      body: { pivot: [0, 24, 0], cubes: [c([-4, 12, -2], [8, 12, 4], [16, 16]), c([-4, 12, -2], [8, 12, 4], [16, 32], { inflate: 0.25 })] },
      rightArm: { pivot: [5, 22, 0], cubes: [c([4, 12, -1], [2, 12, 2], [40, 16])] },
      leftArm: { pivot: [-5, 22, 0], cubes: [c([-6, 12, -1], [2, 12, 2], [40, 16], { mirror: true })] },
      rightLeg: { pivot: [2, 12, 0], cubes: [c([1, 0, -1], [2, 12, 2], [0, 16])] },
      leftLeg: { pivot: [-2, 12, 0], cubes: [c([-3, 0, -1], [2, 12, 2], [0, 16], { mirror: true })] },
    },
    hand: { bone: 'rightArm', at: [5, 13, 0] },
  },
  creeper: {
    bones: {
      head: { pivot: [0, 18, 0], cubes: [c([-4, 18, -4], [8, 8, 8], [0, 0])] },
      body: { pivot: [0, 18, 0], cubes: [c([-4, 6, -2], [8, 12, 4], [16, 16])] },
      legFR: { pivot: [2, 6, -4], cubes: [c([0, 0, -6], [4, 6, 4], [0, 16])] },
      legFL: { pivot: [-2, 6, -4], cubes: [c([-4, 0, -6], [4, 6, 4], [0, 16], { mirror: true })] },
      legBR: { pivot: [2, 6, 4], cubes: [c([0, 0, 2], [4, 6, 4], [0, 16])] },
      legBL: { pivot: [-2, 6, 4], cubes: [c([-4, 0, 2], [4, 6, 4], [0, 16], { mirror: true })] },
    },
  },
  spider: {
    bones: {
      head: { pivot: [0, 9, -3], cubes: [c([-4, 5, -11], [8, 8, 8], [32, 4])] },
      neck: { pivot: [0, 9, 0], cubes: [c([-3, 6, -3], [6, 6, 6], [0, 0])] },
      body: { pivot: [0, 9, 9], cubes: [c([-5, 5, 3], [10, 8, 12], [0, 12])] },
      // Eight legs, splayed out: the back pair fanned backwards, the front pair forwards.
      ...Object.fromEntries([2, 1, 0, -1].flatMap((z, i) => {
        const fan = [0.785, 0.39, -0.39, -0.785][i], drop = [0.62, 0.5, 0.5, 0.62][i];
        return [
          [`legR${i}`, { pivot: [4, 9, z], cubes: [c([4, 8, z - 1], [16, 2, 2], [18, 0])], rest: [0, -fan, -drop] }],
          [`legL${i}`, { pivot: [-4, 9, z], cubes: [c([-20, 8, z - 1], [16, 2, 2], [18, 0], { mirror: true })], rest: [0, fan, drop] }],
        ];
      })),
    },
  },
  enderman: {
    bones: {
      head: { pivot: [0, 37, 0], cubes: [c([-4, 37, -4], [8, 8, 8], [0, 0])] },
      body: { pivot: [0, 37, 0], cubes: [c([-4, 25, -2], [8, 12, 4], [32, 16])] },
      rightArm: { pivot: [5, 36, 0], cubes: [c([4, 8, -1], [2, 30, 2], [56, 0])] },
      leftArm: { pivot: [-5, 36, 0], cubes: [c([-6, 8, -1], [2, 30, 2], [56, 0], { mirror: true })] },
      rightLeg: { pivot: [2, 29, 0], cubes: [c([1, -1, -1], [2, 30, 2], [56, 0])] },
      leftLeg: { pivot: [-2, 29, 0], cubes: [c([-3, -1, -1], [2, 30, 2], [56, 0], { mirror: true })] },
    },
  },
  slime: {
    bones: { body: { pivot: [0, 0, 0], cubes: [c([-4, 0, -4], [8, 8, 8], [0, 0])] } },
  },
  pig: {
    bones: {
      body: { pivot: [0, 10, 2], cubes: [c([-5, 6, -6], [10, 8, 16], [0, 32])] },
      head: { pivot: [0, 12, -6], cubes: [c([-4, 8, -14], [8, 8, 8], [0, 0]), c([-2, 9, -15], [4, 3, 1], [16, 16])] },
      legFR: { pivot: [3, 6, -5], cubes: [c([1, 0, -7], [4, 6, 4], [0, 16])] },
      legFL: { pivot: [-3, 6, -5], cubes: [c([-5, 0, -7], [4, 6, 4], [0, 16], { mirror: true })] },
      legBR: { pivot: [3, 6, 7], cubes: [c([1, 0, 5], [4, 6, 4], [0, 16])] },
      legBL: { pivot: [-3, 6, 7], cubes: [c([-5, 0, 5], [4, 6, 4], [0, 16], { mirror: true })] },
    },
  },
  cow: {
    bones: {
      body: { pivot: [0, 17, 1], cubes: [c([-6, 12, -8], [12, 10, 18], [0, 34]), c([-2, 11, 3], [4, 1, 6], [36, 0])] },
      head: {
        pivot: [0, 20, -8],
        cubes: [c([-4, 16, -14], [8, 8, 6], [0, 0]), c([-5, 22, -12], [1, 3, 1], [30, 0]), c([4, 22, -12], [1, 3, 1], [30, 0], { mirror: true }),
          c([-2, 16, -15], [4, 3, 1], [30, 10])],
      },
      legFR: { pivot: [4, 12, -5], cubes: [c([2, 0, -7], [4, 12, 4], [0, 16])] },
      legFL: { pivot: [-4, 12, -5], cubes: [c([-6, 0, -7], [4, 12, 4], [0, 16], { mirror: true })] },
      legBR: { pivot: [4, 12, 6], cubes: [c([2, 0, 4], [4, 12, 4], [0, 16])] },
      legBL: { pivot: [-4, 12, 6], cubes: [c([-6, 0, 4], [4, 12, 4], [0, 16], { mirror: true })] },
    },
  },
  // Sheep: a shorn body and head, and the coat of wool over them (its own skin, tinted by colour).
  sheep: {
    bones: {
      body: { pivot: [0, 15, 0], cubes: [c([-4, 12, -8], [8, 6, 16], [0, 36])] },
      wool: { pivot: [0, 15, 0], cubes: [c([-4, 12, -8], [8, 6, 16], [0, 36], { inflate: 1.75, skin: 'wool' })], wool: true },
      head: { pivot: [0, 17, -7], cubes: [c([-3, 15, -14], [6, 6, 8], [0, 0])] },
      headWool: { pivot: [0, 17, -7], cubes: [c([-3, 15, -13], [6, 6, 6], [0, 0], { inflate: 0.6, skin: 'wool' })], wool: true, follows: 'head' },
      legFR: { pivot: [2, 12, -5], cubes: [c([0, 0, -7], [4, 12, 4], [0, 16])] },
      legFL: { pivot: [-2, 12, -5], cubes: [c([-4, 0, -7], [4, 12, 4], [0, 16], { mirror: true })] },
      legBR: { pivot: [2, 12, 6], cubes: [c([0, 0, 4], [4, 12, 4], [0, 16])] },
      legBL: { pivot: [-2, 12, 6], cubes: [c([-4, 0, 4], [4, 12, 4], [0, 16], { mirror: true })] },
      woolFR: { pivot: [2, 12, -5], cubes: [c([0, 6, -7], [4, 6, 4], [16, 16], { inflate: 0.5, skin: 'wool' })], wool: true, follows: 'legFR' },
      woolFL: { pivot: [-2, 12, -5], cubes: [c([-4, 6, -7], [4, 6, 4], [16, 16], { inflate: 0.5, mirror: true, skin: 'wool' })], wool: true, follows: 'legFL' },
      woolBR: { pivot: [2, 12, 6], cubes: [c([0, 6, 4], [4, 6, 4], [16, 16], { inflate: 0.5, skin: 'wool' })], wool: true, follows: 'legBR' },
      woolBL: { pivot: [-2, 12, 6], cubes: [c([-4, 6, 4], [4, 6, 4], [16, 16], { inflate: 0.5, mirror: true, skin: 'wool' })], wool: true, follows: 'legBL' },
    },
  },
  chicken: {
    bones: {
      body: { pivot: [0, 7, 1], cubes: [c([-3, 4, -3], [6, 6, 8], [0, 9])] },
      head: {
        pivot: [0, 9, -3],
        cubes: [c([-2, 9, -6], [4, 6, 3], [0, 0]), c([-2, 11, -8], [4, 2, 2], [14, 0]), c([-1, 9, -7], [2, 2, 2], [14, 4])],
      },
      wingR: { pivot: [3, 10, 0], cubes: [c([3, 6, -3], [1, 4, 6], [28, 13])] },
      wingL: { pivot: [-3, 10, 0], cubes: [c([-4, 6, -3], [1, 4, 6], [28, 13], { mirror: true })] },
      legR: { pivot: [1.5, 5, 1], cubes: [c([0, 0, -0.5], [3, 5, 3], [26, 0])] },
      legL: { pivot: [-1.5, 5, 1], cubes: [c([-3, 0, -0.5], [3, 5, 3], [26, 0], { mirror: true })] },
    },
  },
  wolf: {
    bones: {
      body: { pivot: [0, 10, 2], cubes: [c([-3, 7, -2], [6, 6, 9], [18, 14])] },
      mane: { pivot: [0, 10, -2], cubes: [c([-4, 7, -6], [8, 7, 6], [21, 0])] },
      head: {
        pivot: [0, 12, -6],
        cubes: [c([-3, 9, -10], [6, 6, 4], [0, 0]), c([-3, 15, -8], [2, 2, 1], [16, 14]), c([1, 15, -8], [2, 2, 1], [16, 14], { mirror: true }),
          c([-1.5, 9, -13], [3, 3, 4], [0, 10])],
      },
      legFR: { pivot: [1.5, 8, -3], cubes: [c([0.5, 0, -4], [2, 8, 2], [0, 18])] },
      legFL: { pivot: [-1.5, 8, -3], cubes: [c([-2.5, 0, -4], [2, 8, 2], [0, 18], { mirror: true })] },
      legBR: { pivot: [1.5, 8, 6], cubes: [c([0.5, 0, 5], [2, 8, 2], [0, 18])] },
      legBL: { pivot: [-1.5, 8, 6], cubes: [c([-2.5, 0, 5], [2, 8, 2], [0, 18], { mirror: true })] },
      tail: { pivot: [0, 12, 7], cubes: [c([-1, 4, 6], [2, 8, 2], [9, 18])], rest: [-0.7, 0, 0] },
      // A tame wolf's collar (dyed to taste).
      collar: { pivot: [0, 10, -2], follows: 'mane', collar: true, cubes: [c([-4, 7.5, -6], [8, 6, 1], [0, 0], { skin: 'collar', inflate: 0.35 })] },
    },
  },
  fox: {
    bones: {
      body: { pivot: [0, 7, 2], cubes: [c([-3, 4, -3], [6, 6, 11], [24, 15])] },
      head: {
        pivot: [0, 8, -3],
        cubes: [c([-4, 6, -9], [8, 6, 6], [1, 5]), c([-4, 12, -7], [2, 2, 1], [8, 1]), c([2, 12, -7], [2, 2, 1], [15, 1]),
          c([-2, 6, -12], [4, 2, 3], [6, 18])],
      },
      legFR: { pivot: [2, 6, -1], cubes: [c([1, 0, -2], [2, 6, 2], [13, 24])] },
      legFL: { pivot: [-2, 6, -1], cubes: [c([-3, 0, -2], [2, 6, 2], [4, 24], { mirror: true })] },
      legBR: { pivot: [2, 6, 6], cubes: [c([1, 0, 5], [2, 6, 2], [13, 24])] },
      legBL: { pivot: [-2, 6, 6], cubes: [c([-3, 0, 5], [2, 6, 2], [4, 24], { mirror: true })] },
      tail: { pivot: [0, 9, 8], cubes: [c([-2, 5, 8], [4, 5, 9], [30, 0])], rest: [0.3, 0, 0] },
    },
  },
  rabbit: {
    bones: {
      body: { pivot: [0, 4, 2], cubes: [c([-3, 1, -2], [6, 5, 8], [0, 18])] },
      head: {
        pivot: [0, 6, -2],
        cubes: [c([-2.5, 4, -6], [5, 4, 5], [0, 0]), c([-2, 8, -4], [2, 5, 1], [52, 0]), c([0, 8, -4], [2, 5, 1], [58, 0]),
          c([-0.5, 5, -6.5], [1, 1, 1], [32, 9])],
      },
      hindR: { pivot: [2.5, 3, 4], cubes: [c([2, 0, 1], [2, 4, 5], [30, 15])] },
      hindL: { pivot: [-2.5, 3, 4], cubes: [c([-4, 0, 1], [2, 4, 5], [30, 15], { mirror: true })] },
      frontR: { pivot: [1.5, 3, -1], cubes: [c([0.5, 0, -2], [2, 3, 2], [44, 15])] },
      frontL: { pivot: [-1.5, 3, -1], cubes: [c([-2.5, 0, -2], [2, 3, 2], [44, 15], { mirror: true })] },
      tail: { pivot: [0, 4, 6], cubes: [c([-1.5, 3, 6], [3, 3, 2], [52, 6])] },
    },
  },
  goat: {
    bones: {
      body: { pivot: [0, 15, 1], cubes: [c([-4.5, 10, -7], [9, 9, 15], [0, 32])] },
      head: {
        pivot: [0, 18, -7],
        cubes: [c([-2.5, 14, -14], [5, 6, 7], [0, 0]), c([-2, 20, -10], [2, 5, 2], [24, 0]), c([0, 20, -10], [2, 5, 2], [24, 0], { mirror: true }),
          c([-0.5, 11, -13], [1, 3, 2], [32, 0]), c([-4.5, 18, -9], [2, 1, 1], [38, 0]), c([2.5, 18, -9], [2, 1, 1], [38, 0], { mirror: true })],
      },
      legFR: { pivot: [2.5, 10, -5], cubes: [c([1, 0, -6], [3, 10, 3], [0, 14])] },
      legFL: { pivot: [-2.5, 10, -5], cubes: [c([-4, 0, -6], [3, 10, 3], [0, 14], { mirror: true })] },
      legBR: { pivot: [2.5, 10, 5], cubes: [c([1, 0, 4], [3, 10, 3], [0, 14])] },
      legBL: { pivot: [-2.5, 10, 5], cubes: [c([-4, 0, 4], [3, 10, 3], [0, 14], { mirror: true })] },
    },
  },
  // Horses, donkeys and mules: Minecraft's horse model and skin layout (see horseBones).
  horse: { bones: horseBones(HORSE_EARS) },
  donkey: { bones: horseBones([], DONKEY_EARS) },
  // Snow golems: two balls of snow, a carved pumpkin for a head, and sticks for arms.
  snow_golem: {
    bones: {
      body: { pivot: [0, 11, 0], cubes: [c([-6, 0, -6], [12, 12, 12], [0, 36]), c([-5, 11, -5], [10, 10, 10], [0, 16])] },
      head: { pivot: [0, 21, 0], cubes: [c([-4, 21, -4], [8, 8, 8], [0, 0], { inflate: 0.4 })] },
      rightArm: { pivot: [5, 18, 0], cubes: [c([5, 17, -1], [11, 2, 2], [32, 0])], rest: [0, 0, 0.55] },
      leftArm: { pivot: [-5, 18, 0], cubes: [c([-16, 17, -1], [11, 2, 2], [32, 0], { mirror: true })], rest: [0, 0, -0.55] },
    },
  },
  // Iron golems: a broad chest over a narrow waist, a long nose, and arms down to their knees
  // (arms and legs come from a second skin, `limbs`).
  iron_golem: {
    bones: {
      body: { pivot: [0, 19, 0], cubes: [c([-9, 19, -5.5], [18, 12, 11], [0, 18]), c([-4.5, 14, -3], [9, 5, 6], [0, 41])] },
      head: { pivot: [0, 31, -2], cubes: [c([-4, 31, -7.5], [8, 10, 8], [0, 0]), c([-1, 32, -9.5], [2, 4, 2], [32, 0])] },
      rightArm: { pivot: [11, 29, 0], cubes: [c([9, 1, -3], [4, 30, 6], [0, 0], { skin: 'limbs' })] },
      leftArm: { pivot: [-11, 29, 0], cubes: [c([-13, 1, -3], [4, 30, 6], [0, 0], { skin: 'limbs', mirror: true })] },
      rightLeg: { pivot: [4, 14, 0], cubes: [c([1, 0, -2.5], [6, 14, 5], [24, 0], { skin: 'limbs' })] },
      leftLeg: { pivot: [-4, 14, 0], cubes: [c([-7, 0, -2.5], [6, 14, 5], [24, 0], { skin: 'limbs', mirror: true })] },
    },
  },
  // Cats: long and low, a small head with pointed ears, and a tail held up behind.
  cat: {
    bones: {
      body: { pivot: [0, 7, 0], cubes: [c([-2, 5, -7], [4, 5, 14], [20, 0])] },
      head: {
        pivot: [0, 9, -7],
        cubes: [c([-2.5, 7, -12], [5, 4, 5], [0, 0]), c([-2, 11, -9], [1, 1, 2], [0, 10]), c([1, 11, -9], [1, 1, 2], [6, 10]),
          c([-1.5, 7, -13], [3, 2, 1], [0, 24])],
      },
      legFR: { pivot: [1, 5, -5], cubes: [c([0, 0, -6], [2, 5, 2], [8, 13])] },
      legFL: { pivot: [-1, 5, -5], cubes: [c([-2, 0, -6], [2, 5, 2], [8, 13], { mirror: true })] },
      legBR: { pivot: [1, 5, 5], cubes: [c([0, 0, 4], [2, 5, 2], [40, 20])] },
      legBL: { pivot: [-1, 5, 5], cubes: [c([-2, 0, 4], [2, 5, 2], [40, 20], { mirror: true })] },
      tail: { pivot: [0, 9, 7], cubes: [c([-0.5, 1, 6.5], [1, 8, 1], [0, 15])], rest: [-0.9, 0, 0] },
      collar: { pivot: [0, 7, 0], follows: 'body', collar: true, cubes: [c([-2, 5, -7], [4, 5, 1], [0, 0], { skin: 'collar', inflate: 0.3 })] },
    },
  },
  // Llamas: a woolly body, a long upright neck, a blunt muzzle and tall ears.
  llama: {
    bones: {
      body: { pivot: [0, 17, 0], cubes: [c([-6, 12, -8], [12, 10, 16], [0, 38])] },
      head: {
        pivot: [0, 20, -7],
        cubes: [c([-3, 18, -10], [6, 14, 6], [0, 0]), c([-4, 28, -14], [8, 6, 10], [24, 0]), c([-4, 34, -8], [3, 3, 2], [0, 20]),
          c([1, 34, -8], [3, 3, 2], [10, 20])],
      },
      legFR: { pivot: [3.5, 12, -6], cubes: [c([1.5, 0, -8], [4, 12, 4], [36, 16])] },
      legFL: { pivot: [-3.5, 12, -6], cubes: [c([-5.5, 0, -8], [4, 12, 4], [36, 16], { mirror: true })] },
      legBR: { pivot: [3.5, 12, 6], cubes: [c([1.5, 0, 4], [4, 12, 4], [36, 16])] },
      legBL: { pivot: [-3.5, 12, 6], cubes: [c([-5.5, 0, 4], [4, 12, 4], [36, 16], { mirror: true })] },
    },
  },
  // Turtles: a wide, low shell, a head poking out in front and four paddling flippers.
  turtle: {
    bones: {
      body: { pivot: [0, 4, 0], cubes: [c([-7, 1, -8], [14, 5, 16], [0, 0])] },
      head: { pivot: [0, 3, -8], cubes: [c([-3, 1, -13], [6, 5, 6], [0, 21])] },
      legFR: { pivot: [7, 2, -5], cubes: [c([7, 2, -7.5], [10, 1, 5], [24, 21])] },
      legFL: { pivot: [-7, 2, -5], cubes: [c([-17, 2, -7.5], [10, 1, 5], [24, 21], { mirror: true })] },
      legBR: { pivot: [5, 2, 7], cubes: [c([3, 2, 7], [5, 1, 8], [24, 28])] },
      legBL: { pivot: [-5, 2, 7], cubes: [c([-8, 2, 7], [5, 1, 8], [24, 28], { mirror: true })] },
    },
  },
  // Bats: a furry body and head with big ears, and two wide leathery wings.
  bat: {
    bones: {
      body: { pivot: [0, 4, 0], cubes: [c([-1.5, 1, -1], [3, 5, 2], [0, 8])] },
      head: { pivot: [0, 6, 0], cubes: [c([-2, 6, -2], [4, 4, 4], [0, 0]), c([-2, 10, -1], [1, 2, 1], [16, 0]), c([1, 10, -1], [1, 2, 1], [20, 0])] },
      wingR: { pivot: [1.5, 5, 0], cubes: [c([1.5, 5, -3], [8, 0, 6], [0, 16])] },
      wingL: { pivot: [-1.5, 5, 0], cubes: [c([-9.5, 5, -3], [8, 0, 6], [0, 16], { mirror: true })] },
    },
  },
  // Parrots: upright, a hooked beak and a crest, wings folded at the sides and a long tail.
  parrot: {
    bones: {
      body: { pivot: [0, 5, 0], cubes: [c([-1.5, 3, -2], [3, 6, 4], [0, 6])] },
      head: {
        pivot: [0, 9, -1],
        cubes: [c([-1.5, 9, -2.5], [3, 3, 3], [0, 0]), c([-0.5, 9.5, -4.5], [1, 2, 2], [12, 0]), c([0, 12, -1.5], [0, 3, 3], [18, 0])],
      },
      wingR: { pivot: [1.5, 8, 0], cubes: [c([1.5, 4, -2], [1, 5, 4], [14, 6])] },
      wingL: { pivot: [-1.5, 8, 0], cubes: [c([-2.5, 4, -2], [1, 5, 4], [14, 6], { mirror: true })] },
      tail: { pivot: [0, 3.5, 2], cubes: [c([-1.5, -1, 1.5], [3, 5, 1], [24, 0])], rest: [-0.9, 0, 0] },
      legR: { pivot: [0.7, 3, 0], cubes: [c([0.2, 1, -0.5], [1, 2, 1], [24, 8])] },
      legL: { pivot: [-0.7, 3, 0], cubes: [c([-1.2, 1, -0.5], [1, 2, 1], [24, 8], { mirror: true })] },
    },
  },
  // Phantoms: flat and wide-winged, gliding, with a two-part tail.
  phantom: {
    bones: {
      body: { pivot: [0, 3, 0], cubes: [c([-2.5, 1.5, -4.5], [5, 3, 9], [0, 8])] },
      head: { pivot: [0, 3, -4.5], cubes: [c([-3.5, 1.5, -9.5], [7, 3, 5], [0, 0])] },
      wingR: { pivot: [2.5, 4, 0], cubes: [c([2.5, 3, -4.5], [19, 2, 9], [0, 20])] },
      wingL: { pivot: [-2.5, 4, 0], cubes: [c([-21.5, 3, -4.5], [19, 2, 9], [0, 20], { mirror: true })] },
      tail: { pivot: [0, 3, 4.5], cubes: [c([-1.5, 2, 4.5], [3, 2, 6], [32, 0]), c([-0.5, 2.5, 10.5], [1, 1, 6], [32, 8])] },
    },
  },
  // Witches: a person with a long nose, and a tall crooked hat.
  witch: {
    bones: {
      head: {
        pivot: [0, 24, 0],
        cubes: [c([-4, 24, -4], [8, 10, 8], [0, 0]), c([-1, 25, -6], [2, 4, 2], [32, 0]), c([-5, 33, -5], [10, 2, 10], [0, 46]),
          c([-3, 35, -3], [6, 4, 6], [40, 46]), c([-2, 39, -1.5], [4, 4, 4], [40, 56]), c([-0.5, 43, 0], [1, 2, 1], [56, 56])],
      },
      body: { pivot: [0, 24, 0], cubes: [c([-4, 12, -3], [8, 12, 6], [16, 20])] },
      rightArm: { pivot: [5, 22, 0], cubes: [c([4, 12, -2], [4, 12, 4], [44, 20])] },
      leftArm: { pivot: [-5, 22, 0], cubes: [c([-8, 12, -2], [4, 12, 4], [44, 20], { mirror: true })] },
      rightLeg: { pivot: [2, 12, 0], cubes: [c([0, 0, -2], [4, 12, 4], [0, 20])] },
      leftLeg: { pivot: [-2, 12, 0], cubes: [c([-4, 0, -2], [4, 12, 4], [0, 20], { mirror: true })] },
    },
    hand: { bone: 'rightArm', at: [6, 13, -1] },
  },
  // Dolphins: a sleek body, a beak, a fin on the back, flippers and a fluked tail.
  dolphin: {
    bones: {
      body: { pivot: [0, 3.5, 0], cubes: [c([-4, 0, -6.5], [8, 7, 13], [0, 13]), c([-0.5, 7, -1], [1, 4, 5], [40, 0])] },
      head: { pivot: [0, 3.5, -6.5], cubes: [c([-4, 0, -12.5], [8, 7, 6], [0, 0]), c([-1, 0, -16.5], [2, 2, 4], [28, 0])] },
      finR: { pivot: [4, 4, -3], cubes: [c([4, 0, -4], [1, 4, 7], [42, 13])], rest: [0, 0, 0.9] },
      finL: { pivot: [-4, 4, -3], cubes: [c([-5, 0, -4], [1, 4, 7], [42, 13], { mirror: true })], rest: [0, 0, -0.9] },
      tail: { pivot: [0, 3, 6.5], cubes: [c([-2, 1, 6.5], [4, 5, 11], [0, 33]), c([-5, 3, 16.5], [10, 1, 6], [0, 49])] },
    },
  },
  polar_bear: {
    bones: {
      body: { pivot: [0, 16, 1], cubes: [c([-7, 10, -8], [14, 12, 18], [0, 34])] },
      head: {
        pivot: [0, 18, -8],
        cubes: [c([-3.5, 14, -15], [7, 7, 7], [0, 0]), c([-2.5, 14, -18], [5, 3, 3], [28, 0]), c([-4.5, 20, -12], [2, 2, 1], [28, 6]),
          c([2.5, 20, -12], [2, 2, 1], [28, 6], { mirror: true })],
      },
      legFR: { pivot: [4, 10, -5], cubes: [c([2, 0, -7], [4, 10, 5], [0, 14])] },
      legFL: { pivot: [-4, 10, -5], cubes: [c([-6, 0, -7], [4, 10, 5], [0, 14], { mirror: true })] },
      legBR: { pivot: [4, 10, 6], cubes: [c([2, 0, 4], [4, 10, 5], [0, 14])] },
      legBL: { pivot: [-4, 10, 6], cubes: [c([-6, 0, 4], [4, 10, 5], [0, 14], { mirror: true })] },
    },
  },
  squid: {
    bones: {
      body: { pivot: [0, 8, 0], cubes: [c([-6, 8, -6], [12, 16, 12], [0, 0])] },
      ...Object.fromEntries(Array.from({ length: 8 }, (_, i) => {
        const a = (i / 8) * Math.PI * 2, x = Math.round(Math.cos(a) * 5), z = Math.round(Math.sin(a) * 5);
        return [`arm${i}`, { pivot: [x, 8, z], cubes: [c([x - 1, -10, z - 1], [2, 18, 2], [48, 0])], arm: a }];
      })),
    },
  },
  cod: {
    bones: {
      body: {
        pivot: [0, 2, 0],
        cubes: [c([-1, 0, -3], [2, 4, 7], [0, 0]), c([-1, 0, -4], [2, 3, 1], [11, 0]), c([0, 4, -2], [0, 1, 6], [20, 0]),
          c([0, -1, 1], [0, 1, 2], [0, 14])],
      },
      tail: { pivot: [0, 2, 4], cubes: [c([0, 0, 4], [0, 4, 4], [22, 3])] },
    },
  },
  salmon: {
    bones: {
      body: {
        pivot: [0, 2.5, 0],
        cubes: [c([-1.5, 0, -4], [3, 5, 8], [0, 0]), c([-1, 0.5, -7], [2, 4, 3], [22, 0]), c([0, 5, -2], [0, 2, 6], [32, 0])],
      },
      tail: { pivot: [0, 2.5, 4], cubes: [c([-1.5, 0, 4], [3, 5, 4], [0, 13]), c([0, 0, 8], [0, 5, 5], [20, 10])] },
    },
  },
};

// ---------------------------------------------------------------- meshes and poses
// Meshes for a rig in a skin (`skins`: the skin for each `skin` key a box names, `tint`: colour
// for bones marked `wool`), one per bone, cached.
const meshCache = new Map();
export function rigMeshes(renderer, rigName, skins, tint = null) {
  const key = `${rigName}|${Object.entries(skins).map(([k, v]) => `${k}=${v}`).join(',')}|${tint ?? ''}`;
  let out = meshCache.get(key);
  if (out) return out;
  const rig = RIGS[rigName];
  out = [];
  for (const [name, bone] of Object.entries(rig.bones)) {
    // (A part whose skin this creature doesn't have - markings on a plain coat - isn't drawn.)
    const cubes = bone.cubes.map((cb) => (cb.skin ? { ...cb, layer: skinLayer(skins[cb.skin] ?? skins.main) } : cb));
    const t = (bone.wool || bone.collar) && tint ? [(tint >> 16) & 255, (tint >> 8) & 255, tint & 255] : null;
    out.push({ name, bone, mesh: renderer.createMesh(skinMesh(cubes, skinLayer(skins.main), bone.pivot, t)) });
  }
  meshCache.set(key, out);
  return out;
}

// The matrix of each bone: `base` (the creature's own transform) then the bone's pivot and turn.
// `pose[name]` = [rx, ry, rz] added to the rest turn; bones that `follow` another take its pose,
// and a bone with a `parent` (in `bones`) turns with it first (a donkey's ears on its head).
export function boneMatrix(m, base, bone, pose, name, bones = null) {
  boneFrame(m, base, bone, pose, name, bones);
  translate(m, m, -MODEL_OFFSET, -MODEL_OFFSET, -MODEL_OFFSET);
  return m;
}
function boneFrame(m, base, bone, pose, name, bones) {
  const p = bone.pivot, parent = bone.parent && bones?.[bone.parent];
  if (parent) {
    boneFrame(m, base, parent, pose, bone.parent, bones);
    translate(m, m, (p[0] - parent.pivot[0]) / 16, (p[1] - parent.pivot[1]) / 16, (p[2] - parent.pivot[2]) / 16);
  } else {
    m.set(base);
    translate(m, m, p[0] / 16, p[1] / 16, p[2] / 16);
  }
  const r = pose[bone.follows ?? name], rest = bone.rest;
  const rx = (r?.[0] ?? 0) + (rest?.[0] ?? 0), ry = (r?.[1] ?? 0) + (rest?.[1] ?? 0), rz = (r?.[2] ?? 0) + (rest?.[2] ?? 0);
  if (ry) rotateY(m, m, ry);
  if (rx) rotateX(m, m, rx);
  if (rz) rotateZ(m, m, rz);
  const o = pose[`${bone.follows ?? name}@`];
  if (o) translate(m, m, o[0] / 16, o[1] / 16, o[2] / 16);
}
export const identityBase = (m) => identity(m);
