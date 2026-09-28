// The advancements screen (L, or Advancements in the game menu), after Minecraft's: a window with a
// tab for each tree (Blockhaven, Adventure, Husbandry), the tree drawn over its tab's texture, to
// be dragged about (or scrolled with the wheel) when it's bigger than the window. Each advancement
// shows in its frame - square for a task, rounded for a goal, spiked for a challenge - gold once
// made; pointing at one (a tap, on a touch screen) shows what it asks for and how far along you
// are. The world carries on meanwhile.
import { ADVANCEMENTS, TABS, FRAMES, BY_ID, iconOfAdvancement, partName } from './advancements.js';
import { sprites, div, label } from './gui.js';
import { textureURL } from './icons.js';

const COL = 28, ROW = 27;           // how far apart the advancements are (GUI pixels), as in Minecraft
const WIN_W = 252, WIN_H = 140;     // the window
const IN_X = 9, IN_Y = 18, IN_W = 234, IN_H = 113; // the tree's part of it

// ---------------------------------------------------------------- frames
// A frame is drawn from its shape: a black edge, a bevelled rim (light to the top left, dark to the
// bottom right) and a darker face for the icon to sit on.
const N = 26;
const SHAPES = {
  task: (x, y) => !((x === 0 || x === N - 1) && (y === 0 || y === N - 1)),
  goal: (x, y) => {
    const dx = Math.max(0, Math.abs(x + 0.5 - N / 2) - (N / 2 - 6)), dy = Math.max(0, Math.abs(y + 0.5 - N / 2) - (N / 2 - 6));
    return dx * dx + dy * dy <= 36;
  },
  challenge: (x, y) => {
    const dx = Math.abs(x + 0.5 - N / 2), dy = Math.abs(y + 0.5 - N / 2);
    if (dx <= 9 && dy <= 9 && dx + dy <= 16) return true;                  // the body
    if ((dy >= 8 && dx <= (13 - dy) * 0.8 + 0.5) || (dx >= 8 && dy <= (13 - dx) * 0.8 + 0.5)) return true; // points top, bottom and sides
    return dx + dy >= 15 && dx <= 12.5 && dy <= 12.5 && Math.abs(dx - dy) <= (26 - dx - dy) * 0.55 + 0.5; // points at the corners
  },
};
const PALETTE = {
  false: { edge: '#000000', light: '#f4f4f4', rim: '#c2c2c2', dark: '#6c6c6c', face: '#4a4a4a' },
  true: { edge: '#2a1c00', light: '#fff4a8', rim: '#f0c02a', dark: '#9c6f0a', face: '#6a4a08' },
};
const frameCache = new Map();
export function frameImage(kind, done) {
  const key = `${kind}:${!!done}`;
  if (frameCache.has(key)) return frameCache.get(key);
  const inside = SHAPES[kind], pal = PALETTE[!!done];
  const c = document.createElement('canvas');
  c.width = c.height = N;
  const g = c.getContext('2d');
  // (How far in from the edge each pixel is, up to four.)
  const depth = (x, y) => {
    for (let k = 0; k < 4; k++) {
      for (let oy = -k; oy <= k; oy++) for (let ox = -k; ox <= k; ox++) {
        const px = x + ox, py = y + oy;
        if (px < 0 || py < 0 || px >= N || py >= N || !inside(px, py)) return k;
      }
    }
    return 4;
  };
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    if (!inside(x, y)) continue;
    const d = depth(x, y);
    g.fillStyle = d <= 1 ? pal.edge : d === 2 ? (x + y < N - 1 ? pal.light : pal.dark) : d === 3 ? pal.rim : pal.face;
    g.fillRect(x, y, 1, 1);
  }
  const url = c.toDataURL();
  frameCache.set(key, url);
  return url;
}

// ---------------------------------------------------------------- layout
// Each tree laid out once: the root on the left, each generation a column further right, a node's
// young stacked in rows and the node beside the middle of them.
const LAYOUT = new Map();
function layoutTab(tab) {
  if (LAYOUT.has(tab)) return LAYOUT.get(tab);
  const root = ADVANCEMENTS.find((a) => a.tab === tab && !a.parent), pos = new Map();
  let row = 0;
  const place = (a, depth) => {
    if (!a.children.length) { pos.set(a.id, { x: depth * COL, y: row++ * ROW }); return; }
    for (const c of a.children) place(c, depth + 1);
    const ys = a.children.map((c) => pos.get(c.id).y);
    pos.set(a.id, { x: depth * COL, y: Math.floor((Math.min(...ys) + Math.max(...ys)) / 2) });
  };
  place(root, 0);
  const all = [...pos.values()];
  const box = { x0: 0, y0: Math.min(...all.map((p) => p.y)), x1: Math.max(...all.map((p) => p.x)) + COL, y1: Math.max(...all.map((p) => p.y)) + ROW };
  const out = { pos, box };
  LAYOUT.set(tab, out);
  return out;
}

// Text measured in GUI pixels (the game's font at 9 to the em).
let measurer = null;
function textWidth(s) {
  measurer ??= document.createElement('canvas').getContext('2d');
  measurer.font = `9px ${getComputedStyle(document.body).getPropertyValue('--font-ui') || 'monospace'}`;
  return measurer.measureText(s).width;
}

// ---------------------------------------------------------------- the screen
export class AdvancementScreen {
  constructor(game) {
    this.game = game;
    this.tab = 'story';
    this.scroll = {};      // tab -> [x, y]
    this.tip = null;       // the advancement shown in the tooltip
    this.pinned = false;   // (tapped, on a touch screen: it stays till the next tap)
    this.el = document.createElement('section');
    this.el.className = 'screen adv-screen';
    this.el.hidden = true;
    this.frame = div('adv-frame', this.el);
    this.tabsEl = div('mc-tabs adv-tabs', this.frame, 0, 0, WIN_W, 28);
    this.win = div('mc-panel adv-win', this.frame, 0, 28, WIN_W, WIN_H);
    this.title = label('Advancements', this.win, 8, 6);
    this.well = div('adv-well', this.win, IN_X - 1, IN_Y - 1, IN_W + 2, IN_H + 2);
    this.view = div('adv-view', this.win, IN_X, IN_Y, IN_W, IN_H);
    this.tree = div('adv-tree', this.view, 0, 0);
    this.fade = div('adv-fade', this.view, 0, 0, IN_W, IN_H);
    this.tipEl = div('adv-tip', this.win);
    this.tipEl.hidden = true;
    this.done = document.createElement('button');
    this.done.type = 'button';
    this.done.className = 'btn adv-done';
    this.done.textContent = 'Done';
    this.done.addEventListener('click', () => this.game.closeAdvancements());
    this.frame.appendChild(this.done);
    this.tabTip = div('adv-tabtip', this.frame);
    this.tabTip.hidden = true;
    this.bindPointer();
    window.addEventListener('resize', () => { if (this.open) this.fit(); });
    (document.getElementById('screen-container')?.parentNode ?? document.body).appendChild(this.el);
  }

  get open() { return !this.el.hidden; }

  show() {
    this.el.hidden = false;
    this.el.style.setProperty('--window', `url(${sprites().window})`);
    this.hideTip();
    this.fit();
    this.build();
  }
  hide() { this.el.hidden = true; this.hideTip(); }
  // (Something was made or taken away while the screen is open.)
  refresh() { if (this.open) this.build(); }

  // As big as the GUI Scale option says, or smaller if that doesn't fit.
  fit() {
    const vw = window.innerWidth - 16, vh = window.innerHeight - 16, dpr = window.devicePixelRatio || 1;
    let u = Math.min(this.game.ui.u, vw / WIN_W, vh / (28 + WIN_H + 30));
    u = u >= 1 ? Math.floor(u * dpr + 1e-6) / dpr : Math.max(0.5, Math.floor(u * dpr * 4) / (dpr * 4));
    this.el.style.setProperty('--u', `${u}px`);
  }

  // ---- drawing
  build() {
    const adv = this.game.advancements;
    // The tabs along the top, each with its root's icon.
    this.tabsEl.replaceChildren();
    TABS.forEach((t, i) => {
      const root = ADVANCEMENTS.find((a) => a.tab === t.id && !a.parent);
      const el = div(`mc-tab${t.id === this.tab ? ' on' : ''}`, this.tabsEl, i * 28, 0, 28, 30);
      const img = document.createElement('img');
      img.src = iconOfAdvancement(root);
      img.alt = '';
      img.draggable = false;
      Object.assign(img.style, { left: 'calc(var(--u) * 6)', top: 'calc(var(--u) * 7)', width: 'calc(var(--u) * 16)', height: 'calc(var(--u) * 16)' });
      el.appendChild(img);
      el.setAttribute('aria-label', t.title);
      el.addEventListener('click', () => { if (this.tab !== t.id) { this.tab = t.id; this.hideTip(); this.build(); } });
      el.addEventListener('pointerenter', () => this.showTabTip(t, i));
      el.addEventListener('pointerleave', () => { this.tabTip.hidden = true; });
    });
    // The tree: its lines first, then the advancements over them.
    const tab = TABS.find((t) => t.id === this.tab), { pos, box } = layoutTab(this.tab);
    // (Dimmed a little, so the lines and frames stand out on the brighter textures.)
    this.view.style.backgroundImage = `linear-gradient(rgba(0, 0, 0, 0.28), rgba(0, 0, 0, 0.28)), url(${textureURL(tab.bg)})`;
    const shown = ADVANCEMENTS.filter((a) => a.tab === this.tab && adv.visible(a));
    const ns = 'http://www.w3.org/2000/svg', svg = document.createElementNS(ns, 'svg');
    const w = box.x1 - box.x0 + 8, h = box.y1 - box.y0 + 8;
    svg.setAttribute('viewBox', `${box.x0 - 4} ${box.y0 - 4} ${w} ${h}`);
    svg.setAttribute('class', 'adv-lines');
    svg.setAttribute('shape-rendering', 'crispEdges');
    Object.assign(svg.style, { left: `calc(var(--u) * ${box.x0 - 4})`, top: `calc(var(--u) * ${box.y0 - 4})`, width: `calc(var(--u) * ${w})`, height: `calc(var(--u) * ${h})` });
    const paths = [];
    for (const a of shown) {
      const up = a.parent && BY_ID.get(a.parent);
      if (!up || !adv.visible(up)) continue;
      const p = pos.get(up.id), c = pos.get(a.id);
      // (From the middle of the one above, out past its edge, along, and into the middle of this one.)
      const i = p.x + 13, j = p.x + 26 + 4, k = p.y + 13, l = c.x + 13, m = c.y + 13;
      paths.push(`M${i + 0.5} ${k + 0.5}H${j + 0.5}V${m + 0.5}H${l + 0.5}`);
    }
    for (const [stroke, width] of [['#000', 3], ['#fff', 1]]) {
      for (const d of paths) {
        const path = document.createElementNS(ns, 'path');
        path.setAttribute('d', d);
        path.setAttribute('fill', 'none');
        path.setAttribute('stroke', stroke);
        path.setAttribute('stroke-width', width);
        path.setAttribute('stroke-linecap', 'square');
        svg.appendChild(path);
      }
    }
    this.tree.replaceChildren(svg);
    this.nodes = [];
    for (const a of shown) {
      const p = pos.get(a.id), made = adv.isDone(a);
      const el = div(`adv-node ${a.frame}${made ? ' done' : ''}`, this.tree, p.x + 3, p.y, 26, 26);
      el.style.backgroundImage = `url(${frameImage(a.frame, made)})`;
      const img = document.createElement('img');
      img.src = iconOfAdvancement(a);
      img.alt = '';
      img.draggable = false;
      el.appendChild(img);
      this.nodes.push({ a, x: p.x + 3, y: p.y, el });
    }
    this.scrollTo(...(this.scroll[this.tab] ?? this.centre()));
    if (this.tip) this.showTip(this.tip);
  }

  // Where the tree starts: in the middle of the window (Minecraft's own start).
  centre() {
    const { box } = layoutTab(this.tab);
    return [Math.floor(IN_W / 2 - (box.x1 + box.x0) / 2), Math.floor(IN_H / 2 - (box.y1 + box.y0) / 2)];
  }
  // Moves the tree (kept from going further than its edges, when it's bigger than the window).
  scrollTo(x, y) {
    const { box } = layoutTab(this.tab), [cx, cy] = this.centre();
    x = box.x1 - box.x0 > IN_W ? Math.max(IN_W - box.x1, Math.min(-box.x0, x)) : cx;
    y = box.y1 - box.y0 > IN_H ? Math.max(IN_H - box.y1, Math.min(-box.y0, y)) : cy;
    x = Math.round(x); y = Math.round(y);
    this.scroll[this.tab] = [x, y];
    this.tree.style.transform = `translate(calc(var(--u) * ${x}), calc(var(--u) * ${y}))`;
    this.view.style.backgroundPosition = `0 0, calc(var(--u) * ${x}) calc(var(--u) * ${y})`;
    if (this.tip) this.placeTip();
  }

  // ---- the tooltip: the advancement's title in a bar (gold as far as it's made, blue for the
  // rest), how many parts of it are made, and what it asks for (and, for one of many parts, a few
  // of those still to do).
  showTip(a) {
    const adv = this.game.advancements, made = adv.isDone(a), [got, of] = adv.progress(a), f = FRAMES[a.frame];
    this.tip = a;
    const el = this.tipEl;
    el.replaceChildren();
    const count = of > 1 ? `${got}/${of}` : '';
    const titleW = 32 + textWidth(a.title) + (count ? 10 + textWidth(count) : 0) + 6;
    const descW = textWidth(a.desc);
    let w = Math.max(120, Math.ceil(titleW));
    if (descW > w * 2.5) w = Math.min(214, Math.max(w, Math.ceil(descW / 2.5)));
    this.tipW = w;
    const bar = div(`adv-bar${made ? ' done' : ''}`, el);
    bar.style.setProperty('--made', `${made ? 100 : Math.round((got / of) * 100)}%`);
    const frame = div('adv-tipframe', bar);
    frame.style.backgroundImage = `url(${frameImage(a.frame, made)})`;
    const img = document.createElement('img');
    img.src = iconOfAdvancement(a);
    img.alt = '';
    frame.appendChild(img);
    const t = document.createElement('span');
    t.className = 'adv-title';
    t.textContent = a.title;
    bar.appendChild(t);
    if (count) {
      const c = document.createElement('span');
      c.className = 'adv-count';
      c.textContent = count;
      bar.appendChild(c);
    }
    const desc = div('adv-desc', el);
    desc.style.color = f.colour;
    desc.textContent = a.desc;
    const left = adv.left(a);
    if (left.length && left.length <= 12) {
      const more = div('adv-left', desc);
      more.textContent = `Still to go: ${left.slice(0, 6).map((p) => partName(a, p)).join(', ')}${left.length > 6 ? ` and ${left.length - 6} more` : ''}`;
    }
    el.style.width = `calc(var(--u) * ${w})`;
    el.hidden = false;
    this.fade.classList.add('on');
    for (const n of this.nodes ?? []) n.el.classList.toggle('lit', n.a === a);
    this.placeTip();
  }
  // Over the advancement's own frame, the bar running right (or left, near the window's right
  // edge), the description below it (or above, low in the window).
  placeTip() {
    const n = this.nodes?.find((o) => o.a === this.tip);
    if (!n) { this.hideTip(); return; }
    const [sx, sy] = this.scroll[this.tab] ?? [0, 0];
    const fx = IN_X + sx + n.x, fy = IN_Y + sy + n.y, w = this.tipW;
    const flip = fx + w > WIN_W + 40, up = fy > IN_Y + IN_H / 2;
    this.tipEl.classList.toggle('flip', flip);
    this.tipEl.classList.toggle('up', up);
    this.tipEl.style.left = `calc(var(--u) * ${flip ? fx + 26 - w : fx})`;
    this.tipEl.style.top = `calc(var(--u) * ${fy})`;
  }
  hideTip() {
    this.tip = null;
    this.pinned = false;
    this.tipEl.hidden = true;
    this.fade.classList.remove('on');
    for (const n of this.nodes ?? []) n.el.classList.remove('lit');
  }
  showTabTip(t, i) {
    this.tabTip.textContent = t.title;
    this.tabTip.style.left = `calc(var(--u) * ${i * 28 + 14})`;
    this.tabTip.hidden = false;
  }

  // ---- the pointer: drag the tree about; point at (or tap) an advancement to see what it is.
  nodeAt(e) {
    const r = this.view.getBoundingClientRect(), u = r.width / IN_W, [sx, sy] = this.scroll[this.tab] ?? [0, 0];
    const x = (e.clientX - r.left) / u - sx, y = (e.clientY - r.top) / u - sy;
    if ((e.clientX - r.left) / u < 0 || (e.clientY - r.top) / u < 0 || (e.clientX - r.left) / u > IN_W || (e.clientY - r.top) / u > IN_H) return null;
    return this.nodes?.find((n) => x >= n.x && x < n.x + 26 && y >= n.y && y < n.y + 26)?.a ?? null;
  }
  bindPointer() {
    const v = this.view;
    let drag = null;
    v.addEventListener('pointerdown', (e) => {
      if (e.button !== 0) return;
      drag = { x: e.clientX, y: e.clientY, from: this.scroll[this.tab] ?? this.centre(), moved: false, id: e.pointerId, touch: e.pointerType !== 'mouse' };
      v.setPointerCapture(e.pointerId);
    });
    v.addEventListener('pointermove', (e) => {
      if (drag && drag.id === e.pointerId) {
        const u = v.getBoundingClientRect().width / IN_W, dx = (e.clientX - drag.x) / u, dy = (e.clientY - drag.y) / u;
        if (!drag.moved && Math.hypot(dx, dy) > 2) { drag.moved = true; if (!this.pinned) this.hideTip(); }
        if (drag.moved) this.scrollTo(drag.from[0] + dx, drag.from[1] + dy);
        return;
      }
      if (e.pointerType !== 'mouse' || this.pinned) return;
      const a = this.nodeAt(e);
      if (a && a !== this.tip) this.showTip(a); else if (!a && this.tip) this.hideTip();
    });
    const end = (e) => {
      if (!drag || drag.id !== e.pointerId) return;
      const tap = !drag.moved, touch = drag.touch;
      drag = null;
      if (!tap) return;
      const a = this.nodeAt(e);
      if (touch) {
        if (a && a !== this.tip) { this.showTip(a); this.pinned = true; } else this.hideTip();
      } else if (a) this.showTip(a);
    };
    v.addEventListener('pointerup', end);
    v.addEventListener('pointercancel', (e) => { if (drag?.id === e.pointerId) drag = null; });
    v.addEventListener('pointerleave', (e) => { if (e.pointerType === 'mouse' && !drag && !this.pinned) this.hideTip(); });
    v.addEventListener('wheel', (e) => {
      e.preventDefault();
      const [x, y] = this.scroll[this.tab] ?? this.centre(), step = Math.sign(e.deltaY || e.deltaX) * 16;
      if (e.shiftKey || Math.abs(e.deltaX) > Math.abs(e.deltaY)) this.scrollTo(x - step, y); else this.scrollTo(x, y - step);
    }, { passive: false });
  }
}
