import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {runInNewContext, Script} from 'node:vm';
import {SOUND_BANKS} from '../dist/audio-palette.js';

const html=await readFile(new URL('../dist/sound-audition.html',import.meta.url),'utf8');
const scripts=[...html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g)].map(match=>match[1]);
const scope={setTimeout,clearTimeout,setInterval,clearInterval};
runInNewContext(scripts[0],scope);
const {SETS,CUES,SEQUENCE,SEQUENCE_DURATION,synthesize,Player}=scope.SoundAudition;

test('standalone audition covers every live cue in ten complete independent directions',()=>{
  assert.equal(SETS.length,10);
  assert.equal(new Set(SETS.map(set=>set.model)).size,10);
  assert.deepEqual(Array.from(CUES,c=>c.id).sort(),Object.keys(SOUND_BANKS).sort());
  assert.equal(new Set(CUES.map(c=>c.id)).size,CUES.length);
  for(const script of scripts)assert.doesNotThrow(()=>new Script(script));
  assert.doesNotMatch(html,/<(?:script|link|audio)[^>]+(?:src|href)=/);
  assert.doesNotMatch(scripts.join('\n'),/\bfetch\s*\(|import\s|new AudioEngine/);
  for(const item of SEQUENCE){
    assert.ok(SOUND_BANKS[item.cue]);
    for(const set of SETS){
      const cue=CUES.find(c=>c.id===item.cue);
      assert.ok(item.time+cue.duration+set.tail<=SEQUENCE_DURATION,`${set.name}: ${cue.id} fits encounter`);
    }
  }
});

test('all 370 PCM sketches are finite, non-silent, bounded, unique, and click-free at boundaries',()=>{
  const hashes=new Set();
  for(const set of SETS)for(const cue of CUES){
    const {data,sampleRate,duration}=synthesize(set.id,cue.id);
    let peak=0,square=0,sum=0;
    for(const value of data){assert.ok(Number.isFinite(value));peak=Math.max(peak,Math.abs(value));square+=value*value;sum+=value;}
    assert.equal(sampleRate,24000);assert.ok(duration>.18&&duration<6);
    assert.ok(peak>.02&&peak<=.56001,`${set.id}/${cue.id}: peak ${peak}`);
    assert.ok(Math.sqrt(square/data.length)>.01,`${set.id}/${cue.id}: audible energy`);
    assert.ok(Math.abs(sum/data.length)<.004,`${set.id}/${cue.id}: DC offset`);
    assert.equal(Math.abs(data[0]),0);assert.equal(Math.abs(data.at(-1)),0);
    const hash=createHash('sha256').update(data).digest('hex');assert.ok(!hashes.has(hash));hashes.add(hash);
  }
  assert.deepEqual(synthesize('01','impact').data,synthesize('01','impact').data,'replaying a cue is deterministic');
  assert.throws(()=>synthesize('11','impact'),/Unknown/);
  assert.throws(()=>synthesize('01','missing'),/Unknown/);
  assert.throws(()=>synthesize('01','impact',0),/sample rate/);
});

class Param{
  constructor(){this.value=0;}
  setTargetAtTime(value){this.value=value;}
}
class Node{
  constructor(){for(const name of ['gain','threshold','knee','ratio','attack','release'])this[name]=new Param();}
  connect(){this.connected=true;}
  disconnect(){this.connected=false;}
  start(time){this.startTime=time;}
  stop(){this.stopped=true;this.onended?.();}
}
function context(){
  return {state:'running',currentTime:1,destination:new Node(),
    createGain:()=>new Node(),createDynamicsCompressor:()=>new Node(),createBufferSource:()=>new Node(),
    createBuffer:(channels,length,sampleRate)=>{const data=new Float32Array(length);return {duration:length/sampleRate,getChannelData:()=>data};},
    async resume(){this.state='running';}};
}
test('playback schedules the same encounter; replacement and Stop release all sources and timers',async()=>{
  const ctx=context(),states=[],cues=[];
  const player=new Player({contextFactory:()=>ctx,onState:state=>states.push(state),onCue:cue=>cues.push(cue)});
  try{
    await player.play('02');
    assert.equal(player.sources.size,SEQUENCE.length);assert.equal(player.active.duration,26);
    const sources=[...player.sources];
    sources.forEach((source,index)=>assert.equal(source.startTime,1.04+SEQUENCE[index].time));
    ctx.currentTime=8.20;player.tick();assert.equal(cues.at(-1).cue,'ember-hit');
    await player.play('09','heal');
    assert.ok(sources.every(source=>source.stopped&&!source.connected));assert.equal(player.sources.size,1);
    player.setVolume(0);assert.equal(player.master.gain.value,0);
    player.setVolume(4);assert.equal(player.master.gain.value,1);
    const current=[...player.sources];player.stop();
    assert.ok(current.every(source=>source.stopped&&!source.connected));
    assert.equal(player.sources.size,0);assert.equal(player.timer,null);assert.equal(player.active,null);
    assert.equal(states.at(-1).status,'idle');
  }finally{player.stop();}
});

test('Stop and rapid replacement cancel pending preparation; completion and unavailable audio recover',async()=>{
  const ctx=context(),states=[];let release;
  ctx.state='suspended';ctx.resume=()=>new Promise(resolve=>{release=()=>{ctx.state='running';resolve();};});
  const player=new Player({contextFactory:()=>ctx,onState:state=>states.push(state)});
  try{
    const pending=player.play('04');player.stop();release();await pending;assert.equal(player.sources.size,0);
    await Promise.all([player.play('01'),player.play('03'),player.play('10','pickup')]);
    assert.equal(player.active.set,'10');assert.equal(player.sources.size,1);
    ctx.currentTime+=5;player.tick();assert.equal(player.sources.size,0);assert.equal(player.timer,null);
    assert.match(states.at(-1).message,/Finished/);
  }finally{player.stop();}
  const unavailable=new Player({contextFactory:()=>{throw Error('No Web Audio');},onState:state=>states.push(state)});
  await unavailable.play('01','impact');assert.equal(states.at(-1).status,'error');
  assert.match(states.at(-1).message,/No Web Audio/);assert.equal(unavailable.sources.size,0);
});
