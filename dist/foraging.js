// Shared food rules. Only the server mutates live player state.
export const POUCH_CAPACITY=5;
export const FOOD_COOLDOWN=2;
export const FORAGE_REGROW_SECONDS=180;
export const FOOD_LIST=Object.freeze([
 {id:'crimson-mushroom',name:'Crimson mushroom',effect:'+35 health',health:35,essence:0,regen:0,color:'#d77e70',icon:'M3 13a9 9 0 0 1 18 0H3Zm7 0-1 8h6l-1-8M8 8h.01M14 6h.01M17 10h.01'},
 {id:'moonleaf-herb',name:'Moonleaf herb',effect:'+40 essence over 5 seconds',health:0,essence:0,regen:5,color:'#94d4ca',icon:'M12 22V10M12 15C3 15 3 8 3 6c7 0 9 4 9 9Zm0-5c0-7 4-8 8-8 0 7-3 8-8 8Zm0 10c0-7 4-8 9-8 0 7-4 8-9 8Z'},
 {id:'bramble-berries',name:'Bramble berries',effect:'+15 health · +15 essence',health:15,essence:15,regen:0,color:'#cca0d9',icon:'M12 8V3m0 4c4-5 8-4 9-4-1 4-5 5-9 4ZM11 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0Zm10 0a4 4 0 1 1-8 0 4 4 0 0 1 8 0Zm-5 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0Z'}
].map(Object.freeze));
export const foodFor=id=>FOOD_LIST.find(food=>food.id===id);
export const foodIcon=food=>`<svg viewBox="0 0 24 24" aria-hidden="true"><path d="${food.icon}"/></svg>`;
export function createForagingState(){return {pouch:Object.fromEntries(FOOD_LIST.map(food=>[food.id,0])),foodCooldown:0,essenceRegen:0};}

// Fixed outdoor patches: one of each in Ashwick, three on the road, two in Hallowmere.
export const FORAGE_PATCHES=Object.freeze([
 ['ashwick',-67.5,7.2],['ashwick',-68,10.5],['ashwick',-59,7],
 ['road',-53,2],['road',-50,8],['road',-47,3],
 ['road',-44,9],['road',-41,1],['road',-38,7],
 ['road',-35,2],['road',-31,9],['road',-27,6],
 ['hallowmere',-18,8],['hallowmere',-18,-10],['hallowmere',-6,12],
 ['hallowmere',5,9],['hallowmere',6,-6],['hallowmere',6,-22]
].map(([zone,x,z],i)=>Object.freeze({id:`forage-${i+1}`,itemId:FOOD_LIST[i%3].id,zone,x,z})));

export function harvestFood(state,itemId){
 const food=foodFor(itemId);
 if(!food)return {ok:false,reason:'Unknown forage.'};
 if(state.ended||state.hp<=0)return {ok:false,reason:'Return to Ashwick before foraging.'};
 if(state.pouch[itemId]>=POUCH_CAPACITY)return {ok:false,reason:`Your ${food.name.toLowerCase()} stack is full (${POUCH_CAPACITY} / ${POUCH_CAPACITY}). Eat one from Inventory first.`};
 state.pouch[itemId]++;
 return {ok:true,itemId,message:`${food.name} gathered · ${state.pouch[itemId]} / ${POUCH_CAPACITY} in your pouch · Open Inventory with I`};
}
export function consumeAvailability(state,itemId){
 const food=foodFor(itemId);
 if(!food)return {ok:false,reason:'Unknown food.'};
 if(state.ended||state.hp<=0)return {ok:false,reason:'Return to Ashwick before eating.'};
 if(!(state.pouch?.[itemId]>0))return {ok:false,reason:'Forage this food to fill your pouch.'};
 if(food.regen&&state.essenceRegen>0)return {ok:false,reason:'Moonleaf is already restoring essence.'};
 if(state.foodCooldown>0)return {ok:false,reason:`Ready in ${state.foodCooldown.toFixed(1)}s`};
 if(!(food.health&&state.hp<state.maxHp)&&!((food.essence||food.regen)&&state.mana<state.maxMana))return {ok:false,reason:food.health&&!food.essence?'Health is full.':!food.health?'Essence is full.':'Health and essence are full.'};
 return {ok:true};
}
export function consumeFood(state,itemId){
 const available=consumeAvailability(state,itemId);if(!available.ok)return available;
 const food=foodFor(itemId),hp=state.hp,mana=state.mana;
 state.pouch[itemId]--;state.foodCooldown=FOOD_COOLDOWN;
 state.hp=Math.min(state.maxHp,state.hp+food.health);
 state.mana=Math.min(state.maxMana,state.mana+food.essence);
 if(food.regen)state.essenceRegen=food.regen;
 return {ok:true,itemId,health:state.hp-hp,essence:state.mana-mana,message:`${food.name} eaten · ${food.effect}`};
}
export function advanceForaging(state,dt){
 if(state.ended||state.hp<=0){state.essenceRegen=0;return;}
 if(!Number.isFinite(dt)||dt<=0)return;
 state.foodCooldown=Math.max(0,state.foodCooldown-dt);
 const active=Math.min(dt,state.essenceRegen);
 state.mana=Math.min(state.maxMana,state.mana+active*8);
 state.essenceRegen=Math.max(0,state.essenceRegen-dt);
}
