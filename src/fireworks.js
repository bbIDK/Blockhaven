// Fireworks, as in Minecraft: a firework star is gunpowder and dyes (its colours), with a shape
// (a gold nugget: a star; a feather: a burst; a fire charge: a large ball; otherwise a small ball),
// a trail (a diamond) and a twinkle (glowstone dust); dyed again it fades to other colours. A rocket
// is paper and one to three gunpowder (how high it flies) with any stars; lit, it climbs and bursts
// into each of its stars. A crossbow can shoot one: then it flies straight and bursts where it hits.
//
// A star's data (`star` on its stack): { t: shape (0 small ball, 1 large ball, 2 star, 3 creeper,
// 4 burst), c: [colours], d: [fade colours] (dye numbers, see colors.js), tr: 1 trail, tw: 1
// twinkle }. A rocket's (`fw`): { f: flight 1-3, s: [stars] }.
import { DYES } from './colors.js';
import { MAX_Y } from './config.js';

export const SHAPES = ['Small Ball', 'Large Ball', 'Star-shaped', 'Creeper-shaped', 'Burst'];
// The colours the sparks burst in (Minecraft's firework colours, brighter than the dyes).
export const SPARK_COLOURS = [0xf0f0f0, 0xeb8844, 0xc354cd, 0x6689d3, 0xdecf2a, 0x41cd34, 0xd88198, 0x434343, 0xababab, 0x287697, 0x7b2fbe,
  0x253192, 0x51301a, 0x3b511a, 0xb3312c, 0x1e1b1b];

const dyeList = (a, n) => (Array.isArray(a) ? a.filter((c) => Number.isInteger(c) && c >= 0 && c < DYES.length).slice(0, n) : []);
// A star checked over (from a save, or another player): null if it has no colour.
export function cleanStar(s) {
  if (!s || typeof s !== 'object') return null;
  const c = dyeList(s.c, 8);
  if (!c.length) return null;
  const o = { t: Number.isInteger(s.t) && s.t >= 0 && s.t < SHAPES.length ? s.t : 0, c };
  const d = dyeList(s.d, 8);
  if (d.length) o.d = d;
  if (s.tr) o.tr = 1;
  if (s.tw) o.tw = 1;
  return o;
}
export function cleanRocket(f) {
  if (!f || typeof f !== 'object') return { f: 1, s: [] };
  return { f: Number.isInteger(f.f) ? Math.max(1, Math.min(3, f.f)) : 1, s: (Array.isArray(f.s) ? f.s : []).slice(0, 7).map(cleanStar).filter(Boolean) };
}

// ---------------------------------------------------------------- rockets in flight
// How long a rocket flies, in ticks: longer the more gunpowder (as Minecraft's: about one, one and
// a half or two seconds).
export const flightTicks = (f) => 10 * (1 + f) + Math.floor(Math.random() * 6) + Math.floor(Math.random() * 7);

// A rocket's flight (on the host): launched from the ground it climbs faster and faster, drifting
// a little, leaving sparks; shot from a crossbow it flies straight. Either way it bursts at the end
// of its time, or when it hits something (a crossbow's on whatever it hits).
export function fireworkPhysics(ents, e, dt) {
  const w = ents.world, game = ents.game, k = dt * 20;
  e.life += dt;
  if (!e.shot) {
    const f = Math.pow(1.15, k);
    e.vx *= f; e.vz *= f; e.vy += 16 * dt;
  }
  const sp = Math.hypot(e.vx, e.vy, e.vz), step = sp * dt;
  if (step > 1e-6) {
    const dx = e.vx / sp, dy = e.vy / sp, dz = e.vz / sp;
    const { hit, len, victim } = e.shot ? ents.arrowPath(e, dx, dy, dz, step) : { hit: w.raycast(e.x, e.y, e.z, dx, dy, dz, step), len: step, victim: null };
    const to = hit || victim ? (hit?.t ?? len) : step;
    e.x += dx * to; e.y += dy * to; e.z += dz * to;
    if (hit || victim) { burst(ents, e); return; }
  }
  // (Sparks trailing behind.)
  if (Math.random() < dt * 30) game.particles.trail(e.x, e.y - 0.2, e.z);
  if (e.life * 20 >= e.lifetime || e.y > MAX_Y + 64) burst(ents, e);
}

// A rocket bursts: its stars (seen by everyone), and with stars in it, it hurts what's close.
function burst(ents, e) {
  const game = ents.game, fw = e.fw;
  e.dead = true;
  game.net?.entityGone?.(e, 'x');
  const dir = [e.vx, e.vy, e.vz];
  game.fireworkFx(e.x, e.y, e.z, fw, dir);
  game.net?.effect?.('firework', e.x, e.y, e.z, { ...fw, v: dir.map((v) => Math.round(v * 10) / 10) });
  if (!fw.s.length) return;
  const dmg = 5 + 2 * fw.s.length;
  for (const o of ents.list) {
    if (o.kind !== 'mob' || o.dead || o.dying) continue;
    const d = Math.hypot(o.x - e.x, o.y + o.h / 2 - e.y, o.z - e.z);
    if (d < 5) ents.hurtMob(o, dmg * Math.sqrt((5 - d) / 5), e.owner ?? { x: e.x, y: e.y, z: e.z });
  }
  for (const q of ents.players) {
    const d = Math.hypot(q.x - e.x, q.y + 0.9 - e.y, q.z - e.z);
    if (!q.dead && d < 5) game.hurtPlayer(q, dmg * Math.sqrt((5 - d) / 5), 'You went off with a bang', null, true, false);
  }
}
