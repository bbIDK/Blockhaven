// Block-break particles: small textured squares with gravity, drawn as camera-facing quads in the
// terrain vertex format (so they share the terrain shader and lighting).
import { STRIDE } from './mesher.js';
import { TEXL, FFLAGS, TINT, TINT_RGB, SOLID, F_TINT, F_OVERLAY } from './blocks.js';
import { TEX } from './textures.js';

const MAX = 600;
const DEFAULT_TINT = { 1: [124, 189, 84], 2: [96, 168, 64] };

export class Particles {
  constructor() {
    this.list = [];
    this.u8 = new Uint8Array(MAX * 4 * STRIDE);
    this.u16 = new Uint16Array(this.u8.buffer);
    this.count = 0;
    this.base = [0, 0, 0];
  }

  spawn(x, y, z, vx, vy, vz, blockId, face, life, size) {
    if (this.list.length >= MAX) this.list.shift();
    const f = face ?? 0;
    const flags = FFLAGS[blockId * 6 + f];
    const tintType = TINT[blockId];
    let tint = [255, 255, 255];
    if ((flags & (F_TINT | F_OVERLAY)) && tintType) tint = tintType === 3 ? [...TINT_RGB.subarray(blockId * 3, blockId * 3 + 3)] : DEFAULT_TINT[tintType];
    const u = Math.floor(Math.random() * 12), v = Math.floor(Math.random() * 12);
    this.list.push({
      x, y, z, vx, vy, vz, life, age: 0, size,
      layer: TEXL[blockId * 6 + f] + ((flags & F_OVERLAY) && Math.random() < 0.3 ? 1 : 0),
      flags: flags & F_TINT ? F_TINT : 0, tint, u, v,
    });
  }

  // Burst of fragments when a block breaks.
  burst(x, y, z, blockId) {
    for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) for (let k = 0; k < 4; k++) {
      if (Math.random() < 0.55) continue;
      const px = x + (i + 0.5) / 4, py = y + (j + 0.5) / 4, pz = z + (k + 0.5) / 4;
      this.spawn(px, py, pz, (px - x - 0.5) * 3 + (Math.random() - 0.5), (py - y - 0.5) * 2 + 1.8 + Math.random() * 1.5,
        (pz - z - 0.5) * 3 + (Math.random() - 0.5), blockId, j > 2 ? 2 : 0, 0.5 + Math.random() * 0.7, 0.07 + Math.random() * 0.05);
    }
  }

  // Bits of a texture (food crumbs, critical-hit sparks).
  bits(x, y, z, layer, n, speed = 1.5, life = 0.6) {
    for (let i = 0; i < n; i++) {
      if (this.list.length >= MAX) this.list.shift();
      this.list.push({
        x, y, z, vx: (Math.random() - 0.5) * speed * 2, vy: Math.random() * speed * 1.4, vz: (Math.random() - 0.5) * speed * 2,
        life: life * (0.6 + Math.random() * 0.8), age: 0, size: 0.05 + Math.random() * 0.04, layer, flags: 0,
        tint: [255, 255, 255], u: 4 + Math.floor(Math.random() * 8), v: 4 + Math.floor(Math.random() * 8),
      });
    }
  }

  // Grey puffs that drift up and shrink away.
  smoke(x, y, z, n = 8, spread = 0.4) {
    for (let i = 0; i < n; i++) {
      if (this.list.length >= MAX) this.list.shift();
      const g = 190 + Math.floor(Math.random() * 60);
      this.list.push({
        x: x + (Math.random() - 0.5) * spread * 2, y: y + (Math.random() - 0.5) * spread, z: z + (Math.random() - 0.5) * spread * 2,
        vx: (Math.random() - 0.5) * 0.8, vy: 0.3 + Math.random() * 0.7, vz: (Math.random() - 0.5) * 0.8,
        life: 0.5 + Math.random() * 0.6, age: 0, size: 0.16 + Math.random() * 0.16,
        layer: TEX.smoke, flags: 0, tint: [g, g, g], u: 0, v: 0, smoke: true,
      });
    }
  }

  // A few chips flying off the face being mined.
  chip(x, y, z, face, blockId) {
    const n = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]][face] ?? [0, 1, 0];
    for (let i = 0; i < 2; i++) {
      const px = x + 0.5 + n[0] * 0.52 + (n[0] ? 0 : Math.random() - 0.5);
      const py = y + 0.5 + n[1] * 0.52 + (n[1] ? 0 : Math.random() - 0.5);
      const pz = z + 0.5 + n[2] * 0.52 + (n[2] ? 0 : Math.random() - 0.5);
      this.spawn(px, py, pz, n[0] * 1.5 + (Math.random() - 0.5), 1 + Math.random(), n[2] * 1.5 + (Math.random() - 0.5), blockId, face, 0.35 + Math.random() * 0.3, 0.05 + Math.random() * 0.04);
    }
  }

  update(dt, world) {
    const list = this.list;
    for (let i = list.length - 1; i >= 0; i--) {
      const p = list[i];
      p.age += dt;
      if (p.age > p.life) { list.splice(i, 1); continue; }
      if (p.smoke) {
        const k = Math.exp(-1.5 * dt);
        p.vx *= k; p.vz *= k; p.vy = p.vy * k + 0.6 * dt;
        p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
        continue;
      }
      p.vy -= 18 * dt;
      p.vx *= Math.exp(-2 * dt);
      p.vz *= Math.exp(-2 * dt);
      const nx = p.x + p.vx * dt, ny = p.y + p.vy * dt, nz = p.z + p.vz * dt;
      if (SOLID[world.getBlock(Math.floor(p.x), Math.floor(ny - p.size), Math.floor(p.z))]) { p.vy = 0; p.vx *= 0.6; p.vz *= 0.6; } else p.y = ny;
      if (!SOLID[world.getBlock(Math.floor(nx), Math.floor(p.y), Math.floor(p.z))]) p.x = nx; else p.vx = 0;
      if (!SOLID[world.getBlock(Math.floor(p.x), Math.floor(p.y), Math.floor(nz))]) p.z = nz; else p.vz = 0;
    }
  }

  // Build camera-facing quads around the camera (positions relative to `base`).
  build(cam, world) {
    this.base[0] = Math.floor(cam.x) - 64; this.base[1] = Math.floor(cam.y) - 64; this.base[2] = Math.floor(cam.z) - 64;
    const cy = Math.cos(cam.yaw), sy = Math.sin(cam.yaw), cp = Math.cos(cam.pitch), sp = Math.sin(cam.pitch);
    const rx = cy, rz = -sy;
    const ux = sy * sp, uy = cp, uz = cy * sp;
    let n = 0;
    const u8 = this.u8, u16 = this.u16;
    for (const p of this.list) {
      const px = p.x - this.base[0], py = p.y - this.base[1], pz = p.z - this.base[2];
      if (px < 1 || py < 1 || pz < 1 || px > 250 || py > 250 || pz > 250) continue;
      const l = world.getLight(Math.floor(p.x), Math.floor(p.y), Math.floor(p.z));
      const s = p.smoke ? p.size * (1 - 0.7 * (p.age / p.life)) : p.size;
      const full = p.smoke ? 16 : 3;
      for (let k = 0; k < 4; k++) {
        const a = k === 0 || k === 3 ? -1 : 1, b = k < 2 ? -1 : 1;
        const o = n * STRIDE, h = n * 10;
        u16[h] = Math.round((px + (rx * a + ux * b) * s) * 256);
        u16[h + 1] = Math.round((py + uy * b * s) * 256);
        u16[h + 2] = Math.round((pz + (rz * a + uz * b) * s) * 256);
        u8[o + 6] = p.u + (a > 0 ? full : 0);
        u8[o + 7] = p.v + (b > 0 ? 0 : full);
        u8[o + 8] = p.layer & 255; u8[o + 9] = 6; u8[o + 10] = p.flags; u8[o + 11] = p.layer >> 8;
        u8[o + 12] = (l >> 4) * 17; u8[o + 13] = (l & 15) * 17; u8[o + 14] = 255; u8[o + 15] = 0;
        u8[o + 16] = p.tint[0]; u8[o + 17] = p.tint[1]; u8[o + 18] = p.tint[2]; u8[o + 19] = 255;
        n++;
      }
    }
    this.count = n;
    return n;
  }

  bytes() { return this.u8.subarray(0, this.count * STRIDE); }
}
