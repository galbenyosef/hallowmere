// Independent chamber positions and connections avoid a repeated outer ring.
const layouts={
 'moss-hollow':{
  width:4.8,turn:'root',
  points:[[-.78,.70],[-1.18,.60],[-1.12,.10],[-.80,-.40],[-1.12,-.76],[.70,.73],[1.14,.52],[1.13,-.04],[.79,-.57],[1.12,-.77]],
  edges:[[0,1],[1,2],[2,3],[3,4],[5,6],[6,7],[7,8],[8,9]],
  anchors:[[0,1],[3,6],[5,2],[8,7]]
 },
 'cellar-depths':{
  width:5,turn:'vault',
  points:[[-1.13,.70],[-.66,.70],[-1.13,.15],[-1.13,-.55],[-.60,-.77],[.66,.70],[1.13,.70],[1.13,.10],[1.13,-.65],[.55,-.78]],
  edges:[[0,1],[0,2],[2,3],[3,4],[5,6],[6,7],[7,8],[8,9],[2,7]],
  anchors:[[1,1],[4,9],[5,2],[9,8]]
 },
 'gloom-cavern':{
  width:6.2,turn:'rift',
  points:[[-.75,.74],[-1.18,.42],[-.86,.10],[-1.20,-.26],[-.87,-.75],[-.15,-.80],[.73,-.71],[1.16,-.30],[.90,.15],[1.15,.69]],
  edges:[[0,1],[1,2],[2,3],[3,4],[4,5],[5,6],[6,7],[7,8],[8,9],[1,3],[7,9]],
  anchors:[[0,1],[2,3],[5,12],[8,10],[9,6]]
 },
 'old-road-cellar':{
  width:4.6,turn:'dogleg',
  points:[[-.60,.70],[-1.10,.72],[-1.18,.15],[-.93,-.35],[-1.12,-.73],[-.40,-.75],[.35,-.75],[1.10,-.66],[1.12,-.02],[1.12,.69]],
  edges:[[0,1],[1,2],[2,3],[3,4],[4,5],[5,6],[6,7],[7,8],[8,9]],
  anchors:[[0,0],[6,2]]
 },
 'gravekeepers-hollow':{
  width:4.8,turn:'crypt',
  points:[[-.65,.72],[-1.15,.72],[-1.10,.18],[-1.10,-.42],[-.92,-.76],[0,-.76],[.73,-.75],[1.12,-.40],[1.12,.20],[1.06,.72]],
  edges:[[0,1],[2,3],[3,4],[5,6],[6,7],[8,9]],
  anchors:[[0,0],[2,1],[5,2],[7,2],[8,0]]
 }
};

export function caveExpansion(id,w,d,original){
 const layout=layouts[id];
 const names=['Wayfarer’s refuge','Sunken stores','Whispering gallery','Smuggler’s camp','The Crystal Veil','Forgotten sanctum','Deepwater vault','Pilgrim’s tomb','The Lost Dig','Rootbound grotto'];
 const features=['camp','pool','crystals','camp','crystals','shrine','pool','shrine','camp','crystals'];
 const chambers=layout.points.map(([x,z],i)=>({name:names[i],x:Math.round(x*w/2)*2,z:Math.round(z*d/2)*2,rx:Math.max(5,w*(layout.turn==='rift'?.15:.12)),rz:Math.max(5,d*(layout.turn==='crypt'?.1:.12)),feature:features[i],shape:['vault','crypt'].includes(layout.turn)?'vault':'oval'}));
 function passage(a,b,index){
  let points;
  if(layout.turn==='vault'||layout.turn==='crypt')points=[a,{x:b.x,z:a.z},b];
  else if(layout.turn==='dogleg')points=[a,{x:a.x,z:(a.z+b.z)/2},{x:b.x,z:(a.z+b.z)/2},b];
  else{
   const dx=b.x-a.x,dz=b.z-a.z,len=Math.hypot(dx,dz),bend=Math.min(9,len*.16)*(index%2?1:-1);
   points=[a,{x:a.x+dx*.35-dz/len*bend,z:a.z+dz*.35+dx/len*bend},{x:a.x+dx*.7-dz/len*bend*.4,z:a.z+dz*.7+dx/len*bend*.4},b];
  }
  return{width:layout.width,points:points.filter((p,i)=>!i||p.x!==points[i-1].x||p.z!==points[i-1].z).map(({x,z})=>({x,z}))};
 }
 return{chambers,tunnels:[...layout.edges.map(([a,b],i)=>passage(chambers[a],chambers[b],i)),...layout.anchors.map(([a,b],i)=>passage(original[b],chambers[a],i))]};
}
