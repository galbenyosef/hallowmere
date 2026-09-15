import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {createReaverCharacter} from '../dist/reaver-character-model.js';

// Proves the T1-3 model-primitives adoption changes nothing observable: every
// Object3D built by createReaverCharacter() -- name, transform, shadow flags,
// visibility, geometry type/parameters/attribute bytes, material -- hashes to
// the same value before and after the primitive kit is swapped for imports
// from dist/model-primitives.js. The expected hash below was captured on the
// unmodified file (three consecutive runs agreed) and must never be edited to
// make a change pass.
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

// character-study-models.js is the only caller and invokes createReaverCharacter()
// with no arguments (see dist/character-study-models.js:146).
const EXPECTED_HASH = '9cda3fd32f293f7b13a5cd820b8125162210843d21deff2fefe1c6cf16d34601';

test('createReaverCharacter() builds the exact golden geometry', () => {
 const root = createReaverCharacter();
 assert.equal(root.name, 'C03 Reaver');
 let nodeCount = 0, meshCount = 0;
 root.traverse(node => { nodeCount++; if (node.isMesh) meshCount++; });
 assert.ok(nodeCount > 50, `expected a rich tree, got ${nodeCount} nodes`);
 assert.ok(meshCount > 50, `expected many meshes, got ${meshCount}`);
 assert.equal(fingerprintHash(root), EXPECTED_HASH, 'reaver geometry fingerprint changed -- the adoption must reproduce the original mesh tree exactly');
});
