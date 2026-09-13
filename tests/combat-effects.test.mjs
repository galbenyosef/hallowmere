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
