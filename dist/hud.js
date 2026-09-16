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
 const abilityEls=new Map();
 function abilityEl(name){let e=abilityEls.get(name);if(!e){const button=document.querySelector(`[data-action="${name}"]`);e={button,cooldown:button.querySelector('.cooldown'),abilityName:button.querySelector('.ability-name')};abilityEls.set(name,e);}return e;}
 let rankEl;
 function rankElement(){return rankEl||(rankEl=document.querySelector('.rank'));}
 function setText(el,v){if(el.textContent!==v)el.textContent=v;}
 function setStyle(el,p,v){if(el.style[p]!==v)el.style[p]=v;}
 function setHidden(el,v){if(el.hidden!==v)el.hidden=v;}
 function setClass(el,c,v){if(el.classList.contains(c)!==v)el.classList.toggle(c,v);}
 function questDeps(s){return JSON.stringify([s.mapId,s.questRewarded,s.campaignComplete,s.victory,s.bossLootClaimed,s.bossSpawned,s.questAccepted,s.visited,s.villageKills,s.claimedCaches,s.regionProgress?.[s.mapId]]);}
 let questSig,questCache;
 function questSummaryCached(state){const sig=questDeps(state);if(sig!==questSig){questSig=sig;questCache=questSummary(state);}return questCache;}
 function toast(message){$('toast').textContent=message;$('toast').classList.add('visible');clearTimeout(ctx.toastTimer);ctx.toastTimer=setTimeout(()=>$('toast').classList.remove('visible'),2500);}
 function updateClassHud(){
  const c=classFor(ctx.state),key=conceptFor(ctx.state.classId,ctx.state.appearanceId)+'|'+!!ctx.activeJourney;if(ctx.hudClass===key)return;ctx.hudClass=key;
  $('character-name').textContent=c.name;$('class-caption').textContent=c.name.toUpperCase();
  $('character-button').disabled=!!ctx.activeJourney;$('character-button').title=ctx.activeJourney?'This journey keeps its chosen character.':'Change character (C)';
  $('world').setAttribute('aria-label','Village play area. Use W A S D to move, mouse to aim and attack, F to speak or collect loot, I for equipment, '+(ctx.activeJourney?'':'C to choose a class at a sanctuary, ')+'2 for your class skill, 1 to dodge, and 3 to heal.');
  for(const [action,skill] of Object.entries(c.abilities)){const {button,abilityName}=abilityEl(action);abilityName.textContent=skill.name;button.title=`${skill.name} · ${skill.cost} essence · ${skill.cooldown}s cooldown. ${skill.description}`;button.setAttribute('aria-label',button.title);const index=['attack','bolt','dodge','nova'].indexOf(action);if(index>=0&&classIconNames[c.id]){const mark=button.querySelector('.ability-icon');mark.innerHTML=icon(classIconNames[c.id][index]);mark.style.color=skill.color||classColor(ctx.state);}}
 }
 function updateUI(){if(!ctx.player)return;updateClassHud();setStyle($('health-liquid'),'height',`${ctx.state.hp/ctx.state.maxHp*100}%`);setStyle($('mana-liquid'),'height',`${ctx.state.mana/ctx.state.maxMana*100}%`);setText($('potion-count'),ctx.state.potions);setText($('souls-counter'),`${ctx.state.souls} SOULS`);setStyle($('experience-fill'),'width',`${ctx.state.souls%100}%`);setText($('level-label'),`${classAppearance(ctx.state.classId,ctx.state.appearanceId)?.name||classFor(ctx.state).name} · LEVEL ${ctx.state.level}`);setText(rankElement(),String(ctx.state.level).padStart(2,'0'));
  for(const[name,data]of Object.entries(abilitiesFor(ctx.state))){const {button,cooldown}=abilityEl(name);const cd=ctx.state.cooldowns[name];setClass(button,'on-cooldown',cd>.12&&name!=='attack');setText(cooldown,cd>=1?Math.ceil(cd):cd.toFixed(1));setClass(button,'unavailable',ctx.state.mana<data.cost||name==='heal'&&!ctx.state.potions);}
  const questBase=questSummaryCached(ctx.state);setText($('quest-kind').lastChild,mapFor(ctx.renderedMap).theme==='cave'?' SIDE CAVE':' MAIN QUEST');const questOverride=ctx.renderedMap==='overworld'&&ctx.state.questCompleted&&!ctx.state.questRewarded;const quest=questOverride?{...questBase,objective:'Quest complete · Claim your reward from Rowan',hint:ctx.sessionMode==='single-player'?'You completed The Last Toll. Your reward awaits in Ashwick.':'Your allies completed The Last Toll. Your reward awaits in Ashwick.'}:questBase;setText($('quest-title'),quest.title);setText($('quest-count'),quest.count);setText($('objective'),quest.objective);setText($('quest-hint'),quest.hint);setClass($('quest-marker'),'done',ctx.state.questRewarded);setText($('gold-counter'),`${ctx.state.gold} CROWNS`);setText($('location-name'),ctx.environment.currentBuilding(ctx.player.position)?.name||(ctx.renderedMap==='overworld'?zoneName(ctx.state.zone):mapFor(ctx.renderedMap).name));setText($('location-type'),ctx.safeHere()?'SANCTUARY':mapFor(ctx.renderedMap).theme==='cave'?'WORLD I · BENEATH HALLOWMERE':ctx.renderedMap!=='overworld'?'THE FORSAKEN REACH':ctx.state.zone==='road'?'THE FORSAKEN REACH':'WORLD I · THE LAST TOLL');const interaction=ctx.nearbyInteraction(),building=interaction?.building,target=interaction?.target;setHidden($('interact-button'),!interaction);setText($('interaction-name'),interaction?.regional?regionActionName(interaction.regional):building?(!building.doorCollider.disabled?'Chapel sealed':ctx.environment.currentBuilding(ctx.player.position)?.id===building.id?'Leave '+building.name:'Enter '+building.name):target?(target.kind==='forage'?'Harvest '+target.name:target.kind?'Collect '+target.name:'Speak to '+target.name):'');const enemyTarget=ctx.mouseTargeting?.selected,boss=ctx.enemies.find(e=>!e.dead&&ctx.bossType(e.type));setHidden($('boss-bar'),!boss||!!enemyTarget&&!ctx.bossType(enemyTarget.type));if(boss){setStyle($('boss-fill'),'width',`${Math.max(0,boss.hp/boss.maxHp*100)}%`);setText($('boss-bar').querySelector('span'),ctx.renderedMap==='overworld'?'THE LAST TOLL':mapFor(ctx.renderedMap).name.toUpperCase());const title=$('boss-bar').querySelector('h2');if(title)setText(title,`${boss.data.name}${boss.net?.bossStage>1?' · Phase '+boss.net.bossStage:''}${boss.net?.exposedUntil>(ctx.lastSnapshot?.time||0)?' · Exposed':''}`);}
  setHidden($('enemy-target'),!enemyTarget||ctx.bossType(enemyTarget.type));
  if(enemyTarget&&!ctx.bossType(enemyTarget.type)){setText($('target-name'),enemyTarget.data.name);setText($('target-type'),(enemyTarget.data.attackStyle==='orb'?'CASTER':enemyTarget.data.attackStyle==='bite'?'DEVOURER':'KNIFE')+' · '+(ctx.attackHeld&&ctx.lockedEnemy===enemyTarget?'LOCKED · HOLD TO ATTACK':'MOUSE LOCK · CLICK TO ATTACK'));setStyle($('target-fill'),'width',`${Math.max(0,enemyTarget.hp/enemyTarget.maxHp*100)}%`);}
  if(ctx.state.time>14)setStyle($('combat-guide'),'opacity','0');}
 function drawMap(){
  if(!ctx.player)return;const map=mapFor(ctx.renderedMap);
  const percent=drawExplorationMap({canvas:$('minimap'),atlas:ctx.exploration,map,player:ctx.player.position,angle:ctx.angle,expanded:ctx.mapExpanded,environment:ctx.environment,npcs:ctx.renderedMap==='overworld'?NPCS:[],interactions:ctx.regionInteractions(),drops:ctx.life?.drops||[],enemies:ctx.enemies,players:ctx.lastSnapshot?.players||[],you:ctx.network?.id,bossType:ctx.bossType});
  $('map-title').textContent=map.name;$('map-exploration').textContent=`${percent}% charted · ${ctx.exploration.saveLabel}`;
 }
 return {toast,updateClassHud,updateUI,drawMap};
}
