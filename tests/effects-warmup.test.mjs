import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from '../dist/vendor/three.core.js';
import {warmUpEffects} from '../dist/effects-warmup.js';
import {createCombatEffects} from '../dist/combat-effects.js';
import {createClassEffects} from '../dist/class-effects.js';
import {readDist} from './helpers/source.mjs';

// dist/effects-warmup.js exists to move one-time WebGL shader compiles off the first fight and
// onto the loading screen. Nothing here can observe a GL compile -- there is no context in
// Node -- so what these tests pin instead is the half that can actually break the game: that
// the warm-up builds the throwaways it claims to, hands them to renderer.compile once, and
// then puts the scene back exactly as it found it. A stray child, an undisposed material or a
// disposed shared texture would all show up on screen.
//
// The ctx is the real thing minus the renderer: a real T.Scene with the lights buildRenderer
// adds, a real OrthographicCamera, and the real createCombatEffects / createClassEffects the
// warm-up drives (same as tests/combat-effects.test.mjs and tests/class-effects.test.mjs). The
// renderer is a stub whose compile() is the one moment every throwaway is alive at once.
function makeCtx(onCompile=null){
 const scene=new T.Scene(),camera=new T.OrthographicCamera(-20,20,15,-15,.1,150),glowTexture=new T.Texture();
 scene.add(new T.HemisphereLight(0x9eb8d0,0x493629,1.3),new T.DirectionalLight(0x86b5ed,2.35));
 const compiles=[];
 const ctx={scene,camera,reducedMotion:false,overworldEnvironment:{glowTexture},
  renderer:{compile(target,view){compiles.push({target,view});onCompile?.(scene);}}};
 ctx.environment=ctx.overworldEnvironment;
 ctx.combatEffects=createCombatEffects(scene,glowTexture);
 ctx.classEffects=createClassEffects(scene);
 return {ctx,scene,camera,glowTexture,compiles};
}
// Three shares one module-level geometry across every Sprite, so it is never a warm-up
// allocation -- combat-effects and enemy-visuals both pass skipSpriteGeometry for that reason.
function resourcesIn(scene){
 const found=new Set();
 scene.traverse(node=>{
  if(node.geometry&&!node.isSprite)found.add(node.geometry);
  for(const m of node.material?(Array.isArray(node.material)?node.material:[node.material]):[])found.add(m);
 });
 return found;
}
const shaderNames=scene=>{const names=[];scene.traverse(n=>{for(const m of n.material?(Array.isArray(n.material)?n.material:[n.material]):[])if(m.isShaderMaterial)names.push(m.name);});return names;};
const shaderSources=scene=>{const sources=new Set();scene.traverse(n=>{for(const m of n.material?(Array.isArray(n.material)?n.material:[n.material]):[])if(m.isShaderMaterial)sources.add(m.fragmentShader);});return sources;};
// enemy-visuals' enchantBody patches a MeshStandardMaterial's built-in program via
// onBeforeCompile rather than building a T.ShaderMaterial, so it never shows up in
// shaderSources -- its fixed customProgramCacheKey is the only way to see it staged.
const enchantedMaterials=scene=>{const found=[];scene.traverse(n=>{for(const m of n.material?(Array.isArray(n.material)?n.material:[n.material]):[])if(m.customProgramCacheKey?.()==='enemy-enchantment-v1')found.push(m);});return found;};

test('the warm-up compiles once, against the real scene and camera, with every throwaway already in it',()=>{
 let inFlight=null;
 const {ctx,scene,camera,compiles}=makeCtx(s=>{inFlight={children:s.children.length,sources:shaderSources(s).size,enchanted:enchantedMaterials(s).length};});
 const baseline=scene.children.length;
 warmUpEffects(ctx);
 assert.equal(compiles.length,1,'renderer.compile must be called exactly once');
 assert.equal(compiles[0].target,scene,'compile must see the real scene, whose lights decide which programs a material builds');
 assert.equal(compiles[0].view,camera);
 assert.ok(inFlight.children>baseline+40,`only ${inFlight.children-baseline} throwaways were in the scene when compile ran`);
 // 19 distinct fragment bodies, which is every lazily-built T.ShaderMaterial in the game: 8
 // from class-effect-materials, 5 from loot-effects, 1 from enemy-visuals' energy orb, and 5
 // from combat-effects (emberbolt tail, arcane core, arcane tail, arcane wave, cleave arc). A
 // 20th program -- enemy-visuals' enchantBody, patched onto a MeshStandardMaterial rather than
 // built as a T.ShaderMaterial -- is invisible to shaderSources, so it is checked separately.
 assert.ok(inFlight.sources>=19,`only ${inFlight.sources} distinct shader programs were staged`);
 assert.equal(inFlight.enchanted,1,"enchantBody's warm-up MeshStandardMaterial was not staged for compile");
});

test('it warms every distinct class-effect-materials kind',()=>{
 let staged=[];
 const {ctx}=makeCtx(s=>{staged=shaderNames(s);});
 warmUpEffects(ctx);
 // class-effect-materials names each material `class-${kind}`; these eight kinds are the
 // complete set of fragment bodies it can build, and each one is a separate GL program.
 for(const kind of ['trail','ground','wave','cloud','shadow','ward','flame','mote'])
  assert.ok(staged.includes(`class-${kind}`),`no throwaway ever built the '${kind}' class effect material`);
});

test('the scene is left exactly as it was found, with every warmed resource released',()=>{
 let allocated=null;
 const disposals=new Map();
 const {ctx,scene,glowTexture}=makeCtx(s=>{
  allocated=[...resourcesIn(s)].filter(r=>!baseline.has(r));
  for(const resource of allocated){disposals.set(resource,0);resource.addEventListener('dispose',()=>disposals.set(resource,disposals.get(resource)+1));}
 });
 const baseline=resourcesIn(scene),children=[...scene.children];
 let textureDisposals=0;glowTexture.addEventListener('dispose',()=>textureDisposals++);
 warmUpEffects(ctx);
 assert.ok(allocated.length>100,`the warm-up only allocated ${allocated.length} resources`);
 assert.ok(allocated.some(r=>r.customProgramCacheKey?.()==='enemy-enchantment-v1'),"enchantBody's warm-up material was never allocated");
 const leaked=[...disposals].filter(([,count])=>count===0);
 assert.deepEqual(leaked.map(([r])=>r.name||r.type),[],'a warm-up resource was never disposed');
 assert.equal(textureDisposals,0,'the shared glow texture the rest of the game draws with was disposed');
 assert.deepEqual([...scene.children],children,'the warm-up left the scene children changed');
 // combat-effects' two persistent PointLights must survive at rest: combatEffects.dispose()
 // would remove them, and a non-zero intensity would light the village from nowhere.
 const lights=scene.children.filter(n=>n.isPointLight);
 assert.equal(lights.length,2);
 for(const light of lights)assert.equal(light.intensity,0);
});

test('warming twice is still clean, so a re-entered init cannot leak',()=>{
 const {ctx,scene,compiles}=makeCtx();
 const children=[...scene.children];
 warmUpEffects(ctx);warmUpEffects(ctx);
 assert.equal(compiles.length,2);
 assert.deepEqual([...scene.children],children);
});

test('dist/main.js runs the warm-up inside init(), after buildHero and before the animation loop',()=>{
 const main=readDist('main.js');
 assert.ok(main.includes("import {warmUpEffects} from './effects-warmup.js';"),'main.js no longer imports the warm-up');
 const call=main.indexOf('warmUpEffects(ctx);');
 assert.notEqual(call,-1,'main.js never calls warmUpEffects');
 assert.ok(call>main.indexOf('await ctx.buildHero();'),'the warm-up must follow buildHero, which builds the scene it warms');
 assert.ok(call<main.indexOf('ctx.titleScreen.setProgress(100)'),'the warm-up must land while the loading screen still covers it');
 assert.ok(call<main.indexOf('ctx.renderer.setAnimationLoop(ctx.frame)'),'the warm-up must finish before any frame can render a throwaway');
 // It owns no ctx slot on purpose: a one-shot call needs the built scene, so it cannot sit in
 // the wiring block, and adding it to ctx would perturb the automation surface's shape.
 assert.equal(/Object\.assign\(ctx,[^)]*[wW]armUp/.test(main),false,'the warm-up is not a ctx factory');
});
