import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from '../dist/vendor/three.core.js';
import {CLASS_LIST,SORCERER_APPEARANCES,conceptFor,applyClass} from '../dist/classes.js';
import {createInventoryStudy} from '../dist/inventory-portraits.js';
import {createPlayableCharacter} from '../dist/playable-characters.js';
import {disposeStudy} from '../dist/character-study-models.js';
import {inventoryPortraits,characterPortraits} from '../dist/character-art.js';
import {inventoryMarkup} from '../dist/inventory.js';
import {createState} from '../dist/combat.js';
import {createCampaign} from '../dist/campaign.js';

const choices=[...Object.keys(SORCERER_APPEARANCES).map(id=>['sorcerer',id]),...CLASS_LIST.filter(c=>c.id!=='sorcerer').map(c=>[c.id,c.concept])];

test('all inventory portraits preserve gameplay geometry and materials and frame every visible vertex',()=>{
  for(const [classId,appearanceId] of choices){
    const study=createInventoryStudy(classId,appearanceId),gameplay=createPlayableCharacter(classId,appearanceId);
    const signature=root=>{
      const meshes=[];
      root.traverse(node=>{if(node.isMesh)meshes.push([node.geometry.getAttribute('position').count,node.material.color.getHex(),node.material.emissive.getHex()]);});
      return meshes;
    };
    assert.equal(study.root.userData.characterConcept,conceptFor(classId,appearanceId));
    assert.deepEqual(signature(study.root),signature(gameplay));
    assert.deepEqual(study.root.scale.toArray(),gameplay.scale.toArray());
    assert.equal(study.root.getObjectByName('weapon').parent.name,'armR');
    const vertex=new T.Vector3();
    study.scene.traverse(node=>{
      const positions=node.geometry?.getAttribute('position');
      if(!positions)return;
      for(let i=0;i<positions.count;i++){
        vertex.fromBufferAttribute(positions,i).applyMatrix4(node.matrixWorld).project(study.camera);
        assert.ok(Math.abs(vertex.x)<1&&Math.abs(vertex.y)<1,`${classId}/${appearanceId} is clipped`);
      }
    });
    study.scene.add(gameplay);disposeStudy(study);
  }
});

test('portrait loading, failure, and cache lookup never show another class or Sorcerer appearance',()=>{
  const state={...createState(),...createCampaign(42)};
  applyClass(state,'sorcerer','W06');
  characterPortraits.set('C01','wrong-sorcerer.png');
  try{
    let markup=inventoryMarkup(state);
    assert.match(markup,/Preparing character preview/);
    assert.doesNotMatch(markup,/wrong-sorcerer|inventory\/(warden|sword).png/);
    inventoryPortraits.set('W06',{status:'error'});
    assert.match(inventoryMarkup(state),/Character preview unavailable/);
    characterPortraits.set('W06','matching-roster.png');
    assert.match(inventoryMarkup(state),/matching-roster.png/);
    inventoryPortraits.set('W06',{status:'ready',url:'matching-inventory.png'});
    markup=inventoryMarkup(state);
    assert.match(markup,/matching-inventory.png/);
    assert.doesNotMatch(markup,/matching-roster.png/);
    applyClass(state,'ranger');
    assert.doesNotMatch(inventoryMarkup(state),/matching-inventory.png|matching-roster.png/);
  }finally{inventoryPortraits.clear();characterPortraits.clear();}
});
