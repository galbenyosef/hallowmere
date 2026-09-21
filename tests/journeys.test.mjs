import test from 'node:test';
import assert from 'node:assert/strict';
import {createJourney,captureJourney,validateJourney} from '../dist/journey-state.js';
import {LocalSession} from '../dist/local-session.js';
import {createAutosave,JourneyConflict} from '../dist/journey-store.js';
import {CHECKPOINTS} from '../dist/regions.js';

const load=save=>{const session=new LocalSession({save,onSnapshot(){}});session.start();return session;};

test('journeys restore at the activated checkpoint with all-region progress and possessions retained',()=>{
 const data=createJourney({classId:'ranger',appearanceId:'C02'});
 const checkpoint=CHECKPOINTS.find(c=>c.mapId==='drowned-wood'),state=data.player.state;
 Object.assign(state,{checkpointId:checkpoint.id,mapId:'blackvein-quarry',gold:137,level:4,souls:325,hp:0,ended:true,potions:1,claimedCaches:['old-cache']});
 state.cooldowns.nova=4;state.pouch['crimson-mushroom']=2;
 data.shared.victory=true;data.shared.discoveries.push('secret-passage');
 data.shared.regionProgress['drowned-wood'].objectives.push('cleansed-shrine');
 const dead=data.enemies.find(e=>e.mapId==='blackvein-quarry');dead.hp=0;dead.phase='dead';
 data.player.loot.push({id:'unclaimed-drop',mapId:'blackvein-quarry',x:0,z:0,kind:'gold',amount:4});
 data.player.forageReadyAt['forage-1']=data.time+30;
 const session=load(data),p=session.world.players.get(session.id);
 assert.equal(p.mapId,checkpoint.mapId);assert.equal(p.x,checkpoint.x);assert.equal(p.z,checkpoint.z);
 assert.equal(p.state.gold,137);assert.equal(p.state.level,4);assert.equal(p.state.souls,325);
 assert.equal(p.state.potions,1);assert.equal(p.state.pouch['crimson-mushroom'],2);assert.equal(p.state.cooldowns.nova,4);
 assert.equal(p.state.ended,false);assert.equal(p.state.hp,p.state.maxHp);
 assert.deepEqual(p.state.claimedCaches,['old-cache']);assert.equal(p.loot[0].id,'unclaimed-drop');
 assert.equal(session.world.enemies.find(e=>e.id===dead.id).hp,0);
 assert.deepEqual(session.world.shared.discoveries,['secret-passage']);
 assert.deepEqual(session.world.shared.regionProgress['drowned-wood'].objectives,['cleansed-shrine']);
 p.state.gold=0;assert.equal(data.player.state.gold,137,'loading must detach the stored record');session.close();
});

test('journeys remain isolated, can change their character, and never restart their campaign',()=>{
 const first=load(createJourney({classId:'ranger',appearanceId:'C02'}));
 const second=load(createJourney({classId:'reaver',appearanceId:'C03'}));
 first.world.players.get(first.id).state.gold=300;first.world.shared.victory=true;
 assert.equal(second.world.players.get(second.id).state.gold,0);assert.equal(second.world.shared.victory,false);
 assert.equal(first.send('select-class',{classId:'sorcerer',appearanceId:'W07'}),true);assert.equal(first.send('restart'),false);
 assert.equal(first.world.players.get(first.id).state.classId,'sorcerer');assert.equal(second.world.players.get(second.id).state.classId,'reaver');
 const saved=first.capture();assert.equal(validateJourney(saved),saved);assert.equal(saved.player.state.classId,'sorcerer');
 saved.player.state.gold=1;assert.equal(first.world.players.get(first.id).state.gold,300);
 first.close();second.close();
});

test('the durable record contains enemies outside the renderer map and rejects invalid or newer saves',()=>{
 const session=load(createJourney({classId:'sorcerer',appearanceId:'W07'}));
 const visible=session.world.snapshot(session.id).enemies,save=captureJourney(session.world,session.id);
 assert.ok(save.enemies.length>visible.length);
 assert.throws(()=>validateJourney({...save,version:999}),/newer game version/);
 assert.throws(()=>validateJourney({...save,player:{state:{classId:'missing'}}}),/could not be read/);
 session.close();
});

test('autosave writes in order, retries failures, and only releases after Save & exit succeeds',async t=>{
 const writes=[],statuses=[];let latest=1,fail=true,released=false;
 const saver=createAutosave({store:{owner:'tab',async save(id,revision,data){writes.push({revision,value:data.value});if(fail){fail=false;throw Error('Storage full');}return {revision:revision+1,savedAt:2};},async renew(){},async release(){released=true;}},
  record:{id:'journey',revision:1,savedAt:1},getSave:()=>({value:latest}),onStatus:s=>statuses.push(s),onConflict:()=>assert.fail('Not a conflict')});
 t.after(()=>saver.stop());saver.changed();await assert.rejects(saver.flush(),/Storage full/);assert.equal(released,false);
 latest=2;await saver.flush();assert.deepEqual(writes,[{revision:1,value:1},{revision:1,value:2}]);
 latest=3;await saver.exit();assert.equal(writes.at(-1).revision,2);assert.equal(writes.at(-1).value,3);assert.equal(released,true);
 assert.ok(statuses.some(s=>s.kind==='error'));assert.equal(statuses.at(-1).kind,'saved');
});

test('another tab taking ownership stops autosaving without overwriting its journey',async t=>{
 let conflicts=0;
 const saver=createAutosave({store:{async save(){throw new JourneyConflict('Another tab owns this journey');}},record:{id:'journey',revision:1,savedAt:1},getSave:()=>({}),onStatus(){},onConflict(){conflicts++;}});
 t.after(()=>saver.stop());saver.changed();await assert.rejects(saver.flush(),JourneyConflict);
 assert.equal(conflicts,1);assert.equal(saver.stopped,true);
});
