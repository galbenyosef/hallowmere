import test from 'node:test';
import assert from 'node:assert/strict';
import {registerHooks} from 'node:module';

// Same bare-'three' remap the golden scenery test uses, so this exercises the real
// vendored BufferGeometryUtils.mergeGeometries(), not a stand-in.
const THREE_URL = new URL('../dist/vendor/three.module.js', import.meta.url).href;
const BGUTILS_URL = new URL('../dist/vendor/utils/BufferGeometryUtils.js', import.meta.url).href;
const hook = registerHooks({resolve(specifier, context, nextResolve) {
 if (specifier === 'three') return nextResolve(THREE_URL, context);
 if (specifier === 'three/addons/utils/BufferGeometryUtils.js') return nextResolve(BGUTILS_URL, context);
 return nextResolve(specifier, context);
}});
const T = await import('three');
const {createGeometryBatcher} = await import('../dist/geometry-batch.js');
hook.deregister();

function disposeCount(geometry){
 let count=0;
 geometry.addEventListener('dispose',()=>{count++;});
 return () => count;
}

test('build() adds one mesh per distinct key, in first-insertion order (the fingerprinted child order)',()=>{
 const batcher=createGeometryBatcher();
 const matA=new T.MeshStandardMaterial({color:0x111111}),matB=new T.MeshStandardMaterial({color:0x222222});
 batcher.add(new T.BoxGeometry(1,1,1),matA,null);
 batcher.add(new T.BoxGeometry(1,1,1),matB,null);
 batcher.add(new T.BoxGeometry(1,1,1),matA,null); // second matA add must not create a new batch or move it
 const parent=new T.Group();
 const meshes=batcher.build(parent);
 assert.equal(parent.children.length,2);
 assert.equal(parent.children[0],meshes[0]);
 assert.equal(parent.children[1],meshes[1]);
 assert.equal(meshes[0].material,matA);
 assert.equal(meshes[1].material,matB);
});

test('build() merges geometry vertex counts (indexed inputs stay indexed and offset correctly)',()=>{
 const batcher=createGeometryBatcher();
 const mat=new T.MeshStandardMaterial();
 const single=new T.BoxGeometry(1,1,1);
 const perGeometryCount=single.attributes.position.count;
 batcher.add(single,mat,null);
 batcher.add(single,mat,null);
 const [mesh]=batcher.build(new T.Group());
 assert.equal(mesh.geometry.attributes.position.count,perGeometryCount*2);
 assert.equal(mesh.geometry.index.count,single.index.count*2);
});

test('the transform argument is applied via applyMatrix4 before the geometries are merged',()=>{
 const batcher=createGeometryBatcher();
 const mat=new T.MeshStandardMaterial();
 const shifted=new T.Matrix4().makeTranslation(5,0,0);
 batcher.add(new T.BoxGeometry(1,1,1),mat,shifted);
 batcher.add(new T.BoxGeometry(1,1,1),mat,null);
 const [mesh]=batcher.build(new T.Group());
 mesh.geometry.computeBoundingBox();
 const box=mesh.geometry.boundingBox;
 // One unshifted box spans [-.5,.5]; one shifted +5 spans [4.5,5.5] — merged min/max cover both.
 assert.ok(Math.abs(box.min.x-(-.5))<1e-6,`min.x was ${box.min.x}`);
 assert.ok(Math.abs(box.max.x-5.5)<1e-6,`max.x was ${box.max.x}`);
});

test('add() clones by default, so the source geometry the caller passed in is never mutated',()=>{
 const batcher=createGeometryBatcher();
 const mat=new T.MeshStandardMaterial();
 const source=new T.BoxGeometry(1,1,1);
 const before=source.attributes.position.array.slice();
 batcher.add(source,mat,new T.Matrix4().makeTranslation(9,0,0));
 assert.deepEqual(Array.from(source.attributes.position.array),Array.from(before));
});

test('build() disposes the per-add source geometries by default, and leaves them alone when disposeSources:false',()=>{
 const mat=new T.MeshStandardMaterial();
 // disposeSources defaults to true (environment.js / cave-entrance-scenery.js / treasure-chests.js all dispose their parts after merging).
 {
  const batcher=createGeometryBatcher();
  const g1=batcher.add(new T.BoxGeometry(1,1,1),mat,null);
  const g2=batcher.add(new T.BoxGeometry(1,1,1),mat,null);
  const readG1=disposeCount(g1),readG2=disposeCount(g2);
  batcher.build(new T.Group());
  assert.equal(readG1(),1);
  assert.equal(readG2(),1);
 }
 {
  const batcher=createGeometryBatcher();
  const g1=batcher.add(new T.BoxGeometry(1,1,1),mat,null);
  const readG1=disposeCount(g1);
  batcher.build(new T.Group(),{disposeSources:false});
  assert.equal(readG1(),0);
 }
});

test('deindexFirst:true de-indexes (or clones) before applying the transform, matching cave-entrance-scenery.js',()=>{
 const batcher=createGeometryBatcher();
 const mat=new T.MeshStandardMaterial();
 const source=new T.BoxGeometry(1,1,1); // indexed by default
 assert.ok(source.index);
 batcher.add(source,mat,new T.Matrix4().makeTranslation(1,0,0),{deindexFirst:true});
 // the original stays indexed and untouched -- only a de-indexed copy was transformed
 assert.ok(source.index);
 const [mesh]=batcher.build(new T.Group());
 assert.equal(mesh.geometry.index,null);
});

test('keepAttributes strips every attribute not named, matching the position/normal-only cave-entrance-scenery.js batches',()=>{
 const batcher=createGeometryBatcher();
 const mat=new T.MeshStandardMaterial();
 const source=new T.BoxGeometry(1,1,1); // ships with position, normal and uv
 assert.ok(source.attributes.uv);
 batcher.add(source,mat,null,{deindexFirst:true,keepAttributes:['position','normal']});
 const [mesh]=batcher.build(new T.Group());
 assert.ok(mesh.geometry.attributes.position);
 assert.ok(mesh.geometry.attributes.normal);
 assert.equal(mesh.geometry.attributes.uv,undefined);
});

test('ensureUV adds a zero-filled uv sized to the position count only when uv is missing, matching environment.js',()=>{
 const batcher=createGeometryBatcher();
 const mat=new T.MeshStandardMaterial();
 const noUV=new T.BufferGeometry();
 noUV.setAttribute('position',new T.Float32BufferAttribute([0,0,0, 1,0,0, 0,1,0],3));
 noUV.computeVertexNormals();
 batcher.add(noUV,mat,null,{ensureUV:true});
 const [mesh]=batcher.build(new T.Group());
 assert.ok(mesh.geometry.attributes.uv);
 assert.equal(mesh.geometry.attributes.uv.count,mesh.geometry.attributes.position.count);
 assert.ok(Array.from(mesh.geometry.attributes.uv.array).every(n=>n===0));
});

test('toNonIndexed converts after the transform, and disposeIntermediate controls whether the pre-conversion copy leaks',()=>{
 const mat=new T.MeshStandardMaterial();
 // environment.js: toNonIndexed:true, disposeIntermediate left false (default) -- the transformed indexed clone leaks.
 {
  const batcher=createGeometryBatcher();
  const events=[];
  const original=new T.BoxGeometry(1,1,1);
  const origClone=original.clone.bind(original);
  original.clone=function(){const c=origClone();c.addEventListener('dispose',()=>events.push('intermediate'));return c;};
  batcher.add(original,mat,null,{toNonIndexed:true});
  batcher.build(new T.Group());
  assert.deepEqual(events,[]); // never disposed -- verbatim environment.js leak
 }
 // treasure-chests.js: toNonIndexed:true, disposeIntermediate:true -- the pre-conversion clone IS disposed.
 {
  const batcher=createGeometryBatcher();
  const events=[];
  const original=new T.BoxGeometry(1,1,1);
  const origClone=original.clone.bind(original);
  original.clone=function(){const c=origClone();c.addEventListener('dispose',()=>events.push('intermediate'));return c;};
  batcher.add(original,mat,null,{toNonIndexed:true,disposeIntermediate:true});
  batcher.build(new T.Group());
  assert.deepEqual(events,['intermediate']);
 }
});

test('resolveMaterial runs once per new key, matching environment.js\'s independent-material clone-on-first-sight',()=>{
 const batcher=createGeometryBatcher();
 let calls=0;
 const mat=new T.MeshStandardMaterial({color:0x336699});
 const resolveMaterial=m=>{calls++;const clone=m.clone();clone.transparent=true;return clone;};
 batcher.add(new T.BoxGeometry(1,1,1),mat,null,{key:'shared',resolveMaterial});
 batcher.add(new T.BoxGeometry(1,1,1),mat,null,{key:'shared',resolveMaterial});
 assert.equal(calls,1);
 const [mesh]=batcher.build(new T.Group());
 assert.notEqual(mesh.material,mat);
 assert.equal(mesh.material.transparent,true);
 assert.equal(mat.transparent,false);
});

test('materialFor resolves the merged mesh\'s material at build time from the batch key, matching cave-entrance-scenery.js\'s string-keyed lookup',()=>{
 const batcher=createGeometryBatcher();
 const materials={rock:new T.MeshStandardMaterial({color:0x888888}),moss:new T.MeshStandardMaterial({color:0x445544})};
 batcher.add(new T.BoxGeometry(1,1,1),'rock',null);
 batcher.add(new T.BoxGeometry(1,1,1),'moss',null);
 const meshes=batcher.build(new T.Group(),{materialFor:key=>materials[key]});
 assert.equal(meshes[0].material,materials.rock);
 assert.equal(meshes[1].material,materials.moss);
});

test('skipNull matches environment.js\'s if(!g)continue guard; without it, a null merge propagates into new T.Mesh(null,material) and throws, exactly like the two unguarded call sites would',()=>{
 const mat=new T.MeshStandardMaterial();
 const indexed=new T.BoxGeometry(1,1,1);
 const nonIndexed=indexed.clone().toNonIndexed(); // mismatched index presence -> mergeGeometries returns null
 {
  const batcher=createGeometryBatcher();
  batcher.add(indexed,mat,null,{key:'k'});
  batcher.add(nonIndexed,mat,null,{key:'k'});
  const meshes=batcher.build(new T.Group(),{skipNull:true});
  assert.equal(meshes.length,0);
 }
 {
  const batcher=createGeometryBatcher();
  batcher.add(indexed,mat,null,{key:'k'});
  batcher.add(nonIndexed,mat,null,{key:'k'});
  // Three's own Mesh constructor dereferences geometry.morphAttributes immediately,
  // so an unguarded null merge throws here -- it would throw the same way inline.
  assert.throws(()=>batcher.build(new T.Group()),TypeError);
 }
});

test('useGroups is passed straight through to mergeGeometries',()=>{
 const mat=new T.MeshStandardMaterial();
 for(const [useGroups,expectedGroups] of [[true,2],[false,0],[undefined,0]]){
  const batcher=createGeometryBatcher();
  batcher.add(new T.BoxGeometry(1,1,1),mat,null);
  batcher.add(new T.BoxGeometry(1,1,1),mat,null);
  const [mesh]=batcher.build(new T.Group(),{useGroups});
  assert.equal(mesh.geometry.groups.length,expectedGroups,`useGroups:${useGroups}`);
 }
});

test('castShadow/receiveShadow default true and are overridable; frustumCulled/name are left untouched unless given',()=>{
 const batcher=createGeometryBatcher();
 const mat=new T.MeshStandardMaterial();
 batcher.add(new T.BoxGeometry(1,1,1),mat,null);
 const [mesh]=batcher.build(new T.Group());
 assert.equal(mesh.castShadow,true);
 assert.equal(mesh.receiveShadow,true);
 assert.equal(mesh.frustumCulled,true); // Three's own default, never touched
 assert.equal(mesh.name,'');
 const batcher2=createGeometryBatcher();
 batcher2.add(new T.BoxGeometry(1,1,1),mat,null);
 const [mesh2]=batcher2.build(new T.Group(),{castShadow:false,receiveShadow:false,frustumCulled:false,name:'merged-static'});
 assert.equal(mesh2.castShadow,false);
 assert.equal(mesh2.receiveShadow,false);
 assert.equal(mesh2.frustumCulled,false);
 assert.equal(mesh2.name,'merged-static');
});
