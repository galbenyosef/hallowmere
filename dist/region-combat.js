import {randomUUID} from './world-random.js';
import {ENEMY_TYPES,distance,hasLineOfSight} from './combat.js';
import {sameMap,MAPS,availablePortal} from './regions.js';
import {isSanctuary} from './campaign.js';

const progressFor=world=>({victory:world.shared?.victory??world.victory,regionProgress:world.shared?.regionProgress??world.regionProgress});
const obstacles=(world,e)=>world.obstaclesFor?.(e)||world.obstacles||[];
function hazard(world,e,kind,position,shape,delay,damage,extra={}){
 world.hazards??=[];
 world.hazards.push({id:randomUUID(),ownerId:e.id,mapId:e.mapId,kind,originX:e.x,originZ:e.z,x:position.x,z:position.z,...shape,start:world.time,activateAt:world.time+delay,until:world.time+delay+.45,damage,...extra});
}
function attack(world,e,target,data){
 const n=e.attackCount||0,delay=data.windup,aim={x:target.x,z:target.z};
 e.attackAngle=Math.atan2(aim.x-e.x,aim.z-e.z);e.aim=aim;
 const circle=(kind,p,r,extra={})=>hazard(world,e,kind,p,{radius:r},delay,data.damage,extra);
 const lane=(kind,p,w,d,angle=e.attackAngle)=>hazard(world,e,kind,p,{w,d,angle},delay,data.damage);
 if(e.type==='hunter'){
  lane('sweep',{x:e.x+Math.sin(e.attackAngle)*data.range/2,z:e.z+Math.cos(e.attackAngle)*data.range/2},1.4,data.range+.4);
 }else if(e.type==='rootling'||e.type==='rootbound'&&n%2===0){
  circle('roots',aim,1.5,{root:.7});
  if(data.boss)for(const side of [-1,1])circle('roots',{x:aim.x+side*3.8,z:aim.z},1.4,{root:.7});
 }else if(e.type==='miner'||e.type==='quarry-warden'&&n%2===0){
  const length=Math.min(8,distance(e,target)+1),center={x:e.x+Math.sin(e.attackAngle)*length/2,z:e.z+Math.cos(e.attackAngle)*length/2};
  lane('charge',center,data.boss?2.6:1.6,length);e.chargeDistance=length;
 }else if(e.type==='quarry-mage'||e.type==='quarry-warden'){
  circle('rockfall',aim,1.8);
  if(data.boss)for(const offset of [-4,4])circle('rockfall',{x:aim.x+offset,z:aim.z+2},1.5);
 }else if(e.type==='pyromancer'||e.type==='ash-regent'){
  // The empty spaces between lanes remain safe throughout every phase.
  const stage=e.bossStage||1,angle=n%2?Math.PI/2:0;
  for(let i=0;i<stage;i++)lane('flame',{x:aim.x+(angle?0:(i-(stage-1)/2)*4),z:aim.z+(angle?(i-(stage-1)/2)*4:0)},1.8,12,angle);
  if(stage>=2&&n%2===0)circle('rockfall',{x:aim.x+3,z:aim.z+3},1.5);
  if(stage===3&&n%3===0)circle('roots',{x:aim.x-3,z:aim.z-3},1.3,{root:.6});
 }else if(e.type==='rootbound'){
  lane('sweep',{x:e.x+Math.sin(e.attackAngle)*2,z:e.z+Math.cos(e.attackAngle)*2},6,4);
 }else{
  lane('sweep',{x:e.x+Math.sin(e.attackAngle)*data.range/2,z:e.z+Math.cos(e.attackAngle)*data.range/2},1.7,data.range+.4);
 }
 e.phase='windup';e.timer=delay;
 world.emit?.('windup',{enemyId:e.id,mapId:e.mapId});
}

export function updateRegionEnemy(world,e,players,dt){
 if(!ENEMY_TYPES[e.type]?.regionalAttack)return false;
 if(e.hp<=0||!availablePortal(e,progressFor(world)))return true;
 const data=ENEMY_TYPES[e.type],home=e.home||e;e.moving=false;
 const living=players.filter(p=>sameMap(e,p)&&!p.state.ended&&p.state.hp>0&&!isSanctuary(p));
 const participants=living.filter(p=>distance(home,p)<30);
 if(data.boss&&e.engaged&&!participants.length){
  for(const cover of obstacles(world,e))if(cover.destructible)cover.disabled=false;
  e.hp=e.maxHp=e.baseMaxHp||data.hp;e.engaged=false;e.phase='idle';e.cooldown=1;e.timer=0;e.attackCount=0;e.chargeDistance=0;e.bossStage=1;e.exposedUntil=0;e.rootUntil=0;e.slow=0;e.dots=[];e.path=[];e.x=home.x;e.z=home.z;
  world.hazards=(world.hazards||[]).filter(h=>h.ownerId!==e.id);
  world.projectiles=(world.projectiles||[]).filter(b=>b.ownerId!==e.id);
  return true;
 }
 // An empty map has no combat simulation or hidden damage.
 if(!living.length)return true;
 e.cooldown=Math.max(0,(e.cooldown||0)-dt);
 if(world.time<(e.rootUntil||0))return true;
 if(e.phase==='windup'){
  e.timer-=dt;
  if(e.timer<=0){
   world.emit?.('strike',{enemyId:e.id,mapId:e.mapId,x:e.x,z:e.z,angle:e.attackAngle,typeName:e.type});
   if(e.chargeDistance){
    for(const cover of obstacles(world,e))if(cover.destructible&&!cover.disabled){
     const dx=cover.x-e.x,dz=cover.z-e.z,c=Math.cos(e.attackAngle),s=Math.sin(e.attackAngle);
     if(Math.abs(c*dx-s*dz)<(data.boss?1.3:.8)+cover.w/2&&s*dx+c*dz>=-cover.d/2&&s*dx+c*dz<=e.chargeDistance+cover.d/2)cover.disabled=true;
    }
    world.move(e,Math.sin(e.attackAngle)*e.chargeDistance,Math.cos(e.attackAngle)*e.chargeDistance,data.boss?.85:.37);e.chargeDistance=0;}
   e.phase='recover';e.timer=data.boss?1.25:.6;e.exposedUntil=data.boss?world.time+e.timer:0;e.cooldown=data.cooldown;e.attackCount=(e.attackCount||0)+1;
  }
  return true;
 }
 if(e.phase==='recover'){e.timer-=dt;if(e.timer<=0)e.phase='idle';return true;}
 const target=living.filter(p=>!p.state.concealed).sort((a,b)=>distance(e,a)-distance(e,b))[0];
 if(!target)return true;
 const dist=distance(e,target),range=e.type==='rootbound'&&(e.attackCount||0)%2===1?3.7:data.range;
 if(!e.engaged&&dist>(data.boss?15:10.5)&&e.hp===e.maxHp)return true;
 if(!e.engaged){
  e.engaged=true;e.baseMaxHp??=e.maxHp||data.hp;
  const allies=living.filter(p=>distance(e,p)<18).length,ratio=e.hp/e.maxHp;
  e.maxHp=Math.round(e.baseMaxHp*(1+.45*Math.max(0,allies-1)));e.hp=Math.max(1,Math.round(e.maxHp*ratio));
 }
 e.bossStage=e.type==='ash-regent'?(e.hp/e.maxHp<=.33?3:e.hp/e.maxHp<=.66?2:1):1;
 e.angle=Math.atan2(target.x-e.x,target.z-e.z);
 if(dist>range*.85||!hasLineOfSight(e,target,obstacles(world,e),.43)){
  if(e.type==='hunter'&&dist<7&&dist>2.4&&hasLineOfSight(e,target,obstacles(world,e),.43)){
   const side=e.id.charCodeAt(e.id.length-1)%2?1:-1;
   world.seek(e,{x:target.x+Math.cos(e.angle)*side*1.6,z:target.z-Math.sin(e.angle)*side*1.6},dt);
  }else world.seek(e,target,dt);
 }
 if(distance(e,target)<=range&&e.cooldown<=0&&hasLineOfSight(e,target,obstacles(world,e)))attack(world,e,target,data);
 return true;
}

export function stepRegionHazards(world,dt){
 const players=world.connected();
 world.hazards??=[];world.regionHazardCycles??=new Map();
 for(const map of Object.values(MAPS))for(const spec of map.hazards||[]){
  const cycle=Math.floor((world.time-(spec.offset||0))/spec.period),key=`${map.id}:${spec.id}`;
  const active=players.some(p=>sameMap(p,{mapId:map.id})&&!p.state.ended&&p.state.hp>0);
  if(!active||!availablePortal(spec,progressFor(world))){world.regionHazardCycles.set(key,cycle);continue;}
  if(world.regionHazardCycles.get(key)===cycle)continue;
  world.regionHazardCycles.set(key,cycle);
  world.hazards.push({id:randomUUID(),environmental:true,mapId:map.id,kind:spec.type,x:spec.x,z:spec.z,radius:spec.radius,damage:spec.damage,start:world.time,activateAt:world.time+spec.telegraph,until:world.time+spec.telegraph+spec.active,...(spec.type==='roots'?{root:.6}:{})});
 }
 world.hazards=(world.hazards||[]).filter(h=>{
  const owner=world.enemies.find(e=>e.id===h.ownerId);
  if(!h.environmental&&(!owner||owner.hp<=0))return false;
  if(!players.some(p=>sameMap(p,h)&&!p.state.ended)){h.start+=dt;h.activateAt+=dt;h.until+=dt;return true;}
  if(world.time>=h.activateAt){
   h.hitIds??=[];
   for(const p of players){
    if(!sameMap(p,h)||p.state.ended||isSanctuary(p)||h.hitIds.includes(p.id))continue;
    const dx=p.x-h.x,dz=p.z-h.z,c=Math.cos(h.angle||0),s=Math.sin(h.angle||0);
    const inside=h.radius!==undefined?Math.hypot(dx,dz)<=h.radius:Math.abs(c*dx-s*dz)<=h.w/2&&Math.abs(s*dx+c*dz)<=h.d/2;
    const directed= h.kind==='charge'||h.kind==='sweep';
    const clearApproach=!directed||hasLineOfSight({x:h.originX??h.x,z:h.originZ??h.z},p,obstacles(world,h));
    if(inside&&clearApproach&&hasLineOfSight(h,p,obstacles(world,h))){
     h.hitIds.push(p.id);const hp=p.state.hp;world.damagePlayer(p,h.damage);
     if(h.root&&p.state.hp<hp)p.rootUntil=Math.max(p.rootUntil||0,world.time+h.root);
    }
   }
  }
  return world.time<h.until;
 });
}
