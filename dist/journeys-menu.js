import {CLASSES} from './classes.js';
import {CHECKPOINTS,mapFor} from './regions.js';
import {prepareCharacterPortraits,portraitFor} from './character-portraits.js';

import {escapeHtml} from './util.js';
const escape = escapeHtml;
const duration=seconds=>{const minutes=Math.floor((seconds||0)/60);return minutes<60?`${minutes}m played`:`${Math.floor(minutes/60)}h ${minutes%60}m played`;};
const savedTime=time=>{const date=new Date(time);return Number.isFinite(date.getTime())?new Intl.DateTimeFormat(undefined,{month:'short',day:'numeric',hour:'numeric',minute:'2-digit'}).format(date):'an earlier session';};
const checkpoint=s=>CHECKPOINTS.find(c=>c.id===s.checkpointId)?.name||'Ashwick';

export function createJourneysMenu({store,onNew,onContinue,onBack}){
 const dialog=document.createElement('dialog');dialog.className='chronicle-shell journeys-dialog';dialog.setAttribute('aria-labelledby','journeys-title');
 dialog.innerHTML=`<aside class="chronicle-sidebar"><div class="chronicle-brand"><img src="./assets/menu/hallowmere-wordmark.png" alt="Hallowmere"><span>THE ASHEN VIGIL</span></div><nav aria-label="Journey menu"><button aria-current="page" type="button">Journeys</button><button data-back type="button">Back to main menu</button></nav><p class="chronicle-sidebar-note">A light against the dark.</p></aside>
 <div class="chronicle-main"><header class="chronicle-heading journeys-heading"><div><span class="eyebrow">SINGLE PLAYER</span><h2 id="journeys-title">Your journeys</h2><p>A character. A world. A story of your own.</p></div><button class="primary-button" data-new>New journey <span aria-hidden="true">+</span></button></header>
 <p class="journeys-status" role="status" aria-live="polite"></p><div class="journeys-content"></div><footer class="journeys-footer"><span>Autosave is always on. Continue at your last checkpoint.</span><span>Saved in this browser · Clearing site data removes journeys.</span></footer></div>`;
 const action=document.createElement('dialog');action.className='journey-action-dialog';action.setAttribute('aria-labelledby','journey-action-title');
 document.body.append(dialog,action);
 const q=selector=>dialog.querySelector(selector);let records=[],selected=null,busy=false,generation=0,conflictOpen=false;
 action.addEventListener('cancel',event=>{if(conflictOpen)event.preventDefault();});
 function status(message,error=false){q('.journeys-status').textContent=message;q('.journeys-status').classList.toggle('is-error',error);}
 function selectedRecord(){return records.find(r=>r.id===selected);}
 function portrait(s){const src=portraitFor(s.classId,s.appearanceId);return src?`<img src="${escape(src)}" alt="" draggable="false">`:'';}
 function render(){
  const content=q('.journeys-content');q('[data-new]').disabled=busy;
  if(!records.length){content.innerHTML='<div class="journeys-empty"><span class="chronicle-label">THE ROAD AHEAD</span><h3>Your first journey awaits</h3><p>Choose a character to begin. Their level, belongings, and progress will be saved as you play.</p><button class="primary-button" data-new>Begin a new journey</button></div>';return;}
  const record=selectedRecord()||records[0];selected=record.id;const s=record.summary||{},hero=CLASSES[s.classId];
  const bosses=Number(!!s.victory)+Object.values(s.regionProgress||{}).filter(p=>p?.bossDefeated).length;
  content.innerHTML=`<div class="journeys-list" role="group" aria-label="Saved journeys">${records.map(r=>{const summary=r.summary||{};return `<button class="journey-row" data-journey="${escape(r.id)}" aria-pressed="${r.id===selected}" ${busy?'disabled':''}><span class="journey-thumb">${portrait(summary)}</span><span class="journey-row-copy"><strong>${escape(r.name)}</strong><span>${escape(CLASSES[summary.classId]?.name||'Character unavailable')} <i>·</i> Level ${escape(summary.level||1)}</span><small>${escape(mapFor(summary.mapId).name)} <i>·</i> ${duration(summary.playtime)}</small><small>Saved ${savedTime(r.savedAt)}</small></span></button>`;}).join('')}</div>
  <section class="journey-detail" aria-label="Selected journey"><div class="journey-hero"><div class="journey-hero-copy"><span class="chronicle-label">${escape(hero?.role||'YOUR CALLING')}</span><h3>${escape(hero?.name||'Unknown character')}</h3><span class="journey-level">LEVEL <strong>${escape(s.level||1)}</strong></span></div><div class="journey-portrait">${portrait(s)}</div></div>
  <div class="journey-detail-copy"><div class="journey-milestones"><div><strong>${escape(mapFor(s.mapId).name)}</strong><span>Last explored</span></div><div><strong>${bosses} / 4</strong><span>Guardians defeated</span></div></div><div class="journey-objective"><span class="chronicle-label">${s.campaignComplete?'JOURNEY COMPLETE':'CURRENT OBJECTIVE'}</span><p>${escape(s.campaignComplete?'The Forsaken Reach is free.':s.objective||'Speak to Elder Rowan')}</p></div>
  <p class="journey-return">Return to <strong>${escape(checkpoint(s))}</strong> with your progression retained.</p><button class="primary-button journey-continue" data-continue ${busy?'disabled':''}>${busy?'Opening journey…':'Continue journey'}</button><div class="journey-manage"><button class="text-button" data-rename ${busy?'disabled':''}>Rename</button><button class="text-button" data-delete ${busy?'disabled':''}>Delete journey</button></div></div></section>`;
 }
 async function refresh(){
  const current=++generation;status('Opening your journeys…');busy=true;q('[data-new]').disabled=true;q('.journeys-content').inert=true;
  try{const saved=await store.list();if(current!==generation||!dialog.open)return;records=saved;status('');}
  catch(error){if(current!==generation||!dialog.open)return;status(error.message,true);q('.journeys-content').inert=false;q('.journeys-content').innerHTML='<div class="journeys-empty"><h3>Your journeys are unavailable</h3><p>Enable browser storage or free up space, then try again.</p><button class="primary-button" data-retry>Retry</button></div>';q('[data-new]').disabled=true;busy=false;return;}
  busy=false;q('.journeys-content').inert=false;render();q(selected?'[data-journey][aria-pressed="true"]':'[data-new]')?.focus({preventScroll:true});
  prepareCharacterPortraits().then(()=>{if(current===generation&&dialog.open){const focus=document.activeElement?.dataset?.journey;render();if(focus)q(`[data-journey="${focus}"]`)?.focus({preventScroll:true});}}).catch(()=>{});
 }
 function close(){generation++;dialog.close();}
 function manage(kind){
  const r=selectedRecord();if(!r)return;const deleting=kind==='delete';
  action.innerHTML=`<form><span class="chronicle-label">YOUR JOURNEY</span><h2 id="journey-action-title">${deleting?'Delete journey?':'Rename journey'}</h2>${deleting?`<p>Delete <strong>${escape(r.name)}</strong> and all of its saved progress? This cannot be undone.</p>`:`<label for="journey-name">Journey name</label><input id="journey-name" name="name" maxlength="48" required value="${escape(r.name)}" autocomplete="off">`}<p role="status"></p><div class="journey-action-buttons"><button type="button" class="text-button" data-cancel>Cancel</button><button class="primary-button" type="submit">${deleting?'Delete journey':'Save name'}</button></div></form>`;
  action.querySelector('[data-cancel]').onclick=()=>action.close();
  action.querySelector('form').onsubmit=async event=>{event.preventDefault();const submit=action.querySelector('[type="submit"]');submit.disabled=true;
   try{if(deleting)await store.remove(r.id);else await store.rename(r.id,action.querySelector('input').value);action.close();await refresh();}
   catch(error){action.querySelector('[role="status"]').textContent=error.message;submit.disabled=false;}
  };
  action.showModal();if(deleting)action.querySelector('[data-cancel]').focus();else action.querySelector('input').select();
 }
 dialog.addEventListener('cancel',event=>{event.preventDefault();if(!busy){close();onBack();}});
 dialog.addEventListener('click',async event=>{
  const button=event.target.closest('button');if(!button||button.disabled)return;
  if(button.hasAttribute('data-retry')){refresh();return;}
  if(busy)return;
  if(button.hasAttribute('data-back')){close();onBack();}
  else if(button.hasAttribute('data-new')){close();onNew();}
  else if(button.dataset.journey){selected=button.dataset.journey;render();q(`[data-journey="${selected}"]`).focus({preventScroll:true});}
  else if(button.hasAttribute('data-rename'))manage('rename');
  else if(button.hasAttribute('data-delete'))manage('delete');
  else if(button.hasAttribute('data-continue')){
   busy=true;status('');render();
   try{await onContinue(selected);close();}catch(error){busy=false;render();status(error.message,true);q('[data-continue]')?.focus();}
  }
 });
 return {get open(){return dialog.open;},show(preferredId){if(preferredId)selected=preferredId;if(!dialog.open)dialog.showModal();return refresh();},close,
  showConflict(message,onReturn){
   conflictOpen=true;action.innerHTML=`<span class="chronicle-label">YOUR JOURNEY</span><h2 id="journey-action-title">Journey open elsewhere</h2><p>${escape(message)}</p><div class="journey-action-buttons"><button class="primary-button" type="button">Return to journeys</button></div>`;
   const button=action.querySelector('button');button.onclick=()=>{conflictOpen=false;action.close();onReturn();};action.showModal();button.focus();
  }
 };
}
