import {resolveMove,distance} from './combat.js';
import {WORLD_BOUNDS} from './campaign.js';
import {angleLerp} from './multiplayer-protocol.js';

// Corrections are displacement still owed, not a stale destination to chase.
// New local movement remains immediate while the error decays across frames.
export class MovementCorrection {
 constructor(){this.reset();}
 reset(){this.x=0;this.z=0;}
 reconcile(position,target,snap=false,maxError=1.5){
  if(snap||distance(position,target)>maxError){position.x=target.x;position.z=target.z;this.reset();return;}
  this.x=target.x-position.x;this.z=target.z-position.z;
 }
 update(position,dt,obstacles,bounds=WORLD_BOUNDS){
  const error=Math.hypot(this.x,this.z);if(!error||dt<=0)return;
  // Cap correction velocity so normal walking cannot reverse on a late packet.
  const blend=Math.min(1-Math.exp(-12*dt),2.4*dt/error),dx=this.x*blend,dz=this.z*blend;
  const next=resolveMove(position,dx,dz,obstacles,.42,bounds);
  position.x=next.x;position.z=next.z;this.x-=dx;this.z-=dz;
  if(Math.hypot(this.x,this.z)<.0001)this.reset();
 }
}

export function predictDodge(position,angle,remaining,dt,obstacles,bounds=WORLD_BOUNDS){
 const travel=Math.min(remaining,dt)*15;
 return {...resolveMove(position,Math.sin(angle)*travel,Math.cos(angle)*travel,obstacles,.42,bounds),remaining:Math.max(0,remaining-dt)};
}

// Render allies slightly behind the server, between real simulation samples.
// Interpolating to the latest packet with easing makes every step speed up and
// slow down; a timestamped buffer keeps steady movement at a steady speed.
export const INTERPOLATION_DELAY=.2;
export class MovementBuffer {
 constructor(){this.samples=[];}
 push(state,time,reset=false){
  const last=this.samples.at(-1);
  const discontinuity=reset||!last||last.mapId!==state.mapId||last.ended&&!state.ended||time<last.time||distance(last,state)>Math.max(4,(time-last.time)*20);
  if(discontinuity)this.samples=[];
  else if(time===last.time)return false;
  this.samples.push({...state,angle:state.angle||0,time});if(this.samples.length>32)this.samples.shift();
  return discontinuity;
 }
 sample(time){
  const samples=this.samples;if(!samples.length)return null;
  while(samples.length>2&&samples[1].time<=time)samples.shift();
  const a=samples[0],b=samples[1];
  if(time<a.time)return {...a,moving:false};
  if(!b||time>=b.time)return {...(b||a),moving:false};
  const blend=(time-a.time)/(b.time-a.time);
  return {...a,x:a.x+(b.x-a.x)*blend,z:a.z+(b.z-a.z)*blend,angle:angleLerp(a.angle||0,b.angle||0,blend),moving:distance(a,b)>.001};
 }
}
