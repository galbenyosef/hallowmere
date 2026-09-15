// Seeded scenery noise shared by the generators that each used to inline it.
// lcg(seed) reproduces `(Math.imul(state,1664525)+1013904223)>>>0; state/4294967296`
// exactly. environment.js spells the step `state*1664525`; for a uint32 state the
// product stays below 2^53, so both spellings agree bit for bit (proved in tests).
// seeds: 4148 environment.js · 722 expansion-layout.js · 1847 outland-scenery.js
//        mapId.length*977 region-environment.js
//        hashString(map.id,{seed:7,imul:false}) cave-scenery.js
//        hashString(portal.id,{seed:17,imul:true}) cave-entrance-scenery.js
// hashString keeps both id hashes: `imul:false` is the float `n*31` reduction that
// loses precision past eight characters, and reproducing that loss is the point.
// range(rand,a,b) is the inline helper from bare-tree.js and environment.js.
// No caller reads the generator state, so no reader is exposed.
// Keep this file free of imports and of browser globals: dist/world.js shares
// expansion-layout.js with the Node server and will pull this module in with it.
export function lcg(seed){let state=seed;return()=>{state=(Math.imul(state,1664525)+1013904223)>>>0;return state/4294967296;};}
export const hashString=(id,{seed=0,imul=true}={})=>[...id].reduce((n,c)=>(imul?Math.imul(n,31):n*31)+c.charCodeAt(0),seed)>>>0;
export const range=(rand,a,b)=>a+(b-a)*rand();
