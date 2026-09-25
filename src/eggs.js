// Spawn eggs, as in Minecraft: one for each creature, in its two colours (the egg and its
// speckles), had in Creative or by command. Used on a block, the creature comes out there (sea
// creatures in the water looked at). Their item ids run on from EGG_ID in this order, so new ones
// only ever go on the end.
export const EGG_ID = 461;
export const EGGS = [
  ['pig', 0xf0a5a2, 0xdb635f], ['cow', 0x443626, 0xa1a1a1], ['sheep', 0xe7e7e7, 0xffb5b5], ['chicken', 0xa1a1a1, 0xff0000],
  ['rabbit', 0x995f40, 0x734831], ['fox', 0xd5b69f, 0xcc6920], ['goat', 0xa5947c, 0x55493e], ['wolf', 0xd7d3d3, 0xceaf96],
  ['horse', 0xc09e7d, 0xeee500], ['polar_bear', 0xeeeede, 0xd5d6cd], ['squid', 0x223b4d, 0x708899], ['cod', 0xc1a76a, 0xe5c48b],
  ['salmon', 0xa00f10, 0x0e8474], ['zombie', 0x00afaf, 0x799c65], ['husk', 0x797061, 0xe6cc94], ['skeleton', 0xc1c1c1, 0x494949],
  ['stray', 0x617677, 0xddeaea], ['creeper', 0x0da70b, 0x000000], ['spider', 0x342d27, 0xa80e0e], ['enderman', 0x161616, 0x000000],
  ['slime', 0x51a03e, 0x7ebf6e], ['donkey', 0x534539, 0x867566], ['mule', 0x1b0200, 0x51331d], ['llama', 0xc09e7d, 0x995f40],
  ['cat', 0xefc88e, 0x957256], ['turtle', 0xe7e7e7, 0x00afaf], ['parrot', 0x0da70b, 0xff0000], ['bat', 0x4c3e30, 0x0f0f0f],
  ['iron_golem', 0xdbcdc1, 0x74a332], ['snow_golem', 0xd9f2f2, 0x81a4a4], ['dolphin', 0x223b4d, 0xf9f9f9],
  ['tropical_fish', 0xef6915, 0xfff9ef], ['pufferfish', 0xf6b201, 0x37c3f2], ['shark', 0x5e6b78, 0xe4e8ea],
  ['humpback_whale', 0x2f3a46, 0xb9c4cc], ['blue_whale', 0x5b7fa6, 0x9fb8cf], ['brown_bear', 0x6b4a2f, 0x3e2a1a],
  ['black_bear', 0x24211f, 0x8c6e4e], ['deer', 0xa47349, 0xefe4d0], ['moose', 0x4a3322, 0xb59e7a], ['boar', 0x5a4332, 0x2e2219],
  ['tiger', 0xe08a2e, 0x1e1a16], ['lion', 0xd4a55a, 0x8a5a2b], ['panda', 0xe7e7e7, 0x1b1b22], ['elephant', 0x8e8c8a, 0x5e5c5a],
  ['hippo', 0x7b6a72, 0xd69b9b], ['zebra', 0xf2f2f2, 0x1a1a1a], ['giraffe', 0xe6c27a, 0x8a5a2b], ['crocodile', 0x4e5b2e, 0x2e3a1a],
  ['camel', 0xfcc369, 0xcb9337], ['penguin', 0x1c1f24, 0xf3f3f3], ['robin', 0x6b5a48, 0xe06a2a], ['blue_jay', 0x3e78c8, 0xededed],
  ['cardinal', 0xc4202a, 0x2a1a1a], ['sparrow', 0x8a6a4a, 0xd8c8a8], ['goldfinch', 0xf2d23a, 0x1e1e1e], ['crow', 0x1e1e24, 0x4a4a5a],
  ['seagull', 0xf2f2f2, 0x9aa4ac], ['eagle', 0x4a3322, 0xf4f4f0], ['vulture', 0x2a2624, 0xd9a5a0], ['butterfly', 0xe8801e, 0x1e1e1e],
  ['bee', 0xedc343, 0x43241b], ['drowned', 0x8ff1d7, 0x799c65], ['witch', 0x340000, 0x51a03e], ['cave_spider', 0x0c424e, 0xa80e0e],
  ['phantom', 0x43518a, 0x88ff00],
];
// Every egg's creature, and its name ("Polar Bear").
export const EGG_TYPES = new Set(EGGS.map((e) => e[0]));
export const eggLabel = (type) => type.split('_').map((w) => w[0].toUpperCase() + w.slice(1)).join(' ');
