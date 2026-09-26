#!/usr/bin/env node
// Bundles the game into one self-contained HTML file: dist/blockhaven.html.
// The result runs offline and straight from disk (file://), no server needed.
//
//   node tools/build.mjs                    build dist/blockhaven.html
//   node tools/build.mjs --fragment out.html  also write the page body without <html>/<head>
//
// No dependencies: ES modules are wrapped in a tiny CommonJS-style loader.
import { readFileSync, writeFileSync, mkdirSync, readdirSync } from 'node:fs';
import { dirname, resolve, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const fragmentAt = args.indexOf('--fragment');
const fragmentPath = fragmentAt >= 0 ? resolve(args[fragmentAt + 1]) : null;

const moduleId = (file) => relative(root, file).split('\\').join('/');

// Dependency-first list of modules reachable from `entry`.
function collect(entry) {
  const order = [];
  const seen = new Set();
  const visit = (file) => {
    if (seen.has(file)) return;
    seen.add(file);
    const src = readFileSync(file, 'utf8');
    for (const m of src.matchAll(/^import\s+(?:[^'"]*?from\s+)?['"](\.[^'"]+)['"];?/gm)) visit(resolve(dirname(file), m[1]));
    order.push({ file, src });
  };
  visit(resolve(root, entry));
  return order;
}

// Names declared by `const a = 1, b = [..], c = f(x, y);` starting at index i (after the keyword).
function declaredNames(src, i) {
  const names = [];
  let depth = 0, expectName = true;
  while (i < src.length) {
    if (expectName) {
      const m = /^\s*([\w$]+)/.exec(src.slice(i, i + 200));
      if (!m) throw new Error('Destructuring exports are not supported by the bundler');
      names.push(m[1]);
      i += m[0].length;
      expectName = false;
      continue;
    }
    const ch = src[i];
    // (Comments are skipped: an apostrophe in one isn't a quote.)
    if (ch === '/' && src[i + 1] === '/') { while (i < src.length && src[i] !== '\n') i++; continue; }
    if (ch === '/' && src[i + 1] === '*') { i = src.indexOf('*/', i + 2) + 2; if (i < 2) break; continue; }
    if (ch === '"' || ch === "'" || ch === '`') {
      for (i++; i < src.length && src[i] !== ch; i++) if (src[i] === '\\') i++;
    } else if (ch === '(' || ch === '[' || ch === '{') depth++;
    else if (ch === ')' || ch === ']' || ch === '}') depth--;
    else if (depth === 0 && ch === ',') expectName = true;
    else if (depth === 0 && ch === ';') break;
    i++;
  }
  return names;
}

function transform({ file, src }) {
  const id = moduleId(file);
  const target = (from) => JSON.stringify(moduleId(resolve(dirname(file), from)));
  const exported = [];
  for (const m of src.matchAll(/^export\s+(const|let|var)\s+/gm)) {
    for (const name of declaredNames(src, m.index + m[0].length)) exported.push([name, name]);
  }
  let out = src.replace(/^export\s+(const|let|var)\s+/gm, '$1 ');
  out = out.replace(/^import\s+\{([^}]*)\}\s+from\s+['"]([^'"]+)['"];?/gm, (_, names, from) => {
    const binds = names.split(',').map((s) => s.trim()).filter(Boolean).map((s) => s.replace(/\s+as\s+/, ': '));
    return `const { ${binds.join(', ')} } = __require(${target(from)});`;
  });
  out = out.replace(/^import\s+\*\s+as\s+([\w$]+)\s+from\s+['"]([^'"]+)['"];?/gm,
    (_, name, from) => `const ${name} = __require(${target(from)});`);
  // Imported only for what running it does (registering textures, say).
  out = out.replace(/^import\s+['"]([^'"]+)['"];?/gm, (_, from) => `__require(${target(from)});`);
  out = out.replace(/^export\s+(async\s+function|function|class)\s+([\w$]+)/gm, (_, kind, name) => {
    exported.push([name, name]);
    return `${kind} ${name}`;
  });
  out = out.replace(/^export\s+\{([^}]*)\};?/gm, (_, names) => {
    for (const n of names.split(',').map((s) => s.trim()).filter(Boolean)) {
      const [local, as] = n.split(/\s+as\s+/);
      exported.push([as ?? local, local]);
    }
    return '';
  });
  if (/^\s*(import|export)\s/m.test(out)) throw new Error(`Unsupported module syntax in ${id}`);
  const assigns = exported.map(([name, local]) => `__exports.${name} = ${local};`).join('\n');
  return `__define(${JSON.stringify(id)}, function (__exports) {\n${out}\n${assigns}\n});\n`;
}

const RUNTIME = `const __defs = Object.create(null), __cache = Object.create(null);
function __define(id, factory) { __defs[id] = factory; }
function __require(id) {
  if (__cache[id]) return __cache[id];
  const exports = (__cache[id] = {});
  __defs[id](exports);
  return exports;
}
`;

function bundle(entry) {
  const mods = collect(entry);
  return `${RUNTIME}${mods.map(transform).join('\n')}\n__require(${JSON.stringify(moduleId(resolve(root, entry)))});\n`;
}

const safe = (js) => js.replace(/<\/script/gi, '<\\/script');

const workerSrc = bundle('src/worker.js');
const mainSrc = `globalThis.BLOCKHAVEN_WORKER_SRC = ${JSON.stringify(workerSrc)};\n${bundle('src/main.js')}`;
// (The font goes in whole too, as a data URL.)
const fontUrl = "url('fonts/blockhaven-pixel.woff2')";
const cssSrc = readFileSync(resolve(root, 'src/style.css'), 'utf8');
if (!cssSrc.includes(fontUrl)) throw new Error('style.css no longer loads the font as expected');
const css = cssSrc.replace(fontUrl, () => `url(data:font/woff2;base64,${readFileSync(resolve(root, 'src/fonts/blockhaven-pixel.woff2')).toString('base64')})`);
let html = readFileSync(resolve(root, 'index.html'), 'utf8');

const cssTag = '<link rel="stylesheet" href="src/style.css">';
const jsTag = '<script type="module" src="src/main.js"></script>';
if (!html.includes(cssTag) || !html.includes(jsTag)) throw new Error('index.html no longer has the expected tags');
html = html.replace(cssTag, () => `<style>\n${css}</style>`);
// (PeerJS goes in whole, ahead of the game, as the single file can't load it from beside itself.)
const peerjs = readFileSync(resolve(root, 'src/vendor/peerjs.min.js'), 'utf8');
html = html.replace(jsTag, () => `<script>\n${safe(peerjs)}</script>\n<script type="module">\n${safe(mainSrc)}</script>`);

mkdirSync(resolve(root, 'dist'), { recursive: true });
writeFileSync(resolve(root, 'dist/blockhaven.html'), html);

// version.json, for the site: the newest update, and every file a page loads, which a page that's
// out of date fetches afresh before reloading (see src/updates.js).
const { BUILD } = await import('../src/version.js');
const files = (dir) => readdirSync(resolve(root, dir), { withFileTypes: true }).flatMap((f) => (f.isDirectory() ? files(`${dir}/${f.name}`)
  : /\.(js|css|woff2)$/.test(f.name) ? [`${dir}/${f.name}`] : []));
writeFileSync(resolve(root, 'version.json'), `${JSON.stringify({ build: BUILD, files: ['./', 'index.html', ...files('src').sort()] })}\n`);
console.log(`dist/blockhaven.html  ${(html.length / 1024).toFixed(0)} KB`);

if (fragmentPath) {
  // Page content without the document skeleton (for hosts that supply <html>/<head>/<body>).
  const head = html.match(/<head>([\s\S]*?)<\/head>/)[1];
  const body = html.match(/<body>([\s\S]*?)<\/body>/)[1];
  const keep = head.match(/<title>[\s\S]*?<\/title>|<link [^>]*>|<style>[\s\S]*?<\/style>/g).join('\n');
  writeFileSync(fragmentPath, `${keep}\n${body}`);
  console.log(`${fragmentPath}  ${((keep.length + body.length) / 1024).toFixed(0)} KB`);
}
