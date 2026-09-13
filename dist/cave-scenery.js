import * as T from 'three';

// Repeated cave details are instanced; a fixed light pool follows the player.
// This keeps a hundred lanterns from becoming a hundred real-time lights.
export function createCaveScenery(scene,map){
 const group=new T.Group();group.name=`cave-scenery-${map.id}`;scene.add(group);
 let seed=[...map.id].reduce((n,c)=>n*31+c.charCodeAt(0),7)>>>0;
 const rand=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
 const moss=map.id==='moss-hollow',cellar=map.id==='cellar-depths';
 const colors={floor:moss?0x38423b:cellar?0x48413a:0x39434a,stone:moss?0x515d50:cellar?0x625b51:0x52616b,edge:0x303a3d,dark:0x10171c,wood:0x65503a,iron:0x454646,bone:0xafa58a,moss:0x586452,water:0x1b373a,crystal:0x5fafa9,flame:0xffd58c};
 const materials=Object.fromEntries(Object.entries(colors).map(([key,color])=>[key,new T.MeshStandardMaterial({color,roughness:key==='water'?.22:.93,...(key==='crystal'?{emissive:0x32635e,emissiveIntensity:.5}:key==='flame'?{emissive:0xffad42,emissiveIntensity:3}:{} )})]));
 const geometries={box:new T.BoxGeometry(1,1,1),rock:new T.DodecahedronGeometry(1,0),cone:new T.ConeGeometry(1,1,6),cylinder:new T.CylinderGeometry(1,1,1,10),plane:new T.PlaneGeometry(1,1)};
 const batches=new Map(),transform=new T.Object3D();
 function add(shape,material,x,y,z,sx=1,sy=1,sz=1,angle=0,rx=0){const key=`${shape}:${material}`;if(!batches.has(key))batches.set(key,[]);batches.get(key).push({x,y,z,sx,sy,sz,angle,rx});}
 for(const f of map.floors)add('box','floor',f.x,-.11,f.z,f.w,.2,f.d);
 // Darkness between routes reads as unexcavated rock, with rough walls only
 // around the actual passages. Every wall cap stays inside its collision tile.
 for(const w of map.walls){
  add('box','edge',w.x,.24,w.z,2,.5,2);
  const h=1+rand()*.9;
  add('rock','stone',w.x,.48+h*.25,w.z,1,.6+h*.45,1,rand()*.4);
  for(let i=0;i<2;i++)add('rock',i?'edge':'stone',w.x+(rand()-.5)*1.3,.3,w.z+(rand()-.5)*1.3,.38,.4+rand()*.35,.38,rand()*3);
  if(rand()<.2)add('cone','stone',w.x,.9,w.z,.36,1.8,.36,rand()*3);
  if(rand()<.2)add('rock','moss',w.x,.95,w.z,.5,.09,.48);
  const nearby=map.features.find(f=>Math.hypot(w.x-f.x,w.z-f.z)<9);
  if(nearby?.type==='crystals'&&rand()<.42)for(let i=0;i<3;i++)add('cone','crystal',w.x+(i-1)*.42,.7,w.z,.2,.9+rand()*.7,.24,rand()*3);
  if(nearby?.type==='camp'&&rand()<.18){
   add('cylinder','wood',w.x,.5,w.z,.42,1,.42);for(const y of [.16,.82])add('cylinder','iron',w.x,y,w.z,.44,.08,.44);
   add('box','wood',w.x+.55,.35,w.z,.62,.7,.65,.1);add('box','iron',w.x+.55,.7,w.z,.65,.06,.08,.1);
  }
 }
 for(const p of map.floorTiles){
  for(let i=0;i<2;i++)add('rock',i?'stone':'edge',p.x+(rand()-.5)*1.6,.015,p.z+(rand()-.5)*1.6,.05+rand()*.18,.025,.08+rand()*.2,rand()*6);
  if(rand()<.24)add('cylinder','edge',p.x,.005,p.z,.5+rand()*.45,.012,.25+rand()*.4,rand()*6);
 }
 const pixels=new Uint8Array(64*64*4);
 for(let y=0;y<64;y++)for(let x=0;x<64;x++){const i=(y*64+x)*4,r=Math.hypot((x-31.5)/31.5,(y-31.5)/31.5);pixels[i]=pixels[i+1]=pixels[i+2]=255;pixels[i+3]=Math.round(255*Math.max(0,1-r)**2);}
 const texture=new T.DataTexture(pixels,64,64);texture.needsUpdate=true;texture.magFilter=texture.minFilter=T.LinearFilter;
 const spillMaterial=new T.MeshBasicMaterial({map:texture,color:0xffab51,transparent:true,opacity:.46,blending:T.AdditiveBlending,depthWrite:false,toneMapped:false});
 const haloMaterial=new T.SpriteMaterial({map:texture,color:0xffb24d,transparent:true,opacity:.6,blending:T.AdditiveBlending,depthWrite:false,toneMapped:false});
 for(const [i,l]of map.lanterns.entries()){
  const direction=i%2?1:-1;
  add('cylinder','stone',l.x,.09,l.z,.32,.18,.32);
  add('box','wood',l.x,1.12,l.z,.13,2.2,.13);
  add('box','iron',l.x+direction*.2,2.14,l.z,.62,.1,.1);
  const x=l.x+direction*.42;
  add('box','iron',x,1.96,l.z,.045,.34,.045);
  add('cone','iron',x,1.82,l.z,.3,.2,.3);
  add('box','flame',x,1.54,l.z,.23,.37,.23);
  for(const dx of [-.15,.15])for(const dz of [-.15,.15])add('box','iron',x+dx,1.55,l.z+dz,.035,.48,.035);
  add('box','iron',x,1.29,l.z,.37,.09,.37);
  add('plane','spill',x,.045,l.z,9,9,1,0,-Math.PI/2);
  const halo=new T.Sprite(haloMaterial);halo.position.set(x,1.56,l.z);halo.scale.set(2.4,2.8,1);group.add(halo);
 }
 for(const f of map.features){
  const {x,z}=f;
  if(f.type==='pool'){
   add('cylinder','edge',x,.02,z,2.4,.04,1.65,.4);add('cylinder','water',x,.045,z,2.05,.028,1.36,.4);
   for(let i=0;i<12;i++){const a=i/12*Math.PI*2;add('rock','moss',x+Math.cos(a)*2.2,.06,z+Math.sin(a)*1.55,.18,.1,.18);}
  }else if(f.type==='crystals'){
   // Flat mineral seams and small crystals leave chamber movement unobstructed.
   add('rock','edge',x,.02,z,1.7,.04,1.2);
   for(let i=0;i<8;i++)add('cone','crystal',x+(rand()-.5)*2,.12,z+(rand()-.5)*1.4,.08+rand()*.12,.18+rand()*.22,.14,rand()*5);
  }else if(f.type==='camp'){
   for(let i=0;i<7;i++)add('box','wood',x+(rand()-.5)*2.4,.035,z+(rand()-.5)*1.8,.15,.07,.8+rand(),rand()*3);
   add('box','wood',x+.6,.14,z+.5,.9,.26,.7,.3);
   add('box','iron',x+.6,.28,z+.5,.9,.025,.08,.3);
   for(let i=0;i<3;i++)add('cylinder','iron',x-.5+i*.35,.06,z+.6,.13,.1,.13);
   // Bedroll and broken stores tell the story without blocking a combat lane.
   add('box','moss',x-.45,.05,z-.4,.72,.1,1.5,-.2);
  }else{
   add('cylinder','edge',x,.025,z,1.8,.05,1.8);
   for(let i=0;i<9;i++){const a=i/9*Math.PI*2;add('box','bone',x+Math.cos(a)*1.5,.06,z+Math.sin(a)*1.5,.08,.09,.3,-a);}
   add('box','stone',x,.12,z,1,.24,.8);add('box','bone',x,.26,z,.8,.04,.6);
   for(const dx of [-.55,.55]){add('cylinder','bone',x+dx,.17,z-.45,.065,.32,.065);add('cone','flame',x+dx,.36,z-.45,.04,.1,.04);}
  }
  for(let i=0;i<5;i++)add('box','bone',x+(rand()-.5)*3,.04,z+(rand()-.5)*3,.07,.065,.24+rand()*.3,rand()*6);
 }
 for(const [key,items]of batches){const [shape,material]=key.split(':');const instanced=new T.InstancedMesh(geometries[shape],material==='spill'?spillMaterial:materials[material],items.length);instanced.name=`cave-${key}`;
  items.forEach((o,i)=>{transform.position.set(o.x,o.y,o.z);transform.rotation.set(o.rx,o.angle,0);transform.scale.set(o.sx,o.sy,o.sz);transform.updateMatrix();instanced.setMatrixAt(i,transform.matrix);});
  instanced.instanceMatrix.needsUpdate=true;instanced.computeBoundingSphere();
  instanced.receiveShadow=material!=='spill';instanced.castShadow=['stone','wood','iron'].includes(material)&&shape!=='plane';group.add(instanced);
 }
 const lights=Array.from({length:6},()=>{const light=new T.PointLight(0xffaf59,0,12,1.7);group.add(light);return light;});
 const reduced=globalThis.matchMedia?.('(prefers-reduced-motion: reduce)');
 function update(time,player){
  const t=reduced?.matches?0:time;
  const nearest=map.lanterns.map((l,i)=>({l,i,d:player?Math.hypot(l.x-player.x,l.z-player.z):i})).sort((a,b)=>a.d-b.d);
  for(let i=0;i<lights.length;i++){const target=nearest[i];lights[i].intensity=target&&target.d<23?46*(1+Math.sin(t*5+target.i*2)*.055):0;if(target)lights[i].position.set(target.l.x+(target.i%2?1:-1)*.42,1.65,target.l.z);}
  haloMaterial.opacity=.56+Math.sin(t*3)*.035;
 }
 return{group,update,dispose(){group.removeFromParent();for(const g of Object.values(geometries))g.dispose();for(const m of Object.values(materials))m.dispose();spillMaterial.dispose();haloMaterial.dispose();texture.dispose();group.traverse(o=>{if(o.isInstancedMesh)o.dispose();});}};
}
