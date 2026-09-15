import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync,readFileSync} from 'node:fs';
import {dirname,relative,resolve} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';

// The multiplayer server imports the simulation core through the server/*.mjs shims, so a
// single `import * as T from 'three'` or a `document.` reference anywhere in the closure of
// dist/world.js breaks the server at import time. This guard walks that closure and bites.
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..'),dist=resolve(root,'dist');
const ENTRY=resolve(dist,'world.js');
const DOM=/(?<![\w$.])(?:document|window|navigator|location|matchMedia|localStorage|sessionStorage|requestAnimationFrame|HTMLElement)\b/g;
const GLOBAL_DOCUMENT=/\bglobalThis\s*\.\s*document\b/g;
const STATIC=/(?:^|[;{}])\s*(?:import|export)\s*(?:[\w$*{}\s,]*?\bfrom\s*)?(['"])([^'"]+)\1/gm;
const DYNAMIC=/\bimport\s*\(\s*(['"])([^'"]+)\1\s*\)/g;
const REGEX_KEYWORD=/(?:^|[^\w$.])(?:return|typeof|instanceof|in|of|new|delete|void|throw|case|do|else|yield|await)$/;

// Blanks comments and literal text so campaign.js dialogue ("the window is open") never reads
// as a DOM reference. Newlines survive so line numbers stay true, `${}` expressions keep their
// code at any nesting depth, and regex literals are consumed so a pattern holding a quote
// cannot desynchronise the scan. keepText leaves literal text in place for import extraction.
function strip(source,keepText=false){
 let out='',i=0;
 const blank=s=>s.replace(/[^\n]/g,' '),keep=s=>keepText?s:blank(s);
 const regexAllowed=()=>{
  const before=out.replace(/\s+$/,''),ch=before.at(-1);
  if(!ch)return true;
  if(ch===')'||ch===']')return false;
  if(/[\w$]/.test(ch))return REGEX_KEYWORD.test(before);
  return true;
 };
 const literal=quote=>{
  out+=quote;i++;
  while(i<source.length){
   const c=source[i];
   if(c==='\\'){out+=keep(source.slice(i,i+2));i+=2;continue;}
   if(c===quote){out+=quote;i++;return;}
   out+=keep(c);i++;
  }
 };
 const template=()=>{
  out+='`';i++;
  while(i<source.length){
   const c=source[i];
   if(c==='\\'){out+=keep(source.slice(i,i+2));i+=2;continue;}
   if(c==='`'){out+='`';i++;return;}
   if(c==='$'&&source[i+1]==='{'){out+=keepText?'${':'  ';i+=2;code('}');if(source[i]==='}'){out+=keepText?'}':' ';i++;}continue;}
   out+=keep(c);i++;
  }
 };
 // Only consumes a real regex literal: an unterminated one is a misread division, so the
 // slash is emitted as an operator and the code after it stays visible to the DOM scan.
 const regex=()=>{
  const start=i;let j=i+1,cls=false,closed=false;
  while(j<source.length){
   const c=source[j];
   if(c==='\\'){j+=2;continue;}
   if(c==='\n')break;
   if(c==='[')cls=true;else if(c===']')cls=false;
   else if(c==='/'&&!cls){j++;while(j<source.length&&/[\w$]/.test(source[j]))j++;closed=true;break;}
   j++;
  }
  if(!closed){out+='/';i++;return;}
  out+=blank(source.slice(start,j));i=j;
 };
 const code=end=>{
  let depth=0;
  while(i<source.length){
   const c=source[i],n=source[i+1];
   if(c==='}'&&end){if(depth===0)return;depth--;out+=c;i++;continue;}
   if(c==='{'&&end)depth++;
   if(c==='/'&&n==='/'){const j=source.indexOf('\n',i),stop=j<0?source.length:j;out+=blank(source.slice(i,stop));i=stop;continue;}
   if(c==='/'&&n==='*'){const j=source.indexOf('*/',i+2),stop=j<0?source.length:j+2;out+=blank(source.slice(i,stop));i=stop;continue;}
   if(c==='/'&&regexAllowed()){regex();continue;}
   if(c==='\''||c==='"'){literal(c);continue;}
   if(c==='`'){template();continue;}
   out+=c;i++;
  }
 };
 code('');
 return out;
}

const lineOf=(source,index)=>source.slice(0,index).split('\n').length;
// `{location:1}` and `q.location` name properties rather than reading a global; a ternary
// (`x?window:y`) does read one, so the character before the name settles which it is. The
// regex lookbehind covers the dotted form and this covers the object-literal key.
const propertyKey=(code,m)=>/^\s*:/.test(code.slice(m.index+m[0].length,m.index+m[0].length+64))&&/[{,]\s*$/.test(code.slice(0,m.index));
function specifiers(source){
 const found=[];
 for(const pattern of [STATIC,DYNAMIC]){pattern.lastIndex=0;let m;while((m=pattern.exec(source)))found.push({spec:m[2],line:lineOf(source,m.index)});}
 return found;
}

// Breadth-first walk of relative static imports, re-exports, and dynamic imports from
// dist/world.js; the visited map is the cycle guard (world <-> region-campaign is a cycle).
function walkCore(){
 const modules=new Map(),queue=[ENTRY];
 while(queue.length){
  const file=queue.shift();
  if(modules.has(file))continue;
  assert.ok(existsSync(file),`core closure points at a missing module: ${relative(root,file)}`);
  const source=readFileSync(file,'utf8'),imports=specifiers(strip(source,true));
  modules.set(file,{name:relative(dist,file),source,imports});
  for(const {spec} of imports)if(spec.startsWith('./')||spec.startsWith('../'))queue.push(resolve(dirname(file),spec));
 }
 return modules;
}
const CORE=walkCore();

test('the walk reaches the whole simulation core shared with the server',t=>{
 const names=[...CORE.values()].map(m=>m.name).sort();
 t.diagnostic(`core closure (${names.length}): ${names.join(', ')}`);
 assert.ok(names.length>=15,`closure collapsed to ${names.length} modules: ${names.join(', ')}`);
 for(const name of ['world.js','combat.js','campaign.js','regions.js','multiplayer-protocol.js'])assert.ok(names.includes(name),`the walker never reached ${name}`);
});

test('the simulation core never imports three.js or anything vendored',()=>{
 const problems=[];
 for(const {name,imports} of CORE.values())for(const {spec,line} of imports){
  if(spec==='three'||spec.startsWith('three/')||spec.includes('vendor/'))problems.push(`dist/${name}:${line} imports '${spec}' — the server has no import map, so this breaks it at import time`);
 }
 if(problems.length)assert.fail(`the simulation core must not reach for three.js:\n${problems.join('\n')}`);
});

test('the simulation core never references the DOM',()=>{
 const problems=[];
 for(const {name,source} of CORE.values()){
  const code=strip(source);
  for(const pattern of [DOM,GLOBAL_DOCUMENT]){
   pattern.lastIndex=0;let m;
   while((m=pattern.exec(code)))if(!propertyKey(code,m))problems.push(`dist/${name}:${lineOf(code,m.index)} references \`${m[0]}\` — undefined in the Node server`);
  }
 }
 if(problems.length)assert.fail(`the simulation core must stay DOM-free:\n${problems.join('\n')}`);
});

test('the server shims re-export the shared simulation core',async()=>{
 const shims=[['world.mjs',['World']],['class-combat.mjs',['selectClass','castClassAbility','hitEnemy']],
  ['region-campaign.mjs',['initializeRegions','regionCommand','regionalKill']],['region-combat.mjs',['updateRegionEnemy','stepRegionHazards']]];
 for(const [shim,names] of shims){
  const module=await import(pathToFileURL(resolve(root,'server',shim)).href);
  for(const name of names)assert.equal(typeof module[name],'function',`server/${shim} no longer re-exports ${name}`);
 }
});
