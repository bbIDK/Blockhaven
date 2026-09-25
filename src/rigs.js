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
      // Eight legs, splayed out and fanned forward and back.
      ...Object.fromEntries([2, 1, 0, -1].flatMap((z, i) => {
        const fan = [0.785, 0.39, -0.39, -0.785][i], drop = [0.62, 0.5, 0.5, 0.62][i];
        return [
          [`legR${i}`, { pivot: [4, 9, z], cubes: [c([4, 8, z - 1], [16, 2, 2], [18, 0])], rest: [0, fan, -drop] }],
          [`legL${i}`, { pivot: [-4, 9, z], cubes: [c([-20, 8, z - 1], [16, 2, 2], [18, 0], { mirror: true })], rest: [0, -fan, drop] }],
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
  // Horses: long legs, the neck held up and forward (the head, ears and mane go with it), a
  // tail, and a saddle when there is one (its own skin).
  horse: {
    bones: {
      body: { pivot: [0, 16, 0], cubes: [c([-5, 11, -11], [10, 10, 22], [0, 32])] },
      head: {
        pivot: [0, 19, -9], rest: [-0.52, 0, 0],
        cubes: [c([-2, 17, -12], [4, 12, 7], [0, 0]), c([-3, 24, -19], [6, 5, 8], [22, 0]), c([-2.5, 29, -13], [2, 3, 1], [50, 0]),
          c([0.5, 29, -13], [2, 3, 1], [50, 0], { mirror: true }), c([-1, 17, -5], [2, 12, 2], [56, 0])],
      },
      legFR: { pivot: [3, 11, -8], cubes: [c([1, 0, -10], [4, 11, 4], [22, 13])] },
      legFL: { pivot: [-3, 11, -8], cubes: [c([-5, 0, -10], [4, 11, 4], [22, 13], { mirror: true })] },
      legBR: { pivot: [3, 11, 8], cubes: [c([1, 0, 6], [4, 11, 4], [22, 13])] },
      legBL: { pivot: [-3, 11, 8], cubes: [c([-5, 0, 6], [4, 11, 4], [22, 13], { mirror: true })] },
      tail: { pivot: [0, 20, 11], cubes: [c([-1.5, 8, 11], [3, 12, 3], [38, 13])], rest: [-0.45, 0, 0] },
      saddle: {
        pivot: [0, 16, 0], saddle: true, follows: 'body',
        cubes: [c([-5, 21, -5], [10, 1, 10], [0, 0], { skin: 'saddle', inflate: 0.3 }), c([-1.5, 22, -5], [3, 2, 2], [40, 0], { skin: 'saddle' }),
          c([5, 14, -1], [1, 6, 2], [50, 0], { skin: 'saddle' }), c([-6, 14, -1], [1, 6, 2], [50, 0], { skin: 'saddle', mirror: true })],
      },
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
    const cubes = bone.cubes.map((cb) => (cb.skin ? { ...cb, layer: skinLayer(skins[cb.skin]) } : cb));
    const t = bone.wool && tint ? [(tint >> 16) & 255, (tint >> 8) & 255, tint & 255] : null;
    out.push({ name, bone, mesh: renderer.createMesh(skinMesh(cubes, skinLayer(skins.main), bone.pivot, t)) });
  }
  meshCache.set(key, out);
  return out;
}

// The matrix of each bone: `base` (the creature's own transform) then the bone's pivot and turn.
// `pose[name]` = [rx, ry, rz] added to the rest turn; bones that `follow` another take its pose.
export function boneMatrix(m, base, bone, pose, name) {
  m.set(base);
  const p = bone.pivot;
  translate(m, m, p[0] / 16, p[1] / 16, p[2] / 16);
  const r = pose[bone.follows ?? name], rest = bone.rest;
  const rx = (r?.[0] ?? 0) + (rest?.[0] ?? 0), ry = (r?.[1] ?? 0) + (rest?.[1] ?? 0), rz = (r?.[2] ?? 0) + (rest?.[2] ?? 0);
  if (ry) rotateY(m, m, ry);
  if (rx) rotateX(m, m, rx);
  if (rz) rotateZ(m, m, rz);
  const o = pose[`${bone.follows ?? name}@`];
  if (o) translate(m, m, o[0] / 16, o[1] / 16, o[2] / 16);
  translate(m, m, -MODEL_OFFSET, -MODEL_OFFSET, -MODEL_OFFSET);
  return m;
}
export const identityBase = (m) => identity(m);
