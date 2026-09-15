import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {registerHooks} from 'node:module';
import * as T from '../dist/vendor/three.core.js';
import {CLASS_LIST,CLASSES,classAppearance} from '../dist/classes.js';
import {createPlayableCharacter} from '../dist/playable-characters.js';
import {menuNavigationMarkup,updateMenuNavigation} from '../dist/menu-chrome.js';
import {sliceBetween,readDist} from './helpers/source.mjs';

// dist/model-kit.js imports the bare 'three' specifier, which only the page's import map
// resolves; match it in Node the way tests/npc-portraits.test.mjs does for GLTFLoader.js.
const hook=registerHooks({resolve(specifier,context,nextResolve){
 if(specifier==='three')return nextResolve(new URL('../dist/vendor/three.module.js',import.meta.url).href,context);
 if(specifier==='three/addons/utils/BufferGeometryUtils.js')return nextResolve(new URL('../dist/vendor/utils/BufferGeometryUtils.js',import.meta.url).href,context);
 return nextResolve(specifier,context);
}});
const {getRig,createModelCache}=await import('../dist/model-kit.js');
hook.deregister();

test('Reaver armor and axe survive gameplay batching and follow their animated joints',()=>{
 const ctx={prefabs:{}},{cloneModel}=createModelCache(ctx);
 const model=cloneModel('C03'),study=createPlayableCharacter('reaver');
 const triangles=root=>{let count=0;root.traverse(n=>{if(n.isMesh)count+=(n.geometry.index?.count??n.geometry.attributes.position.count)/3;});return count;};
 assert.equal(triangles(model),triangles(study));
 assert.equal(model.userData.characterConcept,'C03');
 assert.equal(model.getObjectByName('head').parent.name,'body');
 const rig=getRig(model);assert.equal(rig.arms.length,2);assert.equal(rig.legs.length,2);assert.equal(rig.baseY,1.3);
 for(const [piece,joint] of [['bulwark-pauldron','armL'],['gauntlet-1','armR'],['greave--1','legL'],['weapon','armR']]){
  const part=model.getObjectByName(piece),pivot=model.getObjectByName(joint);
  assert.ok(part,piece);
  let ancestor=part.parent;while(ancestor&&ancestor!==pivot)ancestor=ancestor.parent;
  assert.equal(ancestor,pivot,`${piece} must stay on ${joint}`);
  const before=new T.Box3().setFromObject(part).getCenter(new T.Vector3());
  pivot.rotation.x=-.7;model.updateMatrixWorld(true);
  const after=new T.Box3().setFromObject(part).getCenter(new T.Vector3());
  assert.ok(before.distanceTo(after)>.005,`${piece} must move with its joint`);
  pivot.rotation.x=0;model.updateMatrixWorld(true);
 }
});

test('gameplay optimization and actor cloning preserve Geralt face materials and attached equipment',()=>{
 const ctx={prefabs:{}},{cloneModel}=createModelCache(ctx);
 const first=cloneModel('geralt'),second=cloneModel('geralt');
 const face=root=>{let result;root.traverse(n=>{if(Array.isArray(n.material))result=n;});return result;};
 const originalFace=face(ctx.prefabs.geralt),firstFace=face(first),secondFace=face(second);
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
 const rig=getRig(first);assert.equal(rig.arms.length,2);assert.equal(rig.legs.length,2);assert.equal(rig.baseY,1.3);
});

const pickerSource=readDist('roster-picker.js').replace(/^import .*;\n/gm,'').replace('export function','function');
function pickerHarness(state={classId:'sorcerer',appearanceId:'W10'}){
 const nodes=new Map(),handlers={},choices=[];let saved=JSON.stringify({classId:'sorcerer',appearanceId:'W06'});
 const node=selector=>{if(!nodes.has(selector))nodes.set(selector,{style:{},attributes:{},setAttribute(key,value){this.attributes[key]=value;},focus(){this.focused=true;},addEventListener(event,handler){handlers[`${selector}:${event}`]=handler;}});return nodes.get(selector);};
 const buttons=CLASS_LIST.map(c=>Object.assign(node(`[data-class-choice="${c.id}"]`),{dataset:{classChoice:c.id},querySelector:()=>node(`portrait:${c.id}`)}));
 const navigation=[...menuNavigationMarkup().matchAll(/data-menu="([^"]+)"/g)].map(([,menu])=>Object.assign(node(`[data-menu="${menu}"]`),{dataset:{menu}}));
 const classes=new Set(),classList={toggle(name,enabled){enabled?classes.add(name):classes.delete(name);},contains:name=>classes.has(name)};
 const dialog={classList,setAttribute(){},querySelector:node,querySelectorAll:selector=>selector==='[data-menu]'?navigation:buttons,addEventListener:(event,handler)=>{handlers[event]=handler;},showModal(){this.open=true;},close(){this.open=false;}};
 const context=vm.createContext({CLASS_LIST,CLASSES,classAppearance,menuNavigationMarkup,updateMenuNavigation,document:{createElement:()=>dialog,body:{append(){}}},localStorage:{getItem:()=>saved,setItem:(_key,value)=>{saved=value;}},prepareCharacterPortraits:async()=>{},portraitFor:(id,look)=>`${id}/${look}.png`,getState:()=>state,onChoose:choice=>{choices.push(choice);return true;},onClose(){}});
 vm.runInContext(pickerSource+'\nvar picker=createRosterPicker({getState,onChoose,onClose});',context);
 return {context,node,handlers,choices,dialog,buttons,saved:()=>JSON.parse(saved)};
}
test('picker removes skin controls, replaces old Sorcerer preferences, and submits playable Geralt',async()=>{
 const {context,node,handlers,choices,dialog,saved}=pickerHarness();
 await context.picker.show();
 assert.equal(node('.chronicle-sidebar').hidden,false);
 assert.equal(dialog.classList.contains('roster-initial'),false);
 assert.doesNotMatch(dialog.innerHTML,/Sorcerer skins|roster-appearances|data-appearance-choice/);
 assert.match(node('.roster-classes').innerHTML,/data-class-choice="geralt"/);
 assert.equal(node('.roster-portrait img').src,'sorcerer/W07.png');
 node('.roster-confirm').onclick();assert.equal(choices[0].appearanceId,'W07');context.picker.resolve({ok:true});
 assert.equal(saved().appearanceId,'W07');
 await context.picker.show();handlers.click({target:{closest:()=>({dataset:{classChoice:'geralt'}})}});
 assert.equal(node('.roster-name').textContent,'Geralt');assert.match(node('.roster-skills').innerHTML,/Igni/);
 node('.roster-confirm').onclick();assert.equal(choices[1].classId,'geralt');assert.equal(choices[1].appearanceId,'geralt');
 context.picker.resolve({ok:true});assert.equal(saved().classId,'geralt');
});

test('radial picker cycles and wraps in both directions, follows keyboard focus, and locks selection while joining',async()=>{
 const {context,node,handlers,choices,buttons,dialog}=pickerHarness({});
 await context.picker.show();
 assert.equal(node('.chronicle-sidebar').hidden,true);
 assert.equal(dialog.classList.contains('roster-initial'),true);
 node('.roster-previous').onclick();assert.equal(node('.roster-name').textContent,CLASS_LIST.at(-1).name);
 node('.roster-next').onclick();assert.equal(node('.roster-name').textContent,CLASS_LIST[0].name);
 for(let i=1;i<=CLASS_LIST.length;i++){
  node('.roster-next').onclick();const hero=CLASS_LIST[i%CLASS_LIST.length];
  assert.equal(node('.roster-name').textContent,hero.name);
  assert.equal(node('.roster-portrait img').src,`${hero.id}/${hero.concept}.png`);
  assert.deepEqual(buttons.filter(b=>b.attributes['aria-pressed']==='true').map(b=>b.dataset.classChoice),[hero.id]);
 }
 let prevented=0;const key=key=>handlers['.roster-wheel:keydown']({key,preventDefault(){prevented++;},target:{closest:()=>buttons[0]}});
 key('ArrowRight');assert.equal(node('.roster-name').textContent,CLASS_LIST[1].name);assert.equal(buttons[1].focused,true);
 assert.equal(buttons.filter(b=>b.tabIndex===0).length,1);
 key('End');assert.equal(node('.roster-name').textContent,CLASS_LIST.at(-1).name);
 key('Home');assert.equal(node('.roster-name').textContent,CLASS_LIST[0].name);
 node('.roster-confirm').onclick();assert.equal(choices[0].classId,CLASS_LIST[0].id);
 assert.equal(node('.roster-previous').disabled,true);assert.equal(node('.roster-next').disabled,true);
 node('.roster-next').onclick();key('ArrowLeft');
 assert.equal(node('.roster-name').textContent,CLASS_LIST[0].name);assert.equal(prevented,4);
 context.picker.resolve({ok:false,reason:'Try again'});assert.equal(dialog.open,true);assert.equal(node('.roster-next').disabled,false);
 node('.roster-next').onclick();assert.equal(node('.roster-name').textContent,CLASS_LIST[1].name);
});
