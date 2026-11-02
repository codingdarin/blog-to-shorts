import hashlib
import json
import subprocess
from datetime import datetime
from pathlib import Path

import pytest

from backend.timing import *
from backend.render import ffmpeg_path, wav_duration
from backend.music import music_wav

FIXTURE=json.loads((Path(__file__).parent/'fixtures/node-parity.json').read_text(encoding='utf-8'))


@pytest.mark.parametrize('case',FIXTURE['cases'])
def test_node_timing_and_srt_parity(case):
    durations=scene_durations(case['texts'],case['speech'],case['target'])
    assert durations==case['duration']
    assert srt_subtitles(case['texts'],durations)==case['srt']


def test_node_caption_filename_and_autofit_parity():
    f=FIXTURE
    assert caption_timing(f['pages'],12,8)==f['cues']
    assert fitted_speed(f['fit']['seconds'],f['fit']['speed'])==f['fit']['result']
    assert tempo_filter(4.3)==f['tempo']
    assert narration_budget(45,1.25,6)==f['budget']
    assert video_filename(f['title'],datetime.fromisoformat(f['date']))==f['filename']
    assert video_disposition(f['filename'])==f['disposition']
    assert video_filename('  /:*? ',datetime.fromisoformat(f['date'])).endswith('_블로그투쇼츠.mp4')


def test_sound_effect_bytes_match_node():
    wav=music_wav(1,.12,True,[.3,.7])
    assert hashlib.sha256(wav).hexdigest()==FIXTURE['musicHash']
    assert wav_duration(wav)==1


@pytest.mark.parametrize('index',range(4))
def test_real_ffmpeg_motion_matches_node_frames(index):
    r=subprocess.run([ffmpeg_path(),'-v','error','-filter_threads','1','-f','lavfi','-i','color=c=black:s=160x160:r=30,drawbox=x=70:y=60:w=6:h=6:color=white:t=fill','-vf',photo_motion_filter(index,60)+',format=gray','-frames:v','60','-f','rawvideo','pipe:1'],capture_output=True,check=True)
    assert hashlib.sha256(r.stdout).hexdigest()==FIXTURE['motionHashes'][index]


@pytest.mark.parametrize('speed',[None,True,'1',1.3,0,-1])
def test_invalid_speeds(speed):
    with pytest.raises(ValueError):
        narration_speed(speed)


def test_caption_validation_preserves_manual_lines():
    pages=[dict(p,dataUrl='data:image/png;base64,AQID') for p in FIXTURE['pages']]
    text=' '.join(p['text'] for p in pages)
    validate_caption_layers([pages],[text])
    for changed in [pages[1:],[dict(pages[0],lines=['하나','둘','셋'])],[dict(pages[0],dataUrl='https://example.com')]]:
        with pytest.raises(ValueError):
            validate_caption_layers([changed],[text])
    with pytest.raises(ValueError):
        scene_durations(['문구예요.']*6,[11]*6,45)
