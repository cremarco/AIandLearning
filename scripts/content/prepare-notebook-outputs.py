import json, csv, re, subprocess, pathlib, hashlib
# Rebuild local viewers from the original exported NotebookLM files.
# Dependencies: Poppler (pdftotext, pdftoppm), cwebp and ffmpeg.
root=pathlib.Path(__file__).resolve().parents[2]
slides=json.loads((root/'data/generated/slides.json').read_text())
ids={'S66':('mind-map','Mind Map','image'),'S67':('quiz','Quiz','quiz'),'S67CARDS':('flashcards','Flashcards','flashcards'),'S67REPORTS':('reports','Reports','pdf'),'S67AUDIO':('audio','Audio Overview','audio'),'S67VIDEO':('video','Video Overview','video'),'S67INFO':('infographic','Infographic','image'),'S67SLIDES':('slides','Slide Deck','pdf'),'S67TABLES':('table','Data Table','table')}
# Preserve original output metadata when its slide has been removed.
outputs=json.loads((root/'data/content/notebook-outputs.json').read_text())
target=root/'public/materials/notebook-outputs'
target.mkdir(exist_ok=True)
for id,(key,feature,kind) in ids.items():
 s=next((s for s in slides if s['id']==id),None)
 if s is None: continue
 m=s['media']; r=m.get('result') or {}; src=r.get('url',m['src']).lstrip('/')
 o={'feature':feature,'type':kind,'src':src,'prompt':m.get('prompt') or s.get('prompt',''),'sourceSha256':hashlib.sha256((root/'public'/src).read_bytes()).hexdigest()}
 if kind=='pdf':
  folder=target/key; folder.mkdir(exist_ok=True)
  subprocess.run(['pdftoppm','-scale-to','1800','-png',str(root/'public'/src),str(folder/'page')],check=True)
  pages=[]
  for png in sorted(folder.glob('page-*.png')):
   webp=png.with_suffix('.webp')
   subprocess.run(['cwebp','-quiet','-q','88',str(png),'-o',str(webp)],check=True)
   pages.append(str(webp.relative_to(root/'public'))); png.unlink()
  o['pages']=pages
 if kind=='flashcards':
  with (root/'public'/src).open(newline='') as f: o['cards']=[{'question':row[0],'answer':row[1]} for row in csv.reader(f) if row]
 if kind=='table':
  with (root/'public'/src).open(newline='') as f: rows=list(csv.reader(f))
  o['headers']=rows[0]; o['rows']=rows[1:]
  folder=target/key; folder.mkdir(exist_ok=True)
  o['type']='image'
  o['preview']='materials/notebook-outputs/table/screenshot.png'
  o['screenshotSource']={'video':m['src'],'seconds':33.6,'crop':{'x':24,'y':84,'width':1392,'height':546}}
  # Capture the actual native table, without the authored video caption.
  subprocess.run(['ffmpeg','-hide_banner','-loglevel','error','-y','-ss','33.6','-i',str(root/'public'/m['src']),'-vf','crop=1392:546:24:84','-frames:v','1','-update','1',str(root/'public'/o['preview'])],check=True)
 if kind=='video':
  o['description']='Training vs. Inference & RAG — the original generated video.'
  o['poster']=m['poster']; o['captions']=m['captions']
 if kind=='quiz':
  raw=subprocess.check_output(['pdftotext','-layout',str(root/'public'/src),'-'],text=True)
  raw=re.sub(r'Derived from the original NotebookLM Quiz interface - static PDF[^\n]*','',raw).replace('\f','\n')
  qtext,htext=raw.split('\n Hints\n'); htext,solutions=htext.split('\n Solutions and explanations\n')
  solutions=solutions.split('\n Source and derivation\n')[0]
  clean=lambda t: re.sub(r'\s+',' ',t).strip()
  parts=re.split(r'(?:^|\n)\s*([1-6])\.\s',qtext)[1:]
  hints=re.split(r'(?:^|\n)\s*([1-6])\.\s',htext)[1:]
  hintmap={int(hints[i]):clean(hints[i+1]) for i in range(0,len(hints),2)}
  feedback=re.split(r'(?:^|\n)\s*Question ([1-6])\s*\n',solutions)[1:]
  fmap={int(feedback[i]):feedback[i+1] for i in range(0,len(feedback),2)}
  questions=[]
  for i in range(0,len(parts),2):
   n=int(parts[i]); chunks=re.split(r'\n\s*([A-D])\.\s',parts[i+1]); q=clean(chunks[0])
   opts=[clean(chunks[j+1]) for j in range(1,len(chunks),2)]
   fb=fmap[n]; correct=ord(re.search('Correct answer: ([A-D])',fb)[1])-65
   fbparts=re.split(r'\n\s*([A-D])\.\s',fb)[1:]; explanations=[]
   for j in range(0,len(fbparts),2):
    ix=ord(fbparts[j])-65; text=clean(fbparts[j+1]); assert text.startswith(opts[ix]),(n,ix,text,opts[ix])
    explanations.append(text[len(opts[ix]):].strip())
   assert len(opts)==len(explanations)==4
   questions.append({'question':q,'options':opts,'correctIndex':correct,'hint':hintmap[n],'explanations':explanations})
  assert len(questions)==6
  o['questions']=questions
 outputs[key]=o
(root/'data/content/notebook-outputs.json').write_text(json.dumps(outputs,ensure_ascii=False,indent=2)+'\n')
print({k:{'type':v['type'],'items':len(v.get('pages',v.get('cards',v.get('questions',v.get('rows',[])))))} for k,v in outputs.items()})
