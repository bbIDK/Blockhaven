// Chunk-local light propagation, run right after generation (in a worker).
// Light is packed per cell: sky light in the high nibble, block light in the low nibble.
// Cross-chunk propagation and incremental updates happen on the main thread (see world.js).
import { CHUNK_VOLUME, HEIGHT } from './config.js';
import { OPAQUE, FILTER, EMIT } from './blocks.js';

const QSIZE = 1 << 17, QMASK = QSIZE - 1;
const queue = new Int32Array(QSIZE);

// Light reaching a neighbour through block `nid` from a cell at `level`.
// Full sky light travels straight down without loss through clear blocks.
export function nextLevel(level, nid, downSky) {
  const f = FILTER[nid];
  if (downSky && level === 15 && f === 0) return 15;
  return level - (f > 1 ? f : 1);
}

function flood(blocks, light, shift, head, tail) {
  const keep = shift ? 0x0f : 0xf0;
  while (head !== tail) {
    const i = queue[head++ & QMASK];
    const level = (light[i] >> shift) & 15;
    if (level <= 1) continue;
    const x = i & 15, z = (i >> 4) & 15, y = i >> 8;
    for (let d = 0; d < 6; d++) {
      let ni;
      if (d === 0) { if (x === 15) continue; ni = i + 1; }
      else if (d === 1) { if (x === 0) continue; ni = i - 1; }
      else if (d === 2) { if (y === HEIGHT - 1) continue; ni = i + 256; }
      else if (d === 3) { if (y === 0) continue; ni = i - 256; }
      else if (d === 4) { if (z === 15) continue; ni = i + 16; }
      else { if (z === 0) continue; ni = i - 16; }
      const nid = blocks[ni];
      if (OPAQUE[nid]) continue;
      const nl = nextLevel(level, nid, shift === 4 && d === 3);
      if (nl > ((light[ni] >> shift) & 15)) {
        light[ni] = (light[ni] & keep) | (nl << shift);
        queue[tail++ & QMASK] = ni;
      }
    }
  }
}

export function lightChunk(blocks, light) {
  light.fill(0);
  // Cells with an unobstructed view of the sky.
  for (let c = 0; c < 256; c++) {
    for (let y = HEIGHT - 1; y >= 0; y--) {
      const i = (y << 8) | c;
      if (FILTER[blocks[i]] !== 0) break;
      light[i] = 0xf0;
    }
  }
  let tail = 0;
  for (let i = 0; i < CHUNK_VOLUME; i++) {
    if (light[i] !== 0xf0) continue;
    const x = i & 15, z = (i >> 4) & 15, y = i >> 8;
    if ((x > 0 && light[i - 1] < 0xe0 && !OPAQUE[blocks[i - 1]]) ||
        (x < 15 && light[i + 1] < 0xe0 && !OPAQUE[blocks[i + 1]]) ||
        (z > 0 && light[i - 16] < 0xe0 && !OPAQUE[blocks[i - 16]]) ||
        (z < 15 && light[i + 16] < 0xe0 && !OPAQUE[blocks[i + 16]]) ||
        (y > 0 && light[i - 256] < 0xf0 && !OPAQUE[blocks[i - 256]])) {
      queue[tail++ & QMASK] = i;
    }
  }
  flood(blocks, light, 4, 0, tail);

  tail = 0;
  for (let i = 0; i < CHUNK_VOLUME; i++) {
    const e = EMIT[blocks[i]];
    if (e) { light[i] = (light[i] & 0xf0) | e; queue[tail++ & QMASK] = i; }
  }
  flood(blocks, light, 0, 0, tail);
}
