import test from 'node:test';
import assert from 'node:assert/strict';
import {MAPS,PORTALS,CHECKPOINTS,mapFor,sameMap,isMapSanctuary,availablePortal,createRegionProgress} from '../dist/regions.js';
import {pointBlocked,findPath} from '../dist/combat.js';
import {createWorldLayout} from '../dist/world-layout.js';
const allProgress={victory:true,regionProgress:Object.fromEntries(['drowned-wood','blackvein-quarry','crownfall-keep'].map(id=>[id,{bossDefeated:true}]))};
const solids=(id,progress=allProgress)=>(id==='overworld'?createWorldLayout().obstacles:mapFor(id).obstacles).map(o=>({...o,disabled:o.requires?availablePortal(o,progress):o.disabled}));
test('regional landmarks and spawn points are traversable with collision clearance',()=>{
 for(const map of Object.values(MAPS)){
  const obstacles=solids(map.id),points=[map.start,...map.objectives,...map.objectives.flatMap(o=>o.waves?.flat()||[]),...map.encounters,...map.caches,...PORTALS.filter(p=>p.mapId===map.id),...(map.boss?[map.boss]:[])];
  for(const p of points){assert.equal(pointBlocked(p,obstacles,.42),false,`${map.id}: ${p.id||'start'} is blocked`);assert.ok(p.x>=map.bounds.minX&&p.x<=map.bounds.maxX&&p.z>=map.bounds.minZ&&p.z<=map.bounds.maxZ);if(map.id!=='overworld')assert.ok(findPath(map.start,p,obstacles,map.bounds).length,`${map.id}: no route to ${p.id}`);}
 }
});
test('caves provide paired exits and cannot bypass regional milestones',()=>{
 const progress={victory:false,regionProgress:createRegionProgress()};
 assert.equal(PORTALS.filter(p=>p.hidden).length,4);
 for(const portal of PORTALS){assert.ok(PORTALS.some(p=>p.mapId===portal.toMapId&&p.toMapId===portal.mapId&&p.x===portal.toX&&p.z===portal.toZ));assert.equal(availablePortal(portal,allProgress),true);}
 assert.equal(availablePortal(PORTALS.find(p=>p.id==='wood-road'),progress),false);progress.victory=true;
 assert.equal(availablePortal(PORTALS.find(p=>p.id==='wood-road'),progress),true);
 assert.equal(availablePortal(PORTALS.find(p=>p.id==='quarry-cave'),progress),false);
 const map=MAPS.underways;
 assert.equal(findPath({x:-20,z:0},{x:0,z:0},solids('underways',progress),map.bounds).length,0);
 progress.regionProgress['drowned-wood'].bossDefeated=true;
 assert.ok(findPath({x:-20,z:0},{x:0,z:0},solids('underways',progress),map.bounds).length);
 assert.equal(findPath({x:0,z:0},{x:20,z:0},solids('underways',progress),map.bounds).length,0);
});
test('checkpoints and encounter objectives use coherent shared map identities',()=>{
 assert.equal(sameMap({}, {mapId:'overworld'}),true);assert.equal(sameMap({mapId:'underways'},{}),false);
 for(const c of CHECKPOINTS)assert.ok(isMapSanctuary(c));
 for(const map of Object.values(MAPS))for(const o of map.objectives)assert.ok(map.encounters.filter(e=>e.objectiveId===o.id).length>=3);
 for(const map of Object.values(MAPS))for(const o of map.objectives)for(const spawn of o.waves.flat())assert.ok(Math.hypot(spawn.x-o.x,spawn.z-o.z)>=4.4,`${o.id}: guard spawns inside interaction footprint`);
 for(const c of MAPS.underways.caches)assert.ok(MAPS.underways.encounters.some(e=>e.elite&&e.id===c.enemyId));
 assert.equal(isMapSanctuary({mapId:'underways',x:-26,z:11}),false);
});
