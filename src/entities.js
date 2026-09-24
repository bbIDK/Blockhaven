// Everything that moves besides the player: dropped items, lit TNT, falling sand and gravel,
// animals and zombies.
// In multiplayer the host simulates them all; a guest's entities are copies of the host's (see
// the end of this file), and what a guest does to them is sent to the host.
import { Body } from './body.js';
import { boxMesh, MODEL_OFFSET } from './models.js';
import { TEX } from './textures.js';
import { mat4, identity, translate, rotateX, rotateY, rotateZ, scale, hash2 } from './math.js';
import { B, BLOCKS, SOLID, WATERLIKE, FILTER, REPLACEABLE } from './blocks.js';
import { I, itemDef } from './items.js';
import { rayBox } from './world.js';
import { BIOME } from './biomes.js';
import { HEIGHT } from './config.js';

const faces = (all, front) => [all, all, all, all, all, front ?? all].map((layer) => ({ layer }));
const box = (from, to, f, pivot = null, anim = null) => ({ from, to, faces: f, pivot, anim });

function legs(x, z, y1, layer, w = 0.125) {
  return [[x, z, 'legA'], [-x, z, 'legB'], [x, -z, 'legB'], [-x, -z, 'legA']].map(([lx, lz, anim]) =>
    box([lx - w, 0, lz - w], [lx + w, y1, lz + w], faces(layer), [lx, y1, lz], anim));
}

const MOB_TYPES = {
  pig: {
    label: 'Pig', hw: 0.45, h: 0.9, health: 10, speed: 1.2, drops: [[I.raw_porkchop, 1, 3]],
    parts: () => [
      box([-0.3125, 0.375, -0.5], [0.3125, 0.875, 0.5], faces(TEX.pig_skin)),
      box([-0.25, 0.45, -0.95], [0.25, 0.95, -0.45], faces(TEX.pig_skin, TEX.pig_face), [0, 0.7, -0.45], 'head'),
      ...legs(0.1875, 0.3125, 0.375, TEX.pig_skin),
    ],
  },
  sheep: {
    label: 'Sheep', hw: 0.45, h: 1.3, health: 8, speed: 1.1, drops: [[B.white_wool, 1, 2]],
    parts: () => [
      box([-0.35, 0.6, -0.55], [0.35, 1.2, 0.55], faces(TEX.sheep_wool)),
      box([-0.2, 0.85, -0.95], [0.2, 1.3, -0.5], faces(TEX.sheep_wool, TEX.sheep_face), [0, 1.05, -0.5], 'head'),
      ...legs(0.2, 0.35, 0.65, TEX.sheep_wool, 0.11),
    ],
  },
  cow: {
    label: 'Cow', hw: 0.45, h: 1.4, health: 10, speed: 1.0, drops: [[I.raw_beef, 1, 3], [I.leather, 0, 2]],
    parts: () => [
      box([-0.375, 0.75, -0.5625], [0.375, 1.375, 0.5625], faces(TEX.cow_hide)),
      box([-0.25, 1.0, -0.9375], [0.25, 1.5, -0.5625], faces(TEX.cow_hide, TEX.cow_face), [0, 1.25, -0.5625], 'head'),
      box([-0.3125, 1.4375, -0.8125], [-0.25, 1.5625, -0.75], faces(TEX.chicken_feathers), [0, 1.25, -0.5625], 'head'),
      box([0.25, 1.4375, -0.8125], [0.3125, 1.5625, -0.75], faces(TEX.chicken_feathers), [0, 1.25, -0.5625], 'head'),
      box([-0.125, 0.6875, 0.125], [0.125, 0.75, 0.375], faces(TEX.pig_skin)),
      ...legs(0.25, 0.4375, 0.75, TEX.cow_hide),
    ],
  },
  chicken: {
    label: 'Chicken', hw: 0.2, h: 0.7, health: 4, speed: 1.1, drops: [[I.raw_chicken, 1, 1], [I.feather, 0, 2]], flutter: true,
    parts: () => [
      box([-0.1875, 0.3125, -0.25], [0.1875, 0.6875, 0.25], faces(TEX.chicken_feathers)),
      box([-0.125, 0.5625, -0.4375], [0.125, 0.9375, -0.25], faces(TEX.chicken_feathers, TEX.chicken_face), [0, 0.6875, -0.25], 'head'),
      box([-0.125, 0.75, -0.5625], [0.125, 0.875, -0.4375], faces(TEX.chicken_beak), [0, 0.6875, -0.25], 'head'),
      box([-0.0625, 0.625, -0.5], [0.0625, 0.75, -0.4375], faces(TEX.chicken_wattle), [0, 0.6875, -0.25], 'head'),
      box([-0.25, 0.4375, -0.1875], [-0.1875, 0.625, 0.1875], faces(TEX.chicken_feathers), [-0.1875, 0.625, 0], 'wingA'),
      box([0.1875, 0.4375, -0.1875], [0.25, 0.625, 0.1875], faces(TEX.chicken_feathers), [0.1875, 0.625, 0], 'wingB'),
      box([-0.125, 0, -0.0625], [-0.0625, 0.3125, 0], faces(TEX.chicken_legs), [-0.09375, 0.3125, -0.03125], 'legA'),
      box([0.0625, 0, -0.0625], [0.125, 0.3125, 0], faces(TEX.chicken_legs), [0.09375, 0.3125, -0.03125], 'legB'),
    ],
  },
  zombie: {
    label: 'Zombie', hw: 0.3, h: 1.95, health: 20, speed: 2.3, hostile: true, drops: [[I.rotten_flesh, 0, 2]],
    parts: () => [
      box([-0.25, 0, -0.125], [0, 0.75, 0.125], faces(TEX.zombie_pants), [-0.125, 0.75, 0], 'legA'),
      box([0, 0, -0.125], [0.25, 0.75, 0.125], faces(TEX.zombie_pants), [0.125, 0.75, 0], 'legB'),
      box([-0.25, 0.75, -0.125], [0.25, 1.5, 0.125], faces(TEX.zombie_shirt)),
      box([-0.5, 0.75, -0.125], [-0.25, 1.5, 0.125], faces(TEX.zombie_skin), [-0.375, 1.375, 0], 'armA'),
      box([0.25, 0.75, -0.125], [0.5, 1.5, 0.125], faces(TEX.zombie_skin), [0.375, 1.375, 0], 'armB'),
      box([-0.25, 1.5, -0.25], [0.25, 2.0, 0.25], faces(TEX.zombie_skin, TEX.zombie_face), [0, 1.5, 0], 'head'),
    ],
  },
};
const PASSIVE_BIOMES = new Set([BIOME.PLAINS, BIOME.FOREST, BIOME.BIRCH_FOREST, BIOME.TAIGA, BIOME.MOUNTAINS, BIOME.FLAT]);

class Entity extends Body {
  constructor(kind, hw, h, x, y, z) {
    super(hw, h);
    this.kind = kind;
    this.x = x; this.y = y; this.z = z;
    this.age = 0;
    this.dead = false;
  }
}

export class Entities {
  constructor(game) {
    this.game = game;
    this.list = [];
    this.byNid = new Map(); // guests: the host's entity id -> our copy
    this.players = [];
    this.models = {};
    this.mats = [];
    this.matIndex = 0;
    this.spawnTimer = 0;
  }

  get world() { return this.game.world; }
  get guest() { return !!this.game.net?.guest; }

  reset(saved) {
    this.list = [];
    this.byNid.clear();
    if (!saved) return;
    for (const s of saved) {
      if (s.k === 'item' && itemDef(s.id)) this.spawnItem(s.x, s.y, s.z, s.id, s.count, s.dmg, 0);
      else if (s.k === 'mob' && MOB_TYPES[s.t]) { const m = this.spawnMob(s.t, s.x, s.y, s.z); m.yaw = s.yaw ?? 0; m.health = s.hp ?? m.health; }
    }
  }

  serialize() {
    return this.list.filter((e) => !e.dead && (e.kind === 'item' || e.kind === 'mob')).slice(0, 300).map((e) => (e.kind === 'item'
      ? { k: 'item', x: e.x, y: e.y, z: e.z, id: e.id, count: e.count, dmg: e.dmg }
      : { k: 'mob', t: e.type, x: e.x, y: e.y, z: e.z, yaw: e.yaw, hp: e.health }));
  }

  // ---------------------------------------------------------------- spawning
  // `vel`: [vx, vy, vz], or null for a little random hop.
  spawnItem(x, y, z, id, count, dmg = 0, delay = 0.6, vel = null) {
    if (this.guest) { this.game.net.dropItem(x, y, z, id, count, dmg, delay, vel); return null; }
    const e = new Entity('item', 0.125, 0.25, x, y, z);
    Object.assign(e, { id, count, dmg, pickupDelay: delay, spin: Math.random() * 6.28 });
    if (vel) [e.vx, e.vy, e.vz] = vel;
    else {
      e.vx = (Math.random() - 0.5) * 2;
      e.vy = 3 + Math.random() * 1.5;
      e.vz = (Math.random() - 0.5) * 2;
    }
    this.list.push(e);
    return e;
  }

  dropItem(player, stack) {
    if (!stack?.id || !stack.count) return;
    const d = player.lookDir();
    this.spawnItem(player.x, player.eyeY - 0.3, player.z, stack.id, stack.count, stack.dmg ?? 0, 1.5, [d[0] * 6, d[1] * 6 + 2, d[2] * 6]);
  }

  primeTNT(x, y, z, fuse) {
    if (this.guest) { this.game.net.primeTNT(x, y, z, fuse); return; }
    const e = new Entity('tnt', 0.49, 0.98, x + 0.5, y, z + 0.5);
    e.fuse = fuse;
    e.vy = 3;
    e.vx = (Math.random() - 0.5) * 1.2;
    e.vz = (Math.random() - 0.5) * 1.2;
    this.list.push(e);
    this.game.audio.fuse({ x: e.x, y: e.y + 0.5, z: e.z });
  }

  // Sand or gravel falling from (x, y, z): lands and turns back into a block.
  spawnFalling(x, y, z, block) {
    const e = new Entity('falling', 0.49, 0.98, x + 0.5, y, z + 0.5);
    e.block = block;
    this.list.push(e);
    return e;
  }

  spawnMob(type, x, y, z) {
    const t = MOB_TYPES[type];
    const e = new Entity('mob', t.hw, t.h, x, y, z);
    Object.assign(e, {
      type, label: t.label, def: t, health: t.health, yaw: Math.random() * 6.28, walk: 0, walkPhase: 0,
      wander: 0, moving: false, panic: 0, hurt: 0, lastDamage: 0, dying: 0, attackCd: 0, swing: 0, burnCd: 0, flap: 0, onFire: 0,
    });
    this.list.push(e);
    return e;
  }

  chunkLoaded(chunk) {
    const game = this.game;
    if (!game.meta || this.guest) return;
    const passive = this.list.filter((e) => e.kind === 'mob' && !e.def.hostile).length;
    if (passive >= 24 || hash2(chunk.cx, chunk.cz, game.meta.seed ^ 0xa11) > 0.1) return;
    const roll = hash2(chunk.cz, chunk.cx, game.meta.seed);
    const type = roll < 0.3 ? 'pig' : roll < 0.58 ? 'sheep' : roll < 0.84 ? 'cow' : 'chicken';
    const n = 2 + Math.floor(hash2(chunk.cx * 7, chunk.cz, 5) * 3) + (type === 'chicken' ? 1 : 0);
    for (let i = 0; i < n; i++) {
      const lx = Math.floor(hash2(chunk.cx, i, chunk.cz) * 16), lz = Math.floor(hash2(i, chunk.cz, chunk.cx) * 16);
      if (!PASSIVE_BIOMES.has(chunk.biomes[lz * 16 + lx])) continue;
      for (let y = HEIGHT - 2; y > 1; y--) {
        const id = chunk.blocks[(y << 8) | (lz << 4) | lx];
        if (!id) continue;
        if (id === B.grass_block) this.spawnMob(type, chunk.cx * 16 + lx + 0.5, y + 1, chunk.cz * 16 + lz + 0.5);
        break;
      }
    }
  }

  // Zombies appear in the dark near a player (in Survival).
  trySpawnHostile() {
    const game = this.game, w = this.world;
    const targets = this.players.filter((t) => !t.creative && !t.dead);
    if (!targets.length) return;
    const p = targets[Math.floor(Math.random() * targets.length)];
    const zombies = this.list.filter((e) => e.type === 'zombie' && !e.dead).length;
    if (zombies >= 4 + targets.length * 2) return;
    const day = game.env.daylight;
    for (let attempt = 0; attempt < 6; attempt++) {
      const a = Math.random() * Math.PI * 2, d = 18 + Math.random() * 22;
      const x = Math.floor(p.x + Math.cos(a) * d), z = Math.floor(p.z + Math.sin(a) * d);
      if (!w.isLoaded(x, z)) continue;
      for (let y = Math.min(HEIGHT - 3, Math.floor(p.y) + 14); y > Math.max(1, Math.floor(p.y) - 20); y--) {
        const below = w.getBlock(x, y - 1, z);
        if (!SOLID[below] || BLOCKS[below].name.endsWith('leaves') || SOLID[w.getBlock(x, y, z)] || SOLID[w.getBlock(x, y + 1, z)]) continue;
        if (WATERLIKE[w.getBlock(x, y, z)] || FILTER[w.getBlock(x, y, z)]) continue;
        const l = w.getLight(x, y, z);
        if ((l & 15) <= 7 && (l >> 4) * day <= 7) {
          this.spawnMob('zombie', x + 0.5, y, z + 0.5);
          return;
        }
        break;
      }
    }
  }

  // ---------------------------------------------------------------- simulation
  tick() {
    const game = this.game;
    if (this.guest) { this.remoteTick(); return; }
    // Everyone mobs can see: this player and, in multiplayer, the others.
    this.players = game.players();
    if (++this.spawnTimer >= 40) { this.spawnTimer = 0; this.trySpawnHostile(); }
    for (const e of this.list) {
      if (e.dead) continue;
      if (e.kind === 'tnt') {
        if (--e.fuse <= 0) { e.dead = true; this.explode(e.x, e.y + 0.5, e.z, 4); }
      } else if (e.kind === 'mob') this.mobTick(e);
    }
    // Merge nearby identical items.
    const items = this.list.filter((e) => e.kind === 'item' && !e.dead);
    for (let i = 0; i < items.length; i++) {
      const a = items[i];
      if (a.dead || a.count >= 64) continue;
      for (let j = i + 1; j < items.length; j++) {
        const b = items[j];
        if (b.dead || b.id !== a.id || b.dmg || a.dmg || Math.abs(a.x - b.x) > 0.6 || Math.abs(a.y - b.y) > 0.6 || Math.abs(a.z - b.z) > 0.6) continue;
        const n = Math.min(64 - a.count, b.count);
        a.count += n; b.count -= n;
        if (!b.count) b.dead = true;
      }
    }
    void game;
  }

  // The nearest player (any), and the nearest one a zombie could go after.
  nearest(e) {
    let near = null, prey = null, nd = Infinity, pd = Infinity;
    for (const t of this.players) {
      const d = Math.hypot(t.x - e.x, t.z - e.z);
      if (d < nd) { nd = d; near = t; }
      if (!t.creative && !t.dead && Math.abs(t.y - e.y) < 10 && d < pd) { pd = d; prey = t; }
    }
    return { near, nd, prey, pd };
  }

  mobTick(e) {
    const game = this.game, w = this.world;
    if (e.dying) return;
    e.hurt = Math.max(0, e.hurt - 1);
    e.attackCd = Math.max(0, e.attackCd - 1);
    const { nd: dist, prey, pd } = this.nearest(e);
    // Standing in fire or lava burns.
    const feet = w.getBlock(Math.floor(e.x), Math.floor(e.y + 0.2), Math.floor(e.z));
    if (feet === B.fire || WATERLIKE[feet] === 2) { e.onFire = 160; if (WATERLIKE[feet] === 2 && ++e.burnCd >= 10) { e.burnCd = 0; this.hurtMob(e, 4, null); } }
    if (e.onFire > 0) {
      e.onFire = WATERLIKE[w.getBlock(Math.floor(e.x), Math.floor(e.y + 0.3), Math.floor(e.z))] === 1 ? 0 : e.onFire - 1;
      if (e.onFire % 20 === 0 && e.onFire > 0) this.hurtMob(e, 1, null);
      if (Math.random() < 0.3) game.particles.smoke(e.x, e.y + Math.random() * e.h, e.z, 1, e.hw);
    }
    if (e.def.hostile) {
      // Burn in daylight.
      const l = w.getLight(Math.floor(e.x), Math.floor(e.y + 1.6), Math.floor(e.z));
      const burning = game.env.daylight > 0.75 && (l >> 4) >= 12 && game.weather.rain < 0.3;
      e.burning = burning;
      if (burning && Math.random() < 0.25) game.particles.smoke(e.x, e.y + 1 + Math.random() * 0.9, e.z, 1, 0.3);
      if (burning && ++e.burnCd >= 20) { e.burnCd = 0; this.hurtMob(e, 2, null); }
      if (prey && pd < 24) {
        const dx = prey.x - e.x, dz = prey.z - e.z;
        e.yaw = Math.atan2(-dx, -dz);
        e.moving = pd > 0.9;
        if (pd < 1.35 && Math.abs(prey.y - e.y) < 1.6 && e.attackCd === 0) {
          e.attackCd = 20;
          e.swing = 1;
          const k = 5 / Math.max(0.1, pd);
          game.hurtPlayer(prey, 3, 'You were slain by a zombie', [dx * k * 0.3, 4.5, dz * k * 0.3], true);
        }
      } else this.wanderTick(e);
      if (Math.random() < 0.005) game.audio.mob('zombie', 'say', { x: e.x, y: e.y + 1.6, z: e.z });
    } else {
      if (e.panic > 0) {
        e.panic--;
        if (e.panic % 20 === 0) e.yaw = Math.random() * 6.28;
        e.moving = true;
      } else this.wanderTick(e);
      if (Math.random() < 0.004) game.audio.mob(e.type, 'say', { x: e.x, y: e.y + e.h * 0.8, z: e.z });
    }
    // Despawn when far away.
    const lim = (game.settings.renderDistance + 2) * 16;
    if (dist > lim || e.y < -40) e.dead = true;
  }

  wanderTick(e) {
    if (--e.wander > 0) return;
    if (e.moving || Math.random() < 0.4) { e.moving = false; e.wander = 40 + Math.floor(Math.random() * 80); }
    else { e.moving = true; e.yaw = Math.random() * Math.PI * 2; e.wander = 30 + Math.floor(Math.random() * 70); }
  }

  update(dt) {
    const game = this.game, w = this.world, p = game.player;
    if (!w) return;
    if (this.guest) { this.remoteUpdate(dt); return; }
    for (const e of this.list) {
      if (e.dead || !w.isLoaded(e.x, e.z)) continue;
      e.age += dt;
      const fluid = WATERLIKE[w.getBlock(Math.floor(e.x), Math.floor(e.y + 0.3), Math.floor(e.z))];
      if (e.kind === 'item') {
        e.pickupDelay -= dt;
        e.spin += dt * 1.8;
        if (fluid) { e.vy += (4 - e.vy) * Math.min(1, dt * 3); } else e.vy -= 20 * dt;
        const f = e.onGround ? Math.exp(-8 * dt) : Math.exp(-1 * dt);
        e.vx *= f; e.vz *= f;
        e.move(w, e.vx * dt, e.vy * dt, e.vz * dt);
        const d = Math.hypot(p.x - e.x, p.y + 0.9 - e.y, p.z - e.z);
        if (e.pickupDelay <= 0 && d < 1.6 && game.state !== 'dead') {
          const left = game.pickup(e.id, e.count, e.dmg);
          if (left === 0) e.dead = true; else e.count = left;
        }
        if (e.age > 300) e.dead = true;
      } else if (e.kind === 'tnt') {
        e.vy -= 20 * dt;
        const f = e.onGround ? Math.exp(-6 * dt) : 1;
        e.vx *= f; e.vz *= f;
        e.move(w, e.vx * dt, e.vy * dt, e.vz * dt);
      } else if (e.kind === 'falling') {
        e.vy = Math.max(-40, e.vy - 32 * dt);
        e.move(w, 0, e.vy * dt, 0);
        if (e.onGround || e.age > 30 || e.y < 0) this.land(e);
      } else if (e.kind === 'mob') {
        this.mobPhysics(e, dt, fluid);
      }
    }
    this.list = this.list.filter((e) => !e.dead);
  }

  mobPhysics(e, dt, fluid) {
    const w = this.world;
    if (e.dying) {
      e.dying += dt;
      if (e.dying >= 1) this.finishDeath(e);
      e.vy -= 20 * dt;
      e.move(w, 0, e.vy * dt, 0);
      return;
    }
    let speed = e.moving ? e.def.speed * (e.panic ? 2 : 1) : 0;
    const fx = -Math.sin(e.yaw), fz = -Math.cos(e.yaw);
    // Passive animals avoid cliffs and water.
    if (speed && !e.def.hostile && e.onGround) {
      const ax = Math.floor(e.x + fx * (e.hw + 0.4)), az = Math.floor(e.z + fz * (e.hw + 0.4)), y = Math.floor(e.y + 0.1);
      const ahead = w.getBlock(ax, y - 1, az), ahead2 = w.getBlock(ax, y - 2, az);
      if ((!SOLID[ahead] && !SOLID[ahead2]) || WATERLIKE[ahead] || WATERLIKE[w.getBlock(ax, y, az)]) {
        e.yaw += Math.PI * (0.5 + Math.random());
        speed = 0;
      }
    }
    const k = 1 - Math.exp(-(e.onGround ? 10 : 2) * dt);
    e.vx += (fx * speed - e.vx) * k;
    e.vz += (fz * speed - e.vz) * k;
    if (fluid) {
      e.vy += (2.2 - e.vy) * Math.min(1, dt * 4);
    } else {
      e.vy -= 32 * dt;
      e.vy = Math.max(e.vy, e.def.flutter ? -3 : -60);
    }
    // Wings flap while a chicken is in the air.
    e.flap = !e.onGround && e.def.flutter ? e.flap + dt * 30 : 0;
    const wasGround = e.onGround;
    e.move(w, e.vx * dt, e.vy * dt, e.vz * dt);
    if (e.hitWall && (e.onGround || wasGround) && speed) e.vy = 8.6;
    const moved = Math.hypot(e.vx, e.vz);
    e.walk += (Math.min(1, moved / 1.5) - e.walk) * Math.min(1, dt * 8);
    e.walkPhase += moved * dt * 5;
    e.swing = Math.max(0, e.swing - dt * 3);
  }

  // A falling block lands: it becomes a block again where there's room, or breaks into an item.
  land(e) {
    e.dead = true;
    const w = this.world, game = this.game;
    const x = Math.floor(e.x), y = Math.floor(e.y + 0.3), z = Math.floor(e.z);
    const cur = w.getBlock(x, y, z);
    const def = BLOCKS[e.block];
    if ((cur === 0 || (REPLACEABLE[cur] && WATERLIKE[cur] !== 2) || cur === B.fire) && y >= 0) {
      w.setBlock(x, y, z, e.block);
      game.audio.place(def?.sound ?? 'sand', { x: e.x, y: e.y, z: e.z });
    } else if (!game.creative) this.spawnItem(e.x, e.y + 0.3, e.z, e.block, 1);
  }

  hurtMob(e, amount, from, bonus = 0) {
    if (e.dying || e.dead) return;
    // Like the original, a mob that was just hurt only takes the part of a new hit that's stronger
    // than the last one, so spam-clicking doesn't help.
    if (e.hurt > 0) {
      if (amount <= e.lastDamage) return;
      const extra = amount - e.lastDamage;
      e.lastDamage = amount;
      amount = extra;
    } else e.lastDamage = amount;
    e.health -= amount;
    e.hurt = 10;
    this.game.audio.mob(e.type, e.health <= 0 ? 'death' : 'hurt', { x: e.x, y: e.y + e.h * 0.8, z: e.z });
    this.game.bleed(e.x, e.y + e.h * 0.6, e.z, Math.min(14, 4 + Math.round(amount * 1.5)));
    if (from) {
      // Knocked back with a little hop.
      const dx = e.x - from.x, dz = e.z - from.z, d = Math.hypot(dx, dz) || 1;
      const k = 7 * (1 + bonus * 0.9);
      e.vx = e.vx / 2 + (dx / d) * k; e.vz = e.vz / 2 + (dz / d) * k;
      if (e.onGround) e.vy = 7 + bonus * 1.5;
    }
    if (!e.def.hostile) { e.panic = 80; e.yaw = Math.atan2(e.x - (from?.x ?? e.x), e.z - (from?.z ?? e.z)) + Math.PI; }
    if (e.health <= 0) e.dying = 0.001;
  }

  finishDeath(e) {
    e.dead = true;
    const game = this.game;
    game.net?.entityGone(e, 'd');
    // The body disappears in a puff of smoke.
    game.particles.smoke(e.x, e.y + e.h * 0.4, e.z, 10 + Math.round(e.h * 6), e.hw + 0.25);
    if (game.creative) return;
    for (const [id, min, max] of e.def.drops) {
      const n = min + Math.floor(Math.random() * (max - min + 1));
      if (n) this.spawnItem(e.x, e.y + 0.4, e.z, id, n);
    }
  }

  // The player hits a mob. `bonus` adds knockback (a sprinting, full-strength hit).
  attack(e, amount, bonus = 0) {
    const n = this.game.creative ? 100 : amount;
    if (e.remote) this.game.net.hitMob(e, n, bonus);
    else this.hurtMob(e, n, this.game.player, bonus);
  }

  interact() { /* nothing to interact with yet */ }

  // Explosion: carve a rough sphere, hurt anything nearby, set off other TNT.
  explode(x, y, z, power) {
    const game = this.game, w = this.world;
    // Items already lying in the blast are destroyed; the blast's own drops are spawned after.
    for (const e of this.list) {
      if (e.kind === 'item' && Math.hypot(e.x - x, e.y - y, e.z - z) < power) e.dead = true;
    }
    const changes = [];
    const r = Math.ceil(power);
    for (let dy = -r; dy <= r; dy++) for (let dz = -r; dz <= r; dz++) for (let dx = -r; dx <= r; dx++) {
      const d = Math.sqrt(dx * dx + dy * dy + dz * dz);
      if (d > power * (0.72 + Math.random() * 0.3)) continue;
      const bx = Math.floor(x + dx), by = Math.floor(y + dy), bz = Math.floor(z + dz);
      const id = w.getBlock(bx, by, bz);
      if (!id || id === B.bedrock || id === B.obsidian || WATERLIKE[id]) continue;
      if (id === B.tnt) { changes.push([bx, by, bz, 0]); this.primeTNT(bx, by, bz, 10 + Math.floor(Math.random() * 20)); continue; }
      changes.push([bx, by, bz, 0]);
      if (!game.creative && Math.random() < 0.12) {
        const drop = BLOCKS[id].drop ? (I[BLOCKS[id].drop] ?? B[BLOCKS[id].drop]) : null;
        if (drop !== null && drop !== undefined) this.spawnItem(bx + 0.5, by + 0.5, bz + 0.5, drop, 1);
      }
    }
    w.setBlocksBulk(changes);
    game.explosionFx(x, y, z, power);
    game.net?.effect('boom', x, y, z);
    const p = game.player;
    const pd = Math.hypot(p.x - x, p.y + 0.9 - y, p.z - z);
    if (pd < power * 2) {
      const f = 1 - pd / (power * 2);
      const k = (f * 14) / Math.max(0.3, pd);
      game.damage(Math.ceil(f * f * 22), 'You were blown up', true, [(p.x - x) * k, f * 9, (p.z - z) * k], true);
      if (game.creative) { p.vx += (p.x - x) * k; p.vy += f * 9; p.vz += (p.z - z) * k; }
    }
    for (const t of game.net?.others() ?? []) {
      const d = Math.hypot(t.x - x, t.y + 0.9 - y, t.z - z);
      if (d >= power * 2 || t.creative) continue;
      const f = 1 - d / (power * 2), k = (f * 14) / Math.max(0.3, d);
      game.hurtPlayer(t, Math.ceil(f * f * 22), 'You were blown up', [(t.x - x) * k, f * 9, (t.z - z) * k], true);
    }
    for (const e of this.list) {
      if (e.kind !== 'mob' || e.dead) continue;
      const d = Math.hypot(e.x - x, e.y - y, e.z - z);
      if (d < power * 2) this.hurtMob(e, Math.ceil((1 - d / (power * 2)) * 20), { x, z });
    }
  }

  // ---------------------------------------------------------------- copies of the host's entities
  // The host sends each entity in full once ({ i: id, k: 'i'|'t'|'m', x, y, z, ... }), then
  // [id, x, y, z, yaw, flags, count] when something about it changes, and [id, how] when it's gone.
  addRemote(s) {
    if (!s || !Number.isInteger(s.i) || ![s.x, s.y, s.z].every(Number.isFinite)) return;
    let e = this.byNid.get(s.i);
    if (!e) {
      if (s.k === 'i') {
        if (!itemDef(s.id)) return;
        e = new Entity('item', 0.125, 0.25, s.x, s.y, s.z);
        Object.assign(e, { id: s.id, count: 1, dmg: 0, pickupDelay: 0, spin: Math.random() * 6.28 });
      } else if (s.k === 't') {
        e = new Entity('tnt', 0.49, 0.98, s.x, s.y, s.z);
        e.fuse = 80;
        this.game.audio.fuse({ x: s.x, y: s.y + 0.5, z: s.z });
      } else if (s.k === 'f' && BLOCKS[s.b]) {
        e = new Entity('falling', 0.49, 0.98, s.x, s.y, s.z);
        e.block = s.b;
      } else if (s.k === 'm' && MOB_TYPES[s.ty]) {
        e = this.spawnMob(s.ty, s.x, s.y, s.z);
        this.list.pop();
        e.yaw = Number.isFinite(s.a) ? s.a : 0;
      } else return;
      e.nid = s.i;
      e.remote = true;
      this.list.push(e);
      this.byNid.set(s.i, e);
    }
    e.tx = s.x; e.ty = s.y; e.tz = s.z;
    if (s.k === 'i') {
      e.count = Number.isInteger(s.n) && s.n > 0 ? s.n : 1;
      e.dmg = Number.isInteger(s.d) ? s.d : 0;
      e.pickupDelay = Number.isFinite(s.pd) ? s.pd : 0;
    } else if (s.k === 't') {
      if (Number.isInteger(s.f)) e.fuse = s.f;
    } else {
      e.tyaw = Number.isFinite(s.a) ? s.a : e.yaw;
      this.remoteFlags(e, Number.isInteger(s.f) ? s.f : 0);
    }
  }

  moveRemote(u) {
    if (!Array.isArray(u) || !u.slice(0, 4).every(Number.isFinite)) return;
    const e = this.byNid.get(u[0]);
    if (!e) return;
    e.tx = u[1]; e.ty = u[2]; e.tz = u[3];
    if (e.kind === 'mob') {
      if (Number.isFinite(u[4])) e.tyaw = u[4];
      this.remoteFlags(e, Number.isInteger(u[5]) ? u[5] : 0);
    } else if (e.kind === 'item' && Number.isInteger(u[6]) && u[6] > 0) e.count = u[6];
  }

  // Mob flags: 1 hurt, 2 dying, 4 swinging its arms, 8 burning.
  remoteFlags(e, f) {
    const at = { x: e.x, y: e.y + e.h * 0.8, z: e.z };
    if ((f & 2) && !e.dying) { e.dying = 0.001; e.hurt = 10; this.game.audio.mob(e.type, 'death', at); }
    else if ((f & 1) && !(e.flags & 1) && !e.dying) { e.hurt = 10; this.game.audio.mob(e.type, 'hurt', at); this.game.bleed(e.x, e.y + e.h * 0.6, e.z, 8); }
    if (f & 4) e.swing = 1;
    e.burning = !!(f & 8);
    e.flags = f;
  }

  removeRemote(r) {
    if (!Array.isArray(r)) return;
    const e = this.byNid.get(r[0]);
    if (!e) return;
    this.byNid.delete(r[0]);
    e.dead = true;
    if (r[1] === 'd' && e.kind === 'mob') this.game.particles.smoke(e.x, e.y + e.h * 0.4, e.z, 10 + Math.round(e.h * 6), e.hw + 0.25);
  }

  // Per game tick on a guest: fuses burn down, animals and zombies make their noises.
  remoteTick() {
    const game = this.game;
    for (const e of this.list) {
      if (e.dead) continue;
      if (e.kind === 'tnt') e.fuse = Math.max(0, e.fuse - 1);
      else if (e.kind === 'mob' && !e.dying) {
        e.hurt = Math.max(0, e.hurt - 1);
        if (e.burning && Math.random() < 0.25) game.particles.smoke(e.x, e.y + 1 + Math.random() * 0.9, e.z, 1, 0.3);
        if (Math.random() < (e.def.hostile ? 0.005 : 0.004)) game.audio.mob(e.type, 'say', { x: e.x, y: e.y + e.h * 0.8, z: e.z });
      }
    }
  }

  // Per frame on a guest: glide towards the host's positions, animate, and pick items up.
  remoteUpdate(dt) {
    const game = this.game, p = game.player;
    const k = 1 - Math.exp(-dt * 14);
    for (const e of this.list) {
      if (e.dead) continue;
      e.age += dt;
      const ox = e.x, oy = e.y, oz = e.z;
      // Far jumps (teleports, merged stacks) snap.
      if (Math.abs(e.tx - e.x) + Math.abs(e.ty - e.y) + Math.abs(e.tz - e.z) > 8) { e.x = e.tx; e.y = e.ty; e.z = e.tz; }
      else { e.x += (e.tx - e.x) * k; e.y += (e.ty - e.y) * k; e.z += (e.tz - e.z) * k; }
      if (e.kind === 'item') {
        e.spin += dt * 1.8;
        e.pickupDelay -= dt;
        if (e.pickupDelay <= 0 && game.state !== 'dead' && Math.hypot(p.x - e.x, p.y + 0.9 - e.y, p.z - e.z) < 1.6) game.net.wantItem(e);
      } else if (e.kind === 'mob') {
        let dy = e.tyaw - e.yaw;
        dy -= Math.round(dy / (Math.PI * 2)) * Math.PI * 2;
        e.yaw += dy * k;
        const speed = Math.min(12, Math.hypot(e.x - ox, e.z - oz) / Math.max(dt, 1e-3));
        e.walk += (Math.min(1, speed / 1.5) - e.walk) * Math.min(1, dt * 8);
        e.walkPhase += speed * dt * 5;
        e.swing = Math.max(0, e.swing - dt * 3);
        e.flap = e.def.flutter && Math.abs(e.y - oy) > dt * 0.5 ? e.flap + dt * 30 : 0;
        if (e.dying) e.dying += dt;
      }
    }
    this.list = this.list.filter((e) => !e.dead);
  }

  // ---------------------------------------------------------------- queries
  raycast(ox, oy, oz, dx, dy, dz, maxDist) {
    let best = null;
    for (const e of this.list) {
      if (e.kind !== 'mob' || e.dead || e.dying) continue;
      const b = [-e.hw, 0, -e.hw, e.hw, e.h, e.hw];
      const hit = rayBox(ox - e.x, oy - e.y, oz - e.z, dx, dy, dz, b);
      if (hit && hit.t <= maxDist && (!best || hit.t < best.t)) best = { entity: e, t: hit.t };
    }
    return best;
  }

  blocksPlacement(x, y, z) {
    return this.list.some((e) => e.kind === 'mob' && !e.dead &&
      e.x - e.hw < x + 1 && e.x + e.hw > x && e.y < y + 1 && e.y + e.h > y && e.z - e.hw < z + 1 && e.z + e.hw > z);
  }

  // ---------------------------------------------------------------- rendering
  mat() {
    if (this.matIndex >= this.mats.length) this.mats.push(mat4());
    return this.mats[this.matIndex++];
  }

  model(type) {
    if (!this.models[type]) {
      const r = this.game.renderer;
      this.models[type] = MOB_TYPES[type].parts().map((p) => ({ ...p, mesh: r.createMesh(boxMesh([p])) }));
    }
    return this.models[type];
  }

  renderList(cam) {
    this.matIndex = 0;
    const out = [];
    const w = this.world, r = this.game.renderer;
    const maxD2 = (this.game.settings.renderDistance * 16) ** 2;
    for (const e of this.list) {
      if (e.dead) continue;
      const rx = e.x - cam.x, ry = e.y - cam.y, rz = e.z - cam.z;
      if (rx * rx + rz * rz > maxD2) continue;
      const l = w.getLight(Math.floor(e.x), Math.floor(e.y + Math.min(1, e.h * 0.6)), Math.floor(e.z));
      const light = [l >> 4, l & 15];
      if (e.kind === 'item') {
        const mesh = r.itemMesh(e.id);
        if (!mesh) continue;
        const m = identity(this.mat());
        translate(m, m, rx, ry + 0.12 + Math.sin(e.age * 2.5) * 0.06, rz);
        rotateY(m, m, e.spin);
        const s = mesh.kind === 'block' ? 0.25 : 0.4;
        scale(m, m, s, s, s);
        translate(m, m, -0.5 - MODEL_OFFSET, (mesh.kind === 'block' ? 0 : 0) - MODEL_OFFSET, -0.5 - MODEL_OFFSET);
        out.push({ parts: [{ mesh, model: m }], light, tint: null });
      } else if (e.kind === 'tnt') {
        const mesh = r.itemMesh(B.tnt);
        const m = identity(this.mat());
        const grow = e.fuse < 10 ? 1 + (10 - e.fuse) * 0.015 : 1;
        translate(m, m, rx, ry, rz);
        scale(m, m, grow, grow, grow);
        translate(m, m, -0.5 - MODEL_OFFSET, -MODEL_OFFSET, -0.5 - MODEL_OFFSET);
        const flash = Math.floor(e.fuse / 5) % 2 === 0;
        out.push({ parts: [{ mesh, model: m }], light: [15, 15], tint: flash ? [2.2, 2.2, 2.2] : null });
      } else if (e.kind === 'falling') {
        const mesh = r.itemMesh(e.block);
        if (!mesh) continue;
        const m = identity(this.mat());
        translate(m, m, rx, ry, rz);
        translate(m, m, -0.5 - MODEL_OFFSET, -MODEL_OFFSET, -0.5 - MODEL_OFFSET);
        out.push({ parts: [{ mesh, model: m }], light, tint: null });
      } else if (e.kind === 'mob') {
        const parts = [];
        const swingA = Math.sin(e.walkPhase) * 0.9 * e.walk;
        for (const p of this.model(e.type)) {
          const m = identity(this.mat());
          translate(m, m, rx, ry, rz);
          rotateY(m, m, e.yaw);
          // Falls over sideways when it dies, quickly at first.
          if (e.dying) rotateZ(m, m, Math.min(1, Math.sqrt(e.dying * 1.6)) * Math.PI / 2);
          if (p.pivot) {
            let a = 0;
            if (p.anim === 'wingA' || p.anim === 'wingB') {
              const f = (Math.sin(e.flap) * 0.5 + 0.5) * (e.flap ? 1.2 : 0);
              translate(m, m, p.pivot[0], p.pivot[1], p.pivot[2]);
              rotateZ(m, m, p.anim === 'wingA' ? -f : f);
              translate(m, m, -p.pivot[0], -p.pivot[1], -p.pivot[2]);
            } else if (p.anim === 'legA') a = swingA;
            else if (p.anim === 'legB') a = -swingA;
            else if (p.anim === 'armA' || p.anim === 'armB') a = Math.PI / 2 * 0.95 - (p.anim === 'armA' ? swingA : -swingA) * 0.3 - e.swing * 0.6;
            else if (p.anim === 'head') a = Math.sin(e.age * 0.7) * 0.08;
            translate(m, m, p.pivot[0], p.pivot[1], p.pivot[2]);
            rotateX(m, m, a);
            translate(m, m, -p.pivot[0], -p.pivot[1], -p.pivot[2]);
          }
          translate(m, m, -MODEL_OFFSET, -MODEL_OFFSET, -MODEL_OFFSET);
          parts.push({ mesh: p.mesh, model: m });
        }
        out.push({ parts, light, tint: null, hurt: e.hurt > 0 || e.dying > 0 });
      }
    }
    return out;
  }
}
