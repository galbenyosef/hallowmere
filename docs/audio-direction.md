# Hallowmere audio direction and review

Implemented September 12, 2026. The selected direction is intimate physical sound under an unsettling supernatural atmosphere: worn steel, bone and cloth, unstable throat textures, distant bells, breath-like wind, and restrained low-frequency weight. Combat transients remain quick and legible.

## Research and selection

The selection considered physical detail, horror suitability, repeated gameplay, editable source availability, reuse terms, and delivery size. These are project-fit judgments based on publisher documentation and the available source files, not a blind listening comparison of every commercial library.

| Option | Findings | Decision |
| --- | --- | --- |
| [Kenney Impact Sounds](https://kenney.nl/assets/impact-sounds) and [RPG Audio](https://kenney.nl/assets/rpg-audio) | The publisher provides 130 impact/foley files and 50 RPG files under CC0. The downloaded archives include footsteps, material impacts, blades, coins, leather, pages, doors, and creaks. | **Selected as the physical foundation.** Compact, editable, straightforward to include with this project. Dry source material needs considerable processing to fit horror. |
| [Sonniss GameAudioGDC](https://sonniss.com/gameaudiogdc/) | A broad archive of recordings from specialist libraries; the publisher describes commercial media use without mandatory attribution. Its [bundle terms](https://sonniss.com/gdc-bundle-license/) govern use. | Strong source for a larger production, but broad multi-archive downloads require more curation than the targeted physical palette here. No Sonniss assets were integrated. |
| [99Sounds Halloween Sound Effects](https://99sounds.org/halloween-sound-effects/) | Publisher lists 60 horror assets: atmospheres, impacts, and other effects, delivered as 24-bit WAV in a 326 MB archive. Review the separate [license](https://99sounds.org/license/). | Suitable for cinematic stingers and long atmospheres. This game benefits more from short, independently variable layers than a selection of premixed horror moments. No assets integrated. |
| [BOOM Cinematic Horror](https://www.boomlibrary.com/sound-effects/cinematic-horror/) | Dedicated construction and designed editions include organic/synthetic drones, metal, wood, instruments, and vocal material. It is a purchased library with substantial source coverage. | The strongest specialized paid candidate among those researched. A sensible future source for more natural performed creature vocals; purchasing was unnecessary for this implementation. No demos or paid assets copied. |
| [Freesound](https://freesound.org/help/faq/) | Useful individual recordings, with licenses selected by contributors and different attribution/commercial-use conditions. | Useful for very specific missing recordings, but assembling a consistent multi-author palette adds curation and provenance work. No files integrated. |
| Original synthesis alone | The original implementation used twelve short mono clips: mainly simple oscillators and filtered noise, a major-key healing sound, one footstep, and one ambience loop. | Retained as a design tool, expanded with layered recorded material. Pure synthesis is a poor physical foundation for every action in this setting. |

**Best fit for this implementation:** selected Kenney recordings plus custom editing, granular processing, formant-style creature synthesis, noise textures, inharmonic resonances, and an adaptive mixer. The choice optimizes this game's needs and reproducibility; it is not a claim that a free source pack exceeds every paid horror library in fidelity.

## Design references translated into changes

Blizzard's [Diablo IV audio development article](https://news.blizzard.com/en-gb/article/23731236/diablo-iv-quarterly-updateoctober-2021) describes subtle variation, grounded physical layers, different creature families, changing ambience, and limiting simultaneous sounds so important cues remain clear. Those principles informed the architecture. Hallowmere uses its own recordings/recipes and does not reuse Diablo audio.

The engine uses the browser's [Web Audio API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API): stereo panning, filters, a shared [convolution reverb](https://developer.mozilla.org/en-US/docs/Web/API/ConvolverNode), gain automation, and dynamics compression. An isometric camera needs its screen-right axis represented in audio placement, rather than simply assigning world X to left/right.

## Implemented palette

- **Steel:** three swings and four impacts combine blade recordings, cloth, body impact, metal, and short low-frequency transients. Swing, hit, and magical impact are distinct events.
- **Fire:** separate cast, collision, and nova banks. Layered turbulence, grain textures, crackles, and a decaying bass body replace the single reused fire clip. Wall impacts also sound.
- **Creatures:** separate Hollow, Grave Hound, Revenant, and Bellkeeper voices and deaths. Granulated creaks, irregular glottal pulses, formant emphasis, breath, and different pitch/envelope recipes provide family identities. Attacks have vocal warnings; nearby movement and occasional idle voices add presence.
- **Player:** cloth/leather evade, armor/body hurt, and a separate player-death falloff. Healing uses glass, bubbling textures, breath, and a restrained minor harmony.
- **Rewards and interaction:** real coin handling, blade/latch equipment, page movements for menus, door creaks, and separate level-up and relic cues.
- **Footsteps:** four takes each on stone, dirt, and wood, selected from location. Interiors use wood except the chapel; the center of the old road remains stone, with dirt/grass outside its cobbled strip.
- **World:** three stereo beds for Ashwick, the Mourning Road, and Hallowmere; an additional threat layer and low-health pulse. Irregular lateral creaks/whispers and distant spatial bells interrupt predictable repetition. Combat suppresses ambient details; victory removes the threat layer, reduces haunted ambience, and ends ominous random details/bells.

79 final assets, 48 kHz PCM16, 23.8 MiB. Physical source OGG files were decoded to PCM; resampling does not create new recorded detail. Long ambience files are stereo, most event files are mono before spatial processing. The checked-in 40-source subset is about 1.8 MiB. `npm run generate:audio` deterministically rebuilds the palette without downloads, audio software, or model regeneration.

## Self-feedback and revisions

| Review finding | Implemented response |
| --- | --- |
| The old sounds shared a thin, electronic identity. | Added physical recordings and differentiated material/creature recipes; replaced all twelve original files. |
| Healing and pickup were bright game-like tones that weakened the atmosphere. | Used tactile glass/coin sounds with restrained, darker resonances; kept rewards distinct from damage. |
| Pitch variation alone would still expose repeated samples. | Added take banks and shuffle bags that avoid immediately repeating the previous take, including across bag boundaries. |
| Reusing the bolt sound for nova and a general death sound for every creature obscured events. | Added dedicated ability, impact, creature-death, and player-death banks and gameplay hooks. |
| Many simultaneous cues and long reverb tails could obscure the next attack. | Used short dry physical fronts, restrained shared reverb sends, per-cue voice limits, a 28-one-shot global budget, prioritization, and temporary ambience ducking. |
| Stereo placement on world X alone would disagree with the camera. | Used the same camera-right direction as movement; added distance rolloff and lower-volume, filtered wall occlusion. |
| A looping drone and a bell every 36 seconds would quickly become predictable. | Added evolving stereo textures, smooth region/threat fades, irregular detail intervals, different loop lengths, and victory-aware playback. |
| The first loop export had measurable endpoint jumps. | Applied overlap crossfades and a short endpoint correction; final PCM endpoints match within one quantization step without fading the bed to silence. |
| Muting, pausing, and conversations interact differently. | Kept UI service cues on their own bus, retained mute across pause/resume, prevented duplicate beds, and faded/suspended background-tab audio. |
| The sound button initially enabled then immediately muted on first use. | First activation now enables audio; later presses toggle it. Initialization failures keep the activation affordance available. |
| A bigger palette should not delay core action sounds behind long background downloads. | Load core action banks first, then load the rest with bounded request concurrency. Individual failures are tracked and retried on re-enabling sound. |

## Verification and practical limits

- All 79 WAV files passed PCM format, payload, signal-level, DC-offset, uniqueness, and endpoint checks. Individual source peaks are at or below −6 dBFS.
- The actual Web Audio graph decoded every file and rendered the [34-second preview](audio-preview.wav). The render contains ambience, footsteps, swings/hits, creature voices, magic, healing, boss cues, and a relic reward. Its sample peak is **−9.48 dBFS**, with **zero clipped samples**. Full measurements are in [audio-render-review.json](audio-render-review.json).
- Automated runtime tests cover variation, camera-aligned spatialization, wall filtering, region/threat/health states, voice saturation, priority preservation, resource cleanup, muted pause/resume, background suspension, shared initialization, and asset failure recovery.
- All game tests and the static build check pass. Existing campaign, collision, buildings, and combat checks remain intact.

The self-review combines source/design analysis, signal measurements, and actual Web Audio rendering. It is not a headphone/speaker listening panel or a full manual playthrough. Perceived fear, fatigue, and creature naturalness remain subjective; synthesized vocal layers are the clearest opportunity for a later session with a creature performer. The uncompressed bank trades a larger one-time download for broad browser decoding support and dependency-free regeneration.

Preview timeline: 0–6s atmosphere/footsteps; 6–8s steel; 8–12s creatures; 12–16s fire/damage; 17–19s healing; 19–29s Bellkeeper; 30–34s relic.

## Provenance

Publisher license copies: `scripts/audio-sources/LICENSE-kenney-impact.txt` and `LICENSE-kenney-rpg.txt`. File mapping: `scripts/audio-sources/sources.json`. Runtime credit: `dist/assets/audio/CREDITS.txt`. Final output inventory and per-file measurements: `dist/assets/audio/manifest.json`. Custom sound recipes: `scripts/generate-audio.mjs`. Playback settings: `dist/audio-palette.js`.
