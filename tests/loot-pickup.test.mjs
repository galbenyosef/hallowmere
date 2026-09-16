import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from '../dist/vendor/three.core.js';
import {VillageLife} from '../dist/world-actors.js';
import {World} from '../dist/world.js';
import {LocalSession} from '../dist/local-session.js';
import {createState} from '../dist/combat.js';
import {createCampaign,LOOT_PICKUP_RANGE} from '../dist/campaign.js';
import {installGlobals} from './helpers/dom.mjs';
import {createPointerTargeting} from '../dist/pointer-targeting.js';
import {createInteraction} from '../dist/interaction.js';
import {bindInput} from '../dist/input-bindings.js';

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

// One stub element per id plus recording window/document targets, so bindInput can register the
// whole region while this test drives only the $('world') pointerdown dispatcher.
function inputHarness(t){
 const nodes=new Map(),handlers={};
 const node=id=>{if(!nodes.has(id))nodes.set(id,{id,dataset:{},style:{},innerHTML:'',
  classList:{add(){},remove(){},toggle(){}},setAttribute(){},removeAttribute(){},focus(){},
  querySelectorAll:()=>[],getBoundingClientRect:()=>({left:0,top:0,width:68,height:68}),
  hasPointerCapture:()=>false,setPointerCapture(){},releasePointerCapture(){},
  addEventListener(type,fn){(handlers[id+':'+type]??=[]).push(fn);}});return nodes.get(id);};
 installGlobals(t,{document:{getElementById:node},
  HTMLInputElement:class{},HTMLTextAreaElement:class{},HTMLSelectElement:class{},HTMLButtonElement:class{}});
 return {handlers,
  windowTarget:{addEventListener(){}},
  documentTarget:{hidden:false,activeElement:null,addEventListener(){},querySelectorAll:()=>[],querySelector:()=>node('map-panel')}};
}

test('ground clicks collect before movement or combat and stop previous movement',t=>{
 const calls=[];
 // pointerAction and collectClickedLoot left main.js in M4 (dist/pointer-targeting.js and
 // dist/interaction.js) and the $('world') pointerdown dispatcher left in M5
 // (dist/input-bindings.js); drive the real factories and the real bindInput on the same ctx
 // instead of vm-slicing their source. getPointerWorld/updatePointer/updateMouseTarget stay test
 // doubles on ctx (as they did as vm globals before M4) since this test never exercises real
 // pointer/camera math.
 const ctx={ready:true,paused:false,backgrounded:false,state:{ended:false},network:{connected:true,send:type=>calls.push([type])},pointer:{},camera:{updateMatrixWorld(){}},
  angle:0,moveTarget:{x:8,z:0},movePath:[{x:8,z:0}],pendingRegionInteraction:'old-region',networkDirection:{x:1,z:0},raycaster:{setFromCamera(){},ray:{intersectPlane(){}}},plane:{},targetWorld:{},
  life:{pending:'old-target',pickLoot:()=>item,interact:id=>{calls.push(['collect',id]);return{ok:true};}},
  pointerShift:false,mouseAction:null,joystickPointer:null,joystickValue:{x:0,y:0},keys:new Set(),
  mapExpanded:false,rosterPicker:{open:false},syncAudioState(){},audio:{play(){}},exploration:{save(){}}};
 Object.assign(ctx,createPointerTargeting(ctx),createInteraction(ctx));
 ctx.updatePointer=()=>{ctx.mouseAction=ctx.pointerAction();};
 ctx.updateMouseTarget=()=>{};
 ctx.awaken=()=>{};
 ctx.perform=action=>calls.push(['ability',action]);
 ctx.toast=()=>assert.fail('Unexpected failure');
 const {handlers,windowTarget,documentTarget}=inputHarness(t);
 Object.assign(ctx,bindInput(ctx,{windowTarget,documentTarget}));
 // bindInput puts the real releaseInput on ctx; this test only needs to see that
 // collectClickedLoot reached it first, exactly as the vm-sliced version did.
 ctx.releaseInput=()=>calls.push(['stop']);
 const pointerdown=event=>{for(const fn of handlers['world:pointerdown'])fn(event);};
 assert.equal(handlers['world:pointerdown'].length,1);
 pointerdown({button:0,preventDefault(){}});
 assert.deepEqual(calls,[['stop'],['collect',item.id]]);assert.equal(ctx.life.pending,null);
 calls.length=0;ctx.paused=true;pointerdown({button:0});assert.deepEqual(calls,[]);
 ctx.paused=false;pointerdown({button:2,preventDefault(){}});assert.deepEqual(calls,[['input'],['ability','bolt']]);
 assert.equal(ctx.moveTarget,null);assert.equal(ctx.movePath.length,0);assert.equal(ctx.pendingRegionInteraction,null);
 assert.equal(ctx.network.input.x,0);assert.equal(ctx.network.input.z,0);
});
