# Hallowmere soundtrack

The game plays four tracks by Scott Buckley in order: **Balefire → Descent → The Old Ones → Incantation**, then returns to Balefire. The source recordings total approximately **20:13**; five-second overlaps produce a repeating cycle of roughly **19:53**. Balefire's composer explicitly cites Diablo IV as its inspiration. The companion tracks emphasize sinister winds, uneasy strings, and ritual vocal textures. This is the selected direction for the requested Diablo-like creepy score.

Official track/download sources and the CC BY 4.0 license are linked in the [runtime credits](../dist/assets/music/CREDITS.txt) and [asset manifest](../dist/assets/music/manifest.json). Game menu → Soundtrack credits exposes the attribution to players. Include the credited composer in the description of gameplay videos, as requested by the publisher. No purchase or account was required.

## Playback

- The soundtrack attempts playback as the loading screen starts. If the browser blocks autoplay, the first click, tap, or keypress retries immediately, even while assets are still loading. World effects and ambience remain silent until gameplay is ready and connected. The existing sound button controls music and effects together; the game menu also has a separate Music switch.
- Two HTML media elements feed the existing Web Audio mixer. Only the current and upcoming tracks load; twenty minutes of decoded PCM are never held in JavaScript memory. All files are served locally with the game, without third-party playback services.
- Five-second fades follow media playback time. A late download leaves the current song playing to its end before waiting. Failed songs are skipped; exhausting the playlist stops automatic retries until the next audio gesture.
- Music is mixed quietly on its own bus and briefly reduced under important combat cues. Music bypasses the world-effects bus, so it continues at its usual level during loading and pause menus while world effects and ambience are silenced. Muting music, muting all sound, and hiding the tab pause music at its current position; returning resumes the same track and any in-progress transition.
- Both media elements are primed during an audio gesture for mobile autoplay. Rejected autoplay can be retried on a later gesture. Music failure does not block effects or gameplay.
- The local multiplayer server supports MP3 byte ranges, content lengths, and the audio/mpeg MIME type, allowing browser seeking and bounded reads. Static hosting serves the same relative assets.

## Asset preparation and validation

The original MP3s were downloaded from the composer's official links. FFmpeg measured integrated loudness and true peaks. Each track received a constant gain adjustment toward −18 LUFS, bounded by −2 dBTP source headroom, then was encoded to 160 kbps stereo MP3 at 44.1 kHz. Constant gain preserves the original dynamics; no dynamic loudness processing was applied. The four delivery files total approximately 23.1 MiB. Exact durations, sizes, gain changes, and SHA-256 hashes are in the manifest. Existing sound-effect generation does not touch the separate music directory.

Encoding recipe (substitute the manifest's per-track gain):

```sh
ffmpeg -i original.mp3 -map 0:a:0 -map_metadata -1 -af volume=GAINdB \
  -c:a libmp3lame -b:a 160k -ar 44100 soundtrack.mp3
```

Runtime tests exercise the entire playlist wrap, crossfade gains, paused transitions, separate/master muting, delayed downloads, failures, and autoplay recovery. Asset tests verify provenance hashes and the duration/payload budget. Server tests verify full, partial, suffix, HEAD, and invalid audio-range requests. Signal measurements and runtime tests do not substitute for subjective listening on every speaker or device.

Full-file decoding reported no errors. Final integrated levels range from −19.4 to −18.4 LUFS, with true peaks from −5.6 to −2.1 dBFS, leaving headroom before the music bus. See [signal measurements](soundtrack-review.json).
