import * as T from './vendor/three.core.js';
import {updateRangerWeapons} from './ranger-character-model.js';
import {updateOathkeeperPose} from './oathkeeper-character-model.js';

// Combat-only additive layers stay bright without washing out the moonlit world.
// Two persistent lights avoid recompiling scene materials for every cast / hit.
export function createCombatEffects(scene, glowTexture, {reducedMotion = false} = {}) {
 const bursts = [], bolts = new Set(), lights = [];
 const luminous = {transparent:true, blending:T.AdditiveBlending, depthWrite:false, toneMapped:false, fog:false};
 for (let i=0;i<2;i++) {const light=new T.PointLight(0xff7626,0,7,2);scene.add(light);lights.push(light);}

 function glow(parent, color, size, opacity=1) {
  const sprite=new T.Sprite(new T.SpriteMaterial({...luminous,map:glowTexture,color,opacity}));
  sprite.scale.set(size,size,1);parent.add(sprite);return sprite;
 }
 function dispose(root) {
  root.removeFromParent();
  root.traverse(node=>{if(!node.isSprite)node.geometry?.dispose();node.material?.dispose();});
 }
 function addBurst(root, life, animate, light=null) {
  scene.add(root);bursts.push({root,life,age:0,animate,light});animate(0,0);return root;
 }
 function flash(pos, color, size, life, coreColor=0xfff3ce) {
  const root=new T.Group();root.position.copy(pos);
  const halo=glow(root,color,size,.75),core=glow(root,coreColor,size*.4,1);
  return addBurst(root,life,p=>{
   halo.scale.setScalar(size*(.65+p*.65));halo.material.opacity=.8*(1-p)**2;
   core.scale.setScalar(size*(.15+.3*p));core.material.opacity=(1-p)**3;
  },{color,intensity:size*24});
 }
 function shockwave(pos, color, radius, life) {
  const mesh=new T.Mesh(new T.RingGeometry(.91,1,64),new T.MeshBasicMaterial({...luminous,color,side:T.DoubleSide}));
  mesh.rotation.x=-Math.PI/2;mesh.position.set(pos.x,.14,pos.z);
  addBurst(mesh,life,p=>{mesh.scale.setScalar(.15+radius*(1-(1-p)**3));mesh.material.opacity=.65*(1-p)**2;});
 }
 function sparks(pos, color, count, speed, life, direction=null) {
  if(reducedMotion)count=Math.ceil(count*.5);
  const positions=new Float32Array(count*6),velocity=new Float32Array(count*3);
  for(let i=0;i<count;i++) {
   const a=Math.random()*Math.PI*2,spread=speed*(.35+Math.random()*.65);
   velocity.set([Math.sin(a)*spread+(direction?.x||0)*speed*.3, .8+Math.random()*speed, Math.cos(a)*spread+(direction?.z||0)*speed*.3],i*3);
  }
  const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.BufferAttribute(positions,3));
  const streaks=new T.LineSegments(geometry,new T.LineBasicMaterial({...luminous,color}));
  streaks.position.copy(pos);streaks.frustumCulled=false;
  addBurst(streaks,life,(p,age)=>{
   for(let i=0;i<count;i++)for(let axis=0;axis<3;axis++) {
    const v=velocity[i*3+axis],tail=Math.max(0,age-.035*(1-p));
    positions[i*6+axis]=v*age-(axis===1?4*age*age:0);
    positions[i*6+3+axis]=v*tail-(axis===1?4*tail*tail:0);
   }
   geometry.attributes.position.needsUpdate=true;streaks.material.opacity=(1-p)**1.3;
  });
 }

 function emberbolt(pos, direction) {
  const mesh=new T.Group();mesh.position.copy(pos);mesh.rotation.y=Math.atan2(direction.x,direction.z);
  const core=new T.Mesh(new T.SphereGeometry(1,16,12),new T.MeshBasicMaterial({color:0xffefba,toneMapped:false,fog:false}));
  core.scale.set(.23,.23,.4);mesh.add(core);
  const shell=new T.Mesh(new T.SphereGeometry(1,16,12),new T.MeshBasicMaterial({...luminous,color:0xff861f,opacity:.4}));
  shell.scale.set(.36,.36,.55);mesh.add(shell);
  const halo=glow(mesh,0xff5414,3.5,.85),hot=glow(mesh,0xffca63,1.55,1);
  const tailGeometry=new T.BufferGeometry();
  tailGeometry.setAttribute('position',new T.Float32BufferAttribute([-.65,0,-3,.65,0,-3,-.65,0,.08,.65,0,.08],3));
  tailGeometry.setAttribute('uv',new T.Float32BufferAttribute([0,0,0,1,1,0,1,1],2));tailGeometry.setIndex([0,2,1,1,2,3]);
  const tailMaterial=new T.ShaderMaterial({
   ...luminous,side:T.DoubleSide,uniforms:{time:{value:0},opacity:{value:1}},
   vertexShader:'varying vec2 vUv; void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',
   fragmentShader:`varying vec2 vUv; uniform float time; uniform float opacity;
    void main(){
     float x=vUv.x;
     float center=(vUv.y-.5)*2.0;
     float ripple=sin(x*26.0-time*19.0)*.065+sin(x*43.0-time*27.0)*.025;
     float width=(.025+pow(x,1.2)*.48)*(1.0+ripple*2.0);
     float edge=abs(center+ripple*(1.0-x));
     float flame=1.0-smoothstep(width*.18,width,edge);
     float heat=pow(max(0.0,1.0-edge/width),3.0)*pow(x,.7);
     vec3 color=mix(vec3(1.0,.12,.015),vec3(1.0,.82,.32),heat);
     gl_FragColor=vec4(color,flame*smoothstep(0.0,.24,x)*opacity*.9);
    }`
  });
  const tail=new T.Mesh(tailGeometry,tailMaterial);mesh.add(tail);
  const crossedTail=new T.Mesh(tailGeometry.clone(),tailMaterial.clone());crossedTail.rotation.z=Math.PI/2;mesh.add(crossedTail);
  const count=reducedMotion?12:24,emberPositions=new Float32Array(count*3);
  const emberGeometry=new T.BufferGeometry();emberGeometry.setAttribute('position',new T.BufferAttribute(emberPositions,3));
  // PointsMaterial sizes are pixels with this game's orthographic camera.
  const embers=new T.Points(emberGeometry,new T.PointsMaterial({...luminous,map:glowTexture,color:0xffb849,size:6,sizeAttenuation:false,opacity:.95}));
  embers.frustumCulled=false;mesh.add(embers);
  const ground=new T.Mesh(new T.PlaneGeometry(3.7,3.7),new T.MeshBasicMaterial({...luminous,map:glowTexture,color:0xff661b,opacity:.35}));
  ground.rotation.x=-Math.PI/2;ground.position.y=.14-pos.y;mesh.add(ground);
  scene.add(mesh);
  const bolt={mesh,age:0,light:{color:0xff7424,intensity:34},update(dt){
   bolt.age+=dt;
   const pulse=reducedMotion?1:1+Math.sin(bolt.age*24)*.045;
   core.scale.set(.23*pulse,.23*pulse,.4);halo.scale.setScalar(3.5*pulse);hot.material.opacity=.9;
   shell.rotation.z=bolt.age*3;
   tailMaterial.uniforms.time.value=bolt.age;crossedTail.material.uniforms.time.value=bolt.age+.15;
   // Grow the trail behind the distance actually travelled, including on the first frame.
   const growth=Math.min(1,bolt.age*14/3);tail.scale.z=crossedTail.scale.z=growth;
   for(let i=0;i<count;i++) {
    const phase=(i/count+bolt.age*(.8+(i%3)*.12))%1,spread=.08+phase*.42;
    emberPositions.set([Math.sin(i*13.7+phase*4)*spread,Math.cos(i*7.3)*spread+phase*.18,-phase*3.4*growth],i*3);
   }
   emberGeometry.attributes.position.needsUpdate=true;
  },dispose(){if(!bolts.delete(bolt))return;dispose(mesh);}};
  bolts.add(bolt);bolt.update(0);return bolt;
 }
 function arcaneBolt(pos, direction, speed=17) {
  const mesh=new T.Group();mesh.position.copy(pos);mesh.rotation.y=Math.atan2(direction.x,direction.z);
  const coreMaterial=new T.ShaderMaterial({
   ...luminous,uniforms:{time:{value:0}},
   vertexShader:`varying vec3 vNormal; varying vec3 vView; varying vec3 vLocal;
    void main(){
     vLocal=position;vNormal=normalize(normalMatrix*normal);
     vec4 view=modelViewMatrix*vec4(position,1.0);vView=-view.xyz;
     gl_Position=projectionMatrix*view;
    }`,
   fragmentShader:`varying vec3 vNormal; varying vec3 vView; varying vec3 vLocal; uniform float time;
    void main(){
     float rim=pow(1.0-abs(dot(normalize(vNormal),normalize(vView))),2.0);
     float flow=sin(vLocal.z*19.0-time*13.0+sin(vLocal.x*12.0+time*5.0)*1.8)*.5+.5;
     vec3 edge=mix(vec3(.24,.12,1.0),vec3(.16,.8,1.0),flow);
     vec3 color=mix(vec3(.78,.98,1.0),edge,rim*.85);
     gl_FragColor=vec4(color,.92);
    }`
  });
  const core=new T.Mesh(new T.SphereGeometry(1,24,16),coreMaterial);
  core.scale.set(.2,.2,.38);mesh.add(core);
  const halo=glow(mesh,0x7454ff,2.9,.65),hot=glow(mesh,0x80eaff,1.45,.95);
  const tip=glow(mesh,0xe4fcff,.65,1);tip.position.z=.15;
  // Crossed ribbons keep the helix readable from every isometric facing.
  const trailLength=2.8,tailGeometry=new T.BufferGeometry();
  tailGeometry.setAttribute('position',new T.Float32BufferAttribute([-.55,0,-trailLength,.55,0,-trailLength,-.55,0,.06,.55,0,.06],3));
  tailGeometry.setAttribute('uv',new T.Float32BufferAttribute([0,0,0,1,1,0,1,1],2));tailGeometry.setIndex([0,2,1,1,2,3]);
  const tailMaterial=new T.ShaderMaterial({
   ...luminous,side:T.DoubleSide,uniforms:{time:{value:0},phase:{value:0}},
   vertexShader:'varying vec2 vUv; void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',
   fragmentShader:`varying vec2 vUv; uniform float time; uniform float phase;
    void main(){
     float x=vUv.x,y=(vUv.y-.5)*2.0;
     float taper=pow(x,.7);
     float envelope=smoothstep(0.0,.22,x)*(1.0-smoothstep(.95,1.0,x));
     float wave=sin(x*18.0-time*12.0+phase)*(.04+.27*(1.0-x))*taper;
     float width=.016+.055*taper;
     float ribbonA=1.0-smoothstep(width*.2,width,abs(y-wave));
     float ribbonB=1.0-smoothstep(width*.2,width,abs(y+wave));
     float spine=exp(-abs(y)*55.0)*(.35+x*.65);
     float aura=exp(-abs(y)*9.0)*.2;
     vec3 energy=vec3(.22,.12,1.0)*ribbonA+vec3(.16,.8,1.0)*ribbonB;
     energy+=vec3(.64,.96,1.0)*spine+vec3(.22,.16,.85)*aura;
     gl_FragColor=vec4(energy,envelope*.85);
    }`
  });
  const tail=new T.Mesh(tailGeometry,tailMaterial),crossedTail=new T.Mesh(tailGeometry.clone(),tailMaterial.clone());
  crossedTail.rotation.z=Math.PI/2;crossedTail.material.uniforms.phase.value=Math.PI/2;mesh.add(tail,crossedTail);
  const count=reducedMotion?10:20,positions=new Float32Array(count*3),colors=new Float32Array(count*3);
  for(let i=0;i<count;i++)new T.Color(i%3?0x9cefff:0x9673ff).toArray(colors,i*3);
  const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.BufferAttribute(positions,3));geometry.setAttribute('color',new T.BufferAttribute(colors,3));
  const motes=new T.Points(geometry,new T.PointsMaterial({...luminous,map:glowTexture,vertexColors:true,size:5,sizeAttenuation:false,opacity:.85}));
  motes.frustumCulled=false;mesh.add(motes);
  const ground=new T.Mesh(new T.PlaneGeometry(3,3),new T.MeshBasicMaterial({...luminous,map:glowTexture,color:0x6a8cff,opacity:.28}));
  ground.rotation.x=-Math.PI/2;ground.position.y=.14-pos.y;mesh.add(ground);scene.add(mesh);
  const bolt={mesh,age:0,light:{color:0x779dff,intensity:28},update(dt){
   bolt.age+=dt;
   const time=reducedMotion?0:bolt.age,pulse=reducedMotion?1:1+Math.sin(time*18)*.035;
   core.scale.set(.2*pulse,.2*pulse,.38);halo.scale.setScalar(2.9*pulse);
   coreMaterial.uniforms.time.value=time;tailMaterial.uniforms.time.value=time;crossedTail.material.uniforms.time.value=time;
   // A newborn bolt must never draw a full trail through the caster or a wall behind them.
   const growth=Math.min(1,bolt.age*speed/trailLength);tail.scale.z=crossedTail.scale.z=growth;
   motes.material.opacity=.85*growth;
   for(let i=0;i<count;i++){
    const phase=(i/count+time*.9)%1,spiral=i*2.4-time*5,spread=.06+phase*.18;
    positions.set([Math.cos(spiral)*spread,Math.sin(spiral)*spread,-phase*trailLength*growth],i*3);
   }
   geometry.attributes.position.needsUpdate=true;
  },dispose(){if(!bolts.delete(bolt))return;dispose(mesh);}};
  bolts.add(bolt);bolt.update(0);return bolt;
 }
 function arcaneWave(pos, radius, life) {
  const material=new T.ShaderMaterial({...luminous,side:T.DoubleSide,uniforms:{progress:{value:0}},
   vertexShader:'varying vec2 vUv; void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',
   fragmentShader:`varying vec2 vUv; uniform float progress;
    void main(){
     vec2 point=vUv*2.0-1.0;float radius=length(point);
     float ring=1.0-smoothstep(.025,.12,abs(radius-.76));
     float angle=atan(point.y,point.x);
     float facets=.55+.45*pow(.5+.5*cos(angle*8.0),6.0);
     vec3 color=mix(vec3(.36,.2,1.0),vec3(.55,.94,1.0),ring);
     gl_FragColor=vec4(color,ring*facets*pow(1.0-progress,2.0)*.85);
    }`});
  const wave=new T.Mesh(new T.PlaneGeometry(2,2),material);wave.position.set(pos.x,.15,pos.z);wave.rotation.x=-Math.PI/2;
  addBurst(wave,life,p=>{wave.scale.setScalar(radius*(.25+.75*(1-(1-p)**3)));material.uniforms.progress.value=p;});
 }
 function arcaneCast(pos, direction) {
  flash(pos,0x8a6aff,1.85,.24,0xd9faff);sparks(pos,0x9dedff,10,1.9,.28,direction);
 }
 function arcaneImpact(pos, direction) {
  flash(pos,0x7861ff,2.8,.32,0xddfcff);arcaneWave(pos,1.3,.36);sparks(pos,0xacefff,22,3.8,.42,direction);
 }
 function cast(pos, direction) {flash(pos,0xff902e,2.2,reducedMotion?.28:.22);sparks(pos,0xffd284,12,2.3,.3,direction);}
 function emberImpact(pos, direction) {
  flash(pos,0xff711c,3.6,.4);shockwave(pos,0xffa348,1.65,.42);sparks(pos,0xffd99c,26,4.6,.55,direction);
 }
 function steelImpact(pos) {flash(pos,0xafdfff,1.45,.18);sparks(pos,0xffe0a6,16,4.2,.34);}

 function cleave(player, angle) {
  const root=new T.Group();root.position.copy(player.position);root.rotation.y=angle;
  function arc(inner,outer,color,opacity) {
   const positions=[],uvs=[],indices=[],segments=56;
   for(let i=0;i<=segments;i++) {
    const u=i/segments,a=-1.05+u*2.1;
    for(const r of [inner,outer]){positions.push(Math.sin(a)*r,1.02+(u-.5)*-.2,Math.cos(a)*r);uvs.push(u,r===inner?0:1);}
    if(i<segments){const n=i*2;indices.push(n,n+1,n+2,n+1,n+3,n+2);}
   }
   const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.Float32BufferAttribute(positions,3));geometry.setAttribute('uv',new T.Float32BufferAttribute(uvs,2));geometry.setIndex(indices);
   const material=new T.ShaderMaterial({...luminous,side:T.DoubleSide,uniforms:{color:{value:new T.Color(color)},opacity:{value:opacity},progress:{value:0}},
    vertexShader:'varying vec2 vUv; void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',
    fragmentShader:`varying vec2 vUv;uniform vec3 color;uniform float opacity;uniform float progress;
     void main(){
      float across=smoothstep(0.0,.2,vUv.y)*(1.0-smoothstep(.8,1.0,vUv.y));
      float ends=pow(max(0.0,sin(vUv.x*3.141593)),.45);
      float head=1.0-smoothstep(progress-.12,progress,vUv.x);
      gl_FragColor=vec4(color,across*ends*head*opacity);
     }`});
   const mesh=new T.Mesh(geometry,material);root.add(mesh);return {mesh,opacity};
  }
  const layers=[arc(1.65,2.86,0x428dcd,.3),arc(2.27,2.78,0x9bddff,.75),arc(2.69,2.8,0xedfaff,1)];
  addBurst(root,reducedMotion?.3:.28,p=>{
   root.position.copy(player.position);
   for(const layer of layers){layer.mesh.material.uniforms.progress.value=Math.min(1.14,.2+p*3.2);layer.mesh.material.uniforms.opacity.value=layer.opacity*(1-p)**.8;}
  });
 }
 function update(dt, externalLights=[]) {
  for(let i=bursts.length-1;i>=0;i--) {
   const burst=bursts[i];burst.age+=dt;
   if(burst.age>=burst.life){dispose(burst.root);bursts.splice(i,1);}else burst.animate(burst.age/burst.life,burst.age);
  }
  const sources=[...externalLights,...[...bolts].map(b=>({position:b.mesh.position,...b.light}))];
  for(const b of bursts)if(b.light)sources.push({position:b.root.position,color:b.light.color,intensity:b.light.intensity*(1-b.age/b.life)**2});
  sources.sort((a,b)=>b.intensity-a.intensity);
  lights.forEach((light,i)=>{const source=sources[i];light.intensity=source?.intensity||0;if(source){light.position.copy(source.position);light.color.setHex(source.color);}});
 }
 return {emberbolt,arcaneBolt,cast,arcaneCast,emberImpact,arcaneImpact,steelImpact,cleave,update,dispose(){for(const b of [...bolts])b.dispose();for(const b of bursts)dispose(b.root);bursts.length=0;for(const light of lights){light.removeFromParent();light.dispose();}}};
}

// Separate cast and sword poses keep the release readable at the existing hit time.
export function animateHeroAttack(rig, dt) {
 rig.attack=Math.max(0,(rig.attack||0)-dt);
 updateRangerWeapons(rig);
 updateOathkeeperPose(rig,dt);
 const arm=rig.arms.find(a=>a.name==='armR'),shield=rig.arms.find(a=>a.name==='armL');
 rig.body.rotation.y=0;rig.body.position.z=0;
 for(const a of rig.arms){a.rotation.y=0;a.rotation.z=0;}
 if(!rig.attack||!arm)return;
 const duration=rig.attackKind==='bolt'?.36:.42,p=1-rig.attack/duration;
 if(rig.oathkeeper){
  const lift=Math.sin(p*Math.PI);
  if(rig.attackKind==='bolt'){arm.rotation.x=-.06;if(shield){shield.rotation.set(-1.05-lift*.12,0,.08);rig.oathkeeper.blaster.rotation.x=-shield.rotation.x;}}
  else {arm.rotation.set(-.20-lift*.18,0,-.13);if(shield)shield.rotation.set(-.35-lift*.3,0,.3);}
 } else if(rig.attackKind==='bolt'&&rig.rangerWeapons) {
  const draw=Math.sin(p*Math.PI),release=Math.max(0,(p-.6)/.4);
  arm.rotation.set(-.92-draw*.38,-.12,-.12);
  // Counter the arm lift so the longbow stays upright through the draw.
  rig.rangerWeapons.bow.rotation.set(-arm.rotation.x,-Math.PI/2,.10);
  if(shield)shield.rotation.set(-.96-draw*.2,.95-draw*.6,.18+release*.12);
  rig.body.rotation.y=-draw*.17;rig.body.position.z=-draw*.05;
 } else if(rig.attackKind==='bolt') {
  const release=Math.sin(p*Math.PI);
  arm.rotation.set(-.55-release*.3,-.15,-.16);rig.body.rotation.x=-release*.14;rig.body.position.z=-release*.1;
  if(shield)shield.rotation.x=-.3-release*.2;
 } else if(rig.attackKind==='paired') {
  // The right and left cuts peak at the authoritative .11s / .24s hit times.
  const elapsed=.42-rig.attack,right=Math.sin(Math.min(1,elapsed/.22)*Math.PI),left=Math.sin(Math.max(0,Math.min(1,(elapsed-.13)/.22))*Math.PI);
  arm.rotation.set(-.35-right*.6,-.9+right*1.8,-.16-right*.2);
  if(shield)shield.rotation.set(-.35-left*.6,.9-left*1.8,.16+left*.2);
  rig.body.rotation.y=(right-left)*.3;rig.body.position.z=(right+left)*.06;
 } else {
  const windup=.11/.42,strike=.22/.42;
  const swing=p<windup?-p/windup:p<strike?-1+2*(1-(1-(p-windup)/(strike-windup))**3):1-((p-strike)/(1-strike));
  const force=Math.sin(p*Math.PI);
  arm.rotation.set(-.25-force*.45,swing*1.25,-.16-force*.3);
  rig.body.rotation.y=swing*.4;rig.body.rotation.x=force*.14;rig.body.rotation.z=-swing*.07;rig.body.position.z=force*.12;
  if(shield){shield.rotation.x=-.45-force*.2;shield.rotation.y=-swing*.25;}
 }
}
