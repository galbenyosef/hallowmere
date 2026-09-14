import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import * as T from '../dist/vendor/three.core.js';
import {abilitiesFor,classFor} from '../dist/classes.js';
import {distance} from '../dist/combat.js';

const main=readFileSync(new URL('../dist/main.js',import.meta.url),'utf8');
function attackFrame({classId,range,clear,shift=false}){
 const player=new T.Group(),enemy=new T.Group(),attacks=[];
 enemy.position.set(0,0,range);
 const context={T,abilitiesFor,classFor,distance,state:{classId,ended:false},player,
  lockedEnemy:{model:enemy,dead:false},attackHeld:true,pointerShift:shift,aimActive:true,
  keys:new Set(),joystickValue:{x:0,y:0},dodgeTime:0,angle:0,moveTarget:null,movePath:[],lastMove:new T.Vector3(),
  network:{id:'local'},lastSnapshot:null,environment:{obstacles:[]},
  hasLineOfSight:()=>clear,findPath:()=>[{x:0,z:range}],worldBounds:()=>({}),
  moveEntity(){assert.fail('A stationary attack must not request walking');},
  perform:action=>attacks.push(action),animateRig(){},animateHeroAttack(){},heroRig:{},
  selection:{position:new T.Vector3(),material:{}},playerLight:{position:new T.Vector3()}};
 vm.createContext(context);
 vm.runInContext(main.slice(main.indexOf('function attacksFromHere('),main.indexOf('function stopAttackMovement(')),context);
 vm.runInContext(main.slice(main.indexOf('function updatePlayer('),main.indexOf('function updateEffects(')),context);
 context.updatePlayer(.016,1);context.updatePlayer(.016,1.016);
 assert.deepEqual(attacks,['attack','attack']);
 assert.equal(player.position.length(),0);
 assert.equal(context.network.input.x,0);assert.equal(context.network.input.z,0);
}

test('held ranged attacks fire in place at near, distant, and obstructed enemies for every ranged class',()=>{
 for(const classId of ['sorcerer','ranger','oathkeeper','alchemist']){
  for(const range of [3,30])for(const clear of [true,false])attackFrame({classId,range,clear});
 }
});

test('Shift keeps a locked melee attack stationary beyond reach and behind an obstacle',()=>{
 attackFrame({classId:'geralt',range:20,clear:false,shift:true});
});
