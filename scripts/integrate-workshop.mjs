import fs from 'node:fs'
const read = (p, fallback) => fs.existsSync(p) ? JSON.parse(fs.readFileSync(p,'utf8')) : fallback
const write=(p,d)=>fs.writeFileSync(p,JSON.stringify(d,null,2)+'\n')
const introIds=['S01','S02','S44','S03','S48','S49','S50']
const intro=read('data/opening-slides.json',read('data/slides.json',[])).filter(s=>introIds.includes(s.id)).sort((a,b)=>introIds.indexOf(a.id)-introIds.indexOf(b.id))
const media=read('data/media.json',{})
const overrides=read('data/editorial-overrides.json',{})
const workshop=read('data/workshop-slides.json',[]).map(s=>({...s,type:'workshop',audience:s.audience||'both',body:s.body||[],notes:s.notes||'',sources:s.sources||[],...(media[s.id]?{media:media[s.id]}:{}),...overrides[s.id]}))
const slides=[...intro,...workshop].map((s,i)=>({...s,number:i+1,links:(s.links||[]).map(l=>({...l,url:l.url.replace(/\.\/materials\/demo-genai\/$/,'./materials/demo-genai/index.html')}))}))
const notes={...read('data/speaker-notes.json',{}),...read('data/workshop-notes.json',{}),...read('data/editorial-notes.json',{})}
const sources={...read('data/sources.json',{}),...read('data/workshop-sources.json',{})}
const flows=[{
 id:'all', name:'Complete', event:'Beyond prompting · Complete presentation',
 focus:'All slides in one continuous sequence', minutes:null, budgetMinutes:null,
 slideIds:slides.map(slide=>slide.id),
}]
write('data/slides.json',slides);write('data/speaker-notes.json',Object.fromEntries(Object.entries(notes).map(([id,n])=>[id,{it:n.it,cues:{it:n.cues.it},...(n.route_scripts?{route_scripts:n.route_scripts}:{}),...(n.forum_extra?{forum_extra:{it:n.forum_extra.it}}:{})} ])));write('data/sources.json',sources);write('data/flows.json',flows)
console.log(`Integrated ${slides.length} slides; ${Object.keys(notes).length} Italian scripts`)
