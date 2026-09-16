# Performance baseline for the dist/ refactor

Two harnesses, both reporting tools: neither is wired into `npm test`, and both exit 0 unless they throw.
All numbers below come from an unmodified tree at `ff9a17fd886fa8b21820140676c9249df3abc38b`
(`git rev-parse main`), Node v25.2.0, Apple M1 Pro / macOS.

> **Rule.** Any task that claims a performance change must run both harnesses before and after and paste
> the before/after tables into its report. A refactor that claims "no behaviour change" should show the
> simulation table unchanged within noise and `bytes/op` unchanged outright.

## `scripts/perf-smoke.mjs` — headless simulation

```sh
bash scripts/node22.sh node --expose-gc scripts/perf-smoke.mjs
bash scripts/node22.sh node --expose-gc scripts/perf-smoke.mjs --json
bash scripts/node22.sh node --expose-gc scripts/perf-smoke.mjs --n 4000 --batches 7
```

Seed `20240915`, 2000 ops x 5 batches per metric, a fresh world per batch so the workload is identical
run to run, a warm-up pass before any batch is recorded, and `global.gc()` before each batch.
`--expose-gc` is what makes `bytes/op` meaningful; without it that column reads `n/a` and the timings
still stand. Timing uses `process.hrtime.bigint()`; the reported figures are the median and p95 of the
five batches' ms/op.

### Baseline (3 consecutive runs)

| Metric | median ms/op (runs 1/2/3) | spread | p95 ms/op | bytes/op |
| --- | --- | ---: | ---: | ---: |
| `World#step(TICK_SECONDS)` | 0.0807 / 0.0806 / 0.0916 | 13.7% | 0.1426 | 2,729 |
| `World#snapshot(playerId, lastEvent)` | 0.0718 / 0.0745 / 0.0673 | 10.7% | 0.0800 | 5,947 |
| `structuredClone(snapshot)` | 0.1717 / 0.1567 / 0.1528 | 12.4% | 0.1703 | 2,958 |
| `LocalSession#advance(1/60)` | 0.1204 / 0.1268 / 0.1145 | 10.7% | 0.1370 | 5,315 |

Run-to-run spread is 10-14%, at the edge of the +/-10% target; the machine carried a load average near 16
from unrelated work while these were taken, and a quiet machine lands nearer 5%. **Treat a timing change
under ~15% as noise and re-measure back to back.** `bytes/op` is the stable column — it varied by under
2% across all six runs recorded during this task — so it is the one to watch for an allocation
regression from the module split.

`LocalSession#advance(1/60)` is the real 20 Hz publish path: three calls out of every ~three drive one
`world.step` plus a `structuredClone`'d snapshot through the session's `onSnapshot` callback (no-ops
here). The harness leaves a `// hooks for later phases` marker where `regionInteractions` and
`VillageLife.renderLabels` rows belong once those are importable outside the browser bundle — both need
a DOM / three.js surface today.

## `scripts/perf-browser.mjs` — in-browser frame times

```sh
bash scripts/node22.sh node scripts/perf-browser.mjs            # unlocked frames (default)
bash scripts/node22.sh node scripts/perf-browser.mjs --vsync     # paced at the display refresh
bash scripts/node22.sh node scripts/perf-browser.mjs --json --runs 3
bash scripts/node22.sh node scripts/perf-browser.mjs --url http://127.0.0.1:5182
```

Reuses the launch/CDP helpers from `scripts/screenshot.mjs`, drives the `04-hud-spawn` scenario, then
samples 300 frames idle and 600 frames while walking three fixed waypoints around the Ashwick spawn via
the `control_warden` assistive tool. Per-frame deltas come from `requestAnimationFrame`, draw calls from
`window.hallowmere.getState().drawCalls`, and the heap delta from `performance.memory.usedJSHeapSize`
before and after. Three runs, medians reported. Takes about 6 minutes.

By default Chrome is launched with `--disable-frame-rate-limit --disable-gpu-vsync`, so
`requestAnimationFrame` is not paced by the display and each delta measures what the frame actually
costs. `--vsync` restores the paced mode. Both baselines below were taken on the platform GPU
(ANGLE Metal), which is what `openBrowser` picks when SwiftShader is not requested; `screenshot.mjs` is
unaffected by either flag.

### Baseline — unlocked (default), medians across 3 runs, platform GPU

| Phase | frames/run | p50 ms | p95 ms | p99 ms | median draw calls |
| --- | ---: | ---: | ---: | ---: | ---: |
| idle at spawn | 300 | 6.30 | 8.20 | 9.30 | 540 |
| walking 3 waypoints | 600 | 6.70 | 10.00 | 11.40 | 564 |

JS heap delta over the run: **8.79 MB** (ending at 73.5 MB).

### Baseline — paced (vsync), medians across 3 runs, platform GPU

| Phase | frames/run | p50 ms | p95 ms | p99 ms | median draw calls |
| --- | ---: | ---: | ---: | ---: | ---: |
| idle at spawn | 300 | 16.70 | 16.80 | 16.80 | 545 |
| walking 3 waypoints | 600 | 16.70 | 16.70 | 16.80 | 611 |

JS heap delta over the run: **3.95 MB** (ending at 76.0 MB).

### Read these numbers carefully
> **Draw calls are not an identity check.** The world seed is `crypto.getRandomValues` per page load, so different scenery is in frame on every run: unmodified runs on the same commit ranged 521–549 idle and 564–618 walking. Compare medians of at least 3 runs and treat differences under ~5% as noise; geometry-level identity is proven by the golden fingerprint tests, not by this column.


**Headless frame times are not GPU frame times.** Neither table says anything about how the game runs on
a real machine. They are useful only as a relative before/after comparison on the same machine in the
same conditions, and must never be quoted as the game's real performance.

Compare unlocked against unlocked. In the unlocked table the percentiles are live: p50 ~6.3-6.7 ms with
p95/p99 trailing up to ~11 ms, so **frame times, median draw calls and the heap delta are all sensitive
columns** and a regression in per-frame work shows up directly.

The paced table is kept for reference and as a budget check. There every percentile reads ~16.7 ms
because `requestAnimationFrame` is pinned to the display cadence, so it only answers "does a frame still
fit inside 60 fps" — useful once, useless for spotting a 20% slowdown. Do not read the two tables against
each other; the heap deltas differ between them for the same reason (many more frames run in the same
wall-clock sampling window when frames are unlocked).

## After the refactor (2026-09-15)

Same-machine A/B, unlocked frames, SwiftShader, run back to back on a quiet machine: the pre-refactor
tree (`ff9a17f`, with today's `scripts/perf-browser.mjs` copied in) against the final `main`
(`1d8ecc6`: M1–M11, T2-1, T2-5, T2-6, P1–P3, P5, P6a–P6e, P8). The PERF.md baseline table above was
taken on an idle machine at 01:00 and is not directly comparable with daytime runs; only paired runs are.

| Tree | Phase | p50 ms | p95 ms | p99 ms | median draw calls | JS heap delta |
| --- | --- | ---: | ---: | ---: | ---: | ---: |
| `ff9a17f` (before) | idle at spawn | 6.30 | 8.30 | 10.30 | 534 | +2.24 MB (ends 77.6 MB) |
| `ff9a17f` (before) | walking 3 waypoints | 6.80 | 10.00 | 11.60 | 621 | |
| final `main`, run 1 | idle at spawn | 6.00 | 7.30 | 8.00 | 533 | −7.91 MB (ends 68.1 MB) |
| final `main`, run 1 | walking 3 waypoints | 6.40 | 8.60 | 10.00 | 576 | |
| final `main`, run 2 | idle at spawn | 6.00 | 7.00 | 7.70 | 559 | +3.05 MB (ends 79.7 MB) |
| final `main`, run 2 | walking 3 waypoints | 6.80 | 8.80 | 10.10 | 624 | |

Read it as: p50 within noise (the split itself cost nothing, which is what P6a re-measured), p95 down
~13–16% and p99 down ~13–25% in both phases — the tail is where the removed per-frame allocations,
guarded DOM writes and the dropped `structuredClone` show up. Draw calls vary with the random world
seed and are not an identity check (see the caveat above). The heap-delta column swings with GC
timing between runs (one run ended 12 MB lower, one 2 MB higher) and is indicative only.

### Node rows, final tree (`scripts/perf-smoke.mjs --expose-gc`, n=2000, medians of 5 batches)

| Metric | median ms/op | p95 ms/op | bytes/op | Task |
| --- | ---: | ---: | ---: | --- |
| `World#step(TICK_SECONDS)` | 0.0701 | 0.0877 | 1,670 | unchanged |
| `World#snapshot(playerId, lastEvent)` | 0.0706 | 0.0732 | 571 | P5 (was ~6,000 B/op with the clone) |
| `structuredClone(snapshot)` | 0.1499 | 0.1505 | 2,768 | reference row; no longer on the runtime path |
| `LocalSession#advance(1/60)` | 0.0532 | 0.0639 | 9,322 | P5 (0.120 → 0.075 in the task's own A/B; 0.053 here) |
| `createInteraction(ctx).regionInteractions()` | 0.0000 | 0.0001 | 44 | P6e (0.0031 ms, 5,364 B before) |
| `VillageLife#renderLabels` | 0.0055 | 0.0065 | 7,920 | P2 (0.0080 before) |

Per-task allocation proofs live in the tests: P3 `combat-effects` (0 map calls/frame), P6b
`region-travel` (0 Vector3/Set per frame vs 700/200), P6c `hud` (0 writes / 0 querySelector per
unchanged frame vs ≥20), P6d `shared-world-render` (0 Vector3/Set per frame) and `enemy-spawner`
(bar canvas redrawn only when its inputs change), P6a `render-loop` (0 Vector3 per frame; safeHere
2000 → 100 calls per 100 frames), P8 `effects-factory` (222/222/78/78 constructions per 300 events
→ 14/9/8/4).
