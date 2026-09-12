import test from 'node:test';
import assert from 'node:assert/strict';
import {BUILDING_SPECS,createBuildingLayout,buildingWorld,buildingLocal,insideBuilding,setBuildingAccess} from '../dist/buildings.js';
import {resolveMove,findPath,pointBlocked,hasLineOfSight,distance,createState,awardKill} from '../dist/combat.js';
import {WORLD_BOUNDS} from '../dist/campaign.js';
const layouts=()=>BUILDING_SPECS.map(createBuildingLayout);
function follow(start,path,obstacles){let p={...start};for(const goal of path){let steps=0;while(distance(p,goal)>.03&&steps++<160){const d=distance(p,goal),step=Math.min(.14,d);p=resolveMove(p,(goal.x-p.x)/d*step,(goal.z-p.z)/d*step,obstacles,.42,WORLD_BOUNDS);assert.equal(pointBlocked(p,obstacles),false);}assert.ok(distance(p,goal)<.04,`Path stalled ${distance(p,goal)} from ${JSON.stringify(goal)}`);}return p;}

test('every building can be entered and exited through its visible front doorway',()=>{
 const buildings=layouts();setBuildingAccess(buildings,true);const obstacles=buildings.flatMap(b=>b.obstacles);
 for(const b of buildings){assert.equal(pointBlocked(b.entry,obstacles),false,b.name);assert.equal(pointBlocked(b.exit,obstacles),false,b.name);const path=findPath(b.exit,b.entry,obstacles,WORLD_BOUNDS);assert.ok(path.length,`No entrance route for ${b.name}`);const end=follow(b.exit,path,obstacles);assert.equal(insideBuilding(b,end),true,b.name);const back=findPath(end,b.exit,obstacles,WORLD_BOUNDS);assert.ok(back.length,`No exit for ${b.name}`);assert.equal(insideBuilding(b,follow(end,back,obstacles)),false,b.name);}
});

test('side and rear walls stop walking and long evade steps on every rotated house',()=>{
 for(const b of layouts())for(const [sx,sz,dx,dz]of [[b.w/2+1,0,-3,0],[-b.w/2-1,0,3,0],[0,-b.d/2-1,0,3]]){
  const start=buildingWorld(b,sx,sz),goal=buildingWorld(b,sx+dx,sz+dz),end=resolveMove(start,goal.x-start.x,goal.z-start.z,b.obstacles,.42,WORLD_BOUNDS);
  assert.equal(insideBuilding(b,end),false,`${b.name}: ${sx},${sz}`);assert.equal(pointBlocked(end,b.obstacles),false);
 }
});

test('click paths from behind a building go around it and through its door',()=>{
 for(const b of layouts()){if(b.chapel)continue;const start=buildingWorld(b,0,-b.d/2-1.2),path=findPath(start,b.entry,b.obstacles,WORLD_BOUNDS);assert.ok(path.length,`No route around ${b.name}`);assert.ok(path.some(p=>buildingLocal(b,p).z>b.d/2+.4));assert.equal(insideBuilding(b,follow(start,path,b.obstacles)),true);}
});

test('the chapel stays sealed until the Bellkeeper is defeated and both directions then open',()=>{
 const buildings=layouts(),chapel=buildings.find(b=>b.chapel),state=createState();setBuildingAccess(buildings,state.victory);
 assert.equal(chapel.doorCollider.disabled,false);assert.deepEqual(findPath(chapel.exit,chapel.entry,chapel.obstacles,WORLD_BOUNDS),[]);
 const blocked=resolveMove(chapel.exit,chapel.entry.x-chapel.exit.x,chapel.entry.z-chapel.exit.z,chapel.obstacles,.42,WORLD_BOUNDS);assert.equal(insideBuilding(chapel,blocked),false);
 awardKill(state,'boss');setBuildingAccess(buildings,state.victory);assert.equal(chapel.doorCollider.disabled,true);
 const path=findPath(chapel.exit,chapel.entry,chapel.obstacles,WORLD_BOUNDS);assert.equal(insideBuilding(chapel,follow(chapel.exit,path,chapel.obstacles)),true);
});

test('projectiles and loot share the rotated wall boundaries and door openings',()=>{
 for(const b of layouts()){
  const wall=b.walls[0],outside=buildingWorld(b,wall.x-.8,0),inside=buildingWorld(b,wall.x+.8,0);
  assert.equal(hasLineOfSight(outside,inside,b.obstacles),false,b.name);
  assert.equal(pointBlocked(buildingWorld(b,wall.x,0),b.obstacles,.1),true,b.name);
  b.doorCollider.disabled=true;assert.equal(hasLineOfSight(b.exit,b.entry,b.obstacles),true,b.name);
 }
});

test('thin rotated walls cannot be skipped by a large movement update',()=>{
 const wall={x:0,z:0,w:.15,d:8,rotation:.35},start=buildingWorld(wall,-3,0),goal=buildingWorld(wall,3,0);
 const end=resolveMove(start,goal.x-start.x,goal.z-start.z,[wall],.42);assert.ok(buildingLocal(wall,end).x<-.49);assert.equal(pointBlocked(end,[wall]),false);
});
