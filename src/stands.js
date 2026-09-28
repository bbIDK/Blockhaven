// Armor stands: a wooden stand (Minecraft's model, rigs.js, with the pack's picture) to keep a suit
// of armour on. One goes up on the ground facing whoever puts it there (turned in eighths); armour
// used on it goes on (swapped for what it wore there), and with nothing in hand you take off the
// piece you point at (its head, body, legs or feet). Two quick punches knock it down (one, in
// Creative), and it drops itself and all it wore. A stand is an entity: { armor: [helmet,
// chestplate, leggings, boots] (stacks or null), yaw, hitAt (when it was last punched) }.
import { RIGS, boneMatrix } from './rigs.js';
import { skinMesh } from './models.js';
import { skinLayer } from './skins.js';
import { armorCubes } from './avatars.js';
import { itemDef } from './items.js';
import { extras, cleanExtras } from './inventory.js';
import { identity, translate, rotateY } from './math.js';

export const STAND_SIZE = { hw: 0.25, h: 1.975 };
// Two punches this close together (seconds) knock a stand down.
export const STAND_BREAK = 0.3;

// A stand's armour as saved or sent, and back (anything that isn't armour for its slot is left off).
export const saveArmor = (armor) => armor.map((s) => (s ? { id: s.id, dmg: s.dmg ?? 0, ex: extras(s) ?? undefined } : null));
export function loadArmor(list) {
  return [0, 1, 2, 3].map((i) => {
    const s = Array.isArray(list) ? list[i] : null;
    if (!s || itemDef(s.id)?.armor?.slot !== i) return null;
    return { id: s.id, count: 1, dmg: Number.isInteger(s.dmg) && s.dmg >= 0 ? s.dmg : 0, ...(cleanExtras(s.ex) ?? {}) };
  });
}

// The eighth turn that faces someone looking along `yaw`.
export const standYaw = (yaw) => Math.round((yaw + Math.PI) / (Math.PI / 4)) * (Math.PI / 4);

// Which piece a hand pointed `hy` blocks above a stand's feet reaches for (Minecraft's bands, the
// feet and body first): the slot of one it wears there, or -1.
export function slotAt(armor, hy) {
  if (hy >= 0.1 && hy < 0.55 && armor[3]) return 3;
  if (hy >= 0.9 && hy < 1.6 && armor[1]) return 1;
  if (hy >= 0.4 && hy < 1.2 && armor[2]) return 2;
  if (hy >= 1.6 && armor[0]) return 0;
  return -1;
}

// The stand's parts with what it wears over them, one mesh per bone (kept for each set of armour).
const cache = new Map();
function standMeshes(renderer, armor) {
  const mats = armor.map((s) => (s ? itemDef(s.id)?.armor?.material ?? null : null)), key = mats.join(',');
  let out = cache.get(key);
  if (out) return out;
  if (cache.size > 32) cache.clear();
  out = Object.entries(RIGS.armor_stand.bones).map(([name, bone]) => ({ name, bone,
    mesh: renderer.createMesh(skinMesh([...bone.cubes, ...armorCubes(name, mats)], skinLayer('armor_stand'), bone.pivot)) }));
  cache.set(key, out);
  return out;
}

// Draws a stand at (rx, ry, rz) from the camera: it rocks a moment when it's punched.
export function drawStand(ents, e, rx, ry, rz, light, out) {
  const base = identity(ents.mat()), since = e.age - (e.hitAt ?? -9);
  translate(base, base, rx, ry, rz);
  rotateY(base, base, e.yaw + (since < 0.25 ? Math.sin(since / 0.075 * Math.PI) * 0.05 : 0));
  const bones = RIGS.armor_stand.bones;
  const parts = standMeshes(ents.game.renderer, e.armor).map((m) => ({ mesh: m.mesh, model: boneMatrix(ents.mat(), base, m.bone, {}, m.name, bones) }));
  out.push({ parts, light, tint: null });
}
