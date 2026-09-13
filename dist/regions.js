import {FIRST_LEVEL_CAVES,CAVE_ENTRANCES} from './caves.js';
import {caveSceneryObstacles} from './cave-scenery-layout.js';
const WORLD_BOUNDS={minX:-81,maxX:26,minZ:-27,maxZ:27};
const START={x:-66,z:5};

const bounds={minX:-30,maxX:30,minZ:-30,maxZ:30};
const checkpoint=(mapId,name,x=0,z=23)=>({id:`${mapId}-rest`,mapId,x,z,name,radius:4});
const objective=(id,name,x,z)=>({id,name,x,z,requiresKills:true});
const encounter=(id,type,x,z,objectiveId)=>({id,type,x,z,...(objectiveId?{objectiveId}:{})});
const cluster=(id,x,z,types,objectiveId)=>types.map((type,i)=>encounter(`${id}-${i+1}`,type,x+(i%2)*2,z+Math.floor(i/2)*2,objectiveId));
export const MAPS={
 ...Object.fromEntries(FIRST_LEVEL_CAVES.map(map=>[map.id,map])),
 overworld:{id:'overworld',name:'Hallowmere',bounds:WORLD_BOUNDS,start:START,checkpoint:checkpoint('overworld','Ashwick sanctuary',START.x,START.z),objectives:[],encounters:[],boss:null,caches:[],obstacles:[],hazards:[],tier:0},
 'drowned-wood':{id:'drowned-wood',name:'Drowned Wood',subtitle:'THE SUNKEN SHRINES',tier:1,bounds:{...bounds},start:{x:0,z:23},checkpoint:checkpoint('drowned-wood','Wayfarer’s lantern'),
 objectives:[objective('willow-shrine','Cleanse the Willow Shrine',-17,11),objective('reed-shrine','Cleanse the Reed Shrine',16,0),objective('thorn-shrine','Cleanse the Thorn Shrine',-14,-10)],
 encounters:[...cluster('wood-trail',-4,13,['hunter','rootling','hunter']),...cluster('willow',-19,9,['rootling','hunter','rootling'],'willow-shrine'),...cluster('reed',14,-2,['hunter','rootling','hunter','rootling'],'reed-shrine'),...cluster('thorn',-16,-12,['rootling','hunter','rootling','hunter'],'thorn-shrine'),...cluster('wood-approach',5,-14,['hunter','rootling','hunter'])],
 boss:{id:'rootbound',type:'rootbound',name:'The Rootbound',x:0,z:-22},caches:[],
 obstacles:[{x:-8,z:7,w:3,d:8},{x:8,z:-1,w:3,d:8},{x:-7,z:-12,w:3,d:5},{x:21,z:12,w:4,d:7},{x:-23,z:-4,w:3,d:6}],
 hazards:[{id:'wood-roots',type:'roots',x:6,z:9,radius:2,damage:9,period:6,telegraph:1.6,active:1.1},{id:'wood-roots-deep',type:'roots',x:-2,z:-12,radius:2.4,damage:11,period:7,telegraph:1.6,active:1.1}]},
 'blackvein-quarry':{id:'blackvein-quarry',name:'Blackvein Quarry',subtitle:'THE BROKEN LIFTS',tier:2,bounds:{...bounds},start:{x:0,z:23},checkpoint:checkpoint('blackvein-quarry','Surveyor’s refuge'),
 objectives:[objective('west-lift','Restart the West Lift',-17,6),objective('east-lift','Restart the East Lift',17,-8)],
 encounters:[...cluster('quarry-entry',-3,12,['miner','miner','quarry-mage']),...cluster('west-lift',-19,4,['miner','quarry-mage','miner','quarry-mage'],'west-lift'),...cluster('quarry-cut',5,1,['quarry-mage','miner','miner']),...cluster('east-lift',15,-10,['miner','quarry-mage','miner','quarry-mage'],'east-lift'),...cluster('quarry-seal',-6,-14,['miner','miner','quarry-mage','miner'])],
 boss:{id:'quarry-warden',type:'quarry-warden',name:'The Quarry Warden',x:0,z:-22},caches:[],
 obstacles:[{x:-3,z:-18,w:.7,d:.7},{x:3,z:-18,w:.7,d:.7},{x:-8,z:8,w:3,d:9},{x:8,z:-7,w:3,d:8},{x:-17,z:-8,w:7,d:3},{x:17,z:8,w:7,d:3},{id:'quarry-cover-west',x:-8,z:-19,w:2,d:3,destructible:true,hp:1},{id:'quarry-cover-east',x:8,z:-22,w:2,d:3,destructible:true,hp:1}],
 hazards:[{id:'quarry-fall-west',type:'rockfall',x:-16,z:0,radius:2.4,damage:16,period:7,telegraph:1.8,active:.7},{id:'quarry-fall-east',type:'rockfall',x:11,z:-13,radius:2.6,damage:18,period:6,telegraph:1.8,active:.7}]},
 'crownfall-keep':{id:'crownfall-keep',name:'Crownfall Keep',subtitle:'THE ASHEN THRONE',tier:3,bounds:{...bounds},start:{x:0,z:23},checkpoint:checkpoint('crownfall-keep','Last watchfire'),
 objectives:[objective('west-ward','Break the West Ward',-17,0),objective('east-ward','Break the East Ward',17,-10)],
 encounters:[...cluster('keep-entry',-3,12,['sentinel','pyromancer','sentinel']),...cluster('keep-west',-19,-2,['sentinel','pyromancer','sentinel','pyromancer'],'west-ward'),...cluster('keep-court',4,1,['sentinel','hunter','pyromancer','miner']),...cluster('keep-east',15,-12,['sentinel','pyromancer','sentinel','pyromancer'],'east-ward'),...cluster('keep-throne',-5,-15,['sentinel','pyromancer','miner','hunter'])],
 boss:{id:'ash-regent',type:'ash-regent',name:'The Ash Regent',x:0,z:-23},caches:[],
 obstacles:[{x:-9,z:6,w:3,d:12},{x:9,z:0,w:3,d:12},{x:-20,z:-11,w:8,d:2},{x:20,z:5,w:8,d:2},{x:-9,z:-21,w:2,d:4},{x:9,z:-21,w:2,d:4}],
 hazards:[{id:'keep-fire-west',type:'flame',x:-3,z:4,radius:2.5,damage:20,period:7,telegraph:1.6,active:1.3},{id:'keep-fire-east',type:'flame',x:4,z:-9,radius:2.5,damage:22,period:7,offset:3.5,telegraph:1.6,active:1.3}]},
 underways:{id:'underways',name:'The Underways',subtitle:'BENEATH THE FORSAKEN REACH',tier:1,bounds:{minX:-30,maxX:30,minZ:-18,maxZ:18},start:{x:-25,z:10},checkpoint:null,objectives:[],boss:null,
 encounters:[{id:'cave-willow-elite',type:'rootling',x:-20,z:-6,elite:true,tier:1},...cluster('cave-willow',-25,-3,['hunter','rootling']),{id:'cave-quarry-elite',type:'miner',x:0,z:-7,elite:true,tier:2,requires:'rootbound'},...cluster('cave-quarry',-4,-4,['miner','quarry-mage']).map(e=>({...e,tier:2,requires:'rootbound'})),{id:'cave-crown-elite',type:'sentinel',x:20,z:-7,elite:true,tier:3,requires:'quarry-warden'},...cluster('cave-crown',15,-4,['pyromancer','sentinel']).map(e=>({...e,tier:3,requires:'quarry-warden'}))],
 caches:[{id:'willow-cache',name:'Pilgrim’s cache',x:-23,z:-12,tier:1,requires:null},{id:'quarry-cache',name:'Prospector’s cache',x:0,z:-13,tier:2,requires:'rootbound'},{id:'crown-cache',name:'Royal reliquary',x:23,z:-12,tier:3,requires:'quarry-warden'}],
 obstacles:[...[-10,10].flatMap((x,i)=>[{x,z:-10.5,w:1.6,d:15},{x,z:10.5,w:1.6,d:15},{id:`underways-gate-${i}`,x,z:0,w:1.6,d:6,requires:i?'quarry-warden':'rootbound'}]),{x:-22,z:3,w:3,d:2},{x:1,z:4,w:3,d:2},{x:20,z:3,w:3,d:2}],
 hazards:[{id:'cave-spores',type:'roots',x:-17,z:-2,radius:1.8,damage:12,period:7,telegraph:1.8,active:1},{id:'cave-fall',type:'rockfall',x:4,z:-4,radius:2,damage:17,period:7,telegraph:1.8,active:.8,requires:'rootbound'},{id:'cave-fire',type:'flame',x:17,z:-3,radius:2,damage:22,period:8,telegraph:1.8,active:1,requires:'quarry-warden'}]}
};
// Objective defenses turn exploration into sustained, readable combat encounters.
for(const id of ['drowned-wood','blackvein-quarry','crownfall-keep']){
 const map=MAPS[id],types=id==='drowned-wood'?['hunter','rootling']:id==='blackvein-quarry'?['miner','quarry-mage']:['sentinel','pyromancer'];
 for(const o of map.objectives)o.waves=[
  [{type:types[0],x:o.x-4,z:o.z+3},{type:types[1],x:o.x+3,z:o.z-4},{type:types[0],x:o.x+4,z:o.z+3}],
  [{type:types[1],x:o.x-4,z:o.z-4},{type:types[0],x:o.x+4,z:o.z+4},{type:types[0],x:o.x-4,z:o.z+2},{type:types[1],x:o.x+2,z:o.z-5}]
 ];
}
const pair=(id,mapId,x,z,toMapId,toX,toZ,requires=null,hidden=false,name='Passage')=>[
 {id,mapId,x,z,toMapId,toX,toZ,requires,hidden,name},
 {id:`${id}-return`,mapId:toMapId,x:toX,z:toZ,toMapId:mapId,toX:x,toZ:z,requires,hidden:false,name:`Return to ${MAPS[mapId].name}`}
];
export const PORTALS=[
 ...CAVE_ENTRANCES.flatMap(entrance=>pair(entrance.id,'overworld',entrance.x,entrance.z,entrance.caveId,MAPS[entrance.caveId].start.x,MAPS[entrance.caveId].start.z,null,!!entrance.hidden,entrance.name).map((portal,i)=>({...portal,appearance:i?'cave':entrance.appearance,...(!i&&entrance.buildingId?{buildingId:entrance.buildingId,rotation:entrance.rotation}:{})}))),
 ...pair('wood-road','overworld',23,5,'drowned-wood',0,27,'boss',false,'Road to Drowned Wood'),
 ...pair('quarry-road','drowned-wood',0,-28,'blackvein-quarry',0,27,'rootbound',false,'Road to Blackvein Quarry'),
 ...pair('keep-road','blackvein-quarry',0,-28,'crownfall-keep',0,27,'quarry-warden',false,'Road to Crownfall Keep'),
 ...pair('hallowmere-cave','overworld',22,20,'underways',-26,11,'boss',true,'Moss-veiled fissure'),
 ...pair('wood-cave','drowned-wood',-26,15,'underways',-16,11,'boss',true,'Hollow willow cave'),
 ...pair('quarry-cave','blackvein-quarry',26,15,'underways',0,12,'rootbound',true,'Abandoned mine adit'),
 ...pair('keep-cave','crownfall-keep',26,14,'underways',24,11,'quarry-warden',true,'Forgotten crypt')
];
for(const portal of PORTALS)MAPS[portal.mapId].obstacles.push(...caveSceneryObstacles(portal).map(o=>({...o,caveScenery:true})));
for(const map of Object.values(MAPS))for(const cache of map.caches){cache.mapId=map.id;cache.enemyId??=map.encounters.find(e=>e.elite&&e.tier===cache.tier)?.id;}
export const CHECKPOINTS=Object.values(MAPS).map(m=>m.checkpoint).filter(Boolean);
export const mapFor=id=>MAPS[id]||MAPS.overworld;
export const sameMap=(a,b)=>(a?.mapId||'overworld')===(b?.mapId||'overworld');
export function isMapSanctuary(position){if(!position.mapId||position.mapId==='overworld')return position.x<-57||Math.hypot(position.x+22,position.z-5)<3.4;return CHECKPOINTS.some(c=>sameMap(c,position)&&Math.hypot(c.x-position.x,c.z-position.z)<=c.radius);}
export function availablePortal(portal,progress){if(!portal.requires)return true;if(portal.requires==='boss')return !!(progress?.bossDefeated||progress?.victory||progress?.bellkeeperDefeated);const regions=progress?.regions||progress?.regionProgress||progress;return Object.values(regions||{}).some(r=>r&&typeof r==='object'&&r.bossDefeated&&(r.bossId===portal.requires||MAPS[r.id]?.boss?.id===portal.requires))||Object.values(MAPS).some(m=>m.boss?.id===portal.requires&&regions?.[m.id]?.bossDefeated);}
export function createRegionProgress(){return Object.fromEntries(Object.values(MAPS).filter(m=>m.boss).map(m=>[m.id,{objectives:[],bossSpawned:false,bossDefeated:false}]));}
