import * as T from './vendor/three.core.js';
import * as P from './model-primitives.js';

// The same elven duelist is used by the studies, portraits, and playable rig.
const {group,mesh,plate}=P;
const ball=(p,m,x,y,z,sx,sy=sx,sz=sx)=>P.ball(p,m,x,y,z,sx,sy,sz,{widthSegments:10,heightSegments:7});
function rod(p,m,a,b,r=.01,r2=r){return P.rod(p,m,a,b,r,r2,6);}
function path(p,m,points,r=.008){return P.path(p,m,points,r,{taper:'constant',sides:6});}
function edgedPlate(p,m,points,depth=.016){const face=plate(p,m.armor,points,depth);path(p,m.gold,[...points,points[0]].map(([x,y])=>[x,y,depth+.003]),.009);return face;}
function jewel(p,m,x,y,z,size=.026){ball(p,m.gold,x,y,z,size*1.5,size*1.7,size*.65);return mesh(p,new T.OctahedronGeometry(1),m.gem,x,y,z+size*.5,size,size*1.25,size*.6);}
function ribbon(p,m,points,widths){const positions=[],indices=[];points.forEach(([x,y,z],i)=>{const w=widths[i];positions.push(x-w,y,z,x,y,z+.012,x+w,y,z);if(i)for(let col=0;col<2;col++){const a=(i-1)*3+col;indices.push(a,a+1,a+3,a+1,a+4,a+3);}});const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(positions,3));g.setIndex(indices);g.computeVertexNormals();return mesh(p,g,m);}

function makeHead(body,m){
 const head=group(body,'head',0,2.015,.018),positions=[],indices=[],segments=14;
 const rings=[[-.204,.050,.055],[-.161,.089,.086],[-.096,.123,.113],[-.02,.135,.129],[.08,.131,.123],[.165,.106,.09],[.212,.041,.044]];
 for(const [y,w,d] of rings)for(let i=0;i<segments;i++){const a=i/segments*Math.PI*2;positions.push(Math.sin(a)*w,y,Math.cos(a)*d);}
 for(let j=0;j<rings.length-1;j++)for(let i=0;i<segments;i++){const a=j*segments+i,b=j*segments+(i+1)%segments;indices.push(a,b,a+segments,b,b+segments,a+segments);}
 const geo=new T.BufferGeometry();geo.setAttribute('position',new T.Float32BufferAttribute(positions,3));geo.setIndex(indices);geo.computeVertexNormals();mesh(head,geo,m.skin);
 const nose=plate(head,m.skin,[[-.012,.033],[.013,.033],[.022,-.063],[-.018,-.065]],.032);nose.position.z=.123;
 ball(head,m.skin,0,-.059,.157,.019,.017,.020);
 path(head,m.lip,[[-.036,-.12,.102],[0,-.124,.115],[.036,-.12,.102]],.004);
 for(const s of [-1,1]){
  ball(head,m.eyeShade,s*.058,.012,.122,.038,.019,.008);
  ball(head,m.eyeWhite,s*.058,.014,.131,.026,.010,.006);
  ball(head,m.iris,s*.058,.014,.138,.009,.010,.004);
  path(head,m.hairDark,[[s*.025,.047,.129],[s*.059,.055,.132],[s*.096,.043,.110]],.007);
  const ear=group(head,`nightblade-pointed-ear-${s}`,s*.127,-.005,-.009);
  plate(ear,m.skin,[[0,-.059],[s*.059,-.017],[s*.114,.132],[s*.017,.061]],.025);
  const inside=plate(ear,m.skinShade,[[s*.013,-.028],[s*.048,.003],[s*.085,.089],[s*.025,.034]],.005);inside.position.z=.026;
  path(head,m.mark,[[s*.086,-.015,.116],[s*.076,-.051,.120],[s*.101,-.071,.095],[s*.071,-.099,.105]],.0035);
 }
 const hair=group(head,'nightblade-swept-hair');
 mesh(hair,new T.SphereGeometry(.148,14,8,0,Math.PI*2,0,1.3),m.hair,0,.080,-.021,1,1.02,1);
 // Broad overlapping locks give the mane volume from above and behind.
 for(let i=0;i<15;i++){
  const u=(i-7)/7,x=u*.125,z=.127*Math.sqrt(1-u*u*.9);
  ribbon(hair,i%4===0?m.hairLight:i%3===0?m.hairDark:m.hair,[[x,.126,z],[x*.92,.216-u*u*.035,.032],[x*.95,.223-u*u*.06,-.080],[x*1.1,.084,-.169],[x*1.48,-.19,-.22],[x*1.7-.035,-.43,-.295],[x*1.4-.15,-.77+Math.abs(u)*.1,-.39]], [.017,.018,.019,.024,.031,.032,.001]);
 }
 for(const s of [-1,1]){
  for(let i=0;i<3;i++)ribbon(hair,i===1?m.hairLight:m.hair,[[s*(.123+i*.009),.116,.042-i*.025],[s*(.149+i*.012),-.13,-.041-i*.021],[s*(.19+i*.013),-.38,-.064-i*.018],[s*(.24+i*.025),-.64-i*.035,-.10]], [.016,.023,.023,.001]);
  const braid=group(head,`nightblade-temple-braid-${s}`);
  path(braid,m.hairLight,[[s*.12,.066,.084],[s*.145,-.16,.073],[s*.16,-.39,.14],[s*.194,-.60,.166]],.012);
  for(let j=0;j<7;j++)ball(braid,j%3===0?m.gold:m.hair,s*(.145+j*.007),-.17-j*.058,.078+j*.013,.016,.024,.013);
  jewel(braid,m,s*.195,-.60,.169,.014);
 }
 const crown=group(head,'nightblade-gold-circlet');
 for(const s of [-1,1]){
  path(crown,m.gold,[[0,.075,.15],[s*.071,.113,.137],[s*.135,.127,.086],[s*.161,.184,.013]],.010);
  path(crown,m.goldLight,[[0,.073,.157],[s*.05,.138,.128],[s*.113,.159,.094]],.0045);
 }
 jewel(crown,m,0,.085,.159,.025);
}

function makeCoat(body,m){
 const coat=group(body,'nightblade-split-scale-coat');
 // Separate pointed gores leave the legs readable instead of making a solid robe.
 for(let panel=0;panel<7;panel++){
  const a=.63+panel*(Math.PI*2-1.26)/6,positions=[],indices=[],rows=7,cols=4;
  const point=(u,v)=>{const angle=a+(u-.5)*.64,r=.242+v*.19;return [Math.sin(angle)*r,1.145-v*(.89+(panel%2)*.09)+(v>.85?Math.abs(u-.5)*.28:0),Math.cos(angle)*r*.77-v*.075];};
  for(let j=0;j<=rows;j++)for(let i=0;i<=cols;i++)positions.push(...point(i/cols,j/rows));
  for(let j=0;j<rows;j++)for(let i=0;i<cols;i++){const n=j*(cols+1)+i;indices.push(n,n+1,n+cols+1,n+1,n+cols+2,n+cols+1);}
  const geo=new T.BufferGeometry();geo.setAttribute('position',new T.Float32BufferAttribute(positions,3));geo.setIndex(indices);geo.computeVertexNormals();mesh(coat,geo,panel%2?m.scaleDark:m.scale);
  for(const side of [0,1])path(coat,m.gold,Array.from({length:8},(_,j)=>point(side,j/7)),.006);
  // Small embossed chevrons read as overlapping scales without individual plates.
  for(let row=0;row<6;row++)for(let col=0;col<3;col++){
   const u=(col+.5)/3,v=.1+row*.13,points=[[u-.12,v],[u,v+.075],[u+.12,v]].map(([x,y])=>{const p=point(x,y);p[0]*=1.018;p[2]*=1.018;return p;});
   path(coat,row%2?m.scaleEdge:m.scaleDark,points,.004);
  }
 }
 const tabard=group(body,'nightblade-embroidered-tabard');
 const points=[[0,1.12,.215],[0,.90,.24],[.02,.63,.275],[-.035,.35,.29],[-.13,.18,.285]],widths=[.13,.145,.13,.095,.003];
 ribbon(tabard,m.silk,points,widths);
 for(const s of [-1,1])path(tabard,m.gold,points.map(([x,y,z],i)=>[x+s*widths[i],y,z+.012]),.007);
 path(tabard,m.goldLight,[[0,1.06,.245],[.075,.88,.258],[0,.69,.292],[-.075,.53,.302],[.015,.39,.311],[-.095,.22,.31]],.005);
 for(let i=0;i<3;i++){
  const y=1.02-i*.22;path(tabard,m.scaleEdge,[[-.063,y,.267+i*.017],[0,y-.07,.277+i*.017],[.063,y,.267+i*.017]],.006);
 }
 for(const s of [-1,1]){
  const hip=group(body,`nightblade-gold-tassets-${s}`,s*.245,1.09,.035);hip.rotation.y=s*.7;
  for(let j=0;j<3;j++){
   const tier=group(hip,`tasset-tier-${j}`,s*j*.012,-j*.10,j*.002);
   const points=[[-.079,.044],[.073,.052],[.102,-.063],[.066,-.09],[-.10,-.062]];
   plate(tier,m.goldShade,points,.018);path(tier,m.gold,points.slice(1).map(([x,y])=>[x,y,.024]),.007);
  }
 }
}

function makeBlade(parent,m,name,s){
 const blade=group(parent,name);blade.rotation.set(-.12,0,-s*.70);
 rod(blade,m.leather,[0,-.045,0],[0,.14,0],.027,.024);
 for(let i=0;i<6;i++)rod(blade,m.goldShade,[-.023,-.018+i*.028,.018],[.023,-.010+i*.028,.018],.004);
 ball(blade,m.gold,0,.159,0,.038,.032,.030);jewel(blade,m,0,.16,.024,.015);
 path(blade,m.gold,[[-.096,-.052,0],[-.047,-.073,0],[0,-.052,0],[.054,-.056,0],[.091,-.025,0]],.014);
 const outline=[[-.028,-.083],[.033,-.083],[.065,-.39],[.056,-.65],[-.040,-1.01],[-.018,-.65],[-.036,-.36]];
 plate(blade,m.steel,outline,.018);
 path(blade,m.edge,[[.033,-.083,.021],[.065,-.39,.021],[.056,-.65,.021],[-.040,-1.01,.021]],.005);
 path(blade,m.steelShade,[[0,-.096,.022],[.022,-.38,.022],[.018,-.66,.022],[-.032,-.96,.022]],.004);
 path(blade,m.goldShade,[[0,-.11,.025],[.008,-.23,.025],[.024,-.28,.025]],.0035);
 return blade;
}

function makeArm(body,m,s){
 const arm=group(body,s<0?'armL':'armR',s*.295,1.65,0);
 rod(arm,m.silk,[0,0,0],[s*.105,-.24,.012],.094,.073);
 rod(arm,m.skin,[s*.105,-.24,.012],[s*.18,-.50,.105],.067,.049);
 const shoulder=group(arm,`nightblade-swept-pauldron-${s}`,s*.026,.005,0);
 ball(shoulder,m.armor,0,0,-.015,.18,.122,.177);
 const points=[[-s*.12,.078],[s*.045,.12],[s*.155,.033],[s*.25,.125],[s*.208,-.075],[s*.124,-.146],[-s*.066,-.105]];
 const front=group(shoulder,'pauldron-front',0,0,.105);edgedPlate(front,m,points,.022);
 const back=group(shoulder,'pauldron-back',0,0,-.15);back.rotation.y=Math.PI;edgedPlate(back,m,points.map(([x,y])=>[-x,y]),.016);
 path(front,m.goldLight,[[s*-.087,.022,.027],[s*.018,.069,.028],[s*.097,.013,.028],[s*.172,-.023,.028],[s*.222,.067,.028]],.007);
 const scroll=[];for(let i=0;i<16;i++){const a=i/15*Math.PI*2.4,r=.057*(1-i/19);scroll.push([s*(.022+Math.cos(a)*r),-.029+Math.sin(a)*r,.032]);}path(front,m.gold,scroll,.006);
 jewel(front,m,s*-.046,-.070,.035,.017);
 const bracer=group(arm,`nightblade-laced-bracer-${s}`,s*.145,-.365,.068);bracer.rotation.x=-.34;
 rod(bracer,m.leather,[0,-.115,0],[0,.11,0],.061,.077);
 const guard=group(bracer,'bracer-leaf',0,0,.06);edgedPlate(guard,m,[[0,.134],[.054,.075],[.041,-.093],[0,-.13],[-.044,-.09],[-.055,.075]],.012);
 for(let i=0;i<5;i++){
  const y=.074-i*.036;
  path(guard,m.scaleEdge,[[-.039,y,.023],[.035,y-.038,.023]],.004);
  path(guard,m.scaleEdge,[[.039,y,.024],[-.035,y-.038,.024]],.004);
  ball(guard,m.gem,0,y-.019,.027,.008);
 }
 const streamer=group(arm,`nightblade-sleeve-streamer-${s}`);
 ribbon(streamer,m.silk,[[s*.11,-.13,-.063],[s*.22,-.22,-.10],[s*.40,-.12,-.15],[s*.52,-.22,-.23],[s*.45,-.35,-.28]], [.053,.075,.064,.043,.001]);
 path(streamer,m.goldShade,[[s*.14,-.09,-.061],[s*.25,-.15,-.099],[s*.43,-.067,-.149],[s*.55,-.18,-.229],[s*.45,-.35,-.279]],.0045);
 ball(arm,m.skin,s*.184,-.533,.112,.053,.067,.046);
 for(let i=0;i<3;i++)ball(arm,m.skinShade,s*.184-.027+i*.025,-.557,.149,.012,.023,.010);
 const blade=makeBlade(arm,m,s>0?'weapon':'offhand',s);blade.position.set(s*.184,-.55,.13+(s<0?.045:0));
 return arm;
}

export function createNightbladeCharacter(){
 const root=new T.Group();root.name='Nightblade';root.userData.characterConcept='C04';
 const colors={armor:'#235b52',scale:'#164b3f',scaleDark:'#10392f',scaleEdge:'#377669',silk:'#216d70',gold:'#b2914d',goldLight:'#d7bc73',goldShade:'#796032',leather:'#46392a',dark:'#232a23',skin:'#c6a378',skinShade:'#9c7857',lip:'#755142',mark:'#875d43',hair:'#3c4030',hairLight:'#74704a',hairDark:'#292f25',eyeWhite:'#cdc3b4',eyeShade:'#523c42',iris:'#c09bde',gem:'#52c6ad',steel:'#a9b6ad',steelShade:'#667e77',edge:'#d4d8c1',burgundy:'#633d3b'};
 const m=Object.fromEntries(Object.entries(colors).map(([key,color])=>[key,new T.MeshStandardMaterial({color,flatShading:true,metalness:['gold','goldLight','goldShade','steel','steelShade','edge'].includes(key)?.65:.05,roughness:['gold','goldLight','steel','edge'].includes(key)?.44:.84})]));
 for(const key of ['silk','scale','scaleDark','hair','hairDark','hairLight'])m[key].side=T.DoubleSide;
 m.gem.emissive.set('#1c6354');m.gem.emissiveIntensity=.3;
 const body=group(root,'body');
 ball(body,m.scale,0,1.435,0,.25,.30,.168);
 rod(body,m.silk,[0,1.66,0],[0,1.80,0],.096,.085);rod(body,m.skin,[0,1.78,0],[0,1.895,0],.073);
 for(let i=0;i<4;i++){
  const wrap=mesh(body,new T.TorusGeometry(.091-i*.002,.010,5,14),m.scaleEdge,0,1.71+i*.027,0);wrap.rotation.x=Math.PI/2;
 }
 const chest=group(body,'nightblade-gilded-cuirass',0,0,.15);
 edgedPlate(chest,m,[[-.205,1.65],[0,1.72],[.205,1.65],[.224,1.40],[0,1.17],[-.224,1.40]],.018);
 for(const s of [-1,1]){
  const inset=plate(chest,m.burgundy,[[s*.168,1.64],[s*.132,1.67],[0,1.47],[s*.023,1.44]],.004);inset.position.z=.022;
  path(chest,m.goldLight,[[s*.168,1.66,.029],[0,1.46,.031],[s*.145,1.31,.029]],.007);
  path(chest,m.gold,[[s*.184,1.45,.028],[0,1.23,.031]],.007);
  for(let j=0;j<3;j++)path(chest,m.scaleEdge,[[s*.18,1.55-j*.058,.025],[s*.095,1.48-j*.058,.026],[s*.065,1.49-j*.058,.027]],.005);
  jewel(body,m,s*.155,1.68,.162,.020);
 }
 jewel(body,m,0,1.66,.20,.035);
 makeCoat(body,m);
 mesh(body,new T.CylinderGeometry(.253,.26,.087,14),m.leather,0,1.16,0,1,1,.8);
 const belt=group(body,'nightblade-jeweled-belt',0,1.16,.229);
 ball(belt,m.goldShade,0,0,0,.111,.103,.034);
 const rim=mesh(belt,new T.TorusGeometry(.077,.014,5,18),m.gold,0,0,.036);rim.scale.y=1.1;
 jewel(belt,m,0,0,.052,.039);
 for(const s of [-1,1])jewel(belt,m,s*.185,0,-.019,.027);
 const chain=[];for(let i=0;i<=18;i++){const u=i/18;chain.push([-.10+u*.35,1.11-Math.sin(u*Math.PI)*.17,.249]);}path(body,m.gold,chain,.0055);
 const knives=group(body,'nightblade-throwing-knives',-.23,1.20,-.17);knives.rotation.y=-.5;
 for(let i=0;i<3;i++){rod(knives,m.leather,[i*.042,-.18,0],[i*.042,.04,0],.015);rod(knives,m.gold,[i*.042,.02,0],[i*.042,.085,0],.013);}
 for(const s of [-1,1]){
  const leg=group(root,s<0?'legL':'legR',s*.15,.90,0);
  rod(leg,m.dark,[0,.12,0],[s*.03,-.35,.018],.089,.071);
  rod(leg,m.leather,[s*.03,-.34,.018],[s*.055,-.76,.028],.077,.062);
  const greave=group(leg,`nightblade-gold-greave-${s}`,s*.048,-.56,.080);
  edgedPlate(greave,m,[[0,.234],[.068,.164],[.068,-.155],[.017,-.224],[-.063,-.178],[-.075,.16]],.022);
  path(greave,m.goldLight,[[0,.18,.027],[-.015,.027,.028],[.028,-.17,.027]],.006);
  jewel(greave,m,0,.133,.028,.019);
  const boot=group(leg,`nightblade-pointed-boot-${s}`,s*.055,-.808,.092);boot.rotation.y=s*.12;
  ball(boot,m.leather,0,0,.025,.077,.078,.145);
  const toe=mesh(boot,new T.ConeGeometry(.075,.22,5),m.leather,0,-.010,.195,1,1,.65);toe.rotation.x=Math.PI/2;
  path(boot,m.goldShade,[[s*-.04,.032,.09],[0,.028,.18],[0,-.01,.303]],.006);
  makeArm(body,m,s);
 }
 makeHead(body,m);
 return root;
}
