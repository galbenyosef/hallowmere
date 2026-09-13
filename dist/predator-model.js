import * as T from 'three';

export const PREDATOR_POSES = Object.freeze(['stalk', 'blades', 'aim']);
export const PREDATOR_APPEARANCES = Object.freeze(['masked', 'unmasked']);
const UP = new T.Vector3(0, 1, 0);

function add(p, geometry, material, xyz = [0, 0, 0], scale = [1, 1, 1]) {
  const object = new T.Mesh(geometry, material);
  object.position.set(...xyz); object.scale.set(...scale);
  object.castShadow = true; object.receiveShadow = true; p.add(object); return object;
}
function group(p, name, xyz = [0, 0, 0]) {
  const object = new T.Group(); object.name = name; object.position.set(...xyz); p.add(object); return object;
}
function box(p, m, x, y, z, sx, sy, sz) {return add(p, new T.BoxGeometry(sx, sy, sz), m, [x, y, z]);}
function ball(p, m, x, y, z, sx, sy = sx, sz = sx, segments = 12) {return add(p, new T.SphereGeometry(1, segments, 8), m, [x, y, z], [sx, sy, sz]);}
function rod(p, m, a, b, radius, tip = radius, sides = 8) {
  const start = new T.Vector3(...a), end = new T.Vector3(...b), direction = end.clone().sub(start);
  const object = add(p, new T.CylinderGeometry(tip, radius, direction.length(), sides), m);
  object.position.copy(start.add(end).multiplyScalar(.5)); object.quaternion.setFromUnitVectors(UP, direction.normalize()); return object;
}
function path(p, m, points, radius, tip = radius) {
  for (let i = 1; i < points.length; i++) rod(p, m, points[i - 1], points[i], T.MathUtils.lerp(radius, tip, (i - 1) / (points.length - 1)), T.MathUtils.lerp(radius, tip, i / (points.length - 1)));
}
function shapeFrom(points) {
  const shape = new T.Shape(); points.forEach(([x, y], i) => i ? shape.lineTo(x, y) : shape.moveTo(x, y)); shape.closePath(); return shape;
}
function plate(p, m, points, depth = .025, xyz = [0, 0, 0], bevel = .006) {
  return add(p, new T.ExtrudeGeometry(shapeFrom(points), {depth, bevelEnabled: bevel > 0, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 1, curveSegments: 1}), m, xyz);
}
function skinNetTexture() {
  if (typeof document === 'undefined') return null;
  const canvas = document.createElement('canvas'); canvas.width = canvas.height = 128;
  const context = canvas.getContext('2d'); if (!context) return null;
  context.fillStyle = '#8f8160'; context.fillRect(0, 0, 128, 128);
  for (let i = 0; i < 180; i++) {
    context.fillStyle = i % 2 ? '#776e53' : '#a99a76';
    context.fillRect((i * 71) % 128, (i * 43 + Math.floor(i / 13) * 11) % 128, 2 + i % 3, 2);
  }
  context.strokeStyle = '#353a31'; context.lineWidth = 2.1;
  for (let offset = -128; offset <= 256; offset += 32) {
    context.beginPath(); context.moveTo(offset, 0); context.lineTo(offset + 128, 128); context.stroke();
    context.beginPath(); context.moveTo(offset, 0); context.lineTo(offset - 128, 128); context.stroke();
  }
  const texture = new T.CanvasTexture(canvas); texture.wrapS = texture.wrapT = T.RepeatWrapping;
  texture.repeat.set(3, 3); texture.colorSpace = T.SRGBColorSpace; return texture;
}

function makeTendrils(head, m) {
  const tendrils = group(head, 'banded-tendrils');
  for (let i = 0; i < 22; i++) {
    // Keep the face clear; the locks sweep from the temples around the back.
    const angle = .73 + i / 21 * (Math.PI * 2 - 1.46);
    const sx = Math.sin(angle), sz = Math.cos(angle), length = .74 + (i % 4) * .066;
    const points = [
      [sx * .216, .16 - (i % 3) * .032, sz * .164 - .028],
      [sx * .302, -.012, sz * .232 - .055],
      [sx * .338, -.29, sz * .282 - .078],
      [sx * (.355 + i % 2 * .025), -.53, sz * .302 - .069],
      [sx * .315, -length, sz * .326 - .024]
    ];
    const lock = group(tendrils, `tendril-${i}`);
    path(lock, i % 3 ? m.tendril : m.tendrilLight, points, .032, .009);
    for (const [segment, fraction] of [[1, .28 + (i % 3) * .19], [2, .42 + (i % 2) * .18]]) {
      const a = new T.Vector3(...points[segment]), b = new T.Vector3(...points[segment + 1]);
      const center = a.clone().lerp(b, fraction), direction = b.sub(a).normalize();
      const ring = add(lock, new T.CylinderGeometry(.032, .032, .041, 9), i % 3 ? m.bronze : m.copper, center.toArray());
      ring.quaternion.setFromUnitVectors(UP, direction);
      const edge = add(lock, new T.TorusGeometry(.0325, .003, 4, 10), m.edge, center.clone().addScaledVector(direction, .015).toArray());
      edge.quaternion.setFromUnitVectors(new T.Vector3(0, 0, 1), direction);
    }
  }
  return tendrils;
}

function makeMask(head, m) {
  const mask = group(head, 'bio-mask');
  const shape = shapeFrom([[-.20,.30],[-.136,.375],[0,.404],[.136,.375],[.20,.30],[.235,.181],[.219,.06],[.168,-.087],[.104,-.191],[0,-.229],[-.104,-.191],[-.168,-.087],[-.219,.06],[-.235,.181]]);
  for (const side of [-1, 1]) {
    const eye = new T.Path();
    [[side*.028,.060],[side*.087,.087],[side*.183,.112],[side*.156,.051],[side*.065,.027]].forEach(([x,y],i)=>i?eye.lineTo(x,y):eye.moveTo(x,y));
    eye.closePath(); shape.holes.push(eye);
  }
  const geometry = new T.ExtrudeGeometry(shape, {depth:.04,bevelEnabled:true,bevelSize:.009,bevelThickness:.008,bevelSegments:1,curveSegments:1});
  const positions = geometry.attributes.position;
  for (let i=0;i<positions.count;i++) {
    const x=positions.getX(i),y=positions.getY(i);
    positions.setZ(i,positions.getZ(i)-x*x*1.0+(y>.12?(y-.12)*.04:0));
  }
  positions.needsUpdate=true;geometry.computeVertexNormals();
  add(mask,geometry,m.armor,[0,0,.219]);
  for (const side of [-1,1]) {
    ball(mask,m.black,side*.101,.066,.221,.083,.035,.010,10);
    path(mask,m.edge,[[side*.028,.108,.264],[side*.087,.139,.259],[side*.189,.163,.236]],.008,.005);
    path(mask,m.bronze,[[side*.184,.033,.231],[side*.150,-.033,.245],[side*.058,-.099,.281]],.012,.007);
    plate(mask,m.armorDark,[[side*.059,-.068],[side*.169,-.045],[side*.122,-.154],[side*.061,-.191]],.018,[0,0,.247]);
    for(let i=0;i<3;i++) rod(mask,m.edge,[side*(.079+i*.019),-.099-i*.012,.276],[side*(.113+i*.016),-.069-i*.012,.269],.003,.002);
  }
  // Broad forehead, central ridge, and a narrow breathing grille.
  plate(mask,m.bronze,[[-.014,.365],[.014,.365],[.029,.152],[0,.120],[-.029,.152]],.018,[0,0,.268]);
  plate(mask,m.polished,[[-.027,.009],[.027,.009],[.059,-.189],[0,-.219],[-.059,-.189]],.04,[0,0,.274]);
  plate(mask,m.black,[[-.016,-.031],[.016,-.031],[.036,-.176],[-.036,-.176]],.006,[0,0,.320],.002);
  for(let i=-2;i<=2;i++)rod(mask,m.edge,[i*.009,-.042,.330],[i*.014,-.167,.330],.0023,.0023,4);
  for(let i=0;i<5;i++) {
    const y=.185+i*.035;
    path(mask,m.edge,[[-.055,y,.271],[-.044,y+.008,.283],[.044,y+.008,.283],[.055,y,.271]],.003,.002);
  }
  const targeting = group(mask,'targeting-lights',[.208,.118,.194]);
  for(const [x,y] of [[0,.014],[-.012,-.009],[.012,-.009]]) ball(targeting,m.red,x,y,0,.0045,.0045,.0045,6);
  return mask;
}

function makeFace(head,m) {
  const face=group(head,'unmasked-face');
  ball(face,m.skin,0,.132,-.005,.221,.259,.19,14);
  ball(face,m.skinDark,0,-.078,.033,.174,.171,.146,12);
  ball(face,m.mouth,0,-.092,.181,.093,.116,.019,12);
  for(const side of [-1,1]) {
    path(face,m.flesh,[[side*.058,.014,.202],[side*.102,-.024,.209],[side*.105,-.145,.208],[side*.067,-.194,.21]],.021,.015);
    const socket=ball(face,m.black,side*.091,.064,.161,.056,.018,.015,10);socket.rotation.z=side*.19;
    ball(face,m.amber,side*.093,.063,.179,.011,.006,.006,8);
    ball(face,m.black,side*.093,.063,.186,.0025,.0055,.002,6);
    path(face,m.skinDark,[[side*.028,.107,.169],[side*.089,.113,.169],[side*.175,.157,.115]],.016,.022);
    ball(face,m.skin,side*.158,-.019,.108,.070,.066,.092,8);
    // Four fleshy mandibles end in inward-curving ivory tusks.
    for(const lower of [false,true]) {
      const mandible=group(face,`${lower?'lower':'upper'}-mandible-${side}`);
      const points=lower?[[side*.102,-.170,.158],[side*.186,-.227,.224],[side*.204,-.156,.294]]:[[side*.136,-.001,.144],[side*.218,-.052,.214],[side*.186,-.102,.297]];
      path(mandible,m.skin,points,.038,.023);
      const tip=lower?[side*.132,-.073,.335]:[side*.112,-.122,.333];
      rod(mandible,m.bone,points[2],tip,.023,.001,7);
      path(mandible,m.skinDark,points.map(([x,y,z])=>[x,y+.014,z+.014]),.006,.004);
    }
    for(let i=0;i<3;i++) {
      const x=side*(.014+i*.023);
      rod(face,m.bone,[x,.012,.213],[x,-.016-(i%2)*.009,.225],.011,.001,6);
      rod(face,m.bone,[x,-.184,.218],[x,-.152+(i%2)*.008,.225],.010,.001,6);
    }
  }
  // Low faceted ridges and mottling keep the exposed head organic.
  const foreheadZ=(x,y)=>-.005+.19*Math.sqrt(Math.max(0,1-(x/.221)**2-((y-.132)/.259)**2));
  for(let i=-3;i<=3;i++) {
    const points=[[i*.046,.142],[i*.039,.256],[i*.025,.343]].map(([x,y])=>[x,y,foreheadZ(x,y)+.004]);
    path(face,m.skinDark,points,.007,.003);
  }
  for(let i=0;i<58;i++) {
    const angle=(i*2.39996)%(Math.PI*2), y=.159+(i%9)*.022;
    const x=Math.sin(angle)*(.185-(y-.15)*.40),z=foreheadZ(x,y);
    ball(face,m.skinDark,x,y,z,.006+(i%3)*.0015,.004,.006,6);
  }
  return face;
}

function makeHand(arm,m,side) {
  const hand=group(arm,side<0?'right-clawed-hand':'left-clawed-hand',[side*.12,-.684,.075]);
  ball(hand,m.skinDark,0,-.02,0,.087,.11,.065,10);
  for(let i=0;i<4;i++) {
    const x=(i-1.5)*.04;
    path(hand,m.skin,[[x,-.070,0],[x*1.1,-.138,.012],[x*1.12,-.168,.046]],.02,.013);
    rod(hand,m.bone,[x*1.12,-.168,.046],[x*1.05,-.190,.068],.013,.001,6);
  }
  path(hand,m.skinDark,[[side*.071,.008,.022],[side*.132,-.047,.048],[side*.104,-.105,.077]],.027,.016);
  rod(hand,m.bone,[side*.104,-.105,.077],[side*.083,-.119,.096],.016,.001,6);
  plate(hand,m.armorDark,[[-.071,.064],[.071,.064],[.054,-.078],[-.054,-.078]],.021,[0,0,-.066]);
  return hand;
}

export function createPredatorCharacter() {
  const root=new T.Group();root.name='Predator hunter study';
  const mat=(color,metalness=0,roughness=.86)=>new T.MeshStandardMaterial({color,metalness,roughness,flatShading:true});
  const m={
    skin:mat('#8a896c'),skinDark:mat('#535747'),net:mat('#d4c5a2'),armor:mat('#697875',.57,.52),armorDark:mat('#354449',.64,.48),
    polished:mat('#8b9890',.67,.41),edge:mat('#b4b7a0',.65,.4),bronze:mat('#978265',.61,.5),copper:mat('#895b43',.55,.52),
    leather:mat('#453b2f'),tendril:mat('#292e29'),tendrilLight:mat('#3c4033'),black:mat('#111d22'),bone:mat('#c5b894'),
    flesh:mat('#744c40'),mouth:new T.MeshBasicMaterial({color:'#241b19'}),amber:new T.MeshBasicMaterial({color:'#d5a345'}),red:new T.MeshBasicMaterial({color:'#ed7251'})
  };
  m.net.map=skinNetTexture();
  const body=group(root,'body');
  ball(body,m.net,0,1.76,0,.40,.43,.219,16);
  ball(body,m.net,0,1.42,.014,.28,.30,.188,12);
  rod(body,m.skinDark,[0,2.08,0],[0,2.27,0],.15,.115,12);
  for(let i=0;i<4;i++) {const ring=add(body,new T.TorusGeometry(.135-i*.003,.012,5,18),m.black,[0,2.13+i*.031,0]);ring.rotation.x=Math.PI/2;}
  for(const side of [-1,1]) {
    const leg=group(root,side<0?'legR':'legL',[side*.18,1.13,0]);
    rod(leg,m.net,[0,0,0],[side*.028,-.48,.012],.148,.104,12);
    ball(leg,m.skinDark,side*.028,-.51,.036,.112,.12,.101,10);
    rod(leg,m.net,[side*.028,-.51,.006],[side*.036,-.94,.014],.108,.083,12);
    plate(leg,m.armor,[[-.108,-.02],[.11,-.02],[.115,-.21],[.076,-.41],[-.059,-.44],[-.101,-.18]],.036,[side*.025,0,.096]);
    path(leg,m.edge,[[side*.035,-.051,.139],[side*.035,-.17,.148],[side*.064,-.337,.143]],.006,.003);
    const knee=ball(leg,m.armorDark,side*.028,-.49,.107,.113,.104,.083,8);knee.rotation.z=side*.10;
    plate(leg,m.armor,[[-.085,-.63],[0,-.56],[.089,-.63],[.070,-.93],[-.070,-.93]],.047,[side*.038,0,.075]);
    for(const y of [-.68,-.85])rod(leg,m.leather,[side*.035,y,0],[side*.035,y-.031,0],.11,.109,10);
    ball(leg,m.skinDark,side*.036,-1.02,.075,.112,.107,.164,10);
    for(let toe=-1;toe<=1;toe++)rod(leg,m.bone,[side*.036+toe*.057,-1.07,.16],[side*.036+toe*.06,-1.09,.255],.024,.001,6);
    const hip=plate(body,m.armorDark,[[side*.22,1.30],[side*.34,1.28],[side*.38,1.07],[side*.28,.95],[side*.18,1.07]],.035,[0,0,.057]);hip.rotation.y=side*.2;
  }
  // An asymmetrical breastplate leaves the netted torso readable.
  plate(body,m.armor,[[-.08,2.06],[.22,2.071],[.315,1.926],[.255,1.72],[.108,1.58],[-.025,1.69]],.05,[0,0,.185]);
  plate(body,m.armorDark,[[-.22,1.63],[.17,1.61],[.201,1.38],[.025,1.28],[-.179,1.39]],.034,[0,0,.180]);
  path(body,m.edge,[[-.058,2.04,.247],[.19,2.052,.247],[.285,1.914,.25],[.229,1.749,.245],[.106,1.616,.245]],.008,.005);
  path(body,m.armorDark,[[.211,2.016,.247],[.099,1.84,.247],[.104,1.66,.247]],.011,.008);
  for(let i=0;i<3;i++) path(body,m.polished,[[-.16,1.56-i*.07,.223],[.012,1.50-i*.067,.226],[.16,1.55-i*.076,.227]],.007,.004);
  const strap=box(body,m.leather,-.091,1.787,.236,.062,.72,.037);strap.rotation.z=-.61;
  for(let i=0;i<4;i++) {const buckle=box(body,m.bronze,-.28+i*.067,2.064-i*.11,.262,.058,.08,.015);buckle.rotation.z=-.61;}
  const belt=add(body,new T.CylinderGeometry(.30,.311,.096,14),m.leather,[0,1.268,0],[1,1,.77]);belt.name='utility-belt';
  box(body,m.armor,0,1.273,.246,.139,.095,.037);
  for(const side of [-1,1])box(body,m.leather,side*.287,1.193,-.015,.135,.15,.118);
  plate(body,m.leather,[[-.13,1.22],[.13,1.22],[.16,.94],[0,.865],[-.16,.94]],.02,[0,0,.144]);
  for(const side of [-1,1])path(body,m.bronze,[[side*.11,1.18,.175],[side*.128,.971,.175],[0,.886,.175]],.005,.003);
  // A compact bone trophy necklace echoes the unmasked reference.
  path(body,m.leather,[[-.15,2.154,.05],[-.20,2.025,.195],[0,1.93,.277],[.2,2.025,.195],[.15,2.154,.05]],.008);
  for(let i=-2;i<=2;i++)rod(body,m.bone,[i*.037,1.967+Math.abs(i)*.018,.279],[i*.042,1.913+Math.abs(i)*.012,.294],.01,.003,6);

  const rightArm=group(body,'armR',[-.44,2.07,0]),leftArm=group(body,'armL',[.44,2.07,0]);
  let blades;
  for(const [arm,side] of [[rightArm,-1],[leftArm,1]]) {
    rod(arm,m.net,[0,0,0],[side*.077,-.325,.008],.143,.11,12);
    ball(arm,m.skinDark,side*.075,-.328,.023,.11,.104,.097,10);
    rod(arm,m.net,[side*.077,-.33,.012],[side*.118,-.604,.064],.11,.084,12);
    const bracer=group(arm,side<0?'blade-bracer':'control-bracer',[side*.096,-.483,.018]);
    box(bracer,m.armorDark,0,0,0,.203,.28,.204);
    plate(bracer,m.armor,[[-.098,.125],[.086,.125],[.115,.054],[.086,-.14],[-.078,-.14],[-.112,.035]],.025,[0,0,.105]);
    for(const sx of [-.065,.065])rod(bracer,m.edge,[sx,.106,.139],[sx,-.105,.139],.006,.004);
    if(side<0) {
      blades=group(bracer,'twin-wrist-blades',[0,-.07,.085]);
      for(const sx of [-.062,.062]) {
        const blade=plate(blades,m.polished,[[sx-.021,.018],[sx+.022,.018],[sx+.02,-.435],[sx-.006,-.66],[sx-.022,-.49]],.021,[0,0,0],.002);
        blade.name='wrist-blade';
        path(blades,m.edge,[[sx+.022,-.015,.025],[sx+.019,-.433,.025],[sx-.006,-.66,.025]],.003,.001);
      }
    } else {
      box(bracer,m.black,0,.025,.137,.115,.122,.017);
      for(let row=0;row<3;row++)box(bracer,m.red,-.028+row*.009,.066-row*.034,.15,.028+row*.014,.010,.003);
    }
    makeHand(arm,m,side);
    const pauldron=group(body,side<0?'right-shoulder-armor':'left-shoulder-armor',[side*.449,2.092,-.014]);
    for(let row=0;row<3;row++) {
      const shell=ball(pauldron,row===1?m.armorDark:m.armor,side*.045*row,-row*.071,0,.194-row*.013,.095,.208-row*.012,10);shell.rotation.z=side*-.18;
    }
    path(pauldron,m.edge,[[side*-.103,.069,.137],[side*.107,.047,.159],[side*.184,-.073,.141]],.008,.005);
    for(let i=0;i<3;i++)rod(pauldron,m.bronze,[side*(.045+i*.065),.063,-.05],[side*(.08+i*.078),.145-i*.022,-.095],.028,.001,5);
  }
  const head=group(root,'head',[0,2.393,0]);
  ball(head,m.skinDark,0,.077,-.054,.22,.252,.178,12);
  const tendrils=makeTendrils(head,m),face=makeFace(head,m),mask=makeMask(head,m);
  // Shoulder cannon sits outside the tendrils and remains a separate rig part.
  const mount=group(body,'shoulder-cannon-mount',[.57,2.185,-.173]);
  box(mount,m.armorDark,0,0,0,.161,.31,.139);
  rod(mount,m.polished,[0,.11,0],[.032,.295,.01],.045,.045,8);
  const cannon=group(mount,'shoulder-cannon',[.032,.285,.009]);
  box(cannon,m.armorDark,0,0,-.035,.19,.14,.32);
  box(cannon,m.armor,0,.081,-.053,.213,.055,.263);
  rod(cannon,m.armorDark,[0,0,.09],[0,0,.287],.076,.061,10);
  const rim=add(cannon,new T.TorusGeometry(.059,.010,5,12),m.polished,[0,0,.29]);
  const lens=ball(cannon,m.black,0,0,.291,.048,.048,.011,10);
  for(let i=0;i<3;i++)box(cannon,m.edge,-.085,.066,-.141+i*.084,.028,.011,.034);
  const plasma=group(cannon,'plasma-charge',[0,0,.306]);
  const glow=new T.MeshBasicMaterial({color:'#9ccfe5'}),aura=new T.MeshBasicMaterial({color:'#6596cb',transparent:true,opacity:.19,blending:T.AdditiveBlending,depthWrite:false});
  ball(plasma,glow,0,0,0,.034,.034,.014,10);ball(plasma,aura,0,0,.023,.075,.075,.062,12);
  plasma.add(new T.PointLight(0x91c8e5,.5,1.15,2));
  let pose='blades',appearance='masked',disposed=false;
  function setPose(next) {
    if(!PREDATOR_POSES.includes(next))throw new RangeError(`Unknown Predator pose: ${next}`);
    pose=next;rightArm.rotation.set(-.12,0,-.12);leftArm.rotation.set(-.08,0,.08);cannon.rotation.set(.06,-.08,0);
    if(next==='blades')rightArm.rotation.set(-.66,0,-.22);
    if(next==='aim'){rightArm.rotation.set(-.23,0,-.17);leftArm.rotation.set(-.37,0,.16);cannon.rotation.set(-.06,-.25,0);}
    blades.visible=next==='blades';plasma.visible=next==='aim';root.userData.pose=next;
  }
  function setAppearance(next) {
    if(!PREDATOR_APPEARANCES.includes(next))throw new RangeError(`Unknown Predator appearance: ${next}`);
    appearance=next;mask.visible=next==='masked';face.visible=next==='unmasked';root.userData.appearance=next;
  }
  function dispose() {
    if(disposed)return;disposed=true;
    const geometries=new Set(),materials=new Set(),textures=new Set();
    root.traverse(object=>{if(object.geometry)geometries.add(object.geometry);if(object.material)(Array.isArray(object.material)?object.material:[object.material]).forEach(value=>materials.add(value));if(object.isLight)object.dispose?.();});
    Object.values(m).forEach(value=>materials.add(value));
    materials.forEach(value=>{if(value.map)textures.add(value.map);value.dispose();});textures.forEach(value=>value.dispose());geometries.forEach(value=>value.dispose());
  }
  setPose('blades');setAppearance('masked');
  return {root,head,mask,face,tendrils,blades,cannon,plasma,setPose,setAppearance,dispose,get pose(){return pose;},get appearance(){return appearance;}};
}
