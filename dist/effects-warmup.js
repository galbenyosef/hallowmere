// WebGL compiles a shader program the first time something is drawn with it, and that compile
// is a synchronous main-thread stall of 50-300ms. combat-effects, loot-effects, enemy-visuals
// and class-effect-materials all build their T.ShaderMaterial lazily, the first time a
// gameplay event needs one, so each distinct program costs one stall the first time a player
// casts, is shot at, or a drop lands -- which for nearly every player is their first real
// fight, in the Hallowmere village cluster (Ashwick is a sanctuary). That is the "gets a
// little slow near the village" report. Nothing in dist/ ever precompiled these.
//
// So: build one throwaway of every distinct shader shape far outside every map's bounds, hand
// the whole scene to renderer.compile() once, then dispose every throwaway. compile() only
// builds programs -- it never renders or presents -- and init() calls this before
// renderer.setAnimationLoop, so no frame can draw a throwaway even for one tick. Passing the
// real ctx.scene/ctx.camera matters: the program a material compiles to depends on the scene's
// lights, so warming against a bare scene would cache programs the real render never uses.
import * as T from './vendor/three.core.js';
import {createLootVisual} from './loot-effects.js';
import {createEnemyOrb} from './enemy-visuals.js';
import {CLASSES,classColor} from './classes.js';

// Far outside the overworld and every region map, so a throwaway stays invisible even if some
// later change did manage to render a frame while one is alive.
const WARM=new T.Vector3(4000,-400,4000),WARM_DIR=new T.Vector3(0,0,1);

export function warmUpEffects(ctx){
 const {combatEffects,classEffects,scene,reducedMotion}=ctx,disposables=[];
 // Sorcerer / warden path. cast, arcaneCast, emberImpact, arcaneImpact, steelImpact and cleave
 // push into combat-effects' internal burst list with no external handle, so update(9999)
 // below force-expires them; combatEffects.dispose() would also drop the two persistent
 // PointLights the rest of the game renders through, so it is never called here.
 disposables.push(combatEffects.emberbolt(WARM,WARM_DIR),combatEffects.arcaneBolt(WARM,WARM_DIR,17));
 combatEffects.cast(WARM,WARM_DIR);combatEffects.arcaneCast(WARM,WARM_DIR);
 combatEffects.emberImpact(WARM,WARM_DIR);combatEffects.arcaneImpact(WARM,WARM_DIR);combatEffects.steelImpact(WARM);
 combatEffects.cleave({position:WARM},0);
 // One drop compiles all five loot programs: the GLSL is fixed module-level text and per-drop
 // rarity/kind/colour only ever moves uniforms. 'item' is the kind that also raises the beam;
 // ground, aura, core and sparks are unconditional.
 const loot=createLootVisual({id:'warmup',kind:'item',rarity:'common'},{reducedMotion,pixelRatio:Math.min(globalThis.devicePixelRatio||1,1.7)});
 loot.model.position.copy(WARM);scene.add(loot.model);disposables.push(loot);
 // Hostile caster projectile (quarry-mage, pyromancer), spelled like shared-world-render's call.
 disposables.push(createEnemyOrb(scene,ctx.overworldEnvironment.glowTexture,WARM,0,'#ff714b',{reducedMotion}));
 // Every class-effect-materials kind, across every class a journey can be: melee/burst/dodge
 // through ability(), plus the projectile and zone shapes the snapshot renderer builds. The
 // event and zone literals mirror class-combat.js's emit/zones.push shapes. ability() returns
 // false for sorcerer -- it has no palette and runs through combat-effects above -- so the loop
 // stays uniform rather than special-casing it.
 const actor=new T.Group();actor.position.copy(WARM);
 for(const [classId,{abilities}] of Object.entries(CLASSES)){
  // Sorcerer zones fall through to class-effects' legacy path, which reads zone.color for all 19
  // of its materials; class-combat.js sends classColor(p.state), so a zone literal without it
  // would build them all with an undefined colour.
  const color=classColor({classId});
  for(const [action,skill] of Object.entries(abilities)){
   classEffects.ability({classId,action,kind:skill.kind,x:WARM.x,z:WARM.z,angle:0},skill,actor);
   if(skill.kind==='projectile')classEffects.projectile({classId,action,visual:skill.projectile,x:WARM.x,z:WARM.z,angle:0,speed:skill.speed});
   if(skill.kind==='zone')classEffects.zone({classId,action,color,radius:skill.radius,x:WARM.x,z:WARM.z,start:0,until:skill.duration});
   if(skill.kind==='support')classEffects.zone({kind:'support',classId,action,color,casterId:'warmup',targetId:'warmup',radius:.5,x:WARM.x,z:WARM.z,start:0,until:skill.duration});
  }
 }
 ctx.renderer.compile(scene,ctx.camera);
 for(const item of disposables)item.dispose();
 combatEffects.update(9999);
 // clear() is the module's own sweep of every burst, projectile, zone and ward it holds. It is
 // exact here rather than destructive because init() runs this before showModeChoice(), so no
 // session has started and the only class effects alive are the throwaways above.
 classEffects.clear();
}
