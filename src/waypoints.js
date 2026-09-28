// Waypoints, as the Xaero's Minimap mod keeps them: places you mark (B marks where you stand, U
// lists them all), each with a name, its initials and a colour, shown on the minimap and out in
// the world with how far off they are (and the name, when you look its way). Dying leaves one
// where you fell. They're kept with the world (a guest's by the host, with the rest of theirs).
import { DYES } from './colors.js';
import { initials, waypointColour } from './minimap.js';
import { keyName } from './keys.js';

export const MAX_WAYPOINTS = 100;
const NAME_CHARS = 24;
const cleanName = (s) => String(s ?? '').replace(/[^\x20-\x7e]/g, '').trim().slice(0, NAME_CHARS);
const coord = (v) => Number.isInteger(v) && Math.abs(v) < 3e7;

// A waypoint as saved or sent (anything wrong in one is put right, or it's dropped).
export function cleanWaypoint(w) {
  if (!w || typeof w !== 'object' || ![w.x, w.y, w.z].every(coord)) return null;
  const out = { name: cleanName(w.name) || 'Waypoint', x: w.x, y: Math.max(-64, Math.min(320, w.y)), z: w.z,
    c: Number.isInteger(w.c) && w.c >= 0 && w.c < 16 ? w.c : 0, on: w.on !== false };
  if (w.death) out.death = true;
  return out;
}
export const cleanWaypoints = (list) => (Array.isArray(list) ? list.slice(0, MAX_WAYPOINTS).map(cleanWaypoint).filter(Boolean) : []);

export class Waypoints {
  constructor(game) {
    this.game = game;
    this.list = [];
    this.layer = document.getElementById('waypoints');
    this.marks = new Map(); // waypoint -> its mark in the world
  }

  load(list) { this.clearMarks(); this.list = cleanWaypoints(list); }
  serialize() { return this.list.map((w) => ({ ...w })); }

  add(w) {
    const c = cleanWaypoint(w);
    if (!c) return null;
    if (this.list.length >= MAX_WAYPOINTS) this.remove(this.list.find((o) => !o.death) ?? this.list[0]);
    this.list.push(c);
    return c;
  }
  remove(w) {
    const i = this.list.indexOf(w);
    if (i >= 0) this.list.splice(i, 1);
    this.marks.get(w)?.remove();
    this.marks.delete(w);
  }
  // Where you died: the one "Death" waypoint, moved there.
  died(x, y, z) {
    for (const w of this.list.filter((o) => o.death)) this.remove(w);
    this.add({ name: 'Death', x: Math.floor(x), y: Math.floor(y), z: Math.floor(z), c: 14, death: true });
  }
  // A new waypoint's colour: the next one not in use yet.
  nextColour() {
    const used = new Set(this.list.filter((w) => !w.death).map((w) => w.c));
    const order = [14, 3, 5, 4, 10, 1, 9, 6, 11, 2, 13, 0, 12, 8, 7, 15];
    return order.find((c) => !used.has(c)) ?? order[this.list.length % 16];
  }

  clearMarks() { for (const el of this.marks.values()) el.remove(); this.marks.clear(); }

  // Out in the world: each shown waypoint's mark over where it is, with how far off it is, and its
  // name too while you look its way. `project(x, y, z)`: where a point is on the screen (CSS
  // pixels), or null when it's behind you. `look`: which way you're looking.
  render(cam, project, look) {
    // (Not over a screen: the waypoint list, a chest, the game menu.)
    const g = this.game, show = g.settings.worldWaypoints !== false && !g.hideHud && !!g.world && (g.state === 'play' || g.state === 'chat');
    const seen = new Set();
    if (show) {
      for (const w of this.list) {
        if (!w.on) continue;
        const x = w.x + 0.5, y = w.y + 1.5, z = w.z + 0.5, at = project(x, y, z);
        if (!at) continue;
        seen.add(w);
        let el = this.marks.get(w);
        if (!el) {
          el = document.createElement('div');
          el.className = 'wp-mark';
          el.append(document.createElement('b'), document.createElement('i'), document.createElement('span'));
          this.layer.append(el);
          this.marks.set(w, el);
        }
        const dx = x - cam.x, dy = y - cam.y, dz = z - cam.z, d = Math.hypot(dx, dy, dz);
        // (Looked at: within a few degrees of the middle of the view.)
        const aimed = (dx * look[0] + dy * look[1] + dz * look[2]) / Math.max(d, 1e-6) > 0.995;
        const [name, icon, dist] = el.children;
        set(icon, initials(w));
        if (icon.dataset.c !== waypointColour(w)) { icon.dataset.c = waypointColour(w); icon.style.background = icon.dataset.c; }
        set(name, aimed ? w.name : '');
        set(dist, `${Math.round(d)}m`);
        el.style.transform = `translate(${Math.round(at[0])}px, ${Math.round(at[1])}px)`;
        el.hidden = false;
      }
    }
    for (const [w, el] of this.marks) if (!seen.has(w)) el.hidden = true;
  }
}
const set = (el, text) => { if (el.textContent !== text) el.textContent = text; };

// ---------------------------------------------------------------- the waypoint screens
// The list (U, or a tap on the minimap): each waypoint with its mark, name, where it is and how
// far; buttons to hide or show it, change it or delete it (and in Creative, go there). And the
// form for a new one (B) or one being changed: its name, colour and place.
export class WaypointScreen {
  constructor(game) {
    this.game = game;
    this.editing = null;   // the waypoint being changed, or 'new'
    this.el = document.createElement('section');
    this.el.className = 'screen wp-screen';
    this.el.hidden = true;
    this.title = document.createElement('h2');
    this.body = document.createElement('div');
    this.buttons = document.createElement('div');
    this.buttons.className = 'row';
    this.el.append(this.title, this.body, this.buttons);
    this.el.addEventListener('keydown', (e) => {
      if (e.target.tagName !== 'INPUT') return;
      e.stopPropagation();
      if (e.key === 'Escape') { e.preventDefault(); this.back(); }
      else if (e.key === 'Enter') { e.preventDefault(); this.save(); }
    });
    (document.getElementById('screen-container')?.parentNode ?? document.body).appendChild(this.el);
  }
  get open() { return !this.el.hidden; }
  hide() { this.el.hidden = true; this.editing = null; for (const i of this.el.querySelectorAll('input')) i.blur(); }
  // Escape: from the form back to the list, from the list back to the game.
  back() { if (this.editing) this.showList(); else this.game.closeWaypoints(); }

  button(label, fn) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'btn';
    b.textContent = label;
    b.addEventListener('click', fn);
    return b;
  }

  showList() {
    const g = this.game, wps = g.waypoints, p = g.player;
    this.editing = null;
    this.el.hidden = false;
    this.title.textContent = 'Waypoints';
    this.body.className = 'wp-list';
    this.body.replaceChildren();
    const far = (w) => Math.hypot(w.x + 0.5 - p.x, w.y - p.y, w.z + 0.5 - p.z);
    const sorted = [...wps.list].sort((a, b) => far(a) - far(b));
    if (!sorted.length) {
      const none = document.createElement('div');
      none.className = 'wp-empty';
      none.textContent = `No waypoints yet. Press ${keyName(g.keys.code('waypointAdd'))} to mark where you're standing.`;
      this.body.append(none);
    }
    for (const w of sorted) {
      const row = document.createElement('div');
      row.className = `wp-row${w.on ? '' : ' off'}`;
      const icon = document.createElement('i');
      icon.textContent = initials(w);
      icon.style.background = waypointColour(w);
      const text = document.createElement('div');
      text.className = 'wp-text';
      const name = document.createElement('div');
      name.className = 'wp-name';
      name.textContent = w.name;
      const where = document.createElement('div');
      where.className = 'wp-where';
      where.textContent = `${w.x}, ${w.y}, ${w.z} · ${Math.round(far(w))}m`;
      text.append(name, where);
      row.append(icon, text,
        this.button(w.on ? 'Hide' : 'Show', () => { w.on = !w.on; this.showList(); }),
        this.button('Edit', () => this.showForm(w)),
        this.button('Delete', () => { wps.remove(w); this.showList(); }));
      if (g.creative || g.spectator) row.append(this.button('Go', () => { g.closeWaypoints(); g.command(`tp ${w.x} ${w.y} ${w.z}`); }));
      this.body.append(row);
    }
    this.buttons.replaceChildren(this.button('New Waypoint', () => this.showForm('new')), this.button('Done', () => g.closeWaypoints()));
  }

  showForm(w) {
    const g = this.game, p = g.player, fresh = w === 'new';
    const base = fresh ? { name: '', x: Math.floor(p.x), y: Math.floor(p.y), z: Math.floor(p.z), c: g.waypoints.nextColour() } : w;
    this.editing = w;
    this.el.hidden = false;
    this.title.textContent = fresh ? 'New Waypoint' : 'Edit Waypoint';
    this.body.className = 'wp-form';
    this.body.replaceChildren();
    const field = (label, input) => { const l = document.createElement('div'); l.className = 'wp-label'; l.textContent = label; this.body.append(l, input); };
    const text = (value, max, label) => {
      const i = document.createElement('input');
      Object.assign(i, { type: 'text', value: String(value), maxLength: max, spellcheck: false, autocomplete: 'off' });
      i.setAttribute('aria-label', label);
      return i;
    };
    this.name = text(base.name, NAME_CHARS, 'Name');
    this.name.placeholder = 'Waypoint';
    field('Name', this.name);
    const xyz = document.createElement('div');
    xyz.className = 'wp-xyz';
    this.coords = [base.x, base.y, base.z].map((v, i) => text(v, 9, 'XYZ'[i]));
    xyz.append(...this.coords);
    field('X Y Z', xyz);
    const colours = document.createElement('div');
    colours.className = 'wp-colours';
    this.colour = base.c;
    DYES.forEach((d, i) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.style.background = `#${d.wool.toString(16).padStart(6, '0')}`;
      b.setAttribute('aria-label', d.name.replace('_', ' '));
      b.classList.toggle('on', i === this.colour);
      b.addEventListener('click', () => { this.colour = i; for (const o of colours.children) o.classList.toggle('on', o === b); });
      colours.append(b);
    });
    field('Colour', colours);
    this.buttons.replaceChildren(this.button('Save', () => this.save()), this.button('Cancel', () => this.showList()));
    setTimeout(() => this.name.focus(), 0);
  }

  save() {
    const g = this.game, w = this.editing, p = g.player;
    if (!w) return;
    const [x, y, z] = this.coords.map((i) => Math.round(Number(i.value)));
    const fields = { name: this.name.value, x: Number.isFinite(x) ? x : Math.floor(p.x), y: Number.isFinite(y) ? y : Math.floor(p.y), z: Number.isFinite(z) ? z : Math.floor(p.z), c: this.colour };
    if (w === 'new') g.waypoints.add(fields);
    else { const c = cleanWaypoint({ ...w, ...fields }); if (c) Object.assign(w, c); }
    this.showList();
  }
}
