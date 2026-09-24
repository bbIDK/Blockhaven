// Multiplayer networking, in two layers.
//
// Transports carry small JSON packets and each player's "presence" (a little public object: name,
// position, held item) between browsers:
//   - RoomTransport uses the claude.ai room: everyone who has this page open there right now.
//   - PeerTransport uses PeerJS (WebRTC) with a six-letter join code, and works anywhere else.
// Link turns packets into reliable, ordered message streams: it packs small messages together,
// splits big ones, numbers everything, and asks again for whatever a transport dropped.
// The game protocol on top lives in multiplayer.js.

export const PROTOCOL = 2;
const TOPIC = 'bh';
const PEERJS_URL = 'https://cdn.jsdelivr.net/npm/peerjs@1.5.5/dist/peerjs.min.js';
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const PEER_PREFIX = 'blockhaven-';

// UTF-8 size of a string.
export function utf8Length(s) {
  let n = 0;
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    n += c < 0x80 ? 1 : c < 0x800 || (c >= 0xd800 && c <= 0xdfff) ? 2 : 3;
  }
  return n;
}

// Splits a string into pieces that each take at most `max` bytes once written as a JSON string
// (quotes and backslashes are escaped, control characters become \u00XX).
function splitForJSON(str, max) {
  const out = [];
  let start = 0, cost = 0;
  for (let i = 0; i < str.length; i++) {
    const c = str.charCodeAt(i);
    const pair = c >= 0xd800 && c <= 0xdbff && i + 1 < str.length;
    const w = pair ? 4 : c === 0x22 || c === 0x5c ? 2 : c < 0x20 ? 6 : c < 0x80 ? 1 : c < 0x800 ? 2 : c <= 0xdfff && c >= 0xd800 ? 6 : 3;
    if (cost + w > max && i > start) { out.push(str.slice(start, i)); start = i; cost = 0; }
    cost += w;
    if (pair) i++;
  }
  out.push(str.slice(start));
  return out;
}

class Bucket {
  constructor(rate, burst) { this.rate = rate; this.burst = burst; this.tokens = burst; this.t = performance.now(); }
  take() {
    const now = performance.now();
    this.tokens = Math.min(this.burst, this.tokens + ((now - this.t) / 1000) * this.rate);
    this.t = now;
    if (this.tokens < 1) return false;
    this.tokens--;
    return true;
  }
}

const same = (a, b) => a === b || JSON.stringify(a) === JSON.stringify(b);

// ---------------------------------------------------------------- claude.ai room
// Everyone in the room hears every event, so packets carry who they are for. Events are rate
// limited by the platform (about 40 a second), so ours go out at a steady 22 a second at most.
// A viewer who may not send events (view-only access) posts packets for the host in their
// presence instead, as a small mailbox the host empties and acknowledges.
export class RoomTransport {
  static async open() {
    if (typeof globalThis.claude?.use !== 'function') return null;
    let room = null;
    try { room = await globalThis.claude.use('room'); } catch { room = null; }
    return room ? new RoomTransport(room) : null;
  }

  constructor(room) {
    this.room = room;
    this.kind = 'room';
    this.me = room.peers().find((p) => p.sameTab)?.peer ?? null;
    this.connected = room.connected();
    this.canEmit = true;
    this.dead = false;
    this.queue = [];
    this.bucket = new Bucket(22, 40);
    this.presence = {};
    this.sent = {};
    this.presenceDirty = false;
    this.lastPresence = 0;
    this.mailbox = [];
    this.mailboxNext = 1;
    this.inbox = new Map(); // peer -> last mailbox entry read (host side)
    this.acks = new Map();  // peer -> mailbox entry to acknowledge (host side)
    this.others = new Map(); // peer -> presence
    this.onPacket = null;
    this.onPresence = null;
    this.onStatus = null;
    const failed = (e) => this.failed(e);
    this.subs = [
      room.on(TOPIC, (m) => this.receive(m), failed),
      room.onPeers((ch) => this.peersChanged(ch), failed),
      room.onConnection((c) => { this.connected = c; this.onStatus?.(c); }, failed),
    ];
    this.timer = setInterval(() => this.pump(), 50);
  }

  get maxPacket() { return this.canEmit ? 3200 : 1400; }
  get ready() { return !this.dead && !!this.me; }
  get self() { return this.me ? `r:${this.me}` : null; }

  // Resolves true once the room knows who we are and we're connected (false after `ms`).
  async whenReady(ms) {
    const end = performance.now() + ms;
    while (!this.dead && !(this.me && this.connected)) {
      if (performance.now() > end) return false;
      await new Promise((r) => setTimeout(r, 100));
    }
    return !this.dead;
  }

  // Can this viewer send room events? (Needed to host.)
  async probe() {
    try {
      await this.room.emit(TOPIC, { to: this.me, probe: 1 });
      return true;
    } catch (e) {
      if (e?.code === 'not_permitted') { this.canEmit = false; return false; }
      return true;
    }
  }

  failed(e) {
    if (this.dead) return;
    console.warn('Room unavailable:', e?.code, e?.message);
    this.dead = true;
    this.connected = false;
    this.onStatus?.(false);
  }

  addr(peer) { return `r:${peer}`; }

  receive(m) {
    if (m.sameTab) { this.me = m.peer; return; }
    if (m.kind !== 'viewer') return;
    const d = m.data;
    if (!d || typeof d !== 'object' || (d.to !== '*' && d.to !== this.me)) return;
    if (typeof d.ack === 'number') {
      const before = this.mailbox.length;
      this.mailbox = this.mailbox.filter((e) => e.i > d.ack);
      if (this.mailbox.length !== before) this.presenceDirty = true;
      return;
    }
    if (d.p !== undefined) this.onPacket?.(this.addr(m.peer), d.p);
  }

  peersChanged(ch) {
    const self = ch.peers.find((p) => p.sameTab);
    if (self) this.me = self.peer;
    for (const p of [...ch.joined, ...ch.updated]) {
      if (p.sameTab || p.kind !== 'viewer') continue;
      const pres = p.presence ?? {};
      this.others.set(p.peer, pres);
      this.readMailbox(p.peer, pres.mb);
      this.onPresence?.(this.addr(p.peer), pres);
    }
    for (const p of ch.left) {
      if (p.sameTab || !this.others.has(p.peer)) continue;
      this.others.delete(p.peer);
      this.inbox.delete(p.peer);
      this.acks.delete(p.peer);
      this.onPresence?.(this.addr(p.peer), null);
    }
  }

  readMailbox(peer, mb) {
    if (!Array.isArray(mb?.q)) return;
    let last = this.inbox.get(peer) ?? 0;
    for (const e of mb.q) {
      if (!Array.isArray(e) || typeof e[0] !== 'number' || e[0] <= last) continue;
      last = e[0];
      if (e[1] === this.me) this.onPacket?.(this.addr(peer), e[2]);
    }
    if (last !== (this.inbox.get(peer) ?? 0)) { this.inbox.set(peer, last); this.acks.set(peer, last); }
  }

  send(to, pkt) {
    const target = to === '*' ? '*' : to.slice(2);
    if (!this.canEmit) { this.post(target, pkt); return; }
    this.queue.push([target, pkt]);
    if (this.queue.length === 1) this.pump();
  }

  // Keeps the room up to date with our presence (a whole object; fields left out are removed).
  setPresence(obj) {
    this.presence = obj;
    this.presenceDirty = true;
  }

  post(to, pkt) {
    if (this.mailbox.length > 400) this.mailbox.shift();
    this.mailbox.push({ i: this.mailboxNext++, to, p: pkt, size: utf8Length(JSON.stringify(pkt)) + 24 });
    this.presenceDirty = true;
  }

  emit(env) {
    this.room.emit(TOPIC, env).catch((e) => {
      if (e?.code === 'not_permitted') {
        if (this.canEmit) console.warn('This viewer may not send room events; using presence instead');
        this.canEmit = false;
        if (env.p !== undefined && env.to !== '*') this.post(env.to, env.p);
      } else if (e?.code === 'invalid_argument') console.warn('Room packet refused:', e.message);
    });
  }

  pump() {
    if (this.dead) return;
    const now = performance.now();
    if (this.presenceDirty && now - this.lastPresence >= 50) this.flushPresence(now);
    if (!this.connected) return;
    for (const [peer, n] of this.acks) {
      if (!this.bucket.take()) return;
      this.emit({ to: peer, ack: n });
      this.acks.delete(peer);
    }
    while (this.queue.length && this.bucket.take()) {
      const [to, p] = this.queue.shift();
      this.emit({ to, p });
    }
  }

  flushPresence(now) {
    this.presenceDirty = false;
    this.lastPresence = now;
    const obj = { ...this.presence };
    if (this.mailbox.length) {
      let budget = 3300 - utf8Length(JSON.stringify(obj));
      const q = [];
      for (const e of this.mailbox) {
        if (e.size > budget) break;
        budget -= e.size;
        q.push([e.i, e.to, e.p]);
      }
      if (q.length) obj.mb = { q };
    }
    const patch = {};
    let changed = false;
    for (const k of Object.keys(obj)) if (!same(obj[k], this.sent[k])) { patch[k] = obj[k]; changed = true; }
    for (const k of Object.keys(this.sent)) if (!(k in obj)) { patch[k] = null; changed = true; }
    this.sent = obj;
    if (changed) this.room.presence(patch).catch((e) => console.warn('Presence refused:', e?.code, e?.message));
  }

  // Other viewers' presence right now (address -> object).
  list() { return [...this.others].map(([peer, pres]) => [this.addr(peer), pres]); }

  close() {
    for (const off of this.subs) off();
    clearInterval(this.timer);
    this.dead = true;
  }
}

// ---------------------------------------------------------------- PeerJS (join codes)
let peerjsPromise = null;
function loadScript(src) {
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = src;
    s.async = true;
    s.onload = resolve;
    s.onerror = () => { s.remove(); reject(new Error('load failed')); };
    document.head.appendChild(s);
  });
}

// PeerJS comes from a CDN the first time it's needed (three tries, for flaky connections).
export function loadPeerJS() {
  if (globalThis.Peer) return Promise.resolve(globalThis.Peer);
  peerjsPromise ??= (async () => {
    for (let i = 0; i < 3; i++) {
      try {
        await loadScript(i ? `${PEERJS_URL}?retry=${i}` : PEERJS_URL);
        if (globalThis.Peer) return globalThis.Peer;
      } catch { await new Promise((r) => setTimeout(r, 600 * (i + 1))); }
    }
    peerjsPromise = null;
    throw new Error('Couldn’t load the networking library. Are you online?');
  })();
  return peerjsPromise;
}

export function randomCode() {
  let s = '';
  for (let i = 0; i < 6; i++) s += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
  return s;
}

export const cleanCode = (text) => text.toUpperCase().replace(/[^A-Z0-9]/g, '');

const PEER_ERRORS = {
  'peer-unavailable': 'No game with that code is running. Check the code, and that your friend’s game is open.',
  network: 'Couldn’t reach the multiplayer server. Check your internet connection.',
  'server-error': 'The multiplayer server isn’t answering right now. Try again in a minute.',
  'socket-error': 'Couldn’t reach the multiplayer server. Check your internet connection.',
  'socket-closed': 'Lost the connection to the multiplayer server.',
  'browser-incompatible': 'This browser can’t make direct connections (WebRTC).',
  webrtc: 'Couldn’t connect to your friend directly. One of your networks may be blocking it.',
};
const peerError = (e) => new Error(PEER_ERRORS[e?.type] ?? e?.message ?? 'Connection failed');

// The host listens under a join code; guests connect to it. Presence goes through the host,
// which passes everyone's on to everyone else.
export class PeerTransport {
  static async host(tries = 4) {
    const Peer = await loadPeerJS();
    for (let i = 0; i < tries; i++) {
      const code = randomCode();
      try {
        const peer = await PeerTransport.openPeer(Peer, PEER_PREFIX + code);
        return new PeerTransport(peer, code, null);
      } catch (e) {
        if (e.type !== 'unavailable-id') throw peerError(e);
      }
    }
    throw new Error('Couldn’t get a join code. Try again.');
  }

  static async join(code) {
    const Peer = await loadPeerJS();
    const peer = await PeerTransport.openPeer(Peer, null).catch((e) => { throw peerError(e); });
    const conn = peer.connect(PEER_PREFIX + code, { reliable: true, serialization: 'json' });
    await new Promise((resolve, reject) => {
      const t = setTimeout(() => reject(new Error('Your friend’s game didn’t answer. Check the code and try again.')), 20000);
      conn.on('open', () => { clearTimeout(t); resolve(); });
      conn.on('error', (e) => { clearTimeout(t); reject(peerError(e)); });
      peer.on('error', (e) => { clearTimeout(t); reject(peerError(e)); });
    }).catch((e) => { peer.destroy(); throw e; });
    return new PeerTransport(peer, code, conn);
  }

  static openPeer(Peer, id) {
    return new Promise((resolve, reject) => {
      // (BLOCKHAVEN_PEER_SERVER can point at another PeerJS server: { host, port, path, secure }.)
      const opts = { debug: 0, ...(globalThis.BLOCKHAVEN_PEER_SERVER ?? {}) };
      const peer = id ? new Peer(id, opts) : new Peer(opts);
      const t = setTimeout(() => { peer.destroy(); reject({ type: 'network' }); }, 15000);
      const onOpen = () => { clearTimeout(t); peer.off('error', onError); resolve(peer); };
      const onError = (e) => { clearTimeout(t); peer.off('open', onOpen); peer.destroy(); reject(e); };
      peer.on('open', onOpen);
      peer.on('error', onError);
    });
  }

  constructor(peer, code, hostConn) {
    this.peer = peer;
    this.code = code;
    this.kind = 'peer';
    this.isHost = !hostConn;
    this.hostAddr = `p:${PEER_PREFIX}${code}`;
    this.me = `p:${peer.id}`;
    this.maxPacket = 15000;
    this.conns = new Map(); // address -> DataConnection
    this.presence = null;
    this.sentPresence = null;
    this.lastPresence = 0;
    this.states = new Map(); // host: address -> presence of each guest (relayed)
    this.relay = new Map();  // host: address -> presence waiting to be passed on (null: left)
    this.onPacket = null;
    this.onPresence = null;
    this.onStatus = null;
    this.connected = true;
    this.dead = false;
    if (hostConn) this.attach(hostConn, this.hostAddr);
    else {
      peer.on('connection', (conn) => conn.on('open', () => this.attach(conn, `p:${conn.peer}`)));
      // Keep the code working for new guests if the link to the server drops.
      peer.on('disconnected', () => { if (!this.dead) setTimeout(() => !this.dead && peer.reconnect(), 1500); });
      peer.on('error', (e) => console.warn('PeerJS:', e?.type, e?.message));
    }
    this.timer = setInterval(() => this.pump(), 50);
  }

  get ready() { return !this.dead; }
  get self() { return this.me; }

  attach(conn, addr) {
    this.conns.set(addr, conn);
    conn.on('data', (d) => this.receive(addr, d));
    conn.on('close', () => this.lost(addr));
    conn.on('error', () => this.lost(addr));
    if (this.isHost) {
      // A newcomer hears about everyone already here.
      const all = {};
      if (this.presence) all[this.me] = this.presence;
      for (const [a, s] of this.states) all[a] = s;
      this.sendRaw(addr, { pr: all });
    }
  }

  lost(addr) {
    if (!this.conns.has(addr)) return;
    this.conns.delete(addr);
    if (this.isHost) {
      this.states.delete(addr);
      this.relay.set(addr, null);
      this.onPresence?.(addr, null);
    } else {
      this.connected = false;
      this.onStatus?.(false);
      for (const a of this.states.keys()) this.onPresence?.(a, null);
      this.states.clear();
      this.onPresence?.(this.hostAddr, null);
    }
  }

  receive(addr, d) {
    if (!d || typeof d !== 'object') return;
    if (d.pr && typeof d.pr === 'object') {
      if (this.isHost) {
        // A guest's own presence: keep it and pass it on.
        const s = d.pr[addr];
        if (s && typeof s === 'object') { this.states.set(addr, s); this.relay.set(addr, s); this.onPresence?.(addr, s); }
      } else {
        for (const [a, s] of Object.entries(d.pr)) {
          if (a === this.me) continue;
          if (s) this.states.set(a, s); else this.states.delete(a);
          this.onPresence?.(a, s ?? null);
        }
      }
      return;
    }
    if (d.p !== undefined) this.onPacket?.(addr, d.p);
  }

  sendRaw(addr, obj) {
    const c = this.conns.get(addr);
    if (c?.open) { try { c.send(obj); } catch (e) { console.warn('Send failed', e); } }
  }

  send(to, pkt) {
    if (to === '*') { for (const a of this.conns.keys()) this.sendRaw(a, { p: pkt }); }
    else this.sendRaw(to, { p: pkt });
  }

  setPresence(obj) { this.presence = obj; }

  pump() {
    const now = performance.now();
    if (now - this.lastPresence < 66) return;
    this.lastPresence = now;
    if (this.isHost) {
      if (this.presence && !same(this.presence, this.sentPresence)) { this.sentPresence = this.presence; this.relay.set(this.me, this.presence); }
      if (!this.relay.size) return;
      for (const a of this.conns.keys()) {
        const out = {};
        for (const [k, v] of this.relay) if (k !== a) out[k] = v;
        if (Object.keys(out).length) this.sendRaw(a, { pr: out });
      }
      this.relay.clear();
    } else if (this.presence && !same(this.presence, this.sentPresence)) {
      this.sentPresence = this.presence;
      this.sendRaw(this.hostAddr, { pr: { [this.me]: this.presence } });
    }
  }

  list() { return [...this.states]; }

  close() {
    this.dead = true;
    clearInterval(this.timer);
    // Give the last packets a moment to leave before the connections close.
    setTimeout(() => this.peer.destroy(), 300);
  }
}

// ---------------------------------------------------------------- reliable streams
// Each sender numbers its packets per stream: one direct stream to each other player ('d') and,
// for a host, one broadcast stream to all its guests ('b'). A packet holds several small
// messages, or one fragment of a big one. Receivers deliver strictly in order, hold packets that
// arrive early, and ask for missing ones (nack). Heartbeats reveal losses at the end of a burst.
// When a sender can no longer resend what was lost it says so (reset) and the receiver starts
// over from there, reporting the loss so the game can resynchronise.
const KEEP_DIRECT = 1500, KEEP_BROADCAST = 4000;

export class Link {
  constructor() {
    this.epoch = Math.random().toString(36).slice(2, 7);
    this.transports = [];
    this.out = new Map();  // stream key ('*' or address) -> outgoing stream
    this.in = new Map();   // `${from}|${st}|${epoch}` -> incoming stream
    this.follows = new Map(); // host address -> { epoch, from, early: [] } (broadcast streams we listen to)
    this.onMessage = null;  // (from, msg, broadcast)
    this.onPresence = null; // (address, presence | null)
    this.onLoss = null;     // (from, broadcast)
    this.lastBeat = 0;
    this.closed = false;
  }

  addTransport(t) {
    this.transports.push(t);
    t.onPacket = (from, pkt) => this.receive(from, pkt);
    t.onPresence = (addr, pres) => this.onPresence?.(addr, pres);
  }

  transportFor(addr) { return this.transports.find((t) => addr.startsWith(t.kind === 'room' ? 'r:' : 'p:')); }

  stream(key) {
    let s = this.out.get(key);
    if (!s) {
      s = { key, seq: 0, queue: [], sent: new Map(), lastSend: 0, beats: 0 };
      this.out.set(key, s);
    }
    return s;
  }

  send(to, msg) { this.stream(to).queue.push(msg); }
  broadcast(msg) { this.stream('*').queue.push(msg); }

  setPresence(obj) { for (const t of this.transports) t.setPresence(obj); }

  maxFor(key) {
    let m = Infinity;
    for (const t of key === '*' ? this.transports : [this.transportFor(key)]) if (t) m = Math.min(m, t.maxPacket);
    return m === Infinity ? 3000 : m;
  }

  // Packs queued messages into packets and hands them to the transports. Call often (each frame).
  flush() {
    if (this.closed) return;
    const now = performance.now();
    for (const s of this.out.values()) {
      if (!s.queue.length) continue;
      const max = this.maxFor(s.key) - 80;
      const st = s.key === '*' ? 'b' : 'd';
      let batch = [], size = 0;
      const emit = (pkt) => this.emitPacket(s, pkt, now);
      const pack = () => { if (batch.length) emit({ st, e: this.epoch, m: batch }); batch = []; size = 0; };
      for (const msg of s.queue) {
        const text = JSON.stringify(msg);
        const n = utf8Length(text) + 1;
        if (n > max) {
          pack();
          const parts = splitForJSON(text, max - 20);
          parts.forEach((d, i) => emit({ st, e: this.epoch, fr: [i, parts.length], d }));
          continue;
        }
        if (size + n > max) pack();
        batch.push(msg);
        size += n;
      }
      pack();
      s.queue = [];
    }
    // Heartbeats: after anything is sent, the latest number goes out a few more times so a lost
    // last packet is noticed.
    if (now - this.lastBeat > 800) {
      this.lastBeat = now;
      for (const s of this.out.values()) {
        if (!s.seq || s.beats >= 3) continue;
        s.beats++;
        this.sendPacket(s.key, { c: 'hb', st: s.key === '*' ? 'b' : 'd', e: this.epoch, s: s.seq });
      }
    }
  }

  emitPacket(s, pkt, now) {
    pkt.s = ++s.seq;
    s.sent.set(pkt.s, pkt);
    const keep = s.key === '*' ? KEEP_BROADCAST : KEEP_DIRECT;
    if (s.sent.size > keep) s.sent.delete(pkt.s - keep);
    s.lastSend = now;
    s.beats = 0;
    this.sendPacket(s.key, pkt);
  }

  sendPacket(key, pkt) {
    if (key === '*') { for (const t of this.transports) t.send('*', pkt); }
    else this.transportFor(key)?.send(key, pkt);
  }

  // The broadcast stream of `host`, from sequence number `after` + 1 on. Packets that arrived
  // before we knew where to start are kept and delivered now.
  follow(host, epoch, after) {
    const f = this.follows.get(host) ?? { early: [] };
    this.follows.set(host, { epoch, early: [] });
    const s = this.incoming(host, 'b', epoch);
    s.expect = after + 1;
    for (const [from, pkt] of f.early) this.receive(from, pkt);
  }

  // Start keeping `host`'s broadcast packets (we're about to join and follow it).
  listen(host) { if (!this.follows.has(host)) this.follows.set(host, { epoch: null, early: [] }); }

  unfollow(host) { this.follows.delete(host); }

  incoming(from, st, epoch) {
    const key = `${from}|${st}|${epoch}`;
    let s = this.in.get(key);
    if (!s) {
      s = { from, st, epoch, expect: 1, pending: new Map(), frag: null, nackAt: 0, top: 0 };
      this.in.set(key, s);
    }
    return s;
  }

  receive(from, pkt) {
    if (this.closed || !pkt || typeof pkt !== 'object') return;
    if (pkt.c) { this.control(from, pkt); return; }
    if (typeof pkt.s !== 'number' || (pkt.st !== 'd' && pkt.st !== 'b')) return;
    if (pkt.st === 'b') {
      const f = this.follows.get(from);
      if (!f) return;
      if (f.epoch === null) { if (f.early.length < 4000) f.early.push([from, pkt]); return; }
      if (pkt.e !== f.epoch) return;
    }
    const s = this.incoming(from, pkt.st, pkt.e);
    if (pkt.s < s.expect) return;
    s.top = Math.max(s.top, pkt.s);
    if (pkt.s > s.expect) {
      s.pending.set(pkt.s, pkt);
      this.checkGap(s);
      return;
    }
    this.deliver(s, pkt);
    s.expect++;
    while (s.pending.has(s.expect)) {
      const next = s.pending.get(s.expect);
      s.pending.delete(s.expect);
      this.deliver(s, next);
      s.expect++;
    }
  }

  deliver(s, pkt) {
    const b = s.st === 'b';
    if (pkt.m) {
      s.frag = null;
      for (const msg of pkt.m) this.dispatch(s.from, msg, b);
    } else if (pkt.fr) {
      const [i, n] = pkt.fr;
      if (i === 0) s.frag = [];
      if (!s.frag) return;
      s.frag.push(pkt.d);
      if (i === n - 1) {
        const text = s.frag.join('');
        s.frag = null;
        let msg;
        try { msg = JSON.parse(text); } catch { return; }
        this.dispatch(s.from, msg, b);
      }
    }
  }

  dispatch(from, msg, b) {
    try { this.onMessage?.(from, msg, b); } catch (err) { console.error('Multiplayer message failed', msg?.t, err); }
  }

  // Ask for what's missing, after a short wait in case it is only late.
  checkGap(s, now = performance.now()) {
    if (s.expect > s.top) return;
    if (!s.gapSince) s.gapSince = now;
    if (now - s.gapSince < 150 || now < s.nackAt) return;
    let end = s.expect;
    while (end + 1 <= s.top && !s.pending.has(end + 1) && end - s.expect < 400) end++;
    s.nackAt = now + 700;
    this.sendPacket(s.from, { c: 'nack', st: s.st, e: s.epoch, a: s.expect, b: end });
  }

  control(from, pkt) {
    if (pkt.c === 'hb') {
      if (pkt.st === 'b' && this.follows.get(from)?.epoch !== pkt.e) return;
      const s = this.incoming(from, pkt.st, pkt.e);
      if (typeof pkt.s === 'number' && pkt.s >= s.expect) { s.top = Math.max(s.top, pkt.s); this.checkGap(s); }
    } else if (pkt.c === 'nack') {
      if (pkt.e !== this.epoch) return;
      const s = this.out.get(pkt.st === 'b' ? '*' : from);
      if (!s) return;
      const a = Math.max(1, pkt.a | 0), b = Math.min(s.seq, pkt.b | 0);
      for (let q = a; q <= b; q++) {
        const p = s.sent.get(q);
        if (!p) { this.sendPacket(from, { c: 'reset', st: pkt.st, e: this.epoch, s: b + 1 }); return; }
        this.sendPacket(from, p);
      }
    } else if (pkt.c === 'reset') {
      if (pkt.st === 'b' && this.follows.get(from)?.epoch !== pkt.e) return;
      const s = this.incoming(from, pkt.st, pkt.e);
      if (typeof pkt.s !== 'number' || pkt.s <= s.expect) return;
      s.expect = pkt.s;
      s.frag = null;
      for (const k of [...s.pending.keys()]) if (k < s.expect) s.pending.delete(k);
      this.onLoss?.(from, pkt.st === 'b');
      // Deliver whatever was already waiting beyond the gap.
      while (s.pending.has(s.expect)) {
        const next = s.pending.get(s.expect);
        s.pending.delete(s.expect);
        this.deliver(s, next);
        s.expect++;
      }
    }
  }

  // Periodic upkeep: re-ask for gaps that are still open.
  tick() {
    const now = performance.now();
    for (const s of this.in.values()) {
      if (s.expect <= s.top) this.checkGap(s, now);
      else s.gapSince = 0;
    }
  }

  forget(addr) {
    this.out.delete(addr);
    for (const [k, s] of this.in) if (s.from === addr) this.in.delete(k);
    this.follows.delete(addr);
  }

  close() {
    this.closed = true;
    for (const t of this.transports) { t.onPacket = null; t.onPresence = null; }
  }
}
