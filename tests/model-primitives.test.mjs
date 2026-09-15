import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from '../dist/vendor/three.core.js';
import * as P from '../dist/model-primitives.js';

// Reference kits: the primitive definitions copied verbatim out of each model so
// the shared builders can be proved against them. predator-model.js imports the
// bare 'three' specifier, which the page import map resolves to vendor/three.module.js;
// that module re-exports these same geometry classes from vendor/three.core.js.
function rangerReference(){
 const up=new T.Vector3(0,1,0);
 const material=(color,metalness=0)=>new T.MeshStandardMaterial({color,metalness,roughness:metalness?.5:.88,flatShading:true});
 function group(parent,name,x=0,y=0,z=0){const g=new T.Group();g.name=name;g.position.set(x,y,z);parent.add(g);return g;}
 function mesh(parent,geometry,mat,x=0,y=0,z=0,sx=1,sy=1,sz=1){const o=new T.Mesh(geometry,mat);o.position.set(x,y,z);o.scale.set(sx,sy,sz);o.castShadow=o.receiveShadow=true;parent.add(o);return o;}
 const ball=(p,m,x,y,z,sx,sy=sx,sz=sx)=>mesh(p,new T.SphereGeometry(1,12,8),m,x,y,z,sx,sy,sz);
 const box=(p,m,x,y,z,sx,sy,sz)=>mesh(p,new T.BoxGeometry(1,1,1),m,x,y,z,sx,sy,sz);
 function rod(p,m,a,b,r=.02,r2=r){const av=new T.Vector3(...a),bv=new T.Vector3(...b),d=bv.clone().sub(av),o=mesh(p,new T.CylinderGeometry(r2,r,d.length(),6),m);o.position.copy(av.add(bv).multiplyScalar(.5));o.quaternion.setFromUnitVectors(up,d.normalize());return o;}
 function path(p,m,points,r=.01){for(let i=0;i<points.length-1;i++)rod(p,m,points[i],points[i+1],r*(1-i/points.length*.7),r*(1-(i+1)/points.length*.7));}
 function plate(p,m,points,depth=.012){const shape=new T.Shape();points.forEach(([x,y],i)=>i?shape.lineTo(x,y):shape.moveTo(x,y));shape.closePath();return mesh(p,new T.ExtrudeGeometry(shape,{depth,bevelEnabled:false}),m);}
 return {material,group,mesh,ball,box,rod,path,plate};
}
function predatorReference(){
 const UP = new T.Vector3(0, 1, 0);
 function add(p, geometry, material, xyz = [0, 0, 0], scale = [1, 1, 1]) {
   const object = new T.Mesh(geometry, material);
   object.position.set(...xyz); object.scale.set(...scale);
   object.castShadow = true; object.receiveShadow = true; p.add(object); return object;
 }
 function group(p, name, xyz = [0, 0, 0]) {
   const object = new T.Group(); object.name = name; object.position.set(...xyz); p.add(object); return object;
 }
 function box(p, m, x, y, z, sx, sy, sz) {return add(p, new T.BoxGeometry(sx, sy, sz), m, [x, y, z]);}
 function ball(p, m, x, y, z, sx, sy = sx, sz = sx, segments = 12) {return add(p, new T.SphereGeometry(1, segments, 8), m, [x, y, z], [sx, sy, sz]);}
 function rod(p, m, a, b, radius, tip = radius, sides = 8) {
   const start = new T.Vector3(...a), end = new T.Vector3(...b), direction = end.clone().sub(start);
   const object = add(p, new T.CylinderGeometry(tip, radius, direction.length(), sides), m);
   object.position.copy(start.add(end).multiplyScalar(.5)); object.quaternion.setFromUnitVectors(UP, direction.normalize()); return object;
 }
 function path(p, m, points, radius, tip = radius) {
   for (let i = 1; i < points.length; i++) rod(p, m, points[i - 1], points[i], T.MathUtils.lerp(radius, tip, (i - 1) / (points.length - 1)), T.MathUtils.lerp(radius, tip, i / (points.length - 1)));
 }
 function shapeFrom(points) {
   const shape = new T.Shape(); points.forEach(([x, y], i) => i ? shape.lineTo(x, y) : shape.moveTo(x, y)); shape.closePath(); return shape;
 }
 function plate(p, m, points, depth = .025, xyz = [0, 0, 0], bevel = .006) {
   return add(p, new T.ExtrudeGeometry(shapeFrom(points), {depth, bevelEnabled: bevel > 0, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 1, curveSegments: 1}), m, xyz);
 }
 const mat=(color,metalness=0,roughness=.86)=>new T.MeshStandardMaterial({color,metalness,roughness,flatShading:true});
 return {mat,add,group,box,ball,rod,path,shapeFrom,plate};
}
function studyReference(){
 const up=new T.Vector3(0,1,0);
 const material=(color,metalness=0,emissive=false)=>new T.MeshStandardMaterial({color,metalness,roughness:metalness?.48:.91,flatShading:true,emissive:emissive?color:0,emissiveIntensity:emissive?1.15:0});
 const add=(parent,geometry,mat,x=0,y=0,z=0,sx=1,sy=1,sz=1)=>{const m=new T.Mesh(geometry,mat);m.position.set(x,y,z);m.scale.set(sx,sy,sz);m.castShadow=true;m.receiveShadow=true;parent.add(m);return m;};
 const ball=(p,m,x,y,z,sx,sy=sx,sz=sx)=>add(p,new T.SphereGeometry(1,10,7),m,x,y,z,sx,sy,sz);
 const box=(p,m,x,y,z,sx,sy,sz)=>add(p,new T.BoxGeometry(1,1,1),m,x,y,z,sx,sy,sz);
 function group(p,x=0,y=0,z=0){const g=new T.Group();g.position.set(x,y,z);p.add(g);return g;}
 function rod(p,m,a,b,r=.04,r2=r){const av=new T.Vector3(...a),bv=new T.Vector3(...b),d=bv.clone().sub(av);const mesh=add(p,new T.CylinderGeometry(r2,r,d.length(),8),m);mesh.position.copy(av.add(bv).multiplyScalar(.5));mesh.quaternion.setFromUnitVectors(up,d.normalize());return mesh;}
 function branch(p,m,points,r=.05){for(let i=0;i<points.length-1;i++)rod(p,m,points[i],points[i+1],r*(1-i/points.length),r*(1-(i+1)/points.length));}
 return {material,add,ball,box,group,rod,branch};
}

// The adoption each later task will make: the kit's own call shape, forwarded to
// dist/model-primitives.js with the parameters that reproduce it.
const rangerAdoption={
 material:(color,metalness=0)=>P.material(color,{metalness,roughness:metalness?.5:.88}),
 group:(parent,name,x=0,y=0,z=0)=>P.group(parent,name,x,y,z),
 mesh:(parent,geometry,mat,x=0,y=0,z=0,sx=1,sy=1,sz=1)=>P.mesh(parent,geometry,mat,x,y,z,sx,sy,sz),
 ball:(p,m,x,y,z,sx,sy=sx,sz=sx)=>P.ball(p,m,x,y,z,sx,sy,sz),
 box:(p,m,x,y,z,sx,sy,sz)=>P.box(p,m,x,y,z,sx,sy,sz),
 rod:(p,m,a,b,r=.02,r2=r)=>P.rod(p,m,a,b,r,r2,6),
 path:(p,m,points,r=.01)=>P.path(p,m,points,r,{taper:'falloff',falloff:.7,sides:6}),
 plate:(p,m,points,depth=.012)=>P.plate(p,m,points,depth),
};
const predatorAdoption={
 mat:(color,metalness=0,roughness=.86)=>P.material(color,{metalness,roughness}),
 add:(p,geometry,material,xyz=[0,0,0],scale=[1,1,1])=>P.mesh(p,geometry,material,...xyz,...scale),
 group:(p,name,xyz=[0,0,0])=>P.group(p,name,...xyz),
 box:(p,m,x,y,z,sx,sy,sz)=>P.box(p,m,x,y,z,sx,sy,sz,{sized:true}),
 ball:(p,m,x,y,z,sx,sy=sx,sz=sx,segments=12)=>P.ball(p,m,x,y,z,sx,sy,sz,{widthSegments:segments}),
 rod:(p,m,a,b,radius,tip=radius,sides=8)=>P.rod(p,m,a,b,radius,tip,sides),
 path:(p,m,points,radius,tip=radius)=>P.path(p,m,points,radius,{tip}),
 shapeFrom:P.shapeFrom,
 plate:(p,m,points,depth=.025,xyz=[0,0,0],bevel=.006)=>P.plate(p,m,points,depth,{x:xyz[0],y:xyz[1],z:xyz[2],bevel}),
};
const studyAdoption={
 material:(color,metalness=0,emissive=false)=>P.material(color,{metalness,roughness:metalness?.48:.91,emissive:emissive?color:0,emissiveIntensity:emissive?1.15:0}),
 add:(parent,geometry,mat,x=0,y=0,z=0,sx=1,sy=1,sz=1)=>P.mesh(parent,geometry,mat,x,y,z,sx,sy,sz),
 ball:(p,m,x,y,z,sx,sy=sx,sz=sx)=>P.ball(p,m,x,y,z,sx,sy,sz,{widthSegments:10,heightSegments:7}),
 box:(p,m,x,y,z,sx,sy,sz)=>P.box(p,m,x,y,z,sx,sy,sz),
 group:(p,x=0,y=0,z=0)=>P.group(p,'',x,y,z),
 rod:(p,m,a,b,r=.04,r2=r)=>P.rod(p,m,a,b,r,r2,8),
 branch:(p,m,points,r=.05)=>P.path(p,m,points,r,{taper:'falloff'}),
};

// Specimens exercise every primitive with defaults and with overrides, in the
// shapes the kits actually use (bow limbs, blade plates, bone chains).
const limb=[[0,0,0],[.11,.3,.05],[-.04,.62,.02],[.03,.94,-.01],[.02,1.21,.08]];
const blade=[[-.034,-.045],[.032,-.045],[.059,-.30],[.022,-.53],[-.025,-.59],[-.018,-.35]];
function rangerSpecimen(k){
 const root=new T.Group();root.name='ranger';
 const wood=k.material(0x6b5136),steel=k.material(0x9aa6ad,.72),cloth=k.material(0x3f4a41,0);
 const body=k.group(root,'ranger-body',0,1.2,-.04),arm=k.group(body,'ranger-arm',.21,.34,0);
 k.ball(body,wood,0,.1,0,.18,.22,.14);k.ball(body,steel,.2,.3,0,.09);k.ball(arm,cloth,0,0,0,.05,.09,.05);
 k.box(body,wood,0,-.2,.02,.3,.12,.2);k.box(arm,steel,.01,-.02,0,.04,.15,.04);
 k.rod(body,steel,[0,0,0],[.2,.4,.1]);k.rod(arm,wood,[-.1,0,0],[-.1,.5,.02],.04,.012);
 k.path(body,steel,limb);k.path(arm,wood,limb.slice(0,3),.03);
 k.plate(body,steel,blade);k.plate(arm,cloth,[[-.1,-.1],[.1,-.1],[.1,.1],[-.1,.1]],.05);
 k.mesh(body,new T.TorusGeometry(.2,.02,5,24),steel,0,.5,0,1,1,.6);
 return root;
}
function predatorSpecimen(k){
 const root=new T.Group();root.name='predator';
 const skin=k.mat(0x8f8160),metal=k.mat(0xb7c0c4,.8,.31),plasma=k.mat(0x68f4de,0,.2);
 const torso=k.group(root,'predator-torso',[0,1.24,0]),shoulder=k.group(torso,'predator-shoulder',[.32,.28,0]);
 k.ball(torso,skin,0,.1,0,.2,.26,.16);k.ball(torso,metal,0,.42,.06,.12,.14,.12,7);k.ball(shoulder,skin,0,0,0,.09);
 k.box(torso,metal,0,-.24,.03,.34,.12,.22);k.box(shoulder,plasma,0,.04,0,.06,.06,.06);
 k.rod(torso,metal,[0,0,0],[.24,.42,.08],.03);k.rod(shoulder,skin,[0,0,0],[.06,-.4,.02],.05,.028,6);
 k.path(torso,metal,limb,.04,.012);k.path(shoulder,plasma,limb.slice(1),.02);
 k.plate(torso,metal,blade);k.plate(shoulder,skin,blade,.03,[.02,-.01,.04],.002);
 k.add(torso,new T.ExtrudeGeometry(k.shapeFrom(blade),{depth:.02,bevelEnabled:false}),metal,[0,.6,0],[1,1,1]);
 return root;
}
function studySpecimen(k){
 const root=new T.Group();root.name='study';
 const stone=k.material(0x6d7470),gold=k.material(0xa69a63,.66),glow=k.material(0x9dced0,0,true);
 const scene=k.group(root,0,.02,0),spire=k.group(scene,.4,0,-.2);
 k.ball(scene,stone,0,.3,0,.2,.24,.18);k.ball(spire,glow,0,.5,0,.07);
 k.box(scene,gold,0,.05,0,.5,.08,.5);k.box(spire,stone,0,0,0,.14,.9,.14);
 k.rod(scene,stone,[0,0,0],[.3,.5,.1]);k.rod(spire,gold,[0,.9,0],[.1,1.3,.05],.05,.02);
 k.branch(scene,stone,limb);k.branch(spire,gold,limb.slice(0,4),.03);
 k.ball(spire,stone,0,1.5,0,.05,.12,.05);
 k.add(scene,new T.OctahedronGeometry(1),glow,0,1.1,0,.15,.285,.15);
 return root;
}

const strip=value=>{
 if(Array.isArray(value))return value.map(strip);
 if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).filter(([key])=>key!=='uuid').map(([key,inner])=>[key,strip(inner)]));
 return value;
};
const flatten=root=>{const nodes=[];root.traverse(node=>nodes.push(node));return nodes;};

function assertIdentical(expected,actual,label){
 const left=flatten(expected),right=flatten(actual);
 assert.equal(right.length,left.length,`${label}: node count`);
 assert.ok(left.length>=18,`${label}: specimen is too small to prove anything`);
 let meshes=0;
 for(const [index,node] of left.entries()){
  const twin=right[index],where=`${label}[${index}] ${node.name||node.type}`;
  assert.equal(twin.name,node.name,`${where}: name`);
  assert.equal(twin.type,node.type,`${where}: type`);
  assert.equal(twin.children.length,node.children.length,`${where}: child count`);
  assert.deepEqual(twin.position.toArray(),node.position.toArray(),`${where}: position`);
  assert.deepEqual(twin.quaternion.toArray(),node.quaternion.toArray(),`${where}: quaternion`);
  assert.deepEqual(twin.scale.toArray(),node.scale.toArray(),`${where}: scale`);
  assert.equal(twin.castShadow,node.castShadow,`${where}: castShadow`);
  assert.equal(twin.receiveShadow,node.receiveShadow,`${where}: receiveShadow`);
  if(!node.isMesh)continue;
  meshes++;
  assert.equal(twin.isMesh,true,`${where}: isMesh`);
  assert.deepEqual(strip(twin.geometry.parameters),strip(node.geometry.parameters),`${where}: geometry parameters`);
  assert.equal(twin.geometry.type,node.geometry.type,`${where}: geometry type`);
  for(const attribute of ['position','normal','uv']){
   assert.equal(!!twin.geometry.attributes[attribute],!!node.geometry.attributes[attribute],`${where}: has ${attribute}`);
   if(node.geometry.attributes[attribute])assert.deepEqual(twin.geometry.attributes[attribute].array,node.geometry.attributes[attribute].array,`${where}: ${attribute} attribute`);
  }
  assert.equal(!!twin.geometry.index,!!node.geometry.index,`${where}: has index`);
  if(node.geometry.index)assert.deepEqual(twin.geometry.index.array,node.geometry.index.array,`${where}: index`);
  assert.equal(twin.material.color.getHex(),node.material.color.getHex(),`${where}: color`);
  assert.equal(twin.material.metalness,node.material.metalness,`${where}: metalness`);
  assert.equal(twin.material.roughness,node.material.roughness,`${where}: roughness`);
  assert.equal(twin.material.flatShading,node.material.flatShading,`${where}: flatShading`);
  assert.equal(twin.material.emissive.getHex(),node.material.emissive.getHex(),`${where}: emissive`);
  assert.equal(twin.material.emissiveIntensity,node.material.emissiveIntensity,`${where}: emissiveIntensity`);
  assert.equal(twin.material.side,node.material.side,`${where}: side`);
 }
 assert.ok(meshes>=15,`${label}: expected the specimen to build meshes, got ${meshes}`);
 return {nodes:left.length,meshes};
}

test('the ranger kit rebuilds unchanged on the shared primitives',()=>{
 const counts=assertIdentical(rangerSpecimen(rangerReference()),rangerSpecimen(rangerAdoption),'ranger');
 assert.ok(counts.nodes>0);
 // Unit sphere and unit cube plus scale: the ranger bakes size into the matrix.
 const sphere=flatten(rangerSpecimen(rangerAdoption)).find(node=>node.geometry?.type==='SphereGeometry'&&node.scale.x===.18);
 assert.deepEqual([sphere.geometry.parameters.radius,sphere.geometry.parameters.widthSegments,sphere.geometry.parameters.heightSegments],[1,12,8]);
 assert.deepEqual(sphere.scale.toArray(),[.18,.22,.14]);
});

test('the predator kit rebuilds unchanged on the shared primitives',()=>{
 assertIdentical(predatorSpecimen(predatorReference()),predatorSpecimen(predatorAdoption),'predator');
 // Sized geometry, not a scaled unit cube: the two are different vertex sets.
 const cube=flatten(predatorSpecimen(predatorAdoption)).find(node=>node.geometry?.parameters.width===.34);
 assert.deepEqual([cube.geometry.parameters.width,cube.geometry.parameters.height,cube.geometry.parameters.depth],[.34,.12,.22]);
 assert.deepEqual(cube.scale.toArray(),[1,1,1]);
});

test('the character study kit rebuilds unchanged on the shared primitives',()=>{
 assertIdentical(studySpecimen(studyReference()),studySpecimen(studyAdoption),'study');
 const emissive=flatten(studySpecimen(studyAdoption)).find(node=>node.material?.emissiveIntensity===1.15);
 assert.equal(emissive.material.emissive.getHex(),0x9dced0);
 const plain=flatten(studySpecimen(studyAdoption)).find(node=>node.material?.emissive.getHex()===0);
 assert.equal(plain.material.emissiveIntensity,0);
});

test('sized and unit box geometry stay distinguishable, and shadows and names are options',()=>{
 const parent=new T.Group();
 const unit=P.box(parent,null,1,2,3,.4,.5,.6),sized=P.box(parent,null,1,2,3,.4,.5,.6,{sized:true});
 assert.notDeepEqual(unit.geometry.attributes.position.array,sized.geometry.attributes.position.array);
 assert.deepEqual(unit.scale.toArray(),[.4,.5,.6]);
 assert.deepEqual(sized.scale.toArray(),[1,1,1]);
 const quiet=P.mesh(parent,new T.BoxGeometry(1,1,1),null,0,0,0,1,1,1,{castShadow:false,receiveShadow:false});
 assert.equal(quiet.castShadow,false);
 assert.equal(quiet.receiveShadow,false);
 assert.equal(P.mesh(parent,new T.BoxGeometry(1,1,1),null).castShadow,true);
 assert.equal(P.group(parent).name,'');
 assert.equal(P.group(parent,'named',1,2,3).name,'named');
 assert.deepEqual(P.group(parent,'named',1,2,3).position.toArray(),[1,2,3]);
});

test('every path taper and every plate bevel form is reachable',()=>{
 const points=[[0,0,0],[.1,.4,0],[-.05,.9,.02],[0,1.4,0]];
 const radii=kit=>{const parent=new T.Group();kit(parent);return parent.children.map(node=>[node.geometry.parameters.radiusTop,node.geometry.parameters.radiusBottom,node.geometry.parameters.radialSegments]);};
 // lerp (geralt, predator, hunt-king, npc-models)
 assert.deepEqual(radii(parent=>P.path(parent,null,points,.1,{tip:.02})),
  radii(parent=>{for(let i=1;i<points.length;i++)P.rod(parent,null,points[i-1],points[i],T.MathUtils.lerp(.1,.02,(i-1)/3),T.MathUtils.lerp(.1,.02,i/3),8);}));
 // constant (nightblade sides 6, oathkeeper sides 8)
 assert.deepEqual(radii(parent=>P.path(parent,null,points,.008,{taper:'constant',sides:6})),[[.008,.008,6],[.008,.008,6],[.008,.008,6]]);
 // falloff (ranger .7 over points.length, study branch, generate-assets over points.length-1)
 assert.deepEqual(radii(parent=>P.path(parent,null,points,.01,{taper:'falloff',falloff:.7,sides:6})),
  [[.01*(1-1/4*.7),.01,6],[.01*(1-2/4*.7),.01*(1-1/4*.7),6],[.01*(1-3/4*.7),.01*(1-2/4*.7),6]]);
 assert.deepEqual(radii(parent=>P.path(parent,null,points,.05,{taper:'falloff'})),
  [[.05*(1-1/4),.05,8],[.05*(1-2/4),.05*(1-1/4),8],[.05*(1-3/4),.05*(1-2/4),8]]);
 assert.deepEqual(radii(parent=>P.path(parent,null,points,.1,{taper:'falloff',divisor:points.length-1,sides:9})),
  [[.1*(1-1/3),.1,9],[.1*(1-2/3),.1*(1-1/3),9],[0,.1*(1-2/3),9]]);
 // plate: bevel off, bevel on, and reaver's bevelEnabled:true at bevel 0.
 const parent=new T.Group();
 const flat=P.plate(parent,null,blade,.012),bevelled=P.plate(parent,null,blade,.025,{bevel:.006}),forced=P.plate(parent,null,blade,.025,{bevel:0,bevelEnabled:true});
 assert.deepEqual(flat.geometry.parameters.options,{depth:.012,bevelEnabled:false});
 assert.deepEqual(bevelled.geometry.parameters.options,{depth:.025,bevelEnabled:true,bevelThickness:.006,bevelSize:.006,bevelSegments:1,curveSegments:1});
 assert.deepEqual(forced.geometry.parameters.options,{depth:.025,bevelEnabled:true,bevelThickness:0,bevelSize:0,bevelSegments:1,curveSegments:1});
 assert.notEqual(forced.geometry.attributes.position.array.length,P.plate(parent,null,blade,.025).geometry.attributes.position.array.length);
 assert.deepEqual(P.plate(parent,null,blade,.018,{x:.1,y:.2,z:.3,bevel:.004}).position.toArray(),[.1,.2,.3]);
});
