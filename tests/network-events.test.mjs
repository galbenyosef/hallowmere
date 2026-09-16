// M10 moved networkEvent out of dist/main.js into dist/network-events.js verbatim. It is the
// one place a server event becomes a local effect, float text or sound, so every branch is
// driven here through a ctx that records the calls it makes, with the real ability table
// (dist/classes.js) and the real ENEMY_TYPES behind it -- the event payloads are the ones
// dist/world.js actually publishes.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from '../dist/vendor/three.core.js';
import {ENEMY_TYPES} from '../dist/combat.js';
import {abilitiesFor} from '../dist/classes.js';
import {createNetworkEvents} from '../dist/network-events.js';
import {installGlobals} from './helpers/dom.mjs';

// $('damage-vignette') is the only element networkEvent touches; tests/hud.test.mjs's
// recursive-mock-element pattern, trimmed to the one lookup this module makes.
function stubDocument(){
 const byId=new Map();
 return {getElementById(id){if(!byId.has(id))byId.set(id,{id,style:{}});return byId.get(id);}};
}

// A self-consistent ctx: every slot networkEvent can reach, each recording into one ordered
// call log so a branch's effects can be asserted as a sequence, not just a set.
function makeCtx(overrides={}){
 const calls=[],rec=name=>(...args)=>{calls.push([name,...args]);};
 const ctx={
  calls,
  backgrounded:false,renderedMap:'overworld',sessionMode:'multiplayer',cavePreviewStarted:false,sessionGeneration:0,
  state:{},network:{id:'local'},player:{name:'hero'},heroRig:{},
  multiplayerView:{actors:new Map([['remote',{model:{name:'remote'},rig:{}}]])},
  classEffects:{ability:()=>null,impact:()=>false},
  combatEffects:{cast:rec('cast'),arcaneCast:rec('arcaneCast'),emberImpact:rec('emberImpact'),arcaneImpact:rec('arcaneImpact')},
  audio:{play:rec('audio.play')},
  audioAt:rec('audioAt'),releaseInput:rec('releaseInput'),
  slash:rec('slash'),particles:rec('particles'),ringEffect:rec('ringEffect'),steelImpact:rec('steelImpact'),
  floatText:rec('floatText'),toast:rec('toast'),lootCollected:rec('lootCollected'),
  moveTarget:{x:1},movePath:[{x:1}],lockedEnemy:null,attackHeld:false,enemies:[],resetMovement:false,
  rosterPicker:{resolve:rec('rosterPicker.resolve')},
  bossType:type=>type==='boss'||!!ENEMY_TYPES[type]?.boss,
  enemyModelType:type=>ENEMY_TYPES[type]?.modelType||type
 };
 return Object.assign(ctx,overrides);
}
const wire=overrides=>{const ctx=makeCtx(overrides);return [ctx,createNetworkEvents(ctx).networkEvent];};
const named=(ctx,name)=>ctx.calls.filter(call=>call[0]===name);
const sounds=ctx=>named(ctx,'audioAt').map(call=>call[1]);

test('a backgrounded client and an event from another map are dropped before any effect',()=>{
 const [off,dropped]=wire({backgrounded:true});
 dropped({type:'hit',damage:7,x:1,z:2});
 assert.deepEqual(off.calls,[]);
 const [ctx,networkEvent]=wire();
 networkEvent({type:'hit',damage:7,mapId:'drowned-wood'});
 assert.deepEqual(ctx.calls,[]);
 networkEvent({type:'hit',damage:7,mapId:'overworld'});
 assert.equal(named(ctx,'floatText').length,1);
});

test('melee abilities animate the acting rig, and an unknown actor stops the event',()=>{
 const [ctx,networkEvent]=wire();
 networkEvent({type:'ability',action:'attack',classId:'reaver',playerId:'local',angle:.5,x:3,z:4});
 assert.equal(ctx.heroRig.attack,.42);assert.equal(ctx.heroRig.attackKind,'attack');
 const [slash]=named(ctx,'slash');
 assert.equal(slash[1].x,3);assert.equal(slash[1].z,4);assert.equal(slash[2],.5);assert.equal(slash[4],abilitiesFor({classId:'reaver'}).attack.range);
 assert.deepEqual(sounds(ctx),['sword']);

 const [remoteCtx,remoteEvent]=wire();
 remoteEvent({type:'ability',action:'attack',classId:'nightblade',playerId:'remote'});
 assert.equal(remoteCtx.multiplayerView.actors.get('remote').rig.attackKind,'paired');
 assert.equal(remoteCtx.heroRig.attackKind,undefined);

 const [goneCtx,goneEvent]=wire();
 goneEvent({type:'ability',action:'attack',classId:'reaver',playerId:'ghost'});
 assert.deepEqual(goneCtx.calls,[]);
});

test('a class visual suppresses the generic melee slash but not its sound',()=>{
 const [ctx,networkEvent]=wire({classEffects:{ability:()=>({kind:'blades'}),impact:()=>false}});
 networkEvent({type:'ability',action:'attack',classId:'nightblade',playerId:'local'});
 assert.equal(ctx.heroRig.attackKind,'paired');
 assert.equal(named(ctx,'slash').length,0);
 assert.deepEqual(sounds(ctx),['sword']);
});

test('each projectile flavour picks its own visual and sound',()=>{
 const [ember,emberEvent]=wire();
 emberEvent({type:'ability',action:'bolt',classId:'sorcerer',playerId:'local',angle:0,x:0,z:0});
 assert.equal(ember.heroRig.attack,.36);assert.equal(ember.heroRig.attackKind,'bolt');
 assert.equal(named(ember,'cast').length,1);
 assert.equal(named(ember,'cast')[0][1].y,1.2);
 assert.deepEqual(sounds(ember),['ember']);

 const [arcane,arcaneEvent]=wire();
 arcaneEvent({type:'ability',action:'attack',classId:'sorcerer',playerId:'local',angle:0});
 assert.equal(named(arcane,'arcaneCast').length,1);
 assert.deepEqual(sounds(arcane),['ember']);

 const [arrow,arrowEvent]=wire();
 arrowEvent({type:'ability',action:'attack',classId:'ranger',playerId:'local',angle:0});
 assert.equal(named(arrow,'particles').length,1);
 assert.deepEqual(sounds(arrow),['sword']);

 const [knife,knifeEvent]=wire({classEffects:{ability:()=>({kind:'knives'}),impact:()=>false}});
 knifeEvent({type:'ability',action:'bolt',classId:'nightblade',playerId:'local',angle:0});
 assert.equal(named(knife,'particles').length,0);
 assert.deepEqual(sounds(knife),['sword']);
});

test('support, burst, zone, shield, heal and dodge each take their own branch',()=>{
 const [support,supportEvent]=wire();
 supportEvent({type:'ability',action:'bolt',classId:'oathkeeper',playerId:'local'});
 assert.equal(support.heroRig.attack,.42);assert.equal(support.heroRig.attackKind,'support');
 assert.deepEqual(sounds(support),['heal']);

 const [burst,burstEvent]=wire();
 burstEvent({type:'ability',action:'bolt',classId:'reaver',playerId:'local'});
 assert.equal(burst.heroRig.attack,.36);assert.equal(burst.heroRig.attackKind,'bolt');
 assert.equal(named(burst,'ringEffect').length,1);assert.equal(named(burst,'particles').length,1);
 assert.deepEqual(sounds(burst),['nova']);

 const [zone,zoneEvent]=wire();
 zoneEvent({type:'ability',action:'nova',classId:'oathkeeper',playerId:'local'});
 assert.equal(zone.heroRig.attack,.42);assert.equal(zone.heroRig.attackKind,'support');
 assert.deepEqual(sounds(zone),['nova']);

 const [shield,shieldEvent]=wire();
 shieldEvent({type:'ability',action:'nova',classId:'geralt',playerId:'local'});
 assert.equal(named(shield,'ringEffect')[0][3],.8);
 assert.deepEqual(sounds(shield),['heal']);

 const [heal,healEvent]=wire();
 healEvent({type:'ability',action:'heal',classId:'sorcerer',playerId:'local'});
 assert.equal(named(heal,'ringEffect')[0][2],0x97cba5);
 assert.deepEqual(sounds(heal),['heal']);

 const [dodge,dodgeEvent]=wire({lockedEnemy:{id:'e1'}});
 dodgeEvent({type:'ability',action:'dodge',classId:'sorcerer',playerId:'local'});
 assert.deepEqual(sounds(dodge),['dodge']);
 assert.equal(dodge.moveTarget,null);assert.deepEqual(dodge.movePath,[]);assert.equal(dodge.lockedEnemy,null);

 const [remoteDodge,remoteDodgeEvent]=wire({lockedEnemy:{id:'e1'}});
 remoteDodgeEvent({type:'ability',action:'dodge',classId:'sorcerer',playerId:'remote'});
 assert.deepEqual(remoteDodge.lockedEnemy,{id:'e1'});
});

test('hit events float the damage and pick the impact the server named',()=>{
 const [steel,steelEvent]=wire();
 steelEvent({type:'hit',damage:12,x:2,z:3});
 assert.deepEqual(named(steel,'floatText')[0].slice(1,2).concat(named(steel,'floatText')[0][3]),['12','']);
 assert.equal(named(steel,'steelImpact')[0][1].y,1);
 assert.deepEqual(sounds(steel),['impact']);

 const [magic,magicEvent]=wire();
 magicEvent({type:'hit',damage:9,magic:true});
 assert.equal(named(magic,'floatText')[0][3],'magic');
 assert.equal(named(magic,'particles').length,1);
 assert.deepEqual(sounds(magic),['ember-hit']);

 const [ember,emberEvent]=wire();
 emberEvent({type:'hit',damage:4,visual:'ember'});
 assert.equal(named(ember,'emberImpact').length,1);assert.equal(named(ember,'steelImpact').length,0);

 const [arcane,arcaneEvent]=wire();
 arcaneEvent({type:'hit',damage:4,visual:'arcane'});
 assert.equal(named(arcane,'arcaneImpact').length,1);

 const [claimed,claimedEvent]=wire({classEffects:{ability:()=>null,impact:()=>true}});
 claimedEvent({type:'hit',damage:4,magic:true});
 assert.equal(named(claimed,'particles').length,0);assert.equal(named(claimed,'steelImpact').length,0);
});

test('respawn, hurt and kill reach the player-facing feedback',async t=>{
 installGlobals(t,{document:stubDocument()});
 const [mine,mineEvent]=wire();
 mineEvent({type:'respawn',revivedBy:'other',playerId:'local'});
 assert.equal(named(mine,'ringEffect').length,1);assert.equal(named(mine,'particles').length,1);
 assert.deepEqual(sounds(mine),['heal']);
 assert.deepEqual(named(mine,'toast')[0][1],'Resurrected by Oathkeeper');

 const [theirs,theirsEvent]=wire();
 theirsEvent({type:'respawn',revivedBy:'other',playerId:'remote'});
 assert.equal(named(theirs,'toast').length,0);
 theirsEvent({type:'respawn',playerId:'local'});
 assert.equal(named(theirs,'ringEffect').length,1);

 const [hurt,hurtEvent]=wire();
 hurtEvent({type:'hurt',damage:6,playerId:'local'});
 assert.equal(named(hurt,'floatText')[0][3],'enemy-damage');
 assert.deepEqual(named(hurt,'audio.play')[0].slice(1),['hurt',.6]);
 assert.equal(globalThis.document.getElementById('damage-vignette').style.opacity,'.75');
 // The vignette clears itself on networkEvent's own 210 ms timer; wait it out inside the test
 // so the stub document is still installed when that callback runs.
 await new Promise(resolve=>setTimeout(resolve,260));
 assert.equal(globalThis.document.getElementById('damage-vignette').style.opacity,'0');

 const [kill,killEvent]=wire({lockedEnemy:{id:'e1'},attackHeld:true});
 killEvent({type:'kill',typeName:'boss',enemyId:'e1'});
 assert.deepEqual(sounds(kill),['death-boss']);
 assert.equal(kill.lockedEnemy,null);assert.equal(kill.attackHeld,false);
 assert.match(named(kill,'toast')[0][1],/Bellkeeper falls/);

 for(const [typeName,sound] of [['hound','death-hound'],['revenant','death-revenant'],['hollow','death']]){
  const [ctx,event]=wire();
  event({type:'kill',typeName,enemyId:'gone'});
  assert.deepEqual(sounds(ctx),[sound]);
 }
});

test('region bosses, objectives, the bell, windups and strikes each announce themselves',()=>{
 const boss={id:'e1',type:'rootbound',data:{name:'The Rootbound'},model:{position:{x:1,y:0,z:2}},visuals:{strike(){}}};
 const [region,regionEvent]=wire({enemies:[boss]});
 regionEvent({type:'region-boss',enemyId:'e1'});
 assert.deepEqual(named(region,'toast')[0][1],'The Rootbound has awakened.');
 assert.deepEqual(named(region,'audio.play')[0].slice(1),['boss-windup',.65]);

 const [objective,objectiveEvent]=wire();
 objectiveEvent({type:'objective-ready',message:'The gate yields.'});
 assert.deepEqual(named(objective,'toast')[0][1],'The gate yields.');

 const [bell,bellEvent]=wire();
 bellEvent({type:'boss',typeName:'boss'});
 assert.deepEqual(named(bell,'toast')[0][1],'The Bellkeeper has answered.');
 assert.deepEqual(named(bell,'audio.play')[0].slice(1),['bell',.6]);

 const [windup,windupEvent]=wire({enemies:[boss,{id:'e2',type:'hollow',model:{position:{x:0,y:0,z:0}},visuals:{strike(){}}}]});
 windupEvent({type:'windup',enemyId:'e1'});
 windupEvent({type:'windup',enemyId:'e2'});
 assert.deepEqual(sounds(windup),['boss-windup','voice-hollow']);

 let struck=0;
 const strikeEnemy={id:'e3',type:'hollow',model:{position:{x:0,y:0,z:0}},visuals:{strike(){struck++;}}};
 const [strike,strikeEvent]=wire({enemies:[strikeEnemy]});
 strikeEvent({type:'strike',enemyId:'e3',typeName:'rootbound',angle:0});
 strikeEvent({type:'strike',enemyId:'e3',typeName:'hollow',angle:0});
 strikeEvent({type:'strike',enemyId:'e3',typeName:'hound',angle:0});
 strikeEvent({type:'strike',enemyId:'e3',typeName:'revenant',angle:0});
 assert.equal(struck,4);
 assert.deepEqual(sounds(strike),['boss-slam','sword','impact','ember']);
 assert.equal(named(strike,'ringEffect').length,1);
 assert.equal(named(strike,'slash').length,1);
 assert.equal(named(strike,'particles').length,2);
});

test('loot and result events reach the pickup path, the roster picker and the toast',()=>{
 const [loot,lootEvent]=wire();
 lootEvent({type:'loot',drop:{id:'d1',kind:'gold'}});
 assert.deepEqual(named(loot,'lootCollected')[0].slice(1),[{id:'d1',kind:'gold'},{collected:true}]);

 const [forage,forageEvent]=wire();
 forageEvent({type:'result',ok:true,operation:'forage'});
 assert.deepEqual(named(forage,'audio.play')[0].slice(1),['pickup',.55]);
 forageEvent({type:'result',ok:true,operation:'consume'});
 assert.deepEqual(named(forage,'audio.play')[1].slice(1),['heal',.55]);
 forageEvent({type:'result',ok:false,operation:'forage',reason:'Nothing ripe here.'});
 assert.deepEqual(named(forage,'toast')[0][1],'Nothing ripe here.');

 const [pick,pickEvent]=wire();
 pickEvent({type:'result',operation:'class',ok:true,message:'Oath sworn'});
 assert.equal(named(pick,'rosterPicker.resolve').length,1);
 assert.deepEqual(named(pick,'toast')[0][1],'Oath sworn');
});
