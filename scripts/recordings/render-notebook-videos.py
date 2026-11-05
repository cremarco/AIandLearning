"""Render fresh @Browser UI recordings; never reuse the earlier native captures.

Consecutive viewport screenshots were captured during real actions and playback
through @Browser. Replay their actual timestamps, cutting only between scenes.
Requires Pillow and FFmpeg (or imageio-ffmpeg).
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
WIDTH, HEIGHT, FPS = 1440, 900, 24
OMIT = {
    'sources': {'create'},  # Exclude the unrelated notebook library.
    'flashcards': {'result', 'standalone'},  # Cut the embedded viewer loading wait.
    'quiz': {'result'},
    'mind-map': {'result'},
    'audio': {'interactive'},  # Only the loading state was captured for this mode.
}


def timestamp(seconds):
    ms = round(seconds*1000)
    return f'{ms//3600000:02}:{ms//60000%60:02}:{ms//1000%60:02}.{ms%1000:03}'


def compose(filename):
    with Image.open(filename) as original:
        content = ImageOps.contain(original.convert('RGB'), (WIDTH, HEIGHT), Image.Resampling.LANCZOS)
    canvas = Image.new('RGB', (WIDTH, HEIGHT), '#101114')
    canvas.paste(content, ((WIDTH-content.width)//2, (HEIGHT-content.height)//2))
    return canvas


def render(demo, scenes, source, destination, ffmpeg):
    selected = [s for s in scenes if s['key'] == demo['key'] and not s.get('omit')
                and s['phase'] not in OMIT.get(demo['key'], set())]
    if len(selected) < 2 or demo['status'] not in ('executed', 'opened'):
        raise ValueError(f"{demo['key']}: finish the fresh Browser recording first")
    output = destination/f"{demo['key']}.mp4"
    elapsed, cues, poster = 0, [], None
    frame_count = sum(len(scene['frames']) for scene in selected)
    if frame_count < 12:
        raise ValueError(f"{demo['key']}: consecutive Browser frames are required")
    with tempfile.TemporaryDirectory(prefix='eduforum-browser-video-') as temp:
        temp, concat, index = Path(temp), [], 0
        for scene in selected:
            cues.append((elapsed, elapsed+scene['duration'], scene['caption']))
            for n, frame in enumerate(scene['frames']):
                image = compose(source/demo['key']/frame['file'])
                filename = temp/f'{index:05}.png'
                image.save(filename)
                next_t = scene['frames'][n+1]['t'] if n+1 < len(scene['frames']) else scene['duration']
                duration = max(.001, next_t-frame['t'])
                if n == 0:
                    duration += frame['t']
                concat.extend([f"file '{filename}'", f'duration {duration:.6f}'])
                index += 1
            if scene['phase'] == demo['posterPhase']:
                poster_frame = scene['frames'][max(0,len(scene['frames'])-2)]
                poster = compose(source/demo['key']/poster_frame['file'])
            elapsed += scene['duration']
        if poster is None:
            raise ValueError(f"{demo['key']}: poster phase missing")
        concat.append(f"file '{filename}'")
        (temp/'frames.txt').write_text('\n'.join(concat)+'\n')
        subprocess.run([ffmpeg,'-y','-loglevel','error','-f','concat','-safe','0',
                        '-i',str(temp/'frames.txt'),'-t',f'{elapsed:.3f}','-an',
                        '-vf',f'fps={FPS}','-c:v','libx264','-preset','fast','-crf','19',
                        '-pix_fmt','yuv420p','-movflags','+faststart',str(output)],check=True)
    poster.save(destination/f"{demo['key']}-poster.jpg",quality=94)
    (destination/f"{demo['key']}.en.vtt").write_text('WEBVTT\n\n'+'\n\n'.join(
        f'{timestamp(a)} --> {timestamp(b)}\n{text}' for a,b,text in cues)+'\n')
    transcript = (f"{demo['name']} — recorded from scratch in @Browser, 5 November 2026\n\n"
                  f"Authentic UI actions and playback, with generation waits cut between scenes.\n"
                  f"The interface recording is silent; English captions are available.\n\n"
                  f"OBSERVED RESULT\n{demo['result']}\n\nSCOPE\n{demo['scope']}\n\nCAPTIONS\n"+
                  '\n'.join(f'{timestamp(a)} {text}' for a,_,text in cues)+'\n')
    (destination/f"{demo['key']}-transcript.txt").write_text(transcript)
    return {'key':demo['key'],'slideId':demo['slideId'],'name':demo['name'],
            'browser':'@Browser','status':demo['status'],'scope':demo['scope'],
            'result':demo['result'],'recordedAt':selected[0]['startedAt'],
            'durationSeconds':round(elapsed,3),'width':WIDTH,'height':HEIGHT,'fps':FPS,
            'captureFrameCount':frame_count,
            'scenes':[{'phase':s['phase'],'durationSeconds':round(s['duration'],3),
                       'frameCount':len(s['frames']),'recordedAt':s['startedAt']} for s in selected],
            'sha256':hashlib.sha256(output.read_bytes()).hexdigest()}


def main():
    parser=argparse.ArgumentParser()
    parser.add_argument('--source',type=Path,default=ROOT/'output/review/notebook-browser-captures')
    parser.add_argument('--destination',type=Path,default=ROOT/'public/materials/notebook')
    parser.add_argument('--ffmpeg',default=shutil.which('ffmpeg'))
    parser.add_argument('--only',nargs='+')
    args=parser.parse_args()
    if not args.ffmpeg:
        import imageio_ffmpeg
        args.ffmpeg=imageio_ffmpeg.get_ffmpeg_exe()
    # These inputs exist only for the fresh @Browser run. Missing observations
    # are an error; old results and native screenshots are never a fallback.
    results=json.loads((args.source/'results.json').read_text())
    scenes=json.loads((args.source/'capture.json').read_text())
    demos_path=ROOT/'data/demos/notebook-demos.json'
    demos=json.loads(demos_path.read_text())
    for demo in demos:
        if demo['key'] not in results:
            raise ValueError(f"{demo['key']}: missing new Browser result")
        demo.update(results[demo['key']])
        demo.pop('captionOverrides',None)
        demo.pop('omitPhases',None)
    args.destination.mkdir(parents=True,exist_ok=True)
    previous=args.destination/'provenance.json'
    prior=json.loads(previous.read_text()) if previous.exists() else {}
    # Discard every earlier native-application clip from the execution record.
    rendered={c['key']:c for c in prior.get('clips',[]) if c.get('browser')=='@Browser'}
    for demo in demos:
        if args.only and demo['key'] not in args.only:
            continue
        rendered[demo['key']]=render(demo,scenes,args.source,args.destination,args.ffmpeg)
        print(f"{demo['name']}: {rendered[demo['key']]['durationSeconds']:.1f}s, "
              f"{rendered[demo['key']]['captureFrameCount']} Browser frames",flush=True)
    provenance={'recorded':'2026-11-05','language':'en-US','browser':'@Browser',
        'restart':'All published clips were recorded again from scratch in a new notebook through @Browser. Earlier native-application recordings were replaced.',
        'captureMethod':'Consecutive viewport screenshots during actual @Browser UI actions and media playback. Actual frame timestamps are replayed at 24 fps without drawing or reconstructing interfaces or responses. Generation waits are cut between scenes. The complete viewport remains visible at one scale.',
        'source':'Original Fondamenti_GenAI_Cremaschi.pdf uploaded through the @Browser file chooser. Studio artifacts were generated with that PDF as the only selected source. Later research demonstrations imported official tokenizer documentation and a generated research report.',
        'audio':'Silent interface demonstrations with English WebVTT captions and transcripts.',
        'accountTierObserved':'PLUS; availability and limits vary by account.',
        'captureManifestSha256':hashlib.sha256((args.source/'capture.json').read_bytes()).hexdigest(),
        'clips':[rendered[d['key']] for d in demos if d['key'] in rendered]}
    previous.write_text(json.dumps(provenance,indent=2,ensure_ascii=False)+'\n')
    demos_path.write_text(json.dumps(demos,indent=2,ensure_ascii=False)+'\n')
    media_path=ROOT/'data/content/media.json'
    media=json.loads(media_path.read_text())
    for demo in demos:
        clip=rendered.get(demo['key'])
        if not clip:
            continue
        prefix=f"materials/notebook/{demo['key']}"
        media[demo['slideId']]={'type':'video','src':prefix+'.mp4',
            'poster':prefix+'-poster.jpg','captions':prefix+'.en.vtt',
            'captionsDefault':False,'browserFrame':True,
            'alt':f"{demo['name']}: real actions recorded from scratch in @Browser.",
            'caption':f"Recorded in @Browser · {round(clip['durationSeconds'])} s",
            'source':'https://notebook.google.com/',
            'transcript':(args.destination/f"{demo['key']}-transcript.txt").read_text()}
    media_path.write_text(json.dumps(media,indent=2,ensure_ascii=False)+'\n')


if __name__=='__main__':
    main()
