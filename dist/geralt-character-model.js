import * as T from './vendor/three.core.js';

// Shared model for the character study and playable Geralt adapter.
export const GERALT_POSES = Object.freeze(['sheathed', 'steel', 'silver', 'dagger']);
const UP = new T.Vector3(0, 1, 0);

function mesh(parent, geometry, material, position = [0, 0, 0], scale = [1, 1, 1]) {
  const object = new T.Mesh(geometry, material);
  object.position.set(...position);
  object.scale.set(...scale);
  object.castShadow = true;
  object.receiveShadow = true;
  parent.add(object);
  return object;
}
function group(parent, name, position = [0, 0, 0]) {
  const object = new T.Group();
  object.name = name;
  object.position.set(...position);
  parent.add(object);
  return object;
}
function ellipsoid(p, m, x, y, z, sx, sy, sz, segments = 12) {
  return mesh(p, new T.SphereGeometry(1, segments, 8), m, [x, y, z], [sx, sy, sz]);
}
function box(p, m, x, y, z, sx, sy, sz) {
  return mesh(p, new T.BoxGeometry(sx, sy, sz), m, [x, y, z]);
}
function rod(p, m, a, b, radius, endRadius = radius, sides = 8) {
  const start = new T.Vector3(...a), end = new T.Vector3(...b), delta = end.clone().sub(start);
  const object = mesh(p, new T.CylinderGeometry(endRadius, radius, delta.length(), sides), m);
  object.position.copy(start.add(end).multiplyScalar(.5));
  object.quaternion.setFromUnitVectors(UP, delta.normalize());
  return object;
}
function path(p, m, points, radius, tip = radius) {
  for (let i = 1; i < points.length; i++) {
    rod(p, m, points[i - 1], points[i], T.MathUtils.lerp(radius, tip, (i - 1) / (points.length - 1)), T.MathUtils.lerp(radius, tip, i / (points.length - 1)));
  }
}
function plate(p, m, points, depth, position = [0, 0, 0], bevel = .008) {
  const shape = new T.Shape();
  points.forEach(([x, y], i) => i ? shape.lineTo(x, y) : shape.moveTo(x, y));
  shape.closePath();
  return mesh(p, new T.ExtrudeGeometry(shape, {depth, bevelEnabled: bevel > 0, bevelSize: bevel, bevelThickness: bevel, bevelSegments: 1, curveSegments: 1}), m, position);
}
function mailTexture() {
  if (typeof document === 'undefined') return null;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 128;
  const context = canvas.getContext('2d');
  if (!context) return null;
  context.fillStyle = '#242e30';
  context.fillRect(0, 0, 128, 128);
  for (let y = -8; y < 144; y += 12) {
    for (let x = -8; x < 144; x += 16) {
      context.beginPath();
      context.ellipse(x + (Math.floor(y / 12) % 2 ? 8 : 0), y, 5.5, 7, -.32, 0, Math.PI * 2);
      context.strokeStyle = '#131e21'; context.lineWidth = 3; context.stroke();
      context.strokeStyle = '#798483'; context.lineWidth = 1.2; context.stroke();
    }
  }
  const texture = new T.CanvasTexture(canvas);
  texture.wrapS = texture.wrapT = T.RepeatWrapping;
  texture.repeat.set(3, 2);
  texture.colorSpace = T.SRGBColorSpace;
  return texture;
}

function makeSword(materials, type) {
  const g = new T.Group();
  g.name = `${type}-weapon`;
  g.userData.weapon = type;
  const dagger = type === 'dagger', length = dagger ? .34 : type === 'silver' ? 1.10 : 1.02;
  const half = dagger ? .037 : .048;
  const grip = dagger ? .14 : .24;
  // The guard is the origin; the blade points down into the scabbard.
  plate(g, type === 'silver' ? materials.silver : materials.steel, [[-half, -.025], [half, -.025], [half * .72, -length * .82], [0, -length], [-half * .72, -length * .82]], .019, [0, 0, -.0095], .003);
  rod(g, materials.edge, [0, -.08, .016], [0, -length * .88, .016], .003, .001, 4);
  rod(g, type === 'steel' ? materials.brown : materials.black, [0, .025, 0], [0, grip, 0], dagger ? .022 : .027);
  for (let i = 0; i < (dagger ? 5 : 9); i++) {
    const wrap = mesh(g, new T.TorusGeometry(dagger ? .023 : .028, .0035, 4, 10), materials.binding, [0, .045 + i * .021, 0]);
    wrap.rotation.x = Math.PI / 2; wrap.rotation.z = -.16;
  }
  if (type === 'silver') {
    path(g, materials.silver, [[-.20, .07, 0], [-.11, .015, 0], [0, 0, 0], [.11, .015, 0], [.20, .07, 0]], .021);
    const pommel = mesh(g, new T.TorusGeometry(.04, .012, 5, 10), materials.silver, [0, grip + .04, 0]);
    pommel.scale.y = 1.2;
  } else {
    const width = dagger ? .105 : .165;
    rod(g, materials.steel, [-width, .01, 0], [width, .01, 0], dagger ? .014 : .02);
    ellipsoid(g, materials.steel, 0, grip + .025, 0, dagger ? .027 : .043, .032, .03, 8);
  }
  return g;
}

function scabbard(parent, m, type) {
  const dagger = type === 'dagger', length = dagger ? .36 : type === 'silver' ? 1.12 : 1.04;
  const width = dagger ? .049 : .061;
  const sheath = group(parent, `${type}-sheath`);
  plate(sheath, type === 'steel' ? m.brown : m.black, [[-width, -.037], [width, -.037], [width * .75, -length + .07], [0, -length], [-width * .75, -length + .07]], .05, [0, 0, -.025]);
  for (const y of [-.053, -length + .09]) box(sheath, m.fittings, 0, y, 0, width * 2.1, .043, .06);
  rod(sheath, m.stitch, [-width * .72, -.12, .032], [-width * .54, -length + .14, .032], .0025);
  return sheath;
}

export function createGeraltCharacter() {
  const root = new T.Group(); root.name = 'Geralt character study';
  const material = (color, metalness = 0, roughness = .85) => new T.MeshStandardMaterial({color, metalness, roughness, flatShading: true});
  const m = {
    leather: material('#303938'), brown: material('#5d4537'), black: material('#222b2d'),
    seam: material('#716554'), stitch: material('#a3916d'), fittings: material('#a08e70', .6, .48),
    steel: material('#889595', .72, .4), silver: material('#c6d1cc', .8, .3), edge: material('#d9e2db', .65, .35),
    skin: material('#b29b86'), skinShadow: material('#8b7866'), hair: material('#c7c9bd'), hairLight: material('#e0dfd2'), hairDark: material('#858e87'),
    beard: material('#6f756e'), mouth: material('#574d45'), scar: material('#996b61'), eyeWhite: material('#aa9e7f'), iris: material('#bf913e'),
    binding: material('#786958'), mail: material('#939e98', .62, .64)
  };
  m.mail.map = mailTexture();
  const body = group(root, 'body');

  // Separate fitted legs and boots retain the game's readable heroic proportions.
  for (const side of [-1, 1]) {
    const leg = group(root, side < 0 ? 'legL' : 'legR', [side * .145, .91, 0]);
    rod(leg, m.black, [0, 0, 0], [side * .026, -.39, .01], .106, .084, 10);
    ellipsoid(leg, m.brown, side * .024, -.37, .06, .097, .12, .065);
    rod(leg, m.brown, [side * .026, -.4, .01], [side * .03, -.77, .01], .091, .075, 10);
    box(leg, m.black, side * .03, -.805, .067, .18, .16, .29);
    box(leg, m.black, side * .03, -.88, .075, .185, .035, .305);
    for (const y of [-.47, -.62]) {
      rod(leg, m.black, [side * .027, y, .01], [side * .027, y - .027, .01], .097, .096, 10);
      box(leg, m.fittings, side * .106, y - .01, .045, .025, .035, .053);
    }
  }

  ellipsoid(body, m.mail, 0, 1.40, 0, .30, .40, .18, 16);
  ellipsoid(body, m.leather, 0, 1.42, .035, .285, .32, .178, 12);
  for (const side of [-1, 1]) {
    const points = [[side * .025, 1.67], [side * .21, 1.62], [side * .257, 1.44], [side * .22, 1.18], [side * .035, 1.15]];
    plate(body, m.leather, points, .022, [0, 0, .175]);
    path(body, m.seam, points.map(([x, y]) => [x, y, .204]), .005);
    // Short overlapping leather panels, not a robe or cape.
    const skirt = plate(body, m.brown, [[side * .025, 1.13], [side * .235, 1.13], [side * .285, .84], [side * .08, .80]], .025, [0, 0, .137]);
    skirt.rotation.x = -.065;
  }
  rod(body, m.mail, [0, 1.69, 0], [0, 1.81, 0], .135, .113, 12);
  rod(body, m.skin, [0, 1.78, 0], [0, 1.92, 0], .09, .084, 10);
  for (const side of [-1, 1]) {
    const collar = box(body, m.brown, side * .11, 1.77, .009, .041, .16, .21);
    collar.rotation.z = side * -.18;
  }
  // Two broad diagonal harness straps across the chest.
  for (const side of [-1, 1]) {
    const strap = box(body, m.brown, side * .015, 1.405, .224, .062, .61, .025);
    strap.rotation.z = side * .67;
    const stitching = box(strap, m.stitch, -.022, 0, .015, .003, .58, .002);
    stitching.castShadow = false;
    const buckle = box(body, m.fittings, side * .14, 1.56, .246, .072, .088, .016);
    buckle.rotation.z = side * .67;
    box(buckle, m.black, 0, 0, .012, .043, .057, .008);
  }
  const belt = mesh(body, new T.CylinderGeometry(.264, .278, .087, 14), m.brown, [0, 1.135, 0], [1, 1, .77]);
  belt.name = 'belt';
  box(body, m.fittings, .035, 1.14, .219, .11, .082, .021);
  box(body, m.black, .035, 1.14, .235, .071, .047, .015);
  box(body, m.brown, -.265, 1.01, .014, .13, .17, .12);
  box(body, m.fittings, -.268, 1.045, .084, .045, .025, .013);

  const armR = group(body, 'armR', [-.31, 1.62, 0]);
  const armL = group(body, 'armL', [.31, 1.62, 0]);
  for (const [arm, side] of [[armR, -1], [armL, 1]]) {
    rod(arm, m.mail, [0, 0, 0], [side * .067, -.28, .013], .124, .092, 12);
    const shoulder = ellipsoid(arm, m.brown, side * .014, .025, -.018, .155, .097, .177);
    shoulder.rotation.z = side * -.18;
    path(arm, m.seam, [[side * .11, .005, -.13], [side * .153, -.016, 0], [side * .105, -.014, .14]], .013);
    for (const z of [-.105, .105]) ellipsoid(arm, m.fittings, side * .124, .005, z, .012, .012, .012, 6);
    rod(arm, m.black, [side * .067, -.27, .013], [side * .102, -.51, .065], .091, .07, 10);
    rod(arm, m.brown, [side * .084, -.32, .025], [side * .103, -.50, .064], .087, .074, 10);
    for (const y of [-.355, -.465]) box(arm, m.fittings, side * .10, y, .114, .10, .023, .014);
    ellipsoid(arm, m.black, side * .104, -.555, .074, .067, .093, .058);
    for (let i = 0; i < 3; i++) box(arm, m.seam, side * .105 + (i - 1) * .022, -.552, .123, .011, .065, .005);
  }
  const gripAnchor = group(armR, 'right-hand-weapon', [-.414 + .31, -.565, .074]);
  gripAnchor.rotation.set(-.31, 0, -.09);

  // Sculpt the face with angular horizontal sections instead of a generic sphere.
  const head = group(root, 'head', [0, 1.995, .025]);
  const rings = [[-.185, .075, .061], [-.14, .121, .10], [-.105, .132, .116], [-.055, .151, .138], [.065, .147, .137], [.15, .135, .115], [.205, .073, .065]];
  const vertices = [], indices = [], segments = 12;
  rings.forEach(([y, width, depth]) => {
    for (let i = 0; i < segments; i++) {const a = i / segments * Math.PI * 2; vertices.push(Math.sin(a) * width, y, Math.cos(a) * depth);}
  });
  for (let j = 0; j < rings.length - 1; j++) for (let i = 0; i < segments; i++) {
    const a = j * segments + i, b = j * segments + (i + 1) % segments;
    indices.push(a, b, a + segments, b, b + segments, a + segments);
  }
  const face = new T.BufferGeometry(); face.setAttribute('position', new T.Float32BufferAttribute(vertices, 3)); face.setIndex(indices); face.computeVertexNormals();
  // The jaw carries a thin beard surface, rather than raised tubes around it.
  for (let j = 0; j < rings.length - 1; j++) face.addGroup(j * segments * 6, segments * 6, j <= 1 ? 1 : 0);
  mesh(head, face, [m.skin, m.beard]);
  for (const side of [-1, 1]) {
    ellipsoid(head, m.skin, side * .155, -.025, -.002, .028, .057, .034, 8);
    ellipsoid(head, m.skinShadow, side * .169, -.024, .012, .009, .032, .013, 8);
    ellipsoid(head, m.skinShadow, side * .067, .019, .117, .036, .018, .012, 8);
    ellipsoid(head, m.eyeWhite, side * .067, .018, .131, .027, .008, .006, 8);
    ellipsoid(head, m.iris, side * .067, .018, .137, .008, .008, .003, 8);
    ellipsoid(head, m.black, side * .067, .018, .140, .002, .007, .0015, 6);
    rod(head, m.beard, [side * .031, .050, .130], [side * .102, .059, .107], .006, .008, 6);
  }
  const nose = new T.BufferGeometry();
  nose.setAttribute('position', new T.Float32BufferAttribute([-.021,.050,.132, .021,.050,.132, 0,-.042,.180, -.024,-.059,.154, .024,-.059,.154, 0,-.070,.151], 3));
  nose.setIndex([0,2,1,0,3,2,1,2,4,3,5,2,2,5,4]); nose.computeVertexNormals(); mesh(head, nose, m.skin);
  // Short salt-and-pepper beard leaves the cheekbones and mouth visible.
  for (const side of [-1, 1]) {
    path(head, m.beard, [[side * .135, -.044, .044], [side * .118, -.097, .078], [side * .093, -.140, .081]], .014, .013);
    rod(head, m.beard, [side * .008, -.084, .154], [side * .050, -.095, .141], .009, .006, 6);
    for (let i = 0; i < 6; i++) rod(head, m.hairDark, [side * (.014 + i * .014), -.145 + i * .001, .098 - i * .004], [side * (.014 + i * .014), -.160 + i * .005, .090 - i * .003], .0014);
  }
  rod(head, m.mouth, [-.04, -.11, .138], [.04, -.11, .138], .005, .005, 6);
  // Geralt's left-eye scar is split around the eye opening.
  path(head, m.scar, [[.074,.14,.109], [.065,.095,.126], [.058,.055,.145], [.063,.033,.148]], .004, .003);
  path(head, m.scar, [[.067,.002,.150], [.078,-.032,.143], [.090,-.063,.119]], .0035, .002);
  rod(head, m.scar, [.073,.14,.110], [.113,.151,.088], .0025);

  const hair = group(head, 'tied-back-white-hair');
  mesh(hair, new T.SphereGeometry(.164, 16, 8, 0, Math.PI * 2, 0, 1.2), m.hair, [0, .070, -.015], [1, .88, 1.02]);
  m.hair.side = m.hairLight.side = T.DoubleSide;
  for (let i = -6; i <= 6; i++) {
    const x = i * .021, edge = Math.abs(i) / 6;
    const points = [[x,.139 - edge * .039,.112 - edge * .025], [x * 1.1,.222 - edge * .047,.032], [x,.193 - edge * .038,-.096], [x * .64,.082,-.157], [x * .32,.015,-.173]];
    const lockVertices = [], lockIndices = [];
    points.forEach(([px,py,pz], index) => {
      const width = index === 4 ? .004 : .014;
      lockVertices.push(px-width,py,pz,px+width,py,pz);
      if (index < points.length - 1) {const a = index * 2; lockIndices.push(a,a+1,a+2,a+1,a+3,a+2);}
    });
    const lock = new T.BufferGeometry(); lock.setAttribute('position', new T.Float32BufferAttribute(lockVertices,3)); lock.setIndex(lockIndices); lock.computeVertexNormals();
    mesh(hair, lock, i % 3 ? m.hair : m.hairLight);
  }
  for (const side of [-1, 1]) {
    for (let i = 0; i < 4; i++) path(hair, i % 2 ? m.hairDark : m.hair, [[side * (.133 + i * .005), .1 - i * .03, .039 - i * .011], [side * .163, .022 - i * .035, -.07], [side * .112, -.063 - i * .024, -.16], [side * .046, -.026 - i * .015, -.187]], .016, .009);
  }
  ellipsoid(hair, m.black, 0, -.025, -.183, .050, .035, .045, 8);
  path(hair, m.hair, [[0,-.045,-.19], [.024,-.12,-.212], [.044,-.22,-.202], [.05,-.30,-.166]], .048, .018);
  for (const offset of [-.02, .01, .027]) path(hair, m.hairLight, [[offset,-.053,-.225], [offset+.02,-.16,-.246], [offset+.037,-.27,-.20]], .0045, .002);

  // Wolf medallion: distinct ears, cheek points, and a tapered muzzle.
  path(body, m.steel, [[-.085,1.80,.073], [-.102,1.68,.16], [0,1.54,.251], [.102,1.68,.16], [.085,1.80,.073]], .005);
  const medallion = group(body, 'wolf-medallion', [0, 1.535, .263]);
  plate(medallion, m.silver, [[-.05,.045],[-.047,.095],[-.013,.061],[0,.066],[.013,.061],[.047,.095],[.05,.045],[.041,-.008],[.019,-.026],[0,-.055],[-.019,-.026],[-.041,-.008]], .014);
  plate(medallion, m.steel, [[-.018,.035],[.018,.035],[.012,-.019],[0,-.047],[-.012,-.019]], .018, [0,0,.014], .002);
  for (const side of [-1, 1]) rod(medallion, m.black, [side*.014,.037,.03], [side*.034,.044,.024], .005, .005, 4);

  // Both sword hilts sit above the shoulder, as in the supplied reference.
  const mounts = {
    steel: group(body, 'steel-back-mount', [-.32, 1.94, -.235]),
    silver: group(body, 'silver-back-mount', [.13, 1.98, -.275]),
    dagger: group(body, 'dagger-hip-mount', [.306, 1.12, .038])
  };
  mounts.steel.rotation.set(-.03, 0, .16);
  mounts.silver.rotation.set(-.03, 0, -.34);
  mounts.dagger.rotation.set(.1, .8, .27);
  const weapons = {}, sheaths = {};
  for (const type of ['steel', 'silver', 'dagger']) {
    sheaths[type] = scabbard(mounts[type], m, type);
    weapons[type] = makeSword(m, type); mounts[type].add(weapons[type]);
  }
  let pose = 'sheathed', disposed = false;
  function setPose(next) {
    if (!GERALT_POSES.includes(next)) throw new RangeError(`Unknown Geralt pose: ${next}`);
    pose = next;
    armR.rotation.set(0, 0, 0); armL.rotation.set(0, 0, 0);
    for (const type of ['steel', 'silver', 'dagger']) {
      mounts[type].add(weapons[type]); weapons[type].position.set(0, 0, 0); weapons[type].rotation.set(0, 0, 0);
    }
    if (pose !== 'sheathed') {
      gripAnchor.add(weapons[pose]);
      weapons[pose].position.y = pose === 'dagger' ? -.085 : -.135;
      armR.rotation.set(-.57, 0, -.20);
      armL.rotation.x = -.12;
    }
    root.userData.pose = pose;
  }
  function dispose() {
    if (disposed) return;
    disposed = true;
    const geometries = new Set(), materials = new Set(), textures = new Set();
    root.traverse(object => {
      if (object.geometry) geometries.add(object.geometry);
      if (object.material) (Array.isArray(object.material) ? object.material : [object.material]).forEach(value => materials.add(value));
    });
    Object.values(m).forEach(value => materials.add(value));
    materials.forEach(value => {if (value.map) textures.add(value.map); value.dispose();});
    textures.forEach(value => value.dispose()); geometries.forEach(value => value.dispose());
  }
  setPose('sheathed');
  return {root, weapons, sheaths, mounts, setPose, dispose, get pose() {return pose;}};
}
