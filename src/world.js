// The live world: chunk streaming around the player, block access, light updates, block ticks
// (flowing water, falling sand) and scheduling of section meshes.
import { CHUNK, HEIGHT, SECTIONS, chunkKey } from './config.js';
import {
  B, BLOCKS, OPAQUE, SOLID, FILTER, EMIT, RENDER, R, SELECTABLE, REPLACEABLE, TORCH_LEAN, FACE_DIRS,
  WATERLIKE, isWater, waterLevel, lavaLevel, WATER_FLOW_BASE, LAVA_FLOW_BASE, SHAPE, shapeBoxes, DOOR, doorId, LADDER_SIDE, BED,
  SPREAD, BURN,
} from './blocks.js';
import { nextLevel } from './light.js';
import { meshSection, P, P2, PADDED, ALL_OPEN } from './mesher.js';
import { JobPool } from './workers.js';
import { WorldGen } from './worldgen.js';

export const S_REQUESTED = 1, S_READY = 2;
const QSIZE = 1 << 16, QMASK = QSIZE - 1;

class Section {
  constructor() {
    this.dirty = true;
    this.version = 0;
    this.meshVersion = -1;
    this.pending = 0;
    this.count = 0;
    this.solid = null;
    this.trans = null;
    this.vis = ALL_OPEN; // which faces see each other through the section (cave culling)
    this._frame = -1;
  }
}

export class Chunk {
  constructor(cx, cz) {
    this.cx = cx;
    this.cz = cz;
    this.key = chunkKey(cx, cz);
    this.state = S_REQUESTED;
    this.blocks = null;
    this.light = null;
    this.climate = null;
    this.biomes = null;
    this.modified = false;
    this.sections = Array.from({ length: SECTIONS }, () => new Section());
    this.nb = [null, null, null, null]; // neighbours at +X, -X, +Z, -Z
  }
}

const NB_OFFSETS = [[1, 0], [-1, 0], [0, 1], [0, -1]];

const spiralCache = new Map();
function spiral(r) {
  if (!spiralCache.has(r)) {
    const out = [];
    const lim = (r + 0.5) * (r + 0.5);
    for (let dz = -r; dz <= r; dz++) for (let dx = -r; dx <= r; dx++) {
      const d2 = dx * dx + dz * dz;
      if (d2 <= lim) out.push([dx, dz, d2]);
    }
    out.sort((a, b) => a[2] - b[2]);
    spiralCache.set(r, out);
  }
  return spiralCache.get(r);
}

// Selection / collision shapes for non-cube blocks (fractions of a block).
const TORCH_BOUNDS = {
  [-1]: [0.4, 0, 0.4, 0.6, 0.62, 0.6],
  0: [0, 0.2, 0.35, 0.38, 0.8, 0.65], 1: [0.62, 0.2, 0.35, 1, 0.8, 0.65],
  4: [0.35, 0.2, 0, 0.65, 0.8, 0.38], 5: [0.35, 0.2, 0.62, 0.65, 0.8, 1],
};
export function blockBounds(id) {
  const rt = RENDER[id];
  if (rt === R.MODEL && SHAPE[id]) return unionBounds(SHAPE[id]);
  if (rt === R.CROSS) return [0.15, 0, 0.15, 0.85, 0.8, 0.85];
  if (rt === R.TORCH) return TORCH_BOUNDS[TORCH_LEAN[id]];
  if (rt === R.CACTUS) return [1 / 16, 0, 1 / 16, 15 / 16, 1, 15 / 16];
  if (rt === R.FIRE) return [0, 0, 0, 1, 0.9, 1];
  return null;
}

function unionBounds(boxes) {
  const u = [16, 16, 16, 0, 0, 0];
  for (const b of boxes) for (let i = 0; i < 3; i++) { u[i] = Math.min(u[i], b[i]); u[i + 3] = Math.max(u[i + 3], b[i + 3]); }
  return u.map((v) => v / 16);
}

const SOIL = new Set([B.grass_block, B.dirt, B.snowy_grass]);
const posKey = (x, y, z) => (x + 1048576) * 536870912 + (z + 1048576) * 256 + y;

export class World {
  constructor({ seed, type = 'default', renderer, store = null }) {
    this.seed = seed >>> 0;
    this.type = type;
    this.renderer = renderer;
    this.store = store;
    this.gen = new WorldGen(this.seed, this.type);
    this.chunks = new Map();
    this.pool = new JobPool((r) => this.onJobResult(r), () => this.onPoolFailure());
    this.center = null;
    this.radius = 6;
    this.scan = true; // something may need loading or meshing
    this.listener = null;
    // Multiplayer: a guest's copy of the world leaves block updates (water, sand, plants popping
    // off) to the host, and a host keeps the ground around its guests loaded (but not drawn).
    this.remote = false;
    this.keep = [];
    this.keepKey = '';
    this.keepChanged = false;
    this.tickNow = 0;
    this.ticks = new Map();
    this.fireAge = new Map(); // how long each fire has burned (by position)
    this._cache = null;
    this.qx = new Int32Array(QSIZE); this.qy = new Int32Array(QSIZE); this.qz = new Int32Array(QSIZE);
    this.qh = 0; this.qt = 0;
    this.rx = new Int32Array(QSIZE); this.ry = new Int32Array(QSIZE); this.rz = new Int32Array(QSIZE);
    this.rl = new Uint8Array(QSIZE);
    this.padB = new Uint16Array(PADDED);
    this.padL = new Uint8Array(PADDED);
  }

  dispose() {
    this.pool.terminate();
    for (const c of this.chunks.values()) this.freeChunkMeshes(c);
    this.chunks.clear();
  }

  // ------------------------------------------------------------------ access
  chunkAt(cx, cz) {
    const c = this._cache;
    if (c && c.cx === cx && c.cz === cz) return c;
    const found = this.chunks.get(chunkKey(cx, cz));
    if (found) this._cache = found;
    return found;
  }

  readyChunk(cx, cz) {
    const c = this.chunkAt(cx, cz);
    return c && c.state === S_READY ? c : null;
  }

  getBlock(x, y, z) {
    if (y < 0 || y >= HEIGHT) return 0;
    const c = this.chunkAt(x >> 4, z >> 4);
    if (!c || c.state !== S_READY) return 0;
    return c.blocks[(y << 8) | ((z & 15) << 4) | (x & 15)];
  }

  getLight(x, y, z) {
    if (y >= HEIGHT) return 0xf0;
    if (y < 0) return 0;
    const c = this.chunkAt(x >> 4, z >> 4);
    if (!c || c.state !== S_READY) return 0xf0;
    return c.light[(y << 8) | ((z & 15) << 4) | (x & 15)];
  }

  isLoaded(x, z) { return !!this.readyChunk(Math.floor(x) >> 4, Math.floor(z) >> 4); }

  biomeAt(x, z) {
    const c = this.readyChunk(x >> 4, z >> 4);
    return c ? c.biomes[((z & 15) << 4) | (x & 15)] : -1;
  }

  climateAt(x, z) {
    const c = this.readyChunk(x >> 4, z >> 4);
    if (!c) return [128, 128];
    const i = (((z & 15) << 4) | (x & 15)) * 2;
    return [c.climate[i], c.climate[i + 1]];
  }

  // Boxes (1/16 units) of a shaped block at (x, y, z), resolving fence/pane connections.
  boxesAt(x, y, z, id, collision = false) {
    return shapeBoxes(id, (f) => { const d = FACE_DIRS[f]; return this.getBlock(x + d[0], y + d[1], z + d[2]); }, collision);
  }

  // Outline of the block the player is looking at.
  selectionBox(x, y, z, id) {
    if (RENDER[id] === R.MODEL) return unionBounds(this.boxesAt(x, y, z, id));
    return blockBounds(id) ?? [0, 0, 0, 1, 1, 1];
  }

  // Opens or closes both halves of a door. Returns true if (x, y, z) was a door.
  toggleDoor(x, y, z) {
    const d = DOOR[this.getBlock(x, y, z)];
    if (!d) return false;
    const ly = d.upper ? y - 1 : y;
    if (!DOOR[this.getBlock(x, ly, z)] || !DOOR[this.getBlock(x, ly + 1, z)]) return false;
    this.setBlock(x, ly, z, doorId(d.facing, !d.open, false), { updates: false });
    this.setBlock(x, ly + 1, z, doorId(d.facing, !d.open, true), { updates: false });
    return true;
  }

  // Highest block in a column that stops rain (solid blocks, leaves, liquids), or -1. Cached per
  // column and forgotten when a block in that column changes.
  rainTop(x, z) {
    const c = this.readyChunk(x >> 4, z >> 4);
    if (!c) return HEIGHT;
    if (!c.rainTops) c.rainTops = new Int16Array(256).fill(-2);
    const col = ((z & 15) << 4) | (x & 15);
    let t = c.rainTops[col];
    if (t === -2) {
      t = -1;
      for (let y = HEIGHT - 1; y >= 0; y--) {
        const id = c.blocks[(y << 8) | col];
        if (id && (SOLID[id] || WATERLIKE[id])) { t = y; break; }
      }
      c.rainTops[col] = t;
    }
    return t;
  }

  // Highest non-air block in a column (or -1).
  topAt(x, z) {
    for (let y = HEIGHT - 1; y >= 0; y--) if (this.getBlock(x, y, z)) return y;
    return -1;
  }

  // ------------------------------------------------------------------ streaming
  // budgetMs: time allowed for applying finished chunks and meshes this frame.
  update(px, pz, radius, budgetMs = 4) {
    const pcx = Math.floor(px) >> 4, pcz = Math.floor(pz) >> 4;
    if (!this.center || this.center[0] !== pcx || this.center[1] !== pcz || radius !== this.radius || this.keepChanged) {
      this.center = [pcx, pcz];
      this.radius = radius;
      this.keepChanged = false;
      this.unloadFar();
      this.scan = true;
    }
    // A long backlog gets a bigger slice so it can't build up.
    this.pool.update(this.pool.queued > 24 ? budgetMs * 2 : budgetMs);
    if (this.scan) this.schedule(pcx, pcz, radius);
  }

  // Requests missing chunks and meshes dirty sections, nearest first, as workers become free.
  schedule(pcx, pcz, radius) {
    const r2 = (radius + 0.5) * (radius + 0.5);
    let slots = this.pool.freeSlots();
    let busy = slots <= 0;
    for (const [dx, dz, d2] of spiral(radius + 1)) {
      if (slots <= 0) { busy = true; break; }
      const cx = pcx + dx, cz = pcz + dz;
      const chunk = this.chunks.get(chunkKey(cx, cz));
      if (!chunk) { this.requestChunk(cx, cz); slots--; continue; }
      if (chunk.state !== S_READY || d2 > r2 || !this.neighborsReady(chunk)) continue;
      for (let sy = 0; sy < SECTIONS && slots > 0; sy++) {
        const sec = chunk.sections[sy];
        if (!sec.dirty) continue;
        if (sec.count === 0) {
          sec.dirty = false;
          sec.meshVersion = sec.version;
          sec.vis = ALL_OPEN;
          if (sec.solid || sec.trans) this.renderer.freeSection(sec);
          continue;
        }
        this.submitMesh(chunk, sy);
        slots--;
      }
      if (chunk.sections.some((sec) => sec.dirty)) busy = true;
    }
    // Around other players (multiplayer host): load only.
    for (const [kx, kz, r] of this.keep) {
      for (const [dx, dz] of spiral(r)) {
        if (this.chunks.has(chunkKey(kx + dx, kz + dz))) continue;
        if (slots <= 0) { busy = true; break; }
        this.requestChunk(kx + dx, kz + dz);
        slots--;
      }
    }
    // Nothing left to do: skip the scan until a chunk arrives or a block changes.
    if (!busy) this.scan = false;
  }

  // Multiplayer host: chunk columns [cx, cz, radius] to keep loaded around other players.
  setKeep(list) {
    const key = list.map((k) => k.join(',')).join(';');
    if (key === this.keepKey) return;
    this.keepKey = key;
    this.keep = list;
    this.keepChanged = true;
    this.scan = true;
  }

  // Fraction of chunks within `radius` of the centre that are meshed (loading screen).
  progress(radius) {
    if (!this.center) return 0;
    let total = 0, done = 0;
    for (const [dx, dz] of spiral(radius)) {
      total++;
      const c = this.chunks.get(chunkKey(this.center[0] + dx, this.center[1] + dz));
      if (c && c.state === S_READY && c.sections.every((s) => !s.dirty && !s.pending)) done++;
    }
    return done / total;
  }

  neighborsReady(chunk) {
    for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) {
      if (!dx && !dz) continue;
      const n = this.chunks.get(chunkKey(chunk.cx + dx, chunk.cz + dz));
      if (!n || n.state !== S_READY) return false;
    }
    return true;
  }

  // Neighbour links let the renderer walk between chunks without map lookups.
  link(chunk) {
    NB_OFFSETS.forEach(([dx, dz], i) => {
      const n = this.chunks.get(chunkKey(chunk.cx + dx, chunk.cz + dz)) ?? null;
      chunk.nb[i] = n;
      if (n) n.nb[i ^ 1] = chunk;
    });
  }

  unlink(chunk) {
    chunk.nb.forEach((n, i) => { if (n && n.nb[i ^ 1] === chunk) n.nb[i ^ 1] = null; });
    chunk.nb.fill(null);
  }

  requestChunk(cx, cz) {
    const chunk = new Chunk(cx, cz);
    this.chunks.set(chunk.key, chunk);
    this.link(chunk);
    const job = { type: 'gen', seed: this.seed, worldType: this.type, cx, cz, saved: null };
    if (this.store?.has(chunk.key)) {
      this.store.loadChunk(chunk.key).then((saved) => {
        if (this.chunks.get(chunk.key) !== chunk) return;
        job.saved = saved;
        this.pool.submit(job, saved ? [saved.buffer] : []);
      });
    } else {
      this.pool.submit(job, []);
    }
  }

  unloadFar() {
    const [pcx, pcz] = this.center;
    const lim = (this.radius + 3) * (this.radius + 3);
    for (const [key, c] of this.chunks) {
      const dx = c.cx - pcx, dz = c.cz - pcz;
      if (dx * dx + dz * dz <= lim) continue;
      if (this.keep.some(([kx, kz, r]) => (c.cx - kx) ** 2 + (c.cz - kz) ** 2 <= (r + 2) ** 2)) continue;
      if (c.state === S_READY && c.modified) this.store?.saveChunk(key, c.blocks);
      this.freeChunkMeshes(c);
      this.unlink(c);
      this.chunks.delete(key);
      if (this._cache === c) this._cache = null;
    }
  }

  freeChunkMeshes(c) {
    for (const s of c.sections) if (s.solid || s.trans) this.renderer.freeSection(s);
  }

  // Persist all modified chunks (autosave / quit).
  saveAll() {
    if (!this.store) return;
    for (const [key, c] of this.chunks) {
      if (c.state === S_READY && c.modified) {
        this.store.saveChunk(key, c.blocks);
        c.modified = false;
      }
    }
  }

  onPoolFailure() {
    // Jobs in flight were lost; request everything again on the main thread.
    this.scan = true;
    for (const [key, c] of this.chunks) {
      if (c.state !== S_READY) { this.unlink(c); this.chunks.delete(key); } else for (const s of c.sections) { if (s.pending) { s.pending = 0; s.dirty = true; } }
    }
    this._cache = null;
  }

  onJobResult(r) {
    this.scan = true;
    if (r.type === 'gen') this.onGen(r);
    else if (r.type === 'mesh') this.onMesh(r);
  }

  onGen(r) {
    const chunk = this.chunks.get(chunkKey(r.cx, r.cz));
    if (!chunk || chunk.state === S_READY) return;
    chunk.blocks = r.blocks;
    chunk.light = r.light;
    chunk.climate = r.climate;
    chunk.biomes = r.biomes;
    for (let sy = 0; sy < SECTIONS; sy++) {
      let n = 0;
      const end = (sy + 1) * 4096;
      for (let i = sy * 4096; i < end; i++) if (r.blocks[i]) n++;
      chunk.sections[sy].count = n;
    }
    chunk.state = S_READY;
    this.scan = true;
    this.exchangeBorderLight(chunk);
    this.listener?.chunkLoaded?.(chunk);
  }

  submitMesh(chunk, sy) {
    const sec = chunk.sections[sy];
    const blocks = new Uint16Array(PADDED), light = new Uint8Array(PADDED);
    this.buildPadded(chunk, sy, blocks, light);
    sec.dirty = false;
    sec.pending++;
    this.pool.submit({ type: 'mesh', cx: chunk.cx, cz: chunk.cz, sy, version: sec.version, blocks, light,
      climate: chunk.climate }, [blocks.buffer, light.buffer]);
  }

  onMesh(r) {
    const chunk = this.chunks.get(chunkKey(r.cx, r.cz));
    if (!chunk) return;
    const sec = chunk.sections[r.sy];
    sec.pending = Math.max(0, sec.pending - 1);
    if (r.version < sec.meshVersion) return;
    sec.meshVersion = r.version;
    sec.vis = r.vis;
    this.renderer.uploadSection(sec, chunk, r.sy, r.solid, r.trans, r.groups);
  }

  // Mesh a section right now on the main thread (used after the player edits a block).
  remeshNow(chunk, sy) {
    const sec = chunk.sections[sy];
    if (!sec.dirty || !this.neighborsReady(chunk)) return;
    sec.dirty = false;
    sec.meshVersion = sec.version;
    if (sec.count === 0) { sec.vis = ALL_OPEN; if (sec.solid || sec.trans) this.renderer.freeSection(sec); return; }
    this.buildPadded(chunk, sy, this.padB, this.padL);
    const m = meshSection(this.padB, this.padL, chunk.climate, chunk.cx, chunk.cz);
    sec.vis = m.vis;
    this.renderer.uploadSection(sec, chunk, sy, m.solid, m.trans, m.groups);
  }

  // Copies blocks and light of a section plus a one-block border from the neighbours.
  buildPadded(chunk, sy, outB, outL) {
    const nb = [];
    for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) {
      nb.push(dx || dz ? this.chunks.get(chunkKey(chunk.cx + dx, chunk.cz + dz)) : chunk);
    }
    const y0 = sy * 16 - 1;
    for (let py = 0; py < P; py++) {
      const y = y0 + py, row = py * P2;
      if (y < 0) { outB.fill(B.bedrock, row, row + P2); outL.fill(0, row, row + P2); continue; }
      if (y >= HEIGHT) { outB.fill(0, row, row + P2); outL.fill(0xf0, row, row + P2); continue; }
      for (let pz = 0; pz < P; pz++) {
        const lz = pz - 1, dz = lz < 0 ? 0 : lz > 15 ? 2 : 1;
        const src = (y << 8) | ((lz & 15) << 4);
        const w = nb[dz * 3], c = nb[dz * 3 + 1], e = nb[dz * 3 + 2];
        const o = row + pz * P;
        outB[o] = w.blocks[src + 15]; outL[o] = w.light[src + 15];
        outB.set(c.blocks.subarray(src, src + 16), o + 1);
        outL.set(c.light.subarray(src, src + 16), o + 1);
        outB[o + 17] = e.blocks[src]; outL[o + 17] = e.light[src];
      }
    }
  }

  // Marks every section whose padded copy contains (x, y, z).
  markDirty(x, y, z) {
    const lx = x & 15, lz = z & 15, ly = y & 15;
    const cx = x >> 4, cz = z >> 4, sy = y >> 4;
    for (let dz = lz === 0 ? -1 : 0; dz <= (lz === 15 ? 1 : 0); dz++) {
      for (let dx = lx === 0 ? -1 : 0; dx <= (lx === 15 ? 1 : 0); dx++) {
        const c = dx || dz ? this.chunks.get(chunkKey(cx + dx, cz + dz)) : this.chunkAt(cx, cz);
        if (!c) continue;
        for (let dy = ly === 0 ? -1 : 0; dy <= (ly === 15 ? 1 : 0); dy++) {
          const s = sy + dy;
          if (s < 0 || s >= SECTIONS) continue;
          const sec = c.sections[s];
          sec.dirty = true;
          sec.version++;
          this.scan = true;
        }
      }
    }
  }

  remeshAround(x, y, z) {
    const lx = x & 15, lz = z & 15, ly = y & 15;
    const cx = x >> 4, cz = z >> 4, sy = y >> 4;
    for (let dz = lz === 0 ? -1 : 0; dz <= (lz === 15 ? 1 : 0); dz++) {
      for (let dx = lx === 0 ? -1 : 0; dx <= (lx === 15 ? 1 : 0); dx++) {
        const c = this.readyChunk(cx + dx, cz + dz);
        if (!c) continue;
        for (let dy = ly === 0 ? -1 : 0; dy <= (ly === 15 ? 1 : 0); dy++) {
          const s = sy + dy;
          if (s >= 0 && s < SECTIONS) this.remeshNow(c, s);
        }
      }
    }
  }

  // ------------------------------------------------------------------ light
  push(x, y, z) {
    const t = this.qt++ & QMASK;
    this.qx[t] = x; this.qy[t] = y; this.qz[t] = z;
  }

  runIncrease() {
    while (this.qh !== this.qt) {
      const h = this.qh++ & QMASK;
      const x = this.qx[h], y = this.qy[h], z = this.qz[h];
      const c = this.readyChunk(x >> 4, z >> 4);
      if (!c) continue;
      const l = c.light[(y << 8) | ((z & 15) << 4) | (x & 15)];
      const sky = l >> 4, blk = l & 15;
      if (sky <= 1 && blk <= 1) continue;
      for (let d = 0; d < 6; d++) {
        const dir = FACE_DIRS[d];
        const nx = x + dir[0], ny = y + dir[1], nz = z + dir[2];
        if (ny < 0 || ny >= HEIGHT) continue;
        const nc = (nx >> 4) === (x >> 4) && (nz >> 4) === (z >> 4) ? c : this.readyChunk(nx >> 4, nz >> 4);
        if (!nc) continue;
        const ni = (ny << 8) | ((nz & 15) << 4) | (nx & 15);
        const nid = nc.blocks[ni];
        if (OPAQUE[nid]) continue;
        const nl = nc.light[ni];
        let ns = nl >> 4, nbl = nl & 15, changed = false;
        if (sky > 1) { const v = nextLevel(sky, nid, d === 3); if (v > ns) { ns = v; changed = true; } }
        if (blk > 1) { const v = nextLevel(blk, nid, false); if (v > nbl) { nbl = v; changed = true; } }
        if (changed) {
          nc.light[ni] = (ns << 4) | nbl;
          this.markDirty(nx, ny, nz);
          this.push(nx, ny, nz);
        }
      }
    }
  }

  // Removes one light channel (shift 4 = sky, 0 = block) spreading from (x, y, z); cells lit by
  // other sources are queued so runIncrease() can refill the darkened area.
  removeLight(x, y, z, shift) {
    const c0 = this.readyChunk(x >> 4, z >> 4);
    if (!c0) return;
    const i0 = (y << 8) | ((z & 15) << 4) | (x & 15);
    const level0 = (c0.light[i0] >> shift) & 15;
    if (!level0) return;
    const keep = shift ? 0x0f : 0xf0;
    c0.light[i0] &= keep;
    this.markDirty(x, y, z);
    let head = 0, tail = 0;
    this.rx[0] = x; this.ry[0] = y; this.rz[0] = z; this.rl[0] = level0; tail = 1;
    while (head !== tail) {
      const h = head++ & QMASK;
      const cx = this.rx[h], cy = this.ry[h], cz = this.rz[h], level = this.rl[h];
      for (let d = 0; d < 6; d++) {
        const dir = FACE_DIRS[d];
        const nx = cx + dir[0], ny = cy + dir[1], nz = cz + dir[2];
        if (ny < 0 || ny >= HEIGHT) continue;
        const nc = this.readyChunk(nx >> 4, nz >> 4);
        if (!nc) continue;
        const ni = (ny << 8) | ((nz & 15) << 4) | (nx & 15);
        const nl = (nc.light[ni] >> shift) & 15;
        if (!nl) continue;
        if (nl < level || (shift === 4 && d === 3 && level === 15 && nl === 15)) {
          nc.light[ni] &= keep;
          this.markDirty(nx, ny, nz);
          const t = tail++ & QMASK;
          this.rx[t] = nx; this.ry[t] = ny; this.rz[t] = nz; this.rl[t] = nl;
        } else {
          this.push(nx, ny, nz);
        }
      }
    }
  }

  relight(x, y, z, oldId, newId) {
    if (FILTER[newId] > FILTER[oldId]) this.removeLight(x, y, z, 4);
    if (FILTER[newId] > FILTER[oldId] || EMIT[oldId] > EMIT[newId]) this.removeLight(x, y, z, 0);
    const c = this.readyChunk(x >> 4, z >> 4);
    if (c && EMIT[newId]) {
      const i = (y << 8) | ((z & 15) << 4) | (x & 15);
      if ((c.light[i] & 15) < EMIT[newId]) c.light[i] = (c.light[i] & 0xf0) | EMIT[newId];
    }
    this.push(x, y, z);
    for (const d of FACE_DIRS) if (y + d[1] >= 0 && y + d[1] < HEIGHT) this.push(x + d[0], y + d[1], z + d[2]);
    this.runIncrease();
  }

  // After a chunk arrives, let light flow across its borders in both directions.
  exchangeBorderLight(chunk) {
    const x0 = chunk.cx * CHUNK, z0 = chunk.cz * CHUNK;
    const sides = [[1, 0], [-1, 0], [0, 1], [0, -1]];
    for (const [dx, dz] of sides) {
      const n = this.readyChunk(chunk.cx + dx, chunk.cz + dz);
      if (!n) continue;
      for (let t = 0; t < 16; t++) {
        const lx = dx === 1 ? 15 : dx === -1 ? 0 : t, lz = dz === 1 ? 15 : dz === -1 ? 0 : t;
        const nx = dx ? 15 - lx : lx, nz = dz ? 15 - lz : lz;
        for (let y = 0; y < HEIGHT; y++) {
          const a = chunk.light[(y << 8) | (lz << 4) | lx], b = n.light[(y << 8) | (nz << 4) | nx];
          if (a === b) continue;
          if ((a >> 4) > (b >> 4) + 1 || (a & 15) > (b & 15) + 1) this.push(x0 + lx, y, z0 + lz);
          if ((b >> 4) > (a >> 4) + 1 || (b & 15) > (a & 15) + 1) this.push(x0 + lx + dx, y, z0 + lz + dz);
        }
      }
    }
    this.runIncrease();
  }

  // ------------------------------------------------------------------ edits
  setBlock(x, y, z, id, { remesh = true, updates = true } = {}) {
    if (y < 0 || y >= HEIGHT) return false;
    const c = this.readyChunk(x >> 4, z >> 4);
    if (!c) return false;
    const i = (y << 8) | ((z & 15) << 4) | (x & 15);
    const old = c.blocks[i];
    if (old === id) return false;
    c.blocks[i] = id;
    c.modified = true;
    if (c.rainTops) c.rainTops[i & 255] = -2;
    c.sections[y >> 4].count += (id !== 0) - (old !== 0);
    this.markDirty(x, y, z);
    this.relight(x, y, z, old, id);
    if (remesh) this.remeshAround(x, y, z);
    this.listener?.blockChanged?.(x, y, z, old, id);
    if (updates) this.neighborsChanged(x, y, z);
    return true;
  }

  // Many edits at once (explosions): one light pass and async remeshing.
  setBlocksBulk(changes) {
    const applied = [];
    for (const [x, y, z, id] of changes) {
      if (y < 0 || y >= HEIGHT) continue;
      const c = this.readyChunk(x >> 4, z >> 4);
      if (!c) continue;
      const i = (y << 8) | ((z & 15) << 4) | (x & 15);
      const old = c.blocks[i];
      if (old === id) continue;
      c.blocks[i] = id;
      c.modified = true;
      if (c.rainTops) c.rainTops[i & 255] = -2;
      c.sections[y >> 4].count += (id !== 0) - (old !== 0);
      this.markDirty(x, y, z);
      applied.push([x, y, z, old, id]);
    }
    for (const [x, y, z, old, id] of applied) {
      if (FILTER[id] > FILTER[old]) this.removeLight(x, y, z, 4);
      if (FILTER[id] > FILTER[old] || EMIT[old] > EMIT[id]) this.removeLight(x, y, z, 0);
    }
    for (const [x, y, z, , id] of applied) {
      const c = this.readyChunk(x >> 4, z >> 4);
      if (EMIT[id]) {
        const i = (y << 8) | ((z & 15) << 4) | (x & 15);
        c.light[i] = (c.light[i] & 0xf0) | Math.max(c.light[i] & 15, EMIT[id]);
      }
      this.push(x, y, z);
      for (const d of FACE_DIRS) if (y + d[1] >= 0 && y + d[1] < HEIGHT) this.push(x + d[0], y + d[1], z + d[2]);
      if (this.qt - this.qh > QSIZE - 64) this.runIncrease();
    }
    this.runIncrease();
    for (const [x, y, z, old, id] of applied) {
      this.listener?.blockChanged?.(x, y, z, old, id);
      this.neighborsChanged(x, y, z);
    }
  }

  neighborsChanged(x, y, z) {
    if (this.remote) return;
    // Grass smothered by a solid block turns to dirt.
    if (OPAQUE[this.getBlock(x, y, z)] && y > 0) {
      const below = this.getBlock(x, y - 1, z);
      if (below === B.grass_block || below === B.snowy_grass) this.setBlock(x, y - 1, z, B.dirt);
    }
    this.checkBlock(x, y, z);
    for (const d of FACE_DIRS) this.checkBlock(x + d[0], y + d[1], z + d[2]);
  }

  // Reacts to a neighbour change: unsupported plants/torches pop off, liquids and sand get a tick.
  checkBlock(x, y, z) {
    const id = this.getBlock(x, y, z);
    if (!id) return;
    // Water spreads a block every 5 ticks, lava every 30 (Minecraft's speeds).
    if (WATERLIKE[id] === 1) { this.scheduleTick(x, y, z, 5); return; }
    if (WATERLIKE[id] === 2) { this.scheduleTick(x, y, z, 30); return; }
    if (id === B.fire) { this.scheduleTick(x, y, z, 30 + ((x * 7 + z * 13 + y) & 7)); return; }
    const def = BLOCKS[id];
    if (def.falls) { this.scheduleTick(x, y, z, 2); return; }
    if (def.support && !this.supported(x, y, z, id)) {
      this.setBlock(x, y, z, 0, { remesh: true });
      this.listener?.blockDropped?.(x, y, z, id);
    }
  }

  supported(x, y, z, id) {
    const below = this.getBlock(x, y - 1, z);
    switch (BLOCKS[id].support) {
      case 'soil': return SOIL.has(below);
      case 'sand': return below === B.sand || SOIL.has(below);
      case 'solid': return !!SOLID[below];
      case 'cane': return below === B.sugar_cane || below === B.sand || SOIL.has(below);
      case 'cactus': return below === B.sand || below === B.cactus;
      case 'bed': {
        const b = BED[id], d = FACE_DIRS[b.dir], s = b.head ? -1 : 1;
        const o = BED[this.getBlock(x + d[0] * s, y, z + d[2] * s)];
        return !!o && o.head !== b.head && o.dir === b.dir;
      }
      case 'door_lower': return !!SOLID[below] && !!DOOR[this.getBlock(x, y + 1, z)]?.upper;
      case 'door_upper': return !!DOOR[below] && !DOOR[below].upper;
      case 'ladder': {
        const d = FACE_DIRS[LADDER_SIDE[id]];
        return !!OPAQUE[this.getBlock(x + d[0], y, z + d[2])];
      }
      case 'torch': {
        const lean = TORCH_LEAN[id];
        if (lean < 0) return !!SOLID[below] && RENDER[below] === R.CUBE;
        const d = FACE_DIRS[lean];
        return !!OPAQUE[this.getBlock(x - d[0], y, z - d[2])];
      }
      default: return true;
    }
  }

  // ------------------------------------------------------------------ block ticks
  scheduleTick(x, y, z, delay) {
    const k = posKey(x, y, z);
    const due = this.tickNow + delay;
    const cur = this.ticks.get(k);
    if (cur === undefined || cur.due > due) this.ticks.set(k, { x, y, z, due });
  }

  tick() {
    this.tickNow++;
    if (this.remote || !this.ticks.size) return;
    const due = [];
    for (const [k, t] of this.ticks) {
      if (t.due <= this.tickNow) { due.push(t); this.ticks.delete(k); }
      if (due.length > 4000) break;
    }
    for (const t of due) {
      const id = this.getBlock(t.x, t.y, t.z);
      if (WATERLIKE[id] === 1) this.flowWater(t.x, t.y, t.z, id);
      else if (WATERLIKE[id] === 2) this.flowLava(t.x, t.y, t.z, id);
      else if (id === B.fire) this.fireTick(t.x, t.y, t.z);
      else if (BLOCKS[id]?.falls) this.fall(t.x, t.y, t.z, id);
    }
  }

  // Sand and gravel with nothing under them come loose and fall as a moving block (an entity
  // that lands and becomes a block again). Without a listener to make one, they just drop.
  fall(x, y, z, id) {
    const below = this.getBlock(x, y - 1, z);
    if (y > 0 && (below === 0 || (REPLACEABLE[below] && WATERLIKE[below] !== 2) || RENDER[below] === R.CROSS || below === B.fire)) {
      if (this.listener?.spawnFalling) {
        this.setBlock(x, y, z, 0, { remesh: true });
        this.listener.spawnFalling(x, y, z, id);
        return;
      }
      this.setBlock(x, y, z, 0, { remesh: false });
      this.setBlock(x, y - 1, z, id, { remesh: false });
      this.scheduleTick(x, y - 1, z, 2);
    }
  }

  // ------------------------------------------------------------------ fire
  // Like Minecraft's: fire needs something solid under it or something flammable beside it,
  // burns flammable neighbours away (sometimes into more fire), jumps to nearby spots next to
  // flammable blocks, and goes out after a while on anything that doesn't burn. Rain puts it
  // out under the open sky.
  flammableAround(x, y, z) {
    for (const d of FACE_DIRS) if (SPREAD[this.getBlock(x + d[0], y + d[1], z + d[2])]) return true;
    return false;
  }

  canBurnAt(x, y, z) {
    const id = this.getBlock(x, y, z);
    return (id === 0 || id === B.tall_grass) && (SOLID[this.getBlock(x, y - 1, z)] || this.flammableAround(x, y, z));
  }

  // Lights a fire at (x, y, z) if it can burn there. Returns true if it did.
  ignite(x, y, z) {
    if (y < 1 || y >= HEIGHT - 1 || !this.canBurnAt(x, y, z)) return false;
    if (!this.setBlock(x, y, z, B.fire)) return false;
    this.fireAge.set(posKey(x, y, z), 0);
    return true;
  }

  fireTick(x, y, z) {
    const key = posKey(x, y, z);
    const out = () => { this.fireAge.delete(key); this.setBlock(x, y, z, 0); };
    const below = this.getBlock(x, y - 1, z);
    if (this.listener?.rainingOn?.(x, y, z) && Math.random() < 0.6) { out(); this.listener?.fizz?.(x, y, z); return; }
    const nearFuel = this.flammableAround(x, y, z);
    if (!SOLID[below] && !nearFuel) { out(); return; }
    let age = this.fireAge.get(key) ?? 0;
    age = Math.min(15, age + (Math.random() < 0.5 ? 1 : 0) + (Math.random() < 0.3 ? 1 : 0));
    this.fireAge.set(key, age);
    // On something that doesn't burn, a fire dies down after a while.
    if (!nearFuel && age > 3 && Math.random() < 0.3) { out(); return; }
    if (!SPREAD[below] && age >= 15 && Math.random() < 0.25) { out(); return; }
    // Burn the blocks around it.
    for (let f = 0; f < 6; f++) {
      const d = FACE_DIRS[f];
      this.burn(x + d[0], y + d[1], z + d[2], f === 2 || f === 3 ? 250 : 300, age);
    }
    // Jump to nearby spots beside something flammable (mostly upwards, like real flames).
    for (let dy = -1; dy <= 4; dy++) {
      for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) {
        if (!dx && !dy && !dz) continue;
        const nx = x + dx, ny = y + dy, nz = z + dz;
        if (this.getBlock(nx, ny, nz) !== 0) continue;
        let odds = 0;
        for (const e of FACE_DIRS) odds = Math.max(odds, SPREAD[this.getBlock(nx + e[0], ny + e[1], nz + e[2])]);
        if (!odds) continue;
        const chance = (odds + 40) / (30 + age) / (dy > 1 ? 100 + (dy - 1) * 100 : 100);
        if (Math.random() < chance) this.ignite(nx, ny, nz);
      }
    }
    this.scheduleTick(x, y, z, 30 + Math.floor(Math.random() * 10));
  }

  burn(x, y, z, odds, age) {
    const id = this.getBlock(x, y, z);
    if (!BURN[id] || Math.random() * odds >= BURN[id]) return;
    if (id === B.tnt) { this.setBlock(x, y, z, 0); this.listener?.igniteTNT?.(x, y, z); return; }
    // Burned away: sometimes it keeps burning where it was.
    if (Math.random() * (age + 10) < 5) { this.setBlock(x, y, z, B.fire); this.fireAge.set(posKey(x, y, z), age); }
    else this.setBlock(x, y, z, 0);
  }

  // Random ticks, as Minecraft has them: a few blocks per section, picked at random each tick,
  // around every player (`centres`: [cx, cz] chunk columns). Lava sets fire to things near it.
  randomTicks(centres, radius = 6) {
    if (this.remote) return;
    const seen = new Set();
    for (const [pcx, pcz] of centres) {
      for (let cz = pcz - radius; cz <= pcz + radius; cz++) for (let cx = pcx - radius; cx <= pcx + radius; cx++) {
        const c = this.readyChunk(cx, cz);
        if (!c || seen.has(c.key)) continue;
        seen.add(c.key);
        for (let sy = 0; sy < SECTIONS; sy++) {
          if (!c.sections[sy].count) continue;
          for (let k = 0; k < 3; k++) {
            const r = (Math.random() * 4096) | 0;
            const lx = r & 15, lz = (r >> 4) & 15, ly = (sy << 4) | (r >> 8);
            const id = c.blocks[(ly << 8) | (lz << 4) | lx];
            if (WATERLIKE[id] === 2) this.lavaSpark(cx * 16 + lx, ly, cz * 16 + lz);
          }
        }
      }
    }
  }

  lavaSpark(x, y, z) {
    const n = Math.floor(Math.random() * 3);
    let px = x, py = y, pz = z;
    for (let i = 0; i < n; i++) {
      px += Math.floor(Math.random() * 3) - 1; py++; pz += Math.floor(Math.random() * 3) - 1;
      const id = this.getBlock(px, py, pz);
      if (id === 0) { if (this.flammableAround(px, py, pz)) { this.ignite(px, py, pz); return; } }
      else if (SOLID[id]) return;
    }
    if (n === 0) {
      for (let i = 0; i < 3; i++) {
        const tx = x + Math.floor(Math.random() * 3) - 1, tz = z + Math.floor(Math.random() * 3) - 1;
        if (this.getBlock(tx, y + 1, tz) === 0 && SPREAD[this.getBlock(tx, y, tz)]) this.ignite(tx, y + 1, tz);
      }
    }
  }

  // ------------------------------------------------------------------ lava
  // Flows like water but slowly (every 30 ticks) and three blocks at most across flat ground.
  // Where it meets water it hardens: a still pool into obsidian, a flow into cobblestone, and
  // lava pouring onto water turns the water to stone.
  flowLava(x, y, z, id) {
    let level = lavaLevel(id);
    for (let d = 0; d < 6; d++) {
      if (d === 3) continue;
      const dir = FACE_DIRS[d];
      if (WATERLIKE[this.getBlock(x + dir[0], y + dir[1], z + dir[2])] === 1) {
        this.setBlock(x, y, z, level === 0 ? B.obsidian : B.cobblestone);
        this.listener?.fizz?.(x, y, z);
        return;
      }
    }
    if (level > 0) {
      const above = this.getBlock(x, y + 1, z);
      let want;
      if (WATERLIKE[above] === 2) want = 8;
      else {
        let best = 99;
        for (let d = 0; d < 6; d++) {
          if (d === 2 || d === 3) continue;
          const dir = FACE_DIRS[d];
          const nl = lavaLevel(this.getBlock(x + dir[0], y, z + dir[2]));
          if (nl < 0) continue;
          best = Math.min(best, nl === 8 ? 0 : nl);
        }
        want = best + 2 <= 7 ? best + 2 : -1;
      }
      if (want !== level) {
        this.setBlock(x, y, z, want < 0 ? 0 : want === 0 ? B.lava : LAVA_FLOW_BASE - 1 + want, { remesh: false });
        if (want < 0) return;
        level = want;
      }
    }
    const below = this.getBlock(x, y - 1, z);
    if (y > 0 && WATERLIKE[below] === 1) { this.setBlock(x, y - 1, z, B.stone, { remesh: false }); this.listener?.fizz?.(x, y - 1, z); return; }
    if (y > 0 && this.canFlowInto(below)) {
      this.breakFor(x, y - 1, z, below);
      this.setBlock(x, y - 1, z, LAVA_FLOW_BASE + 7, { remesh: false });
      return;
    }
    if (y > 0 && lavaLevel(below) >= 0 && level !== 0) return;
    const spread = level === 8 ? 2 : level + 2;
    if (spread > 7) return;
    for (let d = 0; d < 6; d++) {
      if (d === 2 || d === 3) continue;
      const dir = FACE_DIRS[d];
      const nx = x + dir[0], nz = z + dir[2];
      const n = this.getBlock(nx, y, nz);
      if (WATERLIKE[n] === 1) continue;
      if (this.canFlowInto(n)) {
        this.breakFor(nx, y, nz, n);
        this.setBlock(nx, y, nz, LAVA_FLOW_BASE - 1 + spread, { remesh: false });
      } else {
        const nl = lavaLevel(n);
        if (nl > spread && nl !== 8) this.setBlock(nx, y, nz, LAVA_FLOW_BASE - 1 + spread, { remesh: false });
      }
    }
  }

  canFlowInto(id) {
    return id === 0 || (REPLACEABLE[id] && !WATERLIKE[id]) || RENDER[id] === R.CROSS || RENDER[id] === R.TORCH;
  }

  flowWater(x, y, z, id) {
    let level = waterLevel(id);
    // Flowing water must be fed by a neighbour with a lower level, or by water above.
    if (level > 0) {
      const above = this.getBlock(x, y + 1, z);
      let want;
      if (isWater(above)) want = 8;
      else {
        let best = 99, sources = 0;
        for (let d = 0; d < 6; d++) {
          if (d === 2 || d === 3) continue;
          const dir = FACE_DIRS[d];
          const nl = waterLevel(this.getBlock(x + dir[0], y, z + dir[2]));
          if (nl < 0) continue;
          if (nl === 0) sources++;
          best = Math.min(best, nl === 8 ? 0 : nl);
        }
        const below = this.getBlock(x, y - 1, z);
        if (sources >= 2 && (OPAQUE[below] || waterLevel(below) === 0)) want = 0;
        else want = best + 1 <= 7 ? best + 1 : -1;
      }
      if (want !== level) {
        this.setBlock(x, y, z, want < 0 ? 0 : want === 0 ? B.water : WATER_FLOW_BASE - 1 + want, { remesh: false });
        if (want < 0) return;
        level = want;
      }
    }
    // Spread: down first; sideways only when resting on something.
    const below = this.getBlock(x, y - 1, z);
    if (y > 0 && WATERLIKE[below] === 2) { this.setBlock(x, y - 1, z, B.obsidian, { remesh: false }); this.listener?.fizz?.(x, y - 1, z); return; }
    if (y > 0 && this.canFlowInto(below)) {
      this.breakFor(x, y - 1, z, below);
      this.setBlock(x, y - 1, z, WATER_FLOW_BASE + 7, { remesh: false });
      return;
    }
    if (y > 0 && waterLevel(below) >= 0 && level !== 0) return;
    const spread = level === 8 ? 1 : level + 1;
    if (spread > 7) return;
    for (let d = 0; d < 6; d++) {
      if (d === 2 || d === 3) continue;
      const dir = FACE_DIRS[d];
      const nx = x + dir[0], nz = z + dir[2];
      const n = this.getBlock(nx, y, nz);
      if (WATERLIKE[n] === 2) {
        this.setBlock(nx, y, nz, n === B.lava ? B.obsidian : B.cobblestone, { remesh: false });
        this.listener?.fizz?.(nx, y, nz);
        continue;
      }
      if (this.canFlowInto(n)) {
        this.breakFor(nx, y, nz, n);
        this.setBlock(nx, y, nz, WATER_FLOW_BASE - 1 + spread, { remesh: false });
      } else {
        const nl = waterLevel(n);
        if (nl > spread && nl !== 8) this.setBlock(nx, y, nz, WATER_FLOW_BASE - 1 + spread, { remesh: false });
      }
    }
  }

  breakFor(x, y, z, id) {
    if (id && RENDER[id] !== R.LIQUID && id !== B.fire) this.listener?.blockDropped?.(x, y, z, id);
  }

  // ------------------------------------------------------------------ queries
  // Voxel ray cast (Amanatides & Woo). Returns the first selectable block hit.
  raycast(ox, oy, oz, dx, dy, dz, maxDist) {
    let x = Math.floor(ox), y = Math.floor(oy), z = Math.floor(oz);
    const sx = dx > 0 ? 1 : -1, sy = dy > 0 ? 1 : -1, sz = dz > 0 ? 1 : -1;
    const tdx = dx ? Math.abs(1 / dx) : Infinity, tdy = dy ? Math.abs(1 / dy) : Infinity, tdz = dz ? Math.abs(1 / dz) : Infinity;
    let tx = dx ? (dx > 0 ? x + 1 - ox : ox - x) * tdx : Infinity;
    let ty = dy ? (dy > 0 ? y + 1 - oy : oy - y) * tdy : Infinity;
    let tz = dz ? (dz > 0 ? z + 1 - oz : oz - z) * tdz : Infinity;
    let face = -1, t = 0;
    for (let steps = 0; steps < 256 && t <= maxDist; steps++) {
      const id = this.getBlock(x, y, z);
      if (id && SELECTABLE[id]) {
        if (RENDER[id] === R.MODEL) {
          let best = null;
          for (const b of this.boxesAt(x, y, z, id)) {
            const hit = rayBox(ox - x, oy - y, oz - z, dx, dy, dz, b.map((v) => v / 16));
            if (hit && hit.t <= maxDist && (!best || hit.t < best.t)) best = hit;
          }
          if (best) return { x, y, z, id, face: best.face, t: best.t };
        } else {
          const bb = blockBounds(id);
          if (!bb) return { x, y, z, id, face, t };
          const hit = rayBox(ox - x, oy - y, oz - z, dx, dy, dz, bb);
          if (hit && hit.t <= maxDist) return { x, y, z, id, face: hit.face, t: hit.t };
        }
      }
      if (tx < ty && tx < tz) { x += sx; t = tx; tx += tdx; face = sx > 0 ? 1 : 0; }
      else if (ty < tz) { y += sy; t = ty; ty += tdy; face = sy > 0 ? 3 : 2; }
      else { z += sz; t = tz; tz += tdz; face = sz > 0 ? 5 : 4; }
    }
    return null;
  }

  // Solid-block boxes overlapping an AABB (for physics).
  // Cells below are checked too because fences are 1.5 blocks tall.
  collides(x0, y0, z0, x1, y1, z1) {
    for (let y = Math.floor(y0 - 0.5); y <= Math.floor(y1 - 1e-9); y++) {
      for (let z = Math.floor(z0); z <= Math.floor(z1 - 1e-9); z++) {
        for (let x = Math.floor(x0); x <= Math.floor(x1 - 1e-9); x++) {
          const id = this.getBlock(x, y, z);
          if (!SOLID[id]) continue;
          const rt = RENDER[id];
          if (rt === R.CACTUS) {
            if (y1 > y && y0 < y + 1 && x0 < x + 15 / 16 && x1 > x + 1 / 16 && z0 < z + 15 / 16 && z1 > z + 1 / 16) return true;
            continue;
          }
          if (rt === R.MODEL) {
            for (const b of this.boxesAt(x, y, z, id, true)) {
              if (x0 < x + b[3] / 16 && x1 > x + b[0] / 16 && y0 < y + b[4] / 16 && y1 > y + b[1] / 16 &&
                  z0 < z + b[5] / 16 && z1 > z + b[2] / 16) return true;
            }
            continue;
          }
          if (y1 > y && y0 < y + 1) return true;
        }
      }
    }
    return false;
  }

  // Is the box touching a ladder (for climbing)?
  touchesClimbable(x0, y0, z0, x1, y1, z1) {
    for (let y = Math.floor(y0); y <= Math.floor(y1 - 1e-9); y++)
      for (let z = Math.floor(z0); z <= Math.floor(z1 - 1e-9); z++)
        for (let x = Math.floor(x0); x <= Math.floor(x1 - 1e-9); x++)
          if (LADDER_SIDE[this.getBlock(x, y, z)] !== undefined) return true;
    return false;
  }
}

// Ray vs box (in block-local coordinates). Returns entry distance and the face that was hit.
export function rayBox(ox, oy, oz, dx, dy, dz, b) {
  let tmin = -Infinity, tmax = Infinity, face = -1;
  const o = [ox, oy, oz], d = [dx, dy, dz];
  for (let a = 0; a < 3; a++) {
    const lo = b[a], hi = b[a + 3];
    if (Math.abs(d[a]) < 1e-9) {
      if (o[a] < lo || o[a] > hi) return null;
      continue;
    }
    let t1 = (lo - o[a]) / d[a], t2 = (hi - o[a]) / d[a];
    let f = a * 2 + 1;
    if (t1 > t2) { const tt = t1; t1 = t2; t2 = tt; f = a * 2; }
    if (t1 > tmin) { tmin = t1; face = f; }
    if (t2 < tmax) tmax = t2;
    if (tmin > tmax) return null;
  }
  if (tmax < 0) return null;
  // Entering through the low side of axis a hits face a*2+1 (-a); the high side hits a*2 (+a).
  return { t: Math.max(0, tmin), face };
}
