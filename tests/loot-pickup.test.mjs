import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import * as T from '../dist/vendor/three.core.js';
import {VillageLife} from '../dist/world-actors.js';
import {World} from '../dist/world.js';
import {LocalSession} from '../dist/local-session.js';
import {createState} from '../dist/combat.js';
import {createCampaign,LOOT_PICKUP_RANGE} from '../dist/campaign.js';
import {sliceBetween,readDist} from './helpers/source.mjs';
import {installGlobals} from './helpers/dom.mjs';

const item={id:'charm',kind:'item',template:'oak-charm',name:'Warding oak charm',rarity:'uncommon',x:10,z:0,mapId:'overworld'};
function fixture(t){
 installGlobals(t,{document:{getElementById:()=>({append(){}}),createElement:()=>({dataset:{},style:{setProperty(){}},querySelector:()=>({}),remove(){}})}});
 const scene=new T.Scene(),player=new T.Group(),state=Object.assign(createState(),createCampaign(17));
 const life=new VillageLife({scene,player,state,camera:new T.OrthographicCamera(),obstacles:[{x:5,z:0,w:1,d:10}],cloneModel:()=>new T.Group(),onApproach(){assert.fail('Loot clicks must never request movement');},onCollect(){}});
 t.after(()=>life.syncLoot([]));
 life.syncLoot([item]);return{scene,player,state,life};
}

test('clicking a distant loot label collects immediately, even across an obstacle',t=>{
 const {life,state,player}=fixture(t),drop=life.find(item.id),before=player.position.clone();
 let prevented=0,stopped=0;
 drop.label.onpointerdown({preventDefault(){prevented++;},stopPropagation(){stopped++;}});
 assert.equal(prevented,1);assert.equal(stopped,1);
 life.pending='old-target';assert.equal(drop.label.onclick().ok,true);
 assert.equal(life.find(item.id),undefined);assert.ok(state.inventory.some(i=>i.id===item.id));
 assert.equal(life.pending,null);assert.deepEqual(player.position,before);
 assert.equal(drop.label.onclick().ok,false);assert.equal(state.lootCollected,1);
});

test('raycasting the item or its halo selects loot while empty ground and remote loot do not',t=>{
 const {life,scene}=fixture(t);scene.updateMatrixWorld(true);
 const ray=new T.Raycaster(new T.Vector3(10,8,0),new T.Vector3(0,-1,0));
 assert.equal(life.pickLoot(ray)?.id,item.id);
 ray.ray.origin.x=10.7;assert.equal(life.pickLoot(ray)?.id,item.id);
 ray.ray.origin.x=13;assert.equal(life.pickLoot(ray),null);
 life.find(item.id).model.position.x=LOOT_PICKUP_RANGE+1;scene.updateMatrixWorld(true);
 ray.ray.origin.x=LOOT_PICKUP_RANGE+1;assert.equal(life.pickLoot(ray),null);
});

test('network pickup sends immediately, throttles repeats, and keeps the item until confirmed',t=>{
 const {life,state}=fixture(t),drop=life.find(item.id),requests=[];
 life.requestCollect=id=>{requests.push(id);return true;};
 assert.equal(drop.label.onclick().pending,true);assert.equal(drop.label.onclick().pending,true);
 assert.deepEqual(requests,[item.id]);assert.ok(life.find(item.id));assert.equal(state.inventory.length,1);
 life.syncLoot([]);assert.equal(life.find(item.id),undefined);
});

test('failed and full-belt pickups stay available without movement or a false pending state',t=>{
 const {life,state}=fixture(t),drop=life.find(item.id);
 life.requestCollect=()=>false;assert.equal(drop.label.onclick().ok,false);assert.equal(drop.requestedAt,undefined);
 state.ended=true;life.requestCollect=()=>assert.fail('Dead characters cannot request loot');assert.equal(drop.label.onclick().ok,false);
 state.ended=false;life.syncLoot([{...item,id:'potion',kind:'potion',amount:1,name:'Healing draught'}]);
 state.potions=5;assert.equal(life.find('potion').label.onclick().reason,'Draught belt is full');assert.ok(life.find('potion'));
 life.requestCollect=null;state.potions=4;assert.equal(life.find('potion').label.onclick().ok,true);assert.equal(state.potions,5);
});

test('authoritative pickup keeps ownership, map, distance, capacity and duplicate checks',()=>{
 const world=new World({seed:17}),p=world.join().player,ally=world.join().player;
 Object.assign(p,{x:0,z:0});Object.assign(ally,{x:0,z:0});p.loot.push({...item});
 const collect=(player,id)=>world.command(player.id,{type:'collect',id,worldId:world.id,seq:player.lastSeq+1});
 assert.equal(collect(ally,item.id),false);assert.equal(collect(p,item.id),true);assert.equal(collect(p,item.id),false);
 assert.equal(p.x,0);assert.equal(p.z,0);assert.equal(ally.state.inventory.length,1);
 p.loot.push({...item,id:'wrong-map',mapId:'underways'},{...item,id:'too-far',x:LOOT_PICKUP_RANGE+1},{...item,id:'potion',kind:'potion',amount:1});
 assert.equal(collect(p,'wrong-map'),false);assert.equal(collect(p,'too-far'),false);
 p.state.potions=5;assert.equal(collect(p,'potion'),false);assert.equal(p.loot.find(d=>d.id==='potion').claimed,undefined);
 assert.equal(world.events.at(-1).reason,'Draught belt is full');
 p.state.potions=4;assert.equal(collect(p,'potion'),true);assert.equal(p.state.potions,5);
});

test('solo collection reaches the inventory in the next snapshot without a simulation step',async t=>{
 let snapshot;const session=new LocalSession({seed:17,onSnapshot:value=>{snapshot=value;}});t.after(()=>session.close());session.start();
 const p=session.world.players.get(session.id),before={x:p.x,z:p.z};
 p.loot.push({...item,x:p.x+8,z:p.z});session.send('collect',{id:item.id});await Promise.resolve();
 assert.ok(snapshot.state.inventory.some(i=>i.id===item.id));assert.equal(snapshot.loot.length,0);assert.deepEqual({x:p.x,z:p.z},before);
});

test('ground clicks collect before movement or combat and stop previous movement',()=>{
 const main=readDist('main.js'),handlers={},calls=[];
 const context={ready:true,paused:false,backgrounded:false,state:{ended:false},network:{connected:true,send:type=>calls.push([type])},pointer:{},camera:{},
  pointerShift:false,mouseAction:null,getPointerWorld(){},angle:0,moveTarget:{x:8,z:0},movePath:[{x:8,z:0}],pendingRegionInteraction:'old-region',networkDirection:{x:1,z:0},
  $:()=>({addEventListener:(name,fn)=>{handlers[name]=fn;},focus(){}}),awaken(){},updatePointer(){context.mouseAction=context.pointerAction();},raycaster:{setFromCamera(){}},
  life:{pending:'old-target',pickLoot:()=>item,interact:id=>{calls.push(['collect',id]);return{ok:true};}},
  releaseInput:()=>calls.push(['stop']),toast:()=>assert.fail('Unexpected failure'),perform:action=>calls.push(['ability',action])};
 vm.createContext(context);
 vm.runInContext(sliceBetween(main,'function pointerAction(','function updateMouseTarget(',{file:'dist/main.js'}),context);
 vm.runInContext(sliceBetween(main,'function collectClickedLoot(','function regionInteractions(',{file:'dist/main.js'}),context);
 vm.runInContext(sliceBetween(main,"$('world').addEventListener('pointerdown'","window.addEventListener('pointerup'",{file:'dist/main.js'}),context);
 handlers.pointerdown({button:0,preventDefault(){}});
 assert.deepEqual(calls,[['stop'],['collect',item.id]]);assert.equal(context.life.pending,null);
 calls.length=0;context.paused=true;handlers.pointerdown({button:0});assert.deepEqual(calls,[]);
 context.paused=false;handlers.pointerdown({button:2,preventDefault(){}});assert.deepEqual(calls,[['input'],['ability','bolt']]);
 assert.equal(context.moveTarget,null);assert.equal(context.movePath.length,0);assert.equal(context.pendingRegionInteraction,null);
 assert.equal(context.network.input.x,0);assert.equal(context.network.input.z,0);
});
