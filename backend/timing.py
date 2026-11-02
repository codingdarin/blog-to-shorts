import math
import re
import unicodedata
from datetime import datetime, timezone, timedelta
from urllib.parse import quote

SPEEDS = (1, 1.25, 1.5, 1.75, 2)
PNG = re.compile(r'data:image/png;base64,[A-Za-z0-9+/]+={0,2}\Z')
CAPTION_BOX = dict(x=0, y=973, width=720, height=150)


def js_round(value):
    return math.floor(value + .5)


def finite(value):
    return type(value) in (int, float) and math.isfinite(value)


def narration_speed(value=1):
    if not finite(value) or value not in SPEEDS:
        raise ValueError('더빙 속도는 1·1.25·1.5·1.75·2배 중에서 선택해 주세요.')
    return value


def narration_budget(duration, speed=1, count=6):
    narration_speed(speed)
    return dict(min=min(count*160, js_round(duration*5*speed)), max=min(count*160, js_round(duration*6*speed)))


def fitted_speed(seconds, current):
    if not seconds or any(not finite(s) or s <= 0 for s in seconds):
        raise ValueError('음성 길이를 확인하지 못했어요.')
    if sum(math.ceil((s+.35)*30) for s in seconds) <= 1800:
        return current
    available = 60-len(seconds)*(.35+1/30)-.25
    return math.ceil(current*sum(seconds)/available*100)/100


def tempo_filter(speed):
    if not finite(speed) or speed < 1:
        raise ValueError('더빙 속도를 확인해 주세요.')
    filters = []
    while speed > 2:
        filters.append('atempo=2')
        speed /= 2
    filters.append(f'atempo={speed:.6f}'.rstrip('0').rstrip('.'))
    return ','.join(filters)


def scene_durations(texts, speech=None, target=45):
    if not 4 <= len(texts) <= 6 or type(target) is not int or not 30 <= target <= 60:
        raise ValueError('4~6장면과 30~60초 길이를 확인해 주세요.')
    if speech is not None and (len(speech) != len(texts) or any(not finite(s) or s <= 0 for s in speech)):
        raise ValueError('음성 길이를 확인하지 못했어요.')
    minimum = [math.ceil((speech[i]+.35)*30) if speech else 1 for i in range(len(texts))]
    if sum(minimum) > 1800:
        raise ValueError('내레이션이 60초를 넘어요. 장면 문구를 줄인 뒤 다시 만들어 주세요.')
    total = max(target*30, sum(minimum))
    weights = [max(1, len(t)) for t in texts]
    frames = [n + math.floor((total-sum(minimum))*w/sum(weights)) for n, w in zip(minimum, weights)]
    frames[-1] += total-sum(frames)
    return [f/30 for f in frames]


def srt_subtitles(texts, durations):
    def stamp(seconds):
        ms = js_round(seconds*1000)
        return f'{ms//3600000:02}:{ms//60000%60:02}:{ms//1000%60:02},{ms%1000:03}'
    start, blocks = 0, []
    for i, (text, seconds) in enumerate(zip(texts, durations)):
        end = start + seconds
        blocks.append(f'{i+1}\n{stamp(start)} --> {stamp(end)}\n{text}\n')
        start = end
    return '\n'.join(blocks)


def caption_timing(pages, seconds, speech=None):
    frames = js_round(seconds*30)
    spoken = min(frames, max(len(pages), js_round((seconds if speech is None else speech)*30)))
    weights = [max(1, len(re.sub(r'\s', '', p['text']))) for p in pages]
    used, start, cues = 0, 0, []
    for i, (page, weight) in enumerate(zip(pages, weights)):
        used += weight
        end = frames if i == len(pages)-1 else max(start+1, min(spoken-(len(pages)-i-1), js_round(spoken*used/sum(weights))))
        cues.append(dict(text='\n'.join(page['lines']), start=start/30, end=end/30))
        start = end
    return cues


def validate_caption_layers(layers, texts):
    if not isinstance(layers, list) or len(layers) not in (0, len(texts)):
        raise ValueError('장면별 자막 구성을 확인해 주세요.')
    compact = lambda t: re.sub(r'\s', '', t)
    for i, pages in enumerate(layers):
        if not isinstance(pages, list) or not 1 <= len(pages) <= 80:
            raise ValueError('자막은 한 번에 1~2줄로 구성해 주세요.')
        for p in pages:
            if (not isinstance(p, dict) or not isinstance(p.get('text'), str) or not p['text'].strip() or len(p['text']) > 160
                or not isinstance(p.get('lines'), list) or not 1 <= len(p['lines']) <= 2
                or any(not isinstance(line, str) or not line.strip() or '\n' in line or '\r' in line for line in p['lines'])
                or compact(''.join(p['lines'])) != compact(p['text']) or not isinstance(p.get('dataUrl'), str) or not PNG.fullmatch(p['dataUrl'])):
                raise ValueError('자막은 한 번에 1~2줄로 구성해 주세요.')
        if compact(''.join(p['text'] for p in pages)) != compact(texts[i]):
            raise ValueError('자막 문구와 내레이션이 일치하지 않아요.')


def photo_motion_filter(index, frames):
    begin, end, a, b = [(1.06,1.42,.5,.5),(1.42,1.06,.5,.5),(1.38,1.38,0,1),(1.38,1.38,1,0)][index % 4]
    p = f'min(1,max(0,on-1)/{max(1,frames-1)})'
    t = f'(({p})*({p})*(3-2*({p})))'
    zoom, pan = f'({begin}+({end-begin})*{t})', f'({a}+({b-a})*{t})'
    left, top = f'(W-W/{zoom})*{pan}', f'(H-H/{zoom})/2'
    return f"format=gbrp,perspective=x0='{left}':y0='{top}':x1='{left}+W/{zoom}':y1='{top}':x2='{left}':y2='{top}+H/{zoom}':x3='{left}+W/{zoom}':y3='{top}+H/{zoom}':sense=source:eval=frame:interpolation=cubic"


def video_filename(title, date=None):
    date = (date or datetime.now(timezone.utc)).astimezone(timezone(timedelta(hours=9)))
    clean = re.sub(r'[<>:"/\\|?*\x00-\x1f\x7f]', ' ', unicodedata.normalize('NFC', title if isinstance(title, str) else ''))
    clean = re.sub(r'\s+', ' ', clean).strip()[:80].rstrip('. ') or '블로그투쇼츠'
    return f'{date:%y%m%d}_{clean}.mp4'


def video_disposition(filename):
    return f'attachment; filename="{filename[:6]}_shorts.mp4"; filename*=UTF-8\'\'{quote(filename, safe="")}'
