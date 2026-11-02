import io
import json
import math
import struct
import wave

from .config import ROOT
from .timing import finite, js_round

LICENSED_TRACKS = json.loads((ROOT/'backend/music.json').read_text(encoding='utf-8'))


def music_catalog():
    return [t for t in LICENSED_TRACKS if (ROOT/t['file']).is_file() and (ROOT/t['preview']).is_file()] + [dict(id='none',name='브금 없음',credit='',license='')]


def default_music_id():
    return 'salsa-new-york' if any(t['id']=='salsa-new-york' for t in music_catalog()) else 'none'


def music_wav(duration, volume=.12, sfx=False, cuts=()):
    if not finite(volume) or not 0 <= volume <= .5:
        raise ValueError('브금 음량 범위를 확인하세요.')
    rate, seed = 24000, 12345
    count = math.ceil(duration*rate)
    data = bytearray(count*2)
    if sfx:
        # Iterate only the short effect windows, preserving the previous noise sequence.
        for i in range(count):
            t, sample = i/rate, 0
            for cut in cuts:
                dt=t-cut
                if 0 <= dt < .16:
                    seed=(1664525*seed+1013904223)&0xffffffff
                    sample += (seed/4294967296*2-1)*.045*math.sin(math.pi*dt/.16)**2
            struct.pack_into('<h',data,i*2,js_round(max(-1,min(1,sample))*32767))
    output=io.BytesIO()
    with wave.open(output,'wb') as wav:
        wav.setnchannels(1)
        wav.setsampwidth(2)
        wav.setframerate(rate)
        wav.writeframes(data)
    return output.getvalue()
