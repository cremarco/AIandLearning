"""Encode real browser screencasts: prompt, send, accelerated generation, live use.

The source is Page.screencastFrame PNGs with browser timestamps, collected via
the documented cua_repl CDP capability. No interface or interaction is recreated.
"""
import argparse
import hashlib
import json
from pathlib import Path
import shutil
import subprocess
from datetime import datetime
from zoneinfo import ZoneInfo

from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
PREFIX = 'materials/chatgpt-widgets/scenarios'


def read(p):
    return json.loads(p.read_text())


def write(p, value):
    p.write_text(json.dumps(value, ensure_ascii=False, indent=2) + '\n')


def stamp(seconds):
    n = round(seconds * 1000)
    return f'{n // 3600000:02}:{n // 60000 % 60:02}:{n // 1000 % 60:02}.{n % 1000:03}'


def render(capture, source, destination, ffmpeg):
    key = capture['key']
    assert capture['complete'] and capture['actions'], f'{key}: missing completed usage'
    assert not capture.get('truncated'), f'{key}: screencast buffer lost frames'
    phases = capture['phases']
    assert [p['name'] for p in phases] == ['typing', 'send', 'generation', 'widget', 'usage'], f'{key}: incomplete scenario'
    assert capture['evidence'].get('responseId'), f'{key}: missing response provenance'
    phases = [dict(p) for p in phases]
    phases[0]['at'] = 0
    for i, phase in enumerate(phases):
        phase['end'] = phases[i + 1]['at'] if i + 1 < len(phases) else capture['durationMs']
        if phase['name'] == 'typing':
            phase['speed'] = max(1, (phase['end'] - phase['at']) / 3500)
        elif phase['name'] == 'generation':
            phase['speed'] = max(8, (phase['end'] - phase['at']) / 5500)
        else:
            assert phase['speed'] == 1, 'Widget and usage must remain at normal speed'
    position = 0
    for phase in phases:
        phase['seconds'] = position
        position += (phase['end'] - phase['at']) / phase['speed'] / 1000
    raw_duration = position

    def raw_warp(ms):
        for phase in phases:
            if ms < phase['end']:
                return phase['seconds'] + max(0, ms - phase['at']) / phase['speed'] / 1000
        return raw_duration

    frames = capture['frames']
    # Trim pauses between capture calls (and failed selector recovery). Active
    # demonstrations keep native timing; a reading hold remains before each cut.
    cuts = [(a['at'] + 2500, b['at']) for a, b in zip(frames, frames[1:])
            if b['at'] - a['at'] > 6000]

    def warp(ms):
        removed = sum(max(0, raw_warp(min(ms, end)) - raw_warp(start))
                      for start, end in cuts if ms > start)
        return raw_warp(ms) - removed

    duration = warp(capture['durationMs'])
    # Keep raw starts for raw_warp; publish the edited starts separately.
    edited_starts = [warp(p['at']) for p in phases]
    work = source / key / 'encode'
    work.mkdir(exist_ok=True)
    concat = []
    for i, frame in enumerate(frames):
        image_path = source / key / frame['file']
        assert Image.open(image_path).size == (2880, 1600), f'{key}: expected Retina 1440×800 capture'
        start = warp(frame['at'])
        end = warp(frames[i + 1]['at']) if i + 1 < len(frames) else duration
        if end <= start:
            continue
        concat += [f"file '{image_path.as_posix()}'", 'option framerate 60', f'duration {end - start:.6f}']
    concat += [f"file '{(source / key / frames[-1]['file']).as_posix()}'", 'option framerate 60']
    listing = work / 'frames.ffconcat'
    listing.write_text('ffconcat version 1.0\n' + '\n'.join(concat) + '\n')
    send = next(p for p in phases if p['name'] == 'send')
    generation = next(p for p in phases if p['name'] == 'generation')
    # Reframe the composer while writing; retain the conversation column during
    # generation and use. Both views are native 1920×1200 crops, with no upscaling.
    crop = f"crop=1920:1200:532:if(lt(t\\,{warp(generation['at']):.6f})\\,400\\,120),fps=60"
    output = destination / f'{key}.mp4'
    subprocess.run([ffmpeg, '-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', str(listing),
                    '-t', f'{duration:.6f}', '-vf', crop, '-an', '-c:v', 'libx264', '-preset', 'fast',
                    '-crf', '14', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', '-threads', '4', str(output)], check=True)
    # A completed long response can begin below the viewport. Choose the first
    # demonstrated control after its genuine UI scroll, rather than a stale view
    # of the previous response at the beginning of the result-reading hold.
    poster_at = capture['actions'][-1]['at'] + 1200
    poster_frame = next((f for f in frames if f['at'] >= poster_at), frames[-1])
    Image.open(source / key / poster_frame['file']).convert('RGB').crop((532, 120, 2452, 1320)).save(destination / f'{key}-poster.jpg', quality=98, subsampling=0)
    cues = []
    for i, phase in enumerate(phases):
        start = edited_starts[i]
        end = edited_starts[i + 1] if i + 1 < len(phases) else duration
        label = phase['caption']
        if phase['name'] == 'typing':
            label = 'Write the prompt · fast typing.'
        if phase['name'] == 'generation':
            label = 'ChatGPT processes the prompt and builds the widget · accelerated.'
        if phase['name'] != 'usage':
            cues.append((start, end, label))
    for i, action in enumerate(capture['actions']):
        end = warp(capture['actions'][i + 1]['at']) if i + 1 < len(capture['actions']) else duration
        cues.append((warp(action['at']), end, action['label']))
    (destination / f'{key}.en.vtt').write_text('WEBVTT\n\n' + '\n\n'.join(f'{stamp(a)} --> {stamp(b)}\n{t}' for a, b, t in cues if b > a) + '\n')
    transcript = (f"{capture['command']} — prompt, generation and widget use\n\nPROMPT\n{capture['prompt']}\n\n"
                  + '\n'.join(f'{stamp(a)} {t}' for a, _, t in cues)
                  + '\n\nOBSERVED RESULT AFTER USE\n' + capture['evidence']['text'] + '\n')
    (destination / f'{key}-transcript.txt').write_text('\n'.join(line.rstrip() for line in transcript.splitlines()) + '\n')
    clip = {'command': capture['command'], 'type': 'video', 'src': f'{PREFIX}/{key}.mp4',
            'poster': f'{PREFIX}/{key}-poster.jpg', 'captions': f'{PREFIX}/{key}.en.vtt', 'captionsDefault': False,
            'alt': f"Real ChatGPT {capture['command']} execution: fast prompt entry, sending, accelerated generation and normal-speed widget use.",
            'caption': 'Prompt → send → generation (accelerated) → widget use (normal speed)',
            'prompt': capture['prompt'], 'source': capture['conversationUrl'], 'transcript': transcript,
            'transcriptFile': f'{PREFIX}/{key}-transcript.txt', 'durationSeconds': round(duration, 3),
            'width': 1920, 'height': 1200, 'fps': 60, 'sha256': hashlib.sha256(output.read_bytes()).hexdigest(),
            'recordedOn': datetime.fromisoformat(capture['startedAt'].replace('Z', '+00:00')).astimezone(ZoneInfo('Europe/Rome')).date().isoformat(),
            'chapters': [{'label': {'typing': 'Prompt', 'send': 'Send', 'generation': 'Generation', 'widget': 'Widget', 'usage': 'Use'}[p['name']], 'seconds': round(s, 3)} for p, s in zip(phases, edited_starts)]}
    provenance = {**{k: v for k, v in clip.items() if k != 'transcript'},
                  'capture': {'startedAt': capture['startedAt'], 'responseId': capture['evidence']['responseId'], 'responseComplete': True,
                              'rawDimensions': [2880, 1600], 'sourceFrames': len(frames),
                              'phases': phases, 'idleCutsMilliseconds': cuts,
                              'actions': [{k: v for k, v in a.items() if k != 'state'} for a in capture['actions']],
                              'frames': [{'at': f['at'], 'sha256': hashlib.sha256((source / key / f['file']).read_bytes()).hexdigest()} for f in frames]}}
    write(destination / f'{key}-provenance.json', provenance)
    print(f"{key}: {duration:.1f}s · 1920×1200 · 60fps · {len(capture['actions'])} actions", flush=True)
    return clip, provenance


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--source', type=Path, default=ROOT / 'output/review/chatgpt-full-captures')
    parser.add_argument('--only', nargs='*')
    parser.add_argument('--publish', action='store_true')
    args = parser.parse_args()
    destination = ROOT / 'public' / PREFIX
    destination.mkdir(parents=True, exist_ok=True)
    files = sorted(args.source.glob('*/capture.json'))
    records = [read(p) for p in files if not args.only or p.parent.name in args.only]
    clips = []
    for record in records:
        if record['complete']:
            clips.append(render(record, args.source, destination, shutil.which('ffmpeg')))
    if not args.publish:
        return
    previous = read(ROOT / 'data/demos/chatgpt-videos.json')
    new = {c['command'].lower(): (c, p) for c, p in clips}
    assert len(new) == len(previous['clips']) == 30, 'Publish only the complete set of 30 new recordings'
    ordered = [new[c['command'].lower()] for c in previous['clips']]
    recorded_on = max(c['recordedOn'] for c, _ in ordered)
    write(ROOT / 'data/demos/chatgpt-videos.json', {'recordedOn': recorded_on, 'clips': [c for c, _ in ordered]})
    old_provenance = read(ROOT / 'public/materials/chatgpt-widgets/videos/provenance.json')
    provenance = {'recordedOn': recorded_on, 'status': 'executed', 'audio': False,
                  'method': 'Native Retina PNG browser screencast events with original timestamps. Real fast prompt entry, send, accelerated ChatGPT processing and widget generation, followed by real widget use at original speed. Native 1920×1200 crops; no upscaling or reconstructed interface; 60 fps H.264 CRF 14. Generation waits shortened; all usage retains source timing.',
                  'book': old_provenance['book'], 'clips': [p for _, p in ordered]}
    write(destination / 'provenance.json', provenance)
    write(ROOT / 'public/materials/chatgpt-widgets/videos/provenance.json', provenance)
    media = read(ROOT / 'data/content/media.json')
    media['S53EX3'] = new['/flashcard'][0]
    write(ROOT / 'data/content/media.json', media)
    slides = read(ROOT / 'data/content/workshop-slides.json')
    for slide in slides:
        command = slide.get('title', '').split(' ')[0].lower()
        if slide.get('kind') == 'shortcut-detail' and command in new:
            clip = new[command][0]
            slide.update(prompt=clip['prompt'], media=clip, result=clip['caption'],
                         body=['Recorded prompt, generation and normal-speed use of the working controls.'])
            if not any(link['url'] == clip['source'] for link in slide.get('links', [])):
                slide.setdefault('links', []).append({'label': 'Recorded conversation', 'url': clip['source']})
        if slide['id'] == 'S53EX3':
            slide['prompt'] = new['/flashcard'][0]['prompt']
            slide['message'] = 'Attached chapter · Recall before checking the answer'
        if slide['id'] == 'S53WIDGETWORKSHEET':
            slide['media'] = new['/worksheet'][0]
            slide['prompt'] = new['/worksheet'][0]['prompt']
    write(ROOT / 'data/content/workshop-slides.json', slides)


if __name__ == '__main__':
    main()
