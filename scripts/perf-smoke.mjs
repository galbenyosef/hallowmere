// Deterministic headless simulation benchmark for the dist/ refactor baseline.
// Usage: bash scripts/node22.sh node --expose-gc scripts/perf-smoke.mjs [--json] [--n 2000] [--batches 5]
// Without --expose-gc the timings stay valid but bytes/op is reported as n/a.
// Every batch rebuilds a world from a fixed seed, so the workload is identical run to run.
// Reporting tool only: never wired into `npm test`; exits 0 unless it throws.
import {registerHooks} from 'node:module';
import {World} from '../dist/world.js';
import {LocalSession} from '../dist/local-session.js';
import {TICK_SECONDS} from '../dist/multiplayer-protocol.js';
import {VillageLife} from '../dist/world-actors.js';
import * as T from '../dist/vendor/three.core.js';
import {FOOD_LIST} from '../dist/foraging.js';

// dist/interaction.js imports the bare 'three' specifier, which only the page's import map
// resolves; match it in Node the way tests/effects-factory.test.mjs and
// tests/enemy-spawner.test.mjs do. regionInteractions() itself never touches T, so no other
// specifier needs redirecting.
const threeHook=registerHooks({resolve(specifier,context,nextResolve){
 if(specifier==='three')return nextResolve(new URL('../dist/vendor/three.module.js',import.meta.url).href,context);
 return nextResolve(specifier,context);
}});
const {createInteraction}=await import('../dist/interaction.js');
threeHook.deregister();

const SEED=20240915,args=process.argv.slice(2);
const flag=(name,fallback)=>{const i=args.indexOf(name);return i<0?fallback:Number(args[i+1]);};
const N=flag('--n',2000),BATCHES=flag('--batches',5),JSON_OUT=args.includes('--json'),WARM=Math.min(200,N);

const median=values=>{const s=[...values].sort((a,b)=>a-b),m=s.length>>1;return s.length%2?s[m]:(s[m-1]+s[m])/2;};
const percentile=(values,p)=>{const s=[...values].sort((a,b)=>a-b);return s[Math.min(s.length-1,Math.max(0,Math.ceil(p*s.length)-1))];};
const noop=()=>{};

function fixture(){const world=new World({seed:SEED,now:()=>0});const id=world.join().player.id;return {world,id};}
function warmWorld(steps=100){const {world,id}=fixture();for(let i=0;i<steps;i++)world.step(TICK_SECONDS);return {world,id};}
function session(){const s=new LocalSession({seed:SEED,onSnapshot:noop,onWelcome:noop,onStatus:noop,onProgress:noop});s.start();return s;}

// Minimal stub label element: renderLabels only needs hidden, classList.toggle/contains,
// style.left/top, and offsetWidth/offsetHeight (varied-but-deterministic so the labelSize
// cache is exercised the way it would be against real, differently-sized labels).
function villageLabelDocument(){
 let n=0;const layer={append(){}};
 function createLabel(){
  n++;const seed=n;
  return {dataset:{},className:'',innerHTML:'',hidden:false,
   style:{left:'',top:'',transform:'',setProperty(){}},
   classList:{_set:new Set(),toggle(token,force){const has=this._set.has(token);const want=force===undefined?!has:!!force;if(want)this._set.add(token);else this._set.delete(token);return want;},contains(token){return this._set.has(token);}},
   offsetWidth:130+(seed*17)%60,offsetHeight:48+(seed*11)%30,
   setAttribute(){},remove(){},querySelector(){return {};},focus(){},
   onclick:null,onpointerdown:null,onpointerenter:null,onpointerleave:null,onfocus:null,onblur:null};
 }
 return {getElementById:()=>layer,createElement:createLabel};
}
// ~30 items (4 NPCs + 16 drops + 10 forage patches), seeded so the fixture is identical run to run.
function villageLife(){
 globalThis.document=villageLabelDocument();globalThis.innerWidth=1280;globalThis.innerHeight=800;
 let v=0x9e3779b9;const rand=()=>{v=(Math.imul(v,1664525)+1013904223)>>>0;return v/4294967296;};
 const scene=new T.Scene(),player=new T.Group(),camera=new T.OrthographicCamera(-20,20,15,-15,.1,150);
 const state={mapId:'overworld',potions:0,ended:false};
 const life=new VillageLife({scene,camera,player,state,cloneModel:()=>new T.Group(),obstacles:[],onTalk(){},onCollect(){},onLootClick(){},onApproach(){return true;}});
 for(let i=0;i<16;i++){
  const kind=['item','potion','gold'][i%3];
  life.addLoot([{id:`d${i}`,kind,rarity:['common','uncommon','rare','legendary'][i%4],name:`D${i}`,x:(rand()-.5)*100,z:(rand()-.5)*40,amount:kind==='gold'?40:undefined,template:kind==='item'?'oak-charm':undefined}],{x:0,z:0});
 }
 const forageRecords=[];
 for(let i=0;i<10;i++){forageRecords.push({id:`f${i}`,itemId:FOOD_LIST[i%FOOD_LIST.length].id,x:(rand()-.5)*100,z:(rand()-.5)*40});life.syncForage(forageRecords.map(r=>({...r})));}
 player.position.set(3,0,2);camera.position.set(20,25,28);camera.lookAt(0,0,0);camera.updateMatrixWorld(true);
 return life;
}

// Each case returns a run(n) closure over freshly built state, so setup stays outside the timed region.
const cases=[
 {name:'World#step(TICK_SECONDS)',setup(){const {world}=fixture();return n=>{for(let i=0;i<n;i++)world.step(TICK_SECONDS);};}},
 {name:'World#snapshot(playerId, lastEvent)',setup(){const {world,id}=warmWorld();return n=>{for(let i=0;i<n;i++)world.snapshot(id,0);};}},
 {name:'structuredClone(snapshot)',setup(){const {world,id}=warmWorld();const snapshot=world.snapshot(id,0);return n=>{for(let i=0;i<n;i++)structuredClone(snapshot);};}},
 {name:'LocalSession#advance(1/60)',setup(){const s=session();return n=>{for(let i=0;i<n;i++)s.advance(1/60);};}},
 // M4 extracted regionInteractions() into dist/interaction.js as createInteraction(ctx), so it is
 // now importable outside the browser bundle: a stub ctx with a warm World snapshot as
 // ctx.lastSnapshot is enough, no DOM/three.js surface required.
 {name:'createInteraction(ctx).regionInteractions()',setup(){const {world,id}=warmWorld();const ctx={lastSnapshot:world.snapshot(id,0),state:{discoveries:[]}};const {regionInteractions}=createInteraction(ctx);return n=>{for(let i=0;i<n;i++)regionInteractions();};}}
 // the browser bundle (it still needs a DOM/three.js surface today).
 // inCombat/showAll flip only occasionally, not every call: steady per-frame inputs are the
 // common case this task's caching targets, and flipping every single call mostly measures
 // V8 branch-prediction/deopt noise rather than the render cost itself.
 {name:'VillageLife#renderLabels',setup(){const life=villageLife();let i=0;return n=>{for(let k=0;k<n;k++){i++;life.renderLabels(Math.floor(i/97)%2===0,Math.floor(i/61)%2===0);}};}}
];

function measure({name,setup}){
 setup()(WARM); // Warm the JIT on a throwaway fixture before any batch is recorded.
 const perOp=[],bytes=[];
 for(let b=0;b<BATCHES;b++){
  const run=setup();
  global.gc?.();
  const before=process.memoryUsage().heapUsed,start=process.hrtime.bigint();
  run(N);
  const elapsed=Number(process.hrtime.bigint()-start)/1e6,after=process.memoryUsage().heapUsed;
  perOp.push(elapsed/N);bytes.push((after-before)/N);
 }
 return {name,n:N,batches:BATCHES,medianMs:median(perOp),p95Ms:percentile(perOp,.95),bytesPerOp:median(bytes),samples:perOp};
}

const results=cases.map(measure);
const report={seed:SEED,node:process.version,gc:!!global.gc,n:N,batches:BATCHES,results};
if(JSON_OUT){console.log(JSON.stringify(report,null,1));process.exit(0);}
const ms=value=>value>=1?value.toFixed(3):value.toFixed(4);
console.log(`Seed ${SEED} | node ${process.version} | ${N} ops x ${BATCHES} batches | gc ${global.gc?'exposed':'unavailable (rerun with --expose-gc)'}\n`);
console.log('| Metric | ops/batch | median ms/op | p95 ms/op | bytes/op |');
console.log('| --- | ---: | ---: | ---: | ---: |');
for(const r of results)console.log(`| \`${r.name}\` | ${r.n} | ${ms(r.medianMs)} | ${ms(r.p95Ms)} | ${global.gc?Math.round(r.bytesPerOp).toLocaleString('en-US'):'n/a'} |`);
