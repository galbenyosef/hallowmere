import * as T from 'three';
import {createGeraltCharacter} from './geralt-character-model.js';

const $ = id => document.getElementById(id);
const stage = $('model-stage');
const canvas = $('character-canvas');
const viewButtons = [...document.querySelectorAll('[data-view]')];
const poseButtons = [...document.querySelectorAll('[data-pose]')];
const controls = [...viewButtons, ...poseButtons, $('rotate-left'), $('rotate-right'), $('reset-view')];
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
const views = {
  'three-quarter': {label: 'Three-quarter view', rotation: -.48, eye: [0, 2.8, 7], target: [0, 1.15, 0], span: 2.85},
  front: {label: 'Front view', rotation: 0, eye: [0, 1.2, 7], target: [0, 1.2, 0], span: 2.9},
  side: {label: 'Side view', rotation: -Math.PI / 2, eye: [0, 1.2, 7], target: [0, 1.2, 0], span: 2.9},
  back: {label: 'Back view', rotation: Math.PI, eye: [0, 1.2, 7], target: [0, 1.2, 0], span: 2.9},
  face: {label: 'Face & hair', rotation: -.22, eye: [0, 2.02, 5], target: [0, 2.01, 0], span: .79},
  game: {label: 'Isometric game view', rotation: 0, eye: [17, 25, 26], target: [0, 1.0, 0], span: 9}
};
const poses = {
  sheathed: ['All weapons sheathed', 'Both swords rest on the back. The dagger sits at the hip.'],
  steel: ['Steel sword drawn', 'Steel sword in the right hand. Its back sheath stays empty; silver and dagger remain sheathed.'],
  silver: ['Silver sword drawn', 'Silver sword in the right hand. Its back sheath stays empty; steel and dagger remain sheathed.'],
  dagger: ['Dagger drawn', 'Dagger in the right hand. Its hip sheath stays empty; both swords remain on the back.']
};
let renderer, scene, camera, character, frame = 0, activeView = 'three-quarter', pointer = null, stopped = false;
let resizeObserver;
const ownedGeometries = [], ownedMaterials = [];
controls.forEach(button => button.disabled = true);

function platform() {
  const g = new T.Group(); g.name = 'study-platform';
  function add(geometry, material, x, y, z) {
    ownedGeometries.push(geometry); ownedMaterials.push(material);
    const object = new T.Mesh(geometry, material); object.position.set(x, y, z); object.receiveShadow = true; g.add(object); return object;
  }
  const stone = new T.MeshStandardMaterial({color: '#26383c', roughness: .98, flatShading: true});
  add(new T.CylinderGeometry(.89, .95, .12, 40), stone, 0, -.065, 0);
  const brass = new T.MeshStandardMaterial({color: '#82795f', metalness: .5, roughness: .6});
  const rim = add(new T.TorusGeometry(.91, .008, 4, 64), brass, 0, -.005, 0); rim.rotation.x = Math.PI / 2;
  for (let i = 0; i < 12; i++) {
    const angle = i * Math.PI / 6;
    const tick = add(new T.BoxGeometry(.006, .004, i % 3 ? .04 : .085), brass, Math.sin(angle) * .84, .001, Math.cos(angle) * .84); tick.rotation.y = angle;
  }
  const ground = add(new T.PlaneGeometry(200, 200), new T.ShadowMaterial({opacity: .22}), 0, -.129, 0); ground.rotation.x = -Math.PI / 2;
  return g;
}
function render() {
  frame = 0;
  if (document.hidden || stopped || !renderer) return;
  renderer.render(scene, camera);
}
function requestRender() {
  if (!frame && !document.hidden && !stopped) frame = requestAnimationFrame(render);
}
function resize() {
  if (!renderer || stopped) return;
  const {width, height} = stage.getBoundingClientRect();
  if (!width || !height) return;
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
  renderer.setSize(width, height, false);
  const view = views[activeView], aspect = width / height;
  // Preserve full-body and drawn-weapon width on narrow screens.
  const swordDrawn = character.pose === 'steel' || character.pose === 'silver';
  const minimumWidth = activeView === 'face' ? .72 : activeView === 'game' ? 4 : swordDrawn ? 3.2 : 2.1;
  const span = Math.max(view.span, minimumWidth / aspect);
  camera.left = -span * aspect / 2; camera.right = span * aspect / 2;
  camera.top = span / 2; camera.bottom = -span / 2;
  camera.position.set(...view.eye); camera.lookAt(...view.target); camera.updateProjectionMatrix();
  requestRender();
}
function setView(view) {
  activeView = view;
  character.root.rotation.y = views[view].rotation;
  $('view-label').textContent = views[view].label;
  $('scale-indicator').textContent = view === 'game' ? 'Game-scale readability' : view === 'face' ? 'Likeness detail' : 'Character detail';
  viewButtons.forEach(button => button.setAttribute('aria-pressed', String(button.dataset.view === view)));
  resize();
}
function rotate(amount) {
  if (stopped || !character) return;
  character.root.rotation.y += amount;
  $('view-label').textContent = 'Custom angle';
  viewButtons.forEach(button => button.setAttribute('aria-pressed', 'false'));
  requestRender();
}
function setPose(pose) {
  character.setPose(pose);
  poseButtons.forEach(button => button.setAttribute('aria-pressed', String(button.dataset.pose === pose)));
  $('pose-label').textContent = poses[pose][0]; $('equipment-caption').textContent = poses[pose][1];
  resize();
}
function fail(message) {
  stopped = true; cancelAnimationFrame(frame); frame = 0;
  controls.forEach(button => button.disabled = true);
  $('viewer-message').hidden = false; $('viewer-message').textContent = message;
}
function dispose() {
  stopped = true; cancelAnimationFrame(frame); frame = 0;
  resizeObserver?.disconnect(); character?.dispose();
  new Set(ownedGeometries).forEach(geometry => geometry.dispose());
  new Set(ownedMaterials).forEach(material => material.dispose());
  scene?.traverse(object => {if (object.isLight) object.dispose?.();});
  renderer?.dispose();
}

try {
  renderer = new T.WebGLRenderer({canvas, antialias: true, alpha: true, powerPreference: 'low-power'});
  renderer.setClearColor(0x0d1b21, 0);
  renderer.outputColorSpace = T.SRGBColorSpace;
  renderer.toneMapping = T.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.03;
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = T.PCFSoftShadowMap;
  scene = new T.Scene(); camera = new T.OrthographicCamera(-2, 2, 2, -2, .1, 100);
  scene.add(new T.HemisphereLight(0xc3d5df, 0x4a4235, 1.8));
  const key = new T.DirectionalLight(0xd0e2f3, 3.4); key.position.set(-3, 6, 5); key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024); Object.assign(key.shadow.camera, {left:-3,right:3,top:4,bottom:-3,near:.1,far:18}); key.shadow.normalBias = .02; key.shadow.bias = -.0003; scene.add(key);
  const fill = new T.DirectionalLight(0xf3d6ab, 1.05); fill.position.set(3, 3, 4); scene.add(fill);
  const rim = new T.DirectionalLight(0x8eb8c6, 2.1); rim.position.set(2, 4, -4); scene.add(rim);
  scene.add(platform()); character = createGeraltCharacter(); scene.add(character.root);
  setView('three-quarter');
  controls.forEach(button => button.disabled = false); $('viewer-message').hidden = true;
  resizeObserver = new ResizeObserver(resize); resizeObserver.observe(stage);
} catch (error) {
  console.error('Geralt study could not initialize:', error);
  dispose(); fail('The 3D preview could not start. Enable WebGL and reload this page. You can still review the appearance and equipment notes.');
}

viewButtons.forEach(button => button.addEventListener('click', () => setView(button.dataset.view)));
poseButtons.forEach(button => button.addEventListener('click', () => setPose(button.dataset.pose)));
$('rotate-left').addEventListener('click', () => rotate(-Math.PI / 6));
$('rotate-right').addEventListener('click', () => rotate(Math.PI / 6));
$('reset-view').addEventListener('click', () => {setPose('sheathed'); setView('three-quarter');});
stage.addEventListener('keydown', event => {
  if (stopped) return;
  if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
    event.preventDefault(); rotate((event.key === 'ArrowLeft' ? -1 : 1) * Math.PI / 12);
  } else if (event.key === 'Home') {event.preventDefault(); setView('three-quarter');}
});
stage.addEventListener('pointerdown', event => {
  if (stopped || !event.isPrimary || event.button !== 0) return;
  pointer = {id:event.pointerId,x:event.clientX}; stage.setPointerCapture(event.pointerId);
});
stage.addEventListener('pointermove', event => {
  if (pointer?.id !== event.pointerId) return;
  rotate((event.clientX - pointer.x) * .012); pointer.x = event.clientX;
});
for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) stage.addEventListener(type, () => {pointer = null;});
// Render only when a view, pose, or viewport changes. No automatic motion or
// perpetual animation loop, including when reduced motion is requested.
reducedMotion.addEventListener('change', requestRender);
document.addEventListener('visibilitychange', () => {
  pointer = null;
  if (document.hidden) {cancelAnimationFrame(frame); frame = 0;} else requestRender();
});
canvas.addEventListener('webglcontextlost', event => {event.preventDefault(); fail('The 3D view lost its graphics connection. Reload this page to restore the character.');});
window.addEventListener('pagehide', event => {if (!event.persisted) dispose();});
window.addEventListener('pageshow', event => {if (event.persisted) resize();});
