import fs from 'node:fs/promises'
import path from 'node:path'
import os from 'node:os'
import { createHash } from 'node:crypto'
import { crc32, deflateRawSync } from 'node:zlib'
import { spawnSync } from 'node:child_process'

// Explicit delivery allowlist. This script never traverses the repository root.
// ZIP32 layout: https://pkware.cachefly.net/webdocs/casestudies/APPNOTE.TXT
// Only Node built-ins and the system's unzip verifier are required.
import { projectRoot as root } from '../lib/project.mjs'
const archiveRoot = 'EduForum-2026'
const archiveName = 'EduForum-2026-kit.zip'
const epoch = new Date(process.env.SOURCE_DATE_EPOCH
  ? Number(process.env.SOURCE_DATE_EPOCH) * 1000 : '2026-11-02T00:00:00Z')
const rootFiles = [
  'README.md', 'package.json', 'pnpm-lock.yaml', 'pnpm-workspace.yaml',
  'vite.config.ts', 'slides.md', 'mru.md',
  'docs/workshop-brief.md',
]
const trees = ['data', 'components', 'composables', 'utils', 'assets', 'styles', 'setup', 'scripts', 'docs', 'tests', 'public', 'dist',
  'booklet-genai/template', 'booklet-genai/bibliografia', 'booklet-genai/assets',
  'booklet-genai/scripts']
const extraFiles = [
  'booklet-genai/main.typ', 'booklet-genai/capitolo-genai.typ', 'booklet-genai/contenuti.mjs',
  'booklet-genai/README.md', 'booklet-genai/verification.md', 'booklet-genai/lettura.html',
  'booklet-genai/voiceover-attempt.json',
  'booklet-genai/lettura.css', 'booklet-genai/lettura.js',
  'booklet-genai/build/Fondamenti_GenAI_Cremaschi.pdf',
  'booklet-genai/build/pdf-check.json', 'booklet-genai/build/reading-check.json',
  'exports/EduForum-2026.pdf', 'exports/Foundations_of_Generative_AI.pdf',
]
const required = [
  ...rootFiles, 'data/generated/slides.json', 'dist/index.html',
  'exports/EduForum-2026.pdf', 'exports/Foundations_of_Generative_AI.pdf',
  'booklet-genai/main.typ', 'booklet-genai/contenuti.mjs',
  'booklet-genai/voiceover-attempt.json',
  'booklet-genai/build/Fondamenti_GenAI_Cremaschi.pdf',
  'public/materials/kit.html',
  'public/materials/booklet-genai/Fondamenti_GenAI_Cremaschi.pdf',
  'public/materials/demo-genai/index.html', 'public/materials/demo-genai/app.js',
  'public/materials/demo-genai/model-manifest.json',
  'public/materials/demo-genai/prepare-model.mjs',
  'public/materials/demo-genai/vendor/ort-wasm-simd-threaded.jsep.wasm',
  'public/materials/demo-genai/vendor/LICENSE-Qwen',
  'public/materials/demo-genai/demo-reale.mp4',
  'public/materials/demo-genai/demo-reale.en.vtt',
  'public/materials/demo-genai/trascrizione-demo.txt',
  'public/materials/demo-genai/captures/verified-results.json',
]
const extensions = new Set([
  '.md', '.json', '.ts', '.vue', '.mjs', '.js', '.css', '.html', '.yaml', '.yml',
  '.txt', '.csv', '.bib', '.typ', '.excalidraw', '.png', '.jpg', '.jpeg', '.webp',
  '.svg', '.gif', '.avif', '.ico', '.woff', '.woff2', '.ttf', '.otf', '.eot',
  '.mp4', '.webm', '.vtt', '.wasm', '.pdf', '.py', '.drawio', '.tsv',
])
const excludedPrefixes = ['public/materials/demo-genai/models/', 'dist/materials/demo-genai/models/']
const secretPatterns = [
  ['private key', /-----BEGIN (?:RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----/],
  ['API token', /\bsk-(?:proj-|ant-)?[A-Za-z0-9_-]{24,}\b/],
  ['GitHub token', /\bgh[pousr]_[A-Za-z0-9]{30,}\b/],
  ['AWS access key', /\b(?:AKIA|ASIA)[A-Z0-9]{16}\b/],
]
const maxFileBytes = 64 * 1024 * 1024
const maxRawBytes = 256 * 1024 * 1024
const hash = buffer => createHash('sha256').update(buffer).digest('hex')
const compare = (a, b) => a < b ? -1 : a > b ? 1 : 0
const excluded = []

function denied(relative) {
  if (relative.split('/').some(segment => segment.startsWith('.') || ['node_modules', 'output', 'review'].includes(segment))) return 'hidden, dependency or diagnostic path'
  if (excludedPrefixes.some(prefix => (relative + '/').startsWith(prefix))) return 'model weights are intentionally omitted'
  if (/\.(?:onnx|bin|safetensors|pt|pth|pem|key|p12|pfx|map)$/i.test(relative)) return 'weight, credential or source-map file'
  if (/^(?:id_rsa|id_ed25519)(?:\.|$)/.test(path.basename(relative))) return 'credential filename'
  if (/^Presenter_Notes_/.test(path.basename(relative)) || path.basename(relative) === 'facilitator-guide-it.txt') return 'presenter notes have been removed'
  return null
}
function eligible(relative) {
  const reason = denied(relative)
  if (reason) { excluded.push({ path: relative, reason }); return false }
  const name = path.basename(relative)
  const permitted = extensions.has(path.extname(name).toLowerCase()) || /license|licence/i.test(name) || relative === 'dist/_redirects'
  if (!permitted) excluded.push({ path: relative, reason: 'not on the file-type allowlist' })
  return permitted
}
async function exists(relative) { try { await fs.access(path.join(root, relative)); return true } catch { return false } }
async function walk(relative, found) {
  const why = denied(relative)
  if (why) { excluded.push({ path: relative + '/', reason: why }); return }
  for (const entry of (await fs.readdir(path.join(root, relative), { withFileTypes: true })).sort((a, b) => compare(a.name, b.name))) {
    const name = relative + '/' + entry.name
    if (entry.isSymbolicLink()) throw Error(`Symlink is not permitted in delivery: ${name}`)
    if (entry.isDirectory()) await walk(name, found)
    else if (entry.isFile() && eligible(name)) found.add(name)
  }
}
async function collect() {
  const found = new Set()
  for (const name of [...rootFiles, ...extraFiles]) if (await exists(name) && eligible(name)) found.add(name)
  for (const tree of trees) if (await exists(tree)) await walk(tree, found)
  const files = []
  let bytes = 0
  const limits = []
  for (const relative of [...found].sort(compare)) {
    const stat = await fs.lstat(path.join(root, relative))
    if (!stat.isFile()) throw Error(`Expected regular file: ${relative}`)
    if (stat.size > maxFileBytes) limits.push({ path: relative, bytes: stat.size, maximumBytes: maxFileBytes })
    bytes += stat.size
    files.push({ path: relative, bytes: stat.size })
  }
  if (bytes > maxRawBytes) limits.push({ path: 'complete archive', bytes, maximumBytes: maxRawBytes })
  const names = new Set(files.map(file => file.path))
  const missing = required.filter(name => !names.has(name))
  return { files, bytes, missing, limits }
}
function scanForSecrets(entry, buffer) {
  if (!/\.(?:md|json|ts|vue|mjs|js|css|html|yaml|yml|txt|csv|bib|typ|excalidraw|py|drawio|tsv)$/i.test(entry.path)) return
  const text = buffer.toString('utf8')
  for (const [label, expression] of secretPatterns) if (expression.test(text)) throw Error(`Possible ${label} in ${entry.path}; inspect locally before packaging. The matched value is not printed.`)
}
async function auditTextCandidates(files) {
  let scanned = 0
  for (const entry of files) {
    if (!/\.(?:md|json|ts|vue|mjs|js|css|html|yaml|yml|txt|csv|bib|typ|excalidraw|py|drawio|tsv)$/i.test(entry.path)) continue
    scanForSecrets(entry, await fs.readFile(path.join(root, entry.path))); scanned++
  }
  return scanned
}
async function staleCopies() {
  const pairs = [
    ['booklet-genai/build/Fondamenti_GenAI_Cremaschi.pdf', 'exports/Foundations_of_Generative_AI.pdf'],
    ['booklet-genai/build/Fondamenti_GenAI_Cremaschi.pdf', 'public/materials/booklet-genai/Fondamenti_GenAI_Cremaschi.pdf'],
  ]
  // Check every public resource, including shared reader JS/CSS and image changes.
  for (const entry of await fs.readdir(path.join(root, 'public'), { recursive: true, withFileTypes: true })) {
    if (!entry.isFile()) continue
    const relative = path.relative(root, path.join(entry.parentPath, entry.name)).split(path.sep).join('/')
    if (!denied(relative)) pairs.push([relative, relative.replace(/^public\//, 'dist/')])
  }
  const stale = []
  for (const [source, copy] of pairs) {
    if (!await exists(source) || !await exists(copy)) { stale.push({ source, copy, reason: 'missing copy' }); continue }
    if (hash(await fs.readFile(path.join(root, source))) !== hash(await fs.readFile(path.join(root, copy)))) stale.push({ source, copy, reason: 'different content' })
  }
  return stale
}

const kitServer = `import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.dirname(fileURLToPath(import.meta.url));
const port=Number(process.argv[2]||4178);
if(!Number.isInteger(port)||port<1024||port>65535)throw Error('Choose a port between 1024 and 65535.');
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json','.csv':'text/csv; charset=utf-8','.txt':'text/plain; charset=utf-8','.md':'text/plain; charset=utf-8','.wasm':'application/wasm','.onnx':'application/octet-stream','.pdf':'application/pdf','.woff':'font/woff','.woff2':'font/woff2','.ttf':'font/ttf','.otf':'font/otf','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.webp':'image/webp','.gif':'image/gif','.avif':'image/avif','.ico':'image/x-icon','.mp4':'video/mp4','.webm':'video/webm','.vtt':'text/vtt; charset=utf-8'};
const server=http.createServer((req,res)=>{
  if(!['GET','HEAD'].includes(req.method)){res.writeHead(405).end();return;}
  try{
    let requestPath=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
    if(requestPath==='/'){res.writeHead(302,{Location:'/dist/'}).end();return;}
    // One prepared model download serves both the source app and compiled deck.
    if(requestPath.startsWith('/dist/materials/demo-genai/models/'))requestPath=requestPath.replace('/dist/materials/demo-genai/models/','/public/materials/demo-genai/models/');
    let filename=path.resolve(root,'.'+requestPath);
    if(filename!==root&&!filename.startsWith(root+path.sep)){res.writeHead(403).end();return;}
    if(fs.statSync(filename).isDirectory())filename=path.join(filename,'index.html');
    const size=fs.statSync(filename).size;
    res.writeHead(200,{'Content-Type':mime[path.extname(filename)]||'application/octet-stream','Content-Length':size,'Cache-Control':'no-cache'});
    if(req.method==='HEAD')res.end();else fs.createReadStream(filename).pipe(res);
  }catch{res.writeHead(404,{'Content-Type':'text/plain; charset=utf-8'}).end('File not found. For the model, run node public/materials/demo-genai/prepare-model.mjs first.');}
});
server.on('error',error=>{console.error(error.message);process.exitCode=1;});
server.listen(port,'127.0.0.1',()=>{console.log('Presentation: http://127.0.0.1:'+port+'/dist/');console.log('Materials: http://127.0.0.1:'+port+'/public/materials/kit.html');console.log('Local use only. Ctrl+C to stop.');});
`
const startGuide = `# EduForum materials

This folder contains the complete English presentation, fictional textbook chapter, tool materials and editable sources. All slides follow one sequence, with no event-route selection.

## Read or present

- Open exports/EduForum-2026.pdf for the complete static deck.
- Open exports/Foundations_of_Generative_AI.pdf for the textbook chapter.
- Keep exports/ and public/ together: local PDF material links use ../public/.
- For the interactive deck and HTML reading materials, use Node.js 24.12 or newer and run:

    node serve-kit.mjs

Open http://127.0.0.1:4178/dist/ for the presentation or http://127.0.0.1:4178/public/materials/kit.html for materials. No dependency installation is needed to serve the compiled deck. The server listens only on this computer. An optional port can be supplied, for example node serve-kit.mjs 4200.

## Prepare the real model before going offline

The approximately 786 MB model weights are deliberately omitted from this lightweight archive. Run once with an internet connection:

    node public/materials/demo-genai/prepare-model.mjs

The downloader uses the pinned public Hugging Face revision and verifies file sizes and SHA-256 hashes. No paid API, subscription or account is required. After preparation, the local kit server makes this single model download available to both the app in public/ and the compiled copy in dist/. Load the model in the intended browser before the workshop. The actual recording, English captions, transcript and static results remain available without the weights.

## Edit and rebuild

See README.md for pnpm install/generate/build/export commands. Browser-based export and checks also need a compatible Playwright Chromium installation. See booklet-genai/README.md for the separate Typst build and font licences. The archive contains all bundled fonts and assets. It does not contain node_modules, Git history, model weights or bulky review captures.

KIT_MANIFEST.json lists the included file sizes and SHA-256 hashes. Its own hash is excluded to avoid a circular reference. Generated navigation files and this guide are listed. Packaging uses sorted paths and fixed ZIP timestamps for reproducibility.
`

function zipTimestamp(date) {
  if (Number.isNaN(date.valueOf()) || date.getUTCFullYear() < 1980 || date.getUTCFullYear() > 2107) throw Error('SOURCE_DATE_EPOCH must be a ZIP-compatible date between1980 and2107.')
  return { time: date.getUTCHours() << 11 | date.getUTCMinutes() << 5 | date.getUTCSeconds() >> 1,
    date: (date.getUTCFullYear() - 1980) << 9 | (date.getUTCMonth() + 1) << 5 | date.getUTCDate() }
}
async function writeZip(filename, entries) {
  const stamp = zipTimestamp(epoch)
  const file = await fs.open(filename, 'w')
  const central = []
  let offset = 0
  try {
    for (const entry of entries) {
      const name = Buffer.from(archiveRoot + '/' + entry.path, 'utf8')
      const compressed = deflateRawSync(entry.buffer, { level: 6 })
      const method = compressed.length < entry.buffer.length ? 8 : 0
      const payload = method ? compressed : entry.buffer
      const checksum = crc32(entry.buffer)
      if (offset + payload.length > 0xffffffff) throw Error('ZIP32 size limit exceeded.')
      const local = Buffer.alloc(30)
      local.writeUInt32LE(0x04034b50, 0); local.writeUInt16LE(20, 4); local.writeUInt16LE(0x800, 6)
      local.writeUInt16LE(method, 8); local.writeUInt16LE(stamp.time, 10); local.writeUInt16LE(stamp.date, 12)
      local.writeUInt32LE(checksum, 14); local.writeUInt32LE(payload.length, 18); local.writeUInt32LE(entry.buffer.length, 22)
      local.writeUInt16LE(name.length, 26)
      await file.write(local); await file.write(name); await file.write(payload)
      const header = Buffer.alloc(46)
      header.writeUInt32LE(0x02014b50, 0); header.writeUInt16LE(0x0314, 4); header.writeUInt16LE(20, 6)
      header.writeUInt16LE(0x800, 8); header.writeUInt16LE(method, 10); header.writeUInt16LE(stamp.time, 12); header.writeUInt16LE(stamp.date, 14)
      header.writeUInt32LE(checksum, 16); header.writeUInt32LE(payload.length, 20); header.writeUInt32LE(entry.buffer.length, 24)
      header.writeUInt16LE(name.length, 28); header.writeUInt32LE((0o100644 << 16) >>> 0, 38); header.writeUInt32LE(offset, 42)
      central.push(header, name)
      offset += local.length + name.length + payload.length
    }
    const start = offset
    for (const buffer of central) { await file.write(buffer); offset += buffer.length }
    const end = Buffer.alloc(22)
    end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(entries.length, 8); end.writeUInt16LE(entries.length, 10)
    end.writeUInt32LE(offset - start, 12); end.writeUInt32LE(start, 16)
    await file.write(end)
  } finally { await file.close() }
}
function inspectZip(filename, entries) {
  const test = spawnSync('unzip', ['-tqq', filename], { encoding: 'utf8', maxBuffer: 4 * 1024 * 1024 })
  if (test.error || test.status !== 0) throw Error(`ZIP CRC test failed: ${test.error?.message || test.stderr || test.stdout}`)
  const listing = spawnSync('unzip', ['-Z1', filename], { encoding: 'utf8', maxBuffer: 4 * 1024 * 1024 })
  if (listing.status !== 0) throw Error('Cannot inspect ZIP content with unzip.')
  const actual = listing.stdout.trim().split('\n').sort(compare)
  const expected = entries.map(entry => archiveRoot + '/' + entry.path).sort(compare)
  if (JSON.stringify(actual) !== JSON.stringify(expected)) throw Error('ZIP content differs from the allowlist.')
  if (actual.some(name => /(?:^|\/)(?:models|node_modules|\.git|\.env[^/]*)(?:\/|$)|\.(?:onnx|safetensors|bin|pem|key|p12|pfx)$/i.test(name))) throw Error('Forbidden weight, dependency or credential path found in ZIP.')
  if (actual.some(name => /^Presenter_Notes_/.test(path.basename(name)) || /^EduForum-2026-(?:Forum|University|Teachers)\.pdf$/.test(path.basename(name)))) throw Error('Removed presenter notes or obsolete event PDFs found in the single-deck ZIP.')
  return { crc: 'passed', listing: 'matches exact allowlist', forbiddenPaths: 0 }
}
async function selfTest() {
  if (crc32(Buffer.from('123456789')) !== 0xcbf43926) throw Error('CRC32 implementation mismatch.')
  const syntax = spawnSync(process.execPath, ['--input-type=module', '--check'], { input: kitServer, encoding: 'utf8' })
  if (syntax.status !== 0) throw Error(`Generated kit server has invalid syntax: ${syntax.stderr}`)
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'eduforum-kit-'))
  try {
    const entries = [{ path: 'hello.txt', buffer: Buffer.from('Hello\n') }, { path: 'readme-é.txt', buffer: Buffer.from('repeat '.repeat(10000)) }]
    const a = path.join(directory, 'a.zip'), b = path.join(directory, 'b.zip')
    await writeZip(a, entries); await writeZip(b, entries)
    inspectZip(a, entries)
    if (hash(await fs.readFile(a)) !== hash(await fs.readFile(b))) throw Error('ZIP output is not deterministic.')
    console.log('ZIP self-test passed: generated server syntax, CRC32 known vector, Unicode filenames, stored/deflated entries, exact listing and deterministic bytes.')
  } finally { await fs.rm(directory, { recursive: true, force: true }) }
}

const args = process.argv.slice(2)
if (args.some(arg => !['--build', '--plan', '--self-test', '--help'].includes(arg))) throw Error('Use --plan, --build or --self-test.')
if (args.includes('--help')) { console.log('node scripts/delivery/package-kit.mjs --plan    Read-only delivery plan (default)\nnode scripts/delivery/package-kit.mjs --self-test    ZIP writer/verifier checks\nnode scripts/delivery/package-kit.mjs --build    Package the FINAL_BUILD_READY snapshot'); process.exit(0) }
if (args.includes('--self-test')) { await selfTest(); process.exit(0) }
// Refresh the one delivery alias rather than requiring a manual PDF copy.
if (args.includes('--build')) {
  await fs.mkdir(path.join(root, 'exports'), { recursive: true })
  await fs.copyFile(
    path.join(root, 'booklet-genai/build/Fondamenti_GenAI_Cremaschi.pdf'),
    path.join(root, 'exports/Foundations_of_Generative_AI.pdf'),
  )
}
const selection = await collect()
const stale = await staleCopies()
const groups = {}
for (const item of selection.files) { const group = item.path.split('/')[0]; groups[group] ||= { files: 0, bytes: 0 }; groups[group].files++; groups[group].bytes += item.bytes }
if (!args.includes('--build')) {
  const textFilesScanned = await auditTextCandidates(selection.files)
  console.log(JSON.stringify({ mode: 'plan only; no archive written', sourceFiles: selection.files.length, rawBytes: selection.bytes, rawMiB: +(selection.bytes / 1048576).toFixed(2), groups, missing: selection.missing, limits: selection.limits, staleCopies: stale, textFilesScanned, secretCandidates: 0, excludedPaths: excluded }, null, 2))
  process.exit(selection.missing.length || selection.limits.length ? 1 : 0)
}
if (selection.missing.length) throw Error(`Missing required delivery files: ${selection.missing.join(', ')}`)
if (selection.limits.length) throw Error(`Delivery limits exceeded: ${JSON.stringify(selection.limits)}`)
if (stale.length) throw Error(`Final build has stale copies: ${JSON.stringify(stale)}`)
const entries = []
for (const item of selection.files) {
  const buffer = await fs.readFile(path.join(root, item.path))
  if (buffer.length !== item.bytes) throw Error(`Source changed during packaging: ${item.path}`)
  scanForSecrets(item, buffer)
  entries.push({ ...item, buffer, sha256: hash(buffer) })
}
for (const [name, text] of [['KIT_START_HERE.md', startGuide], ['serve-kit.mjs', kitServer], ['output/review/demo-genai/README.md', 'This folder is reserved for newly generated browser verification outputs. Private intermediate screenshots and recording takes are omitted from the kit. Final demonstration evidence is in public/materials/demo-genai/captures/.\n']]) {
  const buffer = Buffer.from(text); entries.push({ path: name, buffer, bytes: buffer.length, sha256: hash(buffer) })
}
entries.sort((a, b) => compare(a.path, b.path))
const manifest = { formatVersion: 1, archiveRoot, zipTimestampUTC: epoch.toISOString(),
  policy: { allowlist: 'source files, final PDFs, public materials, booklet sources/assets and compiled dist', modelWeights: 'excluded; pinned downloader and SHA-256 manifest included', secrets: 'hidden/env/key paths excluded; text scanned for common private-key/API-token signatures', diagnosticBulk: 'excluded', selfHash: 'KIT_MANIFEST.json is intentionally not listed to avoid a circular hash' },
  files: entries.map(({ path, bytes, sha256 }) => ({ path, bytes, sha256 })) }
const manifestBuffer = Buffer.from(JSON.stringify(manifest, null, 2) + '\n')
entries.push({ path: 'KIT_MANIFEST.json', buffer: manifestBuffer, bytes: manifestBuffer.length, sha256: hash(manifestBuffer) })
entries.sort((a, b) => compare(a.path, b.path))
const exportsDirectory = path.join(root, 'exports')
await fs.mkdir(exportsDirectory, { recursive: true })
const output = path.join(exportsDirectory, archiveName), temporary = output + '.tmp'
try {
  await writeZip(temporary, entries)
  const verification = inspectZip(temporary, entries)
  for (const item of entries) if (selection.files.some(source => source.path === item.path)) {
    if (hash(await fs.readFile(path.join(root, item.path))) !== item.sha256) throw Error(`Source changed during ZIP creation: ${item.path}; rerun after the final build settles.`)
  }
  await fs.rename(temporary, output)
  await fs.writeFile(path.join(exportsDirectory, 'EduForum-2026-kit.manifest.json'), manifestBuffer)
  const archiveBuffer = await fs.readFile(output)
  const report = { archive: archiveName, archiveBytes: archiveBuffer.length, archiveMiB: +(archiveBuffer.length / 1048576).toFixed(2), sha256: hash(archiveBuffer), entries: entries.length,
    rawBytes: entries.reduce((total, entry) => total + entry.bytes, 0), node: process.version, verification,
    sourceStableDuringBuild: true, staleCopies: [], omittedModelWeights: true, groups }
  await fs.writeFile(path.join(exportsDirectory, 'EduForum-2026-kit.report.json'), JSON.stringify(report, null, 2) + '\n')
  console.log(JSON.stringify(report, null, 2))
} catch (error) { await fs.rm(temporary, { force: true }); throw error }
