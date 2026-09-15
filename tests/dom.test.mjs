import test from 'node:test';
import assert from 'node:assert/strict';
import {$,$$} from '../dist/dom.js';

function stubDocument(t,document){
 const previous=Object.getOwnPropertyDescriptor(globalThis,'document');
 t.after(()=>{if(previous)Object.defineProperty(globalThis,'document',previous);else delete globalThis.document;});
 globalThis.document=document;
 return document;
}

test('$ is the main.js getElementById lookup and passes the id through untouched',t=>{
 const asked=[],elements={'start-button':{id:'start-button'},'world-labels':{id:'world-labels'}};
 stubDocument(t,{getElementById(id){asked.push(id);return elements[id]??null;}});
 assert.equal($('start-button'),elements['start-button']);
 assert.equal($('world-labels'),elements['world-labels']);
 assert.equal($('missing'),null);
 assert.deepEqual(asked,['start-button','world-labels','missing']);
});

test('$$ returns a real array snapshot of querySelectorAll, defaulting to the document',t=>{
 const nodes=[{n:1},{n:2},{n:3}];
 const list={length:nodes.length,*[Symbol.iterator](){yield* nodes;}};
 const queried=[];
 const document=stubDocument(t,{querySelectorAll(selector){queried.push(['document',selector]);return list;}});
 const result=$$('.journey-row');
 assert.ok(Array.isArray(result));
 assert.deepEqual(result,nodes);
 assert.notEqual(result,list);
 assert.deepEqual(result.map(node=>node.n),[1,2,3]);
 assert.deepEqual(queried,[['document','.journey-row']]);
 // A root argument scopes the query and the document is not consulted.
 const root={querySelectorAll(selector){queried.push(['root',selector]);return [nodes[0]];}};
 assert.deepEqual($$('button',root),[nodes[0]]);
 assert.deepEqual(queried,[['document','.journey-row'],['root','button']]);
 assert.equal(globalThis.document,document);
 assert.deepEqual($$('.none',{querySelectorAll:()=>[]}),[]);
});

test('the shared lookups read the document at call time, so a replaced document is honoured',t=>{
 stubDocument(t,{getElementById:()=>'first',querySelectorAll:()=>['first']});
 assert.equal($('anything'),'first');
 globalThis.document={getElementById:()=>'second',querySelectorAll:()=>['second']};
 assert.equal($('anything'),'second');
 assert.deepEqual($$('anything'),['second']);
});
