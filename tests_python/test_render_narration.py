import io
import json
import wave
from pathlib import Path

import pytest

import backend.render as rendering


@pytest.mark.parametrize('provider',['local','elevenlabs'])
async def test_both_tts_paths_read_numbers_but_captions_and_srt_keep_digits(monkeypatch,tmp_path,provider):
    monkeypatch.setattr(rendering,'ROOT',tmp_path)
    monkeypatch.setattr(rendering,'ffmpeg_path',lambda:'ffmpeg')
    captions=['가격은 166,400원이에요.','교재는 166,000원이에요.','6급 과정은 60일 동안 수강해요.','풀이 방법과 풀이 속도를 확인해요.']
    expected=['가격은 십육만육천사백원이에요.','교재는 십육만육천원이에요.','육급 과정은 육십일 동안 수강해요.','풀이 방법과 풀이 속도를 확인해요.']
    wav=io.BytesIO()
    with wave.open(wav,'wb') as audio:
        audio.setparams((1,2,24000,0,'NONE','not compressed'))
        audio.writeframes(bytes(48000))
    spoken=[]
    async def run(command,args,*labels):
        if command=='powershell.exe':
            values=json.loads(Path(args[args.index('-InputFile')+1]).read_text(encoding='utf-8'))
            spoken.extend(values)
            directory=Path(args[args.index('-OutputDirectory')+1])
            for i in range(len(values)):
                (directory/f'{i}.wav').write_bytes(wav.getvalue())
        else:
            output=Path(args[-1])
            output.write_bytes(wav.getvalue() if output.suffix=='.wav' else b'video')
    async def eleven(texts,voice_id,save_audio,client):
        spoken.extend(texts)
        for i in range(len(texts)):
            await save_audio(i,b'mp3')
    monkeypatch.setattr(rendering,'run',run)
    monkeypatch.setattr(rendering,'generate_eleven_scenes',eleven)
    png='data:image/png;base64,AQID'
    layers=[[dict(text=text,lines=[text],dataUrl=png)] for text in captions]
    result=await rendering.render_video([png]*4,captions,True,dict(music='none',sfx=False),
                                       dict(provider=provider,speed=1),30,lambda *args:None,[],layers,None)
    assert spoken==expected
    assert all(text in result['subtitles'] for text in captions)
    assert '십육만' not in result['subtitles']
    assert result['duration']==30
