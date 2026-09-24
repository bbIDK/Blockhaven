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

  // Returns true when movement along this axis was blocked.
  moveAxis(world, axis, d) {
    if (d === 0) return false;
    const dx = axis === 0 ? d : 0, dy = axis === 1 ? d : 0, dz = axis === 2 ? d : 0;
    if (!this.collides(world, dx, dy, dz) || this.collides(world, 0, 0, 0)) {
      // Free to move, or already stuck inside something (let it climb out).
      this.x += dx; this.y += dy; this.z += dz;
      return false;
    }
    const ox = this.x, oy = this.y, oz = this.z, hw = this.hw;
    if (axis === 1) {
      this.y = d > 0 ? Math.floor(this.y + this.h + d) - this.h - 1e-6 : Math.floor(this.y + d) + 1 + 1e-6;
    } else if (axis === 0) {
      const p = this.x + d;
      this.x = d > 0 ? Math.floor(p + hw) - hw - 1e-6 : Math.floor(p - hw) + 1 + hw + 1e-6;
    } else {
      const p = this.z + d;
      this.z = d > 0 ? Math.floor(p + hw) - hw - 1e-6 : Math.floor(p - hw) + 1 + hw + 1e-6;
    }
    if (this.collides(world, 0, 0, 0)) { this.x = ox; this.y = oy; this.z = oz; }
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
