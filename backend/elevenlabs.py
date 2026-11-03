import asyncio
import os
import re
from urllib.parse import quote

from .timing import finite
from .narration import MAX_NARRATION_LENGTH


async def eleven_request(client, endpoint, method='GET', payload=None):
    key = os.getenv('ELEVENLABS_API_KEY')
    if not key:
        raise ValueError('ElevenLabs API 키를 설정한 뒤 서버를 재시작해 주세요.')
    response = await client.request(method,'https://api.elevenlabs.io'+endpoint,headers={'xi-api-key':key},json=payload,timeout=45)
    if not response.is_success:
        raise ValueError(f'ElevenLabs 요청 실패 ({response.status_code}). 키 권한과 잔여 크레딧을 확인해 주세요. 자동 재시도하거나 다른 음성으로 대체하지 않습니다.')
    return response


def available_credits(subscription):
    limit, used = subscription.get('character_limit'), subscription.get('character_count')
    if not finite(limit) or not finite(used):
        raise ValueError('ElevenLabs 잔여 크레딧을 확인하지 못했습니다.')
    return max(0,limit-used)


async def eleven_options(client):
    if not os.getenv('ELEVENLABS_API_KEY'):
        return dict(ready=False,voices=[],notice='ElevenLabs 연결 전입니다. 기본 무료 음성을 사용할 수 있어요.')
    sub_response, data_response = await asyncio.gather(eleven_request(client,'/v1/user/subscription'),eleven_request(client,'/v2/voices?page_size=100'))
    sub, data = sub_response.json(), data_response.json()
    voices = [dict(id=v['voice_id'],name=v['name'],language=v.get('labels',{}).get('language','다국어')) for v in data.get('voices',[])
              if v.get('category') in ('premade','default','generated') and (not v.get('available_for_tiers') or sub.get('tier') in v['available_for_tiers'])]
    voices.sort(key=lambda v:not bool(re.search('ko|korean',v['language'],re.I)))
    return dict(ready=bool(voices),voices=voices,remaining=available_credits(sub),tier=sub.get('tier'),notice='한국어 지원 다국어 모델을 사용해요. 생성 시 계정 크레딧이 차감돼요.' if voices else '사용 가능한 기본 음성을 찾지 못했습니다. 기본 무료 음성을 선택해 주세요.')


async def generate_eleven_scenes(texts, voice_id, save_audio, client, options_loader=None):
    if not isinstance(texts,list) or not 4 <= len(texts) <= 6 or any(not isinstance(t,str) or not t.strip() or len(t)>MAX_NARRATION_LENGTH for t in texts):
        raise ValueError('음성 대본 4~6개를 확인하세요.')
    account = await options_loader() if options_loader else await eleven_options(client)
    if not account['ready'] or not any(v['id']==voice_id for v in account['voices']):
        raise ValueError('사용 가능한 ElevenLabs 음성을 선택해 주세요.')
    if account['remaining'] < sum(len(t) for t in texts):
        raise ValueError('ElevenLabs 잔여 크레딧이 부족합니다. 추가 결제 없이 기본 무료 음성을 사용해 주세요.')
    for i, text in enumerate(texts):
        response = await eleven_request(client,'/v1/text-to-speech/'+quote(voice_id,safe='')+'?output_format=mp3_44100_128','POST',dict(text=text,model_id='eleven_multilingual_v2',voice_settings=dict(stability=.5,similarity_boost=.75,style=0,use_speaker_boost=True)))
        if not response.headers.get('content-type','').startswith('audio/') or not response.content:
            raise ValueError('ElevenLabs가 음성 파일을 반환하지 않았습니다.')
        await save_audio(i,response.content)
