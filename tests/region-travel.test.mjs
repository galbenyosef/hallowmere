import test from 'node:test';
import assert from 'node:assert/strict';
import {registerHooks} from 'node:module';
import * as T from '../dist/vendor/three.core.js';
import {installGlobals} from './helpers/dom.mjs';
import {distance} from '../dist/combat.js';
import {regionActionName} from '../dist/region-client-ui.js';
import {$} from '../dist/dom.js';

// dist/region-travel.js imports the relative './vendor/three.core.js' specifier (and, via
// dist/region-environment.js -> dist/treasure-chests.js -> dist/geometry-batch.js, the bare
// 'three/addons/utils/BufferGeometryUtils.js' specifier, which only the page's import map
// resolves); match both in Node the way tests/effects-factory.test.mjs and
// tests/enemy-spawner.test.mjs do.
//
// The Three specifier is routed through a data: module that re-exports three.module.js
// unchanged except for Vector3, subclassed to tick a resettable counter. A module namespace's
// exported bindings are read-only from the importer's side (reassigning three.module.js's own
// Vector3 property silently no-ops), so redirecting the resolution is the only way to observe,
// from this test, how many `new T.Vector3(...)` dist/region-travel.js's renderRegionLabels
// performs internally.
const threeModuleUrl=new URL('../dist/vendor/three.module.js',import.meta.url).href;
const vector3Stats={count:0};
globalThis.__regionTravelVector3Stats=vector3Stats;
const vector3SpyUrl='data:text/javascript,'+encodeURIComponent(
 `import * as Base from ${JSON.stringify(threeModuleUrl)};\n`+
 `export * from ${JSON.stringify(threeModuleUrl)};\n`+
 `export class Vector3 extends Base.Vector3{constructor(...a){super(...a);globalThis.__regionTravelVector3Stats.count++;}}\n`
);
const hook=registerHooks({resolve(specifier,context,nextResolve){
 // dist/region-travel.js and its scenery dependencies now import the relative
 // './vendor/three.core.js' specifier instead of bare 'three' (T2-1); spy on both so the
 // Vector3 allocation count below still reflects what actually runs.
 if(specifier==='three'||specifier==='./vendor/three.core.js')return {url:vector3SpyUrl,shortCircuit:true};
 if(specifier==='three/addons/utils/BufferGeometryUtils.js')return nextResolve(new URL('../dist/vendor/utils/BufferGeometryUtils.js',import.meta.url).href,context);
 if(specifier==='three/addons/loaders/GLTFLoader.js')return nextResolve(new URL('../dist/vendor/loaders/GLTFLoader.js',import.meta.url).href,context);
 return nextResolve(specifier,context);
}});
const {createRegionTravel}=await import('../dist/region-travel.js');
hook.deregister();

// Spies a bare, unimported `Set` the same way dist/region-travel.js and the verbatim
// reference below reference it: as a dynamic global lookup. Overriding globalThis.Set is
// legal (it's a configurable, writable own property) and scoped tightly around each measured
// block, restored in a `finally` before any assertion runs.
function withSetSpy(fn){
 const OriginalSet=globalThis.Set;
 let count=0;
 class SpySet extends OriginalSet{constructor(...args){super(...args);count++;}}
 Object.defineProperty(globalThis,'Set',{configurable:true,writable:true,value:SpySet});
 try{fn();}finally{Object.defineProperty(globalThis,'Set',{configurable:true,writable:true,value:OriginalSet});}
 return count;
}

// Seeded PRNG (mulberry32) so the fuzz run below is deterministic across CI/dev runs.
function mulberry32(seed){
 return function(){
  seed=seed+0x6D2B79F5|0;
  let z=seed;
  z=Math.imul(z^z>>>15,z|1);
  z^=z+Math.imul(z^z>>>7,z|61);
  return ((z^z>>>14)>>>0)/4294967296;
 };
}

// A minimal <button>-like DOM stub: enough for renderRegionLabels' literal
// $('world-labels') append, className/innerHTML/onclick/style assignment, and
// classList.toggle('in-reach', ...).
function stubButton(){
 const classes=new Set();
 return {removed:false,remove(){this.removed=true;},style:{},
  classList:{toggle(name,force){if(force===undefined)force=!classes.has(name);if(force)classes.add(name);else classes.delete(name);return force;},contains:name=>classes.has(name)},
  querySelector(sel){if(sel==='.loot-name')return this._lootName||(this._lootName={textContent:''});return null;}};
}

// ctx.camera as a real three.core.js OrthographicCamera positioned like the game's own camera
// (game-context.js's cameraOffset/cameraTarget), the shim pattern tests/golden-predator-model.
// test.mjs uses to get real projection math without a browser.
function fixture(t){
 const appended=[];
 installGlobals(t,{
  document:{createElement:()=>stubButton(),getElementById:id=>id==='world-labels'?{append:label=>appended.push(label)}:undefined},
  innerWidth:1000,innerHeight:800,
 });
 const camera=new T.OrthographicCamera(-20,20,15,-15,.1,150);
 camera.position.set(17,25,26);camera.lookAt(0,0,0);camera.updateProjectionMatrix();camera.updateMatrixWorld();
 const removed=[];
 const ctx={camera,player:{position:new T.Vector3(0,0,0)},regionLabels:new Map(),
  regionInteractions:()=>[],canReachRegion:()=>true,interact:()=>({ok:true}),awaken(){},toast(){},
  lastSnapshot:null,networkHazards:new Map(),scene:new T.Scene(),removeObject:o=>removed.push(o)};
 const {renderRegionLabels,renderHazards}=createRegionTravel(ctx);
 return {ctx,renderRegionLabels,renderHazards,appended,removed};
}

test('renderRegionLabels creates, positions, and hides labels for reachable and completed records',t=>{
 const {ctx,renderRegionLabels,appended}=fixture(t);
 const near={id:'portal-1',operation:'travel',name:'Ashwick Gate',x:0,z:2,completed:false};
 ctx.regionInteractions=()=>[near];
 renderRegionLabels();
 assert.equal(appended.length,1,'one label element is created and appended to #world-labels');
 const label=appended[0];
 assert.equal(ctx.regionLabels.get('portal-1'),label,'the label is tracked by record id');
 assert.equal(label.className,'world-label npc-label');
 assert.equal(label.textContent,'Enter Ashwick Gate');
 assert.equal(label.hidden,false,'a nearby, on-screen, uncompleted record stays visible');
 assert.match(label.style.left,/px$/);assert.match(label.style.top,/px$/);

 renderRegionLabels();
 assert.equal(appended.length,1,'a second call for the same record reuses the existing label');
 assert.equal(ctx.regionLabels.get('portal-1'),label);

 near.completed=true;
 renderRegionLabels();
 assert.equal(label.hidden,true,'a completed record is hidden regardless of distance/screen position');

 near.completed=false;
 const far={...near,id:'portal-far',x:0,z:11.5};
 ctx.regionInteractions=()=>[near,far];
 renderRegionLabels();
 assert.equal(label.hidden,false);
 assert.equal(appended[1].hidden,true,'a record farther than 11 units from the player is hidden even when on-screen');
});

test('renderRegionLabels builds cache labels with the loot markup and reflects canReachRegion in the in-reach class',t=>{
 const {ctx,renderRegionLabels,appended}=fixture(t);
 const cache={id:'cache-1',operation:'cache',name:"Miner's stash",x:0,z:1,locked:false,completed:false};
 ctx.regionInteractions=()=>[cache];
 ctx.canReachRegion=()=>false;
 renderRegionLabels();
 const label=appended[0];
 assert.equal(label.className,'world-label loot-label common cache-label');
 assert.match(label.innerHTML,/loot-icon/);
 assert.equal(label.querySelector('.loot-name').textContent,'Open '+cache.name);
 assert.equal(label.classList.contains('in-reach'),false);

 ctx.canReachRegion=()=>true;
 renderRegionLabels();
 assert.equal(label.classList.contains('in-reach'),true,'in-reach follows ctx.canReachRegion(r)');
});

test('renderRegionLabels removes labels for records no longer in ctx.regionInteractions()',t=>{
 const {ctx,renderRegionLabels,appended}=fixture(t);
 const record={id:'objective-1',operation:'objective',name:'Wardstone',x:0,z:1,completed:false};
 ctx.regionInteractions=()=>[record];
 renderRegionLabels();
 const label=appended[0];
 assert.equal(ctx.regionLabels.size,1);

 ctx.regionInteractions=()=>[];
 renderRegionLabels();
 assert.equal(label.removed,true,'the stale label is removed from the DOM');
 assert.equal(ctx.regionLabels.size,0,'the stale label is dropped from ctx.regionLabels');
 assert.equal(appended.length,1,'no new label is created once the record disappears');
});

test('renderHazards creates a hazard visual, updates its charge/active material, and removes it by id',t=>{
 const {ctx,renderHazards,removed}=fixture(t);
 ctx.lastSnapshot={time:0,hazards:[{id:'h1',x:1,z:2,w:3,d:4,start:0,activateAt:5}]};
 renderHazards();
 assert.equal(ctx.scene.children.length,1,'one hazard group is added to the scene');
 const visual=ctx.networkHazards.get('h1');
 assert.ok(visual,'the hazard visual is tracked by id');
 assert.equal(visual.position.x,1);assert.equal(visual.position.z,2);
 const fill=visual.children[0];
 assert.equal(fill.material.opacity,.12,'a hazard that just started charging is near its minimum opacity');
 assert.equal(fill.material.color.getHex(),0xe88a46,'a charging hazard keeps the warning color');

 ctx.lastSnapshot={time:5,hazards:[{id:'h1',x:1,z:2,w:3,d:4,start:0,activateAt:5}]};
 renderHazards();
 assert.equal(ctx.networkHazards.get('h1'),visual,'the same visual is reused, not recreated, while it persists');
 assert.equal(fill.material.opacity,.58,'an active hazard opens up to its active opacity');
 assert.equal(fill.material.color.getHex(),0xff4932,'an active hazard turns red');

 ctx.lastSnapshot={time:5,hazards:[]};
 renderHazards();
 assert.equal(ctx.networkHazards.has('h1'),false,'a hazard no longer in the snapshot is dropped from ctx.networkHazards');
 assert.deepEqual(removed,[visual],'ctx.removeObject is called with the stale visual exactly once');
});

test('renderRegionLabels and renderHazards stay pixel/DOM-identical to the original implementation across randomized frames, and allocate no Vector3/Set once warm',t=>{
 installGlobals(t,{
  document:{createElement:()=>stubButton(),getElementById:id=>id==='world-labels'?{append(){}}:undefined},
  innerWidth:1000,innerHeight:800,
 });

 // ---- verbatim reference bodies, copied from `git show main:dist/region-travel.js`. Each is
 // wrapped in a factory that only binds `ctx` (and, for renderRegionLabels, shadows the outer
 // `T` with a Vector3 that ticks its own counter so the allocation-reduction assertions below
 // can measure the reference's per-frame allocation independently of the optimized code's).
 let referenceVector3Count=0;
 class ReferenceVector3 extends T.Vector3{constructor(...args){super(...args);referenceVector3Count++;}}
 function makeReferenceRenderRegionLabels(ctx){
  const T={Vector3:ReferenceVector3};
  return function renderRegionLabels(){
   const records=ctx.regionInteractions(),ids=new Set(records.map(r=>r.id));
   for(const[id,label]of ctx.regionLabels)if(!ids.has(id)){label.remove();ctx.regionLabels.delete(id);}
   for(const r of records){
    const cache=r.operation==='cache';let label=ctx.regionLabels.get(r.id);
    if(!label){
     label=document.createElement('button');label.type='button';label.className=cache?'world-label loot-label common cache-label':'world-label npc-label';
     if(cache)label.innerHTML='<span class="loot-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M3 11V8a5 5 0 0 1 5-5h8a5 5 0 0 1 5 5v3 M3 11h18v9H3Z M7 4v16 M17 4v16 M10 10h4v5h-4Z"/></svg></span><span class="loot-name"></span>';
     label.onclick=()=>{if(ctx.paused||ctx.backgrounded||ctx.state.ended)return;ctx.awaken();const result=ctx.interact(r.id);if(!result.ok)ctx.toast(result.reason);};
     $('world-labels').append(label);ctx.regionLabels.set(r.id,label);
    }
    (cache?label.querySelector('.loot-name'):label).textContent=regionActionName(r);
    if(cache)label.classList.toggle('in-reach',!r.locked&&!r.completed&&ctx.canReachRegion(r));
    const projected=new T.Vector3(r.x,2,r.z).project(ctx.camera);
    label.hidden=r.completed||distance(r,ctx.player.position)>11||projected.z>1||Math.abs(projected.x)>.94||Math.abs(projected.y)>.86;
    label.style.left=`${(projected.x*.5+.5)*innerWidth}px`;label.style.top=`${(-projected.y*.5+.5)*innerHeight}px`;
   }
  };
 }
 function makeReferenceRenderHazards(ctx){
  return function renderHazards(){const hazards=ctx.lastSnapshot?.hazards||[],ids=new Set(hazards.map(h=>h.id));for(const[id,visual]of ctx.networkHazards)if(!ids.has(id)){ctx.removeObject(visual);ctx.networkHazards.delete(id);}for(const h of hazards){let visual=ctx.networkHazards.get(h.id);if(!visual){visual=new T.Group();visual.position.set(h.x,.14,h.z);const geometry=h.radius?new T.CircleGeometry(h.radius,48):new T.PlaneGeometry(h.w,h.d);const fill=new T.Mesh(geometry,new T.MeshBasicMaterial({color:0xe88a46,transparent:true,opacity:.2,side:T.DoubleSide,depthWrite:false}));fill.rotation.x=-Math.PI/2;visual.add(fill);const edge=new T.LineSegments(new T.EdgesGeometry(geometry),new T.LineBasicMaterial({color:0xffbf7a,transparent:true,opacity:.9}));edge.rotation.x=-Math.PI/2;visual.add(edge);visual.rotation.y=h.angle||0;ctx.scene.add(visual);ctx.networkHazards.set(h.id,visual);}const active=ctx.lastSnapshot.time>=h.activateAt;visual.children[0].material.opacity=active?.58:.12+.2*Math.max(0,Math.min(1,(ctx.lastSnapshot.time-h.start)/Math.max(.1,h.activateAt-h.start)));visual.children[0].material.color.set(active?0xff4932:0xe88a46);}};
 }

 // ---- two worlds driven by the same inputs every frame: worldA runs the real (optimized)
 // createRegionTravel(), worldB runs the reference copies above. camera/player/records/
 // hazards are shared by reference between the two calls each frame (neither implementation
 // mutates them), so any state divergence can only come from the label/hazard bookkeeping.
 const rand=mulberry32(0x9E3779B9);
 const randRange=(lo,hi)=>lo+rand()*(hi-lo);
 const camera=new T.OrthographicCamera(-20,20,15,-15,.1,150);
 const player={position:new T.Vector3(0,0,0)};

 function makeWorld(){
  const removed=[];
  return {regionLabels:new Map(),networkHazards:new Map(),scene:new T.Scene(),removed,
   camera,player,canReachRegion:r=>r.reachable,interact:()=>({ok:true}),awaken(){},toast(){},
   removeObject:o=>removed.push(o),
   regionInteractions:()=>frameRecords,
   get lastSnapshot(){return frameHazardSnapshot;}};
 }
 const worldA=makeWorld(),worldB=makeWorld();
 const {renderRegionLabels:optimizedRenderRegionLabels,renderHazards:optimizedRenderHazards}=createRegionTravel(worldA);
 const referenceRenderRegionLabels=makeReferenceRenderRegionLabels(worldB);
 const referenceRenderHazards=makeReferenceRenderHazards(worldB);

 const REGION_POOL=[
  {id:'cache-0',operation:'cache',name:'Stash Alpha',baseX:2,baseZ:3},
  {id:'cache-1',operation:'cache',name:'Stash Beta',baseX:-4,baseZ:6},
  {id:'travel-0',operation:'travel',name:'Ashwick Gate',baseX:5,baseZ:-2},
  {id:'travel-1',operation:'travel',name:'Return to Camp',baseX:-6,baseZ:-5},
  {id:'objective-0',operation:'objective',name:'Wardstone',baseX:1,baseZ:8},
  {id:'objective-1',operation:'objective',name:'Beacon',baseX:-2,baseZ:-8},
  {id:'checkpoint-0',operation:'checkpoint',name:'Old Well',baseX:9,baseZ:0},
 ];
 const HAZARD_POOL=[
  {id:'hz-0',x:2,z:-3,radius:3,start:0,activateAt:6},
  {id:'hz-1',x:-5,z:4,w:4,d:2,angle:.4,start:0,activateAt:9},
  {id:'hz-2',x:6,z:6,radius:1.5,start:0,activateAt:3},
  {id:'hz-3',x:-3,z:-6,w:5,d:5,angle:1.1,start:0,activateAt:12},
 ];

 let frameRecords=[],frameHazardSnapshot=null,frameTime=0;
 function generateFrame({moveCamera=true,forcePresent=false}={}){
  if(moveCamera){
   camera.position.set(randRange(-15,15),randRange(20,30),randRange(-15,15));
   camera.lookAt(randRange(-5,5),0,randRange(-5,5));
   camera.updateProjectionMatrix();camera.updateMatrixWorld();
   player.position.set(randRange(-10,10),0,randRange(-10,10));
   globalThis.innerWidth=Math.round(randRange(600,1600));
   globalThis.innerHeight=Math.round(randRange(500,1200));
  }
  const records=[];
  for(const base of REGION_POOL){
   if(!forcePresent&&rand()<.15)continue;
   const record={id:base.id,operation:base.operation,name:base.name,x:base.baseX+randRange(-6,6),z:base.baseZ+randRange(-6,6),completed:rand()<.2,locked:base.operation==='cache'?rand()<.3:false,reachable:rand()<.7};
   if(base.operation==='objective'){record.active=rand()<.5;record.wave=1+Math.floor(rand()*3);record.waves=3;}
   records.push(record);
  }
  frameRecords=records;
  const hazards=[];
  for(const base of HAZARD_POOL){
   if(!forcePresent&&rand()<.15)continue;
   hazards.push({id:base.id,x:base.x,z:base.z,w:base.w,d:base.d,radius:base.radius,angle:base.angle,start:base.start,activateAt:base.activateAt});
  }
  frameTime+=randRange(.1,1.2);
  frameHazardSnapshot=rand()<.08?null:{time:frameTime,hazards};
  return records.length;
 }

 function assertLabelsMatch(frame){
  assert.equal(worldA.regionLabels.size,worldB.regionLabels.size,`frame ${frame}: label count matches`);
  for(const[id,labelA]of worldA.regionLabels){
   const labelB=worldB.regionLabels.get(id);
   assert.ok(labelB,`frame ${frame} id ${id}: present in reference too`);
   assert.equal(labelA.hidden,labelB.hidden,`frame ${frame} id ${id}: hidden matches`);
   assert.equal(labelA.className,labelB.className,`frame ${frame} id ${id}: className matches`);
   assert.equal(labelA.textContent,labelB.textContent,`frame ${frame} id ${id}: textContent matches`);
   assert.equal(labelA.querySelector('.loot-name')?.textContent,labelB.querySelector('.loot-name')?.textContent,`frame ${frame} id ${id}: loot-name textContent matches`);
   assert.equal(labelA.classList.contains('in-reach'),labelB.classList.contains('in-reach'),`frame ${frame} id ${id}: in-reach class matches`);
   assert.equal(labelA.style.left,labelB.style.left,`frame ${frame} id ${id}: style.left matches`);
   assert.equal(labelA.style.top,labelB.style.top,`frame ${frame} id ${id}: style.top matches`);
  }
 }

 function assertHazardsMatch(frame){
  assert.equal(worldA.networkHazards.size,worldB.networkHazards.size,`frame ${frame}: hazard count matches`);
  for(const[id,visualA]of worldA.networkHazards){
   const visualB=worldB.networkHazards.get(id);
   assert.ok(visualB,`frame ${frame} hazard ${id}: present in reference too`);
   assert.equal(visualA.position.x,visualB.position.x,`frame ${frame} hazard ${id}: position.x matches`);
   assert.equal(visualA.position.y,visualB.position.y,`frame ${frame} hazard ${id}: position.y matches`);
   assert.equal(visualA.position.z,visualB.position.z,`frame ${frame} hazard ${id}: position.z matches`);
   assert.equal(visualA.rotation.y,visualB.rotation.y,`frame ${frame} hazard ${id}: rotation.y matches`);
   const fillA=visualA.children[0],fillB=visualB.children[0];
   assert.equal(fillA.material.opacity,fillB.material.opacity,`frame ${frame} hazard ${id}: material.opacity matches`);
   assert.equal(fillA.material.color.getHex(),fillB.material.color.getHex(),`frame ${frame} hazard ${id}: material.color matches`);
  }
 }

 const FRAMES=520;
 for(let frame=0;frame<FRAMES;frame++){
  generateFrame();
  optimizedRenderRegionLabels();referenceRenderRegionLabels();
  optimizedRenderHazards();referenceRenderHazards();
  assertLabelsMatch(frame);
  assertHazardsMatch(frame);
 }

 // ---- allocation reduction, measured warm over exactly 100 further frames. forcePresent
 // keeps every record/hazard id present throughout (a prime call settles any not already
 // created), so the counted window only exercises the steady-state per-frame path and never
 // creates a fresh label/hazard visual (which would allocate a Set of its own, via the test's
 // stubButton() classList tracking, for reasons unrelated to the optimization under test).
 const WARM_FRAMES=100;
 generateFrame({moveCamera:false,forcePresent:true});
 optimizedRenderRegionLabels();optimizedRenderHazards();
 vector3Stats.count=0;referenceVector3Count=0;
 const optimizedSetCount=withSetSpy(()=>{
  for(let i=0;i<WARM_FRAMES;i++){generateFrame({moveCamera:false,forcePresent:true});optimizedRenderRegionLabels();optimizedRenderHazards();}
 });
 const optimizedVector3Count=vector3Stats.count;
 assert.ok(optimizedVector3Count<=2,`optimized code should not allocate a Vector3 per record/frame once warm (got ${optimizedVector3Count} over ${WARM_FRAMES} frames)`);
 assert.ok(optimizedSetCount<=2,`optimized code should not allocate a Set per frame once warm (got ${optimizedSetCount} over ${WARM_FRAMES} frames)`);

 generateFrame({moveCamera:false,forcePresent:true});
 referenceRenderRegionLabels();referenceRenderHazards();
 vector3Stats.count=0;referenceVector3Count=0;
 const referenceSetCount=withSetSpy(()=>{
  for(let i=0;i<WARM_FRAMES;i++){generateFrame({moveCamera:false,forcePresent:true});referenceRenderRegionLabels();referenceRenderHazards();}
 });
 assert.ok(referenceVector3Count>=200,`reference implementation should allocate roughly one Vector3 per record per frame (got ${referenceVector3Count} over ${WARM_FRAMES} frames)`);
 assert.ok(referenceSetCount>=WARM_FRAMES*2,`reference implementation should allocate a Set per function call per frame (got ${referenceSetCount} over ${WARM_FRAMES} frames x2 functions)`);
});
