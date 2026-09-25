// Container screens as Minecraft has them: the player's inventory (with its 2x2 crafting grid and
// armor slots), the crafting table, furnaces and chests. A menu is a list of slots over the
// player's inventory and some other storage; clicking, shift-clicking, dragging a stack across
// slots and double-clicking work the same way on all of them.
import { maxStack, itemDef, I } from './items.js';
import { sameItem, extras } from './inventory.js';
import { matchGrid, planRecipe, countItems, recipeFits, smeltsIn, fuelTime } from './crafting.js';
import { tableOffers, enchantable, anvil, grind } from './enchanting.js';

class Slot {
  constructor(menu, arr, i, group, o = {}) {
    this.arr = arr;
    this.i = i;
    this.group = group;
    this.index = menu.slots.length;
    this.limit = o.limit ?? 64;
    this.filter = o.filter ?? null;
    this.output = o.output ?? null; // 'craft' (a crafting result) or 'take' (a furnace's output)
  }
  get stack() { return this.arr[this.i]; }
  set stack(s) { this.arr[this.i] = s && s.count > 0 ? s : null; }
  accepts(s) { return !this.output && (!this.filter || this.filter(s)); }
  cap(s) { return Math.min(this.limit, maxStack(s.id)); }
}

export class Menu {
  constructor(game, kind) {
    this.game = game;
    this.inv = game.inv;
    this.kind = kind;
    this.slots = [];
    this.storage = [];
    this.hotbar = [];
    this.waiting = null; // multiplayer: containers whose contents haven't arrived yet
  }

  // Nothing can be moved until a multiplayer host has said what's inside.
  get syncing() { return !!this.waiting?.size; }

  add(arr, i, group, o) {
    const s = new Slot(this, arr, i, group, o);
    this.slots.push(s);
    return s;
  }

  addPlayer() {
    for (let i = 9; i < 36; i++) this.storage.push(this.add(this.inv.slots, i, 'storage'));
    for (let i = 0; i < 9; i++) this.hotbar.push(this.add(this.inv.slots, i, 'hotbar'));
  }

  get playerSlots() { return this.storage.concat(this.hotbar); }
  get cursor() { return this.inv.cursor; }
  set cursor(c) { this.inv.cursor = c && c.count > 0 ? c : null; }

  // A slot's contents changed (subclasses update crafting results and so on).
  changed(/* slot */) {}

  // Left (0) or right (2) click on a slot, with whatever is on the cursor.
  click(slot, button) {
    if (slot.output === 'craft') { this.takeResult(slot); return; }
    const s = slot.stack, c = this.cursor;
    if (!c) {
      if (!s) return;
      if (button === 2) {
        const half = Math.ceil(s.count / 2);
        this.cursor = { ...s, count: half };
        slot.stack = { ...s, count: s.count - half };
      } else {
        this.cursor = s;
        slot.stack = null;
      }
    } else if (!s) {
      if (!slot.accepts(c)) return;
      const n = Math.min(button === 2 ? 1 : c.count, slot.cap(c));
      slot.stack = { ...c, count: n };
      this.cursor = { ...c, count: c.count - n };
    } else if (sameItem(s, c)) {
      if (slot.output) {
        // Taking from an output slot adds to the cursor, as much as fits.
        const n = Math.min(s.count, maxStack(c.id) - c.count);
        if (n <= 0) return;
        this.cursor = { ...c, count: c.count + n };
        slot.stack = { ...s, count: s.count - n };
      } else {
        const n = Math.min(button === 2 ? 1 : c.count, slot.cap(s) - s.count);
        if (n <= 0) return;
        slot.stack = { ...s, count: s.count + n };
        this.cursor = { ...c, count: c.count - n };
      }
    } else if (slot.accepts(c) && c.count <= slot.cap(c)) {
      slot.stack = c;
      this.cursor = s;
    } else return;
    this.changed(slot);
  }

  // Shift-click: send the stack to the other side of the screen.
  quickMove(slot) {
    if (slot.output === 'craft') { this.craftAll(); return; }
    const s = slot.stack;
    if (!s) return;
    let left = s.count;
    for (const [list, reverse] of this.targets(slot, s)) {
      left = this.moveInto(s, left, list, reverse);
      if (!left) break;
    }
    if (left === s.count) return;
    slot.stack = left ? { ...s, count: left } : null;
    this.changed(slot);
  }

  // Where shift-clicked items go: a list of [slots, reverse order?] to try in turn.
  targets(slot) {
    if (slot.group === 'storage') return [[this.hotbar, false]];
    if (slot.group === 'hotbar') return [[this.storage, false]];
    return [[this.playerSlots, false]];
  }

  // Moves `count` of stack `s` into `list`: topping up matching stacks first, then empty slots.
  // Returns how many didn't fit.
  moveInto(s, count, list, reverse) {
    const order = reverse ? [...list].reverse() : list;
    if (maxStack(s.id) > 1) {
      for (const t of order) {
        const ts = t.stack;
        if (!count) break;
        if (!ts || !sameItem(ts, s) || !t.accepts(s)) continue;
        const n = Math.min(count, t.cap(ts) - ts.count);
        if (n <= 0) continue;
        t.stack = { ...ts, count: ts.count + n };
        count -= n;
        this.changed(t);
      }
    }
    for (const t of order) {
      if (!count) break;
      if (t.stack || !t.accepts(s)) continue;
      const n = Math.min(count, t.cap(s));
      t.stack = { ...s, count: n };
      count -= n;
      this.changed(t);
    }
    return count;
  }

  // Dragging the cursor stack across slots spreads it evenly (left button) or drops one in each
  // (right button). Can this slot join the drag?
  canDrag(slot, list, button) {
    const c = this.cursor, s = slot.stack;
    if (!c || !slot.accepts(c) || list.includes(slot)) return false;
    if (s && (!sameItem(s, c) || s.count >= slot.cap(s))) return false;
    return button === 1 || c.count > list.length;
  }

  // What each dragged slot would hold afterwards: Map slot -> count, plus what stays on the cursor.
  dragResult(list, button) {
    const c = this.cursor;
    const result = new Map();
    if (!c || !list.length) return { result, left: c?.count ?? 0 };
    const each = button === 2 ? 1 : button === 1 ? maxStack(c.id) : Math.max(1, Math.floor(c.count / list.length));
    let left = c.count;
    for (const t of list) {
      const have = t.stack?.count ?? 0;
      const add = Math.min(each, t.cap(c) - have, button === 1 ? Infinity : left);
      if (add <= 0) continue;
      result.set(t, have + add);
      if (button !== 1) left -= add;
    }
    return { result, left };
  }

  drag(list, button) {
    const c = this.cursor;
    if (!c) return;
    const { result, left } = this.dragResult(list, button);
    for (const [t, n] of result) { t.stack = { ...c, count: n }; this.changed(t); }
    this.cursor = { ...c, count: left };
  }

  // Double-click: gather every matching item onto the cursor (part stacks first).
  collect() {
    const c = this.cursor;
    if (!c) return;
    const max = maxStack(c.id);
    for (const fullStacks of [false, true]) {
      for (const t of this.slots) {
        const s = t.stack;
        if (c.count >= max) return;
        if (!s || t.output === 'craft' || !sameItem(s, c) || (s.count >= maxStack(s.id)) !== fullStacks) continue;
        const n = Math.min(s.count, max - c.count);
        c.count += n;
        t.stack = { ...s, count: s.count - n };
        this.changed(t);
      }
    }
  }

  // Number keys over a slot swap it with that hotbar slot.
  swapWithHotbar(slot, n) {
    const hot = this.inv.slots[n], s = slot.stack;
    if (slot.output === 'craft') {
      if (!hot && s) { this.inv.slots[n] = { ...s }; this.consumeGrid(); this.crafted(s, 1); }
      return;
    }
    if (slot.group === 'hotbar' && slot.i === n) return;
    if (slot.output && hot) return;
    if (hot && (!slot.accepts(hot) || hot.count > slot.cap(hot))) return;
    this.inv.slots[n] = s;
    slot.stack = hot;
    this.changed(slot);
  }

  // Takes a stack out of a slot to throw it away (Q over a slot): one item, or the whole stack.
  takeToDrop(slot, all) {
    const s = slot.stack;
    if (!s) return null;
    if (slot.output === 'craft') {
      if (this.cursor) return null;
      this.consumeGrid();
      this.crafted(s, 1);
      return { ...s };
    }
    const n = all ? s.count : 1;
    slot.stack = { ...s, count: s.count - n };
    this.changed(slot);
    return { ...s, count: n };
  }

  // Everything that stays behind when the screen closes (the crafting grid) goes back to the
  // inventory; returns the stacks that didn't fit.
  close() { return []; }

  takeResult() {}
  craftAll() {}
  consumeGrid() {}
  crafted() {}
}

// ---------------------------------------------------------------- crafting
export class CraftingMenu extends Menu {
  constructor(game, kind, size) {
    super(game, kind);
    this.size = size;
    this.grid = new Array(size * size).fill(null);
    this.result = [null];
    this.gridSlots = this.grid.map((_, i) => this.add(this.grid, i, 'grid'));
    this.resultSlot = this.add(this.result, 0, 'result', { output: 'craft' });
    this.recipe = null;
    this.ghost = null; // a recipe from the book shown faintly in the grid
  }

  changed(slot) {
    if (slot.group !== 'grid') return;
    this.ghost = null;
    this.updateResult();
  }

  updateResult() {
    const r = matchGrid(this.grid, this.size);
    this.recipe = r;
    this.result[0] = r ? { id: r.out, count: r.count, dmg: 0 } : null;
  }

  consumeGrid() {
    for (let i = 0; i < this.grid.length; i++) {
      const s = this.grid[i];
      if (s) this.grid[i] = s.count > 1 ? { ...s, count: s.count - 1 } : null;
    }
    this.updateResult();
  }

  crafted(stack, times) { this.game.menuEvent?.('craft', stack, times); }

  takeResult(slot) {
    const r = slot.stack, c = this.cursor;
    if (!r) return;
    if (c && !(sameItem(c, r) && c.count + r.count <= maxStack(r.id))) return;
    this.cursor = c ? { ...c, count: c.count + r.count } : { ...r };
    this.consumeGrid();
    this.crafted(r, 1);
  }

  // Shift-click on the result: craft as many as fit, straight into the inventory.
  craftAll() {
    const first = this.result[0];
    if (!first) return;
    let n = 0;
    while (n < 64) {
      const r = this.result[0];
      if (!r || !sameItem(r, first) || !this.roomFor(r)) break;
      this.moveInto(r, r.count, this.playerSlots, true);
      this.consumeGrid();
      n++;
    }
    if (n) this.crafted(first, n);
  }

  roomFor(s) {
    let room = 0;
    for (const t of this.playerSlots) {
      const ts = t.stack;
      if (!ts) room += maxStack(s.id);
      else if (sameItem(ts, s)) room += maxStack(s.id) - ts.count;
      if (room >= s.count) return true;
    }
    return false;
  }

  targets(slot, s) {
    if (slot.group === 'grid') return [[this.playerSlots, false]];
    return super.targets(slot, s);
  }

  // Puts the grid's contents back into the inventory. Returns false if some didn't fit.
  clearGrid() {
    for (let i = 0; i < this.grid.length; i++) {
      const s = this.grid[i];
      if (!s) continue;
      const left = this.inv.add(s.id, s.count, s.dmg ?? 0, extras(s));
      this.grid[i] = left ? { ...s, count: left } : null;
    }
    this.updateResult();
    return this.grid.every((s) => !s);
  }

  close() {
    const spill = [];
    this.clearGrid();
    for (let i = 0; i < this.grid.length; i++) if (this.grid[i]) { spill.push(this.grid[i]); this.grid[i] = null; }
    this.updateResult();
    return spill;
  }

  // Recipe book: lay the recipe out in the grid from the inventory (all = as many sets as
  // possible). A recipe you can't make is shown as a ghost in the grid instead.
  placeRecipe(r, all) {
    if (!recipeFits(r, this.size)) return false;
    if (!all && this.recipe === r) {
      // Clicking the recipe that's already in the grid adds one more of everything.
      const need = new Map();
      for (const s of this.grid) if (s) need.set(s.id, (need.get(s.id) ?? 0) + 1);
      const ok = [...need].every(([id, n]) => this.inv.count(id) >= n) && this.grid.every((s) => !s || s.count < maxStack(s.id));
      if (ok) {
        this.grid.forEach((s, i) => { if (s) { this.inv.take(s.id, 1); this.grid[i] = { ...s, count: s.count + 1 }; } });
        this.updateResult();
      }
      return ok;
    }
    const plan = planRecipe(r, countItems(this.inv.slots, this.grid), this.size, all ? 64 : 1);
    if (!this.clearGrid()) return false;
    if (!plan) {
      this.ghost = r;
      return false;
    }
    for (const { cell, id } of plan.cells) {
      const got = this.inv.take(id, plan.sets);
      this.grid[cell] = got ? { id, count: got, dmg: 0 } : null;
    }
    this.ghost = null;
    this.updateResult();
    return true;
  }
}

// The survival inventory: 2x2 crafting, armor and the player's own slots.
export class InventoryMenu extends CraftingMenu {
  constructor(game) {
    super(game, 'inventory', 2);
    this.armorSlots = [0, 1, 2, 3].map((i) => this.add(this.inv.armor, i, 'armor', {
      limit: 1, filter: (s) => itemDef(s.id)?.armor?.slot === i,
    }));
    this.addPlayer();
  }

  changed(slot) {
    super.changed(slot);
    if (slot.group === 'armor' && slot.stack) this.game.menuEvent?.('equip', slot.stack);
  }

  targets(slot, s) {
    if (slot.group === 'storage' || slot.group === 'hotbar') {
      const a = itemDef(s.id)?.armor;
      if (a && !this.inv.armor[a.slot]) return [[[this.armorSlots[a.slot]], false]];
    }
    return super.targets(slot, s);
  }
}

export class CraftingTableMenu extends CraftingMenu {
  constructor(game) {
    super(game, 'crafting', 3);
    this.addPlayer();
  }
}

// ---------------------------------------------------------------- furnace and chest
export class FurnaceMenu extends Menu {
  constructor(game, furnace) {
    super(game, 'furnace');
    this.furnace = furnace;
    this.inputSlot = this.add(furnace.slots, 0, 'input');
    this.fuelSlot = this.add(furnace.slots, 1, 'fuel', { filter: (s) => fuelTime(s.id) > 0 });
    this.outputSlot = this.add(furnace.slots, 2, 'output', { output: 'take' });
    this.addPlayer();
  }

  // Whatever comes out of the output slot, however it's taken, is worth some experience.
  tracked(fn) {
    const before = this.outputSlot.stack, id = before?.id, n0 = before?.count ?? 0;
    const r = fn();
    const after = this.outputSlot.stack, n1 = after && after.id === id ? after.count : 0;
    if (id && n0 > n1) this.game.menuEvent?.('smelted', { id, count: n0 - n1 });
    return r;
  }
  click(slot, button) { return this.tracked(() => super.click(slot, button)); }
  quickMove(slot) { return this.tracked(() => super.quickMove(slot)); }
  swapWithHotbar(slot, n) { return this.tracked(() => super.swapWithHotbar(slot, n)); }
  takeToDrop(slot, all) { return this.tracked(() => super.takeToDrop(slot, all)); }

  targets(slot, s) {
    if (slot.group === 'storage' || slot.group === 'hotbar') {
      if (smeltsIn(s.id, this.furnace.only)) return [[[this.inputSlot], false]];
      if (fuelTime(s.id)) return [[[this.fuelSlot], false]];
      return super.targets(slot, s);
    }
    return [[this.playerSlots, slot.group === 'output']];
  }
}

// A chest, or a double chest: `parts` is one or two 27-slot arrays (the left half first).
export class ChestMenu extends Menu {
  constructor(game, parts, title = null) {
    super(game, parts.length > 1 ? 'large_chest' : 'chest');
    this.parts = parts;
    this.title = title ?? (parts.length > 1 ? 'Large Chest' : 'Chest');
    this.chestSlots = [];
    for (const arr of parts) arr.forEach((_, i) => this.chestSlots.push(this.add(arr, i, 'chest')));
    this.addPlayer();
  }

  targets(slot) {
    return slot.group === 'chest' ? [[this.playerSlots, true]] : [[this.chestSlots, false]];
  }
}

// ---------------------------------------------------------------- enchanting, the anvil, the grindstone
// These keep what's put in them only while they're open (it comes back to you when you close them).
class WorkMenu extends Menu {
  // Their result slot (the anvil's, the grindstone's) is taken whole, however it's taken, and
  // only then are the inputs used up (see take()).
  take() { return null; }
  takeResult() {
    if (this.cursor) return;
    const out = this.take();
    if (out) this.cursor = out;
  }
  craftAll() {
    if (!this.result?.[0] || !this.inv.slots.some((x) => !x)) return;
    const out = this.take();
    if (out) this.moveInto(out, 1, this.playerSlots, true);
  }
  takeToDrop(slot, all) { return slot.output === 'craft' ? (this.cursor ? null : this.take()) : super.takeToDrop(slot, all); }
  swapWithHotbar(slot, n) {
    if (slot.output !== 'craft') { super.swapWithHotbar(slot, n); return; }
    if (this.inv.slots[n]) return;
    const out = this.take();
    if (out) this.inv.slots[n] = out;
  }

  close() {
    const spill = [];
    for (const arr of this.held) for (let i = 0; i < arr.length; i++) {
      const s = arr[i];
      if (!s) continue;
      const left = this.inv.add(s.id, s.count, s.dmg ?? 0, extras(s));
      if (left) spill.push({ ...s, count: left });
      arr[i] = null;
    }
    return spill;
  }
}

// The enchanting table: an item and some lapis, and three enchantments on offer (see
// enchanting.js). `shelves`: how many bookshelves stand around the table.
export class EnchantingMenu extends WorkMenu {
  constructor(game, shelves) {
    super(game, 'enchanting');
    this.shelves = shelves;
    this.items = [null, null];
    this.held = [this.items];
    this.itemSlot = this.add(this.items, 0, 'item', { limit: 1, filter: (s) => enchantable(s) || s.id === I.book });
    this.lapisSlot = this.add(this.items, 1, 'lapis', { filter: (s) => s.id === I.lapis_lazuli });
    this.addPlayer();
    this.offers = [];
  }

  changed(slot) { if (slot === this.itemSlot) this.updateOffers(); }

  updateOffers() {
    const s = this.items[0];
    this.offers = s && (enchantable(s) || s.id === I.book) ? tableOffers(this.game.enchantSeed, s, this.shelves) : [];
  }

  // Can option `i` be taken? ('ok', or why not: 'lapis', 'levels', or null for nothing there.)
  canTake(i) {
    const o = this.offers[i], g = this.game;
    if (!o || !o.cost) return null;
    if (g.creative) return 'ok';
    if ((this.items[1]?.count ?? 0) < i + 1) return 'lapis';
    if (g.xp.level < o.cost) return 'levels';
    return 'ok';
  }

  enchant(i) {
    if (this.canTake(i) !== 'ok') return false;
    const g = this.game, o = this.offers[i], s = this.items[0];
    let ench = { ...o.ench };
    if (s.id === I.book) {
      // A book takes just one of them, at random, when more than one came up.
      const names = Object.keys(ench);
      if (names.length > 1) ench = { [names[Math.floor(Math.random() * names.length)]]: ench[names[0]] };
      this.items[0] = { id: I.enchanted_book, count: 1, dmg: 0, ench };
    } else this.items[0] = { ...s, ench };
    if (!g.creative) {
      g.spendLevels(i + 1);
      const l = this.items[1];
      this.items[1] = l.count > i + 1 ? { ...l, count: l.count - (i + 1) } : null;
    }
    g.newEnchantSeed();
    this.updateOffers();
    g.menuEvent?.('enchant', this.items[0]);
    return true;
  }

  targets(slot, s) {
    if (slot.group === 'storage' || slot.group === 'hotbar') {
      if (s.id === I.lapis_lazuli) return [[[this.lapisSlot], false]];
      if ((enchantable(s) || s.id === I.book) && !this.items[0]) return [[[this.itemSlot], false]];
      return super.targets(slot, s);
    }
    return [[this.playerSlots, false]];
  }
}

// The anvil: mend with material or a second of the same, put an enchanted book's enchantments
// on, and name things; each job costs levels.
export class AnvilMenu extends WorkMenu {
  constructor(game) {
    super(game, 'anvil');
    this.items = [null, null];
    this.result = [null];
    this.held = [this.items];
    this.leftSlot = this.add(this.items, 0, 'left');
    this.rightSlot = this.add(this.items, 1, 'right');
    this.resultSlot = this.add(this.result, 0, 'result', { output: 'craft' });
    this.addPlayer();
    this.name = undefined;
    this.job = null;
  }

  changed(slot) {
    if (slot === this.leftSlot && this.items[0]?.name !== this.nameFor) { this.name = undefined; this.nameFor = this.items[0]?.name; }
    this.update();
  }

  // The name typed into the box (undefined: leave it as it is).
  rename(text) { this.name = text; this.update(); }

  update() {
    const a = this.items[0], b = this.items[1];
    const isPlanks = (id) => /_planks$/.test(itemDef(id)?.name ?? '');
    this.job = a ? anvil(a, b, this.name, isPlanks) : null;
    this.result[0] = this.job ? this.job.out : null;
  }

  get tooExpensive() { return !!this.job && this.job.cost >= 40 && !this.game.creative; }
  affordable() { const j = this.job; return !!j && !this.tooExpensive && (this.game.creative || this.game.xp.level >= j.cost); }

  take() {
    const j = this.job;
    if (!this.affordable()) return null;
    this.game.spendLevels(j.cost);
    this.items[0] = null;
    const b = this.items[1];
    if (b) this.items[1] = b.count > j.used ? { ...b, count: b.count - j.used } : null;
    this.name = undefined;
    this.update();
    this.game.menuEvent?.('anvil', j.out);
    return { ...j.out };
  }

  targets(slot, s) {
    if (slot.group === 'storage' || slot.group === 'hotbar') {
      if (!this.items[0]) return [[[this.leftSlot], false]];
      return [[[this.rightSlot], false]];
    }
    return [[this.playerSlots, false]];
  }
}

// The grindstone: takes enchantments off (giving back some of the experience) and mends two of
// the same thing into one.
export class GrindstoneMenu extends WorkMenu {
  constructor(game, at) {
    super(game, 'grindstone');
    this.at = at;
    this.items = [null, null];
    this.result = [null];
    this.held = [this.items];
    const ok = (s) => !!itemDef(s.id)?.durability || s.id === I.enchanted_book;
    this.topSlot = this.add(this.items, 0, 'top', { limit: 1, filter: ok });
    this.bottomSlot = this.add(this.items, 1, 'bottom', { limit: 1, filter: ok });
    this.resultSlot = this.add(this.result, 0, 'result', { output: 'craft' });
    this.addPlayer();
    this.job = null;
  }

  changed() {
    this.job = grind(this.items[0], this.items[1]);
    this.result[0] = this.job ? this.job.out : null;
  }

  take() {
    const j = this.job;
    if (!j) return null;
    this.items[0] = this.items[1] = null;
    this.changed();
    if (j.xp) this.game.dropXp(this.at.x, this.at.y + 0.6, this.at.z, j.xp);
    this.game.menuEvent?.('grind', j.out);
    return { ...j.out };
  }

  targets(slot) {
    if (slot.group === 'storage' || slot.group === 'hotbar') return [[[this.topSlot, this.bottomSlot], false]];
    return [[this.playerSlots, false]];
  }
}

// Creative mode: a palette of every item above the hotbar (the palette isn't made of slots).
export class CreativeMenu extends Menu {
  constructor(game) {
    super(game, 'creative');
    for (let i = 0; i < 9; i++) this.hotbar.push(this.add(this.inv.slots, i, 'hotbar'));
  }

  // Shift-clicking a hotbar slot clears it.
  quickMove(slot) { slot.stack = null; }

  // Clicking an item in the palette: a full stack (right click: just one) on the cursor, or
  // straight into the hotbar with shift. Clicking with something else held puts it away.
  paletteClick(id, button, shift) {
    const max = maxStack(id);
    if (shift) {
      const empty = this.hotbar.find((s) => !s.stack) ?? this.hotbar[this.inv.selected];
      empty.stack = { id, count: max, dmg: 0 };
      return;
    }
    const c = this.cursor;
    if (c && c.id !== id) { this.cursor = null; return; }
    if (c) this.cursor = { ...c, count: button === 2 ? Math.min(max, c.count + 1) : max };
    else this.cursor = { id, count: button === 2 ? 1 : max, dmg: 0 };
  }
}
