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
import {createConnectionUi} from './connection-ui.js';
import {createSessionLifecycle} from './session-lifecycle.js';
import {createSnapshotApply} from './snapshot-apply.js';
import {createNetworkEvents} from './network-events.js';
import {createSharedWorldRender} from './shared-world-render.js';
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
// The whole mode-choice/journey/session/main-menu/roster region, wired where its import-time
// statements stood: it creates ctx.titleScreen/ctx.journeysMenu here, and registers its pagehide
// after bindExplorationSaving's and before bindInput's page-activity pair, the automation
// surface's abort, and the worldPreview dispose. bindInput below reads ctx.openRoster eagerly
// while it wires $('character-button').onclick, so this line has to stay above it.
Object.assign(ctx,createSessionLifecycle(ctx));
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
 ctx.rosterPicker=createRosterPicker({getState:()=>ctx.creatingJourney?{}:ctx.state,onChoose:ctx.chooseCharacter,onClose:ctx.closeRoster,onNavigate:navigateMenu});
 ctx.life.requestCollect=id=>!ctx.paused&&!ctx.backgrounded&&!ctx.state.ended&&ctx.network.send('collect',{id});ctx.life.requestForage=id=>!ctx.paused&&!ctx.backgrounded&&!ctx.state.ended&&ctx.network.send('forage',{id});
 ctx.clock=new T.Clock();ctx.assetsReady=true;ctx.updateUI();ctx.drawMap();ctx.titleScreen.setProgress(100);ctx.showModeChoice();ctx.renderer.setAnimationLoop(frame);
 }catch(error){loadingFailed=true;console.error(error);ctx.titleScreen.showError();}}
Object.assign(ctx,createHud(ctx),createGameAudio(ctx));
const {awaken}=ctx;

function resize(){if(!ctx.renderer)return;const w=innerWidth,h=innerHeight;ctx.renderer.setSize(w,h,false);const height=ctx.worldPreview||new URLSearchParams(location.search).get('preview')==='enemies'?19:w<650?28:29;ctx.camera.left=-height*(w/h)/2;ctx.camera.right=-ctx.camera.left;ctx.camera.top=height/2;ctx.camera.bottom=-height/2;ctx.camera.updateProjectionMatrix();}
window.addEventListener('resize',resize);
Object.assign(ctx,bindInput(ctx));
// The names main.js still calls itself stay module-scope bindings, so every remaining
// call site (and the vm slices that quote them) keeps the spelling it had before the move.
const {attacksFromHere,navigateMenu}=ctx;
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
function frame(){if(!ctx.ready)return;const raw=ctx.clock.getDelta(),dt=Math.min(raw,.035),frozen=ctx.paused||ctx.rosterPicker?.open||ctx.backgrounded||!ctx.network?.connected;ctx.network?.advance?.(raw,frozen);if(ctx.network?.connected&&!ctx.backgrounded&&(ctx.sessionMode==='multiplayer'||!frozen))ctx.movementCorrection.update(ctx.player.position,dt,ctx.environment.obstacles,ctx.worldBounds());if(!frozen){ctx.accumulated+=dt;for(const k in ctx.state.cooldowns)ctx.state.cooldowns[k]=Math.max(0,ctx.state.cooldowns[k]-dt);ctx.updatePlayer(dt,ctx.accumulated);if(!ctx.state.ended){ctx.life.update(ctx.accumulated);if(ctx.pendingRegionInteraction){const interaction=ctx.regionInteractions().find(r=>r.id===ctx.pendingRegionInteraction);if(!interaction)ctx.pendingRegionInteraction=null;else if(ctx.canReachRegion(interaction,2.7))ctx.interactRegion(interaction);}}const zone=ctx.renderedMap==='overworld'?zoneAt(ctx.player.position):ctx.renderedMap;if(zone!==ctx.state.zone){ctx.state.zone=zone;if(!ctx.state.visited.includes(zone))ctx.state.visited.push(zone);ctx.toast(zoneName(zone)+(zone==='ashwick'?' · Sanctuary':''));}ctx.audioTimer+=dt;if(ctx.audioTimer>=.1){ctx.updateAudioWorld(ctx.audioTimer);ctx.audioTimer=0;}}
 if(frozen&&ctx.network)ctx.network.input={x:0,z:0,angle:ctx.angle};
 if(!ctx.backgrounded){if(frozen)ctx.accumulated+=dt;ctx.renderSharedWorld(dt,ctx.accumulated);ctx.renderRegionLabels();ctx.updateEffects(dt);ctx.environment.update(ctx.accumulated,dt,ctx.state.victory,ctx.camera,ctx.player.position);if(ctx.renderedMap==='overworld')ctx.landmarks?.update?.(ctx.accumulated);}
 const desired=ctx.player.position.clone().add(new T.Vector3(0,0,-3.4));ctx.cameraTarget.lerp(desired,1-Math.exp(-dt*4));ctx.camera.position.copy(ctx.cameraTarget).add(ctx.cameraOffset);ctx.shake=Math.max(0,ctx.shake-dt*.35);if(ctx.shake>0&&!frozen&&ctx.gameSettings.cameraShake){ctx.camera.position.x+=(Math.random()-.5)*ctx.shake;ctx.camera.position.z+=(Math.random()-.5)*ctx.shake;}ctx.camera.lookAt(ctx.cameraTarget);ctx.worldPreview?.update(ctx.camera);ctx.moonLight.position.set(ctx.player.position.x-16,29,ctx.player.position.z+9);ctx.moonLight.target.position.set(ctx.player.position.x,0,ctx.player.position.z);ctx.moonLight.target.updateMatrixWorld();ctx.updateMouseTarget();ctx.life.renderLabels(ctx.enemies.some(e=>!e.dead&&distance(e.model.position,ctx.player.position)<8&&!ctx.safeHere()),ctx.keys.has('alt'));ctx.updateFloaters(ctx.backgrounded?0:dt);ctx.uiTimer+=dt;if(ctx.uiTimer>.09){ctx.uiTimer=0;ctx.updateUI();ctx.drawMap();}ctx.multiplayerView?.update(dt,ctx.accumulated);ctx.renderer.render(ctx.scene,ctx.camera);ctx.resourceOrbs.update(frozen?0:dt,ctx.state.hp/ctx.state.maxHp,ctx.state.mana/ctx.state.maxMana);}
Object.assign(ctx,createInventoryUi(ctx),createModals(ctx));
Object.assign(ctx,createConnectionUi(ctx));
// applySnapshot, networkEvent and renderSharedWorld are runtime-only -- none of them runs at
// import time -- so this line replaces the three declarations where they stood: after
// createConnectionUi, whose ctx.connectionStatus applySnapshot calls, and before the
// window.hallowmere automation surface. startSession reads ctx.applySnapshot lazily and
// frame() calls ctx.renderSharedWorld, so the wiring only has to land before init().
Object.assign(ctx,createSnapshotApply(ctx),createNetworkEvents(ctx),createSharedWorldRender(ctx));

// Assistive tools call the same movement, conversations, and combat paths as the visible controls.
window.hallowmere={getState:()=>({...ctx.state,cooldowns:{...ctx.state.cooldowns},ready:ctx.ready,paused:ctx.paused,backgrounded:ctx.backgrounded,mode:ctx.sessionMode,simulationPaused:!ctx.network?.connected||ctx.sessionMode==='single-player'&&(ctx.paused||ctx.backgrounded||!!ctx.rosterPicker?.open),multiplayer:{connected:ctx.sessionMode==='multiplayer'&&!!ctx.network?.connected,worldId:ctx.network?.worldId,players:ctx.lastSnapshot?.players||[],votes:ctx.lastSnapshot?.votes||[]},modal:ctx.modalKind,interior:ctx.player?ctx.environment.currentBuilding(ctx.player.position)?.id??null:null,buildings:ctx.environment?.buildings.map(b=>({id:b.id,name:b.name,chapel:b.chapel,locked:!b.doorCollider.disabled,inside:b.inside,door:{...b.door},entry:{...b.entry},exit:{...b.exit}})),dialogue:ctx.modalKind==='npc'?npcDialogue(ctx.state,ctx.currentNpc):null,objective:questSummary(ctx.state),mapId:ctx.renderedMap,bounds:ctx.worldBounds(),interactions:ctx.regionInteractions(),hazards:ctx.lastSnapshot?.hazards||[],audio:ctx.audio.getState(),targeting:{hoveredEnemy:ctx.mouseAction?.kind==='enemy'?ctx.mouseAction.target.id:null,lockedEnemy:ctx.lockedEnemy?.id??null,highlightedEnemy:ctx.mouseTargeting?.selected?.id??null},player:ctx.player?{x:ctx.player.position.x,z:ctx.player.position.z,moving:!!ctx.moveTarget,attacking:ctx.attackHeld}:null,...ctx.life?.getState(),enemies:ctx.enemies.filter(e=>!e.dead).map(e=>({id:e.id,type:e.type,zone:e.zone,hp:e.hp,x:e.model.position.x,z:e.model.position.z,phase:e.phase,lineOfSight:hasLineOfSight(ctx.player.position,e.model.position,ctx.environment.obstacles)})),drawCalls:ctx.renderer?.info.render.calls}),showControls:()=>ctx.showModal('help'),pause:()=>ctx.showModal('pause'),resume:ctx.closeModal};
const modelContext=document.modelContext;
if(modelContext?.registerTool){const lifecycle=new AbortController();const register=tool=>{try{Promise.resolve(modelContext.registerTool(tool,{signal:lifecycle.signal})).catch(error=>console.warn('Game tool registration unavailable',error));}catch(error){console.warn('Game tool registration unavailable',error);}};register({name:'get_vigil_state',title:'Read the vigil',description:'Read health, position, objectives, nearby villagers and dialogue choices, ground loot, available forage plants, the food pouch, active essence regeneration, owned equipment, enemies, and cooldowns.',inputSchema:{type:'object',properties:{},additionalProperties:false},annotations:{readOnlyHint:true,untrustedContentHint:false},execute(input){if(input&&Object.keys(input).length)throw Error('No input fields are accepted.');return window.hallowmere.getState();}});register({name:'control_warden',title:'Control the Warden',description:'Use normal game controls. Move to x,z; attack with optional hold (mouse hold), interact with a villager, loot, plant, or building id (walks closer or enters through its door), choose a displayed NPC service, open inventory, consume pouch food by id while Inventory is open, equip an owned item, use a spell, pause or resume. Costs, distance, collisions, cooldowns, and health apply.',inputSchema:{type:'object',properties:{action:{type:'string',enum:['move','attack','bolt','dodge','nova','heal','pause','resume','interact','service','inventory','equip','consume']},x:{type:'number',minimum:Math.min(...Object.values(MAPS).map(m=>m.bounds.minX)),maximum:Math.max(...Object.values(MAPS).map(m=>m.bounds.maxX))},z:{type:'number',minimum:Math.min(...Object.values(MAPS).map(m=>m.bounds.minZ)),maximum:Math.max(...Object.values(MAPS).map(m=>m.bounds.maxZ))},id:{type:'string'},choice:{type:'string'},hold:{type:'boolean'}},required:['action'],additionalProperties:false},annotations:{readOnlyHint:false,untrustedContentHint:false},execute(input){const valid=['move','attack','bolt','dodge','nova','heal','pause','resume','interact','service','inventory','equip','consume'];if(!input||!valid.includes(input.action)||Object.keys(input).some(k=>!['action','x','z','id','choice','hold'].includes(k)))throw Error('Invalid Warden action.');if(!ctx.ready)throw Error('The game is still loading.');if(input.x!==undefined&&(!Number.isFinite(input.x)||input.x<ctx.worldBounds().minX||input.x>ctx.worldBounds().maxX))throw Error('x is outside the world.');if(input.z!==undefined&&(!Number.isFinite(input.z)||input.z<ctx.worldBounds().minZ||input.z>ctx.worldBounds().maxZ))throw Error('z is outside the world.');if((input.x===undefined)!==(input.z===undefined))throw Error('Supply both x and z.');if(input.action==='move'&&input.x===undefined)throw Error('Movement requires x and z.');if(input.hold!==undefined&&typeof input.hold!=='boolean')throw Error('hold must be a boolean.');if(input.action==='pause'){ctx.showModal('pause');return{paused:ctx.paused};}if(input.action==='resume'){ctx.closeModal();return{paused:ctx.paused};}if(input.action==='service')return ctx.serviceNpc(input.choice);if(input.action==='equip')return ctx.equipOwnedItem(input.id);if(input.action==='consume')return ctx.consumePouchItem(input.id);if(ctx.paused||ctx.backgrounded||ctx.state.ended)throw Error('The vigil is paused, in the background, or ended.');awaken();if(input.action==='inventory'){ctx.showModal('inventory');return{opened:true};}if(input.action==='interact')return ctx.interact(input.id);if(input.x!==undefined){ctx.targetWorld.set(input.x,0,input.z);ctx.angle=Math.atan2(input.x-ctx.player.position.x,input.z-ctx.player.position.z);ctx.aimActive=true;}else ctx.aimActive=false;let performed;if(input.action==='move')performed=ctx.setDestination(new T.Vector3(input.x,0,input.z));else if(input.action==='attack'&&input.hold!==undefined){ctx.attackHeld=input.hold;ctx.lockedEnemy=ctx.attackHeld?(input.id?ctx.enemies.find(e=>e.id===input.id&&!e.dead):input.x!==undefined?ctx.enemyAtPoint(ctx.targetWorld):ctx.nearestEnemy(12)):null;ctx.moveTarget=null;ctx.movePath=[];if(ctx.lockedEnemy){ctx.aimActive=false;ctx.angle=Math.atan2(ctx.lockedEnemy.model.position.x-ctx.player.position.x,ctx.lockedEnemy.model.position.z-ctx.player.position.z);}performed=ctx.attackHeld?perform('attack'):true;}else performed=perform(input.action);ctx.updateUI();return{performed,health:ctx.state.hp,essence:Math.floor(ctx.state.mana),cooldown:ctx.state.cooldowns[input.action]??0};}});window.addEventListener('pagehide',()=>lifecycle.abort(),{once:true});}
// Begin the score during loading; retry blocked autoplay on any player gesture.
for(const event of ['pointerdown','click','keydown'])window.addEventListener(event,()=>{if(!ctx.audio.ready||ctx.audio.context?.state==='suspended'||ctx.audio.music?.blocked)awaken();},{capture:true});
awaken();
init();

window.addEventListener('pagehide',event=>{if(!event.persisted)ctx.worldPreview?.dispose();});
