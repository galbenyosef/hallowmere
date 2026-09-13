import * as T from 'three';

// Soft, texture-only light keeps the entrance readable without a bloom pass.
export function createCaveEntranceEffect(parent,portal){
 const group=new T.Group();group.name=`cave-light-${portal.id}`;parent.add(group);
 const stairs=portal.appearance==='stairs',size=stairs?.6:1,color=0xa2efbe;
 group.position.set(portal.x,stairs?.32:.02,portal.z-(stairs?0:1.2));
 if(stairs)group.rotation.y=portal.rotation||0;
 const pixels=new Uint8Array(64*64*4);
 for(let y=0;y<64;y++)for(let x=0;x<64;x++){
  const i=(y*64+x)*4,r=Math.hypot((x-31.5)/31.5,(y-31.5)/31.5);
  pixels[i]=pixels[i+1]=pixels[i+2]=255;pixels[i+3]=Math.round(255*Math.pow(Math.max(0,1-r),2));
 }
 const texture=new T.DataTexture(pixels,64,64);texture.needsUpdate=true;
 texture.magFilter=texture.minFilter=T.LinearFilter;
 const materials=[],geometry=new T.PlaneGeometry(1,1);
 function material(opacity,sprite=false){
  const options={map:texture,color,opacity,transparent:true,depthWrite:false,blending:T.AdditiveBlending,toneMapped:false};
  const m=sprite?new T.SpriteMaterial(options):new T.MeshBasicMaterial({...options,side:T.DoubleSide});materials.push(m);return m;
 }
 const spill=new T.Mesh(geometry,material(.7));spill.rotation.x=-Math.PI/2;
 spill.position.set(0,.045,1.6*size);spill.scale.set(5*size,5.8*size,1);group.add(spill);
 const mouth=new T.Mesh(geometry,material(.85));
 mouth.position.set(0,stairs?.08:.72,stairs?0:.48);
 mouth.scale.set(3*size,stairs?2:1.7,1);if(stairs)mouth.rotation.x=-Math.PI/2;group.add(mouth);
 const light=new T.PointLight(color,stairs?1.8:3.2,stairs?3.5:6,2);
 light.position.set(0,stairs?.45:.85,.85*size);group.add(light);
 const motes=[];
 for(let i=0;i<(stairs?12:22);i++){
  const mote=new T.Sprite(material(0,true));group.add(mote);
  motes.push({mote,phase:i*.61803398875%1,lane:Math.sin(i*127.1),speed:.15+(i%5)*.019,size:(.075+(i%4)*.025)*size});
 }
 const reducedMotion=globalThis.matchMedia?.('(prefers-reduced-motion: reduce)');
 function update(time){
  const t=reducedMotion?.matches?0:time,pulse=.92+.08*Math.sin(t*1.35+portal.x);
  spill.material.opacity=.7*pulse;mouth.material.opacity=.85*pulse;
  light.intensity=(stairs?1.8:3.2)*pulse;
  for(const {mote,phase,lane,speed,size:dotSize} of motes){
   const age=(t*speed+phase)%1,fade=Math.sin(Math.PI*age);
   mote.position.set((lane*(.7+age*.65)+Math.sin(t*.7+phase*20)*.16)*size,
    .25+age*(stairs?1.35:1.9),(.55+age*3.3)*size);
   mote.scale.setScalar(dotSize*(.8+fade*.5));mote.material.opacity=fade*.85;
  }
 }
 update(0);
 return{group,update,dispose(){group.removeFromParent();geometry.dispose();texture.dispose();for(const m of materials)m.dispose();}};
}
