// Installs stub values on globalThis for the duration of one test, saving
// whatever was there before (including "nothing") and restoring it exactly
// once the test finishes, pass or fail.
export function installGlobals(t, values) {
 const originals = new Map(Object.keys(values).map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
 for (const [key, value] of Object.entries(values)) {
  Object.defineProperty(globalThis, key, {configurable: true, writable: true, value});
 }
 t.after(() => {
  for (const [key, descriptor] of originals) {
   if (descriptor) Object.defineProperty(globalThis, key, descriptor);
   else delete globalThis[key];
  }
 });
}
