import test from 'node:test';
import assert from 'node:assert/strict';
import {photoMotion,photoMotionFilter} from '../src/photo-motion.js';
import {spawnSync} from 'node:child_process';
import ffmpeg from 'ffmpeg-static';
test('moving photos cover the box without blank margins at every position',()=>{
 for(const [width,height] of [[1920,1080],[600,2400],[800,800]])for(const index of [0,1,2,3,4,5])for(const p of [0,.25,.5,.75,1]){
  const {zoom,pan}=photoMotion(p,index),ratio=Math.max(620/width,600/height),w=width*ratio,h=height*ratio;
  const x=((620-w)/2-(620-620/zoom)*pan)*zoom,y=((600-h)/2-(600-600/zoom)/2)*zoom;
  assert.ok(x<=.0001&&x+w*zoom>=619.9999);assert.ok(y<=.0001&&y+h*zoom>=599.9999);
 }
});

test('rendered motion follows fractional coordinates without pixel-step jitter',()=>{
 const width=160,height=160,frames=240;
 for(const mode of [0,1,2,3]){
  const result=spawnSync(ffmpeg,['-v','error','-filter_threads','1','-f','lavfi','-i','color=c=black:s=160x160:r=30,drawbox=x=70:y=60:w=6:h=6:color=white:t=fill','-vf',photoMotionFilter(mode,frames)+',format=gray','-frames:v',String(frames),'-f','rawvideo','pipe:1'],{windowsHide:true,maxBuffer:16e6});
  assert.equal(result.status,0,result.stderr.toString());
  assert.equal(result.stdout.length,width*height*frames);
  let previous,previousExpected,error=0,maxError=0;
  for(let f=0;f<frames;f++){
   let mass=0,xsum=0,ysum=0;const offset=f*width*height;
   for(let y=0;y<height;y++)for(let x=0;x<width;x++){const v=result.stdout[offset+y*width+x];mass+=v;xsum+=v*x;ysum+=v*y;}
   const point=[xsum/mass,ysum/mass],{zoom,pan}=photoMotion(f/(frames-1),mode);
   const expected=[(72.5-(width-width/zoom)*pan)*zoom,(62.5-(height-height/zoom)/2)*zoom];
   assert.ok(Math.hypot(point[0]-expected[0],point[1]-expected[1])<.05,'render and preview follow the same path');
   if(previous){const dx=point[0]-previous[0]-(expected[0]-previousExpected[0]),dy=point[1]-previous[1]-(expected[1]-previousExpected[1]);error+=dx*dx+dy*dy;maxError=Math.max(maxError,Math.hypot(dx,dy));}
   previous=point;previousExpected=expected;
  }
  assert.ok(Math.sqrt(error/(frames-1))<.04,`mode ${mode}: jitter RMS`);
  assert.ok(maxError<.08,`mode ${mode}: single-frame jump`);
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
