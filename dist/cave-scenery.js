import * as T from 'three';
import {lcg,hashString} from './random.js';

// Batched ruins and debris keep the expanded caves inexpensive to draw.
// Light is tied to sparse landmarks, leaving the passages between them dark.
export function createCaveScenery(scene,map){
 const group=new T.Group();group.name=`cave-scenery-${map.id}`;scene.add(group);
 const rand=lcg(hashString(map.id,{seed:7,imul:false}));
 const moss=map.id==='moss-hollow',cellar=map.id==='cellar-depths';
 const colors={floor:moss?0x303930:cellar?0x39332d:0x30373c,stone:moss?0x4e5548:cellar?0x595249:0x4c555c,edge:0x252c2e,dark:0x101417,wood:0x423127,iron:0x303236,bone:0x8f8976,moss:0x3c4935,water:0x152a2a,crystal:0x448e89,flame:0xffae50,ash:0x37332f,cloth:0x423c39,ember:0xa22f0a,cold:0x74d4d0};
 const materials=Object.fromEntries(Object.entries(colors).map(([key,color])=>[key,new T.MeshStandardMaterial({color,roughness:key==='water'?.22:.93,...(key==='crystal'?{emissive:0x193734,emissiveIntensity:.25}:key==='flame'?{emissive:0xff6414,emissiveIntensity:3}:key==='ember'?{emissive:0xa82604,emissiveIntensity:1.5}:key==='cold'?{emissive:0x499d9d,emissiveIntensity:1.7}:{})})]));
 const arch=new T.Shape();arch.moveTo(-.8,0);arch.lineTo(-.8,1.75);arch.quadraticCurveTo(-.8,2.5,0,3.15);arch.quadraticCurveTo(.8,2.5,.8,1.75);arch.lineTo(.8,0);arch.lineTo(-.8,0);
 const opening=new T.Path();opening.moveTo(-.53,0);opening.lineTo(.53,0);opening.lineTo(.53,1.75);opening.quadraticCurveTo(.53,2.28,0,2.76);opening.quadraticCurveTo(-.53,2.28,-.53,1.75);opening.lineTo(-.53,0);arch.holes.push(opening);
 const coffin=new T.Shape();coffin.moveTo(-.27,0);coffin.lineTo(-.48,1.38);coffin.lineTo(-.34,1.95);coffin.lineTo(.34,1.95);coffin.lineTo(.48,1.38);coffin.lineTo(.27,0);coffin.closePath();
 const geometries={box:new T.BoxGeometry(1,1,1),rock:new T.DodecahedronGeometry(1,0),cone:new T.ConeGeometry(1,1,6),cylinder:new T.CylinderGeometry(1,1,1,10),plane:new T.PlaneGeometry(1,1),arch:new T.ExtrudeGeometry(arch,{depth:.35,bevelEnabled:false,curveSegments:6}),coffin:new T.ExtrudeGeometry(coffin,{depth:.3,bevelEnabled:false})};
 geometries.arch.translate(0,0,-.175);geometries.coffin.translate(0,0,-.15);
 const batches=new Map(),transform=new T.Object3D();
 function add(shape,material,x,y,z,sx=1,sy=1,sz=1,angle=0,rx=0,rz=0){const key=`${shape}:${material}`;if(!batches.has(key))batches.set(key,[]);batches.get(key).push({x,y,z,sx,sy,sz,angle,rx,rz});}
 function beam(material,a,b,radius=.04){const start=new T.Vector3(...a),end=new T.Vector3(...b),direction=end.clone().sub(start),length=direction.length(),rotation=new T.Euler().setFromQuaternion(new T.Quaternion().setFromUnitVectors(new T.Vector3(0,1,0),direction.normalize())),mid=start.add(end).multiplyScalar(.5);add('cylinder',material,mid.x,mid.y,mid.z,radius,length,radius,rotation.y,rotation.x,rotation.z);}
 const spaced=[],ruins=[];
 for(const f of map.floors)add('box','floor',f.x,-.11,f.z,f.w,.2,f.d);
 for(const w of map.walls){
  const decorated=!spaced.some(p=>Math.hypot(p.x-w.x,p.z-w.z)<6)&&rand()<.58;if(decorated)spaced.push(w);
  add('box','edge',w.x,.19,w.z,2,.4,2);
  const h=.8+rand()*1.5;
  if(!decorated)add('rock','stone',w.x,.42+h*.3,w.z,.92,.55+h*.5,.94,rand()*1.2);
  for(let i=0;i<3;i++)add('rock',i?'edge':'stone',w.x+(rand()-.5)*1.3,.28,w.z+(rand()-.5)*1.3,.24+rand()*.2,.3+rand()*.45,.3,rand()*3);
  if(!decorated&&rand()<.24)add('cone','stone',w.x,.7,w.z,.28,1.4+rand(),.3,rand()*3);
  if(rand()<.15)add('rock','moss',w.x,.85,w.z,.5,.09,.48);
  const [dx,dz]=w.neighbors[0],angle=Math.atan2(dx,dz);
  // Tall silhouettes sit wholly in the existing solid wall tiles.
  if(decorated){
   const type=spaced.length%5;
   const local=(x,y,z)=>[w.x+Math.cos(angle)*x+Math.sin(angle)*z,y,w.z-Math.sin(angle)*x+Math.cos(angle)*z];
   if(type===0||type===3){
    add('arch','stone',w.x,.1,w.z,1,1,1,angle);
    for(const x of [-.69,.69]){add('box','edge',...local(x,.24,0),.38,.4,.55,angle);add('cone','stone',...local(x,2.35,0),.18,.48,.18,angle);}
    add('box','dark',...local(0,1,.02),.85,1.8,.12,angle);
    add('coffin',type===0?'wood':'stone',...local(0,.22,.36),.7,.85,.7,angle,0,.03);
    for(const y of [.65,1.45])add('box','iron',...local(0,y,.51),.65,.1,.05,angle);
   }else if(type===1){
    add('coffin','wood',w.x,.1,w.z,1,1,1,angle,0,.14);
    add('coffin','dark',...local(.24,.02,.32),.8,.9,.65,angle+.35,0,-.2);
    for(const y of [.5,1.4])add('box','iron',...local(0,y,.18),.76,.09,.08,angle);
   }else if(type===2){
    for(const x of [-.58,.58])add('box','wood',...local(x,1.1,0),.18,2.2,.18,angle,0,x*.12);
    beam('wood',local(-.72,2.1,0),local(.76,2.3,0),.12);
    beam('wood',local(-.7,.3,.2),local(.65,1.7,.2),.09);
    add('plane','cloth',...local(.16,1.4,.18),.65,1.2,1,angle);
    for(let i=0;i<4;i++)add('box','iron',...local(.45,2-i*.2,.22),.05,.16,.04,angle);
   }else{
    add('box','stone',w.x,.2,w.z,1.2,.4,1.2,angle);add('cylinder','stone',w.x,.95,w.z,.32,1.5,.32,angle);
    add('box','stone',w.x,1.8,w.z,.85,.3,.85,angle);add('cone','dark',w.x,2.15,w.z,.34,.65,.34,angle);
    add('box','iron',...local(0,1.25,.37),.08,.62,.08,angle);add('box','iron',...local(0,1.35,.37),.36,.07,.08,angle);
   }
   ruins.push({x:w.x+dx*1.7,z:w.z+dz*1.7,angle,seed:spaced.length});
  }
 }
 // Cracked slabs, shale and damp patches break up the floor in every tunnel.
 for(const p of map.floorTiles){
  for(let i=0;i<2;i++)add('rock',i?'stone':'edge',p.x+(rand()-.5)*1.6,.015,p.z+(rand()-.5)*1.6,.07+rand()*.24,.025,.08+rand()*.24,rand()*6);
  if(rand()<.19)add('box','ash',p.x,.012,p.z,.45+rand()*.55,.018,.3+rand()*.35,rand()*6);
  if(rand()<.12)add('cylinder','water',p.x,.007,p.z,.6+rand()*.3,.012,.25+rand()*.3,rand()*6);
 }
 // A little exposed ribcage reads as remains, rather than anonymous white sticks.
 function skeleton(x,z,angle){
  const p=(dx,y,dz)=>[x+Math.cos(angle)*dx+Math.sin(angle)*dz,y,z-Math.sin(angle)*dx+Math.cos(angle)*dz];
  beam('bone',p(0,.08,-.42),p(0,.08,.33),.045);
  for(let i=0;i<5;i++){const dz=-.3+i*.13,width=.23-Math.abs(i-2)*.025;for(const side of [-1,1]){beam('bone',p(0,.1,dz),p(side*width,.19,dz+.02),.024);beam('bone',p(side*width,.19,dz+.02),p(side*width*.8,.055,dz+.07),.022);}}
  add('rock','bone',...p(0,.13,-.63),.17,.15,.2,angle);
  for(const side of [-1,1]){add('box','dark',...p(side*.066,.235,-.68),.055,.025,.065,angle);beam('bone',p(side*.09,.07,.3),p(side*.25,.06,.8),.04);beam('bone',p(side*.25,.06,.8),p(side*.36,.05,1.16),.032);beam('bone',p(side*.22,.08,-.25),p(side*.45,.04,.18),.03);}
 }
 for(const [i,r]of ruins.entries()){
  if(i%2===0)skeleton(r.x,r.z,r.angle+.7);
  if(i%3===0)for(let j=0;j<4;j++)add('box','wood',r.x+(rand()-.5)*1.8,.045,r.z+(rand()-.5)*1.4,.11,.085,.5+rand()*1.2,rand()*3);
 }
 // Shared procedural web and glow textures are code-native environment assets.
 const pixels=new Uint8Array(64*64*4);
 for(let y=0;y<64;y++)for(let x=0;x<64;x++){const i=(y*64+x)*4,r=Math.hypot((x-31.5)/31.5,(y-31.5)/31.5);pixels[i]=pixels[i+1]=pixels[i+2]=255;pixels[i+3]=Math.round(255*Math.max(0,1-r)**2);}
 const texture=new T.DataTexture(pixels,64,64);texture.needsUpdate=true;texture.magFilter=texture.minFilter=T.LinearFilter;
 const canvas=document.createElement('canvas');canvas.width=canvas.height=256;const ctx=canvas.getContext('2d');
 ctx.strokeStyle='#b9b9a4';ctx.lineWidth=2.8;
 const webCenter={x:117,y:121},spokes=13;
 function webPoint(a,r){return{x:webCenter.x+Math.cos(a)*r*(.91+.09*Math.sin(a*5)),y:webCenter.y+Math.sin(a)*r};}
 for(let i=0;i<spokes;i++){const a=i/spokes*Math.PI*2,p=webPoint(a,124);ctx.globalAlpha=.42+rand()*.24;ctx.beginPath();ctx.moveTo(webCenter.x,webCenter.y);ctx.lineTo(p.x,p.y);ctx.stroke();}
 for(let ring=1;ring<=9;ring++)for(let i=0;i<spokes;i++){if(rand()<.11)continue;const a=i/spokes*Math.PI*2,b=(i+1)/spokes*Math.PI*2,r=ring*12,p=webPoint(a,r),q=webPoint(b,r),mid=webPoint((a+b)/2,r*.88);ctx.globalAlpha=.22+rand()*.35;ctx.beginPath();ctx.moveTo(p.x,p.y);ctx.quadraticCurveTo(mid.x,mid.y,q.x,q.y);ctx.stroke();}
 const webTexture=new T.CanvasTexture(canvas);webTexture.colorSpace=T.SRGBColorSpace;
 const webMaterial=new T.MeshStandardMaterial({map:webTexture,color:0xacae9d,transparent:true,opacity:.72,side:T.DoubleSide,depthWrite:false,roughness:1,emissive:0x4a5553,emissiveIntensity:.4});
 const spillMaterial=new T.MeshBasicMaterial({map:texture,color:0xff7928,transparent:true,opacity:.25,blending:T.AdditiveBlending,depthWrite:false,toneMapped:false});
 const coldSpillMaterial=spillMaterial.clone();coldSpillMaterial.color.set(0x458f94);coldSpillMaterial.opacity=.2;
 const haloMaterial=new T.SpriteMaterial({map:texture,color:0xff842e,transparent:true,opacity:.52,blending:T.AdditiveBlending,depthWrite:false,toneMapped:false});
 const coldHaloMaterial=haloMaterial.clone();coldHaloMaterial.color.set(0x5bafb4);coldHaloMaterial.opacity=.32;
 for(const [i,r]of ruins.entries())if(i%2===0){
  add('plane','web',r.x,.065,r.z,3.8,4.5,1,0,-Math.PI/2,r.angle);
  // A second sagging sheet joins rubble to the wall without crossing the route.
  add('plane','web',r.x-Math.sin(r.angle)*.6,.9,r.z-Math.cos(r.angle)*.6,2.4,2,1,r.angle,-.4);
 }
 const fireGroups=[],smoke=[],motes=[],flameGeometry=new T.SphereGeometry(1,7,6);
 const fireMaterial=new T.MeshBasicMaterial({color:0xff951e,transparent:true,opacity:.86,depthWrite:false,toneMapped:false});
 const coreMaterial=new T.MeshBasicMaterial({color:0xffdda0,toneMapped:false});
 const smokeMaterial=new T.SpriteMaterial({map:texture,color:0x596365,transparent:true,opacity:.1,depthWrite:false});
 function fire(x,y,z,cold=false,index=0){
  const flame=new T.Group();flame.position.set(x,y,z);group.add(flame);
  if(cold){const shard=new T.Mesh(geometries.cone,materials.cold);shard.scale.set(.13,.7,.13);shard.position.y=.38;flame.add(shard);}
  else for(let i=0;i<4;i++){const tongue=new T.Mesh(flameGeometry,i===0?coreMaterial:fireMaterial);tongue.position.set(Math.sin(i*2)*.13,.35+i*.05,Math.cos(i*2)*.13);tongue.scale.set(i===0?.14:.2,.55+i*.08,.15);tongue.rotation.z=Math.sin(i)*.22;flame.add(tongue);}
  fireGroups.push({flame,index,cold});
  const halo=new T.Sprite(cold?coldHaloMaterial:haloMaterial);halo.position.set(x,y+.3,z);halo.scale.set(cold?1.8:2.4,cold?2.8:3,1);group.add(halo);
  if(!cold)for(let i=0;i<3;i++){const sprite=new T.Sprite(smokeMaterial);group.add(sprite);smoke.push({sprite,x,y,z,phase:i/3+index*.17});}
  if(!cold)for(let i=0;i<4;i++){const mote=new T.Mesh(geometries.rock,materials.ember);mote.scale.setScalar(.02);group.add(mote);motes.push({mote,x,y,z,phase:i/4,index});}
 }
 for(const [i,l]of map.lights.entries()){
  const {x,z,kind}=l,cold=kind==='shrine'||kind==='cold-flame';let y=.22;
  if(kind==='lantern'){
   y=1.52;add('box','wood',x,1,z,.1,2,.1);add('box','iron',x+.2,1.94,z,.55,.08,.08);add('cone','iron',x+.38,1.8,z,.22,.2,.22);add('box','flame',x+.38,1.55,z,.16,.3,.16);add('box','iron',x+.38,1.34,z,.3,.07,.3);
   for(const dx of [-.11,.11])for(const dz of [-.11,.11])add('box','iron',x+.38+dx,1.56,z+dz,.028,.4,.028);
  }else if(kind==='firepit'){
   add('cylinder','ash',x,.035,z,1,.065,.85);add('cylinder','dark',x,.07,z,.63,.08,.58);
   for(let j=0;j<10;j++){const a=j/10*Math.PI*2;add('rock','stone',x+Math.cos(a)*.72,.14,z+Math.sin(a)*.66,.19,.16,.17,a);}
   for(let j=0;j<3;j++)add('box','wood',x,.14,z,.12,.12,.95,j*Math.PI/3);
   for(let j=0;j<9;j++)add('rock','ember',x+(rand()-.5)*.68,.19,z+(rand()-.5)*.58,.065,.035,.055);
  }else if(kind==='brazier'){
   y=.88;add('cylinder','stone',x,.22,z,.45,.44,.45);add('cone','iron',x,.69,z,.5,.7,.5,0,Math.PI);add('cylinder','ember',x,.87,z,.36,.035,.36);
   for(let j=0;j<5;j++){const a=j/5*Math.PI*2;add('cone','iron',x+Math.cos(a)*.42,1.02,z+Math.sin(a)*.42,.045,.52,.045);}
  }else{
   y=.75;add('cylinder','stone',x,.13,z,.82,.26,.82);add('arch','stone',x,.2,z,1,.9,1);
   add('box','dark',x,.65,z,.8,.9,.65);add('cylinder','cold',x,.72,z,.3,.04,.3);
   for(const dx of [-.7,.7])add('cone','stone',x+dx,1.7,z,.13,1.1,.13);
  }
  add('plane',cold?'cold-spill':'spill',x,.055,z,cold?6:7,cold?6:7,1,0,-Math.PI/2);
  if(kind!=='lantern')fire(x,y,z,cold,i);
 }
 for(const f of map.features){
  const {x,z}=f;
  if(f.type==='pool'){
   add('cylinder','edge',x,.015,z,2.5,.025,1.75,.4);add('cylinder','water',x,.033,z,2.12,.015,1.43,.4);
   for(let i=0;i<12;i++){const a=i/12*Math.PI*2;add('rock','moss',x+Math.cos(a)*2.2,.04,z+Math.sin(a)*1.55,.18,.08,.18);}
   skeleton(x-1.5,z+.8,.8);
  }else if(f.type==='crystals'){
   add('rock','edge',x,.02,z,1.7,.04,1.2);for(let i=0;i<6;i++)add('cone','crystal',x+(rand()-.5)*2,.12,z+(rand()-.5)*1.4,.1,.2+rand()*.25,.14,rand()*5);
   add('plane','web',x,.065,z,5,4,1,0,-Math.PI/2,.6);
  }else if(f.type==='camp'){
   for(let i=0;i<9;i++)add('box','wood',x+(rand()-.5)*2.8,.045,z+(rand()-.5)*2.2,.13,.08,.8+rand(),rand()*3);
   add('box','wood',x+.6,.13,z+.5,.9,.25,.7,.3);add('box','iron',x+.6,.27,z+.5,.9,.025,.08,.3);add('box','cloth',x-.45,.05,z-.4,.72,.1,1.5,-.2);
   skeleton(x+.5,z-1,.8);add('plane','web',x,.07,z,4.5,4.5,1,0,-Math.PI/2,1.2);
  }else{
   add('cylinder','edge',x,.025,z,1.8,.05,1.8);
   for(let i=0;i<9;i++){const a=i/9*Math.PI*2;add('box','bone',x+Math.cos(a)*1.5,.06,z+Math.sin(a)*1.5,.08,.09,.3,-a);}
   add('box','stone',x,.14,z,1.3,.28,.85);skeleton(x+.1,z-.1,Math.PI/2);
   for(const dx of [-.75,.75]){add('cylinder','bone',x+dx,.18,z-.5,.06,.34,.06);add('cone','flame',x+dx,.4,z-.5,.035,.1,.035);}
  }
 }
 const extraMaterials={'spill':spillMaterial,'cold-spill':coldSpillMaterial,'web':webMaterial};
 for(const [key,items]of batches){const [shape,material]=key.split(':');const instanced=new T.InstancedMesh(geometries[shape],extraMaterials[material]||materials[material],items.length);instanced.name=`cave-${key}`;
  items.forEach((o,i)=>{transform.position.set(o.x,o.y,o.z);transform.rotation.set(o.rx,o.angle,o.rz);transform.scale.set(o.sx,o.sy,o.sz);transform.updateMatrix();instanced.setMatrixAt(i,transform.matrix);});
  instanced.instanceMatrix.needsUpdate=true;instanced.computeBoundingSphere();instanced.receiveShadow=!extraMaterials[material];instanced.castShadow=['stone','wood','iron'].includes(material)&&shape!=='plane';group.add(instanced);
 }
 const lights=Array.from({length:4},()=>{const light=new T.PointLight(0xff8037,0,10,1.8);group.add(light);return light;});
 const reduced=globalThis.matchMedia?.('(prefers-reduced-motion: reduce)');
 function update(time,player){
  const t=reduced?.matches?0:time;
  const nearest=map.lights.map((l,i)=>({l,i,d:player?Math.hypot(l.x-player.x,l.z-player.z):i})).sort((a,b)=>a.d-b.d);
  for(let i=0;i<lights.length;i++){const target=nearest[i],l=target?.l,cold=l?.kind==='shrine'||l?.kind==='cold-flame';lights[i].color.set(cold?0x64b6c1:0xff843c);lights[i].distance=cold?9:13;lights[i].intensity=target&&target.d<23?(cold?28:l.kind==='lantern'?20:96)*(1+Math.sin(t*7+target.i*2)*.07+Math.sin(t*13+target.i)*.04):0;if(l)lights[i].position.set(l.x,l.kind==='lantern'?1.55:cold?1.3:1.65,l.z);}
  for(const {flame,index,cold}of fireGroups){const flicker=1+Math.sin(t*9+index)*.14+Math.sin(t*17+index*3)*.08;flame.scale.y=cold?1+Math.sin(t*1.7+index)*.05:flicker;flame.rotation.z=cold?0:Math.sin(t*5+index)*.05;}
  for(const s of smoke){const age=(t*.16+s.phase)%1;s.sprite.position.set(s.x+Math.sin(age*3+s.phase)*.25,s.y+.5+age*1.8,s.z+.15+age*.2);s.sprite.scale.set(1.2+age*1.6,1.8+age,1);}
  for(const m of motes){const age=(t*.3+m.phase)%1;m.mote.position.set(m.x+Math.sin(age*8+m.index)*.25,m.y+age*1.7,m.z+Math.cos(age*5+m.phase)*.2);m.mote.visible=age>.1&&age<.8;}
 }
 return{group,update,dispose(){group.removeFromParent();for(const g of Object.values(geometries))g.dispose();flameGeometry.dispose();for(const m of Object.values(materials))m.dispose();for(const m of [spillMaterial,coldSpillMaterial,haloMaterial,coldHaloMaterial,webMaterial,fireMaterial,coreMaterial,smokeMaterial])m.dispose();texture.dispose();webTexture.dispose();group.traverse(o=>{if(o.isInstancedMesh)o.dispose();});}};
}
