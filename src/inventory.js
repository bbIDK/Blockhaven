// Inventory: 9 hotbar slots (0-8) + 27 storage slots (9-35). Slots hold { id, count, dmg }.
import { maxStack, itemDef, GROUPS, RECIPES } from './items.js';

export class Inventory {
  constructor() {
    this.slots = new Array(36).fill(null);
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
        if (s && s.id === id && s.count < max) {
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

  remove(id, count) {
    for (let i = 35; i >= 0 && count > 0; i--) {
      const s = this.slots[i];
      if (!s || s.id !== id) continue;
      const n = Math.min(count, s.count);
      s.count -= n;
      count -= n;
      if (s.count <= 0) this.slots[i] = null;
    }
    return count === 0;
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

  // Ingredient check for a recipe; `stations` is a Set of nearby stations ('table', 'furnace').
  canCraft(recipe, stations) {
    if (recipe.station && !stations.has(recipe.station)) return false;
    return recipe.input.every((ing) => this.countIngredient(ing) >= ing.n);
  }

  countIngredient(ing) {
    if (!ing.group) return this.count(ing.id);
    return GROUPS[ing.group].reduce((sum, id) => sum + this.count(id), 0);
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

  // Crafts once. Output that doesn't fit goes onto an empty (or matching) cursor; otherwise
  // the recipe is refused so nothing is lost.
  craft(recipe, stations) {
    if (!this.canCraft(recipe, stations)) return false;
    const c = this.cursor;
    const cursorRoom = !c ? maxStack(recipe.out) : c.id === recipe.out && !c.dmg ? maxStack(c.id) - c.count : 0;
    if (!this.spaceFor(recipe.out, recipe.count) && cursorRoom < recipe.count) return false;
    for (const ing of recipe.input) {
      if (!ing.group) { this.remove(ing.id, ing.n); continue; }
      let need = ing.n;
      const ids = [...GROUPS[ing.group]].sort((a, b) => this.count(b) - this.count(a));
      for (const id of ids) {
        const take = Math.min(need, this.count(id));
        this.remove(id, take);
        need -= take;
        if (!need) break;
      }
    }
    const left = this.add(recipe.out, recipe.count);
    if (left) {
      if (this.cursor) this.cursor.count += left;
      else this.cursor = { id: recipe.out, count: left, dmg: 0 };
    }
    return true;
  }

  // Slot click with a cursor stack, Minecraft style. button: 0 left, 2 right.
  click(i, button) { this.clickSlots(this.slots, i, button); }

  // Same, for any array of slots (the player's own or a chest's).
  clickSlots(slots, i, button) {
    const s = slots[i], c = this.cursor;
    if (button === 2) {
      if (!c && s) {
        const half = Math.ceil(s.count / 2);
        this.cursor = { ...s, count: half };
        s.count -= half;
        if (!s.count) slots[i] = null;
      } else if (c && (!s || (s.id === c.id && s.count < maxStack(s.id)))) {
        if (s) s.count++; else slots[i] = { ...c, count: 1 };
        c.count--;
        if (!c.count) this.cursor = null;
      }
      return;
    }
    if (!c) { this.cursor = s; slots[i] = null; return; }
    if (!s) { slots[i] = c; this.cursor = null; return; }
    if (s.id === c.id && maxStack(s.id) > 1) {
      const n = Math.min(c.count, maxStack(s.id) - s.count);
      s.count += n;
      c.count -= n;
      if (!c.count) this.cursor = null;
      return;
    }
    slots[i] = c;
    this.cursor = s;
  }

  // Shift-click: move a stack between the hotbar and storage.
  quickMove(i) {
    const s = this.slots[i];
    if (!s) return;
    this.slots[i] = null;
    const range = i < 9 ? [9, 36] : [0, 9];
    let count = s.count;
    const max = maxStack(s.id);
    for (let j = range[0]; j < range[1] && count; j++) {
      const t = this.slots[j];
      if (t && t.id === s.id && t.count < max) { const n = Math.min(count, max - t.count); t.count += n; count -= n; }
    }
    for (let j = range[0]; j < range[1] && count; j++) {
      if (!this.slots[j]) { this.slots[j] = { ...s, count }; count = 0; }
    }
    if (count) this.slots[i] = { ...s, count };
  }

  // Moves a whole stack into `slots` (merging first). Returns what didn't fit.
  static insert(slots, stack) {
    let count = stack.count;
    const max = maxStack(stack.id);
    for (let j = 0; j < slots.length && count; j++) {
      const t = slots[j];
      if (t && t.id === stack.id && t.count < max && !t.dmg && !stack.dmg) { const n = Math.min(count, max - t.count); t.count += n; count -= n; }
    }
    for (let j = 0; j < slots.length && count; j++) {
      if (!slots[j]) { slots[j] = { ...stack, count: Math.min(count, max) }; count -= Math.min(count, max); }
    }
    return count;
  }

  // Put whatever is on the cursor back into the inventory.
  returnCursor() {
    if (!this.cursor) return 0;
    const left = this.add(this.cursor.id, this.cursor.count, this.cursor.dmg);
    this.cursor = null;
    return left;
  }

  serialize() {
    return { slots: this.slots.map((s) => (s ? { ...s } : null)), cursor: this.cursor ? { ...this.cursor } : null, selected: this.selected };
  }

  load(data) {
    this.slots = new Array(36).fill(null);
    if (!data) return;
    data.slots?.forEach((s, i) => { if (s && itemDef(s.id) && i < 36) this.slots[i] = { id: s.id, count: s.count, dmg: s.dmg ?? 0 }; });
    // Something held on the cursor when the game was saved goes back into the inventory.
    if (data.cursor && itemDef(data.cursor.id)) this.add(data.cursor.id, data.cursor.count, data.cursor.dmg ?? 0);
    this.selected = Math.max(0, Math.min(8, data.selected ?? 0));
  }
}

export { RECIPES };
