import {balancedLines} from './text-layout.js';

export async function api(url,body){
 const response=await fetch(url,body===undefined?undefined:{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
 const data=await response.json();
 if(!response.ok)throw Error(data.error||'요청에 실패했어요.');
 return data;
}
export function loadImage(src){return new Promise((resolve,reject)=>{const image=new Image();image.onload=()=>resolve(image);image.onerror=()=>reject(Error('이미지를 읽지 못했어요.'));image.src=src;});}
export function analysisImage(photo){
 const canvas=document.createElement('canvas'),ratio=Math.min(1,768/Math.max(photo.image.width,photo.image.height));
 canvas.width=Math.max(1,Math.round(photo.image.width*ratio));canvas.height=Math.max(1,Math.round(photo.image.height*ratio));
 const ctx=canvas.getContext('2d');ctx.fillStyle='#fff';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.drawImage(photo.image,0,0,canvas.width,canvas.height);
 return {id:photo.id,description:photo.description||'',dataUrl:canvas.toDataURL('image/jpeg',.78)};
}
export function downloadText(text,name,type='text/plain'){
 const url=URL.createObjectURL(new Blob([text],{type:`${type};charset=utf-8`})),a=document.createElement('a');
 a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),10000);
}
export function drawFrame(canvas,{headline,scene,photos,source,index=0,count=5}){
 const ctx=canvas.getContext('2d');ctx.fillStyle='#0b1220';ctx.fillRect(0,0,720,1280);ctx.textAlign='center';
 function fit(text,maxWidth,maxLines,startSize,minSize,breakWords=true){
  let size=startSize,rows=[];
  do{ctx.font=`bold ${size}px "Malgun Gothic",sans-serif`;rows=balancedLines(text,t=>ctx.measureText(t).width,maxWidth,{breakWords});if((rows.length<=maxLines&&rows.every(row=>ctx.measureText(row).width<=maxWidth))||size<=minSize)break;size-=2;}while(true);
  return {size,rows};
 }
 // Shrink long titles instead of splitting a word; emphasize the second line.
 const title=fit((headline||'블로그의 지식을 한 편의 쇼츠로').replaceAll('|',' '),630,2,46,2,false);
 title.rows.forEach((line,i)=>{ctx.fillStyle=i===1?'#facc15':'#fff';ctx.fillText(line,360,135+i*(title.size+10));});
 const photo=photos.find(p=>p.id===scene?.photoId);
 if(photo){
  // Contain educational diagrams and screenshots so text is not cropped away.
  const ratio=Math.min(620/photo.image.width,600/photo.image.height),w=photo.image.width*ratio,h=photo.image.height*ratio;
  ctx.drawImage(photo.image,50+(620-w)/2,305+(600-h)/2,w,h);
 }else{
  ctx.fillStyle='#93c5fd';ctx.font='bold 34px "Malgun Gothic",sans-serif';ctx.fillText(scene?.role==='hook'?'함께 알아볼까요?':scene?.role==='cta'?'핵심을 기억해 보세요':'오늘의 핵심',360,580);
  ctx.fillStyle='#cbd5e1';ctx.font='24px "Malgun Gothic",sans-serif';ctx.fillText('본문 이미지 또는 내 사진을 선택하세요',360,630);
 }
 const subtitle=fit(scene?.text||'본문을 입력하고 대본을 만들어 보세요.',636,7,34,22);
 ctx.fillStyle='#fff';subtitle.rows.forEach((line,i)=>ctx.fillText(line,360,958+i*(subtitle.size+5)));
 ctx.font='18px "Malgun Gothic",sans-serif';ctx.fillStyle='#94a3b8';
 ctx.fillText(String(source||'직접 입력한 콘텐츠').slice(0,42),360,1218);
 if(photo)ctx.fillText(`이미지: ${String(photo.artist||'직접 업로드').slice(0,32)}`,360,1245);
 ctx.textAlign='left';
}
