import test from 'node:test';
import assert from 'node:assert/strict';
import {parseArticle,articleUrl} from '../articles.mjs';
import {musicWav} from '../music.mjs';
import {searchFestivals} from '../festivals.mjs';
const url='https://www.yongin.go.kr/user/bbs/BD_selectBbs.do?q_bbsCode=1020&q_bbscttSn=20250929110310150';
const fixture=type=>`<table id="contentsTable"><td class="title">시민 축제 현장</td><td class="tview_desc">2025년 시민 축제에서 운동선수와 어린이가 함께 축구를 배우는 행사가 열렸습니다.<img alt="제${type}유형"><a href="/component/file/ND_fileDownload.do?id=1">축제 현장 축구 레슨.jpg</a><a href="/component/file/ND_fileDownload.do?id=2">축제 포스터.jpg</a></td></table>`;
test('only explicitly licensed photos, no poster substitution',()=>{const a=parseArticle(fixture(1),url);assert.equal(a.photos.length,1);assert.match(a.photos[0].description,/레슨/);});
test('missing and restricted licenses are rejected',()=>{for(const type of [2,3,4,0])assert.throws(()=>parseArticle(fixture(type),url),/제1유형/);});
test('arbitrary hosts and non-article endpoints are rejected',()=>{for(const bad of ['http://127.0.0.1/','https://www.yongin.go.kr.evil.test/','https://www.yongin.go.kr/'])assert.throws(()=>articleUrl(bad));});
test('WAV duration, mute and effects follow requested cut times',()=>{const mute=musicWav(1,{music:'none',volume:0});assert.equal(mute.length,44+24000*2);assert.ok(mute.subarray(44).every(b=>b===0));const fx=musicWav(1,{music:'none',volume:0,sfx:true,cuts:[.5]});assert.ok(fx.subarray(44,44+24000).every(b=>b===0));assert.ok(fx.subarray(44+24000,44+32000).some(b=>b!==0));assert.throws(()=>musicWav(1,{music:'bad'}));});
test('TourAPI missing key is explicit, not mock festival data',async()=>{const saved=process.env.TOUR_API_KEY;delete process.env.TOUR_API_KEY;try{await assert.rejects(searchFestivals('20261031','20261130'),/키가 아직/);}finally{if(saved)process.env.TOUR_API_KEY=saved;}});

const ggUrl='https://gnews.gg.go.kr/news/news_detail.do?number=202610122206567972C094&s_code=C094';
const ggFixture=type=>`<div id="contents"><h3>2026 고양가을꽃축제</h3><div class="postbody">고양가을꽃축제에서 국화 정원과 지역 농가의 플라워마켓을 만났습니다.<img src="http://gnews.gg.go.kr/OP_UPDATA/photo.jpg" alt="고양가을꽃축제 현장의 국화 정원 ⓒ 사진기자"><img src="https://evil.test/image.jpg" alt="다른 서버의 행사 현장 사진"><img src="/OP_UPDATA/poster.jpg" alt="고양가을꽃축제 포스터"></div></div><div class="cc"><a href="https://www.kogl.or.kr/info/licenseType${type}.do">제${type}유형</a></div><aside><img src="/OP_UPDATA/unrelated.jpg" alt="관계없는 인기뉴스 사진"></aside>`;
test('Gyeonggi article isolates body images and preserves credit',()=>{const a=parseArticle(ggFixture(1),ggUrl);assert.equal(a.photos.length,1);assert.equal(a.photos[0].artist,'사진기자');assert.equal(a.photos[0].imageUrl,'https://gnews.gg.go.kr/OP_UPDATA/photo.jpg');assert.equal(a.year,'2026');});
test('Gyeonggi restricted licenses and image exclusions are rejected',()=>{for(const t of [2,3,4,0])assert.throws(()=>parseArticle(ggFixture(t),ggUrl),/제1유형/);assert.throws(()=>parseArticle(ggFixture(1).replace('고양가을꽃축제에서','사진 별도 이용 금지. 고양가을꽃축제에서'),ggUrl),/별도/);assert.throws(()=>articleUrl(ggUrl.replace('gnews.gg.go.kr','gnews.gg.go.kr.evil.test')));});
const {matchesFestival}=await import('../festivals.mjs');
test('festival matches reject other events and years, normalize spaces',()=>{const f={title:'고양가을꽃축제',start:'20261001'};assert.equal(matchesFestival({title:'2026 고양 가을꽃 축제 현장',date:'2026-10-13'},f),true);assert.equal(matchesFestival({title:'고양가을꽃축제',date:'2025-10-13'},f),false);assert.equal(matchesFestival({title:'가평 봄꽃축제',date:'2026-10-13'},f),false);});
