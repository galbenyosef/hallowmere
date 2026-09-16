import * as T from './vendor/three.core.js';
import {createGeometryBatcher} from './geometry-batch.js';
import {createPalette} from './palette.js';
import {caveSceneryFor} from './cave-scenery-layout.js';
import {bareTreeSegments} from './bare-tree.js';
import {lcg,hashString} from './random.js';
import {disposeSubtree} from './dispose.js';

export function createCaveEntranceScenery(parent,portal){
 const layout=caveSceneryFor(portal);if(!layout)return null;
 const {mouthZ,crag,hills}=layout,group=new T.Group();group.name=`cave-scenery-${portal.id}`;parent.add(group);
 const colors={rock:0x646c63,shade:0x384441,moss:0x50594a,grass:0x626957,bark:0x302e27};
 const materials=createPalette(colors,{params:()=>({roughness:1,flatShading:true})});
 const geometries={rock:new T.DodecahedronGeometry(1,0),beam:new T.CylinderGeometry(1,1,1,10)};
 const batcher=createGeometryBatcher();
 const rand=lcg(hashString(portal.id,{seed:17,imul:true}));
 function add(geometry,material,x,y,z,sx=1,sy=1,sz=1,rotation=0){
  const transform=new T.Object3D();transform.position.set(x,y,z);transform.scale.set(sx,sy,sz);transform.rotation.y=rotation;transform.updateMatrix();
  // Only positions and normals are needed by these untextured materials.
  batcher.add(geometry,material,transform.matrix,{deindexFirst:true,keepAttributes:['position','normal']});
 }
 function rock(mat,x,y,z,sx,sy,sz,rotation=0){add(geometries.rock,mat,x,y,z,sx,sy,sz,rotation);}
 function beam(a,b,r){
  const start=new T.Vector3(...a),end=new T.Vector3(...b),direction=end.clone().sub(start),g=geometries.beam.clone();
  g.scale(r,direction.length(),r);g.applyQuaternion(new T.Quaternion().setFromUnitVectors(new T.Vector3(0,1,0),direction.normalize()));g.translate(...start.add(end).multiplyScalar(.5).toArray());
  add(g,'bark',0,0,0);g.dispose();
 }
 // An irregular crest above a broad, grounded footprint, with moss on upper faces.
 // The rectangular foot matches the shared navigation footprint exactly.
 for(const [index,hill]of hills.entries()){
  const {x,z,w,h,d}=hill;
  const foot=[[-.5,-.5],[0,-.5],[.5,-.5],[.5,0],[.5,.5],[0,.5],[-.5,.5],[-.5,0]].map(([a,b])=>[x+a*w,-.04,z+b*d]);
  const crown=foot.map(([a,,b],i)=>[x+(a-x)*(.63+(i%3)*.035),h*(.5+[.04,.2,.1,.16,0,.06,.04,.12][i]),z+(b-z)*.62]);
  const peak=[x-w*.12,h,z-d*.12],stone=[],turf=[];
  for(let i=0;i<8;i++){
   const j=(i+1)%8;
   stone.push(...foot[i],...crown[j],...foot[j],...foot[i],...crown[i],...crown[j]);
   (i%4===index%4?turf:stone).push(...crown[i],...peak,...crown[j]);
  }
  for(const [vertices,mat]of[[stone,'rock'],[turf,'moss']]){const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(vertices,3));g.computeVertexNormals();add(g,mat,0,0,0);g.dispose();}
  // Broken strata and smaller stones soften the bottom of the cliff face.
  for(let i=0;i<7;i++){
   const a=i/6*Math.PI,rx=x+Math.cos(a)*w*.43,rz=z+Math.sin(a)*d*.44;
   rock(i%3?'shade':'moss',rx,.12+rand()*.15,rz,.4+rand()*.5,.22+rand()*.34,.36+rand()*.3,rand()*3);
  }
 }
 // The overhang joins the original arch to the hillside behind it.
 rock('rock',portal.x,1.85,mouthZ-.32,2.3,.62,1.12,.06);
 rock('moss',portal.x-.25,2.29,mouthZ-.4,1.85,.17,.82,-.08);
 // Exposed seams break up the broad turf planes into weathered rock shelves.
 for(const [dx,dz,y,sx,sy,sz]of[
  [-1.4,-2.1,3.05,1.4,.5,.85],[.8,-2.9,3.65,1,.65,.8],
  [2.5,-1.5,2.25,.9,.7,.75],[-2.65,-.65,1.55,.8,.48,.7],
  [-.65,-.85,2.5,.72,.24,.55]
 ]){
  const rise=crag?1.2:1;
  rock('rock',portal.x+dx,y*rise,mouthZ+dz,sx,sy*rise,sz,.18+rand()*.35);
  rock('moss',portal.x+dx-.12,(y+sy*.65)*rise,mouthZ+dz,.75*sx,.12,.68*sz,.2);
 }
 for(const side of[-1,1]){
  for(let i=0;i<5;i++){
   const x=portal.x+side*(2.35+i*.34),z=mouthZ+1.1+i*.39;
   rock(i%2?'moss':'rock',x,.06,z,.24+rand()*.23,.07+rand()*.08,.2+rand()*.3,rand()*3);
  }
  // Root fingers follow the rock shoulders down toward the opening.
  const x=portal.x+side*2.7;
  beam([x,2.2,mouthZ-1.3],[x+side*.3,1.25,mouthZ+.15],.105);
  beam([x+side*.3,1.25,mouthZ+.15],[x+side*.55,.13,mouthZ+1.3],.07);
  beam([x+side*.3,1.25,mouthZ+.15],[x-side*.45,.13,mouthZ+.9],.05);
 }
 // Reuse the surrounding forest's dead trees, including its branch proportions.
 const main=hills[0];
 for(const [dx,dz,size]of[[-2.1,-.7,.8],[.9,-1.05,1],[2.5,-.5,.6]]){
  const x=main.x+dx,z=main.z+dz,y=main.h*.62,s=size*(crag?.85:1);
  const point=([a,b,c])=>[x+a*s,y+b*s,z+c*s];
  for(const [a,b,r]of bareTreeSegments(rand))beam(point(a),point(b),r*s);
 }
 // The same sparse, pointed grass as the village hugs the rocky approach.
 const grass=new T.BufferGeometry();grass.setAttribute('position',new T.Float32BufferAttribute([-.1,0,0,0,.4,0,.05,0,.02,0,0,-.1,.03,.34,0,0,0,.1],3));grass.computeVertexNormals();
 for(const side of[-1,1])for(let i=0;i<5;i++){
  const x=portal.x+side*(2.5+rand()*1.7),z=mouthZ+.6+rand()*2.5;
  rock('shade',x,.06,z,.35,.08,.3,rand()*3);
  for(let j=0;j<4;j++){
   const size=.5+rand()*.75;
   add(grass,'grass',x+(rand()-.5)*.8,.03,z+(rand()-.5)*.8,size,size,size,rand()*6.28);
  }
 }
 grass.dispose();materials.grass.side=T.DoubleSide;
 const owned=batcher.build(group,{materialFor:key=>materials[key]}).map(mesh=>mesh.geometry);
 for(const g of Object.values(geometries))g.dispose();
 return{group,dispose(){disposeSubtree(group,{removeFromParent:'before',traverse:false,extraGeometries:owned,extraMaterials:Object.values(materials)});}};
}
