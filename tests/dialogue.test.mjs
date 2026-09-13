import test from 'node:test';
import assert from 'node:assert/strict';
import {createState} from '../dist/combat.js';
import {createCampaign, npcDialogue, performNpcAction} from '../dist/campaign.js';
import {dialogueMarkup, handleDialogueKey} from '../dist/dialogue.js';

const game = () => Object.assign(createState(), createCampaign(17), {gold:300, potions:4});

test('dialogue prices and availability follow the actual merchant transaction at every tier', () => {
  const state = game();
  for (const cost of [30,60,90]) {
    const choice = npcDialogue(state, 'brann').choices[0], before = state.gold;
    assert.equal(choice.cost, cost);
    assert.equal(choice.disabled, false);
    assert.equal(performNpcAction(state, 'brann', choice.action).ok, true);
    assert.equal(before - state.gold, choice.cost);
  }
  let choices = npcDialogue(state, 'brann').choices;
  assert.equal(choices[0].cost, undefined);
  assert.equal(choices[0].disabled, true);
  assert.match(choices[0].disabledReason, /Maximum upgrade/);
  const before = state.gold;
  assert.equal(performNpcAction(state, 'brann', choices[1].action).ok, true);
  assert.equal(before - state.gold, choices[1].cost);
  assert.equal(npcDialogue(state, 'brann').choices[1].disabledReason, 'Draught belt is full');
  state.gold=8; state.forgeLevel=0; state.potions=4;
  choices=npcDialogue(state,'brann').choices;
  assert.ok(choices.every(choice => choice.disabled));
  assert.match(choices[0].disabledReason,/22 more crowns/);
  assert.match(choices[1].disabledReason,/4 more crowns/);
});

test('every conversation numbers its services and close action, including conversations with no services', () => {
  const state = game();
  for (const id of ['rowan','edda','brann','rook']) {
    const data=npcDialogue(state,id), markup=dialogueMarkup(data,state);
    assert.equal((markup.match(/data-service=/g)||[]).length,data.choices.length);
    assert.equal((markup.match(/data-dialogue-close/g)||[]).length,1);
    assert.match(markup,new RegExp(`data-dialogue-close data-response-number="${data.choices.length+1}"`));
    assert.doesNotMatch(markup,/primary-button/);
  }
  performNpcAction(state,'rowan','accept-quest');
  const markup=dialogueMarkup(npcDialogue(state,'rowan'),state);
  assert.doesNotMatch(markup,/data-service=/);
  assert.match(markup,/data-dialogue-close data-response-number="1"/);
  assert.match(dialogueMarkup(npcDialogue(state,'edda'),state),/>Free</);
  state.potions=4;
  assert.equal(npcDialogue(state,'rook').choices[0].detail,'+1 draught');
});

test('dialogue text is escaped and unavailable choices explain why without losing the price', () => {
  const state=game(); state.gold=0;
  const markup=dialogueMarkup(npcDialogue(state,'brann'),state);
  assert.match(markup,/data-service="forge"[^>]*disabled/);
  assert.match(markup,/Need 30 more crowns/);
  assert.match(markup,/>30 crowns</);
  const escaped=dialogueMarkup({text:'<img onerror="bad">',choices:[{action:'" onclick="bad',label:'<script>bad</script>',detail:'A & B'}]},state);
  assert.doesNotMatch(escaped,/<script>|<img| onclick="bad/);
  assert.match(escaped,/&lt;script&gt;/);
  assert.match(escaped,/A &amp; B/);
});

test('number keys activate once, disabled choices stay inert, and arrow navigation skips them', () => {
  const document={activeElement:null};
  const buttons=[false,true,false].map((disabled,index)=>({disabled,number:index+1,clicks:0,click(){this.clicks++;},focus(){document.activeElement=this;}}));
  const content={ownerDocument:document,querySelector(selector){return buttons.find(button=>selector===`[data-response-number="${button.number}"]`);},querySelectorAll(){return buttons.filter(button=>!button.disabled);}};
  const key=(key,extra={})=>{const event={key,prevented:false,stopped:false,preventDefault(){this.prevented=true;},stopPropagation(){this.stopped=true;},...extra};const handled=handleDialogueKey(event,content);return{handled,event};};
  assert.equal(key('1').handled,true); assert.equal(buttons[0].clicks,1);
  key('1',{repeat:true}); assert.equal(buttons[0].clicks,1);
  const disabled=key('2'); assert.equal(buttons[1].clicks,0); assert.ok(disabled.event.prevented&&disabled.event.stopped);
  document.activeElement=buttons[0]; key('ArrowDown'); assert.equal(document.activeElement,buttons[2]);
  key('ArrowDown'); assert.equal(document.activeElement,buttons[0]);
  key('End'); assert.equal(document.activeElement,buttons[2]);
  key('Home'); assert.equal(document.activeElement,buttons[0]);
  key('3'); assert.equal(buttons[2].clicks,1);
  assert.equal(key('Escape').handled,false); assert.equal(key('Tab').handled,false);
  assert.equal(key('1',{metaKey:true}).handled,false);
});
