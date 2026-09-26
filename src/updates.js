// A copy of the game can be older than the one on the site: a tab left open, or files the browser
// kept from before (the site's files can be kept for ten minutes, and each is kept on its own, so a
// page can even end up with some old and some new). The site's version.json says which update is
// newest; when it's newer than this one, `onNewer(files)` is called (once), and updateNow fetches
// every one of those files afresh before reloading, so they're all the new ones.
import { BUILD } from './version.js';

export function watchForUpdates(onNewer, every = 15 * 60 * 1000) {
  // (Not the single-file build, nor a page opened from disk: they have no site to ask.)
  if (globalThis.BLOCKHAVEN_WORKER_SRC || !/^https?:$/.test(location.protocol)) return () => {};
  let found = false;
  const check = async () => {
    if (found) return;
    try {
      const r = await fetch(new URL('version.json', document.baseURI), { cache: 'no-store' });
      if (!r.ok) return;
      const v = await r.json();
      if (Number.isInteger(v.build) && v.build > BUILD && Array.isArray(v.files)) { found = true; onNewer(v.files, v.build); }
    } catch { /* offline, or no version.json here */ }
  };
  check();
  setInterval(check, every);
  return check;
}

export async function updateNow(files) {
  await Promise.all(files.filter((f) => typeof f === 'string').map((f) => fetch(new URL(f, document.baseURI), { cache: 'reload' }).catch(() => null)));
  location.reload();
}
