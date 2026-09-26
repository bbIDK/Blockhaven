// Work that runs off the main thread: chunk generation (+ chunk-local lighting) and section meshing.
import { CHUNK_VOLUME } from './config.js';
import { makeGenerator } from './worldgen.js';
import { lightChunk } from './light.js';
import { meshSection } from './mesher.js';

let gen = null, genKey = '';

export function runJob(job) {
  if (job.type === 'gen') {
    const key = `${job.seed}:${job.worldType}:${job.version}`;
    if (key !== genKey) { gen = makeGenerator(job.seed, job.worldType, job.version ?? 1); genKey = key; }
    const g = gen.generate(job.cx, job.cz);
    const blocks = job.saved ?? g.blocks;
    const light = new Uint8Array(CHUNK_VOLUME);
    lightChunk(blocks, light);
    return {
      result: { type: 'gen', id: job.id, cx: job.cx, cz: job.cz, blocks, light, climate: g.climate, biomes: g.biomes },
      transfer: [blocks.buffer, light.buffer, g.climate.buffer, g.biomes.buffer],
    };
  }
  if (job.type === 'mesh') {
    const m = meshSection(job.blocks, job.light, job.climate, job.cx, job.cz, job.biomes, job.tints, !!job.fast);
    return {
      result: { type: 'mesh', id: job.id, cx: job.cx, cz: job.cz, sy: job.sy, version: job.version, solid: m.solid, trans: m.trans,
        groups: m.groups, vis: m.vis },
      transfer: [m.solid.buffer, m.trans.buffer, m.groups.buffer],
    };
  }
  throw new Error(`Unknown job ${job.type}`);
}
