import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {registerHooks} from 'node:module';
import * as T from '../dist/vendor/three.core.js';
import {abilityForEvent,classColor} from '../dist/classes.js';
import {modelBounds} from '../dist/playable-characters.js';
import {createCharacter} from '../dist/character-study-models.js';
import {roster} from '../dist/character-study-roster.js';
import {animateHeroAttack} from '../dist/combat-effects.js';
import {sliceBetween,readDist} from './helpers/source.mjs';

const main=readDist('main.js');
// dist/model-kit.js imports the bare 'three' specifier, which only the page's import map
// resolves; match it in Node the way tests/npc-portraits.test.mjs does for GLTFLoader.js.
const hook=registerHooks({resolve(specifier,context,nextResolve){
 if(specifier==='three')return nextResolve(new URL('../dist/vendor/three.module.js',import.meta.url).href,context);
 if(specifier==='three/addons/utils/BufferGeometryUtils.js')return nextResolve(new URL('../dist/vendor/utils/BufferGeometryUtils.js',import.meta.url).href,context);
 return nextResolve(specifier,context);
}});
const {getRig,createModelCache}=await import('../dist/model-kit.js');
hook.deregister();
// The networkEvent slice below still runs through vm (M10 migrates it); cloneModel/getRig are
// real imports now, assigned onto the same vm context so context.cloneModel(...) keeps working
// and a bare `ctx` stays available as a global for the vm-evaluated networkEvent code.
function gameplay(){
 const ctx={prefabs:{}},context=vm.createContext({T,ctx});
 Object.assign(context,createModelCache(ctx),{getRig});
 return context;
}
function triangles(root){let n=0;root.traverse(o=>{if(o.isMesh)n+=(o.geometry.index?.count??o.geometry.attributes.position.count)/3;});return n;}

test('Nightblade ornaments survive batching and follow the body, hands, and legs in every presentation',()=>{
 const context=gameplay(),model=context.cloneModel('C04'),rig=context.getRig(model),study=createCharacter(roster.find(c=>c.id==='C04'));
 assert.equal(rig.arms.length,2);assert.equal(rig.legs.length,2);assert.equal(rig.baseY,1.3);
 assert.equal(triangles(model),triangles(study));assert.ok(triangles(model)<45000);
 const size=modelBounds(model).getSize(new T.Vector3());assert.ok(size.y>1.7&&size.y<3.1);assert.ok(size.x<2.5&&size.z<2);
 model.traverse(o=>{if(o.isMesh)for(const attribute of ['position','normal'])assert.ok(o.geometry.attributes[attribute].array.every(Number.isFinite));});
 for(const [name,joint] of [
  ['nightblade-swept-hair','body'],['nightblade-gold-circlet','body'],['nightblade-pointed-ear--1','body'],['nightblade-pointed-ear-1','body'],
  ['nightblade-split-scale-coat','body'],['nightblade-embroidered-tabard','body'],['nightblade-jeweled-belt','body'],
  ['nightblade-swept-pauldron--1','armL'],['nightblade-swept-pauldron-1','armR'],['nightblade-sleeve-streamer--1','armL'],['nightblade-sleeve-streamer-1','armR'],
  ['nightblade-gold-greave--1','legL'],['nightblade-gold-greave-1','legR'],['weapon','armR'],['offhand','armL']
 ]){
  assert.ok(study.getObjectByName(name),`${name} is also used by the roster and portraits`);
  const piece=model.getObjectByName(name),pivot=model.getObjectByName(joint);assert.ok(piece,name);
  let ancestor=piece.parent;while(ancestor&&ancestor!==pivot)ancestor=ancestor.parent;
  assert.equal(ancestor,pivot,`${name} follows ${joint}`);
  const before=piece.getWorldQuaternion(new T.Quaternion());
  pivot.rotation.x=.5;model.updateMatrixWorld(true);
  assert.ok(before.angleTo(piece.getWorldQuaternion(new T.Quaternion()))>.4,`${name} rotates with its joint`);
  pivot.rotation.x=0;model.updateMatrixWorld(true);
 }
});

test('authoritative Twin Cut animates both Nightblade blades without changing another actor',()=>{
 const context=gameplay(),first=context.cloneModel('C04'),second=context.cloneModel('C04'),rig=context.getRig(first),other=context.getRig(second);
 Object.assign(context.ctx,{backgrounded:false,renderedMap:'overworld',network:{id:'local'},player:first,heroRig:rig,multiplayerView:{actors:new Map([['remote',{model:second,rig:other}]])},classEffects:{ability:()=>true}});
 Object.assign(context,{abilityForEvent,classColor,audioAt(){}});
 // Exercise the real melee event path, through its existing animation selection.
 vm.runInContext(sliceBetween(main,'function networkEvent(event)',"  if(skill?.kind==='projectile')",{file:'dist/main.js'})+'}}',context);
 context.networkEvent({type:'ability',action:'attack',classId:'nightblade',playerId:'local'});
 assert.equal(rig.attackKind,'paired');assert.equal(other.attack,undefined);
 const blades=['weapon','offhand'].map(name=>first.getObjectByName(name));
 const before=blades.map(o=>new T.Box3().setFromObject(o).getCenter(new T.Vector3()));
 animateHeroAttack(rig,.11);first.updateMatrixWorld(true);
 assert.ok(rig.arms.find(o=>o.name==='armR').rotation.x<rig.arms.find(o=>o.name==='armL').rotation.x);
 assert.ok(before[0].distanceTo(new T.Box3().setFromObject(blades[0]).getCenter(new T.Vector3()))>.1);
 animateHeroAttack(rig,.13);first.updateMatrixWorld(true);
 assert.ok(rig.arms.find(o=>o.name==='armL').rotation.x<rig.arms.find(o=>o.name==='armR').rotation.x);
 assert.ok(before[1].distanceTo(new T.Box3().setFromObject(blades[1]).getCenter(new T.Vector3()))>.1);
 animateHeroAttack(rig,1);assert.equal(rig.attack,0);
 assert.ok(other.arms.every(o=>o.rotation.x===0&&o.rotation.y===0&&o.rotation.z===0));
 for(const joint of [rig.body,...rig.arms])assert.ok([joint.rotation.x,joint.rotation.y,joint.rotation.z].every(Number.isFinite));
});
