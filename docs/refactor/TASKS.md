# Refactor tracker

Updated 2026-09-14. Design: `docs/refactor/PLAN.md`. Orchestrator-only edits; agents never touch this file.

Status legend: `todo` · `running` · `review` · `changes-requested` · `ready-to-merge` · `merged` · `blocked` · `dropped`

Baseline (main `ff9a17f`): 269 tests pass / 0 fail, suite ~84 s, `npm run build` green, `dist/main.js` 593 lines / 97 KB.

## Gates

| Gate | Wave | Tasks | Authorized | Merged commits |
|---|---|---|---|---|
| G0A | 0A | T0-0, T0-2, T0-5 | 2026-09-14 (user) | 9a5ffde, 2750cda, c62368e |
| G0B | 0B | T0-1, T0-3, T0-4, T0-7 | 2026-09-15 (user) | bcc7b62, d744fb4, 7c82fe9, 0803197 (+tracker) |
| G1.1 | 1.1 | M1, T1-1, T1-2, T1-3, T1-4, T1-7 | 2026-09-15 (user) | 5d35fbf, 2c2059a, 0414a23, c1533d7, 3f75255, 7453fc3 |
| G1.2 | 1.2 | T1-5, T1-6, T1-8 | 2026-09-15 (user) | 4a44dfe, 104262a, 44e09ac (+tracker eb359f9) |
| G1.3 | 1.3 | M2, T1-9, T1-10, T2-4 | 2026-09-15 (user) | 2584e0b, 7bd89fb, 0dd0d90, 6695720 (+tracker 192c828) |
| G1.4 | 1.4 | M3, T2-5, P1, P2, P3, P5, T0-8 | 2026-09-15 (user) | fedac5e, 124d7ad, 1044804, 83bc689, fd0404e, 72ec9e0, 22b7207 (+tracker 76b757a) |
| G1.5 | 1.5 | M4 | 2026-09-15 (user) | 2e9d56c (+tracker e20872f) |
| G1.6 | 1.6 | M5 | 2026-09-15 (user) | ee26424 (+tracker 0c24cd6) |
| G1.7 | 1.7 | P6b, P6e | 2026-09-15 (user) | integrating |
| G2.0 | 2.0 | T2-1 | — | — |
| G2.1 | 2.1 | M6 | — | — |
| G2.2 | 2.2 | M7, T2-5 | — | — |
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
| T0-4 | 0A | opus | Perf + visual baseline (perf-smoke, screenshot/diff tooling, 13 shots) | scripts/{perf-smoke,screenshot,compare-shots,perf-browser}.mjs, docs/refactor/{PERF,VISUAL}.md, screenshots/refactor-baseline/ | — | merged | codex/perf-baseline-5e8d08f7-c682 | 6163 | 774e333..3258719 → main 7c82fe9 | 11/13 scenarios; noise floor 0.09%, threshold 0.2%; perf-smoke + perf-browser (unlocked p50 6.3 ms idle / 6.7 ms walking) in PERF.md; merges at gate 0B |
| T0-5 | 0A | sonnet | Move dev pages to docs/variations; npc-models.js → scripts/ | dist dev pages (PLAN §5.6), scripts/generate-assets.mjs, tests/npc-models.test.mjs, README.md, docs/*.md refs, design-qa.md | — | merged | codex/dev-pages-move-c5b59f7e-17a8 | 5791 | bc42cd3, f051704 → main 2750cda | 17 files out of dist/, path edits verified token-by-token; 269/269; build green |
| T0-1 | 0B | sonnet | tests/helpers, slice guard, audio widening, automation snapshot test | tests/helpers/{source,dom,sim,three-shim}.mjs, 18 tests, tests/automation-surface.test.mjs | T0-5 | merged | codex/test-helpers-64601142-a7e3 | 5488 | 872ede2..7c315b8 → main bcc7b62 | 8 slicing tests → sliceBetween (throws on missing marker, proven); assert counts identical in all 18 files; 15 audio cues unchanged; snapshot: hallowmere keys [getState,pause,resume,showControls], tools [get_vigil_state,control_warden]; exploration.test.mjs left as-is; 275/275 |
| T0-3 | 0B | opus | Validator: recursive glob + per-page `$()` closure | scripts/validate.mjs | T0-5 | merged | codex/validator-closure-33088706-19ae | 6154 | e8a02d6 → main d744fb4 | closures: index 78, character-studies 9, menu-directions 20, route-atlas 8, sound-audition 0; 4 bite-proofs; build +0.5 s; 273/273 |
| T0-7 | 0B | opus | New shared modules with zero consumers + tests | dist/{random,dispose,util,dom,model-primitives}.js + tests | — | merged | codex/shared-modules-95b6f5f0-1b59 | 6270 | c367e95..7f73544 → main 0803197 | 295/295; reviewed: mapping tables in headers, parity tests vs verbatim kit copies; started early (no deps); opus because it fixes the API every dedup task adopts; util.js split into pure util.js + dom.js so core modules can import util without DOM contamination |
| T0-8 | 0C | orchestrator | Browser scripts must exit when done | scripts/{screenshot,perf-browser}.mjs | — | merged | codex/screenshot-exit-8cd53587-da92 | 5307 | f13896a → 1044804 | root cause of the capture deadlock: Chrome helpers inherit the stderr pipe and keep node alive after a retry; fix = destroy stderr + unref after the endpoint is read, explicit exit after stdout drains in both CLIs; --list smoke + build green; perf-browser exited by itself under the fix (orchestrator A/B run, EXIT_0, no lingering process); screenshot path verified by the M4 capture (EXIT_0, no lingering process); merge at Gate 1.4

## Phase 1 — main.js M1–M5 + dedup

| ID | Wave | Model | Title | Owns | Depends | Status | Branch | Port | Commit | Notes |
|---|---|---|---|---|---|---|---|---|---|---|
| M1 | 1.1 | opus | ctx rename pass (game-context.js, dom.js `$` adoption) | dist/main.js, dist/game-context.js, 8 vm-slicing tests | 0B | merged | codex/ctx-rename-8e5ffbb9-efb6 | 5891 | 3c16270..6a3f690 → main 7453fc3 | ctx has 107 pre-declared fields; agent proved stripping `ctx.` reproduces main:dist/main.js character-for-character; 0 top-level let; assert/test counts identical in 8 tests; compare-shots 11/11 (orchestrator-run); perf within ±15% band; draw calls vary with the random world seed (521–549 idle across unmodified runs) so that column is not an identity check; 301/301 |
| T1-1 | 1.1 | sonnet | model-primitives → geralt, nightblade | dist/{geralt,nightblade}-character-model.js + golden tests | T0-7 | merged | codex/primitives-geralt-nightblade-94b5ab29-38bb | 5985 | f2d8dea..477d9da → main 5d35fbf | golden tests verified by orchestrator against main originals AND adopted files (2/2 both); geralt 17106→16470 B, nightblade 13986→13269 B; 303/303; `visible` fingerprinted (477d9da), re-verified vs originals |
| T1-2 | 1.1 | sonnet | model-primitives → oathkeeper, ranger | dist/{oathkeeper,ranger}-character-model.js + golden tests | T0-7 | merged | codex/primitives-oathkeeper-ranger-6dd19ea9-56aa | 5342 | 605c711..46d397d → main 2c2059a | goldens verified by orchestrator vs main originals (4/4) and adopted (4/4); oathkeeper 12471→11987 B, ranger 11879→11391 B; 305/305; found Shape.uuid leaking into ExtrudeGeometry.parameters (stripped); `visible` fingerprinted (46d397d), re-verified vs originals |
| M2 | 1.2 | sonnet | model-kit.js, icon-atlas.js | dist/main.js, dist/game-context.js (WIRED_SLOTS), 2 new, 5 appearance tests, tests/{icon-atlas,model-kit}.test.mjs | M1 | merged | codex/model-kit-icon-atlas-1fa61f22-cd7f | 5589 | c10d089..0ab66ff → 0dd0d90 | static review clean: paintIcons(document) at the same point in module order; cloneModel wired via createModelCache + WIRED_SLOTS; 5 tests migrated with identical assert/test counts; new icon-atlas + model-kit tests; 11/11 shots within threshold (max 0.0677%, under the 0.0905% noise floor), compare re-run by orchestrator; base 7453fc3 |
| T1-3 | 1.2 | sonnet | model-primitives → reaver, predator-model | dist/{reaver-character-model,predator-model}.js + golden tests | T0-7 | merged | codex/primitives-reaver-predator-97c91695-d10a | 5832 | 4c51968..3329674 → main 0414a23 | goldens (with visible, uuid-stripped) verified by orchestrator vs originals and adopted; reaver 14057→13333 B, predator 18340→17816 B; 309/309; may merge at gate 1.1 (disjoint) |
| T1-4 | 1.2 | sonnet | model-primitives → character-study-models, generator, npc-models.mjs | dist/character-study-models.js, scripts/generate-assets.mjs, scripts/npc-models.mjs + golden tests | T0-7, T0-5 | merged | codex/primitives-study-generator-f9654cb9-6963 | 5653 | 016b5fe..84a2a06 → main c1533d7 | goldens verified by orchestrator vs originals (5/5) and adopted; orchestrator regenerated all 9 GLBs with original vs adopted generator: ALL EQUAL (uuid names normalised); 306/306 |
| M3 | 1.3 | sonnet | effects-factory.js, enemy-spawner.js | dist/main.js, dist/game-context.js (WIRED_SLOTS), 2 new, tests/{effects-factory,enemy-spawner}.test.mjs | M2 | merged | codex/effects-spawner-96498203-006a | 5606 | 48bf571..6a97e6d → fedac5e | base 6695720; 11 functions verbatim (re-verified on the committed tree); call sites reconciled; WIRED_SLOTS +11; 12 new tests, 383/383; compare-shots 11/11 (max 0.0820%); perf accepted via same-conditions A/B vs main (agent flagged it unverified against the idle-machine PERF.md baseline); agent treated orchestrator messages as suspicious and skipped the /tmp marker — handled by orchestrator |
| T1-5 | 1.3 | sonnet | dispose.js adoption, effects tier | dist/{combat-effects,class-effects,multiplayer-view,enemy-visuals}.js + tests/dispose-adoption.test.mjs | T0-7 | merged | codex/dispose-effects-39ac6bd3-a22e | 6265 | 3b8705c..2e2f33b → main 4a44dfe | call-log parity test with verbatim references (orchestrator-checked) + 4 mutation checks; all 4 header option rows confirmed; 307/307 |
| T1-6 | 1.3 | sonnet | random.js + dispose.js adoption, scenery tier | dist/{environment,cave-entrance-scenery,cave-scenery,expansion-layout,outland-scenery,region-environment}.js + tests/golden-scenery.test.mjs | T0-7 | merged | codex/random-dispose-scenery-a62cb65b-ec3b | 6178 | ff6218c..2b4831c → main 104262a | 18 scene goldens verified by orchestrator vs originals and adopted; core closure now 20 (random.js) and pure; cave-scenery.js dispose() left as-is (no matching options row); 319/319 |
| M4 | 1.4 | sonnet | interaction.js, region-travel.js, pointer-targeting.js | dist/main.js, 3 new, tests/loot-pickup.test.mjs, perf-smoke row | M3 | merged | codex/interaction-travel-pointer-f80270e3-caf3 | 6088 | 8e7cf7b..85e0fd5 → 2e9d56c | orchestrator static review clean: 17 functions verbatim modulo documented ctx. cross-module renames (regionInteractions/interact/canReachRegion/setDestination/toast/awaken/releaseInput); main.js = 3 imports + 1 wiring line + 32 call-site renames + ctx.toast/awaken/releaseInput assignments; WIRED_SLOTS 16→36; loot-pickup slices 1–2 migrated (9 asserts before/after); 13 new tests; 396/396 on branch; main merged into the branch (perf-smoke case conflict with P2 resolved: both cases kept) → 418/418; perf-smoke merge slip fixed (85e0fd5); 13-shot capture on the merged branch (main 76b757a + M4): 11/11 within threshold, 0 retries, process exited by itself — doubles as the post-Gate-1.4 smoke |
| T1-7 | 1.4 | haiku | util.js adoption | dist/{dialogue,journeys-menu,inventory,resource-orbs}.js | T0-7 | merged | codex/util-adoption-ce4f8d26-6a2a | 6294 | d5c74cc → main 3f75255 | 4 helper swaps, imports verified per file; 301/301 |
| T1-8 | 1.4 | sonnet | Portrait camera-fit helper | dist/{portrait-fit,inventory-portraits,npc-portraits}.js + tests/golden-portrait-fit.test.mjs | T0-7 | merged | codex/portrait-fit-f50000b5-752a | 5647 | caa6e35..f01fb2d → main 44e09ac | camera-state goldens (14 subjects) verified by orchestrator vs originals; real pads 1.055/1.065 preserved; character-portraits.js untouched (different framing math); 309/309 |
| M5 | 1.5 | opus | input-bindings.js | dist/main.js, dist/input-bindings.js, tests loot-pickup/mouse-targeting/input-bindings | M4 | merged | codex/input-bindings-d108e6ac-afaf | 5766 | 41aa1a5..21ab917 → ee26424 | opus; stacked on M4 (7f5f61c); region verbatim (orchestrator whole-region compare modulo ctx./target renames + explicit {windowTarget,documentTarget} to bindPageActivity); 24-registration order snapshot test; 7 ctx.X=X assignments added (syncAudioState, resumeFromMainMenu, openRoster, perform, drawMap, showModal, closeModal); deviation: main.js keeps bare releaseInput/toggleMap/navigateMenu/attacksFromHere via const {…}=ctx to keep the game-mode-choice vm slice green (M9 migrates it); 424/424; main merged in for verification; 13-shot capture on main+M5: 11/11 within threshold (04-hud-spawn 0.0910%), 0 retries, process exited by itself |
| T1-9 | 1.3 | haiku | Dead code | dist/campaign.js VILLAGES, unused exports (re-verified), app-icon.png → docs/assets | — | merged | codex/dead-code-ade7a759-c49f | 5806 | 62aa3ac..01591da → 2584e0b | VILLAGES removed; 4 exports dropped (DEFAULT_SORCERER_APPEARANCE, FOOD_COOLDOWN, MUSIC_FADE_SECONDS, colorWarden); 5 kept (consumed by golden/parity tests); app-icon.png → docs/assets; doc links fixed (01591da) and resolved by orchestrator; openMainMenu: no in-game caller, exercised only by game-mode-choice test → M9 decides; base 104262a; must not touch main.js (M2 owns it); openMainMenu deferred to M9 |
| T1-10 | 1.3 | sonnet | Geometry batcher + palette helper | dist/{geometry-batch,palette}.js, dist/{environment,cave-entrance-scenery,cave-scenery,outland-scenery,treasure-chests}.js + tests | T1-6 | merged | codex/geometry-batch-palette-b5c979ff-b5e9 | 5590 | 1481405..f006275 → 7bd89fb | 18 scene goldens unchanged (test file untouched, re-run by orchestrator); batcher adopted in environment/cave-entrance/treasure-chests, palette in 5 files; cave-scenery/outland-scenery instance batches left (different operation); 363/363; note: batcher API carries 7 add/5 build options to reproduce 3 call sites exactly; base 104262a; proof = tests/golden-scenery.test.mjs (+ treasure-chests golden) |

## Phase 2 — import normalization, M6–M11, CSS

| ID | Wave | Model | Title | Owns | Depends | Status | Branch | Port | Commit | Notes |
|---|---|---|---|---|---|---|---|---|---|---|
| T2-1 | 2.0 | haiku | Three import normalization | all dist/*.js | G1.5 | todo | — | — | — | solo wave |
| M6 | 2.1 | sonnet | player-motion.js | dist/main.js, 1 new, tests/mouse-targeting.test.mjs | T2-1 | todo | — | — | — | |
| T2-2 | 2.1 | — | tokens.css | — | — | dropped | — | — | — | after T0-5 only two :root blocks remain (style.css for the game, character-studies.css for a dev page) and they deliberately differ (--muted, --line, --bright); only --gold/--serif/--sans are shared. Not worth an agent under the no-visible-change rule |
| T2-3 | 2.1 | — | value-noise dedup | — | — | dropped | codex/noise-dedup-16edff21-b85b (unused) | 5828 | — | on inspection the three copies are not one algorithm: two are GLSL chunks sharing only `hash`+`noise` (~200 B), map-fog.js is an imul value-noise in JS, environment.js is random speckle. Not worth an agent; a shared GLSL chunk can ride along with P3/P8 if those touch the shaders |
| M7 | 2.2 | sonnet | hud.js, game-audio.js | dist/main.js, 2 new | M6 | todo | — | — | — | |
| T2-4 | 2.2 | opus | chronicle.css layering map (docs only) | docs/refactor/CSS-LAYERS.md | — | merged | codex/css-layers-map-0ee3d5d2-be1b | 5386 | 8629b4f → 6695720 | docs-only (833 lines); 96 shared selectors (not 108) across 8 sheets; 120 deletable whole rules = 5,898 B; §4 is the T2-5 spec (merged overlay block verified via CSSOM at 3 viewports × 4 states, 0 diffs); §5 is the T2-6 execution list; roster/inventory/dialogue screens not live-verified; folded into Gate 1.3 since it is disjoint |
| T2-5 | 2.2 | sonnet | #connection-overlay triplicate | dist/{style,chronicle,title-screen}.css | T2-4 | merged | codex/connection-overlay-87dc45f9-192b | 6130 | 4119482 → 124d7ad | started early from eb359f9 (disjoint CSS-only); spec = CSS-LAYERS.md §4; orchestrator static review clean: 38 rules deleted + 3 mixed rules rewritten, merged block == T2-4 spec byte-for-byte (whitespace-insensitive) at the old chronicle position, keyframes kept, no empty @media; computed-style golden 707,340 readings / 0 diffs (6 states × 5 viewports, whole-document hashes); bytes style −1107, title-screen −1575, chronicle +1442; 13-shot compare 11/11 within threshold, 07-connection-overlay 0 px (re-run by orchestrator); committed 4119482 |
| M8 | 2.3 | sonnet | modals.js, inventory-ui.js | dist/main.js, 2 new, tests/modals.test.mjs | M7 | todo | — | — | — | |
| T2-6 | 2.3 | opus | chronicle.css dead-rule deletion | dist/chronicle.css + shadowed base files | T2-4, T2-5 | running | codex/chronicle-dead-rules-b0bcefb1-0c97 | 5670 | — | opus; started early stacked on T2-5 (git merge of codex/connection-overlay-87dc45f9-192b, commit 4119482) from 192c828; batches A,B,C,E,F,G,H (D skipped); proof = whole-document computed-style goldens ×5 viewports per stage + 33 shot pairs at 1440/1024/390; captures queue behind M3 and T2-5 |
| M9 | 2.4 | opus | session-lifecycle.js, connection-ui.js | dist/main.js, 2 new, tests/game-mode-choice.test.mjs | M8 | todo | — | — | — | |
| M10 | 2.5 | opus | snapshot-apply.js, network-events.js, shared-world-render.js | dist/main.js, 3 new, tests nightblade-appearance/snapshot-apply | M9 | todo | — | — | — | verbatim |
| M11 | 2.6 | opus | scene-setup.js, render-loop.js, automation-surface.js, composition root | dist/main.js, 3 new, tests/automation-surface.test.mjs | M10 | todo | — | — | — | |

## Phase 3 — performance

| ID | Batch | Model | Title | Owns | Depends | Status | Branch | Port | Commit | Notes |
|---|---|---|---|---|---|---|---|---|---|---|
| P1 | 3.1 | sonnet | pointer rect cache | dist/mouse-targeting.js, tests/mouse-targeting-pick.test.mjs | G2.6 | merged | codex/pointer-rect-cache-b12662a3-0faa | 5896 | 00393b9 → 83bc689 | orchestrator review: 16-line diff (windowTarget option, cachedRect + invalidateRect on resize/scroll-capture/visualViewport resize+scroll/orientationchange, fallback = original call when no window); html,body{overflow:hidden} so no scrollbar can move the rect without an event; 11 new tests incl. 500-scenario parity vs verbatim pick(); 382/382 |
| P2 | 3.1 | sonnet | village-life per-frame allocs | dist/world-actors.js | G2.6 | merged | codex/village-life-allocs-c4339d1e-4d2e | 5541 | 9090375..d3b1f78 → fd0404e | orchestrator review: scratch Vector3 + pooled rects, sorted array cached behind dirty flag (pickup/addLoot/syncForage/syncLoot) + FNV struct key (npc count, mapId, drop/forage ids+claimed) — visibleNpcs() depends only on mapId so the key is complete; DOM writes guarded by read-back (hidden/class/left/top); 520-frame parity vs verbatim reference, shown load-bearing; allocation test ≤5 Vector3 per 100 calls vs ≥2×items; perf-smoke case added (0.0080→0.0058 ms/op); 373/373; orchestrator re-ran 19 related tests green |
| P3 | 3.1 | sonnet | light-source array | dist/combat-effects.js | G2.6 | merged | codex/light-source-array-d73101a9-fcab | 5489 | 90759d9..7885898 → 72ec9e0 | dist change approved (strict-greater top-two scan == stable sort positions 0/1 for all tie patterns); tests: 2000-frame mirror parity + toString()-based source guard (mirror verbatim in dist) + 600-frame parity of the REAL update() via public API with bolts spawned/disposed mid-run + zero-map-calls allocation check; 375/375; re-run by orchestrator 11/11 |
| P4 | 3.2 | sonnet | minimap | dist/exploration-map.js | G2.6 | blocked | codex/minimap-cache-c45ef24b-3d88 | 6185 | — | worktree registered but NOT started: the fog-blur cache cannot be pixel-identical while the player moves (origin changes every frame) and LOS caching is a small win; revisit after M11 with browser measurement |
| P5 | 3.2 | opus | snapshot + clone | dist/world.js, dist/local-session.js, tests/snapshot-aliasing.test.mjs | G2.6 | merged | codex/snapshot-clone-7e1bfefc-0db0 | 5605 | 22cdcdf..953582a → 22b7207 | aliasing test written first and failing on main (state.*, loot, forage, events, enemies[].aim aliased); fix = 2-line detach() on state/loot/events, {...patch} for FORAGE_PATCHES, aim rebuilt in place; structuredClone dropped in publish; 14/14 on orchestrator re-run; equivalence 80 checkpoints vs tests/fixtures/world-ref.js; perf-smoke advance 0.120→0.075 ms (−37..52%), snapshot+clone 0.227→0.083 ms; aim now copied with {...e.aim} (953582a); 376/376 |
| P7 | 3.2 | haiku | orb disposal | dist/resource-orbs.js, tests/resource-orbs.test.mjs | G2.6 | dropped | — | — | — | createResourceOrbs() runs once at boot (main.js:51) and the HUD orbs live for the whole page; nothing ever tears them down, so a dispose() would be uncalled dead code (no leak). Revisit only if M9 introduces a teardown path. |
| P6a | 3.3 | opus | render loop | dist/render-loop.js | G2.6 | todo | — | — | — | proves split cost nothing |
| P6b | 3.3 | sonnet | region labels + hazards | dist/region-travel.js | G2.6 | ready-to-merge | codex/region-render-cache-fe44b0f6-8b3c | 6142 | 8463ffe | orchestrator review: module-scope Sets/scratch Vector3/WeakMap for .loot-name, writes guarded by read-back (textContent/hidden/in-reach/left/top, hazard fill opacity+color); 520-frame parity vs verbatim reference; 0 Vector3/Set allocations per warm frame vs 700/200; 419/419; re-run 9/9 |
| P6c | 3.3 | sonnet | HUD writes | dist/hud.js | G2.6 | todo | — | — | — | |
| P6d | 3.4 | sonnet | enemy sync + bars | dist/shared-world-render.js, dist/enemy-spawner.js | G2.6 | todo | — | — | — | |
| P6e | 3.4 | sonnet | interaction memo | dist/interaction.js, dist/pointer-targeting.js | G2.6 | ready-to-merge | codex/interaction-memo-90ff650c-90f2 | 6134 | ab85658..c17f64e | orchestrator review: memo keyed on lastSnapshot/interactions/state/discoveries identity + length; callers verified read-only; one pre-existing test mutated a snapshot in place and was changed to swap the snapshot (matches the real contract); 600-scenario parity + frozen-consumer test; perf-smoke row 0.0031→0.0000 ms, 5,364→44 B; 422/422; re-run 17/17. Note: window.hallowmere.getState().interactions now returns the memoized array instance (read-only by contract) |
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
- 2026-09-15 — Gate 0B: T0-1 merged (bcc7b62), T0-3 merged (d744fb4). T0-4, T0-7 integrating.
- 2026-09-15 — Gate 0B: T0-4 merged (7c82fe9), T0-7 merged (0803197). Main test count now 301. Wave 1.1 launched from 0803197: M1 (opus), T1-1, T1-2 (sonnet).
- 2026-09-15 — T1-1 ready-to-merge (f2d8dea..5d18b26). Orchestrator re-ran the golden tests against main's original model files: pass. T1-3 started early in the freed slot.
- 2026-09-15 — T1-2 reported (605c711..b15419d, 305/305), verified vs originals. Both T1-1 and T1-2 asked to add `visible` to the golden fingerprint (ranger weapon states hashed identically without it). T1-3 running with that spec baked in. Golden-test lessons for T1-4+: sort parameters keys, strip uuids, record visible.
- 2026-09-15 — T1-2 ready-to-merge (..46d397d); goldens re-verified vs originals after adding visible.
- 2026-09-15 — T1-1 ready-to-merge (..477d9da); goldens re-verified vs originals after adding visible.
- 2026-09-15 — T1-3 ready-to-merge (4c51968..3329674); verified vs originals. Will merge with gate 1.1 since files are disjoint.
- 2026-09-15 — T1-4 and T1-6 started early in freed slots (3 agents running: M1, T1-4, T1-6).
- 2026-09-15 — M1 reported 3 commits (3c16270..6a3f690); static review clean; visual/perf evidence still running in the agent.
- 2026-09-15 — T1-4 ready-to-merge (016b5fe..84a2a06); GLB regeneration compared by the orchestrator: 9/9 equal. T1-7 starting in the freed slot.
- 2026-09-15 — T1-7 ready-to-merge (d5c74cc). T1-5 starting in the freed slot.
- 2026-09-15 — M1 visual evidence verified by orchestrator (11/11). Gate 1.1 requested for M1 + T1-1, T1-2, T1-3, T1-4, T1-7 (all disjoint). T1-5/T1-6 join gate 1.2.
- 2026-09-15 — Gate 1.1 authorized by the user (M1, T1-1, T1-2, T1-3, T1-4, T1-7); chain 1 (T1-1, T1-2) integrating. M1 final evidence in: perf within band; draw-call column found to vary with the random world seed (also seen by T1-6) → PERF.md now says draw calls are not an identity check. T1-5 and T1-6 verified and ready; they join gate 1.2.
- 2026-09-15 — Gate 1.1: T1-1 merged (5d35fbf), T1-2 merged (2c2059a). Chain 2 (T1-3, T1-4) next; T1-8 worktree registered.
- 2026-09-15 — Gate 1.1: T1-3 merged (0414a23), T1-4 merged (c1533d7). Chain 3 (T1-7, M1) integrating.
- 2026-09-15 — T1-8 ready-to-merge (caa6e35..f01fb2d). Gate plan adjusted: G1.2 = T1-5, T1-6, T1-8 (all ready, disjoint from M2) so T1-9/T1-10 can start sooner; G1.3 = M2, T1-9, T1-10.
- 2026-09-15 — Gate 1.1 complete: T1-7 (3f75255), M1 (7453fc3). Gate 1.2 authorized (T1-5, T1-6, T1-8). M2 worktree registered from 7453fc3.
- 2026-09-15 — M2 launched from 7453fc3. Gate 1.2 chain A (T1-5, T1-6) integrating.
- 2026-09-15 — Gate 1.2: T1-5 merged (4a44dfe), T1-6 merged (104262a). T1-9 and T1-10 registered from 104262a. T1-8 + tracker integrate next.
- 2026-09-15 — Gate 1.2 complete (T1-8 + tracker merged). Fresh tracker branch opened.
- 2026-09-15 — T1-9 reported (62aa3ac); dist edits correct, two doc links broken (asked to fix). openMainMenu confirmed: no in-game caller, only the vm test calls it.
- 2026-09-15 — T1-9 ready-to-merge (62aa3ac..01591da).
- 2026-09-15 — T2-3 dropped after inspection (no real duplication left to remove). hm-T2-3 worktree registered but unused.
- 2026-09-15 — T2-2 dropped (nothing meaningful left to unify). T2-4 started early (CSS layering map, docs only).
- 2026-09-15 — T1-10 ready-to-merge (1481405..f006275).
- 2026-09-15 — M2 reported 3 commits (c10d089..0ab66ff); static review clean; visual/perf evidence pending.
- 2026-09-15 — M2 ready-to-merge: 11/11 shots within threshold. T2-4 reported (8629b4f), docs-only, ready-to-merge and folded into Gate 1.3. Awaiting Gate 1.3 authorization (M2, T1-9, T1-10, T2-4).
- 2026-09-15 — T2-5 started early (sonnet) from eb359f9 while Gate 1.3 awaits authorization; dependency on T2-2 dropped (T2-2 was dropped), now depends only on T2-4's map.
- 2026-09-15 — Gate 1.3 authorized (M2, T1-9, T1-10, T2-4). T1-9 merged (2584e0b), T1-10 merged (7bd89fb). M2 + T2-4 integrating.
- 2026-09-15 — Gate 1.3: M2 merged (0dd0d90), T2-4 merged (6695720). main = 6695720. hm-M3 registered from it; tracker integrates next.
- 2026-09-15 — M3 started (sonnet) from 6695720. Tracker integrating; fresh tracker branch follows.
- 2026-09-15 — Gate 1.3 complete (tracker merged 192c828). main = 192c828. Fresh tracker branch codex/refactor-tracker-e2d76bc0-6085. Running: M3 (sonnet), T2-5 (sonnet). T2-6 prompt staged.
- 2026-09-15 — T2-5 static review clean (edit uncommitted, agent waiting on its screenshot suite); 0/707,340 computed-style diffs.
- 2026-09-15 — M3 static review clean (uncommitted; agent waiting on its captures).
- 2026-09-15 — Incident: an orphaned headless Chrome from the M1 perf-browser run (started 01:10, unlocked frame rate, ~2.6 cores for 8 h) plus M3 and T2-5 capturing concurrently drove load to 71 on 10 cores; every HUD-dependent scenario timed out. Orphan killed; captures now serialized (M3 first, then T2-5). Rule recorded: one screenshot/perf-browser run at a time across all worktrees.
- 2026-09-15 — User raised the concurrency cap. Running now: M3, T2-5 (review), T2-6, P1, P2, P3, P5 (7 agents). Phase 3 tasks P1/P2/P3/P5 pulled forward because their files are disjoint from every remaining main.js step; T2-1 stays solo; P-agents may not run Chrome (screenshot/perf-browser) — orchestrator measures browser perf per batch. P4 registered but deferred.
- 2026-09-15 — P3 reported (90759d9); code approved; test strengthening requested (one round).
- 2026-09-15 — P1 ready-to-merge (00393b9). M3 shots verified by orchestrator; M3 perf re-run (first run overlapped a stray M2 perf run, both killed). Found the deadlock cause: scripts/screenshot.mjs never exits after a scenario retry; hm-T0-8 opened for the fix.
- 2026-09-15 — T0-8 committed (f13896a): browser scripts exit explicitly; T2-6 told to merge it before its captures.
- 2026-09-15 — P3 ready-to-merge (90759d9..7885898) after the test-strengthening round.
- 2026-09-15 — M3 perf accepted after a same-conditions A/B against main (PERF.md baseline was taken on an idle machine). T0-8 verified on the perf-browser path. Marker restored; T2-5 capture may start.
- 2026-09-15 — M3 ready-to-merge (48bf571..6a97e6d). M4 started stacked on M3. Gate 1.4 candidates: M3, T2-5 (capture running), P1, P3, T0-8.
- 2026-09-15 — P5 reported (22cdcdf..c3d5899); approved in substance; one-line robustness change requested (aim copy).
- 2026-09-15 — P5 ready-to-merge (22cdcdf..953582a).
- 2026-09-15 — P2 ready-to-merge (9090375..d3b1f78).
- 2026-09-15 — T2-5 ready-to-merge (4119482). Gate 1.4 requested: M3, T2-5, P1, P2, P3, P5, T0-8.
- 2026-09-15 — Gate 1.4 authorized (M3, T2-5, P1, P2, P3, P5, T0-8). Integrating in order M3, T2-5, T0-8, P1, P2, P3, P5, tracker.
- 2026-09-15 — Gate 1.4: M3 merged (fedac5e), T2-5 merged (124d7ad). T0-8 + P1 integrating.
- 2026-09-15 — Gate 1.4: T0-8 merged (1044804), P1 merged (83bc689). P2 + P3 integrating.
- 2026-09-15 — Gate 1.4: P2 merged (fd0404e), P3 merged (72ec9e0), P5 merged (22b7207). Tracker integrating; fresh tracker branch follows. Running: M4 (stacked on M3, now on main), T2-6 (stacked on T2-5, now on main).
- 2026-09-15 — Gate 1.4 complete (tracker merged 76b757a). main = 76b757a; 27 tasks merged. Fresh tracker branch codex/refactor-tracker-e2d76bc0-2243. Running: M4, T2-6. Next candidates: M5 (stack on M4 after it commits), P7/P8 after M4/M7 land, T2-1 solo after M5.
- 2026-09-15 — M4 reported (8e7cf7b..1cc12f6); static review clean; main merged into the M4 branch (perf-smoke conflict resolved, both cases kept); capture pending.
- 2026-09-15 — M4 ready-to-merge (8e7cf7b..85e0fd5, includes merge of main). Post-Gate-1.4 smoke: 11/11 shots on main+M4. Gate 1.5 requested for M4. M5 running (opus, stacked on M4). T2-6 running.
- 2026-09-15 — Gate 1.5: M4 merged (2e9d56c). Tracker integrating; fresh tracker branch follows.
- 2026-09-15 — Gate 1.5 complete (tracker e20872f); main = e20872f. P7 dropped (orbs are page-lifetime). M5 reported (41aa1a5..29f46a4), static review clean. P6b + P6e registering (file-disjoint from M5/T2-6).
- 2026-09-15 — P6b and P6e started (sonnet) from e20872f. M5 capture queued. Plan: T2-1 solo after P6b/P6e land, then M6.
- 2026-09-15 — M5 ready-to-merge (41aa1a5..21ab917 incl. merge of main). Gate 1.6 requested.
- 2026-09-15 — Gate 1.6: M5 merged (ee26424). Phase 1 main.js steps (M1–M5) complete. Tracker integrating.
- 2026-09-15 — Gate 1.6 complete (tracker 0c24cd6); main = 0c24cd6. P6b and P6e ready-to-merge; Gate 1.7 authorized, integrating. Next: T2-1 solo (three import normalisation), then M6.
