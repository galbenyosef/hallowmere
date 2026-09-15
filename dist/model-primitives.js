import * as T from './vendor/three.core.js';

// The low-poly builders every character kit re-declares. Each parameter exists so
// an adoption reproduces its kit's vertices, quaternions and material values
// unchanged — nothing here picks a "canonical" segment count or taper.
// kit                      | call there                          | call here
// ranger-character-model   | material(c,metal)                   | material(c,{metalness,roughness:metalness?.5:.88})
//                          | ball/box/mesh/group                 | ball(…,{widthSegments:12}) · box unit+scale · mesh · group
//                          | rod(p,m,a,b,r=.02,r2)               | rod(p,m,a,b,r,r2,6)
//                          | path(p,m,points,r=.01)              | path(…,r,{taper:'falloff',falloff:.7,sides:6})
//                          | plate(p,m,points,depth=.012)        | plate(…,depth)            (bevel off)
// nightblade-character-model| ball(1,10,7) · rod sides 6          | ball(…,{widthSegments:10,heightSegments:7}) · rod(…,6)
//                          | path(p,m,points,r=.008)             | path(…,r,{taper:'constant',sides:6})
// oathkeeper-character-model| material(c,metal,glow)             | material(c,{metalness,roughness:metalness?.38:.78,emissive:glow?c:0,emissiveIntensity:glow})
//                          | ball(1,12,8) · rod sides 8          | ball(…) · rod(…)
//                          | path(p,m,points,r=.015)             | path(…,r,{taper:'constant'})
// reaver-character-model   | mat(c,metal,rough=.88) · ball(1,10,7)| material(c,{metalness,roughness}) · ball(…,{widthSegments:10,heightSegments:7})
//                          | box(sized geometry)                 | box(…,{sized:true})
//                          | plate(p,m,pts,depth,x,y,z,bevel=.012)| plate(…,depth,{x,y,z,bevel,bevelEnabled:true})  — reaver bevels even at 0
// geralt-character-model   | mesh/group take [x,y,z] arrays      | mesh(p,g,m,...position,...scale) · group(p,name,...position)
//                          | ellipsoid(…,segments=12)            | ball(…,{widthSegments:segments})
//                          | box/rod/path/plate                  | box(…,{sized:true}) · rod · path(…,{tip}) · plate(…,{x,y,z,bevel})
// predator-model           | as geralt, plus isLight-aware kit   | identical mapping; ball segments default 12
// hunt-king-model          | as predator; shapeFrom exported     | shapeFrom re-exported here
// npc-models               | mat(c,metal,rough=.82) no flatShading| material(c,{metalness,roughness,flatShading:false})
//                          | orb(1,16,10) · rod sides 10         | ball(…,{widthSegments:16,heightSegments:10}) · rod(…,10)
//                          | plate bevel .004 fixed              | plate(…,depth,{x,y,z,bevel:.004})
//                          | box() is a plate, not a BoxGeometry | call plate directly; box() here cannot reproduce it
// character-study-models   | material(c,metal,emissive)          | material(c,{metalness,roughness:metalness?.48:.91,emissive:emissive?c:0,emissiveIntensity:emissive?1.15:0})
//                          | ball(1,10,7) · rod r=.04 sides 8    | ball(…,{widthSegments:10,heightSegments:7}) · rod
//                          | group(p,x,y,z) — unnamed            | group(p,'',x,y,z)
//                          | branch(p,m,points,r=.05)            | path(…,r,{taper:'falloff'})
// scripts/generate-assets  | orb(1,12,8) · mesh without shadows  | ball(…,{castShadow:false,receiveShadow:false})
//                          | boneBetween(…,n=9) · spike(…,r=.1)  | rod(…,9) · path(…,r,{taper:'falloff',divisor:points.length-1,sides:9})
// Second-tier parts (cloak, ribbon, edgedPlate, wrap, heads, faces, hands) stay in
// their kits; the adoption tasks decide those.
const UP=new T.Vector3(0,1,0);
export function group(parent,name='',x=0,y=0,z=0){const node=new T.Group();node.name=name;node.position.set(x,y,z);parent.add(node);return node;}
export function mesh(parent,geometry,material,x=0,y=0,z=0,sx=1,sy=1,sz=1,{castShadow=true,receiveShadow=true}={}){
 const node=new T.Mesh(geometry,material);node.position.set(x,y,z);node.scale.set(sx,sy,sz);node.castShadow=castShadow;node.receiveShadow=receiveShadow;parent.add(node);return node;
}
export const ball=(parent,material,x,y,z,sx,sy=sx,sz=sx,{widthSegments=12,heightSegments=8,...rest}={})=>mesh(parent,new T.SphereGeometry(1,widthSegments,heightSegments),material,x,y,z,sx,sy,sz,rest);
// sized:false is a unit cube scaled to sx,sy,sz; sized:true bakes the size into the
// geometry. The vertex positions differ once a matrix is baked, so kits must keep theirs.
export const box=(parent,material,x,y,z,sx,sy,sz,{sized=false,...rest}={})=>sized?mesh(parent,new T.BoxGeometry(sx,sy,sz),material,x,y,z,1,1,1,rest):mesh(parent,new T.BoxGeometry(1,1,1),material,x,y,z,sx,sy,sz,rest);
export function rod(parent,material,a,b,radius,tip=radius,sides=8,options={}){
 const start=new T.Vector3(...a),end=new T.Vector3(...b),delta=end.clone().sub(start);
 const node=mesh(parent,new T.CylinderGeometry(tip,radius,delta.length(),sides),material,0,0,0,1,1,1,options);
 node.position.copy(start.add(end).multiplyScalar(.5));node.quaternion.setFromUnitVectors(UP,delta.normalize());return node;
}
// taper 'lerp' walks radius→tip across the chain (geralt, predator, hunt-king, npc);
// 'constant' keeps radius (nightblade, oathkeeper); 'falloff' is the r*(1-i/divisor*falloff)
// thinning of ranger (falloff .7), character-study branch and generate-assets spike.
export function path(parent,material,points,radius,{tip=radius,taper='lerp',falloff=1,divisor=points.length,sides=8,...rest}={}){
 const last=points.length-1,at=i=>taper==='constant'?radius:taper==='falloff'?radius*(1-i/divisor*falloff):T.MathUtils.lerp(radius,tip,i/last);
 for(let i=1;i<=last;i++)rod(parent,material,points[i-1],points[i],at(i-1),at(i),sides,rest);
}
export const shapeFrom=points=>{const shape=new T.Shape();points.forEach(([x,y],i)=>i?shape.lineTo(x,y):shape.moveTo(x,y));shape.closePath();return shape;};
// bevelEnabled defaults to bevel>0 (geralt, predator, hunt-king) but reaver extrudes
// with bevelEnabled:true even when bevel is 0, which is a different mesh: pass it.
export function plate(parent,material,points,depth,{x=0,y=0,z=0,bevel=0,bevelEnabled=bevel>0,bevelSegments=1,curveSegments=1,...rest}={}){
 const options=bevelEnabled?{depth,bevelEnabled:true,bevelThickness:bevel,bevelSize:bevel,bevelSegments,curveSegments}:{depth,bevelEnabled:false};
 return mesh(parent,new T.ExtrudeGeometry(shapeFrom(points),options),material,x,y,z,1,1,1,rest);
}
// emissive is omitted entirely unless given: the kits that never set it leave
// emissiveIntensity at 1, while the study kit sets 0 alongside a black emissive.
export const material=(color,{metalness=0,roughness=1,flatShading=true,emissive,emissiveIntensity=1}={})=>new T.MeshStandardMaterial(emissive===undefined?{color,metalness,roughness,flatShading}:{color,metalness,roughness,flatShading,emissive,emissiveIntensity});
