import {conceptFor} from './classes.js';
// Populated by the browser's native model renderer; safe to import in shared UI tests.
export const characterPortraits=new Map(),weaponPortraits=new Map();
export const portraitFor=(classId,appearanceId)=>characterPortraits.get(conceptFor(classId,appearanceId));
export const weaponPortraitFor=(classId,appearanceId)=>weaponPortraits.get(conceptFor(classId,appearanceId));
