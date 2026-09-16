// networkEvent moved verbatim out of main.js (M10): the one place a server event turns into a
// local effect, float text or sound. Every branch, and the order they are tested in, is
// untouched; tests/network-events.test.mjs drives each one through a stubbed ctx.
//
// Free identifiers: T (three, only T.Vector3, so the core build), abilityForEvent/classColor
// (./classes.js), ENEMY_TYPES (./combat.js) and $ (./dom.js, the damage vignette) stay plain
// imports. The two preview branches keep their dynamic import('./enemy-preview.js') /
// import('./cave-preview.js') spelling -- same directory, same relative URL. Math, String,
// URLSearchParams, location and setTimeout are globals. Nothing here needs stubbing, so the
// `deps` bag the other M10 factories take is accepted and destructures nothing.
//
// ctx renames for names that were bare module-scope bindings in main.js: ctx.releaseInput (x2,
// M5's bindInput) and ctx.audioAt (x15, M7's createGameAudio). Everything else this function
// touches was already spelled ctx.* in main.js.
import * as T from './vendor/three.core.js';
import {abilityForEvent,classColor} from './classes.js';
import {ENEMY_TYPES} from './combat.js';
import {$} from './dom.js';
export function createNetworkEvents(ctx,deps={}){
 function networkEvent(event){
  if(event.type==='result'&&event.operation==='class'&&ctx.state.classId&&ctx.sessionMode==='single-player'&&!ctx.cavePreviewStarted&&new URLSearchParams(location.search).get('preview')==='enemies'){ctx.cavePreviewStarted=true;const generation=ctx.sessionGeneration;import('./enemy-preview.js').then(({createEnemyPreview})=>{if(generation===ctx.sessionGeneration)createEnemyPreview(ctx.network,()=>{ctx.releaseInput();ctx.resetMovement=true;});});}
  if(event.type==='result'&&event.operation==='class'){ctx.rosterPicker?.resolve(event);if(ctx.state.classId&&ctx.sessionMode==='single-player'&&!ctx.cavePreviewStarted&&['caves','exploration'].includes(new URLSearchParams(location.search).get('preview'))){ctx.cavePreviewStarted=true;const generation=ctx.sessionGeneration;import('./cave-preview.js').then(({createCavePreview})=>{if(generation===ctx.sessionGeneration)createCavePreview(ctx.network,()=>{ctx.releaseInput();ctx.resetMovement=true;});});}}
  if(ctx.backgrounded||event.mapId&&event.mapId!==ctx.renderedMap)return;
  const pos=new T.Vector3(event.x||0,0,event.z||0);
  if(event.type==='ability'){
   const actor=event.playerId===ctx.network.id?{model:ctx.player,rig:ctx.heroRig}:ctx.multiplayerView.actors.get(event.playerId);if(!actor)return;
   const local=event.playerId===ctx.network.id,rig=actor.rig;
   const skill=abilityForEvent(event),color=event.color||classColor(event),classVisual=ctx.classEffects.ability(event,skill,actor.model);
   if(skill?.kind==='melee'){rig.attack=.42;rig.attackKind=skill.hits===2?'paired':'attack';if(!classVisual)ctx.slash(pos,event.angle,color,skill.range,.3);ctx.audioAt('sword',pos,.6);}
   if(skill?.kind==='projectile'){
    rig.attack=.36;rig.attackKind='bolt';
    const hand=pos.clone().add(new T.Vector3(0,1.2,0)),direction=new T.Vector3(Math.sin(event.angle),0,Math.cos(event.angle));
    if(skill.projectile==='ember')ctx.combatEffects.cast(hand,direction);
    else if(skill.projectile==='arcane')ctx.combatEffects.arcaneCast(hand,direction);
    else if(!classVisual)ctx.particles(hand,color,9,1.8);
    ctx.audioAt(['arrow','knife'].includes(skill.projectile)?'sword':'ember',pos,.5);
   }
   if(skill?.kind==='support'){rig.attack=.42;rig.attackKind='support';ctx.audioAt('heal',pos,.5);}
   if(skill?.kind==='burst'||skill?.kind==='zone'){rig.attack=event.classId==='oathkeeper'?.42:.36;rig.attackKind=event.classId==='oathkeeper'?'support':'bolt';if(!classVisual){ctx.ringEffect(pos,color,.3,skill.radius||3,.65);ctx.particles(pos,color,24,3);}ctx.audioAt('nova',pos,.55);}
   if(skill?.kind==='shield'){if(!classVisual)ctx.ringEffect(pos,color,.8,1.2,skill.duration);ctx.audioAt('heal',pos,.6);}
   if(event.action==='heal'){if(!classVisual)ctx.ringEffect(pos,0x97cba5,.2,1.5,.7);ctx.audioAt('heal',pos,.6);}
   if(event.action==='dodge'){ctx.audioAt('dodge',pos,.5);if(local){ctx.moveTarget=null;ctx.movePath=[];ctx.lockedEnemy=null;}}
  }
  if(event.type==='hit'){
   ctx.floatText(String(event.damage),pos,event.magic?'magic':'');
   const impact=pos.clone().add(new T.Vector3(0,1,0));
   if(event.visual==='ember')ctx.combatEffects.emberImpact(impact);
   else if(event.visual==='arcane')ctx.combatEffects.arcaneImpact(impact);
   else if(!ctx.classEffects.impact(event)){
    if(event.magic)ctx.particles(impact,event.color||'#88cfdb',12,2.8);else ctx.steelImpact(impact);
   }
   ctx.audioAt(event.magic?'ember-hit':'impact',pos,.55);
  }
  if(event.type==='respawn'&&event.revivedBy){ctx.ringEffect(pos,0xffdf8b,.3,1.7,1);ctx.particles(pos,0xffe8aa,28,2);ctx.audioAt('heal',pos,.7);if(event.playerId===ctx.network.id)ctx.toast('Resurrected by Oathkeeper');}
  if(event.type==='hurt'){ctx.floatText(String(event.damage),pos,'enemy-damage');if(event.playerId===ctx.network.id){ctx.audio.play('hurt',.6);$('damage-vignette').style.opacity='.75';setTimeout(()=>$('damage-vignette').style.opacity='0',210);}}
  if(event.type==='kill'){ctx.audioAt(event.typeName==='boss'?'death-boss':event.typeName==='hound'?'death-hound':event.typeName==='revenant'?'death-revenant':'death',pos,.6);if(ctx.lockedEnemy?.id===event.enemyId){ctx.lockedEnemy=null;ctx.attackHeld=false;}if(ctx.bossType(event.typeName))ctx.toast(`${ENEMY_TYPES[event.typeName].name} falls · Claim your personal loot`);}
  if(event.type==='region-boss'){const boss=ctx.enemies.find(e=>e.id===event.enemyId);if(boss)ctx.toast(`${boss.data.name} has awakened.`);ctx.audio.play('boss-windup',.65);}
  if(event.type==='objective-ready')ctx.toast(event.message);
  if(event.type==='boss'){ctx.toast(`${ENEMY_TYPES[event.typeName]?.name||'The Bellkeeper'} has answered.`);ctx.audio.play('bell',.6);}
  if(event.type==='windup'){const e=ctx.enemies.find(e=>e.id===event.enemyId);if(e)ctx.audioAt(ctx.bossType(e.type)?'boss-windup':`voice-${ctx.enemyModelType(e.type)}`,e.model.position,.5);}
  if(event.type==='strike'){
   const e=ctx.enemies.find(e=>e.id===event.enemyId),data=ENEMY_TYPES[event.typeName];e?.visuals.strike();
   if(ctx.bossType(event.typeName)){ctx.ringEffect(pos,data.orbColor,.2,3.4,.5);ctx.audioAt('boss-slam',pos,.7);}
   else if(data.attackStyle==='knife'){ctx.slash(pos,event.angle,0xd3dfd8,data.range,.22);ctx.audioAt('sword',pos,.4);}
   else if(data.attackStyle==='bite'){const mouth=pos.clone().add(new T.Vector3(Math.sin(event.angle)*.8,.9,Math.cos(event.angle)*.8));ctx.particles(mouth,0xd9c7a4,6,1.3);ctx.audioAt('impact',pos,.45);}
   else {ctx.particles(pos.clone().add(new T.Vector3(0,1.4,0)),data.orbColor,12,2);ctx.audioAt('ember',pos,.45);}
  }
  if(event.type==='loot')ctx.lootCollected(event.drop,{collected:true});
  if(event.type==='result'){if(event.ok&&['forage','consume'].includes(event.operation))ctx.audio.play(event.operation==='forage'?'pickup':'heal',.55);if(event.message||event.reason)ctx.toast(event.message||event.reason);}
 }
 return {networkEvent};
}
