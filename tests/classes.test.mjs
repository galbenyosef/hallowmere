import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from '../dist/vendor/three.core.js';
import {World} from '../server/world.mjs';
import {CLASS_LIST,SORCERER_APPEARANCES,applyClass,abilitiesFor,primaryDamage,conceptFor} from '../dist/classes.js';
import {createState,awardKill} from '../dist/combat.js';
import {createCampaign,collectLoot,equipItem,START} from '../dist/campaign.js';
import {createPlayableCharacter,modelBounds} from '../dist/playable-characters.js';
import {predictedPosition} from '../dist/multiplayer-client.js';
import {tick,cast} from './helpers/sim.mjs';

const command=(w,p,type,data={})=>w.command(p.id,{type,worldId:w.id,seq:p.lastSeq+1,...data});
function fixture(classId,appearanceId=classId==='sorcerer'?'C01':undefined){
 const w=new World({seed:17}),p=w.join().player;
 assert.equal(command(w,p,'select-class',{classId,appearanceId}),true);
 w.enemies=[];w.obstacles=[];Object.assign(p,{x:-40,z:5});
 return {w,p,enemy:(x=-40,z=8)=>{const e=w.spawn('hollow',x,z,'road');e.hp=e.maxHp=1000;e.rootUntil=100;return e;}};
}

test('Sorcerer defaults to Bone Oracle across selection, equipment, portraits, and restart',()=>{
 const {w,p}=fixture('sorcerer',null);
 assert.equal(p.state.appearanceId,'W07');assert.equal(conceptFor('sorcerer'),'W07');
 assert.equal(p.state.inventory[0].name,'Skull-topped staff');
 assert.equal(createPlayableCharacter('sorcerer').userData.characterConcept,'W07');
 w.reset();assert.equal(p.state.appearanceId,'W07');
 assert.ok(applyClass(p.state,'sorcerer'));assert.equal(p.state.appearanceId,'W07');
});

test('Geralt can strike, burn enemies, evade, shield damage, and resume with his equipment',()=>{
 const {w,p,enemy}=fixture('geralt'),e=enemy(-40,7);
 assert.equal(p.state.inventory[0].name,'Steel sword');
 assert.ok(cast(w,p,'attack'));tick(w,3);assert.equal(e.hp,968);
 assert.ok(cast(w,p,'bolt'));assert.equal(e.hp,934);tick(w,16);assert.equal(e.hp,930);
 assert.ok(cast(w,p,'nova'));w.damagePlayer(p,30);assert.equal(p.state.hp,150);assert.equal(p.state.shield,15);
 w.damagePlayer(p,20);assert.equal(p.state.hp,145);assert.equal(p.state.shield,0);
 assert.ok(cast(w,p,'dodge'));assert.ok(p.dodge>0);assert.ok(p.state.invulnerable>0);
 assert.equal(w.snapshot(p.id).players[0].classId,'geralt');
 w.leave(p.id);assert.equal(w.join(p.token).player.state.classId,'geralt');
 w.reset();assert.equal(p.state.classId,'geralt');assert.equal(p.state.inventory[0].name,'Steel sword');
});

test('all playable classes preserve health ratios, upgrades and cooldowns when changing calling',()=>{
 const state=Object.assign(createState(),createCampaign(17));state.hp=51;state.mana=37;state.cooldowns.nova=6;
 for(const c of CLASS_LIST){assert.ok(applyClass(state,c.id,c.id==='sorcerer'?'C01':undefined));assert.ok(Math.abs(state.hp/state.maxHp-51/140)<1e-12);assert.ok(Math.abs(state.mana/state.maxMana-.37)<1e-12);assert.equal(state.cooldowns.nova,6);}
 collectLoot(state,{id:'charm',kind:'item',template:'oak-charm'});equipItem(state,'charm');
 collectLoot(state,{id:'weapon',kind:'item',template:'iron-falchion'});equipItem(state,'weapon');
 awardKill(state,'boss');assert.equal(state.maxHp,CLASS_LIST.at(-1).hp+30+20);
 assert.ok(applyClass(state,'sorcerer','W07'));assert.equal(state.maxHp,160);assert.equal(primaryDamage(state),26+6+7);
 const before=structuredClone(state);for(const [id,look] of [['paladin'],['toString'],['sorcerer','W01'],['ranger','W07']])assert.equal(applyClass(state,id,look),false);assert.deepEqual(state,before);
});

test('selection requires a sanctuary, adapts equipment, and survives resume and a new vigil',()=>{
 const {w,p}=fixture('sorcerer','W06');assert.equal(p.state.inventory[0].name,'Gnarled root staff');p.state.gold=77;
 assert.equal(command(w,p,'select-class',{classId:'ranger'}),false);assert.equal(p.state.classId,'sorcerer');
 Object.assign(p,START);assert.equal(command(w,p,'select-class',{classId:'ranger'}),true);assert.equal(p.state.inventory[0].name,'Elven longbow');assert.equal(p.state.gold,77);
 const snap=w.snapshot(p.id);assert.equal(snap.players[0].classId,'ranger');assert.equal(snap.players[0].speed,5.2);
 w.leave(p.id);assert.equal(w.join(p.token).player.state.classId,'ranger');w.reset();assert.equal(p.state.classId,'ranger');assert.equal(p.state.inventory[0].name,'Elven longbow');assert.equal(p.state.gold,0);
});

test('class movement prediction agrees with the authoritative movement step',()=>{
 for(const c of CLASS_LIST){const {w,p}=fixture(c.id),start={x:p.x,z:p.z,speed:c.speed};command(w,p,'input',{x:1,z:0,angle:0});tick(w);const predicted=predictedPosition(start,[{seq:1,x:1,z:0}],0,[]);assert.ok(Math.abs(p.x-predicted.x)<1e-10);}
});

test('Sorcerer Fireball travels as a fireball, bursts on hit without rooting, and coexists with the storm',()=>{
 const {w,p,enemy}=fixture('sorcerer','W10'),e=enemy();e.rootUntil=0;e.phase='recover';e.timer=20;
 assert.ok(cast(w,p,'attack'));tick(w,4);assert.equal(e.hp,972);
 const mana=p.state.mana;assert.ok(cast(w,p,'bolt'));assert.equal(p.state.mana,mana-18);assert.equal(e.hp,972);
 assert.equal(w.snapshot(p.id).projectiles[0].visual,'ember');assert.equal(p.state.cooldowns.bolt,1.2);assert.equal(cast(w,p,'bolt'),false);assert.equal(p.state.mana,mana-18);
 tick(w,4);assert.equal(e.hp,924);assert.equal(e.rootUntil,0);assert.equal(w.projectiles.length,0);assert.equal(w.events.filter(event=>event.type==='hit').at(-1).visual,'ember');
 assert.ok(cast(w,p,'nova',{target:{x:-40,z:9}}));assert.equal(w.snapshot(p.id).zones[0].color,SORCERER_APPEARANCES.W10.color);tick(w,12);assert.ok(e.hp<930);
 assert.equal(cast(w,p,'nova'),false);assert.ok(p.state.mana<120);
});

test('Fireball grazes hit once across its full flight path, while misses and walls stay protected',()=>{
 for(const type of ['hollow','boss']){
  const {w,p,enemy}=fixture('sorcerer'),e=enemy(type==='boss'?-38.7:-39.1,8);e.type=type;
  assert.ok(cast(w,p,'bolt'));tick(w,12);assert.equal(e.hp,952,type);assert.equal(w.events.filter(event=>event.type==='hit').length,1);assert.equal(w.projectiles.length,0);
 }
 for(const scenario of ['outside-radius','wall','arcane-bolt']){
  const {w,p,enemy}=fixture('sorcerer'),e=enemy(scenario==='outside-radius'?-38.8:-39.1,8);
  if(scenario==='wall')w.obstacles=[{x:-39.5,z:8,w:.1,d:6}];
  assert.ok(cast(w,p,scenario==='arcane-bolt'?'attack':'bolt'));tick(w,12);assert.equal(e.hp,1000,scenario);
 }
});

test('Ranger piercing shots hit four enemies once and stop at walls',()=>{
 const {w,p,enemy}=fixture('ranger'),pack=[7,9,11,13,15].map(z=>enemy(-40,z));
 assert.ok(cast(w,p,'bolt'));tick(w,10);assert.deepEqual(pack.map(e=>e.hp),[950,950,950,950,1000]);assert.equal(w.projectiles.length,0);
 p.state.cooldowns.attack=0;w.obstacles=[{x:-40,z:6,w:4,d:.2}];cast(w,p,'attack');tick(w,10);assert.equal(pack[0].hp,950);
});

test('Reaver tanks the frontline, bleeds enemies, and carries Blood Whirl while moving',()=>{
 const {w,p,enemy}=fixture('reaver'),e=enemy(-40,7);
 assert.equal(p.state.maxHp,220);assert.equal(w.snapshot(p.id).players[0].speed,4.3);
 cast(w,p,'attack');tick(w,3);assert.equal(e.hp,964);tick(w,16);assert.equal(e.hp,960);
 cast(w,p,'bolt');p.state.invulnerable=0;w.damagePlayer(p,20);assert.equal(p.state.hp,209);
 cast(w,p,'nova');command(w,p,'input',{x:1,z:0,angle:0});tick(w);assert.equal(w.zones[0].x,p.x);assert.ok(e.hp<960);
 w.enemies=[];command(w,p,'input',{x:0,z:0,angle:0});tick(w,100);
 assert.equal(p.state.guardTime,0);const before=p.state.hp;p.state.invulnerable=0;
 w.damagePlayer(p,20);assert.equal(p.state.hp,before-20);
});

test('Nightblade paired backstabs, knife fan, Shadowstep and smoke have separate effects',()=>{
 const {w,p,enemy}=fixture('nightblade'),e=enemy(-40,7);e.angle=0;
 cast(w,p,'attack');tick(w,5);assert.equal(e.hp,946);
 cast(w,p,'bolt');assert.equal(w.projectiles.length,3);
 cast(w,p,'dodge');assert.equal(p.z,e.z-1.15);assert.ok(p.state.invulnerable>0);
 cast(w,p,'nova');tick(w);assert.ok(p.state.concealed>0);assert.equal(e.slow,.5);
 tick(w,100);assert.equal(w.zones.length,0);assert.equal(p.state.concealed,0);assert.equal(e.slow,0);
});


test('Alchemist poison ticks expire, remedies heal at the aim point, and Miasma slows',()=>{
 const {w,p,enemy}=fixture('alchemist'),e=enemy(),ally=w.join().player;Object.assign(ally,{x:-40,z:9});ally.state.hp=50;
 cast(w,p,'attack');tick(w,4);assert.equal(e.hp,979);tick(w,17);assert.equal(e.hp,975);
 cast(w,p,'bolt',{target:{x:-40,z:9}});assert.equal(ally.state.hp,75);assert.equal(e.hp,949);
 cast(w,p,'nova',{target:{x:-40,z:9}});tick(w);assert.equal(e.slow,.4);assert.ok(e.hp<949);
 p.state.ended=true;tick(w,90);assert.equal(w.zones.length,0);assert.equal(e.dots.length,0);
});

test('aimed abilities cannot cross walls or spend resources on invalid targets',()=>{
 const {w,p}=fixture('alchemist');w.obstacles=[{x:-40,z:6,w:10,d:.2}];const mana=p.state.mana;
 assert.equal(cast(w,p,'bolt',{target:{x:-40,z:9}}),false);assert.equal(p.state.mana,mana);assert.equal(p.state.cooldowns.bolt,0);
 assert.equal(cast(w,p,'nova',{target:{x:-40,z:9}}),false);assert.equal(w.zones.length,0);
 assert.equal(cast(w,p,'constructor'),false);
});

test('all playable and legacy appearance models have finite world-sized bounds and weapons follow the animated arms',()=>{
 const choices=[...Object.keys(SORCERER_APPEARANCES).map(id=>['sorcerer',id]),...CLASS_LIST.filter(c=>c.id!=='sorcerer').map(c=>[c.id,c.concept])];assert.equal(choices.length,10);
 for(const [classId,look] of choices){const root=createPlayableCharacter(classId,look),bounds=modelBounds(root),size=bounds.getSize(new T.Vector3());assert.ok(size.y>1.7&&size.y<3.1,look);assert.ok(size.x<2.5&&size.z<2,look);
  root.traverse(n=>{if(n.geometry)for(const value of n.geometry.attributes.position.array)assert.ok(Number.isFinite(value),look);});
  const weapon=root.getObjectByName('weapon'),arm=root.getObjectByName('armR');assert.equal(weapon.parent,arm);const before=new T.Box3().setFromObject(weapon).getCenter(new T.Vector3());arm.rotation.x=-.7;root.updateMatrixWorld(true);const after=new T.Box3().setFromObject(weapon).getCenter(new T.Vector3());assert.ok(before.distanceTo(after)>.1,look);
 }
});
