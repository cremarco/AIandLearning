/** Explicit structural fixtures only; never native result provenance or production artifacts. */
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import {execFileSync} from 'node:child_process'
import {fileURLToPath} from 'node:url'
import {readNativeDocx} from './read-native-docx.mjs'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const output = path.join(root, 'output/review/video-refresh/2026-11-07/qa-native-docx-reader')
const fixtures = path.join(output, 'fixtures')
fs.mkdirSync(fixtures, {recursive: true})

execFileSync('python3', ['-c', String.raw`
import pathlib,sys,zipfile
p=pathlib.Path(sys.argv[1])
CT='http://schemas.openxmlformats.org/package/2006/content-types'
R='http://schemas.openxmlformats.org/package/2006/relationships'
W='http://schemas.openxmlformats.org/wordprocessingml/2006/main'
OR='http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument'
T='application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml'
parts={'[Content_Types].xml':f'<Types xmlns="{CT}"><Override PartName="/word/document.xml" ContentType="{T}"/></Types>',
       '_rels/.rels':f'<Relationships xmlns="{R}"><Relationship Id="rId1" Type="{OR}" Target="word/document.xml"/></Relationships>',
       'word/document.xml':f'<w:document xmlns:w="{W}"><w:body><w:p><w:r><w:t>Explicit test fixture rubric</w:t></w:r></w:p></w:body></w:document>'}
def write(name,changes={},drop=(),extra=()):
    with zipfile.ZipFile(p/name,'w',compression=zipfile.ZIP_DEFLATED) as z:
        for key,value in {**parts,**changes}.items():
            if key not in drop:z.writestr(key,value)
        for key,value in extra:z.writestr(key,value)
write('valid.docx')
write('strict.docx',{'word/document.xml':parts['word/document.xml'].replace(W,'http://purl.oclc.org/ooxml/wordprocessingml/main')})
write('hyperlink.docx',extra=[('word/_rels/document.xml.rels',f'<Relationships xmlns="{R}"><Relationship Id="link" Type="https://example.invalid/link" Target="https://example.invalid/never-fetch" TargetMode="External"/></Relationships>')])
write('missing-main.docx',drop=['word/document.xml'])
write('missing-rels.docx',drop=['_rels/.rels'])
write('empty-body.docx',{'word/document.xml':f'<w:document xmlns:w="{W}"><w:body><w:p/></w:body></w:document>'})
write('malformed-main.docx',{'word/document.xml':'<document>unclosed'})
write('wrong-namespace.docx',{'word/document.xml':parts['word/document.xml'].replace(W,'https://example.invalid/not-word')})
write('wrong-content-type.docx',{'[Content_Types].xml':parts['[Content_Types].xml'].replace(T,'application/xml')})
write('wrong-main-target.docx',{'_rels/.rels':parts['_rels/.rels'].replace('Target="word/document.xml"','Target="word/other.xml"')})
write('external-main.docx',{'_rels/.rels':parts['_rels/.rels'].replace('Target="word/document.xml"','Target="https://example.invalid/never-fetch" TargetMode="External"')})
write('doctype.docx',{'word/document.xml':'<!DOCTYPE w:document [<!ENTITY expansion "fixture">]>'+parts['word/document.xml']})
write('doctype-utf16.docx',{'word/document.xml':('<?xml version="1.0" encoding="utf-16"?><!DOCTYPE w:document [<!ENTITY expansion "fixture">]>'+parts['word/document.xml']).encode('utf-16')})
write('traversal.docx',extra=[('../escape.txt','fixture')])
write('backslash.docx',extra=[('word'+chr(92)+'escape.txt','fixture')])
write('absolute.docx',extra=[('/escape.txt','fixture')])
write('drive.docx',extra=[('C:/escape.txt','fixture')])
write('duplicate.docx',extra=[('word/document.xml',parts['word/document.xml'])])
write('macro.docx',extra=[('word/vbaProject.bin',b'fixture-not-a-macro')])
write('ratio.docx',extra=[('word/padding.bin',b'0'*(2*1024*1024))])
(p/'not-zip.docx').write_bytes(b'Explicit fixture, not a ZIP file')
(p/'truncated.docx').write_bytes((p/'valid.docx').read_bytes()[:80])
# Corrupt one stored entry without updating its CRC.
with zipfile.ZipFile(p/'crc.docx','w',compression=zipfile.ZIP_STORED) as z:
    for key,value in parts.items():z.writestr(key,value)
data=(p/'crc.docx').read_bytes();data=data.replace(b'Explicit test fixture rubric',b'Xxplicit test fixture rubric');(p/'crc.docx').write_bytes(data)
`, fixtures], {encoding: 'utf8', timeout: 15000, stdio: ['ignore', 'pipe', 'pipe']})

const sha = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex')
const results = []
for (const name of ['valid.docx', 'strict.docx', 'hyperlink.docx']) {
  const file = path.join(fixtures, name), before = sha(file), result = readNativeDocx(file)
  assert.equal(result.packageStructureVerified, true)
  assert.equal(result.visualLayoutReviewed, false)
  assert.equal(result.bodyTextCharacters, 28)
  assert.equal(sha(file), before, 'Read-only probe changed fixture bytes')
  if (name === 'hyperlink.docx') assert.equal(result.externalRelationshipsNotFollowed, 1)
  results.push({name, fixture: true, expected: 'valid', passed: true, result})
}
for (const name of ['missing-main.docx', 'missing-rels.docx', 'empty-body.docx', 'malformed-main.docx', 'wrong-namespace.docx', 'wrong-content-type.docx', 'wrong-main-target.docx', 'external-main.docx', 'doctype.docx', 'doctype-utf16.docx', 'traversal.docx', 'backslash.docx', 'absolute.docx', 'drive.docx', 'duplicate.docx', 'macro.docx', 'ratio.docx', 'not-zip.docx', 'truncated.docx', 'crc.docx']) {
  const file = path.join(fixtures, name), before = sha(file)
  assert.throws(() => readNativeDocx(file), /DOCX|docx/)
  assert.equal(sha(file), before, 'Read-only rejection changed fixture bytes')
  results.push({name, fixture: true, expected: 'reject', passed: true})
}
const real = path.join(root, 'public/materials/teacher-tools/magicschool-rubric.docx')
if (fs.existsSync(real)) {
  const before = sha(real), result = readNativeDocx(real)
  assert.equal(result.packageStructureVerified, true)
  assert.ok(result.tables >= 1 && result.bodyTextCharacters > 100)
  assert.equal(sha(real), before, 'Read-only probe changed prior native reference artifact')
  results.push({name: path.relative(root, real), fixture: false, role: 'read-only prior native reference, not a new result', sha256: before, passed: true, result})
}
const report = {generatedAt: new Date().toISOString(), allPassed: true, scope: 'Structural native-DOCX reader checks only. Fixtures are not production results; prior native file is read-only reference. No DOCX layout acceptance claimed.', tests: results}
fs.writeFileSync(path.join(output, 'test-report.json'), JSON.stringify(report, null, 2) + '\n')
console.log(JSON.stringify({allPassed: true, tests: results.length, report: path.join(output, 'test-report.json')}))
