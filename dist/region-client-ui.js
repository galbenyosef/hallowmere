import {ENEMY_TYPES} from './combat.js';

export function regionActionName(record){
 if(record.operation==='objective'&&record.active)return `${record.name} · Defend · Wave ${record.wave||1} / ${record.waves||2}`;
 if(record.locked)return `${record.name} · ${record.operation==='travel'?'Sealed':'Enemies nearby'}`;
 if(record.completed)return `${record.name} · Complete`;
 if(record.operation==='travel'&&record.name.startsWith('Return to '))return record.name;
 return `${({travel:'Enter',objective:'Activate',checkpoint:'Rest at',cache:'Open'})[record.operation]} ${record.name}`;
}

// Expansion enemies broadcast exact hazard shapes; the old attacks use local circles/arcs.
export function usesLegacyTelegraph(type){return !!ENEMY_TYPES[type]&&!ENEMY_TYPES[type].regionalAttack;}
