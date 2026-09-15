import {readFileSync} from 'node:fs';

// dist/main.js is about to be split into many modules. Tests that slice pieces
// of it by searching for marker strings must fail loudly -- not silently pass
// an empty or wrong slice -- once a marker moves or disappears.
export function sliceBetween(source, start, end, {inclusiveEnd = false, file = 'source'} = {}) {
 const startIndex = source.indexOf(start);
 if (startIndex === -1) throw new Error(`missing marker: ${JSON.stringify(start)} in ${file}`);
 const endIndex = source.indexOf(end, startIndex + start.length);
 if (endIndex === -1) throw new Error(`missing marker: ${JSON.stringify(end)} in ${file}`);
 return source.slice(startIndex, inclusiveEnd ? endIndex + end.length : endIndex);
}

export const readDist = name => readFileSync(new URL(`../../dist/${name}`, import.meta.url), 'utf8');
