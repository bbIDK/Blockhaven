// What's in the chests the world generator leaves about: rolled once, the first time a chest is
// opened (or broken), from its position so every player finds the same.
import { I } from './items.js';
import { hash3, mulberry32 } from './math.js';

// [item, min, max, weight]
const TABLES = {
  dungeon: { rolls: [4, 8], items: [['bone', 1, 6, 10], ['rotten_flesh', 1, 6, 10], ['string', 1, 5, 8], ['gunpowder', 1, 4, 8],
    ['bread', 1, 3, 6], ['wheat', 1, 4, 6], ['iron_ingot', 1, 4, 6], ['gold_ingot', 1, 3, 4], ['gold_coin', 2, 12, 8], ['redstone', 1, 4, 5],
    ['coal', 2, 8, 6], ['saddle', 1, 1, 3], ['golden_apple', 1, 1, 2], ['diamond', 1, 2, 1], ['iron_nugget', 2, 9, 4], ['bucket', 1, 1, 3],
    ['apple', 1, 3, 5], ['beetroot_seeds', 2, 4, 4], ['melon_seeds', 2, 4, 4], ['pumpkin_seeds', 2, 4, 4], ['melon_slice', 1, 4, 3], ['potion_healing', 1, 1, 2], ['potion_night_vision', 1, 1, 1],
    ['splash_potion_harming', 1, 1, 1], ['potion_regeneration', 1, 1, 1], ['glass_bottle', 1, 3, 2], ['name_tag', 1, 1, 4],
    ['music_disc_meadow', 1, 1, 1], ['music_disc_hollow', 1, 1, 1], ['music_disc_ember', 1, 1, 1], ['music_disc_drift', 1, 1, 1]] },
  village: { rolls: [3, 7], items: [['bread', 1, 4, 10], ['apple', 1, 5, 10], ['wheat', 2, 7, 8], ['carrot', 1, 5, 6], ['potato', 1, 5, 6],
    ['wheat_seeds', 2, 8, 6], ['gold_coin', 3, 15, 10], ['emerald', 1, 2, 2], ['feather', 1, 3, 4], ['leather', 1, 3, 4], ['torch', 2, 8, 5],
    ['paper', 1, 5, 3], ['book', 1, 2, 2], ['oak_sapling', 1, 3, 3], ['string', 1, 3, 3], ['cookie', 2, 6, 3], ['saddle', 1, 1, 2],
    ['potion_healing', 1, 1, 1], ['glass_bottle', 1, 2, 2], ['lead', 1, 1, 2], ['name_tag', 1, 1, 1]] },
  house: { rolls: [2, 5], items: [['bread', 1, 3, 10], ['apple', 1, 3, 8], ['gold_coin', 2, 8, 8], ['wheat', 1, 5, 6], ['torch', 1, 4, 5],
    ['potato', 1, 4, 5], ['carrot', 1, 4, 5], ['book', 1, 1, 2], ['white_wool', 1, 3, 3], ['cookie', 1, 4, 3], ['stick', 2, 6, 3]] },
  smith: { rolls: [3, 7], items: [['iron_ingot', 1, 5, 10], ['gold_ingot', 1, 3, 5], ['iron_sword', 1, 1, 3], ['iron_pickaxe', 1, 1, 3],
    ['iron_helmet', 1, 1, 2], ['iron_chestplate', 1, 1, 2], ['iron_leggings', 1, 1, 2], ['iron_boots', 1, 1, 2], ['chainmail_chestplate', 1, 1, 2],
    ['coal', 2, 9, 8], ['bread', 1, 3, 6], ['gold_coin', 4, 18, 8], ['diamond', 1, 3, 2], ['obsidian', 1, 5, 3], ['oak_sapling', 1, 4, 3],
    ['bucket', 1, 1, 3], ['iron_nugget', 2, 9, 4]] },
  mine: { rolls: [3, 7], items: [['coal', 3, 12, 10], ['raw_iron', 1, 5, 8], ['raw_copper', 2, 7, 6], ['raw_gold', 1, 3, 3], ['torch', 4, 16, 8],
    ['iron_pickaxe', 1, 1, 2], ['stone_pickaxe', 1, 1, 4], ['bread', 1, 3, 6], ['redstone', 2, 6, 3], ['lapis_lazuli', 2, 6, 3],
    ['diamond', 1, 1, 1], ['gold_coin', 2, 10, 6], ['iron_ingot', 1, 3, 4], ['ladder', 2, 6, 3]] },
  farm: { rolls: [3, 6], items: [['wheat_seeds', 3, 10, 10], ['beetroot_seeds', 2, 8, 6], ['carrot', 2, 6, 8], ['potato', 2, 6, 8],
    ['melon_seeds', 2, 6, 5], ['pumpkin_seeds', 2, 6, 5],
    ['wheat', 2, 8, 8], ['bone_meal', 2, 8, 6], ['bread', 1, 3, 6], ['wooden_hoe', 1, 1, 3], ['iron_hoe', 1, 1, 1], ['gold_coin', 1, 6, 6],
    ['apple', 1, 4, 5], ['oak_sapling', 1, 3, 3]] },
  desert: { rolls: [2, 6], items: [['bone', 2, 7, 8], ['rotten_flesh', 1, 5, 8], ['gold_coin', 3, 14, 10], ['gold_ingot', 1, 4, 5],
    ['emerald', 1, 3, 4], ['diamond', 1, 2, 2], ['sand', 3, 8, 6], ['gunpowder', 1, 5, 6], ['string', 1, 4, 5], ['saddle', 1, 1, 3],
    ['potion_fire_resistance', 1, 1, 2], ['potion_swiftness', 1, 1, 2], ['music_disc_tide', 1, 1, 1], ['music_disc_lantern', 1, 1, 1]] },
  // Generator 10's structures, much as Minecraft stocks them.
  pyramid: { rolls: [3, 7], items: [['bone', 4, 6, 25], ['rotten_flesh', 3, 7, 16], ['spider_eye', 1, 3, 16], ['gunpowder', 1, 8, 10],
    ['sand', 1, 8, 10], ['string', 1, 8, 10], ['gold_ingot', 2, 7, 15], ['iron_ingot', 1, 5, 15], ['emerald', 1, 3, 15], ['diamond', 1, 3, 5],
    ['gold_coin', 4, 16, 12], ['enchanted_book', 1, 1, 10], ['golden_apple', 1, 1, 10], ['saddle', 1, 1, 10],
    ['music_disc_tide', 1, 1, 2], ['music_disc_lantern', 1, 1, 2]] },
  jungle_temple: { rolls: [2, 6], items: [['bone', 4, 6, 20], ['rotten_flesh', 3, 7, 16], ['bamboo', 1, 3, 15], ['gold_ingot', 2, 7, 15],
    ['iron_ingot', 1, 5, 15], ['emerald', 1, 3, 10], ['diamond', 1, 3, 3], ['gold_coin', 4, 16, 12], ['saddle', 1, 1, 3],
    ['enchanted_book', 1, 1, 1], ['music_disc_ember', 1, 1, 1]] },
  igloo: { rolls: [2, 8], items: [['apple', 1, 3, 15], ['coal', 1, 4, 15], ['gold_nugget', 1, 3, 10], ['stone_axe', 1, 1, 2], ['rotten_flesh', 1, 1, 10],
    ['emerald', 1, 1, 1], ['wheat', 2, 3, 10], ['golden_apple', 1, 1, 3], ['gold_coin', 1, 6, 6]] },
  shipwreck_supply: { rolls: [3, 10], items: [['paper', 1, 12, 8], ['potato', 2, 6, 7], ['poisonous_potato', 2, 6, 7], ['carrot', 4, 8, 7],
    ['wheat', 8, 21, 7], ['coal', 2, 8, 6], ['rotten_flesh', 5, 24, 5], ['pumpkin', 1, 3, 2], ['bamboo', 1, 3, 2], ['gunpowder', 1, 5, 3],
    ['tnt', 1, 2, 1], ['moss_block', 1, 4, 2], ['leather_helmet', 1, 1, 3], ['leather_chestplate', 1, 1, 3], ['leather_boots', 1, 1, 3],
    ['gold_coin', 2, 8, 4]] },
  shipwreck_treasure: { rolls: [3, 6], items: [['iron_ingot', 1, 5, 90], ['gold_ingot', 1, 5, 10], ['emerald', 1, 5, 40], ['diamond', 1, 1, 5],
    ['lapis_lazuli', 1, 10, 20], ['iron_nugget', 1, 10, 50], ['gold_nugget', 1, 10, 10], ['gold_coin', 5, 20, 30], ['trident', 1, 1, 4]] },
  // (The captain's chest: what's left of his charts and logbooks.)
  shipwreck_map: { rolls: [3, 5], items: [['paper', 1, 10, 20], ['feather', 1, 5, 10], ['book', 1, 5, 5], ['compass', 1, 1, 3], ['clock', 1, 1, 1],
    ['gold_coin', 2, 10, 6], ['map', 1, 2, 8], ['ink_sac', 1, 3, 5], ['writable_book', 1, 1, 2]] },
  mineshaft: { rolls: [3, 7], items: [['rail', 4, 8, 20], ['powered_rail', 1, 4, 5], ['detector_rail', 1, 4, 5], ['torch', 1, 16, 15],
    ['bread', 1, 3, 15], ['iron_ingot', 1, 5, 10], ['gold_ingot', 1, 3, 5], ['redstone', 4, 9, 5], ['lapis_lazuli', 4, 9, 5], ['coal', 3, 8, 10],
    ['diamond', 1, 2, 3], ['name_tag', 1, 1, 10], ['golden_apple', 1, 1, 10], ['iron_pickaxe', 1, 1, 1], ['enchanted_book', 1, 1, 10],
    ['beetroot_seeds', 2, 4, 10], ['melon_seeds', 2, 4, 10], ['pumpkin_seeds', 2, 4, 10], ['gold_coin', 2, 10, 8]] },
  stronghold_library: { rolls: [2, 10], items: [['book', 1, 3, 20], ['paper', 2, 7, 20], ['compass', 1, 1, 1], ['enchanted_book', 1, 1, 10]] },
  stronghold: { rolls: [2, 3], items: [['ender_pearl', 1, 1, 10], ['diamond', 1, 3, 3], ['iron_ingot', 1, 5, 10], ['gold_ingot', 1, 3, 5],
    ['redstone', 4, 9, 5], ['bread', 1, 3, 15], ['apple', 1, 3, 15], ['iron_pickaxe', 1, 1, 5], ['iron_sword', 1, 1, 5],
    ['iron_chestplate', 1, 1, 5], ['iron_helmet', 1, 1, 5], ['iron_leggings', 1, 1, 5], ['iron_boots', 1, 1, 5], ['golden_apple', 1, 1, 1],
    ['saddle', 1, 1, 1], ['enchanted_book', 1, 1, 1], ['gold_coin', 3, 12, 8]] },
  // A trap's dispenser: a few arrows.
  dispenser_trap: { rolls: [1, 1], items: [['arrow', 2, 7, 1]] },
};

// `size` slots (27 in a chest, 9 in a dispenser) of loot for a chest at (x, y, z).
export function rollLoot(kind, x, y, z, seed = 0, size = 27) {
  const t = TABLES[kind] ?? TABLES.house;
  const rnd = mulberry32(Math.floor(hash3(x, y, z, seed ^ 0x100f) * 4294967296));
  const slots = new Array(size).fill(null);
  const total = t.items.reduce((a, it) => a + it[3], 0);
  const n = t.rolls[0] + Math.floor(rnd() * (t.rolls[1] - t.rolls[0] + 1));
  for (let k = 0; k < n; k++) {
    let pick = rnd() * total, it = t.items[0];
    for (const e of t.items) { if ((pick -= e[3]) <= 0) { it = e; break; } }
    const id = I[it[0]];
    if (id === undefined) continue;
    const count = it[1] + Math.floor(rnd() * (it[2] - it[1] + 1));
    // Scatter through the chest like the original does.
    for (let tries = 0; tries < 30; tries++) {
      const s = Math.floor(rnd() * size);
      if (!slots[s]) { slots[s] = { id, count, dmg: 0 }; break; }
    }
  }
  return slots;
}
