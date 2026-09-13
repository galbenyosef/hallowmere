# Witchglass — selected game audio

Implemented September 13, 2026 after the user selected **set 04, Witchglass**, from the [sound audition](../dist/sound-audition.html).

The active game now uses 79 Witchglass WAV assets across all 37 cue IDs. Crystal FM, inharmonic fragments, liquid chimes, and short reflections give weapon swings, impacts, spells, creatures, player actions, rewards, menus, footsteps, and world details the selected character. The soundtrack is unchanged.

## From audition to gameplay

- First takes use the original audition's 24 kHz synthesis recipe. Tests compare every cue against the preserved audition and compare shipped one-shots against the generator. Delivery uses linear resampling to the existing 48 kHz PCM16 format and a uniform gain of `0.5 / 0.56`, preserving six decibels of source headroom. Resampling does not add source detail.
- Existing banks retain their take counts. Additional takes change resonance, FM depth, fragment rhythm, excitation seed, and small pitch offsets. The existing shuffle bags prevent immediate repetition.
- The short ambience excerpts become continuous stereo beds: Ashwick 18 seconds, road 21 seconds, haunted 25 seconds, and threat 14 seconds. A 5.1-second mono heartbeat loop preserves the sketch's 0.85-second pulse cadence. Overlap crossfades and endpoint correction prevent a silent reset or click at each wrap.
- Generated one-shots retain the selected short reflections. The shared room send is 35% of the old send to keep crystal attacks clear. Cue gains, priorities, cooldowns, voice budgets, spatial placement, occlusion, and the quieter background settings are preserved. In particular, the four background beds remain at one-third of the original mix level; heartbeat gain is unchanged.
- Asset requests include `?v=witchglass-3`, preventing reuse of cached effects from the old palette. The game loads and decodes WAVs as before; no synthesis or audition-page code executes during gameplay.

The 79-file bank is 24.8 MiB. All active assets are original synthesis. The older CC0 recordings and their licenses are retained in `scripts/audio-sources/` as historical source material; Witchglass does not use them. Current credits and per-file measurements are in `dist/assets/audio/`.

## Rebuild and verify

Run `npm run generate:audio` with Node 22 or newer. `npm run generate` also invokes the same Witchglass generator. The source is `scripts/witchglass.mjs`; WAV delivery and inventory generation are in `scripts/generate-audio.mjs`. Runtime mixer settings live in `dist/audio-palette.js`.

`npm test` covers the selected reference, shipped assets, variant uniqueness, PCM limits, loop boundaries, stereo motion, retained background gains, versioned requests, shuffle bags, voice limits, and mute/pause/recovery. `npm run build` validates scripts and site references.

The running game decoded all 79 versioned Witchglass files without failures, retained the music setting, and preserved mute through pause/resume. A [29-second preview](witchglass-preview.wav) was rendered through the actual `AudioEngine` graph in Chrome's `OfflineAudioContext`, with footsteps, combat, healing, changing ambience/threat, the Bellkeeper, and a relic. Music is omitted from this effects preview. Peak output was **−11.17 dBFS**, RMS was **−32.11 dBFS**, and there were **zero clipped samples**. [Render measurements](witchglass-render-review.json) record the mixer and live-loading checks.
