// One flat, pre-declared context object for everything main.js used to hold in module
// scope. Every field is written in the single literal below and never added later, so
// the shape stays monomorphic and each later extraction step is a literal cut-and-paste:
// a module that needs `renderedMap` reads `ctx.renderedMap` from the same object main.js
// writes. Data fields carry the initial values main.js used to declare inline; slots that
// a wiring step must fill are null and listed in WIRED_SLOTS.
import * as T from './vendor/three.core.js';
import {mapFor} from './regions.js';
import {isSanctuary} from './campaign.js';
import {distance,ENEMY_TYPES} from './combat.js';
import {MovementCorrection} from './multiplayer-motion.js';

export function createGameContext({audio,gameSettings,exploration,resourceOrbs,journeyStore,previewMode,reducedMotion,coarse}){
 const ctx={
  audio,gameSettings,exploration,resourceOrbs,journeyStore,previewMode,reducedMotion,coarse,
  state:null,scene:null,camera:null,renderer:null,environment:null,player:null,heroRig:null,clock:null,ready:false,started:false,paused:false,backgrounded:document.hidden,mapExpanded:false,modalKind:'',angle:0,moveTarget:null,movePath:[],lockedEnemy:null,attackHeld:false,aimActive:false,shake:0,dodgeTime:0,lastMove:new T.Vector3(0,0,-1),targetWorld:new T.Vector3(0,0,-5),accumulated:0,lastStep:0,uiTimer:0,audioTimer:0,audioInterior:null,toastTimer:undefined,
  pointer:new T.Vector2(0,0),raycaster:new T.Raycaster(),plane:new T.Plane(new T.Vector3(0,1,0),0),keys:new Set(),enemies:[],effects:[],floaters:[],prefabs:{},cameraOffset:new T.Vector3(17,25,26),cameraTarget:new T.Vector3(0,0,1.6),
  mouseTargeting:undefined,mouseInWorld:false,pointerIsMouse:false,pointerShift:false,mouseAction:null,
  sessionMode:null,assetsReady:false,sessionGeneration:0,mainMenuOpen:false,cavePreviewStarted:false,
  creatingJourney:false,activeJourney:null,autosave:null,journeyLeaving:false,journeyConflict:false,saveStatus:{kind:'saved',message:'All progress saved'},saveIndicatorTimer:undefined,
  titleScreen:null,journeysMenu:null,
  worldPreview:undefined,rosterPicker:undefined,multiplayerView:undefined,network:undefined,networkDirection:{x:0,z:0},lastSnapshot:null,lastNetworkEvent:0,networkProjectiles:new Map(),networkZones:new Map(),life:undefined,combatEffects:undefined,classEffects:undefined,moonLight:undefined,hemisphereLight:undefined,rimLight:undefined,currentNpc:null,inventoryPreviews:null,victoryShown:false,victoryTimer:undefined,playerLight:undefined,spellLight:undefined,selection:undefined,joystickValue:{x:0,y:0},joystickPointer:null,previousFocus:null,
  renderedMap:'overworld',overworldEnvironment:undefined,overworldObjects:[],landmarks:undefined,pendingRegionInteraction:null,regionLabels:new Map(),networkHazards:new Map(),
  movementCorrection:new MovementCorrection(),resetMovement:true,dodgeAngle:0,
  hudClass:null,portraitsRequested:false,
  worldBounds:null,safeHere:null,bossType:null,enemyModelType:null
 };
 ctx.worldBounds=()=>mapFor(ctx.renderedMap).bounds;
 ctx.safeHere=()=>ctx.renderedMap==='overworld'?isSanctuary(ctx.player.position):(ctx.lastSnapshot?.interactions?.checkpoints||[]).some(c=>distance(c,ctx.player.position)<(c.radius||5));
 ctx.bossType=type=>type==='boss'||!!ENEMY_TYPES[type]?.boss;
 ctx.enemyModelType=type=>ENEMY_TYPES[type]?.modelType||type;
 return ctx;
}

// Slots a wiring step must fill before the game runs. Every extraction step that assigns
// functions onto ctx adds its own names here; data fields that legitimately stay null
// (activeJourney, lockedEnemy, ...) are deliberately not listed.
export const WIRED_SLOTS=['worldBounds','safeHere','bossType','enemyModelType','cloneModel','groundPing','ringEffect','slash','steelImpact','particles','telegraph','removeObject','cancelAttack','floatText','spawnEnemy','updateEnemyBar','getPointerWorld','updatePointer','enemyAtPoint','pointerAction','updateMouseTarget','setDestination','nearestEnemy','enterBuilding','nearbyInteraction','interact','collectClickedLoot','regionInteractions','canReachRegion','interactRegion','switchMap','renderRegionLabels','renderHazards','toast','updateClassHud','updateUI','awaken','syncAudioState','audioAt','updateAudioWorld','resumeFromMainMenu','perform','openRoster','drawMap','showModal','closeModal','releaseInput','attacksFromHere','stopAttackMovement','releaseMouseAttack','toggleMap','navigateMenu','footstepCue','moveEntity','animateRig','updatePlayer','updateEffects','updateFloaters','renderInventory','equipOwnedItem','consumePouchItem','lootCollected','inventoryPreviews','talkTo','renderNpc','serviceNpc','restart','toggleMapForDeath','saveAndExit','updateSaveStatus'];
export function assertWired(ctx){
 const missing=WIRED_SLOTS.filter(slot=>ctx[slot]===null||ctx[slot]===undefined);
 if(missing.length)throw Error(`Game context is not wired: ${missing.join(', ')}`);
 return ctx;
}
