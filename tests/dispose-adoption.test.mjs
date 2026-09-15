import test from 'node:test';
import assert from 'node:assert/strict';
import {disposeSubtree} from '../dist/dispose.js';

// Reference implementations, copied verbatim from the dist/*.js originals so a
// mismatch here means the disposeSubtree options chosen at the call sites no
// longer reproduce the original loop exactly. Each block below is byte-identical
// to its source lines (indentation included); only the wrapping differs.

let combatEffectsDispose;
{
 function dispose(root) {
  root.removeFromParent();
  root.traverse(node=>{if(!node.isSprite)node.geometry?.dispose();node.material?.dispose();});
 }
 combatEffectsDispose=dispose;
}

export function disposeClassEffect(root){
 if(root.userData.effectDisposed)return;root.userData.effectDisposed=true;root.removeFromParent();
 const geometry=new Set(),materials=new Set();root.traverse(n=>{if(n.geometry&&!n.isSprite)geometry.add(n.geometry);if(n.material)for(const m of Array.isArray(n.material)?n.material:[n.material])materials.add(m);});
 geometry.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());
}

export function disposeActor(model){model.removeFromParent();const materials=new Set();model.traverse(n=>{if(n.material)for(const m of Array.isArray(n.material)?n.material:[n.material])materials.add(m);});materials.forEach(m=>m.dispose());}

function releaseGeometry(root){const resources=new Set();root.traverse(n=>{if(n.geometry&&!n.isSprite)resources.add(n.geometry);if(n.material)resources.add(n.material);});resources.forEach(r=>r.dispose());root.removeFromParent();}

// Duck-typed fixture, matching tests/dispose.test.mjs's shape (a plain object tree
// is all disposeSubtree and these originals need: traverse/removeFromParent/geometry
// /material/isSprite/isLight/dispose). userData defaults to {} so the class-effects
// guard (root.userData.effectDisposed) never has to be special-cased per tree.
function fixture(){
 const log=[];
 const resource=name=>({name,disposed:0,dispose(){this.disposed++;log.push(name);}});
 const node=(name,props={})=>{
  const self={name,children:[],removed:0,userData:{},...props};
  self.traverse=fn=>{fn(self);for(const child of self.children)child.traverse(fn);};
  self.removeFromParent=()=>{self.removed++;log.push(`remove:${name}`);};
  return self;
 };
 return {log,resource,node};
}
const lightNode=f=>{
 const light={name:'light',children:[],disposed:0,isLight:true,dispose(){this.disposed++;f.log.push('light');}};
 light.traverse=fn=>fn(light);
 return light;
};

test('combat-effects.js dispose(root) matches disposeSubtree({removeFromParent:"before",dedupe:false,skipSpriteGeometry:true,arrayMaterials:false})',()=>{
 const build=()=>{
  const f=fixture(),gUnique=f.resource('gUnique'),gShared=f.resource('gShared'),matA=f.resource('matA'),matB=f.resource('matB'),matSprite=f.resource('matSprite'),gSprite=f.resource('gSprite');
  const light=lightNode(f);
  const root=f.node('root',{children:[
   f.node('groupA',{children:[
    f.node('meshUnique',{geometry:gUnique,material:matA}),
    f.node('meshShared1',{geometry:gShared,material:matA}),
   ]}),
   f.node('meshShared2',{geometry:gShared,material:matB}),
   f.node('sprite',{isSprite:true,geometry:gSprite,material:matSprite}),
   light,
  ]});
  return {...f,root,light,gSprite};
 };
 const a=build(),b=build();
 combatEffectsDispose(a.root);
 disposeSubtree(b.root,{removeFromParent:'before',dedupe:false,skipSpriteGeometry:true,arrayMaterials:false});
 assert.deepEqual(a.log,['remove:root','gUnique','matA','gShared','matA','gShared','matB','matSprite']);
 assert.deepEqual(a.log,b.log);
 assert.equal(a.gSprite.disposed,0);assert.equal(b.gSprite.disposed,0);
 assert.equal(a.light.disposed,0);assert.equal(b.light.disposed,0);
});

test('combat-effects.js dispose(root) throws on an array material, same as disposeSubtree arrayMaterials:false',()=>{
 const ref=fixture(),adopted=fixture();
 assert.throws(()=>combatEffectsDispose(ref.node('root',{children:[ref.node('m',{material:[ref.resource('x')]})]})),TypeError);
 assert.throws(()=>disposeSubtree(adopted.node('root',{children:[adopted.node('m',{material:[adopted.resource('x')]})]}),{dedupe:false,arrayMaterials:false}),TypeError);
});

test('class-effects.js disposeClassEffect(root) matches disposeSubtree({removeFromParent:"before",skipSpriteGeometry:true})',()=>{
 const build=()=>{
  const f=fixture();
  const gUnique=f.resource('gUnique'),gShared=f.resource('gShared'),matUnique=f.resource('matUnique'),matShared=f.resource('matShared');
  const matArrA=f.resource('matArrA'),matArrB=f.resource('matArrB'),matSprite=f.resource('matSprite'),gSprite=f.resource('gSprite');
  const textureMap=f.resource('textureMap'),matMap=f.resource('matMap');matMap.map=textureMap;
  const root=f.node('root',{children:[
   f.node('groupA',{children:[
    f.node('meshUnique',{geometry:gUnique,material:matUnique}),
    f.node('meshSharedGeo1',{geometry:gShared,material:matShared}),
    f.node('meshSharedGeo2',{geometry:gShared,material:matShared}),
   ]}),
   f.node('meshArray',{material:[matArrA,matArrB]}),
   f.node('sprite',{isSprite:true,geometry:gSprite,material:matSprite}),
   f.node('meshMap',{material:matMap}),
  ]});
  return {...f,root,gSprite,textureMap};
 };
 const a=build(),b=build();
 disposeClassEffect(a.root);
 disposeSubtree(b.root,{removeFromParent:'before',skipSpriteGeometry:true});
 assert.deepEqual(a.log,['remove:root','gUnique','gShared','matUnique','matShared','matArrA','matArrB','matSprite','matMap']);
 assert.deepEqual(a.log,b.log);
 assert.equal(a.gSprite.disposed,0);assert.equal(b.gSprite.disposed,0);
 assert.equal(a.textureMap.disposed,0);assert.equal(b.textureMap.disposed,0);
 // The disposed-once guard reads root.userData.effectDisposed and stays at the
 // call site, not in disposeSubtree's options; a second call is a no-op here.
 const before=a.log.length;disposeClassEffect(a.root);assert.equal(a.log.length,before);
});

test('multiplayer-view.js disposeActor(model) matches disposeSubtree({removeFromParent:"before",geometry:false})',()=>{
 const build=()=>{
  const f=fixture();
  const gUnique=f.resource('gUnique'),gShared=f.resource('gShared'),matUnique=f.resource('matUnique'),matShared=f.resource('matShared'),matArrA=f.resource('matArrA'),matArrB=f.resource('matArrB');
  const root=f.node('root',{children:[
   f.node('groupA',{children:[
    f.node('meshUnique',{geometry:gUnique,material:matUnique}),
    f.node('meshShared',{geometry:gShared,material:matShared}),
   ]}),
   f.node('meshArray',{material:[matArrA,matArrB]}),
   f.node('meshShared2',{material:matShared}),
  ]});
  return {...f,root,gUnique,gShared};
 };
 const a=build(),b=build();
 disposeActor(a.root);
 disposeSubtree(b.root,{removeFromParent:'before',geometry:false});
 assert.deepEqual(a.log,['remove:root','matUnique','matShared','matArrA','matArrB']);
 assert.deepEqual(a.log,b.log);
 assert.equal(a.gUnique.disposed,0);assert.equal(b.gUnique.disposed,0);
 assert.equal(a.gShared.disposed,0);assert.equal(b.gShared.disposed,0);
});

test('enemy-visuals.js releaseGeometry(root) matches disposeSubtree({removeFromParent:"after",order:"interleaved",skipSpriteGeometry:true,arrayMaterials:false})',()=>{
 const build=()=>{
  const f=fixture();
  const gUnique=f.resource('gUnique'),gSharedGeo=f.resource('gSharedGeo'),matUnique=f.resource('matUnique'),matA=f.resource('matA'),matB=f.resource('matB'),matSprite=f.resource('matSprite'),gSprite=f.resource('gSprite');
  const root=f.node('root',{children:[
   f.node('groupA',{children:[
    f.node('meshUnique',{geometry:gUnique,material:matUnique}),
    f.node('meshSharedGeo1',{geometry:gSharedGeo,material:matA}),
    f.node('meshSharedGeo2',{geometry:gSharedGeo,material:matB}),
   ]}),
   f.node('sprite',{isSprite:true,geometry:gSprite,material:matSprite}),
  ]});
  return {...f,root,gSprite};
 };
 const a=build(),b=build();
 releaseGeometry(a.root);
 disposeSubtree(b.root,{removeFromParent:'after',order:'interleaved',skipSpriteGeometry:true,arrayMaterials:false});
 assert.deepEqual(a.log,['gUnique','matUnique','gSharedGeo','matA','matB','matSprite','remove:root']);
 assert.deepEqual(a.log,b.log);
 assert.equal(a.gSprite.disposed,0);assert.equal(b.gSprite.disposed,0);
});

test('enemy-visuals.js releaseGeometry(root) throws on an array material, same as disposeSubtree arrayMaterials:false',()=>{
 const ref=fixture(),adopted=fixture();
 assert.throws(()=>releaseGeometry(ref.node('root',{children:[ref.node('m',{material:[ref.resource('x')]})]})),TypeError);
 assert.throws(()=>disposeSubtree(adopted.node('root',{children:[adopted.node('m',{material:[adopted.resource('x')]})]}),{order:'interleaved',arrayMaterials:false}),TypeError);
});
