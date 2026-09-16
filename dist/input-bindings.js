// Every listener registration and input-facing binding moved verbatim out of main.js (M5),
// in the same order, so registration order on window/document/elements is unchanged. windowTarget/
// documentTarget are injected the way page-activity.js already does it, and bindPageActivity is
// handed the same pair so its blur/visibilitychange listeners land on the same targets at the same
// point in the sequence. Element lookups stay `$('literal')` (./dom.js) and resolve through the
// global document, which is what the tests stub. Free identifiers: $ (./dom.js), bindPageActivity
// (./page-activity.js), abilitiesFor (./classes.js, attacksFromHere and the pointerdown dispatcher),
// distance (./combat.js, the pointerdown dispatcher), icon (./icon-atlas.js, the sound button),
// menuNavigationMarkup/updateMenuNavigation (./menu-chrome.js, the navigation strips and toggleMap).
// ctx.ready/paused/backgrounded/state/network/mouseAction/lockedEnemy/attackHeld/angle/player/
// targetWorld/keys/moveTarget/movePath/pendingRegionInteraction/networkDirection/mouseInWorld/
// pointerShift/mouseTargeting/mapExpanded/modalKind/mainMenuOpen/currentNpc/activeJourney/
// journeyLeaving/journeyConflict/rosterPicker/joystickPointer/joystickValue/aimActive/autosave/
// clock/coarse/audio/exploration/life (already-declared ctx data fields). ctx.updatePointer/
// ctx.updateMouseTarget/ctx.setDestination/ctx.nearestEnemy (wired by M3/M4's createPointerTargeting),
// ctx.collectClickedLoot/ctx.interactRegion/ctx.enterBuilding/ctx.interact (M4's createInteraction),
// ctx.safeHere (game-context.js), ctx.awaken/ctx.toast/ctx.perform/ctx.showModal/ctx.closeModal/
// ctx.openRoster/ctx.drawMap/ctx.syncAudioState/ctx.resumeFromMainMenu (main.js functions reached
// across the module boundary). attacksFromHere/stopAttackMovement/releaseMouseAttack/releaseInput/
// toggleMap/navigateMenu/releaseJoystick/updateJoystick call each other directly inside this
// closure and the first six are returned so main.js can `Object.assign(ctx,bindInput(ctx))`.
import {$} from './dom.js';
import {bindPageActivity} from './page-activity.js';
import {abilitiesFor} from './classes.js';
import {distance} from './combat.js';
import {icon} from './icon-atlas.js';
import {menuNavigationMarkup,updateMenuNavigation} from './menu-chrome.js';
export function bindInput(ctx,{windowTarget=window,documentTarget=document}={}){
 $('world').addEventListener('pointermove',ctx.updatePointer);
 $('world').addEventListener('pointerleave',()=>{ctx.mouseInWorld=false;ctx.updateMouseTarget();});
 $('world').addEventListener('pointerdown',event=>{
  if(!ctx.ready||ctx.paused||ctx.backgrounded||ctx.state.ended||!ctx.network?.connected)return;
  event.preventDefault();$('world').focus({preventScroll:true});ctx.awaken();ctx.updatePointer(event);
  if(event.button===2){stopAttackMovement();ctx.perform('bolt');return;}if(event.button!==0)return;
  const action=ctx.mouseAction;
  if(action?.kind==='loot'){ctx.collectClickedLoot(action.target.id);return;}
  if(action?.kind==='region'){ctx.interactRegion(action.target);return;}
  if(action?.kind==='door'){ctx.enterBuilding(action.target);return;}
  if(action?.kind==='npc'){ctx.life.interact(action.target.id);return;}
  ctx.lockedEnemy=action?.kind==='enemy'?action.target:null;
  if(ctx.lockedEnemy){
   ctx.attackHeld=true;
   ctx.angle=Math.atan2(ctx.lockedEnemy.model.position.x-ctx.player.position.x,ctx.lockedEnemy.model.position.z-ctx.player.position.z);
   stopAttackMovement();
   if(attacksFromHere()||distance(ctx.player.position,ctx.lockedEnemy.model.position)<=abilitiesFor(ctx.state).attack.range)ctx.perform('attack');
  }else if(event.shiftKey||distance(ctx.player.position,ctx.targetWorld)<2.4){stopAttackMovement();ctx.attackHeld=true;ctx.perform('attack');}
  else ctx.setDestination(ctx.targetWorld);
  ctx.updateMouseTarget();
 });
 // Ranged attacks never turn into movement, even beyond projectile range or
 // when a wall blocks the shot. Shift also keeps melee attacks in place.
 function attacksFromHere(){return abilitiesFor(ctx.state).attack.kind==='projectile'||ctx.pointerShift;}
 function stopAttackMovement(){
  ctx.moveTarget=null;ctx.movePath=[];ctx.life.pending=null;ctx.pendingRegionInteraction=null;
  ctx.networkDirection={x:0,z:0};ctx.network.input={x:0,z:0,angle:ctx.angle};ctx.network.send('input',ctx.network.input);
 }
 function releaseMouseAttack(){if(ctx.lockedEnemy)stopAttackMovement();ctx.attackHeld=false;ctx.lockedEnemy=null;ctx.updateMouseTarget();}
 windowTarget.addEventListener('pointerup',event=>{if(event.button===0)releaseMouseAttack();});
 windowTarget.addEventListener('pointercancel',()=>{ctx.mouseInWorld=false;releaseMouseAttack();});$('world').addEventListener('contextmenu',e=>e.preventDefault());
 for(const type of ['keydown','keyup'])windowTarget.addEventListener(type,event=>{if(event.key==='Shift'){ctx.pointerShift=event.shiftKey;ctx.updateMouseTarget();}});
 windowTarget.addEventListener('keydown',event=>{if(event.defaultPrevented||ctx.journeyLeaving||ctx.journeyConflict||!ctx.ready||!ctx.network?.connected||!$('loading').hidden)return;if(event.key!=='Escape'&&(event.target instanceof HTMLInputElement||event.target instanceof HTMLTextAreaElement||event.target instanceof HTMLSelectElement))return;const key=event.key.toLowerCase();if(ctx.rosterPicker?.open)return;if(key==='c'&&!event.repeat){ctx.openRoster();return;}if(event.target instanceof HTMLButtonElement&&[' ','enter'].includes(key))return;if([' ','arrowup','arrowdown','arrowleft','arrowright','tab'].includes(key)&&key!=='tab')event.preventDefault();if(event.repeat&&['escape','1','2','3','h','j','m','f','i'].includes(key))return;if(key==='escape'){if(ctx.mapExpanded)toggleMap();else if(ctx.paused)ctx.closeModal();else ctx.showModal('pause');return;}if(key==='h'){ctx.paused?ctx.closeModal():ctx.showModal('help');return;}if(key==='j'){ctx.paused?ctx.closeModal():ctx.showModal('journal');return;}if(key==='m'){toggleMap();return;}if(key==='i'){ctx.paused?ctx.closeModal():ctx.showModal('inventory');return;}if(!ctx.ready||ctx.paused||ctx.backgrounded||ctx.state.ended||!ctx.network?.connected)return;ctx.keys.add(key);if(['w','a','s','d','arrowup','arrowdown','arrowleft','arrowright','1','2','3'].includes(key))ctx.awaken();if(key==='1')ctx.perform('dodge');if(key==='2')ctx.perform('nova');if(key==='3')ctx.perform('heal');if(key==='f'){ctx.awaken();const result=ctx.interact();if(!result.ok)ctx.toast(result.reason);}});windowTarget.addEventListener('keyup',event=>ctx.keys.delete(event.key.toLowerCase()));
 function releaseInput({resetTouch=true}={}){ctx.keys.clear();ctx.attackHeld=false;ctx.moveTarget=null;ctx.movePath=[];ctx.lockedEnemy=null;ctx.pendingRegionInteraction=null;ctx.mouseInWorld=false;ctx.pointerShift=false;ctx.mouseAction=null;ctx.mouseTargeting?.show(null);$('world').classList.remove('enemy-hover','enemy-attacking','loot-hover');if(ctx.network){ctx.network.input={x:0,z:0,angle:ctx.angle};ctx.network.send('input',ctx.network.input);}if(resetTouch)releaseJoystick();}
 ctx.releaseInput=releaseInput;
 bindPageActivity({windowTarget,documentTarget,releaseInput,setBackgrounded:hidden=>{if(hidden){ctx.autosave?.emergency();ctx.autosave?.changed();ctx.autosave?.flush().catch(()=>{});}ctx.backgrounded=hidden;ctx.clock?.getDelta();ctx.network?.advance?.(0,true);ctx.syncAudioState();}});
 documentTarget.querySelectorAll('[data-action]').forEach(button=>button.addEventListener('pointerdown',e=>{e.preventDefault();e.stopPropagation();if(ctx.paused||ctx.backgrounded||ctx.state.ended)return;ctx.awaken();if(ctx.coarse||!ctx.aimActive){const near=ctx.nearestEnemy();if(near)ctx.angle=Math.atan2(near.model.position.x-ctx.player.position.x,near.model.position.z-ctx.player.position.z);}ctx.perform(button.dataset.action);}));
 documentTarget.querySelectorAll('[data-action]').forEach(button=>button.addEventListener('click',event=>{if(event.detail===0&&!ctx.paused&&!ctx.backgrounded){ctx.awaken();ctx.perform(button.dataset.action);}}));
 $('sound-button').onclick=async()=>{const wasReady=ctx.audio.ready;await ctx.audio.unlock();if(!ctx.audio.ready){ctx.toast('Sound could not start. Try again.');return;}const muted=wasReady?ctx.audio.toggle():ctx.audio.muted;ctx.syncAudioState();$('sound-button').innerHTML=icon(muted?'muted':'volume');$('sound-button').setAttribute('aria-label',muted?'Enable sound':'Mute sound');$('audio-prompt').style.opacity='0';ctx.toast(muted?'Sound muted':'Sound enabled');};$('help-button').onclick=()=>ctx.showModal('help');$('journal-button').onclick=()=>ctx.showModal('journal');$('pause-button').onclick=()=>ctx.showModal('pause');$('map-button').onclick=toggleMap;$('inventory-button').onclick=()=>ctx.showModal('inventory');$('character-button').onclick=ctx.openRoster;$('interact-button').onclick=()=>{if(ctx.paused||ctx.backgrounded)return;ctx.awaken();const r=ctx.interact();if(!r.ok)ctx.toast(r.reason);};$('fullscreen-button').onclick=()=>{if(documentTarget.fullscreenElement)documentTarget.exitFullscreen?.();else $('game').requestFullscreen?.().catch(()=>ctx.toast('Fullscreen is unavailable in this view.'));};
 function toggleMap(){
  if(!ctx.ready||ctx.state.ended||ctx.paused&&!ctx.mapExpanded)return;
  ctx.mapExpanded=!ctx.mapExpanded;ctx.audio.play(ctx.mapExpanded?'ui-open':'ui-close',.5);
  const panel=documentTarget.querySelector('.map-panel');panel.classList.toggle('expanded',ctx.mapExpanded);
  $('map-button').setAttribute('aria-label',ctx.mapExpanded?'Close map':'Expand map');
  if(ctx.mapExpanded){panel.setAttribute('role','dialog');panel.setAttribute('aria-modal','true');panel.setAttribute('aria-labelledby','map-title');updateMenuNavigation($('map-navigation'),'map',{canChangeCharacter:!ctx.activeJourney&&ctx.safeHere(),characterLocked:!!ctx.activeJourney});$('map-button').focus({preventScroll:true});}
  else{panel.removeAttribute('role');panel.removeAttribute('aria-modal');panel.removeAttribute('aria-labelledby');$('world').focus({preventScroll:true});}
  ctx.paused=ctx.mapExpanded;releaseInput();ctx.syncAudioState();ctx.drawMap();ctx.exploration.save();
 }
 function navigateMenu(kind){
  if(!ctx.ready||!ctx.network?.connected||ctx.state.ended)return;
  if(ctx.mainMenuOpen)ctx.resumeFromMainMenu();
  if(kind==='character'){ctx.openRoster();return;}
  if(ctx.mapExpanded)toggleMap();
  if(kind==='map'){if(ctx.modalKind)ctx.closeModal();toggleMap();return;}
  ctx.currentNpc=null;ctx.showModal(kind);
 }
 for(const id of ['modal-navigation','map-navigation']){
  $(id).innerHTML=menuNavigationMarkup();
  $(id).addEventListener('click',event=>{const button=event.target.closest('[data-menu]');if(button&&!button.disabled)navigateMenu(button.dataset.menu);});
 }
 documentTarget.querySelector('.map-panel').addEventListener('keydown',event=>{
  if(!ctx.mapExpanded||event.key!=='Tab')return;
  const buttons=[...documentTarget.querySelectorAll('.map-panel button:not(:disabled)')].filter(el=>el.getClientRects().length),first=buttons[0],last=buttons.at(-1);
  if(event.shiftKey&&documentTarget.activeElement===first){event.preventDefault();last.focus();}else if(!event.shiftKey&&documentTarget.activeElement===last){event.preventDefault();first.focus();}
 });
 const joystick=$('joystick');joystick.addEventListener('pointerdown',event=>{if(ctx.paused||ctx.backgrounded||!ctx.ready||!ctx.network?.connected||ctx.joystickPointer!==null)return;event.preventDefault();ctx.joystickPointer=event.pointerId;joystick.setPointerCapture(event.pointerId);ctx.awaken();updateJoystick(event);});joystick.addEventListener('pointermove',event=>{if(event.pointerId===ctx.joystickPointer)updateJoystick(event);});function releaseJoystick(){const pointerId=ctx.joystickPointer;ctx.joystickPointer=null;ctx.joystickValue={x:0,y:0};$('joystick-thumb').style.transform='';const stick=$('joystick');if(pointerId!==null&&stick.hasPointerCapture(pointerId))stick.releasePointerCapture(pointerId);}for(const type of ['pointerup','pointercancel','lostpointercapture'])joystick.addEventListener(type,event=>{if(event.pointerId===ctx.joystickPointer)releaseJoystick();});function updateJoystick(event){const r=joystick.getBoundingClientRect(),x=event.clientX-r.left-r.width/2,y=event.clientY-r.top-r.height/2,length=Math.hypot(x,y),scale=Math.min(34,length)/Math.max(1,length);ctx.joystickValue={x:x*scale/34,y:y*scale/34};$('joystick-thumb').style.transform=`translate(${x*scale}px,${y*scale}px)`;}
 return {attacksFromHere,stopAttackMovement,releaseMouseAttack,releaseInput,toggleMap,navigateMenu};
}
