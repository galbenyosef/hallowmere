import test from 'node:test';
import assert from 'node:assert/strict';
import {LocalSession} from '../dist/local-session.js';
import {World} from '../server/world.mjs';
import {World as SharedWorld} from '../dist/world.js';
import {PORTALS} from '../dist/regions.js';
import {refreshGates} from '../dist/region-campaign.js';

const flush=()=>new Promise(resolve=>queueMicrotask(resolve));
function setup(t){const snapshots=[];const session=new LocalSession({seed:17,onSnapshot:(snapshot,changed)=>snapshots.push({snapshot,changed})});t.after(()=>session.close());session.start();return {session,snapshots,player:session.world.players.get(session.id)};}

test('local startup creates exactly one isolated world without network or storage access',t=>{
 t.mock.method(globalThis,'fetch',()=>assert.fail('Solo must not fetch configuration'));
 t.mock.method(globalThis,'WebSocket',()=>assert.fail('Solo must not open a socket'));
 const {session,snapshots}=setup(t);assert.equal(World,SharedWorld);assert.equal(session.world.players.size,1);
 const id=session.world.id;session.start();assert.equal(session.world.id,id);assert.equal(snapshots.length,1);
 const other=setup(t).session;assert.notEqual(other.world.id,id);assert.notEqual(other.id,session.id);
 snapshots[0].snapshot.state.inventory.push({id:'renderer-only'});assert.equal(session.world.players.get(session.id).state.inventory.some(i=>i.id==='renderer-only'),false);
});

test('local class results arrive asynchronously, including while the simulation is paused',async t=>{
 const {session,snapshots,player}=setup(t);const count=snapshots.length;
 assert.equal(session.send('select-class',{classId:'sorcerer',appearanceId:'C01'}),true);assert.equal(snapshots.length,count);
 session.advance(2,true);await flush();assert.equal(player.state.classId,'sorcerer');
 assert.ok(snapshots.at(-1).snapshot.events.some(e=>e.type==='result'&&e.operation==='class'&&e.ok));
 assert.equal(session.world.time,0);
});

test('fixed local ticks move the player, freeze time in menus/background, and resume without catch-up',t=>{
 const {session,player}=setup(t);const start=player.x;session.input={x:1,z:0,angle:Math.PI/2};
 session.advance(.025);assert.equal(session.world.time,0);session.advance(.025);assert.equal(session.world.tick,1);assert.ok(player.x>start);
 const time=session.world.time,x=player.x;session.advance(60,true);assert.equal(session.world.time,time);assert.equal(player.x,x);
 session.advance(.025);assert.equal(session.world.time,time);session.advance(.025);assert.equal(session.world.tick,2);
});

test('solo commands retain combat, loot, travel, respawn and restart behavior',async t=>{
 const {session,player,snapshots}=setup(t),world=session.world;
 const enemy=world.enemies.find(e=>e.zone==='road');Object.assign(player,{x:enemy.x,z:enemy.z-1});enemy.hp=1;
 session.send('ability',{action:'attack',angle:0});session.advance(.2);assert.equal(enemy.hp,0);assert.equal(player.state.kills,1);
 const item=player.loot.find(d=>d.kind==='item');assert.ok(item);Object.assign(player,{x:item.x,z:item.z});session.send('collect',{id:item.id});assert.ok(player.state.inventory.some(i=>i.id===item.id));
 world.shared.victory=true;refreshGates(world);const portal=PORTALS.find(p=>p.id==='wood-road');Object.assign(player,{x:portal.x,z:portal.z});session.send('travel',{id:portal.id});await flush();assert.equal(snapshots.at(-1).snapshot.mapId,'drowned-wood');
 player.state.hp=0;player.state.ended=true;session.send('respawn');await flush();assert.equal(snapshots.at(-1).snapshot.state.ended,false);assert.equal(player.state.hp,player.state.maxHp);
 const oldId=world.id;session.send('restart');await flush();assert.notEqual(world.id,oldId);assert.equal(snapshots.at(-1).changed,true);assert.equal(player.state.kills,0);assert.equal(player.mapId,'overworld');assert.deepEqual(snapshots.at(-1).snapshot.votes,[]);
});

test('closing a local session suppresses queued results and future simulation',async t=>{
 const {session,snapshots}=setup(t);session.send('select-class',{classId:'sorcerer',appearanceId:'C01'});const count=snapshots.length;session.close();await flush();session.advance(1);assert.equal(snapshots.length,count);assert.equal(session.send('restart'),false);
});
