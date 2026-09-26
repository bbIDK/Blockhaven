// Dynamic Lights, as the OptiFine and LambDynamicLights mods have them: a torch (or anything else
// that glows) lights up what's around whoever holds it, and so does one dropped on the ground or
// a creature on fire. Only the look changes: the world's own light, which creatures spawn by, is
// left as it is. The renderer's shaders do the lighting (see DYNAMIC in shaders.js); this finds
// the lights each frame, the eight nearest the camera.
import { EMIT, WATERLIKE, B } from './blocks.js';
import { I } from './items.js';

const MAX = 8;
// Items that glow though they aren't blocks that do, and those that go out under water.
const GLOW = new Map([[I.lava_bucket, 15], [I.glow_berries, 14]]);
const DOUSED = new Set([B.torch, B.campfire]);

// How brightly an item glows in the hand or on the ground (a light level, 0-15).
export function itemGlow(id) {
  return GLOW.get(id) ?? EMIT[id] ?? 0;
}

export class DynamicLights {
  constructor() {
    this.data = new Float32Array(MAX * 4); // x, y, z, light level
    this.count = 0;
    this.mode = 0; // 0 off, 1 Fast, 2 Fancy
    this.found = [];
  }

  // This frame's lights, from what `game` holds and what's about the camera.
  gather(game, cam) {
    const found = this.found, world = game.world;
    found.length = 0;
    this.count = 0;
    this.mode = game.settings.dynamicLights | 0;
    if (!this.mode || !world) return this;
    const reach2 = Math.min(game.settings.renderDistance * 16, 128) ** 2;
    const add = (x, y, z, level) => {
      if (level < 3) return;
      const d2 = (x - cam.x) ** 2 + (y - cam.y) ** 2 + (z - cam.z) ** 2;
      if (d2 < reach2) found.push({ x, y, z, level, d2 });
    };
    const glowing = (x, y, z, id) => {
      const level = itemGlow(id);
      if (level < 3 || (DOUSED.has(id) && WATERLIKE[world.getBlock(Math.floor(x), Math.floor(y), Math.floor(z))] === 1)) return;
      add(x, y, z, level);
    };
    const p = game.player;
    if (game.state !== 'dead') {
      glowing(p.x, p.eyeY - 0.35, p.z, game.handItem);
      if (game.fire > 0 && !game.creative) add(p.x, p.y + 0.9, p.z, 15);
    }
    if (game.net) {
      for (const rp of game.net.players.values()) if (rp.ready && !rp.dead) glowing(rp.x, rp.y + (rp.sneaking ? 1.05 : 1.3), rp.z, rp.held);
    }
    for (const e of game.entities.list) {
      if (e.dead) continue;
      if (e.kind === 'item') glowing(e.x, e.y + 0.25, e.z, e.id);
      else if (e.kind === 'mob' && (e.burning || e.onFire > 0)) add(e.x, e.y + (e.h ?? 1) * 0.6, e.z, 15);
    }
    found.sort((a, b) => a.d2 - b.d2);
    const n = Math.min(MAX, found.length), d = this.data;
    for (let i = 0; i < n; i++) {
      const s = found[i];
      d[i * 4] = s.x; d[i * 4 + 1] = s.y; d[i * 4 + 2] = s.z; d[i * 4 + 3] = s.level;
    }
    this.count = n;
    return this;
  }

  // The light the dynamic lights give at (x, y, z): a light level, 0-15 (not a whole number).
  at(x, y, z) {
    let l = 0;
    const d = this.data;
    for (let i = 0; i < this.count; i++) l = Math.max(l, d[i * 4 + 3] - Math.hypot(x - d[i * 4], y - d[i * 4 + 1], z - d[i * 4 + 2]));
    return Math.min(15, l);
  }
}
