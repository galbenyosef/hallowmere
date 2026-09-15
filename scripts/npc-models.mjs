import * as T from '../dist/vendor/three.core.js';
import {group, mesh, ball, rod as primRod, path as primPath, plate as primPlate, material} from '../dist/model-primitives.js';

// The workshop and game portraits share these source models. Dimensions use the
// same waist / arm / leg pivots as the other Hallowmere actors.
export const NPC_MODEL_IDS = ['elder', 'healer', 'smith', 'watchman'];
const mat = (color, metalness = 0, roughness = .82) => material(color, {metalness, roughness, flatShading: false});
const orb = (p,m,x,y,z,sx,sy,sz) => ball(p,m,x,y,z,sx,sy,sz,{widthSegments:16,heightSegments:10});
function plate(p,m,points,depth=.018,x=0,y=0,z=0) {
  return primPlate(p,m,points,depth,{x,y,z,bevel:.004});
}
const box = (p,m,x,y,z,w,h,d) => plate(p,m,[[-w/2,-h/2],[w/2,-h/2],[w/2,h/2],[-w/2,h/2]],d,x,y,z-d/2);
function rod(p,m,a,b,r,end=r,sides=10) {
  return primRod(p,m,a,b,r,end,sides);
}
function path(p,m,points,r,end=r) {
  return primPath(p,m,points,r,{tip:end});
}
function ring(p,m,x,y,z,r,t=.01) { return mesh(p,new T.TorusGeometry(r,t,6,24),m,x,y,z); }
function shell(p,m,rings,segments=16) {
  const positions=[],indices=[];
  rings.forEach(([y,w,d,z=0])=>{for(let i=0;i<segments;i++){const a=i/segments*Math.PI*2;positions.push(Math.sin(a)*w,y,Math.cos(a)*d+z);}});
  for(let j=0;j<rings.length-1;j++)for(let i=0;i<segments;i++){const a=j*segments+i,b=j*segments+(i+1)%segments;indices.push(a,b,a+segments,b,b+segments,a+segments);}
  const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(positions,3));g.setIndex(indices);g.computeVertexNormals();
  return mesh(p,g,m);
}
function cloak(p,m,{top=1.68,bottom=.38,width=.72,side=0}={}) {
  const vertices=[],indices=[],nx=16,ny=12;
  for(let j=0;j<=ny;j++)for(let i=0;i<=nx;i++){
    const u=i/nx,v=j/ny,x=(u-.5)*width*(.75+v*.42)+side*v*.10;
    vertices.push(x,top-(top-bottom)*v+.035*Math.cos(u*13)*v*v,-.18-.15*v+.035*Math.cos(u*22)*(v+.2));
  }
  for(let j=0;j<ny;j++)for(let i=0;i<nx;i++){const a=j*(nx+1)+i;indices.push(a,a+1,a+nx+1,a+1,a+nx+2,a+nx+1);}
  const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(vertices,3));g.setIndex(indices);g.computeVertexNormals();
  const material=m.clone();material.side=T.DoubleSide;return mesh(p,g,material);
}
function buckle(p,m,x,y,z,w=.085,h=.066) {
  box(p,m.metal,x,y,z,w,h,.02);box(p,m.dark,x,y,z+.015,w*.63,h*.55,.008);
  rod(p,m.metal,[x,y-h*.35,z+.023],[x,y+h*.35,z+.023],.003);
}
function pouch(p,m,x,y,z,size=1) {
  const g=group(p,'leather-pouch',x,y,z);g.scale.setScalar(size);
  box(g,m.leather,0,0,0,.14,.18,.095);
  plate(g,m.leather,[[-.071,.075],[.071,.075],[.060,.015],[0,-.008],[-.06,.015]],.014,0,0,.053);
  box(g,m.metal,0,.025,.075,.027,.035,.008);return g;
}
function vial(p,m,x,y,z,color) {
  const g=group(p,'apothecary-vial',x,y,z),liquid=mat(color,.25,.23);
  shell(g,liquid,[[-.09,.03,.025],[-.065,.045,.035],[.04,.045,.035],[.075,.021,.021]],12);
  rod(g,m.metal,[0,.058,0],[0,.087,0],.026);
  rod(g,m.leather,[0,.087,0],[0,.104,0],.021);
  box(g,m.paper,0,-.01,.037,.049,.050,.005);return g;
}
function book(p,m,x,y,z) {
  const g=group(p,'archive-volume',x,y,z);g.rotation.z=-.10;
  box(g,m.paper,0,0,0,.20,.28,.07);for(const d of [-.045,.045])box(g,m.leather,0,0,d,.23,.31,.016);
  for(const h of [-.10,.10])box(g,m.metal,0,h,.057,.23,.025,.012);
  for(let i=0;i<5;i++)box(g,m.trim,-.093+i*.045,-.154,.006,.003,.009,.063);
  return g;
}
function lantern(p,m,x,y,z) {
  const g=group(p,'ward-lantern',x,y,z),light=mat('#83b9a4',.15,.3);light.emissive.set('#447867');light.emissiveIntensity=.45;
  shell(g,light,[[-.17,.065,.065],[-.11,.075,.075],[.08,.075,.075],[.13,.035,.035]],8);
  for(const h of [-.17,.09])mesh(g,new T.CylinderGeometry(.089,.089,.033,8),m.metal,0,h,0);
  for(let i=0;i<4;i++){const a=i*Math.PI/2;rod(g,m.metal,[Math.sin(a)*.082,-.16,Math.cos(a)*.082],[Math.sin(a)*.082,.11,Math.cos(a)*.082],.008);}
  ring(g,m.metal,0,.195,0,.058,.009);return g;
}

function face(p,m,kind) {
  const head=group(p,'head',0,1.997,.022),female=kind==='healer',broad=kind==='smith';
  head.scale.x=female?.93:broad?1.08:1;
  shell(head,m.skin,[[-.18,.06,.055,.015],[-.14,.104,.09],[-.085,.128,.113],[-.015,.142,.12],[.095,.138,.118],[.165,.112,.089],[.195,.035,.027]],16);
  for(const s of [-1,1]){
    orb(head,m.skin,s*.145,-.024,-.005,.025,.049,.029);
    orb(head,m.skinShadow,s*.151,-.023,.016,.009,.028,.009);
    orb(head,m.skinShadow,s*.063,.022,.113,.039,.015,.012);
    orb(head,m.eyeWhite,s*.063,.019,.125,.028,.0065,.005);
    orb(head,m.iris,s*.063,.019,.130,.007,.007,.003);
    orb(head,m.dark,s*.063,.019,.133,.003,.006,.002);
    rod(head,m.hair,[s*.027,.052,.127],[s*.106,.061,.096],female?.005:.009,.005,6);
    path(head,m.skinShadow,[[s*.095,-.048,.101],[s*.058,-.071,.121]],.003,.0015);
  }
  const nose=new T.BufferGeometry();nose.setAttribute('position',new T.Float32BufferAttribute([-.018,.053,.119,.018,.053,.119,0,-.035,.168,-.024,-.051,.134,.024,-.051,.134,0,-.064,.133],3));
  nose.setIndex([0,2,1,0,3,2,1,2,4,3,5,2,2,5,4]);nose.computeVertexNormals();mesh(head,nose,m.skin);
  rod(head,m.mouth,[-.033,-.097,.115],[.033,-.097,.115],.004,.004,6);
  rod(head,m.skin,[-.025,-.106,.115],[.025,-.106,.115],.0035,.0035,6);
  // A shaped cap and swept locks leave the forehead and angular face exposed.
  mesh(head,new T.SphereGeometry(1,20,12,0,Math.PI*2,0,1.37),m.hair,0,.051,-.011,.155,.169,.157);
  for(let i=-5;i<=5;i++){
    const x=i*.025,e=Math.abs(i)/5;
    path(head,i%3===0?m.hairLight:m.hair,[[x,.118-e*.021,.140-e*.035],[x*.93+.013,.213-e*.039,.005],[x*.82+.015,.181-e*.018,-.122]],.009,.005);
  }
  if(kind==='elder'){
    for(const s of [-1,1]){
      path(head,m.hair,[[s*.128,.08,-.004],[s*.143,-.027,-.035],[s*.105,-.13,-.07]],.019,.013);
      plate(head,m.hair,[[s*.118,-.065],[s*.071,-.10],[s*.022,-.125],[s*.045,-.285],[s*.106,-.193]],.032,0,0,.068);
      rod(head,m.hair,[s*.006,-.079,.133],[s*.055,-.089,.118],.008,.005,8);
      for(let i=0;i<3;i++)path(head,m.skinShadow,[[s*.028,.108+i*.014,.114-i*.002],[s*.090,.113+i*.013,.096-i*.002]],.0013);
    }
    plate(head,m.hairLight,[[-.045,-.116],[.045,-.116],[.042,-.223],[0,-.285],[-.041,-.22]],.024,0,0,.092);
    box(head,m.metal,0,-.235,.123,.045,.018,.009);
  }else if(kind==='healer'){
    const braid=group(head,'braided-hair',-.115,.12,-.09);
    for(let i=0;i<9;i++)orb(braid,i%2?m.hair:m.hairLight,Math.sin(i*2.6)*.008,-i*.048,-.031-i*.003,.028,.034,.028);
    ring(braid,m.metal,0,-.37,-.055,.021,.006).rotation.x=Math.PI/2;
    orb(head,m.hair,.02,.09,-.16,.081,.073,.061);
    ring(head,m.metal,.161,-.069,.02,.021,.004);
  }else{
    for(const s of [-1,1]){
      path(head,m.hair,[[s*.13,-.054,.038],[s*.108,-.119,.074],[s*.035,-.163,.076]],.012,.017);
      rod(head,m.hair,[s*.005,-.077,.134],[s*.042,-.089,.119],.008,.006,6);
    }
    plate(head,m.hair,[[-.064,-.121],[.064,-.121],[.042,-.174],[0,-.192],[-.042,-.174]],.019,0,0,.075);
    if(broad){
      orb(head,m.hair,0,.205,-.11,.060,.037,.051);
      for(const s of [-1,1]){ring(head,m.metal,s*.068,.121,.116,.041,.008);orb(head,m.goggle,s*.068,.121,.119,.032,.029,.009);}
      rod(head,m.metal,[-.021,.124,.13],[.021,.124,.13],.006);
    }else path(head,m.scar,[[.07,.107,.12],[.077,.058,.128],[.08,.036,.136]],.003,.002);
  }
  return head;
}

export function createNpcCharacter(kind) {
  if(!NPC_MODEL_IDS.includes(kind))throw new Error(`Unknown villager model: ${kind}`);
  const elder=kind==='elder',healer=kind==='healer',smith=kind==='smith',watch=kind==='watchman';
  const root=new T.Group();root.name={elder:'Elder Rowan',healer:'Sister Edda',smith:'Brann',watchman:'Watchman Rook'}[kind];
  root.userData.npcModel=kind;
  const m={
    cloth:mat(elder?'#29474b':healer?'#466267':smith?'#4d3930':'#303e43'),
    trim:mat(elder?'#a6946c':healer?'#c9bea0':smith?'#a27753':'#828b80'),
    lining:mat(elder?'#162d32':healer?'#293f42':smith?'#262b2c':'#273032'),
    leather:mat(smith?'#583b2b':'#443b30'),dark:mat('#1b2426'),paper:mat('#bfb69d'),
    metal:mat(smith?'#bc8c57':'#a7966f',.72,.38),steel:mat('#748990',.75,.36),
    skin:mat(smith?'#885c41':healer?'#a98164':elder?'#bba28b':'#ac8d75'),
    skinShadow:mat(smith?'#553a2f':healer?'#735543':'#806853'),
    hair:mat(elder?'#afb1a7':smith?'#302d2b':healer?'#272c29':'#423c32'),
    hairLight:mat(elder?'#d0cfc0':smith?'#716860':healer?'#41453a':'#686352'),
    eyeWhite:mat('#b5ac94'),iris:mat(healer?'#9aaa77':smith?'#a68455':'#849d98'),mouth:mat('#624b40'),scar:mat('#8b5d50'),goggle:mat('#4c777d',.6,.2)
  };
  const body=group(root,'body'),width=smith?1.13:healer?.91:1;
  // Fitted torso, split coat tails, and individually articulated legs.
  shell(body,m.cloth,[[1.04,.22*width,.14],[1.17,.23*width,.16],[1.44,.29*width,.18],[1.62,.32*width,.155],[1.72,.20*width,.10]],20);
  for(const s of [-1,1]){
    const leg=group(root,s<0?'legL':'legR',s*.145,.98,0);
    rod(leg,m.lining,[0,0,0],[s*.026,-.41,.012],.12,.085);
    rod(leg,m.leather,[s*.026,-.40,.01],[s*.033,-.81,.013],.098,.071);
    const boot=plate(leg,m.leather,[[-.085,0],[.21,0],[.21,.072],[.08,.156],[-.078,.171]],.168,s*.032+.084,-.948,.012);boot.rotation.y=-Math.PI/2;
    const sole=plate(leg,m.dark,[[-.091,-.013],[.217,-.013],[.217,.019],[-.091,.019]],.176,s*.032+.088,-.95,.012);sole.rotation.y=-Math.PI/2;
    for(const y of [-.50,-.72]){rod(leg,m.dark,[s*.030,y,0],[s*.030,y-.03,0],.101,.098);buckle(leg,m,s*.102,y-.015,.06,.035,.034);}
    plate(leg,watch?m.steel:m.leather,[[-.065,-.40],[.065,-.40],[.068,-.59],[0,-.75],[-.059,-.61]],.018,s*.029,0,.102);
    const hem=elder?.27:healer?.42:smith?.64:.63;
    const panel=plate(body,smith?m.leather:m.cloth,[[s*.021,1.13],[s*.245*width,1.15],[s*.32*width,hem+.03],[s*.16,hem],[s*.050,hem+.16]],.025,0,0,.155);
    panel.rotation.y=s*.10;
    path(body,m.trim,[[s*.255*width,1.08,.185],[s*.314*width,hem+.06,.19],[s*.16,hem+.035,.186]],.0045);
    const arm=group(body,s<0?'armL':'armR',s*.325*width,1.625,0);
    rod(arm,smith?m.skin:m.cloth,[0,0,0],[s*.053,-.285,.014],smith?.135:.103,smith?.106:.078,14);
    rod(arm,smith?m.skin:m.lining,[s*.053,-.28,.014],[s*.083,-.52,.10],smith?.11:.083,.066,14);
    orb(arm,smith?m.skin:m.cloth,0,-.035,0,smith?.144:.12,.13,.135);
    rod(arm,m.leather,[s*.068,-.36,.047],[s*.083,-.52,.10],smith?.114:.091,.078);
    for(const y of [-.38,-.47])box(arm,m.metal,s*.078,y,smith?.173:.15,.105,.017,.012);
    const hand=group(arm,'hand',s*.085,-.565,.109);
    orb(hand,smith?m.skin:m.leather,0,0,0,.064,.083,.051);
    for(let i=0;i<4;i++)rod(hand,smith?m.skin:m.leather,[(i-1.5)*.023,-.013,.040],[(i-1.5)*.023,-.061,.051],.011,.009,6);
    orb(hand,smith?m.skin:m.leather,-s*.055,-.015,.037,.019,.039,.019);
  }
  // A collar, diagonal strap, and practical waist details establish the outfit.
  shell(body,m.lining,[[1.66,.12,.095],[1.78,.137,.10],[1.83,.102,.083]],16);
  rod(body,m.skin,[0,1.78,0],[0,1.89,0],.085,.078);
  for(const s of [-1,1])plate(body,m.cloth,[[s*.08,1.83],[s*.18,1.75],[s*.25,1.55],[s*.105,1.59]],.021,0,0,.107);
  const harness=box(body,m.leather,-.005,1.415,.190,.060,.60,.026);harness.rotation.z=-.56;
  box(harness,m.trim,-.022,0,.018,.003,.55,.005);
  buckle(body,m,-.125,1.58,.22,.076,.085);
  shell(body,m.leather,[[1.085,.248*width,.177],[1.165,.248*width,.177]],20);
  buckle(body,m,.02,1.126,.19,.099,.075);
  pouch(body,m,-.265*width,1.015,.082);
  face(body,m,kind);
  if(elder){
    cloak(body,m.lining,{bottom:.23,width:.92});
    const mantle=group(body,'archive-mantle');
    shell(mantle,m.cloth,[[1.43,.365,.17],[1.59,.39,.22],[1.75,.21,.125]],20);
    for(const s of [-1,1])path(mantle,m.trim,[[s*.095,1.73,.113],[s*.23,1.63,.215],[s*.36,1.49,.165]],.011);
    ring(body,m.metal,-.215,1.61,.226,.045,.01);orb(body,m.goggle,-.215,1.61,.227,.03,.03,.011);
    book(body,m,-.31,.91,.08);
    const staff=group(body,'astrolabe-staff',.43,1.06,.15);
    rod(staff,m.leather,[0,-1.01,0],[0,1.11,0],.032,.025);
    for(const y of [-.94,-.12,.08,.85])rod(staff,m.metal,[0,y,0],[0,y+.058,0],.037);
    ring(staff,m.metal,0,1.16,0,.12,.016);ring(staff,m.metal,0,1.16,0,.087,.007).rotation.y=.65;
    orb(staff,m.goggle,0,1.16,0,.038,.06,.038);
    for(const s of [-1,1])rod(staff,m.metal,[s*.09,1.11,0],[0,1.28,0],.006);
  }else if(healer){
    cloak(body,m.cloth,{bottom:.59,width:.76,side:-1});
    const shawl=group(body,'ivory-apothecary-shawl');
    for(const s of [-1,1])plate(shawl,m.paper,[[s*.09,1.79],[s*.335,1.66],[s*.37,1.41],[s*.20,1.47],[s*.11,1.24]],.023,0,0,.182);
    path(shawl,m.trim,[[-.1,1.75,.214],[0,1.67,.23],[.15,1.69,.215]],.025);
    ring(body,m.metal,.19,1.59,.22,.039,.009);
    for(const [i,color] of ['#456e69','#966142','#68765e'].entries())vial(body,m,-.13+i*.13,1.0,.21,color);
    pouch(body,m,.29,.91,.045,1.18);
    lantern(body,m,-.385,.89,.115);
    book(body,m,.32,1.03,-.03).rotation.z=.17;
  }else if(smith){
    const apron=group(body,'forge-apron');
    plate(apron,m.leather,[[-.205,1.58],[.20,1.58],[.24,1.16],[.04,1.10],[-.24,1.16]],.023,0,0,.181);
    for(const s of [-1,1])path(apron,m.trim,[[s*.195,1.55,.211],[s*.225,1.19,.211]],.005);
    box(apron,m.dark,.08,1.39,.221,.16,.11,.015);
    for(let i=0;i<3;i++)rod(apron,m.steel,[.032+i*.045,1.38,.234],[.032+i*.045,1.50,.234],.008);
    pouch(body,m,-.30,.90,.06,1.25);
    const hammer=group(body,'forging-hammer',.45,1.06,.15);hammer.rotation.z=-.12;
    rod(hammer,m.leather,[0,-.30,0],[0,.34,0],.033);
    for(let i=0;i<6;i++)ring(hammer,m.trim,0,-.14+i*.029,0,.034,.0035).rotation.x=Math.PI/2;
    box(hammer,m.steel,0,.30,0,.30,.14,.135);
    for(const s of [-1,1])box(hammer,m.metal,s*.163,.30,0,.042,.158,.153);
    box(hammer,m.dark,0,.30,.075,.066,.08,.014);
  }else{
    cloak(body,m.lining,{bottom:.58,width:.88,side:-1});
    const scarf=group(body,'roadwarden-scarf'),red=mat('#693f3b');
    shell(scarf,red,[[1.68,.15,.145],[1.74,.18,.155],[1.84,.13,.103]],18);
    plate(scarf,red,[[-.10,1.74],[.10,1.70],[.18,1.40],[.055,1.45]],.021,0,0,.203);
    for(const s of [-1,1]){
      const pauldron=group(body,'roadwarden-pauldron',s*.33,1.61,0);
      for(let i=0;i<3;i++){const armor=orb(pauldron,m.steel,s*.023*i,-.046*i,0,.16-i*.01,.076,.20-i*.011);armor.rotation.z=s*-.19;}
      for(let i=0;i<3;i++)box(body,m.steel,s*.13,1.37-i*.078,.181,.19,.062,.027);
    }
    pouch(body,m,.28,1.01,.07,1.1);
    const sword=group(body,'roadwarden-sword',.36,1.10,.10);sword.rotation.z=.16;
    rod(sword,m.leather,[0,.035,0],[0,.23,0],.027);
    rod(sword,m.metal,[-.13,.03,0],[.13,.03,0],.014);
    plate(sword,m.dark,[[-.047,.01],[.047,.01],[.037,-.77],[0,-.86],[-.036,-.77]],.04,0,0,-.02);
    for(const y of [-.07,-.77])box(sword,m.metal,0,y,0,.098,.031,.053);
    orb(sword,m.metal,0,.25,0,.035,.025,.035);
    const shield=group(body,'watch-shield',-.43,1.025,.07);shield.rotation.y=-.27;
    plate(shield,m.steel,[[-.22,.27],[.20,.27],[.235,-.05],[0,-.43],[-.235,-.05]],.035);
    plate(shield,m.cloth,[[-.18,.23],[.16,.23],[.19,-.035],[0,-.36],[-.19,-.035]],.017,0,0,.04);
    plate(shield,m.metal,[[-.017,.19],[.017,.19],[.017,-.13],[0,-.21],[-.017,-.13]],.01,0,0,.064);
  }
  // Preserve the authored rest pose while giving the shared idle rig its waist pivot.
  for(const child of body.children)child.position.y-=1.25;
  body.position.y=1.25;body.userData.baseY=1.25;
  root.scale.setScalar(.95);root.updateMatrixWorld(true);
  return root;
}
