import {FOOD_LIST,POUCH_CAPACITY,foodFor,foodIcon,consumeAvailability} from './foraging.js';

const statusFor=(state,food,connected)=>connected?consumeAvailability(state,food.id):{ok:false,reason:'Reconnect to eat.'};
const regenStatus=state=>state.essenceRegen>0?`Moonleaf · +8 essence / second · ${state.essenceRegen.toFixed(1)}s left`:'Moonleaf restores essence alongside your natural regeneration.';
export function pouchMarkup(state){
 return `<section class="inventory-pouch" aria-label="Foraging pouch"><div class="inventory-bag-heading"><h3>Pouch</h3><span>${POUCH_CAPACITY} of each food</span></div><div class="inventory-grid" aria-label="Pouch items">${FOOD_LIST.map(food=>{
  const status=statusFor(state,food,true);
  return `<button type="button" class="gear-tile pouch-tile" data-food="${food.id}" data-consume="${food.id}" style="--food-color:${food.color}" aria-label="Eat ${food.name}, ${state.pouch?.[food.id]||0} of ${POUCH_CAPACITY}, ${status.reason||'Ready to eat'}" aria-disabled="${!status.ok}"><span class="pouch-icon">${foodIcon(food)}</span><span class="pouch-count" data-food-count>${state.pouch?.[food.id]||0}</span></button>`;
 }).join('')}${Array.from({length:5},()=>'<span class="empty-cell" aria-hidden="true"></span>').join('')}</div><p class="pouch-regen" data-pouch-regen>${regenStatus(state)}</p><p class="pouch-guidance">Click food to eat · Shared 2-second cooldown</p></section>`;
}

export function pouchDetailMarkup(state,id,connected=true){
 const food=foodFor(id);if(!food)return '';
 const status=statusFor(state,food,connected);
 return `<div data-preview-food="${food.id}" style="--food-color:${food.color}"><span class="item-rarity">Foraged food</span><h3>${food.name}</h3><p>${food.effect}</p><span class="item-bonus"><span data-food-count>${state.pouch?.[food.id]||0} / ${POUCH_CAPACITY}</span> in pouch</span><p data-food-status>${status.reason||'Ready to eat'}</p><p class="pouch-guidance">Click or press Enter to eat.</p></div>`;
}

// Patch only text and availability: snapshots must preserve focus, scroll and gear previews.
export function updateInventoryResources(container,state,connected=true){
 const text=(node,value)=>{if(node&&node.textContent!==value)node.textContent=value;};
 for(const food of FOOD_LIST){
  const row=container.querySelector(`[data-food="${food.id}"]`);if(!row)continue;
  const status=statusFor(state,food,connected);
  text(row.querySelector('[data-food-count]'),String(state.pouch?.[food.id]||0));
  row.setAttribute('aria-disabled',String(!status.ok));
  row.setAttribute('aria-label',`Eat ${food.name}, ${state.pouch?.[food.id]||0} of ${POUCH_CAPACITY}, ${status.reason||'Ready to eat'}`);
  const preview=container.querySelector(`[data-preview-food="${food.id}"]`);
  if(preview){
   text(preview.querySelector('[data-food-count]'),`${state.pouch?.[food.id]||0} / ${POUCH_CAPACITY}`);
   text(preview.querySelector('[data-food-status]'),status.reason||'Ready to eat');
  }
 }
 text(container.querySelector('[data-pouch-regen]'),regenStatus(state));
 for(const [key,value] of Object.entries({hp:Math.ceil(state.hp),mana:Math.floor(state.mana),maxHp:state.maxHp,maxMana:state.maxMana,potions:state.potions,gold:state.gold,level:state.level,forgeLevel:state.forgeLevel}))text(container.querySelector(`[data-resource="${key}"]`),String(value));
}
