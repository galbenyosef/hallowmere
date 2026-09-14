import test from 'node:test';
import assert from 'node:assert/strict';
import {MAPS} from '../dist/regions.js';
import {World} from '../dist/world.js';
import {ExplorationAtlas} from '../dist/exploration-map.js';

test('all maps have six times their original area',()=>{
 const original={overworld:107*54,'drowned-wood':3600,'blackvein-quarry':3600,'crownfall-keep':3600,underways:60*36,'moss-hollow':64*72,'cellar-depths':80*88,'gloom-cavern':104*112,'old-road-cellar':32*36,'gravekeepers-hollow':36*40};
 for(const [id,area]of Object.entries(original)){const b=MAPS[id].bounds;assert.equal((b.maxX-b.minX)*(b.maxZ-b.minZ),area*6,id);}
});

test('outland combat and treasure do not open the chapel',()=>{
 const world=new World({seed:71}),player=world.join().player;
 const cache=MAPS.overworld.caches[0];Object.assign(player,{x:cache.x,z:cache.z});
 const claim=()=>world.command(player.id,{type:'cache',id:cache.id,seq:player.lastSeq+1,worldId:world.id});
 assert.equal(claim(),false);
 for(const enemy of world.enemies.filter(e=>e.mapId==='overworld'&&e.optional))world.damageEnemy(enemy,10000);
 assert.equal(world.shared.villageKills,0);assert.equal(world.shared.bossSpawned,false);assert.equal(world.shared.victory,false);
 assert.equal(claim(),true);assert.equal(claim(),false);
 assert.equal(world.buildings.find(b=>b.chapel).doorCollider.disabled,false);
});

test('exploration respects walls, survives travel and reconnect, and is personal to a world',t=>{
 // Canvas drawing is incidental here; this checks exploration memory and visibility.
 const saved=new Map(),originals=new Map(['document','sessionStorage'].map(key=>[key,Object.getOwnPropertyDescriptor(globalThis,key)]));
 Object.defineProperty(globalThis,'document',{configurable:true,value:{createElement:()=>({getContext:()=>({fillRect(){}})})}});
 Object.defineProperty(globalThis,'sessionStorage',{configurable:true,value:{getItem:key=>saved.get(key),setItem:(key,value)=>saved.set(key,value)}});
 t.after(()=>{for(const [key,descriptor]of originals)descriptor?Object.defineProperty(globalThis,key,descriptor):delete globalThis[key];});
 const wall={x:20,z:20,w:1,d:40},map={id:'surface',bounds:{minX:0,maxX:40,minZ:0,maxZ:40},obstacles:[wall]},cave={...map,id:'cave'},atlas=new ExplorationAtlas();
 atlas.setSession('world-one','player-one');atlas.reveal(map,{x:15,z:15},[wall]);
 assert.equal(atlas.seen(map,{x:15,z:15}),true);assert.equal(atlas.seen(map,{x:23,z:15}),false);
 atlas.reveal(cave,{x:5,z:5},[wall]);assert.equal(atlas.seen(map,{x:15,z:15}),true);
 atlas.reveal(map,{x:25,z:15},[wall]);assert.equal(atlas.seen(map,{x:23,z:15}),true);
 atlas.save();const restored=new ExplorationAtlas();restored.setSession('world-one','player-one');assert.equal(restored.seen(map,{x:15,z:15}),true);
 restored.setSession('world-one','player-two');assert.equal(restored.seen(map,{x:15,z:15}),false);
 atlas.setSession('world-two','player-one');assert.equal(atlas.seen(map,{x:15,z:15}),false);
});
