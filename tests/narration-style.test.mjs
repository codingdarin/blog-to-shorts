import test from 'node:test';
import assert from 'node:assert/strict';
import {narrationStyleIssues,styledGeneration} from '../ai.mjs';
test('every sentence must be conversational honorific, including the hook',()=>{
 assert.deepEqual(narrationStyleIssues(['어떤 곳일까요? 꽃을 볼 수 있어요.','꽃이 가득하죠!','2026년 10월 3일에 열렸어요.']),[]);
 for(const text of ['축제가 열렸다. 꽃을 볼 수 있어요.','축제가 열렸습니다.','꽃으로 가득한 정원.','거대한 고양이? 꽃 사이에 있어요.','축제가 열렸어.'])assert.ok(narrationStyleIssues([text]).length,text);
});
test('valid narration does not consume a correction call',async()=>{let calls=0;const r=await styledGeneration('근거',undefined,r=>r.scenes,()=>{},async()=>{calls++;return {scenes:['꽃을 볼 수 있어요.']};});assert.equal(calls,1);assert.equal(r.scenes[0],'꽃을 볼 수 있어요.');});
test('mixed narration is corrected once with its draft',async()=>{let calls=0;const r=await styledGeneration('근거',undefined,r=>r.scenes,()=>{},async prompt=>{calls++;if(calls===1)return {scenes:['축제가 열렸다.']};assert.match(prompt,/축제가 열렸다/);return {scenes:['축제가 열렸어요.']};});assert.equal(calls,2);assert.equal(r.scenes[0],'축제가 열렸어요.');});
test('failed correction is rejected without an endless retry',async()=>{let calls=0;await assert.rejects(styledGeneration('근거',undefined,r=>r.scenes,()=>{},async()=>{calls++;return {scenes:['축제가 열렸다.']};}),/사용하지 않았습니다/);assert.equal(calls,2);});
test('provider errors and malformed output are not retried as style failures',async()=>{let calls=0;await assert.rejects(styledGeneration('근거',undefined,r=>r.scenes,()=>{},async()=>{calls++;throw Error('API 429');}),/429/);assert.equal(calls,1);await assert.rejects(styledGeneration('근거',undefined,r=>r.scenes,()=>{throw Error('shape');},async()=>({})),/shape/);});
