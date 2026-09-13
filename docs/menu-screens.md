# Twin Paths menus

The selected September 13, 2026 direction uses two cinematic paths: a lone
adventurer and a party approaching Ashwick. The menu logo is only the HALLOWMERE
lettering, with the existing subtitle below it.

Choose Single player or Multiplayer, then select **Start game**. Arrow
keys change the selected path; Tab reaches the primary action. The selected
path has gold corner brackets, a selection marker, and an explicit checked
state for assistive technology. Loading progress reports the actual asset
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
