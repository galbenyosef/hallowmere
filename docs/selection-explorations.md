# Character selection explorations

Open `/selection-explorations.html` on the task's local server. This is a separate,
interactive review gallery; it does not replace the game's class picker.

| Study | Direction | Selection model |
| --- | --- | --- |
| 01 | The Last Hearth | Select from the full ensemble |
| 02 | The Ashen Codex | Turn through illustrated character chapters |
| 03 | Circle of Oaths | Choose a portrait around a radial selector |
| 04 | Hall of Banners | Expand one of seven vertical banners |
| 05 | The Reliquary | Choose a weapon to reveal its character |
| 06 | The Chronicle | Browse a class index and illustrated story |
| 07 | The Field Ledger | Compare starting attributes in a roster table |
| 08 | The Procession | Cycle through characters or use the portrait rail |
| 09 | Three Paths | Narrow the roster by combat approach |
| 10 | The Threshold | Choose a portrait and optionally reveal the ability kit |

The gallery keeps the selected class between directions. Desktop/Mobile changes
the preview container and exercises the responsive layout. Focus view hides the
review sidebar and notes. Class lists support arrow keys, and all actions support
normal keyboard activation. “Enter the vigil” opens a local demonstration dialog.
It does not start a game or change the player's saved character.

Favorites use the separate browser-local key
`hallowmere.selection-studies.favorites.v1`. A URL fragment such as
`#circle/ranger` opens the selected direction and class. Invalid fragments fall
back to a known direction and class.

All class names, starting attributes, equipment, and abilities come from
`dist/classes.js`. Short atmospheric headlines are gallery-only concepts. The
Three Paths grouping is a browsing aid, not a new restriction on any class.
RPG references in the notes describe design inspiration, not exact replicas.

The gallery reuses the existing playable rigs and inventory study lighting. It
renders character and weapon images sequentially through one WebGL context,
then disposes the renderer. Switching studies reuses the generated images.
No external character artwork, dependencies, or changes to gameplay modules
are required. Google Fonts matches the existing game's Cinzel/Inter typography,
with Georgia/Arial fallbacks.

## Review coverage

- Inspected all ten desktop layouts and all ten 390px mobile preview layouts.
- Checked native character/weapon image loading and selection control bounds.
- Exercised character switching, radial/list arrow-key navigation, guided path
  selection, the optional ability drawer, and the confirmation dialog.
- Checked favorite persistence and direction/class restoration after reload;
  removed verification favorites afterward.
- Ran the repository's standard tests and build checks.
