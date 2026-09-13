import * as T from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';

const vertex=`varying vec2 vUv,vWorld;
void main(){vUv=uv;vWorld=(modelMatrix*vec4(position,1.)).xz;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`;
const glowFragment=`
varying vec2 vUv,vWorld;
uniform float spread,burst,opened;
uniform vec4 bounds;
void main(){
 if(vWorld.x<bounds.x||vWorld.x>bounds.y||vWorld.y<bounds.z||vWorld.y>bounds.w)discard;
 vec2 p=vUv*2.-1.;float r=length(p);
 float pool=exp(-r*r*5.)*(1.-smoothstep(.7,1.,r));
 float wave=exp(-pow((r-spread)*30.,2.))*burst;
 gl_FragColor=vec4(mix(vec3(1.,.48,.08),vec3(1.,.82,.34),wave),pool*opened+wave*.22);
 #include <colorspace_fragment>
}`;

// Every cache uses the same chest, driven only by the local player's claimed IDs.
export function createTreasureChest(parent,cache,map){
 const group=new T.Group();group.name=`treasure-chest-${cache.id}`;
 group.position.set(cache.x,0,cache.z);parent.add(group);
 const reducedMotion=globalThis.matchMedia?.('(prefers-reduced-motion: reduce)');
 const geometries=new Set(),materials=new Set();
 const geometry=g=>(geometries.add(g),g);
 const material=m=>(materials.add(m),m);
 const wood=material(new T.MeshStandardMaterial({color:0x61361f,roughness:.86}));
 const woodEdge=material(new T.MeshStandardMaterial({color:0x301c13,roughness:.9}));
 const brass=material(new T.MeshStandardMaterial({color:0xc99743,metalness:.6,roughness:.4,emissive:0x9b5819,emissiveIntensity:.16}));
 const iron=material(new T.MeshStandardMaterial({color:0x27262b,metalness:.7,roughness:.5}));
 const gold=material(new T.MeshStandardMaterial({color:0xeab52a,metalness:.65,roughness:.28,emissive:0xe77d08,emissiveIntensity:.42}));
 const box=geometry(new T.BoxGeometry(1,1,1)),coin=geometry(new T.CylinderGeometry(.075,.075,.025,10));
 const body=new T.Group(),lid=new T.Group();body.name='chest-body';lid.name='chest-lid';group.add(body,lid);
 lid.position.set(0,.79,-.45);
 function part(parent,g,m,x,y,z,sx=1,sy=1,sz=1){
  const mesh=new T.Mesh(g,m);mesh.position.set(x,y,z);mesh.scale.set(sx,sy,sz);
  mesh.castShadow=true;mesh.receiveShadow=true;parent.add(mesh);return mesh;
 }
 const cube=(parent,m,x,y,z,sx,sy,sz)=>part(parent,box,m,x,y,z,sx,sy,sz);
 // A hollow, plank-sided body, deep feet, metal corners, and a front lock.
 cube(body,woodEdge,0,.18,0,1.48,.24,.96);
 for(const z of [-.45,.45])for(let row=0;row<3;row++)cube(body,wood,0,.34+row*.16,z,1.44,.148,.1);
 for(const x of [-.7,.7])cube(body,wood,x,.49,0,.12,.58,.88);
 for(const y of [.24,.76]){
  for(const z of [-.49,.49])cube(body,brass,0,y,z,1.54,.075,.065);
  for(const x of [-.74,.74])cube(body,brass,x,y,0,.065,.075,.97);
 }
 for(const x of [-.51,.51]){
  for(const z of [-.51,.51]){
   cube(body,brass,x,.49,z,.115,.53,.055);
   for(const y of [.33,.65])part(body,geometry(new T.SphereGeometry(.025,6,4)),iron,x,y,z*1.07);
  }
  for(const z of [-.34,.34])cube(body,iron,x,.12,z,.23,.18,.23);
 }
 cube(body,brass,0,.63,.53,.25,.28,.07);
 cube(body,iron,0,.65,.571,.045,.09,.015);
 // An arched shell rotates around the back edge; its interior is also wood.
 const arch=new T.Shape();arch.moveTo(-.49,0);
 for(let i=0;i<=10;i++){const a=Math.PI-i*Math.PI/10;arch.lineTo(Math.cos(a)*.49,Math.sin(a)*.34);}
 arch.lineTo(.49,0);arch.lineTo(-.49,0);
 function archGeometry(width){
  const g=new T.ExtrudeGeometry(arch,{depth:width,bevelEnabled:false,steps:1,curveSegments:10});
  g.rotateY(-Math.PI/2);g.translate(width/2,0,.45);return geometry(g);
 }
 part(lid,archGeometry(1.49),wood,0,0,0);
 for(const x of [-.7,-.5,.5,.7])part(lid,archGeometry(.07),brass,x,.012,0,1,1.045,1.025);
 for(const z of [-.015,.915])cube(lid,brass,0,.018,z,1.54,.07,.065);
 cube(lid,brass,0,-.065,.945,.12,.2,.045);
 for(const z of [.2,.45,.7])cube(lid,woodEdge,0,-.008,z,1.3,.012,.015);
 for(const x of [-.5,.5])cube(lid,brass,x,-.015,.45,.065,.03,.87);
 for(const x of [-.5,.5])cube(body,iron,x,.76,-.51,.19,.1,.15);
 // Merge static detail by material; the lid remains a separate moving piece.
 for(const root of [body,lid]){
  const batches=new Map();
  for(const mesh of [...root.children]){
   mesh.updateMatrix();const g=mesh.geometry.clone().applyMatrix4(mesh.matrix);
   const flat=g.index?g.toNonIndexed():g;if(flat!==g)g.dispose();
   if(!batches.has(mesh.material))batches.set(mesh.material,[]);
   batches.get(mesh.material).push(flat);root.remove(mesh);
  }
  for(const [m,parts] of batches){part(root,geometry(mergeGeometries(parts)),m,0,0,0);parts.forEach(g=>g.dispose());}
 }
 const transform=new T.Object3D();
 const pile=new T.InstancedMesh(coin,gold,64);pile.name='chest-gold';pile.castShadow=true;group.add(pile);
 for(let i=0;i<64;i++){
  const angle=i*2.39996,r=Math.sqrt((i+.5)/64);
  transform.position.set(Math.cos(angle)*r*.59,.73+(1-r)*.16+(i%3)*.016,Math.sin(angle)*r*.32);
  transform.rotation.set(Math.sin(i*7)*.25,i*1.7,Math.cos(i*3)*.23);transform.scale.setScalar(1);
  transform.updateMatrix();pile.setMatrixAt(i,transform.matrix);
 }
 const spill=new T.InstancedMesh(coin,gold,26);spill.name='spilled-crowns';spill.castShadow=true;spill.frustumCulled=false;group.add(spill);
 const trajectories=Array.from({length:26},(_,i)=>{
  const a=.18+(Math.sin(i*127.1)*43758.5453%1+1)%1*2.78,r=.72+(Math.sin(i*311.7)*15731.9%1+1)%1*1.15;
  return{x:Math.cos(a)*r,z:Math.sin(a)*r,delay:(i%5)*.045,spin:i*1.37};
 });
 const light=new T.PointLight(0xffbe55,3,9,1.5);light.position.set(0,1.25,.4);group.add(light);
 const radius=map.theme==='cave'?Math.hypot(map.bounds.maxX-map.bounds.minX,map.bounds.maxZ-map.bounds.minZ):19;
 const uniforms={spread:{value:0},burst:{value:0},opened:{value:0},bounds:{value:new T.Vector4(map.bounds.minX,map.bounds.maxX,map.bounds.minZ,map.bounds.maxZ)}};
 const glowMaterial=material(new T.ShaderMaterial({uniforms,vertexShader:vertex,fragmentShader:glowFragment,transparent:true,blending:T.AdditiveBlending,depthWrite:false,toneMapped:false}));
 const glow=new T.Mesh(geometry(new T.PlaneGeometry(1,1)),glowMaterial);
 glow.name='treasure-room-glow';glow.rotation.x=-Math.PI/2;glow.position.y=.035;group.add(glow);
 const coreMaterial=material(new T.MeshBasicMaterial({color:0xffd76d,transparent:true,opacity:.8,toneMapped:false}));
 cube(group,coreMaterial,0,.705,0,1.23,.025,.73).castShadow=false;
 const sparkGeometry=geometry(new T.BufferGeometry()),sparkPositions=new Float32Array(18*3);
 sparkGeometry.setAttribute('position',new T.BufferAttribute(sparkPositions,3));
 const sparkMaterial=material(new T.PointsMaterial({color:0xffe3a0,size:.045,transparent:true,opacity:0,blending:T.AdditiveBlending,depthWrite:false,toneMapped:false}));
 const sparks=new T.Points(sparkGeometry,sparkMaterial);sparks.name='treasure-motes';sparks.frustumCulled=false;group.add(sparks);
 let initialized=false,claimed=false,elapsed=0,lastTime=null,disposed=false,coinsSettled=false;
 function pose(time){
  const still=reducedMotion?.matches,t=still?0:time,age=still?10:elapsed;
  const opening=claimed?1-Math.pow(1-Math.min(1,age/.85),3):0;
  lid.rotation.x=-opening*1.92;
  const reveal=claimed?Math.min(1,age/.28):0;
  spill.visible=claimed;pile.visible=true;
  gold.emissiveIntensity=claimed?.55:.3;
  if(claimed&&!coinsSettled)for(let i=0;i<trajectories.length;i++){
   const p=trajectories[i],flight=Math.max(0,Math.min(1,(age-.15-p.delay)/1.15));
   transform.position.set(p.x*flight,.79*(1-flight)+Math.sin(flight*Math.PI)*1.55+.055*flight,p.z*flight);
   transform.rotation.set(flight===1?.08:flight*9+p.spin,p.spin,flight===1?Math.sin(i)*.13:flight*7);
   transform.scale.setScalar(flight===0?.001:1);transform.updateMatrix();spill.setMatrixAt(i,transform.matrix);
  }
  if(claimed&&!coinsSettled){spill.instanceMatrix.needsUpdate=true;coinsSettled=age>=1.5;}
  const burst=claimed&&!still?Math.sin(Math.PI*Math.min(1,age/2.8)):0;
  const roomSize=claimed?3+(radius*2-3)*Math.min(1,age/2.4):3;
  glow.scale.set(roomSize,roomSize,1);
  uniforms.spread.value=.12+Math.min(1,age/2.8)*.67;
  uniforms.burst.value=burst;uniforms.opened.value=claimed?reveal*(.17+burst*.21):.32;
  light.distance=claimed?radius*1.5:9;
  light.position.y=1.25+opening*1.1;
  light.intensity=claimed?reveal*(22+burst*58):3;
  coreMaterial.opacity=claimed?.9:.55;
  sparkMaterial.opacity=claimed&&!still?.6*reveal:0;
  sparks.visible=claimed&&!still;
  for(let i=0;i<18;i++){
   const rise=(t*.22+i/18)%1,a=i*2.4+t*.18,r=.24+rise*.65;
   sparkPositions[i*3]=Math.cos(a)*r;sparkPositions[i*3+1]=.8+rise*1.9;sparkPositions[i*3+2]=Math.sin(a)*r;
  }
  sparkGeometry.attributes.position.needsUpdate=true;
 }
 function setClaimed(next){
  if(disposed)return;
  next=!!next;
  if(initialized&&next===claimed)return;
  // Loading/revisiting an already claimed chest restores the settled pose.
  if(!initialized){claimed=next;elapsed=next?10:0;initialized=true;}
  else if(next!==claimed){claimed=next;elapsed=0;coinsSettled=false;}
  pose(lastTime??0);
 }
 pose(0);
 return{group,setClaimed,update(time){
  if(disposed)return;
  if(claimed&&lastTime!==null)elapsed+=Math.max(0,Math.min(.05,time-lastTime));
  lastTime=time;pose(time);
 },dispose(){
  if(disposed)return;disposed=true;group.removeFromParent();
  pile.dispose();spill.dispose();geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());
 }};
}
