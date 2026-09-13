import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';

// Exercise the real entrypoint's mode transitions without requiring WebGL.
const main=await readFile(new URL('../dist/main.js',import.meta.url),'utf8');
const transitions=main.slice(main.indexOf('function setModeChoiceInert'),main.indexOf("$('single-player').onclick"));
function setup(){
 const nodes=new Map();const $=id=>{if(!nodes.has(id))nodes.set(id,{id,hidden:false,classList:{remove(){}},focus(){},children:[]});return nodes.get(id);};
 $('game').children=[$('world'),$('loading')];const sessions=[],snapshots=[],statuses=[];
 class Session{constructor(callbacks){this.callbacks=callbacks;sessions.push(this);}start(){this.started=true;}close(){this.closed=true;}}
 const context=vm.createContext({$,ready:false,sessionMode:null,assetsReady:false,sessionGeneration:0,network:null,lastSnapshot:null,moveTarget:null,movePath:[],MultiplayerClient:class extends Session{},LocalSession:class extends Session{},applySnapshot:s=>snapshots.push(s),connectionStatus:s=>statuses.push(s),releaseInput(){},clock:{getDelta(){}},awaken(){}});
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
