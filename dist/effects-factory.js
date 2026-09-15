// groundPing/ringEffect/slash/steelImpact/particles/telegraph/removeObject/cancelAttack/
// floatText moved verbatim out of main.js (M3). Free identifiers: T (three, module import),
// $ (./dom.js, for floatText's literal $('float-layer') lookup), ctx.scene/ctx.effects/
// ctx.floaters/ctx.combatEffects (already-declared ctx data fields), Math/document (globals).
// groundPing calls ringEffect and cancelAttack calls removeObject directly — both stay in
// this closure, same as cloneModel calling optimizeModel directly in model-kit.js.
import * as T from 'three';
import {$} from './dom.js';
export function createEffects(ctx){
 function groundPing(pos){ringEffect(pos,0xc0c2a1,.25,.65,.45);}
 function ringEffect(pos,color,from,to,life){const mesh=new T.Mesh(new T.RingGeometry(.89,1,64),new T.MeshBasicMaterial({color,transparent:true,opacity:.8,depthWrite:false,side:T.DoubleSide,blending:T.AdditiveBlending}));mesh.rotation.x=-Math.PI/2;mesh.position.set(pos.x,.13,pos.z);ctx.scene.add(mesh);ctx.effects.push({type:'ring',mesh,time:0,life,from,to});}
 function slash(pos,a,color,radius,life){const mesh=new T.Mesh(new T.RingGeometry(radius*.965,radius,48,1,-Math.PI/2-.72,1.44),new T.MeshBasicMaterial({color,transparent:true,opacity:.48,depthWrite:false,side:T.DoubleSide,blending:T.AdditiveBlending}));mesh.rotation.set(-Math.PI/2,0,a-.2);mesh.position.copy(pos).add(new T.Vector3(0,.85,0));ctx.scene.add(mesh);ctx.effects.push({type:'slash',mesh,time:0,life,angle:a});}
 function steelImpact(pos){ctx.combatEffects.steelImpact(pos);}
 function particles(pos,color,count,speed){const values=new Float32Array(count*3),velocity=new Float32Array(count*3);for(let i=0;i<count;i++){velocity[i*3]=(Math.random()-.5)*speed*2;velocity[i*3+1]=Math.random()*speed+1;velocity[i*3+2]=(Math.random()-.5)*speed*2;}const g=new T.BufferGeometry();g.setAttribute('position',new T.BufferAttribute(values,3));const mesh=new T.Points(g,new T.PointsMaterial({color,size:.065,transparent:true,opacity:.9,depthWrite:false,blending:T.AdditiveBlending}));mesh.position.copy(pos);ctx.scene.add(mesh);ctx.effects.push({type:'particles',mesh,velocity,time:0,life:.75});}
 function telegraph(pos,radius,arc=Math.PI*2,a=0){const group=new T.Group();group.position.set(pos.x,.1,pos.z);const mat=new T.MeshBasicMaterial({color:0xe76042,transparent:true,opacity:.15,side:T.DoubleSide,depthWrite:false});const fill=new T.Mesh(new T.CircleGeometry(radius,48,-Math.PI/2-arc/2,arc),mat);fill.rotation.set(-Math.PI/2,0,a);group.add(fill);const edge=new T.Mesh(new T.RingGeometry(radius-.055,radius,48,1,-Math.PI/2-arc/2,arc),new T.MeshBasicMaterial({color:0xf59766,transparent:true,opacity:.48,depthWrite:false,side:T.DoubleSide}));edge.rotation.set(-Math.PI/2,0,a);group.add(edge);ctx.scene.add(group);return group;}
 function removeObject(object){ctx.scene.remove(object);object.traverse(o=>{if(o.geometry&&!o.isSprite)o.geometry.dispose();if(o.material){if(Array.isArray(o.material))o.material.forEach(m=>m.dispose());else o.material.dispose();}});}
 function cancelAttack(e,stun=0){if(e.telegraph){removeObject(e.telegraph);e.telegraph=null;}if(stun&&!e.dead){e.phase='recover';e.timer=stun;e.cooldown=.8;}}
 function floatText(text,pos,kind=''){const element=document.createElement('div');element.className=`damage-number ${kind}`;element.textContent=text;$('float-layer').append(element);ctx.floaters.push({element,pos:new T.Vector3(pos.x,1.9,pos.z),time:0,life:kind==='small'?1.4:.85,offset:(Math.random()-.5)*20});}
 return {groundPing,ringEffect,slash,steelImpact,particles,telegraph,removeObject,cancelAttack,floatText};
}
