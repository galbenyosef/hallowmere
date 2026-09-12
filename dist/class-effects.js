import * as T from 'three';
const glow=color=>new T.MeshBasicMaterial({color,transparent:true,opacity:.8,depthWrite:false});
function mesh(root,geometry,material,x=0,y=0,z=0){const m=new T.Mesh(geometry,material);m.position.set(x,y,z);root.add(m);return m;}
export function disposeClassEffect(root){root.removeFromParent();const geometry=new Set(),materials=new Set();root.traverse(n=>{if(n.geometry)geometry.add(n.geometry);if(n.material)materials.add(n.material);});geometry.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());}
export function createClassProjectile(scene,projectile){
 const root=new T.Group(),color=projectile.color||'#9bd7ef',mat=glow(color);root.position.set(projectile.x,1.15,projectile.z);root.rotation.y=projectile.angle;
 if(['arrow','knife'].includes(projectile.visual)){
  const shaft=mesh(root,new T.CylinderGeometry(.014,.014,.8,5),new T.MeshBasicMaterial({color:0xc8c1a1}));shaft.rotation.x=Math.PI/2;
  const point=mesh(root,new T.ConeGeometry(projectile.visual==='knife'?.08:.04,.21,4),new T.MeshBasicMaterial({color:0xdde8eb}),0,0,.49);point.rotation.x=Math.PI/2;
  if(projectile.visual==='arrow'){mesh(root,new T.BoxGeometry(.15,.013,.14),mat,0,0,-.32);mesh(root,new T.BoxGeometry(.013,.15,.14),mat,0,0,-.32);}
 }else{const core=mesh(root,new T.OctahedronGeometry(.15),mat);core.scale.z=1.8;const halo=mesh(root,new T.SphereGeometry(.22,8,6),glow(color));halo.material.opacity=.17;}
 scene.add(root);let age=0;
 return {mesh:root,update(dt){age+=dt;if(!['arrow','knife'].includes(projectile.visual))root.rotation.z=age*4;},dispose(){disposeClassEffect(root);}};
}
export function createClassZone(scene,zone){
 const root=new T.Group();root.position.set(zone.x,.12,zone.z);const mat=glow(zone.color||'#b6d5d4');
 const outline=mesh(root,new T.RingGeometry(zone.radius-.04,zone.radius,64),mat);outline.rotation.x=-Math.PI/2;
 const inner=mesh(root,new T.CircleGeometry(zone.radius,48),glow(zone.color));inner.rotation.x=-Math.PI/2;inner.material.opacity=.045;
 const particles=[];for(let i=0;i<18;i++){const particle=mesh(root,new T.OctahedronGeometry(zone.classId==='ranger'?.035:.055),glow(zone.color));if(zone.classId==='ranger')particle.scale.y=6;particles.push(particle);}
 scene.add(root);
 return {mesh:root,update(data,time){root.position.set(data.x,.12,data.z);const remaining=Math.max(0,(data.until-time)/Math.min(1,data.until-data.start));mat.opacity=Math.min(.6,remaining*.6);particles.forEach((p,i)=>{const angle=i/18*Math.PI*2+time*.8,r=zone.radius*(.3+(i%5)*.13);p.position.set(Math.sin(angle)*r,zone.classId==='ranger'?2.6-((time*3+i*.19)%2.6):.2+(i%4)*.3+Math.sin(time*2+i)*.12,Math.cos(angle)*r);p.material.opacity=Math.min(.55,remaining*.55);});},dispose(){disposeClassEffect(root);}};
}
