// TourAPI credentials remain on the server. Images need separate KOGL checks.
export async function searchFestivals(start,end){
 if(!process.env.TOUR_API_KEY)throw Error('TourAPI 키가 아직 없습니다. .env에 TOUR_API_KEY를 설정하고 서버를 재시작하세요.');
 if(!/^\d{8}$/.test(start)||!/^\d{8}$/.test(end)||start>end)throw Error('축제 조회 날짜를 확인하세요.');
 const url=new URL('https://apis.data.go.kr/B551011/KorService2/searchFestival2');
 url.search=new URLSearchParams({serviceKey:decodeURIComponent(process.env.TOUR_API_KEY),MobileOS:'ETC',MobileApp:'LocalShorts',_type:'json',numOfRows:'30',pageNo:'1',eventStartDate:start,eventEndDate:end,arrange:'A'});
 const response=await fetch(url,{signal:AbortSignal.timeout(20000)});
 if(!response.ok)throw Error(`축제 API 오류 (${response.status})`);
 let data;try{data=await response.json();}catch{throw Error('축제 API 응답을 확인하세요. 키 승인 여부를 확인해 주세요.');}
 if(data.response?.header?.resultCode!=='0000')throw Error('TourAPI 인증 또는 요청 오류입니다. 서비스 활용 승인을 확인하세요.');
 const items=data.response.body.items?.item||[];
 return {items:(Array.isArray(items)?items:[items]).map(x=>({title:x.title,start:x.eventstartdate,end:x.eventenddate,address:x.addr1,contentId:x.contentid})),source:'한국관광공사 TourAPI',notice:'일정 탐색용입니다. 대표 이미지를 해당 연도 행사 사진으로 자동 사용하지 않습니다.'};
}
