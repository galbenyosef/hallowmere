import test from 'node:test';
import assert from 'node:assert/strict';
import {MAPS} from '../dist/regions.js';
import {World} from '../dist/world.js';
import {ExplorationAtlas,bindExplorationSaving} from '../dist/exploration-map.js';

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

const surface={id:'surface',bounds:{minX:0,maxX:40,minZ:0,maxZ:40},obstacles:[]};
const solo={mode:'single-player'},key='hallowmere-exploration-v2:solo';
function browserStorage(t){
 // Canvas painting is incidental; check the actual discovery cells and save data.
 const saved=new Map(),originals=new Map(['document','localStorage','sessionStorage'].map(key=>[key,Object.getOwnPropertyDescriptor(globalThis,key)]));
 Object.defineProperty(globalThis,'document',{configurable:true,value:{createElement:()=>({getContext:()=>({fillRect(){}})})}});
 Object.defineProperty(globalThis,'localStorage',{configurable:true,value:{getItem:key=>saved.get(key)??null,setItem:(key,value)=>saved.set(key,value)}});
 Object.defineProperty(globalThis,'sessionStorage',{configurable:true,value:{getItem:()=>null}});
 t.mock.timers.enable({apis:['setTimeout']});
 t.after(()=>{t.mock.timers.reset();for(const [key,descriptor]of originals)descriptor?Object.defineProperty(globalThis,key,descriptor):delete globalThis[key];});
 return saved;
}

test('exploration respects walls, survives travel and reconnect, and is personal to a world',t=>{
 browserStorage(t);
 const wall={x:20,z:20,w:1,d:40},map={...surface,obstacles:[wall]},cave={...map,id:'cave'},atlas=new ExplorationAtlas();
 atlas.setSession('world-one','player-one');atlas.reveal(map,{x:15,z:15},[wall]);
 assert.equal(atlas.seen(map,{x:15,z:15}),true);assert.equal(atlas.seen(map,{x:23,z:15}),false);
 atlas.reveal(cave,{x:5,z:5},[wall]);assert.equal(atlas.seen(map,{x:15,z:15}),true);
 atlas.reveal(map,{x:25,z:15},[wall]);assert.equal(atlas.seen(map,{x:23,z:15}),true);
 atlas.save();const restored=new ExplorationAtlas();restored.setSession('world-one','player-one');assert.equal(restored.seen(map,{x:15,z:15}),true);assert.equal(restored.seen(cave,{x:5,z:5}),true);
 restored.setSession('world-one','player-two');assert.equal(restored.seen(map,{x:15,z:15}),false);
 atlas.setSession('world-two','player-one');assert.equal(atlas.seen(map,{x:15,z:15}),false);
});

test('solo autosaves the last footsteps and restores them with fresh world/player identities',t=>{
 const saved=browserStorage(t),atlas=new ExplorationAtlas();atlas.setSession('first-world','first-player',solo);
 atlas.reveal(surface,{x:5,z:5},[]);t.mock.timers.tick(750);
 atlas.reveal(surface,{x:31,z:31},[]);t.mock.timers.tick(749);
 assert.equal(atlas.dirty,true);t.mock.timers.tick(1);assert.equal(atlas.dirty,false);assert.ok(saved.has(key));
 const returned=new ExplorationAtlas();returned.setSession('new-world','new-player',solo);
 assert.equal(returned.seen(surface,{x:5,z:5}),true);assert.equal(returned.seen(surface,{x:31,z:31}),true);
 assert.equal(returned.seen(surface,{x:5,z:35}),false);assert.match(returned.saveLabel,/saved on this device/);
});

test('leaving or hiding the page flushes pending discoveries',t=>{
 browserStorage(t);
 const atlas=new ExplorationAtlas(),windowTarget=new EventTarget(),documentTarget=new EventTarget();atlas.setSession('world','player',solo);
 const unbind=bindExplorationSaving(atlas,{windowTarget,documentTarget});
 atlas.reveal(surface,{x:5,z:5},[]);documentTarget.hidden=true;documentTarget.dispatchEvent(new Event('visibilitychange'));assert.equal(atlas.dirty,false);
 atlas.reveal(surface,{x:31,z:31},[]);windowTarget.dispatchEvent(new Event('pagehide'));assert.equal(atlas.dirty,false);
 const returned=new ExplorationAtlas();returned.setSession('next-world','next-player',solo);assert.equal(returned.seen(surface,{x:31,z:31}),true);
 unbind();
});

test('preview tours leave saved charts untouched and an explicit reset clears only solo',t=>{
 const saved=browserStorage(t),atlas=new ExplorationAtlas();atlas.setSession('world','player',solo);atlas.reveal(surface,{x:5,z:5},[]);atlas.save();
 const before=saved.get(key),preview=new ExplorationAtlas();preview.setSession('preview','preview-player',{...solo,preview:true});
 assert.equal(preview.seen(surface,{x:5,z:5}),false);preview.reveal(surface,{x:31,z:31},[]);preview.save();assert.equal(saved.get(key),before);
 const online=new ExplorationAtlas();online.setSession('shared-world','ally');online.reveal(surface,{x:21,z:21},[]);online.save();
 atlas.reset();atlas.setSession('another-world','another-player',solo);assert.equal(atlas.seen(surface,{x:5,z:5}),false);
 const returned=new ExplorationAtlas();returned.setSession('shared-world','ally');assert.equal(returned.seen(surface,{x:21,z:21}),true);
});

test('saves merge discoveries across tabs, including maps not loaded in the stale tab',t=>{
 browserStorage(t);const a=new ExplorationAtlas(),b=new ExplorationAtlas(),cave={...surface,id:'cave'};
 a.setSession('world-a','a',solo);a.reveal(cave,{x:5,z:5},[]);a.save();b.setSession('world-b','b',solo);
 a.reveal(cave,{x:31,z:31},[]);a.reveal(surface,{x:5,z:5},[]);a.save();
 b.reveal(surface,{x:31,z:31},[]);b.save();
 const returned=new ExplorationAtlas();returned.setSession('world-c','c',solo);
 for(const map of [surface,cave])for(const p of [{x:5,z:5},{x:31,z:31}])assert.equal(returned.seen(map,p),true);
});

test('invalid saves, changed grids, and unavailable storage do not reveal wrong terrain or stop play',t=>{
 const saved=browserStorage(t);saved.set(key,'broken JSON');const atlas=new ExplorationAtlas();assert.doesNotThrow(()=>atlas.setSession('world','player',solo));
 atlas.reveal(surface,{x:5,z:5},[]);atlas.save();const returned=new ExplorationAtlas();returned.setSession('world-two','player-two',solo);
 const resized={...surface,bounds:{...surface.bounds,minX:-40}};assert.equal(returned.seen(resized,{x:5,z:5}),false);
 const record=JSON.parse(saved.get(key));record.maps.surface.cells=[-1,999999,1.5,'1',null,0];saved.set(key,JSON.stringify(record));
 const filtered=new ExplorationAtlas();filtered.setSession('world-three','player-three',solo);assert.deepEqual([...filtered.map(surface).cells],[0]);
 Object.defineProperty(globalThis,'localStorage',{configurable:true,get(){throw Error('Storage disabled');}});
 const blocked=new ExplorationAtlas();assert.doesNotThrow(()=>blocked.setSession('world','player',solo));blocked.reveal(surface,{x:5,z:5},[]);
 assert.equal(blocked.save(),false);assert.equal(blocked.seen(surface,{x:5,z:5}),true);assert.match(blocked.saveLabel,/storage unavailable/);
});
