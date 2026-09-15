import {foodFor,foodIcon} from './foraging.js';
import {createForageVisual} from './forage-visuals.js';
import * as T from './vendor/three.core.js';
import {createLootVisual,lootColor} from './loot-effects.js';
import {NPCS,LOOT_PICKUP_RANGE,collectLoot} from './campaign.js';
import {distance,clamp,pointBlocked,hasLineOfSight} from './combat.js';
const lootIcons={item:'M12 3 20 12 12 21 4 12Z M12 3v18 M4 12h16',potion:'M9 3h6 M10 3v6l-4 6c-3 5-1 7 6 7s9-2 6-7l-4-6V3 M8 14h8',gold:'M20 8c0 2-4 4-8 4s-8-2-8-4 4-4 8-4 8 2 8 4Z M4 8v8c0 2 4 4 8 4s8-2 8-4V8 M4 12c0 2 4 4 8 4s8-2 8-4'};
export class VillageLife{
 constructor({scene,camera,player,state,cloneModel,obstacles,onTalk,onCollect,onLootClick,onApproach,reducedMotion=false}){Object.assign(this,{scene,camera,player,state,obstacles,onTalk,onCollect,onLootClick,onApproach,reducedMotion});this.npcs=[];this.drops=[];this.forage=[];this.pending=null;this.labelDirty=true;this.labelSorted=[];this.labelStructKeyCache=null;this.labelOccupied=[];this.labelRectPool=[];this.labelRectIndex=0;this.labelOffsets=[0,0,0,0,0,0,0,0,0];this.labelTestRect={x:0,y:0,w:0,h:0};this.labelProj=new T.Vector3();this.layer=document.getElementById('world-labels');this.labelFontRevision=0;document.fonts?.ready.then(()=>{this.labelFontRevision++;});for(const data of NPCS){const model=cloneModel(data.model);model.position.set(data.x,0,data.z);model.rotation.y=.6;scene.add(model);const label=document.createElement('button');label.className='world-label npc-label';label.innerHTML=`<span class="npc-mark">${data.id==='rowan'?'◇':'◆'}</span>${data.name}<small>${data.role}</small>`;label.onclick=()=>this.interact(data.id);this.layer.append(label);const ring=new T.Mesh(new T.RingGeometry(.42,.47,32),new T.MeshBasicMaterial({color:data.color,transparent:true,opacity:.35,depthWrite:false}));ring.rotation.x=-Math.PI/2;ring.position.set(data.x,.11,data.z);scene.add(ring);this.npcs.push({...data,model,label,ring});}}
 visibleNpcs(){return (this.state.mapId||'overworld')==='overworld'?this.npcs:[];}
 find(id){return this.visibleNpcs().find(n=>n.id===id)||this.drops.find(d=>d.id===id&&!d.claimed)||this.forage.find(p=>p.id===id);}
 interact(id){const target=id?this.find(id):this.nearest();if(!target)return{ok:false,reason:'Move closer to a villager, loot, or a forage patch.'};if(target.kind&&target.kind!=='forage'){this.pending=null;return this.pickup(target);}if(distance(this.player.position,target.model.position)>2.8||!hasLineOfSight(this.player.position,target.model.position,this.obstacles)){const p=target.model.position;if(this.onApproach({x:p.x,z:p.z})){this.pending=target.id;return{ok:true,approaching:target.name};}return{ok:false,reason:'That path is blocked.'};}this.pending=null;if(target.kind==='forage')return this.harvest(target);if(target.kind)return this.pickup(target);this.onTalk(target.id);return{ok:true,npc:target.id};}
 canPickUp(d){return !d.claimed&&distance(d.model.position,this.player.position)<2.8&&(d.kind!=='potion'||this.state.potions<5)&&hasLineOfSight(d.model.position,this.player.position,this.obstacles);}
 nearest(){const nearby=[...this.drops,...this.forage].filter(d=>this.canPickUp(d)).sort((a,b)=>(b.rarity==='legendary')-(a.rarity==='legendary')||distance(a.model.position,this.player.position)-distance(b.model.position,this.player.position));if(nearby.length)return nearby[0];return this.visibleNpcs().filter(n=>distance(n.model.position,this.player.position)<3.3&&hasLineOfSight(n.model.position,this.player.position,this.obstacles)).sort((a,b)=>distance(a.model.position,this.player.position)-distance(b.model.position,this.player.position))[0]||null;}
 pickLoot(raycaster){
  const candidates=this.drops.filter(drop=>!drop.claimed&&distance(this.player.position,drop.model.position)<=LOOT_PICKUP_RANGE);
  // Pick the solid item and its ground halo, excluding the tall decorative beams.
  const targets=candidates.flatMap(drop=>[drop.mesh,drop.model.getObjectByName('loot-halo')]).filter(Boolean);
  for(const hit of raycaster.intersectObjects(targets,true)){
   let object=hit.object;while(object&&object.parent!==this.scene)object=object.parent;
   const drop=candidates.find(drop=>drop.model===object);if(drop)return drop;
  }
  return null;
 }
 pickup(drop){
  if(this.state.ended)return{ok:false,reason:'Unable to collect right now.'};
  if(drop.claimed)return{ok:false,reason:'Already collected'};
  if(distance(this.player.position,drop.model.position)>LOOT_PICKUP_RANGE)return{ok:false,reason:'That loot is too far away.'};
  if(drop.kind==='potion'&&this.state.potions>=5)return{ok:false,reason:'Draught belt is full'};
  if(this.requestCollect){
   if(drop.requestedAt!==undefined&&performance.now()-drop.requestedAt<500)return{ok:true,pending:true};
   if(!this.requestCollect(drop.id))return{ok:false,reason:'Unable to collect right now.'};
   drop.requestedAt=performance.now();return{ok:true,pending:true};
  }
  const result=collectLoot(this.state,drop);if(!result.collected)return{ok:false,reason:result.reason};
  drop.label.remove();drop.visual.dispose();this.drops=this.drops.filter(d=>d!==drop);this.labelDirty=true;this.onCollect(drop,result);return{ok:true,...result};
 }
 harvest(patch){
  if(this.state.ended||!this.requestForage)return {ok:false,reason:'Unable to forage right now.'};
  if(patch.requestedAt!==undefined&&performance.now()-patch.requestedAt<500)return {ok:true,pending:true};
  if(!this.requestForage(patch.id))return {ok:false,reason:'Unable to forage while disconnected or in a menu.'};
  patch.requestedAt=performance.now();return {ok:true,pending:true};
 }
 syncForage(records){
  this.labelDirty=true;
  const ids=new Set(records.map(patch=>patch.id));
  for(const patch of this.forage)if(!ids.has(patch.id)){patch.label.remove();patch.visual.dispose();}
  this.forage=this.forage.filter(patch=>ids.has(patch.id));
  const known=new Set(this.forage.map(patch=>patch.id));
  for(const record of records){
   if(known.has(record.id))continue;const food=foodFor(record.itemId);if(!food)continue;
   const visual=createForageVisual(record.itemId,{reducedMotion:this.reducedMotion}),{model}=visual;
   model.position.set(record.x,0,record.z);this.scene.add(model);
   const label=document.createElement('button');label.type='button';label.className='world-label forage-label';
   label.style.setProperty('--food-color',food.color);label.innerHTML=`<span class="forage-icon">${foodIcon(food)}</span><span>${food.name}</span>`;
   label.setAttribute('aria-label',`Harvest ${food.name}`);label.onclick=()=>this.interact(record.id);
   const patch={...record,kind:'forage',name:food.name,model,visual,label,hovered:false,focused:false};
   label.onpointerenter=()=>{patch.hovered=true;};label.onpointerleave=()=>{patch.hovered=false;};
   label.onfocus=()=>{patch.focused=true;};label.onblur=()=>{patch.focused=false;};
   this.layer.append(label);this.forage.push(patch);
  }
 }
 addLoot(records,position){
  this.labelDirty=true;
  records.forEach((record,i)=>{
   const a=i/records.length*Math.PI*2;
   let x=record.x??position.x+Math.cos(a)*.65,z=record.z??position.z+Math.sin(a)*.65;
   if(pointBlocked({x,z},this.obstacles,.3)){x=position.x;z=position.z;}
   const visual=createLootVisual(record,{reducedMotion:this.reducedMotion,pixelRatio:Math.min(globalThis.devicePixelRatio||1,1.7)});
   const {model,mesh}=visual;model.position.set(x,0,z);this.scene.add(model);
   const label=document.createElement('button');
   label.type='button';label.className=`world-label loot-label ${record.rarity}`;label.dataset.kind=record.kind;
   const color=lootColor(record);label.style.setProperty('--loot-rgb',`${color>>16&255},${color>>8&255},${color&255}`);
   label.innerHTML=`<span class="loot-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="${lootIcons[record.kind]||lootIcons.item}"/></svg></span><span class="loot-name"></span>`;
   label.querySelector('.loot-name').textContent=(record.kind==='gold'?`${record.amount} `:'')+record.name;
   const drop={...record,model,mesh,label,visual,hovered:false,focused:false};
   label.onpointerdown=event=>{event.preventDefault();event.stopPropagation();};
   label.onclick=event=>{event?.stopPropagation();return this.onLootClick?this.onLootClick(record.id):this.interact(record.id);};
   label.onpointerenter=()=>{drop.hovered=true;};label.onpointerleave=()=>{drop.hovered=false;};
   label.onfocus=()=>{drop.focused=true;};label.onblur=()=>{drop.focused=false;};
   this.layer.append(label);this.drops.push(drop);
  });
 }
 syncLoot(records){this.labelDirty=true;const ids=new Set(records.map(d=>d.id));for(const d of this.drops)if(!ids.has(d.id)){d.label.remove();d.visual.dispose();}this.drops=this.drops.filter(d=>ids.has(d.id));const known=new Set(this.drops.map(d=>d.id));for(const record of records)if(!known.has(record.id))this.addLoot([record],record);}
 update(t){for(const npc of this.npcs){const visible=(this.state.mapId||'overworld')==='overworld';npc.model.visible=npc.ring.visible=visible;npc.label.hidden=!visible;if(!visible)continue;const body=npc.model.getObjectByName('body');if(body)body.rotation.z=Math.sin(t*1.6+npc.x)*.015;if(distance(npc.model.position,this.player.position)<5)npc.model.rotation.y=Math.atan2(this.player.position.x-npc.x,this.player.position.z-npc.z);npc.ring.material.opacity=.26+Math.sin(t*2+npc.x)*.06;}for(const d of [...this.drops,...this.forage]){if(d.claimed)continue;const dist=distance(d.model.position,this.player.position);d.visual.update(t,d.hovered||d.focused||dist<2.8);if(d.kind==='gold'&&dist<1.25)this.pickup(d);}if(this.pending){const target=this.find(this.pending);if(!target)this.pending=null;else if(distance(target.model.position,this.player.position)<2.7&&hasLineOfSight(target.model.position,this.player.position,this.obstacles))this.interact(target.id);}}
 renderLabels(inCombat=false,showAll=false){
  const key=this.labelStructKey();
  if(this.labelDirty||key!==this.labelStructKeyCache){this.labelSorted=[...this.visibleNpcs(),...[...this.drops,...this.forage].filter(d=>!d.claimed).sort((a,b)=>(b.rarity==='legendary')-(a.rarity==='legendary')||a.id.localeCompare(b.id))];this.labelDirty=false;this.labelStructKeyCache=key;}
  const sorted=this.labelSorted,occupied=this.labelOccupied,proj=this.labelProj;
  occupied.length=0;this.labelRectIndex=0;
  proj.copy(this.player.position);proj.y+=1.1;proj.project(this.camera);
  const heroRect=this.nextLabelRect();heroRect.x=(proj.x*.5+.5)*innerWidth-30;heroRect.y=(-proj.y*.5+.5)*innerHeight-42;heroRect.w=60;heroRect.h=78;occupied.push(heroRect);
  for(const item of sorted){
   const dist=distance(item.model.position,this.player.position);
   proj.copy(item.model.position);proj.y+=item.kind?.85:2.4;proj.project(this.camera);
   let visible=dist<(item.kind?showAll?LOOT_PICKUP_RANGE:10:17)&&Math.abs(proj.x)<.96&&Math.abs(proj.y)<.88&&proj.z<1;
   if(item.kind&&!showAll&&(inCombat||item.kind==='gold'&&dist>4.5))visible=false;
   if((proj.x*.5+.5)*innerWidth<310&&(-proj.y*.5+.5)*innerHeight<370)visible=false;
   if(item.label.hidden!==!visible)item.label.hidden=!visible;
   const inReach=item.kind?this.canPickUp(item):dist<2.8;
   if(item.label.classList.contains('in-reach')!==inReach)item.label.classList.toggle('in-reach',inReach);
   if(!visible)continue;
   let x=(proj.x*.5+.5)*innerWidth,y=(-proj.y*.5+.5)*innerHeight;
   let w=150,h=59;
   if(item.kind){if(!item.labelSize||item.labelSize.inReach!==inReach||item.labelSize.viewport!==innerWidth||item.labelSize.fontRevision!==this.labelFontRevision)item.labelSize={inReach,w:item.label.offsetWidth,h:item.label.offsetHeight,viewport:innerWidth,fontRevision:this.labelFontRevision};({w,h}=item.labelSize);}
   if(item.kind){
    x=clamp(x,w/2+12,innerWidth-w/2-12);
    const off=this.labelOffsets;off[0]=0;off[1]=h+5;off[2]=(h+5)*2;off[3]=(h+5)*3;off[4]=-h-5;off[5]=-(h+5)*2;off[6]=(h+5)*4;off[7]=-(h+5)*3;off[8]=(h+5)*5;
    const test=this.labelTestRect;let found=false;
    for(let oi=0;oi<9;oi++){
     test.x=x-w/2;test.y=y+off[oi]-h;test.w=w;test.h=h;
     if(test.y<95||test.y+h>innerHeight-170)continue;
     if(!occupied.some(r=>test.x<r.x+r.w+4&&test.x+test.w>r.x-4&&test.y<r.y+r.h+3&&test.y+test.h>r.y-3)){found=true;break;}
    }
    if(!found){if(item.label.hidden!==true)item.label.hidden=true;continue;}
    y=test.y+h;
    const rect=this.nextLabelRect();rect.x=test.x;rect.y=test.y;rect.w=w;rect.h=h;occupied.push(rect);
   }else{const rect=this.nextLabelRect();rect.x=x-w/2;rect.y=y-h;rect.w=w;rect.h=h;occupied.push(rect);}
   const left=`${x}px`,top=`${y}px`;
   if(item.label.style.left!==left)item.label.style.left=left;
   if(item.label.style.top!==top)item.label.style.top=top;
  }
 }
 nextLabelRect(){
  const pool=this.labelRectPool;let rect=pool[this.labelRectIndex];
  if(!rect)rect=pool[this.labelRectIndex]={x:0,y:0,w:0,h:0};
  this.labelRectIndex++;return rect;
 }
 labelStructKey(){
  let h=2166136261;
  h=(h^this.npcs.length)>>>0;h=Math.imul(h,16777619)>>>0;
  const mapId=this.state.mapId||'overworld';
  for(let i=0;i<mapId.length;i++){h=(h^mapId.charCodeAt(i))>>>0;h=Math.imul(h,16777619)>>>0;}
  h=(h^509)>>>0;h=Math.imul(h,16777619)>>>0;
  for(const d of this.drops){const id=d.id;for(let i=0;i<id.length;i++){h=(h^id.charCodeAt(i))>>>0;h=Math.imul(h,16777619)>>>0;}h=(h^(d.claimed?521:523))>>>0;h=Math.imul(h,16777619)>>>0;}
  h=(h^541)>>>0;h=Math.imul(h,16777619)>>>0;
  for(const f of this.forage){const id=f.id;for(let i=0;i<id.length;i++){h=(h^id.charCodeAt(i))>>>0;h=Math.imul(h,16777619)>>>0;}h=(h^(f.claimed?521:523))>>>0;h=Math.imul(h,16777619)>>>0;}
  return h;
 }
 getState(){return{forage:this.forage.map(p=>({id:p.id,itemId:p.itemId,name:p.name,x:p.x,z:p.z,inReach:distance(p.model.position,this.player.position)<=2.8&&hasLineOfSight(p.model.position,this.player.position,this.obstacles)})),npcs:this.visibleNpcs().map(n=>({id:n.id,name:n.name,role:n.role,x:n.x,z:n.z,inReach:distance(n.model.position,this.player.position)<2.8})),loot:this.drops.filter(d=>!d.claimed).map(d=>({id:d.id,name:d.name,kind:d.kind,rarity:d.rarity,amount:d.amount,template:d.template,x:d.model.position.x,z:d.model.position.z,inReach:distance(d.model.position,this.player.position)<2.8}))};}
}
