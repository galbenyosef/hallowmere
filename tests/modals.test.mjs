import test from 'node:test';
import assert from 'node:assert/strict';
import {registerHooks} from 'node:module';
import {installGlobals} from './helpers/dom.mjs';

// dist/modals.js transitively imports npc-portraits.js, which imports the bare 'three'
// specifier (it needs WebGLRenderer, which only the full build exports) -- only the page's
// import map resolves that; match it in Node the way tests/inventory-portraits.test.mjs does.
const hook=registerHooks({resolve(specifier,context,nextResolve){
 if(specifier==='three')return nextResolve(new URL('../dist/vendor/three.module.js',import.meta.url).href,context);
 return nextResolve(specifier,context);
}});
const {createModals}=await import('../dist/modals.js');
hook.deregister();

// M8 moved talkTo/renderNpc/serviceNpc/showModal/closeModal/restart/toggleMapForDeath and the
// pause-menu/modal-content/modal-primary/modal-secondary/modal-shade bindings out of main.js.
// A minimal recursive-mock-element document stub (tests/hud.test.mjs's pattern) covers every
// literal $('id')/document.querySelector()/element.closest() this set touches; every element
// resolves through one shared selector map so document.querySelector('.modal') and
// content.closest('.modal') return the same mock instance, matching real DOM semantics.
function makeElement(key,resolveGlobal,doc){
 const el={key,style:{},dataset:{},attrs:{},textContent:'',innerHTML:'',hidden:false,scrollTop:0,onclick:null,listeners:[]};
 const children=new Map();
 el.ownerDocument=doc;
 el.classList={added:[],removed:[],toggled:[],
  add(...c){this.added.push(...c);},remove(...c){this.removed.push(...c);},
  toggle(c,force){this.toggled.push([c,force]);}};
 el.setAttribute=(k,v)=>{el.attrs[k]=v;};
 el.getAttribute=k=>el.attrs[k];
 el.removeAttribute=k=>{delete el.attrs[k];};
 el.addEventListener=(event,handler)=>{el.listeners.push([event,handler]);};
 el.querySelector=sel=>{if(!children.has(sel))children.set(sel,makeElement(sel,resolveGlobal,doc));return children.get(sel);};
 el.querySelectorAll=()=>[];
 el.closest=sel=>resolveGlobal(sel);
 el.contains=()=>false;
 el.focus=()=>{el.focusCalls=(el.focusCalls||0)+1;};
 return el;
}
function stubDocument(){
 const byId=new Map(),byQuery=new Map();
 const doc={activeElement:undefined};
 const resolve=sel=>{if(!byQuery.has(sel))byQuery.set(sel,makeElement(sel,resolve,doc));return byQuery.get(sel);};
 doc.getElementById=id=>{if(!byId.has(id))byId.set(id,makeElement(id,resolve,doc));return byId.get(id);};
 doc.querySelector=resolve;
 doc.querySelectorAll=()=>[];
 return doc;
}

// A self-consistent, fully-wired ctx: every field/function the seven moved functions and the
// three import-time bindings can reach, so any one of them can be exercised in isolation.
function makeCtx(){
 const ctx={
  mainMenuOpen:false,ready:true,network:{connected:true,sendCalls:[],send(type,payload){this.sendCalls.push([type,payload]);return this.connected;}},
  mapExpanded:false,state:{ended:false,gold:10,potions:2,talkedTo:[]},modalKind:'',previousFocus:null,paused:false,
  backgrounded:false,activeJourney:null,gameSettings:{},autosave:null,sessionMode:'single-player',
  currentNpc:null,journeyLeaving:false,journeyConflict:false,rosterPicker:null,renderer:{},scene:{},shake:0,
  life:{visibleNpcs:()=>[]},player:{position:{x:0,z:0}},prefabs:{},
  audio:{playCalls:[],pauseCalls:[],play(...a){this.playCalls.push(a);},pause(...a){this.pauseCalls.push(a);}},
  releaseInputCalls:0,releaseInput(){ctx.releaseInputCalls++;},
  syncAudioStateCalls:0,syncAudioState(){ctx.syncAudioStateCalls++;},
  inventoryPreviews:{hideCalls:0,hide(){this.hideCalls++;}},
  renderInventoryCalls:0,renderInventory(){ctx.renderInventoryCalls++;},
  updateSaveStatusCalls:0,updateSaveStatus(){ctx.updateSaveStatusCalls++;},
  saveAndExit(){},
  resumeFromMainMenuCalls:0,resumeFromMainMenu(){ctx.resumeFromMainMenuCalls++;},
  openRoster(){},equipOwnedItem(){return{ok:true};},consumePouchItem(){return{ok:true};},
  awakenCalls:0,awaken(){ctx.awakenCalls++;},
  safeHere:()=>true,
 };
 return ctx;
}

test('showModal opens a modal: sets ctx.modalKind, shows the shade, pauses the game, hides inventory previews, and calls ctx.releaseInput',t=>{
 const doc=stubDocument();
 installGlobals(t,{document:doc});
 const ctx=makeCtx();
 const {showModal}=createModals(ctx);
 showModal('help');
 assert.equal(ctx.modalKind,'help');
 assert.equal(ctx.paused,true);
 assert.equal(ctx.releaseInputCalls,1);
 assert.equal(ctx.inventoryPreviews.hideCalls,1);
 assert.equal(doc.getElementById('modal-shade').hidden,false);
 assert.deepEqual(ctx.audio.pauseCalls,[[true,false]]);
 assert.deepEqual(ctx.audio.playCalls,[['ui-open',.55]]); // suppressed for death/victory, not exercised here
 assert.equal(doc.getElementById('modal-title').textContent,'Game controls');
 assert.equal(doc.getElementById('modal-primary').textContent,'Close controls');
});

test('showModal is a no-op while not ready/connected, while the map is expanded, or (for a non-death kind) while the main menu is open or the run has ended',t=>{
 const doc=stubDocument();
 installGlobals(t,{document:doc});
 const notReady=makeCtx();notReady.ready=false;
 createModals(notReady).showModal('journal');
 assert.equal(notReady.modalKind,'');
 const offline=makeCtx();offline.network.connected=false;
 createModals(offline).showModal('journal');
 assert.equal(offline.modalKind,'');
 const mapOpen=makeCtx();mapOpen.mapExpanded=true;
 createModals(mapOpen).showModal('journal');
 assert.equal(mapOpen.modalKind,'');
 const menuOpen=makeCtx();menuOpen.mainMenuOpen=true;
 createModals(menuOpen).showModal('journal');
 assert.equal(menuOpen.modalKind,'');
 const ended=makeCtx();ended.state.ended=true;
 createModals(ended).showModal('journal');
 assert.equal(ended.modalKind,'');
 // 'death' is exempt from the mainMenuOpen/ended guards.
 const throughMainMenu=makeCtx();throughMainMenu.mainMenuOpen=true;
 createModals(throughMainMenu).showModal('death');
 assert.equal(throughMainMenu.modalKind,'death');
});

test('closeModal clears ctx.modalKind, hides the shade, unpauses, hides inventory previews, and calls ctx.syncAudioState',t=>{
 const doc=stubDocument();
 installGlobals(t,{document:doc});
 const ctx=makeCtx();
 ctx.modalKind='help';ctx.paused=true;ctx.currentNpc='edda';
 ctx.previousFocus={focusCalls:0,focus(){this.focusCalls++;}};
 doc.getElementById('modal-shade').hidden=false;
 const {closeModal}=createModals(ctx);
 closeModal();
 assert.equal(ctx.modalKind,'');
 assert.equal(ctx.currentNpc,null);
 assert.equal(ctx.paused,false);
 assert.equal(ctx.syncAudioStateCalls,1);
 assert.equal(ctx.inventoryPreviews.hideCalls,1);
 assert.equal(doc.getElementById('modal-shade').hidden,true);
 assert.deepEqual(ctx.audio.playCalls,[['ui-close',.5]]);
 assert.equal(ctx.previousFocus.focusCalls,1);
 assert.equal(doc.getElementById('world').focusCalls,1);
});

test('closeModal is a no-op while a journey is leaving/conflicted, the run has ended, or the roster is open, and defers to resumeFromMainMenu instead of closing while the main menu is open',t=>{
 const doc=stubDocument();
 installGlobals(t,{document:doc});
 for(const patch of [['journeyLeaving',true],['journeyConflict',true],['rosterPicker',{open:true}]]){
  const blocked=makeCtx();blocked.modalKind='help';blocked[patch[0]]=patch[1];
  createModals(blocked).closeModal();
  assert.equal(blocked.modalKind,'help',`guard should block: ${patch[0]}`);
 }
 const ended=makeCtx();ended.modalKind='help';ended.state.ended=true;
 createModals(ended).closeModal();
 assert.equal(ended.modalKind,'help');
 const viaMenu=makeCtx();viaMenu.mainMenuOpen=true;viaMenu.modalKind='pause';
 createModals(viaMenu).closeModal();
 assert.equal(viaMenu.resumeFromMainMenuCalls,1);
 assert.equal(viaMenu.modalKind,'pause'); // untouched -- resumeFromMainMenu owns this path
});

test('restart sends respawn once the run has ended, otherwise casts the mode-appropriate restart vote and closes the modal, and does nothing while disconnected',t=>{
 const doc=stubDocument();
 installGlobals(t,{document:doc});
 const ended=makeCtx();ended.state.ended=true;ended.modalKind='death';
 createModals(ended).restart();
 assert.deepEqual(ended.network.sendCalls,[['respawn',undefined]]);
 assert.equal(ended.modalKind,'death'); // closeModal is only reached on the non-ended path

 const solo=makeCtx();solo.sessionMode='single-player';solo.modalKind='pause';
 createModals(solo).restart();
 assert.deepEqual(solo.network.sendCalls,[['restart',{agree:true}]]);
 assert.equal(solo.modalKind,''); // closeModal ran

 const multi=makeCtx();multi.sessionMode='multiplayer';multi.modalKind='pause';
 createModals(multi).restart();
 assert.deepEqual(multi.network.sendCalls,[['vote',{agree:true}]]);

 const offline=makeCtx();offline.network.connected=false;
 createModals(offline).restart();
 assert.equal(offline.network.sendCalls.length,0);
});

test('the pause-menu binding, the modal-content click delegate, and the modal-primary/secondary/shade bindings register on the modal elements at factory-call time, in their original relative order',t=>{
 const doc=stubDocument();
 installGlobals(t,{document:doc});
 const ctx=makeCtx();
 const result=createModals(ctx);
 const content=doc.getElementById('modal-content');
 // bindPauseMenu's click+input listeners register before this module's own click delegate.
 assert.deepEqual(content.listeners.map(([event])=>event),['click','input','click']);
 assert.equal(typeof doc.getElementById('modal-primary').onclick,'function');
 assert.equal(doc.getElementById('modal-secondary').onclick,result.restart);
 assert.deepEqual(doc.getElementById('modal-shade').listeners.map(([event])=>event),['keydown']);
});

test('talkTo starts a conversation and opens the npc modal when the npc is in range, and fails silently when it is not or does not exist',t=>{
 const doc=stubDocument();
 installGlobals(t,{document:doc});
 const ctx=makeCtx();
 const npc={id:'edda',model:{position:{x:1,z:0}}};
 ctx.life.visibleNpcs=()=>[npc];
 const {talkTo}=createModals(ctx);
 assert.equal(talkTo('edda'),true);
 assert.equal(ctx.awakenCalls,1);
 assert.deepEqual(ctx.state.talkedTo,['edda']);
 assert.equal(ctx.currentNpc,'edda');
 assert.equal(ctx.modalKind,'npc'); // talkTo opens the modal via showModal in this closure
 assert.equal(doc.getElementById('modal-title').textContent,'Sister Edda');
 ctx.player.position={x:10,z:10};
 assert.equal(talkTo('edda'),false); // out of range
 assert.equal(talkTo('nobody'),false); // unknown id
});

test('renderNpc writes the eyebrow, title, and dialogue copy for a fixture npc',t=>{
 const doc=stubDocument();
 installGlobals(t,{document:doc});
 const ctx=makeCtx();
 ctx.currentNpc='edda';
 const {renderNpc}=createModals(ctx);
 renderNpc();
 assert.equal(doc.getElementById('modal-eyebrow').textContent,'HEALER');
 assert.equal(doc.getElementById('modal-title').textContent,'Sister Edda');
 assert.match(doc.getElementById('modal-content').innerHTML,/I can mend your wounds and refill your draughts/);
 assert.equal(doc.getElementById('dialogue-portrait').hidden,true); // ctx.prefabs is empty -> no portrait
});

test('serviceNpc returns the failure reason when no npc is current, and otherwise sends the chosen service',t=>{
 const doc=stubDocument();
 installGlobals(t,{document:doc});
 const ctx=makeCtx();
 const {serviceNpc}=createModals(ctx);
 assert.deepEqual(serviceNpc('rest'),{ok:false,reason:'Speak to a villager first.'});
 ctx.modalKind='npc';ctx.currentNpc='edda';
 assert.deepEqual(serviceNpc('rest'),{ok:true});
 assert.deepEqual(ctx.network.sendCalls,[['service',{npcId:'edda',action:'rest'}]]);
});

test('toggleMapForDeath collapses the map panel, clears its dialog attributes, and unpauses',t=>{
 const doc=stubDocument();
 installGlobals(t,{document:doc});
 const ctx=makeCtx();ctx.mapExpanded=true;ctx.paused=true;
 const panel=doc.querySelector('.map-panel');
 panel.classList.add('expanded');
 for(const attr of ['role','aria-modal','aria-labelledby'])panel.setAttribute(attr,'x');
 const {toggleMapForDeath}=createModals(ctx);
 toggleMapForDeath();
 assert.equal(ctx.mapExpanded,false);
 assert.equal(ctx.paused,false);
 assert.deepEqual(panel.classList.removed,['expanded']);
 for(const attr of ['role','aria-modal','aria-labelledby'])assert.equal(panel.attrs[attr],undefined);
 assert.equal(doc.getElementById('map-button').attrs['aria-label'],'Expand map');
});
