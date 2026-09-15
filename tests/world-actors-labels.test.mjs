import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from '../dist/vendor/three.core.js';
import {VillageLife} from '../dist/world-actors.js';
import {distance,clamp} from '../dist/combat.js';
import {LOOT_PICKUP_RANGE,seededRandom} from '../dist/campaign.js';
import {FOOD_LIST} from '../dist/foraging.js';
import {installGlobals} from './helpers/dom.mjs';

// ---------------------------------------------------------------------------
// Reference implementation, copied verbatim from dist/world-actors.js on main
// (`git show main:dist/world-actors.js`, line 84 -- confirmed byte-identical
// to the checked-out dist/ file before this task's edits). Only the method
// head is rewritten into a standalone function declaration so the body can
// run detached via `referenceRenderLabels.call(instance, inCombat, showAll)`.
// The body text below is untouched; do not reformat it. Kept here permanently
// as the parity oracle for the optimized renderLabels in dist/world-actors.js.
// ---------------------------------------------------------------------------
function referenceRenderLabels(inCombat=false,showAll=false){const occupied=[];const project=item=>item.model.position.clone().add(new T.Vector3(0,item.kind?.85:2.4,0)).project(this.camera);const hero=this.player.position.clone().add(new T.Vector3(0,1.1,0)).project(this.camera);occupied.push({x:(hero.x*.5+.5)*innerWidth-30,y:(-hero.y*.5+.5)*innerHeight-42,w:60,h:78});const sorted=[...this.visibleNpcs(),...[...this.drops,...this.forage].filter(d=>!d.claimed).sort((a,b)=>(b.rarity==='legendary')-(a.rarity==='legendary')||a.id.localeCompare(b.id))];for(const item of sorted){const dist=distance(item.model.position,this.player.position),p=project(item);let visible=dist<(item.kind?showAll?LOOT_PICKUP_RANGE:10:17)&&Math.abs(p.x)<.96&&Math.abs(p.y)<.88&&p.z<1;if(item.kind&&!showAll&&(inCombat||item.kind==='gold'&&dist>4.5))visible=false;if((p.x*.5+.5)*innerWidth<310&&(-p.y*.5+.5)*innerHeight<370)visible=false;item.label.hidden=!visible;const inReach=item.kind?this.canPickUp(item):dist<2.8;item.label.classList.toggle('in-reach',inReach);if(!visible)continue;let x=(p.x*.5+.5)*innerWidth,y=(-p.y*.5+.5)*innerHeight;let w=150,h=59;if(item.kind){if(!item.labelSize||item.labelSize.inReach!==inReach||item.labelSize.viewport!==innerWidth||item.labelSize.fontRevision!==this.labelFontRevision)item.labelSize={inReach,w:item.label.offsetWidth,h:item.label.offsetHeight,viewport:innerWidth,fontRevision:this.labelFontRevision};({w,h}=item.labelSize);}if(item.kind){x=clamp(x,w/2+12,innerWidth-w/2-12);let chosen=null;for(const offset of [0,h+5,(h+5)*2,(h+5)*3,-h-5,-(h+5)*2,(h+5)*4,-(h+5)*3,(h+5)*5]){const candidate={x:x-w/2,y:y+offset-h,w,h};if(candidate.y<95||candidate.y+h>innerHeight-170)continue;if(!occupied.some(r=>candidate.x<r.x+r.w+4&&candidate.x+candidate.w>r.x-4&&candidate.y<r.y+r.h+3&&candidate.y+candidate.h>r.y-3)){chosen=candidate;break;}}if(!chosen){item.label.hidden=true;continue;}y=chosen.y+h;occupied.push(chosen);}else occupied.push({x:x-w/2,y:y-h,w,h});item.label.style.left=`${x}px`;item.label.style.top=`${y}px`;}}

// ---------------------------------------------------------------------------
// Minimal stub DOM: labels need hidden, classList.toggle/contains,
// style.left/top/setProperty, offsetWidth/offsetHeight, setAttribute, remove,
// querySelector. A per-document call counter gives deterministic-but-varied
// offsetWidth/Height so the labelSize cache is genuinely exercised, while
// staying reproducible as long as two documents see the same call sequence.
function makeDocument(){
 let n=0;
 const layer={append(){}};
 function createLabel(){
  n++;
  const seed=n;
  return {
   dataset:{},className:'',innerHTML:'',hidden:false,
   style:{left:'',top:'',transform:'',setProperty(){}},
   classList:{
    _set:new Set(),
    toggle(token,force){const has=this._set.has(token);const want=force===undefined?!has:!!force;if(want)this._set.add(token);else this._set.delete(token);return want;},
    contains(token){return this._set.has(token);}
   },
   offsetWidth:130+(seed*17)%60,offsetHeight:48+(seed*11)%30,
   setAttribute(){},remove(){},querySelector(){return {};},focus(){},
   onclick:null,onpointerdown:null,onpointerenter:null,onpointerleave:null,onfocus:null,onblur:null
  };
 }
 return {getElementById:()=>layer,createElement:createLabel};
}

function buildLife(){
 const scene=new T.Scene(),player=new T.Group(),camera=new T.OrthographicCamera(-20,20,15,-15,.1,150);
 const state={mapId:'overworld',potions:0,ended:false};
 const life=new VillageLife({scene,camera,player,state,cloneModel:()=>new T.Group(),obstacles:[],onTalk(){},onCollect(){},onLootClick(){},onApproach(){return true;}});
 return {scene,player,camera,state,life};
}

function collectItems(life){return [...life.npcs,...life.drops,...life.forage];}

function compareLabels(t,lifeA,lifeB,frame){
 const a=collectItems(lifeA),b=collectItems(lifeB);
 assert.equal(a.length,b.length,`frame ${frame}: item count mismatch`);
 const byId=new Map(b.map(item=>[item.id,item]));
 for(const itemA of a){
  const itemB=byId.get(itemA.id);
  assert.ok(itemB,`frame ${frame}: item ${itemA.id} missing from reference`);
  assert.equal(itemA.label.hidden,itemB.label.hidden,`frame ${frame} item ${itemA.id}: hidden mismatch`);
  assert.equal(itemA.label.classList.contains('in-reach'),itemB.label.classList.contains('in-reach'),`frame ${frame} item ${itemA.id}: in-reach class mismatch`);
  assert.equal(itemA.label.style.left,itemB.label.style.left,`frame ${frame} item ${itemA.id}: style.left mismatch`);
  assert.equal(itemA.label.style.top,itemB.label.style.top,`frame ${frame} item ${itemA.id}: style.top mismatch`);
 }
}

test('renderLabels matches the original reference DOM output across 520 randomized frames of mutation',t=>{
 installGlobals(t,{document:makeDocument(),innerWidth:1280,innerHeight:800});
 const rand=seededRandom(0xC0FFEE55);
 const docA=makeDocument(),docB=makeDocument();

 globalThis.document=docA;
 const {player:playerA,camera:cameraA,state:stateA,life:lifeA}=buildLife();
 globalThis.document=docB;
 const {player:playerB,camera:cameraB,state:stateB,life:lifeB}=buildLife();

 const dropKinds=['item','potion','gold'],rarities=['common','uncommon','rare','legendary'];
 const dropRecords=[],forageRecords=[];
 let dropSeq=0,forageSeq=0;

 function syncBoth(){
  const snapshot=dropRecords.map(r=>({...r}));
  globalThis.document=docA;lifeA.syncLoot(snapshot.map(r=>({...r})));
  globalThis.document=docB;lifeB.syncLoot(snapshot.map(r=>({...r})));
 }
 function syncForageBoth(){
  const snapshot=forageRecords.map(r=>({...r}));
  globalThis.document=docA;lifeA.syncForage(snapshot.map(r=>({...r})));
  globalThis.document=docB;lifeB.syncForage(snapshot.map(r=>({...r})));
 }
 function addDrop(){
  dropSeq++;
  const kind=dropKinds[Math.floor(rand()*dropKinds.length)];
  dropRecords.push({id:`drop-${dropSeq}`,kind,rarity:rarities[Math.floor(rand()*rarities.length)],name:`Drop ${dropSeq}`,x:(rand()-.5)*140,z:(rand()-.5)*60,amount:kind==='gold'?10+Math.floor(rand()*90):undefined,template:kind==='item'?'oak-charm':undefined});
  syncBoth();
 }
 function removeDrop(){
  if(!dropRecords.length)return;
  dropRecords.splice(Math.floor(rand()*dropRecords.length),1);
  syncBoth();
 }
 function addForage(){
  forageSeq++;
  const food=FOOD_LIST[forageSeq%FOOD_LIST.length];
  forageRecords.push({id:`forage-${forageSeq}`,itemId:food.id,x:(rand()-.5)*140,z:(rand()-.5)*60});
  syncForageBoth();
 }
 function removeForage(){
  if(!forageRecords.length)return;
  forageRecords.splice(Math.floor(rand()*forageRecords.length),1);
  syncForageBoth();
 }
 // Directly flip .claimed on a still-present item on both instances, bypassing
 // every dirty-flag hook in world-actors.js -- this is exactly the case the
 // task's structural-key safety net exists to catch.
 function claimRandom(){
  const options=[...lifeA.drops,...lifeA.forage].filter(d=>!d.claimed);
  if(!options.length)return;
  const pick=options[Math.floor(rand()*options.length)];
  pick.claimed=true;
  const match=[...lifeB.drops,...lifeB.forage].find(d=>d.id===pick.id);
  if(match)match.claimed=true;
 }
 function toggleMap(){
  const next=stateA.mapId==='overworld'?'cave':'overworld';
  stateA.mapId=next;stateB.mapId=next;
 }

 for(let i=0;i<10;i++)addDrop();
 for(let i=0;i<6;i++)addForage();

 const FRAMES=520;
 for(let frame=0;frame<FRAMES;frame++){
  const px=(rand()-.5)*140,pz=(rand()-.5)*60;
  playerA.position.set(px,0,pz);playerB.position.set(px,0,pz);
  cameraA.position.set(px+17,25,pz+26);cameraA.lookAt(px,0,pz);cameraA.updateMatrixWorld(true);
  cameraB.position.set(px+17,25,pz+26);cameraB.lookAt(px,0,pz);cameraB.updateMatrixWorld(true);

  const roll=rand();
  if(roll<.15)addDrop();
  else if(roll<.25)removeDrop();
  else if(roll<.35)addForage();
  else if(roll<.42)removeForage();
  else if(roll<.55)claimRandom();
  else if(roll<.6)toggleMap();

  if(rand()<.08){globalThis.innerWidth=1000+Math.floor(rand()*600);globalThis.innerHeight=700+Math.floor(rand()*300);}

  const inCombat=rand()<.5,showAll=rand()<.5;
  globalThis.document=docB;referenceRenderLabels.call(lifeB,inCombat,showAll);
  globalThis.document=docA;lifeA.renderLabels(inCombat,showAll);
  compareLabels(t,lifeA,lifeB,frame);
 }
});

test('renderLabels allocates no per-frame Vector3s once warm, unlike the reference (>=2x items per call)',t=>{
 installGlobals(t,{document:makeDocument(),innerWidth:1280,innerHeight:800});
 const {player,camera,state,life}=buildLife();
 const rand=seededRandom(99);
 for(let i=0;i<15;i++){
  const kind=['item','potion','gold'][i%3];
  life.addLoot([{id:`d${i}`,kind,rarity:['common','uncommon','rare','legendary'][i%4],name:`D${i}`,x:(rand()-.5)*100,z:(rand()-.5)*40,amount:kind==='gold'?40:undefined,template:kind==='item'?'oak-charm':undefined}],{x:0,z:0});
 }
 for(let i=0;i<10;i++)life.syncForage([...life.forage.map(({id,itemId,x,z})=>({id,itemId,x,z})),{id:`f${i}`,itemId:FOOD_LIST[i%FOOD_LIST.length].id,x:(rand()-.5)*100,z:(rand()-.5)*40}]);
 player.position.set(3,0,2);camera.position.set(20,25,28);camera.lookAt(0,0,0);camera.updateMatrixWorld(true);

 const itemCount=life.visibleNpcs().length+life.drops.filter(d=>!d.claimed).length+life.forage.filter(d=>!d.claimed).length;
 assert.ok(itemCount>=25,`fixture should have ~30 items, has ${itemCount}`);

 const proto=T.Vector3.prototype;
 const originalDescriptor=Object.getOwnPropertyDescriptor(proto,'isVector3');
 let count=0;
 Object.defineProperty(proto,'isVector3',{configurable:true,get(){return true;},set(){count++;}});
 t.after(()=>{
  if(originalDescriptor)Object.defineProperty(proto,'isVector3',originalDescriptor);
  else delete proto.isVector3;
 });

 life.renderLabels(false,false); // warm the labelSorted cache / labelSize cache
 count=0;
 for(let i=0;i<100;i++)life.renderLabels(false,false);
 const newCount=count;
 assert.ok(newCount<=5,`optimized renderLabels should allocate ~0 Vector3s across 100 warm calls, got ${newCount}`);

 count=0;
 for(let i=0;i<100;i++)referenceRenderLabels.call(life,false,false);
 const refCount=count;
 assert.ok(refCount>=2*itemCount,`reference should allocate at least 2x items (${2*itemCount}) per call, got ${refCount} across 100 calls`);
});
