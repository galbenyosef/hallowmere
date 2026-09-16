import test from 'node:test';
import assert from 'node:assert/strict';
import {bindInput} from '../dist/input-bindings.js';
import {installGlobals} from './helpers/dom.mjs';

// The registration sequence dist/main.js produced before M5 moved this region out, read top to
// bottom off the pre-extraction file: the three canvas pointer listeners, the two window mouse
// releases, the canvas contextmenu, the ['keydown','keyup'] Shift loop, the two real keyboard
// listeners, bindPageActivity's own pair, both passes over [data-action], the two navigation
// strips, the map-panel Tab trap, and the joystick. pagehide/pageshow/resize are registered
// earlier in main.js and stay there, so they are deliberately absent.
const EXPECTED_ORDER=[
 ['world','pointermove'],['world','pointerleave'],['world','pointerdown'],
 ['window','pointerup'],['window','pointercancel'],['world','contextmenu'],
 ['window','keydown'],['window','keyup'],
 ['window','keydown'],['window','keyup'],
 ['window','blur'],['document','visibilitychange'],
 ['data-action:attack','pointerdown'],['data-action:bolt','pointerdown'],
 ['data-action:attack','click'],['data-action:bolt','click'],
 ['modal-navigation','click'],['map-navigation','click'],
 ['map-panel','keydown'],
 ['joystick','pointerdown'],['joystick','pointermove'],
 ['joystick','pointerup'],['joystick','pointercancel'],['joystick','lostpointercapture']
];

function element(name,order){
 const el={name,dataset:{},style:{},innerHTML:'',hidden:false,handlers:{},classes:new Set(),captured:null,
  addEventListener(type,fn){order.push([name,type]);(el.handlers[type]??=[]).push(fn);},
  setAttribute(key,value){el[key]=value;},removeAttribute(key){delete el[key];},
  focus(){el.focusCalls=(el.focusCalls||0)+1;},
  querySelectorAll:()=>[],getClientRects:()=>[{}],
  setPointerCapture(id){el.captured=id;},hasPointerCapture:id=>el.captured===id,releasePointerCapture(){el.captured=null;},
  getBoundingClientRect:()=>({left:0,top:0,width:68,height:68}),
  requestFullscreen:()=>Promise.resolve(),
  dispatch(type,event={}){for(const fn of [...(el.handlers[type]||[])])fn(event);return event;}};
 el.classList={add:c=>el.classes.add(c),remove:(...c)=>{for(const one of c)el.classes.delete(one);},
  toggle:(c,on)=>{if(on)el.classes.add(c);else el.classes.delete(c);}};
 return el;
}

function harness(t,overrides={}){
 const order=[],calls=[],nodes=new Map(),windowHandlers={},documentHandlers={};
 const node=id=>{if(!nodes.has(id))nodes.set(id,element(id,order));return nodes.get(id);};
 node('loading').hidden=true;// the keydown handler only runs once the loading screen is gone
 const actionButtons=['attack','bolt'].map(action=>{const b=element('data-action:'+action,order);b.dataset.action=action;return b;});
 const mapPanel=element('map-panel',order);
 const windowTarget={addEventListener(type,fn){order.push(['window',type]);(windowHandlers[type]??=[]).push(fn);},
  dispatch(type,event={}){for(const fn of [...(windowHandlers[type]||[])])fn(event);return event;}};
 const documentTarget={hidden:false,activeElement:null,fullscreenElement:null,exitFullscreen(){calls.push(['exitFullscreen']);},
  addEventListener(type,fn){order.push(['document',type]);(documentHandlers[type]??=[]).push(fn);},
  dispatch(type,event={}){for(const fn of [...(documentHandlers[type]||[])])fn(event);return event;},
  querySelectorAll:selector=>selector==='[data-action]'?actionButtons:[],
  querySelector:selector=>selector==='.map-panel'?mapPanel:null};
 installGlobals(t,{document:{getElementById:node},
  HTMLInputElement:class{},HTMLTextAreaElement:class{},HTMLSelectElement:class{},HTMLButtonElement:class{}});
 const record=name=>(...args)=>{calls.push([name,...args]);};
 const ctx={ready:true,paused:false,backgrounded:false,state:{ended:false},network:{connected:true,input:null,send:record('send'),advance:record('advance')},
  mouseAction:null,lockedEnemy:null,attackHeld:false,angle:0,player:{position:{x:0,z:0}},targetWorld:{x:0,z:0},
  keys:new Set(),moveTarget:null,movePath:[],pendingRegionInteraction:null,networkDirection:{x:0,z:0},
  mouseInWorld:false,pointerShift:false,mouseAction:null,mouseTargeting:{show:record('show')},
  mapExpanded:false,modalKind:'',mainMenuOpen:false,currentNpc:null,activeJourney:null,
  journeyLeaving:false,journeyConflict:false,rosterPicker:{open:false},aimActive:true,coarse:false,
  joystickPointer:null,joystickValue:{x:0,y:0},autosave:null,clock:{getDelta:record('getDelta')},
  audio:{play:record('play'),ready:true,muted:false,unlock:async()=>{},toggle:()=>true},
  exploration:{save:record('save')},life:{pending:null,interact:record('life.interact')},
  safeHere:()=>true,updatePointer:record('updatePointer'),updateMouseTarget:record('updateMouseTarget'),
  setDestination:record('setDestination'),nearestEnemy:()=>null,collectClickedLoot:record('collectClickedLoot'),
  interactRegion:record('interactRegion'),enterBuilding:record('enterBuilding'),interact:()=>({ok:true}),
  awaken:record('awaken'),toast:record('toast'),perform:record('perform'),showModal:record('showModal'),
  closeModal:record('closeModal'),openRoster:record('openRoster'),drawMap:record('drawMap'),
  syncAudioState:record('syncAudioState'),resumeFromMainMenu:record('resumeFromMainMenu')};
 Object.assign(ctx,overrides);
 const api=bindInput(ctx,{windowTarget,documentTarget});
 Object.assign(ctx,api);
 return {order,calls,node,ctx,api,windowTarget,documentTarget,mapPanel,actionButtons};
}

test('bindInput registers every listener on the injected targets in the pre-extraction order',t=>{
 const {order,api}=harness(t);
 assert.deepEqual(order,EXPECTED_ORDER);
 assert.deepEqual(Object.keys(api).sort(),
  ['attacksFromHere','navigateMenu','releaseInput','releaseMouseAttack','stopAttackMovement','toggleMap'].sort());
 for(const name of Object.keys(api))assert.equal(typeof api[name],'function');
});

test('bindInput writes both navigation strips before wiring their click handlers',t=>{
 const {node,calls}=harness(t);
 for(const id of ['modal-navigation','map-navigation']){
  const strip=node(id);
  assert.match(strip.innerHTML,/data-menu="character"/);
  assert.match(strip.innerHTML,/data-menu="map"/);
  assert.equal(strip.handlers.click.length,1);
 }
 // A click on a navigation button reaches navigateMenu, which reaches main.js's modal opener;
 // a disabled button is ignored, exactly as the moved listener did.
 const click=menu=>({target:{closest:()=>({disabled:menu===null,dataset:{menu}})}});
 node('modal-navigation').dispatch('click',click('journal'));
 assert.deepEqual(calls.filter(c=>c[0]==='showModal'),[['showModal','journal']]);
 node('map-navigation').dispatch('click',click(null));
 assert.deepEqual(calls.filter(c=>c[0]==='showModal'),[['showModal','journal']]);
});

test('keyboard bindings collect movement keys and route the modal keys through ctx',t=>{
 const {windowTarget,calls,ctx}=harness(t);
 const key=(k,extra={})=>windowTarget.dispatch('keydown',{key:k,repeat:false,defaultPrevented:false,target:{},shiftKey:!!extra.shiftKey,preventDefault(){this.prevented=true;},...extra});
 key('w');key('a');
 assert.deepEqual([...ctx.keys],['w','a']);
 assert.ok(calls.some(c=>c[0]==='awaken'));
 windowTarget.dispatch('keyup',{key:'W'});
 assert.deepEqual([...ctx.keys],['a']);
 // Shift is tracked by the first (loop) listener and re-runs pointer targeting.
 calls.length=0;key('Shift',{shiftKey:true});
 assert.equal(ctx.pointerShift,true);
 assert.ok(calls.some(c=>c[0]==='updateMouseTarget'));
 calls.length=0;key('Escape');
 assert.deepEqual(calls.filter(c=>c[0]==='showModal'),[['showModal','pause']]);
 calls.length=0;ctx.paused=true;key('Escape');
 assert.deepEqual(calls.filter(c=>c[0]==='closeModal'),[['closeModal']]);
 ctx.paused=false;calls.length=0;key('h');key('j');key('i');
 assert.deepEqual(calls.filter(c=>c[0]==='showModal'),[['showModal','help'],['showModal','journal'],['showModal','inventory']]);
 calls.length=0;key('1');key('2');key('3');
 assert.deepEqual(calls.filter(c=>c[0]==='perform'),[['perform','dodge'],['perform','nova'],['perform','heal']]);
 calls.length=0;key('c');
 assert.deepEqual(calls.filter(c=>c[0]==='openRoster'),[['openRoster']]);
});

test('pressing m expands the map through toggleMap and releases held input',t=>{
 const {windowTarget,calls,ctx,node}=harness(t);
 ctx.keys.add('w');ctx.attackHeld=true;
 windowTarget.dispatch('keydown',{key:'m',repeat:false,defaultPrevented:false,target:{},preventDefault(){}});
 assert.equal(ctx.mapExpanded,true);
 assert.equal(ctx.paused,true);
 assert.equal(ctx.keys.size,0);
 assert.equal(ctx.attackHeld,false);
 assert.equal(node('map-button')['aria-label'],'Close map');
 assert.ok(calls.some(c=>c[0]==='drawMap'));
 assert.ok(calls.some(c=>c[0]==='syncAudioState'));
 assert.ok(calls.some(c=>c[0]==='save'));
});

test('releaseInput clears every held input and resets the joystick',t=>{
 const {api,ctx,node,calls}=harness(t);
 const joystick=node('joystick');
 joystick.dispatch('pointerdown',{pointerId:7,preventDefault(){},clientX:34,clientY:34});
 assert.equal(ctx.joystickPointer,7);
 assert.equal(joystick.captured,7);
 ctx.keys.add('w');ctx.keys.add('d');ctx.attackHeld=true;ctx.moveTarget={x:3,z:4};ctx.movePath=[{x:3,z:4}];
 ctx.lockedEnemy={};ctx.pendingRegionInteraction='portal';ctx.mouseInWorld=true;ctx.pointerShift=true;ctx.mouseAction={kind:'enemy'};
 node('world').classList.add('enemy-hover');
 api.releaseInput();
 assert.equal(ctx.keys.size,0);assert.equal(ctx.attackHeld,false);
 assert.equal(ctx.moveTarget,null);assert.deepEqual(ctx.movePath,[]);
 assert.equal(ctx.lockedEnemy,null);assert.equal(ctx.pendingRegionInteraction,null);
 assert.equal(ctx.mouseInWorld,false);assert.equal(ctx.pointerShift,false);assert.equal(ctx.mouseAction,null);
 assert.deepEqual(calls.filter(c=>c[0]==='show').at(-1),['show',null]);
 assert.equal(node('world').classes.has('enemy-hover'),false);
 assert.deepEqual(ctx.network.input,{x:0,z:0,angle:0});
 assert.deepEqual(calls.filter(c=>c[0]==='send').at(-1),['send','input',{x:0,z:0,angle:0}]);
 assert.equal(ctx.joystickPointer,null);
 assert.deepEqual(ctx.joystickValue,{x:0,y:0});
 assert.equal(node('joystick-thumb').style.transform,'');
 assert.equal(joystick.captured,null);
 // resetTouch:false is page-activity's blur path and must leave the touch stick alone.
 ctx.joystickPointer=9;api.releaseInput({resetTouch:false});
 assert.equal(ctx.joystickPointer,9);
});

test('the canvas cancels its context menu instead of opening one',t=>{
 const {node}=harness(t);
 let prevented=0;
 node('world').dispatch('contextmenu',{preventDefault(){prevented++;}});
 assert.equal(prevented,1);
});
