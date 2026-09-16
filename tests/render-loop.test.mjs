import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from '../dist/vendor/three.core.js';
import {START,zoneAt} from '../dist/campaign.js';
import {createRenderLoop} from '../dist/render-loop.js';

const SPAWN_ZONE=zoneAt(START);

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
