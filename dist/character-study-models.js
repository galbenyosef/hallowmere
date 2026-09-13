import * as T from './vendor/three.core.js';

// Native, low-poly mesh studies using the same primitives and material language
// as scripts/generate-assets.mjs. Kept independent of the live Warden prefab.
const up=new T.Vector3(0,1,0);
const material=(color,metalness=0,emissive=false)=>new T.MeshStandardMaterial({color,metalness,roughness:metalness?.48:.91,flatShading:true,emissive:emissive?color:0,emissiveIntensity:emissive?1.15:0});
const add=(parent,geometry,mat,x=0,y=0,z=0,sx=1,sy=1,sz=1)=>{const m=new T.Mesh(geometry,mat);m.position.set(x,y,z);m.scale.set(sx,sy,sz);m.castShadow=true;m.receiveShadow=true;parent.add(m);return m;};
const ball=(p,m,x,y,z,sx,sy=sx,sz=sx)=>add(p,new T.SphereGeometry(1,10,7),m,x,y,z,sx,sy,sz);
const box=(p,m,x,y,z,sx,sy,sz)=>add(p,new T.BoxGeometry(1,1,1),m,x,y,z,sx,sy,sz);
const cone=(p,m,x,y,z,r,h,n=8)=>add(p,new T.ConeGeometry(r,h,n),m,x,y,z);
const cylinder=(p,m,x,y,z,rt,rb,h,n=12)=>add(p,new T.CylinderGeometry(rt,rb,h,n),m,x,y,z);
function group(p,x=0,y=0,z=0){const g=new T.Group();g.position.set(x,y,z);p.add(g);return g;}
function rod(p,m,a,b,r=.04,r2=r){const av=new T.Vector3(...a),bv=new T.Vector3(...b),d=bv.clone().sub(av);const mesh=add(p,new T.CylinderGeometry(r2,r,d.length(),8),m);mesh.position.copy(av.add(bv).multiplyScalar(.5));mesh.quaternion.setFromUnitVectors(up,d.normalize());return mesh;}
function branch(p,m,points,r=.05){for(let i=0;i<points.length-1;i++)rod(p,m,points[i],points[i+1],r*(1-i/points.length),r*(1-(i+1)/points.length));}
function torus(p,m,x,y,z,r,tube=.015,arc=Math.PI*2){return add(p,new T.TorusGeometry(r,tube,5,24,arc),m,x,y,z);}
function crystal(p,m,x,y,z,s=.15){const g=add(p,new T.OctahedronGeometry(1),m,x,y,z,s,s*1.9,s);g.rotation.z=.12;return g;}

function drape(p,m,top,bottom,rt,rb,{split=false,ragged=false}={}){
  const vertices=[],indices=[],segments=20,levels=7;
  for(let j=0;j<=levels;j++)for(let i=0;i<=segments;i++){
    const v=j/levels,a=i/segments*Math.PI*2,r=T.MathUtils.lerp(rt,rb,v)+Math.cos(a*10)*.017*(.3+v);
    let y=T.MathUtils.lerp(top,bottom,v);if(j===levels&&ragged)y+=(i%3)*.065;
    if(split&&Math.cos(a)>.86&&v>.5)y+=.26*((v-.5)*2);
    vertices.push(Math.sin(a)*r,y,Math.cos(a)*r*.72);
  }
  for(let j=0;j<levels;j++)for(let i=0;i<segments;i++){const a=j*(segments+1)+i;indices.push(a,a+segments+1,a+1,a+1,a+segments+1,a+segments+2);}
  const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.Float32BufferAttribute(vertices,3));geometry.setIndex(indices);geometry.computeVertexNormals();
  const mesh=add(p,geometry,m);return mesh;
}
function cape(p,m,length=1.5,width=.8){
  const vertices=[],indices=[];for(let j=0;j<=8;j++)for(let i=0;i<=10;i++){const u=i/10,v=j/8;vertices.push((u-.5)*width*(.7+v*.65),1.61-v*length,-.17-v*.25+Math.cos(u*Math.PI*8)*.035);}
  for(let j=0;j<8;j++)for(let i=0;i<10;i++){const a=j*11+i;indices.push(a,a+11,a+1,a+1,a+11,a+12);}
  const geo=new T.BufferGeometry();geo.setAttribute('position',new T.Float32BufferAttribute(vertices,3));geo.setIndex(indices);geo.computeVertexNormals();const mat=m.clone();mat.side=T.DoubleSide;add(p,geo,mat);
}
function skull(p,m,x,y,z,s=.14){
  const g=group(p,x,y,z);ball(g,m.bone,0,0,0,s,s*1.12,s*.85);box(g,m.bone,0,-s*.72,s*.23,s*1.05,s*.38,s);
  for(const sign of [-1,1]){ball(g,m.dark,sign*s*.41,s*.07,s*.75,s*.27,s*.28,s*.09);ball(g,m.glow,sign*s*.41,s*.07,s*.83,s*.10,s*.11,s*.035);}
  for(let i=-1;i<=1;i++)box(g,m.dark,i*s*.26,-s*.67,s*.76,s*.06,s*.26,s*.035);
  return g;
}
function book(p,m){
  const g=group(p);g.rotation.set(-.55,0,-.15);
  for(const s of [-1,1]){const half=group(g,s*.11,0,0);half.rotation.z=s*.2;box(half,m.leather,0,-.035,0,.23,.065,.34);box(half,m.paper,0,.007,0,.20,.025,.30);for(let i=0;i<5;i++)box(half,m.ink,0,.023,-.095+i*.047,.13,.003,.008);box(half,m.gold,0,-.038,.16,.225,.07,.016);}
  rod(g,m.gold,[0,-.05,-.19],[0,-.05,.19],.015);return g;
}
function lantern(p,m){
  const g=group(p);cylinder(g,m.gold,0,-.18,0,.12,.13,.045,6);cylinder(g,m.gold,0,.12,0,.14,.11,.05,6);ball(g,m.glow,0,-.03,0,.07,.115,.07);
  for(let i=0;i<4;i++){const a=i*Math.PI/2;rod(g,m.gold,[Math.sin(a)*.095,-.16,Math.cos(a)*.095],[Math.sin(a)*.095,.10,Math.cos(a)*.095],.012);}
  torus(g,m.gold,0,.21,0,.075,.013);return g;
}
function offhand(p,m,type){
  const g=group(p,-.58,1.14,.38);
  if(type==='book'){book(g,m);g.position.y=1.26;}
  if(type==='orb'){ball(g,m.glow,0,.15,0,.125);torus(g,m.gold,0,.15,0,.19,.013).rotation.x=.5;}
  if(type==='crystal')crystal(g,m.glow,0,.13,0,.15);
  if(type==='skull')skull(g,m,0,.1,0,.15);
  if(type==='lantern'){lantern(g,m);g.position.y=1.03;}
  if(type==='rune'){const stone=box(g,m.stone,0,.14,0,.23,.27,.23);stone.rotation.set(.25,.4,.2);torus(g,m.glow,0,.16,.14,.075,.013);}
  if(type==='astrolabe'){for(const a of [0,Math.PI/2]){const ring=torus(g,m.gold,0,.1,0,.19,.02);ring.rotation.y=a;ring.rotation.x=.3;}ball(g,m.glow,0,.1,0,.055);}
  if(type==='hourglass'){for(const y of [-.14,.20])cylinder(g,m.gold,0,y,0,.12,.12,.035,8);for(const x of [-.1,.1])rod(g,m.gold,[x,-.14,0],[x,.20,0],.014);cone(g,m.glow,0,.10,0,.08,.13).rotation.z=Math.PI;cone(g,m.gold,0,-.06,0,.085,.14);}
  if(type==='totem'){box(g,m.wood,0,.05,0,.19,.40,.14);for(const s of [-1,1])crystal(g,m.glow,s*.054,.13,.079,.029);rod(g,m.bone,[-.09,-.06,.075],[.09,-.06,.075],.011);}
  if(type==='flask'){ball(g,m.glow,0,-.025,0,.13,.15,.13);cylinder(g,m.gold,0,.13,0,.04,.06,.1,8);cylinder(g,m.wood,0,.19,0,.043,.043,.03);}
  if(type==='shield'){
    const shape=new T.Shape();shape.moveTo(-.28,.3);shape.lineTo(.28,.3);shape.lineTo(.31,-.04);shape.lineTo(0,-.47);shape.lineTo(-.31,-.04);shape.closePath();
    add(g,new T.ExtrudeGeometry(shape,{depth:.055,bevelEnabled:true,bevelSize:.02,bevelThickness:.01,bevelSegments:1}),m.gold,0,-.04,0);
    const face=add(g,new T.ShapeGeometry(shape),m.cloth,0,-.04,.07,.88,.90,1);face.rotation.y=0;
    box(g,m.gold,0,-.07,.082,.03,.51,.02);box(g,m.gold,0,.04,.085,.27,.028,.02);crystal(g,m.glow,0,.05,.105,.065);
  }
  if(type==='lute'){ball(g,m.wood,0,-.05,.04,.22,.27,.10);ball(g,m.gold,0,-.05,.127,.18,.23,.014);ball(g,m.dark,0,.045,.146,.058,.058,.006);rod(g,m.wood,[0,.09,.07],[.08,.66,.07],.035);box(g,m.wood,.08,.65,.07,.10,.12,.07);for(let i=0;i<4;i++)rod(g,m.paper,[(i-1.5)*.015,-.18,.151],[.08+(i-1.5)*.012,.65,.118],.002);g.rotation.z=-.45;}
  return g;
}
function staff(p,m,type){
  const g=group(p,.63,0,.25);branch(g,m.wood,[[0,.08,0],[-.035,.72,0],[.035,1.43,0],[0,2.18,0]],.044);
  for(const y of [.13,1.11,1.20,1.28,1.93])cylinder(g,m.gold,0,y,0,.049,.049,.036,8);
  if(type==='crooked'){branch(g,m.wood,[[0,1.92,0],[.17,2.26,0],[.09,2.50,0],[-.1,2.53,0],[-.16,2.33,0]],.065);crystal(g,m.glow,-.06,2.28,0,.105);}
  if(type==='crystal'){crystal(g,m.glow,0,2.27,0,.17);for(const s of [-1,1])branch(g,m.gold,[[0,2,0],[s*.14,2.15,0],[s*.12,2.39,0]],.026);}
  if(type==='fork'){for(const s of [-1,1])branch(g,m.wood,[[0,1.92,0],[s*.19,2.18,0],[s*.17,2.46,.01]],.04);ball(g,m.glow,0,2.24,0,.115,.17,.115);}
  if(type==='moon'){const moon=torus(g,m.gold,0,2.27,0,.23,.032,Math.PI*1.5);moon.rotation.z=Math.PI*.75;ball(g,m.glow,0,2.28,0,.075);}
  if(type==='skull'){skull(g,m,0,2.21,0,.19);for(const s of [-1,1])branch(g,m.bone,[[s*.11,2.28,0],[s*.24,2.50,0],[s*.2,2.60,0]],.036);}
  if(type==='rune'){box(g,m.gold,0,2.23,0,.31,.34,.09);box(g,m.stone,0,2.23,.052,.25,.28,.055);const mark=torus(g,m.glow,0,2.23,.09,.085,.014);mark.rotation.z=Math.PI/4;}
  if(type==='root'){for(const s of [-1,1]){branch(g,m.wood,[[0,1.68,0],[s*.23,2.04,0],[s*.14,2.37,0],[s*.3,2.51,0]],.052);for(let i=0;i<3;i++){const leaf=ball(g,m.leaf,s*(.13+i*.045),2.25+i*.085,0,.09,.025,.05);leaf.rotation.z=s*.7;}}ball(g,m.glow,0,2.20,0,.1);}
  return g;
}
function weapons(root,m,c){
  if(c.gear==='staff')staff(root,m,c.staff);
  if(c.gear==='wand'){const g=group(root,.57,1.16,.34);branch(g,m.gold,[[0,-.08,0],[.05,.2,.05],[.13,.52,.1],[.10,.69,.1]],.028);crystal(g,m.glow,.1,.69,.1,.067);}
  if(c.gear==='bow'){
    const g=group(root,.62,1.22,.26);const points=[];for(let i=0;i<=16;i++){const a=-Math.PI*.43+i/16*Math.PI*.86;points.push([.32*Math.cos(a)-.10,.75*Math.sin(a),0]);}for(let i=0;i<points.length-1;i++)rod(g,m.wood,points[i],points[i+1],.033);rod(g,m.paper,points[0],points.at(-1),.005);rod(g,m.gold,[.21,-.11,0],[.21,.11,0],.048);
    const quiver=group(root,-.26,1.32,-.22);quiver.rotation.z=-.2;cylinder(quiver,m.leather,0,0,0,.12,.1,.67,8);for(let i=0;i<5;i++){const x=(i-2)*.037;rod(quiver,m.wood,[x,-.08,0],[x,.66+(i%2)*.06,0],.009);box(quiver,m.paper,x,.59+(i%2)*.06,0,.055,.1,.009);}
  }
  if(c.gear==='daggers'){for(const s of [-1,1]){const g=group(root,s*.54,1.1,.38);g.rotation.set(-.35,0,s*-.18);rod(g,m.leather,[0,.08,0],[0,-.13,0],.033);box(g,m.gold,0,-.12,0,.21,.027,.06);const blade=cone(g,m.steel,0,-.40,0,.073,.52,4);blade.rotation.z=Math.PI;}}
  if(c.gear==='axe'){
    const g=group(root,.61,1.13,.28);g.rotation.z=-.17;rod(g,m.wood,[0,-.91,0],[0,1.02,0],.05);for(const y of [-.12,0,.12])cylinder(g,m.leather,0,y,0,.06,.06,.055,8);
    for(const s of [-1,1]){const shape=new T.Shape();shape.moveTo(0,.91);shape.lineTo(s*.44,1.06);shape.lineTo(s*.54,.71);shape.lineTo(s*.39,.48);shape.lineTo(0,.66);shape.closePath();add(g,new T.ExtrudeGeometry(shape,{depth:.07,bevelEnabled:true,bevelSize:.025,bevelThickness:.01,bevelSegments:1}),m.steel,0,0,-.035);}box(g,m.gold,0,.78,.07,.10,.4,.02);
  }
  if(c.gear==='mace'){const g=group(root,.56,1.13,.35);rod(g,m.wood,[0,-.48,0],[0,.46,0],.04);const head=lantern(g,m);head.position.y=.55;for(let i=0;i<4;i++){const a=i*Math.PI/2;const blade=box(g,m.steel,Math.sin(a)*.15,.53,Math.cos(a)*.15,.055,.30,.12);blade.rotation.y=a;}}
  if(c.gear==='scythe'){const g=group(root,.68,0,.23);rod(g,m.wood,[0,.1,0],[0,2.57,0],.04);branch(g,m.bone,[[.02,2.50,0],[-.31,2.63,0],[-.64,2.50,0],[-.91,2.2,0]],.105);for(let i=0;i<3;i++)cylinder(g,m.gold,0,1.11+i*.1,0,.049,.049,.03);}
  if(c.gear==='fists'){for(const s of [-1,1]){const g=group(root,s*.53,1.1,.35);for(let j=0;j<4;j++)cylinder(g,m.paper,0,.06-j*.043,0,.083,.083,.025,8);crystal(g,m.glow,0,-.01,.08,.045);}}
  if(c.gear==='crossbow'){const g=group(root,.58,1.13,.36);box(g,m.wood,0,0,.09,.10,.13,.54);rod(g,m.steel,[-.29,.015,.22],[.29,.015,.22],.025);rod(g,m.paper,[-.29,.02,.22],[0,.02,-.08],.006);rod(g,m.paper,[0,.02,-.08],[.29,.02,.22],.006);rod(g,m.steel,[0,.08,-.09],[0,.08,.47],.012);}
  if(c.gear==='rapier'){const g=group(root,.53,1.12,.31);g.rotation.x=-.38;rod(g,m.leather,[0,.1,0],[0,-.13,0],.028);torus(g,m.gold,0,-.05,.01,.10,.014).scale.set(.7,1.3,1);rod(g,m.steel,[0,-.12,0],[0,-1.08,0],.025,.004);}
  if(!['none','quiver'].includes(c.offhand))offhand(root,m,c.offhand);
}
function headwear(root,m,c){
  const g=group(root,0,1.91,.015);const hood=['hood','highhood'].includes(c.hat);
  if(hood){ball(g,m.cloth,0,.02,-.06,.285,.345,.24);ball(g,m.dark,0,-.015,.095,.225,.257,.085);if(c.hat==='highhood'){const peak=cone(g,m.cloth,0,.33,-.09,.23,.42);peak.rotation.x=-.2;}}
  if(!['plague'].includes(c.hat)){
    ball(g,m.skin,0,-.015,.095,.17,.225,.155);ball(g,m.skin,0,-.025,.245,.035,.055,.043);
    for(const s of [-1,1]){ball(g,m.dark,s*.064,.035,.232,.015,.013,.008);rod(g,m.hair,[s*.02,.078,.232],[s*.107,.071,.215],.012);}
  }
  if(c.beard){ball(g,m.hair,0,-.16,.15,.155,.18,.12);for(let i=-2;i<=2;i++){const strand=cone(g,m.hair,i*.04,-.33+Math.abs(i)*.035,.19,.06,.31-Math.abs(i)*.035,6);strand.rotation.z=Math.PI+i*.09;}}
  if(c.veil){ball(g,m.cloth,0,-.105,.221,.176,.12,.059);}
  if(['bent','wide','floppy'].includes(c.hat)){
    const hat=group(g,0,.17,-.01);hat.rotation.z=c.hat==='floppy'?-.13:-.07;
    const brim=cylinder(hat,m.cloth,0,0,0,.48,.51,.043,16);brim.scale.z=.88;
    cylinder(hat,m.cloth,0,.13,0,.21,.30,.27,12);cylinder(hat,m.gold,0,.055,0,.276,.288,.05,12);
    if(c.hat==='bent'||c.hat==='floppy'){const bend=c.hat==='floppy'?-.24:.23;branch(hat,m.cloth,[[0,.19,0],[.035,.43,0],[bend,.61,0],[bend+.14,.57,0]],.21);}
    else{cone(hat,m.cloth,0,.38,0,.235,.62,12);for(let i=0;i<3;i++)crystal(hat,m.gold,.015,.2+i*.105,.22-i*.045,.021);}
  }
  if(c.hat==='turban'){ball(g,m.cloth,0,.17,-.01,.27,.20,.23);for(let i=0;i<4;i++){const ring=torus(g,m.gold,0,.1+i*.06,0,.24-i*.014,.024);ring.rotation.x=Math.PI/2;ring.rotation.z=.12;}crystal(g,m.glow,0,.14,.237,.045);}
  if(c.hat==='hair'){ball(g,m.hair,0,.14,-.025,.21,.17,.2);for(const s of [-1,1])ball(g,m.hair,s*.17,-.025,-.05,.085,.23,.15);}
  if(c.hat==='mohawk'){for(let i=0;i<5;i++)cone(g,m.hair,0,.23,-.12+i*.061,.065,.23,5);}
  if(c.hat==='antlers'||c.hat==='crown'){
    ball(g,m.hair,0,.14,-.06,.20,.16,.19);const crown=torus(g,m.wood,0,.14,0,.22,.025);crown.rotation.x=Math.PI/2;
    for(const s of [-1,1]){
      if(c.hat==='antlers'){branch(g,m.wood,[[s*.15,.17,0],[s*.28,.39,0],[s*.43,.58,-.05],[s*.46,.76,-.1]],.048);branch(g,m.wood,[[s*.28,.38,0],[s*.15,.63,0],[s*.21,.80,-.05]],.03);branch(g,m.wood,[[s*.40,.53,-.03],[s*.66,.57,0],[s*.72,.71,0]],.025);}
      else for(let i=0;i<3;i++)branch(g,m.bone,[[s*(.10+i*.06),.11,-.05+i*.06],[s*(.15+i*.08),.45-i*.07,-.03+i*.06],[s*(.12+i*.11),.61-i*.05,0+i*.06]],.032);
    }
  }
  if(c.hat==='plague'){
    ball(g,m.dark,0,0,-.01,.235,.26,.19);ball(g,m.bone,0,-.025,.17,.19,.21,.125);
    branch(g,m.bone,[[0,-.055,.22],[0,-.13,.38],[0,-.24,.50]],.11);
    for(const s of [-1,1]){ball(g,m.gold,s*.10,.055,.265,.066,.068,.036);ball(g,m.dark,s*.10,.055,.292,.048,.05,.022);}
    cylinder(g,m.dark,0,.21,0,.37,.39,.035,14);cylinder(g,m.dark,0,.33,-.025,.19,.24,.25,10);cylinder(g,m.gold,0,.24,-.025,.235,.24,.036,10);
  }
  if(c.hat==='feather'){
    ball(g,m.hair,0,.085,-.06,.205,.19,.19);const cap=ball(g,m.cloth,0,.2,0,.28,.105,.25);cap.rotation.z=.14;rod(g,m.gold,[-.20,.23,0],[-.36,.67,-.05],.008);for(let i=0;i<6;i++){const feather=ball(g,m.paper,-.26-i*.018,.31+i*.049,-.01,.085,.024,.011);feather.rotation.z=-.55;}
  }
  if(c.halo){const halo=torus(g,m.gold,0,.11,-.25,.37,.018,Math.PI*1.7);halo.rotation.z=-.7;}
}
export function createCharacter(c){
  const root=new T.Group();root.name=c.id+' '+c.name;
  const m={cloth:material(c.cloth),gold:material(c.trim,.5),glow:material(c.color,.12,true),wood:material('#574638'),leather:material('#433b32'),dark:material('#182022'),bone:material('#c6c0a5'),steel:material('#8d9b9c',.7),skin:material(c.id==='W07'?'#a6a394':c.id==='W08'||c.id==='C08'?'#9e7154':'#b39a7e'),hair:material(c.beard?'#bfc1b4':'#493e34'),paper:material('#c5c3a7'),ink:material('#625f49'),stone:material('#42595c'),leaf:material('#697f4c')};
  const width=c.muscular?.37:.28;
  // Named body and limb groups leave these studies straightforward to rig later.
  const body=group(root);body.name='body';
  ball(body,c.armor?m.steel:m.cloth,0,1.40,0,width,.34,.205);
  const short=c.robe==='short',coat=['C04','C09'].includes(c.id);drape(body,m.cloth,1.22,short?.67:coat?.44:.15,width*.89,short?.36:coat?.40:.48,{split:c.robe==='split',ragged:c.robe==='ragged'});
  cylinder(body,m.leather,0,1.16,0,width*.97,width,.09,14).scale.z=.75;box(body,m.gold,0,1.165,.228,.11,.085,.023);
  if(c.robe!=='short'){for(const s of [-1,1]){rod(body,m.gold,[s*.15,1.11,.17],[s*.23,coat?.52:.22,coat?.26:.3],.013);}}
  rod(body,m.gold,[-.20,1.64,.125],[0,1.40,.216],.013);rod(body,m.gold,[.20,1.64,.125],[0,1.40,.216],.013);crystal(body,m.glow,0,1.43,.23,.046);
  for(const s of [-1,1]){
    const leg=group(root,s*.16,.78,0);leg.name=s<0?'legL':'legR';rod(leg,m.leather,[0,0,0],[0,-.61,.015],.095,.074);box(leg,m.dark,0,-.66,.08,.20,.16,.31);
    const arm=group(body,s*(width+.02),1.56,0);arm.name=s<0?'armL':'armR';const bare=c.muscular;
    rod(arm,bare?m.skin:m.cloth,[0,0,0],[s*.13,-.26,.045],bare?.116:.135,bare?.091:.097);
    rod(arm,bare?m.skin:m.cloth,[s*.13,-.26,.045],[s*.23,-.42,.31],.085,bare?.072:.115);
    ball(arm,m.skin,s*.23,-.445,.335,.069,.082,.07);
    if(!bare){rod(arm,m.gold,[s*.217,-.398,.29],[s*.233,-.43,.31],.108,.105);}
    if(c.armor){ball(arm,m.steel,s*.035,.03,0,.19,.125,.21);}
  }
  if(c.mantle||c.fur||c.leaves){for(let i=0;i<12;i++){const a=i/12*Math.PI*2;const x=Math.sin(a)*.33,z=Math.cos(a)*.21;const material=c.fur?m.leather:c.leaves?m.leaf:m.cloth;const plate=ball(body,material,x,1.58,z,.16,c.leaves?.17:.10,.13);plate.rotation.z=-Math.sin(a)*.25;if(c.leaves){cone(body,m.leaf,x*1.1,1.43,z*1.2,.10,.24,5).rotation.z=Math.PI;}}}
  if(c.stole){for(const s of [-1,1])box(body,m.gold,s*.18,.95,.268,.085,1.14,.02);}
  if(c.bones){for(const s of [-1,1]){for(let i=0;i<4;i++)rod(body,m.bone,[s*.065,1.59-i*.08,.20],[s*(.22-i*.019),1.54-i*.08,.17],.023);for(let i=0;i<3;i++)cone(body,m.bone,s*(.26+i*.048),1.66,0,.031,.18,6);}}
  if(c.pouches){for(const s of [-1,1]){box(body,m.leather,s*.30,1.02,.15,.16,.19,.10);box(body,m.gold,s*.30,1.065,.206,.06,.02,.012);}}
  if(c.id==='C09')for(let i=-1;i<=1;i++){ball(body,m.glow,i*.12,1.03,.27,.042,.065,.041);cylinder(body,m.wood,i*.12,1.10,.27,.025,.025,.025,6);}
  if(c.beads){for(let i=0;i<13;i++){const a=i/12*Math.PI;ball(body,m.wood,Math.cos(a)*.20,1.6-Math.sin(a)*.27,.23,.028);}box(body,m.gold,-.17,1.39,.21,.08,.4,.025).rotation.z=-.55;}
  if(c.cape||c.robe==='short')cape(body,m.cloth,c.cape?1.23:.81,c.muscular?.92:.76);
  else cape(body,m.cloth,1.44,.77);
  headwear(root,m,c);weapons(root,m,c);
  root.userData.materials=m;
  return root;
}

export function createStudyScene(c,root=createCharacter(c)){
  const scene=new T.Scene();
  scene.add(new T.HemisphereLight(0xacc6dc,0x554836,2.0));
  const moon=new T.DirectionalLight(0xa7c7ee,3.1);moon.position.set(-3,6,5);moon.castShadow=true;moon.shadow.mapSize.set(1024,1024);Object.assign(moon.shadow.camera,{left:-3,right:3,top:4,bottom:-3,near:.1,far:18});moon.shadow.normalBias=.025;moon.shadow.bias=-.0003;scene.add(moon);
  const warm=new T.DirectionalLight(0xf9d99c,1.5);warm.position.set(2,4,3);scene.add(warm);
  const rim=new T.DirectionalLight(0x77cddd,2);rim.position.set(3,4,-3);scene.add(rim);
  const floorMat=material('#1d3035');const floor=cylinder(scene,floorMat,0,-.14,0,1.45,1.51,.16,32);
  floor.receiveShadow=true;
  const stones=[material('#34464a'),material('#2b3c40'),material('#3a4849')];
  for(let ring=0;ring<4;ring++){const count=ring===0?1:ring*8;for(let i=0;i<count;i++){const a=i/count*Math.PI*2+ring*.23,r=ring*.38;const mesh=cylinder(scene,stones[(i+ring)%3],Math.sin(a)*r,-.06,Math.cos(a)*r,.17+(i%3)*.013,.18,.065,5+i%3);mesh.rotation.y=i*.71;mesh.scale.z=.89;}}
  const ring=add(scene,new T.RingGeometry(.55,.567,48),new T.MeshBasicMaterial({color:0x9dced0,transparent:true,opacity:.47,side:T.DoubleSide}),0,-.015,0);ring.rotation.x=-Math.PI/2;
  root.rotation.y=.12;scene.add(root);
  const glow=new T.PointLight(c.color,1.4,3,2);glow.position.set(.5,2.1,.5);scene.add(glow);
  const fx=new T.Group();scene.add(fx);
  return{scene,root,fx,glow};
}
export function disposeStudy(study){const gs=new Set(),ms=new Set();study.scene.traverse(o=>{if(o.geometry)gs.add(o.geometry);if(o.material)for(const m of Array.isArray(o.material)?o.material:[o.material])ms.add(m);if(o.isLight)o.dispose?.();});gs.forEach(g=>g.dispose());const textures=new Set();ms.forEach(m=>{if(m.map)textures.add(m.map);m.dispose();});textures.forEach(t=>t.dispose());}

export function addSkillEffect(study,color,type){
  clearEffect(study);const m=new T.MeshBasicMaterial({color,transparent:true,opacity:.8,depthWrite:false});
  if(type==='ring'||type==='burst'){for(let i=0;i<3;i++){const r=add(study.fx,new T.TorusGeometry(.6+i*.12,.018,5,56),m,0,.04+i*.025,0);r.rotation.x=Math.PI/2;r.userData.ring=true;}}
  for(let i=0;i<36;i++){const particle=add(study.fx,new T.OctahedronGeometry(.025+(i%3)*.013),m);particle.userData={i,type};}
  study.fx.userData={start:performance.now(),type};
}
export function animateEffect(study,time){
  const age=(time-study.fx.userData.start)/1000,type=study.fx.userData.type;if(!type)return;
  if(age>1.8){clearEffect(study);study.root.visible=true;study.root.position.set(0,0,0);return;}
  study.fx.children.forEach(o=>{o.material.opacity=Math.max(0,1-age/1.8)*.85;if(o.userData.ring){o.scale.setScalar(1+age*1.7);return;}const i=o.userData.i,a=i/36*Math.PI*2+age*2;
    if(type==='bolt'){o.position.set(.52+Math.sin(i*2)*.09,1.45+Math.cos(i*2)*.1,.3+age*2.1-i*.012);}
    else if(type==='slash'){const angle=-1.2+(i/36)*2.3+age*.7;o.position.set(Math.sin(angle)*1.15,1.0+Math.sin(i*.12)*.18,Math.cos(angle)*1.15);}
    else if(type==='blink'){o.position.set(Math.sin(a)*.4,((i*.13+age)%1.8),Math.cos(a)*.4);study.root.position.y=Math.sin(Math.min(age,1)*Math.PI)*.10;}
    else{const r=type==='burst'?.3+age*1.2:.65+Math.sin(i+age)*.12;o.position.set(Math.sin(a)*r,type==='ring'?.12+Math.sin(i*3+age)*.07:.15+(i%9)*.20+Math.sin(age*3+i)*.1,Math.cos(a)*r);}
    o.rotation.set(age+i,age*2,age*.4);
  });
}
export function clearEffect(study){const materials=new Set();for(const o of [...study.fx.children]){o.geometry.dispose();materials.add(o.material);study.fx.remove(o);}materials.forEach(m=>m.dispose());study.fx.userData={};}
