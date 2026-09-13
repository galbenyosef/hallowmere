import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {runInNewContext} from 'node:vm';
import {AUDIO_PALETTE, SOUND_BANKS, AUDIO_FILES} from '../dist/audio-palette.js';
import {renderWitchglass, WITCHGLASS_RATE, WITCHGLASS_CUES, WITCHGLASS_LOOPS} from '../scripts/witchglass.mjs';
import {encodeWitchglass, SOURCE_GAIN} from '../scripts/generate-audio.mjs';

const directory = new URL('../dist/assets/audio/', import.meta.url);
test('active Witchglass assets cover every game cue with the existing take counts and quiet background mix', async () => {
  const manifest = JSON.parse(await readFile(new URL('manifest.json', directory), 'utf8'));
  assert.equal(AUDIO_PALETTE.name, 'Witchglass');
  assert.equal(manifest.version, AUDIO_PALETTE.revision);
  assert.equal(manifest.palette, 'Witchglass'); assert.equal(manifest.auditionSet, '04');
  assert.equal(manifest.sourceSampleRate, WITCHGLASS_RATE);
  assert.equal(manifest.files.length, AUDIO_FILES.length);
  assert.deepEqual(Object.keys(WITCHGLASS_CUES).sort(), Object.keys(SOUND_BANKS).sort());
  for (const [cue, bank] of Object.entries(SOUND_BANKS)) {
    const files = manifest.files.filter(file => file.cue === cue);
    assert.deepEqual(files.map(file => file.file), bank.files);
    assert.ok(bank.wet <= .14, `${cue}: leave room for the source's crystal reflections`);
    for (const [variant, file] of files.entries()) {
      assert.equal(file.variant, variant); assert.equal(file.loop, !!bank.loop);
      if (bank.loop) assert.equal(file.duration, WITCHGLASS_LOOPS[cue]);
    }
  }
  for (const cue of ['ambience', 'ambience-road', 'ambience-haunted']) assert.equal(SOUND_BANKS[cue].gain, .42 / 3);
  assert.equal(SOUND_BANKS.tension.gain, .32 / 3);
  assert.equal(SOUND_BANKS.heartbeat.gain, .4);
});

test('first takes retain the selected audition recipe, and shipped effects contain that PCM', async () => {
  const html = await readFile(new URL('../dist/sound-audition.html', import.meta.url), 'utf8');
  const scope = {};
  runInNewContext(html.match(/<script id="audition-engine">([\s\S]*?)<\/script>/)[1], scope);
  for (const [cue, bank] of Object.entries(SOUND_BANKS)) {
    const reference = scope.SoundAudition.synthesize('04', cue).data;
    const actual = renderWitchglass(cue);
    assert.equal(actual.length, reference.length);
    let difference = 0;
    for (let i = 0; i < reference.length; i++) difference = Math.max(difference, Math.abs(actual[i] - reference[i]));
    assert.ok(difference < 1e-7, `${cue}: selected sound changed by ${difference}`);
    if (!bank.loop) {
      const shipped = await readFile(new URL(`${bank.files[0]}.wav`, directory));
      assert.deepEqual(encodeWitchglass([actual]).buffer, shipped, `${cue}: generator and shipped asset agree`);
      for (let i = 0; i < actual.length; i++) {
        const encoded = shipped.readInt16LE(44 + i * 4) / 32767;
        assert.ok(Math.abs(encoded - reference[i] * SOURCE_GAIN) < .000016, `${cue}: resampling preserves the chosen samples`);
      }
    }
  }
});

test('continuous Witchglass beds have stereo motion and do not dip to silence at the loop boundary', async () => {
  for (const cue of ['ambience', 'ambience-road', 'ambience-haunted', 'tension']) {
    const wav = await readFile(new URL(`${cue}.wav`, directory));
    const frames = (wav.length - 44) / 4, edgeFrames = 4800;
    let leftSquare = 0, rightSquare = 0, product = 0, edgeSquare = 0;
    for (let i = 0; i < frames; i++) {
      const left = wav.readInt16LE(44 + i * 4) / 32768, right = wav.readInt16LE(46 + i * 4) / 32768;
      leftSquare += left * left; rightSquare += right * right; product += left * right;
      if (i < edgeFrames || i >= frames - edgeFrames) edgeSquare += left * left + right * right;
    }
    assert.ok(Math.abs(product / Math.sqrt(leftSquare * rightSquare)) < .95, `${cue}: independent stereo motion`);
    assert.ok(edgeSquare / (edgeFrames * 4) > (leftSquare + rightSquare) / (frames * 2) * .1, `${cue}: no artificial seam silence`);
  }
});
