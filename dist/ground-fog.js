import * as T from './vendor/three.core.js';
import {pointBlocked} from './combat.js';
import {BUILDING_SPECS,insideBuilding} from './buildings.js';

// Fixed pockets belong to the landscape; walking between them leaves clear air.
function pocketsFor(map){
 const pocket=(x,z,w=17,d=10)=>({x,z,w,d});
 if(map.theme==='cave')return map.chambers.filter((r,i)=>i%4===3||r.name==='The Crystal Veil').map(r=>pocket(r.x-1,r.z+1,Math.min(18,r.rx*1.35),Math.min(11,r.rz*1.25)));
 if(map.id==='overworld')return[
  pocket(-67,23,14,8),pocket(-47,9,19,10),pocket(4,10,13,8),pocket(12,-25,14,9),
  ...map.sites.filter(s=>['hearthstead','moor','graves','fen','mill','spring'].includes(s.id)).map(s=>pocket(s.x-3,s.z+5))
 ];
 const sites=(map.sites||[]).filter((s,i)=>i%2===0).map(s=>pocket(s.x-2,s.z+5,15,9));
 return map.id==='underways'?sites:[pocket(-17,17,13,8),pocket(16,-16,14,9),...sites];
}

const vertexShader=`
 varying vec2 vUv;
 varying vec3 vWorld;
 void main(){
  vUv=uv;
  vec4 world=modelMatrix*vec4(position,1.);
  vWorld=world.xyz;
  gl_Position=projectionMatrix*viewMatrix*world;
 }
`;
const fragmentShader=`
 uniform float time;
 uniform float seed;
 uniform vec3 tint;
 uniform vec2 player;
 uniform sampler2D floorMask;
 uniform vec4 footprint;
 varying vec2 vUv;
 varying vec3 vWorld;
 float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
 float noise(vec2 p){
  vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);
  return mix(mix(hash(i),hash(i+vec2(1.,0.)),f.x),mix(hash(i+vec2(0.,1.)),hash(i+vec2(1.,1.)),f.x),f.y);
 }
 float clouds(vec2 p){
  float n=0.,weight=.55;
  for(int i=0;i<4;i++){n+=noise(p)*weight;p=mat2(1.7,-1.2,1.2,1.7)*p+7.3;weight*=.47;}
  return n;
 }
 void main(){
  float edge=1.-smoothstep(.18,1.,length((vUv-.5)*2.));
  vec2 drift=vec2(time*.085,time*.027);
  vec2 p=vUv*vec2(4.5,3.)+seed+vWorld.y*3.1-drift;
  p+=vec2(noise(p*.8+time*.015),noise(p*.8+11.))*1.15;
  float billow=clouds(p),wisps=clouds(p*vec2(1.1,2.4)+vec2(8.,-time*.035));
  float density=smoothstep(.22,.72,billow)*(.48+wisps*.8);
  vec2 floorUv=(vWorld.xz-footprint.xy)/footprint.zw+.5;
  float floor=texture2D(floorMask,floorUv).r;
  float distanceToPlayer=distance(vWorld.xz,player);
  float readability=mix(.35,1.,smoothstep(1.3,4.,distanceToPlayer));
  float farFade=1.-smoothstep(36.,50.,distanceToPlayer);
  float alpha=edge*density*floor*readability*farFade*.32;
  if(alpha<.002)discard;
  gl_FragColor=vec4(tint*(.8+billow*.35),alpha);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
 }
`;

export function createGroundFog(parent,map){
 const group=new T.Group();group.name=`ground-fog-${map.id}`;parent.add(group);
 const geometry=new T.PlaneGeometry(1,1),patches=[],reducedMotion=globalThis.matchMedia?.('(prefers-reduced-motion: reduce)');
 const tint=new T.Color(map.theme==='cave'?0x8c9da8:map.id==='drowned-wood'?0x95aaa5:0x9aaab3);
 const playerUniform={value:new T.Vector2(map.start.x,map.start.z)},timeUniform={value:0};
 for(const [index,p]of pocketsFor(map).entries()){
  // Clip the entire drifting pocket to walkable ground, outside house interiors.
  const w=p.w+6,d=p.d+6,size=64,pixels=new Uint8Array(size*size*4);
  const obstacles=map.obstacles.filter(o=>Math.abs(o.x-p.x)<w/2+Math.hypot(o.w,o.d)/2&&Math.abs(o.z-p.z)<d/2+Math.hypot(o.w,o.d)/2);
  const buildings=map.id==='overworld'?BUILDING_SPECS.filter(b=>Math.hypot(b.x-p.x,b.z-p.z)<Math.hypot(w,d)/2+Math.hypot(b.w,b.d)/2):[];
  for(let y=0;y<size;y++)for(let x=0;x<size;x++){
   const point={x:p.x+((x+.5)/size-.5)*w,z:p.z+((y+.5)/size-.5)*d},b=map.bounds;
   const clear=point.x>b.minX&&point.x<b.maxX&&point.z>b.minZ&&point.z<b.maxZ&&!pointBlocked(point,obstacles,.25)&&!buildings.some(b=>insideBuilding(b,point,-.45));
   const i=(y*size+x)*4;pixels[i]=pixels[i+1]=pixels[i+2]=clear?255:0;pixels[i+3]=255;
  }
  const mask=new T.DataTexture(pixels,size,size);mask.magFilter=mask.minFilter=T.LinearFilter;mask.needsUpdate=true;
  const material=new T.ShaderMaterial({uniforms:{time:timeUniform,player:playerUniform,tint:{value:tint},seed:{value:index*13.71},floorMask:{value:mask},footprint:{value:new T.Vector4(p.x,p.z,w,d)}},vertexShader,fragmentShader,transparent:true,depthWrite:false,side:T.DoubleSide});
  const root=new T.Group();root.position.set(p.x,0,p.z);group.add(root);
  const layers=[];
  for(let i=0;i<3;i++){
   const mesh=new T.Mesh(geometry,material);mesh.rotation.x=-Math.PI/2;mesh.position.y=.24+i*.38;mesh.scale.set(p.w*(1-i*.09),p.d*(1-i*.1),1);root.add(mesh);layers.push(mesh);
  }
  patches.push({root,layers,mask,material,phase:index*2.4});
 }
 function update(time,position){
  const t=reducedMotion?.matches?0:time;timeUniform.value=t;
  if(position)playerUniform.value.set(position.x,position.z);
  for(const p of patches){
   p.root.visible=!position||Math.hypot(p.root.position.x-position.x,p.root.position.z-position.z)<62;
   if(!p.root.visible)continue;
   for(const [i,layer]of p.layers.entries()){layer.position.x=Math.sin(t*.065+p.phase+i*1.6)*1.15;layer.position.z=Math.cos(t*.047+p.phase+i*1.3)*.65;}
  }
 }
 update(0,map.start);
 return{group,update,dispose(){group.removeFromParent();geometry.dispose();for(const p of patches){p.mask.dispose();p.material.dispose();}}};
}
