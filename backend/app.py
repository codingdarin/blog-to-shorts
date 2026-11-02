import asyncio
import contextlib
import json
import os
import time
import uuid
from collections import OrderedDict
from contextlib import asynccontextmanager

import httpx
from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse, Response, FileResponse, StreamingResponse

from .config import ROOT, ai_ready, port
from .blog import get_blog
from .ai import plan_blog, validate_plan_input, narration_style_issues
from .elevenlabs import eleven_options
from .music import music_catalog, default_music_id
from .render import render_video
from .timing import narration_speed, validate_caption_layers, finite, PNG, video_filename, video_disposition


@asynccontextmanager
async def lifespan(app):
    app.state.busy=set()
    app.state.tasks=set()
    app.state.downloads=OrderedDict()
    async with httpx.AsyncClient(follow_redirects=False) as client:
        app.state.client=client
        yield
        tasks=list(app.state.tasks)
        for task in tasks:
            task.cancel()
        await asyncio.gather(*tasks,return_exceptions=True)


app=FastAPI(title='Blog to Shorts API',version='2.0.0',lifespan=lifespan)


def error(message,status=400):
    return JSONResponse({'error':message},status_code=status)


@app.middleware('http')
async def origin_guard(request,call_next):
    allowed={f'http://localhost:{port()}',f'http://127.0.0.1:{port()}',os.getenv('PUBLIC_ORIGIN')}
    if request.method=='POST' and request.headers.get('origin') and request.headers['origin'] not in allowed:
        return error('허용되지 않은 요청',403)
    return await call_next(request)


@app.exception_handler(ValueError)
async def value_error(request,exc):
    return error(str(exc))


@app.exception_handler(httpx.HTTPError)
async def upstream_error(request,exc):
    return error('외부 서비스 연결에 실패했어요. 잠시 후 다시 시도해 주세요.',502)


@app.exception_handler(Exception)
async def unexpected_error(request,exc):
    return error('서버 처리에 실패했어요. 서버 실행 상태를 확인해 주세요.',500)


async def read_body(request):
    data=bytearray()
    async for chunk in request.stream():
        data.extend(chunk)
        if len(data)>24_000_000:
            raise ValueError('요청이 너무 큽니다.')
    try:
        result=json.loads(data)
    except (json.JSONDecodeError,UnicodeDecodeError):
        raise ValueError('올바른 JSON 요청이 필요해요.') from None
    if not isinstance(result,dict):
        raise ValueError('JSON 객체가 필요해요.')
    return result


def public_error(exc):
    if isinstance(exc,ValueError):
        return str(exc)
    if isinstance(exc,httpx.HTTPError):
        return '외부 서비스 연결에 실패했어요. 잠시 후 다시 시도해 주세요.'
    return '작업 처리에 실패했어요. 서버 실행 상태를 확인해 주세요.'


async def task_response(request,key,operation):
    if key in app.state.busy:
        return error('같은 작업을 처리 중이에요. 잠시 후 다시 시도해 주세요.',409)
    app.state.busy.add(key)
    if 'application/x-ndjson' not in request.headers.get('accept',''):
        try:
            return JSONResponse(await operation(lambda p,l:None))
        finally:
            app.state.busy.discard(key)
    queue=asyncio.Queue()
    def progress(percent,label):
        queue.put_nowait(dict(type='progress',percent=percent,label=label))
    async def worker():
        try:
            result=await operation(progress)
            await queue.put(dict(type='complete',result=result))
        except asyncio.CancelledError:
            raise
        except Exception as exc:
            await queue.put(dict(type='error',error=public_error(exc)))
    async def stream():
        task=asyncio.create_task(worker())
        app.state.tasks.add(task)
        try:
            while True:
                try:
                    event=await asyncio.wait_for(queue.get(),timeout=10)
                except asyncio.TimeoutError:
                    event=dict(type='heartbeat')
                yield json.dumps(event,ensure_ascii=False,separators=(',',':'))+'\n'
                if event['type'] in ('complete','error'):
                    break
        finally:
            task.cancel()
            with contextlib.suppress(asyncio.CancelledError):
                await task
            app.state.tasks.discard(task)
            app.state.busy.discard(key)
    return StreamingResponse(stream(),media_type='application/x-ndjson',headers={'Cache-Control':'no-cache, no-transform','X-Accel-Buffering':'no'})


@app.get('/health')
async def health():
    return {'ok':True}


@app.get('/api/status')
async def status():
    return dict(localTtsReady=os.name=='nt',aiReady=ai_ready())


@app.get('/api/voices')
async def voices():
    return await eleven_options(app.state.client)


@app.post('/api/blog')
async def blog(request:Request):
    data=await read_body(request)
    if 'crawl' in app.state.busy:
        return error('다른 글을 수집 중이에요. 잠시 후 다시 시도해 주세요.',409)
    app.state.busy.add('crawl')
    try:
        return await get_blog(data.get('url'),app.state.client)
    finally:
        app.state.busy.discard('crawl')


@app.post('/api/script')
async def script(request:Request):
    data=await read_body(request)
    validate_plan_input(data)
    if not ai_ready():
        return error('서버 .env에 무료 사용이 확인된 AI 키를 설정해 주세요. 수집과 수동 작성은 사용할 수 있어요.',409)
    async def operation(progress):
        return {**await plan_blog(data,app.state.client,progress), 'mode':'ai'}
    return await task_response(request,'analysis',operation)


@app.get('/api/music')
async def music():
    return dict(tracks=[{k:v for k,v in t.items() if k not in ('file','preview')} for t in music_catalog()],defaultId=default_music_id())


@app.get('/api/music/{track_id}')
async def track(track_id:str):
    found=next((t for t in music_catalog() if t['id']==track_id),{})
    if not found.get('preview'):
        return error('찾을 수 없습니다.',404)
    return FileResponse(ROOT/found['preview'],media_type='audio/mpeg')


def validate_render(data):
    data={**data}
    data.setdefault('duration',45)
    data.setdefault('voice',True)
    data.setdefault('tts',dict(provider='local'))
    data.setdefault('audio',dict(music='none',volume=.12,sfx=False))
    data.setdefault('motionLayers',[])
    data.setdefault('captionLayers',[])
    if type(data['duration']) is not int or not 30<=data['duration']<=60:
        raise ValueError('목표 길이는 30~60초로 선택해 주세요.')
    if type(data['voice']) is not bool or not isinstance(data['tts'],dict) or data['tts'].get('provider') not in ('local','elevenlabs'):
        raise ValueError('내레이션 설정을 확인해 주세요.')
    narration_speed(data['tts'].get('speed',1))
    frames,texts,motion=data.get('frames'),data.get('texts'),data['motionLayers']
    if not isinstance(frames,list) or not 4<=len(frames)<=6 or any(not isinstance(f,str) or not PNG.fullmatch(f) for f in frames):
        raise ValueError('장면 이미지 4~6개가 필요해요.')
    if not isinstance(motion,list) or len(motion) not in (0,len(frames)) or any(f is not None and (not isinstance(f,str) or not PNG.fullmatch(f)) for f in motion):
        raise ValueError('사진 움직임 레이어를 확인해 주세요.')
    if not isinstance(texts,list) or len(texts)!=len(frames) or any(not isinstance(t,str) or not t.strip() or len(t)>160 for t in texts) or narration_style_issues(texts):
        raise ValueError('각 장면은 160자 이하의 완결된 해요체로 작성해 주세요. 예: 확인해 보세요.')
    validate_caption_layers(data['captionLayers'],texts)
    audio=data['audio']
    if not isinstance(audio,dict) or audio.get('music') not in [t['id'] for t in music_catalog()] or not finite(audio.get('volume')) or not 0<=audio['volume']<=.5 or type(audio.get('sfx')) is not bool:
        raise ValueError('음향 설정을 확인해 주세요.')
    if data['voice'] and data['tts']['provider']=='local' and os.name!='nt':
        raise ValueError('이 서버에서는 ElevenLabs 음성을 선택해 주세요. 기본 한국어 음성은 Windows에서 사용할 수 있어요.')
    return data


@app.post('/api/render')
async def render(request:Request):
    data=validate_render(await read_body(request))
    async def operation(progress):
        result=await render_video(data['frames'],data['texts'],data['voice'],data['audio'],data['tts'],data['duration'],progress,data['motionLayers'],data['captionLayers'],app.state.client)
        video_id,filename=str(uuid.uuid4()),video_filename(data.get('headline'))
        while len(app.state.downloads)>=3:
            app.state.downloads.popitem(last=False)
        video=result.pop('video')
        app.state.downloads[video_id]=dict(video=video,filename=filename,expires=time.monotonic()+900)
        asyncio.get_running_loop().call_later(900,app.state.downloads.pop,video_id,None)
        return dict(filename=filename,videoUrl=f'/api/video/{video_id}',**result)
    return await task_response(request,'render',operation)


@app.get('/api/video/{video_id}')
async def video(video_id:str):
    found=app.state.downloads.get(video_id)
    if not found or found['expires']<=time.monotonic():
        app.state.downloads.pop(video_id,None)
        return error('다운로드 시간이 만료됐어요. 영상을 다시 만들어 주세요.',404)
    return Response(found['video'],media_type='video/mp4',headers={'Content-Disposition':video_disposition(found['filename'])})


async def static_file(name,mime):
    file=ROOT/'dist'/name
    if not file.is_file():
        return error('프런트엔드 빌드가 필요해요. npm run build를 실행해 주세요.',503)
    return FileResponse(file,media_type=mime,headers={'Cache-Control':'no-cache'})


@app.get('/')
async def index():
    return await static_file('index.html','text/html')


@app.get('/app.js')
async def javascript():
    return await static_file('app.js','text/javascript')


@app.get('/style.css')
async def stylesheet():
    return await static_file('style.css','text/css')
