import {randomizeEncounters} from './enemy-encounters.js';
import {MAPS,PORTALS,CHECKPOINTS,mapFor,sameMap,availablePortal,createRegionProgress} from './regions.js';
import {distance,hasLineOfSight,pointBlocked} from './combat.js';
import {START} from './campaign.js';
import {insideBuilding} from './buildings.js';

export function initializeRegions(world){
 world.shared.regionProgress=createRegionProgress();world.shared.discoveries=[];world.shared.campaignComplete=false;world.hazards=[];world.regionHazardCycles=new Map();
 world.mapLayouts=Object.fromEntries(Object.values(MAPS).filter(m=>m.id!=='overworld').map(m=>[m.id,{obstacles:(m.obstacles||[]).map(o=>({...o}))}]));
 for(const map of Object.values(MAPS))for(const spec of randomizeEncounters(map.encounters||[],world.seed,map,world.obstaclesFor({mapId:map.id}))){
  const e=world.spawn(spec.type,spec.x,spec.z,map.id,spec.id,map.id);Object.assign(e,{requires:spec.requires,objectiveId:spec.objectiveId,elite:!!spec.elite,optional:!!spec.optional});
  if(spec.elite){e.hp=Math.round(e.hp*1.65);e.maxHp=e.hp;}
 }
 refreshGates(world);
}
export function progressFor(world){return {victory:world.shared.victory,regionProgress:world.shared.regionProgress};}
export function refreshGates(world){
 const progress=progressFor(world);
 for(const layout of Object.values(world.mapLayouts||{}))for(const o of layout.obstacles)if(o.requires)o.disabled=availablePortal(o,progress);
}
function reachable(world,p,object,radius=2.8){return object&&sameMap(p,object)&&distance(p,object)<=radius&&hasLineOfSight(p,object,world.obstaclesFor(p),.08);}
function unlocked(world,object){return availablePortal(object,progressFor(world));}
function insidePortalHouse(world,p,portal){return !portal.buildingId||world.buildings.some(b=>b.id===portal.buildingId&&insideBuilding(b,p));}
export function discoverEntrances(world,p){
 for(const portal of PORTALS)if(portal.hidden&&sameMap(p,portal)&&insidePortalHouse(world,p,portal)&&distance(p,portal)<5.5&&hasLineOfSight(p,portal,world.obstaclesFor(p),.08)&&!world.shared.discoveries.includes(portal.id)){
  world.shared.discoveries.push(portal.id);world.result(p,{ok:true,message:`Hidden passage discovered · ${portal.name}`});
 }
}
export function clearTravelEffects(world,p){
 p.input={x:0,z:0};p.rootUntil=0;p.dodge=0;p.moving=false;p.lastInput=-1;p.state.concealed=0;p.state.boostTime=p.state.damageBoost=p.state.valkyrieTime=0;
 world.hits=world.hits.filter(h=>h.playerId!==p.id);world.projectiles=world.projectiles.filter(b=>b.ownerId!==p.id);world.zones=world.zones.filter(z=>z.ownerId!==p.id);
 for(const e of world.enemies)e.dots=(e.dots||[]).filter(d=>d.ownerId!==p.id);
}
export function returnToCheckpoint(world,p){
 const checkpoint=CHECKPOINTS.find(c=>c.id===p.state.checkpointId);
 const destination=checkpoint||{...START,mapId:'overworld'};
 clearTravelEffects(world,p);Object.assign(p,{x:destination.x,z:destination.z,mapId:destination.mapId});p.state.mapId=p.mapId;
}
export function regionCommand(world,p,message){
 const {type,id}=message,map=mapFor(p.mapId),state=world.shared.regionProgress[p.mapId];
 if(type==='travel'){
  const portal=PORTALS.find(portal=>portal.id===id);
  if(!reachable(world,p,portal)||portal.hidden&&!world.shared.discoveries.includes(id))return false;
  if(!insidePortalHouse(world,p,portal))return false;
  if(!unlocked(world,portal)){world.result(p,{ok:false,reason:'The way is sealed. Defeat the preceding guardian.'});return false;}
  const destination={mapId:portal.toMapId,x:portal.toX,z:portal.toZ},bounds=world.boundsFor(destination);
  if(!MAPS[destination.mapId]||destination.x<bounds.minX||destination.x>bounds.maxX||destination.z<bounds.minZ||destination.z>bounds.maxZ||pointBlocked(destination,world.obstaclesFor(destination),.42))return false;
  clearTravelEffects(world,p);Object.assign(p,destination);p.state.mapId=p.mapId;p.state.zone=p.mapId;p.state.invulnerable=Math.max(p.state.invulnerable,1);
  if(!p.state.visited.includes(p.mapId))p.state.visited.push(p.mapId);
  discoverEntrances(world,p);world.emit('travel',{playerId:p.id,mapId:p.mapId,x:p.x,z:p.z,message:`Entered ${mapFor(p.mapId).name}`});return true;
 }
 if(type==='checkpoint'){
  const checkpoint=CHECKPOINTS.find(c=>c.id===id);if(!reachable(world,p,checkpoint))return false;
  p.state.checkpointId=id;p.state.hp=p.state.maxHp;p.state.mana=p.state.maxMana;p.state.potions=Math.max(3,p.state.potions);
  world.result(p,{ok:true,message:`${checkpoint.name} · Rested and checkpoint set`});return true;
 }
 if(type==='objective'){
  const objective=map.objectives?.find(o=>o.id===id);if(!state||!reachable(world,p,objective&&{...objective,mapId:map.id})||state.objectives.includes(id))return false;
  if(objectiveBlocked(world,map,objective)){world.result(p,{ok:false,reason:'Clear the guardians before using this landmark.'});return false;}
  state.objectiveWaves??={};state.defendingObjectives??=[];
  if(objective.waves?.length&&(state.objectiveWaves[id]||0)<objective.waves.length){
   spawnObjectiveWave(world,map,objective,state);world.result(p,{ok:true,message:`Defend ${objective.name.replace(/^(Cleanse|Restart|Break) the /,'')} · Wave ${state.objectiveWaves[id]} / ${objective.waves.length}`});return true;
  }
  state.objectives.push(id);world.result(p,{ok:true,message:`${objective.name} restored`});
  if(state.objectives.length===map.objectives.length&&!state.bossSpawned){state.bossSpawned=true;const boss=map.boss;world.spawn(boss.type,boss.x,boss.z,map.id,boss.id,map.id);world.emit('region-boss',{mapId:map.id,enemyId:boss.id});}
  return true;
 }
 if(type==='cache'){
  const cache=map.caches?.find(c=>c.id===id);if(!reachable(world,p,cache&&{...cache,mapId:map.id})||p.state.claimedCaches.includes(id)||!unlocked(world,cache)||cacheBlocked(world,map,cache))return false;
  p.state.claimedCaches.push(id);const tier=cache.tier||1,template=['root-charm','quarry-charm','regent-charm'][Math.min(2,tier-1)];
  p.loot.push({id:`cache-${id}-${p.id}`,kind:'item',template,name:['Rootwoven charm','Blackvein talisman','Crownfall seal'][Math.min(2,tier-1)],rarity:'rare',claimed:false,mapId:p.mapId,x:p.x,z:p.z,zone:p.mapId});
  p.state.gold+=25*tier;world.result(p,{ok:true,message:`${cache.name} · ${25*tier} crowns and a charm`});return true;
 }
 return false;
}
function objectiveBlocked(world,map,objective){return world.enemies.some(e=>e.hp>0&&e.mapId===map.id&&(e.objectiveId===objective.id||distance(e,objective)<7));}
function cacheBlocked(world,map,cache){return world.enemies.some(e=>e.hp>0&&e.mapId===map.id&&(e.id===cache.enemyId||distance(e,cache)<7));}
export function regionInteractions(world,p){
 const map=mapFor(p.mapId),state=world.shared.regionProgress[map.id];
 return {
  portals:PORTALS.filter(o=>sameMap(p,o)&&insidePortalHouse(world,p,o)&&(!o.hidden||world.shared.discoveries.includes(o.id))).map(o=>({...o,locked:!unlocked(world,o)})),
  checkpoints:CHECKPOINTS.filter(o=>sameMap(p,o)).map(o=>({...o,active:p.state.checkpointId===o.id})),
  objectives:(map.objectives||[]).map(({waves,...o})=>({...o,completed:!!state?.objectives.includes(o.id),wave:state?.objectiveWaves?.[o.id]||0,waves:waves?.length||0,active:!!state?.objectiveWaves?.[o.id]&&world.enemies.some(e=>e.hp>0&&e.mapId===map.id&&e.waveObjective===o.id),locked:objectiveBlocked(world,map,o)})),
  caches:(map.caches||[]).filter(o=>!p.state.claimedCaches.includes(o.id)).map(o=>({...o,locked:!unlocked(world,o)||cacheBlocked(world,map,o)}))
 };
}
export function regionalKill(world,e){
 const map=mapFor(e.mapId),state=world.shared.regionProgress[map.id];
 if(e.waveObjective&&state){const objective=map.objectives.find(o=>o.id===e.waveObjective);if(objective&&!world.enemies.some(other=>other.hp>0&&other.mapId===map.id&&other.waveObjective===objective.id)){
  if(state.objectiveWaves[objective.id]<objective.waves.length)spawnObjectiveWave(world,map,objective,state);
  else {state.defendingObjectives=(state.defendingObjectives||[]).filter(id=>id!==objective.id);world.emit('objective-ready',{mapId:map.id,message:`Guardians defeated · Return to ${objective.name.replace(/^(Cleanse|Restart|Break) the /,'')}`});}
 }}
 if(state&&e.id===map.boss?.id){state.bossDefeated=true;world.shared.campaignComplete=e.type==='ash-regent'||world.shared.campaignComplete;refreshGates(world);}
}
function spawnObjectiveWave(world,map,objective,state){
 const index=state.objectiveWaves[objective.id]||0;
 state.objectiveWaves[objective.id]=index+1;state.defendingObjectives??=[];if(!state.defendingObjectives.includes(objective.id))state.defendingObjectives.push(objective.id);
 for(const spec of randomizeEncounters(objective.waves[index].map((e,i)=>({...e,id:`${objective.id}-wave-${index+1}-${i}`})),world.seed,map,world.obstaclesFor({mapId:map.id}),{varyCount:false})){
  const enemy=world.spawn(spec.type,spec.x,spec.z,map.id,spec.id,map.id);
  enemy.objectiveId=objective.id;enemy.waveObjective=objective.id;enemy.cooldown=1.8;
 }
}
