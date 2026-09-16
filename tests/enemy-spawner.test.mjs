import test from 'node:test';
import assert from 'node:assert/strict';
import {registerHooks} from 'node:module';
import * as T from '../dist/vendor/three.core.js';
import {ENEMY_TYPES} from '../dist/combat.js';
import {installGlobals} from './helpers/dom.mjs';

// dist/enemy-spawner.js imports the bare 'three' specifier and, transitively through
// dist/model-kit.js, 'three/addons/utils/BufferGeometryUtils.js'; match Node's resolution to
// the page's import map the same way tests/model-kit.test.mjs does.
const hook=registerHooks({resolve(specifier,context,nextResolve){
 if(specifier==='three')return nextResolve(new URL('../dist/vendor/three.module.js',import.meta.url).href,context);
 if(specifier==='three/addons/utils/BufferGeometryUtils.js')return nextResolve(new URL('../dist/vendor/utils/BufferGeometryUtils.js',import.meta.url).href,context);
 return nextResolve(specifier,context);
}});
const {createEnemySpawner}=await import('../dist/enemy-spawner.js');
hook.deregister();

// A stub prefab/cloneModel: spawnEnemy only needs a fresh Group per call (independent
// instances, like the real per-class prefab clones) with a 'body' child so getRig's rig.body
// lookup resolves the way it does for a real character model.
function stubCloneModel(){
 return name=>{
  const model=new T.Group();model.name=name;
  const body=new T.Mesh(new T.BoxGeometry(1,1,1),new T.MeshStandardMaterial({color:0x996633}));body.name='body';
  model.add(body);
  return model;
 };
}

function makeCtx(){
 return {
  scene:new T.Group(),enemies:[],overworldEnvironment:{glowTexture:null},reducedMotion:false,
  cloneModel:stubCloneModel(),enemyModelType:type=>type,bossType:()=>false,
 };
}

// A stub document.createElement('canvas'): spawnEnemy/updateEnemyBar only ever call
// getContext('2d') and a handful of drawing ops on the result, never read pixels back.
function canvasStub(){
 return {document:{createElement(tag){
  assert.equal(tag,'canvas');
  const ctx2d={ops:[],clearRect(){this.ops.push('clearRect');},fillText(){this.ops.push('fillText');},fillRect(){this.ops.push('fillRect');},strokeRect(){this.ops.push('strokeRect');},createLinearGradient(){return{addColorStop(){}};}};
  return {width:0,height:0,getContext(kind){assert.equal(kind,'2d');return ctx2d;},_ctx2d:ctx2d};
 }}};
}

test('spawnEnemy places a cloned model in the scene and pushes a complete enemy record',t=>{
 installGlobals(t,canvasStub());
 const ctx=makeCtx(),{spawnEnemy}=createEnemySpawner(ctx);
 const e=spawnEnemy('hollow',3,4);
 assert.equal(ctx.enemies.length,1);assert.equal(ctx.enemies[0],e);
 assert.equal(e.id,'enemy-0');assert.equal(e.zone,'hallowmere');assert.equal(e.type,'hollow');
 assert.equal(e.data,ENEMY_TYPES.hollow);assert.equal(e.hp,ENEMY_TYPES.hollow.hp);assert.equal(e.maxHp,ENEMY_TYPES.hollow.hp);
 assert.equal(e.phase,'idle');assert.equal(e.dead,false);assert.deepEqual(e.home,{x:3,z:4});
 assert.equal(e.model.position.x,3);assert.equal(e.model.position.z,4);
 assert.ok(ctx.scene.children.includes(e.model));
 assert.ok(e.rig);assert.equal(e.rig.body.name,'body');
 assert.ok(e.visuals);assert.equal(typeof e.visuals.dispose,'function');
 assert.ok(e.bar.isSprite);assert.ok(ctx.scene.children.includes(e.bar));
 assert.equal(e.bar.scale.x,3.2);assert.equal(e.bar.scale.y,.6); // ctx.bossType(...) is false here
 assert.ok(e.barCanvas);assert.ok(e.barTexture.isCanvasTexture);
 assert.equal(e.barHealth,ENEMY_TYPES.hollow.hp);
 // spawnEnemy calls updateEnemyBar(e) once before returning -- confirmed by side effects on its canvas.
 assert.ok(e.barCanvas._ctx2d.ops.includes('fillText'));

 const second=spawnEnemy('hollow',0,0);
 assert.equal(second.id,'enemy-1');
 assert.notEqual(second.model,e.model); // independent clones
});

test('spawnEnemy scales the bar larger for boss-type enemies',t=>{
 installGlobals(t,canvasStub());
 const ctx=makeCtx();ctx.bossType=()=>true;
 const {spawnEnemy}=createEnemySpawner(ctx);
 const e=spawnEnemy('boss',0,0);
 assert.equal(e.bar.scale.x,4);assert.equal(e.bar.scale.y,.75);
});

test('updateEnemyBar redraws the canvas from current hp/name without touching anything else on the enemy',t=>{
 installGlobals(t,canvasStub());
 const ctx=makeCtx(),{spawnEnemy,updateEnemyBar}=createEnemySpawner(ctx);
 const e=spawnEnemy('hollow',0,0);
 const opsBefore=e.barCanvas._ctx2d.ops.length,versionBefore=e.barTexture.version;
 e.hp=ENEMY_TYPES.hollow.hp/2;e.barHealth=ENEMY_TYPES.hollow.hp/2;
 updateEnemyBar(e);
 assert.ok(e.barCanvas._ctx2d.ops.length>opsBefore); // redrew: cleared, filled the bar and text again
 assert.equal(e.barCanvas.width,256);assert.equal(e.barCanvas.height,48); // set once by spawnEnemy, untouched here
 assert.equal(e.barTexture.version,versionBefore+1); // needsUpdate=true (write-only; version is its observable effect)
 assert.equal(e.hp,ENEMY_TYPES.hollow.hp/2);assert.equal(e.type,'hollow'); // only the canvas/texture were touched
});

// ---- P6d: proof that updateEnemyBar skips the canvas redraw/texture re-upload once its drawn
// inputs (name, clamped hp, maxHp, the exact barHealth fillRect width) are unchanged, and that
// when it does redraw the drawn commands are identical to the original implementation's.

// A richer canvas 2d context stub than canvasStub() above: records each drawing call as a plain,
// deepEqual-comparable tuple (including the style state active at call time), so two independent
// runs (reference vs optimized, or before/after a state change) can be compared exactly. Gradient
// objects are recorded as their stop/coordinate data, not the CanvasGradient-like object itself
// (whose addColorStop closure would never be reference-equal across two separate
// createLinearGradient() calls even when behaviourally identical).
function richCanvasStub(){
 return {document:{createElement(tag){
  assert.equal(tag,'canvas');
  let fillStyle=null,font=null,textAlign=null,shadowColor=null,shadowBlur=null,strokeStyle=null,lineWidth=null;
  const ops=[];
  const describe=v=>(v&&v._stops)?{gradientStops:v._stops.map(s=>[...s]),coords:[...v._coords]}:v;
  const ctx2d={
   set fillStyle(v){fillStyle=describe(v);},get fillStyle(){return fillStyle;},
   set font(v){font=v;},get font(){return font;},
   set textAlign(v){textAlign=v;},get textAlign(){return textAlign;},
   set shadowColor(v){shadowColor=v;},get shadowColor(){return shadowColor;},
   set shadowBlur(v){shadowBlur=v;},get shadowBlur(){return shadowBlur;},
   set strokeStyle(v){strokeStyle=v;},get strokeStyle(){return strokeStyle;},
   set lineWidth(v){lineWidth=v;},get lineWidth(){return lineWidth;},
   clearRect(x,y,w,h){ops.push(['clearRect',x,y,w,h]);},
   fillText(text,x,y){ops.push(['fillText',text,x,y,font,textAlign,fillStyle,shadowColor,shadowBlur]);},
   fillRect(x,y,w,h){ops.push(['fillRect',x,y,w,h,fillStyle]);},
   strokeRect(x,y,w,h){ops.push(['strokeRect',x,y,w,h,strokeStyle,lineWidth]);},
   createLinearGradient(x0,y0,x1,y1){const stops=[];return {addColorStop(offset,color){stops.push([offset,color]);},_stops:stops,_coords:[x0,y0,x1,y1]};}
  };
  return {width:0,height:0,getContext(kind){assert.equal(kind,'2d');return ctx2d;},_ctx2d:ctx2d,_ops:ops};
 }}};
}

test('updateEnemyBar skips the canvas redraw and texture re-upload once its drawn inputs are unchanged, and redraws when hp/barHealth/name/maxHp change',t=>{
 installGlobals(t,richCanvasStub());
 const ctx=makeCtx(),{spawnEnemy,updateEnemyBar}=createEnemySpawner(ctx);
 const e=spawnEnemy('hollow',0,0); // spawnEnemy's own updateEnemyBar(e) call already drew once.
 const opsAfterSpawn=e.barCanvas._ops.length,versionAfterSpawn=e.barTexture.version;
 assert.ok(opsAfterSpawn>0,'the first call (from spawnEnemy) always draws');

 updateEnemyBar(e);
 assert.equal(e.barCanvas._ops.length,opsAfterSpawn,'a call with nothing changed is skipped');
 assert.equal(e.barTexture.version,versionAfterSpawn,'needsUpdate is not re-set when the redraw is skipped');

 e.hp-=1;
 updateEnemyBar(e);
 assert.ok(e.barCanvas._ops.length>opsAfterSpawn,'a changed hp redraws');
 assert.equal(e.barTexture.version,versionAfterSpawn+1);
 let before=e.barCanvas._ops.length,beforeVersion=e.barTexture.version;
 updateEnemyBar(e);
 assert.equal(e.barCanvas._ops.length,before,'unchanged again after the hp redraw is skipped');
 assert.equal(e.barTexture.version,beforeVersion);

 e.barHealth-=5; // moves the exact fillRect width (250*barHealth/maxHp), not just the raw ratio
 updateEnemyBar(e);
 assert.ok(e.barCanvas._ops.length>before,'a changed barHealth redraws');
 assert.equal(e.barTexture.version,beforeVersion+1);
 before=e.barCanvas._ops.length;beforeVersion=e.barTexture.version;
 updateEnemyBar(e);
 assert.equal(e.barCanvas._ops.length,before,'unchanged again after the barHealth redraw is skipped');
 assert.equal(e.barTexture.version,beforeVersion);

 e.data={...e.data,name:e.data.name+' II'}; // a fresh data object, not a mutation of ENEMY_TYPES
 updateEnemyBar(e);
 assert.ok(e.barCanvas._ops.length>before,'a changed name redraws');
 assert.equal(e.barTexture.version,beforeVersion+1);
 before=e.barCanvas._ops.length;beforeVersion=e.barTexture.version;
 updateEnemyBar(e);
 assert.equal(e.barCanvas._ops.length,before,'unchanged again after the name redraw is skipped');
 assert.equal(e.barTexture.version,beforeVersion);

 e.maxHp+=10;
 updateEnemyBar(e);
 assert.ok(e.barCanvas._ops.length>before,'a changed maxHp redraws');
 assert.equal(e.barTexture.version,beforeVersion+1);
});

test('updateEnemyBar draws the exact same canvas commands as the original implementation across randomized enemy states',t=>{
 // ---- verbatim reference, copied from
 // `git show codex/snapshot-network-render-1fe3ccc2-bc3e:dist/enemy-spawner.js` (the base this
 // worktree is stacked on; dist/enemy-spawner.js is not on main yet).
 function referenceUpdateEnemyBar(e){const c=e.barCanvas.getContext('2d');c.clearRect(0,0,256,48);c.font='500 20px Georgia';c.textAlign='left';c.fillStyle='#e0d3b0';c.shadowColor='#000';c.shadowBlur=5;c.fillText(e.data.name,4,20);c.textAlign='right';c.font='16px Arial';c.fillText(`${Math.max(0,e.hp)} / ${e.maxHp}`,252,20);c.shadowBlur=0;c.fillStyle='#091211';c.fillRect(0,27,256,20);c.fillStyle='#c6b58c';c.fillRect(3,30,250*Math.max(0,e.barHealth/e.maxHp),14);const red=c.createLinearGradient(0,30,0,44);red.addColorStop(0,'#ff293b');red.addColorStop(.45,'#981f25');red.addColorStop(1,'#660f1b');c.fillStyle=red;c.fillRect(3,30,250*Math.max(0,e.hp/e.maxHp),14);c.fillStyle='#ff5360';c.fillRect(3,30,250*Math.max(0,e.hp/e.maxHp),3);c.strokeStyle='#8d9275';c.lineWidth=1;c.strokeRect(.5,27.5,255,19);e.barTexture.needsUpdate=true;}

 // Seeded PRNG (mulberry32), duplicated from tests/region-travel.test.mjs for this file's own
 // determinism, independent of any other test file.
 function mulberry32(seed){
  return function(){
   seed=seed+0x6D2B79F5|0;
   let z=seed;
   z=Math.imul(z^z>>>15,z|1);
   z^=z+Math.imul(z^z>>>7,z|61);
   return ((z^z>>>14)>>>0)/4294967296;
  };
 }

 installGlobals(t,richCanvasStub());
 const {updateEnemyBar}=createEnemySpawner({}); // updateEnemyBar only reads/writes its `e` argument

 const rand=mulberry32(0xABCD1234);
 const NAMES=['Hollow Warden','Grave Hound','Bellkeeper','Rootbound Elder','Quarry Warden','Ash Regent'];
 const SCENARIOS=520;
 for(let i=0;i<SCENARIOS;i++){
  const maxHp=1+Math.floor(rand()*300);
  // includes negative hp/barHealth and values above maxHp (empty/edge cases: an overheal or a
  // stale-but-not-yet-clamped combat value), on top of the ordinary 0..maxHp range.
  const hp=Math.round((rand()*2.2-.6)*maxHp);
  const barHealth=Math.round((rand()*2.2-.6)*maxHp);
  const name=NAMES[Math.floor(rand()*NAMES.length)];

  const canvasA=document.createElement('canvas'),canvasB=document.createElement('canvas');
  const optimized={data:{name},hp,maxHp,barHealth,barCanvas:canvasA,barTexture:{needsUpdate:false}};
  const reference={data:{name},hp,maxHp,barHealth,barCanvas:canvasB,barTexture:{needsUpdate:false}};

  updateEnemyBar(optimized);
  referenceUpdateEnemyBar(reference);

  assert.deepEqual(canvasA._ops,canvasB._ops,`scenario ${i} (hp=${hp} maxHp=${maxHp} barHealth=${barHealth} name=${name}): drawn commands match`);
  assert.equal(optimized.barTexture.needsUpdate,true,`scenario ${i}: needsUpdate set on a first (always-draws) call`);
  assert.equal(reference.barTexture.needsUpdate,true,`scenario ${i}: reference needsUpdate set too`);
 }
});
