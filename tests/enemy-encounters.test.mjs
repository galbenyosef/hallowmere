import test from 'node:test';
import assert from 'node:assert/strict';
import {World} from '../dist/world.js';
import {ENEMY_TYPES,SPAWNS,pointBlocked} from '../dist/combat.js';
import {MAPS} from '../dist/regions.js';
import {generateVillageEncounters,generateRoadPacks,randomizeEncounters} from '../dist/enemy-encounters.js';
import {captureJourney,restoreJourney} from '../dist/journey-state.js';
import {applyClass} from '../dist/classes.js';

test('seeded packs retain objective and cache identities with safe scattered positions',()=>{
 const map={id:'drowned-wood',bounds:{minX:-20,maxX:20,minZ:-20,maxZ:20},caches:[{enemyId:'pack-0'}]};
 const specs=Array.from({length:4},(_,i)=>({id:`pack-${i}`,type:'hunter',x:i*2-3,z:0,objectiveId:'shrine',requires:'boss',optional:true}));
 const obstacles=[{x:0,z:3,w:2,d:2}];
 const a=randomizeEncounters(specs,17,map,obstacles),b=randomizeEncounters(specs,42,map,obstacles);
 assert.deepEqual(a,randomizeEncounters(specs,17,map,obstacles));assert.notDeepEqual(a,b);
 assert.ok(a.some(e=>e.id==='pack-0'));assert.ok(new Set(a.map(e=>e.type)).size>1);
 for(const e of a){assert.equal(e.objectiveId,'shrine');assert.equal(e.requires,'boss');assert.equal(pointBlocked(e,obstacles,.5),false);}
 assert.deepEqual(specs.map(e=>e.type),Array(4).fill('hunter'));
});

test('village retains twelve quest enemies and varies both composition and placement',()=>{
 const signatures=new Set();
 for(let seed=0;seed<16;seed++){
  const roster=generateVillageEncounters(seed);assert.equal(roster.length,SPAWNS.length);
  assert.equal(new Set(roster.map(e=>e.id)).size,SPAWNS.length);
  assert.ok(new Set(roster.map(e=>e.type)).size>=6);
  assert.ok(roster.filter(e=>ENEMY_TYPES[e.type].attackStyle==='orb').length<=3);
  signatures.add(roster.map(e=>e.type).sort().join(','));
 }
 assert.ok(signatures.size>1);
});

test('orb casters emit colored projectiles; bite and knife attacks remain directional melee',()=>{
 for(const type of ['gravecaller','bone-colossus','cutthroat','ghoul']){
  const w=new World({seed:17}),p=w.join().player;w.enemies=[];p.x=-40;p.z=5;
  const e=w.spawn(type,-40,6,'road','attacker');e.phase='windup';e.timer=.01;e.attackAngle=Math.PI;e.aim={x:p.x,z:p.z};
  w.updateEnemy(e,[p],.05);
  if(ENEMY_TYPES[type].attackStyle==='orb'){
   assert.equal(w.projectiles.length,1);assert.equal(w.projectiles[0].color,ENEMY_TYPES[type].orbColor);assert.equal(p.state.hp,p.state.maxHp);
  }else {assert.equal(w.projectiles.length,0);assert.ok(p.state.hp<p.state.maxHp);}
  assert.ok(w.events.some(event=>event.type==='strike'&&event.enemyId===e.id));
 }
});

test('randomized gated enemies wait for progression and do not attack through locked routes',()=>{
 const w=new World({seed:17}),p=w.join().player;w.enemies=[];p.x=-40;p.z=5;
 const e=w.spawn('shard-hound',-40,6,'road','gated');e.requires='rootbound';e.cooldown=0;
 w.updateEnemy(e,[p],.05);assert.equal(e.phase,'idle');
 w.shared.regionProgress['drowned-wood'].bossDefeated=true;
 w.updateEnemy(e,[p],.05);assert.equal(e.phase,'windup');
});

test('older saves upgrade surviving rosters once while keeping slain foes and personal progress',()=>{
 const w=new World({seed:17}),p=w.join().player;applyClass(p.state,'sorcerer');p.state.gold=79;
 const dead=w.enemies.find(e=>e.id==='village-0');dead.hp=0;
 const save=captureJourney(w,p.id);delete save.encounterVersion;
 const alive=save.enemies.find(e=>e.id==='village-1');alive.type='hollow';alive.hp=32;alive.maxHp=64;
 const restored=new World({seed:17}),q=restored.join().player,expected=restored.enemies.find(e=>e.id===alive.id);
 restoreJourney(restored,q.id,save);
 assert.equal(restored.enemies.find(e=>e.id===dead.id).hp,0);assert.equal(q.state.gold,79);
 const result=restored.enemies.find(e=>e.id===alive.id);assert.equal(result.type,expected.type);assert.equal(result.hp,Math.round(expected.maxHp*.5));
 assert.equal(captureJourney(restored,q.id).encounterVersion,1);
 for(const map of Object.values(MAPS))for(const cache of map.caches)assert.ok(restored.enemies.some(e=>e.id===cache.enemyId));
});

test('consecutive road packs have different compositions, including reversed member order',()=>{
 for(let seed=0;seed<32;seed++){
  const packs=generateRoadPacks(seed);let previous='';
  for(let i=0;i<3;i++){const signature=packs.filter(e=>e.id.startsWith(`road-${i}-`)).map(e=>e.type).sort().join(',');assert.notEqual(signature,previous);previous=signature;}
 }
});
