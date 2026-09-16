// connectionStatus and the three connection/restart-vote bindings moved verbatim out of
// main.js (M9); the bindings run inside the factory body at the position they held there, so
// registration order is the visible order of main.js's wiring block. Free identifiers:
// $ (./dom.js, connectionStatus and all three bindings). updateInventoryResources (./pouch.js,
// the inventory refresh inside connectionStatus). location (global, the retry reload).
// ctx.syncAudioState (M7's createGameAudio). ctx.releaseInput (M5's bindInput) and
// ctx.inventoryPreviews (M8's createInventoryUi) -- bare destructured bindings in main.js.
// ctx.returnToModeChoice/ctx.startSession (M9's createSessionLifecycle), read lazily inside the
// retry handler, so neither factory has to be wired before the other. ctx.state/ctx.sessionMode/
// ctx.lastSnapshot/ctx.mainMenuOpen/ctx.modalKind/ctx.rosterPicker/ctx.network (already-declared
// ctx data fields).
import {$} from './dom.js';
import {updateInventoryResources} from './pouch.js';
export function createConnectionUi(ctx){
 function connectionStatus(message,connected,{retryable=false,failed=false}={}){
  ctx.syncAudioState(connected);
  // A reconnect overlay must remain reachable while the main menu traps focus.
  if(ctx.mainMenuOpen){const wasInert=$('loading').inert;$('loading').inert=!connected;if(connected&&wasInert&&!ctx.rosterPicker?.open)$('menu-resume').focus();}
  const el=$('multiplayer-status');if(el.textContent!==message)el.textContent=message;el.hidden=!connected||ctx.sessionMode==='single-player';$('connection-back').hidden=!!ctx.lastSnapshot;$('connection-overlay').hidden=connected;if(!connected){ctx.inventoryPreviews.hide();$('connection-title').textContent=failed?'Unable to connect':ctx.lastSnapshot?'Reconnecting to game':'Loading game';$('connection-message').textContent=message;$('connection-spinner').hidden=failed;$('connection-retry').hidden=!retryable;if(ctx.modalKind==='inventory')updateInventoryResources($('modal-content').closest('.modal'),ctx.state,false);ctx.releaseInput();ctx.rosterPicker?.resolve({ok:false,reason:'Connection lost. Try again once connected.'});if(ctx.mainMenuOpen){const focusTarget=$(retryable?'connection-retry':'connection-title');focusTarget.tabIndex=retryable?0:-1;focusTarget.focus();}}}
 $('connection-retry').onclick=()=>{if(ctx.lastSnapshot){location.reload();return;}ctx.returnToModeChoice();ctx.startSession('multiplayer');};
 $('restart-yes').onclick=()=>ctx.network?.send('vote',{agree:true});
 $('restart-no').onclick=()=>ctx.network?.send('vote',{agree:false});
 return {connectionStatus};
}
