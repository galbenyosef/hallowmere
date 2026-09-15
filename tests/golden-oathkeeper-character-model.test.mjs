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
   String(node.castShadow),String(node.receiveShadow),String(node.visible)].join('|'));
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
const CREATE_HASH='b1f61e715b50c444ec082acb40409750deaff765f8775e18d41ab5eefe1d2253';

test('createOathkeeperCharacter builds the identical raw tree',()=>{
 const root=createOathkeeperCharacter();
 assert.equal(fingerprint(root),CREATE_HASH);
});

// States mirror combat-effects.js's animateHeroAttack: flight on/off, a 'bolt' cast that
// swaps blaster for holster, an idle reset, and a reduced-motion frame (gear.time frozen).
const POSE_HASHES=[
 '953c9ad92a97da9bfa9f0e7639f8f3b4f87cad5d11fbd2a2b708034d77c8b6b4',
 'ecec9b673a614abb90368dcca8781aa56888bcfd55aee3a1507172331fb0e241',
 '2bd5b790a66785f9cd16d46c55f5c9a47eed8cc1fa25785f0a4585c61a2457f6',
 'ae5499c8ac22643b8a05d2b60df4acfb673c4f34ae28a2979c9862b8c392959a',
 '1de249ab02e501c59eabccbbabf06405b9a0b56192e087395d6f1fc0d3f39059',
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
