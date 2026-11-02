export const PHOTO_BOX={x:50,y:305,width:620,height:600};
export function photoMotion(progress,index=0){
 const p=Math.max(0,Math.min(1,progress)),t=index%2?1-p:p;
 return {zoom:1+.04*t,pan:.35+.3*t};
}
// Zoom the image layer only. Its 6% inset preserves every image edge during panning.
export function photoMotionFilter(index,frames){
 const p=`on/${Math.max(1,frames-1)}`,t=index%2?`(1-${p})`:`(${p})`;
 return `zoompan=z='1+0.04*${t}':x='(iw-iw/zoom)*(0.35+0.3*${t})':y='(ih-ih/zoom)/2':d=1:s=620x600:fps=30`;
}
