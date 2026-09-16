// toast/updateClassHud/updateUI/drawMap moved verbatim out of main.js (M7). Free
// identifiers: $ (./dom.js, all four). classFor/classAppearance/conceptFor/classColor/
// abilitiesFor (./classes.js: classFor+conceptFor in updateClassHud, classColor in
// updateClassHud, classAppearance+classFor+abilitiesFor in updateUI). classIconNames/icon
// (./icon-atlas.js, updateClassHud). questSummary/zoneName (./campaign.js, updateUI).
// NPCS (./campaign.js, drawMap). mapFor (./regions.js, updateUI/drawMap). regionActionName
// (./region-client-ui.js, updateUI). drawExplorationMap (./exploration-map.js, drawMap)
// re-imported through a `deps` escape hatch defaulting to that same import -- the only
// deviation from verbatim -- because the migrated hud test needs to stub it the way the
// mouse-targeting/player-motion tests already stub their own cross-module imports. document
// (global, updateClassHud/updateUI). ctx.player/ctx.state/ctx.activeJourney/ctx.hudClass/
// ctx.toastTimer/ctx.renderedMap/ctx.sessionMode/ctx.environment/ctx.mouseTargeting/
// ctx.enemies/ctx.lastSnapshot/ctx.attackHeld/ctx.lockedEnemy/ctx.exploration/ctx.angle/
// ctx.mapExpanded/ctx.life/ctx.network (already-declared ctx data fields). ctx.safeHere/
// ctx.bossType (game-context.js). ctx.nearbyInteraction (M4's createInteraction).
// ctx.regionInteractions (M4's createRegionTravel). updateUI calls updateClassHud directly --
// both stay in this closure, same as awaken calling syncAudioState directly in game-audio.js.
import {$} from './dom.js';
import {classFor,classAppearance,conceptFor,classColor,abilitiesFor} from './classes.js';
import {classIconNames,icon} from './icon-atlas.js';
import {questSummary,zoneName,NPCS} from './campaign.js';
import {mapFor} from './regions.js';
import {regionActionName} from './region-client-ui.js';
import {drawExplorationMap as drawExplorationMapImport} from './exploration-map.js';
export function createHud(ctx,deps={}){
 const {drawExplorationMap=drawExplorationMapImport}=deps;
 function toast(message){$('toast').textContent=message;$('toast').classList.add('visible');clearTimeout(ctx.toastTimer);ctx.toastTimer=setTimeout(()=>$('toast').classList.remove('visible'),2500);}
 function updateClassHud(){
  const c=classFor(ctx.state),key=conceptFor(ctx.state.classId,ctx.state.appearanceId)+'|'+!!ctx.activeJourney;if(ctx.hudClass===key)return;ctx.hudClass=key;
  $('character-name').textContent=c.name;$('class-caption').textContent=c.name.toUpperCase();
  $('character-button').disabled=!!ctx.activeJourney;$('character-button').title=ctx.activeJourney?'This journey keeps its chosen character.':'Change character (C)';
  $('world').setAttribute('aria-label','Village play area. Use W A S D to move, mouse to aim and attack, F to speak or collect loot, I for equipment, '+(ctx.activeJourney?'':'C to choose a class at a sanctuary, ')+'2 for your class skill, 1 to dodge, and 3 to heal.');
  for(const [action,skill] of Object.entries(c.abilities)){const button=document.querySelector(`[data-action="${action}"]`);button.querySelector('.ability-name').textContent=skill.name;button.title=`${skill.name} · ${skill.cost} essence · ${skill.cooldown}s cooldown. ${skill.description}`;button.setAttribute('aria-label',button.title);const index=['attack','bolt','dodge','nova'].indexOf(action);if(index>=0&&classIconNames[c.id]){const mark=button.querySelector('.ability-icon');mark.innerHTML=icon(classIconNames[c.id][index]);mark.style.color=skill.color||classColor(ctx.state);}}
 }
 function updateUI(){if(!ctx.player)return;updateClassHud();$('health-liquid').style.height=`${ctx.state.hp/ctx.state.maxHp*100}%`;$('mana-liquid').style.height=`${ctx.state.mana/ctx.state.maxMana*100}%`;$('potion-count').textContent=ctx.state.potions;$('souls-counter').textContent=`${ctx.state.souls} SOULS`;$('experience-fill').style.width=`${ctx.state.souls%100}%`;$('level-label').textContent=`${classAppearance(ctx.state.classId,ctx.state.appearanceId)?.name||classFor(ctx.state).name} · LEVEL ${ctx.state.level}`;document.querySelector('.rank').textContent=String(ctx.state.level).padStart(2,'0');
  for(const[name,data]of Object.entries(abilitiesFor(ctx.state))){const button=document.querySelector(`[data-action="${name}"]`);const cd=ctx.state.cooldowns[name];button.classList.toggle('on-cooldown',cd>.12&&name!=='attack');button.querySelector('.cooldown').textContent=cd>=1?Math.ceil(cd):cd.toFixed(1);button.classList.toggle('unavailable',ctx.state.mana<data.cost||name==='heal'&&!ctx.state.potions);}
  const quest=questSummary(ctx.state);$('quest-kind').lastChild.textContent=mapFor(ctx.renderedMap).theme==='cave'?' SIDE CAVE':' MAIN QUEST';if(ctx.renderedMap==='overworld'&&ctx.state.questCompleted&&!ctx.state.questRewarded){quest.objective='Quest complete · Claim your reward from Rowan';quest.hint=ctx.sessionMode==='single-player'?'You completed The Last Toll. Your reward awaits in Ashwick.':'Your allies completed The Last Toll. Your reward awaits in Ashwick.';}$('quest-title').textContent=quest.title;$('quest-count').textContent=quest.count;$('objective').textContent=quest.objective;$('quest-hint').textContent=quest.hint;$('quest-marker').classList.toggle('done',ctx.state.questRewarded);$('gold-counter').textContent=`${ctx.state.gold} CROWNS`;$('location-name').textContent=ctx.environment.currentBuilding(ctx.player.position)?.name||(ctx.renderedMap==='overworld'?zoneName(ctx.state.zone):mapFor(ctx.renderedMap).name);$('location-type').textContent=ctx.safeHere()?'SANCTUARY':mapFor(ctx.renderedMap).theme==='cave'?'WORLD I · BENEATH HALLOWMERE':ctx.renderedMap!=='overworld'?'THE FORSAKEN REACH':ctx.state.zone==='road'?'THE FORSAKEN REACH':'WORLD I · THE LAST TOLL';const interaction=ctx.nearbyInteraction(),building=interaction?.building,target=interaction?.target;$('interact-button').hidden=!interaction;$('interaction-name').textContent=interaction?.regional?regionActionName(interaction.regional):building?(!building.doorCollider.disabled?'Chapel sealed':ctx.environment.currentBuilding(ctx.player.position)?.id===building.id?'Leave '+building.name:'Enter '+building.name):target?(target.kind==='forage'?'Harvest '+target.name:target.kind?'Collect '+target.name:'Speak to '+target.name):'';const enemyTarget=ctx.mouseTargeting?.selected,boss=ctx.enemies.find(e=>!e.dead&&ctx.bossType(e.type));$('boss-bar').hidden=!boss||!!enemyTarget&&!ctx.bossType(enemyTarget.type);if(boss){$('boss-fill').style.width=`${Math.max(0,boss.hp/boss.maxHp*100)}%`;$('boss-bar').querySelector('span').textContent=ctx.renderedMap==='overworld'?'THE LAST TOLL':mapFor(ctx.renderedMap).name.toUpperCase();const title=$('boss-bar').querySelector('h2');if(title)title.textContent=`${boss.data.name}${boss.net?.bossStage>1?' · Phase '+boss.net.bossStage:''}${boss.net?.exposedUntil>(ctx.lastSnapshot?.time||0)?' · Exposed':''}`;}
  $('enemy-target').hidden=!enemyTarget||ctx.bossType(enemyTarget.type);
  if(enemyTarget&&!ctx.bossType(enemyTarget.type)){$('target-name').textContent=enemyTarget.data.name;$('target-type').textContent=(enemyTarget.data.attackStyle==='orb'?'CASTER':enemyTarget.data.attackStyle==='bite'?'DEVOURER':'KNIFE')+' · '+(ctx.attackHeld&&ctx.lockedEnemy===enemyTarget?'LOCKED · HOLD TO ATTACK':'MOUSE LOCK · CLICK TO ATTACK');$('target-fill').style.width=`${Math.max(0,enemyTarget.hp/enemyTarget.maxHp*100)}%`;}
  if(ctx.state.time>14)$('combat-guide').style.opacity='0';}
 function drawMap(){
  if(!ctx.player)return;const map=mapFor(ctx.renderedMap);
  const percent=drawExplorationMap({canvas:$('minimap'),atlas:ctx.exploration,map,player:ctx.player.position,angle:ctx.angle,expanded:ctx.mapExpanded,environment:ctx.environment,npcs:ctx.renderedMap==='overworld'?NPCS:[],interactions:ctx.regionInteractions(),drops:ctx.life?.drops||[],enemies:ctx.enemies,players:ctx.lastSnapshot?.players||[],you:ctx.network?.id,bossType:ctx.bossType});
  $('map-title').textContent=map.name;$('map-exploration').textContent=`${percent}% charted · ${ctx.exploration.saveLabel}`;
 }
 return {toast,updateClassHud,updateUI,drawMap};
}
