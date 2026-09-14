import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {MusicPlayer, MUSIC_TRACKS} from '../dist/music.js';
import {AudioEngine} from '../dist/audio.js';

class Param {
  constructor() { this.value = 0; }
  setValueAtTime(value) { this.value = value; }
  setTargetAtTime(value) { this.value = value; }
  linearRampToValueAtTime(value) { this.value = value; }
  cancelScheduledValues() {}
}
class Media {
  constructor() { this.listeners = {}; this.paused = true; this.plays = 0; this.readyState = 3; }
  load() { this.currentTime = 0; this.duration = 30; this.ended = false; }
  addEventListener(event, callback) { this.listeners[event] = callback; }
  emit(event) { this.listeners[event]?.(); }
  play() {
    this.plays++;
    if (this.reject) return Promise.reject(Object.assign(Error(this.reject), {name: this.reject}));
    this.paused = false; return Promise.resolve();
  }
  pause() { this.paused = true; }
  at(time) { this.currentTime = time; this.ended = time >= this.duration; this.emit(this.ended ? 'ended' : 'timeupdate'); }
}
const flush = async () => { for (let i = 0; i < 8; i++) await Promise.resolve(); };
function setup() {
  const context = {currentTime: 0, createGain: () => ({gain: new Param(), connect() {}}),
    createMediaElementSource: () => ({connect() {}})};
  const player = new MusicPlayer(context, {}, {mediaFactory: () => new Media()});
  return player;
}

test('streams two decks, crossfades the full playlist, and wraps to the opening track', async () => {
  const player = setup(); player.unlock(); await flush();
  assert.equal(player.getState().track, 'Balefire');
  assert.equal(player.decks.length, 2);
  assert.equal(player.next.media.paused, true, 'silent spare is primed for mobile autoplay');
  const plays = player.next.media.plays;
  player.unlock(); await flush(); assert.equal(player.next.media.plays, plays, 'gestures do not replay a primed spare');
  const sequence = [];
  for (let n = 0; n < 4; n++) {
    player.current.media.at(26); await flush();
    sequence.push(player.getState().track);
    assert.ok(player.outgoing); assert.equal(player.current.media.paused, false);
    player.current.media.at(2.5);
    assert.equal(player.current.level, .5); assert.equal(player.outgoing.level, .5);
    const previous = player.outgoing;
    player.current.media.at(5); assert.equal(player.outgoing, null);
    assert.equal(previous.media.paused, true); assert.ok(player.next);
  }
  assert.deepEqual(sequence, ['Descent', 'The Old Ones', 'Incantation', 'Balefire']);
});

test('mute, backgrounding, and the separate music switch preserve a partially completed fade', async () => {
  const player = setup(); player.unlock(); await flush();
  player.current.media.at(27); await flush(); player.current.media.at(2);
  for (const state of [{muted: true}, {backgrounded: true}, {enabled: false}]) {
    const current = player.current, outgoing = player.outgoing;
    player.setState(state); assert.ok(player.decks.every(deck => deck.media.paused));
    player.setState({}); await flush();
    assert.equal(player.current, current); assert.equal(player.outgoing, outgoing);
    assert.equal(player.getState().position, 2); assert.equal(player.current.level, .4);
    assert.equal(outgoing.media.paused, false);
  }
  player.setState({paused: true}); assert.equal(player.getState().playing, true, 'menus keep the score playing without restarting it');
});

test('a slow next track waits for playable data without cutting off the current song', async () => {
  const player = setup(); player.unlock(); await flush();
  const opening = player.current; player.next.media.readyState = 1;
  opening.media.at(27); await flush(); assert.equal(player.current, opening);
  opening.media.at(30); await flush(); assert.equal(player.current, opening);
  player.next.media.readyState = 3; player.next.media.emit('canplay'); await flush();
  assert.equal(player.getState().track, 'Descent');
});

test('bad tracks are skipped, exhausted downloads stop, and a gesture can retry', async () => {
  const player = setup(); player.unlock(); await flush();
  player.next.media.emit('error'); assert.equal(player.tracks[player.next.index].id, 'the-old-ones');
  player.current.media.emit('error'); await flush();
  assert.equal(player.getState().track, 'The Old Ones');
  for (let n = 0; n < 4 && player.current; n++) { player.current.media.emit('error'); await flush(); }
  assert.equal(player.failed.size, 4); assert.equal(player.current, null);
  player.setState({}); assert.equal(player.current, null);
  player.unlock(); await flush(); assert.equal(player.getState().track, 'Balefire');
});

test('autoplay denial is retryable and does not mark a licensed asset as broken', async () => {
  const player = setup(); player.decks[0].media.reject = 'NotAllowedError';
  player.unlock(); await flush(); assert.equal(player.blocked, true); assert.equal(player.failed.size, 0);
  player.decks[0].media.reject = null; player.unlock(); await flush();
  assert.equal(player.getState().playing, true); assert.equal(player.blocked, false);
});

test('a failed incoming song restores its outgoing track during a transition', async () => {
  const player = setup(); player.unlock(); await flush();
  const opening = player.current;
  opening.media.at(27); await flush(); player.current.media.emit('error');
  assert.equal(player.current, opening); assert.equal(player.outgoing, null);
  assert.equal(player.tracks[player.next.index].id, 'the-old-ones');
});

test('the music switch does not mute effects and the master sound state reaches music', () => {
  const engine = new AudioEngine(), states = [];
  engine.context = {currentTime: 0}; engine.master = {gain: new Param()}; engine.worldBus = {gain: new Param()};
  engine.music = {setState: state => states.push(state), unlock() {}};
  assert.equal(engine.toggleMusic(), false); assert.equal(engine.muted, false);
  assert.equal(engine.master.gain.value, engine.volume); assert.equal(states.at(-1).enabled, false);
  engine.toggle(); assert.equal(states.at(-1).muted, true);
  engine.toggleMusic(); assert.equal(states.at(-1).muted, true, 'music cannot override master mute');
});

test('the delivered score has complete, attributed, fingerprinted local assets lasting twenty minutes', async () => {
  const root = new URL('../dist/assets/music/', import.meta.url);
  const manifest = JSON.parse(await readFile(new URL('manifest.json', root), 'utf8'));
  const credits = await readFile(new URL('CREDITS.txt', root), 'utf8');
  assert.match(credits, /Scott Buckley/); assert.match(credits, /creativecommons.org\/licenses\/by\/4.0/);
  let duration = 0, bytes = 0;
  for (const track of MUSIC_TRACKS) {
    const info = manifest.tracks.find(item => item.id === track.id);
    const data = await readFile(new URL(`${track.id}.mp3`, root));
    assert.equal(createHash('sha256').update(data).digest('hex'), info.sha256);
    assert.equal(data.length, info.bytes); assert.match(credits, new RegExp(track.title));
    assert.ok(Math.abs(info.duration - track.duration) < .1);
    duration += info.duration; bytes += data.length;
  }
  assert.ok(duration >= 1200 && duration < 1260);
  assert.ok(bytes < 26 * 1048576, 'compressed music does not balloon the game download');
});
