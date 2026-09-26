// The relay: how a game with a join code gets through when two browsers can't connect directly.
// Some networks (at schools, offices and on some phones) let no direct connection through, and
// some block the PeerJS server. Then packets go by way of a public MQTT broker, reached over a
// secure WebSocket like any web page: the host listens at every broker it can reach, a guest asks
// at all of them and talks to the host at the first that answers. Nothing is kept there, and the
// Link on top (net.js) makes up for anything lost on the way. What goes through a broker is sealed
// (AES-GCM) with a key made from the join code, on topics named after another part of its hash,
// so that someone watching a public broker sees neither the code nor what's said.
const BROKERS = [
  { url: 'wss://public.cloud.shiftr.io', user: 'public', pass: 'public' },
  { url: 'wss://broker.emqx.io:8084/mqtt' },
  { url: 'wss://broker.hivemq.com:8884/mqtt' },
];
const ROOT = 'bh1';
// A player not heard from in this long has gone (everyone sends their presence now and then).
const QUIET = 20000;
const enc = new TextEncoder(), dec = new TextDecoder();

const randomId = () => Math.random().toString(36).slice(2, 10);
const same = (a, b) => a === b || JSON.stringify(a) === JSON.stringify(b);

function concat(parts) {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let o = 0;
  for (const p of parts) { out.set(p, o); o += p.length; }
  return out;
}
function str(s) {
  const b = enc.encode(s);
  return concat([Uint8Array.of(b.length >> 8, b.length & 255), b]);
}
// An MQTT packet: its type byte, the length of the rest, the rest.
function packet(type, parts) {
  const body = concat(parts), len = [];
  let n = body.length;
  do { let d = n % 128; n = Math.floor(n / 128); if (n > 0) d |= 128; len.push(d); } while (n > 0);
  return concat([Uint8Array.of(type, ...len), body]);
}

// A small MQTT 3.1.1 client: connect, subscribe and publish (at most once), and keep alive.
class Mqtt {
  static connect(broker, clientId, timeout = 6000) {
    return new Promise((resolve, reject) => {
      let ws;
      try { ws = new WebSocket(broker.url, 'mqtt'); } catch (e) { reject(e); return; }
      ws.binaryType = 'arraybuffer';
      const m = new Mqtt(ws);
      const fail = (why) => { clearTimeout(t); m.close(); reject(new Error(why)); };
      const t = setTimeout(() => fail('no answer'), timeout);
      ws.onopen = () => {
        const flags = 0x02 | (broker.user ? 0x80 : 0) | (broker.pass ? 0x40 : 0);
        m.raw(packet(0x10, [str('MQTT'), Uint8Array.of(4, flags, 0, 60), str(clientId),
          ...(broker.user ? [str(broker.user)] : []), ...(broker.pass ? [str(broker.pass)] : [])]));
      };
      ws.onerror = () => fail('socket error');
      ws.onclose = () => fail('closed');
      m.onConnack = (rc) => {
        if (rc !== 0) { fail(`refused (${rc})`); return; }
        clearTimeout(t);
        ws.onerror = null;
        ws.onclose = () => m.lost();
        resolve(m);
      };
    });
  }

  constructor(ws) {
    this.ws = ws;
    this.buf = new Uint8Array(0);
    this.nextId = 1;
    this.dead = false;
    this.onMessage = null; // (topic, bytes)
    this.onClose = null;
    this.onConnack = null;
    ws.onmessage = (e) => this.data(new Uint8Array(e.data));
    this.pinger = setInterval(() => this.raw(Uint8Array.of(0xc0, 0)), 25000);
  }

  raw(bytes) {
    if (this.dead || this.ws.readyState !== 1) return false;
    try { this.ws.send(bytes); return true; } catch { return false; }
  }

  subscribe(topic) {
    const id = this.nextId++ & 0xffff || 1;
    this.raw(packet(0x82, [Uint8Array.of(id >> 8, id & 255), str(topic), Uint8Array.of(0)]));
  }

  publish(topic, bytes) { return this.raw(packet(0x30, [str(topic), bytes])); }

  // (Packets can arrive split across messages, or several in one.)
  data(bytes) {
    this.buf = this.buf.length ? concat([this.buf, bytes]) : bytes;
    for (;;) {
      const b = this.buf;
      if (b.length < 2) return;
      let len = 0, mul = 1, i = 1;
      for (; i < 5; i++) {
        if (i >= b.length) return;
        len += (b[i] & 127) * mul;
        mul *= 128;
        if (!(b[i] & 128)) break;
      }
      const start = i + 1;
      if (b.length < start + len) return;
      this.handle(b[0] >> 4, b[0] & 15, b.subarray(start, start + len));
      this.buf = b.subarray(start + len);
    }
  }

  handle(type, flags, body) {
    if (type === 2) this.onConnack?.(body[1]);
    else if (type === 3) {
      const tl = (body[0] << 8) | body[1];
      const topic = dec.decode(body.subarray(2, 2 + tl));
      const qos = (flags >> 1) & 3;
      this.onMessage?.(topic, body.slice(2 + tl + (qos ? 2 : 0)));
    }
  }

  lost() {
    if (this.dead) return;
    this.close();
    this.onClose?.();
  }

  close() {
    if (this.dead) return;
    this.dead = true;
    clearInterval(this.pinger);
    try { if (this.ws.readyState === 1) this.ws.send(Uint8Array.of(0xe0, 0)); } catch { /* going anyway */ }
    try { this.ws.close(); } catch { /* already closed */ }
  }
}

// The topics and seal for a join code.
async function sealFor(code) {
  const h = new Uint8Array(await crypto.subtle.digest('SHA-256', enc.encode(`blockhaven relay ${code}`)));
  const key = await crypto.subtle.importKey('raw', h.slice(16), 'AES-GCM', false, ['encrypt', 'decrypt']);
  const room = `${ROOT}/${[...h.slice(0, 8)].map((b) => b.toString(16).padStart(2, '0')).join('')}`;
  return {
    host: `${room}/h`,
    guest: (id) => `${room}/${id}`,
    async seal(obj) {
      const iv = crypto.getRandomValues(new Uint8Array(12));
      return concat([iv, new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, enc.encode(JSON.stringify(obj))))]);
    },
    async open(bytes) {
      try {
        const d = JSON.parse(dec.decode(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: bytes.slice(0, 12) }, key, bytes.slice(12))));
        return d && typeof d === 'object' ? d : null;
      } catch { return null; }
    },
  };
}

// Packets and presence through a broker, as PeerTransport does over direct connections: the host
// passes everyone's presence on to everyone else.
export class RelayTransport {
  // The host: listening at every broker that answers (ready as soon as one does; the others join
  // in as they answer).
  static async host(code) {
    const seal = await sealFor(code);
    return new Promise((resolve, reject) => {
      const id = randomId();
      let t = null, settled = 0;
      const done = () => { if (++settled === BROKERS.length && !t) reject(new Error('No relay could be reached.')); };
      BROKERS.forEach((b, i) => Mqtt.connect(b, `bh-${id}-${i}`).then((m) => {
        if (!t) { t = new RelayTransport(code, seal, null, []); resolve(t); }
        if (t.dead) m.close(); else t.addBroker(i, m);
        done();
      }, done));
    });
  }

  // A guest: asks at every broker at once, and talks to the host at the first where it answers.
  // (The host's first answer also says who's already there: it's passed on once the game is
  // listening.)
  static async join(code) {
    const seal = await sealFor(code);
    return new Promise((resolve, reject) => {
      const id = randomId(), conns = [];
      let done = false, failed = 0;
      const stop = (m = null) => {
        done = true;
        clearTimeout(timer);
        for (const o of conns) if (o) { clearInterval(o.asking); if (o !== m) o.close(); }
      };
      const timer = setTimeout(() => {
        if (!done) { stop(); reject(Object.assign(new Error('No game with that code answered through the relay.'), { noAnswer: true })); }
      }, 9000);
      BROKERS.forEach((b, i) => Mqtt.connect(b, `bh-${id}-${i}`).then((m) => {
        if (done) { m.close(); return; }
        conns[i] = m;
        m.onMessage = async (topic, bytes) => {
          const d = await seal.open(bytes);
          if (done || !d?.ok) return;
          stop(m);
          const t = new RelayTransport(code, seal, id, [m]);
          setTimeout(() => t.handle(0, d), 0);
          resolve(t);
        };
        m.subscribe(seal.guest(id));
        const hi = () => seal.seal({ f: id, hi: 1 }).then((bytes) => m.publish(seal.host, bytes));
        hi();
        m.asking = setInterval(hi, 1500);
      }, () => {
        if (++failed === BROKERS.length && !done) { stop(); reject(new Error('The relay couldn’t be reached.')); }
      }));
    });
  }

  constructor(code, seal, guestId, brokers) {
    this.code = code;
    this.seal = seal;
    this.kind = 'relay';
    this.prefix = 'm:';
    this.isHost = !guestId;
    this.id = guestId;
    this.hostAddr = 'm:h';
    this.me = this.isHost ? this.hostAddr : `m:${guestId}`;
    this.maxPacket = 12000;
    this.brokers = brokers;          // host: one per broker (null where none); guest: the one
    this.guests = new Map();         // host: address -> { b: broker index, id, seen }
    this.presence = null;
    this.sentPresence = null;
    this.lastPresence = 0;
    this.states = new Map();         // host: address -> presence of each guest (relayed)
    this.relay = new Map();          // host: address -> presence waiting to be passed on (null: left)
    this.heard = performance.now();  // guest: when the host was last heard from
    this.onPacket = null;
    this.onPresence = null;
    this.onStatus = null;
    this.connected = true;
    this.dead = false;
    brokers.forEach((m, i) => this.addBroker(i, m));
    this.timer = setInterval(() => this.pump(), 50);
  }

  addBroker(i, m) {
    this.brokers[i] = m;
    m.onMessage = (topic, bytes) => this.seal.open(bytes).then((d) => { if (d && !this.dead) this.handle(i, d); });
    m.onClose = () => this.brokerLost(i);
    m.subscribe(this.isHost ? this.seal.host : this.seal.guest(this.id));
  }

  get ready() { return !this.dead; }
  get self() { return this.me; }

  sendRaw(addr, obj) {
    const [m, topic, body] = this.isHost ? [this.brokers[this.guests.get(addr)?.b], this.seal.guest(addr.slice(2)), obj]
      : [this.brokers[0], this.seal.host, { f: this.id, ...obj }];
    if (m) this.seal.seal(body).then((bytes) => m.publish(topic, bytes));
  }

  send(to, pkt) {
    if (to === '*') { for (const a of this.guests.keys()) this.sendRaw(a, { p: pkt }); }
    else this.sendRaw(to, { p: pkt });
  }

  setPresence(obj) { this.presence = obj; }

  // Another transport's player (a host's guests on PeerJS and here see each other).
  injectPresence(addr, pres) {
    if (!this.isHost) return;
    if (pres) this.states.set(addr, pres); else this.states.delete(addr);
    this.relay.set(addr, pres ?? null);
  }

  // A message, opened, from broker `b`.
  handle(b, d) {
    if (this.isHost) {
      if (typeof d.f !== 'string' || !/^[a-z0-9]{1,12}$/.test(d.f)) return;
      const addr = `m:${d.f}`;
      let g = this.guests.get(addr);
      if (d.bye) { if (g) this.lost(addr); return; }
      if (!g) {
        // A newcomer: say we're here, and tell them about everyone already here.
        g = { b, seen: 0 };
        this.guests.set(addr, g);
        const all = {};
        if (this.presence) all[this.me] = this.presence;
        for (const [a, s] of this.states) all[a] = s;
        this.sendRaw(addr, { ok: 1, pr: all });
      } else if (d.hi) this.sendRaw(addr, { ok: 1 });
      g.seen = performance.now();
      if (d.pr && typeof d.pr === 'object') {
        const s = d.pr[addr];
        if (s && typeof s === 'object') { this.states.set(addr, s); this.relay.set(addr, s); this.onPresence?.(addr, s); }
      }
      if (d.p !== undefined) this.onPacket?.(addr, d.p);
      return;
    }
    this.heard = performance.now();
    if (d.bye) { this.hostGone(); return; }
    if (d.pr && typeof d.pr === 'object') {
      for (const [a, s] of Object.entries(d.pr)) {
        if (a === this.me) continue;
        if (s) this.states.set(a, s); else this.states.delete(a);
        this.onPresence?.(a, s ?? null);
      }
    }
    if (d.p !== undefined) this.onPacket?.(this.hostAddr, d.p);
  }

  lost(addr) {
    if (!this.guests.delete(addr)) return;
    this.states.delete(addr);
    this.relay.set(addr, null);
    this.onPresence?.(addr, null);
  }

  hostGone() {
    if (!this.connected) return;
    this.connected = false;
    this.onStatus?.(false);
    for (const a of this.states.keys()) this.onPresence?.(a, null);
    this.states.clear();
    this.onPresence?.(this.hostAddr, null);
  }

  brokerLost(i) {
    this.brokers[i] = null;
    if (this.isHost) { for (const [a, g] of this.guests) if (g.b === i) this.lost(a); }
    else this.hostGone();
  }

  pump() {
    if (this.dead) return;
    const now = performance.now();
    if (this.isHost) {
      for (const [a, g] of this.guests) if (now - g.seen > QUIET) this.lost(a);
    } else if (this.connected && now - this.heard > QUIET) this.hostGone();
    if (now - this.lastPresence < 100) return;
    // (Presence goes again every few seconds even unchanged: it says we're still here.)
    const beat = now - this.lastPresence > 4000;
    this.lastPresence = now;
    if (this.isHost) {
      if (this.presence && (beat || !same(this.presence, this.sentPresence))) { this.sentPresence = this.presence; this.relay.set(this.me, this.presence); }
      if (!this.relay.size) return;
      for (const a of this.guests.keys()) {
        const out = {};
        for (const [k, v] of this.relay) if (k !== a) out[k] = v;
        if (Object.keys(out).length) this.sendRaw(a, { pr: out });
      }
      this.relay.clear();
    } else if (this.presence && (beat || !same(this.presence, this.sentPresence))) {
      this.sentPresence = this.presence;
      this.sendRaw(this.hostAddr, { pr: { [this.me]: this.presence } });
    }
  }

  list() { return [...this.states]; }

  close() {
    if (this.dead) return;
    // (Everyone hears we've gone, rather than waiting to notice.)
    if (this.isHost) { for (const a of this.guests.keys()) this.sendRaw(a, { bye: 1 }); } else this.sendRaw(this.hostAddr, { bye: 1 });
    this.dead = true;
    clearInterval(this.timer);
    setTimeout(() => { for (const m of this.brokers) m?.close(); }, 300);
  }
}
