import {FOOD_LIST,POUCH_CAPACITY,foodIcon,consumeAvailability} from './foraging.js';

const statusFor=(state,food,connected)=>connected?consumeAvailability(state,food.id):{ok:false,reason:'Reconnect to eat.'};
const regenStatus=state=>state.essenceRegen>0?`Moonleaf · +8 essence / second · ${state.essenceRegen.toFixed(1)}s left`:'Moonleaf restores essence alongside your natural regeneration.';
export function pouchMarkup(state){
 return `<section class="inventory-pouch" aria-label="Foraging pouch"><div class="inventory-bag-heading"><h3>Pouch</h3><span>${POUCH_CAPACITY} of each food</span></div><div class="pouch-foods">${FOOD_LIST.map(food=>{
  const status=statusFor(state,food,true);
  return `<div class="pouch-food" data-food="${food.id}" style="--food-color:${food.color}"><span class="pouch-icon">${foodIcon(food)}</span><div class="pouch-copy"><h4>${food.name}</h4><p>${food.effect}</p><small data-food-status>${status.reason||'Ready to eat'}</small></div><div class="pouch-action"><span data-food-count>${state.pouch?.[food.id]||0} / ${POUCH_CAPACITY}</span><button type="button" data-consume="${food.id}" aria-label="Eat ${food.name}" aria-disabled="${!status.ok}">Eat</button></div></div>`;
 }).join('')}</div><p class="pouch-regen" data-pouch-regen>${regenStatus(state)}</p><p class="pouch-guidance">Harvest plants with <kbd>F</kbd> or their labels. Eat from your pouch here. Foods share a 2-second cooldown; draughts stay on your belt. The world keeps moving while Inventory is open.</p></section>`;
}

// Patch only text and availability: snapshots must preserve focus, scroll and gear previews.
export function updateInventoryResources(container,state,connected=true){
 const text=(node,value)=>{if(node&&node.textContent!==value)node.textContent=value;};
 for(const food of FOOD_LIST){
  const row=container.querySelector(`[data-food="${food.id}"]`);if(!row)continue;
  const status=statusFor(state,food,connected);
  text(row.querySelector('[data-food-count]'),`${state.pouch?.[food.id]||0} / ${POUCH_CAPACITY}`);
  text(row.querySelector('[data-food-status]'),status.reason||'Ready to eat');
  row.querySelector('[data-consume]').setAttribute('aria-disabled',String(!status.ok));
 }
 text(container.querySelector('[data-pouch-regen]'),regenStatus(state));
 for(const [key,value] of Object.entries({hp:Math.ceil(state.hp),mana:Math.floor(state.mana),maxHp:state.maxHp,maxMana:state.maxMana,potions:state.potions,gold:state.gold,level:state.level,forgeLevel:state.forgeLevel}))text(container.querySelector(`[data-resource="${key}"]`),String(value));
}
