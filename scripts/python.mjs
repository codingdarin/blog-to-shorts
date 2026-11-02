// npm convenience only: HTTP, AI, crawling and rendering all run in Python.
import {existsSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {spawn} from 'node:child_process';

const root=fileURLToPath(new URL('../',import.meta.url));
const python=fileURLToPath(new URL(process.platform==='win32'?'../.venv/Scripts/python.exe':'../.venv/bin/python',import.meta.url));
if(!existsSync(python)){
 console.error('Python 가상환경이 필요합니다. README의 설치 단계를 먼저 실행해 주세요.');
 process.exit(1);
}
const child=spawn(python,process.argv.slice(2),{cwd:root,stdio:'inherit',windowsHide:true});
child.on('error',()=>{console.error('Python 실행에 실패했습니다. .venv를 확인해 주세요.');process.exitCode=1;});
child.on('exit',code=>{process.exitCode=code??1;});
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>child.kill(signal));
