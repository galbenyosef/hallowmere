import {PROTOCOL_VERSION} from '../dist/multiplayer-protocol.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import {MultiplayerClient} from '../dist/multiplayer-client.js';

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
  ws.receive({type:'snapshot',v:PROTOCOL_VERSION-1});assert.equal(client.connected,false);assert.match(status.at(-1)[0],/versions differ/);assert.equal(client.retry,undefined);
  client.close();assert.equal(client.send('ability',{action:'nova'}),false);assert.equal(client.connected,false);
 }finally{client.close();for(const [k,descriptor] of Object.entries(originals))if(descriptor)Object.defineProperty(globalThis,k,descriptor);else delete globalThis[k];}
});
