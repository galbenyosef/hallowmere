import {escapeHtml} from './util.js';


export function dialogueMarkup(data, state) {
  const firstAvailable = data.choices.findIndex(choice => !choice.disabled);
  const responses = data.choices.map((choice, index) => {
    const detail = choice.disabledReason || choice.detail || '';
    const price = choice.cost === undefined ? choice.priceLabel : `${choice.cost} crowns`;
    return `<button class="dialogue-response${index === firstAvailable ? ' is-suggested' : ''}" data-service="${escapeHtml(choice.action)}" data-response-number="${index + 1}"${choice.disabled ? ' disabled' : ''}>
      <span class="dialogue-number" aria-hidden="true">${index + 1}.</span>
      <span class="dialogue-copy"><span class="dialogue-reply">${escapeHtml(choice.response || choice.label)}</span>${detail ? `<small>${escapeHtml(detail)}</small>` : ''}</span>
      ${price ? `<span class="dialogue-price">${escapeHtml(price)}</span>` : ''}
    </button>`;
  }).join('');
  return `<div class="dialogue-rule" aria-hidden="true"></div>
    <p class="npc-speech">“${escapeHtml(data.text)}”</p>
    <div class="dialogue-choices" aria-label="Available actions">${responses}
      <button class="dialogue-farewell" data-dialogue-close data-response-number="${data.choices.length + 1}"><span class="dialogue-number" aria-hidden="true">${data.choices.length + 1}.</span><span>Close conversation</span><kbd>Esc</kbd></button>
    </div>
    <div class="dialogue-resources"><span>${state.potions} / 5 draughts${state.potions >= 5 ? ' · Belt full' : ''}</span><span class="dialogue-crowns"><strong>${state.gold}</strong> crowns</span></div>`;
}

export function renderDialogue(content, data, state) {
  const focused = content.contains(content.ownerDocument.activeElement) ? content.ownerDocument.activeElement.closest('button') : null;
  const action = focused?.dataset.service;
  const wasFarewell = focused?.hasAttribute('data-dialogue-close');
  const scrollTop = content.closest('.modal')?.scrollTop;
  content.innerHTML = dialogueMarkup(data, state);
  if (focused) {
    const same = wasFarewell ? content.querySelector('[data-dialogue-close]') : [...content.querySelectorAll('[data-service]')].find(button => button.dataset.service === action && !button.disabled);
    (same || content.querySelector('.dialogue-response:not(:disabled), [data-dialogue-close]'))?.focus({preventScroll:true});
  }
  const modal = content.closest('.modal');
  if (modal && scrollTop !== undefined) modal.scrollTop = scrollTop;
}

// Numbered responses use the same click path as pointer input. Stop propagation
// so the game's 1/2/3 combat bindings cannot handle a conversation shortcut.
export function handleDialogueKey(event, content) {
  if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return false;
  const number = /^[1-9]$/.test(event.key);
  if (!number && !['ArrowUp','ArrowDown','Home','End'].includes(event.key)) return false;
  event.preventDefault();
  event.stopPropagation();
  if (number) {
    const button = content.querySelector(`[data-response-number="${event.key}"]`);
    if (!event.repeat && button && !button.disabled) button.click();
    return true;
  }
  const buttons = [...content.querySelectorAll('button:not(:disabled)')];
  if (!buttons.length) return true;
  const current = buttons.indexOf(content.ownerDocument.activeElement);
  const index = event.key === 'Home' ? 0 : event.key === 'End' ? buttons.length - 1 : current < 0 ? 0 : (current + (event.key === 'ArrowDown' ? 1 : -1) + buttons.length) % buttons.length;
  buttons[index].focus();
  return true;
}
