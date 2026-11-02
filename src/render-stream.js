// A single POST streams progress and its final result; it never retries paid TTS.
/**
 * @param {Response} response
 * @param {(event: {percent:number,label:string}) => void} onProgress
 * @returns {Promise<{videoUrl:string,duration:number,subtitles:string,filename:string,requestedSpeed?:number|null,narrationSpeed?:number|null}>}
 */
export async function readRenderStream(response,onProgress){
 if(!response.ok){const data=await response.json();throw Error(data.error||'영상 생성 요청에 실패했어요.');}
 if(!response.body)throw Error('영상 진행 상황을 연결하지 못했어요.');
 const reader=response.body.getReader(),decoder=new TextDecoder();let pending='',result;
 function consume(line){
  if(!line.trim())return;
  const event=JSON.parse(line);
  if(event.type==='error')throw Error(event.error);
  if(event.type==='progress')onProgress(event);
  if(event.type==='complete')result=event.result;
 }
 try{
  while(true){const {value,done}=await reader.read();pending+=decoder.decode(value,{stream:!done});const lines=pending.split('\n');pending=lines.pop();for(const line of lines)consume(line);if(done)break;}
  consume(pending);
  if(!result)throw Error('진행 상황 연결이 끊겼어요. 서버 작업이 계속될 수 있으니 잠시 후 확인해 주세요.');
  return result;
 }finally{await reader.cancel().catch(()=>{});reader.releaseLock();}
}
