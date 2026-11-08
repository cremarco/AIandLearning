"""Encode genuine @Browser screencasts of the workshop's teacher tools.

Uses browser-screencast.mjs capture.json files. Navigation, inputs, generation,
review and feedback remain chronological; only idle gaps and explicitly marked
processing phases are shortened. Never reconstructs the interface or outputs.
"""
import argparse
import hashlib
import json
import shutil
import subprocess
from datetime import datetime
from pathlib import Path
from zoneinfo import ZoneInfo

from PIL import Image, ImageOps

ROOT = Path(__file__).resolve().parents[2]
WIDTH, HEIGHT, FPS = 1440, 900, 30


def read(file):
    return json.loads(file.read_text())


def write(file, value):
    file.write_text(json.dumps(value, ensure_ascii=False, indent=2) + '\n')


def sha(file):
    return hashlib.sha256(file.read_bytes()).hexdigest()


def stamp(seconds):
    ms = round(seconds * 1000)
    return f'{ms // 3600000:02}:{ms // 60000 % 60:02}:{ms // 1000 % 60:02}.{ms % 1000:03}'


def fitted(file):
    with Image.open(file) as image:
        content = ImageOps.contain(image.convert('RGB'), (WIDTH, HEIGHT), Image.Resampling.LANCZOS)
    canvas = Image.new('RGB', (WIDTH, HEIGHT), '#111114')
    canvas.paste(content, ((WIDTH - content.width) // 2, (HEIGHT - content.height) // 2))
    return canvas


def render(capture, source, destination):
    key = capture['key']
    evidence = capture.get('evidence', {})
    assert capture['complete'] and evidence.get('observed'), f'{key}: finish and inspect the recording'
    assert capture['actions'] and len(capture['frames']) >= 12, f'{key}: genuine consecutive source frames required'
    assert not capture.get('truncated'), f'{key}: lost source frames'
    phases = [dict(p) for p in capture['phases']]
    phases[0]['at'] = 0
    for n, phase in enumerate(phases):
        phase['end'] = phases[n + 1]['at'] if n + 1 < len(phases) else capture['durationMs']
        processing = 'generation' in phase['name']
        assert phase['speed'] == 1 or processing, 'Never accelerate review or control usage'
        if processing:
            phase['speed'] = max(1, (phase['end'] - phase['at']) / 5000)
    frames = capture['frames']
    raw_cuts = [(a['at'] + 2500, b['at']) for a, b in zip(frames, frames[1:]) if b['at'] - a['at'] > 8000]
    omitted_ranges = capture.get('editing', {}).get('omittedRanges', [])
    raw_cuts.extend((item['start'], item['end']) for item in omitted_ranges)
    cuts = []
    for start, end in sorted(raw_cuts):
        assert 0 <= start < end <= capture['durationMs']
        if cuts and start <= cuts[-1][1]:
            cuts[-1] = (cuts[-1][0], max(cuts[-1][1], end))
        else:
            cuts.append((start, end))

    def raw_warp(ms):
        elapsed = 0
        for phase in phases:
            if ms <= phase['end']:
                return elapsed + max(0, ms - phase['at']) / phase['speed'] / 1000
            elapsed += (phase['end'] - phase['at']) / phase['speed'] / 1000
        return elapsed

    def warp(ms):
        return raw_warp(ms) - sum(max(0, raw_warp(min(ms, end)) - raw_warp(start)) for start, end in cuts if ms > start)

    duration = warp(capture['durationMs'])
    assert duration > 8, f'{key}: recording too short to show an actual workflow'
    encode = source / 'encode'
    encode.mkdir(exist_ok=True)
    concat, frame_records = [], []
    for n, frame in enumerate(frames):
        file = source / frame['file']
        start = warp(frame['at'])
        end = warp(frames[n + 1]['at']) if n + 1 < len(frames) else duration
        if end <= start:
            continue
        with Image.open(file) as image:
            size = list(image.size)
        frame_duration = end - start + (start if n == 0 else 0)
        concat += [f"file '{file.as_posix()}'", f'option framerate {FPS}', f'duration {frame_duration:.6f}']
        frame_records.append({'at': frame['at'], 'sha256': sha(file), 'sourceSize': size})
    concat += [f"file '{(source / frames[-1]['file']).as_posix()}'", f'option framerate {FPS}']
    listing = encode / 'frames.ffconcat'
    listing.write_text('ffconcat version 1.0\n' + '\n'.join(concat) + '\n')
    video = destination / f'{key}.mp4'
    ffmpeg = shutil.which('ffmpeg')
    if not ffmpeg:
        import imageio_ffmpeg
        ffmpeg = imageio_ffmpeg.get_ffmpeg_exe()
    subprocess.run([ffmpeg, '-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', str(listing),
                    '-t', f'{duration:.6f}', '-vf', f'scale={WIDTH}:{HEIGHT}:force_original_aspect_ratio=decrease:flags=lanczos,pad={WIDTH}:{HEIGHT}:(ow-iw)/2:(oh-ih)/2:color=0x111114,fps={FPS}',
                    '-an', '-c:v', 'libx264', '-crf', '16', '-preset', 'fast', '-pix_fmt', 'yuv420p',
                    '-movflags', '+faststart', '-threads', '4', str(video)], check=True)
    poster_time = capture.get('posterAt', frames[-1]['at'])
    poster_frame = min(frames, key=lambda frame: abs(frame['at'] - poster_time))
    fitted(source / poster_frame['file']).save(destination / f'{key}-poster.jpg', quality=96, subsampling=0)
    cues = [(warp(p['at']), warp(p['end']), p['caption']) for p in phases if warp(p['end']) - warp(p['at']) >= .1]
    (destination / f'{key}.en.vtt').write_text('WEBVTT\n\n' + '\n\n'.join(f'{stamp(a)} --> {stamp(b)}\n{caption}' for a, b, caption in cues) + '\n')
    transcript = (f"{capture['service']} — {capture['name']}\n\nRECORDED TASK\n{capture['prompt']}\n\n"
                  'METHOD\nActual @Browser interface actions. Silent recording, optional English captions. '
                  'Source proportions and complete viewport preserved. Idle gaps, loading screens and marked processing waits shortened.\n\n'
                  + '\n'.join(f'{stamp(a)} {caption}' for a, _, caption in cues)
                  + f"\n\nOBSERVED RESULT\n{evidence['observed']}\n\nSCOPE AND LIMITATIONS\n{evidence.get('scope', '')}\n\n"
                  + 'RECORDED OUTPUT / RESPONSE EVIDENCE\n' + evidence.get('text', '') + '\n')
    (destination / f'{key}-transcript.txt').write_text(transcript)
    prefix = f'materials/teacher-tools/{key}'
    return {'key': key, 'service': capture['service'], 'name': capture['name'], 'slideId': capture['slideId'],
            'relatedSlideId': capture.get('relatedSlideId', capture['slideId']),
            'status': 'executed', 'browser': '@Browser', 'recordedAt': capture['startedAt'],
            'recordedOn': datetime.fromisoformat(capture['startedAt'].replace('Z', '+00:00')).astimezone(ZoneInfo('Europe/Rome')).date().isoformat(),
            'sourceUrl': capture.get('sourceUrl', capture['conversationUrl']), 'durationSeconds': round(duration, 3),
            'width': WIDTH, 'height': HEIGHT, 'fps': FPS, 'audio': False, 'src': prefix + '.mp4',
            'poster': prefix + '-poster.jpg', 'captions': prefix + '.en.vtt', 'transcriptFile': prefix + '-transcript.txt',
            'videoSha256': sha(video), 'posterSha256': sha(destination / f'{key}-poster.jpg'),
            'captureFrameCount': len(frames), 'sourceFrames': frame_records,
            'editing': {'idleGapThresholdMs': 8000, 'retainedIdleHoldMs': 2500, 'omittedRanges': omitted_ranges},
            'phases': [{**p, 'seconds': round(warp(p['at']), 3), 'durationSeconds': round(warp(p['end']) - warp(p['at']), 3)} for p in phases],
            'actions': [{k: v for k, v in action.items() if k != 'state'} for action in capture['actions']],
            'prompt': capture['prompt'], 'observed': evidence['observed'], 'scope': evidence.get('scope', ''),
            'checks': evidence.get('checks', []), 'plan': capture.get('plan', 'Account plan not established')}


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--source', type=Path, default=ROOT / 'output/review/teacher-tool-captures')
    parser.add_argument('--only', nargs='*')
    args = parser.parse_args()
    destination = ROOT / 'public/materials/teacher-tools'
    destination.mkdir(parents=True, exist_ok=True)
    manifest_file = destination / 'provenance.json'
    manifest = read(manifest_file) if manifest_file.exists() else {
        'method': 'Actual @Browser screencasts. No reconstructed interface or synthetic outputs. Silent videos with optional English captions. '
                  'Whole source viewport fitted proportionally to 1440x900; generation waits and idle gaps shortened, review stays at normal speed.',
        'sourceBook': {'path': 'materials/booklet-genai/Fondamenti_GenAI_Cremaschi.pdf',
                       'sha256': sha(ROOT / 'public/materials/booklet-genai/Fondamenti_GenAI_Cremaschi.pdf')},
        'learnerData': 'Only authored fictional workshop examples. No actual student records or classroom assignment.', 'clips': []}
    clips = {clip['key']: clip for clip in manifest['clips']}
    files = sorted(args.source.glob('*/capture.json'))
    if args.only:
        files = [file for file in files if file.parent.name in args.only]
    assert files, 'No selected recordings'
    for file in files:
        capture = read(file)
        clip = render(capture, file.parent, destination)
        clips[clip['key']] = {**clips.get(clip['key'], {}), **clip}
        print(f"{clip['key']}: {clip['durationSeconds']} seconds, {clip['captureFrameCount']} genuine frames", flush=True)
    manifest['clips'] = list(clips.values())
    write(manifest_file, manifest)
    media_file = ROOT / 'data/content/media.json'
    media = read(media_file)
    for clip in manifest['clips']:
        if clip['slideId'] and clip['slideId'] in media:
            media[clip['slideId']].update(
                src=clip['src'], poster=clip['poster'], captions=clip['captions'],
                caption=f"{'Paid Teacher trial · ' if clip['service'] == 'Formative' else ''}Recorded example · {round(clip['durationSeconds'])} s",
                transcript=(ROOT / 'public' / clip['transcriptFile']).read_text())
    write(media_file, media)


if __name__ == '__main__':
    main()
