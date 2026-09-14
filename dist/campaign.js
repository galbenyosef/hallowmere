import {generateRoadPacks} from './enemy-encounters.js';
import {OVERWORLD_BOUNDS,OUTLANDS} from './expansion-layout.js';
import {mapFor,isMapSanctuary} from './regions.js';
import {weaponForClass} from './classes.js';
import {distance} from './combat.js';

export const WORLD_BOUNDS=OVERWORLD_BOUNDS;
export const START={x:-66,z:5};
// Match the furthest distance at which ground loot labels can be shown.
export const LOOT_PICKUP_RANGE=17;
export const VILLAGES=[{id:'ashwick',name:'Ashwick',x:-67,z:5,radius:12},{id:'hallowmere',name:'Hallowmere',x:0,z:0,radius:23}];
export const NPCS=[
 {id:'rowan',name:'Elder Rowan',role:'Keeper of Ashwick',model:'elder',x:-66,z:1,color:0xe8c97d},
 {id:'edda',name:'Sister Edda',role:'Healer',model:'healer',x:-72,z:5,color:0xa9d9be},
 {id:'brann',name:'Brann',role:'Smith & provisions',model:'smith',x:-61,z:3,color:0xe2b084},
 {id:'rook',name:'Watchman Rook',role:'Hallowmere watch',model:'watchman',x:-22,z:5,color:0xcad8a8}
];
export const ITEM_TEMPLATES={
 'wardens-sword':{name:"Warden’s longsword",slot:'weapon',rarity:'common',power:0,description:'A faithful blade, worn by many vigils.'},
 'iron-falchion':{name:'Roadwarden falchion',slot:'weapon',rarity:'uncommon',power:7,description:'A keen edge recovered from the afflicted.'},
 'cinder-blade':{name:'Cindersteel blade',slot:'weapon',rarity:'rare',power:11,description:'Tempered in a fire that never went cold.'},
 'oak-charm':{name:'Warding oak charm',slot:'charm',rarity:'uncommon',power:20,description:'Carved by a traveler who almost made it home.'},
 'rootbound-edge':{name:'Rootbound thorn',slot:'weapon',rarity:'legendary',power:24,description:'A living edge won from the Drowned Wood.'},
 'quarry-edge':{name:'Blackvein cleaver',slot:'weapon',rarity:'legendary',power:30,description:'An unbroken seam of enchanted black iron.'},
 'regent-edge':{name:'Crownfall ember',slot:'weapon',rarity:'legendary',power:36,description:'The last ember of the Ash Regent’s reign.'},
 'root-charm':{name:'Rootwoven charm',slot:'charm',rarity:'rare',power:35,description:'Living roots shelter the bearer.'},
 'quarry-charm':{name:'Blackvein talisman',slot:'charm',rarity:'rare',power:50,description:'A deep-earth ward against a cruel world.'},
 'regent-charm':{name:'Crownfall seal',slot:'charm',rarity:'rare',power:65,description:'The broken kingdom’s enduring protection.'},
 'bellkeeper-edge':{name:'Bellkeeper’s Requiem',slot:'weapon',rarity:'legendary',power:18,description:'The last toll, bound in steel. The Bellkeeper’s unique weapon.'}
};
export function seededRandom(seed){let value=seed>>>0;return()=>{value=(Math.imul(value,1664525)+1013904223)>>>0;return value/4294967296;};}
export function createCampaign(seed){return{seed:seed>>>0,mapId:'overworld',checkpointId:null,claimedCaches:[],gold:0,roadKills:0,villageKills:0,dropSerial:0,collectedIds:[],lootCollected:0,inventory:[{id:'starting-sword',template:'wardens-sword',...ITEM_TEMPLATES['wardens-sword']}],equipped:{weapon:'starting-sword',charm:null},forgeLevel:0,damageBonus:0,healthBonus:0,questAccepted:false,questRewarded:false,talkedTo:[],bossLootClaimed:false,rookSupplies:false,visited:['ashwick'],zone:'ashwick'};}
export function zoneAt(position){if(position.mapId&&position.mapId!=='overworld')return position.mapId;const site=OUTLANDS.find(s=>distance(position,s)<s.radius);if(site)return site.id;if(position.z<-27||position.z>27||position.x<-82||position.x>27)return'outlands';if(position.x<-57)return'ashwick';if(position.x<-24)return'road';return'hallowmere';}
export function zoneName(zone){if(zone==='outlands')return 'The Forsaken Outlands';const site=OUTLANDS.find(s=>s.id===zone);if(site)return site.name;if(!['ashwick','road','hallowmere'].includes(zone))return mapFor(zone).name;return zone==='ashwick'?'Ashwick Village':zone==='road'?'The Mourning Road':'Hallowmere Village';}
export function isSanctuary(position){return isMapSanctuary(position);}
export function generateRoadEncounters(seed){return generateRoadPacks(seed);}
export function rollLoot(state,type,zone){
 if(['rootbound','quarry-warden','ash-regent'].includes(type))return regionalBossLoot(state,type,zone);
 const serial=++state.dropSerial,random=seededRandom(state.seed^Math.imul(serial,2654435761)),drops=[];
 const drop=data=>drops.push({id:`loot-${serial}-${drops.length}`,claimed:false,source:type,zone,...data});
 drop({kind:'gold',name:'Crowns',amount:type==='boss'?60:5+Math.floor(random()*9),rarity:type==='boss'?'rare':'common'});
 if(type==='boss'){
  drop({kind:'item',template:'bellkeeper-edge',name:weaponForClass({template:'bellkeeper-edge',...ITEM_TEMPLATES['bellkeeper-edge']},state).name,rarity:'legendary'});
  drop({kind:'potion',name:'Healing draught',amount:2,rarity:'uncommon'});
  return drops;
 }
 if(random()<.3)drop({kind:'potion',name:'Healing draught',amount:1,rarity:'common'});
 if(serial===1||random()<.28){
  const roll=random(),template=roll<.18?'cinder-blade':roll<.58?'oak-charm':'iron-falchion';
  drop({kind:'item',template,name:weaponForClass({template,...ITEM_TEMPLATES[template]},state).name,rarity:ITEM_TEMPLATES[template].rarity});
 }
 // Keep one third of ordinary drops, preserving the first equipment reward.
 return drops.filter(drop=>(serial===1&&drop.kind==='item')||random()<1/3);
}
export function collectLoot(state,drop){if(drop.claimed||state.collectedIds.includes(drop.id))return{collected:false,reason:'Already collected'};if(drop.kind==='potion'&&state.potions>=5)return{collected:false,reason:'Draught belt is full'};if(drop.kind==='gold')state.gold+=drop.amount;else if(drop.kind==='potion')state.potions=Math.min(5,state.potions+drop.amount);else if(drop.kind==='item'){state.inventory.push(weaponForClass({id:drop.id,template:drop.template,...ITEM_TEMPLATES[drop.template]},state));if(drop.template==='bellkeeper-edge')state.bossLootClaimed=true;}else return{collected:false,reason:'Unknown loot'};drop.claimed=true;state.collectedIds.push(drop.id);state.lootCollected++;return{collected:true,name:drop.name,kind:drop.kind};}
export function equipItem(state,id){const item=state.inventory.find(item=>item.id===id);if(!item)return{ok:false,reason:'You do not own that item.'};state.equipped[item.slot]=item.id;const weapon=state.inventory.find(i=>i.id===state.equipped.weapon),charm=state.inventory.find(i=>i.id===state.equipped.charm);state.damageBonus=(weapon?.power??0)+state.forgeLevel*4;state.healthBonus=charm?.power??0;state.maxHp=(state.baseHp||140)+(state.level-1)*15+state.healthBonus;state.hp=Math.min(state.hp,state.maxHp);return{ok:true,item:item.name,damageBonus:state.damageBonus,maxHp:state.maxHp};}
export function npcDialogue(state,id){const npc=NPCS.find(n=>n.id===id);if(!npc)return null;let text='',choices=[];
 if(id==='rowan'){if(state.victory&&state.bossLootClaimed&&!state.questRewarded){text='No bell. Only the wind. You have brought peace to Hallowmere, traveler. Take this with the thanks of both villages.';choices=[{action:'claim-reward',response:'Claim quest reward',detail:'The Last Toll · Quest complete',priceLabel:'+80 crowns',label:'Claim quest reward · 80 crowns'}];}else if(state.questRewarded){text='The road is ours again. You will always find a warm hearth in Ashwick.';}else if(!state.questAccepted){text='Hallowmere’s bell has rung for thirteen years. The afflicted haunt the road between our villages. Follow the old stones east, speak to Watchman Rook, then cleanse the village and silence the Bellkeeper.';choices=[{action:'accept-quest',response:'Accept quest',detail:'Accept quest · The Last Toll',label:'Accept quest · The Last Toll'}];}else{text='The Mourning Road runs east. Rook waits at Hallowmere’s gate. Clear the twelve afflicted inside the village; the Bellkeeper will answer. Bring his relic back to us.';}}
 if(id==='edda'){text='The lanterns keep the afflicted outside our ward. Rest here. I can mend your wounds and refill your draughts before you return to the road.';choices=[{action:'rest',response:'Rest and restore supplies',detail:'Restore vitality, essence, and draughts',priceLabel:'Free',label:'Rest and replenish · Free'}];}
 if(id==='brann'){text='A good weapon earns its keep on that road. Bring me crowns from the afflicted and I’ll improve your equipment. Any weapon you equip keeps my work.';choices=[{action:'forge',response:state.forgeLevel>=3?'Weapon fully upgraded':'Upgrade weapon',detail:'+4 damage · Permanent upgrade',cost:state.forgeLevel>=3?undefined:30*(state.forgeLevel+1),disabledReason:state.forgeLevel>=3?'+12 damage · Maximum upgrade':state.gold<30*(state.forgeLevel+1)?`Need ${30*(state.forgeLevel+1)-state.gold} more crowns · +4 damage`:'',label:state.forgeLevel>=3?'Weapon fully upgraded':`Upgrade weapon · +4 damage · ${30*(state.forgeLevel+1)} crowns`,disabled:state.forgeLevel>=3||state.gold<30*(state.forgeLevel+1)},{action:'buy-potion',response:'Buy healing potion',detail:'+1 draught · Healing supplies',cost:12,disabledReason:state.potions>=5?'Draught belt is full':state.gold<12?`Need ${12-state.gold} more crowns`:'',label:'Buy healing potion · 12 crowns',disabled:state.gold<12||state.potions>=5}];}
 if(id==='rook'){text=state.victory?'The Bellkeeper is gone. I can hear birds beyond the graves. Take your spoils back to Rowan; he will want to know.':'Ashwick is behind you. Hallowmere lies ahead. Twelve afflicted still prowl its lanes. When the last falls, the Bellkeeper will leave his chapel. Watch the red marks on the ground; move before he strikes.';if(!state.rookSupplies)choices.push({action:'take-supplies',response:'Take healing potions',detail:`+${Math.min(2,Math.max(0,5-state.potions))} draught${state.potions===4?'':'s'}`,priceLabel:'Free',disabledReason:state.potions>=5?'Draught belt is full':'',label:'Take Rook’s supplies · 2 draughts',disabled:state.potions>=5});if(!state.questAccepted)choices.push({action:'accept-quest',response:'Accept quest',detail:'Accept quest · The Last Toll',label:'Accept quest · The Last Toll'});}
 return{...npc,text,choices};}
export function performNpcAction(state,npcId,action){const dialogue=npcDialogue(state,npcId),choice=dialogue?.choices.find(c=>c.action===action);if(!choice||choice.disabled)return{ok:false,reason:'That service is unavailable.'};if(action==='accept-quest'){state.questAccepted=true;return{ok:true,message:'Quest accepted · The Last Toll'};}if(action==='rest'){state.hp=state.maxHp;state.mana=state.maxMana;state.potions=Math.max(state.potions,3);return{ok:true,message:'Vitality restored · Draughts replenished'};}if(action==='forge'){const cost=30*(state.forgeLevel+1);if(state.gold<cost||state.forgeLevel>=3)return{ok:false,reason:'Not enough crowns.'};state.gold-=cost;state.forgeLevel++;equipItem(state,state.equipped.weapon);return{ok:true,message:'Weapon honed · +4 damage'};}if(action==='buy-potion'){if(state.gold<12||state.potions>=5)return{ok:false,reason:'Cannot buy another draught.'};state.gold-=12;state.potions++;return{ok:true,message:'Healing draught purchased'};}if(action==='take-supplies'){state.rookSupplies=true;state.potions=Math.min(5,state.potions+2);return{ok:true,message:'Rook shared two healing draughts'};}if(action==='claim-reward'){state.gold+=80;state.questRewarded=true;return{ok:true,message:'The Last Toll completed · 80 crowns'};}return{ok:false,reason:'Unknown service.'};}
export function questSummary(state){if(state.mapId&&state.mapId!=='overworld')return regionQuestSummary(state);if(state.questRewarded)return{title:'A silence well earned',objective:'The Last Toll completed',count:'✓',hint:state.campaignComplete?'Crownfall is free. Explore the Underways and return home.':'The eastern passage leads to the Drowned Wood.'};if(state.victory)return{title:'The Last Toll',objective:state.bossLootClaimed?'Return to Elder Rowan':'Claim the Bellkeeper’s loot',count:state.bossLootClaimed?'ASHWICK':'F',hint:state.bossLootClaimed?'Rowan awaits you in Ashwick.':'The golden beam marks his unique weapon.'};if(state.bossSpawned)return{title:'The Last Toll',objective:'Defeat the Bellkeeper',count:'0 / 1',hint:'Evade his red attack zones. Claim his spoils.'};if(!state.questAccepted)return{title:'The Last Toll',objective:'Speak to Elder Rowan',count:'F',hint:'The elder waits beside Ashwick’s square.'};if(!state.visited.includes('hallowmere'))return{title:'The Last Toll',objective:'Follow the road to Hallowmere',count:'EAST',hint:'Random packs stalk the Mourning Road.'};return{title:'The Last Toll',objective:'Cleanse Hallowmere',count:`${state.villageKills} / 12`,hint:'Defeat the afflicted to summon the Bellkeeper.'};}

function regionalBossLoot(state,type,zone){
 const tier=['rootbound','quarry-warden','ash-regent'].indexOf(type),serial=++state.dropSerial,template=['rootbound-edge','quarry-edge','regent-edge'][tier],charm=['root-charm','quarry-charm','regent-charm'][tier];
 return [{kind:'gold',name:'Crowns',amount:85+tier*30,rarity:'rare'},{kind:'item',template,name:weaponForClass({template,...ITEM_TEMPLATES[template]},state).name,rarity:'legendary'},{kind:'item',template:charm,name:ITEM_TEMPLATES[charm].name,rarity:'rare'},{kind:'potion',name:'Healing draught',amount:2,rarity:'uncommon'}].map((d,i)=>({id:`loot-${serial}-${i}`,claimed:false,source:type,zone,...d}));
}
export function regionQuestSummary(state){
 const map=mapFor(state.mapId),progress=state.regionProgress?.[map.id];
 if(map.theme==='cave'){const found=map.caches.filter(c=>state.claimedCaches?.includes(c.id)).length,claimed=found===map.caches.length;return{title:map.name,objective:claimed?'Caches claimed · Return to Hallowmere':`Explore the tunnels · ${found} / ${map.caches.length} caches`,count:claimed?'✓':'OPTIONAL',hint:claimed?'Use the entrance to return to the surface.':'Explore the forgotten passages beyond the watchfires. Defeat each cache’s guardians to claim its treasure.'};}
 if(map.id==='underways')return{title:'The Underways',objective:'Explore the hidden passages',count:'EXPLORE',hint:'Defeat cave guardians for treasure. Sealed routes open as surface bosses fall.'};
 if(!progress)return{title:map.name,objective:'Explore the region',count:'',hint:'Follow the marked landmarks.'};
 if(progress.bossDefeated)return{title:map.name,objective:state.campaignComplete?'The Ash Regent has fallen':'Passage to the next region opened',count:'✓',hint:state.campaignComplete?'Claim your spoils. The roads and Underways remain open.':'Claim the guardian’s weapon and continue through the northern passage.'};
 if(progress.bossSpawned)return{title:map.name,objective:`Defeat ${map.boss.name||({'rootbound':'the Rootbound','quarry-warden':'the Quarry Warden','ash-regent':'the Ash Regent'}[map.boss.type])}`,count:'0 / 1',hint:'Watch the ground warnings. Strike during recovery.'};
 if(progress.defendingObjectives?.length){const id=progress.defendingObjectives[0],objective=map.objectives.find(o=>o.id===id);return{title:map.name,objective:`Defend ${objective.name.replace(/^(Cleanse|Restart|Break) the /,'')}`,count:`WAVE ${progress.objectiveWaves[id]} / ${objective.waves.length}`,hint:'Defeat the attackers, then interact with the landmark.'};}
 const next=map.objectives.find(o=>!progress.objectives.includes(o.id));
 return{title:map.name,objective:next?.name||'Restore the landmarks',count:`${progress.objectives.length} / ${map.objectives.length}`,hint:'Clear each landmark’s guardians, then interact with it.'};
}
