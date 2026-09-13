import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import * as T from '../dist/vendor/three.core.js';
import {CLASS_LIST} from '../dist/classes.js';
import {createPlayableCharacter,modelBounds} from '../dist/playable-characters.js';
import {animateHeroAttack} from '../dist/combat-effects.js';

const main=await readFile(new URL('../dist/main.js',import.meta.url),'utf8');
const utilities=await readFile(new URL('../dist/vendor/utils/BufferGeometryUtils.js',import.meta.url),'utf8');
const {mergeGeometries}=await import('data:text/javascript;base64,'+Buffer.from(utilities.replace("from 'three'",`from '${new URL('../dist/vendor/three.core.js',import.meta.url).href}'`)).toString('base64'));
function gameplay(){
 const context=vm.createContext({T,CLASS_LIST,createPlayableCharacter,prefabs:{},mergeGeometries,Float32Array});
 vm.runInContext(main.slice(main.indexOf('function optimizeModel'),main.indexOf('function spawnEnemy')),context);
 return context;
}

test('Ranger reference details survive mesh batching and stay attached to the animated body',()=>{
 const context=gameplay(),model=context.cloneModel('C02'),rig=context.getRig(model);
 assert.equal(rig.arms.length,2);assert.equal(rig.legs.length,2);
 for(const name of ['ranger-blond-hair','ranger-side-braid--1','ranger-side-braid-1','ranger-pointed-ear--1','ranger-pointed-ear-1','ranger-grey-cloak','ranger-leaf-clasp','ranger-quiver','ranger-sheathed-knives']){
  const piece=model.getObjectByName(name);assert.ok(piece,name);
  let ancestor=piece.parent;while(ancestor&&ancestor!==rig.body)ancestor=ancestor.parent;
  assert.equal(ancestor,rig.body,`${name} follows the torso`);
 }
 const unbatched=createPlayableCharacter('ranger'),triangles=root=>{let n=0;root.traverse(o=>{if(o.isMesh)n+=(o.geometry.index?.count??o.geometry.attributes.position.count)/3;});return n;};
 assert.equal(triangles(model),triangles(unbatched));
 const size=modelBounds(model).getSize(new T.Vector3());assert.ok(size.y>1.7&&size.y<3.1);assert.ok(size.x<2.5&&size.z<2);
 model.traverse(o=>{if(o.isMesh)assert.ok(o.geometry.attributes.position.array.every(Number.isFinite));});
});

test('each cloned Ranger draws both knives for the two cuts and restores the bow on expiry',()=>{
 const context=gameplay(),first=context.cloneModel('C02'),second=context.cloneModel('C02'),rig=context.getRig(first),other=context.getRig(second),gear=rig.rangerWeapons;
 assert.equal(gear.bow.parent.name,'armR');assert.equal(gear.right.parent.name,'armR');assert.equal(gear.left.parent.name,'armL');
 assert.ok(gear.bow.visible&&gear.sheathed.visible);assert.ok(!gear.right.visible&&!gear.left.visible&&!gear.stowed.visible);
 rig.attack=.42;rig.attackKind='paired';animateHeroAttack(rig,.11);
 assert.ok(gear.right.visible&&gear.left.visible&&gear.stowed.visible);assert.ok(!gear.bow.visible&&!gear.sheathed.visible);
 assert.ok(other.rangerWeapons.bow.visible&&!other.rangerWeapons.right.visible,'another actor remains in its own pose');
 const hand=rig.arms.find(o=>o.name==='armR'),before=new T.Box3().setFromObject(gear.right).getCenter(new T.Vector3());
 hand.rotation.y+=.8;first.updateMatrixWorld(true);
 assert.ok(before.distanceTo(new T.Box3().setFromObject(gear.right).getCenter(new T.Vector3()))>.01);
 animateHeroAttack(rig,.14);assert.ok(gear.left.visible,'the second cut still carries the left blade');
 animateHeroAttack(rig,1);assert.ok(gear.bow.visible&&gear.sheathed.visible);assert.ok(!gear.right.visible&&!gear.left.visible&&!gear.stowed.visible);
});

test('Ranger ranged attacks keep the bow equipped and use a distinct two-arm draw pose',()=>{
 const context=gameplay(),rig=context.getRig(context.cloneModel('C02'));
 rig.attack=.36;rig.attackKind='bolt';animateHeroAttack(rig,.12);
 assert.ok(rig.rangerWeapons.bow.visible&&!rig.rangerWeapons.right.visible);
 const right=rig.arms.find(o=>o.name==='armR'),left=rig.arms.find(o=>o.name==='armL');
 assert.ok(right.rotation.x<-.9&&left.rotation.x<-.9);assert.ok(left.rotation.y>.3);
 const bowUp=new T.Vector3(0,1,0).applyQuaternion(rig.rangerWeapons.bow.getWorldQuaternion(new T.Quaternion()));
 assert.ok(bowUp.y>.95,'the drawn bow remains upright as the bow arm lifts');
 animateHeroAttack(rig,1);assert.equal(rig.rangerWeapons.bow.rotation.x,0);
 for(const joint of [rig.body,...rig.arms])assert.ok([joint.rotation.x,joint.rotation.y,joint.rotation.z].every(Number.isFinite));
});
