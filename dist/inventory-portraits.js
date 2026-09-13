import * as T from './vendor/three.module.js';
import {roster} from './character-study-roster.js';
import {createStudyScene,disposeStudy} from './character-study-models.js';
import {createPlayableCharacter} from './playable-characters.js';
import {conceptFor} from './classes.js';
import {inventoryPortraits} from './character-art.js';

const preparations=new Map();
const WIDTH=840,HEIGHT=880;

// Use the exact gameplay rig, including its scale and held-item attachments.
// Bounds in camera space keep wide bows, long staffs, and tall hats in frame.
export function createInventoryStudy(classId,appearanceId){
  const concept=roster.find(c=>c.id===conceptFor(classId,appearanceId));
  if(!concept)throw Error('Unknown inventory character');
  const study=createStudyScene(concept,createPlayableCharacter(classId,appearanceId));
  const lights=study.scene.children.filter(node=>node.isLight);
  lights[0].intensity=1.3;
  lights[1].intensity=2.35;
  lights[2].intensity=2.1;
  lights[3].intensity=1.25;
  const camera=new T.OrthographicCamera(-2,2,2,-2,.1,30);
  const bounds=new T.Box3().setFromObject(study.scene),center=bounds.getCenter(new T.Vector3());
  camera.position.copy(center).add(new T.Vector3(3.2,2.5,6.2));
  camera.lookAt(center);camera.updateMatrixWorld(true);
  const frame=new T.Box3(),vertex=new T.Vector3();
  study.scene.traverse(node=>{
    const positions=node.geometry?.getAttribute('position');
    if(!positions)return;
    for(let i=0;i<positions.count;i++){
      vertex.fromBufferAttribute(positions,i).applyMatrix4(node.matrixWorld).applyMatrix4(camera.matrixWorldInverse);
      frame.expandByPoint(vertex);
    }
  });
  const aspect=WIDTH/HEIGHT,halfHeight=Math.max((frame.max.y-frame.min.y)/2,(frame.max.x-frame.min.x)/2/aspect)*1.055;
  const cx=(frame.min.x+frame.max.x)/2,cy=(frame.min.y+frame.max.y)/2;
  Object.assign(camera,{left:cx-halfHeight*aspect,right:cx+halfHeight*aspect,top:cy+halfHeight,bottom:cy-halfHeight});
  camera.updateProjectionMatrix();
  return{...study,camera};
}

export function prepareInventoryPortrait(classId,appearanceId){
  const key=conceptFor(classId,appearanceId);
  if(preparations.has(key))return preparations.get(key);
  inventoryPortraits.set(key,{status:'loading'});
  const preparation=new Promise(resolve=>setTimeout(resolve,0)).then(()=>{
    let renderer,study;
    try{
      study=createInventoryStudy(classId,appearanceId);
      renderer=new T.WebGLRenderer({antialias:true,alpha:true});
      renderer.setSize(WIDTH,HEIGHT,false);renderer.setPixelRatio(1);
      renderer.setClearColor(0x09131d,0);
      renderer.outputColorSpace=T.SRGBColorSpace;
      renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.12;
      renderer.shadowMap.enabled=true;renderer.shadowMap.type=T.PCFSoftShadowMap;
      renderer.render(study.scene,study.camera);
      const url=renderer.domElement.toDataURL('image/png');
      inventoryPortraits.set(key,{status:'ready',url});
      return url;
    }catch(error){
      inventoryPortraits.set(key,{status:'error'});
      throw error;
    }finally{
      if(study)disposeStudy(study);
      if(renderer){renderer.dispose();renderer.forceContextLoss();}
    }
  });
  preparations.set(key,preparation);
  return preparation;
}
