import test from 'node:test';
import assert from 'node:assert/strict';
import {registerHooks} from 'node:module';
import {createConnectionUi} from '../dist/connection-ui.js';
import {DEFAULT_CHARACTER} from '../dist/classes.js';
import {readDist} from './helpers/source.mjs';
import {installGlobals} from './helpers/dom.mjs';

// The boot flow (2026-09-21): the loading screen runs straight into play. Solo continues the most
// recent journey or creates a Sorcerer one, ?preview= tours stay unsaved, ?mode=multiplayer joins
// the shared world, and a journey that cannot open hands over to the journeys menu. The mode
// screen this file used to drive is gone. session-lifecycle.js reaches syncPlayerCharacter's
// character-portraits.js/model-kit.js, which import the bare 'three' specifier that only the
// page's import map resolves; match it in Node the way tests/nightblade-appearance.test.mjs does.
const hook=registerHooks({resolve(specifier,context,nextResolve){
 if(specifier==='three')return nextResolve(new URL('../dist/vendor/three.module.js',import.meta.url).href,context);
 if(specifier==='three/addons/utils/BufferGeometryUtils.js')return nextResolve(new URL('../dist/vendor/utils/BufferGeometryUtils.js',import.meta.url).href,context);
 return nextResolve(specifier,context);
}});
const {createSessionLifecycle}=await import('../dist/session-lifecycle.js');
hook.deregister();

// dist/dom.js's $ reads the global document, so one stub document serves the whole file and
// each setup() re-points it at that run's node map; installing it once per test keeps the
// save/restore pairs from stacking when a test calls setup() more than once.
let lookup=()=>{throw Error('setup() has not run');};
const documentStub={getElementById:id=>lookup(id),querySelectorAll:()=>[]};
const installedFor=new WeakSet();
function setup(t){
 const journeyState={activeJourney:null,creatingJourney:false,journeyLeaving:false,journeyConflict:false,autosave:null};
 const nodes=new Map();const $=id=>{if(!nodes.has(id))nodes.set(id,{id,hidden:false,classList:{remove(){}},focus(){this.focusCalls=(this.focusCalls||0)+1;},children:[]});return nodes.get(id);};
 $('game').children=[$('world'),$('loading')];const sessions=[],snapshots=[],statuses=[];
 class Session{constructor({save,...callbacks}){this.callbacks=callbacks;this.save=save;this.sent=[];sessions.push(this);}start(){this.started=true;this.connected=true;}close(){this.closed=true;this.connected=false;}send(type,data){this.sent.push([type,data]);return this.connected;}capture(){return {captured:true};}}
 const transports={LocalSession:class extends Session{},MultiplayerClient:class extends Session{}};
 const titleScreen={showLoading(message,title){this.loading={message,title};$('loading').hidden=false;},hide(){$('loading').hidden=true;},showMainMenu(session){$('loading').hidden=false;this.session=session;},updateSession(session){this.session=session;}};
 const journeyStore={records:[],created:[],acquired:[],released:[],fail:null,conflict:null,
  async list(){if(this.fail)throw Error(this.fail);return this.records;},
  async create(data){this.created.push(data);const record={id:`journey-${this.created.length}`,data,revision:1,savedAt:this.created.length};this.records.unshift(record);return record;},
  async acquire(id){if(this.conflict)throw Error(this.conflict);this.acquired.push(id);const record=this.records.find(r=>r.id===id);if(!record)throw Error('This journey is no longer available.');return {...record};},
  async release(id){this.released.push(id);}};
 const journeysMenu={shown:[],show(id,options){this.shown.push([id,options?.message]);}};
 const world={inSanctuary:true};
 // The names the old vm context injected by name now arrive on ctx, where the moved code reads
 // them: releaseInput/inventoryPreviews/toggleMapForDeath/awaken and the applySnapshot and
 // connectionStatus recorders startSession hands to its transport.
 const ctx={paused:false,backgrounded:false,mapExpanded:false,modalKind:'',currentNpc:null,state:{classId:'sorcerer',gold:81},safeHere:()=>world.inSanctuary,audio:{pause(){}},rosterPicker:{open:false,shown:0,show(){this.shown++;}},ready:false,started:false,network:null,lastSnapshot:null,lastNetworkEvent:0,moveTarget:null,movePath:[],clock:{getDelta(){}},previewMode:false,titleScreen,journeyStore,mainMenuOpen:false,sessionMode:null,assetsReady:false,sessionGeneration:0,defaultCharacterRequested:-1,cavePreviewStarted:false,victoryShown:false,saveStatus:{kind:'saved',message:'All progress saved'},movementCorrection:{reset(){}},syncAudioState(){},toasts:[],toast(message){this.toasts.push(message);},
  releaseInput(){},inventoryPreviews:{hide(){}},toggleMapForDeath(){},toggleMap(){},awaken(){},applySnapshot:s=>snapshots.push(s),connectionStatus:s=>statuses.push(s)};
 Object.assign(ctx,journeyState);
 lookup=$;
 if(!installedFor.has(t)){installedFor.add(t);installGlobals(t,{document:documentStub});}
 const api=createSessionLifecycle(ctx,{windowTarget:{addEventListener(){}},documentTarget:documentStub,
  createTitleScreen:()=>titleScreen,createJourneysMenu:()=>journeysMenu,
  LocalSession:transports.LocalSession,MultiplayerClient:transports.MultiplayerClient,
  createAutosave:()=>({stop(){},exit:async()=>{},changed(){},emergency(){},async flush(){}}),createJourney:choice=>({...choice})});
 Object.assign(ctx,api);
 t.after(()=>clearTimeout(ctx.saveIndicatorTimer));
 return {transports,ctx,api,sessions,snapshots,statuses,$,world,journeyStore,journeysMenu,titleScreen};
}
// enterGame reads the page's query string through globalThis.location, which Node does not define.
function withSearch(t,search){
 const previous=globalThis.location;globalThis.location={search};
 t.after(()=>{if(previous===undefined)delete globalThis.location;else globalThis.location=previous;});
}

test('a first visit creates a Sorcerer journey and enters play with no menu in between',async t=>{
 const {api,ctx,sessions,transports,journeyStore,journeysMenu,titleScreen,$}=setup(t);
 await api.enterGame();assert.equal(sessions.length,0,'nothing starts before the assets are ready');
 ctx.assetsReady=true;await api.enterGame();
 assert.deepEqual(journeyStore.created,[DEFAULT_CHARACTER]);assert.deepEqual(journeyStore.acquired,[]);
 assert.equal(sessions.length,1);assert.ok(sessions[0] instanceof transports.LocalSession);assert.equal(sessions[0].started,true);
 assert.deepEqual(sessions[0].save,DEFAULT_CHARACTER,"the fresh journey record is the local session's save");
 assert.equal(ctx.activeJourney.id,'journey-1');assert.ok(ctx.autosave);assert.equal(ctx.sessionMode,'single-player');assert.equal(ctx.ready,true);
 assert.equal($('loading').hidden,true);assert.equal($('world').inert,false);assert.deepEqual(journeysMenu.shown,[]);
 assert.equal(titleScreen.loading.title,'Entering Hallowmere');
 // A second call while the session runs changes nothing.
 await api.enterGame();assert.equal(sessions.length,1);assert.equal(journeyStore.created.length,1);
});

test('a returning player continues the most recently saved journey',async t=>{
 const {api,ctx,sessions,transports,journeyStore}=setup(t);ctx.assetsReady=true;
 journeyStore.records=[{id:'newest',data:{save:'new'},revision:3,savedAt:9},{id:'older',data:{save:'old'},revision:1,savedAt:2}];
 await api.enterGame();
 assert.deepEqual(journeyStore.acquired,['newest']);assert.deepEqual(journeyStore.created,[]);
 assert.equal(sessions.length,1);assert.ok(sessions[0] instanceof transports.LocalSession);
 assert.deepEqual(sessions[0].save,{save:'new'});assert.equal(ctx.activeJourney.id,'newest');assert.ok(ctx.autosave);
});

test('preview tours start an unsaved local session and ?mode=multiplayer joins the shared world',async t=>{
 const preview=setup(t);preview.ctx.assetsReady=true;preview.ctx.previewMode=true;
 await preview.api.enterGame();
 assert.equal(preview.sessions.length,1);assert.ok(preview.sessions[0] instanceof preview.transports.LocalSession);
 assert.equal(preview.sessions[0].save,undefined);assert.equal(preview.ctx.activeJourney,null);assert.equal(preview.ctx.autosave,null);
 assert.deepEqual(preview.journeyStore.acquired,[]);assert.deepEqual(preview.journeyStore.created,[]);

 withSearch(t,'?mode=multiplayer');
 const multi=setup(t);multi.ctx.assetsReady=true;
 await multi.api.enterGame();
 assert.equal(multi.sessions.length,1);assert.ok(multi.sessions[0] instanceof multi.transports.MultiplayerClient);
 assert.deepEqual(multi.journeyStore.acquired,[]);assert.deepEqual(multi.journeyStore.created,[]);assert.equal(multi.ctx.sessionMode,'multiplayer');
});

test('when the latest journey cannot be opened the journeys menu takes over with the reason',async t=>{
 t.mock.method(console,'error',()=>{});
 const conflict=setup(t);conflict.ctx.assetsReady=true;
 conflict.journeyStore.records=[{id:'busy',data:{},revision:1,savedAt:5}];conflict.journeyStore.conflict='This journey is open in another tab.';
 await conflict.api.enterGame();
 assert.deepEqual(conflict.journeysMenu.shown,[['busy','This journey is open in another tab.']]);
 assert.equal(conflict.sessions.length,0);assert.equal(conflict.ctx.activeJourney,null);assert.equal(conflict.ctx.sessionMode,null);
 assert.equal(conflict.$('loading').hidden,true);assert.equal(conflict.$('world').inert,true);

 const unreadable=setup(t);unreadable.ctx.assetsReady=true;unreadable.journeyStore.fail='Your journeys could not be loaded.';
 await unreadable.api.enterGame();
 assert.deepEqual(unreadable.journeysMenu.shown,[[undefined,'Your journeys could not be loaded.']]);assert.equal(unreadable.sessions.length,0);
});

test('backing out of a pending connection and playing solo discards the old multiplayer callbacks',async t=>{
 const {api,ctx,sessions,transports,snapshots,statuses}=setup(t);ctx.assetsReady=true;api.startSession('multiplayer');const old=sessions[0];assert.ok(old instanceof transports.MultiplayerClient);
 assert.equal(api.leaveSession(),true);assert.equal(old.closed,true);assert.equal(ctx.sessionMode,null);assert.equal(ctx.ready,false);
 await api.enterSolo();assert.equal(sessions.length,2);assert.ok(sessions[1] instanceof transports.LocalSession);
 old.callbacks.onSnapshot({late:true});old.callbacks.onStatus('late');assert.equal(snapshots.length,0);assert.equal(statuses.length,0);
 sessions[1].callbacks.onSnapshot({solo:true});assert.equal(snapshots.length,1);
 ctx.lastSnapshot={};assert.equal(api.leaveSession(),false);assert.equal(ctx.sessionMode,'single-player');assert.equal(sessions[1].closed,undefined);
});

test('a classless session asks for the default character once per session and falls back to the roster',t=>{
 const {api,ctx,sessions}=setup(t);ctx.assetsReady=true;api.startSession('single-player');
 api.chooseDefaultCharacter();api.chooseDefaultCharacter();
 assert.deepEqual(sessions[0].sent,[['select-class',DEFAULT_CHARACTER]]);assert.equal(ctx.rosterPicker.shown,0);
 // A new session asks again; a transport that refuses the request hands over to the roster.
 assert.equal(api.leaveSession(),true);api.startSession('single-player');
 sessions[1].send=()=>false;api.chooseDefaultCharacter();api.chooseDefaultCharacter();
 assert.equal(ctx.rosterPicker.shown,1);assert.equal(ctx.paused,true);
});

test('character changes are gated by mode: anywhere in solo, sanctuaries in multiplayer',t=>{
 const {api,ctx,world}=setup(t);ctx.assetsReady=true;
 assert.equal(api.canChangeCharacter(),false,'no session yet');
 api.startSession('single-player');world.inSanctuary=false;assert.equal(api.canChangeCharacter(),true);
 ctx.state.ended=true;assert.equal(api.canChangeCharacter(),false);ctx.state.ended=false;
 ctx.network.connected=false;assert.equal(api.canChangeCharacter(),false);ctx.network.connected=true;
 ctx.activeJourney={id:'journey-1'};assert.equal(api.canChangeCharacter(),true,'a journey no longer locks its character');
 ctx.activeJourney=null;assert.equal(api.leaveSession(),true);api.startSession('multiplayer');
 assert.equal(api.canChangeCharacter(),false);world.inSanctuary=true;assert.equal(api.canChangeCharacter(),true);
});

test('entrypoint waits for ready assets; repeated starts create only one session',t=>{
 const {api,ctx,sessions,transports,$}=setup(t);assert.equal(sessions.length,0);api.startSession('multiplayer');assert.equal(sessions.length,0);
 ctx.assetsReady=true;assert.equal($('world').inert,true);
 api.startSession('single-player');api.startSession('multiplayer');api.startSession('single-player');assert.equal(sessions.length,1);assert.ok(sessions[0] instanceof transports.LocalSession);assert.equal(sessions[0].started,true);assert.equal($('world').inert,false);
});

test('the page ships no mode choice and the connection overlay offers solo play instead',()=>{
 const html=readDist('index.html');
 assert.doesNotMatch(html,/id="(begin-vigil|mode-choice|single-player|multi-player)"/);
 assert.match(html,/<button id="connection-back"[^>]*>Play solo instead<\/button>/);
 assert.doesNotMatch(readDist('title-screen.css'),/mode-|data-screen=modes/);
});

test('pause to main menu and resume retain the same journey, character, snapshot, and progress',t=>{
 const {api,ctx,sessions,$}=setup(t);ctx.assetsReady=true;api.startSession('single-player');
 const journey={id:'saved-journey'};ctx.activeJourney=journey;
 const session=ctx.network,snapshot={worldId:'current-vigil'};ctx.lastSnapshot=snapshot;
 api.openMainMenu();
 assert.equal(ctx.mainMenuOpen,true);assert.equal(ctx.paused,true);assert.equal(ctx.ready,true);
 assert.equal($('world').inert,true);assert.equal($('loading').hidden,false);
 assert.equal(ctx.network,session);assert.equal(ctx.lastSnapshot,snapshot);assert.equal(ctx.state.gold,81);
 assert.equal(ctx.titleScreen.session.canChangeCharacter,true,'a journey no longer locks its character');assert.equal('characterLocked' in ctx.titleScreen.session,false);
 for(const blocked of ['journeyLeaving','journeyConflict']){
  ctx[blocked]=true;api.resumeFromMainMenu();assert.equal(ctx.mainMenuOpen,true);assert.equal(ctx.paused,true);ctx[blocked]=false;
 }
 api.resumeFromMainMenu();
 assert.equal(ctx.mainMenuOpen,false);assert.equal(ctx.paused,false);assert.equal($('world').inert,false);
 assert.equal($('loading').hidden,true);assert.equal(ctx.network,session);assert.equal(sessions.length,1);
 assert.equal(session.closed,undefined);assert.equal(ctx.state.gold,81);assert.equal(ctx.activeJourney,journey);
});

test('main menu reflects sanctuary restriction and roster closure returns to the menu',t=>{
 const {api,ctx,world,$}=setup(t);ctx.assetsReady=true;api.startSession('multiplayer');ctx.lastSnapshot={};
 world.inSanctuary=false;api.openMainMenu();assert.equal(ctx.titleScreen.session.canChangeCharacter,false);
 world.inSanctuary=true;api.closeRoster();
 assert.equal(ctx.mainMenuOpen,true);assert.equal(ctx.paused,true);assert.equal($('loading').hidden,false);
 assert.equal(ctx.titleScreen.session.canChangeCharacter,true);assert.equal(ctx.sessionMode,'multiplayer');
});

test('main-menu navigation cannot revive a dead or disconnected player',t=>{
 const {api,ctx,$}=setup(t);ctx.assetsReady=true;api.startSession('single-player');ctx.lastSnapshot={};
 ctx.state.ended=true;api.openMainMenu();assert.equal(ctx.mainMenuOpen,false);
 ctx.state.ended=false;api.openMainMenu();ctx.network.connected=false;api.resumeFromMainMenu();
 assert.equal(ctx.mainMenuOpen,true);assert.equal(ctx.paused,true);
 api.dismissMainMenu();assert.equal(ctx.mainMenuOpen,false);assert.equal($('loading').hidden,true);assert.equal($('world').inert,false);
});

// connectionStatus and the connection/restart-vote bindings are dist/connection-ui.js now (M9);
// the same node map backs the module's $ through setup()'s stubbed global document, and the two
// names the old vm context injected by name (releaseInput, inventoryPreviews) arrive on ctx.
test('reconnect controls remain reachable while the main menu is open',t=>{
 const {api,ctx,$}=setup(t);ctx.assetsReady=true;api.startSession('multiplayer');ctx.lastSnapshot={};
 api.openMainMenu();ctx.rosterPicker.resolve=()=>{};
 Object.assign(ctx,createConnectionUi(ctx));
 const {connectionStatus}=ctx;
 connectionStatus('Reconnecting',false);
 assert.equal($('loading').inert,true);assert.equal($('connection-title').focusCalls,1);
 connectionStatus('Unable to connect',false,{retryable:true,failed:true});
 assert.equal($('connection-retry').hidden,false);assert.equal($('connection-retry').focusCalls,1);
 connectionStatus('Connected',true);
 assert.equal($('loading').inert,false);assert.equal($('connection-overlay').hidden,true);
 assert.equal($('menu-resume').focusCalls,1);assert.equal(ctx.mainMenuOpen,true);assert.equal(ctx.paused,true);
});
