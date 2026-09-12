import {readFile, writeFile, mkdir} from 'node:fs/promises';
import {SOUND_BANKS, AUDIO_FILES} from '../dist/audio-palette.js';

// Offline sound workshop. All source PCM is checked in; regeneration needs only Node.
const RATE = 48000, TAU = Math.PI * 2;
const destination = new URL('../dist/assets/audio/', import.meta.url);
const sources = new Map();
const frame = seconds => Math.round(seconds * RATE);
const clip = seconds => new Float32Array(frame(seconds));
const clamp = (v, lo = 0, hi = 1) => Math.max(lo, Math.min(hi, v));
function random(seed) { return () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296); }
function hash(name) { let h = 8147; for (const c of name) h = Math.imul(h ^ c.charCodeAt(0), 16777619); return h >>> 0; }
function envelope(t, duration, attack = .012, release = .1) {
  return clamp(t / attack) * clamp((duration - t) / release);
}
async function source(name) {
  if (sources.has(name)) return sources.get(name);
  const wav = await readFile(new URL(`audio-sources/${name}.wav`, import.meta.url));
  let dataOffset = 0, size = 0;
  for (let offset = 12; offset < wav.length;) {
    const length = wav.readUInt32LE(offset + 4);
    if (wav.toString('ascii', offset, offset + 4) === 'data') { dataOffset = offset + 8; size = length; break; }
    offset += 8 + length + (length % 2);
  }
  if (!dataOffset) throw Error(`Invalid source: ${name}`);
  let samples = Float32Array.from({length: size / 2}, (_, i) => wav.readInt16LE(dataOffset + i * 2) / 32768);
  let first = 0, last = samples.length - 1, peak = 0;
  for (const v of samples) peak = Math.max(peak, Math.abs(v));
  while (first < last && Math.abs(samples[first]) < peak * .006) first++;
  while (last > first && Math.abs(samples[last]) < peak * .003) last--;
  samples = samples.slice(Math.max(0, first - 160), Math.min(samples.length, last + 800));
  for (let i = 0; i < samples.length; i++) samples[i] *= .78 / Math.max(.01, peak);
  sources.set(name, samples); return samples;
}
function read(samples, position) {
  const index = Math.floor(position), mix = position - index;
  return index < 0 || index >= samples.length - 1 ? 0 : samples[index] * (1 - mix) + samples[index + 1] * mix;
}
function layer(out, samples, {at = 0, rate = 1, gain = 1, cutoff = 16000, reverse = false, duration = Infinity} = {}) {
  const start = frame(at), length = Math.min(out.length - start, Math.ceil(samples.length / rate), frame(duration));
  const alpha = 1 - Math.exp(-TAU * cutoff / RATE); let filtered = 0;
  for (let i = 0; i < length; i++) {
    const position = reverse ? samples.length - 2 - i * rate : i * rate;
    filtered += alpha * (read(samples, position) - filtered);
    out[start + i] += filtered * gain * envelope(i / RATE, length / RATE, .002, .025);
  }
}
function noise(out, rng, {gain = 1, low = 120, high = 4500, env = () => 1} = {}) {
  const a = 1 - Math.exp(-TAU * high / RATE), b = 1 - Math.exp(-TAU * low / RATE);
  let lp = 0, hp = 0;
  for (let i = 0; i < out.length; i++) {
    lp += a * (rng() * 2 - 1 - lp); hp += b * (lp - hp);
    out[i] += (lp - hp) * gain * env(i / RATE, i / out.length);
  }
}
function tone(out, frequency, gain, decay, {at = 0, fall = 0, attack = .006, vibrato = 0} = {}) {
  let phase = 0;
  for (let i = frame(at); i < out.length; i++) {
    const t = i / RATE - at;
    phase += TAU * (frequency * Math.exp(-fall * t) + vibrato * Math.sin(TAU * 3.7 * t)) / RATE;
    out[i] += Math.sin(phase) * gain * Math.exp(-decay * t) * clamp(t / attack);
  }
}
function grains(out, samples, rng, {gain = .2, rate = .4, hop = .063, size = .18, env = () => 1} = {}) {
  for (let at = 0; at < out.length; at += frame(hop * (.85 + rng() * .3))) {
    const offset = rng() * Math.max(1, samples.length - frame(size) * rate);
    for (let i = 0, n = frame(size); i < n && at + i < out.length; i++) {
      const window = Math.sin(Math.PI * i / n) ** 2;
      out[at + i] += read(samples, offset + i * rate) * window * gain * env((at + i) / RATE);
    }
  }
}
function echo(out, taps = [[.073, .13], [.137, .075], [.211, .045]]) {
  const dry = out.slice();
  for (const [delay, gain] of taps) for (let i = frame(delay); i < out.length; i++) out[i] += dry[i - frame(delay)] * gain;
}
async function creature(type, duration, rng, dying = false) {
  const out = clip(duration), base = {hollow: 88, hound: 63, revenant: 112, boss: 42, player: 103}[type];
  const env = t => Math.sin(Math.PI * clamp(t / duration)) ** .7 * (1 - .55 * t / duration);
  grains(out, await source(`creak${1 + Math.floor(rng() * 3)}`), rng,
    {rate: type === 'revenant' ? .75 : .32, gain: .5, size: .14, hop: .052, env});
  let phase = 0;
  for (let i = 0; i < out.length; i++) {
    const t = i / RATE, u = t / duration;
    phase += TAU * (base * (1 - (dying ? .48 : .16) * u) + Math.sin(t * 31) * 4 + Math.sin(t * 53) * 2) / RATE;
    // Uneven glottal pulses, formant emphasis, and throat flutter avoid a pure synth growl.
    let voice = 0;
    for (let h = 1; h <= 14; h++) {
      const f = h * base;
      const formant = .25 + Math.exp(-(((f - 480) / 260) ** 2)) + .6 * Math.exp(-(((f - 1350) / 430) ** 2));
      voice += Math.sin(phase * h + .12 * Math.sin(t * 41)) * formant / (h ** .9);
    }
    out[i] += Math.tanh(voice * 1.7) * .2 * env(t) * (.72 + .28 * Math.sin(t * (type === 'hound' ? 97 : 47)) ** 2);
  }
  noise(out, rng, {gain: .28, low: 440, high: type === 'revenant' ? 5800 : 2400, env});
  if (dying) layer(out, await source('chop'), {at: .025, rate: .65, gain: .5, cutoff: 2400});
  echo(out); return out;
}
async function effect(cue, variant, rng) {
  let out; const n = variant;
  if (cue === 'sword') {
    out = clip(.62); layer(out, await source(n % 2 ? 'knifeSlice2' : 'knifeSlice'), {gain: .72, rate: .7 + n * .065});
    layer(out, await source(n % 2 ? 'drawKnife1' : 'drawKnife2'), {at: .035, gain: .23, rate: .72, cutoff: 7600, duration: .28});
    noise(out, rng, {gain: .55, low: 320, high: 6500, env: t => Math.exp(-(((t - .095) / .055) ** 2))});
    tone(out, 185, .16, 18, {fall: 4});
  } else if (cue === 'impact' || cue === 'boss-slam') {
    const boss = cue === 'boss-slam'; out = clip(boss ? 2 : .63);
    layer(out, await source(`impactPunch_heavy_00${n % 3}`), {gain: .85, rate: boss ? .52 : .78 + n * .045});
    layer(out, await source(`impactMetal_heavy_00${n % 2}`), {gain: .25, at: .008, rate: .7, cutoff: 6600});
    layer(out, await source('chop'), {gain: .45, at: .013, rate: .85, cutoff: 4300});
    tone(out, boss ? 76 : 136, boss ? .55 : .27, boss ? 3 : 20, {fall: boss ? 1.8 : 7});
    if (boss) { grains(out, await source('impactWood_heavy_000'), rng, {gain: .33, rate: .5, env: t => Math.exp(-t * 3)}); echo(out); }
  } else if (['ember', 'ember-hit', 'nova'].includes(cue)) {
    const nova = cue === 'nova', hit = cue === 'ember-hit'; out = clip(nova ? 2.8 : hit ? 1.05 : 1.25);
    const burst = t => (1 - Math.exp(-t * 70)) * Math.exp(-t * (nova ? 2.3 : 5));
    noise(out, rng, {gain: 1.1, low: 100, high: nova ? 8200 : 6500, env: burst});
    noise(out, rng, {gain: .4, low: 1400, high: 12000, env: t => burst(t) * (.3 + .7 * Math.sin(t * 173) ** 12)});
    grains(out, await source('footstep_grass_000'), rng, {gain: .35, rate: .7, env: burst});
    tone(out, nova ? 92 : 153, nova ? .48 : .3, nova ? 2.9 : 8, {fall: 2.5});
    tone(out, nova ? 179 : 309, .12, 4, {fall: 1.8, vibrato: 7});
    if (hit || nova) layer(out, await source('impactWood_heavy_001'), {rate: .66, gain: .5, cutoff: 4200});
    echo(out, [[.111, .17], [.193, .09], [.311, .06]]);
  } else if (cue === 'dodge') {
    out = clip(.55); layer(out, await source(n ? 'cloth2' : 'cloth1'), {gain: .95, rate: 1.12});
    noise(out, rng, {gain: .65, low: 270, high: 4300, env: t => Math.exp(-(((t - .075) / .045) ** 2))});
    layer(out, await source('handleSmallLeather'), {at: .09, gain: .18, rate: .9, duration: .2});
  } else if (cue === 'hurt') {
    out = await creature('player', .6, rng);
    layer(out, await source(`impactPunch_heavy_00${n % 3}`), {gain: .52, rate: .85, cutoff: 2600});
  } else if (cue.startsWith('death')) {
    const type = cue === 'death' ? 'hollow' : cue.slice(6);
    out = await creature(type, type === 'boss' ? 4.6 : type === 'player' ? 2.8 : 1.5, rng, true);
    if (type === 'boss' || type === 'player') { tone(out, 49, .26, 1.3, {fall: .24}); echo(out, [[.19, .2], [.37, .12], [.61, .07]]); }
  } else if (cue === 'roar' || cue.startsWith('voice-')) {
    out = await creature(cue === 'roar' ? 'boss' : cue.slice(6), cue === 'roar' ? 2.9 : 1.05 + n * .11, rng);
    if (cue === 'roar') tone(out, 62, .24, 1.8, {fall: .5});
  } else if (cue === 'heal') {
    out = clip(1.9);
    layer(out, await source('impactGlass_light_000'), {gain: .3, rate: .7, cutoff: 6800, duration: .3});
    for (let i = 0; i < 11; i++) tone(out, 260 + rng() * 480, .09, 36, {at: .12 + i * .045, fall: -4});
    noise(out, rng, {gain: .2, low: 900, high: 4200, env: t => Math.exp(-(((t - .62) / .38) ** 2))});
    for (const [i, f] of [196, 233.08, 293.66, 587.33].entries()) tone(out, f, .1 / (1 + i * .2), 2.8, {at: .24, attack: .2, vibrato: .65});
    echo(out);
  } else if (cue === 'pickup') {
    out = clip(.8); layer(out, await source(n % 2 ? 'handleCoins2' : 'handleCoins'), {gain: .9, rate: .8 + n * .06, cutoff: 8700, duration: .63});
    tone(out, 1568, .045, 14);
  } else if (cue === 'equip') {
    out = clip(.8); layer(out, await source(n ? 'drawKnife2' : 'drawKnife1'), {gain: .7, rate: .83, cutoff: 8000});
    layer(out, await source('metalLatch'), {at: .14, gain: .5, rate: .8});
    layer(out, await source('handleSmallLeather'), {gain: .3, duration: .35});
  } else if (cue === 'relic' || cue === 'levelup') {
    out = clip(cue === 'relic' ? 3.5 : 2.6);
    layer(out, await source('impactBell_heavy_000'), {rate: .55, gain: .2, cutoff: 4800});
    for (const [i, f] of [146.83, 220, 261.63, 440].entries()) tone(out, f, .18 / (1 + i * .28), 1.8, {at: .08 + i * .09, attack: .13});
    noise(out, rng, {gain: .22, low: 450, high: 4100, env: t => Math.exp(-(((t - .32) / .2) ** 2))});
    echo(out, [[.13, .22], [.27, .15], [.49, .08]]);
  } else if (cue.startsWith('ui-')) {
    out = clip(.55); layer(out, await source(cue === 'ui-open' ? 'bookOpen' : 'bookClose'), {gain: .8, rate: .85, cutoff: 5600, duration: .48});
    layer(out, await source('metalLatch'), {at: .03, gain: .1, duration: .25});
  } else if (cue.startsWith('step')) {
    const surface = cue === 'step' ? 'concrete' : cue === 'step-dirt' ? 'grass' : 'wood';
    out = clip(.43); layer(out, await source(`footstep_${surface}_00${n}`), {rate: .84 + n * .015, gain: .9, cutoff: 7600, duration: .4});
    layer(out, await source(n % 2 ? 'cloth1' : 'cloth2'), {gain: .12, at: .01, rate: 1.2, duration: .23, cutoff: 4500});
    tone(out, surface === 'wood' ? 170 : 116, .06, 32, {fall: 3});
  } else if (cue === 'bell') {
    out = clip(6.8); layer(out, await source('impactBell_heavy_000'), {gain: .48, rate: .35 + n * .03, cutoff: 6500});
    for (const [i, ratio] of [1, 2.013, 2.731, 4.071, 5.43, 6.81].entries()) tone(out, (73.42 + n * 1.1) * ratio, .27 / (1 + i * .8), .62 + i * .22, {vibrato: .16});
    echo(out, [[.17, .16], [.31, .11], [.53, .08]]);
  } else if (cue === 'boss-windup') {
    out = clip(1.1); grains(out, await source('creak2'), rng, {rate: .32, gain: .7, env: t => Math.sin(Math.PI * clamp(t / 1.1)) ** .7});
    layer(out, await source('impactBell_heavy_000'), {reverse: true, gain: .4, rate: 1.2, duration: .8});
    tone(out, 86, .2, .7, {fall: -.28, attack: .08});
  } else if (cue === 'door' || cue === 'creak') {
    out = clip(cue === 'door' ? 2.2 : 3.4);
    layer(out, await source(cue === 'door' ? `doorOpen_${1 + n % 2}` : `creak${1 + n}`), {rate: cue === 'door' ? .72 : .42, gain: .8, cutoff: 4600});
    if (cue === 'door') layer(out, await source('doorClose_1'), {at: .48, rate: .65, gain: .28, duration: .65, cutoff: 3400});
    echo(out);
  } else if (cue === 'whisper') {
    out = clip(3 + n * .4); const duration = out.length / RATE;
    const env = t => Math.sin(Math.PI * t / duration) ** 1.8 * (.4 + .6 * Math.sin(t * (8 + n)) ** 2);
    noise(out, rng, {gain: .6, low: 1100, high: 3400, env});
    noise(out, rng, {gain: .32, low: 320, high: 850, env});
    grains(out, await source('creak3'), rng, {gain: .26, rate: .6, env}); echo(out);
  } else throw Error(`No sound recipe: ${cue}`);
  return [out];
}
function seam(samples, seconds = 1.5) {
  const overlap = frame(seconds), length = samples.length - overlap;
  const out = new Float32Array(length);
  out.set(samples.subarray(overlap, length));
  for (let i = 0; i < overlap; i++) {
    const x = i / (overlap - 1), fade = .5 - .5 * Math.cos(Math.PI * x);
    out[length - overlap + i] = samples[length + i] * (1 - fade) + samples[i] * fade;
  }
  // Match the endpoint without a silence dip; a 5 ms correction preserves the wind bed.
  const delta = out[length - 1] - out[0], blend = frame(.005);
  for (let i = 0; i < blend; i++) {
    const x = i / (blend - 1); out[length - blend + i] -= delta * x * x * (3 - 2 * x);
  }
  return out;
}
async function ambience(cue, rng) {
  if (cue === 'heartbeat') {
    const out = clip(1.15);
    tone(out, 71, .45, 28, {at: .07, fall: 3}); tone(out, 88, .26, 32, {at: .24, fall: 3});
    return [out];
  }
  const duration = {ambience: 18, 'ambience-road': 21, 'ambience-haunted': 25, tension: 14}[cue];
  const haunted = cue === 'ambience-haunted', tense = cue === 'tension';
  const channels = [clip(duration), clip(duration)];
  const creak = await source(haunted ? 'creak3' : 'creak1');
  for (const [c, out] of channels.entries()) {
    noise(out, rng, {gain: .55, low: 65, high: 950, env: t => .55 + .2 * Math.sin(t * .43 + c * .8) + .18 * Math.sin(t * .91 + c)});
    noise(out, rng, {gain: .09, low: 1500, high: 5000, env: t => .4 + .3 * Math.sin(t * .71 + c * 1.8)});
    grains(out, creak, rng, {gain: haunted ? .09 : .035, rate: .16, size: .4, hop: .17, env: t => .5 + .5 * Math.sin(t * .27 + c * .7)});
    // Slowly beating inharmonic resonances are buried in the moving air texture.
    const notes = tense ? [49, 73.8, 104.1, 155.7] : haunted ? [55, 82.6, 116.3] : [73.42, 110.1, 146.7];
    for (const [j, f] of notes.entries()) {
      let phase = rng() * TAU;
      for (let i = 0; i < out.length; i++) {
        const t = i / RATE;
        phase += TAU * (f + c * .13 + .16 * Math.sin(t * .63 + j)) / RATE;
        out[i] += Math.sin(phase) * (tense ? .043 : .016) * (.55 + .45 * Math.sin(t * .31 + j + c * .4) ** 2);
      }
    }
    if (cue === 'ambience') noise(out, rng, {gain: .13, low: 700, high: 7200, env: t => .2 + .8 * Math.sin(t * 21) ** 16});
    if (tense) noise(out, rng, {gain: .17, low: 450, high: 2800, env: t => .4 + .6 * Math.sin(t * 2.1 + c * .2) ** 4});
  }
  return channels.map(out => seam(out));
}
function encode(channels, loop) {
  const length = channels[0].length; let peak = 0;
  for (const channel of channels) {
    let sum = 0; for (const v of channel) sum += v;
    const mean = sum / length;
    for (let i = 0; i < length; i++) {
      channel[i] = Math.tanh((channel[i] - mean) * 1.12) / 1.12;
      if (!loop) channel[i] *= envelope(i / RATE, length / RATE, .004, .09);
      peak = Math.max(peak, Math.abs(channel[i]));
    }
  }
  // Leave six dB of source headroom; no hard clipping or per-file loudness inflation.
  const gain = Math.min(1, .5 / Math.max(.001, peak));
  const bytes = length * channels.length * 2, b = Buffer.alloc(44 + bytes);
  b.write('RIFF'); b.writeUInt32LE(36 + bytes, 4); b.write('WAVEfmt ', 8); b.writeUInt32LE(16, 16);
  b.writeUInt16LE(1, 20); b.writeUInt16LE(channels.length, 22); b.writeUInt32LE(RATE, 24);
  b.writeUInt32LE(RATE * channels.length * 2, 28); b.writeUInt16LE(channels.length * 2, 32); b.writeUInt16LE(16, 34);
  b.write('data', 36); b.writeUInt32LE(bytes, 40);
  let square = 0, seamDelta = 0;
  for (const ch of channels) seamDelta = Math.max(seamDelta, Math.abs(ch[0] - ch[length - 1]) * gain);
  for (let i = 0; i < length; i++) for (let c = 0; c < channels.length; c++) {
    const v = channels[c][i] * gain; square += v * v; b.writeInt16LE(Math.round(v * 32767), 44 + (i * channels.length + c) * 2);
  }
  return {buffer: b, duration: length / RATE, channels: channels.length, peakDb: 20 * Math.log10(peak * gain), rmsDb: 20 * Math.log10(Math.sqrt(square / length / channels.length)), seamDelta};
}
export async function generateAudio() {
  await mkdir(destination, {recursive: true}); const report = [];
  for (const [cue, config] of Object.entries(SOUND_BANKS)) {
    for (const [variant, file] of config.files.entries()) {
      const rng = random(hash(file));
      const channels = config.loop ? await ambience(cue, rng) : await effect(cue, variant, rng);
      const {buffer, ...metrics} = encode(channels, config.loop);
      await writeFile(new URL(`${file}.wav`, destination), buffer);
      report.push({cue, file, bytes: buffer.length, loop: !!config.loop, ...metrics});
    }
  }
  await writeFile(new URL('manifest.json', destination), JSON.stringify({version: 2, sampleRate: RATE, format: 'PCM16', files: report}, null, 2) + '\n');
  await writeFile(new URL('CREDITS.txt', destination), 'Hallowmere — The Ashen Vigil: audio palette v2\n\nSound design and synthesis: original Hallowmere workshop.\nRecorded source material: Kenney, Impact Sounds (2019) and RPG Audio (2014).\nLicense: Creative Commons Zero (CC0 1.0).\nhttps://kenney.nl/assets/impact-sounds\nhttps://kenney.nl/assets/rpg-audio\nhttps://creativecommons.org/publicdomain/zero/1.0/\n\nSources were edited, layered, filtered, pitch shifted, and granulated.\nDetailed provenance and publisher license text: scripts/audio-sources/.\nRebuild with npm run generate:audio.\n');
  console.log(`Generated ${AUDIO_FILES.length} sounds (${(report.reduce((n, f) => n + f.bytes, 0) / 1048576).toFixed(1)} MiB).`);
  return report;
}
if (process.argv[1] && new URL(process.argv[1], 'file:').href === import.meta.url) await generateAudio();
