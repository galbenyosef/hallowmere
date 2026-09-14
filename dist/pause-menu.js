function switchMarkup(key,label,enabled){
 return `<button type="button" class="pause-setting" data-setting="${key}" role="switch" aria-label="${label}" aria-checked="${enabled}"><span>${label}</span><span class="pause-switch-state" aria-hidden="true"><span data-setting-value>${enabled?'On':'Off'}</span><i></i></span></button>`;
}

export function pauseMenuMarkup(settings,{journey=false}={}){
 return `<div class="pause-quick-actions"><button type="button" class="primary-button" data-resume-game>Resume game <kbd>Esc</kbd></button></div>
 ${journey?'<section class="pause-journey"><p>Autosave is always on, wherever you travel. Continue at your last checkpoint with your progression retained.</p><button type="button" class="primary-button" data-save-exit>Save & exit</button><span class="journey-save-status" data-save-status role="status"></span></section>':''}
 <section class="pause-settings" aria-labelledby="pause-settings-title"><h3 id="pause-settings-title">Sound & visuals</h3>
 ${switchMarkup('music','Music',settings.music)}
 <div class="pause-brightness"><label for="pause-brightness">Brightness</label><output for="pause-brightness" data-brightness-value>${settings.brightness}%</output><input id="pause-brightness" data-setting="brightness" type="range" min="75" max="135" step="5" value="${settings.brightness}" aria-valuetext="${settings.brightness}%"></div>
 ${switchMarkup('shadows','Shadows',settings.shadows)}
 ${switchMarkup('cameraShake','Camera shake',settings.cameraShake)}
 </section><p class="pause-credits">Music by <a href="https://www.scottbuckley.com.au" target="_blank" rel="noopener noreferrer">Scott Buckley</a> · <a href="./assets/music/CREDITS.txt" target="_blank" rel="noopener noreferrer">Credits & license</a></p>`;
}

export function bindPauseMenu(container,{onResume,onSetting,onSaveExit}){
 container.addEventListener('click',event=>{
  if(event.target.closest('[data-resume-game]')){onResume();return;}
  if(event.target.closest('[data-save-exit]')){onSaveExit?.();return;}
  const button=event.target.closest('button[data-setting]');
  if(!button)return;
  const enabled=button.getAttribute('aria-checked')!=='true';
  onSetting(button.dataset.setting,enabled);
  button.setAttribute('aria-checked',String(enabled));
  button.querySelector('[data-setting-value]').textContent=enabled?'On':'Off';
 });
 container.addEventListener('input',event=>{
  if(!event.target.matches('input[data-setting="brightness"]'))return;
  const value=Number(event.target.value);
  onSetting('brightness',value);
  container.querySelector('[data-brightness-value]').textContent=`${value}%`;
  event.target.setAttribute('aria-valuetext',`${value}%`);
 });
}
