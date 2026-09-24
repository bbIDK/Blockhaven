// Player movement: walking, sprinting, sneaking (with edge protection), swimming and flying,
// with axis-separated AABB collision against the voxel world.
import { WATERLIKE, liquidHeight } from './blocks.js';
import { Body } from './body.js';

export const HALF_W = 0.3;
export const HEIGHT = 1.8;
const GRAVITY = 32;
const JUMP_V = 9.0;
const STEP = 0.6; // walk up slabs and stairs without jumping

export class Player extends Body {
  constructor() {
    super(HALF_W, HEIGHT);
    this.x = 0.5; this.y = 80; this.z = 0.5;
    this.yaw = 0; this.pitch = 0;
    this.onGround = false;
    this.flying = false;
    this.sneaking = false;
    this.sprinting = false;
    this.inWater = false;
    this.inLava = false;
    this.headInWater = false;
    this.hitWall = false;
    this.fallDistance = 0;
    this.walkDist = 0;
    this.bob = 0;
    this.bobPhase = 0;
    this.eyeOffset = 1.62;
    this.stepSmooth = 0;
    this.onLadder = false;
    this.frozen = false;
    this.landed = null;
  }

  get eyeY() { return this.y + this.eyeOffset + this.stepSmooth; }

  hasSupport(world, dx, dz) {
    const b = this.box(dx, 0, dz);
    return world.collides(b[0], b[1] - 0.6, b[2], b[3], b[1], b[5]);
  }

  sampleFluids(world) {
    const x0 = Math.floor(this.x - HALF_W + 0.001), x1 = Math.floor(this.x + HALF_W - 0.001);
    const z0 = Math.floor(this.z - HALF_W + 0.001), z1 = Math.floor(this.z + HALF_W - 0.001);
    const y0 = Math.floor(this.y + 0.05), y1 = Math.floor(this.y + 1.0);
    let water = false, lava = false;
    for (let y = y0; y <= y1; y++) for (let z = z0; z <= z1; z++) for (let x = x0; x <= x1; x++) {
      const id = world.getBlock(x, y, z);
      const k = WATERLIKE[id];
      if (!k) continue;
      if (y === y0 && this.y + 0.05 > y + liquidHeight(id)) continue;
      if (k === 1) water = true; else lava = true;
    }
    this.inWater = water;
    this.inLava = lava;
    const ey = this.eyeY, eb = world.getBlock(Math.floor(this.x), Math.floor(ey), Math.floor(this.z));
    this.headInWater = WATERLIKE[eb] === 1 && ey < Math.floor(ey) + liquidHeight(eb) + 0.02;
    this.headInLava = WATERLIKE[eb] === 2;
  }

  // input: { forward, right (-1..1), jump, sneak, sprint }
  update(dt, input, world) {
    if (this.frozen) { this.vx = this.vy = this.vz = 0; return; }
    const steps = Math.ceil(dt / (1 / 120));
    const h = dt / steps;
    for (let i = 0; i < steps; i++) this.step(h, input, world);
    const target = this.sneaking && !this.flying ? 1.32 : 1.62;
    this.eyeOffset += (target - this.eyeOffset) * Math.min(1, dt * 14);
    this.stepSmooth *= Math.exp(-dt * 14);
  }

  step(dt, input, world) {
    this.sampleFluids(world);
    const fluid = this.inWater || this.inLava;
    this.sneaking = input.sneak && !this.flying;
    if (!input.forward || input.forward <= 0 || this.sneaking || fluid) this.sprinting = false;
    else if (input.sprint) this.sprinting = true;

    const s = Math.sin(this.yaw), c = Math.cos(this.yaw);
    let mx = -s * input.forward + c * input.right;
    let mz = -c * input.forward - s * input.right;
    const len = Math.hypot(mx, mz);
    if (len > 1) { mx /= len; mz /= len; }

    let speed, accel;
    if (this.flying) { speed = this.sprinting ? 21.6 : 10.9; accel = 5; }
    else if (this.inLava) { speed = 1.2; accel = 4; }
    else if (this.inWater) { speed = 2.2; accel = 5; }
    else if (this.sneaking) { speed = 1.31; accel = 14; }
    else { speed = this.sprinting ? 5.61 : 4.32; accel = this.onGround ? 14 : 2.8; }
    const k = 1 - Math.exp(-accel * dt);
    this.vx += (mx * speed - this.vx) * k;
    this.vz += (mz * speed - this.vz) * k;

    if (this.flying) {
      const up = (input.jump ? 1 : 0) - (input.sneak ? 1 : 0);
      this.vy += (up * 8.5 - this.vy) * (1 - Math.exp(-8 * dt));
    } else if (fluid) {
      this.vy -= (this.inLava ? 4 : 7) * dt;
      this.vy *= Math.exp(-2.4 * dt);
      if (input.jump) this.vy = Math.min(this.vy + 22 * dt, this.inLava ? 1.6 : 3.2);
      if (input.jump && this.hitWall) this.vy = Math.max(this.vy, 5.2);
      this.vy = Math.max(this.vy, -3.5);
    } else {
      if (input.jump && this.onGround) {
        this.vy = JUMP_V;
        if (this.sprinting) { this.vx -= s * 1.6; this.vz -= c * 1.6; }
      }
      this.vy -= GRAVITY * dt;
      this.vy *= Math.pow(0.98, dt * 20);
      this.vy = Math.max(this.vy, -78);
    }
    // Ladders: push against them (or hold jump) to climb, sneak to hold on, otherwise slide slowly.
    const b0 = this.box();
    this.onLadder = !this.flying && world.touchesClimbable(b0[0] - 0.01, b0[1], b0[2] - 0.01, b0[3] + 0.01, b0[4], b0[5] + 0.01);
    if (this.onLadder) {
      if (this.hitWall || input.jump) this.vy = 2.6;
      else if (input.sneak) this.vy = Math.max(this.vy, 0);
      else this.vy = Math.max(this.vy, -2.9);
    }

    let dx = this.vx * dt, dy = this.vy * dt, dz = this.vz * dt;
    // Sneaking keeps you from walking off ledges.
    if (this.sneaking && this.onGround) {
      const stepBack = (v) => (Math.abs(v) < 0.02 ? 0 : v - Math.sign(v) * 0.02);
      while (dx !== 0 && !this.hasSupport(world, dx, 0)) dx = stepBack(dx);
      while (dz !== 0 && !this.hasSupport(world, 0, dz)) dz = stepBack(dz);
      while (dx !== 0 && dz !== 0 && !this.hasSupport(world, dx, dz)) { dx = stepBack(dx); dz = stepBack(dz); }
      if (dx === 0) this.vx = 0;
      if (dz === 0) this.vz = 0;
    }

    const wasGround = this.onGround;
    const hitY = this.moveAxis(world, 1, dy);
    this.onGround = hitY && dy < 0;
    if (hitY) this.vy = 0;
    const px = this.x, py = this.y, pz = this.z;
    let hitX = this.moveAxis(world, 0, dx);
    let hitZ = this.moveAxis(world, 2, dz);
    // Blocked while walking? Retry from a little higher so slabs and stairs can be walked up.
    if ((hitX || hitZ) && (this.onGround || wasGround) && !this.flying && !fluid) {
      const ax = this.x, ay = this.y, az = this.z;
      this.x = px; this.y = py; this.z = pz;
      this.moveAxis(world, 1, STEP);
      const lift = this.y - py;
      const sx = this.moveAxis(world, 0, dx), sz = this.moveAxis(world, 2, dz);
      this.moveAxis(world, 1, -lift - 1e-3);
      const plain = (ax - px) ** 2 + (az - pz) ** 2, stepped = (this.x - px) ** 2 + (this.z - pz) ** 2;
      if (stepped > plain + 1e-8 && this.y > py + 1e-4) {
        hitX = sx; hitZ = sz;
        this.onGround = true;
        this.stepSmooth -= this.y - py;
      } else {
        this.x = ax; this.y = ay; this.z = az;
      }
    }
    if (hitX) this.vx = 0;
    if (hitZ) this.vz = 0;
    this.hitWall = hitX || hitZ;
    if (this.onGround && this.flying && input.sneak) this.flying = false;

    // Fall tracking for damage and landing sounds.
    if (this.flying || fluid) this.fallDistance = 0;
    else if (dy < 0 && !this.onGround) this.fallDistance -= dy;
    if (this.onGround && !wasGround) {
      this.landed = this.fallDistance;
      this.fallDistance = 0;
    }

    const moved = Math.hypot(dx, dz);
    if (this.onGround && !this.flying) this.walkDist += moved;
    const bobTarget = this.onGround && moved > 0.001 && !this.flying ? Math.min(1, moved / dt / 4.3) : 0;
    this.bob += (bobTarget - this.bob) * Math.min(1, dt * 10);
    this.bobPhase += moved * 1.7;
  }

  // Block the player is standing on (for footstep sounds).
  groundBlock(world) {
    const id = world.getBlock(Math.floor(this.x), Math.floor(this.y - 0.2), Math.floor(this.z));
    return id || world.getBlock(Math.floor(this.x), Math.floor(this.y - 1.2), Math.floor(this.z));
  }

  // Would a solid block at (x, y, z) overlap the player?
  intersectsBlock(x, y, z) {
    const b = this.box();
    return b[0] < x + 1 && b[3] > x && b[1] < y + 1 && b[4] > y && b[2] < z + 1 && b[5] > z;
  }

  lookDir() {
    const cp = Math.cos(this.pitch);
    return [-Math.sin(this.yaw) * cp, Math.sin(this.pitch), -Math.cos(this.yaw) * cp];
  }
}
