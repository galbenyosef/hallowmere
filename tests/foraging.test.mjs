import test from 'node:test';
import assert from 'node:assert/strict';
import {FOOD_LIST,FORAGE_PATCHES,POUCH_CAPACITY,consumeFood,consumeAvailability,harvestFood,advanceForaging} from '../dist/foraging.js';
import {createState,advanceState,hurtPlayer,useAbility,pointBlocked,findPath,distance} from '../dist/combat.js';
import {classFor,applyClass,CLASS_LIST} from '../dist/classes.js';
import {WORLD_BOUNDS,START,zoneAt} from '../dist/campaign.js';
import {insideBuilding} from '../dist/buildings.js';
import {createWorldLayout} from '../dist/world-layout.js';
import {World} from '../server/world.mjs';

const [mushroom,herb,berries]=FOOD_LIST.map(food=>food.id);
const packed=()=>{const state=createState();for(const food of FOOD_LIST)state.pouch[food.id]=5;return state;};
const send=(world,p,type,data={})=>world.command(p.id,{worldId:world.id,seq:p.lastSeq+1,type,...data});
const near=(p,patch)=>Object.assign(p,{x:patch.x,z:patch.z});
const close=(a,b)=>assert.ok(Math.abs(a-b)<1e-8,`${a} ≠ ${b}`);

test('original supplies and outland forage are outdoors and reachable with shared collision',()=>{
 const {buildings,obstacles}=createWorldLayout();
 assert.equal(FORAGE_PATCHES.length,22);assert.equal(new Set(FORAGE_PATCHES.map(p=>p.id)).size,22);
 for(const [zone,count] of [['ashwick',1],['road',3],['hallowmere',2]])assert.equal(FORAGE_PATCHES.filter(p=>p.zone===zone).length,count);
 for(const food of FOOD_LIST)assert.equal(FORAGE_PATCHES.filter(p=>['ashwick','road','hallowmere'].includes(p.zone)&&p.itemId===food.id).length,2);
 for(const patch of FORAGE_PATCHES){
  assert.equal(zoneAt(patch),patch.zone);assert.equal(pointBlocked(patch,obstacles,.5),false,patch.id);
  assert.ok(buildings.every(b=>!insideBuilding(b,patch)&&distance(patch,b.door)>2.8),patch.id);
  assert.ok(findPath(START,patch,obstacles,WORLD_BOUNDS).length,patch.id);
 }
});

test('foods restore current resources, clamp excess, and share a cooldown independent of draughts',()=>{
 const s=packed();s.hp=70;s.mana=10;
 assert.equal(consumeFood(s,mushroom).ok,true);assert.equal(s.hp,105);assert.equal(s.pouch[mushroom],4);
 assert.equal(consumeFood(s,berries).ok,false);assert.equal(s.pouch[berries],5);
 assert.equal(useAbility(s,'heal'),true);assert.equal(s.hp,s.maxHp);assert.equal(s.potions,2);
 advanceForaging(s,2);assert.equal(consumeFood(s,berries).ok,true);assert.equal(s.mana,25);
 advanceForaging(s,2);s.hp=s.maxHp-2;s.mana=s.maxMana-3;
 const result=consumeFood(s,berries);assert.equal(result.health,2);assert.equal(result.essence,3);
 assert.equal(s.hp,s.maxHp);assert.equal(s.mana,s.maxMana);
 assert.equal(s.maxHp,140);assert.equal(s.maxMana,100);
});

test('no food is wasted on empty stacks, full affected resources, dead players, or unknown ids',()=>{
 for(const id of [mushroom,herb,berries,'__proto__','unknown']){
  const s=packed(),before=structuredClone(s);assert.equal(consumeFood(s,id).ok,false);assert.deepEqual(s,before);
  s.hp=1;s.mana=1;s.ended=true;const dead=structuredClone(s);assert.equal(consumeFood(s,id).ok,false);assert.deepEqual(s,dead);
 }
 const s=createState();s.hp=1;s.mana=1;assert.equal(consumeFood(s,mushroom).ok,false);
 for(const missing of ['hp','mana']){const partial=packed();partial[missing]-=1;assert.equal(consumeFood(partial,berries).ok,true);}
});

test('moonleaf adds exactly 40 essence across fractional and oversized ticks and cannot refresh',()=>{
 for(const steps of [[.3,1.1,.9,2.8],[.05,.05,4.9],[9]]){
  const s=packed();s.mana=0;assert.equal(consumeFood(s,herb).ok,true);
  advanceForaging(s,.25);const before=structuredClone(s);assert.equal(consumeFood(s,herb).ok,false);assert.deepEqual(s,before);
  for(const dt of steps)advanceForaging(s,dt);
  close(s.mana,40);assert.equal(s.essenceRegen,0);assert.equal(s.foodCooldown,0);
 }
 const s=packed();s.mana=95;consumeFood(s,herb);advanceForaging(s,1);assert.equal(s.mana,100);
 s.mana=0;advanceForaging(s,10);assert.equal(s.mana,32,'Excess at full essence is discarded');
 for(const character of CLASS_LIST){const base=packed();applyClass(base,character.id);base.mana=0;const boosted=structuredClone(base);consumeFood(boosted,herb);advanceState(base,1);advanceState(boosted,1);close(boosted.mana-base.mana,8);close(base.mana,classFor(base).regen);}
});

test('server harvests privately, regrows at 180 seconds, and rejects range, walls, duplicates and full stacks',()=>{
 const world=new World({seed:42}),a=world.join().player,b=world.join().player,patch=FORAGE_PATCHES[0];world.enemies=[];
 near(a,patch);a.x+=2.81;assert.equal(send(world,a,'forage',{id:patch.id}),false);
 a.x=patch.x+2;world.obstacles.push({x:patch.x+1,z:patch.z,w:.2,d:2});assert.equal(send(world,a,'forage',{id:patch.id}),false);world.obstacles.pop();
 near(a,patch);a.state.pouch[mushroom]=POUCH_CAPACITY;assert.equal(send(world,a,'forage',{id:patch.id}),false);assert.equal(a.forageReadyAt[patch.id],undefined);
 assert.match(world.snapshot(a.id).events.at(-1).reason,/stack is full/);
 a.state.pouch[mushroom]=0;assert.equal(send(world,a,'forage',{id:patch.id}),true);assert.equal(a.state.pouch[mushroom],1);
 const seq=a.lastSeq;assert.equal(world.command(a.id,{type:'forage',id:patch.id,worldId:world.id,seq}),false);
 assert.equal(send(world,a,'forage',{id:patch.id}),false);assert.equal(send(world,a,'forage',{id:'fake'}),false);
 assert.equal(world.snapshot(a.id).forage.length,FORAGE_PATCHES.length-1);assert.equal(world.snapshot(b.id).forage.length,FORAGE_PATCHES.length);
 assert.equal(world.snapshot(b.id).events.some(e=>e.operation==='forage'),false);
 assert.equal(world.snapshot(b.id).players.some(p=>'pouch' in p),false);
 near(b,patch);assert.equal(send(world,b,'forage',{id:patch.id}),true);assert.equal(b.state.pouch[mushroom],1);
 world.time=179.999;assert.equal(world.snapshot(a.id).forage.length,FORAGE_PATCHES.length-1);assert.equal(send(world,a,'forage',{id:patch.id}),false);
 world.time=180;assert.equal(world.snapshot(a.id).forage.length,FORAGE_PATCHES.length);assert.equal(send(world,a,'forage',{id:patch.id}),true);
});

test('food and harvest state survive reconnect and respawn, death clears regen, new vigil resets them',()=>{
 let now=0;const world=new World({seed:12,now:()=>now}),p=world.join().player,patch=FORAGE_PATCHES.find(patch=>patch.itemId===herb);world.enemies=[];
 near(p,patch);send(world,p,'forage',{id:patch.id});p.state.mana=0;
 assert.equal(send(world,p,'consume',{itemId:herb}),true);assert.equal(p.state.pouch[herb],0);
 const ready=p.forageReadyAt[patch.id];world.leave(p.id);const saved=structuredClone(p.state);
 now=30000;world.step(30);assert.deepEqual(p.state,saved);
 assert.equal(send(world,p,'consume',{itemId:herb}),false);
 const resumed=world.join(p.token).player;assert.equal(resumed,p);assert.equal(p.forageReadyAt[patch.id],ready);
 world.step(.5);close(p.state.essenceRegen,4.5);close(p.state.foodCooldown,1.5);assert.ok(p.state.mana>4);
 p.state.pouch[mushroom]=2;hurtPlayer(p.state,999);assert.equal(p.state.essenceRegen,0);assert.equal(p.state.ended,true);
 assert.equal(send(world,p,'consume',{itemId:mushroom}),false);assert.equal(send(world,p,'forage',{id:FORAGE_PATCHES[0].id}),false);
 assert.equal(send(world,p,'respawn'),true);assert.equal(p.state.pouch[mushroom],2);assert.equal(p.forageReadyAt[patch.id],ready);assert.equal(p.state.essenceRegen,0);
 world.reset(13);assert.deepEqual(p.state.pouch,createState().pouch);assert.deepEqual(p.forageReadyAt,{});assert.equal(p.state.foodCooldown,0);assert.equal(world.snapshot(p.id).forage.length,FORAGE_PATCHES.length);
});

test('server consumption keeps pouch ownership and rejects repeated charges',()=>{
 const w=new World({seed:1}),a=w.join().player,b=w.join().player;
 a.state.pouch[mushroom]=2;a.state.hp=20;b.state.hp=20;
 assert.equal(send(w,b,'consume',{itemId:mushroom,playerId:a.id}),false);assert.equal(a.state.pouch[mushroom],2);
 assert.equal(send(w,a,'consume',{itemId:mushroom}),true);assert.equal(a.state.hp,55);
 assert.equal(send(w,a,'consume',{itemId:mushroom}),false);assert.equal(a.state.pouch[mushroom],1);
 assert.equal(w.snapshot(b.id).events.some(e=>e.playerId===a.id&&e.operation==='consume'),false);
});
