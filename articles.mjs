import {load} from 'cheerio';

const origin='https://www.yongin.go.kr';
const ggOrigin='https://gnews.gg.go.kr';
const plain=s=>s.replace(/\s+/g,' ').trim();
export function articleUrl(value){
 const url=new URL(value);
 if(url.origin===ggOrigin&&url.pathname==='/news/news_detail.do'&&/^\d{18}C\d{3}$/.test(url.searchParams.get('number')||''))return url;
 if(url.origin!==origin||url.pathname!=='/user/bbs/BD_selectBbs.do'||url.searchParams.get('q_bbsCode')!=='1020'||!/^\d+$/.test(url.searchParams.get('q_bbscttSn')||''))throw Error('행사 사진 자동 수집은 용인시 보도자료와 경기도뉴스포털 기사를 지원합니다.');
 return url;
}
async function get(url){
 if(![origin,ggOrigin].includes(new URL(url).origin))throw Error('허용되지 않은 사진 출처입니다.');
 const r=await fetch(url,{redirect:'error',signal:AbortSignal.timeout(20000)});
 if(!r.ok)throw Error('공식 기사 자료를 가져오지 못했습니다.');
 return r;
}
export async function searchArticles(query){
 const url=new URL('/user/bbs/BD_selectBbsList.do',origin);
 url.search=new URLSearchParams({q_bbsCode:'1020',q_searchKeyTy:'sj___1002',q_searchVal:query.replace(/^용인(?:시|특례시)?\s*/, '')||'축제'});
 const $=load(await(await get(url)).text()),items=[],seen=new Set();
 $('a[href*="BD_selectBbs.do"]').each((_,e)=>{
  const title=plain($(e).text());if(title.length<6)return;
  const link=new URL($(e).attr('href'),url).href;
  if(seen.has(link))return;seen.add(link);
  const id=new URL(link).searchParams.get('q_bbscttSn');
  items.push({title,url:link,source:'용인특례시',date:`${id.slice(0,4)}-${id.slice(4,6)}-${id.slice(6,8)}`,text:title});
 });
 return {items:items.slice(0,12),notice:'용인시 공식 보도자료. 선택 후 게시물별 이용 조건과 첨부 사진을 검사합니다.'};
}
export function parseArticle(html,url){
 articleUrl(url);
 if(new URL(url).origin===ggOrigin)return parseGyeonggiArticle(html,url);
 const $=load(html),article=$('#contentsTable');
 const licenses=article.find('img[alt*="유형"]').map((_,e)=>$(e).attr('alt').replace(/\s/g,'')).get();
 if(!licenses.includes('제1유형')||licenses.some(x=>/제[234]유형/.test(x)))throw Error('이 게시물은 공공누리 제1유형이 확인되지 않아 자동 사용하지 않습니다.');
 const body=article.find('.tview_desc').clone();body.find('script,style,.image').remove();
 const text=plain(body.text()).split('본 저작물은')[0].slice(0,10000);
 if(/사진.{0,30}(별도|제외|금지)|사진.{0,20}저작권.{0,20}(별도|제외)/.test(text))throw Error('사진의 별도 이용 제한이 있어 자동 사용하지 않습니다.');
 const title=plain(article.find('td.title').text()),photos=[];
 article.find('a[href*="ND_fileDownload.do"]').each((_,e)=>{
  const caption=plain($(e).text());if(!/\.(jpe?g|png)$/i.test(caption))return;
  // Posters and generic city views are not represented as event photographs.
  if(/포스터|리플릿|조감도|자료사진|홍보물|청사/.test(caption))return;
  const imageUrl=new URL($(e).attr('href'),origin).href;
  if(new URL(imageUrl).origin!==origin)return;
  photos.push({id:String(photos.length),title:caption,description:caption.replace(/\.(jpe?g|png)$/i,''),imageUrl,artist:'용인특례시',license:'공공누리 제1유형',licenseUrl:'https://www.kogl.or.kr/info/license.do',pageUrl:url,shortUrl:'https://www.yongin.go.kr',kind:'event'});
 });
 if(!title||text.length<30)throw Error('기사 본문을 확인하지 못했습니다.');
 if(!photos.length)throw Error('이용 가능한 실제 행사 첨부 사진을 찾지 못했습니다. 다른 기사를 선택해 주세요.');
 return {title,text,url,year:new URL(url).searchParams.get('q_bbscttSn').slice(0,4),source:'용인특례시',photos:photos.slice(0,8),license:'공공누리 제1유형'};
}
export async function searchGyeonggiArticles(query){
 const url=new URL('/search/search.do',ggOrigin);url.searchParams.set('kwd',query);
 const $=load(await(await get(url)).text()),items=[],seen=new Set();
 $('a[href*="/news/news_detail.do"]').each((_,e)=>{
  const title=plain($(e).find('.big_tit').text());if(!title)return;
  const link=new URL($(e).attr('href'),ggOrigin).href;
  try{articleUrl(link);}catch{return;}
  if(seen.has(link))return;seen.add(link);
  items.push({title,url:link,source:'경기도뉴스포털',date:plain($(e).find('.date span').last().text()),text:plain($(e).find('.txt p').text())});
 });
 return {items};
}
export function parseGyeonggiArticle(html,url){
 articleUrl(url);
 const $=load(html),cc=$('.cc');
 if(!cc.find('a[href$="/licenseType1.do"]').length||/제[234]유형/.test(cc.text()))throw Error('이 게시물은 공공누리 제1유형이 확인되지 않아 자동 사용하지 않습니다.');
 const body=$('#contents .postbody'),title=plain($('#contents > h3').text());
 const copy=body.clone();copy.find('script,style').remove();const text=plain(copy.text()).slice(0,10000);
 if(/사진.{0,30}(별도|제외|금지)|텍스트에\s*한하여/.test(text+cc.text()))throw Error('사진의 별도 이용 제한이 있어 자동 사용하지 않습니다.');
 const photos=[],seen=new Set();
 body.find('img').each((_,e)=>{
  const caption=plain($(e).attr('alt')||'');
  if(caption.length<8||/포스터|리플릿|조감도|자료사진|홍보물/.test(caption))return;
  let image;try{image=new URL($(e).attr('src'),ggOrigin);}catch{return;}
  if(image.hostname!=='gnews.gg.go.kr'||!image.pathname.startsWith('/OP_UPDATA/'))return;
  image.protocol='https:';if(seen.has(image.href))return;seen.add(image.href);
  const artist=caption.split('ⓒ')[1]?.trim()||'경기도뉴스포털';
  photos.push({id:String(photos.length),title:caption,description:caption.split('ⓒ')[0].trim(),imageUrl:image.href,artist,license:'공공누리 제1유형',licenseUrl:'https://www.kogl.or.kr/info/licenseType1.do',pageUrl:url,shortUrl:ggOrigin,kind:'event'});
 });
 if(!title||text.length<30)throw Error('기사 본문을 확인하지 못했습니다.');
 if(!photos.length)throw Error('이용 가능한 실제 행사 첨부 사진을 찾지 못했습니다.');
 return {title,text,url,year:new URL(url).searchParams.get('number').slice(0,4),source:'경기도뉴스포털',photos:photos.slice(0,8),license:'공공누리 제1유형'};
}
export async function getArticle(url){return parseArticle(await(await get(articleUrl(url))).text(),url);}
export async function downloadPhoto(photo){
 const response=await get(photo.imageUrl),bytes=Buffer.from(await response.arrayBuffer());
 const mime=bytes[0]===0xff&&bytes[1]===0xd8?'image/jpeg':bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))?'image/png':null;
 if(!mime||bytes.length>8e6)throw Error('사진 형식 또는 크기를 확인해 주세요.');
 return {...photo,dataUrl:`data:${mime};base64,${bytes.toString('base64')}`};
}
