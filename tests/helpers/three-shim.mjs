import {readDist} from './source.mjs';

// BufferGeometryUtils.js imports the full 'three' package, which this test
// suite has no bundler for. Patch the import to the vendored three.core.js
// build and load the result as a data: URL module, once, for every caller.
export async function loadMergeGeometries() {
 const utilities = readDist('vendor/utils/BufferGeometryUtils.js');
 const threeUrl = new URL('../../dist/vendor/three.core.js', import.meta.url).href;
 const patched = utilities.replace("from 'three'", `from '${threeUrl}'`);
 const module = await import('data:text/javascript;base64,' + Buffer.from(patched).toString('base64'));
 return module.mergeGeometries;
}
