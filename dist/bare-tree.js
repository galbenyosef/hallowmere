// Shared crooked trunks, forked branches, and exposed roots for the forest.
export function bareTreeSegments(random){
 const range=(a,b)=>a+(b-a)*random(),segments=[];
 const points=[[0,0,0],[.12,1.6,.04],[-.1,2.7,0],[.1,4,.1],[.2,5.2,.22]];
 for(let i=0;i<4;i++)segments.push([points[i],points[i+1],.26-i*.052]);
 for(let i=0;i<7;i++){
  const a=i*2.39,y=1.5+i*.39,r=range(1,1.7);
  const b=[Math.cos(a)*r,y+range(.5,1),Math.sin(a)*r];
  segments.push([[0,y,0],b,.095-i*.007]);
  segments.push([b,[b[0]*1.45,b[1]+.8,b[2]*1.4],.035]);
  segments.push([b,[b[0]*1.2+.3,b[1]+.65,b[2]*1.1-.25],.025]);
 }
 for(let k=0;k<5;k++){const a=k*1.25;segments.push([[0,.25,0],[Math.cos(a)*.85,.03,Math.sin(a)*.85],.09]);}
 return segments;
}
