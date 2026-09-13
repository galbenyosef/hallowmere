import * as T from 'three';
import {MAPS,PORTALS,mapFor,availablePortal} from './regions.js';
import {createCaveEntranceEffect} from './cave-entrance-effects.js';

const palettes={
 'drowned-wood':{ground:0x273d37,stone:0x4e6052,dark:0x243129,trim:0x8b9564,glow:0x8fc4a1},
 'blackvein-quarry':{ground:0x3b3835,stone:0x666058,dark:0x302b29,trim:0xa4916b,glow:0xffb06b},
 'crownfall-keep':{ground:0x35353a,stone:0x67676c,dark:0x303039,trim:0xa99b75,glow:0xee9b61},
 cave:{ground:0x252b2a,stone:0x505956,dark:0x171e20,trim:0x6b8171,glow:0xa4c7a0},
 underways:{ground:0x292d31,stone:0x4b4e54,dark:0x20252a,trim:0x7a9295,glow:0x8bbac5},
 overworld:{ground:0x39423b,stone:0x646c63,dark:0x263530,trim:0xa59a70,glow:0x92bea4}
};
function kit(scene,mapId){
 const group=new T.Group();group.name=`region-${mapId}`;scene.add(group);const p=palettes[mapFor(mapId).theme]||palettes[mapId]||palettes.overworld;
 const materials={};for(const [key,color] of Object.entries(p))materials[key]=new T.MeshStandardMaterial({color,roughness:.95,...(key==='glow'?{emissive:color,emissiveIntensity:1.6}:{})});
 const geometries={box:new T.BoxGeometry(1,1,1),rock:new T.DodecahedronGeometry(1,0),cylinder:new T.CylinderGeometry(1,1,1,8),cone:new T.ConeGeometry(1,1,7),ring:new T.TorusGeometry(1,.06,5,32)};
 function mesh(shape,mat,x,y,z,sx=1,sy=1,sz=1){const m=new T.Mesh(geometries[shape],materials[mat]);m.position.set(x,y,z);m.scale.set(sx,sy,sz);m.receiveShadow=true;m.castShadow=true;group.add(m);return m;}
 function dispose(){group.removeFromParent();for(const g of Object.values(geometries))g.dispose();for(const m of Object.values(materials))m.dispose();}
 return{group,materials,geometries,mesh,dispose};
}
export function createRegionLandmarks(scene,mapId){
 const k=kit(scene,mapId),{mesh,group}=k,map=mapFor(mapId),animated=[],portalMarks=[],objectives=[],seal=[],cacheMarks=[],caveEffects=[];
 for(const p of PORTALS.filter(p=>p.mapId===mapId)){
  const pieces=[],mouthZ=p.z-(p.appearance==='cave'?1.2:0);
  if(p.appearance==='stairs'){
   pieces.push(mesh('box','dark',p.x,.135,p.z,1.25,.025,1.65));
   for(let i=0;i<5;i++)pieces.push(mesh('box','stone',p.x,.15+i*.025,p.z-.6+i*.3,1.05,.045,.25));
   for(const dx of [-.65,.65])pieces.push(mesh('box','trim',p.x+dx,.24,p.z,.12,.26,1.8));
  }else if(p.appearance==='cave'||p.hidden||mapId==='underways'){
   // A dark, low opening remains readable from the isometric camera without a roof.
   pieces.push(mesh('box','dark',p.x,.5,mouthZ,2.6,1,.9));
   for(const dx of [-1.5,1.5])pieces.push(mesh('rock','stone',p.x+dx,.8,mouthZ, .65,1.2,.7));
   pieces.push(mesh('rock','stone',p.x,1.65,mouthZ,1.8,.45,.65));
   for(let i=0;i<3;i++)mesh('rock','trim',p.x-2+i*.35,.15,mouthZ+1+i*.15,.28,.15,.24);
  }else{
   for(const dx of [-1.4,1.4])mesh('box','stone',p.x+dx,1.4,p.z,.55,2.8,.55);
   mesh('box','trim',p.x,2.8,p.z,3.4,.35,.7);
  }
  const glow=mesh('rock','glow',p.x,.12,p.z+.65,.24,.12,.24);animated.push(glow);
  const caveEffect=['cave','stairs'].includes(p.appearance)?createCaveEntranceEffect(group,p):null;
  if(caveEffect)caveEffects.push(caveEffect);
  portalMarks.push({portal:p,glow,pieces,caveEffect});
 }
 if(mapId==='blackvein-quarry'){
  for(const x of [-3,3])mesh('box','stone',x,1.5,-18,.7,3,.7);
  mesh('box','trim',0,3,-18,6.6,.45,.8);
  for(const x of [-2,-1,0,1,2])seal.push(mesh('box','glow',x,1.3,-18,.055,2.6,.08));
 }
 for(const o of map.objectives){
  mesh('cylinder','stone',o.x,.22,o.z,1.15,.44,1.15);
  mesh('box','dark',o.x,.9,o.z,.7,1.4,.7);
  if(mapId==='blackvein-quarry'){for(const dx of [-1.2,1.2])mesh('box','trim',o.x+dx,1.4,o.z,.2,2.8,.2);mesh('box','trim',o.x,2.8,o.z,2.7,.2,.3);}
  const crystal=mesh('rock','glow',o.x,1.8,o.z,.37,.65,.37);animated.push(crystal);objectives.push({id:o.id,crystal});
 }
 if(map.checkpoint){const c=map.checkpoint;mesh('cylinder','stone',c.x,.08,c.z,2,.16,2);const ring=mesh('ring','trim',c.x,.18,c.z,2,2,2);ring.rotation.x=Math.PI/2;mesh('box','dark',c.x,1,c.z,.18,2,.18);const flame=mesh('rock','glow',c.x,2.1,c.z,.22,.38,.22);animated.push(flame);}
 for(const c of map.caches){const parts=[mesh('box','dark',c.x,.35,c.z,1.1,.7,.75),mesh('box','trim',c.x,.68,c.z,1.18,.16,.83)];for(const dx of [-.37,.37])parts.push(mesh('box','trim',c.x+dx,.36,c.z,.1,.72,.8));cacheMarks.push({id:c.id,parts});}
 function updateProgress(progress){for(const mark of portalMarks){mark.glow.visible=availablePortal(mark.portal,progress);if(mark.caveEffect)mark.caveEffect.group.visible=mark.glow.visible;}const r=(progress?.regionProgress||progress?.regions||progress)?.[mapId];for(const part of seal)part.visible=!map.objectives.every(o=>r?.objectives?.includes(o.id));for(const o of objectives){o.crystal.visible=!r?.objectives?.includes(o.id);}}
 function sync(interactions=[],discoveries=[]){const found=new Set(Array.isArray(discoveries)?discoveries:[]);for(const mark of portalMarks)if(mark.portal.hidden)mark.glow.scale.setScalar(found.has(mark.portal.id)?.45:.18);for(const o of objectives){const interaction=(Array.isArray(interactions)?interactions:interactions?.objectives||[]).find(i=>i.id===o.id);if(interaction?.completed)o.crystal.visible=false;}if(Array.isArray(interactions?.caches))for(const c of cacheMarks)for(const part of c.parts)part.visible=interactions.caches.some(i=>i.id===c.id);}
 function update(t){for(let i=0;i<animated.length;i++)animated[i].rotation.y=t*.4+i;for(const effect of caveEffects)effect.update(t);}
 return{group,dispose(){for(const effect of caveEffects)effect.dispose();k.dispose();},updateProgress,sync,update};
}
export function createRegionEnvironment(scene,mapId){
 const map=mapFor(mapId),k=kit(scene,mapId),{mesh,group}=k,b=map.bounds,obstacles=map.obstacles.map(o=>({...o})),gates=[],cover=[];
 let seed=mapId.length*977;const rand=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
 mesh('box','ground',(b.minX+b.maxX)/2,-.21,(b.minZ+b.maxZ)/2,b.maxX-b.minX,.4,b.maxZ-b.minZ);
 // Worn lanes run through every chamber, with cross-paths to side objectives.
 if(map.theme!=='cave'){const lane=mesh('box','dark',0,.005,0,mapId==='underways'?58:4,.035,mapId==='underways'?4:58);lane.castShadow=false;}
 for(const o of map.objectives){mesh('box','dark',o.x/2,.008,o.z,Math.abs(o.x)+2,.04,2.6);}
 for(const obstacle of obstacles){
  const h=map.theme==='cave'?.55:obstacle.requires?2.5:mapId==='crownfall-keep'?2.8:mapId==='drowned-wood'?1.1:1.7;
  const solid=mesh('box',obstacle.requires?'trim':'stone',obstacle.x,h/2,obstacle.z,obstacle.w,h,obstacle.d);
  if(map.theme==='cave'){
   // Faceted caps stay within the same rock footprint as the low solid wall.
   const count=Math.max(1,Math.ceil(Math.max(obstacle.w,obstacle.d)/2));
   for(let i=0;i<count;i++){const along=(i+.5)/count-.5,wide=obstacle.w>=obstacle.d;
    mesh('rock','stone',obstacle.x+(wide?along*obstacle.w:0),.85,obstacle.z+(wide?0:along*obstacle.d),wide?obstacle.w/count*.5:obstacle.w*.5,.8+rand()*.3,wide?obstacle.d*.5:obstacle.d/count*.5);
   }
  }
  if(obstacle.requires)gates.push({obstacle,solid});
  const coverParts=[solid];if(obstacle.destructible)cover.push({obstacle,parts:coverParts});
  if(mapId==='drowned-wood'){for(let i=0;i<3;i++){const x=obstacle.x+(rand()-.5)*obstacle.w*.7,z=obstacle.z+(rand()-.5)*obstacle.d*.7;mesh('cylinder','dark',x,1.8,z,.24,3.6,.24);const crown=mesh('cone','stone',x,3.5,z,1.5,2.5,1.5);crown.castShadow=false;}}
  if(mapId==='blackvein-quarry'){const rock=mesh('rock','trim',obstacle.x,.7,obstacle.z,obstacle.w*.4,1.2,obstacle.d*.4);rock.rotation.y=rand()*2;coverParts.push(rock);}
  if(mapId==='crownfall-keep')for(const dx of [-.3,.3])mesh('box','trim',obstacle.x+dx*obstacle.w,h+.18,obstacle.z,obstacle.w*.25,.36,obstacle.d);
 }
 // Boundary scenery is entirely outside walkable space, avoiding invisible snags.
 const perimeter=[];for(let x=b.minX;x<=b.maxX;x+=3.5)perimeter.push([x,b.minZ-2.2],[x,b.maxZ+2.2]);for(let z=b.minZ;z<=b.maxZ;z+=3.5)perimeter.push([b.minX-2.2,z],[b.maxX+2.2,z]);
 for(const [x,z] of perimeter){if(Math.abs(x)<3&&(z<b.minZ||z>b.maxZ))continue;const h=1.6+rand()*2;mesh('rock','stone',x,h*.35,z,2,h,2);if(mapId==='drowned-wood'){mesh('cylinder','dark',x,2,z,.3,4,.3);mesh('cone','dark',x,4,z,1.8,3,1.8);}if(mapId==='crownfall-keep'){mesh('box','stone',x,1.4,z,3.6,2.8,1);mesh('box','trim',x,3,z,1,.6,1.1);}}
 // Low ground details provide texture while preserving silhouettes and clear paths.
 const detailTransform=new T.Object3D();
 for(const [material,count]of[['stone',128],['trim',42]]){
  const detail=new T.InstancedMesh(k.geometries.rock,k.materials[material],count);
  for(let i=0;i<count;i++){detailTransform.position.set(b.minX+rand()*(b.maxX-b.minX),.016,b.minZ+rand()*(b.maxZ-b.minZ));detailTransform.scale.set(.12+rand()*.3,.025,.12+rand()*.25);detailTransform.updateMatrix();detail.setMatrixAt(i,detailTransform.matrix);}
  detail.receiveShadow=true;group.add(detail);
 }
 if(map.theme==='cave'){
  for(const o of obstacles.filter(o=>o.w<8&&o.d<8)){mesh('cone','trim',o.x,.65,o.z,.3,1.3,.3);}
  for(const [x,z]of [[b.minX+2,b.minZ+3],[b.maxX-2,b.minZ+3]]){mesh('rock','glow',x,.35,z,.18,.35,.18);}
 }
 if(mapId==='drowned-wood')for(const [x,z]of[[-16,19],[16,16],[-17,-18],[20,-19]]){const pool=mesh('cylinder','dark',x,.025,z,4,.025,3);pool.castShadow=false;}
 if(mapId==='blackvein-quarry')for(const x of[-.9,.9])mesh('box','trim',x,.07,2,.08,.08,32);
 if(mapId==='crownfall-keep'){mesh('box','trim',0,.12,-24,7,.24,5);mesh('box','dark',0,1.4,-26,2.2,2.8,1);}
 const landmarks=createRegionLandmarks(scene,mapId);group.add(landmarks.group);
 function updateProgress(progress){for(const {obstacle,solid}of gates){obstacle.disabled=availablePortal(obstacle,progress);solid.visible=!obstacle.disabled;}landmarks.updateProgress(progress);}
 function updateObstacles(disabledIds=[]){const disabled=new Set(disabledIds);for(const c of cover){c.obstacle.disabled=disabled.has(c.obstacle.id);for(const part of c.parts)part.visible=!c.obstacle.disabled;}}
 return{group,obstacles,updateObstacles,buildings:[],torches:[],mists:[],windowGlows:[],glowTexture:null,currentBuilding:()=>null,pickDoor:()=>null,nearestDoor:()=>null,updateProgress,sync:landmarks.sync,update(t){landmarks.update(t);},dispose(){landmarks.dispose();k.dispose();}};
}
