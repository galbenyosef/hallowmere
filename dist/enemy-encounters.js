import {ENEMY_TYPES,SPAWNS,distance,pointBlocked,hasLineOfSight} from './combat.js';
import {seededRandom} from './campaign.js';
import {isMapSanctuary} from './regions.js';

const pools={
 village:['hollow','cutthroat','ghoul','hound','revenant','gravecaller'],
 wilds:['hollow','cutthroat','ghoul','hound','revenant','gravecaller','bone-colossus'],
 wood:['hunter','rootling','thorn-ghoul','ghoul','gravecaller'],
 quarry:['miner','quarry-mage','shard-hound','bone-colossus'],
 keep:['sentinel','pyromancer','ash-stalker','shard-hound']
};
function hash(seed,key){let h=seed>>>0;for(const c of key)h=Math.imul(h^c.charCodeAt(0),16777619)>>>0;return h;}
const shuffle=(values,random)=>{const out=[...values];for(let i=out.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[out[i],out[j]]=[out[j],out[i]];}return out;};
export const enemySpawnTiming=(seed,id)=>.7+seededRandom(hash(seed,`timing:${id}`))()*1.8;
function theme(map,spec){
 if(map.id==='crownfall-keep'||spec.requires==='quarry-warden'||spec.tier===3)return 'keep';
 if(map.id==='blackvein-quarry'||spec.requires==='rootbound'||spec.tier===2)return 'quarry';
 if(map.id==='drowned-wood'||map.id==='underways')return 'wood';
 return 'wilds';
}
function position(spec,random,map,obstacles,placed,spread=1.4){
 const radius=ENEMY_TYPES[spec.type]?.modelType==='boss'?.85:.5;
 for(let attempt=0;attempt<18;attempt++){
  const p={x:spec.x+(random()-.5)*spread*2,z:spec.z+(random()-.5)*spread*2,mapId:map.id};
  const b=map.bounds;
  if(b&&(p.x<b.minX+1||p.x>b.maxX-1||p.z<b.minZ+1||p.z>b.maxZ-1))continue;
  if(isMapSanctuary(p)||pointBlocked(p,obstacles,radius)||!hasLineOfSight(spec,p,obstacles,.4)||placed.some(e=>distance(e,p)<1.1))continue;
  return p;
 }
 return {x:spec.x,z:spec.z};
}
// Authored anchors keep objectives, cache guardians, gates and safe routes intact.
// Each seed draws a new roster and loose formation, shared by every player/save.
export function randomizeEncounters(specs,seed,map,obstacles=[],{varyCount=true}={}){
 const groups=new Map(),result=[],lastSignatures=new Map();
 for(const spec of specs){const key=spec.objectiveId||spec.id.replace(/-\d+$/,'');if(!groups.has(key))groups.set(key,[]);groups.get(key).push(spec);}
 const guards=new Set((map.caches||[]).map(c=>c.enemyId));
 for(const [key,group] of groups){
  const random=seededRandom(hash(seed,`${map.id}:${key}`)),pool=pools[theme(map,group[0])];
  let bag=shuffle(pool,random),casterCount=0;
  const flexible=group.filter(e=>e.optional&&!e.elite&&!guards.has(e.id));
  const omitted=varyCount&&flexible.length>1&&random()<.55?flexible[Math.floor(random()*flexible.length)].id:null;
  const chosen=[];
  for(const spec of group){
   if(spec.id===omitted)continue;
   if(ENEMY_TYPES[spec.type].boss||spec.type==='boss'){chosen.push({...spec});continue;}
   if(!bag.length)bag=shuffle(pool,random);
   let index=bag.findIndex(type=>!(casterCount>=1&&ENEMY_TYPES[type].attackStyle==='orb'));
   if(index<0){bag=shuffle(pool.filter(t=>ENEMY_TYPES[t].attackStyle!=='orb'),random);index=0;}
   const type=bag.splice(index,1)[0];if(ENEMY_TYPES[type].attackStyle==='orb')casterCount++;
   chosen.push({...spec,type,...position({...spec,type},random,map,obstacles,[...result,...chosen])});
  }
  const signature=chosen.map(e=>e.type).sort().join(','),previous=lastSignatures.get(pool);
  // Do not repeat the same composition in neighboring packs of the same size.
  if(signature===previous&&chosen.length&&!chosen[0].elite&&!ENEMY_TYPES[chosen[0].type].boss&&chosen[0].type!=='boss'){
   const replacement=pool.filter(t=>!chosen.some(e=>e.type===t)&&ENEMY_TYPES[t].attackStyle!=='orb');
   if(replacement.length)chosen[0].type=replacement[Math.floor(random()*replacement.length)];
  }
  lastSignatures.set(pool,chosen.map(e=>e.type).sort().join(','));result.push(...chosen);
 }
 return result;
}
export function generateVillageEncounters(seed,obstacles=[]){
 const random=seededRandom(hash(seed,'village')),bag=shuffle(pools.village,random),placed=[];
 let casters=2;while(bag.length<SPAWNS.length){const choices=pools.village.filter(t=>casters<3||ENEMY_TYPES[t].attackStyle!=='orb'),type=choices[Math.floor(random()*choices.length)];bag.push(type);if(ENEMY_TYPES[type].attackStyle==='orb')casters++;}
 const roster=shuffle(bag,random);
 for(const [i,[,x,z]] of SPAWNS.entries()){
  const spec={id:`village-${i}`,type:roster[i],x,z};placed.push({...spec,...position(spec,random,{id:'overworld'},obstacles,placed,.95)});
 }
 return placed;
}
export function generateRoadPacks(seed){
 const random=seededRandom(hash(seed,'road')),result=[];let previous='';
 for(let pack=0;pack<3;pack++){
  const count=2+Math.floor(random()*2),center=-51+pack*10+(random()-.5)*2;
  const bag=shuffle(['hollow','cutthroat','ghoul','hound'],random);
  if(pack>0&&random()<.5)bag[count-1]=random()<.5?'revenant':'gravecaller';
  const composition=()=>bag.slice(0,count).sort().join(',');
  if(composition()===previous){const alternatives=['hollow','cutthroat','ghoul','hound'].filter(t=>!bag.slice(0,count).includes(t));bag[0]=alternatives[Math.floor(random()*alternatives.length)];}
  previous=composition();
  const rotation=random()*Math.PI*2;
  for(let i=0;i<count;i++){
   const angle=rotation+i/count*Math.PI*2,radius=1.3+random()*1.3;
   result.push({id:`road-${pack}-${i}`,type:bag[i],x:center+Math.cos(angle)*radius,z:5+Math.sin(angle)*radius,zone:'road'});
  }
 }
 return result;
}
