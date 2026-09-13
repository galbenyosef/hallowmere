import test from 'node:test';
import assert from 'node:assert/strict';
import {World} from '../dist/world.js';
import {FIRST_LEVEL_CAVES,CAVE_ENTRANCES} from '../dist/caves.js';
import {PORTALS} from '../dist/regions.js';
import {findPath,resolveMove,distance,pointBlocked} from '../dist/combat.js';
import {insideBuilding,buildingWorld} from '../dist/buildings.js';
import {START,regionQuestSummary} from '../dist/campaign.js';
import {discoverEntrances} from '../dist/region-campaign.js';
const command=(w,p,type,id)=>w.command(p.id,{type,id,worldId:w.id,seq:p.lastSeq+1});
const at=(p,o)=>{Object.assign(p,{x:o.x,z:o.z,mapId:o.mapId});p.state.mapId=p.mapId;};
function walk(w,p,goal){
 const path=findPath(p,goal,w.obstaclesFor(p),w.boundsFor(p));assert.ok(path.length);
 for(const point of path){let steps=0;while(distance(p,point)>.03&&steps++<500){const d=distance(p,point),step=Math.min(.12,d);Object.assign(p,resolveMove(p,(point.x-p.x)/d*step,(point.z-p.z)/d*step,w.obstaclesFor(p),.42,w.boundsFor(p)));}assert.ok(distance(p,point)<.04);}
 discoverEntrances(w,p);
}
test('outdoor and house caves have complete round trips from the starting level before its boss',()=>{
 assert.deepEqual(FIRST_LEVEL_CAVES.map(c=>c.encounters.length),[3,6,10,3,4]);
 for(const entrance of CAVE_ENTRANCES){
  const w=new World({seed:17}),p=w.join().player,portal=PORTALS.find(o=>o.id===entrance.id);
  assert.equal(w.snapshot(p.id).interactions.portals.some(o=>o.id===portal.id&&!o.locked),!portal.hidden);
  assert.equal(command(w,p,'travel',portal.id),false);
  walk(w,p,portal);assert.equal(command(w,p,'travel',portal.id),true);
  const map=FIRST_LEVEL_CAVES.find(c=>c.id===p.mapId);assert.ok(map);
  for(const target of [...map.encounters,...map.caches]){assert.equal(pointBlocked(target,w.obstaclesFor(p)),false);walk(w,p,target);}
  const back=PORTALS.find(o=>o.id===`${portal.id}-return`);walk(w,p,back);
  assert.equal(command(w,p,'travel',back.id),true);assert.equal(p.mapId,'overworld');
  assert.equal(pointBlocked(p,w.obstaclesFor(p)),false);walk(w,p,START);
  assert.equal(w.shared.victory,false);assert.equal(w.shared.bossSpawned,false);
 }
});
test('house caves are discovered inside and stay hidden from players outside, including allies',()=>{
 for(const entrance of CAVE_ENTRANCES.filter(e=>e.buildingId)){
 const w=new World({seed:17}),p=w.join().player,ally=w.join().player,portal=PORTALS.find(o=>o.id===entrance.id),house=w.buildings.find(b=>b.id===portal.buildingId);
 assert.equal(house.abandoned,true);
 Object.assign(p,house.exit);discoverEntrances(w,p);
 assert.equal(w.shared.discoveries.includes(portal.id),false);
 Object.assign(p,buildingWorld(house,0,-house.d/2-.5));
 assert.equal(insideBuilding(house,p),false);
 assert.equal(command(w,p,'travel',portal.id),false);
 walk(w,p,portal);assert.equal(insideBuilding(house,p),true);
 assert.ok(w.shared.discoveries.includes(portal.id));
 assert.ok(w.snapshot(p.id).interactions.portals.some(o=>o.id===portal.id));
 Object.assign(ally,house.exit);assert.equal(w.snapshot(ally.id).interactions.portals.some(o=>o.id===portal.id),false);
 assert.equal(command(w,ally,'travel',portal.id),false);
 assert.equal(command(w,p,'travel',portal.id),true);
 assert.equal(command(w,p,'travel',`${portal.id}-return`),true);
 assert.equal(insideBuilding(house,p),true);walk(w,p,house.exit);assert.equal(insideBuilding(house,p),false);
 assert.equal(w.snapshot(p.id).interactions.portals.some(o=>o.id===portal.id),false);
 }
});
test('cave rewards are guarded, personal and single use without advancing village progress',()=>{
 for(const map of FIRST_LEVEL_CAVES){
  const w=new World({seed:17}),p=w.join().player,ally=w.join().player,cache=map.caches[0];at(p,cache);
  assert.equal(command(w,p,'cache',cache.id),false);
  const guard=w.enemies.find(e=>e.id===cache.enemyId);Object.assign(guard,{x:map.start.x,z:map.start.z});
  for(const e of w.enemies.filter(e=>e.mapId===map.id&&e!==guard))w.damageEnemy(e,10000);
  assert.equal(command(w,p,'cache',cache.id),false);w.damageEnemy(guard,10000);
  assert.equal(ally.state.kills,0);assert.equal(w.shared.villageKills,0);assert.equal(w.shared.bossSpawned,false);
  assert.equal(command(w,p,'cache',cache.id),true);const gold=p.state.gold;
  assert.equal(command(w,p,'cache',cache.id),false);assert.equal(p.state.gold,gold);
  at(ally,cache);assert.equal(command(w,ally,'cache',cache.id),true);
  assert.notEqual(p.loot.find(d=>d.id.startsWith('cache-')).id,ally.loot.find(d=>d.id.startsWith('cache-')).id);
 }
});
test('cave combat and snapshots stay on their map; death returns to Ashwick',()=>{
 for(const map of FIRST_LEVEL_CAVES){
  const w=new World({seed:17}),p=w.join().player,ally=w.join().player,e=w.enemies.find(e=>e.mapId===map.id);
  at(p,{...e,x:e.x+.8});p.state.invulnerable=0;const hp=p.state.hp,allyHp=ally.state.hp;
  for(let i=0;i<50;i++)w.step(.05);
  assert.ok(p.state.hp<hp,`${map.name}: enemies must attack`);assert.equal(ally.state.hp,allyHp);
  assert.ok(w.snapshot(p.id).enemies.every(e=>e.mapId===map.id));
  p.state.invulnerable=0;w.damagePlayer(p,10000);assert.equal(command(w,p,'respawn'),true);
  assert.equal(p.mapId,'overworld');assert.equal(p.x,START.x);assert.equal(p.z,START.z);
 }
});

test('caves clearly identify optional exploration and the claimed reward',()=>{
 for(const map of FIRST_LEVEL_CAVES){const state={mapId:map.id,claimedCaches:[]};assert.equal(regionQuestSummary(state).count,'OPTIONAL');state.claimedCaches.push(map.caches[0].id);assert.equal(regionQuestSummary(state).objective,'Cache claimed · Return to Hallowmere');}
});
