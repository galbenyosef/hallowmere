import * as T from 'three';
import {createHuntKingCharacter} from './hunt-king-model.js';
import {createGeraltCharacter} from './geralt-character-model.js';

const $ = id => document.getElementById(id);
const stage = $('model-stage'), canvas = $('character-canvas');
const viewButtons = [...document.querySelectorAll('[data-view]')];
const poseButtons = [...document.querySelectorAll('[data-pose]')];
const controls = [...viewButtons, ...poseButtons, $('rotate-left'), $('rotate-right'), $('reset-view')];
const views = {
  'three-quarter': {label:'Three-quarter view',rotation:.35,eye:[0,3.6,9],target:[0,1.64,0],span:4.06},
  front: {label:'Front view',rotation:0,eye:[0,1.65,9],target:[0,1.65,0],span:4.05},
  side: {label:'Side view',rotation:-Math.PI/2,eye:[0,1.65,9],target:[0,1.65,0],span:4.05},
  back: {label:'Back view',rotation:Math.PI,eye:[0,1.65,9],target:[0,1.65,0],span:4.05},
  face: {label:'Crown & skull mask',rotation:.18,eye:[0,2.76,7],target:[0,2.76,0],span:1.50},
  game: {label:'Isometric game view',rotation:0,eye:[17,25,26],target:[0,1.4,0],span:9},
  compare: {label:'Boss & hero comparison',rotation:.20,eye:[0,3.9,10],target:[0,1.63,0],span:4.1}
};
const poses = {
  guard: ['Armored stance','Greatsword lowered, with both arms at rest. Inspect the rib plates, crown, and cloak.'],
  reach: ['Commanding reach','An open, clawed gauntlet reaches forward. The greatsword rests in the other hand.'],
  conjure: ['Conjured fire','A still study of ember light and sparks gathering in the palm. This previews appearance, not combat behavior.']
};
let renderer,scene,camera,king,geralt,pedestal,frame=0,activeView='three-quarter',stopped=false,pointer=null,observer;
const geometries=[],materials=[];
controls.forEach(button=>button.disabled=true);

function createPedestal() {
  const root=new T.Group(); root.name='king-study-platform';
  function add(geometry,material,xyz) {
    geometries.push(geometry); materials.push(material);
    const mesh=new T.Mesh(geometry,material); mesh.position.set(...xyz);mesh.receiveShadow=true;root.add(mesh);return mesh;
  }
  const stone=new T.MeshStandardMaterial({color:'#2c3b40',roughness:.96,flatShading:true});
  const iron=new T.MeshStandardMaterial({color:'#7f8374',metalness:.64,roughness:.53});
  add(new T.CylinderGeometry(1.08,1.15,.12,48),stone,[0,-.065,0]);
  const rim=add(new T.TorusGeometry(1.11,.009,4,64),iron,[0,-.006,0]);rim.rotation.x=Math.PI/2;
  for(let i=0;i<16;i++) {
    const a=i*Math.PI/8;
    const tick=add(new T.BoxGeometry(.008,.004,i%4?.05:.10),iron,[Math.sin(a)*1.02,.001,Math.cos(a)*1.02]);tick.rotation.y=a;
  }
  return root;
}
function requestRender() {
  if(!frame&&!stopped&&!document.hidden)frame=requestAnimationFrame(()=>{frame=0;if(!stopped&&!document.hidden)renderer.render(scene,camera);});
}
function updateCamera() {
  if(!renderer||stopped)return;
  const {width,height}=stage.getBoundingClientRect();if(!width||!height)return;
  const view=views[activeView],aspect=width/height;
  let span=view.span;
  camera.position.set(...view.eye);camera.lookAt(...view.target);camera.updateMatrixWorld(true);
  if(activeView==='face')span=Math.max(span,1.4/aspect);
  else if(activeView==='game')span=Math.max(span,4.5/aspect);
  else {
    // Fit actual model bounds in camera space, including reach and rotation,
    // so a wide sword or extended hand never clips on a narrow viewport.
    king.root.updateMatrixWorld(true);geralt.root.updateMatrixWorld(true);
    const bounds=new T.Box3().setFromObject(king.root);
    if(geralt.root.visible)bounds.union(new T.Box3().setFromObject(geralt.root));
    let horizontal=0,vertical=0;
    const point=new T.Vector3();
    for(const x of [bounds.min.x,bounds.max.x])for(const y of [bounds.min.y,bounds.max.y])for(const z of [bounds.min.z,bounds.max.z]) {
      point.set(x,y,z).applyMatrix4(camera.matrixWorldInverse);
      horizontal=Math.max(horizontal,Math.abs(point.x));vertical=Math.max(vertical,Math.abs(point.y));
    }
    span=Math.max(span,(horizontal*2+.3)/aspect,vertical*2+.30);
  }
  camera.left=-span*aspect/2;camera.right=span*aspect/2;camera.top=span/2;camera.bottom=-span/2;camera.updateProjectionMatrix();
  requestRender();
}
function resize() {
  if(!renderer||stopped)return;
  const {width,height}=stage.getBoundingClientRect();if(!width||!height)return;
  renderer.setPixelRatio(Math.min(devicePixelRatio||1,2));renderer.setSize(width,height,false);updateCamera();
}
function setView(view) {
  activeView=view;king.root.rotation.y=views[view].rotation;geralt.root.rotation.y=views[view].rotation;
  const comparison=view==='compare';
  geralt.root.visible=comparison;king.root.position.x=comparison?.77:0;geralt.root.position.x=-1.01;
  pedestal.scale.x=comparison?2:1;
  $('view-label').textContent=views[view].label;
  $('scale-indicator').textContent=comparison?'Shared world scale':view==='face'?'Helmet detail':view==='game'?'Game-scale readability':'Character detail';
  viewButtons.forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.view===view)));
  updateCamera();
}
function rotate(amount) {
  if(stopped)return;
  king.root.rotation.y+=amount;geralt.root.rotation.y+=amount;
  $('view-label').textContent=activeView==='compare'?'Boss & hero · custom angle':'Custom angle';
  viewButtons.forEach(button=>button.setAttribute('aria-pressed','false'));updateCamera();
}
function setPose(pose) {
  king.setPose(pose);poseButtons.forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.pose===pose)));
  $('pose-label').textContent=poses[pose][0];$('equipment-caption').textContent=poses[pose][1];updateCamera();
}
function fail(message) {
  stopped=true;cancelAnimationFrame(frame);frame=0;controls.forEach(button=>button.disabled=true);
  $('viewer-message').hidden=false;$('viewer-message').textContent=message;
}
function dispose() {
  stopped=true;cancelAnimationFrame(frame);frame=0;observer?.disconnect();king?.dispose();geralt?.dispose();
  new Set(geometries).forEach(g=>g.dispose());new Set(materials).forEach(m=>m.dispose());scene?.traverse(o=>{if(o.isLight)o.dispose?.();});renderer?.dispose();
}
try {
  renderer=new T.WebGLRenderer({canvas,antialias:true,alpha:true,powerPreference:'low-power'});
  renderer.setClearColor(0x121b23,0);renderer.outputColorSpace=T.SRGBColorSpace;renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.10;
  renderer.shadowMap.enabled=true;renderer.shadowMap.type=T.PCFSoftShadowMap;
  scene=new T.Scene();camera=new T.OrthographicCamera(-2,2,2,-2,.1,100);
  scene.add(new T.HemisphereLight(0xc1d4e1,0x443839,2));
  const key=new T.DirectionalLight(0xd0e0ee,3.6);key.position.set(-3,6,5);key.castShadow=true;key.shadow.mapSize.set(1024,1024);
  Object.assign(key.shadow.camera,{left:-4,right:4,top:5,bottom:-4,near:.1,far:20});key.shadow.normalBias=.018;key.shadow.bias=-.0003;scene.add(key);
  const fill=new T.DirectionalLight(0xe3bab1,1.5);fill.position.set(4,3,4);scene.add(fill);
  const rim=new T.DirectionalLight(0x91b5d1,2.6);rim.position.set(2,5,-4);scene.add(rim);
  pedestal=createPedestal();scene.add(pedestal);
  const groundGeometry=new T.PlaneGeometry(200,200),groundMaterial=new T.ShadowMaterial({opacity:.24});geometries.push(groundGeometry);materials.push(groundMaterial);
  const ground=new T.Mesh(groundGeometry,groundMaterial);ground.rotation.x=-Math.PI/2;ground.position.y=-.127;ground.receiveShadow=true;scene.add(ground);
  king=createHuntKingCharacter();geralt=createGeraltCharacter();geralt.root.visible=false;scene.add(king.root,geralt.root);
  setView('three-quarter');resize();$('viewer-message').hidden=true;controls.forEach(button=>button.disabled=false);
  observer=new ResizeObserver(resize);observer.observe(stage);
}catch(error){console.error('King study could not initialize:',error);dispose();fail('The 3D preview could not start. Enable WebGL and reload this page. The design notes remain available.');}

viewButtons.forEach(button=>button.addEventListener('click',()=>setView(button.dataset.view)));
poseButtons.forEach(button=>button.addEventListener('click',()=>setPose(button.dataset.pose)));
$('rotate-left').addEventListener('click',()=>rotate(-Math.PI/6));$('rotate-right').addEventListener('click',()=>rotate(Math.PI/6));
$('reset-view').addEventListener('click',()=>{setPose('reach');setView('three-quarter');});
stage.addEventListener('keydown',event=>{
  if(stopped)return;
  if(event.key==='ArrowLeft'||event.key==='ArrowRight'){event.preventDefault();rotate((event.key==='ArrowLeft'?-1:1)*Math.PI/12);}
  else if(event.key==='Home'){event.preventDefault();setView('three-quarter');}
});
stage.addEventListener('pointerdown',event=>{if(stopped||!event.isPrimary||event.button!==0)return;pointer={id:event.pointerId,x:event.clientX};stage.setPointerCapture(event.pointerId);});
stage.addEventListener('pointermove',event=>{if(pointer?.id!==event.pointerId)return;rotate((event.clientX-pointer.x)*.012);pointer.x=event.clientX;});
for(const type of ['pointerup','pointercancel','lostpointercapture'])stage.addEventListener(type,()=>{pointer=null;});
// Effects are deliberately still: only interactions or resizing render a frame.
// Reduced-motion users see exactly the same design without an animation loop.
matchMedia('(prefers-reduced-motion: reduce)').addEventListener('change',requestRender);
document.addEventListener('visibilitychange',()=>{pointer=null;if(document.hidden){cancelAnimationFrame(frame);frame=0;}else requestRender();});
canvas.addEventListener('webglcontextlost',event=>{event.preventDefault();fail('The 3D view lost its graphics connection. Reload this page to restore the king.');});
window.addEventListener('pagehide',event=>{if(!event.persisted)dispose();});window.addEventListener('pageshow',event=>{if(event.persisted)resize();});
