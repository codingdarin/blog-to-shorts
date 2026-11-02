import {Input} from '@/components/ui/input';
import {Button} from '@/components/ui/button';

export type AIProvider={id:string;configured:boolean;ready:boolean;model:string};
export function AIConnection({provider,model,apiKey,confirmed,providers,onProvider,onModel,onKey,onConfirmed,onForget}:{
 provider:string;model:string;apiKey:string;confirmed:boolean;providers:AIProvider[];
 onProvider:(value:string)=>void;onModel:(value:string)=>void;onKey:(value:string)=>void;onConfirmed:(value:boolean)=>void;onForget:()=>void;
}){
 const status=providers.find(p=>p.id===provider),needsConfirmation=!!apiKey||!status?.ready;
 const secure=location.protocol==='https:'||['localhost','127.0.0.1','[::1]'].includes(location.hostname);
 return <details open className="rounded-lg border border-slate-200">
  <summary className="cursor-pointer px-4 py-3 text-sm font-medium">AI API 연결 <span className="ml-2 text-xs font-normal text-slate-500">{provider==='openai'?'OpenAI · GPT':'NVIDIA'}</span></summary>
  <div className="space-y-3 border-t border-slate-100 p-4">
   <div className="grid gap-3 sm:grid-cols-2">
    <label className="space-y-2 text-xs">AI API<select aria-label="AI API" value={provider} onChange={e=>onProvider(e.target.value)} className="w-full rounded-md border border-slate-200 bg-white p-2 text-sm"><option value="openai">OpenAI · GPT</option><option value="nvidia">NVIDIA</option></select></label>
    <label className="space-y-2 text-xs">모델 ID<Input aria-label="AI 모델 ID" value={model} maxLength={150} onChange={e=>onModel(e.target.value)} placeholder={status?.model}/></label>
   </div>
   <label className="block space-y-2 text-xs">API 키<Input aria-label="AI API 키" type="password" autoComplete="off" spellCheck={false} disabled={!secure} value={apiKey} maxLength={512} onChange={e=>onKey(e.target.value)} placeholder={status?.configured?'서버 키 설정됨 · 비워 두면 서버 키 사용':'제공받은 API 키를 입력하세요'}/></label>
   {!secure&&<p className="text-xs text-red-600">키 입력은 이 PC의 localhost 또는 HTTPS 연결에서 사용할 수 있어요.</p>}
   <p className="hint">{apiKey?'입력한 키로 대본을 생성해요. 새로고침하면 키가 지워져요.':status?.configured?'서버에 등록된 키를 사용해요. 키 값은 화면으로 가져오지 않아요.':'선택한 API의 키가 필요해요.'}</p>
   {needsConfirmation&&<label className="flex items-start gap-2 text-xs leading-relaxed"><input type="checkbox" className="mt-0.5" checked={confirmed} onChange={e=>onConfirmed(e.target.checked)}/>제공받은 크레딧 또는 무료 사용 범위를 확인했어요.</label>}
   <p className="hint">키는 저장하지 않아요. API·모델 선택만 이 브라우저에 기억해요. 본문과 이미지는 선택한 AI 서비스로 전송돼요.</p>
   <div className="flex gap-2"><Button size="sm" variant="outline" disabled={!apiKey} onClick={()=>onKey('')}>입력한 키 지우기</Button><Button size="sm" variant="ghost" onClick={onForget}>저장된 API 선택 지우기</Button></div>
  </div>
 </details>;
}
