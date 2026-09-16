import test from 'node:test';
import assert from 'node:assert/strict';
import {registerHooks} from 'node:module';
import * as T from '../dist/vendor/three.core.js';
import {START,zoneAt,zoneName} from '../dist/campaign.js';
import {distance} from '../dist/combat.js';

const SPAWN_ZONE=zoneAt(START);

// P6a: dist/render-loop.js's frame() now keeps one module-scope scratch Vector3 for the camera
// target instead of allocating two Vector3 per frame, and memoizes ctx.safeHere() once per
// frame (lazily, since a frame can go without needing it at all) instead of calling it inside
// the per-enemy predicate. The allocation test below needs to observe `new T.Vector3(...)`
// calls made from *inside* dist/render-loop.js's own module scope -- its own `T` binding, not
// this file's -- so, exactly like tests/region-travel.test.mjs, a resolve hook substitutes a
// counting Vector3 subclass for the './vendor/three.core.js' specifier as resolved from inside
// dist/render-loop.js, for the one import below that produces the `createRenderLoop` this whole
// file (every test, not only the allocation one) drives frame() through. A counting subclass
// behaves identically to the real Vector3 for every other assertion in this file; it just also
// ticks a counter.
const threeModuleUrl=new URL('../dist/vendor/three.module.js',import.meta.url).href;
const vector3Stats={count:0};
globalThis.__renderLoopVector3Stats=vector3Stats;
const vector3SpyUrl='data:text/javascript,'+encodeURIComponent(
 `import * as Base from ${JSON.stringify(threeModuleUrl)};\n`+
 `export * from ${JSON.stringify(threeModuleUrl)};\n`+
 `export class Vector3 extends Base.Vector3{constructor(...a){super(...a);globalThis.__renderLoopVector3Stats.count++;}}\n`
);
const hook=registerHooks({resolve(specifier,context,nextResolve){
 if(specifier==='three'||specifier==='./vendor/three.core.js')return {url:vector3SpyUrl,shortCircuit:true};
 return nextResolve(specifier,context);
}});
const {createRenderLoop}=await import('../dist/render-loop.js');
hook.deregister();

// M11 moved main.js's frame() -- the callback the renderer drives through setAnimationLoop --
// into dist/render-loop.js. Its three branches are what a stalled page depends on: `frozen`
// (paused, roster picker open, backgrounded, or no transport) skips the simulation step but
// still renders and pins the network input to zero, `backgrounded` additionally skips the whole
// shared-world/effects/environment pass, and the camera + renderer tail runs on every frame
// regardless. Drive a recording ctx through each and pin the call order.

function makeCtx(overrides={}){
 const calls=[];
 const record=(name,fn)=>(...args)=>{calls.push(name);return fn?.(...args);};
 const ctx={
  calls,ready:true,paused:false,backgrounded:false,sessionMode:'single-player',
  clock:{getDelta:()=>.02},rosterPicker:{open:false},
  network:{connected:true,input:null,advance:record('network.advance')},
  movementCorrection:{update:record('movementCorrection.update')},
  player:{position:new T.Vector3(START.x,0,START.z)},cameraTarget:new T.Vector3(0,0,0),cameraOffset:new T.Vector3(17,25,26),
  camera:new T.PerspectiveCamera(),scene:{},renderer:{render:record('renderer.render')},
  environment:{obstacles:[],update:record('environment.update')},
  worldBounds:()=>({minX:-40,maxX:40,minZ:-40,maxZ:40}),
  accumulated:0,audioTimer:.09,uiTimer:1,shake:0,angle:.25,keys:new Set(),enemies:[],
  gameSettings:{cameraShake:true},renderedMap:'overworld',pendingRegionInteraction:null,
  state:{ended:false,zone:SPAWN_ZONE,visited:[SPAWN_ZONE],cooldowns:{bolt:.4}},
  landmarks:{update:record('landmarks.update')},worldPreview:null,multiplayerView:{update:record('multiplayerView.update')},
  moonLight:{position:{set(){}},target:{position:{set(){}},updateMatrixWorld(){}}},
  life:{update:record('life.update'),renderLabels:record('life.renderLabels')},
  resourceOrbs:{update:record('resourceOrbs.update')},
  updatePlayer:record('updatePlayer'),regionInteractions:record('regionInteractions',()=>[]),
  canReachRegion:record('canReachRegion',()=>true),interactRegion:record('interactRegion'),
  toast:record('toast'),updateAudioWorld:record('updateAudioWorld'),
  renderSharedWorld:record('renderSharedWorld'),renderRegionLabels:record('renderRegionLabels'),
  updateEffects:record('updateEffects'),updateMouseTarget:record('updateMouseTarget'),
  updateFloaters:record('updateFloaters'),updateUI:record('updateUI'),drawMap:record('drawMap'),
  safeHere:()=>true
 };
 return Object.assign(ctx,overrides);
}

const TAIL=['updateMouseTarget','life.renderLabels','updateFloaters','updateUI','drawMap','multiplayerView.update','renderer.render','resourceOrbs.update'];

test('a running frame steps the simulation, renders the shared world, and ends with the camera and renderer tail',()=>{
 const ctx=makeCtx();
 createRenderLoop(ctx).frame();
 assert.deepEqual(ctx.calls,[
  'network.advance','movementCorrection.update','updatePlayer','life.update','updateAudioWorld',
  'renderSharedWorld','renderRegionLabels','updateEffects','environment.update','landmarks.update',
  ...TAIL]);
 assert.ok(ctx.accumulated>0,'a running frame advances the accumulator');
 assert.equal(ctx.state.cooldowns.bolt,.38,'cooldowns tick down by dt');
 assert.equal(ctx.network.input,null,'a running frame leaves the network input alone');
 assert.equal(ctx.audioTimer,0,'the audio world update resets its own timer');
});

test('frame returns before touching the clock while ctx.ready is false',()=>{
 let delta=0;
 const ctx=makeCtx({ready:false,clock:{getDelta(){delta++;return .02;}}});
 createRenderLoop(ctx).frame();
 assert.deepEqual(ctx.calls,[]);
 assert.equal(delta,0);
});

test('a frozen frame skips the simulation, zeroes the network input, and still renders',()=>{
 const ctx=makeCtx({paused:true});
 createRenderLoop(ctx).frame();
 assert.deepEqual(ctx.calls,[
  'network.advance','renderSharedWorld','renderRegionLabels','updateEffects','environment.update','landmarks.update',
  ...TAIL]);
 assert.deepEqual(ctx.network.input,{x:0,z:0,angle:.25});
 assert.ok(ctx.accumulated>0,'the frozen branch still advances the accumulator for the render pass');
 assert.equal(ctx.state.cooldowns.bolt,.4,'a frozen frame does not tick cooldowns');
});

test('an open roster picker and a dropped transport freeze the frame the same way a pause does',()=>{
 for(const frozen of [{rosterPicker:{open:true}},{network:{connected:false,input:null,advance(){}}}]){
  const ctx=makeCtx(frozen);
  createRenderLoop(ctx).frame();
  assert.ok(!ctx.calls.includes('updatePlayer'),'the simulation step is skipped');
  assert.ok(ctx.calls.includes('renderer.render'),'the frame still renders');
 }
});

test('a backgrounded frame skips the shared-world pass, floats nothing, and still runs the camera and renderer tail',()=>{
 const ctx=makeCtx({backgrounded:true});
 const floaterArgs=[];
 ctx.updateFloaters=dt=>{ctx.calls.push('updateFloaters');floaterArgs.push(dt);};
 createRenderLoop(ctx).frame();
 assert.deepEqual(ctx.calls,['network.advance',...TAIL]);
 assert.deepEqual(floaterArgs,[0],'floaters are frozen while backgrounded');
 assert.deepEqual(ctx.network.input,{x:0,z:0,angle:.25});
});

test('crossing into a new zone records the visit and toasts once',()=>{
 const toasts=[];
 const ctx=makeCtx({state:{ended:false,zone:'nowhere',visited:[],cooldowns:{}}});
 ctx.toast=message=>{ctx.calls.push('toast');toasts.push(message);};
 createRenderLoop(ctx).frame();
 assert.equal(ctx.state.zone,SPAWN_ZONE);
 assert.deepEqual(ctx.state.visited,[SPAWN_ZONE]);
 assert.equal(toasts.length,1);
});

test('a pending region interaction is resolved inside the simulation step and cleared when it disappears',()=>{
 const reached=makeCtx({pendingRegionInteraction:'cave-1'});
 reached.regionInteractions=()=>{reached.calls.push('regionInteractions');return [{id:'cave-1'}];};
 createRenderLoop(reached).frame();
 assert.deepEqual(reached.calls.slice(0,6),['network.advance','movementCorrection.update','updatePlayer','life.update','regionInteractions','canReachRegion']);
 assert.ok(reached.calls.includes('interactRegion'));

 const gone=makeCtx({pendingRegionInteraction:'cave-1'});
 createRenderLoop(gone).frame();
 assert.equal(gone.pendingRegionInteraction,null);
 assert.ok(!gone.calls.includes('canReachRegion'));
});

// ---- P6a proof: a verbatim reference copy of frame(), plus a fuzz parity test, a safeHere
// call-count test, and a Vector3 allocation test.

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

// Structural snapshot for comparing recorded call arguments: numbers/strings/booleans/null
// pass through, Vector3-likes reduce to their {x,y,z}, arrays/plain-object literals recurse,
// and anything else (camera, scene, ...) reduces to a constructor-name tag -- enough to catch a
// wrong dt, a wrong boolean, or a wrong vector without choking on THREE's internal object
// graphs (matrices, parent/children, ...).
function snap(value){
 if(value===null||typeof value!=='object')return value;
 if(Array.isArray(value))return value.map(snap);
 if(typeof value.x==='number'&&typeof value.y==='number'&&typeof value.z==='number')return{x:value.x,y:value.y,z:value.z};
 if(value.constructor===Object){
  const out={};
  for(const k of Object.keys(value))out[k]=snap(value[k]);
  return out;
 }
 return `[${value.constructor?.name||typeof value}]`;
}

function makeRecorder(){
 const calls=[];
 const record=(name,impl)=>(...args)=>{calls.push([name,args.map(snap)]);return impl?.(...args);};
 return {calls,record};
}

// Runs `fn` with the global Math.random replaced by a fresh seeded generator, restoring the
// original afterward. frame()'s camera-shake jitter block (untouched by P6a) reads the global
// Math.random directly; driving the reference and the optimized frame() through the *same*
// seed for the same logical frame is the only way to keep that block's output comparable
// between two sequential frame() calls that both consume the shared global generator.
function withStubRandom(seed,fn){
 const original=Math.random;
 Math.random=mulberry32(seed);
 try{fn();}finally{Math.random=original;}
}

// Verbatim reference, copied from `git show codex/composition-root-4ef4b2d0-87cd:dist/render-loop.js`
// -- dist/render-loop.js's body immediately before P6a (M11's commit; dist/render-loop.js is
// not yet on main). Reformatted onto multiple lines for readability; not one statement added,
// removed, or reordered -- still one `.clone().add(new T.Vector3(...))` per frame for the
// camera target, and still a fresh `ctx.safeHere()` call inside the per-enemy predicate.
function createReferenceRenderLoop(ctx){
 function frame(){
  if(!ctx.ready)return;
  const raw=ctx.clock.getDelta(),dt=Math.min(raw,.035),frozen=ctx.paused||ctx.rosterPicker?.open||ctx.backgrounded||!ctx.network?.connected;
  ctx.network?.advance?.(raw,frozen);
  if(ctx.network?.connected&&!ctx.backgrounded&&(ctx.sessionMode==='multiplayer'||!frozen))ctx.movementCorrection.update(ctx.player.position,dt,ctx.environment.obstacles,ctx.worldBounds());
  if(!frozen){
   ctx.accumulated+=dt;
   for(const k in ctx.state.cooldowns)ctx.state.cooldowns[k]=Math.max(0,ctx.state.cooldowns[k]-dt);
   ctx.updatePlayer(dt,ctx.accumulated);
   if(!ctx.state.ended){
    ctx.life.update(ctx.accumulated);
    if(ctx.pendingRegionInteraction){
     const interaction=ctx.regionInteractions().find(r=>r.id===ctx.pendingRegionInteraction);
     if(!interaction)ctx.pendingRegionInteraction=null;
     else if(ctx.canReachRegion(interaction,2.7))ctx.interactRegion(interaction);
    }
   }
   const zone=ctx.renderedMap==='overworld'?zoneAt(ctx.player.position):ctx.renderedMap;
   if(zone!==ctx.state.zone){
    ctx.state.zone=zone;
    if(!ctx.state.visited.includes(zone))ctx.state.visited.push(zone);
    ctx.toast(zoneName(zone)+(zone==='ashwick'?' · Sanctuary':''));
   }
   ctx.audioTimer+=dt;
   if(ctx.audioTimer>=.1){ctx.updateAudioWorld(ctx.audioTimer);ctx.audioTimer=0;}
  }
  if(frozen&&ctx.network)ctx.network.input={x:0,z:0,angle:ctx.angle};
  if(!ctx.backgrounded){
   if(frozen)ctx.accumulated+=dt;
   ctx.renderSharedWorld(dt,ctx.accumulated);
   ctx.renderRegionLabels();
   ctx.updateEffects(dt);
   ctx.environment.update(ctx.accumulated,dt,ctx.state.victory,ctx.camera,ctx.player.position);
   if(ctx.renderedMap==='overworld')ctx.landmarks?.update?.(ctx.accumulated);
  }
  const desired=ctx.player.position.clone().add(new T.Vector3(0,0,-3.4));
  ctx.cameraTarget.lerp(desired,1-Math.exp(-dt*4));
  ctx.camera.position.copy(ctx.cameraTarget).add(ctx.cameraOffset);
  ctx.shake=Math.max(0,ctx.shake-dt*.35);
  if(ctx.shake>0&&!frozen&&ctx.gameSettings.cameraShake){
   ctx.camera.position.x+=(Math.random()-.5)*ctx.shake;
   ctx.camera.position.z+=(Math.random()-.5)*ctx.shake;
  }
  ctx.camera.lookAt(ctx.cameraTarget);
  ctx.worldPreview?.update(ctx.camera);
  ctx.moonLight.position.set(ctx.player.position.x-16,29,ctx.player.position.z+9);
  ctx.moonLight.target.position.set(ctx.player.position.x,0,ctx.player.position.z);
  ctx.moonLight.target.updateMatrixWorld();
  ctx.updateMouseTarget();
  ctx.life.renderLabels(ctx.enemies.some(e=>!e.dead&&distance(e.model.position,ctx.player.position)<8&&!ctx.safeHere()),ctx.keys.has('alt'));
  ctx.updateFloaters(ctx.backgrounded?0:dt);
  ctx.uiTimer+=dt;
  if(ctx.uiTimer>.09){ctx.uiTimer=0;ctx.updateUI();ctx.drawMap();}
  ctx.multiplayerView?.update(dt,ctx.accumulated);
  ctx.renderer.render(ctx.scene,ctx.camera);
  ctx.resourceOrbs.update(frozen?0:dt,ctx.state.hp/ctx.state.maxHp,ctx.state.mana/ctx.state.maxMana);
 }
 return {frame};
}

test('frame() stays parity-identical to the pre-P6a reference across 750 randomized frames: camera.position, cameraTarget, shake, accumulated, uiTimer/audioTimer, and the ordered ctx call list (with arguments) all match after every single frame',()=>{
 const rand=mulberry32(0xC0FFEE);
 const randRange=(lo,hi)=>lo+rand()*(hi-lo);
 const FRAMES=750;
 const shared={dt:.016,safe:true};
 const safeCalls={ref:0,opt:0};

 function build(record,tag){
  return {
   ready:true,paused:false,backgrounded:false,sessionMode:'single-player',
   clock:{getDelta:()=>shared.dt},
   rosterPicker:{open:false},
   network:{connected:true,input:null,advance:record('network.advance')},
   movementCorrection:{update:record('movementCorrection.update')},
   player:{position:new T.Vector3(START.x,0,START.z)},
   cameraTarget:new T.Vector3(0,0,0),cameraOffset:new T.Vector3(17,25,26),
   camera:new T.PerspectiveCamera(),scene:{},renderer:{render:record('renderer.render')},
   environment:{obstacles:[],update:record('environment.update')},
   worldBounds:()=>({minX:-40,maxX:40,minZ:-40,maxZ:40}),
   accumulated:0,audioTimer:0,uiTimer:0,shake:0,angle:.25,keys:new Set(),
   enemies:[],
   gameSettings:{cameraShake:true},renderedMap:'overworld',pendingRegionInteraction:null,
   state:{ended:false,zone:SPAWN_ZONE,visited:[SPAWN_ZONE],cooldowns:{bolt:.4,heal:1.2},hp:60,maxHp:100,mana:30,maxMana:50},
   landmarks:{update:record('landmarks.update')},worldPreview:null,
   multiplayerView:{update:record('multiplayerView.update')},
   moonLight:{position:{set(){}},target:{position:{set(){}},updateMatrixWorld(){}}},
   life:{update:record('life.update'),renderLabels:record('life.renderLabels')},
   resourceOrbs:{update:record('resourceOrbs.update')},
   updatePlayer:record('updatePlayer'),regionInteractions:record('regionInteractions',()=>[]),
   canReachRegion:record('canReachRegion',()=>true),interactRegion:record('interactRegion'),
   toast:record('toast'),updateAudioWorld:record('updateAudioWorld'),
   renderSharedWorld:record('renderSharedWorld'),renderRegionLabels:record('renderRegionLabels'),
   updateEffects:record('updateEffects'),updateMouseTarget:record('updateMouseTarget'),
   updateFloaters:record('updateFloaters'),updateUI:record('updateUI'),drawMap:record('drawMap'),
   safeHere:()=>{safeCalls[tag]++;return shared.safe;},
  };
 }

 const refRecorder=makeRecorder(),optRecorder=makeRecorder();
 const refCtx=build(refRecorder.record,'ref'),optCtx=build(optRecorder.record,'opt');
 const refLoop=createReferenceRenderLoop(refCtx),optLoop=createRenderLoop(optCtx);

 for(let frame=0;frame<FRAMES;frame++){
  // ---- randomized per-frame inputs, applied identically to both ctx objects ----
  shared.dt=randRange(0,.05); // occasionally exceeds the .035 clamp
  shared.safe=rand()<.5;
  const paused=rand()<.15,rosterOpen=rand()<.1,backgrounded=rand()<.1,connected=rand()>.08;
  const shakeBump=rand()<.25?randRange(0,1.4):0;
  const cameraShakeOn=rand()<.7;
  const altOn=rand()<.3;
  const px=randRange(-90,40),pz=randRange(-40,40);
  const enemySpecs=Array.from({length:Math.floor(randRange(0,6))},()=>({
   dead:rand()<.3,x:px+randRange(-12,12),z:pz+randRange(-12,12),
  }));

  for(const ctx of [refCtx,optCtx]){
   ctx.paused=paused;ctx.rosterPicker.open=rosterOpen;ctx.backgrounded=backgrounded;ctx.network.connected=connected;
   ctx.shake+=shakeBump;ctx.gameSettings.cameraShake=cameraShakeOn;
   ctx.player.position.set(px,0,pz);
   ctx.keys=new Set(altOn?['alt']:[]);
   ctx.enemies=enemySpecs.map(s=>({dead:s.dead,model:{position:{x:s.x,z:s.z}}}));
  }
  refRecorder.calls.length=0;optRecorder.calls.length=0;

  const frameSeed=(rand()*4294967295)>>>0;
  withStubRandom(frameSeed,()=>refLoop.frame());
  withStubRandom(frameSeed,()=>optLoop.frame());

  assert.deepEqual(optRecorder.calls,refRecorder.calls,`frame ${frame}: ordered ctx call list (with arguments) diverged`);
  assert.deepEqual(snap(optCtx.camera.position),snap(refCtx.camera.position),`frame ${frame}: camera.position diverged`);
  assert.deepEqual(snap(optCtx.cameraTarget),snap(refCtx.cameraTarget),`frame ${frame}: cameraTarget diverged`);
  assert.equal(optCtx.shake,refCtx.shake,`frame ${frame}: shake diverged`);
  assert.equal(optCtx.accumulated,refCtx.accumulated,`frame ${frame}: accumulated diverged`);
  assert.equal(optCtx.uiTimer,refCtx.uiTimer,`frame ${frame}: uiTimer diverged`);
  assert.equal(optCtx.audioTimer,refCtx.audioTimer,`frame ${frame}: audioTimer diverged`);
  assert.deepEqual(optCtx.network.input,refCtx.network.input,`frame ${frame}: network.input diverged`);
  assert.equal(optCtx.state.zone,refCtx.state.zone,`frame ${frame}: state.zone diverged`);
  assert.deepEqual(optCtx.state.visited,refCtx.state.visited,`frame ${frame}: state.visited diverged`);
 }

 assert.ok(safeCalls.opt<=safeCalls.ref,`optimized should never call safeHere more than the reference across the run (ref ${safeCalls.ref}, opt ${safeCalls.opt})`);
 console.log(`P6a fuzz parity: ${FRAMES} frames, 0 divergences. safeHere calls -- reference: ${safeCalls.ref}, optimized: ${safeCalls.opt}`);
});

test('safeHere() is evaluated at most once per frame instead of once per qualifying enemy (100 frames, 20 live enemies within range)',()=>{
 const FRAMES=100,ENEMY_COUNT=20;
 const nearbyEnemies=()=>Array.from({length:ENEMY_COUNT},(_,i)=>({dead:false,model:{position:new T.Vector3(START.x+(i%3)-1,0,START.z)}}));
 let refSafeCalls=0,optSafeCalls=0;
 const refCtx=makeCtx({enemies:nearbyEnemies(),safeHere:()=>{refSafeCalls++;return true;}});
 const optCtx=makeCtx({enemies:nearbyEnemies(),safeHere:()=>{optSafeCalls++;return true;}});
 const refLoop=createReferenceRenderLoop(refCtx),optLoop=createRenderLoop(optCtx);
 for(let i=0;i<FRAMES;i++){refLoop.frame();optLoop.frame();}
 assert.ok(refSafeCalls>=FRAMES*ENEMY_COUNT,`reference should call safeHere at least ${FRAMES*ENEMY_COUNT} times (safeHere()===true never short-circuits .some(), so every live nearby enemy re-checks it), got ${refSafeCalls}`);
 assert.ok(optSafeCalls<=FRAMES,`optimized should call safeHere at most ${FRAMES} times (memoized once per frame), got ${optSafeCalls}`);
 console.log(`safeHere calls over ${FRAMES} frames x ${ENEMY_COUNT} live nearby enemies -- reference: ${refSafeCalls}, optimized: ${optSafeCalls}`);
});

test('the optimized camera-target computation allocates 0 Vector3 once warm (module resolve-hook spy on dist/render-loop.js\'s own T.Vector3, per tests/region-travel.test.mjs\'s pattern)',()=>{
 const ctx=makeCtx({enemies:[]});
 const loop=createRenderLoop(ctx);
 vector3Stats.count=0; // the module-scope `_desired` scratch was already constructed once, at import time above
 const FRAMES=200;
 for(let i=0;i<FRAMES;i++)loop.frame();
 assert.equal(vector3Stats.count,0,`expected 0 Vector3 constructions in dist/render-loop.js across ${FRAMES} frames after warm-up, got ${vector3Stats.count}`);
});
