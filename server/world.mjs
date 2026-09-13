import {FORAGE_PATCHES,FORAGE_REGROW_SECONDS,harvestFood,consumeFood} from '../dist/foraging.js';
import {classFor,applyClass,weaponForClass} from '../dist/classes.js';
import {selectClass,castClassAbility,resolveClassHits,advanceClassEffects,hitEnemy} from './class-combat.mjs';
import {randomUUID,randomBytes} from 'node:crypto';
import {ENEMY_TYPES,SPAWNS,createState,advanceState,useAbility,hurtPlayer,awardKill,withinArc,resolveMove,distance,segmentHitsCircle,findPath,hasLineOfSight,pointBlocked} from '../dist/combat.js';
import {WORLD_BOUNDS,START,NPCS,createCampaign,generateRoadEncounters,zoneAt,isSanctuary,rollLoot,collectLoot,equipItem,performNpcAction} from '../dist/campaign.js';
import {setBuildingAccess} from '../dist/buildings.js';
import {createWorldLayout} from '../dist/world-layout.js';
import {PLAYER_COLORS,PLAYER_SPEED,SHARED_KEYS,finitePoint,direction} from '../dist/multiplayer-protocol.js';

export class World {
 constructor({seed=randomBytes(4).readUInt32LE(),now=()=>Date.now()}={}){
  this.now=now;this.players=new Map();this.time=0;this.tick=0;this.events=[];this.eventId=0;this.emptySince=now();this.reset(seed);
 }
 reset(seed=randomBytes(4).readUInt32LE()){
  this.id=randomUUID();this.seed=seed;this.shared={questAccepted:false,villageKills:0,roadKills:0,bossSpawned:false,victory:false,bossLootClaimed:false,completed:false};
  Object.assign(this,createWorldLayout());this.enemies=[];this.projectiles=[];this.hits=[];this.zones=[];this.votes=new Set();this.voteDeadline=0;this.events=[];
  SPAWNS.forEach(([type,x,z],i)=>this.spawn(type,x,z,'hallowmere',`village-${i}`));
  for(const e of generateRoadEncounters(seed))this.spawn(e.type,e.x,e.z,e.zone,e.id);
  for(const p of this.players.values())this.resetPlayer(p);
  this.emit('reset',{worldId:this.id});
 }
 resetPlayer(p){const choice={classId:p.state?.classId,appearanceId:p.state?.appearanceId};Object.assign(p,{state:Object.assign(createState(),createCampaign(this.seed)),x:START.x+(p.slot%4)*.7,z:START.z+Math.floor(p.slot/4)*.7,angle:0,input:{x:0,z:0},moving:false,lastInput:0,dodge:0,dodgeDir:{x:0,z:1},loot:[],forageReadyAt:{},lastSeq:0});if(choice.classId){applyClass(p.state,choice.classId,choice.appearanceId);p.state.inventory=p.state.inventory.map(item=>weaponForClass(item,p.state));}}
 spawn(type,x,z,zone,id=randomUUID()){
  const e={id,type,x,z,zone,hp:ENEMY_TYPES[type].hp,maxHp:ENEMY_TYPES[type].hp,phase:'idle',timer:0,cooldown:1,angle:0,attackAngle:0,aim:{x,z},home:{x,z},attackCount:0,path:[],navAt:0,moving:false};this.enemies.push(e);return e;
 }
 emit(type,data={}){const event={id:++this.eventId,type,...data};this.events.push(event);if(this.events.length>256)this.events.shift();return event;}
 connected(){return [...this.players.values()].filter(p=>p.connected);}
 join(token){
  this.expire();let p=token&&[...this.players.values()].find(p=>p.token===token);
  if(p?.connected)return {error:'This Warden is already connected.',code:'IDENTITY_IN_USE'};
  if(!p){if(this.players.size>=8)return {error:'World full · All eight Wardens are in play. Try again shortly.'};
   const slot=PLAYER_COLORS.findIndex((_,i)=>![...this.players.values()].some(p=>p.slot===i));
   p={id:randomUUID(),token:randomBytes(24).toString('hex'),slot,color:PLAYER_COLORS[slot]};this.resetPlayer(p);this.players.set(p.id,p);
  }else {p.x=START.x+(p.slot%4)*.7;p.z=START.z+Math.floor(p.slot/4)*.7;p.input={x:0,z:0};p.dodge=0;}
  p.connected=true;p.lastSeen=this.now();p.lastSeq=0;this.emptySince=null;this.cancelVote();return {player:p};
 }
 leave(id){const p=this.players.get(id);if(!p)return;p.connected=false;p.lastSeen=this.now();p.input={x:0,z:0};p.moving=false;this.cancelVote();if(!this.connected().length)this.emptySince=this.now();}
 cancelVote(){this.votes.clear();this.voteDeadline=0;}
 expire(){const now=this.now();for(const [id,p] of this.players)if(!p.connected&&now-p.lastSeen>=60000)this.players.delete(id);
  if(this.emptySince!==null&&now-this.emptySince>=600000){this.players.clear();this.reset();this.emptySince=now;}
  if(this.voteDeadline&&now>=this.voteDeadline)this.cancelVote();
 }
 viewState(p){return {...p.state,...Object.fromEntries(SHARED_KEYS.map(k=>[k,this.shared[k]])),questCompleted:this.shared.completed};}
 command(id,m){
  const p=this.players.get(id);if(!p?.connected||!m||m.worldId!==this.id||!Number.isSafeInteger(m.seq)||m.seq<=p.lastSeq)return false;
  p.lastSeq=m.seq;
  if(m.type==='input'){
   if(!finitePoint(m)||!Number.isFinite(m.angle)||Math.abs(m.x)>1||Math.abs(m.z)>1)return false;
   p.input={...direction(m.x,m.z),...(finitePoint(m.stopAt)?{stopAt:{x:m.stopAt.x,z:m.stopAt.z}}:{})};p.angle=m.angle%(Math.PI*2);p.lastInput=this.time;return true;
  }
  if(m.type==='respawn'&&p.state.ended){p.state.hp=p.state.maxHp;p.state.mana=p.state.maxMana;p.state.ended=false;p.state.shield=0;p.state.shieldTime=0;p.state.guard=0;p.state.guardTime=0;p.state.concealed=0;p.state.invulnerable=1;p.x=START.x;p.z=START.z;p.input={x:0,z:0};p.dodge=0;this.emit('respawn',{playerId:id});return true;}
  if(m.type==='vote'){
   if(m.agree===false){this.cancelVote();return true;}
   if(m.agree!==true)return false;this.votes.add(id);this.voteDeadline=this.now()+30000;
   if(this.connected().every(q=>this.votes.has(q.id)))this.reset();return true;
  }
  if(p.state.ended)return false;
  if(m.type==='select-class')return selectClass(this,p,m);
  if(m.type==='ability')return this.ability(p,m);
  if(m.type==='equip'){const result=equipItem(p.state,m.id);this.result(p,result);return result.ok;}
  if(m.type==='collect')return this.collect(p,m.id);
  if(m.type==='forage')return this.forage(p,m.id);
  if(m.type==='consume'){const result=consumeFood(p.state,m.itemId);this.result(p,{...result,operation:'consume'});return result.ok;}
  if(m.type==='service'){
   const npc=NPCS.find(n=>n.id===m.npcId);if(!npc||distance(p,npc)>2.8||!hasLineOfSight(p,npc,this.obstacles))return false;
   Object.assign(p.state,Object.fromEntries(SHARED_KEYS.map(k=>[k,this.shared[k]])));
   const result=performNpcAction(p.state,npc.id,m.action);
   if(result.ok){if(m.action==='accept-quest')this.shared.questAccepted=true;if(m.action==='claim-reward')this.shared.completed=true;}
   this.result(p,result);return result.ok;
  }
  return false;
 }
 result(p,result){this.emit('result',{playerId:p.id,...result});}
 collect(p,id){const d=p.loot.find(d=>d.id===id&&!d.claimed);if(!d||distance(p,d)>2.8||!hasLineOfSight(p,d,this.obstacles))return false;
  const result=collectLoot(p.state,d);if(result.collected){if(d.template==='bellkeeper-edge')this.shared.bossLootClaimed=true;this.emit('loot',{playerId:p.id,drop:d});}return result.collected;
 }
 forage(p,id){
  const patch=FORAGE_PATCHES.find(patch=>patch.id===id);
  if(!patch||this.time<(p.forageReadyAt[id]||0)||distance(p,patch)>2.8||!hasLineOfSight(p,patch,this.obstacles))return false;
  const result=harvestFood(p.state,patch.itemId);
  if(result.ok)p.forageReadyAt[id]=this.time+FORAGE_REGROW_SECONDS;
  this.result(p,{...result,operation:'forage'});return result.ok;
 }
 ability(p,m){return castClassAbility(this,p,m);}
 projectile(origin,angle,speed,damage,hostile,ownerId,offset=0){this.projectiles.push({id:randomUUID(),x:origin.x+Math.sin(angle)*offset,z:origin.z+Math.cos(angle)*offset,angle,speed,damage,hostile,ownerId,life:2.5});}
 damagePlayer(p,amount){if(!p.connected||isSanctuary(p))return;const damage=hurtPlayer(p.state,amount);if(!damage)return;this.emit('hurt',{playerId:p.id,damage,x:p.x,z:p.z});if(p.state.ended){p.input={x:0,z:0};p.dodge=0;}}
 damageEnemy(e,amount,magic=false,color,visual){
  if(e.hp<=0)return;const damage=Math.min(e.hp,Math.round(amount));e.hp-=damage;this.emit('hit',{enemyId:e.id,x:e.x,z:e.z,damage,magic,color,visual});
  if(e.hp>0)return;e.phase='dead';e.moving=false;
  if(e.type==='boss'){this.shared.victory=true;setBuildingAccess(this.buildings,true);}else this.shared[e.zone==='hallowmere'?'villageKills':'roadKills']++;
  for(const p of this.connected()){
   awardKill(p.state,e.type);
   const drops=rollLoot(p.state,e.type,e.zone);
   drops.forEach((d,i)=>{const a=i/drops.length*Math.PI*2;let point={x:e.x+Math.cos(a)*.65,z:e.z+Math.sin(a)*.65};if(pointBlocked(point,this.obstacles,.3))point={x:e.x,z:e.z};p.loot.push({...d,...point});});
  }
  this.emit('kill',{enemyId:e.id,typeName:e.type,x:e.x,z:e.z});
  if(this.shared.villageKills>=SPAWNS.length&&!this.shared.bossSpawned){this.shared.bossSpawned=true;this.spawn('boss',0,-8.8,'hallowmere','bellkeeper');this.emit('boss');}
 }
 move(entity,dx,dz,radius=.42){const next=resolveMove(entity,dx,dz,this.obstacles,radius,WORLD_BOUNDS);entity.moving=distance(entity,next)>.001;Object.assign(entity,next);}
 step(dt=.05){
  this.expire();this.time+=dt;this.tick++;const players=this.connected();
  for(const p of players){advanceState(p.state,dt);p.moving=false;if(p.state.ended)continue;
   const active=this.time-p.lastInput<.25,pad=active?p.input:{x:0,z:0};
   if(p.dodge>0){p.angle=Math.atan2(p.dodgeDir.x,p.dodgeDir.z);const travel=Math.min(p.dodge,dt)*15;this.move(p,p.dodgeDir.x*travel,p.dodgeDir.z*travel);p.dodge=Math.max(0,p.dodge-dt);}else {const travel=pad.stopAt?Math.min(classFor(p.state).speed*dt,distance(p,pad.stopAt)):classFor(p.state).speed*dt;this.move(p,pad.x*travel,pad.z*travel);}
   p.state.zone=zoneAt(p);if(!p.state.visited.includes(p.state.zone))p.state.visited.push(p.state.zone);
   for(const d of p.loot)if(!d.claimed&&d.kind==='gold'&&distance(p,d)<1.25)this.collect(p,d.id);
  }
  resolveClassHits(this);advanceClassEffects(this);
  for(const e of this.enemies)this.updateEnemy(e,players,dt);
  this.projectiles=this.projectiles.filter(b=>{
   if(!b.hostile&&b.ownerId){const owner=this.players.get(b.ownerId);if(!owner?.connected||owner.state.ended)return false;}
   const previous={x:b.x,z:b.z},travel=Math.min(dt,b.life);b.life-=dt;b.x+=Math.sin(b.angle)*b.speed*travel;b.z+=Math.cos(b.angle)*b.speed*travel;
   if(!hasLineOfSight(previous,b,this.obstacles,.08))return false;
   if(b.hostile){for(const p of players)if(!p.state.ended&&!isSanctuary(p)&&segmentHitsCircle(previous,b,p,.48)){this.damagePlayer(p,b.damage);return false;}}
   // Sweep the fireball's full width against enemy bodies, including grazes
   // between simulation ticks. Nearby enemies still need a clear path to it.
   else for(const e of this.enemies)if(e.hp>0&&!b.hitIds?.includes(e.id)&&segmentHitsCircle(previous,b,e,(e.type==='boss'?1.05:.62)+(b.skill?.hitRadius||0))&&(!b.skill?.hitRadius||hasLineOfSight(b,e,this.obstacles,.08))){const owner=this.players.get(b.ownerId);if(b.skill&&owner){hitEnemy(this,owner,e,b.skill,b.damage);b.hitIds.push(e.id);if(--b.remainingHits<=0)return false;}else{this.damageEnemy(e,b.damage,true);return false;}}
   return b.life>0;
  });
 }
 updateEnemy(e,players,dt){
  if(e.hp<=0)return;const data=ENEMY_TYPES[e.type];e.moving=false;if(this.time<(e.rootUntil||0))return;e.cooldown=Math.max(0,e.cooldown-dt);
  const candidates=players.filter(p=>!p.state.ended&&!p.state.concealed&&!isSanctuary(p));const target=candidates.sort((a,b)=>distance(e,a)-distance(e,b))[0];
  if(!target){e.phase='idle';if(distance(e,e.home)>.5)this.seek(e,e.home,dt);return;}
  if(e.phase==='windup'){e.timer-=dt;if(e.timer<=0){e.phase='recover';e.timer=e.type==='boss'?1.05:.55;e.cooldown=data.cooldown;e.attackCount++;
    this.emit('strike',{enemyId:e.id,x:e.x,z:e.z,angle:e.attackAngle,typeName:e.type});
    if(e.type==='revenant')this.projectile(e,Math.atan2(e.aim.x-e.x,e.aim.z-e.z),6.2,data.damage,true,e.id);
    else {for(const p of candidates)if(hasLineOfSight(e,p,this.obstacles)&&(e.type==='boss'?distance(e,p)<data.range+.3:withinArc(e,p,e.attackAngle,data.range+.35,1.9)))this.damagePlayer(p,data.damage);
     if(e.type==='boss'&&e.attackCount%2===0)for(let i=0;i<8;i++)this.projectile(e,i/8*Math.PI*2,4.1,18,true,e.id);
     if(e.type==='hound')this.move(e,Math.sin(e.attackAngle)*.45,Math.cos(e.attackAngle)*.45,.35);
    }
   }return;
  }
  if(e.phase==='recover'){e.timer-=dt;if(e.timer<=0)e.phase='idle';return;}
  const dist=distance(e,target);if(dist>=(e.type==='boss'?23:10.5)&&e.hp===e.maxHp){if(distance(e,e.home)>.5)this.seek(e,e.home,dt);return;}
  e.angle=Math.atan2(target.x-e.x,target.z-e.z);
  if(dist>(e.type==='revenant'?5.4:data.range*.9)||!hasLineOfSight(e,target,this.obstacles,.43))this.seek(e,target,dt);
  if(distance(e,target)<=data.range&&e.cooldown<=0&&hasLineOfSight(e,target,this.obstacles)){
   e.phase='windup';e.timer=data.windup;e.attackAngle=e.angle;e.aim={x:target.x,z:target.z};this.emit('windup',{enemyId:e.id});
  }
 }
 seek(e,target,dt){
  let goal=target;if(!hasLineOfSight(e,target,this.obstacles,.43)){
   if(this.time>=e.navAt){e.path=findPath(e,target,this.obstacles,WORLD_BOUNDS);e.navAt=this.time+1.1;}
   while(e.path.length&&distance(e,e.path[0])<.35)e.path.shift();if(!e.path.length)return;goal=e.path[0];
  }else e.path=[];
  const a=Math.atan2(goal.x-e.x,goal.z-e.z);e.angle=a;this.move(e,Math.sin(a)*ENEMY_TYPES[e.type].speed*(1-(e.slow||0))*dt,Math.cos(a)*ENEMY_TYPES[e.type].speed*(1-(e.slow||0))*dt,e.type==='boss'?.85:.37);
 }
 snapshot(id,afterEvent=0){const p=this.players.get(id);return {type:'snapshot',worldId:this.id,tick:this.tick,time:this.time,ack:p.lastSeq,state:this.viewState(p),you:id,
  players:this.connected().map(q=>({id:q.id,slot:q.slot,color:q.color,x:q.x,z:q.z,angle:q.angle,moving:q.moving,hp:q.state.hp,maxHp:q.state.maxHp,ended:q.state.ended,dodge:q.dodge,classId:q.state.classId,appearanceId:q.state.appearanceId,speed:classFor(q.state).speed,shield:q.state.shield||0,concealed:q.state.concealed||0,zone:zoneAt(q)})),
  enemies:this.enemies.map(({path,navAt,home,dots,...e})=>e),projectiles:this.projectiles.map(({damage,ownerId,skill,hitIds,remainingHits,...b})=>b),zones:this.zones.map(({skill,next,ownerId,...z})=>z),loot:p.loot.filter(d=>!d.claimed),forage:FORAGE_PATCHES.filter(patch=>this.time>=(p.forageReadyAt[patch.id]||0)),
  votes:[...this.votes],voteDeadline:this.voteDeadline,events:this.events.filter(e=>e.id>afterEvent&&(!e.playerId||e.type==='ability'||e.type==='hurt'||e.type==='respawn'||e.playerId===id))};}
}
