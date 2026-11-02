import test from 'node:test';
import assert from 'node:assert/strict';
import {sceneDurations,srtSubtitles,narrationSpeed,narrationBudget,fittedNarrationSpeed,tempoFilter} from '../timing.mjs';
test('overlong narration speeds up without cutting words or losing subtitle time',()=>{
 for(const count of [4,5,6])for(const speed of [1,1.5,1.75,2]){
  const speech=Array(count).fill(17),fitted=fittedNarrationSpeed(speech,speed);
  assert.ok(fitted>speed);
  const durations=sceneDurations(Array(count).fill('설명이에요.'),speech.map(s=>s*speed/fitted),45);
  assert.ok(durations.reduce((a,b)=>a+b,0)<=60);
 }
 assert.equal(fittedNarrationSpeed([5,6,5,6],1.5),1.5);
 assert.equal(tempoFilter(3.5),'atempo=2,atempo=1.75');
});
test('speed defaults for existing clients and text budget stays within scene capacity',()=>{
 assert.equal(narrationSpeed(),1);
 assert.ok(narrationBudget(45,1).max<narrationBudget(45,2).max);
 assert.ok(narrationBudget(60,2,4).max<=4*160);
 for(const speed of [NaN,Infinity,null,'1',0,-1,10])assert.throws(()=>narrationSpeed(speed),/더빙 속도/);
});
test('silent render is exactly 30–60 seconds for 4–6 scenes',()=>{
 for(const n of [4,5,6])for(const target of [30,45,60]){const durations=sceneDurations(Array.from({length:n},(_,i)=>'가'.repeat(i+1)),null,target);assert.equal(Math.round(durations.reduce((a,b)=>a+b,0)*30),target*30);assert.ok(durations.every(d=>d>0));}
});
test('speech is never cut; short targets extend and >60 seconds fail',()=>{
 const texts=Array(5).fill('본문이에요.'),speech=[8,9,10,8,7];const d=sceneDurations(texts,speech,30);assert.ok(d.every((v,i)=>v>=speech[i]+.35));assert.ok(d.reduce((a,b)=>a+b,0)<=60);
 assert.throws(()=>sceneDurations(texts,Array(5).fill(13),45),/60초/);
});
test('subtitles align with exact scene boundaries',()=>{
 const srt=srtSubtitles(['첫 장면이에요.','마지막이에요.'],[7.5,22.5]);assert.match(srt,/00:00:00,000 --> 00:00:07,500/);assert.match(srt,/00:00:07,500 --> 00:00:30,000/);
});
