import copy
import json
import httpx
import pytest
from backend.ai import (plan_blog,call_ai,validate_plan_input,narration_style_issues,
                        normalize_endings,build_prompt,PROMPTS)

INPUT=dict(title='공부 방법',text='핵심 개념을 자신의 말로 설명하고 배운 내용을 다시 확인해 보세요.',sceneCount=6,duration=45,tone='shorts',speed=1.25,photos=[dict(id='1',dataUrl='data:image/png;base64,AQID')])


def draft(count=6):
    return dict(headline='개념을 내 것으로 만드는 방법',scenes=[dict(role='hook' if i==0 else 'cta' if i==count-1 else 'body',text='핵심 개념을 자신의 말로 설명해 보세요.',photoId='1',reason='학습 순서 이미지예요.') for i in range(count)],warnings=[])


@pytest.mark.parametrize('count',[4,5,6])
async def test_generated_shape_and_real_image_contract(count):
    async def generate(prompt,schema,images):
        assert schema['properties']['scenes']['minItems']==count
        assert images==INPUT['photos'] and '1.25배' in prompt
        return draft(count)
    result=await plan_blog(dict(INPUT,sceneCount=count),generate=generate)
    assert len(result['scenes'])==count


@pytest.mark.parametrize('change',[dict(sceneCount=3),dict(sceneCount=True),dict(duration=61),dict(tone='blog'),dict(speed=1.3),dict(text='짧음'),dict(photos=[dict(id='1',dataUrl='http://evil.example')])])
def test_bad_plan_inputs(change):
    with pytest.raises(ValueError):
        validate_plan_input(dict(INPUT,**change))


@pytest.mark.parametrize('tone',['education','review','marketing','shorts'])
async def test_tones_fewshot_and_ending_normalization(tone):
    calls=[]
    async def generate(prompt,schema,images):
        calls.append(prompt)
        assert ('가상 퓨샷 예시' in prompt)==(tone=='shorts')
        result=draft()
        result['scenes'][-1]['text']='모두 좋은 결과를 얻으시길 바랍니다.'
        return result
    result=await plan_blog(dict(INPUT,tone=tone),generate=generate)
    assert len(calls)==1
    assert result['scenes'][-1]['text']=='모두 좋은 결과를 얻으시길 바라요.'
    assert result['warnings']
    for example in PROMPTS['shortsExamples']:
        assert not narration_style_issues(example['texts'])
        assert all('원문' not in text and 10 <= len(text) <= 160 for text in example['texts'])


async def test_one_repair_progress_and_failure_limit():
    calls,events=[],[]
    async def generate(prompt,schema,images):
        calls.append(prompt)
        result=draft()
        result['scenes'][2]['text']='답안을 작성하고 내용을 점검하였다.' if len(calls)==1 else '답안을 작성하고 내용을 점검해 보세요.'
        return result
    await plan_blog(INPUT,generate=generate,progress=lambda p,l:events.append(p))
    assert len(calls)==2 and events==[10,25,75,85,95,98]
    assert '해요체 오류' in calls[1]
    assert calls[0] in calls[1]
    calls.clear()
    async def broken(prompt,schema,images):
        calls.append(prompt)
        result=draft()
        result['scenes'][2]['photoId']='unknown'
        return result
    with pytest.raises(ValueError,match='장면 3의 이미지 ID'):
        await plan_blog(INPUT,generate=broken)
    assert len(calls)==2
    async def failure(*args):
        raise ValueError('API 429')
    with pytest.raises(ValueError,match='429'):
        await plan_blog(INPUT,generate=failure)


async def test_text_only_and_role_normalization():
    async def generate(prompt,schema,images):
        result=draft()
        for s in result['scenes']:
            s['photoId']=''
            s['role']='cta'
        return result
    result=await plan_blog(dict(INPUT,photos=[]),generate=generate)
    assert [s['role'] for s in result['scenes']]==['hook','body','body','body','body','cta']


@pytest.mark.parametrize('provider',['nvidia','openai'])
async def test_provider_payload_and_no_retry(monkeypatch,provider):
    monkeypatch.setenv('AI_FREE_TIER_CONFIRMED','true')
    monkeypatch.delenv('NVIDIA_API_KEY',raising=False)
    monkeypatch.delenv('OPENAI_API_KEY',raising=False)
    monkeypatch.setenv('OPENAI_CREDITS_CONFIRMED','true')
    monkeypatch.setenv('NVIDIA_API_KEY' if provider=='nvidia' else 'OPENAI_API_KEY','test-key')
    def handler(request):
        payload=json.loads(request.content)
        if provider=='nvidia':
            assert payload['messages'][1]['content'][2]['image_url']['url']==INPUT['photos'][0]['dataUrl']
            return httpx.Response(200,json={'choices':[{'message':{'content':'{}'}}]})
        assert str(request.url)=='https://api.openai.com/v1/responses'
        assert request.headers['Authorization']=='Bearer test-key'
        assert payload['input'][0]['content'][2]['image_url']==INPUT['photos'][0]['dataUrl']
        assert payload['text']['format']['strict'] is True and payload['store'] is False
        return httpx.Response(200,json={'status':'completed','output':[{'type':'message','content':[{'type':'output_text','text':'{}'}]}]})
    async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as client:
        assert await call_ai(client,'test',{},INPUT['photos'])=={}


def test_narration_validation():
    for text in ['축제가 열렸다. 꽃을 볼 수 있어요.','축제가 열렸습니다.','핵심 개념 정리.','확인했어.']:
        assert narration_style_issues([text])
    assert not narration_style_issues(['2026년 10월 3일에 열렸어요. 중요하죠!'])
    assert normalize_endings('원문을 확인합니다. 교재가 있습니다!')=='원문을 확인해요. 교재가 있어요!'
    assert normalize_endings('확인합니다만 조건이 달라요.')=='확인합니다만 조건이 달라요.'


@pytest.mark.parametrize('tone',['education','review','marketing','shorts'])
@pytest.mark.parametrize('text',[
    '원문에서 강의 구성을 확인해 보세요.',
    '강의 구성을 살펴보세요. 자세한 조건은 원문에 나와 있어요.',
])
async def test_caption_wording_is_repaired_with_source_and_settings(tone,text):
    source=dict(INPUT,tone=tone,sceneCount=4,duration=30,speed=2,
                title='보고서 수업 안내',text='셀 입력이 가능한 학습자 대상이에요. 수강 기간은 30일이고 실습 파일은 별도 구매예요.')
    calls=[]
    async def generate(prompt,schema,images):
        calls.append(prompt)
        assert source['text'] in prompt and source['title'] in prompt
        assert '30초' in prompt and '4개 장면' in prompt and '2배' in prompt
        assert PROMPTS['tones'][tone] in prompt
        assert images==source['photos']
        assert schema['properties']['scenes']['minItems']==4
        result=draft(4)
        result['scenes'][-1]['text']=text if len(calls)==1 else '강의 구성과 실습 파일 구매 조건을 확인해 보세요.'
        result['scenes'][-1]['reason']='원문의 수업 안내 이미지예요.'
        result['warnings']=['원문에 가격은 없어 가격 안내를 생략했어요.']
        return result
    result=await plan_blog(source,generate=generate)
    assert len(calls)==2 and calls[0] in calls[1]
    assert "'원문'이라는 표현" in calls[1]
    assert all('원문' not in scene['text'] for scene in result['scenes'])
    assert result['scenes'][-1]['reason']=='원문의 수업 안내 이미지예요.'
    assert result['warnings']==['원문에 가격은 없어 가격 안내를 생략했어요.']


async def test_caption_wording_still_present_after_repair_is_rejected():
    calls=[]
    async def generate(prompt,schema,images):
        calls.append(prompt)
        result=draft()
        result['scenes'][0]['text']='원문을 읽고 핵심 내용을 확인해 보세요.'
        return result
    with pytest.raises(ValueError,match="장면 1의 자막·낭독에는 '원문'"):
        await plan_blog(INPUT,generate=generate)
    assert len(calls)==2


async def test_source_word_in_metadata_does_not_repair_or_rewrite_captions():
    expected=draft()
    expected['scenes'][0]['reason']='원문의 핵심 개념과 연결된 이미지예요.'
    expected['warnings']=['원문에 없는 기간은 생략했어요.']
    calls=[]
    async def generate(prompt,schema,images):
        calls.append(prompt)
        return copy.deepcopy(expected)
    assert await plan_blog(INPUT,generate=generate)==expected
    assert len(calls)==1
