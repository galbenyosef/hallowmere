import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {createNpcCharacter, NPC_MODEL_IDS} from '../scripts/npc-models.mjs';

// Proves the T1-4 model-primitives adoption changes nothing observable: every
// Object3D built by createNpcCharacter(id) for every id in NPC_MODEL_IDS --
// name, transform, shadow flags, visibility, geometry type/parameters/
// attribute bytes, material -- hashes to the same value before and after the
// primitive kit is swapped for imports from dist/model-primitives.js. The
// expected hashes below were captured on the unmodified file (three
// consecutive runs agreed) and must never be edited to make a change pass.
function sha256(arr) {
 const buf = Buffer.from(arr.buffer, arr.byteOffset, arr.byteLength);
 return createHash('sha256').update(buf).digest('hex');
}
function canonical(value) {
 if (Array.isArray(value)) return value.map(canonical);
 if (value && typeof value === 'object') {
  const keys = Object.keys(value).filter(k => k !== 'uuid').sort();
  const out = {};
  for (const k of keys) out[k] = canonical(value[k]);
  return out;
 }
 return value;
}
const hex = c => '#' + c.getHexString();
function fingerprintNode(node) {
 const parts = [
  node.name, node.type,
  node.position.x.toFixed(6), node.position.y.toFixed(6), node.position.z.toFixed(6),
  node.quaternion.x.toFixed(6), node.quaternion.y.toFixed(6), node.quaternion.z.toFixed(6), node.quaternion.w.toFixed(6),
  node.scale.x.toFixed(6), node.scale.y.toFixed(6), node.scale.z.toFixed(6),
  String(node.castShadow), String(node.receiveShadow), String(node.visible),
 ];
 if (node.isMesh) {
  const g = node.geometry, m = node.material;
  parts.push('geom:' + g.type, JSON.stringify(canonical(g.parameters ?? {})));
  for (const name of Object.keys(g.attributes).sort()) {
   const attr = g.attributes[name];
   parts.push(`attr:${name}:${attr.itemSize}:${sha256(attr.array)}`);
  }
  parts.push('index:' + (g.index ? sha256(g.index.array) : 'none'));
  parts.push('mat:' + hex(m.color));
  parts.push('metalness:' + (m.metalness ?? ''));
  parts.push('roughness:' + (m.roughness ?? ''));
  parts.push('flatShading:' + (m.flatShading ?? ''));
  parts.push('emissive:' + (m.emissive ? hex(m.emissive) : ''));
  parts.push('emissiveIntensity:' + (m.emissiveIntensity ?? ''));
  parts.push('opacity:' + m.opacity);
  parts.push('transparent:' + m.transparent);
  parts.push('side:' + m.side);
 }
 return parts.join('|');
}
function fingerprintHash(root) {
 const lines = [];
 root.traverse(node => lines.push(fingerprintNode(node)));
 return createHash('sha256').update(lines.join('\n')).digest('hex');
}

// tests/npc-models.test.mjs imports createNpcCharacter/NPC_MODEL_IDS the same way.
const NPC_HASHES = {
 "elder": "d1e64a70f313cf32403952b83e2ee205b9227acd3ccf097c05c618e20ad3cf11",
 "healer": "b79b766908b20a29d229a1f15cbfc33bb6e718f59dfdac4ede02756ff3ebe06a",
 "smith": "e7c766de9a4957521a75c6c68a9667ee410ce4b1b4a9cd5307fcfc285c9b7e2b",
 "watchman": "25434219bd0843f4d2e86dd8a0986ee9c934b4edc50440b53c0b8e66e02cb193",
};

test('createNpcCharacter() builds every NPC_MODEL_IDS entry with the exact golden geometry', () => {
 assert.deepEqual([...NPC_MODEL_IDS].sort(), Object.keys(NPC_HASHES).sort());
 for (const id of NPC_MODEL_IDS) {
  const root = createNpcCharacter(id);
  let nodeCount = 0, meshCount = 0;
  root.traverse(node => { nodeCount++; if (node.isMesh) meshCount++; });
  assert.ok(nodeCount > 50, `${id}: expected a rich tree, got ${nodeCount} nodes`);
  assert.ok(meshCount > 50, `${id}: expected many meshes, got ${meshCount}`);
  assert.equal(fingerprintHash(root), NPC_HASHES[id], `${id}: geometry fingerprint changed -- the adoption must reproduce the original mesh tree exactly`);
 }
});

test('the module still exports exactly the API the game imports', async () => {
 const M = await import('../scripts/npc-models.mjs');
 assert.deepEqual(Object.keys(M).sort(), ['NPC_MODEL_IDS', 'createNpcCharacter']);
});
