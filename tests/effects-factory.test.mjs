import test from 'node:test';
import assert from 'node:assert/strict';
import {registerHooks} from 'node:module';
import * as T from '../dist/vendor/three.core.js';
import {installGlobals} from './helpers/dom.mjs';

// dist/effects-factory.js imports the bare 'three' specifier, which only the page's import map
// resolves; match it in Node the way tests/model-kit.test.mjs does.
const hook=registerHooks({resolve(specifier,context,nextResolve){
 if(specifier==='three')return nextResolve(new URL('../dist/vendor/three.module.js',import.meta.url).href,context);
 return nextResolve(specifier,context);
}});
const {createEffects}=await import('../dist/effects-factory.js');
hook.deregister();

// A minimal document stub: enough for floatText's literal $('float-layer') lookup
// (dist/dom.js's $ is document.getElementById) and its document.createElement('div').
function stubDocument(){
 const floatLayer={children:[],append(el){this.children.push(el);}};
 return {
  floatLayer,
  createElement(tag){return {tagName:tag,className:'',textContent:'',append(){}};},
  getElementById(id){return id==='float-layer'?floatLayer:null;},
 };
}

function makeCtx(){
 return {scene:new T.Group(),effects:[],floaters:[],combatEffects:{calls:[],steelImpact(pos){this.calls.push(pos);}}};
}

test('ringEffect pushes a ring effect with the expected geometry and material',()=>{
 const ctx=makeCtx(),{ringEffect}=createEffects(ctx);
 ringEffect({x:1,y:0,z:2},0xff3300,.2,.8,.5);
 assert.equal(ctx.effects.length,1);
 const effect=ctx.effects[0];
 assert.equal(effect.type,'ring');assert.equal(effect.from,.2);assert.equal(effect.to,.8);assert.equal(effect.life,.5);
 assert.equal(effect.mesh.geometry.type,'RingGeometry');
 assert.equal(effect.mesh.geometry.parameters.innerRadius,.89);assert.equal(effect.mesh.geometry.parameters.outerRadius,1);
 assert.equal(effect.mesh.material.type,'MeshBasicMaterial');assert.equal(effect.mesh.material.color.getHex(),0xff3300);
 assert.equal(effect.mesh.material.opacity,.8);assert.equal(effect.mesh.material.side,T.DoubleSide);assert.equal(effect.mesh.material.blending,T.AdditiveBlending);
 assert.ok(ctx.scene.children.includes(effect.mesh));
 assert.equal(effect.mesh.position.x,1);assert.equal(effect.mesh.position.z,2);
});

test('groundPing delegates to ringEffect with the fixed ping color/timing',()=>{
 const ctx=makeCtx(),{groundPing}=createEffects(ctx);
 groundPing({x:0,y:0,z:0});
 assert.equal(ctx.effects.length,1);
 const effect=ctx.effects[0];
 assert.equal(effect.type,'ring');assert.equal(effect.from,.25);assert.equal(effect.to,.65);assert.equal(effect.life,.45);
 assert.equal(effect.mesh.material.color.getHex(),0xc0c2a1);
});

test('slash pushes a slash effect sized and angled from its radius/angle arguments',()=>{
 const ctx=makeCtx(),{slash}=createEffects(ctx);
 slash({x:0,y:0,z:0},Math.PI/4,0x00ff88,1.2,.3);
 assert.equal(ctx.effects.length,1);
 const effect=ctx.effects[0];
 assert.equal(effect.type,'slash');assert.equal(effect.angle,Math.PI/4);assert.equal(effect.life,.3);
 assert.equal(effect.mesh.geometry.type,'RingGeometry');
 assert.ok(Math.abs(effect.mesh.geometry.parameters.innerRadius-1.158)<1e-9);
 assert.equal(effect.mesh.geometry.parameters.outerRadius,1.2);assert.equal(effect.mesh.geometry.parameters.thetaSegments,48);
 assert.equal(effect.mesh.material.type,'MeshBasicMaterial');assert.equal(effect.mesh.material.opacity,.48);
 assert.ok(ctx.scene.children.includes(effect.mesh));
});

test('particles pushes a point cloud sized to the requested count',()=>{
 const ctx=makeCtx(),{particles}=createEffects(ctx);
 particles({x:1,y:2,z:3},0x123456,50,2);
 assert.equal(ctx.effects.length,1);
 const effect=ctx.effects[0];
 assert.equal(effect.type,'particles');assert.equal(effect.life,.75);
 assert.ok(effect.mesh.isPoints);
 assert.equal(effect.mesh.geometry.attributes.position.count,50);
 assert.equal(effect.velocity.length,150);
 assert.equal(effect.mesh.material.type,'PointsMaterial');assert.equal(effect.mesh.material.color.getHex(),0x123456);
 assert.equal(effect.mesh.material.size,.065);assert.equal(effect.mesh.material.blending,T.AdditiveBlending);
 assert.ok(ctx.scene.children.includes(effect.mesh));
 assert.equal(effect.mesh.position.x,1);assert.equal(effect.mesh.position.y,2);assert.equal(effect.mesh.position.z,3);
});

test('telegraph builds a fill+edge group at the given radius/arc and adds it to the scene (not ctx.effects)',()=>{
 const ctx=makeCtx(),{telegraph}=createEffects(ctx);
 const group=telegraph({x:4,y:0,z:5},2,Math.PI,.3);
 assert.ok(group.isGroup);
 assert.equal(group.children.length,2);
 const [fill,edge]=group.children;
 assert.equal(fill.geometry.type,'CircleGeometry');assert.equal(fill.geometry.parameters.radius,2);assert.equal(fill.geometry.parameters.thetaLength,Math.PI);
 assert.equal(edge.geometry.type,'RingGeometry');assert.equal(edge.geometry.parameters.outerRadius,2);
 assert.equal(fill.material.opacity,.15);assert.equal(edge.material.opacity,.48);
 assert.equal(group.position.x,4);assert.equal(group.position.z,5);
 assert.ok(ctx.scene.children.includes(group));
 assert.equal(ctx.effects.length,0);
});

test('steelImpact forwards straight to ctx.combatEffects.steelImpact',()=>{
 const ctx=makeCtx(),{steelImpact}=createEffects(ctx),pos={x:1,y:0,z:1};
 steelImpact(pos);
 assert.deepEqual(ctx.combatEffects.calls,[pos]);
});

test('removeObject removes the object from the scene and disposes every geometry and material once',()=>{
 const ctx=makeCtx(),{removeObject}=createEffects(ctx);
 const group=new T.Group();
 const singleGeom=new T.BoxGeometry(1,1,1),singleMat=new T.MeshBasicMaterial();
 const single=new T.Mesh(singleGeom,singleMat);group.add(single);
 const arrayGeom=new T.BoxGeometry(1,1,1),matA=new T.MeshBasicMaterial(),matB=new T.MeshBasicMaterial();
 const arrayMat=new T.Mesh(arrayGeom,[matA,matB]);group.add(arrayMat);
 ctx.scene.add(group);
 let geomDisposals=0,matDisposals=0;
 for(const g of [singleGeom,arrayGeom])g.addEventListener('dispose',()=>geomDisposals++);
 for(const m of [singleMat,matA,matB])m.addEventListener('dispose',()=>matDisposals++);
 removeObject(group);
 assert.ok(!ctx.scene.children.includes(group));
 assert.equal(geomDisposals,2);
 assert.equal(matDisposals,3);
});

test('cancelAttack clears an active telegraph (removing and disposing it) and only sets recovery fields when stunned and alive',()=>{
 const ctx=makeCtx(),{telegraph,cancelAttack}=createEffects(ctx);
 const group=telegraph({x:0,y:0,z:0},1);
 let disposed=0;
 group.children[0].geometry.addEventListener('dispose',()=>disposed++);
 const e={telegraph:group,dead:false,phase:'windup',timer:.5,cooldown:1};
 cancelAttack(e,0);
 assert.equal(e.telegraph,null);
 assert.ok(!ctx.scene.children.includes(group));
 assert.equal(disposed,1);
 assert.equal(e.phase,'windup');assert.equal(e.timer,.5);assert.equal(e.cooldown,1); // stun=0: no recovery fields touched

 const stunned={telegraph:null,dead:false,phase:'attack',timer:0,cooldown:0};
 cancelAttack(stunned,1.4);
 assert.equal(stunned.phase,'recover');assert.equal(stunned.timer,1.4);assert.equal(stunned.cooldown,.8);

 const deadEnemy={telegraph:null,dead:true,phase:'attack',timer:0,cooldown:0};
 cancelAttack(deadEnemy,1.4);
 assert.equal(deadEnemy.phase,'attack');assert.equal(deadEnemy.timer,0);assert.equal(deadEnemy.cooldown,0); // dead: recovery skipped
});

test('floatText appends a damage-number element with the expected class/text and queues a floater',t=>{
 const ctx=makeCtx(),{floatText}=createEffects(ctx),doc=stubDocument();
 installGlobals(t,{document:doc});
 floatText('12',{x:1,y:0,z:2},'crit');
 assert.equal(doc.floatLayer.children.length,1);
 const element=doc.floatLayer.children[0];
 assert.equal(element.className,'damage-number crit');assert.equal(element.textContent,'12');
 assert.equal(ctx.floaters.length,1);
 const floater=ctx.floaters[0];
 assert.equal(floater.element,element);assert.equal(floater.pos.x,1);assert.equal(floater.pos.y,1.9);assert.equal(floater.pos.z,2);
 assert.equal(floater.life,.85); // non-'small' kind

 floatText('3',{x:0,y:0,z:0},'small');
 assert.equal(ctx.floaters[1].life,1.4);
});
