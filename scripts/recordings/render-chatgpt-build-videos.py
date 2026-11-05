"""Edit real ChatGPT generation captures without resampling the captured text.

Capture JSON/PNGs come from the browser UI. No widget or generation is simulated.
Run without --partial only after all retained shortcuts have complete captures.
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
PREFIX = 'materials/chatgpt-widgets/builds'


def read(path):
    return json.loads(path.read_text())


def write(path, data):
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + '\n')


def timestamp(seconds):
    milliseconds = round(seconds * 1000)
    return f'{milliseconds // 3600000:02}:{milliseconds // 60000 % 60:02}:{milliseconds // 1000 % 60:02}.{milliseconds % 1000:03}'


def render(record, source, destination, ffmpeg):
    key = record['key']
    work = source / key / 'edited-build'
    work.mkdir(exist_ok=True)
    frames = record['frames']
    assert record['complete'] and len(frames) >= 3, f'{key}: incomplete generation'
    assert record['response']['controls'], f'{key}: no rendered widget controls'
    # The conversation column is 768 CSS pixels in the original 1280×720 captures.
    # Crop and pad at 1:1. Never enlarge or interpolate a screenshot.
    width, height = 800, 620
    durations = []
    for index, frame in enumerate(frames):
        screenshot = Image.open(source / key / frame['file']).convert('RGB')
        assert screenshot.size == (1280, 720), f'{key}: unexpected capture size {screenshot.size}'
        top = max(0, min(580, int(frame.get('promptRect', {}).get('top', 0)) - 20))
        content = screenshot.crop((266, top, 1066, 620))
        canvas = Image.new('RGB', (width, height), '#111111')
        canvas.paste(content, (0, 0))
        canvas.save(work / f'{index:05}.png')
        seconds = (frames[index + 1]['at'] - frame['at']) / 1000 if index + 1 < len(frames) else 5
        refinement_start = frame['phase'].startswith('refinement-') and (index == 0 or not frames[index - 1]['phase'].startswith('refinement-'))
        durations.append(max(.1, seconds) + (4 if index == 0 or refinement_start else 0))
    concat = work / 'frames.txt'
    concat.write_text(''.join(f"file '{(work / f'{index:05}.png').as_posix()}'\nduration {duration:.3f}\n" for index, duration in enumerate(durations))
                      + f"file '{(work / f'{len(frames) - 1:05}.png').as_posix()}'\n")
    total = sum(durations)
    output = destination / f'{key}.mp4'
    subprocess.run([ffmpeg, '-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', str(concat),
                    '-t', f'{total:.3f}', '-vf', 'fps=24', '-an', '-c:v', 'libx264', '-preset', 'fast',
                    '-crf', '14', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', str(output)], check=True)
    Image.open(work / f'{len(frames) - 1:05}.png').save(destination / f'{key}-poster.jpg', quality=98, subsampling=0)
    prompt_end = min(total, durations[0])
    result_start = sum(durations[:-1])
    cues = [(0, prompt_end, 'The original prompt is sent in ChatGPT.'),
            (prompt_end, result_start, 'ChatGPT generates the response and builds the widget.'),
            (result_start, total, 'The generated widget is ready to use.')]
    if record.get('refinements'):
        index = next(index for index, frame in enumerate(frames) if frame['phase'].startswith('refinement-'))
        start = sum(durations[:index])
        cues = [(0, prompt_end, 'The original prompt is sent in ChatGPT.'),
                (prompt_end, start, 'The first response contains static content.'),
                (start, start + 4, 'An additional request asks for interactive controls.'),
                (start + 4, result_start, 'ChatGPT builds the interactive widget.'),
                (result_start, total, 'The generated widget is ready to use.')]
    (destination / f'{key}.en.vtt').write_text('WEBVTT\n\n' + '\n\n'.join(
        f'{timestamp(start)} --> {timestamp(end)}\n{text}' for start, end, text in cues if end > start) + '\n')
    refinements = record.get('refinements', [])
    refinement_text = ''.join(f"ADDITIONAL REQUEST FOR INTERACTIVE CONTROLS\n{item['prompt']}\n\n" for item in refinements)
    transcript = (f"{record['command']} — prompt and widget generation\n\nPROMPT\n{record['prompt']}\n\n" + refinement_text
                  + '\n'.join(f'{timestamp(start)} {text}' for start, _, text in cues)
                  + '\n\nGENERATED RESULT\n' + record['response']['text'] + '\n')
    (destination / f'{key}-transcript.txt').write_text(transcript)
    return {
        'command': record['command'], 'type': 'video', 'src': f'{PREFIX}/{key}.mp4',
        'poster': f'{PREFIX}/{key}-poster.jpg', 'captions': f'{PREFIX}/{key}.en.vtt',
        'captionsDefault': False, 'alt': f"Actual ChatGPT {record['command']} run, showing the original prompt, generation and completed widget.",
        'caption': 'Original prompt → widget generation · recorded in ChatGPT',
        'prompt': record['prompt'], 'transcript': transcript, 'transcriptFile': f'{PREFIX}/{key}-transcript.txt',
        'source': record['conversationUrl'], 'durationSeconds': round(total, 3), 'width': width, 'height': height,
        **({'followUpPrompts': [item['prompt'] for item in refinements]} if refinements else {}),
        'fps': 24, 'sha256': hashlib.sha256(output.read_bytes()).hexdigest(),
        'chapters': [{'label': 'Prompt', 'seconds': 0}, {'label': 'Generation', 'seconds': round(prompt_end, 3)},
                     {'label': 'Widget', 'seconds': round(result_start, 3)}],
    }


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--source', type=Path, default=ROOT / 'output/chatgpt-build-captures')
    parser.add_argument('--partial', action='store_true', help='Render available captures without publishing the catalogue')
    args = parser.parse_args()
    ffmpeg = shutil.which('ffmpeg')
    if not ffmpeg:
        import imageio_ffmpeg
        ffmpeg = imageio_ffmpeg.get_ffmpeg_exe()
    order = [row['command'] for slide in read(ROOT / 'data/content/workshop-slides.json')
             if slide.get('commandCategory') == 'informal' for row in slide['commands']]
    records = {rec['command'].lower(): rec for file in args.source.glob('*/capture.json')
               if (rec := read(file)).get('complete') and rec.get('response', {}).get('controls')}
    missing = [command for command in order if command.lower() not in records]
    if missing and not args.partial:
        raise SystemExit('Missing complete captures: ' + ', '.join(missing))
    destination = ROOT / 'public' / PREFIX
    destination.mkdir(parents=True, exist_ok=True)
    ordered_records = [records[command.lower()] for command in order if command.lower() in records]
    with ThreadPoolExecutor(max_workers=4) as executor:
        clips = list(executor.map(lambda rec: render(rec, args.source, destination, ffmpeg), ordered_records))
    for clip in clips:
        print(f"{clip['command']}: {clip['durationSeconds']}s · {clip['width']}×{clip['height']} · native pixel crop", flush=True)
    if args.partial:
        return
    write(ROOT / 'data/demos/chatgpt-videos.json', {'recordedOn': '2026-11-05', 'clips': clips})
    previous = read(ROOT / 'public/materials/chatgpt-widgets/videos/provenance.json')
    archive = ROOT / 'public/materials/chatgpt-widgets/videos/interaction-provenance.json'
    if not archive.exists():
        write(archive, previous)
    provenance = {
        'recordedOn': '2026-11-05', 'status': 'executed', 'audio': False,
        'method': 'Timed screenshots of new real ChatGPT executions, from the original prompt through the visible generation to the completed widget. Additional requests for interactive controls are shown and transcribed when needed. Native 800×620 pixel crops, no screenshot resizing, no reconstructed interface or typing. Frames retain chronological order and within-segment timing; pauses between capture segments may be shortened. Four-second prompt reading holds and a five-second result hold; 24 fps delivery; H.264 CRF 14.',
        'book': previous['book'],
        'previousInteractionRecordings': 'materials/chatgpt-widgets/videos/interaction-provenance.json',
        'clips': [{**{key: value for key, value in clip.items() if key != 'transcript'},
                   'capture': {'startedAt': rec['startedAt'], 'conversationUrl': rec['conversationUrl'],
                               'responseId': rec['response']['id'], 'responseComplete': rec['complete'],
                               **({'refinements': rec['refinements']} if rec.get('refinements') else {}),
                               'frames': [{'at': frame['at'], 'phase': frame['phase'],
                                           'sourceSha256': hashlib.sha256((args.source / rec['key'] / frame['file']).read_bytes()).hexdigest()}
                                          for frame in rec['frames']]}}
                  for rec, clip in zip(ordered_records, clips)],
    }
    write(destination / 'provenance.json', provenance)
    # Existing checks and published references continue to use this provenance entrypoint.
    write(ROOT / 'public/materials/chatgpt-widgets/videos/provenance.json', provenance)
    media = read(ROOT / 'data/content/media.json')
    flashcard = next(clip for clip in clips if clip['command'] == '/flashcard')
    media['S53EX3'] = flashcard
    write(ROOT / 'data/content/media.json', media)
    slides = read(ROOT / 'data/content/workshop-slides.json')
    for slide in slides:
        if slide['id'] == 'S53WIDGETWORKSHEET':
            slide['media'] = next(clip for clip in clips if clip['command'] == '/worksheet')
    write(ROOT / 'data/content/workshop-slides.json', slides)


if __name__ == '__main__':
    main()
