// SVG gauges share the game's resource ratios without extra WebGL contexts.
export function createResourceOrbs() {
 const gauges=['.orb.health','.orb.mana'].map(selector=>{
  const host=document.querySelector(selector);
  return {host,ring:host.querySelector('.resource-fill'),value:null};
 });
 return {
  update(_dt,health,mana) {
   for(const [index,gauge] of gauges.entries()) {
    const ratio=index===0?health:mana;
    const value=Number.isFinite(ratio)?Math.max(0,Math.min(100,ratio*100)):0;
    if(gauge.value===value)continue;
    gauge.value=value;
    gauge.ring.style.strokeDashoffset=String(100-value);
    gauge.host.setAttribute('aria-valuenow',String(Math.round(value)));
   }
  },
 };
}
