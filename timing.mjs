export const NARRATION_SPEEDS=[1,1.25,1.5,1.75,2];
export function narrationSpeed(value=1){
 if(!NARRATION_SPEEDS.includes(value))throw Error('더빙 속도는 1·1.25·1.5·1.75·2배 중에서 선택해 주세요.');
 return value;
}
export function narrationBudget(duration,speed=1,sceneCount=5){
 narrationSpeed(speed);
 return {min:Math.min(sceneCount*160,Math.round(duration*5*speed)),max:Math.min(sceneCount*160,Math.round(duration*6*speed))};
}
export function fittedNarrationSpeed(seconds,currentSpeed){
 if(seconds.some(s=>!Number.isFinite(s)||s<=0))throw Error('음성 길이를 확인하지 못했어요.');
 const frames=seconds.reduce((sum,s)=>sum+Math.ceil((s+.35)*30),0);
 if(frames<=1800)return currentSpeed;
 // Reserve each scene's pause, frame rounding and a small filter tolerance.
 const available=60-seconds.length*(.35+1/30)-.25;
 return Math.ceil(currentSpeed*seconds.reduce((a,b)=>a+b,0)/available*100)/100;
}
export function tempoFilter(speed){
 if(!Number.isFinite(speed)||speed<1)throw Error('더빙 속도를 확인해 주세요.');
 const filters=[];while(speed>2){filters.push('atempo=2');speed/=2;}
 filters.push(`atempo=${Number(speed.toFixed(6))}`);return filters.join(',');
}
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
