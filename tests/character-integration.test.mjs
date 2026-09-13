import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import * as T from '../dist/vendor/three.core.js';
import {CLASS_LIST,CLASSES,classAppearance} from '../dist/classes.js';
import {createPlayableCharacter} from '../dist/playable-characters.js';

const main=await readFile(new URL('../dist/main.js',import.meta.url),'utf8');
const utilities=await readFile(new URL('../dist/vendor/utils/BufferGeometryUtils.js',import.meta.url),'utf8');
const {mergeGeometries}=await import('data:text/javascript;base64,'+Buffer.from(utilities.replace("from 'three'",`from '${new URL('../dist/vendor/three.core.js',import.meta.url).href}'`)).toString('base64'));

test('gameplay optimization and actor cloning preserve Geralt face materials and attached equipment',()=>{
 const prefabs={},context=vm.createContext({T,CLASS_LIST,createPlayableCharacter,prefabs,mergeGeometries,Float32Array});
 vm.runInContext(main.slice(main.indexOf('function optimizeModel'),main.indexOf('function spawnEnemy')),context);
 const first=vm.runInContext("cloneModel('geralt')",context),second=vm.runInContext("cloneModel('geralt')",context);
 const face=root=>{let result;root.traverse(n=>{if(Array.isArray(n.material))result=n;});return result;};
 const originalFace=face(prefabs.geralt),firstFace=face(first),secondFace=face(second);
 assert.equal(firstFace.geometry.groups.length,6);
 for(let i=0;i<2;i++){
  assert.notEqual(firstFace.material[i],originalFace.material[i]);
  assert.notEqual(firstFace.material[i],secondFace.material[i]);
  assert.equal(firstFace.material[i].color.getHex(),originalFace.material[i].color.getHex());
 }
 for(const name of ['wolf-medallion','tied-back-white-hair','silver-weapon','dagger-weapon'])assert.ok(first.getObjectByName(name),name);
 assert.equal(first.getObjectByName('weapon').parent.name,'armR');
 assert.equal(first.getObjectByName('head').parent.name,'body');
 const nestedMeshes=root=>{let count=0;root.traverse(n=>{if(n.isMesh&&n.parent.isMesh)count++;});return count;};
 const study=createPlayableCharacter('geralt');
 assert.equal(nestedMeshes(first),nestedMeshes(study));
 const triangles=root=>{let count=0;root.traverse(n=>{if(n.isMesh)count+=(n.geometry.index?.count??n.geometry.getAttribute('position').count)/3;});return count;};
 assert.equal(triangles(first),triangles(study));
 const rig=context.getRig(first);assert.equal(rig.arms.length,2);assert.equal(rig.legs.length,2);assert.equal(rig.baseY,1.3);
});

const pickerSource=(await readFile(new URL('../dist/roster-picker.js',import.meta.url),'utf8')).replace(/^import .*;\n/gm,'').replace('export function','function');
test('picker removes skin controls, replaces old Sorcerer preferences, and submits playable Geralt',async()=>{
 const nodes=new Map(),handlers={},choices=[];let saved=JSON.stringify({classId:'sorcerer',appearanceId:'W06'});
 const node=selector=>{if(!nodes.has(selector))nodes.set(selector,{style:{},setAttribute(){},focus(){}});return nodes.get(selector);};
 const dialog={setAttribute(){},querySelector:node,querySelectorAll:()=>[],addEventListener:(event,handler)=>{handlers[event]=handler;},showModal(){this.open=true;},close(){this.open=false;}};
 const context=vm.createContext({CLASS_LIST,CLASSES,classAppearance,document:{createElement:()=>dialog,body:{append(){}}},localStorage:{getItem:()=>saved,setItem:(_key,value)=>{saved=value;}},prepareCharacterPortraits:async()=>{},portraitFor:(id,look)=>`${id}/${look}.png`,getState:()=>({classId:'sorcerer',appearanceId:'W10'}),onChoose:choice=>{choices.push(choice);return true;},onClose(){}});
 vm.runInContext(pickerSource+'\nvar picker=createRosterPicker({getState,onChoose,onClose});',context);
 await context.picker.show();
 assert.doesNotMatch(dialog.innerHTML,/Sorcerer skins|roster-appearances|data-appearance-choice/);
 assert.match(node('.roster-classes').innerHTML,/data-class-choice="geralt"/);
 assert.equal(node('.roster-portrait img').src,'sorcerer/W07.png');
 node('.roster-confirm').onclick();assert.equal(choices[0].appearanceId,'W07');context.picker.resolve({ok:true});
 assert.equal(JSON.parse(saved).appearanceId,'W07');
 await context.picker.show();handlers.click({target:{closest:()=>({dataset:{classChoice:'geralt'}})}});
 assert.equal(node('.roster-name').textContent,'Geralt');assert.match(node('.roster-skills').innerHTML,/Igni/);
 node('.roster-confirm').onclick();assert.equal(choices[1].classId,'geralt');assert.equal(choices[1].appearanceId,'geralt');
 context.picker.resolve({ok:true});assert.equal(JSON.parse(saved).classId,'geralt');
});
