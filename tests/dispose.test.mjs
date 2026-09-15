import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from '../dist/vendor/three.core.js';
import {disposeSubtree} from '../dist/dispose.js';

// Duck-typed stand-ins: dispose.js imports nothing, so a plain object with
// traverse/removeFromParent is all it needs.
function fixture(){
 const log=[];
 const resource=name=>({name,disposed:0,dispose(){this.disposed++;log.push(name);}});
 const node=(name,props={})=>{
  const self={name,children:[],removed:0,...props};
  self.traverse=fn=>{fn(self);for(const child of self.children)child.traverse(fn);};
  self.removeFromParent=()=>{self.removed++;log.push(`remove:${name}`);};
  return self;
 };
 return {log,resource,node};
}

test('the default subtree pass dedupes shared resources and disposes geometry before material',()=>{
 const {log,resource,node}=fixture();
 const shared=resource('sharedMaterial'),g1=resource('g1'),g2=resource('g2'),g3=resource('g3');
 const root=node('root',{children:[
  node('a',{geometry:g1,material:shared}),
  node('b',{geometry:g2,material:shared,children:[node('c',{geometry:g3,material:resource('own')})]}),
 ]});
 disposeSubtree(root);
 assert.deepEqual(log,['g1','g2','g3','sharedMaterial','own']);
 assert.equal(shared.disposed,1);
 assert.equal(root.removed,0);
});

test('array materials are expanded, and arrayMaterials:false reproduces the copies that never expanded them',()=>{
 const {log,resource,node}=fixture();
 const a=resource('a'),b=resource('b');
 disposeSubtree(node('root',{children:[node('m',{material:[a,b]})]}));
 assert.deepEqual(log,['a','b']);
 assert.equal(a.disposed,1);
 // combat-effects.js and enemy-visuals.js call material.dispose() straight on the
 // value; an array would throw there, and it throws here with arrayMaterials:false.
 const plain=fixture();
 assert.throws(()=>disposeSubtree(plain.node('root',{children:[plain.node('m',{material:[plain.resource('x')]})]}),{arrayMaterials:false}),TypeError);
 // Nothing in the tree carries array materials, so the widening is unobservable.
 const single=fixture(),only=single.resource('only');
 disposeSubtree(single.node('root',{children:[single.node('m',{material:only})]}),{arrayMaterials:false});
 assert.equal(only.disposed,1);
});

test('dedupe:false disposes inline during the walk, once per node, like combat-effects and removeObject',()=>{
 const {log,resource,node}=fixture();
 const shared=resource('shared');
 const root=node('root',{children:[node('a',{geometry:resource('g1'),material:shared}),node('b',{geometry:resource('g2'),material:shared})]});
 disposeSubtree(root,{removeFromParent:'before',dedupe:false,skipSpriteGeometry:true});
 assert.deepEqual(log,['remove:root','g1','shared','g2','shared']);
 assert.equal(shared.disposed,2);
});

test('removeFromParent runs before or after the disposals, or not at all',()=>{
 for(const [option,expected] of [['before',['remove:root','g']],['after',['g','remove:root']],[false,['g']]]){
  const {log,resource,node}=fixture();
  const root=node('root',{children:[node('a',{geometry:resource('g')})]});
  disposeSubtree(root,{removeFromParent:option});
  assert.deepEqual(log,expected,`removeFromParent:${option}`);
  assert.equal(root.removed,option?1:0);
 }
});

test('textures are collected off material.map and disposed after the materials',()=>{
 const {log,resource,node}=fixture();
 const map=resource('map'),mA=resource('mA'),mB=resource('mB');
 mA.map=map;mB.map=map;
 const root=node('root',{children:[node('a',{geometry:resource('g'),material:mA}),node('b',{material:mB}),node('c',{material:resource('noMap')})]});
 disposeSubtree(root,{lights:true,textures:true});
 assert.deepEqual(log,['g','mA','mB','noMap','map']);
 assert.equal(map.disposed,1);
 // Without the option the map survives, the way disposeTree and disposeClassEffect leave it.
 const kept=fixture(),keptMap=kept.resource('map'),material=kept.resource('m');
 material.map=keptMap;
 disposeSubtree(kept.node('root',{children:[kept.node('a',{material})]}));
 assert.equal(keptMap.disposed,0);
});

test('order selects the geralt/predator, hunt-king and enemy-visuals sequences',()=>{
 const build=()=>{
  const f=fixture(),map=f.resource('map'),mat=f.resource('mat');
  mat.map=map;
  return {...f,map,mat,root:f.node('root',{children:[f.node('a',{geometry:f.resource('g1'),material:mat}),f.node('b',{geometry:f.resource('g2'),material:f.resource('mat2')})]})};
 };
 const first=build();
 disposeSubtree(first.root,{order:'material-first',textures:true,extraMaterials:[first.resource('extra')]});
 assert.deepEqual(first.log,['mat','mat2','extra','map','g1','g2']);
 const second=build();
 disposeSubtree(second.root,{order:'geometry-first',textures:true});
 assert.deepEqual(second.log,['g1','g2','mat','mat2','map']);
 const third=build();
 disposeSubtree(third.root,{removeFromParent:'after',order:'interleaved',skipSpriteGeometry:true});
 assert.deepEqual(third.log,['g1','mat','g2','mat2','remove:root']);
});

test('geometry can be skipped wholesale or per resource, and sprites keep theirs',()=>{
 const actor=fixture(),prefab=actor.resource('prefab');
 const model=actor.node('root',{children:[actor.node('a',{geometry:prefab,material:actor.resource('cloned')})]});
 disposeSubtree(model,{removeFromParent:'before',geometry:false});
 assert.deepEqual(actor.log,['remove:root','cloned']);
 assert.equal(prefab.disposed,0);
 const shared=fixture(),keep=shared.resource('keep'),drop=shared.resource('drop');
 disposeSubtree(shared.node('root',{children:[shared.node('a',{geometry:keep}),shared.node('b',{geometry:drop})]}),{skipGeometry:new Set([keep])});
 assert.deepEqual(shared.log,['drop']);
 const sprites=fixture(),spriteGeometry=sprites.resource('spriteGeometry');
 disposeSubtree(sprites.node('root',{children:[sprites.node('s',{isSprite:true,geometry:spriteGeometry,material:sprites.resource('spriteMaterial')})]}),{skipSpriteGeometry:true});
 assert.deepEqual(sprites.log,['spriteMaterial']);
 assert.equal(spriteGeometry.disposed,0);
});

test('lights are released only when asked, and traverse:false leaves only the explicit lists',()=>{
 const lit=fixture();
 const light={name:'light',isLight:true,disposed:0,children:[],dispose(){this.disposed++;lit.log.push('light');}};
 light.traverse=fn=>fn(light);
 const root=lit.node('root',{children:[light,lit.node('a',{geometry:lit.resource('g')})]});
 disposeSubtree(root,{lights:true});
 assert.deepEqual(lit.log,['light','g']);
 const quiet=fixture();
 const other={name:'light',isLight:true,children:[],dispose(){quiet.log.push('light');}};
 other.traverse=fn=>fn(other);
 disposeSubtree(quiet.node('root',{children:[other]}));
 assert.deepEqual(quiet.log,[]);
 // region-environment.js disposes its geometry and material dictionaries, not the tree.
 const kit=fixture(),unused=kit.resource('unusedGeometry');
 const group=kit.node('region',{children:[kit.node('a',{geometry:kit.resource('inTree'),material:kit.resource('inTreeMaterial')})]});
 disposeSubtree(group,{removeFromParent:'before',traverse:false,extraGeometries:[unused],extraMaterials:[kit.resource('dictMaterial')]});
 assert.deepEqual(kit.log,['remove:region','unusedGeometry','dictMaterial']);
});

test('a real three.js group is walked in traverse order and every resource reports one dispose',()=>{
 const scene=new T.Scene(),root=new T.Group();
 root.name='root';scene.add(root);
 const texture=new T.Texture();
 const shared=new T.MeshStandardMaterial({color:0x445566});
 shared.map=texture;
 const names=[],events=[];
 const watch=(resource,label)=>{resource.addEventListener('dispose',()=>events.push(label));return resource;};
 watch(texture,'texture');watch(shared,'shared');
 for(const [index,geometry] of [new T.BoxGeometry(1,1,1),new T.SphereGeometry(1,8,6),new T.ConeGeometry(.2,.4,5)].entries()){
  watch(geometry,`geometry${index}`);
  const mesh=new T.Mesh(geometry,index===2?watch(new T.MeshStandardMaterial({color:0x112233}),'own'):shared);
  mesh.name=`mesh${index}`;
  (index===2?root.children[1]:root).add(mesh);
 }
 root.traverse(node=>names.push(node.name));
 assert.deepEqual(names,['root','mesh0','mesh1','mesh2']);
 assert.equal(root.parent,scene);
 disposeSubtree(root,{removeFromParent:'before',textures:true});
 assert.equal(root.parent,null);
 assert.deepEqual(scene.children,[]);
 assert.deepEqual(events,['geometry0','geometry1','geometry2','shared','own','texture']);
 // A second pass over the same tree would report the same resources again, so the
 // disposed-once guards stay at the call sites.
 disposeSubtree(root,{textures:true});
 assert.equal(events.length,12);
});
