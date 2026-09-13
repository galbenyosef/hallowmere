import test from 'node:test';
import assert from 'node:assert/strict';
import {createResourceOrbs} from '../dist/resource-orbs.js';
import {createState,hurtPlayer,useAbility,advanceState} from '../dist/combat.js';

function setup(t){
 const hosts=['.orb.health','.orb.mana'].map(()=>({
  ring:{style:{}},attributes:{},
  querySelector(selector){assert.equal(selector,'.resource-fill');return this.ring;},
  setAttribute(key,value){this.attributes[key]=value;},
 }));
 const previous=globalThis.document;
 globalThis.document={querySelector:selector=>hosts[['.orb.health','.orb.mana'].indexOf(selector)]};
 t.after(()=>{if(previous===undefined)delete globalThis.document;else globalThis.document=previous;});
 const gauges=createResourceOrbs();
 return {hosts,gauges};
}

test('resource gauges reflect damage, healing, spell costs, regeneration, and death independently',t=>{
 const {hosts:[health,mana],gauges}=setup(t),state=createState();
 const render=()=>gauges.update(0,state.hp/state.maxHp,state.mana/state.maxMana);
 const remaining=host=>100-Number(host.ring.style.strokeDashoffset);
 render();assert.equal(remaining(health),100);assert.equal(remaining(mana),100);
 hurtPlayer(state,70);useAbility(state,'nova');render();
 assert.equal(remaining(health),50);assert.equal(remaining(mana),65);
 assert.equal(health.attributes['aria-valuenow'],'50');assert.equal(mana.attributes['aria-valuenow'],'65');
 useAbility(state,'heal');render();assert.ok(remaining(health)>96);assert.equal(remaining(mana),65);
 advanceState(state,10);render();assert.equal(remaining(mana),100);
 hurtPlayer(state,999);render();assert.equal(remaining(health),0);assert.equal(remaining(mana),100);
});

test('resource gauges handle different capacities and constrain invalid or out-of-range snapshots',t=>{
 const {hosts:[health,mana],gauges}=setup(t);
 gauges.update(0,175/350,30/120);
 assert.equal(health.ring.style.strokeDashoffset,'50');assert.equal(mana.ring.style.strokeDashoffset,'75');
 gauges.update(0,-.1,1.5);
 assert.equal(health.ring.style.strokeDashoffset,'100');assert.equal(mana.ring.style.strokeDashoffset,'0');
 gauges.update(0,NaN,Infinity);
 assert.equal(health.attributes['aria-valuenow'],'0');assert.equal(mana.attributes['aria-valuenow'],'0');
});
