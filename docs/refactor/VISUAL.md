# Visual baseline for the dist/ refactor

Splitting `dist/main.js` must produce **no observable change**. These screenshots are the evidence.
`screenshots/refactor-baseline/` was captured from an unmodified tree at
`ff9a17fd886fa8b21820140676c9249df3abc38b` (`git rev-parse main`), 1440x900, headless Chrome.

> **Rule.** Any task that touches UI code must capture a fresh set and run
> `compare-shots.mjs --dir screenshots/refactor-baseline <new dir>`, then paste the resulting table
> into its report. A scenario over the threshold is a regression until it is explained.

## Capturing

```sh
bash scripts/node22.sh node scripts/screenshot.mjs --list                       # scenario names
bash scripts/node22.sh node scripts/screenshot.mjs --all --out /tmp/shots-after # every scenario
bash scripts/node22.sh node scripts/screenshot.mjs --scenario 08-inventory --out /tmp/shots-after
bash scripts/node22.sh node scripts/screenshot.mjs --all                        # rewrite the baseline
```

Other options: `--width 1440 --height 900`, `--keep-canvas` (leave the WebGL canvas visible),
`--url http://127.0.0.1:5182` (reuse a running server instead of starting one), `--gpu`.
Chrome comes from `$CHROME`, defaulting to `/Applications/Google Chrome.app/Contents/MacOS/Google Chrome`.

The script starts its own `node scripts/serve.mjs` on a free port, waits for `/health`, and kills it on
exit. Expect **12-20 minutes** for `--all`: every scenario gets a fresh Chrome and replays the shortest
path to its state, because one page that stays in the game for several minutes eventually wedges its
renderer thread. Before each shutter the script re-asserts the scenario's own condition, so a menu that
closed itself fails the attempt and is retried instead of being saved as a wrong picture.

## Comparing

```sh
bash scripts/node22.sh node scripts/compare-shots.mjs --dir screenshots/refactor-baseline /tmp/shots-after
bash scripts/node22.sh node scripts/compare-shots.mjs a.png b.png --diff /tmp/diff.png
```

A pixel "differs" when any channel differs by more than `--tolerance` (default 8). The tool prints
width x height, the differing-pixel count and ratio, and a bounding box; `--diff out.png` writes the
differing pixels in red over a dimmed copy of the first image. It exits 1 when a ratio exceeds
`--threshold`. `--dir` compares every matching filename, prints a markdown table, and exits 1 if any
scenario is over. `*.canvas.png` is skipped in `--dir` mode (`--include-canvas` forces it in).

## Scenarios

| Scenario | Shows |
| --- | --- |
| `01-title` | Mode choice / title screen once assets have loaded. |
| `02-journeys-menu` | Single-player journeys menu, empty "first journey" state on a fresh profile. |
| `03-roster-picker` | Character chooser with portraits prepared and the confirm button enabled. |
| `04-hud-spawn` | Solo session at the Ashwick spawn: HUD, quest panel, minimap, ability bar, world labels. |
| `05-pause` | Pause menu: resume, autosave notice, sound and visual settings. |
| `07-connection-overlay` | Multiplayer with no backend reachable: the "Unable to connect" overlay. |
| `08-inventory` | Inventory: equipment slots, 3D portrait, attributes, satchel, pouch. |
| `09-journal` | Journal: quest text and per-region progress. |
| `10-help` | Controls: the full control table and guidance copy. |
| `11-npc-dialogue` | Elder Rowan conversation after walking to him from the spawn. |
| `13-map-expanded` | Expanded world map: exploration atlas, legend, menu rail. |

`04-hud-spawn.canvas.png` is a second shot of `04-hud-spawn` with the WebGL canvas visible. It is for
human eyeballing only and is never diffed — the 3D scene can never be byte-stable.

### Not capturable from this tree

- **`06-main-menu`** — `openMainMenu()` in `dist/main.js` has no caller, so `titleScreen.showMainMenu()`
  is unreachable from the UI. (Worth confirming during the refactor: it looks like dead code.)
- **`12-death`** — `window.hallowmere` exposes no way to force `state.ended`, and the assistive
  `control_warden` tool has no such action. Dying for real means standing in the road taking hits, which
  is slow and not deterministic, so no death-screen baseline exists.

## What is hidden or frozen, and why

The world seed is random per load (`crypto.getRandomValues` in `dist/main.js`) and the 3D scene animates,
so the WebGL canvas can never be byte-stable. Before every capture the harness therefore:

- sets `#world` `style.visibility = 'hidden'` — the canvas disappears, the DOM and HUD stay exactly as
  laid out (skipped with `--keep-canvas`);
- injects `*{animation-play-state:paused!important;transition:none!important;caret-color:transparent!important}`;
- calls `document.getAnimations().forEach(a => a.pause())`;
- awaits `document.fonts.ready` and two animation frames.

All of it is undone right after the shutter, so the session keeps working for the next step.
`04-hud-spawn` additionally waits until world time passes 16 s, which is when the onboarding guide has
faded and the autosave chip has hidden itself.

## Noise floor

Two independent `--all` runs of the unmodified tree, compared at `--tolerance 8`:

| Scenario | differing px | ratio |
| --- | ---: | ---: |
| `01-title` | 0 | 0.0000% |
| `02-journeys-menu` | 0 | 0.0000% |
| `03-roster-picker` | 0 | 0.0000% |
| `04-hud-spawn` | 1,173 | 0.0905% |
| `05-pause` | 0 | 0.0000% |
| `07-connection-overlay` | 0 | 0.0000% |
| `08-inventory` | 0 | 0.0000% |
| `09-journal` | 877 | 0.0677% |
| `10-help` | 877 | 0.0677% |
| `11-npc-dialogue` | 877 | 0.0677% |
| `13-map-expanded` | 0 | 0.0000% |

Worst noise floor: **0.0905%** (`04-hud-spawn`). The residue is the journey autosave chip in the bottom
right ("Saving..." vs "All progress saved"), which is time-based, plus a few antialiased world labels.

**Recommended threshold: `--threshold 0.002` (0.2000%)**, about 2.2x the worst noise floor. That is the
script's default, so `compare-shots.mjs --dir` needs no flag. Anything above it is a real change: the
smallest genuinely different thing in this UI — a shifted label, a changed number — moves far more than
0.2% of the frame.

## Chrome

Flags that worked (recorded in `screenshots/refactor-baseline/index.json`):

```
--headless=new --remote-debugging-port=0 --hide-scrollbars --no-first-run
--no-default-browser-check --mute-audio --disable-background-timer-throttling
--disable-renderer-backgrounding --disable-backgrounding-occluded-windows
--force-device-scale-factor=1 --force-color-profile=srgb --window-size=1440,900
--user-data-dir=<fresh temp dir> --use-angle=swiftshader --enable-unsafe-swiftshader
```

Notes from getting this to work on macOS, all of which the harness now handles:

- **SwiftShader is the default.** The platform GPU path (ANGLE Metal) does give a real WebGL2 context and
  renders the game correctly, but it intermittently wedges the renderer thread partway through a capture
  session. `--gpu` opts back into it; the harness still falls back to SwiftShader if WebGL2 is missing.
- **Menus are opened by clicking the HUD buttons** (`#pause-button`, `#journal-button`, `#help-button`,
  `#inventory-button`, `#map-button`), not by pressing I/J/H/M/Esc. One `Input.dispatchKeyEvent` aimed at
  the game page in this headless Chrome repeats indefinitely — thousands of `keydown`s from a single
  press — and every game key is a toggle, so the menu it opens is immediately closed again. A blank page
  in the same browser behaves correctly, so it is the game page plus headless input, not the CDP call.
  `pressKey()` is still exported for scenarios that need a real key.
- **`Emulation.setFocusEmulationEnabled`** is required or `Input.*` can wait forever on an unfocused
  renderer, and `Page.setWebLifecycleState {state:'active'}` after each shutter stops the page reporting
  itself hidden (which the game treats as backgrounded and freezes).
- **Never poll `window.hallowmere.getState()`.** Building that object raycasts every enemy; polling it a
  few times a second is by itself enough to stall the page. Every wait in the harness reads the DOM.
- `07-connection-overlay` blocks `*multiplayer-config.json*` with `Network.setBlockedURLs`. That is a
  harness-side stand-in for "no backend configured"; nothing in `dist/` is modified.

## Observations from the refactor captures (2026-09-15)

Every main.js step (M1–M11), the CSS tasks (T2-5, T2-6) and the import normalisation (T2-1) were
captured with `--all` on their branch before merging; 17 full runs in total. What the diffs showed:

- `04-hud-spawn` never reaches 0 px: the two resource orbs animate (tidal-glass waves and bubbles)
  and the "All progress saved" autosave flash is timing-dependent. Observed range 0.02–0.12%.
- `09-journal`, `10-help` and `13-map-expanded` occasionally differ by exactly 877 px (0.0677%) —
  the same autosave-flash box. Treat anything under ~0.12% on those four scenarios as noise.
- One capture (M11, `13-map-expanded`) diffed 2.17% because the Google web font request failed in
  that fresh browser and the page rendered in the fallback serif; re-capturing the scenario matched.
  `scripts/screenshot.mjs` now throws when any `document.fonts` face has `status==='error'`, so the
  scenario loop retries in a fresh browser instead of producing a fallback-font PNG.
- Captures must run one at a time on this machine: two SwiftShader Chromes at once make every
  HUD-dependent scenario time out ("Timed out waiting for the HUD to settle").
- A headless boot probe (load `index.html`, print `Runtime.exceptionThrown`) caught the one real
  regression of the whole refactor — an M8 branch whose `init()` still passed a bare `talkTo`
  callback after the function moved — which no node test could reach. The probe sometimes reports
  the first GLB fetch as canceled even on known-good trees; only JavaScript exceptions from it are
  findings.
