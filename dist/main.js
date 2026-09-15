import {createEnemyVisuals,createEnemyOrb} from './enemy-visuals.js';
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
paintIcons(document);
const resourceOrbs=createResourceOrbs();
const exploration=new ExplorationAtlas();
bindExplorationSaving(exploration);
const gameSettings=readGameSettings(),audio=new AudioEngine();audio.musicEnabled=gameSettings.music;
const ctx=createGameContext({audio,gameSettings,exploration,resourceOrbs,journeyStore:new JourneyStore(),previewMode:['caves','exploration','predator','enemies'].includes(new URLSearchParams(location.search).get('preview')),reducedMotion:matchMedia('(prefers-reduced-motion: reduce)').matches,coarse:matchMedia('(pointer: coarse)').matches});
Object.assign(ctx,createModelCache(ctx));
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
 ctx.life=new VillageLife({scene:ctx.scene,camera:ctx.camera,player:ctx.player,state:ctx.state,cloneModel:ctx.cloneModel,reducedMotion:ctx.reducedMotion,obstacles:ctx.environment.obstacles,onTalk:talkTo,onCollect:lootCollected,onLootClick:collectClickedLoot,onApproach:point=>{awaken();return setDestination(point);}});
 ctx.mouseTargeting=createMouseTargeting({scene:ctx.scene,camera:ctx.camera,canvas:$('world'),enemies:ctx.enemies});
 ctx.multiplayerView=createMultiplayerView({scene:ctx.scene,camera:ctx.camera,cloneModel:ctx.cloneModel,getRig,animateRig,animateHeroAttack,player:ctx.player});
 ctx.rosterPicker=createRosterPicker({getState:()=>ctx.creatingJourney?{}:ctx.state,onChoose:chooseCharacter,onClose:closeRoster,onNavigate:navigateMenu});
 ctx.life.requestCollect=id=>!ctx.paused&&!ctx.backgrounded&&!ctx.state.ended&&ctx.network.send('collect',{id});ctx.life.requestForage=id=>!ctx.paused&&!ctx.backgrounded&&!ctx.state.ended&&ctx.network.send('forage',{id});
 ctx.clock=new T.Clock();ctx.assetsReady=true;updateUI();drawMap();ctx.titleScreen.setProgress(100);showModeChoice();ctx.renderer.setAnimationLoop(frame);
 }catch(error){loadingFailed=true;console.error(error);ctx.titleScreen.showError();}}
function setModeChoiceInert(inert){for(const child of $('game').children)if(child.id!=='loading')child.inert=inert;}
function syncAudioState(connected=!!ctx.network?.connected){const silent=!ctx.ready||!connected||ctx.paused||ctx.backgrounded||!!ctx.rosterPicker?.open;if(ctx.audio.paused!==silent||ctx.audio.backgrounded!==ctx.backgrounded)ctx.audio.pause(silent,ctx.backgrounded);}
setModeChoiceInert(true);
function showModeChoice(){
 setModeChoiceInert(true);
 ctx.ready=false;ctx.sessionMode=null;ctx.mainMenuOpen=false;syncAudioState();
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
 try{ctx.activeJourney=record;startSession('single-player',record.data);attachAutosave(record);if(record.recovered)toast('Journey recovered from its previous save.');}
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
async function saveAndExit(){
 if(!ctx.autosave||ctx.journeyLeaving||ctx.journeyConflict)return;
 ctx.journeyLeaving=true;ctx.paused=true;releaseInput();
 for(const button of document.querySelectorAll('[data-save-exit], [data-resume-game]'))button.disabled=true;
 try{const id=ctx.activeJourney.id;await ctx.autosave.exit();stopJourneySession();openJourneys(id);}
 catch(error){updateSaveStatus({kind:'error',message:error.message});}
 finally{ctx.journeyLeaving=false;for(const button of document.querySelectorAll('[data-save-exit], [data-resume-game]'))button.disabled=false;}
}
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
 ctx.paused=false;releaseInput();ctx.clock.getDelta();syncAudioState();$('world').focus({preventScroll:true});
}
function closeRoster(){
 releaseInput();
 if(ctx.creatingJourney){ctx.creatingJourney=false;openJourneys();return;}
 if(ctx.mainMenuOpen){ctx.paused=true;ctx.audio.pause(true,ctx.backgrounded);ctx.titleScreen.showMainMenu(mainMenuSession());return;}
 ctx.paused=false;syncAudioState();$('world').focus({preventScroll:true});
}
function dismissMainMenu(){
 if(!ctx.mainMenuOpen)return;
 ctx.mainMenuOpen=false;$('loading').inert=false;ctx.titleScreen.hide();setModeChoiceInert(false);
}
$('connection-back').onclick=returnToModeChoice;
window.addEventListener('pagehide',()=>{ctx.autosave?.emergency();ctx.autosave?.exit().catch(()=>{});ctx.network?.close();});
window.addEventListener('pageshow',event=>{if(event.persisted)location.reload();});
function spawnEnemy(type,x,z,zone='hallowmere',id=`enemy-${ctx.enemies.length}`){const data=ENEMY_TYPES[type],base=ctx.enemyModelType(type),name=base==='hound'?'grave-hound':base==='boss'?'bellkeeper':base;const model=ctx.cloneModel(name);if(data.modelType&&!data.tint){const tint=new T.Color(({hunter:'#a8baa2',rootling:'#7fa877',miner:'#bdaf93','quarry-mage':'#b99ad0',sentinel:'#c6a478',pyromancer:'#ea936d',rootbound:'#8eae78','quarry-warden':'#bfb1a0','ash-regent':'#edb085'})[type]||'#ffffff');model.traverse(o=>{if(o.material?.color)o.material.color.multiply(tint);});}const pickBounds=new T.Box3().setFromObject(model);model.position.set(x,0,z);model.rotation.y=Math.random()*6.28;ctx.scene.add(model);const e={id,zone,type,data,model,pickBounds,rig:getRig(model),hp:data.hp,maxHp:data.hp,phase:'idle',timer:0,cooldown:1+Math.random()*1.5,angle:0,attackAngle:0,aim:new T.Vector3(),flash:0,dead:false,home:{x,z},attackCount:0,seed:Math.random()*6.28,telegraph:null,path:[],navTimer:0,bar:null,barCanvas:null,barTexture:null,barHealth:data.hp,recoil:0};
 e.visuals=createEnemyVisuals(e,ctx.overworldEnvironment.glowTexture,{reducedMotion:ctx.reducedMotion});
 const c=document.createElement('canvas');c.width=256;c.height=48;const texture=new T.CanvasTexture(c);texture.colorSpace=T.SRGBColorSpace;const bar=new T.Sprite(new T.SpriteMaterial({map:texture,transparent:true,depthTest:false,depthWrite:false,toneMapped:false,fog:false}));bar.scale.set(ctx.bossType(type)?4:3.2,ctx.bossType(type)?.75:.6,1);bar.renderOrder=20;bar.visible=false;ctx.scene.add(bar);e.bar=bar;e.barCanvas=c;e.barTexture=texture;updateEnemyBar(e);ctx.enemies.push(e);return e;}
function updateEnemyBar(e){const c=e.barCanvas.getContext('2d');c.clearRect(0,0,256,48);c.font='500 20px Georgia';c.textAlign='left';c.fillStyle='#e0d3b0';c.shadowColor='#000';c.shadowBlur=5;c.fillText(e.data.name,4,20);c.textAlign='right';c.font='16px Arial';c.fillText(`${Math.max(0,e.hp)} / ${e.maxHp}`,252,20);c.shadowBlur=0;c.fillStyle='#091211';c.fillRect(0,27,256,20);c.fillStyle='#c6b58c';c.fillRect(3,30,250*Math.max(0,e.barHealth/e.maxHp),14);const red=c.createLinearGradient(0,30,0,44);red.addColorStop(0,'#ff293b');red.addColorStop(.45,'#981f25');red.addColorStop(1,'#660f1b');c.fillStyle=red;c.fillRect(3,30,250*Math.max(0,e.hp/e.maxHp),14);c.fillStyle='#ff5360';c.fillRect(3,30,250*Math.max(0,e.hp/e.maxHp),3);c.strokeStyle='#8d9275';c.lineWidth=1;c.strokeRect(.5,27.5,255,19);e.barTexture.needsUpdate=true;}

function resize(){if(!ctx.renderer)return;const w=innerWidth,h=innerHeight;ctx.renderer.setSize(w,h,false);const height=ctx.worldPreview||new URLSearchParams(location.search).get('preview')==='enemies'?19:w<650?28:29;ctx.camera.left=-height*(w/h)/2;ctx.camera.right=-ctx.camera.left;ctx.camera.top=height/2;ctx.camera.bottom=-height/2;ctx.camera.updateProjectionMatrix();}
window.addEventListener('resize',resize);
function awaken(){if(ctx.ready)ctx.started=true;syncAudioState();ctx.audio.unlock().then(()=>{if(!ctx.audio.ready)return;syncAudioState();$('audio-prompt').style.opacity='0';$('sound-button').setAttribute('aria-label',ctx.audio.muted?'Enable sound':'Mute sound');});}
function getPointerWorld(){ctx.camera.updateMatrixWorld();ctx.raycaster.setFromCamera(ctx.pointer,ctx.camera);ctx.raycaster.ray.intersectPlane(ctx.plane,ctx.targetWorld);}
function updatePointer(event){const rect=$('world').getBoundingClientRect();ctx.pointer.set((event.clientX-rect.left)/rect.width*2-1,-(event.clientY-rect.top)/rect.height*2+1);ctx.aimActive=true;ctx.mouseInWorld=true;ctx.pointerIsMouse=event.pointerType!=='touch';ctx.pointerShift=event.shiftKey;if(ctx.ready){getPointerWorld();updateMouseTarget();}}
function enemyAtPoint(point){let best=null,bestD=1.45;for(const e of ctx.enemies){if(e.dead)continue;const d=distance(e.model.position,point);if(d<bestD+(ctx.bossType(e.type)?.6:0)){bestD=d;best=e;}}return best;}
function pointerAction(){
 getPointerWorld();
 // Hover and click share interaction priority, so the preview never promises
 // an attack on a click that actually collects loot or opens a door.
 if(!ctx.pointerShift){
  const drop=ctx.life.pickLoot(ctx.raycaster);if(drop)return{kind:'loot',target:drop};
  const regional=regionInteractions().find(r=>!r.completed&&distance(r,ctx.targetWorld)<1.6);if(regional)return{kind:'region',target:regional};
  const door=ctx.environment.pickDoor(ctx.raycaster);if(door)return{kind:'door',target:door};
 }
 const npc=ctx.life.visibleNpcs().find(n=>distance(n.model.position,ctx.targetWorld)<1.1);if(npc)return{kind:'npc',target:npc};
 const enemy=ctx.mouseTargeting.pick(ctx.pointer,{assist:ctx.pointerIsMouse})||(!ctx.pointerIsMouse?enemyAtPoint(ctx.targetWorld):null);
 return enemy?{kind:'enemy',target:enemy}:null;
}
function updateMouseTarget(){
 if(ctx.lockedEnemy&&(ctx.lockedEnemy.dead||!ctx.enemies.includes(ctx.lockedEnemy))){ctx.lockedEnemy=null;ctx.attackHeld=false;ctx.movePath=[];}
 const active=ctx.ready&&!ctx.paused&&!ctx.backgrounded&&!ctx.state.ended&&!ctx.rosterPicker?.open&&ctx.network?.connected;
 ctx.mouseAction=active&&ctx.mouseInWorld?pointerAction():null;
 const held=active&&ctx.attackHeld&&ctx.lockedEnemy&&!ctx.lockedEnemy.dead&&ctx.enemies.includes(ctx.lockedEnemy)?ctx.lockedEnemy:null;
 ctx.mouseTargeting?.show(held||(ctx.pointerIsMouse&&ctx.mouseAction?.kind==='enemy'?ctx.mouseAction.target:null));
 $('world').classList.toggle('enemy-hover',!!ctx.mouseTargeting?.selected);
 $('world').classList.toggle('enemy-attacking',!!held);
 $('world').classList.toggle('loot-hover',ctx.mouseAction?.kind==='loot');
}
function setDestination(point){if(!ctx.network?.connected)return false;const path=findPath(ctx.player.position,point,ctx.environment.obstacles,ctx.worldBounds());if(!path.length){toast('That way is blocked.');return false;}if(ctx.life)ctx.life.pending=null;ctx.pendingRegionInteraction=null;ctx.movePath=path;const first=ctx.movePath.shift();ctx.moveTarget=new T.Vector3(first.x,0,first.z);ctx.lockedEnemy=null;ctx.attackHeld=false;groundPing(point);return true;}
function enterBuilding(b){if(!b.doorCollider.disabled){const reason='The chapel is sealed. Defeat the Bellkeeper to enter.';toast(reason);return{ok:false,reason};}const inside=ctx.environment.currentBuilding(ctx.player.position)?.id===b.id;awaken();const goal=inside?b.exit:b.entry;const ok=setDestination(new T.Vector3(goal.x,0,goal.z));return{ok,building:b.id,action:inside?'leave':'enter'};}
function nearbyInteraction(){const regional=regionInteractions().filter(r=>!r.completed&&distance(r,ctx.player.position)<2.8).sort((a,b)=>distance(a,ctx.player.position)-distance(b,ctx.player.position))[0];if(regional)return{regional};const target=ctx.life?.nearest(),building=ctx.environment?.nearestDoor(ctx.player.position);if(target&&(!building||distance(target.model.position,ctx.player.position)<distance(building.door,ctx.player.position)))return{target};return building?{building}:target?{target}:null;}
function interact(id){const regional=id?regionInteractions().find(r=>r.id===id):nearbyInteraction()?.regional;if(regional)return interactRegion(regional);const building=id?ctx.environment.buildings.find(b=>b.id===id):nearbyInteraction()?.building;if(building)return enterBuilding(building);return ctx.life.interact(id);}
function collectClickedLoot(id){
 if(!ctx.ready||ctx.paused||ctx.backgrounded||ctx.state.ended||!ctx.network?.connected)return{ok:false};
 awaken();releaseInput();ctx.life.pending=null;
 const result=ctx.life.interact(id);if(!result.ok)toast(result.reason);return result;
}
function regionInteractions(){return Object.entries(ctx.lastSnapshot?.interactions||{}).flatMap(([group,records])=>records.map(r=>({...r,operation:({portals:'travel',objectives:'objective',checkpoints:'checkpoint',caches:'cache'})[group]}))).filter(r=>r.operation&&(!r.hidden||r.discovered||ctx.state.discoveries?.includes(r.id)));}

function canReachRegion(r,radius=2.8){return distance(r,ctx.player.position)<=radius&&hasLineOfSight(ctx.player.position,r,ctx.environment.obstacles,.08)&&(!r.buildingId||ctx.environment.currentBuilding(ctx.player.position)?.id===r.buildingId);}
function interactRegion(r){if(r.locked)return{ok:false,reason:r.reason||(r.operation==='travel'?'This passage is sealed. Continue the region’s objectives.':'Defeat the nearby guardians first.')};if(r.completed)return{ok:false,reason:'Already completed.'};if(!canReachRegion(r)){if(setDestination(new T.Vector3(r.x,0,r.z))){ctx.pendingRegionInteraction=r.id;return{ok:true,approaching:r.name};}return{ok:false,reason:'That path is blocked.'};}ctx.pendingRegionInteraction=null;releaseInput();return{ok:ctx.network.send(r.operation,{id:r.id}),pending:true};}
function switchMap(mapId){clearTimeout(ctx.victoryTimer);ctx.pendingRegionInteraction=null;ctx.aimActive=false;ctx.dodgeTime=0;ctx.life.pending=null;for(const visual of ctx.networkZones.values())visual.dispose();ctx.networkZones.clear();for(const visual of ctx.networkHazards.values())removeObject(visual);ctx.networkHazards.clear();for(const label of ctx.regionLabels.values())label.remove();ctx.regionLabels.clear();if(ctx.renderedMap!=='overworld')ctx.environment.dispose();else for(const object of ctx.overworldObjects)object.userData.overworldVisible=object.visible;ctx.renderedMap=mapId;for(const object of ctx.overworldObjects)object.visible=mapId==='overworld'&&(object.userData.overworldVisible??true);ctx.environment=mapId==='overworld'?ctx.overworldEnvironment:createRegionEnvironment(ctx.scene,mapId);ctx.life.obstacles=ctx.environment.obstacles;for(const npc of ctx.life.npcs){npc.model.visible=npc.ring.visible=mapId==='overworld';npc.label.hidden=true;}ctx.cameraTarget.copy(ctx.player.position);const cave=mapFor(mapId).theme==='cave';ctx.hemisphereLight.intensity=cave?.95:1.3;ctx.moonLight.intensity=cave?1.45:2.35;ctx.rimLight.intensity=cave?.55:1.25;ctx.playerLight.intensity=cave?8:10;ctx.scene.fog.density=cave?.021:.017;ctx.scene.background.set((mapId==='underways'||mapFor(mapId).theme==='cave')?0x090d12:0x101c2b);ctx.scene.fog.color.set((mapId==='underways'||mapFor(mapId).theme==='cave')?0x101921:0x14283a);}
function renderRegionLabels(){
 const records=regionInteractions(),ids=new Set(records.map(r=>r.id));
 for(const[id,label]of ctx.regionLabels)if(!ids.has(id)){label.remove();ctx.regionLabels.delete(id);}
 for(const r of records){
  const cache=r.operation==='cache';let label=ctx.regionLabels.get(r.id);
  if(!label){
   label=document.createElement('button');label.type='button';label.className=cache?'world-label loot-label common cache-label':'world-label npc-label';
   if(cache)label.innerHTML='<span class="loot-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M3 11V8a5 5 0 0 1 5-5h8a5 5 0 0 1 5 5v3 M3 11h18v9H3Z M7 4v16 M17 4v16 M10 10h4v5h-4Z"/></svg></span><span class="loot-name"></span>';
   label.onclick=()=>{if(ctx.paused||ctx.backgrounded||ctx.state.ended)return;awaken();const result=interact(r.id);if(!result.ok)toast(result.reason);};
   $('world-labels').append(label);ctx.regionLabels.set(r.id,label);
  }
  (cache?label.querySelector('.loot-name'):label).textContent=regionActionName(r);
  if(cache)label.classList.toggle('in-reach',!r.locked&&!r.completed&&canReachRegion(r));
  const projected=new T.Vector3(r.x,2,r.z).project(ctx.camera);
  label.hidden=r.completed||distance(r,ctx.player.position)>11||projected.z>1||Math.abs(projected.x)>.94||Math.abs(projected.y)>.86;
  label.style.left=`${(projected.x*.5+.5)*innerWidth}px`;label.style.top=`${(-projected.y*.5+.5)*innerHeight}px`;
 }
}
function renderHazards(){const hazards=ctx.lastSnapshot?.hazards||[],ids=new Set(hazards.map(h=>h.id));for(const[id,visual]of ctx.networkHazards)if(!ids.has(id)){removeObject(visual);ctx.networkHazards.delete(id);}for(const h of hazards){let visual=ctx.networkHazards.get(h.id);if(!visual){visual=new T.Group();visual.position.set(h.x,.14,h.z);const geometry=h.radius?new T.CircleGeometry(h.radius,48):new T.PlaneGeometry(h.w,h.d);const fill=new T.Mesh(geometry,new T.MeshBasicMaterial({color:0xe88a46,transparent:true,opacity:.2,side:T.DoubleSide,depthWrite:false}));fill.rotation.x=-Math.PI/2;visual.add(fill);const edge=new T.LineSegments(new T.EdgesGeometry(geometry),new T.LineBasicMaterial({color:0xffbf7a,transparent:true,opacity:.9}));edge.rotation.x=-Math.PI/2;visual.add(edge);visual.rotation.y=h.angle||0;ctx.scene.add(visual);ctx.networkHazards.set(h.id,visual);}const active=ctx.lastSnapshot.time>=h.activateAt;visual.children[0].material.opacity=active?.58:.12+.2*Math.max(0,Math.min(1,(ctx.lastSnapshot.time-h.start)/Math.max(.1,h.activateAt-h.start)));visual.children[0].material.color.set(active?0xff4932:0xe88a46);}}

function nearestEnemy(range=9){let best=null,dist=range;for(const e of ctx.enemies){if(e.dead)continue;const d=distance(ctx.player.position,e.model.position);if(d<dist){best=e;dist=d;}}return best;}
$('world').addEventListener('pointermove',updatePointer);
$('world').addEventListener('pointerleave',()=>{ctx.mouseInWorld=false;updateMouseTarget();});
$('world').addEventListener('pointerdown',event=>{
 if(!ctx.ready||ctx.paused||ctx.backgrounded||ctx.state.ended||!ctx.network?.connected)return;
 event.preventDefault();$('world').focus({preventScroll:true});awaken();updatePointer(event);
 if(event.button===2){stopAttackMovement();perform('bolt');return;}if(event.button!==0)return;
 const action=ctx.mouseAction;
 if(action?.kind==='loot'){collectClickedLoot(action.target.id);return;}
 if(action?.kind==='region'){interactRegion(action.target);return;}
 if(action?.kind==='door'){enterBuilding(action.target);return;}
 if(action?.kind==='npc'){ctx.life.interact(action.target.id);return;}
 ctx.lockedEnemy=action?.kind==='enemy'?action.target:null;
 if(ctx.lockedEnemy){
  ctx.attackHeld=true;
  ctx.angle=Math.atan2(ctx.lockedEnemy.model.position.x-ctx.player.position.x,ctx.lockedEnemy.model.position.z-ctx.player.position.z);
  stopAttackMovement();
  if(attacksFromHere()||distance(ctx.player.position,ctx.lockedEnemy.model.position)<=abilitiesFor(ctx.state).attack.range)perform('attack');
 }else if(event.shiftKey||distance(ctx.player.position,ctx.targetWorld)<2.4){stopAttackMovement();ctx.attackHeld=true;perform('attack');}
 else setDestination(ctx.targetWorld);
 updateMouseTarget();
});
// Ranged attacks never turn into movement, even beyond projectile range or
// when a wall blocks the shot. Shift also keeps melee attacks in place.
function attacksFromHere(){return abilitiesFor(ctx.state).attack.kind==='projectile'||ctx.pointerShift;}
function stopAttackMovement(){
 ctx.moveTarget=null;ctx.movePath=[];ctx.life.pending=null;ctx.pendingRegionInteraction=null;
 ctx.networkDirection={x:0,z:0};ctx.network.input={x:0,z:0,angle:ctx.angle};ctx.network.send('input',ctx.network.input);
}
function releaseMouseAttack(){if(ctx.lockedEnemy)stopAttackMovement();ctx.attackHeld=false;ctx.lockedEnemy=null;updateMouseTarget();}
window.addEventListener('pointerup',event=>{if(event.button===0)releaseMouseAttack();});
window.addEventListener('pointercancel',()=>{ctx.mouseInWorld=false;releaseMouseAttack();});$('world').addEventListener('contextmenu',e=>e.preventDefault());
for(const type of ['keydown','keyup'])window.addEventListener(type,event=>{if(event.key==='Shift'){ctx.pointerShift=event.shiftKey;updateMouseTarget();}});
window.addEventListener('keydown',event=>{if(event.defaultPrevented||ctx.journeyLeaving||ctx.journeyConflict||!ctx.ready||!ctx.network?.connected||!$('loading').hidden)return;if(event.key!=='Escape'&&(event.target instanceof HTMLInputElement||event.target instanceof HTMLTextAreaElement||event.target instanceof HTMLSelectElement))return;const key=event.key.toLowerCase();if(ctx.rosterPicker?.open)return;if(key==='c'&&!event.repeat){openRoster();return;}if(event.target instanceof HTMLButtonElement&&[' ','enter'].includes(key))return;if([' ','arrowup','arrowdown','arrowleft','arrowright','tab'].includes(key)&&key!=='tab')event.preventDefault();if(event.repeat&&['escape','1','2','3','h','j','m','f','i'].includes(key))return;if(key==='escape'){if(ctx.mapExpanded)toggleMap();else if(ctx.paused)closeModal();else showModal('pause');return;}if(key==='h'){ctx.paused?closeModal():showModal('help');return;}if(key==='j'){ctx.paused?closeModal():showModal('journal');return;}if(key==='m'){toggleMap();return;}if(key==='i'){ctx.paused?closeModal():showModal('inventory');return;}if(!ctx.ready||ctx.paused||ctx.backgrounded||ctx.state.ended||!ctx.network?.connected)return;ctx.keys.add(key);if(['w','a','s','d','arrowup','arrowdown','arrowleft','arrowright','1','2','3'].includes(key))awaken();if(key==='1')perform('dodge');if(key==='2')perform('nova');if(key==='3')perform('heal');if(key==='f'){awaken();const result=interact();if(!result.ok)toast(result.reason);}});window.addEventListener('keyup',event=>ctx.keys.delete(event.key.toLowerCase()));
function releaseInput({resetTouch=true}={}){ctx.keys.clear();ctx.attackHeld=false;ctx.moveTarget=null;ctx.movePath=[];ctx.lockedEnemy=null;ctx.pendingRegionInteraction=null;ctx.mouseInWorld=false;ctx.pointerShift=false;ctx.mouseAction=null;ctx.mouseTargeting?.show(null);$('world').classList.remove('enemy-hover','enemy-attacking','loot-hover');if(ctx.network){ctx.network.input={x:0,z:0,angle:ctx.angle};ctx.network.send('input',ctx.network.input);}if(resetTouch)releaseJoystick();}
bindPageActivity({releaseInput,setBackgrounded:hidden=>{if(hidden){ctx.autosave?.emergency();ctx.autosave?.changed();ctx.autosave?.flush().catch(()=>{});}ctx.backgrounded=hidden;ctx.clock?.getDelta();ctx.network?.advance?.(0,true);syncAudioState();}});
document.querySelectorAll('[data-action]').forEach(button=>button.addEventListener('pointerdown',e=>{e.preventDefault();e.stopPropagation();if(ctx.paused||ctx.backgrounded||ctx.state.ended)return;awaken();if(ctx.coarse||!ctx.aimActive){const near=nearestEnemy();if(near)ctx.angle=Math.atan2(near.model.position.x-ctx.player.position.x,near.model.position.z-ctx.player.position.z);}perform(button.dataset.action);}));
document.querySelectorAll('[data-action]').forEach(button=>button.addEventListener('click',event=>{if(event.detail===0&&!ctx.paused&&!ctx.backgrounded){awaken();perform(button.dataset.action);}}));
$('sound-button').onclick=async()=>{const wasReady=ctx.audio.ready;await ctx.audio.unlock();if(!ctx.audio.ready){toast('Sound could not start. Try again.');return;}const muted=wasReady?ctx.audio.toggle():ctx.audio.muted;syncAudioState();$('sound-button').innerHTML=icon(muted?'muted':'volume');$('sound-button').setAttribute('aria-label',muted?'Enable sound':'Mute sound');$('audio-prompt').style.opacity='0';toast(muted?'Sound muted':'Sound enabled');};$('help-button').onclick=()=>showModal('help');$('journal-button').onclick=()=>showModal('journal');$('pause-button').onclick=()=>showModal('pause');$('map-button').onclick=toggleMap;$('inventory-button').onclick=()=>showModal('inventory');$('character-button').onclick=openRoster;$('interact-button').onclick=()=>{if(ctx.paused||ctx.backgrounded)return;awaken();const r=interact();if(!r.ok)toast(r.reason);};$('fullscreen-button').onclick=()=>{if(document.fullscreenElement)document.exitFullscreen?.();else $('game').requestFullscreen?.().catch(()=>toast('Fullscreen is unavailable in this view.'));};
function toggleMap(){
 if(!ctx.ready||ctx.state.ended||ctx.paused&&!ctx.mapExpanded)return;
 ctx.mapExpanded=!ctx.mapExpanded;ctx.audio.play(ctx.mapExpanded?'ui-open':'ui-close',.5);
 const panel=document.querySelector('.map-panel');panel.classList.toggle('expanded',ctx.mapExpanded);
 $('map-button').setAttribute('aria-label',ctx.mapExpanded?'Close map':'Expand map');
 if(ctx.mapExpanded){panel.setAttribute('role','dialog');panel.setAttribute('aria-modal','true');panel.setAttribute('aria-labelledby','map-title');updateMenuNavigation($('map-navigation'),'map',{canChangeCharacter:!ctx.activeJourney&&ctx.safeHere(),characterLocked:!!ctx.activeJourney});$('map-button').focus({preventScroll:true});}
 else{panel.removeAttribute('role');panel.removeAttribute('aria-modal');panel.removeAttribute('aria-labelledby');$('world').focus({preventScroll:true});}
 ctx.paused=ctx.mapExpanded;releaseInput();syncAudioState();drawMap();ctx.exploration.save();
}
function navigateMenu(kind){
 if(!ctx.ready||!ctx.network?.connected||ctx.state.ended)return;
 if(ctx.mainMenuOpen)resumeFromMainMenu();
 if(kind==='character'){openRoster();return;}
 if(ctx.mapExpanded)toggleMap();
 if(kind==='map'){if(ctx.modalKind)closeModal();toggleMap();return;}
 ctx.currentNpc=null;showModal(kind);
}
for(const id of ['modal-navigation','map-navigation']){
 $(id).innerHTML=menuNavigationMarkup();
 $(id).addEventListener('click',event=>{const button=event.target.closest('[data-menu]');if(button&&!button.disabled)navigateMenu(button.dataset.menu);});
}
document.querySelector('.map-panel').addEventListener('keydown',event=>{
 if(!ctx.mapExpanded||event.key!=='Tab')return;
 const buttons=[...document.querySelectorAll('.map-panel button:not(:disabled)')].filter(el=>el.getClientRects().length),first=buttons[0],last=buttons.at(-1);
 if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus();}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}
});
const joystick=$('joystick');joystick.addEventListener('pointerdown',event=>{if(ctx.paused||ctx.backgrounded||!ctx.ready||!ctx.network?.connected||ctx.joystickPointer!==null)return;event.preventDefault();ctx.joystickPointer=event.pointerId;joystick.setPointerCapture(event.pointerId);awaken();updateJoystick(event);});joystick.addEventListener('pointermove',event=>{if(event.pointerId===ctx.joystickPointer)updateJoystick(event);});function releaseJoystick(){const pointerId=ctx.joystickPointer;ctx.joystickPointer=null;ctx.joystickValue={x:0,y:0};$('joystick-thumb').style.transform='';const stick=$('joystick');if(pointerId!==null&&stick.hasPointerCapture(pointerId))stick.releasePointerCapture(pointerId);}for(const type of ['pointerup','pointercancel','lostpointercapture'])joystick.addEventListener(type,event=>{if(event.pointerId===ctx.joystickPointer)releaseJoystick();});function updateJoystick(event){const r=joystick.getBoundingClientRect(),x=event.clientX-r.left-r.width/2,y=event.clientY-r.top-r.height/2,length=Math.hypot(x,y),scale=Math.min(34,length)/Math.max(1,length);ctx.joystickValue={x:x*scale/34,y:y*scale/34};$('joystick-thumb').style.transform=`translate(${x*scale}px,${y*scale}px)`;}
function toast(message){$('toast').textContent=message;$('toast').classList.add('visible');clearTimeout(ctx.toastTimer);ctx.toastTimer=setTimeout(()=>$('toast').classList.remove('visible'),2500);}
function perform(action){
 if(!ctx.ready||ctx.paused||ctx.rosterPicker?.open||ctx.backgrounded||ctx.state.ended||!ctx.network?.connected||!canUse(ctx.state,action))return false;
 const skill=abilitiesFor(ctx.state)[action],offensive=action!=='dodge'&&action!=='heal'&&skill.kind!=='support';
 const targetEnemy=offensive?(ctx.attackHeld&&ctx.lockedEnemy&&!ctx.lockedEnemy.dead?ctx.lockedEnemy:ctx.mouseTargeting?.selected):null;
 let aimPoint=ctx.aimActive?ctx.targetWorld:null;
 if(targetEnemy&&!targetEnemy.dead){aimPoint=targetEnemy.model.position;ctx.angle=Math.atan2(aimPoint.x-ctx.player.position.x,aimPoint.z-ctx.player.position.z);}
 else if(!ctx.aimActive&&action!=='dodge'){const target=nearestEnemy(Math.max(7,skill.range||0));if(target)ctx.angle=Math.atan2(target.model.position.x-ctx.player.position.x,target.model.position.z-ctx.player.position.z);}
 else if(ctx.aimActive&&action!=='dodge')ctx.angle=Math.atan2(ctx.targetWorld.x-ctx.player.position.x,ctx.targetWorld.z-ctx.player.position.z);
 if(!ctx.network.send('ability',{action,angle:ctx.angle,...(aimPoint?{target:{x:aimPoint.x,z:aimPoint.z}}:{})}))return false;
 // Local cooldown is a UI hint; only the server spends resources or applies damage.
 ctx.state.cooldowns[action]=abilitiesFor(ctx.state)[action].cooldown;
 const button=document.querySelector(`[data-action="${action}"]`);button?.classList.add('active');setTimeout(()=>button?.classList.remove('active'),130);return true;
}
function moveEntity(model,dx,dz,radius=.42){if(model===ctx.player){const length=Math.hypot(dx,dz);if(length>0)ctx.networkDirection={x:dx/length,z:dz/length,...(ctx.moveTarget?{stopAt:{x:ctx.moveTarget.x,z:ctx.moveTarget.z}}:{})};}const p=resolveMove(model.position,dx,dz,ctx.environment.obstacles,radius,ctx.worldBounds());const moved=Math.hypot(p.x-model.position.x,p.z-model.position.z);model.position.x=p.x;model.position.z=p.z;return moved;}
function groundPing(pos){ringEffect(pos,0xc0c2a1,.25,.65,.45);}
function ringEffect(pos,color,from,to,life){const mesh=new T.Mesh(new T.RingGeometry(.89,1,64),new T.MeshBasicMaterial({color,transparent:true,opacity:.8,depthWrite:false,side:T.DoubleSide,blending:T.AdditiveBlending}));mesh.rotation.x=-Math.PI/2;mesh.position.set(pos.x,.13,pos.z);ctx.scene.add(mesh);ctx.effects.push({type:'ring',mesh,time:0,life,from,to});}
function slash(pos,a,color,radius,life){const mesh=new T.Mesh(new T.RingGeometry(radius*.965,radius,48,1,-Math.PI/2-.72,1.44),new T.MeshBasicMaterial({color,transparent:true,opacity:.48,depthWrite:false,side:T.DoubleSide,blending:T.AdditiveBlending}));mesh.rotation.set(-Math.PI/2,0,a-.2);mesh.position.copy(pos).add(new T.Vector3(0,.85,0));ctx.scene.add(mesh);ctx.effects.push({type:'slash',mesh,time:0,life,angle:a});}
function steelImpact(pos){ctx.combatEffects.steelImpact(pos);}
function particles(pos,color,count,speed){const values=new Float32Array(count*3),velocity=new Float32Array(count*3);for(let i=0;i<count;i++){velocity[i*3]=(Math.random()-.5)*speed*2;velocity[i*3+1]=Math.random()*speed+1;velocity[i*3+2]=(Math.random()-.5)*speed*2;}const g=new T.BufferGeometry();g.setAttribute('position',new T.BufferAttribute(values,3));const mesh=new T.Points(g,new T.PointsMaterial({color,size:.065,transparent:true,opacity:.9,depthWrite:false,blending:T.AdditiveBlending}));mesh.position.copy(pos);ctx.scene.add(mesh);ctx.effects.push({type:'particles',mesh,velocity,time:0,life:.75});}
function telegraph(pos,radius,arc=Math.PI*2,a=0){const group=new T.Group();group.position.set(pos.x,.1,pos.z);const mat=new T.MeshBasicMaterial({color:0xe76042,transparent:true,opacity:.15,side:T.DoubleSide,depthWrite:false});const fill=new T.Mesh(new T.CircleGeometry(radius,48,-Math.PI/2-arc/2,arc),mat);fill.rotation.set(-Math.PI/2,0,a);group.add(fill);const edge=new T.Mesh(new T.RingGeometry(radius-.055,radius,48,1,-Math.PI/2-arc/2,arc),new T.MeshBasicMaterial({color:0xf59766,transparent:true,opacity:.48,depthWrite:false,side:T.DoubleSide}));edge.rotation.set(-Math.PI/2,0,a);group.add(edge);ctx.scene.add(group);return group;}
function removeObject(object){ctx.scene.remove(object);object.traverse(o=>{if(o.geometry&&!o.isSprite)o.geometry.dispose();if(o.material){if(Array.isArray(o.material))o.material.forEach(m=>m.dispose());else o.material.dispose();}});}
function cancelAttack(e,stun=0){if(e.telegraph){removeObject(e.telegraph);e.telegraph=null;}if(stun&&!e.dead){e.phase='recover';e.timer=stun;e.cooldown=.8;}}
function animateRig(rig,t,moving,windup=0,type='warden'){const speed=type==='hound'?13:9;for(let i=0;i<rig.legs.length;i++){const leg=rig.legs[i];const sign=leg.name.includes('L')?-1:1;const back=leg.name.includes('Back')?-1:1;leg.rotation.x=moving?Math.sin(t*speed)*.55*sign*back:Math.sin(t*1.7)*.025;}if(rig.body){rig.body.rotation.z=Math.sin(t*2.1)*.016;rig.body.rotation.x=windup*-.22;rig.body.position.y=(rig.baseY??1.18)+(moving?Math.abs(Math.sin(t*speed))*.035:0);}for(let i=0;i<rig.arms.length;i++){rig.arms[i].rotation.x=windup*-1.3+(moving?Math.sin(t*speed)*(i%2?-.2:.2):Math.sin(t*1.8+i)*.04);}}
function updatePlayer(dt,t){ctx.networkDirection={x:0,z:0};if(ctx.state.ended){ctx.player.rotation.z=T.MathUtils.lerp(ctx.player.rotation.z,-1.5,dt*3);return;}let moving=false;const horiz=(ctx.keys.has('d')||ctx.keys.has('arrowright')?1:0)-(ctx.keys.has('a')||ctx.keys.has('arrowleft')?1:0)+ctx.joystickValue.x,vert=(ctx.keys.has('s')||ctx.keys.has('arrowdown')?1:0)-(ctx.keys.has('w')||ctx.keys.has('arrowup')?1:0)+ctx.joystickValue.y;let dx=.837*horiz+.547*vert,dz=-.547*horiz+.837*vert;
 if(ctx.dodgeTime>0){ctx.angle=ctx.dodgeAngle;const next=predictDodge(ctx.player.position,ctx.angle,ctx.dodgeTime,dt,ctx.environment.obstacles,ctx.worldBounds());ctx.player.position.x=next.x;ctx.player.position.z=next.z;ctx.dodgeTime=next.remaining;moving=true;ctx.player.position.y=ctx.state.classId==='oathkeeper'?Math.sin(Math.min(1,ctx.dodgeTime/.12)*Math.PI*.5)*.2:Math.sin(ctx.dodgeTime/.27*Math.PI)*.24;}
 else{ctx.player.position.y=0;if(Math.hypot(dx,dz)>.05){ctx.moveTarget=null;ctx.movePath=[];ctx.lockedEnemy=null;ctx.life.pending=null;ctx.pendingRegionInteraction=null;}else if(ctx.lockedEnemy&&!ctx.lockedEnemy.dead&&ctx.attackHeld){const p=ctx.lockedEnemy.model.position;ctx.angle=Math.atan2(p.x-ctx.player.position.x,p.z-ctx.player.position.z);if(!attacksFromHere()&&(distance(ctx.player.position,p)>abilitiesFor(ctx.state).attack.range||!hasLineOfSight(ctx.player.position,p,ctx.environment.obstacles,.42))){let seek=p;if(!hasLineOfSight(ctx.player.position,p,ctx.environment.obstacles,.42)){if(!ctx.movePath.length)ctx.movePath=findPath(ctx.player.position,p,ctx.environment.obstacles,ctx.worldBounds());while(ctx.movePath.length&&distance(ctx.player.position,ctx.movePath[0])<.3)ctx.movePath.shift();if(ctx.movePath.length)seek=ctx.movePath[0];}dx=seek.x-ctx.player.position.x;dz=seek.z-ctx.player.position.z;}else perform('attack');}else if(ctx.moveTarget){dx=ctx.moveTarget.x-ctx.player.position.x;dz=ctx.moveTarget.z-ctx.player.position.z;if(Math.hypot(dx,dz)<.1){const next=ctx.movePath.shift();ctx.moveTarget=next?new T.Vector3(next.x,0,next.z):null;dx=dz=0;}}if(Math.hypot(dx,dz)>.05){const length=Math.hypot(dx,dz);dx/=length;dz/=length;ctx.lastMove.set(dx,0,dz);const speed=ctx.lastSnapshot?.players.find(p=>p.id===ctx.network.id)?.speed??classFor(ctx.state).speed,travel=ctx.moveTarget?Math.min(length,speed*dt):speed*dt;moving=moveEntity(ctx.player,dx*travel,dz*travel)>.001;if(!ctx.attackHeld)ctx.angle=Math.atan2(dx,dz);}else if(ctx.aimActive&&!(ctx.attackHeld&&ctx.lockedEnemy)){getPointerWorld();const aim=ctx.mouseTargeting?.selected?.model.position||ctx.targetWorld;ctx.angle=Math.atan2(aim.x-ctx.player.position.x,aim.z-ctx.player.position.z);}if(ctx.attackHeld&&!ctx.lockedEnemy)perform('attack');}
 ctx.network.input={...ctx.networkDirection,angle:ctx.angle};ctx.player.rotation.y=ctx.angle;animateRig(ctx.heroRig,t,moving);animateHeroAttack(ctx.heroRig,dt);if(moving&&t-ctx.lastStep>.29&&!(ctx.state.classId==='oathkeeper'&&(ctx.state.valkyrieTime>0||ctx.dodgeTime>0))){ctx.audio.play(footstepCue(),.48);ctx.lastStep=t;}ctx.selection.position.set(ctx.player.position.x,.1,ctx.player.position.z);ctx.selection.material.opacity=ctx.dodgeTime>0?.2:.55;ctx.playerLight.position.copy(ctx.player.position).add(new T.Vector3(0,2.7,0));}
function updateEffects(dt){
 for(let i=ctx.effects.length-1;i>=0;i--){const e=ctx.effects[i];e.time+=dt;const p=e.time/e.life;if(p>=1){removeObject(e.mesh);ctx.effects.splice(i,1);continue;}e.mesh.material.opacity=(1-p)*.85;if(e.type==='ring'){const r=T.MathUtils.lerp(e.from,e.to,1-(1-p)*(1-p));e.mesh.scale.setScalar(r);}if(e.type==='slash'){e.mesh.rotation.z=e.angle-.35+p*.9;e.mesh.scale.setScalar(.8+p*.3);}if(e.type==='sparks'){const data=e.mesh.geometry.attributes.position.array;for(let j=0;j<data.length;j+=6){const v=j/2;for(let axis=0;axis<3;axis++){data[j+axis]+=e.velocity[v+axis]*dt;data[j+3+axis]=data[j+axis]-e.velocity[v+axis]*.022;}e.velocity[v+1]-=dt*9;}e.mesh.geometry.attributes.position.needsUpdate=true;}if(e.type==='particles'){const data=e.mesh.geometry.attributes.position.array;for(let j=0;j<data.length;j+=3){data[j]+=e.velocity[j]*dt;data[j+1]+=e.velocity[j+1]*dt;data[j+2]+=e.velocity[j+2]*dt;e.velocity[j+1]-=dt*6;}e.mesh.geometry.attributes.position.needsUpdate=true;}}
 ctx.classEffects.update(dt);ctx.combatEffects.update(dt,[...ctx.classEffects.lightSources(),...ctx.enemies.filter(e=>e.visuals.light.intensity&&distance(e.model.position,ctx.player.position)<20).map(e=>e.visuals.light),...[...ctx.networkProjectiles.values()].filter(b=>b.visual?.light?.position).map(b=>b.visual.light)]);ctx.spellLight.intensity=Math.max(0,ctx.spellLight.intensity-dt*160);}
function floatText(text,pos,kind=''){const element=document.createElement('div');element.className=`damage-number ${kind}`;element.textContent=text;$('float-layer').append(element);ctx.floaters.push({element,pos:new T.Vector3(pos.x,1.9,pos.z),time:0,life:kind==='small'?1.4:.85,offset:(Math.random()-.5)*20});}
function updateFloaters(dt){for(let i=ctx.floaters.length-1;i>=0;i--){const f=ctx.floaters[i];f.time+=dt;if(f.time>=f.life){f.element.remove();ctx.floaters.splice(i,1);continue;}const projected=f.pos.clone().project(ctx.camera);const x=(projected.x*.5+.5)*innerWidth,y=(-projected.y*.5+.5)*innerHeight;f.element.style.transform=`translate(${x+f.offset}px,${y-f.time*55}px) translate(-50%,-50%)`;f.element.style.opacity=String(Math.min(1,(f.life-f.time)*3));}}
function updateClassHud(){
 const c=classFor(ctx.state),key=conceptFor(ctx.state.classId,ctx.state.appearanceId)+'|'+!!ctx.activeJourney;if(ctx.hudClass===key)return;ctx.hudClass=key;
 $('character-name').textContent=c.name;$('class-caption').textContent=c.name.toUpperCase();
 $('character-button').disabled=!!ctx.activeJourney;$('character-button').title=ctx.activeJourney?'This journey keeps its chosen character.':'Change character (C)';
 $('world').setAttribute('aria-label','Village play area. Use W A S D to move, mouse to aim and attack, F to speak or collect loot, I for equipment, '+(ctx.activeJourney?'':'C to choose a class at a sanctuary, ')+'2 for your class skill, 1 to dodge, and 3 to heal.');
 for(const [action,skill] of Object.entries(c.abilities)){const button=document.querySelector(`[data-action="${action}"]`);button.querySelector('.ability-name').textContent=skill.name;button.title=`${skill.name} · ${skill.cost} essence · ${skill.cooldown}s cooldown. ${skill.description}`;button.setAttribute('aria-label',button.title);const index=['attack','bolt','dodge','nova'].indexOf(action);if(index>=0&&classIconNames[c.id]){const mark=button.querySelector('.ability-icon');mark.innerHTML=icon(classIconNames[c.id][index]);mark.style.color=skill.color||classColor(ctx.state);}}
}
function syncPlayerCharacter(){
 if(ctx.state.classId&&!ctx.portraitsRequested){ctx.portraitsRequested=true;prepareCharacterPortraits().then(()=>{if(ctx.modalKind==='inventory')renderInventory();}).catch(error=>console.error('Character portraits unavailable',error));}
 const key=conceptFor(ctx.state.classId,ctx.state.appearanceId);if(ctx.player.userData.characterKey===key)return;
 for(const child of [...ctx.player.children])disposeActor(child);ctx.player.add(ctx.cloneModel(key));ctx.player.userData.characterKey=key;ctx.heroRig=getRig(ctx.player);
}
function openRoster(){
 if(ctx.activeJourney){toast('This journey keeps its chosen character. Start a new journey to choose another.');return;}
 if(!ctx.ready||!ctx.network?.connected||!ctx.rosterPicker||ctx.rosterPicker.open||ctx.state.ended)return;
 if(!ctx.safeHere()){if(ctx.mainMenuOpen)ctx.titleScreen.updateSession(mainMenuSession());else toast('Return to a sanctuary to change class.');return;}
 if(ctx.mainMenuOpen)ctx.titleScreen.hide();
 if(ctx.mapExpanded)toggleMap();inventoryPreviews.hide();$('modal-shade').hidden=true;ctx.modalKind='';ctx.currentNpc=null;ctx.paused=true;releaseInput();ctx.audio.pause(true,ctx.backgrounded);ctx.rosterPicker.show();
}
function updateUI(){if(!ctx.player)return;updateClassHud();$('health-liquid').style.height=`${ctx.state.hp/ctx.state.maxHp*100}%`;$('mana-liquid').style.height=`${ctx.state.mana/ctx.state.maxMana*100}%`;$('potion-count').textContent=ctx.state.potions;$('souls-counter').textContent=`${ctx.state.souls} SOULS`;$('experience-fill').style.width=`${ctx.state.souls%100}%`;$('level-label').textContent=`${classAppearance(ctx.state.classId,ctx.state.appearanceId)?.name||classFor(ctx.state).name} · LEVEL ${ctx.state.level}`;document.querySelector('.rank').textContent=String(ctx.state.level).padStart(2,'0');
 for(const[name,data]of Object.entries(abilitiesFor(ctx.state))){const button=document.querySelector(`[data-action="${name}"]`);const cd=ctx.state.cooldowns[name];button.classList.toggle('on-cooldown',cd>.12&&name!=='attack');button.querySelector('.cooldown').textContent=cd>=1?Math.ceil(cd):cd.toFixed(1);button.classList.toggle('unavailable',ctx.state.mana<data.cost||name==='heal'&&!ctx.state.potions);}
 const quest=questSummary(ctx.state);$('quest-kind').lastChild.textContent=mapFor(ctx.renderedMap).theme==='cave'?' SIDE CAVE':' MAIN QUEST';if(ctx.renderedMap==='overworld'&&ctx.state.questCompleted&&!ctx.state.questRewarded){quest.objective='Quest complete · Claim your reward from Rowan';quest.hint=ctx.sessionMode==='single-player'?'You completed The Last Toll. Your reward awaits in Ashwick.':'Your allies completed The Last Toll. Your reward awaits in Ashwick.';}$('quest-title').textContent=quest.title;$('quest-count').textContent=quest.count;$('objective').textContent=quest.objective;$('quest-hint').textContent=quest.hint;$('quest-marker').classList.toggle('done',ctx.state.questRewarded);$('gold-counter').textContent=`${ctx.state.gold} CROWNS`;$('location-name').textContent=ctx.environment.currentBuilding(ctx.player.position)?.name||(ctx.renderedMap==='overworld'?zoneName(ctx.state.zone):mapFor(ctx.renderedMap).name);$('location-type').textContent=ctx.safeHere()?'SANCTUARY':mapFor(ctx.renderedMap).theme==='cave'?'WORLD I · BENEATH HALLOWMERE':ctx.renderedMap!=='overworld'?'THE FORSAKEN REACH':ctx.state.zone==='road'?'THE FORSAKEN REACH':'WORLD I · THE LAST TOLL';const interaction=nearbyInteraction(),building=interaction?.building,target=interaction?.target;$('interact-button').hidden=!interaction;$('interaction-name').textContent=interaction?.regional?regionActionName(interaction.regional):building?(!building.doorCollider.disabled?'Chapel sealed':ctx.environment.currentBuilding(ctx.player.position)?.id===building.id?'Leave '+building.name:'Enter '+building.name):target?(target.kind==='forage'?'Harvest '+target.name:target.kind?'Collect '+target.name:'Speak to '+target.name):'';const enemyTarget=ctx.mouseTargeting?.selected,boss=ctx.enemies.find(e=>!e.dead&&ctx.bossType(e.type));$('boss-bar').hidden=!boss||!!enemyTarget&&!ctx.bossType(enemyTarget.type);if(boss){$('boss-fill').style.width=`${Math.max(0,boss.hp/boss.maxHp*100)}%`;$('boss-bar').querySelector('span').textContent=ctx.renderedMap==='overworld'?'THE LAST TOLL':mapFor(ctx.renderedMap).name.toUpperCase();const title=$('boss-bar').querySelector('h2');if(title)title.textContent=`${boss.data.name}${boss.net?.bossStage>1?' · Phase '+boss.net.bossStage:''}${boss.net?.exposedUntil>(ctx.lastSnapshot?.time||0)?' · Exposed':''}`;}
 $('enemy-target').hidden=!enemyTarget||ctx.bossType(enemyTarget.type);
 if(enemyTarget&&!ctx.bossType(enemyTarget.type)){$('target-name').textContent=enemyTarget.data.name;$('target-type').textContent=(enemyTarget.data.attackStyle==='orb'?'CASTER':enemyTarget.data.attackStyle==='bite'?'DEVOURER':'KNIFE')+' · '+(ctx.attackHeld&&ctx.lockedEnemy===enemyTarget?'LOCKED · HOLD TO ATTACK':'MOUSE LOCK · CLICK TO ATTACK');$('target-fill').style.width=`${Math.max(0,enemyTarget.hp/enemyTarget.maxHp*100)}%`;}
 if(ctx.state.time>14)$('combat-guide').style.opacity='0';}
function drawMap(){
 if(!ctx.player)return;const map=mapFor(ctx.renderedMap);
 const percent=drawExplorationMap({canvas:$('minimap'),atlas:ctx.exploration,map,player:ctx.player.position,angle:ctx.angle,expanded:ctx.mapExpanded,environment:ctx.environment,npcs:ctx.renderedMap==='overworld'?NPCS:[],interactions:regionInteractions(),drops:ctx.life?.drops||[],enemies:ctx.enemies,players:ctx.lastSnapshot?.players||[],you:ctx.network?.id,bossType:ctx.bossType});
 $('map-title').textContent=map.name;$('map-exploration').textContent=`${percent}% charted · ${ctx.exploration.saveLabel}`;
}

// Sound locations use the player's ears and the isometric camera's horizontal axis.
function audioAt(cue,position,volume=1,rate=1){ctx.audio.listener={x:ctx.player.position.x,z:ctx.player.position.z};return ctx.audio.play(cue,volume,rate,{position,occluded:!hasLineOfSight(ctx.player.position,position,ctx.environment.obstacles,.1)});}
function footstepCue(){const room=ctx.environment.currentBuilding(ctx.player.position);if(room)return room.chapel?'step':'step-wood';return zoneAt(ctx.player.position)==='road'&&Math.abs(ctx.player.position.z-5)>1.8?'step-dirt':'step';}
function updateAudioWorld(dt){const room=ctx.environment.currentBuilding(ctx.player.position),interior=room?.id??null;if(interior!==ctx.audioInterior){if(ctx.started)ctx.audio.play('door',.44);ctx.audioInterior=interior;}let threat=0;if(!ctx.state.ended&&!ctx.safeHere())for(const e of ctx.enemies)if(!e.dead){const proximity=Math.max(0,1-distance(ctx.player.position,e.model.position)/13);threat+=proximity*(ctx.bossType(e.type)?1:.42);}ctx.audio.update(dt,{zone:ctx.state.zone,position:ctx.player.position,interior:!!room,threat:Math.min(1,threat),health:ctx.state.hp/ctx.state.maxHp,ended:ctx.state.ended,victory:ctx.renderedMap==='overworld'?ctx.state.victory:ctx.state.campaignComplete});}
function frame(){if(!ctx.ready)return;const raw=ctx.clock.getDelta(),dt=Math.min(raw,.035),frozen=ctx.paused||ctx.rosterPicker?.open||ctx.backgrounded||!ctx.network?.connected;ctx.network?.advance?.(raw,frozen);if(ctx.network?.connected&&!ctx.backgrounded&&(ctx.sessionMode==='multiplayer'||!frozen))ctx.movementCorrection.update(ctx.player.position,dt,ctx.environment.obstacles,ctx.worldBounds());if(!frozen){ctx.accumulated+=dt;for(const k in ctx.state.cooldowns)ctx.state.cooldowns[k]=Math.max(0,ctx.state.cooldowns[k]-dt);updatePlayer(dt,ctx.accumulated);if(!ctx.state.ended){ctx.life.update(ctx.accumulated);if(ctx.pendingRegionInteraction){const interaction=regionInteractions().find(r=>r.id===ctx.pendingRegionInteraction);if(!interaction)ctx.pendingRegionInteraction=null;else if(canReachRegion(interaction,2.7))interactRegion(interaction);}}const zone=ctx.renderedMap==='overworld'?zoneAt(ctx.player.position):ctx.renderedMap;if(zone!==ctx.state.zone){ctx.state.zone=zone;if(!ctx.state.visited.includes(zone))ctx.state.visited.push(zone);toast(zoneName(zone)+(zone==='ashwick'?' · Sanctuary':''));}ctx.audioTimer+=dt;if(ctx.audioTimer>=.1){updateAudioWorld(ctx.audioTimer);ctx.audioTimer=0;}}
 if(frozen&&ctx.network)ctx.network.input={x:0,z:0,angle:ctx.angle};
 if(!ctx.backgrounded){if(frozen)ctx.accumulated+=dt;renderSharedWorld(dt,ctx.accumulated);renderRegionLabels();updateEffects(dt);ctx.environment.update(ctx.accumulated,dt,ctx.state.victory,ctx.camera,ctx.player.position);if(ctx.renderedMap==='overworld')ctx.landmarks?.update?.(ctx.accumulated);}
 const desired=ctx.player.position.clone().add(new T.Vector3(0,0,-3.4));ctx.cameraTarget.lerp(desired,1-Math.exp(-dt*4));ctx.camera.position.copy(ctx.cameraTarget).add(ctx.cameraOffset);ctx.shake=Math.max(0,ctx.shake-dt*.35);if(ctx.shake>0&&!frozen&&ctx.gameSettings.cameraShake){ctx.camera.position.x+=(Math.random()-.5)*ctx.shake;ctx.camera.position.z+=(Math.random()-.5)*ctx.shake;}ctx.camera.lookAt(ctx.cameraTarget);ctx.worldPreview?.update(ctx.camera);ctx.moonLight.position.set(ctx.player.position.x-16,29,ctx.player.position.z+9);ctx.moonLight.target.position.set(ctx.player.position.x,0,ctx.player.position.z);ctx.moonLight.target.updateMatrixWorld();updateMouseTarget();ctx.life.renderLabels(ctx.enemies.some(e=>!e.dead&&distance(e.model.position,ctx.player.position)<8&&!ctx.safeHere()),ctx.keys.has('alt'));updateFloaters(ctx.backgrounded?0:dt);ctx.uiTimer+=dt;if(ctx.uiTimer>.09){ctx.uiTimer=0;updateUI();drawMap();}ctx.multiplayerView?.update(dt,ctx.accumulated);ctx.renderer.render(ctx.scene,ctx.camera);ctx.resourceOrbs.update(frozen?0:dt,ctx.state.hp/ctx.state.maxHp,ctx.state.mana/ctx.state.maxMana);}
function talkTo(id){awaken();const npc=ctx.life.visibleNpcs().find(n=>n.id===id);if(!npc||distance(ctx.player.position,npc.model.position)>2.8)return false;if(!ctx.state.talkedTo.includes(id))ctx.state.talkedTo.push(id);ctx.currentNpc=id;showModal('npc');return true;}
function lootCollected(drop,result){ctx.audio.play(drop.template==='bellkeeper-edge'?'relic':drop.kind==='item'?'equip':'pickup',.65);toast(drop.kind==='gold'?`+${drop.amount} crowns`:drop.kind==='item'?`${drop.name} recovered · Open inventory with I`:`${drop.amount} healing draught${drop.amount>1?'s':''} recovered`);if(drop.template==='bellkeeper-edge'&&!ctx.victoryShown){ctx.victoryShown=true;const worldId=ctx.network.worldId;ctx.victoryTimer=setTimeout(()=>{if(!ctx.state.ended&&ctx.renderedMap==='overworld'&&ctx.network.worldId===worldId)showModal('victory');},900);}updateUI();}
function renderNpc(){const data=npcDialogue(ctx.state,ctx.currentNpc);if(!data)return;$('modal-eyebrow').textContent=data.role.toUpperCase();$('modal-title').textContent=data.name;const portrait=npcPortraitFor(ctx.prefabs[data.model]),figure=$('dialogue-portrait'),image=figure.querySelector('img');figure.hidden=!portrait;figure.closest('.modal').classList.toggle('has-npc-portrait',!!portrait);if(portrait){if(image.getAttribute('src')!==portrait)image.src=portrait;image.alt=data.name;}renderDialogue($('modal-content'),data,ctx.state);}
const inventoryPreviews=bindInventoryPreviews($('modal-content'),()=>ctx.state,()=>!!ctx.network?.connected);
function renderInventory(){
 const content=$('modal-content'),focused=content.contains(document.activeElement)?document.activeElement.closest('[data-select-item]'):null;
 const focusedFood=content.contains(document.activeElement)?document.activeElement.dataset?.consume:null;
 const focusedId=focused?.dataset.selectItem,inSlot=!!focused?.closest('.equipment-slot');
 const gridScroll=content.querySelector('.inventory-grid')?.scrollTop||0,modal=content.closest('.modal'),modalScroll=modal.scrollTop,contentScroll=content.scrollTop,stage=content.closest('.chronicle-stage'),stageScroll=stage.scrollTop;
 $('inventory-purse').innerHTML=`<strong data-resource="gold">${ctx.state.gold}</strong><span>Crowns</span>`;
 content.innerHTML=inventoryMarkup(ctx.state);
 content.querySelector('.inventory-grid').scrollTop=gridScroll;
 if(focusedId){
  const replacement=[...content.querySelectorAll('[data-select-item]')].find(tile=>tile.dataset.selectItem===focusedId&&!!tile.closest('.equipment-slot')===inSlot);
  replacement?.focus({preventScroll:true});
 }
 if(focusedFood)[...content.querySelectorAll('[data-consume]')].find(button=>button.dataset.consume===focusedFood)?.focus({preventScroll:true});
 updateInventoryResources(modal,ctx.state,!!ctx.network?.connected);
 modal.scrollTop=modalScroll;content.scrollTop=contentScroll;stage.scrollTop=stageScroll;
 inventoryPreviews.refresh();
 if(ctx.state.classId&&inventoryPortraitStatus(ctx.state.classId,ctx.state.appearanceId)==='idle'){
  const key=conceptFor(ctx.state.classId,ctx.state.appearanceId);
  const refresh=()=>{if(ctx.modalKind==='inventory'&&key===conceptFor(ctx.state.classId,ctx.state.appearanceId))renderInventory();};
  prepareInventoryPortrait(ctx.state.classId,ctx.state.appearanceId).then(refresh,refresh);
 }
}

function serviceNpc(action){if(ctx.modalKind!=='npc'||!ctx.currentNpc)return{ok:false,reason:'Speak to a villager first.'};return{ok:ctx.network.send('service',{npcId:ctx.currentNpc,action})};}
function equipOwnedItem(id){
 if(ctx.modalKind!=='inventory')return{ok:false,reason:'Open your inventory first.'};
 const item=ctx.state.inventory.find(item=>item.id===id);
 if(!item)return{ok:false,reason:'You do not own that item.'};
 if(ctx.state.equipped[item.slot]===id)return{ok:true};
 return ctx.network?.send('equip',{id})?{ok:true}:{ok:false,reason:'Unable to equip while disconnected.'};
}
function consumePouchItem(itemId){
 if(ctx.modalKind!=='inventory')return {ok:false,reason:'Open your inventory to eat from your pouch.'};
 if(ctx.backgrounded)return {ok:false,reason:'Return to the game before eating.'};
 const available=consumeAvailability(ctx.state,itemId);if(!available.ok)return available;
 return ctx.network?.send('consume',{itemId})?{ok:true,pending:true}:{ok:false,reason:'Reconnect to eat.'};
}
function showModal(kind){if(ctx.mainMenuOpen&&kind!=='death')return;if(!ctx.ready||!ctx.network?.connected||ctx.mapExpanded||ctx.state.ended&&kind!=='death')return;inventoryPreviews.hide();if(kind!=='death'&&kind!=='victory')ctx.audio.play('ui-open',.55);if(!ctx.modalKind)ctx.previousFocus=document.activeElement;ctx.modalKind=kind;ctx.paused=true;releaseInput();ctx.audio.pause(true,ctx.backgrounded);$('modal-shade').hidden=false;$('modal-secondary').hidden=true;$('inventory-purse').hidden=kind!=='inventory';$('inventory-controls').hidden=kind!=='inventory';document.querySelector('.modal').classList.toggle('inventory-modal',kind==='inventory');document.querySelector('.modal').classList.toggle('pause-modal',kind==='pause');document.querySelector('.modal').classList.toggle('npc-modal',kind==='npc');$('modal-shade').classList.toggle('npc-conversation',kind==='npc');$('modal-primary').hidden=kind==='npc'||kind==='pause';$('dialogue-portrait').hidden=true;document.querySelector('.modal').classList.remove('has-npc-portrait');$('modal-eyebrow').textContent=kind==='victory'?'THE BELLKEEPER DEFEATED':kind==='death'?'THE VEIL TAKES ANOTHER':'THE ASHEN VIGIL';const title=$('modal-title'),content=$('modal-content'),primary=$('modal-primary');
 const modal=content.closest('.modal');modal.dataset.menuKind=kind;
 updateMenuNavigation($('modal-navigation'),kind,{disabled:kind==='death',canChangeCharacter:!ctx.activeJourney&&ctx.safeHere(),characterLocked:!!ctx.activeJourney});
 $('modal-subtitle').textContent=({inventory:'What you carry into the dark.',pause:ctx.sessionMode==='single-player'?'A moment before the road calls.':'The shared world keeps moving. Rest in Ashwick to stay safe.',journal:'Every step leaves a story.',help:'Know your calling. Master the vigil.',npc:'A familiar face along the road.',death:'The vigil is not over.',victory:'A new dawn for Hallowmere.'})[kind]||'';
 modal.scrollTop=0;modal.querySelector('.chronicle-stage').scrollTop=0;
 if(kind==='pause'){title.textContent=ctx.sessionMode==='single-player'?'Game paused':'Game menu';content.innerHTML=pauseMenuMarkup(ctx.gameSettings,{journey:!!ctx.activeJourney});if(ctx.activeJourney){ctx.autosave?.changed();ctx.autosave?.flush().catch(()=>{});updateSaveStatus();}}
 if(kind==='help'){title.textContent='Game controls';content.innerHTML='<div class="chronicle-controls"><div class="controls-table"><div><span>Move / attack a creature</span><kbd>WASD / LEFT CLICK</kbd></div><div><span>Stand and attack</span><kbd>SHIFT + CLICK</kbd></div><div><span>Secondary class skill</span><kbd>RIGHT CLICK</kbd></div><div><span>Evade the red attack zones</span><kbd>1</kbd></div><div><span>Major class skill / healing draught</span><kbd>2 / 3</kbd></div><div><span>Interact / enter cave / rest</span><kbd>F</kbd></div><div><span>Inventory & pouch / journal / map</span><kbd>I / J / M</kbd></div></div><p>Move the mouse near a creature to highlight it, then click to attack. Hold to keep attacking that creature; release to unlock. Ranged attacks fire from where you stand. Melee attacks approach into reach; hold Shift to stand still. '+(ctx.activeJourney?'Each journey keeps its chosen character. Autosave is always on; continuing returns you to your last checkpoint.':'Press C at a sanctuary to change class.')+' Activate the lantern in each region to set your return checkpoint. Watch for faint light and displaced stones to discover caves; their tunnels connect the regions as bosses fall. Use F or tap a landmark to enter passages, cleanse shrines, and open caches. Essence regenerates. Crowns are collected by walking over them; equipment and draughts glow on the ground. Forage mushrooms, moonleaf, and berries with F or a plant label. Open Inventory with I and click food in your pouch to restore health or essence. Hold Alt to reveal nearby loot and plants during combat. Ashwick and Rook’s lantern are safe places to rest. Walk through a door or tap Enter to explore a room. Tap Leave to return outside. Hallowmere’s chapel opens after the Bellkeeper falls.</p></div>';primary.textContent='Close controls';}
 if(kind==='journal'){const quest=questSummary(ctx.state);title.textContent=quest.title;content.innerHTML=`<div class="journal-copy"><section><span class="chronicle-label">THE LAST TOLL</span><p>Hallowmere’s chapel bell has rung for thirteen years. The dead now haunt the road from Ashwick, and the Bellkeeper still pulls the rope.</p><p><strong>${quest.objective}</strong><br>${quest.hint}</p></section><section class="journal-progress"><span class="chronicle-label">YOUR JOURNEY</span><p>Mourning Road: ${ctx.state.roadKills} monsters slain<br>Hallowmere: ${ctx.state.villageKills} / 12 afflicted<br>Bellkeeper: ${ctx.state.victory?'Defeated':ctx.state.bossSpawned?'Awakened':'Not yet awakened'}${Object.entries(ctx.state.regionProgress||{}).map(([id,p])=>`<br>${mapFor(id).name}: ${p.bossDefeated?'Boss defeated':p.bossSpawned?'Boss awakened':'Exploring'}`).join('')}<br>Hidden entrances discovered: ${ctx.state.discoveries?.length||0}<br>Spoils collected: ${ctx.state.lootCollected}<br>Village reward: ${ctx.state.questRewarded?'Claimed':'80 crowns from Elder Rowan'}</p></section></div>`;primary.textContent='Close journal';}
 if(kind==='npc')renderNpc();
 if(kind==='inventory'){title.textContent='Inventory';renderInventory();primary.textContent='Close inventory';}
 if(kind==='death'){title.textContent='Return to the lanterns';content.innerHTML=`<p>${ctx.sessionMode==='multiplayer'?'Your allies continue the fight.<br>':''}Return to ${CHECKPOINTS.find(c=>c.id===ctx.state.checkpointId)?.name||'Ashwick'} with your equipment intact.</p><div class="victory-stats"><div><strong>${ctx.state.kills}</strong><span>SLAIN</span></div><div><strong>${ctx.state.souls}</strong><span>SOULS</span></div></div>`;primary.textContent='Respawn at checkpoint';if(ctx.activeJourney)content.insertAdjacentHTML('beforeend','<button type="button" class="text-button" data-save-exit>Save &amp; exit</button><span class="journey-save-status" data-save-status role="status"></span>');}
 if(kind==='victory'){title.textContent='At last, silence';content.innerHTML=`<p>The Bellkeeper falls. For the first time in thirteen years, Hallowmere hears the wind.</p><div class="legendary-reward"><span>LEGENDARY WEAPON RECOVERED</span><strong>Bellkeeper’s Requiem</strong><p>+18 primary damage · Equip it in your inventory.</p></div><p>Return to Elder Rowan in Ashwick to claim the villages’ thanks.</p>`;primary.textContent='Continue playing';}if(kind==='npc')content.querySelector('.dialogue-response:not(:disabled), [data-dialogue-close]')?.focus({preventScroll:true});else if(kind==='pause')content.querySelector('[data-resume-game]').focus({preventScroll:true});else primary.focus({preventScroll:true});}
function closeModal(){if(ctx.journeyLeaving||ctx.journeyConflict)return;if(ctx.state.ended||ctx.rosterPicker?.open)return;if(ctx.mainMenuOpen){resumeFromMainMenu();return;}inventoryPreviews.hide();ctx.audio.play('ui-close',.5);$('modal-shade').hidden=true;ctx.paused=false;syncAudioState();ctx.modalKind='';ctx.currentNpc=null;ctx.previousFocus?.focus?.({preventScroll:true});$('world').focus({preventScroll:true});}
bindPauseMenu($('modal-content'),{
 onResume:()=>{closeModal();awaken();},
 onSaveExit:saveAndExit,
 onSetting:(key,value)=>{
  ctx.gameSettings[key]=value;saveGameSettings(ctx.gameSettings);
  if(key==='music'){ctx.audio.musicEnabled=value;ctx.audio.applyState();if(value)awaken();}
  else{applyGameVisuals(ctx.gameSettings,ctx.renderer,ctx.scene);if(key==='cameraShake')ctx.shake=0;}
 }
});
$('modal-content').addEventListener('click',event=>{if(event.target.closest('[data-dialogue-close]')){closeModal();awaken();return;}const food=event.target.closest('[data-consume]');if(food){const result=consumePouchItem(food.dataset.consume);if(!result.ok)toast(result.reason);return;}if(event.target.closest('[data-open-roster]')){openRoster();return;}const item=event.target.closest('[data-select-item]');if(item){const r=equipOwnedItem(item.dataset.selectItem);if(!r.ok)toast(r.reason);return;}const service=event.target.closest('[data-service]');if(service&&!service.disabled){const r=serviceNpc(service.dataset.service);if(!r.ok)toast(r.reason);}});
$('modal-primary').onclick=()=>{if(ctx.modalKind==='death')restart();else{closeModal();awaken();}};$('modal-secondary').onclick=restart;$('modal-shade').addEventListener('keydown',e=>{if(ctx.modalKind==='npc'&&handleDialogueKey(e,$('modal-content')))return;if(e.key!=='Tab')return;const focusable=[...$('modal-shade').querySelectorAll('button:not(:disabled), input:not(:disabled), select:not(:disabled), a[href], summary')].filter(el=>el.getClientRects().length);const first=focusable[0],last=focusable.at(-1);if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}});
function restart(){if(!ctx.network?.connected)return;if(ctx.state.ended){ctx.network.send('respawn');}else{ctx.network.send(ctx.sessionMode==='single-player'?'restart':'vote',{agree:true});closeModal();}}
function connectionStatus(message,connected,{retryable=false,failed=false}={}){
 syncAudioState(connected);
 // A reconnect overlay must remain reachable while the main menu traps focus.
 if(ctx.mainMenuOpen){const wasInert=$('loading').inert;$('loading').inert=!connected;if(connected&&wasInert&&!ctx.rosterPicker?.open)$('menu-resume').focus();}
 const el=$('multiplayer-status');if(el.textContent!==message)el.textContent=message;el.hidden=!connected||ctx.sessionMode==='single-player';$('connection-back').hidden=!!ctx.lastSnapshot;$('connection-overlay').hidden=connected;if(!connected){inventoryPreviews.hide();$('connection-title').textContent=failed?'Unable to connect':ctx.lastSnapshot?'Reconnecting to game':'Loading game';$('connection-message').textContent=message;$('connection-spinner').hidden=failed;$('connection-retry').hidden=!retryable;if(ctx.modalKind==='inventory')updateInventoryResources($('modal-content').closest('.modal'),ctx.state,false);releaseInput();ctx.rosterPicker?.resolve({ok:false,reason:'Connection lost. Try again once connected.'});if(ctx.mainMenuOpen){const focusTarget=$(retryable?'connection-retry':'connection-title');focusTarget.tabIndex=retryable?0:-1;focusTarget.focus();}}}
$('connection-retry').onclick=()=>{if(ctx.lastSnapshot){location.reload();return;}returnToModeChoice();startSession('multiplayer');};
$('restart-yes').onclick=()=>ctx.network?.send('vote',{agree:true});
$('restart-no').onclick=()=>ctx.network?.send('vote',{agree:false});
function applySnapshot(snapshot,changed){
 const initialSnapshot=!ctx.lastSnapshot,wasDead=ctx.state.ended,oldLevel=ctx.state.level,beforeServices=JSON.stringify([ctx.state.gold,ctx.state.potions,ctx.state.forgeLevel,ctx.state.questAccepted,ctx.state.questRewarded,ctx.state.victory,ctx.state.bossLootClaimed,ctx.state.rookSupplies]),beforeInventory=JSON.stringify([ctx.state.inventory,ctx.state.equipped]);
 const nextMap=snapshot.mapId||snapshot.state.mapId||snapshot.players.find(p=>p.id===snapshot.you)?.mapId||'overworld',mapChanged=nextMap!==ctx.renderedMap;
 if(mapChanged)switchMap(nextMap);
 if(changed||mapChanged||initialSnapshot){ctx.classEffects.clear();for(const visual of ctx.networkZones.values())visual.dispose();ctx.networkZones.clear();releaseInput();ctx.network.pending=[];if(changed){ctx.victoryShown=false;ctx.lastNetworkEvent=0;clearTimeout(ctx.victoryTimer);}for(const effect of ctx.effects)removeObject(effect.mesh);ctx.effects.length=0;for(const floater of ctx.floaters)floater.element.remove();ctx.floaters.length=0;for(const e of ctx.enemies){cancelAttack(e);e.visuals.dispose();disposeActor(e.model);removeObject(e.bar);e.barTexture.dispose();}ctx.enemies.length=0;ctx.life.syncLoot([]);ctx.life.syncForage([]);for(const b of ctx.networkProjectiles.values())b.visual?b.visual.dispose():removeObject(b.mesh);ctx.networkProjectiles.clear();if(changed)toast(ctx.sessionMode==='single-player'?'A new vigil begins.':'A new vigil begins · The shared world has restarted.');else if(mapChanged)toast(mapFor(nextMap).name);}
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
 const enemyIds=new Set(snapshot.enemies.map(e=>e.id));for(let i=ctx.enemies.length-1;i>=0;i--)if(!enemyIds.has(ctx.enemies[i].id)){const e=ctx.enemies[i];cancelAttack(e);e.visuals.dispose();disposeActor(e.model);removeObject(e.bar);e.barTexture.dispose();ctx.enemies.splice(i,1);}
 for(const data of snapshot.enemies){let e=ctx.enemies.find(e=>e.id===data.id);if(!e)e=spawnEnemy(data.type,data.x,data.z,data.zone,data.id);const oldPhase=e.phase;if(e.dead&&data.hp>0){e.model.visible=true;e.model.position.set(data.x,0,data.z);e.model.rotation.z=0;e.barHealth=data.hp;}e.net=data;e.hp=data.hp;e.dead=data.hp<=0;e.phase=data.phase;e.timer=data.timer;e.maxHp=data.maxHp;e.angle=data.angle;
  if(e.dead||oldPhase!==data.phase||data.phase!=='windup'||!usesLegacyTelegraph(data.type)){cancelAttack(e);if(data.hp>0&&data.phase==='windup'&&usesLegacyTelegraph(data.type))e.telegraph=telegraph(e.data.attackStyle==='orb'&&!ctx.bossType(e.type)?data.aim:data,e.data.attackStyle==='orb'&&!ctx.bossType(e.type)?1.5:e.data.range,e.data.attackStyle==='orb'?Math.PI*2:1.9,data.attackAngle);}
  updateEnemyBar(e);
 }
 ctx.life.syncLoot(snapshot.loot);ctx.life.syncForage(snapshot.forage);ctx.environment.updateProgress?.(ctx.state);ctx.environment.sync?.(snapshot.interactions,ctx.state.discoveries);if(ctx.renderedMap==='overworld'){ctx.landmarks?.updateProgress?.(ctx.state);ctx.landmarks?.sync?.(snapshot.interactions,ctx.state.discoveries);}
 connectionStatus(`${snapshot.players.length} / 8 adventurers · ${classFor(ctx.state).name} ${me.slot+1}`,true);
 $('restart-vote').hidden=ctx.sessionMode==='single-player'||!snapshot.votes.length;$('restart-vote-text').textContent=`Restart the game? ${snapshot.votes.length} / ${snapshot.players.length} agree. All progress will reset.`;
 $('restart-yes').disabled=snapshot.votes.includes(snapshot.you);
 for(const event of snapshot.events)if(event.id>ctx.lastNetworkEvent){networkEvent(event);ctx.lastNetworkEvent=event.id;}
 if(ctx.state.level>oldLevel&&!changed){toast(`Oath strengthened · Level ${ctx.state.level}`);ctx.audio.play('levelup',.65);}if(ctx.state.ended&&!wasDead){dismissMainMenu();ctx.audio.play('death-player',.8);releaseInput();if(ctx.mapExpanded)toggleMapForDeath();showModal('death');}
 if(wasDead&&!ctx.state.ended||changed){dismissMainMenu();inventoryPreviews.hide();$('modal-shade').hidden=true;ctx.modalKind='';ctx.paused=false;toggleMapForDeath();syncAudioState();ctx.player.rotation.z=0;ctx.player.position.y=0;}
 if(ctx.mainMenuOpen&&!ctx.rosterPicker?.open)ctx.titleScreen.updateSession(mainMenuSession());
 if(!ctx.state.classId&&!ctx.rosterPicker?.open)openRoster();
 if(ctx.modalKind==='npc'&&beforeServices!==JSON.stringify([ctx.state.gold,ctx.state.potions,ctx.state.forgeLevel,ctx.state.questAccepted,ctx.state.questRewarded,ctx.state.victory,ctx.state.bossLootClaimed,ctx.state.rookSupplies]))renderNpc();if(ctx.modalKind==='inventory'&&beforeInventory!==JSON.stringify([ctx.state.inventory,ctx.state.equipped]))renderInventory();if(ctx.modalKind==='inventory')updateInventoryResources($('modal-content').closest('.modal'),ctx.state,ctx.network.connected);updateUI();
}
function toggleMapForDeath(){ctx.mapExpanded=false;const panel=document.querySelector('.map-panel');panel.classList.remove('expanded');for(const attr of ['role','aria-modal','aria-labelledby'])panel.removeAttribute(attr);$('map-button').setAttribute('aria-label','Expand map');ctx.paused=false;}
function networkEvent(event){
 if(event.type==='result'&&event.operation==='class'&&ctx.state.classId&&ctx.sessionMode==='single-player'&&!ctx.cavePreviewStarted&&new URLSearchParams(location.search).get('preview')==='enemies'){ctx.cavePreviewStarted=true;const generation=ctx.sessionGeneration;import('./enemy-preview.js').then(({createEnemyPreview})=>{if(generation===ctx.sessionGeneration)createEnemyPreview(ctx.network,()=>{releaseInput();ctx.resetMovement=true;});});}
 if(event.type==='result'&&event.operation==='class'){ctx.rosterPicker?.resolve(event);if(ctx.state.classId&&ctx.sessionMode==='single-player'&&!ctx.cavePreviewStarted&&['caves','exploration'].includes(new URLSearchParams(location.search).get('preview'))){ctx.cavePreviewStarted=true;const generation=ctx.sessionGeneration;import('./cave-preview.js').then(({createCavePreview})=>{if(generation===ctx.sessionGeneration)createCavePreview(ctx.network,()=>{releaseInput();ctx.resetMovement=true;});});}}
 if(ctx.backgrounded||event.mapId&&event.mapId!==ctx.renderedMap)return;
 const pos=new T.Vector3(event.x||0,0,event.z||0);
 if(event.type==='ability'){
  const actor=event.playerId===ctx.network.id?{model:ctx.player,rig:ctx.heroRig}:ctx.multiplayerView.actors.get(event.playerId);if(!actor)return;
  const local=event.playerId===ctx.network.id,rig=actor.rig;
  const skill=abilityForEvent(event),color=event.color||classColor(event),classVisual=ctx.classEffects.ability(event,skill,actor.model);
  if(skill?.kind==='melee'){rig.attack=.42;rig.attackKind=skill.hits===2?'paired':'attack';if(!classVisual)slash(pos,event.angle,color,skill.range,.3);audioAt('sword',pos,.6);}
  if(skill?.kind==='projectile'){
   rig.attack=.36;rig.attackKind='bolt';
   const hand=pos.clone().add(new T.Vector3(0,1.2,0)),direction=new T.Vector3(Math.sin(event.angle),0,Math.cos(event.angle));
   if(skill.projectile==='ember')ctx.combatEffects.cast(hand,direction);
   else if(skill.projectile==='arcane')ctx.combatEffects.arcaneCast(hand,direction);
   else if(!classVisual)particles(hand,color,9,1.8);
   audioAt(['arrow','knife'].includes(skill.projectile)?'sword':'ember',pos,.5);
  }
  if(skill?.kind==='support'){rig.attack=.42;rig.attackKind='support';audioAt('heal',pos,.5);}
  if(skill?.kind==='burst'||skill?.kind==='zone'){rig.attack=event.classId==='oathkeeper'?.42:.36;rig.attackKind=event.classId==='oathkeeper'?'support':'bolt';if(!classVisual){ringEffect(pos,color,.3,skill.radius||3,.65);particles(pos,color,24,3);}audioAt('nova',pos,.55);}
  if(skill?.kind==='shield'){if(!classVisual)ringEffect(pos,color,.8,1.2,skill.duration);audioAt('heal',pos,.6);}
  if(event.action==='heal'){if(!classVisual)ringEffect(pos,0x97cba5,.2,1.5,.7);audioAt('heal',pos,.6);}
  if(event.action==='dodge'){audioAt('dodge',pos,.5);if(local){ctx.moveTarget=null;ctx.movePath=[];ctx.lockedEnemy=null;}}
 }
 if(event.type==='hit'){
  floatText(String(event.damage),pos,event.magic?'magic':'');
  const impact=pos.clone().add(new T.Vector3(0,1,0));
  if(event.visual==='ember')ctx.combatEffects.emberImpact(impact);
  else if(event.visual==='arcane')ctx.combatEffects.arcaneImpact(impact);
  else if(!ctx.classEffects.impact(event)){
   if(event.magic)particles(impact,event.color||'#88cfdb',12,2.8);else steelImpact(impact);
  }
  audioAt(event.magic?'ember-hit':'impact',pos,.55);
 }
 if(event.type==='respawn'&&event.revivedBy){ringEffect(pos,0xffdf8b,.3,1.7,1);particles(pos,0xffe8aa,28,2);audioAt('heal',pos,.7);if(event.playerId===ctx.network.id)toast('Resurrected by Oathkeeper');}
 if(event.type==='hurt'){floatText(String(event.damage),pos,'enemy-damage');if(event.playerId===ctx.network.id){ctx.audio.play('hurt',.6);$('damage-vignette').style.opacity='.75';setTimeout(()=>$('damage-vignette').style.opacity='0',210);}}
 if(event.type==='kill'){audioAt(event.typeName==='boss'?'death-boss':event.typeName==='hound'?'death-hound':event.typeName==='revenant'?'death-revenant':'death',pos,.6);if(ctx.lockedEnemy?.id===event.enemyId){ctx.lockedEnemy=null;ctx.attackHeld=false;}if(ctx.bossType(event.typeName))toast(`${ENEMY_TYPES[event.typeName].name} falls · Claim your personal loot`);}
 if(event.type==='region-boss'){const boss=ctx.enemies.find(e=>e.id===event.enemyId);if(boss)toast(`${boss.data.name} has awakened.`);ctx.audio.play('boss-windup',.65);}
 if(event.type==='objective-ready')toast(event.message);
 if(event.type==='boss'){toast(`${ENEMY_TYPES[event.typeName]?.name||'The Bellkeeper'} has answered.`);ctx.audio.play('bell',.6);}
 if(event.type==='windup'){const e=ctx.enemies.find(e=>e.id===event.enemyId);if(e)audioAt(ctx.bossType(e.type)?'boss-windup':`voice-${ctx.enemyModelType(e.type)}`,e.model.position,.5);}
 if(event.type==='strike'){
  const e=ctx.enemies.find(e=>e.id===event.enemyId),data=ENEMY_TYPES[event.typeName];e?.visuals.strike();
  if(ctx.bossType(event.typeName)){ringEffect(pos,data.orbColor,.2,3.4,.5);audioAt('boss-slam',pos,.7);}
  else if(data.attackStyle==='knife'){slash(pos,event.angle,0xd3dfd8,data.range,.22);audioAt('sword',pos,.4);}
  else if(data.attackStyle==='bite'){const mouth=pos.clone().add(new T.Vector3(Math.sin(event.angle)*.8,.9,Math.cos(event.angle)*.8));particles(mouth,0xd9c7a4,6,1.3);audioAt('impact',pos,.45);}
  else {particles(pos.clone().add(new T.Vector3(0,1.4,0)),data.orbColor,12,2);audioAt('ember',pos,.45);}
 }
 if(event.type==='loot')lootCollected(event.drop,{collected:true});
 if(event.type==='result'){if(event.ok&&['forage','consume'].includes(event.operation))ctx.audio.play(event.operation==='forage'?'pickup':'heal',.55);if(event.message||event.reason)toast(event.message||event.reason);}
}
function renderSharedWorld(dt,t){renderHazards();ctx.classEffects.syncActors(ctx.lastSnapshot?.players||[],id=>id===ctx.network?.id?ctx.player:ctx.multiplayerView?.actors.get(id)?.model,ctx.renderedMap);
 for(const e of ctx.enemies){const n=e.net;if(!n)continue;const blend=1-Math.exp(-dt*14);e.model.position.x=T.MathUtils.lerp(e.model.position.x,n.x,blend);e.model.position.z=T.MathUtils.lerp(e.model.position.z,n.z,blend);e.model.rotation.y=angleLerp(e.model.rotation.y,n.angle,blend);
  if(e.dead){e.visuals.update(n,dt,t);e.model.rotation.z=T.MathUtils.lerp(e.model.rotation.z,1.45,dt*7);e.model.position.y=Math.max(-1,e.model.position.y-dt*.5);e.model.visible=e.model.position.y>-.9;e.bar.visible=false;continue;}
  if(e.barHealth>e.hp){e.barHealth=Math.max(e.hp,e.barHealth-dt*e.maxHp*1.6);updateEnemyBar(e);}animateRig(e.rig,t,n.moving,n.phase==='windup'?1-n.timer/e.data.windup:0,ctx.enemyModelType(e.type));e.visuals.update(n,dt,t+e.seed);e.bar.position.copy(e.model.position).add(new T.Vector3(0,(ctx.enemyModelType(e.type)==='boss'?4.8:ctx.enemyModelType(e.type)==='hound'?1.5:ctx.enemyModelType(e.type)==='hollow'?2.25:3.25)*(e.data.scale||1),0));e.bar.visible=e===ctx.mouseTargeting?.selected||distance(ctx.player.position,e.model.position)<12;
  if(e.telegraph){e.telegraph.children[0].material.opacity=.08+(1-n.timer/e.data.windup)*.26;}
 }
 const ids=new Set(ctx.lastSnapshot?.projectiles.map(b=>b.id)||[]);
 for(const [id,b] of ctx.networkProjectiles)if(!ids.has(id)){b.visual?b.visual.dispose():removeObject(b.mesh);ctx.networkProjectiles.delete(id);}
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
window.hallowmere={getState:()=>({...ctx.state,cooldowns:{...ctx.state.cooldowns},ready:ctx.ready,paused:ctx.paused,backgrounded:ctx.backgrounded,mode:ctx.sessionMode,simulationPaused:!ctx.network?.connected||ctx.sessionMode==='single-player'&&(ctx.paused||ctx.backgrounded||!!ctx.rosterPicker?.open),multiplayer:{connected:ctx.sessionMode==='multiplayer'&&!!ctx.network?.connected,worldId:ctx.network?.worldId,players:ctx.lastSnapshot?.players||[],votes:ctx.lastSnapshot?.votes||[]},modal:ctx.modalKind,interior:ctx.player?ctx.environment.currentBuilding(ctx.player.position)?.id??null:null,buildings:ctx.environment?.buildings.map(b=>({id:b.id,name:b.name,chapel:b.chapel,locked:!b.doorCollider.disabled,inside:b.inside,door:{...b.door},entry:{...b.entry},exit:{...b.exit}})),dialogue:ctx.modalKind==='npc'?npcDialogue(ctx.state,ctx.currentNpc):null,objective:questSummary(ctx.state),mapId:ctx.renderedMap,bounds:ctx.worldBounds(),interactions:regionInteractions(),hazards:ctx.lastSnapshot?.hazards||[],audio:ctx.audio.getState(),targeting:{hoveredEnemy:ctx.mouseAction?.kind==='enemy'?ctx.mouseAction.target.id:null,lockedEnemy:ctx.lockedEnemy?.id??null,highlightedEnemy:ctx.mouseTargeting?.selected?.id??null},player:ctx.player?{x:ctx.player.position.x,z:ctx.player.position.z,moving:!!ctx.moveTarget,attacking:ctx.attackHeld}:null,...ctx.life?.getState(),enemies:ctx.enemies.filter(e=>!e.dead).map(e=>({id:e.id,type:e.type,zone:e.zone,hp:e.hp,x:e.model.position.x,z:e.model.position.z,phase:e.phase,lineOfSight:hasLineOfSight(ctx.player.position,e.model.position,ctx.environment.obstacles)})),drawCalls:ctx.renderer?.info.render.calls}),showControls:()=>showModal('help'),pause:()=>showModal('pause'),resume:closeModal};
const modelContext=document.modelContext;
if(modelContext?.registerTool){const lifecycle=new AbortController();const register=tool=>{try{Promise.resolve(modelContext.registerTool(tool,{signal:lifecycle.signal})).catch(error=>console.warn('Game tool registration unavailable',error));}catch(error){console.warn('Game tool registration unavailable',error);}};register({name:'get_vigil_state',title:'Read the vigil',description:'Read health, position, objectives, nearby villagers and dialogue choices, ground loot, available forage plants, the food pouch, active essence regeneration, owned equipment, enemies, and cooldowns.',inputSchema:{type:'object',properties:{},additionalProperties:false},annotations:{readOnlyHint:true,untrustedContentHint:false},execute(input){if(input&&Object.keys(input).length)throw Error('No input fields are accepted.');return window.hallowmere.getState();}});register({name:'control_warden',title:'Control the Warden',description:'Use normal game controls. Move to x,z; attack with optional hold (mouse hold), interact with a villager, loot, plant, or building id (walks closer or enters through its door), choose a displayed NPC service, open inventory, consume pouch food by id while Inventory is open, equip an owned item, use a spell, pause or resume. Costs, distance, collisions, cooldowns, and health apply.',inputSchema:{type:'object',properties:{action:{type:'string',enum:['move','attack','bolt','dodge','nova','heal','pause','resume','interact','service','inventory','equip','consume']},x:{type:'number',minimum:Math.min(...Object.values(MAPS).map(m=>m.bounds.minX)),maximum:Math.max(...Object.values(MAPS).map(m=>m.bounds.maxX))},z:{type:'number',minimum:Math.min(...Object.values(MAPS).map(m=>m.bounds.minZ)),maximum:Math.max(...Object.values(MAPS).map(m=>m.bounds.maxZ))},id:{type:'string'},choice:{type:'string'},hold:{type:'boolean'}},required:['action'],additionalProperties:false},annotations:{readOnlyHint:false,untrustedContentHint:false},execute(input){const valid=['move','attack','bolt','dodge','nova','heal','pause','resume','interact','service','inventory','equip','consume'];if(!input||!valid.includes(input.action)||Object.keys(input).some(k=>!['action','x','z','id','choice','hold'].includes(k)))throw Error('Invalid Warden action.');if(!ctx.ready)throw Error('The game is still loading.');if(input.x!==undefined&&(!Number.isFinite(input.x)||input.x<ctx.worldBounds().minX||input.x>ctx.worldBounds().maxX))throw Error('x is outside the world.');if(input.z!==undefined&&(!Number.isFinite(input.z)||input.z<ctx.worldBounds().minZ||input.z>ctx.worldBounds().maxZ))throw Error('z is outside the world.');if((input.x===undefined)!==(input.z===undefined))throw Error('Supply both x and z.');if(input.action==='move'&&input.x===undefined)throw Error('Movement requires x and z.');if(input.hold!==undefined&&typeof input.hold!=='boolean')throw Error('hold must be a boolean.');if(input.action==='pause'){showModal('pause');return{paused:ctx.paused};}if(input.action==='resume'){closeModal();return{paused:ctx.paused};}if(input.action==='service')return serviceNpc(input.choice);if(input.action==='equip')return equipOwnedItem(input.id);if(input.action==='consume')return consumePouchItem(input.id);if(ctx.paused||ctx.backgrounded||ctx.state.ended)throw Error('The vigil is paused, in the background, or ended.');awaken();if(input.action==='inventory'){showModal('inventory');return{opened:true};}if(input.action==='interact')return interact(input.id);if(input.x!==undefined){ctx.targetWorld.set(input.x,0,input.z);ctx.angle=Math.atan2(input.x-ctx.player.position.x,input.z-ctx.player.position.z);ctx.aimActive=true;}else ctx.aimActive=false;let performed;if(input.action==='move')performed=setDestination(new T.Vector3(input.x,0,input.z));else if(input.action==='attack'&&input.hold!==undefined){ctx.attackHeld=input.hold;ctx.lockedEnemy=ctx.attackHeld?(input.id?ctx.enemies.find(e=>e.id===input.id&&!e.dead):input.x!==undefined?enemyAtPoint(ctx.targetWorld):nearestEnemy(12)):null;ctx.moveTarget=null;ctx.movePath=[];if(ctx.lockedEnemy){ctx.aimActive=false;ctx.angle=Math.atan2(ctx.lockedEnemy.model.position.x-ctx.player.position.x,ctx.lockedEnemy.model.position.z-ctx.player.position.z);}performed=ctx.attackHeld?perform('attack'):true;}else performed=perform(input.action);updateUI();return{performed,health:ctx.state.hp,essence:Math.floor(ctx.state.mana),cooldown:ctx.state.cooldowns[input.action]??0};}});window.addEventListener('pagehide',()=>lifecycle.abort(),{once:true});}
// Begin the score during loading; retry blocked autoplay on any player gesture.
for(const event of ['pointerdown','click','keydown'])window.addEventListener(event,()=>{if(!ctx.audio.ready||ctx.audio.context?.state==='suspended'||ctx.audio.music?.blocked)awaken();},{capture:true});
awaken();
init();

window.addEventListener('pagehide',event=>{if(!event.persisted)ctx.worldPreview?.dispose();});
