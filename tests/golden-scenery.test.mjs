import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {registerHooks} from 'node:module';
import {installGlobals} from './helpers/dom.mjs';

// --- Module resolution: remap bare 'three' specifiers to the vendored build, the
// same way the page's import map does, so the five Three-based builders run in Node. ---
const THREE_URL = new URL('../dist/vendor/three.module.js', import.meta.url).href;
const BGUTILS_URL = new URL('../dist/vendor/utils/BufferGeometryUtils.js', import.meta.url).href;
const hook = registerHooks({resolve(specifier, context, nextResolve) {
 if (specifier === 'three') return nextResolve(THREE_URL, context);
 if (specifier === 'three/addons/utils/BufferGeometryUtils.js') return nextResolve(BGUTILS_URL, context);
 return nextResolve(specifier, context);
}});
const T = await import('three');
const Environment = await import('../dist/environment.js');
const RegionEnvironment = await import('../dist/region-environment.js');
const OutlandScenery = await import('../dist/outland-scenery.js');
const CaveScenery = await import('../dist/cave-scenery.js');
const CaveEntranceScenery = await import('../dist/cave-entrance-scenery.js');
const {MAPS, PORTALS} = await import('../dist/regions.js');
const {OVERWORLD_BOUNDS, populateOutlands, plantOutlands, expandSurfaceRegion, distanceToRoute} = await import('../dist/expansion-layout.js');
hook.deregister();

// --- Minimal deterministic canvas stub: only the 2D-context methods the noise and
// label textures call. Pixel content is never fingerprinted, only call counts matter
// (each call consumes from the shared rand() stream). ---
function canvasStub() {
 const ctx = {
  createImageData: (w, h) => ({data: new Uint8ClampedArray(w * h * 4), width: w, height: h}),
  putImageData() {}, beginPath() {}, ellipse() {}, fill() {}, fillRect() {}, strokeRect() {},
  fillText() {}, moveTo() {}, lineTo() {}, quadraticCurveTo() {}, stroke() {},
  createRadialGradient: () => ({addColorStop() {}}),
  fillStyle: '#000', strokeStyle: '#000', font: '', textAlign: '', lineWidth: 1, globalAlpha: 1,
 };
 return {createElement(tag) {
  if (tag !== 'canvas') throw new Error(`golden test canvas stub: unexpected element ${tag}`);
  return {width: 0, height: 0, getContext: () => ctx};
 }};
}
const withCanvas = t => installGlobals(t, {document: canvasStub()});

// --- Fingerprinting -------------------------------------------------------------
const sha256 = bytes => createHash('sha256').update(Buffer.from(bytes.buffer ?? bytes, bytes.byteOffset ?? 0, bytes.byteLength ?? bytes.length)).digest('hex');
const round = n => typeof n === 'number' && Number.isFinite(n) ? Number(n.toFixed(6)) : n;
const fpVec3 = v => [v.x, v.y, v.z].map(n => Number(n.toFixed(6)));
const fpQuat = q => [q.x, q.y, q.z, q.w].map(n => Number(n.toFixed(6)));
const fpColor = c => c ? c.getHexString() : null;

// uuids are THREE's own per-instance random identifiers (MathUtils.generateUUID(),
// backed by real Math.random()) -- stripped everywhere, per spec, since they carry
// no information about the generated scenery and would make hashes non-reproducible
// whenever a Shape/Curve/Path (e.g. inside an ExtrudeGeometry's .parameters) is reached.
function sanitize(value, seen = new WeakSet(), depth = 0) {
 if (value === null || value === undefined) return value === null ? null : undefined;
 if (typeof value === 'number') return round(value);
 if (typeof value === 'string' || typeof value === 'boolean') return value;
 if (typeof value === 'function') return undefined;
 if (value.isObject3D) return {__object3d: value.name || '', type: value.type};
 if (value.isBox3) return {min: fpVec3(value.min), max: fpVec3(value.max)};
 if (value.isVector3 || value.isVector2) return fpVec3({x: value.x, y: value.y, z: value.z ?? 0});
 if (Array.isArray(value)) return value.map(v => sanitize(v, seen, depth + 1));
 if (typeof value === 'object') {
  if (seen.has(value)) return '[circular]';
  if (depth > 8) return '[deep]';
  seen.add(value);
  const out = {};
  for (const key of Object.keys(value).sort()) {
   if (key === 'uuid') continue;
   out[key] = sanitize(value[key], seen, depth + 1);
  }
  return out;
 }
 return String(value);
}
const hashJSON = value => sha256(Buffer.from(JSON.stringify(sanitize(value))));

function fpGeometry(g) {
 const rec = {type: g.type};
 if (g.parameters) rec.parameters = sanitize(g.parameters);
 else {
  rec.attributes = {};
  for (const name of Object.keys(g.attributes).sort()) {
   const attr = g.attributes[name];
   rec.attributes[name] = {itemSize: attr.itemSize, count: attr.count, normalized: !!attr.normalized, hash: sha256(attr.array)};
  }
  if (g.index) rec.index = {count: g.index.count, hash: sha256(g.index.array)};
 }
 return rec;
}
function fpMaterial(m) {
 const rec = {type: m.type, transparent: !!m.transparent, opacity: round(m.opacity), side: m.side, visible: m.visible, depthWrite: !!m.depthWrite, blending: m.blending};
 if ('color' in m) rec.color = fpColor(m.color);
 if ('metalness' in m) rec.metalness = round(m.metalness);
 if ('roughness' in m) rec.roughness = round(m.roughness);
 if ('flatShading' in m) rec.flatShading = !!m.flatShading;
 if ('emissive' in m) rec.emissive = fpColor(m.emissive);
 if ('emissiveIntensity' in m) rec.emissiveIntensity = round(m.emissiveIntensity);
 if ('map' in m) rec.hasMap = !!m.map;
 if (m.isShaderMaterial && m.uniforms) {
  rec.uniforms = {};
  for (const key of Object.keys(m.uniforms).sort()) {
   const v = m.uniforms[key].value;
   if (v == null) rec.uniforms[key] = null;
   else if (typeof v === 'number') rec.uniforms[key] = round(v);
   else if (v.isColor) rec.uniforms[key] = fpColor(v);
   else if (v.isVector4) rec.uniforms[key] = [v.x, v.y, v.z, v.w].map(round);
   else if (v.isVector3) rec.uniforms[key] = [v.x, v.y, v.z].map(round);
   else if (v.isVector2) rec.uniforms[key] = [v.x, v.y].map(round);
   else if (v.isTexture) rec.uniforms[key] = {texture: true, type: v.type, format: v.format};
   else rec.uniforms[key] = String(v);
  }
 }
 return rec;
}
function fpNode(o) {
 const rec = {
  name: o.name, type: o.type, isInstancedMesh: !!o.isInstancedMesh,
  visible: !!o.visible, position: fpVec3(o.position), quaternion: fpQuat(o.quaternion), scale: fpVec3(o.scale),
  castShadow: !!o.castShadow, receiveShadow: !!o.receiveShadow,
 };
 if (o.geometry) rec.geometry = fpGeometry(o.geometry);
 if (o.material) rec.material = Array.isArray(o.material) ? o.material.map(fpMaterial) : fpMaterial(o.material);
 if (o.isInstancedMesh) {
  rec.count = o.count;
  rec.instanceMatrixHash = sha256(o.instanceMatrix.array);
  if (o.instanceColor) rec.instanceColorHash = sha256(o.instanceColor.array);
 }
 if (o.isLight) {
  rec.color = fpColor(o.color); rec.intensity = round(o.intensity); rec.distance = round(o.distance); rec.decay = round(o.decay);
 }
 return rec;
}
function collect(root, list) { list.push(fpNode(root)); for (const child of root.children) collect(child, list); return list; }
function fpNewChildren(container, before) {
 const list = [];
 for (const child of container.children) if (!before.has(child)) collect(child, list);
 return list;
}
function hashScene(objects, extra) {
 return sha256(Buffer.from(JSON.stringify({objects: sanitize(objects), extra: sanitize(extra)})));
}

// --- Golden hashes captured on the unmodified tree (main @ 0a50a93), before dist/random.js
// and dist/dispose.js were adopted in the scenery tier. Never update a hash to make a test
// pass -- a changed hash means the generated scenery changed, which is the one thing this
// refactor must not do.
const EXPECTED = {
 'createEnvironment(overworld)': '9bc7ac7942349166cf6880c628fdda15b05eb34b3b6b1b9936a467ba0d34e456',
 'createRegionLandmarks(overworld)': '96d449a44795aafa4bea57145a1a16d7b2e39d70ac22f9f5d5b3a60bd55991c8',
 'createRegionEnvironment(drowned-wood)': '11fb950f644352e375bac6b8d00018d4bff41d532239e6f9c917f73df47385cd',
 'createRegionEnvironment(blackvein-quarry)': '239a6684b23e0b8d279a23400adbbd65996459f154dc195f734c22acc72a035a',
 'createRegionEnvironment(crownfall-keep)': '0c0671fdf98ed1a5d5c9cdfe5d73976f255a35480c7bf3e668b75b5877675b8d',
 'createRegionEnvironment(underways)': '24390000f07ffa13688ef250954c9626eb4874819d7d96329c93319ba7f703c2',
 'createRegionEnvironment(moss-hollow)': 'aae0b5487158b30c09b5fb552d9070af0477d42d233480cacd8d83b5cda5544e',
 'createRegionEnvironment(cellar-depths)': '41f84fd2d59b2ca6364a47a02adce7db622b854ec7d0a965db2b5580fba189e9',
 'createRegionEnvironment(gloom-cavern)': 'ec7b04345a685f4fa2a0b5bf30139d2d0db653fffc607bb5411f9092d250da62',
 'createRegionEnvironment(old-road-cellar)': '9a927f4e88852a9d4aeb9af8f377166e60fa441d1f883dfa72f514e68047ce97',
 'createRegionEnvironment(gravekeepers-hollow)': '1c7de6702abaddc2294ddb020e3df51f9deb557d07230e9dda335c6a915688df',
 'createOutlandScenery(overworld)': '5f8abb5d9d6088a7c8fa71de1b81139ade5e8155d2309c38716eb5f5389c2dc2',
 'createCaveScenery(moss-hollow)': '087e5151376afed7b7ceb7ba22c7b3245eeac9d8106f6959ae46b14d4e9231c6',
 'createCaveEntranceScenery(moss-hollow-entrance)': '33b8bfef5b1caadb2d6759fca523996667f31322ad64f3a57da10169c2efb65c',
 'expansion-layout(regions.js maps)': '2b248d4ffadee810a5f84c10e40d6185fd1198c08c03a9e03f2fe16a34b002af',
 'plantOutlands(overworld synthetic)': '25d65aed5558373b93bf1ea1c758a07dedfe5a3cc466e2fe085d1b5de8000ea2',
 'distanceToRoute(samples)': 'e2758b51c0d40f901d6d75922a6feb4e2f23e93715b693330e876c4c1e7e49f2',
};
function record(t, label, hash) {
 t.diagnostic(`${label}: ${hash}`);
 assert.equal(hash, EXPECTED[label], `${label} hash changed -- generated scenery is no longer identical`);
 return hash;
}

test('T1-6 golden: createEnvironment(scene) for the overworld', t => {
 withCanvas(t);
 const scene = new T.Scene();
 const before = new Set(scene.children);
 const environment = Environment.createEnvironment(scene);
 const objects = fpNewChildren(scene, before);
 const hash = hashScene(objects, {obstacles: environment.obstacles, buildingCount: environment.buildings.length});
 record(t, 'createEnvironment(overworld)', hash);
 assert.ok(objects.length > 10);
});

test('T1-6 golden: createRegionLandmarks(scene, "overworld")', t => {
 const scene = new T.Scene();
 const before = new Set(scene.children);
 RegionEnvironment.createRegionLandmarks(scene, 'overworld');
 const objects = fpNewChildren(scene, before);
 const hash = hashScene(objects, null);
 record(t, 'createRegionLandmarks(overworld)', hash);
 assert.ok(objects.length > 0);
});

const GENERIC_IDS = ['drowned-wood', 'blackvein-quarry', 'crownfall-keep', 'underways'];
const CAVE_IDS = ['moss-hollow', 'cellar-depths', 'gloom-cavern', 'old-road-cellar', 'gravekeepers-hollow'];

for (const id of [...GENERIC_IDS, ...CAVE_IDS]) {
 test(`T1-6 golden: createRegionEnvironment(scene, "${id}")`, t => {
  withCanvas(t);
  const scene = new T.Scene();
  const before = new Set(scene.children);
  const env = RegionEnvironment.createRegionEnvironment(scene, id);
  const objects = fpNewChildren(scene, before);
  const hash = hashScene(objects, {obstacles: env.obstacles});
  record(t, `createRegionEnvironment(${id})`, hash);
  assert.ok(objects.length > 0);
 });
}

test('T1-6 golden: createOutlandScenery direct call (overworld map)', t => {
 const scene = new T.Scene();
 const before = new Set(scene.children);
 OutlandScenery.createOutlandScenery(scene, MAPS.overworld);
 const objects = fpNewChildren(scene, before);
 const hash = hashScene(objects, null);
 record(t, 'createOutlandScenery(overworld)', hash);
 assert.ok(objects.length > 0);
});

test('T1-6 golden: createCaveScenery direct call (moss-hollow)', t => {
 withCanvas(t);
 const scene = new T.Scene();
 const before = new Set(scene.children);
 CaveScenery.createCaveScenery(scene, MAPS['moss-hollow']);
 const objects = fpNewChildren(scene, before);
 const hash = hashScene(objects, null);
 record(t, 'createCaveScenery(moss-hollow)', hash);
 assert.ok(objects.length > 0);
});

test('T1-6 golden: createCaveEntranceScenery direct call (moss-hollow-entrance)', t => {
 const portal = PORTALS.find(p => p.id === 'moss-hollow-entrance');
 assert.ok(portal);
 const parent = new T.Group();
 const before = new Set(parent.children);
 CaveEntranceScenery.createCaveEntranceScenery(parent, portal);
 const objects = fpNewChildren(parent, before);
 const hash = hashScene(objects, null);
 record(t, 'createCaveEntranceScenery(moss-hollow-entrance)', hash);
 assert.ok(objects.length > 0);
});

test('T1-6 golden: three consecutive runs of createEnvironment hash identically', t => {
 withCanvas(t);
 const hashes = [1, 2, 3].map(() => {
  const scene = new T.Scene();
  const before = new Set(scene.children);
  const environment = Environment.createEnvironment(scene);
  const objects = fpNewChildren(scene, before);
  return hashScene(objects, {obstacles: environment.obstacles});
 });
 assert.equal(hashes[0], hashes[1]);
 assert.equal(hashes[1], hashes[2]);
});

// --- expansion-layout.js: pure data, no three/dom needed. -----------------------
test('T1-6 golden: expansion-layout obstacles/sites/checkpoints via the real regions.js call chain', t => {
 const ids = ['overworld', 'drowned-wood', 'blackvein-quarry', 'crownfall-keep', 'underways'];
 const data = Object.fromEntries(ids.map(id => {
  const m = MAPS[id];
  return [id, {
   obstacles: m.obstacles, sites: m.sites, checkpoints: m.checkpoints,
   routes: (m.routes || []).map(r => ({width: r.width, style: r.style, points: r.points})),
  }];
 }));
 const hash = hashJSON(data);
 record(t, 'expansion-layout(regions.js maps)', hash);
 assert.ok(data.overworld.obstacles.length > 0);
});

test('T1-6 golden: plantOutlands is a pure function of its inputs (three fresh runs agree)', t => {
 const build = () => {
  const map = {id: 'overworld', bounds: {...OVERWORLD_BOUNDS}, sites: MAPS.overworld.sites, routes: MAPS.overworld.routes, obstacles: []};
  plantOutlands(map);
  return map.obstacles;
 };
 const hashes = [1, 2, 3].map(() => hashJSON(build()));
 assert.equal(hashes[0], hashes[1]);
 assert.equal(hashes[1], hashes[2]);
 record(t, 'plantOutlands(overworld synthetic)', hashes[0]);
});

test('T1-6 golden: distanceToRoute sample distances against the real overworld routes', t => {
 const samples = [{x: 0, z: 0}, {x: -50, z: 10}, {x: 20, z: -20}, {x: -100, z: 50}, {x: -20, z: -30}];
 const result = samples.map(p => Number(distanceToRoute(p, MAPS.overworld.routes).toFixed(6)));
 const hash = hashJSON(result);
 record(t, 'distanceToRoute(samples)', hash);
 assert.ok(result.every(n => Number.isFinite(n)));
});

