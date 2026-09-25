// Biome ids and names, and the colours of grass, leaves and water in each (grass and leaves follow
// temperature and rainfall within a biome, like Minecraft's colour maps).
// Ids are stored in chunks, so never renumber one; 0-12 are the first generator's.

export const BIOME = {
  OCEAN: 0, FROZEN_OCEAN: 1, RIVER: 2, BEACH: 3, PLAINS: 4, FOREST: 5, BIRCH_FOREST: 6,
  TAIGA: 7, SNOWY_TAIGA: 8, DESERT: 9, MOUNTAINS: 10, SNOWY_PEAKS: 11, FLAT: 12,
  SUNFLOWER_PLAINS: 13, FLOWER_FOREST: 14, DARK_FOREST: 15, OLD_GROWTH_BIRCH: 16, OLD_GROWTH_TAIGA: 17,
  SNOWY_PLAINS: 18, ICE_SPIKES: 19, SAVANNA: 20, BADLANDS: 21, JUNGLE: 22, SWAMP: 23, CHERRY_GROVE: 24,
  MEADOW: 25, STONY_PEAKS: 26, JAGGED_PEAKS: 27, FROZEN_PEAKS: 28, SNOWY_SLOPES: 29, STONY_SHORE: 30,
  DEEP_OCEAN: 31, WARM_OCEAN: 32, SNOWY_BEACH: 33, FROZEN_RIVER: 34, SPARSE_JUNGLE: 35, WINDSWEPT_FOREST: 36,
  NETHER_WASTES: 37, CRIMSON_FOREST: 38, WARPED_FOREST: 39, SOUL_SAND_VALLEY: 40, BASALT_DELTAS: 41,
};

export const BIOME_NAMES = [
  'Ocean', 'Frozen Ocean', 'River', 'Beach', 'Plains', 'Forest', 'Birch Forest',
  'Taiga', 'Snowy Taiga', 'Desert', 'Windswept Hills', 'Snowy Peaks', 'Flatlands',
  'Sunflower Plains', 'Flower Forest', 'Dark Forest', 'Old Growth Birch Forest', 'Old Growth Spruce Taiga',
  'Snowy Plains', 'Ice Spikes', 'Savanna', 'Badlands', 'Jungle', 'Swamp', 'Cherry Grove',
  'Meadow', 'Stony Peaks', 'Jagged Peaks', 'Frozen Peaks', 'Snowy Slopes', 'Stony Shore',
  'Deep Ocean', 'Warm Ocean', 'Snowy Beach', 'Frozen River', 'Sparse Jungle', 'Windswept Forest',
  'Nether Wastes', 'Crimson Forest', 'Warped Forest', 'Soul Sand Valley', 'Basalt Deltas',
];
export const isNetherBiome = (b) => b >= BIOME.NETHER_WASTES && b <= BIOME.BASALT_DELTAS;
// The haze that fills each of the Nether's biomes (the Nether has no sky), as 0..1 RGB.
export const NETHER_FOG = {
  [BIOME.NETHER_WASTES]: [0.2, 0.03, 0.03],
  [BIOME.CRIMSON_FOREST]: [0.2, 0.012, 0.012],
  [BIOME.WARPED_FOREST]: [0.1, 0.02, 0.1],
  [BIOME.SOUL_SAND_VALLEY]: [0.106, 0.278, 0.27],
  [BIOME.BASALT_DELTAS]: [0.408, 0.373, 0.439],
};

// Climate values are stored per column as bytes: 0..255 maps to -1..1.
export const toByte = (v) => Math.max(0, Math.min(255, Math.round((v + 1) * 127.5)));
export const fromByte = (b) => b / 127.5 - 1;

// Corner colours: [cold & dry, cold & wet, hot & dry, hot & wet]
const GRASS = [[0x86, 0xb7, 0x83], [0x6a, 0xa8, 0x6c], [0xc4, 0xb8, 0x5a], [0x5c, 0xc4, 0x3a]];
const FOLIAGE = [[0x68, 0xa0, 0x64], [0x4e, 0x92, 0x52], [0xa8, 0xa6, 0x3c], [0x3a, 0xb0, 0x28]];
// Water: deep blue in the cold, turquoise in the warm seas. The texture is pale, so these are
// divided by its brightness (0.72) to come out as the water colour itself.
const WATER = [[0x39, 0x38, 0xc9], [0x3d, 0x57, 0xd6], [0x43, 0xd5, 0xee], [0x3f, 0x9e, 0xe8]].map((c) => c.map((v) => Math.min(255, Math.round(v / 0.72))));

function bilinear(corners, temp, hum, out, o) {
  const t = Math.max(0, Math.min(1, (temp + 1) / 2));
  const h = Math.max(0, Math.min(1, (hum + 1) / 2));
  for (let c = 0; c < 3; c++) {
    const cold = corners[0][c] * (1 - h) + corners[1][c] * h;
    const hot = corners[2][c] * (1 - h) + corners[3][c] * h;
    out[o + c] = Math.round(cold * (1 - t) + hot * t);
  }
}
const set = (out, o, rgb, k = 1) => { out[o] = Math.min(255, Math.round(rgb[0] * k)); out[o + 1] = Math.min(255, Math.round(rgb[1] * k)); out[o + 2] = Math.min(255, Math.round(rgb[2] * k)); };
const hex = (c) => [(c >> 16) & 255, (c >> 8) & 255, c & 255];
const w = (c) => hex(c).map((v) => Math.min(255, Math.round(v / 0.72)));

// Biomes whose colours don't follow the climate map: [grass, foliage, water].
const FIXED = {
  [BIOME.SWAMP]: [hex(0x6a7039), hex(0x6a7039), w(0x4c6559)],
  [BIOME.DARK_FOREST]: [hex(0x507a32), hex(0x3f7a26), null],
  [BIOME.BADLANDS]: [hex(0x90814d), hex(0x9e814d), null],
  [BIOME.JUNGLE]: [hex(0x59c93c), hex(0x30bb0b), w(0x14a2c5)],
  [BIOME.SPARSE_JUNGLE]: [hex(0x64c73f), hex(0x3eb80f), w(0x14a2c5)],
  [BIOME.CHERRY_GROVE]: [hex(0xb6db61), hex(0xb6db61), w(0x5db7ef)],
  [BIOME.MEADOW]: [hex(0x83bb6d), hex(0x63a948), w(0x0e4ecf)],
  [BIOME.SAVANNA]: [hex(0xbfb755), hex(0xaea42a), null],
  [BIOME.WARM_OCEAN]: [null, null, w(0x43d5ee)],
  [BIOME.DEEP_OCEAN]: [null, null, w(0x3c52d6)],
};

export const grassColor = (temp, hum, out, o = 0) => bilinear(GRASS, temp, hum, out, o);
export const foliageColor = (temp, hum, out, o = 0) => bilinear(FOLIAGE, temp, hum, out, o);
export const waterColor = (temp, hum, out, o = 0) => bilinear(WATER, temp * 0.8, hum, out, o);

// Grass, foliage and water colours for one column, into three arrays at offset o.
export function columnColors(biome, temp, hum, grass, foliage, water, o) {
  grassColor(temp, hum, grass, o);
  foliageColor(temp, hum, foliage, o);
  waterColor(temp, hum, water, o);
  const f = FIXED[biome];
  if (!f) return;
  if (f[0]) set(grass, o, f[0]);
  if (f[1]) set(foliage, o, f[1]);
  if (f[2]) set(water, o, f[2]);
}
