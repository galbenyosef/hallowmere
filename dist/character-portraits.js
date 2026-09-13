import * as T from 'three';
import {roster} from './character-study-roster.js';
import {createStudyScene,disposeStudy} from './character-study-models.js';
import {createPlayableCharacter} from './playable-characters.js';
import {CLASS_LIST,CLASSES,SORCERER_APPEARANCES,conceptFor} from './classes.js';

import {characterPortraits as portraits,weaponPortraits as weapons} from './character-art.js';
export {portraitFor,weaponPortraitFor} from './character-art.js';
let preparation;
export function prepareCharacterPortraits(){return preparation??=build();}
async function build(){
 const renderer=new T.WebGLRenderer({antialias:true,alpha:true,preserveDrawingBuffer:true});renderer.setSize(420,440,false);renderer.setPixelRatio(1);renderer.setClearColor(0x101d23,0);renderer.outputColorSpace=T.SRGBColorSpace;renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.05;
 const camera=new T.OrthographicCamera(-1.7,1.7,1.8,-1.8,.1,25);camera.position.set(3.2,3.2,6.2);camera.lookAt(0,1.27,0);
 const choices=[...Object.keys(SORCERER_APPEARANCES).map(id=>['sorcerer',id]),...CLASS_LIST.filter(c=>c.id!=='sorcerer').map(c=>[c.id,c.concept])];
 try{for(const [classId,appearanceId] of choices){
  const id=conceptFor(classId,appearanceId),model=createPlayableCharacter(classId,appearanceId),concept=roster.find(c=>c.id===id);
  const study=concept?createStudyScene(concept):createStudyScene(CLASSES[classId],model);
  // Use study scale for portraits, with a taller silhouette for Geralt.
  study.root.scale.set(1,classId==='geralt'?1.12:1,1);
  renderer.render(study.scene,camera);portraits.set(id,renderer.domElement.toDataURL('image/png'));
  const weapon=model.getObjectByName('weapon');
  if(weapon){const item=weapon.clone(true);item.position.set(0,0,0);item.rotation.set(0,0,0);study.root.visible=false;study.scene.add(item);
   const bounds=new T.Box3().setFromObject(item),size=bounds.getSize(new T.Vector3()),center=bounds.getCenter(new T.Vector3());item.position.sub(center);item.position.y+=1.25;
   const extent=Math.max(size.x,size.y,size.z)*.68+.1,cam=new T.OrthographicCamera(-extent,extent,extent,-extent,.1,20);cam.position.set(2,2.6,5);cam.lookAt(0,1.25,0);
   // Hide the study's pedestal for clean equipment imagery.
   const original=study.scene.children.filter(n=>n.isMesh);original.forEach(n=>n.visible=false);
   renderer.render(study.scene,cam);weapons.set(id,renderer.domElement.toDataURL('image/png'));study.scene.remove(item);
  }
  study.scene.add(model);disposeStudy(study);
  await new Promise(resolve=>setTimeout(resolve,0));
 }}finally{renderer.dispose();}
}
