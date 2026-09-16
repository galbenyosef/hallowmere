// M10 moved renderSharedWorld out of dist/main.js into dist/shared-world-render.js verbatim.
// It is the per-frame sync of everything the server owns -- class-effect actors, enemy models
// and bars, projectile visuals, zone visuals -- so the tests drive whole frames and check that
// visuals are created, updated and removed by id, and that nothing is recreated on a second
// frame. createEnemyOrb arrives through the factory's deps hatch because the hostile-bolt
// branch would otherwise build a real three subtree.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from '../dist/vendor/three.core.js';
import {createSharedWorldRender} from '../dist/shared-world-render.js';

const vec=(x=0,y=0,z=0)=>({x,y,z,
 set(a,b,c){this.x=a;this.y=b;this.z=c;return this;},
 copy(v){this.x=v.x;this.y=v.y;this.z=v.z;return this;},
 add(v){this.x+=v.x;this.y+=v.y;this.z+=v.z;return this;}});

// A live enemy as applySnapshot leaves one: a net payload from the server plus the client-side
// model, bar and visuals dist/enemy-spawner.js builds.
function makeEnemy(overrides={}){
 const e={id:'e1',type:'hollow',seed:.25,hp:10,maxHp:10,barHealth:10,dead:false,rig:{},data:{windup:.8},
  net:{x:4,z:6,angle:1,moving:true,phase:'idle',timer:0},
  model:{position:vec(0,0,0),rotation:vec(0,0,0),visible:true},
  bar:{position:vec(),visible:false},
  visuals:{updates:[],update(...args){this.updates.push(args);}}};
 return Object.assign(e,overrides);
}

function makeCtx(overrides={}){
 const calls=[],rec=name=>(...args)=>{calls.push([name,...args]);};
 const ctx={
  calls,renderedMap:'overworld',reducedMotion:false,
  network:{id:'local'},player:{position:vec(0,0,0)},
  multiplayerView:{actors:new Map([['remote',{model:{name:'remote'}}]])},
  renderHazards:rec('renderHazards'),
  classEffects:{
   syncActors:rec('syncActors'),
   projectile:data=>({mesh:{position:vec(data.x,1.1,data.z)},kind:'class',update:rec('classBolt.update')}),
   zone:data=>({id:data.id,updates:[],disposed:0,update(...args){this.updates.push(args);},dispose(){this.disposed++;}})
  },
  combatEffects:{
   emberbolt:pos=>({mesh:{position:vec(pos.x,pos.y,pos.z)},kind:'ember',update:rec('emberbolt.update')}),
   arcaneBolt:pos=>({mesh:{position:vec(pos.x,pos.y,pos.z)},kind:'arcane',update:rec('arcaneBolt.update')})
  },
  scene:{name:'scene'},overworldEnvironment:{glowTexture:{name:'glow'}},
  enemies:[],networkProjectiles:new Map(),networkZones:new Map(),
  removeObject:rec('removeObject'),updateEnemyBar:rec('updateEnemyBar'),animateRig:rec('animateRig'),
  enemyModelType:type=>type,mouseTargeting:{selected:null},
  selection:{position:vec()},playerLight:{position:vec()},
  lastSnapshot:null
 };
 return Object.assign(ctx,overrides);
}
const named=(ctx,name)=>ctx.calls.filter(call=>call[0]===name);
// The orb factory the hostile branch reaches for, stubbed so the test can drive a plain scene.
function orbStub(){
 const made=[];
 return [made,(scene,texture,position,angle,color,options)=>{
  made.push({scene,texture,position:{x:position.x,y:position.y,z:position.z},angle,color,options});
  return {mesh:{position:vec(position.x,position.y,position.z)},kind:'orb',update(){}};
 }];
}
const wire=(overrides={},createEnemyOrb)=>{
 const ctx=makeCtx(overrides);
 return [ctx,createSharedWorldRender(ctx,createEnemyOrb?{createEnemyOrb}:{}).renderSharedWorld];
};

test('every frame hands the class effects the snapshot players and a resolver that finds their models',()=>{
 const players=[{id:'local'},{id:'remote'}];
 const [ctx,renderSharedWorld]=wire({lastSnapshot:{players,projectiles:[],zones:[],time:9}});
 renderSharedWorld(.016,3);
 assert.equal(named(ctx,'renderHazards').length,1);
 const [,seen,resolve,mapId]=named(ctx,'syncActors')[0];
 assert.equal(seen,players);assert.equal(mapId,'overworld');
 assert.equal(resolve('local'),ctx.player);
 assert.equal(resolve('remote'),ctx.multiplayerView.actors.get('remote').model);
 assert.equal(resolve('ghost'),undefined);
 const [empty,renderEmpty]=wire();
 renderEmpty(.016,3);
 assert.deepEqual(named(empty,'syncActors')[0][1],[]);
});

test('a live enemy eases toward its server position, animates, and carries its bar',()=>{
 const enemy=makeEnemy({barHealth:10,hp:6});
 const [ctx,renderSharedWorld]=wire({enemies:[enemy],lastSnapshot:{players:[],projectiles:[],zones:[],time:0}});
 renderSharedWorld(.05,2);
 assert.ok(enemy.model.position.x>0&&enemy.model.position.x<4,'eased toward the server x, not snapped');
 assert.ok(enemy.model.position.z>0&&enemy.model.position.z<6);
 assert.ok(enemy.model.rotation.y>0&&enemy.model.rotation.y<1);
 assert.ok(enemy.barHealth<10&&enemy.barHealth>=6,'the bar drains toward the real hp');
 assert.equal(named(ctx,'updateEnemyBar').length,1);
 const [,rig,t,moving,windup,modelType]=named(ctx,'animateRig')[0];
 assert.equal(rig,enemy.rig);assert.equal(t,2);assert.equal(moving,true);assert.equal(windup,0);assert.equal(modelType,'hollow');
 assert.deepEqual(enemy.visuals.updates[0],[enemy.net,.05,2.25]);
 assert.equal(enemy.bar.position.y,2.25);
 assert.equal(enemy.bar.visible,true);
 enemy.model.position.x=99;enemy.model.position.z=99;enemy.net.x=99;enemy.net.z=99;
 renderSharedWorld(.05,2.05);
 assert.equal(enemy.bar.visible,false,'a distant enemy hides its bar');
});

test('a dead enemy falls, hides its bar, and stops animating',()=>{
 const enemy=makeEnemy({dead:true});
 const [ctx,renderSharedWorld]=wire({enemies:[enemy],lastSnapshot:{players:[],projectiles:[],zones:[],time:0}});
 for(let i=0;i<40;i++)renderSharedWorld(.05,i*.05);
 assert.equal(named(ctx,'animateRig').length,0);
 assert.equal(named(ctx,'updateEnemyBar').length,0);
 assert.equal(enemy.bar.visible,false);
 assert.ok(enemy.model.rotation.z>1.4,'it rotates onto its back');
 assert.equal(enemy.model.position.y,-1,'it sinks no further than -1');
 assert.equal(enemy.model.visible,false);
 assert.equal(enemy.visuals.updates[0][2],0,'a dead enemy gets the raw frame time, not t+seed');
});

test('a telegraphed windup fades its ring with the remaining wind-up time',()=>{
 const telegraph={children:[{material:{opacity:0}}]};
 const enemy=makeEnemy({telegraph,net:{x:0,z:0,angle:0,moving:false,phase:'windup',timer:.4}});
 const [,renderSharedWorld]=wire({enemies:[enemy],lastSnapshot:{players:[],projectiles:[],zones:[],time:0}});
 renderSharedWorld(.016,1);
 assert.equal(Math.round(telegraph.children[0].material.opacity*1000)/1000,.21);
 enemy.net.timer=0;
 renderSharedWorld(.016,1);
 assert.equal(Math.round(telegraph.children[0].material.opacity*1000)/1000,.34);
});

test('projectiles are created once per id, eased every frame, and removed with the snapshot',()=>{
 const [made,createEnemyOrb]=orbStub();
 const projectiles=[
  {id:'p-ember',x:1,z:2,angle:0,speed:12},
  {id:'p-arcane',x:3,z:4,angle:0,speed:14,visual:'arcane'},
  {id:'p-class',x:5,z:6,angle:0,speed:10,visual:'venom'},
  {id:'p-orb',x:7,z:8,angle:1.2,hostile:true,color:'#8edb65'}
 ];
 const stale={mesh:{name:'stale-mesh'}};
 const [ctx,renderSharedWorld]=wire({lastSnapshot:{players:[],projectiles,zones:[],time:0}},createEnemyOrb);
 ctx.networkProjectiles.set('p-gone',stale);
 renderSharedWorld(.05,1);
 assert.deepEqual(named(ctx,'removeObject')[0][1],stale.mesh,'a projectile the snapshot dropped is removed by id');
 assert.equal(ctx.networkProjectiles.has('p-gone'),false);
 assert.deepEqual([...ctx.networkProjectiles.keys()],['p-ember','p-arcane','p-class','p-orb']);
 assert.deepEqual([...ctx.networkProjectiles.values()].map(v=>v.visual.kind),['ember','arcane','class','orb']);
 assert.equal(made.length,1);
 assert.equal(made[0].scene,ctx.scene);assert.equal(made[0].texture,ctx.overworldEnvironment.glowTexture);
 assert.deepEqual(made[0].position,{x:7,y:.8,z:8});
 assert.equal(made[0].angle,1.2);assert.equal(made[0].color,'#8edb65');
 assert.deepEqual(made[0].options,{reducedMotion:false});
 const ember=ctx.networkProjectiles.get('p-ember');
 assert.equal(ember.mesh.position.y,1.1,'a friendly bolt spawns at chest height');
 projectiles[0].x=9;
 const before=ember.mesh.position.x;
 renderSharedWorld(.05,1.05);
 assert.equal(made.length,1,'a second frame reuses every visual');
 assert.ok(ember.mesh.position.x>before&&ember.mesh.position.x<9,'it eases toward the new server x');
 const disposed=[];
 for(const [id,visual] of ctx.networkProjectiles)visual.visual.dispose=()=>disposed.push(id);
 ctx.lastSnapshot.projectiles=[];
 renderSharedWorld(.05,1.1);
 assert.deepEqual(disposed.sort(),['p-arcane','p-class','p-ember','p-orb']);
 assert.equal(ctx.networkProjectiles.size,0);
});

test('zones are created once per id, updated with the snapshot time, and disposed when they end',()=>{
 const zones=[{id:'z1',x:1,z:2},{id:'z2',x:3,z:4}];
 const [ctx,renderSharedWorld]=wire({lastSnapshot:{players:[],projectiles:[],zones,time:7.5}});
 renderSharedWorld(.05,1);
 assert.deepEqual([...ctx.networkZones.keys()],['z1','z2']);
 const first=ctx.networkZones.get('z1');
 assert.deepEqual(first.updates,[[zones[0],7.5,.05]]);
 ctx.lastSnapshot.zones=[zones[0]];ctx.lastSnapshot.time=8;
 renderSharedWorld(.05,1.05);
 assert.equal(ctx.networkZones.get('z1'),first,'the surviving zone keeps its visual');
 assert.deepEqual(first.updates.at(-1),[zones[0],8,.05]);
 assert.equal(ctx.networkZones.has('z2'),false);
 assert.equal(ctx.networkZones.size,1);
});

test('the selection ring and the player light follow the hero every frame',()=>{
 const [ctx,renderSharedWorld]=wire();
 ctx.player.position.set(3,0,-4);
 renderSharedWorld(.016,1);
 assert.deepEqual([ctx.selection.position.x,ctx.selection.position.y,ctx.selection.position.z],[3,.1,-4]);
 assert.deepEqual([ctx.playerLight.position.x,ctx.playerLight.position.y,ctx.playerLight.position.z],[3,2.7,-4]);
});
