// M10 moved applySnapshot out of dist/main.js into dist/snapshot-apply.js verbatim. Its
// statement order is the load-bearing part -- docs/refactor/PLAN.md section 10 lists the four
// places a reordering would be invisible to the rest of the suite -- so these are the five
// scenarios that pin it: the `!me` early return, the first-snapshot key deletion, ctx.switchMap
// before the Object.assign merge, the event watermark, and the restart reset. The fixtures are
// shaped like dist/world.js's snapshot() payload (see tests/snapshot-aliasing.test.mjs for a
// live one) and every ctx slot records its calls.
import test from 'node:test';
import assert from 'node:assert/strict';
import {mapFor} from '../dist/regions.js';
import {ENEMY_TYPES} from '../dist/combat.js';
import {createSnapshotApply} from '../dist/snapshot-apply.js';
import {installGlobals} from './helpers/dom.mjs';

// The five literal $('id') lookups applySnapshot makes, on tests/hud.test.mjs's mock-element
// pattern; $('modal-content').closest('.modal') is the only nested one.
function stubDocument(){
 const byId=new Map();
 const make=id=>({id,style:{},hidden:false,disabled:false,textContent:'',closest:()=>({id:id+'-modal'})});
 return {getElementById(id){if(!byId.has(id))byId.set(id,make(id));return byId.get(id);}};
}
const el=id=>globalThis.document.getElementById(id);

// A snapshot with the shape dist/world.js publishes: one player who is `you`, on the overworld,
// with empty collections the caller fills in per scenario.
const snapshotFixture=(overrides={})=>Object.assign({
 type:'snapshot',worldId:'w1',tick:12,time:1.5,ack:0,mapId:'overworld',
 interactions:{checkpoints:[],portals:[],objectives:[]},brokenCover:[],hazards:[],
 state:{hp:40,maxHp:40,mana:20,maxMana:20,level:1,gold:3,potions:1,cooldowns:{},inventory:[],equipped:{},discoveries:[]},
 you:'p1',
 players:[{id:'p1',mapId:'overworld',slot:0,color:'#8fd3c7',x:2,z:3,angle:0,moving:false,hp:40,maxHp:40,ended:false,dodge:0,speed:5,zone:'ashwick'}],
 enemies:[],projectiles:[],zones:[],loot:[],forage:[],votes:[],voteDeadline:0,events:[]
},overrides);

// A client-side enemy as dist/enemy-spawner.js builds one, reduced to the fields applySnapshot
// reads, clears and disposes.
const makeEnemy=(id,type='hollow')=>({id,type,data:{attackStyle:'knife',range:ENEMY_TYPES[type].range,windup:ENEMY_TYPES[type].windup},
 phase:'idle',hp:10,maxHp:10,barHealth:10,dead:false,timer:0,angle:0,
 model:{visible:true,rotation:{z:0},position:{x:0,y:0,z:0,set(x,y,z){this.x=x;this.y=y;this.z=z;}}},
 bar:{id:id+'-bar'},barTexture:{disposed:0,dispose(){this.disposed++;}},
 visuals:{disposed:0,dispose(){this.disposed++;}}});

function makeCtx({stateSeed={ended:false,level:1},...overrides}={}){
 const calls=[],order=[],disposed=[],rec=name=>(...args)=>{calls.push([name,...args]);};
 // Object.assign and `delete` both go through these traps, so the recorded order is proof of
 // where ctx.switchMap sits relative to the state merge -- runs of writes collapse to one entry.
 const raw={...stateSeed};
 const state=new Proxy(raw,{
  set(target,key,value){if(order.at(-1)!=='state-merge')order.push('state-merge');target[key]=value;return true;},
  deleteProperty(target,key){if(order.at(-1)!=='state-delete')order.push('state-delete');delete target[key];return true;}
 });
 const ctx={
  calls,order,disposed,state,
  lastSnapshot:null,started:false,renderedMap:'overworld',sessionMode:'single-player',previewMode:false,activeJourney:null,
  switchMap(map){order.push('switchMap');calls.push(['switchMap',map]);ctx.renderedMap=map;},
  classEffects:{clear:rec('classEffects.clear')},
  networkZones:new Map(),networkProjectiles:new Map(),
  releaseInput:rec('releaseInput'),
  network:{pending:[],connected:true},
  victoryShown:false,lastNetworkEvent:0,victoryTimer:undefined,
  effects:[],floaters:[],enemies:[],
  removeObject:rec('removeObject'),cancelAttack:rec('cancelAttack'),
  life:{syncLoot:rec('life.syncLoot'),syncForage:rec('life.syncForage')},
  toast:rec('toast'),syncPlayerCharacter:rec('syncPlayerCharacter'),
  exploration:{setSession:rec('exploration.setSession'),reset:rec('exploration.reset'),reveal:rec('exploration.reveal')},
  environment:{obstacles:[],updateProgress:rec('environment.updateProgress'),updateObstacles:rec('environment.updateObstacles'),sync:rec('environment.sync')},
  worldBounds:()=>mapFor(ctx.renderedMap).bounds,
  movementCorrection:{reconcile:rec('movementCorrection.reconcile')},
  player:{position:{x:0,y:1,z:0},rotation:{x:0,y:0,z:0}},
  resetMovement:false,backgrounded:false,
  cameraTarget:{set:rec('cameraTarget.set')},
  dodgeTime:0,angle:0,dodgeAngle:0,
  selection:{material:{color:{set:rec('selection.color.set')}}},
  multiplayerView:{sync:rec('multiplayerView.sync')},
  spawnEnemy(type,x,z,zone,id){calls.push(['spawnEnemy',type,x,z,zone,id]);const e=makeEnemy(id,type);ctx.enemies.push(e);return e;},
  telegraph:rec('telegraph'),
  bossType:type=>type==='boss'||!!ENEMY_TYPES[type]?.boss,
  updateEnemyBar:rec('updateEnemyBar'),
  landmarks:{updateProgress:rec('landmarks.updateProgress'),sync:rec('landmarks.sync')},
  connectionStatus:rec('connectionStatus'),networkEvent:rec('networkEvent'),
  audio:{play:rec('audio.play')},
  dismissMainMenu:rec('dismissMainMenu'),mapExpanded:false,toggleMapForDeath:rec('toggleMapForDeath'),showModal:rec('showModal'),
  inventoryPreviews:{hide:rec('inventoryPreviews.hide')},
  modalKind:'',paused:false,syncAudioState:rec('syncAudioState'),
  mainMenuOpen:false,rosterPicker:null,
  titleScreen:{updateSession:rec('titleScreen.updateSession')},mainMenuSession:()=>({live:true}),
  openRoster:rec('openRoster'),renderNpc:rec('renderNpc'),renderInventory:rec('renderInventory'),updateUI:rec('updateUI')
 };
 return Object.assign(ctx,overrides);
}
// disposeActor arrives through the factory's deps hatch: the fixtures are plain objects with no
// three subtree for the real one to walk.
const wire=(overrides={})=>{
 const ctx=makeCtx(overrides);
 return [ctx,createSnapshotApply(ctx,{disposeActor:model=>ctx.disposed.push(model)}).applySnapshot];
};
const named=(ctx,name)=>ctx.calls.filter(call=>call[0]===name);

test('a snapshot whose players do not include you returns before anything reaches the world',t=>{
 installGlobals(t,{document:stubDocument()});
 const [ctx,applySnapshot]=wire();
 const snapshot=snapshotFixture({you:'ghost',events:[{id:4,type:'boss',typeName:'boss'}]});
 applySnapshot(snapshot,false);
 // Everything above the early return still ran: the state baseline is the point of it.
 assert.equal(ctx.started,true);
 assert.equal(ctx.lastSnapshot,snapshot);
 assert.equal(ctx.state.hp,40);
 assert.equal(ctx.lastNetworkEvent,4);
 assert.equal(named(ctx,'syncPlayerCharacter').length,1);
 // And nothing below it did.
 for(const name of ['exploration.setSession','exploration.reveal','environment.updateProgress','movementCorrection.reconcile',
  'multiplayerView.sync','selection.color.set','cameraTarget.set','updateEnemyBar','connectionStatus',
  'networkEvent','updateUI','openRoster','dismissMainMenu'])
  assert.equal(named(ctx,name).length,0,`${name} ran past the !me early return`);
 assert.deepEqual(named(ctx,'life.syncLoot').map(call=>call[1]),[[]],'only the first-snapshot teardown ran, never the snapshot loot');
 assert.equal(el('restart-vote').hidden,false,'the restart vote row was never touched');
 assert.equal(ctx.resetMovement,false);
});

test('the first snapshot clears the old state, resets class, appearance and baseHp, and takes the event baseline',t=>{
 installGlobals(t,{document:stubDocument()});
 const [ctx,applySnapshot]=wire({stateSeed:{classId:'sorcerer',appearanceId:'C09',baseHp:99,ended:false,level:3,staleClientKey:'x'}});
 const snapshot=snapshotFixture({state:{hp:40,maxHp:40,level:1,bossLootClaimed:true,cooldowns:{}},events:[{id:2},{id:7},{id:5}]});
 applySnapshot(snapshot,false);
 assert.equal('staleClientKey' in ctx.state,false,'a fresh server session drops the old keys entirely');
 assert.equal('classId' in ctx.state,true);
 assert.equal(ctx.state.classId,undefined,'the client cannot show Sorcerer skills the server has not granted');
 assert.equal(ctx.state.appearanceId,undefined);
 assert.equal(ctx.state.baseHp,undefined);
 assert.equal(ctx.state.hp,40);assert.equal(ctx.state.level,1);
 assert.equal(ctx.started,true);
 assert.equal(ctx.lastSnapshot,snapshot);
 assert.equal(ctx.victoryShown,true,'victoryShown follows the merged bossLootClaimed');
 assert.equal(ctx.lastNetworkEvent,7,'the watermark jumps to the newest retained event');
 assert.equal(named(ctx,'networkEvent').length,0,'retained events predate this client');
 assert.equal(named(ctx,'openRoster').length,1,'no class yet, so the roster opens');
 // A later snapshot merges without deleting: client-only keys survive.
 ctx.state.clientOnly='keep';
 applySnapshot(snapshotFixture({state:{hp:38,maxHp:40,level:1,cooldowns:{}}}),false);
 assert.equal(ctx.state.clientOnly,'keep');
 assert.equal(ctx.state.hp,38);
});

test('a map change calls ctx.switchMap before the new state is merged',t=>{
 installGlobals(t,{document:stubDocument()});
 const [ctx,applySnapshot]=wire();
 const away=snapshotFixture({mapId:'drowned-wood',
  players:[{id:'p1',mapId:'drowned-wood',slot:0,color:'#8fd3c7',x:1,z:1,angle:0,moving:false,hp:40,maxHp:40,ended:false,dodge:0,speed:5,zone:'wood'}]});
 applySnapshot(away,false);
 assert.deepEqual(ctx.order,['switchMap','state-delete','state-merge']);
 assert.deepEqual(named(ctx,'switchMap'),[['switchMap','drowned-wood']]);
 assert.equal(named(ctx,'cameraTarget.set').length,1,'a map change re-seats the camera');
 assert.equal(named(ctx,'toast').length,1);
 assert.equal(named(ctx,'toast')[0][1],mapFor('drowned-wood').name);
 ctx.order.length=0;
 applySnapshot(snapshotFixture(),false);
 assert.deepEqual(ctx.order,['switchMap','state-merge'],'a later map change merges without deleting');
 ctx.order.length=0;
 applySnapshot(snapshotFixture(),false);
 assert.deepEqual(ctx.order,['state-merge'],'no map change, no switchMap');
 assert.equal(named(ctx,'switchMap').length,2);
});

test('events at or below the watermark are never re-dispatched and newer ones are dispatched once, in order',t=>{
 installGlobals(t,{document:stubDocument()});
 const [ctx,applySnapshot]=wire();
 applySnapshot(snapshotFixture({events:[{id:3,type:'kill'},{id:5,type:'kill'}]}),false);
 assert.equal(ctx.lastNetworkEvent,5);
 assert.equal(named(ctx,'networkEvent').length,0);
 const second=snapshotFixture({events:[{id:3,type:'kill'},{id:5,type:'kill'},{id:7,type:'hit'},{id:9,type:'loot'}]});
 applySnapshot(second,false);
 assert.deepEqual(named(ctx,'networkEvent').map(call=>call[1].id),[7,9]);
 assert.equal(ctx.lastNetworkEvent,9);
 applySnapshot(second,false);
 assert.deepEqual(named(ctx,'networkEvent').map(call=>call[1].id),[7,9],'a replayed snapshot dispatches nothing new');
 assert.equal(ctx.lastNetworkEvent,9);
});

test('a restart snapshot tears the shared world down and clears the modal and pause state',t=>{
 installGlobals(t,{document:stubDocument()});
 const [ctx,applySnapshot]=wire();
 applySnapshot(snapshotFixture(),false);
 const enemy=makeEnemy('e1'),zone={disposed:0,dispose(){this.disposed++;}},bolt={mesh:{id:'bolt-mesh'}};
 const floater={element:{removed:0,remove(){this.removed++;}}},effect={mesh:{id:'effect-mesh'}};
 Object.assign(ctx,{modalKind:'npc',paused:true,victoryShown:true,lastNetworkEvent:12,mapExpanded:true,effects:[effect],floaters:[floater],enemies:[enemy]});
 ctx.network.pending=[{seq:4}];
 ctx.networkZones.set('z1',zone);ctx.networkProjectiles.set('p1',bolt);
 ctx.player.position.y=1.4;ctx.player.rotation.z=-1.5;
 el('modal-shade').hidden=false;
 ctx.calls.length=0;
 applySnapshot(snapshotFixture({events:[{id:20,type:'boss',typeName:'boss'}]}),true);
 // the shared world
 assert.equal(named(ctx,'classEffects.clear').length,1);
 assert.equal(zone.disposed,1);assert.equal(ctx.networkZones.size,0);
 assert.equal(named(ctx,'releaseInput').length,1);
 assert.deepEqual(ctx.network.pending,[]);
 assert.equal(ctx.victoryShown,false);
 assert.deepEqual(named(ctx,'removeObject').map(call=>call[1].id),['effect-mesh','e1-bar','bolt-mesh']);
 assert.equal(ctx.effects.length,0);assert.equal(floater.element.removed,1);assert.equal(ctx.floaters.length,0);
 assert.equal(named(ctx,'cancelAttack').length,1);
 assert.equal(enemy.visuals.disposed,1);assert.equal(enemy.barTexture.disposed,1);
 assert.deepEqual(ctx.disposed,[enemy.model]);
 assert.equal(ctx.enemies.length,0);
 assert.deepEqual(named(ctx,'life.syncLoot')[0][1],[]);
 assert.deepEqual(named(ctx,'life.syncForage')[0][1],[]);
 assert.equal(ctx.networkProjectiles.size,0);
 assert.equal(named(ctx,'toast')[0][1],'A new vigil begins.');
 assert.equal(named(ctx,'exploration.reset').length,1,'a single-player restart forgets the map');
 // the modal and pause state
 assert.equal(named(ctx,'dismissMainMenu').length,1);
 assert.equal(named(ctx,'inventoryPreviews.hide').length,1);
 assert.equal(el('modal-shade').hidden,true);
 assert.equal(ctx.modalKind,'');
 assert.equal(ctx.paused,false);
 assert.equal(named(ctx,'toggleMapForDeath').length,1);
 assert.equal(named(ctx,'syncAudioState').length,1);
 assert.equal(ctx.player.rotation.z,0);assert.equal(ctx.player.position.y,0);
 // the watermark was reset by `changed`, so the retained event is live again
 assert.deepEqual(named(ctx,'networkEvent').map(call=>call[1].id),[20]);
 assert.equal(named(ctx,'movementCorrection.reconcile')[0][3],true,'a restart snaps rather than eases');
 assert.equal(named(ctx,'multiplayerView.sync')[0][4],true);
 assert.equal(ctx.resetMovement,false);
});

test('a multiplayer restart names the shared world, and the vote row follows the snapshot',t=>{
 installGlobals(t,{document:stubDocument()});
 const [ctx,applySnapshot]=wire({sessionMode:'multiplayer'});
 applySnapshot(snapshotFixture(),false);
 assert.equal(el('restart-vote').hidden,true,'no votes, no row');
 applySnapshot(snapshotFixture({votes:['p1']}),true);
 assert.equal(named(ctx,'toast').at(-1)[1],'A new vigil begins · The shared world has restarted.');
 assert.equal(named(ctx,'exploration.reset').length,0,'a shared world keeps the revealed map');
 assert.equal(el('restart-vote').hidden,false);
 assert.match(el('restart-vote-text').textContent,/1 \/ 1 agree/);
 assert.equal(el('restart-yes').disabled,true);
 assert.match(named(ctx,'connectionStatus').at(-1)[1],/^1 \/ 8 adventurers ·/);
 assert.equal(named(ctx,'connectionStatus').at(-1)[2],true);
});

test('dying opens the death modal once, and the next living snapshot restores the map and the hero',t=>{
 installGlobals(t,{document:stubDocument()});
 const [ctx,applySnapshot]=wire();
 applySnapshot(snapshotFixture(),false);
 ctx.mapExpanded=true;
 applySnapshot(snapshotFixture({state:{hp:0,maxHp:40,level:1,ended:true,cooldowns:{}}}),false);
 assert.deepEqual(named(ctx,'audio.play').at(-1).slice(1),['death-player',.8]);
 assert.equal(named(ctx,'showModal').at(-1)[1],'death');
 assert.equal(named(ctx,'toggleMapForDeath').length,1);
 assert.equal(ctx.player.rotation.z,-1.5);
 applySnapshot(snapshotFixture({state:{hp:40,maxHp:40,level:1,ended:false,cooldowns:{}}}),false);
 assert.equal(named(ctx,'toggleMapForDeath').length,2,'the revived hero gets the map back');
 assert.equal(ctx.player.rotation.z,0);
 assert.equal(named(ctx,'showModal').length,1);
});

test('enemies are spawned, updated, telegraphed and removed by id',t=>{
 installGlobals(t,{document:stubDocument()});
 const [ctx,applySnapshot]=wire();
 const enemy=id=>({id,type:'hollow',x:1,z:2,zone:'road',hp:10,maxHp:10,phase:'idle',timer:0,angle:0});
 applySnapshot(snapshotFixture({enemies:[enemy('e1'),enemy('e2')]}),false);
 assert.deepEqual(named(ctx,'spawnEnemy').map(call=>call[5]),['e1','e2']);
 assert.equal(named(ctx,'updateEnemyBar').length,2);
 assert.equal(ctx.enemies.length,2);
 const gone=ctx.enemies[1];
 applySnapshot(snapshotFixture({enemies:[Object.assign(enemy('e1'),{phase:'windup',timer:.4,attackAngle:.2,aim:{x:1,z:2}})]}),false);
 assert.equal(named(ctx,'spawnEnemy').length,2,'a known id is never respawned');
 assert.deepEqual(ctx.disposed,[gone.model]);
 assert.equal(gone.visuals.disposed,1);
 assert.equal(ctx.enemies.length,1);
 assert.equal(ctx.enemies[0].phase,'windup');
 const [,aim,range,arc,angle]=named(ctx,'telegraph').at(-1);
 assert.equal(range,ENEMY_TYPES.hollow.range);assert.equal(arc,1.9);assert.equal(angle,.2);
 assert.equal(aim.id,'e1','a knife attacker telegraphs from its own position, not its aim point');
});
