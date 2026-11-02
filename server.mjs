import http from 'node:http';
import {randomUUID} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {getBlog} from './blog.mjs';
import {planBlog,validatePlanInput,narrationStyleIssues} from './ai.mjs';
import {elevenOptions} from './elevenlabs.mjs';
import {renderVideo} from './render.mjs';
import {narrationSpeed} from './timing.mjs';
import {videoFilename,videoDisposition} from './download-name.mjs';
import {musicCatalog,defaultMusicId} from './music.mjs';
try { process.loadEnvFile(); } catch {}
const port=Number(process.env.PORT||4311),host=process.env.HOST||'127.0.0.1';
const allowedOrigins=new Set([`http://localhost:${port}`,`http://127.0.0.1:${port}`,process.env.PUBLIC_ORIGIN].filter(Boolean));
const downloads=new Map();
let renderBusy=false,analysisBusy=false,crawlBusy=false;
const json=(res,status,data)=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8'});res.end(JSON.stringify(data));};
async function body(req){let chunks=[],size=0;for await(const chunk of req){size+=chunk.length;if(size>24e6)throw Error('요청이 너무 큽니다.');chunks.push(chunk);}return JSON.parse(Buffer.concat(chunks).toString());}
http.createServer(async(req,res)=>{try{
 const url=new URL(req.url,'http://localhost');
 if(req.method==='POST'&&req.headers.origin&&!allowedOrigins.has(req.headers.origin))return json(res,403,{error:'허용되지 않은 요청'});
 if(req.method==='GET'&&url.pathname==='/health')return json(res,200,{ok:true});
 if(req.method==='GET'&&url.pathname==='/api/status')return json(res,200,{localTtsReady:process.platform==='win32',aiReady:!!(process.env.NVIDIA_API_KEY||process.env.GEMINI_API_KEY)&&process.env.AI_FREE_TIER_CONFIRMED==='true'});
 if(req.method==='GET'&&url.pathname==='/api/voices')return json(res,200,await elevenOptions());
 if(req.method==='POST'&&url.pathname==='/api/blog'){
  const input=await body(req);if(crawlBusy)return json(res,409,{error:'다른 글을 수집 중이에요. 잠시 후 다시 시도해 주세요.'});crawlBusy=true;
  try{return json(res,200,await getBlog(input.url));}finally{crawlBusy=false;}
 }
 if(req.method==='POST'&&url.pathname==='/api/script'){
  const input=await body(req);try{validatePlanInput(input);}catch(error){return json(res,400,{error:error.message});}
  if(!(process.env.NVIDIA_API_KEY||process.env.GEMINI_API_KEY)||process.env.AI_FREE_TIER_CONFIRMED!=='true')return json(res,409,{error:'서버 .env에 무료 사용이 확인된 AI 키를 설정해 주세요. 본문·이미지 수집과 수동 편집은 사용할 수 있어요.'});
  if(analysisBusy)return json(res,409,{error:'대본 생성 중이에요. 잠시 후 다시 시도해 주세요.'});analysisBusy=true;
  try{return json(res,200,{...await planBlog(input),mode:'ai'});}finally{analysisBusy=false;}
 }
 if(req.method==='GET'&&url.pathname==='/api/music')return json(res,200,{tracks:musicCatalog.map(({file,preview,...rest})=>rest),defaultId:defaultMusicId});
 if(req.method==='GET'&&url.pathname.startsWith('/api/music/')){const track=musicCatalog.find(t=>t.id===url.pathname.split('/').pop());if(track?.preview){const bytes=await readFile(track.preview);res.writeHead(200,{'Content-Type':'audio/mpeg','Content-Length':bytes.length});res.end(bytes);return;}}
 if(req.method==='GET'&&url.pathname.startsWith('/api/video/')){const video=downloads.get(url.pathname.slice('/api/video/'.length));if(!video)return json(res,404,{error:'다운로드 시간이 만료됐어요. 영상을 다시 만들어 주세요.'});res.writeHead(200,{'Content-Type':'video/mp4','Content-Length':video.bytes.length,'Content-Disposition':videoDisposition(video.filename)});res.end(video.bytes);return;}
 if(req.method==='POST'&&url.pathname==='/api/render'){
  const {headline,frames,texts,duration=45,voice=true,audio={music:'none',volume:.12,sfx:false},tts={provider:'local'},motionLayers=[]}=await body(req);
  if(!Number.isInteger(duration)||duration<30||duration>60)return json(res,400,{error:'목표 길이는 30~60초로 선택해 주세요.'});
  if(typeof voice!=='boolean'||!['local','elevenlabs'].includes(tts?.provider))return json(res,400,{error:'내레이션 설정을 확인해 주세요.'});
  try{narrationSpeed(tts.speed);}catch(error){return json(res,400,{error:error.message});}
  if(!Array.isArray(frames)||frames.length<4||frames.length>6||frames.some(f=>typeof f!=='string'||!/^data:image\/png;base64,[A-Za-z0-9+/]+={0,2}$/.test(f)))return json(res,400,{error:'장면 이미지 4~6개가 필요해요.'});
  if(!Array.isArray(motionLayers)||(motionLayers.length!==0&&motionLayers.length!==frames.length)||motionLayers.some(f=>f!==null&&(typeof f!=='string'||!/^data:image\/png;base64,[A-Za-z0-9+/]+={0,2}$/.test(f))))return json(res,400,{error:'사진 움직임 레이어를 확인해 주세요.'});
  if(!Array.isArray(texts)||texts.length!==frames.length||texts.some(t=>typeof t!=='string'||!t.trim()||t.length>160)||narrationStyleIssues(texts).length)return json(res,400,{error:'각 장면은 160자 이하의 완결된 해요체로 작성해 주세요. 예: 확인해 보세요.'});
  if(!musicCatalog.some(m=>m.id===audio?.music)||!Number.isFinite(audio.volume)||audio.volume<0||audio.volume>.5||typeof audio.sfx!=='boolean')return json(res,400,{error:'음향 설정을 확인해 주세요.'});
  if(voice&&tts.provider==='local'&&process.platform!=='win32')return json(res,400,{error:'이 서버에서는 ElevenLabs 음성을 선택해 주세요. 기본 한국어 음성은 Windows에서 사용할 수 있어요.'});
  if(renderBusy)return json(res,409,{error:'다른 영상을 생성하고 있어요. 잠시 후 다시 시도해 주세요.'});renderBusy=true;
  const streaming=req.headers.accept?.includes('application/x-ndjson');
  const send=event=>{if(!res.destroyed)res.write(JSON.stringify(event)+'\n');};
  if(streaming){res.writeHead(200,{'Content-Type':'application/x-ndjson; charset=utf-8','Cache-Control':'no-cache, no-transform','X-Accel-Buffering':'no'});res.flushHeaders();}
  // Heartbeats keep an active long-running TTS request distinguishable from silence.
  const heartbeat=streaming?setInterval(()=>send({type:'heartbeat'}),10000):null;
  let rendered;
  try{rendered=await renderVideo(frames,texts,voice,audio,tts,duration,(percent,label)=>{if(streaming)send({type:'progress',percent,label});},motionLayers);}
  catch(error){if(streaming){send({type:'error',error:error.message});res.end();return;}throw error;}
  finally{renderBusy=false;if(heartbeat)clearInterval(heartbeat);}
  const videoId=randomUUID(),filename=videoFilename(headline);while(downloads.size>=3)downloads.delete(downloads.keys().next().value);downloads.set(videoId,{bytes:rendered.video,filename});setTimeout(()=>downloads.delete(videoId),15*60*1000).unref();
  const result={filename,videoUrl:`/api/video/${videoId}`,duration:rendered.duration,subtitles:rendered.subtitles,requestedSpeed:rendered.requestedSpeed,narrationSpeed:rendered.narrationSpeed};
  if(streaming){send({type:'complete',result});res.end();return;}
  return json(res,200,result);
 }
 const files={'/':'index.html','/app.js':'app.js','/style.css':'style.css'};
 if(req.method==='GET'&&files[url.pathname]){const file=await readFile('dist/'+files[url.pathname]);res.writeHead(200,{'Content-Type':url.pathname.endsWith('.js')?'text/javascript':url.pathname.endsWith('.css')?'text/css':'text/html; charset=utf-8'});res.end(file);return;}
 json(res,404,{error:'찾을 수 없습니다.'});
}catch(error){json(res,500,{error:error.message});}}).listen(port,host,()=>console.log(`Blog to Shorts: http://${host}:${port}`));
