import test from 'node:test';
import assert from 'node:assert/strict';
import {World} from '../dist/world.js';
import {speedFor} from '../dist/classes.js';
import {START} from '../dist/campaign.js';
import {clearTravelEffects} from '../dist/region-campaign.js';
import {predictedPosition} from '../dist/multiplayer-client.js';

const command=(w,p,type,data={})=>w.command(p.id,{type,worldId:w.id,seq:p.lastSeq+1,...data});
const cast=(w,p,action,extra={})=>command(w,p,'ability',{action,angle:0,...extra});
const tick=(w,n=1)=>{for(let i=0;i<n;i++)w.step();};
function fixture(){
 const w=new World({seed:17}),p=w.join().player;
 assert.ok(command(w,p,'select-class',{classId:'oathkeeper'}));
 w.enemies=[];w.obstacles=[];Object.assign(p,{x:-40,z:5});
 const ally=(x=-38,z=5)=>{const q=w.join().player;Object.assign(q,{x,z});return q;};
 const enemy=(x=-40,z=8)=>{const e=w.spawn('hollow',x,z,'road');e.hp=e.maxHp=1000;e.rootUntil=100;return e;};
 return {w,p,ally,enemy};
}

test('Oathkeeper fires radiant projectiles, keeps a solo heal, and cannot spend staff resources at full health alone',()=>{
 const {w,p,enemy}=fixture(),e=enemy();
 assert.equal(p.state.maxHp,135);assert.equal(p.state.inventory[0].name,'Caduceus staff');
 assert.ok(cast(w,p,'attack'));assert.equal(w.snapshot(p.id).projectiles[0].visual,'radiant');tick(w,4);assert.equal(e.hp,979);
 const mana=p.state.mana;assert.equal(cast(w,p,'bolt'),false);assert.equal(p.state.mana,mana);assert.equal(p.state.cooldowns.bolt,0);
 p.state.hp=50;assert.ok(cast(w,p,'bolt'));tick(w);assert.equal(p.state.hp,64);assert.equal(w.zones[0].targetId,p.id);
 tick(w,61);assert.equal(w.zones.length,0);assert.equal(p.state.hp,134);assert.equal(p.state.damageBoost,0);
});

test('staff heals the selected ally, restores sympathetic health, then boosts healthy allies without friendly fire',()=>{
 const {w,p,ally,enemy}=fixture(),a=ally(),b=ally(-42,5),e=enemy(-38,7);a.state.hp=50;b.state.hp=20;p.state.hp=70;
 assert.ok(cast(w,p,'bolt',{target:{x:a.x,z:a.z}}));tick(w);
 assert.equal(a.state.hp,64);assert.equal(b.state.hp,20);assert.equal(p.state.hp,73.5);assert.equal(e.hp,1000);
 a.state.hp=a.state.maxHp;tick(w,10);assert.equal(a.state.damageBoost,.3);assert.ok(a.state.boostTime>0);
 assert.ok(cast(w,a,'attack'));tick(w,3);assert.equal(e.hp,961,'legacy ally receives 30% extra damage');
 const snapshot=w.snapshot(a.id),tether=snapshot.zones.find(z=>z.kind==='support');
 assert.equal(tether.casterId,p.id);assert.equal(tether.targetId,a.id);assert.equal(tether.supportMode,'boost');assert.ok(!('skill' in tether));
 assert.equal(snapshot.players.find(q=>q.id===a.id).damageBoost,.3);
 tick(w,80);assert.equal(a.state.damageBoost,0);assert.equal(a.state.boostTime,0);
});

test('tethers break on walls, range, either death, either disconnect, and either map change',()=>{
 for(const reason of ['wall','range','caster-death','target-death','caster-disconnect','target-disconnect','caster-map','target-map','class']){
  const {w,p,ally}=fixture(),a=ally();a.state.hp=20;
  assert.ok(cast(w,p,'bolt',{targetId:a.id}));tick(w);const health=a.state.hp;
  if(reason==='wall')w.obstacles=[{x:-39,z:5,w:.2,d:4}];
  if(reason==='range')a.x=-20;
  if(reason==='caster-death')p.state.ended=true;if(reason==='target-death')a.state.ended=true;
  if(reason==='caster-disconnect')w.leave(p.id);if(reason==='target-disconnect')w.leave(a.id);
  if(reason==='caster-map')p.mapId='underways';if(reason==='target-map')a.mapId='underways';
  if(reason==='class'){Object.assign(p,START);assert.ok(command(w,p,'select-class',{classId:'ranger'}));}
  tick(w,12);assert.equal(w.zones.length,0,reason);assert.equal(a.state.hp,health,reason);
 }
});

test('explicit invalid staff targets preserve mana and cooldown; touch picks the most injured reachable ally',()=>{
 const {w,p,ally}=fixture(),a=ally(),b=ally(-42,5);a.state.hp=100;b.state.hp=40;
 const mana=p.state.mana;
 for(const targetId of ['missing',p.id]){assert.equal(cast(w,p,'bolt',{targetId}),false);assert.equal(p.state.mana,mana);assert.equal(p.state.cooldowns.bolt,0);}
 w.obstacles=[{x:-39,z:5,w:.2,d:4}];assert.equal(cast(w,p,'bolt',{targetId:a.id}),false);assert.equal(p.state.mana,mana);
 assert.ok(cast(w,p,'bolt'));tick(w);assert.equal(b.state.hp,54);assert.equal(a.state.hp,100);
});

test('Guardian Angel flies toward the aimed ally, stops short, and falls back to a collision-safe solo evade',()=>{
 const {w,p,ally}=fixture(),a=ally(-34,5);p.input={x:0,z:-1};
 assert.ok(cast(w,p,'dodge',{target:{x:a.x,z:a.z}}));assert.ok(p.dodge>.27);assert.equal(p.angle,Math.PI/2);
 const me=w.snapshot(p.id).players[0];assert.deepEqual(predictedPosition(me,[{seq:99,x:0,z:-1}],0,[]),{x:p.x,z:p.z});
 tick(w,8);assert.ok(Math.abs(p.x-(a.x-.9))<1e-8);assert.equal(p.z,5);
 const solo=fixture();solo.p.input={x:1,z:0};solo.w.obstacles=[{x:-39,z:5,w:.2,d:10}];
 assert.ok(cast(solo.w,solo.p,'dodge'));tick(solo.w,8);assert.ok(solo.p.x<-39.5);assert.ok(solo.p.state.invulnerable>0);
});

test('Valkyrie revives one nearby teammate in place, preserves progress, and grants a moving healing/boost aura',()=>{
 const {w,p,ally}=fixture(),a=ally(-38,5),b=ally(-37,5);a.state.hp=b.state.hp=0;a.state.ended=b.state.ended=true;
 a.state.gold=87;a.state.cooldowns.nova=4;const inventory=structuredClone(a.state.inventory);p.state.hp=50;
 assert.ok(cast(w,p,'nova'));assert.equal(a.state.ended,false);assert.equal(a.state.hp,70);assert.equal(b.state.ended,true);assert.equal(a.x,-38);assert.equal(a.state.gold,87);assert.equal(a.state.cooldowns.nova,4);assert.deepEqual(a.state.inventory,inventory);assert.equal(a.state.invulnerable,1);
 assert.ok(w.events.some(e=>e.type==='respawn'&&e.playerId===a.id&&e.revivedBy===p.id));assert.equal(speedFor(p.state),6.25);
 command(w,p,'input',{x:1,z:0,angle:Math.PI/2});tick(w);assert.equal(w.zones[0].x,p.x);assert.equal(a.state.hp,79);assert.equal(p.state.hp,59);assert.equal(a.state.damageBoost,.3);
 const me=w.snapshot(p.id).players.find(q=>q.id===p.id);assert.equal(me.speed,6.25);assert.ok(me.valkyrieTime>0);
 const predicted=predictedPosition(me,[{seq:p.lastSeq+1,x:1,z:0}],p.lastSeq,[]);tick(w);assert.ok(Math.abs(predicted.x-p.x)<1e-8);
 tick(w,140);assert.equal(w.zones.length,0);assert.equal(speedFor(p.state),5);assert.equal(p.state.boostTime,0);
});

test('resurrection rejects walls, range, other maps and disconnected teammates; cannot repeat during cooldown',()=>{
 for(const reason of ['wall','range','map','disconnect']){
  const {w,p,ally}=fixture(),a=ally();a.state.hp=0;a.state.ended=true;
  if(reason==='wall')w.obstacles=[{x:-39,z:5,w:.2,d:4}];if(reason==='range')a.x=-30;if(reason==='map')a.mapId='underways';if(reason==='disconnect')w.leave(a.id);
  assert.ok(cast(w,p,'nova'));assert.ok(a.state.ended,reason);const mana=p.state.mana;assert.equal(cast(w,p,'nova'),false);assert.equal(p.state.mana,mana);
 }
});

test('Valkyrie and boosts clear after lethal damage, travel, class changes, and a new vigil',()=>{
 for(const reason of ['death','travel','class','reset']){
  const {w,p}=fixture();cast(w,p,'nova');tick(w);assert.ok(p.state.boostTime>0);
  if(reason==='death'){p.state.invulnerable=0;w.damagePlayer(p,1000);}
  if(reason==='travel')clearTravelEffects(w,p);
  if(reason==='class'){Object.assign(p,START);assert.ok(command(w,p,'select-class',{classId:'ranger'}));}
  if(reason==='reset')w.reset();
  assert.equal(p.state.valkyrieTime,0,reason);assert.equal(p.state.boostTime,0,reason);tick(w);assert.equal(w.zones.length,0,reason);
 }
});
