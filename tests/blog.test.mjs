import test from 'node:test';
import assert from 'node:assert/strict';
import {blogUrl,imageUrl,parseBlog,getBlog} from '../blog.mjs';
const url='https://blog.naver.com/teacher/123456';
const img='https://blogfiles.pstatic.net/test/example.png';
const html=`<title>블로그</title><div class="se-title-text">분수의 덧셈</div><span class="nick">선생님</span><div class="se-main-container"><div class="se-component"><p>분모가 같으면 분자끼리 더해요.</p><img src="${img}?type=blur" data-lazy-src="${img}?type=w800"><p class="se-caption">분수 그림</p></div><img src="${img}?type=w300"><img src="https://outside.test/tracking.png"><script>untrusted script</script></div><aside><img src="${img}/profile"><p>관련 글은 본문이 아니에요.</p></aside>`;
test('desktop, mobile and PostView URLs resolve to the same post',()=>{
 for(const value of [url,url.replace('blog.','m.blog.'), 'https://blog.naver.com/PostView.naver?blogId=teacher&logNo=123456&redirect=Dlog',url+'?tracking=1'])assert.equal(blogUrl(value),url);
});
test('arbitrary hosts, homepages, credentials and ports are rejected',()=>{
 for(const value of ['http://127.0.0.1/','https://blog.naver.com.evil.test/teacher/123456','https://blog.naver.com/teacher','https://user:pw@blog.naver.com/teacher/123456','https://blog.naver.com:8443/teacher/123456'])assert.throws(()=>blogUrl(value));
 for(const value of ['file:///tmp/a','https://evil.test/photo.png','https://blogfiles.pstatic.net.evil.test/a'])assert.throws(()=>imageUrl(value));
});
test('extracts body, lazy images and captions without profile or related images',()=>{
 const result=parseBlog(html,url);assert.equal(result.title,'분수의 덧셈');assert.equal(result.photos.length,1);assert.equal(result.photos[0].description,'분수 그림');assert.match(result.photos[0].imageUrl,/type=w966/);assert.doesNotMatch(result.text,/관련 글|untrusted script/);assert.equal(result.source,'선생님');assert.equal(result.warnings.length,1);
});
test('legacy posts, text-only posts, truncation and missing body',()=>{
 const legacy='<meta property="og:title" content="공부 방법"><div id="postViewArea">확인한 개념을 다시 설명해 보세요.<br>자신의 말로 정리해 보세요.</div>';
 assert.match(parseBlog(legacy,url).text,/\n/);assert.equal(parseBlog(legacy,url).photos.length,0);
 assert.equal(parseBlog(legacy.replace('확인한 개념','가'.repeat(13000)),url).text.length,12000);
 assert.throws(()=>parseBlog('<h1>로그인하세요</h1>',url),/공개 본문/);
});
test('crawler downloads allowed images and rejects redirect to arbitrary host',async()=>{
 const calls=[];const result=await getBlog(url,async requested=>{calls.push(requested);return requested.includes('m.blog.')?new Response(html):new Response(new Uint8Array([1,2]),{headers:{'content-type':'image/png'}});});
 assert.equal(calls.length,2);assert.match(result.photos[0].dataUrl,/^data:image\/png;base64,/);
 await assert.rejects(getBlog(url,async()=>new Response(null,{status:302,headers:{location:'http://127.0.0.1/private'}})),/네이버/);
});
test('bad images are reported without losing usable text',async()=>{
 const result=await getBlog(url,async requested=>requested.includes('m.blog.')?new Response(html):new Response('not an image',{headers:{'content-type':'text/html'}}));
 assert.equal(result.photos.length,0);assert.match(result.text,/분모/);assert.ok(result.warnings.some(w=>w.includes('다운로드')));
});
test('large responses and redirect loops are bounded',async()=>{
 await assert.rejects(getBlog(url,async()=>new Response('large',{headers:{'content-length':'5000000'}})),/크기/);
 let calls=0;await assert.rejects(getBlog(url,async()=>{calls++;return new Response(null,{status:302,headers:{location:url}});}),/리디렉션/);assert.equal(calls,4);
});
