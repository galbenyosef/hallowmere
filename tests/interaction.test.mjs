import test from 'node:test';
import assert from 'node:assert/strict';
import {registerHooks} from 'node:module';
import * as T from '../dist/vendor/three.core.js';

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
 ctx.lastSnapshot.interactions.portals[0].discovered=true;
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
