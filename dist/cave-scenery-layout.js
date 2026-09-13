// Outdoor cave terrain is shared by rendering and both game simulations.
// All offsets are measured from the mouth; positive z is the open approach.
export function caveSceneryFor(portal){
 const outdoor=['overworld','drowned-wood','blackvein-quarry','crownfall-keep'].includes(portal.mapId);
 if(!outdoor||portal.appearance==='stairs'||!(portal.appearance==='cave'||portal.hidden))return null;
 const crag=portal.id==='gloom-cavern-entrance'||portal.mapId==='blackvein-quarry'||portal.mapId==='crownfall-keep';
 const mouthZ=portal.z-(portal.appearance==='cave'?1.2:0);
 const shapes=crag?[
  [0,-3.3,8.8,5.2,5.8],[-3.35,-.7,3.4,2.7,3.8],[3.3,-.9,3.3,3.2,4.2]
 ]:[
  [0,-2.8,7.8,4.2,4.7],[-2.9,-.5,2.7,2.2,3.2],[3,-.8,2.8,2.7,3.7]
 ];
 const hills=shapes.map(([x,z,w,h,d],i)=>({id:`${portal.id}-hill-${i}`,x:portal.x+x,z:mouthZ+z,w,h,d}));
 return{mouthZ,crag,hills};
}

export function caveSceneryObstacles(portal){
 const scenery=caveSceneryFor(portal);
 if(!scenery)return[];
 return scenery.hills.map(({id,x,z,w,d})=>({id,x,z,w,d}));
}
