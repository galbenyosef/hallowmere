import {sameMap} from './regions.js';
import {randomUUID} from './world-random.js';
import {abilitiesFor,classFor,classColor,applyClass,weaponForClass} from './classes.js';
import {useAbility,ENEMY_TYPES,distance,withinArc,hasLineOfSight,pointBlocked} from './combat.js';
import {isSanctuary,WORLD_BOUNDS,ITEM_TEMPLATES} from './campaign.js';

export function selectClass(world,p,message){
 if(!isSanctuary(p)||p.state.ended){world.result(p,{ok:false,operation:'class',reason:'Return to a sanctuary before changing class.'});return false;}
 const oldClass=p.state.classId,oldAppearance=p.state.appearanceId;
 if(!applyClass(p.state,message.classId,message.appearanceId)){world.result(p,{ok:false,operation:'class',reason:'Choose one of the six classes and an available appearance.'});return false;}
 p.state.inventory=p.state.inventory.map(item=>weaponForClass(item,p.state));
 for(const drop of p.loot)if(!drop.claimed&&drop.kind==='item')drop.name=weaponForClass({template:drop.template,...ITEM_TEMPLATES[drop.template]},p.state).name;
 if(oldClass!==p.state.classId||oldAppearance!==p.state.appearanceId){
  // A new look cannot reset combat costs, cooldowns, damage, or possessions.
  for(const key in p.state.cooldowns)p.state.cooldowns[key]=Math.max(p.state.cooldowns[key],oldClass?1:0);
  world.hits=world.hits.filter(hit=>hit.playerId!==p.id);world.projectiles=world.projectiles.filter(b=>b.ownerId!==p.id);world.zones=world.zones.filter(z=>z.ownerId!==p.id);
 }
 p.input={x:0,z:0};p.dodge=0;
 world.result(p,{ok:true,operation:'class',classId:p.state.classId,appearanceId:p.state.appearanceId,message:`${classFor(p.state).name} ready for the vigil.`});return true;
}
const obstaclesFor=(world,entity)=>world.obstaclesFor?.(entity)||world.obstacles;
const boundsFor=(world,entity)=>world.boundsFor?.(entity)||WORLD_BOUNDS;
function centerFor(world,p,m,skill,angle){
 if(!skill.range||!['burst','zone'].includes(skill.kind))return {x:p.x,z:p.z};
 let target=m.target;
 if(!target||!Number.isFinite(target.x)||!Number.isFinite(target.z))target={x:p.x+Math.sin(angle)*Math.min(skill.range,6),z:p.z+Math.cos(angle)*Math.min(skill.range,6)};
 const dx=target.x-p.x,dz=target.z-p.z,scale=Math.min(1,skill.range/(Math.hypot(dx,dz)||1));
 const center={x:p.x+dx*scale,z:p.z+dz*scale,mapId:p.mapId};
 const bounds=boundsFor(world,p);
 if(center.x<bounds.minX||center.x>bounds.maxX||center.z<bounds.minZ||center.z>bounds.maxZ||pointBlocked(center,obstaclesFor(world,p),.1)||!hasLineOfSight(p,center,obstaclesFor(world,p),.1))return null;
 return center;
}
export function hitEnemy(world,p,e,skill,amount){
 if(e.hp<=0||!sameMap(p,e))return;
 let damage=amount;
 if(e.type==='sentinel'&&!skill.magic&&withinArc(e,p,e.angle,100,Math.PI*.85))damage*=.4;
 if(skill.backstab){const behind=(p.x-e.x)*Math.sin(e.angle)+(p.z-e.z)*Math.cos(e.angle)<0;if(behind)damage*=skill.backstab;}
 if(damage>0)world.damageEnemy(e,damage,!!skill.magic,skill.color||classColor(p.state),skill.projectile);
 if(skill.leech&&damage>0)p.state.hp=Math.min(p.state.maxHp,p.state.hp+skill.leech);
 if(e.hp<=0)return;
 if(skill.root){e.rootUntil=Math.max(e.rootUntil||0,world.time+skill.root);e.phase='recover';e.timer=skill.root;e.chargeDistance=0;world.hazards=(world.hazards||[]).filter(h=>h.ownerId!==e.id);}
 if(skill.slow){e.slowUntil=Math.max(e.slowUntil||0,world.time+.7);e.slow=Math.max(e.slow||0,skill.slow);}
 if(skill.dot){e.dots??=[];const prior=e.dots.find(d=>d.ownerId===p.id&&d.type===skill.dot.type);if(prior)prior.until=world.time+skill.dot.duration;else e.dots.push({...skill.dot,ownerId:p.id,mapId:p.mapId,until:world.time+skill.dot.duration,next:world.time+skill.dot.interval});}
}
function affectArea(world,p,center,skill){
 for(const e of world.enemies)if(e.hp>0&&sameMap(p,e)&&distance(center,e)<=skill.radius&&hasLineOfSight(center,e,obstaclesFor(world,p)))hitEnemy(world,p,e,skill,skill.damage>0?skill.damage+p.state.level*2+p.state.damageBonus*.35:0);
 for(const ally of world.connected())if(!ally.state.ended&&sameMap(p,ally)&&distance(center,ally)<=skill.radius&&hasLineOfSight(center,ally,obstaclesFor(world,p))){
  if(skill.heal)ally.state.hp=Math.min(ally.state.maxHp,ally.state.hp+skill.heal);
  if(skill.conceal)ally.state.concealed=.5;
  if(skill.guard&&skill.kind==='zone'){ally.state.guard=Math.max(ally.state.guardTime>0?ally.state.guard:0,skill.guard);ally.state.guardTime=Math.max(ally.state.guardTime||0,.7);}
 }
}
export function castClassAbility(world,p,m){
 const skills=abilitiesFor(p.state);
 let skill=Object.hasOwn(skills,m.action)?skills[m.action]:null,variant;
 if(!Number.isFinite(m.angle)||!skill)return false;
 const bounds=boundsFor(world,p);
 const a=m.angle%(Math.PI*2);
 if(skill.closeRange&&world.enemies.some(e=>e.hp>0&&sameMap(p,e)&&withinArc(p,e,a,skill.closeRange.range,skill.closeRange.arc)&&hasLineOfSight(p,e,obstaclesFor(world,p)))){skill=skill.closeRange;variant='closeRange';}
 const center=centerFor(world,p,m,skill,a);if(!center){world.result(p,{ok:false,reason:'That spell cannot reach through the wall.'});return false;}
 if(!useAbility(p.state,m.action))return false;
 p.angle=a;world.emit('ability',{playerId:p.id,mapId:p.mapId,action:m.action,classId:p.state.classId,appearanceId:p.state.appearanceId,kind:skill.kind,...(variant?{variant}:{}),color:skill.color||classColor(p.state),x:center.x,z:center.z,angle:a});
 const damage=(skill.damage||0)+p.state.level*2+p.state.damageBonus;
 if(skill.kind==='melee')for(let i=0;i<(skill.hits||1);i++)world.hits.push({playerId:p.id,mapId:p.mapId,at:world.time+.11+i*.13,angle:a,skill,damage});
 if(skill.kind==='projectile')for(let i=0;i<(skill.count||1);i++){
  const angle=a+(i-((skill.count||1)-1)/2)*(skill.spread||0);
  // Start at the caster and sweep the entire first segment; muzzle offsets
  // must not allow a bolt to originate on the far side of a wall.
  world.projectiles.push({id:randomUUID(),mapId:p.mapId,x:p.x,z:p.z,angle,speed:skill.speed,damage,hostile:false,ownerId:p.id,life:skill.range/skill.speed,remainingHits:skill.pierce||1,hitIds:[],skill,visual:skill.projectile,color:skill.color||classColor(p.state)});
 }
 if(skill.kind==='burst')affectArea(world,p,center,skill);
 if(skill.guard&&skill.kind!=='zone'){p.state.guard=skill.guard;p.state.guardTime=skill.duration;}
 if(skill.kind==='shield'){p.state.shield=skill.shield;p.state.shieldTime=skill.duration;}
 if(skill.kind==='zone')world.zones.push({id:randomUUID(),mapId:p.mapId,ownerId:p.id,classId:p.state.classId,color:classColor(p.state),action:m.action,x:center.x,z:center.z,radius:skill.radius,start:world.time,until:world.time+skill.duration,next:world.time,skill});
 if(skill.kind==='dodge'){
  let stepped=false;
  if(skill.shadowstep){const enemy=world.enemies.filter(e=>e.hp>0&&sameMap(p,e)&&withinArc(p,e,a,skill.range,1.6)).sort((x,y)=>distance(p,x)-distance(p,y))[0];
   if(enemy){const destination={x:enemy.x-Math.sin(enemy.angle)*1.15,z:enemy.z-Math.cos(enemy.angle)*1.15};
    if(!pointBlocked(destination,obstaclesFor(world,p),.42)&&hasLineOfSight(p,destination,obstaclesFor(world,p),.42)&&destination.x>=bounds.minX&&destination.x<=bounds.maxX&&destination.z>=bounds.minZ&&destination.z<=bounds.maxZ){Object.assign(p,destination);p.dodge=0;p.input={x:0,z:0};stepped=true;}
   }
  }
  if(!stepped){
   const direction=skill.retreat?-1:1,input=skill.retreat&&world.time-p.lastInput>=.25?{x:0,z:0}:p.input;
   p.dodge=.27;p.dodgeDir=Math.hypot(input.x,input.z)>.05?{...input}:{x:Math.sin(a)*direction,z:Math.cos(a)*direction};
   if(skill.retreat)p.angle=Math.atan2(p.dodgeDir.x,p.dodgeDir.z);
  }
  p.state.invulnerable=.48;
 }
 return true;
}
export function resolveClassHits(world){
 for(const hit of world.hits)if(hit.at<=world.time){const p=world.players.get(hit.playerId);if(!p?.connected||p.state.ended||!sameMap(p,hit))continue;const skill=hit.skill||abilitiesFor(p.state).attack;
  for(const e of world.enemies)if(e.hp>0&&sameMap(p,e)&&hasLineOfSight(p,e,obstaclesFor(world,p))&&withinArc(p,e,hit.angle,skill.range+((e.type==='boss'||ENEMY_TYPES[e.type]?.boss)?.5:0),skill.arc))hitEnemy(world,p,e,skill,hit.damage??skill.damage+p.state.level*2+p.state.damageBonus);
 }
 world.hits=world.hits.filter(h=>h.at>world.time);
}
export function advanceClassEffects(world){
 for(const e of world.enemies){if((e.slowUntil||0)<=world.time)e.slow=0;
  for(const dot of e.dots||[]){const owner=world.players.get(dot.ownerId);if(e.hp>0&&owner?.connected&&!owner.state.ended&&sameMap(owner,e)&&sameMap(dot,e)&&dot.next<=world.time&&world.time<=dot.until){world.damageEnemy(e,dot.damage,dot.type==='poison',classColor(owner.state));dot.next+=dot.interval;}}
  e.dots=(e.dots||[]).filter(d=>d.next<=d.until&&d.until>=world.time&&world.players.get(d.ownerId)?.connected);
 }
 world.zones=world.zones.filter(zone=>{const owner=world.players.get(zone.ownerId);if(!owner?.connected||owner.state.ended||!sameMap(owner,zone)||world.time>=zone.until)return false;
  if(zone.skill.follow){zone.x=owner.x;zone.z=owner.z;}
  if(zone.next<=world.time){affectArea(world,owner,zone,zone.skill);zone.next+=zone.skill.interval;}
  return true;
 });
}
