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
// Resample fractional crop coordinates instead of zoompan's integer crop rectangle.
// Keep full-resolution color planes during the transform to avoid chroma-grid snapping.
export function photoMotionFilter(index,frames){
 // perspective's output counter starts at 1, unlike zoompan's zero-based counter.
 const p=`min(1,max(0,on-1)/${Math.max(1,frames-1)})`,t=`((${p})*(${p})*(3-2*(${p})))`,profile=profiles[index%profiles.length];
 const zoom=`(${profile.from}+(${profile.to-profile.from})*${t})`,pan=`(${profile.left}+(${profile.right-profile.left})*${t})`;
 const left=`(W-W/${zoom})*${pan}`,top=`(H-H/${zoom})/2`;
 return `format=gbrp,perspective=x0='${left}':y0='${top}':x1='${left}+W/${zoom}':y1='${top}':x2='${left}':y2='${top}+H/${zoom}':x3='${left}+W/${zoom}':y3='${top}+H/${zoom}':sense=source:eval=frame:interpolation=cubic`;
}
