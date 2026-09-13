import * as T from './vendor/three.core.js';
import {effectMaterial} from './class-effect-materials.js';

const PALETTES={
 ranger:{color:0x83d8ad,hot:0xe7ffce,style:0},
 reaver:{color:0xda3d35,hot:0xffc88b,style:1},
 nightblade:{color:0x78649d,hot:0xdac8ff,style:2},
 oathkeeper:{color:0xe8b85d,hot:0xfff3ca,style:4},
 alchemist:{color:0x8abb37,hot:0xe9ff9f,style:3},
 geralt:{color:0xf3b13f,hot:0xffedbc,style:5}
};
const palette=id=>PALETTES[id]||PALETTES.ranger;
const mesh=(root,geometry,material,x=0,y=0,z=0)=>{const m=new T.Mesh(geometry,material);m.position.set(x,y,z);root.add(m);return m;};
const metal=(color=0xc6d1d4)=>new T.MeshStandardMaterial({color,metalness:.78,roughness:.27});
function solid(root,geometry,material,x=0,y=0,z=0){const m=mesh(root,geometry,material,x,y,z);m.castShadow=m.receiveShadow=true;return m;}
function plane(root,kind,radius,p,y=.14,opacity=1){const m=mesh(root,new T.PlaneGeometry(radius*2,radius*2),effectMaterial(kind,p.color,p.hot,{style:p.style,opacity}),0,y);m.rotation.x=-Math.PI/2;return m;}
function shade(root,radius,y=.08,opacity=.23){return plane(root,'shadow',radius,palette('nightblade'),y,opacity);}
function animateMaterials(root,time,opacity=1){
 const materials=new Set();root.traverse(n=>{if(n.material)for(const m of Array.isArray(n.material)?n.material:[n.material])materials.add(m);});
 for(const m of materials)if(m.uniforms){m.uniforms.time.value=time;m.userData.baseOpacity??=m.uniforms.opacity.value;m.uniforms.opacity.value=m.userData.baseOpacity*opacity;}
}
export function disposeClassEffect(root){
 if(root.userData.effectDisposed)return;root.userData.effectDisposed=true;root.removeFromParent();
 const geometry=new Set(),materials=new Set();root.traverse(n=>{if(n.geometry&&!n.isSprite)geometry.add(n.geometry);if(n.material)for(const m of Array.isArray(n.material)?n.material:[n.material])materials.add(m);});
 geometry.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());
}
function motes(root,p,count=24){
 const positions=new Float32Array(count*3),g=new T.BufferGeometry();g.setAttribute('position',new T.BufferAttribute(positions,3));
 const points=new T.Points(g,effectMaterial('mote',p.color,p.hot));points.frustumCulled=false;root.add(points);
 return (time,radius,height,fall=false)=>{
  for(let i=0;i<count;i++){const a=i*2.39996+time*.25,r=radius*Math.sqrt((i+.5)/count),phase=(i/count+time*.5)%1;
   positions.set([Math.sin(a)*r,(fall?1-phase:phase)*height+.12,Math.cos(a)*r],i*3);}
  g.attributes.position.needsUpdate=true;
 };
}
function ribbons(root,p,length,width=.2){
 const geometry=new T.BufferGeometry();
 geometry.setAttribute('position',new T.Float32BufferAttribute([-width,0,-length,width,0,-length,-width,0,0,width,0,0],3));
 geometry.setAttribute('uv',new T.Float32BufferAttribute([0,0,0,1,1,0,1,1],2));geometry.setIndex([0,2,1,1,2,3]);
 const material=effectMaterial('trail',p.color,p.hot),a=mesh(root,geometry,material),b=mesh(root,geometry,material);b.rotation.z=Math.PI/2;
 a.name=b.name='flight-ribbon';return [a,b];
}

export function createClassProjectile(scene,projectile,{reducedMotion=false}={}){
 const id=projectile.classId||(projectile.visual==='knife'?'nightblade':projectile.visual==='venom'?'alchemist':'ranger'),p=palette(id);
 const root=new T.Group();root.name=`${id}-${projectile.action||'attack'}-projectile`;root.position.set(projectile.x,1.15,projectile.z);root.rotation.y=projectile.angle;
 const empowered=projectile.action==='bolt'||projectile.action==='nova',knife=projectile.visual==='knife',venom=projectile.visual==='venom';
 if(projectile.visual==='radiant'){
  const core=mesh(root,new T.OctahedronGeometry(.095),effectMaterial('ward',p.color,p.hot));core.scale.z=2.1;
  const tails=ribbons(root,p,1.6,.12);scene.add(root);let age=0;
  return {mesh:root,light:{color:p.color,intensity:8},update(dt){age+=dt;animateMaterials(root,reducedMotion?0:age);for(const tail of tails)tail.scale.z=Math.min(1,age*(projectile.speed||24)/1.6);},dispose(){disposeClassEffect(root);}};
 }
 const shaft=solid(root,new T.CylinderGeometry(.023,.023,knife?.42:.95,8),metal(knife?0x646477:0x705f40));shaft.rotation.x=Math.PI/2;
 const blade=solid(root,new T.OctahedronGeometry(1,0),metal(),0,0,knife?.22:.53);blade.scale.set(knife?.105:.072,.025,knife?.4:.22);
 if(knife){solid(root,new T.BoxGeometry(.27,.045,.055),metal(0x887895),0,0,-.08);}
 else{for(const angle of [0,Math.PI/2]){const fin=solid(root,new T.BoxGeometry(.2,.018,.2),metal(0xb6c9a0),0,0,-.36);fin.rotation.z=angle;}}
 if(venom){const vial=mesh(root,new T.SphereGeometry(.12,16,10),effectMaterial('ward',p.color,p.hot),0,0,.33);vial.scale.z=1.8;}
 const length=empowered?2.7:1.65,tails=ribbons(root,p,length,knife?.28:empowered?.27:.16);
 const shadow=shade(root,.6,-1.06,.3);shadow.scale.set(.4,1.5,1);
 plane(root,'ground',empowered?.75:.45,p,-1.02,.18);
 scene.add(root);let age=0;
 const effect={mesh:root,light:{color:p.color,intensity:empowered?15:7},update(dt){
  age+=dt;const time=reducedMotion?0:age;animateMaterials(root,time);
  for(const tail of tails)tail.scale.z=Math.min(1,age*(projectile.speed||20)/length);
 },dispose(){disposeClassEffect(root);}};effect.update(0);return effect;
}

function cloudBank(root,p,radius,{reducedMotion=false}={}){
 const clouds=[],geometry=new T.SphereGeometry(1,24,16),material=effectMaterial('cloud',p.color,p.hot,{opacity:.62});
 for(let i=0;i<5;i++){
  const a=i*2.4,r=radius*(i?.46:0),m=mesh(root,geometry,material,Math.sin(a)*r,.5+(i%2)*.28,Math.cos(a)*r);
  m.scale.set(radius*.5,.55+(i%3)*.18,radius*.48);clouds.push(m);
 }
 return time=>{for(let i=0;i<clouds.length;i++){clouds[i].rotation.y=reducedMotion?i:time*.13*(i%2?1:-1)+i;clouds[i].position.y=.5+(i%2)*.28+(reducedMotion?0:Math.sin(time*1.1+i)*.07);}};
}
function sweep(root,p,radius,arc=Math.PI*2){
 const positions=[],uvs=[],indices=[],segments=72;
 for(let i=0;i<=segments;i++){const u=i/segments,a=(u-.5)*arc;for(const r of [radius*.63,radius]){positions.push(Math.sin(a)*r,.85+Math.sin(u*Math.PI)*.18,Math.cos(a)*r);uvs.push(u,r===radius?1:0);}if(i<segments){const n=i*2;indices.push(n,n+1,n+2,n+1,n+3,n+2);}}
 const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(positions,3));g.setAttribute('uv',new T.Float32BufferAttribute(uvs,2));g.setIndex(indices);
 return mesh(root,g,effectMaterial('trail',p.color,p.hot));
}
function debris(root,p,count=9){
 const g=new T.OctahedronGeometry(.09),material=p.style===3?new T.MeshPhysicalMaterial({color:0xb8dd96,metalness:.12,roughness:.12,transparent:true,opacity:.75,depthWrite:false}):metal(0x5e5551),pieces=new T.InstancedMesh(g,material,count);pieces.castShadow=pieces.receiveShadow=true;pieces.frustumCulled=false;root.add(pieces);
 const dummy=new T.Object3D();return (time,radius,burst=false)=>{
  for(let i=0;i<count;i++){const a=i*2.399+time*1.7,r=radius*(burst?.3+time*.7:.72+(i%3)*.08),height=burst?Math.max(.07,Math.sin(Math.min(1,time)*Math.PI)*(.6+i*.12)):.16+(i%3)*.12;
   dummy.position.set(Math.sin(a)*r,height,Math.cos(a)*r);dummy.rotation.set(time*3+i,a,i);const size=burst?Math.max(.02,1-time):1;dummy.scale.set(size,size*(1+(i%3)),size);dummy.updateMatrix();pieces.setMatrixAt(i,dummy.matrix);}
  pieces.instanceMatrix.needsUpdate=true;
 };
}
function createSupportZone(scene,zone,{reducedMotion=false,actorFor=()=>null}={}){
 const root=new T.Group();root.name='oathkeeper-staff-tether';
 const p=palette('oathkeeper'),geometry=new T.BufferGeometry(),positions=new Float32Array(17*6*3),uvs=[],indices=[];
 for(let i=0;i<=16;i++)for(let j=0;j<6;j++){uvs.push(i/16,j/6);if(i<16){const a=i*6+j,b=i*6+(j+1)%6;indices.push(a,b,a+6,b,b+6,a+6);}}
 geometry.setAttribute('position',new T.BufferAttribute(positions,3));geometry.setAttribute('uv',new T.Float32BufferAttribute(uvs,2));geometry.setIndex(indices);
 const beam=mesh(root,geometry,effectMaterial('ward',p.color,p.hot));beam.frustumCulled=false;
 const ground=plane(root,'ground',.65,p,.15,.55),start=new T.Vector3(),end=new T.Vector3();scene.add(root);
 const effect={mesh:root,light:{color:p.color,intensity:9},update(data,time){
  const source=actorFor(data.casterId),target=actorFor(data.targetId),tip=source?.getObjectByName('oathkeeper-staff-tip');
  if(tip)tip.getWorldPosition(start);else start.set(data.x+.4,2.2,data.z);
  if(target)end.copy(target.position).y+=1.2;else end.set(data.targetX??data.x,1.2,data.targetZ??data.z);
  root.position.set(data.x,0,data.z);start.sub(root.position);end.sub(root.position);
  const age=Math.max(0,time-data.start),fade=Math.min(1,age/.12,Math.max(0,data.until-time)/.25),boost=data.supportMode==='boost';
  beam.material.uniforms.color.value.set(boost?0x69cfff:p.color);ground.material.uniforms.color.value.set(boost?0x69cfff:p.color);
  const axis=end.clone().sub(start).normalize(),side=new T.Vector3(axis.z,0,-axis.x);if(side.lengthSq()<.001)side.set(1,0,0);side.normalize();const normal=new T.Vector3().crossVectors(axis,side).normalize();
  for(let i=0;i<=16;i++){const t=i/16,center=start.clone().lerp(end,t);center.y+=Math.sin(t*Math.PI)*.28;
   for(let j=0;j<6;j++){const angle=j/6*Math.PI*2,r=.032+(reducedMotion?0:Math.sin(t*15-age*8)*.007),point=center.clone().addScaledVector(side,Math.cos(angle)*r).addScaledVector(normal,Math.sin(angle)*r);positions.set(point.toArray(),(i*6+j)*3);}}
  geometry.attributes.position.needsUpdate=true;geometry.computeVertexNormals();ground.position.set(end.x,.15,end.z);animateMaterials(root,reducedMotion?0:age,fade);effect.light.intensity=fade*9;
 },dispose(){disposeClassEffect(root);}};effect.update(zone,zone.start);return effect;
}

export function createClassZone(scene,zone,{reducedMotion=false,actorFor}={}){
 if(zone.kind==='support')return createSupportZone(scene,zone,{reducedMotion,actorFor});
 if(zone.classId==='sorcerer')return createLegacyZone(scene,zone);
 const root=new T.Group(),p=palette(zone.classId),radius=zone.radius;root.name=`${zone.classId}-zone`;root.position.set(zone.x,0,zone.z);
 const ground=plane(root,'ground',radius,p),shadow=shade(root,radius,.075,zone.classId==='nightblade'?.38:.19);
 const particles=motes(root,p,reducedMotion?14:32);let animateCloud,spin,rocks;
 if(['nightblade','alchemist'].includes(zone.classId))animateCloud=cloudBank(root,p,radius,{reducedMotion});
 if(zone.classId==='reaver'){
  spin=new T.Group();root.add(spin);for(let i=0;i<3;i++){const arc=sweep(spin,p,radius,Math.PI*.8);arc.rotation.y=i*Math.PI*2/3;arc.position.y=i*.17;}
  rocks=debris(root,p);
 }
 if(zone.classId==='oathkeeper'){
  const halo=mesh(root,new T.CylinderGeometry(radius*.97,radius*.97,.5,64,1,true),effectMaterial('ward',p.color,p.hot,{opacity:.25}),0,.38);
  halo.name='valkyrie-aura';
 }
 scene.add(root);
 let renderTime=zone.start;
 const effect={mesh:root,light:{color:p.color,intensity:0},update(data,time,dt=0){
  renderTime=Math.min(time+.1,Math.max(time,renderTime+dt));time=renderTime;
  root.position.set(data.x,0,data.z);
  const age=Math.max(0,time-data.start),remaining=Math.max(0,data.until-time),fade=Math.min(1,age/.18,remaining/.5),motion=reducedMotion?0:age;
  animateMaterials(root,motion,fade);particles(motion,radius*.92,zone.classId==='oathkeeper'?2.2:1.4);
  animateCloud?.(motion);if(spin)spin.rotation.y=motion*8;rocks?.(motion,radius);
  effect.light.intensity=fade*(zone.classId==='nightblade'?3:zone.classId==='oathkeeper'?16:10);
  root.visible=ground.visible=shadow.visible=remaining>0;
 },dispose(){disposeClassEffect(root);}};effect.update(zone,zone.start);return effect;
}

// All non-sorcerer casts use this lifecycle. Wards follow authoritative shield /
// guard state, so breaking a shield removes its shell immediately on every client.
export function createClassEffects(scene,{reducedMotion=false}={}){
 const bursts=new Set(),wards=new Map(),projectiles=new Set(),zones=new Set();
 let actorLookup=()=>null;
 function transient(root,life,animate,light=null,actor=null){
  // Bound transient work even during eight-player volleys.
  if(bursts.size>=48){const oldest=bursts.values().next().value;oldest.dispose();}
  scene.add(root);const effect={mesh:root,age:0,life,light,actor,animate,dispose(){bursts.delete(effect);disposeClassEffect(root);}};
  bursts.add(effect);animate(0,0);return effect;
 }
 function burst(position,id,radius,life=.65,{fire=false,heal=false}={}){
  const p=fire?{color:0xff641b,hot:0xffe4a6,style:5}:heal?{...palette(id),color:0x86dca0,hot:0xeeffd2}:palette(id),root=new T.Group();root.name=`${id}-${fire?'igni':heal?'remedy':'burst'}`;root.position.set(position.x,0,position.z);
  const ring=plane(root,'wave',radius,p),ground=plane(root,'ground',radius,p,.13,.32),shadow=shade(root,radius);
  const particles=motes(root,p,reducedMotion?12:30);let rocks,cloud,flames=[];
  if(id==='reaver'||id==='alchemist')rocks=debris(root,p,8);
  if(id==='alchemist'||id==='nightblade')cloud=cloudBank(root,p,radius*.7,{reducedMotion});
  if(fire)for(let i=0;i<9;i++){const a=i*2.399,r=radius*(.3+(i%3)*.22),flame=mesh(root,new T.PlaneGeometry(1.2,2.5),effectMaterial('flame',p.color,p.hot),Math.sin(a)*r,1.25,Math.cos(a)*r);flame.rotation.y=a;flames.push(flame);}
  const light={color:p.color,intensity:fire?32:18};
  return transient(root,life,(progress,age)=>{
   const time=reducedMotion?0:age,fade=Math.min(1,age/.055)*(1-progress)**1.4;
   animateMaterials(root,time,fade);ring.scale.setScalar(reducedMotion?1:.18+.82*(1-(1-progress)**3));
   particles(time,radius*(.35+progress*.6),heal?2.3:1.5);cloud?.(time);rocks?.(reducedMotion?.3:progress,radius,true);
   for(const flame of flames)flame.scale.y=reducedMotion?1:.65+Math.sin(progress*Math.PI)*.6;
   ground.visible=shadow.visible=progress<.95;light.intensity=(fire?32:18)*fade;
  },light);
 }
 function melee(event,skill,actor){
  const root=new T.Group(),p=palette(event.classId);root.name=`${event.classId}-melee`;root.rotation.y=event.angle;root.position.copy(actor.position);
  const slash=sweep(root,p,skill.range,skill.arc),paired=skill.hits===2;
  const second=paired?sweep(root,p,skill.range*.92,skill.arc):null;if(second)second.position.y=-.28;
  return transient(root,.4,(progress,age)=>{root.position.copy(actor.position);animateMaterials(root,reducedMotion?0:age,Math.sin(progress*Math.PI));slash.rotation.y=0;if(second)second.material.uniforms.opacity.value=Math.max(0,Math.sin((progress-.3)*Math.PI*1.4));},null,actor);
 }
 function dodge(event,actor){
  const root=new T.Group(),p=palette(event.classId);root.name=`${event.classId}-dodge`;root.position.set(event.x,0,event.z);
  const origin=new T.Vector3(event.x,0,event.z),ground=plane(root,'wave',.9,p),history=[];
  // Samples are discrete puffs, never one long streak through a Shadowstep wall.
  const g=new T.BufferGeometry(),positions=new Float32Array(18*3);g.setAttribute('position',new T.BufferAttribute(positions,3));
  const points=new T.Points(g,effectMaterial('mote',p.color,p.hot));points.frustumCulled=false;root.add(points);
  const wake=plane(root,'ground',.8,p,.15,.45);let cloud,rocks;
  if(['reaver','geralt'].includes(event.classId))rocks=debris(root,p,6);
  if(['nightblade','alchemist'].includes(event.classId))cloud=cloudBank(root,p,1,{reducedMotion});
  return transient(root,.6,(progress,age)=>{
   animateMaterials(root,reducedMotion?0:age,(1-progress)**1.3);
   ground.scale.setScalar(reducedMotion?1:.4+progress*1.4);
   const local=actor.position.clone().sub(origin);wake.position.set(local.x,.15,local.z);
   if(age<.32)history.push(local);if(history.length>18)history.shift();
   for(let i=0;i<18;i++){const q=history[Math.max(0,history.length-1-i)]||local;positions.set([q.x, q.y+.15+(i%3)*.13,q.z],i*3);}g.attributes.position.needsUpdate=true;cloud?.(reducedMotion?0:age);rocks?.(reducedMotion?.4:progress,.9,true);
  },null,actor);
 }
 function ability(event,skill,actor){
  if(!PALETTES[event.classId]||!skill)return false;
  if(skill.kind==='melee')melee(event,skill,actor);
  if(skill.kind==='projectile')burst(actor.position,event.classId,.7,.25);
  if(skill.kind==='burst')burst(event,event.classId,skill.radius,event.classId==='geralt'?.85:.75,{fire:event.classId==='geralt',heal:event.classId==='alchemist'});
  if(skill.kind==='zone')burst(event,event.classId,skill.radius,.45);
  if(skill.kind==='shield')burst(actor.position,event.classId,1.2,.45);
  if(skill.kind==='support')burst(actor.position,event.classId,1,.45);
  if(skill.kind==='dodge')dodge(event,actor);
  if(skill.kind==='heal')burst(actor.position,event.classId,1.3,.85,{heal:true});
  return true;
 }
 function syncActors(players,actorFor,mapId){
  actorLookup=actorFor;
  const active=new Set();
  for(const state of players){
   const model=actorFor(state.id);if(model){model.userData.oathkeeperFlight=!state.ended&&(state.mapId||'overworld')===mapId&&state.classId==='oathkeeper'&&(state.valkyrieTime>0||state.dodge>0)?1:0;model.userData.oathkeeperReducedMotion=reducedMotion;}
   if(state.ended||(state.mapId||'overworld')!==mapId)continue;
   const shield=state.shield>0&&['oathkeeper','geralt'].includes(state.classId),guard=state.classId==='reaver'&&state.guard>0&&state.guardTime>0;
   if(!shield&&!guard)continue;const actor=actorFor(state.id);if(!actor)continue;
   active.add(state.id);let ward=wards.get(state.id);
   if(ward&&(ward.classId!==state.classId||ward.actor!==actor)){ward.dispose();ward=null;}
   if(!ward){
    const root=new T.Group(),p=palette(state.classId);root.name=`${state.classId}-ward`;
    const shell=mesh(root,new T.SphereGeometry(1,40,28),effectMaterial('ward',p.color,p.hot,{opacity:guard?.4:.85}),0,1.06);shell.scale.set(.91,1.2,.91);
    plane(root,'ground',1.13,p,.15,.45);scene.add(root);
    ward={mesh:root,classId:state.classId,actor,age:0,light:{color:p.color,intensity:shield?10:5},dispose(){wards.delete(state.id);disposeClassEffect(root);}};wards.set(state.id,ward);
   }
   ward.strength=shield?Math.min(1,state.shield/(state.classId==='geralt'?45:40)):1;
   ward.remaining=shield?state.shieldTime??4:state.guardTime;
  }
  for(const [id,ward] of wards)if(!active.has(id))ward.dispose();
 }
 const track=(set,effect)=>{set.add(effect);const dispose=effect.dispose;effect.dispose=()=>{set.delete(effect);dispose();};return effect;};
 function update(dt){
  for(const b of [...bursts]){b.age+=dt;if(b.age>=b.life||b.actor&&!b.actor.parent){b.dispose();continue;}b.animate(b.age/b.life,b.age);}
  for(const ward of wards.values()){
   ward.age+=dt;ward.mesh.position.copy(ward.actor.position);
   const fade=Math.min(1,ward.age/.15,ward.remaining/.4)*(.55+ward.strength*.45);animateMaterials(ward.mesh,reducedMotion?0:ward.age,fade);
  }
 }
 function clear(){for(const collection of [bursts,projectiles,zones])for(const effect of [...collection])effect.dispose();for(const ward of [...wards.values()])ward.dispose();}
 return {ability,syncActors,update,clear,dispose:clear,
  projectile:data=>track(projectiles,createClassProjectile(scene,data,{reducedMotion})),
  zone:data=>track(zones,createClassZone(scene,data,{reducedMotion,actorFor:id=>actorLookup(id)})),
  impact(event){const id=event.visual==='knife'?'nightblade':event.visual==='venom'?'alchemist':event.visual==='arrow'?'ranger':event.visual==='radiant'?'oathkeeper':null;if(!id)return false;burst(event,id,event.visual==='venom'?1:.65,.38);return true;},
  lightSources:()=>[...bursts,...wards.values(),...projectiles,...zones].filter(e=>e.light&&e.light.intensity>0).map(e=>({position:new T.Vector3(e.mesh.position.x,1.1,e.mesh.position.z),...e.light}))
 };
}

const glow=color=>new T.MeshBasicMaterial({color,transparent:true,opacity:.8,depthWrite:false});
function createLegacyZone(scene,zone){
 const root=new T.Group();root.position.set(zone.x,.12,zone.z);const mat=glow(zone.color||'#b6d5d4');
 const outline=mesh(root,new T.RingGeometry(zone.radius-.04,zone.radius,64),mat);outline.rotation.x=-Math.PI/2;
 const inner=mesh(root,new T.CircleGeometry(zone.radius,48),glow(zone.color));inner.rotation.x=-Math.PI/2;inner.material.opacity=.045;
 const particles=[];for(let i=0;i<18;i++){const particle=mesh(root,new T.OctahedronGeometry(zone.classId==='ranger'?.035:.055),glow(zone.color));if(zone.classId==='ranger')particle.scale.y=6;particles.push(particle);}
 scene.add(root);
 return {mesh:root,update(data,time){root.position.set(data.x,.12,data.z);const remaining=Math.max(0,(data.until-time)/Math.min(1,data.until-data.start));mat.opacity=Math.min(.6,remaining*.6);particles.forEach((p,i)=>{const angle=i/18*Math.PI*2+time*.8,r=zone.radius*(.3+(i%5)*.13);p.position.set(Math.sin(angle)*r,zone.classId==='ranger'?2.6-((time*3+i*.19)%2.6):.2+(i%4)*.3+Math.sin(time*2+i)*.12,Math.cos(angle)*r);p.material.opacity=Math.min(.55,remaining*.55);});},dispose(){disposeClassEffect(root);}};
}
