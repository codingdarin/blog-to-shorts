// Keep words intact and balance the rendered widths across the fewest lines.
export function balancedLines(text, measure, maxWidth) {
 const words=text.trim().split(/\s+/).filter(Boolean);
 const splitCharacters=words.some(word=>measure(word)>maxWidth);
 const tokens=splitCharacters?Array.from(text.trim()):words;
 const separator=splitCharacters?'':' ';
 if(!tokens.length)return [];
 for(let count=1;count<=tokens.length;count++){
  const target=measure(tokens.join(separator))/count;
  const memo=new Map();
  function solve(start,left){
   if(!left)return start===tokens.length?{cost:0,lines:[]}:null;
   const key=`${start}:${left}`;
   if(memo.has(key))return memo.get(key);
   let best=null;
   for(let end=start+1;end<=tokens.length-left+1;end++){
    const line=tokens.slice(start,end).join(separator).trim(),width=measure(line);
    if(width>maxWidth)break;
    const rest=solve(end,left-1);
    if(!rest)continue;
    const cost=(width-target)**2+rest.cost;
    if(!best||cost<best.cost)best={cost,lines:[line,...rest.lines]};
   }
   memo.set(key,best);return best;
  }
  const result=solve(0,count);
  if(result)return result.lines;
 }
 return tokens;
}
