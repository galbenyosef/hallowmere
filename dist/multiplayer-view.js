import {classFor,classAppearance,conceptFor} from './classes.js';
import * as T from './vendor/three.core.js';
import {angleLerp} from './multiplayer-protocol.js';

// Cloned materials belong to each actor; prefab geometry stays shared.
export function disposeActor(model){model.removeFromParent();const materials=new Set();model.traverse(n=>{if(n.material)for(const m of Array.isArray(n.material)?n.material:[n.material])materials.add(m);});materials.forEach(m=>m.dispose());}
export function colorWarden(model,color){model.getObjectByName('cape')?.traverse(n=>{if(n.isMesh){n.material.color.set(color);n.material.emissive.set(color).multiplyScalar(.12);n.material.userData.baseEmissive=n.material.emissive.clone();}});}
export function createMultiplayerView({scene,camera,cloneModel,getRig,animateRig,animateHeroAttack,player}){
 const actors=new Map(),layer=document.getElementById('world-labels');let selfId=null,currentMap='overworld';
 function sync(players,you){selfId=you;currentMap=players.find(p=>p.id===you)?.mapId||'overworld';const ids=new Set(players.map(p=>p.id));for(const [id,a] of actors)if(!ids.has(id)){a.label.remove();if(a.model!==player)disposeActor(a.model);a.ring.removeFromParent();a.ring.geometry.dispose();a.ring.material.dispose();actors.delete(id);}
  for(const p of players){let a=actors.get(p.id);if(!a){const model=p.id===you?player:cloneModel(conceptFor(p.classId,p.appearanceId));colorWarden(model,p.color);if(p.id!==you){model.position.set(p.x,0,p.z);scene.add(model);}
    const label=document.createElement('div');label.className='player-label';label.style.color=p.color;layer.append(label);
    const ring=new T.Mesh(new T.RingGeometry(.49,.55,40),new T.MeshBasicMaterial({color:p.color,transparent:true,opacity:.7,depthWrite:false}));ring.rotation.x=-Math.PI/2;scene.add(ring);
    a={model,label,ring,rig:getRig(model),classKey:conceptFor(p.classId,p.appearanceId)};actors.set(p.id,a);
   }const classKey=conceptFor(p.classId,p.appearanceId);if(a.classKey!==classKey){if(p.id!==you){const replacement=cloneModel(classKey);replacement.position.copy(a.model.position);replacement.rotation.copy(a.model.rotation);disposeActor(a.model);a.model=replacement;scene.add(replacement);}a.rig=getRig(a.model);a.classKey=classKey;}if(a.state&&a.state.mapId!==p.mapId&&p.id!==you)a.model.position.set(p.x,0,p.z);a.state=p;const name=p.classId?(classAppearance(p.classId,p.appearanceId)?.name||classFor(p).name):`Warden ${p.slot+1}`;a.label.textContent=p.id===you?`You · ${name}`:`${name}${p.classId?' · '+(p.slot+1):''}${p.ended?' · Fallen':''}`;
  }
 }
 function update(dt,t){for(const [id,a] of actors){const p=a.state,sameMap=(p.mapId||'overworld')===currentMap;a.model.visible=sameMap;a.ring.visible=sameMap&&!p.ended;a.label.hidden=!sameMap;if(!sameMap)continue;if(id!==selfId){const blend=1-Math.exp(-dt*14);a.model.position.x=T.MathUtils.lerp(a.model.position.x,p.x,blend);a.model.position.z=T.MathUtils.lerp(a.model.position.z,p.z,blend);a.model.rotation.y=angleLerp(a.model.rotation.y,p.angle,blend);a.model.rotation.z=T.MathUtils.lerp(a.model.rotation.z,p.ended?-1.5:0,blend);animateRig(a.rig,t,p.moving);animateHeroAttack(a.rig,dt);}
   a.ring.position.set(a.model.position.x,.105,a.model.position.z);a.ring.visible=!p.ended;
   const projected=a.model.position.clone().add(new T.Vector3(0,p.classId?2.9:2.7,0)).project(camera);a.label.hidden=projected.z>1||Math.abs(projected.x)>1||Math.abs(projected.y)>1;
   a.label.style.transform=`translate(${(projected.x*.5+.5)*innerWidth}px,${(-projected.y*.5+.5)*innerHeight}px) translate(-50%,-100%)`;
  }}
 return {actors,sync,update};
}
