export const AI_SETTINGS_KEY='blog-to-shorts:ai-preferences:v1';
export const defaultModels={openai:'gpt-5.6-terra',nvidia:'nvidia/nemotron-3.5-super-vl-120b-a12b'};
export function safePreferences(value){
 const provider=['openai','nvidia'].includes(value?.provider)?value.provider:'';
 const models={...defaultModels};
 for(const id of ['openai','nvidia']){
  const model=value?.models?.[id];
  if(typeof model==='string'&&/^[A-Za-z0-9][A-Za-z0-9._:/-]{0,149}$/.test(model))models[id]=model;
 }
 return {provider,models};
}
export function readPreferences(storage){
 try{return safePreferences(JSON.parse(storage.getItem(AI_SETTINGS_KEY)||'{}'));}catch{return safePreferences(null);}
}
export function savePreferences(storage,value){
 // Only this allowlisted object reaches localStorage. Never persist keys or credit approval.
 try{storage.setItem(AI_SETTINGS_KEY,JSON.stringify(safePreferences(value)));return true;}catch{return false;}
}
export function defaultVoice(voices){
 return voices.find(v=>/^roger(?:\s|$|[-–])/i.test(v.name))?.id||'';
}
