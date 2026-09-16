import test from 'node:test';
import assert from 'node:assert/strict';
import {registerHooks} from 'node:module';
import {readDist} from './helpers/source.mjs';
import {installGlobals} from './helpers/dom.mjs';

// M11 turned dist/main.js into a composition root: createGameContext, one wiring line per
// factory in boot order, then assertWired(ctx). Nothing in the Node suite executes main.js --
// it wires the whole document at import time -- so this test reproduces that wiring block
// against a stub document and asserts two things main.js alone cannot prove: that running the
// factories in exactly this order fills every WIRED_SLOTS entry, and that assertWired really
// bites, naming the slots a missing factory would have supplied. The source assertion at the
// bottom keeps the order below and main.js's from drifting apart.
const hook=registerHooks({resolve(specifier,context,nextResolve){
 if(specifier==='three')return nextResolve(new URL('../dist/vendor/three.module.js',import.meta.url).href,context);
 if(specifier.startsWith('three/addons/'))return nextResolve(new URL('../dist/vendor/'+specifier.slice('three/addons/'.length),import.meta.url).href,context);
 return nextResolve(specifier,context);
}});
const {createGameContext,assertWired,WIRED_SLOTS}=await import('../dist/game-context.js');
const {createState}=await import('../dist/combat.js');
const {createCampaign}=await import('../dist/campaign.js');
const {createModelCache}=await import('../dist/model-kit.js');
const {createEffects}=await import('../dist/effects-factory.js');
const {createEnemySpawner}=await import('../dist/enemy-spawner.js');
const {createPointerTargeting}=await import('../dist/pointer-targeting.js');
const {createInteraction}=await import('../dist/interaction.js');
const {createRegionTravel}=await import('../dist/region-travel.js');
const {createSessionLifecycle}=await import('../dist/session-lifecycle.js');
const {createHud}=await import('../dist/hud.js');
const {createGameAudio}=await import('../dist/game-audio.js');
const {createSceneSetup}=await import('../dist/scene-setup.js');
const {bindInput}=await import('../dist/input-bindings.js');
const {createPlayerMotion}=await import('../dist/player-motion.js');
const {createRenderLoop}=await import('../dist/render-loop.js');
const {createInventoryUi}=await import('../dist/inventory-ui.js');
const {createModals}=await import('../dist/modals.js');
const {createConnectionUi}=await import('../dist/connection-ui.js');
const {createSnapshotApply}=await import('../dist/snapshot-apply.js');
const {createNetworkEvents}=await import('../dist/network-events.js');
const {createSharedWorldRender}=await import('../dist/shared-world-render.js');
const {installAutomationSurface}=await import('../dist/automation-surface.js');
hook.deregister();

// One recursive mock element per id/selector, shared through the document so closest() and
// querySelector() hand back the same instance a real DOM would (tests/modals.test.mjs's pattern).
function makeElement(key,resolve,doc){
 const children=new Map();
 const el={key,style:{},dataset:{},attrs:{},textContent:'',innerHTML:'',value:'',hidden:false,inert:undefined,
  scrollTop:0,checked:false,onclick:null,oninput:null,onchange:null,listeners:[],children:[],ownerDocument:doc};
 el.classList={add(){},remove(){},toggle(){},contains:()=>false};
 el.setAttribute=(k,v)=>{el.attrs[k]=v;};
 el.getAttribute=k=>el.attrs[k]??null;
 el.removeAttribute=k=>{delete el.attrs[k];};
 el.addEventListener=(type,handler)=>{el.listeners.push([type,handler]);};
 el.removeEventListener=()=>{};
 el.append=()=>{};el.appendChild=node=>node;el.remove=()=>{};
 el.querySelector=sel=>{if(!children.has(sel))children.set(sel,makeElement(key+' '+sel,resolve,doc));return children.get(sel);};
 el.querySelectorAll=()=>[];
 el.closest=sel=>resolve(sel);
 el.contains=()=>false;
 el.focus=()=>{el.focusCalls=(el.focusCalls||0)+1;};
 el.blur=()=>{};
 el.getBoundingClientRect=()=>({left:0,top:0,width:68,height:68});
 el.getClientRects=()=>[{}];
 el.setPointerCapture=()=>{};el.hasPointerCapture=()=>false;el.releasePointerCapture=()=>{};
 el.requestFullscreen=()=>Promise.resolve();
 el.getContext=()=>null;
 return el;
}
function stubDocument(){
 const byId=new Map(),byQuery=new Map();
 const doc={hidden:false,activeElement:null,fullscreenElement:null,body:null};
 const resolve=sel=>{if(!byQuery.has(sel))byQuery.set(sel,makeElement(sel,resolve,doc));return byQuery.get(sel);};
 doc.getElementById=id=>{if(!byId.has(id))byId.set(id,makeElement(id,resolve,doc));return byId.get(id);};
 doc.querySelector=resolve;
 doc.querySelectorAll=()=>[];
 doc.createElement=tag=>makeElement('<'+tag+'>',resolve,doc);
 doc.addEventListener=()=>{};
 doc.removeEventListener=()=>{};
 doc.body=makeElement('body',resolve,doc);
 doc.documentElement=makeElement('html',resolve,doc);
 return doc;
}

const SESSION_DEPS={
 createTitleScreen:()=>({showModes(){},hide(){},showMainMenu(){},updateSession(){},setProgress(){},showError(){}}),
 createJourneysMenu:()=>({show(){},showConflict(){}}),
 LocalSession:class{start(){}close(){}},MultiplayerClient:class{start(){}close(){}},
 createAutosave:()=>({emergency(){},async exit(){},changed(){},async flush(){},stop(){}}),
 createJourney:choice=>choice
};

// main.js's wiring block, one entry per line of it, in the order those lines stand there.
function factories(targets){
 const di={windowTarget:targets.windowTarget,documentTarget:targets.documentTarget};
 return [
  ['createModelCache',ctx=>Object.assign(ctx,createModelCache(ctx))],
  ['createEffects+createEnemySpawner',ctx=>Object.assign(ctx,createEffects(ctx),createEnemySpawner(ctx))],
  ['createPointerTargeting+createInteraction+createRegionTravel',ctx=>Object.assign(ctx,createPointerTargeting(ctx),createInteraction(ctx),createRegionTravel(ctx))],
  ['createSessionLifecycle',ctx=>Object.assign(ctx,createSessionLifecycle(ctx,{...di,...SESSION_DEPS}))],
  ['createHud+createGameAudio',ctx=>Object.assign(ctx,createHud(ctx),createGameAudio(ctx))],
  ['createSceneSetup',ctx=>Object.assign(ctx,createSceneSetup(ctx))],
  ['bindInput',ctx=>Object.assign(ctx,bindInput(ctx,di))],
  ['ctx.perform',ctx=>{ctx.perform=function perform(){return false;};}],
  ['createPlayerMotion',ctx=>Object.assign(ctx,createPlayerMotion(ctx))],
  ['createRenderLoop',ctx=>Object.assign(ctx,createRenderLoop(ctx))],
  ['createInventoryUi+createModals',ctx=>Object.assign(ctx,createInventoryUi(ctx),createModals(ctx))],
  ['createConnectionUi',ctx=>Object.assign(ctx,createConnectionUi(ctx))],
  ['createSnapshotApply+createNetworkEvents+createSharedWorldRender',ctx=>Object.assign(ctx,createSnapshotApply(ctx),createNetworkEvents(ctx),createSharedWorldRender(ctx))],
  ['installAutomationSurface',ctx=>installAutomationSurface(ctx,di)]
 ];
}

function wire(t,{skip=-1,log=null}={}){
 const documentTarget=stubDocument();
 const windowTarget={listeners:[],addEventListener(type,handler){this.listeners.push([type,handler]);},removeEventListener(){},
  innerWidth:1440,innerHeight:900,setTimeout:()=>0,clearTimeout(){},requestAnimationFrame:()=>0};
 documentTarget.defaultView=windowTarget;
 installGlobals(t,{document:documentTarget,window:windowTarget,location:{search:'',reload(){}},
  innerWidth:1440,innerHeight:900,devicePixelRatio:2,
  matchMedia:()=>({matches:false,addEventListener(){},removeEventListener(){}}),
  localStorage:{getItem:()=>null,setItem(){},removeItem(){}},
  requestAnimationFrame:()=>0,cancelAnimationFrame(){},
  HTMLInputElement:class{},HTMLTextAreaElement:class{},HTMLSelectElement:class{},HTMLButtonElement:class{}});
 const ctx=createGameContext({audio:{musicEnabled:true,getState:()=>({}),play(){},pause(){},unlock:async()=>{},ready:true,muted:false,toggle:()=>true},
  gameSettings:{music:true,brightness:100,shadows:true,cameraShake:true},
  exploration:{save(){},seen:new Set(),note(){}},resourceOrbs:{update(){}},
  journeyStore:{list:()=>[],load:()=>null,save(){},remove(){}},
  previewMode:false,reducedMotion:false,coarse:false});
 const steps=factories({windowTarget,documentTarget});
 const unfilled=()=>WIRED_SLOTS.filter(slot=>ctx[slot]===null||ctx[slot]===undefined);
 steps.forEach(([,run],index)=>{
  // main.js's one non-factory wiring line, between the region trio and session lifecycle.
  if(index===STATE_AT)ctx.state=Object.assign(createState(),createCampaign(7));
  if(index===skip)return;
  const before=new Set(unfilled());
  run(ctx);
  if(log)log[index]=[...before].filter(slot=>!unfilled().includes(slot));
 });
 return {ctx,steps,windowTarget,documentTarget};
}
const STATE_AT=3;
const STEP_NAMES=factories({windowTarget:{addEventListener(){}},documentTarget:{}}).map(([name])=>name);
// installAutomationSurface returns nothing -- it installs window.hallowmere and the tool
// registry on the injected targets -- so it owns no WIRED_SLOTS entry and gets its own test.
const INSTALLERS=new Set(['installAutomationSurface']);

test("running main.js's wiring block in order leaves every WIRED_SLOTS entry filled",t=>{
 const {ctx}=wire(t);
 assert.equal(assertWired(ctx),ctx,'assertWired returns the context it validated');
 assert.deepEqual(WIRED_SLOTS.filter(slot=>ctx[slot]===null||ctx[slot]===undefined),[],
  'nothing in WIRED_SLOTS is filled later than the wiring block');
 assert.equal(WIRED_SLOTS.length,new Set(WIRED_SLOTS).size,'WIRED_SLOTS has no duplicates');
 for(const slot of ['buildRenderer','buildWorld','buildHero','resize','frame'])assert.ok(WIRED_SLOTS.includes(slot),slot+' is a wired slot');
 assert.equal(typeof ctx.frame,'function');
 assert.equal(typeof ctx.buildRenderer,'function');
});

test('every wiring line owns at least one WIRED_SLOTS entry, and together they own all of them',t=>{
 const log=[];
 wire(t,{log});
 const owned=log.flat().sort();
 log.forEach((slots,index)=>{if(!INSTALLERS.has(STEP_NAMES[index]))assert.ok(slots.length>0,STEP_NAMES[index]+' supplies no WIRED_SLOTS entry, so assertWired cannot catch it going missing');});
 assert.deepEqual(owned,[...new Set(owned)].sort(),'two wiring lines claim the same slot');
 const fromContext=['worldBounds','safeHere','bossType','enemyModelType'];
 assert.deepEqual(owned,WIRED_SLOTS.filter(slot=>!fromContext.includes(slot)).sort(),
  'every slot except createGameContext\'s own four helpers is filled by exactly one wiring line');
});

test('assertWired bites: dropping any one wiring line fails the boot it is part of',t=>{
 const log=[];
 wire(t,{log});
 for(let index=0;index<STEP_NAMES.length;index++){
  if(INSTALLERS.has(STEP_NAMES[index]))continue;
  let ctx;
  try{ctx=wire(t,{skip:index}).ctx;}
  catch(error){
   // Some lines are load-bearing before assertWired is even reached: bindInput's
   // bindPageActivity calls ctx.syncAudioState while it registers, so dropping
   // createGameAudio breaks the wiring block itself. That is the same guarantee, earlier.
   assert.ok(error instanceof Error,STEP_NAMES[index]+' was dropped without any complaint');
   continue;
  }
  assert.throws(()=>assertWired(ctx),error=>{
   assert.match(error.message,/^Game context is not wired: /);
   for(const slot of log[index])assert.ok(error.message.includes(slot),STEP_NAMES[index]+' skipped, but the error never names '+slot);
   return true;
  },'skipping '+STEP_NAMES[index]+' still passed assertWired');
 }
});

test('installAutomationSurface is the one wiring line that installs rather than returns slots',t=>{
 const present=wire(t);
 assert.equal(typeof present.windowTarget.hallowmere,'object');
 assert.equal(typeof present.windowTarget.hallowmere.getState,'function');
 // Its own pagehide only exists when the page has a tool registry to revoke; ordering across
 // all four page-lifecycle registrations is pinned by tests/pagehide-order.test.mjs.
 assert.deepEqual(present.windowTarget.listeners.map(([type])=>type).filter(type=>type==='pagehide'),['pagehide'],
  "only session-lifecycle's pagehide is registered when the page exposes no modelContext");
 const absent=wire(t,{skip:STEP_NAMES.indexOf('installAutomationSurface')});
 assert.equal(absent.windowTarget.hallowmere,undefined);
 assert.doesNotThrow(()=>assertWired(absent.ctx),'it owns no WIRED_SLOTS entry, by design');
});

test('dist/main.js wires the same factories in the same order this test does',()=>{
 const main=readDist('main.js');
 const LINES=[
  'Object.assign(ctx,createModelCache(ctx));',
  'Object.assign(ctx,createEffects(ctx),createEnemySpawner(ctx));',
  'Object.assign(ctx,createPointerTargeting(ctx),createInteraction(ctx),createRegionTravel(ctx));',
  'ctx.state=Object.assign(createState(),createCampaign(',
  'Object.assign(ctx,createSessionLifecycle(ctx));',
  'Object.assign(ctx,createHud(ctx),createGameAudio(ctx));',
  'Object.assign(ctx,createSceneSetup(ctx));',
  "window.addEventListener('resize',ctx.resize);",
  'Object.assign(ctx,bindInput(ctx));',
  'ctx.perform=perform;',
  'Object.assign(ctx,createPlayerMotion(ctx));',
  'Object.assign(ctx,createRenderLoop(ctx));',
  'Object.assign(ctx,createInventoryUi(ctx),createModals(ctx));',
  'Object.assign(ctx,createConnectionUi(ctx));',
  'Object.assign(ctx,createSnapshotApply(ctx),createNetworkEvents(ctx),createSharedWorldRender(ctx));',
  'installAutomationSurface(ctx);',
  'assertWired(ctx);'
 ];
 let at=-1;
 for(const line of LINES){
  const found=main.indexOf(line);
  assert.notEqual(found,-1,`dist/main.js no longer contains ${JSON.stringify(line)}`);
  assert.ok(found>at,`${JSON.stringify(line)} must follow the previous wiring line`);
  at=found;
 }
 // assertWired closes the wiring block: nothing is Object.assign-ed onto ctx after it.
 assert.equal(main.indexOf('Object.assign(ctx,',main.indexOf('assertWired(ctx);')),-1);
 // The composition root holds no bare-name destructuring of ctx any more.
 assert.equal(/const\s*\{[^}]*\}\s*=\s*ctx\s*;/.test(main),false,'a `const {…}=ctx` line is back in main.js');
 assert.ok(main.split('\n').length<=90,'main.js is still a composition root');
});
