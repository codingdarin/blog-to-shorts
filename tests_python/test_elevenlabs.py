import json
import httpx
import pytest
from backend.elevenlabs import available_credits,eleven_options,generate_eleven_scenes
from backend.narration import narration_text


def test_credits_exclude_overage():
    assert available_credits(dict(character_limit=100,character_count=90))==10
    assert available_credits(dict(character_limit=100,character_count=101))==0
    with pytest.raises(ValueError):
        available_credits({})


async def test_voice_selection_and_no_key(monkeypatch):
    monkeypatch.delenv('ELEVENLABS_API_KEY',raising=False)
    async with httpx.AsyncClient() as client:
        assert not (await eleven_options(client))['ready']
    monkeypatch.setenv('ELEVENLABS_API_KEY','test')
    def handler(request):
        if request.url.path.endswith('subscription'):
            return httpx.Response(200,json=dict(character_limit=100,character_count=5,tier='free'))
        return httpx.Response(200,json={'voices':[dict(voice_id='ok',name='기본',category='premade'),dict(voice_id='no',name='유료',category='professional')]})
    async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as client:
        account=await eleven_options(client)
        assert [v['id'] for v in account['voices']]==['ok']
        assert account['remaining']==95


@pytest.mark.parametrize('count',[4,5,6])
async def test_all_scenes_use_same_multilingual_model(monkeypatch,count):
    monkeypatch.setenv('ELEVENLABS_API_KEY','test')
    texts=['핵심 개념을 확인해 보세요.']*count
    sent,saved=[],[]
    async def account():
        return dict(ready=True,voices=[dict(id='ok')],remaining=10000)
    def handler(request):
        data=json.loads(request.content)
        assert data['model_id']=='eleven_multilingual_v2'
        sent.append(data['text'])
        return httpx.Response(200,content=b'audio',headers={'content-type':'audio/mpeg'})
    async def save(i,data):
        saved.append((i,data))
    async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as client:
        await generate_eleven_scenes(texts,'ok',save,client,account)
    assert sent==texts and len(saved)==count


async def test_insufficient_credits_and_bad_audio_never_retry(monkeypatch):
    monkeypatch.setenv('ELEVENLABS_API_KEY','test')
    calls=[]
    async def account():
        return dict(ready=True,voices=[dict(id='ok')],remaining=1)
    async def save(i,data):
        pytest.fail('must not save bad audio')
    def handler(request):
        calls.append(request)
        return httpx.Response(200,json={})
    async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as client:
        with pytest.raises(ValueError,match='잔여 크레딧'):
            await generate_eleven_scenes(['확인해 보세요.']*4,'ok',save,client,account)
        assert not calls
        async def enough():
            return dict(ready=True,voices=[dict(id='ok')],remaining=1000)
        with pytest.raises(ValueError,match='음성 파일'):
            await generate_eleven_scenes(['확인해 보세요.']*4,'ok',save,client,enough)
        assert len(calls)==1


async def test_expanded_speech_limit_and_credit_check_use_actual_spoken_text(monkeypatch):
    monkeypatch.setenv('ELEVENLABS_API_KEY','test')
    caption='가격은 '+('88,888원, '*15)+'조건을 확인해요.'
    texts=[narration_text(caption)]*4
    assert len(caption)<=160<len(texts[0])
    remaining=len(caption)*4
    calls=[]
    async def account():
        return dict(ready=True,voices=[dict(id='ok')],remaining=remaining)
    def handler(request):
        calls.append(json.loads(request.content)['text'])
        return httpx.Response(200,content=b'audio',headers={'content-type':'audio/mpeg'})
    async def save(*args):
        pass
    async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as client:
        with pytest.raises(ValueError,match='잔여 크레딧'):
            await generate_eleven_scenes(texts,'ok',save,client,account)
        assert not calls
        remaining=sum(map(len,texts))
        await generate_eleven_scenes(texts,'ok',save,client,account)
    assert calls==texts
