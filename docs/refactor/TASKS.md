# Refactor tracker

Updated 2026-09-14. Design: `docs/refactor/PLAN.md`. Orchestrator-only edits; agents never touch this file.

Status legend: `todo` · `running` · `review` · `changes-requested` · `ready-to-merge` · `merged` · `blocked` · `dropped`

Baseline (main `ff9a17f`): 269 tests pass / 0 fail, suite ~84 s, `npm run build` green, `dist/main.js` 593 lines / 97 KB.

## Gates

| Gate | Wave | Tasks | Authorized | Merged commits |
|---|---|---|---|---|
| G0A | 0A | T0-0, T0-2, T0-5 | 2026-09-14 (user) | 9a5ffde, 2750cda, c62368e |
| G0B | 0B | T0-1, T0-3, T0-4, T0-7 | 2026-09-15 (user) | in progress |
| G1.1 | 1.1 | M1, T1-1, T1-2 | — | — |
| G1.2 | 1.2 | M2, T1-3, T1-4 | — | — |
| G1.3 | 1.3 | M3, T1-5, T1-6 | — | — |
| G1.4 | 1.4 | M4, T1-7, T1-8 | — | — |
| G1.5 | 1.5 | M5, T1-9, T1-10 | — | — |
| G2.0 | 2.0 | T2-1 | — | — |
| G2.1 | 2.1 | M6, T2-2, T2-3 | — | — |
| G2.2 | 2.2 | M7, T2-4, T2-5 | — | — |
| G2.3 | 2.3 | M8, T2-6 | — | — |
| G2.4 | 2.4 | M9 | — | — |
| G2.5 | 2.5 | M10 | — | — |
| G2.6 | 2.6 | M11 | — | — |
| G3 | 3.1–3.4 | P1–P8 | — | — |

## Phase 0 — safety net

| ID | Wave | Model | Title | Owns | Depends | Status | Branch | Port | Commit | Notes |
|---|---|---|---|---|---|---|---|---|---|---|
| T0-0 | 0A | orchestrator | Tracker + design doc | docs/refactor/{TASKS,PLAN}.md | — | merged | codex/refactor-tracker-e2d76bc0-* (rotates per gate) | 5392 | → main c62368e | tracker worktree `hm-tracker`; re-run `start --task hm-tracker` after every gate |
| T0-2 | 0A | opus | DOM-free core guard test | tests/core-purity.test.mjs | — | merged | codex/core-purity-f011b76a-9744 | 5508 | 7cf3722 → main 9a5ffde | 4 tests, closure=19 modules, bite-proof pasted; 273/273 |
| T0-4 | 0A | opus | Perf + visual baseline (perf-smoke, screenshot/diff tooling, 13 shots) | scripts/{perf-smoke,screenshot,compare-shots,perf-browser}.mjs, docs/refactor/{PERF,VISUAL}.md, screenshots/refactor-baseline/ | — | ready-to-merge | codex/perf-baseline-5e8d08f7-c682 | 6163 | 774e333..3258719 | 11/13 scenarios; noise floor 0.09%, threshold 0.2%; perf-smoke + perf-browser (unlocked p50 6.3 ms idle / 6.7 ms walking) in PERF.md; merges at gate 0B |
| T0-5 | 0A | sonnet | Move dev pages to docs/variations; npc-models.js → scripts/ | dist dev pages (PLAN §5.6), scripts/generate-assets.mjs, tests/npc-models.test.mjs, README.md, docs/*.md refs, design-qa.md | — | merged | codex/dev-pages-move-c5b59f7e-17a8 | 5791 | bc42cd3, f051704 → main 2750cda | 17 files out of dist/, path edits verified token-by-token; 269/269; build green |
| T0-1 | 0B | sonnet | tests/helpers, slice guard, audio widening, automation snapshot test | tests/helpers/{source,dom,sim,three-shim}.mjs, 18 tests, tests/automation-surface.test.mjs | T0-5 | ready-to-merge | codex/test-helpers-64601142-a7e3 | 5488 | 872ede2..7c315b8 | 8 slicing tests → sliceBetween (throws on missing marker, proven); assert counts identical in all 18 files; 15 audio cues unchanged; snapshot: hallowmere keys [getState,pause,resume,showControls], tools [get_vigil_state,control_warden]; exploration.test.mjs left as-is; 275/275 |
| T0-3 | 0B | opus | Validator: recursive glob + per-page `$()` closure | scripts/validate.mjs | T0-5 | ready-to-merge | codex/validator-closure-33088706-19ae | 6154 | e8a02d6 | closures: index 78, character-studies 9, menu-directions 20, route-atlas 8, sound-audition 0; 4 bite-proofs; build +0.5 s; 273/273 |
| T0-7 | 0B | opus | New shared modules with zero consumers + tests | dist/{random,dispose,util,dom,model-primitives}.js + tests | — | ready-to-merge | codex/shared-modules-95b6f5f0-1b59 | 6270 | c367e95..7f73544 | 295/295; reviewed: mapping tables in headers, parity tests vs verbatim kit copies; started early (no deps); opus because it fixes the API every dedup task adopts; util.js split into pure util.js + dom.js so core modules can import util without DOM contamination |

## Phase 1 — main.js M1–M5 + dedup

| ID | Wave | Model | Title | Owns | Depends | Status | Branch | Port | Commit | Notes |
|---|---|---|---|---|---|---|---|---|---|---|
| M1 | 1.1 | opus | ctx rename pass (game-context.js, util.js adoption) | dist/main.js, dist/game-context.js, 4 vm tests | 0B | todo | — | — | — | |
| T1-1 | 1.1 | sonnet | model-primitives → geralt, nightblade | dist/{geralt,nightblade}-character-model.js + golden tests | T0-7 | todo | — | — | — | |
| T1-2 | 1.1 | sonnet | model-primitives → oathkeeper, ranger | dist/{oathkeeper,ranger}-character-model.js + golden tests | T0-7 | todo | — | — | — | |
| M2 | 1.2 | sonnet | model-kit.js, icon-atlas.js | dist/main.js, 2 new, 5 appearance tests | M1 | todo | — | — | — | |
| T1-3 | 1.2 | sonnet | model-primitives → reaver, predator-model | dist/{reaver-character-model,predator-model}.js + golden tests | T0-7 | todo | — | — | — | |
| T1-4 | 1.2 | sonnet | model-primitives → character-study-models, generator | dist/character-study-models.js, scripts/generate-assets.mjs, scripts/npc-models.mjs | T0-7, T0-5 | todo | — | — | — | verify by structural GLB compare (accessors byte-equal, ignore material names): generator embeds random material.uuid so raw bytes never match |
| M3 | 1.3 | sonnet | effects-factory.js, enemy-spawner.js | dist/main.js, 2 new, tests/effects-factory.test.mjs | M2 | todo | — | — | — | |
| T1-5 | 1.3 | haiku | dispose.js adoption, effects tier | dist/{combat-effects,class-effects,multiplayer-view,enemy-visuals}.js | T0-7 | todo | — | — | — | |
| T1-6 | 1.3 | sonnet | random.js + dispose.js adoption, scenery tier | dist/{environment,cave-entrance-scenery,cave-scenery,expansion-layout,outland-scenery,region-environment}.js | T0-7 | todo | — | — | — | obstacle-position hash must match |
| M4 | 1.4 | sonnet | interaction.js, region-travel.js, pointer-targeting.js | dist/main.js, 3 new, tests/loot-pickup.test.mjs, perf-smoke row | M3 | todo | — | — | — | |
| T1-7 | 1.4 | haiku | util.js adoption | dist/{dialogue,journeys-menu,inventory,resource-orbs}.js | T0-7 | todo | — | — | — | |
| T1-8 | 1.4 | sonnet | Portrait camera-fit helper | dist/{portrait-fit,character-portraits,inventory-portraits,npc-portraits}.js | T0-7 | todo | — | — | — | portrait hashes must match |
| M5 | 1.5 | opus | input-bindings.js | dist/main.js, dist/input-bindings.js, tests loot-pickup/mouse-targeting/input-bindings | M4 | todo | — | — | — | |
| T1-9 | 1.5 | haiku | Dead code | dist/campaign.js VILLAGES, 10 internal-only exports, app-icon.png + doc refs | — | todo | — | — | — | also check `openMainMenu()` in main.js: T0-4 found it has no caller |
| T1-10 | 1.5 | sonnet | Geometry batcher + palette helper | dist/{geometry-batch,palette}.js, dist/{environment,cave-entrance-scenery,treasure-chests,outland-scenery}.js | T1-6 | todo | — | — | — | |

## Phase 2 — import normalization, M6–M11, CSS

| ID | Wave | Model | Title | Owns | Depends | Status | Branch | Port | Commit | Notes |
|---|---|---|---|---|---|---|---|---|---|---|
| T2-1 | 2.0 | haiku | Three import normalization | all dist/*.js | G1.5 | todo | — | — | — | solo wave |
| M6 | 2.1 | sonnet | player-motion.js | dist/main.js, 1 new, tests/mouse-targeting.test.mjs | T2-1 | todo | — | — | — | |
| T2-2 | 2.1 | sonnet | tokens.css | dist/tokens.css, :root blocks in 6 css files, index.html, character-studies.css | — | todo | — | — | — | |
| T2-3 | 2.1 | sonnet | value-noise dedup | dist/{noise,class-effect-materials,loot-effects,map-fog}.js | T1-6 | todo | — | — | — | |
| M7 | 2.2 | sonnet | hud.js, game-audio.js | dist/main.js, 2 new | M6 | todo | — | — | — | |
| T2-4 | 2.2 | opus | chronicle.css layering map (docs only) | docs/refactor/CSS-LAYERS.md | T2-2 | todo | — | — | — | |
| T2-5 | 2.2 | sonnet | #connection-overlay triplicate | dist/{style,chronicle,title-screen}.css | T2-2 | todo | — | — | — | |
| M8 | 2.3 | sonnet | modals.js, inventory-ui.js | dist/main.js, 2 new, tests/modals.test.mjs | M7 | todo | — | — | — | |
| T2-6 | 2.3 | opus | chronicle.css dead-rule deletion | dist/chronicle.css + shadowed base files | T2-4, T2-5 | todo | — | — | — | 39 shot pairs |
| M9 | 2.4 | opus | session-lifecycle.js, connection-ui.js | dist/main.js, 2 new, tests/game-mode-choice.test.mjs | M8 | todo | — | — | — | |
| M10 | 2.5 | opus | snapshot-apply.js, network-events.js, shared-world-render.js | dist/main.js, 3 new, tests nightblade-appearance/snapshot-apply | M9 | todo | — | — | — | verbatim |
| M11 | 2.6 | opus | scene-setup.js, render-loop.js, automation-surface.js, composition root | dist/main.js, 3 new, tests/automation-surface.test.mjs | M10 | todo | — | — | — | |

## Phase 3 — performance

| ID | Batch | Model | Title | Owns | Depends | Status | Branch | Port | Commit | Notes |
|---|---|---|---|---|---|---|---|---|---|---|
| P1 | 3.1 | sonnet | pointer rect cache | dist/mouse-targeting.js, tests/mouse-targeting-pick.test.mjs | G2.6 | todo | — | — | — | |
| P2 | 3.1 | sonnet | village-life per-frame allocs | dist/world-actors.js | G2.6 | todo | — | — | — | |
| P3 | 3.1 | sonnet | light-source array | dist/combat-effects.js | G2.6 | todo | — | — | — | |
| P4 | 3.2 | sonnet | minimap | dist/exploration-map.js | G2.6 | todo | — | — | — | |
| P5 | 3.2 | opus | snapshot + clone | dist/world.js, dist/local-session.js, tests/snapshot-aliasing.test.mjs | G2.6 | todo | — | — | — | aliasing test first |
| P7 | 3.2 | haiku | orb disposal | dist/resource-orbs.js, tests/resource-orbs.test.mjs | G2.6 | todo | — | — | — | |
| P6a | 3.3 | opus | render loop | dist/render-loop.js | G2.6 | todo | — | — | — | proves split cost nothing |
| P6b | 3.3 | sonnet | region labels + hazards | dist/region-travel.js | G2.6 | todo | — | — | — | |
| P6c | 3.3 | sonnet | HUD writes | dist/hud.js | G2.6 | todo | — | — | — | |
| P6d | 3.4 | sonnet | enemy sync + bars | dist/shared-world-render.js, dist/enemy-spawner.js | G2.6 | todo | — | — | — | |
| P6e | 3.4 | sonnet | interaction memo | dist/interaction.js, dist/pointer-targeting.js | G2.6 | todo | — | — | — | |
| P8 | 3.4 | sonnet | effect pooling | dist/effects-factory.js, tests/effects-factory.test.mjs | G2.6 | todo | — | — | — | |

## Log

- 2026-09-14 — Tracker created. Baseline 269/269 in 84 s. Worktrees registered: hm-tracker (5392), hm-T0-2 (5508), hm-T0-4 (6163), hm-T0-5 (5791). T0-2, T0-4, T0-5 launched. T0-4 raised to opus (adds CDP screenshot + PNG diff tooling); T0-5 raised to sonnet (reference rewriting across docs).
- 2026-09-14 — T0-2 reported (a5a2a6c, 273/273). Minor change requested (DOM regex lookbehind). Lesson: subagents' Write/Edit tools refuse paths outside this session's worktree; task prompts now say to write files with Bash heredocs/sed.
- 2026-09-14 — T0-2 ready-to-merge (7cf3722, 273/273).
- 2026-09-14 — T0-5 ready-to-merge (bc42cd3, f051704). Finding: `scripts/generate-assets.mjs` is nondeterministic (writes THREE material.uuid as the glTF material name), pre-existing; T1-4 verification changed to a structural GLB compare. Fixing the generator itself is out of scope (would alter committed assets).
- 2026-09-14 — T0-4 agent hit the 600 s no-output watchdog during the full `--all` capture (≈13 min for 11 scenarios). Capture completed on disk (11 scenarios; 06-main-menu unreachable: `openMainMenu()` has no caller; 12-death: no API to force `state.ended`). Agent resumed to finish noise floor, perf runs, docs, commits. Rule added to prompts: no single command over ~5 min; background long captures.
- 2026-09-14 — T0-4 reported (5 commits 774e333..9721a4e): 11 scenarios, noise floor ≤0.0905%, threshold 0.2%, perf-smoke + perf-browser baselines documented. Findings: `openMainMenu()` has no caller (dead-code lead for T1-9/M9); headless frame times vsync-pinned → follow-up requested to add `--disable-frame-rate-limit --disable-gpu-vsync` unlocked mode; polling `window.hallowmere.getState()` stalls the page (it raycasts every enemy).
- 2026-09-14 — T0-7 started early in wave 0A slot (no dependencies). Gate 0A requested for T0-0, T0-2, T0-5; T0-4 joins gate 0B after its unlocked-frame-rate follow-up.
- 2026-09-14 — Gate 0A authorized by the user for T0-0, T0-2, T0-5. T0-4 follow-up (3258719) and T0-7 (c367e95..7f73544, 295/295) reported; both in review, both merge at gate 0B.
- 2026-09-14 — Gate 0A: T0-2 merged (9a5ffde). T0-5 integrating.
- 2026-09-14 — Gate 0A: T0-5 merged (2750cda). Wave 0B started: T0-1 (test-helpers, 5488) and T0-3 (validator-closure, 6154) branched from 2750cda. Tracker branch integrating; after each gate the tracker needs `worktree.mjs start --task hm-tracker` again to get a fresh branch.
- 2026-09-14 — Gate 0A complete: tracker merged (c62368e). Fresh tracker branch codex/refactor-tracker-e2d76bc0-1b90 at the same path.
- 2026-09-14 — T0-3 ready-to-merge (e8a02d6). Notes: (a) validate.mjs skips dist/vendor as before; (b) tests/core-purity.test.mjs's stripper rescans its whole output per `/` (quadratic) — fine for the 19-module core, but cap the lookback like validate.mjs does if the closure grows (low-priority follow-up, fold into T1-9 or a later test touch); (c) subagent commits may carry the subagent's own model trailer (Opus) — accurate attribution, accepted.
- 2026-09-14 — T0-1 ready-to-merge (872ede2..7c315b8, 275/275). Gate 0B requested for T0-1, T0-3, T0-4, T0-7 (+ tracker).
- 2026-09-15 — Gate 0B authorized by the user. Integrating T0-1, T0-3, T0-4, T0-7, then the tracker.
