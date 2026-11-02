import base64
import re
from urllib.parse import urlsplit, urlunsplit, parse_qs, urlencode, urljoin

import httpx
from bs4 import BeautifulSoup

BLOG_HOSTS = {'blog.naver.com', 'm.blog.naver.com'}
IMAGE_HOSTS = {'blogfiles.pstatic.net', 'mblogthumb-phinf.pstatic.net', 'postfiles.pstatic.net', 'blogthumb.pstatic.net'}


def checked_url(value, hosts):
    try:
        u = urlsplit(value)
        if u.scheme not in ('http', 'https') or u.hostname not in hosts or u.username or u.password or u.port or ':' in u.netloc:
            raise ValueError()
        return u
    except (ValueError, TypeError, AttributeError):
        raise ValueError('지원하지 않는 네이버 블로그 주소예요.') from None


def blog_url(value):
    u = checked_url(value, BLOG_HOSTS)
    path = re.fullmatch(r'/([\w-]+)/(\d+)/?', u.path, re.ASCII)
    query = parse_qs(u.query)
    blog_id = path[1] if path else query.get('blogId', [''])[0] if re.fullmatch(r'/(?:PostView|PostView.naver)/?', u.path, re.I) else ''
    log_no = path[2] if path else query.get('logNo', [''])[0]
    if not re.fullmatch(r'[\w-]{2,64}', blog_id, re.ASCII) or not re.fullmatch(r'\d{1,20}', log_no, re.ASCII):
        raise ValueError('블로그 홈 주소 대신 개별 글 주소를 입력해 주세요.')
    return f'https://blog.naver.com/{blog_id}/{log_no}'


def image_url(value):
    u = checked_url(value, IMAGE_HOSTS)
    query = parse_qs(u.query, keep_blank_values=True)
    query['type'] = ['w966']
    return urlunsplit(('https', u.netloc, u.path, urlencode(query, doseq=True), ''))


def normalize(text):
    return re.sub(r'[ \t]+', ' ', re.sub('[\u200b\ufeff]', '', text or '')).strip()


def parse_blog(html, input_url):
    url = blog_url(input_url)
    soup = BeautifulSoup(html, 'html.parser')
    root = soup.select_one('.se-main-container') or soup.select_one('#postViewArea')
    if root is None:
        raise ValueError('공개 본문을 찾지 못했어요. 비공개·삭제·로그인 제한 글은 수집할 수 없어요. 본문 붙여넣기와 사진 업로드를 이용해 주세요.')
    for tag in root.select('script,style,iframe,noscript,.se-module-oglink,.se-module-map,.se-sticker'):
        tag.decompose()
    title_node = soup.select_one('.se-title-text') or soup.select_one('.htitle')
    meta = soup.select_one('meta[property="og:title"]')
    title = normalize(title_node.get_text() if title_node else meta.get('content', '') if meta else '')[:200]
    for tag in root.select('br'):
        tag.replace_with('\n')
    for tag in root.select('p,div,li,tr,h1,h2,h3,blockquote'):
        tag.append('\n')
    text = '\n'.join(filter(None, (normalize(line) for line in root.get_text().split('\n'))))
    if not title or len(text) < 10:
        raise ValueError('글 제목이나 본문이 부족해요. 이미지 속 글자는 자동으로 읽지 않아요. 필요한 본문을 직접 입력해 주세요.')
    nick = soup.select_one('.nick_area .nick, .blog_author .nick, .nick')
    author = normalize(nick.get_text() if nick else '') or urlsplit(url).path.split('/')[1]
    photos, seen, skipped = [], set(), 0
    for img in root.select('img'):
        raw = img.get('data-lazy-src') or img.get('data-src') or img.get('src')
        if not raw or raw.startswith('data:'):
            continue
        try:
            image = image_url(urljoin(url, raw))
        except ValueError:
            skipped += 1
            continue
        if image in seen:
            continue
        seen.add(image)
        if len(photos) >= 8:
            skipped += 1
            continue
        component = img.find_parent(class_='se-component')
        captions = component.select('.se-caption') if component else []
        caption = normalize(''.join(c.get_text() for c in captions) or img.get('alt', ''))
        photos.append(dict(id=str(len(photos)+1), title=f'본문 이미지 {len(photos)+1}', description=caption or '설명 없는 본문 이미지 (시각 내용 미분석)', artist=author, license='원저작자 이용 조건 확인', licenseUrl=url, pageUrl=url, shortUrl=url, imageUrl=image, kind='blog'))
    warnings = []
    if len(text) > 12000:
        warnings.append('본문은 앞 12,000자까지 가져왔어요. 필요한 부분으로 편집해 주세요.')
    if skipped:
        warnings.append(f'지원하지 않거나 8장 한도를 넘은 이미지 {skipped}장을 제외했어요.')
    if not photos:
        warnings.append('수집 가능한 이미지가 없어요. 내 사진을 업로드하거나 텍스트 카드로 만들 수 있어요.')
    return dict(title=title, text=text[:12000], url=url, source=author, license='원저작자 이용 조건 확인', photos=photos, warnings=warnings)


async def safe_bytes(client, url, kind, limit):
    for _ in range(4):
        headers = {'User-Agent': 'Mozilla/5.0 (compatible; BlogToShorts/1.0)'}
        if kind == 'image':
            headers['Referer'] = 'https://blog.naver.com/'
        async with client.stream('GET', url, headers=headers, follow_redirects=False, timeout=15) as response:
            if response.status_code in (301, 302, 303, 307, 308):
                target = urljoin(url, response.headers.get('location', ''))
                if kind == 'image':
                    url = image_url(target)
                else:
                    blog_url(target)
                    url = target
                continue
            if not response.is_success:
                raise ValueError(f'네이버 요청 실패 ({response.status_code}).')
            if int(response.headers.get('content-length', '0')) > limit:
                raise ValueError('수집 파일 크기 제한을 넘었어요.')
            data = bytearray()
            async for chunk in response.aiter_bytes():
                data.extend(chunk)
                if len(data) > limit:
                    raise ValueError('수집 파일 크기 제한을 넘었어요.')
            return bytes(data), response.headers.get('content-type', '').split(';')[0].strip().lower()
    raise ValueError('리디렉션이 너무 많아요. 글 주소를 확인해 주세요.')


async def get_blog(input_url, client):
    canonical = blog_url(input_url)
    raw, _ = await safe_bytes(client, canonical.replace('://blog.', '://m.blog.'), 'html', 4_000_000)
    article = parse_blog(raw.decode('utf-8', errors='replace'), canonical)
    photos = []
    for photo in article['photos']:
        try:
            image, mime = await safe_bytes(client, photo['imageUrl'], 'image', 8_000_000)
            if mime not in ('image/jpeg', 'image/png', 'image/webp', 'image/gif'):
                raise ValueError('지원하지 않는 이미지 형식이에요.')
            photos.append({**photo, 'dataUrl': f'data:{mime};base64,{base64.b64encode(image).decode()}'})
        except (ValueError, httpx.HTTPError):
            article['warnings'].append(f"본문 이미지 {photo['id']} 다운로드에 실패했어요. 필요하면 직접 업로드해 주세요.")
    return {**article, 'photos': photos}
