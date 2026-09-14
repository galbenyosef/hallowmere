import {OUTLAND_BUILDINGS} from './expansion-layout.js';
// Rendering and navigation share these dimensions, including each rotated wall.
export const BUILDING_SPECS=[
 ['west-cottage','Weaver’s Cottage',-12,-4,6,6.8,3.35,.08],
 ['west-lodge','Old Road Lodge',-12,9,5.8,6.8,3.25,-.09],
 ['east-cottage','Candlekeeper’s House',12,2,5.8,7.4,3.7,-.12],
 ['east-manor','Mourner’s House',13,-12.5,5.6,6.8,3.45,.08],
 ['grave-house','Gravedigger’s Cottage',-12,-17.5,5.7,6.6,3.5,0],
 ['south-house','Abandoned House',13,15,5.2,5.5,3.1,0],
 ['chapel','Hallowmere Chapel',0,-18.5,7.1,8.2,4.1,0,true],
 ['ashwick-hearth','Ashwick Hearth',-73,-3,5.2,5.2,3,.06],
 ['ashwick-inn','The Lantern Inn',-63,-4,5.3,5.5,3.2,-.07],
 ['ashwick-west','Wayfarer’s Cottage',-75,14,5.1,5.5,2.9,0],
 ['ashwick-east','Oakbeam House',-63,14.5,5.2,5.5,3.1,.05],
 ['gatehouse','Rook’s Gatehouse',-23,-2,4.4,4.4,2.7,0]
].map(([id,name,x,z,w,d,h,rotation,chapel=false])=>({id,name,x,z,w,d,h,rotation,chapel,abandoned:['west-lodge','grave-house','south-house'].includes(id)}));
BUILDING_SPECS.push(...OUTLAND_BUILDINGS);
export function buildingWorld(b,x,z){const c=Math.cos(b.rotation),s=Math.sin(b.rotation);return{x:b.x+c*x+s*z,z:b.z-s*x+c*z};}
export function buildingLocal(b,p){const c=Math.cos(b.rotation),s=Math.sin(b.rotation),x=p.x-b.x,z=p.z-b.z;return{x:c*x-s*z,z:s*x+c*z};}
export function insideBuilding(b,p,inset=.12){const q=buildingLocal(b,p);return Math.abs(q.x)<b.w/2-inset&&Math.abs(q.z)<b.d/2-inset;}
export function createBuildingLayout(spec){
 const b={...spec},thickness=.3,doorWidth=b.chapel?2.2:1.8,side=(b.w-doorWidth)/2;
 const walls=[{x:-b.w/2+thickness/2,z:0,w:thickness,d:b.d},{x:b.w/2-thickness/2,z:0,w:thickness,d:b.d},{x:0,z:-b.d/2+thickness/2,w:b.w,d:thickness},{x:-(doorWidth+side)/2,z:b.d/2-thickness/2,w:side,d:thickness},{x:(doorWidth+side)/2,z:b.d/2-thickness/2,w:side,d:thickness}];
 const furniture=b.chapel?[
  {kind:'altar',x:0,z:-b.d/2+1.05,w:2.2,d:.85},
  ...[-1,1].flatMap(side=>[-.7,1.25].map(z=>({kind:'pew',x:side*b.w*.29,z,w:1.4,d:.55})))
 ]:[{kind:'bed',x:-b.w/2+1,z:-b.d/2+1.6,w:1.15,d:2.05},{kind:'table',x:b.w/2-1.1,z:-.3,w:1.05,d:1.15},{kind:'hearth',x:.3,z:-b.d/2+.45,w:1.3,d:.6}];
 const collider=(item,kind)=>({...buildingWorld(b,item.x,item.z),w:item.w,d:item.d,rotation:b.rotation,cos:Math.cos(b.rotation),sin:Math.sin(b.rotation),buildingId:b.id,kind});
 const doorCollider={...collider({x:0,z:b.d/2-thickness/2,w:doorWidth,d:thickness},'door'),disabled:!b.chapel};
 return {...b,doorWidth,walls,furniture,door:buildingWorld(b,0,b.d/2+.08),entry:buildingWorld(b,0,b.d/2-1.35),exit:buildingWorld(b,0,b.d/2+1.25),doorCollider,obstacles:[...walls.map(w=>collider(w,'wall')),...furniture.map(f=>collider(f,'furniture')),doorCollider]};
}
export function setBuildingAccess(buildings,bossDefeated){for(const b of buildings)b.doorCollider.disabled=!b.chapel||bossDefeated;}
