# Village combat freeze: investigation and fix plan

Status: **plan only, not yet implemented.** Target: this weekend.

## 1. The report

"the game gets a little slow/freezes when i get close to a village and fight" (user, 2026-09-16).

## 2. What was already fixed (merged, keep it)

The first hypothesis was WebGL shader-compile stalls: several files build `T.ShaderMaterial`
instances (and one `onBeforeCompile` patch) lazily, the first time a gameplay event needs one,
and a browser compiles a shader program synchronously the first time it's actually drawn — a
well-known 50-300ms main-thread stall. `dist/effects-warmup.js` (new) now builds one throwaway
of each of the 20 lazily-built shapes during the loading screen and hands them to
`ctx.renderer.compile()` once, before the animation loop starts, so that cost lands on a frame
the player never sees instead of their first real fight. Merged as `504816e` (19 programs:
combat-effects/loot-effects/class-effect-materials/enemy-visuals' energy orb) and `2153134`
(the 20th: enemy-visuals' `enchantBody`, the `large`/`orb` enemy body enchantment used by
`gravecaller`/`bone-colossus`, which patches a built-in `MeshStandardMaterial` shader rather
than building a `T.ShaderMaterial`, so it needed its own throwaway + its own way to detect it
in tests since `shaderSources()` only sees real `ShaderMaterial`s).

This is real and worth keeping, but **measurement after both merges showed it was not the
dominant cause**: `scripts/perf-village-combat.mjs` (new, `7527c6b`; walks a scripted route to
the Hallowmere village and holds attack while sampling raw frame deltas — route corrected in
`6d3dcd6` after two live deaths to encounters the first two route attempts didn't account for,
see that commit for the full story) showed max combat-frame time drop from **328ms to 149ms**,
but **p99 barely moved: 135.2ms before, 134.6ms and 131-177ms across runs after**. A one-time
compile cost should all but disappear after warming; a cost that keeps recurring at the same
magnitude across hundreds of frames is a different bug.

## 3. The real dominant cause: `findPath`'s A* search

Diagnosed by tagging every combat frame that took >30ms with its position in the sample batch
(see the commit history around this doc for the throwaway diagnostic script — not committed,
its job was done once it pointed here). Findings:

- The large frames are **scattered evenly across combat**, not clustered at any particular
  event (not batch boundaries, not the CDP round-trip of re-issuing the attack command — that
  is consistently 2-27ms, checked directly). ~30-40 frames over 500 (~6-8%) land at 120-235ms.
- That pattern — frequent, recurring, roughly constant magnitude — is what a repeatedly-invoked
  expensive function looks like, not what a fixed set of one-time compiles looks like.

`dist/combat.js`'s `findPath(start, goal, obstacles, bounds)` (an A* search over a `step=0.5`
grid) is called from three places:

| Call site | When | Throttled? |
| --- | --- | --- |
| `dist/world.js:162` (`seek()`) | every enemy, whenever it can't see its target | once per 1.1s per enemy (`e.navAt`) |
| `dist/player-motion.js:31` | player auto-following a locked enemy once melee line of sight breaks | only when `ctx.movePath` is empty (not time-throttled) |
| `dist/pointer-targeting.js:45` (`setDestination`) | every click-to-move | not throttled at all |

`findPath` already has a cheap early exit: if `start` and `goal` have direct line of sight, it
returns a short interpolated path in well under 1ms. **The moment a building blocks that line —
routine near a village, which is exactly where the buildings are — it falls through to the full
grid search**, and the search is expensive: every expanded node checks up to 8 neighbors, and
for each surviving neighbor calls `hasLineOfSight()` **uncached**, which does
`obstacles.some(...)` over all 337 obstacles. (`blocked()`, the sibling check right next to it,
*is* cached per grid cell within one `findPath` call — `hasLineOfSight` is not.)

Measured directly with `scripts/p9-findpath-bench.mjs` (new, this doc's companion — real
`findPath`/`hasLineOfSight` from `dist/combat.js`, real obstacle data from
`dist/world-layout.js`'s `createWorldLayout()`, no browser needed since `combat.js` is DOM-free
core):

| Trip | direct LOS | path waypoints | ms |
| --- | --- | ---: | ---: |
| around west-cottage | true | 33 | 0.47 |
| around grave-house | false | 37 | 130.93 |
| the long way round | false | 75 | 360.03 |
| toward the chapel | false | 47 | 120.35 |

Obstructed-path average: **~153ms per call**. A village encounter spawns up to 12 enemies
simultaneously; 12 obstructed `findPath` calls landing in the same tick (plausible if their
1.1s throttles happen to sync up, which nothing currently prevents) cost **1192ms total,
~99ms average each** — several full seconds of accumulated stall potential, spread across
whichever frames those calls land on. A single 60fps frame budget is 16.7ms; one obstructed
call alone blows it by 6-20x.

This is a materially better match for "gets slow while fighting near a village" than a one-time
compile stall: it's not a single hitch, it recurs constantly for as long as the player and
several enemies are maneuvering around buildings, which is the entire duration of village
combat.

## 4. Why this wasn't already caught

P4 (the refactor's deferred minimap task, investigated and closed 2026-09-16 with "no safe win
found") benchmarked `hasLineOfSight` too, but for a *different* caller: `drawExplorationMap`'s
per-enemy visibility check, called once per enemy per 11Hz minimap redraw — cheap because it's
one call per enemy, not embedded in a search that calls it dozens or hundreds of times per
invocation. Both benchmarks are correct for what they measured; `findPath`'s internal call
pattern is a distinct, previously unmeasured consumer of the same primitive.

## 5. Fix options

### Option A (recommended): spatial index the obstacle list

`hasLineOfSight`/`pointBlocked` both take the full `obstacles` array and scan all of it,
regardless of how close the query point/segment actually is. Almost every obstacle in a 337-item
list is nowhere near a given short grid-search segment and can't possibly intersect it. Bucket
obstacles into a uniform spatial grid (cell size on the order of the largest obstacle, e.g.
2-4 units) once per distinct `obstacles` array, cache that index by array identity (a
`WeakMap<obstacles, index>` — `ctx.environment.obstacles`/`this.obstaclesFor(e)` are stable
per map load, rebuilt only on region travel), and have `hasLineOfSight`/`pointBlocked` query
only the handful of cells a point or segment actually touches instead of the whole array.

- **Behavior:** must be provably identical — same obstacles either way, just found faster. This
  is a performance-only change if done correctly, not a pathfinding/gameplay change.
- **Risk:** `hasLineOfSight`/`pointBlocked`/`findPath` are in `dist/combat.js`, part of the
  DOM-free core shared verbatim with the server (`server/*.mjs` shims) and covered by
  `tests/core-purity.test.mjs` — the index must stay DOM-free and Three-free, same constraint
  every other core module already meets.
- **Proof needed before merging** (same discipline as T1-6's LCG-unification proof and P5's
  aliasing test): a parity test asserting `hasLineOfSight`/`pointBlocked`/`findPath` return
  identical results before and after, across many random point pairs and the real obstacle
  list — indexed lookup must never silently miss an obstacle a full scan would have found.
- This is the primary recommendation: it fixes the cost at its actual source (an O(n) scan
  running inside an O(nodes × neighbors) search) without touching pathfinding quality, throttle
  behavior, or any of the three call sites.

### Option B (smaller, could land independently or as a stopgap): tighten throttling

`dist/player-motion.js`'s and `dist/pointer-targeting.js`'s `findPath` calls aren't time-
throttled at all (only "don't call again while the current path still has waypoints left" for
the player-motion one). Under Option A alone this may no longer matter much, but if further
measurement after Option A still shows spikes, consider whether the *player's* combat-follow
path recompute could share `world.js`'s enemy pattern (a minimum interval between recomputes)
without feeling laggy to the player. Lower value than Option A on its own since it reduces
*frequency*, not the *cost per call* that's actually blocking the thread — worth revisiting
only if Option A's measured improvement isn't enough.

### Not recommended: capping A* node expansions / coarsening the grid

Would reduce worst-case cost but changes what paths look like (enemies/player could take
visibly worse routes, or `findPath` could start returning `[]` for trips it currently solves) —
an observable gameplay change, not a pure performance win, and against this project's standing
"strict no observable change" rule. Only consider this if Option A turns out insufficient and
the tradeoff is discussed explicitly.

## 6. Verification plan

1. Land Option A behind the existing parity/purity tests (`tests/core-purity.test.mjs` must stay
   green; add a new equivalence test in the same spirit as `tests/random.test.mjs`'s LCG proof).
2. Re-run `scripts/p9-findpath-bench.mjs` — the obstructed-trip numbers above are the baseline to
   beat; the direct-LOS row (0.47ms) should be unchanged (that path never reaches the index).
3. Re-run `scripts/perf-village-combat.mjs --runs 3` before and after on the same machine back to
   back (same discipline as every other before/after in `docs/refactor/PERF.md`) — the number
   that matters is combat p99/max, not idle (idle already looked fine throughout this
   investigation).
4. Manual playtest near a village building with several enemies engaged, same as the refactor's
   own manual playtest discipline — confirm navigation still looks and feels correct, not just
   fast.

## 7. Suggested breakdown if split across tasks

One task is probably right-sized for this (it's one shared function plus its call sites, not a
multi-module refactor): the spatial index in `dist/combat.js`, the equivalence proof test, and
the before/after benchmark re-run. Model tier: this is a real high-risk seam (shared DOM-free
core, three call sites, a green test suite could hide a subtly-wrong obstacle lookup that only
shows up as an enemy occasionally walking through a wall) — worth the higher-tier model rather
than defaulting low, same reasoning the original refactor plan used for its own seam tasks
(main.js rewiring, the LCG unification, the snapshot/clone changes).
