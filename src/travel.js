// Going through a Nether portal. Standing in one, its swirl creeps over the view (with the rush of
// it) until, after four seconds (one in Creative), you're taken through: the view fills with it
// while the ground on the other side loads, and then you're standing in the portal there, the one
// already there or a new one built for you. A portal won't take you back until you've stepped
// out of it.
import { PORTAL } from './blocks.js';
import { TEX } from './textures.js';
import { destination, arrivalArea, findPortal, buildPortal, standIn } from './portals.js';

const WAIT = 4, WAIT_CREATIVE = 1;
const PATIENCE = 30; // seconds to wait for the far side's ground before arriving anyway

// The portal's eight frames, one above the other, as an image for the veil.
function portalStrip(renderer) {
  const c = document.createElement('canvas');
  c.width = 16; c.height = 128;
  const ctx = c.getContext('2d');
  for (let f = 0; f < 8; f++) {
    const i = TEX.nether_portal + f;
    ctx.putImageData(new ImageData(new Uint8ClampedArray(renderer.pixels.subarray(i * 1024, i * 1024 + 1024)), 16, 16), 0, f * 16);
  }
  return c.toDataURL();
}

export class Travel {
  constructor(game) {
    this.game = game;
    this.time = 0;       // seconds stood in a portal
    this.locked = false; // just come through: step out before it takes you again
    this.trip = null;    // { to, axis, area, t } while being taken through
    this.stopSound = null;
    this.veil = document.getElementById('portal-veil');
    this.image = null;
  }

  get busy() { return !!this.trip; }
  // How far the swirl has crept over the view (0..1).
  get closing() { return this.trip ? 1 : Math.min(1, this.time / (this.game.creative ? WAIT_CREATIVE : WAIT)); }

  // The way the portal the player is standing in runs ('x' or 'z'), or null.
  portalHere() {
    const g = this.game, w = g.world, b = g.player.box();
    for (let y = Math.floor(b[1]); y <= Math.floor(b[4]); y++) {
      for (let z = Math.floor(b[2]); z <= Math.floor(b[5]); z++) for (let x = Math.floor(b[0]); x <= Math.floor(b[3]); x++) {
        const axis = PORTAL[w.getBlock(x, y, z)];
        if (axis) return axis;
      }
    }
    return null;
  }

  // Every game tick.
  tick() {
    const g = this.game;
    if (this.trip) return;
    const axis = g.state === 'dead' || g.riding ? null : this.portalHere();
    if (!axis) { this.cancel(); this.locked = false; return; }
    if (this.locked) return;
    if (this.time === 0) this.stopSound = g.audio.portal('trigger');
    this.time += 1 / 20;
    if (this.time >= (g.creative ? WAIT_CREATIVE : WAIT)) this.go(axis);
  }

  // Stepped out before it took you (or it's all over: quit, died).
  cancel() {
    if (this.time > 0) { this.time = 0; this.stopSound?.(); this.stopSound = null; }
  }

  reset() {
    this.cancel();
    if (this.trip) this.game.world?.setArrival(null);
    this.trip = null;
    this.locked = false;
    this.hide();
  }

  // Off to the other side: wait there, held still behind the veil, while the ground loads.
  go(axis) {
    const g = this.game, p = g.player;
    const to = destination(p.x, p.y, p.z);
    this.trip = { to, axis, area: arrivalArea(to), t: 0 };
    this.time = 0;
    this.stopSound = null;
    g.fishing?.retract();
    g.mining = null;
    p.x = to.x + 0.5; p.y = to.y; p.z = to.z + 0.5;
    p.vx = p.vy = p.vz = 0; p.fallDistance = 0;
    g.world.setArrival(this.trip.area);
    this.show(true, to.nether ? 'Entering the Nether' : 'Leaving the Nether');
  }

  // Every frame.
  update(dt) {
    const g = this.game, w = g.world, t = this.trip;
    if (!t) {
      if (this.time > 0 && !g.hideHud) this.show(false, null, this.closing); else this.hide();
      return;
    }
    t.t += dt;
    const [cx, cz, r] = t.area, ready = w.readyAround(cx, cz, r);
    document.getElementById('travel-bar').style.width = `${Math.round(ready * 100)}%`;
    this.animate();
    if (ready < 1 && !(t.t > PATIENCE && w.readyChunk(t.to.x >> 4, t.to.z >> 4))) return;
    // Come out in the portal nearest where this one leads, or a new one.
    const spot = findPortal(w, t.to) ?? buildPortal(w, t.to, t.axis);
    const s = standIn(w, spot), p = g.player;
    p.x = s.x; p.y = s.y; p.z = s.z;
    p.vx = p.vy = p.vz = 0; p.fallDistance = 0;
    this.trip = null;
    this.locked = true;
    w.setArrival(null);
    this.hide();
    g.audio.portal('travel');
  }

  // The veil over the view: `through` while being taken through (saying where to), or else the
  // swirl, `k` of the way in.
  show(through, text, k = 1) {
    const v = this.veil;
    this.image ??= portalStrip(this.game.renderer);
    if (v.hidden) { v.hidden = false; v.style.backgroundImage = `url(${this.image})`; }
    v.classList.toggle('through', through);
    v.style.opacity = through ? '1' : (0.15 + k * 0.7).toFixed(3);
    document.getElementById('travel').hidden = !through;
    if (text) document.getElementById('travel-text').textContent = text;
    this.animate();
  }

  animate() {
    const f = Math.floor(performance.now() / 1000 * 12) % 8;
    this.veil.style.backgroundPosition = `0 ${(f / 7) * 100}%`;
  }

  hide() { if (!this.veil.hidden) this.veil.hidden = true; }
}
