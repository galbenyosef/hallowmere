// One subtree disposer for the copies that grew up alongside each model kit.
// Duck typed on purpose: nothing is imported, so the Node tests and the server
// share it. Options reproduce each original exactly — original → options:
//  combat-effects.js dispose          {removeFromParent:'before',dedupe:false,skipSpriteGeometry:true,arrayMaterials:false}
//  main.js removeObject               {removeFromParent:'before',dedupe:false,skipSpriteGeometry:true}
//  class-effects.js disposeClassEffect{removeFromParent:'before',skipSpriteGeometry:true}
//  multiplayer-view.js disposeActor   {removeFromParent:'before',geometry:false}
//  enemy-visuals.js releaseGeometry   {removeFromParent:'after',order:'interleaved',skipSpriteGeometry:true,arrayMaterials:false}
//  hunt-king-model.js disposeTree     {lights:true}
//  character-study-models.js disposeStudy {lights:true,textures:true}
//  geralt-character-model.js dispose  {order:'material-first',textures:true,extraMaterials:Object.values(m)}
//  predator-model.js dispose          {lights:true,order:'material-first',textures:true,extraMaterials:Object.values(m)}
//  region-environment.js kit.dispose  {removeFromParent:'before',traverse:false,extraGeometries:…,extraMaterials:…}
// main.js calls scene.remove(object); every object it removes is parented to the
// scene, so removeFromParent:'before' is the same call. The disposed-once guards
// (closure flags, root.userData.effectDisposed) stay at their call sites.
// skipGeometry has no caller yet; it is the hook for kits that share prefab
// geometry the way disposeActor does.
export function disposeSubtree(root,{removeFromParent=false,traverse=true,geometry=true,materials=true,arrayMaterials=true,skipSpriteGeometry=false,lights=false,dedupe=true,textures=false,order='geometry-first',extraGeometries=null,extraMaterials=null,skipGeometry=null}={}){
 if(removeFromParent==='before')root.removeFromParent();
 const geometries=new Set(),mats=new Set(),shared=new Set(),maps=new Set(),interleaved=order==='interleaved';
 const addGeometry=g=>{if(!geometry||skipGeometry?.has(g))return;if(!dedupe)g.dispose();else (interleaved?shared:geometries).add(g);};
 const addMaterial=m=>{if(!materials)return;if(!dedupe)m.dispose();else (interleaved?shared:mats).add(m);};
 if(traverse)root.traverse(node=>{
  if(node.geometry&&!(skipSpriteGeometry&&node.isSprite))addGeometry(node.geometry);
  if(node.material)for(const m of arrayMaterials&&Array.isArray(node.material)?node.material:[node.material])addMaterial(m);
  if(lights&&node.isLight)node.dispose?.();
 });
 if(extraGeometries)for(const g of extraGeometries)addGeometry(g);
 if(extraMaterials)for(const m of extraMaterials)addMaterial(m);
 const flushGeometries=()=>geometries.forEach(g=>g.dispose());
 const flushMaterials=()=>{mats.forEach(m=>{if(textures&&m.map)maps.add(m.map);m.dispose();});maps.forEach(t=>t.dispose());};
 if(dedupe){
  if(interleaved)shared.forEach(resource=>resource.dispose());
  else if(order==='material-first'){flushMaterials();flushGeometries();}
  else{flushGeometries();flushMaterials();}
 }
 if(removeFromParent==='after')root.removeFromParent();
}
