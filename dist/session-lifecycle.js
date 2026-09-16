// The mode-choice, journey, session, main-menu and roster region moved verbatim out of
// main.js (M9). The region's import-time statements -- the title screen and journeys menu,
// setModeChoiceInert(true), the connection-back handler, and the pagehide/pageshow listeners --
// run at the bottom of the factory body in the order they had in main.js, so main.js's single
// wiring line sits where they stood and pagehide #1 is still registered after
// bindExplorationSaving's and before bindInput's page-activity pair, the automation surface's
// abort, and the worldPreview dispose.
//
// Free identifiers: $ (./dom.js). createTitleScreen (./title-screen.js), createJourneysMenu
// (./journeys-menu.js), LocalSession (./local-session.js), MultiplayerClient
// (./multiplayer-client.js), createAutosave (./journey-store.js) and createJourney
// (./journey-state.js) are re-imported through a `deps` escape hatch defaulting to those same
// imports -- the only deviation from verbatim besides the ctx./target renames below -- because
// the session-matrix test stubs the title screen, the journeys menu, both transports and the
// autosave the way tests/hud.test.mjs already stubs drawExplorationMap. classFor (./classes.js,
// mainMenuSession); conceptFor (./classes.js), prepareCharacterPortraits
// (./character-portraits.js), disposeActor (./multiplayer-view.js) and getRig (./model-kit.js)
// (syncPlayerCharacter) stay plain imports. location (global, the pageshow reload).
//
// ctx renames for names that were bare module-scope bindings in main.js: ctx.releaseInput/
// ctx.toggleMap (M5's bindInput), ctx.inventoryPreviews (M8's createInventoryUi),
// ctx.toggleMapForDeath (M8's createModals), ctx.awaken (M7's createGameAudio),
// ctx.applySnapshot and ctx.connectionStatus (main.js's own applySnapshot, still there until
// M10, and M9's createConnectionUi) -- all read lazily inside startSession, so wiring order
// between the factories does not matter. document -> documentTarget for the two
// querySelectorAll sweeps, window -> windowTarget for the two listeners.
//
// Also on ctx: ctx.journeyStore/ctx.audio/ctx.previewMode (createGameContext inputs),
// ctx.syncAudioState (M7's createGameAudio), ctx.toast (M7's createHud), ctx.cloneModel (M2's
// createModelCache), ctx.renderInventory (M8's createInventoryUi), ctx.safeHere
// (game-context.js), and the already-declared data fields (ctx.ready, ctx.sessionMode,
// ctx.titleScreen, ctx.journeysMenu, ctx.activeJourney, ctx.autosave, ctx.network, ...).
//
// openMainMenu has no in-game caller today -- main.js never called it and no other module
// does; it is kept, returned and covered by tests/session-lifecycle.test.mjs so the extraction
// stays behaviour-preserving rather than quietly dropping a reachable entry point.
import {$} from './dom.js';
import {createTitleScreen as createTitleScreenImport} from './title-screen.js';
import {createJourneysMenu as createJourneysMenuImport} from './journeys-menu.js';
import {LocalSession as LocalSessionImport} from './local-session.js';
import {MultiplayerClient as MultiplayerClientImport} from './multiplayer-client.js';
import {createAutosave as createAutosaveImport} from './journey-store.js';
import {createJourney as createJourneyImport} from './journey-state.js';
import {classFor,conceptFor} from './classes.js';
import {prepareCharacterPortraits} from './character-portraits.js';
import {disposeActor} from './multiplayer-view.js';
import {getRig} from './model-kit.js';
export function createSessionLifecycle(ctx,{windowTarget=window,documentTarget=document,createTitleScreen=createTitleScreenImport,createJourneysMenu=createJourneysMenuImport,LocalSession=LocalSessionImport,MultiplayerClient=MultiplayerClientImport,createAutosave=createAutosaveImport,createJourney=createJourneyImport}={}){
 function setModeChoiceInert(inert){for(const child of $('game').children)if(child.id!=='loading')child.inert=inert;}
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
   ctx.journeyConflict=true;ctx.paused=true;ctx.releaseInput();ctx.audio.pause(true,ctx.backgrounded);
   ctx.journeysMenu.showConflict(error.message,()=>{stopJourneySession();openJourneys();});
   updateSaveStatus({kind:'error',message:error.message});
  }});
 }
 function updateSaveStatus(value=ctx.saveStatus){
  ctx.saveStatus=value;
  for(const element of documentTarget.querySelectorAll('[data-save-status], #journey-save-indicator')){element.textContent=value.message;element.dataset.kind=value.kind;}
  const indicator=$('journey-save-indicator');indicator.hidden=!ctx.activeJourney;clearTimeout(ctx.saveIndicatorTimer);
  if(value.kind==='saved')ctx.saveIndicatorTimer=setTimeout(()=>{indicator.hidden=true;},2500);
 }
 async function saveAndExit(){
  if(!ctx.autosave||ctx.journeyLeaving||ctx.journeyConflict)return;
  ctx.journeyLeaving=true;ctx.paused=true;ctx.releaseInput();
  for(const button of documentTarget.querySelectorAll('[data-save-exit], [data-resume-game]'))button.disabled=true;
  try{const id=ctx.activeJourney.id;await ctx.autosave.exit();stopJourneySession();openJourneys(id);}
  catch(error){updateSaveStatus({kind:'error',message:error.message});}
  finally{ctx.journeyLeaving=false;for(const button of documentTarget.querySelectorAll('[data-save-exit], [data-resume-game]'))button.disabled=false;}
 }
 function stopJourneySession(){
  ctx.autosave?.stop();ctx.autosave=null;ctx.network?.close();ctx.network=null;ctx.sessionGeneration++;ctx.ready=false;ctx.started=false;
  ctx.activeJourney=null;ctx.sessionMode=null;ctx.lastSnapshot=null;ctx.lastNetworkEvent=0;ctx.mainMenuOpen=false;ctx.journeyConflict=false;
  clearTimeout(ctx.victoryTimer);clearTimeout(ctx.saveIndicatorTimer);ctx.victoryShown=false;ctx.cavePreviewStarted=false;
  ctx.releaseInput();ctx.inventoryPreviews.hide();ctx.toggleMapForDeath();ctx.modalKind='';ctx.currentNpc=null;
  $('modal-shade').hidden=true;$('journey-save-indicator').hidden=true;$('connection-overlay').hidden=true;$('restart-vote').hidden=true;
  ctx.audio.pause(true,ctx.backgrounded);ctx.accumulated=0;ctx.uiTimer=0;ctx.audioTimer=0;ctx.dodgeTime=0;ctx.shake=0;ctx.resetMovement=true;
 }
 function startSession(mode,save){
  if(!ctx.assetsReady||ctx.sessionMode)return;
  ctx.sessionMode=mode;ctx.ready=true;setModeChoiceInert(false);const generation=++ctx.sessionGeneration;
  const current=callback=>(...args)=>{if(generation===ctx.sessionGeneration)callback(...args);};
  const callbacks={onSnapshot:current(ctx.applySnapshot),onProgress:current(soon=>ctx.autosave?.changed(soon)),onStatus:current(ctx.connectionStatus),onWelcome:current(()=>{ctx.releaseInput();ctx.movementCorrection.reset();ctx.resetMovement=true;ctx.moveTarget=null;ctx.movePath=[];})};
  ctx.network=mode==='single-player'?new LocalSession({...callbacks,save}):new MultiplayerClient(callbacks);
  ctx.titleScreen.hide();ctx.clock.getDelta();ctx.network.start();ctx.awaken();
 }
 function returnToModeChoice(){
  if(ctx.lastSnapshot)return;
  ctx.sessionGeneration++;ctx.network?.close();ctx.network=null;ctx.releaseInput();showModeChoice();
 }
 function mainMenuSession(){
  return {mode:ctx.sessionMode,canChangeCharacter:!ctx.activeJourney&&!!ctx.network?.connected&&!ctx.state.ended&&ctx.safeHere(),character:classFor(ctx.state).name,characterLocked:!!ctx.activeJourney};
 }
 function openMainMenu(){
  if(!ctx.ready||!ctx.network?.connected||!ctx.lastSnapshot||ctx.state.ended||ctx.rosterPicker?.open)return;
  if(ctx.mapExpanded)ctx.toggleMap();
  ctx.inventoryPreviews.hide();$('modal-shade').hidden=true;ctx.modalKind='';ctx.currentNpc=null;
  ctx.mainMenuOpen=true;ctx.paused=true;ctx.releaseInput();ctx.audio.pause(true,ctx.backgrounded);
  setModeChoiceInert(true);ctx.titleScreen.showMainMenu(mainMenuSession());
 }
 function resumeFromMainMenu(){
  if(ctx.journeyLeaving||ctx.journeyConflict)return;
  if(!ctx.mainMenuOpen||!ctx.network?.connected||ctx.state.ended)return;
  ctx.mainMenuOpen=false;$('loading').inert=false;ctx.titleScreen.hide();setModeChoiceInert(false);
  ctx.paused=false;ctx.releaseInput();ctx.clock.getDelta();ctx.syncAudioState();$('world').focus({preventScroll:true});
 }
 function closeRoster(){
  ctx.releaseInput();
  if(ctx.creatingJourney){ctx.creatingJourney=false;openJourneys();return;}
  if(ctx.mainMenuOpen){ctx.paused=true;ctx.audio.pause(true,ctx.backgrounded);ctx.titleScreen.showMainMenu(mainMenuSession());return;}
  ctx.paused=false;ctx.syncAudioState();$('world').focus({preventScroll:true});
 }
 function dismissMainMenu(){
  if(!ctx.mainMenuOpen)return;
  ctx.mainMenuOpen=false;$('loading').inert=false;ctx.titleScreen.hide();setModeChoiceInert(false);
 }
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
  if(ctx.mapExpanded)ctx.toggleMap();ctx.inventoryPreviews.hide();$('modal-shade').hidden=true;ctx.modalKind='';ctx.currentNpc=null;ctx.paused=true;ctx.releaseInput();ctx.audio.pause(true,ctx.backgrounded);ctx.rosterPicker.show();
 }
 ctx.titleScreen=createTitleScreen($('loading'),{onBegin:chooseMode,onResume:resumeFromMainMenu,onChangeCharacter:openRoster});
 ctx.journeysMenu=createJourneysMenu({store:ctx.journeyStore,onNew:chooseJourneyCharacter,onContinue:continueJourney,onBack:showModeChoice});
 setModeChoiceInert(true);
 $('connection-back').onclick=returnToModeChoice;
 windowTarget.addEventListener('pagehide',()=>{ctx.autosave?.emergency();ctx.autosave?.exit().catch(()=>{});ctx.network?.close();});
 windowTarget.addEventListener('pageshow',event=>{if(event.persisted)location.reload();});
 return {setModeChoiceInert,showModeChoice,chooseMode,openJourneys,chooseJourneyCharacter,chooseCharacter,beginJourney,continueJourney,attachAutosave,updateSaveStatus,saveAndExit,stopJourneySession,startSession,returnToModeChoice,mainMenuSession,openMainMenu,resumeFromMainMenu,closeRoster,dismissMainMenu,syncPlayerCharacter,openRoster};
}
