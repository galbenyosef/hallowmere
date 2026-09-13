# Sound direction audition

Open [the standalone audition page](../dist/sound-audition.html) directly in a browser, or visit `/sound-audition.html` on the game's local development server. No external assets, packages, network requests, or game session are needed by the page. Audio begins after a playback click.

All ten sets cover the 37 IDs in `dist/audio-palette.js`. They are **synthesized direction sketches**, not replacements for the current recorded/processed game bank. No winning direction is assumed. No gameplay files, audio assets, mixer settings, or music are changed.

| Set | Direction | Sound construction |
| --- | --- | --- |
| 01 | Worn Iron | Damped steel resonances and coarse friction; dry contact |
| 02 | Cathedral Bells | Inharmonic bronze modes, beating overtones, long reflections |
| 03 | Bone & Hide | Membrane pitch falls, hollow wood modes, short rattling impulses |
| 04 | Witchglass | High inharmonic FM, shivering fragments, scattered reflections |
| 05 | Black Powder | Saturated pressure noise, sub punches, debris transients |
| 06 | Mire & Mouth | Nonlinear vowel-like carriers, falling droplets, bubbling modulation |
| 07 | Stormbound | Chopped buzz, electrical FM, narrow noise sparks |
| 08 | Velvet Dread | Bowed fades, detuned low tones, breath, diffuse echoes |
| 09 | Runic Arcade | Pulse/triangle oscillators, quantized arpeggios, sample-held noise |
| 10 | Clockwork Crypt | Spring plucks, inharmonic ticks, decelerating ratchets |

The same event gestures give each model swings, collisions, rising casts, falling deaths, creature voices, reward figures, and atmosphere. These directions vary excitation, spectrum, modulation, attack, and decay rather than only playback pitch. Fixed seeds and common category RMS targets make replay comparisons consistent. A source peak cap preserves headroom; a shared compressor handles encounter overlap. These are comparable preview levels, not a claim of perceptual loudness equivalence.

Coverage: 5 combat, 4 player, 6 creature, 4 Bellkeeper, 6 reward/menu, 7 movement/world, and 5 finite atmosphere/health excerpts. The 26-second encounter uses identical timing and levels across sets, with 23 events from road ambience and footsteps through combat, healing, a boss encounter, and relic pickup. The cue sheet is expandable on the page.

Use **Compare cue** to set every card's comparison button. Each card also has four quick cues and all 37 labeled buttons under **Browse all 37 effects**. Starting playback replaces the previous cue or encounter. **Stop**, **Escape**, hiding the tab, or leaving the page cancels current and scheduled sounds, including baked reflections. Volume affects current and future playback; zero mutes it. No infinite loops play.

**Choose** stores a preference only in this browser (when local storage is available) and reveals a copyable response such as `My sound direction: Set 02 — Cathedral Bells.` Clipboard failure falls back to selecting the text. Send that line back in chat, optionally specifying a mix of sets. Selection never changes gameplay.

`tests/sound-audition.test.mjs` checks live cue parity, all 370 renders, signal bounds, deterministic replay, complete sequence timing, resource cleanup, volume, interrupted initialization, rapid replacement, completion, and unavailable audio. Standard repository validation remains `npm test` and `npm run build`.

Browser verification also exercised the actual page controls and checked 1280px desktop and 390px mobile layouts. Ten complete encounters rendered through Chrome’s real `OfflineAudioContext` with zero clipped samples at the default 55% volume. Measurements and the checked interactions are recorded in [the browser review](sound-audition-review.json). These checks establish working playback and signal health; the listening preference remains yours.
