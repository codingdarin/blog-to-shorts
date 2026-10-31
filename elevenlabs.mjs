const base='https://api.elevenlabs.io';
export async function elevenRequest(endpoint,options={}){
 if(!process.env.ELEVENLABS_API_KEY)throw Error('ElevenLabs API 키를 설정한 뒤 서버를 재시작해 주세요.');
 const r=await fetch(base+endpoint,{...options,headers:{'xi-api-key':process.env.ELEVENLABS_API_KEY,...options.headers},signal:AbortSignal.timeout(45000)});
 if(!r.ok)throw Error(`ElevenLabs 요청 실패 (${r.status}). 키 권한과 잔여 크레딧을 확인해 주세요. 자동 재시도하거나 다른 음성으로 대체하지 않습니다.`);
 return r;
}
export function availableCredits(subscription){
 const {character_limit:limit,character_count:used}=subscription;
 if(!Number.isFinite(limit)||!Number.isFinite(used))throw Error('ElevenLabs 잔여 크레딧을 확인하지 못했습니다.');
 return Math.max(0,limit-used);
}
export async function elevenOptions(request=elevenRequest){
 if(!process.env.ELEVENLABS_API_KEY)return {ready:false,voices:[],notice:'ElevenLabs 연결 전입니다. 기본 무료 음성을 사용할 수 있어요.'};
 const [sub,data]=await Promise.all([request('/v1/user/subscription').then(r=>r.json()),request('/v2/voices?page_size=100').then(r=>r.json())]);
 const voices=(data.voices||[]).filter(v=>['premade','default','generated'].includes(v.category)).filter(v=>!v.available_for_tiers?.length||v.available_for_tiers.includes(sub.tier)).map(v=>({id:v.voice_id,name:v.name,language:v.labels?.language||'다국어'}));
 voices.sort((a,b)=>Number(/ko|korean/i.test(b.language))-Number(/ko|korean/i.test(a.language)));
 return {ready:voices.length>0,voices,remaining:availableCredits(sub),tier:sub.tier,notice:voices.length?'한국어 지원 다국어 모델을 사용해요. 생성 시 계정 크레딧이 차감돼요.':'사용 가능한 기본 음성을 찾지 못했습니다. 기본 무료 음성을 선택해 주세요.'};
}
let generating=false;
export async function generateElevenScenes(texts,voiceId,saveAudio,optionsLoader=elevenOptions,request=elevenRequest){
 if(generating)throw Error('ElevenLabs 음성을 생성 중입니다. 완료 후 다시 시도해 주세요.');
 if(!Array.isArray(texts)||texts.length!==4||texts.some(t=>typeof t!=='string'||!t.trim()||t.length>100))throw Error('음성 대본 4개를 확인하세요.');
 generating=true;
 try{
  const account=await optionsLoader();
  if(!account.ready||!account.voices.some(v=>v.id===voiceId))throw Error('사용 가능한 ElevenLabs 음성을 선택해 주세요.');
  const required=texts.reduce((sum,t)=>sum+t.length,0);
  if(account.remaining<required)throw Error('ElevenLabs 잔여 크레딧이 부족합니다. 추가 결제 없이 기본 무료 음성을 사용해 주세요.');
  for(let i=0;i<texts.length;i++){
   const r=await request('/v1/text-to-speech/'+encodeURIComponent(voiceId)+'?output_format=mp3_44100_128',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({text:texts[i],model_id:'eleven_multilingual_v2',voice_settings:{stability:.5,similarity_boost:.75,style:0,use_speaker_boost:true}})});
   if(!r.headers.get('content-type')?.startsWith('audio/'))throw Error('ElevenLabs가 음성 파일을 반환하지 않았습니다.');
   const bytes=Buffer.from(await r.arrayBuffer());if(!bytes.length)throw Error('ElevenLabs 음성 파일이 비어 있습니다.');
   await saveAudio(i,bytes);
  }
 }finally{generating=false;}
}
