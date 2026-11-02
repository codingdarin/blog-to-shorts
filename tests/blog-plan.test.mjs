import test from 'node:test';
import assert from 'node:assert/strict';
import {planBlog,validatePlanInput,callAI} from '../ai.mjs';
const input={title:'공부하는 방법',text:'핵심 개념을 자신의 말로 설명하고 배운 내용을 다시 확인해 보세요.',sceneCount:5,duration:45,tone:'education',photos:[{id:'1',description:'학습 순서',dataUrl:'data:image/png;base64,AQID'}]};
const draft=n=>({headline:'개념을 내 것으로 만드는 방법',scenes:Array.from({length:n},(_,i)=>({role:i===0?'hook':i===n-1?'cta':'body',text:'핵심 개념을 자신의 말로 설명해 보세요.',photoId:'1',reason:'학습 순서와 관련된 이미지예요.'})),warnings:[]});
test('plan uses full text and actual images, preserves 4–6 scenes and CTA',async()=>{
 for(const n of [4,5,6]){const r=await planBlog({...input,sceneCount:n},async(prompt,schema,system,photos)=>{assert.match(prompt,/자신의 말로 설명하고/);assert.match(prompt,/45초/);assert.match(prompt,/CTA/);assert.equal(schema.properties.scenes.minItems,n);assert.deepEqual(photos,input.photos);return draft(n);});assert.equal(r.scenes.length,n);}
});
test('rejects invalid counts, lengths, tone, images and malformed AI scenes',async()=>{
 for(const patch of [{sceneCount:3},{sceneCount:7},{duration:20},{duration:61},{tone:'__proto__'},{text:'짧음'},{photos:[{id:'1',dataUrl:'https://example.com/a.png'}]}])assert.throws(()=>validatePlanInput({...input,...patch}));
 for(const change of [d=>d.scenes.pop(),d=>d.scenes[0].photoId='unknown',d=>d.scenes[4].role='body',d=>d.scenes[1].text='요'.repeat(161)])await assert.rejects(planBlog(input,async()=>{const d=draft(5);change(d);return d;}),/형식/);
});
test('text-only generation uses empty photo IDs without inventing images',async()=>{
 const r=await planBlog({...input,photos:[]},async(prompt,schema)=>{assert.deepEqual(schema.properties.scenes.items.properties.photoId.enum,['']);const d=draft(5);d.scenes.forEach(s=>s.photoId='');return d;});assert.equal(r.scenes[0].photoId,'');
});
test('repairs misplaced CTA and formal narration together, once',async()=>{
 let calls=0;
 const result=await planBlog(input,async prompt=>{calls++;const d=draft(5);if(calls===1){d.scenes[2].role='cta';d.scenes[3].text='답안을 작성하고 내용을 점검합니다.';}else{assert.match(prompt,/장면 3의 role은 body/);assert.match(prompt,/장면 4 해요체 오류/);assert.match(prompt,/초안이 검증에 실패/);}return d;});
 assert.equal(calls,2);assert.equal(result.scenes[2].role,'body');
});
test('failed plan repair stops after two calls and identifies the invalid scene',async()=>{
 let calls=0;await assert.rejects(planBlog(input,async()=>{calls++;const d=draft(5);d.scenes[2].role='cta';return d;}),/장면 3의 role은 body/);assert.equal(calls,2);
});
test('provider failures are not retried as malformed drafts',async()=>{
 let calls=0;await assert.rejects(planBlog(input,async()=>{calls++;throw Error('API 429');}),/API 429/);assert.equal(calls,1);
});
test('both provider payloads carry image bytes, not only captions',async()=>{
 const saved={fetch:globalThis.fetch,nvidia:process.env.NVIDIA_API_KEY,gemini:process.env.GEMINI_API_KEY,confirmed:process.env.AI_FREE_TIER_CONFIRMED};
 try{process.env.AI_FREE_TIER_CONFIRMED='true';
  for(const provider of ['nvidia','gemini']){
   delete process.env.NVIDIA_API_KEY;delete process.env.GEMINI_API_KEY;process.env[provider==='nvidia'?'NVIDIA_API_KEY':'GEMINI_API_KEY']='test';
   globalThis.fetch=async(url,options)=>{const payload=JSON.parse(options.body);if(provider==='nvidia'){assert.equal(payload.messages[1].content[2].image_url.url,input.photos[0].dataUrl);return new Response(JSON.stringify({choices:[{message:{content:'{}'}}]}));}assert.equal(payload.contents[0].parts[2].inlineData.data,'AQID');return new Response(JSON.stringify({candidates:[{content:{parts:[{text:'{}'}]}}]}));};
   await callAI('test',undefined,undefined,input.photos);
  }
 }finally{globalThis.fetch=saved.fetch;for(const [key,value] of [['NVIDIA_API_KEY',saved.nvidia],['GEMINI_API_KEY',saved.gemini],['AI_FREE_TIER_CONFIRMED',saved.confirmed]]){if(value===undefined)delete process.env[key];else process.env[key]=value;}}
});
