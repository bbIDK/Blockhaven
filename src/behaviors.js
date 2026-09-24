// What the release's new items do when used on a block: hoes till soil, shovels flatten paths,
// seeds and root crops are planted, bone meal makes things grow, and buckets scoop up and pour
// out water and lava. Each returns true when it handled the click (see Game.useItem).
import { B, CROP, SAPLING, FACE_DIRS, WATERLIKE, REPLACEABLE, waterLevel, lavaLevel, DOUBLE } from './blocks.js';
import { I } from './items.js';
import { TEX } from './textures.js';
import { growCrop, growSapling } from './growth.js';
import { HEIGHT } from './config.js';

const TILLABLE = new Set([B.grass_block, B.dirt, B.dirt_path, B.coarse_dirt, B.snowy_grass]);
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
  if (!did) return false;
  game.particles.bits(t.x + 0.5, t.y + 0.6, t.z + 0.5, TEX.happy, 12, 1.2, 0.6);
  return consumed(game);
}

// Buckets act on the first liquid or block along the line of sight.
export function useBucket(game, held) {
  const w = game.world, p = game.player, d = p.lookDir();
  const hit = w.raycast(p.x, p.eyeY, p.z, d[0], d[1], d[2], 5, true);
  if (!hit) return false;
  if (held.id === I.bucket) {
    const water = waterLevel(hit.id) === 0, lava = lavaLevel(hit.id) === 0;
    if (!water && !lava) return false;
    w.setBlock(hit.x, hit.y, hit.z, 0);
    game.audio.bucket?.(lava ? 'fill_lava' : 'fill', { x: hit.x + 0.5, y: hit.y + 0.5, z: hit.z + 0.5 });
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
  game.audio.bucket?.(liquid === B.lava ? 'empty_lava' : 'empty', { x: x + 0.5, y: y + 0.5, z: z + 0.5 });
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
