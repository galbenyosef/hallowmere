import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile, readdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {AudioEngine} from '../dist/audio.js';
import {AUDIO_PALETTE, SOUND_BANKS, AUDIO_FILES, MAX_VOICES, spatialMix, ambienceMix} from '../dist/audio-palette.js';

const directory = new URL('../dist/assets/audio/', import.meta.url);
test('every sound decodes as bounded, non-silent PCM; loops have continuous endpoints', async () => {
  const names = (await readdir(directory)).filter(name => name.endsWith('.wav')).sort();
  assert.deepEqual(names, AUDIO_FILES.map(name => name + '.wav').sort());
  const hashes = new Set(); let total = 0;
  for (const [cue, bank] of Object.entries(SOUND_BANKS)) for (const file of bank.files) {
    const b = await readFile(new URL(`${file}.wav`, directory)); total += b.length;
    assert.equal(b.toString('ascii', 0, 4), 'RIFF', file);
    assert.equal(b.readUInt32LE(4), b.length - 8, file);
    assert.equal(b.toString('ascii', 8, 12), 'WAVE', file);
    assert.equal(b.readUInt16LE(20), 1, file);
    assert.equal(b.readUInt32LE(24), 48000, file);
    assert.equal(b.readUInt16LE(34), 16, file);
    const channels = b.readUInt16LE(22), stride = channels * 2;
    assert.equal(b.readUInt32LE(40), b.length - 44, file);
    assert.ok(b.length > 4000 && (b.length - 44) % stride === 0, file);
    let peak = 0, sum = 0, square = 0;
    for (let i = 44; i < b.length; i += 2) {
      const v = b.readInt16LE(i) / 32768; peak = Math.max(peak, Math.abs(v)); sum += v; square += v * v;
    }
    const samples = (b.length - 44) / 2;
    assert.ok(peak <= .501 && peak > .035, `${file} source headroom: ${peak}`);
    assert.ok(Math.abs(sum / samples) < .006, `${file} DC offset`);
    assert.ok(Math.sqrt(square / samples) > .005, `${file} audible content`);
    for (let c = 0; c < channels; c++) {
      const first = b.readInt16LE(44 + c * 2), last = b.readInt16LE(b.length - stride + c * 2);
      if (bank.loop) assert.ok(Math.abs(first - last) <= 2, `${file} loop seam`);
      else assert.ok(Math.abs(first) <= 1 && Math.abs(last) < 80, `${file} click-free edges`);
    }
    if (cue.startsWith('ambience') || cue === 'tension') assert.equal(channels, 2);
    const hash = createHash('sha256').update(b).digest('hex');
    assert.ok(!hashes.has(hash), `${file} must not duplicate another effect`); hashes.add(hash);
  }
  assert.ok(total < 26 * 1048576, `audio payload budget: ${total}`);
});

test('spatial mixing follows camera orientation, distance, and wall occlusion', () => {
  const listener = {x: 0, z: 0};
  assert.ok(spatialMix({x: 7, z: 0}, listener).pan > 0);
  assert.ok(spatialMix({x: 0, z: 7}, listener).pan < 0);
  const near = spatialMix({x: 3, z: 0}, listener), far = spatialMix({x: 24, z: 0}, listener);
  assert.ok(near.gain > far.gain); assert.ok(near.cutoff > far.cutoff);
  const wall = spatialMix({x: 3, z: 0}, listener, true);
  assert.ok(wall.gain < near.gain && wall.cutoff < near.cutoff);
  assert.equal(spatialMix({x: 40, z: 0}, listener).gain, 0);
});

test('region and threat drive the beds; victory and death suppress threat; low health is separate', () => {
  const safe = ambienceMix({zone: 'ashwick'});
  const road = ambienceMix({zone: 'road', threat: .8});
  assert.ok(safe.ambience > 0 && safe.tension === 0);
  assert.ok(road['ambience-road'] > 0 && road.ambience === 0 && road.tension > 0);
  assert.ok(ambienceMix({zone: 'road', interior: true})['ambience-road'] < ambienceMix({zone: 'road'})['ambience-road']);
  assert.ok(ambienceMix({health: .12}).heartbeat > 0);
  assert.equal(ambienceMix({health: .12, ended: true, threat: 1}).heartbeat, 0);
  assert.equal(ambienceMix({victory: true, threat: 1}).tension, 0);
});

class Param {
  constructor(value = 0) { this.value = value; this.events = []; }
  setValueAtTime(value, time) { this.value = value; this.events.push({value, time}); }
  linearRampToValueAtTime(value, time) { this.value = value; this.events.push({value, time}); }
  setTargetAtTime(value, time) { this.value = value; this.events.push({value, time}); }
  cancelScheduledValues() {}
}
class Node {
  constructor() { for (const key of ['gain', 'frequency', 'pan', 'playbackRate', 'threshold', 'knee', 'ratio', 'attack', 'release']) this[key] = new Param(); }
  connect() {} disconnect() { this.disconnected = true; }
  start(time, offset) { this.started = {time, offset}; }
  stop() { this.onended?.(); }
}
function context() {
  return {currentTime: 0, sampleRate: 48000, state: 'running', destination: new Node(),
    createGain: () => new Node(), createDynamicsCompressor: () => new Node(), createBiquadFilter: () => new Node(),
    createWaveShaper: () => new Node(), createConvolver: () => new Node(), createBufferSource: () => new Node(), createStereoPanner: () => new Node(),
    createBuffer: (channels, length) => ({getChannelData: () => new Float32Array(length)}),
    decodeAudioData: async () => ({duration: 2}),
    async resume() { this.state = 'running'; }, async suspend() { this.state = 'suspended'; }};
}
function engine() {
  const audio = new AudioEngine({random: () => .4}); audio.createGraph(context()); audio.ready = true;
  for (const file of AUDIO_FILES) audio.buffers[file] = {duration: 2};
  return audio;
}

test('shuffle bags cover every take and avoid repeats at bag boundaries', () => {
  const audio = engine(), files = SOUND_BANKS.sword.files, selected = [];
  for (let i = 0; i < 18; i++) selected.push(audio.choose('sword'));
  for (let i = 1; i < selected.length; i++) assert.notEqual(selected[i], selected[i - 1]);
  for (let i = 0; i < selected.length; i += 3) assert.equal(new Set(selected.slice(i, i + 3)).size, files.length);
});

test('combat spam respects voice limits and preserves high priority damage cues', () => {
  const audio = engine();
  for (let n = 0; n < 10; n++) for (const [cue, bank] of Object.entries(SOUND_BANKS)) if (!bank.loop) {
    audio.context.currentTime += 2.1; audio.play(cue);
    assert.ok(audio.voices.size <= MAX_VOICES);
    assert.ok([...audio.voices].filter(voice => voice.cue === cue).length <= bank.voices);
  }
  audio.context.currentTime += 2;
  assert.ok(audio.play('hurt')); assert.ok(audio.voices.size <= MAX_VOICES);
  assert.equal(audio.play('hurt'), null, 'same-frame damage is throttled');
  const played = audio.play('nova'); played.onended();
  assert.ok(played.disconnected, 'finished voices release their graph');
});

test('mute during pause stays muted; UI services remain audible; hidden tabs suspend', async () => {
  const audio = engine(); audio.startBeds(); assert.equal(audio.loops.size, 5);
  audio.pause(true); assert.equal(audio.play('sword'), null);
  assert.equal(audio.worldBus.gain.value, 0, 'paused ambience is fully silent');
  assert.ok(audio.play('heal', .6, 1, {ui: true}));
  audio.toggle(); audio.pause(false); assert.equal(audio.master.gain.value, 0);
  assert.equal(audio.play('impact'), null); audio.toggle();
  assert.equal(audio.master.gain.value, audio.volume);
  assert.equal(audio.loops.size, 5, 'unmuting does not duplicate loops');
  audio.pause(true, true); assert.equal(audio.master.gain.value, 0);
  await new Promise(resolve => setTimeout(resolve, 210)); assert.equal(audio.context.state, 'suspended');
  audio.pause(false, false); await Promise.resolve(); assert.equal(audio.context.state, 'running');
  assert.equal(audio.worldBus.gain.value, 1, 'resuming restores world effects');
});

test('a gesture retries a suspended startup while loading keeps world effects silent', async () => {
  const ctx = context(); ctx.state = 'suspended';
  let resumeCalls = 0, allowStartup;
  const startup = new Promise(resolve => { allowStartup = resolve; });
  ctx.resume = () => {
    if (++resumeCalls === 1) return startup;
    ctx.state = 'running'; allowStartup(); return Promise.resolve();
  };
  const audio = new AudioEngine({contextFactory: () => ctx,
    fetcher: async () => ({ok: true, arrayBuffer: async () => new ArrayBuffer(4)})});
  audio.pause(true);
  const loading = audio.unlock();
  assert.equal(audio.ready, false);
  let musicGestures = 0;
  audio.music = {unlock() { musicGestures++; }, setState() {}};
  const gesture = audio.unlock();
  assert.equal(resumeCalls, 2, 'the gesture resumes immediately instead of waiting on startup');
  assert.equal(musicGestures, 1, 'blocked music retries inside the same gesture');
  await Promise.all([loading, gesture]); await audio.loading;
  assert.equal(audio.ready, true);
  assert.equal(audio.worldBus.gain.value, 0);
  assert.equal(audio.loops.size, 0);
  assert.equal(audio.play('sword'), null);
  audio.pause(false);
  assert.ok(audio.play('sword'));
  assert.equal(audio.loops.size, 5);
});

test('concurrent unlocks share initialization and a failed asset can recover', async () => {
  let contexts = 0, broken = true, requests = 0; const urls = [];
  const audio = new AudioEngine({contextFactory: () => { contexts++; return context(); }, fetcher: async url => {
    requests++; urls.push(new URL(url)); const fail = broken && new URL(url).pathname.endsWith('/sword.wav');
    return {ok: !fail, status: fail ? 503 : 200, arrayBuffer: async () => new ArrayBuffer(4)};
  }});
  const warn = console.warn; console.warn = () => {};
  try { await Promise.all([audio.unlock(), audio.unlock()]); await audio.loading; }
  finally { console.warn = warn; }
  assert.equal(contexts, 1); assert.equal(requests, AUDIO_FILES.length);
  assert.ok(urls.every(url => url.searchParams.get('v') === `${AUDIO_PALETTE.id}-${AUDIO_PALETTE.revision}`), 'replacements bypass cached files from the old palette');
  assert.equal(audio.getState().palette, 'Witchglass');
  assert.equal(audio.ready, true); assert.ok(audio.failed.has('sword'));
  broken = false; await audio.loadFiles([...audio.failed]);
  assert.equal(audio.failed.size, 0); assert.equal(Object.keys(audio.buffers).length, AUDIO_FILES.length);
});

test('every literal gameplay cue exists in the sound palette', async () => {
  const main = await readFile(new URL('../dist/main.js', import.meta.url), 'utf8');
  for (const match of main.matchAll(/(?:audio\.play|audioAt)\('([^']+)'/g)) assert.ok(SOUND_BANKS[match[1]], match[1]);
});
