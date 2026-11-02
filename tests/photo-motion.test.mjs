import test from 'node:test';
import assert from 'node:assert/strict';
import {photoMotion,photoMotionFilter} from '../src/photo-motion.js';
test('moving photos cover the box without blank margins at every position',()=>{
 for(const [width,height] of [[1920,1080],[600,2400],[800,800]])for(const index of [0,1,2,3,4,5])for(const p of [0,.25,.5,.75,1]){
  const {zoom,pan}=photoMotion(p,index),ratio=Math.max(620/width,600/height),w=width*ratio,h=height*ratio;
  const x=((620-w)/2-(620-620/zoom)*pan)*zoom,y=((600-h)/2-(600-600/zoom)/2)*zoom;
  assert.ok(x<=.0001&&x+w*zoom>=619.9999);assert.ok(y<=.0001&&y+h*zoom>=599.9999);
 }
});
test('zoom reverses, pan reveals different edges, and progress is clamped',()=>{
 assert.deepEqual(photoMotion(0,0),photoMotion(1,1));
 assert.ok(Math.abs(photoMotion(1,0).zoom-photoMotion(0,1).zoom)<1e-10);
 assert.ok(photoMotion(1,0).zoom-photoMotion(0,0).zoom>.3);
 assert.equal(photoMotion(0,2).pan,0);assert.equal(photoMotion(1,2).pan,1);
 assert.equal(photoMotion(0,3).pan,1);assert.equal(photoMotion(1,3).pan,0);
 assert.deepEqual(photoMotion(-2),photoMotion(0));assert.deepEqual(photoMotion(2),photoMotion(1));
 assert.deepEqual(photoMotion(.5,4),photoMotion(.5,0));
 for(const i of [0,1,2,3])assert.ok(!photoMotionFilter(i,1).includes('on/0'));
});
