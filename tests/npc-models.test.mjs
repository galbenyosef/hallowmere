import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import * as T from '../dist/vendor/three.core.js';
import {createNpcCharacter,NPC_MODEL_IDS} from '../scripts/npc-models.mjs';
import {NPCS} from '../dist/campaign.js';

const main=await readFile(new URL('../dist/main.js',import.meta.url),'utf8');
const utility=await readFile(new URL('../dist/vendor/utils/BufferGeometryUtils.js',import.meta.url),'utf8');
const {mergeGeometries}=await import('data:text/javascript;base64,'+Buffer.from(utility.replace("from 'three'",`from '${new URL('../dist/vendor/three.core.js',import.meta.url).href}'`)).toString('base64'));

test('updated villagers keep complete geometry, grounded feet, and working world rigs after game optimization',()=>{
  const equipment={elder:['astrolabe-staff','archive-volume'],healer:['ward-lantern','apothecary-vial'],smith:['forging-hammer','forge-apron'],watchman:['watch-shield','roadwarden-sword']};
  const context=vm.createContext({T,mergeGeometries,Float32Array,prefabs:{}});
  vm.runInContext(main.slice(main.indexOf('function optimizeModel'),main.indexOf('function spawnEnemy')),context);
  for(const kind of NPC_MODEL_IDS){
    const root=createNpcCharacter(kind),bounds=new T.Box3().setFromObject(root);
    assert.ok(bounds.min.y>=0&&bounds.min.y<.06,`${kind} feet are not grounded`);
    assert.ok(bounds.max.y>2&&bounds.max.y<2.7,`${kind} is outside the actor scale`);
    const triangles=node=>{let total=0;node.traverse(mesh=>{if(mesh.isMesh)total+=(mesh.geometry.index?.count??mesh.geometry.attributes.position.count)/3;});return total;};
    const before=triangles(root);assert.ok(before<45000,`${kind} is too dense for a village actor`);
    context.optimizeModel(root);
    assert.equal(triangles(root),before,`${kind} lost geometry while batching`);
    for(const name of equipment[kind])assert.ok(root.getObjectByName(name),`${kind} lost ${name}`);
    const rig=context.getRig(root);
    assert.equal(rig.baseY,1.25);assert.equal(rig.arms.length,2);assert.equal(rig.legs.length,2);
    assert.equal(root.getObjectByName('head').parent,rig.body);
    root.traverse(node=>{if(!node.geometry)return;for(const attribute of ['position','normal'])assert.ok([...node.geometry.attributes[attribute].array].every(Number.isFinite));});
  }
  assert.equal(NPCS.find(npc=>npc.id==='rook').model,'watchman');
  assert.throws(()=>createNpcCharacter('missing'),/Unknown villager/);
});
