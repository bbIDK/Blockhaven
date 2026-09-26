// World dimensions and shared constants. Chunk-local block index = (y << 8) | (z << 4) | x.
export const CHUNK = 16;
export const HEIGHT = 256;
export const SECTION = 16;
export const SECTIONS = HEIGHT / SECTION;
export const CHUNK_AREA = CHUNK * CHUNK;
export const CHUNK_VOLUME = CHUNK_AREA * HEIGHT;
export const SEA_LEVEL = 63;
// The world generator new worlds get (see WorldGen in worldgen.js).
export const LATEST_GEN = 9;

export const TICKS_PER_SECOND = 20;
export const TICKS_PER_DAY = 24000;

export const SAVE_VERSION = 2;
// A world's difficulty, 0-3 (meta.difficulty).
export const DIFFICULTIES = ['Peaceful', 'Easy', 'Normal', 'Hard'];

export const blockIndex = (x, y, z) => (y << 8) | (z << 4) | x;
export const chunkKey = (cx, cz) => ((cx & 0xffff) | ((cz & 0xffff) << 16)) >>> 0;
