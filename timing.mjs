export function sceneDurations(texts,speechSeconds,target=45){
 if(texts.length<4||texts.length>6||!Number.isInteger(target)||target<30||target>60)throw Error('4~6장면과 30~60초 길이를 확인해 주세요.');
 const minimum=texts.map((_,i)=>speechSeconds?Math.ceil((speechSeconds[i]+.35)*30):1);
 if(minimum.some(n=>!Number.isFinite(n)||n<1))throw Error('음성 길이를 확인하지 못했어요.');
 const minTotal=minimum.reduce((a,b)=>a+b,0);
 if(minTotal>60*30)throw Error('내레이션이 60초를 넘어요. 장면 문구를 줄인 뒤 다시 만들어 주세요.');
 const total=Math.max(target*30,minTotal),extra=total-minTotal;
 const weights=texts.map(t=>Math.max(1,t.length)),sum=weights.reduce((a,b)=>a+b,0);
 const frames=minimum.map((n,i)=>n+Math.floor(extra*weights[i]/sum));
 frames[frames.length-1]+=total-frames.reduce((a,b)=>a+b,0);
 return frames.map(n=>n/30);
}
export function srtSubtitles(texts,durations){
 const stamp=seconds=>{const ms=Math.round(seconds*1000);return `${String(Math.floor(ms/3600000)).padStart(2,'0')}:${String(Math.floor(ms/60000)%60).padStart(2,'0')}:${String(Math.floor(ms/1000)%60).padStart(2,'0')},${String(ms%1000).padStart(3,'0')}`;};
 let start=0;
 return texts.map((text,i)=>{const end=start+durations[i],line=`${i+1}\n${stamp(start)} --> ${stamp(end)}\n${text}\n`;start=end;return line;}).join('\n');
}
