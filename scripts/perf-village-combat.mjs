// In-browser frame-time protocol for real combat near the Hallowmere village; reuses scripts/screenshot.mjs
// helpers along the pattern of scripts/perf-browser.mjs (idle-at-spawn / walking phases), but perf-browser
// never drives an actual fight, so it cannot see the bug this script exists to catch: WebGL shaders compiling
// synchronously on first use during combat (dist/combat-effects.js, dist/loot-effects.js) stall the frame that
// triggers them by hundreds of ms against a normal ~8.3ms frame.
// Usage: bash scripts/node22.sh node scripts/perf-village-combat.mjs [--runs 3] [--json] [--vsync] [--url http://…]
// Drives the 04-hud-spawn scenario, walks a route around the road-enemy pack to the Hallowmere village encounter
// (see ROUTE below for the geometry and why), holds an attack there, and samples raw frame deltas across several
// seconds of real combat.
// Frames run unlocked (--disable-frame-rate-limit --disable-gpu-vsync) so deltas measure frame cost, not the
// display cadence; --vsync restores the paced 60 Hz mode.
// HEADLESS SWIFTSHADER/ANGLE FRAME TIMES ARE NOT GPU FRAME TIMES. Use them only to compare before/after on the
// same machine in the same session; never quote them as the game's real performance.
// Reporting tool only: never wired into `npm test`; exits 0 unless it throws (dying en route to the village is
// a route/encounter-seed bug, not a sampling bug -- see moveTo below, which reports it clearly instead of
// sampling garbage).
import {withBrowser, playTo, evaluate, waitFor, tool, UNLOCKED_FRAME_FLAGS} from './screenshot.mjs';

const args=process.argv.slice(2);
const value=(name,fallback)=>{const i=args.indexOf(name);return i<0?fallback:args[i+1];};
const RUNS=Number(value('--runs',3)),JSON_OUT=args.includes('--json'),PACED=args.includes('--vsync');
const IDLE_FRAMES=300,COMBAT_FRAMES=500,COMBAT_BATCH=50; // combat sampled in batches so attack can be re-held (see once())

// Route from the Ashwick spawn (-66,5) to the Hallowmere village encounter (dist/enemy-encounters.js
// generateVillageEncounters/SPAWNS: 12 permanently-alive enemies near x∈[-8,10] z∈[-24,11], zone 'hallowmere').
// The direct line from spawn instead passes through a separate road-enemy pack (dist/enemy-encounters.js
// generateRoadPacks, zone 'road', roughly x∈[-53,-29] z≈2-8) whose non-boss aggro radius is 10.5 units
// (dist/region-combat.js updateRegionEnemy: `if(!e.engaged&&dist>(data.boss?15:10.5)&&e.hp===e.maxHp)return true`).
// A straight line from spawn to (-45,-22) -- the first leg of a route reported as safe elsewhere -- passes only
// ~11.8 units from that pack's nearest spawn center at closest approach, inside its aggro radius once a single
// enemy's placement jitter (dist/enemy-encounters.js `position()`, spread up to ~2.6) is added; this script's
// own verification run confirmed it live (see the task report: the pack aggroed on that leg and chased the
// character down, killing it right around (-45,-22)). So this route drops straight south first, pinned to
// spawn's own x=-66 (already ~9+ units west of the pack's x-band on its own), only turning east once z is deep
// enough south (-20) that the whole remaining path stays 20+ units from the pack's z≈2-8 band regardless of x
// -- a wide, unambiguous margin instead of a second borderline diagonal.
const ROUTE=[[-66,-20],[-45,-22],[-15,-18],[-4,-11]];

const percentile=(values,p)=>{const s=[...values].sort((a,b)=>a-b);return s[Math.min(s.length-1,Math.max(0,Math.ceil(p*s.length)-1))];};
const median=values=>percentile(values,.5);

const SAMPLER=`window.__sample=frames=>new Promise(resolve=>{
 const deltas=[],calls=[];let previous=null;
 const tick=now=>{
  if(previous!==null){deltas.push(now-previous);calls.push(window.hallowmere.getState().drawCalls??0);}
  previous=now;
  if(deltas.length>=frames)return resolve({deltas,calls});
  requestAnimationFrame(tick);
 };
 requestAnimationFrame(tick);
});true`;

const PLAYER_STATE=`(()=>{const s=window.hallowmere.getState();return {hp:s.hp,ended:!!s.ended,x:s.player?.x??null,z:s.player?.z??null};})()`;
// Movement runs in real wall-clock time, not accelerated: issue the move, then poll (via waitFor's in-page
// loop, same idiom as screenshot.mjs's '11-npc-dialogue' walk-to-Rowan) until arrival, death or ended.
async function moveTo(ctx,x,z,label){
 await tool(ctx,'control_warden',{action:'move',x,z});
 const arriving=`(()=>{const s=window.hallowmere.getState();return s.hp<=0||s.ended||(s.player&&Math.hypot(s.player.x-(${x}),s.player.z-(${z}))<2.5);})()`;
 await waitFor(ctx,arriving,{timeout:60000,label:`arrival at ${label}`}).catch(()=>{});
 const state=await evaluate(ctx,PLAYER_STATE);
 if(state.hp<=0||state.ended)throw Error(`Died walking toward ${label} (${x}, ${z}) -- the route needs revisiting, this is not a sampling bug. Last known position (${state.x}, ${state.z}), hp ${state.hp}.`);
 return state;
}

async function once(options){
 return withBrowser(options,async ctx=>{
  await playTo(ctx,'04-hud-spawn');
  await evaluate(ctx,SAMPLER);
  const idle=await evaluate(ctx,`window.__sample(${IDLE_FRAMES})`);
  for(const [x,z] of ROUTE)await moveTo(ctx,x,z,`(${x}, ${z})`);
  const arrival=await evaluate(ctx,`(()=>{const s=window.hallowmere.getState();const p=s.player;return {hp:s.hp,nearbyVillageEnemies:p?s.enemies.filter(e=>e.zone==='hallowmere'&&Math.hypot(e.x-p.x,e.z-p.z)<20).length:0};})()`);
  if(arrival.hp<=0)throw Error('Died before combat could start -- the route needs revisiting, this is not a sampling bug.');
  if(!arrival.nearbyVillageEnemies)throw Error('Arrived at the village waypoint with no hallowmere-zone enemies within 20 units -- the route or encounter seed needs revisiting, this is not a sampling bug.');
  const combat={deltas:[],calls:[]};
  while(combat.deltas.length<COMBAT_FRAMES){
   // Re-issued every batch: a locked target's death clears attackHeld (dist/pointer-targeting.js
   // updateMouseTarget), so without this the fight would go idle the instant the first enemy dies.
   // No id/x/z: control_warden's attack falls back to ctx.nearestEnemy(12), same as a player mashing the button.
   await tool(ctx,'control_warden',{action:'attack',hold:true});
   const batch=Math.min(COMBAT_BATCH,COMBAT_FRAMES-combat.deltas.length);
   const sample=await evaluate(ctx,`window.__sample(${batch})`);
   combat.deltas.push(...sample.deltas);combat.calls.push(...sample.calls);
  }
  return {renderer:ctx.renderer,paced:PACED,idle:summary(idle),combat:summary(combat),nearbyVillageEnemies:arrival.nearbyVillageEnemies};
 });
}
const summary=({deltas,calls})=>({frames:deltas.length,p50:percentile(deltas,.5),p95:percentile(deltas,.95),p99:percentile(deltas,.99),max:Math.max(...deltas),drawCalls:median(calls)});

const options={width:Number(value('--width',1440)),height:Number(value('--height',900)),url:value('--url',null),out:null,keepCanvas:true,
 extraFlags:PACED?[]:UNLOCKED_FRAME_FLAGS};
const runs=[];
for(let i=0;i<RUNS;i++){runs.push(await once(options));if(!JSON_OUT)console.error(`run ${i+1}/${RUNS} done`);}

const across=pick=>median(runs.map(pick));
const combatMaxOverall=Math.max(...runs.map(r=>r.combat.max));
const report={runs:RUNS,renderer:runs[0].renderer,mode:PACED?'paced (vsync)':'unlocked',idleFrames:IDLE_FRAMES,combatFrames:COMBAT_FRAMES,route:ROUTE,
 medians:{
  idle:{p50:across(r=>r.idle.p50),p95:across(r=>r.idle.p95),p99:across(r=>r.idle.p99),max:across(r=>r.idle.max),drawCalls:across(r=>r.idle.drawCalls)},
  combat:{p50:across(r=>r.combat.p50),p95:across(r=>r.combat.p95),p99:across(r=>r.combat.p99),max:across(r=>r.combat.max),drawCalls:across(r=>r.combat.drawCalls)}
 },combatMaxOverall,nearbyVillageEnemies:runs[0].nearbyVillageEnemies,raw:runs};
if(JSON_OUT){console.log(JSON.stringify(report,null,1));process.exit(0);}
const ms=v=>v.toFixed(2);
console.log(`renderer ${report.renderer} | ${report.mode} frames | ${RUNS} runs | medians across runs`);
console.log('HEADLESS FRAME TIMES ARE NOT GPU FRAME TIMES: relative before/after on one machine only.\n');
console.log('| Phase | frames/run | p50 ms | p95 ms | p99 ms | max ms | median draw calls |');
console.log('| --- | ---: | ---: | ---: | ---: | ---: | ---: |');
console.log(`| idle at spawn | ${IDLE_FRAMES} | ${ms(report.medians.idle.p50)} | ${ms(report.medians.idle.p95)} | ${ms(report.medians.idle.p99)} | ${ms(report.medians.idle.max)} | ${Math.round(report.medians.idle.drawCalls)} |`);
console.log(`| village combat | ${COMBAT_FRAMES} | ${ms(report.medians.combat.p50)} | ${ms(report.medians.combat.p95)} | ${ms(report.medians.combat.p99)} | ${ms(report.medians.combat.max)} | ${Math.round(report.medians.combat.drawCalls)} |`);
console.log(`\nworst single combat frame across all ${RUNS} run(s): ${ms(combatMaxOverall)} ms -- percentiles above can wash this out; this is what actually catches a synchronous shader compile.`);
console.log(`${report.nearbyVillageEnemies} hallowmere-zone enemies were within 20 units of the player when combat began (first run).`);
// Exit explicitly once stdout has drained (see screenshot.mjs): a stray Chrome handle must not keep the report alive.
process.stdout.write('',()=>process.exit(0));
