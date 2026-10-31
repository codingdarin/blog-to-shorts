import {filterPromotionNews} from './news-filter.mjs';
// TourAPI credentials remain on the server. Images need separate KOGL checks.
import {XMLParser} from 'fast-xml-parser';
import {getArticle,searchArticles,searchGyeonggiArticles} from './articles.mjs';
export async function tourRequest(operation,params){
 if(!process.env.TOUR_API_KEY)throw Error('TourAPI 키가 아직 없습니다. .env에 TOUR_API_KEY를 설정하고 서버를 재시작하세요.');
 const url=new URL('https://apis.data.go.kr/B551011/KorService2/'+operation);
 url.search=new URLSearchParams({serviceKey:decodeURIComponent(process.env.TOUR_API_KEY),MobileOS:'ETC',MobileApp:'LocalShorts',_type:'json',numOfRows:'30',pageNo:'1',...params});
 const response=await fetch(url,{signal:AbortSignal.timeout(20000)});
 if(!response.ok)throw Error(`축제 API 오류 (${response.status})`);
 let data;try{data=await response.json();}catch{throw Error('축제 API 응답을 확인하세요. 키 승인 여부를 확인해 주세요.');}
 if(data.response?.header?.resultCode!=='0000')throw Error('TourAPI 인증 또는 요청 오류입니다. 서비스 활용 승인을 확인하세요.');
 const items=data.response.body.items?.item||[];
 return Array.isArray(items)?items:[items];
}
export async function searchFestivals(start,end){
 if(!process.env.TOUR_API_KEY)throw Error('TourAPI 키가 아직 없습니다. .env에 TOUR_API_KEY를 설정하고 서버를 재시작하세요.');
 if(!/^\d{8}$/.test(start)||!/^\d{8}$/.test(end)||start>end)throw Error('축제 조회 날짜를 확인하세요.');
 const items=await tourRequest('searchFestival2',{eventStartDate:start,eventEndDate:end,arrange:'A'});
 return {items:(Array.isArray(items)?items:[items]).map(x=>({title:x.title,start:x.eventstartdate,end:x.eventenddate,address:x.addr1,contentId:x.contentid})),source:'한국관광공사 TourAPI',notice:'축제를 선택하면 관련 기사와 사용 가능한 행사 사진을 찾아 자동 구성합니다.'};
}
const normalized=s=>String(s).replace(/[^가-힣a-zA-Z0-9]/g,'').toLowerCase();
export function matchesFestival(item,festival){
 return normalized(item.title).includes(normalized(festival.title))&&String(item.date).slice(0,4)===festival.start.slice(0,4);
}
async function relatedNews(festival){
 const query=`"${festival.title}" ${festival.start.slice(0,4)}`;
 const r=await fetch('https://news.google.com/rss/search?'+new URLSearchParams({q:query,hl:'ko',gl:'KR',ceid:'KR:ko'}),{signal:AbortSignal.timeout(15000)});
 if(!r.ok)throw Error('관련 뉴스 검색에 실패했습니다.');
 const data=new XMLParser({ignoreAttributes:false}).parse(await r.text());
 const entries=data.rss?.channel?.item||[];
 const found=(Array.isArray(entries)?entries:[entries]).map(x=>({title:String(x.title||'').replace(/<[^>]*>/g,''),url:x.link,source:x.source?.['#text']||'뉴스',date:new Date(x.pubDate).toISOString().slice(0,10)})).filter(x=>matchesFestival(x,festival)&&/^https:\/\/news\.google\.com\//.test(x.url)).slice(0,16);
 return (await filterPromotionNews(found,festival.title+' '+festival.address)).items.slice(0,8);
}
export async function festivalResources(contentId){
 if(!/^\d{1,12}$/.test(String(contentId)))throw Error('축제 ID를 확인하세요.');
 const [common,intro]=await Promise.all([tourRequest('detailCommon2',{contentId}),tourRequest('detailIntro2',{contentId,contentTypeId:'15'})]);
 if(common[0]?.contenttypeid!=='15'||!intro[0]?.eventstartdate)throw Error('축제 상세 정보를 찾지 못했습니다.');
 const festival={contentId,title:common[0].title,start:intro[0].eventstartdate,end:intro[0].eventenddate,address:common[0].addr1};
 const results=await Promise.allSettled([searchGyeonggiArticles(festival.title),festival.address?.includes('용인')?searchArticles(festival.title):Promise.resolve({items:[]}),relatedNews(festival)]);
 const warnings=results.flatMap((r,i)=>r.status==='rejected'?[`${['경기도 기사','용인 기사','관련 뉴스'][i]} 검색 실패: ${r.reason.message}`]:[]);
 const matched=results.slice(0,2).flatMap(r=>r.status==='fulfilled'?r.value.items:[]).filter(x=>matchesFestival(x,festival)).sort((a,b)=>b.date.localeCompare(a.date)).slice(0,5);
 const candidates=(await filterPromotionNews(matched,festival.title+' '+festival.address)).items;
 const checked=await Promise.allSettled(candidates.map(async item=>{const article=await getArticle(item.url);return {...item,photoCount:article.photos.length,license:article.license};}));
 const articles=checked.flatMap(r=>r.status==='fulfilled'?[r.value]:[]);
 const excluded=checked.flatMap((r,i)=>r.status==='rejected'?[{title:candidates[i].title,reason:r.reason.message}]:[]);
 return {festival,articles,related:results[2].status==='fulfilled'?results[2].value:[],excluded,warnings,notice:articles.length?'이용 조건을 확인한 행사 기사를 자동 구성합니다. 사진과 대본을 확인한 뒤 MP4를 내려받으세요.':'현재 지원 출처에서 같은 연도의 편집 가능한 행사 사진을 찾지 못했습니다. 관련 기사를 확인하거나 사용 가능한 사진을 직접 올려 주세요.'};
}
