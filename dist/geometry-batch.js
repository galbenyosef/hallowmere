import * as T from './vendor/three.core.js';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';

// One merge-batcher for the "accumulate transformed geometries per material, then
// mergeGeometries() into a single static Mesh" idiom repeated across the scenery
// tier. add()/build() options reproduce each original exactly — original → options:
//  environment.js mergeStaticGroup   add:{key:o.material.uuid,resolveMaterial,ensureUV:true,toNonIndexed:true} · build(scene,{useGroups:false,skipNull:true})
//  cave-entrance-scenery.js add/loop add:{deindexFirst:true,keepAttributes:['position','normal']} · build(group,{materialFor:key=>materials[key]})
//  treasure-chests.js merge loop    add:{toNonIndexed:true,disposeIntermediate:true} · build(root,{})
// cave-scenery.js and outland-scenery.js also keep a Map named `batches`, but it
// buckets instance transforms for an InstancedMesh (setMatrixAt per item) rather than
// geometries for mergeGeometries — a different operation this batcher does not
// perform, so those two files are left unmodified (see the T1-10 report).
export function createGeometryBatcher(){
 const batches=new Map();
 function add(geometry,material,transform,{key=material,resolveMaterial,deindexFirst=false,ensureUV=false,keepAttributes=null,toNonIndexed=false,disposeIntermediate=false}={}){
  let g;
  if(deindexFirst){
   g=geometry.index?geometry.toNonIndexed():geometry.clone();
   if(transform)g.applyMatrix4(transform);
   if(keepAttributes)for(const name of Object.keys(g.attributes))if(!keepAttributes.includes(name))g.deleteAttribute(name);
  }else{
   g=geometry.clone();
   if(transform)g.applyMatrix4(transform);
   if(ensureUV&&!g.attributes.uv)g.setAttribute('uv',new T.BufferAttribute(new Float32Array(g.attributes.position.count*2),2));
   if(toNonIndexed&&g.index){const flat=g.toNonIndexed();if(disposeIntermediate)g.dispose();g=flat;}
  }
  let entry=batches.get(key);
  if(!entry){entry={material:resolveMaterial?resolveMaterial(material):material,geometries:[]};batches.set(key,entry);}
  entry.geometries.push(g);
  return g;
 }
 function build(parent,{useGroups,disposeSources=true,skipNull=false,materialFor,castShadow=true,receiveShadow=true,frustumCulled,name,onMesh}={}){
  const meshes=[];
  for(const [key,entry] of batches){
   const merged=mergeGeometries(entry.geometries,useGroups);
   if(merged==null&&skipNull)continue;
   const material=materialFor?materialFor(key,entry.material):entry.material;
   const mesh=new T.Mesh(merged,material);
   mesh.castShadow=castShadow;mesh.receiveShadow=receiveShadow;
   if(frustumCulled!==undefined)mesh.frustumCulled=frustumCulled;
   if(name)mesh.name=typeof name==='function'?name(key):name;
   if(onMesh)onMesh(mesh,key,entry);
   parent.add(mesh);
   if(disposeSources)entry.geometries.forEach(g=>g.dispose());
   meshes.push(mesh);
  }
  return meshes;
 }
 return {add,build,batches};
}
