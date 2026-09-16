import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {registerHooks} from 'node:module';
import * as T from '../dist/vendor/three.module.js';
import {NPCS} from '../dist/campaign.js';

// Match the game's import map while loading its real GLB assets in Node. dist/npc-portraits.js
// also needs this: it imports the bare 'three' specifier (it needs WebGLRenderer, which only
// the full build exports).
const hook = registerHooks({resolve(specifier, context, nextResolve) {
  return nextResolve(specifier === 'three' ? new URL('../dist/vendor/three.module.js', import.meta.url).href : specifier, context);
}});
const {GLTFLoader} = await import('../dist/vendor/loaders/GLTFLoader.js');
const {createNpcPortraitStudy, npcPortraitFor} = await import('../dist/npc-portraits.js');
hook.deregister();

test('every speaking villager uses an unchanged gameplay model with all geometry inside the portrait', async () => {
  for (const npc of NPCS) {
    const bytes = await readFile(new URL(`../dist/assets/models/${npc.model}.glb`, import.meta.url));
    const {scene:prefab} = await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), '');
    const before = JSON.stringify(prefab.toJSON()), study = createNpcPortraitStudy(prefab);
    assert.notEqual(study.root, prefab);
    assert.equal(JSON.stringify(prefab.toJSON()), before, `${npc.name}'s world model changed`);
    let vertices = 0;
    const vertex = new T.Vector3();
    study.root.traverseVisible(node => {
      const positions = node.geometry?.getAttribute('position');
      if (!positions) return;
      assert.equal(node.geometry, prefab.getObjectByName(node.name)?.geometry);
      for (let i = 0; i < positions.count; i++) {
        vertex.fromBufferAttribute(positions, i).applyMatrix4(node.matrixWorld).project(study.camera);
        assert.ok(Math.abs(vertex.x) < 1 && Math.abs(vertex.y) < 1 && Math.abs(vertex.z) < 1, `${npc.name} is clipped`);
        vertices++;
      }
    });
    assert.ok(vertices > 1000);
    study.scene.clear();
    assert.equal(JSON.stringify(prefab.toJSON()), before);
  }
  assert.equal(npcPortraitFor(undefined), null);
});
