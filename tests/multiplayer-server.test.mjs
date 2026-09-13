import test from 'node:test';
import assert from 'node:assert/strict';
import {WebSocket} from 'ws';
import {createGameServer} from '../server/server.mjs';
import {PROTOCOL_VERSION as v} from '../dist/multiplayer-protocol.js';

function next(ws,predicate,timeout=3000){return new Promise((resolve,reject)=>{
 const timer=setTimeout(()=>{ws.off('message',message);reject(Error('Timed out waiting for game message'));},timeout);
 function message(raw){const data=JSON.parse(raw);if(predicate(data)){clearTimeout(timer);ws.off('message',message);resolve(data);}}
 ws.on('message',message);
});}
async function setup(t){const game=createGameServer({origins:['https://game.example'],log:()=>{}});await new Promise(r=>game.server.listen(0,'127.0.0.1',r));t.after(()=>game.close());return {...game,url:`ws://127.0.0.1:${game.server.address().port}/multiplayer`};}
async function join(url,token){const ws=new WebSocket(url,{origin:'https://game.example'});const welcome=next(ws,m=>m.type==='welcome'||m.type==='error');ws.on('open',()=>ws.send(JSON.stringify({v,type:'join',token})));return {ws,message:await welcome};}

test('foraging and eating round-trip through real sockets with personal snapshots and feedback',async t=>{
 const game=await setup(t),a=await join(game.url),b=await join(game.url),initial=await next(a.ws,m=>m.type==='snapshot');
 const patch=initial.forage.find(p=>p.id==='forage-1'),itemId=patch.itemId;
 const harvested=next(a.ws,m=>m.type==='snapshot'&&m.state.pouch[itemId]===1);
 a.ws.send(JSON.stringify({v,type:'forage',id:patch.id,worldId:initial.worldId,seq:1}));
 const own=await harvested;assert.equal(own.forage.some(p=>p.id===patch.id),false);assert.ok(own.events.some(e=>e.operation==='forage'&&e.ok));
 const other=await next(b.ws,m=>m.type==='snapshot');assert.equal(other.state.pouch[itemId],0);assert.ok(other.forage.some(p=>p.id===patch.id));assert.equal(other.events.some(e=>e.operation==='forage'),false);
 game.world.players.get(a.message.id).state.hp=30;
 const eaten=next(a.ws,m=>m.type==='snapshot'&&m.events.some(e=>e.operation==='consume'&&e.ok));
 a.ws.send(JSON.stringify({v,type:'consume',itemId,worldId:initial.worldId,seq:2}));
 const after=await eaten;assert.equal(after.state.hp,65);assert.equal(after.state.pouch[itemId],0);assert.ok(after.state.foodCooldown>0);
 a.ws.close();await new Promise(r=>a.ws.once('close',r));const resumed=await join(game.url,a.message.token);
 const fresh=await next(resumed.ws,m=>m.type==='snapshot');assert.equal(fresh.state.hp,65);assert.equal(fresh.forage.some(p=>p.id===patch.id),false);
});

test('selected classes synchronize between clients, acknowledge selection, cast, and resume',async t=>{
 const game=await setup(t),a=await join(game.url),b=await join(game.url),initial=await next(a.ws,m=>m.type==='snapshot');
 const confirmed=next(a.ws,m=>m.type==='snapshot'&&m.events.some(e=>e.operation==='class'&&e.ok));
 const visible=next(b.ws,m=>m.type==='snapshot'&&m.players.some(p=>p.id===a.message.id&&p.appearanceId==='W07'));
 a.ws.send(JSON.stringify({v,type:'select-class',worldId:initial.worldId,seq:1,classId:'sorcerer',appearanceId:'W07'}));
 const own=await confirmed;await visible;assert.equal(own.state.maxMana,120);assert.equal(own.state.inventory[0].name,'Skull-topped staff');
 const cast=next(b.ws,m=>m.type==='snapshot'&&m.events.some(e=>e.type==='ability'&&e.classId==='sorcerer'&&e.action==='nova'));
 a.ws.send(JSON.stringify({v,type:'ability',worldId:initial.worldId,seq:2,action:'nova',angle:0,target:{x:initial.players[0].x,z:initial.players[0].z}}));
 assert.equal((await cast).zones[0].classId,'sorcerer');
 a.ws.close();await new Promise(r=>a.ws.once('close',r));const resumed=await join(game.url,a.message.token);
 const fresh=await next(resumed.ws,m=>m.type==='snapshot');assert.equal(fresh.state.appearanceId,'W07');assert.equal(fresh.state.classId,'sorcerer');
});

test('real WebSockets join eight clients, synchronize movement, reject ninth, and resume',async t=>{
 const game=await setup(t),clients=[];for(let i=0;i<8;i++)clients.push(await join(game.url));
 const first=clients[0],other=clients[1];const snap=await next(other.ws,m=>m.type==='snapshot'&&m.players.length===8);
 assert.equal(new Set(snap.players.map(p=>p.color)).size,8);assert.ok(!JSON.stringify(snap).includes(first.message.token));
 const full=await join(game.url);assert.equal(full.message.type,'error');assert.match(full.message.message,/World full/);
 const before=snap.players.find(p=>p.id===first.message.id).x;
 const moved=next(other.ws,m=>m.type==='snapshot'&&m.players.some(p=>p.id===first.message.id&&p.x>before+.1));
 first.ws.send(JSON.stringify({v,type:'input',worldId:snap.worldId,seq:1,x:1,z:0,angle:0}));await moved;
 first.ws.close();await new Promise(r=>first.ws.once('close',r));
 const resumed=await join(game.url,first.message.token);assert.equal(resumed.message.id,first.message.id);
 const health=await fetch(game.url.replace('ws:','http:').replace('/multiplayer','/health')).then(r=>r.json());assert.equal(health.players,8);assert.equal(health.version,v);
});

test('wrong origins, malformed messages, and protocol mismatches cannot join',async t=>{
 const {url}=await setup(t);
 const denied=new WebSocket(url,{origin:'https://other.example'});await new Promise(resolve=>{denied.once('unexpected-response',(_,res)=>{assert.equal(res.statusCode,403);res.resume();denied.terminate();resolve();});denied.on('error',()=>{});});
 const old=new WebSocket(url,{origin:'https://game.example'});const error=next(old,m=>m.type==='error');old.on('open',()=>old.send(JSON.stringify({v:999,type:'join'})));assert.match((await error).message,/updated/);
 const malformed=new WebSocket(url,{origin:'https://game.example'});await new Promise(resolve=>{malformed.on('open',()=>malformed.send('{broken'));malformed.on('close',code=>{assert.equal(code,1007);resolve();});});
});

test('delayed and duplicated commands cannot double-charge or mutate a restarted world',async t=>{
 const game=await setup(t),{ws,message}=await join(game.url);const snap=await next(ws,m=>m.type==='snapshot');
 const input={v,type:'ability',worldId:snap.worldId,seq:1,action:'nova',angle:0};
 ws.send(JSON.stringify(input));await new Promise(r=>setTimeout(r,160));ws.send(JSON.stringify(input));
 const after=await next(ws,m=>m.type==='snapshot'&&m.ack===1);assert.ok(after.state.mana<70&&after.state.mana>=65);
 const reset=next(ws,m=>m.type==='snapshot'&&m.worldId!==snap.worldId);ws.send(JSON.stringify({v,type:'vote',worldId:snap.worldId,seq:2,agree:true}));const fresh=await reset;
 ws.send(JSON.stringify({...input,seq:999}));const clean=await next(ws,m=>m.type==='snapshot'&&m.worldId===fresh.worldId);assert.equal(clean.state.mana,100);assert.equal(clean.state.cooldowns.nova,0);
 assert.equal(clean.you,message.id);
});
