/** Narrow provenance/completeness gate for the staged Notebook Reports PDF projection. */
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import {execFileSync} from 'node:child_process'
import {fileURLToPath} from 'node:url'
import {validateObservedQuizDerivedPdf,quizDerivedPdfReferences} from './observed-quiz-derived-pdf.mjs'

const hash = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex')
const read = file => JSON.parse(fs.readFileSync(file, 'utf8'))
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b)
const validTime = value => typeof value === 'string' && Number.isFinite(Date.parse(value))
const contained = (root, file) => {
  const relative = path.relative(path.resolve(root), path.resolve(file))
  return relative && !relative.startsWith('..') && !path.isAbsolute(relative)
}
const norm = value => value.normalize('NFKC').replace(/[\u2010-\u2015]/gu, '-').replace(/\u00ad/g, '').replace(/\s+/gu, ' ').trim()
const extractor = path.join(path.dirname(fileURLToPath(import.meta.url)), 'observed-report-content.py')

export function extractObservedReportContent(html) {
  return JSON.parse(execFileSync('python3', [extractor, html], {encoding: 'utf8', timeout: 15000, maxBuffer: 4 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe']}))
}

export function derivedPdfReferences(manifest) {
  if(manifest.kind==='native-quiz-ui-derived-pdf')return quizDerivedPdfReferences(manifest)
  return [...['observation','html','text','accountAx','canonicalMathAx'].map(key => manifest.source?.[key]),
    manifest.content?.extracted, manifest.renderer?.script, ...(manifest.renderer?.extractor ? [manifest.renderer.extractor] : []),
    manifest.retainedNativeProvenance, ...(manifest.retainedNativeExports || []), ...(manifest.retainedOtherExports || []), manifest.pdf]
}

export function validateObservedUiDerivedPdf({item, capture, captureSha256, artifact, metadata, manifestFile, allowedRoot}) {
  if(item.key==='notebook-quiz')return validateObservedQuizDerivedPdf({item,capture,captureSha256,artifact,metadata,manifestFile,allowedRoot})
  const fail = reason => { throw Error('Observed UI derived PDF: ' + reason) }
  if (item.key !== 'notebook-reports' || item.service !== 'NotebookLM' || item.resultRequirements?.interactiveRequired !== false
      || !item.resultRequirements?.kinds?.includes('file') || path.extname(artifact).toLowerCase() !== '.pdf') fail('only the approved noninteractive Notebook Reports PDF is allowed')
  if (metadata.method !== 'observed-ui-derived-pdf' || metadata.nativeDownloadClaimed !== false || metadata.qualityApprovalRequired !== true
      || metadata.clipboardSha256 || metadata.copySurface || metadata.clipboardReadAt || metadata.clipboardReadTime) fail('must disclose derivation without a native Download/Copy claim or automatic quality approval')
  if (!allowedRoot || !contained(allowedRoot, manifestFile) || !fs.existsSync(manifestFile)
      || !contained(fs.realpathSync(allowedRoot), fs.realpathSync(manifestFile))
      || hash(manifestFile) !== metadata.derivationManifest?.sha256) fail('manifest location/hash mismatch')
  const manifest = read(manifestFile), base = path.dirname(manifestFile)
  const resolve = entry => {
    if (!entry || typeof entry.path !== 'string' || !/^[a-f0-9]{64}$/.test(entry.sha256 || '')) fail('missing hash-bound derivation evidence')
    const file = path.resolve(base, entry.path)
    if (!contained(allowedRoot, file) || !fs.existsSync(file) || !fs.statSync(file).isFile()
        || !contained(fs.realpathSync(allowedRoot), fs.realpathSync(file)) || hash(file) !== entry.sha256) fail('derivation evidence escapes its bundle or changed: ' + entry.path)
    return file
  }
  if (manifest.schemaVersion !== 1 || manifest.method !== 'observed-ui-derived-pdf' || manifest.captureSha256 !== captureSha256
      || manifest.nativeDownloadClaimed !== false || manifest.qualityApprovalRequired !== true || manifest.resultQualityAccepted !== false) fail('manifest schema/source capture mismatch or an automatic quality/native-download claim')
  const owner = capture.ownerConversationUrl || capture.conversationUrl
  if (!capture.complete || capture.accountDomain !== 'unimib.it' || capture.uiLanguage !== 'en' || metadata.sourceUrl !== owner
      || manifest.parentNotebookUrl !== owner || manifest.accountDomain !== 'unimib.it' || manifest.uiLanguage !== 'en'
      || manifest.sourceBookSha256 !== capture.book?.sha256) fail('actual English Unimib owner/book binding mismatch')
  if (!capture.nativeUsageRetakes?.some(r => r.kind === 'native-artifact-reader' && r.artifactUrl === manifest.artifactUrl && r.doesNotSupplyResult === true)) fail('artifact is not the genuinely recorded report')
  const observation = read(resolve(manifest.source?.observation))
  const html = resolve(manifest.source?.html), text = resolve(manifest.source?.text)
  const account = fs.readFileSync(resolve(manifest.source?.accountAx), 'utf8')
  const canonicalMathAx = fs.readFileSync(resolve(manifest.source?.canonicalMathAx), 'utf8')
  if (observation.method !== 'Read-only serialization of the original rendered NotebookLM report body; no page mutation or hidden application state'
      || observation.sourceUrl !== manifest.artifactUrl || observation.parentNotebookUrl !== owner
      || observation.sourceBookSha256 !== capture.book.sha256 || observation.accountDomain !== 'unimib.it' || observation.uiLanguage !== 'en'
      || observation.htmlSha256 !== hash(html) || observation.textSha256 !== hash(text)
      || path.basename(html) !== observation.htmlFile || path.basename(text) !== observation.textFile
      || !account.includes(manifest.artifactUrl) || !/Google Account[^\n]*@unimib\.it/i.test(account)) fail('original observed DOM/text/account/artifact evidence mismatch')
  const bracket = manifest.observationTime, originalBracket = observation.observationTime
  if (!validTime(bracket?.earliest) || !validTime(bracket?.latest) || !bracket.basis
      || bracket.earliest !== originalBracket?.earliest || bracket.latest !== originalBracket?.latest
      || Date.parse(bracket.earliest) > Date.parse(bracket.latest) || Date.parse(bracket.earliest) < Date.parse(capture.startedAt)
      || !validTime(metadata.exportedAt) || Date.parse(bracket.latest) > Date.parse(metadata.exportedAt)) fail('actual observation request/response time bracket is missing, backdated or later than derivation')
  const canonical = extractObservedReportContent(html)
  const extracted = read(resolve(manifest.content?.extracted)), supplied = extracted.nativeContent || extracted
  if (!same(supplied, canonical)) fail('complete native content manifest was rewritten, omitted, reordered or changed canonical math')
  const nativeMath = canonical.blocks.flatMap(block => block.mathTex.map(tex => ({tex, nativeBlockIndex: block.index})))
  if (extracted.contentRewritten !== false || extracted.numericValuesRecalculated !== false
      || !Array.isArray(extracted.mathRenderings) || extracted.mathRenderings.length !== nativeMath.length
      || nativeMath.some((entry, index) => {
        const mapped = extracted.mathRenderings[index]
        return mapped.index !== index || mapped.tex !== entry.tex || mapped.nativeBlockIndex !== entry.nativeBlockIndex || mapped.canonicalSource !== 'html:data-math'
      })) fail('mechanical math rendering map must retain every original TeX value and native block without recalculating values')
  const counts = {headings: canonical.headings.length, tableRows: canonical.tables[0]?.length,
    tableColumns: canonical.tables[0]?.[0]?.length, tableCells: canonical.tables.flat(2).length, mathElements: canonical.mathTex.length}
  if (!same(canonical.headings, observation.headings) || !same(canonical.tables, observation.tables)
      || canonical.blocks.length !== 119 || canonical.tables.length !== 1
      || !same(counts, {headings: 22, tableRows: 7, tableColumns: 4, tableCells: 28, mathElements: 27})
      || Object.entries(counts).some(([key, value]) => manifest.content[key] !== value)
      || !fs.readFileSync(text, 'utf8').startsWith(observation.title)) fail('incomplete report headings, lists, comparison table, questions/answers or formulas')
  const softmax = canonical.mathTex.find(value => value.includes('\\frac') && value.includes('\\sum'))
  if (!softmax || !canonicalMathAx.includes(softmax)) fail('canonical Softmax TeX lacks independent actual native Copy/TextEdit corroboration')
  if (manifest.renderer?.engine !== 'ReportLab' || manifest.renderer.contentRewritten !== false
      || manifest.renderer.mathTranslation !== 'mechanical-observed-tex-subset') fail('renderer must disclose a mechanical projection without rewritten content')
  resolve(manifest.renderer.script)
  if (manifest.renderer.extractor) resolve(manifest.renderer.extractor)
  const originals = manifest.retainedNativeExports
  if (!Array.isArray(originals) || originals.length !== 2 || !['pdf', 'docx'].every(format => originals.some(e => e.format === format))) fail('both original native PDF and DOCX must remain retained')
  const native = read(resolve(manifest.retainedNativeProvenance))
  if (native.method !== 'native-download' || native.sourceUrl !== owner || native.originalNotebookReportArtifactUrl !== manifest.artifactUrl
      || native.nativeGoogleDocAccount !== 'unimib.it') fail('retained originals lack their actual original native provenance')
  for (const entry of originals) {
    const file = resolve(entry), expected = entry.format === 'pdf' ? native.artifactSha256 : native.nativeDocxCompanion?.sha256
    if (hash(file) !== expected || fs.statSync(file).size !== entry.bytes || path.extname(file) !== '.' + entry.format) fail('retained native original bytes/provenance mismatch')
  }
  for (const entry of manifest.retainedOtherExports || []) {
    const file = resolve(entry)
    if (entry.role !== 'preserved-native-export-not-quality-candidate' || entry.format !== 'pdf'
        || path.extname(file) !== '.pdf' || fs.statSync(file).size !== entry.bytes) fail('other retained export must remain explicitly separate from the quality candidate')
  }
  const pdf = resolve(manifest.pdf)
  if (hash(pdf) !== hash(artifact) || fs.statSync(pdf).size !== manifest.pdf.bytes) fail('derived PDF bytes do not match the manifest')
  const info = execFileSync('pdfinfo', [artifact], {encoding: 'utf8', timeout: 10000, stdio: ['ignore', 'pipe', 'pipe']})
  if (Number(info.match(/^Pages:\s+(\d+)/m)?.[1]) !== manifest.pdf.pages || !(manifest.pdf.pages > 1)) fail('derived PDF page manifest mismatch or incomplete one-page viewport')
  const pdfText = norm(execFileSync('pdftotext', ['-raw', artifact, '-'], {encoding: 'utf8', timeout: 10000, maxBuffer: 4 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe']}))
  let cursor = 0, coveredRuns = 0
  for (const block of canonical.blocks) for (const run of block.textRuns) {
    const target = norm(run)
    if (!target) continue
    const at = pdfText.indexOf(target, cursor)
    if (at < 0) fail('PDF omits, rewrites or reorders native nonmath content at block ' + block.index + ': ' + target.slice(0, 70))
    cursor = at + target.length
    coveredRuns++
  }
  return {method: 'observed-ui-derived-pdf', technicalProvenanceAndCompleteNonmathCoverageVerified: true,
    sourceObservationSha256: manifest.source.observation.sha256, canonicalBlocks: canonical.blocks.length, ...counts,
    nonmathRunsVerifiedInOrder: coveredRuns, nativeOriginalsRetained: true, qualityApprovalRequired: true,
    visualQualityOrAcceptanceGranted: false, nativeDownloadClaimed: false}
}

/** A technical derivation cannot grant either a peer quality verdict or root approval. */
export function auditDerivedPdfQuality({directory, result, qa}) {
  if (result.sourceExport?.method !== 'observed-ui-derived-pdf') return []
  const failures = []
  if (qa?.resultQualityAccepted !== true) failures.push('derived-pdf-quality-not-approved')
  for (const role of ['peer', 'root']) {
    const reference = qa?.derivedPdfQualityReviews?.[role]
    try {
      if (!reference || !contained(directory, path.resolve(directory, reference.path))) throw Error('missing')
      const file = path.resolve(directory, reference.path)
      if (!contained(fs.realpathSync(directory), fs.realpathSync(file)) || hash(file) !== reference.sha256) throw Error('changed')
      const review = read(file)
      if (review.role !== role || review.verdict !== 'pass' || !review.reviewedBy || !validTime(review.reviewedAt)
          || (role === 'root' && review.approvalAuthority !== 'root') || (role === 'peer' && review.independent !== true)
          || Date.parse(review.reviewedAt) < Date.parse(result.sourceExport.exportedAt)
          || review.pdfSha256 !== result.file.sha256 || review.captureSha256 !== result.sourceExport.captureSha256
          || review.sourceObservationSha256 !== result.sourceExport.derivationValidation?.sourceObservationSha256
          || review.allPagesVisuallyReviewed !== true || review.completeContentManifestVerified !== true
          || review.readableMath !== true
          || (result.sourceExport.derivationValidation?.kind==='native-quiz-ui-derived-pdf'
            ? review.allQuestionsOptionsHintsAndExplanationsVerified!==true||review.correctAnswerLabelsVerified!==true
            : review.readableTable!==true)) throw Error('invalid')
    } catch { failures.push('derived-pdf-missing-current-' + role + '-quality-review') }
  }
  return failures
}
