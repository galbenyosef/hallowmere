// P4 investigation (Hallowmere refactor plan, Phase 3 deferred item): synthetic
// node benchmark for the per-enemy line-of-sight check inside
// dist/exploration-map.js's drawExplorationMap(), called at ~11Hz by
// dist/render-loop.js's uiTimer gate ("ctx.uiTimer+=dt;if(ctx.uiTimer>.09){...
// ctx.drawMap();}"). No browser, no DOM beyond a minimal canvas/2d-context
// stub (node has no canvas). Reporting tool only: never wired into `npm test`.
// Usage: bash scripts/node22.sh node scripts/p4-los-bench.mjs
//
// Uses the REAL imported hasLineOfSight/drawExplorationMap from dist/ (not a
// re-implementation) so timings reflect the shipped code, and the REAL
// obstacle data built by dist/world-layout.js's createWorldLayout() -- i.e.
// SCENERY_OBSTACLES (itself MAPS.overworld.obstacles, populated by
// populateOutlands()/plantOutlands()) plus every building's wall/furniture/
// door colliders -- instead of a guessed obstacle count.
//
// Conclusion recorded at the time this was written: no safe win found, see
// PLAN.md / the P4 task report. The LOS loop's absolute cost even in an
// unrealistic worst case (30 enemies clustered within the 11-unit visibility
// radius) is ~1.2ms per redraw at 11Hz (~1.3% of the 90ms redraw budget);
// realistic scattered enemies cost is sub-microsecond because most enemies
// fail the cheap Math.hypot(...)<11 distance check before hasLineOfSight is
// ever called. Kept here in case obstacle density or enemy counts grow later.

import {hasLineOfSight} from '../dist/combat.js';
import {drawExplorationMap} from '../dist/exploration-map.js';
import {createWorldLayout} from '../dist/world-layout.js';
import {MAPS} from '../dist/regions.js';

// --- minimal 2D context / canvas stub: records calls, no rasterization ---
function makeCtxStub(){
 const ctx={calls:0};
 const rec=()=>{ctx.calls++;};
 for(const m of ['setTransform','clearRect','save','restore','translate','rotate',
  'beginPath','moveTo','lineTo','stroke','fill','closePath','ellipse','arc','rect',
  'fillRect','strokeRect','drawImage','fillText','putImageData'])ctx[m]=rec;
 ctx.createImageData=(w,h)=>({data:new Uint8ClampedArray(w*h*4),width:w,height:h});
 const props={fillStyle:'#000',strokeStyle:'#000',lineWidth:1,lineCap:'round',lineJoin:'round',
  font:'',textAlign:'left',globalCompositeOperation:'source-over',filter:'none',
  imageSmoothingEnabled:false,shadowColor:'',shadowBlur:0};
 for(const k of Object.keys(props)){let v=props[k];Object.defineProperty(ctx,k,{get:()=>v,set:nv=>{v=nv;ctx.calls++;}});}
 return ctx;
}
function makeCanvasStub(){const ctx=makeCtxStub();return {width:0,height:0,getContext:()=>ctx};}
// mapFogTexture() (dist/map-fog.js) calls document.createElement('canvas') the
// first time drawExplorationMap() runs; stub it so the import chain resolves
// under plain node.
global.document={createElement:tag=>(tag==='canvas'?makeCanvasStub():{})};

const {obstacles:realObstacles,buildings:realBuildings}=createWorldLayout();
console.log(`Real overworld obstacle count (SCENERY_OBSTACLES + building colliders): ${realObstacles.length}`);
console.log(`Real building count: ${realBuildings.length}`);

const map=MAPS.overworld,ENEMY_VISIBILITY_RADIUS=11;

function seededRand(seed){let s=seed>>>0;return ()=>{s=(s*1664525+1013904223)>>>0;return s/4294967296;};}

// Enemies clustered within visibility radius of the player: worst case that
// forces the LOS branch to run for every enemy (the cheap distance check
// always passes). Player sits at the Ashwick start position, a dense-obstacle
// village center, so nearby obstacle density is realistic too.
function makeClusteredEnemies(n,player,rand){
 const arr=[];
 for(let i=0;i<n;i++){const a=rand()*Math.PI*2,r=rand()*(ENEMY_VISIBILITY_RADIUS-.5);arr.push({dead:false,type:'hollow',model:{position:{x:player.x+Math.cos(a)*r,z:player.z+Math.sin(a)*r}}});}
 return arr;
}
// Enemies scattered across the whole map: realistic mixed case where most
// fail the cheap Math.hypot(...)<11 check before ever reaching hasLineOfSight.
function makeScatteredEnemies(n,rand){
 const b=map.bounds,arr=[];
 for(let i=0;i<n;i++)arr.push({dead:false,type:'hollow',model:{position:{x:b.minX+rand()*(b.maxX-b.minX),z:b.minZ+rand()*(b.maxZ-b.minZ)}}});
 return arr;
}

const player={x:-66,z:5}; // Ashwick start -- dense obstacle area

// Mirrors, verbatim in structure, dist/exploration-map.js's enemy loop:
//   for(const e of enemies){const p=e.model.position;if(!e.dead&&seen(p)&&
//     Math.hypot(p.x-player.x,p.z-player.z)<ENEMY_VISIBILITY_RADIUS&&
//     hasLineOfSight(player,p,environment.obstacles,.08))dot(p,...);}
// using the REAL imported hasLineOfSight, so its cost is exactly what the
// shipped code pays.
function losLoop(enemies,obstacles,seen,dot){
 for(const e of enemies){
  const p=e.model.position;
  if(!e.dead&&seen(p)&&Math.hypot(p.x-player.x,p.z-player.z)<ENEMY_VISIBILITY_RADIUS&&hasLineOfSight(player,p,obstacles,.08))dot(p);
 }
}

function timeIt(fn,reps){
 for(let i=0;i<Math.min(50,reps);i++)fn(); // warmup
 const start=process.hrtime.bigint();
 for(let i=0;i<reps;i++)fn();
 const end=process.hrtime.bigint();
 return Number(end-start)/1e6/reps; // ms per call
}

console.log('\n--- single hasLineOfSight() call cost at real obstacle count ---');
{
 const target={x:player.x+5,z:player.z+3};
 const ms=timeIt(()=>hasLineOfSight(player,target,realObstacles,.08),20000);
 console.log(`obstacles=${realObstacles.length}: ${(ms*1000).toFixed(3)} us/call`);
}

console.log('\n--- isolated LOS loop (worst case: all enemies within radius, seen=true) ---');
for(const n of [5,15,30]){
 const rand=seededRand(100+n),enemies=makeClusteredEnemies(n,player,rand);
 const ms=timeIt(()=>losLoop(enemies,realObstacles,()=>true,()=>{}),5000);
 console.log(`enemies=${n}: ${(ms*1000).toFixed(3)} us/redraw  (${(ms*1000/n).toFixed(3)} us/enemy)`);
}

console.log('\n--- isolated LOS loop (realistic: enemies scattered across whole overworld) ---');
for(const n of [5,15,30]){
 const rand=seededRand(200+n),enemies=makeScatteredEnemies(n,rand);
 let nearCount=0;
 for(const e of enemies)if(Math.hypot(e.model.position.x-player.x,e.model.position.z-player.z)<ENEMY_VISIBILITY_RADIUS)nearCount++;
 const ms=timeIt(()=>losLoop(enemies,realObstacles,()=>true,()=>{}),5000);
 console.log(`enemies=${n} (${nearCount} within radius -> LOS-checked): ${(ms*1000).toFixed(3)} us/redraw`);
}

console.log('\n--- full drawExplorationMap() call, worst-case clustered enemies ---');
const mapData={mask:makeCanvasStub(),columns:107,rows:81,cells:{size:4000},total:8667};
const atlas={map:()=>mapData,seen:()=>true};
const canvas=makeCanvasStub(),environment={obstacles:realObstacles,buildings:realBuildings},bossType=()=>false;

for(const n of [5,15,30]){
 const rand=seededRand(300+n),enemies=makeClusteredEnemies(n,player,rand);
 const args={canvas,atlas,map,player,angle:0,expanded:false,environment,npcs:[],interactions:[],drops:[],enemies,players:[],you:null,bossType};
 const fullMs=timeIt(()=>drawExplorationMap(args),3000);
 const losMs=timeIt(()=>losLoop(enemies,realObstacles,()=>true,()=>{}),3000);
 console.log(`enemies=${n}: full=${(fullMs*1000).toFixed(1)} us/redraw, LOS-loop=${(losMs*1000).toFixed(1)} us (${(losMs/fullMs*100).toFixed(1)}% of full -- note: the stub 2D context does no real rasterization, so this overstates the LOS loop's share of a real browser frame, which also pays for the blur filter and drawImage compositing)`);
}

console.log('\n--- at 11Hz (90ms budget), worst-case 30-enemy LOS-loop cost as % of frame budget ---');
{
 const rand=seededRand(999),enemies=makeClusteredEnemies(30,player,rand);
 const ms=timeIt(()=>losLoop(enemies,realObstacles,()=>true,()=>{}),5000);
 console.log(`${ms.toFixed(4)} ms per redraw, i.e. ${(ms/90*100).toFixed(3)}% of the 90ms redraw budget`);
}
