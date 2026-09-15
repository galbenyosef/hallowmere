import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {lcg,hashString,range} from '../dist/random.js';
import {MAPS,PORTALS} from '../dist/regions.js';

// The inline copies, verbatim, as the six scenery modules spell them.
const imulStep=state=>(Math.imul(state,1664525)+1013904223)>>>0;
const floatStep=state=>(state*1664525+1013904223)>>>0;               // environment.js
const caveHash=id=>[...id].reduce((n,c)=>n*31+c.charCodeAt(0),7)>>>0; // cave-scenery.js
const entranceHash=id=>[...id].reduce((n,c)=>Math.imul(n,31)+c.charCodeAt(0),17)>>>0; // cave-entrance-scenery.js

const seeds=[...new Set([
 4148,                                                    // environment.js
 722,                                                     // expansion-layout.js
 1847,                                                    // outland-scenery.js
 ...Object.keys(MAPS).map(id=>id.length*977),             // region-environment.js
 ...Object.values(MAPS).map(map=>caveHash(map.id)),       // cave-scenery.js
 ...PORTALS.map(portal=>entranceHash(portal.id)),         // cave-entrance-scenery.js
])];

test('environment.js float step and the Math.imul step are the same sequence for every seed in use',()=>{
 assert.ok(seeds.length>=30,`expected the six modules to contribute seeds, got ${seeds.length}`);
 for(const seed of seeds){
  let float=seed,imul=seed;const rand=lcg(seed);
  for(let i=0;i<1e6;i++){
   float=floatStep(float);imul=imulStep(imul);
   assert.equal(float,imul,`seed ${seed} diverged at step ${i}`);
   const value=rand();
   assert.equal(value,imul/4294967296);
   assert.ok(value>=0&&value<1);
  }
 }
 // The identity holds because state*1664525+1013904223 < 2^53 for any uint32 state.
 assert.ok(4294967295*1664525+1013904223<Number.MAX_SAFE_INTEGER);
 let state=123456789;
 for(let i=0;i<200000;i++){
  const seed=imulStep(state);state=seed;
  assert.equal(floatStep(seed),imulStep(seed));
  assert.equal(lcg(seed)(),imulStep(seed)/4294967296);
 }
});

test('lcg reproduces each module seeding and keeps its state private',()=>{
 const rand=lcg(722);                                    // expansion-layout.js
 const first=[rand(),rand(),rand()];
 assert.deepEqual(first,[0.5158808252308518,0.7666853563860059,0.17890638927929103]);
 assert.deepEqual(lcg(722)(),first[0]);
 assert.deepEqual(Object.keys(lcg(1)),[]);
 // region-environment.js derives its seed from the map id length.
 for(const id of Object.keys(MAPS))assert.equal(lcg(id.length*977)(),imulStep(id.length*977)/4294967296);
 // Two generators from the same seed never share state.
 const a=lcg(1847),b=lcg(1847);a();a();
 assert.equal(b(),imulStep(1847)/4294967296);
});

test('hashString reproduces both id hashes bit for bit',()=>{
 const ids=[...Object.keys(MAPS),...PORTALS.map(p=>p.id),'','a','abcdefghijklmnopqrstuvwxyz','moss-hollow-entrance-return'];
 let state=99;const rand=()=>{state=(Math.imul(state,1664525)+1013904223)>>>0;return state/4294967296;};
 for(let i=0;i<500;i++){
  let id='';for(let n=0;n<Math.floor(rand()*24);n++)id+=String.fromCharCode(32+Math.floor(rand()*95));
  ids.push(id);
 }
 ids.push('café-☕-hollow');
 for(const id of ids){
  assert.equal(hashString(id,{seed:7,imul:false}),caveHash(id),`cave-scenery hash for ${JSON.stringify(id)}`);
  assert.equal(hashString(id,{seed:17,imul:true}),entranceHash(id),`cave-entrance hash for ${JSON.stringify(id)}`);
 }
 // The float reduction really does lose precision, and the shared copy loses it identically.
 const long='gravekeepers-hollow-entrance-return';
 assert.notEqual(hashString(long,{seed:7,imul:false}),hashString(long,{seed:7,imul:true}));
 assert.equal(hashString(long,{seed:7,imul:false}),caveHash(long));
 assert.equal(hashString('abc'),[...'abc'].reduce((n,c)=>Math.imul(n,31)+c.charCodeAt(0),0)>>>0);
});

test('range matches the inline a+(b-a)*rand() helper',()=>{
 const shared=lcg(4148),inline=lcg(4148);
 const inlineRange=(a,b)=>a+(b-a)*inline();
 for(const [a,b] of [[-15,15],[.05,.4],[0,1],[-136,81],[3,3],[7,-2]])
  for(let i=0;i<1000;i++)assert.equal(range(shared,a,b),inlineRange(a,b));
});

test('random.js stays import-free and DOM-free for the server module closure',async()=>{
 const source=await readFile(new URL('../dist/random.js',import.meta.url),'utf8');
 assert.equal(/\bimport\b/.test(source),false);
 assert.equal(/\brequire\b/.test(source),false);
 assert.equal(/\bfrom\s*['"]/.test(source),false);
 for(const global of ['document','window','navigator','matchMedia','globalThis','localStorage'])
  assert.equal(new RegExp(`\\b${global}\\b`).test(source),false,`random.js must not mention ${global}`);
 assert.equal(/\bT\./.test(source),false);
});
