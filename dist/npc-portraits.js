import * as T from 'three';
import {fitOrthographicCamera} from './portrait-fit.js';

const portraits = new WeakMap();
const WIDTH = 720, HEIGHT = 960;

// Clone the loaded villager so framing never moves or reposes the world actor.
// Geometry and materials remain shared and must not be disposed by this study.
export function createNpcPortraitStudy(prefab) {
  const root = prefab.clone(true), scene = new T.Scene();
  scene.add(root, new T.HemisphereLight(0xc2d7df, 0x514135, 2));
  const key = new T.DirectionalLight(0xffe0b2, 3.2);
  key.position.set(-3, 5, 6);
  const rim = new T.DirectionalLight(0x8dbbd5, 2.6);
  rim.position.set(4, 3, -3);
  scene.add(key, rim);
  scene.updateMatrixWorld(true);
  const bounds = new T.Box3().setFromObject(root), center = bounds.getCenter(new T.Vector3());
  if (bounds.isEmpty()) throw new Error('Villager model has no visible geometry');
  const camera = new T.OrthographicCamera(-2, 2, 2, -2, .1, 40);
  camera.position.copy(center).add(new T.Vector3(-2.7, 1.1, 7));
  camera.lookAt(center);
  camera.updateMatrixWorld(true);
  fitOrthographicCamera(camera, root, WIDTH / HEIGHT, {pad: 1.065, visibleOnly: true});
  return {scene, root, camera};
}

// A static transparent portrait needs no second animation loop or retained GPU
// context. Cache by the actual prefab, including a graceful failure result.
export function npcPortraitFor(prefab) {
  if (!prefab) return null;
  if (portraits.has(prefab)) return portraits.get(prefab);
  let renderer, study, url = null;
  try {
    study = createNpcPortraitStudy(prefab);
    renderer = new T.WebGLRenderer({antialias:true, alpha:true});
    renderer.setSize(WIDTH, HEIGHT, false);
    renderer.setPixelRatio(1);
    renderer.setClearColor(0x000000, 0);
    renderer.outputColorSpace = T.SRGBColorSpace;
    renderer.toneMapping = T.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.12;
    renderer.render(study.scene, study.camera);
    url = renderer.domElement.toDataURL('image/png');
  } catch (error) {
    console.warn('Villager portrait unavailable', error);
  } finally {
    study?.scene.clear();
    if (renderer) { renderer.dispose(); renderer.forceContextLoss(); }
  }
  portraits.set(prefab, url);
  return url;
}
