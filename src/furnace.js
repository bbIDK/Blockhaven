// A furnace's contents and fire, ticked like the original: fuel burns for its burn time once there
// is something it can smelt, and every 200 ticks of fire turn one input item into its result.
import { smeltResult, fuelTime, COOK_TIME } from './crafting.js';
import { itemDef, maxStack } from './items.js';

export class Furnace {
  constructor(saved = null) {
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
    const out = input && smeltResult(input.id);
    if (!out) return false;
    const o = this.slots[2];
    return !o || (o.id === out && o.count < maxStack(out));
  }

  // One game tick. Returns true when the contents of the slots changed.
  tick() {
    let changed = false;
    if (this.burn > 0) this.burn--;
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
        if (++this.cook >= COOK_TIME) {
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
    return { slots: this.slots.map((s) => (s ? { ...s } : null)), burn: this.burn, burnMax: this.burnMax, cook: this.cook };
  }
}
