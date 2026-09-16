import test from 'node:test';
import assert from 'node:assert/strict';
import {registerHooks} from 'node:module';
import {createTitleScreen} from '../dist/title-screen.js';
import {createConnectionUi} from '../dist/connection-ui.js';
import {readDist} from './helpers/source.mjs';
import {installGlobals} from './helpers/dom.mjs';

// M9 moved this file's two vm slices into dist/session-lifecycle.js and dist/connection-ui.js,
// so the real entrypoint's mode transitions are exercised through the factories instead of
// through vm-evaluated source text. session-lifecycle.js reaches syncPlayerCharacter's
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
 class Session{constructor(callbacks){this.callbacks=callbacks;sessions.push(this);}start(){this.started=true;this.connected=true;}close(){this.closed=true;this.connected=false;}}
 const transports={LocalSession:class extends Session{},MultiplayerClient:class extends Session{}};
 const titleScreen={showModes(){},hide(){$('loading').hidden=true;},showMainMenu(session){$('loading').hidden=false;this.session=session;},updateSession(session){this.session=session;}};
 const world={inSanctuary:true};
 // The names the old vm context injected by name now arrive on ctx, where the moved code reads
 // them: releaseInput/inventoryPreviews/toggleMapForDeath/awaken and the applySnapshot and
 // connectionStatus recorders startSession hands to its transport.
 const ctx={paused:false,backgrounded:false,mapExpanded:false,modalKind:'',currentNpc:null,state:{classId:'sorcerer',gold:81},safeHere:()=>world.inSanctuary,audio:{pause(){}},rosterPicker:{open:false},ready:false,network:null,lastSnapshot:null,moveTarget:null,movePath:[],clock:{getDelta(){}},previewMode:false,titleScreen,mainMenuOpen:false,sessionMode:null,assetsReady:false,sessionGeneration:0,syncAudioState(){},toast(){},
  releaseInput(){},inventoryPreviews:{hide(){}},toggleMapForDeath(){},toggleMap(){},awaken(){},applySnapshot:s=>snapshots.push(s),connectionStatus:s=>statuses.push(s)};
 Object.assign(ctx,journeyState);
 lookup=$;
 if(!installedFor.has(t)){installedFor.add(t);installGlobals(t,{document:documentStub});}
 const api=createSessionLifecycle(ctx,{windowTarget:{addEventListener(){}},documentTarget:documentStub,
  createTitleScreen:()=>titleScreen,createJourneysMenu:()=>({show(){}}),
  LocalSession:transports.LocalSession,MultiplayerClient:transports.MultiplayerClient,
  createAutosave:()=>({stop(){},exit:async()=>{},changed(){}}),createJourney:choice=>choice});
 Object.assign(ctx,api);
 return {transports,ctx,api,sessions,snapshots,statuses,$,world};
}

function titleHarness(onBegin){
 const ids=['single-player','multi-player','mode-choice','main-menu-actions','loading-status','loading-retry','menu-resume','menu-change-character','menu-character-note','loading-message','loading-title','load-fill','load-track','load-percent'];
 const buttonIds=['single-player','multi-player','menu-resume','menu-change-character','loading-retry'];
 const nodes=new Map(),handlers={};let focused;
 const root={hidden:false,dataset:{screen:'loading'},querySelector:selector=>nodes.get(selector.slice(1)),querySelectorAll:()=>buttonIds.map(id=>nodes.get(id)).filter(b=>!b.disabled),addEventListener:(event,handler)=>{handlers[event]=handler;}};
 for(const id of ids)nodes.set(id,{id,hidden:false,dataset:{},style:{},tabIndex:0,setAttribute(key,value){this[key]=value;},focus(){focused=this;this.onfocus?.();},closest(){if(root.hidden||this.hidden)return root;const parent=['single-player','multi-player'].includes(id)?'mode-choice':['menu-resume','menu-change-character'].includes(id)?'main-menu-actions':null;return parent&&nodes.get(parent).hidden?nodes.get(parent):null;}});
 const screen=createTitleScreen(root,{onBegin,onResume(){},onChangeCharacter(){}});
 return {screen,root,node:id=>nodes.get(id),focused:()=>focused,key(key,shiftKey=false){const event={key,shiftKey,target:focused,defaultPrevented:false,preventDefault(){this.defaultPrevented=true;}};handlers.keydown(event);return event;}};
}

test('mode cards highlight on hover without starting, and one click starts exactly the chosen mode',t=>{
 for(const [id,Session] of [['single-player','LocalSession'],['multi-player','MultiplayerClient']]){
  const {transports,ctx,api,sessions}=setup(t);
  const ui=titleHarness(mode=>api.startSession(mode));ctx.titleScreen=ui.screen;ctx.assetsReady=true;api.showModeChoice();
  const other=id==='single-player'?'multi-player':'single-player';
  ui.node(other).onpointerenter();ui.node(id).onpointerenter();
  assert.equal(ui.node(id).dataset.highlighted,'true');assert.equal(ui.node(other).dataset.highlighted,'false');
  assert.equal(sessions.length,0);assert.equal(ui.root.hidden,false);
  ui.node(id).onclick();ui.node(id).onclick();ui.node(other).onclick();
  assert.equal(sessions.length,1);assert.ok(sessions[0] instanceof transports[Session]);
  assert.equal(sessions[0].started,true);assert.equal(ui.root.hidden,true);
 }
});

test('keyboard focus controls the mode highlight and native Enter/Space activation is not doubled',async()=>{
 const modes=[],ui=titleHarness(mode=>modes.push(mode));ui.screen.showModes();
 assert.equal(ui.focused(),ui.node('single-player'));
 ui.node('multi-player').onpointerenter();assert.equal(ui.focused(),ui.node('single-player'));
 assert.equal(ui.key('ArrowRight').defaultPrevented,true);assert.equal(ui.focused(),ui.node('multi-player'));
 ui.key('Home');assert.equal(ui.focused(),ui.node('single-player'));assert.equal(ui.node('single-player').dataset.highlighted,'true');
 ui.key('Tab',true);assert.equal(ui.focused(),ui.node('multi-player'));
 ui.key('Tab');assert.equal(ui.focused(),ui.node('single-player'));
 for(const key of ['Enter',' ']){
  const before=modes.length;assert.equal(ui.key(key).defaultPrevented,false);assert.equal(modes.length,before);
  ui.focused().onclick();assert.equal(modes.length,before+1);assert.equal(modes.at(-1),'single-player');
 }
 const html=readDist('index.html');
 assert.doesNotMatch(html,/id="begin-vigil"/);
 for(const id of ['single-player','multi-player'])assert.match(html,new RegExp(`<button id="${id}"[^>]*type="button"`));
});

test('entrypoint waits for ready assets and an explicit choice; repeated clicks create only one session',t=>{
 const {api,ctx,sessions,transports,$}=setup(t);assert.equal(sessions.length,0);api.startSession('multiplayer');assert.equal(sessions.length,0);
 ctx.assetsReady=true;api.showModeChoice();assert.equal(sessions.length,0);assert.equal($('world').inert,true);
 api.startSession('single-player');api.startSession('multiplayer');api.startSession('single-player');assert.equal(sessions.length,1);assert.ok(sessions[0] instanceof transports.LocalSession);assert.equal(sessions[0].started,true);assert.equal($('world').inert,false);
});

test('ordinary solo opens saved journeys while preview tours start an unsaved session',t=>{
 const {api,ctx,sessions}=setup(t);let menus=0;ctx.assetsReady=true;ctx.journeysMenu={show(){menus++;}};
 api.chooseMode('single-player');assert.equal(menus,1);assert.equal(sessions.length,0);
 ctx.previewMode=true;api.chooseMode('single-player');
 assert.equal(menus,1);assert.equal(sessions.length,1);assert.equal(ctx.activeJourney,null);assert.equal(ctx.autosave,null);
});

test('returning from connection and choosing solo discards old multiplayer callbacks',t=>{
 const {api,ctx,sessions,transports,snapshots,statuses}=setup(t);ctx.assetsReady=true;api.startSession('multiplayer');const old=sessions[0];assert.ok(old instanceof transports.MultiplayerClient);
 api.returnToModeChoice();api.startSession('single-player');assert.equal(old.closed,true);assert.equal(sessions.length,2);
 old.callbacks.onSnapshot({late:true});old.callbacks.onStatus('late');assert.equal(snapshots.length,0);assert.equal(statuses.length,0);
 sessions[1].callbacks.onSnapshot({solo:true});assert.equal(snapshots.length,1);
 ctx.lastSnapshot={};api.returnToModeChoice();assert.equal(ctx.sessionMode,'single-player');assert.equal(sessions[1].closed,undefined);
});

test('pause to main menu and resume retain the same journey, character, snapshot, and progress',t=>{
 const {api,ctx,sessions,$}=setup(t);ctx.assetsReady=true;api.startSession('single-player');
 const journey={id:'saved-journey'};ctx.activeJourney=journey;
 const session=ctx.network,snapshot={worldId:'current-vigil'};ctx.lastSnapshot=snapshot;
 api.openMainMenu();
 assert.equal(ctx.mainMenuOpen,true);assert.equal(ctx.paused,true);assert.equal(ctx.ready,true);
 assert.equal($('world').inert,true);assert.equal($('loading').hidden,false);
 assert.equal(ctx.network,session);assert.equal(ctx.lastSnapshot,snapshot);assert.equal(ctx.state.gold,81);
 assert.equal(ctx.titleScreen.session.canChangeCharacter,false);assert.equal(ctx.titleScreen.session.characterLocked,true);
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
