// spawnEnemy/updateEnemyBar moved verbatim out of main.js (M3). Free identifiers: T (three,
// module import), ENEMY_TYPES (./combat.js), createEnemyVisuals (./enemy-visuals.js), getRig
// (./model-kit.js, pure/standalone — imported directly, not via ctx, same as cloneModel using
// optimizeModel directly), ctx.enemyModelType/ctx.bossType (ctx methods wired in game-context.js),
// ctx.cloneModel (ctx field wired by M2's createModelCache), ctx.scene/ctx.enemies/
// ctx.overworldEnvironment/ctx.reducedMotion (already-declared ctx data fields), Math/document
// (globals). spawnEnemy calls updateEnemyBar directly — both stay in this closure.
import * as T from './vendor/three.core.js';
import {createEnemyVisuals} from './enemy-visuals.js';
import {ENEMY_TYPES} from './combat.js';
import {getRig} from './model-kit.js';
export function createEnemySpawner(ctx){
 function spawnEnemy(type,x,z,zone='hallowmere',id=`enemy-${ctx.enemies.length}`){const data=ENEMY_TYPES[type],base=ctx.enemyModelType(type),name=base==='hound'?'grave-hound':base==='boss'?'bellkeeper':base;const model=ctx.cloneModel(name);if(data.modelType&&!data.tint){const tint=new T.Color(({hunter:'#a8baa2',rootling:'#7fa877',miner:'#bdaf93','quarry-mage':'#b99ad0',sentinel:'#c6a478',pyromancer:'#ea936d',rootbound:'#8eae78','quarry-warden':'#bfb1a0','ash-regent':'#edb085'})[type]||'#ffffff');model.traverse(o=>{if(o.material?.color)o.material.color.multiply(tint);});}const pickBounds=new T.Box3().setFromObject(model);model.position.set(x,0,z);model.rotation.y=Math.random()*6.28;ctx.scene.add(model);const e={id,zone,type,data,model,pickBounds,rig:getRig(model),hp:data.hp,maxHp:data.hp,phase:'idle',timer:0,cooldown:1+Math.random()*1.5,angle:0,attackAngle:0,aim:new T.Vector3(),flash:0,dead:false,home:{x,z},attackCount:0,seed:Math.random()*6.28,telegraph:null,path:[],navTimer:0,bar:null,barCanvas:null,barTexture:null,barHealth:data.hp,recoil:0};
  e.visuals=createEnemyVisuals(e,ctx.overworldEnvironment.glowTexture,{reducedMotion:ctx.reducedMotion});
  const c=document.createElement('canvas');c.width=256;c.height=48;const texture=new T.CanvasTexture(c);texture.colorSpace=T.SRGBColorSpace;const bar=new T.Sprite(new T.SpriteMaterial({map:texture,transparent:true,depthTest:false,depthWrite:false,toneMapped:false,fog:false}));bar.scale.set(ctx.bossType(type)?4:3.2,ctx.bossType(type)?.75:.6,1);bar.renderOrder=20;bar.visible=false;ctx.scene.add(bar);e.bar=bar;e.barCanvas=c;e.barTexture=texture;updateEnemyBar(e);ctx.enemies.push(e);return e;}
 function updateEnemyBar(e){const c=e.barCanvas.getContext('2d');c.clearRect(0,0,256,48);c.font='500 20px Georgia';c.textAlign='left';c.fillStyle='#e0d3b0';c.shadowColor='#000';c.shadowBlur=5;c.fillText(e.data.name,4,20);c.textAlign='right';c.font='16px Arial';c.fillText(`${Math.max(0,e.hp)} / ${e.maxHp}`,252,20);c.shadowBlur=0;c.fillStyle='#091211';c.fillRect(0,27,256,20);c.fillStyle='#c6b58c';c.fillRect(3,30,250*Math.max(0,e.barHealth/e.maxHp),14);const red=c.createLinearGradient(0,30,0,44);red.addColorStop(0,'#ff293b');red.addColorStop(.45,'#981f25');red.addColorStop(1,'#660f1b');c.fillStyle=red;c.fillRect(3,30,250*Math.max(0,e.hp/e.maxHp),14);c.fillStyle='#ff5360';c.fillRect(3,30,250*Math.max(0,e.hp/e.maxHp),3);c.strokeStyle='#8d9275';c.lineWidth=1;c.strokeRect(.5,27.5,255,19);e.barTexture.needsUpdate=true;}
 return {spawnEnemy,updateEnemyBar};
}
