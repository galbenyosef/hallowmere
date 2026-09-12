import {PROTOCOL_VERSION,PLAYER_SPEED} from './multiplayer-protocol.js';
import {resolveMove,distance} from './combat.js';
import {WORLD_BOUNDS} from './campaign.js';

export function predictedPosition(position,pending,ack,obstacles){
 let result={x:position.x,z:position.z};
 for(const input of pending)if(input.seq>ack){const travel=input.stopAt?Math.min((position.speed||PLAYER_SPEED)*.05,distance(result,input.stopAt)):(position.speed||PLAYER_SPEED)*.05;result=resolveMove(result,input.x*travel,input.z*travel,obstacles,.42,WORLD_BOUNDS);}
 return result;
}
export class MultiplayerClient {
 constructor({onSnapshot,onStatus,onWelcome}){
  Object.assign(this,{onSnapshot,onStatus,onWelcome});this.connected=false;this.seq=0;this.pending=[];this.input={x:0,z:0,angle:0};this.attempt=0;this.worldId=null;this.closed=false;
  try{this.token=sessionStorage.getItem('hallowmere-resume');this.worldId=sessionStorage.getItem('hallowmere-world');}catch{}
 }
 async start(){
  try{const response=await fetch(new URL('./multiplayer-config.json',import.meta.url),{cache:'no-store'});if(!response.ok)throw Error();const config=await response.json();
   this.url=config.serverUrl||`${location.protocol==='https:'?'wss:':'ws:'}//${location.host}/multiplayer`;
   const url=new URL(this.url);if(!['ws:','wss:'].includes(url.protocol)||(location.protocol==='https:'&&url.protocol!=='wss:'))throw Error();this.connect();
  }catch{this.onStatus('Multiplayer is unavailable. Please reload to try again.',false);}
  this.interval=setInterval(()=>{if(this.connected){if(performance.now()-this.lastSnapshot>4000){this.socket.close();return;}this.send('input',this.input);}},50);
  this.onHidden=()=>{this.input={x:0,z:0,angle:this.input.angle};this.send('input',this.input);};
  document.addEventListener('visibilitychange',this.onHidden);
  window.addEventListener('pagehide',()=>this.close(),{once:true});
 }
 connect(){
  if(this.closed)return;this.onStatus(this.attempt?'Reconnecting to the vigil…':'Joining the shared vigil…',false);
  const ws=this.socket=new WebSocket(this.url);let terminal=false;const timeout=setTimeout(()=>ws.close(),8000);
  ws.onopen=()=>ws.send(JSON.stringify({v:PROTOCOL_VERSION,type:'join',token:this.token||undefined}));
  ws.onmessage=event=>{
   let m;try{m=JSON.parse(event.data);}catch{return;}
   if(m.v!==PROTOCOL_VERSION)return;
   if(m.type==='error'&&m.code==='IDENTITY_IN_USE'){this.token=null;try{sessionStorage.removeItem('hallowmere-resume');}catch{}return;}
   if(m.type==='error'){terminal=!!m.terminal;this.onStatus(m.message,false);return;}
   if(m.type==='welcome'){
    clearTimeout(timeout);this.id=m.id;this.token=m.token;this.seq=0;this.pending=[];this.input={x:0,z:0,angle:0};
    try{sessionStorage.setItem('hallowmere-resume',m.token);}catch{}
    this.onWelcome?.(m);return;
   }
   if(m.type==='snapshot'){
    clearTimeout(timeout);const changed=!!this.worldId&&this.worldId!==m.worldId;
    if(changed){this.pending=[];this.input={x:0,z:0,angle:0};}
    this.worldId=m.worldId;try{sessionStorage.setItem('hallowmere-world',m.worldId);}catch{}this.lastSnapshot=performance.now();this.connected=true;this.attempt=0;
    this.pending=this.pending.filter(p=>p.seq>m.ack);this.onSnapshot(m,changed);
   }
  };
  ws.onerror=()=>{};
  ws.onclose=()=>{clearTimeout(timeout);this.connected=false;this.pending=[];this.input={x:0,z:0,angle:0};if(this.closed||terminal)return;
   this.onStatus('Connection lost · Reconnecting…',false);const wait=Math.min(10000,500*2**this.attempt++);this.retry=setTimeout(()=>this.connect(),wait+Math.random()*200);
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
