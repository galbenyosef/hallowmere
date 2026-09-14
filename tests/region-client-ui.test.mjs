import test from 'node:test';
import assert from 'node:assert/strict';
import {regionActionName,usesLegacyTelegraph} from '../dist/region-client-ui.js';
import {ENEMY_TYPES} from '../dist/combat.js';

test('objective defense waves and personal checkpoint activation have distinct contextual labels',()=>{
 assert.equal(regionActionName({name:'Willow Shrine',operation:'objective',active:true,locked:true,wave:2,waves:2}),'Willow Shrine · Defend · Wave 2 / 2');
 assert.equal(regionActionName({name:'Wayfarer’s lantern',operation:'checkpoint',active:true}),'Rest at Wayfarer’s lantern');
 assert.equal(regionActionName({name:'Old adit',operation:'travel',locked:true}),'Old adit · Sealed');
 assert.equal(regionActionName({name:'West Lift',operation:'objective',completed:true}),'West Lift · Complete');
});

test('server hazard enemies never add misleading legacy circles while original attacks keep telegraphs',()=>{
 for(const type of ['hollow','hound','revenant','boss','cutthroat','ghoul','gravecaller','bone-colossus','thorn-ghoul','shard-hound','ash-stalker'])assert.equal(usesLegacyTelegraph(type),true,type);
 for(const [type,data] of Object.entries(ENEMY_TYPES))if(data.regionalAttack)assert.equal(usesLegacyTelegraph(type),false,type);
 assert.equal(usesLegacyTelegraph('unknown'),false);
});
