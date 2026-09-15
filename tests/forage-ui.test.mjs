import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from '../dist/vendor/three.core.js';
import {FOOD_LIST,FORAGE_PATCHES} from '../dist/foraging.js';
import {createForageVisual} from '../dist/forage-visuals.js';
import {createState} from '../dist/combat.js';
import {createCampaign} from '../dist/campaign.js';
import {inventoryMarkup} from '../dist/inventory.js';
import {updateInventoryResources} from '../dist/pouch.js';
import {VillageLife} from '../dist/world-actors.js';
import {installGlobals} from './helpers/dom.mjs';

function trackResources(model){
 const counts=new Map();model.traverse(node=>{for(const r of [node.geometry,node.material])if(r&&!counts.has(r)){counts.set(r,0);r.addEventListener('dispose',()=>counts.set(r,counts.get(r)+1));}});
 return()=>{assert.ok(counts.size);for(const count of counts.values())assert.equal(count,1);};
}
test('plants have finite geometry, stay grounded, respect reduced motion, and release shared resources once',()=>{
 for(const food of FOOD_LIST)for(const reducedMotion of [false,true]){
  const scene=new T.Scene(),visual=createForageVisual(food.id,{reducedMotion}),released=trackResources(visual.model);scene.add(visual.model);
  const nodes=[];visual.model.traverse(node=>nodes.push(node));const initial=visual.model.children[0].rotation.z;
  for(let frame=0;frame<120;frame++)visual.update(frame/60,frame>60);
  const after=[];visual.model.traverse(node=>{after.push(node);assert.ok([...node.position,...node.scale].every(Number.isFinite));if(node.geometry)assert.ok([...node.geometry.attributes.position.array].every(Number.isFinite));});
  assert.deepEqual(after,nodes);assert.equal(visual.model.position.y,0);
  if(reducedMotion)assert.equal(visual.model.children[0].rotation.z,initial);
  visual.dispose();visual.dispose();visual.update(10);released();assert.equal(scene.children.length,0);
 }
});

test('plant labels approach and request harvest, wait for server confirmation, disappear and regrow cleanly',t=>{
 const labels=new Set();
 installGlobals(t,{document:{getElementById:()=>({append:label=>labels.add(label)}),createElement:()=>({dataset:{},style:{setProperty(){}},setAttribute(){},remove(){labels.delete(this);}})}});
 const scene=new T.Scene(),player=new T.Group(),state=createState();let destination,requested;
 const life=new VillageLife({scene,player,state,camera:new T.OrthographicCamera(),obstacles:[],cloneModel:()=>new T.Group(),onApproach:point=>{destination=point;return true;}});
 life.requestForage=id=>{requested=id;return true;};
 const initialNodes=scene.children.length,initialLabels=labels.size,record={...FORAGE_PATCHES[0],x:10,z:0};
 life.syncForage([record]);const patch=life.forage[0],released=trackResources(patch.model);
 life.syncForage([record]);assert.equal(life.forage[0],patch);
 patch.label.onclick();assert.deepEqual(destination,{x:10,z:0});assert.equal(requested,undefined);assert.equal(life.pending,patch.id);
 player.position.x=8;life.update(1);assert.equal(requested,record.id);assert.equal(life.nearest(),patch);assert.equal(life.getState().forage[0].inReach,true);
 assert.equal(life.forage.length,1,'Wait for authoritative removal');
 life.syncForage([]);released();assert.equal(scene.children.length,initialNodes);assert.equal(labels.size,initialLabels);assert.equal(life.find(record.id),undefined);
 life.syncForage([record]);assert.notEqual(life.forage[0],patch);assert.equal(life.forage.length,1);life.syncForage([]);
});

test('pouch has three food tiles below the satchel and live updates preserve gear, focus and scrolling',()=>{
 const state=Object.assign(createState(),createCampaign(42)),markup=inventoryMarkup(state,'starting-sword');
 assert.equal((markup.match(/data-consume=/g)||[]).length,3);assert.ok(markup.indexOf('inventory-pouch')>markup.indexOf('<h3>Satchel'));
 assert.equal((markup.match(/class="inventory-grid"/g)||[]).length,2);assert.match(markup,/5 of each food/);
 assert.doesNotMatch(markup,/pouch-foods|pouch-action|pouch-copy/);
 for(const key of ['hp','mana','maxHp','maxMana','potions','level','forgeLevel'])assert.ok(markup.includes(`data-resource="${key}"`),`Inventory must expose live ${key} updates`);
 // A DOM contract fixture rejects subtree replacement and unknown selectors.
 const node=()=>({textContent:'',attrs:{},setAttribute(k,v){this.attrs[k]=v;},set innerHTML(_){assert.fail('Snapshot replaced a subtree');}});
 const nodes=new Map(),rows=new Map(),previews=new Map();
 for(const food of FOOD_LIST){
  const count=node(),row={...node(),querySelector:selector=>{assert.equal(selector,'[data-food-count]');return count;}};
  nodes.set(`[data-food="${food.id}"]`,row);rows.set(food.id,{row,count});
  const children=new Map(['[data-food-count]','[data-food-status]'].map(key=>[key,node()]));
  nodes.set(`[data-preview-food="${food.id}"]`,{querySelector:selector=>{assert.ok(children.has(selector));return children.get(selector);}});previews.set(food.id,children);
 }
 for(const key of ['hp','mana','maxHp','maxMana','potions','gold','level','forgeLevel'])nodes.set(`[data-resource="${key}"]`,node());
 nodes.set('[data-pouch-regen]',node());
 const focused=rows.get(FOOD_LIST[0].id).row,equipment={selected:'starting-sword'},container={...node(),scrollTop:123,activeElement:focused,equipment,querySelector:s=>{assert.ok(nodes.has(s),s);return nodes.get(s);}};
 updateInventoryResources(container,state);assert.equal(focused.attrs['aria-disabled'],'true');
 state.hp=50;state.mana=20;state.pouch[FOOD_LIST[0].id]=2;updateInventoryResources(container,state);
 assert.equal(focused.attrs['aria-disabled'],'false');assert.equal(nodes.get('[data-resource="hp"]').textContent,'50');
 state.pouch[FOOD_LIST[0].id]=1;state.hp=85;state.foodCooldown=1.3;state.essenceRegen=3.4;updateInventoryResources(container,state);
 assert.equal(rows.get(FOOD_LIST[0].id).count.textContent,'1');assert.equal(previews.get(FOOD_LIST[0].id).get('[data-food-count]').textContent,'1 / 5');assert.match(previews.get(FOOD_LIST[0].id).get('[data-food-status]').textContent,/1.3s/);assert.match(focused.attrs['aria-label'],/1 of 5, Ready in 1.3s/);assert.match(nodes.get('[data-pouch-regen]').textContent,/3.4s left/);
 assert.equal(container.activeElement,focused);assert.equal(container.equipment,equipment);assert.equal(container.equipment.selected,'starting-sword');assert.equal(container.scrollTop,123);
 state.foodCooldown=0;updateInventoryResources(container,state,false);assert.equal(focused.attrs['aria-disabled'],'true');assert.equal(previews.get(FOOD_LIST[0].id).get('[data-food-status]').textContent,'Reconnect to eat.');
});
