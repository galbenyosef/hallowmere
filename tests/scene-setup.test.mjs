import test from 'node:test';
import assert from 'node:assert/strict';
import {registerHooks} from 'node:module';
import {START} from '../dist/campaign.js';
import {installGlobals} from './helpers/dom.mjs';

// M11 cut init()'s body into three consecutive statement groups -- buildRenderer, buildWorld,
// buildHero -- plus resize, and left the awaits, the progress line between the groups and the
// closing setAnimationLoop statement in main.js. Nothing inside a group moved, so what these
// tests pin is the boundary: which constructors and factories each group calls, in what order,
// what it writes onto ctx, and the two progress/loading branches the loading screen depends on.
// The real Three core classes run headless; every module-level constructor and factory the
// groups reach comes in through the `deps` escape hatch, so no GL context and none of the 58 MB
// of GLTF prefabs are needed.
const hook=registerHooks({resolve(specifier,context,nextResolve){
 if(specifier==='three')return nextResolve(new URL('../dist/vendor/three.module.js',import.meta.url).href,context);
 if(specifier.startsWith('three/addons/'))return nextResolve(new URL('../dist/vendor/'+specifier.slice('three/addons/'.length),import.meta.url).href,context);
 return nextResolve(specifier,context);
}});
const T=await import('../dist/vendor/three.module.js');
const {createSceneSetup}=await import('../dist/scene-setup.js');
hook.deregister();

const MODELS=['warden','hollow','grave-hound','revenant','bellkeeper','elder','healer','smith','watchman'];

function makeRenderer(calls){
 return class StubWebGLRenderer{
  constructor(options){calls.push('new WebGLRenderer');this.options=options;this.shadowMap={enabled:false,type:null};this.sizes=[];this.pixelRatios=[];}
  setPixelRatio(ratio){this.pixelRatios.push(ratio);}
  setSize(w,h,updateStyle){this.sizes.push([w,h,updateStyle]);}
 };
}

function makeDeps(calls){
 const node=name=>{const o=new T.Object3D();o.name=name;return o;};
 return {
  WebGLRenderer:makeRenderer(calls),
  GLTFLoader:class{constructor(){calls.push('new GLTFLoader');this.urls=[];}
   async loadAsync(url){this.urls.push(url);calls.push('loadAsync');return {scene:node('prefab')};}},
  createEnvironment:scene=>{calls.push('createEnvironment');const o=node('environment');scene.add(o);return {glowTexture:'glow',obstacles:[],root:o};},
  createRegionLandmarks:(scene,map)=>{calls.push('createRegionLandmarks:'+map);const o=node('landmarks');scene.add(o);return o;},
  createCombatEffects:(scene,glow,options)=>{calls.push('createCombatEffects:'+glow+':'+options.reducedMotion);return {};},
  createClassEffects:(scene,options)=>{calls.push('createClassEffects:'+options.reducedMotion);return {};},
  optimizeModel:()=>{calls.push('optimizeModel');},
  getRig:()=>{calls.push('getRig');return {rig:true};},
  createPredatorWorldPreview:options=>{calls.push('createPredatorWorldPreview');return {root:node('preview'),player:options.player};},
  VillageLife:class{constructor(options){calls.push('new VillageLife');Object.assign(this,{options});}},
  createMouseTargeting:options=>{calls.push('createMouseTargeting');return {options};},
  createMultiplayerView:options=>{calls.push('createMultiplayerView');return {options};},
  createRosterPicker:options=>{calls.push('createRosterPicker');return {options};},
  animateHeroAttack:function animateHeroAttack(){}
 };
}

function makeCtx(){
 return {
  gameSettings:{brightness:100,shadows:true,cameraShake:true},reducedMotion:false,
  cameraTarget:new T.Vector3(0,0,1.6),cameraOffset:new T.Vector3(17,25,26),
  prefabs:{},enemies:[],state:{classId:null},loadingFailed:false,
  paused:false,backgrounded:false,creatingJourney:false,network:{sent:[],send(type,payload){this.sent.push([type,payload]);return true;}},
  titleScreen:{progress:[],setProgress(value,label){this.progress.push([value,label]);}},
  cloneModel:key=>{const o=new T.Object3D();o.name='model:'+key;return o;},
  animateRig(){},awakenCalls:0,awaken(){this.awakenCalls++;},
  setDestination(point){return point;},talkTo(){},lootCollected(){},collectClickedLoot(){},
  chooseCharacter(){},closeRoster(){},navigateMenu(){}
 };
}

function wire(t,{search='',width=1440,height=900}={}){
 const canvas={id:'world'};
 installGlobals(t,{document:{getElementById:id=>id==='world'?canvas:{id}},
  location:{search},innerWidth:width,innerHeight:height,devicePixelRatio:2});
 const calls=[],ctx=makeCtx(),deps=makeDeps(calls);
 return {calls,ctx,canvas,deps,sceneSetup:createSceneSetup(ctx,deps)};
}

test('buildRenderer builds the renderer, the scene and camera, then the three lights -- and sizes the camera through resize',async t=>{
 const {calls,ctx,canvas,sceneSetup}=wire(t);
 await sceneSetup.buildRenderer();
 assert.deepEqual(calls,['new WebGLRenderer']);
 assert.equal(ctx.renderer.options.canvas,canvas,"the renderer draws into $('world')");
 assert.equal(ctx.renderer.options.antialias,true);
 assert.equal(ctx.renderer.options.powerPreference,'high-performance');
 assert.deepEqual(ctx.renderer.pixelRatios,[1.7],'the device pixel ratio is still capped at 1.7');
 assert.equal(ctx.renderer.shadowMap.enabled,true);
 assert.equal(ctx.renderer.toneMappingExposure,1.12,'applyGameVisuals ran against the new renderer');
 assert.ok(ctx.scene.isScene&&ctx.camera.isOrthographicCamera);
 assert.equal(ctx.scene.fog.density,.017);
 assert.ok(ctx.hemisphereLight.isHemisphereLight&&ctx.moonLight.isDirectionalLight&&ctx.rimLight.isDirectionalLight);
 assert.equal(ctx.moonLight.castShadow,true);
 assert.deepEqual(ctx.renderer.sizes,[[1440,900,false]],'buildRenderer ends by calling resize()');
 assert.equal(ctx.camera.top,14.5,'resize set the 29-unit frustum height');
 assert.ok(ctx.scene.children.includes(ctx.moonLight)&&ctx.scene.children.includes(ctx.moonLight.target));
});

test('buildWorld creates the environment, landmarks and effect layers, then loads all nine prefabs',async t=>{
 const {calls,ctx,deps,sceneSetup}=wire(t);
 await sceneSetup.buildRenderer();
 calls.length=0;
 await sceneSetup.buildWorld();
 assert.deepEqual(calls.slice(0,6),['createEnvironment','createRegionLandmarks:overworld','createCombatEffects:glow:false','createClassEffects:false','new GLTFLoader',
  ...['loadAsync']]);
 assert.equal(calls.filter(c=>c==='loadAsync').length,MODELS.length);
 assert.equal(calls.filter(c=>c==='optimizeModel').length,MODELS.length);
 assert.equal(ctx.environment,ctx.overworldEnvironment,'the overworld environment is remembered for switchMap');
 assert.deepEqual(ctx.overworldObjects.map(o=>o.name),['environment','landmarks'],'overworldObjects is what the environment added to the scene');
 assert.deepEqual(Object.keys(ctx.prefabs).sort(),[...MODELS].sort());
 assert.deepEqual(ctx.titleScreen.progress.slice(0,2),[[28,'Lighting the village…'],[28,'Gathering the world…']]);
 assert.equal(ctx.titleScreen.progress.at(-1)[0],90,'the prefab loop ends at 28 + 62');
 assert.ok(deps.WebGLRenderer,'deps default to the real modules; the test only replaces them');
});

test('a prefab that resolves after the loading screen failed does not overwrite the error',async t=>{
 const {ctx,sceneSetup}=wire(t);
 await sceneSetup.buildRenderer();
 ctx.loadingFailed=true;
 await sceneSetup.buildWorld();
 assert.deepEqual(ctx.titleScreen.progress,[[28,'Lighting the village…'],[28,'Gathering the world…']],'no per-model progress once init() has shown the error');
 assert.deepEqual(Object.keys(ctx.prefabs).sort(),[...MODELS].sort(),'the prefabs still land');
});

test('buildHero builds the hero, then village life, mouse targeting, the multiplayer view and the roster picker',async t=>{
 const {calls,ctx,canvas,sceneSetup}=wire(t);
 await sceneSetup.buildRenderer();
 await sceneSetup.buildWorld();
 calls.length=0;
 await sceneSetup.buildHero();
 assert.deepEqual(calls,['getRig','new VillageLife','createMouseTargeting','createMultiplayerView','createRosterPicker']);
 assert.equal(ctx.player.userData.characterKey,'warden');
 assert.deepEqual([ctx.player.position.x,ctx.player.position.z],[START.x,START.z]);
 assert.deepEqual([ctx.cameraTarget.x,ctx.cameraTarget.z],[START.x,START.z-3.4]);
 assert.ok(ctx.scene.children.includes(ctx.player)&&ctx.scene.children.includes(ctx.selection));
 assert.ok(ctx.playerLight.isPointLight&&ctx.spellLight.isPointLight);
 assert.equal(ctx.spellLight.intensity,0,'the spell light starts dark');
 assert.equal(ctx.worldPreview,undefined,'no predator preview without ?preview=predator');
 assert.equal(ctx.mouseTargeting.options.canvas,canvas);
 assert.equal(ctx.life.options.onTalk,ctx.talkTo);
 assert.equal(ctx.life.options.onCollect,ctx.lootCollected);
 assert.equal(ctx.life.options.onLootClick,ctx.collectClickedLoot);
 assert.equal(ctx.rosterPicker.options.onNavigate,ctx.navigateMenu,'the roster picker gets bindInput’s navigateMenu, not a stale binding');
 assert.equal(ctx.rosterPicker.options.onChoose,ctx.chooseCharacter);
 ctx.life.options.onApproach({x:1,z:2});
 assert.equal(ctx.awakenCalls,1,'approaching a villager wakes the audio the same way it did in main.js');
});

test("buildHero's collect and forage requests are refused while the session is stalled or ended",async t=>{
 const {ctx,sceneSetup}=wire(t);
 await sceneSetup.buildRenderer();await sceneSetup.buildWorld();await sceneSetup.buildHero();
 assert.equal(ctx.life.requestCollect('loot-1'),true);
 assert.equal(ctx.life.requestForage('plant-1'),true);
 assert.deepEqual(ctx.network.sent,[['collect',{id:'loot-1'}],['forage',{id:'plant-1'}]]);
 for(const stall of [{paused:true},{backgrounded:true}]){
  Object.assign(ctx,{paused:false,backgrounded:false},stall);
  assert.equal(ctx.life.requestCollect('loot-2'),false);
 }
 Object.assign(ctx,{paused:false,backgrounded:false});
 ctx.state.ended=true;
 assert.equal(ctx.life.requestForage('plant-2'),false);
 assert.equal(ctx.network.sent.length,2,'nothing else reached the transport');
});

test('?preview=predator builds the world preview and resizes again',async t=>{
 const {calls,ctx,sceneSetup}=wire(t,{search:'?preview=predator'});
 await sceneSetup.buildRenderer();
 await sceneSetup.buildWorld();
 calls.length=0;
 await sceneSetup.buildHero();
 assert.deepEqual(calls.slice(0,4),['getRig','createPredatorWorldPreview','optimizeModel','new VillageLife'],'the preview branch sits between the hero group and village life, exactly where it did in init()');
 assert.ok(ctx.worldPreview);
 assert.equal(ctx.renderer.sizes.length,2,'the preview branch calls resize() a second time');
 assert.equal(ctx.camera.top,9.5,'a world preview switches the frustum to 19 units');
});

test('resize is a no-op before the renderer exists and otherwise picks the frustum height from the viewport and preview mode',async t=>{
 const narrow=wire(t,{width:600,height:900});
 narrow.sceneSetup.resize();
 assert.equal(narrow.ctx.camera,undefined,'no renderer yet, so nothing is touched');
 await narrow.sceneSetup.buildRenderer();
 assert.equal(narrow.ctx.camera.top,14,'a viewport under 650 wide uses 28 units');
 assert.equal(narrow.ctx.camera.right,-narrow.ctx.camera.left);
 assert.equal(narrow.ctx.camera.left,-28*(600/900)/2);

 const enemies=wire(t,{search:'?preview=enemies'});
 await enemies.sceneSetup.buildRenderer();
 assert.equal(enemies.ctx.camera.top,9.5,'the enemy preview uses 19 units');
});
