// A small pool of Web Workers. If workers can't start (old browser, strict sandbox), the same jobs
// run on the main thread within a per-frame time budget.
import { runJob } from './jobs.js';

const PER_WORKER = 2;

function spawn() {
  const src = globalThis.BLOCKHAVEN_WORKER_SRC;
  if (src) return new Worker(URL.createObjectURL(new Blob([src], { type: 'text/javascript' })));
  return new Worker(new URL('./worker.js', import.meta.url), { type: 'module' });
}

export class JobPool {
  constructor(onResult, onFailure) {
    this.onResult = onResult;
    this.onFailure = onFailure;
    this.workers = [];
    this.inflight = new Map();
    this.local = [];
    this.results = [];
    this.resultHead = 0;
    this.nextId = 1;
    const n = Math.max(1, Math.min(4, (navigator.hardwareConcurrency || 4) - 1));
    try {
      for (let i = 0; i < n; i++) {
        const w = spawn();
        // Results wait in a queue and are applied a few milliseconds' worth per frame, so a burst
        // of finished chunks can't stall a frame.
        w.onmessage = (e) => { this.results.push(w, e.data); };
        w.onerror = (e) => { e.preventDefault?.(); this.fallBack(e.message || 'worker error'); };
        this.workers.push(w);
        this.inflight.set(w, 0);
      }
    } catch (err) {
      this.fallBack(err.message);
    }
  }

  get threaded() { return this.workers.length > 0; }

  fallBack(reason) {
    if (!this.workers.length) return;
    console.warn('Workers unavailable, generating on the main thread:', reason);
    for (const w of this.workers) w.terminate();
    this.workers = [];
    this.inflight.clear();
    this.results = [];
    this.resultHead = 0;
    this.onFailure?.();
  }

  freeSlots() {
    if (!this.threaded) return Math.max(0, 3 - this.local.length);
    let free = 0;
    for (const n of this.inflight.values()) free += PER_WORKER - n;
    return free;
  }

  submit(job, transfer) {
    job.id = this.nextId++;
    if (!this.threaded) { this.local.push(job); return; }
    let best = null, bestN = Infinity;
    for (const [w, n] of this.inflight) if (n < bestN) { best = w; bestN = n; }
    this.inflight.set(best, bestN + 1);
    best.postMessage(job, transfer);
  }

  get queued() { return (this.results.length - this.resultHead) / 2 + this.local.length; }

  // Applies finished results (and, without workers, runs queued jobs) for up to `budgetMs`.
  update(budgetMs) {
    const end = performance.now() + budgetMs;
    let n = 0;
    while (this.resultHead < this.results.length && (n++ === 0 || performance.now() < end)) {
      const w = this.results[this.resultHead], data = this.results[this.resultHead + 1];
      this.results[this.resultHead] = this.results[this.resultHead + 1] = null;
      this.resultHead += 2;
      if (this.inflight.has(w)) this.inflight.set(w, this.inflight.get(w) - 1);
      this.onResult(data);
    }
    if (this.resultHead >= this.results.length) { this.results.length = 0; this.resultHead = 0; }
    while (!this.threaded && this.local.length && performance.now() < end) this.onResult(runJob(this.local.shift()).result);
  }

  terminate() {
    for (const w of this.workers) w.terminate();
    this.workers = [];
    this.local = [];
    this.results = [];
    this.resultHead = 0;
  }
}
