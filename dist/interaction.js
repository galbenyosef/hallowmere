// enterBuilding/nearbyInteraction/interact/collectClickedLoot/regionInteractions/canReachRegion/
// interactRegion moved verbatim out of main.js (M4). Free identifiers: T (three, module import,
// for enterBuilding's and interactRegion's Vector3), distance (./combat.js, nearbyInteraction/
// canReachRegion), hasLineOfSight (./combat.js, canReachRegion). ctx.environment/ctx.player/
// ctx.life/ctx.ready/ctx.paused/ctx.backgrounded/ctx.state/ctx.network/ctx.pendingRegionInteraction/
// ctx.lastSnapshot (already-declared ctx data fields). ctx.setDestination (wired by this task's
// createPointerTargeting, called across module boundary from interactRegion). ctx.awaken/
// ctx.toast/ctx.releaseInput (main.js functions this task adds to ctx, since enterBuilding/
// collectClickedLoot/interactRegion call them). regionInteractions/nearbyInteraction/interact/
// enterBuilding/canReachRegion call each other directly within this closure, same as groundPing
// calling ringEffect in effects-factory.js.
import * as T from './vendor/three.core.js';
import {distance,hasLineOfSight} from './combat.js';
export function createInteraction(ctx){
 let regionCache=null;
 function enterBuilding(b){if(!b.doorCollider.disabled){const reason='The chapel is sealed. Defeat the Bellkeeper to enter.';ctx.toast(reason);return{ok:false,reason};}const inside=ctx.environment.currentBuilding(ctx.player.position)?.id===b.id;ctx.awaken();const goal=inside?b.exit:b.entry;const ok=ctx.setDestination(new T.Vector3(goal.x,0,goal.z));return{ok,building:b.id,action:inside?'leave':'enter'};}
 function nearbyInteraction(){const regional=regionInteractions().filter(r=>!r.completed&&distance(r,ctx.player.position)<2.8).sort((a,b)=>distance(a,ctx.player.position)-distance(b,ctx.player.position))[0];if(regional)return{regional};const target=ctx.life?.nearest(),building=ctx.environment?.nearestDoor(ctx.player.position);if(target&&(!building||distance(target.model.position,ctx.player.position)<distance(building.door,ctx.player.position)))return{target};return building?{building}:target?{target}:null;}
 function interact(id){const regional=id?regionInteractions().find(r=>r.id===id):nearbyInteraction()?.regional;if(regional)return interactRegion(regional);const building=id?ctx.environment.buildings.find(b=>b.id===id):nearbyInteraction()?.building;if(building)return enterBuilding(building);return ctx.life.interact(id);}
 function collectClickedLoot(id){
  if(!ctx.ready||ctx.paused||ctx.backgrounded||ctx.state.ended||!ctx.network?.connected)return{ok:false};
  ctx.awaken();ctx.releaseInput();ctx.life.pending=null;
  const result=ctx.life.interact(id);if(!result.ok)ctx.toast(result.reason);return result;
 }
 function regionInteractions(){const snapshot=ctx.lastSnapshot,interactions=snapshot?.interactions,state=ctx.state,discoveries=state.discoveries,length=discoveries?.length??0;if(regionCache&&regionCache.snapshot===snapshot&&regionCache.interactions===interactions&&regionCache.state===state&&regionCache.discoveries===discoveries&&regionCache.length===length)return regionCache.result;const result=Object.entries(interactions||{}).flatMap(([group,records])=>records.map(r=>({...r,operation:({portals:'travel',objectives:'objective',checkpoints:'checkpoint',caches:'cache'})[group]}))).filter(r=>r.operation&&(!r.hidden||r.discovered||discoveries?.includes(r.id)));regionCache={snapshot,interactions,state,discoveries,length,result};return result;}
 function canReachRegion(r,radius=2.8){return distance(r,ctx.player.position)<=radius&&hasLineOfSight(ctx.player.position,r,ctx.environment.obstacles,.08)&&(!r.buildingId||ctx.environment.currentBuilding(ctx.player.position)?.id===r.buildingId);}
 function interactRegion(r){if(r.locked)return{ok:false,reason:r.reason||(r.operation==='travel'?'This passage is sealed. Continue the region’s objectives.':'Defeat the nearby guardians first.')};if(r.completed)return{ok:false,reason:'Already completed.'};if(!canReachRegion(r)){if(ctx.setDestination(new T.Vector3(r.x,0,r.z))){ctx.pendingRegionInteraction=r.id;return{ok:true,approaching:r.name};}return{ok:false,reason:'That path is blocked.'};}ctx.pendingRegionInteraction=null;ctx.releaseInput();return{ok:ctx.network.send(r.operation,{id:r.id}),pending:true};}
 return {enterBuilding,nearbyInteraction,interact,collectClickedLoot,regionInteractions,canReachRegion,interactRegion};
}
