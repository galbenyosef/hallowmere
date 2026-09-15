// The shared element lookups. This is the only module in the shared set allowed
// to touch the document, so dist/world.js and the Node server never reach it.
// $ is main.js's lookup; scripts/validate.mjs matches $('id') against index.html.
export const $=id=>document.getElementById(id);
export const $$=(selector,root=document)=>[...root.querySelectorAll(selector)];
