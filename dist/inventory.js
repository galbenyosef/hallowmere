import {classFor,primaryDamage,classAppearance} from './classes.js';
import {portraitFor,weaponPortraitFor,inventoryPortraitFor,inventoryPortraitStatus} from './character-art.js';
const escape=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const art=(item,state)=>item.slot==='weapon'?(weaponPortraitFor(state.classId,state.appearanceId)||(!state.classId?'./assets/inventory/sword.png':null)):'./assets/inventory/charm.png';
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
  const selected=inspectedItem(state,selectedId),calling=classFor(state);
  const appearance=classAppearance(state.classId,state.appearanceId);
  const equipped=item=>state.equipped[item.slot]===item.id;
  const tile=(item,slot=false)=>`<button type="button" class="gear-tile ${item.rarity} ${item.slot} ${selected?.id===item.id?'selected':''}" data-select-item="${escape(item.id)}" aria-label="${escape(item.name)}${equipped(item)?', equipped':', equip '+escape(item.slot)}" aria-pressed="${equipped(item)}"${selected?.id===item.id?' aria-describedby="inventory-item-detail"':''}>${art(item,state)?`<img class="${item.slot==='weapon'&&weaponPortraitFor(state.classId,state.appearanceId)?'':'legacy-item-art'}" src="${art(item,state)}" alt="" draggable="false">`:`<span class="gear-art-label" aria-hidden="true">${escape(calling.weaponType||item.slot)}</span>`}${equipped(item)&&!slot?'<span class="gear-equipped" aria-hidden="true">E</span>':''}</button>`;
  const slot=kind=>{
    const item=state.inventory.find(item=>item.id===state.equipped[kind]);
    return `<div class="equipment-slot ${kind}">${item?tile(item,true):'<div class="empty-equipment">Empty</div>'}<div><span>${kind}</span><strong>${item?escape(item.name):'No '+kind+' equipped'}</strong></div></div>`;
  };
  const used=state.inventory.length,cells=Math.max(24,Math.ceil(used/8)*8);
  const portrait=inventoryPortraitFor(state.classId,state.appearanceId)||portraitFor(state.classId,state.appearanceId)||(!state.classId?'./assets/inventory/warden.png':null);
  const portraitStatus=inventoryPortraitStatus(state.classId,state.appearanceId);
  return `<div class="inventory-layout">
    <div class="inventory-character">
      <section class="equipment-view" aria-label="Equipped character">
        <div class="inventory-identity"><h3>${escape(appearance?.name||calling.name)}</h3><p>${escape(calling.role)}</p></div>
        <div class="inventory-portrait-stage">${portrait?`<img class="warden-portrait" src="${portrait}" alt="${escape(appearance?.name||calling.name)} with their in-game equipment" draggable="false">`:`<p class="inventory-portrait-placeholder" role="status">${portraitStatus==='error'?'Character preview unavailable':'Preparing character preview…'}</p>`}</div>
        <div class="inventory-equipment" aria-label="Equipped gear">${slot('weapon')}${slot('charm')}</div>
      </section>
      <section class="inventory-attributes" aria-label="Character attributes"><h3>Attributes</h3><dl>
        <div class="vitality-stat"><dt>Vitality</dt><dd>${Math.ceil(state.hp)} <small>/ ${state.maxHp}</small></dd></div>
        <div class="essence-stat"><dt>Essence</dt><dd>${Math.floor(state.mana)} <small>/ ${state.maxMana}</small></dd></div>
        <div><dt>${state.classId?'Primary hit':'Cleave'}</dt><dd>${primaryDamage(state)}</dd></div>
        <div><dt>Level</dt><dd>${state.level}</dd></div>
        <div><dt>Honing</dt><dd>${state.forgeLevel} <small>/ 3</small></dd></div>
        <div><dt>Draughts</dt><dd>${state.potions} <small>/ 5</small></dd></div>
      </dl></section>
    </div>
    <div class="inventory-belongings">
      <section class="inventory-satchel" aria-label="Satchel">
        <div class="inventory-bag-heading"><h3>Satchel</h3><span>${used} ${used===1?'item':'items'}</span></div>
        <div class="inventory-grid" aria-label="Owned items">${state.inventory.map(item=>tile(item)).join('')}${Array.from({length:cells-used},()=>'<span class="empty-cell" aria-hidden="true"></span>').join('')}</div>
      </section>
      <section id="inventory-item-detail" class="inventory-detail ${selected?.rarity||''}" aria-label="Item preview" aria-live="polite" aria-atomic="true">${inventoryDetailMarkup(state,selected?.id)}</section>
    </div>
  </div>`;
}
