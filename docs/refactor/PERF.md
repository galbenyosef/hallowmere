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
