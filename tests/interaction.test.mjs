import test from 'node:test';
import assert from 'node:assert/strict';
import {registerHooks} from 'node:module';
import * as T from '../dist/vendor/three.core.js';
import {seededRandom} from '../dist/campaign.js';

// dist/interaction.js imports the bare 'three' specifier, which only the page's import map
// resolves; match it in Node the way tests/effects-factory.test.mjs and
// tests/enemy-spawner.test.mjs do.
const hook=registerHooks({resolve(specifier,context,nextResolve){
 if(specifier==='three')return nextResolve(new URL('../dist/vendor/three.module.js',import.meta.url).href,context);
 return nextResolve(specifier,context);
}});
const {createInteraction}=await import('../dist/interaction.js');
hook.deregister();

function baseCtx(overrides={}){
 return Object.assign({player:{position:{x:0,y:0,z:0}},environment:{obstacles:[],currentBuilding:()=>null},
  pendingRegionInteraction:null,network:{send:()=>true},lastSnapshot:null,state:{}},overrides);
}

// ---------------------------------------------------------------------------
// Reference implementation, copied verbatim from dist/interaction.js on main
// (`git show main:dist/interaction.js`, line 23 -- confirmed byte-identical to
// the pre-memoization regionInteractions() body). Only the head is rewritten
// into a standalone function taking ctx as a parameter instead of closing
// over it, so the body can run detached from createInteraction(). The body
// text below is untouched; do not reformat it. Kept here permanently as the
// parity oracle for the memoized regionInteractions() in dist/interaction.js.
// ---------------------------------------------------------------------------
function referenceRegionInteractions(ctx){return Object.entries(ctx.lastSnapshot?.interactions||{}).flatMap(([group,records])=>records.map(r=>({...r,operation:({portals:'travel',objectives:'objective',checkpoints:'checkpoint',caches:'cache'})[group]}))).filter(r=>r.operation&&(!r.hidden||r.discovered||ctx.state.discoveries?.includes(r.id)));}

test('regionInteractions flattens every group of a snapshot in Object.entries order, tagging each operation',()=>{
 const ctx=baseCtx({lastSnapshot:{interactions:{
  portals:[{id:'p1'},{id:'p2',hidden:true}],
  objectives:[{id:'o1'}],
  checkpoints:[{id:'c1'}],
  caches:[{id:'ca1',hidden:true,discovered:true}],
  unknown:[{id:'u1'}],
 }},state:{discoveries:['p2']}});
 const {regionInteractions}=createInteraction(ctx);
 const result=regionInteractions();
 // portals -> objectives -> checkpoints -> caches, in that source order; the unknown group has
 // no operation mapping and is dropped, and p2 is kept only because it is in ctx.state.discoveries.
 assert.deepEqual(result.map(r=>r.id),['p1','p2','o1','c1','ca1']);
 assert.deepEqual(result.map(r=>r.operation),['travel','travel','objective','checkpoint','cache']);
});

test('regionInteractions drops hidden records unless discovered or already known',()=>{
 const ctx=baseCtx({lastSnapshot:{interactions:{portals:[{id:'p1',hidden:true}]}},state:{discoveries:[]}});
 const {regionInteractions}=createInteraction(ctx);
 assert.deepEqual(regionInteractions(),[]);
 // regionInteractions memoizes on ctx.lastSnapshot identity (snapshots are replaced
 // wholesale on every publish, never mutated in place - see dist/main.js applySnapshot), so
 // this simulates a real snapshot update instead of mutating the prior snapshot in place.
 ctx.lastSnapshot={interactions:{portals:[{id:'p1',hidden:true,discovered:true}]}};
 assert.deepEqual(regionInteractions().map(r=>r.id),['p1']);
});

test('regionInteractions returns an empty list without a snapshot',()=>{
 const ctx=baseCtx();
 const {regionInteractions}=createInteraction(ctx);
 assert.deepEqual(regionInteractions(),[]);
});

test('canReachRegion honours distance, line of sight, and the current building',()=>{
 const ctx=baseCtx({player:{position:{x:0,y:0,z:0}}});
 const {canReachRegion}=createInteraction(ctx);
 assert.equal(canReachRegion({x:1,z:0}),true,'within the default 2.8 radius with a clear obstacle list');
 assert.equal(canReachRegion({x:10,z:0}),false,'too far away');
 assert.equal(canReachRegion({x:10,z:0},20),true,'a wider explicit radius reaches the same point');

 ctx.environment.obstacles=[{x:.5,z:0,w:2,d:2}];
 assert.equal(canReachRegion({x:1,z:0}),false,'a wall between the player and the record blocks line of sight');

 ctx.environment.obstacles=[];
 ctx.environment.currentBuilding=()=>({id:'chapel'});
 assert.equal(canReachRegion({x:1,z:0,buildingId:'chapel'}),true,'reachable when standing inside the required building');
 assert.equal(canReachRegion({x:1,z:0,buildingId:'smithy'}),false,'unreachable while inside a different building');
});

test('interactRegion reports the locked or completed reason without touching movement or network',()=>{
 const ctx=baseCtx();
 const {interactRegion}=createInteraction(ctx);
 ctx.setDestination=()=>assert.fail('A locked record must never request movement');
 ctx.releaseInput=()=>assert.fail('A locked record must never release input');

 assert.deepEqual(interactRegion({locked:true,operation:'travel',name:'Gate'}),
  {ok:false,reason:'This passage is sealed. Continue the region’s objectives.'});
 assert.deepEqual(interactRegion({locked:true,operation:'objective',name:'Wave'}),
  {ok:false,reason:'Defeat the nearby guardians first.'});
 assert.deepEqual(interactRegion({locked:true,reason:'Custom reason',name:'Gate'}),{ok:false,reason:'Custom reason'});
 assert.deepEqual(interactRegion({completed:true,name:'Gate'}),{ok:false,reason:'Already completed.'});
});

test('interactRegion approaches an out-of-reach record by calling ctx.setDestination',()=>{
 const calls=[];
 const ctx=baseCtx();
 const {interactRegion}=createInteraction(ctx);
 ctx.setDestination=point=>{calls.push(['setDestination',point.x,point.z]);return true;};
 ctx.releaseInput=()=>calls.push(['releaseInput']);
 const record={id:'portal-9',operation:'travel',name:'Ashwick Gate',x:5,z:6};
 const result=interactRegion(record);
 assert.deepEqual(result,{ok:true,approaching:'Ashwick Gate'});
 assert.equal(ctx.pendingRegionInteraction,'portal-9');
 assert.deepEqual(calls,[['setDestination',5,6]],'only setDestination runs; the record is not yet interacted with');
});

test('interactRegion reports a blocked path when setDestination itself fails',()=>{
 const ctx=baseCtx();
 const {interactRegion}=createInteraction(ctx);
 ctx.setDestination=()=>false;
 ctx.releaseInput=()=>assert.fail('An unreachable, unwalkable record must never release input');
 ctx.pendingRegionInteraction='earlier-id';
 const result=interactRegion({id:'portal-9',operation:'travel',name:'Ashwick Gate',x:5,z:6});
 assert.deepEqual(result,{ok:false,reason:'That path is blocked.'});
 assert.equal(ctx.pendingRegionInteraction,'earlier-id','a failed approach leaves any earlier pending interaction untouched');
});

test('interactRegion performs the travel/checkpoint operation once the record is in reach',()=>{
 const sent=[];
 const ctx=baseCtx({player:{position:{x:5,y:0,z:6}}});
 const {interactRegion}=createInteraction(ctx);
 ctx.network.send=(type,payload)=>{sent.push([type,payload]);return true;};
 ctx.releaseInput=()=>sent.push(['releaseInput']);
 ctx.pendingRegionInteraction='stale';
 const result=interactRegion({id:'checkpoint-1',operation:'checkpoint',name:'Waystone',x:5,z:6});
 assert.deepEqual(result,{ok:true,pending:true});
 assert.equal(ctx.pendingRegionInteraction,null);
 assert.deepEqual(sent,[['releaseInput'],['checkpoint',{id:'checkpoint-1'}]],'releaseInput runs before the network request, in that order');
});

test('interactRegion surfaces a failed network send as ok:false',()=>{
 const ctx=baseCtx({player:{position:{x:5,y:0,z:6}}});
 const {interactRegion}=createInteraction(ctx);
 ctx.network.send=()=>false;
 ctx.releaseInput=()=>{};
 const result=interactRegion({id:'checkpoint-1',operation:'checkpoint',name:'Waystone',x:5,z:6});
 assert.deepEqual(result,{ok:false,pending:true});
});

test('regionInteractions returns the identical array instance while its key is unchanged, across 100 calls',()=>{
 const ctx=baseCtx({lastSnapshot:{interactions:{
  portals:[{id:'p1',x:1,z:2,name:'Gate'}],
  objectives:[{id:'o1',x:3,z:4}],
 }},state:{discoveries:['d1']}});
 const {regionInteractions}=createInteraction(ctx);
 const first=regionInteractions();
 assert.deepEqual(first,referenceRegionInteractions(ctx));
 for(let i=0;i<100;i++){
  const result=regionInteractions();
  assert.equal(result,first,`call ${i}: expected the same array instance while the key is unchanged`);
  assert.deepEqual(result,referenceRegionInteractions(ctx));
 }
});

test('regionInteractions rebuilds a fresh array, matching a reference rebuild, whenever any key component changes',()=>{
 const ctx=baseCtx({lastSnapshot:{interactions:{portals:[{id:'p1',x:1,z:2,name:'Gate'}]}},state:{discoveries:['d1']}});
 const {regionInteractions}=createInteraction(ctx);
 let previous=regionInteractions();
 assert.deepEqual(previous,referenceRegionInteractions(ctx));

 // ctx.lastSnapshot.interactions replaced without replacing ctx.lastSnapshot itself.
 ctx.lastSnapshot.interactions={portals:[{id:'p1',x:1,z:2,name:'Gate'},{id:'p2',x:9,z:9,name:'Second Gate'}]};
 let next=regionInteractions();
 assert.notEqual(next,previous,'replacing ctx.lastSnapshot.interactions must invalidate the cache even if ctx.lastSnapshot itself is unchanged');
 assert.deepEqual(next,referenceRegionInteractions(ctx));
 previous=next;

 // A new ctx.lastSnapshot object with equal content still invalidates the cache: identity, not
 // deep equality, is the change signal (real publishes always hand over a brand-new object - see
 // dist/local-session.js publish() and dist/main.js applySnapshot's `ctx.lastSnapshot=snapshot`).
 ctx.lastSnapshot={interactions:{portals:[{id:'p1',x:1,z:2,name:'Gate'},{id:'p2',x:9,z:9,name:'Second Gate'}]}};
 next=regionInteractions();
 assert.notEqual(next,previous,'a new lastSnapshot object must invalidate the cache even with equal content');
 assert.deepEqual(next,referenceRegionInteractions(ctx));
 previous=next;

 // ctx.state.discoveries appended to in place (the only real-world mutation - see
 // region-campaign.js's world.shared.discoveries.push(portal.id)): identity is unchanged, so the
 // cache relies on the length component of the key to notice this.
 ctx.state.discoveries.push('d2');
 next=regionInteractions();
 assert.notEqual(next,previous,'appending to discoveries must invalidate the cache (length changed)');
 assert.deepEqual(next,referenceRegionInteractions(ctx));
 previous=next;

 // ctx.state.discoveries replaced outright with equal content/length (the other real-world case -
 // Object.assign(ctx.state,...,snapshot.state) in dist/main.js's applySnapshot hands over a
 // freshly detached array every publish).
 ctx.state.discoveries=['d1','d2'];
 next=regionInteractions();
 assert.notEqual(next,previous,'replacing discoveries must invalidate the cache even with equal content/length');
 assert.deepEqual(next,referenceRegionInteractions(ctx));
 previous=next;

 // ctx.state replaced outright.
 ctx.state={discoveries:['d1','d2']};
 next=regionInteractions();
 assert.notEqual(next,previous,'replacing ctx.state must invalidate the cache');
 assert.deepEqual(next,referenceRegionInteractions(ctx));
});

test('regionInteractions matches the pre-memoization reference across 600 seeded randomized scenarios mixing repeated calls with changes',()=>{
 const rand=seededRandom(0xFEEDC0DE);
 const groups=['portals','objectives','checkpoints','caches','unknown'];
 let nextId=0;
 function randomRecord(){
  const record={id:`r${nextId++}`,x:Math.floor(rand()*40)-20,z:Math.floor(rand()*40)-20};
  if(rand()<.4)record.hidden=true;
  if(rand()<.3)record.discovered=true;
  if(rand()<.2)record.locked=true;
  if(rand()<.2)record.completed=true;
  return record;
 }
 function randomInteractions(){
  const interactions={};
  for(const group of groups){
   if(rand()<.2)continue; // some scenarios omit a group entirely
   const count=Math.floor(rand()*4); // 0-3 records per group, including the empty-array edge case
   interactions[group]=[];
   for(let i=0;i<count;i++)interactions[group].push(randomRecord());
  }
  return interactions;
 }
 function randomDiscoveries(){
  const count=Math.floor(rand()*3),discoveries=[];
  for(let i=0;i<count;i++)discoveries.push(`r${Math.floor(rand()*Math.max(1,nextId))}`);
  return discoveries;
 }

 const ctx=baseCtx({lastSnapshot:null,state:{discoveries:[]}});
 const {regionInteractions}=createInteraction(ctx);

 for(let i=0;i<600;i++){
  const action=rand();
  if(action<.15){
   // repeated call: leave ctx untouched, exercising the memoized cache-hit path.
  }else if(action<.25){
   ctx.lastSnapshot=null; // the no-snapshot edge case
  }else if(action<.35){
   ctx.lastSnapshot={interactions:{}}; // the empty-interactions edge case
  }else if(action<.55){
   ctx.lastSnapshot={interactions:randomInteractions()}; // a wholesale snapshot replacement
  }else if(action<.7){
   if(Array.isArray(ctx.state.discoveries))ctx.state.discoveries.push(`r${Math.floor(rand()*Math.max(1,nextId))}`); // an in-place append
  }else if(action<.85){
   ctx.state.discoveries=randomDiscoveries(); // a wholesale discoveries replacement
  }else{
   ctx.state=rand()<.5?{discoveries:ctx.state.discoveries}:{}; // a wholesale ctx.state replacement, sometimes dropping discoveries entirely
  }
  const memoized=regionInteractions();
  const reference=referenceRegionInteractions(ctx);
  assert.deepEqual(memoized,reference,`scenario ${i} (action ${action.toFixed(3)}) diverged from the reference`);
 }
});

test('regionInteractions results and records stay frozen through every consumer that touches them',()=>{
 const ctx=baseCtx({player:{position:{x:0,y:0,z:0}},
  lastSnapshot:{interactions:{portals:[{id:'p1',x:0,z:0,name:'Gate'}]}},
  state:{discoveries:[]}});
 const sent=[];
 ctx.setDestination=()=>assert.fail('a record within reach must never request movement');
 ctx.releaseInput=()=>sent.push('releaseInput');
 ctx.network.send=(type,payload)=>{sent.push(['send',type,payload]);return true;};
 const {regionInteractions,nearbyInteraction,canReachRegion,interactRegion,interact}=createInteraction(ctx);

 const result=regionInteractions();
 Object.freeze(result);
 for(const record of result)Object.freeze(record);

 // Every real consumer only reads record fields -- id/x/z/name/operation/locked/completed/
 // buildingId/reason (confirmed by grep across dist/pointer-targeting.js, dist/region-travel.js,
 // dist/main.js, and this closure) -- none assigns to a record property or sorts/splices the
 // array itself, so freezing must never make any of them throw a TypeError.
 assert.doesNotThrow(()=>canReachRegion(result[0]));
 assert.deepEqual(nearbyInteraction(),{regional:result[0]});
 assert.deepEqual(interactRegion(result[0]),{ok:true,pending:true});
 assert.deepEqual(sent,['releaseInput',['send','travel',{id:'p1'}]]);
 sent.length=0;
 assert.deepEqual(interact('p1'),{ok:true,pending:true});
 assert.deepEqual(sent,['releaseInput',['send','travel',{id:'p1'}]]);

 // Still the exact same frozen instance: the memo never rebuilt it despite every read above.
 assert.equal(regionInteractions(),result);
 assert.ok(Object.isFrozen(result)&&Object.isFrozen(result[0]));
});
