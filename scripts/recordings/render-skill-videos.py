"""Render the six real ChatGPT web skill tests from their original UI frames.

Screenshots and transcripts are captured through @Browser. This script only edits
those captures, fits them proportionally into a common frame, and writes metadata.
"""
import argparse
import hashlib
import json
import shutil
import subprocess
import tempfile
from pathlib import Path

from PIL import Image, ImageOps

ROOT = Path(__file__).resolve().parents[2]
WIDTH, HEIGHT = 1440, 900
SELECTED = {
    'learn': ['question', 'feedback'],
    'the-learning-skill': ['original-request', 'practice-and-kit',
                           'corrected-question', 'corrected-answer',
                           'corrected-progress', 'quiz-feedback'],
    'markdown-mermaid-writing': ['diagram', 'expanded', 'source'],
    'flashcard-generator': ['request', 'verified-output'],
    'scientific-critical-thinking': ['request', 'checked-claims', 'independent-check'],
    'citation-management': ['request', 'verified-records', 'claim-limit'],
}
POSTER = {
    'learn': 'feedback',
    'the-learning-skill': 'corrected-answer',
    'markdown-mermaid-writing': 'expanded',
    'flashcard-generator': 'verified-output',
    'scientific-critical-thinking': 'checked-claims',
    'citation-management': 'verified-records',
}
# Native-pixel excerpt of the diagnostic question, learner misconception and
# feedback. The full dialogue remains in the transcript.
CROPS = {'learn': (480, 100, 1280, 630)}


def read(path):
    return json.loads(path.read_text())


def write(path, value):
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + '\n')


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def timestamp(seconds):
    ms = round(seconds * 1000)
    return f'{ms // 3600000:02}:{ms // 60000 % 60:02}:{ms // 1000 % 60:02}.{ms % 1000:03}'


def render(demo, all_scenes, source, destination, ffmpeg):
    key = demo['key']
    scenes = []
    for phase in SELECTED[key]:
        candidates = [s for s in all_scenes if s['key'] == key and s['phase'] == phase]
        if not candidates:
            raise ValueError(f'{key}: missing verified scene {phase}')
        scene = candidates[-1]
        assert scene['browserTabId'] in demo['allowedTabIds'], f'{key}: wrong browser tab'
        assert len(scene['frames']) >= 3, f'{key}/{phase}: incomplete capture'
        for frame in scene['frames']:
            allowed = [demo['conversationUrl'], *demo.get('artifactUrls', [])]
            assert any(frame['url'].startswith(url) for url in allowed), f'{key}: wrong captured page {frame["url"]}'
        scenes.append(scene)

    files = [source / key / f['file'] for s in scenes for f in s['frames']]
    sizes = [Image.open(file).size for file in files]
    crop = CROPS.get(key)
    if crop:
        assert all(s[0] >= crop[2] and s[1] >= crop[3] for s in sizes)
    width, height = WIDTH, HEIGHT
    cues, frame_records, elapsed = [], [], 0.0
    poster = None
    with tempfile.TemporaryDirectory(prefix='eduforum-skill-video-') as tmp:
        tmp = Path(tmp)
        concat, index = [], 0
        for scene in scenes:
            start = elapsed
            for n, frame in enumerate(scene['frames']):
                original_path = source / key / frame['file']
                with Image.open(original_path) as original:
                    original = original.crop(crop) if crop else original
                    content = ImageOps.contain(original.convert('RGB'), (width, height), Image.Resampling.LANCZOS)
                    canvas = Image.new('RGB', (width, height), '#111111')
                    canvas.paste(content, ((width-content.width)//2, (height-content.height)//2))
                image = tmp / f'{index:05}.png'
                canvas.save(image)
                if scene['phase'] == POSTER[key] and n == len(scene['frames']) - 1:
                    poster = canvas.copy()
                end = scene['frames'][n+1]['t'] if n+1 < len(scene['frames']) else scene['duration']
                duration = max(0.05, end-frame['t'])
                if n == 0:
                    duration += 2  # Read the newly visible scene before continuing.
                if scene is scenes[-1] and n == len(scene['frames'])-1:
                    duration += 3
                concat.append(f"file '{image.as_posix()}'\nduration {duration:.6f}\n")
                frame_records.append({'phase': scene['phase'], 'sha256': sha(original_path),
                                      'sourceSize': list(sizes[index]), 'crop': crop,
                                      'atSeconds': round(elapsed, 3)})
                elapsed += duration
                index += 1
            cues.append((start, elapsed, scene['caption']))
        concat.append(f"file '{image.as_posix()}'\n")
        manifest = tmp / 'frames.txt'
        manifest.write_text(''.join(concat))
        output = destination / f'{key}.mp4'
        subprocess.run([ffmpeg, '-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0',
                        '-i', str(manifest), '-t', f'{elapsed:.6f}', '-vf', 'fps=24', '-an',
                        '-c:v', 'libx264', '-preset', 'fast', '-crf', '14', '-pix_fmt', 'yuv420p',
                        '-movflags', '+faststart', str(output)], check=True)
    assert poster is not None
    poster.save(destination / f'{key}-poster.jpg', quality=96, subsampling=0)
    (destination / f'{key}.en.vtt').write_text('WEBVTT\n\n' + '\n\n'.join(
        f'{timestamp(a)} --> {timestamp(b)}\n{text}' for a, b, text in cues) + '\n')
    conversation = (source / key / 'conversation-text.txt').read_text()
    transcript = (f"{demo['name']} — recorded chapter test\n\n"
                  f"SOURCE\nOriginal workshop book, sections {', '.join(demo['chapter'])}.\n\n"
                  f"SELECTED SKILL\n{demo['name']}\n\nORIGINAL REQUEST\n{demo['prompt']}\n\n"
                  + '\n'.join(f'{timestamp(a)} {text}' for a, _, text in cues)
                  + f"\n\nOBSERVED RESULT\n{demo['observed']}\n\n"
                  + 'RECORDED CONVERSATION / GENERATED FILE\n' + conversation + '\n')
    transcript = '\n'.join(line.rstrip() for line in transcript.splitlines()).rstrip() + '\n'
    (destination / f'{key}-transcript.txt').write_text(transcript)
    return {'key': key, 'slideId': demo['slideId'], 'status': 'executed', 'accepted': True,
            'browser': '@Browser', 'surface': demo['surface'], 'model': demo['model'],
            'conversationUrl': demo['conversationUrl'], 'packageSource': demo['packageSource'],
            'observed': demo['observed'], 'tests': demo['tests'], 'artifacts': demo.get('artifacts', []),
            'durationSeconds': round(elapsed, 3), 'width': width, 'height': height,
            'scenes': [{'phase': s['phase'], 'browserTabId': s['browserTabId'],
                        'startedAt': s['startedAt'], 'caption': s['caption']} for s in scenes],
            'captureFrameCount': len(frame_records), 'sourceFrames': frame_records,
            'videoSha256': sha(output), 'posterSha256': sha(destination / f'{key}-poster.jpg')}


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--source', type=Path, default=ROOT / 'output/review/skill-web-tests/captures')
    parser.add_argument('--destination', type=Path, default=ROOT / 'public/materials/skills')
    parser.add_argument('--ffmpeg', default=shutil.which('ffmpeg'))
    args = parser.parse_args()
    if not args.ffmpeg:
        import imageio_ffmpeg
        args.ffmpeg = imageio_ffmpeg.get_ffmpeg_exe()
    demos = read(ROOT / 'data/demos/skill-demos.json')
    scenes = read(args.source / 'verified-scenes.json')
    args.destination.mkdir(parents=True, exist_ok=True)
    clips = []
    media = read(ROOT / 'data/content/media.json')
    for demo in demos:
        assert demo['accepted'] and demo['status'] == 'executed'
        clip = render(demo, scenes, args.source, args.destination, args.ffmpeg)
        clips.append(clip)
        prefix = f"materials/skills/{demo['key']}"
        media[demo['slideId']] = {'type': 'video', 'src': prefix+'.mp4',
            'poster': prefix+'-poster.jpg', 'captions': prefix+'.en.vtt',
            'captionsDefault': False, 'browserFrame': True, 'darkFrame': True,
            'alt': f"{demo['name']}: actual ChatGPT web test using the original workshop book.",
            'caption': f"Recorded chapter test · {round(clip['durationSeconds'])} s",
            'source': demo['conversationUrl'],
            'transcript': (args.destination / f"{demo['key']}-transcript.txt").read_text()}
        print(f"{demo['key']}: {clip['durationSeconds']:.1f}s, {clip['captureFrameCount']} original frames", flush=True)
    write(ROOT / 'data/content/media.json', media)
    write(args.destination / 'provenance.json', {
        'recorded': '2026-11-05', 'language': 'en', 'browser': '@Browser',
        'outputSize': {'width': WIDTH, 'height': HEIGHT},
        'method': 'Edited inspection of real ChatGPT web conversations and their generated files. Every video and poster is 1440 × 900 pixels. Original screenshot proportions are preserved when fitting to this common canvas; unused space is padded. The Learn clip uses a conversation excerpt; other clips retain the complete viewport. Scenes are arranged by task and preserve captured timing with explicit reading holds. Generation waits and navigation between scenes are omitted. No reconstructed interface, typing or answers. Silent video with optional English captions.',
        'sourceBook': {'path': 'materials/booklet-genai/Fondamenti_GenAI_Cremaschi.pdf',
                       'sha256': sha(ROOT / 'public/materials/booklet-genai/Fondamenti_GenAI_Cremaschi.pdf')},
        'learnerInputs': 'Andrea is fictional. Learner replies and misconceptions were authored for these demonstrations.',
        'scope': 'Six selected publisher packages imported through the native web Skill library and selected in Work mode. These demonstrations do not measure student learning or establish improvement over a baseline.',
        'discardedCaptures': 'Early captures of the wrong tab and the first HTML counter version are excluded. The published kit video uses the corrected counter after an explicit follow-up in the same chat.',
        'clips': clips})


if __name__ == '__main__':
    main()
