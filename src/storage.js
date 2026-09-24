// Saves worlds in IndexedDB. Only chunks the player changed are stored (run-length encoded);
// everything else is regenerated from the seed. Falls back to memory if IndexedDB is unavailable.
const DB_NAME = 'blockhaven';
const DB_VERSION = 1;

let dbPromise = null;
const memory = { worlds: new Map(), chunks: new Map() };

function req(r) {
  return new Promise((resolve, reject) => {
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
}

export function openDB() {
  if (!dbPromise) {
    dbPromise = new Promise((resolve) => {
      try {
        const r = indexedDB.open(DB_NAME, DB_VERSION);
        r.onupgradeneeded = () => {
          const db = r.result;
          if (!db.objectStoreNames.contains('worlds')) db.createObjectStore('worlds', { keyPath: 'id' });
          if (!db.objectStoreNames.contains('chunks')) db.createObjectStore('chunks');
        };
        r.onsuccess = () => resolve(r.result);
        r.onerror = () => resolve(null);
        r.onblocked = () => resolve(null);
      } catch {
        resolve(null);
      }
    });
  }
  return dbPromise;
}

export async function persistent() { return !!(await openDB()); }

export async function listWorlds() {
  const db = await openDB();
  const all = db ? await req(db.transaction('worlds').objectStore('worlds').getAll()).catch(() => []) : [...memory.worlds.values()];
  return all.sort((a, b) => (b.lastPlayed ?? 0) - (a.lastPlayed ?? 0));
}

export async function saveWorld(meta) {
  const db = await openDB();
  if (!db) { memory.worlds.set(meta.id, structuredClone(meta)); return; }
  await req(db.transaction('worlds', 'readwrite').objectStore('worlds').put(meta)).catch((e) => console.warn('Save failed', e));
}

export async function loadWorld(id) {
  const db = await openDB();
  if (!db) return memory.worlds.get(id) ?? null;
  return (await req(db.transaction('worlds').objectStore('worlds').get(id)).catch(() => null)) ?? null;
}

export async function deleteWorld(id) {
  const db = await openDB();
  if (!db) {
    memory.worlds.delete(id);
    for (const k of [...memory.chunks.keys()]) if (k.startsWith(`${id}/`)) memory.chunks.delete(k);
    return;
  }
  const tx = db.transaction(['worlds', 'chunks'], 'readwrite');
  tx.objectStore('worlds').delete(id);
  tx.objectStore('chunks').delete(IDBKeyRange.bound(`${id}/`, `${id}/￿`));
  await new Promise((resolve) => { tx.oncomplete = tx.onerror = tx.onabort = resolve; });
}

// Run-length encoding: pairs of (count, value), count <= 255.
export function encodeRLE(data) {
  const out = new Uint8Array(data.length * 2);
  let o = 0;
  for (let i = 0; i < data.length;) {
    const v = data[i];
    let n = 1;
    while (n < 255 && i + n < data.length && data[i + n] === v) n++;
    out[o++] = n;
    out[o++] = v;
    i += n;
  }
  return out.slice(0, o);
}

export function decodeRLE(data, size) {
  const out = new Uint8Array(size);
  let o = 0;
  for (let i = 0; i + 1 < data.length && o < size; i += 2) {
    out.fill(data[i + 1], o, Math.min(size, o + data[i]));
    o += data[i];
  }
  return out;
}

// Per-world chunk store used by World.
export class WorldStore {
  constructor(worldId, size) {
    this.id = worldId;
    this.size = size;
    this.keys = new Set();
    this.db = null;
    this.pending = new Map();
    this.writing = null;
  }

  async init() {
    this.db = await openDB();
    const prefix = `${this.id}/`;
    let keys;
    if (this.db) {
      keys = await req(this.db.transaction('chunks').objectStore('chunks')
        .getAllKeys(IDBKeyRange.bound(prefix, `${prefix}￿`))).catch(() => []);
    } else {
      keys = [...memory.chunks.keys()].filter((k) => k.startsWith(prefix));
    }
    for (const k of keys) this.keys.add(Number(k.slice(prefix.length)));
    return this;
  }

  has(key) { return this.keys.has(key) || this.pending.has(key); }

  async loadChunk(key) {
    if (this.pending.has(key)) return decodeRLE(this.pending.get(key), this.size);
    const k = `${this.id}/${key}`;
    const data = this.db
      ? await req(this.db.transaction('chunks').objectStore('chunks').get(k)).catch(() => null)
      : memory.chunks.get(k);
    return data ? decodeRLE(data, this.size) : null;
  }

  saveChunk(key, blocks) {
    this.keys.add(key);
    this.pending.set(key, encodeRLE(blocks));
    if (!this.writing) this.writing = Promise.resolve().then(() => this.flush());
  }

  async flush() {
    while (this.pending.size) {
      const batch = [...this.pending];
      if (!this.db) {
        for (const [key, data] of batch) memory.chunks.set(`${this.id}/${key}`, data);
      } else {
        const tx = this.db.transaction('chunks', 'readwrite');
        const store = tx.objectStore('chunks');
        for (const [key, data] of batch) store.put(data, `${this.id}/${key}`);
        await new Promise((resolve) => { tx.oncomplete = tx.onerror = tx.onabort = resolve; });
      }
      for (const [key, data] of batch) if (this.pending.get(key) === data) this.pending.delete(key);
    }
    this.writing = null;
  }

  async drain() {
    if (this.writing) await this.writing;
    if (this.pending.size) await this.flush();
  }
}

// Small preferences (settings) live in localStorage.
export function loadPrefs(key, fallback) {
  try {
    const v = localStorage.getItem(key);
    return v ? { ...fallback, ...JSON.parse(v) } : { ...fallback };
  } catch {
    return { ...fallback };
  }
}

export function savePrefs(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* storage unavailable */ }
}
