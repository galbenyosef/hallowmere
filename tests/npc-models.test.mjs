import test from 'node:test';
import assert from 'node:assert/strict';
import {registerHooks} from 'node:module';
import * as T from '../dist/vendor/three.core.js';
import {createNpcCharacter,NPC_MODEL_IDS} from '../scripts/npc-models.mjs';
import {NPCS} from '../dist/campaign.js';

// dist/model-kit.js imports the bare 'three' specifier and 'three/addons/utils/BufferGeometryUtils.js',
// which only the page's <script type="importmap"> can resolve; match the game's import map while
// loading it in Node, the same pattern tests/npc-portraits.test.mjs uses for GLTFLoader.js.
const hook = registerHooks({resolve(specifier, context, nextResolve) {
  if (specifier === 'three') return nextResolve(new URL('../dist/vendor/three.module.js', import.meta.url).href, context);
  if (specifier === 'three/addons/utils/BufferGeometryUtils.js') return nextResolve(new URL('../dist/vendor/utils/BufferGeometryUtils.js', import.meta.url).href, context);
  return nextResolve(specifier, context);
}});
const {optimizeModel,getRig} = await import('../dist/model-kit.js');
hook.deregister();

test('updated villagers keep complete geometry, grounded feet, and working world rigs after game optimization',()=>{
  const equipment={elder:['astrolabe-staff','archive-volume'],healer:['ward-lantern','apothecary-vial'],smith:['forging-hammer','forge-apron'],watchman:['watch-shield','roadwarden-sword']};
  for(const kind of NPC_MODEL_IDS){
    const root=createNpcCharacter(kind),bounds=new T.Box3().setFromObject(root);
    assert.ok(bounds.min.y>=0&&bounds.min.y<.06,`${kind} feet are not grounded`);
    assert.ok(bounds.max.y>2&&bounds.max.y<2.7,`${kind} is outside the actor scale`);
    const triangles=node=>{let total=0;node.traverse(mesh=>{if(mesh.isMesh)total+=(mesh.geometry.index?.count??mesh.geometry.attributes.position.count)/3;});return total;};
    const before=triangles(root);assert.ok(before<45000,`${kind} is too dense for a village actor`);
    optimizeModel(root);
    assert.equal(triangles(root),before,`${kind} lost geometry while batching`);
    for(const name of equipment[kind])assert.ok(root.getObjectByName(name),`${kind} lost ${name}`);
    const rig=getRig(root);
    assert.equal(rig.baseY,1.25);assert.equal(rig.arms.length,2);assert.equal(rig.legs.length,2);
    assert.equal(root.getObjectByName('head').parent,rig.body);
    root.traverse(node=>{if(!node.geometry)return;for(const attribute of ['position','normal'])assert.ok([...node.geometry.attributes[attribute].array].every(Number.isFinite));});
  }
  assert.equal(NPCS.find(npc=>npc.id==='rook').model,'watchman');
  assert.throws(()=>createNpcCharacter('missing'),/Unknown villager/);
});
