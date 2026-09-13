import test from 'node:test';
import assert from 'node:assert/strict';
import {MovementCorrection,MovementBuffer,predictDodge} from '../dist/multiplayer-motion.js';
import {predictedPosition} from '../dist/multiplayer-client.js';
import {pointBlocked} from '../dist/combat.js';
import {World} from '../server/world.mjs';

const bounds={minX:-100,maxX:100,minZ:-100,maxZ:100};
const near=(actual,expected)=>assert.ok(Math.abs(actual-expected)<1e-8,`${actual} != ${expected}`);

test('routine reconciliation never jumps on receipt or pulls new movement toward an old destination',()=>{
 const correction=new MovementCorrection(),position={x:0,z:0};
 correction.reconcile(position,{x:.2,z:0});assert.deepEqual(position,{x:0,z:0});
 for(let i=0;i<60;i++){correction.update(position,1/60,[],bounds);position.x+=4.9/60;}
 assert.ok(position.x>5.099&&position.x<=5.1);
 const idle=new MovementCorrection(),rest={x:0,z:0};idle.reconcile(rest,{x:.2,z:0});
 for(let i=0;i<60;i++)idle.update(rest,1/60,[],bounds);
 assert.ok(rest.x>.199&&rest.x<=.2);
});

test('uneven 10 Hz snapshots produce smaller frame-speed spikes without reversing walking',()=>{
 for(const fps of [30,60,144]){
  const correction=new MovementCorrection(),position={x:0,z:0},old={x:0,z:0};
  const packets=Array.from({length:40},(_,i)=>({time:i*.1,arrival:i*.1+[0,.04,.01,.06][i%4]}));
  let packet=0,newSpike=0,oldSpike=0;
  for(let frame=1;frame<=fps*4;frame++){
   const time=frame/fps,previous=position.x,oldPrevious=old.x;
   while(packet<packets.length&&packets[packet].arrival<=time){const target={x:packets[packet++].time*4.9,z:0};correction.reconcile(position,target);old.x+=(target.x-old.x)*.45;}
   correction.update(position,1/fps,[],bounds);position.x+=4.9/fps;old.x+=4.9/fps;
   assert.ok(position.x>previous,`walking reversed at ${fps} fps`);
   newSpike=Math.max(newSpike,Math.abs(position.x-previous-4.9/fps));
   oldSpike=Math.max(oldSpike,Math.abs(old.x-oldPrevious-4.9/fps));
  }
  assert.ok(newSpike<oldSpike*.75,`${fps} fps: ${newSpike} vs ${oldSpike}`);
 }
});

test('corrections preserve walls and regional bounds; resets discard old correction debt',()=>{
 const correction=new MovementCorrection(),position={x:0,z:0},wall={x:1,z:0,w:.2,d:6};
 correction.reconcile(position,{x:1.2,z:0});
 for(let i=0;i<120;i++){correction.update(position,1/60,[wall],bounds);assert.equal(pointBlocked(position,[wall],.42),false);}
 assert.ok(position.x<1);
 correction.reconcile(position,{x:2,z:0},true);assert.equal(position.x,2);
 correction.update(position,1,[],bounds);assert.equal(position.x,2);
 correction.reconcile(position,{x:20,z:10});assert.deepEqual(position,{x:20,z:10});
 correction.reconcile(position,{x:21,z:10});correction.update(position,1,[],{...bounds,maxX:20});assert.equal(position.x,20);
});

test('render-frame dodges match authoritative travel and stop at walls and the end of the evade',()=>{
 const world=new World({seed:17,now:()=>0}),p=world.join().player;Object.assign(p,{x:-40,z:5});
 world.command(p.id,{type:'input',worldId:world.id,seq:1,x:1,z:0,angle:Math.PI/2});
 world.command(p.id,{type:'ability',worldId:world.id,seq:2,action:'dodge',angle:Math.PI/2});
 let prediction={x:p.x,z:p.z,remaining:p.dodge};
 for(let tick=0;tick<5;tick++){
  for(let frame=0;frame<5;frame++)prediction=predictDodge(prediction,p.angle,prediction.remaining,.01,world.obstacles,bounds);
  world.step(.05);near(prediction.x,p.x);near(prediction.z,p.z);near(prediction.remaining,p.dodge);
 }
 prediction=predictDodge(prediction,p.angle,prediction.remaining,.05,world.obstacles,bounds);world.step(.05);near(prediction.x,p.x);assert.equal(prediction.remaining,0);
 const stopped=predictDodge(prediction,p.angle,0,1,[],bounds);near(stopped.x,prediction.x);
 const wall={x:1,z:0,w:.2,d:5},blocked=predictDodge({x:0,z:0},Math.PI/2,.27,.27,[wall],bounds);assert.equal(pointBlocked(blocked,[wall],.42),false);assert.ok(blocked.x<1);
 const queued=[{seq:1,x:-1,z:0}];assert.deepEqual(predictedPosition({x:0,z:0,dodge:.2},queued,0,[]),{x:0,z:0});assert.deepEqual(predictedPosition({x:0,z:0,ended:true},queued,0,[]),{x:0,z:0});
});

test('buffer follows timestamped turns, rotates across the angle seam, and holds on stalled packets',()=>{
 const buffer=new MovementBuffer();buffer.push({x:0,z:0,angle:Math.PI-.1},0);buffer.push({x:1,z:0,angle:-Math.PI+.1},.1);buffer.push({x:1,z:1,angle:0},.2);
 const turn=buffer.sample(.05);near(turn.x,.5);near(turn.z,0);near(turn.angle,Math.PI);assert.equal(turn.moving,true);
 const corner=buffer.sample(.15);near(corner.x,1);near(corner.z,.5);
 buffer.push({x:1,z:1,angle:0},.3);assert.equal(buffer.sample(.25).moving,false);
 const stalled=buffer.sample(100);assert.equal(stalled.x,1);assert.equal(stalled.z,1);assert.equal(stalled.moving,false);
});

test('teleports, map changes, respawns and world resets never interpolate through the old world',()=>{
 const buffer=new MovementBuffer(),state={x:0,z:0,mapId:'overworld',ended:false};buffer.push(state,0);buffer.push({...state,x:1},.1);
 buffer.push({...state,x:50},.2);assert.equal(buffer.sample(.1).x,50);
 buffer.push({...state,x:2,mapId:'underways'},.3);assert.equal(buffer.sample(.2).x,2);
 buffer.push({...state,ended:true},.4);buffer.push({...state,x:1},.5);assert.equal(buffer.sample(.4).x,1);
 buffer.push({...state,x:2},.6,true);assert.equal(buffer.sample(.5).x,2);
 buffer.push({...state,x:3},0);assert.equal(buffer.sample(0).x,3);
 buffer.push({...state,x:99},0);assert.equal(buffer.sample(0).x,99); // explicit teleport wins even at the same tick
});
