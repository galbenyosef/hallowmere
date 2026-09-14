# Twin Paths menus

The selected September 13, 2026 direction uses two cinematic paths: a lone
adventurer and a party approaching Ashwick. The menu logo is only the HALLOWMERE
lettering, with the existing subtitle below it.

Click Single player to open Journeys, or Multiplayer to proceed to character
selection. Hovering highlights the card with gold corner brackets and a marker,
without starting a session. Both cards are native buttons: Tab or arrow keys
move keyboard focus, and Enter or Space activates the focused card directly.
Loading progress reports the actual asset
preparation stages. Connection and retry screens share the solo scene.

The compact pause menu offers **Resume game** and
settings for music, brightness, shadows, and camera shake. The main menu keeps
the current session and offers **Resume game** and **Change character**. Closing
or confirming character selection returns to that menu; Escape resumes play.
Changing character in multiplayer still requires a sanctuary. Equipment and campaign progress
remain in the running session. Single-player simulation pauses; multiplayer
continues, with that distinction explained in the menu. Multiplayer retains this
session navigation. Single-player now uses the persistent journeys described below.

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
menus. Character selection, inventory, journal, controls, conversations,
death, victory, and the expanded map use the same moonlit backdrop, ivory
headings, and open composition. Pause uses a compact card over the dimmed world.
Connection and restart-vote prompts share those colors, typography, and square
gold borders.

`dist/menu-chrome.js` provides the shared menu index. It routes through existing
game transitions; character changes still require a sanctuary, and navigation is
hidden before choosing the first character and disabled while dead. Initial
character selection fills the screen with a centered heading and no menu rail;
changing character during an existing game retains the menu index. The index
becomes a horizontally scrolling row on small screens. Menus open at the top without
scrolling to the focused close button. Character selection uses the original
circular arrangement: seven class medallions surround the selected portrait,
with previous/next arrows and keyboard navigation. On narrower screens the
character details move below the wheel. Desktop and mobile captures in
`screenshots/circular-character-selector/` show the actual selector rendered
without starting a game session.

Inventory uses the earlier hover/focus preview interaction inside the Open
Chronicle shell. A single floating card shows gear comparisons and food effects
beside the inspected tile. It remains readable while hovered or focused; Escape
dismisses the card before the inventory, and clicking elsewhere clears it.
Weapon and charm slots flank the character portrait, and the satchel and pouch
use square tiles. Clicking or pressing Enter retains the existing equip/eat
action. Inspection survives inventory refreshes, preserves equipped semantics,
and never changes equipment by itself. The map retains its live canvas,
markers, discovery data, and keyboard shortcut.

`dist/chronicle.css` owns this shared presentation and its responsive rules. The
loading and game-mode selection screens retain the Twin Paths presentation.
Screenshots are in `screenshots/open-chronicle/`. Automated tests and build
validation remain deferred until an explicitly authorized merge.

The character, inventory, and journal screenshots show a local game session.
The conversation, game-menu layout, and mobile inventory captures use the actual
menu renderers with sample data in a temporary layout fixture, without a game
loop. That fixture was removed after review. A gameplay-resume review action was
blocked by automatic approval review because it could advance session state.

## Compact pause and initial character selection

`dist/pause-menu.js` renders Resume game and accessible settings switches and
slider. Resume and Escape close the pause card. The Return to game menu button
was removed; `screenshots/compact-pause-menu/pause-no-return.png` captures the
updated card. The brightness
slider participates in the modal focus trap, and Escape also works from it.
The pause card has no menu index or restart/character shortcuts.

`dist/game-settings.js` stores music, brightness (75–135%), shadows, and camera
shake in local storage, with safe defaults when storage is unavailable. Brightness
updates the world's tone-mapping exposure immediately; shadows refresh the
renderer and material variants; camera shake gates camera offsets and clears any
pending shake when changed. Camera shake defaults off for reduced-motion users.
Music uses the existing audio engine without muting other game sounds.

The captures in `screenshots/compact-pause-menu/` show the production character
component and pause markup at 1280×720 and 390×844 in a temporary isolated layout
fixture. The pause backdrop is the existing gameplay image. Manual inspection
confirmed that initial selection hides the rail, in-game selection keeps it, all
seven classes remain available, and neither mobile layout overflows horizontally.
Settings switches and the keyboard-operated slider were checked with an isolated
renderer adapter. Full gameplay transitions and rendering remain for merge-time
validation; automated tests/build were deferred. The fixture was removed after
review.

## Restored inventory interactions

The preview controller and positioning logic in `dist/inventory.js` reuse the
inventory implementation from before Open Chronicle (commit `5046064`). The card
uses a manual popover so menu scrolling cannot clip it. It flips and clamps to
viewport edges; scrolling a focused tile keeps its card positioned, while
scrolling a hover-only tile dismisses it. The new menu's typography, palette,
sidebar, and footer are retained in `dist/chronicle.css`.

Screenshots in `screenshots/inventory-hover-layout/` show the actual inventory
renderer and character art with isolated sample inventory data at 1280×720 and
390×844. Manual checks covered hover and keyboard focus, Escape dismissal without
closing inventory, comparison without equipping, equipping a charm and refreshing
its slot/card, and mobile positioning. No live game session was changed during
review. Existing hover-preview regression coverage was restored and adjusted for
focused scrolling; automated tests and build validation remain deferred until
an authorized merge. The temporary layout fixture was removed after review.

## Browser-local journeys

Single player opens **Your journeys** before starting a simulation. New journey
uses the existing character wheel and creates an independent world. Each journey
keeps its original character; sanctuary switching remains available in multiplayer.
There is no fixed slot limit. Saves are listed most recently saved first, with a
name, character portrait and class, level, last explored region, and playtime.
The selected journey shows its objective, defeated guardians, and return checkpoint.
Rename and confirmed deletion are available from the same Open Chronicle screen.

Autosave is always enabled throughout single-player: every five seconds while
playing, within half a second of game events and commands, when opening the pause
menu, and when the page is hidden or closed. The timer also renews ownership while
paused. Save & exit waits for the save transaction before closing the session and
returns to the saved journey in the list. A storage failure keeps the session open
with an error and permits retrying. Multiplayer does not write journey saves.

Continuing restores progression and returns the character to the last activated
checkpoint, or Ashwick if none was activated. Health and essence are restored;
potions, inventory, equipment, upgrades, cooldowns, collected loot, foraging timers,
quests, discoveries, destroyed cover, and enemies across every region are retained.
Transient attacks, movement, and buffs are cleared. Living enemies return to their
home positions; unfinished boss encounters follow their normal reset rules.

`dist/journey-state.js` defines the versioned durable save and checkpoint restore.
It captures the authoritative world, since renderer snapshots omit off-map enemies,
loot, and other world state. `dist/journey-store.js` stores each journey atomically
in IndexedDB (`hallowmere.journeys`) with a previous valid revision. Invalid saves
can recover from that revision; newer-format saves are preserved and cannot be
loaded by an older game. Per-journey ownership and revision checks prevent two tabs
from overwriting one another. Ownership expires after 30 seconds if a tab stops
renewing it. A best-effort synchronous localStorage recovery journal supplements
IndexedDB on page hide/close; it is consumed only for the last owning tab and only
when newer than the committed record. Browser termination can still interrupt a
write, so closing is not the sole save trigger.

`dist/journeys-menu.js` and `dist/journeys.css` reuse the menu backdrop, wordmark,
character portraits, typography, colors, borders, and buttons. The layout stacks
on mobile, keeps the journey list scrollable, and uses native dialogs for focus
containment and confirmation. The save indicator reports actual transaction
completion. Browser storage is tied to the current profile and origin (including
host and port); it does not sync to another device, and clearing site data removes
saves. Private browsing may clear saves when its session ends.

Focused regression coverage is in `tests/journeys.test.mjs`. Automated tests and
build validation remain deferred until an explicitly authorized merge.

Screenshots in `screenshots/journey-saves/` show the live journey menu at 1280×720,
its list and continuation controls at 390×844, and the single-player pause card.
Manual review confirmed creating separate Ranger and Reaver journeys, saving and
exiting, browser reload persistence, checkpoint return after moving away, retained
foraged inventory/playtime, naming, deletion confirmation/cancellation, keyboard
focus, and blocking a second tab from opening an active journey. The mobile menu
scrolls vertically without horizontal overflow. No existing saves were deleted.
