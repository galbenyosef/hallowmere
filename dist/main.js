import {ExplorationAtlas,bindExplorationSaving} from './exploration-map.js';
import {readGameSettings} from './game-settings.js';
import {JourneyStore} from './journey-store.js';
import {abilitiesFor} from './classes.js';
import * as T from './vendor/three.core.js';
import {AudioEngine} from './audio.js';
import {createResourceOrbs} from './resource-orbs.js';
import {createState,canUse} from './combat.js';
import {createCampaign} from './campaign.js';
import {createGameContext,assertWired} from './game-context.js';
import {paintIcons} from './icon-atlas.js';
import {createModelCache} from './model-kit.js';
import {createEffects} from './effects-factory.js';
import {createEnemySpawner} from './enemy-spawner.js';
import {createPointerTargeting} from './pointer-targeting.js';
import {createInteraction} from './interaction.js';
import {createRegionTravel} from './region-travel.js';
import {createSceneSetup} from './scene-setup.js';
import {bindInput} from './input-bindings.js';
import {createPlayerMotion} from './player-motion.js';
import {createRenderLoop} from './render-loop.js';
import {createHud} from './hud.js';
import {createGameAudio} from './game-audio.js';
import {createInventoryUi} from './inventory-ui.js';
import {createModals} from './modals.js';
import {createConnectionUi} from './connection-ui.js';
import {createSessionLifecycle} from './session-lifecycle.js';
import {createSnapshotApply} from './snapshot-apply.js';
import {createNetworkEvents} from './network-events.js';
import {createSharedWorldRender} from './shared-world-render.js';
import {installAutomationSurface} from './automation-surface.js';
paintIcons(document);
const resourceOrbs=createResourceOrbs(),exploration=new ExplorationAtlas();bindExplorationSaving(exploration);
const gameSettings=readGameSettings(),audio=new AudioEngine();audio.musicEnabled=gameSettings.music;
const ctx=createGameContext({audio,gameSettings,exploration,resourceOrbs,journeyStore:new JourneyStore(),previewMode:['caves','exploration','predator','enemies'].includes(new URLSearchParams(location.search).get('preview')),reducedMotion:matchMedia('(prefers-reduced-motion: reduce)').matches,coarse:matchMedia('(pointer: coarse)').matches});
// The wiring block, in boot order: a factory's import-time DOM bindings and listener registrations happen where its line sits.
Object.assign(ctx,createModelCache(ctx));
Object.assign(ctx,createEffects(ctx),createEnemySpawner(ctx));
Object.assign(ctx,createPointerTargeting(ctx),createInteraction(ctx),createRegionTravel(ctx));
ctx.state=Object.assign(createState(),createCampaign(crypto.getRandomValues(new Uint32Array(1))[0]));
// Session lifecycle creates ctx.titleScreen/ctx.journeysMenu and registers pagehide #1; bindInput
// below reads ctx.openRoster eagerly while it wires $('character-button').onclick, so it stays above.
Object.assign(ctx,createSessionLifecycle(ctx));
Object.assign(ctx,createHud(ctx),createGameAudio(ctx));
Object.assign(ctx,createSceneSetup(ctx));
window.addEventListener('resize',ctx.resize);
Object.assign(ctx,bindInput(ctx));
ctx.perform=perform;
Object.assign(ctx,createPlayerMotion(ctx));
Object.assign(ctx,createRenderLoop(ctx));
Object.assign(ctx,createInventoryUi(ctx),createModals(ctx));
Object.assign(ctx,createConnectionUi(ctx));
// Runtime-only, so this line stands where the three declarations did: after createConnectionUi,
// whose ctx.connectionStatus applySnapshot calls, and before the automation surface.
Object.assign(ctx,createSnapshotApply(ctx),createNetworkEvents(ctx),createSharedWorldRender(ctx));
installAutomationSurface(ctx);
assertWired(ctx);
const loadingFrame=()=>new Promise(resolve=>requestAnimationFrame(()=>setTimeout(resolve,0)));
async function init(){ctx.loadingFailed=false;try{
 await loadingFrame();
 await ctx.buildRenderer();
 await ctx.buildWorld();
 ctx.titleScreen.setProgress(92,'Preparing your calling…');await loadingFrame();
 await ctx.buildHero();
 ctx.clock=new T.Clock();ctx.assetsReady=true;ctx.updateUI();ctx.drawMap();ctx.titleScreen.setProgress(100);ctx.showModeChoice();ctx.renderer.setAnimationLoop(ctx.frame);
 }catch(error){ctx.loadingFailed=true;console.error(error);ctx.titleScreen.showError();}}
function perform(action){
 if(!ctx.ready||ctx.paused||ctx.rosterPicker?.open||ctx.backgrounded||ctx.state.ended||!ctx.network?.connected||!canUse(ctx.state,action))return false;
 const skill=abilitiesFor(ctx.state)[action],offensive=action!=='dodge'&&action!=='heal'&&skill.kind!=='support';
 const targetEnemy=offensive?(ctx.attackHeld&&ctx.lockedEnemy&&!ctx.lockedEnemy.dead?ctx.lockedEnemy:ctx.mouseTargeting?.selected):null;
 let aimPoint=ctx.aimActive?ctx.targetWorld:null;
 if(targetEnemy&&!targetEnemy.dead){aimPoint=targetEnemy.model.position;ctx.angle=Math.atan2(aimPoint.x-ctx.player.position.x,aimPoint.z-ctx.player.position.z);}
 else if(!ctx.aimActive&&action!=='dodge'){const target=ctx.nearestEnemy(Math.max(7,skill.range||0));if(target)ctx.angle=Math.atan2(target.model.position.x-ctx.player.position.x,target.model.position.z-ctx.player.position.z);}
 else if(ctx.aimActive&&action!=='dodge')ctx.angle=Math.atan2(ctx.targetWorld.x-ctx.player.position.x,ctx.targetWorld.z-ctx.player.position.z);
 if(!ctx.network.send('ability',{action,angle:ctx.angle,...(aimPoint?{target:{x:aimPoint.x,z:aimPoint.z}}:{})}))return false;
 // Local cooldown is a UI hint; only the server spends resources or applies damage.
 ctx.state.cooldowns[action]=abilitiesFor(ctx.state)[action].cooldown;
 const button=document.querySelector(`[data-action="${action}"]`);button?.classList.add('active');setTimeout(()=>button?.classList.remove('active'),130);return true;
}
// Begin the score during loading; retry blocked autoplay on any player gesture.
for(const event of ['pointerdown','click','keydown'])window.addEventListener(event,()=>{if(!ctx.audio.ready||ctx.audio.context?.state==='suspended'||ctx.audio.music?.blocked)ctx.awaken();},{capture:true});
ctx.awaken();init();
window.addEventListener('pagehide',event=>{if(!event.persisted)ctx.worldPreview?.dispose();});
