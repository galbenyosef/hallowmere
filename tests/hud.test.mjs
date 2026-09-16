import test from 'node:test';
import assert from 'node:assert/strict';
import {installGlobals} from './helpers/dom.mjs';
import {createHud} from '../dist/hud.js';
import {classFor,conceptFor,classColor} from '../dist/classes.js';
import {icon} from '../dist/icon-atlas.js';
import {mapFor} from '../dist/regions.js';

// M7 moved toast/updateClassHud/updateUI/drawMap out of main.js. A minimal document stub
// covers every literal $('id') / document.querySelector() this quartet touches; each element
// is a plain mutable record (style/dataset/classList.add|remove|toggle/setAttribute), the same
// shape tests/effects-factory.test.mjs uses for its single float-layer stub, just with more ids.
function makeElement(){
 const el={style:{},dataset:{},attrs:{},textContent:'',innerHTML:'',title:'',disabled:false,hidden:false};
 const children=new Map();
 el.classList={added:[],removed:[],toggled:[],
  add(...c){this.added.push(...c);},remove(...c){this.removed.push(...c);},
  toggle(c,force){this.toggled.push([c,force]);}};
 el.setAttribute=(k,v)=>{el.attrs[k]=v;};
 el.querySelector=sel=>{if(!children.has(sel))children.set(sel,makeElement());return children.get(sel);};
 let lastChild;
 Object.defineProperty(el,'lastChild',{get(){if(!lastChild)lastChild=makeElement();return lastChild;}});
 return el;
}
function stubDocument(){
 const byId=new Map(),byQuery=new Map();
 return {
  getElementById(id){if(!byId.has(id))byId.set(id,makeElement());return byId.get(id);},
  querySelector(sel){if(!byQuery.has(sel))byQuery.set(sel,makeElement());return byQuery.get(sel);},
 };
}

function makeState(overrides={}){
 return Object.assign({
  classId:'geralt',appearanceId:undefined,hp:80,maxHp:150,mana:50,maxMana:100,potions:2,souls:45,level:3,
  cooldowns:{attack:0,bolt:1.4,dodge:0,nova:0,heal:0},gold:120,zone:'hallowmere',time:20,
  questAccepted:false,questRewarded:false,questCompleted:false,victory:false,bossSpawned:false,
  bossLootClaimed:false,campaignComplete:false,visited:[],mapId:undefined,
 },overrides);
}
function makeCtx({doc,state=makeState()}={}){
 return {
  state,activeJourney:null,hudClass:null,renderedMap:'overworld',sessionMode:'single-player',
  environment:{currentBuilding:()=>null},safeHere:()=>false,nearbyInteraction:()=>null,
  mouseTargeting:null,enemies:[],lastSnapshot:null,attackHeld:false,lockedEnemy:null,bossType:()=>false,
  toastTimer:undefined,player:{position:{x:0,z:0}},exploration:{saveLabel:'saved 2m ago'},
  angle:0,mapExpanded:false,life:{drops:[]},network:{id:'local'},regionInteractions:()=>[],
 };
}

test('toast sets the toast element text/class and clears it via the timer',t=>{
 t.mock.timers.enable({apis:['setTimeout']});
 const doc=stubDocument();
 installGlobals(t,{document:doc});
 const ctx=makeCtx({doc});
 const {toast}=createHud(ctx);
 toast('Journey recovered from its previous save.');
 const el=doc.getElementById('toast');
 assert.equal(el.textContent,'Journey recovered from its previous save.');
 assert.deepEqual(el.classList.added,['visible']);
 assert.equal(el.classList.removed.length,0);
 t.mock.timers.tick(2499);
 assert.equal(el.classList.removed.length,0);
 t.mock.timers.tick(1);
 assert.deepEqual(el.classList.removed,['visible']);
 // A second call clears the pending timer instead of stacking a second one.
 toast('Second message');
 assert.equal(el.textContent,'Second message');
 t.mock.timers.tick(2500);
 assert.deepEqual(el.classList.removed,['visible','visible']);
});

test('updateClassHud writes name/caption/button state and ability icons, then skips redundant redraws for the same class',t=>{
 const doc=stubDocument();
 installGlobals(t,{document:doc});
 const ctx=makeCtx();
 const {updateClassHud}=createHud(ctx);
 updateClassHud();
 assert.equal(doc.getElementById('character-name').textContent,'Geralt');
 assert.equal(doc.getElementById('class-caption').textContent,'GERALT');
 assert.equal(doc.getElementById('character-button').disabled,false);
 assert.equal(doc.getElementById('character-button').title,'Change character (C)');
 assert.ok(doc.getElementById('world').attrs['aria-label'].startsWith('Village play area.'));
 const attackButton=doc.querySelector('[data-action="attack"]');
 assert.equal(attackButton.querySelector('.ability-name').textContent,'Steel Strike');
 assert.equal(attackButton.querySelector('.ability-icon').innerHTML,icon('sword'));
 assert.equal(attackButton.querySelector('.ability-icon').style.color,classColor(ctx.state));
 const boltButton=doc.querySelector('[data-action="bolt"]');
 assert.equal(boltButton.querySelector('.ability-icon').innerHTML,icon('flame'));
 assert.equal(boltButton.querySelector('.ability-icon').style.color,'#ff902e'); // Igni's own color wins over classColor
 assert.equal(ctx.hudClass,conceptFor('geralt',undefined)+'|false');
 // Same class/journey key -> cached, no re-render (sentinel proves the early return fired).
 doc.getElementById('character-name').textContent='sentinel';
 updateClassHud();
 assert.equal(doc.getElementById('character-name').textContent,'sentinel');
 // A different class changes the key and forces a real redraw.
 ctx.state=makeState({classId:'ranger'});
 updateClassHud();
 assert.equal(doc.getElementById('character-name').textContent,'Ranger');
});

test('updateUI writes vitals, cooldown chips, quest copy, and location text for a fixture state',t=>{
 const doc=stubDocument();
 installGlobals(t,{document:doc});
 const ctx=makeCtx();
 const {updateUI}=createHud(ctx);
 updateUI();
 assert.equal(doc.getElementById('health-liquid').style.height,`${80/150*100}%`);
 assert.equal(doc.getElementById('mana-liquid').style.height,`${50/100*100}%`);
 assert.equal(doc.getElementById('potion-count').textContent,2);
 assert.equal(doc.getElementById('souls-counter').textContent,'45 SOULS');
 assert.equal(doc.getElementById('experience-fill').style.width,`${45%100}%`);
 assert.equal(doc.getElementById('level-label').textContent,`${classFor(ctx.state).name} · LEVEL 3`);
 assert.equal(doc.querySelector('.rank').textContent,'03');
 const boltButton=doc.querySelector('[data-action="bolt"]');
 assert.equal(boltButton.classList.toggled.find(([c])=>c==='on-cooldown')[1],true);
 assert.equal(boltButton.querySelector('.cooldown').textContent,2); // Math.ceil(1.4)
 const attackButton=doc.querySelector('[data-action="attack"]');
 assert.equal(attackButton.classList.toggled.find(([c])=>c==='on-cooldown')[1],false); // attack never shows on-cooldown
 assert.equal(doc.getElementById('quest-title').textContent,'The Last Toll');
 assert.equal(doc.getElementById('objective').textContent,'Speak to Elder Rowan');
 assert.equal(doc.getElementById('gold-counter').textContent,'120 CROWNS');
 assert.equal(doc.getElementById('location-name').textContent,'Hallowmere Village');
 assert.equal(doc.getElementById('location-type').textContent,'WORLD I · THE LAST TOLL');
 assert.equal(doc.getElementById('interact-button').hidden,true);
 assert.equal(doc.getElementById('boss-bar').hidden,true);
 assert.equal(doc.getElementById('enemy-target').hidden,true);
 assert.equal(doc.getElementById('combat-guide').style.opacity,'0'); // state.time (20) > 14
});

test('drawMap forwards the expected fields to exploration-map and writes the map title/exploration copy',t=>{
 const doc=stubDocument();
 installGlobals(t,{document:doc});
 const ctx=makeCtx();
 ctx.player.position={x:3,z:4};ctx.angle=1.2;
 const calls=[];
 const stubDraw=args=>{calls.push(args);return 42;};
 const {drawMap}=createHud(ctx,{drawExplorationMap:stubDraw});
 drawMap();
 assert.equal(calls.length,1);
 const args=calls[0];
 assert.equal(args.canvas,doc.getElementById('minimap'));
 assert.equal(args.atlas,ctx.exploration);
 assert.equal(args.map,mapFor('overworld'));
 assert.equal(args.player,ctx.player.position);
 assert.equal(args.angle,1.2);
 assert.equal(args.expanded,false);
 assert.equal(args.environment,ctx.environment);
 assert.deepEqual(args.drops,[]);
 assert.deepEqual(args.enemies,ctx.enemies);
 assert.deepEqual(args.players,[]);
 assert.equal(args.you,'local');
 assert.equal(args.bossType,ctx.bossType);
 assert.equal(doc.getElementById('map-title').textContent,'Hallowmere');
 assert.equal(doc.getElementById('map-exploration').textContent,'42% charted · saved 2m ago');
});
