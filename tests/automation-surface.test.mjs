import test from 'node:test';
import assert from 'node:assert/strict';
import {createState} from '../dist/combat.js';
import {createCampaign} from '../dist/campaign.js';
import {installAutomationSurface} from '../dist/automation-surface.js';

// T0-1 pinned window.hallowmere's key set, the two tool names and control_warden's action enum
// by slicing dist/main.js as text. M11 moved the surface into dist/automation-surface.js, so
// this is now a contract test: it installs the real thing on recording targets and pins the same
// three things plus both inputSchemas in full. PLAN.md constraint 10 freezes all of it -- an
// external automation client reads these keys and schemas -- so a diff here is an API break, not
// a test to update. The x/z bounds are the union of every map's bounds in dist/regions.js.
const HALLOWMERE_KEYS=['getState','showControls','pause','resume'];
const TOOL_NAMES=['get_vigil_state','control_warden'];
const ACTIONS=['move','attack','bolt','dodge','nova','heal','pause','resume','interact','service','inventory','equip','consume'];
const SCHEMAS={
 get_vigil_state:{type:'object',properties:{},additionalProperties:false},
 control_warden:{type:'object',properties:{
  action:{type:'string',enum:ACTIONS},
  x:{type:'number',minimum:-156,maximum:156},
  z:{type:'number',minimum:-112,maximum:112},
  id:{type:'string'},choice:{type:'string'},hold:{type:'boolean'}
 },required:['action'],additionalProperties:false}
};
const ANNOTATIONS={
 get_vigil_state:{readOnlyHint:true,untrustedContentHint:false},
 control_warden:{readOnlyHint:false,untrustedContentHint:false}
};

function makeCtx(overrides={}){
 const ctx={
  calls:[],ready:true,paused:false,backgrounded:false,sessionMode:'single-player',modalKind:'',
  state:Object.assign(createState(),createCampaign(7)),
  network:{connected:true,worldId:'w-1',sent:[],send(type,payload){this.sent.push([type,payload]);return true;}},
  lastSnapshot:{players:[{id:'p1'}],votes:['p1'],hazards:[{id:'h1'}]},
  rosterPicker:{open:false},currentNpc:null,renderedMap:'overworld',enemies:[],
  player:{position:{x:2,z:-3}},targetWorld:{x:0,z:0,set(x,y,z){this.x=x;this.z=z;}},
  angle:0,aimActive:false,attackHeld:false,lockedEnemy:null,moveTarget:null,mouseAction:null,
  mouseTargeting:{selected:null},movePath:[],
  environment:{obstacles:[],currentBuilding:()=>null,buildings:[{id:'chapel',name:'Chapel',chapel:true,
   doorCollider:{disabled:false},inside:false,door:{x:1,z:1},entry:{x:2,z:2},exit:{x:3,z:3}}]},
  audio:{getState:()=>({muted:false})},renderer:{info:{render:{calls:42}}},
  life:{getState:()=>({npcs:[],loot:[]})},
  worldBounds:()=>({minX:-60,maxX:60,minZ:-40,maxZ:40}),
  regionInteractions:()=>[{id:'cave-1'}],
  awaken(){ctx.calls.push('awaken');},
  perform(action){ctx.calls.push('perform:'+action);return true;},
  showModal(kind){ctx.calls.push('showModal:'+kind);ctx.paused=kind==='pause';},
  closeModal(){ctx.calls.push('closeModal');ctx.paused=false;},
  updateUI(){ctx.calls.push('updateUI');},
  interact(id){ctx.calls.push('interact:'+id);return {ok:true};},
  serviceNpc(choice){ctx.calls.push('serviceNpc:'+choice);return {ok:true};},
  equipOwnedItem(id){ctx.calls.push('equip:'+id);return {ok:true};},
  consumePouchItem(id){ctx.calls.push('consume:'+id);return {ok:true};},
  setDestination(point){ctx.calls.push('setDestination');return true;},
  enemyAtPoint:()=>null,nearestEnemy:()=>null
 };
 return Object.assign(ctx,overrides);
}

function install(overrides={}){
 const ctx=makeCtx(overrides),registrations=[],listeners=[];
 const windowTarget={addEventListener(type,handler,options){listeners.push({type,handler,options});}};
 const documentTarget={modelContext:{registerTool(tool,options){registrations.push({tool,options});}}};
 installAutomationSurface(ctx,{windowTarget,documentTarget});
 const tools=Object.fromEntries(registrations.map(r=>[r.tool.name,r.tool]));
 return {ctx,windowTarget,documentTarget,registrations,listeners,tools,api:windowTarget.hallowmere};
}

test('window.hallowmere exposes exactly the documented automation methods',()=>{
 const {api}=install();
 assert.deepEqual(Object.keys(api),HALLOWMERE_KEYS);
 assert.deepEqual([...Object.keys(api)].sort(),['getState','pause','resume','showControls']);
 for(const key of HALLOWMERE_KEYS)assert.equal(typeof api[key],'function');
});

test('the two MCP tools keep their documented names, titles, annotations and inputSchemas',()=>{
 const {registrations}=install();
 assert.deepEqual(registrations.map(r=>r.tool.name),TOOL_NAMES);
 for(const {tool} of registrations){
  assert.deepEqual(tool.inputSchema,SCHEMAS[tool.name],`${tool.name} inputSchema drifted`);
  assert.deepEqual(tool.annotations,ANNOTATIONS[tool.name]);
  assert.equal(typeof tool.title,'string');
  assert.ok(tool.description.length>0);
  assert.equal(typeof tool.execute,'function');
 }
 assert.deepEqual(SCHEMAS.control_warden.properties.action.enum,ACTIONS);
});

test('nothing is registered when the page has no modelContext, and window.hallowmere is still installed',()=>{
 const ctx=makeCtx(),listeners=[];
 const windowTarget={addEventListener(type,handler,options){listeners.push({type,handler,options});}};
 installAutomationSurface(ctx,{windowTarget,documentTarget:{}});
 assert.deepEqual(Object.keys(windowTarget.hallowmere),HALLOWMERE_KEYS);
 assert.deepEqual(listeners,[],'no lifecycle listener without a registry to tear down');
});

test('the registrations share one AbortController that a single pagehide aborts',()=>{
 const {registrations,listeners}=install();
 const signals=registrations.map(r=>r.options.signal);
 assert.equal(signals.length,2);
 assert.equal(signals[0],signals[1],'both tools are registered against the same lifecycle signal');
 assert.equal(signals[0].aborted,false);
 assert.deepEqual(listeners.map(l=>[l.type,l.options]),[['pagehide',{once:true}]]);
 listeners[0].handler();
 assert.equal(signals[0].aborted,true,'leaving the page revokes the tool registrations');
});

test('get_vigil_state reads the same state window.hallowmere.getState() returns, and accepts no input',()=>{
 const {tools,api}=install();
 const state=tools.get_vigil_state.execute();
 assert.deepEqual(state,api.getState());
 assert.equal(state.mode,'single-player');
 assert.equal(state.ready,true);
 assert.equal(state.mapId,'overworld');
 assert.equal(state.drawCalls,42);
 assert.deepEqual(state.player,{x:2,z:-3,moving:false,attacking:false});
 assert.deepEqual(state.multiplayer,{connected:false,worldId:'w-1',players:[{id:'p1'}],votes:['p1']});
 assert.deepEqual(state.buildings,[{id:'chapel',name:'Chapel',chapel:true,locked:true,inside:false,
  door:{x:1,z:1},entry:{x:2,z:2},exit:{x:3,z:3}}]);
 assert.deepEqual(state.hazards,[{id:'h1'}]);
 assert.deepEqual(state.interactions,[{id:'cave-1'}]);
 assert.equal(state.dialogue,null);
 assert.throws(()=>tools.get_vigil_state.execute({x:1}),/No input fields are accepted/);
});

test('getState reports the simulation as paused whenever a solo session cannot advance',()=>{
 assert.equal(install().api.getState().simulationPaused,false);
 assert.equal(install({paused:true}).api.getState().simulationPaused,true);
 assert.equal(install({backgrounded:true}).api.getState().simulationPaused,true);
 assert.equal(install({rosterPicker:{open:true}}).api.getState().simulationPaused,true);
 assert.equal(install({network:{connected:false}}).api.getState().simulationPaused,true);
});

test('control_warden rejects anything outside its schema before touching the game',()=>{
 const {tools,ctx}=install();
 assert.throws(()=>tools.control_warden.execute(),/Invalid Warden action/);
 assert.throws(()=>tools.control_warden.execute({action:'fly'}),/Invalid Warden action/);
 assert.throws(()=>tools.control_warden.execute({action:'move',nope:1}),/Invalid Warden action/);
 assert.throws(()=>tools.control_warden.execute({action:'move',x:9999,z:0}),/x is outside the world/);
 assert.throws(()=>tools.control_warden.execute({action:'move',x:0,z:9999}),/z is outside the world/);
 assert.throws(()=>tools.control_warden.execute({action:'move',x:1}),/Supply both x and z/);
 assert.throws(()=>tools.control_warden.execute({action:'move'}),/Movement requires x and z/);
 assert.throws(()=>tools.control_warden.execute({action:'attack',hold:'yes'}),/hold must be a boolean/);
 assert.deepEqual(ctx.calls,[],'no rejected call reached the game');
 assert.throws(()=>install({ready:false}).tools.control_warden.execute({action:'bolt'}),/still loading/);
 assert.throws(()=>install({paused:true}).tools.control_warden.execute({action:'bolt'}),/paused, in the background, or ended/);
});

test('control_warden drives the same paths the visible controls do',()=>{
 const {tools,ctx}=install();
 assert.deepEqual(tools.control_warden.execute({action:'pause'}),{paused:true});
 assert.deepEqual(tools.control_warden.execute({action:'resume'}),{paused:false});
 assert.deepEqual(tools.control_warden.execute({action:'service',choice:'forge'}),{ok:true});
 assert.deepEqual(tools.control_warden.execute({action:'equip',id:'blade'}),{ok:true});
 assert.deepEqual(tools.control_warden.execute({action:'consume',id:'bread'}),{ok:true});
 assert.deepEqual(ctx.calls,['showModal:pause','closeModal','serviceNpc:forge','equip:blade','consume:bread']);
 ctx.calls.length=0;
 const moved=tools.control_warden.execute({action:'move',x:4,z:5});
 assert.deepEqual(ctx.calls,['awaken','setDestination','updateUI']);
 assert.equal(moved.performed,true);
 assert.equal(ctx.aimActive,true);
 assert.deepEqual([ctx.targetWorld.x,ctx.targetWorld.z],[4,5]);
 ctx.calls.length=0;
 tools.control_warden.execute({action:'bolt'});
 assert.deepEqual(ctx.calls,['awaken','perform:bolt','updateUI']);
 ctx.calls.length=0;
 tools.control_warden.execute({action:'inventory'});
 assert.deepEqual(ctx.calls,['awaken','showModal:inventory']);
 ctx.calls.length=0;
 tools.control_warden.execute({action:'interact',id:'elder'});
 assert.deepEqual(ctx.calls,['awaken','interact:elder']);
});

test('a held attack locks the nearest enemy, clears the move target, and performs an attack',()=>{
 const enemy={id:'e1',dead:false,model:{position:{x:6,z:6}}};
 const {tools,ctx}=install({nearestEnemy:()=>enemy,moveTarget:{x:1,z:1},movePath:[{x:1,z:1}]});
 const result=tools.control_warden.execute({action:'attack',hold:true});
 assert.equal(ctx.attackHeld,true);
 assert.equal(ctx.lockedEnemy,enemy);
 assert.equal(ctx.moveTarget,null);
 assert.deepEqual(ctx.movePath,[]);
 assert.equal(ctx.aimActive,false);
 assert.ok(ctx.calls.includes('perform:attack'));
 assert.equal(result.performed,true);
 const released=tools.control_warden.execute({action:'attack',hold:false});
 assert.equal(ctx.attackHeld,false);
 assert.equal(ctx.lockedEnemy,null);
 assert.equal(released.performed,true,'releasing a hold is reported as performed without a perform() call');
});

test('a registry whose registerTool rejects never breaks the page',async()=>{
 const warnings=[],originalWarn=console.warn;
 console.warn=(...args)=>warnings.push(args[0]);
 try{
  const ctx=makeCtx();
  const windowTarget={addEventListener(){}};
  installAutomationSurface(ctx,{windowTarget,documentTarget:{modelContext:{registerTool(){throw Error('nope');}}}});
  installAutomationSurface(ctx,{windowTarget,documentTarget:{modelContext:{registerTool:()=>Promise.reject(Error('later'))}}});
  await Promise.resolve();await Promise.resolve();
 }finally{console.warn=originalWarn;}
 assert.equal(warnings.length,4,'both tools warn in both the throwing and the rejecting registry');
 for(const message of warnings)assert.equal(message,'Game tool registration unavailable');
});
