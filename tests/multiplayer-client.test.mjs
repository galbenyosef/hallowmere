import {PROTOCOL_VERSION} from '../dist/multiplayer-protocol.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import {MultiplayerClient,predictedPosition} from '../dist/multiplayer-client.js';

test('transport waits for a snapshot, resumes per-tab identity, reconciles acknowledgments and blocks disconnected actions',async()=>{
 const originals=Object.fromEntries(['fetch','sessionStorage','location','document','window','WebSocket'].map(k=>[k,Object.getOwnPropertyDescriptor(globalThis,k)]));
 const storage=new Map([['hallowmere-resume','old-token'],['hallowmere-world','old-world']]);const status=[],snapshots=[];
 class Socket{constructor(url){this.url=url;this.readyState=1;this.sent=[];Socket.latest=this;}send(s){this.sent.push(JSON.parse(s));}close(){this.readyState=3;this.onclose?.();}receive(m){this.onmessage({data:JSON.stringify({v:PROTOCOL_VERSION,...m})});}}
 Object.assign(globalThis,{fetch:async()=>({ok:true,json:async()=>({serverUrl:''})}),sessionStorage:{getItem:k=>storage.get(k),setItem:(k,v)=>storage.set(k,v),removeItem:k=>storage.delete(k)},location:{protocol:'http:',host:'localhost:5182'},document:{addEventListener(){},removeEventListener(){}},window:{addEventListener(){}},WebSocket:Socket});
 const client=new MultiplayerClient({onSnapshot:(m,changed)=>snapshots.push({m,changed}),onStatus:(...s)=>status.push(s)});
 try{
  await client.start();const ws=Socket.latest;assert.equal(ws.url,'ws://localhost:5182/multiplayer');ws.onopen();assert.equal(ws.sent[0].token,'old-token');
  assert.equal(client.send('ability',{action:'attack'}),false);
  ws.receive({type:'welcome',id:'a',token:'new-token',worldId:'new-world'});assert.equal(client.connected,false);
  ws.receive({type:'snapshot',worldId:'new-world',ack:0});assert.equal(client.connected,true);assert.equal(snapshots[0].changed,true);assert.equal(storage.get('hallowmere-resume'),'new-token');assert.equal(storage.get('hallowmere-world'),'new-world');
  client.send('input',{x:1,z:0,angle:0});client.send('input',{x:1,z:0,angle:0});assert.equal(client.pending.length,2);
  ws.receive({type:'snapshot',worldId:'new-world',ack:1});assert.equal(client.pending.length,1);assert.equal(client.pending[0].seq,2);
  ws.receive({type:'snapshot',worldId:'new-world',ack:1,state:{mapId:'drowned-wood'}});assert.equal(client.pending.length,0);assert.deepEqual(client.input,{x:0,z:0,angle:0});assert.equal(client.mapId,'drowned-wood');
  ws.receive({type:'snapshot',v:PROTOCOL_VERSION-1});assert.equal(client.connected,false);assert.match(status.at(-1)[0],/versions differ/);assert.equal(client.retry,undefined);
  client.close();assert.equal(client.send('ability',{action:'nova'}),false);assert.equal(client.connected,false);
 }finally{client.close();for(const [k,descriptor] of Object.entries(originals))if(descriptor)Object.defineProperty(globalThis,k,descriptor);else delete globalThis[k];}
});


test('prediction honors local region bounds instead of overworld limits',()=>{
 const bounds={minX:-30,maxX:30,minZ:-30,maxZ:30};
 const predicted=predictedPosition({x:29.5,z:0},[{seq:2,x:1,z:0}],1,[],bounds);
 assert.ok(predicted.x>29.5);assert.ok(predicted.x<=30);
 const clamped=predictedPosition({x:29.99,z:0},[{seq:2,x:1,z:0}],1,[],bounds);assert.equal(clamped.x,30);
 const rooted=predictedPosition({x:1,z:1,speed:0},[{seq:2,x:1,z:0}],1,[],bounds);assert.deepEqual(rooted,{x:1,z:1});
 const acknowledged=predictedPosition({x:29.5,z:0},[{seq:2,x:1,z:0}],2,[],bounds);assert.equal(acknowledged.x,29.5);
});
