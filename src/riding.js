// Things you ride: boats and horses. Right-click one to get in or on; sneak (Shift) to get off.
// While riding, your keys drive the mount instead of your feet: a boat paddles forwards and back
// and turns with A and D; a saddled horse goes the way you look and jumps with Space. You sit in
// its seat, and the mount takes you with it. In multiplayer the rider moves the mount and tells
// the host where it is (see multiplayer.js), so riding feels the same for everyone.
import { boxMesh, MODEL_OFFSET } from './models.js';
import { TEX } from './textures.js';
import { WATERLIKE, liquidHeight, SOLID, B } from './blocks.js';
import { identity, translate, rotateY } from './math.js';

const TAU = Math.PI * 2;
const wrap = (a) => a - Math.round(a / TAU) * TAU;

// ---------------------------------------------------------------- boats
export const BOAT_WOODS = ['oak', 'spruce', 'birch', 'jungle', 'acacia', 'dark_oak', 'cherry'];

// A boat, in pixels: a flat bottom, four sides, a thwart to sit on and two oars resting in their
// locks. Faces tile the planks at one texel per pixel (like the blocks).
function boatParts(wood) {
  const planks = TEX[`${wood}_planks`], oar = TEX.lever;
  const P = 1 / 16;
  const box = (x0, y0, z0, x1, y1, z1, layer) => {
    const w = x1 - x0, h = y1 - y0, d = z1 - z0;
    const size = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]];
    return { from: [x0 * P, y0 * P, z0 * P], to: [x1 * P, y1 * P, z1 * P], faces: size.map(([u, v]) => ({ layer, uv: [0, 0, u, v] })) };
  };
  return [
    box(-9, 0, -14, 9, 3, 14, planks),
    box(-9, 3, -14, -7, 9, 14, planks), box(7, 3, -14, 9, 9, 14, planks),
    box(-7, 3, -14, 7, 8, -12, planks), box(-7, 3, 12, 7, 8, 14, planks),
    box(-7, 5, 1, 7, 6, 4, planks),
    box(-11, 7, -3, -9, 8, 9, oar), box(9, 7, -3, 11, 8, 9, oar),
  ];
}
const boatMeshes = new Map();
export function boatMesh(renderer, wood) {
  let m = boatMeshes.get(wood);
  if (!m) { m = renderer.createMesh(boxMesh(boatParts(BOAT_WOODS.includes(wood) ? wood : 'oak'))); boatMeshes.set(wood, m); }
  return m;
}
export function boatModel(m, rx, ry, rz, yaw) {
  identity(m);
  translate(m, m, rx, ry, rz);
  rotateY(m, m, yaw);
  translate(m, m, -MODEL_OFFSET, -MODEL_OFFSET, -MODEL_OFFSET);
  return m;
}

// The top of the water under a boat (or null when it isn't in water).
function waterTop(w, x, y, z) {
  const bx = Math.floor(x), bz = Math.floor(z);
  for (let by = Math.floor(y + 1); by >= Math.floor(y - 1); by--) {
    const id = w.getBlock(bx, by, bz);
    if (WATERLIKE[id] === 1) {
      // Water under water: the surface is higher up.
      let top = by;
      while (WATERLIKE[w.getBlock(bx, top + 1, bz)] === 1 && top < by + 3) top++;
      return top + liquidHeight(w.getBlock(bx, top, bz));
    }
  }
  return null;
}

// A boat's movement each frame. `drive`: { forward, turn } from its rider, or null.
export function boatPhysics(w, e, dt, drive) {
  const top = waterTop(w, e.x, e.y, e.z);
  const afloat = top !== null && e.y < top + 0.25;
  if (drive) {
    e.yaw = wrap(e.yaw + drive.turn * dt * 2.4);
    const push = drive.forward > 0 ? 1 : drive.forward < 0 ? -0.45 : 0;
    const fx = -Math.sin(e.yaw), fz = -Math.cos(e.yaw);
    const accel = afloat ? 10 : 2.5;
    e.vx += fx * push * accel * dt;
    e.vz += fz * push * accel * dt;
  }
  if (afloat) {
    // It floats with its floor just clear of the water (which never comes in), bobbing gently.
    const target = top - 0.12 + Math.sin(e.age * 1.7) * 0.02;
    e.vy += (target - e.y) * 30 * dt;
    e.vy *= Math.exp(-6 * dt);
    const drag = Math.exp(-(drive?.forward ? 0.8 : 1.4) * dt);
    e.vx *= drag; e.vz *= drag;
    const sp = Math.hypot(e.vx, e.vz), max = 8;
    if (sp > max) { e.vx *= max / sp; e.vz *= max / sp; }
  } else {
    e.vy = Math.max(-40, e.vy - 32 * dt);
    // On land it hardly moves; on ice it slides.
    const under = w.getBlock(Math.floor(e.x), Math.floor(e.y - 0.1), Math.floor(e.z));
    const ice = under === B.ice || under === B.packed_ice || under === B.blue_ice;
    const f = e.onGround ? Math.exp(-(ice ? 0.3 : 8) * dt) : Math.exp(-0.3 * dt);
    e.vx *= f; e.vz *= f;
  }
  e.move(w, e.vx * dt, e.vy * dt, e.vz * dt);
  if (e.hitWall) { e.vx *= 0.3; e.vz *= 0.3; }
  e.afloat = afloat;
}

// ---------------------------------------------------------------- the rider's side
// How high a rider's hips are above the mount's feet (blocks). A rider sits with their legs out in
// front, so where they "stand" is that far below their hips (they're drawn from their feet).
export const SEAT = { boat: 0.25, cart: 0.42, horse: 1.38 };
const HIP = 0.75;
export const seatY = (e) => e.y + (SEAT[e.kind] ?? e.def?.seat ?? SEAT.horse) - HIP;

// Someone (`rider`: 'me', or a guest's address on the host) gets on. An untamed horse gives them
// a few seconds before it decides what it thinks of that.
export function startRide(e, rider) {
  e.rider = rider;
  e.drive = null;
  if (e.kind === 'mob' && !e.tame) e.taming = 50 + Math.floor(Math.random() * 60);
}

// The rider's keys, turned into what drives their mount.
export function driveFrom(move, look, kind) {
  if (kind === 'boat') return { forward: move.forward, turn: -(move.right ?? 0), jump: false };
  return { forward: move.forward, strafe: move.right ?? 0, jump: !!move.jump, yaw: look };
}

// A horse under a rider: it turns to where the rider looks, walks or gallops forward, and jumps.
// Untamed, or without a saddle, it goes its own way.
export function horseDrive(e, drive, dt) {
  e.rideJump = Math.max(0, (e.rideJump ?? 0) - dt);
  if (!drive || !e.tame || !e.saddled) { e.rideDir = 0; return false; }
  e.yaw += wrap(drive.yaw - e.yaw) * Math.min(1, dt * 8);
  e.moving = drive.forward !== 0;
  e.rideDir = drive.forward < 0 ? Math.PI : 0;
  // (A strider spurred on with a warped fungus goes twice as fast for a while.)
  if (e.boost > 0) e.boost -= dt * 20;
  e.speedMul = (drive.forward < 0 ? 0.25 : 1) * (e.def.rideSpeed / e.def.speed) * (e.boost > 0 ? 2 : 1);
  if (drive.jump && e.onGround && e.rideJump <= 0) { e.vy = 10.5; e.rideJump = 0.6; }
  return true;
}

// Finds somewhere free beside the mount to put a rider down.
export function dismountSpot(w, e, hw = 0.3, h = 1.8) {
  const free = (x, y, z) => {
    for (let yy = Math.floor(y); yy <= Math.floor(y + h - 0.01); yy++) {
      for (const [dx, dz] of [[-hw, -hw], [hw, -hw], [-hw, hw], [hw, hw]]) if (SOLID[w.getBlock(Math.floor(x + dx), yy, Math.floor(z + dz))]) return false;
    }
    return true;
  };
  const side = (e.hw ?? 0.6) + 0.45;
  for (const a of [Math.PI / 2, -Math.PI / 2, 0, Math.PI, Math.PI / 4, -Math.PI / 4]) {
    const ang = e.yaw + a, x = e.x - Math.sin(ang) * side, z = e.z - Math.cos(ang) * side;
    for (const dy of [0, 1, -1]) {
      const y = Math.floor(e.y) + dy;
      if (free(x, y, z) && (SOLID[w.getBlock(Math.floor(x), y - 1, Math.floor(z))] || WATERLIKE[w.getBlock(Math.floor(x), y - 1, Math.floor(z))])) return [x, y, z];
    }
  }
  return [e.x, e.y + (e.h ?? 1) + 0.1, e.z];
}

// ---------------------------------------------------------------- taming horses
// Each ride on an untamed horse ends in a few seconds: either it has come round to you (more
// likely each time you try, and when you've fed it) or it throws you off. Returns 'tame', 'buck'
// or null (still deciding), once a tick.
export function tameTick(e) {
  if (e.tame) return null;
  if ((e.taming = (e.taming ?? 0) - 1) > 0) {
    // Rearing and wheeling about while it makes up its mind.
    if (Math.random() < 0.1) { e.yaw += (Math.random() - 0.5) * 1.8; e.moving = Math.random() < 0.7; e.speedMul = 1.6; }
    return null;
  }
  if (Math.random() * 100 < (e.temper ?? 0)) { e.tame = true; return 'tame'; }
  e.temper = Math.min(100, (e.temper ?? 0) + 5);
  return 'buck';
}
