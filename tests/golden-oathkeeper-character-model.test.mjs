import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {createOathkeeperCharacter,updateOathkeeperPose} from '../dist/oathkeeper-character-model.js';

// Golden-geometry proof for T1-2: captured on the UNMODIFIED oathkeeper-character-model.js
// before dist/model-primitives.js was adopted. Every hash below must stay identical after
// the adoption — a change means a builder call site stopped reproducing the old vertices,
// quaternions or material values. Never update these constants to make a failure pass.

// geometry.parameters on ExtrudeGeometry embeds the actual Shape object(s), and Shape
// (via Curve) carries a randomly generated .uuid — strip it recursively so the hash
// reflects only the deterministic shape data, not a fresh uuid every process.
function stripUuid(value){
 if(Array.isArray(value))return value.map(stripUuid);
 if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).filter(([key])=>key!=='uuid').map(([key,inner])=>[key,stripUuid(inner)]));
 return value;
}
function attrHash(array){
 const buf=Buffer.from(array.buffer,array.byteOffset,array.byteLength);
 return createHash('sha256').update(buf).digest('hex');
}
function fingerprint(root){
 const lines=[];
 root.traverse(node=>{
  const p=node.position,q=node.quaternion,s=node.scale;
  lines.push(['node',node.name,node.type,
   p.x.toFixed(6),p.y.toFixed(6),p.z.toFixed(6),
   q.x.toFixed(6),q.y.toFixed(6),q.z.toFixed(6),q.w.toFixed(6),
   s.x.toFixed(6),s.y.toFixed(6),s.z.toFixed(6),
   String(node.castShadow),String(node.receiveShadow)].join('|'));
  if(node.isMesh){
   const g=node.geometry,m=node.material;
   lines.push('geom|'+g.type+'|'+JSON.stringify(stripUuid(g.parameters===undefined?null:g.parameters)));
   for(const key of Object.keys(g.attributes).sort())lines.push('attr|'+key+'|'+attrHash(g.attributes[key].array));
   lines.push('index|'+(g.index?attrHash(g.index.array):'none'));
   lines.push('mat|'+['#'+m.color.getHexString(),m.metalness,m.roughness,m.flatShading,
    '#'+m.emissive.getHexString(),m.emissiveIntensity,m.opacity,m.transparent,m.side].join('|'));
  }
 });
 return createHash('sha256').update(lines.join('\n')).digest('hex');
}
// Mirrors dist/main.js's internal getRig(root): the only way updateOathkeeperPose's rig
// shape (gear=rig.oathkeeper, rig.body, rig.legs) gets built from a raw character root.
function getRig(root){
 const body=root.getObjectByName('body'),rig={root,body,baseY:body?.userData.baseY??body?.position.y,arms:[],legs:[]};
 root.traverse(o=>{if(o.name.startsWith('leg'))rig.legs.push(o);if(o.name.startsWith('arm'))rig.arms.push(o);});
 if(root.getObjectByName('oathkeeper-wing-harness'))rig.oathkeeper={wings:[root.getObjectByName('oathkeeper-wing-left'),root.getObjectByName('oathkeeper-wing-right')],blaster:root.getObjectByName('oathkeeper-blaster'),holster:root.getObjectByName('oathkeeper-holstered-blaster')};
 return rig;
}

// createOathkeeperCharacter() is called with no arguments everywhere in the game
// (dist/character-study-models.js:148), so there is exactly one argument combination.
const CREATE_HASH='545a91396c1e656f0ff712c5de3f46f376974e3a8bc94327b858e43a237eacaa';

test('createOathkeeperCharacter builds the identical raw tree',()=>{
 const root=createOathkeeperCharacter();
 assert.equal(fingerprint(root),CREATE_HASH);
});

// States mirror combat-effects.js's animateHeroAttack: flight on/off, a 'bolt' cast that
// swaps blaster for holster, an idle reset, and a reduced-motion frame (gear.time frozen).
const POSE_HASHES=[
 '2e110be2656215f633d9f2a9f1ddf292990d6a505bf88f00d7e10fecb711a729',
 '66a5916aa40edcd03da8495ff3903b8366638f9085fc724966aea3585dbef9c3',
 '11b1cae2a0b68f50338621276c5ace48317a8bed99e8f3b3833bad045d91fb6a',
 'cdd64115d8e3c35987b53512007fc7297efc1981ee784b17be2c7dd087a46f74',
 'fb4387af40ada1b4319111c4bb4d589fa13c6cd5da088401efe4be4457ca5678',
];

test('updateOathkeeperPose reproduces the identical tree at every state the game reaches',()=>{
 const root=createOathkeeperCharacter(),rig=getRig(root),hashes=[];
 rig.root.userData.oathkeeperFlight=1;rig.attack=.36;rig.attackKind='bolt';
 updateOathkeeperPose(rig,.1);hashes.push(fingerprint(root));
 updateOathkeeperPose(rig,.2);hashes.push(fingerprint(root));
 rig.attack=0;rig.attackKind=undefined;
 updateOathkeeperPose(rig,.15);hashes.push(fingerprint(root));
 rig.root.userData.oathkeeperFlight=0;
 updateOathkeeperPose(rig,1);hashes.push(fingerprint(root));
 rig.root.userData.oathkeeperReducedMotion=true;rig.root.userData.oathkeeperFlight=1;
 updateOathkeeperPose(rig,.5);hashes.push(fingerprint(root));
 assert.deepEqual(hashes,POSE_HASHES);
});
