/** Explicit fixtures only. No fixture is a native export, accepted result or quality review. */
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import crypto from 'node:crypto'
import {execFileSync} from 'node:child_process'
import {fileURLToPath} from 'node:url'
import {extractObservedReportContent,validateObservedUiDerivedPdf,auditDerivedPdfQuality} from './observed-ui-derived-pdf.mjs'

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..')
const run=path.join(root,'output/review/video-refresh/2026-11-07'),actual=path.join(run,'notebook-reports')
const fixture=fs.mkdtempSync(path.join(os.tmpdir(),'eduforum-derived-pdf-fixture-'))
const hash=file=>crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex')
const read=file=>JSON.parse(fs.readFileSync(file,'utf8'))
const write=(file,value)=>fs.writeFileSync(file,JSON.stringify(value,null,2)+'\n')
const clone=value=>structuredClone(value),results=[]
const copy=(from,to)=>{fs.mkdirSync(path.dirname(to),{recursive:true});fs.copyFileSync(from,to)}
try {
  for(const name of ['observation.json','report-body.html','report-body.txt','unimib-native-source.ax.txt']) copy(path.join(actual,'native-ui-source-observation',name),path.join(fixture,'source',name))
  for(const name of ['study-guide.pdf','study-guide.docx','provenance.json','native-copy-pasted-document.ax.txt']) copy(path.join(actual,'native-export-resumed',name),path.join(fixture,'original',name))
  const captureFile=path.join(run,'captures/notebook-reports-unimib-take1-reviewed-reader2/capture.json'),capture=read(captureFile)
  const source=read(path.join(fixture,'source/observation.json')),canonical=extractObservedReportContent(path.join(fixture,'source/report-body.html'))
  const mathRenderings=canonical.blocks.flatMap(block=>block.mathTex.map(tex=>({tex,nativeBlockIndex:block.index,canonicalSource:'html:data-math'}))).map((entry,index)=>({index,...entry}))
  write(path.join(fixture,'content.json'),{nativeContent:canonical,mathRenderings,contentRewritten:false,numericValuesRecalculated:false,fixture:true})
  fs.writeFileSync(path.join(fixture,'fixture-renderer.py'),'# Explicit structural fixture; never a production result.\n')
  execFileSync('python3',['-c',String.raw`
import json,sys,unicodedata,re
from xml.sax.saxutils import escape
from reportlab.platypus import SimpleDocTemplate,Paragraph,Spacer
from reportlab.lib.styles import getSampleStyleSheet
c=json.load(open(sys.argv[1]))['nativeContent'];styles=getSampleStyleSheet();story=[]
for b in c['blocks']:
 for value in b['textRuns']:
  value=re.sub('[\u2010-\u2015]','-',unicodedata.normalize('NFKC',value)).replace('\u00ad','')
  if value.strip():story.extend([Paragraph(escape(value),styles['BodyText']),Spacer(1,4)])
SimpleDocTemplate(sys.argv[2]).build(story)
SimpleDocTemplate(sys.argv[3]).build([Paragraph('Explicit incomplete viewport fixture.',styles['BodyText'])])
`,path.join(fixture,'content.json'),path.join(fixture,'fixture.pdf'),path.join(fixture,'incomplete.pdf')],{stdio:['ignore','pipe','pipe'],timeout:15000})
  const ref=(name,extra={})=>({path:name,sha256:hash(path.join(fixture,name)),...extra})
  const pages=Number(execFileSync('pdfinfo',[path.join(fixture,'fixture.pdf')],{encoding:'utf8'}).match(/^Pages:\s+(\d+)/m)[1])
  const manifest={schemaVersion:1,method:'observed-ui-derived-pdf',nativeDownloadClaimed:false,qualityApprovalRequired:true,resultQualityAccepted:false,captureSha256:hash(captureFile),parentNotebookUrl:capture.conversationUrl,
    artifactUrl:source.sourceUrl,sourceBookSha256:capture.book.sha256,accountDomain:'unimib.it',uiLanguage:'en',observationTime:{...source.observationTime,basis:'Explicit test bracket copied from read-only original observation; fixture is not native provenance.'},
    source:{observation:ref('source/observation.json'),html:ref('source/report-body.html'),text:ref('source/report-body.txt'),accountAx:ref('source/unimib-native-source.ax.txt'),canonicalMathAx:ref('original/native-copy-pasted-document.ax.txt')},
    content:{extracted:ref('content.json'),headings:22,tableRows:7,tableColumns:4,tableCells:28,mathElements:27},
    renderer:{engine:'ReportLab',script:ref('fixture-renderer.py'),contentRewritten:false,mathTranslation:'mechanical-observed-tex-subset'},
    retainedNativeProvenance:ref('original/provenance.json'),retainedNativeExports:['pdf','docx'].map(format=>ref('original/study-guide.'+format,{format,bytes:fs.statSync(path.join(fixture,'original/study-guide.'+format)).size})),
    pdf:ref('fixture.pdf',{bytes:fs.statSync(path.join(fixture,'fixture.pdf')).size,pages})}
  const metadata={method:'observed-ui-derived-pdf',sourceUrl:capture.conversationUrl,nativeDownloadClaimed:false,qualityApprovalRequired:true,exportedAt:'2026-11-08T23:00:00Z',derivationManifest:{path:'manifest.json',sha256:''}}
  const item={key:'notebook-reports',service:'NotebookLM',resultRequirements:{interactiveRequired:false,kinds:['file']}}
  const validate=(change=()=>{})=>{
    const options={item:clone(item),capture:clone(capture),captureSha256:hash(captureFile),artifact:path.join(fixture,'fixture.pdf'),metadata:clone(metadata),manifestFile:path.join(fixture,'manifest.json'),allowedRoot:fixture},m=clone(manifest)
    change(options,m);write(options.manifestFile,m);options.metadata.derivationManifest.sha256=hash(options.manifestFile)
    return validateObservedUiDerivedPdf(options)
  }
  const positive=validate();assert.equal(positive.visualQualityOrAcceptanceGranted,false);assert.equal(positive.nonmathRunsVerifiedInOrder,144)
  results.push({name:'complete-technical-fixture-without-visual-approval',passed:true,fixture:true})
  const negatives={
    'wrong-key':o=>o.item.key='notebook-slides','wrong-service':o=>o.item.service='ChatGPT','interactive-result':o=>o.item.resultRequirements.interactiveRequired=true,
    'wrong-extension':o=>o.artifact=path.join(fixture,'fixture.txt'),'native-download-claim':o=>o.metadata.nativeDownloadClaimed=true,
    'native-copy-claim':o=>o.metadata.clipboardSha256='0'.repeat(64),'automatic-quality-waiver':o=>o.metadata.qualityApprovalRequired=false,
    'wrong-capture':(o,m)=>m.captureSha256='0'.repeat(64),'wrong-owner':(o,m)=>m.parentNotebookUrl='https://notebook.google.com/notebook/other',
    'manifest-automatic-quality':(o,m)=>m.resultQualityAccepted=true,'manifest-native-download':(o,m)=>m.nativeDownloadClaimed=true,
    'manifest-quality-waiver':(o,m)=>m.qualityApprovalRequired=false,
    'wrong-artifact':(o,m)=>m.artifactUrl=m.parentNotebookUrl,'wrong-book':(o,m)=>m.sourceBookSha256='0'.repeat(64),'wrong-account':(o,m)=>m.accountDomain='other.example',
    'wrong-language':(o,m)=>m.uiLanguage='it','source-hash-changed':(o,m)=>m.source.html.sha256='0'.repeat(64),
    'source-path-escape':(o,m)=>m.source.html.path='../outside.html','observation-time-backdated':(o,m)=>m.observationTime.earliest='2020-01-01T00:00:00Z',
    'observation-after-export':o=>o.metadata.exportedAt='2020-01-01T00:00:00Z','missing-bracket-basis':(o,m)=>delete m.observationTime.basis,
    'heading-omission':(o,m)=>m.content.headings=21,'table-cell-omission':(o,m)=>m.content.tableCells=27,'math-omission':(o,m)=>m.content.mathElements=26,
    'rewritten-content-claim':(o,m)=>m.renderer.contentRewritten=true,'renderer-code-hash-changed':(o,m)=>m.renderer.script.sha256='0'.repeat(64),
    'missing-native-original':(o,m)=>m.retainedNativeExports.pop(),'native-original-changed':(o,m)=>m.retainedNativeExports[0].sha256='0'.repeat(64),
    'retained-other-is-not-quality-candidate':(o,m)=>m.retainedOtherExports=[ref('original/study-guide.pdf',{format:'pdf',bytes:fs.statSync(path.join(fixture,'original/study-guide.pdf')).size,role:'quality-candidate'})],
    'retained-other-bytes-changed':(o,m)=>m.retainedOtherExports=[ref('original/study-guide.pdf',{format:'pdf',bytes:1,role:'preserved-native-export-not-quality-candidate'})],
    'one-page-viewport':(o,m)=>{o.artifact=path.join(fixture,'incomplete.pdf');m.pdf=ref('incomplete.pdf',{bytes:fs.statSync(o.artifact).size,pages:1})},
  }
  for(const [name,change]of Object.entries(negatives)){assert.throws(()=>validate(change),/Observed UI derived PDF/);results.push({name,passed:true,expected:'reject',fixture:true})}
  for(const [name,change]of Object.entries({
    'canonical-prose-rewrite':v=>v.nativeContent.blocks[1].textRuns[0]='Rewritten fixture prose.',
    'canonical-math-rewrite':v=>v.nativeContent.mathTex[0]='x',
    'canonical-list-omission':v=>v.nativeContent.blocks.splice(30,1),
    'canonical-order-change':v=>v.nativeContent.blocks.reverse(),
  })){
    const original=fs.readFileSync(path.join(fixture,'content.json')),changed=JSON.parse(original);change(changed);write(path.join(fixture,'content.json'),changed)
    assert.throws(()=>validate((o,m)=>m.content.extracted=ref('content.json')),/complete native content manifest/)
    fs.writeFileSync(path.join(fixture,'content.json'),original);results.push({name,passed:true,expected:'reject',fixture:true})
  }
  for(const [name,change]of Object.entries({
    'rendered-math-map-rewrite':v=>v.mathRenderings[0].tex='x',
    'rendered-math-map-wrong-block':v=>v.mathRenderings[0].nativeBlockIndex=0,
    'rendered-math-map-omission':v=>v.mathRenderings.pop(),
    'numeric-values-recalculated':v=>v.numericValuesRecalculated=true,
  })){
    const file=path.join(fixture,'content.json'),original=fs.readFileSync(file),changed=JSON.parse(original);change(changed);write(file,changed)
    assert.throws(()=>validate((o,m)=>m.content.extracted=ref('content.json')),/mechanical math rendering map/)
    fs.writeFileSync(file,original);results.push({name,passed:true,expected:'reject',fixture:true})
  }
  {
    const file=path.join(fixture,'source/observation.json'),original=fs.readFileSync(file),changed=JSON.parse(original)
    changed.method='Unsupported hidden application state, explicit negative fixture';write(file,changed)
    assert.throws(()=>validate((o,m)=>m.source.observation=ref('source/observation.json')),/observed DOM\/text\/account\/artifact/)
    fs.writeFileSync(file,original);results.push({name:'unsupported-source-observation-method',passed:true,expected:'reject',fixture:true})
  }
  const result={file:{sha256:manifest.pdf.sha256},sourceExport:{method:'observed-ui-derived-pdf',captureSha256:manifest.captureSha256,exportedAt:metadata.exportedAt,derivationValidation:{sourceObservationSha256:manifest.source.observation.sha256}}}
  assert.equal(auditDerivedPdfQuality({directory:fixture,result,qa:{accepted:true,resultQualityAccepted:true}}).length,2,'Self-declared accepted/quality true must not replace peer/root review')
  const reviews={}
  for(const role of ['peer','root']){
    const review={role,verdict:'pass',reviewedBy:role==='root'?'root':'explicit-independent-test-fixture',reviewedAt:'2026-11-08T23:01:00Z',approvalAuthority:role==='root'?'root':undefined,independent:role==='peer',pdfSha256:result.file.sha256,captureSha256:manifest.captureSha256,sourceObservationSha256:manifest.source.observation.sha256,allPagesVisuallyReviewed:true,completeContentManifestVerified:true,readableTable:true,readableMath:true,fixture:true}
    write(path.join(fixture,role+'.json'),review);reviews[role]=ref(role+'.json')
  }
  const qa={resultQualityAccepted:true,derivedPdfQualityReviews:reviews}
  assert.deepEqual(auditDerivedPdfQuality({directory:fixture,result,qa}),[])
  for(const role of ['peer','root']){
    const changed=clone(qa);changed.derivedPdfQualityReviews[role].sha256='0'.repeat(64)
    assert.ok(auditDerivedPdfQuality({directory:fixture,result,qa:changed}).includes('derived-pdf-missing-current-'+role+'-quality-review'))
  }
  assert.ok(auditDerivedPdfQuality({directory:fixture,result,qa:{...qa,resultQualityAccepted:false}}).includes('derived-pdf-quality-not-approved'))
  for(const [name,change]of Object.entries({
    'stale-pdf':v=>v.pdfSha256='0'.repeat(64),'stale-capture':v=>v.captureSha256='0'.repeat(64),
    'stale-observation':v=>v.sourceObservationSha256='0'.repeat(64),'not-all-pages':v=>v.allPagesVisuallyReviewed=false,
    'math-not-readable':v=>v.readableMath=false,'table-not-readable':v=>v.readableTable=false,
    'not-independent':v=>v.independent=false,'predates-derived-export':v=>v.reviewedAt='2020-01-01T00:00:00Z',
  })){
    const original=fs.readFileSync(path.join(fixture,'peer.json')),changed=JSON.parse(original);change(changed);write(path.join(fixture,'peer.json'),changed)
    const q=clone(qa);q.derivedPdfQualityReviews.peer=ref('peer.json')
    assert.ok(auditDerivedPdfQuality({directory:fixture,result,qa:q}).includes('derived-pdf-missing-current-peer-quality-review'))
    fs.writeFileSync(path.join(fixture,'peer.json'),original);results.push({name:'quality-'+name,passed:true,expected:'reject',fixture:true})
  }
  results.push({name:'technical-pass-cannot-grant-quality-or-replace-two-current-reviewers',passed:true,fixture:true})
  const output=path.join(run,'qa-observed-ui-derived-pdf');fs.mkdirSync(output,{recursive:true})
  write(path.join(output,'test-report.json'),{generatedAt:new Date().toISOString(),allPassed:true,tests:results,scope:'Explicit temporary fixtures only; technical completeness, negative provenance and mandatory independent quality gates. No fixture accepted as production/native export.'})
  console.log(JSON.stringify({allPassed:true,tests:results.length,report:path.relative(root,path.join(output,'test-report.json'))}))
} finally {fs.rmSync(fixture,{recursive:true,force:true})}
