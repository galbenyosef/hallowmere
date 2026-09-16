import test from 'node:test';
import assert from 'node:assert/strict';
import {registerHooks} from 'node:module';
import * as T from '../dist/vendor/three.core.js';
import {installGlobals} from './helpers/dom.mjs';
import {createEffects} from '../dist/effects-factory.js';

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

// ============================================================================
// P8: effect pooling (ring/slash geometries+materials, particle buffers).
// ============================================================================

// ---- small, deterministic pooling-mechanics tests -------------------------

test('ringEffect reuses a released geometry/material from its pool instead of constructing fresh ones',()=>{
 const ctx=makeCtx(),{ringEffect,removeObject}=createEffects(ctx);
 ringEffect({x:0,y:0,z:0},0xff0000,0,1,.5);
 const first=ctx.effects.at(-1).mesh,firstGeometry=first.geometry,firstMaterial=first.material;
 removeObject(first);
 ringEffect({x:5,y:0,z:5},0x00ff00,0,1,.5);
 const second=ctx.effects.at(-1).mesh;
 assert.equal(second.geometry,firstGeometry,'the released ring geometry is reused, not reallocated');
 assert.equal(second.material,firstMaterial,'the released ring material is reused, not reallocated');
 assert.equal(second.material.color.getHex(),0x00ff00,'the reused material picks up the new color');
 assert.equal(second.material.opacity,.8,'the reused material opacity is reset to the original constructor value');
 assert.equal(second.scale.x,1);assert.equal(second.scale.y,1);assert.equal(second.scale.z,1);
});

test('slash pools geometries per radius (same radius reused; a different radius gets its own pool; material pool is shared)',()=>{
 const ctx=makeCtx(),{slash,removeObject}=createEffects(ctx);
 slash({x:0,y:0,z:0},0,0xff0000,1.2,.3);
 const a=ctx.effects.at(-1).mesh,geomA=a.geometry,matA=a.material;
 removeObject(a);
 slash({x:1,y:0,z:1},.5,0x00ff00,1.2,.3);
 const b=ctx.effects.at(-1).mesh;
 assert.equal(b.geometry,geomA,'same radius reuses the released geometry');
 assert.equal(b.material,matA,'the slash material pool is shared regardless of radius');
 removeObject(b);
 slash({x:2,y:0,z:2},1,0x0000ff,2,.3);
 const c=ctx.effects.at(-1).mesh;
 assert.notEqual(c.geometry,geomA,"a different radius does not reuse another radius's geometry");
 assert.equal(c.material,matA,'the material pool is still reused across radii');
 assert.equal(c.geometry.parameters.outerRadius,2);
});

test('particles pools geometry+velocity buffers per count, zeroing the position buffer and refilling velocity on reuse',()=>{
 const ctx=makeCtx(),{particles,removeObject}=createEffects(ctx);
 particles({x:0,y:0,z:0},0xff0000,10,2);
 const first=ctx.effects.at(-1),mesh1=first.mesh,geom1=mesh1.geometry,velocity1=first.velocity;
 const data1=geom1.attributes.position.array;
 for(let i=0;i<data1.length;i++)data1[i]=42; // simulate updateEffects having moved the particles
 removeObject(mesh1);
 particles({x:9,y:0,z:9},0x00ff00,10,3);
 const second=ctx.effects.at(-1),mesh2=second.mesh;
 assert.equal(mesh2.geometry,geom1,'the released particle geometry is reused for the same count');
 assert.equal(second.velocity,velocity1,'the released velocity buffer is reused');
 assert.ok(Array.from(mesh2.geometry.attributes.position.array).every(v=>v===0),'the reused position buffer is zeroed on acquire');
 assert.equal(mesh2.geometry.attributes.position.count,10);
 assert.equal(mesh2.material.color.getHex(),0x00ff00);
 particles({x:0,y:0,z:0},0x0000ff,20,1);
 const third=ctx.effects.at(-1);
 assert.notEqual(third.mesh.geometry,geom1,"a different count does not reuse another count's buffer");
 assert.equal(third.mesh.geometry.attributes.position.count,20);
});

test('the ring pool caps at 32 entries and disposes overflow instead of growing unbounded',()=>{
 const ctx=makeCtx(),{ringEffect,removeObject}=createEffects(ctx);
 const meshes=[];
 for(let i=0;i<34;i++){ringEffect({x:i,y:0,z:0},0xffffff,0,1,.5);meshes.push(ctx.effects.at(-1).mesh);}
 let disposals=0;
 for(const m of meshes)m.geometry.addEventListener('dispose',()=>disposals++);
 for(const m of meshes)removeObject(m);
 assert.equal(disposals,2,'only the 2 entries beyond the 32-slot cap are disposed');
 const retained=meshes.slice(0,32).map(m=>m.geometry),overflowed=meshes.slice(32).map(m=>m.geometry);
 const reacquired=new Set();
 for(let i=0;i<32;i++){ringEffect({x:0,y:0,z:0},0xffffff,0,1,.5);reacquired.add(ctx.effects.at(-1).mesh.geometry);}
 assert.equal(reacquired.size,32,'all 32 pooled geometries are distinct, previously-released instances');
 for(const g of reacquired)assert.ok(retained.includes(g),'each reacquired geometry came from the retained (non-evicted) set');
 for(const g of overflowed)assert.ok(!reacquired.has(g),'a disposed, evicted geometry is never handed back out');
});

test('removeObject releases a pooled (tagged) mesh back to its pool without disposing it',()=>{
 const ctx=makeCtx(),{ringEffect,removeObject}=createEffects(ctx);
 ringEffect({x:0,y:0,z:0},0xff0000,0,1,.5);
 const mesh=ctx.effects.at(-1).mesh;
 assert.equal(mesh.userData.effectPool,'ring','the pooled mesh is tagged for removeObject to recognise');
 let geomDisposed=false,matDisposed=false;
 mesh.geometry.addEventListener('dispose',()=>geomDisposed=true);
 mesh.material.addEventListener('dispose',()=>matDisposed=true);
 removeObject(mesh);
 assert.ok(!ctx.scene.children.includes(mesh),'the mesh is still removed from the scene');
 assert.equal(geomDisposed,false,'the geometry is pooled, not disposed');
 assert.equal(matDisposed,false,'the material is pooled, not disposed');
});

// ---- seeded PRNG (mulberry32), same construction used elsewhere in this repo
// (e.g. tests/region-travel.test.mjs) so the fuzz run below is deterministic.
function mulberry32(seed){
 return function(){
  seed=seed+0x6D2B79F5|0;
  let z=seed;
  z=Math.imul(z^z>>>15,z|1);
  z^=z+Math.imul(z^z>>>7,z|61);
  return ((z^z>>>14)>>>0)/4294967296;
 };
}

// ---- verbatim reference implementation, copied from `git show main:dist/effects-factory.js`
// (the pre-pooling version of createEffects). Accepts an optional second `U` parameter
// (defaulting to the real `T`) purely so the allocation test below can pass in counting
// subclasses without touching the module-namespace `T` binding (which is read-only).
function createReferenceEffects(ctx,U=T){
 function groundPing(pos){ringEffect(pos,0xc0c2a1,.25,.65,.45);}
 function ringEffect(pos,color,from,to,life){const mesh=new U.Mesh(new U.RingGeometry(.89,1,64),new U.MeshBasicMaterial({color,transparent:true,opacity:.8,depthWrite:false,side:U.DoubleSide,blending:U.AdditiveBlending}));mesh.rotation.x=-Math.PI/2;mesh.position.set(pos.x,.13,pos.z);ctx.scene.add(mesh);ctx.effects.push({type:'ring',mesh,time:0,life,from,to});}
 function slash(pos,a,color,radius,life){const mesh=new U.Mesh(new U.RingGeometry(radius*.965,radius,48,1,-Math.PI/2-.72,1.44),new U.MeshBasicMaterial({color,transparent:true,opacity:.48,depthWrite:false,side:U.DoubleSide,blending:U.AdditiveBlending}));mesh.rotation.set(-Math.PI/2,0,a-.2);mesh.position.copy(pos).add(new U.Vector3(0,.85,0));ctx.scene.add(mesh);ctx.effects.push({type:'slash',mesh,time:0,life,angle:a});}
 function steelImpact(pos){ctx.combatEffects.steelImpact(pos);}
 function particles(pos,color,count,speed){const values=new Float32Array(count*3),velocity=new Float32Array(count*3);for(let i=0;i<count;i++){velocity[i*3]=(Math.random()-.5)*speed*2;velocity[i*3+1]=Math.random()*speed+1;velocity[i*3+2]=(Math.random()-.5)*speed*2;}const g=new U.BufferGeometry();g.setAttribute('position',new U.BufferAttribute(values,3));const mesh=new U.Points(g,new U.PointsMaterial({color,size:.065,transparent:true,opacity:.9,depthWrite:false,blending:U.AdditiveBlending}));mesh.position.copy(pos);ctx.scene.add(mesh);ctx.effects.push({type:'particles',mesh,velocity,time:0,life:.75});}
 function telegraph(pos,radius,arc=Math.PI*2,a=0){const group=new U.Group();group.position.set(pos.x,.1,pos.z);const mat=new U.MeshBasicMaterial({color:0xe76042,transparent:true,opacity:.15,side:U.DoubleSide,depthWrite:false});const fill=new U.Mesh(new U.CircleGeometry(radius,48,-Math.PI/2-arc/2,arc),mat);fill.rotation.set(-Math.PI/2,0,a);group.add(fill);const edge=new U.Mesh(new U.RingGeometry(radius-.055,radius,48,1,-Math.PI/2-arc/2,arc),new U.MeshBasicMaterial({color:0xf59766,transparent:true,opacity:.48,depthWrite:false,side:U.DoubleSide}));edge.rotation.set(-Math.PI/2,0,a);group.add(edge);ctx.scene.add(group);return group;}
 function removeObject(object){ctx.scene.remove(object);object.traverse(o=>{if(o.geometry&&!o.isSprite)o.geometry.dispose();if(o.material){if(Array.isArray(o.material))o.material.forEach(m=>m.dispose());else o.material.dispose();}});}
 function cancelAttack(e,stun=0){if(e.telegraph){removeObject(e.telegraph);e.telegraph=null;}if(stun&&!e.dead){e.phase='recover';e.timer=stun;e.cooldown=.8;}}
 function floatText(text,pos,kind=''){const element=document.createElement('div');element.className=`damage-number ${kind}`;element.textContent=text;$('float-layer').append(element);ctx.floaters.push({element,pos:new U.Vector3(pos.x,1.9,pos.z),time:0,life:kind==='small'?1.4:.85,offset:(Math.random()-.5)*20});}
 return {groundPing,ringEffect,slash,steelImpact,particles,telegraph,removeObject,cancelAttack,floatText};
}

// ---- verbatim updateEffects loop, copied from `git show main:dist/player-motion.js`'s
// updateEffects (only the ctx.effects advancement loop -- not the classEffects/combatEffects
// tail line, which this task's files don't touch and which isn't exercised by the effect
// types under test here).
function runEffectsLoop(ctx,dt){
 for(let i=ctx.effects.length-1;i>=0;i--){const e=ctx.effects[i];e.time+=dt;const p=e.time/e.life;if(p>=1){ctx.removeObject(e.mesh);ctx.effects.splice(i,1);continue;}e.mesh.material.opacity=(1-p)*.85;if(e.type==='ring'){const r=T.MathUtils.lerp(e.from,e.to,1-(1-p)*(1-p));e.mesh.scale.setScalar(r);}if(e.type==='slash'){e.mesh.rotation.z=e.angle-.35+p*.9;e.mesh.scale.setScalar(.8+p*.3);}if(e.type==='sparks'){const data=e.mesh.geometry.attributes.position.array;for(let j=0;j<data.length;j+=6){const v=j/2;for(let axis=0;axis<3;axis++){data[j+axis]+=e.velocity[v+axis]*dt;data[j+3+axis]=data[j+axis]-e.velocity[v+axis]*.022;}e.velocity[v+1]-=dt*9;}e.mesh.geometry.attributes.position.needsUpdate=true;}if(e.type==='particles'){const data=e.mesh.geometry.attributes.position.array;for(let j=0;j<data.length;j+=3){data[j]+=e.velocity[j]*dt;data[j+1]+=e.velocity[j+1]*dt;data[j+2]+=e.velocity[j+2]*dt;e.velocity[j+1]-=dt*6;}e.mesh.geometry.attributes.position.needsUpdate=true;}}
}

// ---- seeded script of >=300 create-effect events interleaved with >=2000 updateEffects
// steps (7 per event => 2100), driving both implementations identically.
function buildScript(seed,eventCount,updatesPerEvent){
 const rand=mulberry32(seed);
 const radii=[.8,1,1.2,1.5,2],counts=[20,50,80,120],types=['groundPing','ringEffect','slash','particles'];
 const steps=[];
 for(let i=0;i<eventCount;i++){
  const type=types[Math.floor(rand()*types.length)],pos={x:rand()*40-20,y:0,z:rand()*40-20},color=Math.floor(rand()*0xffffff);
  if(type==='groundPing')steps.push({kind:'event',type,args:[pos]});
  else if(type==='ringEffect'){const from=rand()*.5,to=from+rand()*.5+.1,life=rand()*.6+.15;steps.push({kind:'event',type,args:[pos,color,from,to,life]});}
  else if(type==='slash'){const angle=rand()*Math.PI*2-Math.PI,radius=radii[Math.floor(rand()*radii.length)],life=rand()*.6+.15;steps.push({kind:'event',type,args:[pos,angle,color,radius,life]});}
  else{const count=counts[Math.floor(rand()*counts.length)],speed=rand()*3+.5;steps.push({kind:'event',type,args:[pos,color,count,speed]});}
  for(let u=0;u<updatesPerEvent;u++)steps.push({kind:'update',dt:rand()*.045+.005});
 }
 return steps;
}

// Extracts, for every currently-live effect (in order), every property the parity test cares
// about: mesh type, transform, full material state, geometry type+parameters (or, for
// particles, the live position/velocity arrays), and whether the mesh is still in the scene.
function describeEffects(ctx){
 return ctx.effects.map(e=>{
  const m=e.mesh,mat=m.material,geom=m.geometry;
  const desc={type:e.type,meshType:m.type,isPoints:!!m.isPoints,isMesh:!!m.isMesh,
   position:{x:m.position.x,y:m.position.y,z:m.position.z},
   rotation:{x:m.rotation.x,y:m.rotation.y,z:m.rotation.z},
   scale:{x:m.scale.x,y:m.scale.y,z:m.scale.z},
   material:{type:mat.type,color:mat.color.getHex(),opacity:mat.opacity,transparent:mat.transparent,depthWrite:mat.depthWrite,side:mat.side,blending:mat.blending},
   geometryType:geom.type,
   inScene:ctx.scene.children.includes(m)};
  if(geom.parameters)desc.geometryParameters={...geom.parameters};
  if(e.type==='particles'){desc.positionArray=Array.from(geom.attributes.position.array);desc.velocityArray=Array.from(e.velocity);}
  return desc;
 });
}

// Runs `factory` (either the real, pooled createEffects or createReferenceEffects) through
// the shared script, seeding Math.random identically before the run so particles()'s internal
// Math.random() consumption (velocity fill) lines up between the two implementations, and
// recording a snapshot after every single step (event or update).
function runScript(factory,script,particlesSeed){
 const ctx={scene:new T.Group(),effects:[],floaters:[],combatEffects:{steelImpact(){}}};
 const api=factory(ctx);
 ctx.removeObject=api.removeObject;
 const originalRandom=Math.random;
 let particlesSeen=0;
 const records=[];
 for(const step of script){
  if(step.kind==='event'){
   if(step.type==='particles'){
    // particles() is the only scripted function that reads Math.random(). Every three.js
    // object construction also burns 4 Math.random() calls on generateUUID() internally
    // (BufferGeometry/Material/Object3D each set `this.uuid=generateUUID()`), and pooling
    // means the pooled run constructs a different NUMBER of those objects than the reference
    // run construct one per event, always). A single continuous Math.random patch across the
    // whole script would drift out of sync between the two runs for exactly that reason, so
    // instead each particles() call gets its own fresh, deterministic seed (the Nth particles
    // event gets the same seed in both runs, since both iterate the same script in order) --
    // both implementations do their velocity-fill loop (the only random consumer) before any
    // T-constructor call within particles(), so this isolates it from the UUID noise.
    Math.random=mulberry32(particlesSeed+(particlesSeen++));
    try{api.particles(...step.args);}finally{Math.random=originalRandom;}
   }else api[step.type](...step.args);
  }else runEffectsLoop(ctx,step.dt);
  records.push({describe:describeEffects(ctx),sceneLen:ctx.scene.children.length,effectsLen:ctx.effects.length});
 }
 return {ctx,records};
}

test('pooled createEffects matches the verbatim reference across a long randomized event/update script',()=>{
 const script=buildScript(0x9E3779B9,300,7);
 assert.ok(script.filter(s=>s.kind==='event').length>=300);
 assert.ok(script.filter(s=>s.kind==='update').length>=2000);
 const {records:recordsA}=runScript(createEffects,script,0xC0FFEE);
 const {records:recordsB}=runScript(createReferenceEffects,script,0xC0FFEE);
 assert.equal(recordsA.length,recordsB.length);
 for(let i=0;i<recordsA.length;i++){
  assert.equal(recordsA[i].sceneLen,recordsA[i].effectsLen,`step ${i}: pooled scene has no stray (non-removed) children`);
  assert.equal(recordsB[i].sceneLen,recordsB[i].effectsLen,`step ${i}: reference scene has no stray (non-removed) children`);
  assert.deepEqual(recordsA[i].describe,recordsB[i].describe,`step ${i}: pooled and reference effect state diverge`);
 }
});

// ---- allocation test: spy on the real dist/effects-factory.js's own constructor calls.
//
// dist/effects-factory.js imports the relative specifier './vendor/three.core.js'; a module
// namespace's exported bindings are read-only from the importer's side (reassigning
// three.core.js's own RingGeometry property silently no-ops), so -- the same technique
// tests/region-travel.test.mjs uses for Vector3 -- a resolve hook redirects that specifier to
// a data: module which re-exports the real module unchanged except for four counting
// subclasses. Because effects-factory.js is already statically imported (unhooked) at the top
// of this file and Node caches ES modules by resolved URL, a cache-busting query string forces
// a second, distinct module instance that actually goes through the hook.
test('pooling keeps geometry/material/typed-array allocation bounded by peak concurrency, not event count',async()=>{
 const threeCoreUrl=new URL('../dist/vendor/three.core.js',import.meta.url).href;
 const allocStats={ring:0,buffer:0,meshBasic:0,points:0};
 const disposed=new Set();
 globalThis.__effectsAllocStats=allocStats;
 globalThis.__effectsAllocDisposed=disposed;
 const spyUrl='data:text/javascript,'+encodeURIComponent(
  `import * as Base from ${JSON.stringify(threeCoreUrl)};\n`+
  `export * from ${JSON.stringify(threeCoreUrl)};\n`+
  `export class RingGeometry extends Base.RingGeometry{constructor(...a){super(...a);globalThis.__effectsAllocStats.ring++;}dispose(){globalThis.__effectsAllocDisposed.add(this);super.dispose();}}\n`+
  `export class BufferGeometry extends Base.BufferGeometry{constructor(...a){super(...a);globalThis.__effectsAllocStats.buffer++;}dispose(){globalThis.__effectsAllocDisposed.add(this);super.dispose();}}\n`+
  `export class MeshBasicMaterial extends Base.MeshBasicMaterial{constructor(...a){super(...a);globalThis.__effectsAllocStats.meshBasic++;}dispose(){globalThis.__effectsAllocDisposed.add(this);super.dispose();}}\n`+
  `export class PointsMaterial extends Base.PointsMaterial{constructor(...a){super(...a);globalThis.__effectsAllocStats.points++;}dispose(){globalThis.__effectsAllocDisposed.add(this);super.dispose();}}\n`
 );
 const hook=registerHooks({resolve(specifier,context,nextResolve){
  if(specifier==='./vendor/three.core.js')return {url:spyUrl,shortCircuit:true};
  return nextResolve(specifier,context);
 }});
 const {createEffects:createEffectsSpy}=await import('../dist/effects-factory.js?allocSpy=1');
 hook.deregister();

 const script=buildScript(0x1234ABCD,300,7);
 const ctx={scene:new T.Group(),effects:[],floaters:[],combatEffects:{steelImpact(){}}};
 const api=createEffectsSpy(ctx);
 ctx.removeObject=api.removeObject;
 const OriginalFloat32Array=globalThis.Float32Array;
 let float32Count=0;
 class SpyFloat32Array extends OriginalFloat32Array{constructor(...a){super(...a);float32Count++;}}
 Object.defineProperty(globalThis,'Float32Array',{configurable:true,writable:true,value:SpyFloat32Array});

 // peak-concurrency tracking, keyed the same way the pools themselves are keyed.
 let peakRing=0,peakSlashTotal=0,peakParticlesTotal=0;
 const peakSlashByRadius=new Map(),peakParticlesByCount=new Map();
 const bump=(map,key,n)=>map.set(key,Math.max(map.get(key)||0,n));
 function trackPeaks(){
  let ring=0,slashTotal=0,particlesTotal=0;
  const slashByRadius=new Map(),particlesByCount=new Map();
  for(const e of ctx.effects){
   if(e.type==='ring')ring++;
   else if(e.type==='slash'){slashTotal++;const r=e.mesh.userData.effectPoolRadius;slashByRadius.set(r,(slashByRadius.get(r)||0)+1);}
   else if(e.type==='particles'){particlesTotal++;const c=e.mesh.userData.effectPoolCount;particlesByCount.set(c,(particlesByCount.get(c)||0)+1);}
  }
  peakRing=Math.max(peakRing,ring);peakSlashTotal=Math.max(peakSlashTotal,slashTotal);peakParticlesTotal=Math.max(peakParticlesTotal,particlesTotal);
  for(const[r,n]of slashByRadius)bump(peakSlashByRadius,r,n);
  for(const[c,n]of particlesByCount)bump(peakParticlesByCount,c,n);
  // safety net: nothing currently live should be a previously-disposed object.
  for(const e of ctx.effects){
   assert.ok(!disposed.has(e.mesh.geometry),'a live effect never points at a disposed (evicted) geometry');
   assert.ok(!disposed.has(e.mesh.material),'a live effect never points at a disposed (evicted) material');
  }
 }
 const originalRandom=Math.random;
 Math.random=mulberry32(0x5EED);
 try{
  for(const step of script){
   if(step.kind==='event')api[step.type](...step.args);
   else runEffectsLoop(ctx,step.dt);
   trackPeaks();
  }
 }finally{
  Math.random=originalRandom;
  Object.defineProperty(globalThis,'Float32Array',{configurable:true,writable:true,value:OriginalFloat32Array});
  delete globalThis.__effectsAllocStats;delete globalThis.__effectsAllocDisposed;
 }

 const SLACK=4; // cold-start slack: the first occurrence of each key must still allocate
 let peakSlashSum=0;for(const n of peakSlashByRadius.values())peakSlashSum+=n;
 let peakParticlesSum=0;for(const n of peakParticlesByCount.values())peakParticlesSum+=n;
 const expectedRingGeom=peakRing+peakSlashSum+SLACK;
 const expectedBufferGeom=peakParticlesSum+SLACK;
 const expectedMeshBasic=peakRing+peakSlashTotal+SLACK;
 const expectedPoints=peakParticlesTotal+SLACK;

 // (groundPing/ringEffect/slash all allocate a RingGeometry+MeshBasicMaterial per event in the
 // reference; particles allocates a BufferGeometry+PointsMaterial+2 Float32Arrays per event.)
 const refRingGeomCount=script.filter(s=>s.kind==='event'&&s.type!=='particles').length;
 const refParticlesCount=script.filter(s=>s.kind==='event'&&s.type==='particles').length;

 assert.ok(allocStats.ring<=expectedRingGeom,`pooled RingGeometry allocations (${allocStats.ring}) should be bounded by peak concurrency (ring ${peakRing} + slash ${peakSlashSum} + slack ${SLACK} = ${expectedRingGeom})`);
 assert.ok(allocStats.buffer<=expectedBufferGeom,`pooled BufferGeometry allocations (${allocStats.buffer}) should be bounded by peak concurrency (${expectedBufferGeom})`);
 assert.ok(allocStats.meshBasic<=expectedMeshBasic,`pooled MeshBasicMaterial allocations (${allocStats.meshBasic}) should be bounded by peak concurrency (${expectedMeshBasic})`);
 assert.ok(allocStats.points<=expectedPoints,`pooled PointsMaterial allocations (${allocStats.points}) should be bounded by peak concurrency (${expectedPoints})`);
 // RingGeometry's own constructor internally allocates 3 Float32Arrays (position/normal/uv
 // Float32BufferAttribute wrapping), independent of pooling; particles() allocates 2
 // (values+velocity) per cache miss. Cross-check float32Count against the *observed*
 // geometry construction counts above (already shown to be peak-concurrency-bounded,
 // not one-per-event) rather than re-deriving an independent bound.
 const expectedFloat32=allocStats.ring*3+allocStats.buffer*2+SLACK;
 assert.ok(float32Count<=expectedFloat32,`pooled Float32Array allocations (${float32Count}) should match what the (already peak-bounded) geometry construction counts imply (<=${expectedFloat32})`);
 const refFloat32Estimate=refRingGeomCount*3+refParticlesCount*2;
 assert.ok(float32Count<refFloat32Estimate,`pooling should allocate far fewer Float32Arrays (${float32Count}) than the reference's one-per-event estimate (${refFloat32Estimate})`);

 assert.ok(allocStats.ring<refRingGeomCount,`pooling must construct fewer RingGeometry instances (${allocStats.ring}) than the ${refRingGeomCount} ring/slash events`);
 assert.ok(allocStats.buffer<refParticlesCount,`pooling must construct fewer BufferGeometry instances (${allocStats.buffer}) than the ${refParticlesCount} particle events`);

 // and: the reference implementation really does allocate exactly one of each per relevant
 // event -- verified empirically (not just by code inspection) via createReferenceEffects's
 // spy-able `U` parameter, a second, independent spy that needs no module-resolution hook.
 let refRing=0,refBuffer=0,refMeshBasic=0,refPoints=0;
 class RefRingGeometry extends T.RingGeometry{constructor(...a){super(...a);refRing++;}}
 class RefBufferGeometry extends T.BufferGeometry{constructor(...a){super(...a);refBuffer++;}}
 class RefMeshBasicMaterial extends T.MeshBasicMaterial{constructor(...a){super(...a);refMeshBasic++;}}
 class RefPointsMaterial extends T.PointsMaterial{constructor(...a){super(...a);refPoints++;}}
 const spyU={...T,RingGeometry:RefRingGeometry,BufferGeometry:RefBufferGeometry,MeshBasicMaterial:RefMeshBasicMaterial,PointsMaterial:RefPointsMaterial};
 const refCtx={scene:new T.Group(),effects:[],floaters:[],combatEffects:{steelImpact(){}}};
 const refApi=createReferenceEffects(refCtx,spyU);
 refCtx.removeObject=refApi.removeObject;
 const originalRandom2=Math.random;Math.random=mulberry32(0x5EED);
 try{for(const step of script)if(step.kind==='event')refApi[step.type](...step.args);}finally{Math.random=originalRandom2;}
 assert.equal(refRing,refRingGeomCount,'the reference allocates exactly one RingGeometry per ring/groundPing/slash event');
 assert.equal(refMeshBasic,refRingGeomCount,'the reference allocates exactly one MeshBasicMaterial per ring/groundPing/slash event');
 assert.equal(refBuffer,refParticlesCount,'the reference allocates exactly one BufferGeometry per particles event');
 assert.equal(refPoints,refParticlesCount,'the reference allocates exactly one PointsMaterial per particles event');

 console.log(`[P8 allocation report] events=${script.filter(s=>s.kind==='event').length} (ring-like=${refRingGeomCount}, particles=${refParticlesCount})`);
 console.log(`[P8 allocation report] reference constructs: RingGeometry=${refRing} MeshBasicMaterial=${refMeshBasic} BufferGeometry=${refBuffer} PointsMaterial=${refPoints}`);
 console.log(`[P8 allocation report] pooled constructs:    RingGeometry=${allocStats.ring} MeshBasicMaterial=${allocStats.meshBasic} BufferGeometry=${allocStats.buffer} PointsMaterial=${allocStats.points} Float32Array=${float32Count}`);
 console.log(`[P8 allocation report] peak concurrency:     ring=${peakRing} slashByRadius=${JSON.stringify([...peakSlashByRadius])} (sum ${peakSlashSum}) particlesByCount=${JSON.stringify([...peakParticlesByCount])} (sum ${peakParticlesSum})`);
});
