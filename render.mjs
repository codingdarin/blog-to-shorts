import {readFile,writeFile,mkdir,rm} from 'node:fs/promises';
import {spawn} from 'node:child_process';
import {randomUUID} from 'node:crypto';
import path from 'node:path';
import ffmpeg from 'ffmpeg-static';
import {musicWav,musicCatalog} from './music.mjs';
import {generateElevenScenes} from './elevenlabs.mjs';
import {sceneDurations,srtSubtitles,narrationSpeed,fittedNarrationSpeed,tempoFilter} from './timing.mjs';
import {photoMotionFilter} from './src/photo-motion.js';
function run(command,args){return new Promise((resolve,reject)=>{const p=spawn(command,args,{windowsHide:true});let log='';p.stderr.on('data',x=>{log=(log+x).slice(-4000);});p.on('error',reject);p.on('close',code=>code===0?resolve(log):reject(Error(command===ffmpeg?'영상 변환 실패':'한국어 음성 합성 실패. 설치된 음성을 확인하세요.')));});}
function wavDuration(b){let rate=0,size=0;for(let i=12;i+8<=b.length;){const tag=b.toString('ascii',i,i+4),n=b.readUInt32LE(i+4);if(tag==='fmt ')rate=b.readUInt32LE(i+16);if(tag==='data')size=n;i+=8+n+(n%2);}if(!rate||!size)throw Error('음성 길이 확인 실패');return size/rate;}
export async function renderVideo(frames,texts,voice,audio={music:'none',volume:.16,sfx:false},tts={provider:'local'},targetDuration=45,onProgress=()=>{},motionLayers=[]){
 const speed=narrationSpeed(tts.speed);
 const dir=path.resolve('renders',randomUUID());await mkdir(dir,{recursive:true});
 try{
 onProgress(8,'장면 이미지를 준비하고 있어요.');
 for(let i=0;i<frames.length;i++)await writeFile(path.join(dir,`${i}.png`),Buffer.from(frames[i].split(',')[1],'base64'));
 for(let i=0;i<motionLayers.length;i++)if(motionLayers[i])await writeFile(path.join(dir,`${i}-photo.png`),Buffer.from(motionLayers[i].split(',')[1],'base64'));
 if(voice&&tts.provider==='elevenlabs'){
  onProgress(10,`ElevenLabs 계정 확인 및 음성 생성 중 · 0/${texts.length}장면 완료`);
  await generateElevenScenes(texts,tts.voiceId,async(i,bytes)=>{const mp3=path.join(dir,`${i}.mp3`);await writeFile(mp3,bytes);await run(ffmpeg,['-y','-i',mp3,'-ar','24000','-ac','1','-c:a','pcm_s16le',path.join(dir,`${i}.wav`)]);onProgress(Math.round(10+30*(i+1)/texts.length),`ElevenLabs 음성 생성 중 · ${i+1}/${texts.length}장면 완료`);});
 }else if(voice){onProgress(10,`기본 한국어 음성을 생성하고 있어요 · ${texts.length}장면`);await writeFile(path.join(dir,'speech.json'),JSON.stringify(texts));await run('powershell.exe',['-NoProfile','-File',path.resolve('voice.ps1'),'-InputFile',path.join(dir,'speech.json'),'-OutputDirectory',dir]);}
 // Reuse the original speech for all speed adjustments; never call paid TTS again.
 let effectiveSpeed=speed,speech=null;
 const speechFile=i=>path.join(dir,`${i}${effectiveSpeed!==1?'-speed':''}.wav`);
 if(voice){
  for(let attempt=0;attempt<3;attempt++){
   if(effectiveSpeed!==1){
    onProgress(attempt?42:40,attempt?`60초 안에 맞추도록 더빙을 ${effectiveSpeed}배로 자동 조정하고 있어요.`:`더빙 속도 ${effectiveSpeed}배를 적용하고 있어요.`);
    for(let i=0;i<texts.length;i++)await run(ffmpeg,['-y','-i',path.join(dir,`${i}.wav`),'-af',tempoFilter(effectiveSpeed),'-c:a','pcm_s16le',speechFile(i)]);
   }
   speech=await Promise.all(texts.map(async(_,i)=>wavDuration(await readFile(speechFile(i)))));
   const fitted=fittedNarrationSpeed(speech,effectiveSpeed);
   if(fitted===effectiveSpeed||attempt===2)break;
   effectiveSpeed=fitted;
  }
 }
 onProgress(44,'음성 길이에 맞춰 장면과 자막 시간을 계산하고 있어요.');
 const durations=sceneDurations(texts,speech,targetDuration);
 let duration=0;const cuts=[];
 for(let i=0;i<frames.length;i++){
 onProgress(Math.round(45+40*i/frames.length),`장면 ${i+1}/${frames.length} · 이미지·음성·자막 합성 중`);
 const seconds=durations[i];if(i)cuts.push(duration);duration+=seconds;
 const moving=!!motionLayers[i];
 const visual=moving?['-filter_complex',`[1:v]${photoMotionFilter(i,Math.round(seconds*30))}[photo];[0:v][photo]overlay=50:305:shortest=1,scale=1080:1920,setsar=1[v]`,'-map','[v]']:['-vf','scale=1080:1920,setsar=1','-map','0:v'];
 await run(ffmpeg,['-y','-loop','1','-framerate','30','-i',path.join(dir,`${i}.png`),...(moving?['-loop','1','-framerate','30','-i',path.join(dir,`${i}-photo.png`)]:[]),...(voice?['-i',speechFile(i)]:[]),...visual,...(voice?['-map',`${moving?2:1}:a`,'-af','apad','-c:a','aac','-ar','48000']:[]),'-t',String(seconds),'-r','30','-c:v','libx264','-threads','2','-preset','ultrafast','-pix_fmt','yuv420p',path.join(dir,`${i}.mp4`)]);
 }
 onProgress(87,'장면들을 하나의 영상으로 연결하고 있어요.');
 await writeFile(path.join(dir,'list.txt'),frames.map((_,i)=>`file '${i}.mp4'`).join('\n'));
 await run(ffmpeg,['-y','-f','concat','-safe','0','-i',path.join(dir,'list.txt'),'-c','copy','-movflags','+faststart',path.join(dir,'short.mp4')]);
 let output=path.join(dir,'short.mp4');
 if(audio.music!=='none'||audio.sfx){
  onProgress(90,'배경음악과 효과음을 믹싱하고 있어요.');
  const track=musicCatalog.find(t=>t.id===audio.music);
  await writeFile(path.join(dir,'music.wav'),musicWav(duration,{...audio,music:track?.file?'none':audio.music,cuts}));
  const mixed=path.join(dir,'mixed.mp4');
  const inputs=[...(voice?['[0:a]']:[]),'[1:a]',...(track?.file?['[bg]']:[])];
  const filter=(track?.file?`[2:a]volume=${audio.volume},afade=t=in:st=0:d=0.3,afade=t=out:st=${Math.max(0,duration-.7)}:d=0.7[bg];`:'')+inputs.join('')+`amix=inputs=${inputs.length}:duration=longest:normalize=0,alimiter=limit=0.95:level=false[a]`;
  await run(ffmpeg,['-y','-i',output,'-i',path.join(dir,'music.wav'),...(track?.file?['-stream_loop','-1','-i',path.resolve(track.file)]:[]),'-filter_complex',filter,'-map','0:v','-map','[a]','-c:v','copy','-c:a','aac','-ar','48000','-t',String(duration),'-movflags','+faststart',mixed]);output=mixed;
 }
 onProgress(97,'완성 영상과 다운로드 파일을 준비하고 있어요.');
 return {video:await readFile(output),duration,subtitles:srtSubtitles(texts,durations),requestedSpeed:voice?speed:null,narrationSpeed:voice?effectiveSpeed:null};
 }finally{await rm(dir,{recursive:true,force:true});}
}
