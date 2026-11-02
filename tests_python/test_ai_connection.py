import json
import os
import httpx
import pytest
from backend.ai import ai_connection,call_ai
from backend.config import ai_provider_status

@pytest.fixture(autouse=True)
def no_real_keys(monkeypatch):
    for name in ['OPENAI_API_KEY','NVIDIA_API_KEY','OPENAI_CREDITS_CONFIRMED','AI_FREE_TIER_CONFIRMED']:
        monkeypatch.delenv(name,raising=False)


def test_provider_key_isolation_and_no_persistence(monkeypatch):
    monkeypatch.setenv('NVIDIA_API_KEY','server-nvidia')
    monkeypatch.setenv('AI_FREE_TIER_CONFIRMED','true')
    assert ai_connection()[0]=='nvidia'
    with pytest.raises(ValueError,match='키를 입력'):
        ai_connection({'provider':'openai'})
    with pytest.raises(ValueError,match='크레딧'):
        ai_connection({'provider':'openai','apiKey':'temporary-key'})
    assert ai_connection({'provider':'openai','apiKey':'temporary-key','creditsConfirmed':True})[1]=='temporary-key'
    assert not os.getenv('OPENAI_API_KEY')
    status=json.dumps(ai_provider_status())
    assert 'server-nvidia' not in status and 'temporary-key' not in status


@pytest.mark.parametrize('settings',[[],{'provider':'gemini'},{'provider':'openai','apiKey':'key\nheader'}, {'provider':'openai','model':'https://bad.example?key=secret'}, {'provider':'nvidia','apiKey':True}])
def test_reject_invalid_connection(settings):
    with pytest.raises(ValueError):
        ai_connection(settings)


@pytest.mark.parametrize('status,body,expected',[
    (401,{'error':{'message':'sensitive key'}},'401'),
    (200,{'status':'incomplete','output':[]},'끝까지'),
    (200,{'status':'completed','output':[{'type':'message','content':[{'type':'refusal','refusal':'no'}]}]},'거절'),
    (200,{'status':'completed','output':[{'type':'message','content':[{'type':'output_text','text':'broken'}]}]},'JSON'),
])
async def test_openai_errors_are_safe_and_not_retried(status,body,expected):
    calls=[]
    def handler(request):
        calls.append(request)
        return httpx.Response(status,json=body)
    async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as client:
        with pytest.raises(ValueError,match=expected) as error:
            await call_ai(client,'content',{},[],{'provider':'openai','apiKey':'request-key','creditsConfirmed':True})
    assert len(calls)==1 and 'sensitive key' not in str(error.value)


async def test_explicit_provider_wins_over_other_server_key(monkeypatch):
    monkeypatch.setenv('NVIDIA_API_KEY','server-nvidia')
    monkeypatch.setenv('AI_FREE_TIER_CONFIRMED','true')
    def handler(request):
        assert request.url.host=='api.openai.com'
        assert request.headers['authorization']=='Bearer request-key'
        assert 'request-key' not in request.content.decode()
        return httpx.Response(200,json={'status':'completed','output':[{'type':'message','content':[{'type':'output_text','text':'{}'}]}]})
    async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as client:
        assert await call_ai(client,'prompt',{},[],{'provider':'openai','apiKey':'request-key','creditsConfirmed':True})=={}
