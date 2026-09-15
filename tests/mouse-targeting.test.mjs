import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import * as T from '../dist/vendor/three.core.js';
import {abilitiesFor,classFor} from '../dist/classes.js';
import {distance} from '../dist/combat.js';
import {sliceBetween,readDist} from './helpers/source.mjs';
import {installGlobals} from './helpers/dom.mjs';
import {bindInput} from '../dist/input-bindings.js';

const main=readDist('main.js');

// attacksFromHere left main.js in M5 (dist/input-bindings.js). bindInput registers the whole
// input region, so it needs one stub element per id plus injectable window/document targets;
// the function itself is then read off ctx and handed to the updatePlayer slice as the same
// free identifier main.js still spells bare.
function inputTargets(t){
 const nodes=new Map();
 const node=id=>{if(!nodes.has(id))nodes.set(id,{id,dataset:{},style:{},innerHTML:'',
  classList:{add(){},remove(){},toggle(){}},setAttribute(){},removeAttribute(){},focus(){},
  querySelectorAll:()=>[],getBoundingClientRect:()=>({left:0,top:0,width:68,height:68}),
  hasPointerCapture:()=>false,setPointerCapture(){},releasePointerCapture(){},addEventListener(){}});return nodes.get(id);};
 installGlobals(t,{document:{getElementById:node},
  HTMLInputElement:class{},HTMLTextAreaElement:class{},HTMLSelectElement:class{},HTMLButtonElement:class{}});
 return {windowTarget:{addEventListener(){}},
  documentTarget:{hidden:false,activeElement:null,addEventListener(){},querySelectorAll:()=>[],querySelector:()=>node('map-panel')}};
}

function attackFrame(targets,{classId,range,clear,shift=false}){
 const player=new T.Group(),enemy=new T.Group(),attacks=[];
 enemy.position.set(0,0,range);
 const ctx={state:{classId,ended:false},player,
  lockedEnemy:{model:enemy,dead:false},attackHeld:true,aimActive:true,
  keys:new Set(),joystickValue:{x:0,y:0},dodgeTime:0,angle:0,moveTarget:null,movePath:[],lastMove:new T.Vector3(),
  network:{id:'local'},lastSnapshot:null,environment:{obstacles:[]},worldBounds:()=>({}),pointerShift:shift,
  heroRig:{},selection:{position:new T.Vector3(),material:{}},playerLight:{position:new T.Vector3()},
  ready:true,paused:false,backgrounded:false,mapExpanded:false,rosterPicker:{open:false},
  joystickPointer:null,syncAudioState(){},audio:{play(){}},exploration:{save(){}}};
 Object.assign(ctx,bindInput(ctx,targets));
 const context={T,ctx,abilitiesFor,classFor,distance,attacksFromHere:ctx.attacksFromHere,
  hasLineOfSight:()=>clear,findPath:()=>[{x:0,z:range}],
  moveEntity(){assert.fail('A stationary attack must not request walking');},
  perform:action=>attacks.push(action),animateRig(){},animateHeroAttack(){}};
 vm.createContext(context);
 vm.runInContext(sliceBetween(main,'function updatePlayer(','function updateEffects(',{file:'dist/main.js'}),context);
 context.updatePlayer(.016,1);context.updatePlayer(.016,1.016);
 assert.deepEqual(attacks,['attack','attack']);
 assert.equal(player.position.length(),0);
 assert.equal(ctx.network.input.x,0);assert.equal(ctx.network.input.z,0);
}

test('held ranged attacks fire in place at near, distant, and obstructed enemies for every ranged class',t=>{
 const targets=inputTargets(t);
 for(const classId of ['sorcerer','ranger','oathkeeper','alchemist']){
  for(const range of [3,30])for(const clear of [true,false])attackFrame(targets,{classId,range,clear});
 }
});

test('Shift keeps a locked melee attack stationary beyond reach and behind an obstacle',t=>{
 attackFrame(inputTargets(t),{classId:'geralt',range:20,clear:false,shift:true});
});
