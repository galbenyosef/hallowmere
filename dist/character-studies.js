import * as T from 'three';
import {roster} from './character-study-roster.js';
import {chosenClasses,chosenWizardDirections,chosenConcepts} from './character-study-selection.js';
import {createStudyScene,disposeStudy,addSkillEffect,animateEffect} from './character-study-models.js';

const $=id=>document.getElementById(id);
// Seed this review round with the picks submitted in the conversation. Later
// browser edits remain editable without changing the recorded chosen roster.
const STORAGE_KEY='hallowmere.character-studies.shortlist.v2';
const validIds=new Set(roster.map(c=>c.id));
let selected=new Set(chosenConcepts);
try{const saved=JSON.parse(localStorage.getItem(STORAGE_KEY)||'null');if(Array.isArray(saved))selected=new Set(saved.filter(id=>validIds.has(id)));}catch{/* Browsing remains available when storage is restricted. */}
let collection='chosen',active=null,study=null,renderer,frame=0,gameScale=false,front=false,noticeTimer;
const portraits=new Map(),camera=new T.OrthographicCamera(-2,2,2,-2,.1,30);
const reducedMotion=matchMedia('(prefers-reduced-motion: reduce)');

function notify(message){$('notice').textContent=message;$('notice').classList.add('show');clearTimeout(noticeTimer);noticeTimer=setTimeout(()=>$('notice').classList.remove('show'),2600);}
function collectionItems(){return collection==='chosen'?chosenConcepts.map(id=>roster.find(c=>c.id===id)):roster.filter(c=>collection==='shortlist'?selected.has(c.id):c.collection===collection);}
function updateSelection(){
  $('shortlist-count').textContent=selected.size;
  const picks=roster.filter(c=>selected.has(c.id));
  $('selection-summary').textContent=picks.length?picks.map(c=>`${c.id} ${c.name}`).join(' · '):'No characters saved yet';
  $('copy-picks').disabled=!picks.length;
  for(const card of document.querySelectorAll('.character-card')){
    const saved=selected.has(card.dataset.id);card.classList.toggle('saved',saved);const button=card.querySelector('.save-button');button.textContent=saved?'Saved ✓':'+ Shortlist';button.setAttribute('aria-pressed',String(saved));
  }
  if(active){const saved=selected.has(active.id);$('save-detail').textContent=saved?'Remove from shortlist':'Add to shortlist';$('save-detail').setAttribute('aria-pressed',String(saved));}
}
function toggleSelection(id){
  if(selected.has(id))selected.delete(id);else selected.add(id);
  try{localStorage.setItem(STORAGE_KEY,JSON.stringify([...selected]));}catch{notify('Picks are kept for this visit. Browser storage is unavailable.');}
  if(collection==='shortlist')renderGallery();else updateSelection();
}
function renderGallery(){
  const titles={chosen:['The chosen roster','Six classes, with Mire Witch, Bone Oracle, and Storm Hermit as Sorcerer appearance directions.'],wizards:['The arcane calling','Cloth, crooked staffs, and unmistakable spellcaster silhouettes.'],classes:['Ten ways to keep the vigil','Distinct weapons, silhouettes, and reasons to join the party.'],shortlist:['Your shortlist','Your editable shortlist for the next round of refinement.']};
  $('collection-title').textContent=titles[collection][0];$('collection-description').textContent=titles[collection][1];
  for(const button of document.querySelectorAll('[data-collection]'))button.setAttribute('aria-pressed',String(button.dataset.collection===collection));
  const items=collectionItems();$('empty').hidden=items.length>0;
  const card=c=>`<article class="character-card" data-id="${c.id}" style="--accent:${c.color}">
    <button class="portrait" data-inspect="${c.id}" aria-label="Inspect ${c.id}, ${c.name}"><img src="${portraits.get(c.id)||''}" alt="${c.name}: ${c.description}" width="500" height="440"><span class="number">${c.id}</span><span class="inspect-label">Inspect character</span></button>
    <div class="card-copy"><p class="role">${c.role}</p><h3>${c.name}</h3><p class="card-description">${c.description}</p><div class="card-footer"><span class="weapon-label">${c.weapon}</span><button class="save-button" data-save="${c.id}" aria-label="Shortlist ${c.id}, ${c.name}" aria-pressed="false">+ Shortlist</button></div></div>
  </article>`;
  if(collection==='chosen'){
    $('gallery').innerHTML=`<div class="roster-group"><h3>Selected classes</h3><p>Six combat identities, each with its own weapon and proposed skill kit.</p></div>`+
      items.filter(c=>chosenClasses.includes(c.id)).map(card).join('')+
      `<div class="roster-group appearance-group"><h3>Sorcerer appearance directions</h3><p>Three selected looks to develop for the Sorcerer. Each retains its chosen staff and off-hand focus.</p></div>`+
      items.filter(c=>chosenWizardDirections.includes(c.id)).map(card).join('');
  }else $('gallery').innerHTML=items.map(card).join('');
  updateSelection();
}
function setCamera(width,height,thumbnail=false){
  const view=gameScale&&!thumbnail?9:3.5,aspect=width/height;
  camera.left=-view*aspect/2;camera.right=view*aspect/2;camera.top=view/2;camera.bottom=-view/2;
  if(front&&!thumbnail)camera.position.set(0,2.4,7);else camera.position.set(3.2,3.2,6.2);
  camera.lookAt(0,1.27,0);camera.updateProjectionMatrix();
}
async function makePortraits(){
  renderer=new T.WebGLRenderer({antialias:true,alpha:true,preserveDrawingBuffer:true});
  renderer.setClearColor(0x101d23,0);renderer.setPixelRatio(1);renderer.setSize(500,440,false);renderer.outputColorSpace=T.SRGBColorSpace;renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.05;renderer.shadowMap.enabled=true;renderer.shadowMap.type=T.PCFSoftShadowMap;
  setCamera(500,440,true);
  for(const c of roster){
    const preview=createStudyScene(c);renderer.render(preview.scene,camera);portraits.set(c.id,renderer.domElement.toDataURL('image/webp',.92));disposeStudy(preview);
    $('loading').textContent=`Summoning the roster… ${portraits.size} / ${roster.length}`;
    // Yield between models so the interface stays responsive on slower devices.
    await new Promise(resolve=>setTimeout(resolve,0));
  }
  $('loading').hidden=true;renderGallery();
}
function resizeInspector(){
  if(!study||!$('inspector').open)return;
  const rect=$('model-stage').getBoundingClientRect();if(!rect.width||!rect.height)return;
  renderer.setPixelRatio(Math.min(devicePixelRatio,2));renderer.setSize(rect.width,rect.height,false);setCamera(rect.width,rect.height);
}
function animate(time){
  if(!study||!$('inspector').open){frame=0;return;}
  if(document.hidden){frame=0;return;}
  if(!reducedMotion.matches){study.root.rotation.z=Math.sin(time*.0016)*.007;study.glow.intensity=1.4+Math.sin(time*.002)*.15;}
  animateEffect(study,time);renderer.render(study.scene,camera);
  const label=new T.Vector3(0,gameScale?3.1:2.94,0).project(camera),rect=$('model-stage').getBoundingClientRect();
  $('model-nameplate').style.top=`${$('model-stage').offsetTop+(1-label.y)*rect.height/2-12}px`;
  frame=requestAnimationFrame(animate);
}
function openInspector(id){
  if(!portraits.has(id))return;
  active=roster.find(c=>c.id===id);if(study)disposeStudy(study);study=createStudyScene(active);gameScale=false;front=false;
  $('detail-id').textContent=`${active.id} / ${active.collection==='wizards'?'Wizard direction':'Character class'}`;
  $('detail-name').textContent=active.name;$('detail-role').textContent=active.role;$('detail-role').style.color=active.color;
  $('detail-story').textContent=active.story;$('detail-weapon').textContent=active.weapon;$('detail-focus').textContent=active.focus;$('detail-style').textContent=active.style;
  $('model-nameplate').textContent=`You · ${active.name}`;
  $('skills').innerHTML=active.skills.map((s,i)=>`<button class="skill" data-skill="${i}" aria-pressed="false"><span class="key">${['LMB','1','2'][i]}</span><span><strong>${s.name}</strong><small>${s.description}</small></span></button>`).join('');
  $('effect-note').textContent='Select a skill to preview its visual effect. Combat values are not implemented in this study.';
  $('scale-label').textContent='Character detail';$('game-scale').setAttribute('aria-pressed','false');$('view-angle').textContent='Front view';
  $('model-stage').setAttribute('aria-label',`3D preview of ${active.name}. Drag horizontally or use the rotate buttons to turn the model.`);
  $('model-stage').append(renderer.domElement);$('inspector').showModal();$('inspector').scrollTop=0;resizeInspector();updateSelection();
  if(!frame)frame=requestAnimationFrame(animate);
}
function playSkill(index){
  if(!study)return;const skill=active.skills[index];addSkillEffect(study,active.color,skill.effect);
  document.querySelectorAll('.skill').forEach((button,i)=>button.setAttribute('aria-pressed',String(i===index)));
  $('effect-note').textContent=`Previewing ${skill.name}. This is a visual effect study; the proposed combat behavior is described above.`;
}

document.querySelector('.tabs').addEventListener('click',event=>{const button=event.target.closest('[data-collection]');if(!button)return;collection=button.dataset.collection;renderGallery();});
$('gallery').addEventListener('click',event=>{const inspect=event.target.closest('[data-inspect]'),save=event.target.closest('[data-save]');if(inspect)openInspector(inspect.dataset.inspect);else if(save)toggleSelection(save.dataset.save);});
$('save-detail').addEventListener('click',()=>toggleSelection(active.id));
$('close-inspector').addEventListener('click',()=>$('inspector').close());
$('inspector').addEventListener('click',event=>{if(event.target===$('inspector')){const r=$('inspector').getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)$('inspector').close();}});
$('inspector').addEventListener('close',()=>{cancelAnimationFrame(frame);frame=0;if(study){disposeStudy(study);study=null;}active=null;});
$('skills').addEventListener('click',event=>{const button=event.target.closest('[data-skill]');if(button)playSkill(Number(button.dataset.skill));});
$('turn-left').addEventListener('click',()=>{if(study)study.root.rotation.y-=Math.PI/6;});
$('turn-right').addEventListener('click',()=>{if(study)study.root.rotation.y+=Math.PI/6;});
$('view-angle').addEventListener('click',()=>{front=!front;study.root.rotation.y=front?0:.12;$('view-angle').textContent=front?'Isometric view':'Front view';resizeInspector();});
$('game-scale').addEventListener('click',()=>{gameScale=!gameScale;$('game-scale').setAttribute('aria-pressed',String(gameScale));$('scale-label').textContent=gameScale?'Game-scale readability':'Character detail';resizeInspector();});
let pointer=null;
$('model-stage').addEventListener('pointerdown',event=>{pointer={id:event.pointerId,x:event.clientX};$('model-stage').setPointerCapture(event.pointerId);});
$('model-stage').addEventListener('pointermove',event=>{if(pointer?.id===event.pointerId&&study){study.root.rotation.y+=(event.clientX-pointer.x)*.014;pointer.x=event.clientX;}});
for(const type of ['pointerup','pointercancel','lostpointercapture'])$('model-stage').addEventListener(type,()=>{pointer=null;});
new ResizeObserver(resizeInspector).observe($('model-stage'));
document.addEventListener('visibilitychange',()=>{if(!document.hidden&&study&&!frame)frame=requestAnimationFrame(animate);});
$('copy-picks').addEventListener('click',async()=>{
  const sections=[['Wizard directions','wizards'],['Character classes','classes']];
  const text='Hallowmere character picks\n\n'+sections.map(([name,key])=>{const picks=roster.filter(c=>c.collection===key&&selected.has(c.id));return picks.length?name+'\n'+picks.map(c=>`${c.id} — ${c.name} (${c.weapon}; ${c.focus})`).join('\n'):'';}).filter(Boolean).join('\n\n');
  try{await navigator.clipboard.writeText(text);notify('Picks copied. Paste them into our conversation.');}catch{
    const field=document.createElement('textarea');field.value=text;field.style.cssText='position:fixed;left:0;top:0;opacity:0';document.body.append(field);field.select();const copied=document.execCommand('copy');field.remove();notify(copied?'Picks copied. Paste them into our conversation.':'Clipboard unavailable. Your saved character IDs are shown in the shortlist.');
  }
});
// Avoid generating empty image URLs if a collection is opened during startup.
document.querySelectorAll('[data-collection]').forEach(button=>button.disabled=true);
updateSelection();
try{await makePortraits();document.querySelectorAll('[data-collection]').forEach(button=>button.disabled=false);}
catch(error){console.error('Character studies could not initialize:',error);$('loading').hidden=false;$('loading').textContent='The 3D gallery could not start. Enable WebGL in your browser and reload this page.';}
