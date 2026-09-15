import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from '../dist/vendor/three.core.js';
import {createCombatEffects,animateHeroAttack} from '../dist/combat-effects.js';
import {withinArc} from '../dist/combat.js';

test('repeated casts and impacts release their resources without disposing the shared glow / sprite geometry',()=>{
 const scene=new T.Scene(),texture=new T.Texture(),effects=createCombatEffects(scene,texture);
 const sharedSpriteGeometry=new T.Sprite().geometry;
 let textureDisposals=0,spriteDisposals=0,allocated=0,released=0;
 texture.addEventListener('dispose',()=>textureDisposals++);
 const onSpriteDispose=()=>spriteDisposals++;
 sharedSpriteGeometry.addEventListener('dispose',onSpriteDispose);
 for(let cast=0;cast<40;cast++){
  const pos=new T.Vector3(cast,1.1,0),direction=new T.Vector3(1,0,0);
  const bolt=effects.emberbolt(pos,direction);
  const arcane=effects.arcaneBolt(pos,direction);
  effects.cast(pos,direction);effects.emberImpact(pos,direction);effects.steelImpact(pos);
  effects.arcaneCast(pos,direction);effects.arcaneImpact(pos,direction);
  const tracked=new Set();
  scene.traverse(node=>{
   for(const resource of [node.isSprite?null:node.geometry,node.material])if(resource&&!tracked.has(resource)){
    tracked.add(resource);allocated++;resource.addEventListener('dispose',()=>released++);
   }
  });
  bolt.update(.2);arcane.update(.2);effects.update(.2);
  assert.equal(scene.children.filter(n=>n.isPointLight).length,2);
  assert.ok(scene.children.some(n=>n.isPointLight&&n.intensity>0));
  bolt.dispose();bolt.dispose();arcane.dispose();arcane.dispose();effects.update(1);
  assert.equal(scene.children.length,2);
  assert.ok(scene.children.every(n=>n.isPointLight&&n.intensity===0));
 }
 assert.equal(released,allocated);
 assert.equal(textureDisposals,0);assert.equal(spriteDisposals,0);
 sharedSpriteGeometry.removeEventListener('dispose',onSpriteDispose);
 effects.dispose();assert.equal(scene.children.length,0);
});

test('Cleave visual remains inside the forward damage cone in every facing direction',()=>{
 const scene=new T.Scene(),effects=createCombatEffects(scene,new T.Texture()),player=new T.Group();
 player.position.set(7,0,-4);
 for(const angle of [0,Math.PI/2,Math.PI,-Math.PI/2]){
  effects.cleave(player,angle);effects.update(.1);scene.updateMatrixWorld(true);
  const root=scene.children.find(n=>n.isGroup);
  root.traverse(node=>{
   if(!node.isMesh)return;
   const positions=node.geometry.attributes.position;
   for(let i=0;i<positions.count;i++){
    const point=new T.Vector3().fromBufferAttribute(positions,i).applyMatrix4(node.matrixWorld);
    assert.ok(withinArc(player.position,point,angle,2.9,2.10001));
   }
  });
  player.position.x+=1;effects.update(.02);
  assert.equal(root.position.x,player.position.x);
  effects.update(1);
 }
 effects.dispose();
});

test('reduced motion removes fireball pulsing while preserving flight and cleanup',()=>{
 const scene=new T.Scene(),effects=createCombatEffects(scene,new T.Texture(),{reducedMotion:true});
 const bolt=effects.emberbolt(new T.Vector3(0,1.1,0),new T.Vector3(1,0,0));
 const core=bolt.mesh.children[0],initial=core.scale.clone();
 for(let i=0;i<20;i++){bolt.update(.016);assert.deepEqual(core.scale,initial);}
 const direction=new T.Vector3(0,0,1).applyQuaternion(bolt.mesh.quaternion);
 assert.ok(direction.distanceTo(new T.Vector3(1,0,0))<1e-6);
 effects.dispose();assert.equal(scene.children.length,0);
});

test('Arcane Bolt trails grow behind its flight and remain finite in every facing',()=>{
 const scene=new T.Scene(),effects=createCombatEffects(scene,new T.Texture());
 for(const angle of [0,Math.PI/2,Math.PI,-Math.PI/2]){
  const direction=new T.Vector3(Math.sin(angle),0,Math.cos(angle)),origin=new T.Vector3(7,1.1,-4);
  const bolt=effects.arcaneBolt(origin,direction,17);
  const tails=bolt.mesh.children.filter(n=>n.material?.uniforms?.phase);
  assert.equal(tails.length,2);
  assert.ok(tails.every(t=>t.scale.z===0));
  bolt.update(.04);scene.updateMatrixWorld(true);
  for(const tail of tails){
   const vertices=tail.geometry.attributes.position;
   for(let i=0;i<vertices.count;i++){
    const point=new T.Vector3().fromBufferAttribute(vertices,i).applyMatrix4(tail.matrixWorld).sub(origin);
    const along=point.dot(direction);
    assert.ok(along>=-17*.04-1e-6&&along<=.061,'trail stays behind the head and within distance travelled');
   }
  }
  bolt.update(2);scene.updateMatrixWorld(true);
  assert.ok(tails.every(t=>t.scale.z===1));
  bolt.mesh.traverse(node=>{
   assert.ok(node.matrixWorld.elements.every(Number.isFinite));
   if(node.geometry)assert.ok([...node.geometry.attributes.position.array].every(Number.isFinite));
  });
  bolt.dispose();
 }
 effects.dispose();
});

test('Arcane Bolt and Fireball share a bounded light pool with their own colors',()=>{
 const scene=new T.Scene(),effects=createCombatEffects(scene,new T.Texture());
 const arcane=effects.arcaneBolt(new T.Vector3(3,1.1,0),new T.Vector3(1,0,0));
 const fire=effects.emberbolt(new T.Vector3(-3,1.1,0),new T.Vector3(-1,0,0));
 effects.update(.1);
 const lights=scene.children.filter(n=>n.isPointLight);
 assert.equal(lights.length,2);
 const cold=lights.find(n=>n.position.x===3),warm=lights.find(n=>n.position.x===-3);
 assert.ok(cold.color.b>cold.color.r&&cold.intensity>0);
 assert.ok(warm.color.r>warm.color.b&&warm.intensity>0);
 for(let i=0;i<12;i++)effects.arcaneImpact(new T.Vector3(i,1,0));
 effects.update(.05);assert.equal(scene.children.filter(n=>n.isPointLight).length,2);
 fire.dispose();arcane.dispose();effects.update(1);
 assert.ok(lights.every(n=>n.intensity===0));effects.dispose();
});

test('reduced motion holds arcane shimmer, helix, and pulse steady while the trail grows',()=>{
 const scene=new T.Scene(),effects=createCombatEffects(scene,new T.Texture(),{reducedMotion:true});
 const bolt=effects.arcaneBolt(new T.Vector3(0,1.1,0),new T.Vector3(1,0,0));
 const core=bolt.mesh.children[0],initial=core.scale.clone();
 for(let i=0;i<20;i++){
  bolt.update(.016);assert.deepEqual(core.scale,initial);
  bolt.mesh.traverse(n=>{if(n.material?.uniforms?.time)assert.equal(n.material.uniforms.time.value,0);});
 }
 const direction=new T.Vector3(0,0,1).applyQuaternion(bolt.mesh.quaternion);
 assert.ok(direction.distanceTo(new T.Vector3(1,0,0))<1e-6);
 effects.arcaneCast(bolt.mesh.position,direction);effects.arcaneImpact(bolt.mesh.position);
 effects.dispose();assert.equal(scene.children.length,0);
});

test('casting and Cleave use separate finite poses and restore attack-owned transforms',()=>{
 const pose=kind=>{
  const body=new T.Group(),armR=new T.Group(),armL=new T.Group();armR.name='armR';armL.name='armL';
  return {body,arms:[armR,armL],attack:kind==='bolt'?.36:.42,attackKind:kind};
 };
 const bolt=pose('bolt'),cleave=pose('attack');
 animateHeroAttack(bolt,.11);animateHeroAttack(cleave,.11);
 assert.notEqual(bolt.arms[0].rotation.y,cleave.arms[0].rotation.y);
 assert.ok(bolt.body.position.z<0);assert.ok(cleave.body.position.z>0);
 for(const rig of [bolt,cleave]){
  for(let i=0;i<40;i++){
   animateHeroAttack(rig,.016);
   for(const node of [rig.body,...rig.arms])assert.ok([node.rotation.x,node.rotation.y,node.rotation.z,node.position.z].every(Number.isFinite));
  }
  assert.equal(rig.attack,0);assert.equal(rig.body.position.z,0);assert.equal(rig.body.rotation.y,0);
  for(const arm of rig.arms){assert.equal(arm.rotation.y,0);assert.equal(arm.rotation.z,0);}
 }
});

// --- P3: light-selection parity + allocation proof -------------------------------------
// dist/combat-effects.js update() used to rebuild the light-source list every frame with
// `sources=[...externalLights,...[...bolts].map(b=>({position:b.mesh.position,...b.light}))]`
// (a spread + a per-bolt object spread), push per-burst light objects, then `sources.sort(...)`
// and take the top `lights.length` (=2). That is 5 array allocations + 1 object per bolt per
// frame plus a full sort when only the top two entries are ever read. The refactor reuses a
// scratch array, keeps a persistent `light` record per bolt (position is the live
// `mesh.position` reference; color/intensity are set once and never mutated after creation —
// verified by grepping the whole repo for other `.light` writers) and a persistent
// `lightSource` record per lit burst (intensity refreshed in place each frame), then selects
// the top two by intensity directly instead of sorting. `referenceLightSelect` below is a
// verbatim copy of the original `update()` tail (from `git show main:dist/combat-effects.js`,
// the `sources` construction through the `lights.forEach`); `newLightSelect` mirrors the new
// fast path added to `update()` (dist/combat-effects.js, the `lights.length===2` branch).
// Both operate on the same plain stub light objects `{intensity,position:{copy},color:{setHex}}`
// so 2000 seeded-random frames can be compared without touching three.js meshes at all.

function referenceLightSelect(externalLights, bolts, bursts, lights) {
 const sources=[...externalLights,...[...bolts].map(b=>({position:b.mesh.position,...b.light}))];
 for(const b of bursts)if(b.light)sources.push({position:b.root.position,color:b.light.color,intensity:b.light.intensity*(1-b.age/b.life)**2});
 sources.sort((a,b)=>b.intensity-a.intensity);
 lights.forEach((light,i)=>{const source=sources[i];light.intensity=source?.intensity||0;if(source){light.position.copy(source.position);light.color.setHex(source.color);}});
}

// Verbatim mirror of the new `update()` fast path in dist/combat-effects.js (lights.length===2 branch).
function newLightSelect(externalLights, bolts, bursts, lights, scratch) {
 scratch.length=0;
 for(const e of externalLights)scratch.push(e);
 for(const b of bolts)scratch.push(b.light);
 for(const b of bursts)if(b.light){b.lightSource.intensity=b.light.intensity*(1-b.age/b.life)**2;scratch.push(b.lightSource);}
 let firstIdx=-1,firstVal=-Infinity,secondIdx=-1,secondVal=-Infinity;
 for(let i=0;i<scratch.length;i++) {
  const v=scratch[i].intensity;
  if(v>firstVal){secondIdx=firstIdx;secondVal=firstVal;firstIdx=i;firstVal=v;}
  else if(v>secondVal){secondIdx=i;secondVal=v;}
 }
 const s0=firstIdx<0?undefined:scratch[firstIdx],s1=secondIdx<0?undefined:scratch[secondIdx];
 lights[0].intensity=s0?.intensity||0;if(s0){lights[0].position.copy(s0.position);lights[0].color.setHex(s0.color);}
 lights[1].intensity=s1?.intensity||0;if(s1){lights[1].position.copy(s1.position);lights[1].color.setHex(s1.color);}
}

function mulberry32(seed) {
 return function() {
  seed=seed+0x6D2B79F5|0;
  let t=Math.imul(seed^seed>>>15,1|seed);
  t=t+Math.imul(t^t>>>7,61|t)^t;
  return ((t^t>>>14)>>>0)/4294967296;
 };
}
function makeStubLight() {
 return {intensity:0,position:{x:0,y:0,z:0,copy(v){this.x=v.x;this.y=v.y;this.z=v.z;return this;}},color:{lastHex:undefined,setHex(h){this.lastHex=h;return this;}}};
}

test('light selection parity: exact top-two selection matches the original full sort, including exact ties, across 2000 random frames',()=>{
 const rand=mulberry32(20260915);
 const referenceLights=[makeStubLight(),makeStubLight()],newLights=[makeStubLight(),makeStubLight()],scratch=[];
 let tiedScenarios=0;
 const FRAMES=2000;
 for(let frame=0;frame<FRAMES;frame++) {
  const nExternal=Math.floor(rand()*7),nBolts=Math.floor(rand()*9),nBursts=Math.floor(rand()*9);
  // A small shared intensity pool makes exact ties (including zero) common across external
  // lights and bolts, which is what stresses the "earlier source wins" tie-break rule.
  const poolSize=1+Math.floor(rand()*6),pool=Array.from({length:poolSize},()=>rand()<.15?0:rand()*80);
  const pickIntensity=()=>rand()<.65?pool[Math.floor(rand()*pool.length)]:(rand()<.1?0:rand()*80);
  const flatIntensities=[];

  const externalLights=[];
  for(let i=0;i<nExternal;i++) {
   const intensity=pickIntensity();flatIntensities.push(intensity);
   externalLights.push({position:{x:rand()*20-10,y:rand()*5,z:rand()*20-10},color:Math.floor(rand()*0xffffff),intensity});
  }
  const referenceBolts=[],newBolts=[];
  for(let i=0;i<nBolts;i++) {
   const position={x:rand()*20-10,y:rand()*5,z:rand()*20-10},color=Math.floor(rand()*0xffffff),intensity=pickIntensity();
   flatIntensities.push(intensity);
   referenceBolts.push({mesh:{position},light:{color,intensity}});
   newBolts.push({light:{position,color,intensity}});
  }
  const referenceBursts=[],newBursts=[];
  for(let i=0;i<nBursts;i++) {
   const position={x:rand()*20-10,y:rand()*5,z:rand()*20-10},age=rand()*10,life=age+rand()*10+.001;
   if(rand()<.15){referenceBursts.push({light:null,age,life,root:{position}});newBursts.push({light:null,age,life,lightSource:null});continue;}
   const color=Math.floor(rand()*0xffffff),intensity=pickIntensity();
   referenceBursts.push({light:{color,intensity},age,life,root:{position}});
   newBursts.push({light:{color,intensity},age,life,lightSource:{position,color,intensity:0}});
  }
  if(new Set(flatIntensities).size<flatIntensities.length)tiedScenarios++;

  referenceLightSelect(externalLights,new Set(referenceBolts),referenceBursts,referenceLights);
  newLightSelect(externalLights,new Set(newBolts),newBursts,newLights,scratch);

  for(let i=0;i<2;i++) {
   assert.equal(newLights[i].intensity,referenceLights[i].intensity,`frame ${frame} light ${i} intensity`);
   assert.equal(newLights[i].position.x,referenceLights[i].position.x,`frame ${frame} light ${i} position.x`);
   assert.equal(newLights[i].position.y,referenceLights[i].position.y,`frame ${frame} light ${i} position.y`);
   assert.equal(newLights[i].position.z,referenceLights[i].position.z,`frame ${frame} light ${i} position.z`);
   assert.equal(newLights[i].color.lastHex,referenceLights[i].color.lastHex,`frame ${frame} light ${i} color`);
  }
 }
 assert.ok(tiedScenarios>FRAMES*.3,`expected frequent exact-tie scenarios, saw ${tiedScenarios}/${FRAMES}`);
});

test('update() performs zero Array.prototype.map calls per frame after warm-up (old path used bolts.map to build per-bolt light objects)',()=>{
 const scene=new T.Scene(),effects=createCombatEffects(scene,new T.Texture());
 const bolts=[];
 for(let i=0;i<8;i++)bolts.push(i%2?effects.arcaneBolt(new T.Vector3(i,1,0),new T.Vector3(1,0,0)):effects.emberbolt(new T.Vector3(i,1,0),new T.Vector3(1,0,0)));
 effects.cast(new T.Vector3(0,1,0),new T.Vector3(1,0,0));
 effects.emberImpact(new T.Vector3(1,1,0),new T.Vector3(1,0,0));
 effects.arcaneImpact(new T.Vector3(2,1,0),new T.Vector3(1,0,0));
 const originalMap=Array.prototype.map;
 let mapCalls=0;
 Array.prototype.map=function(...args){mapCalls++;return originalMap.apply(this,args);};
 const FRAMES=200;
 try {
  for(let i=0;i<FRAMES;i++) {
   for(const bolt of bolts)bolt.update(.016);
   effects.update(.016,[{position:new T.Vector3(0,1,0),color:0xffffff,intensity:5}]);
  }
 } finally {
  Array.prototype.map=originalMap;
 }
 assert.equal(mapCalls,0,`new update() must not call Array.prototype.map per frame; saw ${mapCalls} calls across ${FRAMES} frames`);
 // Sanity-check the spy itself: the old algorithm (mirrored above) calls .map exactly once per
 // invocation via `[...bolts].map(...)`, so the same population run through it is not zero.
 // (refBolts is built with the spy uninstalled, so this setup step isn't itself counted)
 const refLights=[makeStubLight(),makeStubLight()];
 const refBolts=bolts.map(b=>({mesh:{position:b.mesh.position},light:b.light}));
 mapCalls=0;
 Array.prototype.map=function(...args){mapCalls++;return originalMap.apply(this,args);};
 try {
  referenceLightSelect([],new Set(refBolts),[],refLights);
 } finally {
  Array.prototype.map=originalMap;
 }
 assert.equal(mapCalls,1,'spy sanity check: the original algorithm should call Array.prototype.map exactly once');
 effects.dispose();
});
