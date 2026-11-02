import test from 'node:test';
import assert from 'node:assert/strict';
import {readRenderStream} from '../src/render-stream.js';
function stream(events,split=false){
 const bytes=new TextEncoder().encode(events.map(e=>JSON.stringify(e)).join('\n'));
 return new Response(new ReadableStream({start(controller){if(split)for(const byte of bytes)controller.enqueue(Uint8Array.of(byte));else controller.enqueue(bytes);controller.close();}}));
}
test('progress survives split UTF-8 chunks and completion without trailing newline',async()=>{
 const seen=[],result={videoUrl:'/api/video/test',duration:45,subtitles:'자막'};
 assert.deepEqual(await readRenderStream(stream([{type:'heartbeat'},{type:'progress',percent:40,label:'음성 완료'},{type:'complete',result}],true),p=>seen.push(p)),result);
 assert.deepEqual(seen.map(p=>[p.percent,p.label]),[[40,'음성 완료']]);
});
test('render failure retains reported progress and never returns success',async()=>{
 const seen=[];await assert.rejects(readRenderStream(stream([{type:'progress',percent:40,label:'음성 완료'},{type:'error',error:'음성이 60초를 초과했어요.'}]),p=>seen.push(p)),/60초/);assert.equal(seen[0].percent,40);
});
test('a disconnected stream is an error, not a completed render',async()=>{
 await assert.rejects(readRenderStream(stream([{type:'progress',percent:90,label:'음악 믹싱'}]),()=>{}),/연결이 끊겼/);
});
test('validation errors before streaming are shown to the user',async()=>{
 await assert.rejects(readRenderStream(new Response(JSON.stringify({error:'다른 영상을 생성 중이에요.'}),{status:409}),()=>{}),/다른 영상/);
});
