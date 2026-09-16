import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from '../dist/vendor/three.core.js';
import {installGlobals} from './helpers/dom.mjs';
import {bindInput} from '../dist/input-bindings.js';
import {createPlayerMotion} from '../dist/player-motion.js';

// attacksFromHere left main.js in M5 (dist/input-bindings.js). bindInput registers the whole
// input region, so it needs one stub element per id plus injectable window/document targets;
// ctx.attacksFromHere is then read the same way updatePlayer itself reads it (M6 moved
// updatePlayer into dist/player-motion.js, so it is now called through createPlayerMotion
// instead of sliced out of main.js as text).
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
  heroRig:{legs:[],arms:[]},selection:{position:new T.Vector3(),material:{}},playerLight:{position:new T.Vector3()},
  ready:true,paused:false,backgrounded:false,mapExpanded:false,rosterPicker:{open:false},footstepCue:()=>'step',
  joystickPointer:null,syncAudioState(){},audio:{play(){}},exploration:{save(){}}};
 Object.assign(ctx,bindInput(ctx,targets));
 ctx.perform=action=>attacks.push(action);
 Object.assign(ctx,createPlayerMotion(ctx,{hasLineOfSight:()=>clear,findPath:()=>[{x:0,z:range}],animateHeroAttack(){}}));
 ctx.updatePlayer(.016,1);ctx.updatePlayer(.016,1.016);
 assert.deepEqual(attacks,['attack','attack']);
 assert.equal(player.position.length(),0);
 // moveEntity is now internal to createPlayerMotion (no longer a free identifier the vm
 // context could replace with an assert.fail guard). ctx.lastMove is only ever touched by
 // the movement branch that calls moveEntity, so it staying at its initial (0,0,0) is the
 // observable proof that a stationary attack never reached that branch.
 assert.equal(ctx.lastMove.length(),0);
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
