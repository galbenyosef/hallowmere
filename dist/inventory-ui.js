// renderInventory/equipOwnedItem/consumePouchItem/lootCollected and the inventoryPreviews
// binding moved verbatim out of main.js (M8). Free identifiers: $ (./dom.js,
// renderInventory). inventoryMarkup/bindInventoryPreviews (./inventory.js, renderInventory/
// the inventoryPreviews binding). updateInventoryResources (./pouch.js, renderInventory).
// inventoryPortraitStatus/conceptFor (./character-art.js/./classes.js, renderInventory).
// prepareInventoryPortrait (./inventory-portraits.js, renderInventory). consumeAvailability
// (./foraging.js, consumePouchItem). document (global, renderInventory). ctx.state/
// ctx.modalKind/ctx.network/ctx.backgrounded/ctx.audio/ctx.victoryShown/ctx.victoryTimer/
// ctx.renderedMap (already-declared ctx data fields). ctx.toast/ctx.updateUI (already wired
// by M7's createHud/createGameAudio). ctx.showModal (M8's createModals -- lootCollected's
// victory reveal reaches across the module boundary). renderInventory calls itself (from the
// portrait-ready callback) and inventoryPreviews.refresh() directly -- both stay in this
// closure, same as updateUI calling updateClassHud directly in hud.js.
import {$} from './dom.js';
import {inventoryMarkup,bindInventoryPreviews} from './inventory.js';
import {updateInventoryResources} from './pouch.js';
import {inventoryPortraitStatus} from './character-art.js';
import {conceptFor} from './classes.js';
import {prepareInventoryPortrait} from './inventory-portraits.js';
import {consumeAvailability} from './foraging.js';
export function createInventoryUi(ctx){
 function lootCollected(drop,result){ctx.audio.play(drop.template==='bellkeeper-edge'?'relic':drop.kind==='item'?'equip':'pickup',.65);ctx.toast(drop.kind==='gold'?`+${drop.amount} crowns`:drop.kind==='item'?`${drop.name} recovered · Open inventory with I`:`${drop.amount} healing draught${drop.amount>1?'s':''} recovered`);if(drop.template==='bellkeeper-edge'&&!ctx.victoryShown){ctx.victoryShown=true;const worldId=ctx.network.worldId;ctx.victoryTimer=setTimeout(()=>{if(!ctx.state.ended&&ctx.renderedMap==='overworld'&&ctx.network.worldId===worldId)ctx.showModal('victory');},900);}ctx.updateUI();}
 const inventoryPreviews=bindInventoryPreviews($('modal-content'),()=>ctx.state,()=>!!ctx.network?.connected);
 function renderInventory(){
  const content=$('modal-content'),focused=content.contains(document.activeElement)?document.activeElement.closest('[data-select-item]'):null;
  const focusedFood=content.contains(document.activeElement)?document.activeElement.dataset?.consume:null;
  const focusedId=focused?.dataset.selectItem,inSlot=!!focused?.closest('.equipment-slot');
  const gridScroll=content.querySelector('.inventory-grid')?.scrollTop||0,modal=content.closest('.modal'),modalScroll=modal.scrollTop,contentScroll=content.scrollTop,stage=content.closest('.chronicle-stage'),stageScroll=stage.scrollTop;
  $('inventory-purse').innerHTML=`<strong data-resource="gold">${ctx.state.gold}</strong><span>Crowns</span>`;
  content.innerHTML=inventoryMarkup(ctx.state);
  content.querySelector('.inventory-grid').scrollTop=gridScroll;
  if(focusedId){
   const replacement=[...content.querySelectorAll('[data-select-item]')].find(tile=>tile.dataset.selectItem===focusedId&&!!tile.closest('.equipment-slot')===inSlot);
   replacement?.focus({preventScroll:true});
  }
  if(focusedFood)[...content.querySelectorAll('[data-consume]')].find(button=>button.dataset.consume===focusedFood)?.focus({preventScroll:true});
  updateInventoryResources(modal,ctx.state,!!ctx.network?.connected);
  modal.scrollTop=modalScroll;content.scrollTop=contentScroll;stage.scrollTop=stageScroll;
  inventoryPreviews.refresh();
  if(ctx.state.classId&&inventoryPortraitStatus(ctx.state.classId,ctx.state.appearanceId)==='idle'){
   const key=conceptFor(ctx.state.classId,ctx.state.appearanceId);
   const refresh=()=>{if(ctx.modalKind==='inventory'&&key===conceptFor(ctx.state.classId,ctx.state.appearanceId))renderInventory();};
   prepareInventoryPortrait(ctx.state.classId,ctx.state.appearanceId).then(refresh,refresh);
  }
 }
 function equipOwnedItem(id){
  if(ctx.modalKind!=='inventory')return{ok:false,reason:'Open your inventory first.'};
  const item=ctx.state.inventory.find(item=>item.id===id);
  if(!item)return{ok:false,reason:'You do not own that item.'};
  if(ctx.state.equipped[item.slot]===id)return{ok:true};
  return ctx.network?.send('equip',{id})?{ok:true}:{ok:false,reason:'Unable to equip while disconnected.'};
 }
 function consumePouchItem(itemId){
  if(ctx.modalKind!=='inventory')return {ok:false,reason:'Open your inventory to eat from your pouch.'};
  if(ctx.backgrounded)return {ok:false,reason:'Return to the game before eating.'};
  const available=consumeAvailability(ctx.state,itemId);if(!available.ok)return available;
  return ctx.network?.send('consume',{itemId})?{ok:true,pending:true}:{ok:false,reason:'Reconnect to eat.'};
 }
 return {renderInventory,equipOwnedItem,consumePouchItem,lootCollected,inventoryPreviews};
}
