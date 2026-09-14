import {readFile} from 'node:fs/promises';

// Kenney Impact Sounds, CC0. Four distinct boot contacts per surface.
export const FOOTSTEP_SURFACES = {step: 'concrete', 'step-dirt': 'grass', 'step-wood': 'wood'};
export const FOOTSTEP_RATE = 48000;

export async function renderFootstep(cue, variant = 0) {
  const surface = FOOTSTEP_SURFACES[cue];
  if (!surface || !Number.isInteger(variant) || variant < 0 || variant > 3) throw Error(`Unknown footstep: ${cue}/${variant}`);
  const source = `footstep_${surface}_${String(variant).padStart(3, '0')}.wav`;
  const wav = await readFile(new URL(`./audio-sources/${source}`, import.meta.url));
  if (wav.toString('ascii', 0, 4) !== 'RIFF' || wav.toString('ascii', 8, 12) !== 'WAVE') throw Error(`Invalid WAV: ${source}`);
  let pcm, validFormat = false;
  for (let offset = 12; offset + 8 <= wav.length;) {
    const tag = wav.toString('ascii', offset, offset + 4), size = wav.readUInt32LE(offset + 4), start = offset + 8;
    if (start + size > wav.length) throw Error(`Truncated WAV: ${source}`);
    if (tag === 'fmt ') validFormat = size >= 16 && wav.readUInt16LE(start) === 1 && wav.readUInt16LE(start + 2) === 1 && wav.readUInt32LE(start + 4) === FOOTSTEP_RATE && wav.readUInt16LE(start + 14) === 16;
    if (tag === 'data') pcm = wav.subarray(start, start + size);
    offset = start + size + size % 2;
  }
  if (!validFormat || !pcm?.length || pcm.length % 2) throw Error(`Expected mono 48 kHz PCM16: ${source}`);
  const samples = new Float32Array(Math.min(pcm.length / 2, Math.round(FOOTSTEP_RATE * .42)));
  const lowpass = 1 - Math.exp(-2 * Math.PI * 4800 / FOOTSTEP_RATE), highpass = Math.exp(-2 * Math.PI * 55 / FOOTSTEP_RATE);
  let low = 0, high = 0, previous = 0, peak = 0;
  for (let i = 0; i < samples.length; i++) {
    const input = pcm.readInt16LE(i * 2) / 32768;
    high = highpass * (high + input - previous); previous = input;
    low += lowpass * (high - low);
    // Keep the sole's attack and material texture; soften clicks and long scuffs.
    const fade = Math.min(1, i / (FOOTSTEP_RATE * .002), (samples.length - 1 - i) / (FOOTSTEP_RATE * .025));
    samples[i] = low * fade; peak = Math.max(peak, Math.abs(samples[i]));
  }
  if (!peak) throw Error(`Silent footstep: ${source}`);
  for (let i = 0; i < samples.length; i++) samples[i] *= .42 / peak;
  return {channels: [samples], source};
}
