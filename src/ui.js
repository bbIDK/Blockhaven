// DOM side of the game: screens, HUD, inventory and settings. Game logic lives in game.js;
// this module renders state and reports user actions through on()/emit().
import { iconFor } from './icons.js';
import { itemDef } from './items.js';

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
      this.onButton?.();
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
    $('hunger').innerHTML = '<i></i>'.repeat(10);
    $('armor').innerHTML = '<i></i>'.repeat(10);
    this.lastFood = -1;
    this.lastArmor = -1;
    this.lastMeter = -1;

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
    const v = f < 0 ? -1 : Math.round(f * 24);
    if (v === this.lastMeter) return;
    this.lastMeter = v;
    const el = $('attack-meter');
    el.hidden = v < 0;
    if (v >= 0) el.firstChild.style.width = `${(v / 24) * 100}%`;
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

  setSleeping(on) { $('overlay-sleep').classList.toggle('on', on); }

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
      res: (v) => (v ? `${40 + v * 10}%` : 'Auto'),
    };
    const map = { rd: 'renderDistance', res: 'resolution', fov: 'fov', sens: 'sensitivity', bright: 'brightness', vol: 'volume', music: 'music' };
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
