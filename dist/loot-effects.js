import * as T from './vendor/three.core.js';

const colors={common:0xd4dce5,uncommon:0x83efa9,rare:0x66bdff,legendary:0xffbe61};
export function lootColor(record){return record.kind==='potion'?0xff5472:record.kind==='gold'?0xf4cf79:colors[record.rarity]??colors.common;}

const vertex=`
 varying vec2 vUv;
 void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}
`;
// Camera-facing ribbons retain world-up, including with the isometric camera.
const ribbonVertex=`
 varying vec2 vUv;
 void main(){
  vUv=uv;
  vec3 center=(modelMatrix*vec4(0.,0.,0.,1.)).xyz;
  vec3 right=vec3(viewMatrix[0][0],viewMatrix[1][0],viewMatrix[2][0]);
  gl_Position=projectionMatrix*viewMatrix*vec4(center+right*position.x+vec3(0.,position.y,0.),1.);
 }
`;
const noise=`
 float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
 float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1.,0.)),f.x),mix(hash(i+vec2(0.,1.)),hash(i+vec2(1.,1.)),f.x),f.y);}
 float flow(vec2 p){return noise(p)*.57+noise(p*2.03)*.28+noise(p*4.01)*.15;}
`;
const surfaceFragment=`
 varying vec2 vUv;
 uniform vec3 color;
 uniform float time,focus;
 ${noise}
 void main(){
  vec2 p=vUv*2.-1.;float r=length(p),angle=atan(p.y,p.x);
  float current=flow(p*3.+vec2(time*.12,-time*.16));
  float pool=exp(-r*r*6.)*(.2+current*.22);
  float ring=exp(-pow((r-.47)*52.,2.));
  float arcs=pow(.5+.5*sin(angle*3.+time*.55+r*8.),6.);
  float outer=exp(-pow((r-.69)*65.,2.))*arcs*.4;
  float center=exp(-r*r*65.)*.55;
  float fade=1.-smoothstep(.72,1.,r);
  gl_FragColor=vec4(color*(1.+center), (pool+ring*.48+outer+center)*fade*(.85+focus*.3));
  #include <colorspace_fragment>
 }
`;
const beamFragment=`
 varying vec2 vUv;
 uniform vec3 color;
 uniform float time,focus,strength;
 ${noise}
 void main(){
  float y=vUv.y,x=(vUv.x-.5)*2.;
  float drift=sin(y*9.-time*.75)*.055+sin(y*17.+time*.5)*.022;
  float width=mix(.42,.07,y);
  float mist=flow(vec2(x*3.+time*.1,y*5.-time*.55));
  float veil=exp(-pow((x+drift)/width,2.)*2.4)*(.17+mist*.3);
  float thread=exp(-pow((x+drift*.5)/(.017+.025*(1.-y)),2.))*.36;
  float silk=exp(-pow((x-drift-.12*sin(y*10.-time*.6))/.06,2.))*.1;
  float ends=smoothstep(0.,.065,y)*(1.-smoothstep(.38,1.,y));
  gl_FragColor=vec4(mix(color,vec3(1.),thread*.65),(veil+thread+silk)*ends*strength*(1.+focus*.25));
  #include <colorspace_fragment>
 }
`;
const auraFragment=`
 varying vec2 vUv;
 uniform vec3 color;
 uniform float time,focus,strength;
 void main(){
  vec2 p=vUv*2.-1.;float r=length(p);
  float halo=exp(-r*r*5.)*.32+exp(-r*r*24.)*.24;
  gl_FragColor=vec4(color,halo*(1.-smoothstep(.7,1.,r))*strength*(.94+sin(time*1.6)*.06+focus*.2));
  #include <colorspace_fragment>
 }
`;
const coreVertex=`
 varying vec2 vUv;
 varying vec3 vNormal,vView;
 void main(){
  vUv=uv;vNormal=normalize(normalMatrix*normal);
  vec4 mv=modelViewMatrix*vec4(position,1.);vView=-mv.xyz;
  gl_Position=projectionMatrix*mv;
 }
`;
// The same broad, advected currents as the vitality / essence glass.
const coreFragment=`
 varying vec2 vUv;
 varying vec3 vNormal,vView;
 uniform vec3 color;
 uniform float time,focus;
 ${noise}
 void main(){
  vec2 q=vUv*3.+vec2(sin(vUv.y*6.+time*.45)*.2,-time*.18);
  float silk=flow(q+flow(q+2.)*.65);
  float caustic=pow(1.-abs(sin(vUv.x*13.+vUv.y*8.+silk*4.-time*.55)),10.);
  vec3 n=normalize(vNormal);
  float rim=pow(1.-abs(dot(n,normalize(vView))),2.5);
  float gleam=pow(max(0.,dot(n,normalize(vec3(-.5,.8,1.)))),22.);
  vec3 light=color*(.22+silk*.85+caustic*.4+rim*.55);
  light+=mix(color,vec3(1.),.7)*(gleam*.8+rim*.16);
  gl_FragColor=vec4(light*(1.+focus*.18),1.);
  #include <colorspace_fragment>
 }
`;
const sparkVertex=`
 attribute float seed;
 varying float opacity;
 uniform float time,height,pixelRatio;
 void main(){
  float rise=fract(seed+time*(.1+seed*.035));
  float angle=seed*39.3+time*.35;
  float radius=(.15+seed*.3)*(1.-rise*.65);
  vec3 p=vec3(cos(angle)*radius,.16+rise*height,sin(angle)*radius);
  opacity=smoothstep(0.,.12,rise)*(1.-smoothstep(.55,1.,rise));
  gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.);
  gl_PointSize=(2.+seed*2.5)*pixelRatio;
 }
`;
const sparkFragment=`
 varying float opacity;
 uniform vec3 color;
 uniform float focus;
 void main(){
  vec2 p=gl_PointCoord*2.-1.;float r=dot(p,p);
  float glow=exp(-r*4.)*(1.-smoothstep(.4,1.,r));
  gl_FragColor=vec4(mix(color,vec3(1.),.35),glow*opacity*(.7+focus*.25));
  #include <colorspace_fragment>
 }
`;

export function createLootVisual(record,{reducedMotion=false,pixelRatio=1}={}){
 const model=new T.Group(),mesh=new T.Group();
 model.name=`loot-${record.id}`;mesh.name='loot-core';model.add(mesh);
 const isItem=record.kind==='item',isPotion=record.kind==='potion',legendary=record.rarity==='legendary';
 const height=isItem?(legendary?3.8:2.25):isPotion?1.15:.65;
 const tint=new T.Color(lootColor(record));
 let seed=0;for(const c of String(record.id))seed=(Math.imul(seed,31)+c.charCodeAt(0))>>>0;
 const phase=(seed%1000)/100;
 const uniforms={color:{value:tint},time:{value:phase},focus:{value:0},strength:{value:isItem?1:isPotion?.8:.55}};
 const luminous={transparent:true,blending:T.AdditiveBlending,depthWrite:false,toneMapped:false,fog:false};
 const material=(fragmentShader,vertexShader=vertex)=>new T.ShaderMaterial({...luminous,uniforms,vertexShader,fragmentShader});

 const radius=isItem?(legendary?1.35:1.05):isPotion?.82:.6;
 const ground=new T.Mesh(new T.PlaneGeometry(radius*2,radius*2),material(surfaceFragment));
 ground.name='loot-halo';ground.rotation.x=-Math.PI/2;ground.position.y=.13;model.add(ground);

 const aura=new T.Mesh(new T.PlaneGeometry(isItem?1.4:1.05,isItem?1.4:1.05),material(auraFragment,ribbonVertex));
 aura.position.y=.34;model.add(aura);
 if(isItem||isPotion){
  const beam=new T.Mesh(new T.PlaneGeometry(legendary?1.1:.8,height),material(beamFragment,ribbonVertex));
  beam.name='loot-beam';beam.position.y=height/2+.16;model.add(beam);
 }

 const coreMaterial=new T.ShaderMaterial({uniforms,vertexShader:coreVertex,fragmentShader:coreFragment,toneMapped:false});
 if(isPotion){
  const profile=[[0,-.2],[.11,-.19],[.17,-.13],[.18,.015],[.13,.12],[.065,.16],[.065,.24],[0,.24]].map(([x,y])=>new T.Vector2(x,y));
  mesh.add(new T.Mesh(new T.LatheGeometry(profile,20),coreMaterial));
  const stopper=new T.Mesh(new T.CylinderGeometry(.075,.07,.075,12),new T.MeshStandardMaterial({color:0xb8a789,metalness:.65,roughness:.3}));
  stopper.position.y=.25;mesh.add(stopper);
 }else{
  const geometry=isItem?new T.OctahedronGeometry(.24):new T.CylinderGeometry(.2,.2,.085,16);
  const core=new T.Mesh(geometry,coreMaterial);
  core.rotation.z=isItem?.16:.3;mesh.add(core);
 }

 const count=reducedMotion?4:legendary?18:isItem?11:isPotion?7:4;
 const geometry=new T.BufferGeometry();
 geometry.setAttribute('position',new T.Float32BufferAttribute(new Float32Array(count*3),3));
 geometry.setAttribute('seed',new T.Float32BufferAttribute(Array.from({length:count},(_,i)=>(i+.5)/count),1));
 // Animated positions live on the GPU; explicit bounds keep the whole plume visible.
 geometry.boundingSphere=new T.Sphere(new T.Vector3(0,height/2,0),height/2+.7);
 const sparks=new T.Points(geometry,new T.ShaderMaterial({
  ...luminous,uniforms:{...uniforms,height:{value:height},pixelRatio:{value:pixelRatio}},
  vertexShader:sparkVertex,fragmentShader:sparkFragment,
 }));
 sparks.name='loot-sparks';model.add(sparks);
 let disposed=false;
 const visual={model,mesh,update(time,highlighted=false){
  if(disposed)return;
  const t=reducedMotion?phase:time+phase;
  uniforms.time.value=t;uniforms.focus.value=highlighted?1:0;
  mesh.position.y=.36+(reducedMotion?0:Math.sin(t*1.7)*.045);
  mesh.rotation.y=reducedMotion?phase:t*.35;
 },dispose(){
  if(disposed)return;disposed=true;model.removeFromParent();
  const resources=new Set();model.traverse(node=>{if(node.geometry)resources.add(node.geometry);if(node.material)resources.add(node.material);});
  resources.forEach(resource=>resource.dispose());
 }};
 visual.update(0);return visual;
}
