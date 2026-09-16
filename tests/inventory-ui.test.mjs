import test from 'node:test';
import assert from 'node:assert/strict';
import {registerHooks} from 'node:module';
import {installGlobals} from './helpers/dom.mjs';
import {createState} from '../dist/combat.js';
import {createCampaign,ITEM_TEMPLATES} from '../dist/campaign.js';
import {inventoryMarkup} from '../dist/inventory.js';

// dist/inventory-ui.js transitively imports inventory-portraits.js, which imports the bare
// 'three' specifier (it needs WebGLRenderer, which only the full build exports) -- only the
// page's import map resolves that; match it in Node the way
// tests/inventory-portraits.test.mjs does.
const hook=registerHooks({resolve(specifier,context,nextResolve){
 if(specifier==='three')return nextResolve(new URL('../dist/vendor/three.module.js',import.meta.url).href,context);
 return nextResolve(specifier,context);
}});
const {createInventoryUi}=await import('../dist/inventory-ui.js');
hook.deregister();

// M8 moved renderInventory/equipOwnedItem/consumePouchItem/lootCollected and the
// inventoryPreviews binding out of main.js. bindInventoryPreviews (real, from ./inventory.js)
// only registers listeners at factory-call time and never dereferences a hovered/focused
// anchor until a pointer/focus event fires -- which these tests never dispatch -- so a
// lightweight recursive-mock-element document stub (tests/hud.test.mjs's pattern) is enough;
// no anchor ever means hide()/refresh() are real, side-effect-free no-ops unless a test
// spies on them itself.
function makeElement(key,resolveGlobal,doc){
 const el={key,style:{},dataset:{},attrs:{},textContent:'',innerHTML:'',hidden:false,scrollTop:0};
 const children=new Map();
 el.ownerDocument=doc;
 el.classList={add(){},remove(){},toggle(){}};
 el.setAttribute=(k,v)=>{el.attrs[k]=v;};
 el.addEventListener=()=>{};
 el.querySelector=sel=>{if(!children.has(sel))children.set(sel,makeElement(sel,resolveGlobal,doc));return children.get(sel);};
 el.querySelectorAll=()=>[];
 el.closest=sel=>resolveGlobal(sel);
 el.contains=()=>false;
 el.focus=()=>{};
 return el;
}
function stubDocument(){
 const byId=new Map(),byQuery=new Map();
 const view={addEventListener(){},clearTimeout(){},setTimeout(){},innerWidth:1024,innerHeight:768};
 const doc={activeElement:undefined,defaultView:view,addEventListener(){}};
 const resolve=sel=>{if(!byQuery.has(sel))byQuery.set(sel,makeElement(sel,resolve,doc));return byQuery.get(sel);};
 doc.getElementById=id=>{if(!byId.has(id))byId.set(id,makeElement(id,resolve,doc));return byId.get(id);};
 doc.querySelector=resolve;
 doc.querySelectorAll=()=>[];
 return doc;
}

// Same fixture recipe as tests/inventory.test.mjs's game(): a real state with every item
// template owned, so equip/consume paths exercise real inventory/pouch data.
function fixtureState(){
 const state={...createState(),...createCampaign(42)};
 state.inventory.push(...Object.entries(ITEM_TEMPLATES).map(([id,item])=>({id,...item})));
 return state;
}
function makeCtx(){
 const ctx={
  state:fixtureState(),modalKind:'inventory',backgrounded:false,renderedMap:'overworld',victoryShown:false,
  network:{connected:true,worldId:'w1',sendCalls:[],send(type,payload){this.sendCalls.push([type,payload]);return this.connected;}},
  audio:{playCalls:[],play(...a){this.playCalls.push(a);}},
  toastCalls:[],toast(message){ctx.toastCalls.push(message);},
  updateUICalls:0,updateUI(){ctx.updateUICalls++;},
  showModalCalls:[],showModal(kind){ctx.showModalCalls.push(kind);},
 };
 return ctx;
}

test('renderInventory writes the equipment/pouch markup for a fixture state and the gold purse',t=>{
 const doc=stubDocument();
 installGlobals(t,{document:doc});
 const ctx=makeCtx();
 const {renderInventory}=createInventoryUi(ctx);
 renderInventory();
 const content=doc.getElementById('modal-content');
 assert.equal(content.innerHTML,inventoryMarkup(ctx.state)); // same pure function, same state
 assert.match(content.innerHTML,/class="inventory-layout"/);
 assert.match(content.innerHTML,/gear-tile/); // owned items rendered as equip tiles
 assert.equal(doc.getElementById('inventory-purse').innerHTML,`<strong data-resource="gold">${ctx.state.gold}</strong><span>Crowns</span>`);
});

test('inventoryPreviews is exposed on ctx and refreshed by renderInventory',t=>{
 const doc=stubDocument();
 installGlobals(t,{document:doc});
 const ctx=makeCtx();
 const result=createInventoryUi(ctx);
 Object.assign(ctx,result);
 assert.equal(ctx.inventoryPreviews,result.inventoryPreviews);
 assert.equal(typeof ctx.inventoryPreviews.hide,'function');
 assert.equal(typeof ctx.inventoryPreviews.refresh,'function');
 let refreshCalls=0;
 const originalRefresh=ctx.inventoryPreviews.refresh;
 ctx.inventoryPreviews.refresh=(...args)=>{refreshCalls++;return originalRefresh(...args);};
 ctx.renderInventory();
 assert.equal(refreshCalls,1);
});

test('equipOwnedItem requires the inventory to be open, requires ownership, is a no-op when already equipped, sends equip otherwise, and reports failure while disconnected',t=>{
 const doc=stubDocument();
 installGlobals(t,{document:doc});
 const ctx=makeCtx();
 const {equipOwnedItem}=createInventoryUi(ctx);
 ctx.modalKind='pause';
 assert.deepEqual(equipOwnedItem('starting-sword'),{ok:false,reason:'Open your inventory first.'});
 ctx.modalKind='inventory';
 assert.deepEqual(equipOwnedItem('does-not-exist'),{ok:false,reason:'You do not own that item.'});
 assert.deepEqual(equipOwnedItem('starting-sword'),{ok:true}); // createCampaign already equips it
 assert.equal(ctx.network.sendCalls.length,0); // no round-trip for a no-op equip
 assert.deepEqual(equipOwnedItem('iron-falchion'),{ok:true});
 assert.deepEqual(ctx.network.sendCalls,[['equip',{id:'iron-falchion'}]]);
 ctx.network.connected=false;
 assert.deepEqual(equipOwnedItem('cinder-blade'),{ok:false,reason:'Unable to equip while disconnected.'});
});

test('consumePouchItem requires the inventory to be open, requires foreground, defers to consumeAvailability, sends consume otherwise, and reports failure while disconnected',t=>{
 const doc=stubDocument();
 installGlobals(t,{document:doc});
 const ctx=makeCtx();
 ctx.state.pouch['bramble-berries']=2;ctx.state.hp=100; // below maxHp so the food isn't a no-op full-health/essence refusal
 const {consumePouchItem}=createInventoryUi(ctx);
 ctx.modalKind='pause';
 assert.deepEqual(consumePouchItem('bramble-berries'),{ok:false,reason:'Open your inventory to eat from your pouch.'});
 ctx.modalKind='inventory';ctx.backgrounded=true;
 assert.deepEqual(consumePouchItem('bramble-berries'),{ok:false,reason:'Return to the game before eating.'});
 ctx.backgrounded=false;
 assert.deepEqual(consumePouchItem('unknown-food'),{ok:false,reason:'Unknown food.'}); // consumeAvailability's own reason
 assert.deepEqual(consumePouchItem('bramble-berries'),{ok:true,pending:true});
 assert.deepEqual(ctx.network.sendCalls,[['consume',{itemId:'bramble-berries'}]]);
 ctx.network.connected=false;
 assert.deepEqual(consumePouchItem('bramble-berries'),{ok:false,reason:'Reconnect to eat.'});
});

test('lootCollected toasts the drop, updates the HUD, and reveals the victory modal once, after a delay, for the Bellkeeper relic',t=>{
 const doc=stubDocument();
 installGlobals(t,{document:doc});
 t.mock.timers.enable({apis:['setTimeout']});
 const ctx=makeCtx();
 const {lootCollected}=createInventoryUi(ctx);
 lootCollected({kind:'gold',amount:12},{collected:true});
 assert.deepEqual(ctx.audio.playCalls.at(-1),['pickup',.65]);
 assert.equal(ctx.toastCalls.at(-1),'+12 crowns');
 assert.equal(ctx.updateUICalls,1);
 assert.equal(ctx.showModalCalls.length,0); // ordinary loot never opens a modal
 lootCollected({kind:'item',template:'bellkeeper-edge',name:'Bellkeeper’s Requiem'},{collected:true});
 assert.deepEqual(ctx.audio.playCalls.at(-1),['relic',.65]);
 assert.equal(ctx.victoryShown,true);
 assert.equal(ctx.showModalCalls.length,0); // deferred behind a 900ms timer
 t.mock.timers.tick(900);
 assert.deepEqual(ctx.showModalCalls,['victory']);
 // The relic can only trigger the reveal once per vigil.
 lootCollected({kind:'item',template:'bellkeeper-edge',name:'Bellkeeper’s Requiem'},{collected:true});
 t.mock.timers.tick(900);
 assert.deepEqual(ctx.showModalCalls,['victory']); // unchanged -- ctx.victoryShown guards it
});
