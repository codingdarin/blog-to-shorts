import test from 'node:test';
import assert from 'node:assert/strict';
import {photoMotion} from '../src/photo-motion.js';
test('motion preserves every image edge for portrait, landscape, and square photos',()=>{
 for(const [width,height] of [[1920,1080],[600,2400],[800,800]])for(const index of [0,1])for(const p of [0,.25,.5,.75,1]){
  const {zoom,pan}=photoMotion(p,index),ratio=Math.min(620/width,600/height)*.94,w=width*ratio,h=height*ratio;
  const x=((620-w)/2-(620-620/zoom)*pan)*zoom,y=((600-h)/2-(600-600/zoom)/2)*zoom;
  assert.ok(x>=0&&x+w*zoom<=620);assert.ok(y>=0&&y+h*zoom<=600);
 }
});
test('alternate scenes reverse motion, and out-of-range progress is clamped',()=>{
 assert.deepEqual(photoMotion(0,0),photoMotion(1,1));assert.deepEqual(photoMotion(1,0),photoMotion(0,1));assert.deepEqual(photoMotion(-2),photoMotion(0));assert.deepEqual(photoMotion(2),photoMotion(1));
});
