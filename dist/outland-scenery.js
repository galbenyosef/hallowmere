import * as T from 'three';

// Instanced scenery keeps the larger footprint from multiplying draw calls.
export function createOutlandScenery(scene,map){
 const group=new T.Group();group.name='surrounding-outlands';scene.add(group);
 const geometries={box:new T.BoxGeometry(1,1,1),rock:new T.DodecahedronGeometry(1,0),trunk:new T.CylinderGeometry(.45,.62,1,7),crown:new T.ConeGeometry(1,1,7),disc:new T.CylinderGeometry(1,1,.035,32)};
 const colors={path:0x536053,earth:0x424c3e,stone:0x697365,dark:0x333e38,bark:0x3e372b,leaf:0x425542,grass:0x647355,water:0x304a4a};
 if(map.id==='blackvein-quarry')Object.assign(colors,{earth:0x48423a,leaf:0x5b5b46,path:0x655f52});
 if(map.id==='crownfall-keep')Object.assign(colors,{earth:0x454048,leaf:0x504950,path:0x635e60});
 const materials=Object.fromEntries(Object.entries(colors).map(([id,color])=>[id,new T.MeshStandardMaterial({color,roughness:id==='water'?.3:.96})]));
 const batches=new Map(),dummy=new T.Object3D();let seed=1847;const rand=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
 const put=(shape,mat,x,y,z,w,h,d,rotation=0)=>{const key=`${shape}:${mat}`;if(!batches.has(key))batches.set(key,[]);batches.get(key).push({x,y,z,w,h,d,rotation});};
 for(const route of map.routes||[])for(let i=1;i<route.points.length;i++){
  const a=route.points[i-1],b=route.points[i],length=Math.hypot(b.x-a.x,b.z-a.z),angle=Math.atan2(b.x-a.x,b.z-a.z);
  for(let step=0;step<length;step+=.85){const u=step/length,x=a.x+(b.x-a.x)*u,z=a.z+(b.z-a.z)*u;for(const side of [-1,0,1]){const offset=side*.8+(rand()-.5)*.4;put('rock','path',x+Math.cos(angle)*offset,.04,z-Math.sin(angle)*offset,.32+rand()*.15,.05,.26+rand()*.12,rand()*6);}}
 }
 for(const s of map.sites||[]){
  if(s.kind==='camp'||s.kind==='hamlet'){for(let i=0;i<9;i++){const a=i/9*Math.PI*2;put('rock','stone',s.x-2+Math.cos(a)*.6,.13,s.z+2+Math.sin(a)*.6,.25,.2,.25);}put('box','bark',s.x-2,.15,s.z+2,1.1,.2,.2,.4);}
  if(s.kind==='stones')put('disc','water',s.x-3,.05,s.z-5,2.2,1,1.6);
  if(s.kind==='graves')for(let i=0;i<9;i++){const x=s.x-4+(i%3)*3,z=s.z-9-Math.floor(i/3)*2;put('box','stone',x,.55,z,.65,1.1,.23,(rand()-.5)*.3);put('box','dark',x,.055,z+.6,.9,.1,1.5);}
  if(s.kind==='orchard')for(const dx of [-9,9])for(const dz of [-7,0,7]){put('trunk','bark',s.x+dx,1.2,s.z+dz,.55,2.4,.55);put('rock','leaf',s.x+dx,3,s.z+dz,1.7,1.4,1.7);}
  if(s.kind==='camp'||s.kind==='hamlet')for(const dx of [-5,5]){put('box','bark',s.x+dx,.5,s.z+4,1.4,1,1);put('box','dark',s.x+dx,.53,s.z+4,1.44,.08,1.04);}
 }
 for(const o of map.obstacles.filter(o=>o.sceneryKind)){
  if(o.sceneryKind==='tree'){put('trunk','bark',o.x,1.6,o.z,.7,3.2,.7);put('crown','leaf',o.x,4.2,o.z,1.7,4,1.7);put('crown','leaf',o.x,5.5,o.z,1.1,2.8,1.1);}
  else{const h=o.sceneryKind==='ruin'?2.6:1.5;put('box','dark',o.x,h/2,o.z,o.w,h,o.d);put('rock','stone',o.x,h,o.z,o.w*.55,.45,o.d*.55);if(o.sceneryKind==='ruin')put('box','stone',o.x,h*.5,o.z+.03,o.w+.1,.18,o.d+.1);}
 }
 const b=map.bounds;
 for(let x=b.minX-2;x<=b.maxX+2;x+=4)for(const z of [b.minZ-2,b.maxZ+2])put('rock','dark',x,.9,z,2.5,1.5+rand()*2,2.5);
 for(let z=b.minZ;z<=b.maxZ;z+=4)for(const x of [b.minX-2,b.maxX+2])put('rock','dark',x,1,z,2.5,1.5+rand()*2,2.5);
 for(const [key,items]of batches){const [shape,mat]=key.split(':'),inst=new T.InstancedMesh(geometries[shape],materials[mat],items.length);items.forEach((p,i)=>{dummy.position.set(p.x,p.y,p.z);dummy.scale.set(p.w,p.h,p.d);dummy.rotation.set(0,p.rotation,0);dummy.updateMatrix();inst.setMatrixAt(i,dummy.matrix);});inst.castShadow=!['path','earth','water'].includes(mat);inst.receiveShadow=true;group.add(inst);}
 return{group,dispose(){group.removeFromParent();for(const g of Object.values(geometries))g.dispose();for(const m of Object.values(materials))m.dispose();}};
}
