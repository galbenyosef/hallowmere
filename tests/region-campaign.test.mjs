import test from 'node:test';
import assert from 'node:assert/strict';
import {World} from '../server/world.mjs';
import {MAPS,PORTALS,CHECKPOINTS} from '../dist/regions.js';
import {ITEM_TEMPLATES,collectLoot,equipItem} from '../dist/campaign.js';
import {refreshGates} from '../server/region-campaign.mjs';
const setup=()=>{const w=new World({seed:17});return{w,p:w.join().player};};
const command=(w,p,type,data={})=>w.command(p.id,{type,worldId:w.id,seq:p.lastSeq+1,...data});
const position=(p,mapId,x,z)=>{Object.assign(p,{mapId,x,z});p.state.mapId=mapId;};
const at=(p,o)=>position(p,o.mapId,o.x,o.z);
const unlock=(w)=>{w.shared.victory=true;refreshGates(w);};

test('surface travel enforces milestones, range and map identity; stale combat cannot cross maps',()=>{
 const {w,p}=setup(),portal=PORTALS.find(o=>o.id==='wood-road');at(p,portal);
 assert.equal(command(w,p,'travel',{id:portal.id}),false);unlock(w);
 p.x-=10;assert.equal(command(w,p,'travel',{id:portal.id}),false);at(p,portal);
 w.hits.push({playerId:p.id,at:w.time+1});w.projectiles.push({ownerId:p.id});w.zones.push({ownerId:p.id});p.input={x:1,z:1};p.dodge=1;
 assert.equal(command(w,p,'travel',{id:portal.id}),true);assert.equal(p.mapId,'drowned-wood');assert.equal(p.z,portal.toZ);
 assert.deepEqual(p.input,{x:0,z:0});assert.equal(p.dodge,0);assert.equal(w.hits.length+w.projectiles.length+w.zones.length,0);
 assert.equal(command(w,p,'travel',{id:portal.id}),false);
 const next=PORTALS.find(o=>o.id==='quarry-road');at(p,next);assert.equal(command(w,p,'travel',{id:next.id}),false);
});

test('secret entrances are discovered by proximity, shared, and never leak unopened cave routes',()=>{
 const {w,p}=setup(),ally=w.join().player,entrance=PORTALS.find(o=>o.id==='hallowmere-cave');unlock(w);
 assert.equal(w.snapshot(p.id).interactions.portals.some(o=>o.id===entrance.id),false);
 at(p,entrance);assert.equal(command(w,p,'travel',{id:entrance.id}),false);w.step();
 assert.ok(w.snapshot(ally.id).state.discoveries.includes(entrance.id));assert.equal(command(w,p,'travel',{id:entrance.id}),true);
 assert.equal(p.mapId,'underways');const quarryExit=PORTALS.find(o=>o.id==='quarry-cave-return');at(p,quarryExit);
 assert.equal(command(w,p,'travel',{id:quarryExit.id}),false);
 assert.equal(w.obstaclesFor(p).find(o=>o.requires==='rootbound').disabled,false);
 w.shared.regionProgress['drowned-wood'].bossDefeated=true;refreshGates(w);
 assert.equal(w.obstaclesFor(p).find(o=>o.requires==='rootbound').disabled,true);
 assert.equal(command(w,p,'travel',{id:quarryExit.id}),true);
});

test('each region requires guardian waves, spawns one boss and advances independently from the original quest',()=>{
 const {w,p}=setup();unlock(w);
 for(const mapId of ['drowned-wood','blackvein-quarry','crownfall-keep']){
  const map=MAPS[mapId];position(p,mapId,map.start.x,map.start.z);
  for(const objective of map.objectives){
   position(p,mapId,objective.x,objective.z);
   assert.equal(command(w,p,'objective',{id:objective.id}),false);
   for(const e of w.enemies.filter(e=>e.hp>0&&e.mapId===mapId&&(e.objectiveId===objective.id||Math.hypot(e.x-objective.x,e.z-objective.z)<7)))w.damageEnemy(e,100000);
   assert.equal(command(w,p,'objective',{id:objective.id}),true);
   assert.equal(w.shared.regionProgress[mapId].objectiveWaves[objective.id],1);
   assert.equal(command(w,p,'objective',{id:objective.id}),false);
   for(let wave=0;wave<objective.waves.length;wave++)for(const e of w.enemies.filter(e=>e.hp>0&&e.waveObjective===objective.id))w.damageEnemy(e,100000);
   assert.equal(command(w,p,'objective',{id:objective.id}),true);
   assert.equal(command(w,p,'objective',{id:objective.id}),false);
  }
  const boss=w.enemies.find(e=>e.id===map.boss.id);assert.ok(boss);assert.equal(w.enemies.filter(e=>e.id===boss.id).length,1);
  w.damageEnemy(boss,100000);const before=p.loot.length;w.damageEnemy(boss,100000);assert.equal(p.loot.length,before);
  assert.equal(w.shared.regionProgress[mapId].bossDefeated,true);
  const template={'drowned-wood':'rootbound-edge','blackvein-quarry':'quarry-edge','crownfall-keep':'regent-edge'}[mapId];
  const drop=p.loot.find(d=>d.template===template);assert.ok(drop);collectLoot(p.state,drop);equipItem(p.state,drop.id);assert.equal(p.state.damageBonus,ITEM_TEMPLATES[template].power);
 }
 assert.equal(w.shared.campaignComplete,true);assert.equal(w.shared.villageKills,0);assert.equal(w.shared.completed,false);
 const late=w.join().player;assert.equal(w.snapshot(late.id).state.campaignComplete,true);assert.equal(late.loot.length,0);
});

test('checkpoints stay personal across death and reconnect; a new vigil resets them',()=>{
 const {w,p}=setup(),ally=w.join().player,checkpoint=CHECKPOINTS.find(c=>c.mapId==='drowned-wood');unlock(w);at(p,checkpoint);
 p.state.hp=1;p.state.potions=0;assert.equal(command(w,p,'checkpoint',{id:checkpoint.id}),true);assert.equal(p.state.hp,p.state.maxHp);assert.equal(p.state.potions,3);
 assert.equal(ally.state.checkpointId,null);position(p,'underways',-20,0);p.state.invulnerable=0;p.state.hp=1;w.damagePlayer(p,100);
 assert.equal(command(w,p,'respawn'),true);assert.equal(p.mapId,checkpoint.mapId);assert.equal(p.x,checkpoint.x);assert.equal(p.z,checkpoint.z);
 p.state.gold=90;w.leave(p.id);assert.equal(w.join(p.token).player,p);assert.equal(p.mapId,checkpoint.mapId);assert.equal(p.state.gold,90);
 w.reset(7);assert.equal(p.mapId,'overworld');assert.equal(p.state.checkpointId,null);assert.deepEqual(p.state.claimedCaches,[]);
});

test('cave caches require guards cleared and give each player exactly one personal reward',()=>{
 const {w,p}=setup(),ally=w.join().player,cache=MAPS.underways.caches[0];unlock(w);at(p,cache);at(ally,cache);
 assert.equal(command(w,p,'cache',{id:cache.id}),false);
 for(const e of w.enemies.filter(e=>e.mapId==='underways'&&e.x<-10))w.damageEnemy(e,100000);
 assert.equal(command(w,p,'cache',{id:cache.id}),true);const gold=p.state.gold;
 assert.equal(command(w,p,'cache',{id:cache.id}),false);assert.equal(p.state.gold,gold);
 assert.equal(command(w,ally,'cache',{id:cache.id}),true);
 assert.notEqual(p.loot.find(d=>d.id.startsWith('cache-')).id,ally.loot.find(d=>d.id.startsWith('cache-')).id);
});

test('snapshots and interactions isolate maps while party positions retain map identity',()=>{
 const {w,p}=setup(),ally=w.join().player;position(p,'drowned-wood',0,10);position(ally,'overworld',0,10);
 const snapshot=w.snapshot(p.id);assert.ok(snapshot.enemies.every(e=>e.mapId==='drowned-wood'));assert.equal(snapshot.forage.length,0);
 assert.equal(snapshot.players.find(a=>a.id===ally.id).mapId,'overworld');
 assert.equal(command(w,p,'service',{npcId:'rowan',action:'accept-quest'}),false);
 const drop={id:'remote',kind:'gold',amount:50,x:p.x,z:p.z,mapId:'overworld'};p.loot.push(drop);assert.equal(command(w,p,'collect',{id:drop.id}),false);
 const e=w.enemies.find(e=>e.mapId==='drowned-wood');w.damageEnemy(e,10000);assert.ok(p.state.souls>0);assert.equal(ally.state.souls,0);
});
