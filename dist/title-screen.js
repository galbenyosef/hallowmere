// Presentation only: the running game session belongs to main.js.
export function createTitleScreen(root, {onResume, onChangeCharacter}) {
 const q = id => root.querySelector(`#${id}`);
 function show(screen) {
  root.hidden = false;
  root.dataset.screen = screen;
  q('main-menu-actions').hidden = screen !== 'main';
  q('loading-status').hidden = screen !== 'loading';
  q('loading-retry').hidden = true;
 }
 function updateSession({mode, canChangeCharacter, character}) {
  q('menu-change-character').disabled = !canChangeCharacter;
  q('menu-character-note').textContent = canChangeCharacter
   ? `${character} · Your equipment and progress travel with you.`
   : 'Return to a sanctuary to change character.';
  q('loading-message').textContent = mode === 'multiplayer'
   ? 'The shared world keeps moving. Rest at a sanctuary to stay safe.'
   : 'Your adventure is paused. Pick up where you left off.';
 }
 q('menu-resume').onclick = onResume;
 q('menu-change-character').onclick = onChangeCharacter;
 q('loading-retry').onclick = () => location.reload();
 root.addEventListener('keydown', event => {
  if (root.hidden) return;
  if (event.key === 'Escape' && root.dataset.screen === 'main') {
   event.preventDefault(); onResume(); return;
  }
  if (event.key === 'Tab') {
   const buttons = [...root.querySelectorAll('button:not(:disabled)')].filter(button => !button.closest('[hidden]') && button.tabIndex !== -1);
   if (!buttons.length) { event.preventDefault(); return; }
   const first = buttons[0], last = buttons.at(-1);
   if (event.shiftKey && event.target === first) { event.preventDefault(); last.focus(); }
   else if (!event.shiftKey && event.target === last) { event.preventDefault(); first.focus(); }
  }
 });
 return {
  // The loading scene doubles as the interstitial between the journeys menu and play.
  showLoading(message, title = 'Loading game') {
   show('loading');
   q('loading-title').textContent = title;
   if (message) q('loading-message').textContent = message;
  },
  showMainMenu(session) {
   show('main');
   q('loading-title').textContent = 'Main menu';
   updateSession(session);
   q('menu-resume').focus();
  },
  updateSession,
  hide() { root.hidden = true; },
  setProgress(value, message) {
   const percent = Math.round(Math.max(0, Math.min(100, value)));
   q('load-fill').style.width = `${percent}%`;
   q('load-track').setAttribute('aria-valuenow', String(percent));
   q('load-percent').textContent = `${percent}%`;
   if (message) q('loading-message').textContent = message;
  },
  showError() {
   show('loading');
   q('loading-title').textContent = 'The game could not load';
   q('loading-message').textContent = 'Please reload to try again.';
   q('loading-status').hidden = true;
   q('loading-retry').hidden = false;
   q('loading-retry').focus();
  }
 };
}
