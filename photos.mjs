const plain=s=>String(s||'').replace(/<[^>]*>/g,'').replace(/&[^;]+;/g,' ').trim();
export async function findPhotos(query){
 const queries=/강남|gangnam/i.test(query)?['Gangnam from Yeoksam','Bongeunsa Seoul']: [query];
 const selected=[];
 for(const q of queries){
  const url=new URL('https://commons.wikimedia.org/w/api.php');url.search=new URLSearchParams({action:'query',generator:'search',gsrsearch:q,gsrnamespace:'6',gsrlimit:'12',prop:'imageinfo',iiprop:'url|extmetadata',iiurlwidth:'1000',format:'json'});
  const response=await fetch(url,{signal:AbortSignal.timeout(15000)});if(!response.ok)throw Error('사진 검색 서버 오류');const data=await response.json();
  const pages=Object.values(data.query?.pages||{}).sort((a,b)=>a.index-b.index);
  let count=0;
  for(const page of pages){const image=page.imageinfo?.[0],m=image?.extmetadata,license=m?.LicenseShortName?.value||'';
   if(!/^(CC0|CC BY 4\.0|CC BY-SA 4\.0|Public domain)$/.test(license)||!image?.thumburl||! /\.(jpg|jpeg|png)$/i.test(page.title)||selected.some(p=>p.title===page.title))continue;
   const asset=new URL(image.thumburl);if(!['upload.wikimedia.org','thumb.wikimedia.org'].includes(asset.hostname))continue;
   const file=await fetch(asset,{signal:AbortSignal.timeout(20000)});if(!file.ok)continue;const mime=file.headers.get('content-type')||'';if(!/^image\/(jpeg|png)/.test(mime))continue;
   const bytes=Buffer.from(await file.arrayBuffer());if(bytes.length>8e6)continue;
   selected.push({title:page.title,artist:plain(m.Artist?.value),license,licenseUrl:m.LicenseUrl?.value||'https://creativecommons.org/publicdomain/zero/1.0/',pageUrl:image.descriptionurl,shortUrl:`https://commons.wikimedia.org/?curid=${page.pageid}`,date:plain(m.DateTimeOriginal?.value),description:plain(m.ImageDescription?.value),dataUrl:`data:${mime.split(';')[0]};base64,${bytes.toString('base64')}`});
   count++;if(count>= (queries.length===1?4:2))break;
  }
 }
 if(!selected.length)throw Error('사용 가능한 사진을 찾지 못했습니다. 장소 이름을 영어로 입력하거나 직접 업로드하세요.');
 return {photos:selected.slice(0,4),notice:'과거 촬영된 지역 자료사진입니다. 행사 당일 사진이 아닙니다. CC BY-SA 사진을 포함한 이 영상은 CC BY-SA 4.0으로 공유하세요.'};
}
