import * as T from './vendor/three.core.js';
import * as P from './model-primitives.js';

// A native mesh shared by the roster, inventory, and animated Ranger prefab.
// Builders forward to dist/model-primitives.js with the parameters that reproduce
// this kit's old vertices/quaternions/materials (see that file's header table).
const material=(color,metalness=0)=>P.material(color,{metalness,roughness:metalness?.5:.88});
const group=(parent,name,x=0,y=0,z=0)=>P.group(parent,name,x,y,z);
const mesh=(parent,geometry,mat,x=0,y=0,z=0,sx=1,sy=1,sz=1)=>P.mesh(parent,geometry,mat,x,y,z,sx,sy,sz);
const ball=(p,m,x,y,z,sx,sy=sx,sz=sx)=>P.ball(p,m,x,y,z,sx,sy,sz);
const box=(p,m,x,y,z,sx,sy,sz)=>P.box(p,m,x,y,z,sx,sy,sz);
const rod=(p,m,a,b,r=.02,r2=r)=>P.rod(p,m,a,b,r,r2,6);
const path=(p,m,points,r=.01)=>P.path(p,m,points,r,{taper:'falloff',falloff:.7,sides:6});
const plate=(p,m,points,depth=.012)=>P.plate(p,m,points,depth);
function ribbon(p,m,points,width){const positions=[],indices=[];points.forEach(([x,y,z],i)=>{const w=width*(1-.8*(i/(points.length-1))**3);positions.push(x-w,y,z,x+w,y,z);if(i){const a=(i-1)*2;indices.push(a,a+1,a+2,a+1,a+3,a+2);}});const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(positions,3));g.setIndex(indices);g.computeVertexNormals();return mesh(p,g,m);}

function makeBow(parent,m,name){
 const bow=group(parent,name),points=[];
 for(let i=0;i<=24;i++){const t=i/12-1;points.push([.16*Math.sin(Math.abs(t)*Math.PI)-.06*Math.abs(t),t*.79,0]);}
 for(let i=0;i<24;i++)rod(bow,m.wood,points[i],points[i+1],.023-.012*Math.abs(i/12-1));
 rod(bow,m.string,[-.06,-.79,0],[-.06,.79,0],.003);
 rod(bow,m.leather,[0,-.105,0],[0,.105,0],.031);
 for(let i=0;i<7;i++)rod(bow,m.stitch,[-.024,-.084+i*.028,.02],[.024,-.078+i*.028,.02],.0035);
 for(const s of [-1,1])for(let j=0;j<3;j++){const y=s*(.28+j*.11),x=.16*Math.sin(Math.abs(y/.79)*Math.PI)-.06*Math.abs(y/.79);path(bow,m.inlay,[[x-.014,y-s*.06,.022],[x+.017,y,.023],[x-.012,y+s*.055,.02]],.005);}
 return bow;
}
function makeKnife(parent,m,name){
 const g=group(parent,name);
 plate(g,m.steel,[[-.034,-.045],[.032,-.045],[.059,-.30],[.022,-.53],[-.025,-.59],[-.018,-.35]],.014);
 path(g,m.silver,[[0,-.055,.016],[.019,-.28,.016],[-.016,-.56,.016]],.004);
 rod(g,m.ivory,[0,0,0],[0,.155,0],.024,.02);
 for(let i=0;i<5;i++)rod(g,m.inlay,[-.019,.025+i*.025,.016],[.018,.033+i*.025,.016],.003);
 rod(g,m.silver,[-.075,-.02,0],[.065,-.02,0],.012);ball(g,m.silver,0,.17,0,.026,.018,.023);
 return g;
}
function makeCloak(body,m){
 const cloak=group(body,'ranger-grey-cloak'),positions=[],indices=[],cols=14,rows=10;
 for(let j=0;j<=rows;j++)for(let i=0;i<=cols;i++){const u=i/cols,v=j/rows;positions.push((u-.5)*(.62+v*.25),1.72-v*1.10,-.16-v*.22-Math.sin(u*Math.PI)*.07+Math.cos(u*Math.PI*8)*.023*v);}
 for(let j=0;j<rows;j++)for(let i=0;i<cols;i++){const a=j*(cols+1)+i;indices.push(a,a+cols+1,a+1,a+1,a+cols+1,a+cols+2);}
 const geo=new T.BufferGeometry();geo.setAttribute('position',new T.Float32BufferAttribute(positions,3));geo.setIndex(indices);geo.computeVertexNormals();mesh(cloak,geo,m.cloak);
 for(const s of [-1,1]){ball(cloak,m.cloak,s*.205,1.69,-.015,.18,.085,.18);path(cloak,m.cloakEdge,[[s*.33,1.66,-.02],[s*.23,1.72,.08],[s*.13,1.70,.18],[0,1.62,.236]],.016);}
 const leaf=group(body,'ranger-leaf-clasp',0,1.635,.239);leaf.rotation.z=-.35;
 plate(leaf,m.silver,[[0,.065],[.045,.027],[.037,-.025],[0,-.069],[-.043,-.034],[-.038,.019]],.012);
 plate(leaf,m.leaf,[[0,.055],[.032,.02],[.026,-.02],[0,-.053],[-.03,-.026],[-.027,.018]],.014);
 rod(leaf,m.silver,[0,-.06,.016],[0,.05,.016],.0035);
 for(const s of [-1,1])for(let i=0;i<3;i++)rod(leaf,m.silver,[0,-.035+i*.024,.016],[s*(.022-i*.003),-.01+i*.02,.016],.0025);
}
function makeHead(root,m){
 const head=group(root,'head',0,2.01,.025),positions=[],indices=[],segments=14;
 const rings=[[-.205,.057,.060],[-.16,.103,.097],[-.10,.131,.118],[-.035,.145,.133],[.07,.140,.129],[.155,.120,.101],[.213,.055,.05]];
 rings.forEach(([y,w,d])=>{for(let i=0;i<segments;i++){const a=i/segments*Math.PI*2;positions.push(Math.sin(a)*w,y,Math.cos(a)*d);}});
 for(let j=0;j<rings.length-1;j++)for(let i=0;i<segments;i++){const a=j*segments+i,b=j*segments+(i+1)%segments;indices.push(a,b,a+segments,b,b+segments,a+segments);}
 const face=new T.BufferGeometry();face.setAttribute('position',new T.Float32BufferAttribute(positions,3));face.setIndex(indices);face.computeVertexNormals();mesh(head,face,m.skin);
 const nose=plate(head,m.skin,[[-.015,.045],[.015,.045],[.025,-.058],[-.019,-.065]],.028);nose.position.z=.126;
 ball(head,m.skin,0,-.055,.157,.023,.021,.027);
 rod(head,m.lip,[-.040,-.112,.108],[.039,-.112,.108],.0045);
 for(const s of [-1,1]){
  ball(head,m.eyeWhite,s*.062,.018,.123,.032,.014,.012);ball(head,m.iris,s*.060,.018,.134,.010,.011,.006);
  path(head,m.brow,[[s*.030,.050,.132],[s*.057,.057,.132],[s*.092,.044,.113]],.008);
  const ear=group(head,`ranger-pointed-ear-${s}`,s*.135,-.015,0);
  plate(ear,m.skin,[[0,-.062],[s*.062,-.023],[s*.103,.091],[s*.014,.047]],.027);
  const inner=plate(ear,m.skinShade,[[s*.012,-.035],[s*.048,-.010],[s*.079,.062],[s*.021,.030]],.007);inner.position.z=.028;
 }
 const hair=group(head,'ranger-blond-hair');
 mesh(hair,new T.SphereGeometry(.157,16,8,0,Math.PI*2,0,1.18),m.hair,0,.075,-.017,1,1.02,1);
 // A continuous mane beneath the fine locks keeps the back silhouette solid.
 const manePositions=[],maneIndices=[],levels=[[.157,.132,-.152],[-.015,.141,-.174],[-.25,.153,-.286],[-.60,.162,-.354]];
 levels.forEach(([y,w,z],j)=>{for(let i=0;i<=14;i++){const u=(i-7)/7;manePositions.push(u*w,y+(j===3?Math.abs(u)*.06:0),z+u*u*.014-Math.cos(i*Math.PI)*.003);}});
 for(let j=0;j<levels.length-1;j++)for(let i=0;i<14;i++){const a=j*15+i;maneIndices.push(a,a+1,a+15,a+1,a+16,a+15);}
 const mane=new T.BufferGeometry();mane.setAttribute('position',new T.Float32BufferAttribute(manePositions,3));mane.setIndex(maneIndices);mane.computeVertexNormals();mesh(hair,mane,m.hair);
 for(let i=0;i<15;i++){
  const u=(i-7)/7,x=u*.134,zFront=.132*Math.sqrt(1-u*u*.78);
  ribbon(hair,i%3===0?m.hairLight:i%3===1?m.hair:m.hairDark,[[x,.126,zFront],[x*.89,.211-u*u*.04,.04],[x*.83,.227-u*u*.056,-.07],[x*.94,.157,-.147],[x*1.02,-.015,-.168],[x*1.13,-.25,-.28],[x*1.3,-.65+Math.abs(u)*.065,-.35]],.0145);
 }
 for(const s of [-1,1]){
  for(let i=0;i<3;i++)ribbon(hair,i===1?m.hairLight:m.hair,[[s*(.127+i*.008),.114,.075-i*.018],[s*(.144+i*.009),-.075,.035-i*.012],[s*(.153+i*.008),-.29,.055-i*.014],[s*(.169+i*.008),-.51+i*.02,.097-i*.02]],.010);
  const braid=group(hair,`ranger-side-braid-${s}`);
  for(let strand=0;strand<2;strand++){const points=[];for(let i=0;i<=14;i++){const t=i/14,twist=t*Math.PI*10+strand*Math.PI;points.push([s*(.141+Math.sin(twist)*.004),.095-t*.15+Math.cos(twist)*.004,.058-t*.239]);}path(braid,strand?m.hairLight:m.hairDark,points,.0045);}
  ball(braid,m.inlay,s*.14,-.055,-.181,.013,.008,.009);
 }
}

export function createRangerCharacter(){
 const root=new T.Group();root.name='Ranger';root.userData.characterConcept='C02';
 const colors={tunic:'#535b39',panel:'#667048',seam:'#93926b',sleeve:'#8c8666',cloak:'#525c55',cloakEdge:'#71786a',leather:'#654b32',wood:'#765735',stitch:'#aa9263',inlay:'#c4b58b',ivory:'#d2c59f',silver:'#b3bcb0',steel:'#acb7b2',string:'#c4c1a0',leaf:'#41644a',skin:'#c8ad8c',skinShade:'#a58b72',lip:'#926e5b',eyeWhite:'#c9c6b8',iris:'#5c7982',brow:'#70634b',dark:'#252d2a',hair:'#c9b477',hairLight:'#e1cf98',hairDark:'#a18b55',fletching:'#bbaa65'};
 const m=Object.fromEntries(Object.entries(colors).map(([key,color])=>[key,material(color,['silver','steel'].includes(key)?.65:key==='inlay'?.25:0)]));
 for(const key of ['cloak','hair','hairLight','hairDark'])m[key].side=T.DoubleSide;
 const body=group(root,'body');
 for(const s of [-1,1]){
  const leg=group(root,s<0?'legR':'legL',s*.132,.90,0);
  rod(leg,m.dark,[0,0,0],[0,-.43,.015],.093,.072);
  const boot=group(leg,`ranger-boot-${s}`);rod(boot,m.leather,[0,-.42,.012],[0,-.78,.016],.080,.066);box(boot,m.leather,0,-.816,.07,.155,.13,.265);box(boot,m.dark,0,-.878,.075,.16,.028,.27);
  rod(boot,m.stitch,[s*.055,-.42,.061],[s*.048,-.76,.061],.006);
 }
 ball(body,m.tunic,0,1.435,0,.262,.335,.18);
 rod(body,m.sleeve,[0,1.68,0],[0,1.805,0],.09);rod(body,m.skin,[0,1.78,0],[0,1.91,0],.075);
 for(const s of [-1,1]){
  const panel=group(body,`ranger-tunic-panel-${s}`,0,0,.16);
  plate(panel,m.panel,[[s*.016,1.64],[s*.18,1.59],[s*.224,1.29],[s*.19,1.16],[s*.27,.77],[s*.095,.71],[s*.025,1.15]],.019);
  path(panel,m.seam,[[s*.016,1.64,.023],[s*.11,1.40,.025],[s*.06,1.15,.024],[s*.10,.76,.022]],.006);
 }
 box(body,m.leather,0,1.16,.014,.48,.07,.38);box(body,m.inlay,.014,1.16,.218,.072,.072,.017);box(body,m.leather,.014,1.16,.229,.044,.043,.012);
 const strap=box(body,m.leather,0,1.425,.214,.051,.55,.022);strap.rotation.z=.62;
 makeCloak(body,m);makeHead(root,m);
 const arms=[];
 for(const s of [-1,1]){
  const arm=group(body,s<0?'armR':'armL',s*.28,1.645,0);arms.push(arm);
  rod(arm,m.sleeve,[0,0,0],[s*.09,-.235,.04],.086,.070);ball(arm,m.tunic,s*.008,-.01,0,.12,.10,.12);
  rod(arm,m.sleeve,[s*.09,-.235,.04],[s*.115,-.435,.14],.070,.053);
  const bracer=group(arm,`ranger-engraved-bracer-${s}`);rod(bracer,m.leather,[s*.091,-.27,.058],[s*.112,-.415,.13],.077,.061);
  path(bracer,m.inlay,[[s*.091,-.274,.13],[s*.12,-.333,.15],[s*.109,-.409,.19]],.004);
  for(let i=0;i<3;i++)path(bracer,m.stitch,[[s*.084,-.30-i*.028,.15+i*.013],[s*.125,-.31-i*.028,.155+i*.013],[s*.15,-.33-i*.028,.14+i*.013]],.003);
  ball(arm,m.skin,s*.12,-.477,.153,.052,.070,.047);
 }
 const bow=makeBow(arms[0],m,'weapon');bow.position.set(-.12,-.482,.153);bow.rotation.set(0,-.22,.10);
 const stowed=makeBow(body,m,'ranger-stowed-bow');stowed.position.set(.12,1.34,-.36);stowed.rotation.z=-.48;stowed.visible=false;
 const right=makeKnife(arms[0],m,'ranger-knife-right');right.position.set(-.12,-.475,.158);right.visible=false;
 const left=makeKnife(arms[1],m,'ranger-knife-left');left.position.set(.12,-.475,.158);left.visible=false;
 const quiver=group(body,'ranger-quiver',.22,1.55,-.33);quiver.rotation.z=-.21;
 mesh(quiver,new T.CylinderGeometry(.103,.076,.72,12),m.leather,0,-.11,0);
 for(const y of [-.43,.22])mesh(quiver,new T.CylinderGeometry(.108,.106,.032,12),m.inlay,0,y,0);
 for(let i=0;i<7;i++){
  const a=i/7*Math.PI*2,x=Math.sin(a)*.054,z=Math.cos(a)*.054,top=.60+i%3*.035;
  rod(quiver,m.wood,[x,-.08,z],[x,top,z],.007);
  for(let j=0;j<2;j++){const feather=plate(quiver,m.fletching,[[0,0],[.030,-.038],[.023,-.14],[0,-.11]],.002);feather.position.set(x,top-.014,z);feather.rotation.y=j*Math.PI/2;}
 }
 const sheathed=group(body,'ranger-sheathed-knives');
 for(const s of [-1,1]){const mount=group(sheathed,`ranger-knife-mount-${s}`,s*.10,1.91,-.34);mount.rotation.z=s*.12;makeKnife(mount,m,`ranger-sheathed-knife-${s}`);const sheath=plate(mount,m.leather,[[-.045,-.055],[.048,-.055],[.065,-.32],[.018,-.57],[-.03,-.60],[-.03,-.30]],.04);sheath.position.z=-.012;}
 return root;
}

// Named groups survive gameplay mesh batching and each actor's prefab clone.
export function updateRangerWeapons(rig){
 const gear=rig.rangerWeapons;if(!gear)return;
 gear.bow.rotation.set(0,-.22,.10);
 const blades=rig.attack>0&&rig.attackKind==='paired';
 gear.bow.visible=!blades;gear.stowed.visible=blades;
 gear.right.visible=gear.left.visible=blades;gear.sheathed.visible=!blades;
}
