// Biome ids, names and the grass/foliage colour maps (driven by per-column temperature and humidity).

export const BIOME = {
  OCEAN: 0, FROZEN_OCEAN: 1, RIVER: 2, BEACH: 3, PLAINS: 4, FOREST: 5, BIRCH_FOREST: 6,
  TAIGA: 7, SNOWY_TAIGA: 8, DESERT: 9, MOUNTAINS: 10, SNOWY_PEAKS: 11, FLAT: 12,
};

export const BIOME_NAMES = [
  'Ocean', 'Frozen Ocean', 'River', 'Beach', 'Plains', 'Forest', 'Birch Forest',
  'Taiga', 'Snowy Taiga', 'Desert', 'Mountains', 'Snowy Peaks', 'Flatlands',
];

// Climate values are stored per column as bytes: 0..255 maps to -1..1.
export const toByte = (v) => Math.max(0, Math.min(255, Math.round((v + 1) * 127.5)));
export const fromByte = (b) => b / 127.5 - 1;

// Corner colours: [cold & dry, cold & wet, hot & dry, hot & wet]
const GRASS = [[0x86, 0xb7, 0x83], [0x6a, 0xa8, 0x6c], [0xc4, 0xb8, 0x5a], [0x5c, 0xc4, 0x3a]];
const FOLIAGE = [[0x68, 0xa0, 0x64], [0x4e, 0x92, 0x52], [0xa8, 0xa6, 0x3c], [0x3a, 0xb0, 0x28]];

function bilinear(corners, temp, hum, out, o) {
  const t = Math.max(0, Math.min(1, (temp + 1) / 2));
  const h = Math.max(0, Math.min(1, (hum + 1) / 2));
  for (let c = 0; c < 3; c++) {
    const cold = corners[0][c] * (1 - h) + corners[1][c] * h;
    const hot = corners[2][c] * (1 - h) + corners[3][c] * h;
    out[o + c] = Math.round(cold * (1 - t) + hot * t);
  }
}

// Water: deep blue in the cold, turquoise in the warm seas. The texture is pale, so these are
// divided by its brightness (0.72) to come out as the water colour itself.
const WATER = [[0x39, 0x38, 0xc9], [0x3d, 0x57, 0xd6], [0x43, 0xd5, 0xee], [0x3f, 0x9e, 0xe8]].map((c) => c.map((v) => Math.min(255, Math.round(v / 0.72))));

export const grassColor = (temp, hum, out, o = 0) => bilinear(GRASS, temp, hum, out, o);
export const waterColor = (temp, hum, out, o = 0) => bilinear(WATER, temp * 0.8, hum, out, o);
export const foliageColor = (temp, hum, out, o = 0) => bilinear(FOLIAGE, temp, hum, out, o);
