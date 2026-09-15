import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {createRangerCharacter,updateRangerWeapons} from '../dist/ranger-character-model.js';

// Golden-geometry proof for T1-2: captured on the UNMODIFIED ranger-character-model.js
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
// Mirrors dist/main.js's internal getRig(root): the only way updateRangerWeapons's rig
// shape (gear=rig.rangerWeapons) gets built from a raw character root.
function getRig(root){
 const body=root.getObjectByName('body'),rig={root,body,baseY:body?.userData.baseY??body?.position.y,arms:[],legs:[]};
 root.traverse(o=>{if(o.name.startsWith('leg'))rig.legs.push(o);if(o.name.startsWith('arm'))rig.arms.push(o);});
 if(root.getObjectByName('ranger-quiver'))rig.rangerWeapons={bow:root.getObjectByName('weapon'),stowed:root.getObjectByName('ranger-stowed-bow'),right:root.getObjectByName('ranger-knife-right'),left:root.getObjectByName('ranger-knife-left'),sheathed:root.getObjectByName('ranger-sheathed-knives')};
 return rig;
}

// createRangerCharacter() is called with no arguments everywhere in the game
// (dist/character-study-models.js:145), so there is exactly one argument combination.
const CREATE_HASH='2575c0bf3d7380cfe0156baa82722119d2aeeedb7700936269f40f974e097e59';

test('createRangerCharacter builds the identical raw tree',()=>{
 const root=createRangerCharacter();
 assert.equal(fingerprint(root),CREATE_HASH);
});

// States mirror combat-effects.js's animateHeroAttack: idle, a 'paired' melee cut that
// swaps the bow for both knives, a 'bolt' ranged draw that keeps the bow, and idle again.
const WEAPON_HASHES=[
 '2575c0bf3d7380cfe0156baa82722119d2aeeedb7700936269f40f974e097e59',
 '2575c0bf3d7380cfe0156baa82722119d2aeeedb7700936269f40f974e097e59',
 '2575c0bf3d7380cfe0156baa82722119d2aeeedb7700936269f40f974e097e59',
 '2575c0bf3d7380cfe0156baa82722119d2aeeedb7700936269f40f974e097e59',
];

test('updateRangerWeapons reproduces the identical tree at every state the game reaches',()=>{
 const root=createRangerCharacter(),rig=getRig(root),hashes=[];
 rig.attack=0;rig.attackKind=undefined;
 updateRangerWeapons(rig);hashes.push(fingerprint(root));
 rig.attack=.42;rig.attackKind='paired';
 updateRangerWeapons(rig);hashes.push(fingerprint(root));
 rig.attack=.36;rig.attackKind='bolt';
 updateRangerWeapons(rig);hashes.push(fingerprint(root));
 rig.attack=0;rig.attackKind=undefined;
 updateRangerWeapons(rig);hashes.push(fingerprint(root));
 assert.deepEqual(hashes,WEAPON_HASHES);
});
