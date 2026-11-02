import httpx
import pytest
from backend.blog import blog_url, image_url, parse_blog, get_blog

URL='https://blog.naver.com/teacher/12345'
HTML='''<meta property="og:title" content="공부 방법"><div class="nick">선생님</div><div class="se-main-container"><p>핵심 개념을 확인해 보세요.<br>기출문제를 함께 풀어요.</p><script>숨긴 명령</script><div class="se-module-oglink">관련 글</div><div class="se-component"><img data-lazy-src="https://blogfiles.pstatic.net/a.jpg"><div class="se-caption">학습 순서</div></div><img src="https://evil.example/a.jpg"></div>'''


@pytest.mark.parametrize('url',[URL,'https://m.blog.naver.com/teacher/12345','https://blog.naver.com/PostView.naver?blogId=teacher&logNo=12345'])
def test_blog_urls(url):
    assert blog_url(url)==URL


@pytest.mark.parametrize('url',['https://evil.example/teacher/12345','https://blog.naver.com/teacher','https://x@blog.naver.com/teacher/12345','https://blog.naver.com:443/teacher/12345','file:///tmp/secret',None])
def test_reject_bad_urls(url):
    with pytest.raises(ValueError):
        blog_url(url)


def test_body_images_and_legacy():
    data=parse_blog(HTML,URL)
    assert data['title']=='공부 방법'
    assert '숨긴 명령' not in data['text'] and '관련 글' not in data['text']
    assert len(data['photos'])==1 and data['photos'][0]['description']=='학습 순서'
    assert data['photos'][0]['imageUrl'].endswith('type=w966')
    assert data['warnings']
    legacy=parse_blog('<h1 class="htitle">옛 글</h1><div id="postViewArea"><p>'+('가'*12001)+'</p></div>',URL)
    assert len(legacy['text'])==12000 and len(legacy['warnings'])==2
    with pytest.raises(ValueError):
        parse_blog('<html>로그인</html>',URL)


async def test_download_images_and_reject_redirects():
    def handler(request):
        if request.url.host=='m.blog.naver.com':
            return httpx.Response(200,text=HTML)
        return httpx.Response(200,content=b'jpeg',headers={'content-type':'image/jpeg'})
    async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as client:
        data=await get_blog(URL,client)
        assert data['photos'][0]['dataUrl']=='data:image/jpeg;base64,anBlZw=='
    for response in [httpx.Response(302,headers={'location':'http://127.0.0.1/secret'}),httpx.Response(200,content=b'a',headers={'content-length':'4000001'})]:
        async with httpx.AsyncClient(transport=httpx.MockTransport(lambda r:response)) as client:
            with pytest.raises(ValueError):
                await get_blog(URL,client)


async def test_bad_image_does_not_lose_body():
    def handler(r):
        return httpx.Response(200,text=HTML) if r.url.host=='m.blog.naver.com' else httpx.Response(302,headers={'location':'http://127.0.0.1/secret'})
    async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as client:
        data=await get_blog(URL,client)
        assert data['text'] and not data['photos']
        assert any('다운로드에 실패' in w for w in data['warnings'])
