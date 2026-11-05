"""Make classroom videos from real, cropped ChatGPT interaction captures.

The original screenshots stay in output/. No interface or answer is reconstructed.
Requires Pillow and FFmpeg, or imageio-ffmpeg (set PYTHONPATH if installed locally).
"""
import argparse
from concurrent.futures import ThreadPoolExecutor
import hashlib
import json
from pathlib import Path
import shutil
import subprocess

from PIL import Image

ROOT = Path(__file__).resolve().parents[2]


def timestamp(seconds):
    milliseconds = round(seconds * 1000)
    return f'{milliseconds // 3600000:02}:{milliseconds // 60000 % 60:02}:{milliseconds // 1000 % 60:02}.{milliseconds % 1000:03}'


def render(record, source, destination, ffmpeg):
    frames = record['frames']
    width = max(frame['crop']['width'] for frame in frames)
    height = max(frame['crop']['height'] for frame in frames)
    width += width % 2
    height += height % 2
    work = source / record['key'] / 'edited'
    work.mkdir(exist_ok=True)
    images, cues, elapsed = [], [], 0
    for index, frame in enumerate(frames):
        box = frame['crop']
        with Image.open(source / record['key'] / frame['file']) as screenshot:
            content = screenshot.convert('RGB').crop((box['x'], box['y'], box['x'] + box['width'], box['y'] + box['height']))
        canvas = Image.new('RGB', (width, height), '#111111')
        canvas.paste(content, ((width - content.width) // 2, 0))
        filename = work / f'{index:02}.png'
        canvas.save(filename)
        images.append(canvas)
        duration = 6 if index == len(frames) - 1 else 4
        cues.append((elapsed, elapsed + duration, frame['caption']))
        elapsed += duration
    concat = work / 'frames.txt'
    concat.write_text(''.join(f"file '{(work / f'{index:02}.png').as_posix()}'\nduration {end - start}\n" for index, (start, end, _) in enumerate(cues)) + f"file '{(work / f'{len(frames) - 1:02}.png').as_posix()}'\n")
    output = destination / f"{record['key']}.mp4"
    subprocess.run([ffmpeg, '-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', str(concat),
                    '-t', str(elapsed), '-vf', 'fps=24', '-an', '-c:v', 'libx264', '-preset', 'fast',
                    '-crf', '20', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', str(output)], check=True)
    poster_index = len(frames) - 2 if record['key'] in ('quiz', 'quizgame') else len(frames) - 1
    images[poster_index].save(destination / f"{record['key']}-poster.jpg", quality=94)
    vtt = 'WEBVTT\n\n' + '\n\n'.join(f'{timestamp(start)} --> {timestamp(end)}\n{caption}' for start, end, caption in cues) + '\n'
    (destination / f"{record['key']}.en.vtt").write_text(vtt)
    prompt = record.get('prompt', '')
    transcript = f"/{record['key']} — actual ChatGPT interaction\n\nPROMPT\n{prompt}\n\n" + '\n'.join(f'{timestamp(start)} {caption}' for start, _, caption in cues) + '\n\nRENDERED RESULT\n' + frames[-1].get('uiText', '') + '\n'
    (destination / f"{record['key']}-transcript.txt").write_text(transcript)
    prefix = 'materials/chatgpt-widgets/videos'
    return {
        'command': '/' + record['key'], 'type': 'video',
        'src': f"{prefix}/{record['key']}.mp4", 'poster': f"{prefix}/{record['key']}-poster.jpg",
        'captions': f"{prefix}/{record['key']}.en.vtt", 'captionsDefault': False,
        'alt': f"Actual ChatGPT /{record['key']} widget: " + ' '.join(frame['caption'] for frame in frames),
        'caption': 'Actual ChatGPT output · recorded interaction',
        'prompt': prompt, 'transcript': transcript, 'transcriptFile': f"{prefix}/{record['key']}-transcript.txt",
        'durationSeconds': elapsed, 'width': width, 'height': height, 'fps': 24,
        'sha256': hashlib.sha256(output.read_bytes()).hexdigest(),
    }


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--source', type=Path, default=ROOT / 'output/chatgpt-video-captures')
    parser.add_argument('--destination', type=Path, default=ROOT / 'public/materials/chatgpt-widgets/videos')
    parser.add_argument('--ffmpeg', default=shutil.which('ffmpeg'))
    args = parser.parse_args()
    if not args.ffmpeg:
        import imageio_ffmpeg
        args.ffmpeg = imageio_ffmpeg.get_ffmpeg_exe()
    records = json.loads((args.source / 'captures.json').read_text())
    review = json.loads((ROOT / 'data/demos/chatgpt-widget-review.json').read_text())
    prompts = {run['command'].lower(): run['prompt'] for run in review['results']}
    for record in records:
        record['prompt'] = record.get('prompt') or prompts[record['command'].lower()]
    retained = {run['command'].lower() for run in review['results'] if run['status'] == 'keep'}
    assert {record['command'].lower() for record in records} == retained - {'/flashcard'}
    assert all(len(record['frames']) >= 2 for record in records)
    args.destination.mkdir(parents=True, exist_ok=True)
    with ThreadPoolExecutor(max_workers=4) as executor:
        clips = list(executor.map(lambda record: render(record, args.source, args.destination, args.ffmpeg), records))
    media = json.loads((ROOT / 'data/content/media.json').read_text())
    flashcard = media['S53EX3']
    flashcard_record = json.loads((ROOT / 'public/materials/chatgpt-shortcuts/recording-provenance.json').read_text())
    clips.append({**flashcard, 'command': '/flashcard', 'prompt': flashcard_record['prompt'],
                  'durationSeconds': flashcard_record['video']['durationSeconds'],
                  'width': flashcard_record['video']['width'], 'height': flashcard_record['video']['height'],
                  'fps': flashcard_record['video']['fps'], 'sha256': flashcard_record['video']['sha256']})
    order = [row['command'] for slide in json.loads((ROOT / 'data/content/workshop-slides.json').read_text())
             if slide.get('commandCategory') == 'informal' for row in slide['commands']]
    by_command = {clip['command'].lower(): clip for clip in clips}
    clips = [{**by_command[command.lower()], 'command': command} for command in order]
    catalogue = {'recordedOn': '2026-11-05', 'clips': clips}
    (ROOT / 'data/demos/chatgpt-videos.json').write_text(json.dumps(catalogue, indent=2, ensure_ascii=False) + '\n')
    provenance = {
        'recordedOn': '2026-11-05', 'status': 'executed', 'audio': False,
        'method': '29 videos edited from original ChatGPT screenshots captured before and after real UI actions, with reading holds and English WebVTT captions. Crops exclude account navigation and unrelated messages. No reconstructed interface, answers, mouse movements or transitions. The existing flashcard clip is a native browser screencast.',
        'book': review['book'],
        'clips': [{**{key: value for key, value in clip.items() if key != 'transcript'},
                   'capture': next(({key: record[key] for key in ('recordedAt', 'conversationUrl', 'rootId', 'feedbackMessageId') if key in record}
                                    | {'frames': [{**{key: frame[key] for key in ('phase', 'caption', 'crop')},
                                                   'sourceSha256': hashlib.sha256((args.source / record['key'] / frame['file']).read_bytes()).hexdigest()}
                                                  for frame in record['frames']]}
                                   for record in records if '/' + record['key'].lower() == clip['command'].lower()),
                                  {'sourceRecord': 'materials/chatgpt-shortcuts/recording-provenance.json'})}
                  for clip in clips],
    }
    (args.destination / 'provenance.json').write_text(json.dumps(provenance, indent=2, ensure_ascii=False) + '\n')
    for clip in clips:
        print(f"{clip['command']}: {clip['durationSeconds']:.1f}s · {clip['width']} × {clip['height']}", flush=True)


if __name__ == '__main__':
    main()
