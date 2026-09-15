import test from 'node:test';
import assert from 'node:assert/strict';
import {registerHooks} from 'node:module';
import * as T from '../dist/vendor/three.core.js';
import {installGlobals} from './helpers/dom.mjs';

// dist/region-travel.js imports the bare 'three' specifier, which only the page's import map
// resolves; match it in Node the way tests/effects-factory.test.mjs and
// tests/enemy-spawner.test.mjs do.
const hook=registerHooks({resolve(specifier,context,nextResolve){
 if(specifier==='three')return nextResolve(new URL('../dist/vendor/three.module.js',import.meta.url).href,context);
 if(specifier==='three/addons/utils/BufferGeometryUtils.js')return nextResolve(new URL('../dist/vendor/utils/BufferGeometryUtils.js',import.meta.url).href,context);
 if(specifier==='three/addons/loaders/GLTFLoader.js')return nextResolve(new URL('../dist/vendor/loaders/GLTFLoader.js',import.meta.url).href,context);
 return nextResolve(specifier,context);
}});
const {createRegionTravel}=await import('../dist/region-travel.js');
hook.deregister();

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
