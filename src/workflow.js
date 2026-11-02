import {titleLines} from './text-layout.js';
import {PHOTO_BOX,photoMotion} from './photo-motion.js';
import {CAPTION_BOX,CAPTION_FONT_SIZE,captionPages,captionAt} from './captions.js';

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
export function photoLayer(photo){
 const surface=document.createElement('canvas');surface.width=PHOTO_BOX.width;surface.height=PHOTO_BOX.height;
 const ctx=surface.getContext('2d');ctx.fillStyle='#000';ctx.fillRect(0,0,surface.width,surface.height);
 const ratio=Math.max(surface.width/photo.image.width,surface.height/photo.image.height),w=photo.image.width*ratio,h=photo.image.height*ratio;
 ctx.drawImage(photo.image,(surface.width-w)/2,(surface.height-h)/2,w,h);
 return surface.toDataURL('image/png');
}
function pagesFor(ctx,text){
 ctx.font=`bold ${CAPTION_FONT_SIZE}px "Malgun Gothic",sans-serif`;
 return captionPages(text,t=>ctx.measureText(t).width);
}
function paintCaption(ctx,page,y){
 ctx.fillStyle='#fff';ctx.textAlign='center';
 let size=CAPTION_FONT_SIZE;
 do{ctx.font=`bold ${size}px "Malgun Gothic",sans-serif`;if(page.lines.every(line=>ctx.measureText(line).width<=636)||size<=2)break;size-=2;}while(true);
 page.lines.forEach((line,i)=>ctx.fillText(line,360,y+i*(size+10)));
}
export function captionLayers(scene){
 const canvas=document.createElement('canvas');canvas.width=CAPTION_BOX.width;canvas.height=CAPTION_BOX.height;
 const ctx=canvas.getContext('2d');
 return pagesFor(ctx,scene.text).map(page=>{ctx.clearRect(0,0,canvas.width,canvas.height);paintCaption(ctx,page,33);return {...page,dataUrl:canvas.toDataURL('image/png')};});
}
export function drawFrame(canvas,{headline,scene,photos,source,index=0,count=5,hidePhoto=false,hideCaption=false,captionProgress=0,motionProgress=/** @type {number|undefined} */(undefined)}){
 const ctx=canvas.getContext('2d');ctx.fillStyle='#000000';ctx.fillRect(0,0,720,1280);ctx.textAlign='center';
 function fit(text,maxWidth,maxLines,startSize,minSize){
  let size=startSize,rows=[];
  do{ctx.font=`bold ${size}px "Malgun Gothic",sans-serif`;rows=titleLines(text,t=>ctx.measureText(t).width,maxWidth);if((rows.length<=maxLines&&rows.every(row=>ctx.measureText(row).width<=maxWidth))||size<=minSize)break;size-=2;}while(true);
  return {size,rows};
 }
 // Honor manual line breaks, shrink long rows, and emphasize the second line.
 const title=fit((headline||'블로그의 지식을 한 편의 쇼츠로').replaceAll('|',' '),630,2,46,2);
 title.rows.forEach((line,i)=>{ctx.fillStyle=i===1?'#facc15':'#fff';ctx.fillText(line,360,135+i*(title.size+10));});
 const photo=photos.find(p=>p.id===scene?.photoId);
 if(photo&&!hidePhoto){
  // Moving photos cover the box and crop at its boundary; static photos retain contain.
  const moving=motionProgress!==undefined,ratio=(moving?Math.max:Math.min)(620/photo.image.width,600/photo.image.height),w=photo.image.width*ratio,h=photo.image.height*ratio;
  const {zoom,pan}=moving?photoMotion(motionProgress,index):{zoom:1,pan:.5};
  ctx.save();ctx.beginPath();ctx.rect(PHOTO_BOX.x,PHOTO_BOX.y,PHOTO_BOX.width,PHOTO_BOX.height);ctx.clip();
  ctx.drawImage(photo.image,50+((620-w)/2-(620-620/zoom)*pan)*zoom,305+((600-h)/2-(600-600/zoom)/2)*zoom,w*zoom,h*zoom);
  ctx.restore();
 }else if(!photo){
  ctx.fillStyle='#93c5fd';ctx.font='bold 34px "Malgun Gothic",sans-serif';ctx.fillText(scene?.role==='hook'?'함께 알아볼까요?':scene?.role==='cta'?'핵심을 기억해 보세요':'오늘의 핵심',360,580);
  ctx.fillStyle='#cbd5e1';ctx.font='24px "Malgun Gothic",sans-serif';ctx.fillText('본문 이미지 또는 내 사진을 선택하세요',360,630);
 }
 if(!hideCaption){const page=captionAt(pagesFor(ctx,scene?.text||'본문을 입력하고 대본을 만들어 보세요.'),captionProgress);if(page)paintCaption(ctx,page,CAPTION_BOX.y+33);}
 ctx.font='18px "Malgun Gothic",sans-serif';ctx.fillStyle='#94a3b8';
 ctx.fillText(String(source||'직접 입력한 콘텐츠').slice(0,42),360,1218);
 if(photo)ctx.fillText(`이미지: ${String(photo.artist||'직접 업로드').slice(0,32)}`,360,1245);
 ctx.textAlign='left';
}
