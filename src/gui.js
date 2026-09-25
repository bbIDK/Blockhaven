// Minecraft-style container windows: the inventory (2x2 crafting grid, armor slots and a picture of
// your character), the crafting table, furnaces, chests and the creative item palette, plus the
// recipe book. Windows are laid out in "GUI pixels" (--u CSS pixels each) at the original's
// coordinates. Menus (containers.js) hold the rules; this module draws them and turns pointer
// input into menu actions.
import { $ } from './ui.js';
import { iconFor } from './icons.js';
import { ITEMS, I, itemDef, itemLabel, ARMOR_PIECES, attackDamage, attackSpeed } from './items.js';
import { RECIPES, recipeFits, countItems, planRecipe, layout, COOK_TIME } from './crafting.js';
import { CREATIVE_BLOCKS, BLOCKS } from './blocks.js';
import { PlayerPreview } from './preview.js';

// ---------------------------------------------------------------- sprites
function pix(rows, colors) {
  const c = document.createElement('canvas');
  c.width = rows[0].length;
  c.height = rows.length;
  const g = c.getContext('2d', { willReadFrequently: true }); // (kept in memory: see icons.js)
  rows.forEach((row, y) => [...row].forEach((ch, x) => {
    if (colors[ch]) { g.fillStyle = colors[ch]; g.fillRect(x, y, 1, 1); }
  }));
  return c.toDataURL();
}

function arrow(w, h, color) {
  const rows = [];
  const hx = w - Math.ceil(h / 2) - 1, t = Math.round(h / 3);
  for (let y = 0; y < h; y++) {
    let row = '';
    for (let x = 0; x < w; x++) {
      const dy = Math.abs(y + 0.5 - h / 2);
      const on = x < hx ? dy < t / 2 : dy < (h / 2) * (1 - (x - hx) / (w - hx)) + 0.01;
      row += on ? 'a' : '.';
    }
    rows.push(row);
  }
  return pix(rows, { a: color });
}

// Window frame for a 9-slice border: black outline with cut corners, white top-left bevel, dark
// bottom-right bevel, light grey face.
const WINDOW = ['..kkk..', '.kwwwk.', 'kwwwcsk', 'kwwcssk', 'kwcsssk', '.ksssk.', '..kkk..'];
const FLAME = [
  '......f.......', '.....ff.......', '.....fff......', '....fffy...f..', '....ffyy..ff..', '...fffyy.fff..',
  '..ffyyyyffff..', '..fyyyyyyyff..', '.ffyyyyyyyyff.', '.fyyywwwyyyyf.', 'fyyywwwwwyyyff', 'fyywwwwwwwyyyf',
  '.fyywwwwwwyyf.', '..ffyyyyyyff..'];
const BOOK = [
  '................', '...kkkkkkkkkk...', '..kgGGGGGGGGgk..', '..kgGhhhhhhGgk..', '..kgGGGGGGGGgk..', '..kgGGGGGGGGgk..',
  '..kgGGGyyGGGgk..', '..kgGGyGGyGGgk..', '..kgGGGyyGGGgk..', '..kgGGGGGGGGgk..', '..kgGGGGGGGGgk..', '..kgGGGGGGGGgk..',
  '..kgggggggggwk..', '..kkwwwwwwwwwk..', '...kkkkkkkkkk...', '................'];
const HINTS = {
  helmet: ['................', '................', '................', '................', '.....aaaaaa.....', '...aaaaaaaaaa...',
    '..aaaaaaaaaaaa..', '..aaaaaaaaaaaa..', '..aaaaaaaaaaaa..', '..aaaa....aaaa..', '..aaaa....aaaa..', '..aaaa....aaaa..',
    '................', '................', '................', '................'],
  chestplate: ['................', '..aaaa....aaaa..', '.aaaaaaaaaaaaaa.', '.aaaaaaaaaaaaaa.', '.aaaaaaaaaaaaaa.', '.aaaaaaaaaaaaaa.',
    '...aaaaaaaaaaa..', '...aaaaaaaaaaa..', '...aaaaaaaaaaa..', '...aaaaaaaaaaa..', '...aaaaaaaaaaa..', '...aaaaaaaaaaa..',
    '...aaaaaaaaaaa..', '...aaaaaaaaaaa..', '................', '................'],
  leggings: ['................', '................', '...aaaaaaaaaa...', '...aaaaaaaaaa...', '...aaaaaaaaaa...', '...aaaaaaaaaa...',
    '...aaaaa.aaaaa..', '...aaaaa.aaaaa..', '...aaaaa.aaaaa..', '...aaaaa.aaaaa..', '...aaaaa.aaaaa..', '...aaaaa.aaaaa..',
    '...aaaaa.aaaaa..', '...aaaaa.aaaaa..', '................', '................'],
  boots: ['................', '................', '................', '................', '................', '................',
    '...aaaa..aaaa...', '...aaaa..aaaa...', '...aaaa..aaaa...', '...aaaa..aaaa...', '..aaaaa..aaaaa..', '.aaaaaa..aaaaaa.',
    '.aaaaaa..aaaaaa.', '.aaaaaa..aaaaaa.', '................', '................'],
};
const TRASH = ['................', '................', '......aaaa......', '..aaaaaaaaaaaa..', '................', '...aaaaaaaaaa...',
  '...a.a.aa.a.a...', '...a.a.aa.a.a...', '...a.a.aa.a.a...', '...a.a.aa.a.a...', '...a.a.aa.a.a...', '...a.a.aa.a.a...',
  '...aaaaaaaaaa...', '................', '................', '................'];

let SPR = null;
export function sprites() {
  if (SPR) return SPR;
  SPR = {
    window: pix(WINDOW, { k: '#000', w: '#fff', c: '#c6c6c6', s: '#555' }),
    arrow: arrow(22, 15, '#8b8b8b'),
    arrowSmall: arrow(16, 13, '#8b8b8b'),
    cook: arrow(24, 17, '#8b8b8b'),
    cookFull: arrow(24, 17, '#fff'),
    flame: pix(FLAME, { f: '#8b8b8b', y: '#8b8b8b', w: '#8b8b8b' }),
    flameFull: pix(FLAME, { f: '#e0561a', y: '#ffa21f', w: '#ffe27a' }),
    book: pix(BOOK, { k: '#1e3a12', g: '#2e6a1c', G: '#3f8f2a', h: '#6ec24a', y: '#e8d27a', w: '#f0ede0' }),
    trash: pix(TRASH, { a: 'rgba(55,55,55,0.55)' }),
    hints: ARMOR_PIECES.map((p) => pix(HINTS[p], { a: 'rgba(55,55,55,0.4)' })),
  };
  return SPR;
}

// ---------------------------------------------------------------- layouts (GUI pixels)
const SIZES = {
  inventory: [176, 166], crafting: [176, 166], furnace: [176, 166], chest: [176, 168], large_chest: [176, 222], creative: [195, 136],
};
const TABS = [
  { id: 'building', label: 'Building Blocks', icon: 'bricks' },
  { id: 'colored', label: 'Colored Blocks', icon: 'cyan_wool' },
  { id: 'nature', label: 'Natural Blocks', icon: 'grass_block' },
  { id: 'utility', label: 'Functional Blocks', icon: 'crafting_table' },
  { id: 'equipment', label: 'Tools & Combat', icon: 'iron_sword' },
  { id: 'materials', label: 'Food & Materials', icon: 'apple' },
  { id: 'search', label: 'Search Items', icon: 'book' },
  { id: 'inventory', label: 'Survival Inventory', icon: 'chest' },
];
const BOOK_TABS = [
  { id: 'all', label: 'All recipes', icon: 'crafting_table' },
  { id: 'building', label: 'Building blocks', icon: 'bricks' },
  { id: 'equipment', label: 'Equipment', icon: 'iron_sword' },
  { id: 'misc', label: 'Miscellaneous', icon: 'torch' },
];
const GEAR = new Set(['flint_and_steel', 'bow', 'arrow', 'shears', 'bucket', 'water_bucket', 'lava_bucket', 'compass', 'clock',
  'fishing_rod', 'saddle']);
function creativeTab(id) {
  const d = itemDef(id);
  if (d.block !== null) {
    const cat = BLOCKS[d.block].cat;
    return cat === 'functional' ? 'utility' : cat ?? 'building';
  }
  if (d.tool || d.weapon || d.armor || GEAR.has(d.name)) return 'equipment';
  return 'materials';
}
const PALETTE = [...CREATIVE_BLOCKS, ...[...ITEMS.keys()].filter((id) => id >= 256)];

const px = (n) => `calc(var(--u) * ${n})`;
function place(el, x, y, w, h) {
  el.style.left = px(x);
  el.style.top = px(y);
  if (w !== undefined) el.style.width = px(w);
  if (h !== undefined) el.style.height = px(h);
  return el;
}
export function div(cls, parent, x, y, w, h) {
  const el = document.createElement('div');
  el.className = cls;
  if (x !== undefined) place(el, x, y, w, h);
  parent?.appendChild(el);
  return el;
}
export function label(text, parent, x, y, center = false) {
  const el = div(`mc-label${center ? ' center' : ''}`, parent, x, y);
  el.textContent = text;
  return el;
}
function image(src, parent, x, y, w, h, cls = 'mc-img') {
  const el = document.createElement('img');
  el.className = cls;
  el.alt = '';
  el.src = src;
  el.draggable = false;
  place(el, x, y, w, h);
  parent.appendChild(el);
  return el;
}
export function slotBox(parent, x, y, big = false) {
  const el = div(`mc-slot${big ? ' big' : ''}`, parent, x, y);
  el.innerHTML = '<img alt="" draggable="false"><b></b><i class="dur" hidden><i></i></i>';
  return el;
}

export function fillSlot(el, stack, count = stack?.count) {
  const img = el.firstChild, n = img.nextSibling, dur = n.nextSibling;
  if (!stack) {
    if (img.getAttribute('src')) img.removeAttribute('src');
    img.hidden = true;
    n.textContent = '';
    dur.hidden = true;
    return;
  }
  const src = iconFor(stack.id);
  if (img.getAttribute('src') !== src) img.src = src;
  img.hidden = false;
  n.textContent = count > 1 ? count : count === 0 ? '0' : '';
  n.classList.toggle('warn', count === 0);
  const def = itemDef(stack.id);
  if (def?.durability && stack.dmg) {
    const f = Math.max(0, 1 - stack.dmg / def.durability);
    dur.hidden = false;
    dur.firstChild.style.width = `${Math.round(f * 13) / 13 * 100}%`;
    dur.firstChild.style.background = `hsl(${Math.round(f * 120)}, 100%, 50%)`;
  } else dur.hidden = true;
}

const escape = (s) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const fmt = (n) => (Number.isInteger(n) ? String(n) : n.toFixed(1));
const ARMOR_WHERE = ['When on Head:', 'When on Body:', 'When on Legs:', 'When on Feet:'];

// Tooltip lines for an item: name, then combat and armor stats like the original shows them.
export function tooltipLines(stack) {
  const d = itemDef(stack.id);
  const lines = [`<b>${escape(d.label)}</b>`];
  if (d.tool || d.weapon) {
    lines.push('', '<span class="t-gray">When in Main Hand:</span>',
      `<span class="t-green"> ${fmt(attackDamage(d.id))} Attack Damage</span>`, `<span class="t-green"> ${fmt(attackSpeed(d.id))} Attack Speed</span>`);
  } else if (d.armor) {
    lines.push('', `<span class="t-gray">${ARMOR_WHERE[d.armor.slot]}</span>`, `<span class="t-blue">+${d.armor.points} Armor</span>`);
    if (d.armor.toughness) lines.push(`<span class="t-blue">+${d.armor.toughness} Armor Toughness</span>`);
  } else if (d.food) {
    lines.push(`<span class="t-gray">Restores ${d.food / 2} hunger</span>`);
  }
  if (d.durability && stack.dmg) lines.push(`<span class="t-gray">Durability: ${d.durability - stack.dmg} / ${d.durability}</span>`);
  return lines;
}

function ingredientName(ing) {
  if (ing.name[0] !== '#') return itemLabel(ing.ids[0]);
  const g = ing.name.slice(1);
  return { planks: 'any Planks', logs: 'any Log', wool: 'any Wool', coals: 'Coal or Charcoal' }[g] ?? `any ${g}`;
}

function recipeTooltip(r, ok, size) {
  const need = new Map();
  for (const { ing } of layout(r, Math.max(size, 3))) need.set(ing, (need.get(ing) ?? 0) + 1);
  const parts = [...need].map(([ing, n]) => `${n} × ${escape(ingredientName(ing))}`);
  const lines = [`<b>${escape(itemLabel(r.out))}${r.count > 1 ? ` × ${r.count}` : ''}</b>`, `<span class="t-gray">${parts.join(', ')}</span>`];
  if (!ok) lines.push('<span class="t-red">Missing ingredients</span>');
  return lines;
}

// ---------------------------------------------------------------- the screen
export class ContainerGUI {
  constructor(game) {
    this.game = game;
    this.screen = $('screen-container');
    this.wrap = $('mc-wrap');
    this.win = $('mc-win');
    this.bookEl = $('mc-book');
    this.cursorEl = $('mc-cursor');
    this.tipEl = $('mc-tip');
    this.preview = new PlayerPreview(() => this.game.renderer?.skinPixels ?? null);
    this.menu = null;
    this.kind = null;
    this.slotEls = new Map();
    this.drag = null;
    this.press = null;
    this.hover = null;
    this.lastClick = { t: 0, slot: null, button: 0 };
    this.pointer = { x: -1, y: -1 };
    this.tab = 'building';
    this.search = '';
    this.book = { open: game.settings.recipeBook ?? true, tab: 'all', craftable: false, page: 0, search: '' };
    this.bookButtons = [];
    this.buildBook();
    this.bindEvents();
    window.addEventListener('resize', () => { if (this.menu) this.fit(); });
  }

  get open() { return !!this.menu; }

  // Shows a menu. For the creative menu, `tab` picks the palette tab (or the survival inventory).
  show(menu) {
    this.screen.style.setProperty('--window', `url(${sprites().window})`);
    this.menu = menu;
    this.drag = null;
    this.press = null;
    this.hover = null;
    this.book.page = 0;
    this.build();
    this.screen.hidden = false;
    this.fit();
    this.render();
  }

  hide() {
    this.menu = null;
    this.screen.hidden = true;
    this.cursorEl.hidden = true;
    this.tipEl.hidden = true;
    this.drag = null;
    clearTimeout(this.press?.timer);
    this.press = null;
  }

  get bookAllowed() { return this.menu && (this.kind === 'crafting' || (this.kind === 'inventory' && !this.game.creative)); }
  // Creative players get tabs over their inventory: the item palette or the survival inventory.
  get tabbed() { return this.menu && this.game.creative && (this.menu.kind === 'creative' || this.menu.kind === 'inventory'); }
  get bookShown() { return this.bookAllowed && this.book.open; }

  // Picks the GUI scale: as big as fits (whole CSS pixels where possible), with the recipe book
  // beside the window when there's room and underneath it otherwise.
  fit() {
    const [w, h0] = SIZES[this.kind];
    const h = h0 + (this.tabbed ? 28 : 0);
    const vw = window.innerWidth - 20, vh = window.innerHeight - 20;
    const book = this.bookShown;
    let u = Math.min(vw / (w + (book ? 151 : 0)), vh / h), stacked = false;
    if (book) {
      const u2 = Math.min(vw / Math.max(w, 147), vh / (h + 170));
      if (u2 > u * 1.2) { u = u2; stacked = true; }
    }
    // As big as the GUI Scale option says, or smaller if that doesn't fit.
    const dpr = window.devicePixelRatio || 1;
    u = Math.min(this.game.ui.u, u);
    u = u >= 1 ? Math.floor(u * dpr + 1e-6) / dpr : Math.max(0.5, Math.floor(u * dpr * 4) / (dpr * 4));
    this.u = u;
    this.screen.style.setProperty('--u', `${u}px`);
    this.wrap.classList.toggle('stacked', stacked);
    this.bookEl.hidden = !book;
    this.sizePreview();
  }

  // ---------------------------------------------------------------- building windows
  build() {
    const m = this.menu, win = this.win;
    win.replaceChildren();
    this.slotEls.clear();
    this.previewCanvas = null;
    this.flameEl = null;
    this.cookEl = null;
    this.paletteEl = null;
    this.kind = m.kind === 'creative' ? (this.tab === 'inventory' ? 'inventory' : 'creative') : m.kind;
    const [w, h] = SIZES[this.kind];
    place(win, 0, 0, w, h);
    win.style.position = 'relative';
    win.style.left = win.style.top = '';
    win.classList.toggle('creative', this.tabbed);
    const slot = (s, x, y, big) => {
      const el = slotBox(win, x, y, big);
      el.dataset.s = s.index;
      this.slotEls.set(s.index, el);
      return el;
    };
    const player = (y0, yHot) => {
      m.storage.forEach((s, k) => slot(s, 7 + (k % 9) * 18, y0 + Math.floor(k / 9) * 18));
      m.hotbar.forEach((s, k) => slot(s, 7 + k * 18, yHot));
    };
    if (this.tabbed) this.buildTabs();
    const S = sprites();
    if (this.kind === 'inventory') {
      m.armorSlots.forEach((s, k) => {
        const el = slot(s, 7, 7 + k * 18);
        el.classList.add('hint');
        el.style.setProperty('--hint', `url(${S.hints[k]})`);
      });
      const box = div('mc-preview', win, 25, 7, 51, 72);
      this.previewCanvas = document.createElement('canvas');
      box.appendChild(this.previewCanvas);
      label('Crafting', win, 97, 6);
      m.gridSlots.forEach((s, k) => slot(s, 97 + (k % 2) * 18, 17 + Math.floor(k / 2) * 18));
      image(S.arrowSmall, win, 135, 29, 16, 13);
      slot(m.resultSlot, 153, 27);
      if (this.bookAllowed) this.bookButton(104, 61);
      if (this.tabbed) this.trashSlot(152, 61);
      player(83, 141);
    } else if (this.kind === 'crafting') {
      label('Crafting', win, 28, 6);
      m.gridSlots.forEach((s, k) => slot(s, 29 + (k % 3) * 18, 16 + Math.floor(k / 3) * 18));
      image(S.arrow, win, 89, 35, 22, 15);
      slot(m.resultSlot, 119, 30, true);
      if (this.bookAllowed) this.bookButton(5, 34);
      label('Inventory', win, 8, 72);
      player(83, 141);
    } else if (this.kind === 'furnace') {
      label({ smoker: 'Smoker', blast_furnace: 'Blast Furnace' }[m.furnace?.kind] ?? 'Furnace', win, 88, 6, true);
      slot(m.inputSlot, 55, 16);
      const flame = div('mc-flame', win, 56, 36, 14, 14);
      flame.style.backgroundImage = `url(${S.flame})`;
      this.flameEl = div('mc-flame-fill', flame);
      this.flameEl.style.backgroundImage = `url(${S.flameFull})`;
      slot(m.fuelSlot, 55, 52);
      const cook = div('mc-cook', win, 79, 34, 24, 17);
      cook.style.backgroundImage = `url(${S.cook})`;
      this.cookEl = div('mc-cook-fill', cook);
      this.cookEl.style.backgroundImage = `url(${S.cookFull})`;
      slot(m.outputSlot, 111, 30, true);
      label('Inventory', win, 8, 72);
      player(83, 141);
    } else if (this.kind === 'chest' || this.kind === 'large_chest') {
      const rows = m.chestSlots.length / 9, y0 = (rows - 3) * 18;
      label(m.title ?? (rows > 3 ? 'Large Chest' : 'Chest'), win, 8, 6);
      m.chestSlots.forEach((s, k) => slot(s, 7 + (k % 9) * 18, 17 + Math.floor(k / 9) * 18));
      label('Inventory', win, 8, 74 + y0);
      player(84 + y0, 142 + y0);
    } else if (this.kind === 'creative') {
      const tab = TABS.find((t) => t.id === this.tab);
      label(tab.label, win, 8, 6);
      if (this.tab === 'search') {
        const input = document.createElement('input');
        input.type = 'search';
        input.className = 'mc-search';
        input.placeholder = 'Search...';
        input.value = this.search;
        input.spellcheck = false;
        input.autocomplete = 'off';
        place(input, 88, 4, 98, 12);
        input.addEventListener('input', () => { this.search = input.value.trim().toLowerCase(); this.buildPalette(); });
        input.addEventListener('keydown', (e) => this.searchKey(e));
        win.appendChild(input);
        if (matchMedia('(pointer: fine)').matches) setTimeout(() => input.focus({ preventScroll: true }), 0);
      }
      this.paletteEl = div('mc-palette', win, 8, 17, 180, 90);
      this.buildPalette();
      m.hotbar.forEach((s, k) => slot(s, 8 + k * 18, 111));
      this.trashSlot(173, 111);
    }
  }

  buildTabs() {
    const bar = div('mc-tabs', this.win, 0, -28, SIZES[this.kind][0], 28);
    TABS.forEach((t, i) => {
      const el = div(`mc-tab${t.id === this.tab ? ' on' : ''}`, bar, i * 24 + (i > 5 ? 3 : 0), 0, 24, 30);
      el.dataset.act = 'tab';
      el.dataset.tab = t.id;
      el.dataset.tip = t.label;
      image(iconFor(I[t.icon]), el, 4, 7, 16, 16);
    });
  }

  buildPalette() {
    if (!this.paletteEl) return;
    let ids = PALETTE;
    if (this.tab === 'search') ids = this.search ? ids.filter((id) => itemLabel(id).toLowerCase().includes(this.search)) : ids;
    else ids = ids.filter((id) => creativeTab(id) === this.tab);
    const frag = document.createDocumentFragment();
    ids.forEach((id, k) => {
      const el = slotBox(null, (k % 9) * 18, Math.floor(k / 9) * 18);
      el.dataset.item = id;
      fillSlot(el, { id, count: 1 });
      frag.appendChild(el);
    });
    this.paletteEl.replaceChildren(frag);
    this.paletteEl.style.setProperty('--rows', Math.ceil(ids.length / 9));
  }

  trashSlot(x, y) {
    const el = slotBox(this.win, x, y);
    el.classList.add('mc-trash', 'hint');
    el.style.setProperty('--hint', `url(${sprites().trash})`);
    el.dataset.tip = 'Destroy Item';
  }

  bookButton(x, y) {
    const el = div('mc-bookbtn', this.win, x, y, 20, 18);
    el.dataset.act = 'book';
    el.dataset.tip = 'Recipe Book';
    image(sprites().book, el, 2, 1, 16, 16);
  }

  // ---------------------------------------------------------------- recipe book
  buildBook() {
    const b = this.bookEl;
    b.replaceChildren();
    place(b, 0, 0, 147, 166);
    BOOK_TABS.forEach((t, i) => {
      const el = div('mc-booktab', b, 8 + i * 24, 6, 22, 20);
      el.dataset.act = 'book-tab';
      el.dataset.tab = t.id;
      el.dataset.tip = t.label;
      image(iconFor(I[t.icon]), el, 3, 2, 16, 16);
    });
    const toggle = div('mc-toggle', b, 110, 7, 29, 18);
    toggle.dataset.act = 'craftable';
    this.toggleEl = toggle;
    const input = document.createElement('input');
    input.type = 'search';
    input.className = 'mc-search';
    input.placeholder = 'Search...';
    input.spellcheck = false;
    input.autocomplete = 'off';
    place(input, 8, 29, 131, 12);
    input.addEventListener('input', () => { this.book.search = input.value.trim().toLowerCase(); this.book.page = 0; this.renderBook(); });
    input.addEventListener('keydown', (e) => this.searchKey(e));
    b.appendChild(input);
    this.bookSearch = input;
    const grid = div('mc-bookgrid', b, 11, 45, 125, 100);
    for (let k = 0; k < 20; k++) {
      const el = div('mc-recipe', grid, (k % 5) * 25, Math.floor(k / 5) * 25, 25, 25);
      el.dataset.act = 'recipe';
      el.innerHTML = '<img alt="" draggable="false"><b></b>';
      this.bookButtons.push(el);
    }
    const prev = div('mc-page prev', b, 38, 148, 12, 17);
    prev.dataset.act = 'page';
    prev.dataset.d = '-1';
    const next = div('mc-page next', b, 97, 148, 12, 17);
    next.dataset.act = 'page';
    next.dataset.d = '1';
    this.pageEl = div('mc-pagenum', b, 50, 151, 47, 10);
  }

  bookRecipes() {
    const m = this.menu, size = m.size;
    const counts = countItems(this.game.inv.slots, m.grid);
    const q = this.book.search;
    let rows = RECIPES.filter((r) => recipeFits(r, size) && (this.book.tab === 'all' || r.category === this.book.tab) &&
      (!q || itemLabel(r.out).toLowerCase().includes(q)))
      .map((r) => ({ r, ok: !!planRecipe(r, counts, size, 1) }));
    if (this.book.craftable) rows = rows.filter((x) => x.ok);
    return rows.sort((a, b) => b.ok - a.ok || a.r.index - b.r.index);
  }

  renderBook() {
    if (!this.bookShown) return;
    const rows = this.bookRecipes();
    const pages = Math.max(1, Math.ceil(rows.length / 20));
    this.book.page = Math.max(0, Math.min(pages - 1, this.book.page));
    const start = this.book.page * 20;
    this.bookButtons.forEach((el, k) => {
      const row = rows[start + k];
      el.hidden = !row;
      if (!row) return;
      el.dataset.recipe = row.r.index;
      el.classList.toggle('no', !row.ok);
      el.classList.toggle('ghost', this.menu.ghost === row.r);
      const img = el.firstChild, src = iconFor(row.r.out);
      if (img.getAttribute('src') !== src) img.src = src;
      el.lastChild.textContent = row.r.count > 1 ? row.r.count : '';
    });
    this.pageEl.textContent = pages > 1 ? `${this.book.page + 1}/${pages}` : '';
    this.bookEl.querySelector('.prev').hidden = this.book.page === 0;
    this.bookEl.querySelector('.next').hidden = this.book.page >= pages - 1;
    for (const el of this.bookEl.querySelectorAll('.mc-booktab')) el.classList.toggle('on', el.dataset.tab === this.book.tab);
    this.toggleEl.classList.toggle('on', this.book.craftable);
    this.toggleEl.dataset.tip = this.book.craftable ? 'Showing Craftable' : 'Showing All';
    if (rows.length === 0 && !this.bookEl.querySelector('.mc-empty')) {
      const e = div('mc-empty mc-label center', this.bookEl, 73, 90);
      e.textContent = this.book.craftable ? 'Nothing you can craft yet' : 'No recipes found';
    } else if (rows.length) this.bookEl.querySelector('.mc-empty')?.remove();
  }

  // ---------------------------------------------------------------- drawing
  render() {
    const m = this.menu;
    if (!m) return;
    const drag = this.drag && this.drag.list.length > 1 ? m.dragResult(this.drag.list, this.drag.button) : null;
    for (const [i, el] of this.slotEls) {
      const s = m.slots[i];
      let stack = s.stack;
      const dragged = drag?.result.has(s);
      if (dragged) stack = { ...m.cursor, count: drag.result.get(s) };
      fillSlot(el, stack);
      el.classList.toggle('dragged', !!dragged);
      el.classList.toggle('filled', !!stack);
    }
    this.renderGhost();
    const c = m.cursor;
    if (c) {
      if (!this.cursorEl.firstChild) this.cursorEl.innerHTML = '<div class="mc-slot bare"><img alt=""><b></b><i class="dur" hidden><i></i></i></div>';
      fillSlot(this.cursorEl.firstChild, c, drag ? drag.left : c.count);
      this.cursorEl.hidden = false;
    } else this.cursorEl.hidden = true;
    this.renderBook();
    this.frame(0);
    this.updateTip();
  }

  // A recipe picked from the book but not craftable shows faintly in the grid.
  renderGhost() {
    const m = this.menu;
    for (const el of this.win.querySelectorAll('.mc-ghost')) el.remove();
    if (!m.ghost) return;
    const t = Math.floor(performance.now() / 1000);
    for (const { cell, ing } of layout(m.ghost, m.size)) {
      const s = m.gridSlots[cell], el = this.slotEls.get(s.index);
      if (s.stack) continue;
      const g = document.createElement('img');
      g.className = 'mc-ghost';
      g.alt = '';
      g.src = iconFor(ing.ids[t % ing.ids.length]);
      el.appendChild(g);
    }
    if (!m.result[0]) {
      const el = this.slotEls.get(m.resultSlot.index), g = document.createElement('img');
      g.className = 'mc-ghost';
      g.alt = '';
      g.src = iconFor(m.ghost.out);
      el.appendChild(g);
    }
  }

  // Per frame: furnace progress, the character preview and cycling ghost items.
  frame() {
    const m = this.menu;
    if (!m) return;
    if (m.kind === 'furnace' && this.flameEl) {
      const f = m.furnace;
      const flame = f.burn > 0 ? Math.max(1, Math.ceil((f.burn / Math.max(1, f.burnMax)) * 13)) + 1 : 0;
      const cook = Math.ceil((f.cook / COOK_TIME) * 24);
      if (flame !== this.lastFlame) { this.lastFlame = flame; this.flameEl.style.height = px(flame); }
      if (cook !== this.lastCook) { this.lastCook = cook; this.cookEl.style.width = px(cook); }
    }
    if (this.previewCanvas) this.drawPreview();
    if (m.ghost) {
      const t = Math.floor(performance.now() / 1000);
      if (t !== this.ghostTick) { this.ghostTick = t; this.renderGhost(); }
    }
  }

  sizePreview() {
    const cv = this.previewCanvas;
    if (!cv) return;
    const dpr = window.devicePixelRatio || 1;
    cv.width = Math.round(49 * this.u * dpr);
    cv.height = Math.round(70 * this.u * dpr);
    this.drawPreview(true);
  }

  drawPreview(force = false) {
    const cv = this.previewCanvas;
    if (!cv || !cv.width) return;
    const r = cv.getBoundingClientRect();
    if (!r.width) return;
    // Mouse position relative to the eyes (about a sixth of the way down the box), in model units.
    const unit = r.height / 70 * (70 * 0.84 / 32);
    const eyeX = r.left + r.width / 2, eyeY = r.top + r.height * (0.5 - (12 / 32) * 0.84);
    const look = this.pointer.x < 0 ? { x: 0, y: 0 } : { x: (this.pointer.x - eyeX) / unit, y: (eyeY - this.pointer.y) / unit };
    const armor = this.game.inv.armor.map((s) => (s ? itemDef(s.id).armor.material : null));
    const hurt = this.game.hurtTime > 0.25;
    const skin = this.game.skinName;
    const key = `${look.x.toFixed(1)},${look.y.toFixed(1)},${skin},${armor.join()},${hurt},${Math.floor(performance.now() / 50)}`;
    if (key === this.previewKey && !force) return;
    this.previewKey = key;
    this.preview.draw(cv, { look, skin, armor, time: performance.now() / 1000, hurt });
  }

  updateTip() {
    const tip = this.tipEl, el = this.hover;
    let lines = null;
    if (el && !this.menu.cursor) {
      if (el.dataset.s !== undefined) {
        const st = this.menu.slots[Number(el.dataset.s)].stack;
        if (st) lines = tooltipLines(st);
      } else if (el.dataset.item) lines = tooltipLines({ id: Number(el.dataset.item), count: 1 });
      else if (el.dataset.recipe) {
        const r = RECIPES[Number(el.dataset.recipe)];
        lines = recipeTooltip(r, !el.classList.contains('no'), this.menu.size);
      } else if (el.dataset.tip) lines = [escape(el.dataset.tip)];
    }
    if (!lines) { tip.hidden = true; return; }
    const html = lines.join('<br>');
    if (html !== this.tipHTML) { this.tipHTML = html; tip.innerHTML = html; }
    tip.hidden = false;
    const w = tip.offsetWidth, h = tip.offsetHeight;
    let x = this.pointer.x + 14, y = this.pointer.y - 16;
    if (x + w > window.innerWidth - 4) x = Math.max(4, this.pointer.x - 14 - w);
    y = Math.max(4, Math.min(window.innerHeight - h - 4, y));
    tip.style.left = `${x}px`;
    tip.style.top = `${y}px`;
  }

  // ---------------------------------------------------------------- input
  // Esc in a search box closes the screen; Enter just leaves the box.
  searchKey(e) {
    if (e.key === 'Escape') { e.preventDefault(); e.target.blur(); this.game.closeMenu(); }
    else if (e.key === 'Enter') e.target.blur();
  }

  bindEvents() {
    const scr = this.screen;
    scr.addEventListener('contextmenu', (e) => e.preventDefault());
    scr.addEventListener('pointerdown', (e) => this.pointerDown(e));
    window.addEventListener('pointermove', (e) => this.pointerMove(e));
    window.addEventListener('pointerup', (e) => this.pointerUp(e));
    window.addEventListener('pointercancel', () => { this.drag = null; clearTimeout(this.press?.timer); this.press = null; if (this.menu) this.render(); });
    scr.addEventListener('pointerleave', () => { this.hover = null; this.tipEl.hidden = true; });
  }

  slotAt(x, y) {
    const el = document.elementFromPoint(x, y)?.closest?.('.mc-slot[data-s]');
    return el && this.win.contains(el) ? this.menu.slots[Number(el.dataset.s)] : null;
  }

  pointerDown(e) {
    if (!this.menu) return;
    const t = e.target;
    this.pointer.x = e.clientX;
    this.pointer.y = e.clientY;
    if (t.closest('input')) return;
    e.preventDefault();
    document.activeElement?.blur?.();
    const button = e.button === 2 ? 2 : e.button === 1 ? 1 : 0;
    const act = t.closest('[data-act]');
    if (act) { this.button(act, e.shiftKey); return; }
    const slotEl = t.closest('.mc-slot[data-s]');
    if (slotEl) { this.slotDown(this.menu.slots[Number(slotEl.dataset.s)], button, e); return; }
    const pal = t.closest('.mc-slot[data-item]');
    if (pal) { this.game.paletteClick(Number(pal.dataset.item), button, e.shiftKey); return; }
    if (t.closest('.mc-trash')) { this.game.menuAction('trash', null, button, e.shiftKey); return; }
    if (!t.closest('.mc-panel, .mc-tabs')) this.game.menuAction('outside', null, button);
  }

  slotDown(slot, button, e) {
    const m = this.menu, now = performance.now();
    if (e.pointerType === 'touch') {
      // Touch: tap = left click, hold = right click, drag a held stack across slots to spread it.
      this.press = { slot, pointerId: e.pointerId, timer: setTimeout(() => this.longPress(), 380), moved: false };
      if (m.cursor) this.drag = { button: 0, list: [slot], touch: true };
      return;
    }
    if (e.shiftKey && button !== 1) { this.game.menuAction('quick', slot, button); return; }
    // Double-click: picking a stack up and clicking its (now empty) slot again gathers every
    // matching item onto the cursor.
    const last = this.lastClick;
    this.lastClick = { t: now, slot, button };
    if (button === 0 && m.cursor && !slot.stack && last.slot === slot && last.button === 0 && now - last.t < 300) {
      this.lastClick.t = 0;
      this.game.menuAction('collect', slot, 0);
      return;
    }
    if (button === 1) {
      if (this.game.creative && slot.stack && !m.cursor) this.game.menuAction('clone', slot, 1);
      else if (this.game.creative && m.cursor) this.drag = { button: 1, list: [slot] };
      return;
    }
    if (!m.cursor) { this.game.menuAction('click', slot, button); return; }
    this.drag = { button, list: [slot] };
  }

  longPress() {
    const p = this.press;
    if (!p || p.moved) return;
    p.done = true;
    this.drag = null;
    this.game.menuAction('click', p.slot, 2);
  }

  pointerMove(e) {
    if (!this.menu) return;
    this.pointer.x = e.clientX;
    this.pointer.y = e.clientY;
    const cur = this.cursorEl;
    cur.style.left = `${e.clientX}px`;
    cur.style.top = `${e.clientY}px`;
    const target = e.pointerType === 'touch' ? document.elementFromPoint(e.clientX, e.clientY) : e.target;
    const hov = target?.closest?.('.mc-slot, [data-recipe], [data-tip]') ?? null;
    if (hov !== this.hover) this.hover = hov && this.screen.contains(hov) ? hov : null;
    if (this.press) {
      const s = this.slotAt(e.clientX, e.clientY);
      if (s !== this.press.slot) { this.press.moved = true; clearTimeout(this.press.timer); }
    }
    if (this.drag) {
      const s = this.slotAt(e.clientX, e.clientY);
      if (s && this.menu.canDrag(s, this.drag.list, this.drag.button)) {
        this.drag.list.push(s);
        this.render();
        return;
      }
    }
    this.updateTip();
    if (this.previewCanvas) this.drawPreview();
  }

  pointerUp(e) {
    if (!this.menu) return;
    const p = this.press;
    if (p && p.pointerId === e.pointerId) {
      clearTimeout(p.timer);
      this.press = null;
      if (p.done) return;
      if (this.drag && this.drag.list.length > 1) { const d = this.drag; this.drag = null; this.game.menuAction('drag', d.list, d.button); return; }
      this.drag = null;
      if (!p.moved) this.game.menuAction('click', p.slot, 0);
      else this.render();
      return;
    }
    if (!this.drag) return;
    const d = this.drag;
    this.drag = null;
    if (d.list.length > 1) this.game.menuAction('drag', d.list, d.button);
    else if (d.button !== 1) this.game.menuAction('click', d.list[0], d.button);
    else this.render();
  }

  button(el, shift) {
    const act = el.dataset.act;
    if (act === 'tab') {
      this.tab = el.dataset.tab;
      this.game.creativeTab(this.tab);
    } else if (act === 'book') {
      this.book.open = !this.book.open;
      this.game.settings.recipeBook = this.book.open;
      this.game.saveSettings();
      this.fit();
      this.render();
    } else if (act === 'book-tab') {
      this.book.tab = el.dataset.tab;
      this.book.page = 0;
      this.renderBook();
    } else if (act === 'craftable') {
      this.book.craftable = !this.book.craftable;
      this.book.page = 0;
      this.renderBook();
    } else if (act === 'page') {
      this.book.page += Number(el.dataset.d);
      this.renderBook();
    } else if (act === 'recipe') {
      this.game.menuAction('recipe', RECIPES[Number(el.dataset.recipe)], shift ? 1 : 0);
    }
    this.game.audio.click();
  }

  // The slot under the mouse, for number keys and Q.
  get hoverSlot() {
    const el = this.hover;
    return el?.dataset.s !== undefined && this.win.contains(el) ? this.menu.slots[Number(el.dataset.s)] : null;
  }
  get hoverItem() { return this.hover?.dataset.item ? Number(this.hover.dataset.item) : null; }
}
