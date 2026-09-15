import * as T from './vendor/three.module.js';

// Frames every mesh under root inside camera's orthographic bounds: projects each
// vertex through camera.matrixWorldInverse into a Box3, then pads the tighter of the
// box's height or aspect-scaled width by `pad`. camera must already be positioned
// (position + lookAt + updateMatrixWorld) before this runs. `visibleOnly` selects
// traverseVisible over traverse for callers that must skip hidden nodes.
export function fitOrthographicCamera(camera,root,aspect,{pad,visibleOnly}={}){
  const frame=new T.Box3(),vertex=new T.Vector3();
  const visit=node=>{
    const positions=node.geometry?.getAttribute('position');
    if(!positions)return;
    for(let i=0;i<positions.count;i++){
      vertex.fromBufferAttribute(positions,i).applyMatrix4(node.matrixWorld).applyMatrix4(camera.matrixWorldInverse);
      frame.expandByPoint(vertex);
    }
  };
  if(visibleOnly)root.traverseVisible(visit);else root.traverse(visit);
  const halfHeight=Math.max((frame.max.y-frame.min.y)/2,(frame.max.x-frame.min.x)/2/aspect)*pad;
  const cx=(frame.min.x+frame.max.x)/2,cy=(frame.min.y+frame.max.y)/2;
  Object.assign(camera,{left:cx-halfHeight*aspect,right:cx+halfHeight*aspect,top:cy+halfHeight,bottom:cy-halfHeight});
  camera.updateProjectionMatrix();
}
