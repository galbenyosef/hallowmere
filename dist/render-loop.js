// frame() moved verbatim out of main.js (M11): the per-frame step the renderer drives through
// setAnimationLoop. Not one statement moved, and the two branches a stalled page takes -- frozen
// (paused, roster picker open, backgrounded, or no transport) and backgrounded (no rendering at
// all) -- still gate exactly the statements they gated before; tests/render-loop.test.mjs records
// the call order through each of them.
//
// Free identifiers: T (three, only T.Vector3, so the core build), zoneAt/zoneName (./campaign.js)
// and distance (./combat.js) stay plain imports. Math is a global. Everything else this function
// touches was already spelled ctx.* in main.js, so no rename was needed.
import * as T from './vendor/three.core.js';
import {zoneAt,zoneName} from './campaign.js';
import {distance} from './combat.js';
export function createRenderLoop(ctx){
 function frame(){if(!ctx.ready)return;const raw=ctx.clock.getDelta(),dt=Math.min(raw,.035),frozen=ctx.paused||ctx.rosterPicker?.open||ctx.backgrounded||!ctx.network?.connected;ctx.network?.advance?.(raw,frozen);if(ctx.network?.connected&&!ctx.backgrounded&&(ctx.sessionMode==='multiplayer'||!frozen))ctx.movementCorrection.update(ctx.player.position,dt,ctx.environment.obstacles,ctx.worldBounds());if(!frozen){ctx.accumulated+=dt;for(const k in ctx.state.cooldowns)ctx.state.cooldowns[k]=Math.max(0,ctx.state.cooldowns[k]-dt);ctx.updatePlayer(dt,ctx.accumulated);if(!ctx.state.ended){ctx.life.update(ctx.accumulated);if(ctx.pendingRegionInteraction){const interaction=ctx.regionInteractions().find(r=>r.id===ctx.pendingRegionInteraction);if(!interaction)ctx.pendingRegionInteraction=null;else if(ctx.canReachRegion(interaction,2.7))ctx.interactRegion(interaction);}}const zone=ctx.renderedMap==='overworld'?zoneAt(ctx.player.position):ctx.renderedMap;if(zone!==ctx.state.zone){ctx.state.zone=zone;if(!ctx.state.visited.includes(zone))ctx.state.visited.push(zone);ctx.toast(zoneName(zone)+(zone==='ashwick'?' · Sanctuary':''));}ctx.audioTimer+=dt;if(ctx.audioTimer>=.1){ctx.updateAudioWorld(ctx.audioTimer);ctx.audioTimer=0;}}
  if(frozen&&ctx.network)ctx.network.input={x:0,z:0,angle:ctx.angle};
  if(!ctx.backgrounded){if(frozen)ctx.accumulated+=dt;ctx.renderSharedWorld(dt,ctx.accumulated);ctx.renderRegionLabels();ctx.updateEffects(dt);ctx.environment.update(ctx.accumulated,dt,ctx.state.victory,ctx.camera,ctx.player.position);if(ctx.renderedMap==='overworld')ctx.landmarks?.update?.(ctx.accumulated);}
  const desired=ctx.player.position.clone().add(new T.Vector3(0,0,-3.4));ctx.cameraTarget.lerp(desired,1-Math.exp(-dt*4));ctx.camera.position.copy(ctx.cameraTarget).add(ctx.cameraOffset);ctx.shake=Math.max(0,ctx.shake-dt*.35);if(ctx.shake>0&&!frozen&&ctx.gameSettings.cameraShake){ctx.camera.position.x+=(Math.random()-.5)*ctx.shake;ctx.camera.position.z+=(Math.random()-.5)*ctx.shake;}ctx.camera.lookAt(ctx.cameraTarget);ctx.worldPreview?.update(ctx.camera);ctx.moonLight.position.set(ctx.player.position.x-16,29,ctx.player.position.z+9);ctx.moonLight.target.position.set(ctx.player.position.x,0,ctx.player.position.z);ctx.moonLight.target.updateMatrixWorld();ctx.updateMouseTarget();ctx.life.renderLabels(ctx.enemies.some(e=>!e.dead&&distance(e.model.position,ctx.player.position)<8&&!ctx.safeHere()),ctx.keys.has('alt'));ctx.updateFloaters(ctx.backgrounded?0:dt);ctx.uiTimer+=dt;if(ctx.uiTimer>.09){ctx.uiTimer=0;ctx.updateUI();ctx.drawMap();}ctx.multiplayerView?.update(dt,ctx.accumulated);ctx.renderer.render(ctx.scene,ctx.camera);ctx.resourceOrbs.update(frozen?0:dt,ctx.state.hp/ctx.state.maxHp,ctx.state.mana/ctx.state.maxMana);}
 return {frame};
}
