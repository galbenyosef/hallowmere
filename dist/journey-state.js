import {World} from './world.js';
import {CLASSES} from './classes.js';
import {ENEMY_TYPES} from './combat.js';
import {MAPS,CHECKPOINTS} from './regions.js';
import {returnToCheckpoint,refreshGates} from './region-campaign.js';
import {setBuildingAccess} from './buildings.js';
import {questSummary,zoneAt} from './campaign.js';

export const JOURNEY_VERSION=1;
const object=value=>value&&typeof value==='object'&&!Array.isArray(value);
const finite=value=>Number.isFinite(value)&&value>=0;

// This is a durable world record, not the current map's renderer snapshot.
export function captureJourney(world,id){
 const p=world.players.get(id);
 if(!p?.state.classId)throw Error('Choose a character before saving.');
 const layouts={overworld:{obstacles:world.obstacles},...world.mapLayouts};
 return structuredClone({version:JOURNEY_VERSION,encounterVersion:1,capturedAt:Date.now(),seed:world.seed,time:world.time,tick:world.tick,
  shared:world.shared,player:{state:p.state,loot:p.loot,forageReadyAt:p.forageReadyAt},
  enemies:world.enemies,brokenCover:Object.fromEntries(Object.entries(layouts).map(([map,layout])=>[map,layout.obstacles.filter(o=>o.destructible&&o.disabled).map(o=>o.id)]))});
}

export function validateJourney(save){
 if(save?.version>JOURNEY_VERSION)throw Error('This journey was saved by a newer game version. Update the game to continue.');
 const s=save?.player?.state;
 if(save?.version!==JOURNEY_VERSION||!Number.isInteger(save.seed)||!finite(save.time)||!finite(save.tick)||
  !object(s)||!Object.hasOwn(CLASSES,s.classId)||!finite(s.level)||s.level<1||!finite(s.maxHp)||s.maxHp<=0||!finite(s.maxMana)||
  !finite(s.hp)||!finite(s.mana)||!finite(s.gold)||!finite(s.souls)||!finite(s.time)||!finite(s.potions)||
  !Object.hasOwn(MAPS,s.mapId)||s.checkpointId&&!CHECKPOINTS.some(c=>c.id===s.checkpointId)||
  !Array.isArray(s.inventory)||!object(s.equipped)||!object(s.cooldowns)||!Array.isArray(s.visited)||!Array.isArray(s.claimedCaches)||
  !object(save.shared)||!object(save.shared.regionProgress)||!Array.isArray(save.shared.discoveries)||
  !Array.isArray(save.player.loot)||!object(save.player.forageReadyAt)||!object(save.brokenCover)||
  !Array.isArray(save.enemies)||save.enemies.some(e=>!e||!Object.hasOwn(ENEMY_TYPES,e.type)||!Object.hasOwn(MAPS,e.mapId)||!finite(e.hp)||!finite(e.maxHp)||!Number.isFinite(e.x)||!Number.isFinite(e.z)||!object(e.home))){
  throw Error('This save could not be read. Your other journeys are safe.');
 }
 return save;
}

export function createJourney(choice){
 const world=new World(),p=world.join().player;
 if(!world.command(p.id,{type:'select-class',...choice,seq:1,worldId:world.id}))throw Error('Choose an available character.');
 return captureJourney(world,p.id);
}

export function restoreJourney(world,id,record){
 const save=structuredClone(validateJourney(record)),p=world.players.get(id);
 world.time=save.time;world.tick=save.tick;world.shared=save.shared;
 Object.assign(p,save.player);
 const roster=new Map(world.enemies.map(e=>[e.id,e]));
 // Upgrade living authored encounters once; slain enemies, rewards and bosses stay intact.
 if(!save.encounterVersion)save.enemies=save.enemies.map(e=>{
  const fresh=roster.get(e.id);
  if(e.hp<=0||!fresh||ENEMY_TYPES[e.type].boss||e.type==='boss')return e;
  return {...e,type:fresh.type,home:{...fresh.home},hp:Math.max(1,Math.round(fresh.maxHp*e.hp/e.maxHp)),maxHp:fresh.maxHp,baseMaxHp:fresh.maxHp,engaged:false};
 });
 world.enemies=save.enemies.map(e=>({...e,x:e.home.x,z:e.home.z,phase:e.hp<=0?'dead':'idle',timer:0,cooldown:1,
  moving:false,path:[],navAt:0,dots:[],rootUntil:0,slow:0,exposedUntil:0,chargeDistance:0}));
 for(const [map,layout] of Object.entries({overworld:{obstacles:world.obstacles},...world.mapLayouts})){
  for(const o of layout.obstacles)if(o.destructible)o.disabled=(save.brokenCover[map]||[]).includes(o.id);
 }
 setBuildingAccess(world.buildings,world.shared.victory);refreshGates(world);
 returnToCheckpoint(world,p);
 // Continuing is a checkpoint return, including after dying. Supplies, cooldowns,
 // rewards and campaign progress survive; transient attacks and buffs do not.
 Object.assign(p.state,{hp:p.state.maxHp,mana:p.state.maxMana,ended:false,shield:0,shieldTime:0,guard:0,guardTime:0,invulnerable:1});
 p.state.zone=p.mapId==='overworld'?zoneAt(p):p.mapId;
 world.events=[];world.eventId=0;
 return p;
}

export function journeySummary(save){
 const s=save.player.state;
 return {classId:s.classId,appearanceId:s.appearanceId,level:s.level,mapId:s.mapId,checkpointId:s.checkpointId,
  playtime:s.time,gold:s.gold,souls:s.souls,kills:s.kills,victory:save.shared.victory,
  campaignComplete:save.shared.campaignComplete,questAccepted:save.shared.questAccepted,
  questRewarded:s.questRewarded,regionProgress:save.shared.regionProgress,
  objective:questSummary({...s,...save.shared,questCompleted:save.shared.completed}).objective};
}
