// Time of day -> sun direction, sky/fog colours and daylight strength.
import { smoothstep, lerp } from './math.js';
import { TICKS_PER_DAY } from './config.js';

const DAY_ZENITH = [0.33, 0.56, 0.98], DAY_HORIZON = [0.68, 0.82, 1.0];
const NIGHT_ZENITH = [0.008, 0.012, 0.035], NIGHT_HORIZON = [0.03, 0.045, 0.1];
const SUNSET = [1.0, 0.5, 0.22];

const mix3 = (out, a, b, t) => { out[0] = lerp(a[0], b[0], t); out[1] = lerp(a[1], b[1], t); out[2] = lerp(a[2], b[2], t); return out; };

export function makeEnvironment() {
  return {
    sunDir: [1, 0, 0], zenith: [0, 0, 0], horizon: [0, 0, 0], fogColor: [0, 0, 0], skyLight: [1, 1, 1],
    cloudColor: [1, 1, 1], daylight: 1, stars: 0, sunset: 0, sunAngle: 0,
    // For shaders (linear light): where the sun or moon shines from (moved in small steps, so
    // shadows don't crawl), its light, the sky's ambient light, and the glow round the sun.
    lightDir: [0, 1, 0], lightColor: [0, 0, 0], ambient: [0, 0, 0], sunGlow: [0, 0, 0],
    // The least light anywhere, and whether there's a sky at all (both only for the Nether).
    floor: [0, 0, 0], flat: false,
  };
}

const NETHER_FLOOR = [0.17, 0.125, 0.11];
// The Nether has no sky, sun or stars: only a haze the colour of its biome (`fog`), and a dim red
// glow over everything, so the darkest corner isn't pitch black.
export function netherEnvironment(env, fog) {
  for (const k of ['zenith', 'horizon', 'fogColor']) for (let i = 0; i < 3; i++) env[k][i] = fog[i];
  for (const k of ['lightColor', 'ambient', 'sunGlow', 'skyLight']) env[k].fill(0);
  for (let i = 0; i < 3; i++) env.floor[i] = NETHER_FLOOR[i];
  env.daylight = 0; env.stars = 0; env.sunset = 0;
  env.flat = true;
  return env;
}

const SHADOW_STEP = Math.PI / 720; // (a quarter of a degree: a step every second or so)

// time: ticks since the world began. Tick 0 of each day is sunrise.
export function updateEnvironment(env, time) {
  const t = ((time % TICKS_PER_DAY) + TICKS_PER_DAY) % TICKS_PER_DAY / TICKS_PER_DAY;
  const a = t * Math.PI * 2;
  env.floor.fill(0); env.flat = false;
  env.sunAngle = a;
  env.sunDir[0] = Math.cos(a); env.sunDir[1] = Math.sin(a); env.sunDir[2] = 0.18;
  const l = Math.hypot(...env.sunDir);
  env.sunDir[0] /= l; env.sunDir[1] /= l; env.sunDir[2] /= l;
  const h = Math.sin(a);
  const day = smoothstep(-0.2, 0.22, h);
  env.daylight = 0.2 + 0.8 * day;
  env.sunset = Math.exp(-((h / 0.22) ** 2));
  mix3(env.zenith, NIGHT_ZENITH, DAY_ZENITH, day);
  mix3(env.horizon, NIGHT_HORIZON, DAY_HORIZON, day);
  mix3(env.horizon, env.horizon, SUNSET, env.sunset * 0.55);
  env.fogColor[0] = env.horizon[0]; env.fogColor[1] = env.horizon[1]; env.fogColor[2] = env.horizon[2];
  mix3(env.skyLight, [0.55, 0.62, 0.95], [1, 1, 1], day);
  mix3(env.skyLight, env.skyLight, [1.0, 0.82, 0.66], env.sunset * 0.5);
  mix3(env.cloudColor, [0.12, 0.13, 0.18], [1, 1, 1], day);
  mix3(env.cloudColor, env.cloudColor, [1.0, 0.75, 0.6], env.sunset * 0.5);
  env.stars = 1 - smoothstep(-0.28, 0.05, h);
  // Direct light: the sun by day, the moon by night, each fading out as it nears the horizon.
  const q = Math.round(a / SHADOW_STEP) * SHADOW_STEP, qh = Math.sin(q);
  const moon = qh < 0, ld = env.lightDir;
  ld[0] = Math.cos(q) * (moon ? -1 : 1); ld[1] = Math.abs(qh); ld[2] = 0.18 * (moon ? -1 : 1);
  const ll = Math.hypot(ld[0], ld[1], ld[2]);
  ld[0] /= ll; ld[1] /= ll; ld[2] /= ll;
  const lc = env.lightColor;
  if (!moon) {
    // Low sun is orange; high sun a warm white.
    const k = smoothstep(0.0, 0.3, qh) * 2.7, warm = Math.exp(-qh * 5);
    lc[0] = k; lc[1] = k * lerp(0.93, 0.5, warm); lc[2] = k * lerp(0.82, 0.22, warm);
  } else {
    const k = smoothstep(0.0, 0.3, -qh) * 0.32;
    lc[0] = k * 0.55; lc[1] = k * 0.68; lc[2] = k;
  }
  mix3(env.ambient, [0.012, 0.016, 0.035], [0.4, 0.5, 0.72], day);
  mix3(env.ambient, env.ambient, [0.62, 0.48, 0.42], env.sunset * 0.45);
  mix3(env.sunGlow, [0.02, 0.025, 0.04], [1.0, 0.86, 0.66], day);
  mix3(env.sunGlow, env.sunGlow, [1.4, 0.55, 0.2], env.sunset);
  return env;
}

// 24h clock text for the debug screen: tick 0 = 06:00.
export function clockText(time) {
  const t = (((time % TICKS_PER_DAY) + TICKS_PER_DAY) % TICKS_PER_DAY) / TICKS_PER_DAY;
  const mins = Math.floor((t * 24 * 60 + 6 * 60) % (24 * 60));
  return `${String(Math.floor(mins / 60)).padStart(2, '0')}:${String(mins % 60).padStart(2, '0')}`;
}
