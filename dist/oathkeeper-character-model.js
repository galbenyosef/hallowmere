import * as T from './vendor/three.core.js';

// Shared native geometry for the picker, portraits, study, and playable rig.
const up=new T.Vector3(0,1,0);
const material=(color,metalness=0,glow=0)=>new T.MeshStandardMaterial({color,metalness,roughness:metalness?.38:.78,flatShading:true,emissive:glow?color:0,emissiveIntensity:glow});
function group(parent,name,x=0,y=0,z=0){const g=new T.Group();g.name=name;g.position.set(x,y,z);parent.add(g);return g;}
function mesh(parent,geometry,mat,x=0,y=0,z=0,sx=1,sy=1,sz=1){const m=new T.Mesh(geometry,mat);m.position.set(x,y,z);m.scale.set(sx,sy,sz);m.castShadow=m.receiveShadow=true;parent.add(m);return m;}
const ball=(p,m,x,y,z,sx,sy=sx,sz=sx)=>mesh(p,new T.SphereGeometry(1,12,8),m,x,y,z,sx,sy,sz);
const box=(p,m,x,y,z,sx,sy,sz)=>mesh(p,new T.BoxGeometry(1,1,1),m,x,y,z,sx,sy,sz);
function rod(p,m,a,b,r=.02,r2=r){const start=new T.Vector3(...a),end=new T.Vector3(...b),delta=end.clone().sub(start);const n=mesh(p,new T.CylinderGeometry(r2,r,delta.length(),8),m);n.position.copy(start.add(end).multiplyScalar(.5));n.quaternion.setFromUnitVectors(up,delta.normalize());return n;}
function path(p,m,points,r=.015){for(let i=1;i<points.length;i++)rod(p,m,points[i-1],points[i],r);}
function plate(p,m,points,depth=.025){const shape=new T.Shape();points.forEach(([x,y],i)=>i?shape.lineTo(x,y):shape.moveTo(x,y));shape.closePath();return mesh(p,new T.ExtrudeGeometry(shape,{depth,bevelEnabled:false}),m);}
const gem=(p,m,x,y,z,s=.045)=>mesh(p,new T.OctahedronGeometry(1),m,x,y,z,s,s*1.55,s*.65);

function makeFace(head,m){
 // One continuous oval face replaces the overlapping head/chin spheres.
 // Features sit on the skin surface, so eyes stay inset in three-quarter views.
 const face=group(head,'oathkeeper-face'),segments=40,positions=[],indices=[];
 const rings=[[-.199,.027,.043,.012],[-.18,.061,.068,.011],[-.145,.087,.087,.010],[-.105,.108,.102,.005],[-.06,.122,.113,0],[-.015,.132,.12,0],[.03,.134,.122,0],[.08,.13,.12,-.003],[.13,.117,.107,-.008],[.18,.089,.081,-.016],[.215,.037,.035,-.021]];
 function profile(y){
  const end=Math.max(1,rings.findIndex(row=>row[0]>=y)),a=rings[end-1],b=rings[end],t=T.MathUtils.clamp((y-a[0])/(b[0]-a[0]),0,1);
  return [1,2,3].map(i=>T.MathUtils.lerp(a[i],b[i],t));
 }
 const nose=(x,y)=>.018*Math.exp(-((x/.022)**2)-((y+.033)/.035)**2)+.008*Math.exp(-((x/.015)**2)-((y-.018)/.064)**2);
 const surface=(x,y)=>{const [w,d,shift]=profile(y);return shift+d*Math.sqrt(Math.max(0,1-(x/w)**2))+nose(x,y);};
 for(const [y,w,d,shift] of rings)for(let i=0;i<segments;i++){
  const a=i/segments*Math.PI*2,x=Math.sin(a)*w,front=Math.cos(a);
  positions.push(x,y,front*d+shift+(front>0?nose(x,y)*front:0));
 }
 for(let j=0;j<rings.length-1;j++)for(let i=0;i<segments;i++){const a=j*segments+i,b=j*segments+(i+1)%segments;indices.push(a,b,a+segments,b,b+segments,a+segments);}
 const skin=m.skin.clone();skin.flatShading=false;skin.roughness=.95;
 const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.Float32BufferAttribute(positions,3));geometry.setIndex(indices);geometry.computeVertexNormals();mesh(face,geometry,skin);
 function patch(name,mat,outline,offset=.003){
  const points=outline.map(([x,y])=>new T.Vector2(x,y)),g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(outline.flatMap(([x,y])=>[x,y,surface(x,y)+offset]),3));g.setIndex(T.ShapeUtils.triangulateShape(points,[]).flat());g.computeVertexNormals();
  const feature=group(face,name),piece=mesh(feature,g,mat);piece.castShadow=false;return piece;
 }
 const eyeWhite=material('#c8c1ad'),iris=material('#426978'),pupil=material('#26353a'),lid=material('#8f6d5e'),brow=material('#9a815b'),lip=material('#af7d70');
 for(const s of [-1,1]){
  const x=s*.055,y=.012;
  const outline=[[-.027,0],[-.014,.008],[.004,.009],[.026,.001],[.014,-.006],[-.009,-.007]].map(([dx,dy])=>[x+dx,y+dy]);
  patch(`oathkeeper-eye-${s}`,eyeWhite,outline);
  const oval=(rx,ry)=>Array.from({length:12},(_,i)=>{const a=i/12*Math.PI*2;return [x+Math.cos(a)*rx,y+Math.sin(a)*ry];});
  patch(`oathkeeper-iris-${s}`,iris,oval(.009,.008),.0045);
  patch(`oathkeeper-pupil-${s}`,pupil,oval(.0038,.006),.0055);
  patch(`oathkeeper-upper-lid-${s}`,lid,[[x-.027,y],[x-.014,y+.009],[x+.004,y+.010],[x+.026,y+.001],[x+.004,y+.007],[x-.013,y+.006]],.006);
  patch(`oathkeeper-brow-${s}`,brow,[[x-.026,.042],[x-.010,.048],[x+.014,.047],[x+.026,.041],[x+.012,.043],[x-.01,.044]],.003);
  ball(head,skin,s*.132,-.027,-.005,.020,.039,.017);
 }
 // A small, relaxed closed mouth; no raised tube or exaggerated smile.
 patch('oathkeeper-mouth',lip,[[-.03,-.10],[-.011,-.096],[0,-.098],[.011,-.096],[.03,-.10],[.014,-.105],[0,-.107],[-.014,-.105]],.003);
}

function makeHead(body,m){
 const head=group(body,'head',0,2.035,.02);
 makeFace(head,m);
 const hair=group(head,'oathkeeper-blonde-hair');
 mesh(hair,new T.SphereGeometry(.153,14,9,0,Math.PI*2,0,1.65),m.hair,0,.082,-.02,1,1,1);
 for(let i=0;i<9;i++){
  const x=(i-4)*.031;
  path(hair,i%2?m.hair:m.hairLight,[[x,.10,.112-Math.abs(x)*.3],[x*.8,.214,-.006],[x*.7,.18,-.116]],.018);
 }
 for(const s of [-1,1])for(let i=0;i<3;i++){
  const lock=group(hair,`oathkeeper-fringe-${s}-${i}`);
  path(lock,i%2?m.hairLight:m.hair,[[s*(.04+i*.03),.178,.091],[s*(.105+i*.014),.075-i*.028,.127],[s*(.122+i*.015),-.06-i*.02,.106],[s*.094,-.133-i*.025,.083]],.013-i*.002);
 }
 const ponytail=group(hair,'oathkeeper-high-ponytail',0,.175,-.12);
 ball(ponytail,m.gold,0,0,0,.057,.046,.052);
 for(let i=0;i<7;i++){
  const x=(i-3)*.02;
  path(ponytail,i%2?m.hair:m.hairLight,[[x,0,-.015],[x*1.8,.13,-.095],[x*2,.05,-.22],[x*1.5,-.15-i*.012,-.29],[x*1.1,-.30-i*.025,-.235]],.027-i%3*.003);
 }
 const halo=group(head,'oathkeeper-halo',0,.225,0);
 const ring=mesh(halo,new T.TorusGeometry(.184,.014,6,32,Math.PI*1.7),m.gold);ring.rotation.set(Math.PI/2,.13,-.45);
 for(const s of [-1,1]){box(halo,m.dark,s*.158,-.055,0,.032,.1,.055);gem(halo,m.blue,s*.164,-.035,.032,.019);}
}

function makeWings(body,m){
 const pack=group(body,'oathkeeper-wing-harness',0,1.61,-.195);
 box(pack,m.dark,0,0,-.06,.3,.34,.17);plate(pack,m.ivory,[[-.13,.16],[.13,.16],[.19,-.03],[0,-.24],[-.19,-.03]],.06).position.z=-.18;
 for(const s of [-1,1]){
  const wing=group(body,s<0?'oathkeeper-wing-left':'oathkeeper-wing-right',s*.21,1.73,-.25);
  // Articulated ivory spars and individually separated luminous flight feathers.
  path(wing,m.gold,[[0,0,0],[s*.30,.33,-.035],[s*.65,.48,-.07],[s*.98,.39,-.10]],.044);
  const shoulder=plate(wing,m.ivory,[[0,-.13],[s*.17,-.015],[s*.38,.31],[s*.74,.44],[s*.70,.54],[s*.29,.44],[s*.04,.14]],.06);shoulder.position.z=-.06;
  for(let i=0;i<5;i++){
   const feather=group(wing,`oathkeeper-feather-${s}-${i}`),x=.21+i*.145,y=.19+i*.051,tipX=.53+i*.116,tipY=-.79+i*.225;
   plate(feather,m.gold,[[s*x,y],[s*(x+.071),y+.025],[s*(tipX+.033),tipY+.08],[s*tipX,tipY],[s*(tipX-.035),tipY+.17]],.019).position.z=-.065-i*.006;
   plate(feather,m.light,[[s*(x+.014),y-.015],[s*(x+.056),y+.003],[s*(tipX+.011),tipY+.087],[s*tipX,tipY+.035],[s*(tipX-.016),tipY+.18]],.022).position.z=-.039-i*.006;
   path(feather,m.ivory,[[s*x,y,0],[s*(x+.046),y-.14,-.003],[s*(x+.095),y-.29,-.012]],.027);
  }
  for(const [x,y] of [[.11,.075],[.34,.33]]){
   const joint=group(wing,'oathkeeper-wing-joint',s*x,y,.016);
   const rim=mesh(joint,new T.CylinderGeometry(.076,.076,.05,12),m.gold);rim.rotation.x=Math.PI/2;
   gem(joint,m.amber,0,0,.033,.039);
  }
 }
}

function makeStaff(arm,m){
 const staff=group(arm,'weapon',.115,-.475,.14);
 rod(staff,m.dark,[0,-1.0,0],[0,1.04,0],.028);
 for(const y of [-.94,-.25,-.14,.36,.70])mesh(staff,new T.CylinderGeometry(.038,.038,.044,10),m.gold,0,y,0);
 for(let i=0;i<6;i++)rod(staff,m.leather,[-.027,-.08+i*.027,.025],[.027,-.07+i*.027,.025],.004);
 gem(staff,m.amber,0,.76,.022,.054);
 for(const s of [-1,1]){
  plate(staff,m.gold,[[s*.026,.75],[s*.145,.96],[s*.107,1.30],[s*.055,1.38],[s*.075,1.05],[s*.02,.91]],.038);
  plate(staff,m.ivory,[[s*.11,.96],[s*.085,1.28],[s*.061,1.32],[s*.055,1.03]],.044);
 }
 const tip=group(staff,'oathkeeper-staff-tip',0,1.10,.015);gem(tip,m.light,0,0,0,.065);gem(staff,m.blue,0,.51,.033,.021);
 return staff;
}
function makeBlaster(parent,m,name){
 const g=group(parent,name);
 box(g,m.ivory,0,0,.065,.115,.11,.28);box(g,m.gold,0,.047,.062,.12,.025,.28);
 box(g,m.dark,0,-.086,-.022,.076,.16,.084).rotation.x=-.2;
 box(g,m.dark,0,0,.217,.092,.082,.03);gem(g,m.light,0,0,.241,.024);
 return g;
}

export function createOathkeeperCharacter(){
 const root=new T.Group();root.name='Oathkeeper';root.userData.characterConcept='C05';
 const m={ivory:material('#eee8d9',.35),white:material('#fffaed'),gold:material('#c49b48',.7),dark:material('#282d34',.12),leather:material('#5e4534'),cloth:material('#d0a54e'),skin:material('#dfb697'),lip:material('#a8685f'),hair:material('#e4d3a1'),hairLight:material('#fff0c8'),hairShade:material('#a88b55'),eye:material('#64b5d4'),blue:material('#60cfe3',.25,.65),amber:material('#f3a36a',.3,.5),light:material('#ffe5a0',.15,1.3)};
 const body=group(root,'body');
 ball(body,m.dark,0,1.405,0,.205,.295,.144);
 const breastplate=group(body,'oathkeeper-ivory-armor');
 plate(breastplate,m.ivory,[[-.205,1.66],[.205,1.66],[.226,1.48],[.151,1.30],[.14,1.18],[0,1.11],[-.14,1.18],[-.151,1.30],[-.226,1.48]],.067).position.z=.113;
 for(const s of [-1,1]){
  path(breastplate,m.gold,[[s*.19,1.64,.182],[s*.21,1.48,.184],[s*.14,1.29,.183],[0,1.12,.183]],.009);
  plate(breastplate,m.gold,[[0,1.54],[s*.04,1.58],[s*.18,1.56],[s*.10,1.51],[s*.065,1.52],[0,1.48]],.013).position.z=.184;
 }
 gem(breastplate,m.blue,0,1.53,.21,.03);
 rod(body,m.skin,[0,1.68,0],[0,1.89,0],.068);
 const collar=mesh(body,new T.CylinderGeometry(.09,.13,.115,12),m.ivory,0,1.73,0);collar.scale.z=.8;
 box(body,m.dark,0,1.115,0,.36,.08,.31);box(body,m.gold,0,1.115,.175,.084,.07,.025);
 const skirts=group(body,'oathkeeper-split-coat');
 for(const s of [-1,1]){
  const panel=plate(skirts,m.cloth,[[s*.03,1.07],[s*.18,1.11],[s*.36,.26],[s*.20,.08],[s*.07,.49]],.02);panel.position.z=.09;panel.rotation.y=s*.18;
  const tail=plate(skirts,m.ivory,[[s*.15,1.12],[s*.24,1.02],[s*.40,.38],[s*.29,.27],[s*.18,.70]],.025);tail.position.z=-.03;
  path(skirts,m.gold,[[s*.18,1.08,.12],[s*.34,.27,.12],[s*.21,.13,.12]],.009);
  const hip=plate(body,m.ivory,[[s*.13,1.15],[s*.27,1.10],[s*.31,.89],[s*.20,.97]],.042);hip.position.z=.097;gem(body,m.blue,s*.245,1.066,.159,.026);
  const leg=group(root,s<0?'legL':'legR',s*.117,.98,0);
  rod(leg,m.dark,[0,0,0],[0,-.56,.008],.078,.063);
  const knee=group(leg,'oathkeeper-gold-greave',0,-.47,.056);gem(knee,m.gold,0,0,0,.082);gem(knee,m.blue,0,.006,.052,.03);
  rod(leg,m.gold,[0,-.55,.006],[0,-.83,.022],.067,.06);
  box(leg,m.ivory,0,-.88,.073,.14,.15,.255);box(leg,m.dark,0,-.954,.073,.145,.027,.26);
  path(leg,m.ivory,[[0,-.55,.081],[0,-.76,.082],[0,-.87,.14]],.019);
  const arm=group(body,s<0?'armL':'armR',s*.245,1.64,0);
  ball(arm,m.gold,s*.007,.004,-.008,.117,.087,.125);ball(arm,m.ivory,s*.015,.039,0,.116,.065,.12);
  rod(arm,m.cloth,[0,-.04,0],[s*.08,-.26,.045],.065,.058);
  rod(arm,m.gold,[s*.08,-.26,.045],[s*.11,-.41,.115],.064,.045);
  path(arm,m.ivory,[[s*.08,-.26,.101],[s*.11,-.41,.16]],.019);
  ball(arm,m.skin,s*.115,-.475,.14,.045,.065,.045);
 }
 makeHead(body,m);makeWings(body,m);makeStaff(body.getObjectByName('armR'),m);
 const blaster=makeBlaster(body.getObjectByName('armL'),m,'oathkeeper-blaster');blaster.position.set(-.115,-.465,.17);blaster.visible=false;
 const holster=group(body,'oathkeeper-holstered-blaster',-.25,1.01,-.07);holster.rotation.x=-Math.PI/2;makeBlaster(holster,m,'oathkeeper-sidearm');
 return root;
}

export function updateOathkeeperPose(rig,dt){
 const gear=rig.oathkeeper;if(!gear)return;
 gear.time=rig.root.userData.oathkeeperReducedMotion?0:(gear.time||0)+dt;
 const flight=rig.root.userData.oathkeeperFlight||0,spread=flight?1:0;
 for(const [i,wing] of gear.wings.entries()){
  const sign=i===0?-1:1,target=sign*(spread*.35+Math.sin(gear.time*2.6)*.022);
  wing.rotation.z=T.MathUtils.lerp(wing.rotation.z,target,1-Math.exp(-dt*9));wing.rotation.y=sign*(.09+Math.sin(gear.time*2)*.025);
 }
 const lift=flight?.13+Math.sin(gear.time*3)*.025:0;
 rig.body.position.y+=lift;
 for(const leg of rig.legs){leg.userData.oathkeeperBaseY??=leg.position.y;leg.position.y=leg.userData.oathkeeperBaseY+lift;}
 const firing=rig.attack>0&&rig.attackKind==='bolt';gear.blaster.visible=firing;gear.holster.visible=!firing;
}
