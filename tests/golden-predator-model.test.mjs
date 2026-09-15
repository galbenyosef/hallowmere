import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {register} from 'node:module';
import {pathToFileURL} from 'node:url';
import {dirname, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

// Proves the T1-3 model-primitives adoption changes nothing observable: every
// Object3D built by createPredatorCharacter().root -- name, transform, shadow
// flags, visibility, geometry type/parameters/attribute bytes, material --
// hashes to the same value before and after the primitive kit is swapped for
// imports from dist/model-primitives.js, across every pose x appearance
// combination the game reaches through setPose()/setAppearance(). The
// expected hashes below were captured on the unmodified file (three
// consecutive runs agreed) and must never be edited to make a change pass.
//
// dist/predator-model.js imports the bare 'three' specifier, which only the
// page's <script type="importmap"> can resolve (see dist/index.html); Node
// has no import map, so this registers a loader hook that redirects just that
// one specifier to dist/vendor/three.module.js (the same target the page's
// import map uses), exactly like the browser would. Everything else --
// including predator-model.js's own relative import of ./model-primitives.js
// -- resolves normally.
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const vendorUrl = pathToFileURL(resolve(root, 'dist/vendor/three.module.js')).href;
const hooksSource = `
export async function resolve(specifier, context, nextResolve) {
 if (specifier === 'three') return nextResolve(${JSON.stringify(vendorUrl)}, context);
 return nextResolve(specifier, context);
}
`;
register('data:text/javascript;base64,' + Buffer.from(hooksSource).toString('base64'), import.meta.url);
const {createPredatorCharacter, PREDATOR_POSES, PREDATOR_APPEARANCES} = await import(pathToFileURL(resolve(root, 'dist/predator-model.js')).href);

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
function fingerprintHash(node3d) {
 const lines = [];
 node3d.traverse(node => lines.push(fingerprintNode(node)));
 return createHash('sha256').update(lines.join('\n')).digest('hex');
}

// predator-world-preview.js builds one character and drives it through every
// pose (equipment select) and appearance (mask toggle) via the setters.
const EXPECTED = {
 'stalk|masked': '7cd48060354cbd0952d20808792fb0f13cf821a8dcf90f116b93ac71ac65340f',
 'stalk|unmasked': '374bf5018c61c2c01848a55cb79b528278ce2253fc2767cc2ab60c0422c42617',
 'blades|masked': '60567a47a7ef66e7090966b08108652ef8468fafbf851daef1394ef683d26e89',
 'blades|unmasked': '0ff7387cbf8807007273295f9d29131378ca6dec61742f4007bf2f2fd2408bf6',
 'aim|masked': '883eb286de5bf44c315403683ea3bb4d09950eb4a2ccacb6b9da777b4a5e2e8b',
 'aim|unmasked': 'd7abcfae65f20ee77d657ba006a3b1ea0a474d2518892638537af45683b2b95f',
};

test('PREDATOR_POSES and PREDATOR_APPEARANCES still name every fingerprinted combination', () => {
 assert.deepEqual([...PREDATOR_POSES].sort(), ['aim', 'blades', 'stalk']);
 assert.deepEqual([...PREDATOR_APPEARANCES].sort(), ['masked', 'unmasked']);
 assert.deepEqual(Object.keys(EXPECTED).sort(), PREDATOR_POSES.flatMap(pose => PREDATOR_APPEARANCES.map(appearance => `${pose}|${appearance}`)).sort());
});

for (const pose of ['stalk', 'blades', 'aim']) {
 for (const appearance of ['masked', 'unmasked']) {
  test(`createPredatorCharacter() builds the exact golden geometry for pose=${pose} appearance=${appearance}`, () => {
   assert.ok(PREDATOR_POSES.includes(pose) && PREDATOR_APPEARANCES.includes(appearance));
   const character = createPredatorCharacter();
   character.setPose(pose);
   character.setAppearance(appearance);
   assert.equal(character.root.name, 'Predator hunter study');
   let nodeCount = 0, meshCount = 0;
   character.root.traverse(node => { nodeCount++; if (node.isMesh) meshCount++; });
   assert.ok(nodeCount > 50, `expected a rich tree, got ${nodeCount} nodes`);
   assert.ok(meshCount > 50, `expected many meshes, got ${meshCount}`);
   const hash = fingerprintHash(character.root);
   assert.equal(hash, EXPECTED[`${pose}|${appearance}`], `predator geometry fingerprint changed for pose=${pose} appearance=${appearance} -- the adoption must reproduce the original mesh tree exactly`);
  });
 }
}
