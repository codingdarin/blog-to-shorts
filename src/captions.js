export const CAPTION_BOX={x:0,y:973,width:720,height:150};
export const CAPTION_FONT_SIZE=34;
const sentenceEnd=word=>/[.!?。！？]["'”’)]*$/.test(word);
// A lightweight Korean boundary preference, not a full grammatical parser.
function boundaryCost(before,after){
 if(sentenceEnd(before))return 0;
 if(/^(수|뒤|때|것|것이|것을|있어요|있죠|없어요|보세요|해요|돼요|드려요)[.!?,]?$/.test(after))return 65;
 if(/(하는|되는|있는|없는|위한|대한|통한|익힌|확인한|작성한|배운)$/.test(before))return 55;
 if(/^(주요|핵심|최신|다양한|필요한|중요한|이런|그런|모든)$/.test(before)||/(의|과|와|을|를)$/.test(before))return 45;
 if(/(은|는|이|가)$/.test(before))return -14;
 if(/[,，:：]$/.test(before)||/(하면|하지만|다면|으며|면서|하고|고)$/.test(before))return -6;
 return 12;
}
function captionLines(words,measure,width){
 const text=words.join(' ');
 if(measure(text)<=width||words.length===1)return [text];
 let best;
 for(let cut=1;cut<words.length;cut++){
  const rows=[words.slice(0,cut).join(' '),words.slice(cut).join(' ')],sizes=rows.map(measure);
  if(sizes.some(size=>size>width))continue;
  const cost=((sizes[0]-sizes[1])/width)**2*20+Math.max(0,boundaryCost(words[cut-1],words[cut]))*.12;
  if(!best||cost<best.cost)best={cost,rows};
 }
 return best?.rows;
}
export function captionPages(text,measure,width=636){
 const words=text.trim().split(/\s+/).filter(Boolean),sentences=[],pages=[];
 let sentence=[];
 for(const word of words){sentence.push(word);if(sentenceEnd(word)){sentences.push(sentence);sentence=[];}}
 if(sentence.length)sentences.push(sentence);
 for(const tokens of sentences){
  // Optimize the whole sentence so a short predicate is not left on the next page.
  const memo=new Map();
  function solve(start){
   if(start===tokens.length)return {cost:0,pages:[]};
   if(memo.has(start))return memo.get(start);
   let best;
   for(let end=start+1;end<=tokens.length;end++){
    const part=tokens.slice(start,end),lines=captionLines(part,measure,width);
    if(!lines)continue;
    const rest=solve(end),size=measure(part.join(' '))/(width*2);
    const orphan=part.length===1?65:part.length===2?22:0;
    const boundary=end<tokens.length?boundaryCost(tokens[end-1],tokens[end]):0;
    const cost=100+Math.max(0,1-size)**2*20+orphan+boundary+rest.cost;
    if(!best||cost<best.cost)best={cost,pages:[{text:part.join(' '),lines},...rest.pages]};
   }
   memo.set(start,best);return best;
  }
  pages.push(...solve(0).pages);
 }
 return pages;
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

// Editor pages are the source of truth for both narration and displayed line breaks.
export const narrationFromCaptions=captions=>captions.map(text=>text.trim().replace(/\s+/g,' ')).filter(Boolean).join(' ');
export function editableCaptionPages(captions){
 return captions.map(value=>({text:value.trim().replace(/\s+/g,' '),lines:value.split(/\r?\n/).map(line=>line.trim())}));
}
export function captionEditorIssue(captions){
 if(!captions.length||captions.some(text=>!text.trim()))return '빈 자막을 입력하거나 삭제해 주세요.';
 if(captions.some(text=>text.split(/\r?\n/).length>2))return '한 자막은 두 줄까지예요. 자막을 추가해서 나눠 주세요.';
 if(captions.some(text=>text.split(/\r?\n/).some(line=>!line.trim())))return '빈 줄을 지우거나 문구를 입력해 주세요.';
 if(narrationFromCaptions(captions).length>160)return '장면 전체 자막을 합쳐 160자 이하로 줄여 주세요.';
 return '';
}
export function captionPosition(captions,index){
 const weights=captions.map(captionWeight),total=weights.reduce((sum,w)=>sum+w,0);
 return (weights.slice(0,index).reduce((sum,w)=>sum+w,0)+weights[index]/2)/total;
}
