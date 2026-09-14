import {MAPS} from './regions.js';
import {FIRST_LEVEL_CAVES} from './caves.js';

// An opt-in, single-player review tour of the real game environments.
export function createCavePreview(session,onJump=()=>{}){
 const explorationTour=new URLSearchParams(location.search).get('preview')==='exploration',tourMaps=explorationTour?Object.values(MAPS):FIRST_LEVEL_CAVES;
 const stops=map=>map.chambers||[{name:map.id==='overworld'?'Ashwick Village':'Entrance',...map.start},...(map.sites||[])];
 const panel=document.createElement('aside');panel.className='cave-preview';panel.setAttribute('aria-label','Cave exploration preview');
 const style=document.createElement('style');style.textContent='.cave-preview{position:fixed;z-index:18;left:50%;top:145px;transform:translateX(-50%);display:flex;align-items:center;gap:12px;padding:10px 16px;color:#d9cdb1;background:#10191eea;border:1px solid #766849;font:12px system-ui}.cave-preview select{max-width:180px;background:#202a2d;color:#eadbb7;border:1px solid #645d48;padding:6px}.cave-preview label{display:flex;gap:7px;align-items:center}.cave-preview small{color:#aa9f85}body:has(.map-panel.expanded) .cave-preview{visibility:hidden}@media(max-width:800px){.cave-preview{top:100px;gap:6px;width:90%;flex-wrap:wrap}.cave-preview small{display:none}}';
 panel.innerHTML='<strong>CAVE TOUR</strong><select aria-label="Preview cave"></select><select aria-label="Preview chamber"></select><label><input type="checkbox" checked>Safe tour</label><small>WASD to explore · M for map</small>';
 document.head.append(style);document.getElementById('game').append(panel);
 const [caves,rooms]=panel.querySelectorAll('select'),safe=panel.querySelector('input');
 for(const c of tourMaps)caves.add(new Option(c.name,c.id));
 const requested=new URLSearchParams(location.search).get('cave');caves.value=tourMaps.some(c=>c.id===requested)?requested:explorationTour?'overworld':'gloom-cavern';if(explorationTour)panel.querySelector('strong').textContent='EXPLORATION TOUR';
 let current;
 function jump(){
  onJump();
  const p=session.world.players.get(session.id),room=stops(current)[Number(rooms.value)];
  p.mapId=p.state.mapId=current.id;p.x=room.x;p.z=room.z+1;p.path=[];p.state.invulnerable=safe.checked?1e8:0;session.input={x:0,z:0,angle:0};session.publish();
 }
 function select(){current=tourMaps.find(c=>c.id===caves.value);rooms.replaceChildren();stops(current).forEach((r,i)=>rooms.add(new Option(`${i+1}. ${r.name}`,String(i))));jump();}
 caves.onchange=select;rooms.onchange=jump;safe.onchange=()=>{session.world.players.get(session.id).state.invulnerable=safe.checked?1e8:0;};select();
 return()=>{panel.remove();style.remove();};
}
