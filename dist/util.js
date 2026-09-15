// Pure string and number helpers the UI modules each kept a private copy of.
// No imports, no browser globals, no scene graph: safe anywhere, server included.
// escapeHtml matches journeys-menu.js exactly. inventory.js spells it String(value)
// without the `?? ''` fallback, which only differs for null and undefined; every
// inventory.js call site passes a string (names, slots, rarities, ids), so the
// coalescing is unobservable there.
// clamp is combat.js's (v,min,max) form; clamp01 is the resource-orbs.js form that
// folds non-finite input to 0 rather than letting NaN through.
const HTML_ESCAPES={'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'};
export const escapeHtml=value=>String(value??'').replace(/[&<>"']/g,char=>HTML_ESCAPES[char]);
export const clamp=(v,min,max)=>Math.max(min,Math.min(max,v));
export const clamp01=value=>Number.isFinite(value)?Math.max(0,Math.min(1,value)):0;
