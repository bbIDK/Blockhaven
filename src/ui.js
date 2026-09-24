// DOM side of the game: screens, HUD, inventory and settings. Game logic lives in game.js;
// this module renders state and reports user actions through on()/emit().
import { iconFor } from './icons.js';
import { itemDef, itemLabel, RECIPES, GROUPS } from './items.js';

export const $ = (id) => document.getElementById(id);

function sprite(rows, colors) {
  const c = document.createElement('canvas');
  c.width = rows[0].length;
  c.height = rows.length;
  const g = c.getContext('2d');
  rows.forEach((row, y) => [...row].forEach((ch, x) => {
    if (colors[ch]) { g.fillStyle = colors[ch]; g.fillRect(x, y, 1, 1); }
  }));
  return c.toDataURL();
}
const HEART = ['.kk...kk.', 'khrk.krrk', 'krrrkrrrk', 'krrrrrrrk', '.krrrrrk.', '..krrrk..', '...krk...', '....k....', '.........'];
const HALF = ['.kk...kk.', 'khrk.keek', 'krrrkeeek', 'krrrreeek', '.krrreek.', '..krrek..', '...kek...', '....k....', '.........'];
const BUBBLE = ['..kkkkk..', '.kbbbbbk.', 'kbwbbbbbk', 'kbwbbbbbk', 'kbbbbbbbk', 'kbbbbbbbk', 'kbbbbbbbk', '.kbbbbbk.', '..kkkkk..'];
const SPRITES = {
  heart: sprite(HEART, { k: '#1a0606', r: '#d9261c', h: '#ff9c8c' }),
  half: sprite(HALF, { k: '#1a0606', r: '#d9261c', h: '#ff9c8c', e: '#3a1512' }),
  empty: sprite(HEART.map((r) => r.replace(/[rh]/g, 'e')), { k: '#1a0606', e: '#3a1512' }),
  bubble: sprite(BUBBLE, { k: '#0b2c5c', b: '#4fa3ff', w: '#e8f4ff' }),
};

function slotEl(tag = 'div') {
  const el = document.createElement(tag);
  el.className = 'slot';
  el.innerHTML = '<img alt=""><span class="count"></span><span class="dur" hidden><i></i></span>';
  return el;
}

function fillSlot(el, stack, showCount = true) {
  const img = el.firstChild, count = el.children[1], dur = el.children[2];
  if (!stack) {
    img.removeAttribute('src');
    img.style.visibility = 'hidden';
    count.textContent = '';
    dur.hidden = true;
    el.title = '';
    return;
  }
  const src = iconFor(stack.id);
  if (img.getAttribute('src') !== src) img.src = src;
  img.style.visibility = '';
  count.textContent = showCount && stack.count > 1 ? stack.count : '';
  const def = itemDef(stack.id);
  if (def?.durability && stack.dmg) {
    const f = Math.max(0, 1 - stack.dmg / def.durability);
    dur.hidden = false;
    dur.firstChild.style.width = `${f * 100}%`;
    dur.firstChild.style.background = `hsl(${Math.round(f * 110)}, 80%, 50%)`;
  } else dur.hidden = true;
}

export class UI {
  constructor() {
    this.handlers = {};
    this.screens = [...document.querySelectorAll('.screen')];
    this.current = null;
    this.hotbarEls = [];
    this.nameTimer = 0;
    this.lastHealth = -1;
    this.lastAir = -1;

    document.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-action]');
      if (!btn) return;
      const where = btn.closest('.screen, .modal');
      this.emit(btn.dataset.action, where?.id, btn);
    });

    const hotbar = $('hotbar');
    for (let i = 0; i < 9; i++) {
      const el = slotEl();
      el.addEventListener('pointerdown', (e) => { e.preventDefault(); this.emit('hotbar-tap', i); });
      hotbar.appendChild(el);
      this.hotbarEls.push(el);
    }
    $('hearts').innerHTML = '<i></i>'.repeat(10);
    $('bubbles').innerHTML = '<i></i>'.repeat(10);

    // Inventory grids
    this.storageEls = [];
    this.invHotbarEls = [];
    for (let i = 9; i < 36; i++) this.storageEls.push(this.bindSlot($('inv-storage'), i));
    for (let i = 0; i < 9; i++) this.invHotbarEls.push(this.bindSlot($('inv-hotbar'), i));
    this.paletteEls = [];
    this.chestEls = [];
    this.chestStorageEls = [];
    this.chestHotbarEls = [];
    const chestSlot = (parent, kind, index) => {
      const el = slotEl();
      el.dataset.slot = kind === 'player' ? index : '';
      el.dataset.chest = kind === 'chest' ? index : '';
      el.addEventListener('pointerdown', (e) => { e.preventDefault(); this.emit('chest-slot', kind, index, e.button, e.shiftKey); });
      parent.appendChild(el);
      return el;
    };
    for (let i = 0; i < 27; i++) this.chestEls.push(chestSlot($('chest-slots'), 'chest', i));
    for (let i = 9; i < 36; i++) this.chestStorageEls.push(chestSlot($('chest-storage'), 'player', i));
    for (let i = 0; i < 9; i++) this.chestHotbarEls.push(chestSlot($('chest-hotbar'), 'player', i));
    const chest = $('screen-chest');
    chest.addEventListener('pointermove', (e) => this.moveCursor(e.clientX, e.clientY, e.target));
    chest.addEventListener('contextmenu', (e) => e.preventDefault());
    $('inv-search').addEventListener('input', () => this.emit('search', $('inv-search').value));
    $('inv-palette').addEventListener('pointerdown', (e) => {
      const el = e.target.closest('.slot');
      e.preventDefault();
      this.emit('palette', el ? Number(el.dataset.item) : null, e.button, e.shiftKey);
    });
    $('recipe-list').addEventListener('click', (e) => {
      const el = e.target.closest('.recipe');
      if (el) this.emit('craft', Number(el.dataset.recipe), e.shiftKey);
    });
    const inv = $('screen-inventory');
    inv.addEventListener('pointermove', (e) => this.moveCursor(e.clientX, e.clientY, e.target));
    inv.addEventListener('contextmenu', (e) => e.preventDefault());
    inv.addEventListener('pointerdown', (e) => {
      if (e.target === inv) this.emit('inventory-outside');
    });

    $('create-form').addEventListener('submit', (e) => { e.preventDefault(); this.emit('create-world'); });
    $('chat-input').addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); this.emit('chat-send', $('chat-input').value); }
      else if (e.key === 'Escape') { e.preventDefault(); this.emit('chat-close'); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); this.emit('chat-history', -1); }
      else if (e.key === 'ArrowDown') { e.preventDefault(); this.emit('chat-history', 1); }
      e.stopPropagation();
    });
  }

  on(name, fn) { this.handlers[name] = fn; }
  emit(name, ...args) { this.handlers[name]?.(...args); }

  show(id) {
    for (const s of this.screens) s.hidden = s.id !== id;
    this.current = id;
    const first = id && $(id)?.querySelector('.btn.primary, input[type=text]');
    if (first && matchMedia('(pointer: fine)').matches) setTimeout(() => first.focus({ preventScroll: true }), 0);
  }

  bindSlot(parent, index) {
    const el = slotEl();
    el.dataset.slot = index;
    el.addEventListener('pointerdown', (e) => { e.preventDefault(); this.emit('slot', index, e.button, e.shiftKey); });
    parent.appendChild(el);
    return el;
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

  renderHotbar(inv, creative) {
    for (let i = 0; i < 9; i++) {
      fillSlot(this.hotbarEls[i], inv.slots[i], !creative);
      this.hotbarEls[i].classList.toggle('sel', i === inv.selected);
    }
  }

  showItemName(text) {
    const el = $('item-name');
    el.textContent = text;
    el.classList.add('show');
    clearTimeout(this.nameTimer);
    this.nameTimer = setTimeout(() => el.classList.remove('show'), 1500);
  }

  renderStats(survival, health, air, underwater) {
    $('stats').style.visibility = survival ? 'visible' : 'hidden';
    if (!survival) return;
    if (health !== this.lastHealth) {
      this.lastHealth = health;
      [...$('hearts').children].forEach((el, i) => {
        const v = health - i * 2;
        el.style.backgroundImage = `url(${v >= 2 ? SPRITES.heart : v === 1 ? SPRITES.half : SPRITES.empty})`;
      });
    }
    const bubbles = underwater || air < 300 ? Math.ceil((air / 300) * 10) : -1;
    if (bubbles !== this.lastAir) {
      this.lastAir = bubbles;
      [...$('bubbles').children].forEach((el, i) => {
        el.style.backgroundImage = i < bubbles ? `url(${SPRITES.bubble})` : 'none';
      });
    }
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
    while (log.children.length > 12) log.firstChild.remove();
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

  // ---------------------------------------------------------------- inventory
  renderInventory(inv, { creative, palette, stations }) {
    $('inv-title').textContent = creative ? 'Creative inventory' : 'Inventory';
    document.querySelector('.panel.inv').classList.toggle('creative', creative);
    $('inv-search').hidden = !creative;
    $('inv-palette').hidden = !creative;
    $('inv-storage').hidden = creative;
    $('inv-craft').hidden = creative;
    if (creative) {
      const key = palette.join(',');
      if (key !== this.paletteKey) {
        this.paletteKey = key;
        const frag = document.createDocumentFragment();
        for (const id of palette) {
          const el = slotEl();
          el.dataset.item = id;
          fillSlot(el, { id, count: 1 }, false);
          frag.appendChild(el);
        }
        $('inv-palette').replaceChildren(frag);
      }
    } else {
      for (let i = 0; i < 27; i++) fillSlot(this.storageEls[i], inv.slots[i + 9]);
      this.renderRecipes(inv, stations);
    }
    for (let i = 0; i < 9; i++) {
      fillSlot(this.invHotbarEls[i], inv.slots[i], !creative);
      this.invHotbarEls[i].classList.toggle('sel', i === inv.selected);
    }
    const cur = $('cursor-item');
    if (inv.cursor) {
      if (!cur.firstChild) cur.appendChild(slotEl());
      fillSlot(cur.firstChild, inv.cursor, !creative);
      cur.hidden = false;
    } else cur.hidden = true;
  }

  renderChest(inv, slots) {
    for (let i = 0; i < 27; i++) fillSlot(this.chestEls[i], slots[i]);
    for (let i = 0; i < 27; i++) fillSlot(this.chestStorageEls[i], inv.slots[i + 9]);
    for (let i = 0; i < 9; i++) fillSlot(this.chestHotbarEls[i], inv.slots[i]);
    const cur = $('cursor-item');
    if (inv.cursor) {
      if (!cur.firstChild) cur.appendChild(slotEl());
      fillSlot(cur.firstChild, inv.cursor);
      cur.hidden = false;
    } else cur.hidden = true;
  }

  setSleeping(on) { $('overlay-sleep').classList.toggle('on', on); }

  hideCursor() {
    $('cursor-item').hidden = true;
    $('tooltip').hidden = true;
  }

  renderRecipes(inv, stations) {
    const has = (s) => stations.has(s);
    $('inv-stations').textContent = `Nearby: ${[has('table') && 'crafting table', has('furnace') && 'furnace'].filter(Boolean).join(', ') || 'nothing'} — stand within 4 blocks of a crafting table or furnace to use them.`;
    const rows = RECIPES.map((r, i) => ({ r, i, ok: inv.canCraft(r, stations), relevant: r.input.some((ing) => inv.countIngredient(ing) > 0) }));
    rows.sort((a, b) => (b.ok - a.ok) || (b.relevant - a.relevant) || a.i - b.i);
    const html = rows.map(({ r, i, ok }) => {
      const needs = r.input.map((ing) => {
        const id = ing.group ? GROUPS[ing.group][0] : ing.id;
        const have = inv.countIngredient(ing);
        const name = ing.group ? `any ${ing.group}` : itemLabel(id);
        return `<span class="${have >= ing.n ? '' : 'miss'}"><img src="${iconFor(id)}" alt="">${ing.n}× ${name}</span>`;
      }).join('');
      const where = r.station === 'table' ? ' · crafting table' : r.station === 'furnace' ? ' · furnace' : '';
      return `<li class="recipe ${ok ? 'ok' : 'no'}" data-recipe="${i}"><img src="${iconFor(r.out)}" alt="">` +
        `<b>${itemLabel(r.out)}${r.count > 1 ? ` ×${r.count}` : ''}<small class="stations">${where}</small></b><div class="needs">${needs}</div></li>`;
    }).join('');
    if (html !== this.recipeHTML) { this.recipeHTML = html; $('recipe-list').innerHTML = html; }
  }

  moveCursor(x, y, target) {
    const cur = $('cursor-item');
    cur.style.left = `${x}px`;
    cur.style.top = `${y}px`;
    const tip = $('tooltip');
    const slot = target?.closest?.('.slot');
    let id = null;
    if (slot?.dataset.item) id = Number(slot.dataset.item);
    else if (slot?.dataset.chest) id = this.chestItem?.(Number(slot.dataset.chest)) ?? null;
    else if (slot?.dataset.slot !== undefined && slot.dataset.slot !== '') id = this.slotItem?.(Number(slot.dataset.slot)) ?? null;
    if (id && $('cursor-item').hidden) {
      tip.textContent = itemLabel(id);
      tip.style.left = `${x + 16}px`;
      tip.style.top = `${y - 30}px`;
      tip.hidden = false;
    } else tip.hidden = true;
  }

  // ---------------------------------------------------------------- menus
  renderWorlds(worlds, persistent) {
    $('storage-note').hidden = persistent;
    $('world-empty').hidden = worlds.length > 0;
    const list = $('world-list');
    list.replaceChildren(...worlds.map((w) => {
      const li = document.createElement('li');
      li.className = 'world';
      const icon = document.createElement('img');
      icon.src = iconFor(w.type === 'flat' ? 3 : w.mode === 'creative' ? 41 : 2);
      icon.alt = '';
      const info = document.createElement('div');
      info.className = 'world-info';
      const name = document.createElement('b');
      name.textContent = w.name;
      const meta = document.createElement('span');
      meta.textContent = `${w.mode === 'creative' ? 'Creative' : 'Survival'}${w.type === 'flat' ? ' · Flat' : ''} · Seed ${w.seed} · ${timeAgo(w.lastPlayed)}`;
      info.append(name, meta);
      const play = document.createElement('button');
      play.className = 'btn small primary';
      play.textContent = 'Play';
      play.dataset.action = 'open-world';
      play.dataset.id = w.id;
      const del = document.createElement('button');
      del.className = 'btn small danger';
      del.textContent = 'Delete';
      del.dataset.action = 'delete-world';
      del.dataset.id = w.id;
      li.append(icon, info, play, del);
      return li;
    }));
  }

  confirm(text, okLabel) {
    return new Promise((resolve) => {
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

  bindSettings(settings, onChange) {
    const fmt = {
      rd: (v) => `${v} chunks`, fov: (v) => `${v}°`, sens: (v) => `${v}%`, bright: (v) => (v <= 0 ? 'Moody' : v >= 100 ? 'Bright' : `${v}%`),
      vol: (v) => (v ? `${v}%` : 'Off'), music: (v) => (v ? `${v}%` : 'Off'),
    };
    const map = { rd: 'renderDistance', fov: 'fov', sens: 'sensitivity', bright: 'brightness', vol: 'volume', music: 'music' };
    for (const [k, key] of Object.entries(map)) {
      const input = $(`s-${k}`), out = $(`o-${k}`);
      input.value = settings[key];
      out.textContent = fmt[k](settings[key]);
      input.addEventListener('input', () => {
        settings[key] = Number(input.value);
        out.textContent = fmt[k](settings[key]);
        onChange(key);
      });
    }
    const toggles = { bob: 'viewBobbing', clouds: 'clouds', invert: 'invertMouse', fps: 'showFps' };
    for (const [k, key] of Object.entries(toggles)) {
      const input = $(`s-${k}`);
      input.checked = !!settings[key];
      input.addEventListener('change', () => { settings[key] = input.checked; onChange(key); });
    }
  }
}

export function timeAgo(t) {
  if (!t) return 'never played';
  const s = (Date.now() - t) / 1000;
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
  const d = Math.floor(s / 86400);
  return d === 1 ? 'yesterday' : `${d} days ago`;
}
