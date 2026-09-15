import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from '../dist/vendor/three.core.js';
import {createMultiplayerView} from '../dist/multiplayer-view.js';
import {createPlayableCharacter} from '../dist/playable-characters.js';
import {installGlobals} from './helpers/dom.mjs';

test('Warden colors use private materials and disconnect cleanup preserves shared geometry and the local actor',t=>{
 const nodes=new Set();installGlobals(t,{document:{getElementById:()=>({append:n=>nodes.add(n)}),createElement:()=>({style:{},remove(){nodes.delete(this);}})}});
 const scene=new T.Scene(),geometry=new T.BoxGeometry(),prefab=new T.Group(),cape=new T.Group();cape.name='cape';cape.add(new T.Mesh(geometry,new T.MeshStandardMaterial({color:0x555555})));prefab.add(cape);
 const cloneModel=()=>{const model=prefab.clone(true);model.traverse(n=>{if(n.material)n.material=n.material.clone();});return model;};
 let geometryDisposals=0;geometry.addEventListener('dispose',()=>geometryDisposals++);
 const player=cloneModel();scene.add(player);const view=createMultiplayerView({scene,camera:new T.PerspectiveCamera(),cloneModel,getRig:()=>({}),animateRig:()=>{},animateHeroAttack:()=>{},player});
 const a={id:'a',slot:0,color:'#55cce6',x:0,z:0},b={id:'b',slot:1,color:'#eda957',x:1,z:1};view.sync([a,b],'a');
 const cloth=model=>model.getObjectByName('cape').children[0].material.color.getHexString();
 assert.equal(cloth(player),'55cce6');assert.equal(cloth(view.actors.get('b').model),'eda957');assert.equal(cloth(prefab),'555555');
 view.sync([a],'a');assert.equal(geometryDisposals,0);assert.equal(nodes.size,1);
 view.sync([{...a,id:'resumed'}],'resumed');assert.equal(player.parent,scene);assert.equal(nodes.size,1);assert.equal(geometryDisposals,0);
});

test('remote class changes replace the model and label while preserving location and the local actor',t=>{
 const nodes=new Set();installGlobals(t,{document:{getElementById:()=>({append:n=>nodes.add(n)}),createElement:()=>({style:{},remove(){nodes.delete(this);}})}});
 const scene=new T.Scene(),player=new T.Group();player.add(createPlayableCharacter('sorcerer','W06'));scene.add(player);
 const cloneModel=id=>id==='C02'?createPlayableCharacter('ranger','C02'):createPlayableCharacter('sorcerer',id);
 const view=createMultiplayerView({scene,camera:new T.PerspectiveCamera(),cloneModel,getRig:model=>({body:model.getObjectByName('body')}),animateRig:()=>{},animateHeroAttack:()=>{},player});
 const a={id:'self',slot:0,color:'#55cce6',classId:'sorcerer',appearanceId:'W06',x:0,z:0},b={id:'ally',slot:1,color:'#eda957',classId:'sorcerer',appearanceId:'W07',x:3,z:4};
 view.sync([a,b],'self');const old=view.actors.get('ally').model;assert.equal(old.userData.characterConcept,'W07');
 view.sync([a,{...b,classId:'ranger',appearanceId:'C02'}],'self');const ally=view.actors.get('ally');assert.equal(ally.model.userData.characterConcept,'C02');assert.equal(old.parent,null);assert.equal(ally.model.position.x,3);assert.equal(ally.model.position.z,4);assert.match(ally.label.textContent,/Ranger/);assert.equal(view.actors.get('self').model,player);assert.equal(nodes.size,2);
 view.sync([a],'self');assert.equal(nodes.size,1);
});


test('party members on different maps retain party state but hide their actor, ring, and label',t=>{
 installGlobals(t,{document:{getElementById:()=>({append(){}}),createElement:()=>({style:{},remove(){}})},innerWidth:1000,innerHeight:700});
 const scene=new T.Scene(),player=new T.Group();scene.add(player);
 const view=createMultiplayerView({scene,camera:new T.PerspectiveCamera(),cloneModel:()=>new T.Group(),getRig:()=>({}),animateRig(){},animateHeroAttack(){},player});
 const self={id:'self',slot:0,color:'#55cce6',mapId:'drowned-wood',x:0,z:0},ally={id:'ally',slot:1,color:'#eda957',mapId:'overworld',x:1,z:1};
 view.sync([self,ally],'self');view.update(.05,1);const actor=view.actors.get('ally');assert.equal(actor.model.visible,false);assert.equal(actor.ring.visible,false);assert.equal(actor.label.hidden,true);assert.equal(view.actors.size,2);
 view.sync([self,{...ally,mapId:'drowned-wood'}],'self');view.update(.05,1);assert.equal(actor.model.visible,true);assert.equal(actor.ring.visible,true);
});

test('teammates keep a constant walking speed across jittered snapshots and stop when updates stall',t=>{
 installGlobals(t,{document:{getElementById:()=>({append(){}}),createElement:()=>({style:{},remove(){}})},innerWidth:1000,innerHeight:700});
 for(const fps of [30,60,144]){
  const scene=new T.Scene(),player=new T.Group(),walks=[];
  const view=createMultiplayerView({scene,camera:new T.PerspectiveCamera(),cloneModel:()=>new T.Group(),getRig:()=>({}),animateRig:(_rig,_t,moving)=>walks.push(moving),animateHeroAttack(){},player});
  const self={id:'self',slot:0,color:'#55cce6',mapId:'overworld',x:0,z:0},ally={...self,id:'ally',slot:1};
  const sync=time=>view.sync([self,{...ally,x:time*4.9,angle:Math.PI/2,moving:true}],'self',time);
  sync(0);const actor=view.actors.get('ally');let next=1,previous=0;
  for(let frame=1;frame<=fps*3;frame++){
   const time=frame/fps;
   while(next<=30&&next*.1+[0,.04,.01,.06][next%4]<=time)sync(next++*.1);
   view.update(1/fps,time);
   if(time>.5){assert.ok(Math.abs(actor.model.position.x-previous-4.9/fps)<1e-8,`uneven step at ${fps} fps, t=${time}`);assert.equal(walks.at(-1),true);}
   previous=actor.model.position.x;
  }
  for(let frame=0;frame<fps;frame++)view.update(1/fps,4);
  assert.equal(walks.at(-1),false);const stopped=actor.model.position.x;view.update(1,5);assert.equal(actor.model.position.x,stopped);
  sync(10);view.update(1/fps,10);assert.equal(actor.model.position.x,49);
 }
});
