import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { launchBrowser } from './browser.mjs'
import { loadSpeakerNotes } from './speaker-notes.mjs'
const root=path.resolve(import.meta.dirname,'..')
const read=p=>JSON.parse(fs.readFileSync(path.join(root,p),'utf8'))
const slides=read('data/slides.json'),flows=read('data/flows.json'),sources=read('data/sources.json'),notes=loadSpeakerNotes(slides)
assert.equal(slides.length,85,'The single complete path must contain all 85 slides')
assert.equal(new Set(slides.map(s=>s.id)).size,slides.length)
for(let i=0;i<slides.length;i++){
 const s=slides[i];assert.equal(s.number,i+1)
 for(const id of s.sources)assert(sources[id],`${s.id}: missing source ${id}`)
 for(const lang of ['it'])assert(notes[s.id][lang].length>60,`${s.id}: real speaker script`)
}
for(let n=51;n<=103;n++)assert(slides.some(s=>s.id===`S${n}`),`Missing planned step S${n}`)
assert.equal(flows.length,1,'Only one presentation path may be configured')
assert.equal(flows[0].id,'all','The complete path must use the all identifier')
assert.deepEqual(flows[0].slideIds,slides.map(s=>s.id),'The complete path must contain every slide exactly once in source order')
const base=process.env.DECK_URL||'http://localhost:3047/'
const browser=await launchBrowser({headless:true})
const page=await browser.newPage({viewport:{width:1280,height:720}})
page.setDefaultTimeout(15000)
const errors=[],issues=[];page.on('pageerror',e=>errors.push(e.message))
fs.mkdirSync(path.join(root,'output/review/slides'),{recursive:true})
const report={status:'running',slides:[],flows:[],navigation:[],issues,errors}
const pathControls='.flow-controls, .flow-picker, [data-flow]'
async function assertNoPathControls(){
 assert.equal(await page.locator(pathControls).count(),0,'Route buttons, selectors and the custom navigation bar must be removed')
}
async function checkKeyboardPath(legacyQuery){
 const url=new URL(base)
 if(legacyQuery)url.searchParams.set('flow','teachers')
 else url.searchParams.delete('flow')
 await page.goto(url.href,{waitUntil:'networkidle'})
 await page.locator(`#slide-container .slide-${slides[0].id}:visible`).waitFor()
 await page.waitForFunction(()=>!new URL(location.href).searchParams.has('flow'))
 await assertNoPathControls()
 const visited=[slides[0].id]
 for(const s of slides.slice(1)){
  await page.keyboard.press('ArrowRight')
  await page.locator(`#slide-container .slide-${s.id}:visible`).waitFor()
  visited.push(s.id)
 }
 assert.deepEqual(visited,slides.map(s=>s.id),'Keyboard navigation must preserve the complete slide sequence')
 await page.keyboard.press('ArrowRight')
 await page.locator(`#slide-container .slide-${slides.at(-1).id}:visible`).waitFor()
 await page.keyboard.press('ArrowLeft')
 await page.locator(`#slide-container .slide-${slides.at(-2).id}:visible`).waitFor()
 await page.keyboard.press('ArrowRight')
 await page.locator(`#slide-container .slide-${slides.at(-1).id}:visible`).waitFor()
 await assertNoPathControls()
 report.navigation.push({entry:legacyQuery?'legacy ?flow=teachers':'default',visited,lastSlideStable:true,previousAndNext:true,pathControls:0})
}
try{
 for(const s of slides){
  await page.goto(new URL(String(s.number),base).href,{waitUntil:'networkidle'})
  const main=page.locator(`#slide-container .slide-${s.id}:visible`);await main.waitFor()
  await assertNoPathControls()
  if(s.id==='S01'||s.id==='S03')assert.equal(await main.locator('button, select, [role="button"]').count(),0,`${s.id}: cover and programme must be static, without route buttons or selectors`)
  assert.equal(await main.locator('.slide-page').innerText(),`${s.number} / ${slides.length}`)
  const result=await main.evaluate(async el=>{
   const imgs=[...el.querySelectorAll('img')];await Promise.all(imgs.map(i=>i.decode().catch(()=>{})))
   const broken=imgs.filter(i=>!i.complete||!i.naturalWidth).map(i=>i.src)
   const bounds=el.getBoundingClientRect()
   const clipped=[...el.querySelectorAll('h1,h2,p,blockquote,li,figcaption,svg text,.workshop-context')].filter(x=>{
    const r=x.getBoundingClientRect();return r.width>0&&r.height>0&&(r.bottom>bounds.bottom-40||r.right>bounds.right-20||r.left<bounds.left-1)
   }).map(x=>x.textContent.trim().slice(0,100))
   const stage=el.querySelector('.workshop-stage')
   const crowded=stage&&stage.scrollHeight>stage.clientHeight+4?{scroll:stage.scrollHeight,client:stage.clientHeight}:null
   const bottom=el.querySelector('.workshop-context')?.getBoundingClientRect().top
   const collisions=bottom?[...el.querySelectorAll('.workshop-copy p,.procedure-list li')].filter(x=>x.getBoundingClientRect().bottom>bottom-4).map(x=>x.textContent.slice(0,60)):[]
   return {broken,clipped,crowded,collisions}
  })
  if(result.broken.length||result.clipped.length||result.crowded||result.collisions.length)issues.push({id:s.id,...result})
  if(process.env.CAPTURE!=='0')await main.screenshot({path:path.join(root,`output/review/slides/${String(s.number).padStart(2,'0')}-${s.id}.png`)})
  report.slides.push(s.id)
 }
 await checkKeyboardPath(false)
 await checkKeyboardPath(true)
 report.flows.push('all')
 await page.goto(new URL('materials/lettura.html',base).href,{waitUntil:'networkidle'})
 assert.equal(await page.locator('html').getAttribute('lang'),'en')
 assert.equal(await page.locator('section.slide').count(),slides.length)
 await page.locator('#larger').click();assert.equal(await page.locator('html').evaluate(el=>getComputedStyle(el).getPropertyValue('--size')),'22px')
 await page.locator('#spacing').click();assert.equal(await page.locator('#spacing').getAttribute('aria-pressed'),'true')
 await page.setViewportSize({width:390,height:844});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'Reading mode must reflow on narrow screens')
 await page.emulateMedia({reducedMotion:'reduce'});await page.goto(new URL('8',base).href,{waitUntil:'networkidle'});await page.locator('.slide-S51:visible').waitFor()
 assert.deepEqual(errors,[],'No browser exceptions')
 report.status=issues.length?'needs-refinement':'passed'
 fs.writeFileSync(path.join(root,'output/review/deck-check.json'),JSON.stringify(report,null,2))
 console.log(JSON.stringify({slides:report.slides.length,flows:report.flows,navigation:report.navigation.map(n=>({...n,visited:n.visited.length})),issues,errors},null,2))
 assert.equal(issues.length,0,'Review and resolve layout findings')
}finally{await browser.close()}
