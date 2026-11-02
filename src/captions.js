import {balancedLines} from './text-layout.js';

export const CAPTION_BOX={x:0,y:973,width:720,height:150};
export const CAPTION_FONT_SIZE=34;
export function captionPages(text,measure,width=636){
 const words=text.trim().split(/\s+/).filter(Boolean),pages=[];
 const lines=part=>balancedLines(part,measure,width,{breakWords:false});
 let pending=[];
 while(words.length){
  const word=words.shift(),candidate=[...pending,word];
  if(pending.length&&lines(candidate.join(' ')).length>2){
   // Prefer the last complete sentence when it fits; otherwise break between words.
   let cut=pending.length;
   for(let i=pending.length-1;i>=0;i--)if(/[.!?。！？]["'”’)]*$/.test(pending[i])){cut=i+1;break;}
   pages.push(pending.slice(0,cut).join(' '));
   words.unshift(...pending.slice(cut),word);pending=[];
  }else pending=candidate;
 }
 if(pending.length)pages.push(pending.join(' '));
 return pages.map(text=>({text,lines:lines(text)}));
}
export const captionWeight=text=>Math.max(1,text.replace(/\s/g,'').length);
export function captionAt(pages,progress){
 const total=pages.reduce((n,p)=>n+captionWeight(p.text),0),point=Math.max(0,Math.min(1,progress))*total;
 let end=0;return pages.find(p=>{end+=captionWeight(p.text);return point<end;})||pages.at(-1);
}
// All cue boundaries lie on video frames. Keep the final caption during the scene's tail pause.
export function captionTiming(pages,sceneSeconds,speechSeconds=sceneSeconds){
 const frames=Math.round(sceneSeconds*30),spoken=Math.min(frames,Math.max(pages.length,Math.round(speechSeconds*30)));
 const weight=pages.reduce((n,p)=>n+captionWeight(p.text),0);let used=0,start=0;
 return pages.map((page,i)=>{
  used+=captionWeight(page.text);
  const end=i===pages.length-1?frames:Math.max(start+1,Math.min(spoken-(pages.length-i-1),Math.round(spoken*used/weight)));
  const cue={text:page.lines.join('\n'),start:start/30,end:end/30};start=end;return cue;
 });
}

export function validateCaptionLayers(layers,texts){
 if(!Array.isArray(layers)||(layers.length!==0&&layers.length!==texts.length))throw Error('장면별 자막 구성을 확인해 주세요.');
 const compact=text=>text.replace(/\s/g,'');
 layers.forEach((pages,i)=>{
  if(!Array.isArray(pages)||!pages.length||pages.length>80||pages.some(p=>!p||typeof p.text!=='string'||!p.text.trim()||p.text.length>160||!Array.isArray(p.lines)||p.lines.length<1||p.lines.length>2||p.lines.some(line=>typeof line!=='string'||!line.trim())||compact(p.lines.join(''))!==compact(p.text)||typeof p.dataUrl!=='string'||!/^data:image\/png;base64,[A-Za-z0-9+/]+={0,2}$/.test(p.dataUrl)))throw Error('자막은 한 번에 1~2줄로 구성해 주세요.');
  if(compact(pages.map(p=>p.text).join(''))!==compact(texts[i]))throw Error('자막 문구와 내레이션이 일치하지 않아요.');
 });
}
