// A furnace's contents and fire, ticked like the original: fuel burns for its burn time once there
// is something it can smelt, and every 200 ticks of fire turn one input item into its result.
import { smeltResult, smeltsIn, fuelTime, COOK_TIME } from './crafting.js';
import { itemDef, maxStack } from './items.js';
import { FURNACE_KINDS } from './blocks.js';

// Smokers (food) and blast furnaces (ores and metal) work twice as fast, burning fuel twice as
// fast too.
export class Furnace {
  constructor(saved = null, kind = 'furnace') {
    this.kind = FURNACE_KINDS[saved?.kind] ? saved.kind : FURNACE_KINDS[kind] ? kind : 'furnace';
    this.speed = FURNACE_KINDS[this.kind].speed;
    this.only = FURNACE_KINDS[this.kind].only;
    this.slots = [null, null, null]; // input, fuel, output
    this.burn = 0;    // ticks of fire left
    this.burnMax = 0; // burn time of the fuel item that lit it
    this.cook = 0;    // progress on the current item, 0..COOK_TIME
    if (saved) {
      saved.slots?.forEach((s, i) => { if (s && itemDef(s.id) && i < 3) this.slots[i] = { id: s.id, count: s.count, dmg: s.dmg ?? 0 }; });
      this.burn = saved.burn ?? 0;
      this.burnMax = saved.burnMax ?? 0;
      this.cook = saved.cook ?? 0;
    }
  }

  get lit() { return this.burn > 0; }
  get empty() { return !this.slots[0] && !this.slots[1] && !this.slots[2] && !this.lit; }

  // Can the input be smelted, with room for the result?
  canSmelt() {
    const input = this.slots[0];
    const out = input && smeltsIn(input.id, this.only) && smeltResult(input.id);
    if (!out) return false;
    const o = this.slots[2];
    return !o || (o.id === out && o.count < maxStack(out));
  }

  // One game tick. Returns true when the contents of the slots changed.
  tick() {
    let changed = false;
    if (this.burn > 0) this.burn = Math.max(0, this.burn - this.speed);
    const fuel = this.slots[1];
    if (this.burn > 0 || (fuel && this.slots[0])) {
      const can = this.canSmelt();
      if (this.burn <= 0 && can) {
        this.burn = this.burnMax = fuelTime(fuel.id);
        if (this.burn > 0) {
          fuel.count--;
          if (!fuel.count) this.slots[1] = null;
          changed = true;
        }
      }
      if (this.burn > 0 && can) {
        if ((this.cook += this.speed) >= COOK_TIME) {
          this.cook = 0;
          this.smelt();
          changed = true;
        }
      } else this.cook = 0;
    } else if (this.cook > 0) {
      // Without fire the progress on an item slowly goes back.
      this.cook = Math.max(0, this.cook - 2);
    }
    return changed;
  }

  smelt() {
    const input = this.slots[0], out = smeltResult(input.id);
    if (this.slots[2]) this.slots[2].count++;
    else this.slots[2] = { id: out, count: 1, dmg: 0 };
    input.count--;
    if (!input.count) this.slots[0] = null;
  }

  serialize() {
    return { kind: this.kind, slots: this.slots.map((s) => (s ? { ...s } : null)), burn: this.burn, burnMax: this.burnMax, cook: this.cook };
  }
}
