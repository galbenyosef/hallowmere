// In-browser frame-time protocol for the dist/ refactor baseline; reuses scripts/screenshot.mjs helpers.
// Usage: bash scripts/node22.sh node scripts/perf-browser.mjs [--runs 3] [--json] [--vsync] [--url http://…]
// Drives the 04-hud-spawn scenario, samples 300 idle frames, then 600 frames while walking 3 fixed waypoints.
// Frames run unlocked (--disable-frame-rate-limit --disable-gpu-vsync) so deltas measure frame cost, not
// the display cadence; --vsync restores the paced 60 Hz mode.
// HEADLESS SWIFTSHADER/ANGLE FRAME TIMES ARE NOT GPU FRAME TIMES. Use them only to compare
// before/after on the same machine in the same session; never quote them as the game's real performance.
// Reporting tool only: never wired into `npm test`; exits 0 unless it throws.
import {withBrowser, playTo, evaluate, tool, UNLOCKED_FRAME_FLAGS} from './screenshot.mjs';

const args=process.argv.slice(2);
const value=(name,fallback)=>{const i=args.indexOf(name);return i<0?fallback:args[i+1];};
const RUNS=Number(value('--runs',3)),JSON_OUT=args.includes('--json'),PACED=args.includes('--vsync');
const IDLE_FRAMES=300,WALK_FRAMES=200;
const WAYPOINTS=[[-60,9],[-55,3],[-64,1]]; // Short hops around the Ashwick spawn; always inside the overworld bounds.

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

async function once(options){
 return withBrowser(options,async ctx=>{
  await playTo(ctx,'04-hud-spawn');
  await evaluate(ctx,SAMPLER);
  const heapBefore=await evaluate(ctx,`performance.memory?.usedJSHeapSize??0`);
  const idle=await evaluate(ctx,`window.__sample(${IDLE_FRAMES})`);
  const walking={deltas:[],calls:[]};
  for(const [x,z] of WAYPOINTS){
   await tool(ctx,'control_warden',{action:'move',x,z});
   const sample=await evaluate(ctx,`window.__sample(${WALK_FRAMES})`);
   walking.deltas.push(...sample.deltas);walking.calls.push(...sample.calls);
  }
  const heapAfter=await evaluate(ctx,`performance.memory?.usedJSHeapSize??0`);
  return {
   renderer:ctx.renderer,paced:PACED,
   idle:summary(idle),walking:summary(walking),
   heapDeltaMb:(heapAfter-heapBefore)/1048576,heapAfterMb:heapAfter/1048576
  };
 });
}
const summary=({deltas,calls})=>({frames:deltas.length,p50:percentile(deltas,.5),p95:percentile(deltas,.95),p99:percentile(deltas,.99),drawCalls:median(calls)});

const options={width:Number(value('--width',1440)),height:Number(value('--height',900)),url:value('--url',null),out:null,keepCanvas:true,
 extraFlags:PACED?[]:UNLOCKED_FRAME_FLAGS};
const runs=[];
for(let i=0;i<RUNS;i++){runs.push(await once(options));if(!JSON_OUT)console.error(`run ${i+1}/${RUNS} done`);}

const across=pick=>median(runs.map(pick));
const report={runs:RUNS,renderer:runs[0].renderer,mode:PACED?'paced (vsync)':'unlocked',idleFrames:IDLE_FRAMES,walkFrames:WAYPOINTS.length*WALK_FRAMES,waypoints:WAYPOINTS,
 medians:{
  idle:{p50:across(r=>r.idle.p50),p95:across(r=>r.idle.p95),p99:across(r=>r.idle.p99),drawCalls:across(r=>r.idle.drawCalls)},
  walking:{p50:across(r=>r.walking.p50),p95:across(r=>r.walking.p95),p99:across(r=>r.walking.p99),drawCalls:across(r=>r.walking.drawCalls)},
  heapDeltaMb:across(r=>r.heapDeltaMb),heapAfterMb:across(r=>r.heapAfterMb)
 },raw:runs};
if(JSON_OUT){console.log(JSON.stringify(report,null,1));process.exit(0);}
const ms=v=>v.toFixed(2);
console.log(`renderer ${report.renderer} | ${report.mode} frames | ${RUNS} runs | medians across runs`);
console.log('HEADLESS FRAME TIMES ARE NOT GPU FRAME TIMES: relative before/after on one machine only.\n');
console.log('| Phase | frames/run | p50 ms | p95 ms | p99 ms | median draw calls |');
console.log('| --- | ---: | ---: | ---: | ---: | ---: |');
console.log(`| idle at spawn | ${IDLE_FRAMES} | ${ms(report.medians.idle.p50)} | ${ms(report.medians.idle.p95)} | ${ms(report.medians.idle.p99)} | ${Math.round(report.medians.idle.drawCalls)} |`);
console.log(`| walking 3 waypoints | ${report.walkFrames} | ${ms(report.medians.walking.p50)} | ${ms(report.medians.walking.p95)} | ${ms(report.medians.walking.p99)} | ${Math.round(report.medians.walking.drawCalls)} |`);
console.log(`\nJS heap delta over the run: ${report.medians.heapDeltaMb.toFixed(2)} MB (ending at ${report.medians.heapAfterMb.toFixed(1)} MB)`);
