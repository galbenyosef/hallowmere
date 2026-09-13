import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';

// Exercise the real entrypoint's mode transitions without requiring WebGL.
const main=await readFile(new URL('../dist/main.js',import.meta.url),'utf8');
const transitions=main.slice(main.indexOf('function setModeChoiceInert'),main.indexOf("$('single-player').onclick"));
function setup(){
 const nodes=new Map();const $=id=>{if(!nodes.has(id))nodes.set(id,{id,hidden:false,classList:{remove(){}},focus(){this.focusCalls=(this.focusCalls||0)+1;},children:[]});return nodes.get(id);};
 $('game').children=[$('world'),$('loading')];const sessions=[],snapshots=[],statuses=[];
 class Session{constructor(callbacks){this.callbacks=callbacks;sessions.push(this);}start(){this.started=true;this.connected=true;}close(){this.closed=true;this.connected=false;}}
 const titleScreen={showModes(){},hide(){$('loading').hidden=true;},showMainMenu(session){$('loading').hidden=false;this.session=session;},updateSession(session){this.session=session;}};
 const context=vm.createContext({$,titleScreen,mainMenuOpen:false,paused:false,backgrounded:false,mapExpanded:false,modalKind:'',currentNpc:null,state:{classId:'sorcerer',gold:81},inSanctuary:true,safeHere:()=>context.inSanctuary,classFor:()=>({name:'Sorcerer'}),inventoryPreviews:{hide(){}},audio:{pause(){}},rosterPicker:{open:false},ready:false,sessionMode:null,assetsReady:false,sessionGeneration:0,network:null,lastSnapshot:null,moveTarget:null,movePath:[],MultiplayerClient:class extends Session{},LocalSession:class extends Session{},applySnapshot:s=>snapshots.push(s),connectionStatus:s=>statuses.push(s),releaseInput(){},clock:{getDelta(){}},awaken(){}});
 vm.runInContext(transitions,context);return {context,sessions,snapshots,statuses,$,run:code=>vm.runInContext(code,context)};
}

test('entrypoint waits for ready assets and an explicit choice; repeated clicks create only one session',()=>{
 const {run,sessions,context,$}=setup();assert.equal(sessions.length,0);run("startSession('multiplayer')");assert.equal(sessions.length,0);
 context.assetsReady=true;run('showModeChoice()');assert.equal(sessions.length,0);assert.equal($('world').inert,true);
 run("startSession('single-player');startSession('multiplayer');startSession('single-player')");assert.equal(sessions.length,1);assert.ok(sessions[0] instanceof context.LocalSession);assert.equal(sessions[0].started,true);assert.equal($('world').inert,false);
});

test('returning from connection and choosing solo discards old multiplayer callbacks',()=>{
 const {run,sessions,context,snapshots,statuses}=setup();context.assetsReady=true;run("startSession('multiplayer')");const old=sessions[0];assert.ok(old instanceof context.MultiplayerClient);
 run("returnToModeChoice();startSession('single-player')");assert.equal(old.closed,true);assert.equal(sessions.length,2);
 old.callbacks.onSnapshot({late:true});old.callbacks.onStatus('late');assert.equal(snapshots.length,0);assert.equal(statuses.length,0);
 sessions[1].callbacks.onSnapshot({solo:true});assert.equal(snapshots.length,1);
 context.lastSnapshot={};run('returnToModeChoice()');assert.equal(context.sessionMode,'single-player');assert.equal(sessions[1].closed,undefined);
});

test('pause to main menu and resume retain the same session, snapshot, and progress',()=>{
 const {run,sessions,context,$}=setup();context.assetsReady=true;run("startSession('single-player')");
 const session=context.network,snapshot={worldId:'current-vigil'};context.lastSnapshot=snapshot;
 run('openMainMenu()');
 assert.equal(context.mainMenuOpen,true);assert.equal(context.paused,true);assert.equal(context.ready,true);
 assert.equal($('world').inert,true);assert.equal($('loading').hidden,false);
 assert.equal(context.network,session);assert.equal(context.lastSnapshot,snapshot);assert.equal(context.state.gold,81);
 assert.equal(context.titleScreen.session.canChangeCharacter,true);
 run('resumeFromMainMenu()');
 assert.equal(context.mainMenuOpen,false);assert.equal(context.paused,false);assert.equal($('world').inert,false);
 assert.equal($('loading').hidden,true);assert.equal(context.network,session);assert.equal(sessions.length,1);
 assert.equal(session.closed,undefined);assert.equal(context.state.gold,81);
});

test('main menu reflects sanctuary restriction and roster closure returns to the menu',()=>{
 const {run,context,$}=setup();context.assetsReady=true;run("startSession('multiplayer')");context.lastSnapshot={};
 context.inSanctuary=false;run('openMainMenu()');assert.equal(context.titleScreen.session.canChangeCharacter,false);
 context.inSanctuary=true;run('closeRoster()');
 assert.equal(context.mainMenuOpen,true);assert.equal(context.paused,true);assert.equal($('loading').hidden,false);
 assert.equal(context.titleScreen.session.canChangeCharacter,true);assert.equal(context.sessionMode,'multiplayer');
});

test('main-menu navigation cannot revive a dead or disconnected player',()=>{
 const {run,context,$}=setup();context.assetsReady=true;run("startSession('single-player')");context.lastSnapshot={};
 context.state.ended=true;run('openMainMenu()');assert.equal(context.mainMenuOpen,false);
 context.state.ended=false;run('openMainMenu()');context.network.connected=false;run('resumeFromMainMenu()');
 assert.equal(context.mainMenuOpen,true);assert.equal(context.paused,true);
 run('dismissMainMenu()');assert.equal(context.mainMenuOpen,false);assert.equal($('loading').hidden,true);assert.equal($('world').inert,false);
});


test('reconnect controls remain reachable while the main menu is open',()=>{
 const {run,context,$}=setup();context.assetsReady=true;run("startSession('multiplayer')");context.lastSnapshot={};
 run('openMainMenu()');context.rosterPicker.resolve=()=>{};
 run(main.slice(main.indexOf('function connectionStatus('),main.indexOf("$('connection-retry').onclick")));
 run("connectionStatus('Reconnecting',false)");
 assert.equal($('loading').inert,true);assert.equal($('connection-title').focusCalls,1);
 run("connectionStatus('Unable to connect',false,{retryable:true,failed:true})");
 assert.equal($('connection-retry').hidden,false);assert.equal($('connection-retry').focusCalls,1);
 run("connectionStatus('Connected',true)");
 assert.equal($('loading').inert,false);assert.equal($('connection-overlay').hidden,true);
 assert.equal($('menu-resume').focusCalls,1);assert.equal(context.mainMenuOpen,true);assert.equal(context.paused,true);
});
