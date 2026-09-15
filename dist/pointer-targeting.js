// getPointerWorld/updatePointer/enemyAtPoint/pointerAction/updateMouseTarget/setDestination/
// nearestEnemy moved verbatim out of main.js (M4). Free identifiers: T (three, module import,
// for setDestination's Vector3), $ (./dom.js, for updatePointer's and updateMouseTarget's
// literal $('world') lookups), distance (./combat.js, enemyAtPoint/pointerAction/nearestEnemy),
// findPath (./combat.js, setDestination). ctx.camera/ctx.raycaster/ctx.pointer/ctx.plane/
// ctx.targetWorld/ctx.aimActive/ctx.mouseInWorld/ctx.pointerIsMouse/ctx.pointerShift/ctx.ready/
// ctx.life/ctx.environment/ctx.mouseTargeting/ctx.lockedEnemy/ctx.attackHeld/ctx.movePath/
// ctx.paused/ctx.backgrounded/ctx.state/ctx.rosterPicker/ctx.network/ctx.mouseAction/ctx.enemies/
// ctx.player/ctx.moveTarget (already-declared ctx data fields), ctx.worldBounds/ctx.groundPing
// (already wired by game-context.js/M3's createEffects), ctx.regionInteractions (wired by this
// task's createInteraction, called across module boundary), ctx.toast (a main.js function this
// task adds to ctx, since setDestination calls it), Math (global). getPointerWorld/pointerAction/
// enemyAtPoint/updateMouseTarget call each other directly within this closure, same as groundPing
// calling ringEffect in effects-factory.js.
import * as T from 'three';
import {$} from './dom.js';
import {distance,findPath} from './combat.js';
export function createPointerTargeting(ctx){
 function getPointerWorld(){ctx.camera.updateMatrixWorld();ctx.raycaster.setFromCamera(ctx.pointer,ctx.camera);ctx.raycaster.ray.intersectPlane(ctx.plane,ctx.targetWorld);}
 function updatePointer(event){const rect=$('world').getBoundingClientRect();ctx.pointer.set((event.clientX-rect.left)/rect.width*2-1,-(event.clientY-rect.top)/rect.height*2+1);ctx.aimActive=true;ctx.mouseInWorld=true;ctx.pointerIsMouse=event.pointerType!=='touch';ctx.pointerShift=event.shiftKey;if(ctx.ready){getPointerWorld();updateMouseTarget();}}
 function enemyAtPoint(point){let best=null,bestD=1.45;for(const e of ctx.enemies){if(e.dead)continue;const d=distance(e.model.position,point);if(d<bestD+(ctx.bossType(e.type)?.6:0)){bestD=d;best=e;}}return best;}
 function pointerAction(){
  getPointerWorld();
  // Hover and click share interaction priority, so the preview never promises
  // an attack on a click that actually collects loot or opens a door.
  if(!ctx.pointerShift){
   const drop=ctx.life.pickLoot(ctx.raycaster);if(drop)return{kind:'loot',target:drop};
   const regional=ctx.regionInteractions().find(r=>!r.completed&&distance(r,ctx.targetWorld)<1.6);if(regional)return{kind:'region',target:regional};
   const door=ctx.environment.pickDoor(ctx.raycaster);if(door)return{kind:'door',target:door};
  }
  const npc=ctx.life.visibleNpcs().find(n=>distance(n.model.position,ctx.targetWorld)<1.1);if(npc)return{kind:'npc',target:npc};
  const enemy=ctx.mouseTargeting.pick(ctx.pointer,{assist:ctx.pointerIsMouse})||(!ctx.pointerIsMouse?enemyAtPoint(ctx.targetWorld):null);
  return enemy?{kind:'enemy',target:enemy}:null;
 }
 function updateMouseTarget(){
  if(ctx.lockedEnemy&&(ctx.lockedEnemy.dead||!ctx.enemies.includes(ctx.lockedEnemy))){ctx.lockedEnemy=null;ctx.attackHeld=false;ctx.movePath=[];}
  const active=ctx.ready&&!ctx.paused&&!ctx.backgrounded&&!ctx.state.ended&&!ctx.rosterPicker?.open&&ctx.network?.connected;
  ctx.mouseAction=active&&ctx.mouseInWorld?pointerAction():null;
  const held=active&&ctx.attackHeld&&ctx.lockedEnemy&&!ctx.lockedEnemy.dead&&ctx.enemies.includes(ctx.lockedEnemy)?ctx.lockedEnemy:null;
  ctx.mouseTargeting?.show(held||(ctx.pointerIsMouse&&ctx.mouseAction?.kind==='enemy'?ctx.mouseAction.target:null));
  $('world').classList.toggle('enemy-hover',!!ctx.mouseTargeting?.selected);
  $('world').classList.toggle('enemy-attacking',!!held);
  $('world').classList.toggle('loot-hover',ctx.mouseAction?.kind==='loot');
 }
 function setDestination(point){if(!ctx.network?.connected)return false;const path=findPath(ctx.player.position,point,ctx.environment.obstacles,ctx.worldBounds());if(!path.length){ctx.toast('That way is blocked.');return false;}if(ctx.life)ctx.life.pending=null;ctx.pendingRegionInteraction=null;ctx.movePath=path;const first=ctx.movePath.shift();ctx.moveTarget=new T.Vector3(first.x,0,first.z);ctx.lockedEnemy=null;ctx.attackHeld=false;ctx.groundPing(point);return true;}
 function nearestEnemy(range=9){let best=null,dist=range;for(const e of ctx.enemies){if(e.dead)continue;const d=distance(ctx.player.position,e.model.position);if(d<dist){best=e;dist=d;}}return best;}
 return {getPointerWorld,updatePointer,enemyAtPoint,pointerAction,updateMouseTarget,setDestination,nearestEnemy};
}
