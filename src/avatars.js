// Other players in the world. Each one is drawn with the player model (Minecraft's proportions)
// in the look they picked, with the armour they wear and the item in their hand, animated from
// what their presence reports: where they are and look, walking, sneaking, swinging and getting
// hurt. A name tag floats above.
import { skinMesh, MODEL_OFFSET } from './models.js';
import { RIGS } from './rigs.js';
import { skinLayer, SKIN_INDEX } from './skins.js';
import { itemDef } from './items.js';
import { hashString, mat4, identity, translate, rotateX, rotateY, rotateZ, scale, clamp } from './math.js';

const PX = 1 / 16;
const TAU = Math.PI * 2;
const INTERP_DELAY = 120; // ms behind the newest position, to smooth out uneven arrival

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
    this.look = -1;
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

  // Presence: { n: name, p: [x, y, z, yaw, pitch], f: flags, i: held item, a: armour, k: look,
  // s: swings, u: hurts }.
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
    this.look = Number.isInteger(pres.k) ? pres.k : -1;
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
// Players are drawn like everyone else in the world: the humanoid model (rigs.js) cut from one of
// the player skins (tex/mobskins.js), with armour worn over it the way Minecraft wears it (the
// material's own skins on boxes a little larger than the body).
export const PLAYER_LOOKS = 8;
export function playerSkin(name, look = -1) {
  const i = Number.isInteger(look) && look >= 0 && look < PLAYER_LOOKS ? look : hashString(name || 'Player') % PLAYER_LOOKS;
  return `player_${i}`;
}

// Which bones each piece covers (helmet, chestplate, leggings, boots), from which of the
// material's two skins, and how far it stands out: the leggings sit under the chestplate and boots.
export const WEAR = [
  { bones: ['head'], grow: 1, skin: '' },
  { bones: ['body', 'rightArm', 'leftArm'], grow: 1, skin: '' },
  { bones: ['body', 'rightLeg', 'leftLeg'], grow: 0.5, skin: '_legs' },
  { bones: ['rightLeg', 'leftLeg'], grow: 1, skin: '' },
];
// Armour skins use the classic layout, where the left limbs mirror the right.
export const ARMOR_UV = { head: [0, 0], body: [16, 16], rightArm: [40, 16], leftArm: [40, 16], rightLeg: [0, 16], leftLeg: [0, 16] };

// The armour boxes over one bone, for `materials` ([material or null] per slot).
export function armorCubes(bone, materials) {
  const out = [];
  materials.forEach((mat, slot) => {
    const skinName = `armor_${mat}${WEAR[slot].skin}`;
    if (!mat || !WEAR[slot].bones.includes(bone) || !(skinName in SKIN_INDEX)) return;
    const base = RIGS.humanoid.bones[bone].cubes[0];
    out.push({ ...base, uv: ARMOR_UV[bone], inflate: WEAR[slot].grow, mirror: bone.startsWith('left'), layer: skinLayer(skinName) });
  });
  return out;
}
const materialsOf = (armor) => armor.map((id) => (id ? itemDef(id)?.armor?.material ?? null : null));

export class Avatars {
  constructor(renderer) {
    this.renderer = renderer;
    this.models = new Map();
    this.mats = [];
    this.matIndex = 0;
    this.tags = new Map();
    this.tagRoot = null;
  }

  model(skin, armor) {
    const mats = materialsOf(armor);
    const key = `${skin}|${mats.join(',')}`;
    let m = this.models.get(key);
    if (!m) {
      if (this.models.size > 48) this.models.clear(); // (rare: many armour changes in a long game)
      m = {};
      for (const [k, bone] of Object.entries(RIGS.humanoid.bones)) {
        const cubes = [...bone.cubes, ...armorCubes(k, mats)];
        m[k] = { pivot: bone.pivot.map((v) => v * PX), mesh: this.renderer.createMesh(skinMesh(cubes, skinLayer(skin))) };
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
      const m = this.model(playerSkin(rp.name, rp.look), rp.armor);
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
