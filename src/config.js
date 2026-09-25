// World dimensions and shared constants. Chunk-local block index = (y << 8) | (z << 4) | x.
export const CHUNK = 16;
export const HEIGHT = 256;
export const SECTION = 16;
export const SECTIONS = HEIGHT / SECTION;
export const CHUNK_AREA = CHUNK * CHUNK;
export const CHUNK_VOLUME = CHUNK_AREA * HEIGHT;
export const SEA_LEVEL = 63;

export const TICKS_PER_SECOND = 20;
export const TICKS_PER_DAY = 24000;

export const SAVE_VERSION = 2;

export const blockIndex = (x, y, z) => (y << 8) | (z << 4) | x;
export const chunkKey = (cx, cz) => ((cx & 0xffff) | ((cz & 0xffff) << 16)) >>> 0;

// The Nether is a region of the same world, far to the east: every chunk from NETHER_CX on is
// Nether (the overworld never reaches that far). Its x = 0 is at NETHER_X, and a step there is
// eight in the overworld. It is NETHER_TOP high, walled in by bedrock above and below.
export const NETHER_CX = 20000;
export const NETHER_X = 400000;
export const NETHER_TOP = 128;
export const NETHER_SCALE = 8;
export const inNether = (x) => x >= NETHER_CX * CHUNK;
