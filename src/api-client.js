let apiBase='',accessToken='';

export function configureApi(base='',token=''){
 if(base){
  const url=new URL(base);
  if(url.username||url.password||url.search||url.hash||url.pathname!=='/'||!(url.protocol==='https:'||(url.protocol==='http:'&&['localhost','127.0.0.1'].includes(url.hostname))))throw Error('서버 주소를 확인해 주세요.');
  base=url.origin;
 }
 apiBase=base;accessToken=token;
}

export function apiFetch(path,options={}){
 if(!path.startsWith('/api/'))throw Error('지원하지 않는 API 경로예요.');
 const headers=new Headers(options.headers);
 if(accessToken)headers.set('Authorization',`Bearer ${accessToken}`);
 return fetch(apiBase+path,{...options,headers,credentials:'omit',redirect:'error'});
}

export async function mediaUrl(path){
 const response=await apiFetch(path);
 if(!response.ok)throw Error('미디어를 가져오지 못했어요. 서버 연결을 확인해 주세요.');
 return URL.createObjectURL(await response.blob());
}
