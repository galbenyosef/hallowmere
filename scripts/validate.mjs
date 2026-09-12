import {readFile, readdir, stat} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {resolve} from 'node:path';

const root = resolve('dist');
// Resolve URLs as a project site so root-relative paths cannot pass validation.
const siteURL = new URL('https://example.test/hallowmere/');
async function validateReference(reference, source = 'index.html') {
  if (/^(?:[a-z][a-z\d+.-]*:|#)/i.test(reference)) return;
  const url = new URL(reference, new URL(source, siteURL));
  if (url.origin !== siteURL.origin || !url.pathname.startsWith(siteURL.pathname)) {
    throw Error(`Asset escapes the site directory: ${reference} in ${source}`);
  }
  await stat(resolve(root, decodeURIComponent(url.pathname.slice(siteURL.pathname.length))));
}

const scripts = (await readdir(root)).filter(file => file.endsWith('.js'));
for (const file of scripts) {
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

const main = await readFile(resolve(root, 'main.js'), 'utf8');
const ids = new Set([...html.matchAll(/\bid="([^"]+)"/g)].map(match => match[1]));
for (const match of main.matchAll(/\$\('([^']+)'\)/g)) {
  if (!ids.has(match[1])) throw Error(`Missing UI element: ${match[1]}`);
}
const hosting = JSON.parse(await readFile('.openai/hosting.json', 'utf8'));
if (hosting.static.directory !== 'dist') throw Error('Unexpected static directory');
console.log('Game scripts, DOM references, local assets, and project-site URLs validated.');

for (const directory of ['server','scripts']) {
 for (const file of await readdir(directory)) if(file.endsWith('.mjs')) execFileSync(process.execPath,['--check',resolve(directory,file)]);
}
const multiplayer=JSON.parse(await readFile('dist/multiplayer-config.json','utf8'));
if(typeof multiplayer.serverUrl!=='string'||multiplayer.serverUrl&&!multiplayer.serverUrl.startsWith('wss://')) throw Error('Invalid public multiplayer endpoint');
