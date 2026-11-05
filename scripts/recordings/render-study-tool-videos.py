"""Render authentic web-editor captures at a shared 1440 x 900 size.

Run after capturing the UI through @Browser. No browser automation occurs here.
"""
import argparse
import hashlib
import json
import subprocess
import tempfile
from pathlib import Path
from PIL import Image, ImageOps

ROOT=Path(__file__).resolve().parents[2]
WIDTH,HEIGHT=1440,900

def read(p): return json.loads(p.read_text())
def write(p,v): p.write_text(json.dumps(v,ensure_ascii=False,indent=2)+'\n')
def sha(p): return hashlib.sha256(p.read_bytes()).hexdigest()
def stamp(s):
 m=round(s*1000)
 return f'{m//3600000:02}:{m//60000%60:02}:{m//1000%60:02}.{m%1000:03}'

def render(demo,scenes,src,out,ffmpeg):
 selected=[]
 for phase in demo['phases']:
  scene=[s for s in scenes if s['key']==demo['key'] and s['phase']==phase][-1]
  assert scene['browserTabId'] in demo['allowedTabIds']
  assert len(scene['frames'])>=3
  assert all(f['url'].startswith(demo['url']) for f in scene['frames'])
  selected.append(scene)
 elapsed=0
 cues=[]
 records=[]
 poster=None
 with tempfile.TemporaryDirectory(prefix='eduforum-study-video-') as temp:
  temp=Path(temp)
  concat=[]
  for scene in selected:
   start=elapsed
   for n,f in enumerate(scene['frames']):
    original=src/demo['key']/f['file']
    with Image.open(original) as im:
     size=list(im.size)
     fitted=ImageOps.contain(im.convert('RGB'),(WIDTH,HEIGHT),Image.Resampling.LANCZOS)
     canvas=Image.new('RGB',(WIDTH,HEIGHT),'#111111')
     canvas.paste(fitted,((WIDTH-fitted.width)//2,(HEIGHT-fitted.height)//2))
    file=temp/f'{len(records):05}.png'
    canvas.save(file)
    if scene['phase']==demo['posterPhase'] and n==len(scene['frames'])-1: poster=canvas.copy()
    end=scene['frames'][n+1]['t'] if n+1<len(scene['frames']) else scene['duration']
    duration=max(.05,end-f['t'])+(2 if n==0 else 0)
    if scene is selected[-1] and n==len(scene['frames'])-1: duration+=3
    concat.append(f"file '{file.as_posix()}'\nduration {duration:.6f}\n")
    records.append({'phase':scene['phase'],'sha256':sha(original),'sourceSize':size,'atSeconds':round(elapsed,3)})
    elapsed+=duration
   cues.append((start,elapsed,scene['caption']))
  concat.append(f"file '{file.as_posix()}'\n")
  manifest=temp/'frames.txt'
  manifest.write_text(''.join(concat))
  video=out/f"{demo['key']}.mp4"
  subprocess.run([ffmpeg,'-y','-loglevel','error','-f','concat','-safe','0','-i',str(manifest),'-t',str(elapsed),'-vf','fps=24','-an','-c:v','libx264','-preset','fast','-crf','14','-pix_fmt','yuv420p','-movflags','+faststart',str(video)],check=True)
 assert poster is not None
 poster.save(out/f"{demo['key']}-poster.jpg",quality=96,subsampling=0)
 (out/f"{demo['key']}.en.vtt").write_text('WEBVTT\n\n'+'\n\n'.join(f'{stamp(a)} --> {stamp(b)}\n{c}' for a,b,c in cues)+'\n')
 transcript=f"{demo['name']} — recorded book test\n\nBOOK\nFoundations of Generative Artificial Intelligence, sections {', '.join(demo['chapter'])}.\n\nRECORDED TASK\n{demo['task']}\n\n"+'\n'.join(f'{stamp(a)} {c}' for a,b,c in cues)+f"\n\nOBSERVED RESULT\n{demo['observed']}\n\nCHECKS AGAINST THE BOOK\n"+'\n'.join(demo['tests'])+f"\n\nEDITABLE ARTIFACT\n{demo['artifact']}\n"
 transcript='\n'.join(x.rstrip() for x in transcript.splitlines()).rstrip()+'\n'
 (out/f"{demo['key']}-transcript.txt").write_text(transcript)
 return {'key':demo['key'],'slideId':demo['slideId'],'status':'executed','browser':'@Browser','url':demo['url'],'width':WIDTH,'height':HEIGHT,'durationSeconds':round(elapsed,3),'captureFrameCount':len(records),'scenes':[{'phase':s['phase'],'browserTabId':s['browserTabId'],'startedAt':s['startedAt'],'caption':s['caption']} for s in selected],'sourceFrames':records,'task':demo['task'],'observed':demo['observed'],'tests':demo['tests'],'videoSha256':sha(video),'posterSha256':sha(out/f"{demo['key']}-poster.jpg"),'artifact':demo['artifact'],'artifactSha256':sha(out/demo['artifact'])}

def main():
 p=argparse.ArgumentParser()
 p.add_argument('--source',type=Path,required=True)
 args=p.parse_args()
 import imageio_ffmpeg
 ffmpeg=imageio_ffmpeg.get_ffmpeg_exe()
 out=ROOT/'public/materials/study-tools'
 out.mkdir(parents=True,exist_ok=True)
 scenes=read(args.source/'verified-scenes.json')
 demos=read(ROOT/'data/demos/study-tool-demos.json')
 media=read(ROOT/'data/content/media.json')
 clips=[]
 for demo in demos:
  if demo['status']!='executed':
   assert demo.get('video') is None
   continue
  clip=render(demo,scenes,args.source,out,ffmpeg)
  clips.append(clip)
  prefix='materials/study-tools/'+demo['key']
  media[demo['slideId']]={'type':'video','src':prefix+'.mp4','poster':prefix+'-poster.jpg','captions':prefix+'.en.vtt','captionsDefault':False,'browserFrame':True,'darkFrame':demo['key']=='drawio','alt':f"{demo['name']}: real manual web-editor task using the workshop book.",'caption':f"Recorded book test · {round(clip['durationSeconds'])} s",'source':demo['url'],'transcript':(out/f"{demo['key']}-transcript.txt").read_text()}
  print(f"{demo['key']}: {clip['durationSeconds']}s, {clip['captureFrameCount']} original frames, {WIDTH}x{HEIGHT}",flush=True)
 write(ROOT/'data/content/media.json',media)
 write(out/'provenance.json',{'recorded':'2026-11-05','outputSize':{'width':WIDTH,'height':HEIGHT},'method':'Edited real @Browser captures of manual drawing, labelling and source checking. All videos and posters are 1440 x 900. Source proportions are preserved with padding. Captured scenes retain their timing with two-second reading holds and a final three-second hold; navigation and unsuccessful selector/export attempts are omitted. No reconstructed UI, synthetic drawing or AI-generated map is presented as a live action. Silent video with optional English captions.','sourceBook':{'path':'materials/booklet-genai/Fondamenti_GenAI_Cremaschi.pdf','sha256':sha(ROOT/'public/materials/booklet-genai/Fondamenti_GenAI_Cremaschi.pdf')},'scope':'Two manual web-editor tasks completed. AnkiWeb, Knowt and MindMeister required login; the user selected accessible demos only. No learning-outcome measurement.','artifactMethod':{'drawio':'Downloaded through File > Save as > Download.','excalidraw':'Selected all visible elements and copied through the UI. The copied element JSON was wrapped in the documented scene-file container. Direct disk export did not complete in this browser.'},'cards':'Four hand-authored, book-checked TSV examples. No Anki or Knowt import/review execution is claimed.','notExecuted':[d for d in demos if d['status']!='executed'],'clips':clips})

if __name__=='__main__': main()
