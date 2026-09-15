import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {createCharacter, createStudyScene, disposeStudy, addSkillEffect, animateEffect, clearEffect} from '../dist/character-study-models.js';
import {roster} from '../dist/character-study-roster.js';

// Proves the T1-4 model-primitives adoption changes nothing observable: every
// Object3D built by createCharacter() for every roster concept -- name,
// transform, shadow flags, visibility, geometry type/parameters/attribute
// bytes, material -- hashes to the same value before and after the primitive
// kit is swapped for imports from dist/model-primitives.js. Skill effects
// (addSkillEffect/animateEffect/clearEffect) are proved the same way, with
// the fx group's clock pinned so the fingerprint is reproducible. The
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

// createCharacter(concept) is how playable-characters.js and character-portraits.js
// build every non-Geralt roster entry (see dist/playable-characters.js:20 and
// dist/character-portraits.js:16); C02-C05 delegate to the ranger/reaver/
// nightblade/oathkeeper kits, exercising createCharacter's special cases too.
const CHAR_HASHES = {
 "W01": "ab03a289699f2f65e68a79dd6a4c5ff7567e7374cff2f46d97a5cd3a599a8673",
 "W02": "948fce80656ba4035a74585fbbab5c49d65f159e316e60b6276daa6a1b30b314",
 "W03": "0401a7aa5b60104bb12996b9bddc48441bfe38902efcf58dff84834094d707f1",
 "W04": "312c363fa53d76cba31760b5276c0ce15b3cdbb997ceb3cb4051adae03324592",
 "W05": "46615fe25520f8452576b5e081187c02b55a1305552cccb84f1bd1ecac44a720",
 "W06": "22f6f41b322362e3f8368219c7486ec703465cfeaea3c7068ca9d994a56c1ded",
 "W07": "9daf0ad350332c97d77b9a1a506f9f2d0251f841b07d039b4a657e483cb2c084",
 "W08": "10a02a78c1a352667d806cc3a0da329ce3e5e5b8ff1f5d5799bc490084fa5e17",
 "W09": "1f3dd148854775463f55bdca9646435c96e01f44e17ea0c5c7c890ed1bc1861b",
 "W10": "6a2717adf10c59c5163b9a92fdeb8fbc1e2cf67454e7202daadbc83493a09a68",
 "C01": "3bcd8a4955eb58b14ecc321df68d0c34c30832ce3dbf09e83071dffd3835e07a",
 "C02": "6be7c3aa269d3f8c2cdbed68f3d8cada913f79b0a85eb9accf560256facef914",
 "C03": "9cda3fd32f293f7b13a5cd820b8125162210843d21deff2fefe1c6cf16d34601",
 "C04": "faf16bbbc7943796351c31ce02400f4a39451a8708855ecc56bc5083870250c9",
 "C05": "9ac71040f032caa9be522d8f003fbaf4201ca4698cf188dedbf30ad9269b6b26",
 "C06": "2a570e2e48788cb9de34c23a4f139e7a863628ee04511ce353941a0c717794ff",
 "C07": "b67fd99c7130e5cff3e23f3579b0ca3e9221663221e5a4dcc54abcfc81986512",
 "C08": "64bc0fed8f798337b3d74d198a9f4bca034da3619e854b603880980527c1b1ce",
 "C09": "47577d8c7718e566d1e706a38f42d83acf342854cee5346d20cecfc1bbf14317",
 "C10": "1ece296639cccbfeab0e6f99c0b915e78ab69ea67bcbd776bd6ad459433f4eab",
};

test('createCharacter() builds every roster concept with the exact golden geometry', () => {
 assert.deepEqual(roster.map(c => c.id).sort(), Object.keys(CHAR_HASHES).sort());
 for (const concept of roster) {
  const root = createCharacter(concept);
  let nodeCount = 0, meshCount = 0;
  root.traverse(node => { nodeCount++; if (node.isMesh) meshCount++; });
  assert.ok(nodeCount > 15, `${concept.id}: expected a rich tree, got ${nodeCount} nodes`);
  assert.equal(fingerprintHash(root), CHAR_HASHES[concept.id], `${concept.id}: geometry fingerprint changed -- the adoption must reproduce the original mesh tree exactly`);
 }
});

// Skill kinds the roster actually references (dist/character-study-roster.js),
// exercised through addSkillEffect/animateEffect/clearEffect exactly as
// dist/character-studies.js drives them.
const KINDS = [...new Set(roster.flatMap(c => c.skills.map(s => s.effect)))].sort();
const EFFECT_HASHES = {
 "blink": {"afterAdd": "31844edc4736912ab7a932037df43d367f3b7e3f3bd7558c05c75dd55bdcc823", "afterAnimate": "79fb7cb8adf22c5fdf53e7db3d0c090c26d070079554e1351f2b1a19a53b2466"},
 "bolt": {"afterAdd": "31844edc4736912ab7a932037df43d367f3b7e3f3bd7558c05c75dd55bdcc823", "afterAnimate": "5ddea832a513ba29674413c5a0eea270b0c38c0f16c0ae6732a56372b382240c"},
 "burst": {"afterAdd": "e38850f46c7a086ede74de825bbee4c8c9f979abd39aa0c3a5d82337f681a7d4", "afterAnimate": "076b03e55a34633bdd5a7d622e937eacb850c2bfd1b6e72cf0860661fe79172e"},
 "ring": {"afterAdd": "e38850f46c7a086ede74de825bbee4c8c9f979abd39aa0c3a5d82337f681a7d4", "afterAnimate": "2ee21695f39dc8616fc7f13b3af7290ab83a27b79bf2780f2474df309b772f4b"},
 "slash": {"afterAdd": "31844edc4736912ab7a932037df43d367f3b7e3f3bd7558c05c75dd55bdcc823", "afterAnimate": "bdff3b604716779bb6e45a96e2b94087716e532685b6bc9c8c77901af8c5fd6e"},
 "swirl": {"afterAdd": "31844edc4736912ab7a932037df43d367f3b7e3f3bd7558c05c75dd55bdcc823", "afterAnimate": "f59f2388ec84a4fb8946fdbadbe2ca00b7d7895e1ebd2f113bf04036286dfb14"},
};

test('addSkillEffect/animateEffect/clearEffect reproduce each roster skill kind exactly', () => {
 assert.deepEqual(KINDS, Object.keys(EFFECT_HASHES).sort());
 const study = createStudyScene(roster[0]);
 for (const kind of KINDS) {
  addSkillEffect(study, 0x66ccff, kind);
  study.fx.userData.start = 1000; // pin the clock so the fingerprint is reproducible
  assert.equal(fingerprintHash(study.fx), EFFECT_HASHES[kind].afterAdd, `${kind}: fx fingerprint changed right after addSkillEffect`);
  animateEffect(study, 1500); // age = 0.5s exactly
  assert.equal(fingerprintHash(study.fx), EFFECT_HASHES[kind].afterAnimate, `${kind}: fx fingerprint changed after animateEffect`);
  clearEffect(study);
  assert.equal(study.fx.children.length, 0, `${kind}: clearEffect left fx children behind`);
  assert.deepEqual(study.fx.userData, {}, `${kind}: clearEffect left fx userData behind`);
 }
 disposeStudy(study);
});

test('the module still exports exactly the API the game imports', async () => {
 const M = await import('../dist/character-study-models.js');
 assert.deepEqual(Object.keys(M).sort(), ['addSkillEffect', 'animateEffect', 'clearEffect', 'createCharacter', 'createStudyScene', 'disposeStudy']);
});
