// syncAudioState/awaken/audioAt/footstepCue/updateAudioWorld moved verbatim out of
// main.js (M7). Free identifiers: $ (./dom.js, awaken). hasLineOfSight (./combat.js,
// audioAt). distance (./combat.js, updateAudioWorld). zoneAt (./campaign.js, footstepCue).
// ctx.network/ctx.ready/ctx.paused/ctx.backgrounded/ctx.rosterPicker/ctx.audio/ctx.started/
// ctx.player/ctx.environment/ctx.audioInterior/ctx.state/ctx.enemies/ctx.renderedMap
// (already-declared ctx data fields). ctx.safeHere/ctx.bossType (game-context.js). awaken
// calls syncAudioState directly -- both stay in this closure, same as updateUI calling
// updateClassHud directly in hud.js.
import {$} from './dom.js';
import {hasLineOfSight,distance} from './combat.js';
import {zoneAt} from './campaign.js';
export function createGameAudio(ctx){
 function syncAudioState(connected=!!ctx.network?.connected){const silent=!ctx.ready||!connected||ctx.paused||ctx.backgrounded||!!ctx.rosterPicker?.open;if(ctx.audio.paused!==silent||ctx.audio.backgrounded!==ctx.backgrounded)ctx.audio.pause(silent,ctx.backgrounded);}
 function awaken(){if(ctx.ready)ctx.started=true;syncAudioState();ctx.audio.unlock().then(()=>{if(!ctx.audio.ready)return;syncAudioState();$('audio-prompt').style.opacity='0';$('sound-button').setAttribute('aria-label',ctx.audio.muted?'Enable sound':'Mute sound');});}
 // Sound locations use the player's ears and the isometric camera's horizontal axis.
 function audioAt(cue,position,volume=1,rate=1){ctx.audio.listener={x:ctx.player.position.x,z:ctx.player.position.z};return ctx.audio.play(cue,volume,rate,{position,occluded:!hasLineOfSight(ctx.player.position,position,ctx.environment.obstacles,.1)});}
 function footstepCue(){const room=ctx.environment.currentBuilding(ctx.player.position);if(room)return room.chapel?'step':'step-wood';return zoneAt(ctx.player.position)==='road'&&Math.abs(ctx.player.position.z-5)>1.8?'step-dirt':'step';}
 function updateAudioWorld(dt){const room=ctx.environment.currentBuilding(ctx.player.position),interior=room?.id??null;if(interior!==ctx.audioInterior){if(ctx.started)ctx.audio.play('door',.44);ctx.audioInterior=interior;}let threat=0;if(!ctx.state.ended&&!ctx.safeHere())for(const e of ctx.enemies)if(!e.dead){const proximity=Math.max(0,1-distance(ctx.player.position,e.model.position)/13);threat+=proximity*(ctx.bossType(e.type)?1:.42);}ctx.audio.update(dt,{zone:ctx.state.zone,position:ctx.player.position,interior:!!room,threat:Math.min(1,threat),health:ctx.state.hp/ctx.state.maxHp,ended:ctx.state.ended,victory:ctx.renderedMap==='overworld'?ctx.state.victory:ctx.state.campaignComplete});}
 return {syncAudioState,awaken,audioAt,footstepCue,updateAudioWorld};
}
