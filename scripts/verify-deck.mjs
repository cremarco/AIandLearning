import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { launchBrowser } from './browser.mjs'
import { checkData, slides } from './check-data.mjs'
const root=path.resolve(import.meta.dirname,'..')
checkData()
const base=process.env.DECK_URL||'http://localhost:3047/'
const browser=await launchBrowser({headless:true})
const page=await browser.newPage({viewport:{width:1280,height:720}})
page.setDefaultTimeout(15000)
const errors=[],issues=[];page.on('pageerror',e=>errors.push(e.message))
fs.mkdirSync(path.join(root,'output/review/slides'),{recursive:true})
const report={status:'running',slides:[],flows:[],navigation:[],ui:{},issues,errors}
const pathControls='.flow-controls, .flow-picker, [data-flow]'
async function assertNoPathControls(){
 assert.equal(await page.locator(pathControls).count(),0,'Route buttons, selectors and the custom navigation bar must be removed')
}
async function checkNativeUI(){
 const event=slides.find(s=>s.type==='brief'),luca=slides.find(s=>s.character)
 await page.goto(new URL(String(event.number),base).href,{waitUntil:'networkidle'})
 const next=page.getByRole('button',{name:'Go to next slide',exact:true})
 await next.focus()
 await page.waitForFunction(()=>{
  const button=document.activeElement
  if(button?.getAttribute('title')!=='Go to next slide')return false
  for(let el=button;el;el=el.parentElement){
   const style=getComputedStyle(el)
   if(style.display==='none'||style.visibility==='hidden'||Number(style.opacity)<.99)return false
  }
  return true
 })
 await next.click()
 await page.locator(`#slide-container .slide-${slides[event.number].id}:visible`).waitFor()
 await page.getByRole('button',{name:'Go to previous slide',exact:true}).click()
 const main=page.locator(`#slide-container .slide-${event.id}:visible`)
 await main.waitFor()
 await main.locator('.slide-audience [tabindex="0"]').focus()
 await page.keyboard.press('Tab')
 await page.keyboard.press('Shift+Tab')
 await page.waitForFunction(()=>{
  const tooltip=document.activeElement?.closest('.tooltip')
  return tooltip&&document.activeElement.matches(':focus-visible')&&getComputedStyle(tooltip,'::before').opacity==='1'
 })
 report.ui.nativeToolbar=true;report.ui.keyboardTooltip=true
 await page.goto(new URL(`presenter/${luca.number}`,base).href,{waitUntil:'networkidle'})
 const expressions=page.locator('.luca-reaction')
 await expressions.nth(1).waitFor()
 assert.deepEqual(await expressions.evaluateAll(elements=>elements.map(el=>el.dataset.expression)),['happy','worried'],'Presenter Next must preview the next click independently of the current frame')
 report.ui.presenterPreview=true
 await page.goto(new URL('print?print=true',base).href,{waitUntil:'networkidle'})
 assert.equal(await page.locator('.print-slide-container').count(),slides.length)
 const printedLuca=page.locator(`#print-container .slide-${luca.id} .luca-reaction`)
 assert.equal(await printedLuca.getAttribute('data-expression'),'happy')
 assert(await printedLuca.locator('button').isDisabled(),'The custom print route must remain static without a Slidev slide context')
 report.ui.staticPrint=true
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
  const previous=slides[visited.length-1]
  for(let click=0;click<(previous.clicks||0);click++){
   await page.keyboard.press('ArrowRight')
   const current=page.locator(`#slide-container .slide-${previous.id}:visible`)
   await current.waitFor()
   if(previous.character)assert.equal(await current.locator('.luca-reaction').getAttribute('data-expression'),'worried','The first advance must change Andrea’s expression without leaving the slide')
  }
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
  if(s.id==='S01')assert.equal(await main.locator('button, select, [role="button"]').count(),0,`${s.id}: cover must be static, without route buttons or selectors`)
  assert.equal(await main.locator('.slide-page').innerText(),`${s.number} / ${slides.length}`)
  const result=await main.evaluate(async el=>{
   const imgs=[...el.querySelectorAll('img')];await Promise.all(imgs.map(i=>i.decode().catch(()=>{})))
   const broken=imgs.filter(i=>!i.complete||!i.naturalWidth).map(i=>i.src)
   const bounds=el.getBoundingClientRect()
   const clipped=[...el.querySelectorAll('h1,h2,p,blockquote,li,figcaption,svg text,.workshop-context')].filter(x=>{
    if(x.closest('.sr-only'))return false
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
 await checkNativeUI()
 report.flows.push('all')
 await page.goto(new URL('materials/lettura.html',base).href,{waitUntil:'networkidle'})
 assert.equal(await page.locator('html').getAttribute('lang'),'en')
 assert.equal(await page.locator('section.slide').count(),slides.length)
 await page.locator('#larger').click();assert.equal(await page.locator('html').evaluate(el=>getComputedStyle(el).getPropertyValue('--size')),'22px')
 await page.locator('#spacing').click();assert.equal(await page.locator('#spacing').getAttribute('aria-pressed'),'true')
 await page.setViewportSize({width:390,height:844});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'Reading mode must reflow on narrow screens')
 await page.emulateMedia({reducedMotion:'reduce'});await page.goto(new URL(String(slides.find(s=>s.id==='S51').number),base).href,{waitUntil:'networkidle'});await page.locator('.slide-S51:visible').waitFor()
 assert.deepEqual(errors,[],'No browser exceptions')
 report.status=issues.length?'needs-refinement':'passed'
 fs.writeFileSync(path.join(root,'output/review/deck-check.json'),JSON.stringify(report,null,2))
 console.log(JSON.stringify({slides:report.slides.length,flows:report.flows,navigation:report.navigation.map(n=>({...n,visited:n.visited.length})),ui:report.ui,issues,errors},null,2))
 assert.equal(issues.length,0,'Review and resolve layout findings')
}finally{await browser.close()}
