#!/usr/bin/env node
/** Preserve superseded Notebook outputs before fresh institutional takes. */
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import {fileURLToPath} from 'node:url'
const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..')
const STAGING=path.join(ROOT,'output/review/video-refresh')
const sha=file=>crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex')
const read=file=>JSON.parse(fs.readFileSync(file,'utf8'))
const relative=file=>path.relative(ROOT,file).split(path.sep).join('/')
function files(directory,prefix='') {
  return fs.readdirSync(directory,{withFileTypes:true}).flatMap(entry=>{
    if (!prefix && (entry.name==='encode' || entry.name.startsWith('.'))) return []
    const name=path.join(prefix,entry.name),file=path.join(directory,entry.name)
    if (entry.isSymbolicLink()) throw Error('Archive refuses symbolic links')
    return entry.isDirectory()?files(file,name):entry.isFile()?[name]:[]
  })
}
export function archivePersonalNotebookAttempts(run,{apply=false}={}) {
  run=path.resolve(run)
  if (!run.startsWith(STAGING+path.sep)) throw Error('Archive is staging-only')
  const inventory=read(path.join(run,'inventory.json')),reports=[]
  for (const item of inventory.items.filter(i=>i.service==='NotebookLM')) {
    const source=path.join(run,item.directory),renderFile=path.join(source,'render.json')
    if (!fs.existsSync(renderFile)) continue
    if (fs.existsSync(path.join(source,'.rendering.json'))) throw Error('Wait for completed render before archiving '+item.key)
    const render=read(renderFile),captureFile=path.join(ROOT,render.capture.path,'capture.json'),capture=read(captureFile)
    if (capture.accountDomain==='unimib.it'&&capture.uiLanguage==='en') continue
    const identity=sha(renderFile).slice(0,16),destination=path.join(run,'prior-attempts/personal-notebooklm',item.key,identity)
    const list=files(source).map(file=>({path:file.split(path.sep).join('/'),sha256:sha(path.join(source,file)),bytes:fs.statSync(path.join(source,file)).size}))
    if (apply) {
      for (const file of list) {
        const output=path.join(destination,file.path);fs.mkdirSync(path.dirname(output),{recursive:true})
        if (fs.existsSync(output)) {if (sha(output)!==file.sha256) throw Error('Archived pixels/metadata cannot be replaced')}
        else fs.copyFileSync(path.join(source,file.path),output,fs.constants.COPYFILE_EXCL)
        if (sha(output)!==file.sha256 || sha(path.join(source,file.path))!==file.sha256) throw Error('File changed during native attempt archive')
      }
      fs.writeFileSync(path.join(destination,'archive-manifest.json'),JSON.stringify({schemaVersion:1,key:item.key,archivedAt:new Date().toISOString(),status:'superseded-personal-account-not-eligible',capture:{path:relative(path.dirname(captureFile)),sha256:sha(captureFile)},reason:'User now requires English NotebookLM interface under Unimib account.',files:list,omittedDirectory:'encode; raw native source capture stays unchanged in captures/',liveFilesChanged:false},null,2)+'\n')
    }
    reports.push({key:item.key,applied:apply,archive:relative(destination),files:list.length,bytes:list.reduce((n,f)=>n+f.bytes,0)})
  }
  return {stagingOnly:true,mode:apply?'archived':'dry-run',attempts:reports}
}
if (process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  const run=path.resolve(STAGING,process.argv[2]||'2026-11-07');console.log(JSON.stringify(archivePersonalNotebookAttempts(run,{apply:process.argv.includes('--apply')}),null,2))
}
