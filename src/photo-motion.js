export const PHOTO_BOX={x:50,y:305,width:620,height:600};
const profiles=[
 {from:1.06,to:1.42,left:.5,right:.5},
 {from:1.42,to:1.06,left:.5,right:.5},
 {from:1.38,to:1.38,left:0,right:1},
 {from:1.38,to:1.38,left:1,right:0},
];
export function photoMotion(progress,index=0){
 const p=Math.max(0,Math.min(1,progress)),t=p*p*(3-2*p),profile=profiles[index%profiles.length];
 return {zoom:profile.from+(profile.to-profile.from)*t,pan:profile.left+(profile.right-profile.left)*t};
}
// The input layer covers the fixed photo box; zoom/pan intentionally crops its edges.
export function photoMotionFilter(index,frames){
 const p=`(on/${Math.max(1,frames-1)})`,t=`(${p}*${p}*(3-2*${p}))`,profile=profiles[index%profiles.length];
 return `scale=1240:1200,zoompan=z='${profile.from}+(${profile.to-profile.from})*${t}':x='(iw-iw/zoom)*(${profile.left}+(${profile.right-profile.left})*${t})':y='(ih-ih/zoom)/2':d=1:s=620x600:fps=30`;
}
