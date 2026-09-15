import * as T from './vendor/three.core.js';

// Measure forgiveness in CSS pixels so aiming feels the same at every zoom.
const SNAP_PADDING=20,RELEASE_PADDING=8,SWITCH_BIAS=6;
export function createMouseTargeting({scene,camera,canvas,enemies,windowTarget=globalThis.window}){
 const projected=new T.Vector3(),raycaster=new T.Raycaster(),tint=new T.Color('#ff7952');
 const marker=new T.Group();marker.visible=false;scene.add(marker);
 const ring=new T.Mesh(new T.RingGeometry(.92,1,64),new T.MeshBasicMaterial({color:'#ffae79',transparent:true,opacity:.95,depthWrite:false,toneMapped:false}));
 ring.rotation.x=-Math.PI/2;marker.add(ring);
 for(let i=0;i<4;i++){
  const bracket=new T.Mesh(new T.RingGeometry(1.08,1.15,12,1,i*Math.PI/2+.2,.48),ring.material);
  bracket.rotation.x=-Math.PI/2;marker.add(bracket);
 }
 let selected=null,materials=[];
 let cachedRect=null;
 function invalidateRect(){cachedRect=null;}
 function getRect(){return windowTarget?cachedRect||(cachedRect=canvas.getBoundingClientRect()):canvas.getBoundingClientRect();}
 if(windowTarget){
  windowTarget.addEventListener('resize',invalidateRect);
  windowTarget.addEventListener('scroll',invalidateRect,true);
  windowTarget.visualViewport?.addEventListener('resize',invalidateRect);
  windowTarget.visualViewport?.addEventListener('scroll',invalidateRect);
  windowTarget.addEventListener('orientationchange',invalidateRect);
 }
 function show(enemy){
  if(enemy?.dead||!enemy?.model.parent)enemy=null;
  if(enemy!==selected){
   for(const [material,emissive] of materials)material.emissive.copy(emissive);
   selected=enemy;materials=[];
   if(enemy){
    const unique=new Set();enemy.model.traverse(object=>{
     for(const material of Array.isArray(object.material)?object.material:[object.material])if(material?.emissive)unique.add(material);
    });
    for(const material of unique){materials.push([material,material.emissive.clone()]);material.emissive.lerp(tint,.4);}
   }
  }
  marker.visible=!!enemy;
  if(enemy){
   const bounds=enemy.pickBounds,radius=Math.max(.8,Math.max(bounds.max.x-bounds.min.x,bounds.max.z-bounds.min.z)*.55);
   marker.position.set(enemy.model.position.x,.14,enemy.model.position.z);marker.scale.setScalar(radius);
  }
 }
 function pick(pointer,{assist=true}={}){
  const rect=getRect(),px=(pointer.x+1)*rect.width/2,py=(1-pointer.y)*rect.height/2,candidates=[];
  camera.updateMatrixWorld();
  for(const enemy of enemies){
   if(enemy.dead||!enemy.model.visible||!enemy.model.parent)continue;
   enemy.model.updateWorldMatrix(true,false);
   const bounds=enemy.pickBounds;let left=Infinity,right=-Infinity,top=Infinity,bottom=-Infinity,inFront=false;
   for(const x of [bounds.min.x,bounds.max.x])for(const y of [bounds.min.y,bounds.max.y])for(const z of [bounds.min.z,bounds.max.z]){
    projected.set(x,y,z).applyMatrix4(enemy.model.matrixWorld).project(camera);
    if(projected.z>=-1&&projected.z<=1)inFront=true;
    const sx=(projected.x+1)*rect.width/2,sy=(1-projected.y)*rect.height/2;
    left=Math.min(left,sx);right=Math.max(right,sx);top=Math.min(top,sy);bottom=Math.max(bottom,sy);
   }
   if(!inFront||right<0||left>rect.width||bottom<0||top>rect.height)continue;
   const edgeDistance=Math.hypot(Math.max(left-px,0,px-right),Math.max(top-py,0,py-bottom));
   const sticky=enemy===selected,padding=assist?SNAP_PADDING+(sticky?RELEASE_PADDING:0):0;
   if(edgeDistance>padding)continue;
   const centerDistance=Math.hypot(px-(left+right)/2,py-(top+bottom)/2);
   candidates.push({enemy,score:edgeDistance+centerDistance*.15-(sticky?SWITCH_BIAS:0)});
  }
  // Direct hits always win; the expanded area only catches near misses.
  raycaster.setFromCamera(pointer,camera);
  const hits=raycaster.intersectObjects(candidates.map(c=>c.enemy.model),true);
  if(hits.length){let object=hits[0].object;while(object&&object.parent!==scene)object=object.parent;return candidates.find(c=>c.enemy.model===object)?.enemy||null;}
  return assist?candidates.sort((a,b)=>a.score-b.score)[0]?.enemy||null:null;
 }
 return {pick,show,invalidateRect,get selected(){return selected;}};
}
