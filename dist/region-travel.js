// switchMap/renderRegionLabels/renderHazards moved verbatim out of main.js (M4). Free
// identifiers: T (three, module import), $ (./dom.js, renderRegionLabels's literal
// $('world-labels') lookup), distance (./combat.js, renderRegionLabels), mapFor (./regions.js,
// switchMap), createRegionEnvironment (./region-environment.js, switchMap), regionActionName
// (./region-client-ui.js, renderRegionLabels). ctx.victoryTimer/ctx.pendingRegionInteraction/
// ctx.aimActive/ctx.dodgeTime/ctx.life/ctx.networkZones/ctx.networkHazards/ctx.regionLabels/
// ctx.renderedMap/ctx.environment/ctx.overworldObjects/ctx.overworldEnvironment/ctx.scene/
// ctx.cameraTarget/ctx.player/ctx.hemisphereLight/ctx.moonLight/ctx.rimLight/ctx.playerLight/
// ctx.camera/ctx.lastSnapshot (already-declared ctx data fields). ctx.removeObject (already wired
// by M3's createEffects). ctx.regionInteractions/ctx.interact/ctx.canReachRegion (wired by this
// task's createInteraction, called across module boundary from renderRegionLabels). ctx.awaken/
// ctx.toast (main.js functions this task adds to ctx, since renderRegionLabels's label click
// handler calls them). Math/document/innerWidth/innerHeight (globals).
import * as T from 'three';
import {$} from './dom.js';
import {distance} from './combat.js';
import {mapFor} from './regions.js';
import {createRegionEnvironment} from './region-environment.js';
import {regionActionName} from './region-client-ui.js';
export function createRegionTravel(ctx){
 function switchMap(mapId){clearTimeout(ctx.victoryTimer);ctx.pendingRegionInteraction=null;ctx.aimActive=false;ctx.dodgeTime=0;ctx.life.pending=null;for(const visual of ctx.networkZones.values())visual.dispose();ctx.networkZones.clear();for(const visual of ctx.networkHazards.values())ctx.removeObject(visual);ctx.networkHazards.clear();for(const label of ctx.regionLabels.values())label.remove();ctx.regionLabels.clear();if(ctx.renderedMap!=='overworld')ctx.environment.dispose();else for(const object of ctx.overworldObjects)object.userData.overworldVisible=object.visible;ctx.renderedMap=mapId;for(const object of ctx.overworldObjects)object.visible=mapId==='overworld'&&(object.userData.overworldVisible??true);ctx.environment=mapId==='overworld'?ctx.overworldEnvironment:createRegionEnvironment(ctx.scene,mapId);ctx.life.obstacles=ctx.environment.obstacles;for(const npc of ctx.life.npcs){npc.model.visible=npc.ring.visible=mapId==='overworld';npc.label.hidden=true;}ctx.cameraTarget.copy(ctx.player.position);const cave=mapFor(mapId).theme==='cave';ctx.hemisphereLight.intensity=cave?.95:1.3;ctx.moonLight.intensity=cave?1.45:2.35;ctx.rimLight.intensity=cave?.55:1.25;ctx.playerLight.intensity=cave?8:10;ctx.scene.fog.density=cave?.021:.017;ctx.scene.background.set((mapId==='underways'||mapFor(mapId).theme==='cave')?0x090d12:0x101c2b);ctx.scene.fog.color.set((mapId==='underways'||mapFor(mapId).theme==='cave')?0x101921:0x14283a);}
 function renderRegionLabels(){
  const records=ctx.regionInteractions(),ids=new Set(records.map(r=>r.id));
  for(const[id,label]of ctx.regionLabels)if(!ids.has(id)){label.remove();ctx.regionLabels.delete(id);}
  for(const r of records){
   const cache=r.operation==='cache';let label=ctx.regionLabels.get(r.id);
   if(!label){
    label=document.createElement('button');label.type='button';label.className=cache?'world-label loot-label common cache-label':'world-label npc-label';
    if(cache)label.innerHTML='<span class="loot-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M3 11V8a5 5 0 0 1 5-5h8a5 5 0 0 1 5 5v3 M3 11h18v9H3Z M7 4v16 M17 4v16 M10 10h4v5h-4Z"/></svg></span><span class="loot-name"></span>';
    label.onclick=()=>{if(ctx.paused||ctx.backgrounded||ctx.state.ended)return;ctx.awaken();const result=ctx.interact(r.id);if(!result.ok)ctx.toast(result.reason);};
    $('world-labels').append(label);ctx.regionLabels.set(r.id,label);
   }
   (cache?label.querySelector('.loot-name'):label).textContent=regionActionName(r);
   if(cache)label.classList.toggle('in-reach',!r.locked&&!r.completed&&ctx.canReachRegion(r));
   const projected=new T.Vector3(r.x,2,r.z).project(ctx.camera);
   label.hidden=r.completed||distance(r,ctx.player.position)>11||projected.z>1||Math.abs(projected.x)>.94||Math.abs(projected.y)>.86;
   label.style.left=`${(projected.x*.5+.5)*innerWidth}px`;label.style.top=`${(-projected.y*.5+.5)*innerHeight}px`;
  }
 }
 function renderHazards(){const hazards=ctx.lastSnapshot?.hazards||[],ids=new Set(hazards.map(h=>h.id));for(const[id,visual]of ctx.networkHazards)if(!ids.has(id)){ctx.removeObject(visual);ctx.networkHazards.delete(id);}for(const h of hazards){let visual=ctx.networkHazards.get(h.id);if(!visual){visual=new T.Group();visual.position.set(h.x,.14,h.z);const geometry=h.radius?new T.CircleGeometry(h.radius,48):new T.PlaneGeometry(h.w,h.d);const fill=new T.Mesh(geometry,new T.MeshBasicMaterial({color:0xe88a46,transparent:true,opacity:.2,side:T.DoubleSide,depthWrite:false}));fill.rotation.x=-Math.PI/2;visual.add(fill);const edge=new T.LineSegments(new T.EdgesGeometry(geometry),new T.LineBasicMaterial({color:0xffbf7a,transparent:true,opacity:.9}));edge.rotation.x=-Math.PI/2;visual.add(edge);visual.rotation.y=h.angle||0;ctx.scene.add(visual);ctx.networkHazards.set(h.id,visual);}const active=ctx.lastSnapshot.time>=h.activateAt;visual.children[0].material.opacity=active?.58:.12+.2*Math.max(0,Math.min(1,(ctx.lastSnapshot.time-h.start)/Math.max(.1,h.activateAt-h.start)));visual.children[0].material.color.set(active?0xff4932:0xe88a46);}}
 return {switchMap,renderRegionLabels,renderHazards};
}
