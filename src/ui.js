// DOM side of the game: screens, HUD and options. Game logic lives in game.js; this module renders
// state and reports user actions through on()/emit(). Sizes are in GUI pixels (--u, see applyScale).
import { iconFor } from './icons.js';
import { itemDef } from './items.js';

export const $ = (id) => document.getElementById(id);

function canvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

function sprite(rows, colors) {
  const c = canvas(rows[0].length, rows.length);
  const g = c.getContext('2d', { willReadFrequently: true });
  rows.forEach((row, y) => [...row].forEach((ch, x) => {
    if (colors[ch]) { g.fillStyle = colors[ch]; g.fillRect(x, y, 1, 1); }
  }));
  return c.toDataURL();
}
const HEART = ['.kk...kk.', 'khrk.krrk', 'krrrkrrrk', 'krrrrrrrk', '.krrrrrk.', '..krrrk..', '...krk...', '....k....', '.........'];
const HALF = ['.kk...kk.', 'khrk.keek', 'krrrkeeek', 'krrrreeek', '.krrreek.', '..krrek..', '...kek...', '....k....', '.........'];
const DRUMSTICK = ['....kkk..', '...kmmmk.', '..kmhmmmk', '..kmmmmmk', '.kkmmmmk.', 'kbk.kkk..', 'kbbk.....', '.kk......', '.........'];
const HALF_DRUM = ['....kkk..', '...keemk.', '..keemmmk', '..keemmmk', '.kkeemmk.', 'kbk.kkk..', 'kbbk.....', '.kk......', '.........'];
const BUBBLE = ['..kkkkk..', '.kbbbbbk.', 'kbwbbbbbk', 'kbwbbbbbk', 'kbbbbbbbk', 'kbbbbbbbk', 'kbbbbbbbk', '.kbbbbbk.', '..kkkkk..'];
const CHESTPLATE = ['.kkk.kkk.', 'kwmmkmmdk', 'kmmmmmmdk', '.kmmmmmk.', '.kmmmmdk.', '.kmmmmdk.', '.kmmmmdk.', '.kddddkk.', '..kkkkk..'];
const HALF_PLATE = ['.kkk.kkk.', 'kwmmkeeek', 'kmmmmeeek', '.kmmmeek.', '.kmmmeek.', '.kmmmeek.', '.kmmmeek.', '.kddmeek.', '..kkkkk..'];
const SPRITES = {
  heart: sprite(HEART, { k: '#1a0606', r: '#d9261c', h: '#ff9c8c' }),
  half: sprite(HALF, { k: '#1a0606', r: '#d9261c', h: '#ff9c8c', e: '#3a1512' }),
  empty: sprite(HEART.map((r) => r.replace(/[rh]/g, 'e')), { k: '#1a0606', e: '#3a1512' }),
  bubble: sprite(BUBBLE, { k: '#0b2c5c', b: '#4fa3ff', w: '#e8f4ff' }),
  food: sprite(DRUMSTICK, { k: '#2a1406', m: '#b5642a', h: '#e0975a', b: '#f0e8d8' }),
  foodHalf: sprite(HALF_DRUM, { k: '#2a1406', m: '#b5642a', e: '#3a2014', b: '#f0e8d8' }),
  foodEmpty: sprite(DRUMSTICK.map((r) => r.replace(/[mh]/g, 'e')), { k: '#2a1406', e: '#3a2014', b: '#8a7f70' }),
  armor: sprite(CHESTPLATE, { k: '#1c1c1c', w: '#ffffff', m: '#c8c8c8', d: '#8a8a8a' }),
  armorHalf: sprite(HALF_PLATE, { k: '#1c1c1c', w: '#ffffff', m: '#c8c8c8', d: '#8a8a8a', e: '#3a3a3a' }),
  armorEmpty: sprite(CHESTPLATE.map((r) => r.replace(/[wmd]/g, 'e')), { k: '#1c1c1c', e: '#3a3a3a' }),
};

// The hotbar: nine 20x20 cells in a translucent bar, and the frame around the selected one.
function hotbarSprite() {
  const c = canvas(182, 22), g = c.getContext('2d', { willReadFrequently: true });
  g.fillStyle = 'rgba(0, 0, 0, 0.8)';
  g.fillRect(0, 0, 182, 22);
  g.clearRect(1, 1, 180, 20);
  for (let i = 0; i < 9; i++) {
    const x = 1 + i * 20;
    g.fillStyle = 'rgba(44, 44, 44, 0.55)';
    g.fillRect(x, 1, 20, 20);
    g.fillStyle = 'rgba(150, 150, 150, 0.85)';
    g.fillRect(x, 1, 20, 1);
    g.fillRect(x, 1, 1, 20);
    g.fillStyle = 'rgba(60, 60, 60, 0.85)';
    g.fillRect(x, 20, 20, 1);
    g.fillRect(x + 19, 1, 1, 20);
  }
  return c.toDataURL();
}
function selectionSprite() {
  const c = canvas(24, 24), g = c.getContext('2d', { willReadFrequently: true });
  const ring = (inset, color) => {
    g.fillStyle = color;
    g.fillRect(inset, inset, 24 - inset * 2, 24 - inset * 2);
    g.clearRect(inset + 1, inset + 1, 22 - inset * 2, 22 - inset * 2);
  };
  ring(0, '#000');
  ring(1, '#fff');
  ring(2, '#fff');
  ring(3, '#8b8b8b');
  return c.toDataURL();
}

function slotEl() {
  const el = document.createElement('div');
  el.className = 'slot';
  el.innerHTML = '<img alt=""><span class="count"></span><span class="dur" hidden><i></i></span>';
  return el;
}

function fillSlot(el, stack) {
  const img = el.firstChild, count = el.children[1], dur = el.children[2];
  if (!stack) {
    img.removeAttribute('src');
    img.style.visibility = 'hidden';
    count.textContent = '';
    dur.hidden = true;
    return;
  }
  const src = iconFor(stack.id);
  if (img.getAttribute('src') !== src) img.src = src;
  img.style.visibility = '';
  count.textContent = stack.count > 1 ? stack.count : '';
  const def = itemDef(stack.id);
  if (def?.durability && stack.dmg) {
    const f = Math.max(0, 1 - stack.dmg / def.durability);
    dur.hidden = false;
    dur.firstChild.style.width = `${(Math.round(f * 13) / 13) * 100}%`;
    dur.firstChild.style.background = `hsl(${Math.round(f * 120)}, 100%, 50%)`;
  } else dur.hidden = true;
}

// ---------------------------------------------------------------- the logo
// A blocky pixel font for the title, extruded like a row of blocks and textured with the game's
// own grass, dirt and stone.
const GLYPHS = {
  B: ['####.', '#...#', '#...#', '####.', '#...#', '#...#', '####.'],
  L: ['#....', '#....', '#....', '#....', '#....', '#....', '#####'],
  O: ['.###.', '#...#', '#...#', '#...#', '#...#', '#...#', '.###.'],
  C: ['.####', '#....', '#....', '#....', '#....', '#....', '.####'],
  K: ['#...#', '#..#.', '#.#..', '##...', '#.#..', '#..#.', '#...#'],
  H: ['#...#', '#...#', '#...#', '#####', '#...#', '#...#', '#...#'],
  A: ['.###.', '#...#', '#...#', '#####', '#...#', '#...#', '#...#'],
  V: ['#...#', '#...#', '#...#', '#...#', '#...#', '.#.#.', '..#..'],
  E: ['#####', '#....', '#....', '####.', '#....', '#....', '#####'],
  N: ['#...#', '##..#', '#.#.#', '#..##', '#...#', '#...#', '#...#'],
};

// Draws the logo into a canvas at one canvas pixel per GUI pixel; returns [width, height].
export function drawLogo(cv, pixels, TEX) {
  const word = 'BLOCKHAVEN', S = 4, DEPTH = 6, PAD = 1;
  const W = (word.length * 6 - 1) * S + PAD * 2, H = 7 * S + DEPTH + PAD * 2;
  cv.width = W;
  cv.height = H;
  const g = cv.getContext('2d');
  const img = g.createImageData(W, H);
  const face = new Int8Array(W * H).fill(-1); // which letter each front-face pixel belongs to
  for (let k = 0; k < word.length; k++) {
    const rows = GLYPHS[word[k]];
    for (let y = 0; y < 7; y++) {
      for (let x = 0; x < 5; x++) {
        if (rows[y][x] !== '#') continue;
        for (let dy = 0; dy < S; dy++) for (let dx = 0; dx < S; dx++) face[(PAD + y * S + dy) * W + PAD + (k * 6 + x) * S + dx] = k;
      }
    }
  }
  const tex = (layer, x, y) => {
    const i = layer * 1024 + ((y & 15) * 16 + (x & 15)) * 4;
    return [pixels[i], pixels[i + 1], pixels[i + 2]];
  };
  const put = (i, c, f) => {
    img.data[i * 4] = Math.min(255, c[0] * f);
    img.data[i * 4 + 1] = Math.min(255, c[1] * f);
    img.data[i * 4 + 2] = Math.min(255, c[2] * f);
    img.data[i * 4 + 3] = 255;
  };
  // Grass over dirt for BLOCK, stone for HAVEN.
  const colour = (k, x, y) => {
    if (k >= 5) return tex(TEX.stone, x, y);
    if (y - PAD < S * 2 - 1) { const c = tex(TEX.grass_top, x, y); return [c[0] * 0.49, c[1] * 0.74, c[2] * 0.33]; }
    return tex(TEX.dirt, x, y);
  };
  const solid = new Uint8Array(W * H);
  // The letters stand out DEPTH pixels from the back, so their undersides show below them.
  for (let y = H - 1; y >= 0; y--) {
    for (let x = 0; x < W; x++) {
      const k = face[y * W + x];
      if (k < 0) continue;
      for (let d = DEPTH; d >= 1; d--) {
        const i = (y + d) * W + x;
        if (y + d >= H || face[i] >= 0) continue;
        put(i, colour(k, x, y + d), d === 1 ? 0.62 : 0.42);
        solid[i] = 1;
      }
    }
  }
  for (let i = 0; i < W * H; i++) {
    const k = face[i];
    if (k < 0) continue;
    const x = i % W, y = (i / W) | 0;
    const top = face[i - W] !== k, left = face[i - 1] !== k;
    put(i, colour(k, x, y), top ? 1.35 : left ? 1.18 : 1.02 - ((y - PAD) / (7 * S)) * 0.12);
    solid[i] = 1;
  }
  // A dark outline around it all.
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      if (solid[i]) continue;
      let near = false;
      for (let dy = -1; dy <= 1 && !near; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const nx = x + dx, ny = y + dy;
          if (nx >= 0 && ny >= 0 && nx < W && ny < H && solid[ny * W + nx]) { near = true; break; }
        }
      }
      if (near) img.data[i * 4 + 3] = 255;
    }
  }
  g.putImageData(img, 0, 0);
  return [W, H];
}

const SPLASHES = [
  'Now with furnaces!', 'Crafting tables work!', 'Punch a tree!', '100% blocks!', 'Runs in a browser tab!',
  'Mind the zombies!', 'Wear a helmet!', 'Pigs approve!', 'Made of code!', 'Diamonds!', 'Also try gardening!',
  'Coal is your friend!', 'Look up at the stars!', 'Sleep through the night!', 'Hand-drawn pixels!',
  'Shift-click it!', 'Axes are slow but strong!', 'Mushroom stew!',
];

// ---------------------------------------------------------------- options
const pct = (v) => (v ? `${v}%` : 'OFF');
const LOOKS = ['Teal', 'Red', 'Green', 'Purple', 'Amber', 'Blue', 'Rose', 'Grey'];
export const OPTIONS = [
  { section: 'Player' },
  { key: 'look', label: 'Skin', cycle: [-1, ...LOOKS.keys()], fmt: (v) => (v < 0 ? 'Picked by Name' : LOOKS[v]) },
  { section: 'Video' },
  { key: 'renderDistance', label: 'Render Distance', min: 2, max: 16, fmt: (v) => `${v} chunks` },
  { key: 'resolution', label: 'Resolution', min: 0, max: 6, fmt: (v) => (v ? `${40 + v * 10}%` : 'Auto') },
  { key: 'fov', label: 'FOV', min: 50, max: 110, fmt: (v) => `${v}` },
  { key: 'brightness', label: 'Brightness', min: 0, max: 100, step: 5, fmt: (v) => (v <= 0 ? 'Moody' : v >= 100 ? 'Bright' : `${v}%`) },
  { key: 'shaders', label: 'Shaders', cycle: [0, 1, 2], fmt: (v) => ['OFF', 'Low', 'High'][v] ?? 'OFF' },
  { key: 'clouds', label: 'Clouds', toggle: true },
  { key: 'viewBobbing', label: 'View Bobbing', toggle: true },
  { key: 'blood', label: 'Blood Effects', toggle: true },
  { section: 'Interface' },
  { key: 'guiScale', label: 'GUI Scale', scale: true },
  { key: 'showFps', label: 'Show FPS', toggle: true },
  { section: 'Music & Sounds' },
  { key: 'volume', label: 'Sound Effects', min: 0, max: 100, step: 5, fmt: pct },
  { key: 'music', label: 'Music', min: 0, max: 100, step: 5, fmt: pct },
  { section: 'Controls' },
  { key: 'sensitivity', label: 'Sensitivity', min: 10, max: 250, step: 5, fmt: (v) => `${v}%` },
  { key: 'invertMouse', label: 'Invert Mouse', toggle: true },
];

const MODES = {
  survival: ['Survival', 'Gather resources, craft tools and stay alive.'],
  creative: ['Creative', 'Every block, unlimited. Fly and build freely.'],
};
const TYPES = {
  default: ['Default', 'Mountains, forests, oceans and caves.'],
  flat: ['Flat', 'An endless plain for building.'],
};

export class UI {
  constructor() {
    this.handlers = {};
    this.screens = [...document.querySelectorAll('.screen')];
    this.current = null;
    this.hotbarEls = [];
    this.nameTimer = 0;
    this.lastHealth = -1;
    this.lastAir = -1;
    this.lastFood = -1;
    this.lastArmor = -1;
    this.lastMeter = -1;
    this.lastSel = -1;
    this.u = 3;
    this.selectedWorld = null;
    this.selectedGame = null;
    this.createState = { mode: 'survival', type: 'default' };

    document.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-action]');
      if (!btn || btn.disabled) return;
      const where = btn.closest('.screen, .modal');
      this.onButton?.();
      this.emit(btn.dataset.action, where?.id, btn);
    });

    const hud = $('hud');
    hud.style.setProperty('--hotbar', `url(${hotbarSprite()})`);
    hud.style.setProperty('--hotbar-sel', `url(${selectionSprite()})`);
    const hotbar = $('hotbar');
    for (let i = 0; i < 9; i++) {
      const el = slotEl();
      el.style.left = `calc(var(--u) * ${3 + i * 20})`;
      el.style.top = 'calc(var(--u) * 3)';
      hotbar.appendChild(el);
      this.hotbarEls.push(el);
    }
    hotbar.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      const r = hotbar.getBoundingClientRect();
      const i = Math.floor(((e.clientX - r.left) / r.width) * 9);
      if (i >= 0 && i < 9) this.emit('hotbar-tap', i);
    });
    $('hearts').innerHTML = '<i></i>'.repeat(10);
    $('bubbles').innerHTML = '<i></i>'.repeat(10);
    $('hunger').innerHTML = '<i></i>'.repeat(10);
    $('armor').innerHTML = '<i></i>'.repeat(10);

    $('create-form').addEventListener('submit', (e) => { e.preventDefault(); this.emit('create-world'); });
    this.on('cycle-mode', () => this.setCreate('mode', this.createState.mode === 'survival' ? 'creative' : 'survival'));
    this.on('cycle-type', () => this.setCreate('type', this.createState.type === 'default' ? 'flat' : 'default'));
    this.setCreate('mode', 'survival');
    this.setCreate('type', 'default');
    $('chat-input').addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); this.emit('chat-send', $('chat-input').value); }
      else if (e.key === 'Escape') { e.preventDefault(); this.emit('chat-close'); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); this.emit('chat-history', -1); }
      else if (e.key === 'ArrowDown') { e.preventDefault(); this.emit('chat-history', 1); }
      e.stopPropagation();
    });
    const list = $('world-list');
    list.addEventListener('click', (e) => {
      const li = e.target.closest('.world');
      if (li) this.selectWorld(li.dataset.id);
    });
    list.addEventListener('dblclick', (e) => {
      const li = e.target.closest('.world');
      if (li) { this.selectWorld(li.dataset.id); this.onButton?.(); this.emit('open-world'); }
    });
    list.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && this.selectedWorld) { this.onButton?.(); this.emit('open-world'); }
    });

    // Multiplayer: the list of games on this page, the join code, and names.
    const games = $('mp-games');
    games.addEventListener('click', (e) => {
      const li = e.target.closest('.world');
      if (li && !li.classList.contains('off')) this.selectGame(li.dataset.addr);
    });
    games.addEventListener('dblclick', (e) => {
      const li = e.target.closest('.world');
      if (li && !li.classList.contains('off')) { this.selectGame(li.dataset.addr); this.onButton?.(); this.emit('mp-join'); }
    });
    games.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && this.selectedGame) { this.onButton?.(); this.emit('mp-join'); }
    });
    $('mp-code-form').addEventListener('submit', (e) => {
      e.preventDefault();
      this.onButton?.();
      this.emit('mp-code', $('mp-code').value);
    });
    $('mp-code').addEventListener('input', () => {
      const el = $('mp-code');
      const v = el.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6);
      if (v !== el.value) el.value = v;
    });
    for (const id of ['mp-name', 'share-name']) $(id).addEventListener('change', () => this.emit('mp-name', $(id).value));
  }

  on(name, fn) { this.handlers[name] = fn; }
  emit(name, ...args) { this.handlers[name]?.(...args); }

  show(id) {
    for (const s of this.screens) s.hidden = s.id !== id;
    this.current = id;
    if (id === 'screen-title') this.splash();
    const field = id && $(id)?.querySelector('input[type=text]');
    if (field && matchMedia('(pointer: fine)').matches) setTimeout(() => field.focus({ preventScroll: true }), 0);
  }

  // ---------------------------------------------------------------- GUI scale
  // One GUI pixel is --u CSS pixels. Auto picks the largest size at which a 320x240 screen fits
  // (200x200 on touch screens, so the HUD suits a phone held upright), like the original, and a
  // chosen size is capped the same way. Sizes land on whole device pixels to keep edges crisp.
  maxScale() {
    const coarse = matchMedia('(pointer: coarse)').matches;
    return Math.min(window.innerWidth / (coarse ? 200 : 320), window.innerHeight / (coarse ? 200 : 240));
  }

  scaleFor(setting) {
    const dpr = window.devicePixelRatio || 1, max = this.maxScale();
    const u = setting ? Math.min(setting, max) : Math.min(4, max);
    return Math.max(Math.min(1, max), Math.floor(u * dpr + 1e-6) / dpr);
  }

  // The sizes offered on the GUI Scale slider (after Auto): whole steps, or halves on sharp screens.
  scaleChoices() {
    const step = (window.devicePixelRatio || 1) >= 2 ? 0.5 : 1;
    const out = [];
    for (let s = 1; s <= Math.max(1, this.maxScale()) + 1e-6; s += step) out.push(s);
    return out;
  }

  applyScale(setting) {
    const u = this.scaleFor(setting);
    if (u !== this.u) {
      this.u = u;
      document.documentElement.style.setProperty('--u', `${u}px`);
    }
    this.scaleSlider?.();
    return u;
  }

  // ---------------------------------------------------------------- title
  drawLogo(pixels, TEX) {
    const cv = $('logo');
    const [w] = drawLogo(cv, pixels, TEX);
    cv.style.width = `calc(var(--u) * ${w})`;
  }

  splash() {
    $('splash').textContent = SPLASHES[Math.floor(Math.random() * SPLASHES.length)];
  }

  // ---------------------------------------------------------------- HUD
  setHUD(visible) {
    if (this.hudVisible === visible) return;
    this.hudVisible = visible;
    $('hud').hidden = !visible;
  }

  // Cheap per-frame toggles: only touch the DOM when something changed.
  setFlags(flags) {
    const prev = this.flags ?? (this.flags = {});
    for (const [k, v] of Object.entries(flags)) {
      if (prev[k] === v) continue;
      prev[k] = v;
      if (k === 'water') $('overlay-water').style.opacity = v ? 1 : 0;
      else if (k === 'hurt') $('overlay-hurt').style.opacity = v;
      else $(k).hidden = !v;
    }
  }

  renderHotbar(inv) {
    for (let i = 0; i < 9; i++) fillSlot(this.hotbarEls[i], inv.slots[i]);
    if (inv.selected !== this.lastSel) {
      this.lastSel = inv.selected;
      $('hotbar-sel').style.left = `calc(var(--u) * ${inv.selected * 20 - 1})`;
    }
  }

  // A place's name in big letters (walking into a village), fading after a few seconds.
  showTitle(title, subtitle = '') {
    let el = $('place-title');
    if (!el) {
      el = document.createElement('div');
      el.id = 'place-title';
      el.innerHTML = '<div class="big"></div><div class="small"></div>';
      $('item-name').parentNode.appendChild(el);
    }
    el.firstChild.textContent = title;
    el.lastChild.textContent = subtitle;
    el.classList.add('show');
    clearTimeout(this.titleTimer);
    this.titleTimer = setTimeout(() => el.classList.remove('show'), 3500);
  }

  showItemName(text, ms = 1500) {
    const el = $('item-name');
    el.textContent = text;
    el.classList.add('show');
    clearTimeout(this.nameTimer);
    this.nameTimer = setTimeout(() => el.classList.remove('show'), ms);
  }

  renderStats(survival, health, air, underwater, food = 20, armor = 0) {
    $('stats').style.visibility = survival ? 'visible' : 'hidden';
    if (!survival) return;
    if (armor !== this.lastArmor) {
      this.lastArmor = armor;
      const el = $('armor');
      el.style.visibility = armor > 0 ? 'visible' : 'hidden';
      [...el.children].forEach((i, k) => {
        const v = armor - k * 2;
        i.style.backgroundImage = `url(${v >= 2 ? SPRITES.armor : v === 1 ? SPRITES.armorHalf : SPRITES.armorEmpty})`;
      });
    }
    if (food !== this.lastFood) {
      this.lastFood = food;
      [...$('hunger').children].forEach((el, i) => {
        const v = food - i * 2;
        el.style.backgroundImage = `url(${v >= 2 ? SPRITES.food : v === 1 ? SPRITES.foodHalf : SPRITES.foodEmpty})`;
      });
    }
    if (health !== this.lastHealth) {
      this.lastHealth = health;
      [...$('hearts').children].forEach((el, i) => {
        const v = health - i * 2;
        el.style.backgroundImage = `url(${v >= 2 ? SPRITES.heart : v === 1 ? SPRITES.half : SPRITES.empty})`;
      });
    }
    // With two hearts or less left, the hearts tremble.
    const shake = health > 0 && health <= 4;
    if (shake || this.shaking) {
      this.shaking = shake;
      const t = performance.now();
      if (!shake || t - (this.shakeTime ?? 0) > 60) {
        this.shakeTime = t;
        for (const el of $('hearts').children) el.style.transform = shake ? `translateY(calc(var(--u) * ${Math.round(Math.random() * 2) - 1}))` : '';
      }
    }
    const bubbles = underwater || air < 300 ? Math.ceil((air / 300) * 10) : -1;
    if (bubbles !== this.lastAir) {
      this.lastAir = bubbles;
      [...$('bubbles').children].forEach((el, i) => {
        el.style.backgroundImage = i < bubbles ? `url(${SPRITES.bubble})` : 'none';
      });
    }
  }

  // Attack wind-up under the crosshair: 0..1, or -1 to hide it.
  setAttackMeter(f) {
    const v = f < 0 ? -1 : Math.round(f * 16);
    if (v === this.lastMeter) return;
    this.lastMeter = v;
    const el = $('attack-meter');
    el.hidden = v < 0;
    if (v >= 0) el.firstChild.style.width = `${(v / 16) * 100}%`;
  }

  setDebug(lines) {
    const el = $('debug');
    if (!lines) { if (!el.hidden) el.hidden = true; return; }
    el.hidden = false;
    const html = lines.map((l) => `<span>${l}</span>`).join('\n');
    if (html !== this.debugHTML) { this.debugHTML = html; el.innerHTML = html; }
  }

  message(text, color = null) {
    const li = document.createElement('li');
    li.textContent = text;
    if (color) li.style.color = color;
    const log = $('chat-log');
    log.appendChild(li);
    while (log.children.length > 10) log.firstChild.remove();
  }

  openChat(prefix = '') {
    $('chat').classList.add('open');
    const input = $('chat-input');
    input.hidden = false;
    input.value = prefix;
    input.focus();
  }

  closeChat() {
    $('chat').classList.remove('open');
    const input = $('chat-input');
    input.blur();
    input.hidden = true;
  }

  setSleeping(on) { $('overlay-sleep').classList.toggle('on', on); }

  // ---------------------------------------------------------------- menus
  renderWorlds(worlds, persistent) {
    $('storage-note').hidden = persistent;
    $('world-empty').hidden = worlds.length > 0;
    if (!worlds.some((w) => w.id === this.selectedWorld)) this.selectedWorld = worlds[0]?.id ?? null;
    const list = $('world-list');
    list.replaceChildren(...worlds.map((w) => {
      const li = document.createElement('li');
      li.className = 'world';
      li.dataset.id = w.id;
      li.tabIndex = 0;
      li.setAttribute('role', 'option');
      const icon = document.createElement('img');
      icon.src = iconFor(w.type === 'flat' ? 3 : w.mode === 'creative' ? 41 : 2);
      icon.alt = '';
      const name = document.createElement('b');
      name.textContent = w.name;
      const played = document.createElement('span');
      played.textContent = `Played ${timeAgo(w.lastPlayed)}`;
      const mode = document.createElement('span');
      mode.textContent = `${w.mode === 'creative' ? 'Creative' : 'Survival'} Mode, ${w.type === 'flat' ? 'Flat' : 'Default'} world, seed ${w.seed}`;
      li.append(icon, name, played, mode);
      return li;
    }));
    this.selectWorld(this.selectedWorld);
  }

  selectWorld(id) {
    this.selectedWorld = id;
    for (const li of $('world-list').children) {
      const on = li.dataset.id === id;
      li.classList.toggle('sel', on);
      li.setAttribute('aria-selected', on);
    }
    $('w-play').disabled = !id;
    $('w-delete').disabled = !id;
  }

  setCreate(kind, value) {
    this.createState[kind] = value;
    const [name, desc] = (kind === 'mode' ? MODES : TYPES)[value];
    $(`cw-${kind}`).textContent = `${kind === 'mode' ? 'Game Mode' : 'World Type'}: ${name}`;
    $(`cw-${kind}-desc`).textContent = desc;
  }

  // ---------------------------------------------------------------- multiplayer
  // Games open on this claude.ai page ({ addr, host, world, mode, players, ok }), or null when
  // this page isn't on claude.ai (then only join codes work).
  renderGames(games) {
    $('mp-room').hidden = games === null;
    $('mp-room-note').hidden = games !== null;
    $('mp-join').hidden = games === null;
    if (games === null) { this.selectGame(null); return; }
    $('mp-empty').hidden = games.length > 0;
    if (!games.some((g) => g.addr === this.selectedGame && g.ok)) this.selectedGame = games.find((g) => g.ok)?.addr ?? null;
    const key = JSON.stringify(games);
    if (key !== this.gamesKey) {
      this.gamesKey = key;
      $('mp-games').replaceChildren(...games.map((g) => {
        const li = document.createElement('li');
        li.className = g.ok ? 'world' : 'world off';
        li.dataset.addr = g.addr;
        li.tabIndex = 0;
        li.setAttribute('role', 'option');
        const icon = document.createElement('img');
        icon.src = iconFor(g.mode === 'Creative' ? 41 : 2);
        icon.alt = '';
        const name = document.createElement('b');
        name.textContent = g.world;
        const who = document.createElement('span');
        who.textContent = `Hosted by ${g.host} · ${g.mode}`;
        const n = document.createElement('span');
        n.textContent = g.ok ? `${g.players} player${g.players === 1 ? '' : 's'} online` : 'A different version: reload the page to join';
        li.append(icon, name, who, n);
        return li;
      }));
    }
    this.selectGame(this.selectedGame);
  }

  selectGame(addr) {
    this.selectedGame = addr;
    for (const li of $('mp-games').children) {
      const on = li.dataset.addr === addr;
      li.classList.toggle('sel', on);
      li.setAttribute('aria-selected', on);
    }
    $('mp-join').disabled = !addr;
  }

  mpStatus(text, error = false) {
    const el = $('mp-status');
    el.hidden = !text;
    el.textContent = text ?? '';
    el.classList.toggle('error', !!error);
  }

  // The Open to Friends screen. `net`: the game being hosted (or null); `room`: on claude.ai.
  renderShare(net, room) {
    const text = $('share-text');
    if (net) {
      text.textContent = net.via === 'room'
        ? `Your world is open. People you've shared this page with on claude.ai can join from Multiplayer on the title screen. ${net.count} player${net.count === 1 ? '' : 's'} online.`
        : `Your world is open. Friends choose Multiplayer on the title screen and type this code. ${net.count} player${net.count === 1 ? '' : 's'} online.`;
    } else {
      text.textContent = room
        ? 'Let friends join this world while you play. People you’ve shared this page with on claude.ai will see it under Multiplayer. A join code works for friends playing anywhere else.'
        : 'Let friends join this world while you play. You get a six-letter code to give them; they type it under Multiplayer on the title screen.';
    }
    $('share-code').hidden = !net?.code;
    $('share-code-text').textContent = net?.code ?? '';
    $('share-room').hidden = !!net || !room;
    $('share-code-btn').hidden = !!net;
    $('share-name-field').hidden = !!net;
    this.shareStatus(null);
  }

  shareStatus(text, error = false) {
    const el = $('share-status');
    el.hidden = !text;
    el.textContent = text ?? '';
    el.classList.toggle('error', !!error);
  }

  // single: Open to Friends; host: the same screen shows the code; guest: nothing to open.
  setPauseMenu(mode) {
    $('p-share').hidden = mode === 'guest';
    $('p-share').textContent = mode === 'host' ? 'Friends…' : 'Open to Friends';
    $('p-quit').textContent = mode === 'guest' ? 'Disconnect' : 'Save and Quit to Title';
  }

  confirm(title, text, okLabel) {
    return new Promise((resolve) => {
      $('confirm-title').textContent = title;
      $('confirm-text').textContent = text;
      const modal = $('confirm');
      modal.querySelector('[data-action=ok]').textContent = okLabel;
      modal.hidden = false;
      const prevOk = this.handlers.ok, prevCancel = this.handlers.cancel;
      const done = (v) => { modal.hidden = true; this.handlers.ok = prevOk; this.handlers.cancel = prevCancel; resolve(v); };
      this.handlers.ok = () => done(true);
      this.handlers.cancel = () => done(false);
    });
  }

  // Builds the options screen: sliders with their value written across them, and ON/OFF buttons.
  bindSettings(settings, onChange) {
    const root = $('options');
    root.replaceChildren();
    this.scaleSlider = null;
    for (const o of OPTIONS) {
      if (o.section) {
        const h = document.createElement('h3');
        h.textContent = o.section;
        root.appendChild(h);
        continue;
      }
      if (o.cycle) {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'btn';
        const label = () => { b.textContent = `${o.label}: ${o.fmt(settings[o.key])}`; };
        label();
        b.addEventListener('click', () => {
          const i = o.cycle.indexOf(settings[o.key]);
          settings[o.key] = o.cycle[(i + 1) % o.cycle.length];
          label();
          onChange(o.key);
        });
        root.appendChild(b);
        continue;
      }
      if (o.toggle) {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'btn';
        const label = () => { b.textContent = `${o.label}: ${settings[o.key] ? 'ON' : 'OFF'}`; };
        label();
        b.addEventListener('click', () => { settings[o.key] = !settings[o.key]; label(); onChange(o.key); });
        root.appendChild(b);
        continue;
      }
      const wrap = document.createElement('label');
      wrap.className = 'slider';
      const input = document.createElement('input');
      input.type = 'range';
      input.setAttribute('aria-label', o.label);
      const text = document.createElement('span');
      wrap.append(input, text);
      root.appendChild(wrap);
      if (o.scale) {
        // Auto, then the sizes that fit this screen. The new size is applied when you let go, so
        // the slider doesn't jump about under the pointer while you drag it.
        const values = () => [0, ...this.scaleChoices()];
        const name = (v) => `${o.label}: ${v || `Auto (${Math.round(this.scaleFor(0) * 10) / 10})`}`;
        const sync = () => {
          const v = values();
          input.min = 0;
          input.max = v.length - 1;
          input.step = 1;
          const i = v.indexOf(settings.guiScale);
          input.value = i >= 0 ? i : settings.guiScale ? v.length - 1 : 0;
          text.textContent = name(settings.guiScale);
        };
        input.addEventListener('input', () => { text.textContent = name(values()[Number(input.value)]); });
        input.addEventListener('change', () => { settings.guiScale = values()[Number(input.value)]; onChange('guiScale'); sync(); });
        this.scaleSlider = sync;
        sync();
        continue;
      }
      input.min = o.min;
      input.max = o.max;
      input.step = o.step ?? 1;
      input.value = settings[o.key];
      const label = () => { text.textContent = `${o.label}: ${o.fmt(settings[o.key])}`; };
      label();
      input.addEventListener('input', () => { settings[o.key] = Number(input.value); label(); onChange(o.key); });
    }
  }
}

export function timeAgo(t) {
  if (!t) return 'never';
  const s = (Date.now() - t) / 1000;
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
  const d = Math.floor(s / 86400);
  return d === 1 ? 'yesterday' : `${d} days ago`;
}
