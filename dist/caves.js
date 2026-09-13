// Authored chambers and winding routes are rasterized once. Navigation, the map,
// and the scenery all use the same solid rock footprint.
const CELL=2;
const chamber=(name,x,z,rx,rz,feature='pool')=>({name,x,z,rx,rz,feature});
const tunnel=(width,...points)=>({width,points:points.map(([x,z])=>({x,z}))});
const distanceToSegment=(p,a,b)=>{const dx=b.x-a.x,dz=b.z-a.z,t=Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.z-a.z)*dz)/(dx*dx+dz*dz)));return Math.hypot(p.x-a.x-dx*t,p.z-a.z-dz*t);};
function rectangles(cells,columns,rows,value,w,d){
 const result=[],active=new Map();
 for(let row=0;row<rows;row++){
  const next=new Map();
  for(let col=0;col<columns;){
   if(cells[row*columns+col]!==value){col++;continue;}
   const first=col;while(col<columns&&cells[row*columns+col]===value)col++;
   const key=`${first}:${col}`,previous=active.get(key);
   if(previous){previous.d+=CELL;previous.z+=CELL/2;next.set(key,previous);}
   else{const rect={x:-w/2+(first+col)*CELL/2,z:-d/2+(row+.5)*CELL,w:(col-first)*CELL,d:CELL};result.push(rect);next.set(key,rect);}
  }
  active.clear();for(const [key,rect]of next)active.set(key,rect);
 }
 return result;
}
function cave(id,name,w,d,chambers,tunnels,treasureRooms){
 const columns=w/CELL,rows=d/CELL,cells=new Uint8Array(columns*rows),walls=[],floorTiles=[];
 const carved=p=>chambers.some(r=>((p.x-r.x)/r.rx)**2+((p.z-r.z)/r.rz)**2<1)||tunnels.some(t=>t.points.slice(1).some((b,i)=>distanceToSegment(p,t.points[i],b)<t.width/2));
 for(let row=1;row<rows-1;row++)for(let col=1;col<columns-1;col++){
  const p={x:-w/2+(col+.5)*CELL,z:-d/2+(row+.5)*CELL};
  if(carved(p)){cells[row*columns+col]=1;floorTiles.push(p);}
 }
 for(let row=0;row<rows;row++)for(let col=0;col<columns;col++)if(!cells[row*columns+col]){
  const neighbors=[[1,0],[-1,0],[0,1],[0,-1]].filter(([dx,dz])=>col+dx>=0&&col+dx<columns&&row+dz>=0&&row+dz<rows&&cells[(row+dz)*columns+col+dx]);
  if(neighbors.length)walls.push({x:-w/2+(col+.5)*CELL,z:-d/2+(row+.5)*CELL,neighbors});
 }
 const obstacles=rectangles(cells,columns,rows,0,w,d),floors=rectangles(cells,columns,rows,1,w,d);
 const clear=(p,padding=.65)=>!obstacles.some(o=>Math.abs(p.x-o.x)<o.w/2+padding&&Math.abs(p.z-o.z)<o.d/2+padding);
 const lanterns=[],addLantern=p=>{if(clear(p,.25)&&!lanterns.some(l=>Math.hypot(l.x-p.x,l.z-p.z)<4))lanterns.push(p);};
 // Offset the lamps to the sides of passages so their warm pools mark every turn.
 for(const t of tunnels)for(let i=1;i<t.points.length;i++){
  const a=t.points[i-1],b=t.points[i],length=Math.hypot(b.x-a.x,b.z-a.z),steps=Math.max(1,Math.ceil(length/7));
  for(let j=0;j<=steps;j++){const side=(i+j)%2?1:-1,offset=t.width/2-1.25;addLantern({x:a.x+(b.x-a.x)*j/steps+(b.z-a.z)/length*offset*side,z:a.z+(b.z-a.z)*j/steps-(b.x-a.x)/length*offset*side});}
 }
 for(const r of chambers)for(const side of [-1,1])addLantern({x:r.x+side*r.rx*.65,z:r.z+1});
 const encounters=[],caches=[],features=[];
 chambers.forEach((r,index)=>{
  if(index){
   const count=3+(index%3===0?1:0),first=encounters.length;
   for(let i=0;i<count;i++){const a=i/count*Math.PI*2,p={x:r.x+Math.cos(a)*2,z:r.z+Math.sin(a)*2};if(clear(p))encounters.push({id:`${id}-guard-${index}-${i+1}`,type:i===count-1&&index>2?'revenant':i%2?'hound':'hollow',...p});}
   if(treasureRooms.includes(index)){const p={x:r.x,z:r.z-2.8};caches.push({id:caches.length?`${id}-cache-${caches.length+1}`:`${id}-cache`,name:`${r.name} cache`,...p,tier:1,enemyId:encounters.at(-1)?.id||encounters[first].id});}
  }
  const feature={type:r.feature,x:r.x-r.rx*.45,z:r.z-r.rz*.36,seed:index};
  if(clear(feature,1.1))features.push(feature);
 });
 return{id,name,subtitle:'BENEATH HALLOWMERE',theme:'cave',tier:0,bounds:{minX:-w/2,maxX:w/2,minZ:-d/2,maxZ:d/2},start:{x:chambers[0].x,z:chambers[0].z+1},checkpoint:null,objectives:[],boss:null,hazards:[],encounters,caches,obstacles,chambers,tunnels,lanterns,features,floors,floorTiles,walls};
}
export const FIRST_LEVEL_CAVES=[
 cave('moss-hollow','Moss Hollow',64,72,[
  chamber('Lantern descent',0,29,6,5,'camp'),chamber('Moss gallery',-10,15,7,6),chamber('Pilgrim’s rest',13,13,8,6,'camp'),
  chamber('Root grotto',-22,-3,6,7,'crystals'),chamber('Sundered crossing',1,-5,8,7),chamber('Glowstone pocket',23,-8,6,8,'crystals'),
  chamber('Forgotten shrine',-17,-23,8,7,'shrine'),chamber('Hollow heart',7,-26,9,6,'crystals'),chamber('Smuggler’s niche',25,28,4,4,'camp')
 ],[
  tunnel(5,[0,29],[-3,23],[-10,15]),tunnel(5,[0,26],[10,23],[13,13]),tunnel(5,[-10,15],[-21,10],[-22,-3]),
  tunnel(5,[-10,15],[-7,3],[1,-5]),tunnel(5,[13,13],[16,2],[23,-8]),tunnel(5,[1,-5],[11,-10],[23,-8]),
  tunnel(5,[-22,-3],[-25,-13],[-17,-23]),tunnel(5,[1,-5],[-3,-16],[-17,-23]),tunnel(5,[-17,-23],[-7,-28],[7,-26]),
  tunnel(5,[23,-8],[23,-22],[7,-26]),tunnel(4.5,[13,13],[24,18],[25,28])
 ],[6,7,8]),
 cave('cellar-depths','Cellar Depths',80,88,[
  chamber('Collapsed cellar',0,36,7,5,'camp'),chamber('Cask vault',-15,24,8,7,'camp'),chamber('East stores',16,23,7,6,'camp'),
  chamber('Sunken cistern',-27,4,8,8),chamber('Broken junction',-2,5,8,7,'crystals'),chamber('Miner’s refuge',27,3,7,7,'camp'),
  chamber('Buried chapel',-24,-18,9,7,'shrine'),chamber('Old workings',2,-16,8,7,'camp'),chamber('Crystal gallery',27,-22,7,8,'crystals'),
  chamber('Deep reliquary',-7,-35,10,6,'shrine'),chamber('Lost storeroom',-32,32,5,5,'camp')
 ],[
  tunnel(5,[0,36],[-6,30],[-15,24]),tunnel(5,[0,36],[13,33],[16,23]),tunnel(5,[-15,24],[-24,17],[-27,4]),
  tunnel(5,[-15,24],[-8,16],[-2,5]),tunnel(5,[16,23],[24,15],[27,3]),tunnel(5,[16,23],[11,9],[-2,5]),
  tunnel(5,[-27,4],[-33,-7],[-24,-18]),tunnel(5,[-2,5],[-8,-6],[-24,-18]),tunnel(5,[-2,5],[6,-4],[2,-16]),
  tunnel(5,[27,3],[19,-6],[27,-22]),tunnel(5,[2,-16],[16,-14],[27,-22]),tunnel(5,[-24,-18],[-24,-30],[-7,-35]),
  tunnel(5,[2,-16],[6,-29],[-7,-35]),tunnel(5,[27,-22],[22,-36],[-7,-35]),tunnel(4.5,[-15,24],[-24,25],[-32,32])
 ],[6,8,9,10]),
 cave('gloom-cavern','Gloom Cavern',104,112,[
  chamber('Watchfire descent',0,47,7,6,'camp'),chamber('West passage',-18,32,9,7,'camp'),chamber('Echo chamber',19,32,9,8),
  chamber('Drowned hollow',-37,12,9,8),chamber('The crossroads',-9,10,9,8,'crystals'),chamber('Lantern gallery',19,9,8,7,'camp'),
  chamber('Prospector’s end',40,28,7,6,'camp'),chamber('Shattered sanctum',-36,-13,9,9,'shrine'),chamber('Gloom basin',-10,-15,9,8),
  chamber('Crystal throat',18,-14,9,8,'crystals'),chamber('Forgotten camp',40,-6,7,8,'camp'),chamber('Ossuary',-36,-39,9,8,'shrine'),
  chamber('Deep crossing',-7,-38,9,8,'camp'),chamber('Heart of the cavern',20,-43,11,8,'shrine'),chamber('Glittering recess',41,-31,7,7,'crystals')
 ],[
  tunnel(5.5,[0,47],[-8,40],[-18,32]),tunnel(5.5,[0,47],[14,43],[19,32]),tunnel(5,[-18,32],[-33,25],[-37,12]),
  tunnel(5,[-18,32],[-14,21],[-9,10]),tunnel(5,[19,32],[13,22],[19,9]),tunnel(5,[19,32],[31,36],[40,28]),
  tunnel(5,[-37,12],[-43,0],[-36,-13]),tunnel(5,[-9,10],[-22,6],[-36,-13]),tunnel(5,[-9,10],[-3,-1],[-10,-15]),
  tunnel(5,[-9,10],[5,14],[19,9]),tunnel(5,[19,9],[25,-1],[18,-14]),tunnel(5,[19,9],[33,9],[40,-6]),
  tunnel(5,[-36,-13],[-27,-21],[-10,-15]),tunnel(5,[-10,-15],[3,-22],[18,-14]),tunnel(5,[-36,-13],[-43,-27],[-36,-39]),
  tunnel(5,[-10,-15],[-17,-29],[-7,-38]),tunnel(5,[-36,-39],[-23,-45],[-7,-38]),tunnel(5,[-7,-38],[4,-46],[20,-43]),
  tunnel(5,[18,-14],[11,-28],[20,-43]),tunnel(5,[40,-6],[34,-20],[41,-31]),tunnel(5,[41,-31],[34,-43],[20,-43])
 ],[6,10,11,13,14])
];
export const CAVE_ENTRANCES=[
 {id:'moss-hollow-entrance',caveId:'moss-hollow',x:-54,z:20,appearance:'cave',name:'Moss Hollow'},
 {id:'cellar-depths-entrance',caveId:'cellar-depths',x:13,z:14.3,appearance:'stairs',buildingId:'south-house',name:'Cellar Depths'},
 {id:'gloom-cavern-entrance',caveId:'gloom-cavern',x:-35,z:-19,appearance:'cave',name:'Gloom Cavern'}
];
