// Six times the original area, with the original quest corridor left in place.
export const OVERWORLD_BOUNDS={minX:-134.5,maxX:79.5,minZ:-81,maxZ:81};
export const OUTLANDS=[
 ['orchard','The Withered Orchard',-97,-24,'orchard'],
 ['hearthstead','Hearthstead Hamlet',-111,12,'hamlet'],
 ['pilgrim','Pilgrim’s Encampment',-115,53,'camp'],
 ['barrow','The Elder Barrow',-116,-62,'ruin'],
 ['moor','Widow’s Moor',-73,-57,'stones'],
 ['watch','The Fallen Watch',-25,-58,'ruin'],
 ['graves','Forgotten Burial Ground',23,-52,'graves'],
 ['hermit','Hermit’s Refuge',61,-61,'camp'],
 ['eastwall','The Broken Eastwall',60,-19,'ruin'],
 ['alder','Alderbrook Hamlet',57,24,'hamlet'],
 ['mill','The Abandoned Mill',54,62,'ruin'],
 ['fen','Lantern Fen',9,57,'stones'],
 ['hunters','Hunters’ Rest',-39,57,'camp'],
 ['farm','Briar Farmstead',-77,49,'orchard'],
 ['hollow','Bramble Hollow',-15,31,'stones'],
 ['spring','The Lost Spring',-54,-29,'stones']
].map(([id,name,x,z,kind])=>({id,name,x,z,kind,radius:13}));
const route=(...points)=>({width:3.4,points:points.map(([x,z])=>({x,z}))});
export const OUTLAND_ROUTES=[
 route([-78,5],[-88,12],[-111,12],[-120,32],[-115,53],[-98,65],[-77,49],[-39,57],[9,57],[54,62],[64,43],[57,24],[60,-19],[61,-61],[23,-52],[-25,-58],[-73,-57],[-116,-62],[-97,-24],[-111,12]),
 route([-78,5],[-88,-5],[-97,-24],[-73,-57]),
 route([-66,21],[-68,34],[-77,49]),
 route([-45,5],[-51,-9],[-54,-29],[-73,-57]),
 route([-54,-29],[-30,-38],[-25,-58]),
 route([-36,5],[-37,24],[-39,57]),
 route([0,25],[-15,31],[-9,44],[9,57]),
 route([0,-25],[-7,-39],[-25,-58]),
 route([0,-25],[14,-33],[23,-52]),
 route([23,5],[40,11],[57,24]),
 route([57,24],[41,40],[9,57]),
 route([-15,31],[-37,24])
];
export const OUTLAND_BUILDINGS=OUTLANDS.filter(s=>s.kind==='hamlet').flatMap(s=>[
 {id:`${s.id}-west`,name:`${s.name.split(' ')[0]} Hearth`,x:s.x-7,z:s.z-6,w:5.2,d:5.5,h:3,rotation:.06,chapel:false,abandoned:false},
 {id:`${s.id}-east`,name:`${s.name.split(' ')[0]} Lodge`,x:s.x+7,z:s.z-6,w:5.4,d:5.8,h:3.3,rotation:-.08,chapel:false,abandoned:false}
]);
export function distanceToRoute(p,routes){let best=Infinity;for(const route of routes)for(let i=1;i<route.points.length;i++){const a=route.points[i-1],b=route.points[i],dx=b.x-a.x,dz=b.z-a.z,t=Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.z-a.z)*dz)/(dx*dx+dz*dz||1)));best=Math.min(best,Math.hypot(p.x-a.x-t*dx,p.z-a.z-t*dz));}return best;}
export function populateOutlands(map,sites,routes,types){
 map.sites=sites;map.routes=routes;map.checkpoints=[];
 sites.forEach((s,i)=>{
  if(s.kind==='hamlet'||s.kind==='camp')map.checkpoints.push({id:`${map.id}-${s.id}-rest`,name:s.name,mapId:map.id,x:s.x,z:s.z,radius:5});
  else{
   const guardId=`${map.id}-${s.id}-guard`;
   for(let n=0;n<4;n++)map.encounters.push({id:n?`${guardId}-${n}`:guardId,type:types[(i+n)%types.length],x:s.x+(n%2?3:-3),z:s.z+(n<2?1:5),optional:true});
   map.caches.push({id:`${map.id}-${s.id}-cache`,name:`${s.name} cache`,x:s.x,z:s.z+1,tier:Math.max(1,map.tier),enemyId:guardId});
  }
  // Solids frame the clearing; its center and trail approaches stay open.
  for(const dx of [-6,6])if(s.kind!=='hamlet')map.obstacles.push({x:s.x+dx,z:s.z-4,w:s.kind==='ruin'?2.4:1.5,d:2,sceneryKind:s.kind});
 });
}
export function plantOutlands(map){
 const b=map.bounds;let seed=722;const rand=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
 for(let x=b.minX+6;x<b.maxX-4;x+=9)for(let z=b.minZ+6;z<b.maxZ-4;z+=9){
  const p={x:x+(rand()-.5)*5,z:z+(rand()-.5)*5};
  if(map.id==='overworld'?p.x>-83&&p.x<28&&Math.abs(p.z)<28:Math.abs(p.x)<32&&Math.abs(p.z)<32)continue;
  if(map.sites.some(s=>Math.hypot(s.x-p.x,s.z-p.z)<14)||distanceToRoute(p,map.routes)<4.5)continue;
  map.obstacles.push({...p,w:1,d:1,sceneryKind:map.id==='blackvein-quarry'?'stones':map.id==='crownfall-keep'?'ruin':'tree'});
 }
}
export function expandSurfaceRegion(map){
 const b=map.bounds,w=b.maxX-b.minX,d=b.maxZ-b.minZ,cx=(b.minX+b.maxX)/2,cz=(b.minZ+b.maxZ)/2;
 map.bounds={minX:cx-w,maxX:cx+w,minZ:cz-d*1.5,maxZ:cz+d*1.5};
 const names=map.id==='drowned-wood'?['Reedbank Camp','Sunken Orchard','The Willow Graves','Drowned Hermitage','Old Fen Shrine','The Rootgarden','Mosswatch Ruins','Pilgrim’s Grove']:map.id==='blackvein-quarry'?['Survey Camp','Abandoned Stores','The Shattered Lift','Prospector’s Rest','Blackstone Cut','The Old Foundry','Buried Watchpost','Miners’ Refuge']:['Westwatch Camp','The Ash Gardens','Forgotten Barracks','Exiles’ Refuge','The Broken Aqueduct','Royal Burial Ground','The Outer Rampart','Last Hearth'];
 const positions=[[-.78,.72],[-.8,0],[-.75,-.92],[0,-1.23],[.75,-.92],[.8,0],[.78,.72],[0,1.24]];
 const sites=positions.map(([x,z],i)=>({id:`outland-${i}`,name:names[i],x:cx+x*w,z:cz+z*d,kind:i===0||i===3||i===7?'camp':i%2?'ruin':'stones',radius:12}));
 const routes=[route(...[...sites,sites[0]].map(s=>[s.x,s.z])),...sites.map(s=>route([map.start.x,map.start.z],[s.x*.65,s.z*.65],[s.x,s.z]))];
 populateOutlands(map,sites,routes,map.id==='drowned-wood'?['hunter','rootling']:map.id==='blackvein-quarry'?['miner','quarry-mage']:['sentinel','pyromancer']);
}
