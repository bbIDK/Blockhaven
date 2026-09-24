// Other players in the world. Each one is drawn with the player model (Minecraft's proportions,
// skinned from the avatar tiles in textures.js) in their own shirt and trouser colours, with the
// armour they wear and the item in their hand, animated from what their presence reports: where
// they are and look, walking, sneaking, swinging and getting hurt. A name tag floats above.
import { boxMesh, MODEL_OFFSET } from './models.js';
import { TEX } from './textures.js';
import { itemDef } from './items.js';
import { hashString, mat4, identity, translate, rotateX, rotateY, rotateZ, scale, clamp } from './math.js';

const PX = 1 / 16;
const TAU = Math.PI * 2;
const SHIRTS = [
  [47, 125, 140], [196, 62, 52], [62, 150, 72], [138, 82, 172], [224, 150, 42],
  [58, 102, 196], [206, 92, 150], [236, 236, 236], [34, 162, 160], [120, 120, 124],
];
const TROUSERS = [[46, 58, 102], [62, 62, 68], [84, 58, 40], [36, 36, 44], [52, 84, 60]];
const ARMOR_TINT = { leather: [150, 96, 58], iron: [226, 226, 226], golden: [250, 206, 62], diamond: [96, 226, 220] };
const INTERP_DELAY = 120; // ms behind the newest position, to smooth out uneven arrival

export function playerColors(name) {
  const h = hashString(name || 'Player');
  return { shirt: SHIRTS[h % SHIRTS.length], trousers: TROUSERS[(h >>> 8) % TROUSERS.length] };
}

const num = (v) => typeof v === 'number' && Number.isFinite(v);
const wrap = (a) => a - Math.round(a / TAU) * TAU;

// ---------------------------------------------------------------- state
// Another player as this page knows them: their presence, and a smoothed position to draw.
export class RemotePlayer {
  constructor(addr) {
    this.addr = addr;
    this.name = 'Player';
    this.samples = [];
    this.ready = false;
    this.x = 0; this.y = 0; this.z = 0; this.yaw = 0; this.pitch = 0; this.bodyYaw = 0;
    this.flags = 0;
    this.held = 0;
    this.armor = [0, 0, 0, 0];
    this.swingN = null; this.swing = 0;
    this.hurtN = null; this.hurt = 0;
    this.walk = 0; this.walkPhase = 0;
    this.lastX = 0; this.lastZ = 0;
  }

  get sneaking() { return !!(this.flags & 1); }
  get dead() { return !!(this.flags & 16); }
  get sleeping() { return !!(this.flags & 32); }
  get creative() { return !!(this.flags & 64); }

  // Presence: { n: name, p: [x, y, z, yaw, pitch], f: flags, i: held item, a: armour, s: swings, u: hurts }.
  update(pres, name, now) {
    this.name = name;
    const p = pres.p;
    if (Array.isArray(p) && p.length >= 5 && p.slice(0, 5).every(num)) {
      const s = { t: now, x: p[0], y: p[1], z: p[2], yaw: p[3], pitch: clamp(p[4], -1.6, 1.6) };
      const last = this.samples[this.samples.length - 1];
      if (!last || last.x !== s.x || last.y !== s.y || last.z !== s.z || last.yaw !== s.yaw || last.pitch !== s.pitch) this.samples.push(s);
      if (this.samples.length > 16) this.samples.shift();
      if (!this.ready) {
        this.ready = true;
        Object.assign(this, { x: s.x, y: s.y, z: s.z, yaw: s.yaw, pitch: s.pitch, bodyYaw: s.yaw, lastX: s.x, lastZ: s.z });
      }
    }
    this.flags = Number.isInteger(pres.f) ? pres.f : 0;
    this.held = Number.isInteger(pres.i) && itemDef(pres.i) ? pres.i : 0;
    const a = Array.isArray(pres.a) ? pres.a : [];
    this.armor = [0, 1, 2, 3].map((i) => (Number.isInteger(a[i]) && itemDef(a[i])?.armor?.slot === i ? a[i] : 0));
    // Counters that go up with every swing and every hit taken.
    if (Number.isInteger(pres.s)) { if (this.swingN !== null && pres.s !== this.swingN) this.swing = 1e-3; this.swingN = pres.s; }
    if (Number.isInteger(pres.u)) { if (this.hurtN !== null && pres.u !== this.hurtN) this.hurt = 0.5; this.hurtN = pres.u; }
  }

  step(now, dt) {
    const s = this.samples;
    if (s.length) {
      const rt = now - INTERP_DELAY;
      let a = s[0], b = s[0];
      if (rt >= s[s.length - 1].t) a = b = s[s.length - 1];
      else {
        for (let i = 0; i < s.length - 1; i++) if (s[i].t <= rt && rt < s[i + 1].t) { a = s[i]; b = s[i + 1]; break; }
      }
      // A long jump (teleport, respawn) snaps rather than gliding across the map.
      const far = Math.abs(b.x - a.x) + Math.abs(b.y - a.y) + Math.abs(b.z - a.z) > 24;
      const k = b === a || far ? 1 : clamp((rt - a.t) / (b.t - a.t), 0, 1);
      if (far) { this.lastX = b.x; this.lastZ = b.z; }
      this.x = a.x + (b.x - a.x) * k;
      this.y = a.y + (b.y - a.y) * k;
      this.z = a.z + (b.z - a.z) * k;
      this.yaw = a.yaw + wrap(b.yaw - a.yaw) * k;
      this.pitch = a.pitch + (b.pitch - a.pitch) * k;
      // Drop samples that are no longer needed.
      while (s.length > 2 && s[1].t <= rt) s.shift();
    }
    const moved = Math.hypot(this.x - this.lastX, this.z - this.lastZ);
    this.lastX = this.x; this.lastZ = this.z;
    const speed = dt > 0 ? moved / dt : 0;
    this.walk += (Math.min(1, speed / 4.3) - this.walk) * Math.min(1, dt * 10);
    this.walkPhase += Math.min(speed, 12) * dt * 1.7;
    // The body follows the head lazily, and turns with it when walking.
    let d = wrap(this.yaw - this.bodyYaw);
    const lim = this.walk > 0.2 ? 0.3 : 0.9;
    if (d > lim) this.bodyYaw = this.yaw - lim; else if (d < -lim) this.bodyYaw = this.yaw + lim;
    d = wrap(this.yaw - this.bodyYaw);
    this.bodyYaw += d * Math.min(1, dt * (this.walk > 0.2 ? 8 : 1.5));
    if (this.swing > 0) { this.swing += dt * 3.4; if (this.swing >= 1) this.swing = 0; }
    this.hurt = Math.max(0, this.hurt - dt);
  }
}

// ---------------------------------------------------------------- model
const regions = (u, v, w, h, d) => ({
  top: [u + d, v, w, d], bottom: [u + d + w, v, w, d],
  right: [u, v + d, d, h], front: [u + d, v + d, w, h], left: [u + d + w, v + d, d, h], back: [u + 2 * d + w, v + d, w, h],
});
const HEAD = regions(0, 0, 8, 8, 8);
const BODY = { ...regions(16, 16, 8, 12, 4) };
BODY.bottom = BODY.top; // (never seen; the real one straddles two tiles)
const ARM = regions(40, 16, 4, 12, 4);
const LEG = regions(0, 16, 4, 12, 4);

// A rectangle of the 64x32 skin as a face: the texture tile it lies in, and where in the tile.
// The top face is turned around so the front edge of the texture meets the front face.
function skinFace([sx, sy, w, h], turn = false) {
  const tile = (sy >> 4) * 4 + (sx >> 4);
  const u0 = sx & 15, v0 = sy & 15;
  return { layer: TEX[`avatar_${tile}`], uv: turn ? [u0 + w, v0 + h, u0, v0] : [u0, v0, u0 + w, v0 + h] };
}

// A box (in pixels) skinned from `reg`. `rows` takes part of the side faces (a sleeve, a shoe).
function part(from, to, reg, { rows = null, top = true, bottom = true, tint = null } = {}) {
  const [r0, r1] = rows ?? [0, reg.front[3]];
  const side = (r) => skinFace([r[0], r[1] + r0, r[2], r1 - r0]);
  return {
    from: from.map((v) => v * PX), to: to.map((v) => v * PX), tint, flags: tint ? 1 : 0, // (flag 1: the shader applies the tint)
    faces: [side(reg.right), side(reg.left), top ? skinFace(reg.top, true) : null, bottom ? skinFace(reg.bottom) : null, side(reg.back), side(reg.front)],
  };
}

// An armour plate: the box grown by `grow` pixels, in the material's colour. A helmet leaves
// the face open (no front and no bottom).
function plate(from, to, grow, tint, helmet = false) {
  const face = { layer: TEX.avatar_armor, uv: [0, 0, 16, 16] };
  return {
    from: from.map((v) => (v - grow) * PX), to: to.map((v) => (v + grow) * PX), tint, flags: 1,
    faces: [face, face, face, helmet ? null : face, face, helmet ? null : face],
  };
}

// Model parts in pixels. The model faces -Z; its right side is +X. Pivots are the joints.
function modelParts(colors, armor) {
  const { shirt, trousers } = colors;
  const mat = armor.map((id) => (id ? ARMOR_TINT[itemDef(id).armor.material] ?? ARMOR_TINT.iron : null));
  const arm = (x0, x1) => [
    part([x0, 20, -2], [x1, 24, 2], ARM, { rows: [0, 4], bottom: false, tint: shirt }),
    part([x0, 12, -2], [x1, 20, 2], ARM, { rows: [4, 12], top: false }),
    ...(mat[1] ? [plate([x0, 19, -2], [x1, 24, 2], 1, mat[1])] : []),
  ];
  const leg = (x0, x1) => [
    part([x0, 2, -2], [x1, 12, 2], LEG, { rows: [0, 10], bottom: false, tint: trousers }),
    part([x0, 0, -2], [x1, 2, 2], LEG, { rows: [10, 12], top: false }),
    ...(mat[2] ? [plate([x0, 4, -2], [x1, 12, 2], 0.5, mat[2])] : []),
    ...(mat[3] ? [plate([x0, 0, -2], [x1, 4, 2], 1, mat[3])] : []),
  ];
  return {
    head: {
      pivot: [0, 24, 0],
      boxes: [
        part([-4, 24, -4], [4, 32, 4], HEAD),
        // A helmet: a shell open at the face, with a brow across the forehead.
        ...(mat[0] ? [plate([-4, 26, -4], [4, 32, 4], 1, mat[0], true), plate([-4, 30, -4], [4, 32, -3.5], 1, mat[0])] : []),
      ],
    },
    body: {
      pivot: [0, 12, 0],
      boxes: [
        part([-4, 12, -2], [4, 24, 2], BODY, { tint: shirt }),
        ...(mat[1] ? [plate([-4, 14, -2], [4, 24, 2], 1, mat[1])] : []),
        ...(mat[2] ? [plate([-4, 12, -2], [4, 15, 2], 0.5, mat[2])] : []),
      ],
    },
    rightArm: { pivot: [6, 22, 0], boxes: arm(4, 8) },
    leftArm: { pivot: [-6, 22, 0], boxes: arm(-8, -4) },
    rightLeg: { pivot: [2, 12, 0], boxes: leg(0, 4) },
    leftLeg: { pivot: [-2, 12, 0], boxes: leg(-4, 0) },
  };
}

export class Avatars {
  constructor(renderer) {
    this.renderer = renderer;
    this.models = new Map();
    this.mats = [];
    this.matIndex = 0;
    this.tags = new Map();
    this.tagRoot = null;
  }

  model(name, armor) {
    const key = `${name}|${armor.join(',')}`;
    let m = this.models.get(key);
    if (!m) {
      if (this.models.size > 48) this.models.clear(); // (rare: many armour changes in a long game)
      m = {};
      for (const [k, g] of Object.entries(modelParts(playerColors(name), armor))) {
        m[k] = { pivot: g.pivot.map((v) => v * PX), mesh: this.renderer.createMesh(boxMesh(g.boxes)) };
      }
      this.models.set(key, m);
    }
    return m;
  }

  mat() {
    if (this.matIndex >= this.mats.length) this.mats.push(mat4());
    return this.mats[this.matIndex++];
  }

  // Adds draw entries for `players` (RemotePlayers) to `out` (the entity list the renderer draws).
  render(players, cam, world, maxDist, out) {
    this.matIndex = 0;
    for (const rp of players) {
      if (!rp.ready || rp.dead) continue;
      const rx = rp.x - cam.x, ry = rp.y - cam.y, rz = rp.z - cam.z;
      if (rx * rx + rz * rz > maxDist * maxDist) continue;
      const l = world.getLight(Math.floor(rp.x), Math.floor(rp.y + 1.2), Math.floor(rp.z));
      const m = this.model(rp.name, rp.armor);
      const sneak = rp.sneaking;
      const walkA = Math.sin(rp.walkPhase) * 0.9 * rp.walk;
      const attack = rp.swing > 0 ? Math.sin(rp.swing * Math.PI) : 0;
      const parts = [];
      const base = (mat) => {
        identity(mat);
        translate(mat, mat, rx, ry - (sneak ? 0.08 : 0), rz);
        rotateY(mat, mat, rp.bodyYaw);
        return mat;
      };
      // Everything above the hips leans forward when sneaking.
      const torso = (mat) => {
        base(mat);
        if (sneak) { translate(mat, mat, 0, 12 * PX, 0); rotateX(mat, mat, -0.45); translate(mat, mat, 0, -12 * PX, 0); }
        return mat;
      };
      const joint = (mat, pivot, ax, ay = 0, az = 0) => {
        translate(mat, mat, pivot[0], pivot[1], pivot[2]);
        if (ay) rotateY(mat, mat, ay);
        if (ax) rotateX(mat, mat, ax);
        if (az) rotateZ(mat, mat, az);
        translate(mat, mat, -pivot[0], -pivot[1], -pivot[2]);
        return mat;
      };
      const add = (g, mat) => { translate(mat, mat, -MODEL_OFFSET, -MODEL_OFFSET, -MODEL_OFFSET); parts.push({ mesh: g.mesh, model: mat }); };
      const legBack = sneak ? 0.3 : 0;
      add(m.rightLeg, joint(base(this.mat()), m.rightLeg.pivot, walkA - legBack));
      add(m.leftLeg, joint(base(this.mat()), m.leftLeg.pivot, -walkA - legBack));
      add(m.body, torso(this.mat()));
      add(m.head, joint(torso(this.mat()), m.head.pivot, rp.pitch + (sneak ? 0.45 : 0), wrap(rp.yaw - rp.bodyYaw)));
      const leftA = walkA * 0.7 + (sneak ? 0.35 : 0);
      add(m.leftArm, joint(torso(this.mat()), m.leftArm.pivot, leftA, 0, -0.05));
      // The right arm swings forward and up to hit or use something, and holds the item.
      const rightA = -walkA * 0.7 + (sneak ? 0.35 : 0) + (rp.held ? 0.3 : 0) + attack * 1.3;
      const arm = joint(torso(this.mat()), m.rightArm.pivot, rightA, -attack * 0.4, 0.05);
      const held = rp.held ? this.renderer.itemMesh(rp.held) : null;
      if (held) parts.push({ mesh: held, model: this.heldItem(arm, held) });
      add(m.rightArm, arm);
      out.push({ parts, light: [l >> 4, l & 15], tint: null, hurt: rp.hurt > 0 });
    }
  }

  // The item in a right hand: a block as a little cube in the fist, anything else (tools, food)
  // gripped at its handle and pointing forward.
  heldItem(arm, mesh) {
    const m = this.mat();
    m.set(arm);
    translate(m, m, 6 * PX, 12.5 * PX, -1 * PX);
    if (mesh.kind === 'block') {
      translate(m, m, 0, -1.5 * PX, -1 * PX);
      rotateY(m, m, Math.PI / 4);
      scale(m, m, 0.25, 0.25, 0.25);
      translate(m, m, -0.5 - MODEL_OFFSET, -0.5 - MODEL_OFFSET, -0.5 - MODEL_OFFSET);
    } else {
      // Item pictures have the handle at the bottom left and the tip at the top right: turned
      // side-on, with the handle in the fist and the tip pointing forward and up.
      translate(m, m, 0, 1.5 * PX, 0);
      rotateY(m, m, Math.PI / 2);
      scale(m, m, 0.62, 0.62, 0.62);
      translate(m, m, -0.12 - MODEL_OFFSET, -0.12 - MODEL_OFFSET, -0.5 - MODEL_OFFSET);
    }
    return m;
  }

  // Name tags over the heads, positioned with the frame's view-projection matrix.
  renderTags(players, cam, viewProj, canvas, root) {
    const seen = new Set();
    const w = canvas.clientWidth, h = canvas.clientHeight;
    for (const rp of players) {
      if (!rp.ready || rp.dead) continue;
      const x = rp.x - cam.x, y = rp.y + (rp.sneaking ? 1.95 : 2.1) - cam.y, z = rp.z - cam.z;
      const dist = Math.hypot(x, y, z);
      const m = viewProj;
      const cw = m[3] * x + m[7] * y + m[11] * z + m[15];
      if (cw < 0.1 || dist > 64) continue;
      const cx = (m[0] * x + m[4] * y + m[8] * z + m[12]) / cw, cy = (m[1] * x + m[5] * y + m[9] * z + m[13]) / cw;
      if (cx < -1.2 || cx > 1.2 || cy < -1.2 || cy > 1.4) continue;
      let el = this.tags.get(rp.addr);
      if (!el) {
        el = document.createElement('div');
        el.className = 'nametag';
        root.appendChild(el);
        this.tags.set(rp.addr, el);
      }
      if (el.textContent !== rp.name) el.textContent = rp.name;
      const s = clamp(6 / Math.max(1, dist), 0.45, 1.2);
      el.style.transform = `translate(${((cx * 0.5 + 0.5) * w).toFixed(1)}px, ${((0.5 - cy * 0.5) * h).toFixed(1)}px) translate(-50%, -100%) scale(${s.toFixed(3)})`;
      el.classList.toggle('sneak', rp.sneaking);
      el.hidden = false;
      seen.add(rp.addr);
    }
    for (const [addr, el] of this.tags) {
      if (seen.has(addr)) continue;
      if (![...players].some((p) => p.addr === addr)) { el.remove(); this.tags.delete(addr); } else el.hidden = true;
    }
  }

  clearTags() {
    for (const el of this.tags.values()) el.remove();
    this.tags.clear();
  }
}
