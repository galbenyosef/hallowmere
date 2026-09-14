import {createForagingState,advanceForaging} from './foraging.js';
import {abilitiesFor,classFor} from './classes.js';
export const ENEMY_TYPES={hollow:{name:'Hollow',hp:64,speed:1.85,range:1.65,damage:12,windup:.8,cooldown:1.8,reward:18},hound:{name:'Grave hound',hp:48,speed:3.3,range:1.7,damage:10,windup:.66,cooldown:1.8,reward:16},revenant:{name:'Cinder revenant',hp:82,speed:1.5,range:7.5,damage:16,windup:1.25,cooldown:3.8,reward:28},boss:{name:'The Bellkeeper',hp:720,speed:1.65,range:3.4,damage:28,windup:1.4,cooldown:2.8,reward:200}};
Object.assign(ENEMY_TYPES,{
 hunter:{name:'Thorn hunter',modelType:'hound',hp:112,speed:3.1,range:1.8,damage:15,windup:.8,cooldown:2.2,reward:23},
 rootling:{name:'Rootling',modelType:'hollow',hp:135,speed:1.7,range:7,damage:17,windup:1.25,cooldown:3.6,reward:27},
 miner:{name:'Forsaken miner',modelType:'hollow',hp:175,speed:2,range:6,damage:21,windup:1.3,cooldown:3.3,reward:30},
 'quarry-mage':{name:'Quarry hexer',modelType:'revenant',hp:145,speed:1.65,range:8,damage:23,windup:1.5,cooldown:3.8,reward:34},
 sentinel:{name:'Crown sentinel',modelType:'hollow',hp:230,speed:1.8,range:2.3,damage:25,windup:1,cooldown:2.4,reward:36},
 pyromancer:{name:'Ash pyromancer',modelType:'revenant',hp:185,speed:1.65,range:8,damage:26,windup:1.5,cooldown:4,reward:40},
 rootbound:{name:'The Rootbound',modelType:'boss',boss:true,hp:3000,speed:1.75,range:9,damage:26,windup:1.4,cooldown:2.9,reward:240},
 'quarry-warden':{name:'The Quarry Warden',modelType:'boss',boss:true,hp:4600,speed:1.8,range:10,damage:31,windup:1.6,cooldown:2.8,reward:290},
 'ash-regent':{name:'The Ash Regent',modelType:'boss',boss:true,hp:6400,speed:2,range:11,damage:35,windup:1.6,cooldown:2.6,reward:350}
});
export const SPAWNS=[['hollow',-4,3],['hollow',5,-1],['hound',7.8,7],['hollow',-6,-4],['hound',-4,-9],['revenant',6,-10],['hollow',-7.4,10],['hound',10,11],['hollow',-8,-14],['revenant',8,-16],['hound',-2,-10],['revenant',2,-24]];
export const ABILITIES={attack:{cooldown:.48,cost:0},bolt:{cooldown:1.2,cost:18},dodge:{cooldown:1.9,cost:0},nova:{cooldown:6,cost:35},heal:{cooldown:1,cost:0}};
export const clamp=(v,min,max)=>Math.max(min,Math.min(max,v));
export const distance=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z);
export function withinArc(origin,target,angle,range,arc){const dx=target.x-origin.x,dz=target.z-origin.z,d=Math.hypot(dx,dz);if(d>range)return false;if(d<.3)return true;return(dx*Math.sin(angle)+dz*Math.cos(angle))/d>=Math.cos(arc*.5);}
function obstacleLocal(o,p){const c=o.cos??Math.cos(o.rotation||0),s=o.sin??Math.sin(o.rotation||0),x=p.x-o.x,z=p.z-o.z;return{x:c*x-s*z,z:s*x+c*z};}
export function pointBlocked(position,obstacles,radius=.42){return obstacles.some(o=>{if(o.disabled)return false;const p=obstacleLocal(o,position);return Math.abs(p.x)<o.w/2+radius-1e-8&&Math.abs(p.z)<o.d/2+radius-1e-8;});}
export function resolveMove(position,dx,dz,obstacles,radius=.4,boundary=25){
 const bounds=typeof boundary==='number'?{minX:-boundary,maxX:boundary,minZ:-boundary,maxZ:boundary}:boundary;
 let p={x:position.x,z:position.z};const steps=Math.max(1,Math.ceil(Math.hypot(dx,dz)/Math.min(.16,Math.max(.03,radius*.5))));dx/=steps;dz/=steps;
 const bounded=(x,z)=>({x:clamp(x,bounds.minX,bounds.maxX),z:clamp(z,bounds.minZ,bounds.maxZ)});
 for(let i=0;i<steps;i++){
  const next=bounded(p.x+dx,p.z+dz);
  if(!pointBlocked(next,obstacles,radius)){p=next;continue;}
  // Project onto a rotated wall's tangent so joystick movement slides naturally.
  let vx=dx,vz=dz;
  for(const o of obstacles){if(o.disabled||!pointBlocked(next,[o],radius))continue;const q=obstacleLocal(o,p),c=o.cos??Math.cos(o.rotation||0),s=o.sin??Math.sin(o.rotation||0);let nx,nz;if(o.w/2+radius-Math.abs(q.x)<o.d/2+radius-Math.abs(q.z)){nx=Math.sign(q.x)*c;nz=-Math.sign(q.x)*s;}else{nx=Math.sign(q.z)*s;nz=Math.sign(q.z)*c;}const inward=Math.min(0,vx*nx+vz*nz);vx-=inward*nx;vz-=inward*nz;}
  const slide=bounded(p.x+vx,p.z+vz);
  if(!pointBlocked(slide,obstacles,radius)){p=slide;continue;}
  const horizontal=bounded(p.x+dx,p.z);if(!pointBlocked(horizontal,obstacles,radius))p=horizontal;
  const vertical=bounded(p.x,p.z+dz);if(!pointBlocked(vertical,obstacles,radius))p=vertical;
 }
 return p;
}
export function segmentHitsCircle(a,b,c,radius){const dx=b.x-a.x,dz=b.z-a.z,length=dx*dx+dz*dz,t=length?clamp(((c.x-a.x)*dx+(c.z-a.z)*dz)/length,0,1):0;return Math.hypot(a.x+t*dx-c.x,a.z+t*dz-c.z)<=radius;}
export function canUse(state,ability){const a=abilitiesFor(state)[ability];return!!a&&state.hp>0&&!state.ended&&state.cooldowns[ability]<=0&&state.mana>=a.cost&&(ability!=='heal'||state.potions>0&&state.hp<state.maxHp);}
export function useAbility(state,ability){if(!canUse(state,ability))return false;const a=abilitiesFor(state)[ability];state.cooldowns[ability]=a.cooldown;state.mana-=a.cost;if(ability==='heal'){state.potions--;state.hp=Math.min(state.maxHp,state.hp+65);}return true;}
export function createState(){return{...createForagingState(),hp:140,maxHp:140,mana:100,maxMana:100,potions:3,kills:0,souls:0,level:1,time:0,ended:false,victory:false,bossSpawned:false,cooldowns:Object.fromEntries(Object.keys(ABILITIES).map(k=>[k,0])),invulnerable:0};}
export function advanceState(state,dt){advanceForaging(state,dt);if(state.ended)return;state.time+=dt;for(const key of ['guardTime','shieldTime','concealed','boostTime','valkyrieTime'])state[key]=Math.max(0,(state[key]||0)-dt);if(!state.shieldTime)state.shield=0;if(!state.boostTime)state.damageBoost=0;state.invulnerable=Math.max(0,state.invulnerable-dt);state.mana=Math.min(state.maxMana,state.mana+dt*classFor(state).regen);for(const key in state.cooldowns)state.cooldowns[key]=Math.max(0,state.cooldowns[key]-dt);}
export function hurtPlayer(state,damage){if(state.ended||state.invulnerable>0)return 0;damage*=1-(state.guardTime>0?state.guard||0:0);const absorbed=Math.min(state.shieldTime>0?state.shield||0:0,damage);state.shield=Math.max(0,(state.shield||0)-absorbed);const dealt=Math.min(state.hp,Math.max(0,Math.round(damage-absorbed)));if(!dealt)return 0;state.hp-=dealt;state.invulnerable=.32;if(state.hp===0){state.ended=true;state.essenceRegen=0;state.boostTime=state.damageBoost=state.valkyrieTime=0;}return dealt;}
// Preserve the original vigil's first eight levels, then widen each XP band.
export function levelForSouls(souls){
 const total=Math.max(0,Number.isFinite(souls)?souls:0);
 if(total<700)return 1+Math.floor(total/100);
 let level=8,remaining=total-700,cost=100;
 while(remaining>=cost){remaining-=cost;level++;cost+=50;}
 return level;
}
export function awardKill(state,type){const reward=ENEMY_TYPES[type].reward;state.kills++;state.souls+=reward;const newLevel=levelForSouls(state.souls);if(newLevel>state.level){state.maxHp=(state.baseHp||140)+(newLevel-1)*15+(state.healthBonus??0);state.hp=Math.min(state.maxHp,state.hp+35);state.level=newLevel;}if(type==='boss'){state.victory=true;}return reward;}
// A* checks the same oriented walls as walking, dodging, and projectiles.
export function findPath(start,goal,obstacles,bounds={minX:-25,maxX:25,minZ:-25,maxZ:25}){
 const step=.5,key=(x,z)=>`${x},${z}`,cache=new Map();
 const outside=p=>p.x<bounds.minX||p.x>bounds.maxX||p.z<bounds.minZ||p.z>bounds.maxZ;
 if(outside(goal)||pointBlocked(goal,obstacles))return[];
 if(!outside(start)&&hasLineOfSight(start,goal,obstacles,.42)){
  const count=Math.max(1,Math.ceil(distance(start,goal)/step));
  return Array.from({length:count},(_,i)=>i===count-1?{x:goal.x,z:goal.z}:{x:start.x+(goal.x-start.x)*(i+1)/count,z:start.z+(goal.z-start.z)*(i+1)/count});
 }
 const blocked=(x,z)=>{const k=key(x,z);if(!cache.has(k)){const p={x:x*step,z:z*step};cache.set(k,outside(p)||pointBlocked(p,obstacles));}return cache.get(k);};
 const cell=p=>{const x=Math.round(p.x/step),z=Math.round(p.z/step),candidates=[];for(let dx=-1;dx<=1;dx++)for(let dz=-1;dz<=1;dz++){const q={x:x+dx,z:z+dz},world={x:q.x*step,z:q.z*step};if(!blocked(q.x,q.z)&&hasLineOfSight(p,world,obstacles,.42))candidates.push({...q,d:distance(p,world)});}return candidates.sort((a,b)=>a.d-b.d)[0];};
 const from=cell(start),to=cell(goal);if(!from||!to)return[];
 if(from.x===to.x&&from.z===to.z&&hasLineOfSight(start,goal,obstacles,.42))return[{x:goal.x,z:goal.z}];
 const heuristic=(x,z)=>Math.hypot(x-to.x,z-to.z),open=[{...from,g:0,f:heuristic(from.x,from.z)}],scores=new Map([[key(from.x,from.z),0]]),parents=new Map(),closed=new Set();let found=null;
 // A heap keeps long detours efficient. The finite map grid bounds the search;
 // a fixed pop limit incorrectly marked distant expanded chambers unreachable.
 const before=(a,b)=>a.f<b.f||(a.f===b.f&&a.g>b.g);
 const push=node=>{let i=open.length;open.push(node);while(i){const parent=(i-1)>>1;if(!before(node,open[parent]))break;open[i]=open[parent];i=parent;}open[i]=node;};
 const pop=()=>{const first=open[0],last=open.pop();if(open.length){let i=0;while(i*2+1<open.length){let child=i*2+1;if(child+1<open.length&&before(open[child+1],open[child]))child++;if(!before(open[child],last))break;open[i]=open[child];i=child;}open[i]=last;}return first;};
 while(open.length){
  const current=pop(),k=key(current.x,current.z);if(closed.has(k))continue;if(current.x===to.x&&current.z===to.z){found=k;break;}closed.add(k);
  for(const[dx,dz]of[[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]]){
   const x=current.x+dx,z=current.z+dz,n=key(x,z);if(closed.has(n)||blocked(x,z)||(dx&&dz&&(blocked(current.x+dx,current.z)||blocked(current.x,current.z+dz))))continue;
   if(!hasLineOfSight({x:current.x*step,z:current.z*step},{x:x*step,z:z*step},obstacles,.42))continue;
   const g=current.g+Math.hypot(dx,dz);if(g>=(scores.get(n)??Infinity))continue;scores.set(n,g);parents.set(n,k);push({x,z,g,f:g+heuristic(x,z)});
  }
 }
 if(!found)return[];const path=[{x:goal.x,z:goal.z}];while(found){const[x,z]=found.split(',').map(Number);path.unshift({x:x*step,z:z*step});found=parents.get(found);}return path;
}
export function hasLineOfSight(a,b,obstacles,padding=.1){return !obstacles.some(o=>{
 if(o.disabled)return false;const start=obstacleLocal(o,a),end=obstacleLocal(o,b);let enter=0,leave=1;
 for(const axis of ['x','z']){const half=(axis==='x'?o.w:o.d)/2+padding,d=end[axis]-start[axis];if(Math.abs(d)<1e-8){if(start[axis]<-half||start[axis]>half)return false;continue;}let t0=(-half-start[axis])/d,t1=(half-start[axis])/d;if(t0>t1)[t0,t1]=[t1,t0];enter=Math.max(enter,t0);leave=Math.min(leave,t1);if(enter>leave)return false;}return leave>=0&&enter<=1;
 });}
