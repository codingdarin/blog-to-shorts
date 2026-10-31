import {readFile,writeFile,mkdir,rm} from 'node:fs/promises';
import {spawn} from 'node:child_process';
import {randomUUID} from 'node:crypto';
import path from 'node:path';
import ffmpeg from 'ffmpeg-static';
function run(command,args){return new Promise((resolve,reject)=>{const p=spawn(command,args,{windowsHide:true});let log='';p.stderr.on('data',x=>{log=(log+x).slice(-4000);});p.on('error',reject);p.on('close',code=>code===0?resolve(log):reject(Error(command===ffmpeg?'영상 변환 실패':'한국어 음성 합성 실패. 설치된 음성을 확인하세요.')));});}
function wavDuration(b){let rate=0,size=0;for(let i=12;i+8<=b.length;){const tag=b.toString('ascii',i,i+4),n=b.readUInt32LE(i+4);if(tag==='fmt ')rate=b.readUInt32LE(i+16);if(tag==='data')size=n;i+=8+n+(n%2);}if(!rate||!size)throw Error('음성 길이 확인 실패');return size/rate;}
export async function renderVideo(frames,texts,voice){
 const dir=path.resolve('renders',randomUUID());await mkdir(dir,{recursive:true});
 try{
 for(let i=0;i<4;i++)await writeFile(path.join(dir,`${i}.png`),Buffer.from(frames[i].split(',')[1],'base64'));
 if(voice){await writeFile(path.join(dir,'speech.json'),JSON.stringify(texts));await run('powershell.exe',['-NoProfile','-File',path.resolve('voice.ps1'),'-InputFile',path.join(dir,'speech.json'),'-OutputDirectory',dir]);}
 let duration=0;
 for(let i=0;i<4;i++){
 const seconds=voice?Math.max(3,wavDuration(await readFile(path.join(dir,`${i}.wav`)))+.35):5;duration+=seconds;
 await run(ffmpeg,['-y','-loop','1','-i',path.join(dir,`${i}.png`),...(voice?['-i',path.join(dir,`${i}.wav`),'-af','apad=pad_dur=1','-c:a','aac','-ar','48000']:[]),'-vf','scale=1080:1920,setsar=1','-t',String(seconds),'-r','30','-c:v','libx264','-preset','ultrafast','-pix_fmt','yuv420p',path.join(dir,`${i}.mp4`)]);
 }
 await writeFile(path.join(dir,'list.txt'),[0,1,2,3].map(i=>`file '${i}.mp4'`).join('\n'));
 await run(ffmpeg,['-y','-f','concat','-safe','0','-i',path.join(dir,'list.txt'),'-c','copy','-movflags','+faststart',path.join(dir,'short.mp4')]);
 return {video:await readFile(path.join(dir,'short.mp4')),duration};
 }finally{await rm(dir,{recursive:true,force:true});}
}
