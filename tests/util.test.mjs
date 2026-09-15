import test from 'node:test';
import assert from 'node:assert/strict';
import {escapeHtml,clamp,clamp01} from '../dist/util.js';
import {clamp as combatClamp} from '../dist/combat.js';

// The inline copies, verbatim.
const inventoryEscape=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const journeysEscape=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const orbClamp=value=>Number.isFinite(value)?Math.max(0,Math.min(1,value)):0;

const strings=['','plain text','<script>alert(1)</script>','Bellkeeper&rsquo;s Requiem',
 'a&b<c>d"e\'f','"quoted"',"it's","&amp;",'&<>"\'','<<<>>>&&&','emoji ☕ and ünïcode',
 'Warding oak charm','rare weapon','Continue journey','x'.repeat(500)+'<'];

test('escapeHtml matches the journeys-menu copy on every character it replaces',()=>{
 for(const value of strings)assert.equal(escapeHtml(value),journeysEscape(value));
 assert.equal(escapeHtml('&<>"\''),'&amp;&lt;&gt;&quot;&#39;');
 assert.equal(escapeHtml('<b>&amp;</b>'),'&lt;b&gt;&amp;amp;&lt;/b&gt;');
 // Every replaced character maps to exactly one entity and nothing else moves.
 assert.equal(escapeHtml('a/b\\c`d=e'),'a/b\\c`d=e');
 assert.equal(escapeHtml('x'.repeat(500)+'<').endsWith('&lt;'),true);
});

test('escapeHtml only differs from the inventory copy for null and undefined',()=>{
 for(const value of strings)assert.equal(escapeHtml(value),inventoryEscape(value));
 for(const value of [0,1,-2.5,true,false,NaN,7,['a','b'],{toString(){return '<x>';}}])
  assert.equal(escapeHtml(value),inventoryEscape(value));
 // inventory.js renders these as text; its call sites never reach them.
 assert.equal(escapeHtml(null),'');
 assert.equal(escapeHtml(undefined),'');
 assert.equal(inventoryEscape(null),'null');
 assert.equal(inventoryEscape(undefined),'undefined');
});

test('clamp is combat.js clamp, argument order included',()=>{
 assert.equal(combatClamp.length,3);
 for(const [v,min,max] of [[5,0,10],[-1,0,10],[11,0,10],[0,0,0],[.5,0,1],[-0,-1,1],[3,10,0],[Infinity,0,1],[-Infinity,0,1]])
  assert.equal(clamp(v,min,max),combatClamp(v,min,max),`clamp(${v},${min},${max})`);
 assert.equal(clamp(7,0,10),7);
 assert.equal(clamp(-4,0,10),0);
 assert.equal(clamp(40,0,10),10);
 // Inverted bounds resolve to min, exactly as Math.max(min,Math.min(max,v)) does.
 assert.equal(clamp(5,10,0),10);
 assert.ok(Number.isNaN(clamp(NaN,0,1)));
});

test('clamp01 matches the resource-orbs copy and folds non-finite input to 0',()=>{
 for(const value of [0,1,.5,-.5,1.5,-0,1e-9,Number.MIN_VALUE,NaN,Infinity,-Infinity,'0.5',null,undefined])
  assert.equal(clamp01(value),orbClamp(value),`clamp01(${String(value)})`);
 assert.equal(clamp01(.42),.42);
 assert.equal(clamp01(-3),0);
 assert.equal(clamp01(3),1);
 assert.equal(clamp01(NaN),0);
 assert.equal(clamp01('0.5'),0);
 assert.notEqual(clamp01(NaN),clamp(NaN,0,1));
});
