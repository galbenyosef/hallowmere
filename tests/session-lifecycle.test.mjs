import test from 'node:test';
import assert from 'node:assert/strict';
import {registerHooks} from 'node:module';
import {createConnectionUi} from '../dist/connection-ui.js';
import {installGlobals} from './helpers/dom.mjs';

// The session matrix M9 owns: solo -> journey -> save & exit -> continue; multiplayer ->
// disconnect -> retry; main menu -> roster -> cancel. dist/session-lifecycle.js reaches
// character-portraits.js/model-kit.js through syncPlayerCharacter, and those import the bare
// 'three' specifier only the page's import map resolves; match it in Node the way
// tests/nightblade-appearance.test.mjs does.
const hook=registerHooks({resolve(specifier,context,nextResolve){
 if(specifier==='three')return nextResolve(new URL('../dist/vendor/three.module.js',import.meta.url).href,context);
 if(specifier==='three/addons/utils/BufferGeometryUtils.js')return nextResolve(new URL('../dist/vendor/utils/BufferGeometryUtils.js',import.meta.url).href,context);
 return nextResolve(specifier,context);
}});
const {createSessionLifecycle}=await import('../dist/session-lifecycle.js');
hook.deregister();

function element(id){
 return {id,hidden:false,disabled:false,inert:undefined,textContent:'',tabIndex:0,dataset:{},children:[],
  classList:{add(){},remove(){},toggle(){}},focus(){this.focusCalls=(this.focusCalls||0)+1;},closest(){return this;}};
}
// One node map behind both dist/dom.js's global $ and the injected documentTarget, so the two
// querySelectorAll sweeps (updateSaveStatus, saveAndExit) see the same elements $ hands out.
function harness(t,{mode='single-player'}={}){
 const nodes=new Map(),calls=[];
 const $=id=>{if(!nodes.has(id))nodes.set(id,element(id));return nodes.get(id);};
 $('game').children=[$('world'),$('loading')];
 const saveStatusNodes=[$('journey-save-indicator'),element('data-save-status')];
 const exitButtons=[element('data-save-exit'),element('data-resume-game')];
 const documentTarget={getElementById:$,querySelectorAll:selector=>selector.includes('data-save-status')?saveStatusNodes:exitButtons};
 installGlobals(t,{document:documentTarget,location:{reload(){calls.push(['location.reload']);}}});

 const sessions=[];
 class Session{
  constructor(callbacks){this.callbacks=callbacks;this.connected=false;this.sent=[];sessions.push(this);}
  start(){this.started=true;this.connected=true;}
  close(){this.closed=true;this.connected=false;}
  capture(){return {captured:true};}
  send(type,payload){this.sent.push([type,payload]);return this.connected;}
 }
 const transports={LocalSession:class extends Session{constructor({save,...callbacks}){super(callbacks);this.save=save;}},MultiplayerClient:class extends Session{}};

 const autosaves=[],control={failAutosave:false};
 const createAutosave=options=>{if(control.failAutosave)throw Error('autosave unavailable');const a={options,exitCalls:0,stopCalls:0,emergencyCalls:0,
  stop(){this.stopCalls++;},async exit(){this.exitCalls++;},changed(){},emergency(){this.emergencyCalls++;},async flush(){}};autosaves.push(a);return a;};

 const journeyStore={created:[],acquired:[],released:[],record:{id:'journey-1',data:{save:'blob'}},
  async create(journey){this.created.push(journey);return {...this.record,journey};},
  async acquire(id){this.acquired.push(id);return {...this.record,id,recovered:this.recovered};},
  async release(id){this.released.push(id);}};
 const journeysMenu={shown:[],conflicts:[],show(id){this.shown.push(id);},showConflict(message,resume){this.conflicts.push([message,resume]);}};
 const titleScreen={sessions:[],showModes(){this.screen='modes';},hide(){this.screen='hidden';$('loading').hidden=true;},
  showMainMenu(session){this.screen='main-menu';this.sessions.push(session);$('loading').hidden=false;},
  updateSession(session){this.sessions.push(session);}};
 const rosterPicker={open:false,shown:[],resolved:[],show(options){this.shown.push(options);this.open=true;},resolve(result){this.resolved.push(result);this.open=false;}};

 const ctx={paused:false,backgrounded:false,mapExpanded:false,modalKind:'',currentNpc:null,ready:false,started:false,
  state:{classId:'sorcerer',ended:false},lastSnapshot:null,lastNetworkEvent:0,network:null,sessionMode:null,sessionGeneration:0,
  assetsReady:true,mainMenuOpen:false,cavePreviewStarted:false,previewMode:false,journeyStore,rosterPicker,
  accumulated:3,uiTimer:3,audioTimer:3,dodgeTime:3,shake:3,resetMovement:false,victoryShown:true,victoryTimer:undefined,
  saveStatus:{kind:'saved',message:'All progress saved'},saveIndicatorTimer:undefined,
  movementCorrection:{reset(){calls.push(['movementCorrection.reset']);}},moveTarget:{},movePath:[1],
  clock:{getDelta(){calls.push(['clock.getDelta']);}},audio:{pause(...a){calls.push(['audio.pause',...a]);}},
  safeHere:()=>true,syncAudioState(...a){calls.push(['syncAudioState',...a]);},toast(message){calls.push(['toast',message]);},
  releaseInput(){calls.push(['releaseInput']);},toggleMap(){calls.push(['toggleMap']);},
  toggleMapForDeath(){calls.push(['toggleMapForDeath']);},inventoryPreviews:{hide(){calls.push(['inventoryPreviews.hide']);}},
  awaken(){calls.push(['awaken']);},applySnapshot(snapshot){calls.push(['applySnapshot',snapshot]);}};

 const api=createSessionLifecycle(ctx,{windowTarget:{addEventListener(){}},documentTarget,
  createTitleScreen:()=>titleScreen,createJourneysMenu:()=>journeysMenu,
  LocalSession:transports.LocalSession,MultiplayerClient:transports.MultiplayerClient,
  createAutosave,createJourney:choice=>({classId:choice.classId,fresh:true})});
 Object.assign(ctx,api);
 t.after(()=>clearTimeout(ctx.saveIndicatorTimer));
 if(mode==='connection')Object.assign(ctx,createConnectionUi(ctx));
 return {$,ctx,api,calls,control,sessions,transports,autosaves,journeyStore,journeysMenu,titleScreen,rosterPicker,saveStatusNodes,exitButtons};
}

test('solo journey: create, save & exit, and continue move the store, the autosave, and the DOM together',async t=>{
 const {$,ctx,api,sessions,transports,autosaves,journeyStore,journeysMenu,titleScreen,rosterPicker,saveStatusNodes,exitButtons}=harness(t);
 // The factory's own import-time statements ran: the mode choice is inert and the menus exist.
 assert.equal($('world').inert,true);assert.equal($('loading').inert,undefined);
 assert.equal(ctx.titleScreen,titleScreen);assert.equal(ctx.journeysMenu,journeysMenu);

 api.chooseMode('single-player');
 assert.deepEqual(journeysMenu.shown,[undefined]);assert.equal(sessions.length,0);
 assert.equal(titleScreen.screen,'hidden');assert.equal(ctx.ready,false);

 api.chooseJourneyCharacter();
 assert.equal(ctx.creatingJourney,true);assert.deepEqual(rosterPicker.shown,[{journey:true}]);
 assert.equal(api.chooseCharacter({classId:'ranger'}),true);
 await new Promise(resolve=>setTimeout(resolve,0));
 assert.deepEqual(journeyStore.created,[{classId:'ranger',fresh:true}]);
 assert.equal(ctx.activeJourney.id,'journey-1');assert.equal(ctx.creatingJourney,false);
 assert.deepEqual(rosterPicker.resolved,[{ok:true}]);
 assert.equal(sessions.length,1);assert.ok(sessions[0] instanceof transports.LocalSession);
 assert.deepEqual(sessions[0].save,{save:'blob'});assert.equal(sessions[0].started,true);
 assert.equal(ctx.sessionMode,'single-player');assert.equal(ctx.ready,true);assert.equal($('world').inert,false);
 assert.equal(autosaves.length,1);assert.equal(autosaves[0].options.record.id,'journey-1');
 assert.deepEqual(autosaves[0].options.getSave(),{captured:true});

 // onStatus is updateSaveStatus: every [data-save-status] node and the indicator follow it.
 autosaves[0].options.onStatus({kind:'saving',message:'Saving…'});
 assert.deepEqual(saveStatusNodes.map(n=>n.textContent),['Saving…','Saving…']);
 assert.deepEqual(saveStatusNodes.map(n=>n.dataset.kind),['saving','saving']);
 assert.equal($('journey-save-indicator').hidden,false);

 const journeySession=ctx.network;
 await api.saveAndExit();
 assert.equal(autosaves[0].exitCalls,1);assert.equal(autosaves[0].stopCalls,1);
 assert.equal(journeySession.closed,true);assert.equal(ctx.network,null);assert.equal(ctx.autosave,null);
 assert.equal(ctx.activeJourney,null);assert.equal(ctx.sessionMode,null);assert.equal(ctx.ready,false);
 assert.equal(ctx.journeyLeaving,false);assert.deepEqual(exitButtons.map(b=>b.disabled),[false,false]);
 for(const id of ['modal-shade','journey-save-indicator','connection-overlay','restart-vote'])assert.equal($(id).hidden,true);
 assert.deepEqual(journeysMenu.shown,[undefined,'journey-1']);

 journeyStore.recovered=true;
 await api.continueJourney('journey-1');
 assert.deepEqual(journeyStore.acquired,['journey-1']);
 assert.equal(ctx.activeJourney.id,'journey-1');assert.equal(ctx.sessionMode,'single-player');
 assert.equal(sessions.length,2);assert.equal(sessions[1].started,true);assert.equal(autosaves.length,2);
 assert.deepEqual(journeyStore.released,[]);
});

test('a journey that cannot be created or resumed is released and never leaves a live session behind',async t=>{
 const {ctx,api,control,sessions,journeyStore,rosterPicker}=harness(t);
 const failedCreate=journeyStore.create;journeyStore.create=async()=>{throw Error('disk full');};
 api.chooseJourneyCharacter();api.chooseCharacter({classId:'ranger'});
 await new Promise(resolve=>setTimeout(resolve,0));
 assert.equal(sessions.length,0);assert.equal(ctx.activeJourney,null);
 assert.deepEqual(rosterPicker.resolved,[{ok:false,reason:'disk full'}]);
 assert.deepEqual(journeyStore.released,[]);// nothing was ever acquired

 // A journey that is created but cannot be armed stops its session and hands the record back.
 journeyStore.create=failedCreate;control.failAutosave=true;
 api.chooseJourneyCharacter();api.chooseCharacter({classId:'ranger'});
 await new Promise(resolve=>setTimeout(resolve,0));
 assert.equal(sessions.length,1);assert.equal(sessions[0].closed,true);
 assert.deepEqual(journeyStore.released,['journey-1']);
 assert.equal(ctx.activeJourney,null);assert.equal(ctx.network,null);assert.equal(ctx.sessionMode,null);
 assert.deepEqual(rosterPicker.resolved.at(-1),{ok:false,reason:'autosave unavailable'});

 // The same failure on the resume path rethrows to the journeys menu after releasing the id.
 await assert.rejects(api.continueJourney('journey-2'),/autosave unavailable/);
 assert.deepEqual(journeyStore.released,['journey-1','journey-2']);
 assert.equal(ctx.activeJourney,null);assert.equal(ctx.network,null);
});

test('multiplayer disconnect then retry closes the stale client and opens exactly one new one',t=>{
 const {$,ctx,api,sessions,transports,calls}=harness(t,{mode:'connection'});
 api.startSession('multiplayer');
 const stale=sessions[0];assert.ok(stale instanceof transports.MultiplayerClient);
 assert.equal(ctx.sessionMode,'multiplayer');assert.equal($('world').inert,false);

 // The transport reports the drop through the callback startSession handed it.
 stale.connected=false;stale.callbacks.onStatus('Reconnecting to game',false,{retryable:true});
 assert.equal($('connection-overlay').hidden,false);assert.equal($('connection-retry').hidden,false);
 assert.equal($('connection-back').hidden,false);// no snapshot yet, so backing out is still allowed

 $('connection-retry').onclick();
 assert.equal(stale.closed,true);assert.equal(sessions.length,2);
 assert.ok(sessions[1] instanceof transports.MultiplayerClient);assert.equal(sessions[1].started,true);
 assert.equal(ctx.sessionMode,'multiplayer');assert.equal(ctx.network,sessions[1]);
 assert.deepEqual(calls.filter(c=>c[0]==='location.reload'),[]);

 // A retry after the first snapshot reloads the page instead of rebuilding the session.
 ctx.lastSnapshot={};$('connection-retry').onclick();
 assert.deepEqual(calls.filter(c=>c[0]==='location.reload'),[['location.reload']]);
 assert.equal(sessions.length,2);assert.equal(sessions[1].closed,undefined);

 // Late callbacks from the stale generation are dropped.
 stale.callbacks.onSnapshot({late:true});
 assert.deepEqual(calls.filter(c=>c[0]==='applySnapshot'),[]);
 sessions[1].callbacks.onSnapshot({live:true});
 assert.deepEqual(calls.filter(c=>c[0]==='applySnapshot'),[['applySnapshot',{live:true}]]);
});

test('main menu to roster and back: cancelling the picker returns to the menu with the session intact',t=>{
 const {$,ctx,api,sessions,titleScreen,rosterPicker}=harness(t);
 api.startSession('multiplayer');ctx.network.connected=true;ctx.lastSnapshot={};
 api.openMainMenu();
 assert.equal(ctx.mainMenuOpen,true);assert.equal(ctx.paused,true);assert.equal(ctx.ready,true);
 assert.equal($('world').inert,true);assert.equal($('loading').hidden,false);
 assert.equal(titleScreen.sessions.at(-1).mode,'multiplayer');
 assert.equal(titleScreen.sessions.at(-1).canChangeCharacter,true);
 assert.equal(titleScreen.sessions.at(-1).characterLocked,false);

 api.openRoster();
 assert.deepEqual(rosterPicker.shown,[undefined]);assert.equal(titleScreen.screen,'hidden');
 assert.equal(ctx.paused,true);assert.equal(ctx.modalKind,'');assert.equal($('modal-shade').hidden,true);

 rosterPicker.open=false;api.closeRoster();
 assert.equal(ctx.mainMenuOpen,true);assert.equal(ctx.paused,true);assert.equal($('loading').hidden,false);
 assert.equal(titleScreen.screen,'main-menu');assert.equal(titleScreen.sessions.at(-1).canChangeCharacter,true);
 assert.equal(ctx.network,sessions[0]);assert.equal(sessions[0].closed,undefined);assert.equal(sessions.length,1);

 api.resumeFromMainMenu();
 assert.equal(ctx.mainMenuOpen,false);assert.equal(ctx.paused,false);
 assert.equal($('world').inert,false);assert.equal($('loading').inert,false);assert.equal($('loading').hidden,true);
 assert.equal(ctx.network,sessions[0]);assert.equal(ctx.lastSnapshot !==null,true);

 // A journey roster cancel goes back to the journeys menu instead of the main menu.
 ctx.creatingJourney=true;api.closeRoster();
 assert.equal(ctx.creatingJourney,false);assert.equal(ctx.ready,false);
});

test('stopJourneySession clears the run, the timers, and every overlay the session owned',t=>{
 const {$,ctx,api,calls}=harness(t);
 api.startSession('single-player');ctx.lastSnapshot={};ctx.lastNetworkEvent=9;ctx.mainMenuOpen=true;
 const session=ctx.network,generation=ctx.sessionGeneration;
 api.stopJourneySession();
 assert.equal(session.closed,true);assert.equal(ctx.network,null);assert.equal(ctx.autosave,null);
 assert.equal(ctx.sessionGeneration,generation+1);assert.equal(ctx.ready,false);assert.equal(ctx.started,false);
 assert.equal(ctx.activeJourney,null);assert.equal(ctx.sessionMode,null);assert.equal(ctx.lastSnapshot,null);
 assert.equal(ctx.lastNetworkEvent,0);assert.equal(ctx.mainMenuOpen,false);assert.equal(ctx.journeyConflict,false);
 assert.equal(ctx.victoryShown,false);assert.equal(ctx.cavePreviewStarted,false);
 assert.equal(ctx.modalKind,'');assert.equal(ctx.currentNpc,null);
 for(const id of ['modal-shade','journey-save-indicator','connection-overlay','restart-vote'])assert.equal($(id).hidden,true);
 assert.equal(ctx.accumulated,0);assert.equal(ctx.uiTimer,0);assert.equal(ctx.audioTimer,0);
 assert.equal(ctx.dodgeTime,0);assert.equal(ctx.shake,0);assert.equal(ctx.resetMovement,true);
 assert.deepEqual(calls.filter(c=>c[0]==='inventoryPreviews.hide'),[['inventoryPreviews.hide']]);
 assert.deepEqual(calls.filter(c=>c[0]==='toggleMapForDeath'),[['toggleMapForDeath']]);
});
