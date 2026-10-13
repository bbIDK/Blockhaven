// Plays Blockhaven in a headless browser that stays open between commands, so Claude can look
// (screenshots), think and act like a player.
//   node play.mjs serve [--port 8130] [--url http://127.0.0.1:8123/index.html]   (run in the background)
//   node play.mjs <action> [args...] [; <action> ...]                              (each call: act, then report)
// Actions:
//   new [seed] [onepiece] [creative|survival]  make a world and go in (onepiece: the One Piece mod)
//   hold <Key> <seconds>     hold keys (KeyW, KeyA, KeyS, KeyD, Space, ShiftLeft, ControlLeft... "KeyW+Space" for both)
//   tap <Key>                press a key once (Digit1..9 pick the hotbar, KeyE inventory, Escape...)
//   turn <degrees> [pitch]   turn right by degrees (negative: left), pitch up/down by degrees
//   face <yaw> <pitch>       look a given way (degrees; yaw 0 = north (-z), 90 = east)
//   mine [seconds]           hold the left mouse button (break, attack)
//   use [seconds]            right mouse button (place, eat, open...)
//   cmd </command>           run a chat command (/tp, /give, /time set day, /locate town...)
//   wait <seconds>           let the world run (hold, mine, use and wait count game time, not real time)
//   shot [name]              screenshot (the reply says where it was saved)
//   state                    where you are, what you're looking at, health, hunger, held item, creatures near
//   eval <js>                run JavaScript in the page (window.blockhaven is the game)
//   quit                     close the browser and stop the server
import http from 'node:http';
import { spawn } from 'node:child_process';
const args = process.argv.slice(2);
const opt = (name, def) => { const i = args.indexOf(`--${name}`); return i >= 0 ? args.splice(i, 2)[1] : def; };
const PORT = Number(opt('port', 8130));
const URL_ = opt('url', 'http://127.0.0.1:8123/index.html');
const OUT = opt('out', '/tmp/blockhaven-play');

if (args[0] === 'serve') await serve();
else await client(args.join(' '));

async function client(script) {
  const body = JSON.stringify({ script });
  const res = await new Promise((resolve, reject) => {
    const req = http.request({ host: '127.0.0.1', port: PORT, method: 'POST', path: '/', headers: { 'content-type': 'application/json' } }, (r) => {
      let d = ''; r.on('data', (c) => { d += c; }); r.on('end', () => resolve(d));
    });
    req.on('error', reject); req.end(body);
  }).catch((e) => `No play server on port ${PORT} (${e.code}): start one with "node play.mjs serve" in the background.`);
  console.log(res);
}

async function serve() {
  const { mkdirSync } = await import('node:fs');
  mkdirSync(OUT, { recursive: true });
  // The game's files served locally, if nothing is serving them yet.
  if (!(await fetch(URL_).then((r) => r.ok).catch(() => false))) {
    const root = new URL('../../../../', import.meta.url).pathname, port = new URL(URL_).port || '80';
    spawn('npx', ['-y', 'http-server@14.1.1', '-p', port, '-c-1', '-s', root], { stdio: 'ignore', detached: true }).unref();
    for (let i = 0; i < 60 && !(await fetch(URL_).then((r) => r.ok).catch(() => false)); i++) await new Promise((r) => setTimeout(r, 500));
  }
  const pw = await import('/opt/node22/lib/node_modules/playwright/index.mjs').catch(() => import('playwright'));
  const browser = await pw.chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const page = await browser.newPage({ viewport: { width: Number(opt('width', 960)), height: Number(opt('height', 540)) } });
  const log = [];
  page.on('pageerror', (e) => log.push(`PAGE ERROR: ${e.message}`));
  page.on('console', (m) => { if (m.type() === 'error') log.push(`console error: ${m.text()}`); });
  await page.goto(URL_);
  await page.waitForFunction(() => window.blockhaven?.state === 'title', null, { timeout: 60000 });
  let shots = 0;
  // Waits `secs` of game time (the software-rendered browser runs the game slower than real time).
  const gameWait = async (secs) => {
    const t0 = await page.evaluate(() => window.blockhaven.ticks ?? window.blockhaven.time);
    const want = secs * 20, start = Date.now();
    while (Date.now() - start < secs * 1000 * 20 + 5000) {
      const t = await page.evaluate(() => window.blockhaven.ticks ?? window.blockhaven.time);
      if ((((t - t0) % 24000) + 24000) % 24000 >= want) return;
      await page.waitForTimeout(50);
    }
  };
  const run = async (line) => {
    const [act, ...a] = line.trim().split(/\s+/), rest = line.trim().slice(act.length).trim();
    switch (act) {
      case 'new': {
        const seed = a.find((x) => !['onepiece', 'creative', 'survival'].includes(x)) ?? String(Date.now() % 100000);
        await page.evaluate(() => { localStorage.setItem('blockhaven.settings', JSON.stringify({ ...JSON.parse(localStorage.getItem('blockhaven.settings') || '{}'), renderDistance: 6, music: 0, volume: 0, name: 'Claude' })); });
        await page.reload(); await page.waitForFunction(() => window.blockhaven?.state === 'title', null, { timeout: 60000 });
        await page.click('[data-action=play]'); await page.waitForTimeout(300);
        if (await page.locator('#screen-worlds').isVisible()) await page.click('[data-action=new-world]');
        await page.fill('#cw-seed', seed);
        if (a.includes('onepiece')) { await page.click('#cw-mods'); await page.click('#cw-mods-list [data-mod=onepiece]'); }
        await page.click('#create-form button[type=submit]');
        await page.waitForFunction(() => window.blockhaven.state === 'play', null, { timeout: 240000 });
        await page.evaluate((mode) => { const g = window.blockhaven; if (mode) g.meta.mode = mode; g.input.capture = true; g.input.locked = true; }, a.includes('creative') ? 'creative' : a.includes('survival') ? 'survival' : null);
        await page.waitForFunction(() => window.blockhaven.world.progress(4) > 0.9, null, { timeout: 120000 }).catch(() => {});
        return `new world, seed ${seed}${a.includes('onepiece') ? ', One Piece' : ''}`;
      }
      case 'hold': {
        // (Real key events, as a person's keyboard sends them.)
        const keys = a[0].split('+'), secs = Number(a[1] ?? 0.5);
        await page.evaluate(() => { const k = window.blockhaven.input; k.capture = true; k.locked = true; });
        for (const c of keys) await page.keyboard.down(c);
        await gameWait(secs);
        for (const c of keys.reverse()) await page.keyboard.up(c);
        return `held ${keys.join('+')} ${secs}s`;
      }
      case 'tap':
        await page.keyboard.press(a[0], { delay: 80 });
        return `tapped ${a[0]}`;
      case 'turn': case 'face':
        await page.evaluate(([act, y, pt]) => {
          const p = window.blockhaven.player, r = Math.PI / 180;
          if (act === 'turn') { p.yaw -= y * r; p.pitch = Math.max(-1.55, Math.min(1.55, p.pitch + (pt || 0) * r)); }
          else { p.yaw = -y * r; p.pitch = (pt || 0) * r; }
        }, [act, Number(a[0] ?? 0), Number(a[1] ?? 0)]);
        return `${act} ${a.join(' ')}`;
      case 'mine': case 'use': {
        const b = act === 'mine' ? 1 : 2, secs = Number(a[0] ?? 0.15);
        await page.evaluate((b) => { const k = window.blockhaven.input; k.locked = true; k.buttons |= b; k.clicked |= b; }, b);
        await gameWait(secs);
        await page.evaluate((b) => { window.blockhaven.input.buttons &= ~b; }, b);
        return `${act} ${secs}s`;
      }
      case 'cmd': {
        const said = await page.evaluate((t) => { const out = []; window.blockhaven.command(t.replace(/^\//, ''), (m) => out.push(m)); return out; }, rest);
        await page.waitForTimeout(200);
        return `ran ${rest}${said.length ? `\n  game: ${said.join(' | ')}` : ''}`;
      }
      case 'wait': await gameWait(Number(a[0] ?? 1)); return `waited ${a[0] ?? 1}s of game time`;
      case 'shot': {
        const path = `${OUT}/${a[0] ?? `shot${++shots}`}.png`;
        await page.screenshot({ path, timeout: 120000 });
        return `screenshot: ${path}`;
      }
      case 'state': return JSON.stringify(await page.evaluate(async () => {
        const { BLOCKS } = await import('./src/blocks.js').catch(() => ({ BLOCKS: [] }));
        const { ITEMS } = await import('./src/items.js').catch(() => ({ ITEMS: new Map() }));
        const nameOf = (id) => ITEMS.get(id)?.name ?? BLOCKS[id]?.name ?? id;
        const g = window.blockhaven, p = g.player, W = g.world, d = 180 / Math.PI;
        if (!p || !W) return { screen: g.state };
        const t = g.target, near = (g.entities?.list ?? []).filter((e) => !e.dead && Math.hypot(e.x - p.x, e.z - p.z) < 24)
          .map((e) => `${e.type ?? (e.kind === 'item' ? `item:${nameOf(e.id)}` : e.kind ?? 'thing')}@${Math.round(Math.hypot(e.x - p.x, e.z - p.z))}m`).slice(0, 12);
        const it = g.inv?.held, held = it ? `${it.count ?? 1} x ${nameOf(it.id)}` : 'nothing';
        return { screen: g.state, mode: g.meta?.mode, pos: [p.x, p.y, p.z].map((v) => +v.toFixed(1)), facing: { yaw: Math.round(-p.yaw * d), pitch: Math.round(p.pitch * d) },
          onGround: p.onGround, inWater: p.inWater, health: g.health, food: g.food, held, target: !t ? null : t.entity ? { creature: t.entity.type, dist: +t.t.toFixed(1) } : t.player ? { player: t.player.name } : { block: BLOCKS[t.id]?.name ?? t.id, at: [t.x, t.y, t.z], dist: +t.t.toFixed(1) },
          time: g.time, raining: g.weather?.raining, near };
      }), null, 0);
      case 'eval': return JSON.stringify(await page.evaluate((src) => { const v = (0, eval)(src); return v; }, rest)) ?? 'undefined';
      case 'quit': setTimeout(() => { browser.close().catch(() => {}); setTimeout(() => process.exit(0), 1500); }, 100); return 'bye';
      default: return `unknown action "${act}"`;
    }
  };
  http.createServer((req, res) => {
    let body = ''; req.on('data', (c) => { body += c; });
    req.on('end', async () => {
      const out = [];
      for (const line of JSON.parse(body).script.split(';').filter((s) => s.trim())) {
        try { out.push(await run(line)); } catch (e) { out.push(`ERROR in "${line.trim()}": ${e.message.split('\n')[0]}`); }
      }
      if (log.length) out.push(...log.splice(0));
      res.end(out.join('\n'));
    });
  }).on('error', (e) => { console.log(e.code === 'EADDRINUSE' ? `Port ${PORT} is taken: a play server is already running ("node play.mjs quit" stops it).` : e.message); browser.close().finally(() => process.exit(1)); })
    .listen(PORT, '127.0.0.1', () => console.log(`play server on ${PORT}, game at ${URL_}, screenshots in ${OUT}`));
}
