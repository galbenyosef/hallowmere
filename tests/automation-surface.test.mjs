// Source-level snapshot; M11 replaces this with a contract test that imports installAutomationSurface().
import test from 'node:test';
import assert from 'node:assert/strict';
import {sliceBetween,readDist} from './helpers/source.mjs';

const main=readDist('main.js');

// Extract the top-level (depth-1) keys of an object literal, skipping over
// nested braces/parens/brackets and single/double-quoted strings. Spread
// entries (...foo) are not keys and are ignored. Good enough for this one
// hand-written object literal; not a general JS parser.
function topLevelKeys(objectLiteralText){
 let depth=0,i=0,expectKey=true;const keys=[],n=objectLiteralText.length;
 while(i<n){
  const c=objectLiteralText[i];
  if(c==="'"||c==='"'){
   const quote=c;i++;
   while(i<n&&objectLiteralText[i]!==quote){if(objectLiteralText[i]==='\\')i++;i++;}
   i++;expectKey=false;continue;
  }
  if(c==='{'||c==='('||c==='['){depth++;i++;if(depth===1&&c==='{')expectKey=true;continue;}
  if(c==='}'||c===')'||c===']'){depth--;i++;continue;}
  if(c===','&&depth===1){expectKey=true;i++;continue;}
  if(depth===1&&expectKey){
   const m=/^\s*(\.\.\.)?([A-Za-z_$][A-Za-z0-9_$]*)\s*(:|,|\})/.exec(objectLiteralText.slice(i));
   if(m){
    if(!m[1]&&m[3]===':')keys.push(m[2]);
    i+=m[0].length-m[3].length;expectKey=false;continue;
   }
  }
  i++;
 }
 return keys;
}

test('window.hallowmere exposes exactly the documented automation methods',()=>{
 const block=sliceBetween(main,'window.hallowmere={','const modelContext=document.modelContext;',{file:'dist/main.js'});
 const keys=topLevelKeys(block.slice(block.indexOf('{')));
 assert.deepEqual([...keys].sort(),['getState','pause','resume','showControls']);
});

test('the two MCP tools keep their documented names and the control_warden action enum',()=>{
 const block=sliceBetween(main,'if(modelContext?.registerTool){','// Begin the score during loading',{file:'dist/main.js'});
 const names=[...block.matchAll(/register\(\{name:'([^']+)'/g)].map(m=>m[1]);
 assert.deepEqual(names,['get_vigil_state','control_warden']);
 const wardenTool=sliceBetween(block,"name:'control_warden'",'});window.addEventListener',{file:'dist/main.js'});
 const enumMatch=/action:\{type:'string',enum:\[([^\]]+)\]/.exec(wardenTool);
 assert.ok(enumMatch,'control_warden action enum not found');
 const actions=enumMatch[1].split(',').map(s=>s.trim().replace(/^'|'$/g,''));
 assert.deepEqual(actions,['move','attack','bolt','dodge','nova','heal','pause','resume','interact','service','inventory','equip','consume']);
});
