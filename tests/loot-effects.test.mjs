import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from '../dist/vendor/three.core.js';
import {createLootVisual} from '../dist/loot-effects.js';
import {VillageLife} from '../dist/world-actors.js';
import {createState} from '../dist/combat.js';
import {createCampaign} from '../dist/campaign.js';

const records=[
 {id:'crowns',kind:'gold',name:'Crowns',rarity:'common',amount:8,x:0,z:0},
 {id:'draught',kind:'potion',name:'Healing draught',rarity:'common',amount:1,x:1,z:0},
 {id:'charm',kind:'item',name:'Warding oak charm',rarity:'uncommon',template:'oak-charm',x:2,z:0},
 {id:'blade',kind:'item',name:'Cindersteel blade',rarity:'rare',template:'cinder-blade',x:3,z:0},
 {id:'relic',kind:'item',name:'Bellkeeper’s Requiem',rarity:'legendary',template:'bellkeeper-edge',x:4,z:0},
];

function trackResources(model){
 const counts=new Map();
 model.traverse(node=>{for(const resource of [node.geometry,node.material])if(resource&&!counts.has(resource)){
  counts.set(resource,0);resource.addEventListener('dispose',()=>counts.set(resource,counts.get(resource)+1));
 }});
 return()=>{assert.ok(counts.size>0);for(const count of counts.values())assert.equal(count,1);};
}

test('all drop types animate without allocating new scene resources and dispose exactly once',()=>{
 const scene=new T.Scene();
 for(const record of records){
  const visual=createLootVisual(record),checkReleased=trackResources(visual.model);
  scene.add(visual.model);const nodes=[];visual.model.traverse(node=>nodes.push(node));
  for(let frame=0;frame<100;frame++)visual.update(frame/60,frame>50);
  const after=[];visual.model.traverse(node=>{
   after.push(node);assert.ok([...node.position,...node.scale].every(Number.isFinite));
   if(node.geometry)assert.ok(Array.from(node.geometry.attributes.position.array).every(Number.isFinite));
  });
  assert.deepEqual(after,nodes);
  visual.dispose();visual.dispose();visual.update(50);checkReleased();
  assert.equal(scene.children.length,0);
 }
});

test('reduced motion freezes every decorative animation while keeping highlighting available',()=>{
 for(const record of records){
  const visual=createLootVisual(record,{reducedMotion:true});
  const snapshot=()=>{
   const values=[];visual.model.traverse(node=>values.push([...node.position,...node.quaternion,node.material?.uniforms?.time?.value]));return values;
  };
  const initial=snapshot();visual.update(120,true);assert.deepEqual(snapshot(),initial);
  assert.equal(visual.model.getObjectByName('loot-halo').material.uniforms.focus.value,1);
  visual.update(121,false);assert.equal(visual.model.getObjectByName('loot-halo').material.uniforms.focus.value,0);
  visual.dispose();
 }
});

test('snapshot collection and local pickup remove every shader layer and label without recreating existing drops',t=>{
 const labels=new Set();
 const previous=globalThis.document;
 globalThis.document={getElementById:()=>({append:label=>labels.add(label)}),createElement:()=>({
  dataset:{},style:{setProperty(){}},name:{textContent:''},
  querySelector(){return this.name;},remove(){labels.delete(this);},
 })};
 t.after(()=>{if(previous===undefined)delete globalThis.document;else globalThis.document=previous;});
 const scene=new T.Scene(),player=new T.Group(),state=Object.assign(createState(),createCampaign(123));
 const life=new VillageLife({scene,camera:new T.OrthographicCamera(),player,state,obstacles:[],cloneModel:()=>new T.Group(),onCollect(){}});
 const initialNodes=scene.children.length,initialLabels=labels.size;
 life.syncLoot(records);const original=life.drops.slice(),checks=original.map(d=>trackResources(d.model));
 life.syncLoot(records);assert.deepEqual(life.drops,original);
 let requested=null;life.requestCollect=id=>{requested=id;return true;};
 life.pickup(life.find('crowns'));assert.equal(requested,'crowns');
 assert.equal(life.drops.length,5); // Remains visible until the authoritative snapshot confirms collection.
 life.syncLoot(records.slice(1));checks[0]();assert.equal(life.find('crowns'),undefined);
 life.requestCollect=null;
 state.potions=5;assert.equal(life.pickup(life.find('draught')).ok,false);assert.ok(life.find('draught'));
 state.potions=2;assert.equal(life.pickup(life.find('draught')).ok,true);assert.equal(state.potions,3);checks[1]();
 assert.equal(life.pickup(life.find('charm')).ok,true);assert.ok(state.inventory.some(item=>item.id==='charm'));checks[2]();
 life.syncLoot([]);checks.forEach(check=>check());
 assert.equal(scene.children.length,initialNodes);assert.equal(labels.size,initialLabels);
});
