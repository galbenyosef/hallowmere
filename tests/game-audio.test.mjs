import test from 'node:test';
import assert from 'node:assert/strict';
import {installGlobals} from './helpers/dom.mjs';
import {createGameAudio} from '../dist/game-audio.js';

// M7 moved syncAudioState/awaken/audioAt/footstepCue/updateAudioWorld out of main.js.

function makeAudio(){
 return {paused:undefined,backgrounded:false,muted:false,ready:true,pauseCalls:[],playCalls:[],updateCalls:[],
  pause(silent,backgrounded){this.pauseCalls.push([silent,backgrounded]);this.paused=silent;this.backgrounded=backgrounded;},
  play(cue,volume,rate,options){this.playCalls.push({cue,volume,rate,options});},
  update(dt,state){this.updateCalls.push({dt,state});},
  // Exposes the exact promise awaken() attaches .then(...) to, so a test can `await
  // audio.lastUnlock` and be sure that reaction already ran (same-promise reactions fire in
  // attachment order, so attaching ours after awaken()'s guarantees awaken's runs first).
  unlock(){const p=Promise.resolve();this.lastUnlock=p;return p;},
 };
}
function makeElement(){return {style:{},attrs:{},setAttribute(k,v){this.attrs[k]=v;}};}
function stubDocument(){
 const byId=new Map();
 return {getElementById(id){if(!byId.has(id))byId.set(id,makeElement());return byId.get(id);}};
}

test('syncAudioState mutes/unmutes per the connected/paused/backgrounded/roster matrix and is a no-op when nothing changed',()=>{
 const audio=makeAudio();
 const ctx={ready:true,paused:false,backgrounded:false,rosterPicker:{open:false},network:{connected:true},audio};
 const {syncAudioState}=createGameAudio(ctx);
 // ready+connected+unpaused+foregrounded+roster closed -> not silent.
 syncAudioState();
 assert.deepEqual(audio.pauseCalls,[[false,false]]);
 // Nothing changed -> no redundant audio.pause call.
 syncAudioState();
 assert.equal(audio.pauseCalls.length,1);
 // Pausing flips silent to true.
 ctx.paused=true;syncAudioState();
 assert.deepEqual(audio.pauseCalls.at(-1),[true,false]);
 // Backgrounding also flips silent, and is itself tracked even while already silent.
 ctx.paused=false;ctx.backgrounded=true;syncAudioState();
 assert.deepEqual(audio.pauseCalls.at(-1),[true,true]);
 // Roster picker open forces silence even while otherwise foregrounded and connected.
 ctx.backgrounded=false;ctx.rosterPicker.open=true;syncAudioState();
 assert.deepEqual(audio.pauseCalls.at(-1),[true,false]);
 ctx.rosterPicker.open=false;syncAudioState();
 assert.deepEqual(audio.pauseCalls.at(-1),[false,false]);
 // Not ready, or the explicit connected=false argument, are both silent too.
 ctx.ready=false;syncAudioState();
 assert.deepEqual(audio.pauseCalls.at(-1),[true,false]);
 ctx.ready=true;syncAudioState(false);
 assert.deepEqual(audio.pauseCalls.at(-1),[true,false]);
});

test('awaken flips ctx.started only when ready, and unlocks + resyncs audio afterward',async t=>{
 const doc=stubDocument();
 installGlobals(t,{document:doc});
 const audio=makeAudio();
 audio.muted=true;
 const ctx={ready:false,started:false,paused:false,backgrounded:false,rosterPicker:{open:false},network:{connected:true},audio};
 const {awaken}=createGameAudio(ctx);
 awaken();
 assert.equal(ctx.started,false); // not ready -> never marked started
 assert.equal(audio.pauseCalls.length,1); // syncAudioState still ran synchronously
 await audio.lastUnlock; // let unlock().then(...) settle
 assert.equal(doc.getElementById('audio-prompt').style.opacity,'0');
 assert.equal(doc.getElementById('sound-button').attrs['aria-label'],'Enable sound');
 ctx.ready=true;
 awaken();
 assert.equal(ctx.started,true);
});

test('awaken does nothing further once unlocked audio never becomes ready',async t=>{
 const doc=stubDocument();
 installGlobals(t,{document:doc});
 const audio=makeAudio();
 audio.ready=false;
 const ctx={ready:true,started:false,paused:false,backgrounded:false,rosterPicker:{open:false},network:{connected:true},audio};
 const {awaken}=createGameAudio(ctx);
 awaken();
 await audio.lastUnlock;
 assert.equal(doc.getElementById('audio-prompt').style.opacity,undefined);
 assert.equal(audio.pauseCalls.length,1); // the post-unlock resync is skipped when audio never became ready
});

test('audioAt sets the listener from the player position and plays the cue with position/volume/rate, occluded by line of sight',()=>{
 const audio=makeAudio();
 const ctx={player:{position:{x:1,z:2}},environment:{obstacles:[]},audio};
 const {audioAt}=createGameAudio(ctx);
 const target={x:11,z:2};
 audioAt('sword',target,.6,1.2);
 assert.deepEqual(audio.listener,{x:1,z:2});
 assert.deepEqual(audio.playCalls,[{cue:'sword',volume:.6,rate:1.2,options:{position:target,occluded:false}}]);
 // An obstacle straddling the straight line to the cue occludes it.
 ctx.environment.obstacles=[{x:6,z:2,w:2,d:2,rotation:0}];
 audioAt('sword',target);
 assert.equal(audio.playCalls.at(-1).options.occluded,true);
 assert.equal(audio.playCalls.at(-1).volume,1); // default volume/rate
 assert.equal(audio.playCalls.at(-1).rate,1);
});

test('footstepCue picks interior chapel/non-chapel cues and exterior road/other cues',()=>{
 const ctx={environment:{currentBuilding:()=>null},player:{position:{x:0,z:0}}};
 const {footstepCue}=createGameAudio(ctx);
 ctx.environment.currentBuilding=()=>({chapel:true});
 assert.equal(footstepCue(),'step');
 ctx.environment.currentBuilding=()=>({chapel:false});
 assert.equal(footstepCue(),'step-wood');
 ctx.environment.currentBuilding=()=>null;
 ctx.player.position={x:-40,z:0}; // inside the road zone (zoneAt: -57 < x < -24), far from z=5
 assert.equal(footstepCue(),'step-dirt');
 ctx.player.position={x:-40,z:5}; // still road, but within 1.8 of the road's centerline
 assert.equal(footstepCue(),'step');
 ctx.player.position={x:0,z:0}; // hallowmere zone, not road at all
 assert.equal(footstepCue(),'step');
});

test('updateAudioWorld plays the door cue only once started, tracks audioInterior, sums enemy threat, and forwards ambience state',()=>{
 const audio=makeAudio();
 const player={position:{x:0,z:0}};
 const grunt={type:'grunt',dead:false,model:{position:{x:5,z:0}}};
 const boss={type:'boss',dead:false,model:{position:{x:10,z:0}}};
 const deadOne={type:'boss',dead:true,model:{position:{x:0,z:0}}};
 const ctx={
  environment:{currentBuilding:()=>({id:'chapel'})},player,started:false,audioInterior:null,
  state:{ended:false,zone:'hallowmere',hp:60,maxHp:100,victory:false,campaignComplete:false},
  enemies:[grunt,boss,deadOne],safeHere:()=>false,bossType:type=>type==='boss',renderedMap:'overworld',audio,
 };
 const {updateAudioWorld}=createGameAudio(ctx);
 updateAudioWorld(.1);
 assert.equal(audio.playCalls.length,0); // not started yet -> no door cue on the first interior
 assert.equal(ctx.audioInterior,'chapel');
 const expectedThreat=Math.max(0,1-5/13)*.42+Math.max(0,1-10/13)*1;
 assert.equal(audio.updateCalls.length,1);
 const call=audio.updateCalls[0];
 assert.equal(call.dt,.1);
 assert.ok(Math.abs(call.state.threat-expectedThreat)<1e-9);
 assert.equal(call.state.interior,true);
 assert.equal(call.state.zone,'hallowmere');
 assert.equal(call.state.health,.6);
 assert.equal(call.state.victory,false); // overworld -> state.victory
 // Leaving the room while started plays the door cue and clears the interior/threat.
 ctx.started=true;ctx.environment.currentBuilding=()=>null;
 updateAudioWorld(.2);
 assert.deepEqual(audio.playCalls,[{cue:'door',volume:.44,rate:undefined,options:undefined}]);
 assert.equal(ctx.audioInterior,null);
 assert.equal(audio.updateCalls.at(-1).state.interior,false);
 // A sanctuary or an ended run suppresses threat even with live enemies nearby.
 ctx.safeHere=()=>true;
 updateAudioWorld(.1);
 assert.equal(audio.updateCalls.at(-1).state.threat,0);
 ctx.safeHere=()=>false;ctx.state.ended=true;
 updateAudioWorld(.1);
 assert.equal(audio.updateCalls.at(-1).state.threat,0);
 // Off the overworld, ambience victory tracks campaignComplete instead of victory.
 ctx.renderedMap='drowned-wood';ctx.state.campaignComplete=true;
 updateAudioWorld(.1);
 assert.equal(audio.updateCalls.at(-1).state.victory,true);
});
