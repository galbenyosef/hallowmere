import {createGroundFog} from './ground-fog.js';
import {distanceToRoute} from './expansion-layout.js';
import {createOutlandScenery} from './outland-scenery.js';
import {MAPS} from './regions.js';
import {SCENERY_OBSTACLES} from './world-layout.js';
import {bareTreeSegments} from './bare-tree.js';
import * as T from 'three';
import {createGeometryBatcher} from './geometry-batch.js';
import {BUILDING_SPECS,createBuildingLayout,buildingLocal,insideBuilding,setBuildingAccess} from './buildings.js';
import {lcg,range as rangeFn} from './random.js';
export function createEnvironment(scene){
 const rand=lcg(4148);const range=(a,b)=>rangeFn(rand,a,b);
 const statics=new T.Group();scene.add(statics);const obstacles=SCENERY_OBSTACLES.map(o=>({...o})),buildings=[],torches=[],windowGlows=[];
 const material=(color,roughness=.92,metalness=0)=>new T.MeshStandardMaterial({color,roughness,metalness});
 const materials={stone:material(0x646c63),stoneDark:material(0x384441),plaster:material(0x737369),timber:material(0x302e27),wood:material(0x534b37),oak:material(0x3e382c),roof:material(0x313e40),roof2:material(0x3d4c4b),roof3:material(0x293536),iron:material(0x39413c,.6,.55),dirt:material(0x39423b),grave:material(0x737e70),bone:material(0xa5a38a),grass:material(0x626957),dark:material(0x111b1c),red:material(0x65382e)};
 const boxGeo=new T.BoxGeometry(1,1,1),cylinderGeo=new T.CylinderGeometry(1,1,1,10),rockGeo=new T.DodecahedronGeometry(1,0);
 function add(geometry,mat,x=0,y=0,z=0,sx=1,sy=1,sz=1,parent=statics){const m=new T.Mesh(geometry,mat);m.position.set(x,y,z);m.scale.set(sx,sy,sz);m.castShadow=true;m.receiveShadow=true;parent.add(m);return m;}
 const box=(mat,x,y,z,w,h,d,parent)=>add(boxGeo,mat,x,y,z,w,h,d,parent);
 function beam(a,b,r=.06,mat=materials.timber,parent=statics){const va=new T.Vector3(...a),vb=new T.Vector3(...b),v=vb.clone().sub(va);const m=add(cylinderGeo,mat,0,0,0,r,v.length(),r,parent);m.position.copy(va.add(vb).multiplyScalar(.5));m.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),v.normalize());return m;}
 function makeNoiseTexture(){const c=document.createElement('canvas');c.width=c.height=256;const ctx=c.getContext('2d'),pixels=ctx.createImageData(256,256);for(let i=0;i<pixels.data.length;i+=4){const n=range(-15,15);pixels.data[i]=64+n;pixels.data[i+1]=72+n;pixels.data[i+2]=63+n;pixels.data[i+3]=255;}ctx.putImageData(pixels,0,0);for(let i=0;i<850;i++){ctx.fillStyle=`rgba(18,27,23,${range(.05,.3)})`;ctx.beginPath();ctx.ellipse(rand()*256,rand()*256,range(1,5),range(1,3),rand()*6,0,Math.PI*2);ctx.fill();}const t=new T.CanvasTexture(c);t.wrapS=t.wrapT=T.RepeatWrapping;t.repeat.set(34.67,34.67);t.colorSpace=T.SRGBColorSpace;return t;}
 const groundMaterial=material(0x788078);groundMaterial.map=makeNoiseTexture();groundMaterial.roughness=.99;const ground=new T.Mesh(new T.PlaneGeometry(340,240),groundMaterial);ground.rotation.x=-Math.PI/2;ground.receiveShadow=true;ground.position.x=-27.5;scene.add(ground);createOutlandScenery(scene,MAPS.overworld);
 const puddleMat=new T.MeshStandardMaterial({color:0x354744,roughness:.15,metalness:.45,transparent:true,opacity:.65});for(let i=0;i<35;i++){const p=new T.Mesh(new T.CircleGeometry(range(.35,1.3),18),puddleMat);p.rotation.x=-Math.PI/2;p.position.set(range(-19,19),.018,range(-24,19));p.scale.y=range(.35,.8);statics.add(p);}
 // Village squares retain their cobbles; connecting lanes use the shared road layout.
 const roadMat=material(0x67736b);const cobbles=[];for(let z=-25;z<27;z+=.66)for(let x=-79;x<24;x+=.77){const courtyard=x*x+(z+8)*(z+8)<44||(x+67)**2+(z-5)**2<48;if(courtyard&&rand()>.055)cobbles.push([x+range(-.11,.11),z+range(-.1,.1),range(.35,.4),range(.3,.34)]);}const cobbleGeometry=new T.CylinderGeometry(1,1,.1,6);const inst=new T.InstancedMesh(cobbleGeometry,roadMat,cobbles.length);const dummy=new T.Object3D();cobbles.forEach(([x,z,sx,sz],i)=>{dummy.position.set(x,.035+rand()*.03,z);dummy.rotation.set(0,rand()*.6,range(-.025,.025));dummy.scale.set(sx,range(.6,1.3),sz);dummy.updateMatrix();inst.setMatrixAt(i,dummy.matrix);const color=new T.Color().setHSL(.13+rand()*.04,.06+rand()*.05,.26+rand()*.15);inst.setColorAt(i,color);});inst.receiveShadow=true;scene.add(inst);
 function windowAt(parent,x,y,z,w=.75,h=.85,lit=true){box(materials.stoneDark,x,y,z,w+.22,h+.24,.15,parent);box(materials.dark,x,y,z+.09,w,h,.04,parent);if(lit){const glow=new T.MeshStandardMaterial({color:0xffbd73,emissive:0xff781e,emissiveIntensity:2.4,roughness:1});box(glow,x,y,z+.12,w*.8,h*.8,.025,parent);parent.updateMatrixWorld(true);windowGlows.push({position:parent.localToWorld(new T.Vector3(x,y,z+.24)),width:w,height:h,building:parent.userData.building});}box(materials.timber,x,y,z+.16,.07,h,.07,parent);box(materials.timber,x,y,z+.16,w,.08,.07,parent);box(materials.wood,x,y-h/2-.1,z+.1,w+.3,.11,.32,parent);}
 function house(spec){
 const b=createBuildingLayout(spec),{x,z,w,d,h,rotation,chapel,doorWidth,abandoned}=b;
 const g=new T.Group();g.position.set(x,0,z);g.rotation.y=rotation;g.userData.building=b;statics.add(g);
 const base=new T.Group();g.add(base);b.group=g;b.base=base;b.height=h+(chapel?8:w*.55);buildings.push(b);obstacles.push(...b.obstacles);
 // Solid low walls stay visible in the cutaway. The doorway is a real gap.
 box(materials.stoneDark,0,.005,0,w,.06,d,base);
 for(let xx=-w/2+.2;xx<w/2-.1;xx+=.4)box(chapel?materials.stone:materials.wood,xx,.065,0,.38,.07,d-.3,base);
 for(const wall of b.walls){box(materials.stoneDark,wall.x,.37,wall.z,wall.w,.68,wall.d,base);box(materials.plaster,wall.x,(h+.95)/2,wall.z,wall.w,h-.45,wall.d,g);box(materials.stone,wall.x,.74,wall.z,wall.w+.03,.1,wall.d+.03,base);}
 box(materials.plaster,0,(h+2.85)/2,d/2-.15,doorWidth,h-2.35,.3,g);
 for(const f of b.furniture){
  if(f.kind==='bed'){box(materials.oak,f.x,.28,f.z,f.w,.48,f.d,base);box(materials.red,f.x,.57,f.z+.18,f.w-.1,.16,f.d-.45,base);box(materials.bone,f.x,.61,f.z-f.d/2+.3,f.w-.16,.18,.38,base);box(materials.timber,f.x,.65,f.z-f.d/2,f.w+.08,.95,.12,base);}
  if(f.kind==='table'||f.kind==='pew'){const top=f.kind==='table'?.84:.55;box(materials.wood,f.x,top,f.z,f.w,.16,f.d,base);for(const sx of [-1,1])for(const sz of [-1,1])box(materials.timber,f.x+sx*(f.w/2-.1),top/2,f.z+sz*(f.d/2-.1),.12,top,.12,base);if(f.kind==='pew')box(materials.oak,f.x,.95,f.z-f.d/2,f.w,.7,.12,base);else{box(materials.bone,f.x-.15,1,f.z,.3,.09,.38,base);add(new T.CylinderGeometry(.12,.09,.23,8),materials.stone,f.x+.25,1.02,f.z+.2,1,1,1,base);}}
  if(f.kind==='altar'||f.kind==='hearth'){box(materials.stoneDark,f.x,.43,f.z,f.w,.8,f.d,base);box(materials.stone,f.x,.87,f.z,f.w+.14,.16,f.d+.1,base);if(f.kind==='altar'){box(materials.red,f.x,.96,f.z,.55,.025,f.d+.14,base);beam([f.x,1,f.z],[f.x,2.1,f.z],.055,materials.iron,base);beam([f.x-.3,1.8,f.z],[f.x+.3,1.8,f.z],.045,materials.iron,base);}else box(materials.dark,f.x,.4,f.z+f.d/2+.01,f.w*.65,.46,.02,base);}
 }
 // A woven runner keeps the route between the threshold and the room readable.
 box(chapel?materials.red:materials.grass,0,.11,d*.08,doorWidth*.66,.015,d*.57,base);
 for(let y=.45;y<1.3;y+=.37)for(let xx=-w/2+.24;xx<w/2;xx+=.57){if(Math.abs(xx)<doorWidth/2+.3)continue;box(rand()>.4?materials.stone:materials.stoneDark,xx+(Math.floor(y*3)%2)*.12,y,d/2+.035,.51,.31,.13,y<.8?base:g);}
 for(const side of [-1,1]){for(let zz=-d/2;zz<=d/2;zz+=d/3)box(materials.timber,side*(w/2+.035),h/2+.3,zz,.15,h+.13,.16,g);box(materials.timber,0,h+.16,side*(d/2+.03),w+.2,.18,.19,g);for(let xx=-w/2;xx<=w/2;xx+=w/3){if(side>0&&Math.abs(xx)<doorWidth/2+.12)continue;box(materials.timber,xx,h/2+.3,side*(d/2+.04),.16,h+.13,.14,g);}box(materials.timber,side*w/2,h+.16,0,.2,.2,d+.2,g);beam([side*w/2,h*.52,d/2+.14],[side*Math.max(w/6,doorWidth/2+.15),h-.02,d/2+.14],.067,materials.timber,g);}
 const rise=chapel?3.3:w*.55;const roofW=w/2+.5,roofD=d+.9;const slant=Math.atan2(rise,roofW);for(const s of [-1,1]){for(let i=0;i<8;i++)for(let j=0;j<Math.ceil(roofD/.54);j++){const u=(i+.5)/8;const tile=box([materials.roof,materials.roof2,materials.roof3][Math.floor(rand()*3)],s*roofW*u,h+.22+rise*(1-u)+range(-.015,.015),-roofD/2+j*.54+(i%2)*.03,Math.hypot(roofW,rise)/8+.06,.09,.57,g);tile.rotation.z=-s*slant;if(abandoned&&s===1&&((i===3||i===4)&&(j===3||j===4)||i===5&&j===4))tile.removeFromParent();}beam([-roofW,h+.18,s*roofD/2],[0,h+.24+rise,s*roofD/2],.1,materials.timber,g);beam([0,h+.24+rise,s*roofD/2],[roofW,h+.18,s*roofD/2],.1,materials.timber,g);box(materials.timber,s*roofW,h+.17,0,.13,.18,roofD,g);}
 beam([0,h+.23+rise,-roofD/2],[0,h+.23+rise,roofD/2],.1,materials.timber,g);
 // Gable plaster and timber cross bracing.
 const tri=new T.BufferGeometry();tri.setAttribute('position',new T.Float32BufferAttribute([-w/2,0,0,w/2,0,0,0,rise,0],3));tri.computeVertexNormals();for(const s of [-1,1]){const face=add(tri,materials.plaster,0,h+.22,s*d/2,1,1,1,g);if(s<0)face.rotation.y=Math.PI;beam([0,h+.2,s*(d/2+.04)],[0,h+rise+.2,s*(d/2+.04)],.065,materials.timber,g);}
 const front=d/2+.06,hinge=new T.Group();hinge.position.set(-doorWidth/2,0,front);g.add(hinge);b.hinge=hinge;b.open=0;
 box(materials.oak,doorWidth/2,1.3,0,doorWidth-.06,2.45,.11,hinge);
 for(const y of [.7,1.8])box(materials.iron,doorWidth/2,y,.07,doorWidth-.1,.09,.07,hinge);
 add(new T.TorusGeometry(.085,.021,5,10),materials.iron,doorWidth-.22,1.2,.11,1,1,1,hinge);
 for(const side of [-1,1])box(materials.stone,side*(doorWidth/2+.1),1.38,front,.2,2.65,.3,g);
 box(materials.stone,0,2.75,front,doorWidth+.4,.24,.34,g);box(materials.stone,0,.09,front+.35,doorWidth+.5,.13,1.02,base);
 const hitbox=new T.Mesh(new T.BoxGeometry(doorWidth+.4,2.8,.65),new T.MeshBasicMaterial({visible:false}));hitbox.position.set(0,1.4,front);g.add(hitbox);b.hitbox=hitbox;
 for(const side of [-1,1]){const lit=rand()>.3;windowAt(g,side*w*.32,chapel?2.8:2.04,front,chapel?.85:.72,chapel?1.65:.88,lit&&!abandoned);}
 if(!chapel){box(materials.stoneDark,w*.28,h+rise*.7,-d*.23,.74,2.15,.78,g);for(let i=0;i<4;i++)box(materials.stone,w*.28,h+rise*.7+i*.29,-d*.23,.81,.1,.83,g);box(materials.dark,w*.28,h+rise*.7+1.08,-d*.23,.62,.04,.66,g);windowAt(g,0,h+.75,front,.55,.65,!abandoned);}else{const towerX=-w*.5+.65,towerZ=-d*.28;box(materials.stoneDark,towerX,h+1.4,towerZ,2.6,5.2,2.6,g);for(let yy=h;yy<h+3.7;yy+=1.1)box(materials.stone,towerX,yy,towerZ,2.76,.13,2.76,g);for(const side of [-1,1]){box(materials.dark,towerX,h+2.75,towerZ+side*1.32,1.55,2,.08,g);box(materials.stone,towerX-.88,h+2.73,towerZ+side*1.34,.18,2.2,.2,g);box(materials.stone,towerX+.88,h+2.73,towerZ+side*1.34,.18,2.2,.2,g);}add(new T.ConeGeometry(2.1,3.7,4),materials.roof,towerX,h+5.52,towerZ,1,1,1,g).rotation.y=Math.PI/4;beam([towerX,h+7.3,towerZ],[towerX,h+8.1,towerZ],.05,materials.iron,g);beam([towerX-.28,h+7.85,towerZ],[towerX+.28,h+7.85,towerZ],.05,materials.iron,g);add(new T.CylinderGeometry(.37,.59,.76,12,1,true),materials.iron,towerX,h+2.7,towerZ+.1,1,1,1,g);}
 if(abandoned){
  // Weathered timber and missing shingles quietly distinguish empty homes.
  for(const side of [-1,1])for(const [dy,angle]of[[-.17,.12],[.17,-.2]]){
   const board=box(materials.wood,side*w*.32,2.04+dy,front+.22,.96,.16,.09,g);board.rotation.z=angle*side;
  }
  const shutter=box(materials.timber,0,h+.75,front+.2,.66,.14,.08,g);shutter.rotation.z=-.32;
  for(let i=0;i<3;i++){const fallen=box(materials.roof2,w/2+.28+i*.2,.06,d*.2+i*.32,.35,.08,.44,base);fallen.rotation.y=i*.7;}
  // A discarded cellar hatch and splintered floorboards become visible in the cutaway.
  for(const side of [-1,1])box(materials.timber,side*.76,.14,-.7,.13,.11,1.95,base);
  for(let i=0;i<4;i++){const plank=box(materials.oak,-1.04+i*.23,.19+i*.04,-.65,.2,.07,1.55,base);plank.rotation.z=-.48;}
  for(const z of [-1.15,-.15]){const strap=box(materials.iron,-.69,.29,z,.85,.055,.08,base);strap.rotation.z=.16;}
 }
 return g;}
 for(const spec of BUILDING_SPECS)house(spec);
 for(const x of [-78,-58])for(const z of [1.5,8.5]){box(materials.stoneDark,x,1.1,z,.85,2.2,.85);box(materials.stone,x,2.25,z,1,.18,1);}
 // A small shrine and the smith's anvil make the friendly square recognizable.
 box(materials.stoneDark,-69,.38,8,1.35,.75,1.1);box(materials.stone,-69,1,8,.56,.65,.45);beam([-69,1.2,8],[-69,2.5,8],.075,materials.wood);beam([-69.38,2.1,8],[-68.62,2.1,8],.075,materials.wood);
 box(materials.oak,-60,.43,1.2,.72,.8,.65);box(materials.iron,-60,1,1.2,.9,.32,.43);add(new T.ConeGeometry(.23,.55,4),materials.iron,-59.45,1.07,1.2).rotation.z=-Math.PI/2;
 // Chapel steps and broken courtyard walls.
 for(let i=0;i<3;i++)box(materials.stone,0,.1+i*.12,-13.65+i*.28,3.8,.22,1.8-i*.4);for(const s of [-1,1]){for(let j=0;j<4;j++){const x=s*(4.4+j*1.05);box(materials.stoneDark,x,.63,-12.6,1.02,1.1,.6);box(materials.stone,x,1.21,-12.6,1.11,.18,.72);}box(materials.stone,s*3.7,1.1,-12.6,.75,2.2,.75);add(new T.ConeGeometry(.55,.4,4),materials.stone,s*3.7,2.4,-12.6).rotation.y=Math.PI/4;}
 // An abandoned well, buckets and a collapsed handcart.
 const wx=-5.6,wz=5;add(new T.CylinderGeometry(1.15,1.22,.8,16,1,true),materials.stone,wx,.4,wz);add(new T.CircleGeometry(1,24),materials.dark,wx,.04,wz).rotation.x=-Math.PI/2;for(let i=0;i<16;i++){const a=i*Math.PI/8;const b=box(materials.stone,wx+Math.sin(a)*1.13,.85,wz+Math.cos(a)*1.13,.39,.18,.31);b.rotation.y=a;}for(const s of [-1,1])box(materials.timber,wx+s*1.3,1.7,wz,.16,2.65,.16);beam([wx-1.6,3.05,wz],[wx+1.6,3.05,wz],.1);beam([wx,2.96,wz],[wx,1.25,wz],.018,materials.wood);add(new T.CylinderGeometry(.19,.13,.32,9,1,true),materials.wood,wx,1.22,wz);const cart=new T.Group();cart.position.set(6.4,0,5);cart.rotation.y=-.7;statics.add(cart);box(materials.wood,0,.6,0,1.3,.15,2,cart);for(const s of [-1,1]){for(let i=0;i<3;i++)box(materials.wood,s*.68,.72+i*.2,0,.08,.15,1.97,cart);const wheel=add(new T.TorusGeometry(.49,.065,6,14),materials.timber,s*.82,.51,.2,1,1,1,cart);wheel.rotation.y=Math.PI/2;for(let k=0;k<6;k++){const a=k*Math.PI/3;beam([s*.82,.51,.2],[s*.82,.51+Math.sin(a)*.44,.2+Math.cos(a)*.44],.023,materials.wood,cart);}beam([s*.48,.53,.6],[s*.54,.42,2.8],.045,materials.wood,cart);}
 function barrel(x,z){const g=new T.Group();g.position.set(x,0,z);statics.add(g);add(new T.CylinderGeometry(.32,.3,.78,12),materials.wood,0,.42,0,1,1,1,g);for(const y of [.13,.4,.72])add(new T.TorusGeometry(.323,.027,4,12),materials.iron,0,y,0,1,1,1,g).rotation.x=Math.PI/2;for(let i=0;i<9;i++){const a=i*Math.PI*2/9;beam([Math.sin(a)*.32,.08,Math.cos(a)*.32],[Math.sin(a)*.32,.76,Math.cos(a)*.32],.008,materials.dark,g);}}for(const [x,z]of[[-8,9],[-8.4,9.65],[-8.2,-2],[8.1,1],[9,-1],[9.1,-11],[-8.3,-18]])barrel(x,z);
 // Gravestones, crooked fencing, and bare trees around the outer lanes.
 for(let i=0;i<14;i++){const x=16.5+(i%3)*1.7,z=-3-Math.floor(i/3)*2.25;const g=new T.Group();g.position.set(x,0,z);g.rotation.z=range(-.12,.12);g.rotation.y=range(-.2,.2);statics.add(g);box(materials.grave,0,.47,0,.62,.9,.18,g);add(new T.CylinderGeometry(.31,.31,.18,10,1,false,0,Math.PI),materials.grave,0,.94,0,1,1,1,g).rotation.x=Math.PI/2;box(materials.dark,0,.67,.1,.035,.32,.005,g);box(materials.dark,0,.73,.103,.19,.027,.005,g);box(materials.stoneDark,0,.04,.5,.9,.07,1.5,g);}
 function fence(x1,z1,x2,z2){const len=Math.hypot(x2-x1,z2-z1),n=Math.ceil(len/.6);for(let i=0;i<=n;i++){if(rand()<.08)continue;const u=i/n,x=x1+(x2-x1)*u,z=z1+(z2-z1)*u;beam([x,.12,z],[x+range(-.045,.045),1.2+rand()*.16,z],.024,materials.iron);add(new T.ConeGeometry(.065,.22,4),materials.iron,x,1.38,z);}for(const y of [.38,.98])beam([x1,y,z1],[x2,y,z2],.034,materials.iron);}
 fence(15.9,1.5,23,1.5);fence(15.9,1.5,15.9,-9);fence(23,1.5,23,-20);fence(-22,15,-17,15);fence(-22,-13,-17,-13);
 function tree(x,z,scale=1){const trunk=new T.Group();trunk.position.set(x,0,z);trunk.scale.setScalar(scale);statics.add(trunk);for(const [a,b,r]of bareTreeSegments(rand))beam(a,b,r,materials.timber,trunk);}
 for(const [x,z,s]of[[-18,3,1.35],[-18,-10,1.1],[19,8,1.35],[21,-17,1.3],[-8,18,1.3],[7,20,1.2],[-20,-22,1.6],[-4,-26,1.3],[20,20,1.4],[24,-5,1.3],[-24,10,1.2],[-28,-2,1.5],[-17,20,1.1]])tree(x,z,s);
 for(let x=-82;x<-26;x+=3.7)for(const side of [-1,1]){const z=5+side*range(6,13);if(x<-58&&z>-7&&z<19)continue;tree(x+range(-1,1),z,range(.8,1.5));}for(const [x,z]of[[-78,-9],[-68,-13],[-58,-13],[-80,22],[-70,24],[-57,23]])tree(x,z,1.2);
 fence(-78,1,-78,-8);fence(-78,9,-78,20);fence(-58,-9,-58,1);fence(-58,9,-58,20);
 const grassGeometry=new T.BufferGeometry();grassGeometry.setAttribute('position',new T.Float32BufferAttribute([-.1,0,0,0,.4,0,.05,0,.02,0,0,-.1,.03,.34,0,0,0,.1],3));grassGeometry.computeVertexNormals();materials.grass.side=T.DoubleSide;const grassCount=15000;const grassInst=new T.InstancedMesh(grassGeometry,materials.grass,grassCount);for(let i=0;i<grassCount;i++){const x=range(-136,81),z=range(-83,83),road=MAPS.overworld.routes.some(r=>distanceToRoute({x,z},[r])<r.width/2+.35)||MAPS.overworld.sites.some(s=>Math.hypot(x-s.x,z-s.z)<6);dummy.position.set(x,road||buildings.some(b=>insideBuilding(b,{x,z},-.1))?-.5:.03,z);dummy.rotation.set(0,rand()*6.28,0);dummy.scale.setScalar(range(.45,1.4));dummy.updateMatrix();grassInst.setMatrixAt(i,dummy.matrix);grassInst.setColorAt(i,new T.Color().setHSL(.15,.14,range(.21,.38)));}scene.add(grassInst);
 for(let i=0;i<120;i++){const x=range(-24,24),z=range(-25,23);if(Math.abs(x)<3&&rand()<.8)continue;const r=range(.07,.36);const rock=add(rockGeo,rand()>.5?materials.stone:materials.stoneDark,x,r*.3,z,r,range(.07,.22),r*.7);rock.rotation.set(rand(),rand()*6,rand());}
 function radialTexture(){const c=document.createElement('canvas');c.width=c.height=128;const ctx=c.getContext('2d');const g=ctx.createRadialGradient(64,64,0,64,64,64);g.addColorStop(0,'rgba(255,255,255,1)');g.addColorStop(.15,'rgba(255,255,255,.5)');g.addColorStop(.5,'rgba(255,255,255,.12)');g.addColorStop(1,'rgba(255,255,255,0)');ctx.fillStyle=g;ctx.fillRect(0,0,128,128);return new T.CanvasTexture(c);}const glowTexture=radialTexture();
 for(const window of windowGlows){const sprite=new T.Sprite(new T.SpriteMaterial({map:glowTexture,color:0xff852b,transparent:true,opacity:.3,blending:T.AdditiveBlending,depthWrite:false}));sprite.position.copy(window.position);sprite.scale.set(window.width*2.9,window.height*2.6,1);scene.add(sprite);window.sprite=sprite;}
 function torch(x,z,y=1.8){box(materials.timber,x,y*.48,z,.11,y,.11);add(new T.CylinderGeometry(.19,.1,.24,8),materials.iron,x,y,z);const flame=new T.Group();flame.position.set(x,y+.25,z);scene.add(flame);const core=new T.Mesh(new T.SphereGeometry(.1,7,6),new T.MeshBasicMaterial({color:0xffedb0}));core.scale.set(1,2.7,1);flame.add(core);const outer=new T.Mesh(new T.SphereGeometry(.13,7,6),new T.MeshBasicMaterial({color:0xff6d26,transparent:true,opacity:.5,depthWrite:false}));outer.scale.set(1,2.7,1);flame.add(outer);const sprite=new T.Sprite(new T.SpriteMaterial({map:glowTexture,color:0xff8b24,transparent:true,opacity:.7,blending:T.AdditiveBlending,depthWrite:false}));sprite.scale.set(3.2,3.8,1);flame.add(sprite);const light=new T.PointLight(0xff792b,68,10,1.8);light.position.set(x,y+.4,z);scene.add(light);torches.push({flame,light,core,sprite,offset:rand()*10});}
 for(const [x,z,y]of[[-4,-11.8,1.9],[4,-11.8,1.9],[-7.8,-.5,1.9],[7.8,4.1,1.9],[-7.8,12,1.7],[9,-9,1.8],[-2,15,1.8]])torch(x,z,y);
 for(const [x,z,y]of[[-70,2,1.8],[-61,6.5,1.7],[-76,8,1.8],[-57,2,1.9],[-57,8,1.9],[-22,7,1.8]])torch(x,z,y);
 for(const s of MAPS.overworld.sites.filter(s=>s.kind==='hamlet'||s.kind==='camp'))torch(s.x-2,s.z+2,.3);
 for(const [x,z,label]of[[-56,8.7,'HALLOWMERE →'],[-26,8.7,'← ASHWICK']]){box(materials.timber,x,1.1,z,.13,2.2,.13);const canvas=document.createElement('canvas');canvas.width=512;canvas.height=100;const ctx=canvas.getContext('2d');ctx.fillStyle='#3a3426';ctx.fillRect(0,0,512,100);ctx.strokeStyle='#998457';ctx.strokeRect(4,4,504,92);ctx.fillStyle='#d8c494';ctx.font='bold 36px Georgia';ctx.textAlign='center';ctx.fillText(label,256,62);const tex=new T.CanvasTexture(canvas);tex.colorSpace=T.SRGBColorSpace;const sign=new T.Mesh(new T.PlaneGeometry(2.3,.45),new T.MeshStandardMaterial({map:tex,roughness:1,side:T.DoubleSide}));sign.position.set(x,1.9,z+.08);statics.add(sign);}
 // A low fire in the center of the square gives the player a warm visual anchor.
 for(let i=0;i<9;i++){const a=i/9*Math.PI*2;add(rockGeo,materials.stoneDark,3.4+Math.cos(a)*.53,.18,-6+Math.sin(a)*.53,.24,.17,.24);}torch(3.4,-6,.17);beam([3.05,.18,-6.2],[3.8,.19,-5.8],.12,materials.dark);beam([3.1,.2,-5.8],[3.7,.2,-6.3],.13,materials.dark);
 const portalMat=new T.ShaderMaterial({uniforms:{time:{value:0},awakened:{value:0}},vertexShader:'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',fragmentShader:'varying vec2 vUv;uniform float time;uniform float awakened;void main(){vec2 p=(vUv-.5)*2.;float r=length(p);float a=atan(p.y,p.x);float swirl=sin(a*5.+r*18.-time*1.4)*.5+.5;float edge=smoothstep(1.,.75,r);float ring=pow(max(0.,1.-abs(r-.77)*6.),3.);vec3 col=mix(vec3(.04,.17,.15),vec3(.24,.68,.55),awakened);gl_FragColor=vec4(col*(.3+swirl*.5+ring*2.),edge*(.44+ring*.5));}',transparent:true,depthWrite:false,side:T.DoubleSide,blending:T.AdditiveBlending});const portal=new T.Mesh(new T.PlaneGeometry(2.3,3.7),portalMat);portal.position.set(0,2.1,-14.2);scene.add(portal);const portalLight=new T.PointLight(0x64dfbb,13,7,2);portalLight.position.set(0,2,-13.3);scene.add(portalLight);
 // Fine drifting ash remains behind the HUD and never blocks attack indicators.
 const ashGeo=new T.BufferGeometry(),ashPos=new Float32Array(450*3);for(let i=0;i<450;i++){ashPos[i*3]=range(-83,32);ashPos[i*3+1]=range(.3,11);ashPos[i*3+2]=range(-32,28);}ashGeo.setAttribute('position',new T.BufferAttribute(ashPos,3));const ash=new T.Points(ashGeo,new T.PointsMaterial({color:0xb7c8b1,size:.032,transparent:true,opacity:.48,depthWrite:false}));scene.add(ash);
 const groundFog=createGroundFog(scene,MAPS.overworld);
 // Collapse the unchanging scenery into one draw call per material.
 function mergeStaticGroup(root,independent=false){root.updateMatrixWorld(true);const batcher=createGeometryBatcher();root.traverse(o=>{if(!o.isMesh)return;batcher.add(o.geometry,o.material,o.matrixWorld,{key:o.material.uuid,ensureUV:true,toNonIndexed:true,resolveMaterial:independent?m=>{const clone=m.clone();clone.transparent=true;return clone;}:undefined});});return batcher.build(scene,{useGroups:false,skipNull:true});}
 for(const b of buildings){
  b.group.updateMatrixWorld(true);statics.attach(b.base);scene.attach(b.hinge);scene.attach(b.hitbox);
  b.bounds=new T.Box3().setFromObject(b.group).expandByScalar(.15);
  b.parts=mergeStaticGroup(b.group,true);b.group.removeFromParent();delete b.group;delete b.base;b.fade=1;b.inside=false;
 }
 mergeStaticGroup(statics);scene.remove(statics);statics.clear();const sight=new T.Ray(),obstruction=new T.Vector3(),lookAtPlayer=new T.Vector3();
 const interiorLight=new T.PointLight(0xffc68e,27,10,1.5);interiorLight.visible=false;scene.add(interiorLight);
 const currentBuilding=position=>buildings.find(b=>insideBuilding(b,position))||null;
 const nearestDoor=position=>{const inside=currentBuilding(position);if(inside)return inside;return buildings.filter(b=>{const p=buildingLocal(b,position);return Math.abs(p.x)<b.doorWidth/2+1&&Math.abs(p.z-b.d/2)<2.6;}).sort((a,b)=>Math.hypot(a.door.x-position.x,a.door.z-position.z)-Math.hypot(b.door.x-position.x,b.door.z-position.z))[0]||null;};
 return{obstacles,buildings,glowTexture,portal,currentBuilding,nearestDoor,
 pickDoor(raycaster){const hit=raycaster.intersectObjects(buildings.map(b=>b.hitbox),false)[0];return hit?buildings.find(b=>b.hitbox===hit.object):null;},
 update(t,dt,bossDefeated=false,camera,playerPosition){
 setBuildingAccess(buildings,bossDefeated);portal.visible=!bossDefeated;portalLight.visible=!bossDefeated;
 if(camera&&playerPosition){
  lookAtPlayer.copy(playerPosition).add(new T.Vector3(0,1.2,0));sight.origin.copy(camera.position);sight.direction.copy(lookAtPlayer).sub(sight.origin).normalize();const playerDistance=sight.origin.distanceTo(lookAtPlayer),occupied=currentBuilding(playerPosition);
  interiorLight.visible=!!occupied;if(occupied)interiorLight.position.set(occupied.x,2.5,occupied.z+.4);
  for(const b of buildings){
   b.inside=b===occupied;const near=Math.hypot(playerPosition.x-b.door.x,playerPosition.z-b.door.z)<3.2;
   b.open=T.MathUtils.lerp(b.open,b.doorCollider.disabled&&(near||b.inside)?1:0,1-Math.exp(-dt*9));b.hinge.rotation.y=b.rotation-b.open*Math.PI*.58;
   const blocked=sight.intersectBox(b.bounds,obstruction)&&obstruction.distanceTo(sight.origin)<playerDistance-.8;
   b.fade=T.MathUtils.lerp(b.fade,b.inside?0:blocked?.12:1,1-Math.exp(-dt*10));
   for(const mesh of b.parts){mesh.visible=b.fade>.015;mesh.material.opacity=b.fade;mesh.material.depthWrite=b.fade>.98;mesh.castShadow=b.fade>.6;}
  }
 }
 for(const window of windowGlows){window.sprite.material.opacity=.3*(window.building?.fade??1);window.sprite.visible=window.sprite.material.opacity>.01;}
 portalMat.uniforms.time.value=t;portalMat.uniforms.awakened.value=bossDefeated?1:0;for(const a of torches){const flicker=1+Math.sin(t*13+a.offset)*.09+Math.sin(t*21+a.offset*2)*.055;a.flame.scale.set(1,flicker,1);a.flame.rotation.z=Math.sin(t*8+a.offset)*.1;a.light.intensity=68*flicker;a.light.visible=!playerPosition||a.light.position.distanceTo(playerPosition)<24;a.sprite.material.opacity=.64+flicker*.1;}groundFog.update(t,playerPosition);const p=ashGeo.attributes.position.array;for(let i=0;i<450;i++){p[i*3]+=dt*.15;p[i*3+1]-=dt*.085;p[i*3+2]+=dt*.05;if(p[i*3+1]<.2)p[i*3+1]=11;if(p[i*3]>32)p[i*3]=-83;}ashGeo.attributes.position.needsUpdate=true;}};
}
