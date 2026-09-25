// What the release's new items do when used on a block: hoes till soil, shovels flatten paths,
// seeds and root crops are planted, bone meal makes things grow, buckets scoop up and pour out
// water and lava, and workstations do their jobs. Each returns true when it handled the click
// (see Game.useItem).
import { B, CROP, SAPLING, FACE_DIRS, WATERLIKE, REPLACEABLE, waterLevel, lavaLevel, DOUBLE, COMPOSTER, POTTED, POT_FOR,
  WOOD_NAMES, liquidHeight, SOLID, CAVE_VINES, caveVineId, WET, CORALS } from './blocks.js';
import { BIOME } from './biomes.js';
import { I, itemDef } from './items.js';
import { TEX } from './textures.js';
import { growCrop, growSapling } from './growth.js';
import { HEIGHT } from './config.js';

const TILLABLE = new Set([B.grass_block, B.dirt, B.dirt_path, B.coarse_dirt, B.snowy_grass]);
const SEA_BED = new Set([B.sand, B.red_sand, B.gravel, B.dirt, B.clay]);
const FLOWERS = ['dandelion', 'poppy', 'cornflower', 'oxeye_daisy', 'azure_bluet'];

export function useItemOnBlock(game, held, def, t) {
  const w = game.world, above = w.getBlock(t.x, t.y + 1, t.z);
  const at = { x: t.x + 0.5, y: t.y + 1, z: t.z + 0.5 };
  // Hoes turn grass and dirt into farmland (coarse dirt into dirt).
  if (def.tool?.type === 'hoe' && TILLABLE.has(t.id) && t.face !== 3 && (above === 0 || REPLACEABLE[above] && !WATERLIKE[above])) {
    if (above) w.setBlock(t.x, t.y + 1, t.z, 0);
    w.setBlock(t.x, t.y, t.z, t.id === B.coarse_dirt ? B.dirt : B.farmland);
    game.audio.place('gravel', at);
    return used(game, 1);
  }
  // Shovels flatten grass into a path.
  if (def.tool?.type === 'shovel' && (t.id === B.grass_block || t.id === B.dirt || t.id === B.coarse_dirt || t.id === B.podzol) &&
      t.face !== 3 && above === 0) {
    w.setBlock(t.x, t.y, t.z, B.dirt_path);
    game.audio.place('grass', at);
    return used(game, 1);
  }
  // Seeds and root crops go into farmland.
  if (def.plant && (t.id === B.farmland || t.id === B.farmland_moist) && t.face === 2 && above === 0) {
    w.setBlock(t.x, t.y + 1, t.z, B[def.plant]);
    game.audio.place('grass', at);
    return consumed(game);
  }
  if (held.id === I.bone_meal) return boneMeal(game, t);
  return false;
}

// Bone meal: crops jump ahead a few stages, saplings may grow at once, and grass sprouts tufts
// and flowers around.
function boneMeal(game, t) {
  const w = game.world;
  const crop = CROP[t.id];
  let did = false;
  if (crop && crop.stage < crop.max) did = growCrop(w, t.x, t.y, t.z, crop, 2 + Math.floor(Math.random() * 3));
  else if (SAPLING[t.id]) { did = true; if (Math.random() < 0.45) growSapling(w, t.x, t.y, t.z, t.id); }
  else if (t.id === B.grass_block && w.getBlock(t.x, t.y + 1, t.z) === 0) {
    did = true;
    for (let k = 0; k < 24; k++) {
      const x = t.x + Math.round((Math.random() - 0.5) * 6), z = t.z + Math.round((Math.random() - 0.5) * 6);
      for (let y = t.y + 2; y >= t.y - 2; y--) {
        if (w.getBlock(x, y, z) !== B.grass_block) continue;
        if (w.getBlock(x, y + 1, z) === 0) {
          const r = Math.random();
          w.setBlock(x, y + 1, z, r < 0.12 ? B[FLOWERS[Math.floor(Math.random() * FLOWERS.length)]] : r < 0.2 ? B.fern : B.tall_grass);
        }
        break;
      }
    }
  }
  // Under water: seagrass grows tall, and the sea floor sprouts seagrass (and in warm seas, coral).
  else if (t.id === B.seagrass && w.getBlock(t.x, t.y + 1, t.z) === B.water) {
    did = true;
    w.setBlock(t.x, t.y + 1, t.z, B.tall_seagrass_top, { updates: false });
    w.setBlock(t.x, t.y, t.z, B.tall_seagrass);
  } else if (SEA_BED.has(t.id) && w.getBlock(t.x, t.y + 1, t.z) === B.water) {
    did = true;
    const warm = w.biomeAt(t.x, t.z) === BIOME.WARM_OCEAN;
    for (let k = 0; k < 16; k++) {
      const x = t.x + Math.round((Math.random() - 0.5) * 6), z = t.z + Math.round((Math.random() - 0.5) * 6);
      for (let y = t.y + 2; y >= t.y - 2; y--) {
        if (!SEA_BED.has(w.getBlock(x, y, z))) continue;
        if (w.getBlock(x, y + 1, z) === B.water) {
          const r = Math.random(), kind = CORALS[Math.floor(Math.random() * CORALS.length)];
          w.setBlock(x, y + 1, z, warm && r < 0.2 ? B[`${kind}_coral${r < 0.1 ? '' : '_fan'}`] : B.seagrass);
        }
        break;
      }
    }
  }
  if (!did) return false;
  game.particles.icons(TEX.happy, t.x + 0.5, t.y + 0.4, t.z + 0.5, 10, 0.45);
  return consumed(game);
}

// Glow berries planted under a ceiling (or at the foot of a cave vine) start a new vine.
export function plantGlowBerries(game, t) {
  const w = game.world;
  let y = t.y - 1;
  if (CAVE_VINES[t.id]) while (CAVE_VINES[w.getBlock(t.x, y, t.z)]) y--;
  else if (t.face !== 3 || !SOLID[t.id]) return false;
  if (y < 1 || w.getBlock(t.x, y, t.z) !== 0) return false;
  w.setBlock(t.x, y, t.z, caveVineId(true, false));
  game.audio.place('grass', { x: t.x + 0.5, y: y + 0.5, z: t.z + 0.5 });
  return consumed(game);
}

// Plant matter a composter takes, and the chance each item adds a layer (Minecraft's numbers).
const COMPOST = new Map();
const compost = (names, chance) => { for (const n of names) { const id = I[n] ?? B[n]; if (id !== undefined) COMPOST.set(id, chance); } };
compost(['wheat_seeds', 'beetroot_seeds', 'tall_grass', 'glow_berries', 'hanging_roots', 'moss_carpet', ...WOOD_NAMES.flatMap((w) => [`${w}_leaves`, `${w}_sapling`])], 0.3);
compost(['azalea_leaves', 'big_dripleaf', 'glow_lichen'], 0.5);
compost(['azalea', 'moss_block', 'spore_blossom'], 0.65);
compost(['flowering_azalea', 'flowering_azalea_leaves'], 0.85);
compost(['melon_slice', 'cactus', 'sugar_cane', 'vine', 'tall_grass_double', 'dead_bush'], 0.5);
compost(['apple', 'beetroot', 'carrot', 'potato', 'wheat', 'fern', 'large_fern', 'lily_pad', 'pumpkin', 'melon', 'red_mushroom',
  'brown_mushroom', 'dandelion', 'poppy', 'cornflower', 'allium', 'azure_bluet', 'blue_orchid', 'oxeye_daisy', 'red_tulip', 'orange_tulip',
  'white_tulip', 'pink_tulip', 'lily_of_the_valley', 'sunflower', 'lilac', 'rose_bush', 'peony'], 0.65);
compost(['baked_potato', 'bread', 'cookie', 'hay_block'], 0.85);
compost(['pumpkin_pie'], 1);
export const compostChance = (id) => COMPOST.get(id);

// Cauldrons hold a bucket of water, composters turn plant matter into bone meal, bells ring and
// flower pots take a flower or sapling (and give it back).
export function useWorkstation(game, held, t) {
  const w = game.world, id = t.id, at = { x: t.x + 0.5, y: t.y + 0.5, z: t.z + 0.5 };
  if (id === B.cauldron && held?.id === I.water_bucket) {
    w.setBlock(t.x, t.y, t.z, B.water_cauldron);
    game.audio.bucket('empty', at);
    return swapHeld(game, I.bucket);
  }
  if (id === B.water_cauldron && held?.id === I.bucket) {
    w.setBlock(t.x, t.y, t.z, B.cauldron);
    game.audio.bucket('fill', at);
    return swapHeld(game, I.water_bucket);
  }
  const level = COMPOSTER[id];
  if (level !== undefined) {
    if (level === 8) {
      w.setBlock(t.x, t.y, t.z, B.composter);
      game.entities.spawnItem(t.x + 0.5, t.y + 1.05, t.z + 0.5, I.bone_meal, 1);
      game.audio.place('grass', at);
      game.swingArm();
      return true;
    }
    const chance = held ? COMPOST.get(held.id) : undefined;
    if (level === 7) return chance !== undefined;
    if (chance === undefined) return false;
    if (level === 0 || Math.random() < chance) {
      w.setBlock(t.x, t.y, t.z, id + 1);
      if (level + 1 === 7) w.scheduleTick(t.x, t.y, t.z, 20);
      game.particles.icons(TEX.happy, t.x + 0.5, t.y + 0.3 + level * 0.12, t.z + 0.5, 5, 0.35);
    }
    game.audio.place('grass', at);
    return consumed(game);
  }
  if (id === B.bell || id === B.bell_z) {
    game.audio.bell(at);
    game.swingArm();
    return true;
  }
  if (id === B.flower_pot && held && POT_FOR[held.id] !== undefined) {
    w.setBlock(t.x, t.y, t.z, POT_FOR[held.id]);
    game.audio.place('grass', at);
    return consumed(game);
  }
  // Glow berries are picked off cave vines.
  if (CAVE_VINES[id]?.lit) {
    w.setBlock(t.x, t.y, t.z, caveVineId(CAVE_VINES[id].tip, false));
    game.entities.spawnItem(t.x + 0.5, t.y + 0.3, t.z + 0.5, I.glow_berries, 1);
    game.audio.place('grass', at);
    game.swingArm();
    return true;
  }
  if (POTTED[id] !== undefined && !held) {
    w.setBlock(t.x, t.y, t.z, B.flower_pot);
    if (!game.creative && game.inv.add(POTTED[id], 1)) game.entities.spawnItem(t.x + 0.5, t.y + 0.5, t.z + 0.5, POTTED[id], 1);
    game.audio.place('grass', at);
    game.swingArm();
    game.invChanged();
    return true;
  }
  return false;
}

// Buckets act on the first liquid or block along the line of sight.
export function useBucket(game, held) {
  const w = game.world, p = game.player, d = p.lookDir();
  const hit = w.raycast(p.x, p.eyeY, p.z, d[0], d[1], d[2], 5, true);
  if (!hit) return false;
  if (held.id === I.bucket) {
    // (A sea plant's water can't be scooped up.)
    const water = waterLevel(hit.id) === 0 && !WET[hit.id], lava = lavaLevel(hit.id) === 0;
    if (!water && !lava) return false;
    w.setBlock(hit.x, hit.y, hit.z, 0);
    game.audio.bucket(lava ? 'fill_lava' : 'fill', { x: hit.x + 0.5, y: hit.y + 0.5, z: hit.z + 0.5 });
    return swapHeld(game, lava ? I.lava_bucket : I.water_bucket);
  }
  const liquid = held.id === I.water_bucket ? B.water : B.lava;
  // Pour into the liquid's own cell, a replaceable block, or the cell in front of what was hit.
  let { x, y, z } = hit;
  if (!WATERLIKE[hit.id] && !REPLACEABLE[hit.id]) { const f = FACE_DIRS[hit.face]; x += f[0]; y += f[1]; z += f[2]; }
  if (y < 0 || y >= HEIGHT) return false;
  const cur = w.getBlock(x, y, z);
  if (cur && !REPLACEABLE[cur] && !WATERLIKE[cur]) return false;
  if (DOUBLE[cur]) return false;
  w.setBlock(x, y, z, liquid);
  game.audio.bucket(liquid === B.lava ? 'empty_lava' : 'empty', { x: x + 0.5, y: y + 0.5, z: z + 0.5 });
  if (!game.creative) swapHeld(game, I.bucket);
  game.swingArm();
  return true;
}

// Lily pads are set on the surface of still water.
export function placeLilyPad(game) {
  const w = game.world, p = game.player, d = p.lookDir();
  const hit = w.raycast(p.x, p.eyeY, p.z, d[0], d[1], d[2], 5, true);
  if (!hit || hit.id !== B.water || w.getBlock(hit.x, hit.y + 1, hit.z) !== 0) return false;
  w.setBlock(hit.x, hit.y + 1, hit.z, B.lily_pad);
  game.audio.place('grass', { x: hit.x + 0.5, y: hit.y + 1, z: hit.z + 0.5 });
  return consumed(game);
}

// A boat is set down where you point, on the water or on the ground, facing the way you look.
export function placeBoat(game, held) {
  const w = game.world, p = game.player, d = p.lookDir();
  const hit = w.raycast(p.x, p.eyeY, p.z, d[0], d[1], d[2], 5, true);
  if (!hit || game.riding) return false;
  const at = (k) => [p.x, p.eyeY, p.z][k] + d[k] * hit.t;
  const x = Math.min(hit.x + 0.95, Math.max(hit.x + 0.05, at(0))), z = Math.min(hit.z + 0.95, Math.max(hit.z + 0.05, at(2)));
  let y;
  if (WATERLIKE[hit.id] === 1) {
    let top = hit.y;
    while (WATERLIKE[w.getBlock(hit.x, top + 1, hit.z)] === 1 && top < hit.y + 8) top++;
    y = top + liquidHeight(w.getBlock(hit.x, top, hit.z)) - 0.12;
  } else if (FACE_DIRS[hit.face]?.[1] === 1 && !WATERLIKE[hit.id]) y = hit.y + 1;
  else return false;
  // Room for it?
  if (w.collides(x - 0.6, y + 0.05, z - 0.6, x + 0.6, y + 0.55, z + 0.6)) return false;
  game.entities.spawnBoat(x, y, z, itemDef(held.id)?.boat ?? 'oak', p.yaw);
  game.audio.place('wood', { x, y, z });
  return consumed(game);
}

function swapHeld(game, id) {
  const inv = game.inv, held = inv.held;
  if (game.creative) return true;
  if (held.count > 1) {
    held.count--;
    if (inv.add(id, 1)) game.entities.dropItem(game.player, { id, count: 1, dmg: 0 });
  } else inv.slots[inv.selected] = { id, count: 1, dmg: 0 };
  game.swingArm();
  game.invChanged();
  return true;
}
function used(game, wear) {
  game.swingArm();
  if (!game.creative && game.inv.damageHeld(wear)) game.audio.toolBreak();
  game.invChanged();
  return true;
}
function consumed(game) {
  game.swingArm();
  if (!game.creative) { game.inv.consumeHeld(); game.invChanged(); }
  return true;
}
