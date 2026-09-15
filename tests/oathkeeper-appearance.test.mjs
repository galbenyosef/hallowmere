import test from 'node:test';
import assert from 'node:assert/strict';
import {registerHooks} from 'node:module';
import * as T from '../dist/vendor/three.core.js';
import {createPlayableCharacter} from '../dist/playable-characters.js';
import {animateHeroAttack} from '../dist/combat-effects.js';
import {createClassEffects} from '../dist/class-effects.js';

// dist/model-kit.js imports the bare 'three' specifier, which only the page's import map
// resolves; match it in Node the way tests/npc-portraits.test.mjs does for GLTFLoader.js.
const hook=registerHooks({resolve(specifier,context,nextResolve){
 if(specifier==='three')return nextResolve(new URL('../dist/vendor/three.module.js',import.meta.url).href,context);
 if(specifier==='three/addons/utils/BufferGeometryUtils.js')return nextResolve(new URL('../dist/vendor/utils/BufferGeometryUtils.js',import.meta.url).href,context);
 return nextResolve(specifier,context);
}});
const {getRig,createModelCache}=await import('../dist/model-kit.js');
hook.deregister();
function gameplay(){const ctx={prefabs:{}};return {...createModelCache(ctx),getRig};}
const triangles=root=>{let n=0;root.traverse(o=>{if(o.isMesh)n+=(o.geometry.index?.count??o.geometry.attributes.position.count)/3;});return n;};

test('Oathkeeper reference details survive batching, clone independently, and remain attached to the rig',()=>{
 const context=gameplay(),model=context.cloneModel('C05'),other=context.cloneModel('C05'),rig=context.getRig(model);
 assert.equal(triangles(model),triangles(createPlayableCharacter('oathkeeper')));assert.equal(rig.arms.length,2);assert.equal(rig.legs.length,2);
 for(const name of ['oathkeeper-blonde-hair','oathkeeper-high-ponytail','oathkeeper-halo','oathkeeper-ivory-armor','oathkeeper-split-coat','oathkeeper-wing-harness','oathkeeper-wing-left','oathkeeper-wing-right']){
  const part=model.getObjectByName(name);assert.ok(part,name);let parent=part.parent;while(parent&&parent!==rig.body)parent=parent.parent;assert.equal(parent,rig.body,name);
 }
 assert.equal(model.getObjectByName('weapon').parent.name,'armR');assert.equal(model.getObjectByName('oathkeeper-blaster').parent.name,'armL');
 assert.ok(model.getObjectByName('oathkeeper-staff-tip'));assert.equal(rig.oathkeeper.wings.length,2);
 model.traverse(n=>{if(n.isMesh)assert.ok(n.geometry.attributes.position.array.every(Number.isFinite));});
 model.userData.oathkeeperFlight=1;rig.attack=.36;rig.attackKind='bolt';animateHeroAttack(rig,.1);
 assert.ok(rig.oathkeeper.blaster.visible);assert.ok(!rig.oathkeeper.holster.visible);assert.ok(!other.getObjectByName('oathkeeper-blaster').visible);
 assert.ok(Math.abs(rig.oathkeeper.wings[0].rotation.z)>.1);assert.ok(rig.body.position.y>rig.baseY);assert.ok(rig.arms.find(a=>a.name==='armL').rotation.x<-1);
 for(const leg of rig.legs)assert.ok(leg.position.y>leg.userData.oathkeeperBaseY,'legs hover with the torso');
 model.userData.oathkeeperFlight=0;rig.body.position.y=rig.baseY;animateHeroAttack(rig,1);
 assert.ok(!rig.oathkeeper.blaster.visible);assert.ok(rig.oathkeeper.holster.visible);assert.equal(rig.body.position.y,rig.baseY);
 for(const leg of rig.legs)assert.equal(leg.position.y,leg.userData.oathkeeperBaseY);
});

test('staff beams track live actors, switch gold to blue, and dispose all geometry and materials',()=>{
 const scene=new T.Scene(),source=createPlayableCharacter('oathkeeper'),target=new T.Group(),effects=createClassEffects(scene,{reducedMotion:true});scene.add(source,target);target.position.set(3,0,2);
 effects.syncActors([{id:'source',classId:'oathkeeper'},{id:'target',classId:'ranger'}],id=>id==='source'?source:target,'overworld');
 const data={kind:'support',casterId:'source',targetId:'target',classId:'oathkeeper',x:0,z:0,start:0,until:3,supportMode:'heal'},effect=effects.zone(data),resources=new Set(),disposed=new Set();
 effect.mesh.traverse(n=>{for(const r of [n.geometry,n.material])if(r){resources.add(r);r.addEventListener('dispose',()=>disposed.add(r));}});
 effect.update(data,.2);const beam=effect.mesh.children[0],before=[...beam.geometry.attributes.position.array];assert.ok(before.every(Number.isFinite));assert.ok(beam.geometry.attributes.normal.array.every(Number.isFinite));
 target.position.x=5;effect.update({...data,supportMode:'boost'},.3);assert.notDeepEqual([...beam.geometry.attributes.position.array],before);assert.equal(beam.material.uniforms.color.value.getHex(),0x69cfff);assert.equal(beam.material.uniforms.time.value,0);
 effects.clear();assert.equal(effect.mesh.parent,null);assert.equal(disposed.size,resources.size);assert.equal(effects.lightSources().length,0);
});

test('authoritative flight poses retract when Valkyrie expires or the actor dies or changes maps',()=>{
 for(const reason of ['expiry','death','map']){
  const actor=createPlayableCharacter('oathkeeper'),scene=new T.Scene(),effects=createClassEffects(scene);scene.add(actor);
  const state={id:'a',classId:'oathkeeper',valkyrieTime:6,mapId:'overworld'};effects.syncActors([state],()=>actor,'overworld');assert.equal(actor.userData.oathkeeperFlight,1);
  if(reason==='expiry')state.valkyrieTime=0;if(reason==='death')state.ended=true;if(reason==='map')state.mapId='underways';
  effects.syncActors([state],()=>actor,'overworld');assert.equal(actor.userData.oathkeeperFlight,0);effects.dispose();
 }
});
