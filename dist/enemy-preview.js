import {ENEMY_TYPES,pointBlocked} from './combat.js';
import {generateRoadPacks} from './enemy-encounters.js';
import {randomSeed} from './world-random.js';

// Disposable single-player encounter review; preview mode never saves a journey.
export function createEnemyPreview(session,onJump=()=>{}){
 const panel=document.createElement('aside');panel.className='enemy-preview';panel.setAttribute('aria-label','Enemy combat preview');
 const style=document.createElement('style');style.textContent='.enemy-preview{position:fixed;z-index:18;top:91px;left:50%;transform:translateX(-50%);display:flex;gap:10px;align-items:center;padding:12px 18px;border:1px solid #73694d;background:#111c21ed;color:#e5d8ba;font:12px system-ui}.enemy-preview strong{font:12px Georgia;letter-spacing:.1em;white-space:nowrap}.enemy-preview select,.enemy-preview button{background:#253237;border:1px solid #726850;color:#eadbb7;padding:7px}.enemy-preview label{display:flex;gap:6px;align-items:center;white-space:nowrap}.enemy-preview small{color:#afa88e;white-space:nowrap}@media(max-width:850px){.enemy-preview{top:70px;max-width:90%;flex-wrap:wrap;gap:8px}.enemy-preview small{display:none}}';
 panel.innerHTML='<strong>ENEMY COMBAT</strong><select aria-label="Encounter preview"><option value="orbs">Large orb casters</option><option value="melee">Knives &amp; devourers</option><option value="mixed">Random road pack</option></select><button type="button">Reroll</button><label><input type="checkbox">Hold attack pose</label><small>Safe preview · WASD to move</small>';
 document.head.append(style);document.getElementById('game').append(panel);
 const select=panel.querySelector('select'),hold=panel.querySelector('input'),p=session.world.players.get(session.id),advance=session.advance.bind(session);
 let previousPack='',encounterSerial=0;
 const types=()=>select.value==='orbs'?['gravecaller','bone-colossus','revenant']:select.value==='melee'?['cutthroat','ghoul','shard-hound','ash-stalker']:generateRoadPacks(randomSeed()).filter(e=>e.id.startsWith('road-1-')).map(e=>e.type);
 function arrange(){
  encounterSerial++;onJump();p.mapId=p.state.mapId='overworld';p.x=-42;p.z=5;p.state.time=Math.max(p.state.time,15);p.state.hp=p.state.maxHp;p.state.ended=false;p.state.invulnerable=1e8;session.input={x:0,z:0,angle:0};
  const world=session.world;world.enemies=[];world.projectiles=[];world.hazards=[];world.events=[];
  const roster=types();
  if(select.value==='mixed'){
   if(roster.slice().sort().join(',')===previousPack)roster[0]=['hollow','cutthroat','ghoul','hound'].find(t=>!roster.includes(t));
   previousPack=roster.slice().sort().join(',');
  }
  roster.forEach((type,i)=>{const positions=[[-41,-1],[-35,4],[-45,8],[-48,2]],point={x:positions[i][0],z:positions[i][1]};if(pointBlocked(point,world.obstacles,.6))point.z=5;
   const e=world.spawn(type,point.x,point.z,'road',`preview-${select.value}-${encounterSerial}-${i}`);e.cooldown=.4+i*.18;
  });session.publish();
 }
 session.advance=(elapsed,paused)=>{
  if(hold.checked){for(const e of session.world.enemies){e.phase='windup';e.timer=ENEMY_TYPES[e.type].windup*.12;e.attackAngle=e.angle=Math.atan2(p.x-e.x,p.z-e.z);e.aim={x:p.x,z:p.z};}session.publish();return;}
  advance(elapsed,paused);
 };
 panel.querySelector('button').onclick=arrange;select.onchange=arrange;hold.onchange=()=>{if(!hold.checked)for(const e of session.world.enemies){e.phase='idle';e.cooldown=.1;}};arrange();
 return()=>{session.advance=advance;panel.remove();style.remove();};
}
