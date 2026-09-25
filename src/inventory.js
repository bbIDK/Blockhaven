// Inventory: 9 hotbar slots (0-8) + 27 storage slots (9-35), four armor slots and the stack held
// on the mouse cursor. Slots hold { id, count, dmg }, and sometimes extras: `ench` (enchantments,
// see enchanting.js), `name` (given at an anvil) and `work` (how often it's been to the anvil).
import { maxStack, itemDef } from './items.js';
import { cleanEnch, enchLevel } from './enchanting.js';

const TAKE_ORDER = Array.from({ length: 36 }, (_, k) => (k + 9) % 36);

// A stack's extras (or null when it has none).
export function extras(s) {
  if (!s || (!s.ench && !s.name && !s.work)) return null;
  const o = {};
  if (s.ench) o.ench = s.ench;
  if (s.name) o.name = s.name;
  if (s.work) o.work = s.work;
  return o;
}
// The same, checked over (from a save, or from another player).
export function cleanExtras(s) {
  if (!s || typeof s !== 'object') return null;
  const o = {}, ench = cleanEnch(s.ench);
  if (ench) o.ench = ench;
  if (typeof s.name === 'string' && s.name.trim()) o.name = s.name.replace(/\p{C}/gu, '').slice(0, 40);
  if (Number.isInteger(s.work) && s.work > 0) o.work = Math.min(s.work, 40);
  return Object.keys(o).length ? o : null;
}
const sameExtras = (a, b) => (!a.ench && !a.name && !a.work && !b.ench && !b.name && !b.work) || JSON.stringify(extras(a)) === JSON.stringify(extras(b));

// Can two stacks merge? (Same item, same wear, same enchantments and name.)
export const sameItem = (a, b) => !!a && !!b && a.id === b.id && (a.dmg ?? 0) === (b.dmg ?? 0) && sameExtras(a, b);

// Wear from using a tool (or armor taking a hit): Unbreaking makes it likely none is taken.
function wearFor(s, amount, armor) {
  const u = enchLevel(s, 'unbreaking');
  if (!u) return amount;
  let n = 0;
  for (let i = 0; i < amount; i++) if (armor ? Math.random() < 0.6 + 0.4 / (u + 1) : Math.random() < 1 / (u + 1)) n++;
  return n;
}

export class Inventory {
  constructor() {
    this.slots = new Array(36).fill(null);
    this.armor = [null, null, null, null]; // helmet, chestplate, leggings, boots
    this.selected = 0;
    this.cursor = null;
  }

  get held() { return this.slots[this.selected]; }
  get heldId() { return this.slots[this.selected]?.id ?? 0; }

  // Adds items, filling matching stacks first (hotbar before storage). Returns the amount left over.
  // `x`: the stack's extras (enchantments and so on), if any.
  add(id, count = 1, dmg = 0, x = null) {
    const max = maxStack(id);
    if (max > 1 && !x) {
      for (let i = 0; i < 36 && count > 0; i++) {
        const s = this.slots[i];
        if (s && s.id === id && (s.dmg ?? 0) === dmg && s.count < max) {
          const n = Math.min(count, max - s.count);
          s.count += n;
          count -= n;
        }
      }
    }
    for (let i = 0; i < 36 && count > 0; i++) {
      if (!this.slots[i]) {
        const n = Math.min(count, max);
        this.slots[i] = x ? { id, count: n, dmg, ...x } : { id, count: n, dmg };
        count -= n;
      }
    }
    return count;
  }

  // How many more of an item would fit.
  room(id, dmg = 0) {
    const max = maxStack(id);
    let n = 0;
    for (const s of this.slots) {
      if (!s) n += max;
      else if (max > 1 && s.id === id && (s.dmg ?? 0) === dmg) n += Math.max(0, max - s.count);
    }
    return n;
  }

  count(id) {
    let n = 0;
    for (const s of this.slots) if (s && s.id === id) n += s.count;
    return n;
  }

  // Takes `count` of an item, from storage before the hotbar. Returns how many it found.
  take(id, count) {
    let got = 0;
    for (const i of TAKE_ORDER) {
      const s = this.slots[i];
      if (!s || s.id !== id || s.dmg || s.ench || s.name) continue;
      const n = Math.min(count - got, s.count);
      s.count -= n;
      got += n;
      if (!s.count) this.slots[i] = null;
      if (got >= count) break;
    }
    return got;
  }

  // Uses one of the held item (placing a block, eating).
  consumeHeld() {
    const s = this.held;
    if (!s) return;
    s.count--;
    if (s.count <= 0) this.slots[this.selected] = null;
  }

  // Wears the held tool; returns true if it broke.
  damageHeld(amount = 1) {
    const s = this.held;
    const def = s && itemDef(s.id);
    if (!def?.durability) return false;
    s.dmg = (s.dmg ?? 0) + wearFor(s, amount, false);
    if (s.dmg >= def.durability) { this.slots[this.selected] = null; return true; }
    return false;
  }

  // Armor points and toughness of everything worn.
  get armorPoints() { return this.armor.reduce((n, s) => n + (s ? itemDef(s.id).armor.points : 0), 0); }
  get toughness() { return this.armor.reduce((n, s) => n + (s ? itemDef(s.id).armor.toughness : 0), 0); }

  // Armor wears down when it takes a hit. Returns the ids of pieces that broke.
  damageArmor(amount) {
    const wear = Math.max(1, Math.floor(amount / 4));
    const broke = [];
    this.armor.forEach((s, i) => {
      if (!s) return;
      s.dmg = (s.dmg ?? 0) + wearFor(s, wear, true);
      if (s.dmg >= itemDef(s.id).durability) { broke.push(s.id); this.armor[i] = null; }
    });
    return broke;
  }

  // Room for `count` more of `id` in the slots (not counting the cursor).
  spaceFor(id, count) {
    const max = maxStack(id);
    let room = 0;
    for (const s of this.slots) {
      if (!s) room += max;
      else if (s.id === id && s.count < max && !s.dmg) room += max - s.count;
      if (room >= count) return true;
    }
    return false;
  }

  // Puts whatever is on the cursor back into the inventory; returns what didn't fit.
  returnCursor() {
    if (!this.cursor) return 0;
    const left = this.add(this.cursor.id, this.cursor.count, this.cursor.dmg ?? 0, extras(this.cursor));
    this.cursor = null;
    return left;
  }

  serialize() {
    const copy = (s) => (s ? { ...s } : null);
    return { slots: this.slots.map(copy), armor: this.armor.map(copy), cursor: copy(this.cursor), selected: this.selected };
  }

  load(data) {
    this.slots = new Array(36).fill(null);
    this.armor = [null, null, null, null];
    if (!data) return;
    const valid = (s) => s && itemDef(s.id) && s.count > 0;
    data.slots?.forEach((s, i) => { if (valid(s) && i < 36) this.slots[i] = { id: s.id, count: s.count, dmg: s.dmg ?? 0, ...cleanExtras(s) }; });
    data.armor?.forEach((s, i) => {
      if (valid(s) && i < 4 && itemDef(s.id).armor?.slot === i) this.armor[i] = { id: s.id, count: 1, dmg: s.dmg ?? 0, ...cleanExtras(s) };
    });
    // Something held on the cursor when the game was saved goes back into the inventory.
    if (valid(data.cursor)) this.add(data.cursor.id, data.cursor.count, data.cursor.dmg ?? 0, cleanExtras(data.cursor));
    this.selected = Math.max(0, Math.min(8, data.selected ?? 0));
  }
}
