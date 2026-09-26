// Signs: what's written on them (four lines each), drawn on the board in a tiny pixel font, and the
// window for writing it. The text of each sign in sight is lettered into one of a few spare layers
// of the creature-skin texture (see Renderer.signLayer) and shown on a quad over the board.
import { SIGN } from './blocks.js';
import { boxMesh, MODEL_OFFSET } from './models.js';
import { identity, translate } from './math.js';
import { SKIN_SIZE } from './skins.js';

export const SIGN_LINES = 4, SIGN_CHARS = 15;
export const SIGN_SLOTS = 96;

// A 3x5 pixel font: each glyph five rows of three.
const GLYPHS = {
  A: '.x.x.xxxxx.xx.x', B: 'xx.x.xxx.x.xxx.', C: '.xxx..x..x...xx', D: 'xx.x.xx.xx.xxx.', E: 'xxxx..xx.x..xxx', F: 'xxxx..xx.x..x..',
  G: '.xxx..x.xx.x.xx', H: 'x.xx.xxxxx.xx.x', I: 'xxx.x..x..x.xxx', J: '..x..x..xx.x.x.', K: 'x.xx.xxx.x.xx.x', L: 'x..x..x..x..xxx',
  M: 'x.xxxxxxxx.xx.x', N: 'xx.x.xx.xx.xx.x', O: '.x.x.xx.xx.x.x.', P: 'xx.x.xxx.x..x..', Q: '.x.x.xx.xxx..xx', R: 'xx.x.xxx.x.xx.x',
  S: '.xxx...x...xxx.', T: 'xxx.x..x..x..x.', U: 'x.xx.xx.xx.xxxx', V: 'x.xx.xx.x.x..x.', W: 'x.xx.xxxxxxxx.x', X: 'x.xx.x.x.x.xx.x',
  Y: 'x.xx.x.x..x..x.', Z: 'xxx..x.x.x..xxx',
  0: 'xxxx.xx.xx.xxxx', 1: '.x.xx..x..x.xxx', 2: 'xxx..xxxxx..xxx', 3: 'xx...x.x...xxx.', 4: 'x.xx.xxxx..x..x', 5: 'xxxx..xx...xxx.',
  6: '.xxx..xxxx.xxxx', 7: 'xxx..x.x..x..x.', 8: 'xxxx.xxxxx.xxxx', 9: 'xxxx.xxxx..xxx.',
  ' ': '...............', '.': '.............x.', ',': '..........x.x..', '!': '.x..x..x.....x.', '?': 'xx...x.x.....x.',
  "'": '.x..x..........', '"': 'x.xx.x.........', '-': '......xxx......', '+': '....x.xxx.x....', ':': '....x.....x....',
  ';': '....x.....x.x..', '(': '.x.x..x..x...x.', ')': '.x...x..x..x.x.', '/': '..x..x.x.x..x..', '\\': 'x..x...x...x..x',
  '=': '...xxx...xxx...', '_': '............xxx', '*': '...x.x.x.x.x...', '#': 'x.xxxxx.xxxxx.x', '<': '..x.x.x...x...x',
  '>': 'x...x...x.x.x..', '&': '.x.x.x.x.x.x.xx', '%': 'x.x..x.x.x..x.x', '$': '.xxxx..x..xxxx.', '@': 'xxxx.xx.xx...xx',
  '[': 'xx.x..x..x..xx.', ']': '.xx..x..x..x.xx', '^': '.x.x.x.........', '~': '....x.x.x......',
};
const INK = [0x1c, 0x14, 0x0c];

// A line as it can be written: printable characters only, no longer than fits.
export const cleanLine = (s) => String(s ?? '').replace(/[^\x20-\x7e]/g, '').slice(0, SIGN_CHARS);

// RGBA pixels (SKIN_SIZE square) with `lines` lettered in the top half, each line centred; the rest
// clear (in the ink's colour, so the texture's smaller mip levels don't fringe the letters).
export function letterSign(lines) {
  const S = SKIN_SIZE, px = new Uint8Array(S * S * 4);
  for (let i = 0; i < S * S; i++) { px[i * 4] = INK[0]; px[i * 4 + 1] = INK[1]; px[i * 4 + 2] = INK[2]; }
  lines.forEach((line, row) => {
    const text = cleanLine(line).toUpperCase(), w = text.length * 4 - 1;
    let x0 = Math.floor((S - w) / 2);
    const y0 = 4 + row * 7;
    for (const ch of text) {
      const g = GLYPHS[ch] ?? GLYPHS['?'];
      for (let y = 0; y < 5; y++) for (let x = 0; x < 3; x++) if (g[y * 3 + x] === 'x') px[((y0 + y) * S + x0 + x) * 4 + 3] = 255;
      x0 += 4;
    }
  });
  return px;
}

// Where the writing goes on a sign facing `face`: the front of its board (see blocks.js), in
// block pixels, just proud of the wood.
function textQuad(face, wall) {
  const y0 = wall ? 4 : 8, y1 = y0 + 8, e = 0.06;
  switch (face) {
    case 4: return wall ? { from: [0, y0, 1.5 + e], to: [16, y1, 1.5 + e], f: 4 } : { from: [0, y0, 8.75 + e], to: [16, y1, 8.75 + e], f: 4 };
    case 5: return wall ? { from: [0, y0, 14.5 - e], to: [16, y1, 14.5 - e], f: 5 } : { from: [0, y0, 7.25 - e], to: [16, y1, 7.25 - e], f: 5 };
    case 0: return wall ? { from: [1.5 + e, y0, 0], to: [1.5 + e, y1, 16], f: 0 } : { from: [8.75 + e, y0, 0], to: [8.75 + e, y1, 16], f: 0 };
    default: return wall ? { from: [14.5 - e, y0, 0], to: [14.5 - e, y1, 16], f: 1 } : { from: [7.25 - e, y0, 0], to: [7.25 - e, y1, 16], f: 1 };
  }
}

// The writing on every sign in the world, and drawing it.
export class Signs {
  constructor(game) {
    this.game = game;
    this.text = new Map();      // "x,y,z" -> [four lines]
    this.shown = new Map();     // "x,y,z" -> { slot, mesh, version }
    this.slots = new Array(SIGN_SLOTS).fill(null);
  }

  static key(x, y, z) { return `${x},${y},${z}`; }
  get(x, y, z) { return this.text.get(Signs.key(x, y, z)) ?? ['', '', '', '']; }

  set(x, y, z, lines) {
    const key = Signs.key(x, y, z), clean = Array.from({ length: SIGN_LINES }, (_, i) => cleanLine(lines?.[i]));
    if (clean.every((l) => !l)) this.text.delete(key); else this.text.set(key, clean);
    this.forget(key);
    return clean;
  }
  remove(x, y, z) { const key = Signs.key(x, y, z); this.text.delete(key); this.forget(key); }
  forget(key) {
    const s = this.shown.get(key);
    if (!s) return;
    this.slots[s.slot] = null;
    this.shown.delete(key);
  }
  clear() { this.text.clear(); for (const key of [...this.shown.keys()]) this.forget(key); }

  serialize() { return [...this.text].map(([k, lines]) => [k, lines]); }
  load(list) {
    this.clear();
    for (const e of Array.isArray(list) ? list : []) {
      if (!Array.isArray(e) || typeof e[0] !== 'string' || !/^-?\d+,-?\d+,-?\d+$/.test(e[0]) || !Array.isArray(e[1])) continue;
      const [x, y, z] = e[0].split(',').map(Number);
      this.set(x, y, z, e[1]);
    }
  }

  // Adds the writing on the signs within `range` of the camera to the renderer's list `out`
  // (`mat()`: a matrix to fill, from the frame's pool).
  draw(cam, range, out, mat) {
    const w = this.game.world, r = this.game.renderer;
    if (!w || !r) return;
    const near = [];
    for (const [key, lines] of this.text) {
      const [x, y, z] = key.split(',').map(Number);
      const d = Math.hypot(x + 0.5 - cam.x, y + 0.5 - cam.y, z + 0.5 - cam.z);
      if (d > range) continue;
      const id = w.getBlock(x, y, z);
      if (SIGN[id]) near.push({ key, x, y, z, d, id, lines });
    }
    // The nearest get a slot first.
    near.sort((a, b) => a.d - b.d);
    for (const s of near.slice(0, SIGN_SLOTS)) {
      let shown = this.shown.get(s.key);
      if (!shown || shown.id !== s.id) {
        if (shown) this.forget(s.key);
        let slot = this.slots.indexOf(null);
        if (slot < 0) {
          // Take the slot of the farthest sign drawn.
          let far = null, fd = -1;
          for (const k of this.shown.keys()) {
            const [x, y, z] = k.split(',').map(Number), d = Math.hypot(x - cam.x, y - cam.y, z - cam.z);
            if (d > fd) { fd = d; far = k; }
          }
          slot = this.shown.get(far).slot;
          this.forget(far);
        }
        this.slots[slot] = s.key;
        const layer = r.signLayer(slot, letterSign(s.lines));
        const { face, wall } = SIGN[s.id], q = textQuad(face, wall);
        const faces = [null, null, null, null, null, null];
        // (The writing sits in the top half of the layer: 64 by 32, over the board's 16 by 8.)
        faces[q.f] = { layer, uv: [0, 0, 64, 32] };
        shown = { slot, id: s.id, mesh: r.createMesh(boxMesh([{ from: q.from.map((v) => v / 16), to: q.to.map((v) => v / 16), faces }])) };
        this.shown.set(s.key, shown);
      }
      const m = identity(mat());
      translate(m, m, s.x - cam.x - MODEL_OFFSET, s.y - cam.y - MODEL_OFFSET, s.z - cam.z - MODEL_OFFSET);
      const l = w.getLight(s.x, s.y, s.z);
      out.push({ parts: [{ mesh: shown.mesh, model: m }], light: [l >> 4, l & 15], tint: null });
    }
  }
}

// The window for writing on a sign: four lines on the board, typed straight in. Enter (or the
// down arrow) moves to the next line; Enter on the last one, Escape or Done finishes.
export class SignEditor {
  constructor(game) {
    this.game = game;
    this.at = null;
    this.el = document.createElement('section');
    this.el.className = 'screen sign-screen';
    this.el.hidden = true;
    const title = document.createElement('h2');
    title.textContent = 'Edit Sign Message';
    const board = document.createElement('div');
    board.className = 'sign-board';
    this.inputs = Array.from({ length: SIGN_LINES }, (_, i) => {
      const input = document.createElement('input');
      Object.assign(input, { type: 'text', maxLength: SIGN_CHARS, spellcheck: false, autocomplete: 'off' });
      input.setAttribute('aria-label', `Line ${i + 1}`);
      input.addEventListener('keydown', (e) => {
        e.stopPropagation();
        if (e.key === 'Enter' || e.key === 'ArrowDown') { e.preventDefault(); if (i === SIGN_LINES - 1 && e.key === 'Enter') this.game.closeSign(); else this.inputs[Math.min(SIGN_LINES - 1, i + 1)].focus(); }
        else if (e.key === 'ArrowUp') { e.preventDefault(); this.inputs[Math.max(0, i - 1)].focus(); }
        else if (e.key === 'Escape') { e.preventDefault(); this.game.closeSign(); }
      });
      input.addEventListener('input', () => { const v = cleanLine(input.value); if (v !== input.value) input.value = v; });
      board.appendChild(input);
      return input;
    });
    const post = document.createElement('div');
    post.className = 'sign-post';
    const done = document.createElement('button');
    done.className = 'btn';
    done.textContent = 'Done';
    done.addEventListener('click', () => this.game.closeSign());
    this.el.append(title, board, post, done);
    (document.getElementById('screen-container')?.parentNode ?? document.body).appendChild(this.el);
  }
  get open() { return !!this.at; }
  show(x, y, z, lines) {
    this.at = { x, y, z };
    this.inputs.forEach((input, i) => { input.value = lines[i] ?? ''; });
    this.el.hidden = false;
    setTimeout(() => this.inputs[0].focus(), 0);
  }
  lines() { return this.inputs.map((i) => cleanLine(i.value)); }
  hide() { this.at = null; this.el.hidden = true; for (const i of this.inputs) i.blur(); }
}
