import test from 'node:test';
import assert from 'node:assert/strict';
import {videoFilename,videoDisposition} from '../download-name.mjs';

test('download title uses Korean calendar date even across UTC midnight',()=>{
 assert.equal(videoFilename('건설기사 공부법',new Date('2026-11-01T15:00:00Z')),'261102_건설기사 공부법.mp4');
});
test('download names remove forbidden path and header characters and provide a fallback',()=>{
 const date=new Date('2026-11-02T00:00:00Z');
 assert.equal(videoFilename('../건설:기사?\r\n공부법.',date),'261102_.. 건설 기사 공부법.mp4');
 assert.equal(videoFilename(' /:*? ',date),'261102_블로그투쇼츠.mp4');
 const name=videoFilename('건설기사 공부법',date),header=videoDisposition(name);
 assert.ok(header.includes(`filename*=UTF-8''${encodeURIComponent(name)}`));
 assert.ok(/^[\x20-\x7e]+$/.test(header));
});
