import {BUILDING_SPECS,buildingWorld} from './buildings.js';

// Authored side caves share their solid rock footprints with navigation and rendering.
const rock=(x,z,w,d)=>({x,z,w,d});
function cave(id,name,w,d,rocks,foes,cache){
 const encounters=foes.map(([type,x,z],i)=>({id:`${id}-guard-${i+1}`,type,x,z}));
 return {id,name,subtitle:'BENEATH HALLOWMERE',theme:'cave',tier:0,
  bounds:{minX:-w/2,maxX:w/2,minZ:-d/2,maxZ:d/2},start:{x:0,z:d/2-2},checkpoint:null,
  objectives:[],boss:null,hazards:[],encounters,
  caches:[{id:`${id}-cache`,name:`${name} cache`,x:cache[0],z:cache[1],tier:1,enemyId:encounters.at(-1).id}],
  obstacles:[rock(-w/2,0,2,d),rock(w/2,0,2,d),rock(0,-d/2,w,2),rock(0,d/2,w,2),...rocks]
 };
}
export const FIRST_LEVEL_CAVES=[
 cave('moss-hollow','Moss Hollow',18,18,
  [rock(-6,5,4,3),rock(6,-5,4,4),rock(-6,-7,4,2),rock(-3,0,3,2)],
  [['hollow',-4,-3],['hound',3,-2],['hollow',0,-6]],[0,-6.8]),
 cave('cellar-depths','Cellar Depths',28,24,
  [rock(-8,1,10,2),rock(10,1,6,2),rock(-11,-8,4,6),rock(11,8,4,6),rock(6,-8,3,3)],
  [['hollow',-7,5],['hound',-9,8],['hollow',3,-3],['hound',-4,-5],['revenant',3,-8],['hollow',-5,-9]],[-5,-9.8]),
 cave('gloom-cavern','Gloom Cavern',40,34,
  [rock(-13,4,12,3),rock(13,4,12,3),rock(0,-7,3,18),rock(-16,-12,6,8),rock(16,-12,6,8),rock(-17,12,4,6),rock(17,12,4,6),rock(-8,-3,3,3),rock(9,-7,3,3)],
  [['hollow',-6,9],['hound',6,9],['hollow',-12,9],['hound',12,9],['hollow',-5,-3],['hound',-10,-7],['revenant',-6,-12],['hollow',5,-4],['hound',12,-3],['revenant',7,-13]],[7,-14]),
 cave('old-road-cellar','Old Road Cellar',18,20,
  [rock(-6,1,4,3),rock(5,-5,4,3),rock(-6,-7,4,3)],
  [['hollow',-4,-3],['hound',3,-2],['hollow',0,-7]],[0,-8]),
 cave('gravekeepers-hollow','Gravekeeper’s Hollow',22,22,
  [rock(-7,3,6,2),rock(7,-2,6,2),rock(-7,-7,4,5)],
  [['hollow',-4,-2],['hound',5,2],['hollow',3,-6],['revenant',0,-8]],[0,-9])
];
function houseEntrance(id,caveId,buildingId,name){
 const house=BUILDING_SPECS.find(b=>b.id===buildingId);
 return{id,caveId,buildingId,name,...buildingWorld(house,0,-.7),rotation:house.rotation,appearance:'stairs',hidden:true};
}
export const CAVE_ENTRANCES=[
 {id:'moss-hollow-entrance',caveId:'moss-hollow',x:-54,z:20,appearance:'cave',name:'Moss Hollow'},
 houseEntrance('cellar-depths-entrance','cellar-depths','south-house','Cellar Depths'),
 {id:'gloom-cavern-entrance',caveId:'gloom-cavern',x:-35,z:-19,appearance:'cave',name:'Gloom Cavern'},
 houseEntrance('old-road-cellar-entrance','old-road-cellar','west-lodge','Old Road Cellar'),
 houseEntrance('gravekeepers-hollow-entrance','gravekeepers-hollow','grave-house','Gravekeeper’s Hollow')
];
