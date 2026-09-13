import test from 'node:test';
import assert from 'node:assert/strict';
import {createState} from '../dist/combat.js';
import {createCampaign,ITEM_TEMPLATES,equipItem} from '../dist/campaign.js';
import {inventoryComparison,inventoryDetailMarkup,inventoryMarkup,inventoryTooltipPosition,bindInventoryPreviews} from '../dist/inventory.js';

function game(){
 const state={...createState(),...createCampaign(42)};
 state.inventory.push(...Object.entries(ITEM_TEMPLATES).map(([id,item])=>({id,...item})));
 return state;
}

test('inventory previews match actual equipment outcomes across levels, honing, and gear swaps without changing the player',()=>{
 for(const level of [1,4])for(const forgeLevel of [0,3]){
  const state=game();state.level=level;state.forgeLevel=forgeLevel;state.hp=70;
  for(const current of state.inventory){
   equipItem(state,current.id);
   for(const candidate of state.inventory){
    const before=structuredClone(state),preview=inventoryComparison(state,candidate);
    assert.deepEqual(state,before,'Preview must not equip gear or change health');
    const after=structuredClone(state);equipItem(after,candidate.id);
    assert.equal(preview[0].next,28+after.level*2+after.damageBonus);
    assert.equal(preview[1].next,after.maxHp);
    for(const row of preview){
     assert.equal(row.change,row.next-row.current);
     assert.equal(row.percent,(row.next-row.current)/row.current*100);
    }
   }
  }
 }
});

test('weapon upgrades and downgrades show signed percentages against total cleave, including the starting blade',()=>{
 const state=game();
 let detail=inventoryDetailMarkup(state,'cinder-blade');
 assert.match(detail,/Stat changes if equipped/);
 assert.match(detail,/item-stat-change better/);
 assert.match(detail,/\+36\.7%/);
 assert.match(detail,/30 → 41/);
 equipItem(state,'cinder-blade');
 detail=inventoryDetailMarkup(state,'starting-sword');
 assert.match(detail,/item-stat-change worse/);
 assert.match(detail,/−26\.8%/);
 assert.match(detail,/41 → 30/);
 assert.match(detail,/Compared with Cindersteel blade/);
});

test('charms compare against the charm slot and equal-power gear remains neutral',()=>{
 const state=game();equipItem(state,'bellkeeper-edge');
 let detail=inventoryDetailMarkup(state,'oak-charm');
 assert.match(detail,/Compared with an empty charm slot/);
 assert.match(detail,/\+14\.3%/);
 assert.match(detail,/140 → 160/);
 assert.deepEqual(inventoryComparison(state,state.inventory.find(item=>item.id==='oak-charm')).map(row=>row.change),[0,20]);
 equipItem(state,'oak-charm');
 state.inventory.push({id:'another-charm',...ITEM_TEMPLATES['oak-charm']});
 detail=inventoryDetailMarkup(state,'another-charm');
 assert.doesNotMatch(detail,/item-stat-change (better|worse)/);
 assert.match(detail,/No change/);
 assert.doesNotMatch(detail,/item-equipped-status/);
});

test('inspected items keep actual equipped semantics, with no separate equip action, and handle stale or empty selection',()=>{
 const state=game(),before=structuredClone(state);
 const markup=inventoryMarkup(state,'iron-falchion');
 assert.match(markup,/data-select-item="iron-falchion"[^>]*aria-pressed="false"/);
 assert.match(markup,/data-select-item="starting-sword"[^>]*aria-pressed="true"/);
 assert.doesNotMatch(markup,/data-equip=|inventory-equip\b/);
 assert.match(markup,/role="tooltip" popover="manual" hidden><\/div>/);
 assert.doesNotMatch(markup,/item-comparison|aria-describedby=/);
 assert.match(inventoryDetailMarkup(state,'starting-sword'),/item-equipped-status">Equipped/);
 assert.deepEqual(state,before);
 assert.match(inventoryDetailMarkup(state,'missing'),/Warden’s longsword/);
 state.inventory=[];state.equipped={weapon:null,charm:null};
 assert.match(inventoryMarkup(state,'missing'),/Your satchel is empty/);
});

test('item tooltip stays within desktop and narrow viewports and avoids covering its tile when space allows',()=>{
 const desktop={width:1280,height:800},tooltip={width:340,height:320};
 assert.deepEqual(inventoryTooltipPosition({left:400,right:450,top:100,bottom:150},tooltip,desktop),{left:458,top:100});
 assert.deepEqual(inventoryTooltipPosition({left:1100,right:1150,top:600,bottom:650},tooltip,desktop),{left:752,top:472});
 assert.deepEqual(inventoryTooltipPosition({left:100,right:150,top:550,bottom:600},tooltip,{width:390,height:700}),{left:42,top:222});
 assert.deepEqual(inventoryTooltipPosition({left:20,right:60,top:30,bottom:70},tooltip,{width:390,height:700}),{left:20,top:78});
});

test('item previews appear on hover, focus and tap, dismiss with Escape, and survive gear refresh without equipping',()=>{
 const state=game(),before=structuredClone(state),listeners=new Map(),documentListeners=new Map(),timers=new Map();let timerId=0;
 const view={innerWidth:1280,innerHeight:800,addEventListener(){},setTimeout(fn){timers.set(++timerId,fn);return timerId;},clearTimeout(id){timers.delete(id);}};
 const doc={defaultView:view,activeElement:null,addEventListener:(type,fn)=>documentListeners.set(type,fn)};
 const tile=dataset=>({dataset,isConnected:true,hovered:false,attrs:{},classList:{add(){},remove(){}},setAttribute(k,v){this.attrs[k]=v;},removeAttribute(k){delete this.attrs[k];},matches(){return this.hovered;},contains(other){return other===this;},closest(selector){return selector==='.equipment-slot'||selector==='.inventory-detail'?null:this;},getBoundingClientRect:()=>({left:500,right:550,top:100,bottom:150})});
 let gear=tile({selectItem:'iron-falchion'});const food=tile({consume:'crimson-mushroom'});
 const preview={id:'inventory-item-detail',hidden:true,open:false,hovered:false,style:{},matches(selector){return selector===':popover-open'?this.open:this.hovered;},showPopover(){this.open=true;},hidePopover(){this.open=false;},getBoundingClientRect:()=>({width:340,height:320})};
 const container={ownerDocument:doc,querySelector:()=>preview,querySelectorAll:()=>[gear,food],addEventListener:(type,fn)=>listeners.set(type,fn)};
 const controller=bindInventoryPreviews(container,()=>state);
 const flush=()=>{for(const fn of timers.values())fn();timers.clear();};
 listeners.get('pointerover')({target:gear,pointerType:'mouse'});
 assert.equal(preview.hidden,false);assert.match(preview.innerHTML,/uncommon weapon/);assert.equal(gear.attrs['aria-describedby'],preview.id);
 preview.hovered=true;listeners.get('pointerout')({});flush();assert.equal(preview.hidden,false,'Tooltip stays readable when the pointer enters it');
 preview.hovered=false;listeners.get('pointerout')({});flush();assert.equal(preview.hidden,true);assert.equal(gear.attrs['aria-describedby'],undefined);
 doc.activeElement=gear;listeners.get('focusin')({target:gear});assert.equal(preview.hidden,false);
 const key={key:'Escape',preventDefault(){this.prevented=true;},stopPropagation(){this.stopped=true;}};
 documentListeners.get('keydown')(key);assert.equal(preview.hidden,true);assert.ok(key.prevented&&key.stopped,'Escape dismisses the tooltip before the inventory');
 doc.activeElement=null;listeners.get('pointerover')({target:gear,pointerType:'mouse'});documentListeners.get('keydown')(key);assert.equal(preview.hidden,true,'Escape also dismisses a hover preview when its tile is not focused');
 listeners.get('click')({target:food});assert.match(preview.innerHTML,/Crimson mushroom/);assert.match(preview.innerHTML,/Forage this food/);
 listeners.get('pointerover')({target:gear,pointerType:'mouse'});
 const previous=gear;previous.isConnected=false;gear=tile({selectItem:'iron-falchion'});controller.refresh();
 assert.equal(gear.attrs['aria-describedby'],preview.id);assert.equal(previous.attrs['aria-describedby'],undefined);
 controller.hide();assert.equal(preview.hidden,true);assert.equal(preview.open,false);assert.deepEqual(state,before);
});
