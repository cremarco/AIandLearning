import fs from 'node:fs/promises'
const pages={napkin:'https://help.napkin.ai/en/articles/15923699-visuals-generation',formative:'https://help.formative.com/en/articles/6198532-view-and-score-responses',magicschool:'https://www.magicschool.ai/tools/rubric-generator',notebook:'https://blog.google/innovation-and-ai/products/gemini-notebook/notebooklm-gemini-notebook/',excalidraw:'https://plus.excalidraw.com/',claude:'https://www.anthropic.com/news/build-artifacts'}
// Preserve real execution captures and their provenance when refreshing vendor media.
let previous=[]
try { previous=JSON.parse(await fs.readFile('public/images/tools/provenance.json','utf8')) } catch {}
const manifest=[]
for(const [id,page] of Object.entries(pages)){
 try{
 const html=await(await fetch(page)).text()
 await fs.writeFile(`/tmp/eduforum-${id}.html`,html)
 const imgs=[...html.matchAll(/<img\b[^>]*>/g)].map(m=>m[0])
 const records=imgs.map(tag=>({url:tag.match(/\bsrc="([^"]+)"/)?.[1]?.replaceAll('&amp;','&'),alt:tag.match(/\balt="([^"]*)"/)?.[1]||''})).filter(r=>r.url&& !/\.svg|avatar|logo|arrow|icon|fill-300x300/.test(r.url))
 let chosen=records.filter(r=>id==='napkin'?/253858/.test(r.url):id==='formative'?/156414|responses\.png/.test(r.url):id==='magicschool'?/rubric/i.test(r.url+' '+r.alt):id==='excalidraw'?/playground|editor/.test(r.url+' '+r.alt):true).slice(0,5)
 if(!chosen.length) console.log(id,'candidates',JSON.stringify(records.map(r=>({url:r.url.slice(0,230),alt:r.alt.slice(0,120)})).slice(0,15)))
 for(let i=0;i<chosen.length;i++){
 const record=chosen[i];const url=new URL(record.url,page).href
 const res=await fetch(url);if(!res.ok)throw Error(res.status)
 const type=res.headers.get('content-type')||'';if(!type.startsWith('image/'))continue
 const ext=type.includes('webp')?'webp':type.includes('gif')?'gif':type.includes('jpeg')?'jpg':'png'
 const filename=`${id}-${i+1}.${ext}`;await fs.writeFile(`public/images/tools/${filename}`,Buffer.from(await res.arrayBuffer()))
 manifest.push({id,file:filename,page,url,alt:record.alt,description:'Image from official product documentation. Vendor example content; not an execution of the Luca scenario.',retrieved:new Date().toISOString().slice(0,10)})
 }
 }catch(e){console.log(id,e.message)}
}
const refreshedFiles=new Set(manifest.map(x=>x.file))
await fs.writeFile('public/images/tools/provenance.json',JSON.stringify([...previous.filter(x=>!refreshedFiles.has(x.file)),...manifest],null,2)+'\n')
console.log(manifest.map(x=>x.file))
