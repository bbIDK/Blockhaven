// Mods: whole new ways to play a world, picked when it's made (Create New World > Mods) and kept
// with it for good. A world's mods are a list of the names here, in its save (meta.mods); a guest
// gets the host's with the world.
export const MODS = {
  onepiece: {
    name: 'One Piece',
    desc: 'A planet of ocean and islands from One Piece: sail all the way round it, find Devil Fruits, '
      + 'swords and treasure, and visit pirate towns and Marine bases instead of villages and kingdoms.',
  },
};

// The mods in a list that this version knows, each once, in a fixed order.
export const knownMods = (list) => Object.keys(MODS).filter((m) => Array.isArray(list) && list.includes(m));

// The world generator a world with these mods uses: One Piece's ocean planet, unless it's flat.
export const generatorType = (type, mods) => (type !== 'flat' && knownMods(mods).includes('onepiece') ? 'onepiece' : type);

// One Piece's planet: this many blocks round, east to west and north to south. Sail on and you come
// back where you started: the land and everything changed on it repeat every PLANET blocks (see
// World.wrap), and whatever's kept by position is kept by the position that repeats (`canon`).
export const PLANET = 16384;
// Where a coordinate falls on the planet, 0 to `size` (with no planet, as it is).
export const canon = (v, size) => (size ? v - Math.floor(v / size) * size : v);
// The copy of coordinate `v` nearest `ref` (with no planet, `v`).
export const nearest = (v, ref, size) => (size ? v + Math.round((ref - v) / size) * size : v);

// The planet the world being played is on (its size round; 0, none), set as the world opens (see
// Game.enterWorld), and the key things that remember blocks (chests, signs, banners...) keep a block
// position by: where it falls on the planet, the same however many times you've been round.
// (`ref`: where the player is, { x, z }, so a position read back from a key is the copy of it nearest
// them: see keyPos.)
export const planet = { size: 0, ref: null };
export const blockKey = (x, y, z) => `${canon(x, planet.size)},${y},${canon(z, planet.size)}`;
// The block position a key stands for: on a planet, the copy of it nearest the player.
export function keyPos(key) {
  const [x, y, z] = key.split(',').map(Number), r = planet.ref;
  if (!planet.size || !r) return [x, y, z];
  return [nearest(x, Math.floor(r.x), planet.size), y, nearest(z, Math.floor(r.z), planet.size)];
}
