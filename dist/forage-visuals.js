import * as T from './vendor/three.core.js';
import {foodFor} from './foraging.js';

// Small ground plants with distinct silhouettes; no loot beams or new textures.
export function createForageVisual(itemId,{reducedMotion=false}={}){
 const food=foodFor(itemId);if(!food)throw Error('Unknown forage visual');
 const model=new T.Group(),plant=new T.Group();model.add(plant);
 const stem=new T.MeshStandardMaterial({color:0x658174,roughness:1});
 const accent=new T.MeshStandardMaterial({color:food.color,roughness:.8,emissive:food.color,emissiveIntensity:.12});
 const add=(geometry,material,x,y,z,sx=1,sy=1,sz=1)=>{const mesh=new T.Mesh(geometry,material);mesh.position.set(x,y,z);mesh.scale.set(sx,sy,sz);plant.add(mesh);return mesh;};
 if(itemId==='crimson-mushroom'){
  for(const [x,z,s] of [[0,0,1],[-.28,.18,.7],[.27,.1,.6]]){
   add(new T.CylinderGeometry(.035*s,.055*s,.28*s,6),stem,x,.17*s,z);
   add(new T.SphereGeometry(.22*s,10,6,0,Math.PI*2,0,Math.PI/2),accent,x,.3*s,z,1,.65,1);
  }
 }else{
  const herb=itemId==='moonleaf-herb';
  add(new T.CylinderGeometry(.025,.045,herb?.6:.4,5),stem,0,herb?.3:.2,0);
  for(let i=0;i<6;i++){
   const a=i*Math.PI*2/6,x=Math.cos(a)*.16,z=Math.sin(a)*.16;
   const leaf=add(new T.SphereGeometry(1,6,4),herb?accent:stem,x,.13+i*.065,z,.075,.21,.035);
   leaf.rotation.set(Math.cos(a)*.55,a,Math.sin(a)*.55);
   if(!herb)add(new T.SphereGeometry(.085,7,5),accent,x*1.3,.29+i%3*.065,z*1.3);
  }
 }
 const ring=new T.Mesh(new T.RingGeometry(.38,.42,24),new T.MeshBasicMaterial({color:food.color,transparent:true,opacity:.18,depthWrite:false}));
 ring.rotation.x=-Math.PI/2;ring.position.y=.055;model.add(ring);
 let disposed=false;
 return {model,update(t,highlight=false){if(disposed)return;ring.material.opacity=highlight?.5:.18;if(!reducedMotion)plant.rotation.z=Math.sin(t*1.5+itemId.length)*.035;},dispose(){if(disposed)return;disposed=true;model.removeFromParent();const resources=new Set();model.traverse(node=>{if(node.geometry)resources.add(node.geometry);if(node.material)resources.add(node.material);});for(const resource of resources)resource.dispose();}};
}
