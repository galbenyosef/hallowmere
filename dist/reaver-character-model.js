import * as T from './vendor/three.core.js';

// Forged plate, worn leather, and ivory fur use the roster's native faceted
// material language. Study-space pivots are adapted by createPlayableCharacter.
const UP = new T.Vector3(0, 1, 0);
function group(parent, name, x = 0, y = 0, z = 0) {
  const node = new T.Group(); node.name = name; node.position.set(x, y, z); parent.add(node); return node;
}
function mesh(parent, geometry, material, x = 0, y = 0, z = 0, sx = 1, sy = 1, sz = 1) {
  const node = new T.Mesh(geometry, material); node.position.set(x, y, z); node.scale.set(sx, sy, sz);
  node.castShadow = node.receiveShadow = true; parent.add(node); return node;
}
const ball = (p, m, x, y, z, sx, sy = sx, sz = sx) => mesh(p, new T.SphereGeometry(1, 10, 7), m, x, y, z, sx, sy, sz);
const box = (p, m, x, y, z, sx, sy, sz) => mesh(p, new T.BoxGeometry(sx, sy, sz), m, x, y, z);
function rod(p, m, a, b, radius, tip = radius, sides = 8) {
  const start = new T.Vector3(...a), end = new T.Vector3(...b), delta = end.clone().sub(start);
  const node = mesh(p, new T.CylinderGeometry(tip, radius, delta.length(), sides), m);
  node.position.copy(start.add(end).multiplyScalar(.5)); node.quaternion.setFromUnitVectors(UP, delta.normalize()); return node;
}
function plate(p, m, points, depth = .025, x = 0, y = 0, z = 0, bevel = .012) {
  const shape = new T.Shape(); points.forEach(([px, py], i) => i ? shape.lineTo(px, py) : shape.moveTo(px, py)); shape.closePath();
  return mesh(p, new T.ExtrudeGeometry(shape, {depth, bevelEnabled: true, bevelSize: bevel, bevelThickness: bevel, bevelSegments: 1, curveSegments: 1}), m, x, y, z);
}
function edgedPlate(p, m, points, depth = .025, crown = 0) {
  plate(p, m.edge, points, depth);
  const center = points.reduce((v, [x, y]) => [v[0] + x / points.length, v[1] + y / points.length], [0, 0]);
  const inset = points.map(([x, y]) => [center[0] + (x - center[0]) * .85, center[1] + (y - center[1]) * .88]);
  plate(p, m.steel, inset, .012, 0, 0, depth + .014, .007);
  if (crown) {
    // A shallow forged crown catches light across broad armor faces.
    const vertices = [center[0], center[1], depth + .03 + crown], indices = [];
    for (const [x, y] of inset) vertices.push(x, y, depth + .029);
    const area = inset.reduce((sum, [x, y], i) => {const next = inset[(i + 1) % inset.length]; return sum + x * next[1] - next[0] * y;}, 0);
    for (let i = 0; i < inset.length; i++) {const a = i + 1, b = (i + 1) % inset.length + 1; indices.push(...(area > 0 ? [0, a, b] : [0, b, a]));}
    const geometry = new T.BufferGeometry(); geometry.setAttribute('position', new T.Float32BufferAttribute(vertices, 3)); geometry.setIndex(indices); geometry.computeVertexNormals();
    mesh(p, geometry, m.steel);
  }
}
function fur(p, m, radius, depth, count = 12) {
  ball(p, m.furShade, 0, .012, 0, radius * 1.08, .042, depth * 1.08);
  count *= 2;
  for (let i = 0; i < count; i++) {
    const a = i / count * Math.PI * 2, x = Math.cos(a) * radius, z = Math.sin(a) * depth;
    const tuft = mesh(p, new T.ConeGeometry(.028, .055 + (i % 4) * .012, 5), i % 3 ? m.fur : m.furShade, x, -(i % 3) * .008, z, 1, 1, .85);
    tuft.rotation.set(Math.sin(a) * -.4, a, Math.PI + Math.cos(a) * .45);
  }
}
function buckle(p, m, x, y, z, width = .085, height = .07) {
  box(p, m.edge, x, y, z, width, height, .023);
  box(p, m.dark, x, y, z + .015, width * .61, height * .57, .012);
  rod(p, m.edge, [x, y - height * .27, z + .026], [x, y + height * .28, z + .026], .005);
}

function makeHead(root, m) {
  const head = group(root, 'head', 0, 2.045, .015);
  const rings = [[-.20, .085, .075], [-.155, .133, .108], [-.08, .16, .13], [.065, .16, .143], [.15, .145, .12], [.205, .09, .075]];
  const vertices = [], indices = [], sides = 12;
  for (const [y, width, depth] of rings) for (let i = 0; i < sides; i++) {
    const a = i / sides * Math.PI * 2; vertices.push(Math.sin(a) * width, y, Math.cos(a) * depth);
  }
  for (let j = 0; j < rings.length - 1; j++) for (let i = 0; i < sides; i++) {
    const a = j * sides + i, b = j * sides + (i + 1) % sides; indices.push(a, b, a + sides, b, b + sides, a + sides);
  }
  const face = new T.BufferGeometry(); face.setAttribute('position', new T.Float32BufferAttribute(vertices, 3)); face.setIndex(indices); face.computeVertexNormals();
  mesh(head, face, m.skin);
  for (const s of [-1, 1]) {
    ball(head, m.skin, s * .164, -.025, 0, .029, .054, .034);
    ball(head, m.skinShade, s * .061, .012, .133, .044, .019, .011);
    ball(head, m.eye, s * .061, .012, .144, .025, .007, .005);
    ball(head, m.dark, s * .061, .012, .149, .006, .007, .002);
    rod(head, m.hair, [s * .024, .043, .142], [s * .107, .062, .113], .009, .013, 5);
    rod(head, m.stubble, [s * .13, -.085, .079], [s * .096, -.16, .087], .014, .012, 5);
    ball(head, m.skinShade, s * .095, -.063, .119, .041, .016, .009);
  }
  plate(head, m.skin, [[-.022, .055], [.023, .055], [.032, -.05], [0, -.066], [-.027, -.047]], .035, 0, 0, .137, .005);
  rod(head, m.stubble, [-.044, -.105, .133], [.047, -.108, .13], .006);
  ball(head, m.stubble, 0, -.171, .097, .07, .02, .009);
  rod(head, m.scar, [-.106, .10, .11], [-.092, .038, .146], .003);
  // Close-cropped sides and swept, angular locks leave the face uncovered.
  const hair = group(head, 'cropped-dark-hair');
  mesh(hair, new T.SphereGeometry(1, 12, 6, 0, Math.PI * 2, 0, 1.65), m.hair, 0, .10, -.026, .166, .153, .152);
  for (let i = 0; i < 9; i++) {
    const x = -.13 + i * .031, h = .04 * Math.sin(i * .8);
    const lock = mesh(hair, new T.ConeGeometry(.043, .145, 4), i % 3 ? m.hair : m.hairLight, x + .022, .218 + h, .004 + (i % 2) * .045, 1, 1, .72);
    lock.rotation.set(-.36, 0, -.62);
  }
}

function makeAxe(root, m) {
  const axe = group(root, 'war-axe', .69, 1.135, .32); axe.rotation.z = -.15;
  rod(axe, m.wood, [0, -.96, 0], [0, .98, 0], .047, .04, 10);
  for (const y of [-.79, .34, .50, .91]) rod(axe, m.edge, [0, y, 0], [0, y + .047, 0], .054);
  rod(axe, m.leather, [0, -.28, 0], [0, .29, 0], .057);
  for (let i = 0; i < 10; i++) {
    const wrap = mesh(axe, new T.TorusGeometry(.058, .006, 4, 10), m.binding, 0, -.25 + i * .055, 0);
    wrap.rotation.set(Math.PI / 2, .13, 0);
  }
  rod(axe, m.edge, [0, -.97, 0], [0, -.88, 0], .069, .055);
  for (const s of [-1, 1]) {
    const blade = group(axe, s < 0 ? 'axe-blade-left' : 'axe-blade-right', 0, 0, -.045);
    edgedPlate(blade, m, [[0, .92], [s * .28, 1.025], [s * .43, 1.15], [s * .51, .90], [s * .48, .65], [s * .33, .47], [s * .24, .63], [0, .67]], .075);
    for (let i = 0; i < 3; i++) rod(blade, m.dark, [s * (.19 + i * .055), .82 + i * .024, .108], [s * (.22 + i * .055), .77 + i * .024, .108], .004);
  }
  box(axe, m.iron, 0, .81, .012, .14, .38, .17);
  for (const y of [.70, .90]) ball(axe, m.edge, 0, y, .109, .021, .021, .011);
}

export function createReaverCharacter() {
  const root = new T.Group(); root.name = 'C03 Reaver';
  const mat = (color, metalness = 0, roughness = .88) => new T.MeshStandardMaterial({color, metalness, roughness, flatShading: true});
  const m = {
    steel: mat('#687970', .68, .49), edge: mat('#a6b0a0', .72, .42), iron: mat('#3e4b48', .58, .59),
    leather: mat('#583d30'), binding: mat('#8a7051'), dark: mat('#242724'), cloth: mat('#393732'),
    fur: mat('#d2cdb5'), furShade: mat('#a8a68f'), skin: mat('#ba8d6d'), skinShade: mat('#93654e'),
    hair: mat('#272b29'), hairLight: mat('#42433a'), stubble: mat('#645748'), scar: mat('#996653'), eye: mat('#cac0a1'),
    wood: mat('#4d3b2d'), ember: mat('#d4a06e', .3, .55)
  };
  root.userData.materials = m;
  const body = group(root, 'body');
  ball(body, m.leather, 0, 1.47, -.005, .395, .355, .245);
  ball(body, m.cloth, 0, 1.04, 0, .30, .19, .21);
  rod(body, m.skin, [0, 1.72, 0], [0, 1.94, 0], .123, .10, 10);
  // Raised leather collar and substantial, fitted back plate.
  for (const s of [-1, 1]) {
    const collar = box(body, m.leather, s * .139, 1.785, -.018, .055, .20, .24); collar.rotation.z = s * -.24;
  }
  const back = group(body, 'backplate', 0, 1.48, -.222); back.rotation.y = Math.PI;
  edgedPlate(back, m, [[-.29, .21], [-.14, .28], [.14, .28], [.29, .21], [.27, -.16], [0, -.27], [-.27, -.16]], .025, .035);
  for (const s of [-1, 1]) {
    const chest = group(body, s < 0 ? 'cuirass-left' : 'cuirass-right', s * .022, 1.47, .207); chest.rotation.y = s * .22;
    edgedPlate(chest, m, [[s * .035, .255], [s * .155, .24], [s * .30, .145], [s * .31, -.05], [s * .19, -.17], [s * .035, -.145]], .036, .05);
    for (const [x, y] of [[.11, .207], [.272, .088]]) ball(chest, m.iron, s * x, y, .072, .016, .016, .009);
  }
  const sternum = group(body, 'sternum-plate', 0, 1.48, .245);
  edgedPlate(sternum, m, [[-.04, .27], [.04, .27], [.069, -.09], [0, -.18], [-.069, -.09]]);
  for (let i = 0; i < 2; i++) {
    const belly = group(body, `waist-plate-${i}`, 0, 1.30 - i * .077, .208);
    edgedPlate(belly, m, [[-.238, .052], [0, .025], [.238, .052], [.218, -.014], [0, -.058], [-.218, -.014]], .02);
  }
  const belt = mesh(body, new T.CylinderGeometry(.31, .32, .10, 14), m.leather, 0, 1.13, 0, 1, 1, .78);
  belt.name = 'utility-belt'; buckle(body, m, .105, 1.135, .253, .12, .092);
  for (const s of [-1, 1]) {
    const skirt = group(body, `leather-tasset-${s}`, s * .155, 1.04, .135); skirt.rotation.y = s * .28;
    plate(skirt, m.leather, [[-.125, .055], [.125, .055], [.16, -.245], [.045, -.275], [-.13, -.22]], .035);
    rod(skirt, m.binding, [-.10, .025, .051], [-.10, -.193, .051], .005);
  }
  const pouch = group(body, 'belt-satchel', -.233, 1.015, .28); pouch.rotation.z = -.10;
  box(pouch, m.leather, 0, -.017, 0, .235, .26, .12);
  plate(pouch, m.binding, [[-.123, .125], [.123, .125], [.106, .002], [0, -.036], [-.108, .005]], .017, 0, 0, .065);
  for (const x of [-.065, .065]) {box(pouch, m.leather, x, -.002, .094, .028, .21, .014); buckle(pouch, m, x, .015, .105, .049, .05);}
  const talisman = group(body, 'fury-talisman', .31, 1.035, .18);
  rod(talisman, m.binding, [0, .08, 0], [0, -.09, .02], .009);
  plate(talisman, m.edge, [[0, -.06], [.045, -.10], [.025, -.17], [0, -.19], [-.037, -.135]], .017, 0, 0, .01);
  ball(talisman, m.ember, 0, -.123, .04, .015, .025, .009);

  for (const s of [-1, 1]) {
    const leg = group(root, s < 0 ? 'legL' : 'legR', s * .215, .91, -.005);
    rod(leg, m.cloth, [0, .11, 0], [s * .014, -.31, .012], .141, .114, 10);
    rod(leg, m.leather, [s * .014, -.31, .012], [s * .023, -.74, .014], .114, .084, 10);
    const cuff = group(leg, `boot-fur-${s}`, s * .014, -.285, .016); fur(cuff, m, .123, .115, 14);
    const knee = group(leg, `knee-guard-${s}`, s * .013, -.34, .114);
    edgedPlate(knee, m, [[0, .098], [.105, .043], [.08, -.054], [0, -.099], [-.086, -.039], [-.1, .039]], .028);
    const shin = group(leg, `greave-${s}`, s * .023, -.59, .105);
    edgedPlate(shin, m, [[-.077, .143], [0, .118], [.078, .143], [.079, -.11], [.032, -.163], [-.065, -.15], [-.094, -.085]], .034, .018);
    rod(shin, m.edge, [0, .105, .062], [-.008, -.12, .062], .007, .004, 5);
    for (const y of [-.49, -.70]) {
      rod(leg, m.leather, [s * .023, y, .016], [s * .023, y - .027, .016], y > -.6 ? .119 : .105);
      buckle(leg, m, s * .092, y - .013, .091, .043, .04);
    }
    const boot = group(leg, `sabatons-${s}`, s * .026, -.79, .065); boot.rotation.y = s * .09;
    box(boot, m.dark, 0, -.076, .045, .231, .057, .35);
    ball(boot, m.iron, 0, -.021, .042, .126, .099, .196);
    for (let i = 0; i < 3; i++) {
      const toe = group(boot, `toe-plate-${i}`, 0, .007 - i * .025, .012 + i * .065); toe.rotation.x = -.8;
      edgedPlate(toe, m, [[-.10, .033], [.10, .033], [.109, -.019], [.077, -.045], [-.086, -.045]], .018);
    }
    const arm = group(body, s < 0 ? 'armL' : 'armR', s * .405, 1.65, 0);
    rod(arm, m.skin, [0, -.01, 0], [s * .14, -.27, .044], .148, .115, 10);
    ball(arm, m.skin, s * .085, -.145, .038, .14, .16, .132);
    rod(arm, m.leather, [s * .14, -.27, .044], [s * .272, -.47, .29], .109, .088, 10);
    const bracer = group(arm, `bracer-${s}`, s * .212, -.37, .176); bracer.rotation.set(-.75, 0, s * .2);
    ball(bracer, m.iron, 0, -.017, 0, .125, .166, .119);
    const bracerFace = group(bracer, `bracer-plate-${s}`, 0, 0, .104);
    edgedPlate(bracerFace, m, [[-.105, .105], [.105, .105], [.084, -.13], [0, -.155], [-.084, -.13]], .025);
    for (const y of [-.09, .065]) {
      rod(bracer, m.leather, [0, y, 0], [0, y + .029, 0], .134);
      buckle(bracer, m, 0, y + .015, .141, .065, .043);
    }
    const wristFur = group(bracer, `wrist-fur-${s}`, 0, .135, 0); fur(wristFur, m, .126, .117);
    const hand = group(arm, `gauntlet-${s}`, s * .285, -.515, .32);
    ball(hand, m.leather, 0, 0, 0, .091, .108, .085);
    box(hand, m.iron, 0, .025, .064, .145, .06, .041);
    for (let i = 0; i < 3; i++) ball(hand, m.skin, -.05 + i * .046, -.047, .064, .021, .032, .021);
    ball(hand, m.skin, s * -.071, -.012, .041, .033, .055, .028);
    // The left pauldron is the silhouette's anchor; the axe arm stays mobile.
    const shoulder = group(arm, s < 0 ? 'bulwark-pauldron' : 'axe-shoulder', s * .015, .018, -.025);
    shoulder.rotation.z = s * -.13;
    const scale = s < 0 ? 1 : .72; shoulder.scale.setScalar(scale);
    ball(shoulder, m.iron, 0, .015, -.01, .27, .22, .275);
    const face = group(shoulder, `pauldron-face-${s}`, 0, .01, .21);
    edgedPlate(face, m, [[-.235, .087], [-.148, .229], [.095, .249], [.229, .116], [.239, -.093], [.109, -.184], [-.12, -.169], [-.247, -.049]], .039);
    const boss = mesh(face, new T.TorusGeometry(.093, .021, 5, 12), m.edge, -.012, .022, .083);
    ball(face, m.steel, -.012, .022, .075, .071, .071, .024);
    boss.rotation.z = .15;
    for (const [x, y] of [[-.166, .092], [.12, .16], [.167, -.055], [-.10, -.12]]) ball(face, m.iron, x, y, .084, .017, .017, .01);
    const lame = group(shoulder, `pauldron-lame-${s}`, 0, -.12, .17);
    edgedPlate(lame, m, [[-.22, .02], [.21, .02], [.18, -.105], [0, -.15], [-.19, -.08]], .025);
  }
  makeHead(root, m); makeAxe(root, m);
  return root;
}
