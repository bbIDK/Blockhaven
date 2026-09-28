// Lightning, in a thunderstorm (see weather.js), as in Minecraft. Now and then a bolt comes down
// somewhere in the land about each player, where it's raining (not where it snows, nor where it
// never rains), onto the highest block there - or onto a creature standing out in the open near it.
// A bolt hurts what it strikes and whatever is near it (and sets it alight), starts fires on Normal
// and Hard, and turns a creeper into a charged creeper; a trident with Channeling calls one down on
// what it hits. The host decides where bolts fall; everyone sees them, flickering two or three
// times and lighting up the sky, and hears the thunder.
import { mulberry32 } from './math.js';

// The chance, each tick, of a bolt somewhere about a player (one every fifteen seconds or so, most
// of them far off), and how far about them (each way, in blocks).
const RATE = 1 / 300;
const REACH = 128;
// What a bolt does to what it strikes.
const HURT = 5, BURN = 8;

// Whether (x, y, z) is in reach of a bolt at (bx, by, bz): three blocks round it, from three below
// to nine above.
const struck = (x, y, z, bx, by, bz) => Math.abs(x - bx) <= 3 && Math.abs(z - bz) <= 3 && y >= by - 3 && y <= by + 9;

export class Lightning {
  constructor(game) {
    this.game = game;
    this.bolts = []; // the bolts about just now: { x, y, z, seed, life, flashes, acc }
    this.flash = 0;  // the sky lit up by a bolt, fading in a moment
  }

  // (The host, each tick.) In a thunderstorm, bolts about the players.
  tick() {
    const g = this.game, w = g.weather;
    if (!w.thundering || w.thunder < 0.5 || !g.world) return;
    for (const p of g.players()) if (!p.dead && Math.random() < RATE) this.strikeNear(p);
  }

  // A bolt somewhere in the land about `p`, if it's raining where it comes down. True if it did.
  strikeNear(p) {
    const g = this.game, world = g.world;
    const x = Math.floor(p.x + (Math.random() * 2 - 1) * REACH), z = Math.floor(p.z + (Math.random() * 2 - 1) * REACH);
    if (!world.isLoaded(x, z)) return false;
    const y = world.rainTop(x, z) + 1;
    if (g.weather.kind(world, x, z, y) !== 1) return false;
    // (A creature standing out in the open near there draws it.)
    const near = this.creaturesUnderSky(x + 0.5, y, z + 0.5);
    const t = near.length ? near[Math.floor(Math.random() * near.length)] : null;
    if (t) this.strike(t.x, t.y, t.z); else this.strike(x + 0.5, y, z + 0.5);
    return true;
  }

  // Creatures and players within three blocks of (x, z), no lower than y - 3, with nothing over them.
  creaturesUnderSky(x, y, z) {
    const g = this.game, world = g.world, out = [];
    const open = (e) => world.rainTop(Math.floor(e.x), Math.floor(e.z)) < e.y + 0.01;
    for (const e of g.entities.list) {
      if (e.kind === 'mob' && !e.dead && !e.dying && Math.abs(e.x - x) <= 3 && Math.abs(e.z - z) <= 3 && e.y >= y - 3 && open(e)) out.push(e);
    }
    for (const q of g.players()) if (!q.dead && !q.creative && Math.abs(q.x - x) <= 3 && Math.abs(q.z - z) <= 3 && q.y >= y - 3 && open(q)) out.push(q);
    return out;
  }

  // Whether a bolt could come down on `e` (in a thunderstorm, out in the open): for Channeling.
  canStrike(e) {
    const g = this.game, w = g.weather, world = g.world, x = Math.floor(e.x), z = Math.floor(e.z);
    return !!world && w.thundering && w.thunder > 0.5 && world.rainTop(x, z) < e.y + 0.01 && w.kind(world, x, z, Math.floor(e.y)) === 1;
  }

  // (The host.) A bolt at (x, y, z): everyone sees it, and it does what it does.
  strike(x, y, z) {
    const g = this.game, world = g.world, seed = Math.floor(Math.random() * 2147483647);
    this.show(x, y, z, seed);
    g.net?.effect?.('bolt', x, y, z, seed);
    // Fire where it comes down and round about (not on Peaceful or Easy).
    if (g.difficulty >= 2) {
      const bx = Math.floor(x), by = Math.floor(y), bz = Math.floor(z), r = () => Math.floor(Math.random() * 3) - 1;
      world.ignite(bx, by, bz);
      for (let i = 0; i < 4; i++) world.ignite(bx + r(), by + r(), bz + r());
    }
    // What's near it is struck: hurt, and set alight. A creeper becomes a charged creeper.
    for (const e of g.entities.list) {
      if (e.kind !== 'mob' || e.dead || e.dying || !struck(e.x, e.y, e.z, x, y, z)) continue;
      g.entities.hurtMob(e, HURT, null, 0, { fire: BURN });
      if (e.def.explodes && !e.charged) { e.charged = true; g.net?.resend?.(e); }
    }
    for (const q of g.players()) {
      if (!q.dead && !q.creative && struck(q.x, q.y, q.z, x, y, z)) g.hurtPlayer(q, HURT, 'You were struck by lightning', null, false, false, BURN);
    }
  }

  // A bolt comes down at (x, y, z) (everyone): seen, and heard.
  show(x, y, z, seed) {
    this.bolts.push({ x, y, z, seed: seed >>> 0, life: 2, flashes: 1 + (seed % 3), acc: 0 });
    if (this.bolts.length > 16) this.bolts.shift();
    this.flash = 1;
    this.game.audio.thunder?.({ x, y, z });
  }

  // Each frame: the bolts flicker (two or three times, in Minecraft's ticks) and go; the sky's
  // flash fades.
  update(dt) {
    this.flash = Math.max(0, this.flash - dt * 7);
    for (const b of this.bolts) {
      b.acc += dt * 20;
      while (b.acc >= 1 && !b.gone) {
        b.acc -= 1;
        b.life--;
        if (b.life >= 0) { this.flash = Math.max(this.flash, 0.9); continue; }
        if (b.flashes <= 0) b.gone = true;
        else if (b.life < -Math.floor(Math.random() * 10)) { b.flashes--; b.life = 1; b.seed = (Math.imul(b.seed, 1103515245) + 12345) >>> 0; }
      }
    }
    if (this.bolts.some((b) => b.gone)) this.bolts = this.bolts.filter((b) => !b.gone);
  }

  // The bolts showing just now, as the renderer's ribbons (see Renderer.drawBeams): Minecraft's
  // shape - a jagged stroke of eight sixteen-block steps from the sky down to where it struck, and
  // two branches off it - in four layers, each wider and fainter, pale violet-white.
  beams(out = []) {
    for (const b of this.bolts) {
      if (b.life < 0) continue;
      const rnd = mulberry32(b.seed), step = (n) => Math.floor(rnd() * n);
      const xo = new Array(8), zo = new Array(8);
      let fx = 0, fz = 0;
      for (let i = 7; i >= 0; i--) { xo[i] = fx; zo[i] = fz; fx += step(11) - 5; fz += step(11) - 5; }
      // (The main stroke takes the same steps again, so it comes down right where it struck.)
      const again = mulberry32(b.seed), step2 = (n) => Math.floor(again() * n);
      for (let k = 0; k < 3; k++) {
        const top = k ? 7 - k : 7, bottom = k ? top - 2 : 0;
        let x0 = xo[top] - fx, z0 = zo[top] - fz;
        for (let j = top; j >= bottom; j--) {
          const x1 = x0, z1 = z0;
          x0 += k ? step2(31) - 15 : step2(11) - 5;
          z0 += k ? step2(31) - 15 : step2(11) - 5;
          const layers = [0, 1, 2, 3].map((l) => {
            const w = 0.1 + l * 0.2;
            return k ? [w, w, 0.3] : [w * ((j - 1) * 0.1 + 1), w * (j * 0.1 + 1), 0.3];
          });
          out.push({ from: [b.x + x0, b.y + j * 16, b.z + z0], to: [b.x + x1, b.y + (j + 1) * 16, b.z + z1], color: [0.45, 0.45, 0.5], layers, boost: 2.5 });
        }
      }
    }
    return out;
  }
}
