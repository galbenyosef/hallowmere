import {readFile, readdir, stat} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {resolve} from 'node:path';

const root = resolve('dist');
// Resolve URLs as a project site so root-relative paths cannot pass validation.
const siteURL = new URL('https://example.test/hallowmere/');
function resolveReference(reference, source) {
  const url = new URL(reference, new URL(source, siteURL));
  if (url.origin !== siteURL.origin || !url.pathname.startsWith(siteURL.pathname)) {
    throw Error(`Asset escapes the site directory: ${reference} in ${source}`);
  }
  return decodeURIComponent(url.pathname.slice(siteURL.pathname.length));
}
async function validateReference(reference, source = 'index.html') {
  if (/^(?:[a-z][a-z\d+.-]*:|#)/i.test(reference)) return;
  await stat(resolve(root, resolveReference(reference, source)));
}

// Every file under dist/** as a site-relative path, so a module someone drops in a subdirectory
// is checked like any other. The vendored three.js bundles are skipped: they hold no `$` calls
// and no root-relative URLs, and re-parsing two megabytes of third-party source buys nothing.
async function collect(directory = '') {
  const found = [];
  const entries = await readdir(resolve(root, directory), {withFileTypes: true});
  for (const entry of entries.sort((a, b) => a.name < b.name ? -1 : 1)) {
    const file = directory ? `${directory}/${entry.name}` : entry.name;
    if (!entry.isDirectory()) found.push(file);
    else if (file !== 'vendor') found.push(...await collect(file));
  }
  return found;
}
const files = await collect();

for (const file of files.filter(name => name.endsWith('.js'))) {
  execFileSync(process.execPath, ['--check', resolve(root, file)]);
  const source = await readFile(resolve(root, file), 'utf8');
  if (/["'`]\/(?:assets|vendor)\//.test(source)) {
    throw Error(`Root-relative asset URL in ${file}; use a relative URL for project hosting.`);
  }
  for (const match of source.matchAll(/\bfrom\s*['"]([^'"]+)['"]/g)) {
    if (match[1].startsWith('.')) await validateReference(match[1], file);
  }
}

const html = await readFile(resolve(root, 'index.html'), 'utf8');
for (const match of html.matchAll(/(?:src|href)="([^"]+)"/g)) {
  await validateReference(match[1]);
}
const importMap = JSON.parse(html.match(/<script type="importmap">([\s\S]*?)<\/script>/)[1]);
for (const reference of Object.values(importMap.imports)) await validateReference(reference);
for (const file of ['vendor/three.core.js', 'vendor/loaders/GLTFLoader.js', 'vendor/utils/BufferGeometryUtils.js']) {
  await stat(resolve(root, file));
}

// Blanks comments and regex literals ahead of the module scans, so a commented-out `$('id')` is
// not read as a contract and a pattern holding a quote cannot desynchronise the string tracking.
// Literal text survives, because the calls and specifiers being collected are string literals.
const REGEX_KEYWORD = /(?:^|[^\w$.])(?:return|typeof|instanceof|in|of|new|delete|void|throw|case|do|else|yield|await)$/;
function strip(source) {
  let out = '', tail = '', i = 0;
  const blank = text => text.replace(/[^\n]/g, ' ');
  // `tail` mirrors the emitted output but stays short: scanning the whole of `out` for the
  // preceding token would make the pass quadratic, and a hundred-megabyte build out of reach.
  const add = text => {
    out += text; tail += text;
    if (tail.length > 160) {const kept = tail.replace(/\s+$/, ''); tail = (kept || tail).slice(-80);}
  };
  const regexAllowed = () => {
    const before = tail.replace(/\s+$/, ''), ch = before.at(-1);
    if (!ch) return true;
    if (ch === ')' || ch === ']') return false;
    if (/[\w$]/.test(ch)) return REGEX_KEYWORD.test(before);
    return true;
  };
  const literal = quote => {
    add(quote); i++;
    while (i < source.length) {
      const c = source[i];
      if (c === '\\') {add(source.slice(i, i + 2)); i += 2; continue;}
      add(c); i++;
      if (c === quote) return;
    }
  };
  const template = () => {
    add('`'); i++;
    while (i < source.length) {
      const c = source[i];
      if (c === '\\') {add(source.slice(i, i + 2)); i += 2; continue;}
      if (c === '`') {add('`'); i++; return;}
      if (c === '$' && source[i + 1] === '{') {add('${'); i += 2; code('}'); if (source[i] === '}') {add('}'); i++;} continue;}
      add(c); i++;
    }
  };
  // Only consumes a real regex literal: an unterminated one is a misread division, so the slash
  // is emitted as an operator and the code after it stays visible to the scans.
  const regex = () => {
    const start = i;
    let j = i + 1, cls = false, closed = false;
    while (j < source.length) {
      const c = source[j];
      if (c === '\\') {j += 2; continue;}
      if (c === '\n') break;
      if (c === '[') cls = true;
      else if (c === ']') cls = false;
      else if (c === '/' && !cls) {j++; while (j < source.length && /[\w$]/.test(source[j])) j++; closed = true; break;}
      j++;
    }
    if (!closed) {add('/'); i++; return;}
    add(blank(source.slice(start, j))); i = j;
  };
  const code = end => {
    let depth = 0;
    while (i < source.length) {
      const c = source[i], n = source[i + 1];
      if (c === '}' && end) {if (depth === 0) return; depth--; add(c); i++; continue;}
      if (c === '{' && end) depth++;
      if (c === '/' && n === '/') {const j = source.indexOf('\n', i), stop = j < 0 ? source.length : j; add(blank(source.slice(i, stop))); i = stop; continue;}
      if (c === '/' && n === '*') {const j = source.indexOf('*/', i + 2), stop = j < 0 ? source.length : j + 2; add(blank(source.slice(i, stop))); i = stop; continue;}
      if (c === '/' && regexAllowed()) {regex(); continue;}
      if (c === '\'' || c === '"') {literal(c); continue;}
      if (c === '`') {template(); continue;}
      add(c); i++;
    }
  };
  code('');
  return out;
}

// Static imports, re-exports, and dynamic imports. Bare specifiers ('three', 'three/addons/…')
// are resolved by the import map, so only relative ones name a file the walk can follow.
const STATIC = /(?:^|[;{}])\s*(?:import|export)\s*(?:[\w$*{}\s,]*?\bfrom\s*)?(['"])([^'"]+)\1/gm;
const DYNAMIC = /\bimport\s*\(\s*(['"])([^'"]+)\1\s*\)/g;
const specifiers = code => [STATIC, DYNAMIC].flatMap(pattern => {
  pattern.lastIndex = 0;
  return [...code.matchAll(pattern)].map(match => match[2]);
});

// The transitive closure of a page's module graph: its `<script type="module">` entry points,
// external or inline, plus everything they reach. The visited map is the cycle guard.
const SCRIPT = /<script\b([^>]*)>([\s\S]*?)<\/script>/gi;
async function closure(page, source) {
  const queue = [];
  for (const match of source.matchAll(SCRIPT)) {
    if (!/\btype\s*=\s*["']module["']/i.test(match[1])) continue;
    const src = match[1].match(/\bsrc\s*=\s*["']([^"']+)["']/i);
    if (src) queue.push({name: resolveReference(src[1], page), via: page});
    else queue.push({name: `<inline module ${queue.length + 1}>`, base: page, code: strip(match[2])});
  }
  const modules = new Map();
  while (queue.length) {
    const entry = queue.shift();
    if (modules.has(entry.name)) continue;
    const code = entry.code ?? strip(await readFile(resolve(root, entry.name), 'utf8')
      .catch(() => {throw Error(`Missing module: ${entry.name} imported by ${entry.via} (via ${page})`);}));
    modules.set(entry.name, code);
    const base = entry.base ?? entry.name;
    for (const specifier of specifiers(code)) {
      if (specifier.startsWith('.')) queue.push({name: resolveReference(specifier, base), via: entry.name});
    }
  }
  return modules;
}

// Every `$('id')` in a page's module closure must name an element that page actually declares,
// so splitting main.js up cannot quietly hand one page another page's markup.
const closures = [];
for (const page of files.filter(name => name.endsWith('.html'))) {
  const source = page === 'index.html' ? html : await readFile(resolve(root, page), 'utf8');
  const ids = new Set([...source.matchAll(/\bid="([^"]+)"/g)].map(match => match[1]));
  const modules = await closure(page, source);
  closures.push(`${page} ${modules.size}`);
  for (const [name, code] of modules) {
    // `$` is document.getElementById in the game modules and document.querySelector in the
    // menu-directions sketch, where the same contract is spelled `#id`; richer selectors there
    // are not id lookups, so they are left alone.
    const selector = /\$\s*=[^;\n]*querySelector/.test(code);
    for (const match of code.matchAll(/\$\('([^']+)'\)/g)) {
      const id = selector ? /^#[\w-]+$/.test(match[1]) && match[1].slice(1) : match[1];
      if (id && !ids.has(id)) throw Error(`Missing UI element: ${id} (${name} via ${page})`);
    }
  }
}

const hosting = JSON.parse(await readFile('.openai/hosting.json', 'utf8'));
if (hosting.static.directory !== 'dist') throw Error('Unexpected static directory');
console.log('Game scripts, DOM references, local assets, and project-site URLs validated.');
console.log(`Page module closures: ${closures.join(', ')}.`);

for (const directory of ['server','scripts']) {
 for (const file of await readdir(directory)) if(file.endsWith('.mjs')) execFileSync(process.execPath,['--check',resolve(directory,file)]);
}
const multiplayer=JSON.parse(await readFile('dist/multiplayer-config.json','utf8'));
if(typeof multiplayer.serverUrl!=='string'||multiplayer.serverUrl&&!multiplayer.serverUrl.startsWith('wss://')) throw Error('Invalid public multiplayer endpoint');
