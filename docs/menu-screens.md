# Twin Paths menus

The selected September 13, 2026 direction uses two cinematic paths: a lone
adventurer and a party approaching Ashwick. The menu logo is only the HALLOWMERE
lettering, with the existing subtitle below it.

Click Single player or Multiplayer to start that mode and proceed to character
selection. Hovering highlights the card with gold corner brackets and a marker,
without starting a session. Both cards are native buttons: Tab or arrow keys
move keyboard focus, and Enter or Space activates the focused card directly.
Loading progress reports the actual asset
preparation stages. Connection and retry screens share the solo scene.

The pause menu includes **Open main menu** and **Change character**. The main menu keeps
the current session and offers **Resume game** and **Change character**. Closing
or confirming character selection returns to that menu; Escape resumes play.
Changing character still requires a sanctuary. Equipment and campaign progress
remain in the running session. Single-player simulation pauses; multiplayer
continues, with that distinction explained in the menu. This is session
navigation, not a new persistent save system.

## Implementation and artwork

- `dist/title-screen.js` owns menu presentation, keyboard selection, focus,
  progress, and the loading error state.
- `dist/main.js` owns session transitions, sanctuary restrictions, pause state,
  character selection, and reconnect focus.
- `dist/title-screen.css` contains the responsive visual treatment and reduced
  motion behavior. The previous mode-selection overrides were removed.
- `dist/assets/menu/twin-paths-solo.webp` and `twin-paths-party.webp` are original
  ImageGen scene assets, generated using the selected Twin Paths concept and
  the game's low-poly dark-fantasy aesthetic. Their briefs specified moonlit
  village roads, amber lanterns, a lone sorcerer or three adventurers seen from
  behind, and no baked-in interface or text. The native outputs were converted
  to WebP for delivery.
- `dist/assets/menu/hallowmere-wordmark.png` is an ImageGen lettering asset
  derived from the approved HALLOWMERE branding. Its brief preserved the pale
  textured gothic lettering and excluded the app-icon tile, character,
  antlers, symbols, and subtitle. It uses a pure black matte with CSS screen
  blending over the menu background. The subtitle remains accessible HTML.

Visual evidence and comparison history are recorded in `design-qa.md`.

## Open Chronicle game menus

Option 3 in `dist/menu-directions.html` is the selected direction for the in-game
menus. Character selection, inventory, journal, controls, conversations, pause,
death, victory, and the expanded map now use the same moonlit backdrop, ivory
headings, and open composition. Connection and restart-vote prompts share those
colors, typography, and square gold borders.

`dist/menu-chrome.js` provides the shared menu index. It routes through existing
game transitions; character changes still require a sanctuary, and navigation is
unavailable before choosing the first character or while dead. The index becomes
a horizontally scrolling row on small screens. Menus open at the top without
scrolling to the focused close button.

Inventory inspection stays beneath the character and satchel. Hovering or
focusing a tile changes the visible details; clicking or pressing Enter retains
the existing equip/eat action. Inspection survives inventory refreshes, preserves
equipped semantics, and never changes equipment by itself. The map retains its
live canvas, markers, discovery data, and keyboard shortcut.

`dist/chronicle.css` owns this shared presentation and its responsive rules. The
loading and game-mode selection screens retain the Twin Paths presentation.
Screenshots are in `screenshots/open-chronicle/`. Automated tests and build
validation remain deferred until an explicitly authorized merge.

The character, inventory, and journal screenshots show a local game session.
The conversation, game-menu layout, and mobile inventory captures use the actual
menu renderers with sample data in a temporary layout fixture, without a game
loop. That fixture was removed after review. A gameplay-resume review action was
blocked by automatic approval review because it could advance session state.
