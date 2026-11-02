import {load} from 'cheerio';

const BLOG_HOSTS = new Set(['blog.naver.com', 'm.blog.naver.com']);
const IMAGE_HOSTS = new Set(['blogfiles.pstatic.net', 'mblogthumb-phinf.pstatic.net', 'postfiles.pstatic.net', 'blogthumb.pstatic.net']);
const normalize = text => String(text || '').replace(/[\u200b\ufeff]/g, '').replace(/[ \t]+/g, ' ').trim();

export function blogUrl(value) {
  let url;
  try { url = new URL(value); } catch { throw Error('네이버 블로그 글 URL을 입력해 주세요.'); }
  if (!['http:', 'https:'].includes(url.protocol) || !BLOG_HOSTS.has(url.hostname) || url.username || url.password || url.port) throw Error('네이버 블로그 글 URL만 지원해요.');
  const path = url.pathname.match(/^\/([\w-]+)\/(\d+)\/?$/);
  const blogId = path?.[1] || (/^\/(?:PostView|PostView.naver)\/?$/i.test(url.pathname) ? url.searchParams.get('blogId') : '');
  const logNo = path?.[2] || url.searchParams.get('logNo');
  if (!/^[\w-]{2,64}$/.test(blogId || '') || !/^\d{1,20}$/.test(logNo || '')) throw Error('블로그 홈 주소 대신 개별 글 주소를 입력해 주세요.');
  return `https://blog.naver.com/${blogId}/${logNo}`;
}

export function imageUrl(value) {
  let url;
  try { url = new URL(value); } catch { throw Error('이미지 URL 형식이 올바르지 않아요.'); }
  if (!['http:', 'https:'].includes(url.protocol) || !IMAGE_HOSTS.has(url.hostname) || url.username || url.password || url.port) throw Error('지원하지 않는 블로그 이미지 주소예요.');
  url.protocol = 'https:';
  url.hash = '';
  // Request a bounded display image; keep all unrelated query parameters.
  url.searchParams.set('type', 'w966');
  return url.href;
}

export function parseBlog(html, inputUrl) {
  const url = blogUrl(inputUrl), $ = load(html);
  const root = $('.se-main-container').first().length ? $('.se-main-container').first() : $('#postViewArea').first();
  if (!root.length) throw Error('공개 본문을 찾지 못했어요. 비공개·삭제·로그인 제한 글은 수집할 수 없어요. 본문 붙여넣기와 사진 업로드를 이용해 주세요.');
  root.find('script,style,iframe,noscript,.se-module-oglink,.se-module-map,.se-sticker').remove();
  const title = normalize($('.se-title-text').first().text() || $('.htitle').first().text() || $('meta[property="og:title"]').attr('content')).slice(0,200);
  root.find('br').replaceWith('\n');
  root.find('p,div,li,tr,h1,h2,h3,blockquote').append('\n');
  const text = root.text().split('\n').map(normalize).filter(Boolean).join('\n');
  if (!title || text.length < 10) throw Error('글 제목이나 본문이 부족해요. 이미지 속 글자는 자동으로 읽지 않아요. 필요한 본문을 직접 입력해 주세요.');
  const author = normalize($('.nick_area .nick, .blog_author .nick, .nick').first().text()) || new URL(url).pathname.split('/')[1];
  const photos = [], seen = new Set();
  let skipped = 0;
  root.find('img').each((_, element) => {
    const img = $(element);
    const raw = img.attr('data-lazy-src') || img.attr('data-src') || img.attr('src');
    if (!raw || raw.startsWith('data:')) return;
    let image;
    try { image = imageUrl(new URL(raw, url).href); } catch { skipped++; return; }
    if (seen.has(image)) return;
    seen.add(image);
    if (photos.length >= 8) { skipped++; return; }
    const caption = normalize(img.closest('.se-component').find('.se-caption').text() || img.attr('alt'));
    photos.push({id:String(photos.length+1), title:`본문 이미지 ${photos.length+1}`, description:caption || '설명 없는 본문 이미지 (시각 내용 미분석)', artist:author, license:'원저작자 이용 조건 확인', licenseUrl:url, pageUrl:url, shortUrl:url, imageUrl:image, kind:'blog'});
  });
  return {title, text:text.slice(0,12000), url, source:author, license:'원저작자 이용 조건 확인', photos, warnings:[...(text.length>12000?['본문은 앞 12,000자까지 가져왔어요. 필요한 부분으로 편집해 주세요.']:[]),...(skipped?[`지원하지 않거나 8장 한도를 넘은 이미지 ${skipped}장을 제외했어요.`]:[]),...(!photos.length?['수집 가능한 이미지가 없어요. 내 사진을 업로드하거나 텍스트 카드로 만들 수 있어요.']:[])]};
}

async function limitedBytes(response, limit) {
  if (Number(response.headers.get('content-length')) > limit) { await response.body?.cancel(); throw Error('수집 파일 크기 제한을 넘었어요.'); }
  const chunks = []; let size = 0;
  for await (const chunk of response.body) { size += chunk.length; if (size > limit) throw Error('수집 파일 크기 제한을 넘었어요.'); chunks.push(chunk); }
  return Buffer.concat(chunks);
}

async function safeFetch(url, kind, fetcher) {
  for (let redirects=0; redirects<=3; redirects++) {
    const response = await fetcher(url, {redirect:'manual', headers:{'User-Agent':'Mozilla/5.0 (compatible; BlogToShorts/1.0)', ...(kind==='image'?{Referer:'https://blog.naver.com/'}:{})}, signal:AbortSignal.timeout(15000)});
    if ([301,302,303,307,308].includes(response.status)) {
      const target = new URL(response.headers.get('location') || '', url);
      await response.body?.cancel();
      if (kind==='image') url = imageUrl(target.href);
      else { blogUrl(target.href); url = target.href; }
      continue;
    }
    if (!response.ok) throw Error(`네이버 ${kind==='image'?'이미지':'본문'} 요청 실패 (${response.status}).`);
    return response;
  }
  throw Error('리디렉션이 너무 많아요. 글 주소를 확인해 주세요.');
}

export async function getBlog(inputUrl, fetcher=fetch) {
  const canonical = blogUrl(inputUrl);
  const mobile = canonical.replace('://blog.', '://m.blog.');
  const response = await safeFetch(mobile, 'html', fetcher);
  const article = parseBlog((await limitedBytes(response, 4e6)).toString('utf8'), canonical);
  const photos = [];
  for (const photo of article.photos) {
    try {
      const image = await safeFetch(photo.imageUrl, 'image', fetcher);
      const type = image.headers.get('content-type')?.split(';')[0].trim().toLowerCase();
      if (!['image/jpeg','image/png','image/webp','image/gif'].includes(type)) { await image.body?.cancel(); throw Error('지원하지 않는 이미지 형식이에요.'); }
      const bytes = await limitedBytes(image, 8e6);
      photos.push({...photo, dataUrl:`data:${type};base64,${bytes.toString('base64')}`});
    } catch { article.warnings.push(`본문 이미지 ${photo.id} 다운로드에 실패했어요. 필요하면 직접 업로드해 주세요.`); }
  }
  return {...article, photos};
}
