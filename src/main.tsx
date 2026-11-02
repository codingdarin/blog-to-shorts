import {useEffect,useRef,useState} from 'react';
import {createRoot} from 'react-dom/client';
import {Clapperboard,Link,FileText,Sparkles,ImagePlus,Download,AudioLines} from 'lucide-react';
import {Button} from '@/components/ui/button';
import {Card,CardHeader,CardTitle,CardDescription,CardContent} from '@/components/ui/card';
import {Input} from '@/components/ui/input';
import {Textarea} from '@/components/ui/textarea';
import {Badge} from '@/components/ui/badge';
import {Progress} from '@/components/ui/progress';
import {Slider} from '@/components/ui/slider';
import {readRenderStream} from './render-stream.js';
import {api,loadImage,analysisImage,drawFrame,photoLayer,downloadText} from './workflow.js';
import './index.css';

type Scene={role:string;text:string;photoId:string;reason:string};
type Photo={id:string;dataUrl:string;image:HTMLImageElement;title:string;description:string;artist:string;pageUrl?:string;imageUrl?:string;license?:string};
type Track={id:string;name:string;credit:string;license:string};
type Voice={id:string;name:string};
const roles:Record<string,string>={hook:'Hook · 관심 끌기',body:'본문 · 핵심 설명',cta:'CTA · 마무리'};
function Section({step,title,description,children}:{step:string;title:string;description:string;children:React.ReactNode}){
 return <Card className="gap-0 border-slate-200 py-0 shadow-none"><CardHeader className="border-b border-slate-100 px-6 py-5"><CardTitle className="flex items-center gap-3 text-base"><span className="font-mono text-sm text-blue-600">{step}</span>{title}</CardTitle><CardDescription className="text-xs leading-relaxed">{description}</CardDescription></CardHeader><CardContent className="space-y-4 p-6">{children}</CardContent></Card>;
}
function App(){
 const [url,setUrl]=useState(''),[text,setText]=useState(''),[title,setTitle]=useState(''),[source,setSource]=useState(''),[sourceUrl,setSourceUrl]=useState('');
 const [tone,setTone]=useState('education'),[count,setCount]=useState(5),[duration,setDuration]=useState(45),[speed,setSpeed]=useState(1);
 const [photos,setPhotos]=useState<Photo[]>([]),[scenes,setScenes]=useState<Scene[]>([]),[headline,setHeadline]=useState('');
 const [motion,setMotion]=useState(true),[position,setPosition]=useState(0);
 const [active,setActive]=useState(0),[busy,setBusy]=useState(''),[notice,setNotice]=useState('블로그 글 주소를 불러오거나 본문을 직접 입력해 주세요.'),[warnings,setWarnings]=useState<string[]>([]);
 const [aiReady,setAiReady]=useState(false),[localReady,setLocalReady]=useState(true),[voice,setVoice]=useState(true),[provider,setProvider]=useState('local'),[voiceId,setVoiceId]=useState(''),[voices,setVoices]=useState<Voice[]>([]);
 const [tracks,setTracks]=useState<Track[]>([]),[music,setMusic]=useState('salsa-new-york'),[volume,setVolume]=useState(12),[sfx,setSfx]=useState(false);
 const [result,setResult]=useState<{videoUrl:string;duration:number;subtitles:string;filename:string}|null>(null),[draftMode,setDraftMode]=useState('');
 const [progress,setProgress]=useState<{percent:number;label:string;failed?:boolean}|null>(null);
 const canvas=useRef<HTMLCanvasElement>(null);
 const selectScene=(index:number)=>{setActive(index);setPosition(0);};
 const invalidate=()=>{setResult(null);setProgress(null);};
 useEffect(()=>{
  api('/api/status').then(s=>{setAiReady(s.aiReady);setLocalReady(s.localTtsReady);if(!s.localTtsReady)setVoice(false);}).catch(e=>setNotice(e.message));
  api('/api/music').then(s=>{setTracks(s.tracks);setMusic(s.defaultId);}).catch(e=>setNotice(e.message));
  api('/api/voices').then(s=>{setVoices(s.voices);if(s.voices.length)setVoiceId(s.voices[0].id);}).catch(e=>setNotice(e.message));
 },[]);
 useEffect(()=>{if(canvas.current)drawFrame(canvas.current,{headline,scene:scenes[active],photos,source,index:active,count:scenes.length||count,motionProgress:motion?position:undefined});},[headline,scenes,photos,source,active,count,motion,position]);
 async function importBlog(){
  setBusy('import');invalidate();setNotice('블로그 본문과 첨부 이미지를 가져오고 있어요.');
  try{
   const data=await api('/api/blog',{url:url.trim()}),next:Photo[]=[];const notes=[...data.warnings];
   for(const p of data.photos){try{next.push({...p,image:await loadImage(p.dataUrl)});}catch{notes.push(`${p.title}을 표시하지 못했어요.`);}}
   setText(data.text);setTitle(data.title);setHeadline(data.title.slice(0,48));setSource(data.source);setSourceUrl(data.url);setUrl(data.url);setPhotos(next);setScenes([]);selectScene(0);setDraftMode('');setWarnings(notes);
   setNotice(`본문 ${data.text.length.toLocaleString()}자와 이미지 ${next.length}장을 가져왔어요. 내용을 확인한 뒤 대본을 만들어 주세요.`);
  }catch(e){setNotice((e as Error).message);}finally{setBusy('');}
 }
 async function upload(files:FileList|null){
  if(!files?.length)return;setBusy('upload');invalidate();
  try{
   const available=8-photos.length;if(available<=0)throw Error('이미지는 최대 8장이에요. 기존 이미지를 지운 뒤 추가해 주세요.');
   const next:Photo[]=[];
   for(const file of Array.from(files).slice(0,available)){
    if(!['image/jpeg','image/png','image/webp'].includes(file.type)||file.size>15e6)throw Error('사진은 JPG·PNG·WebP, 한 장에 15MB 이하로 올려 주세요.');
    const objectUrl=URL.createObjectURL(file);let image;
    try{image=await loadImage(objectUrl) as HTMLImageElement;}finally{URL.revokeObjectURL(objectUrl);}
    const p={id:crypto.randomUUID(),image,title:file.name,description:file.name,artist:'직접 업로드',dataUrl:''};
    p.dataUrl=analysisImage(p).dataUrl;next.push(p);
   }
   setPhotos([...photos,...next]);setNotice(`${next.length}장 추가했어요.${files.length>available?' 8장 한도에 맞춰 일부만 추가했어요.':''}`);
  }catch(e){setNotice((e as Error).message);}finally{setBusy('');}
 }
 async function generate(){
  setBusy('script');invalidate();setNotice('본문과 실제 이미지를 함께 분석해 Hook·본문·CTA 대본을 만들고 있어요.');
  try{
   const data=await api('/api/script',{text,title,sceneCount:count,duration,tone,speed,photos:photos.map(analysisImage)});
   setHeadline(data.headline);setScenes(data.scenes);selectScene(0);setDraftMode('AI 초안');setWarnings(data.warnings);setNotice('AI 초안이 준비됐어요. 장면별 내용과 이미지를 확인하고 영상을 만들어 주세요.');
  }catch(e){setNotice((e as Error).message);}finally{setBusy('');}
 }
 function manual(){invalidate();setScenes(Array.from({length:count},(_,i)=>({role:i===0?'hook':i===count-1?'cta':'body',text:'',photoId:photos[i%photos.length]?.id||'',reason:'직접 작성한 문구와 이미지를 확인해 주세요.'})));selectScene(0);setDraftMode('수동 작성');setWarnings([]);setNotice('장면별 문구를 직접 입력해 주세요. AI 생성 결과가 아니에요.');}
 function updateScene(i:number,patch:Partial<Scene>){invalidate();setScenes(s=>s.map((scene,j)=>i===j?{...scene,...patch}:scene));selectScene(i);}
 async function render(){
  setBusy('render');invalidate();setNotice('음성·자막·이미지를 합쳐 영상을 만들고 있어요.');
  setProgress({percent:0,label:'장면 이미지를 준비하고 있어요.'});
  try{
   await new Promise<void>(resolve=>requestAnimationFrame(()=>setTimeout(resolve,0)));
   await document.fonts.ready;const surface=document.createElement('canvas');surface.width=720;surface.height=1280;
   const motionLayers=motion?scenes.map(scene=>{const photo=photos.find(p=>p.id===scene.photoId);return photo?photoLayer(photo):null;}):[];
   const frames=scenes.map((scene,index)=>{drawFrame(surface,{headline,scene,photos,source,index,count:scenes.length,hidePhoto:!!motionLayers[index]});return surface.toDataURL('image/png');});
   setProgress({percent:5,label:'장면 이미지를 서버로 보내고 있어요.'});
   const response=await fetch('/api/render',{method:'POST',headers:{'Content-Type':'application/json','Accept':'application/x-ndjson'},body:JSON.stringify({headline,frames,motionLayers,texts:scenes.map(s=>s.text),duration,voice,tts:{provider,voiceId,speed},audio:{music,volume:volume/100,sfx}})});
   const data=await readRenderStream(response,event=>setProgress({percent:event.percent,label:event.label}));
   setProgress({percent:100,label:'영상 생성 완료 · 미리보기와 다운로드가 준비됐어요.'});
   setResult(data);setNotice(`${data.duration.toFixed(1)}초 · 1080 × 1920 영상이 완성됐어요.${data.narrationSpeed&&data.narrationSpeed!==data.requestedSpeed?` 60초 안에 맞추기 위해 더빙을 ${data.requestedSpeed}배에서 ${data.narrationSpeed}배로 자동 조정했어요.`:''} 미리보기 후 내려받으세요.`);
  }catch(e){setProgress(p=>({percent:p?.percent||0,label:'영상 생성 중단 · 아래 안내를 확인해 주세요.',failed:true}));setNotice((e as Error).message);}finally{setBusy('');}
 }
 function seek(seconds:number){
  const point=Math.min(scenes.length,Math.max(0,seconds/duration*scenes.length));
  const index=Math.min(scenes.length-1,Math.floor(point));
  setActive(index);setPosition(point-index);
 }
 function credits(){downloadText(['# 콘텐츠 출처',`원문 제목: ${title}`,`작성자: ${source||'직접 입력'}`,`원문: ${sourceUrl||'직접 입력'}`,'이미지는 비율을 유지해 배치하고 자막과 합성했습니다.',...photos.map(p=>`${p.title}\n제공: ${p.artist}\n원문: ${p.pageUrl||'직접 업로드'}\n이미지: ${p.imageUrl||'직접 업로드'}\n이용 조건: ${p.license||'업로더 확인'}`),`음악: ${tracks.find(t=>t.id===music)?.name||music}`,`음악 출처: ${tracks.find(t=>t.id===music)?.credit||''} / ${tracks.find(t=>t.id===music)?.license||''}`,`전환 효과음: ${sfx?'자체 합성':'없음'}`].join('\n\n'),'blog-short-credits.md','text/markdown');}
 const selectClass='w-full rounded-md border border-slate-200 bg-white p-2 text-sm';
 return <><header className="border-b border-slate-200 bg-white"><div className="mx-auto flex h-16 max-w-[1400px] items-center justify-between px-5 md:px-10"><div className="flex items-center gap-3"><span className="rounded-lg bg-slate-950 p-2 text-white"><Clapperboard size={20}/></span><span className="font-semibold tracking-tight">블로그 투 쇼츠</span></div><Badge variant="outline">30–60초 · 9:16</Badge></div></header>
 <main className="studio-main mx-auto w-full max-w-[1400px] px-5 py-9 md:px-10"><div className="studio-intro mb-8"><p className="mb-3 text-xs font-medium tracking-widest text-blue-600">BLOG TO SHORTS</p><h1 className="text-3xl font-semibold tracking-tight">좋은 글을, 짧고 선명한 영상으로.</h1><p className="mt-3 text-sm text-slate-500">블로그의 본문과 이미지를 가져와 대본을 만들고, 내 목소리로 다듬어 보세요.</p></div>
 <div className="studio-columns grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_360px]"><fieldset aria-label="콘텐츠 편집 영역" tabIndex={0} disabled={!!busy} className="editor-scroll min-w-0 space-y-5 disabled:opacity-80">
 <Section step="01" title="콘텐츠 가져오기" description="네이버 블로그 글 주소를 입력하거나, 사용할 본문을 직접 붙여넣으세요."><div className="flex flex-col gap-2 sm:flex-row"><Input aria-label="네이버 블로그 글 URL" value={url} onChange={e=>setUrl(e.target.value)} placeholder="https://blog.naver.com/블로그ID/글번호"/><Button onClick={importBlog} disabled={!url.trim()} className="gap-2"><Link size={15}/>{busy==='import'?'가져오는 중…':'글 불러오기'}</Button></div><details className="source-details rounded-lg border border-slate-200"><summary className="cursor-pointer px-4 py-3 text-sm font-medium">본문·이미지 확인 <span className="ml-2 text-xs font-normal text-slate-500">{text.length.toLocaleString()}자 · 이미지 {photos.length}장</span></summary><div className="space-y-4 border-t border-slate-100 p-4"><label className="field-label" htmlFor="source-title">원문 제목</label><Input id="source-title" value={title} maxLength={200} placeholder="직접 입력할 때는 제목도 적어 주세요" onChange={e=>{setTitle(e.target.value);invalidate();}}/><label className="field-label" htmlFor="evidence">본문 <span className="font-normal text-slate-400">{text.length.toLocaleString()} / 12,000자</span></label><Textarea id="evidence" value={text} maxLength={12000} onChange={e=>{setText(e.target.value);invalidate();}} placeholder="영상으로 만들 교육·블로그·마케팅 콘텐츠를 입력하세요." className="min-h-40 text-sm leading-relaxed"/>{sourceUrl&&<a href={sourceUrl} target="_blank" rel="noreferrer" className="text-xs text-blue-600 underline">{source} · 원문 확인</a>}<p className="hint">본문 이미지가 우선 사용돼요. 수집하지 못한 글은 본문 입력과 사진 업로드로 시작할 수 있어요.</p>
 <div className="flex items-center justify-between border-t border-slate-100 pt-4"><span className="text-sm font-medium">이미지 {photos.length} / 8장</span><label className="flex cursor-pointer items-center gap-1 text-xs text-blue-600"><ImagePlus size={14}/>내 사진 추가<input aria-label="내 사진 추가" type="file" accept="image/jpeg,image/png,image/webp" multiple className="sr-only" onChange={e=>{upload(e.target.files);e.target.value='';}}/></label></div>
 <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">{photos.map(p=><div key={p.id} className="overflow-hidden rounded-lg border border-slate-200"><img src={p.dataUrl} alt={p.title} className="aspect-square w-full bg-slate-50 object-contain"/><div className="flex items-center justify-between gap-1 p-2"><span className="truncate text-[11px]">{p.title}</span><button type="button" aria-label={`${p.title} 삭제`} className="text-[11px] text-slate-500" onClick={()=>{invalidate();setPhotos(photos.filter(x=>x.id!==p.id));setScenes(scenes.map(s=>s.photoId===p.id?{...s,photoId:''}:s));}}>삭제</button></div></div>)}</div><p className="hint">영상에 사용할 수 있는 본문과 이미지를 선택하세요. 교육 자료의 글자가 잘리지 않도록 이미지 전체를 배치해요.</p></div></details><p className="hint">본문을 직접 입력하거나 첨부 이미지를 확인하려면 위 영역을 펼쳐 주세요.</p></Section>
 <Section step="02" title="대본 구성하기" description="Hook으로 관심을 끌고, 핵심 설명과 CTA로 마무리하는 초안을 만들어요."><div className="grid gap-3 sm:grid-cols-2"><label className="space-y-2 text-xs">콘텐츠 톤<select aria-label="콘텐츠 톤" value={tone} onChange={e=>setTone(e.target.value)} className={selectClass}><option value="education">교육 · 친절한 설명</option><option value="review">리뷰 · 이용자 후기</option><option value="marketing">마케팅 · 장점과 행동 제안</option><option value="shorts">쇼츠 · 빠르고 임팩트 있게</option></select></label><label className="space-y-2 text-xs">장면 수<select aria-label="장면 수" value={count} onChange={e=>setCount(Number(e.target.value))} className={selectClass}>{[4,5,6].map(n=><option key={n} value={n}>{n}개 장면</option>)}</select></label><label className="space-y-2 text-xs">목표 영상 길이<select aria-label="목표 영상 길이" value={duration} onChange={e=>{setDuration(Number(e.target.value));invalidate();}} className={selectClass}>{[30,45,60].map(n=><option key={n} value={n}>{n}초</option>)}</select></label><label className="space-y-2 text-xs">더빙 속도<select aria-label="더빙 속도" value={speed} onChange={e=>{setSpeed(Number(e.target.value));invalidate();}} className={selectClass}><option value="1">1배 · 기본</option><option value="1.25">1.25배</option><option value="1.5">1.5배</option><option value="1.75">1.75배</option><option value="2">2배 · 빠르게</option></select></label></div><p className="hint">목표 길이와 더빙 속도에 맞춰 대본 분량을 정해요. 대본 생성 전에 선택해 주세요.</p><div className="flex flex-wrap gap-2"><Button onClick={generate} disabled={text.trim().length<10} className="gap-2"><Sparkles size={15}/>{busy==='script'?'본문과 이미지 분석 중…':'AI 대본 만들기'}</Button><Button variant="outline" onClick={manual}>수동 대본 작성</Button></div><p className="hint">{aiReady?'AI 연결 설정됨 · 첨부 이미지와 본문을 함께 분석해요.':'AI 미연결 · 서버 .env에 제공받은 키를 설정하세요. 수집과 수동 작성은 바로 가능해요.'}</p><p className="hint">목표 길이는 영상의 최소 길이예요. 음성이 더 길면 최대 60초까지 늘어나고, 초과하면 더빙 속도를 자동 조정해요. 톤·장면 수·길이·속도를 바꾼 뒤 대본을 다시 생성하면 새 설정에 맞게 작성돼요. 더빙 속도는 영상 합성에도 적용돼요.</p></Section>
 <Section step="03" title="장면 확인과 편집" description="각 장면의 문구와 이미지를 확인하세요. 자막과 내레이션에는 같은 문구가 사용돼요."><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={motion} onChange={e=>{setMotion(e.target.checked);invalidate();}}/>사진에 움직임 넣기</label><p className="hint">사진을 천천히 확대·축소하고 좌우로 이동해요. 이미지 가장자리를 보존하고 제목·자막은 고정해요.</p><label className="field-label" htmlFor="headline">영상 제목</label><Input id="headline" value={headline} maxLength={48} onChange={e=>{setHeadline(e.target.value);invalidate();}} placeholder="영상 상단에 표시할 제목"/>{draftMode&&<Badge variant="secondary">{draftMode} · {scenes.length}장면</Badge>}{!scenes.length&&<p className="py-4 text-sm text-slate-400">대본을 만들면 여기에 장면별 편집기가 나타나요.</p>}{scenes.map((scene,i)=><div key={i} className={`space-y-3 rounded-lg border p-4 ${active===i?'border-blue-300 bg-blue-50/30':'border-slate-200'}`}><div className="flex items-center justify-between"><button type="button" onClick={()=>selectScene(i)} className="text-sm font-medium">{String(i+1).padStart(2,'0')} · {roles[scene.role]}</button><span className="text-[11px] text-slate-400">{scene.text.length} / 160자</span></div><Textarea aria-label={`장면 ${i+1} 문구`} value={scene.text} maxLength={160} className="min-h-24 text-sm leading-relaxed" placeholder="요 또는 죠로 끝나는 자연스러운 문장을 입력하세요." onChange={e=>updateScene(i,{text:e.target.value})}/><select aria-label={`장면 ${i+1} 이미지`} value={scene.photoId} onChange={e=>updateScene(i,{photoId:e.target.value,reason:'직접 선택한 이미지와 문구의 관련성을 확인해 주세요.'})} className={selectClass}><option value="">이미지 없이 텍스트 카드</option>{photos.map(p=><option key={p.id} value={p.id}>{p.title}</option>)}</select>{scene.photoId&&<img src={photos.find(p=>p.id===scene.photoId)?.dataUrl} alt={`장면 ${i+1} 선택 이미지`} className="max-h-40 w-full rounded bg-white object-contain"/>}<p className="hint">{scene.reason}</p></div>)}{warnings.length>0&&<div className="rounded-lg bg-slate-50 p-3 text-xs leading-relaxed text-slate-600">{warnings.map((w,i)=><p key={i}>{w}</p>)}</div>}</Section>
 <Section step="04" title="음성과 음악" description="기본 한국어 음성과 자막을 함께 넣어요. 내레이션은 문구 길이에 맞춰 장면별로 합성해요."><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={voice} onChange={e=>{setVoice(e.target.checked);invalidate();}}/><AudioLines size={16}/>TTS 내레이션 포함</label><p className="hint">현재 더빙 속도 {speed}배 · 위의 대본 구성에서 변경할 수 있어요.</p><select aria-label="내레이션 제공자" className={selectClass} value={provider} onChange={e=>{setProvider(e.target.value);invalidate();}}><option value="local" disabled={!localReady}>기본 한국어 음성 · Windows / 무료</option><option value="elevenlabs" disabled={!voices.length}>ElevenLabs · 계정 크레딧 사용</option></select>{provider==='elevenlabs'&&<select aria-label="ElevenLabs 음성" value={voiceId} onChange={e=>{setVoiceId(e.target.value);invalidate();}} className={selectClass}>{voices.map(v=><option key={v.id} value={v.id}>{v.name}</option>)}</select>}<label className="field-label" htmlFor="music">배경음악</label><select id="music" value={music} className={selectClass} onChange={e=>{setMusic(e.target.value);invalidate();}}>{tracks.map(t=><option key={t.id} value={t.id}>{t.name}</option>)}</select>{music!=='none'&&<audio controls preload="none" src={`/api/music/${music}`} className="w-full"/>}<label className="field-label" htmlFor="volume">음악 음량 {volume}%</label><input id="volume" type="range" min="0" max="50" value={volume} className="w-full" onChange={e=>{setVolume(Number(e.target.value));invalidate();}}/><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={sfx} onChange={e=>{setSfx(e.target.checked);invalidate();}}/>장면 전환 효과음</label></Section>
 </fieldset><aside aria-label="영상 미리보기 영역" tabIndex={0} className="preview-scroll space-y-4"><Card className="gap-0 overflow-hidden border-slate-200 py-0 shadow-none"><CardHeader className="flex flex-row items-center justify-between border-b border-slate-100 p-4"><CardTitle className="text-sm">영상 미리보기</CardTitle><Badge variant="outline" className="text-[10px]">1080 × 1920</Badge></CardHeader><CardContent className="space-y-4 p-5"><div className="rounded-xl bg-slate-100 p-5"><canvas ref={canvas} width="720" height="1280" className="mx-auto w-full max-w-[235px] rounded-xl shadow-lg"/></div><div className="space-y-2"><div className="flex items-center justify-between text-xs"><span>장면 미리보기 {scenes.length?`${active+1} / ${scenes.length}`:''}</span><span className="font-mono text-slate-500">{scenes.length?((active+position)*duration/scenes.length).toFixed(1):'0.0'} / {duration}초</span></div><Slider min={0} max={duration} step={0.1} value={[scenes.length?(active+position)*duration/scenes.length:0]} onValueChange={([value])=>seek(value)} disabled={!!busy||!scenes.length}/><p className="text-[11px] text-slate-400">슬라이더로 장면과 사진 움직임을 확인하세요. 합성 전 예상 시점이며 음성은 완성 영상에서 재생돼요.</p></div><Button onClick={render} disabled={!!busy||scenes.length<4||scenes.some(s=>!s.text.trim())} className="w-full gap-2"><Clapperboard size={15}/>{busy==='render'?'영상 합성 중…':'음성·자막 영상 만들기'}</Button>{progress&&<div className="space-y-2 rounded-lg border border-slate-200 bg-slate-50 p-3"><div className="flex items-center justify-between text-xs font-medium"><span>{progress.failed?'생성 중단':progress.percent===100?'생성 완료':'영상 생성 진행률'}</span><span className="font-mono tabular-nums">{progress.percent}%</span></div><Progress value={progress.percent} aria-label="영상 생성 진행률" aria-valuetext={`${progress.percent}% · ${progress.label}`}/><p aria-live="polite" className="text-xs leading-relaxed text-slate-600">{progress.label}</p>{busy==='render'&&<p className="text-[11px] text-slate-400">완료된 작업 단계 기준이에요. 음성 생성과 장면 합성 중에는 잠시 머무를 수 있어요.</p>}</div>}<p role="status" aria-live="polite" className="text-xs leading-relaxed text-slate-600">{notice}</p>{result&&<div className="space-y-3 border-t pt-4"><video controls playsInline src={result.videoUrl} className="max-h-[520px] w-full rounded-lg bg-black"/><a href={result.videoUrl} download={result.filename} className="flex items-center justify-center gap-2 rounded-md bg-blue-600 p-3 text-sm font-medium text-white"><Download size={15}/>MP4 내려받기</a><Button variant="outline" size="sm" className="w-full" onClick={()=>downloadText(result.subtitles,result.filename.replace(/\.mp4$/,'.srt'),'application/x-subrip')}>자막 SRT 내려받기</Button></div>}<Button variant="ghost" size="sm" onClick={credits} className="w-full gap-1"><FileText size={13}/>본문·이미지 출처 내려받기</Button></CardContent></Card><p className="px-1 text-xs leading-relaxed text-slate-400">생성된 초안의 사실과 이미지 이용 조건을 확인한 뒤 공유하세요. 작업은 현재 화면에 유지되며 새로고침하면 초기화돼요.</p></aside></div>
 <footer className="mt-10 border-t border-slate-200 pt-5 text-xs text-slate-400">블로그 투 쇼츠 · 글의 가치를 영상으로</footer></main></>;
}
createRoot(document.getElementById('root')!).render(<App/>);
