import asyncio
import base64
import json
import os
import shutil
import struct
import subprocess
import tempfile
from pathlib import Path

from .config import ROOT
from .elevenlabs import generate_eleven_scenes
from .music import music_catalog, music_wav
from .narration import narration_text
from .timing import (narration_speed, fitted_speed, tempo_filter, scene_durations,
                     caption_timing, srt_subtitles, photo_motion_filter, CAPTION_BOX, js_round)


def ffmpeg_path():
    configured = os.getenv('FFMPEG_PATH')
    if configured:
        resolved = Path(configured).expanduser()
        if not resolved.is_absolute():
            resolved = ROOT/resolved
        if not resolved.is_file():
            raise ValueError('FFMPEG_PATH에 지정한 FFmpeg 파일을 찾지 못했어요.')
        return str(resolved)
    local = ROOT/'local-data/bin'/('ffmpeg.exe' if os.name=='nt' else 'ffmpeg')
    found = str(local) if local.is_file() else shutil.which('ffmpeg')
    if not found:
        raise ValueError('FFmpeg를 설치하거나 FFMPEG_PATH를 설정해 주세요.')
    return found


async def run(command, args, label='영상 변환 실패'):
    flags = subprocess.CREATE_NO_WINDOW if os.name=='nt' else 0
    process = await asyncio.create_subprocess_exec(str(command), *map(str,args), stdout=subprocess.DEVNULL, stderr=subprocess.PIPE, creationflags=flags)
    try:
        _, error = await asyncio.wait_for(process.communicate(),timeout=600)
    except BaseException:
        if process.returncode is None:
            process.kill()
        await process.wait()
        raise
    if process.returncode:
        # Do not expose subprocess arguments or user content in API errors.
        raise ValueError(label)


def wav_duration(data):
    rate, size, i = 0, 0, 12
    while i+8<=len(data):
        tag, length = data[i:i+4], struct.unpack_from('<I',data,i+4)[0]
        if tag==b'fmt ' and i+20<=len(data):
            rate=struct.unpack_from('<I',data,i+16)[0]
        if tag==b'data':
            size=length
        i+=8+length+length%2
    if not rate or not size:
        raise ValueError('음성 길이 확인 실패')
    return size/rate


async def render_video(frames, texts, voice, audio, tts, target, progress, motion_layers, caption_layers, client):
    speed, ffmpeg = narration_speed(tts.get('speed',1)), ffmpeg_path()
    narrations = [narration_text(text) for text in texts]
    renders = ROOT/'renders'
    renders.mkdir(exist_ok=True)
    # Only this unique task directory is ever cleaned; inputs and licensed music live outside it.
    with tempfile.TemporaryDirectory(prefix='render-',dir=renders) as temp:
        directory = Path(temp)
        def save_png(name, uri):
            (directory/name).write_bytes(base64.b64decode(uri.split(',')[1],validate=True))
        progress(8,'장면 이미지를 준비하고 있어요.')
        for i, frame in enumerate(frames):
            save_png(f'{i}.png',frame)
        for i, layer in enumerate(motion_layers):
            if layer:
                save_png(f'{i}-photo.png',layer)
        for i, pages in enumerate(caption_layers):
            for j, page in enumerate(pages):
                save_png(f'{i}-caption-{j}.png',page['dataUrl'])
        if voice and tts['provider']=='elevenlabs':
            progress(10,f'ElevenLabs 계정 확인 및 음성 생성 중 · 0/{len(texts)}장면 완료')
            async def save_audio(i, data):
                mp3=directory/f'{i}.mp3'
                mp3.write_bytes(data)
                await run(ffmpeg,['-y','-i',mp3,'-ar','24000','-ac','1','-c:a','pcm_s16le',directory/f'{i}.wav'])
                progress(js_round(10+30*(i+1)/len(texts)),f'ElevenLabs 음성 생성 중 · {i+1}/{len(texts)}장면 완료')
            await generate_eleven_scenes(narrations,tts.get('voiceId',''),save_audio,client)
        elif voice:
            progress(10,f'기본 한국어 음성을 생성하고 있어요 · {len(texts)}장면')
            speech_json=directory/'speech.json'
            speech_json.write_text(json.dumps(narrations,ensure_ascii=False),encoding='utf-8')
            await run('powershell.exe',['-NoProfile','-File',ROOT/'voice.ps1','-InputFile',speech_json,'-OutputDirectory',directory],'한국어 음성 합성 실패. 설치된 음성을 확인하세요.')
        effective, speech = speed, None
        def speech_file(i):
            return directory/f'{i}{"-speed" if effective!=1 else ""}.wav'
        if voice:
            for attempt in range(3):
                if effective!=1:
                    progress(42 if attempt else 40, f'60초 안에 맞추도록 더빙을 {effective:g}배로 자동 조정하고 있어요.' if attempt else f'더빙 속도 {effective:g}배를 적용하고 있어요.')
                    for i in range(len(texts)):
                        await run(ffmpeg,['-y','-i',directory/f'{i}.wav','-af',tempo_filter(effective),'-c:a','pcm_s16le',speech_file(i)])
                speech=[wav_duration(speech_file(i).read_bytes()) for i in range(len(texts))]
                fitted=fitted_speed(speech,effective)
                if fitted==effective or attempt==2:
                    break
                effective=fitted
        progress(44,'음성 길이에 맞춰 장면과 자막 시간을 계산하고 있어요.')
        durations=scene_durations(texts,speech,target)
        cues=[caption_timing(pages,durations[i],speech[i] if speech else durations[i]) for i,pages in enumerate(caption_layers)]
        duration, cuts = 0, []
        for i in range(len(frames)):
            progress(js_round(45+40*i/len(frames)),f'장면 {i+1}/{len(frames)} · 이미지·음성·자막 합성 중')
            seconds=durations[i]
            if i:
                cuts.append(duration)
            duration+=seconds
            moving=bool(motion_layers and motion_layers[i])
            pages=caption_layers[i] if caption_layers else []
            first_caption=2 if moving else 1
            filters=[f'[1:v]{photo_motion_filter(i,js_round(seconds*30))}[photo]','[0:v][photo]overlay=50:305:shortest=1[base]'] if moving else ['[0:v]null[base]']
            previous='base'
            for j in range(len(pages)):
                cue, next_label=cues[i][j], f'caption{j}'
                filters.append(f"[{previous}][{first_caption+j}:v]overlay={CAPTION_BOX['x']}:{CAPTION_BOX['y']}:shortest=1:enable='gte(t,{cue['start']-.000001:.6f})*lt(t,{cue['end']-.000001:.6f})'[{next_label}]")
                previous=next_label
            filters.append(f'[{previous}]scale=1080:1920,setsar=1[v]')
            args=['-y','-loop','1','-framerate','30','-i',directory/f'{i}.png']
            if moving:
                args+=['-loop','1','-framerate','30','-i',directory/f'{i}-photo.png']
            for j in range(len(pages)):
                args+=['-loop','1','-framerate','30','-i',directory/f'{i}-caption-{j}.png']
            if voice:
                args+=['-i',speech_file(i)]
            args+=['-filter_complex_threads','2','-filter_complex',';'.join(filters),'-map','[v]']
            if voice:
                args+=['-map',f'{first_caption+len(pages)}:a','-af','apad','-c:a','aac','-ar','48000']
            args+=['-t',str(seconds),'-r','30','-c:v','libx264','-threads','2','-preset','ultrafast','-pix_fmt','yuv420p',directory/f'{i}.mp4']
            await run(ffmpeg,args)
        progress(87,'장면들을 하나의 영상으로 연결하고 있어요.')
        (directory/'list.txt').write_text('\n'.join(f"file '{i}.mp4'" for i in range(len(frames))),encoding='utf-8')
        output=directory/'short.mp4'
        await run(ffmpeg,['-y','-f','concat','-safe','0','-i',directory/'list.txt','-c','copy','-movflags','+faststart',output])
        if audio['music']!='none' or audio['sfx']:
            progress(90,'배경음악과 효과음을 믹싱하고 있어요.')
            track=next((t for t in music_catalog() if t['id']==audio['music']),{})
            wav=await asyncio.to_thread(music_wav,duration,audio['volume'],audio['sfx'],cuts)
            (directory/'music.wav').write_bytes(wav)
            mixed=directory/'mixed.mp4'
            inputs=(['[0:a]'] if voice else [])+['[1:a]']+(['[bg]'] if track.get('file') else [])
            filter_text=(f"[2:a]volume={audio['volume']},afade=t=in:st=0:d=0.3,afade=t=out:st={max(0,duration-.7)}:d=0.7[bg];" if track.get('file') else '')+''.join(inputs)+f'amix=inputs={len(inputs)}:duration=longest:normalize=0,alimiter=limit=0.95:level=false[a]'
            args=['-y','-i',output,'-i',directory/'music.wav']
            if track.get('file'):
                args+=['-stream_loop','-1','-i',ROOT/track['file']]
            args+=['-filter_complex',filter_text,'-map','0:v','-map','[a]','-c:v','copy','-c:a','aac','-ar','48000','-t',str(duration),'-movflags','+faststart',mixed]
            await run(ffmpeg,args)
            output=mixed
        progress(97,'완성 영상과 다운로드 파일을 준비하고 있어요.')
        flat=[cue for scene in cues for cue in scene]
        subtitles=srt_subtitles([c['text'] for c in flat],[c['end']-c['start'] for c in flat]) if flat else srt_subtitles(texts,durations)
        return dict(video=output.read_bytes(),duration=duration,subtitles=subtitles,requestedSpeed=speed if voice else None,narrationSpeed=effective if voice else None)
