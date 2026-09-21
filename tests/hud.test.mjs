import test from 'node:test';
import assert from 'node:assert/strict';
import {installGlobals} from './helpers/dom.mjs';
import {createHud} from '../dist/hud.js';
import {$} from '../dist/dom.js';
import {classFor,conceptFor,classColor,classAppearance,abilitiesFor} from '../dist/classes.js';
import {icon,classIconNames} from '../dist/icon-atlas.js';
import {mapFor} from '../dist/regions.js';
import {questSummary,zoneName} from '../dist/campaign.js';
import {regionActionName} from '../dist/region-client-ui.js';

// M7 moved toast/updateClassHud/updateUI/drawMap out of main.js. A minimal document stub
// covers every literal $('id') / document.querySelector() this quartet touches; each element
// is a plain mutable record (style/dataset/classList.add|remove|toggle/setAttribute), the same
// shape tests/effects-factory.test.mjs uses for its single float-layer stub, just with more ids.
function makeElement(){
 const el={style:{},dataset:{},attrs:{},textContent:'',innerHTML:'',title:'',disabled:false,hidden:false};
 const children=new Map();
 el.classList={added:[],removed:[],toggled:[],_has:new Map(),
  // _has starts each token as unset (contains() returns undefined) so the very first
  // toggle/add/remove of a class still records a call for the pre-existing assertions
  // below that inspect .toggled; once a token has been touched, contains() reflects its
  // real membership so dist/hud.js's own read-back write guards can skip redundant calls.
  add(...c){for(const x of c)this._has.set(x,true);this.added.push(...c);},
  remove(...c){for(const x of c)this._has.set(x,false);this.removed.push(...c);},
  toggle(c,force){const next=force===undefined?!this._has.get(c):!!force;this._has.set(c,next);this.toggled.push([c,force]);return next;},
  contains(c){return this._has.has(c)?this._has.get(c):undefined;}};
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
 assert.equal(ctx.hudClass,conceptFor('geralt',undefined));
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

// ---------------------------------------------------------------------------
// Reference implementation for the P6c parity test, copied verbatim from
// dist/hud.js as it existed before this task's edits (M7's codex/hud-audio-
// 2811c280-cd13, confirmed byte-identical to the checked-out dist/hud.js via
// `git show codex/hud-audio-2811c280-cd13:dist/hud.js` -- dist/hud.js is not
// on main yet, so that branch stands in for "main" per this task's brief).
// Untouched below; do not reformat. Kept permanently as the parity oracle. One exception: the
// world aria-label's class-change clause follows the 2026-09-21 copy change (journeys no longer
// lock their character), so the oracle and dist/hud.js still print the same string.
// ---------------------------------------------------------------------------
function createReferenceHud(ctx){
 function updateClassHud(){
  const c=classFor(ctx.state),key=conceptFor(ctx.state.classId,ctx.state.appearanceId)+'|'+!!ctx.activeJourney;if(ctx.hudClass===key)return;ctx.hudClass=key;
  $('character-name').textContent=c.name;$('class-caption').textContent=c.name.toUpperCase();
  $('character-button').disabled=!!ctx.activeJourney;$('character-button').title=ctx.activeJourney?'This journey keeps its chosen character.':'Change character (C)';
  $('world').setAttribute('aria-label','Village play area. Use W A S D to move, mouse to aim and attack, F to speak or collect loot, I for equipment, C to change character, 2 for your class skill, 1 to dodge, and 3 to heal.');
  for(const [action,skill] of Object.entries(c.abilities)){const button=document.querySelector(`[data-action="${action}"]`);button.querySelector('.ability-name').textContent=skill.name;button.title=`${skill.name} · ${skill.cost} essence · ${skill.cooldown}s cooldown. ${skill.description}`;button.setAttribute('aria-label',button.title);const index=['attack','bolt','dodge','nova'].indexOf(action);if(index>=0&&classIconNames[c.id]){const mark=button.querySelector('.ability-icon');mark.innerHTML=icon(classIconNames[c.id][index]);mark.style.color=skill.color||classColor(ctx.state);}}
 }
 function updateUI(){if(!ctx.player)return;updateClassHud();$('health-liquid').style.height=`${ctx.state.hp/ctx.state.maxHp*100}%`;$('mana-liquid').style.height=`${ctx.state.mana/ctx.state.maxMana*100}%`;$('potion-count').textContent=ctx.state.potions;$('souls-counter').textContent=`${ctx.state.souls} SOULS`;$('experience-fill').style.width=`${ctx.state.souls%100}%`;$('level-label').textContent=`${classAppearance(ctx.state.classId,ctx.state.appearanceId)?.name||classFor(ctx.state).name} · LEVEL ${ctx.state.level}`;document.querySelector('.rank').textContent=String(ctx.state.level).padStart(2,'0');
  for(const[name,data]of Object.entries(abilitiesFor(ctx.state))){const button=document.querySelector(`[data-action="${name}"]`);const cd=ctx.state.cooldowns[name];button.classList.toggle('on-cooldown',cd>.12&&name!=='attack');button.querySelector('.cooldown').textContent=cd>=1?Math.ceil(cd):cd.toFixed(1);button.classList.toggle('unavailable',ctx.state.mana<data.cost||name==='heal'&&!ctx.state.potions);}
  const quest=questSummary(ctx.state);$('quest-kind').lastChild.textContent=mapFor(ctx.renderedMap).theme==='cave'?' SIDE CAVE':' MAIN QUEST';if(ctx.renderedMap==='overworld'&&ctx.state.questCompleted&&!ctx.state.questRewarded){quest.objective='Quest complete · Claim your reward from Rowan';quest.hint=ctx.sessionMode==='single-player'?'You completed The Last Toll. Your reward awaits in Ashwick.':'Your allies completed The Last Toll. Your reward awaits in Ashwick.';}$('quest-title').textContent=quest.title;$('quest-count').textContent=quest.count;$('objective').textContent=quest.objective;$('quest-hint').textContent=quest.hint;$('quest-marker').classList.toggle('done',ctx.state.questRewarded);$('gold-counter').textContent=`${ctx.state.gold} CROWNS`;$('location-name').textContent=ctx.environment.currentBuilding(ctx.player.position)?.name||(ctx.renderedMap==='overworld'?zoneName(ctx.state.zone):mapFor(ctx.renderedMap).name);$('location-type').textContent=ctx.safeHere()?'SANCTUARY':mapFor(ctx.renderedMap).theme==='cave'?'WORLD I · BENEATH HALLOWMERE':ctx.renderedMap!=='overworld'?'THE FORSAKEN REACH':ctx.state.zone==='road'?'THE FORSAKEN REACH':'WORLD I · THE LAST TOLL';const interaction=ctx.nearbyInteraction(),building=interaction?.building,target=interaction?.target;$('interact-button').hidden=!interaction;$('interaction-name').textContent=interaction?.regional?regionActionName(interaction.regional):building?(!building.doorCollider.disabled?'Chapel sealed':ctx.environment.currentBuilding(ctx.player.position)?.id===building.id?'Leave '+building.name:'Enter '+building.name):target?(target.kind==='forage'?'Harvest '+target.name:target.kind?'Collect '+target.name:'Speak to '+target.name):'';const enemyTarget=ctx.mouseTargeting?.selected,boss=ctx.enemies.find(e=>!e.dead&&ctx.bossType(e.type));$('boss-bar').hidden=!boss||!!enemyTarget&&!ctx.bossType(enemyTarget.type);if(boss){$('boss-fill').style.width=`${Math.max(0,boss.hp/boss.maxHp*100)}%`;$('boss-bar').querySelector('span').textContent=ctx.renderedMap==='overworld'?'THE LAST TOLL':mapFor(ctx.renderedMap).name.toUpperCase();const title=$('boss-bar').querySelector('h2');if(title)title.textContent=`${boss.data.name}${boss.net?.bossStage>1?' · Phase '+boss.net.bossStage:''}${boss.net?.exposedUntil>(ctx.lastSnapshot?.time||0)?' · Exposed':''}`;}
  $('enemy-target').hidden=!enemyTarget||ctx.bossType(enemyTarget.type);
  if(enemyTarget&&!ctx.bossType(enemyTarget.type)){$('target-name').textContent=enemyTarget.data.name;$('target-type').textContent=(enemyTarget.data.attackStyle==='orb'?'CASTER':enemyTarget.data.attackStyle==='bite'?'DEVOURER':'KNIFE')+' · '+(ctx.attackHeld&&ctx.lockedEnemy===enemyTarget?'LOCKED · HOLD TO ATTACK':'MOUSE LOCK · CLICK TO ATTACK');$('target-fill').style.width=`${Math.max(0,enemyTarget.hp/enemyTarget.maxHp*100)}%`;}
  if(ctx.state.time>14)$('combat-guide').style.opacity='0';}
 return {updateClassHud,updateUI};
}

// ---------------------------------------------------------------------------
// P6c: updateUI() caches ability-button/.cooldown/.ability-name lookups and the
// .rank element, writes DOM properties only when the value actually changed
// (read-back against the live element, not a shadow copy), and memoizes
// questSummary(ctx.state) on the state fields it reads. The tests below prove
// this is a zero-observable-change optimization: a parity run against a
// verbatim reference (above) across many randomized frames, then write-count
// and querySelector-count checks showing the optimization actually happens.
// ---------------------------------------------------------------------------

function mulberry32(seed){
 return function(){
  seed|=0;seed=seed+0x6D2B79F5|0;
  let t=Math.imul(seed^seed>>>15,1|seed);
  t=t+Math.imul(t^t>>>7,61|t)^t;
  return((t^t>>>14)>>>0)/4294967296;
 };
}
function pick(rand,arr){return arr[Math.floor(rand()*arr.length)];}

const CLASS_IDS=['geralt','sorcerer','ranger','reaver','nightblade','oathkeeper','alchemist','unknown-legacy-class'];
const SORCERER_APPEARANCE_IDS=['C01','W06','W07','W10'];
const ZONES=['hallowmere','ashwick','road','outlands'];
const RENDERED_MAPS=['overworld','drowned-wood','underways'];
const SESSION_MODES=['single-player','multiplayer'];

const BUILDINGS=[null,
 {name:'Chapel',id:'chapel',doorCollider:{disabled:true}},
 {name:'Shrine',id:'shrine',doorCollider:{disabled:false}}];
const TARGETS=[null,
 {kind:'forage',name:'Berries'},
 {kind:'loot',name:'Gold Pile'},
 {kind:undefined,name:'Rowan'}];
const REGIONALS=[null,
 {operation:'objective',active:true,name:'Beacon',wave:2,waves:4},
 {operation:'travel',locked:true,name:'Old Gate'},
 {operation:'checkpoint',completed:true,name:'Waystone'},
 {operation:'travel',name:'Return to Ashwick'},
 {operation:'cache',name:'Hidden Cache'}];
const ENEMIES=[
 {type:'wolf',dead:false,data:{name:'Grey Wolf',attackStyle:'bite'},hp:40,maxHp:60},
 {type:'wisp',dead:false,data:{name:'Wisp',attackStyle:'orb'},hp:20,maxHp:20},
 {type:'thug',dead:false,data:{name:'Thug',attackStyle:'blade'},hp:55,maxHp:80}];
const BOSS_ENEMY={type:'dragon',dead:false,data:{name:'Ancient Wyrm'},hp:300,maxHp:500,net:{bossStage:2,exposedUntil:5}};
const bossType=type=>type==='dragon';

function randomState(rand){
 const classId=pick(rand,CLASS_IDS);
 return {
  classId,
  appearanceId:classId==='sorcerer'&&rand()<.5?pick(rand,SORCERER_APPEARANCE_IDS):undefined,
  hp:rand()*150,maxHp:150,mana:rand()*100,maxMana:100,
  potions:Math.floor(rand()*5),souls:Math.floor(rand()*500),level:1+Math.floor(rand()*20),
  cooldowns:{attack:rand()*2,bolt:rand()*2,dodge:rand()*2,nova:rand()*2,heal:rand()*2},
  gold:Math.floor(rand()*999),zone:pick(rand,ZONES),time:rand()*30,
  questAccepted:rand()<.7,questRewarded:rand()<.3,questCompleted:rand()<.5,victory:rand()<.4,
  bossSpawned:rand()<.3,bossLootClaimed:rand()<.5,campaignComplete:rand()<.2,
  visited:rand()<.6?['hallowmere']:[],villageKills:Math.floor(rand()*12),
  mapId:undefined,
 };
}

function randomFrame(rand){
 return {
  state:randomState(rand),
  renderedMap:pick(rand,RENDERED_MAPS),
  sessionMode:pick(rand,SESSION_MODES),
  attackHeld:rand()<.5,
  safeHere:rand()<.3,
  currentBuilding:pick(rand,BUILDINGS),
  interaction:rand()<.5?null:{building:pick(rand,BUILDINGS),target:pick(rand,TARGETS),regional:pick(rand,REGIONALS)},
  enemyTarget:rand()<.6?null:(rand()<.25?BOSS_ENEMY:pick(rand,ENEMIES)),
  lockSame:rand()<.5,
  bossPresent:rand()<.4,
  lastSnapshot:rand()<.5?{time:rand()*10}:null,
 };
}

function applyFrame(ctx,state,frame){
 Object.assign(state,frame.state);
 ctx.renderedMap=frame.renderedMap;
 ctx.sessionMode=frame.sessionMode;
 ctx.attackHeld=frame.attackHeld;
 ctx.safeHere=()=>frame.safeHere;
 ctx.environment.currentBuilding=()=>frame.currentBuilding;
 ctx.nearbyInteraction=()=>frame.interaction;
 ctx.mouseTargeting={selected:frame.enemyTarget};
 ctx.lockedEnemy=frame.enemyTarget&&frame.lockSame?frame.enemyTarget:null;
 ctx.enemies=frame.bossPresent?[BOSS_ENEMY,...(frame.enemyTarget&&frame.enemyTarget!==BOSS_ENEMY?[frame.enemyTarget]:[])]:(frame.enemyTarget&&frame.enemyTarget!==BOSS_ENEMY?[frame.enemyTarget]:[]);
 ctx.bossType=bossType;
 ctx.lastSnapshot=frame.lastSnapshot;
}

function snapshotHud(doc){
 const ids=['character-name','class-caption','character-button','world','health-liquid','mana-liquid',
  'potion-count','souls-counter','experience-fill','level-label','quest-title','quest-count','objective',
  'quest-hint','quest-marker','gold-counter','location-name','location-type','interact-button',
  'interaction-name','boss-bar','boss-fill','enemy-target','target-name','target-type','target-fill',
  'combat-guide'];
 const out={};
 for(const id of ids){
  const el=doc.getElementById(id);
  out[id]={textContent:el.textContent,style:{...el.style},hidden:el.hidden,disabled:el.disabled,
   title:el.title,attrs:{...el.attrs},
   onCooldown:el.classList.contains('on-cooldown'),unavailable:el.classList.contains('unavailable'),
   done:el.classList.contains('done')};
 }
 out.questKindLastChild=doc.getElementById('quest-kind').lastChild.textContent;
 out.rank=doc.querySelector('.rank').textContent;
 out.bossBarSpan=doc.getElementById('boss-bar').querySelector('span').textContent;
 out.bossBarH2=doc.getElementById('boss-bar').querySelector('h2').textContent;
 for(const action of ['attack','bolt','dodge','nova','heal']){
  const button=doc.querySelector(`[data-action="${action}"]`);
  out['ability-'+action]={
   abilityName:button.querySelector('.ability-name').textContent,
   title:button.title,ariaLabel:button.attrs['aria-label'],
   cooldown:button.querySelector('.cooldown').textContent,
   onCooldown:button.classList.contains('on-cooldown'),
   unavailable:button.classList.contains('unavailable'),
   iconHtml:button.querySelector('.ability-icon').innerHTML,
   iconColor:button.querySelector('.ability-icon').style.color,
  };
 }
 return out;
}

test('updateUI matches the original reference DOM output across 600 randomized frames (no observable difference)',t=>{
 const rand=mulberry32(0x5EED1234);
 const docA=stubDocument(),docB=stubDocument();
 const stateA=makeState(),stateB=makeState();
 const ctxA=makeCtx({state:stateA}),ctxB=makeCtx({state:stateB});
 installGlobals(t,{document:docA});
 const {updateUI:updateUIOptimized}=createHud(ctxA);
 installGlobals(t,{document:docB});
 const {updateUI:updateUIReference}=createReferenceHud(ctxB);

 const FRAMES=600;
 for(let frame=0;frame<FRAMES;frame++){
  const spec=randomFrame(rand);
  applyFrame(ctxA,stateA,spec);
  applyFrame(ctxB,stateB,spec);
  globalThis.document=docA;updateUIOptimized();
  globalThis.document=docB;updateUIReference();
  assert.deepEqual(snapshotHud(docA),snapshotHud(docB),`frame ${frame}: HUD output diverged from the reference`);
 }
});

test('updateUI performs 0 property writes and 0 document.querySelector calls per frame once warm and state is unchanged',t=>{
 const doc=stubDocument();
 installGlobals(t,{document:doc});
 const state=makeState({cooldowns:{attack:0,bolt:1.4,dodge:0,nova:0,heal:0}});
 const ctx=makeCtx({state});
 ctx.enemies=[BOSS_ENEMY];ctx.mouseTargeting={selected:ENEMIES[0]};ctx.lockedEnemy=ENEMIES[0];
 ctx.bossType=bossType;ctx.lastSnapshot={time:1};
 const {updateUI}=createHud(ctx);

 updateUI(); // warm-up: populates the ability/.rank caches and performs the first (necessary) writes

 let docQueries=0;
 const originalQuerySelector=doc.querySelector.bind(doc);
 doc.querySelector=(...args)=>{docQueries++;return originalQuerySelector(...args);};
 function countWrites(el){
  let n=0;
  const origToggle=el.classList.toggle.bind(el.classList);
  el.classList.toggle=(...args)=>{n++;return origToggle(...args);};
  const styleTarget=el.style;
  el.style=new Proxy(styleTarget,{set(t,p,v){n++;t[p]=v;return true;}});
  let text=el.textContent,hidden=el.hidden;
  Object.defineProperty(el,'textContent',{get:()=>text,set(v){n++;text=v;}});
  Object.defineProperty(el,'hidden',{get:()=>hidden,set(v){n++;hidden=v;}});
  return ()=>n;
 }
 const ids=['health-liquid','mana-liquid','potion-count','souls-counter','experience-fill','level-label',
  'quest-title','quest-count','objective','quest-hint','quest-marker','gold-counter','location-name',
  'location-type','interact-button','interaction-name','boss-bar','boss-fill','enemy-target',
  'target-name','target-type','target-fill','combat-guide'];
 const readers=ids.map(id=>countWrites(doc.getElementById(id)));
 for(const action of ['attack','bolt','dodge','nova','heal']){
  const button=doc.querySelector(`[data-action="${action}"]`);
  readers.push(countWrites(button));
  readers.push(countWrites(button.querySelector('.cooldown')));
 }
 readers.push(countWrites(doc.querySelector('.rank')));
 readers.push(countWrites(doc.getElementById('quest-kind').lastChild));
 readers.push(countWrites(doc.getElementById('boss-bar').querySelector('span')));
 readers.push(countWrites(doc.getElementById('boss-bar').querySelector('h2')));

 // Everything above (warm-up call, wrapping doc.querySelector, fetching+wrapping every
 // element) is setup and legitimately calls doc.querySelector a few times -- reset both
 // counters here so only the 100 measured frames below count toward the assertions.
 docQueries=0;

 for(let i=0;i<100;i++)updateUI();

 const totalWrites=readers.reduce((sum,read)=>sum+read(),0);
 assert.equal(totalWrites,0,`expected 0 writes across 100 unchanged frames, got ${totalWrites}`);
 assert.equal(docQueries,0,`expected 0 document.querySelector calls across 100 unchanged frames, got ${docQueries}`);
});

test('the unoptimized reference performs at least 20 writes per frame for the same unchanged state (baseline for the write-count claim)',t=>{
 const doc=stubDocument();
 installGlobals(t,{document:doc});
 const state=makeState({cooldowns:{attack:0,bolt:1.4,dodge:0,nova:0,heal:0}});
 const ctx=makeCtx({state});
 ctx.enemies=[BOSS_ENEMY];ctx.mouseTargeting={selected:ENEMIES[0]};ctx.lockedEnemy=ENEMIES[0];
 ctx.bossType=bossType;ctx.lastSnapshot={time:1};
 const {updateUI}=createReferenceHud(ctx);

 // Count every classList.toggle call and every textContent/style/hidden assignment by
 // wrapping the shared makeElement() instances the reference touches, the same way the
 // optimized-path test above does, but WITHOUT a warm-up call: the reference has no cache
 // to warm, so its write count should be effectively the same on every frame.
 function countWrites(el){
  let n=0;
  const origToggle=el.classList.toggle.bind(el.classList);
  el.classList.toggle=(...args)=>{n++;return origToggle(...args);};
  const styleTarget=el.style;
  el.style=new Proxy(styleTarget,{set(t,p,v){n++;t[p]=v;return true;}});
  let text=el.textContent,hidden=el.hidden;
  Object.defineProperty(el,'textContent',{get:()=>text,set(v){n++;text=v;}});
  Object.defineProperty(el,'hidden',{get:()=>hidden,set(v){n++;hidden=v;}});
  return ()=>n;
 }
 const ids=['health-liquid','mana-liquid','potion-count','souls-counter','experience-fill','level-label',
  'quest-title','quest-count','objective','quest-hint','quest-marker','gold-counter','location-name',
  'location-type','interact-button','interaction-name','boss-bar','boss-fill','enemy-target',
  'target-name','target-type','target-fill','combat-guide'];
 const readers=ids.map(id=>countWrites(doc.getElementById(id)));
 for(const action of ['attack','bolt','dodge','nova','heal']){
  const button=doc.querySelector(`[data-action="${action}"]`);
  readers.push(countWrites(button));
  readers.push(countWrites(button.querySelector('.cooldown')));
 }
 readers.push(countWrites(doc.querySelector('.rank')));
 readers.push(countWrites(doc.getElementById('quest-kind').lastChild));
 readers.push(countWrites(doc.getElementById('boss-bar').querySelector('span')));
 readers.push(countWrites(doc.getElementById('boss-bar').querySelector('h2')));

 const FRAMES=100;
 for(let i=0;i<FRAMES;i++)updateUI();
 const totalWrites=readers.reduce((sum,read)=>sum+read(),0);
 const perFrame=totalWrites/FRAMES;
 assert.ok(perFrame>=20,`expected >=20 writes/frame from the unoptimized reference, got ${perFrame}`);
});
