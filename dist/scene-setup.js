// init()'s body, cut into the three consecutive statement groups it always ran in, plus
// resize (M11). Nothing was reordered: buildRenderer is main.js:80-82 (renderer, scene and
// camera, lights), buildWorld is :83-84 (environment, landmarks, overworld object set, combat
// and class effects, then the GLTF prefab load), buildHero is :86-92 (hero group and selection
// ring, the predator preview, village life, mouse targeting, the multiplayer view, the roster
// picker, and life's collect/forage requests). The statements between the groups -- the two
// loadingFrame() awaits, setProgress(92), the closing clock/assetsReady/setAnimationLoop line
// and the try/catch -- stayed in main.js's init(), in place.
//
// Free identifiers: T (three -- buildRenderer needs WebGLRenderer, so the full build), $
// (./dom.js, the 'world' canvas) and applyGameVisuals (./game-settings.js) stay plain imports;
// every constructor and factory the three groups call is re-imported through a `deps` escape
// hatch defaulting to that same import, so tests/scene-setup.test.mjs can record the call order
// without a GL context or the 58 MB of GLTF prefabs. devicePixelRatio, innerWidth, innerHeight,
// location, Math, Object, Set, Promise and URL are globals; the prefab URL keeps its
// `new URL('./assets/models/…',import.meta.url)` spelling, which resolves the same from this
// module as from main.js because both sit in dist/.
//
// ctx renames: main.js's `let loadingFailed` -- read by the prefab loop, written by init()'s
// catch -- became the ctx.loadingFailed data field, since the loop now lives here and the
// catch stayed there. ctx.awaken (M7's createGameAudio) and ctx.navigateMenu (M5's bindInput)
// were bare destructured bindings in main.js. Everything else was already spelled ctx.*.
import * as T from 'three';
import {GLTFLoader as GLTFLoaderImport} from 'three/addons/loaders/GLTFLoader.js';
import {$} from './dom.js';
import {applyGameVisuals} from './game-settings.js';
import {createEnvironment as createEnvironmentImport} from './environment.js';
import {createRegionLandmarks as createRegionLandmarksImport} from './region-environment.js';
import {createCombatEffects as createCombatEffectsImport,animateHeroAttack as animateHeroAttackImport} from './combat-effects.js';
import {createClassEffects as createClassEffectsImport} from './class-effects.js';
import {optimizeModel as optimizeModelImport,getRig as getRigImport} from './model-kit.js';
import {START} from './campaign.js';
import {createPredatorWorldPreview as createPredatorWorldPreviewImport} from './predator-world-preview.js';
import {VillageLife as VillageLifeImport} from './world-actors.js';
import {createMouseTargeting as createMouseTargetingImport} from './mouse-targeting.js';
import {createMultiplayerView as createMultiplayerViewImport} from './multiplayer-view.js';
import {createRosterPicker as createRosterPickerImport} from './roster-picker.js';
export function createSceneSetup(ctx,{WebGLRenderer=T.WebGLRenderer,GLTFLoader=GLTFLoaderImport,createEnvironment=createEnvironmentImport,createRegionLandmarks=createRegionLandmarksImport,createCombatEffects=createCombatEffectsImport,createClassEffects=createClassEffectsImport,optimizeModel=optimizeModelImport,getRig=getRigImport,createPredatorWorldPreview=createPredatorWorldPreviewImport,VillageLife=VillageLifeImport,createMouseTargeting=createMouseTargetingImport,createMultiplayerView=createMultiplayerViewImport,createRosterPicker=createRosterPickerImport,animateHeroAttack=animateHeroAttackImport}={}){
 async function buildRenderer(){
  ctx.renderer=new WebGLRenderer({canvas:$('world'),antialias:true,powerPreference:'high-performance'});ctx.renderer.setPixelRatio(Math.min(devicePixelRatio,1.7));ctx.renderer.shadowMap.enabled=true;ctx.renderer.shadowMap.type=T.PCFSoftShadowMap;ctx.renderer.outputColorSpace=T.SRGBColorSpace;ctx.renderer.toneMapping=T.ACESFilmicToneMapping;applyGameVisuals(ctx.gameSettings,ctx.renderer);
  ctx.scene=new T.Scene();ctx.scene.background=new T.Color(0x101c2b);ctx.scene.fog=new T.FogExp2(0x14283a,.017);ctx.camera=new T.OrthographicCamera(-20,20,15,-15,.1,150);ctx.camera.position.copy(ctx.cameraTarget).add(ctx.cameraOffset);ctx.camera.lookAt(ctx.cameraTarget);resize();
  ctx.hemisphereLight=new T.HemisphereLight(0x9eb8d0,0x493629,1.3);ctx.scene.add(ctx.hemisphereLight);const moon=ctx.moonLight=new T.DirectionalLight(0x86b5ed,2.35);moon.position.set(-16,29,9);moon.castShadow=true;moon.shadow.mapSize.set(2048,2048);Object.assign(moon.shadow.camera,{left:-38,right:38,top:38,bottom:-38,near:.5,far:90});moon.shadow.bias=-.00025;moon.shadow.normalBias=.035;moon.shadow.radius=2;ctx.scene.add(moon,moon.target);const rim=ctx.rimLight=new T.DirectionalLight(0x4aa7ce,1.25);rim.position.set(14,12,-22);ctx.scene.add(rim);
 }
 async function buildWorld(){
  const beforeEnvironment=new Set(ctx.scene.children);ctx.environment=ctx.overworldEnvironment=createEnvironment(ctx.scene);ctx.landmarks=createRegionLandmarks(ctx.scene,'overworld');ctx.overworldObjects=ctx.scene.children.filter(o=>!beforeEnvironment.has(o));ctx.combatEffects=createCombatEffects(ctx.scene,ctx.environment.glowTexture,{reducedMotion:ctx.reducedMotion});ctx.classEffects=createClassEffects(ctx.scene,{reducedMotion:ctx.reducedMotion});ctx.titleScreen.setProgress(28,'Lighting the village…');
  const loader=new GLTFLoader(),models=['warden','hollow','grave-hound','revenant','bellkeeper','elder','healer','smith','watchman'];let loaded=0;ctx.titleScreen.setProgress(28,'Gathering the world…');await Promise.all(models.map(async name=>{const result=await loader.loadAsync(new URL(`./assets/models/${name}.glb`,import.meta.url).href);optimizeModel(result.scene);ctx.prefabs[name]=result.scene;loaded++;if(!ctx.loadingFailed){ctx.titleScreen.setProgress(28+loaded/models.length*62,'Gathering the world…');}}));
 }
 async function buildHero(){
  ctx.player=new T.Group();ctx.player.add(ctx.cloneModel('warden'));ctx.player.userData.characterKey='warden';ctx.player.position.set(START.x,0,START.z);ctx.cameraTarget.set(START.x,0,START.z-3.4);ctx.scene.add(ctx.player);ctx.heroRig=getRig(ctx.player);ctx.selection=new T.Mesh(new T.RingGeometry(.43,.475,48),new T.MeshBasicMaterial({color:0xd2c79c,transparent:true,opacity:.55,depthWrite:false}));ctx.selection.rotation.x=-Math.PI/2;ctx.selection.position.y=.095;ctx.scene.add(ctx.selection);ctx.playerLight=new T.PointLight(0xffdfaa,10,6,2);ctx.scene.add(ctx.playerLight);ctx.spellLight=new T.PointLight(0xff7733,0,10,2);ctx.scene.add(ctx.spellLight);
  if(new URLSearchParams(location.search).get('preview')==='predator'){ctx.worldPreview=createPredatorWorldPreview({scene:ctx.scene,player:ctx.player});optimizeModel(ctx.worldPreview.root);resize();}
  ctx.life=new VillageLife({scene:ctx.scene,camera:ctx.camera,player:ctx.player,state:ctx.state,cloneModel:ctx.cloneModel,reducedMotion:ctx.reducedMotion,obstacles:ctx.environment.obstacles,onTalk:ctx.talkTo,onCollect:ctx.lootCollected,onLootClick:ctx.collectClickedLoot,onApproach:point=>{ctx.awaken();return ctx.setDestination(point);}});
  ctx.mouseTargeting=createMouseTargeting({scene:ctx.scene,camera:ctx.camera,canvas:$('world'),enemies:ctx.enemies});
  ctx.multiplayerView=createMultiplayerView({scene:ctx.scene,camera:ctx.camera,cloneModel:ctx.cloneModel,getRig,animateRig:ctx.animateRig,animateHeroAttack,player:ctx.player});
  ctx.rosterPicker=createRosterPicker({getState:()=>ctx.creatingJourney?{}:ctx.state,onChoose:ctx.chooseCharacter,onClose:ctx.closeRoster,onNavigate:ctx.navigateMenu});
  ctx.life.requestCollect=id=>!ctx.paused&&!ctx.backgrounded&&!ctx.state.ended&&ctx.network.send('collect',{id});ctx.life.requestForage=id=>!ctx.paused&&!ctx.backgrounded&&!ctx.state.ended&&ctx.network.send('forage',{id});
 }
 function resize(){if(!ctx.renderer)return;const w=innerWidth,h=innerHeight;ctx.renderer.setSize(w,h,false);const height=ctx.worldPreview||new URLSearchParams(location.search).get('preview')==='enemies'?19:w<650?28:29;ctx.camera.left=-height*(w/h)/2;ctx.camera.right=-ctx.camera.left;ctx.camera.top=height/2;ctx.camera.bottom=-height/2;ctx.camera.updateProjectionMatrix();}
 return {buildRenderer,buildWorld,buildHero,resize};
}
