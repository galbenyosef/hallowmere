import {foodFor,foodIcon} from './foraging.js';
import {createForageVisual} from './forage-visuals.js';
import * as T from './vendor/three.core.js';
import {createLootVisual,lootColor} from './loot-effects.js';
import {NPCS,collectLoot} from './campaign.js';
import {distance,clamp,pointBlocked,hasLineOfSight} from './combat.js';
const lootIcons={item:'M12 3 20 12 12 21 4 12Z M12 3v18 M4 12h16',potion:'M9 3h6 M10 3v6l-4 6c-3 5-1 7 6 7s9-2 6-7l-4-6V3 M8 14h8',gold:'M20 8c0 2-4 4-8 4s-8-2-8-4 4-4 8-4 8 2 8 4Z M4 8v8c0 2 4 4 8 4s8-2 8-4V8 M4 12c0 2 4 4 8 4s8-2 8-4'};
export class VillageLife{
 constructor({scene,camera,player,state,cloneModel,obstacles,onTalk,onCollect,onApproach,reducedMotion=false}){Object.assign(this,{scene,camera,player,state,obstacles,onTalk,onCollect,onApproach,reducedMotion});this.npcs=[];this.drops=[];this.forage=[];this.pending=null;this.layer=document.getElementById('world-labels');this.labelFontRevision=0;document.fonts?.ready.then(()=>{this.labelFontRevision++;});for(const data of NPCS){const model=cloneModel(data.model);model.position.set(data.x,0,data.z);model.rotation.y=.6;scene.add(model);const label=document.createElement('button');label.className='world-label npc-label';label.innerHTML=`<span class="npc-mark">${data.id==='rowan'?'◇':'◆'}</span>${data.name}<small>${data.role}</small>`;label.onclick=()=>this.interact(data.id);this.layer.append(label);const ring=new T.Mesh(new T.RingGeometry(.42,.47,32),new T.MeshBasicMaterial({color:data.color,transparent:true,opacity:.35,depthWrite:false}));ring.rotation.x=-Math.PI/2;ring.position.set(data.x,.11,data.z);scene.add(ring);this.npcs.push({...data,model,label,ring});}}
 find(id){return this.npcs.find(n=>n.id===id)||this.drops.find(d=>d.id===id&&!d.claimed)||this.forage.find(p=>p.id===id);}
 interact(id){const target=id?this.find(id):this.nearest();if(!target)return{ok:false,reason:'Move closer to a villager, loot, or a forage patch.'};if(distance(this.player.position,target.model.position)>2.8||!hasLineOfSight(this.player.position,target.model.position,this.obstacles)){const p=target.model.position;if(this.onApproach({x:p.x,z:p.z})){this.pending=target.id;return{ok:true,approaching:target.name};}return{ok:false,reason:'That path is blocked.'};}this.pending=null;if(target.kind==='forage')return this.harvest(target);if(target.kind)return this.pickup(target);this.onTalk(target.id);return{ok:true,npc:target.id};}
 nearest(){const nearby=[...this.drops,...this.forage].filter(d=>!d.claimed&&distance(d.model.position,this.player.position)<2.8&&(d.kind!=='potion'||this.state.potions<5)&&hasLineOfSight(d.model.position,this.player.position,this.obstacles)).sort((a,b)=>(b.rarity==='legendary')-(a.rarity==='legendary')||distance(a.model.position,this.player.position)-distance(b.model.position,this.player.position));if(nearby.length)return nearby[0];return this.npcs.filter(n=>distance(n.model.position,this.player.position)<3.3&&hasLineOfSight(n.model.position,this.player.position,this.obstacles)).sort((a,b)=>distance(a.model.position,this.player.position)-distance(b.model.position,this.player.position))[0]||null;}
 pickup(drop){if(this.requestCollect){if(!drop.requestedAt||performance.now()-drop.requestedAt>500){drop.requestedAt=performance.now();this.requestCollect(drop.id);}return{ok:true,pending:true};}if(distance(this.player.position,drop.model.position)>2.8||!hasLineOfSight(this.player.position,drop.model.position,this.obstacles))return{ok:false,reason:'Move closer to collect this.'};const result=collectLoot(this.state,drop);if(!result.collected)return{ok:false,reason:result.reason};drop.label.remove();drop.visual.dispose();this.drops=this.drops.filter(d=>d!==drop);this.onCollect(drop,result);return{ok:true,...result};}
 harvest(patch){
  if(this.state.ended||!this.requestForage)return {ok:false,reason:'Unable to forage right now.'};
  if(patch.requestedAt!==undefined&&performance.now()-patch.requestedAt<500)return {ok:true,pending:true};
  if(!this.requestForage(patch.id))return {ok:false,reason:'Unable to forage while disconnected or in a menu.'};
  patch.requestedAt=performance.now();return {ok:true,pending:true};
 }
 syncForage(records){
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
  records.forEach((record,i)=>{
   const a=i/records.length*Math.PI*2;
   let x=record.x??position.x+Math.cos(a)*.65,z=record.z??position.z+Math.sin(a)*.65;
   if(pointBlocked({x,z},this.obstacles,.3)){x=position.x;z=position.z;}
   const visual=createLootVisual(record,{reducedMotion:this.reducedMotion,pixelRatio:Math.min(globalThis.devicePixelRatio||1,1.7)});
   const {model,mesh}=visual;model.position.set(x,0,z);this.scene.add(model);
   const label=document.createElement('button');
   label.className=`world-label loot-label ${record.rarity}`;label.dataset.kind=record.kind;
   const color=lootColor(record);label.style.setProperty('--loot-rgb',`${color>>16&255},${color>>8&255},${color&255}`);
   label.innerHTML=`<span class="loot-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="${lootIcons[record.kind]||lootIcons.item}"/></svg></span><span class="loot-name"></span>`;
   label.querySelector('.loot-name').textContent=(record.kind==='gold'?`${record.amount} `:'')+record.name;
   const drop={...record,model,mesh,label,visual,hovered:false,focused:false};
   label.onclick=()=>this.interact(record.id);
   label.onpointerenter=()=>{drop.hovered=true;};label.onpointerleave=()=>{drop.hovered=false;};
   label.onfocus=()=>{drop.focused=true;};label.onblur=()=>{drop.focused=false;};
   this.layer.append(label);this.drops.push(drop);
  });
 }
 syncLoot(records){const ids=new Set(records.map(d=>d.id));for(const d of this.drops)if(!ids.has(d.id)){d.label.remove();d.visual.dispose();}this.drops=this.drops.filter(d=>ids.has(d.id));const known=new Set(this.drops.map(d=>d.id));for(const record of records)if(!known.has(record.id))this.addLoot([record],record);}
 update(t){for(const npc of this.npcs){const body=npc.model.getObjectByName('body');if(body)body.rotation.z=Math.sin(t*1.6+npc.x)*.015;if(distance(npc.model.position,this.player.position)<5)npc.model.rotation.y=Math.atan2(this.player.position.x-npc.x,this.player.position.z-npc.z);npc.ring.material.opacity=.26+Math.sin(t*2+npc.x)*.06;}for(const d of [...this.drops,...this.forage]){if(d.claimed)continue;const dist=distance(d.model.position,this.player.position);d.visual.update(t,d.hovered||d.focused||dist<2.8);if(d.kind==='gold'&&dist<1.25)this.pickup(d);}if(this.pending){const target=this.find(this.pending);if(!target)this.pending=null;else if(distance(target.model.position,this.player.position)<2.7&&hasLineOfSight(target.model.position,this.player.position,this.obstacles))this.interact(target.id);}}
 renderLabels(inCombat=false,showAll=false){const occupied=[];const project=item=>item.model.position.clone().add(new T.Vector3(0,item.kind?.85:2.4,0)).project(this.camera);const hero=this.player.position.clone().add(new T.Vector3(0,1.1,0)).project(this.camera);occupied.push({x:(hero.x*.5+.5)*innerWidth-30,y:(-hero.y*.5+.5)*innerHeight-42,w:60,h:78});const sorted=[...this.npcs,...[...this.drops,...this.forage].filter(d=>!d.claimed).sort((a,b)=>(b.rarity==='legendary')-(a.rarity==='legendary')||a.id.localeCompare(b.id))];for(const item of sorted){const dist=distance(item.model.position,this.player.position),p=project(item);let visible=dist<(item.kind?showAll?17:10:17)&&Math.abs(p.x)<.96&&Math.abs(p.y)<.88&&p.z<1;if(item.kind&&!showAll&&(inCombat||item.kind==='gold'&&dist>4.5))visible=false;if((p.x*.5+.5)*innerWidth<310&&(-p.y*.5+.5)*innerHeight<370)visible=false;item.label.hidden=!visible;if(!visible)continue;let x=(p.x*.5+.5)*innerWidth,y=(-p.y*.5+.5)*innerHeight;let w=150,h=59;if(item.kind){if(!item.labelSize||item.labelSize.viewport!==innerWidth||item.labelSize.fontRevision!==this.labelFontRevision)item.labelSize={w:item.label.offsetWidth,h:item.label.offsetHeight,viewport:innerWidth,fontRevision:this.labelFontRevision};({w,h}=item.labelSize);}if(item.kind){x=clamp(x,w/2+12,innerWidth-w/2-12);let chosen=null;for(const offset of [0,h+5,(h+5)*2,(h+5)*3,-h-5,-(h+5)*2,(h+5)*4,-(h+5)*3,(h+5)*5]){const candidate={x:x-w/2,y:y+offset-h,w,h};if(candidate.y<95||candidate.y+h>innerHeight-170)continue;if(!occupied.some(r=>candidate.x<r.x+r.w+4&&candidate.x+candidate.w>r.x-4&&candidate.y<r.y+r.h+3&&candidate.y+candidate.h>r.y-3)){chosen=candidate;break;}}if(!chosen){item.label.hidden=true;continue;}y=chosen.y+h;occupied.push(chosen);}else occupied.push({x:x-w/2,y:y-h,w,h});item.label.style.left=`${x}px`;item.label.style.top=`${y}px`;item.label.classList.toggle('in-reach',dist<2.8);}}
 getState(){return{forage:this.forage.map(p=>({id:p.id,itemId:p.itemId,name:p.name,x:p.x,z:p.z,inReach:distance(p.model.position,this.player.position)<=2.8&&hasLineOfSight(p.model.position,this.player.position,this.obstacles)})),npcs:this.npcs.map(n=>({id:n.id,name:n.name,role:n.role,x:n.x,z:n.z,inReach:distance(n.model.position,this.player.position)<2.8})),loot:this.drops.filter(d=>!d.claimed).map(d=>({id:d.id,name:d.name,kind:d.kind,rarity:d.rarity,amount:d.amount,template:d.template,x:d.model.position.x,z:d.model.position.z,inReach:distance(d.model.position,this.player.position)<2.8}))};}
}
