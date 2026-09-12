import http from 'node:http';
import {readFile,stat} from 'node:fs/promises';
import {resolve,extname,sep} from 'node:path';
import {WebSocketServer,WebSocket} from 'ws';
import {World} from './world.mjs';
import {PROTOCOL_VERSION,TICK_SECONDS} from '../dist/multiplayer-protocol.js';

export function createGameServer({world=new World(),origins=[],staticRoot=resolve('dist'),log=console.log}={}){
 const types={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.glb':'model/gltf-binary','.wav':'audio/wav','.svg':'image/svg+xml','.png':'image/png'};
 const server=http.createServer(async(req,res)=>{
  try{
   const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
   if(pathname==='/health'){res.writeHead(200,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify({ok:true,version:PROTOCOL_VERSION,players:world.connected().length}));return;}
   if(!['GET','HEAD'].includes(req.method)){res.writeHead(405);res.end();return;}
   let file=resolve(staticRoot,'.'+pathname);if(file!==staticRoot&&!file.startsWith(staticRoot+sep)){res.writeHead(403);res.end();return;}
   if((await stat(file)).isDirectory())file=resolve(file,'index.html');const body=await readFile(file);
   res.writeHead(200,{'Content-Type':types[extname(file)]||'application/octet-stream','Cache-Control':'no-cache','X-Content-Type-Options':'nosniff'});res.end(req.method==='HEAD'?undefined:body);
  }catch{res.writeHead(404);res.end('Not found');}
 });
 const wss=new WebSocketServer({noServer:true,maxPayload:4096,perMessageDeflate:false});
 server.on('upgrade',(req,socket,head)=>{
  let origin;try{origin=new URL(req.headers.origin).origin;}catch{socket.destroy();return;}
  const allowed=origins.length?origins.includes(origin):new URL(origin).host===req.headers.host;
  if(req.url!=='/multiplayer'||!allowed||wss.clients.size>=32){socket.write('HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n');socket.destroy();return;}
  wss.handleUpgrade(req,socket,head,ws=>wss.emit('connection',ws,req));
 });
 const send=(ws,message)=>{if(ws.readyState===WebSocket.OPEN){if(ws.bufferedAmount>256*1024){ws.close(1013,'Connection too slow');return;}ws.send(JSON.stringify({v:PROTOCOL_VERSION,...message}));}};
 wss.on('connection',ws=>{
  ws.alive=true;ws.lastEvent=world.eventId;ws.rateStart=Date.now();ws.messages=0;
  const deadline=setTimeout(()=>{if(!ws.playerId)ws.close(1008,'Join timed out');},5000);deadline.unref();
  ws.on('pong',()=>ws.alive=true);
  ws.on('message',raw=>{
   if(Date.now()-ws.rateStart>=1000){ws.rateStart=Date.now();ws.messages=0;}
   if(++ws.messages>100){ws.close(1008,'Too many messages');return;}
   let m;try{m=JSON.parse(raw);}catch{ws.close(1007,'Invalid message');return;}
   if(!m||m.v!==PROTOCOL_VERSION){send(ws,{type:'error',message:'The game has been updated. Reload to reconnect.',terminal:true});ws.close(1008);return;}
   if(!ws.playerId){
    if(m.type!=='join'||(m.token!==undefined&&typeof m.token!=='string')){ws.close(1008,'Join first');return;}
    const result=world.join(m.token);if(result.error){send(ws,{type:'error',message:result.error,code:result.code,terminal:true});ws.close(1008);return;}
    ws.playerId=result.player.id;ws.lastEvent=world.eventId;clearTimeout(deadline);
    send(ws,{type:'welcome',id:ws.playerId,token:result.player.token,worldId:world.id});send(ws,world.snapshot(ws.playerId,ws.lastEvent));log(`Player joined (${world.connected().length}/8)`);return;
   }
   world.command(ws.playerId,m);
  });
  ws.on('error',()=>{});
  ws.on('close',()=>{clearTimeout(deadline);if(ws.playerId){world.leave(ws.playerId);log(`Player left (${world.connected().length}/8)`);}});
 });
 let previous=performance.now(),debt=0,snapshotAt=0;
 const timer=setInterval(()=>{
  const now=performance.now(),elapsed=(now-previous)/1000;previous=now;debt+=Math.min(elapsed,.25);
  if(elapsed>.25)log(`Simulation delay: ${Math.round(elapsed*1000)}ms`);
  try{while(debt>=TICK_SECONDS){world.step(TICK_SECONDS);debt-=TICK_SECONDS;}
   if(now-snapshotAt>=99){snapshotAt=now;for(const ws of wss.clients)if(ws.playerId){send(ws,world.snapshot(ws.playerId,ws.lastEvent));ws.lastEvent=world.eventId;}}
  }catch(error){console.error('Simulation failed',error);for(const ws of wss.clients)ws.close(1011,'World restarting');world.reset();}
 },50);
 const heartbeat=setInterval(()=>{for(const ws of wss.clients){if(!ws.alive){ws.terminate();continue;}ws.alive=false;ws.ping();}},15000);
 async function close(){clearInterval(timer);clearInterval(heartbeat);for(const ws of wss.clients)ws.terminate();await new Promise(r=>wss.close(r));await new Promise(r=>server.close(r));}
 return {server,world,wss,close};
}
