import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {createNightbladeCharacter} from '../dist/nightblade-character-model.js';

// Golden-geometry proof for the T1-1 model-primitives adoption: this hash was
// captured on the unmodified file, before dist/nightblade-character-model.js
// imported dist/model-primitives.js, and must never be updated to make a later
// edit pass. A changed hash means the adoption altered a mesh's tree position,
// transform, vertex/index bytes, or material -- find the parameter mismatch and
// fix the call site instead of the expectation below.
const hashBytes=array=>createHash('sha256').update(Buffer.from(array.buffer,array.byteOffset,array.byteLength)).digest('hex');
const hashString=value=>createHash('sha256').update(value,'utf8').digest('hex');
const flatten=root=>{const nodes=[];root.traverse(node=>nodes.push(node));return nodes;};
// ExtrudeGeometry.parameters.shapes serializes each T.Shape/Curve with a random
// uuid (Shape.toJSON()); drop it. Key order in geometry.parameters.options also
// reflects each plate() implementation's own object-literal order (e.g. bevelSize
// before bevelThickness here, the reverse in model-primitives.js) which JSON.stringify
// would otherwise treat as a difference though it is not one -- sort keys so the
// fingerprint reflects only real geometry, the same as assert.deepEqual would.
const canonicalize=value=>{
 if(Array.isArray(value))return value.map(canonicalize);
 if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).filter(([key])=>key!=='uuid').sort(([a],[b])=>a<b?-1:a>b?1:0).map(([key,inner])=>[key,canonicalize(inner)]));
 return value;
};

function describe(node){
 const parts=[
  node.name,node.type,
  node.position.toArray().map(n=>n.toFixed(6)).join(','),
  node.quaternion.toArray().map(n=>n.toFixed(6)).join(','),
  node.scale.toArray().map(n=>n.toFixed(6)).join(','),
  String(node.castShadow),String(node.receiveShadow),String(node.visible),
 ];
 if(node.isMesh){
  const g=node.geometry;
  parts.push(g.type,JSON.stringify(canonicalize(g.parameters)));
  for(const key of Object.keys(g.attributes).sort())parts.push(key,hashBytes(g.attributes[key].array));
  parts.push(g.index?hashBytes(g.index.array):'no-index');
  const materials=Array.isArray(node.material)?node.material:[node.material];
  for(const material of materials){
   parts.push(
    material.color.getHexString(),String(material.metalness),String(material.roughness),
    String(material.flatShading),material.emissive.getHexString(),String(material.emissiveIntensity),
    String(material.opacity),String(material.transparent),String(material.side),
   );
  }
 }
 return parts.join('|');
}
function fingerprint(root){return hashString(flatten(root).map(describe).join('\n'));}

// createNightbladeCharacter() takes no arguments -- dist/character-study-models.js
// is the only caller, and it always builds the C04 concept the same way -- so a
// single build is the only distinct argument combination the game uses.
test('createNightbladeCharacter builds an identical tree',()=>{
 const root=createNightbladeCharacter();
 assert.equal(fingerprint(root),'0f85f75217ca0605f1423a6a4b4a54d5464538dfc5b16b4a20926fb3242c098b');
});
