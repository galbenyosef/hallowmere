import test from 'node:test';
import assert from 'node:assert/strict';
import {icons,classIconNames,icon,paintIcons} from '../dist/icon-atlas.js';

test('icon() renders the named path for a known icon and falls back to the sword for an unknown one',()=>{
 assert.equal(icon('flame'),`<svg viewBox="0 0 24 24" aria-hidden="true"><path d="${icons.flame}"/></svg>`);
 assert.equal(icon('not-a-real-icon'),`<svg viewBox="0 0 24 24" aria-hidden="true"><path d="${icons.sword}"/></svg>`);
 assert.equal(icon(undefined),icon('sword'));
});

test('every classIconNames entry names an icon that actually exists',()=>{
 for(const names of Object.values(classIconNames))for(const name of names)assert.ok(name in icons,name);
});

test('paintIcons(root) fills every [data-icon] element under root with its icon markup, leaving other elements untouched',()=>{
 const makeEl=iconName=>({dataset:{icon:iconName},innerHTML:''});
 const painted=[makeEl('flame'),makeEl('bow'),makeEl('unknown-name')],other={innerHTML:'should stay untouched'};
 const root={querySelectorAll:selector=>{assert.equal(selector,'[data-icon]');return painted;}};
 paintIcons(root);
 assert.equal(painted[0].innerHTML,icon('flame'));
 assert.equal(painted[1].innerHTML,icon('bow'));
 assert.equal(painted[2].innerHTML,icon('sword'));
 assert.equal(other.innerHTML,'should stay untouched');
});
