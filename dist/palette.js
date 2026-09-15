import * as T from 'three';

// One `Object.fromEntries(Object.entries(colors).map(...))` palette builder for the
// scenery tier. `params(key,color)` supplies each site's extra MeshStandardMaterial
// fields; original → options:
//  cave-entrance-scenery.js  params:()=>({roughness:1,flatShading:true})
//  cave-scenery.js           params:key=>({roughness:key==='water'?.22:.93,...(emissive by key)})
//  outland-scenery.js        params:id=>({roughness:id==='water'?.3:.96})
export function createPalette(colors,{materialType=T.MeshStandardMaterial,params=()=>({})}={}){
 return Object.fromEntries(Object.entries(colors).map(([key,color])=>[key,new materialType({color,...params(key,color)})]));
}
