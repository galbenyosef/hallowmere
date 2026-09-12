import * as T from 'three';

// Review model only; the live enemy roster and combat systems are independent.
export const KING_POSES = Object.freeze(['guard', 'reach', 'conjure']);
const UP = new T.Vector3(0, 1, 0);

function add(parent, geometry, material, xyz = [0, 0, 0], scale = [1, 1, 1]) {
  const object = new T.Mesh(geometry, material);
  object.position.set(...xyz); object.scale.set(...scale);
  object.castShadow = true; object.receiveShadow = true; parent.add(object);
  return object;
}
function group(parent, name, xyz = [0, 0, 0]) {
  const object = new T.Group(); object.name = name; object.position.set(...xyz); parent.add(object); return object;
}
function box(p, m, x, y, z, sx, sy, sz) {return add(p, new T.BoxGeometry(sx, sy, sz), m, [x, y, z]);}
function ball(p, m, x, y, z, sx, sy = sx, sz = sx, segments = 12) {return add(p, new T.SphereGeometry(1, segments, 8), m, [x, y, z], [sx, sy, sz]);}
function rod(p, m, a, b, r, r2 = r, sides = 8) {
  const start = new T.Vector3(...a), end = new T.Vector3(...b), delta = end.clone().sub(start);
  const object = add(p, new T.CylinderGeometry(r2, r, delta.length(), sides), m);
  object.position.copy(start.add(end).multiplyScalar(.5)); object.quaternion.setFromUnitVectors(UP, delta.normalize()); return object;
}
function path(p, m, points, r, tip = r) {
  for (let i = 1; i < points.length; i++) rod(p, m, points[i - 1], points[i], T.MathUtils.lerp(r, tip, (i - 1) / (points.length - 1)), T.MathUtils.lerp(r, tip, i / (points.length - 1)));
}
function shapeFrom(points) {
  const shape = new T.Shape(); points.forEach(([x, y], i) => i ? shape.lineTo(x, y) : shape.moveTo(x, y)); shape.closePath(); return shape;
}
function plate(p, m, points, depth = .025, xyz = [0, 0, 0], bevel = .006) {
  return add(p, new T.ExtrudeGeometry(shapeFrom(points), {depth, bevelEnabled: bevel > 0, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 1, curveSegments: 1}), m, xyz);
}
function disposeTree(root) {
  const geometries = new Set(), materials = new Set();
  root.traverse(object => {
    if (object.geometry) geometries.add(object.geometry);
    if (object.material) (Array.isArray(object.material) ? object.material : [object.material]).forEach(m => materials.add(m));
    if (object.isLight) object.dispose?.();
  });
  geometries.forEach(g => g.dispose()); materials.forEach(m => m.dispose());
}

function makeCloak(root, m) {
  const cloak = group(root, 'ragged-cloak');
  const positions = [], indices = [], columns = 16, rows = 10;
  for (let row = 0; row <= rows; row++) for (let col = 0; col <= columns; col++) {
    const v = row / rows, u = col / columns;
    const width = .90 + v * .50;
    let y = 2.22 - v * 2.02;
    if (row === rows) y += [0, .12, .025, .18, .065][col % 5];
    const x = (u - .5) * width;
    const z = -.245 - v * .25 + Math.cos(u * Math.PI * 12) * (.018 + v * .035);
    positions.push(x, y, z);
  }
  for (let row = 0; row < rows; row++) for (let col = 0; col < columns; col++) {
    // A few missing hem triangles make torn cloth rather than a perfect zigzag.
    const a = row * (columns + 1) + col;
    indices.push(a, a + columns + 1, a + 1);
    if (!(row === rows - 1 && col % 5 === 1)) indices.push(a + 1, a + columns + 1, a + columns + 2);
  }
  const geometry = new T.BufferGeometry(); geometry.setAttribute('position', new T.Float32BufferAttribute(positions, 3)); geometry.setIndex(indices); geometry.computeVertexNormals();
  add(cloak, geometry, m.cloak);
  for (const side of [-1, 1]) path(cloak, m.clothEdge, [[side * .44,2.21,-.24],[side * .51,1.68,-.30],[side * .61,.94,-.41],[side * .69,.26,-.48]], .01, .005);
  return cloak;
}

function makeHelmet(root, m) {
  const head = group(root, 'crowned-skull-helmet', [0, 2.46, .018]);
  ball(head, m.iron, 0, .115, -.041, .252, .31, .215, 14);
  // The mask has actual apertures for the eyes, nose, and open jaw.
  const outline = [[-.174,.205],[-.13,.274],[-.058,.281],[0,.252],[.058,.281],[.13,.274],[.174,.205],[.183,.102],[.158,.018],[.13,-.036],[.13,-.133],[.086,-.190],[0,-.211],[-.086,-.190],[-.13,-.133],[-.13,-.036],[-.158,.018],[-.183,.102]];
  const skull = shapeFrom(outline);
  for (const side of [-1, 1]) {
    const eye = new T.Path();
    for (let i = 0; i < 10; i++) {
      const a = i / 10 * Math.PI * 2;
      const x = side * .080 + Math.cos(a) * .061, y = .111 + Math.sin(a) * .054 + side * Math.cos(a) * .008;
      i ? eye.lineTo(x, y) : eye.moveTo(x, y);
    }
    eye.closePath(); skull.holes.push(eye);
    ball(head, m.void, side * .081, .112, .168, .070, .064, .009);
  }
  const nose = new T.Path(); nose.moveTo(0,.054); nose.lineTo(.026,-.011); nose.lineTo(0,-.041); nose.lineTo(-.026,-.011); nose.closePath(); skull.holes.push(nose);
  const mouth = new T.Path(); mouth.moveTo(-.093,-.076); mouth.lineTo(.093,-.076); mouth.lineTo(.082,-.13); mouth.lineTo(0,-.169); mouth.lineTo(-.082,-.13); mouth.closePath(); skull.holes.push(mouth);
  ball(head, m.void, 0, -.03, .169, .13, .155, .008);
  const maskGeometry = new T.ExtrudeGeometry(skull, {depth:.027,bevelEnabled:true,bevelSize:.008,bevelThickness:.006,bevelSegments:1,curveSegments:1});
  const maskPositions = maskGeometry.attributes.position;
  for(let i=0;i<maskPositions.count;i++) {
    const x=maskPositions.getX(i);
    maskPositions.setZ(i,maskPositions.getZ(i)-x*x*.64);
  }
  maskPositions.needsUpdate=true;maskGeometry.computeVertexNormals();
  add(head,maskGeometry,m.skull,[0,0,.183]);
  for (const side of [-1, 1]) {
    path(head, m.edge, [[side*.016,.187,.219],[side*.087,.189,.217],[side*.154,.213,.204]], .013, .009);
    path(head, m.skull, [[side*.151,.045,.214],[side*.108,.014,.234],[side*.081,-.036,.213]], .022, .012);
    const cheek = plate(head, m.iron, [[side*.185,.092],[side*.246,.162],[side*.281,-.125],[side*.204,-.23],[side*.147,-.199],[side*.17,-.046]], .055, [0,0,.013]);
    cheek.rotation.y = side * .12;
    path(head, m.edge, [[side*.219,.106,.071],[side*.264,-.117,.076],[side*.198,-.219,.074]], .009, .006);
  }
  for (let i = -3; i <= 3; i++) {
    const x = i * .022, length = .027 - Math.abs(i) * .002;
    plate(head, m.skull, [[x-.009,-.057],[x+.009,-.057],[x+.007,-.057-length],[x-.006,-.057-length]], .018, [0,0,.214], .003);
    plate(head, m.skull, [[x-.008,-.144],[x+.008,-.144],[x+.005,-.119],[x-.005,-.119]], .015, [0,0,.205], .002);
  }
  // Seven tall blades form the crown, with a prominent center point.
  const crown = group(head, 'seven-point-crown');
  for (const angle of [-2.4,-1.28,-.66,0,.66,1.28,2.4]) {
    const height = angle === 0 ? .64 : Math.abs(angle) < 1 ? .69 : Math.abs(angle) < 2 ? .64 : .49;
    const spike = group(crown, 'crown-blade', [Math.sin(angle)*.223,.252,Math.cos(angle)*.174-.025]);
    spike.rotation.y = angle; spike.rotation.x = .075;
    plate(spike, m.iron, [[-.077,.005],[-.055,.20],[-.033,height*.69],[.001,height],[.03,height*.50],[.069,.005],[0,-.073]], .029, [0,0,-.012]);
    path(spike, m.edge, [[0,-.061,.023],[-.046,.196,.023],[-.028,height*.69,.023],[.001,height,.021]], .006, .002);
    plate(spike, m.polished, [[0,-.054],[.001,height*.89],[.019,height*.43],[.054,.014]], .005, [0,0,.020], .001);
  }
  return head;
}

function makeHand(parent, m, side, open) {
  const hand = group(parent, side < 0 ? 'sword-hand' : 'casting-hand', [side * .12,-.73,.062]);
  const palm = ball(hand, m.black, 0, -.015, 0, .092, .118, .065, 10); palm.name = 'gauntlet-palm';
  plate(hand, m.iron, [[-.082,.075],[.079,.075],[.069,-.07],[0,-.115],[-.068,-.07]], .025, [0,0,-.066]);
  for (let i = 0; i < 4; i++) {
    const x = (i - 1.5) * .044;
    const finger = group(hand, `finger-${i}`, [x,-.089,.003]);
    finger.rotation.z = open ? (i - 1.5) * .17 : 0;
    const reach = open ? .17 - Math.abs(i - 1.5) * .019 : .085;
    path(finger, m.black, [[0,0,0],[0,-reach*.57,.006],[0,-reach,.043]], .021, .016);
    for (const y of [-.025,-reach*.62]) box(finger,m.polished,0,y,-.013,.038,.036,.018);
    rod(finger,m.polished,[0,-reach,.043],[0,-reach-.028,.063],.017,.003,5);
  }
  path(hand,m.black,[[side*.085,.015,.015],[side*.144,-.04,.039],[side*.139,-.111,.074]],.029,.019);
  for (let i = 0; i < 3; i++) rod(hand,m.edge,[(i-1)*.046,.07,-.085],[(i-1)*.037,-.035,-.091],.005,.003);
  return hand;
}

function makeGreatsword(hand, m) {
  const sword = group(hand, 'kings-greatsword', [0,-.11,.055]);
  plate(sword,m.iron,[[-.075,-.025],[.075,-.025],[.070,-1.16],[0,-1.38],[-.070,-1.16]],.041,[0,0,-.02]);
  for (const side of [-1,1]) path(sword,m.edge,[[side*.075,-.04,.024],[side*.068,-1.15,.024],[0,-1.38,.024]],.006,.002);
  rod(sword,m.leather,[0,.027,0],[0,.27,0],.038);
  for(let i=0;i<7;i++) {const band=add(sword,new T.TorusGeometry(.039,.004,4,10),m.iron,[0,.05+i*.029,0]);band.rotation.x=Math.PI/2;}
  path(sword,m.iron,[[-.24,.092,0],[-.15,.02,0],[0,0,0],[.15,.02,0],[.24,.092,0]],.031,.024);
  ball(sword,m.polished,0,.3,0,.051,.06,.039,8);
  return sword;
}

export function createHuntKingCharacter() {
  const root = new T.Group(); root.name = 'Wild Hunt King study';
  const mat = (color, metalness = 0, roughness = .84) => new T.MeshStandardMaterial({color,metalness,roughness,flatShading:true});
  const m = {
    iron:mat('#343f43',.75,.48), polished:mat('#626c6c',.78,.39), edge:mat('#949b94',.7,.38), skull:mat('#838883',.68,.48),
    black:mat('#182226'), void:new T.MeshBasicMaterial({color:'#030709'}), leather:mat('#492e31'), seam:mat('#775459'),
    cloak:mat('#222b2d'), clothEdge:mat('#576062'), bronze:mat('#81745e',.65,.52)
  };
  m.cloak.side = T.DoubleSide;
  const body = group(root,'body');
  makeCloak(body,m);
  for (const side of [-1,1]) {
    const leg = group(root,side < 0 ? 'legR' : 'legL',[side*.20,1.25,0]);
    rod(leg,m.leather,[0,0,0],[side*.026,-.54,.009],.151,.111,10);
    const thigh = plate(leg,m.iron,[[-.122,-.07],[.125,-.07],[.107,-.41],[0,-.49],[-.10,-.41]],.046,[side*.015,0,.13]);
    thigh.rotation.x=-.05;
    path(leg,m.edge,[[side*.017,-.08,.190],[side*.017,-.37,.177],[side*.017,-.46,.145]],.008,.004);
    ball(leg,m.iron,side*.026,-.53,.068,.141,.14,.112,8);
    rod(leg,m.polished,[side*.026,-.53,.176],[side*.03,-.56,.293],.068,.001,5);
    rod(leg,m.black,[side*.026,-.56,.006],[side*.036,-1.06,.01],.11,.084,10);
    plate(leg,m.iron,[[-.102,-.67],[0,-.60],[.11,-.67],[.076,-1.07],[-.076,-1.07]],.068,[side*.035,0,.066]);
    path(leg,m.edge,[[side*.036,-.64,.148],[side*.036,-1.06,.139]],.007,.004);
    const boot = box(leg,m.iron,side*.035,-1.14,.09,.217,.18,.36);
    plate(boot,m.polished,[[-.109,.02],[.109,.02],[.094,-.06],[-.094,-.06]],.04,[0,0,.17]);
    for (const y of [-.8,-.97]) rod(leg,m.leather,[side*.03,y,0],[side*.03,y-.027,0],.108,.105,10);
  }
  ball(body,m.leather,0,1.85,0,.418,.51,.245,16);
  rod(body,m.black,[0,2.18,0],[0,2.39,0],.16,.14,12);
  // Curved ribs are separate plates over burgundy padding.
  const ribs = group(body,'ribbed-breastplate');
  for (let row = 0; row < 6; row++) {
    const y = 2.19-row*.104, width = .39-row*.011;
    for (const side of [-1,1]) {
      const points = [[0,y-.038,.27],[side*.15,y-.075,.286],[side*(width-.04),y-.058,.229],[side*width,y+.025,.127]];
      path(ribs,m.iron,points,.035,.026);
      path(ribs,m.polished,points.map(([x,py,z])=>[x,py+.025,z+.016]),.009,.006);
      rod(ribs,m.seam,[side*(width-.02),y-.046,.17],[side*(width+.003),y+.042,.117],.014,.009);
    }
  }
  for (const side of [-1,1]) {
    path(body,m.iron,[[0,2.20,.261],[side*.23,2.28,.221],[side*.40,2.34,.126],[side*.45,2.28,0]],.039,.027);
    path(body,m.edge,[[0,2.23,.274],[side*.23,2.309,.230],[side*.40,2.365,.127]],.009,.005);
    for(let row=0;row<3;row++) {
      const y=1.47-row*.14;
      plate(body,m.leather,[[side*.018,y],[side*.32,y+.03],[side*.36,y-.14],[side*.06,y-.18]],.035,[0,0,.151]);
      path(body,m.iron,[[side*.024,y,.193],[side*.31,y+.025,.187],[side*.345,y-.126,.185]],.013,.009);
    }
    const hip = plate(body,m.iron,[[side*.30,1.45],[side*.44,1.42],[side*.48,1.08],[side*.36,.98],[side*.27,1.14]],.05,[0,0,.013]);
    hip.rotation.y=side*.25;
  }
  const belt = add(body,new T.CylinderGeometry(.351,.366,.117,16),m.black,[0,1.51,0],[1,1,.73]); belt.name='segmented-belt';
  for(let i=-4;i<=4;i++) {const a=i*.20;box(body,m.iron,Math.sin(a)*.35,1.51,Math.cos(a)*.268,.057,.10,.04);}
  plate(body,m.bronze,[[-.052,.047],[.052,.047],[.044,-.029],[0,-.059],[-.044,-.029]],.027,[0,1.51,.291]);
  makeHelmet(root,m);

  const swordArm=group(body,'armR',[-.47,2.23,0]);
  const castingArm=group(body,'armL',[.47,2.23,0]);
  for(const [arm,side] of [[swordArm,-1],[castingArm,1]]) {
    rod(arm,m.black,[0,0,0],[side*.065,-.35,0],.155,.124,10);
    rod(arm,m.leather,[side*.064,-.31,0],[side*.12,-.65,.047],.126,.091,10);
    for(let row=0;row<3;row++) {
      const y=-.38-row*.095;
      const cuff=add(arm,new T.CylinderGeometry(.139-row*.011,.122-row*.01,.12,8),m.iron,[side*(.078+row*.016),y,.022+row*.012]); cuff.rotation.z=side*.12;
      rod(arm,m.iron,[side*(.18+row*.003),y+.01,0],[side*(.30-row*.015),y+.081,-.045],.043,.001,5);
    }
    const shoulder=group(body,side<0?'right-spiked-pauldron':'left-spiked-pauldron',[side*.48,2.26,-.006]);
    for(let row=0;row<3;row++) {
      const plateMesh=ball(shoulder,m.iron,side*row*.057,-row*.082,0,.23-row*.02,.115,.265-row*.023,10);
      plateMesh.rotation.z=side*-.22;
    }
    for(let i=0;i<5;i++) {
      const a=-1.05+i*.52, x=side*(.07+Math.cos(a)*.12),z=Math.sin(a)*.19;
      rod(shoulder,m.iron,[x,.055,z],[x+side*(.13+Math.cos(a)*.035),.28+(i%2)*.035,z*1.52],.048,.001,5);
      ball(shoulder,m.polished,x,.05,z,.046,.022,.037,8);
    }
    const clasp=ball(shoulder,m.bronze,side*-.082,.04,.231,.076,.076,.024,10);
    clasp.rotation.z=side*.25;
    path(body,m.polished,[[side*.40,2.3,.21],[side*.29,2.22,.277],[0,2.19,.283]],.009,.008);
  }
  const swordHand=makeHand(swordArm,m,-1,false);
  const castingHand=makeHand(castingArm,m,1,true);
  const sword=makeGreatsword(swordHand,m);
  const magic=group(castingHand,'conjured-fire',[0,-.02,.18]);
  const coreMaterial=new T.MeshBasicMaterial({color:'#fff1c7'});
  const auraMaterial=new T.MeshBasicMaterial({color:'#f56e37',transparent:true,opacity:.20,blending:T.AdditiveBlending,depthWrite:false});
  ball(magic,coreMaterial,0,0,0,.055,.065,.055,10);
  ball(magic,auraMaterial,0,0,0,.132,.132,.132,12);
  const sparkMaterial=new T.MeshBasicMaterial({color:'#f8b789',transparent:true,opacity:.9,depthWrite:false});
  for(let i=0;i<15;i++) {
    const a=i/15*Math.PI*2, r=.13+(i%3)*.028;
    path(magic,sparkMaterial,[[Math.sin(a)*.055,Math.cos(a)*.055,.03],[Math.sin(a+.13)*r*.8,Math.cos(a+.13)*r*.8,(i%3-.7)*.025],[Math.sin(a)*r,Math.cos(a)*r,.005]],.003,.001);
  }
  magic.add(new T.PointLight(0xff7541,1.2,1.5,2));
  let pose='reach',disposed=false;
  function setPose(next) {
    if(!KING_POSES.includes(next)) throw new RangeError(`Unknown king pose: ${next}`);
    pose=next;
    swordArm.rotation.set(-.22,0,-.28);
    castingArm.rotation.set(0,0,0);
    castingHand.rotation.set(0,0,0);
    if(next!=='guard') {
      castingArm.rotation.set(-1.34,-.16,-.22);
      castingHand.rotation.set(1.10,0,Math.PI+.22);
    }
    magic.visible=next==='conjure'; root.userData.pose=next;
  }
  setPose('reach');
  return {root,sword,castingHand,magic,setPose,get pose(){return pose;},dispose(){if(!disposed){disposed=true;disposeTree(root);}}};
}
