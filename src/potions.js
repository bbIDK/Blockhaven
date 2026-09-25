// Potions and the status effects they give. A potion is drunk from its bottle (which you keep),
// or thrown as a splash potion that breaks over everyone close by: the nearer they are, the
// longer (or harder) it works. Effects tick in Game.effectsTick; see also Entities.shatter.

// What each potion does and its colour (the liquid in the bottle, the splash, the swirls).
export const POTIONS = {
  healing: { label: 'Healing', colour: 0xf82423, effect: 'healing', instant: true },
  regeneration: { label: 'Regeneration', colour: 0xcd5cab, effect: 'regeneration', seconds: 45 },
  swiftness: { label: 'Swiftness', colour: 0x7cafc6, effect: 'speed', seconds: 180 },
  strength: { label: 'Strength', colour: 0x932423, effect: 'strength', seconds: 180 },
  leaping: { label: 'Leaping', colour: 0x22ff4c, effect: 'jump_boost', seconds: 180 },
  fire_resistance: { label: 'Fire Resistance', colour: 0xe49a3a, effect: 'fire_resistance', seconds: 180 },
  water_breathing: { label: 'Water Breathing', colour: 0x2e5299, effect: 'water_breathing', seconds: 180 },
  night_vision: { label: 'Night Vision', colour: 0x1f1fa1, effect: 'night_vision', seconds: 180 },
  invisibility: { label: 'Invisibility', colour: 0x7f8392, effect: 'invisibility', seconds: 180 },
  slowness: { label: 'Slowness', colour: 0x5a6c81, effect: 'slowness', seconds: 90 },
  poison: { label: 'Poison', colour: 0x4e9331, effect: 'poison', seconds: 45 },
  harming: { label: 'Harming', colour: 0x430a09, effect: 'harming', instant: true },
};
export const POTION_NAMES = Object.keys(POTIONS);

// Status effects: their names, colours and whether they're bad for you (shown red, not blue).
export const EFFECTS = {
  speed: { label: 'Speed', colour: 0x7cafc6 },
  slowness: { label: 'Slowness', colour: 0x5a6c81, bad: true },
  strength: { label: 'Strength', colour: 0x932423 },
  jump_boost: { label: 'Jump Boost', colour: 0x22ff4c },
  regeneration: { label: 'Regeneration', colour: 0xcd5cab },
  fire_resistance: { label: 'Fire Resistance', colour: 0xe49a3a },
  water_breathing: { label: 'Water Breathing', colour: 0x2e5299 },
  night_vision: { label: 'Night Vision', colour: 0x1f1fa1 },
  invisibility: { label: 'Invisibility', colour: 0x7f8392 },
  poison: { label: 'Poison', colour: 0x4e9331, bad: true },
  hunger: { label: 'Hunger', colour: 0x587653, bad: true },
  wither: { label: 'Wither', colour: 0x352a27, bad: true },
  healing: { label: 'Instant Health', colour: 0xf82423 },
  harming: { label: 'Instant Damage', colour: 0x430a09, bad: true },
};

export const roman = (n) => ['', '', ' II', ' III', ' IV', ' V'][n] ?? ` ${n}`;
// m:ss, as the original shows effect times.
export function clock(ticks) {
  const s = Math.ceil(ticks / 20);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

// The line a potion's tooltip shows: "Speed (3:00)", "Instant Health".
export function potionLine(name, splash = false) {
  const p = POTIONS[name], e = EFFECTS[p.effect];
  // (Splash potions last three quarters as long.)
  return p.instant ? e.label : `${e.label} (${clock(p.seconds * 20 * (splash ? 0.75 : 1))})`;
}

// The undead are hurt by healing and healed by harming.
export const UNDEAD = new Set(['zombie', 'husk', 'drowned', 'skeleton', 'stray', 'phantom', 'zombified_piglin', 'wither_skeleton']);
