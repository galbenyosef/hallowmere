// M10 moved renderSharedWorld out of dist/main.js into dist/shared-world-render.js verbatim.
// It is the per-frame sync of everything the server owns -- class-effect actors, enemy models
// and bars, projectile visuals, zone visuals -- so the tests drive whole frames and check that
// visuals are created, updated and removed by id, and that nothing is recreated on a second
// frame. createEnemyOrb arrives through the factory's deps hatch because the hostile-bolt
// branch would otherwise build a real three subtree.
import test from 'node:test';
import assert from 'node:assert/strict';
import {registerHooks} from 'node:module';
import * as T from '../dist/vendor/three.core.js';
import {angleLerp} from '../dist/multiplayer-protocol.js';
import {distance} from '../dist/combat.js';

// dist/shared-world-render.js imports the relative './vendor/three.core.js' specifier. A module
// namespace's exported bindings are read-only from the importer's side (reassigning
// three.core.js's own Vector3 property silently no-ops), so redirecting the resolution -- the
// same technique tests/region-travel.test.mjs uses -- is the only way to observe, from this
// test, how many `new T.Vector3(...)` renderSharedWorld performs internally. Every test in this
// file sources createSharedWorldRender through this one hooked import so the allocation counts
// measured below reflect what actually runs (importing the same URL a second time, un-hooked,
// would just return the already-evaluated module).
const threeCoreUrl=new URL('../dist/vendor/three.core.js',import.meta.url).href;
const vector3Stats={count:0};
globalThis.__sharedWorldRenderVector3Stats=vector3Stats;
const vector3SpyUrl='data:text/javascript,'+encodeURIComponent(
 `import * as Base from ${JSON.stringify(threeCoreUrl)};\n`+
 `export * from ${JSON.stringify(threeCoreUrl)};\n`+
 `export class Vector3 extends Base.Vector3{constructor(...a){super(...a);globalThis.__sharedWorldRenderVector3Stats.count++;}}\n`
);
const hook=registerHooks({resolve(specifier,context,nextResolve){
 if(specifier==='./vendor/three.core.js')return {url:vector3SpyUrl,shortCircuit:true};
 return nextResolve(specifier,context);
}});
const {createSharedWorldRender}=await import('../dist/shared-world-render.js');
hook.deregister();

const vec=(x=0,y=0,z=0)=>({x,y,z,
 set(a,b,c){this.x=a;this.y=b;this.z=c;return this;},
 copy(v){this.x=v.x;this.y=v.y;this.z=v.z;return this;},
 add(v){this.x+=v.x;this.y+=v.y;this.z+=v.z;return this;}});

// A live enemy as applySnapshot leaves one: a net payload from the server plus the client-side
// model, bar and visuals dist/enemy-spawner.js builds.
function makeEnemy(overrides={}){
 const e={id:'e1',type:'hollow',seed:.25,hp:10,maxHp:10,barHealth:10,dead:false,rig:{},data:{windup:.8},
  net:{x:4,z:6,angle:1,moving:true,phase:'idle',timer:0},
  model:{position:vec(0,0,0),rotation:vec(0,0,0),visible:true},
  bar:{position:vec(),visible:false},
  visuals:{updates:[],update(...args){this.updates.push(args);}}};
 return Object.assign(e,overrides);
}

function makeCtx(overrides={}){
 const calls=[],rec=name=>(...args)=>{calls.push([name,...args]);};
 const ctx={
  calls,renderedMap:'overworld',reducedMotion:false,
  network:{id:'local'},player:{position:vec(0,0,0)},
  multiplayerView:{actors:new Map([['remote',{model:{name:'remote'}}]])},
  renderHazards:rec('renderHazards'),
  classEffects:{
   syncActors:rec('syncActors'),
   projectile:data=>({mesh:{position:vec(data.x,1.1,data.z)},kind:'class',update:rec('classBolt.update')}),
   zone:data=>({id:data.id,updates:[],disposed:0,update(...args){this.updates.push(args);},dispose(){this.disposed++;}})
  },
  combatEffects:{
   emberbolt:pos=>({mesh:{position:vec(pos.x,pos.y,pos.z)},kind:'ember',update:rec('emberbolt.update')}),
   arcaneBolt:pos=>({mesh:{position:vec(pos.x,pos.y,pos.z)},kind:'arcane',update:rec('arcaneBolt.update')})
  },
  scene:{name:'scene'},overworldEnvironment:{glowTexture:{name:'glow'}},
  enemies:[],networkProjectiles:new Map(),networkZones:new Map(),
  removeObject:rec('removeObject'),updateEnemyBar:rec('updateEnemyBar'),animateRig:rec('animateRig'),
  enemyModelType:type=>type,mouseTargeting:{selected:null},
  selection:{position:vec()},playerLight:{position:vec()},
  lastSnapshot:null
 };
 return Object.assign(ctx,overrides);
}
const named=(ctx,name)=>ctx.calls.filter(call=>call[0]===name);
// The orb factory the hostile branch reaches for, stubbed so the test can drive a plain scene.
function orbStub(){
 const made=[];
 return [made,(scene,texture,position,angle,color,options)=>{
  made.push({scene,texture,position:{x:position.x,y:position.y,z:position.z},angle,color,options});
  return {mesh:{position:vec(position.x,position.y,position.z)},kind:'orb',update(){}};
 }];
}
const wire=(overrides={},createEnemyOrb)=>{
 const ctx=makeCtx(overrides);
 return [ctx,createSharedWorldRender(ctx,createEnemyOrb?{createEnemyOrb}:{}).renderSharedWorld];
};

test('every frame hands the class effects the snapshot players and a resolver that finds their models',()=>{
 const players=[{id:'local'},{id:'remote'}];
 const [ctx,renderSharedWorld]=wire({lastSnapshot:{players,projectiles:[],zones:[],time:9}});
 renderSharedWorld(.016,3);
 assert.equal(named(ctx,'renderHazards').length,1);
 const [,seen,resolve,mapId]=named(ctx,'syncActors')[0];
 assert.equal(seen,players);assert.equal(mapId,'overworld');
 assert.equal(resolve('local'),ctx.player);
 assert.equal(resolve('remote'),ctx.multiplayerView.actors.get('remote').model);
 assert.equal(resolve('ghost'),undefined);
 const [empty,renderEmpty]=wire();
 renderEmpty(.016,3);
 assert.deepEqual(named(empty,'syncActors')[0][1],[]);
});

test('a live enemy eases toward its server position, animates, and carries its bar',()=>{
 const enemy=makeEnemy({barHealth:10,hp:6});
 const [ctx,renderSharedWorld]=wire({enemies:[enemy],lastSnapshot:{players:[],projectiles:[],zones:[],time:0}});
 renderSharedWorld(.05,2);
 assert.ok(enemy.model.position.x>0&&enemy.model.position.x<4,'eased toward the server x, not snapped');
 assert.ok(enemy.model.position.z>0&&enemy.model.position.z<6);
 assert.ok(enemy.model.rotation.y>0&&enemy.model.rotation.y<1);
 assert.ok(enemy.barHealth<10&&enemy.barHealth>=6,'the bar drains toward the real hp');
 assert.equal(named(ctx,'updateEnemyBar').length,1);
 const [,rig,t,moving,windup,modelType]=named(ctx,'animateRig')[0];
 assert.equal(rig,enemy.rig);assert.equal(t,2);assert.equal(moving,true);assert.equal(windup,0);assert.equal(modelType,'hollow');
 assert.deepEqual(enemy.visuals.updates[0],[enemy.net,.05,2.25]);
 assert.equal(enemy.bar.position.y,2.25);
 assert.equal(enemy.bar.visible,true);
 enemy.model.position.x=99;enemy.model.position.z=99;enemy.net.x=99;enemy.net.z=99;
 renderSharedWorld(.05,2.05);
 assert.equal(enemy.bar.visible,false,'a distant enemy hides its bar');
});

test('a dead enemy falls, hides its bar, and stops animating',()=>{
 const enemy=makeEnemy({dead:true});
 const [ctx,renderSharedWorld]=wire({enemies:[enemy],lastSnapshot:{players:[],projectiles:[],zones:[],time:0}});
 for(let i=0;i<40;i++)renderSharedWorld(.05,i*.05);
 assert.equal(named(ctx,'animateRig').length,0);
 assert.equal(named(ctx,'updateEnemyBar').length,0);
 assert.equal(enemy.bar.visible,false);
 assert.ok(enemy.model.rotation.z>1.4,'it rotates onto its back');
 assert.equal(enemy.model.position.y,-1,'it sinks no further than -1');
 assert.equal(enemy.model.visible,false);
 assert.equal(enemy.visuals.updates[0][2],0,'a dead enemy gets the raw frame time, not t+seed');
});

test('a telegraphed windup fades its ring with the remaining wind-up time',()=>{
 const telegraph={children:[{material:{opacity:0}}]};
 const enemy=makeEnemy({telegraph,net:{x:0,z:0,angle:0,moving:false,phase:'windup',timer:.4}});
 const [,renderSharedWorld]=wire({enemies:[enemy],lastSnapshot:{players:[],projectiles:[],zones:[],time:0}});
 renderSharedWorld(.016,1);
 assert.equal(Math.round(telegraph.children[0].material.opacity*1000)/1000,.21);
 enemy.net.timer=0;
 renderSharedWorld(.016,1);
 assert.equal(Math.round(telegraph.children[0].material.opacity*1000)/1000,.34);
});

test('projectiles are created once per id, eased every frame, and removed with the snapshot',()=>{
 const [made,createEnemyOrb]=orbStub();
 const projectiles=[
  {id:'p-ember',x:1,z:2,angle:0,speed:12},
  {id:'p-arcane',x:3,z:4,angle:0,speed:14,visual:'arcane'},
  {id:'p-class',x:5,z:6,angle:0,speed:10,visual:'venom'},
  {id:'p-orb',x:7,z:8,angle:1.2,hostile:true,color:'#8edb65'}
 ];
 const stale={mesh:{name:'stale-mesh'}};
 const [ctx,renderSharedWorld]=wire({lastSnapshot:{players:[],projectiles,zones:[],time:0}},createEnemyOrb);
 ctx.networkProjectiles.set('p-gone',stale);
 renderSharedWorld(.05,1);
 assert.deepEqual(named(ctx,'removeObject')[0][1],stale.mesh,'a projectile the snapshot dropped is removed by id');
 assert.equal(ctx.networkProjectiles.has('p-gone'),false);
 assert.deepEqual([...ctx.networkProjectiles.keys()],['p-ember','p-arcane','p-class','p-orb']);
 assert.deepEqual([...ctx.networkProjectiles.values()].map(v=>v.visual.kind),['ember','arcane','class','orb']);
 assert.equal(made.length,1);
 assert.equal(made[0].scene,ctx.scene);assert.equal(made[0].texture,ctx.overworldEnvironment.glowTexture);
 assert.deepEqual(made[0].position,{x:7,y:.8,z:8});
 assert.equal(made[0].angle,1.2);assert.equal(made[0].color,'#8edb65');
 assert.deepEqual(made[0].options,{reducedMotion:false});
 const ember=ctx.networkProjectiles.get('p-ember');
 assert.equal(ember.mesh.position.y,1.1,'a friendly bolt spawns at chest height');
 projectiles[0].x=9;
 const before=ember.mesh.position.x;
 renderSharedWorld(.05,1.05);
 assert.equal(made.length,1,'a second frame reuses every visual');
 assert.ok(ember.mesh.position.x>before&&ember.mesh.position.x<9,'it eases toward the new server x');
 const disposed=[];
 for(const [id,visual] of ctx.networkProjectiles)visual.visual.dispose=()=>disposed.push(id);
 ctx.lastSnapshot.projectiles=[];
 renderSharedWorld(.05,1.1);
 assert.deepEqual(disposed.sort(),['p-arcane','p-class','p-ember','p-orb']);
 assert.equal(ctx.networkProjectiles.size,0);
});

test('zones are created once per id, updated with the snapshot time, and disposed when they end',()=>{
 const zones=[{id:'z1',x:1,z:2},{id:'z2',x:3,z:4}];
 const [ctx,renderSharedWorld]=wire({lastSnapshot:{players:[],projectiles:[],zones,time:7.5}});
 renderSharedWorld(.05,1);
 assert.deepEqual([...ctx.networkZones.keys()],['z1','z2']);
 const first=ctx.networkZones.get('z1');
 assert.deepEqual(first.updates,[[zones[0],7.5,.05]]);
 ctx.lastSnapshot.zones=[zones[0]];ctx.lastSnapshot.time=8;
 renderSharedWorld(.05,1.05);
 assert.equal(ctx.networkZones.get('z1'),first,'the surviving zone keeps its visual');
 assert.deepEqual(first.updates.at(-1),[zones[0],8,.05]);
 assert.equal(ctx.networkZones.has('z2'),false);
 assert.equal(ctx.networkZones.size,1);
});

test('the selection ring and the player light follow the hero every frame',()=>{
 const [ctx,renderSharedWorld]=wire();
 ctx.player.position.set(3,0,-4);
 renderSharedWorld(.016,1);
 assert.deepEqual([ctx.selection.position.x,ctx.selection.position.y,ctx.selection.position.z],[3,.1,-4]);
 assert.deepEqual([ctx.playerLight.position.x,ctx.playerLight.position.y,ctx.playerLight.position.z],[3,2.7,-4]);
});

// ---- P6d: parity + allocation proof for the module-scope scratch Vector3 (enemy bar offset,
// reused for the player-light offset since it has the identical copy().add(new Vector3) shape)
// and the two reusable Sets (projectile/zone id tracking) in renderSharedWorld(), plus the
// once-per-enemy ctx.enemyModelType(e.type) call. Same technique as
// tests/region-travel.test.mjs: dist/shared-world-render.js's relative './vendor/three.core.js'
// import is a module namespace, whose exported bindings are read-only from the importer's side,
// so redirecting the resolution is the only way to observe `new T.Vector3(...)` from here. Every
// test above sources createSharedWorldRender through this one hooked import so the allocation
// counts below reflect what actually runs (a second, un-hooked static import of the same URL
// would just return the already-evaluated module).

// Seeded PRNG (mulberry32), duplicated from tests/region-travel.test.mjs for this file's own
// determinism, independent of any other test file.
function mulberry32(seed){
 return function(){
  seed=seed+0x6D2B79F5|0;
  let z=seed;
  z=Math.imul(z^z>>>15,z|1);
  z^=z+Math.imul(z^z>>>7,z|61);
  return ((z^z>>>14)>>>0)/4294967296;
 };
}

// Spies a bare, unimported `Set` the same way dist/shared-world-render.js and the verbatim
// reference below reference it: as a dynamic global lookup. Overriding globalThis.Set is legal
// (it's a configurable, writable own property) and scoped tightly around each measured block,
// restored in a `finally` before any assertion runs.
function withSetSpy(fn){
 const OriginalSet=globalThis.Set;
 let count=0;
 class SpySet extends OriginalSet{constructor(...args){super(...args);count++;}}
 Object.defineProperty(globalThis,'Set',{configurable:true,writable:true,value:SpySet});
 try{fn();}finally{Object.defineProperty(globalThis,'Set',{configurable:true,writable:true,value:OriginalSet});}
 return count;
}

test('renderSharedWorld stays state-identical to the original implementation across randomized frames, and allocates no Vector3/Set once warm',()=>{
 // ---- verbatim reference body, copied from
 // `git show codex/snapshot-network-render-1fe3ccc2-bc3e:dist/shared-world-render.js` (the base
 // this worktree is stacked on; dist/shared-world-render.js is not on main yet). Wrapped in a
 // factory that only binds ctx/createEnemyOrb and shadows the outer T with a Vector3 that ticks
 // its own counter, so the allocation-reduction assertions below can measure the reference's
 // per-frame allocation independently of the optimized code's.
 let referenceVector3Count=0;
 class ReferenceVector3 extends T.Vector3{constructor(...args){super(...args);referenceVector3Count++;}}
 const realMathUtils=T.MathUtils;
 function makeReferenceRenderSharedWorld(ctx,{createEnemyOrb}){
  const T={MathUtils:realMathUtils,Vector3:ReferenceVector3};
  function renderSharedWorld(dt,t){ctx.renderHazards();ctx.classEffects.syncActors(ctx.lastSnapshot?.players||[],id=>id===ctx.network?.id?ctx.player:ctx.multiplayerView?.actors.get(id)?.model,ctx.renderedMap);
   for(const e of ctx.enemies){const n=e.net;if(!n)continue;const blend=1-Math.exp(-dt*14);e.model.position.x=T.MathUtils.lerp(e.model.position.x,n.x,blend);e.model.position.z=T.MathUtils.lerp(e.model.position.z,n.z,blend);e.model.rotation.y=angleLerp(e.model.rotation.y,n.angle,blend);
    if(e.dead){e.visuals.update(n,dt,t);e.model.rotation.z=T.MathUtils.lerp(e.model.rotation.z,1.45,dt*7);e.model.position.y=Math.max(-1,e.model.position.y-dt*.5);e.model.visible=e.model.position.y>-.9;e.bar.visible=false;continue;}
    if(e.barHealth>e.hp){e.barHealth=Math.max(e.hp,e.barHealth-dt*e.maxHp*1.6);ctx.updateEnemyBar(e);}ctx.animateRig(e.rig,t,n.moving,n.phase==='windup'?1-n.timer/e.data.windup:0,ctx.enemyModelType(e.type));e.visuals.update(n,dt,t+e.seed);e.bar.position.copy(e.model.position).add(new T.Vector3(0,(ctx.enemyModelType(e.type)==='boss'?4.8:ctx.enemyModelType(e.type)==='hound'?1.5:ctx.enemyModelType(e.type)==='hollow'?2.25:3.25)*(e.data.scale||1),0));e.bar.visible=e===ctx.mouseTargeting?.selected||distance(ctx.player.position,e.model.position)<12;
    if(e.telegraph){e.telegraph.children[0].material.opacity=.08+(1-n.timer/e.data.windup)*.26;}
   }
   const ids=new Set(ctx.lastSnapshot?.projectiles.map(b=>b.id)||[]);
   for(const [id,b] of ctx.networkProjectiles)if(!ids.has(id)){b.visual?b.visual.dispose():ctx.removeObject(b.mesh);ctx.networkProjectiles.delete(id);}
   for(const b of ctx.lastSnapshot?.projectiles||[]){let visual=ctx.networkProjectiles.get(b.id);if(!visual){
    const pos=new T.Vector3(b.x,b.hostile?.8:1.1,b.z),dir=new T.Vector3(Math.sin(b.angle),0,Math.cos(b.angle));
    if(!b.hostile){
     const bolt=b.visual==='arcane'?ctx.combatEffects.arcaneBolt(pos,dir,b.speed):b.visual&&b.visual!=='ember'?ctx.classEffects.projectile(b):ctx.combatEffects.emberbolt(pos,dir);
     visual={mesh:bolt.mesh,visual:bolt};
    }else{const bolt=createEnemyOrb(ctx.scene,ctx.overworldEnvironment.glowTexture,pos,b.angle,b.color||'#ff714b',{reducedMotion:ctx.reducedMotion});visual={mesh:bolt.mesh,visual:bolt};}
    ctx.networkProjectiles.set(b.id,visual);
   }
    const blend=1-Math.exp(-dt*20);visual.mesh.position.x=T.MathUtils.lerp(visual.mesh.position.x,b.x,blend);visual.mesh.position.z=T.MathUtils.lerp(visual.mesh.position.z,b.z,blend);visual.visual?.update(dt);
   }
   const zoneIds=new Set(ctx.lastSnapshot?.zones?.map(z=>z.id)||[]);
   for(const [id,visual] of ctx.networkZones)if(!zoneIds.has(id)){visual.dispose();ctx.networkZones.delete(id);}
   for(const data of ctx.lastSnapshot?.zones||[]){let visual=ctx.networkZones.get(data.id);if(!visual){visual=ctx.classEffects.zone(data);ctx.networkZones.set(data.id,visual);}visual.update(data,ctx.lastSnapshot.time,dt);}
   ctx.selection.position.set(ctx.player.position.x,.1,ctx.player.position.z);ctx.playerLight.position.copy(ctx.player.position).add(new T.Vector3(0,2.7,0));
  }
  return renderSharedWorld;
 }

 // ---- two worlds driven by the same inputs every frame: worldA runs the real (optimized)
 // createSharedWorldRender(), worldB runs the reference copy above. player/lastSnapshot are
 // shared by reference between the two (neither implementation mutates them), so any state
 // divergence can only come from the enemy/bar/projectile/zone bookkeeping each world owns.
 const rand=mulberry32(0xC0FFEE01);
 const randRange=(lo,hi)=>lo+rand()*(hi-lo);

 const player={position:vec(0,0,0)};

 function makeBoltStub(prefix){
  return (...args)=>{
   const pos=args[0];
   return {mesh:{position:vec(pos.x,pos.y,pos.z)},dispose(){this.disposed=true;},update(){}};
  };
 }
 function makeOrbStub(){
  return (scene,texture,position,angle,color,options)=>({mesh:{position:vec(position.x,position.y,position.z)},dispose(){this.disposed=true;},update(){}});
 }

 function makeWorld(){
  const calls=[];
  const ctx={
   calls,renderedMap:'overworld',reducedMotion:false,
   network:{id:'local'},player,
   multiplayerView:{actors:new Map()},
   renderHazards:()=>{calls.push(['renderHazards']);},
   classEffects:{
    syncActors:(...args)=>{calls.push(['syncActors',args[0],args[2]]);},
    projectile:data=>({mesh:{position:vec(data.x,1.1,data.z)},dispose(){this.disposed=true;},update(){}}),
    zone:data=>({id:data.id,dispose(){this.disposed=true;},update(...args){this.lastArgs=args;}})
   },
   combatEffects:{emberbolt:makeBoltStub('ember'),arcaneBolt:makeBoltStub('arcane')},
   scene:{name:'scene'},overworldEnvironment:{glowTexture:{name:'glow'}},
   enemies:[],networkProjectiles:new Map(),networkZones:new Map(),
   removeObject:mesh=>{calls.push(['removeObject',mesh.id]);},
   updateEnemyBar:e=>{calls.push(['updateEnemyBar',e.id]);},
   animateRig:(rig,t,moving,windup,modelType)=>{calls.push(['animateRig',rig.id,moving,windup,modelType]);},
   enemyModelType:type=>type,mouseTargeting:{selected:null},
   selection:{position:vec()},playerLight:{position:vec()},
   lastSnapshot:null
  };
  return ctx;
 }

 // Six enemies exercising every modelType bar-height branch (boss/hound/hollow/else), the
 // telegraph branch (present on some, absent on others), a permanent dead transition, a
 // hp-reaches-zero-while-alive case, and a net-goes-missing (early `continue`) edge case.
 const ENEMY_SPECS=[
  {id:'e-boss',type:'boss',windup:.6,scale:undefined,telegraph:true,diesAt:null,netGoesNullAt:null},
  {id:'e-hound',type:'hound',windup:.5,scale:undefined,telegraph:false,diesAt:150,netGoesNullAt:null},
  {id:'e-hollow-a',type:'hollow',windup:.7,scale:1.2,telegraph:true,diesAt:null,netGoesNullAt:null},
  {id:'e-grunt',type:'grunt',windup:.55,scale:1.4,telegraph:false,diesAt:350,netGoesNullAt:null},
  {id:'e-grunt2',type:'grunt2',windup:.65,scale:undefined,telegraph:true,diesAt:null,netGoesNullAt:300},
  {id:'e-hollow-b',type:'hollow',windup:.6,scale:undefined,telegraph:false,diesAt:null,netGoesNullAt:null}
 ];

 function makeEnemyInstance(spec){
  return {
   id:spec.id,type:spec.type,seed:randRange(0,6.28),
   hp:100,maxHp:100,barHealth:100,dead:false,
   data:{windup:spec.windup,scale:spec.scale},
   rig:{id:spec.id},
   net:{x:randRange(-10,10),z:randRange(-10,10),angle:randRange(-3,3),moving:true,phase:'idle',timer:0},
   model:{position:vec(0,0,0),rotation:vec(0,0,0),visible:true},
   bar:{position:vec(),visible:false},
   telegraph:spec.telegraph?{children:[{material:{opacity:0}}]}:null,
   visuals:{update(...args){this.lastArgs=args;}}
  };
 }

 const worldA=makeWorld(),worldB=makeWorld();
 const [ctxA,ctxB]=[worldA,worldB];
 const enemiesA=ENEMY_SPECS.map(makeEnemyInstance);
 const enemiesB=ENEMY_SPECS.map(makeEnemyInstance);
 // enemiesA/enemiesB start from independently-seeded-but-identical construction order; copy A's
 // random seeds onto B so both worlds begin from bit-identical state.
 for(let i=0;i<ENEMY_SPECS.length;i++){enemiesB[i].seed=enemiesA[i].seed;enemiesB[i].net={...enemiesA[i].net};}
 ctxA.enemies=enemiesA;ctxB.enemies=enemiesB;

 const optimizedRenderSharedWorld=createSharedWorldRender(ctxA,{createEnemyOrb:makeOrbStub()}).renderSharedWorld;
 const referenceRenderSharedWorld=makeReferenceRenderSharedWorld(ctxB,{createEnemyOrb:makeOrbStub()});

 const PROJECTILE_POOL=[
  {id:'proj-ember',baseX:1,baseZ:2},
  {id:'proj-arcane',baseX:3,baseZ:-4,visual:'arcane'},
  {id:'proj-class',baseX:-5,baseZ:6,visual:'venom'},
  {id:'proj-orb',baseX:7,baseZ:8,hostile:true,color:'#8edb65'},
  {id:'proj-orb2',baseX:-3,baseZ:-2,hostile:true}
 ];
 const ZONE_POOL=[{id:'zone-a'},{id:'zone-b'},{id:'zone-c'}];

 let frameTime=0;
 function generateFrame({forcePresent=false}={}){
  const dt=randRange(.008,.09),t=(frameTime+=randRange(.01,.2));
  const netUpdates={};
  for(const spec of ENEMY_SPECS){
   netUpdates[spec.id]={
    x:randRange(-10,10),z:randRange(-10,10),angle:randRange(-3,3),
    moving:rand()<.7,phase:rand()<.25?'windup':'idle',timer:randRange(0,1)
   };
  }
  const hpUpdates={};
  for(const spec of ENEMY_SPECS)if(rand()<.4)hpUpdates[spec.id]=rand()<.12?0:Math.round(randRange(0,100));
  const projectiles=[];
  for(const base of PROJECTILE_POOL){
   if(!forcePresent&&rand()<.15)continue;
   projectiles.push({id:base.id,x:base.baseX+randRange(-2,2),z:base.baseZ+randRange(-2,2),angle:randRange(-3,3),speed:8+randRange(0,6),hostile:base.hostile||false,visual:base.visual,color:base.color});
  }
  const zones=[];
  for(const base of ZONE_POOL){
   if(!forcePresent&&rand()<.15)continue;
   zones.push({id:base.id});
  }
  const snapshot=(!forcePresent&&rand()<.08)?null:{players:[],projectiles,zones,time:frameTime};
  return {dt,t,netUpdates,hpUpdates,snapshot};
 }

 // Applies one generated frame's inputs identically to a world's own enemies/ctx.lastSnapshot,
 // driving alive/dead transitions and the net-goes-missing edge case at fixed frame numbers so
 // both worlds hit them at the exact same point.
 function applyFrame(ctx,enemies,frame,frameIndex){
  for(let i=0;i<ENEMY_SPECS.length;i++){
   const spec=ENEMY_SPECS[i],e=enemies[i];
   if(spec.diesAt!=null&&frameIndex===spec.diesAt)e.dead=true;
   if(spec.netGoesNullAt!=null&&frameIndex===spec.netGoesNullAt)e.net=null;
   if(e.net&&!e.dead){
    const u=frame.netUpdates[spec.id];e.net.x=u.x;e.net.z=u.z;e.net.angle=u.angle;e.net.moving=u.moving;e.net.phase=u.phase;e.net.timer=u.timer;
    if(frame.hpUpdates[spec.id]!==undefined)e.hp=frame.hpUpdates[spec.id];
   }
  }
  ctx.lastSnapshot=frame.snapshot;
  ctx.mouseTargeting.selected=frameIndex%7===0?enemies[frameIndex%enemies.length]:null;
 }

 function assertWorldsMatch(frame){
  assert.deepEqual(ctxA.calls,ctxB.calls,`frame ${frame}: ctx call list matches`);
  for(let i=0;i<ENEMY_SPECS.length;i++){
   const a=enemiesA[i],b=enemiesB[i],id=ENEMY_SPECS[i].id;
   assert.equal(a.model.position.x,b.model.position.x,`frame ${frame} ${id}: model.position.x`);
   assert.equal(a.model.position.y,b.model.position.y,`frame ${frame} ${id}: model.position.y`);
   assert.equal(a.model.position.z,b.model.position.z,`frame ${frame} ${id}: model.position.z`);
   assert.equal(a.model.rotation.y,b.model.rotation.y,`frame ${frame} ${id}: model.rotation.y`);
   assert.equal(a.model.rotation.z,b.model.rotation.z,`frame ${frame} ${id}: model.rotation.z`);
   assert.equal(a.model.visible,b.model.visible,`frame ${frame} ${id}: model.visible`);
   assert.equal(a.bar.position.x,b.bar.position.x,`frame ${frame} ${id}: bar.position.x`);
   assert.equal(a.bar.position.y,b.bar.position.y,`frame ${frame} ${id}: bar.position.y`);
   assert.equal(a.bar.position.z,b.bar.position.z,`frame ${frame} ${id}: bar.position.z`);
   assert.equal(a.bar.visible,b.bar.visible,`frame ${frame} ${id}: bar.visible`);
   assert.equal(a.barHealth,b.barHealth,`frame ${frame} ${id}: barHealth`);
   assert.equal(a.dead,b.dead,`frame ${frame} ${id}: dead`);
   if(a.telegraph||b.telegraph){
    assert.equal(a.telegraph.children[0].material.opacity,b.telegraph.children[0].material.opacity,`frame ${frame} ${id}: telegraph opacity`);
   }
  }
  assert.deepEqual([...ctxA.networkProjectiles.keys()].sort(),[...ctxB.networkProjectiles.keys()].sort(),`frame ${frame}: projectile ids match`);
  for(const [id,visA] of ctxA.networkProjectiles){
   const visB=ctxB.networkProjectiles.get(id);
   assert.ok(visB,`frame ${frame} projectile ${id}: present in reference too`);
   assert.equal(visA.mesh.position.x,visB.mesh.position.x,`frame ${frame} projectile ${id}: mesh.position.x`);
   assert.equal(visA.mesh.position.z,visB.mesh.position.z,`frame ${frame} projectile ${id}: mesh.position.z`);
  }
  assert.deepEqual([...ctxA.networkZones.keys()].sort(),[...ctxB.networkZones.keys()].sort(),`frame ${frame}: zone ids match`);
 }

 const FRAMES=520;
 for(let frame=0;frame<FRAMES;frame++){
  const genFrame=generateFrame();
  applyFrame(ctxA,enemiesA,genFrame,frame);applyFrame(ctxB,enemiesB,genFrame,frame);
  ctxA.calls.length=0;ctxB.calls.length=0;
  optimizedRenderSharedWorld(genFrame.dt,genFrame.t);
  referenceRenderSharedWorld(genFrame.dt,genFrame.t);
  assertWorldsMatch(frame);
 }

 // ---- allocation reduction, measured warm over exactly 100 further frames. forcePresent keeps
 // every projectile/zone id present throughout (a priming call settles any not already created),
 // so the counted window only exercises the steady-state per-frame path and never creates a
 // fresh projectile/zone visual (which would allocate its own Vector3/Set for reasons unrelated
 // to the optimization under test).
 const WARM_FRAMES=100;
 let primeFrame=generateFrame({forcePresent:true});
 applyFrame(ctxA,enemiesA,primeFrame,FRAMES);
 ctxA.calls.length=0;
 optimizedRenderSharedWorld(primeFrame.dt,primeFrame.t);
 vector3Stats.count=0;referenceVector3Count=0;
 const optimizedSetCount=withSetSpy(()=>{
  for(let i=0;i<WARM_FRAMES;i++){
   const f=generateFrame({forcePresent:true});
   applyFrame(ctxA,enemiesA,f,FRAMES+1+i);
   ctxA.calls.length=0;
   optimizedRenderSharedWorld(f.dt,f.t);
  }
 });
 const optimizedVector3Count=vector3Stats.count;
 assert.ok(optimizedVector3Count===0,`optimized code should allocate 0 Vector3s once warm (got ${optimizedVector3Count} over ${WARM_FRAMES} frames)`);
 assert.ok(optimizedSetCount===0,`optimized code should allocate 0 Sets once warm (got ${optimizedSetCount} over ${WARM_FRAMES} frames)`);

 primeFrame=generateFrame({forcePresent:true});
 applyFrame(ctxB,enemiesB,primeFrame,FRAMES);
 ctxB.calls.length=0;
 referenceRenderSharedWorld(primeFrame.dt,primeFrame.t);
 vector3Stats.count=0;referenceVector3Count=0;
 const referenceSetCount=withSetSpy(()=>{
  for(let i=0;i<WARM_FRAMES;i++){
   const f=generateFrame({forcePresent:true});
   applyFrame(ctxB,enemiesB,f,FRAMES+1+i);
   ctxB.calls.length=0;
   referenceRenderSharedWorld(f.dt,f.t);
  }
 });
 assert.ok(referenceVector3Count>=WARM_FRAMES*2,`reference implementation should allocate at least 2 Vector3s per frame -- bar offset + player light (got ${referenceVector3Count} over ${WARM_FRAMES} frames)`);
 assert.ok(referenceSetCount>=WARM_FRAMES*2,`reference implementation should allocate a Set per snapshot list per frame (got ${referenceSetCount} over ${WARM_FRAMES} frames x2 lists)`);
});
