/** Validate a versioned user scope change without changing clip acceptance. */
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import {fileURLToPath} from 'node:url'

const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..')
const read=f=>JSON.parse(fs.readFileSync(f,'utf8'))
const sha=f=>crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex')
const DEFERRED=['goblin-compiler','goblin-magic-todo','goblin-estimator','goblin-taskmaster','goblin-professor','goblin-formalizer','study-tools-drawio','study-tools-excalidraw']
const REMAINING=['notebook-mind-map','notebook-quiz','notebook-flashcards','notebook-video','skills-the-learning-skill','widget-flashcard']
const sameSet=(a,b)=>Array.isArray(a)&&a.length===b.length&&new Set(a).size===a.length&&a.every(x=>b.includes(x))
const core=item=>Object.fromEntries(Object.entries(item).filter(([key])=>key!=='status'))
const ref=(value,run,root)=>{
  const file=path.resolve(root,value?.path||'')
  if(!file.startsWith(path.resolve(run)+path.sep)||!fs.existsSync(file)||!fs.statSync(file).isFile()||sha(file)!==value?.sha256)throw Error('Versioned scope evidence is missing or changed')
  return {file,value:read(file)}
}

export function validateRefreshScope(run,inventory,rootDirectory=ROOT) {
  const pointer=path.join(run,'active-scope-policy.json')
  if(!fs.existsSync(pointer)) {
    if(inventory.approvedVideoCount!==49||inventory.items?.length!==49||new Set(inventory.items.map(i=>i.key)).size!==49)throw Error('A changed refresh scope requires its explicit versioned user instruction')
    return {valid:true,historicalApproved:49,activeApproved:49,deferredCount:0,policyId:null}
  }
  const link=read(pointer),record=ref(link,run,rootDirectory),p=record.value
  if(link.schemaVersion!==1||p.schemaVersion!==1||link.policyId!==p.policyId||p.policyId!=='2026-11-08-only-six-remaining-v1')throw Error('Unsupported or ambiguous refresh scope revision')
  const authorization=ref(p.authorization,run,rootDirectory).value
  if(authorization.kind!=='explicit-user-scope-instruction-quoted-by-root'||!authorization.exactUserQuote||authorization.observedBy!=='/root'||authorization.noNewAcceptanceAuthorizedByScopeChange!==true||!sameSet(authorization.interpretation?.continueSixKeys,REMAINING)||!sameSet(authorization.interpretation?.deferEightKeys,DEFERRED)||authorization.interpretation.preserveExistingMediaAndSlides!==true)throw Error('Scope revision lacks the actual explicit user instruction')
  const historical=ref(p.historicalInventory,run,rootDirectory).value
  if(historical.approvedVideoCount!==49||historical.items?.length!==49||new Set(historical.items.map(i=>i.key)).size!==49||p.historicalInventory.byteExactOriginalHashMatched!==true)throw Error('Preserve the frozen historical49-item inventory')
  const deferred=p.deferredItems||[],expected=historical.items.filter(i=>!DEFERRED.includes(i.key))
  if(!sameSet(deferred.map(x=>x.key),DEFERRED)||deferred.some(x=>x.disposition!=='deferred-by-user'||x.preserveExistingMedia!==true||x.preserveSlideReferences!==true)||!sameSet(p.remainingAtAuthorization,REMAINING)||!sameSet(p.activeKeys,expected.map(x=>x.key)))throw Error('Only the eight explicitly deferred items may leave this active refresh')
  if(inventory.approvedVideoCount!==41||inventory.items?.length!==41||!sameSet(inventory.items.map(i=>i.key),p.activeKeys)||inventory.items.some(i=>JSON.stringify(core(i))!==JSON.stringify(core(expected.find(x=>x.key===i.key)))))throw Error('The active41 inventory differs from the authorized historical source entries')
  const prior=ref(p.acceptedAtAuthorization?.evidence,run,rootDirectory).value
  const accepted=prior.clips.filter(c=>c.accepted).map(c=>c.key)
  if(p.acceptedAtAuthorization.count!==35||accepted.length!==35||!sameSet(p.acceptedAtAuthorization.keys,accepted)||accepted.some(k=>!p.activeKeys.includes(k))||!sameSet(p.activeKeys.filter(k=>!accepted.includes(k)),REMAINING))throw Error('Scope reduction must preserve the actual35 accepted decisions and only six remaining items')
  const b=p.baselineProtection,baseline=ref({path:b?.referenceManifestPath,sha256:b?.referenceManifestSha256},run,rootDirectory).value
  if(b.referenceCount!==154||baseline.files?.length!==154||b.preserveEditorialAnchors?.length!==5||p.completionBarrier?.requiredAcceptedCount!==41||p.completionBarrier.allActiveItemsMustPassCurrentStrictQa!==true||p.completionBarrier.scopeChangeCannotSetAcceptedFlags!==true)throw Error('Scope change cannot weaken baseline or current QA requirements')
  return {valid:true,historicalApproved:49,activeApproved:41,deferredCount:8,deferredKeys:[...DEFERRED],policyId:p.policyId,policyPath:link.path,policySha256:link.sha256,authorizationPath:p.authorization.path,historicalInventoryPath:p.historicalInventory.path}
}

/** Integration must preserve the five already audited editorial changes. */
export function verifyScopeBaselineForIntegration(run,inventory,rootDirectory=ROOT) {
  const scope=validateRefreshScope(run,inventory,rootDirectory)
  if(!scope.policyId)throw Error('This staged integration requires the current explicit active-scope policy')
  const p=ref(read(path.join(run,'active-scope-policy.json')),run,rootDirectory).value
  const editorial=p.baselineProtection.preserveEditorialAnchors
  const checks=editorial.map(e=>({path:e.path,unchanged:fs.existsSync(path.resolve(rootDirectory,e.path))&&sha(path.resolve(rootDirectory,e.path))===e.sha256}))
  return {preserved:checks.every(x=>x.unchanged),checks,expectedChangedPaths:editorial.map(e=>e.path),referenceCount:154}
}
