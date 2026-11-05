"""Edit the original Read aloud UI captures into a silent, captioned demo.

Run after capturing the real interaction in output/read-aloud-capture.
Frames are cropped at their native resolution; no interface is reconstructed.
Requires Pillow and FFmpeg (or imageio-ffmpeg).
"""
import hashlib
import json
from pathlib import Path
import shutil
import subprocess

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / 'output/read-aloud-capture'
DESTINATION = ROOT / 'public/materials/chatgpt-formal'
PREFIX = 'materials/chatgpt-formal/web-read-aloud'


def timestamp(seconds):
    return f'00:00:{seconds:02}.000'


def main():
    record = json.loads((SOURCE / 'capture.json').read_text())
    work = SOURCE / 'edited'
    work.mkdir(exist_ok=True)
    elapsed, cues, frames = 0, [], []
    for index, frame in enumerate(record['frames']):
        # Keep both the response and the playback control in view. For the menu
        # step, use a close-up of the actual menu, without unrelated navigation.
        crop = (266, 350, 1066, 640) if frame['phase'] == 'menu' else (266, 50, 1066, 320)
        image = Image.open(SOURCE / frame['file']).convert('RGB')
        assert image.size == (1280, 720), 'Capture the original 1280 × 720 browser viewport'
        canvas = Image.new('RGB', (800, 300), '#111111')
        canvas.paste(image.crop(crop), (0, 0))
        canvas.save(work / f'{index:02}.png')
        if frame['phase'] == 'playback':
            canvas.save(DESTINATION / 'web-read-aloud-poster.jpg', quality=96, subsampling=0)
        cues.append((elapsed, elapsed + frame['duration'], frame['caption']))
        elapsed += frame['duration']
        frames.append({**frame, 'crop': list(crop), 'sourceSha256': hashlib.sha256((SOURCE / frame['file']).read_bytes()).hexdigest()})
    concat = work / 'frames.txt'
    concat.write_text(''.join(f"file '{work / f'{index:02}.png'}'\nduration {frame['duration']}\n" for index, frame in enumerate(record['frames']))
                      + f"file '{work / f'{len(frames) - 1:02}.png'}'\n")
    ffmpeg = shutil.which('ffmpeg')
    if not ffmpeg:
        import imageio_ffmpeg
        ffmpeg = imageio_ffmpeg.get_ffmpeg_exe()
    output = DESTINATION / 'web-read-aloud.mp4'
    subprocess.run([ffmpeg, '-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', str(concat),
                    '-t', str(elapsed), '-vf', 'fps=24', '-an', '-c:v', 'libx264', '-preset', 'fast',
                    '-crf', '16', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', str(output)], check=True)
    (DESTINATION / 'web-read-aloud.en.vtt').write_text('WEBVTT\n\n' + '\n\n'.join(
        f'{timestamp(start)} --> {timestamp(end)}\n{caption}' for start, end, caption in cues) + '\n')
    transcript = ('Read aloud — actual ChatGPT menu and playback controls\n\n'
                  'This silent video is edited from original UI captures, with reading holds. It does not include the spoken audio.\n\n'
                  f"PROMPT\n{record['prompt']}\n\nRESPONSE\n{record['response']}\n\n"
                  + '\n'.join(f'{timestamp(start)} {caption}' for start, _, caption in cues) + '\n')
    (DESTINATION / 'web-read-aloud-transcript.txt').write_text(transcript)
    clip = {
        'recordedOn': record['recordedOn'], 'sourceUrl': record['conversationUrl'],
        'method': 'Edited sequence of original ChatGPT UI captures, cropped at 1:1 with reading holds. No reconstructed interface, pointer movement or transitions. No audio track.',
        'audio': False, 'src': PREFIX + '.mp4', 'poster': PREFIX + '-poster.jpg',
        'captions': PREFIX + '.en.vtt', 'transcriptFile': PREFIX + '-transcript.txt',
        'durationSeconds': elapsed, 'width': 800, 'height': 300, 'fps': 24,
        'sha256': hashlib.sha256(output.read_bytes()).hexdigest(),
        'prompt': record['prompt'], 'response': record['response'], 'frames': frames,
    }
    provenance_file = DESTINATION / 'provenance.json'
    provenance = json.loads(provenance_file.read_text())
    next(action for action in provenance['actions'] if action['action'] == 'Read aloud')['video'] = clip
    provenance_file.write_text(json.dumps(provenance, ensure_ascii=False, indent=2) + '\n')
    slides_file = ROOT / 'data/workshop-slides.json'
    slides = json.loads(slides_file.read_text())
    result = next(slide for slide in slides if slide['id'] == 'S53FORMALREADALOUD')['commands'][0]['result']
    result['label'] = 'Read aloud in action'
    result['caption'] = 'Original ChatGPT interaction · menu → playback · no audio track.'
    result['media'] = {
        'type': 'video', 'src': clip['src'], 'poster': clip['poster'], 'captions': clip['captions'],
        'captionsDefault': False, 'source': clip['sourceUrl'],
        'alt': 'Actual ChatGPT Read aloud interaction: open the slash menu, choose Read aloud, see the active playback control, then return to the ready state. Silent video.',
        'caption': result['caption'], 'transcript': transcript,
    }
    slides_file.write_text(json.dumps(slides, ensure_ascii=False, indent=2) + '\n')
    print(f'Read aloud: {elapsed}s · 800 × 300 · {output.stat().st_size:,} bytes · no audio')


if __name__ == '__main__':
    main()
