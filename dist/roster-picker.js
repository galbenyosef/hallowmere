import {CLASS_LIST,CLASSES,classAppearance} from './classes.js';
import {prepareCharacterPortraits,portraitFor} from './character-portraits.js';

export function createRosterPicker({getState,onChoose,onClose}){
 const dialog=document.createElement('dialog');dialog.className='roster-dialog';dialog.setAttribute('aria-labelledby','roster-title');
 dialog.innerHTML=`<header class="roster-header"><div><span class="eyebrow">HALLOWMERE · THE ASHEN VIGIL</span><h2 id="roster-title">Choose your calling</h2></div><button class="roster-close" aria-label="Close character selection">×</button></header><div class="roster-layout"><nav class="roster-classes" aria-label="Playable classes"></nav><div class="roster-portrait"><img alt=""><span class="roster-appearance-name"></span></div><section class="roster-description"><p class="eyebrow roster-role"></p><h3 class="roster-name"></h3><p class="roster-story"></p><div class="roster-stats"></div><dl class="roster-equipment"></dl><div class="roster-skills"></div></section></div><footer class="roster-footer"><p class="roster-note" role="status">Change class at any sanctuary. Your equipment and progress travel with you.</p><button class="primary-button roster-confirm">Enter the vigil</button></footer>`;
 document.body.append(dialog);
 const q=selector=>dialog.querySelector(selector);let chosen='sorcerer',pending=false,prepared=false;
 try{const saved=JSON.parse(localStorage.getItem('hallowmere.character-choice')||'null');if(saved&&Object.hasOwn(CLASSES,saved.classId)){chosen=saved.classId;}}catch{}
 q('.roster-classes').innerHTML=CLASS_LIST.map(c=>`<button data-class-choice="${c.id}" aria-pressed="false"><span>${c.name}</span><small>${c.role}</small></button>`).join('');
 function render(){
  const c=CLASSES[chosen],look=classAppearance(chosen,c.concept),image=portraitFor(chosen,c.concept);
  q('.roster-role').textContent=c.role;q('.roster-role').style.color=look?.color||c.color;q('.roster-name').textContent=c.name;q('.roster-story').textContent=c.description;
  q('.roster-stats').innerHTML=`<span><strong>${c.hp}</strong> Vitality</span><span><strong>${c.mana}</strong> Essence</span><span><strong>${c.speed.toFixed(1)}</strong> Speed</span>`;
  q('.roster-equipment').innerHTML=`<div><dt>Weapon</dt><dd>${look?.weapon||c.weapon}</dd></div><div><dt>Off hand</dt><dd>${look?.focus||c.focus}</dd></div>`;
  q('.roster-skills').innerHTML=['attack','bolt','dodge','nova'].map((key,i)=>{const s=c.abilities[key];return `<div><kbd>${['LMB','RMB','1','2'][i]}</kbd><p><strong>${s.name}</strong><span>${s.description}</span></p></div>`;}).join('');
  q('.roster-portrait img').hidden=!image;if(image)q('.roster-portrait img').src=image;q('.roster-portrait img').alt=`${look?.name||c.name} with ${look?.weapon||c.weapon}`;q('.roster-appearance-name').textContent=image?look?.name||c.name:'Preparing characters…';
  dialog.querySelectorAll('[data-class-choice]').forEach(b=>{b.setAttribute('aria-pressed',String(b.dataset.classChoice===chosen));b.disabled=pending;});
  q('.roster-confirm').disabled=pending||!prepared;q('.roster-confirm').textContent=pending?'Joining the vigil…':getState().classId?'Continue as '+c.name:'Enter the vigil';q('.roster-close').hidden=!getState().classId;
 }
 function close(){if(pending||!getState().classId)return;dialog.close();}
 dialog.addEventListener('click',event=>{const classButton=event.target.closest('[data-class-choice]');if(classButton&&!pending){chosen=classButton.dataset.classChoice;render();}});
 q('.roster-close').onclick=close;dialog.addEventListener('cancel',e=>{if(!getState().classId||pending)e.preventDefault();});dialog.addEventListener('close',onClose);
 q('.roster-confirm').onclick=()=>{const choice={classId:chosen,appearanceId:CLASSES[chosen].concept};if(onChoose(choice)){pending=true;q('.roster-note').textContent='Preparing your character…';render();}else q('.roster-note').textContent='Waiting for a connection. Try again when the vigil reconnects.';};
 return {get open(){return dialog.open;},async show(){const state=getState();if(CLASSES[state.classId]){chosen=state.classId;}pending=false;render();q('.roster-note').textContent='Change class at any sanctuary. Your equipment and progress travel with you.';dialog.showModal();q('[data-class-choice="'+chosen+'"]').focus();try{await prepareCharacterPortraits();prepared=true;render();}catch(error){console.error('Character preview failed',error);prepared=true;render();q('.roster-note').textContent='Character portraits are unavailable. You can still choose a class and enter the game.';}},resolve(result){if(!pending)return;pending=false;if(result.ok){try{localStorage.setItem('hallowmere.character-choice',JSON.stringify({classId:chosen,appearanceId:CLASSES[chosen].concept}));}catch{}dialog.close();}else{render();q('.roster-note').textContent=result.reason||'Could not select that class.';}}};
}
