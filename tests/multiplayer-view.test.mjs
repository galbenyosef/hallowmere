import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from '../dist/vendor/three.core.js';
import {createMultiplayerView} from '../dist/multiplayer-view.js';
import {createPlayableCharacter} from '../dist/playable-characters.js';

test('Warden colors use private materials and disconnect cleanup preserves shared geometry and the local actor',()=>{
 const nodes=new Set();globalThis.document={getElementById:()=>({append:n=>nodes.add(n)}),createElement:()=>({style:{},remove(){nodes.delete(this);}})};
 const scene=new T.Scene(),geometry=new T.BoxGeometry(),prefab=new T.Group(),cape=new T.Group();cape.name='cape';cape.add(new T.Mesh(geometry,new T.MeshStandardMaterial({color:0x555555})));prefab.add(cape);
 const cloneModel=()=>{const model=prefab.clone(true);model.traverse(n=>{if(n.material)n.material=n.material.clone();});return model;};
 let geometryDisposals=0;geometry.addEventListener('dispose',()=>geometryDisposals++);
 const player=cloneModel();scene.add(player);const view=createMultiplayerView({scene,camera:new T.PerspectiveCamera(),cloneModel,getRig:()=>({}),animateRig:()=>{},animateHeroAttack:()=>{},player});
 const a={id:'a',slot:0,color:'#55cce6',x:0,z:0},b={id:'b',slot:1,color:'#eda957',x:1,z:1};view.sync([a,b],'a');
 const cloth=model=>model.getObjectByName('cape').children[0].material.color.getHexString();
 assert.equal(cloth(player),'55cce6');assert.equal(cloth(view.actors.get('b').model),'eda957');assert.equal(cloth(prefab),'555555');
 view.sync([a],'a');assert.equal(geometryDisposals,0);assert.equal(nodes.size,1);
 view.sync([{...a,id:'resumed'}],'resumed');assert.equal(player.parent,scene);assert.equal(nodes.size,1);assert.equal(geometryDisposals,0);
 delete globalThis.document;
});

test('remote class changes replace the model and label while preserving location and the local actor',()=>{
 const nodes=new Set();globalThis.document={getElementById:()=>({append:n=>nodes.add(n)}),createElement:()=>({style:{},remove(){nodes.delete(this);}})};
 try{
  const scene=new T.Scene(),player=new T.Group();player.add(createPlayableCharacter('sorcerer','W06'));scene.add(player);
  const cloneModel=id=>id==='C02'?createPlayableCharacter('ranger','C02'):createPlayableCharacter('sorcerer',id);
  const view=createMultiplayerView({scene,camera:new T.PerspectiveCamera(),cloneModel,getRig:model=>({body:model.getObjectByName('body')}),animateRig:()=>{},animateHeroAttack:()=>{},player});
  const a={id:'self',slot:0,color:'#55cce6',classId:'sorcerer',appearanceId:'W06',x:0,z:0},b={id:'ally',slot:1,color:'#eda957',classId:'sorcerer',appearanceId:'W07',x:3,z:4};
  view.sync([a,b],'self');const old=view.actors.get('ally').model;assert.equal(old.userData.characterConcept,'W07');
  view.sync([a,{...b,classId:'ranger',appearanceId:'C02'}],'self');const ally=view.actors.get('ally');assert.equal(ally.model.userData.characterConcept,'C02');assert.equal(old.parent,null);assert.equal(ally.model.position.x,3);assert.equal(ally.model.position.z,4);assert.match(ally.label.textContent,/Ranger/);assert.equal(view.actors.get('self').model,player);assert.equal(nodes.size,2);
  view.sync([a],'self');assert.equal(nodes.size,1);
 }finally{delete globalThis.document;}
});


test('party members on different maps retain party state but hide their actor, ring, and label',()=>{
 globalThis.document={getElementById:()=>({append(){}}),createElement:()=>({style:{},remove(){}})};globalThis.innerWidth=1000;globalThis.innerHeight=700;
 try{
  const scene=new T.Scene(),player=new T.Group();scene.add(player);
  const view=createMultiplayerView({scene,camera:new T.PerspectiveCamera(),cloneModel:()=>new T.Group(),getRig:()=>({}),animateRig(){},animateHeroAttack(){},player});
  const self={id:'self',slot:0,color:'#55cce6',mapId:'drowned-wood',x:0,z:0},ally={id:'ally',slot:1,color:'#eda957',mapId:'overworld',x:1,z:1};
  view.sync([self,ally],'self');view.update(.05,1);const actor=view.actors.get('ally');assert.equal(actor.model.visible,false);assert.equal(actor.ring.visible,false);assert.equal(actor.label.hidden,true);assert.equal(view.actors.size,2);
  view.sync([self,{...ally,mapId:'drowned-wood'}],'self');view.update(.05,1);assert.equal(actor.model.visible,true);assert.equal(actor.ring.visible,true);
 }finally{delete globalThis.document;delete globalThis.innerWidth;delete globalThis.innerHeight;}
});
