// Playing together. One player's game hosts the world and the others join it.
//
// The host runs the world as in single player (block updates, mobs, items, TNT, furnaces, time
// and weather), keeps the ground around every guest loaded, and tells its guests what changes.
// Guests build the same terrain from the seed, fetch only the chunks that were changed from the
// host, and otherwise play as usual: what they build and break, drop, hit and move around in
// chests is sent to the host, which applies it and passes the results on to everyone.
// Where each player stands and looks and what they hold travels in their presence (net.js),
// which is also how open games are listed in the claude.ai room.
import { Link, RoomTransport, PeerTransport, PROTOCOL, cleanCode } from './net.js';
import { RemotePlayer } from './avatars.js';
import { mobFlags, mobExtra } from './entities.js';
import { encodeRLE16, decodeRLE16 } from './storage.js';
import { B, BLOCKS, REPLACEABLE, CHEST, FURNACE_IDS, SIGN } from './blocks.js';
import { itemDef, maxStack } from './items.js';
import { extras, cleanExtras } from './inventory.js';
import { shiny } from './enchanting.js';
import { chunkKey, HEIGHT, CHUNK_VOLUME } from './config.js';
import { S_READY, rayBox } from './world.js';
import { clamp } from './math.js';
import { startRide, seatY, BOAT_WOODS } from './riding.js';
import { POTIONS, EFFECTS } from './potions.js';

const MAX_GUESTS = 7;
const KEEP_RADIUS = 4;   // chunks the host keeps loaded (and mobs going) around each guest
const SAVE_EVERY = 10;   // seconds between a guest's progress reports to the host
export const COLORS = { y: '#ffff55', r: '#ff6b5b', g: '#f3b73f', s: '#a8a8a8' };

const num = (v) => typeof v === 'number' && Number.isFinite(v);
const int = Number.isInteger;
const r2 = (v) => Math.round(v * 100) / 100;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
function randomId(n) {
  let s = '';
  while (s.length < n) s += Math.random().toString(36).slice(2);
  return s.slice(0, n);
}

// Names are other people's input: no control or invisible characters, at most 16 long.
export function cleanName(text) {
  const s = String(text ?? '').replace(/\p{C}/gu, '').replace(/\s+/g, ' ').trim().slice(0, 16);
  return s || 'Player';
}

// A random id kept in this browser, so a host can give a returning guest their things back.
let memoryUid = null;
export function playerUid() {
  try {
    let id = localStorage.getItem('blockhaven.uid');
    if (!id) { id = randomId(16); localStorage.setItem('blockhaven.uid', id); }
    return id;
  } catch {
    return (memoryUid ??= randomId(16));
  }
}

let roomPromise = null;
// The claude.ai room for this page (null anywhere else). One per page, shared by the game list
// and whatever game is being played.
export function openRoom() {
  roomPromise ??= RoomTransport.open();
  return roomPromise;
}

// Open games in the room, from the hosts' presence.
export function openGames(room) {
  return room.list().filter(([, p]) => p && p.h === 1 && typeof p.g === 'string').map(([addr, p]) => ({
    addr,
    host: cleanName(p.n),
    world: String(p.hw ?? 'World').replace(/\p{C}/gu, '').slice(0, 32) || 'World',
    mode: p.hm === 'creative' ? 'Creative' : 'Survival',
    players: int(p.hp) ? clamp(p.hp, 1, 99) : 1,
    ok: p.v === PROTOCOL,
  }));
}

// ---------------------------------------------------------------- chunk data
// Chunks travel deflated where the browser can (a few kilobytes each), run-length encoded otherwise.
const DEFLATE = (() => {
  try { new CompressionStream('deflate-raw'); new DecompressionStream('deflate-raw'); return true; } catch { return false; }
})();

async function through(bytes, stream) {
  return new Uint8Array(await new Response(new Blob([bytes]).stream().pipeThrough(stream)).arrayBuffer());
}

function toBase64(u8) {
  let s = '';
  for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000));
  return btoa(s);
}

function fromBase64(text) {
  const s = atob(text);
  const u8 = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) u8[i] = s.charCodeAt(i);
  return u8;
}

// Block ids are 16-bit; deflate sees their bytes (little-endian, as every browser stores them).
async function packChunk(blocks, deflate) {
  const bytes = new Uint8Array(blocks.buffer, blocks.byteOffset, blocks.byteLength);
  if (deflate && DEFLATE) return { z: 1, d: toBase64(await through(bytes, new CompressionStream('deflate-raw'))) };
  return { z: 0, d: toBase64(encodeRLE16(blocks)) };
}

async function unpackChunk(msg) {
  const bytes = fromBase64(msg.d);
  let blocks;
  if (msg.z === 1) {
    const raw = await through(bytes, new DecompressionStream('deflate-raw'));
    if (raw.length !== CHUNK_VOLUME * 2) throw new Error('chunk has the wrong size');
    blocks = new Uint16Array(raw.buffer, raw.byteOffset, CHUNK_VOLUME).slice();
  } else blocks = decodeRLE16(bytes, CHUNK_VOLUME);
  for (let i = 0; i < blocks.length; i++) if (!BLOCKS[blocks[i]]) blocks[i] = 0;
  return blocks;
}

// ---------------------------------------------------------------- checks on what others send
export function cleanStack(s) {
  if (!s || typeof s !== 'object' || !itemDef(s.id) || !int(s.count) || s.count < 1) return null;
  return { id: s.id, count: Math.min(s.count, maxStack(s.id)), dmg: int(s.dmg) && s.dmg > 0 ? s.dmg : 0, ...cleanExtras(s) };
}

function parseKey(k) {
  if (typeof k !== 'string' || !/^-?\d{1,8},\d{1,3},-?\d{1,8}$/.test(k)) return null;
  const [x, y, z] = k.split(',').map(Number);
  return y < HEIGHT ? [x, y, z] : null;
}

const validChange = (c, n) => Array.isArray(c) && c.length >= n && c.slice(0, n).every(int) && c[1] >= 0 && c[1] < HEIGHT && !!BLOCKS[c[n - 1]];

// ---------------------------------------------------------------- common to host and guests
class Session {
  constructor(game, transport) {
    this.game = game;
    this.transport = transport;
    this.link = new Link();
    this.link.addTransport(transport);
    this.link.onMessage = (from, msg, b) => { if (msg && typeof msg.t === 'string' && !this.closed) this.message(from, msg, b); };
    this.link.onPresence = (addr, pres) => { if (!this.closed) this.presence(addr, pres); };
    this.link.onLoss = (from, b) => { if (!this.closed) this.loss(from, b); };
    this.players = new Map(); // address -> RemotePlayer, for everyone else in this game
    this.name = cleanName(game.settings.name);
    this.gid = null;
    this.applying = false;
    this.fx = false;
    this.closed = false;
    this.pvp = true;
    // The link keeps going when frames don't (a hidden tab).
    this.pump = setInterval(() => { if (!this.closed) { this.link.flush(); this.link.tick(); } }, 50);
  }

  get host() { return false; }
  get guest() { return false; }
  get via() { return this.transport.kind; }
  get code() { return this.transport.kind === 'peer' ? this.transport.code : null; }
  get count() { return 1 + this.players.size; }

  send(to, msg) { if (!this.closed) this.link.send(to, msg); }

  // Another player's presence (null: they left). Only players in this game are drawn.
  seePlayer(addr, pres) {
    if (!pres || pres.g !== this.gid || pres.v !== PROTOCOL) {
      this.players.delete(addr);
      return null;
    }
    let rp = this.players.get(addr);
    if (!rp) { rp = new RemotePlayer(addr); this.players.set(addr, rp); }
    rp.update(pres, cleanName(pres.n), performance.now());
    return rp;
  }

  // Everyone we already know about (presence only arrives when it changes).
  seeEveryone() { for (const [addr, pres] of this.transport.list()) this.presence(addr, pres); }

  // What everyone else sees of this player.
  myPresence() {
    const g = this.game, p = g.player;
    const pres = { v: PROTOCOL, n: this.name, g: this.gid };
    if (g.world && g.meta && g.state !== 'loading') {
      pres.p = [r2(p.x), r2(p.y), r2(p.z), r2(p.yaw), r2(p.pitch)];
      pres.f = (p.sneaking ? 1 : 0) | (p.sprinting ? 2 : 0) | (p.flying ? 4 : 0) | (p.onGround ? 8 : 0) |
        (g.state === 'dead' ? 16 : 0) | (g.state === 'sleeping' ? 32 : 0) | (g.creative ? 64 : 0) | (g.effects?.has('invisibility') ? 128 : 0);
      pres.i = g.handLook;
      if (shiny(g.inv.held)) pres.ih = 1;
      pres.a = g.inv.armor.map((s) => s?.id ?? 0);
      pres.k = g.settings.look;
      pres.s = g.swingCount;
      pres.u = g.hurtCount;
      // What they ride: [entity, x, y, z, yaw] (a guest moves their own mount; see rideMove).
      const m = g.riding;
      if (m) pres.r = [m.nid ?? 0, r2(m.x), r2(m.y), r2(m.z), r2(m.yaw)];
      // A fishing float out on the water.
      const b = g.fishing?.bobber;
      if (b) pres.fb = [r2(b.x), r2(b.y), r2(b.z)];
    }
    return pres;
  }

  update(dt) {
    const now = performance.now();
    for (const rp of this.players.values()) {
      rp.step(now, dt);
      if (rp.mountId !== null) this.seat(rp);
    }
    this.link.setPresence(this.myPresence());
  }

  // Someone riding sits on their mount as we see it here (so the two never drift apart).
  seat(rp) {
    const E = this.game.entities, e = E.byNid.get(rp.mountId) ?? E.list.find((x) => x.nid === rp.mountId);
    if (!e || e.dead) return;
    rp.x = e.x; rp.y = seatY(e); rp.z = e.z;
    rp.bodyYaw = e.yaw;
  }

  // The nearest other player along a ray (to hit them), or null.
  raycast(ox, oy, oz, dx, dy, dz, maxDist) {
    let best = null;
    for (const rp of this.players.values()) {
      if (!rp.ready || rp.dead) continue;
      const hit = rayBox(ox - rp.x, oy - rp.y, oz - rp.z, dx, dy, dz, [-0.3, 0, -0.3, 0.3, rp.sneaking ? 1.5 : 1.8, 0.3]);
      if (hit && hit.t <= maxDist && (!best || hit.t < best.t)) best = { player: rp, t: hit.t };
    }
    return best;
  }

  // Would a block at (x, y, z) overlap someone?
  blocksPlacement(x, y, z) {
    for (const rp of this.players.values()) {
      if (!rp.ready || rp.dead) continue;
      if (rp.x - 0.3 < x + 1 && rp.x + 0.3 > x && rp.y < y + 1 && rp.y + 1.8 > y && rp.z - 0.3 < z + 1 && rp.z + 0.3 > z) return true;
    }
    return false;
  }

  names() { return [this.name, ...[...this.players.values()].map((p) => p.name)]; }

  // Sets blocks that someone else changed, with their sounds when there are only a few.
  apply(list, updates) {
    if (!list.length || !this.game.world) return;
    const w = this.game.world;
    this.applying = true;
    this.fx = list.length <= 6;
    try {
      if (list.length <= 6) {
        for (const [x, y, z, id] of list) w.setBlock(x, y, z, id, { updates: false });
        if (updates) for (const [x, y, z] of list) w.neighborsChanged(x, y, z);
      } else w.setBlocksBulk(list.map((c) => [c[0], c[1], c[2], c[c.length - 1]]));
    } finally {
      this.applying = false;
      this.fx = false;
    }
  }

  message() {}
  presence() {}
  loss() {}

  close() {
    if (this.closed) return;
    this.closed = true;
    clearInterval(this.pump);
    this.link.flush();
    this.link.close();
    if (this.transport.kind === 'peer') this.transport.close();
    else this.transport.setPresence({});
    this.players.clear();
  }
}

// ---------------------------------------------------------------- host
export class HostSession extends Session {
  // kind: 'room' (everyone with this claude.ai page open) or 'code' (PeerJS join code).
  static async start(game, kind) {
    let t;
    if (kind === 'room') {
      t = await openRoom();
      if (!t) throw new Error('This page isn’t on claude.ai, so friends need a join code.');
      if (!(await t.whenReady(6000))) throw new Error('Couldn’t reach the other players on this page. Try again in a moment.');
      if (!(await t.probe())) throw new Error('Your access to this page doesn’t let you host here. Ask the owner to host, or use a join code.');
    } else {
      t = await PeerTransport.host();
    }
    return new HostSession(game, t);
  }

  constructor(game, transport) {
    super(game, transport);
    this.gid = randomId(8);
    this.guests = new Map();       // address -> { addr, uid, name, x, y, z, creative, dead, sleeping, deflate }
    this.changes = [];             // block changes waiting to go out
    this.sentEnts = new Map();     // entity id -> what guests were last told
    this.gone = new Map();         // entity id -> how it went ('d': died)
    this.nextNid = 1;
    this.entTimer = 0;
    this.furnaceTimer = 0;
    this.viewers = new Map();      // container key -> addresses of guests looking into it
    this.furnaceSent = new Map();
    this.pendingEdits = new Map(); // chunk key -> guest edits waiting for the chunk to load here
    this.sleepTime = 0;
  }

  get host() { return true; }
  get count() { return 1 + this.guests.size; }

  update(dt) {
    if (this.closed) return;
    super.update(dt);
    if (this.changes.length) { this.link.broadcast({ t: 'b', c: this.changes }); this.changes = []; }
    this.entTimer += dt;
    if (this.entTimer >= 0.1) { this.entTimer = 0; this.syncEntities(); }
    this.furnaceTimer += dt;
    if (this.furnaceTimer >= 0.25) { this.furnaceTimer = 0; this.syncFurnaces(); }
    const keep = [];
    for (const g of this.guests.values()) if (g.x !== null) keep.push([Math.floor(g.x) >> 4, Math.floor(g.z) >> 4, KEEP_RADIUS]);
    this.game.world?.setKeep(keep);
    this.checkSleep(dt);
    this.link.flush();
  }

  myPresence() {
    const game = this.game, pres = super.myPresence();
    Object.assign(pres, {
      h: 1, hw: game.meta?.name ?? '', hm: game.meta?.mode ?? 'survival', hp: this.count,
      tm: Math.floor(game.time / 20) * 20, wr: game.weather.raining ? 1 : 0,
    });
    if (this.code) pres.hc = this.code;
    return pres;
  }

  say(text, color = null) {
    this.game.ui.message(text, COLORS[color] ?? null);
    this.link.broadcast({ t: 'msg', s: text, c: color });
  }

  presence(addr, pres) {
    const g = this.guests.get(addr);
    if (!pres) { if (g) this.remove(g, 'left the game'); this.players.delete(addr); return; }
    if (!g || pres.g !== this.gid) return;
    g.name = cleanName(pres.n);
    if (Array.isArray(pres.p) && pres.p.length >= 3 && pres.p.slice(0, 3).every(num)) [g.x, g.y, g.z] = pres.p;
    // Where they look and what they hold (animals follow food; endermen mind being stared at).
    if (Array.isArray(pres.p) && pres.p.length >= 5 && num(pres.p[3]) && num(pres.p[4])) {
      const yaw = pres.p[3], pitch = clamp(pres.p[4], -1.6, 1.6), cp = Math.cos(pitch);
      g.look = [-Math.sin(yaw) * cp, Math.sin(pitch), -Math.cos(yaw) * cp];
    }
    g.held = int(pres.i) ? pres.i : 0;
    const f = int(pres.f) ? pres.f : 0;
    g.sneaking = !!(f & 1);
    g.dead = !!(f & 16);
    g.sleeping = !!(f & 32);
    g.creative = !!(f & 64);
    g.invisible = !!(f & 128);
    if (Array.isArray(pres.r)) this.rideMove(g, pres.r);
    this.seePlayer(addr, pres);
  }

  // A guest's mount goes where they say it is (they steer it; see Game.steer), as long as they're
  // on it.
  rideMove(g, r) {
    if (r.length < 5 || !r.every(num)) return;
    const e = this.game.entities.list.find((x) => x.nid === r[0] && x.rider === g.addr && !x.dead);
    if (!e || (g.x !== null && Math.hypot(r[1] - g.x, r[3] - g.z) > 4)) return;
    e.tx = r[1]; e.ty = clamp(r[2], -64, HEIGHT + 64); e.tz = r[3]; e.tyaw = r[4];
  }

  // A guest gets into a boat or onto a horse (`on`), or off again. Only one rider at a time: anyone
  // else is turned away (as if thrown off).
  rideRequest(g, m) {
    const e = this.game.entities.list.find((x) => x.nid === m.e && !x.dead && (x.kind === 'boat' || x.def?.rideable));
    if (m.on) {
      const near = e && g.x !== null && Math.hypot(e.x - g.x, e.z - g.z) < 8;
      if (!e || !near || e.dying || (e.rider && e.rider !== g.addr) || (e.kind === 'mob' && e.baby)) { this.send(g.addr, { t: 'buck', e: m.e }); return; }
      startRide(e, g.addr);
      e.guestRider = true;
      e.tx = e.x; e.ty = e.y; e.tz = e.z; e.tyaw = e.yaw;
    } else if (e && e.rider === g.addr) this.unride(e);
  }

  unride(e) {
    e.rider = null;
    e.guestRider = false;
    e.drive = null;
    e.vx = e.vy = e.vz = 0;
  }

  // A guest's boat, set down where they pointed.
  placeBoatFor(g, m) {
    if (![m.x, m.y, m.z, m.a].every(num) || !BOAT_WOODS.includes(m.w) || g.x === null || Math.hypot(m.x - g.x, m.y - g.y, m.z - g.z) > 8) return;
    this.game.entities.spawnBoat(m.x, m.y, m.z, m.w, m.a);
  }

  remove(g, why) {
    if (!this.guests.delete(g.addr)) return;
    if (g.ref) g.ref.dead = true;
    this.players.delete(g.addr);
    for (const set of this.viewers.values()) set.delete(g.addr);
    for (const e of this.game.entities.list) if (e.rider === g.addr) this.unride(e);
    this.link.forget(g.addr);
    if (why) this.say(`${g.name} ${why}`, 'y');
  }

  message(from, msg, b) {
    if (b) return;
    if (msg.t === 'hi') { this.hello(from, msg); return; }
    const g = this.guests.get(from);
    if (!g) return;
    switch (msg.t) {
      case 'need': if (int(msg.k)) this.sendChunk(g, msg.k >>> 0); break;
      case 'e': if (Array.isArray(msg.c)) this.applyEdits(g, msg.c.slice(0, 4096)); break;
      case 'drop': this.drop(msg); break;
      case 'take': this.take(g, msg); break;
      case 'hit': this.hit(g, msg); break;
      case 'ride': if (int(msg.e)) this.rideRequest(g, msg); break;
      case 'boat': this.placeBoatFor(g, msg); break;
      case 'orb':
        // Experience a guest earned (mining, fishing, trading), as orbs where they are.
        if ([msg.x, msg.y, msg.z].every(num) && int(msg.n) && msg.n > 0 && g.x !== null && Math.hypot(msg.x - g.x, msg.y - g.y, msg.z - g.z) < 12) {
          this.game.entities.spawnXp(msg.x, msg.y, msg.z, Math.min(msg.n, 200));
        }
        break;
      case 'um': if (int(msg.e) && int(msg.i) && typeof msg.f === 'string') this.game.entities.remoteUse(msg.e, msg.i, msg.f, g.uid); break;
      case 'arw': this.arrow(g, msg); break;
      case 'sign': this.sign(msg); break;
      case 'pvp': this.pvpHit(g, msg); break;
      case 'tnt': if ([msg.x, msg.y, msg.z].every(int) && int(msg.f)) this.game.entities.primeTNT(msg.x, msg.y, msg.z, clamp(msg.f, 1, 200)); break;
      case 'chat': {
        const text = String(msg.s ?? '').replace(/\p{C}/gu, '').trim().slice(0, 120);
        if (text) this.say(`<${g.name}> ${text}`);
        break;
      }
      case 'cmd': this.remoteCommand(g, String(msg.s ?? '').slice(0, 120)); break;
      case 'open': this.open(g, msg); break;
      case 'shut': this.viewers.get(msg.k)?.delete(g.addr); break;
      case 'slots': this.slots(msg, g.addr); break;
      case 'save':
        if (msg.d && typeof msg.d === 'object' && JSON.stringify(msg.d).length < 30000) {
          const players = (this.game.meta.players ??= {});
          players[g.uid] = { ...msg.d, name: g.name };
        }
        break;
      case 'bye': this.remove(g, 'left the game'); break;
      default: break;
    }
  }

  hello(addr, msg) {
    const deny = (why) => { this.send(addr, { t: 'deny', why }); this.link.flush(); };
    if (msg.v !== PROTOCOL) { deny('That game is running a different version of Blockhaven. Reload the page, both of you.'); return; }
    let g = this.guests.get(addr);
    if (!g) {
      if (this.guests.size >= MAX_GUESTS) { deny('That game is full.'); return; }
      let uid = typeof msg.u === 'string' && msg.u ? msg.u.slice(0, 40) : addr;
      // The same browser twice (another tab, or the host's own): keep their saved things apart.
      if (uid === playerUid() || [...this.guests.values()].some((o) => o.uid === uid)) uid = `${uid}/${addr}`;
      g = { addr, uid, name: cleanName(msg.n), deflate: !!msg.z, x: null, y: 0, z: 0, creative: false, dead: false, sleeping: false };
      this.guests.set(addr, g);
      this.welcome(g);
      this.say(`${g.name} joined the game`, 'y');
    } else this.welcome(g); // asked again: they lost track and start over
  }

  welcome(g) {
    const game = this.game, w = game.world, meta = game.meta;
    // Unsaved edits go into the store so its list of changed chunks is complete.
    w.saveAll();
    this.link.flush();
    this.send(g.addr, {
      t: 'welcome', g: this.gid, be: this.link.epoch, bs: this.link.stream('*').seq, pvp: this.pvp ? 1 : 0,
      w: { name: meta.name, seed: meta.seed, type: meta.type, gen: meta.gen ?? 1, mode: meta.mode, spawn: meta.spawn, time: Math.floor(game.time),
        rain: game.weather.raining ? 1 : 0 },
      you: meta.players?.[g.uid] ?? null,
      keys: [...w.store.keys],
      ents: game.entities.list.filter((e) => !e.dead).map((e) => { if (!e.nid) e.nid = this.nextNid++; return entityState(e); }),
      signs: game.signs.serialize(),
    });
    this.link.flush();
  }

  async sendChunk(g, key) {
    const w = this.game.world;
    if (!w) return;
    let blocks = null;
    const c = w.chunks.get(key);
    if (c && c.state === S_READY) blocks = c.blocks.slice();
    else if (w.store?.has(key)) blocks = await w.store.loadChunk(key);
    if (this.closed || !this.guests.has(g.addr)) return;
    if (!blocks) { this.send(g.addr, { t: 'chunk', k: key }); return; }
    this.send(g.addr, { t: 'chunk', k: key, ...(await packChunk(blocks, g.deflate)) });
  }

  // A guest's own edits, as [x, y, z, what they saw there, what they made it]. Edits that still
  // fit what is here are made; the others are answered with what is really there.
  applyEdits(g, list) {
    const w = this.game.world;
    if (!w) return;
    const ok = [], fix = [];
    for (const c of list) {
      if (!validChange(c, 5)) continue;
      const [x, y, z, old, id] = c;
      if (!w.readyChunk(x >> 4, z >> 4)) {
        const key = chunkKey(x >> 4, z >> 4), q = this.pendingEdits.get(key) ?? [];
        if (q.length < 1024) q.push(c);
        this.pendingEdits.set(key, q);
        continue;
      }
      const cur = w.getBlock(x, y, z);
      if (cur === id) continue;
      if (cur === old || (REPLACEABLE[cur] && REPLACEABLE[old])) ok.push([x, y, z, id]);
      else fix.push([x, y, z, cur]);
    }
    this.apply(ok, true);
    if (fix.length) this.send(g.addr, { t: 'b', c: fix });
  }

  // World listener hooks (through the game).
  blockChanged(x, y, z, old, id) {
    this.changes.push([x, y, z, id]);
    if (this.applying && this.fx) this.game.remoteBlockFx(x, y, z, old, id);
  }

  chunkLoaded(chunk) {
    const q = this.pendingEdits.get(chunk.key);
    if (!q) return;
    this.pendingEdits.delete(chunk.key);
    const w = this.game.world, ok = [];
    for (const [x, y, z, old, id] of q) {
      const cur = w.getBlock(x, y, z);
      if (cur !== id && (cur === old || (REPLACEABLE[cur] && REPLACEABLE[old]))) ok.push([x, y, z, id]);
    }
    this.apply(ok, true);
  }

  drop(m) {
    const s = cleanStack({ id: m.id, count: m.n, dmg: m.d, ...cleanExtras(m.ex) });
    if (!s || ![m.x, m.y, m.z].every(num) || m.y < -64 || m.y > HEIGHT + 64) return;
    const v = Array.isArray(m.v) && m.v.length === 3 && m.v.every(num) ? m.v.map((a) => clamp(a, -20, 20)) : null;
    this.game.entities.spawnItem(m.x, m.y, m.z, s.id, s.count, s.dmg, num(m.pd) ? clamp(m.pd, 0, 5) : 0.6, v, extras(s));
  }

  take(g, m) {
    const e = this.game.entities.list.find((x) => x.nid === m.e && x.kind === 'item' && !x.dead);
    if (!e || e.pickupDelay > 0.25 || !int(m.n) || m.n < 1) return;
    if (g.x !== null && Math.hypot(e.x - g.x, e.y - g.y - 0.9, e.z - g.z) > 4) return;
    const n = Math.min(m.n, e.count);
    e.count -= n;
    if (!e.count) { e.dead = true; this.gone.set(e.nid, 'p'); }
    this.send(g.addr, { t: 'give', id: e.id, n, d: e.dmg ?? 0, ex: e.extra ?? undefined });
  }

  hit(g, m) {
    const E = this.game.entities, e = E.list.find((x) => x.nid === m.e && (x.kind === 'mob' || x.kind === 'boat') && !x.dead);
    if (!e || e.dying || !num(m.a) || !num(m.x) || !num(m.z)) return;
    if (e.kind === 'boat') { E.hitBoat(e, g.creative); return; }
    // (The guest's own entry, not a copy, so anything that goes after them follows where they go.)
    const who = E.players?.find((p) => p.addr === g.addr) ?? { x: m.x, y: g.y ?? e.y, z: m.z, addr: g.addr, uid: g.uid };
    E.hurtMob(e, clamp(m.a, 0, 100), who, num(m.b) ? clamp(m.b, 0, 3) : 0,
      { fire: num(m.f) ? clamp(m.f, 0, 8) : 0, looting: int(m.l) ? clamp(m.l, 0, 3) : 0 });
    E.rallyPets(g.uid, e);
  }

  // A guest wrote on a sign: if it's still there, everyone sees it.
  sign(m) {
    if (typeof m.k !== 'string' || !/^-?\d+,-?\d+,-?\d+$/.test(m.k) || !Array.isArray(m.l)) return;
    const [x, y, z] = m.k.split(',').map(Number);
    if (!SIGN[this.game.world.getBlock(x, y, z)]) return;
    this.game.writeSign(x, y, z, m.l.slice(0, 4).map((l) => String(l ?? '')));
  }
  writeSign(x, y, z, lines) { this.link.broadcast({ t: 'sign', k: `${x},${y},${z}`, l: lines }); }

  // A guest's arrow: shot from where they stand.
  arrow(g, m) {
    const v = [m.vx, m.vy, m.vz], at = [m.x, m.y, m.z];
    if (![...v, ...at].every(num) || g.x === null || Math.hypot(m.x - g.x, m.y - g.y - 1.5, m.z - g.z) > 3) return;
    const owner = this.others().find((o) => o.addr === g.addr) ?? { x: g.x, y: g.y, z: g.z, addr: g.addr };
    this.game.entities.spawnArrow(m.x, m.y, m.z, clamp(m.vx, -80, 80), clamp(m.vy, -80, 80), clamp(m.vz, -80, 80), owner,
      clamp(num(m.d) ? m.d : 2, 0, 30), !!m.p, { punch: int(m.pu) ? clamp(m.pu, 0, 2) : 0, flame: !!m.fl, potion: POTIONS[m.po] ? m.po : null,
      snowball: !!m.sb });
  }

  // One player hits another.
  pvpHit(g, m) {
    if (!this.pvp || !num(m.a) || !num(m.x) || !num(m.z)) return;
    this.strike(m.p, clamp(m.a, 0, 30), m.x, m.z, num(m.b) ? clamp(m.b, 0, 1) : 0, g.name);
  }

  strike(target, amount, fx, fz, bonus, by) {
    const why = `You were slain by ${by}`;
    const t = target === this.transport.self ? this.game.player : this.guests.get(target);
    if (!t || t.x === null) return;
    const dx = t.x - fx, dz = t.z - fz, d = Math.hypot(dx, dz) || 1;
    const k = [(dx / d) * (1.5 + bonus * 2.5), 4.5, (dz / d) * (1.5 + bonus * 2.5)].map(r2);
    if (target === this.transport.self) this.game.damage(amount, why, false, k, true);
    else this.send(target, { t: 'hurt', a: r2(amount), why, k, arm: 1 });
  }

  remoteCommand(g, line) {
    const word = line.split(/\s+/)[0].toLowerCase();
    if (word !== 'time' && word !== 'weather') return;
    this.say(`[${g.name}: /${line}]`, 's');
    this.game.command(line, (text, color) => this.send(g.addr, { t: 'msg', s: text, c: color ? 'r' : null }));
  }

  // A guest looks into a chest or furnace: send what's inside, and keep them posted.
  open(g, m) {
    const at = parseKey(m.k), w = this.game.world;
    if (!at || !w) return;
    const id = w.getBlock(...at);
    if (m.kind === 'chest' && (CHEST[id] !== undefined || id === B.barrel)) {
      if (!this.game.containers.has(m.k)) this.game.containers.set(m.k, new Array(27).fill(null));
      this.send(g.addr, { t: 'inv', k: m.k, s: this.game.containers.get(m.k) });
    } else if (m.kind === 'furnace' && FURNACE_IDS.has(id)) {
      this.send(g.addr, { t: 'fur', k: m.k, ...this.game.furnaceAt(...at).serialize() });
    } else {
      this.send(g.addr, { t: 'shut', k: m.k });
      return;
    }
    let set = this.viewers.get(m.k);
    if (!set) this.viewers.set(m.k, set = new Set());
    set.add(g.addr);
  }

  // Slots of a chest or furnace changed ({ index: stack }), by a guest or by the host.
  slots(m, from = null) {
    const arr = this.game.containers.get(m.k) ?? this.game.furnaces.get(m.k)?.slots;
    if (!arr || !m.s || typeof m.s !== 'object') return;
    const clean = {};
    for (const [k, v] of Object.entries(m.s)) {
      const i = Number(k);
      if (!int(i) || i < 0 || i >= arr.length) continue;
      arr[i] = clean[i] = cleanStack(v);
    }
    for (const addr of this.viewers.get(m.k) ?? []) if (addr !== from) this.send(addr, { t: 'slots', k: m.k, s: clean });
    if (from && (this.game.openBlock?.keys ?? []).includes(m.k)) this.game.menuChanged();
  }

  containerEdited(key, changes) { this.slots({ k: key, s: changes }); }
  closeContainer() {}
  openContainer() {}

  containerRemoved(key) {
    for (const addr of this.viewers.get(key) ?? []) this.send(addr, { t: 'shut', k: key });
    this.viewers.delete(key);
    this.furnaceSent.delete(key);
  }

  syncFurnaces() {
    for (const [key, set] of this.viewers) {
      if (!set.size) continue;
      const f = this.game.furnaces.get(key);
      if (!f) continue;
      const state = f.serialize(), json = JSON.stringify(state);
      if (this.furnaceSent.get(key) === json) continue;
      this.furnaceSent.set(key, json);
      for (const addr of set) this.send(addr, { t: 'fur', k: key, ...state });
    }
  }

  // Entities: new ones in full, then whatever changed about them, then which are gone.
  syncEntities() {
    const adds = [], ups = [], seen = new Set();
    for (const e of this.game.entities.list) {
      if (e.dead) continue;
      if (!e.nid) e.nid = this.nextNid++;
      seen.add(e.nid);
      const x = r2(e.x), y = r2(e.y), z = r2(e.z);
      const arrow = e.kind === 'arrow';
      const a = e.kind === 'mob' || e.kind === 'boat' ? r2(e.yaw) : arrow ? r2(e.ayaw ?? 0) : 0;
      const f = e.kind === 'mob' ? mobFlags(e) : arrow ? Math.round((e.apitch ?? 0) * 100) : e.kind === 'boat' ? boatFlags(e) : 0;
      const n = e.kind === 'item' ? e.count : 0;
      const prev = this.sentEnts.get(e.nid);
      if (!prev) { adds.push(entityState(e)); this.sentEnts.set(e.nid, [x, y, z, a, f, n]); continue; }
      if (prev[0] !== x || prev[1] !== y || prev[2] !== z || prev[3] !== a || prev[4] !== f || prev[5] !== n) {
        ups.push([e.nid, x, y, z, a, f, n]);
        prev.splice(0, 6, x, y, z, a, f, n);
      }
    }
    const rem = [];
    for (const nid of this.sentEnts.keys()) if (!seen.has(nid)) { rem.push([nid, this.gone.get(nid) ?? '']); this.sentEnts.delete(nid); }
    this.gone.clear();
    if (this.guests.size && (adds.length || ups.length || rem.length)) this.link.broadcast({ t: 'en', a: adds, u: ups, r: rem });
  }

  // Everyone asleep (the dead aside): skip to morning.
  checkSleep(dt) {
    const game = this.game;
    const all = game.state === 'sleeping' && [...this.guests.values()].every((g) => g.sleeping || g.dead);
    this.sleepTime = all ? this.sleepTime + dt : 0;
    if (this.sleepTime > 1.5) {
      this.sleepTime = 0;
      game.skipNight();
      this.link.broadcast({ t: 'wake' });
    }
  }

  sleepers() { return (this.game.state === 'sleeping' ? 1 : 0) + [...this.guests.values()].filter((g) => g.sleeping).length; }

  // Game hooks.
  others() {
    const out = [];
    for (const g of this.guests.values()) {
      // (One object per guest, kept up to date, so creatures chasing them follow where they go.)
      if (g.x === null) continue;
      out.push(Object.assign(g.ref ??= { addr: g.addr, uid: g.uid }, { x: g.x, y: g.y, z: g.z, creative: g.creative, dead: g.dead, name: g.name, look: g.look,
        held: g.held, sneaking: g.sneaking, invisible: g.invisible }));
    }
    return out;
  }

  hurt(addr, amount, why, knock, armored) {
    this.send(addr, { t: 'hurt', a: r2(amount), why, k: knock ? knock.map(r2) : null, arm: armored ? 1 : 0 });
  }
  // A status effect (a cave spider's bite) or a splash potion reaches a guest.
  giveEffect(addr, name, seconds, level) { this.send(addr, { t: 'eff', n: name, s: seconds, l: level }); }
  potionOn(addr, name, scale) { this.send(addr, { t: 'pot', n: name, k: r2(scale) }); }

  attackPlayer(rp, amount, bonus) {
    if (!this.pvp) return;
    const p = this.game.player;
    this.strike(rp.addr, amount, p.x, p.z, bonus, this.name);
  }

  entityGone(e, how) { if (e.nid) this.gone.set(e.nid, how); }
  // Send an entity in full again (a pet that's just been tamed, a new collar).
  resend(e) { if (e.nid) this.sentEnts.delete(e.nid); }
  // An untamed horse (or a broken boat) throws a guest off.
  buck(addr, e) { this.send(addr, { t: 'buck', e: e.nid ?? 0 }); }
  // An experience orb reached a guest.
  giveXp(addr, n) { this.send(addr, { t: 'xp', n }); }
  ride() {} // (the host's own riding needs no one's say-so)
  effect(k, x, y, z, n = undefined) { this.link.broadcast({ t: 'fx', k, x: r2(x), y: r2(y), z: r2(z), n }); }

  chat(text) { this.say(`<${this.name}> ${text}`); }

  setPvp(on) {
    this.pvp = on;
    this.say(on ? 'Players can now hurt each other' : 'Players can no longer hurt each other', 'y');
    this.link.broadcast({ t: 'pvp', on: on ? 1 : 0 });
  }

  async leave() {
    this.link.broadcast({ t: 'bye' });
    this.link.flush();
    await sleep(300);
    this.game.world?.setKeep([]);
    this.close();
  }
}


// A boat's flags: 1 knocked about, 2 someone in it.
const boatFlags = (e) => (e.hurt > 0 ? 1 : 0) | (e.rider ? 2 : 0);

function entityState(e) {
  const s = { i: e.nid, x: r2(e.x), y: r2(e.y), z: r2(e.z) };
  if (e.kind === 'item') return Object.assign(s, { k: 'i', id: e.id, n: e.count, d: e.dmg ?? 0, pd: r2(Math.max(0, e.pickupDelay)), ex: e.extra ?? undefined });
  if (e.kind === 'tnt') return Object.assign(s, { k: 't', f: e.fuse });
  if (e.kind === 'falling') return Object.assign(s, { k: 'f', b: e.block });
  if (e.kind === 'arrow') {
    return Object.assign(s, { k: 'a', a: r2(e.ayaw ?? Math.atan2(-e.vx, -e.vz)), p: r2(e.apitch ?? 0), po: e.potion ?? undefined, sb: e.snowball ? 1 : undefined });
  }
  if (e.kind === 'boat') return Object.assign(s, { k: 'b', w: e.wood, a: r2(e.yaw), f: boatFlags(e) });
  if (e.kind === 'xp') return Object.assign(s, { k: 'x', v: e.value });
  return Object.assign(s, { k: 'm', ty: e.type, a: r2(e.yaw), f: mobFlags(e), ...mobExtra(e) });
}

// ---------------------------------------------------------------- guest
// The world store of a guest: chunks the host changed come from the host, the rest are generated.
class RemoteStore {
  constructor(session, keys) {
    this.session = session;
    this.keys = new Set(keys.map((k) => k >>> 0));
    this.waiting = new Map();
  }

  has(key) { return this.keys.has(key); }

  loadChunk(key) {
    // Whatever changes were held back for this chunk are in what the host sends now.
    this.session.buffered.delete(key);
    return new Promise((resolve) => {
      const list = this.waiting.get(key);
      if (list) { list.push(resolve); return; }
      this.waiting.set(key, [resolve]);
      this.session.send(this.session.hostAddr, { t: 'need', k: key });
    });
  }

  arrived(key, blocks) {
    const list = this.waiting.get(key);
    if (!list) return;
    this.waiting.delete(key);
    list.forEach((resolve, i) => resolve(blocks && i < list.length - 1 ? blocks.slice() : blocks));
  }

  saveChunk() {}
  async drain() {}
}

export class GuestSession extends Session {
  // target: { kind: 'room', addr } (a game in the claude.ai room) or { kind: 'code', code }.
  static async join(game, target) {
    let t, hostAddr;
    if (target.kind === 'room') {
      t = await openRoom();
      if (!t) throw new Error('Games on this page need claude.ai.');
      if (!(await t.whenReady(6000))) throw new Error('Couldn’t reach the other players on this page. Try again in a moment.');
      hostAddr = target.addr;
    } else {
      const code = cleanCode(target.code ?? '');
      if (code.length !== 6) throw new Error('A join code has six letters and numbers.');
      t = await PeerTransport.join(code);
      hostAddr = t.hostAddr;
    }
    const s = new GuestSession(game, t, hostAddr);
    try {
      s.welcomed = await s.hello();
    } catch (e) {
      s.close();
      throw e;
    }
    return s;
  }

  constructor(game, transport, hostAddr) {
    super(game, transport);
    this.hostAddr = hostAddr;
    this.store = null;
    this.edits = [];
    this.buffered = new Map(); // chunk key -> changes for a chunk that is still loading
    this.saveTimer = 0;
    this.taking = new Map();
    this.pending = null;
    this.resyncing = false;
    this.hostSeen = performance.now();
    this.welcomed = null;
  }

  get guest() { return true; }
  get hostName() { return this.players.get(this.hostAddr)?.name ?? 'the host'; }

  // Anything else we send comes after the edits made so far, so the host sees them in order.
  send(to, msg) {
    if (this.edits.length && msg.t !== 'e') { const c = this.edits; this.edits = []; super.send(to, { t: 'e', c }); }
    super.send(to, msg);
  }

  toHost(msg) { this.send(this.hostAddr, msg); }

  hello(again = false) {
    this.link.listen(this.hostAddr);
    this.toHost({ t: 'hi', v: PROTOCOL, n: this.name, u: playerUid(), z: DEFLATE ? 1 : 0 });
    this.link.flush();
    if (again) return null;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => { this.pending = null; reject(new Error('The game didn’t answer. It may have closed.')); }, 30000);
      this.pending = {
        resolve: (m) => { clearTimeout(timer); resolve(m); },
        reject: (e) => { clearTimeout(timer); reject(e); },
      };
    });
  }

  update(dt) {
    if (this.closed) return;
    if (this.edits.length) { const c = this.edits; this.edits = []; super.send(this.hostAddr, { t: 'e', c }); }
    super.update(dt);
    const now = performance.now();
    this.saveTimer += dt;
    if (this.saveTimer >= SAVE_EVERY && this.game.state !== 'loading') { this.saveTimer = 0; this.game.save(); }
    if (this.taking.size > 64) for (const [k, t] of this.taking) if (now - t > 5000) this.taking.delete(k);
    // A host that stops answering altogether (its tab was closed without saying goodbye).
    if (this.transport.connected && now - this.hostSeen > 25000) this.game.disconnected('Lost contact with the game.');
    this.link.flush();
  }

  presence(addr, pres) {
    if (addr === this.hostAddr) {
      if (!pres) { if (this.gid) this.game.disconnected('The host left the game.'); return; }
      this.hostSeen = performance.now();
      if (this.gid && pres.g === this.gid && this.game.world && this.game.state !== 'loading') {
        if (int(pres.tm) && Math.abs(this.game.time - pres.tm) > 40) this.game.time = pres.tm;
        this.game.weather.raining = !!pres.wr;
      }
    }
    this.seePlayer(addr, pres);
  }

  message(from, msg, b) {
    if (from !== this.hostAddr) return;
    this.hostSeen = performance.now();
    const game = this.game;
    switch (msg.t) {
      case 'welcome': this.welcome(msg); break;
      case 'deny':
        if (this.pending) { this.pending.reject(new Error(String(msg.why ?? 'The game turned you away.').replace(/\p{C}/gu, '').slice(0, 200))); this.pending = null; }
        break;
      case 'b': if (Array.isArray(msg.c)) this.applyBlocks(msg.c); break;
      case 'chunk': this.chunk(msg); break;
      case 'en': this.entities(msg); break;
      case 'give': {
        const s = cleanStack({ id: msg.id, count: msg.n, dmg: msg.d, ...cleanExtras(msg.ex) });
        if (!s || !game.world) break;
        const left = game.pickup(s.id, s.count, s.dmg, extras(s));
        if (left) game.entities.dropItem(game.player, { ...s, count: left });
        break;
      }
      case 'hurt':
        if (num(msg.a) && game.world && game.state !== 'loading') {
          const k = Array.isArray(msg.k) && msg.k.length === 3 && msg.k.every(num) ? msg.k.map((v) => clamp(v, -20, 20)) : null;
          game.damage(clamp(msg.a, 0, 100), String(msg.why ?? 'You died').replace(/\p{C}/gu, '').slice(0, 80), false, k, !!msg.arm);
        }
        break;
      case 'msg': if (typeof msg.s === 'string') game.ui.message(msg.s.replace(/\p{C}/gu, '').slice(0, 200), COLORS[msg.c] ?? null); break;
      case 'inv': this.chestData(msg); break;
      case 'fur': this.furnaceData(msg); break;
      case 'slots': this.slotData(msg); break;
      case 'shut': if (game.openBlock?.key === msg.k) game.closeMenu(); break;
      case 'wake': game.wake(true); break;
      case 'buck': if (game.riding && game.riding.nid === msg.e) game.dismount(true); break;
      case 'xp': if (int(msg.n) && msg.n > 0) game.gainXp(Math.min(msg.n, 5000)); break;
      case 'eff': if (EFFECTS[msg.n] && num(msg.s) && !game.creative) game.addEffect(msg.n, clamp(msg.s, 0, 600), int(msg.l) ? clamp(msg.l, 1, 5) : 1); break;
      case 'pot': if (POTIONS[msg.n] && num(msg.k)) game.applyPotion(msg.n, clamp(msg.k, 0, 1), true); break;
      case 'pvp': this.pvp = !!msg.on; break;
      case 'fx': this.effect(msg); break;
      case 'sign':
        if (typeof msg.k === 'string' && /^-?\d+,-?\d+,-?\d+$/.test(msg.k) && Array.isArray(msg.l)) {
          const [x, y, z] = msg.k.split(',').map(Number);
          game.signs.set(x, y, z, msg.l.slice(0, 4).map((l) => String(l ?? '')));
        }
        break;
      case 'bye': game.disconnected('The host closed the game.'); break;
      default: break;
    }
    void b;
  }

  welcome(msg) {
    const w = msg.w;
    if (!w || !int(w.seed) || typeof msg.g !== 'string' || !Array.isArray(msg.keys) || typeof msg.be !== 'string') return;
    this.gid = msg.g;
    this.pvp = msg.pvp !== 0;
    this.link.follow(this.hostAddr, msg.be, int(msg.bs) ? msg.bs : 0);
    this.store = new RemoteStore(this, msg.keys.filter(int));
    this.buffered.clear();
    // Entities as they are now; updates that follow build on them.
    const E = this.game.entities;
    E.reset(null);
    for (const s of Array.isArray(msg.ents) ? msg.ents : []) E.addRemote(s);
    this.seeEveryone();
    if (this.pending) { this.pending.resolve(msg); this.pending = null; }
    else if (this.resyncing) { this.resyncing = false; this.game.enterRemoteWorld(this, msg, true); }
  }

  // The host's broadcast or our own stream lost something that can't be sent again: start over.
  loss(from) {
    if (from !== this.hostAddr || this.resyncing || !this.gid) return;
    this.resyncing = true;
    this.game.ui.message('Catching up with the game…', COLORS.s);
    this.hello(true);
  }

  applyBlocks(list) {
    const w = this.game.world, ready = [];
    for (const c of list) {
      if (!validChange(c, 4)) continue;
      const cx = c[0] >> 4, cz = c[2] >> 4, key = chunkKey(cx, cz);
      this.store?.keys.add(key);
      const chunk = w?.chunkAt(cx, cz);
      // Not loaded: the host will send the whole chunk when it's needed.
      if (!chunk) { this.buffered.delete(key); continue; }
      if (chunk.state !== S_READY) {
        let q = this.buffered.get(key);
        if (!q) this.buffered.set(key, q = []);
        q.push(c);
        continue;
      }
      ready.push(c);
    }
    this.apply(ready, false);
  }

  chunkLoaded(chunk) {
    const q = this.buffered.get(chunk.key);
    if (!q) return;
    this.buffered.delete(chunk.key);
    this.apply(q, false);
  }

  async chunk(msg) {
    if (!int(msg.k) || !this.store) return;
    const store = this.store, key = msg.k >>> 0;
    let blocks = null;
    if (typeof msg.d === 'string') {
      try { blocks = await unpackChunk(msg); } catch (e) { console.warn('A chunk from the host could not be read', e); }
    }
    store.arrived(key, blocks);
  }

  entities(msg) {
    const E = this.game.entities;
    if (Array.isArray(msg.a)) for (const s of msg.a) E.addRemote(s);
    if (Array.isArray(msg.u)) for (const u of msg.u) E.moveRemote(u);
    if (Array.isArray(msg.r)) for (const r of msg.r) E.removeRemote(r);
  }

  chestData(msg) {
    const arr = this.game.containers.get(msg.k);
    if (!arr || !Array.isArray(msg.s)) return;
    for (let i = 0; i < arr.length; i++) arr[i] = cleanStack(msg.s[i]);
    this.refresh(msg.k, true);
  }

  furnaceData(msg) {
    const f = this.game.furnaces.get(msg.k);
    if (!f || !Array.isArray(msg.slots)) return;
    for (let i = 0; i < 3; i++) f.slots[i] = cleanStack(msg.slots[i]);
    f.burn = num(msg.burn) ? msg.burn : 0;
    f.burnMax = num(msg.burnMax) ? msg.burnMax : 0;
    f.cook = num(msg.cook) ? msg.cook : 0;
    this.refresh(msg.k, true);
  }

  slotData(msg) {
    const arr = this.game.containers.get(msg.k) ?? this.game.furnaces.get(msg.k)?.slots;
    if (!arr || !msg.s || typeof msg.s !== 'object') return;
    for (const [k, v] of Object.entries(msg.s)) {
      const i = Number(k);
      if (int(i) && i >= 0 && i < arr.length) arr[i] = cleanStack(v);
    }
    this.refresh(msg.k);
  }

  // `full`: the whole contents arrived (the menu can be used once every part has).
  refresh(key, full = false) {
    const game = this.game;
    if (!game.menu || !(game.openBlock?.keys ?? [game.openBlock?.key]).includes(key)) return;
    if (full) game.menu.waiting?.delete(key);
    game.menuChanged();
  }

  effect(msg) {
    if (![msg.x, msg.y, msg.z].every(num)) return;
    const game = this.game, at = { x: msg.x, y: msg.y, z: msg.z };
    if (msg.k === 'boom') game.explosionFx(at.x, at.y, at.z, 4);
    else if (msg.k === 'fizz') game.fizz(Math.floor(at.x), Math.floor(at.y), Math.floor(at.z));
    else if (msg.k === 'splash' && POTIONS[msg.n]) game.entities.splashFx(at.x, at.y, at.z, msg.n);
    else if (msg.k === 'snow') game.entities.snowFx(at.x, at.y, at.z);
  }

  // Game hooks.
  blockChanged(x, y, z, old, id) {
    if (this.applying) { if (this.fx) this.game.remoteBlockFx(x, y, z, old, id); return; }
    this.edits.push([x, y, z, old, id]);
    this.store?.keys.add(chunkKey(x >> 4, z >> 4));
  }

  others() {
    const out = [];
    for (const rp of this.players.values()) if (rp.ready) out.push({ x: rp.x, y: rp.y, z: rp.z, addr: rp.addr, creative: rp.creative, dead: rp.dead, name: rp.name });
    return out;
  }

  dropItem(x, y, z, id, count, dmg, delay, vel, extra) {
    this.toHost({ t: 'drop', x: r2(x), y: r2(y), z: r2(z), id, n: count, d: dmg ?? 0, pd: delay, v: vel ? vel.map(r2) : null, ex: extra ?? undefined });
  }

  primeTNT(x, y, z, fuse) { this.toHost({ t: 'tnt', x, y, z, f: fuse }); }
  placeBoat(x, y, z, wood, yaw) { this.toHost({ t: 'boat', x: r2(x), y: r2(y), z: r2(z), w: wood, a: r2(yaw) }); }
  dropXp(x, y, z, n) { this.toHost({ t: 'orb', x: r2(x), y: r2(y), z: r2(z), n }); }
  ride(e, on) { if (e.nid) this.toHost({ t: 'ride', e: e.nid, on: on ? 1 : 0 }); }
  useMob(e, id, effect) { this.toHost({ t: 'um', e: e.nid, i: id, f: effect }); }
  writeSign(x, y, z, lines) { this.toHost({ t: 'sign', k: `${x},${y},${z}`, l: lines }); }
  shootArrow(x, y, z, vx, vy, vz, damage, pickup, fx) {
    this.toHost({ t: 'arw', x: r2(x), y: r2(y), z: r2(z), vx: r2(vx), vy: r2(vy), vz: r2(vz), d: damage, p: pickup ? 1 : 0,
      pu: fx?.punch || undefined, fl: fx?.flame ? 1 : undefined, po: fx?.potion || undefined, sb: fx?.snowball ? 1 : undefined });
  }

  hitMob(e, amount, bonus, opts = null) {
    const p = this.game.player;
    this.toHost({ t: 'hit', e: e.nid, a: r2(amount), b: bonus, x: r2(p.x), z: r2(p.z), f: opts?.fire || undefined, l: opts?.looting || undefined });
  }

  attackPlayer(rp, amount, bonus) {
    if (!this.pvp) return;
    const p = this.game.player;
    this.toHost({ t: 'pvp', p: rp.addr, a: r2(amount), b: bonus, x: r2(p.x), z: r2(p.z) });
  }

  // Walking over an item: ask the host for as much of it as fits.
  wantItem(e) {
    const now = performance.now();
    if (now - (this.taking.get(e.nid) ?? -1e9) < 700) return;
    const room = this.game.creative ? e.count : this.game.inv.room(e.id, e.dmg ?? 0);
    if (room <= 0) return;
    this.taking.set(e.nid, now);
    this.toHost({ t: 'take', e: e.nid, n: Math.min(room, e.count) });
  }

  openContainer(key, kind) { this.toHost({ t: 'open', k: key, kind }); }
  containerEdited(key, changes) { this.toHost({ t: 'slots', k: key, s: changes }); }
  closeContainer(key) { this.toHost({ t: 'shut', k: key }); }
  containerRemoved() {}
  chat(text) { this.toHost({ t: 'chat', s: text }); }
  command(line) { this.toHost({ t: 'cmd', s: line }); }
  saveMe(data) { this.toHost({ t: 'save', d: data }); }
  entityGone() {}

  async leave() {
    this.toHost({ t: 'bye' });
    this.link.flush();
    await sleep(300);
    this.close();
  }
}
