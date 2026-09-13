const storageKey='hallowmere.game-settings';

export function readGameSettings(){
 const defaults={music:true,brightness:100,shadows:true,cameraShake:!globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches};
 try{
  const saved=JSON.parse(localStorage.getItem(storageKey));
  if(!saved||typeof saved!=='object')return defaults;
  for(const key of ['music','shadows','cameraShake'])if(typeof saved[key]==='boolean')defaults[key]=saved[key];
  if(Number.isFinite(saved.brightness))defaults.brightness=Math.min(135,Math.max(75,saved.brightness));
 }catch{}
 return defaults;
}

export function saveGameSettings(settings){
 try{localStorage.setItem(storageKey,JSON.stringify(settings));}catch{}
}

export function applyGameVisuals(settings,renderer,scene){
 if(!renderer)return;
 renderer.toneMappingExposure=1.12*settings.brightness/100;
 if(renderer.shadowMap.enabled===settings.shadows)return;
 renderer.shadowMap.enabled=settings.shadows;
 renderer.shadowMap.needsUpdate=true;
 // Refresh shader variants when shadows are enabled or disabled at runtime.
 scene?.traverse(object=>{
  for(const material of Array.isArray(object.material)?object.material:[object.material])if(material)material.needsUpdate=true;
 });
}
