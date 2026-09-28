// Bees' homes: bee nests (in trees) and beehives (built). A home keeps up to three bees. They come
// out by day (not in the rain) to go about the flowers, come home with nectar, and each one's
// nectar fills the home a level nearer full (five levels; honey shows at its door when it's full).
// A glass bottle takes the honey, shears the comb - and the bees inside come out angry at whoever
// did it, unless a campfire smokes under the hive. Breaking a home lets them out angry too (but
// one taken whole, with Silk Touch, keeps its bees, and its honey, to be put up elsewhere). The
// host keeps, for each home it knows of, the bees inside it (saved with the world); a bee that's
// out knows its home (`hive`: "x,y,z"). Homes the world made come with their bees, found as the
// land they're in loads; a bee out of everyone's sight goes back into its home rather than being
// lost.
import { B, HIVE, HONEY_FULL, FACE_DIRS, SOLID, hiveId } from './blocks.js';
import { MIN_Y } from './config.js';

export const HIVE_ROOM = 3;
// What a home taken whole drops: itself, with its bees and its honey.
export const hiveDrop = (h, bees) => ({ id: h.first, count: 1,
  extra: bees || h.level ? { ...(bees ? { bees: Math.min(bees, HIVE_ROOM) } : {}), ...(h.level ? { honey: h.level } : {}) } : null });
// How long a bee stays in (ticks): longer when it brought nectar to make into honey.
const STAY = 600, STAY_NECTAR = 2400;
const NEST = new Uint8Array(4096);
for (const [id, h] of Object.entries(HIVE)) if (h.kind === 'bee_nest') NEST[id] = 1;

const cleanBee = (b) => ({ nectar: !!b?.nectar, t: Number.isInteger(b?.t) ? Math.max(0, b.t) : 0,
  stay: Number.isInteger(b?.stay) ? Math.max(0, Math.min(24000, b.stay)) : STAY, hp: Number.isFinite(b?.hp) ? Math.max(1, Math.min(10, b.hp)) : 10 });

// Whether a campfire's smoke rises under the home at (x, y, z) - within five blocks, with nothing
// solid between - which calms its bees.
export function smoked(w, x, y, z) {
  for (let dy = 1; dy <= 5; dy++) {
    const id = w.getBlock(x, y - dy, z);
    if (id === B.campfire) return true;
    if (SOLID[id]) break;
  }
  return false;
}

export class Hives {
  constructor(game) {
    this.game = game;
    this.homes = new Map(); // "x,y,z" -> the bees in it: [{ nectar, t (ticks in), stay, hp }]
    this.timer = 0;
  }

  static key(x, y, z) { return `${x},${y},${z}`; }
  static at(key) { return key.split(',').map(Number); }

  clear() { this.homes.clear(); }
  serialize() { return [...this.homes].map(([k, bees]) => [k, bees.map((b) => ({ ...b }))]); }
  load(list) {
    this.clear();
    for (const e of Array.isArray(list) ? list : []) {
      if (!Array.isArray(e) || typeof e[0] !== 'string' || !/^-?\d+,-?\d+,-?\d+$/.test(e[0])) continue;
      this.homes.set(e[0], (Array.isArray(e[1]) ? e[1] : []).slice(0, HIVE_ROOM).map(cleanBee));
    }
  }

  // A home put up (empty), or taken down: its bees come out, angry at whoever's nearest.
  placed(x, y, z) { const k = Hives.key(x, y, z); if (!this.homes.has(k)) this.homes.set(k, []); }
  broken(x, y, z) {
    const k = Hives.key(x, y, z), bees = this.homes.get(k);
    if (!bees) return;
    this.homes.delete(k);
    this.angerAround(x, y, z, bees);
  }
  // A home taken whole (with Silk Touch): its bees go with it, none let out. How many there were.
  take(x, y, z) {
    const k = Hives.key(x, y, z), n = this.homes.get(k)?.length ?? 0;
    this.homes.delete(k);
    return n;
  }
  // One put up again with `n` bees in it (they come out once they've settled).
  settle(x, y, z, n) {
    this.homes.set(Hives.key(x, y, z), Array.from({ length: Math.max(0, Math.min(HIVE_ROOM, n)) }, () => cleanBee({ t: 0 })));
  }
  // A new nest (on a tree just grown) with its two or three bees.
  fill(x, y, z) {
    const k = Hives.key(x, y, z);
    this.homes.set(k, Array.from({ length: 2 + (((x * 31) ^ (z * 17) ^ y) & 1) }, () => cleanBee({ t: STAY })));
  }
  // Nests in land that's just loaded: each new one comes with its two or three bees.
  chunkLoaded(chunk) {
    const b = chunk.blocks, x0 = chunk.cx * 16, z0 = chunk.cz * 16;
    for (let i = 0; i < b.length; i++) {
      if (!NEST[b[i]]) continue;
      const x = x0 + (i & 15), z = z0 + ((i >> 4) & 15), y = (i >> 8) + MIN_Y, k = Hives.key(x, y, z);
      if (!this.homes.has(k)) this.fill(x, y, z);
    }
  }

  // Where a home's bees go in and out: the space in front of its door (null if it's walled up).
  door(key) {
    const [x, y, z] = Hives.at(key), h = HIVE[this.game.world.getBlock(x, y, z)];
    if (!h) return null;
    const d = FACE_DIRS[h.front], dx = x + d[0], dz = z + d[2];
    return SOLID[this.game.world.getBlock(dx, y, dz)] ? null : { x: dx + 0.5, y: y + 0.4, z: dz + 0.5 };
  }
  // A home with room in it within `r` of (x, y, z), nearest first (null if there's none).
  nearFree(x, y, z, r) {
    let best = null, bd = r;
    for (const [k, bees] of this.homes) {
      if (bees.length >= HIVE_ROOM) continue;
      const [hx, hy, hz] = Hives.at(k), d = Math.hypot(hx + 0.5 - x, hy + 0.5 - y, hz + 0.5 - z);
      if (d < bd && HIVE[this.game.world.getBlock(hx, hy, hz)]) { bd = d; best = k; }
    }
    // (Bees already heading home count too.)
    if (best && this.game.entities.list.filter((e) => e.hive === best && !e.dead).length + this.homes.get(best).length >= HIVE_ROOM) return null;
    return best;
  }

  // A bee goes into its home (if it's still there and has room): true if it did.
  enter(e) {
    const bees = this.homes.get(e.hive);
    if (!bees || bees.length >= HIVE_ROOM || !HIVE[this.game.world.getBlock(...Hives.at(e.hive))]) return false;
    bees.push(cleanBee({ nectar: e.nectar, t: 0, stay: e.nectar ? STAY_NECTAR : STAY, hp: e.health }));
    e.dead = true;
    this.game.net?.entityGone(e, 'h');
    return true;
  }

  // Once a second (on the host): the bees in the homes near anyone have their time in, and come out
  // by day when it's up (those with nectar leaving honey behind them).
  tick() {
    if (++this.timer < 20) return;
    this.timer = 0;
    const g = this.game, w = g.world, players = g.entities.players, reach = (g.settings.renderDistance + 1) * 16;
    const out = g.env.daylight >= 0.3 && g.weather.rain < 0.5;
    for (const [k, bees] of this.homes) {
      if (!bees.length) continue;
      const [x, y, z] = Hives.at(k);
      if (!w.isLoaded(x, z) || !players.some((p) => Math.hypot(p.x - x, p.z - z) < reach)) continue;
      const h = HIVE[w.getBlock(x, y, z)];
      if (!h) { this.homes.delete(k); continue; }
      for (const b of bees) b.t += 20;
      if (!out) continue;
      const i = bees.findIndex((b) => b.t >= b.stay);
      if (i >= 0) this.release(k, bees, i);
    }
  }
  // One bee comes out of its home (false if the door's blocked).
  release(k, bees, i, angry = null) {
    const at = this.door(k);
    if (!at) return false;
    const [b] = bees.splice(i, 1), [x, y, z] = Hives.at(k), w = this.game.world, h = HIVE[w.getBlock(x, y, z)];
    if (b.nectar && h && h.level < HONEY_FULL) w.setBlock(x, y, z, hiveId(h.first, h.level + 1, h.front));
    const e = this.game.entities.spawnMob('bee', at.x, at.y, at.z, { hive: k });
    e.health = b.hp;
    e.hover = 10;
    if (angry) { e.angry = 400; e.target = angry; }
    return true;
  }

  // Honey (or comb) taken from a full home: its bees come out angry, unless a campfire's smoke rises
  // under it to calm them.
  harvested(x, y, z) {
    if (smoked(this.game.world, x, y, z)) return;
    const k = Hives.key(x, y, z), bees = this.homes.get(k);
    if (bees) this.angerAround(x, y, z, bees, k);
  }
  // The bees of a home (and any of its bees about) go for whoever's nearest.
  angerAround(x, y, z, bees, key = null) {
    const g = this.game, foe = g.entities.players.filter((p) => !p.dead && !p.creative && Math.hypot(p.x - x - 0.5, p.y - y, p.z - z - 0.5) < 16)
      .sort((a, b) => Math.hypot(a.x - x, a.z - z) - Math.hypot(b.x - x, b.z - z))[0] ?? null;
    if (key) { while (bees.length && this.release(key, bees, 0, foe)); } else {
      // (The home itself is gone: they come out where it was.)
      for (const b of bees) {
        const e = g.entities.spawnMob('bee', x + 0.5, y + 0.3, z + 0.5, {});
        e.health = b.hp;
        if (foe) { e.angry = 400; e.target = foe; }
      }
    }
    if (!foe) return;
    const k = key ?? Hives.key(x, y, z);
    for (const e of g.entities.list) if (!e.dead && e.type === 'bee' && e.hive === k) { e.angry = 400; e.target = foe; }
  }
}
