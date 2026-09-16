import {createEnemyOrb} from './enemy-visuals.js';
import {ExplorationAtlas,drawExplorationMap,bindExplorationSaving} from './exploration-map.js';
import {readGameSettings,saveGameSettings,applyGameVisuals} from './game-settings.js';
import {pauseMenuMarkup,bindPauseMenu} from './pause-menu.js';
import {menuNavigationMarkup,updateMenuNavigation} from './menu-chrome.js';
import {renderDialogue,handleDialogueKey} from './dialogue.js';
import {npcPortraitFor} from './npc-portraits.js';
import {createTitleScreen} from './title-screen.js';
import {LocalSession} from './local-session.js';
import {JourneyStore,createAutosave} from './journey-store.js';
import {createJourney} from './journey-state.js';
import {createJourneysMenu} from './journeys-menu.js';
import {consumeAvailability} from './foraging.js';
import {updateInventoryResources} from './pouch.js';
import {CLASSES,abilitiesFor,abilityForEvent,classFor,classAppearance,conceptFor,classColor} from './classes.js';
import {createPredatorWorldPreview} from './predator-world-preview.js';
import {createRosterPicker} from './roster-picker.js';
import {prepareCharacterPortraits} from './character-portraits.js';
import {prepareInventoryPortrait} from './inventory-portraits.js';
import {inventoryPortraitStatus} from './character-art.js';
import {createClassEffects} from './class-effects.js';
import {MultiplayerClient,predictedPosition} from './multiplayer-client.js';
import {createMultiplayerView,disposeActor} from './multiplayer-view.js';
import {MovementCorrection,predictDodge} from './multiplayer-motion.js';
import {angleLerp} from './multiplayer-protocol.js';
import * as T from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {createEnvironment} from './environment.js';
import {MAPS,mapFor,CHECKPOINTS} from './regions.js';
import {regionActionName,usesLegacyTelegraph} from './region-client-ui.js';
import {createRegionEnvironment,createRegionLandmarks} from './region-environment.js';
import {AudioEngine} from './audio.js';
import {createResourceOrbs} from './resource-orbs.js';
import {createCombatEffects,animateHeroAttack} from './combat-effects.js';
import {bindPageActivity} from './page-activity.js';
import {ENEMY_TYPES,ABILITIES,createState,canUse,resolveMove,distance,findPath,hasLineOfSight} from './combat.js';
import {START,NPCS,createCampaign,zoneAt,zoneName,isSanctuary,npcDialogue,questSummary} from './campaign.js';
import {VillageLife} from './world-actors.js';
import {createMouseTargeting} from './mouse-targeting.js';
import {inventoryMarkup,bindInventoryPreviews} from './inventory.js';
import {$} from './dom.js';
import {createGameContext} from './game-context.js';
import {icon,classIconNames,paintIcons} from './icon-atlas.js';
import {optimizeModel,getRig,createModelCache} from './model-kit.js';
import {createEffects} from './effects-factory.js';
import {createEnemySpawner} from './enemy-spawner.js';
import {createPointerTargeting} from './pointer-targeting.js';
import {createInteraction} from './interaction.js';
import {createRegionTravel} from './region-travel.js';
import {bindInput} from './input-bindings.js';
import {createPlayerMotion} from './player-motion.js';
import {createHud} from './hud.js';
import {createGameAudio} from './game-audio.js';
import {createInventoryUi} from './inventory-ui.js';
import {createModals} from './modals.js';
paintIcons(document);
const resourceOrbs=createResourceOrbs();
const exploration=new ExplorationAtlas();
bindExplorationSaving(exploration);
const gameSettings=readGameSettings(),audio=new AudioEngine();audio.musicEnabled=gameSettings.music;
const ctx=createGameContext({audio,gameSettings,exploration,resourceOrbs,journeyStore:new JourneyStore(),previewMode:['caves','exploration','predator','enemies'].includes(new URLSearchParams(location.search).get('preview')),reducedMotion:matchMedia('(prefers-reduced-motion: reduce)').matches,coarse:matchMedia('(pointer: coarse)').matches});
Object.assign(ctx,createModelCache(ctx));
Object.assign(ctx,createEffects(ctx),createEnemySpawner(ctx));
Object.assign(ctx,createPointerTargeting(ctx),createInteraction(ctx),createRegionTravel(ctx));
ctx.state=Object.assign(createState(),createCampaign(crypto.getRandomValues(new Uint32Array(1))[0]));
ctx.titleScreen=createTitleScreen($('loading'),{onBegin:chooseMode,onResume:resumeFromMainMenu,onChangeCharacter:openRoster});
ctx.journeysMenu=createJourneysMenu({store:ctx.journeyStore,onNew:chooseJourneyCharacter,onContinue:continueJourney,onBack:showModeChoice});
const loadingFrame=()=>new Promise(resolve=>requestAnimationFrame(()=>setTimeout(resolve,0)));
async function init(){let loadingFailed=false;try{
 await loadingFrame();
 ctx.renderer=new T.WebGLRenderer({canvas:$('world'),antialias:true,powerPreference:'high-performance'});ctx.renderer.setPixelRatio(Math.min(devicePixelRatio,1.7));ctx.renderer.shadowMap.enabled=true;ctx.renderer.shadowMap.type=T.PCFSoftShadowMap;ctx.renderer.outputColorSpace=T.SRGBColorSpace;ctx.renderer.toneMapping=T.ACESFilmicToneMapping;applyGameVisuals(ctx.gameSettings,ctx.renderer);
 ctx.scene=new T.Scene();ctx.scene.background=new T.Color(0x101c2b);ctx.scene.fog=new T.FogExp2(0x14283a,.017);ctx.camera=new T.OrthographicCamera(-20,20,15,-15,.1,150);ctx.camera.position.copy(ctx.cameraTarget).add(ctx.cameraOffset);ctx.camera.lookAt(ctx.cameraTarget);resize();
 ctx.hemisphereLight=new T.HemisphereLight(0x9eb8d0,0x493629,1.3);ctx.scene.add(ctx.hemisphereLight);const moon=ctx.moonLight=new T.DirectionalLight(0x86b5ed,2.35);moon.position.set(-16,29,9);moon.castShadow=true;moon.shadow.mapSize.set(2048,2048);Object.assign(moon.shadow.camera,{left:-38,right:38,top:38,bottom:-38,near:.5,far:90});moon.shadow.bias=-.00025;moon.shadow.normalBias=.035;moon.shadow.radius=2;ctx.scene.add(moon,moon.target);const rim=ctx.rimLight=new T.DirectionalLight(0x4aa7ce,1.25);rim.position.set(14,12,-22);ctx.scene.add(rim);
 const beforeEnvironment=new Set(ctx.scene.children);ctx.environment=ctx.overworldEnvironment=createEnvironment(ctx.scene);ctx.landmarks=createRegionLandmarks(ctx.scene,'overworld');ctx.overworldObjects=ctx.scene.children.filter(o=>!beforeEnvironment.has(o));ctx.combatEffects=createCombatEffects(ctx.scene,ctx.environment.glowTexture,{reducedMotion:ctx.reducedMotion});ctx.classEffects=createClassEffects(ctx.scene,{reducedMotion:ctx.reducedMotion});ctx.titleScreen.setProgress(28,'Lighting the village…');
 const loader=new GLTFLoader(),models=['warden','hollow','grave-hound','revenant','bellkeeper','elder','healer','smith','watchman'];let loaded=0;ctx.titleScreen.setProgress(28,'Gathering the world…');await Promise.all(models.map(async name=>{const result=await loader.loadAsync(new URL(`./assets/models/${name}.glb`,import.meta.url).href);optimizeModel(result.scene);ctx.prefabs[name]=result.scene;loaded++;if(!loadingFailed){ctx.titleScreen.setProgress(28+loaded/models.length*62,'Gathering the world…');}}));
 ctx.titleScreen.setProgress(92,'Preparing your calling…');await loadingFrame();
 ctx.player=new T.Group();ctx.player.add(ctx.cloneModel('warden'));ctx.player.userData.characterKey='warden';ctx.player.position.set(START.x,0,START.z);ctx.cameraTarget.set(START.x,0,START.z-3.4);ctx.scene.add(ctx.player);ctx.heroRig=getRig(ctx.player);ctx.selection=new T.Mesh(new T.RingGeometry(.43,.475,48),new T.MeshBasicMaterial({color:0xd2c79c,transparent:true,opacity:.55,depthWrite:false}));ctx.selection.rotation.x=-Math.PI/2;ctx.selection.position.y=.095;ctx.scene.add(ctx.selection);ctx.playerLight=new T.PointLight(0xffdfaa,10,6,2);ctx.scene.add(ctx.playerLight);ctx.spellLight=new T.PointLight(0xff7733,0,10,2);ctx.scene.add(ctx.spellLight);
 if(new URLSearchParams(location.search).get('preview')==='predator'){ctx.worldPreview=createPredatorWorldPreview({scene:ctx.scene,player:ctx.player});optimizeModel(ctx.worldPreview.root);resize();}
 ctx.life=new VillageLife({scene:ctx.scene,camera:ctx.camera,player:ctx.player,state:ctx.state,cloneModel:ctx.cloneModel,reducedMotion:ctx.reducedMotion,obstacles:ctx.environment.obstacles,onTalk:ctx.talkTo,onCollect:ctx.lootCollected,onLootClick:ctx.collectClickedLoot,onApproach:point=>{awaken();return ctx.setDestination(point);}});
 ctx.mouseTargeting=createMouseTargeting({scene:ctx.scene,camera:ctx.camera,canvas:$('world'),enemies:ctx.enemies});
 ctx.multiplayerView=createMultiplayerView({scene:ctx.scene,camera:ctx.camera,cloneModel:ctx.cloneModel,getRig,animateRig:ctx.animateRig,animateHeroAttack,player:ctx.player});
 ctx.rosterPicker=createRosterPicker({getState:()=>ctx.creatingJourney?{}:ctx.state,onChoose:chooseCharacter,onClose:closeRoster,onNavigate:navigateMenu});
 ctx.life.requestCollect=id=>!ctx.paused&&!ctx.backgrounded&&!ctx.state.ended&&ctx.network.send('collect',{id});ctx.life.requestForage=id=>!ctx.paused&&!ctx.backgrounded&&!ctx.state.ended&&ctx.network.send('forage',{id});
 ctx.clock=new T.Clock();ctx.assetsReady=true;ctx.updateUI();ctx.drawMap();ctx.titleScreen.setProgress(100);showModeChoice();ctx.renderer.setAnimationLoop(frame);
 }catch(error){loadingFailed=true;console.error(error);ctx.titleScreen.showError();}}
Object.assign(ctx,createHud(ctx),createGameAudio(ctx));
const {awaken,audioAt}=ctx;
function setModeChoiceInert(inert){for(const child of $('game').children)if(child.id!=='loading')child.inert=inert;}
setModeChoiceInert(true);
function showModeChoice(){
 setModeChoiceInert(true);
 ctx.ready=false;ctx.sessionMode=null;ctx.mainMenuOpen=false;ctx.syncAudioState();
 ctx.titleScreen.showModes();$('connection-overlay').hidden=true;
}
function chooseMode(mode){if(mode==='single-player'&&!ctx.previewMode)openJourneys();else startSession(mode);}
function openJourneys(preferredId){
 ctx.titleScreen.hide();setModeChoiceInert(true);ctx.ready=false;ctx.journeysMenu.show(preferredId);
}
function chooseJourneyCharacter(){ctx.creatingJourney=true;ctx.rosterPicker.show({journey:true});}
function chooseCharacter(choice){
 if(ctx.creatingJourney){beginJourney(choice);return true;}
 return ctx.network?.send('select-class',choice);
}
async function beginJourney(choice){
 // Let the existing picker enter its pending state before resolving it.
 await Promise.resolve();let record;
 try{
  record=await ctx.journeyStore.create(createJourney(choice));ctx.activeJourney=record;
  startSession('single-player',record.data);attachAutosave(record);
  ctx.creatingJourney=false;ctx.rosterPicker.resolve({ok:true});
 }catch(error){if(record){stopJourneySession();await ctx.journeyStore.release(record.id).catch(()=>{});}ctx.activeJourney=null;ctx.rosterPicker.resolve({ok:false,reason:error.message});}
}
async function continueJourney(id){
 const record=await ctx.journeyStore.acquire(id);
 try{ctx.activeJourney=record;startSession('single-player',record.data);attachAutosave(record);if(record.recovered)ctx.toast('Journey recovered from its previous save.');}
 catch(error){stopJourneySession();await ctx.journeyStore.release(id).catch(()=>{});throw error;}
}
function attachAutosave(record){
 ctx.autosave=createAutosave({store:ctx.journeyStore,record,getSave:()=>ctx.network.capture(),onStatus:updateSaveStatus,onConflict:error=>{
  ctx.journeyConflict=true;ctx.paused=true;releaseInput();ctx.audio.pause(true,ctx.backgrounded);
  ctx.journeysMenu.showConflict(error.message,()=>{stopJourneySession();openJourneys();});
  updateSaveStatus({kind:'error',message:error.message});
 }});
}
function updateSaveStatus(value=ctx.saveStatus){
 ctx.saveStatus=value;
 for(const element of document.querySelectorAll('[data-save-status], #journey-save-indicator')){element.textContent=value.message;element.dataset.kind=value.kind;}
 const indicator=$('journey-save-indicator');indicator.hidden=!ctx.activeJourney;clearTimeout(ctx.saveIndicatorTimer);
 if(value.kind==='saved')ctx.saveIndicatorTimer=setTimeout(()=>{indicator.hidden=true;},2500);
}
ctx.updateSaveStatus=updateSaveStatus;
async function saveAndExit(){
 if(!ctx.autosave||ctx.journeyLeaving||ctx.journeyConflict)return;
 ctx.journeyLeaving=true;ctx.paused=true;releaseInput();
 for(const button of document.querySelectorAll('[data-save-exit], [data-resume-game]'))button.disabled=true;
 try{const id=ctx.activeJourney.id;await ctx.autosave.exit();stopJourneySession();openJourneys(id);}
 catch(error){updateSaveStatus({kind:'error',message:error.message});}
 finally{ctx.journeyLeaving=false;for(const button of document.querySelectorAll('[data-save-exit], [data-resume-game]'))button.disabled=false;}
}
ctx.saveAndExit=saveAndExit;
function stopJourneySession(){
 ctx.autosave?.stop();ctx.autosave=null;ctx.network?.close();ctx.network=null;ctx.sessionGeneration++;ctx.ready=false;ctx.started=false;
 ctx.activeJourney=null;ctx.sessionMode=null;ctx.lastSnapshot=null;ctx.lastNetworkEvent=0;ctx.mainMenuOpen=false;ctx.journeyConflict=false;
 clearTimeout(ctx.victoryTimer);clearTimeout(ctx.saveIndicatorTimer);ctx.victoryShown=false;ctx.cavePreviewStarted=false;
 releaseInput();inventoryPreviews.hide();toggleMapForDeath();ctx.modalKind='';ctx.currentNpc=null;
 $('modal-shade').hidden=true;$('journey-save-indicator').hidden=true;$('connection-overlay').hidden=true;$('restart-vote').hidden=true;
 ctx.audio.pause(true,ctx.backgrounded);ctx.accumulated=0;ctx.uiTimer=0;ctx.audioTimer=0;ctx.dodgeTime=0;ctx.shake=0;ctx.resetMovement=true;
}
function startSession(mode,save){
 if(!ctx.assetsReady||ctx.sessionMode)return;
 ctx.sessionMode=mode;ctx.ready=true;setModeChoiceInert(false);const generation=++ctx.sessionGeneration;
 const current=callback=>(...args)=>{if(generation===ctx.sessionGeneration)callback(...args);};
 const callbacks={onSnapshot:current(applySnapshot),onProgress:current(soon=>ctx.autosave?.changed(soon)),onStatus:current(connectionStatus),onWelcome:current(()=>{releaseInput();ctx.movementCorrection.reset();ctx.resetMovement=true;ctx.moveTarget=null;ctx.movePath=[];})};
 ctx.network=mode==='single-player'?new LocalSession({...callbacks,save}):new MultiplayerClient(callbacks);
 ctx.titleScreen.hide();ctx.clock.getDelta();ctx.network.start();awaken();
}
function returnToModeChoice(){
 if(ctx.lastSnapshot)return;
 ctx.sessionGeneration++;ctx.network?.close();ctx.network=null;releaseInput();showModeChoice();
}
function mainMenuSession(){
 return {mode:ctx.sessionMode,canChangeCharacter:!ctx.activeJourney&&!!ctx.network?.connected&&!ctx.state.ended&&ctx.safeHere(),character:classFor(ctx.state).name,characterLocked:!!ctx.activeJourney};
}
function openMainMenu(){
 if(!ctx.ready||!ctx.network?.connected||!ctx.lastSnapshot||ctx.state.ended||ctx.rosterPicker?.open)return;
 if(ctx.mapExpanded)toggleMap();
 inventoryPreviews.hide();$('modal-shade').hidden=true;ctx.modalKind='';ctx.currentNpc=null;
 ctx.mainMenuOpen=true;ctx.paused=true;releaseInput();ctx.audio.pause(true,ctx.backgrounded);
 setModeChoiceInert(true);ctx.titleScreen.showMainMenu(mainMenuSession());
}
function resumeFromMainMenu(){
 if(ctx.journeyLeaving||ctx.journeyConflict)return;
 if(!ctx.mainMenuOpen||!ctx.network?.connected||ctx.state.ended)return;
 ctx.mainMenuOpen=false;$('loading').inert=false;ctx.titleScreen.hide();setModeChoiceInert(false);
 ctx.paused=false;releaseInput();ctx.clock.getDelta();ctx.syncAudioState();$('world').focus({preventScroll:true});
}
ctx.resumeFromMainMenu=resumeFromMainMenu;
function closeRoster(){
 releaseInput();
 if(ctx.creatingJourney){ctx.creatingJourney=false;openJourneys();return;}
 if(ctx.mainMenuOpen){ctx.paused=true;ctx.audio.pause(true,ctx.backgrounded);ctx.titleScreen.showMainMenu(mainMenuSession());return;}
 ctx.paused=false;ctx.syncAudioState();$('world').focus({preventScroll:true});
}
function dismissMainMenu(){
 if(!ctx.mainMenuOpen)return;
 ctx.mainMenuOpen=false;$('loading').inert=false;ctx.titleScreen.hide();setModeChoiceInert(false);
}
$('connection-back').onclick=returnToModeChoice;
window.addEventListener('pagehide',()=>{ctx.autosave?.emergency();ctx.autosave?.exit().catch(()=>{});ctx.network?.close();});
window.addEventListener('pageshow',event=>{if(event.persisted)location.reload();});

function resize(){if(!ctx.renderer)return;const w=innerWidth,h=innerHeight;ctx.renderer.setSize(w,h,false);const height=ctx.worldPreview||new URLSearchParams(location.search).get('preview')==='enemies'?19:w<650?28:29;ctx.camera.left=-height*(w/h)/2;ctx.camera.right=-ctx.camera.left;ctx.camera.top=height/2;ctx.camera.bottom=-height/2;ctx.camera.updateProjectionMatrix();}
window.addEventListener('resize',resize);
// openRoster is hoisted; bindInput reads ctx.openRoster while it wires $('character-button').onclick.
ctx.openRoster=openRoster;
Object.assign(ctx,bindInput(ctx));
// The four names main.js still calls itself stay module-scope bindings, so every remaining
// call site (and the vm slices that quote them) keeps the spelling it had before the move.
const {attacksFromHere,releaseInput,toggleMap,navigateMenu}=ctx;
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
ctx.perform=perform;
Object.assign(ctx,createPlayerMotion(ctx));
function syncPlayerCharacter(){
 if(ctx.state.classId&&!ctx.portraitsRequested){ctx.portraitsRequested=true;prepareCharacterPortraits().then(()=>{if(ctx.modalKind==='inventory')ctx.renderInventory();}).catch(error=>console.error('Character portraits unavailable',error));}
 const key=conceptFor(ctx.state.classId,ctx.state.appearanceId);if(ctx.player.userData.characterKey===key)return;
 for(const child of [...ctx.player.children])disposeActor(child);ctx.player.add(ctx.cloneModel(key));ctx.player.userData.characterKey=key;ctx.heroRig=getRig(ctx.player);
}
function openRoster(){
 if(ctx.activeJourney){ctx.toast('This journey keeps its chosen character. Start a new journey to choose another.');return;}
 if(!ctx.ready||!ctx.network?.connected||!ctx.rosterPicker||ctx.rosterPicker.open||ctx.state.ended)return;
 if(!ctx.safeHere()){if(ctx.mainMenuOpen)ctx.titleScreen.updateSession(mainMenuSession());else ctx.toast('Return to a sanctuary to change class.');return;}
 if(ctx.mainMenuOpen)ctx.titleScreen.hide();
 if(ctx.mapExpanded)toggleMap();inventoryPreviews.hide();$('modal-shade').hidden=true;ctx.modalKind='';ctx.currentNpc=null;ctx.paused=true;releaseInput();ctx.audio.pause(true,ctx.backgrounded);ctx.rosterPicker.show();
}
function frame(){if(!ctx.ready)return;const raw=ctx.clock.getDelta(),dt=Math.min(raw,.035),frozen=ctx.paused||ctx.rosterPicker?.open||ctx.backgrounded||!ctx.network?.connected;ctx.network?.advance?.(raw,frozen);if(ctx.network?.connected&&!ctx.backgrounded&&(ctx.sessionMode==='multiplayer'||!frozen))ctx.movementCorrection.update(ctx.player.position,dt,ctx.environment.obstacles,ctx.worldBounds());if(!frozen){ctx.accumulated+=dt;for(const k in ctx.state.cooldowns)ctx.state.cooldowns[k]=Math.max(0,ctx.state.cooldowns[k]-dt);ctx.updatePlayer(dt,ctx.accumulated);if(!ctx.state.ended){ctx.life.update(ctx.accumulated);if(ctx.pendingRegionInteraction){const interaction=ctx.regionInteractions().find(r=>r.id===ctx.pendingRegionInteraction);if(!interaction)ctx.pendingRegionInteraction=null;else if(ctx.canReachRegion(interaction,2.7))ctx.interactRegion(interaction);}}const zone=ctx.renderedMap==='overworld'?zoneAt(ctx.player.position):ctx.renderedMap;if(zone!==ctx.state.zone){ctx.state.zone=zone;if(!ctx.state.visited.includes(zone))ctx.state.visited.push(zone);ctx.toast(zoneName(zone)+(zone==='ashwick'?' · Sanctuary':''));}ctx.audioTimer+=dt;if(ctx.audioTimer>=.1){ctx.updateAudioWorld(ctx.audioTimer);ctx.audioTimer=0;}}
 if(frozen&&ctx.network)ctx.network.input={x:0,z:0,angle:ctx.angle};
 if(!ctx.backgrounded){if(frozen)ctx.accumulated+=dt;renderSharedWorld(dt,ctx.accumulated);ctx.renderRegionLabels();ctx.updateEffects(dt);ctx.environment.update(ctx.accumulated,dt,ctx.state.victory,ctx.camera,ctx.player.position);if(ctx.renderedMap==='overworld')ctx.landmarks?.update?.(ctx.accumulated);}
 const desired=ctx.player.position.clone().add(new T.Vector3(0,0,-3.4));ctx.cameraTarget.lerp(desired,1-Math.exp(-dt*4));ctx.camera.position.copy(ctx.cameraTarget).add(ctx.cameraOffset);ctx.shake=Math.max(0,ctx.shake-dt*.35);if(ctx.shake>0&&!frozen&&ctx.gameSettings.cameraShake){ctx.camera.position.x+=(Math.random()-.5)*ctx.shake;ctx.camera.position.z+=(Math.random()-.5)*ctx.shake;}ctx.camera.lookAt(ctx.cameraTarget);ctx.worldPreview?.update(ctx.camera);ctx.moonLight.position.set(ctx.player.position.x-16,29,ctx.player.position.z+9);ctx.moonLight.target.position.set(ctx.player.position.x,0,ctx.player.position.z);ctx.moonLight.target.updateMatrixWorld();ctx.updateMouseTarget();ctx.life.renderLabels(ctx.enemies.some(e=>!e.dead&&distance(e.model.position,ctx.player.position)<8&&!ctx.safeHere()),ctx.keys.has('alt'));ctx.updateFloaters(ctx.backgrounded?0:dt);ctx.uiTimer+=dt;if(ctx.uiTimer>.09){ctx.uiTimer=0;ctx.updateUI();ctx.drawMap();}ctx.multiplayerView?.update(dt,ctx.accumulated);ctx.renderer.render(ctx.scene,ctx.camera);ctx.resourceOrbs.update(frozen?0:dt,ctx.state.hp/ctx.state.maxHp,ctx.state.mana/ctx.state.maxMana);}
Object.assign(ctx,createInventoryUi(ctx),createModals(ctx));
const {inventoryPreviews,toggleMapForDeath}=ctx;
function connectionStatus(message,connected,{retryable=false,failed=false}={}){
 ctx.syncAudioState(connected);
 // A reconnect overlay must remain reachable while the main menu traps focus.
 if(ctx.mainMenuOpen){const wasInert=$('loading').inert;$('loading').inert=!connected;if(connected&&wasInert&&!ctx.rosterPicker?.open)$('menu-resume').focus();}
 const el=$('multiplayer-status');if(el.textContent!==message)el.textContent=message;el.hidden=!connected||ctx.sessionMode==='single-player';$('connection-back').hidden=!!ctx.lastSnapshot;$('connection-overlay').hidden=connected;if(!connected){inventoryPreviews.hide();$('connection-title').textContent=failed?'Unable to connect':ctx.lastSnapshot?'Reconnecting to game':'Loading game';$('connection-message').textContent=message;$('connection-spinner').hidden=failed;$('connection-retry').hidden=!retryable;if(ctx.modalKind==='inventory')updateInventoryResources($('modal-content').closest('.modal'),ctx.state,false);releaseInput();ctx.rosterPicker?.resolve({ok:false,reason:'Connection lost. Try again once connected.'});if(ctx.mainMenuOpen){const focusTarget=$(retryable?'connection-retry':'connection-title');focusTarget.tabIndex=retryable?0:-1;focusTarget.focus();}}}
$('connection-retry').onclick=()=>{if(ctx.lastSnapshot){location.reload();return;}returnToModeChoice();startSession('multiplayer');};
$('restart-yes').onclick=()=>ctx.network?.send('vote',{agree:true});
$('restart-no').onclick=()=>ctx.network?.send('vote',{agree:false});
function applySnapshot(snapshot,changed){
 const initialSnapshot=!ctx.lastSnapshot,wasDead=ctx.state.ended,oldLevel=ctx.state.level,beforeServices=JSON.stringify([ctx.state.gold,ctx.state.potions,ctx.state.forgeLevel,ctx.state.questAccepted,ctx.state.questRewarded,ctx.state.victory,ctx.state.bossLootClaimed,ctx.state.rookSupplies]),beforeInventory=JSON.stringify([ctx.state.inventory,ctx.state.equipped]);
 const nextMap=snapshot.mapId||snapshot.state.mapId||snapshot.players.find(p=>p.id===snapshot.you)?.mapId||'overworld',mapChanged=nextMap!==ctx.renderedMap;
 if(mapChanged)ctx.switchMap(nextMap);
 if(changed||mapChanged||initialSnapshot){ctx.classEffects.clear();for(const visual of ctx.networkZones.values())visual.dispose();ctx.networkZones.clear();releaseInput();ctx.network.pending=[];if(changed){ctx.victoryShown=false;ctx.lastNetworkEvent=0;clearTimeout(ctx.victoryTimer);}for(const effect of ctx.effects)ctx.removeObject(effect.mesh);ctx.effects.length=0;for(const floater of ctx.floaters)floater.element.remove();ctx.floaters.length=0;for(const e of ctx.enemies){ctx.cancelAttack(e);e.visuals.dispose();disposeActor(e.model);ctx.removeObject(e.bar);e.barTexture.dispose();}ctx.enemies.length=0;ctx.life.syncLoot([]);ctx.life.syncForage([]);for(const b of ctx.networkProjectiles.values())b.visual?b.visual.dispose():ctx.removeObject(b.mesh);ctx.networkProjectiles.clear();if(changed)ctx.toast(ctx.sessionMode==='single-player'?'A new vigil begins.':'A new vigil begins · The shared world has restarted.');else if(mapChanged)ctx.toast(mapFor(nextMap).name);}
 // Fresh server sessions omit the old class; clear it before merging so the
 // client cannot show Sorcerer skills while the server awaits a new choice.
 if(initialSnapshot)for(const key of Object.keys(ctx.state))delete ctx.state[key];
 Object.assign(ctx.state,{classId:undefined,appearanceId:undefined,baseHp:undefined},snapshot.state);ctx.lastSnapshot=snapshot;ctx.started=true;syncPlayerCharacter();
 // The first snapshot is a state baseline; retained server events predate this client.
 if(initialSnapshot){ctx.victoryShown=!!ctx.state.bossLootClaimed;ctx.lastNetworkEvent=Math.max(ctx.lastNetworkEvent,...snapshot.events.map(event=>event.id));}
 const me=snapshot.players.find(p=>p.id===snapshot.you);if(!me)return;
 ctx.exploration.setSession(snapshot.worldId,snapshot.you,{mode:ctx.sessionMode,preview:ctx.previewMode,journeyId:ctx.activeJourney?.id});
 if(changed&&ctx.sessionMode==='single-player')ctx.exploration.reset();
 ctx.exploration.reveal(mapFor(nextMap),me,ctx.environment.obstacles);
 ctx.environment.updateProgress?.(ctx.state);ctx.environment.updateObstacles?.(snapshot.brokenCover||[]);
 const target=predictedPosition(me,ctx.network.pending,snapshot.ack,ctx.environment.obstacles,ctx.worldBounds());
 // Only discontinuities snap. Walking and dodging reconcile on render frames.
 ctx.movementCorrection.reconcile(ctx.player.position,target,ctx.resetMovement||changed||mapChanged||wasDead&&!ctx.state.ended||ctx.backgrounded,me.dodge>0?4:1.5);ctx.player.rotation.z=ctx.state.ended?-1.5:0;
 if(mapChanged||initialSnapshot)ctx.cameraTarget.set(target.x,0,target.z-3.4);ctx.dodgeTime=me.dodge;if(me.dodge>0)ctx.angle=ctx.dodgeAngle=me.angle;ctx.selection.material.color.set(me.color);ctx.multiplayerView.sync(snapshot.players,snapshot.you,snapshot.time,changed||ctx.resetMovement);ctx.resetMovement=false;
 const enemyIds=new Set(snapshot.enemies.map(e=>e.id));for(let i=ctx.enemies.length-1;i>=0;i--)if(!enemyIds.has(ctx.enemies[i].id)){const e=ctx.enemies[i];ctx.cancelAttack(e);e.visuals.dispose();disposeActor(e.model);ctx.removeObject(e.bar);e.barTexture.dispose();ctx.enemies.splice(i,1);}
 for(const data of snapshot.enemies){let e=ctx.enemies.find(e=>e.id===data.id);if(!e)e=ctx.spawnEnemy(data.type,data.x,data.z,data.zone,data.id);const oldPhase=e.phase;if(e.dead&&data.hp>0){e.model.visible=true;e.model.position.set(data.x,0,data.z);e.model.rotation.z=0;e.barHealth=data.hp;}e.net=data;e.hp=data.hp;e.dead=data.hp<=0;e.phase=data.phase;e.timer=data.timer;e.maxHp=data.maxHp;e.angle=data.angle;
  if(e.dead||oldPhase!==data.phase||data.phase!=='windup'||!usesLegacyTelegraph(data.type)){ctx.cancelAttack(e);if(data.hp>0&&data.phase==='windup'&&usesLegacyTelegraph(data.type))e.telegraph=ctx.telegraph(e.data.attackStyle==='orb'&&!ctx.bossType(e.type)?data.aim:data,e.data.attackStyle==='orb'&&!ctx.bossType(e.type)?1.5:e.data.range,e.data.attackStyle==='orb'?Math.PI*2:1.9,data.attackAngle);}
  ctx.updateEnemyBar(e);
 }
 ctx.life.syncLoot(snapshot.loot);ctx.life.syncForage(snapshot.forage);ctx.environment.updateProgress?.(ctx.state);ctx.environment.sync?.(snapshot.interactions,ctx.state.discoveries);if(ctx.renderedMap==='overworld'){ctx.landmarks?.updateProgress?.(ctx.state);ctx.landmarks?.sync?.(snapshot.interactions,ctx.state.discoveries);}
 connectionStatus(`${snapshot.players.length} / 8 adventurers · ${classFor(ctx.state).name} ${me.slot+1}`,true);
 $('restart-vote').hidden=ctx.sessionMode==='single-player'||!snapshot.votes.length;$('restart-vote-text').textContent=`Restart the game? ${snapshot.votes.length} / ${snapshot.players.length} agree. All progress will reset.`;
 $('restart-yes').disabled=snapshot.votes.includes(snapshot.you);
 for(const event of snapshot.events)if(event.id>ctx.lastNetworkEvent){networkEvent(event);ctx.lastNetworkEvent=event.id;}
 if(ctx.state.level>oldLevel&&!changed){ctx.toast(`Oath strengthened · Level ${ctx.state.level}`);ctx.audio.play('levelup',.65);}if(ctx.state.ended&&!wasDead){dismissMainMenu();ctx.audio.play('death-player',.8);releaseInput();if(ctx.mapExpanded)toggleMapForDeath();ctx.showModal('death');}
 if(wasDead&&!ctx.state.ended||changed){dismissMainMenu();inventoryPreviews.hide();$('modal-shade').hidden=true;ctx.modalKind='';ctx.paused=false;toggleMapForDeath();ctx.syncAudioState();ctx.player.rotation.z=0;ctx.player.position.y=0;}
 if(ctx.mainMenuOpen&&!ctx.rosterPicker?.open)ctx.titleScreen.updateSession(mainMenuSession());
 if(!ctx.state.classId&&!ctx.rosterPicker?.open)openRoster();
 if(ctx.modalKind==='npc'&&beforeServices!==JSON.stringify([ctx.state.gold,ctx.state.potions,ctx.state.forgeLevel,ctx.state.questAccepted,ctx.state.questRewarded,ctx.state.victory,ctx.state.bossLootClaimed,ctx.state.rookSupplies]))ctx.renderNpc();if(ctx.modalKind==='inventory'&&beforeInventory!==JSON.stringify([ctx.state.inventory,ctx.state.equipped]))ctx.renderInventory();if(ctx.modalKind==='inventory')updateInventoryResources($('modal-content').closest('.modal'),ctx.state,ctx.network.connected);ctx.updateUI();
}
function networkEvent(event){
 if(event.type==='result'&&event.operation==='class'&&ctx.state.classId&&ctx.sessionMode==='single-player'&&!ctx.cavePreviewStarted&&new URLSearchParams(location.search).get('preview')==='enemies'){ctx.cavePreviewStarted=true;const generation=ctx.sessionGeneration;import('./enemy-preview.js').then(({createEnemyPreview})=>{if(generation===ctx.sessionGeneration)createEnemyPreview(ctx.network,()=>{releaseInput();ctx.resetMovement=true;});});}
 if(event.type==='result'&&event.operation==='class'){ctx.rosterPicker?.resolve(event);if(ctx.state.classId&&ctx.sessionMode==='single-player'&&!ctx.cavePreviewStarted&&['caves','exploration'].includes(new URLSearchParams(location.search).get('preview'))){ctx.cavePreviewStarted=true;const generation=ctx.sessionGeneration;import('./cave-preview.js').then(({createCavePreview})=>{if(generation===ctx.sessionGeneration)createCavePreview(ctx.network,()=>{releaseInput();ctx.resetMovement=true;});});}}
 if(ctx.backgrounded||event.mapId&&event.mapId!==ctx.renderedMap)return;
 const pos=new T.Vector3(event.x||0,0,event.z||0);
 if(event.type==='ability'){
  const actor=event.playerId===ctx.network.id?{model:ctx.player,rig:ctx.heroRig}:ctx.multiplayerView.actors.get(event.playerId);if(!actor)return;
  const local=event.playerId===ctx.network.id,rig=actor.rig;
  const skill=abilityForEvent(event),color=event.color||classColor(event),classVisual=ctx.classEffects.ability(event,skill,actor.model);
  if(skill?.kind==='melee'){rig.attack=.42;rig.attackKind=skill.hits===2?'paired':'attack';if(!classVisual)ctx.slash(pos,event.angle,color,skill.range,.3);audioAt('sword',pos,.6);}
  if(skill?.kind==='projectile'){
   rig.attack=.36;rig.attackKind='bolt';
   const hand=pos.clone().add(new T.Vector3(0,1.2,0)),direction=new T.Vector3(Math.sin(event.angle),0,Math.cos(event.angle));
   if(skill.projectile==='ember')ctx.combatEffects.cast(hand,direction);
   else if(skill.projectile==='arcane')ctx.combatEffects.arcaneCast(hand,direction);
   else if(!classVisual)ctx.particles(hand,color,9,1.8);
   audioAt(['arrow','knife'].includes(skill.projectile)?'sword':'ember',pos,.5);
  }
  if(skill?.kind==='support'){rig.attack=.42;rig.attackKind='support';audioAt('heal',pos,.5);}
  if(skill?.kind==='burst'||skill?.kind==='zone'){rig.attack=event.classId==='oathkeeper'?.42:.36;rig.attackKind=event.classId==='oathkeeper'?'support':'bolt';if(!classVisual){ctx.ringEffect(pos,color,.3,skill.radius||3,.65);ctx.particles(pos,color,24,3);}audioAt('nova',pos,.55);}
  if(skill?.kind==='shield'){if(!classVisual)ctx.ringEffect(pos,color,.8,1.2,skill.duration);audioAt('heal',pos,.6);}
  if(event.action==='heal'){if(!classVisual)ctx.ringEffect(pos,0x97cba5,.2,1.5,.7);audioAt('heal',pos,.6);}
  if(event.action==='dodge'){audioAt('dodge',pos,.5);if(local){ctx.moveTarget=null;ctx.movePath=[];ctx.lockedEnemy=null;}}
 }
 if(event.type==='hit'){
  ctx.floatText(String(event.damage),pos,event.magic?'magic':'');
  const impact=pos.clone().add(new T.Vector3(0,1,0));
  if(event.visual==='ember')ctx.combatEffects.emberImpact(impact);
  else if(event.visual==='arcane')ctx.combatEffects.arcaneImpact(impact);
  else if(!ctx.classEffects.impact(event)){
   if(event.magic)ctx.particles(impact,event.color||'#88cfdb',12,2.8);else ctx.steelImpact(impact);
  }
  audioAt(event.magic?'ember-hit':'impact',pos,.55);
 }
 if(event.type==='respawn'&&event.revivedBy){ctx.ringEffect(pos,0xffdf8b,.3,1.7,1);ctx.particles(pos,0xffe8aa,28,2);audioAt('heal',pos,.7);if(event.playerId===ctx.network.id)ctx.toast('Resurrected by Oathkeeper');}
 if(event.type==='hurt'){ctx.floatText(String(event.damage),pos,'enemy-damage');if(event.playerId===ctx.network.id){ctx.audio.play('hurt',.6);$('damage-vignette').style.opacity='.75';setTimeout(()=>$('damage-vignette').style.opacity='0',210);}}
 if(event.type==='kill'){audioAt(event.typeName==='boss'?'death-boss':event.typeName==='hound'?'death-hound':event.typeName==='revenant'?'death-revenant':'death',pos,.6);if(ctx.lockedEnemy?.id===event.enemyId){ctx.lockedEnemy=null;ctx.attackHeld=false;}if(ctx.bossType(event.typeName))ctx.toast(`${ENEMY_TYPES[event.typeName].name} falls · Claim your personal loot`);}
 if(event.type==='region-boss'){const boss=ctx.enemies.find(e=>e.id===event.enemyId);if(boss)ctx.toast(`${boss.data.name} has awakened.`);ctx.audio.play('boss-windup',.65);}
 if(event.type==='objective-ready')ctx.toast(event.message);
 if(event.type==='boss'){ctx.toast(`${ENEMY_TYPES[event.typeName]?.name||'The Bellkeeper'} has answered.`);ctx.audio.play('bell',.6);}
 if(event.type==='windup'){const e=ctx.enemies.find(e=>e.id===event.enemyId);if(e)audioAt(ctx.bossType(e.type)?'boss-windup':`voice-${ctx.enemyModelType(e.type)}`,e.model.position,.5);}
 if(event.type==='strike'){
  const e=ctx.enemies.find(e=>e.id===event.enemyId),data=ENEMY_TYPES[event.typeName];e?.visuals.strike();
  if(ctx.bossType(event.typeName)){ctx.ringEffect(pos,data.orbColor,.2,3.4,.5);audioAt('boss-slam',pos,.7);}
  else if(data.attackStyle==='knife'){ctx.slash(pos,event.angle,0xd3dfd8,data.range,.22);audioAt('sword',pos,.4);}
  else if(data.attackStyle==='bite'){const mouth=pos.clone().add(new T.Vector3(Math.sin(event.angle)*.8,.9,Math.cos(event.angle)*.8));ctx.particles(mouth,0xd9c7a4,6,1.3);audioAt('impact',pos,.45);}
  else {ctx.particles(pos.clone().add(new T.Vector3(0,1.4,0)),data.orbColor,12,2);audioAt('ember',pos,.45);}
 }
 if(event.type==='loot')ctx.lootCollected(event.drop,{collected:true});
 if(event.type==='result'){if(event.ok&&['forage','consume'].includes(event.operation))ctx.audio.play(event.operation==='forage'?'pickup':'heal',.55);if(event.message||event.reason)ctx.toast(event.message||event.reason);}
}
function renderSharedWorld(dt,t){ctx.renderHazards();ctx.classEffects.syncActors(ctx.lastSnapshot?.players||[],id=>id===ctx.network?.id?ctx.player:ctx.multiplayerView?.actors.get(id)?.model,ctx.renderedMap);
 for(const e of ctx.enemies){const n=e.net;if(!n)continue;const blend=1-Math.exp(-dt*14);e.model.position.x=T.MathUtils.lerp(e.model.position.x,n.x,blend);e.model.position.z=T.MathUtils.lerp(e.model.position.z,n.z,blend);e.model.rotation.y=angleLerp(e.model.rotation.y,n.angle,blend);
  if(e.dead){e.visuals.update(n,dt,t);e.model.rotation.z=T.MathUtils.lerp(e.model.rotation.z,1.45,dt*7);e.model.position.y=Math.max(-1,e.model.position.y-dt*.5);e.model.visible=e.model.position.y>-.9;e.bar.visible=false;continue;}
  if(e.barHealth>e.hp){e.barHealth=Math.max(e.hp,e.barHealth-dt*e.maxHp*1.6);ctx.updateEnemyBar(e);}ctx.animateRig(e.rig,t,n.moving,n.phase==='windup'?1-n.timer/e.data.windup:0,ctx.enemyModelType(e.type));e.visuals.update(n,dt,t+e.seed);e.bar.position.copy(e.model.position).add(new T.Vector3(0,(ctx.enemyModelType(e.type)==='boss'?4.8:ctx.enemyModelType(e.type)==='hound'?1.5:ctx.enemyModelType(e.type)==='hollow'?2.25:3.25)*(e.data.scale||1),0));e.bar.visible=e===ctx.mouseTargeting?.selected||distance(ctx.player.position,e.model.position)<12;
  if(e.telegraph){e.telegraph.children[0].material.opacity=.08+(1-n.timer/e.data.windup)*.26;}
 }
 const ids=new Set(ctx.lastSnapshot?.projectiles.map(b=>b.id)||[]);
 for(const [id,b] of ctx.networkProjectiles)if(!ids.has(id)){b.visual?b.visual.dispose():ctx.removeObject(b.mesh);ctx.networkProjectiles.delete(id);}
 for(const b of ctx.lastSnapshot?.projectiles||[]){let visual=ctx.networkProjectiles.get(b.id);if(!visual){
  const pos=new T.Vector3(b.x,b.hostile?.8:1.1,b.z),dir=new T.Vector3(Math.sin(b.angle),0,Math.cos(b.angle));
  if(!b.hostile){
   const bolt=b.visual==='arcane'?ctx.combatEffects.arcaneBolt(pos,dir,b.speed):b.visual&&b.visual!=='ember'?ctx.classEffects.projectile(b):ctx.combatEffects.emberbolt(pos,dir);
   visual={mesh:bolt.mesh,visual:bolt};
  }else{const bolt=createEnemyOrb(ctx.scene,ctx.overworldEnvironment.glowTexture,pos,b.angle,b.color||'#ff714b',{reducedMotion:ctx.reducedMotion});visual={mesh:bolt.mesh,visual:bolt};}
  ctx.networkProjectiles.set(b.id,visual);
 }
  const blend=1-Math.exp(-dt*20);visual.mesh.position.x=T.MathUtils.lerp(visual.mesh.position.x,b.x,blend);visual.mesh.position.z=T.MathUtils.lerp(visual.mesh.position.z,b.z,blend);visual.visual?.update(dt);
 }
 const zoneIds=new Set(ctx.lastSnapshot?.zones?.map(z=>z.id)||[]);
 for(const [id,visual] of ctx.networkZones)if(!zoneIds.has(id)){visual.dispose();ctx.networkZones.delete(id);}
 for(const data of ctx.lastSnapshot?.zones||[]){let visual=ctx.networkZones.get(data.id);if(!visual){visual=ctx.classEffects.zone(data);ctx.networkZones.set(data.id,visual);}visual.update(data,ctx.lastSnapshot.time,dt);}
 ctx.selection.position.set(ctx.player.position.x,.1,ctx.player.position.z);ctx.playerLight.position.copy(ctx.player.position).add(new T.Vector3(0,2.7,0));
}

// Assistive tools call the same movement, conversations, and combat paths as the visible controls.
window.hallowmere={getState:()=>({...ctx.state,cooldowns:{...ctx.state.cooldowns},ready:ctx.ready,paused:ctx.paused,backgrounded:ctx.backgrounded,mode:ctx.sessionMode,simulationPaused:!ctx.network?.connected||ctx.sessionMode==='single-player'&&(ctx.paused||ctx.backgrounded||!!ctx.rosterPicker?.open),multiplayer:{connected:ctx.sessionMode==='multiplayer'&&!!ctx.network?.connected,worldId:ctx.network?.worldId,players:ctx.lastSnapshot?.players||[],votes:ctx.lastSnapshot?.votes||[]},modal:ctx.modalKind,interior:ctx.player?ctx.environment.currentBuilding(ctx.player.position)?.id??null:null,buildings:ctx.environment?.buildings.map(b=>({id:b.id,name:b.name,chapel:b.chapel,locked:!b.doorCollider.disabled,inside:b.inside,door:{...b.door},entry:{...b.entry},exit:{...b.exit}})),dialogue:ctx.modalKind==='npc'?npcDialogue(ctx.state,ctx.currentNpc):null,objective:questSummary(ctx.state),mapId:ctx.renderedMap,bounds:ctx.worldBounds(),interactions:ctx.regionInteractions(),hazards:ctx.lastSnapshot?.hazards||[],audio:ctx.audio.getState(),targeting:{hoveredEnemy:ctx.mouseAction?.kind==='enemy'?ctx.mouseAction.target.id:null,lockedEnemy:ctx.lockedEnemy?.id??null,highlightedEnemy:ctx.mouseTargeting?.selected?.id??null},player:ctx.player?{x:ctx.player.position.x,z:ctx.player.position.z,moving:!!ctx.moveTarget,attacking:ctx.attackHeld}:null,...ctx.life?.getState(),enemies:ctx.enemies.filter(e=>!e.dead).map(e=>({id:e.id,type:e.type,zone:e.zone,hp:e.hp,x:e.model.position.x,z:e.model.position.z,phase:e.phase,lineOfSight:hasLineOfSight(ctx.player.position,e.model.position,ctx.environment.obstacles)})),drawCalls:ctx.renderer?.info.render.calls}),showControls:()=>ctx.showModal('help'),pause:()=>ctx.showModal('pause'),resume:ctx.closeModal};
const modelContext=document.modelContext;
if(modelContext?.registerTool){const lifecycle=new AbortController();const register=tool=>{try{Promise.resolve(modelContext.registerTool(tool,{signal:lifecycle.signal})).catch(error=>console.warn('Game tool registration unavailable',error));}catch(error){console.warn('Game tool registration unavailable',error);}};register({name:'get_vigil_state',title:'Read the vigil',description:'Read health, position, objectives, nearby villagers and dialogue choices, ground loot, available forage plants, the food pouch, active essence regeneration, owned equipment, enemies, and cooldowns.',inputSchema:{type:'object',properties:{},additionalProperties:false},annotations:{readOnlyHint:true,untrustedContentHint:false},execute(input){if(input&&Object.keys(input).length)throw Error('No input fields are accepted.');return window.hallowmere.getState();}});register({name:'control_warden',title:'Control the Warden',description:'Use normal game controls. Move to x,z; attack with optional hold (mouse hold), interact with a villager, loot, plant, or building id (walks closer or enters through its door), choose a displayed NPC service, open inventory, consume pouch food by id while Inventory is open, equip an owned item, use a spell, pause or resume. Costs, distance, collisions, cooldowns, and health apply.',inputSchema:{type:'object',properties:{action:{type:'string',enum:['move','attack','bolt','dodge','nova','heal','pause','resume','interact','service','inventory','equip','consume']},x:{type:'number',minimum:Math.min(...Object.values(MAPS).map(m=>m.bounds.minX)),maximum:Math.max(...Object.values(MAPS).map(m=>m.bounds.maxX))},z:{type:'number',minimum:Math.min(...Object.values(MAPS).map(m=>m.bounds.minZ)),maximum:Math.max(...Object.values(MAPS).map(m=>m.bounds.maxZ))},id:{type:'string'},choice:{type:'string'},hold:{type:'boolean'}},required:['action'],additionalProperties:false},annotations:{readOnlyHint:false,untrustedContentHint:false},execute(input){const valid=['move','attack','bolt','dodge','nova','heal','pause','resume','interact','service','inventory','equip','consume'];if(!input||!valid.includes(input.action)||Object.keys(input).some(k=>!['action','x','z','id','choice','hold'].includes(k)))throw Error('Invalid Warden action.');if(!ctx.ready)throw Error('The game is still loading.');if(input.x!==undefined&&(!Number.isFinite(input.x)||input.x<ctx.worldBounds().minX||input.x>ctx.worldBounds().maxX))throw Error('x is outside the world.');if(input.z!==undefined&&(!Number.isFinite(input.z)||input.z<ctx.worldBounds().minZ||input.z>ctx.worldBounds().maxZ))throw Error('z is outside the world.');if((input.x===undefined)!==(input.z===undefined))throw Error('Supply both x and z.');if(input.action==='move'&&input.x===undefined)throw Error('Movement requires x and z.');if(input.hold!==undefined&&typeof input.hold!=='boolean')throw Error('hold must be a boolean.');if(input.action==='pause'){ctx.showModal('pause');return{paused:ctx.paused};}if(input.action==='resume'){ctx.closeModal();return{paused:ctx.paused};}if(input.action==='service')return ctx.serviceNpc(input.choice);if(input.action==='equip')return ctx.equipOwnedItem(input.id);if(input.action==='consume')return ctx.consumePouchItem(input.id);if(ctx.paused||ctx.backgrounded||ctx.state.ended)throw Error('The vigil is paused, in the background, or ended.');awaken();if(input.action==='inventory'){ctx.showModal('inventory');return{opened:true};}if(input.action==='interact')return ctx.interact(input.id);if(input.x!==undefined){ctx.targetWorld.set(input.x,0,input.z);ctx.angle=Math.atan2(input.x-ctx.player.position.x,input.z-ctx.player.position.z);ctx.aimActive=true;}else ctx.aimActive=false;let performed;if(input.action==='move')performed=ctx.setDestination(new T.Vector3(input.x,0,input.z));else if(input.action==='attack'&&input.hold!==undefined){ctx.attackHeld=input.hold;ctx.lockedEnemy=ctx.attackHeld?(input.id?ctx.enemies.find(e=>e.id===input.id&&!e.dead):input.x!==undefined?ctx.enemyAtPoint(ctx.targetWorld):ctx.nearestEnemy(12)):null;ctx.moveTarget=null;ctx.movePath=[];if(ctx.lockedEnemy){ctx.aimActive=false;ctx.angle=Math.atan2(ctx.lockedEnemy.model.position.x-ctx.player.position.x,ctx.lockedEnemy.model.position.z-ctx.player.position.z);}performed=ctx.attackHeld?perform('attack'):true;}else performed=perform(input.action);ctx.updateUI();return{performed,health:ctx.state.hp,essence:Math.floor(ctx.state.mana),cooldown:ctx.state.cooldowns[input.action]??0};}});window.addEventListener('pagehide',()=>lifecycle.abort(),{once:true});}
// Begin the score during loading; retry blocked autoplay on any player gesture.
for(const event of ['pointerdown','click','keydown'])window.addEventListener(event,()=>{if(!ctx.audio.ready||ctx.audio.context?.state==='suspended'||ctx.audio.music?.blocked)awaken();},{capture:true});
awaken();
init();

window.addEventListener('pagehide',event=>{if(!event.persisted)ctx.worldPreview?.dispose();});
