import test from 'node:test';
import assert from 'node:assert/strict';
import {registerHooks} from 'node:module';

const THREE_URL = new URL('../dist/vendor/three.module.js', import.meta.url).href;
const hook = registerHooks({resolve(specifier, context, nextResolve) {
 if (specifier === 'three') return nextResolve(THREE_URL, context);
 return nextResolve(specifier, context);
}});
const T = await import('three');
const {createPalette} = await import('../dist/palette.js');
hook.deregister();

function fp(m){
 return {color:m.color.getHex(),roughness:m.roughness,metalness:m.metalness,flatShading:!!m.flatShading,emissive:m.emissive?.getHex()??null,emissiveIntensity:m.emissiveIntensity};
}

test('with no options, createPalette reproduces a bare Object.fromEntries(...new T.MeshStandardMaterial({color})) palette',()=>{
 const colors={a:0x112233,b:0x445566};
 const palette=createPalette(colors);
 assert.deepEqual(Object.keys(palette),['a','b']);
 for(const key of Object.keys(colors)){
  assert.ok(palette[key].isMeshStandardMaterial);
  assert.equal(palette[key].color.getHex(),colors[key]);
 }
});

test('cave-entrance-scenery.js: every material gets the same roughness:1,flatShading:true regardless of key',()=>{
 const colors={rock:0x646c63,shade:0x384441,moss:0x50594a,grass:0x626957,bark:0x302e27};
 const palette=createPalette(colors,{params:()=>({roughness:1,flatShading:true})});
 const reference=Object.fromEntries(Object.entries(colors).map(([key,color])=>[key,new T.MeshStandardMaterial({color,roughness:1,flatShading:true})]));
 assert.deepEqual(Object.keys(palette),Object.keys(reference));
 for(const key of Object.keys(colors))assert.deepEqual(fp(palette[key]),fp(reference[key]));
});

test('cave-scenery.js: per-key roughness (water is special-cased) plus emissive overrides on crystal/flame/ember/cold',()=>{
 const colors={floor:0x30373c,water:0x152a2a,crystal:0x448e89,flame:0xffae50,ember:0xa22f0a,cold:0x74d4d0,stone:0x4c555c};
 const params=key=>({roughness:key==='water'?.22:.93,...(key==='crystal'?{emissive:0x193734,emissiveIntensity:.25}:key==='flame'?{emissive:0xff6414,emissiveIntensity:3}:key==='ember'?{emissive:0xa82604,emissiveIntensity:1.5}:key==='cold'?{emissive:0x499d9d,emissiveIntensity:1.7}:{})});
 const palette=createPalette(colors,{params});
 const reference=Object.fromEntries(Object.entries(colors).map(([key,color])=>[key,new T.MeshStandardMaterial({color,roughness:key==='water'?.22:.93,...(key==='crystal'?{emissive:0x193734,emissiveIntensity:.25}:key==='flame'?{emissive:0xff6414,emissiveIntensity:3}:key==='ember'?{emissive:0xa82604,emissiveIntensity:1.5}:key==='cold'?{emissive:0x499d9d,emissiveIntensity:1.7}:{})})]));
 for(const key of Object.keys(colors))assert.deepEqual(fp(palette[key]),fp(reference[key]));
 // spot-check the values the fingerprint above could mask a typo in
 assert.equal(palette.water.roughness,.22);
 assert.equal(palette.stone.roughness,.93);
 assert.equal(palette.crystal.emissive.getHex(),0x193734);
 assert.equal(palette.crystal.emissiveIntensity,.25);
 assert.equal(palette.flame.emissiveIntensity,3);
 assert.equal(palette.ember.emissive.getHex(),0xa82604);
 assert.equal(palette.cold.emissiveIntensity,1.7);
 assert.equal(palette.floor.emissive.getHex(),0); // no override -> Three's own default
});

test('outland-scenery.js: only roughness varies, water again special-cased, no emissive/flatShading',()=>{
 const colors={path:0x536053,earth:0x424c3e,water:0x304a4a,plank:0x766c50};
 const palette=createPalette(colors,{params:id=>({roughness:id==='water'?.3:.96})});
 assert.equal(palette.water.roughness,.3);
 assert.equal(palette.path.roughness,.96);
 assert.equal(palette.earth.roughness,.96);
 for(const key of Object.keys(colors)){
  assert.equal(palette[key].flatShading,false);
  assert.equal(palette[key].metalness,0);
  assert.equal(palette[key].emissiveIntensity,1); // Three's own default, untouched
 }
});

test('materialType lets a call site swap the constructor while keeping the same key/color mapping',()=>{
 const colors={a:0xff0000};
 const palette=createPalette(colors,{materialType:T.MeshBasicMaterial,params:()=>({transparent:true})});
 assert.ok(palette.a.isMeshBasicMaterial);
 assert.equal(palette.a.transparent,true);
 assert.equal(palette.a.color.getHex(),0xff0000);
});
