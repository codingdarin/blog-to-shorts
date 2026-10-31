import test from 'node:test';
import assert from 'node:assert/strict';
import {clearlyUnsuitable,filterPromotionNews} from '../news-filter.mjs';
const incident='축제 참가한 현직 부시장, 3t 가마에 깔려 사망…日서 반복되는 사고, 왜? - 주간조선';
test('fatal incident is removed before classification; safe completion is not a keyword casualty',()=>{assert.equal(clearlyUnsuitable(incident),true);assert.equal(clearlyUnsuitable('고양 축제, 사고 없이 성료'),false);assert.equal(clearlyUnsuitable('서울 축제 안전 준비 나서'),false);});
test('classifier sees only candidates and retains source metadata in original order',async()=>{const input=[{title:incident},{title:'서울 문화 축제',url:'a'},{title:'고양 꽃 축제',url:'b'}];const r=await filterPromotionNews(input,'축제',async prompt=>{assert.ok(!prompt.includes(incident));return {keep:[1,0]};});assert.deepEqual(r.items.map(x=>x.url),['a','b']);});
test('uncertain or excluded candidates are not restored',async()=>{const r=await filterPromotionNews([{title:'알 수 없는 축제'}],'',async()=>({keep:[]}));assert.equal(r.items.length,0);});
test('invalid classifier output and outages fail closed',async()=>{for(const keep of [[3],['0'],[0,0]])await assert.rejects(filterPromotionNews([{title:'지역 축제'}],'',async()=>({keep})),/검사/);await assert.rejects(filterPromotionNews([{title:'지역 축제'}],'',async()=>{throw Error('API error');}),/API error/);});
test('all clearly excluded titles require no AI call',async()=>{let calls=0;const r=await filterPromotionNews([{title:incident}],'',async()=>{calls++;});assert.equal(calls,0);assert.equal(r.items.length,0);});
