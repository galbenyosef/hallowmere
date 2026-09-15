import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from '../dist/vendor/three.core.js';
import {createMouseTargeting} from '../dist/mouse-targeting.js';
import {installGlobals} from './helpers/dom.mjs';

// ---------------------------------------------------------------------------
// Reference implementation: a byte-for-byte copy of createMouseTargeting()
// as it existed before P1 (verified identical to `git show main:dist/mouse-targeting.js`
// at the time this test was written). Only the top-level function name changed
// (createMouseTargeting -> createMouseTargetingOriginal) so it can live next to
// the real, refactored export and share the same enemies/camera/scene fixtures.
// Do not "clean up" this copy -- it is the parity oracle for P1's rect caching.
// ---------------------------------------------------------------------------
// Measure forgiveness in CSS pixels so aiming feels the same at every zoom.
const SNAP_PADDING=20,RELEASE_PADDING=8,SWITCH_BIAS=6;
function createMouseTargetingOriginal({scene,camera,canvas,enemies}){
 const projected=new T.Vector3(),raycaster=new T.Raycaster(),tint=new T.Color('#ff7952');
 const marker=new T.Group();marker.visible=false;scene.add(marker);
 const ring=new T.Mesh(new T.RingGeometry(.92,1,64),new T.MeshBasicMaterial({color:'#ffae79',transparent:true,opacity:.95,depthWrite:false,toneMapped:false}));
 ring.rotation.x=-Math.PI/2;marker.add(ring);
 for(let i=0;i<4;i++){
  const bracket=new T.Mesh(new T.RingGeometry(1.08,1.15,12,1,i*Math.PI/2+.2,.48),ring.material);
  bracket.rotation.x=-Math.PI/2;marker.add(bracket);
 }
 let selected=null,materials=[];
 function show(enemy){
  if(enemy?.dead||!enemy?.model.parent)enemy=null;
  if(enemy!==selected){
   for(const [material,emissive] of materials)material.emissive.copy(emissive);
   selected=enemy;materials=[];
   if(enemy){
    const unique=new Set();enemy.model.traverse(object=>{
     for(const material of Array.isArray(object.material)?object.material:[object.material])if(material?.emissive)unique.add(material);
    });
    for(const material of unique){materials.push([material,material.emissive.clone()]);material.emissive.lerp(tint,.4);}
   }
  }
  marker.visible=!!enemy;
  if(enemy){
   const bounds=enemy.pickBounds,radius=Math.max(.8,Math.max(bounds.max.x-bounds.min.x,bounds.max.z-bounds.min.z)*.55);
   marker.position.set(enemy.model.position.x,.14,enemy.model.position.z);marker.scale.setScalar(radius);
  }
 }
 function pick(pointer,{assist=true}={}){
  const rect=canvas.getBoundingClientRect(),px=(pointer.x+1)*rect.width/2,py=(1-pointer.y)*rect.height/2,candidates=[];
  camera.updateMatrixWorld();
  for(const enemy of enemies){
   if(enemy.dead||!enemy.model.visible||!enemy.model.parent)continue;
   enemy.model.updateWorldMatrix(true,false);
   const bounds=enemy.pickBounds;let left=Infinity,right=-Infinity,top=Infinity,bottom=-Infinity,inFront=false;
   for(const x of [bounds.min.x,bounds.max.x])for(const y of [bounds.min.y,bounds.max.y])for(const z of [bounds.min.z,bounds.max.z]){
    projected.set(x,y,z).applyMatrix4(enemy.model.matrixWorld).project(camera);
    if(projected.z>=-1&&projected.z<=1)inFront=true;
    const sx=(projected.x+1)*rect.width/2,sy=(1-projected.y)*rect.height/2;
    left=Math.min(left,sx);right=Math.max(right,sx);top=Math.min(top,sy);bottom=Math.max(bottom,sy);
   }
   if(!inFront||right<0||left>rect.width||bottom<0||top>rect.height)continue;
   const edgeDistance=Math.hypot(Math.max(left-px,0,px-right),Math.max(top-py,0,py-bottom));
   const sticky=enemy===selected,padding=assist?SNAP_PADDING+(sticky?RELEASE_PADDING:0):0;
   if(edgeDistance>padding)continue;
   const centerDistance=Math.hypot(px-(left+right)/2,py-(top+bottom)/2);
   candidates.push({enemy,score:edgeDistance+centerDistance*.15-(sticky?SWITCH_BIAS:0)});
  }
  // Direct hits always win; the expanded area only catches near misses.
  raycaster.setFromCamera(pointer,camera);
  const hits=raycaster.intersectObjects(candidates.map(c=>c.enemy.model),true);
  if(hits.length){let object=hits[0].object;while(object&&object.parent!==scene)object=object.parent;return candidates.find(c=>c.enemy.model===object)?.enemy||null;}
  return assist?candidates.sort((a,b)=>a.score-b.score)[0]?.enemy||null:null;
 }
 return {pick,show,get selected(){return selected;}};
}

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

// Minimal stand-in for `window`/`visualViewport`: records listeners per
// (type, capture) pair and lets a test fire them on demand, so we can prove
// invalidation only happens for the exact event + phase mouse-targeting.js
// is supposed to listen on (e.g. capture-phase scroll).
function makeWindowStub() {
 function listenerStore() {
  const byKey = new Map();
  return {
   add(type, handler, capture = false) {
    const key = `${type}:${!!capture}`;
    if (!byKey.has(key)) byKey.set(key, new Set());
    byKey.get(key).add(handler);
   },
   fire(type, capture = false) {
    const key = `${type}:${!!capture}`;
    for (const handler of byKey.get(key) || []) handler();
   },
  };
 }
 const windowListeners = listenerStore();
 const viewportListeners = listenerStore();
 return {
  visualViewport: {
   addEventListener(type, handler) { viewportListeners.add(type, handler, false); },
   dispatch(type) { viewportListeners.fire(type, false); },
  },
  addEventListener(type, handler, capture) { windowListeners.add(type, handler, capture); },
  dispatch(type, capture = false) { windowListeners.fire(type, capture); },
 };
}

// A simple orthographic pose matching the game's camera frustum
// (see dist/main.js: `new T.OrthographicCamera(-20,20,15,-15,.1,150)`), aimed
// straight down the Y axis so world X maps linearly onto screen X and a world
// Z of 0 always lands exactly on the vertical screen center regardless of
// canvas height -- which is what lets the resize/scroll fixtures below change
// only the horizontal edge-distance math when the rect's width changes.
function makeTopDownCamera() {
 const camera = new T.OrthographicCamera(-20, 20, 15, -15, .1, 150);
 camera.position.set(0, 10, 0);
 camera.up.set(0, 0, -1);
 camera.lookAt(0, 0, 0);
 return camera;
}

// A single enemy at world (8,0,0) with a point-sized pickBounds centered on
// the model's own origin, so its projected screen position is exact and not
// smeared across a box -- makes the CSS-pixel edge-distance math in the
// invalidation tests exact instead of approximate.
function makePointEnemy(scene, {parented = true, visible = true, dead = false} = {}) {
 const model = new T.Group();
 model.position.set(8, 0, 0);
 model.visible = visible;
 if (parented) scene.add(model);
 const pickBounds = new T.Box3(new T.Vector3(0, 0, 0), new T.Vector3(0, 0, 0));
 return {model, pickBounds, dead};
}

// With the camera/enemy above: ndc.x = 0.4 exactly. At rect width 800 that's
// screen x = 560; placing the pointer 16 CSS px to the left (pointer.x=0.36)
// keeps it inside the 20px SNAP_PADDING. Doubling the rect to 1600x1200
// doubles that same 16px gap to 32px (px and the enemy's screen x both scale
// with rect.width, using the *same* pointer.x), which exceeds SNAP_PADDING --
// so a stale vs. fresh rect produces a different (picked vs. not picked)
// result, which is what proves the cache is actually being used/invalidated.
const EDGE_POINTER = {x: .36, y: 0};
const RECT_BEFORE = {width: 800, height: 600};
const RECT_AFTER = {width: 1600, height: 1200};

function edgeFixture(windowTarget) {
 const scene = new T.Scene();
 const camera = makeTopDownCamera();
 const enemy = makePointEnemy(scene);
 let rect = RECT_BEFORE, calls = 0;
 const canvas = {getBoundingClientRect() { calls++; return rect; }};
 const mt = createMouseTargeting({scene, camera, canvas, enemies: [enemy], windowTarget});
 return {
  mt, enemy,
  pick: () => mt.pick(EDGE_POINTER),
  calls: () => calls,
  growViewport: () => { rect = RECT_AFTER; },
 };
}

// ---------------------------------------------------------------------------
// (1) The rect is fetched once and reused across many picks.
// ---------------------------------------------------------------------------

test('pick() only calls getBoundingClientRect once across many calls when a windowTarget is supplied', () => {
 let calls = 0;
 const canvas = {getBoundingClientRect() { calls++; return {width: 800, height: 600}; }};
 const mt = createMouseTargeting({scene: new T.Scene(), camera: makeTopDownCamera(), canvas, enemies: [], windowTarget: makeWindowStub()});
 for (let i = 0; i < 50; i++) mt.pick({x: 0, y: 0});
 assert.equal(calls, 1);
});

// ---------------------------------------------------------------------------
// (2) Each invalidation source forces exactly one re-fetch, and the refreshed
// rect changes the pick outcome (not just the call count).
// ---------------------------------------------------------------------------

test('resize invalidates the cached rect', () => {
 const windowTarget = makeWindowStub();
 const f = edgeFixture(windowTarget);
 assert.equal(f.pick(), f.enemy, 'picked before any viewport change');
 assert.equal(f.calls(), 1);
 assert.equal(f.pick(), f.enemy, 'still cached, no extra fetch');
 assert.equal(f.calls(), 1);
 f.growViewport();
 assert.equal(f.pick(), f.enemy, 'rect changed underneath but not yet invalidated -- stays stale');
 assert.equal(f.calls(), 1);
 windowTarget.dispatch('resize');
 assert.equal(f.pick(), null, 'now recomputed with the larger rect, enemy falls outside SNAP_PADDING');
 assert.equal(f.calls(), 2);
 assert.equal(f.pick(), null, 'refreshed rect is cached again');
 assert.equal(f.calls(), 2);
});

test('scroll only invalidates during the capture phase', () => {
 const windowTarget = makeWindowStub();
 const f = edgeFixture(windowTarget);
 assert.equal(f.pick(), f.enemy);
 assert.equal(f.calls(), 1);
 f.growViewport();
 windowTarget.dispatch('scroll', false);
 assert.equal(f.pick(), f.enemy, 'bubble-phase scroll must not invalidate');
 assert.equal(f.calls(), 1);
 windowTarget.dispatch('scroll', true);
 assert.equal(f.pick(), null, 'capture-phase scroll invalidates');
 assert.equal(f.calls(), 2);
});

test('visualViewport resize invalidates the cached rect', () => {
 const windowTarget = makeWindowStub();
 const f = edgeFixture(windowTarget);
 assert.equal(f.pick(), f.enemy);
 assert.equal(f.calls(), 1);
 f.growViewport();
 windowTarget.visualViewport.dispatch('resize');
 assert.equal(f.pick(), null);
 assert.equal(f.calls(), 2);
});

test('visualViewport scroll invalidates the cached rect', () => {
 const windowTarget = makeWindowStub();
 const f = edgeFixture(windowTarget);
 assert.equal(f.pick(), f.enemy);
 assert.equal(f.calls(), 1);
 f.growViewport();
 windowTarget.visualViewport.dispatch('scroll');
 assert.equal(f.pick(), null);
 assert.equal(f.calls(), 2);
});

test('orientationchange invalidates the cached rect', () => {
 const windowTarget = makeWindowStub();
 const f = edgeFixture(windowTarget);
 assert.equal(f.pick(), f.enemy);
 assert.equal(f.calls(), 1);
 f.growViewport();
 windowTarget.dispatch('orientationchange');
 assert.equal(f.pick(), null);
 assert.equal(f.calls(), 2);
});

test('a windowTarget with no visualViewport is fine -- only window-level listeners are registered', () => {
 const windowTarget = makeWindowStub();
 delete windowTarget.visualViewport;
 assert.doesNotThrow(() => createMouseTargeting({scene: new T.Scene(), camera: makeTopDownCamera(), canvas: {getBoundingClientRect: () => ({width: 800, height: 600})}, enemies: [], windowTarget}));
});

// ---------------------------------------------------------------------------
// (3) No windowTarget at all -> unchanged, always-fresh behavior.
// ---------------------------------------------------------------------------

test('falls back to calling getBoundingClientRect on every pick when there is no windowTarget', () => {
 let calls = 0;
 const canvas = {getBoundingClientRect() { calls++; return {width: 800, height: 600}; }};
 const mt = createMouseTargeting({scene: new T.Scene(), camera: makeTopDownCamera(), canvas, enemies: [], windowTarget: undefined});
 for (let i = 0; i < 50; i++) mt.pick({x: 0, y: 0});
 assert.equal(calls, 50);
});

test('defaults windowTarget to globalThis.window when the caller does not pass one', (t) => {
 const stub = makeWindowStub();
 installGlobals(t, {window: stub});
 let calls = 0;
 const canvas = {getBoundingClientRect() { calls++; return {width: 800, height: 600}; }};
 const mt = createMouseTargeting({scene: new T.Scene(), camera: makeTopDownCamera(), canvas, enemies: []});
 mt.pick({x: 0, y: 0});
 mt.pick({x: 0, y: 0});
 assert.equal(calls, 1, 'picked up the global window and cached');
 stub.dispatch('resize');
 mt.pick({x: 0, y: 0});
 assert.equal(calls, 2, 'global window resize still invalidates');
});

// ---------------------------------------------------------------------------
// invalidateRect() is exposed for future callers.
// ---------------------------------------------------------------------------

test('invalidateRect() forces the next pick to re-fetch the rect', () => {
 const windowTarget = makeWindowStub();
 const f = edgeFixture(windowTarget);
 assert.equal(f.pick(), f.enemy);
 assert.equal(f.calls(), 1);
 f.growViewport();
 f.mt.invalidateRect();
 assert.equal(f.pick(), null);
 assert.equal(f.calls(), 2);
});

// ---------------------------------------------------------------------------
// (4) PARITY: the new pick() must select exactly the same enemy (or null) as
// the original, verbatim pick(), across >=500 randomized scenes.
// ---------------------------------------------------------------------------

// Deterministic PRNG (mulberry32) so a failure is reproducible.
function mulberry32(seed) {
 return function () {
  seed |= 0; seed = seed + 0x6D2B79F5 | 0;
  let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
  t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
  return ((t ^ t >>> 14) >>> 0) / 4294967296;
 };
}
const rng = mulberry32(0xC0FFEE);
const rand = (min, max) => min + rng() * (max - min);

function randomEnemySpec() {
 return {
  pos: [rand(-30, 30), 0, rand(-30, 30)],
  half: [rand(.3, 1.5), rand(.5, 3), rand(.3, 1.5)],
  rotY: rand(0, Math.PI * 2),
  dead: rng() < .2,
  visible: rng() < .85,
  parented: rng() < .85,
 };
}

function randomScenario() {
 const count = Math.floor(rand(0, 13));
 return {
  cameraPos: [rand(-40, 40), rand(5, 60), rand(-40, 40)],
  lookAt: [rand(-10, 10), 0, rand(-10, 10)],
  rect: {width: rand(320, 2000), height: rand(320, 1200)},
  pointer: {x: rand(-1.3, 1.3), y: rand(-1.3, 1.3)},
  assist: rng() < .5,
  enemies: Array.from({length: count}, randomEnemySpec),
 };
}

// A handful of explicit edge cases up front (deterministic, not left to chance).
function explicitScenarios() {
 const base = {cameraPos: [18, 22, 18], lookAt: [0, 0, 0], rect: {width: 800, height: 600}, pointer: {x: 0, y: 0}};
 const scattered = () => [
  {pos: [3, 0, -4], half: [.6, 1.2, .6], rotY: .3, dead: false, visible: true, parented: true},
  {pos: [-10, 0, 6], half: [1, 2, 1], rotY: 1.1, dead: false, visible: true, parented: true},
  {pos: [15, 0, 15], half: [.5, 1, .5], rotY: 2.2, dead: false, visible: true, parented: true},
  {pos: [-6, 0, -12], half: [.8, 1.5, .8], rotY: 4.1, dead: false, visible: true, parented: true},
 ];
 return [
  {...base, assist: true, enemies: []}, // no enemies, assist on
  {...base, assist: false, enemies: []}, // no enemies, assist off
  {...base, assist: true, enemies: scattered().map(e => ({...e, dead: true}))}, // every enemy dead
  {...base, assist: true, enemies: scattered().map(e => ({...e, visible: false}))}, // every enemy invisible
  {...base, assist: true, enemies: scattered().map(e => ({...e, parented: false}))}, // every enemy unparented
  {...base, assist: true, enemies: [{pos: [0, 0, 0], half: [0, 0, 0], rotY: 0, dead: false, visible: true, parented: true}]}, // pointer dead center on the camera's look-at target
  {...base, pointer: {x: -1, y: -1}, assist: true, enemies: scattered()}, // pointer at a corner
  {...base, pointer: {x: 1, y: 1}, assist: true, enemies: scattered()}, // pointer at the opposite corner
  {...base, rect: {width: 2, height: 2}, assist: true, enemies: scattered()}, // degenerate tiny canvas
  {...base, rect: {width: 4000, height: 3000}, assist: true, enemies: scattered()}, // huge canvas
 ];
}

function buildFixture(scenario) {
 const scene = new T.Scene();
 const camera = new T.OrthographicCamera(-20, 20, 15, -15, .1, 150);
 camera.position.set(...scenario.cameraPos);
 camera.lookAt(...scenario.lookAt);
 const enemies = scenario.enemies.map(spec => {
  const model = new T.Group();
  model.position.set(...spec.pos);
  model.rotation.y = spec.rotY;
  model.visible = spec.visible;
  if (spec.parented) scene.add(model);
  const pickBounds = new T.Box3(
   new T.Vector3(-spec.half[0], 0, -spec.half[2]),
   new T.Vector3(spec.half[0], spec.half[1], spec.half[2]),
  );
  return {model, pickBounds, dead: spec.dead};
 });
 return {scene, camera, enemies};
}

const SCENARIOS = [...explicitScenarios(), ...Array.from({length: 490}, randomScenario)];
assert.equal(SCENARIOS.length, 500);

test(`pick() matches the original implementation across ${SCENARIOS.length} randomized scenes`, () => {
 SCENARIOS.forEach((scenario, i) => {
  const {scene, camera, enemies} = buildFixture(scenario);
  const canvas = {getBoundingClientRect: () => scenario.rect};
  const reference = createMouseTargetingOriginal({scene, camera, canvas, enemies});
  const fresh = createMouseTargeting({scene, camera, canvas, enemies, windowTarget: undefined});
  const refResult = reference.pick(scenario.pointer, {assist: scenario.assist});
  const newResult = fresh.pick(scenario.pointer, {assist: scenario.assist});
  assert.equal(newResult, refResult, `scenario #${i} (${JSON.stringify({rect: scenario.rect, pointer: scenario.pointer, assist: scenario.assist, enemyCount: enemies.length})}) picked a different enemy`);
 });
});
