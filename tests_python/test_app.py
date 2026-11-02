import asyncio
import json
import time

import httpx
import pytest
from backend.app import app, lifespan
import backend.app as api

PNG='data:image/png;base64,AQID'
INPUT=dict(text='핵심 개념을 자신의 말로 설명하고 복습해 보세요.',sceneCount=6,duration=45,tone='shorts',speed=1,photos=[])
RENDER=dict(frames=[PNG]*4,texts=['핵심 내용을 확인해 보세요.']*4,voice=False,headline='건설기사\n공부 방법')


@pytest.fixture
async def client():
    async with lifespan(app):
        async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app),base_url='http://127.0.0.1:4311') as client:
            yield client


async def test_routes_and_request_guards(client):
    assert (await client.get('/health')).json()=={'ok':True}
    assert set((await client.get('/api/status')).json())=={'localTtsReady','aiReady'}
    music=(await client.get('/api/music')).json()
    assert all('file' not in track and 'preview' not in track for track in music['tracks'])
    for path in ['/.env','/backend/config.py','/local-data/blog-1.json','/../.env']:
        assert (await client.get(path)).status_code==404
    assert (await client.post('/api/script',json=INPUT,headers={'Origin':'https://evil.example'})).status_code==403
    for data in [b'{bad',b'[]',b'"hello"',b'x'*24_000_001]:
        r=await client.post('/api/script',content=data)
        assert r.status_code==400 and 'error' in r.json()
    for body in [dict(INPUT,tone=[]),dict(RENDER,tts=[]),dict(RENDER,texts=['오류']*4)]:
        r=await client.post('/api/script' if 'tone' in body else '/api/render',json=body)
        assert r.status_code==400


async def test_stream_progress_complete_error_and_release(client,monkeypatch):
    monkeypatch.setattr(api,'ai_ready',lambda:True)
    async def plan(data,client,progress):
        progress(10,'분석 중이에요.')
        progress(98,'완료했어요.')
        return {'headline':'학습 방법','scenes':[],'warnings':[]}
    monkeypatch.setattr(api,'plan_blog',plan)
    headers={'accept':'application/x-ndjson'}
    r=await client.post('/api/script',json=INPUT,headers=headers)
    assert r.headers['content-type'].startswith('application/x-ndjson')
    events=[json.loads(line) for line in r.text.splitlines()]
    assert [e['type'] for e in events]==['progress','progress','complete']
    assert events[-1]['result']['mode']=='ai' and not app.state.busy and not app.state.tasks
    assert (await client.post('/api/script',json=INPUT)).json()['mode']=='ai'
    async def broken(*args):
        raise ValueError('교정 후에도 대본 검증에 실패했어요.')
    monkeypatch.setattr(api,'plan_blog',broken)
    r=await client.post('/api/script',json=INPUT,headers=headers)
    assert r.json()['type']=='error' and not app.state.busy
    async def upstream(*args):
        raise httpx.ConnectError('secret URL or key')
    monkeypatch.setattr(api,'plan_blog',upstream)
    r=await client.post('/api/script',json=INPUT,headers=headers)
    assert 'secret' not in r.text and r.json()['type']=='error'
    assert (await client.post('/api/script',json=INPUT)).status_code==502


async def test_concurrency_and_cancellation_release(client,monkeypatch):
    monkeypatch.setattr(api,'ai_ready',lambda:True)
    started,cancelled=asyncio.Event(),asyncio.Event()
    async def pending(data,client,progress):
        started.set()
        try:
            await asyncio.Event().wait()
        finally:
            cancelled.set()
    monkeypatch.setattr(api,'plan_blog',pending)
    task=asyncio.create_task(client.post('/api/script',json=INPUT,headers={'accept':'application/x-ndjson'}))
    await asyncio.wait_for(started.wait(),2)
    assert (await client.post('/api/script',json=INPUT)).status_code==409
    assert (await client.get('/health')).status_code==200
    task.cancel()
    with pytest.raises(asyncio.CancelledError):
        await task
    await asyncio.wait_for(cancelled.wait(),2)
    assert not app.state.busy and not app.state.tasks


async def test_video_download_filename_cache_and_expiry(client,monkeypatch):
    async def render(*args):
        args[6](94,'영상 합성 중이에요.')
        return dict(video=b'fake-mp4',duration=45,subtitles='1\n00:00:00,000 --> 00:00:45,000\n문구예요.\n',requestedSpeed=1,narrationSpeed=1)
    monkeypatch.setattr(api,'render_video',render)
    links=[]
    for i in range(4):
        r=await client.post('/api/render',json=RENDER)
        assert r.status_code==200
        result=r.json()
        links.append(result['videoUrl'])
        assert result['filename'].endswith('_건설기사 공부 방법.mp4')
    assert (await client.get(links[0])).status_code==404
    r=await client.get(links[-1])
    assert r.content==b'fake-mp4' and r.headers['content-type']=='video/mp4'
    assert "filename*=UTF-8''" in r.headers['content-disposition']
    app.state.downloads[links[-1].split('/')[-1]]['expires']=time.monotonic()-1
    assert (await client.get(links[-1])).status_code==404


async def test_render_subprocess_cancel_kills_child(monkeypatch):
    import backend.render as rendering
    started=asyncio.Event()
    class Process:
        returncode=None
        killed=False
        async def communicate(self):
            started.set()
            await asyncio.Event().wait()
        def kill(self):
            self.killed=True
            self.returncode=-1
        async def wait(self):
            return self.returncode
    process=Process()
    async def create(*args,**kwargs):
        assert kwargs['stderr'] is not None
        return process
    monkeypatch.setattr(asyncio,'create_subprocess_exec',create)
    task=asyncio.create_task(rendering.run('ffmpeg',[]))
    await started.wait()
    task.cancel()
    with pytest.raises(asyncio.CancelledError):
        await task
    assert process.killed
