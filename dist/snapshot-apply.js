// applySnapshot moved verbatim out of main.js (M10). It is the client's one entry point for a
// server snapshot, and its statement order is load-bearing: the `!me` early return, the
// first-snapshot key deletion before the Object.assign merge, ctx.switchMap ahead of that
// merge, and the event watermark all sit exactly where they did in main.js. Not one statement
// moved; see tests/snapshot-apply.test.mjs for the five scenarios that pin that order.
//
// Free identifiers: $ (./dom.js, the restart-vote and inventory lookups), classFor
// (./classes.js, the connection status line), mapFor (./regions.js), predictedPosition
// (./multiplayer-client.js), usesLegacyTelegraph (./region-client-ui.js) and
// updateInventoryResources (./pouch.js) stay plain imports; disposeActor
// (./multiplayer-view.js) is re-imported through a `deps` escape hatch defaulting to that same
// import -- the only deviation from verbatim besides the ctx. renames below -- because
// tests/snapshot-apply.test.mjs drives plain-object enemies that have no three subtree to walk.
// JSON, Math, Object, Set and clearTimeout are globals.
//
// ctx renames for names that were bare module-scope bindings in main.js: ctx.releaseInput (x2,
// M5's bindInput), ctx.inventoryPreviews (M8's createInventoryUi), ctx.toggleMapForDeath (x2,
// M8's createModals) and ctx.networkEvent (this task's createNetworkEvents). Everything else
// this function touches was already spelled ctx.* in main.js.
import {$} from './dom.js';
import {classFor} from './classes.js';
import {mapFor} from './regions.js';
import {predictedPosition} from './multiplayer-client.js';
import {disposeActor as disposeActorImport} from './multiplayer-view.js';
import {usesLegacyTelegraph} from './region-client-ui.js';
import {updateInventoryResources} from './pouch.js';
export function createSnapshotApply(ctx,{disposeActor=disposeActorImport}={}){
 function applySnapshot(snapshot,changed){
  const initialSnapshot=!ctx.lastSnapshot,wasDead=ctx.state.ended,oldLevel=ctx.state.level,beforeServices=JSON.stringify([ctx.state.gold,ctx.state.potions,ctx.state.forgeLevel,ctx.state.questAccepted,ctx.state.questRewarded,ctx.state.victory,ctx.state.bossLootClaimed,ctx.state.rookSupplies]),beforeInventory=JSON.stringify([ctx.state.inventory,ctx.state.equipped]);
  const nextMap=snapshot.mapId||snapshot.state.mapId||snapshot.players.find(p=>p.id===snapshot.you)?.mapId||'overworld',mapChanged=nextMap!==ctx.renderedMap;
  if(mapChanged)ctx.switchMap(nextMap);
  if(changed||mapChanged||initialSnapshot){ctx.classEffects.clear();for(const visual of ctx.networkZones.values())visual.dispose();ctx.networkZones.clear();ctx.releaseInput();ctx.network.pending=[];if(changed){ctx.victoryShown=false;ctx.lastNetworkEvent=0;clearTimeout(ctx.victoryTimer);}for(const effect of ctx.effects)ctx.removeObject(effect.mesh);ctx.effects.length=0;for(const floater of ctx.floaters)floater.element.remove();ctx.floaters.length=0;for(const e of ctx.enemies){ctx.cancelAttack(e);e.visuals.dispose();disposeActor(e.model);ctx.removeObject(e.bar);e.barTexture.dispose();}ctx.enemies.length=0;ctx.life.syncLoot([]);ctx.life.syncForage([]);for(const b of ctx.networkProjectiles.values())b.visual?b.visual.dispose():ctx.removeObject(b.mesh);ctx.networkProjectiles.clear();if(changed)ctx.toast(ctx.sessionMode==='single-player'?'A new vigil begins.':'A new vigil begins · The shared world has restarted.');else if(mapChanged)ctx.toast(mapFor(nextMap).name);}
  // Fresh server sessions omit the old class; clear it before merging so the
  // client cannot show Sorcerer skills while the server awaits a new choice.
  if(initialSnapshot)for(const key of Object.keys(ctx.state))delete ctx.state[key];
  Object.assign(ctx.state,{classId:undefined,appearanceId:undefined,baseHp:undefined},snapshot.state);ctx.lastSnapshot=snapshot;ctx.started=true;ctx.syncPlayerCharacter();
  // The first snapshot is a state baseline; retained server events predate this client.
  if(initialSnapshot){ctx.victoryShown=!!ctx.state.bossLootClaimed;ctx.lastNetworkEvent=Math.max(ctx.lastNetworkEvent,...snapshot.events.map(event=>event.id));}
  const me=snapshot.players.find(p=>p.id===snapshot.you);if(!me)return;
  ctx.exploration.setSession(snapshot.worldId,snapshot.you,{mode:ctx.sessionMode,preview:ctx.previewMode,journeyId:ctx.activeJourney?.id});
  if(changed&&ctx.sessionMode==='single-player')ctx.exploration.reset();
  ctx.exploration.reveal(mapFor(nextMap),me,ctx.environment.obstacles);
  ctx.environment.updateProgress?.(ctx.state);ctx.environment.updateObstacles?.(snapshot.brokenCover||[]);
  const target=predictedPosition(me,ctx.network.pending,snapshot.ack,ctx.environment.obstacles,ctx.worldBounds());
  // Only discontinuities snap. Walking and dodging reconcile on render frames.
  ctx.movementCorrection.reconcile(ctx.player.position,target,ctx.resetMovement||changed||mapChanged||wasDead&&!ctx.state.ended||ctx.backgrounded,me.dodge>0?4:1.5);ctx.player.rotation.z=ctx.state.ended?-1.5:0;
  if(mapChanged||initialSnapshot)ctx.cameraTarget.set(target.x,0,target.z-3.4);ctx.dodgeTime=me.dodge;if(me.dodge>0)ctx.angle=ctx.dodgeAngle=me.angle;ctx.selection.material.color.set(me.color);ctx.multiplayerView.sync(snapshot.players,snapshot.you,snapshot.time,changed||ctx.resetMovement);ctx.resetMovement=false;
  const enemyIds=new Set(snapshot.enemies.map(e=>e.id));for(let i=ctx.enemies.length-1;i>=0;i--)if(!enemyIds.has(ctx.enemies[i].id)){const e=ctx.enemies[i];ctx.cancelAttack(e);e.visuals.dispose();disposeActor(e.model);ctx.removeObject(e.bar);e.barTexture.dispose();ctx.enemies.splice(i,1);}
  for(const data of snapshot.enemies){let e=ctx.enemies.find(e=>e.id===data.id);if(!e)e=ctx.spawnEnemy(data.type,data.x,data.z,data.zone,data.id);const oldPhase=e.phase;if(e.dead&&data.hp>0){e.model.visible=true;e.model.position.set(data.x,0,data.z);e.model.rotation.z=0;e.barHealth=data.hp;}e.net=data;e.hp=data.hp;e.dead=data.hp<=0;e.phase=data.phase;e.timer=data.timer;e.maxHp=data.maxHp;e.angle=data.angle;
   if(e.dead||oldPhase!==data.phase||data.phase!=='windup'||!usesLegacyTelegraph(data.type)){ctx.cancelAttack(e);if(data.hp>0&&data.phase==='windup'&&usesLegacyTelegraph(data.type))e.telegraph=ctx.telegraph(e.data.attackStyle==='orb'&&!ctx.bossType(e.type)?data.aim:data,e.data.attackStyle==='orb'&&!ctx.bossType(e.type)?1.5:e.data.range,e.data.attackStyle==='orb'?Math.PI*2:1.9,data.attackAngle);}
   ctx.updateEnemyBar(e);
  }
  ctx.life.syncLoot(snapshot.loot);ctx.life.syncForage(snapshot.forage);ctx.environment.updateProgress?.(ctx.state);ctx.environment.sync?.(snapshot.interactions,ctx.state.discoveries);if(ctx.renderedMap==='overworld'){ctx.landmarks?.updateProgress?.(ctx.state);ctx.landmarks?.sync?.(snapshot.interactions,ctx.state.discoveries);}
  ctx.connectionStatus(`${snapshot.players.length} / 8 adventurers · ${classFor(ctx.state).name} ${me.slot+1}`,true);
  $('restart-vote').hidden=ctx.sessionMode==='single-player'||!snapshot.votes.length;$('restart-vote-text').textContent=`Restart the game? ${snapshot.votes.length} / ${snapshot.players.length} agree. All progress will reset.`;
  $('restart-yes').disabled=snapshot.votes.includes(snapshot.you);
  for(const event of snapshot.events)if(event.id>ctx.lastNetworkEvent){ctx.networkEvent(event);ctx.lastNetworkEvent=event.id;}
  if(ctx.state.level>oldLevel&&!changed){ctx.toast(`Oath strengthened · Level ${ctx.state.level}`);ctx.audio.play('levelup',.65);}if(ctx.state.ended&&!wasDead){ctx.dismissMainMenu();ctx.audio.play('death-player',.8);ctx.releaseInput();if(ctx.mapExpanded)ctx.toggleMapForDeath();ctx.showModal('death');}
  if(wasDead&&!ctx.state.ended||changed){ctx.dismissMainMenu();ctx.inventoryPreviews.hide();$('modal-shade').hidden=true;ctx.modalKind='';ctx.paused=false;ctx.toggleMapForDeath();ctx.syncAudioState();ctx.player.rotation.z=0;ctx.player.position.y=0;}
  if(ctx.mainMenuOpen&&!ctx.rosterPicker?.open)ctx.titleScreen.updateSession(ctx.mainMenuSession());
  if(!ctx.state.classId&&!ctx.rosterPicker?.open)ctx.openRoster();
  if(ctx.modalKind==='npc'&&beforeServices!==JSON.stringify([ctx.state.gold,ctx.state.potions,ctx.state.forgeLevel,ctx.state.questAccepted,ctx.state.questRewarded,ctx.state.victory,ctx.state.bossLootClaimed,ctx.state.rookSupplies]))ctx.renderNpc();if(ctx.modalKind==='inventory'&&beforeInventory!==JSON.stringify([ctx.state.inventory,ctx.state.equipped]))ctx.renderInventory();if(ctx.modalKind==='inventory')updateInventoryResources($('modal-content').closest('.modal'),ctx.state,ctx.network.connected);ctx.updateUI();
 }
 return {applySnapshot};
}
