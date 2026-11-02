import {existsSync} from 'node:fs';
export const licensedTracks=[
 {id:'salsa-new-york',name:'Salsa Estilo New York 03',credit:'vjgalaxy (Alejandro Piñero Amerio)',pageUrl:'https://pixabay.com/music/latin-salsa-estilo-new-york-03-522534/',contentId:null,aiGenerated:true},
 {id:'salsa',name:'Happy Latin Salsa Dance',credit:'kornevmusic',pageUrl:'https://pixabay.com/music/salsa-happy-latin-salsa-dance-621026/'},
 {id:'lunar',name:'Chinese Lunar New Year',credit:'ViacheslavStarostin',pageUrl:'https://pixabay.com/music/china-chinese-lunar-new-year-465871/'},
 {id:'swing',name:'Bring Back the Swing (Upbeat Jazz)',credit:'EvolvingVibes',pageUrl:'https://pixabay.com/music/traditional-jazz-bring-back-the-swing-upbeat-jazz-617230/'}
].map(t=>({license:'Pixabay Content License',licenseUrl:'https://pixabay.com/service/license-summary/',contentId:true,...t,file:`local-data/music/${t.id}.mp3`,preview:`local-data/music/${t.id}-preview.mp3`,url:`/api/music/${t.id}`}));
export const musicCatalog=[...licensedTracks.filter(t=>existsSync(t.file)&&existsSync(t.preview)),{id:'none',name:'브금 없음',credit:'',license:''}];
export const defaultMusicId=musicCatalog.some(t=>t.id==='salsa-new-york')?'salsa-new-york':'none';
const rate=24000;
export function musicWav(duration=16,{music='none',volume=.16,sfx=false,cuts=[]}={}){
 if(!musicCatalog.some(m=>m.id===music))throw Error('등록되지 않은 브금입니다.');
 if(!Number.isFinite(volume)||volume<0||volume>0.5)throw Error('브금 음량 범위를 확인하세요.');
 const count=Math.ceil(duration*rate),data=Buffer.alloc(44+count*2);
 data.write('RIFF');data.writeUInt32LE(data.length-8,4);data.write('WAVEfmt ',8);data.writeUInt32LE(16,16);data.writeUInt16LE(1,20);data.writeUInt16LE(1,22);data.writeUInt32LE(rate,24);data.writeUInt32LE(rate*2,28);data.writeUInt16LE(2,32);data.writeUInt16LE(16,34);data.write('data',36);data.writeUInt32LE(count*2,40);
 let seed=12345;
 for(let i=0;i<count;i++){
  const t=i/rate;
  let sample=0;
  if(sfx)for(const cut of cuts){const dt=t-cut;if(dt>=0&&dt<.16){seed=(1664525*seed+1013904223)>>>0;sample+=((seed/4294967296)*2-1)*.045*Math.sin(Math.PI*dt/.16)**2;}}
  data.writeInt16LE(Math.round(Math.max(-1,Math.min(1,sample))*32767),44+i*2);
 }
 return data;
}
