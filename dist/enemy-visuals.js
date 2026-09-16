import * as T from './vendor/three.core.js';
import {disposeSubtree} from './dispose.js';

const luminous={transparent:true,blending:T.AdditiveBlending,depthWrite:false,toneMapped:false,fog:false};
function sprite(parent,texture,color,size,opacity){
 const mesh=new T.Sprite(new T.SpriteMaterial({...luminous,map:texture,color,opacity}));mesh.scale.setScalar(size);parent.add(mesh);return mesh;
}
function energyOrb(texture,color){
 const root=new T.Group(),uniforms={time:{value:0},color:{value:new T.Color(color)}};
 const material=new T.ShaderMaterial({...luminous,uniforms,
  vertexShader:`varying vec3 vPoint;varying vec3 vNormal;varying vec3 vView;
   void main(){vPoint=position;vNormal=normalize(normalMatrix*normal);vec4 p=modelViewMatrix*vec4(position,1.);vView=-p.xyz;gl_Position=projectionMatrix*p;}`,
  fragmentShader:`varying vec3 vPoint;varying vec3 vNormal;varying vec3 vView;uniform float time;uniform vec3 color;
   void main(){
    float rim=pow(1.-abs(dot(normalize(vNormal),normalize(vView))),1.7);
    float flow=sin(vPoint.y*19.-time*6.+sin(vPoint.x*13.+time*3.)*2.+vPoint.z*9.);
    float veins=pow(.5+.5*flow,7.);
    vec3 light=mix(color,vec3(1.,.96,.87),.35+veins*.55);
    gl_FragColor=vec4(light*(.85+veins*.7),.8+rim*.2);
   }`});
 const core=new T.Mesh(new T.SphereGeometry(.27,20,14),material);root.add(core);
 const halo=sprite(root,texture,color,2.15,.65),hot=sprite(root,texture,0xfff0dc,.75,.8);
 const orbit=new T.Mesh(new T.TorusGeometry(.39,.017,5,40),new T.MeshBasicMaterial({...luminous,color,opacity:.75}));orbit.rotation.x=.8;root.add(orbit);
 return {root,update(time){uniforms.time.value=time;orbit.rotation.z=time*.8;hot.material.opacity=.75;halo.material.opacity=.58;}};
}
function releaseGeometry(root){disposeSubtree(root,{removeFromParent:'after',order:'interleaved',skipSpriteGeometry:true,arrayMaterials:false});}

// Reuse each creature's existing material/shadow shader, adding animated emissive
// veins and a Fresnel edge. No duplicate body meshes or per-enemy point lights.
// Exported so effects-warmup.js can pre-stage the (fixed, shared) program it patches
// MeshStandardMaterial into -- see that file's top comment.
export function enchantBody(model,color){
 const uniforms={enemyTime:{value:0},enemyCharge:{value:0},enemyAlive:{value:1},enemyColor:{value:new T.Color(color)}},seen=new Set();
 model.traverse(n=>{for(const m of n.material?(Array.isArray(n.material)?n.material:[n.material]):[]){
  if(!m.isMeshStandardMaterial||seen.has(m))continue;seen.add(m);
  m.onBeforeCompile=shader=>{
   Object.assign(shader.uniforms,uniforms);
   shader.vertexShader='varying vec3 enemyPoint;\n'+shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nenemyPoint=position;');
   shader.fragmentShader='varying vec3 enemyPoint;uniform float enemyTime;uniform float enemyCharge;uniform float enemyAlive;uniform vec3 enemyColor;\n'+shader.fragmentShader.replace('#include <emissivemap_fragment>',`#include <emissivemap_fragment>
    float edge=pow(1.-abs(dot(normal,normalize(vViewPosition))),2.6);
    float flow=sin(enemyPoint.y*24.-enemyTime*3.+sin(enemyPoint.x*21.+enemyPoint.z*12.)*2.);
    float veins=pow(.5+.5*flow,12.);
    totalEmissiveRadiance+=enemyColor*(edge*(.10+enemyCharge*.8)+veins*enemyCharge*.5)*enemyAlive;`);
  };
  m.customProgramCacheKey=()=> 'enemy-enchantment-v1';m.needsUpdate=true;
 }});
 return uniforms;
}
function mesh(parent,geometry,material,position){const m=new T.Mesh(geometry,material);m.position.set(...position);m.castShadow=true;parent.add(m);return m;}
function knife(parent,side,paired=false){
 const root=new T.Group();root.position.set(side*.12,-.76,.43);parent.add(root);
 const steel=new T.MeshStandardMaterial({color:0xd0dcda,metalness:.8,roughness:.25,emissive:0x668385,emissiveIntensity:.45});
 const grip=new T.MeshStandardMaterial({color:0x453b32,roughness:.8});
 mesh(root,new T.CylinderGeometry(.04,.045,.22,7),grip,[0,0,0]).rotation.x=Math.PI/2;
 mesh(root,new T.BoxGeometry(.27,.065,.065),steel,[0,0,.12]);
 const blade=new T.Shape();blade.moveTo(-.065,0);blade.lineTo(.065,0);blade.lineTo(.055,.4);blade.lineTo(-.035,paired?.75:.65);blade.lineTo(-.065,.3);blade.closePath();
 const geometry=new T.ExtrudeGeometry(blade,{depth:.035,bevelEnabled:false});geometry.rotateX(Math.PI/2);
 mesh(root,geometry,steel,[0,.018,.15]);return root;
}
function mouth(head,hound){
 const root=new T.Group();root.position.set(0,hound?-.12:-.105,hound?.2:.13);head.add(root);
 const dark=new T.MeshStandardMaterial({color:0x190e12,roughness:.9}),bone=new T.MeshStandardMaterial({color:0xe1d4ae,roughness:.7});
 const jaw=new T.Group();root.add(jaw);
 const flesh=mesh(jaw,new T.SphereGeometry(1,10,7),dark,[0,-.045,.14]);flesh.scale.set(hound?.17:.18,.065,hound?.25:.16);
 for(const side of [-1,1])for(let i=0;i<3;i++){
  mesh(jaw,new T.ConeGeometry(.03,i===2?.14:.09,5),bone,[side*.13,.015,.08+i*.07]);
  const tooth=mesh(root,new T.ConeGeometry(.028,.10,5),bone,[side*.13,.035,.08+i*.07]);tooth.rotation.z=Math.PI;
 }
 return {root,jaw};
}

export function createEnemyVisuals(e,texture,{reducedMotion=false}={}){
 const {model,data,rig}=e,owned=[],base=data.modelType||e.type,head=model.getObjectByName('head');
 model.scale.multiplyScalar(data.scale||1);
 if(data.tint){const seen=new Set();model.traverse(n=>{const m=n.material;if(m?.color&&!seen.has(m)){m.color.multiply(new T.Color(data.tint));seen.add(m);}});}
 if(data.attackStyle==='knife')for(const side of data.paired?[-1,1]:[1]){const arm=model.getObjectByName(side<0?'armL':'armR');if(arm)owned.push(knife(arm,side,data.paired));}
 const bite=data.attackStyle==='bite'&&head?mouth(head,base==='hound'):null;if(bite)owned.push(bite.root);
 if(data.attackStyle==='bite'&&base==='hollow'){head.scale.set(1.25,1.1,1.3);rig.body.scale.set(1.05,.88,1.14);}
 if(data.spines&&rig.body){const root=new T.Group();rig.body.add(root);owned.push(root);const bone=new T.MeshStandardMaterial({color:data.tint,metalness:.35,roughness:.4});for(let i=0;i<5;i++){const spike=mesh(root,new T.ConeGeometry(.085,.35+(i%2)*.15,5),bone,[(i%2?1:-1)*.23,.32,-.3+i*.12]);spike.rotation.z=(i%2?1:-1)*-.6;}}
 const magic=data.large||data.attackStyle==='orb',enchantment=magic?enchantBody(model,data.orbColor):null;
 const orbs=[];
 if(magic)for(const side of data.large?[-1,1]:[-1]){const orb=energyOrb(texture,data.orbColor);orb.root.position.set(side*.76,side<0?1.35:1.7,.65);model.add(orb.root);orb.root.visible=false;orbs.push(orb);owned.push(orb.root);}
 const light={position:new T.Vector3(),color:new T.Color(data.orbColor).getHex(),intensity:0};
 const bodyZ=rig.body?.position.z||0;let release=0;
 return {light,
  strike(){release=.38;},
  update(n,dt,time){
   const alive=n.hp>0,windup=alive&&n.phase==='windup'?Math.max(0,Math.min(1,1-n.timer/data.windup)):0;
   release=alive?Math.max(0,release-dt):0;const impact=release/.38,charge=windup||impact;
   if(enchantment){enchantment.enemyTime.value=reducedMotion?0:time;enchantment.enemyCharge.value=charge;enchantment.enemyAlive.value=alive?1:0;}
   orbs.forEach((orb,i)=>{orb.root.visible=alive&&charge>0;orb.root.scale.setScalar(.4+charge*.95);orb.root.position.z=.65+impact*.5;orb.update(reducedMotion?0:time+i);});
   light.intensity=alive&&charge?12+charge*22:0;
   if(light.intensity){model.updateWorldMatrix(true,false);light.position.copy(model.position);light.position.y=1.8;}
   if(!alive)return;
   if(rig.body){rig.body.position.z=bodyZ;rig.body.rotation.y=0;}
   if(data.attackStyle==='knife'){
    for(const arm of rig.arms){const right=arm.name==='armR';arm.rotation.y=0;arm.rotation.z=0;if(right||data.paired){const side=right?1:-1;arm.rotation.x=-.45-windup*.75-impact*.3;arm.rotation.y=side*(-windup*.9+impact*1.5);arm.rotation.z=-side*(.12+charge*.2);}}
    if(rig.body){rig.body.rotation.y=-windup*.2+impact*.35;rig.body.position.z=bodyZ+impact*.18;}
   }else if(bite){
    bite.jaw.rotation.x=-(windup*.85+impact*.08);
    head.rotation.x=-windup*.25+impact*.4;
    if(rig.body){rig.body.rotation.x=-windup*.14+impact*.22;rig.body.position.z=bodyZ+impact*.3;}
   }else if(magic&&charge){for(const arm of rig.arms)arm.rotation.x=-.7-windup*.6+impact*.3;}
  },
  dispose(){for(const root of owned)releaseGeometry(root);}
 };
}

export function createEnemyOrb(scene,texture,position,angle,color,{reducedMotion=false}={}){
 const orb=energyOrb(texture,color),mesh=orb.root;mesh.position.copy(position);mesh.rotation.y=angle;
 const trails=[];for(let i=0;i<(reducedMotion?3:6);i++){const tail=sprite(mesh,texture,color,.85-i*.08,.3-i*.035);trails.push(tail);}
 const ground=new T.Mesh(new T.PlaneGeometry(2.6,2.6),new T.MeshBasicMaterial({...luminous,map:texture,color,opacity:.22}));ground.rotation.x=-Math.PI/2;ground.position.y=.08-position.y;mesh.add(ground);
 scene.add(mesh);let time=0,disposed=false;
 return {mesh,light:{position:mesh.position,color:new T.Color(color).getHex(),intensity:20},
  update(dt){time+=dt;orb.update(reducedMotion?0:time);trails.forEach((tail,i)=>tail.position.set(Math.sin(time*4-i)*.06,Math.cos(time*3-i)*.06,-(i+1)*.24*Math.min(1,time*8)));},
  dispose(){if(disposed)return;disposed=true;releaseGeometry(mesh);}
 };
}
