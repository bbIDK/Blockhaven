// World dimensions and shared constants. Chunk-local block index = (y << 8) | (z << 4) | x.
export const CHUNK = 16;
export const HEIGHT = 128;
export const SECTION = 16;
export const SECTIONS = HEIGHT / SECTION;
export const CHUNK_AREA = CHUNK * CHUNK;
export const CHUNK_VOLUME = CHUNK_AREA * HEIGHT;
export const SEA_LEVEL = 60;

export const TICKS_PER_SECOND = 20;
export const TICKS_PER_DAY = 24000;

export const SAVE_VERSION = 1;

export const blockIndex = (x, y, z) => (y << 8) | (z << 4) | x;
export const chunkKey = (cx, cz) => ((cx & 0xffff) | ((cz & 0xffff) << 16)) >>> 0;
