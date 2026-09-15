// World#snapshot must hand back plain data that shares nothing with the live simulation:
// LocalSession publishes it straight to the renderer (no structuredClone), so any surviving
// reference would let the renderer mutate the world and would make an old snapshot change
// underneath the frame that is drawing it. tests/fixtures/world-ref.js is a verbatim copy of
// dist/world.js as it stood before this guard existed; it pins the observable payload.
import test from 'node:test';
import assert from 'node:assert/strict';
import {World} from '../dist/world.js';
import {World as RefWorld} from './fixtures/world-ref.js';
import {PORTALS,CHECKPOINTS,mapFor} from '../dist/regions.js';
import {FORAGE_PATCHES} from '../dist/foraging.js';
import {refreshGates} from '../dist/region-campaign.js';
import * as regionsModule from '../dist/regions.js';
import * as foragingModule from '../dist/foraging.js';
import * as campaignModule from '../dist/campaign.js';
import * as combatModule from '../dist/combat.js';
import * as classesModule from '../dist/classes.js';
import * as regionCampaignModule from '../dist/region-campaign.js';
import * as protocolModule from '../dist/multiplayer-protocol.js';

const SEED=20240915,TICK=.05;
const MODULES=[regionsModule,foragingModule,campaignModule,combatModule,classesModule,regionCampaignModule,protocolModule];

// Fixed noise table instead of a live PRNG so both worlds see byte-identical inputs no matter
// how many values a tick happens to consume.
const noise=(()=>{let a=0x9e3779b9;const out=[];for(let i=0;i<4096;i++){a|=0;a=a+0x6d2b79f5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;out.push(((t^t>>>14)>>>0)/4294967296);}return out;})();
const at=i=>noise[i%noise.length];

function makeWorld(Ctor){const w=new Ctor({seed:SEED,now:()=>0});const a=w.join().player,b=w.join().player;return {w,a,b,seqA:0,seqB:0};}
const cmdA=(h,m)=>h.w.command(h.a.id,{worldId:h.w.id,seq:++h.seqA,...m});
const cmdB=(h,m)=>h.w.command(h.b.id,{worldId:h.w.id,seq:++h.seqB,...m});
const unclaimed=a=>a.loot.find(d=>!d.claimed&&d.kind!=='gold');
const foe=(w,mapId)=>w.enemies.find(e=>e.mapId===mapId&&e.hp>0);

// One scripted tick: movement, abilities, foraging, looting, a vote, a checkpoint, a respawn,
// travel to a second map, an objective, and standing in a hazard. Every branch reads only from
// the world it is handed, so World and RefWorld follow the same path.
function scriptTick(h,i){
 const {w,a,b}=h,r=at(i),q=at(i*7+13);
 cmdA(h,{type:'input',x:r*2-1,z:q*2-1,angle:r*6.28});
 cmdB(h,{type:'input',x:q-.5,z:r-.5,angle:q*6.28});
 if(i===1){cmdA(h,{type:'select-class',classId:'sorcerer',appearanceId:'C01'});cmdB(h,{type:'select-class',classId:'oathkeeper'});}
 if(i===8){const e=w.enemies.find(e=>e.zone==='road'&&e.hp>0);if(e){Object.assign(a,{x:e.x,z:e.z-1,angle:0});e.hp=1;}}
 if(i===9){const e=w.enemies.find(e=>e.zone==='road'&&e.hp>0);if(e)w.damageEnemy(e,9999);}
 if(i%5===0)cmdA(h,{type:'ability',action:'attack',angle:r*6.28});
 if(i%11===0)cmdA(h,{type:'ability',action:'bolt',angle:q*6.28});
 if(i%17===0)cmdA(h,{type:'ability',action:'nova',angle:0});
 if(i%13===0)cmdB(h,{type:'ability',action:'bolt',angle:r*6.28});
 if(i%29===0)cmdB(h,{type:'ability',action:'nova',angle:0});
 if(i===14){const d=unclaimed(a);if(d){Object.assign(a,{x:d.x,z:d.z});cmdA(h,{type:'collect',id:d.id});}}
 if(i===22){const patch=FORAGE_PATCHES.find(p=>p.zone==='ashwick');Object.assign(a,{x:patch.x,z:patch.z});cmdA(h,{type:'forage',id:patch.id});}
 if(i===24){a.state.hp=0;a.state.ended=true;cmdA(h,{type:'respawn'});}
 if(i===26)cmdA(h,{type:'vote',agree:true});
 if(i===30){const c=CHECKPOINTS.find(c=>c.mapId==='overworld');Object.assign(a,{x:c.x,z:c.z});cmdA(h,{type:'checkpoint',id:c.id});}
 if(i===40){w.shared.victory=true;refreshGates(w);const portal=PORTALS.find(p=>p.id==='wood-road');for(const who of [a,b])Object.assign(who,{x:portal.x,z:portal.z});cmdA(h,{type:'travel',id:portal.id});cmdB(h,{type:'travel',id:portal.id});}
 if(i===50){const c=CHECKPOINTS.find(c=>c.mapId==='drowned-wood');if(c){Object.assign(a,{x:c.x,z:c.z});cmdA(h,{type:'checkpoint',id:c.id});}}
 if(i===60||i===100){const e=foe(w,'drowned-wood');if(e){Object.assign(a,{x:e.x,z:e.z-1.2,angle:0});Object.assign(b,{x:e.x+.8,z:e.z-1.6});}}
 if(i===70){const e=foe(w,'drowned-wood');if(e)w.damageEnemy(e,9999);}
 if(i===80){const o=(mapFor('drowned-wood').objectives||[])[0];Object.assign(a,{x:o.x,z:o.z});cmdA(h,{type:'objective',id:o.id});}
 if(i===90){const d=unclaimed(a);if(d){Object.assign(a,{x:d.x,z:d.z});cmdA(h,{type:'collect',id:d.id});}}
 if(i>=118&&i<=126){const hz=mapFor('drowned-wood').hazards[0];Object.assign(a,{x:hz.x,z:hz.z});}
 if(i===150){const cache=(mapFor('drowned-wood').caches||[])[0];if(cache){Object.assign(a,{x:cache.x,z:cache.z});cmdA(h,{type:'cache',id:cache.id});}}
 // Keeps churning after tick 160 so a published snapshot has plenty to drift against. Staying on
 // the nearest enemy avoids teleporting across the map, which would set every pathfinder running.
 if(i>=160&&i%20===0){let best=null,near=Infinity;for(const e of w.enemies)if(e.hp>0&&e.mapId===a.mapId){const d=Math.hypot(e.x-a.x,e.z-a.z);if(d<near){near=d;best=e;}}
  if(best&&near<14){Object.assign(a,{x:best.x,z:best.z-1.2,angle:0});w.damageEnemy(best,9999);const d=unclaimed(a);if(d)cmdA(h,{type:'collect',id:d.id});}}
}
function run(h,from,to){for(let i=from;i<to;i++){scriptTick(h,i);h.w.step(TICK);}}

// Every object/array identity reachable from the roots, following own enumerable properties plus
// Map/Set contents. Cycle-safe: the visited set doubles as the result.
function reachable(roots){
 const seen=new Set(),stack=[...roots];
 while(stack.length){
  const v=stack.pop();
  if(!v||typeof v!=='object'||seen.has(v))continue;
  seen.add(v);
  if(v instanceof Map){for(const [k,x] of v)stack.push(k,x);continue;}
  if(v instanceof Set){for(const x of v)stack.push(x);continue;}
  if(Array.isArray(v)){for(const x of v)stack.push(x);continue;}
  for(const k of Object.keys(v))stack.push(v[k]);
 }
 return seen;
}
// Identity -> first path it was reached by, so a failure can name the offending field.
function reachablePaths(value,root='snapshot'){
 const found=new Map();
 const walk=(v,path)=>{
  if(!v||typeof v!=='object'||found.has(v))return;
  found.set(v,path);
  if(Array.isArray(v))v.forEach((x,i)=>walk(x,`${path}[${i}]`));
  else for(const k of Object.keys(v))walk(v[k],`${path}.${k}`);
 };
 walk(value,root);
 return found;
}
function aliasedPaths(snapshot,world){
 const live=reachable([world,...MODULES]),offenders=[];
 for(const [value,path] of reachablePaths(snapshot))if(live.has(value))offenders.push(path);
 return offenders.sort();
}
// World ids, player ids and projectile ids are crypto UUIDs, so two independently constructed
// worlds never agree on them. Renumber them in first-seen order (keys sorted, so the numbering
// cannot drift with property order) and the rest of the payload compares byte for byte.
const UUID=/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/g;
function stable(value,names=new Map()){
 if(typeof value==='string')return value.replace(UUID,id=>{if(!names.has(id))names.set(id,`uuid-${names.size}`);return names.get(id);});
 if(Array.isArray(value))return value.map(v=>stable(v,names));
 if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).sort(([a],[b])=>a<b?-1:1).map(([k,v])=>[k,stable(v,names)]));
 return value;
}

// Two snapshots so no field is checked while empty: the overworld one carries forage patches and
// uncollected loot, the second-map one carries hazards, zones, region objectives and a full event log.
test('a snapshot shares no object identity with the live world or the module constants',()=>{
 const early=makeWorld(World);run(early,0,20);
 const first=early.w.snapshot(early.a.id,0);
 assert.equal(first.mapId,'overworld');
 assert.ok(first.forage.length&&first.loot.length&&first.events.length,'the early snapshot must carry forage patches, loose loot and events');
 const late=makeWorld(World);run(late,0,200);
 const second=late.w.snapshot(late.a.id,0);
 assert.equal(second.mapId,'drowned-wood');
 assert.ok(second.enemies.length&&second.players.length===2&&second.hazards.length&&second.zones.length&&second.interactions.objectives.length&&second.votes.length,'the late snapshot must carry enemies, players, hazards, zones, objectives and votes');
 const offenders=[...aliasedPaths(first,early.w).map(path=>`tick20 ${path}`),...aliasedPaths(second,late.w).map(path=>`tick200 ${path}`)];
 assert.deepEqual(offenders,[],`snapshot fields still pointing at live objects: ${offenders.join(', ')}`);
});

test('a published snapshot is frozen against later simulation and shares nothing with the next one',()=>{
 const h=makeWorld(World);run(h,0,200);
 const s=h.w.snapshot(h.a.id,0),before=JSON.stringify(s);
 run(h,200,500);
 assert.equal(JSON.stringify(s),before,'a snapshot changed while the world kept stepping');
 const first=h.w.snapshot(h.a.id,0),second=h.w.snapshot(h.a.id,0);
 const firstIds=new Set(reachablePaths(first).keys()),shared=[];
 for(const [value,path] of reachablePaths(second))if(firstIds.has(value))shared.push(path);
 assert.deepEqual(shared.sort(),[],`consecutive snapshots share objects: ${shared.join(', ')}`);
});

test('snapshots stay byte-identical to the pre-detachment implementation',()=>{
 const h=makeWorld(World),ref=makeWorld(RefWorld);
 let checkpoints=0;const maps=new Set();
 for(let t=0;t<400;t+=10){
  run(h,t,t+10);run(ref,t,t+10);
  assert.equal(h.w.eventId,ref.w.eventId,`event counters diverged at tick ${t+10}`);
  for(const after of [0,h.w.eventId]){
   const mine=stable(h.w.snapshot(h.a.id,after)),theirs=stable(structuredClone(ref.w.snapshot(ref.a.id,after)));
   assert.deepStrictEqual(mine,theirs,`snapshot(afterEvent=${after}) diverged at tick ${t+10}`);
   checkpoints++;
  }
  maps.add(h.w.snapshot(h.a.id,0).mapId);
 }
 assert.ok(checkpoints>=30,`expected at least 30 equivalence checkpoints, ran ${checkpoints}`);
 assert.deepEqual([...maps].sort(),['drowned-wood','overworld']);
});

test('every value in a snapshot is plain JSON-shaped data',()=>{
 const h=makeWorld(World);run(h,0,200);
 const offenders=[];
 const walk=(v,path)=>{
  if(typeof v==='function'){offenders.push(`${path}: function`);return;}
  if(!v||typeof v!=='object')return;
  if(v instanceof Map||v instanceof Set){offenders.push(`${path}: ${v.constructor.name}`);return;}
  const proto=Object.getPrototypeOf(v);
  if(proto!==Object.prototype&&proto!==Array.prototype){offenders.push(`${path}: ${v.constructor?.name||'exotic'}`);return;}
  if(Array.isArray(v))v.forEach((x,i)=>walk(x,`${path}[${i}]`));
  else for(const k of Object.keys(v))walk(v[k],`${path}.${k}`);
 };
 walk(h.w.snapshot(h.a.id,0),'snapshot');
 assert.deepEqual(offenders,[],`non-plain snapshot values: ${offenders.join(', ')}`);
});
