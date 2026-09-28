// World dimensions and shared constants. The world runs from y MIN_Y (-64) up to MAX_Y (320, not
// included), 384 blocks as in Minecraft; a chunk keeps its blocks from the bottom up, so the
// chunk-local block index is ((y - MIN_Y) << 8) | (z << 4) | x (see blockIndex).
export const CHUNK = 16;
export const MIN_Y = -64;
export const MAX_Y = 320;
export const CHUNK_HEIGHT = MAX_Y - MIN_Y;
export const SECTION = 16;
export const SECTIONS = CHUNK_HEIGHT / SECTION;
export const CHUNK_AREA = CHUNK * CHUNK;
export const CHUNK_VOLUME = CHUNK_AREA * CHUNK_HEIGHT;
// Worlds made before Update 31 were 256 blocks tall, from y 0: their generators still make chunks
// that size, which go in at y 0 (see jobs.js), and their saved chunks are read that way (storage.js).
export const LEGACY_HEIGHT = 256;
export const LEGACY_VOLUME = CHUNK_AREA * LEGACY_HEIGHT;
export const LEGACY_BASE = -MIN_Y << 8;
// A section's index from a y, and the y its bottom is at.
export const sectionOf = (y) => (y - MIN_Y) >> 4;
export const sectionY = (sy) => (sy << 4) + MIN_Y;
// "No block in this column" (below the world), and "not worked out yet".
export const NO_Y = MIN_Y - 1;
export const UNKNOWN_Y = -32768;
export const SEA_LEVEL = 63;
// The world generator new worlds get (see WorldGen in worldgen.js).
export const LATEST_GEN = 12;

export const TICKS_PER_SECOND = 20;
export const TICKS_PER_DAY = 24000;

export const SAVE_VERSION = 3;
// A world's difficulty, 0-3 (meta.difficulty).
export const DIFFICULTIES = ['Peaceful', 'Easy', 'Normal', 'Hard'];

export const blockIndex = (x, y, z) => ((y - MIN_Y) << 8) | (z << 4) | x;
export const chunkKey = (cx, cz) => ((cx & 0xffff) | ((cz & 0xffff) << 16)) >>> 0;
