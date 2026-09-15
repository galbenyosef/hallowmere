import * as T from 'three';
import {lcg} from './random.js';

// Instanced scenery keeps the larger footprint from multiplying draw calls.
export function createOutlandScenery(scene,map){
 const group=new T.Group();group.name='surrounding-outlands';scene.add(group);
 const geometries={box:new T.BoxGeometry(1,1,1),rock:new T.DodecahedronGeometry(1,0),trunk:new T.CylinderGeometry(.45,.62,1,7),crown:new T.ConeGeometry(1,1,7),disc:new T.CylinderGeometry(1,1,.035,32)};
 const colors={path:0x536053,earth:0x424c3e,stone:0x697365,dark:0x333e38,bark:0x3e372b,leaf:0x425542,grass:0x647355,water:0x304a4a,plank:0x766c50,iron:0x686c67,rut:0x302e29};
 if(map.id==='drowned-wood')Object.assign(colors,{earth:0x4e5140,path:0x657266,plank:0x807454});
 if(map.id==='blackvein-quarry')Object.assign(colors,{earth:0x48423a,leaf:0x5b5b46,path:0x655f52});
 if(map.id==='crownfall-keep')Object.assign(colors,{earth:0x454048,leaf:0x504950,path:0x635e60});
 const materials=Object.fromEntries(Object.entries(colors).map(([id,color])=>[id,new T.MeshStandardMaterial({color,roughness:id==='water'?.3:.96})]));
 const batches=new Map(),dummy=new T.Object3D();const rand=lcg(1847);
 const put=(shape,mat,x,y,z,w,h,d,rotation=0)=>{const key=`${shape}:${mat}`;if(!batches.has(key))batches.set(key,[]);batches.get(key).push({x,y,z,w,h,d,rotation});};
 for(const route of map.routes||[])for(let i=1;i<route.points.length;i++){
  const a=route.points[i-1],b=route.points[i],length=Math.hypot(b.x-a.x,b.z-a.z),angle=Math.atan2(b.x-a.x,b.z-a.z),style=route.style||'cobble',width=route.width;
  const place=(shape,mat,step,offset,w,h,d,y=.04,rotation=angle)=>put(shape,mat,a.x+Math.sin(angle)*step+Math.cos(angle)*offset,y,a.z+Math.cos(angle)*step-Math.sin(angle)*offset,w,h,d,rotation);
  if(style==='boardwalk'){
   for(const side of [-1,1])place('box','rut',length/2,side*width*.32,.16,.06,length,.03);
   for(let step=0;step<length;step+=.53)place('box','plank',step,(rand()-.5)*.08,width*(.95+rand()*.1),.09,.44,.075,angle+(rand()-.5)*.025);
  }else if(style==='trail'||style==='haul'||style==='rail'){
   for(let step=0;step<length;step+=1.2){
    const spread=width*(.47+rand()*.05);place('disc','earth',step,0,spread,1,spread,.012);
    for(let n=0;n<(style==='trail'?1:4);n++)place('rock','path',step,(rand()-.5)*width,.13+rand()*.15,.035,.12+rand()*.12,.045,rand()*6);
   }
   if(style==='haul')for(const side of [-1,1])place('box','rut',length/2,side*width*.24,.15,.018,length,.04);
   if(style==='rail'){
    for(let step=0;step<length;step+=1.1)place('box','plank',step,0,2.15,.07,.22,.06);
    for(const side of [-1,1])place('box','iron',length/2,side*.8,.09,.1,length,.14);
   }
  }else{
   const paved=style==='pavers',slabs=style==='slabs',spacing=paved?1.04:slabs?1.3:.8,columns=Math.max(2,Math.floor(width/(slabs?1.3:.8)));
   for(let step=0;step<length;step+=spacing)for(let col=0;col<columns;col++){
    if(rand()<(paved?.10:slabs?.18:.06))continue;
    const offset=(col-(columns-1)/2)*(width/columns)+(rand()-.5)*.12;
    place(paved||slabs?'box':'rock','path',step,offset,paved?width/columns-.09:slabs?width/columns-.15:.32+rand()*.12,paved?.07:slabs?.06:.055,paved?.94:slabs?1.08:.3+rand()*.09,.045,paved||slabs?angle+(rand()-.5)*.07:rand()*6);
   }
   if(paved)for(let step=0;step<length;step+=1.6)if(rand()>.16)for(const side of [-1,1])place('box','stone',step,side*width/2,.18,.10,1.35,.055);
  }
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
 for(const [key,items]of batches){const [shape,mat]=key.split(':'),inst=new T.InstancedMesh(geometries[shape],materials[mat],items.length);items.forEach((p,i)=>{dummy.position.set(p.x,p.y,p.z);dummy.scale.set(p.w,p.h,p.d);dummy.rotation.set(0,p.rotation,0);dummy.updateMatrix();inst.setMatrixAt(i,dummy.matrix);});inst.castShadow=!['path','earth','water','plank','iron','rut'].includes(mat);inst.receiveShadow=true;group.add(inst);}
 return{group,dispose(){group.removeFromParent();for(const g of Object.values(geometries))g.dispose();for(const m of Object.values(materials))m.dispose();}};
}
