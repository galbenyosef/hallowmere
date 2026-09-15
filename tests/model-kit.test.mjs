import test from 'node:test';
import assert from 'node:assert/strict';
import {registerHooks} from 'node:module';
import * as T from '../dist/vendor/three.core.js';

// dist/model-kit.js imports the bare 'three' specifier, which only the page's import map
// resolves; match it in Node the way tests/npc-portraits.test.mjs does for GLTFLoader.js.
const hook=registerHooks({resolve(specifier,context,nextResolve){
 if(specifier==='three')return nextResolve(new URL('../dist/vendor/three.module.js',import.meta.url).href,context);
 if(specifier==='three/addons/utils/BufferGeometryUtils.js')return nextResolve(new URL('../dist/vendor/utils/BufferGeometryUtils.js',import.meta.url).href,context);
 return nextResolve(specifier,context);
}});
const {createModelCache}=await import('../dist/model-kit.js');
hook.deregister();

// A synthetic prefab, planted directly in ctx.prefabs so cloneModel skips its
// CLASS_LIST/createPlayableCharacter path (exercised by the appearance tests) and this test
// controls exactly which meshes share a material -- the thing PLAN.md 5.1 calls out: prefabs
// are "cloned with shared geometry" and materials are merged/deduped, not copied per mesh.
function buildPrefab(){
 const material=new T.MeshStandardMaterial({color:0x336699,emissive:0x112233});
 const geometryA=new T.BoxGeometry(1,1,1),geometryB=new T.SphereGeometry(1,8,8);
 const meshA=new T.Mesh(geometryA,material);meshA.name='meshA';
 const meshB=new T.Mesh(geometryB,material);meshB.name='meshB'; // shares meshA's exact material instance
 const root=new T.Group();root.add(meshA,meshB);
 return {root,material,geometryA,geometryB};
}

test('cloneModel shares geometry with the source prefab instead of copying it',()=>{
 const {root,geometryA,geometryB}=buildPrefab(),ctx={prefabs:{rig:root}};
 const {cloneModel}=createModelCache(ctx);
 const clone=cloneModel('rig');
 assert.notEqual(clone,root);
 assert.equal(clone.getObjectByName('meshA').geometry,geometryA);
 assert.equal(clone.getObjectByName('meshB').geometry,geometryB);
 assert.equal(ctx.prefabs.rig,root,'the planted prefab is reused, not rebuilt');
});

test('cloneModel dedupes cloned materials per source uuid, independently per clone',()=>{
 const {root,material}=buildPrefab(),ctx={prefabs:{rig:root}};
 const {cloneModel}=createModelCache(ctx);
 const first=cloneModel('rig'),second=cloneModel('rig');
 const [fa,fb]=[first.getObjectByName('meshA'),first.getObjectByName('meshB')];
 const [sa,sb]=[second.getObjectByName('meshA'),second.getObjectByName('meshB')];
 // Two meshes sharing one source material still share one cloned material within a clone...
 assert.equal(fa.material,fb.material);
 assert.equal(sa.material,sb.material);
 // ...but each cloneModel() call gets its own fresh material, independent of the source and of each other.
 assert.notEqual(fa.material,material);
 assert.notEqual(fa.material,sa.material);
 assert.equal(fa.material.color.getHex(),material.color.getHex());
 // baseEmissive is captured as a clone of the source emissive, not the live reference.
 assert.notEqual(fa.material.userData.baseEmissive,material.emissive);
 assert.equal(fa.material.userData.baseEmissive.getHex(),material.emissive.getHex());
 // Tinting one clone's shared material cannot bleed into the other clone or the source.
 fa.material.color.set(0xff0000);
 assert.notEqual(sa.material.color.getHex(),fa.material.color.getHex());
 assert.notEqual(material.color.getHex(),fa.material.color.getHex());
});

test('cloneModel enables shadows on every cloned mesh',()=>{
 const {root}=buildPrefab(),ctx={prefabs:{rig:root}};
 const {cloneModel}=createModelCache(ctx);
 const clone=cloneModel('rig');
 clone.traverse(o=>{if(o.isMesh){assert.equal(o.castShadow,true);assert.equal(o.receiveShadow,true);}});
});
