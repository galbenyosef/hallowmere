import test from 'node:test';
import assert from 'node:assert/strict';
import {World} from '../server/world.mjs';
import {SPAWNS,pointBlocked,distance} from '../dist/combat.js';
import {START} from '../dist/campaign.js';
import {predictedPosition} from '../dist/multiplayer-client.js';
import {createWorldLayout,SCENERY_OBSTACLES} from '../dist/world-layout.js';
import {tick} from './helpers/sim.mjs';
const fixture=()=>{let now=0;const w=new World({seed:17,now:()=>now});return {w,join:()=>w.join().player,advance:ms=>{now+=ms;w.expire();}};};
const command=(w,p,type,data={})=>w.command(p.id,{type,worldId:w.id,seq:p.lastSeq+1,...data});

test('eight unique Wardens, capacity, private state, and safe token resume',()=>{
 const {w,join,advance}=fixture(),players=Array.from({length:8},join);
 assert.equal(new Set(players.map(p=>p.color)).size,8);assert.ok(w.join().error);
 players[0].state.gold=99;w.leave(players[0].id);assert.ok(w.join().error);
 const resumed=w.join(players[0].token).player;assert.equal(resumed.id,players[0].id);assert.equal(resumed.state.gold,99);assert.equal(resumed.x,START.x);
 assert.ok(w.join(resumed.token).error);
 const snap=JSON.stringify(w.snapshot(players[1].id));assert.ok(!snap.includes(resumed.token));assert.equal(w.snapshot(players[1].id).state.gold,0);
 w.leave(resumed.id);advance(60000);assert.ok(w.join().player);
});

test('movement is authoritative, bounded, independent, and stops when input is stale',()=>{
 const {w,join}=fixture(),a=join(),b=join();const original={x:b.x,z:b.z};
 for(let i=0;i<30;i++){command(w,a,'input',{x:1,z:0,angle:Math.PI/2});tick(w);}
 assert.ok(a.x>START.x+6);assert.deepEqual({x:b.x,z:b.z},original);
 assert.equal(command(w,a,'input',{x:500,z:0,angle:0}),false);
 tick(w,8);const stopped=a.x;tick(w,10);assert.equal(a.x,stopped);
 assert.equal(w.command(a.id,{type:'input',worldId:'old-world',seq:999,x:1,z:0,angle:0}),false);
 const seq=a.lastSeq;assert.equal(w.command(a.id,{type:'ability',worldId:w.id,seq,action:'nova',angle:0}),false);
 a.x=-24.1;a.z=5;command(w,a,'input',{x:1,z:0,angle:0});tick(w);assert.equal(a.state.zone,'hallowmere');assert.equal(b.state.zone,'ashwick');
});

test('simultaneous attacks kill once, increment once, and award personal loot',()=>{
 const {w,join}=fixture(),a=join(),b=join();const e=w.enemies.find(e=>e.zone==='road');
 Object.assign(a,{x:e.x,z:e.z-1});Object.assign(b,{x:e.x,z:e.z-1});e.hp=50;
 command(w,a,'ability',{action:'attack',angle:0});command(w,b,'ability',{action:'attack',angle:0});tick(w,3);
 assert.equal(e.hp,0);assert.equal(w.shared.roadKills,1);assert.equal(a.state.kills,1);assert.equal(b.state.kills,1);
 assert.ok(a.loot.length);assert.ok(b.loot.length);const item=a.loot.find(d=>d.kind==='item');
 Object.assign(a,{x:item.x,z:item.z});assert.equal(command(w,a,'collect',{id:item.id}),true);assert.equal(command(w,a,'collect',{id:item.id}),false);
 assert.ok(b.loot.find(d=>d.id===item.id&&!d.claimed));assert.equal(b.state.inventory.length,1);
});

test('cooldowns, resources, ownership and service distance are enforced',()=>{
 const {w,join}=fixture(),p=join();assert.equal(command(w,p,'ability',{action:'nova',angle:0}),true);assert.equal(p.state.mana,65);
 assert.equal(command(w,p,'ability',{action:'nova',angle:0}),false);assert.equal(p.state.mana,65);
 assert.equal(command(w,p,'equip',{id:'unowned'}),false);assert.equal(command(w,p,'service',{npcId:'brann',action:'forge'}),false);
 assert.equal(command(w,p,'ability',{action:'bolt',angle:NaN}),false);
});

test('entire campaign is shared, boss spawns once, rewards and shopping remain personal',()=>{
 const {w,join}=fixture(),a=join(),b=join();Object.assign(a,{x:-66,z:2});
 command(w,a,'service',{npcId:'rowan',action:'accept-quest'});assert.equal(w.snapshot(b.id).state.questAccepted,true);
 for(const e of w.enemies.filter(e=>e.zone==='hallowmere'))w.damageEnemy(e,10000);
 assert.equal(w.shared.villageKills,SPAWNS.length);assert.equal(w.enemies.filter(e=>e.type==='boss').length,1);
 const boss=w.enemies.find(e=>e.type==='boss');w.damageEnemy(boss,10000);w.damageEnemy(boss,10000);
 assert.equal(w.shared.victory,true);assert.equal(w.buildings.find(b=>b.chapel).doorCollider.disabled,true);
 const relic=a.loot.find(d=>d.template==='bellkeeper-edge');Object.assign(a,{x:relic.x,z:relic.z});command(w,a,'collect',{id:relic.id});assert.equal(w.snapshot(b.id).state.bossLootClaimed,true);
 for(const p of [a,b]){Object.assign(p,{x:-66,z:2});const before=p.state.gold;assert.equal(command(w,p,'service',{npcId:'rowan',action:'claim-reward'}),true);assert.equal(p.state.gold,before+80);assert.equal(command(w,p,'service',{npcId:'rowan',action:'claim-reward'}),false);}
 const late=join();assert.equal(w.snapshot(late.id).state.questCompleted,true);assert.equal(late.loot.length,0);assert.equal(late.state.souls,0);
 Object.assign(late,{x:-66,z:2});assert.equal(command(w,late,'service',{npcId:'rowan',action:'claim-reward'}),true);
});

test('death and respawn preserve the world and possessions; allies keep fighting',()=>{
 const {w,join}=fixture(),a=join(),b=join();a.x=-40;a.z=5;a.state.gold=77;a.state.hp=1;w.damagePlayer(a,50);assert.equal(a.state.ended,true);
 const id=w.id;command(w,b,'input',{x:1,z:0,angle:0});tick(w);assert.equal(command(w,a,'respawn'),true);
 assert.equal(w.id,id);assert.equal(a.state.hp,a.state.maxHp);assert.equal(a.state.gold,77);assert.equal(a.x,START.x);assert.ok(b.x>START.x);
});

test('group voting requires unanimity, cancels on membership change, and resets atomically',()=>{
 const {w,join,advance}=fixture(),a=join(),b=join();const id=w.id;
 command(w,a,'vote',{agree:true});assert.equal(w.id,id);command(w,b,'vote',{agree:false});assert.equal(w.votes.size,0);
 command(w,a,'vote',{agree:true});advance(30000);assert.equal(w.votes.size,0);
 command(w,a,'vote',{agree:true});const c=join();assert.equal(w.votes.size,0);w.leave(c.id);
 a.state.gold=90;command(w,a,'vote',{agree:true});command(w,b,'vote',{agree:true});assert.notEqual(w.id,id);assert.equal(a.state.gold,0);assert.equal(a.token.length,48);assert.equal(w.shared.villageKills,0);
});

test('an empty world survives brief absences and resets after ten minutes',()=>{
 const {w,join,advance}=fixture(),p=join();const id=w.id;w.leave(p.id);advance(599999);assert.equal(w.id,id);advance(1);assert.notEqual(w.id,id);assert.equal(w.players.size,0);
});

test('disconnected characters cannot take damage or keep walking',()=>{
 const {w,join}=fixture(),p=join();p.x=-40;p.z=5;command(w,p,'input',{x:1,z:0,angle:0});w.leave(p.id);const hp=p.state.hp;tick(w,10);w.damagePlayer(p,50);assert.equal(p.x,-40);assert.equal(p.state.hp,hp);
});

test('enemy attacks can hit multiple allies but cannot damage through walls or sanctuaries',()=>{
 const {w,join}=fixture(),a=join(),b=join();w.enemies=[];const e=w.spawn('hollow',-40,5,'road');
 for(const p of [a,b])Object.assign(p,{x:-40,z:6});Object.assign(e,{phase:'windup',timer:0,attackAngle:0});tick(w);assert.equal(a.state.hp,128);assert.equal(b.state.hp,128);
 a.state.invulnerable=0;b.state.invulnerable=0;w.obstacles.push({x:-40,z:5.5,w:4,d:.1});Object.assign(e,{phase:'windup',timer:0});tick(w);assert.equal(a.state.hp,128);
 Object.assign(a,START);w.damagePlayer(a,50);assert.equal(a.state.hp,128);
});

test('shared collision layout includes buildings and all solid scenery; prediction respects it',()=>{
 const {obstacles,buildings}=createWorldLayout();assert.equal(obstacles.length,buildings.reduce((sum,b)=>sum+b.obstacles.length,0)+SCENERY_OBSTACLES.length);
 const start={x:-69,z:6};const pending=Array.from({length:20},(_,i)=>({seq:i+1,x:0,z:1}));const predicted=predictedPosition(start,pending,0,obstacles);assert.ok(!pointBlocked(predicted,obstacles,.42));assert.ok(predicted.z<8);
 assert.deepEqual(predictedPosition(start,pending,20,obstacles),start);
 const free=predictedPosition({x:-40,z:5},[{seq:2,x:1,z:0},{seq:3,x:1,z:0}],2,obstacles);assert.ok(Math.abs(distance(free,{x:-40,z:5})-.245)<1e-8);
});

test('click destinations stop at short waypoints without overshooting between snapshots',()=>{
 const {w,join}=fixture(),p=join(),goal={x:p.x+.06,z:p.z};command(w,p,'input',{x:1,z:0,angle:0,stopAt:goal});tick(w,4);assert.equal(p.x,goal.x);
 const predicted=predictedPosition({x:-40,z:5},[{seq:1,x:1,z:0,stopAt:{x:-39.94,z:5}}],0,[]);assert.equal(predicted.x,-39.94);
});

test('evade follows movement, grants brief immunity, and stops at a solid wall',()=>{
 const {w,join}=fixture(),p=join();p.x=-40;p.z=5;command(w,p,'input',{x:1,z:0,angle:0});assert.equal(command(w,p,'ability',{action:'dodge',angle:0}),true);
 w.damagePlayer(p,20);assert.equal(p.state.hp,140);w.obstacles.push({x:-38,z:5,w:.3,d:4});tick(w,6);
 assert.equal(p.dodge,0);assert.ok(p.x<-38);assert.ok(Math.abs(p.angle-Math.PI/2)<1e-8);assert.equal(pointBlocked(p,w.obstacles,.42),false);
});
