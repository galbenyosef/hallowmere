// Presentation only: the running game session belongs to main.js.
export function createTitleScreen(root, {onBegin, onResume, onChangeCharacter}) {
 const q = id => root.querySelector(`#${id}`);
 const choices = [q('single-player'), q('multi-player')];
 let selectedMode = 'single-player';

 function selectMode(mode, focus = false) {
  if (!['single-player', 'multiplayer'].includes(mode)) return;
  selectedMode = mode;
  choices.forEach((button, i) => {
   const selected = i === (mode === 'single-player' ? 0 : 1);
   button.dataset.highlighted = String(selected);
   if (selected && focus) button.focus();
  });
 }
 function show(screen) {
  root.hidden = false;
  root.dataset.screen = screen;
  q('mode-choice').hidden = screen !== 'modes';
  q('main-menu-actions').hidden = screen !== 'main';
  q('loading-status').hidden = screen !== 'loading';
  q('loading-retry').hidden = true;
 }
 function updateSession({mode, canChangeCharacter, character,characterLocked=false}) {
  q('menu-change-character').disabled = !canChangeCharacter;
  q('menu-character-note').textContent = characterLocked?'This journey keeps its chosen character. Start another journey to play a different character.':canChangeCharacter
   ? `${character} · Your equipment and progress travel with you.`
   : 'Return to a sanctuary to change character.';
  q('loading-message').textContent = mode === 'multiplayer'
   ? 'The shared world keeps moving. Rest at a sanctuary to stay safe.'
   : 'Your adventure is paused. Pick up where you left off.';
 }
 choices.forEach((button, i) => {
  const mode = i === 0 ? 'single-player' : 'multiplayer';
  button.onpointerenter = () => selectMode(mode);
  button.onfocus = () => selectMode(mode);
  button.onclick = () => {
   if (root.hidden || root.dataset.screen !== 'modes') return;
   selectMode(mode);
   onBegin(mode);
  };
 });
 q('menu-resume').onclick = onResume;
 q('menu-change-character').onclick = onChangeCharacter;
 q('loading-retry').onclick = () => location.reload();
 root.addEventListener('keydown', event => {
  if (root.hidden) return;
  if (event.key === 'Escape' && root.dataset.screen === 'main') {
   event.preventDefault(); onResume(); return;
  }
  if (root.dataset.screen === 'modes' && choices.includes(event.target)) {
   const focusedMode = event.target === choices[0] ? 'single-player' : 'multiplayer';
   if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End'].includes(event.key)) {
    event.preventDefault();
    selectMode(event.key === 'Home' ? 'single-player' : event.key === 'End' ? 'multiplayer' : focusedMode === 'single-player' ? 'multiplayer' : 'single-player', true);
   } else {
    // Keep the highlight with keyboard focus; native buttons handle Enter/Space.
    selectMode(focusedMode);
   }
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
  selectMode,
  showModes() {
   show('modes');
   q('loading-title').textContent = 'Choose game mode';
   q('loading-message').textContent = 'Play solo or join a multiplayer game.';
   selectMode(selectedMode, true);
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
