// Everything that moves besides the player: dropped items, lit TNT, falling sand and gravel,
// arrows, boats, and creatures (whose particulars live in mobs.js; village people in
// civilians.js; riding in riding.js).
// In multiplayer the host simulates them all; a guest's entities are copies of the host's (see
// the end of this file), and what a guest does to them is sent to the host.
import { Body } from './body.js';
import { boxMesh, MODEL_OFFSET } from './models.js';
import { TEX } from './textures.js';
import { mat4, identity, translate, rotateX, rotateY, rotateZ, scale, hash2 } from './math.js';
import { B, BLOCKS, BASE, SOLID, WATERLIKE, FILTER, REPLACEABLE, RAIL, RAIL_ID } from './blocks.js';
import { I, itemDef, DISCS } from './items.js';
import { rayBox } from './world.js';
import { HEIGHT, TICKS_PER_DAY } from './config.js';
import { villageAt } from './villages.js';
import { MOBS, initMob, mobTick, mobPhysics, renderMob, provoked, mobUseEffect, applyMobUse, applyHeldUse, mobDrops, mobXp, herdFor, monsterFor, HOSTILE_TYPES,
  rallyPets } from './mobs.js';
import { Civilians } from './civilians.js';
import { extras, cleanExtras } from './inventory.js';
import { boatPhysics, boatMesh, boatModel, BOAT_WOODS } from './riding.js';
import { cartPhysics, cartMesh, cartModel, CART_SIZE } from './rails.js';
import { splitXp, orbSize } from './enchanting.js';
import { POTIONS, UNDEAD } from './potions.js';
import { holdsLead, useFence } from './leads.js';
import { isHanging, placement, place, holds, drops, frameUse, drawHanging } from './hangings.js';
import { PAINTINGS } from './tex/paintings.js';

class Entity extends Body {
  constructor(kind, hw, h, x, y, z) {
    super(hw, h);
    this.kind = kind;
    this.x = x; this.y = y; this.z = z;
    this.age = 0;
    this.dead = false;
  }
}

// What of a creature is saved (and sent to guests) beyond its position.
export function mobExtra(e) {
  const o = {};
  if (e.variant) o.v = e.variant;
  if (e.colour) o.c = e.colour;
  if (e.size !== 1) o.s = e.size;
  if (e.baby) o.b = 1;
  if (e.sheared) o.sh = 1;
  if (e.tame) o.tm = 1;
  if (e.saddled) o.sd = 1;
  if (e.temper) o.te = e.temper;
  if (e.owner) { o.ow = e.owner; o.co = e.collar; }
  if (e.sitting) o.si = 1;
  if (e.made) o.md = 1;
  if (e.named) o.nm = e.named;
  if (e.leash) o.le = e.leash.uid ?? [e.leash.x, e.leash.y, e.leash.z];
  if (e.def.kind === 'civilian') { o.r = e.rid; o.sk = e.skin; o.n = e.name; o.ro = e.role; }
  return o;
}
const extraOpts = (s) => ({ variant: Number.isInteger(s.v) ? s.v : 0, colour: Number.isInteger(s.c) ? s.c : 0, size: [1, 2, 4].includes(s.s) ? s.s : 1,
  baby: !!s.b, sheared: !!s.sh, tame: !!s.tm, saddled: !!s.sd, temper: Number.isFinite(s.te) ? Math.max(0, Math.min(100, s.te)) : 0,
  owner: typeof s.ow === 'string' && s.ow ? s.ow.slice(0, 64) : null, sitting: !!s.si, collar: Number.isInteger(s.co) && s.co >= 0 && s.co < 16 ? s.co : undefined,
  made: !!s.md, named: typeof s.nm === 'string' ? cleanTagName(s.nm) : null,
  leash: typeof s.le === 'string' && s.le ? { uid: s.le.slice(0, 64) }
    : Array.isArray(s.le) && s.le.length === 3 && s.le.every(Number.isInteger) ? { x: s.le[0], y: s.le[1], z: s.le[2] } : null });
// A name from a name tag: printable, and no longer than the original allows.
export const cleanTagName = (text) => String(text ?? '').replace(/\p{C}/gu, '').trim().slice(0, 50) || null;
// Flags sent with each creature update: 1 hurt, 2 dying, 4 swinging, 8 burning, 16 shorn, 32 angry,
// 64 about to explode, 128 drawing a bow, 256 asleep, 512 saddled, 1024 tame, 2048 being ridden,
// 4096 roosting (a bat hanging upside down), 8192 drinking (a witch), 16384 sitting (a pet).
export function mobFlags(e) {
  return (e.hurt > 0 ? 1 : 0) | (e.dying ? 2 : 0) | (e.swing > 0.3 ? 4 : 0) | (e.burning ? 8 : 0) | (e.sheared ? 16 : 0) | (e.angry > 0 ? 32 : 0) |
    (e.fuse > 0 ? 64 : 0) | (e.aim > 0 ? 128 : 0) | (e.pose === 'sleep' ? 256 : 0) | (e.saddled ? 512 : 0) | (e.tame ? 1024 : 0) | (e.rider ? 2048 : 0) |
    (e.roost ? 4096 : 0) | (e.drinking > 0 ? 8192 : 0) | (e.sitting ? 16384 : 0) | (e.love > 0 ? 32768 : 0);
}

export class Entities {
  constructor(game) {
    this.game = game;
    this.list = [];
    this.byNid = new Map(); // guests: the host's entity id -> our copy
    this.players = [];
    this.mats = [];
    this.matIndex = 0;
    this.spawnTimer = 0;
    this.hungTimer = 0;
    this.detectors = new Set();
    this.arrowMesh = null;
    this.civilians = new Civilians(this);
  }

  get world() { return this.game.world; }
  get guest() { return !!this.game.net?.guest; }

  reset(saved) {
    this.list = [];
    this.byNid.clear();
    this.civilians.reset();
    if (!saved) return;
    for (const s of saved) {
      if (s.k === 'item' && itemDef(s.id)) this.spawnItem(s.x, s.y, s.z, s.id, s.count, s.dmg, 0, null, cleanExtras(s.ex));
      else if (s.k === 'mob' && MOBS[s.t] && MOBS[s.t].kind !== 'civilian') {
        const m = this.spawnMob(s.t, s.x, s.y, s.z, extraOpts(s));
        m.yaw = s.yaw ?? 0; m.health = s.hp ?? m.health;
        if (Number.isFinite(s.mh)) m.maxHealth = s.mh;
      } else if (s.k === 'boat') this.spawnBoat(s.x, s.y, s.z, BOAT_WOODS.includes(s.w) ? s.w : 'oak', s.yaw ?? 0);
      else if (s.k === 'cart') this.spawnCart(s.x, s.y, s.z, Number.isFinite(s.yaw) ? s.yaw : 0);
      else if (s.k === 'xp' && Number.isInteger(s.v) && s.v > 0) this.spawnXp(s.x, s.y, s.z, Math.min(s.v, 2477));
      else if ((s.k === 'frame' || s.k === 'painting') && [s.bx, s.by, s.bz, s.f].every(Number.isInteger) && s.f >= 0 && s.f < 6) {
        this.spawnHanging(s.k, s.bx, s.by, s.bz, s.f, { art: s.a, item: s.it, rot: s.r });
      }
    }
  }

  serialize() {
    // (Things hung up are kept however many there are; the rest, up to 300.)
    const hung = this.list.filter((e) => !e.dead && isHanging(e)).map((e) => ({ k: e.kind, bx: e.bx, by: e.by, bz: e.bz, f: e.face, a: e.art ?? undefined,
      it: e.item ? { id: e.item.id, count: 1, dmg: e.item.dmg ?? 0, ex: extras(e.item) ?? undefined } : undefined, r: e.rot || undefined }));
    return hung.concat(this.list.filter((e) => !e.dead && (e.kind === 'item' || e.kind === 'boat' || e.kind === 'cart' || e.kind === 'xp' ||
      (e.kind === 'mob' && e.def.kind !== 'civilian' && !e.pinned)))
      .slice(0, 300)
      .map((e) => (e.kind === 'item' ? { k: 'item', x: e.x, y: e.y, z: e.z, id: e.id, count: e.count, dmg: e.dmg, ex: e.extra ?? undefined }
        : e.kind === 'boat' ? { k: 'boat', x: e.x, y: e.y, z: e.z, yaw: e.yaw, w: e.wood }
          : e.kind === 'cart' ? { k: 'cart', x: e.x, y: e.y, z: e.z, yaw: e.yaw }
          : e.kind === 'xp' ? { k: 'xp', x: e.x, y: e.y, z: e.z, v: e.value }
          : { k: 'mob', t: e.type, x: e.x, y: e.y, z: e.z, yaw: e.yaw, hp: e.health, mh: e.maxHealth, ...mobExtra(e) })));
  }

  // ---------------------------------------------------------------- things hung up
  // An item frame or a painting on `face` of the block at bx, by, bz (see hangings.js). `o`: its
  // art, and for a frame the item in it (as saved) and how it's turned.
  spawnHanging(kind, bx, by, bz, face, o = {}) {
    const e = new Entity(kind, 0.5, 1, 0, 0, 0);
    const item = o.item && itemDef(o.item.id) ? { id: o.item.id, count: 1, dmg: Number.isInteger(o.item.dmg) ? o.item.dmg : 0, ...(cleanExtras(o.item.ex) ?? {}) } : null;
    Object.assign(e, { bx, by, bz, face, art: kind === 'painting' ? (Number.isInteger(o.art) && PAINTINGS[o.art] ? o.art : 0) : null,
      item: kind === 'frame' ? item : null, rot: Number.isInteger(o.rot) ? o.rot & 7 : 0 });
    place(e);
    this.list.push(e);
    return e;
  }
  // Hang one up on `face` of the block at x, y, z, if it goes there. (A guest asks the host.)
  hang(kind, x, y, z, face) {
    const at = placement(this, kind, x, y, z, face);
    if (!at) return null;
    if (this.guest) { this.game.net.hang(kind, x, y, z, face); return at; }
    const e = this.spawnHanging(kind, at.bx, at.by, at.bz, at.face, { art: at.art });
    this.game.audio.place('wood', { x: e.x, y: e.y, z: e.z });
    return e;
  }
  // A frame used with `held` (a whole stack; one of it goes in): see frameUse.
  useHanging(e, held) {
    const what = frameUse(e, held);
    if (!what) return null;
    if (e.remote) { this.game.net.useHanging(e, held); return what; }
    if (what === 'put') e.item = { ...held, count: 1 };
    else e.rot = (e.rot + 1) & 7;
    this.game.audio.place(what === 'put' ? 'wood' : 'cloth', { x: e.x, y: e.y, z: e.z });
    this.game.net?.resend?.(e);
    return what;
  }
  // A punch: a frame with something in it lets go of that; otherwise down it comes.
  hitHanging(e, creative) {
    if (e.remote) { this.game.net.hitMob(e, 1, 0); return; }
    if (e.kind === 'frame' && e.item) {
      if (!creative) this.spawnItem(e.x, e.y, e.z, e.item.id, 1, e.item.dmg ?? 0, 0.5, null, extras(e.item));
      e.item = null; e.rot = 0;
      this.game.net?.resend?.(e);
    } else this.dropHanging(e, !creative);
    this.game.audio.dig('wood', { x: e.x, y: e.y, z: e.z });
  }
  dropHanging(e, drop = true) {
    e.dead = true;
    if (!drop) return;
    for (const st of drops(e)) this.spawnItem(e.x, e.y, e.z, st.id, 1, st.dmg ?? 0, 0.5, null, extras(st));
  }

  // ---------------------------------------------------------------- spawning
  // `vel`: [vx, vy, vz], or null for a little random hop.
  // (`extra`: the stack's enchantments and so on; see inventory.js.)
  spawnItem(x, y, z, id, count, dmg = 0, delay = 0.6, vel = null, extra = null) {
    if (this.guest) { this.game.net.dropItem(x, y, z, id, count, dmg, delay, vel, extra); return null; }
    const e = new Entity('item', 0.125, 0.25, x, y, z);
    Object.assign(e, { id, count, dmg, pickupDelay: delay, spin: Math.random() * 6.28, extra });
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
    this.spawnItem(player.x, player.eyeY - 0.3, player.z, stack.id, stack.count, stack.dmg ?? 0, 1.5, [d[0] * 6, d[1] * 6 + 2, d[2] * 6], extras(stack));
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

  spawnMob(type, x, y, z, o = {}) {
    const t = MOBS[type];
    const e = new Entity('mob', t.hw, t.h, x, y, z);
    initMob(e, type, o);
    this.list.push(e);
    return e;
  }

  // A boat of `wood` set down at (x, y, z) (the middle of its bottom), pointing along `yaw`.
  spawnBoat(x, y, z, wood, yaw = 0) {
    if (this.guest) { this.game.net.placeBoat?.(x, y, z, wood, yaw); return null; }
    const e = new Entity('boat', 0.65, 0.55, x, y, z);
    Object.assign(e, { wood, yaw, hits: 0, hurt: 0, rider: null, def: { label: 'Boat' } });
    this.list.push(e);
    return e;
  }

  // A minecart, set down at (x, y, z) (on a rail, as a rule).
  spawnCart(x, y, z, yaw = 0) {
    if (this.guest) { this.game.net.placeCart?.(x, y, z, yaw); return null; }
    const e = new Entity('cart', CART_SIZE.hw, CART_SIZE.h, x, y, z);
    Object.assign(e, { yaw, pitch: 0, hits: 0, hurt: 0, rider: null, rail: null, def: { label: 'Minecart' } });
    this.list.push(e);
    return e;
  }
  // Knocked about: a few knocks (one in creative) and it breaks, dropping a minecart.
  hitCart(e, creative) {
    const game = this.game;
    e.hurt = 0.35;
    game.audio.place('metal', { x: e.x, y: e.y + 0.3, z: e.z });
    if (++e.hits < (creative ? 1 : 3)) return;
    if (e.rider) this.throwRider(e);
    e.dead = true;
    game.net?.entityGone?.(e, 'b');
    if (!creative) this.spawnItem(e.x, e.y + 0.4, e.z, I.minecart, 1);
  }
  // Detector rails give power while a cart is on them (see power.js).
  detectorTick() {
    const w = this.world, on = new Set();
    for (const e of this.list) {
      if (e.kind !== 'cart' || e.dead) continue;
      const x = Math.floor(e.x), z = Math.floor(e.z);
      for (const y of [Math.floor(e.y + 0.1), Math.floor(e.y + 0.1) - 1]) if (RAIL[w.getBlock(x, y, z)]?.kind === 'detector') on.add(`${x},${y},${z}`);
    }
    const flip = (key, lit) => {
      const [x, y, z] = key.split(',').map(Number), r = RAIL[w.getBlock(x, y, z)];
      if (r?.kind === 'detector' && r.on !== lit) w.setBlock(x, y, z, RAIL_ID.detector[lit ? 1 : 0][r.shape]);
    };
    for (const key of on) if (!this.detectors.has(key)) flip(key, true);
    for (const key of this.detectors) if (!on.has(key)) flip(key, false);
    this.detectors = on;
  }

  // Which way a cart is pushed: by its rider leaning forward, and by anyone walking into it.
  cartPush(e) {
    let px = 0, pz = 0;
    if (e.rider === 'me' && e.drive?.forward > 0) { const yaw = this.game.player.yaw; px -= Math.sin(yaw) * 3; pz -= Math.cos(yaw) * 3; }
    if (!e.rider) {
      for (const p of this.players) {
        if (p.dead) continue;
        const dx = e.x - p.x, dz = e.z - p.z, d = Math.hypot(dx, dz);
        if (d < 0.85 && d > 1e-3 && Math.abs(p.y - e.y) < 1.2) { px += (dx / d) * 10; pz += (dz / d) * 10; }
      }
    }
    return px || pz ? [px, pz] : null;
  }

  // Experience worth `n` points: orbs that spring out and home in on the nearest player.
  spawnXp(x, y, z, n) {
    n = Math.round(n);
    if (n <= 0) return;
    if (this.guest) { this.game.net.dropXp?.(x, y, z, n); return; }
    for (const v of splitXp(Math.min(n, 5000))) {
      const e = new Entity('xp', 0.125, 0.25, x, y, z);
      const a = Math.random() * Math.PI * 2, s = 0.8 + Math.random() * 1.2;
      Object.assign(e, { value: v, vx: Math.cos(a) * s, vy: 2 + Math.random() * 2.5, vz: Math.sin(a) * s, pickupDelay: 0.5 });
      this.list.push(e);
    }
  }

  // Orbs are light: they float up in water, drift, and are drawn to anyone within 8 blocks,
  // faster the closer they get; touching someone gives them the experience.
  orbPhysics(e, dt, fluid) {
    const game = this.game;
    e.pickupDelay -= dt;
    if (fluid) e.vy += (2.5 - e.vy) * Math.min(1, dt * 3); else e.vy = Math.max(-20, e.vy - 12 * dt);
    let best = null, bd = 8;
    for (const p of this.players ?? []) {
      if (p.dead) continue;
      const d = Math.hypot(p.x - e.x, p.y + 0.9 - e.y, p.z - e.z);
      if (d < bd) { bd = d; best = p; }
    }
    if (best) {
      const f = (1 - bd / 8) ** 2 * 40 * dt / Math.max(bd, 0.1);
      e.vx += (best.x - e.x) * f; e.vy += (best.y + 0.9 - e.y) * f; e.vz += (best.z - e.z) * f;
    }
    const drag = e.onGround ? Math.exp(-6 * dt) : Math.exp(-0.4 * dt);
    e.vx *= drag; e.vz *= drag;
    e.move(this.world, e.vx * dt, e.vy * dt, e.vz * dt);
    if (best && bd < 1.2 && e.pickupDelay <= 0) {
      e.dead = true;
      game.net?.entityGone?.(e, 'p');
      if (best.addr) game.net?.giveXp?.(best.addr, e.value); else game.gainXp(e.value);
    }
    if (e.age > 300) e.dead = true;
  }

  // Someone knocks at a boat: a few knocks (one in Creative) and it breaks, dropping itself.
  hitBoat(e, creative) {
    const game = this.game;
    e.hurt = 0.35;
    game.audio.place('wood', { x: e.x, y: e.y + 0.3, z: e.z });
    if (++e.hits < (creative ? 1 : 3)) return;
    if (e.rider) this.throwRider(e);
    e.dead = true;
    game.particles.burst(Math.floor(e.x), Math.floor(e.y), Math.floor(e.z), B[`${e.wood}_planks`] ?? B.oak_planks);
    game.net?.entityGone?.(e, 'b');
    if (!creative) this.spawnItem(e.x, e.y + 0.4, e.z, I[`${e.wood}_boat`] ?? I.oak_boat, 1);
  }

  // A mount throws its rider off (an untamed horse, a broken boat).
  throwRider(e) {
    const game = this.game;
    if (e.rider === 'me') game.dismount(true);
    else if (e.rider) game.net?.buck?.(e.rider, e);
    e.rider = null;
    e.guestRider = false;
    e.drive = null;
  }

  // A mount a guest is riding goes where they say (see HostSession.rideMove), smoothly.
  glideRidden(e, dt) {
    const k = 1 - Math.exp(-dt * 14), ox = e.x, oz = e.z;
    if (Math.abs(e.tx - e.x) + Math.abs(e.ty - e.y) + Math.abs(e.tz - e.z) > 8) { e.x = e.tx; e.y = e.ty; e.z = e.tz; }
    else { e.x += (e.tx - e.x) * k; e.y += (e.ty - e.y) * k; e.z += (e.tz - e.z) * k; }
    let d = e.tyaw - e.yaw;
    d -= Math.round(d / (Math.PI * 2)) * Math.PI * 2;
    e.yaw += d * k;
    if (e.kind !== 'mob') return;
    const speed = Math.min(14, Math.hypot(e.x - ox, e.z - oz) / Math.max(dt, 1e-3));
    e.walk += (Math.min(1, speed / 1.5) - e.walk) * Math.min(1, dt * 8);
    e.walkPhase += speed * dt * 5;
  }

  // An arrow flying from (x, y, z). `owner`: who shot it (not hit by it at first); `pickup`:
  // whether it can be collected where it lands.
  // (`fx`: what the bow's enchantments add: { punch: extra knockback, flame: sets things alight };
  // or { potion }: a thrown splash potion rather than an arrow.)
  spawnArrow(x, y, z, vx, vy, vz, owner, damage, pickup, fx = null) {
    if (this.guest) { this.game.net.shootArrow?.(x, y, z, vx, vy, vz, damage, pickup, fx); return null; }
    const e = new Entity('arrow', 0.05, 0.1, x, y, z);
    Object.assign(e, { vx, vy, vz, owner, damage, pickup, stuck: false, life: 0, punch: fx?.punch ?? 0, flame: !!fx?.flame,
      potion: POTIONS[fx?.potion] ? fx.potion : null, snowball: !!fx?.snowball });
    this.list.push(e);
    return e;
  }

  chunkLoaded(chunk) {
    const game = this.game;
    if (!game.meta || this.guest) return;
    this.civilians.chunkLoaded(chunk);
    const passive = this.list.filter((e) => e.kind === 'mob' && !e.def.hostile && e.def.kind !== 'civilian').length;
    if (passive >= 40) return;
    for (const h of herdFor(chunk, game.meta.seed)) this.spawnMob(h.type, h.x, h.y, h.z, h.o);
  }

  // Monsters appear in the dark near a player (in Survival): zombies, skeletons, creepers,
  // spiders, now and then an enderman, and slimes in swamps and deep in "slime chunks".
  trySpawnHostile() {
    const game = this.game, w = this.world;
    const targets = this.players.filter((t) => !t.creative && !t.dead);
    if (!targets.length) return;
    const p = targets[Math.floor(Math.random() * targets.length)];
    const hostiles = this.list.filter((e) => e.kind === 'mob' && e.def.hostile && !e.dead).length;
    if (hostiles >= 8 + targets.length * 4) return;
    const day = game.env.daylight;
    for (let attempt = 0; attempt < 6; attempt++) {
      const a = Math.random() * Math.PI * 2, d = 20 + Math.random() * 24;
      const x = Math.floor(p.x + Math.cos(a) * d), z = Math.floor(p.z + Math.sin(a) * d);
      if (!w.isLoaded(x, z) || villageAt(w.gen, x, z, 6)) continue;
      for (let y = Math.min(HEIGHT - 4, Math.floor(p.y) + 14); y > Math.max(1, Math.floor(p.y) - 24); y--) {
        const below = w.getBlock(x, y - 1, z);
        if (!SOLID[below] || BLOCKS[below].name.endsWith('leaves') || SOLID[w.getBlock(x, y, z)] || SOLID[w.getBlock(x, y + 1, z)]) continue;
        if (WATERLIKE[w.getBlock(x, y, z)] === 1 && WATERLIKE[w.getBlock(x, y + 1, z)] === 1) {
          // The drowned rise from the beds of dark rivers and seas.
          const l = w.getLight(x, y, z);
          if (Math.random() < 0.4 && (l & 15) <= 7 && (l >> 4) * day <= 7) { this.spawnMob('drowned', x + 0.5, y, z + 0.5); return; }
          break;
        }
        if (WATERLIKE[w.getBlock(x, y, z)] || FILTER[w.getBlock(x, y, z)]) break;
        const l = w.getLight(x, y, z);
        if ((l & 15) > 7 || (l >> 4) * day > 7) break;
        const biome = w.biomeAt?.(x, z) ?? 0;
        const slimeChunk = hash2(x >> 4, z >> 4, (game.meta.seed ^ 0x51e) >>> 0) < 0.1;
        const pick = monsterFor(biome, y, slimeChunk);
        const t = MOBS[pick.type];
        // Room to stand (endermen are tall).
        const need = Math.ceil(t.h * (pick.size ?? 1));
        let room = true;
        for (let k = 0; k < need; k++) if (SOLID[w.getBlock(x, y + k, z)]) room = false;
        if (!room) break;
        if (t.sized && y > 40 && biome !== 12 && !slimeChunk && pick.type === 'slime' && (l >> 4) > 0) break;
        this.spawnMob(pick.type, x + 0.5, y, z + 0.5, { size: pick.size });
        return;
      }
    }
  }

  // Bats flit about in dark caves (never many at once).
  trySpawnBat() {
    const w = this.world;
    if (!this.players.length || this.list.filter((e) => e.type === 'bat' && !e.dead).length >= 5) return;
    const p = this.players[Math.floor(Math.random() * this.players.length)];
    for (let attempt = 0; attempt < 4; attempt++) {
      const x = Math.floor(p.x + (Math.random() - 0.5) * 48), y = Math.floor(p.y + (Math.random() - 0.5) * 24), z = Math.floor(p.z + (Math.random() - 0.5) * 48);
      if (y < 4 || y > 62 || !w.isLoaded(x, z) || Math.hypot(x - p.x, z - p.z) < 12) continue;
      if (SOLID[w.getBlock(x, y, z)] || SOLID[w.getBlock(x, y + 1, z)] || WATERLIKE[w.getBlock(x, y, z)]) continue;
      const l = w.getLight(x, y, z);
      if ((l >> 4) > 0 || (l & 15) > 3) continue;
      this.spawnMob('bat', x + 0.5, y, z + 0.5);
      return;
    }
  }

  // Phantoms come for those who haven't slept for three nights or more: out of the night sky,
  // over anyone standing in the open.
  trySpawnPhantoms() {
    const game = this.game, w = this.world;
    if (game.env.daylight > 0.25 || game.time - (game.meta.lastSleep ?? 0) < 3 * TICKS_PER_DAY) return;
    if (this.list.filter((e) => e.type === 'phantom' && !e.dead).length >= 3 || Math.random() < 0.5) return;
    const open = this.players.filter((p) => !p.creative && !p.dead && p.y > 50 &&
      (w.getLight(Math.floor(p.x), Math.floor(p.y + 1.7), Math.floor(p.z)) >> 4) >= 15);
    if (!open.length) return;
    const p = open[Math.floor(Math.random() * open.length)];
    for (let k = 1 + Math.floor(Math.random() * 2); k > 0; k--) {
      const a = Math.random() * Math.PI * 2;
      this.spawnMob('phantom', p.x + Math.cos(a) * 10, Math.min(HEIGHT - 4, p.y + 20 + Math.random() * 10), p.z + Math.sin(a) * 10);
    }
  }

  // ---------------------------------------------------------------- simulation
  tick() {
    const game = this.game;
    if (this.guest) { this.remoteTick(); return; }
    // Everyone creatures can see: this player and, in multiplayer, the others.
    this.players = game.players();
    if (++this.spawnTimer >= 40) { this.spawnTimer = 0; this.trySpawnHostile(); if (Math.random() < 0.5) this.trySpawnBat(); }
    if ((this.phantomTimer = (this.phantomTimer ?? 0) + 1) >= 600) { this.phantomTimer = 0; this.trySpawnPhantoms(); }
    this.civilians.tick();
    this.detectorTick();
    const checkHung = ++this.hungTimer % 10 === 0;
    for (const e of this.list) {
      if (e.dead) continue;
      if (isHanging(e)) {
        // (Knocked down when what holds it up goes, or something's built in front of it.)
        if (checkHung && this.world.isLoaded(e.x, e.z) && !holds(this, e)) this.dropHanging(e);
      } else if (e.kind === 'tnt') {
        if (--e.fuse <= 0) { e.dead = true; this.explode(e.x, e.y + 0.5, e.z, 4); }
      } else if (e.kind === 'mob') {
        const loaded = this.world.isLoaded(e.x, e.z);
        if (loaded) mobTick(this, e);
        if (e.playerHurt > 0) e.playerHurt--;
        // Out of sight, out of mind: creatures far from everyone go (village folk and penned
        // animals come back when the village does). Horses someone has tamed or saddled stay,
        // waiting where they were left.
        const near = this.players.some((p) => Math.hypot(p.x - e.x, p.z - e.z) < (game.settings.renderDistance + 2) * 16);
        const kept = e.tame || e.saddled || e.rider || e.made || e.named || e.leash;
        if ((!near && !kept && (e.def.kind !== 'civilian' || !loaded)) || e.y < -40) { e.dead = true; this.civilians.gone(e); }
      }
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
          const left = game.pickup(e.id, e.count, e.dmg, e.extra);
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
      } else if (e.kind === 'arrow') {
        this.arrowPhysics(e, dt, fluid);
      } else if (e.kind === 'xp') {
        this.orbPhysics(e, dt, fluid);
      } else if (e.kind === 'boat') {
        // (A guest's boat moves where they paddle it; see remoteRide.)
        e.hurt = Math.max(0, e.hurt - dt);
        if (e.guestRider) this.glideRidden(e, dt); else boatPhysics(w, e, dt, e.drive ?? null);
        if (e.y < -40) e.dead = true;
      } else if (e.kind === 'cart') {
        e.hurt = Math.max(0, e.hurt - dt);
        if (e.guestRider) { this.glideRidden(e, dt); e.rail = null; } else cartPhysics(w, e, dt, this.cartPush(e));
        if (e.y < -40) e.dead = true;
      } else if (e.kind === 'mob') {
        if (e.guestRider) this.glideRidden(e, dt); else mobPhysics(this, e, dt, fluid);
      }
    }
    this.list = this.list.filter((e) => !e.dead);
  }

  // Arrows fly under gravity and drag, stick in what they hit, and hurt whoever they strike.
  arrowPhysics(e, dt, fluid) {
    const w = this.world, game = this.game;
    if (e.stuck) {
      e.life += dt;
      if (e.life > 60 || !SOLID[w.getBlock(e.bx, e.by, e.bz)]) e.dead = true;
      else if (e.pickup && game.state !== 'dead') {
        const p = game.player;
        if (Math.hypot(p.x - e.x, p.y + 0.9 - e.y, p.z - e.z) < 1.4 && game.pickup(I.arrow, 1, 0) === 0) { e.dead = true; game.audio.pop(); }
      }
      return;
    }
    e.life += dt;
    if (e.flame && !fluid && Math.random() < dt * 20) game.particles.smoke(e.x, e.y, e.z, 1, 0.05);
    const drag = Math.exp(-(fluid ? 3 : 0.2) * dt);
    e.vx *= drag; e.vy = e.vy * drag - 20 * dt; e.vz *= drag;
    const sp = Math.hypot(e.vx, e.vy, e.vz), step = sp * dt;
    if (step < 1e-6) return;
    const dx = e.vx / sp, dy = e.vy / sp, dz = e.vz / sp;
    const hit = w.raycast(e.x, e.y, e.z, dx, dy, dz, step);
    let len = hit ? hit.t : step;
    // Creatures and players along the way.
    let victim = null;
    for (const o of this.list) {
      if (o.kind !== 'mob' || o.dead || o.dying || (o === e.owner && e.life < 0.5)) continue;
      const r = rayBox(e.x - o.x, e.y - o.y, e.z - o.z, dx, dy, dz, [-o.hw - 0.1, 0, -o.hw - 0.1, o.hw + 0.1, o.h, o.hw + 0.1]);
      if (r && r.t <= len) { len = r.t; victim = o; }
    }
    for (const q of this.players) {
      if (q.dead || (e.owner?.addr === q.addr && e.owner && e.life < 0.5) || (!e.owner?.kind && e.owner?.addr === q.addr)) continue;
      const r = rayBox(e.x - q.x, e.y - q.y, e.z - q.z, dx, dy, dz, [-0.4, 0, -0.4, 0.4, 1.8, 0.4]);
      if (r && r.t <= len) { len = r.t; victim = q; }
    }
    if ((e.potion || e.snowball) && (victim || hit)) {
      e.x += dx * len; e.y += dy * len; e.z += dz * len;
      if (e.potion) this.shatter(e, victim); else this.snowballHit(e, victim);
      return;
    }
    if (victim) {
      const dmg = Math.max(1, Math.round(e.damage * Math.min(1.5, sp / 25)));
      const at = { x: e.x, y: e.y, z: e.z };
      if (victim.kind === 'mob') this.hurtMob(victim, dmg, e.owner ?? at, e.punch, e.flame ? { fire: 5 } : null);
      else {
        game.hurtPlayer(victim, dmg, e.owner?.label ? `You were shot by a ${e.owner.label.toLowerCase()}` : 'You were shot', [dx * 3, 2, dz * 3], true);
        if (e.owner?.kind === 'mob') rallyPets(this, victim.uid, e.owner);
      }
      game.audio.arrowHit?.(true, at);
      e.dead = true;
      return;
    }
    e.x += dx * len; e.y += dy * len; e.z += dz * len;
    if (hit) {
      e.stuck = true; e.life = 0; e.bx = hit.x; e.by = hit.y; e.bz = hit.z;
      e.x -= dx * 0.05; e.y -= dy * 0.05; e.z -= dz * 0.05;
      game.audio.arrowHit?.(false, { x: e.x, y: e.y, z: e.z });
    }
    if (e.life > 30 || e.y < -20) e.dead = true;
  }

  // A splash potion breaks: glass, a burst of its colour, and everyone within four blocks gets
  // its effect (all of it with a direct hit, less the further away).
  shatter(e, direct) {
    const game = this.game, name = e.potion;
    e.dead = true;
    game.net?.entityGone?.(e, 'x');
    this.splashFx(e.x, e.y, e.z, name);
    game.net?.effect?.('splash', e.x, e.y, e.z, name);
    const near = (t, x, y, z) => (t === direct ? 1 : Math.max(0, 1 - Math.hypot(x - e.x, y - e.y, z - e.z) / 4));
    for (const q of this.players) {
      const k = q.dead ? 0 : near(q, q.x, q.y + 0.9, q.z);
      if (k > 0.05) game.potionOn(q, name, k);
    }
    for (const o of this.list) {
      if (o.kind !== 'mob' || o.dead || o.dying) continue;
      const k = near(o, o.x, o.y + o.h / 2, o.z);
      if (k > 0.05) this.potionOnMob(o, name, k, e.owner);
    }
  }
  // A snowball bursts on whatever it hits: no harm done, but a knock back (and a monster hit by a
  // snow golem's snowball turns on the golem).
  snowballHit(e, victim) {
    e.dead = true;
    this.game.net?.entityGone?.(e, 'x');
    this.snowFx(e.x, e.y, e.z);
    this.game.net?.effect?.('snow', e.x, e.y, e.z);
    if (victim?.kind !== 'mob') return;
    const d = Math.hypot(e.vx, e.vz) || 1;
    victim.vx += (e.vx / d) * 3; victim.vz += (e.vz / d) * 3;
    if (victim.onGround) victim.vy = 3.5;
    victim.hurt = Math.max(victim.hurt, 6);
    if (e.owner && e.owner !== victim) provoked(this, victim, e.owner);
  }
  snowFx(x, y, z) {
    this.game.particles.bits(x, y, z, TEX.snow, 10, 1.6, 0.45);
    this.game.audio.mob('snow_golem', 'hurt', { x, y, z }, 1.4);
  }
  splashFx(x, y, z, name) {
    const p = POTIONS[name];
    this.game.audio.smash({ x, y, z });
    if (p) this.game.particles.splash(x, y, z, p.colour);
  }
  // What a splash does to a creature. (Healing hurts the undead and harming heals them.)
  potionOnMob(o, name, k, from) {
    const p = POTIONS[name], undead = UNDEAD.has(o.type), mob = from?.kind === 'mob' ? from : null;
    if (!p) return;
    if ((p.effect === 'harming' && !undead) || (p.effect === 'healing' && undead)) this.hurtMob(o, Math.max(1, Math.round(6 * k)), mob ?? (from?.addr !== undefined ? from : null));
    else if (p.effect === 'healing' || p.effect === 'harming') o.health = Math.min(o.maxHealth ?? o.health, o.health + Math.round(4 * k));
    else if (p.effect === 'poison' && !undead) o.poisoned = Math.max(o.poisoned ?? 0, Math.round(p.seconds * 15 * k));
    else if (p.effect === 'slowness') o.slowed = Math.max(o.slowed ?? 0, Math.round(p.seconds * 15 * k));
    else if (p.effect === 'regeneration' && !undead) o.regen = Math.max(o.regen ?? 0, Math.round(p.seconds * 15 * k));
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
    } else if (!game.creative) this.spawnItem(e.x, e.y + 0.3, e.z, BASE[e.block], 1);
  }

  hurtMob(e, amount, from, bonus = 0, opts = null) {
    if (e.dying || e.dead) return;
    // Hurt by a player lately: it gives experience when it dies (and more drops with Looting).
    if (from && (from === this.game.player || 'addr' in from)) { e.playerHurt = 100; e.looting = opts?.looting ?? 0; }
    if (opts?.fire) e.onFire = Math.max(e.onFire ?? 0, opts.fire * 20);
    // Like the original, a creature that was just hurt only takes the part of a new hit that's
    // stronger than the last one, so spam-clicking doesn't help.
    if (e.hurt > 0) {
      if (amount <= e.lastDamage) return;
      const extra = amount - e.lastDamage;
      e.lastDamage = amount;
      amount = extra;
    } else e.lastDamage = amount;
    e.health -= amount;
    e.hurt = 10;
    const t = e.def;
    this.game.audio.mob(t.sound ?? e.type, e.health <= 0 ? 'death' : 'hurt', { x: e.x, y: e.y + e.h * 0.8, z: e.z }, t.pitch);
    if (t.kind !== 'water' && !t.noBlood) this.game.bleed(e.x, e.y + e.h * 0.6, e.z, Math.min(14, 4 + Math.round(amount * 1.5)));
    if (from && t.knockback !== 0) {
      // Knocked back with a little hop (iron golems stand firm).
      const dx = e.x - from.x, dz = e.z - from.z, d = Math.hypot(dx, dz) || 1;
      const k = (t.type === 'enderman' || t.type === 'polar_bear' ? 4 : 7) * (1 + bonus * 0.9);
      e.vx = e.vx / 2 + (dx / d) * k; e.vz = e.vz / 2 + (dz / d) * k;
      if (e.onGround) e.vy = 7 + bonus * 1.5;
    }
    provoked(this, e, from && (from.addr !== undefined || from.kind === 'mob') ? from : from === this.game.player ? this.players[0] : null);
    if (t.kind === 'civilian') this.civilians.hurt(e, from);
    if (e.health <= 0) {
      e.dying = 0.001;
      // (What killed it: a creeper shot by a skeleton leaves a music disc.)
      e.killer = from?.kind === 'mob' ? from.type : null;
      if (e.rider) this.throwRider(e);
    }
  }

  finishDeath(e) {
    e.dead = true;
    const game = this.game;
    game.net?.entityGone(e, 'd');
    // The body disappears in a puff of smoke.
    game.particles.smoke(e.x, e.y + e.h * 0.4, e.z, 10 + Math.round(e.h * 6), e.hw + 0.25);
    this.civilians.died(e);
    // Big slimes break into smaller ones.
    if (e.def.sized && e.size > 1) {
      const n = 2 + Math.floor(Math.random() * 3);
      for (let k = 0; k < n; k++) {
        const s = this.spawnMob('slime', e.x + (Math.random() - 0.5) * e.hw, e.y + 0.3, e.z + (Math.random() - 0.5) * e.hw, { size: e.size / 2 });
        s.vy = 4; s.vx = (Math.random() - 0.5) * 3; s.vz = (Math.random() - 0.5) * 3;
      }
    }
    if (e.playerHurt > 0) this.spawnXp(e.x, e.y + 0.4, e.z, mobXp(e));
    if (game.creative) return;
    for (const [id, n] of mobDrops(e)) this.spawnItem(e.x, e.y + 0.4, e.z, id, n);
    if (e.type === 'creeper' && (e.killer === 'skeleton' || e.killer === 'stray')) this.spawnItem(e.x, e.y + 0.4, e.z, I.music_disc_meadow + Math.floor(Math.random() * DISCS.length), 1);
  }

  // The player hits a creature. `bonus` adds knockback (a sprinting, full-strength hit).
  // `opts`: what the weapon's enchantments add ({ fire: seconds alight, looting: level }).
  attack(e, amount, bonus = 0, opts = null) {
    if (isHanging(e)) { this.hitHanging(e, this.game.creative); return; }
    const n = this.game.creative ? 100 : amount;
    if (e.kind === 'boat' || e.kind === 'cart') {
      if (e.remote) this.game.net.hitMob(e, n, bonus);
      else if (e.kind === 'cart') this.hitCart(e, this.game.creative);
      else this.hitBoat(e, this.game.creative);
      return;
    }
    if (e.remote) this.game.net.hitMob(e, n, bonus, opts);
    else this.hurtMob(e, n, this.game.player, bonus, opts);
  }

  // Right-click on a creature: feeding, shearing, milking; talking to villagers; getting into a
  // boat or onto a horse.
  interact(e, held) {
    if (isHanging(e)) { if (this.useHanging(e, held) === 'put' && !this.game.creative) { this.game.inv.consumeHeld(); this.game.invChanged(); } this.game.swingArm(); return; }
    if (e.kind === 'boat' || e.kind === 'cart') { this.game.mount(e); return; }
    if (e.def.kind === 'civilian') { this.civilians.talk(e); return; }
    // (A guest's copies of creatures know players by their keys; see playerKey.)
    const net = this.game.net, me = this.guest ? net.myKey : this.game.uid;
    const who = { mine: !!e.owner && (e.owner === me || !net), holds: !!e.leash?.uid && (e.leash.uid === me || !net), name: held?.name ?? null };
    const effect = mobUseEffect(e, held?.id ?? 0, who);
    if (!effect) {
      if (e.def.rideable && !e.baby && !this.game.player.sneaking) this.game.mount(e);
      return;
    }
    applyHeldUse(this.game, effect);
    if (e.remote) net.useMob(e, held?.id ?? 0, effect, who.name);
    else applyMobUse(this, e, held?.id ?? 0, effect, this.game.uid, who.name);
  }
  // A guest (`uid`) used something on a creature (checked again here).
  remoteUse(nid, id, effect, uid, name = null) {
    const e = this.list.find((x) => x.nid === nid && x.kind === 'mob' && !x.dead);
    if (!e) return;
    const who = { mine: !!e.owner && e.owner === uid, holds: holdsLead(this, e, uid), name };
    if (mobUseEffect(e, id, who) === effect) applyMobUse(this, e, id, effect, uid, name);
  }
  // A player (`uid`) used a fence post: see leads.js.
  useFence(uid, x, y, z) { return useFence(this, uid, x, y, z); }
  // A player (`uid`) attacked `foe`: their wolves join in.
  rallyPets(uid, foe) { rallyPets(this, uid, foe); }

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
      if (e.dead || (e.kind !== 'mob' && !isHanging(e))) continue;
      const d = Math.hypot(e.x - x, e.y - y, e.z - z);
      // (Frames and paintings close by are blown off the wall.)
      if (isHanging(e)) { if (d < power * 1.5) this.dropHanging(e); continue; }
      if (d < power * 2) this.hurtMob(e, Math.ceil((1 - d / (power * 2)) * 20), { x, z });
    }
  }

  // ---------------------------------------------------------------- copies of the host's entities
  // The host sends each entity in full once ({ i: id, k: 'i'|'t'|'f'|'a'|'m', x, y, z, ... }), then
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
      } else if (s.k === 'a') {
        e = new Entity('arrow', 0.05, 0.1, s.x, s.y, s.z);
        Object.assign(e, { stuck: false, life: 0, ayaw: Number.isFinite(s.a) ? s.a : 0, apitch: Number.isFinite(s.p) ? s.p : 0,
          potion: POTIONS[s.po] ? s.po : null, snowball: !!s.sb });
      } else if (s.k === 'x') {
        e = new Entity('xp', 0.125, 0.25, s.x, s.y, s.z);
        e.value = Number.isInteger(s.v) && s.v > 0 ? s.v : 1;
      } else if (s.k === 'c') {
        e = new Entity('cart', CART_SIZE.hw, CART_SIZE.h, s.x, s.y, s.z);
        Object.assign(e, { yaw: Number.isFinite(s.a) ? s.a : 0, pitch: Number.isFinite(s.p) ? s.p : 0, hits: 0, hurt: 0, rail: null, def: { label: 'Minecart' } });
      } else if (s.k === 'b') {
        e = new Entity('boat', 0.65, 0.55, s.x, s.y, s.z);
        Object.assign(e, { wood: BOAT_WOODS.includes(s.w) ? s.w : 'oak', yaw: Number.isFinite(s.a) ? s.a : 0, hits: 0, hurt: 0, def: { label: 'Boat' } });
      } else if (s.k === 'h' && (s.t === 'frame' || s.t === 'painting') && Array.isArray(s.b) && s.b.every(Number.isInteger) && [0, 1, 2, 3, 4, 5].includes(s.f)) {
        e = new Entity(s.t, 0.5, 1, 0, 0, 0);
        Object.assign(e, { bx: s.b[0], by: s.b[1], bz: s.b[2], face: s.f, art: s.t === 'painting' && PAINTINGS[s.a] ? s.a : s.t === 'painting' ? 0 : null, item: null, rot: 0 });
        place(e);
      } else if (s.k === 'm' && MOBS[s.ty]) {
        const t = MOBS[s.ty];
        e = new Entity('mob', t.hw, t.h, s.x, s.y, s.z);
        initMob(e, s.ty, extraOpts(s));
        if (t.kind === 'civilian') this.civilians.remoteLooks(e, s);
        e.yaw = Number.isFinite(s.a) ? s.a : 0;
      } else return;
      e.nid = s.i;
      e.remote = true;
      this.list.push(e);
      this.byNid.set(s.i, e);
    }
    e.tx = s.x; e.ty = s.y; e.tz = s.z;
    if (s.k === 'h') {
      const it = s.it && itemDef(s.it.id) ? s.it : null;
      e.item = it ? { id: it.id, count: 1, dmg: Number.isInteger(it.d) ? it.d : 0, ...(cleanExtras(it.ex) ?? {}) } : null;
      e.rot = Number.isInteger(s.r) ? s.r & 7 : 0;
    } else if (s.k === 'i') {
      e.extra = cleanExtras(s.ex);
      e.count = Number.isInteger(s.n) && s.n > 0 ? s.n : 1;
      e.dmg = Number.isInteger(s.d) ? s.d : 0;
      e.pickupDelay = Number.isFinite(s.pd) ? s.pd : 0;
    } else if (s.k === 't') {
      if (Number.isInteger(s.f)) e.fuse = s.f;
    } else if (s.k === 'm') {
      e.tyaw = Number.isFinite(s.a) ? s.a : e.yaw;
      if (Number.isInteger(s.c)) e.colour = s.c;
      const x = extraOpts(s);
      e.owner = x.owner; if (x.collar !== undefined) e.collar = x.collar;
      e.named = x.named; e.leash = x.leash;
      this.remoteFlags(e, Number.isInteger(s.f) ? s.f : 0);
    } else if (s.k === 'b' || s.k === 'c') {
      e.tyaw = Number.isFinite(s.a) ? s.a : e.yaw;
      e.ridden = !!((s.f ?? 0) & 2);
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
    } else if ((e.kind === 'boat' || e.kind === 'cart') && Number.isFinite(u[4])) {
      e.tyaw = u[4];
      if (e.kind === 'cart' && Number.isFinite(u[6])) e.pitch = u[6] / 100;
      if (u[5] & 1) e.hurt = 0.35;
      e.ridden = !!(u[5] & 2);
    } else if (e.kind === 'arrow' && Number.isFinite(u[4])) { e.ayaw = u[4]; e.apitch = Number.isFinite(u[5]) ? u[5] / 100 : e.apitch; }
    else if (e.kind === 'item' && Number.isInteger(u[6]) && u[6] > 0) e.count = u[6];
  }

  remoteFlags(e, f) {
    const at = { x: e.x, y: e.y + e.h * 0.8, z: e.z }, snd = e.def.sound ?? e.type;
    if ((f & 2) && !e.dying) { e.dying = 0.001; e.hurt = 10; this.game.audio.mob(snd, 'death', at, e.def.pitch); }
    else if ((f & 1) && !(e.flags & 1) && !e.dying) {
      e.hurt = 10;
      this.game.audio.mob(snd, 'hurt', at, e.def.pitch);
      if (e.def.kind !== 'water' && !e.def.noBlood) this.game.bleed(e.x, e.y + e.h * 0.6, e.z, 8);
    }
    if (f & 4) e.swing = 1;
    e.burning = !!(f & 8);
    e.sheared = !!(f & 16);
    e.angry = f & 32 ? 1 : 0;
    if ((f & 64) && !e.fuse) this.game.audio.fuse({ x: e.x, y: e.y + 1, z: e.z });
    e.fuseOn = !!(f & 64);
    e.aim = f & 128 ? 1 : 0;
    e.pose = f & 256 ? 'sleep' : null;
    e.saddled = !!(f & 512);
    e.tame = !!(f & 1024);
    e.ridden = !!(f & 2048);
    e.roost = !!(f & 4096);
    e.drinking = f & 8192 ? 1 : 0;
    e.sitting = !!(f & 16384);
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

  // Per game tick on a guest: fuses burn down, creatures make their noises.
  remoteTick() {
    const game = this.game;
    for (const e of this.list) {
      if (e.dead) continue;
      if (e.kind === 'tnt') e.fuse = Math.max(0, e.fuse - 1);
      else if (e.kind === 'mob' && !e.dying) {
        e.hurt = Math.max(0, e.hurt - 1);
        e.fuse = e.fuseOn ? e.fuse + 1 : 0;
        if (e.burning && Math.random() < 0.25) game.particles.smoke(e.x, e.y + 1 + Math.random() * 0.9, e.z, 1, 0.3);
        // In love (the host says so): a heart every half second, as on the host.
        e.loveTick = ((e.loveTick ?? 0) + 1) % 10;
        if ((e.flags & 32768) && e.loveTick === 0) game.particles.hearts(e.x, e.y + e.h * 0.5 + 0.3, e.z, 1, e.hw + 0.1);
        if (e.def.sound && Math.random() < (e.def.hostile ? 0.005 : 0.003)) game.audio.mob(e.def.sound, 'say', { x: e.x, y: e.y + e.h * 0.8, z: e.z }, e.def.pitch);
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
      // What this player rides, they move themselves (and tell the host where it is).
      if (e.rider === 'me') {
        const ox = e.x, oz = e.z;
        if (e.kind === 'boat') boatPhysics(this.world, e, dt, e.drive ?? null);
        else if (e.kind === 'cart') cartPhysics(this.world, e, dt, this.cartPush(e));
        else {
          mobPhysics(this, e, dt, WATERLIKE[this.world.getBlock(Math.floor(e.x), Math.floor(e.y + 0.3), Math.floor(e.z))]);
          const speed = Math.min(14, Math.hypot(e.x - ox, e.z - oz) / Math.max(dt, 1e-3));
          e.walk += (Math.min(1, speed / 1.5) - e.walk) * Math.min(1, dt * 8);
        }
        e.tx = e.x; e.ty = e.y; e.tz = e.z; e.tyaw = e.yaw;
        continue;
      }
      const ox = e.x, oy = e.y, oz = e.z;
      // Far jumps (teleports, merged stacks) snap.
      if (Math.abs(e.tx - e.x) + Math.abs(e.ty - e.y) + Math.abs(e.tz - e.z) > 8) { e.x = e.tx; e.y = e.ty; e.z = e.tz; }
      else { e.x += (e.tx - e.x) * k; e.y += (e.ty - e.y) * k; e.z += (e.tz - e.z) * k; }
      if (e.kind === 'boat' || e.kind === 'cart') {
        let dy = (e.tyaw ?? e.yaw) - e.yaw;
        dy -= Math.round(dy / (Math.PI * 2)) * Math.PI * 2;
        e.yaw += dy * k;
        e.hurt = Math.max(0, e.hurt - dt);
      }
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
        e.onGround = Math.abs(e.y - oy) < dt * 0.5;
        e.inWater = WATERLIKE[this.world.getBlock(Math.floor(e.x), Math.floor(e.y + 0.3), Math.floor(e.z))] === 1;
        const fl = e.def.flies;
        if (fl) e.flap += dt * (fl === 'bat' ? 32 : fl === 'parrot' ? (e.onGround ? 0 : 26) : 5);
        else e.flap = e.def.flutter && !e.onGround ? e.flap + dt * 30 : 0;
        // (Flyers and dolphins pitch with the way they're going.)
        if (fl || e.def.anim === 'dolphin') {
          const vy = (e.y - oy) / Math.max(dt, 1e-3), want = Math.max(-1.2, Math.min(1.2, Math.atan2(vy, Math.max(speed, fl ? 0.5 : 1))));
          e.tilt = (e.tilt ?? 0) + (want - (e.tilt ?? 0)) * Math.min(1, dt * 5);
        }
        if (e.dying) e.dying += dt;
      }
    }
    this.list = this.list.filter((e) => !e.dead);
  }

  // ---------------------------------------------------------------- queries
  raycast(ox, oy, oz, dx, dy, dz, maxDist) {
    let best = null;
    for (const e of this.list) {
      if ((e.kind !== 'mob' && e.kind !== 'boat' && e.kind !== 'cart' && !isHanging(e)) || e.dead || e.dying || e.rider === 'me') continue;
      const b = e.hitbox ?? [-e.hw, 0, -e.hw, e.hw, e.h, e.hw];
      const hit = rayBox(ox - e.x, oy - e.y, oz - e.z, dx, dy, dz, b);
      if (hit && hit.t <= maxDist && (!best || hit.t < best.t)) best = { entity: e, t: hit.t };
    }
    return best;
  }

  blocksPlacement(x, y, z) {
    return this.list.some((e) => (e.kind === 'mob' || e.kind === 'boat' || e.kind === 'cart') && !e.dead &&
      e.x - e.hw < x + 1 && e.x + e.hw > x && e.y < y + 1 && e.y + e.h > y && e.z - e.hw < z + 1 && e.z + e.hw > z);
  }

  hostileNear(x, y, z, r) {
    return this.list.some((e) => e.kind === 'mob' && HOSTILE_TYPES.has(e.type) && !e.dead && Math.hypot(e.x - x, e.y - y, e.z - z) < r);
  }

  // ---------------------------------------------------------------- rendering
  mat() {
    if (this.matIndex >= this.mats.length) this.mats.push(mat4());
    return this.mats[this.matIndex++];
  }

  // An arrow: two crossed strips along -z (the point at the front).
  arrowModel() {
    if (!this.arrowMesh) {
      const L = TEX.arrow_entity;
      this.arrowMesh = this.game.renderer.createMesh(boxMesh([
        { from: [0, -0.16, -0.5], to: [0, 0.16, 0.5], faces: [{ layer: L, uv: [0, 5, 16, 10] }, { layer: L, uv: [16, 5, 0, 10] }, null, null, null, null] },
        { from: [-0.16, 0, -0.5], to: [0.16, 0, 0.5], faces: [null, null, { layer: L, uv: [0, 5, 16, 10] }, { layer: L, uv: [16, 5, 0, 10] }, null, null] },
      ]));
    }
    return this.arrowMesh;
  }

  // An orb: a flat picture turned to face the camera.
  orbModel() {
    if (!this.orbMesh) {
      const L = TEX.xp_orb;
      this.orbMesh = this.game.renderer.createMesh(boxMesh([
        { from: [-0.5, 0, 0], to: [0.5, 1, 0], faces: [null, null, null, null, { layer: L, uv: [0, 0, 16, 16] }, { layer: L, uv: [16, 0, 0, 16] }] },
      ]));
    }
    return this.orbMesh;
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
        translate(m, m, -0.5 - MODEL_OFFSET, -MODEL_OFFSET, -0.5 - MODEL_OFFSET);
        out.push({ parts: [{ mesh, model: m, glint: e.extra?.ench || e.id === I.enchanted_book ? 1 : 0 }], light, tint: null });
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
      } else if (e.kind === 'xp') {
        // Pulsing between green and yellow, and bigger for more experience.
        const m = identity(this.mat()), s = 0.55 + orbSize(e.value) * 0.05, k = (Math.sin(e.age * 6 + (e.value % 7)) + 1) / 2;
        translate(m, m, rx, ry - 0.08 + Math.sin(e.age * 3) * 0.03, rz);
        rotateY(m, m, cam.yaw);
        scale(m, m, s, s, s);
        translate(m, m, -MODEL_OFFSET, -MODEL_OFFSET, -MODEL_OFFSET);
        out.push({ parts: [{ mesh: this.orbModel(), model: m }], light: [15, 15], tint: [0.75 + k * 0.5, 1.25, 0.35 + k * 0.15] });
      } else if (e.kind === 'arrow' && (e.potion || e.snowball)) {
        // A thrown potion (or snowball) tumbles as it flies.
        const mesh = r.itemMesh(e.potion ? I[`splash_potion_${e.potion}`] : I.snowball);
        if (!mesh) continue;
        const m = identity(this.mat());
        translate(m, m, rx, ry, rz);
        rotateY(m, m, cam.yaw);
        rotateZ(m, m, e.age * 9);
        scale(m, m, 0.4, 0.4, 0.4);
        translate(m, m, -0.5 - MODEL_OFFSET, -0.5 - MODEL_OFFSET, -MODEL_OFFSET);
        out.push({ parts: [{ mesh, model: m }], light, tint: null });
      } else if (e.kind === 'arrow') {
        if (!e.stuck && !e.remote) { e.ayaw = Math.atan2(-e.vx, -e.vz); e.apitch = Math.atan2(e.vy, Math.hypot(e.vx, e.vz)); }
        const m = identity(this.mat());
        translate(m, m, rx, ry, rz);
        rotateY(m, m, e.ayaw ?? 0);
        rotateX(m, m, e.apitch ?? 0);
        scale(m, m, 0.5, 0.5, 0.5);
        translate(m, m, -MODEL_OFFSET, -MODEL_OFFSET, -MODEL_OFFSET);
        out.push({ parts: [{ mesh: this.arrowModel(), model: m }], light, tint: null });
      } else if (e.kind === 'boat') {
        out.push({ parts: [{ mesh: boatMesh(r, e.wood), model: boatModel(this.mat(), rx, ry, rz, e.yaw) }], light, tint: null, hurt: e.hurt > 0 });
      } else if (e.kind === 'cart') {
        out.push({ parts: [{ mesh: cartMesh(r), model: cartModel(this.mat(), rx, ry, rz, e.yaw, e.pitch) }], light, tint: null, hurt: e.hurt > 0 });
      } else if (e.kind === 'mob') {
        renderMob(this, e, rx, ry, rz, light, out);
      } else if (isHanging(e)) {
        drawHanging(this, e, cam, () => this.mat(), out);
      }
    }
    return out;
  }
}
