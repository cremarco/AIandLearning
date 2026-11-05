"""Edit real Goblin Tools screen captures into short, captioned classroom clips.

Requires Pillow and FFmpeg (or imageio-ffmpeg). Source frames are private review
artifacts under output/review/goblin-captures; all tool responses are authentic.
"""
import argparse
import bisect
import hashlib
import json
import shutil
import subprocess
from pathlib import Path

from PIL import Image, ImageOps

ROOT = Path(__file__).resolve().parents[1]
WIDTH, HEIGHT, FPS = 1440, 900, 24


def compose(source, page_size):
    # Keep the complete captured document visible at one scale for the clip.
    # Padding accounts for document growth after the response, without zooms.
    page = Image.new('RGB', page_size, '#ffffff')
    page.paste(source, (0, 0))
    canvas = Image.new('RGB', (WIDTH, HEIGHT), '#ffffff')
    content = ImageOps.contain(page, (WIDTH, HEIGHT), Image.Resampling.LANCZOS)
    canvas.paste(content, ((WIDTH - content.width) // 2, 0))
    return canvas


def timestamp(seconds):
    milliseconds = round(seconds * 1000)
    return f'{milliseconds // 3600000:02}:{milliseconds // 60000 % 60:02}:{milliseconds // 1000 % 60:02}.{milliseconds % 1000:03}'


def render(demo, source_dir, destination, ffmpeg):
    capture_dir = source_dir / demo['key']
    capture = json.loads((capture_dir / 'capture.json').read_text())
    times = [frame['t'] for frame in capture['frames']]
    sizes = []
    for frame in capture['frames']:
        with Image.open(capture_dir / frame['file']) as opened:
            sizes.append(opened.size)
    page_size = (max(size[0] for size in sizes), max(size[1] for size in sizes))
    events = {event['name']: event['t'] for event in capture['events']}
    last = times[-1]
    if demo['key'] == 'taskmaster':
        segments = [(0, events['play'], 3, 'input'),
                    (events['play'], events['pause'], 4, 'action'),
                    (events['pause'], last, 3, 'result')]
    else:
        segments = [(0, events['submit'], 4, 'input'),
                    (events['submit'], events['result'], min(3, max(2, round(events['result'] - events['submit']))), 'action'),
                    (events['result'], last, 4, 'result')]
    segments.append((last, last, 6, 'review'))
    total = sum(segment[2] for segment in segments)
    output = destination / f"{demo['key']}.mp4"
    command = [ffmpeg, '-y', '-loglevel', 'error', '-f', 'rawvideo', '-pix_fmt', 'rgb24',
               '-s', f'{WIDTH}x{HEIGHT}', '-r', str(FPS), '-i', '-', '-an', '-c:v', 'libx264',
               '-preset', 'fast', '-crf', '21', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', str(output)]
    encoder = subprocess.Popen(command, stdin=subprocess.PIPE)
    elapsed, cues, poster, cached_file, source_image = 0, [], None, None, None
    try:
        for start, end, duration, phase in segments:
            caption = demo['captions'][phase]
            cues.append((elapsed, elapsed + duration, caption))
            for index in range(round(duration * FPS)):
                moment = start + (end - start) * index / max(1, round(duration * FPS) - 1)
                frame_index = max(0, bisect.bisect_right(times, moment) - 1)
                filename = capture_dir / capture['frames'][frame_index]['file']
                if filename != cached_file:
                    with Image.open(filename) as opened:
                        source_image = opened.convert('RGB')
                    cached_file = filename
                poster = compose(source_image, page_size)
                encoder.stdin.write(poster.tobytes())
            elapsed += duration
        encoder.stdin.close()
        if encoder.wait() != 0:
            raise RuntimeError(f'FFmpeg failed for {demo["key"]}')
    finally:
        if encoder.poll() is None:
            encoder.kill()
    poster.save(destination / f"{demo['key']}-poster.jpg", quality=92)
    vtt = 'WEBVTT\n\n' + '\n\n'.join(f'{timestamp(start)} --> {timestamp(end)}\n{text}' for start, end, text in cues) + '\n'
    (destination / f"{demo['key']}.en.vtt").write_text(vtt)
    readable_result = '\n'.join(line.rstrip() for line in demo['result'].splitlines())
    transcript = f"{demo['name']} — real execution, recorded 5 November 2026\n\nINPUT\n{demo['input']}\n\nACTUAL RESULT\n{readable_result}\n\n" + '\n'.join(f'{timestamp(start)} {text}' for start, _, text in cues) + '\n'
    (destination / f"{demo['key']}-transcript.txt").write_text(transcript)
    return {**demo, 'recordedAt': capture['startedAt'], 'captureSeconds': round(last, 3),
            'durationSeconds': round(total, 3), 'width': WIDTH, 'height': HEIGHT, 'fps': FPS,
            'fullPage': True, 'pageSize': list(page_size),
            'captureFrameCount': len(times), 'actions': capture['events'],
            'sha256': hashlib.sha256(output.read_bytes()).hexdigest()}


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--source', type=Path, default=ROOT / 'output/review/goblin-captures')
    parser.add_argument('--destination', type=Path, default=ROOT / 'public/materials/goblin')
    parser.add_argument('--ffmpeg', default=shutil.which('ffmpeg'))
    args = parser.parse_args()
    if not args.ffmpeg:
        import imageio_ffmpeg
        args.ffmpeg = imageio_ffmpeg.get_ffmpeg_exe()
    args.destination.mkdir(parents=True, exist_ok=True)
    demos = json.loads((ROOT / 'data/goblin-demos.json').read_text())
    rendered = []
    for demo in demos:
        record = render(demo, args.source, args.destination, args.ffmpeg)
        rendered.append(record)
        print(f"{demo['name']}: {record['durationSeconds']:.1f}s", flush=True)
    provenance = {'recorded': '2026-11-05', 'language': 'en-US', 'status': 'executed',
                  'captureMethod': 'Complete document screenshots from actual browser interactions at a 1440 × 900 viewport. The whole captured page stays visible at one scale per clip, without crops, zooms or overlays. Reading holds preserve the original site content. No reconstructed interface or synthetic results.',
                  'audio': 'None; optional WebVTT captions are provided.', 'clips': rendered}
    (args.destination / 'provenance.json').write_text(json.dumps(provenance, indent=2, ensure_ascii=False) + '\n')


if __name__ == '__main__':
    main()
