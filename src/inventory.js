// Inventory: 9 hotbar slots (0-8) + 27 storage slots (9-35), four armor slots and the stack held
// on the mouse cursor. Slots hold { id, count, dmg }.
import { maxStack, itemDef } from './items.js';

const TAKE_ORDER = Array.from({ length: 36 }, (_, k) => (k + 9) % 36);

// Can two stacks merge? (Same item, same wear.)
export const sameItem = (a, b) => !!a && !!b && a.id === b.id && (a.dmg ?? 0) === (b.dmg ?? 0);

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
  add(id, count = 1, dmg = 0) {
    const max = maxStack(id);
    if (max > 1) {
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
        this.slots[i] = { id, count: n, dmg };
        count -= n;
      }
    }
    return count;
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
      if (!s || s.id !== id || s.dmg) continue;
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
    s.dmg = (s.dmg ?? 0) + amount;
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
      s.dmg = (s.dmg ?? 0) + wear;
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
    const left = this.add(this.cursor.id, this.cursor.count, this.cursor.dmg ?? 0);
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
    data.slots?.forEach((s, i) => { if (valid(s) && i < 36) this.slots[i] = { id: s.id, count: s.count, dmg: s.dmg ?? 0 }; });
    data.armor?.forEach((s, i) => { if (valid(s) && i < 4 && itemDef(s.id).armor?.slot === i) this.armor[i] = { id: s.id, count: 1, dmg: s.dmg ?? 0 }; });
    // Something held on the cursor when the game was saved goes back into the inventory.
    if (valid(data.cursor)) this.add(data.cursor.id, data.cursor.count, data.cursor.dmg ?? 0);
    this.selected = Math.max(0, Math.min(8, data.selected ?? 0));
  }
}
