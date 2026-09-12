import test from 'node:test';
import assert from 'node:assert/strict';
import {bindPageActivity} from '../dist/page-activity.js';

function setup(hidden=false){
 const windowTarget=new EventTarget(),documentTarget=new EventTarget();
 documentTarget.hidden=hidden;
 const input={walking:true,attacking:true,joystick:{x:1,y:0}};
 const changes=[];
 let backgrounded,releaseCount=0;
 const dispose=bindPageActivity({windowTarget,documentTarget,
  releaseInput({resetTouch}){releaseCount++;input.walking=false;input.attacking=false;if(resetTouch)input.joystick={x:0,y:0};},
  setBackgrounded(value){backgrounded=value;changes.push(value);}
 });
 return {windowTarget,documentTarget,input,changes,dispose,
  get backgrounded(){return backgrounded;},get releaseCount(){return releaseCount;},
  visibility(value){documentTarget.hidden=value;documentTarget.dispatchEvent(new Event('visibilitychange'));}
 };
}

test('repeated visible-page blur clears stale keys without pausing or cancelling an active touch drag',()=>{
 const page=setup();
 for(let i=0;i<8;i++)page.windowTarget.dispatchEvent(new Event('blur'));
 assert.equal(page.releaseCount,8);
 assert.deepEqual(page.input,{walking:false,attacking:false,joystick:{x:1,y:0}});
 assert.equal(page.backgrounded,false);
 assert.deepEqual(page.changes,[false]);
});

test('switching apps suspends silently and returning resumes without requiring focus',()=>{
 const page=setup();
 page.visibility(true);
 assert.equal(page.backgrounded,true);
 assert.equal(page.releaseCount,1);
 assert.deepEqual(page.input.joystick,{x:0,y:0});
 page.windowTarget.dispatchEvent(new Event('focus'));
 assert.equal(page.backgrounded,true);
 page.visibility(false);
 assert.equal(page.backgrounded,false);
 assert.equal(page.releaseCount,1);
 assert.deepEqual(page.changes,[false,true,false]);
});

test('a page opened in the background starts suspended and resumes when shown',()=>{
 const page=setup(true);
 assert.equal(page.backgrounded,true);
 assert.equal(page.releaseCount,1);
 page.visibility(false);
 assert.equal(page.backgrounded,false);
});

test('disposing page activity removes its event handlers',()=>{
 const page=setup();
 page.dispose();
 page.windowTarget.dispatchEvent(new Event('blur'));
 page.visibility(true);
 assert.equal(page.releaseCount,0);
 assert.deepEqual(page.changes,[false]);
});
