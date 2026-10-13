// Devil Fruit powers (the One Piece mod): eating a fruit, its moves on Z X C V F, energy and
// cooldowns, mastery, the curse of the sea and the fruits' other rules, fruits turning up under
// trees, and the move bar. The fruits and their moves are data (fruits.js); this carries them out.
//
// How a move goes: the caster's own game checks it can be used (unlocked, off cooldown, energy, out
// of the sea), moves them for a dash, a blink or flight, and shows and sounds it at once. What it does
// to others is worked out by the host (the only one who moves creatures): a guest sends it to the
// host (net.power), the host carries it out (cast) and shows it to everyone else (net.powerFx). The
// damage done comes back to the caster as mastery.
//
// Feel (see feel.js and the game-feel skill): every move is a small, medium or large moment - its
// shake and hit-stop scale with it - with a sound of its element and particles in its colours.
import { FRUITS, MOVE_KEYS, isLogia, masteryScale, unlocked, newPower, gainMastery, MAX_ENERGY, ENERGY_REGEN, xpToNext, UNLOCK } from './fruits.js';
import { TEX } from './textures.js';
import { B, WATERLIKE, SOLID } from './blocks.js';
import { I } from './items.js';

// What each element looks like and sounds like: particle colour (0-255), whether it glows.
const EL = {
  rubber: { tint: [222, 168, 130] },
  fire: { tint: [255, 140, 40], glow: true },
  ice: { tint: [170, 225, 255], glow: true },
  lightning: { tint: [255, 245, 120], glow: true },
  sand: { tint: [220, 185, 110] },
  dark: { tint: [40, 10, 70] },
  quake: { tint: [235, 245, 255], glow: true },
  light: { tint: [255, 255, 200], glow: true },
  magma: { tint: [255, 80, 20], glow: true },
  smoke: { tint: [210, 210, 210] },
  surgical: { tint: [110, 180, 255], glow: true },
  phoenix: { tint: [90, 190, 255], glow: true },
};
const TIER = { z: 'small', x: 'medium', c: 'medium', v: 'large', f: 'small' };
const rnd = (a, b) => a + Math.random() * (b - a);
const norm = (v) => { const l = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / l, v[1] / l, v[2] / l]; };

export class Powers {
  constructor(game) {
    this.game = game;
    this.power = null;          // { v, fruit, mastery, xp } (fruits.js newPower)
    this.memory = {};           // mastery reached with fruits eaten before: { fruit: [mastery, xp] }
    this.energy = MAX_ENERGY;
    this.cd = {};               // key -> seconds left
    this.dash = null;           // { d, speed, until, lift }
    this.flyUntil = 0;
    this.room = null;           // Ope's ROOM: { x, y, z, r, until }
    this.buffUntil = 0;         // Gear Second's steam
    this.shots = [];            // projectiles in flight (seen everywhere; they hurt on the host)
    this.later = [];            // repeats and delayed strikes: { at, fn }
    this.spawnIn = 240;         // seconds till the next fruit may turn up under a tree
    this.wet = false;
    this.hud = null;
    this.hudKey = '';
    this.clock = 0;
  }
  get fruit() { return this.power ? FRUITS[this.power.fruit] : null; }
  get on() { return !!this.power; }

  // ------------------------------------------------------------ saving
  serialize() { return this.power ? { ...this.power, mem: this.memory } : (Object.keys(this.memory).length ? { mem: this.memory } : null); }
  load(d) {
    this.power = null; this.memory = {}; this.energy = MAX_ENERGY; this.cd = {}; this.dash = null; this.flyUntil = 0; this.room = null; this.shots = []; this.later = [];
    if (!d || typeof d !== 'object') return this.render(true);
    if (d.mem && typeof d.mem === 'object') {
      for (const [k, v] of Object.entries(d.mem)) if (FRUITS[k] && Array.isArray(v)) this.memory[k] = [Math.max(1, Math.min(100, v[0] | 0)), Math.max(0, +v[1] || 0)];
    }
    if (FRUITS[d.fruit]) this.power = { v: 1, fruit: d.fruit, mastery: Math.max(1, Math.min(100, d.mastery | 0)), xp: Math.max(0, +d.xp || 0) };
    this.render(true);
  }

  // ------------------------------------------------------------ eating and losing a fruit
  // The player ate the fruit `id`. One fruit a lifetime: a second tears its eater apart.
  eat(id) {
    const g = this.game, f = FRUITS[id];
    if (!f) return;
    if (this.power) {
      g.ui.message([['The two Devil Fruits\' powers tear you apart!', '#e05050']]);
      g.damage(1000, 'You ate a second Devil Fruit', true);
      return;
    }
    const mem = this.memory[id];
    this.power = newPower(id);
    if (mem) [this.power.mastery, this.power.xp] = mem;
    this.energy = MAX_ENERGY;
    this.cd = {};
    g.ui.message([['It tastes awful... ', '#d0c0a0'], [`you have eaten the ${f.name}! `, '#ffd36a'], ['You can never swim again.', '#80b8ff']]);
    g.ui.message(`${f.type}: ${f.passive}. Moves on Z X C V and F (more open up as you master it).`, '#c8c8c8');
    g.audio.levelUp?.();
    g.feel?.hit('medium');
    this.burstFx(g.player.x, g.player.y + 1, g.player.z, f.moves.z.el ?? 'surgical', 40, 3);
    this.taken(id, true);
    this.render(true);
  }
  // The user died: as in the story, the power leaves them and is reborn in a fruit somewhere in the
  // world (the mastery they'd reached is remembered, should they eat the same fruit again).
  died() {
    if (!this.power) return;
    const id = this.power.fruit;
    this.memory[id] = [this.power.mastery, this.power.xp];
    this.power = null;
    this.dash = null; this.flyUntil = 0; this.room = null;
    this.game.ui.message(`The power of the ${FRUITS[id].name} leaves you, to be reborn in a fruit somewhere in the world.`, '#c8a0ff');
    this.taken(id, false);
    this.render(true);
  }
  // Keeps the world's list of the fruits someone has eaten (none of those turns up again till its
  // user dies). A guest tells the host.
  taken(id, eaten) {
    const g = this.game;
    if (g.net?.guest) { g.net.fruitTaken?.(id, eaten); return; }
    if (!g.meta) return;
    g.meta.devilFruits ??= {};
    if (eaten) g.meta.devilFruits[id] = g.uid ?? 1; else delete g.meta.devilFruits[id];
  }

  // ------------------------------------------------------------ the rules of a Devil Fruit
  // The damage a user takes (null: none at all), from `amount` and its `cause`.
  passive(cause, amount) {
    const id = this.power?.fruit;
    if (!id) return amount;
    const c = String(cause);
    if ((id === 'mera' || id === 'magu') && /flames|lava|burned|fire/i.test(c)) return null;
    if ((id === 'goro' || id === 'gomu') && /lightning/i.test(c)) return null;
    // A Logia's body lets ordinary blows and arrows pass through (not when soaked by the sea).
    if (isLogia(id) && !this.wet && /^You were (slain|shot)/.test(c)) {
      const p = this.game.player;
      this.burstFx(p.x, p.y + 1, p.z, FRUITS[id].moves.z.el, 12, 1);
      return null;
    }
    if (id === 'yami') return amount * 1.25;
    return amount;
  }
  get noFall() { return this.power?.fruit === 'gomu'; }

  // ------------------------------------------------------------ each frame
  update(dt, active) {
    const g = this.game, p = g.player;
    this.clock += dt;
    for (const k of MOVE_KEYS) if (this.cd[k] > 0) this.cd[k] = Math.max(0, this.cd[k] - dt);
    // The curse of the sea: waist-deep in water a user is drained and can't use their power.
    const wasWet = this.wet;
    this.wet = !!this.power && !p.flying && (p.inWater && (p.headInWater || g.inWaterAt?.(p.x, p.y + 0.9, p.z)));
    if (this.power && this.wet && !wasWet) g.ui.message('The sea saps your strength - you sink like a stone!', '#80b8ff');
    if (this.power) this.energy = this.wet ? Math.max(0, this.energy - 12 * dt) : Math.min(MAX_ENERGY, this.energy + ENERGY_REGEN * (this.flyUntil > this.clock ? 0.5 : 1) * dt);
    // Keys.
    if (active && this.power) for (const k of MOVE_KEYS) if (g.keyHit(`power_${k}`)) this.use(k);
    // A dash carries the player along.
    if (this.dash) {
      if (this.clock > this.dash.until || g.state === 'dead') this.dash = null;
      else {
        const { d, speed, lift } = this.dash;
        p.vx = d[0] * speed; p.vz = d[2] * speed; p.vy = Math.max(p.vy, d[1] * speed * 0.6 + (lift ?? 0) * 10);
        if (Math.random() < 0.8) this.puff(p.x, p.y + 0.9, p.z, this.dash.el, 0, 0, 0, 0.4, 0.18);
      }
    }
    // Flight runs out.
    if (this.flyUntil && this.clock > this.flyUntil) {
      this.flyUntil = 0;
      if (!g.creative) p.flying = false;
      g.ui.message('Your flight runs out.', '#c8c8c8');
    }
    if (this.flyUntil > this.clock && Math.random() < 0.5) {
      const el = this.power?.fruit === 'moku' ? 'smoke' : 'phoenix';
      this.puff(p.x + rnd(-0.6, 0.6), p.y + 0.6, p.z + rnd(-0.6, 0.6), el, 0, -1, 0, 0.6, 0.2);
    }
    // Gear Second: steam pours off you.
    if (this.buffUntil > this.clock && Math.random() < 0.4) g.particles.smoke(p.x + rnd(-0.5, 0.5), p.y + 0.3, p.z + rnd(-0.5, 0.5), 1, 0.3);
    // The Phoenix's blue flames heal (half a heart every 3 seconds).
    if (this.power?.fruit === 'phoenix' && g.health > 0 && g.health < 20 && !this.wet) {
      this.regen = (this.regen ?? 0) + dt;
      if (this.regen > 3) { this.regen = 0; g.health = Math.min(20, g.health + 1); this.puff(p.x, p.y + 1, p.z, 'phoenix', 0, 1.5, 0, 0.6, 0.2); }
    }
    // ROOM's sphere, faintly shown; it closes when time's up.
    if (this.room) {
      if (this.clock > this.room.until) this.room = null;
      else if (Math.random() < 0.6) {
        const a = Math.random() * Math.PI * 2, u = rnd(-1, 1), r = Math.sqrt(1 - u * u) * this.room.r;
        this.puff(this.room.x + Math.cos(a) * r, this.room.y + u * this.room.r, this.room.z + Math.sin(a) * r, 'surgical', 0, 0, 0, 1.2, 0.25);
      }
    }
    // Repeats and delayed blows.
    for (let i = this.later.length - 1; i >= 0; i--) if (this.clock >= this.later[i].at) { const l = this.later[i]; this.later.splice(i, 1); l.fn(); }
    this.updateShots(dt);
    if (this.game.meta && !this.game.net?.guest) this.spawnTick(dt);
    this.render();
  }

  // ------------------------------------------------------------ using a move
  use(key) {
    const g = this.game, p = g.player, pw = this.power, f = this.fruit;
    if (!pw || g.state !== 'play' || g.spectator) return;
    const m = f.moves[key];
    const say = (t) => { g.ui.message(t, '#e8a080'); };
    if (!unlocked(key, pw.mastery)) { say(`${m.name} opens up at mastery ${UNLOCK[key]}.`); return; }
    if (this.wet) { say('The sea has drained your power.'); return; }
    if (this.cd[key] > 0) return;
    if (this.energy < m.cost) { say('Not enough energy.'); return; }
    if (m.needsRoom && !this.inRoom()) { say('You need a ROOM first (Z).'); return; }
    this.energy -= m.cost;
    this.cd[key] = m.cd;
    const d = p.lookDir(), o = [p.x, p.eyeY - 0.1, p.z];
    // What happens to you.
    switch (m.kind) {
      case 'dash': this.dash = { d, speed: m.speed, lift: m.lift, until: this.clock + m.time, el: m.el ?? f.moves.z.el }; break;
      case 'fly': this.flyUntil = this.clock + m.time; p.flying = true; break;
      case 'buff':
        if (m.room) this.room = { x: p.x, y: p.y + 1, z: p.z, r: m.room, until: this.clock + m.time };
        else { this.buffUntil = this.clock + m.time; for (const [name, lvl] of Object.entries(m.effects ?? {})) if (name !== 'haste') g.addEffect(name, m.time, lvl); }
        break;
      case 'heal': g.health = Math.min(20, g.health + m.amount); break;
      case 'blink': {
        const to = this.reach(o, d, m.range);
        this.trailFx(o, to, f.moves.x.el ?? 'light', 30);
        p.x = to[0]; p.y = to[1] - 1.5; p.z = to[2]; p.vx = p.vy = p.vz = 0; p.fallDistance = 0;
        break;
      }
      default: break;
    }
    // What it looks and sounds like, here and now.
    this.fx(pw.fruit, key, o, d, true);
    g.feel?.hit(TIER[key], 0.6);
    // What it does to others.
    if (g.net?.guest) g.net.power?.(pw.fruit, pw.mastery, key, o, d);
    else this.cast(null, pw.fruit, pw.mastery, key, o, d);
    this.render(true);
  }
  inRoom() { const r = this.room, p = this.game.player; return !!r && Math.hypot(p.x - r.x, p.y - r.y, p.z - r.z) <= r.r + 1; }
  // Where a line out from `o` along `d` stops (a block in the way, or `range`): just short of it.
  // (Only solid blocks stop it: a move goes through tall grass and flowers.)
  reach(o, d, range) {
    const hit = this.solidRay(o, d, range);
    const t = hit !== null ? Math.max(0, hit - 0.6) : range;
    return [o[0] + d[0] * t, o[1] + d[1] * t, o[2] + d[2] * t];
  }
  // How far along `d` from `o` a solid block is (null: none within `max`).
  solidRay(o, d, max) {
    const w = this.game.world;
    for (let t = 0; t <= max; t += 0.2) {
      const id = w.getBlock(Math.floor(o[0] + d[0] * t), Math.floor(o[1] + d[1] * t), Math.floor(o[2] + d[2] * t));
      if (id && SOLID[id]) return t;
    }
    return null;
  }

  // Credit for damage done with a move: mastery (and word when a move opens up).
  credit(dmg) {
    const pw = this.power;
    if (!pw || dmg <= 0) return;
    const before = pw.mastery, up = gainMastery(pw, dmg);
    if (up) {
      this.game.ui.message(`${this.fruit.name}: mastery ${pw.mastery}`, '#ffd36a');
      for (const k of MOVE_KEYS) if (UNLOCK[k] > before && UNLOCK[k] <= pw.mastery) this.game.ui.message(`New move: ${this.fruit.moves[k].name} (${k.toUpperCase()})`, '#ffd36a');
      this.game.audio.levelUp?.();
    }
    this.render(true);
  }

  // ------------------------------------------------------------ what a move does (the host)
  // `caster`: null for this player, else the guest (one of players()). Returns nothing; damage done
  // is credited as it lands (to this player, or sent back to the guest).
  cast(caster, fruit, mastery, key, o, d) {
    const g = this.game, f = FRUITS[fruit], m = f?.moves[key];
    if (!m) return;
    const who = caster ?? g.players()[0];
    const scale = masteryScale(mastery);
    const credit = (n) => { if (n <= 0) return; if (caster) g.net?.powerXp?.(caster.addr, n); else this.credit(n); };
    // (Everyone else sees it; the host sees a guest's here.)
    g.net?.powerFx?.(fruit, key, o, d, caster?.addr ?? null);
    if (caster) this.fx(fruit, key, o, d, false, true);
    const hitAll = (list, dmg, extra = {}) => { let n = 0; for (const e of list) n += this.hurt(e, dmg * scale, m, who, o, extra); credit(n); };
    switch (m.kind) {
      case 'beam': {
        const go = () => {
          const dd = m.spread ? norm([d[0] + rnd(-m.spread, m.spread), d[1] + rnd(-m.spread, m.spread), d[2] + rnd(-m.spread, m.spread)]) : d;
          const end = this.reach(o, dd, m.range);
          hitAll(this.alongLine(o, end, (m.width ?? 0.8) / 2, who), m.dmg);
          if (m.radius) hitAll(this.near(end, m.radius, who), m.dmg * 0.6);
          if (m.el === 'lightning') this.later.push({ at: this.clock + 0.05, fn: () => { if (Math.random() < 0.5) g.lightning?.strike(end[0], end[1], end[2]); } });
        };
        go();
        for (let i = 1; i < (m.repeat ?? 1); i++) this.later.push({ at: this.clock + i * m.every, fn: go });
        break;
      }
      case 'shot': this.launch(m, o, d, { host: true, who, credit, scale }); break;
      case 'burst': {
        hitAll(this.near([o[0], o[1] - 1, o[2]], m.radius, who), m.dmg);
        if (m.iceSea) this.freezeSea(o, m.radius);
        if (m.el === 'lightning') for (let i = 0; i < 3; i++) this.later.push({ at: this.clock + i * 0.15, fn: () => g.lightning?.strike(o[0] + rnd(-m.radius, m.radius), o[1] - 1, o[2] + rnd(-m.radius, m.radius)) });
        break;
      }
      case 'zone': {
        const at = this.reach(o, d, m.range), ground = this.ground(at);
        const hitZone = () => hitAll(this.near(ground, m.radius, who), m.dmg / (m.ticks ?? 1));
        hitZone();
        for (let i = 1; i < (m.ticks ?? 1); i++) this.later.push({ at: this.clock + i * 0.5, fn: hitZone });
        for (let i = 0; i < (m.strike ?? 0); i++) {
          this.later.push({ at: this.clock + i * 0.18, fn: () => {
            const r = i ? m.radius : 0;
            g.lightning?.strike(ground[0] + rnd(-r, r), ground[1], ground[2] + rnd(-r, r));
          } });
        }
        break;
      }
      case 'dash':
        // (What's in the way along the dash is hit as you pass.)
        if (m.dmg) hitAll(this.alongLine(o, this.reach(o, d, m.speed * m.time), 1, who), m.dmg);
        if (m.iceTrail) this.freezeSea(this.reach(o, d, m.speed * m.time * 0.5), 4);
        break;
      case 'swap': {
        const e = this.aimed(o, d, m.range, who);
        if (e) {
          // You and it change places.
          const [ex, ey, ez] = [e.x, e.y, e.z];
          e.x = who.x; e.y = who.y; e.z = who.z;
          if (caster) g.net?.powerMove?.(caster.addr, ex, ey, ez); else { g.player.x = ex; g.player.y = ey; g.player.z = ez; }
        }
        break;
      }
      default: break;
    }
  }
  // Hurts creature `e` with move `m` (its element's touch too); returns the damage done.
  hurt(e, dmg, m, who, o, extra) {
    const E = this.game.entities;
    if (!e || e.dead || e.dying || e.health <= 0) return 0;
    const before = e.health;
    const n = Math.max(0.5, dmg * rnd(0.9, 1.1));
    e.hurt = 0; // (a move's blows land however fast they come)
    const fire = m.el === 'fire' ? 5 : m.el === 'magma' ? 8 : m.el === 'phoenix' ? 3 : m.el === 'lightning' ? 2 : 0;
    E.hurtMob(e, n, who, m.knock ?? 0.4, fire ? { fire } : null);
    if (m.el === 'ice' || m.freeze) e.slowed = Math.max(e.slowed ?? 0, (m.freeze ?? 3) * 20);
    if (m.slow || m.blind) e.slowed = Math.max(e.slowed ?? 0, (m.slow ?? m.blind) * 20);
    if (m.el === 'sand') e.poisoned = Math.max(e.poisoned ?? 0, 60);
    if (m.pull && who) { const dx = who.x - e.x, dz = who.z - e.z, l = Math.hypot(dx, dz) || 1; e.vx = (dx / l) * 9; e.vz = (dz / l) * 9; e.vy = 3; }
    if (m.lift) e.vy = 8 * m.lift;
    if (m.sink) e.vy = -8;
    if (m.el === 'quake') e.vy = Math.max(e.vy ?? 0, 6);
    return Math.max(0, before - Math.max(0, e.health));
  }
  // Creatures within `r` of point `c`; along the segment a-b within `r`; the one aimed at.
  mobs(who) { return this.game.entities.list.filter((e) => e.kind === 'mob' && !e.dead && !e.dying && e !== who); }
  near(c, r, who) { return this.mobs(who).filter((e) => Math.hypot(e.x - c[0], (e.y + (e.h ?? 1) / 2) - c[1], e.z - c[2]) <= r + (e.hw ?? 0.3)); }
  alongLine(a, b, r, who) {
    const ab = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], L2 = ab[0] ** 2 + ab[1] ** 2 + ab[2] ** 2 || 1;
    return this.mobs(who).filter((e) => {
      const c = [e.x - a[0], e.y + (e.h ?? 1) / 2 - a[1], e.z - a[2]], t = Math.max(0, Math.min(1, (c[0] * ab[0] + c[1] * ab[1] + c[2] * ab[2]) / L2));
      return Math.hypot(c[0] - ab[0] * t, c[1] - ab[1] * t, c[2] - ab[2] * t) <= r + (e.hw ?? 0.3) + (e.h ?? 1) * 0.3;
    });
  }
  aimed(o, d, range, who) {
    const end = this.reach(o, d, range);
    return this.alongLine(o, end, 0.6, who).sort((p, q) => Math.hypot(p.x - o[0], p.z - o[2]) - Math.hypot(q.x - o[0], q.z - o[2]))[0] ?? null;
  }
  // The ground under a point (the first solid block down, within 24).
  ground(at) {
    const w = this.game.world;
    for (let y = Math.floor(at[1]); y > at[1] - 24; y--) if (SOLID[w.getBlock(Math.floor(at[0]), y, Math.floor(at[2]))]) return [at[0], y + 1, at[2]];
    return at;
  }
  isWater(id) { return !!WATERLIKE[id]; }
  // Ice Age: the sea's surface within `r` freezes.
  freezeSea(c, r) {
    const w = this.game.world, cx = Math.floor(c[0]), cz = Math.floor(c[2]);
    let n = 0;
    for (let dx = -r; dx <= r; dx++) for (let dz = -r; dz <= r; dz++) {
      if (dx * dx + dz * dz > r * r || n > 900) continue;
      for (let y = Math.floor(c[1]) + 3; y > c[1] - 8; y--) {
        const id = w.getBlock(cx + dx, y, cz + dz);
        if (!id) continue;
        if (this.isWater(id) && !w.getBlock(cx + dx, y + 1, cz + dz)) { w.setBlock(cx + dx, y, cz + dz, B.ice); n++; }
        break;
      }
    }
  }

  // ------------------------------------------------------------ projectiles
  // Sends shots of move `m` from `o` along `d` (or down from above where you're looking).
  launch(m, o, d, host) {
    for (let i = 0; i < (m.count ?? 1); i++) {
      let from = [o[0] + d[0] * 1.2, o[1] - 0.2 + d[1] * 1.2, o[2] + d[2] * 1.2], dir = d;
      if (m.spread) dir = norm([d[0] + rnd(-m.spread, m.spread), d[1] + rnd(-m.spread, m.spread), d[2] + rnd(-m.spread, m.spread)]);
      if (m.from === 'above') {
        const at = this.ground(this.reach(o, d, 30)), sc = m.scatter ?? 0;
        const tx = at[0] + rnd(-sc, sc), tz = at[2] + rnd(-sc, sc);
        from = [tx - d[0] * 6, at[1] + 26, tz - d[2] * 6];
        dir = norm([tx - from[0], at[1] - from[1], tz - from[2]]);
      }
      this.shots.push({ x: from[0], y: from[1], z: from[2], v: dir.map((c) => c * m.speed), m, age: i * (m.from === 'above' ? 0.0 : 0.04) - (m.from === 'above' ? i * 0.12 : 0), host, life: 3.5 });
    }
  }
  updateShots(dt) {
    for (let i = this.shots.length - 1; i >= 0; i--) {
      const s = this.shots[i];
      s.age += dt;
      if (s.age < 0) continue;
      const step = Math.hypot(...s.v) * dt, dir = norm(s.v);
      const hitT = this.solidRay([s.x, s.y, s.z], dir, step), hitB = hitT !== null ? { t: hitT } : null;
      const nx = s.x + s.v[0] * dt, ny = s.y + s.v[1] * dt, nz = s.z + s.v[2] * dt;
      const mob = s.host ? this.alongLine([s.x, s.y, s.z], [nx, ny, nz], s.m.size ?? 0.3, s.host.who)[0] : null;
      // Its trail.
      const el = EL[s.m.el] ?? EL.fire;
      for (let k = 0; k < 1 + (s.m.size ?? 0.3) * 4; k++) this.puff(s.x + rnd(-1, 1) * (s.m.size ?? 0.3), s.y + rnd(-1, 1) * (s.m.size ?? 0.3), s.z + rnd(-1, 1) * (s.m.size ?? 0.3), s.m.el, 0, 0, 0, 0.35, 0.07 + (s.m.size ?? 0.3) * 0.12);
      if (hitB || mob || s.age > s.life) {
        const at = hitB ? [s.x + dir[0] * hitB.t, s.y + dir[1] * hitB.t, s.z + dir[2] * hitB.t] : [nx, ny, nz];
        this.impactFx(at, s.m);
        if (s.host) {
          let n = 0;
          const list = s.m.radius ? this.near(at, s.m.radius, s.host.who) : mob ? [mob] : [];
          for (const e of list) n += this.hurt(e, s.m.dmg * s.host.scale * (e === mob || !s.m.radius ? 1 : 0.8), s.m, s.host.who, at);
          s.host.credit(n);
        }
        this.shots.splice(i, 1);
        void el;
        continue;
      }
      s.x = nx; s.y = ny; s.z = nz;
    }
  }

  // ------------------------------------------------------------ how moves look and sound
  // A tinted particle of element `el`.
  puff(x, y, z, el, vx, vy, vz, life = 0.5, size = 0.1) {
    const E = EL[el] ?? EL.surgical, p = this.game.player;
    // (Nothing right in front of the eyes, where a particle would fill the screen.)
    if (p && Math.hypot(x - p.x, y - p.eyeY, z - p.z) < 1.3 && this.game.view === 0) return;
    if (el === 'smoke' || el === 'sand' || el === 'dark') {
      this.game.particles.add({ x, y, z, vx, vy, vz, life, age: 0, size: size * 1.1, layer: TEX.smoke, flags: 0, tint: E.tint, u: 0, v: 0, smoke: true });
    } else {
      this.game.particles.add({ x, y, z, vx, vy, vz, life, age: 0, size, layer: TEX.spark, flags: 1, tint: E.tint, u: 0, v: 0, whole: true, glow: !!E.glow, spark: true });
    }
  }
  burstFx(x, y, z, el, n = 30, speed = 4) {
    for (let i = 0; i < n; i++) {
      const u = rnd(-1, 1), a = Math.random() * Math.PI * 2, r = Math.sqrt(1 - u * u), k = speed * rnd(0.4, 1);
      this.puff(x, y, z, el, r * Math.cos(a) * k, u * k, r * Math.sin(a) * k, rnd(0.3, 0.7), rnd(0.06, 0.14));
    }
  }
  ringFx(c, r, el, n = 60) {
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2, k = r * 2.2;
      this.puff(c[0] + Math.cos(a) * 0.8, c[1] + 0.2, c[2] + Math.sin(a) * 0.8, el, Math.cos(a) * k, rnd(0, 1), Math.sin(a) * k, 0.45, 0.12);
    }
  }
  trailFx(a, b, el, n = 24, size = 0.1, life = 0.35) {
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      this.puff(a[0] + (b[0] - a[0]) * t + rnd(-0.1, 0.1), a[1] + (b[1] - a[1]) * t + rnd(-0.1, 0.1), a[2] + (b[2] - a[2]) * t + rnd(-0.1, 0.1), el, 0, 0, 0, life + t * 0.15, size);
    }
  }
  impactFx(at, m) {
    const g = this.game, p = g.player;
    const big = (m.radius ?? 1) >= 4 || (m.dmg ?? 0) >= 14;
    this.burstFx(at[0], at[1], at[2], m.el, big ? 50 : 18, big ? 7 : 4);
    if (m.radius) this.ringFx([at[0], at[1] - 0.5, at[2]], m.radius, m.el, big ? 70 : 30);
    const near = Math.max(0, 1 - Math.hypot(at[0] - p.x, at[1] - p.y, at[2] - p.z) / 40);
    g.feel?.hit(big ? 'large' : 'medium', near);
    this.sound(m.el, 'impact', { x: at[0], y: at[1], z: at[2] }, big);
  }
  // Move `key` of `fruit` from `o` along `d`, as everyone sees it (`local`: the caster's own game;
  // `real`: its shots are already flying here, being the host's, so none are added just for show).
  fx(fruit, key, o, d, local = false, real = false) {
    const f = FRUITS[fruit], m = f?.moves[key];
    if (!m) return;
    const g = this.game, at = { x: o[0], y: o[1], z: o[2] };
    this.sound(m.el ?? f.moves.z.el, m.kind, at, key === 'v');
    switch (m.kind) {
      case 'beam': {
        const show = () => {
          const dd = m.spread ? norm([d[0] + rnd(-m.spread, m.spread), d[1] + rnd(-m.spread, m.spread), d[2] + rnd(-m.spread, m.spread)]) : d;
          const end = this.reach(o, dd, m.range), n = Math.ceil(Math.hypot(end[0] - o[0], end[1] - o[1], end[2] - o[2]) * 3);
          // (A rubber arm is a thick line out and back; light and lightning a thin bright one.)
          this.trailFx([o[0] + dd[0] * 1.4, o[1] - 0.3 + dd[1] * 1.4, o[2] + dd[2] * 1.4], end, m.el, n, m.el === 'rubber' ? 0.16 * (m.width ?? 1) : 0.09 * (m.width ?? 1), m.el === 'rubber' ? 0.6 : 0.4);
          this.burstFx(end[0], end[1], end[2], m.el, m.dmg >= 10 ? 26 : 10, 3);
          if (m.radius) this.ringFx(end, m.radius, m.el, 30);
          if (m.ground) this.ringFx(this.ground(end), 2, m.el, 20);
        };
        show();
        for (let i = 1; i < (m.repeat ?? 1); i++) this.later.push({ at: this.clock + i * m.every, fn: () => { show(); this.sound(m.el, 'beam', at, false); } });
        break;
      }
      case 'shot': if (!real && (!local || g.net?.guest)) this.launch(m, o, d, null); break;
      case 'burst':
        this.ringFx([o[0], o[1] - 1.2, o[2]], m.radius, m.el, 90);
        this.burstFx(o[0], o[1] - 0.5, o[2], m.el, 40, m.radius * 0.8);
        if (local) g.feel?.hit(m.radius >= 10 ? 'large' : 'medium');
        break;
      case 'zone': {
        const c = this.ground(this.reach(o, d, m.range));
        this.ringFx(c, m.radius, m.el, 80);
        for (let i = 0; i < 40; i++) this.puff(c[0] + rnd(-m.radius, m.radius) * 0.7, c[1] + rnd(0, 3), c[2] + rnd(-m.radius, m.radius) * 0.7, m.el, 0, m.lift ? 6 : m.sink ? -3 : 1, 0, 0.8, 0.14);
        if (m.from === 'above') this.trailFx([c[0], c[1] + 24, c[2]], c, m.el, 40, 0.25);
        break;
      }
      case 'dash': this.burstFx(o[0], o[1] - 0.6, o[2], m.el ?? f.moves.z.el, 16, 3); break;
      case 'buff':
        if (m.room) this.ringFx([o[0], o[1] - 1, o[2]], m.room, 'surgical', 120);
        else g.particles.smoke(o[0], o[1] - 1.4, o[2], 16, 0.8, true);
        break;
      case 'heal': this.burstFx(o[0], o[1] - 0.6, o[2], 'phoenix', 40, 2); break;
      case 'fly': this.burstFx(o[0], o[1] - 0.6, o[2], fruit === 'moku' ? 'smoke' : 'phoenix', 30, 3); break;
      case 'swap': this.burstFx(o[0], o[1] - 0.6, o[2], 'surgical', 20, 2); break;
      default: break;
    }
  }
  // The sound of element `el`: a move going off (`kind`) or landing ('impact'), synthesized (see
  // the audio-design skill: a little pitch wobble each time, so repeats don't sound mechanical).
  sound(el, kind, at, big = false) {
    const a = this.game.audio, v = rnd(0.94, 1.06), vol = big ? 0.9 : 0.55;
    if (!a?.tone) return;
    const whoosh = () => a.hiss(at, { f: 900 * v, q: 0.8, time: 0.25, volume: vol * 0.5, sweep: 2400 * v });
    switch (el) {
      case 'rubber': a.tone(at, { type: 'triangle', f0: 180 * v, f1: 420 * v, time: 0.12, volume: vol * 0.6 }); a.tone(at, { type: 'square', f0: 520 * v, f1: 90 * v, time: 0.09, volume: vol * 0.3, delay: 0.1 }); break;
      case 'fire': case 'magma': case 'phoenix':
        a.hiss(at, { f: 500 * v, q: 0.5, time: big ? 0.9 : 0.45, volume: vol, sweep: 1600 * v, type: 'lowpass' });
        a.thump?.(at, 90 * v, 40, vol * (el === 'magma' ? 0.9 : 0.5), 0.2); break;
      case 'ice': a.tone(at, { type: 'sine', f0: 2400 * v, f1: 3600 * v, time: 0.18, volume: vol * 0.35 }); a.hiss(at, { f: 6000 * v, q: 3, time: 0.3, volume: vol * 0.4 }); break;
      case 'lightning': a.hiss(at, { f: 3000 * v, q: 0.6, time: 0.25, volume: vol, type: 'highpass' }); a.tone(at, { type: 'sawtooth', f0: 120 * v, f1: 60, time: 0.3, volume: vol * 0.4 }); break;
      case 'quake': a.thump?.(at, 55 * v, 25, vol * 1.2, big ? 0.6 : 0.35); a.hiss(at, { f: 200 * v, q: 0.4, time: 0.5, volume: vol * 0.5, type: 'lowpass' }); break;
      case 'sand': a.hiss(at, { f: 1500 * v, q: 0.4, time: 0.6, volume: vol * 0.7, sweep: 700 * v }); break;
      case 'dark': a.tone(at, { type: 'sine', f0: 140 * v, f1: 50, time: 0.6, volume: vol * 0.7, vibrato: 8, vibratoRate: 9 }); break;
      case 'smoke': a.hiss(at, { f: 1200 * v, q: 0.3, time: 0.5, volume: vol * 0.6 }); break;
      case 'light': a.tone(at, { type: 'sine', f0: 1800 * v, f1: 5200 * v, time: 0.15, volume: vol * 0.5 }); a.tone(at, { type: 'triangle', f0: 900 * v, f1: 2600 * v, time: 0.2, volume: vol * 0.3, delay: 0.03 }); break;
      case 'surgical': a.tone(at, { type: 'sine', f0: 700 * v, f1: 1400 * v, time: 0.2, volume: vol * 0.4 }); a.hiss(at, { f: 4000 * v, q: 6, time: 0.12, volume: vol * 0.4, delay: 0.05 }); break;
      default: whoosh();
    }
    if (kind === 'dash' || kind === 'blink' || kind === 'fly') whoosh();
  }

  // ------------------------------------------------------------ fruits turning up under trees
  // In a One Piece world, now and then a fruit no one has eaten drops under a tree near someone
  // (as in Blox Fruits): it lies there for 20 minutes, then rots away.
  spawnTick(dt) {
    const g = this.game;
    if (!g.world?.gen?.op || g.state !== 'play') return;
    this.spawnIn -= dt;
    if (this.spawnIn > 0) return;
    this.spawnIn = rnd(420, 900);
    const taken = g.meta.devilFruits ?? {}, free = Object.keys(FRUITS).filter((id) => !taken[id]);
    if (!free.length) return;
    // (Rarer fruits are less likely: weight 6 - rarity.)
    let sum = 0;
    for (const id of free) sum += 6 - FRUITS[id].rarity;
    let r = Math.random() * sum, pick = free[0];
    for (const id of free) { r -= 6 - FRUITS[id].rarity; if (r <= 0) { pick = id; break; } }
    const players = g.players().filter((q) => !q.dead && !q.spectator);
    const q = players[Math.floor(Math.random() * players.length)];
    if (!q) return;
    const spot = this.underTree(q.x, q.z);
    if (!spot) { this.spawnIn = 60; return; }
    g.entities.spawnItem(spot[0] + 0.5, spot[1] + 0.3, spot[2] + 0.5, I[`devil_fruit_${pick}`], 1, 0, 0.6, [0, 0, 0], null, 20 * 60);
    const text = 'Something falls from a tree nearby... a strange, swirled fruit.';
    if (q.addr) g.net?.tell?.(q.addr, text); else g.ui.message(text, '#ffd36a');
  }
  // A treasure chest's loot (One Piece worlds): one time in 25, a fruit no one has eaten.
  chestFruit(slots) {
    if (Math.random() > 0.04) return;
    const taken = this.game.meta?.devilFruits ?? {}, free = Object.keys(FRUITS).filter((id) => !taken[id]);
    const empty = slots.findIndex((s) => !s);
    if (free.length && empty >= 0) slots[empty] = { id: I[`devil_fruit_${free[Math.floor(Math.random() * free.length)]}`], count: 1, dmg: 0 };
  }
  // A spot on the ground under leaves, 12-40 blocks from (x, z).
  underTree(x, z) {
    const w = this.game.world;
    for (let tries = 0; tries < 60; tries++) {
      const a = Math.random() * Math.PI * 2, r = rnd(12, 40), bx = Math.floor(x + Math.cos(a) * r), bz = Math.floor(z + Math.sin(a) * r);
      if (!w.isLoaded(bx, bz)) continue;
      let leaves = false;
      for (let y = 140; y > 40; y--) {
        const id = w.getBlock(bx, y, bz);
        if (!id) continue;
        if (/leaves/.test(BNAME[id] ?? '')) { leaves = true; continue; }
        if (leaves && !/log|wood/.test(BNAME[id] ?? '') && !this.isWater(id)) return [bx, y + 1, bz];
        if (!leaves) break;
      }
    }
    return null;
  }

  // ------------------------------------------------------------ the move bar
  // Bottom right (clear of the hotbar, hearts and hunger), sized in GUI pixels (--u) so it scales
  // with the rest; redrawn only when something on it changes. Its slots can be tapped (touch).
  render(force = false) {
    const pw = this.power, g = this.game;
    if (!this.hud) {
      const hud = document.getElementById('hud');
      if (!hud) return;
      this.hud = document.createElement('div');
      this.hud.id = 'powers';
      hud.appendChild(this.hud);
      this.hud.addEventListener('pointerdown', (ev) => {
        const k = ev.target.closest?.('[data-k]')?.dataset.k;
        if (k) { ev.preventDefault(); ev.stopPropagation(); this.use(k); }
      });
    }
    const show = !!pw && g.state !== 'title';
    this.hud.hidden = !show;
    if (!show) return;
    const f = this.fruit;
    const key = `${pw.fruit}|${pw.mastery}|${Math.round(this.energy)}|${this.wet ? 1 : 0}|${MOVE_KEYS.map((k) => Math.ceil(this.cd[k] * 10) || 0).join(',')}`;
    if (!force && key === this.hudKey) return;
    this.hudKey = key;
    const label = (k) => g.keys?.codes?.(`power_${k}`)?.[0]?.replace(/^Key|^Digit/, '') ?? k.toUpperCase();
    this.hud.innerHTML = `<div class="pw-name">${f.name} <span>mastery ${pw.mastery}${pw.mastery < 100 ? ` · ${Math.floor((pw.xp / xpToNext(pw.mastery)) * 100)}%` : ''}</span></div>`
      + `<div class="pw-energy${this.wet ? ' wet' : ''}"><i style="width:${(this.energy / MAX_ENERGY) * 100}%"></i></div>`
      + `<div class="pw-moves">${MOVE_KEYS.map((k) => {
        const m = f.moves[k], open = unlocked(k, pw.mastery), cd = this.cd[k] > 0 ? this.cd[k] / m.cd : 0;
        return `<button data-k="${k}" class="pw-move${open ? '' : ' locked'}${this.energy < m.cost ? ' low' : ''}" title="${m.name}${open ? '' : ` (mastery ${UNLOCK[k]})`}" style="--el:rgb(${(EL[m.el ?? f.moves.z.el] ?? EL.surgical).tint.join(',')});--cd:${cd}">`
          + `<b>${label(k)}</b><small>${open ? m.name.replace(/^Gomu Gomu no |\s*\(.*\)$/g, '') : `🔒 ${UNLOCK[k]}`}</small></button>`;
      }).join('')}</div>`;
  }
}
// Block names by id (for finding leaves and logs).
const BNAME = Object.fromEntries(Object.entries(B).map(([k, v]) => [v, k]));
