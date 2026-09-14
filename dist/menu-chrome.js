const destinations=[['character','Character','C'],['inventory','Inventory','I'],['journal','Journal','J'],['map','World map','M'],['help','Controls','H'],['pause','Game menu','Esc']];

export function menuNavigationMarkup(){
 return `<aside class="chronicle-sidebar"><div class="chronicle-brand"><img src="./assets/menu/hallowmere-wordmark.png" alt="Hallowmere"><span>THE ASHEN VIGIL</span></div><nav aria-label="Game menus">${destinations.map(([id,label,key])=>`<button type="button" data-menu="${id}"><span>${label}</span><kbd>${key}</kbd></button>`).join('')}</nav><p class="chronicle-sidebar-note">A light against the dark.</p></aside>`;
}

export function updateMenuNavigation(root,active,{disabled=false,canChangeCharacter=true,characterLocked=false}={}){
 for(const button of root.querySelectorAll('[data-menu]')){
  button.setAttribute('aria-current',button.dataset.menu===active?'page':'false');
  button.disabled=disabled||button.dataset.menu==='character'&&!canChangeCharacter;
  button.title=button.dataset.menu==='character'&&!canChangeCharacter?(characterLocked?'This journey keeps its chosen character. Start another journey to play a different character.':'Return to a sanctuary to change character.') :'';
 }
}
