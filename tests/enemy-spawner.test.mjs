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
