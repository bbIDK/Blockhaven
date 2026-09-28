// The wandering trader, as Minecraft has them: every day or so there's a chance (a better one each
// time it doesn't happen) that someone turns up near a player, leading two llamas in the traders'
// blue, with things gathered on their travels to sell for gold coins: saplings and flowers, dyes,
// seeds and sea plants, and one rarer thing. They wander about near where they came, run from
// monsters, and after forty minutes or so they're gone again (and their llamas with them, unless
// someone has taken the leads). Talking and trading go as with village people (see civilians.js
// and tradeui.js); a trader's llamas are on leads the trader holds (see leads.js).
import { B, SOLID, WATERLIKE } from './blocks.js';
import { CIV_LOOKS } from './tex/civskins.js';
import { hashString } from './math.js';
import { TEX } from './textures.js';
import { MAX_Y } from './config.js';

const STAY = 48000; // (forty minutes)
const NAMES = ['Silas', 'Marta', 'Ezra', 'Rosalind', 'Barnaby', 'Ines', 'Hollis', 'Wren', 'Tobias', 'Ottoline', 'Caspar', 'Ysolde', 'Jory',
  'Elowen', 'Fenwick', 'Mireille', 'Anselm', 'Petra', 'Crispin', 'Liesel'];

// Whether `o` is a llama on the lead of the trader with id `tid`.
export const ledBy = (o, tid) => o.kind === 'mob' && !o.dead && o.leash?.uid === `@${tid}`;

export class Wanderers {
  constructor(ents) { this.ents = ents; }
  get game() { return this.ents.game; }

  // Once a game tick (on the host). As in the original: every minute the wait since the last one
  // runs down, and at the end of each day there's a chance of a trader (25%, then 50%, then 75%
  // until one comes).
  tick() {
    const game = this.game, meta = game.meta;
    if (!meta || !this.ents.players.length) return;
    if ((this.clock = (this.clock ?? 0) + 1) % 1200) return;
    const st = (meta.wanderer ??= { delay: 24000, chance: 25 });
    st.delay -= 1200;
    if (st.delay > 0) return;
    st.delay = 24000;
    if (this.ents.list.some((e) => e.def?.wanderer && !e.dead)) return;
    const chance = st.chance;
    st.chance = Math.min(75, st.chance + 25);
    if (Math.random() * 100 > chance) return;
    const live = this.ents.players.filter((q) => !q.dead), p = live[Math.floor(Math.random() * live.length)];
    const at = p && this.spot(p);
    if (!at) return;
    this.arrive(at[0] + 0.5, at[1], at[2] + 0.5, true);
    st.chance = 25;
  }

  // Somewhere near player `p` (within 48 blocks, not right on top of them) to turn up: open
  // ground under the sky, with room to stand. [x, y, z] or null.
  spot(p) {
    const w = this.ents.world;
    for (let k = 0; k < 12; k++) {
      const a = Math.random() * Math.PI * 2, d = 10 + Math.random() * 30;
      const x = Math.floor(p.x + Math.cos(a) * d), z = Math.floor(p.z + Math.sin(a) * d);
      if (!w.isLoaded(x, z)) continue;
      for (let y = Math.min(Math.floor(p.y) + 12, MAX_Y - 6); y > Math.floor(p.y) - 12 && y > w.floorY + 1; y--) {
        const below = w.getBlock(x, y - 1, z);
        if (!SOLID[below] || WATERLIKE[below] || below === B.cactus) continue;
        if (SOLID[w.getBlock(x, y, z)] || SOLID[w.getBlock(x, y + 1, z)] || WATERLIKE[w.getBlock(x, y, z)]) break;
        if ((w.getLight(x, y, z) >> 4) < 12) break;
        return [x, y, z];
      }
    }
    return null;
  }

  // A trader appears at (x, y, z) (with their two llamas, `llamas`).
  arrive(x, y, z, llamas = false) {
    const e = this.ents.spawnMob('wandering_trader', x, y, z);
    const tid = `${Date.now().toString(36)}${Math.floor(Math.random() * 1e6).toString(36)}`;
    this.dress(e, tid, NAMES[Math.floor(Math.random() * NAMES.length)], STAY + Math.floor(Math.random() * 12000), { x, z });
    if (llamas) {
      for (const side of [-1, 1]) {
        const m = this.ents.spawnMob('trader_llama', x + side * 1.5, y, z + 1.5, { variant: Math.floor(Math.random() * 4) });
        m.leash = { uid: `@${tid}` };
      }
    }
    this.game.particles.icons(TEX.happy, x, y + 1.9, z, 6, 0.4);
    return e;
  }

  // Makes `e` the trader: an id (their llamas' leads name it), a name, their looks, how long they
  // stay, and where they came (they keep near it).
  dress(e, tid, name, leaves, home) {
    const looks = CIV_LOOKS.wanderer, h = hashString(tid);
    Object.assign(e, {
      tid, rid: `wt:${tid}`, role: 'wanderer', name, label: name, skin: looks[h % looks.length], village: null, resident: null,
      path: null, pathI: 0, goalKey: '', state: 'idle', talking: null, fear: 0, aggro: null, doorsOpen: [], stuck: 0, repaths: 0, idle: 0,
      workAnim: 0, voice: 0.8 + ((h >> 8) % 100) / 180, restAt: null, leaves, home, stroll: 0,
    });
    e.held = null;
  }
  // One from a save (or sent over the network): `s` as mobExtra wrote it.
  restore(e, s) {
    const tid = typeof s.tid === 'string' && /^[a-z0-9]{1,24}$/.test(s.tid) ? s.tid : Math.random().toString(36).slice(2, 10);
    const name = typeof s.n === 'string' && s.n ? s.n.slice(0, 40) : NAMES[hashString(tid) % NAMES.length];
    const home = Array.isArray(s.hm) && s.hm.length === 2 && s.hm.every(Number.isFinite) ? { x: s.hm[0], z: s.hm[1] } : { x: e.x, z: e.z };
    this.dress(e, tid, name, Number.isInteger(s.lv) ? Math.max(1, Math.min(s.lv, STAY + 12000)) : STAY, home);
    if (typeof s.sk === 'string' && CIV_LOOKS.wanderer.includes(s.sk)) e.skin = s.sk;
  }

  // Twenty times a second: talking, running from danger, strolling about near where they came;
  // and when their time's up, off they go.
  think(e) {
    const game = this.game;
    if (--e.leaves <= 0 && !e.talking) { this.leave(e); return; }
    e.fear = Math.max(0, e.fear - 1);
    if (e.talking) {
      const who = e.talking;
      e.moving = false;
      e.yaw = Math.atan2(-(who.x - e.x), -(who.z - e.z));
      e.lookAt = who;
      if (Math.hypot(who.x - e.x, who.z - e.z) > 8) e.talking = null;
      return;
    }
    // (Monsters close by, or whoever hurt them: away at a run.)
    const danger = this.ents.list.find((o) => o.kind === 'mob' && o.def.hostile && !o.dead && !o.dying && Math.hypot(o.x - e.x, o.z - e.z) < 8 &&
      Math.abs(o.y - e.y) < 4) ?? (e.fear > 0 ? e.fearFrom : null);
    if (danger) {
      e.yaw = Math.atan2(e.x - danger.x, e.z - danger.z) + (Math.random() - 0.5) * 0.4;
      e.moving = true; e.speedMul = 1.7;
      return;
    }
    e.speedMul = 1;
    if (--e.stroll > 0) return;
    e.stroll = 40 + Math.floor(Math.random() * 100);
    const dx = e.home.x - e.x, dz = e.home.z - e.z;
    if (Math.hypot(dx, dz) > 12) { e.yaw = Math.atan2(-dx, -dz); e.moving = true; }
    else if (Math.random() < 0.5 && game.env.daylight > 0.3) { e.yaw = Math.random() * Math.PI * 2; e.moving = true; }
    else e.moving = false;
  }

  // Hurt: they run from whoever did it.
  hurt(e, from) { e.fear = 100; e.fearFrom = from ?? null; }

  // Time to go: the trader and the llamas still on their leads vanish, in a puff.
  leave(e) {
    const game = this.game;
    for (const o of [e, ...this.ents.list.filter((o) => ledBy(o, e.tid))]) {
      o.dead = true;
      game.net?.entityGone?.(o, 'x');
      game.particles.smoke(o.x, o.y + o.h * 0.5, o.z, 8, o.hw + 0.2);
    }
  }
}
