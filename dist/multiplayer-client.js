import {PROTOCOL_VERSION,PLAYER_SPEED} from './multiplayer-protocol.js';
import {resolveMove,distance} from './combat.js';
import {WORLD_BOUNDS} from './campaign.js';

export function predictedPosition(position,pending,ack,obstacles,bounds=WORLD_BOUNDS){
 let result={x:position.x,z:position.z};
 for(const input of pending)if(input.seq>ack){const travel=input.stopAt?Math.min((position.speed??PLAYER_SPEED)*.05,distance(result,input.stopAt)):(position.speed??PLAYER_SPEED)*.05;result=resolveMove(result,input.x*travel,input.z*travel,obstacles,.42,bounds);}
 return result;
}
export class MultiplayerClient {
 constructor({onSnapshot,onStatus,onWelcome}){
  Object.assign(this,{onSnapshot,onStatus,onWelcome});this.connected=false;this.seq=0;this.pending=[];this.input={x:0,z:0,angle:0};this.attempt=0;this.worldId=null;this.closed=false;
  try{this.token=sessionStorage.getItem('hallowmere-resume');this.worldId=sessionStorage.getItem('hallowmere-world');}catch{}
 }
 async start(){
  this.onStatus('Connecting to game server…',false);
  try{const response=await fetch(new URL('./multiplayer-config.json',import.meta.url),{cache:'no-store',signal:AbortSignal.timeout(8000)});if(!response.ok)throw Error();const config=await response.json();
   this.url=config.serverUrl||`${location.protocol==='https:'?'wss:':'ws:'}//${location.host}/multiplayer`;
   const url=new URL(this.url);if(!['ws:','wss:'].includes(url.protocol)||(location.protocol==='https:'&&url.protocol!=='wss:'))throw Error();this.connect();
  }catch{this.onStatus('The game server is unavailable. Please retry the connection.',false,{retryable:true,failed:true});}
  this.interval=setInterval(()=>{if(this.connected){if(performance.now()-this.lastSnapshot>4000){this.socket.close();return;}this.send('input',this.input);}},50);
  this.onHidden=()=>{this.input={x:0,z:0,angle:this.input.angle};this.send('input',this.input);};
  document.addEventListener('visibilitychange',this.onHidden);
  window.addEventListener('pagehide',()=>this.close(),{once:true});
 }
 connect(){
  if(this.closed)return;this.onStatus(this.attempt?'Reconnecting to game server…':'Connecting to game server…',false,{retryable:this.attempt>0});
  const ws=this.socket=new WebSocket(this.url);let terminal=false;const timeout=setTimeout(()=>ws.close(),8000);
  ws.onopen=()=>{this.onStatus('Joining the shared world…',false,{retryable:this.attempt>0});ws.send(JSON.stringify({v:PROTOCOL_VERSION,type:'join',token:this.token||undefined}));};
  ws.onmessage=event=>{
   let m;try{m=JSON.parse(event.data);}catch{return;}
   if(m.v!==PROTOCOL_VERSION){terminal=true;this.connected=false;clearTimeout(timeout);this.onStatus('The game and server versions differ. Reload after the server has been updated.',false,{retryable:true,failed:true});ws.close();return;}
   if(m.type==='error'&&m.code==='IDENTITY_IN_USE'){this.token=null;try{sessionStorage.removeItem('hallowmere-resume');}catch{}return;}
   if(m.type==='error'){terminal=!!m.terminal;this.onStatus(m.message,false,{retryable:true,failed:terminal});return;}
   if(m.type==='welcome'){
    this.id=m.id;this.token=m.token;this.seq=0;this.pending=[];this.input={x:0,z:0,angle:0};
    try{sessionStorage.setItem('hallowmere-resume',m.token);}catch{}
    this.onStatus('Syncing game world…',false,{retryable:this.attempt>0});
    this.onWelcome?.(m);return;
   }
   if(m.type==='snapshot'){
    clearTimeout(timeout);const changed=!!this.worldId&&this.worldId!==m.worldId;
    const mapId=m.mapId||m.state?.mapId||m.players?.find(p=>p.id===m.you)?.mapId||'overworld';
    if(changed||this.mapId&&this.mapId!==mapId){this.pending=[];this.input={x:0,z:0,angle:0};}
    this.mapId=mapId;this.worldId=m.worldId;try{sessionStorage.setItem('hallowmere-world',m.worldId);}catch{}this.lastSnapshot=performance.now();this.connected=true;this.attempt=0;
    this.pending=this.pending.filter(p=>p.seq>m.ack);this.onSnapshot(m,changed);
   }
  };
  ws.onerror=()=>{};
  ws.onclose=()=>{clearTimeout(timeout);this.connected=false;this.pending=[];this.input={x:0,z:0,angle:0};if(this.closed||terminal)return;
   this.onStatus('Connection interrupted. Reconnecting automatically…',false,{retryable:true});const wait=Math.min(10000,500*2**this.attempt++);this.retry=setTimeout(()=>this.connect(),wait+Math.random()*200);
  };
 }
 send(type,data={}){
  if(!this.connected||this.socket?.readyState!==1)return false;
  const message={v:PROTOCOL_VERSION,type,...data,seq:++this.seq,worldId:this.worldId};
  if(type==='input'){this.pending.push(message);if(this.pending.length>80)this.pending.shift();}
  this.socket.send(JSON.stringify(message));return true;
 }
 close(){this.closed=true;this.connected=false;clearInterval(this.interval);clearTimeout(this.retry);document.removeEventListener('visibilitychange',this.onHidden);this.socket?.close();}
}
