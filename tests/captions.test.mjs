import test from 'node:test';
import assert from 'node:assert/strict';
import {captionPages,captionAt,captionTiming,validateCaptionLayers,narrationFromCaptions,editableCaptionPages,captionEditorIssue,captionPosition} from '../src/captions.js';
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
});
test('rejects missing words, extra words, malformed images and three-line captions',()=>{
 const pages=captionPages(text,measure).map(p=>({...p,dataUrl:'data:image/png;base64,AQID'}));
 assert.doesNotThrow(()=>validateCaptionLayers([pages],[text]));
 for(const changed of [pages.slice(1),pages.map((p,i)=>i? p:{...p,lines:['하나','둘','셋']}),pages.map(p=>({...p,dataUrl:'https://example.com/image.png'}))])assert.throws(()=>validateCaptionLayers([changed],[text]));
 assert.throws(()=>validateCaptionLayers([pages],[text+' 추가예요.']));
});


test('edited caption boundaries and line breaks survive narration and timing',()=>{
 const captions=['이 강의를 추천해요.\n다들 확인해 보세요.','모두 좋은 수업 들으세요.\n그럼 이만이에요.'];
 const pages=editableCaptionPages(captions),narration=narrationFromCaptions(captions);
 assert.equal(narration,'이 강의를 추천해요. 다들 확인해 보세요. 모두 좋은 수업 들으세요. 그럼 이만이에요.');
 assert.deepEqual(pages.map(p=>p.lines.join('\n')),captions);
 assert.equal(captionEditorIssue(captions),'');
 assert.doesNotThrow(()=>validateCaptionLayers([pages.map(p=>({...p,dataUrl:'data:image/png;base64,AQID'}))],[narration]));
 const cues=captionTiming(pages,10,8);
 for(const [i,caption] of captions.entries()){
  assert.equal(cues[i].text,caption);assert.equal(captionAt(pages,captionPosition(captions,i)),pages[i]);
 }
 assert.deepEqual(editableCaptionPages(['긴 문장을 한 줄로 직접 지정해요.'])[0].lines,['긴 문장을 한 줄로 직접 지정해요.']);
});

test('unfinished caption edits block rendering without discarding the user text',()=>{
 for(const captions of [[],[''],['완성해요.',''],['하나\n둘\n셋'],['첫 줄이에요.\n'],['가'.repeat(161)]])assert.ok(captionEditorIssue(captions));
 assert.equal(captionEditorIssue(['하나예요.\r\n둘이에요.']),'');
 assert.equal(narrationFromCaptions(['첫 자막이에요.','새 자막이에요.']),'첫 자막이에요. 새 자막이에요.');
 assert.equal(narrationFromCaptions(['첫 자막이에요.']),'첫 자막이에요.');
});


test('automatic captions move the whole predicate phrase instead of leaving a short tail',()=>{
 const content='자격동스쿨의 최신 건설기계기술사 패키지는 주요 이론과 기출문제 학습을 함께 다뤄요.';
 const pages=captionPages(content,measure);
 assert.deepEqual(pages.map(p=>p.text),['자격동스쿨의 최신 건설기계기술사 패키지는','주요 이론과 기출문제 학습을 함께 다뤄요.']);
 for(const sample of [content,'먼저 건설기계 구조와 작동 원리, 설계와 유지관리 지식을 체계적으로 정리해 보세요.','기출문제로 출제 경향을 확인한 뒤 답안을 직접 작성하는 연습을 병행하는 것이 중요해요.']){
  const result=captionPages(sample,measure);
  assert.deepEqual(result.flatMap(p=>p.text.split(' ')),sample.split(' '));
  assert.ok(result.every(p=>p.text.split(' ').length>=3));
  assert.ok(result.every(p=>p.lines.length<=2&&p.lines.every(line=>measure(line)<=636)));
  assert.ok(!result.some(p=>/작성하는$/.test(p.text)));
 }
});

test('complete short sentences remain intact and manual edits are never resegmented',()=>{
 const content='확인해 보세요. 함께 시작해요!';
 assert.deepEqual(captionPages(content,measure).map(p=>p.text),['확인해 보세요.','함께 시작해요!']);
 const manual=['주요 이론과\n기출문제 학습을','함께 다뤄요.'];
 assert.deepEqual(editableCaptionPages(manual).map(p=>p.lines.join('\n')),manual);
 assert.deepEqual(captionPages('',measure),[]);
});


test('fitting object phrases take priority over equal line lengths',()=>{
 const content='설계와 유지관리 지식을 체계적으로 정리해 보세요.';
 assert.deepEqual(captionPages(content,measure)[0].lines,['설계와 유지관리 지식을','체계적으로 정리해 보세요.']);
 const full='먼저 건설기계의 구조와 작동 원리, '+content;
 assert.ok(captionPages(full,measure).some(page=>page.lines[0]==='설계와 유지관리 지식을'));
});

test('semantic grouping yields to the actual width limit, even by one pixel',()=>{
 const content='설계와 유지관리 지식을 정리해요.',phrase='설계와 유지관리 지식을',exactWidth=measure(phrase);
 assert.deepEqual(captionPages(content,measure,exactWidth)[0].lines,[phrase,'정리해요.']);
 const narrow=captionPages(content,measure,exactWidth-1);
 assert.deepEqual(narrow[0].lines,['설계와 유지관리','지식을 정리해요.']);
 for(const width of [exactWidth-1,200,636]){
  const pages=captionPages(content,measure,width);
  assert.ok(pages.every(page=>page.lines.length<=2&&page.lines.every(line=>measure(line)<=width)));
  assert.deepEqual(pages.flatMap(p=>p.lines.join(' ').split(' ')),content.split(' '));
 }
});
