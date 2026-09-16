import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from '../dist/vendor/three.core.js';
import {resolveMove} from '../dist/combat.js';
import {installGlobals} from './helpers/dom.mjs';
import {createPlayerMotion} from '../dist/player-motion.js';

// M6 moved moveEntity/animateRig/updatePlayer/updateEffects/updateFloaters out of main.js.
// updatePlayer already has coverage in tests/mouse-targeting.test.mjs (the vm slice migrated
// to createPlayerMotion there); this file covers the other four directly against minimal
// per-test ctx fixtures, the way tests/effects-factory.test.mjs covers createEffects.

function makeMoveCtx({player,moveTarget=null,obstacles=[]}={}){
 return {player,moveTarget,environment:{obstacles},worldBounds:()=>({minX:-25,maxX:25,minZ:-25,maxZ:25}),networkDirection:{x:0,z:0}};
}

test('moveEntity moves a non-tracked model freely and matches resolveMove exactly',()=>{
 const bystander=new T.Group();bystander.position.set(0,0,0);
 const ctx=makeMoveCtx({player:new T.Group(),obstacles:[]});
 const {moveEntity}=createPlayerMotion(ctx);
 const moved=moveEntity(bystander,1,0,.42);
 const expected=resolveMove({x:0,z:0},1,0,[],.42,ctx.worldBounds());
 assert.equal(bystander.position.x,expected.x);
 assert.equal(bystander.position.z,expected.z);
 assert.equal(moved,Math.hypot(expected.x,expected.z));
 // bystander !== ctx.player, so the network-direction side effect never fires.
 assert.deepEqual(ctx.networkDirection,{x:0,z:0});
});

test('moveEntity blocks the tracked player against a fixture wall exactly as resolveMove does',()=>{
 const player=new T.Group();player.position.set(0,0,0);
 const obstacles=[{x:3,z:0,w:1,d:3,rotation:0}];
 const ctx=makeMoveCtx({player,obstacles});
 const {moveEntity}=createPlayerMotion(ctx);
 const moved=moveEntity(player,4,0,.42);
 const expected=resolveMove({x:0,z:0},4,0,obstacles,.42,ctx.worldBounds());
 assert.equal(player.position.x,expected.x);
 assert.equal(player.position.z,expected.z);
 assert.ok(player.position.x<3-.5-.42+1e-6,'player must stop short of the wall face');
 assert.ok(player.position.x>0,'player must still have advanced toward the wall');
 assert.equal(moved,Math.hypot(expected.x,expected.z));
});

test('moveEntity records a normalized ctx.networkDirection with stopAt only for the tracked player, and only when ctx.moveTarget is set',()=>{
 const player=new T.Group();player.position.set(0,0,0);
 const withTarget=makeMoveCtx({player,moveTarget:{x:5,z:5}});
 createPlayerMotion(withTarget).moveEntity(player,3,4,.42);
 assert.deepEqual(withTarget.networkDirection,{x:3/5,z:4/5,stopAt:{x:5,z:5}});
 player.position.set(0,0,0);
 const withoutTarget=makeMoveCtx({player,moveTarget:null});
 createPlayerMotion(withoutTarget).moveEntity(player,0,2,.42);
 assert.deepEqual(withoutTarget.networkDirection,{x:0,z:1});
});

function makeRig({body=true}={}){
 return {
  legs:[{name:'legL',rotation:{x:0}},{name:'legR',rotation:{x:0}},{name:'legBackL',rotation:{x:0}},{name:'legBackR',rotation:{x:0}}],
  arms:[{name:'armL',rotation:{x:0}},{name:'armR',rotation:{x:0}}],
  body:body?{rotation:{x:0,z:0},position:{y:0},baseY:1.18}:null,
 };
}

test('animateRig drives a moving, wound-up hound rig to concrete leg/arm/body rotations for a fixed t',()=>{
 const rig=makeRig(),t=.4,speed=13,windup=.5;
 const {animateRig}=createPlayerMotion({});
 animateRig(rig,t,true,windup,'hound');
 // sign is -1 for names containing 'L', back is -1 for names containing 'Back'.
 assert.equal(rig.legs[0].rotation.x,Math.sin(t*speed)*.55*-1*1); // legL
 assert.equal(rig.legs[1].rotation.x,Math.sin(t*speed)*.55*1*1); // legR
 assert.equal(rig.legs[2].rotation.x,Math.sin(t*speed)*.55*-1*-1); // legBackL
 assert.equal(rig.legs[3].rotation.x,Math.sin(t*speed)*.55*1*-1); // legBackR
 assert.equal(rig.arms[0].rotation.x,windup*-1.3+Math.sin(t*speed)*.2); // i=0 even
 assert.equal(rig.arms[1].rotation.x,windup*-1.3+Math.sin(t*speed)*-.2); // i=1 odd
 assert.equal(rig.body.rotation.z,Math.sin(t*2.1)*.016);
 assert.equal(rig.body.rotation.x,windup*-.22);
 assert.equal(rig.body.position.y,1.18+Math.abs(Math.sin(t*speed))*.035);
});

test('animateRig drives an idle, bodiless warden rig to the idle sway formula and never divides by sign/back',()=>{
 const rig=makeRig({body:false}),t=.7;
 const {animateRig}=createPlayerMotion({});
 animateRig(rig,t,false); // windup=0, type='warden' defaults
 for(const leg of rig.legs)assert.equal(leg.rotation.x,Math.sin(t*1.7)*.025);
 assert.equal(rig.arms[0].rotation.x,Math.sin(t*1.8+0)*.04);
 assert.equal(rig.arms[1].rotation.x,Math.sin(t*1.8+1)*.04);
 assert.equal(rig.body,null); // no crash without a body -- the block is skipped entirely
});

function makeEffectsCtx(){
 const removed=[];
 return {
  effects:[],removed,removeObject:mesh=>removed.push(mesh),
  classEffects:{updateCalls:[],update(dt){this.updateCalls.push(dt);},lightSources:()=>[]},
  combatEffects:{calls:[],update(dt,lights){this.calls.push({dt,lights});}},
  enemies:[],networkProjectiles:new Map(),spellLight:{intensity:100},player:{position:{x:0,y:0,z:0}},
 };
}
const ringEffect=(life,from,to)=>({type:'ring',mesh:new T.Mesh(new T.RingGeometry(.89,1,8),new T.MeshBasicMaterial({opacity:.8})),time:0,life,from,to});
const slashEffect=(life,angle)=>({type:'slash',mesh:new T.Mesh(new T.RingGeometry(1,1.2,8),new T.MeshBasicMaterial({opacity:.48})),time:0,life,angle});
function particlesEffect(life){
 const g=new T.BufferGeometry();
 g.setAttribute('position',new T.BufferAttribute(new Float32Array([0,0,0,1,1,1]),3));
 return {type:'particles',mesh:new T.Points(g,new T.PointsMaterial({opacity:.9})),velocity:new Float32Array([1,2,3,-1,-2,-3]),time:0,life};
}

test('updateEffects advances ring and slash opacity/scale/rotation for unexpired effects and leaves them in ctx.effects',()=>{
 const ctx=makeEffectsCtx();
 const ring=ringEffect(1,.2,.8),slash=slashEffect(.5,Math.PI/6);
 ctx.effects.push(ring,slash);
 const {updateEffects}=createPlayerMotion(ctx);
 const dt=.1;
 updateEffects(dt);
 assert.equal(ctx.effects.length,2);
 assert.equal(ctx.removed.length,0);
 const p1=dt/1;
 assert.equal(ring.mesh.material.opacity,(1-p1)*.85);
 const r=T.MathUtils.lerp(.2,.8,1-(1-p1)*(1-p1));
 assert.equal(ring.mesh.scale.x,r);assert.equal(ring.mesh.scale.y,r);assert.equal(ring.mesh.scale.z,r);
 const p2=dt/.5;
 assert.equal(slash.mesh.material.opacity,(1-p2)*.85);
 assert.equal(slash.mesh.rotation.z,Math.PI/6-.35+p2*.9);
 assert.equal(slash.mesh.scale.x,.8+p2*.3);
 assert.equal(ctx.classEffects.updateCalls[0],dt);
 assert.deepEqual(ctx.combatEffects.calls[0],{dt,lights:[]});
 assert.equal(ctx.spellLight.intensity,100-dt*160);
});

test('updateEffects advances particle positions by velocity*dt and decays their vertical velocity',()=>{
 const ctx=makeEffectsCtx();
 const particles=particlesEffect(.75);
 ctx.effects.push(particles);
 const {updateEffects}=createPlayerMotion(ctx);
 const dt=.5; // exact in float32 for these small integer velocities, so no rounding slop needed
 updateEffects(dt);
 const pos=particles.mesh.geometry.attributes.position.array;
 assert.equal(pos[0],.5);assert.equal(pos[1],1);assert.equal(pos[2],1.5);
 assert.equal(pos[3],.5);assert.equal(pos[4],0);assert.equal(pos[5],-.5);
 assert.equal(particles.mesh.geometry.attributes.position.version,1); // BufferAttribute.needsUpdate is write-only; version is the readable proxy
 assert.equal(particles.velocity[1],-1);assert.equal(particles.velocity[4],-5);
});

test('updateEffects removes an expired effect via ctx.removeObject and leaves survivors untouched',()=>{
 const ctx=makeEffectsCtx();
 const dying=ringEffect(.05,.2,.8);dying.time=.05;
 const survivor=slashEffect(1,0);
 ctx.effects.push(dying,survivor);
 const {updateEffects}=createPlayerMotion(ctx);
 updateEffects(.01);
 assert.equal(ctx.effects.length,1);
 assert.equal(ctx.effects[0],survivor);
 assert.deepEqual(ctx.removed,[dying.mesh]);
});

function makeCamera(){
 const camera=new T.OrthographicCamera(-10,10,10,-10,.1,100);
 camera.position.set(0,10,10);camera.lookAt(0,0,0);
 camera.updateProjectionMatrix();camera.updateMatrixWorld();
 return camera;
}
const floater=({time=0,life=1,offset=5,pos=new T.Vector3(0,1,0)}={})=>({element:{removed:false,remove(){this.removed=true;},style:{}},pos,time,life,offset});

test('updateFloaters advances live floaters (transform/opacity) and removes expired ones',t=>{
 installGlobals(t,{innerWidth:800,innerHeight:600});
 const camera=makeCamera();
 const live=floater({time:0,life:1,offset:5,pos:new T.Vector3(0,1,0)});
 const expired=floater({time:.96,life:1,offset:0,pos:new T.Vector3(1,1,1)});
 const ctx={floaters:[live,expired],camera};
 const {updateFloaters}=createPlayerMotion(ctx);
 updateFloaters(.05);
 assert.equal(ctx.floaters.length,1);
 assert.equal(ctx.floaters[0],live);
 assert.equal(live.time,.05);
 const projected=live.pos.clone().project(camera);
 const x=(projected.x*.5+.5)*800,y=(-projected.y*.5+.5)*600;
 assert.equal(live.element.style.transform,`translate(${x+live.offset}px,${y-live.time*55}px) translate(-50%,-50%)`);
 assert.equal(live.element.style.opacity,String(Math.min(1,(live.life-live.time)*3)));
 assert.equal(live.element.removed,false);
 assert.equal(expired.element.removed,true);
});
