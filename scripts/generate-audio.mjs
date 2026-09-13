import {writeFile, mkdir} from 'node:fs/promises';
import {AUDIO_PALETTE, SOUND_BANKS, AUDIO_FILES} from '../dist/audio-palette.js';
import {renderWitchglass, WITCHGLASS_RATE} from './witchglass.mjs';

// Render the selected 24 kHz audition recipe offline. Ship standard 48 kHz PCM16
// to the existing buffered mixer; no synthesis or review-page code runs in game.
export const AUDIO_RATE = 48000;
export const SOURCE_GAIN = .5 / .56;
const destination = new URL('../dist/assets/audio/', import.meta.url);

export function encodeWitchglass(channels, loop = false) {
  const ratio = AUDIO_RATE / WITCHGLASS_RATE, length = channels[0].length * ratio;
  const bytes = length * channels.length * 2, buffer = Buffer.alloc(44 + bytes);
  buffer.write('RIFF'); buffer.writeUInt32LE(36 + bytes, 4); buffer.write('WAVEfmt ', 8); buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20); buffer.writeUInt16LE(channels.length, 22); buffer.writeUInt32LE(AUDIO_RATE, 24);
  buffer.writeUInt32LE(AUDIO_RATE * channels.length * 2, 28); buffer.writeUInt16LE(channels.length * 2, 32); buffer.writeUInt16LE(16, 34);
  buffer.write('data', 36); buffer.writeUInt32LE(bytes, 40);
  let peak = 0, square = 0, seamDelta = 0;
  for (let i = 0; i < length; i++) for (let c = 0; c < channels.length; c++) {
    const channel = channels[c], position = i / ratio, index = Math.floor(position), fraction = position - index;
    const next = index + 1 < channel.length ? index + 1 : loop ? 0 : index;
    // Linear resampling keeps original samples at even indices; it adds no source detail.
    const value = (channel[index] * (1 - fraction) + channel[next] * fraction) * SOURCE_GAIN;
    const pcm = Math.round(value * 32767);
    buffer.writeInt16LE(pcm, 44 + (i * channels.length + c) * 2);
    const decoded = pcm / 32768; peak = Math.max(peak, Math.abs(decoded)); square += decoded * decoded;
  }
  for (let c = 0; c < channels.length; c++) {
    seamDelta = Math.max(seamDelta, Math.abs(buffer.readInt16LE(44 + c * 2) - buffer.readInt16LE(buffer.length - channels.length * 2 + c * 2)) / 32768);
  }
  return {buffer, duration: length / AUDIO_RATE, channels: channels.length, peakDb: 20 * Math.log10(peak), rmsDb: 10 * Math.log10(square / length / channels.length), seamDelta};
}

export async function generateAudio() {
  await mkdir(destination, {recursive: true}); const report = [];
  for (const [cue, config] of Object.entries(SOUND_BANKS)) {
    for (const [variant, file] of config.files.entries()) {
      const loop = !!config.loop, stereo = loop && cue !== 'heartbeat';
      const channels = Array.from({length: stereo ? 2 : 1}, (_, channel) => renderWitchglass(cue, {variant, loop, channel}));
      const {buffer, ...metrics} = encodeWitchglass(channels, loop);
      await writeFile(new URL(`${file}.wav`, destination), buffer);
      report.push({cue, file, variant, bytes: buffer.length, loop, ...metrics});
    }
  }
  const manifest = {version: AUDIO_PALETTE.revision, palette: AUDIO_PALETTE.name, auditionSet: '04', sourceSampleRate: WITCHGLASS_RATE, sampleRate: AUDIO_RATE, format: 'PCM16', files: report};
  await writeFile(new URL('manifest.json', destination), JSON.stringify(manifest, null, 2) + '\n');
  await writeFile(new URL('CREDITS.txt', destination), `Hallowmere — Witchglass audio palette v3

Selected direction: Witchglass (sound audition set 04).
Sound design and synthesis: original Hallowmere workshop.
Crystal FM, inharmonic fragments, liquid chimes, and short reflections.
All 79 active effects and ambience files are original synthesized material.
No recorded samples or third-party effects are used by this palette.

Source: scripts/witchglass.mjs and scripts/generate-audio.mjs.
24 kHz synthesis resampled to 48 kHz PCM16 for delivery.
The historical Kenney CC0 source archive and its licenses are retained in
scripts/audio-sources/; those recordings are not in the active Witchglass assets.
Rebuild with npm run generate:audio.
`);
  console.log(`Generated ${AUDIO_FILES.length} Witchglass sounds (${(report.reduce((n, f) => n + f.bytes, 0) / 1048576).toFixed(1)} MiB).`);
  return report;
}
if (process.argv[1] && new URL(process.argv[1], 'file:').href === import.meta.url) await generateAudio();
