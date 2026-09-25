// Fishing. Right-click with a fishing rod to cast: the bobber flies out and settles on the water.
// After a while (sooner in the rain, slower with no open sky above) a fish comes nosing in, a
// wake of bubbles across the surface, and bites: the bobber is pulled under with a splash.
// Right-click again while it's under to reel in a catch (mostly fish, sometimes junk, now and
// then treasure), which is flung to you on the end of the line. Reeling in a creature you've
// hooked tugs it towards you. Everyone fishes for themselves: the bobber isn't shared, but other
// players see your line and float (see multiplayer.js and avatars.js).
import { Body } from './body.js';
import { WATERLIKE, liquidHeight } from './blocks.js';
import { I } from './items.js';
import { TEX } from './textures.js';
import { boxMesh, MODEL_OFFSET } from './models.js';
import { identity, translate, rotateY } from './math.js';
import { randomBook } from './enchanting.js';

// What comes up: [item, weight, least, most, damaged]. Fish 85%, junk 10%, treasure 5%, like the
// original (Luck of the Sea shifts the odds towards treasure).
const FISH = [['cod', 60], ['salmon', 25], ['tropical_fish', 2], ['pufferfish', 13]];
const JUNK = [['lily_pad', 17], ['leather_boots', 10, 1, 1, true], ['leather', 10], ['bone', 10], ['bowl', 10], ['string', 5], ['stick', 5],
  ['rotten_flesh', 10], ['fishing_rod', 2, 1, 1, true], ['wheat_seeds', 6]];
const TREASURE = [['bow', 1, 1, 1, true], ['fishing_rod', 1, 1, 1, true], ['saddle', 1], ['name_tag', 1], ['gold_coin', 1, 4, 10], ['emerald', 1],
  ['golden_apple', 1]];
const pick = (list) => {
  let r = Math.random() * list.reduce((a, e) => a + e[1], 0);
  for (const e of list) if ((r -= e[1]) <= 0) return e;
  return list[0];
};
export function rollCatch(luck = 0) {
  const fish = 85 - luck, junk = Math.max(0, 10 - 2 * luck), treasure = 5 + 2 * luck;
  const r = Math.random() * (fish + junk + treasure);
  const kind = r < fish ? 'fish' : r < fish + junk ? 'junk' : 'treasure';
  const [name, , lo = 1, hi = 1, worn] = pick(kind === 'fish' ? FISH : kind === 'junk' ? JUNK : TREASURE);
  const id = I[name];
  const count = lo + Math.floor(Math.random() * (hi - lo + 1));
  // Now and then the treasure is a book of enchantments.
  if (kind === 'treasure' && Math.random() < 0.25) return { id: I.enchanted_book, count: 1, worn: false, treasure: true, book: true };
  return { id, count, worn: !!worn, treasure: kind === 'treasure' };
}

const G = 12;         // gravity on the bobber (blocks/s²)
const REACH = 32;     // how far the line runs out before it snaps back

export class Fishing {
  constructor(game) {
    this.game = game;
    this.bobber = null;
  }

  get out() { return !!this.bobber; }

  // A right-click with the rod: cast, or reel in.
  use() {
    if (this.bobber) this.reel(); else this.cast();
  }

  cast() {
    const g = this.game, p = g.player, d = p.lookDir();
    const b = new Body(0.125, 0.25);
    b.x = p.x + d[0] * 0.3; b.y = p.eyeY - 0.15; b.z = p.z + d[2] * 0.3;
    const speed = 13 + Math.random() * 2;
    b.vx = d[0] * speed + (Math.random() - 0.5) * 0.8 + p.vx;
    b.vy = d[1] * speed + 2.5 + (Math.random() - 0.5) * 0.8;
    b.vz = d[2] * speed + (Math.random() - 0.5) * 0.8 + p.vz;
    // (The rod's Luck of the Sea and Lure.)
    const ench = g.inv.held?.ench;
    Object.assign(b, { state: 'fly', age: 0, wait: 0, approach: 0, nibble: 0, hooked: null, angle: 0, bob: 0, luck: ench?.luck_of_the_sea ?? 0, lure: ench?.lure ?? 0 });
    this.bobber = b;
    g.audio.hiss({ x: b.x, y: b.y, z: b.z }, { f: 1600, q: 1.2, time: 0.3, volume: 0.25, sweep: 500 });
    g.swingArm();
  }

  // Reels the line in, with whatever is on it.
  reel() {
    const g = this.game, b = this.bobber, p = g.player;
    this.bobber = null;
    let wear = 0;
    if (b.state === 'hooked' && b.hooked && !b.hooked.dead) {
      // A tug towards you.
      const e = b.hooked, dx = p.x - e.x, dy = p.y - e.y, dz = p.z - e.z;
      if (!e.remote) { e.vx += dx * 1.4; e.vz += dz * 1.4; e.vy = Math.max(e.vy, 4 + dy * 1.2); }
      wear = 5;
    } else if (b.nibble > 0) {
      const c = rollCatch(b.luck);
      const dx = p.x - b.x, dy = p.eyeY - 0.5 - b.y, dz = p.z - b.z;
      const dmg = c.worn ? Math.floor(Math.random() * 30) + 10 : 0;
      const extra = c.book ? { ench: randomBook(true) } : null;
      g.entities.spawnItem(b.x, b.y + 0.2, b.z, c.id, c.count, dmg, 0, [dx * 1.8, dy * 1.25 + 8, dz * 1.8], extra);
      g.dropXp(p.x, p.y + 0.5, p.z, 1 + Math.floor(Math.random() * 6));
      g.audio.splash(0.3, { x: b.x, y: b.y, z: b.z });
      wear = 1;
    } else if (b.state === 'ground') wear = 2;
    g.audio.tick({ x: p.x, y: p.eyeY, z: p.z }, 0.35, 1400);
    g.audio.tick({ x: p.x, y: p.eyeY, z: p.z }, 0.25, 1100);
    g.swingArm();
    if (wear && !g.creative && g.inv.held?.id === I.fishing_rod) {
      if (g.inv.damageHeld(wear)) g.audio.toolBreak();
      g.invChanged();
    }
  }

  // The line goes slack and comes back by itself (switching away from the rod, walking off).
  retract() { this.bobber = null; }

  // Per frame: the bobber flies, floats, or hangs on whatever it hooked.
  update(dt) {
    const b = this.bobber, g = this.game, w = g.world, p = g.player;
    if (!b) return;
    if (g.inv.held?.id !== I.fishing_rod || g.state === 'dead' || !w || Math.hypot(b.x - p.x, b.y - p.y, b.z - p.z) > REACH) { this.retract(); return; }
    b.age += dt;
    if (b.state === 'hooked') {
      const e = b.hooked;
      if (!e || e.dead || e.dying) { b.state = 'fly'; b.hooked = null; }
      else { b.x = e.x; b.y = e.y + e.h * 0.7; b.z = e.z; return; }
    }
    const top = this.surface(b);
    if (top !== null && b.state !== 'ground') {
      // Afloat: sitting in the water, bobbing, and pulled right under when a fish bites.
      if (b.state === 'fly') { b.state = 'float'; g.audio.splash(0.15, { x: b.x, y: b.y, z: b.z }); }
      b.bob += dt;
      const target = top - 0.12 - (b.nibble > 0 ? 0.3 : 0) + Math.sin(b.bob * 2.2) * 0.025;
      b.vy += (target - b.y) * 40 * dt;
      b.vy *= Math.exp(-7 * dt);
      const drag = Math.exp(-3 * dt);
      b.vx *= drag; b.vz *= drag;
      b.move(w, b.vx * dt, b.vy * dt, b.vz * dt);
      return;
    }
    if (b.state === 'ground') return;
    b.vy -= G * dt;
    const drag = Math.exp(-1.6 * dt);
    b.vx *= drag; b.vy *= drag; b.vz *= drag;
    // Snags on a creature on the way.
    const e = g.entities.list.find((m) => m.kind === 'mob' && !m.dead && !m.dying && m.rider !== 'me' &&
      Math.abs(m.x - b.x) < m.hw + 0.15 && Math.abs(m.z - b.z) < m.hw + 0.15 && b.y > m.y - 0.1 && b.y < m.y + m.h);
    if (e && b.age > 0.1) { b.state = 'hooked'; b.hooked = e; return; }
    b.move(w, b.vx * dt, b.vy * dt, b.vz * dt);
    if (b.onGround || b.hitWall) { b.state = 'ground'; b.vx = b.vy = b.vz = 0; }
  }

  // The top of the water the bobber is in (or null when it isn't in any).
  surface(b) {
    const w = this.game.world, x = Math.floor(b.x), z = Math.floor(b.z);
    let y = Math.floor(b.y + 0.1);
    if (WATERLIKE[w.getBlock(x, y, z)] !== 1) { y--; if (WATERLIKE[w.getBlock(x, y, z)] !== 1 || b.y > y + 1.2) return null; }
    while (WATERLIKE[w.getBlock(x, y + 1, z)] === 1 && y < b.y + 4) y++;
    return y + liquidHeight(w.getBlock(x, y, z));
  }

  // 20 times a second: the wait for a fish, its approach, and the moment it bites.
  tick() {
    const b = this.bobber, g = this.game;
    if (!b || b.state !== 'float') return;
    const w = g.world, x = Math.floor(b.x), z = Math.floor(b.z);
    const top = this.surface(b);
    if (top === null) return;
    if (b.nibble > 0) {
      // On the hook: reel in now, or it gets away.
      if (--b.nibble === 0) b.wait = 0;
      else if (b.nibble % 4 === 0) g.particles.bits(b.x, top, b.z, TEX.bubble, 2, 0.8, 0.4);
      return;
    }
    if (b.approach > 0) {
      // A fish coming in: a wake of bubbles closing on the float.
      b.approach--;
      const d = b.approach * 0.1 + 0.3, fx = b.x + Math.sin(b.angle) * d, fz = b.z + Math.cos(b.angle) * d;
      if (Math.random() < 0.6) g.particles.bits(fx, top + 0.05, fz, TEX.splash, 1, 0.5, 0.35);
      if (Math.random() < 0.3) g.particles.bits(fx, top - 0.1, fz, TEX.bubble, 1, 0.3, 0.5);
      if (b.approach === 0) {
        b.nibble = 20 + Math.floor(Math.random() * 20);
        b.vy -= 3.5;
        g.audio.splash(0.4, { x: b.x, y: top, z: b.z });
        g.particles.bits(b.x, top + 0.1, b.z, TEX.splash, 10, 1.6, 0.5);
        g.particles.bits(b.x, top - 0.1, b.z, TEX.bubble, 6, 0.8, 0.6);
      }
      return;
    }
    if (b.wait <= 0 && b.approach === 0) { b.wait = Math.max(20, 100 + Math.floor(Math.random() * 500) - b.lure * 100); return; }
    // Fish come sooner in the rain and slower with no sky above.
    const open = (w.getLight(x, Math.floor(top) + 1, z) >> 4) >= 15;
    let step = 1;
    if (!open && Math.random() < 0.5) step = 0;
    else if (open && g.weather.rain > 0.3 && Math.random() < 0.25) step = 2;
    b.wait -= step;
    if (b.wait <= 0) { b.approach = 20 + Math.floor(Math.random() * 60); b.angle = Math.random() * Math.PI * 2; }
  }

  // Where the line leaves the rod, for this player (in first person: towards the lower right of the
  // view, where the rod's tip is).
  rodTip() {
    const p = this.game.player, d = p.lookDir();
    const rx = Math.cos(p.yaw), rz = -Math.sin(p.yaw);
    return [p.x + d[0] * 0.75 + rx * 0.32, p.eyeY + d[1] * 0.75 - 0.12, p.z + d[2] * 0.75 + rz * 0.32];
  }
}

// ---------------------------------------------------------------- drawing
// The float: red over white, with a dark quill on top.
let floatMesh = null;
export function bobberMesh(renderer) {
  if (floatMesh) return floatMesh;
  const L = TEX.fishing_bobber, P = 1 / 16;
  const box = (x0, y0, z0, x1, y1, z1, uv) => ({ from: [x0 * P, y0 * P, z0 * P], to: [x1 * P, y1 * P, z1 * P], faces: [0, 1, 2, 3, 4, 5].map((f) => ({ layer: L, uv: uv[f] })) });
  const side = [5, 4, 11, 12];
  floatMesh = renderer.createMesh(boxMesh([
    box(-2, 0, -2, 2, 4, 2, [side, side, [5, 1, 9, 5], [5, 11, 9, 15], side, side]),
    box(-0.5, 4, -0.5, 0.5, 6, 0.5, [[0, 0, 1, 2], [0, 0, 1, 2], [0, 0, 1, 1], [0, 0, 1, 1], [0, 0, 1, 2], [0, 0, 1, 2]]),
  ]));
  return floatMesh;
}
export function bobberModel(m, rx, ry, rz, yaw) {
  identity(m);
  translate(m, m, rx, ry, rz);
  rotateY(m, m, yaw);
  translate(m, m, -MODEL_OFFSET, -MODEL_OFFSET, -MODEL_OFFSET);
  return m;
}

// A fishing line from the rod's tip to the float, sagging when slack: points [x, y, z, ...].
export function linePoints(from, to, slack, out = []) {
  out.length = 0;
  const n = 16, dx = to[0] - from[0], dy = to[1] - from[1], dz = to[2] - from[2];
  const sag = slack ? Math.min(1.5, Math.hypot(dx, dz) * 0.08 + 0.05) : 0;
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    out.push(from[0] + dx * t, from[1] + dy * t - Math.sin(t * Math.PI) * sag, from[2] + dz * t);
  }
  return out;
}
