import test from 'node:test';
import assert from 'node:assert/strict';
import {createState} from '../dist/combat.js';
import {createCampaign,ITEM_TEMPLATES,equipItem} from '../dist/campaign.js';
import {inventoryComparison,inventoryDetailMarkup,inventoryMarkup} from '../dist/inventory.js';

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
 assert.match(inventoryDetailMarkup(state,'starting-sword'),/item-equipped-status">Equipped/);
 assert.deepEqual(state,before);
 assert.match(inventoryDetailMarkup(state,'missing'),/Warden’s longsword/);
 state.inventory=[];state.equipped={weapon:null,charm:null};
 assert.match(inventoryMarkup(state,'missing'),/Your satchel is empty/);
});
