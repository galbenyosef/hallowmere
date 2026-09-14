import {hasLineOfSight,pointBlocked} from './combat.js';
import {mapFogTexture} from './map-fog.js';

const CELL=2,RADIUS=11,STORAGE='hallowmere-exploration-v1';
export class ExplorationAtlas{
 constructor(){this.maps=new Map();this.session=null;this.savedAt=0;}
 setSession(worldId,playerId){
  const session=`${worldId}:${playerId}`;if(session===this.session)return;
  this.maps.clear();this.session=session;this.restored={};
  try{const saved=JSON.parse(sessionStorage.getItem(STORAGE));if(saved?.session===session)this.restored=saved.maps||{};}catch{}
 }
 map(map){
  if(this.maps.has(map.id))return this.maps.get(map.id);
  const b=map.bounds,columns=Math.ceil((b.maxX-b.minX)/CELL),rows=Math.ceil((b.maxZ-b.minZ)/CELL),mask=document.createElement('canvas');mask.width=columns;mask.height=rows;
  const data={mask,ctx:mask.getContext('2d'),columns,rows,cells:new Set(),last:null,total:0};
  for(let z=0;z<rows;z++)for(let x=0;x<columns;x++){const p={x:b.minX+(x+.5)*CELL,z:b.minZ+(z+.5)*CELL};if(!pointBlocked(p,map.obstacles,0))data.total++;}
  data.ctx.fillStyle='#fff';for(const index of this.restored?.[map.id]||[]){if(!Number.isInteger(index)||index<0||index>=columns*rows)continue;data.cells.add(index);data.ctx.fillRect(index%columns,Math.floor(index/columns),1,1);}
  this.maps.set(map.id,data);return data;
 }
 reveal(map,position,obstacles){
  const data=this.map(map);if(data.last&&Math.hypot(data.last.x-position.x,data.last.z-position.z)<.65)return;
  data.last={x:position.x,z:position.z};const b=map.bounds,col=Math.floor((position.x-b.minX)/CELL),row=Math.floor((position.z-b.minZ)/CELL),reach=Math.ceil(RADIUS/CELL);
  // A room behind a wall stays unknown until a doorway or tunnel is explored.
  for(let z=Math.max(0,row-reach);z<=Math.min(data.rows-1,row+reach);z++)for(let x=Math.max(0,col-reach);x<=Math.min(data.columns-1,col+reach);x++){
   const index=z*data.columns+x;if(data.cells.has(index))continue;
   const p={x:b.minX+(x+.5)*CELL,z:b.minZ+(z+.5)*CELL};if(Math.hypot(position.x-p.x,position.z-p.z)>RADIUS||!hasLineOfSight(position,p,obstacles,0))continue;
   data.cells.add(index);data.ctx.fillRect(x,z,1,1);
  }
  if(this.session&&performance.now()-this.savedAt>1000)this.save();
 }
 seen(map,p){const d=this.map(map),x=Math.floor((p.x-map.bounds.minX)/CELL),z=Math.floor((p.z-map.bounds.minZ)/CELL);return x>=0&&x<d.columns&&z>=0&&z<d.rows&&d.cells.has(z*d.columns+x);}
 save(){try{sessionStorage.setItem(STORAGE,JSON.stringify({session:this.session,maps:{...this.restored,...Object.fromEntries([...this.maps].map(([id,d])=>[id,[...d.cells]]))}}));this.savedAt=performance.now();}catch{}}
}

export function drawExplorationMap({canvas,atlas,map,player,angle,expanded,environment,npcs,interactions,drops,enemies,players,you,bossType}){
 const ctx=canvas.getContext('2d'),pixels=expanded?3:2;if(canvas.width!==220*pixels)canvas.width=canvas.height=220*pixels;
 ctx.setTransform(pixels,0,0,pixels,0,0);ctx.clearRect(0,0,220,220);
 const b=map.bounds,scale=expanded?Math.min(196/(b.maxX-b.minX),184/(b.maxZ-b.minZ)):3.8,cx=expanded?(b.minX+b.maxX)/2:player.x,cz=expanded?(b.minZ+b.maxZ)/2:player.z;
 const project=p=>({x:110+(p.x-cx)*scale,y:110+(p.z-cz)*scale}),seen=p=>atlas.seen(map,p),data=atlas.map(map);
 ctx.fillStyle='#0a1319';ctx.fillRect(0,0,220,220);
 // Start with the explored footprint. Everything that follows is clipped to it.
 ctx.save();ctx.globalCompositeOperation='copy';const origin=project({x:b.minX,z:b.minZ});ctx.imageSmoothingEnabled=false;
 ctx.drawImage(data.mask,origin.x,origin.y,data.columns*CELL*scale,data.rows*CELL*scale);ctx.globalCompositeOperation='source-in';ctx.fillStyle=map.theme==='cave'?'#43544f':'#263b35';ctx.fillRect(0,0,220,220);ctx.globalCompositeOperation='source-atop';
 const rect=(o,color)=>{const p=project(o);ctx.save();ctx.translate(p.x,p.y);ctx.rotate(-(o.rotation||0));ctx.fillStyle=color;ctx.fillRect(-o.w*scale/2,-o.d*scale/2,o.w*scale,o.d*scale);ctx.restore();};
 const line=(points,width,color)=>{ctx.strokeStyle=color;ctx.lineWidth=width;ctx.lineCap='round';ctx.lineJoin='round';ctx.beginPath();points.forEach((point,i)=>{const p=project(point);i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y);});ctx.stroke();};
 if(map.id==='overworld'){line([{x:-78,z:5},{x:23,z:5}],4.2*scale,'#76806666');line([{x:0,z:-25},{x:0,z:25}],5*scale,'#76806666');}
 else if(map.theme!=='cave')line(map.id==='underways'?[{x:-28,z:0},{x:28,z:0}]:[{x:0,z:27},{x:0,z:-28}],4*scale,'#76806666');
 for(const route of map.routes||[])line(route.points,Math.max(.7,route.width*scale),'#8c907066');
 for(const s of map.sites||[]){const p=project(s);ctx.fillStyle='#77876a33';ctx.beginPath();ctx.ellipse(p.x,p.y,9*scale,8*scale,0,0,Math.PI*2);ctx.fill();}
 for(const o of environment.obstacles){if(o.disabled)continue;rect(o,map.theme==='cave'?'#0b151b':'#182a28');}
 for(const building of environment.buildings||[])rect(building,building.chapel?'#a29773':'#738575');
 const dot=(point,color,size=2,square=false)=>{if(!seen(point))return;const p=project(point);ctx.fillStyle=color;ctx.beginPath();if(square)ctx.rect(p.x-size,p.y-size,size*2,size*2);else ctx.arc(p.x,p.y,size,0,Math.PI*2);ctx.fill();};
 for(const npc of npcs)dot(npc,'#aad1ac',1.8,true);
 for(const r of interactions)dot(r,r.completed?'#668275':r.locked?'#858077':r.operation==='travel'?'#c0a1dc':r.operation==='checkpoint'?'#efd68d':'#95cdbc',r.operation==='checkpoint'?2.2:1.8,true);
 for(const d of drops)if(!d.claimed&&d.kind!=='gold')dot(d.model.position,d.rarity==='legendary'?'#efb45d':'#94bdd1',1.5,true);

 ctx.restore();
 // Feather inward into discovered terrain; the existing clip still prevents
 // hidden geometry from appearing beyond the explored footprint.
 ctx.save();ctx.globalCompositeOperation='destination-in';ctx.filter=`blur(${pixels*1.25}px)`;
 ctx.drawImage(data.mask,origin.x,origin.y,data.columns*CELL*scale,data.rows*CELL*scale);ctx.restore();
 // Opaque mist replaces the flat dark void, behind the explored terrain.
 ctx.globalCompositeOperation='destination-over';ctx.drawImage(mapFogTexture(),0,0,220,220);ctx.globalCompositeOperation='source-over';
 if(expanded){
  ctx.font='6px Georgia';ctx.textAlign='center';ctx.fillStyle='#d3cfb0';
  const labels=map.id==='overworld'?[{name:'Ashwick',x:-67,z:5},{name:'Hallowmere',x:0,z:-8},...(map.sites||[])]:[...(map.sites||[]),...(map.chambers||[])];
  for(const l of labels){if(!seen(l))continue;const p=project(l);ctx.fillText(l.name.toUpperCase(),Math.max(30,Math.min(190,p.x)),p.y-6);}
 }

 for(const e of enemies){const p=e.model.position;if(!e.dead&&seen(p)&&Math.hypot(p.x-player.x,p.z-player.z)<RADIUS&&hasLineOfSight(player,p,environment.obstacles,.08))dot(p,bossType(e.type)?'#ecaa68':'#cd7864',bossType(e.type)?3:1.7);}
 for(const other of players){if(other.id===you||(other.mapId||'overworld')!==map.id||!seen(other))continue;dot(other,other.color,2.8);const p=project(other);ctx.font='8px Arial';ctx.textAlign='center';ctx.fillStyle=other.color;ctx.fillText(String(other.slot+1),p.x,p.y-4);}
 const p=project(player);ctx.save();ctx.translate(p.x,p.y);ctx.rotate(-angle+Math.PI);ctx.fillStyle=players.find(p=>p.id===you)?.color||'#f6df93';ctx.shadowColor=ctx.fillStyle;ctx.shadowBlur=6;ctx.beginPath();ctx.moveTo(0,-4);ctx.lineTo(3,3);ctx.lineTo(0,1);ctx.lineTo(-3,3);ctx.closePath();ctx.fill();ctx.restore();
 const percent=Math.min(100,Math.round(data.cells.size/Math.max(1,data.total)*1000)/10);
 if(expanded){ctx.fillStyle='#a6b4b3';ctx.font='6px Georgia';ctx.textAlign='center';ctx.fillText('THE UNKNOWN WAITS BEYOND YOUR FOOTSTEPS',110,210);}
 return percent;
}
