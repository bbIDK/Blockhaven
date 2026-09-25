// Experience and enchantments, following the original's rules.
//
// Experience comes in points; so many points make a level (more for each level up), and levels
// pay for enchanting and for work at the anvil. Enchantments live on a stack as `ench`, a map of
// name -> level ({ sharpness: 3 }); the rest of the game asks `enchLevel(stack, name)`.
//
// An enchanting table offers three enchantments for an item, costing 1, 2 and 3 lapis and levels
// but needing more levels to be on offer (which bookshelves around the table raise, up to 30). The
// offers come from a seed each player keeps, so they don't change until something is enchanted.
import { itemDef, I } from './items.js';
import { mulberry32 } from './math.js';

// ---------------------------------------------------------------- experience
// Points from one level to the next.
export const xpToNext = (level) => (level < 16 ? 2 * level + 7 : level < 31 ? 5 * level - 38 : 9 * level - 158);

// Adds (or with a negative amount, takes) points: { level, points } where points is the progress
// into the current level. Returns how many levels were gained.
export function addXp(xp, amount) {
  const before = xp.level;
  xp.points += amount;
  while (xp.points >= xpToNext(xp.level)) { xp.points -= xpToNext(xp.level); xp.level++; }
  while (xp.points < 0 && xp.level > 0) { xp.level--; xp.points += xpToNext(xp.level); }
  xp.points = Math.max(0, xp.points);
  return xp.level - before;
}

// Orb sizes, like the original: a drop of `n` points breaks into orbs of these values.
const ORB_SIZES = [2477, 1237, 617, 307, 149, 73, 37, 17, 7, 3, 1];
export function splitXp(n) {
  const out = [];
  while (n > 0) { const v = ORB_SIZES.find((s) => s <= n) ?? 1; out.push(v); n -= v; }
  return out;
}
// Which of the orb pictures (0 small .. 10 huge) an orb of this value uses.
export const orbSize = (v) => Math.max(0, 10 - ORB_SIZES.findIndex((s) => s <= v));

// What mining an ore is worth (when it drops its mineral rather than itself).
export const ORE_XP = {
  coal_ore: [0, 2], deepslate_coal_ore: [0, 2], diamond_ore: [3, 7], deepslate_diamond_ore: [3, 7], emerald_ore: [3, 7],
  deepslate_emerald_ore: [3, 7], lapis_ore: [2, 5], deepslate_lapis_ore: [2, 5], redstone_ore: [1, 5], deepslate_redstone_ore: [1, 5],
};
// What smelting one of each item is worth (fractions add up across a batch).
export const SMELT_XP = {
  iron_ingot: 0.7, gold_ingot: 1, copper_ingot: 0.7, diamond: 1, emerald: 1, lapis_lazuli: 0.2, redstone: 0.3, coal: 0.1, glass: 0.1, stone: 0.1,
  smooth_stone: 0.1, brick: 0.3, terracotta: 0.35, charcoal: 0.15, cooked_porkchop: 0.35, cooked_beef: 0.35, cooked_chicken: 0.35,
  cooked_mutton: 0.35, cooked_rabbit: 0.35, cooked_cod: 0.35, cooked_salmon: 0.35, cooked_shark: 0.35, cooked_venison: 0.35, cooked_bear: 0.35, dried_kelp: 0.1, baked_potato: 0.35, deepslate: 0.1,
};

// ---------------------------------------------------------------- the enchantments
// For each: the most levels it goes to, how often it's picked, what it goes on, the range of
// "power" (see `choose`) each level wants, and which others it can't be combined with.
const range = (base, step, span) => (l) => [base + (l - 1) * step, base + (l - 1) * step + span];
export const ENCHANTS = {
  protection: { label: 'Protection', max: 4, weight: 10, on: 'armor', power: range(1, 11, 11), group: 'protect' },
  fire_protection: { label: 'Fire Protection', max: 4, weight: 5, on: 'armor', power: range(10, 8, 8), group: 'protect' },
  blast_protection: { label: 'Blast Protection', max: 4, weight: 2, on: 'armor', power: range(5, 8, 8), group: 'protect' },
  projectile_protection: { label: 'Projectile Protection', max: 4, weight: 5, on: 'armor', power: range(3, 6, 6), group: 'protect' },
  feather_falling: { label: 'Feather Falling', max: 4, weight: 5, on: 'boots', power: range(5, 6, 6) },
  respiration: { label: 'Respiration', max: 3, weight: 2, on: 'helmet', power: (l) => [10 * l, 10 * l + 30] },
  aqua_affinity: { label: 'Aqua Affinity', max: 1, weight: 2, on: 'helmet', power: () => [1, 41] },
  depth_strider: { label: 'Depth Strider', max: 3, weight: 2, on: 'boots', power: (l) => [10 * l, 10 * l + 15] },
  sharpness: { label: 'Sharpness', max: 5, weight: 10, on: 'weapon', power: range(1, 11, 20), group: 'damage' },
  smite: { label: 'Smite', max: 5, weight: 5, on: 'weapon', power: range(5, 8, 20), group: 'damage' },
  bane_of_arthropods: { label: 'Bane of Arthropods', max: 5, weight: 5, on: 'weapon', power: range(5, 8, 20), group: 'damage' },
  knockback: { label: 'Knockback', max: 2, weight: 5, on: 'sword', power: range(5, 20, 50) },
  fire_aspect: { label: 'Fire Aspect', max: 2, weight: 2, on: 'sword', power: range(10, 20, 50) },
  looting: { label: 'Looting', max: 3, weight: 2, on: 'sword', power: range(15, 9, 50) },
  efficiency: { label: 'Efficiency', max: 5, weight: 10, on: 'tool', power: range(1, 10, 50) },
  silk_touch: { label: 'Silk Touch', max: 1, weight: 1, on: 'tool', power: () => [15, 65], group: 'drops' },
  fortune: { label: 'Fortune', max: 3, weight: 2, on: 'tool', power: range(15, 9, 50), group: 'drops' },
  unbreaking: { label: 'Unbreaking', max: 3, weight: 5, on: 'durable', power: range(5, 8, 50) },
  power: { label: 'Power', max: 5, weight: 10, on: 'bow', power: range(1, 10, 15) },
  punch: { label: 'Punch', max: 2, weight: 2, on: 'bow', power: range(12, 20, 25) },
  flame: { label: 'Flame', max: 1, weight: 2, on: 'bow', power: () => [20, 50] },
  infinity: { label: 'Infinity', max: 1, weight: 1, on: 'bow', power: () => [20, 50], group: 'arrows' },
  luck_of_the_sea: { label: 'Luck of the Sea', max: 3, weight: 2, on: 'rod', power: range(15, 9, 50) },
  lure: { label: 'Lure', max: 3, weight: 2, on: 'rod', power: range(15, 9, 50) },
  // Only from books (fishing, trading): experience you pick up mends your gear instead.
  mending: { label: 'Mending', max: 1, weight: 2, on: 'durable', power: () => [25, 75], treasure: true, group: 'arrows' },
};
export const ENCHANT_NAMES = Object.keys(ENCHANTS);

const ROMAN = ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'];
export const enchantLabel = (name, level) => `${ENCHANTS[name]?.label ?? name}${ENCHANTS[name]?.max === 1 ? '' : ` ${ROMAN[level] ?? level}`}`;

export const enchLevel = (stack, name) => stack?.ench?.[name] ?? 0;
export const isEnchanted = (stack) => !!stack?.ench && Object.keys(stack.ench).length > 0;
// Does it shimmer? (Anything enchanted, and enchanted books.)
export const shiny = (stack) => !!stack && (isEnchanted(stack) || stack.id === I.enchanted_book);

// A stack's enchantments, cleaned up (from a save or another player): known names, sensible levels.
export function cleanEnch(e) {
  if (!e || typeof e !== 'object') return null;
  const out = {};
  for (const [k, v] of Object.entries(e)) if (ENCHANTS[k] && Number.isInteger(v) && v >= 1 && v <= 10) out[k] = v;
  return Object.keys(out).length ? out : null;
}

// Does enchantment `name` suit item `def`?
function suits(name, def) {
  if (def.name === 'book' || def.name === 'enchanted_book') return true;
  const on = ENCHANTS[name].on, a = def.armor;
  switch (on) {
    case 'armor': return !!a;
    case 'boots': return a?.slot === 3;
    case 'helmet': return a?.slot === 0;
    case 'weapon': return !!def.weapon || def.tool?.type === 'axe';
    case 'sword': return !!def.weapon;
    case 'tool': return !!def.tool;
    case 'durable': return !!def.durability;
    case 'bow': return def.name === 'bow';
    case 'rod': return def.name === 'fishing_rod';
    default: return false;
  }
}
const compatible = (a, b) => a !== b && (!ENCHANTS[a].group || ENCHANTS[a].group !== ENCHANTS[b].group);
export const canCombine = (a, b) => a === b || compatible(a, b);

// How well an item takes enchanting (by material, as in the original).
export function enchantability(def) {
  if (!def) return 0;
  if (def.name === 'book') return 1;
  const m = def.armor?.material ?? def.name.split('_')[0];
  if (def.armor) return { leather: 15, chainmail: 12, iron: 9, golden: 25, diamond: 10 }[m] ?? 0;
  if (def.tool || def.weapon) return { wooden: 15, stone: 5, iron: 14, golden: 22, diamond: 10 }[m] ?? 0;
  if (def.name === 'bow' || def.name === 'fishing_rod') return 1;
  return 0;
}
export const enchantable = (stack) => !!stack && !isEnchanted(stack) && stack.count === 1 && enchantability(itemDef(stack.id)) > 0;

// The enchantments for an item at a cost of `level`, from random numbers `rnd`: the first is
// always there, then each extra one is less and less likely.
export function choose(def, level, rnd, treasure = false) {
  const e = enchantability(def);
  if (!e) return {};
  const ri = (n) => Math.floor(rnd() * n);
  let power = level + 1 + ri(Math.floor(e / 4) + 1) + ri(Math.floor(e / 4) + 1);
  power = Math.max(1, Math.round(power + power * (rnd() + rnd() - 1) * 0.15));
  let list = [];
  for (const name of ENCHANT_NAMES) {
    const d = ENCHANTS[name];
    if ((d.treasure && !treasure) || !suits(name, def)) continue;
    for (let l = d.max; l >= 1; l--) {
      const [lo, hi] = d.power(l);
      if (power >= lo && power <= hi) { list.push([name, l]); break; }
    }
  }
  const out = {};
  const pick = () => {
    let r = rnd() * list.reduce((a, [n]) => a + ENCHANTS[n].weight, 0);
    for (const x of list) if ((r -= ENCHANTS[x[0]].weight) <= 0) return x;
    return list[list.length - 1];
  };
  if (!list.length) return out;
  let [name, l] = pick();
  out[name] = l;
  while (ri(50) <= power) {
    list = list.filter(([n]) => compatible(n, name));
    if (!list.length) break;
    [name, l] = pick();
    out[name] = l;
    power = Math.floor(power / 2);
  }
  return out;
}

// The table's three offers for an item: [{ cost, ench }] (cost 0: nothing on offer there).
export function tableOffers(seed, stack, shelves) {
  const def = itemDef(stack.id), n = Math.min(15, shelves);
  const rnd = mulberry32(seed >>> 0);
  const base = 1 + Math.floor(rnd() * 8) + (n >> 1) + Math.floor(rnd() * (n + 1));
  const costs = [Math.max(Math.floor(base / 3), 1), Math.floor((base * 2) / 3) + 1, Math.max(base, n * 2)];
  return costs.map((cost, i) => {
    if (cost < i + 1) return { cost: 0, ench: {} };
    const ench = choose(def, cost, mulberry32((seed + i * 7919) >>> 0));
    return { cost: Object.keys(ench).length ? cost : 0, ench };
  });
}

// A book with one enchantment on it, of any level (treasure ones too, when `treasure`): what
// fishing and librarians turn up.
export function randomBook(treasure = false, rnd = Math.random) {
  const names = ENCHANT_NAMES.filter((n) => treasure || !ENCHANTS[n].treasure);
  const n = names[Math.floor(rnd() * names.length)];
  return { [n]: 1 + Math.floor(rnd() * ENCHANTS[n].max) };
}

// ---------------------------------------------------------------- the anvil
// Repairs and combines: `a` in the first slot, `b` in the second. Returns { out, cost, used } (how
// many of `b` it takes) or null when they don't go together.
const REPAIR = { wooden: '#planks', shield: '#planks', stone: 'cobblestone', iron: 'iron_ingot', golden: 'gold_ingot', diamond: 'diamond', leather: 'leather', chainmail: 'iron_ingot' };
export function repairMaterial(def) {
  if (!def?.durability) return null;
  const m = def.armor?.material ?? def.name.split('_')[0];
  return REPAIR[m] ?? null;
}
export function anvil(a, b, name, isPlanks) {
  if (!a) return null;
  const da = itemDef(a.id);
  let out = { ...a, ench: a.ench ? { ...a.ench } : undefined }, cost = 0, used = 0;
  if (b) {
    const db = itemDef(b.id), mat = repairMaterial(da);
    if (mat && (mat === '#planks' ? isPlanks(b.id) : I[mat] === b.id) && a.dmg) {
      // Each unit of material mends a quarter of the item.
      let dmg = a.dmg;
      while (dmg > 0 && used < b.count) { dmg = Math.max(0, dmg - Math.ceil(da.durability / 4)); used++; cost++; }
      out.dmg = dmg;
    } else if (b.id === a.id || db.name === 'enchanted_book') {
      if (b.id === a.id && da.durability) {
        // Two of the same: their durability adds up (plus a little), their enchantments merge.
        const left = (da.durability - (a.dmg ?? 0)) + (da.durability - (b.dmg ?? 0)) + Math.floor(da.durability * 0.12);
        out.dmg = Math.max(0, da.durability - left);
        if (out.dmg < (a.dmg ?? 0)) cost += 2;
      }
      const merged = { ...(out.ench ?? {}) };
      let any = false;
      for (const [n, lv] of Object.entries(b.ench ?? {})) {
        if (da.name !== 'enchanted_book' && !suits(n, da)) continue;
        if (Object.keys(merged).some((m) => !canCombine(m, n))) { cost += 1; continue; }
        const cur = merged[n] ?? 0, next = cur === lv ? Math.min(ENCHANTS[n].max, lv + 1) : Math.max(cur, lv);
        if (next !== cur) { merged[n] = next; any = true; }
        cost += next * (db.name === 'enchanted_book' ? 1 : 2) * (ENCHANTS[n].weight >= 10 ? 1 : ENCHANTS[n].weight >= 5 ? 2 : 4);
      }
      if (!any && out.dmg === (a.dmg ?? 0)) return null;
      out.ench = merged;
      used = 1;
    } else return null;
  }
  // Every job at the anvil makes the next dearer (the original's "prior work penalty").
  const penalty = (x) => 2 ** (x?.work ?? 0) - 1;
  if (name !== undefined && name !== (a.name ?? '')) { out.name = name || undefined; cost += 1; }
  if (!cost) return null;
  cost += penalty(a) + (b ? penalty(b) : 0);
  out.work = Math.max(a.work ?? 0, b?.work ?? 0) + 1;
  if (!out.ench || !Object.keys(out.ench).length) delete out.ench;
  if (!out.name) delete out.name;
  return { out, cost, used };
}

// The grindstone: strips enchantments (giving back some experience) and mends two of a kind.
export function grind(a, b) {
  const x = a ?? b;
  if (!x || (a && b && a.id !== b.id)) return null;
  const def = itemDef(x.id);
  if (!def?.durability && def?.name !== 'enchanted_book') return null;
  let xp = 0;
  for (const s of [a, b]) for (const [n, lv] of Object.entries(s?.ench ?? {})) xp += ENCHANTS[n].power(lv)[0];
  let dmg = x.dmg ?? 0;
  if (a && b && def.durability) {
    const left = (def.durability - (a.dmg ?? 0)) + (def.durability - (b.dmg ?? 0)) + Math.floor(def.durability * 0.05);
    dmg = Math.max(0, def.durability - left);
  }
  if (!xp && !(a && b)) return null;
  const out = def.name === 'enchanted_book' ? { id: I.book, count: 1, dmg: 0 } : { id: x.id, count: 1, dmg };
  return { out, xp: Math.ceil(xp / 2) + Math.floor(Math.random() * Math.ceil(xp / 2 + 1)) };
}
