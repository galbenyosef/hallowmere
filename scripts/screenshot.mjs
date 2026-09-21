// Headless Chrome screenshot harness for the dist/ refactor visual baseline.
// Usage: bash scripts/node22.sh node scripts/screenshot.mjs --all [--out screenshots/refactor-baseline]
//        bash scripts/node22.sh node scripts/screenshot.mjs --scenario 04-hud-spawn [--keep-canvas]
// Options: --width 1440 --height 900 --url http://… (reuse a running server) --gpu (platform GPU) --list
// Starts its own `node scripts/serve.mjs` on a free port unless --url is given, and kills it on exit.
// Reporting tool only: never wired into `npm test`; exits 0 on success, 1 on a scenario failure.
import {spawn} from 'node:child_process';
import {createServer} from 'node:net';
import {mkdtemp, mkdir, rm, writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {WebSocket} from 'ws';

export const ROOT=resolve(fileURLToPath(new URL('..',import.meta.url)));
export const CHROME=process.env.CHROME||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
export const DEFAULT_OUT=join(ROOT,'screenshots/refactor-baseline');
const sleep=ms=>new Promise(r=>setTimeout(r,ms));

/* ---------- local game server ---------- */
export const freePort=()=>new Promise((res,rej)=>{const s=createServer();s.once('error',rej);s.listen(0,'127.0.0.1',()=>{const {port}=s.address();s.close(()=>res(port));});});

export async function startServer(){
 const port=await freePort();
 const child=spawn(process.execPath,[join(ROOT,'scripts/serve.mjs')],{cwd:ROOT,env:{...process.env,PORT:String(port)},stdio:['ignore','pipe','pipe']});
 child.stdout.resume();child.stderr.resume();
 const url=`http://127.0.0.1:${port}`;
 for(let attempt=0;attempt<200;attempt++){
  try{const response=await fetch(`${url}/health`);if(response.ok){await response.arrayBuffer();return {url,close(){child.kill('SIGKILL');}};}}catch{}
  await sleep(100);
 }
 child.kill('SIGKILL');throw Error('The game server never answered /health');
}

/* ---------- Chrome + CDP ---------- */
export const CHROME_FLAGS=['--headless=new','--remote-debugging-port=0','--hide-scrollbars','--no-first-run','--no-default-browser-check','--mute-audio','--disable-background-timer-throttling','--disable-renderer-backgrounding','--disable-backgrounding-occluded-windows','--force-device-scale-factor=1','--force-color-profile=srgb'];
export const SWIFTSHADER_FLAGS=['--use-angle=swiftshader','--enable-unsafe-swiftshader'];
// requestAnimationFrame is vsync-paced by default, which pins every frame delta to the refresh interval.
export const UNLOCKED_FRAME_FLAGS=['--disable-frame-rate-limit','--disable-gpu-vsync'];

export async function launchChrome({width=1440,height=900,swiftshader=false,extraFlags=[]}={}){
 const profile=await mkdtemp(join(tmpdir(),'hallowmere-shot-'));
 // extraFlags lets perf-browser unpin requestAnimationFrame from the display refresh; captures never use it.
 const flags=[...CHROME_FLAGS,`--window-size=${width},${height}`,`--user-data-dir=${profile}`,...(swiftshader?SWIFTSHADER_FLAGS:[]),...extraFlags,'about:blank'];
 const child=spawn(CHROME,flags,{stdio:['ignore','pipe','pipe']});
 let stderr='';
 const endpoint=await new Promise((res,rej)=>{
  const timer=setTimeout(()=>rej(Error('Chrome never printed a DevTools endpoint')),45000);
  child.stderr.on('data',chunk=>{stderr+=chunk;const match=/DevTools listening on (ws:\/\/\S+)/.exec(stderr);if(match){clearTimeout(timer);res(match[1]);}});
  child.once('error',error=>{clearTimeout(timer);rej(error);});
  child.once('exit',code=>{clearTimeout(timer);rej(Error(`Chrome exited with code ${code}: ${stderr.slice(-400)}`));});
 });
 // Chrome's helper processes inherit the stderr pipe; if one outlives SIGKILL it would hold the pipe open
 // and keep this node process alive after main() returns, so drop our end once the endpoint is known.
 child.stderr.destroy();child.unref();
 return {endpoint,flags,swiftshader,async close(){child.kill('SIGKILL');await rm(profile,{recursive:true,force:true}).catch(()=>{});}};
}

export class CDP{
 constructor(socket){
  this.socket=socket;this.seq=0;this.pending=new Map();this.listeners=new Set();
  socket.on('message',raw=>{
   const message=JSON.parse(raw);
   if(message.id===undefined){for(const listener of [...this.listeners])listener(message);return;}
   const waiter=this.pending.get(message.id);if(!waiter)return;
   this.pending.delete(message.id);
   message.error?waiter.reject(Error(`${waiter.method}: ${message.error.message}`)):waiter.resolve(message.result);
  });
  socket.on('close',()=>this.fail('the DevTools connection closed'));
  socket.on('error',error=>this.fail(error.message));
 }
 send(method,params={},sessionId,timeout=60000){
  const id=++this.seq;
  return new Promise((resolve,reject)=>{
   // Input.* waits on the renderer, so a wedged page must surface as an error rather than hang the run.
   const timer=setTimeout(()=>{this.pending.delete(id);reject(Error(`Timed out: ${method}`));},timeout);
   this.pending.set(id,{resolve:value=>{clearTimeout(timer);resolve(value);},reject:error=>{clearTimeout(timer);reject(error);},method});
   this.socket.send(JSON.stringify(sessionId?{id,method,params,sessionId}:{id,method,params}));
  });
 }
 fail(reason){for(const [id,waiter] of this.pending){this.pending.delete(id);waiter.reject(Error(`${waiter.method}: ${reason}`));}}
 on(listener){this.listeners.add(listener);return ()=>this.listeners.delete(listener);}
 once(method,timeout=60000){
  return new Promise((resolve,reject)=>{
   const timer=setTimeout(()=>{off();reject(Error(`Timed out waiting for ${method}`));},timeout);
   const off=this.on(message=>{if(message.method===method){clearTimeout(timer);off();resolve(message.params);}});
  });
 }
 close(){this.socket.close();}
}
export const connect=endpoint=>new Promise((res,rej)=>{
 const socket=new WebSocket(endpoint,{perMessageDeflate:false,maxPayload:512*1024*1024});
 socket.once('open',()=>res(new CDP(socket)));socket.once('error',rej);
});

// The page registers its assistive tools on document.modelContext; headless Chrome has none, so we supply one.
export const BOOT_SCRIPT=`(()=>{const tools=new Map();
 try{Object.defineProperty(document,'modelContext',{configurable:true,value:{registerTool(tool){tools.set(tool.name,tool);return {unregister(){tools.delete(tool.name);}};}}});}catch{}
 window.__shot={names:()=>[...tools.keys()],tool:(name,input)=>{const tool=tools.get(name);if(!tool)throw new Error('Tool unavailable: '+name);return tool.execute(input);}};})();`;

export async function openPage(cdp,{width=1440,height=900}={}){
 const {targetId}=await cdp.send('Target.createTarget',{url:'about:blank'});
 const {sessionId}=await cdp.send('Target.attachToTarget',{targetId,flatten:true});
 for(const domain of ['Page','Runtime','Network','DOM'])await cdp.send(`${domain}.enable`,{},sessionId);
 await cdp.send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:false},sessionId);
 // Without emulated focus, headless Input.* events can wait forever on an unfocused renderer.
 await cdp.send('Emulation.setFocusEmulationEnabled',{enabled:true},sessionId).catch(()=>{});
 await cdp.send('Page.addScriptToEvaluateOnNewDocument',{source:BOOT_SCRIPT},sessionId);
 return sessionId;
}

/* ---------- page helpers ---------- */
// Portrait preparation (roster + inventory) renders 3D studies and reads them back with toDataURL,
// which blocks the page's main thread for tens of seconds at a time; CDP calls must outwait that.
export const EVAL_TIMEOUT=120000;
export async function evaluate(ctx,expression,{awaitPromise=true,callTimeout=EVAL_TIMEOUT}={}){
 const result=await ctx.cdp.send('Runtime.evaluate',{expression,awaitPromise,returnByValue:true,userGesture:true},ctx.sessionId,callTimeout);
 if(result.exceptionDetails)throw Error(result.exceptionDetails.exception?.description||result.exceptionDetails.text);
 return result.result.value;
}
export const waitFor=(ctx,condition,{timeout=60000,label=condition}={},callTimeout=0)=>evaluate(ctx,
 `new Promise((resolve,reject)=>{const started=Date.now();const poll=()=>{let ok=false;try{ok=!!(${condition});}catch{}
  if(ok)return resolve(true);
  if(Date.now()-started>${timeout})return reject(new Error('Timed out waiting for '+${JSON.stringify(label)}));
  setTimeout(poll,250);};poll();})`,{callTimeout:callTimeout||timeout+EVAL_TIMEOUT});
// The page's main thread stalls for tens of seconds while it renders portraits or redraws the atlas.
// Probe with a short deadline until it answers, so key presses are never queued behind a stall.
export async function responsive(ctx,{probe=5000,tries=24}={}){
 for(let i=0;i<tries;i++){
  try{await evaluate(ctx,'1',{callTimeout:probe});return true;}
  catch(error){if(!/Timed out/.test(error.message))throw error;}
 }
 throw Error('The page never became responsive');
}
export const click=(ctx,selector)=>evaluate(ctx,`(()=>{const el=document.querySelector(${JSON.stringify(selector)});if(!el)throw new Error('Missing element '+${JSON.stringify(selector)});el.click();return true;})()`);
export const tool=(ctx,name,input)=>evaluate(ctx,`(async()=>{await window.__shot.tool(${JSON.stringify(name)},${JSON.stringify(input)});return true;})()`);

const KEYS={Escape:{code:'Escape',vk:27}};
function keyDef(key){
 if(KEYS[key])return {key,code:KEYS[key].code,vk:KEYS[key].vk,text:''};
 const upper=key.toUpperCase();
 return {key,code:`Key${upper}`,vk:upper.charCodeAt(0),text:key};
}
// Available, but the scenarios below click the HUD buttons instead: a key dispatched to the game page
// in this headless Chrome repeats indefinitely (thousands of keydowns from one press), and every game
// key is a toggle, so the menu it opens is immediately closed again. Blank pages do not do this.
export async function pressKey(ctx,key){
 const def=keyDef(key),base={key:def.key,code:def.code,windowsVirtualKeyCode:def.vk,nativeVirtualKeyCode:def.vk};
 await ctx.cdp.send('Input.dispatchKeyEvent',{...base,type:def.text?'keyDown':'rawKeyDown',text:def.text||undefined},ctx.sessionId,180000);
 await ctx.cdp.send('Input.dispatchKeyEvent',{...base,type:'keyUp'},ctx.sessionId,180000);
 await sleep(150);
}

// Hide the animated WebGL canvas and stop every CSS animation so only stable DOM chrome reaches the PNG.
const FREEZE=keepCanvas=>`(async()=>{
 if(!${keepCanvas})document.getElementById('world').style.visibility='hidden';
 if(!document.getElementById('__shot-freeze')){const style=document.createElement('style');style.id='__shot-freeze';
  style.textContent='*{animation-play-state:paused!important;transition:none!important;caret-color:transparent!important}';document.head.append(style);}
 document.getAnimations().forEach(animation=>{try{animation.pause();}catch{}});
 await document.fonts.ready;
 // fonts.ready also resolves when a web font FAILED to load (a fallback face would then reach the PNG);
 // throwing here makes the scenario loop retry the capture in a fresh browser instead of diffing garbage.
 const failedFonts=[...new Set([...document.fonts].filter(face=>face.status==='error').map(face=>face.family))];
 if(failedFonts.length)throw Error('Web fonts failed to load: '+failedFonts.join(', '));
 await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
 return true;})()`;
const THAW=`(()=>{document.getElementById('world').style.visibility='';document.getElementById('__shot-freeze')?.remove();
 document.getAnimations().forEach(animation=>{try{animation.play();}catch{}});return true;})()`;

export async function capture(ctx,name,{keepCanvas=ctx.keepCanvas}={}){
 await evaluate(ctx,FREEZE(!!keepCanvas));
 const {data}=await ctx.cdp.send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false},ctx.sessionId);
 // A capture can leave the page reported as hidden, which the game treats as backgrounded and freezes.
 await ctx.cdp.send('Page.setWebLifecycleState',{state:'active'},ctx.sessionId).catch(()=>{});
 await evaluate(ctx,THAW);
 await mkdir(ctx.out,{recursive:true});
 const file=join(ctx.out,`${name}.png`);
 await writeFile(file,Buffer.from(data,'base64'));
 return file;
}

/* ---------- scenarios ---------- */
// Boot lands in play: the loading screen hides once the (auto-created) journey has started.
const IN_GAME=`!!window.hallowmere&&document.getElementById('loading').hidden===true&&document.getElementById('modal-shade').hidden===true&&!document.querySelector('dialog[open]')`;
// Probe the DOM, never window.hallowmere.getState(): building that object raycasts every enemy, and
// polling it a few times a second is enough on its own to stall the page we are trying to photograph.
const MODAL=kind=>`document.getElementById('modal-shade').hidden===false&&document.querySelector('.modal')?.dataset.menuKind===${JSON.stringify(kind)}`;

async function load(ctx,{block=[],path='/',until=IN_GAME,label='the game to enter play (assets to load and the journey to open)'}={}){
 await ctx.cdp.send('Network.setBlockedURLs',{urls:block},ctx.sessionId);
 const loaded=ctx.cdp.once('Page.loadEventFired',90000);
 await ctx.cdp.send('Page.navigate',{url:`${ctx.url}${path}`},ctx.sessionId);
 await loaded;
 await waitFor(ctx,until,{timeout:180000,label});
}
const CLOSED=`document.getElementById('modal-shade').hidden===true&&document.getElementById('loading').hidden===true&&document.querySelector('.map-panel')?.classList.contains('expanded')!==true&&!document.querySelector('dialog[open]')`;
// Key events are occasionally swallowed (focus moves, an inventory preview), so open/close are retried.
async function openWith(ctx,buttonId,kind,label){
 for(let attempt=0;attempt<4;attempt++){
  await responsive(ctx);
  const modal=await evaluate(ctx,`document.getElementById('modal-shade').hidden?'':document.querySelector('.modal')?.dataset.menuKind||''`);
  if(modal===kind){await sleep(600);if(await evaluate(ctx,MODAL(kind)))return;continue;}
  if(modal!=='')await closeModal(ctx);
  await click(ctx,`#${buttonId}`);
  await waitFor(ctx,MODAL(kind),{timeout:45000,label}).catch(()=>{});
 }
 throw Error(`Could not open ${label}`);
}
async function closeModal(ctx){
 await responsive(ctx);
 for(let attempt=0;attempt<8;attempt++){
  if(await evaluate(ctx,CLOSED)){await sleep(300);if(await evaluate(ctx,CLOSED))return;continue;}
  await evaluate(ctx,`(()=>{
   if(document.querySelector('.map-panel')?.classList.contains('expanded')){document.getElementById('map-button').click();return true;}
   const shade=document.getElementById('modal-shade');
   if(!shade.hidden){
    const primary=document.getElementById('modal-primary');
    const target=primary&&!primary.hidden?primary:document.querySelector('[data-resume-game], [data-dialogue-close]');
    target?.click();
   }
   return true;})()`);
  await sleep(500);
 }
 throw Error('The game would not leave its menus');
}

// Documented as not capturable from this tree:
//  06-main-menu        openMainMenu() in dist/main.js has no caller, so titleScreen.showMainMenu() is unreachable.
//  12-death            window.hallowmere exposes no way to force state.ended; dying for real is slow and non-deterministic.

export const STAGES=[
 {name:'04-hud-spawn',shows:'Solo session at the Ashwick spawn straight from loading: full HUD, quest panel, minimap, ability bar.',fresh:true,check:`document.getElementById('loading').hidden&&window.hallowmere.getState().modal===''&&!!window.hallowmere.getState().player`,
  async run(ctx){
   await load(ctx);
   // Past 14s of world time the onboarding guide has faded, which makes the HUD stable to diff.
   await waitFor(ctx,`window.hallowmere.getState().time>16&&document.getElementById('journey-save-indicator').hidden&&!document.getElementById('toast').classList.contains('visible')`,{timeout:90000,label:'the HUD to settle'});
  }},
 {name:'02-journeys-menu',shows:'Journeys menu reached through Save & exit: the auto-created Sorcerer journey selected.',after:'04-hud-spawn',check:`document.querySelector('dialog.journeys-dialog')?.open===true`,
  async run(ctx){
   await openWith(ctx,'pause-button','pause','the pause menu');
   await click(ctx,'[data-save-exit]');
   await waitFor(ctx,`document.querySelector('dialog.journeys-dialog')?.open&&!!document.querySelector('.journey-detail')`,{timeout:45000,label:'the journeys menu'});
  }},
 {name:'03-roster-picker',shows:'Character chooser (New journey) with portraits prepared and the confirm button enabled.',after:'02-journeys-menu',check:`document.querySelector('dialog.roster-dialog')?.open===true`,
  async run(ctx){await click(ctx,'.journeys-dialog [data-new]');await waitFor(ctx,`document.querySelector('dialog.roster-dialog')?.open&&document.querySelector('.roster-confirm')?.disabled===false`,{timeout:90000,label:'the roster picker'});}},
 {name:'05-pause',shows:'Escape pause menu: resume, autosave notice, sound and visual settings.',after:'04-hud-spawn',check:MODAL('pause'),
  async run(ctx){await openWith(ctx,'pause-button','pause','the pause menu');}},
 {name:'09-journal',shows:'Journal modal (J): quest text and per-region progress.',after:'04-hud-spawn',check:MODAL('journal'),
  async run(ctx){await closeModal(ctx);await openWith(ctx,'journal-button','journal','the journal');}},
 {name:'10-help',shows:'Controls modal (H): the full control table and guidance copy.',after:'04-hud-spawn',check:MODAL('help'),
  async run(ctx){await closeModal(ctx);await openWith(ctx,'help-button','help','the controls');}},
 {name:'11-npc-dialogue',shows:'Elder Rowan conversation after walking to him from the spawn.',after:'04-hud-spawn',check:MODAL('npc'),
  // A bare F here rests at the Ashwick sanctuary: main.js interact() prefers regional interactions over
  // villagers. So we walk in with the tool and then take the same interact() path with Rowan's id.
  async run(ctx){
   await closeModal(ctx);
   for(let attempt=0;attempt<3;attempt++){
    try{await tool(ctx,'control_warden',{action:'move',x:-66,z:3.2});break;}
    catch(error){
     if(attempt===2)throw Error(`${error.message} (state: ${await evaluate(ctx,`JSON.stringify((({ready,paused,backgrounded,ended,modal})=>({ready,paused,backgrounded,ended,modal}))(window.hallowmere.getState()))`)})`);
     await ctx.cdp.send('Page.setWebLifecycleState',{state:'active'},ctx.sessionId).catch(()=>{});
     await closeModal(ctx);await sleep(600);
    }
   }
   await waitFor(ctx,`(()=>{const p=window.hallowmere.getState().player;return p&&Math.hypot(p.x+66,p.z-3.2)<2.5;})()`,{timeout:45000,label:'the walk to Elder Rowan'}).catch(()=>{});
   for(let attempt=0;attempt<8;attempt++){
    await tool(ctx,'control_warden',{action:'interact',id:'rowan'});await sleep(900);
    if(await evaluate(ctx,`window.hallowmere.getState().modal==='npc'`))break;
   }
   await waitFor(ctx,MODAL('npc'),{timeout:15000,label:'the Elder Rowan dialogue'});
   await waitFor(ctx,`!document.getElementById('toast').classList.contains('visible')`,{timeout:8000,label:'the toast to clear'}).catch(()=>{});
  }},
 {name:'13-map-expanded',shows:'Expanded world map (M): exploration atlas, legend and menu rail.',after:'04-hud-spawn',check:`document.querySelector('.map-panel')?.classList.contains('expanded')===true`,
  async run(ctx){
   await closeModal(ctx);
   // Expanding redraws the whole exploration atlas into a canvas, which holds the main thread for a
   // long time under software rendering. Press only while the map is shut, wait it out, then confirm
   // it is still open so a late keypress cannot toggle it closed again before the capture.
   const open=`document.querySelector('.map-panel')?.classList.contains('expanded')===true`;
   const patient={callTimeout:300000};
   for(let attempt=0;attempt<3;attempt++){
    await responsive(ctx);
    if(!await evaluate(ctx,open,patient))await click(ctx,'#map-button');
    try{await waitFor(ctx,open,{timeout:90000,label:'the expanded map'},patient.callTimeout);}catch{continue;}
    await sleep(1200);
    if(await evaluate(ctx,open,patient))return;
   }
   throw Error('The world map would not stay open');
  }},
 // Captured last on purpose: dist/inventory-portraits.js renders portraits through a throwaway
 // WebGLRenderer and reads them back with toDataURL, which intermittently wedges the renderer
 // thread for the rest of the page's life. Nothing but a fresh navigation follows it.
 {name:'08-inventory',shows:'Inventory modal (I): equipment slots, pouch, crowns.',after:'04-hud-spawn',check:MODAL('inventory'),
  async run(ctx){
   await closeModal(ctx);await openWith(ctx,'inventory-button','inventory','the inventory');
   // dist/inventory-portraits.js renders each portrait through a throwaway WebGLRenderer and reads it
   // back with toDataURL, which blocks the renderer thread; allow minutes before calling it a failure.
   await waitFor(ctx,`[...document.querySelectorAll('#modal-content img')].every(img=>img.complete)`,{timeout:180000,label:'the inventory portraits'},240000).catch(()=>{});
   await sleep(800);
  }},
 {name:'07-connection-overlay',shows:'?mode=multiplayer with no backend reachable: the "Unable to connect" overlay.',fresh:true,check:`document.getElementById('connection-overlay').hidden===false`,
  // A fresh load with ./multiplayer-config.json blocked at the network layer stands in for "no backend configured".
  async run(ctx){
   await load(ctx,{block:['*multiplayer-config.json*'],path:'/?mode=multiplayer',until:`!document.getElementById('connection-overlay').hidden&&document.getElementById('connection-spinner').hidden`,label:'the failed connection overlay'});
  }}
];

export const stageNamed=name=>STAGES.find(stage=>stage.name===name);
// The shortest run that reaches a scenario: follow `after` back to a stage that loads the page itself.
export function chainFor(stageName){
 const chain=[];let stage=stageNamed(stageName);
 if(!stage)throw Error(`Unknown scenario ${stageName}. Try --list.`);
 while(stage){chain.unshift(stage);stage=stage.after?stageNamed(stage.after):null;}
 return chain;
}
export async function playTo(ctx,stageName,onStage){
 const chain=chainFor(stageName);
 for(const stage of chain){await stage.run(ctx);await onStage?.(stage,stage.name===stageName);}
}

// Opens one Chrome + page against `url`. Callers close it; a wedged renderer is cured by reopening.
export async function openBrowser(options,url){
 let chrome=await launchChrome({...options,swiftshader:!!options.swiftshader,extraFlags:options.extraFlags||[]});
 const build=async()=>{
  const cdp=await connect(chrome.endpoint);
  const sessionId=await openPage(cdp,options);
  return {cdp,sessionId,url,out:options.out,keepCanvas:options.keepCanvas};
 };
 let ctx=await build();
 const webgl=`!!document.createElement('canvas').getContext('webgl2')`;
 if(!await evaluate(ctx,webgl)){
  ctx.cdp.close();await chrome.close();
  chrome=await launchChrome({...options,swiftshader:true,extraFlags:options.extraFlags||[]});
  ctx=await build();
  if(!await evaluate(ctx,webgl))throw Error('Chrome has no WebGL2 context even with SwiftShader');
 }
 ctx.renderer=chrome.swiftshader?'swiftshader':'default';ctx.flags=chrome.flags;
 return {ctx,async close(){try{ctx.cdp.close();}catch{}await chrome.close();}};
}

export async function withBrowser(options,body){
 const server=options.url?null:await startServer();
 const browser=await openBrowser(options,options.url||server.url);
 try{return await body(browser.ctx);}
 finally{await browser.close();server?.close();}
}

/* ---------- CLI ---------- */
async function main(){
 const args=process.argv.slice(2);
 const value=(name,fallback)=>{const i=args.indexOf(name);return i<0?fallback:args[i+1];};
 if(args.includes('--list')){for(const stage of STAGES)console.log(`${stage.name.padEnd(22)} ${stage.shows}`);return;}
 const options={
  width:Number(value('--width',1440)),height:Number(value('--height',900)),
  out:resolve(value('--out',DEFAULT_OUT)),keepCanvas:args.includes('--keep-canvas'),url:value('--url',null),
  // SwiftShader by default: the platform GPU path renders the game fine but wedges the renderer thread
  // partway through a long capture session on this machine. --gpu opts back into the platform GPU.
  swiftshader:!args.includes('--gpu')
 };
 const only=value('--scenario',null),all=args.includes('--all')||!only;
 const list=all?STAGES:STAGES.filter(stage=>stage.name===only);
 if(!list.length)throw Error(`Unknown scenario ${only}. Try --list.`);
 const server=options.url?null:await startServer(),url=options.url||server.url;
 let browser=await openBrowser(options,url);
 const captured=[];
 console.log(`renderer: ${browser.ctx.renderer} | ${options.width}x${options.height} | out ${options.out}`);
 const shoot=async stage=>{
  await responsive(browser.ctx);
  // Guard against a late keypress toggling a menu shut between the wait and the shutter.
  if(stage.check&&!await evaluate(browser.ctx,stage.check))throw Error(`${stage.name} left its state before the capture`);
  await capture(browser.ctx,stage.name);
  if(stage.check&&!await evaluate(browser.ctx,stage.check))throw Error(`${stage.name} left its state during the capture`);
  captured.push({name:stage.name,shows:stage.shows});
  console.log(`captured ${stage.name}`);
  if(stage.name==='04-hud-spawn'&&!options.keepCanvas){
   await capture(browser.ctx,'04-hud-spawn.canvas',{keepCanvas:true});
   console.log('captured 04-hud-spawn.canvas (WebGL visible; eyeballing only, never diffed)');
  }
 };
 try{
  // One browser per scenario: a single page that stays in the game for minutes eventually wedges its
  // renderer thread, and isolating scenarios also keeps one failure from poisoning the rest of the set.
  for(const stage of list){
   for(let attempt=0;;attempt++){
    let done=false;
    try{await playTo(browser.ctx,stage.name);await shoot(stage);done=true;}
    catch(error){if(attempt>=4)throw error;console.error(`${stage.name}: ${error.message} - retrying in a fresh browser`);}
    await browser.close().catch(()=>{});
    browser=await openBrowser(options,url);
    if(done)break;
   }
  }
  await writeFile(join(options.out,'index.json'),JSON.stringify({
   capturedAt:new Date().toISOString(),width:options.width,height:options.height,
   renderer:browser.ctx.renderer,chromeFlags:browser.ctx.flags.filter(flag=>!flag.startsWith('--user-data-dir')),
   scenarios:captured.map(({name,shows})=>({name,shows}))
  },null,1)+'\n');
 }finally{await browser.close().catch(()=>{});server?.close();}
 console.log(`\n${captured.length} screenshot(s) in ${options.out}`);
}

if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 // Exit explicitly once stdout has drained: a stray handle must never keep a finished capture alive.
 main().then(()=>process.stdout.write('',()=>process.exit(0)),error=>{console.error(error.message||error);process.exit(1);});
}
