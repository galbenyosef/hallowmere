// P9 investigation (post-refactor village-combat freeze report, 2026-09-16): synthetic node
// benchmark for dist/combat.js's findPath(), the A* grid search used both by the player's
// combat-follow logic (dist/player-motion.js), click-to-move (dist/pointer-targeting.js's
// setDestination), and every enemy's seek() when it cannot see its target (dist/world.js,
// throttled to once per 1.1s per enemy via e.navAt). No browser, no DOM: combat.js is part of
// the DOM-free core (tests/core-purity.test.mjs), so this runs findPath the same way the server
// does. Reporting tool only: never wired into `npm test`.
// Usage: bash scripts/node22.sh node scripts/p9-findpath-bench.mjs
//
// Uses the REAL imported findPath/hasLineOfSight from dist/combat.js (not a re-implementation)
// and the REAL obstacle data built by dist/world-layout.js's createWorldLayout() (337 obstacles:
// SCENERY_OBSTACLES plus every building's wall/furniture/door colliders) -- the same data
// docs/perf/village-combat-findpath.md's investigation used.
//
// Conclusion recorded at the time this was written: real cost, real win available. When a start
// and goal have direct line of sight, findPath short-circuits cheaply (sub-millisecond). The
// moment a village building blocks that line -- routine during combat near one -- it falls
// through to the full A* grid search, and each expanded node's uncached hasLineOfSight() call
// (the cached blocked() check right next to it is NOT the bottleneck) rescans all 337 obstacles.
// See docs/perf/village-combat-findpath.md for the fix plan. Kept here so a fix can be measured
// against these exact numbers, and re-run if obstacle density or the village layout changes.

import {findPath, hasLineOfSight} from '../dist/combat.js';
import {createWorldLayout} from '../dist/world-layout.js';

const {obstacles, buildings} = createWorldLayout();
const OVERWORLD_BOUNDS = {minX:-134.5, maxX:79.5, minZ:-81, maxZ:81};

// Start/goal pairs around the Hallowmere village buildings (dist/expansion-layout.js's OUTLANDS
// and dist/enemy-encounters.js's SPAWNS both place village content within roughly x:[-10,15]
// z:[-25,12]) -- the same shape of trip the player's combat-follow and every nearby enemy's
// seek() actually make when a fight breaks out near a wall.
const TRIALS = [
 {label:'around west-cottage', start:{x:-4,z:3}, goal:{x:6,z:-10}},
 {label:'around grave-house', start:{x:5,z:-1}, goal:{x:-8,z:-14}},
 {label:'the long way round', start:{x:-7.4,z:10}, goal:{x:2,z:-24}},
 {label:'toward the chapel', start:{x:0,z:0}, goal:{x:15,z:-20}},
 {label:'past the gatehouse', start:{x:-10,z:5}, goal:{x:10,z:-15}},
];

console.log(`${obstacles.length} obstacles, ${buildings.length} buildings (real dist/world-layout.js data)\n`);
console.log('| Trip | direct LOS | path waypoints | ms |');
console.log('| --- | --- | ---: | ---: |');
const costs = [];
for (const {label, start, goal} of TRIALS) {
 const los = hasLineOfSight(start, goal, obstacles, .42);
 const t0 = performance.now();
 const path = findPath(start, goal, obstacles, OVERWORLD_BOUNDS);
 const ms = performance.now() - t0;
 if (!los) costs.push(ms);
 console.log(`| ${label} | ${los} | ${path.length} | ${ms.toFixed(2)} |`);
}

// The realistic worst case this investigation actually caught live: several enemies (a village
// encounter spawns up to 12) whose navAt throttle happens to come due in the same tick, each
// needing a real obstructed path near the same buildings the player is fighting next to.
const N = 12;
const t0 = performance.now();
for (let i = 0; i < N; i++) {
 const trial = TRIALS[i % TRIALS.length];
 findPath(trial.start, trial.goal, obstacles, OVERWORLD_BOUNDS);
}
const totalMs = performance.now() - t0;
console.log(`\n${N} simultaneous obstructed findPath calls (worst-case same-tick re-path burst): ${totalMs.toFixed(2)}ms total, ${(totalMs/N).toFixed(2)}ms average`);
console.log(`Obstructed-path average across the ${costs.length} trials above: ${(costs.reduce((a,b)=>a+b,0)/costs.length).toFixed(2)}ms`);
console.log('\nFor comparison, a single 60fps frame budget is 16.7ms; one obstructed findPath call alone can exceed it 6-20x.');
