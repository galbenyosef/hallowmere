import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from '../dist/vendor/three.core.js';
import {World} from '../server/world.mjs';
import {LocalSession} from '../dist/local-session.js';
import {abilityForEvent,abilitiesFor} from '../dist/classes.js';
import {animateHeroAttack} from '../dist/combat-effects.js';
import {predictDodge} from '../dist/multiplayer-motion.js';

const command=(w,p,type,data={})=>w.command(p.id,{type,worldId:w.id,seq:p.lastSeq+1,...data});
const cast=(w,p,action,extra={})=>command(w,p,'ability',{action,angle:0,...extra});
const tick=(w,n=1)=>{for(let i=0;i<n;i++)w.step();};
function fixture(){
 const w=new World({seed:17}),p=w.join().player;
 assert.ok(command(w,p,'select-class',{classId:'ranger'}));
 w.enemies=[];w.obstacles=[];Object.assign(p,{x:-40,z:5});
 return {w,p,enemy:(x=-40,z=7)=>{const e=w.spawn('hollow',x,z,'road');e.hp=e.maxHp=1000;e.rootUntil=100;return e;}};
}

test('Ranger swaps bow shots for two timed blade cuts on one primary cooldown',()=>{
 const {w,p,enemy}=fixture(),e=enemy();
 assert.ok(cast(w,p,'attack'));assert.equal(w.projectiles.length,0);assert.equal(w.hits.length,2);
 const event=w.snapshot(p.id).events.findLast(e=>e.type==='ability');
 assert.equal(event.kind,'melee');assert.equal(abilityForEvent(event).name,'Twin Blades');
 assert.equal(p.state.cooldowns.attack,.46);assert.equal(p.state.mana,100);
 tick(w,2);assert.equal(e.hp,1000);tick(w);assert.equal(e.hp,986);tick(w,2);assert.equal(e.hp,972);
 e.z=9;assert.equal(cast(w,p,'attack'),false);assert.equal(w.projectiles.length,0);
 tick(w,5);assert.ok(cast(w,p,'attack'));assert.equal(w.projectiles.length,1);
 assert.equal(abilityForEvent(w.events.findLast(e=>e.type==='ability')).name,'Elven Quickshot');
 tick(w,5);assert.equal(e.hp,948);assert.equal(w.hits.length,0);
});

test('close-range selection ignores enemies behind walls, behind the Ranger, dead, or on another map',()=>{
 for(const scenario of ['wall','behind','dead','other-map','distant']){
  const {w,p,enemy}=fixture(),e=enemy();
  if(scenario==='wall')w.obstacles=[{x:-40,z:6,w:8,d:.2}];
  if(scenario==='behind')e.z=3;
  if(scenario==='dead')e.hp=0;
  if(scenario==='other-map')e.mapId='drowned-wood';
  if(scenario==='distant')e.z=8;
  assert.ok(cast(w,p,'attack',{variant:'closeRange',kind:'melee'}),scenario);
  assert.equal(w.hits.length,0,scenario);assert.equal(w.projectiles.length,1,scenario);
  assert.equal(w.events.findLast(e=>e.type==='ability').variant,undefined,scenario);
  tick(w,4);if(scenario!=='dead'&&scenario!=='distant')assert.equal(e.hp,1000,scenario);
 }
});

test('each blade cut rechecks range, facing, walls, allies, and the owner’s life',()=>{
 for(const scenario of ['range','wall','behind','death']){
  const {w,p,enemy}=fixture(),e=enemy(),ally=w.join().player;Object.assign(ally,{x:-40,z:7});
  assert.ok(cast(w,p,'attack'));tick(w,3);assert.equal(e.hp,986);
  if(scenario==='range')e.z=10;
  if(scenario==='wall')w.obstacles=[{x:-40,z:6,w:8,d:.2}];
  if(scenario==='behind')e.z=3;
  if(scenario==='death')p.state.ended=true;
  tick(w,3);assert.equal(e.hp,986,scenario);assert.equal(ally.state.hp,ally.state.maxHp,scenario);
 }
});

test('Threefold Volley sends three physical arrows through two targets apiece',()=>{
 const {w,p,enemy}=fixture(),lanes=[-.14,0,.14].map(a=>[6,9,12].map(r=>enemy(p.x+Math.sin(a)*r,p.z+Math.cos(a)*r)));
 assert.ok(cast(w,p,'nova'));assert.equal(p.state.mana,70);assert.equal(p.state.cooldowns.nova,7);assert.equal(w.zones.length,0);
 const snapshot=w.snapshot(p.id);assert.deepEqual(snapshot.projectiles.map(b=>b.angle),[-.14,0,.14]);assert.ok(snapshot.projectiles.every(b=>b.visual==='arrow'));
 assert.equal(cast(w,p,'nova'),false);assert.equal(w.projectiles.length,3);assert.equal(p.state.mana,70);
 tick(w,12);assert.deepEqual(lanes.map(lane=>lane.map(e=>e.hp)),[[964,964,1000],[964,964,1000],[964,964,1000]]);assert.equal(w.projectiles.length,0);
});

test('volley arrows stop at walls and out-of-range targets, and require essence',()=>{
 for(const scenario of ['wall','range','essence']){
  const {w,p,enemy}=fixture(),e=enemy(-40,scenario==='range'?22:9);
  if(scenario==='wall')w.obstacles=[{x:-40,z:6,w:10,d:.2}];
  if(scenario==='essence')p.state.mana=29;
  assert.equal(cast(w,p,'nova'),scenario!=='essence');tick(w,20);assert.equal(e.hp,1000,scenario);assert.equal(w.projectiles.length,0);
  if(scenario==='essence')assert.equal(p.state.cooldowns.nova,0);
 }
});

test('Elven Step retreats from aim at rest and matches client movement prediction',()=>{
 for(const angle of [0,Math.PI/2,Math.PI,-Math.PI/2]){
  const {w,p}=fixture(),start={x:p.x,z:p.z};
  assert.ok(cast(w,p,'dodge',{angle}));const snapshot=w.snapshot(p.id).players[0];
  const expected=predictDodge(start,snapshot.angle,snapshot.dodge,.05,w.obstacles,w.boundsFor(p));
  tick(w);assert.ok(Math.abs(p.x-expected.x)<1e-9);assert.ok(Math.abs(p.z-expected.z)<1e-9);
  tick(w,5);assert.ok(Math.abs(p.x-(start.x-Math.sin(angle)*4.05))<1e-9);assert.ok(Math.abs(p.z-(start.z-Math.cos(angle)*4.05))<1e-9);
  const hp=p.state.hp;w.damagePlayer(p,20);assert.equal(p.state.hp,hp);tick(w,4);w.damagePlayer(p,20);assert.equal(p.state.hp,hp-20);
 }
});

test('Elven Step obeys active movement, ignores expired input, and cannot cross walls',()=>{
 for(const scenario of ['moving','expired','wall']){
  const {w,p}=fixture();
  command(w,p,'input',{x:1,z:0,angle:0});if(scenario==='expired')w.time=.3;
  if(scenario==='wall'){command(w,p,'input',{x:0,z:0,angle:0});w.obstacles=[{x:-40,z:4,w:10,d:.2}];}
  assert.ok(cast(w,p,'dodge'));assert.equal(cast(w,p,'dodge'),false);tick(w,6);
  if(scenario==='moving'){assert.ok(p.x>-36);assert.equal(p.z,5);}
  if(scenario==='expired'){assert.equal(p.x,-40);assert.ok(p.z<1);}
  if(scenario==='wall'){assert.equal(p.x,-40);assert.ok(p.z>=4.52);}
 }
});

test('solo snapshots carry the authoritative bow/blade choice and pause pending cuts',async t=>{
 const snapshots=[],session=new LocalSession({seed:17,onSnapshot:s=>snapshots.push(s)});t.after(()=>session.close());session.start();
 session.send('select-class',{classId:'ranger'});const p=session.world.players.get(session.id);Object.assign(p,{x:-40,z:5});session.world.enemies=[];session.world.obstacles=[];
 const e=session.world.spawn('hollow',-40,7,'road');e.hp=1000;e.rootUntil=100;
 session.send('ability',{action:'attack',angle:0});await new Promise(resolve=>queueMicrotask(resolve));
 assert.equal(abilityForEvent(snapshots.at(-1).events.find(e=>e.type==='ability')).name,'Twin Blades');
 session.advance(5,true);assert.equal(e.hp,1000);session.advance(.25);assert.equal(e.hp,972);
 assert.equal(abilitiesFor(p.state).attack.name,'Elven Quickshot');
});

test('paired blade poses alternate hands at the hit times and release their transforms',()=>{
 const body=new T.Group(),right=new T.Group(),left=new T.Group();right.name='armR';left.name='armL';
 const rig={body,arms:[right,left],attack:.42,attackKind:'paired'};
 animateHeroAttack(rig,.11);assert.ok(right.rotation.x<left.rotation.x);animateHeroAttack(rig,.13);assert.ok(left.rotation.x<right.rotation.x);
 for(let i=0;i<30;i++)animateHeroAttack(rig,.016);
 assert.equal(rig.attack,0);assert.equal(body.rotation.y,0);assert.equal(body.position.z,0);
 for(const arm of rig.arms){assert.equal(arm.rotation.y,0);assert.equal(arm.rotation.z,0);assert.ok(arm.matrix.elements.every(Number.isFinite));}
});
