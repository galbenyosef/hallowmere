import {World} from './world.js';
import {TICK_SECONDS} from './multiplayer-protocol.js';
import {captureJourney,restoreJourney} from './journey-state.js';

// The renderer consumes the same detached snapshots in both game modes.
export class LocalSession {
 constructor({onSnapshot,onWelcome,onStatus,onProgress,seed,save}){Object.assign(this,{onSnapshot,onWelcome,onStatus,onProgress,seed,save});this.connected=false;this.closed=false;this.pending=[];this.input={x:0,z:0,angle:0};this.seq=0;this.debt=0;this.lastEvent=0;}
 start(){
  if(this.closed||this.connected)return;
  this.world=new World({seed:this.save?.seed??this.seed,local:true});this.id=this.world.join().player.id;
  if(this.save){restoreJourney(this.world,this.id,this.save);this.restored=true;this.save=null;}
  this.worldId=this.world.id;this.lastEvent=this.world.eventId;this.connected=true;
  this.onWelcome?.({id:this.id,worldId:this.worldId});this.publish();
 }
 send(type,data={}){
  if(!this.connected||this.closed)return false;
  // A journey is one continuous campaign: its character can change, its world never restarts.
  if(this.restored&&type==='restart')return false;
  if(type==='restart'){this.world.reset();this.debt=0;this.input={x:0,z:0,angle:0};}
  else this.world.command(this.id,{type,...data,seq:++this.seq,worldId:this.world.id});
  if(type!=='input')this.onProgress?.(true);
  // Command results must arrive after callers enter their pending UI state.
  if(type!=='input'&&!this.publishQueued){this.publishQueued=true;queueMicrotask(()=>{this.publishQueued=false;if(!this.closed)this.publish();});}
  return true;
 }
 advance(elapsed,paused=false){
  if(!this.connected||this.closed)return;
  if(paused){this.debt=0;return;}
  this.debt+=Math.min(Math.max(elapsed,0),.25);let stepped=false;
  while(this.debt>=TICK_SECONDS){this.send('input',this.input);this.world.step(TICK_SECONDS);this.debt-=TICK_SECONDS;stepped=true;}
  if(stepped){this.onProgress?.(this.world.eventId>this.lastEvent);this.publish();}
 }
 publish(){
  const changed=this.worldId!==this.world.id;if(changed){this.lastEvent=0;this.pending=[];this.worldId=this.world.id;}
  const snapshot=this.world.snapshot(this.id,this.lastEvent);this.lastEvent=this.world.eventId;this.mapId=snapshot.mapId;this.onSnapshot(snapshot,changed);
 }
 close(){this.closed=true;this.connected=false;this.pending=[];this.debt=0;}
 capture(){return captureJourney(this.world,this.id);}
}
