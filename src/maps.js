// Maps, as in Minecraft. An empty map (paper round a compass) used becomes a filled map of the land
// round about: 128 by 128 pixels, a block to a pixel (or 2, 4, 8, 16 zoomed out), lined up on a
// grid so maps of neighbouring areas fit together. It fills in as whoever holds it explores: each
// pixel the colour of what's on top there (grass, sand, water, stone...) in Minecraft's map colours,
// lighter where the land rises to the north and darker where it falls, water darker the deeper
// it is. Held, it's drawn in your hands with arrows where the players are; in an item frame it
// covers the frame. Copies (with empty maps) show the same map; a filled map with eight paper round
// it makes an empty map that draws at the next scale out.
//
// A map's number goes with the item (its `map` extra). The host keeps every map with the world
// (meta.maps) and passes them to guests; whoever holds one explores it, and what they find goes to
// everyone (see multiplayer.js).
import { RENDER, R, TEXL, TINT, TINT_RGB, WATERLIKE, BLOCKS } from './blocks.js';
import { SECTIONS } from './config.js';
import { I } from './items.js';

export const MAP_SIZE = 128;
export const MAP_SLOTS = 16; // (map pictures in item frames at once: see Renderer.mapLayer)
export const MAX_SCALE = 4;

// Minecraft's map colours (by number; 0 nothing), each in four shades: dark, normal, light, darkest.
const BASE = [0, 0x7fb238, 0xf7e9a3, 0xc7c7c7, 0xff0000, 0xa0a0ff, 0xa7a7a7, 0x007c00, 0xffffff, 0xa4a8b8, 0x976d4d, 0x707070, 0x4040ff, 0x8f7748,
  0xfffcf5, 0xd87f33, 0xb24cd8, 0x6699d8, 0xe5e533, 0x7fcc19, 0xf27fa5, 0x4c4c4c, 0x999999, 0x4c7f99, 0x7f3fb2, 0x334cb2, 0x664c33, 0x667f33,
  0x993333, 0x191919, 0xfaee4d, 0x5cdbd5, 0x4a80ff, 0x00d93a, 0x815631, 0x700200, 0xd1b1a1, 0x9f5224, 0x95576c, 0x706c8a, 0xba8524, 0x677535,
  0xa04d4e, 0x392923, 0x876b62, 0x575c5c, 0x7a4958, 0x4c3e5c, 0x4c3223, 0x4c522a, 0x8e3c2e, 0x251610, 0xbd3031, 0x943f61, 0x5c191d, 0x167e86,
  0x3a8e8c, 0x562c3e, 0x14b485, 0x646464, 0xd8af93, 0x7fa796];
const GRASS = 1, FIRE = 4, PLANT = 7, WATER = 12, SHADES = [180, 220, 255, 135];
// The colour of each packed value (base * 4 + shade), as RGBA.
export const PALETTE = new Uint8ClampedArray(256 * 4);
for (let i = 4; i < BASE.length * 4; i++) {
  const c = BASE[i >> 2], k = SHADES[i & 3] / 255;
  PALETTE.set([((c >> 16) & 255) * k, ((c >> 8) & 255) * k, (c & 255) * k, 255], i * 4);
}

// Each block's map colour (0: not seen on a map, like air, glass or a torch), worked out once from
// what its top looks like: the nearest map colour to its texture, grass and leaves in theirs,
// plants as plants, water as water.
let colourOf = null;
export function initMapColours(pixels) {
  colourOf = new Uint8Array(RENDER.length);
  const nearest = (r, g, b) => {
    let best = 0, bd = Infinity;
    for (let i = 1; i < BASE.length; i++) {
      const c = BASE[i], dr = r - ((c >> 16) & 255), dg = g - ((c >> 8) & 255), db = b - (c & 255);
      const d = dr * dr * 3 + dg * dg * 4 + db * db * 2;
      if (d < bd) { bd = d; best = i; }
    }
    return best;
  };
  for (let id = 1; id < RENDER.length; id++) {
    const kind = RENDER[id];
    if (!BLOCKS[id] || kind === R.NONE || kind === R.TORCH || kind === R.FIRE) continue;
    if (WATERLIKE[id] === 1) { colourOf[id] = WATER; continue; }
    if (WATERLIKE[id] === 2) { colourOf[id] = FIRE; continue; }
    if (kind === R.CROSS) { colourOf[id] = PLANT; continue; }
    if (TINT[id] === 1) { colourOf[id] = GRASS; continue; }
    if (TINT[id] === 2) { colourOf[id] = PLANT; continue; }
    const layer = TEXL[id * 6 + 2], src = pixels.subarray(layer * 1024, layer * 1024 + 1024);
    let r = 0, g = 0, b = 0, n = 0;
    for (let i = 0; i < 1024; i += 4) if (src[i + 3] > 127) { r += src[i]; g += src[i + 1]; b += src[i + 2]; n++; }
    // (Mostly see-through - glass, bars, a ladder - the map shows what's under it.)
    if (n < 64) continue;
    r /= n; g /= n; b /= n;
    if (TINT[id] === 3) { r *= TINT_RGB[id * 3] / 255; g *= TINT_RGB[id * 3 + 1] / 255; b *= TINT_RGB[id * 3 + 2] / 255; }
    colourOf[id] = nearest(r, g, b);
  }
}

// What a map shows at (x, z): [colour, height, water depth], or null where the land isn't loaded.
function surface(w, x, z) {
  const c = w.readyChunk(x >> 4, z >> 4);
  if (!c) return null;
  const col = ((z & 15) << 4) | (x & 15), blocks = c.blocks;
  for (let sy = SECTIONS - 1; sy >= 0; sy--) {
    if (!c.sections[sy].count) continue;
    for (let y = sy * 16 + 15; y >= sy * 16; y--) {
      const k = colourOf[blocks[(y << 8) | col]];
      if (!k) continue;
      if (k !== WATER) return [k, y, 0];
      let d = 1;
      while (d < 16 && y - d >= 0 && WATERLIKE[blocks[((y - d) << 8) | col]] === 1) d++;
      return [k, y, d];
    }
  }
  return [0, 0, 0];
}

// The corner of the map grid square (128 blocks, times the scale) that (x, z) is in.
export function mapCentre(x, z, scale) {
  const n = MAP_SIZE << scale;
  return [Math.floor((x + 64) / n) * n + n / 2 - 64, Math.floor((z + 64) / n) * n + n / 2 - 64];
}

// Run-length packing for a map's pixels (to save and to send): [count, value] pairs.
export function packMap(px) {
  const out = [];
  for (let i = 0; i < px.length;) {
    const v = px[i];
    let n = 1;
    while (i + n < px.length && px[i + n] === v && n < 255) n++;
    out.push(n, v);
    i += n;
  }
  let s = '';
  for (const b of out) s += String.fromCharCode(b);
  return btoa(s);
}
export function unpackMap(b64, size = MAP_SIZE * MAP_SIZE) {
  const px = new Uint8Array(size);
  let s;
  try { s = atob(String(b64 ?? '')); } catch { return px; }
  let o = 0;
  for (let i = 0; i + 1 < s.length && o < size; i += 2) {
    const n = s.charCodeAt(i), v = s.charCodeAt(i + 1);
    px.fill(v < BASE.length * 4 ? v : 0, o, Math.min(size, o + n));
    o += n;
  }
  return px;
}

// (The game's maps, for what's said about one in its tooltip.)
let current = null;
export const mapInfo = (id) => current?.get(id) ?? null;

export class Maps {
  constructor(game) {
    current = this;
    this.game = game;
    this.list = new Map();   // number -> { id, x, z, scale, px, h, ver }
    this.next = 1;
    this.asked = new Map();  // (a guest's requests for maps it hasn't got: number -> when)
    this.step = 0;
    this.dirty = new Map();  // number -> [x0, z0, x1, z1] changed since last sent
    this.sendIn = 0;
    this.frames = new Map(); // number -> { slot, ver, meshes } (pictures for item frames)
    this.slots = new Array(MAP_SLOTS).fill(null);
    this.uses = 0;
  }

  reset(saved) {
    this.list.clear(); this.asked.clear(); this.dirty.clear();
    for (const k of [...this.frames.keys()]) this.forgetFrame(k);
    this.next = Number.isInteger(saved?.next) && saved.next > 0 ? saved.next : 1;
    for (const m of Array.isArray(saved?.list) ? saved.list : []) this.put(m);
  }
  // A map as saved or sent: [number, x, z, scale, pixels].
  put(m) {
    if (!Array.isArray(m) || !Number.isInteger(m[0]) || m[0] < 1 || !Number.isFinite(m[1]) || !Number.isFinite(m[2])) return null;
    const scale = Number.isInteger(m[3]) ? Math.max(0, Math.min(MAX_SCALE, m[3])) : 0;
    const rec = { id: m[0], x: m[1], z: m[2], scale, px: unpackMap(m[4]), h: new Uint8Array(MAP_SIZE * MAP_SIZE), ver: 1 };
    this.list.set(rec.id, rec);
    this.next = Math.max(this.next, rec.id + 1);
    return rec;
  }
  serialize() { return { next: this.next, list: [...this.list.values()].map((m) => this.saved(m)) }; }
  saved(m) { return [m.id, m.x, m.z, m.scale, packMap(m.px)]; }
  get(id) { return this.list.get(id) ?? null; }

  // A new map about (x, z) at `scale`: its number. (A guest asks the host; see multiplayer.js.)
  create(x, z, scale = 0) {
    const [cx, cz] = mapCentre(x, z, scale);
    const rec = { id: this.next++, x: cx, z: cz, scale, px: new Uint8Array(MAP_SIZE * MAP_SIZE), h: new Uint8Array(MAP_SIZE * MAP_SIZE), ver: 1 };
    this.list.set(rec.id, rec);
    return rec.id;
  }

  // A guest that meets a map it hasn't got asks the host for it (now and then).
  want(id) {
    if (!id || this.list.has(id) || !this.game.net?.guest) return;
    const now = performance.now();
    if (now - (this.asked.get(id) ?? -1e9) < 3000) return;
    this.asked.set(id, now);
    this.game.net.askMap?.(id);
  }

  // Every tick: the map in hand fills in round whoever holds it (a sixteenth of its columns a
  // tick, as Minecraft does), and what changed goes to the other players now and then (not while
  // the connection is backed up: it keeps).
  tick() {
    const g = this.game, held = g.inv.held;
    this.step++;
    if (held?.id === I.filled_map && held.map) {
      const m = this.get(held.map);
      if (m) this.explore(m, g.player.x, g.player.z); else this.want(held.map);
    }
    if (--this.sendIn <= 0 && this.dirty.size && !g.net?.congested) {
      this.sendIn = 10;
      for (const [id, r] of this.dirty) { const m = this.get(id); if (m) g.net?.mapChanged?.(m, r); }
      this.dirty.clear();
    }
  }
  explore(m, px, pz) {
    const w = this.game.world, s = 1 << m.scale, radius = Math.min(128, (this.game.settings.renderDistance ?? 8) * 16) / s;
    const ox = m.x - 64 * s, oz = m.z - 64 * s;
    const cx = Math.floor((px - ox) / s), cz = Math.floor((pz - oz) / s);
    let changed = null;
    for (let x = Math.max(0, Math.floor(cx - radius)); x < Math.min(MAP_SIZE, Math.ceil(cx + radius)); x++) {
      if ((x & 15) !== (this.step & 15)) continue;
      let north = -1;
      for (let z = Math.max(0, Math.floor(cz - radius)) - 1; z < Math.min(MAP_SIZE, Math.ceil(cz + radius)); z++) {
        const wx = ox + x * s + (s >> 1), wz = oz + z * s + (s >> 1);
        const at = surface(w, wx, wz);
        if (!at) { north = -1; continue; }
        const [k, y, depth] = at;
        const h = north < 0 ? y : north;
        north = y;
        if (z < 0) continue;
        const dx = x - cx, dz = z - cz;
        if (dx * dx + dz * dz > (radius - 2) * (radius - 2)) continue;
        let shade = 1;
        if (k === WATER) { const d2 = depth * 0.1 + ((x + z) & 1) * 0.2; shade = d2 < 0.5 ? 2 : d2 > 0.9 ? 0 : 1; }
        else if (k) { const d3 = ((y - h) * 4) / (s + 4) + (((x + z) & 1) - 0.5) * 0.4; shade = d3 > 0.6 ? 2 : d3 < -0.6 ? 0 : 1; }
        const v = k ? k * 4 + shade : 0, i = z * MAP_SIZE + x;
        m.h[i] = y;
        if (m.px[i] !== v) {
          m.px[i] = v;
          if (!changed) changed = [x, z, x, z];
          else { changed[0] = Math.min(changed[0], x); changed[1] = Math.min(changed[1], z); changed[2] = Math.max(changed[2], x); changed[3] = Math.max(changed[3], z); }
        }
      }
    }
    if (changed) { m.ver++; this.markDirty(m.id, changed); }
  }
  markDirty(id, [x0, z0, x1, z1]) {
    const d = this.dirty.get(id);
    this.dirty.set(id, d ? [Math.min(d[0], x0), Math.min(d[1], z0), Math.max(d[2], x1), Math.max(d[3], z1)] : [x0, z0, x1, z1]);
  }
  // Part of a map from another player: the rectangle [x0, z0, x1, z1] of pixels.
  patch(id, r, data) {
    const m = this.get(id);
    if (!m || !Array.isArray(r) || r.length !== 4 || !r.every(Number.isInteger)) return false;
    const [x0, z0, x1, z1] = r;
    if (x0 < 0 || z0 < 0 || x1 >= MAP_SIZE || z1 >= MAP_SIZE || x1 < x0 || z1 < z0) return false;
    const w = x1 - x0 + 1, px = unpackMap(data, w * (z1 - z0 + 1));
    for (let z = z0; z <= z1; z++) m.px.set(px.subarray((z - z0) * w, (z - z0 + 1) * w), z * MAP_SIZE + x0);
    m.ver++;
    return true;
  }
  // The rectangle's pixels, packed (to send).
  cut(m, [x0, z0, x1, z1]) {
    const w = x1 - x0 + 1, out = new Uint8Array(w * (z1 - z0 + 1));
    for (let z = z0; z <= z1; z++) out.set(m.px.subarray(z * MAP_SIZE + x0, z * MAP_SIZE + x1 + 1), (z - z0) * w);
    return packMap(out);
  }

  // ---------------------------------------------------------------- drawing
  // The map's picture (RGBA, 128 by 128; unexplored parts left clear).
  rgba(m, out = new Uint8ClampedArray(MAP_SIZE * MAP_SIZE * 4)) {
    for (let i = 0; i < m.px.length; i++) {
      const v = m.px[i];
      if (v < 4) { out[i * 4 + 3] = 0; continue; }
      out[i * 4] = PALETTE[v * 4]; out[i * 4 + 1] = PALETTE[v * 4 + 1]; out[i * 4 + 2] = PALETTE[v * 4 + 2]; out[i * 4 + 3] = 255;
    }
    return out;
  }
  // Where a player is on a map: [x, z] in pixels (maybe off it).
  where(m, x, z) { const s = 1 << m.scale; return [(x - m.x) / s + 64, (z - m.z) / s + 64]; }

  // A map in an item frame (turned `rot` eighths; a map turns a quarter each time): the layer its
  // picture is in, kept up to date (null while it isn't known). Each map shown gets one of the
  // layers; when they're all taken, the one used longest ago gives way.
  framedLayer(id) {
    const m = this.get(id);
    if (!m) { this.want(id); return null; }
    let f = this.frames.get(id);
    if (!f) {
      let slot = this.slots.indexOf(null);
      if (slot < 0) {
        let old = null;
        for (const [k, v] of this.frames) if (!old || v.used < old[1].used) old = [k, v];
        slot = old[1].slot;
        this.forgetFrame(old[0]);
      }
      this.slots[slot] = id;
      f = { slot, ver: -1, used: 0, layer: 0 };
      this.frames.set(id, f);
    }
    f.used = ++this.uses;
    if (f.ver !== m.ver) { f.layer = this.game.renderer.mapLayer(f.slot, this.small(m)); f.ver = m.ver; }
    return f;
  }
  forgetFrame(id) {
    const f = this.frames.get(id);
    if (!f) return;
    this.frames.delete(id);
    if (this.slots[f.slot] === id) this.slots[f.slot] = null;
  }
  // The picture at half size for a frame (64 by 64, the size of the layers), on paper.
  small(m) {
    const out = new Uint8Array(64 * 64 * 4);
    for (let z = 0; z < 64; z++) for (let x = 0; x < 64; x++) {
      const o = (z * 64 + x) * 4;
      let r = 0, g = 0, b = 0, n = 0;
      for (const [dx, dz] of [[0, 0], [1, 0], [0, 1], [1, 1]]) {
        const v = m.px[(z * 2 + dz) * MAP_SIZE + x * 2 + dx];
        if (v < 4) continue;
        r += PALETTE[v * 4]; g += PALETTE[v * 4 + 1]; b += PALETTE[v * 4 + 2]; n++;
      }
      // (Unexplored: the paper; at the edge, a darker rim.)
      const edge = x === 0 || z === 0 || x === 63 || z === 63;
      if (n < 2 || edge) { out.set(edge ? [150, 122, 84, 255] : [222, 204, 164, 255], o); continue; }
      out.set([r / n, g / n, b / n, 255], o);
    }
    return out;
  }
}

// ---------------------------------------------------------------- the map in hand
// Drawn over the view at the bottom of the screen, as Minecraft holds a map in both hands: brought
// up as you look down. Paper round the edge, the map, and arrows for the players.
export class HeldMap {
  constructor(game) {
    this.game = game;
    this.el = document.createElement('canvas');
    this.el.id = 'held-map';
    this.el.width = this.el.height = 144;
    this.el.hidden = true;
    this.ctx = this.el.getContext('2d');
    this.img = this.ctx.createImageData(MAP_SIZE, MAP_SIZE);
    this.drawn = null;
    // (Under the hotbar and the rest of the HUD, as Minecraft draws it.)
    const hud = document.getElementById('hud');
    hud?.insertBefore(this.el, document.getElementById('nametags'));
  }
  // `stack`: the map in hand (or null to hide it).
  update(stack) {
    const g = this.game, el = this.el;
    const show = !!stack && g.view === 0 && (g.state === 'play' || g.state === 'chat') && !g.hideHud;
    if (el.hidden === show) el.hidden = !show;
    if (!show) { this.drawn = null; return; }
    const p = g.player;
    // (Looking down brings it up and nearer; looking ahead it sits low.)
    const lift = Math.max(0, Math.min(1, -p.pitch / 1.2));
    el.style.transform = `translate(-50%, ${Math.round((1 - lift) * 42)}%) scale(${(1 + lift * 0.3).toFixed(3)}) rotate(${(p.bob ? Math.sin(p.bobPhase) * p.bob * 0.6 : 0).toFixed(2)}deg)`;
    const m = stack.id === I.filled_map ? g.maps.get(stack.map) : null;
    if (stack.id === I.filled_map && !m) g.maps.want(stack.map);
    const key = m ? `${m.id}:${m.ver}:${Math.round(p.x * 2)}:${Math.round(p.z * 2)}:${Math.round(p.yaw * 20)}:${g.net?.others?.().length ?? 0}` : 'blank';
    if (key === this.drawn && !g.net) return;
    this.drawn = key;
    const c = this.ctx;
    this.paper(c);
    if (!m) return;
    g.maps.rgba(m, this.img.data);
    c.putImageData(this.img, 8, 8);
    // Players: yourself as a white arrow, others blue; at the edge as a dot if off the map.
    const others = (g.net?.others?.() ?? []).filter((o) => !o.spectator);
    for (const q of [...others.map((o) => ({ x: o.x, z: o.z, yaw: g.net.players?.get?.(o.addr)?.yaw ?? 0, me: false })), { x: p.x, z: p.z, yaw: p.yaw, me: true }]) {
      if (!Number.isFinite(q.x)) continue;
      const [mx, mz] = g.maps.where(m, q.x, q.z);
      const off = mx < 0 || mz < 0 || mx >= MAP_SIZE || mz >= MAP_SIZE;
      const x = 8 + Math.max(0, Math.min(MAP_SIZE - 1, mx)), z = 8 + Math.max(0, Math.min(MAP_SIZE - 1, mz));
      this.marker(c, x, z, q.yaw, q.me ? '#ffffff' : '#5a8cff', off);
    }
  }
  paper(c) {
    c.fillStyle = '#d9c49a'; c.fillRect(0, 0, 144, 144);
    c.fillStyle = '#e8d8b0'; c.fillRect(3, 3, 138, 138);
    c.fillStyle = '#efe3c4'; c.fillRect(7, 7, 130, 130);
    // (A few fibres in the paper.)
    c.fillStyle = 'rgba(120, 90, 50, 0.12)';
    for (let i = 0; i < 40; i++) c.fillRect((i * 37) % 138 + 3, (i * 53) % 138 + 3, 2, 1);
    c.strokeStyle = '#8a6a3e'; c.lineWidth = 2; c.strokeRect(1, 1, 142, 142);
  }
  // An arrow pointing the way someone faces (as Minecraft's map markers), or a dot off the edge.
  marker(c, x, z, yaw, colour, off) {
    c.save();
    c.translate(x, z);
    if (off) { c.fillStyle = colour; c.strokeStyle = '#000'; c.lineWidth = 1; c.beginPath(); c.arc(0, 0, 2.2, 0, Math.PI * 2); c.fill(); c.stroke(); c.restore(); return; }
    c.rotate(-yaw);
    c.beginPath();
    c.moveTo(0, -5); c.lineTo(3.5, 4); c.lineTo(0, 2.2); c.lineTo(-3.5, 4); c.closePath();
    c.fillStyle = colour; c.strokeStyle = '#1a1a1a'; c.lineWidth = 1;
    c.fill(); c.stroke();
    c.restore();
  }
}

export const isMap = (id) => id === I.filled_map || id === I.map;
// (For the tests: the colour a block shows on a map.)
export const mapColourOf = (id) => colourOf?.[id] ?? 0;
