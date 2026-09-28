// The minimap in the top right corner, as the Xaero's Minimap mod draws one: the land round you
// from above in its own colours (grass, leaves and water in their biome's), shaded where it rises
// and falls and lit by the sun or by torches, turning as you turn (or with north kept up), with
// creatures, other players and waypoints on it, and where you are under it. Under a roof (in a
// cave, or indoors) it shows what's at your level instead. Each chunk's picture is worked out once
// (again when something in it changes, or the daylight does); they're put together on one canvas
// round you, which is drawn turned and scaled each frame.
import { MIN_Y, MAX_Y, CHUNK_HEIGHT, SECTIONS } from './config.js';
import { BLOCKS, RENDER, R, TINT, TINT_RGB, TEXL, WATERLIKE, SOLID, OPAQUE } from './blocks.js';
import { BIOME_NAMES } from './biomes.js';
import { DYES } from './colors.js';

// How close the map is: GUI pixels to a block. (The first is zoomed right out.)
export const MAP_ZOOMS = [0.5, 0.75, 1, 1.5, 2, 3];
// Sizes, GUI pixels across.
export const MAP_SIZES = [48, 64, 88];
// Radar dots: players, monsters, village folk, pets, other creatures.
const DOT = { player: '#ffffff', hostile: '#ff4a4a', folk: '#6fe06f', pet: '#6aa8ff', animal: '#f2d24a' };
// How far down it looks for a floor under you, underground.
const CAVE_DEPTH = 48;

// ---------------------------------------------------------------- block colours
// Each block's colour seen from above: the average of its top face's texture (tinted as it is in
// the world), and whether the map sees through it (air, glass, bars, torches, fire, most plants).
let RGB = null, SEE = null;
export function initMinimapColours(pixels) {
  const n = RENDER.length;
  RGB = new Uint8Array(n * 3);
  SEE = new Uint8Array(n);
  for (let id = 0; id < n; id++) {
    const kind = RENDER[id];
    if (!id || !BLOCKS[id] || kind === R.NONE || kind === R.TORCH || kind === R.FIRE) { SEE[id] = 1; continue; }
    const layer = TEXL[id * 6 + 2], src = pixels.subarray(layer * 1024, layer * 1024 + 1024);
    let r = 0, g = 0, b = 0, k = 0;
    for (let i = 0; i < 1024; i += 4) if (src[i + 3] > 127) { r += src[i]; g += src[i + 1]; b += src[i + 2]; k++; }
    // (Mostly see-through: glass, bars, a ladder, a rail, a small flower. The map shows what's
    // under it.)
    if (k < (kind === R.CROSS || kind === R.RAIL ? 48 : 64)) { SEE[id] = 1; continue; }
    r /= k; g /= k; b /= k;
    if (TINT[id] === 3) { r *= TINT_RGB[id * 3] / 255; g *= TINT_RGB[id * 3 + 1] / 255; b *= TINT_RGB[id * 3 + 2] / 255; }
    RGB[id * 3] = r; RGB[id * 3 + 1] = g; RGB[id * 3 + 2] = b;
  }
}

// (Heights here are rows of the chunk, counted up from its bottom at MIN_Y.)
// The top block's height in a chunk (skipping empty sections).
function topY(c) {
  for (let sy = SECTIONS - 1; sy >= 0; sy--) if (c.sections[sy].count) return sy * 16 + 15;
  return 0;
}

// What the map shows of column `col` of chunk `c`: the height of the block it shows (-1 when
// there's nothing to show), and the top of any water over it (-1 when there's none). `cave`: the
// level it looks down from underground (null on the surface); a column that's solid there is
// rock (shown as such: `rock`).
const found = { y: -1, water: -1, rock: false };
function surface(c, col, cave) {
  const blocks = c.blocks;
  let y = cave === null ? topY(c) : Math.min(CHUNK_HEIGHT - 1, cave - MIN_Y);
  found.water = -1; found.rock = false;
  if (cave !== null) {
    const id = blocks[(y << 8) | col];
    if (SOLID[id] && OPAQUE[id]) { found.y = y; found.rock = true; return found; }
  }
  const floor = cave === null ? 0 : Math.max(0, cave - MIN_Y - CAVE_DEPTH);
  for (; y >= floor; y--) {
    const id = blocks[(y << 8) | col];
    if (SEE[id]) continue;
    if (WATERLIKE[id] === 1) { if (found.water < 0) found.water = y; continue; }
    found.y = y;
    return found;
  }
  found.y = found.water >= 0 ? floor : -1;
  return found;
}

// ---------------------------------------------------------------- the map
export class Minimap {
  constructor(game, canvas, info) {
    this.game = game;
    this.canvas = canvas;
    this.info = info;
    this.ctx = canvas.getContext('2d');
    this.tiles = new Map();   // chunk key -> { canvas, img, cave, day, dirty }
    this.heights = new Int16Array(17 * 17);
    this.wet = new Uint8Array(16 * 16);
    this.region = null;
    this.lastInfo = '';
    this.shown = false;
    this.font = null;
  }

  reset() { this.tiles.clear(); this.region = null; }

  // Something changed at (x, z) (a block, or a chunk arrived): that chunk's picture, and those round
  // it (their shading looks across the edge, and light spreads), are redrawn soon.
  changed(x, z) {
    const cx = x >> 4, cz = z >> 4;
    for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) {
      const t = this.tiles.get(`${cx + dx},${cz + dz}`);
      if (t) t.dirty = true;
    }
  }

  // The height the map shows at (x, z), for shading (-1 where the land isn't loaded).
  height(w, x, z, cave) {
    const c = w.readyChunk(x >> 4, z >> 4);
    if (!c) return -1;
    const s = surface(c, ((z & 15) << 4) | (x & 15), cave);
    return s.water >= 0 ? s.water : s.y;
  }

  // One chunk's picture, for the surface or for what's round level `cave`. `day`: how bright
  // daylight is (0-1).
  paint(t, c, cave, day) {
    const w = this.game.world, out = t.img.data, hs = this.heights, wet = this.wet, light = c.light, blocks = c.blocks;
    const tints = c.tints ?? w.rawTints(c);
    for (let col = 0; col < 256; col++) {
      const o = col * 4, s = surface(c, col, cave), hi = ((col >> 4) + 1) * 17 + (col & 15) + 1;
      wet[col] = s.water >= 0 ? 1 : 0;
      if (s.rock) { out[o] = 24; out[o + 1] = 22; out[o + 2] = 26; out[o + 3] = 255; hs[hi] = s.y; continue; }
      if (s.y < 0) { out[o] = out[o + 1] = out[o + 2] = 0; out[o + 3] = cave === null ? 0 : 255; hs[hi] = -1; continue; }
      const id = blocks[(s.y << 8) | col];
      let r = RGB[id * 3], g = RGB[id * 3 + 1], b = RGB[id * 3 + 2];
      const tint = TINT[id];
      if (tint === 1 || tint === 2) {
        const ti = (tint === 1 ? 0 : 768) + col * 3;
        r = (r * tints[ti]) / 255; g = (g * tints[ti + 1]) / 255; b = (b * tints[ti + 2]) / 255;
      }
      let top = s.y;
      // Water over it: the bottom shows through, less the deeper it is.
      if (s.water >= 0) {
        const a = Math.min(0.9, 0.52 + (s.water - s.y) * 0.05), wi = 1536 + col * 3;
        r = r * (1 - a) + tints[wi] * 0.6 * a; g = g * (1 - a) + tints[wi + 1] * 0.6 * a; b = b * (1 - a) + tints[wi + 2] * 0.6 * a;
        top = s.water;
      }
      hs[hi] = top;
      // Lit as the world is (by day the sun, at night torches), never quite black.
      const above = top + 1 < CHUNK_HEIGHT ? light[((top + 1) << 8) | col] : 0xf0;
      const lit = Math.max(above & 15, (above >> 4) * day) / 15;
      const k = cave === null ? 0.28 + 0.72 * lit : 0.55 + 0.45 * lit;
      out[o] = r * k; out[o + 1] = g * k; out[o + 2] = b * k; out[o + 3] = 255;
    }
    // (The row north of it and the column west, from the chunks next to it.)
    const x0 = c.cx * 16, z0 = c.cz * 16;
    for (let i = 0; i <= 16; i++) {
      hs[i] = this.height(w, x0 - 1 + i, z0 - 1, cave);
      hs[i * 17] = this.height(w, x0 - 1, z0 - 1 + i, cave);
    }
    // Shaded like the original's maps: land higher than the column north-west of it catches the
    // light, lower land is in shadow. (Water shows its depth instead.)
    for (let col = 0; col < 256; col++) {
      if (wet[col]) continue;
      const x = col & 15, z = col >> 4, h = hs[(z + 1) * 17 + x + 1], nw = hs[z * 17 + x];
      if (h < 0 || nw < 0) continue;
      const d = Math.max(-3, Math.min(3, h - nw)), k = d > 0 ? 1 + d * 0.08 : 1 + d * 0.1, o = col * 4;
      out[o] = Math.min(255, out[o] * k); out[o + 1] = Math.min(255, out[o + 1] * k); out[o + 2] = Math.min(255, out[o + 2] * k);
    }
    t.ctx.putImageData(t.img, 0, 0);
    t.cave = cave; t.day = day; t.dirty = false;
  }

  tile(key) {
    let t = this.tiles.get(key);
    if (!t) {
      const canvas = newCanvas(16);
      t = { canvas, ctx: canvas.getContext('2d'), img: new ImageData(16, 16), cave: undefined, day: -1, dirty: true };
      this.tiles.set(key, t);
    }
    return t;
  }

  // Under a roof (no sky over your head, and something solid above): what's round your level.
  underground() {
    const g = this.game, p = g.player, w = g.world;
    if (g.settings.caveMode === 0) return null;
    const x = Math.floor(p.x), y = Math.floor(p.eyeY), z = Math.floor(p.z);
    if ((w.getLight(x, y, z) >> 4) > 4) return null;
    for (let yy = y + 1; yy < Math.min(MAX_Y, y + 40); yy++) { const id = w.getBlock(x, yy, z); if (SOLID[id] && OPAQUE[id]) return Math.floor(p.y) + 1; }
    return null;
  }

  update() {
    const g = this.game, s = g.settings, el = this.canvas, hud = document.getElementById('hud');
    const show = !!s.minimap && !!g.world && g.state !== 'loading' && !g.hideHud;
    if (show !== this.shown) { this.shown = show; el.parentElement.hidden = !show; hud.classList.toggle('with-map', show); }
    if (!show) return;
    const p = g.player, w = g.world, u = g.ui.u || 3, dpr = window.devicePixelRatio || 1;
    const size = MAP_SIZES[s.minimapSize] ?? MAP_SIZES[1], px = Math.round(size * u * dpr);
    if (el.width !== px) {
      el.width = el.height = px;
      el.style.width = el.style.height = `${size * u}px`;
      hud.style.setProperty('--map', `${size * u}px`);
    }
    const zoom = MAP_ZOOMS[s.minimapZoom] ?? 1, scale = zoom * u * dpr, cave = this.underground();
    // (Daylight in steps, so the pictures are only drawn again as it changes.)
    const day = Math.round((g.env?.daylight ?? 1) * 12) / 12;
    // The chunks the map can reach (turned, its corners reach further), put together round you;
    // those out of date are drawn again a few at a time, nearest first.
    const reach = (px / 2 / scale) * Math.SQRT2 + 8, rc = Math.min(12, Math.ceil(reach / 16));
    const pcx = Math.floor(p.x) >> 4, pcz = Math.floor(p.z) >> 4;
    const region = this.regionFor(pcx, pcz, rc);
    const due = [];
    for (let cz = pcz - rc; cz <= pcz + rc; cz++) {
      for (let cx = pcx - rc; cx <= pcx + rc; cx++) {
        const c = w.readyChunk(cx, cz), key = `${cx},${cz}`;
        if (!c) { if (region.shown.delete(key)) region.ctx.clearRect((cx - region.cx0) * 16, (cz - region.cz0) * 16, 16, 16); continue; }
        const t = this.tile(key);
        if (t.dirty || t.cave !== cave || t.day !== day) due.push([Math.abs(cx - pcx) + Math.abs(cz - pcz), t, c, key]);
        else if (region.shown.get(key) !== t.stamp) this.place(region, cx, cz, t, key);
      }
    }
    due.sort((a, b) => a[0] - b[0]);
    for (let i = 0; i < Math.min(due.length, 8); i++) {
      const [, t, c, key] = due[i];
      this.paint(t, c, cave, day);
      t.stamp = (t.stamp ?? 0) + 1;
      this.place(region, c.cx, c.cz, t, key);
    }
    // (Pictures of chunks well out of reach are let go.)
    if (this.tiles.size > (rc * 2 + 7) ** 2) {
      for (const k of this.tiles.keys()) {
        const [cx, cz] = k.split(',').map(Number);
        if (Math.abs(cx - pcx) > rc + 3 || Math.abs(cz - pcz) > rc + 3) this.tiles.delete(k);
      }
    }
    this.draw(this.ctx, px, scale, s.minimapShape === 1, cave, region, u * dpr);
    this.text(cave);
  }

  place(region, cx, cz, t, key) {
    const x = (cx - region.cx0) * 16, z = (cz - region.cz0) * 16;
    region.ctx.clearRect(x, z, 16, 16);
    region.ctx.drawImage(t.canvas, x, z);
    region.shown.set(key, t.stamp);
  }

  // The canvas the chunks' pictures are put together on, round chunk (cx, cz), `rc` chunks each
  // way (begun again when you've moved on to another chunk, or the reach has changed).
  regionFor(cx, cz, rc) {
    let r = this.region;
    if (r && r.cx === cx && r.cz === cz && r.rc === rc) return r;
    const n = (rc * 2 + 1) * 16;
    if (!r || r.canvas.width !== n) { const canvas = newCanvas(n); r = { canvas, ctx: canvas.getContext('2d') }; }
    r.ctx.clearRect(0, 0, n, n);
    Object.assign(r, { cx, cz, rc, cx0: cx - rc, cz0: cz - rc, shown: new Map() });
    this.region = r;
    return r;
  }

  // Where a point of the world is on the map, in canvas pixels from its middle.
  onMap(x, z, scale, rot) {
    const p = this.game.player, dx = (x - p.x) * scale, dz = (z - p.z) * scale;
    const c = Math.cos(rot), s = Math.sin(rot);
    return [dx * c - dz * s, dx * s + dz * c];
  }

  // `u`: canvas pixels to a GUI pixel.
  draw(ctx, px, scale, round, cave, region, u) {
    const g = this.game, p = g.player, s = g.settings, half = px / 2, font = this.fontName();
    const rot = s.lockNorth ? 0 : p.yaw;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, px, px);
    ctx.save();
    ctx.beginPath();
    if (round) ctx.arc(half, half, half, 0, Math.PI * 2); else ctx.rect(0, 0, px, px);
    ctx.clip();
    ctx.fillStyle = cave === null ? '#0b0d12' : '#050506';
    ctx.fillRect(0, 0, px, px);
    // The land, turned as you face.
    ctx.imageSmoothingEnabled = false;
    ctx.translate(half, half);
    ctx.rotate(rot);
    ctx.drawImage(region.canvas, (region.cx0 * 16 - p.x) * scale, (region.cz0 * 16 - p.z) * scale, region.canvas.width * scale, region.canvas.height * scale);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    // Creatures and players, as dots (fainter well above or below you).
    if (s.radar !== false) {
      const dot = (x, y, z, colour, r) => {
        const [mx, mz] = this.onMap(x, z, scale, rot);
        if (Math.abs(mx) > half - r || Math.abs(mz) > half - r || (round && Math.hypot(mx, mz) > half - r)) return null;
        ctx.globalAlpha = Math.abs(y - p.y) > 10 ? 0.45 : 1;
        ctx.fillStyle = '#000';
        ctx.fillRect(Math.round(half + mx - r - u * 0.5), Math.round(half + mz - r - u * 0.5), Math.round(r * 2 + u), Math.round(r * 2 + u));
        ctx.fillStyle = colour;
        ctx.fillRect(Math.round(half + mx - r), Math.round(half + mz - r), Math.round(r * 2), Math.round(r * 2));
        ctx.globalAlpha = 1;
        return [half + mx, half + mz];
      };
      for (const e of g.entities.list) {
        if (e.kind !== 'mob' || e.dead || e.dying) continue;
        const kind = e.def.hostile ? 'hostile' : e.def.kind === 'civilian' ? 'folk' : e.tame ? 'pet' : 'animal';
        dot(e.x, e.y, e.z, DOT[kind], u * (e.def.hostile ? 1.2 : 1));
      }
      if (g.net) {
        ctx.font = `${Math.round(u * 6)}px ${font}`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'alphabetic';
        for (const rp of g.net.players.values()) {
          if (!rp.ready || rp.dead || rp.invisible) continue;
          const at = dot(rp.x, rp.y, rp.z, DOT.player, u * 1.5);
          if (!at) continue;
          ctx.fillStyle = '#000'; ctx.fillText(rp.name, at[0] + u * 0.6, at[1] - u * 2.4);
          ctx.fillStyle = '#fff'; ctx.fillText(rp.name, at[0], at[1] - u * 3);
        }
      }
    }
    // Waypoints, kept to the edge when they're off it.
    for (const wp of g.waypoints?.list ?? []) {
      if (!wp.on) continue;
      let [mx, mz] = this.onMap(wp.x + 0.5, wp.z + 0.5, scale, rot);
      const edge = half - u * 5;
      if (round) { const d = Math.hypot(mx, mz); if (d > edge) { mx *= edge / d; mz *= edge / d; } }
      else { const m = Math.max(Math.abs(mx), Math.abs(mz)); if (m > edge) { mx *= edge / m; mz *= edge / m; } }
      waypointIcon(ctx, half + mx, half + mz, wp, u, font);
    }
    // You: an arrow in the middle, pointing the way you face.
    ctx.translate(half, half);
    ctx.rotate(s.lockNorth ? -p.yaw : 0);
    ctx.beginPath();
    ctx.moveTo(0, -u * 4); ctx.lineTo(u * 3, u * 3.2); ctx.lineTo(0, u * 1.6); ctx.lineTo(-u * 3, u * 3.2); ctx.closePath();
    ctx.lineJoin = 'miter';
    ctx.lineWidth = u * 1.2; ctx.strokeStyle = '#141414'; ctx.stroke();
    ctx.fillStyle = '#f4f4f4'; ctx.fill();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    // The compass points round the edge, north in red.
    ctx.font = `${Math.round(u * 7)}px ${font}`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const c = Math.cos(rot), sn = Math.sin(rot), r = half - u * 5;
    for (const [label, x, z] of [['N', 0, -1], ['E', 1, 0], ['S', 0, 1], ['W', -1, 0]]) {
      let lx = x * c - z * sn, lz = x * sn + z * c;
      if (!round) { const m = Math.max(Math.abs(lx), Math.abs(lz)); lx /= m; lz /= m; }
      ctx.fillStyle = '#000'; ctx.fillText(label, half + lx * r + u * 0.7, half + lz * r + u * 0.7);
      ctx.fillStyle = label === 'N' ? '#ff5a5a' : '#f0f0f0'; ctx.fillText(label, half + lx * r, half + lz * r);
    }
    ctx.restore();
    // The frame.
    ctx.lineWidth = u;
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.85)';
    ctx.beginPath();
    if (round) ctx.arc(half, half, half - u / 2, 0, Math.PI * 2); else ctx.rect(u / 2, u / 2, px - u, px - u);
    ctx.stroke();
  }

  fontName() { return (this.font ??= getComputedStyle(document.body).getPropertyValue('--font-ui').trim() || 'monospace'); }

  // Under the map: where you are, and the biome (or that you're looking at what's underground).
  text(cave) {
    const g = this.game, p = g.player;
    let text = '';
    if (g.settings.mapCoords !== false) {
      const b = g.world.biomeAt(Math.floor(p.x), Math.floor(p.z));
      text = `${Math.floor(p.x)}, ${Math.floor(p.y)}, ${Math.floor(p.z)}\n${cave !== null ? 'Underground' : BIOME_NAMES[b] ?? ''}`;
    }
    if (text !== this.lastInfo) { this.lastInfo = text; this.info.textContent = text; this.info.hidden = !text; }
  }
}

const newCanvas = (n) => (typeof globalThis.OffscreenCanvas === 'function' ? new globalThis.OffscreenCanvas(n, n) : Object.assign(document.createElement('canvas'), { width: n, height: n }));

// A waypoint's colour (a dead player's is dark).
export const waypointColour = (wp) => (wp.death ? '#3a3a3a' : `#${DYES[wp.c]?.wool.toString(16).padStart(6, '0') ?? 'ffffff'}`);
// Its initials (a death is marked with an X).
export const initials = (wp) => (wp.death ? 'X' : String(wp.name).trim().split(/\s+/).map((w) => w[0] ?? '').join('').slice(0, 2).toUpperCase() || 'W');

// A waypoint's mark on the map: a square in its colour with its initials. `u`: canvas pixels to a
// GUI pixel.
export function waypointIcon(ctx, x, y, wp, u, font) {
  const s = Math.round(u * 4);
  x = Math.round(x); y = Math.round(y);
  ctx.fillStyle = '#000';
  ctx.fillRect(x - s - u, y - s - u, s * 2 + u * 2, s * 2 + u * 2);
  ctx.fillStyle = waypointColour(wp);
  ctx.fillRect(x - s, y - s, s * 2, s * 2);
  ctx.font = `${Math.round(u * 6)}px ${font}`;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillStyle = '#fff';
  ctx.fillText(initials(wp), x, y + u * 0.5);
}
