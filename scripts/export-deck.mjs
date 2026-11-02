import { spawn } from 'node:child_process'
import { createServer } from 'node:net'
import { once } from 'node:events'
import { createRequire } from 'node:module'
import fs from 'node:fs'
import path from 'node:path'
import { launchBrowser } from './browser.mjs'
const require=createRequire(fs.realpathSync('node_modules/@slidev/cli/package.json'))
const {PDFDocument,PDFName,PDFDict,PDFString,PDFHexString}=require('pdf-lib')
const slides=JSON.parse(fs.readFileSync('data/slides.json'))
fs.mkdirSync('exports',{recursive:true});fs.mkdirSync('output/review',{recursive:true})
const socket=createServer();socket.listen(0,'localhost');await once(socket,'listening');const port=socket.address().port;await new Promise(r=>socket.close(r))
const log=fs.openSync('output/review/export-server.log','w')
const server=spawn(process.execPath,['node_modules/@slidev/cli/bin/slidev.mjs','--port',String(port)],{stdio:['ignore',log,log]})
let browser
try{
 const base=`http://localhost:${port}/`
 let ready=false;const deadline=Date.now()+90000
 while(Date.now()<deadline){try{if((await fetch(base)).ok){ready=true;break}}catch{}await new Promise(r=>setTimeout(r,400))}
 if(!ready)throw Error('The local export server did not start; see output/review/export-server.log')
 browser=await launchBrowser({headless:true})
 const page=await browser.newPage({viewport:{width:1280,height:720}})
 await page.emulateMedia({media:'print'})
 await page.goto(base+'print?print=true',{waitUntil:'networkidle',timeout:120000})
 await page.locator('.print-slide-container').last().waitFor()
 const count=await page.locator('.print-slide-container').count()
 if(count!==slides.length)throw Error(`Expected ${slides.length} static pages, found ${count}`)
 await page.evaluate(async()=>{await document.fonts.ready;await Promise.all([...document.images].map(i=>i.decode().catch(()=>{})))})
 const bytes=await page.pdf({width:'1280px',height:'720px',preferCSSPageSize:true,printBackground:true,tagged:true,outline:true})
 const pdf=await PDFDocument.load(bytes)
 if(pdf.getPageCount()!==slides.length)throw Error(`PDF has ${pdf.getPageCount()} pages`)
 pdf.setTitle(slides[0].title);pdf.setAuthor('Marco Cremaschi');pdf.setSubject('Visual tools for self-directed learning with artificial intelligence')
 const localLinks=[]
 for(const p of pdf.getPages()){
  const annotations=p.node.Annots();if(!annotations)continue
  for(let i=0;i<annotations.size();i++){
   const annotation=pdf.context.lookup(annotations.get(i),PDFDict)
   const action=annotation.lookupMaybe(PDFName.of('A'),PDFDict);if(!action)continue
   const value=action.lookup(PDFName.of('URI'));if(!(value instanceof PDFString||value instanceof PDFHexString))continue
   const uri=value.decodeText();if(!/^http:\/\/(localhost|127\.0\.0\.1):/.test(uri))continue
   const target=new URL(uri);const relative='../public'+decodeURIComponent(target.pathname)+target.hash
   action.set(PDFName.of('URI'),PDFString.of(relative));localLinks.push(relative)
  }
 }
 const tagged=pdf.catalog.has(PDFName.of('StructTreeRoot'))
 fs.writeFileSync('exports/EduForum-2026.pdf',await pdf.save())
 fs.writeFileSync('output/review/pdf-export.json',JSON.stringify({pages:pdf.getPageCount(),tagged,outline:pdf.catalog.has(PDFName.of('Outlines')),localLinks},null,2)+'\n')
 console.log(`Exported ${pdf.getPageCount()} pages; semantic tags ${tagged?'present':'absent'}; ${localLinks.length} local material links made relative.`)
}finally{
 await browser?.close();server.kill('SIGTERM');fs.closeSync(log)
}
