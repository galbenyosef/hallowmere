import {BUILDING_SPECS,createBuildingLayout} from './buildings.js';

// Rendering and the authoritative simulation consume the same solid geometry.
export const SCENERY_OBSTACLES = [
 {x:-69,z:8,w:1.4,d:1.2},
 {x:-6,z:-12.6,w:4.8,d:.8}, {x:6,z:-12.6,w:4.8,d:.8},
 {x:-5.6,z:5,w:2.1,d:2.1}, {x:6.4,z:5,w:1.6,d:2.1,rotation:-.7}
];
export function createWorldLayout(){
 const buildings=BUILDING_SPECS.map(createBuildingLayout);
 return {buildings,obstacles:[...SCENERY_OBSTACLES.map(o=>({...o})),...buildings.flatMap(b=>b.obstacles)]};
}
