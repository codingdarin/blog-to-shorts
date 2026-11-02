import test from 'node:test';
import assert from 'node:assert/strict';
import {captionPages,captionAt,captionTiming,validateCaptionLayers,narrationFromCaptions,editableCaptionPages,captionEditorIssue,captionPosition} from '../src/captions.js';
import {srtSubtitles} from '../timing.mjs';
const measure=text=>Array.from(text).reduce((sum,c)=>sum+(c===' '?8:34),0);
const compact=text=>text.replace(/\s/g,'');
const text='건설기계기술사 독학을 어디서부터 시작할지 고민되시나요? 시험 범위가 넓고 서술형 답안을 써야 해 막막할 수 있어요.';

test('captions preserve words and all content while limiting pages to two lines',()=>{
 for(const content of [text,'짧은 문구예요.','아주긴단어'.repeat(20)+' 다음 문장이에요.','English words stay together and Korean 문구도 그대로 보존해요.']){
  const pages=captionPages(content,measure);
  assert.equal(compact(pages.map(p=>p.text).join('')),compact(content));
  for(const page of pages){assert.ok(page.lines.length<=2);assert.equal(compact(page.lines.join('')),compact(page.text));}
  assert.deepEqual(pages.flatMap(p=>p.lines.flatMap(l=>l.split(/\s+/))),content.split(/\s+/));
 }
 assert.ok(captionPages(text,measure).length>1);
});
test('subtitle cues follow speech length and keep the final caption through the pause',()=>{
 const pages=captionPages(text,measure),cues=captionTiming(pages,12,8);
 assert.equal(cues[0].start,0);assert.equal(cues.at(-1).end,12);
 cues.forEach((c,i)=>{assert.ok(c.end>c.start);if(i)assert.equal(c.start,cues[i-1].end);if(i<cues.length-1)assert.ok(c.end<8);});
 assert.equal(captionAt(pages,0),pages[0]);assert.equal(captionAt(pages,1),pages.at(-1));
 const srt=srtSubtitles(cues.map(c=>c.text),cues.map(c=>c.end-c.start));
 assert.match(srt,/00:00:12,000/);
 assert.equal(srt.trim().split('\n\n').length,pages.length);
});
test('rejects missing words, extra words, malformed images and three-line captions',()=>{
 const pages=captionPages(text,measure).map(p=>({...p,dataUrl:'data:image/png;base64,AQID'}));
 assert.doesNotThrow(()=>validateCaptionLayers([pages],[text]));
 for(const changed of [pages.slice(1),pages.map((p,i)=>i? p:{...p,lines:['하나','둘','셋']}),pages.map(p=>({...p,dataUrl:'https://example.com/image.png'}))])assert.throws(()=>validateCaptionLayers([changed],[text]));
 assert.throws(()=>validateCaptionLayers([pages],[text+' 추가예요.']));
});


test('edited caption boundaries and line breaks survive narration, timing and SRT',()=>{
 const captions=['이 강의를 추천해요.\n다들 확인해 보세요.','모두 좋은 수업 들으세요.\n그럼 이만이에요.'];
 const pages=editableCaptionPages(captions),narration=narrationFromCaptions(captions);
 assert.equal(narration,'이 강의를 추천해요. 다들 확인해 보세요. 모두 좋은 수업 들으세요. 그럼 이만이에요.');
 assert.deepEqual(pages.map(p=>p.lines.join('\n')),captions);
 assert.equal(captionEditorIssue(captions),'');
 assert.doesNotThrow(()=>validateCaptionLayers([pages.map(p=>({...p,dataUrl:'data:image/png;base64,AQID'}))],[narration]));
 const cues=captionTiming(pages,10,8),srt=srtSubtitles(cues.map(c=>c.text),cues.map(c=>c.end-c.start));
 for(const [i,caption] of captions.entries()){
  assert.ok(srt.includes(caption));assert.equal(captionAt(pages,captionPosition(captions,i)),pages[i]);
 }
 assert.deepEqual(editableCaptionPages(['긴 문장을 한 줄로 직접 지정해요.'])[0].lines,['긴 문장을 한 줄로 직접 지정해요.']);
});

test('unfinished caption edits block rendering without discarding the user text',()=>{
 for(const captions of [[],[''],['완성해요.',''],['하나\n둘\n셋'],['첫 줄이에요.\n'],['가'.repeat(161)]])assert.ok(captionEditorIssue(captions));
 assert.equal(captionEditorIssue(['하나예요.\r\n둘이에요.']),'');
 assert.equal(narrationFromCaptions(['첫 자막이에요.','새 자막이에요.']),'첫 자막이에요. 새 자막이에요.');
 assert.equal(narrationFromCaptions(['첫 자막이에요.']),'첫 자막이에요.');
});
