import * as T from './vendor/three.core.js';
import {roster} from './character-study-roster.js';
import {createCharacter} from './character-study-models.js';
import {conceptFor} from './classes.js';

export function createPlayableCharacter(classId,appearanceId){
 const concept=roster.find(c=>c.id===conceptFor(classId,appearanceId));if(!concept)throw Error('Unknown playable character');
 const root=createCharacter(concept),body=root.getObjectByName('body');
 // Study geometry uses absolute heights. Move the body pivot to the waist while
 // preserving its rest pose, then attach held items to the animated hand groups.
 for(const child of body.children)child.position.y-=1.3;
 body.position.y=1.3;body.userData.baseY=1.3;root.updateMatrixWorld(true);
 const right=body.getObjectByName('armR'),left=body.getObjectByName('armL');
 for(const child of [...root.children]){
  if(child===body||child.name.startsWith('leg'))continue;
  if(child.position.x>.45){child.name='weapon';right.attach(child);}
  else if(child.position.x<-.45){child.name='offhand';left.attach(child);}
  else{if(child.position.y>1.8)child.name='head';body.attach(child);}
 }
 root.scale.setScalar(.9);root.name=concept.name;
 delete root.userData.materials;
 root.userData.characterConcept=concept.id;
 return root;
}
export function modelBounds(root){return new T.Box3().setFromObject(root);}
