import test from 'node:test';
import assert from 'node:assert/strict';
import {ENEMY_TYPES,createState,SPAWNS,levelForSouls,awardKill} from '../dist/combat.js';
import {generateRoadEncounters} from '../dist/campaign.js';
import {MAPS} from '../dist/regions.js';
import {applyClass,CLASS_LIST} from '../dist/classes.js';
import {updateRegionEnemy,stepRegionHazards} from '../server/region-combat.mjs';
import {hitEnemy,castClassAbility,resolveClassHits,advanceClassEffects} from '../server/class-combat.mjs';
function fixture(type='rootbound'){
 const e={id:'enemy',type,mapId:'drowned-wood',x:0,z:0,home:{x:0,z:0},hp:ENEMY_TYPES[type].hp,maxHp:ENEMY_TYPES[type].hp,angle:0,cooldown:0,phase:'idle'};
 const p={id:'p',mapId:e.mapId,x:0,z:4,connected:true,input:{x:0,z:0},state:{...createState(),damageBonus:0}};
 const w={time:0,enemies:[e],players:new Map([[p.id,p]]),hazards:[],projectiles:[],zones:[],hits:[],obstacles:[],connected(){return [...this.players.values()]},emit(){},result(){},seek(){},move(e,x,z){e.x+=x;e.z+=z;},damagePlayer(p,n){p.state.hp-=n;},damageEnemy(e,n){e.hp-=n;}};
 return {w,e,p};
}
test('boss telegraphs precede damage, expose recovery and reset after participants leave',()=>{
 const {w,e,p}=fixture();updateRegionEnemy(w,e,[p],.05);assert.equal(e.phase,'windup');assert.ok(w.hazards.length);stepRegionHazards(w,.05);assert.equal(p.state.hp,140);
 w.time=1.5;updateRegionEnemy(w,e,[p],1.5);stepRegionHazards(w,1.5);assert.equal(p.state.hp,114);assert.ok(e.exposedUntil>w.time);assert.ok(p.rootUntil>w.time);
 e.hp=10;p.mapId='overworld';updateRegionEnemy(w,e,[p],.05);assert.equal(e.hp,ENEMY_TYPES.rootbound.hp);assert.equal(w.hazards.filter(h=>h.ownerId===e.id).length,0);assert.equal(e.engaged,false);
});
test('health scales only for nearby same-map teammates once per engagement',()=>{
 const {w,e,p}=fixture('miner'),ally={...p,id:'ally',state:{...p.state}},remote={...ally,id:'remote',mapId:'underways'};
 updateRegionEnemy(w,e,[p,ally,remote],.05);assert.equal(e.maxHp,Math.round(175*1.45));
 updateRegionEnemy(w,e,[p],.05);assert.equal(e.maxHp,Math.round(175*1.45));
});
test('regent phases add flame lanes with traversable gaps',()=>{
 const {w,e,p}=fixture('ash-regent');e.hp=ENEMY_TYPES[e.type].hp*.25;updateRegionEnemy(w,e,[p],.05);
 assert.equal(e.bossStage,3);const flames=w.hazards.filter(h=>h.kind==='flame');assert.equal(flames.length,3);assert.ok(flames.every(h=>h.w<4));
});
test('hazards respect map identity, walls, sanctuary, and one hit per player',()=>{
 const {w,e,p}=fixture();updateRegionEnemy(w,e,[p],.05);w.time=1.5;p.mapId='underways';stepRegionHazards(w,.05);assert.equal(p.state.hp,140);
 p.mapId=e.mapId;w.obstacles=[{x:0,z:4,w:2,d:2}];stepRegionHazards(w,.05);assert.equal(p.state.hp,140);
 w.obstacles=[];stepRegionHazards(w,.05);const after=p.state.hp;stepRegionHazards(w,.05);assert.equal(p.state.hp,after);assert.ok(after<140);
});
test('sentinel shield rewards flanking and magic',()=>{
 const {w,e,p}=fixture('sentinel');hitEnemy(w,p,e,{},100);assert.equal(e.hp,190);
 p.z=-4;hitEnemy(w,p,e,{},100);assert.equal(e.hp,90);p.z=4;hitEnemy(w,p,e,{magic:true},50);assert.equal(e.hp,40);
});
test('all six classes keep pending attacks, zones, and dots on their originating map',()=>{
 for(const {id:classId} of CLASS_LIST){
  const {w,e,p}=fixture();assert.ok(applyClass(p.state,classId,classId==='sorcerer'?'C01':undefined));p.z=-1;
  castClassAbility(w,p,{action:'attack',angle:0});assert.ok([...w.hits,...w.projectiles].every(h=>h.mapId===p.mapId));
  const hp=e.hp;p.mapId='underways';w.time=1;resolveClassHits(w);hitEnemy(w,p,e,{damage:20},20);assert.equal(e.hp,hp);
  e.dots=[{ownerId:p.id,mapId:e.mapId,type:'poison',next:0,until:5,interval:1,damage:50}];
  w.zones=[{ownerId:p.id,mapId:e.mapId,until:5,next:0,skill:{radius:10,damage:20,interval:1}}];advanceClassEffects(w);assert.equal(e.hp,hp);assert.equal(w.zones.length,0);
 }
});

test('environmental hazards schedule only active unlocked maps without inactive backlog',()=>{
 const {w,p}=fixture();p.mapId='overworld';w.time=100;stepRegionHazards(w,.05);assert.equal(w.hazards.length,0);
 p.mapId='drowned-wood';stepRegionHazards(w,.05);assert.equal(w.hazards.length,0);
 w.time=108;stepRegionHazards(w,.05);assert.ok(w.hazards.some(h=>h.environmental));assert.ok(w.hazards.every(h=>h.mapId==='drowned-wood'&&h.activateAt>w.time));
});

test('locked cave enemies read authoritative shared regional progress',()=>{
 const {w,e,p}=fixture('miner');e.requires='rootbound';w.shared={victory:true,regionProgress:{}};
 updateRegionEnemy(w,e,[p],.05);assert.equal(e.engaged,undefined);
 w.shared.regionProgress['drowned-wood']={bossDefeated:true};updateRegionEnemy(w,e,[p],.05);assert.equal(e.engaged,true);
});

test('warden charges break cover and arena reset restores it',()=>{
 const {w,e,p}=fixture('quarry-warden');w.obstacles=[{id:'cover',x:0,z:2,w:1,d:1,destructible:true}];
 // Start the charge on an unobstructed route, then place cover in its telegraphed lane.
 const cover=w.obstacles[0];w.obstacles=[];updateRegionEnemy(w,e,[p],.05);w.obstacles=[cover];w.time=2;updateRegionEnemy(w,e,[p],2);assert.equal(cover.disabled,true);
 p.mapId='overworld';updateRegionEnemy(w,e,[p],.05);assert.equal(cover.disabled,false);
});

test('six-class primary attack boss pacing survives cumulative main-route XP and forged gear',()=>{
 const progression=createState();
 for(const e of [...SPAWNS.map(s=>({type:s[0]})),...generateRoadEncounters(17),{type:'boss'}])awardKill(progression,e.type);
 for(const [i,id] of ['drowned-wood','blackvein-quarry','crownfall-keep'].entries()){
  const map=MAPS[id],roster=[...map.encounters,...map.objectives.flatMap(o=>o.waves.flat())];
  for(const e of roster)awardKill(progression,e.type);
  const level=progression.level,bonus=[30,36,42][i];
  for(const c of CLASS_LIST){
   const skill=c.abilities.attack,hits=skill.hits||1,damage=(skill.damage+level*2+bonus)*hits;
   // Stationary primary-only baseline; real dodges, abilities and backstabs change this.
   const seconds=Math.ceil(ENEMY_TYPES[map.boss.type].hp/damage)*skill.cooldown;
   assert.ok(seconds>=8&&seconds<=90,`${c.id} ${id}: ${seconds}s at level ${level}`);
   const {w,e,p}=fixture(map.boss.type);applyClass(p.state,c.id,c.id==='sorcerer'?'C01':undefined);
   p.x=0;p.z=4;updateRegionEnemy(w,e,[p],.05);
   const warning=w.hazards[0];assert.ok(warning.activateAt>=1.4);
   // Every calling can walk clear of a targeted root circle before it erupts.
   if(warning.kind==='roots'){p.x+=c.speed*warning.activateAt;w.time=warning.activateAt;const before=p.state.hp;stepRegionHazards(w,.05);assert.equal(p.state.hp,before);}
  }
  awardKill(progression,map.boss.type);
 }
});

test('level growth preserves the original first eight levels and widens expansion XP bands',()=>{
 for(let souls=0;souls<800;souls++)assert.equal(levelForSouls(souls),1+Math.floor(souls/100));
 for(const [souls,level] of [[800,9],[949,9],[950,10],[1149,10],[1150,11],[1399,11],[1400,12],[1700,13],[2050,14],[2450,15],[2900,16]])assert.equal(levelForSouls(souls),level);
 let threshold=700;for(let level=8;level<100;level++){assert.equal(levelForSouls(threshold),level);assert.equal(levelForSouls(threshold-1),level-1);threshold+=100+(level-8)*50;}
 assert.equal(levelForSouls(-1),1);assert.equal(levelForSouls(NaN),1);
 const state=createState();for(let i=0;i<10;i++)awardKill(state,'hollow');assert.equal(state.level,2);assert.equal(state.souls,180);
});

test('roots interrupt queued enemy charges and concealment does not freeze a committed attack',()=>{
 const {w,e,p}=fixture('miner');updateRegionEnemy(w,e,[p],.05);assert.ok(e.chargeDistance>0);
 hitEnemy(w,p,e,{root:1},1);assert.equal(e.chargeDistance,0);assert.equal(w.hazards.filter(h=>h.ownerId===e.id).length,0);
 e.phase='idle';e.rootUntil=0;e.cooldown=0;updateRegionEnemy(w,e,[p],.05);p.state.concealed=1;w.time=2;updateRegionEnemy(w,e,[p],2);
 assert.equal(e.phase,'recover');assert.equal(e.chargeDistance,0);
});

test('swept attack damage cannot originate beyond a blocking wall',()=>{
 const {w,e,p}=fixture('miner');p.z=6;w.hazards=[{id:'charge',ownerId:e.id,mapId:e.mapId,kind:'charge',originX:0,originZ:0,x:0,z:4,w:2,d:8,angle:0,start:0,activateAt:1,until:2,damage:20}];
 w.obstacles=[{x:0,z:2,w:4,d:1}];w.time=1;stepRegionHazards(w,.05);assert.equal(p.state.hp,140);
});
