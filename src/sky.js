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
  };
}

// time: ticks since the world began. Tick 0 of each day is sunrise.
export function updateEnvironment(env, time) {
  const t = ((time % TICKS_PER_DAY) + TICKS_PER_DAY) % TICKS_PER_DAY / TICKS_PER_DAY;
  const a = t * Math.PI * 2;
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
  return env;
}

// 24h clock text for the debug screen: tick 0 = 06:00.
export function clockText(time) {
  const t = (((time % TICKS_PER_DAY) + TICKS_PER_DAY) % TICKS_PER_DAY) / TICKS_PER_DAY;
  const mins = Math.floor((t * 24 * 60 + 6 * 60) % (24 * 60));
  return `${String(Math.floor(mins / 60)).padStart(2, '0')}:${String(mins % 60).padStart(2, '0')}`;
}
