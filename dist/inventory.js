import {pouchMarkup} from './pouch.js';
import {classFor,primaryDamage,classAppearance} from './classes.js';
import {portraitFor,weaponPortraitFor} from './character-art.js';
const escape=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const art=(item,state)=>item.slot==='weapon'&&weaponPortraitFor(state.classId,state.appearanceId)||`./assets/inventory/${item.slot==='weapon'?'sword':'charm'}.png`;
const inspectedItem=(state,id)=>state.inventory.find(item=>item.id===id)||state.inventory[0];

export function inventoryComparison(state,item){
 const current=state.inventory.find(owned=>owned.id===state.equipped[item.slot]);
 const difference=item.power-(current?.power??0);
 return [
  {stat:'damage',label:state.classId?'Primary hit damage':'Cleave damage',current:primaryDamage(state),change:item.slot==='weapon'?difference:0},
  {stat:'vitality',label:'Maximum vitality',current:state.maxHp,change:item.slot==='charm'?difference:0}
 ].map(row=>({...row,next:row.current+row.change,percent:row.current?row.change/row.current*100:null}));
}

export function inventoryDetailMarkup(state,id){
 const item=inspectedItem(state,id);
 if(!item)return '<p>Your satchel is empty.</p>';
 const equipped=state.equipped[item.slot]===item.id;
 const current=state.inventory.find(owned=>owned.id===state.equipped[item.slot]);
 const rows=inventoryComparison(state,item).map(row=>{
  const direction=row.change>0?'better':row.change<0?'worse':'unchanged';
  const delta=row.change===0?'No change':`${row.change>0?'+':'−'}${row.percent===null?Math.abs(row.change):Math.abs(row.percent).toFixed(1)+'%'}`;
  return `<div class="item-stat-change ${direction}" data-stat="${row.stat}"><dt>${row.label}</dt><dd><strong>${delta}</strong><span class="item-stat-values">${row.current}${row.change?` → ${row.next}`:''}</span></dd></div>`;
 }).join('');
 return `<div class="item-detail-heading"><span class="item-rarity">${escape(item.rarity)} ${escape(item.slot)}</span>${equipped?'<span class="item-equipped-status">Equipped</span>':''}</div><h3>${escape(item.name)}</h3><p>${escape(item.description)}</p><span class="item-bonus">${item.power?'+'+item.power+(item.slot==='weapon'?' primary damage':' maximum vitality'):'Starting weapon · No bonus damage'}</span><div class="item-comparison"><h4>${equipped?'Current equipment stats':'Stat changes if equipped'}</h4>${equipped?'':`<p class="item-compared-with">Compared with ${current?escape(current.name):'an empty '+escape(item.slot)+' slot'}</p>`}<dl>${rows}</dl></div>`;
}

// Update only the inspector: hovering must not replace the button under the pointer.
export function inspectInventoryItem(container,state,id){
 const item=inspectedItem(state,id),detail=container.querySelector('.inventory-detail');
 if(!detail)return;
 for(const tile of container.querySelectorAll('[data-select-item]')){
  const inspected=tile.dataset.selectItem===item?.id;
  tile.classList.toggle('selected',inspected);
  if(inspected)tile.setAttribute('aria-describedby','inventory-item-detail');
  else tile.removeAttribute('aria-describedby');
 }
 detail.className=`inventory-detail ${item?.rarity||''}`;
 detail.innerHTML=inventoryDetailMarkup(state,item?.id);
}

export function inventoryMarkup(state,selectedId){
 const selected=inspectedItem(state,selectedId);
 const equipped=item=>state.equipped[item.slot]===item.id;
 const tile=(item,slot=false)=>`<button type="button" class="gear-tile ${item.rarity} ${item.slot} ${selected?.id===item.id?'selected':''}" data-select-item="${escape(item.id)}" aria-label="${escape(item.name)}${equipped(item)?', equipped':', equip '+escape(item.slot)}" aria-pressed="${equipped(item)}"${selected?.id===item.id?' aria-describedby="inventory-item-detail"':''}><img src="${art(item,state)}" alt="" draggable="false">${equipped(item)&&!slot?'<span class="gear-equipped" aria-hidden="true">E</span>':''}</button>`;
 const slot=kind=>{const item=state.inventory.find(item=>item.id===state.equipped[kind]);return `<div class="equipment-slot ${kind}"><span>${kind}</span>${item?tile(item,true):'<div class="empty-equipment">Empty</div>'}</div>`;};
 const used=state.inventory.length;
 const cells=Math.max(24,Math.ceil(used/8)*8);
 return `<div class="inventory-character"><section class="inventory-attributes" aria-label="Character attributes"><h3>Attributes</h3><dl><div><dt>Level</dt><dd><span data-resource="level">${state.level}</span></dd></div><div><dt>Vitality</dt><dd><span data-resource="hp">${Math.ceil(state.hp)}</span> <small>/ <span data-resource="maxHp">${state.maxHp}</span></small></dd></div><div><dt>Essence</dt><dd><span data-resource="mana">${Math.floor(state.mana)}</span> <small>/ <span data-resource="maxMana">${state.maxMana}</span></small></dd></div><div class="stat-divider"><dt>${state.classId?'Primary hit':'Cleave'}</dt><dd>${primaryDamage(state)}</dd></div><div><dt>Honing</dt><dd><span data-resource="forgeLevel">${state.forgeLevel}</span> <small>/ 3</small></dd></div><div><dt>Draughts</dt><dd><span data-resource="potions">${state.potions}</span> <small>/ 5</small></dd></div></dl><div class="inventory-crowns"><strong data-resource="gold">${state.gold}</strong><span>Crowns</span></div></section><section class="equipment-view" aria-label="Equipped gear"><img class="warden-portrait" src="${portraitFor(state.classId,state.appearanceId)||'./assets/inventory/warden.png'}" alt="${escape(classAppearance(state.classId,state.appearanceId)?.name||classFor(state).name)}"><span class="warden-label">${escape(classFor(state).name)}</span>${slot('weapon')}${slot('charm')}</section></div>${pouchMarkup(state)}<div class="inventory-bag-heading"><h3>Satchel</h3><span>${state.inventory.length} ${state.inventory.length===1?'item':'items'}</span></div><div class="inventory-grid" aria-label="Owned items">${state.inventory.map(item=>tile(item)).join('')}${Array.from({length:cells-used},()=>'<span class="empty-cell" aria-hidden="true"></span>').join('')}</div><section id="inventory-item-detail" class="inventory-detail ${selected?.rarity||''}" aria-label="Item preview" aria-live="polite" aria-atomic="true">${inventoryDetailMarkup(state,selected?.id)}</section><p class="inventory-hint"><span class="inventory-pointer-hint">Hover or focus to compare · Click or press Enter to equip</span><span class="inventory-touch-hint">Tap an item to equip</span><br>Collect marked loot with <kbd>F</kbd></p>`;
}
