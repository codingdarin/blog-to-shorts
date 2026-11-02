export function videoFilename(title,date=new Date()){
 const parts=new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Seoul',year:'2-digit',month:'2-digit',day:'2-digit'}).formatToParts(date);
 const part=type=>parts.find(p=>p.type===type).value;
 const clean=Array.from((typeof title==='string'?title:'').normalize('NFC').replace(/[<>:"/\\|?*\u0000-\u001f\u007f]/g,' ').replace(/\s+/g,' ').trim()).slice(0,80).join('').replace(/[. ]+$/,'')||'블로그투쇼츠';
 return `${part('year')}${part('month')}${part('day')}_${clean}.mp4`;
}

export function videoDisposition(filename){
 return `attachment; filename="${filename.slice(0,6)}_shorts.mp4"; filename*=UTF-8''${encodeURIComponent(filename).replace(/['()*]/g,c=>`%${c.charCodeAt(0).toString(16).toUpperCase()}`)}`;
}
