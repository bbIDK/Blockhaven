// Spawn eggs (see eggs.js). The game takes Pixel Perfection's egg in each creature's two colours
// (see tools/texture-sources.mjs); these drawings, an egg of the first colour speckled with the
// second, are the fallback.
import { def } from './core.js';
import { EGGS } from '../eggs.js';

const shade = (c, k) => [16, 8, 0].reduce((out, s) => out | (Math.max(0, Math.min(255, Math.round(((c >> s) & 255) * k))) << s), 0);
for (const [type, a, b] of EGGS) {
  def(`${type}_spawn_egg`, (t) => {
    t.clear();
    for (let y = 2; y < 15; y++) for (let x = 2; x < 14; x++) {
      // An egg, narrower at the top, lit from the top left, with a dark rim.
      const v = (y - 9) / 6.2, u = (x - 7.5) / (4.6 * (v < 0 ? 1 + v * 0.28 : 1));
      const d = u * u + v * v;
      if (d >= 1) continue;
      const lit = 1.12 - 0.3 * (u + v) * 0.5 - (d > 0.72 ? 0.3 : 0);
      const spot = ((x * 7 + y * 13) % 11 === 0 || (x * 5 + y * 3) % 17 === 0) && d < 0.7;
      t.set(x, y, shade(spot ? b : a, lit));
    }
  });
}
