// renderSharedWorld moved verbatim out of main.js (M10): the per-frame sync of everything the
// server owns -- hazards, class-effect actors, enemy models and bars, projectile visuals and
// zone visuals -- plus the selection ring and player light that follow the hero. No statement
// moved and no ctx rename was needed; every name it touched was already ctx.* in main.js.
//
// Free identifiers: T (three, only T.MathUtils and T.Vector3, so the core build), angleLerp
// (./multiplayer-protocol.js), distance (./combat.js) stay plain imports; createEnemyOrb
// (./enemy-visuals.js) is re-imported through a `deps` escape hatch defaulting to that same
// import -- the only deviation from verbatim -- because tests/shared-world-render.test.mjs
// drives a plain-object scene that cannot hold a real orb. Math and Set are globals.
import * as T from './vendor/three.core.js';
import {angleLerp} from './multiplayer-protocol.js';
import {distance} from './combat.js';
import {createEnemyOrb as createEnemyOrbImport} from './enemy-visuals.js';
const _worldOffset=new T.Vector3(),_projectileIds=new Set(),_zoneIds=new Set();
export function createSharedWorldRender(ctx,{createEnemyOrb=createEnemyOrbImport}={}){
 function renderSharedWorld(dt,t){ctx.renderHazards();ctx.classEffects.syncActors(ctx.lastSnapshot?.players||[],id=>id===ctx.network?.id?ctx.player:ctx.multiplayerView?.actors.get(id)?.model,ctx.renderedMap);
  for(const e of ctx.enemies){const n=e.net;if(!n)continue;const blend=1-Math.exp(-dt*14);e.model.position.x=T.MathUtils.lerp(e.model.position.x,n.x,blend);e.model.position.z=T.MathUtils.lerp(e.model.position.z,n.z,blend);e.model.rotation.y=angleLerp(e.model.rotation.y,n.angle,blend);
   if(e.dead){e.visuals.update(n,dt,t);e.model.rotation.z=T.MathUtils.lerp(e.model.rotation.z,1.45,dt*7);e.model.position.y=Math.max(-1,e.model.position.y-dt*.5);e.model.visible=e.model.position.y>-.9;e.bar.visible=false;continue;}
   if(e.barHealth>e.hp){e.barHealth=Math.max(e.hp,e.barHealth-dt*e.maxHp*1.6);ctx.updateEnemyBar(e);}const modelType=ctx.enemyModelType(e.type);ctx.animateRig(e.rig,t,n.moving,n.phase==='windup'?1-n.timer/e.data.windup:0,modelType);e.visuals.update(n,dt,t+e.seed);_worldOffset.set(0,(modelType==='boss'?4.8:modelType==='hound'?1.5:modelType==='hollow'?2.25:3.25)*(e.data.scale||1),0);e.bar.position.copy(e.model.position).add(_worldOffset);e.bar.visible=e===ctx.mouseTargeting?.selected||distance(ctx.player.position,e.model.position)<12;
   if(e.telegraph){e.telegraph.children[0].material.opacity=.08+(1-n.timer/e.data.windup)*.26;}
  }
  _projectileIds.clear();for(const b of ctx.lastSnapshot?.projectiles||[])_projectileIds.add(b.id);
  for(const [id,b] of ctx.networkProjectiles)if(!_projectileIds.has(id)){b.visual?b.visual.dispose():ctx.removeObject(b.mesh);ctx.networkProjectiles.delete(id);}
  for(const b of ctx.lastSnapshot?.projectiles||[]){let visual=ctx.networkProjectiles.get(b.id);if(!visual){
   const pos=new T.Vector3(b.x,b.hostile?.8:1.1,b.z),dir=new T.Vector3(Math.sin(b.angle),0,Math.cos(b.angle));
   if(!b.hostile){
    const bolt=b.visual==='arcane'?ctx.combatEffects.arcaneBolt(pos,dir,b.speed):b.visual&&b.visual!=='ember'?ctx.classEffects.projectile(b):ctx.combatEffects.emberbolt(pos,dir);
    visual={mesh:bolt.mesh,visual:bolt};
   }else{const bolt=createEnemyOrb(ctx.scene,ctx.overworldEnvironment.glowTexture,pos,b.angle,b.color||'#ff714b',{reducedMotion:ctx.reducedMotion});visual={mesh:bolt.mesh,visual:bolt};}
   ctx.networkProjectiles.set(b.id,visual);
  }
   const blend=1-Math.exp(-dt*20);visual.mesh.position.x=T.MathUtils.lerp(visual.mesh.position.x,b.x,blend);visual.mesh.position.z=T.MathUtils.lerp(visual.mesh.position.z,b.z,blend);visual.visual?.update(dt);
  }
  _zoneIds.clear();for(const z of ctx.lastSnapshot?.zones||[])_zoneIds.add(z.id);
  for(const [id,visual] of ctx.networkZones)if(!_zoneIds.has(id)){visual.dispose();ctx.networkZones.delete(id);}
  for(const data of ctx.lastSnapshot?.zones||[]){let visual=ctx.networkZones.get(data.id);if(!visual){visual=ctx.classEffects.zone(data);ctx.networkZones.set(data.id,visual);}visual.update(data,ctx.lastSnapshot.time,dt);}
  ctx.selection.position.set(ctx.player.position.x,.1,ctx.player.position.z);_worldOffset.set(0,2.7,0);ctx.playerLight.position.copy(ctx.player.position).add(_worldOffset);
 }
 return {renderSharedWorld};
}
