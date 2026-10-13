// Game feel for big moments (the Devil Fruits' moves): screen shake and hit-stop.
// - Shake: a "trauma" of 0..1 that hits add to and that falls away by itself; the screen moves by
//   trauma squared, so small hits barely nudge it and big ones punch. It turns the camera (never the
//   player's body), smoothly (summed sines, not fresh randomness each frame), and the Screen Shake
//   option scales it (0 turns it off).
// - Hit-stop: the world (creatures, particles) all but stops for a few hundredths of a second on a
//   big impact; it's timed in real time, so it always ends, and the player can still move and look.
// Three sizes, so the whole game stays in proportion: a light hit, a heavy one, a huge one.
export const TIERS = {
  small: { trauma: 0.15, stop: 0 },
  medium: { trauma: 0.4, stop: 0.05 },
  large: { trauma: 0.8, stop: 0.12 },
};
const DECAY = 1.3;              // trauma lost a second
const MAX_YAW = 0.035, MAX_PITCH = 0.03, MAX_ROLL = 0.05; // radians at full trauma

export class Feel {
  constructor() { this.trauma = 0; this.t = 0; this.stopUntil = 0; this.scale = 1; }
  // A feedback of `tier` ('small', 'medium', 'large'), `near`: 0..1 how close to the player it was.
  hit(tier, near = 1) {
    const T = TIERS[tier] ?? TIERS.small;
    this.trauma = Math.min(1, this.trauma + T.trauma * near);
    if (T.stop && near > 0.5) this.stopUntil = Math.max(this.stopUntil, performance.now() + T.stop * 1000);
  }
  // How fast the world runs now (a hit-stop slows it to almost nothing).
  get timeScale() { return performance.now() < this.stopUntil ? 0.05 : 1; }
  update(dt) {
    this.trauma = Math.max(0, this.trauma - DECAY * dt);
    this.t += dt;
  }
  // The camera's turn from shaking: [yaw, pitch, roll] in radians (`amount`: the option, 0..1).
  shake(amount = 1) {
    const s = this.trauma * this.trauma * amount, t = this.t * 30;
    if (s <= 0) return null;
    const wob = (seed) => 0.6 * Math.sin(t * 1.1 + seed) + 0.4 * Math.sin(t * 2.3 + seed * 2);
    return [MAX_YAW * s * wob(0), MAX_PITCH * s * wob(7), MAX_ROLL * s * wob(13)];
  }
}
