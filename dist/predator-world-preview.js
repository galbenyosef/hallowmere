import * as T from './vendor/three.core.js';
import {createPredatorCharacter} from './predator-model.js';

// A visual actor in the safe village square; it never enters the combat roster.
export function createPredatorWorldPreview({scene,player}){
  const character=createPredatorCharacter(),root=character.root;
  root.position.set(-68.5,0,2.5);
  root.rotation.y=.58;
  root.scale.setScalar(1.12);
  scene.add(root);

  const ring=new T.Mesh(new T.RingGeometry(.72,.75,48),new T.MeshBasicMaterial({color:0xb3a174,transparent:true,opacity:.6,depthWrite:false}));
  ring.rotation.x=-Math.PI/2;ring.position.y=.025;root.add(ring);
  const light=new T.PointLight(0xc4d9d5,18,7,2);
  light.position.set(1,3.5,2);root.add(light);

  const label=document.createElement('div');label.className='predator-world-label';
  label.innerHTML='<strong>Predator</strong><span>CHARACTER PREVIEW</span>';
  document.getElementById('world-labels').append(label);
  const panel=document.createElement('aside');panel.className='predator-world-panel';
  panel.setAttribute('aria-label','Predator game preview');
  panel.innerHTML=`<span class="eyebrow">ENEMY PREVIEW</span><h2>Predator</h2><p>Meet the hunter beside Ashwick’s square. Use WASD or click the ground to walk around him.</p><div class="predator-world-options"><button type="button" data-predator-mask aria-pressed="false">Remove mask</button><label>Equipment<select aria-label="Predator equipment pose"><option value="blades">Wrist blades</option><option value="aim">Shoulder cannon</option><option value="stalk">At rest</option></select></label></div><a href="./predator-study.html">Open character sheet ↗</a><span class="predator-preview-note">Visual preview · Encounter pending</span>`;
  document.getElementById('game').append(panel);
  document.body.classList.add('predator-world-preview');
  const maskButton=panel.querySelector('[data-predator-mask]');
  maskButton.onclick=()=>{
    const unmasked=character.appearance==='masked';
    character.setAppearance(unmasked?'unmasked':'masked');
    maskButton.textContent=unmasked?'Wear mask':'Remove mask';
    maskButton.setAttribute('aria-pressed',String(unmasked));
  };
  panel.querySelector('select').onchange=event=>character.setPose(event.target.value);
  const headPosition=new T.Vector3();
  let disposed=false;
  return {root,update(camera){
    headPosition.copy(root.position).add(new T.Vector3(0,3.65,0)).project(camera);
    const nearby=Math.hypot(player.position.x-root.position.x,player.position.z-root.position.z)<18;
    label.hidden=!nearby||Math.abs(headPosition.x)>.96||Math.abs(headPosition.y)>.85||headPosition.z>1;
    if(!label.hidden){label.style.left=`${(headPosition.x*.5+.5)*innerWidth}px`;label.style.top=`${(-headPosition.y*.5+.5)*innerHeight}px`;}
  },dispose(){
    if(disposed)return;disposed=true;
    root.removeFromParent();character.dispose();label.remove();panel.remove();
    document.body.classList.remove('predator-world-preview');
  }};
}
