import test from 'node:test';
import assert from 'node:assert/strict';
import {registerHooks} from 'node:module';
import {bindExplorationSaving} from '../dist/exploration-map.js';
import {bindInput} from '../dist/input-bindings.js';
import {readDist} from './helpers/source.mjs';
import {installGlobals} from './helpers/dom.mjs';

// M9 moved main.js's first pagehide (autosave emergency/exit + network close) and its pageshow
// into dist/session-lifecycle.js. Page-lifecycle listeners are order-sensitive: the atlas has to
// be written before the autosave flush, the autosave before the automation surface aborts its
// tool registrations, and the world preview disposes last. Reproduce main.js's wiring order on
// recording targets and pin the sequence.
const hook=registerHooks({resolve(specifier,context,nextResolve){
 if(specifier==='three')return nextResolve(new URL('../dist/vendor/three.module.js',import.meta.url).href,context);
 if(specifier==='three/addons/utils/BufferGeometryUtils.js')return nextResolve(new URL('../dist/vendor/utils/BufferGeometryUtils.js',import.meta.url).href,context);
 return nextResolve(specifier,context);
}});
const {createSessionLifecycle}=await import('../dist/session-lifecycle.js');
hook.deregister();

// Read top to bottom off dist/main.js as it stood before M9 (bindExplorationSaving at :59, the
// session pagehide/pageshow at :189-190, bindInput's bindPageActivity pair at :196). main.js's
// two remaining literal registrations -- the automation surface's abort at :355 and the world
// preview dispose at :361 -- are still inline there and are pinned by source position below.
const EXPECTED_ORDER=[
 ['window','pagehide'],            // exploration atlas save
 ['document','visibilitychange'],  // exploration atlas save-when-hidden
 ['window','pagehide'],            // session: autosave emergency + exit, network close
 ['window','pageshow'],            // reload a bfcache restore
 ['window','blur'],                // page-activity: release held input
 ['document','visibilitychange']   // page-activity: background suspension
];

function element(name,order){
 const el={name,dataset:{},style:{},innerHTML:'',hidden:false,inert:undefined,handlers:{},children:[],
  addEventListener(type,fn){order.push(['element:'+name,type]);(el.handlers[type]??=[]).push(fn);},
  classList:{add(){},remove(){},toggle(){}},
  setAttribute(key,value){el[key]=value;},removeAttribute(key){delete el[key];},
  focus(){el.focusCalls=(el.focusCalls||0)+1;},querySelectorAll:()=>[],getClientRects:()=>[{}],
  setPointerCapture(){},hasPointerCapture:()=>false,releasePointerCapture(){},
  getBoundingClientRect:()=>({left:0,top:0,width:68,height:68}),requestFullscreen:()=>Promise.resolve()};
 return el;
}

function wireLikeMain(t){
 const order=[],windowHandlers={},documentHandlers={},nodes=new Map(),reloads=[];
 const node=id=>{if(!nodes.has(id))nodes.set(id,element(id,order));return nodes.get(id);};
 node('loading').hidden=true;
 node('game').children=[node('world'),node('loading')];
 const actionButtons=[],mapPanel=element('map-panel',order);
 const windowTarget={addEventListener(type,fn){order.push(['window',type]);(windowHandlers[type]??=[]).push(fn);},
  dispatch(type,event={}){for(const fn of [...(windowHandlers[type]||[])])fn(event);return event;}};
 const documentTarget={hidden:false,activeElement:null,fullscreenElement:null,getElementById:node,
  addEventListener(type,fn){order.push(['document',type]);(documentHandlers[type]??=[]).push(fn);},
  querySelectorAll:selector=>selector==='[data-action]'?actionButtons:[],
  querySelector:selector=>selector==='.map-panel'?mapPanel:null};
 installGlobals(t,{document:documentTarget,location:{reload(){reloads.push(true);}},
  HTMLInputElement:class{},HTMLTextAreaElement:class{},HTMLSelectElement:class{},HTMLButtonElement:class{}});

 const autosave={calls:[],emergency(){this.calls.push('emergency');},async exit(){this.calls.push('exit');},
  changed(){this.calls.push('changed');},async flush(){this.calls.push('flush');},stop(){this.calls.push('stop');}};
 const network={calls:[],connected:true,input:null,close(){this.calls.push('close');},send(){return true;},advance(){}};
 const ctx={ready:true,paused:false,backgrounded:false,state:{ended:false,classId:'sorcerer'},network,autosave,
  keys:new Set(),moveTarget:null,movePath:[],pendingRegionInteraction:null,networkDirection:{x:0,z:0},
  mouseInWorld:false,pointerShift:false,mouseAction:null,mouseTargeting:{show(){}},lockedEnemy:null,attackHeld:false,
  angle:0,player:{position:{x:0,z:0}},targetWorld:{x:0,z:0},aimActive:true,coarse:false,mapExpanded:false,
  modalKind:'',mainMenuOpen:false,currentNpc:null,activeJourney:null,journeyLeaving:false,journeyConflict:false,
  rosterPicker:{open:false},joystickPointer:null,joystickValue:{x:0,y:0},sessionMode:null,sessionGeneration:0,
  assetsReady:false,lastSnapshot:null,saveStatus:{kind:'saved',message:'saved'},clock:{getDelta(){}},
  audio:{play(){},ready:true,muted:false,unlock:async()=>{},toggle:()=>true,pause(){}},
  exploration:{save(){}},life:{pending:null,interact(){}},safeHere:()=>true,
  updatePointer(){},updateMouseTarget(){},setDestination(){},nearestEnemy:()=>null,collectClickedLoot(){},
  interactRegion(){},enterBuilding(){},interact:()=>({ok:true}),awaken(){},toast(){},perform(){},
  showModal(){},closeModal(){},drawMap(){},syncAudioState(){},applySnapshot(){},connectionStatus(){},
  inventoryPreviews:{hide(){}},toggleMapForDeath(){},releaseInput(){},toggleMap(){}};

 // main.js:59 -- the exploration atlas registers first.
 bindExplorationSaving({save(){}},{windowTarget,documentTarget});
 // main.js's wiring line for M9's region, where its import-time statements stood.
 Object.assign(ctx,createSessionLifecycle(ctx,{windowTarget,documentTarget,
  createTitleScreen:()=>({showModes(){},hide(){},showMainMenu(){},updateSession(){}}),
  createJourneysMenu:()=>({show(){},showConflict(){}}),
  LocalSession:class{start(){}close(){}},MultiplayerClient:class{start(){}close(){}},
  createAutosave:()=>autosave,createJourney:choice=>choice}));
 // main.js:196 -- bindInput, whose bindPageActivity pair must stay after the session listeners.
 Object.assign(ctx,bindInput(ctx,{windowTarget,documentTarget}));
 return {order,ctx,autosave,network,windowTarget,documentTarget,node,reloads};
}

const LIFECYCLE=new Set(['pagehide','pageshow','blur','visibilitychange']);

test('the page-lifecycle listeners register in the order main.js had before M9',t=>{
 const {order}=wireLikeMain(t);
 assert.deepEqual(order.filter(([,type])=>LIFECYCLE.has(type)),EXPECTED_ORDER);
 // The session pagehide is strictly between the atlas pair and page-activity's pair.
 const kinds=order.filter(([,type])=>LIFECYCLE.has(type));
 assert.equal(kinds.findIndex(([,type])=>type==='pageshow'),3);
 assert.ok(kinds.findIndex(([,type])=>type==='blur')>2,'page-activity blur registers after the session pagehide');
});

test("main.js's two remaining inline pagehide registrations still follow the wiring in source order",()=>{
 const main=readDist('main.js');
 const positions=[
  ['bindExplorationSaving','bindExplorationSaving(exploration);'],
  ['createSessionLifecycle','Object.assign(ctx,createSessionLifecycle(ctx));'],
  ['bindInput','Object.assign(ctx,bindInput(ctx));'],
  ['automation abort',"window.addEventListener('pagehide',()=>lifecycle.abort(),{once:true});"],
  ['worldPreview dispose',"window.addEventListener('pagehide',event=>{if(!event.persisted)ctx.worldPreview?.dispose();});"]
 ].map(([label,marker])=>{const at=main.indexOf(marker);assert.notEqual(at,-1,`${label} not found in dist/main.js`);return [label,at];});
 for(let i=1;i<positions.length;i++)assert.ok(positions[i][1]>positions[i-1][1],`${positions[i][0]} must follow ${positions[i-1][0]}`);
 // The session pagehide/pageshow really left main.js: only the two inline ones remain.
 assert.equal([...main.matchAll(/addEventListener\('pagehide'/g)].length,2);
 assert.equal([...main.matchAll(/addEventListener\('pageshow'/g)].length,0);
 // The worldPreview dispose stays last of all of them.
 assert.equal(main.lastIndexOf("addEventListener('pagehide'"),positions.at(-1)[1]+'window.'.length);
});

test('the session pagehide flushes the autosave and closes the transport; pageshow reloads only a restored page',t=>{
 const {windowTarget,autosave,network,reloads}=wireLikeMain(t);
 windowTarget.dispatch('pagehide',{persisted:false});
 assert.deepEqual(autosave.calls,['emergency','exit']);
 assert.deepEqual(network.calls,['close']);
 assert.deepEqual(reloads,[]);
 windowTarget.dispatch('pageshow',{persisted:false});assert.deepEqual(reloads,[]);
 windowTarget.dispatch('pageshow',{persisted:true});assert.deepEqual(reloads,[true]);
});

test('the pagehide handler survives a session that was never started',t=>{
 const {windowTarget,ctx,reloads}=wireLikeMain(t);
 ctx.autosave=null;ctx.network=null;
 windowTarget.dispatch('pagehide',{persisted:false});
 assert.deepEqual(reloads,[]);
});
