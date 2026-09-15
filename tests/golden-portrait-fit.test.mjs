import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {registerHooks} from 'node:module';
import * as T from '../dist/vendor/three.module.js';
import {CLASS_LIST,SORCERER_APPEARANCES,conceptFor} from '../dist/classes.js';
import {createInventoryStudy} from '../dist/inventory-portraits.js';
import {disposeStudy} from '../dist/character-study-models.js';
import {NPCS} from '../dist/campaign.js';
import {createNpcPortraitStudy} from '../dist/npc-portraits.js';

// Golden-camera proof for T1-8: these hashes were captured on the unmodified
// dist/inventory-portraits.js and dist/npc-portraits.js, before their duplicated
// camera-fit routine moved into dist/portrait-fit.js, and must never be updated to
// make a later edit pass. A changed hash means the extracted helper stopped
// reproducing a caller's exact framing (traversal mode, pad, aspect, or the
// resulting camera left/right/top/bottom/zoom) -- fix the call site, not this file.
// WebGL is unavailable in Node, so the proof is the resulting camera state (and the
// subject's world bounding box) rather than rendered pixels.

const fmt=v=>v.toFixed(6);
function cameraState(camera){
  return{
    position:[fmt(camera.position.x),fmt(camera.position.y),fmt(camera.position.z)],
    quaternion:[fmt(camera.quaternion.x),fmt(camera.quaternion.y),fmt(camera.quaternion.z),fmt(camera.quaternion.w)],
    left:fmt(camera.left),right:fmt(camera.right),top:fmt(camera.top),bottom:fmt(camera.bottom),
    near:fmt(camera.near),far:fmt(camera.far),zoom:fmt(camera.zoom),
  };
}
function bboxState(root){
  const box=new T.Box3().setFromObject(root);
  return{min:[fmt(box.min.x),fmt(box.min.y),fmt(box.min.z)],max:[fmt(box.max.x),fmt(box.max.y),fmt(box.max.z)]};
}
const hashOf=obj=>createHash('sha256').update(JSON.stringify(obj)).digest('hex');

// Match the game's import map while loading its real GLB assets in Node (same
// pattern as tests/npc-portraits.test.mjs).
const hook=registerHooks({resolve(specifier,context,nextResolve){
  return nextResolve(specifier==='three'?new URL('../dist/vendor/three.module.js',import.meta.url).href:specifier,context);
}});
const {GLTFLoader}=await import('../dist/vendor/loaders/GLTFLoader.js');
hook.deregister();

// Every class/appearance combination createInventoryStudy can build (mirrors the
// `choices` enumeration in tests/inventory-portraits.test.mjs, built the same way
// dist/inventory.js and dist/main.js drive prepareInventoryPortrait).
const INVENTORY_CHOICES=[...Object.keys(SORCERER_APPEARANCES).map(id=>['sorcerer',id]),...CLASS_LIST.filter(c=>c.id!=='sorcerer').map(c=>[c.id,c.concept])];

const INVENTORY_HASHES={
  'C01':'3fc052d994f1ae7a17dd16085a03c45ddddb4744de08e0d3064d9e7be766c15c',
  'W06':'a4d5989d129f296491265e969c09e7549f264c0fb06d3e7f03bcf57d7c76fe78',
  'W07':'aebf6045de4ed7917b6bbd456557cfed10b651b05410b62677916e5b7909925f',
  'W10':'0a4cd44eb98e6dede9693a8c6d7b4fb97ef8cd933241ee7eb884df321105cd84',
  'C02':'85ad92a8739c40614963d194d12d5a2cba0b34c5140a36369f7335f4f41f978a',
  'C03':'f5eb44a8e5812c17b51598f35eeeab3417a83c9e7ababb866249fb05150e7986',
  'C04':'7dda7b515226b86553bc524bb5f1cd9419c2d2f6d4090cbc9556007cd342501d',
  'C05':'62525c4d4da46b0f1e1d9a8ecab95aa698af8cedb1a0d4489f09e09ee8ecbfe4',
  'C09':'4fc3cf459932e8e91bc9bcced2281b654944957eec868a5ad2d3d42e4c33b507',
  'geralt':'ea265db6a61fa184c67882cd103693446f22f72f877d6271f928004b05b55a97',
};

const NPC_HASHES={
  rowan:'4f441cce96ecfdedcd08c9ce783640561346c8a64791b3db82f21e01ed3bc58e',
  edda:'e4a35ddafda93a938dcccf4054813cbdf24f429d8fa47c4400fe82dbc2e2b689',
  brann:'b0b3cfc9b3fbeb342bb180b6fadb40f2c9d8aa39bc86b0fd7f871bb9d820e0be',
  rook:'4d41941991a64d0f938f566f64588d5188c58adca039d5b5926e1b58645a321b',
};

test('every inventory portrait camera frames its subject identically to the unmodified routine',()=>{
  for(const [classId,appearanceId] of INVENTORY_CHOICES){
    const concept=conceptFor(classId,appearanceId);
    const study=createInventoryStudy(classId,appearanceId);
    const state={camera:cameraState(study.camera),bbox:bboxState(study.scene)};
    assert.equal(hashOf(state),INVENTORY_HASHES[concept],`${classId}/${appearanceId} (${concept}) camera framing changed`);
    disposeStudy(study);
  }
});

test('every NPC portrait camera frames its subject identically to the unmodified routine',async()=>{
  for(const npc of NPCS){
    const bytes=await readFile(new URL(`../dist/assets/models/${npc.model}.glb`,import.meta.url));
    const {scene:prefab}=await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
    const study=createNpcPortraitStudy(prefab);
    const state={camera:cameraState(study.camera),bbox:bboxState(study.root)};
    assert.equal(hashOf(state),NPC_HASHES[npc.id],`${npc.name} (${npc.id}) camera framing changed`);
  }
});
