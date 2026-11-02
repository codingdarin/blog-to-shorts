import {readFile,writeFile,mkdir,rm} from 'node:fs/promises';
import {spawn} from 'node:child_process';
import {randomUUID} from 'node:crypto';
import path from 'node:path';
import ffmpeg from 'ffmpeg-static';
import {musicWav,musicCatalog} from './music.mjs';
import {generateElevenScenes} from './elevenlabs.mjs';
import {sceneDurations,srtSubtitles} from './timing.mjs';
function run(command,args){return new Promise((resolve,reject)=>{const p=spawn(command,args,{windowsHide:true});let log='';p.stderr.on('data',x=>{log=(log+x).slice(-4000);});p.on('error',reject);p.on('close',code=>code===0?resolve(log):reject(Error(command===ffmpeg?'영상 변환 실패':'한국어 음성 합성 실패. 설치된 음성을 확인하세요.')));});}
function wavDuration(b){let rate=0,size=0;for(let i=12;i+8<=b.length;){const tag=b.toString('ascii',i,i+4),n=b.readUInt32LE(i+4);if(tag==='fmt ')rate=b.readUInt32LE(i+16);if(tag==='data')size=n;i+=8+n+(n%2);}if(!rate||!size)throw Error('음성 길이 확인 실패');return size/rate;}
export async function renderVideo(frames,texts,voice,audio={music:'none',volume:.16,sfx:false},tts={provider:'local'},targetDuration=45){
 const dir=path.resolve('renders',randomUUID());await mkdir(dir,{recursive:true});
 try{
 for(let i=0;i<frames.length;i++)await writeFile(path.join(dir,`${i}.png`),Buffer.from(frames[i].split(',')[1],'base64'));
 if(voice&&tts.provider==='elevenlabs'){
  await generateElevenScenes(texts,tts.voiceId,async(i,bytes)=>{const mp3=path.join(dir,`${i}.mp3`);await writeFile(mp3,bytes);await run(ffmpeg,['-y','-i',mp3,'-ar','24000','-ac','1','-c:a','pcm_s16le',path.join(dir,`${i}.wav`)]);});
 }else if(voice){await writeFile(path.join(dir,'speech.json'),JSON.stringify(texts));await run('powershell.exe',['-NoProfile','-File',path.resolve('voice.ps1'),'-InputFile',path.join(dir,'speech.json'),'-OutputDirectory',dir]);}
 const speech=voice?await Promise.all(texts.map(async(_,i)=>wavDuration(await readFile(path.join(dir,`${i}.wav`))))):null;
 const durations=sceneDurations(texts,speech,targetDuration);
 let duration=0;const cuts=[];
 for(let i=0;i<frames.length;i++){
 const seconds=durations[i];if(i)cuts.push(duration);duration+=seconds;
 await run(ffmpeg,['-y','-loop','1','-i',path.join(dir,`${i}.png`),...(voice?['-i',path.join(dir,`${i}.wav`),'-af','apad','-c:a','aac','-ar','48000']:[]),'-vf','scale=1080:1920,setsar=1','-t',String(seconds),'-r','30','-c:v','libx264','-threads','2','-preset','ultrafast','-pix_fmt','yuv420p',path.join(dir,`${i}.mp4`)]);
 }
 await writeFile(path.join(dir,'list.txt'),frames.map((_,i)=>`file '${i}.mp4'`).join('\n'));
 await run(ffmpeg,['-y','-f','concat','-safe','0','-i',path.join(dir,'list.txt'),'-c','copy','-movflags','+faststart',path.join(dir,'short.mp4')]);
 let output=path.join(dir,'short.mp4');
 if(audio.music!=='none'||audio.sfx){
  const track=musicCatalog.find(t=>t.id===audio.music);
  await writeFile(path.join(dir,'music.wav'),musicWav(duration,{...audio,music:track?.file?'none':audio.music,cuts}));
  const mixed=path.join(dir,'mixed.mp4');
  const inputs=[...(voice?['[0:a]']:[]),'[1:a]',...(track?.file?['[bg]']:[])];
  const filter=(track?.file?`[2:a]volume=${audio.volume},afade=t=in:st=0:d=0.3,afade=t=out:st=${Math.max(0,duration-.7)}:d=0.7[bg];`:'')+inputs.join('')+`amix=inputs=${inputs.length}:duration=longest:normalize=0,alimiter=limit=0.95:level=false[a]`;
  await run(ffmpeg,['-y','-i',output,'-i',path.join(dir,'music.wav'),...(track?.file?['-stream_loop','-1','-i',path.resolve(track.file)]:[]),'-filter_complex',filter,'-map','0:v','-map','[a]','-c:v','copy','-c:a','aac','-ar','48000','-t',String(duration),'-movflags','+faststart',mixed]);output=mixed;
 }
 return {video:await readFile(output),duration,subtitles:srtSubtitles(texts,durations)};
 }finally{await rm(dir,{recursive:true,force:true});}
}
