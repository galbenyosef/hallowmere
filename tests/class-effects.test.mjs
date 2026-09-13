import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from '../dist/vendor/three.core.js';
import {createClassEffects,createClassProjectile,createClassZone} from '../dist/class-effects.js';
import {createCombatEffects} from '../dist/combat-effects.js';
import {CLASSES} from '../dist/classes.js';
import {World} from '../server/world.mjs';

const ids=Object.keys(CLASSES).filter(id=>id!=='sorcerer');
const cast=(effects,actor,id,action)=>effects.ability({classId:id,action,x:actor.position.x,z:actor.position.z,angle:0},CLASSES[id].abilities[action],actor);
function assertFinite(root){
 root.updateMatrixWorld(true);root.traverse(n=>{
  assert.ok(n.matrixWorld.elements.every(Number.isFinite),n.name);
  if(n.geometry)for(const attribute of Object.values(n.geometry.attributes))assert.ok([...attribute.array].every(Number.isFinite),n.name);
 });
}

test('every non-sorcerer action produces shader effects and repeated casts release all owned resources once',()=>{
 const scene=new T.Scene(),actor=new T.Group(),effects=createClassEffects(scene);scene.add(actor);
 const resources=new Set(),disposed=new Map();
 function track(){scene.traverse(n=>{for(const r of [n.geometry,n.material])if(r&&!resources.has(r)){resources.add(r);disposed.set(r,0);r.addEventListener('dispose',()=>disposed.set(r,disposed.get(r)+1));}});}
 for(let repeat=0;repeat<3;repeat++)for(const id of ids){
  for(const action of ['attack','bolt','dodge','nova','heal']){
   assert.ok(cast(effects,actor,id,action));track();effects.update(.12);actor.position.x+=.2;assertFinite(scene);
   assert.ok(scene.children.some(root=>root!==actor&&root.children.some(n=>n.material?.isShaderMaterial)),`${id} ${action}`);
  }
  for(const [action,skill] of Object.entries(CLASSES[id].abilities)){
   if(skill.kind==='projectile'){
    const projectile=effects.projectile({classId:id,action,visual:skill.projectile,x:0,z:0,angle:1.1,speed:skill.speed});track();projectile.update(.1);projectile.dispose();projectile.dispose();
   }
   if(skill.kind==='zone'){
    const data={classId:id,radius:skill.radius,start:0,until:skill.duration,x:0,z:0};
    const zone=effects.zone(data);track();zone.update({...data,x:2},.25,.016);assert.equal(zone.mesh.position.x,2);zone.dispose();zone.dispose();
   }
  }
  effects.update(2);assert.equal(scene.children.length,1);
 }
 assert.ok(resources.size>100);assert.ok([...disposed.values()].every(n=>n===1));
 assert.equal(effects.ability({classId:'sorcerer'},CLASSES.sorcerer.abilities.bolt,actor),false);
 effects.dispose();assert.deepEqual(scene.children,[actor]);
});

test('arrows, knives and venom bolts have shadow-casting physical cores and bounded rear-facing shader trails',()=>{
 for(const [classId,visual] of [['ranger','arrow'],['nightblade','knife'],['alchemist','venom']])for(const angle of [0,Math.PI/2,Math.PI,-Math.PI/2]){
  const scene=new T.Scene(),origin=new T.Vector3(7,1.15,-4),direction=new T.Vector3(Math.sin(angle),0,Math.cos(angle));
  const projectile=createClassProjectile(scene,{classId,visual,action:'bolt',x:origin.x,z:origin.z,angle,speed:20});
  const ribbons=projectile.mesh.children.filter(n=>n.name==='flight-ribbon');assert.equal(ribbons.length,2);assert.ok(ribbons.every(n=>n.scale.z===0));
  assert.ok(projectile.mesh.children.some(n=>n.castShadow&&n.receiveShadow&&n.material.isMeshStandardMaterial));
  projectile.update(.03);scene.updateMatrixWorld(true);
  for(const ribbon of ribbons)for(let i=0;i<ribbon.geometry.attributes.position.count;i++){
   const point=new T.Vector3().fromBufferAttribute(ribbon.geometry.attributes.position,i).applyMatrix4(ribbon.matrixWorld).sub(origin);
   assert.ok(point.dot(direction)>=-.600001&&point.dot(direction)<.000001);
  }
  projectile.update(1);assert.ok(ribbons.every(n=>n.scale.z===1));assertFinite(scene);projectile.dispose();assert.equal(scene.children.length,0);
 }
});

test('wards follow their wearer and vanish on break, death, class change, disconnect and map changes',()=>{
 for(const id of ['oathkeeper','geralt','reaver'])for(const end of ['break','death','class','disconnect','map','expiry']){
  const scene=new T.Scene(),actor=new T.Group(),effects=createClassEffects(scene);scene.add(actor);
  const state={id:'hero',classId:id,shield:id==='reaver'?0:40,shieldTime:4,guard:id==='reaver'?.35:0,guardTime:4,mapId:'overworld'};
  const sync=players=>effects.syncActors(players,()=>actor,'overworld');sync([state]);effects.update(.2);
  const ward=scene.children.find(n=>n.name===`${id}-ward`);assert.ok(ward);
  actor.position.set(4,.2,-7);effects.update(.02);assert.deepEqual(ward.position,actor.position);
  if(end==='break'||end==='expiry'){state.shield=0;state.guard=0;state.guardTime=0;}
  if(end==='death')state.ended=true;if(end==='class')state.classId='ranger';if(end==='map')state.mapId='underways';
  sync(end==='disconnect'?[]:[state]);assert.equal(ward.parent,null);assert.equal(effects.lightSources().length,0);effects.dispose();
 }
});

test('zones follow server positions, stay within their lifetime, and reduced motion freezes shader noise',()=>{
 const scene=new T.Scene();
 for(const id of ['reaver','nightblade','oathkeeper','alchemist']){
  const skill=CLASSES[id].abilities.nova,data={classId:id,radius:skill.radius,start:10,until:10+skill.duration,x:3,z:4};
  const zone=createClassZone(scene,data,{reducedMotion:true});
  for(const time of [10.2,11,12]){zone.update({...data,x:time},time,.016);assert.equal(zone.mesh.position.x,time);assertFinite(zone.mesh);zone.mesh.traverse(n=>{if(n.material?.uniforms?.time)assert.equal(n.material.uniforms.time.value,0);});}
  zone.update(data,data.until);assert.equal(zone.light.intensity,0);zone.mesh.traverse(n=>{if(n.material?.uniforms?.opacity)assert.equal(n.material.uniforms.opacity.value,0);});zone.dispose();
 }
 const projectile=createClassProjectile(scene,{classId:'ranger',visual:'arrow',x:0,z:0,angle:0,speed:20},{reducedMotion:true});
 for(let i=0;i<10;i++)projectile.update(.02);
 projectile.mesh.traverse(n=>{if(n.material?.uniforms?.time)assert.equal(n.material.uniforms.time.value,0);});projectile.dispose();
});

test('class casts share the two spell lights and reset safely with active zones, projectiles and wards',()=>{
 const scene=new T.Scene(),actor=new T.Group(),effects=createClassEffects(scene),combat=createCombatEffects(scene,new T.Texture());scene.add(actor);
 for(let i=0;i<80;i++)cast(effects,actor,ids[i%ids.length],'bolt');
 assert.ok(scene.children.filter(n=>n.isGroup).length<=49);
 effects.projectile({classId:'ranger',visual:'arrow',x:0,z:0,angle:0});effects.zone({classId:'alchemist',x:0,z:0,radius:3.7,start:0,until:4}).update({x:0,z:0,start:0,until:4},.5);
 effects.syncActors([{id:'a',classId:'geralt',shield:45,shieldTime:4}],()=>actor,'overworld');
 effects.update(.1);combat.update(.1,effects.lightSources());
 const lights=scene.children.filter(n=>n.isPointLight);assert.equal(lights.length,2);assert.ok(lights.some(l=>l.intensity>0));
 effects.clear();effects.clear();combat.update(.1,effects.lightSources());assert.ok(lights.every(l=>l.intensity===0));
 assert.deepEqual(scene.children.filter(n=>!n.isPointLight),[actor]);combat.dispose();effects.dispose();
});

test('authoritative snapshots identify secondary / volley projectiles and expose ward expiry to other viewers',()=>{
 const world=new World({seed:17}),player=world.join().player,viewer=world.join().player;
 const command=(type,data={})=>world.command(player.id,{type,worldId:world.id,seq:player.lastSeq+1,...data});
 assert.ok(command('select-class',{classId:'ranger'}));
 assert.ok(command('ability',{action:'bolt',angle:0}));assert.ok(command('ability',{action:'nova',angle:0}));
 const shots=world.snapshot(viewer.id).projectiles;
 assert.equal(shots.filter(b=>b.action==='bolt'&&b.classId==='ranger').length,1);assert.equal(shots.filter(b=>b.action==='nova'&&b.classId==='ranger').length,3);
 assert.ok(shots.every(b=>!Object.hasOwn(b,'skill')&&!Object.hasOwn(b,'damage')));
 for(const classId of ['oathkeeper','geralt','reaver']){
  assert.ok(command('select-class',{classId}));player.state.cooldowns.bolt=player.state.cooldowns.nova=0;player.state.mana=100;
  assert.ok(command('ability',{action:classId==='geralt'?'nova':'bolt',angle:0}));
  const state=world.snapshot(viewer.id).players.find(p=>p.id===player.id);
  if(classId==='reaver'){assert.equal(state.guard,CLASSES.reaver.abilities.bolt.guard);assert.equal(state.guardTime,CLASSES.reaver.abilities.bolt.duration);}else{assert.ok(state.shield>0);assert.equal(state.shieldTime,4);}
  for(let i=0;i<90;i++)world.step();
  const expired=world.snapshot(viewer.id).players.find(p=>p.id===player.id);assert.equal(expired.shield,0);assert.equal(expired.guardTime,0);
 }
});
