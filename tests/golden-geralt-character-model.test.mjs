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
// uuid (Shape.toJSON()); strip it so the fingerprint reflects only real geometry.
const strip=value=>{
 if(Array.isArray(value))return value.map(strip);
 if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).filter(([key])=>key!=='uuid').map(([key,inner])=>[key,strip(inner)]));
 return value;
};

function describe(node){
 const parts=[
  node.name,node.type,
  node.position.toArray().map(n=>n.toFixed(6)).join(','),
  node.quaternion.toArray().map(n=>n.toFixed(6)).join(','),
  node.scale.toArray().map(n=>n.toFixed(6)).join(','),
  String(node.castShadow),String(node.receiveShadow),
 ];
 if(node.isMesh){
  const g=node.geometry;
  parts.push(g.type,JSON.stringify(strip(g.parameters)));
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
  sheathed:'1e5889b067a80d6b0d7c5db9ad97effc301ab94f6b12ec750f3f2c6a8533524b',
  steel:'f483c78e3ec60cb1eb33bb118395f7f6e5dfa861525c0bf57ff6359868ef1bef',
  silver:'acd6094e75832a24bcc5e204a7d0b71024a8f9eb09077fbbaad7f44a1217e446',
  dagger:'a7bcd2e131f78a80934e032e85a8914428833c95a8d6ffa8501eac945b13f66b',
 });
});
