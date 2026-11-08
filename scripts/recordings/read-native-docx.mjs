/** Read-only structural probe for an actual native Word export. Never extracts files. */
import fs from 'node:fs'
import path from 'node:path'
import {execFileSync} from 'node:child_process'

const probe = String.raw`
import json, pathlib, posixpath, sys, zipfile
import xml.etree.ElementTree as E

MAX_FILE = 25 * 1024 * 1024
MAX_MEMBER = 32 * 1024 * 1024
MAX_TOTAL = 100 * 1024 * 1024
MAX_ENTRIES = 2048
CT_NS = 'http://schemas.openxmlformats.org/package/2006/content-types'
REL_NS = 'http://schemas.openxmlformats.org/package/2006/relationships'
WORD_NS = {
    'http://schemas.openxmlformats.org/wordprocessingml/2006/main',
    'http://purl.oclc.org/ooxml/wordprocessingml/main',
}
OFFICE_RELS = {
    'http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument',
    'http://purl.oclc.org/ooxml/officeDocument/relationships/officeDocument',
}
MAIN_TYPE = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml'

def require(ok, message):
    if not ok:
        raise ValueError(message)

class NoDoctypeBuilder(E.TreeBuilder):
    def doctype(self, *args):
        raise ValueError('DOCX XML must not contain a document type or entity declarations')

def xml(data):
    return E.fromstring(data, parser=E.XMLParser(target=NoDoctypeBuilder()))

file = pathlib.Path(sys.argv[1])
require(file.is_file() and 0 < file.stat().st_size <= MAX_FILE, 'DOCX file is empty or exceeds the bounded probe limit')
require(zipfile.is_zipfile(file), 'Native DOCX is not a readable ZIP package')
with zipfile.ZipFile(file) as archive:
    entries = archive.infolist()
    require(0 < len(entries) <= MAX_ENTRIES, 'DOCX package has too many entries')
    names = [entry.filename for entry in entries]
    require(len(set(name.casefold() for name in names)) == len(names), 'DOCX package has duplicate or ambiguous member names')
    require(sum(entry.file_size for entry in entries) <= MAX_TOTAL, 'DOCX package exceeds the total uncompressed probe limit')
    roots = {}
    for entry in entries:
        name = entry.filename
        parts = name.rstrip('/').split('/')
        require(name and not name.startswith('/') and chr(92) not in name and ':' not in name
                and all(part not in ('', '.', '..') for part in parts), 'DOCX package member path is unsafe')
        require(not entry.flag_bits & 1, 'DOCX package must not be encrypted')
        require(entry.compress_type in (zipfile.ZIP_STORED, zipfile.ZIP_DEFLATED), 'DOCX member compression is unsupported')
        require(entry.file_size <= MAX_MEMBER, 'DOCX package member exceeds the bounded probe limit')
        require(not entry.file_size or entry.compress_size > 0, 'DOCX member has inconsistent compression sizes')
        require(entry.file_size <= max(1, entry.compress_size) * 1000, 'DOCX member compression ratio exceeds the bounded probe limit')
        require(not name.casefold().endswith('vbaproject.bin'), 'A .docx native export must not contain VBA')
        if entry.is_dir():
            continue
        # Reading to EOF verifies the actual member CRC. Nothing is written to disk.
        with archive.open(entry) as stream:
            data = stream.read(MAX_MEMBER + 1)
            require(len(data) == entry.file_size and len(data) <= MAX_MEMBER, 'DOCX member size is inconsistent')
            require(stream.read(1) == b'', 'DOCX member exceeds its declared size')
        if name.casefold().endswith(('.xml', '.rels')):
            roots[name] = xml(data)

    required = {'[Content_Types].xml', '_rels/.rels', 'word/document.xml'}
    require(required.issubset(roots), 'DOCX is missing a required OOXML package part')
    types = roots['[Content_Types].xml']
    require(types.tag == '{' + CT_NS + '}Types', 'DOCX content-types root is invalid')
    overrides = [element for element in types if element.tag == '{' + CT_NS + '}Override']
    main_types = [element.get('ContentType') for element in overrides if element.get('PartName') == '/word/document.xml']
    require(main_types == [MAIN_TYPE], 'DOCX main part is not an ordinary Word document')
    require(not any('macroenabled' in (element.get('ContentType') or '').casefold()
                    or 'vbaproject' in (element.get('ContentType') or '').casefold() for element in types),
            'A .docx native export must not declare macros')
    rels = roots['_rels/.rels']
    require(rels.tag == '{' + REL_NS + '}Relationships', 'DOCX package relationships root is invalid')
    office = [element for element in rels if element.get('Type') in OFFICE_RELS]
    require(len(office) == 1, 'DOCX needs one office-document relationship')
    target = office[0].get('Target') or ''
    require(office[0].get('TargetMode') != 'External' and not any(c in target for c in ':?#' + chr(92)),
            'DOCX office-document relationship must be internal')
    require(posixpath.normpath(target.lstrip('/')) == 'word/document.xml' and '..' not in target.split('/'),
            'DOCX office-document relationship points at the wrong main part')
    document = roots['word/document.xml']
    require(document.tag.startswith('{') and document.tag.endswith('}document'), 'DOCX main XML root is invalid')
    namespace = document.tag[1:].split('}', 1)[0]
    require(namespace in WORD_NS, 'DOCX main XML uses an unsupported Word namespace')
    bodies = document.findall('{' + namespace + '}body')
    require(len(bodies) == 1, 'DOCX must have one readable document body')
    body = bodies[0]
    paragraphs = sum(1 for _ in body.iter('{' + namespace + '}p'))
    tables = sum(1 for _ in body.iter('{' + namespace + '}tbl'))
    text = ''.join(element.text or '' for element in body.iter('{' + namespace + '}t'))
    require(paragraphs > 0 and text.strip(), 'DOCX document body has no readable text')
    external = sum(1 for name, root in roots.items() if name.casefold().endswith('.rels')
                   for element in root if element.get('TargetMode') == 'External')
    print(json.dumps({
        'method': 'bounded ZIP CRC and OOXML XML reader; no extraction or external resources',
        'packageEntries': len(entries), 'uncompressedBytes': sum(entry.file_size for entry in entries),
        'mainPart': 'word/document.xml', 'paragraphs': paragraphs, 'tables': tables,
        'bodyTextCharacters': len(text), 'externalRelationshipsNotFollowed': external,
        'packageStructureVerified': True, 'visualLayoutReviewed': False,
    }))
`

export function readNativeDocx(file) {
  if (path.extname(file).toLowerCase() !== '.docx') throw Error('Native Word export must use the .docx extension')
  const stat = fs.statSync(file)
  if (!stat.isFile() || stat.size <= 0 || stat.size > 25 * 1024 * 1024) throw Error('Native DOCX is empty or exceeds the bounded probe limit')
  try {
    return JSON.parse(execFileSync('python3', ['-c', probe, file], {
      encoding: 'utf8', timeout: 15000, maxBuffer: 512 * 1024, stdio: ['ignore', 'pipe', 'pipe'],
    }))
  } catch (error) {
    const reason = String(error.stderr || error.message).trim().split('\n').at(-1)
    throw Error('Native DOCX validation failed: ' + reason, {cause: error})
  }
}
