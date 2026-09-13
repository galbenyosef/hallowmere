import {pouchMarkup,pouchDetailMarkup} from './pouch.js';
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

export function inventoryTooltipPosition(anchor,tooltip,viewport){
 const gap=8,clamp=(value,max)=>Math.max(gap,Math.min(value,max-gap));
 let left=anchor.right+gap,top=anchor.top;
 if(left+tooltip.width>viewport.width-gap){
  left=anchor.left-tooltip.width-gap;
  if(left<gap){
   left=anchor.left;
   top=anchor.bottom+gap+tooltip.height<=viewport.height-gap?anchor.bottom+gap:anchor.top-tooltip.height-gap;
  }
 }
 return {left:clamp(left,viewport.width-tooltip.width),top:clamp(top,viewport.height-tooltip.height)};
}

// A single floating preview keeps both grids stable while inspecting their tiles.
export function bindInventoryPreviews(container,getState,isConnected=()=>true){
 const doc=container.ownerDocument,view=doc.defaultView,selector='[data-select-item], [data-consume]';
 let anchor=null,hideTimer;
 const detail=()=>container.querySelector('.inventory-detail');
 const hide=()=>{
  view.clearTimeout(hideTimer);
  anchor?.classList.remove('selected');anchor?.removeAttribute('aria-describedby');anchor=null;
  const preview=detail();if(!preview)return;
  if(preview.matches(':popover-open'))preview.hidePopover();
  preview.hidden=true;
 };
 const position=()=>{
  const preview=detail();if(!anchor?.isConnected||!preview||preview.hidden)return;
  const bounds=anchor.getBoundingClientRect();
  if(bounds.bottom<=0||bounds.top>=view.innerHeight){hide();return;}
  const point=inventoryTooltipPosition(bounds,preview.getBoundingClientRect(),{width:view.innerWidth,height:view.innerHeight});
  preview.style.left=`${point.left}px`;preview.style.top=`${point.top}px`;
 };
 const show=tile=>{
  const preview=detail();if(!tile||!preview)return;
  view.clearTimeout(hideTimer);
  if(anchor!==tile){anchor?.classList.remove('selected');anchor?.removeAttribute('aria-describedby');}
  anchor=tile;
  const state=getState(),item=state.inventory.find(item=>item.id===tile.dataset.selectItem);
  preview.className=`inventory-detail ${item?.rarity||''}`;
  preview.innerHTML=item?inventoryDetailMarkup(state,item.id):pouchDetailMarkup(state,tile.dataset.consume,isConnected());
  preview.hidden=false;
  if(!preview.matches(':popover-open'))preview.showPopover();
  tile.classList.add('selected');tile.setAttribute('aria-describedby',preview.id);
  position();
 };
 const scheduleHide=()=>{
  view.clearTimeout(hideTimer);
  hideTimer=view.setTimeout(()=>{
   if(anchor?.matches(':hover')||detail()?.matches(':hover')||doc.activeElement===anchor)return;
   hide();
  },120);
 };
 container.addEventListener('pointerover',event=>{
  if(event.pointerType==='touch')return;
  const tile=event.target.closest(selector);
  if(tile&&!tile.contains(event.relatedTarget))show(tile);
  else if(event.target.closest('.inventory-detail'))view.clearTimeout(hideTimer);
 });
 container.addEventListener('pointerout',scheduleHide);
 container.addEventListener('focusin',event=>{const tile=event.target.closest(selector);if(tile)show(tile);});
 container.addEventListener('click',event=>{const tile=event.target.closest(selector);if(tile)show(tile);});
 container.addEventListener('focusout',scheduleHide);
 doc.addEventListener('keydown',event=>{
  if(event.key==='Escape'&&anchor){event.preventDefault();event.stopPropagation();hide();}
 });
 doc.addEventListener('scroll',event=>{
  if(!anchor||event.target.closest?.('.inventory-detail'))return;
  // Keyboard focus may scroll a tile into view before its preview is measured.
  doc.activeElement===anchor?position():hide();
 },true);
 doc.addEventListener('pointerdown',event=>{if(!event.target.closest(selector+', .inventory-detail'))hide();});
 view.addEventListener('resize',position);
 return {hide,refresh(){
  if(!anchor)return;
  const previous=anchor;
  const replacement=[...container.querySelectorAll(selector)].find(tile=>tile.dataset.selectItem===previous.dataset.selectItem&&tile.dataset.consume===previous.dataset.consume&&!!tile.closest('.equipment-slot')===!!previous.closest('.equipment-slot'));
  replacement?show(replacement):hide();
 }};
}

export function inventoryMarkup(state){
  const calling=classFor(state);
  const appearance=classAppearance(state.classId,state.appearanceId);
  const equipped=item=>state.equipped[item.slot]===item.id;
  const tile=(item,slot=false)=>`<button type="button" class="gear-tile ${item.rarity} ${item.slot}" data-select-item="${escape(item.id)}" aria-label="${escape(item.name)}${equipped(item)?', equipped':', equip '+escape(item.slot)}" aria-pressed="${equipped(item)}">${art(item,state)?`<img class="${item.slot==='weapon'&&weaponPortraitFor(state.classId,state.appearanceId)?'':'legacy-item-art'}" src="${art(item,state)}" alt="" draggable="false">`:`<span class="gear-art-label" aria-hidden="true">${escape(calling.weaponType||item.slot)}</span>`}${equipped(item)&&!slot?'<span class="gear-equipped" aria-hidden="true">E</span>':''}</button>`;
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
        <div class="inventory-loadout">
          <div class="inventory-equipment" role="group" aria-label="Equipped gear">${slot('weapon')}${slot('charm')}</div>
          <div class="inventory-portrait-stage">${portrait?`<img class="warden-portrait" src="${portrait}" alt="${escape(appearance?.name||calling.name)} with their in-game equipment" draggable="false">`:`<p class="inventory-portrait-placeholder" role="status">${portraitStatus==='error'?'Character preview unavailable':'Preparing character preview…'}</p>`}</div>
        </div>
      </section>
      <section class="inventory-attributes" aria-label="Character attributes"><h3>Attributes</h3><dl>
        <div class="vitality-stat"><dt>Vitality</dt><dd><span data-resource="hp">${Math.ceil(state.hp)}</span> <small>/ <span data-resource="maxHp">${state.maxHp}</span></small></dd></div>
        <div class="essence-stat"><dt>Essence</dt><dd><span data-resource="mana">${Math.floor(state.mana)}</span> <small>/ <span data-resource="maxMana">${state.maxMana}</span></small></dd></div>
        <div><dt>${state.classId?'Primary hit':'Cleave'}</dt><dd>${primaryDamage(state)}</dd></div>
        <div><dt>Level</dt><dd><span data-resource="level">${state.level}</span></dd></div>
        <div><dt>Honing</dt><dd><span data-resource="forgeLevel">${state.forgeLevel}</span> <small>/ 3</small></dd></div>
        <div><dt>Draughts</dt><dd><span data-resource="potions">${state.potions}</span> <small>/ 5</small></dd></div>
      </dl></section>
    </div>
    <div class="inventory-belongings">
      <section class="inventory-satchel" aria-label="Satchel">
        <div class="inventory-bag-heading"><h3>Satchel</h3><span>${used} ${used===1?'item':'items'}</span></div>
        <div class="inventory-grid" aria-label="Owned items">${state.inventory.map(item=>tile(item)).join('')}${Array.from({length:cells-used},()=>'<span class="empty-cell" aria-hidden="true"></span>').join('')}</div>
        ${used?'':'<p class="inventory-empty-message">Your satchel is empty.</p>'}
      </section>
      ${pouchMarkup(state)}
    </div>
  </div><div id="inventory-item-detail" class="inventory-detail" role="tooltip" popover="manual" hidden></div>`;
}
