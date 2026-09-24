// Axis-aligned physics body used by the player, mobs and dropped items: moves one axis at a
// time and stops flush against solid blocks.
export class Body {
  constructor(halfWidth, height) {
    this.hw = halfWidth;
    this.h = height;
    this.x = 0; this.y = 0; this.z = 0;
    this.vx = 0; this.vy = 0; this.vz = 0;
    this.onGround = false;
    this.hitWall = false;
  }

  box(dx = 0, dy = 0, dz = 0) {
    return [this.x - this.hw + dx, this.y + dy, this.z - this.hw + dz, this.x + this.hw + dx, this.y + this.h + dy, this.z + this.hw + dz];
  }

  collides(world, dx, dy, dz) {
    const b = this.box(dx, dy, dz);
    return world.collides(b[0], b[1], b[2], b[3], b[4], b[5]);
  }

  // Returns true when movement along this axis was blocked. Blocked moves stop flush against
  // whatever was hit: whole blocks via a quick snap to the grid, partial shapes (slabs, stairs,
  // doors, fences) by bisecting for the largest free distance.
  moveAxis(world, axis, d) {
    if (d === 0) return false;
    const dx = axis === 0 ? d : 0, dy = axis === 1 ? d : 0, dz = axis === 2 ? d : 0;
    if (!this.collides(world, dx, dy, dz) || this.collides(world, 0, 0, 0)) {
      // Free to move, or already stuck inside something (let it climb out).
      this.x += dx; this.y += dy; this.z += dz;
      return false;
    }
    const key = axis === 0 ? 'x' : axis === 1 ? 'y' : 'z';
    const start = this[key];
    const lo = axis === 1 ? 0 : this.hw, hi = axis === 1 ? this.h : this.hw;
    const snapped = d > 0 ? Math.floor(start + d + hi) - hi - 1e-6 : Math.floor(start + d - lo) + 1 + lo + 1e-6;
    const moved = snapped - start;
    if (moved * d >= 0 && Math.abs(moved) <= Math.abs(d) &&
        !this.collides(world, axis === 0 ? moved : 0, axis === 1 ? moved : 0, axis === 2 ? moved : 0)) {
      this[key] = snapped;
      return true;
    }
    let free = 0, blocked = 1;
    for (let i = 0; i < 14; i++) {
      const mid = (free + blocked) / 2, m = d * mid;
      if (this.collides(world, axis === 0 ? m : 0, axis === 1 ? m : 0, axis === 2 ? m : 0)) blocked = mid; else free = mid;
    }
    this[key] = start + d * free;
    return true;
  }

  // Moves by (dx, dy, dz) in sub-steps no larger than half a block.
  move(world, dx, dy, dz) {
    const steps = Math.max(1, Math.ceil(Math.max(Math.abs(dx), Math.abs(dy), Math.abs(dz)) / 0.45));
    let hitX = false, hitY = false, hitZ = false;
    for (let i = 0; i < steps; i++) {
      if (this.moveAxis(world, 1, dy / steps)) hitY = true;
      if (this.moveAxis(world, 0, dx / steps)) hitX = true;
      if (this.moveAxis(world, 2, dz / steps)) hitZ = true;
    }
    if (hitY) { this.onGround = dy < 0; this.vy = 0; } else this.onGround = false;
    if (hitX) this.vx = 0;
    if (hitZ) this.vz = 0;
    this.hitWall = hitX || hitZ;
  }
}
