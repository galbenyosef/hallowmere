import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {createGeraltCharacter, GERALT_POSES} from '../dist/geralt-character-model.js';

// Golden-geometry proof for the T1-1 model-primitives adoption: these hashes were
// captured on the unmodified file, before dist/geralt-character-model.js imported
// dist/model-primitives.js, and must never be updated to make a later edit pass.
// A changed hash means the adoption altered a mesh's tree position, transform,
// vertex/index bytes, or material -- find the parameter mismatch and fix the call
// site instead of the expectation below.
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

// createGeraltCharacter() takes no arguments (dist/playable-characters.js is the
// only caller), so the one distinct argument combination the game uses is none --
// the pose setter is the only axis of variation, exercised by cycling every
// GERALT_POSES value through the same character the way the study/preview code does.
test('createGeraltCharacter builds an identical tree in every pose',()=>{
 assert.deepEqual(GERALT_POSES,['sheathed','steel','silver','dagger']);
 const character=createGeraltCharacter();
 const hashes={};
 for(const pose of GERALT_POSES){
  character.setPose(pose);
  assert.equal(character.pose,pose);
  hashes[pose]=fingerprint(character.root);
 }
 assert.deepEqual(hashes,{
  sheathed:'f0d25357bab2c7ed005aa26c4ecd0e0d3110f416b68d5de005fda238b470aa9d',
  steel:'b4ed4cc462b462d1afbe4de4c40bb7e31adfe6648146068566fe46ca2f1e11a0',
  silver:'b9eccba582cae9429c31a6718b3c608f9b76d1c01f7011742a823c251c3f5b91',
  dagger:'f5ac343088d044f46f54584bb9ab8dbaa938c1b306b7e2155d16fb693acc944a',
 });
});
