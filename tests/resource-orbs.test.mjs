import test from 'node:test';
import assert from 'node:assert/strict';
import {createResourceOrbs} from '../dist/resource-orbs.js';
import {installGlobals} from './helpers/dom.mjs';

function setup(t,{healthCanvas=true,reduced=false,missingHealth=false}={}){
 const contexts=[],motion={matches:reduced};
 const host=()=>({classes:new Set(),parentElement:{style:{setProperty(name,value){this[name]=value;}}},prepend(canvas){this.canvas=canvas;},classList:{}});
 const health=host(),mana=host();
 for(const h of [health,mana])h.classList={add:name=>h.classes.add(name),remove:name=>h.classes.delete(name)};
 globalThis.matchMedia=()=>motion;
 let created=0;
 globalThis.document={querySelector:selector=>selector==='.orb.health'?(missingHealth?null:health):mana,createElement(){
  const calls=[],gradient={addColorStop(){}},ctx=new Proxy({calls},{get(target,key){if(key in target)return target[key];if(key==='createRadialGradient'||key==='createLinearGradient')return()=>gradient;return(...args)=>calls.push([key,...args]);}});
  const supported=missingHealth||created++>0||healthCanvas;contexts.push(ctx);
  return{events:{},setAttribute(){},getContext:()=>supported?ctx:null,addEventListener(name,fn){this.events[name]=fn;}};
 }};
 return{health,mana,motion,contexts,orbs:createResourceOrbs()};
}
// Restore browser globals after each isolated renderer test.
function browserTest(name,run){test(name,t=>{
 installGlobals(t,{document:()=>{},matchMedia:()=>{}});
 run(t);
});}
browserTest('Tidal glass keeps health and essence independent when one canvas is unavailable',t=>{
 const {orbs,health,mana}=setup(t,{healthCanvas:false});orbs.update(.016,.1,.8);
 assert.equal(health.classes.has('effect-ready'),false);assert.equal(mana.classes.has('effect-ready'),true);
 assert.equal(Number(health.parentElement.style['--potion-strength']),.235);
 assert.ok(Math.abs(Number(mana.parentElement.style['--potion-strength'])-.83)<1e-9);
});
browserTest('a missing health host never remaps health into the essence orb',t=>{
 const {orbs,mana}=setup(t,{missingHealth:true});orbs.update(.016,.1,1);
 assert.equal(Number(mana.parentElement.style['--potion-strength']),1);assert.equal(mana.classes.has('effect-ready'),true);
});
browserTest('reduced motion and paused frames keep the liquid still while resource changes still display',t=>{
 const {orbs,motion,contexts}=setup(t,{reduced:true});orbs.update(.016,.7,.5);const first=JSON.stringify(contexts[0].calls);contexts[0].calls.length=0;orbs.update(1,.7,.5);assert.equal(JSON.stringify(contexts[0].calls),first);
 contexts[0].calls.length=0;orbs.update(0,0,.5);assert.notEqual(JSON.stringify(contexts[0].calls),first);
 motion.matches=false;contexts[0].calls.length=0;orbs.update(0,.7,.5);const paused=JSON.stringify(contexts[0].calls);contexts[0].calls.length=0;orbs.update(0,.7,.5);assert.equal(JSON.stringify(contexts[0].calls),paused);
});
browserTest('lost canvases reveal the CSS fallback and restore without affecting resource values',t=>{
 const {orbs,health}=setup(t);orbs.update(.016,1,1);assert.equal(health.classes.has('effect-ready'),true);
 health.canvas.events.contextlost({preventDefault(){}});orbs.update(.016,0,1);assert.equal(health.classes.has('effect-ready'),false);
 health.canvas.events.contextrestored();orbs.update(0,0,1);assert.equal(health.classes.has('effect-ready'),true);assert.equal(Number(health.parentElement.style['--potion-strength']),.15);
});
