import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';
import {dirname,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import * as Core from '../dist/vendor/three.core.js';
import * as Full from '../dist/vendor/three.module.js';

// T2-1: dist/*.js may only reach Three two ways -- bare 'three' (the page's import map
// resolves it to dist/vendor/three.module.js, the full build: renderer, loaders, and every
// three.core.js export re-exported) when a used symbol needs the full build, or the relative
// './vendor/three.core.js' when every used symbol is one three.core.js exports itself -- plus
// any 'three/addons/...' path (loaders/utils, always resolved through the import map). The
// relative './vendor/three.module.js' spelling is never allowed: it duplicates one of the two
// sanctioned spellings while working around the import map, which is exactly the inconsistency
// this task removes.
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const distDir=resolve(root,'dist');
const files=readdirSync(distDir).filter(f=>f.endsWith('.js')).sort();

// Matches a whole Three specifier between quotes -- the trailing \1 backreference to the same
// quote character forces the alternation to consume the entire string, so a partial match
// (e.g. a specifier merely containing "three") can never satisfy this pattern.
const THREE_SPECIFIER=/\bfrom\s*(['"])(three(?:\/addons\/[^'"]*)?|\.\/vendor\/three\.(?:core|module)\.js)\1/g;

function threeSpecifiersIn(source){
 return [...source.matchAll(THREE_SPECIFIER)].map(m=>m[2]);
}

test("every dist/*.js Three specifier is bare 'three', a 'three/addons/...' path, or the relative core build -- never the relative full build",()=>{
 for(const file of files){
  const source=readFileSync(resolve(distDir,file),'utf8');
  for(const spec of threeSpecifiersIn(source)){
   const allowed=spec==='three'||spec==='./vendor/three.core.js'||spec.startsWith('three/addons/');
   assert.ok(allowed,`${file} imports Three as ${JSON.stringify(spec)}; only 'three', './vendor/three.core.js', or a 'three/addons/...' path are allowed (never the relative './vendor/three.module.js')`);
  }
 }
});

test('dist/vendor/three.core.js and dist/vendor/three.module.js resolve to a single Three instance',()=>{
 assert.equal(Core.Vector3,Full.Vector3,'three.core.js and three.module.js disagree on the Vector3 class -- they are no longer the same Three instance');
 assert.equal(Core.REVISION,Full.REVISION,'three.core.js and three.module.js disagree on REVISION -- they are no longer the same Three build');
});

// Guards the other direction from the first test: a module that imports the relative core
// build must never reference a symbol only the full build exports (WebGLRenderer, and so on).
// If one starts to, it silently works today only because both builds share one Three
// instance -- until a later Three upgrade makes that no longer true -- so this fails now,
// mechanically, the same way T2-1's own audit did (grep every `T.<Name>` usage against
// Object.keys(Core)).
test("every module importing './vendor/three.core.js' only references symbols three.core.js exports",()=>{
 const coreExports=new Set(Object.keys(Core));
 for(const file of files){
  const source=readFileSync(resolve(distDir,file),'utf8');
  const nsImport=source.match(/import\s*\*\s*as\s+(\w+)\s+from\s*(['"])\.\/vendor\/three\.core\.js\2/);
  if(!nsImport)continue;
  const alias=nsImport[1];
  const usageRe=new RegExp(`\\b${alias}\\.([A-Za-z_$][A-Za-z0-9_$]*)`,'g');
  const used=new Set([...source.matchAll(usageRe)].map(m=>m[1]));
  for(const symbol of used){
   assert.ok(coreExports.has(symbol),`${file}: ${alias}.${symbol} is not exported by dist/vendor/three.core.js -- this module needs bare 'three' instead`);
  }
 }
});
