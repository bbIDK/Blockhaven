// Devil Fruits (the One Piece mod): each in its own shape and colours from the story, covered in
// the swirls every Devil Fruit has, with its stem and leaf (see fruits.js for the looks).
import { def, shaded, paint, mix, shade } from './core.js';
import { FRUITS } from '../fruits.js';

const SHAPES = {
  // A round melon (Gomu, Hie, Moku): wide and full.
  round: ['', '', '', '....xxxxxxx.....', '...xxxxxxxxx....', '..xxxxxxxxxxx...', '.xxxxxxxxxxxxx..', '.xxxxxxxxxxxxx..', '.xxxxxxxxxxxxx..',
    '.xxxxxxxxxxxxx..', '.xxxxxxxxxxxxx..', '..xxxxxxxxxxx...', '...xxxxxxxxx....', '....xxxxxxx.....'],
  // A pear (Goro, Gura): narrow at the top, heavy below.
  pear: ['', '', '', '......xxx.......', '.....xxxxx......', '.....xxxxx......', '....xxxxxxx.....', '...xxxxxxxxx....', '..xxxxxxxxxxx...',
    '..xxxxxxxxxxx...', '..xxxxxxxxxxx...', '..xxxxxxxxxxx...', '...xxxxxxxxx....', '....xxxxxxx.....'],
  // In lobed pieces like flames or teardrops (Mera, Yami, Magu, Pika).
  lobed: ['', '', '', '...xx...xx......', '..xxxx.xxxx.....', '..xxxxxxxxxx....', '.xxxxxxxxxxxx...', '.xxxxxxxxxxxx...', '.xxxxxxxxxxxx...',
    '..xxxxxxxxxxx...', '..xxxxxxxxxx....', '...xxxxxxxxx....', '....xxxxxxx.....', '......xxx.......'],
  // A heart (Ope).
  heart: ['', '', '', '..xxxx..xxxx....', '.xxxxxxxxxxxx...', '.xxxxxxxxxxxx...', '.xxxxxxxxxxxx...', '.xxxxxxxxxxxx...', '..xxxxxxxxxx....',
    '...xxxxxxxx.....', '....xxxxxx......', '.....xxxx.......', '......xx........', ''],
  // Tall (Phoenix's pineapple, Suna's barrel cactus).
  tall: ['', '', '', '.....xxxxx......', '....xxxxxxx.....', '....xxxxxxx.....', '...xxxxxxxxx....', '...xxxxxxxxx....', '...xxxxxxxxx....',
    '...xxxxxxxxx....', '...xxxxxxxxx....', '...xxxxxxxxx....', '....xxxxxxx.....', '.....xxxxx......'],
};
const SHAPE_OF = { gomu: 'round', hie: 'round', moku: 'round', mera: 'lobed', yami: 'lobed', magu: 'lobed', pika: 'lobed', goro: 'pear', gura: 'pear', ope: 'heart', phoenix: 'tall', suna: 'tall' };
// A swirl: the curl every Devil Fruit's skin is patterned with.
const CURL = ['.ss.', 's..s', 's.s.', '.s..'];
const hex = (s) => parseInt(s.slice(1), 16);

for (const [id, f] of Object.entries(FRUITS)) {
  def(`devil_fruit_${id}`, (t) => {
    const skin = hex(f.look.skin), swirl = hex(f.look.swirl), stem = hex(f.look.stem);
    const rows = SHAPES[SHAPE_OF[id] ?? 'round'];
    shaded(t, rows, [shade(swirl, 0.45), shade(skin, 0.7), skin, mix(skin, 0xffffff, 0.25), mix(skin, 0xffffff, 0.55)], {}, { outline: 'all' });
    // The swirls, across the skin (only on the fruit, not past its edge).
    for (const [ox, oy] of [[2, 6], [7, 5], [10, 8], [4, 10], [8, 11]]) {
      CURL.forEach((row, y) => [...row].forEach((c, x) => {
        const px = ox + x, py = oy + y;
        if (c === 's' && rows[py]?.[px] === 'x' && rows[py]?.[px + 1] === 'x' && rows[py]?.[px - 1] === 'x') t.set(px, py, swirl);
      }));
    }
    // A gleam on the upper left.
    const top = rows.findIndex((r) => r.includes('x'));
    const gx = rows[top + 1].indexOf('x') + 1;
    t.set(gx, top + 2, mix(skin, 0xffffff, 0.8));
    // The stem and its curled leaf (Phoenix: a crown of flame-coloured leaves).
    if (id === 'phoenix') paint(t, ['', '...l.l.l.l......', '....lLlLl.......', '.....lLl........'], { l: stem, L: mix(stem, 0xffe060, 0.5) }, { clear: false });
    else paint(t, ['', '........gG......', '.......gGg......', '.......s........'], { s: stem, g: 0x2e6a1a, G: 0x5aa83a }, { clear: false });
  });
}
